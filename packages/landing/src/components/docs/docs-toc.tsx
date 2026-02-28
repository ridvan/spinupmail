import { useEffect, useState } from "react";
import type { DocHeading } from "./content/docs-content";
import { cn } from "@/lib/utils";

export function DocsToc({ headings }: { headings: Array<DocHeading> }) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(
    headings[0]?.id
  );

  useEffect(() => {
    if (!headings.length) {
      setActiveHeadingId(undefined);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setActiveHeadingId(headings[0]?.id);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActiveHeadingId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-22% 0px -68% 0px",
        threshold: [0, 1],
      }
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) {
    return (
      <aside className="docs-toc px-4 py-6">
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
          On this page
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          No headings for this page.
        </p>
      </aside>
    );
  }

  return (
    <aside className="docs-toc px-4 py-6">
      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
        On this page
      </p>

      <nav
        className="mt-3 border-l border-border/60 pl-3"
        aria-label="Table of contents"
      >
        <ul className="space-y-2">
          {headings.map(heading => (
            <li
              key={heading.id}
              className={heading.level === 3 ? "pl-3" : undefined}
            >
              <a
                href={heading.href}
                className={cn(
                  "block py-0.5 text-[13px] transition-colors",
                  heading.id === activeHeadingId
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {heading.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
