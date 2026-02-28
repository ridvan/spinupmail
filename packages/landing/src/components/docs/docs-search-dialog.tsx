import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddressBookIcon,
  Alert02Icon,
  ArrowUpRight01Icon,
  LayoutIcon,
  Mail01Icon,
  Mailbox01Icon,
  Rocket01Icon,
  Search01Icon,
  ShieldIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { docsNavGroups } from "./content/docs-nav";
import { searchDocs } from "./content/docs-search-index";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CloudflareCloudIcon } from "@/components/icons/cloudflare-cloud-icon";

type DocsSearchDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DocsSearchDialog({ open, onClose }: DocsSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchDocs(query), [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const navigateToResult = (resultHref: string) => {
    const [path, hash] = resultHref.split("#");

    if (path === "/docs") {
      void navigate({ to: "/docs", hash });
    } else {
      const slug = path.replace("/docs/", "");
      void navigate({ to: "/docs/$slug", params: { slug }, hash });
    }

    onClose();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
      title="Search documentation"
      description="Search docs, endpoints, and environment variables."
      className="max-w-[92vw] sm:max-w-[92vw] md:max-w-[84vw] lg:max-w-175 border border-border/70 bg-background shadow-2xl"
      showCloseButton={false}
    >
      <Command shouldFilter={false} className="bg-background">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search docs, endpoints, env vars..."
          aria-label="Search documentation"
          className="text-sm"
        />
        <CommandList className="max-h-[min(40vh,calc(100dvh-24rem))] p-2">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documentation" className="px-0">
            {results.slice(0, 18).map(result => (
              <CommandItem
                key={result.document.id}
                value={`${result.document.title} ${result.document.heading ?? ""} ${result.snippet}`}
                onSelect={() => navigateToResult(result.document.href)}
                className="items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm data-selected:border-border data-selected:bg-card/70"
              >
                <ResultIcon href={result.document.href} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-start gap-2">
                    <span className="line-clamp-2 wrap-break-word text-foreground">
                      {result.document.title}
                    </span>
                    <span className="hidden shrink-0 rounded-sm border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
                      {groupTitleForHref(result.document.href)}
                    </span>
                  </div>
                  {result.document.heading ? (
                    <span className="line-clamp-2 wrap-break-word text-[11px] text-foreground/75">
                      Section: {result.document.heading}
                    </span>
                  ) : null}
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    {readableSnippet(result.snippet)}
                  </span>
                  <span className="line-clamp-1 break-all pt-0.5 text-[10px] text-muted-foreground/80">
                    {displayHref(result.document.href)}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function ResultIcon({ href }: { href: string }) {
  const path = href.split("#")[0];
  const slug = path.replace("/docs/", "");

  if (slug === "cloudflare-resources") {
    return (
      <CloudflareCloudIcon className="mt-0.5 h-3 shrink-0 text-current/75" />
    );
  }

  const iconBySlug = {
    quickstart: Rocket01Icon,
    "auth-secrets": ShieldIcon,
    "deploy-routing": ArrowUpRight01Icon,
    "organizations-scope": UserMultiple02Icon,
    "email-addresses": AddressBookIcon,
    emails: Mailbox01Icon,
    "inbound-pipeline": Mail01Icon,
    "multi-domain": LayoutIcon,
    "limits-security": Alert02Icon,
  } as const;

  const icon =
    slug in iconBySlug
      ? iconBySlug[slug as keyof typeof iconBySlug]
      : Search01Icon;

  return (
    <HugeiconsIcon
      icon={icon}
      className="mt-0.5 size-3.5 shrink-0 text-current/75"
      strokeWidth={1.8}
    />
  );
}

function groupTitleForHref(href: string): string {
  const path = href.split("#")[0];
  if (path === "/docs") {
    return "Overview";
  }

  const slug = path.replace("/docs/", "");
  const group = docsNavGroups.find(item => item.slugs.includes(slug));
  return group?.title || "Documentation";
}

function displayHref(href: string): string {
  const [path, hash] = href.split("#");
  if (!hash) {
    return path;
  }

  return `${path} · ${hash.replace(/-/g, " ")}`;
}

function readableSnippet(snippet: string, maxChars = 120): string {
  const normalized = snippet.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace <= 0) {
    return `${sliced}...`;
  }

  return `${sliced.slice(0, lastSpace)}...`;
}
