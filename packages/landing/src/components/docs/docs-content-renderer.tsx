import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { getAdjacentDocPages } from "./content/docs-content";
import { docsMdxComponents } from "./docs-mdx-components";
import type { DocPage } from "./content/docs-content";
import { landingLinks } from "@/lib/links";

export function DocsContentRenderer({ page }: { page: DocPage }) {
  const adjacent = getAdjacentDocPages(page.slug);
  const Content = page.Content;
  const [copied, setCopied] = useState(false);

  const onCopyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
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
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-[2.75rem]">
          {page.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {page.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onCopyLink()}
            className="inline-flex items-center gap-2 border border-border/70 bg-card/35 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card/55"
          >
            <HugeiconsIcon
              icon={Copy01Icon}
              className="size-3.5 text-foreground/85"
              strokeWidth={1.8}
            />
            {copied ? "Copied link" : "Copy link"}
          </button>
          <a
            href={landingLinks.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-border/70 bg-card/35 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card/55"
          >
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              className="size-3.5 text-foreground/85"
              strokeWidth={1.8}
            />
            Open GitHub
          </a>
        </div>
      </header>

      <div className="docs-mdx mt-10 space-y-6">
        <Content components={docsMdxComponents} />
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
