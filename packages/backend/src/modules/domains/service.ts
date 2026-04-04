import { getAllowedDomains, getForcedMailPrefix } from "@/shared/env";

export const getDomainsResponse = (env: CloudflareBindings) => {
  const allowed = getAllowedDomains(env);
  if (allowed.length === 0) {
    return {
      status: 500 as const,
      body: { error: "No email domains configured" },
    };
  }

  return {
    status: 200 as const,
    body: {
      items: allowed,
      default: allowed[0] ?? null,
      forcedLocalPartPrefix: getForcedMailPrefix(env) ?? null,
    },
  };
};
