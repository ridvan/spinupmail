import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AddressBookIcon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  BookOpen01Icon,
  ComputerIcon,
  DatabaseIcon,
  LayoutIcon,
  Mail01Icon,
  Mailbox01Icon,
  Rocket01Icon,
  Search01Icon,
  ShieldIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { docsNavGroups } from "./content/docs-nav";
import { getDocPageBySlug } from "./content/docs-content";
import { CloudflareCloudIcon } from "@/components/icons/cloudflare-cloud-icon";
import { cn } from "@/lib/utils";

type DocsSidebarProps = {
  currentSlug?: string;
  className?: string;
  onNavigate?: () => void;
  onOpenSearch?: () => void;
};

const groupIconById = {
  "get-started": Rocket01Icon,
  "api-reference": DatabaseIcon,
  configuration: ShieldIcon,
  operations: Mail01Icon,
} as const;

const pageIconBySlug = {
  quickstart: Rocket01Icon,
  "api-overview": BookOpen01Icon,
  "api-domains": DatabaseIcon,
  "api-organizations": UserMultiple02Icon,
  "api-email-addresses": AddressBookIcon,
  "api-emails": Mailbox01Icon,
  "auth-secrets": ShieldIcon,
  "deploy-routing": ArrowUpRight01Icon,
  "inbound-pipeline": Mail01Icon,
  "multi-domain": LayoutIcon,
  "local-development": ComputerIcon,
  "limits-security": Alert02Icon,
} as const;

function initialOpenState(currentSlug?: string): Record<string, boolean> {
  return Object.fromEntries(
    docsNavGroups.map(group => [
      group.id,
      currentSlug
        ? group.slugs.includes(currentSlug)
        : group.id === "get-started",
    ])
  );
}

export function DocsSidebar({
  currentSlug,
  className,
  onNavigate,
  onOpenSearch,
}: DocsSidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    initialOpenState(currentSlug)
  );

  useEffect(() => {
    if (!currentSlug) {
      return;
    }

    const activeGroup = docsNavGroups.find(group =>
      group.slugs.includes(currentSlug)
    );
    if (!activeGroup) {
      return;
    }

    setOpenGroups(prev =>
      prev[activeGroup.id] ? prev : { ...prev, [activeGroup.id]: true }
    );
  }, [currentSlug]);

  return (
    <aside className={cn("docs-sidebar flex h-full flex-col", className)}>
      <div className="border-b border-border/60">
        <button
          type="button"
          onClick={onOpenSearch}
          className="inline-flex h-full w-full items-center gap-2 px-4 py-4 text-left text-[12px] text-muted-foreground transition-colors hover:bg-card/55 hover:text-foreground focus-visible:outline-0"
        >
          <HugeiconsIcon
            icon={Search01Icon}
            className="size-3.5 text-muted-foreground"
            strokeWidth={1.8}
          />
          <span className="flex-1">Search documentation...</span>
          <div className="flex items-center gap-1">
            <kbd className="border border-border/70 bg-background px-1 font-mono text-[10px] text-muted-foreground">
              ⌘
            </kbd>
            <kbd className="border border-border/70 bg-background px-1 font-mono text-[10px] text-muted-foreground">
              K
            </kbd>
          </div>
        </button>
      </div>

      <nav
        aria-label="Documentation navigation"
        className={cn(
          "flex-1 overflow-y-auto",
          !currentSlug
            ? "[&>.docs-overview-link]:bg-card/60 [&>.docs-overview-link]:text-foreground"
            : "[&>.docs-overview-link]:text-muted-foreground [&>.docs-overview-link]:hover:bg-card/30 [&>.docs-overview-link]:hover:text-foreground"
        )}
      >
        <Link
          to="/docs"
          onClick={onNavigate}
          className="docs-overview-link flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-medium tracking-tight transition-colors"
        >
          <HugeiconsIcon
            icon={LayoutIcon}
            className="size-4 text-foreground/70"
            strokeWidth={1.8}
          />
          Overview
        </Link>

        <div className="border-y border-border/60">
          {docsNavGroups.map(group => (
            <section
              key={group.id}
              className="border-b border-border/50 last:border-b-0"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-card/25"
                onClick={() => {
                  setOpenGroups(prev => ({
                    ...prev,
                    [group.id]: !prev[group.id],
                  }));
                }}
                aria-expanded={Boolean(openGroups[group.id])}
              >
                <span className="flex items-start gap-2.5">
                  <HugeiconsIcon
                    icon={groupIconById[group.id]}
                    className="mt-1 size-4 shrink-0 text-foreground/65"
                    strokeWidth={1.8}
                  />
                  <span>
                    <span className="block text-[15px] font-medium text-foreground/95">
                      {group.title}
                    </span>
                    <span className="block pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {group.description}
                    </span>
                  </span>
                </span>
                <HugeiconsIcon
                  icon={openGroups[group.id] ? ArrowUp01Icon : ArrowDown01Icon}
                  className="size-4 text-muted-foreground/80"
                  strokeWidth={1.8}
                />
              </button>

              {openGroups[group.id] ? (
                <ul className="pb-2.5 pl-9 pr-3 pt-1">
                  {group.slugs.map(slug => {
                    const page = getDocPageBySlug(slug);
                    if (!page) return null;

                    const isActive = slug === currentSlug;
                    const isCloudflareResources =
                      slug === "cloudflare-resources";
                    const pageIcon =
                      pageIconBySlug[slug as keyof typeof pageIconBySlug];

                    return (
                      <li key={slug}>
                        <Link
                          to="/docs/$slug"
                          params={{ slug }}
                          onClick={onNavigate}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2 border-l-2 py-1.5 pl-3 pr-2.5 text-[13px] leading-relaxed transition-colors",
                            isActive
                              ? "border-foreground bg-foreground/8 text-foreground"
                              : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-foreground/4 hover:text-foreground"
                          )}
                        >
                          {isCloudflareResources ? (
                            <CloudflareCloudIcon className="h-2.5 shrink-0 text-current/75" />
                          ) : (
                            <HugeiconsIcon
                              icon={pageIcon}
                              className="size-3.5 shrink-0 text-current/75"
                              strokeWidth={1.8}
                            />
                          )}
                          <span>{page.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </nav>
    </aside>
  );
}
