import { Link, createFileRoute } from "@tanstack/react-router";
import { docsNavGroups } from "@/components/docs/content/docs-nav";
import { getDocPageBySlug } from "@/components/docs/content/docs-content";

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
});

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
          Deployment, API, and operations guidance for running disposable email
          workflows on Cloudflare with organization-safe access controls.
        </p>
      </header>

      <section className="mt-10 space-y-6">
        {docsNavGroups.map(group => (
          <section
            key={group.id}
            className="border border-border/70 bg-card/45 p-4 sm:p-5"
          >
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {group.title}
            </h2>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {group.description}
            </p>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {group.slugs.map(slug => {
                const page = getDocPageBySlug(slug);
                if (!page) return null;

                return (
                  <li key={slug}>
                    <Link
                      to="/docs/$slug"
                      params={{ slug }}
                      className="block border border-border/60 bg-background/65 p-3 transition-colors hover:border-border/90 hover:bg-card"
                    >
                      <p className="text-[15px] font-medium text-foreground">
                        {page.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                        {page.summary}
                      </p>
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
