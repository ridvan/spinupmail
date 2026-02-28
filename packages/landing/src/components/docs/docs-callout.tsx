import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocsCalloutTone = "info" | "warning" | "success";

const toneClassName: Record<DocsCalloutTone, string> = {
  info: "border-blue-400/45 bg-blue-400/8 text-foreground",
  warning: "border-amber-400/45 bg-amber-400/10 text-foreground",
  success: "border-emerald-400/45 bg-emerald-400/10 text-foreground",
};

const toneIcon: Record<DocsCalloutTone, string> = {
  info: "i",
  warning: "!",
  success: "✓",
};

export function DocsCallout({
  tone,
  title,
  children,
}: {
  tone: DocsCalloutTone;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "docs-callout rounded-none border px-4 py-3",
        toneClassName[tone]
      )}
      role="note"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-5 shrink-0 items-center justify-center border border-current/40 text-[11px] font-semibold">
          {toneIcon[tone]}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">
            {title}
          </p>
          <div className="mt-1 text-[15px] leading-relaxed text-foreground/90">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}
