import {
  getEmailDomain,
  isDomainLike,
  normalizeDomain,
  normalizeEmailAddress,
} from "./email-address";
import { getAllowedDomains } from "@/shared/env";

const SOURCE_URL =
  "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt";
const MANIFEST_KEY = "auth:disposable-email-domains:manifest";
const LOCK_KEY = "auth:disposable-email-domains:refresh-lock";
const RAW_KEY_PREFIX = "auth:disposable-email-domains:raw";
const SHARD_KEY_PREFIX = "auth:disposable-email-domains:shard";
const MANIFEST_CACHE_TTL_MS = 60_000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const HARD_EXPIRE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_TTL_SECONDS = 10 * 24 * 60 * 60;
const REFRESH_LOCK_TTL_SECONDS = 5 * 60;
const SHARD_PREFIX_LENGTH = 2;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

type DisposableDomainsManifest = {
  activeSlot: "a" | "b";
  fetchedAt: string;
  refreshAfter: string;
  hardExpireAt: string;
  sourceUrl: string;
  sourceEtag: string | null;
  sourceSha256: string;
  shardPrefixes: string[];
  shardPrefixLength: number;
  domainCount: number;
};

type RefreshOptions = {
  force?: boolean;
};

type DomainLookupOptions = {
  runInBackground?: (promise: Promise<unknown>) => void;
};

let manifestCache: {
  value: DisposableDomainsManifest | null;
  loadedAtMs: number;
} | null = null;

const shardCache = new Map<string, ReadonlySet<string>>();
let refreshInFlight: Promise<DisposableDomainsManifest | null> | null = null;

export const resetDisposableEmailDomainCachesForTests = () => {
  manifestCache = null;
  shardCache.clear();
  refreshInFlight = null;
};

const parseManifest = (value: string | null) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as DisposableDomainsManifest;
    if (
      !parsed ||
      (parsed.activeSlot !== "a" && parsed.activeSlot !== "b") ||
      !Array.isArray(parsed.shardPrefixes)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const nowIso = () => new Date().toISOString();

const plusMs = (baseMs: number, offsetMs: number) =>
  new Date(baseMs + offsetMs).toISOString();

const getRawKey = (slot: DisposableDomainsManifest["activeSlot"]) =>
  `${RAW_KEY_PREFIX}:${slot}`;

const getShardPrefix = (domain: string) =>
  domain.slice(0, SHARD_PREFIX_LENGTH).padEnd(SHARD_PREFIX_LENGTH, "_");

const getShardKey = (
  slot: DisposableDomainsManifest["activeSlot"],
  shardPrefix: string
) => `${SHARD_KEY_PREFIX}:${slot}:${shardPrefix}`;

const parseDomainLines = (rawText: string) => {
  const bytes = new TextEncoder().encode(rawText).byteLength;
  if (bytes > MAX_SOURCE_BYTES) {
    throw new Error("Disposable domain source exceeded maximum size");
  }

  const domains = new Set<string>();
  for (const line of rawText.split(/\r?\n/)) {
    const normalized = normalizeDomain(line);
    if (!normalized || normalized.startsWith("#")) continue;
    if (!isDomainLike(normalized)) continue;
    domains.add(normalized);
  }

  return Array.from(domains).sort();
};

const buildShardMap = (domains: string[]) => {
  const shards = new Map<string, string[]>();

  for (const domain of domains) {
    const shardPrefix = getShardPrefix(domain);
    const bucket = shards.get(shardPrefix);
    if (bucket) {
      bucket.push(domain);
      continue;
    }
    shards.set(shardPrefix, [domain]);
  }

  return shards;
};

const parseShard = (value: string | null) => {
  if (!value) return null;
  return new Set(value.split("\n").filter(Boolean));
};

const readManifest = async (
  env: CloudflareBindings,
  options?: { bypassCache?: boolean }
) => {
  const now = Date.now();
  if (
    !options?.bypassCache &&
    manifestCache &&
    now - manifestCache.loadedAtMs < MANIFEST_CACHE_TTL_MS
  ) {
    return manifestCache.value;
  }

  const manifest = parseManifest(await env.SUM_KV.get(MANIFEST_KEY));
  manifestCache = {
    value: manifest,
    loadedAtMs: now,
  };
  return manifest;
};

const isManifestExpired = (manifest: DisposableDomainsManifest) =>
  Date.parse(manifest.hardExpireAt) <= Date.now();

const isManifestStale = (manifest: DisposableDomainsManifest) =>
  Date.parse(manifest.refreshAfter) <= Date.now();

const fetchSourceText = async (manifest: DisposableDomainsManifest | null) => {
  const response = await fetch(SOURCE_URL, {
    headers: manifest?.sourceEtag
      ? {
          "if-none-match": manifest.sourceEtag,
        }
      : undefined,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Disposable domain source attempted redirect");
  }

  if (response.status === 304) {
    return {
      status: 304 as const,
      etag: manifest?.sourceEtag ?? null,
      rawText: null,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to refresh disposable domains: ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
    throw new Error("Disposable domain source exceeded maximum size");
  }

  const rawText = await response.text();
  return {
    status: 200 as const,
    etag: response.headers.get("etag"),
    rawText,
  };
};

const writeManifest = async (
  env: CloudflareBindings,
  manifest: DisposableDomainsManifest
) => {
  await env.SUM_KV.put(MANIFEST_KEY, JSON.stringify(manifest), {
    expirationTtl: STORAGE_TTL_SECONDS,
  });
  manifestCache = {
    value: manifest,
    loadedAtMs: Date.now(),
  };
};

const acquireRefreshLock = async (env: CloudflareBindings) => {
  const existing = await env.SUM_KV.get(LOCK_KEY);
  if (existing) return false;

  await env.SUM_KV.put(LOCK_KEY, nowIso(), {
    expirationTtl: REFRESH_LOCK_TTL_SECONDS,
  });
  return true;
};

const releaseRefreshLock = async (env: CloudflareBindings) => {
  await env.SUM_KV.delete(LOCK_KEY);
};

const refreshWithManifest = async (
  env: CloudflareBindings,
  currentManifest: DisposableDomainsManifest | null
) => {
  const source = await fetchSourceText(currentManifest);
  const nowMs = Date.now();

  if (source.status === 304 && currentManifest) {
    const refreshedManifest: DisposableDomainsManifest = {
      ...currentManifest,
      fetchedAt: new Date(nowMs).toISOString(),
      refreshAfter: plusMs(nowMs, REFRESH_AFTER_MS),
      hardExpireAt: plusMs(nowMs, HARD_EXPIRE_AFTER_MS),
    };
    await writeManifest(env, refreshedManifest);
    return refreshedManifest;
  }

  if (!source.rawText) {
    return currentManifest;
  }

  const domains = parseDomainLines(source.rawText);
  const shards = buildShardMap(domains);
  const nextSlot = currentManifest?.activeSlot === "a" ? "b" : "a";
  const sourceSha256 = await hashText(source.rawText);

  const writes: Promise<void>[] = [
    env.SUM_KV.put(getRawKey(nextSlot), source.rawText, {
      expirationTtl: STORAGE_TTL_SECONDS,
    }),
  ];

  for (const [shardPrefix, shardDomains] of shards) {
    writes.push(
      env.SUM_KV.put(
        getShardKey(nextSlot, shardPrefix),
        shardDomains.join("\n"),
        {
          expirationTtl: STORAGE_TTL_SECONDS,
        }
      )
    );
  }

  await Promise.all(writes);

  const manifest: DisposableDomainsManifest = {
    activeSlot: nextSlot,
    fetchedAt: new Date(nowMs).toISOString(),
    refreshAfter: plusMs(nowMs, REFRESH_AFTER_MS),
    hardExpireAt: plusMs(nowMs, HARD_EXPIRE_AFTER_MS),
    sourceUrl: SOURCE_URL,
    sourceEtag: source.etag,
    sourceSha256,
    shardPrefixes: Array.from(shards.keys()).sort(),
    shardPrefixLength: SHARD_PREFIX_LENGTH,
    domainCount: domains.length,
  };

  await writeManifest(env, manifest);
  return manifest;
};

export const refreshDisposableEmailDomains = async (
  env: CloudflareBindings,
  options?: RefreshOptions
) => {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    let acquired = false;

    try {
      const currentManifest = await readManifest(env, {
        bypassCache: options?.force,
      });

      acquired = await acquireRefreshLock(env);
      if (!acquired) {
        return readManifest(env, { bypassCache: true });
      }

      return await refreshWithManifest(env, currentManifest);
    } finally {
      if (acquired) {
        await releaseRefreshLock(env);
      }
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
};

const loadShard = async (
  env: CloudflareBindings,
  manifest: DisposableDomainsManifest,
  shardPrefix: string
) => {
  const cacheKey = `${manifest.activeSlot}:${shardPrefix}`;
  const cached = shardCache.get(cacheKey);
  if (cached) return cached;

  const shard = parseShard(
    await env.SUM_KV.get(getShardKey(manifest.activeSlot, shardPrefix))
  );
  if (!shard) return null;

  shardCache.set(cacheKey, shard);
  return shard;
};

const scheduleRefresh = (
  env: CloudflareBindings,
  runInBackground?: (promise: Promise<unknown>) => void
) => {
  const promise = refreshDisposableEmailDomains(env).catch(error => {
    console.error("[auth] Failed to refresh disposable domain cache", {
      error,
    });
  });

  if (runInBackground) {
    runInBackground(promise);
    return;
  }

  void promise;
};

export const isDisposableEmailDomain = async (
  domain: string,
  env?: CloudflareBindings,
  options?: DomainLookupOptions
) => {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return false;
  if (env && getAllowedDomains(env).includes(normalizedDomain)) return false;
  if (!env?.SUM_KV) return false;

  let manifest = await readManifest(env);
  if (!manifest || isManifestExpired(manifest)) {
    manifest = await refreshDisposableEmailDomains(env, { force: true });
    if (!manifest) {
      return false;
    }
  } else if (isManifestStale(manifest)) {
    scheduleRefresh(env, options?.runInBackground);
  }

  const shardPrefix = getShardPrefix(normalizedDomain);
  if (!manifest.shardPrefixes.includes(shardPrefix)) {
    return false;
  }

  const shard = await loadShard(env, manifest, shardPrefix);
  if (!shard) {
    scheduleRefresh(env, options?.runInBackground);
    return false;
  }

  return shard.has(normalizedDomain);
};

export type EmailQualification =
  | { ok: true; normalizedEmail: string }
  | { ok: false; reason: "invalid" | "disposable" };

export const qualifyEmailAddress = async (
  value: string,
  env?: CloudflareBindings,
  options?: DomainLookupOptions
): Promise<EmailQualification> => {
  const normalizedEmail = normalizeEmailAddress(value);
  if (!normalizedEmail) {
    return { ok: false, reason: "invalid" };
  }

  const domain = getEmailDomain(normalizedEmail);
  if (!domain) {
    return { ok: false, reason: "invalid" };
  }

  if (await isDisposableEmailDomain(domain, env, options)) {
    return { ok: false, reason: "disposable" };
  }

  return { ok: true, normalizedEmail };
};
