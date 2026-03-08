import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { getAdjacentDocPages } from "./content/docs-content";
import { expandApiEndpointReferencesInMarkdown } from "./content/api-reference-markdown";
import { docsMdxComponents } from "./docs-mdx-components";
import type { ComponentType } from "react";
import type { DocPage } from "./content/docs-content";
import { Button } from "@/components/ui/button";

export function DocsContentRenderer({ page }: { page: DocPage }) {
  const adjacent = getAdjacentDocPages(page.slug);
  const Content = page.Content;
  const [copied, setCopied] = useState(false);
  const mdxComponents = docsMdxComponents as unknown as Record<
    string,
    ComponentType<Record<string, unknown>>
  >;

  const onCopyMarkdown = async () => {
    try {
      const body = expandApiEndpointReferencesInMarkdown(page.markdown).trim();
      const md = [
        `# SpinupMail Docs: ${page.title}`,
        page.description,
        body,
      ].join("\n\n");
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="docs-article mx-auto w-full max-w-4xl px-4 pb-18 pt-8 sm:px-10 lg:px-12 lg:pt-12">
      <header className="border-b border-border/60 pb-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {page.groupId.replace("-", " ")}
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight">
          {page.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {page.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={() => void onCopyMarkdown()}
          >
            <HugeiconsIcon
              icon={Copy01Icon}
              className="size-3.5 text-foreground/85"
              strokeWidth={1.8}
            />
            {copied ? "Copied!" : "Copy Markdown"}
          </Button>
        </div>
      </header>

      <div className="docs-mdx mt-10 space-y-6">
        <Content components={mdxComponents} />
      </div>

      <footer className="mt-14 grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
        <DocPagerCard
          direction="Previous"
          slug={adjacent.previous?.slug}
          title={adjacent.previous?.title ?? "Documentation overview"}
        />
        <DocPagerCard
          direction="Next"
          slug={adjacent.next?.slug}
          title={adjacent.next?.title ?? "Documentation overview"}
        />
      </footer>
    </article>
  );
}

function DocPagerCard({
  direction,
  slug,
  title,
}: {
  direction: string;
  slug?: string;
  title: string;
}) {
  const className =
    "group block border border-border/70 bg-card/45 px-4 py-3 transition-colors hover:border-border/90 hover:bg-card";

  if (slug) {
    return (
      <Link to="/docs/$slug" params={{ slug }} className={className}>
        <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
          {direction}
        </p>
        <p className="mt-1 text-[15px] font-medium text-foreground group-hover:text-foreground/95">
          {title}
        </p>
      </Link>
    );
  }

  return (
    <Link to="/docs" className={className}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
        {direction}
      </p>
      <p className="mt-1 text-[15px] font-medium text-foreground group-hover:text-foreground/95">
        {title}
      </p>
    </Link>
  );
}
