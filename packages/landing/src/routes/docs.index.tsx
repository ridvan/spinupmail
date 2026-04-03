import { Link, createFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { docsNavGroups } from "@/components/docs/content/docs-nav";
import { getDocPageBySlug } from "@/components/docs/content/docs-content";
import { DocsPageIcon } from "@/components/docs/docs-icons";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
});

type DocsOverviewPatternStyle = CSSProperties & Record<`--${string}`, string>;

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function createDocsOverviewPatternStyle(
  slug: string
): DocsOverviewPatternStyle {
  const hash = hashString(slug);
  const gridSize = 22 + (hash % 5) * 2;
  const shift = 10 + ((hash >>> 3) % 11);
  const lineStrength = 6 + ((hash >>> 7) % 4);
  const opacity = 0.24 + ((hash >>> 10) % 10) * 0.012;
  const glowX = 72 + ((hash >>> 14) % 17);
  const glowY = 14 + ((hash >>> 18) % 18);
  const glowSize = 24 + ((hash >>> 22) % 13);

  return {
    "--docs-pattern-grid-size": `${gridSize}px`,
    "--docs-pattern-shift": `${shift}%`,
    "--docs-pattern-line-strength": `${lineStrength}%`,
    "--docs-pattern-opacity": opacity.toFixed(3),
    "--docs-pattern-glow-x": `${glowX}%`,
    "--docs-pattern-glow-y": `${glowY}%`,
    "--docs-pattern-glow-size": `${glowSize}%`,
  };
}

export function DocsIndexPage() {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 pb-18 pt-8 sm:px-10 lg:px-12 lg:pt-12">
      <header className="border-b border-border/60 pb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Overview
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight">
          Spinupmail Documentation
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          API reference, deployment guidance, and operational details for
          running disposable email workflows on Cloudflare with
          organization-safe access controls.
        </p>
      </header>

      <section className="mt-10 space-y-6">
        {docsNavGroups.map(group => (
          <section
            key={group.id}
            id={group.id}
            className="scroll-mt-28 rounded-xl border border-border/70 bg-card/45 p-4 sm:p-5"
          >
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {group.title}
            </h2>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {group.description}
            </p>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2 sm:auto-rows-[1fr]">
              {group.slugs.map(slug => {
                const page = getDocPageBySlug(slug);
                if (!page) return null;

                return (
                  <li key={slug} className="h-full">
                    <Link
                      to="/docs/$slug"
                      params={{ slug }}
                      className="docs-overview-pattern-card flex h-full min-h-30 rounded-lg border border-border/60 bg-background/65 p-3 transition-colors hover:border-border/90 hover:bg-card"
                      style={createDocsOverviewPatternStyle(slug)}
                    >
                      <div className="relative z-10 flex h-full items-center">
                        <div className="flex items-start gap-2.5">
                          <DocsPageIcon
                            slug={slug}
                            className="mt-0.75 size-4 shrink-0 text-foreground/72"
                          />
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium text-foreground">
                              {page.title}
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                              {page.summary}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>
    </article>
  );
}
