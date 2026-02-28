import { Link, createFileRoute } from "@tanstack/react-router";
import { DocsContentRenderer } from "@/components/docs/docs-content-renderer";
import { getDocPageBySlug } from "@/components/docs/content/docs-content";

export const Route = createFileRoute("/docs/$slug")({
  head: ({ params }) => {
    const page = getDocPageBySlug(params.slug);

    if (!page) {
      return {
        meta: [
          { title: "Doc Not Found | Spinupmail" },
          {
            name: "description",
            content: "The requested documentation page does not exist.",
          },
        ],
      };
    }

    return {
      meta: [
        { title: `${page.title} | Spinupmail Docs` },
        {
          name: "description",
          content: page.description,
        },
      ],
    };
  },
  component: DocsSlugPage,
});

function DocsSlugPage() {
  const { slug } = Route.useParams();

  return <DocsSlugPageContent slug={slug} />;
}

export function DocsSlugPageContent({ slug }: { slug: string }) {
  const page = getDocPageBySlug(slug);

  if (!page) {
    return (
      <article className="mx-auto w-full max-w-3xl px-4 pb-18 pt-8 sm:px-8 lg:px-10 lg:pt-10">
        <div className="border border-border/70 bg-card/40 p-6">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70">
            404
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Doc page not found
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The page <code className="font-mono">/docs/{slug}</code> does not
            exist.
          </p>
          <Link
            to="/docs"
            className="mt-4 inline-flex border border-border/70 bg-background px-3 py-1.5 text-xs text-foreground"
          >
            Return to docs overview
          </Link>
        </div>
      </article>
    );
  }

  return <DocsContentRenderer page={page} />;
}
