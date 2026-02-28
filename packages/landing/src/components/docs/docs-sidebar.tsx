import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ComputerIcon,
  DatabaseIcon,
  LayoutIcon,
  Search01Icon,
  ShieldIcon,
} from "@hugeicons/core-free-icons";
import { docsNavGroups } from "./content/docs-nav";
import { getDocPageBySlug } from "./content/docs-content";
import { cn } from "@/lib/utils";

type DocsSidebarProps = {
  currentSlug?: string;
  className?: string;
  onNavigate?: () => void;
  onOpenSearch?: () => void;
};

const groupIconById = {
  "get-started": ArrowRight01Icon,
  configuration: ShieldIcon,
  "api-data": DatabaseIcon,
  operations: ComputerIcon,
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
  const defaultOpen = useMemo(
    () => initialOpenState(currentSlug),
    [currentSlug]
  );
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(defaultOpen);

  useEffect(() => {
    setOpenGroups(defaultOpen);
  }, [defaultOpen]);

  return (
    <aside className={cn("docs-sidebar flex h-full flex-col", className)}>
      <div className="border-b border-border/60 px-4 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <HugeiconsIcon
            icon={LayoutIcon}
            className="size-4 text-foreground/80"
            strokeWidth={1.8}
          />
          Docs
        </h2>
        <button
          type="button"
          onClick={onOpenSearch}
          className="mt-3 inline-flex w-full items-center gap-2 border border-border/70 bg-card/35 px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-border/90 hover:text-foreground"
        >
          <HugeiconsIcon
            icon={Search01Icon}
            className="size-3.5 text-muted-foreground"
            strokeWidth={1.8}
          />
          <span className="flex-1">Search documentation...</span>
          <kbd className="border border-border/70 bg-background px-1 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav
        aria-label="Documentation navigation"
        className="flex-1 overflow-y-auto px-0 py-3"
      >
        <Link
          to="/docs"
          onClick={onNavigate}
          className={cn(
            "mx-2 flex items-center gap-2 border px-3 py-2 text-[14px] font-medium tracking-tight transition-colors",
            !currentSlug
              ? "border-border/80 bg-card/60 text-foreground"
              : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card/30 hover:text-foreground"
          )}
        >
          <HugeiconsIcon
            icon={LayoutIcon}
            className="size-4 text-foreground/70"
            strokeWidth={1.8}
          />
          Overview
        </Link>

        <div className="mt-3 border-y border-border/60">
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
                    className="mt-0.5 size-4 text-foreground/65"
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
                <ul className="border-t border-border/50 px-1.5 py-2.5">
                  {group.slugs.map(slug => {
                    const page = getDocPageBySlug(slug);
                    if (!page) return null;

                    const isActive = slug === currentSlug;

                    return (
                      <li key={slug}>
                        <Link
                          to="/docs/$slug"
                          params={{ slug }}
                          onClick={onNavigate}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "block border-l-2 px-2.5 py-1.5 text-[13px] leading-relaxed transition-colors",
                            isActive
                              ? "border-foreground bg-foreground/[0.08] text-foreground"
                              : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-foreground/[0.04] hover:text-foreground"
                          )}
                        >
                          {page.title}
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
