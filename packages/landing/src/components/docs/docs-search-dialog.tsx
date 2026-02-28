import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { searchDocs } from "./content/docs-search-index";

type DocsSearchDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DocsSearchDialog({ open, onClose }: DocsSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchDocs(query), [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[90] bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-18 w-full max-w-2xl border border-border/70 bg-background"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (results.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex(index => Math.min(results.length - 1, index + 1));
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(index => Math.max(0, index - 1));
          }

          if (event.key === "Enter") {
            event.preventDefault();
            navigateToResult(results[activeIndex].document.href);
          }
        }}
      >
        <div className="border-b border-border/70 p-3">
          <label htmlFor="docs-search" className="sr-only">
            Search documentation
          </label>
          <input
            id="docs-search"
            autoFocus
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search docs, endpoints, env vars..."
            className="w-full border border-border/70 bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <ul
          className="max-h-[60vh] overflow-y-auto p-2"
          aria-label="Search results"
        >
          {results.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">
              No results found.
            </li>
          ) : null}

          {results.map((result, index) => {
            const isActive = index === activeIndex;

            return (
              <li key={result.document.id}>
                <button
                  type="button"
                  className={`w-full border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-border bg-card"
                      : "border-transparent hover:border-border/70 hover:bg-card/60"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigateToResult(result.document.href)}
                >
                  <p className="text-sm font-medium text-foreground">
                    {result.document.title}
                  </p>
                  {result.document.heading ? (
                    <p className="mt-0.5 text-xs text-foreground/75">
                      {result.document.heading}
                    </p>
                  ) : null}
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {result.snippet}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">
                    {result.document.href}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
