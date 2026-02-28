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
    <figure className="docs-code-block relative overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[0_26px_68px_-44px_rgba(0,0,0,0.96)]">
      <figcaption className="flex min-h-14 items-center justify-between border-b border-white/10 bg-black/95 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center border border-white/20 bg-white/10 px-1.5 font-mono text-[13px] font-semibold uppercase tracking-tight text-white/90">
            {code.language.slice(0, 2)}
          </span>
          <span className="truncate text-[13px] font-medium tracking-tight text-white/85">
            {code.title}
          </span>
        </div>

        <button
          type="button"
          className={cn(
            "rounded-md border border-white/15 px-2 py-1 text-[11px] transition-colors",
            copied
              ? "bg-white/12 text-white"
              : "bg-black/80 text-white/70 hover:border-white/25 hover:text-white"
          )}
          onClick={handleCopy}
          aria-label={`Copy ${code.title} snippet`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>

      <pre className="overflow-x-auto py-4 font-mono text-[14px] leading-7 text-white/92 [tab-size:2]">
        {renderedCode ? (
          renderedCode
        ) : (
          <code className="block min-w-max px-4">{code.code}</code>
        )}
      </pre>
    </figure>
  );
}
