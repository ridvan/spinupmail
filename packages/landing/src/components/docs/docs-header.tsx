import { Link } from "@tanstack/react-router";
import { landingLinks } from "@/lib/links";
import { cn } from "@/lib/utils";

type DocsHeaderProps = {
  currentSlug?: string;
  onOpenSearch: () => void;
  onToggleMobileSidebar: () => void;
};

export function DocsHeader({
  currentSlug,
  onOpenSearch,
  onToggleMobileSidebar,
}: DocsHeaderProps) {
  return (
    <header className="docs-header fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1720px] items-center gap-2 px-3 sm:px-5">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="inline-flex size-8 items-center justify-center border border-border/70 bg-card/60 text-sm text-muted-foreground lg:hidden"
          aria-label="Open documentation navigation"
        >
          ≡
        </button>

        <Link to="/" className="inline-flex items-center gap-2 pr-2">
          <img
            src="/logo-transparent.png"
            alt="Spinupmail"
            className="size-7 object-contain"
          />
          <span className="text-base font-semibold tracking-tight">
            Spinupmail
          </span>
          <span className="hidden border border-border/70 bg-card/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:inline-flex">
            Docs
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          <Link
            to="/docs"
            className={cn(
              "border px-2.5 py-1 text-[12px] transition-colors",
              !currentSlug
                ? "border-border/80 bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground"
            )}
          >
            docs
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "email-addresses" }}
            className={cn(
              "border px-2.5 py-1 text-[12px] transition-colors",
              currentSlug === "email-addresses" || currentSlug === "emails"
                ? "border-border/80 bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground"
            )}
          >
            api
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "deploy-routing" }}
            className={cn(
              "border px-2.5 py-1 text-[12px] transition-colors",
              currentSlug === "deploy-routing"
                ? "border-border/80 bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:text-foreground"
            )}
          >
            deploy
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-2 border border-border/70 bg-card/70 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-border/90 hover:text-foreground"
          >
            Search
            <kbd className="border border-border/70 bg-background px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>

          <a
            href={landingLinks.github}
            target="_blank"
            rel="noreferrer"
            className="hidden border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            GitHub
          </a>
          <a
            href={landingLinks.app}
            target="_blank"
            rel="noreferrer"
            className="hidden border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground sm:inline-flex"
          >
            Dashboard
          </a>
        </div>
      </div>
    </header>
  );
}
