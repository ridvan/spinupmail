import { isValidElement, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DocsCallout } from "./docs-callout";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type EndpointProps = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  children?: unknown;
};

const endpointTone: Record<EndpointProps["method"], string> = {
  GET: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  POST: "border-sky-400/35 bg-sky-400/12 text-sky-200",
  PATCH: "border-amber-400/35 bg-amber-400/12 text-amber-200",
  DELETE: "border-rose-400/35 bg-rose-400/12 text-rose-200",
};

function DocsEndpoint({ method, path, children }: EndpointProps) {
  return (
    <div className="border border-border/70 bg-card/75 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-none border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
            endpointTone[method]
          )}
        >
          {method}
        </span>
        <code className="text-[15px] text-foreground">{path}</code>
      </div>
      {children ? (
        <div className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function flattenNodeText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenNodeText).join("");
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: unknown; "data-line"?: string };
    const content = flattenNodeText(props.children);
    if (props["data-line"] !== undefined) {
      return `${content}\n`;
    }
    return content;
  }

  return "";
}

function inferSnippetTitle(language: string): string {
  const extensionByLanguage: Record<string, string> = {
    ts: "ts",
    tsx: "tsx",
    js: "js",
    jsx: "jsx",
    json: "json",
    bash: "sh",
    shell: "sh",
    sh: "sh",
    yaml: "yml",
    yml: "yml",
    toml: "toml",
  };

  const extension = extensionByLanguage[language] ?? language;
  return `snippet.${extension}`;
}

function DocsMdxPre({ className, children, ...props }: ComponentProps<"pre">) {
  const [copied, setCopied] = useState(false);
  const attrs = props as Record<string, unknown>;
  const language = String(attrs["data-language"] ?? "text");
  const snippetTitle = inferSnippetTitle(language);
  const rawCode = flattenNodeText(children).replace(/\n$/, "");

  const handleCopy = async () => {
    if (typeof window === "undefined" || !rawCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="docs-code-shell">
      <div className="docs-code-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center border border-white/20 bg-white/10 px-1.5 font-mono text-[12px] font-semibold uppercase tracking-tight text-white/90">
            {language.slice(0, 2)}
          </span>
          <span className="truncate text-[13px] font-medium tracking-tight text-white/85">
            {snippetTitle}
          </span>
        </div>

        <button
          type="button"
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] transition-colors",
            copied
              ? "border-white/25 bg-white/14 text-white"
              : "border-white/15 bg-black/80 text-white/70 hover:border-white/25 hover:text-white"
          )}
          onClick={() => void handleCopy()}
          aria-label={`Copy ${snippetTitle} snippet`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className={cn("docs-code-pre", className)} {...props}>
        {children}
      </pre>
    </div>
  );
}

function DocsInlineCode({
  className,
  children,
  ...props
}: ComponentProps<"code">) {
  const hasTokenChildren = Array.isArray(children) || isValidElement(children);
  const isBlockCode =
    hasTokenChildren ||
    className?.includes("language-") ||
    "data-language" in props ||
    "data-theme" in props;

  if (isBlockCode) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <code
      className="rounded-md border border-white/14 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-foreground"
      {...props}
    >
      {children}
    </code>
  );
}

function DocsLink({
  href = "",
  children,
}: {
  href?: string;
  children?: unknown;
}) {
  if (href.startsWith("/docs")) {
    const slug = href.replace("/docs/", "");

    if (href === "/docs" || href === "/docs/") {
      return (
        <Link
          to="/docs"
          className="underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {children}
        </Link>
      );
    }

    if (slug.includes("#")) {
      const [slugValue, hash] = slug.split("#");
      return (
        <Link
          to="/docs/$slug"
          params={{ slug: slugValue }}
          hash={hash}
          className="underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {children}
        </Link>
      );
    }

    return (
      <Link
        to="/docs/$slug"
        params={{ slug }}
        className="underline decoration-dotted underline-offset-4 hover:text-foreground"
      >
        {children}
      </Link>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link
        to={href}
        className="underline decoration-dotted underline-offset-4 hover:text-foreground"
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-dotted underline-offset-4 hover:text-foreground"
    >
      {children}
    </a>
  );
}

export const docsMdxComponents = {
  h2: props => (
    <h2
      className="scroll-mt-28 text-[1.85rem] font-semibold tracking-tight"
      {...props}
    />
  ),
  h3: props => (
    <h3
      className="scroll-mt-28 text-2xl font-semibold tracking-tight"
      {...props}
    />
  ),
  p: props => (
    <p className="text-[16px] leading-8 text-foreground/92" {...props} />
  ),
  ul: props => (
    <ul
      className="space-y-2.5 pl-6 text-[16px] leading-8 marker:text-foreground/60"
      {...props}
    />
  ),
  ol: props => (
    <ol
      className="space-y-2.5 pl-6 text-[16px] leading-8 marker:text-foreground/60"
      {...props}
    />
  ),
  li: props => <li {...props} />,
  figure: props => <figure className="my-6" {...props} />,
  a: DocsLink,
  pre: DocsMdxPre,
  code: DocsInlineCode,
  Callout: DocsCallout,
  Endpoint: DocsEndpoint,
};
