import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { landingLinks } from "@/lib/links";
import { cn } from "@/lib/utils";

type DocsHeaderProps = {
  currentSlug?: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
};

export function DocsHeader({
  currentSlug,
  isDark,
  onToggleTheme,
  onToggleMobileSidebar,
}: DocsHeaderProps) {
  return (
    <header className="docs-header fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background">
      <div className="flex h-14 w-full items-stretch">
        <div className="hidden w-[22vw] min-w-[17.5rem] items-center border-r border-border/70 px-4 lg:flex">
          <Link to="/" className="group inline-flex items-center gap-2 py-1.5">
            <img
              src="/logo-transparent.png"
              alt="Spinupmail"
              className="size-7 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">
              Spinupmail
            </span>
            <span className="ml-1 border border-border/70 bg-card/40 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Docs
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center gap-2 px-3 sm:px-4 lg:ml-auto lg:flex-none lg:px-0">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="inline-flex size-8 items-center justify-center border border-border/70 bg-card/40 text-sm text-muted-foreground lg:hidden"
            aria-label="Open documentation navigation"
          >
            ≡
          </button>

          <Link
            to="/"
            className="group inline-flex items-center gap-1 px-1 py-1.5 lg:hidden"
          >
            <img
              src="/logo-transparent.png"
              alt="Spinupmail"
              className="size-7 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">Docs</span>
          </Link>

          <div className="hidden h-full items-stretch lg:flex">
            <nav className="flex items-center">
              <Link
                to="/docs"
                className={cn(
                  "flex h-14 items-center border-x border-border/60 px-5 text-[12px] transition-colors",
                  !currentSlug
                    ? "bg-card/40 text-foreground"
                    : "text-muted-foreground hover:bg-card/25 hover:text-foreground"
                )}
              >
                docs
              </Link>
              <Link
                to="/docs/$slug"
                params={{ slug: "email-addresses" }}
                className={cn(
                  "flex h-14 items-center border-r border-border/60 px-5 text-[12px] transition-colors",
                  currentSlug === "email-addresses" || currentSlug === "emails"
                    ? "bg-card/40 text-foreground"
                    : "text-muted-foreground hover:bg-card/25 hover:text-foreground"
                )}
              >
                api
              </Link>
              <Link
                to="/docs/$slug"
                params={{ slug: "deploy-routing" }}
                className={cn(
                  "flex h-14 items-center border-r border-border/60 px-5 text-[12px] transition-colors",
                  currentSlug === "deploy-routing"
                    ? "bg-card/40 text-foreground"
                    : "text-muted-foreground hover:bg-card/25 hover:text-foreground"
                )}
              >
                deploy
              </Link>
            </nav>

            <div className="flex items-center">
              <a
                href={landingLinks.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 w-14 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-card/25 hover:text-foreground"
                aria-label="Open GitHub"
              >
                <HugeiconsIcon
                  icon={GithubIcon}
                  className="size-4"
                  strokeWidth={1.8}
                />
              </a>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex h-14 w-14 items-center justify-center border-l border-border/60 text-muted-foreground transition-colors hover:bg-card/25 hover:text-foreground"
                aria-label={
                  isDark ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                <HugeiconsIcon
                  icon={isDark ? Sun03Icon : Moon02Icon}
                  className="size-4"
                  strokeWidth={1.8}
                />
              </button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <a
              href={landingLinks.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center border border-border/70 text-muted-foreground transition-colors hover:bg-card/25 hover:text-foreground"
              aria-label="Open GitHub"
            >
              <HugeiconsIcon
                icon={GithubIcon}
                className="size-4"
                strokeWidth={1.8}
              />
            </a>

            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex size-8 items-center justify-center border border-border/70 text-muted-foreground transition-colors hover:bg-card/25 hover:text-foreground"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              <HugeiconsIcon
                icon={isDark ? Sun03Icon : Moon02Icon}
                className="size-4"
                strokeWidth={1.8}
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
