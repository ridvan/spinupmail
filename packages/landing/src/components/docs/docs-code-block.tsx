import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocsCodeExample = {
  id: string;
  language: string;
  title: string;
  code: string;
};

const COPY_RESET_MS = 1200;

export function DocsCodeBlock({
  code,
  onCopy,
  renderedCode,
}: {
  code: DocsCodeExample;
  onCopy?: () => void;
  renderedCode?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      onCopy?.();
      window.setTimeout(() => setCopied(false), COPY_RESET_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="docs-code-block docs-code-shell relative overflow-hidden rounded-2xl">
      <figcaption className="docs-code-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="docs-code-language-badge">
            {code.language.slice(0, 2)}
          </span>
          <span className="docs-code-title">{code.title}</span>
        </div>

        <button
          type="button"
          className={cn(
            "docs-code-copy-button",
            copied && "docs-code-copy-button-copied"
          )}
          onClick={handleCopy}
          aria-label={`Copy ${code.title} snippet`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>

      <pre className="docs-code-pre overflow-x-auto [tab-size:2]">
        {renderedCode ? (
          renderedCode
        ) : (
          <code className="block min-w-max px-4">{code.code}</code>
        )}
      </pre>
    </figure>
  );
}
