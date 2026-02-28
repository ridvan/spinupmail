import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { docsNavGroups } from "./content/docs-nav";
import { getDocPageBySlug } from "./content/docs-content";
import { cn } from "@/lib/utils";

type DocsSidebarProps = {
  currentSlug?: string;
  className?: string;
  onNavigate?: () => void;
};

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
      <div className="border-b border-border/60 bg-linear-to-b from-card/65 to-card/35 px-4 py-5">
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
          Documentation
        </p>
        <h2 className="mt-2 text-base font-semibold tracking-tight text-foreground">
          Spinupmail Docs
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Setup, API references, and production operations.
        </p>
        <Link
          to="/docs/$slug"
          params={{ slug: "quickstart" }}
          onClick={onNavigate}
          className="mt-3 inline-flex border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card"
        >
          Start with Quickstart
        </Link>
      </div>

      <nav
        aria-label="Documentation navigation"
        className="flex-1 overflow-y-auto px-2 py-4"
      >
        <Link
          to="/docs"
          onClick={onNavigate}
          className={cn(
            "block border px-3 py-2.5 text-[14px] font-medium tracking-tight transition-colors",
            !currentSlug
              ? "border-border/80 bg-card text-foreground shadow-[inset_3px_0_0_0_rgba(255,255,255,0.5)]"
              : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card/50 hover:text-foreground"
          )}
        >
          Overview
        </Link>

        <div className="mt-4 space-y-2.5">
          {docsNavGroups.map(group => (
            <section
              key={group.id}
              className="border border-border/55 bg-card/30"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                onClick={() => {
                  setOpenGroups(prev => ({
                    ...prev,
                    [group.id]: !prev[group.id],
                  }));
                }}
                aria-expanded={Boolean(openGroups[group.id])}
              >
                <span>
                  <span className="block text-[13px] font-semibold text-foreground/95">
                    {group.title}
                  </span>
                  <span className="block pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {group.description}
                  </span>
                </span>
                <span className="text-xs font-medium text-muted-foreground/80">
                  {openGroups[group.id] ? "−" : "+"}
                </span>
              </button>

              {openGroups[group.id] ? (
                <ul className="border-t border-border/50 px-1.5 py-2">
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
                              : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-foreground/[0.04] hover:text-foreground"
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
