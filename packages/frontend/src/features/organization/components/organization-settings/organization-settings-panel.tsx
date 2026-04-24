import type { ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

type OrganizationSettingsPanelProps = {
  title?: string;
  icon?: IconSvgElement;
  badge?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export const OrganizationSettingsPanel = ({
  title,
  icon,
  badge,
  description,
  children,
  className,
  contentClassName,
}: OrganizationSettingsPanelProps) => (
  <div
    className={cn(
      "rounded-lg border border-border/70 bg-background/25 p-4 sm:p-5",
      className
    )}
  >
    {title || description || badge ? (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {title ? (
            <div className="flex items-center gap-2">
              {icon ? (
                <HugeiconsIcon
                  icon={icon}
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              <h2 className="text-[15px] font-medium leading-tight">{title}</h2>
            </div>
          ) : null}
          {description ? (
            <div className="text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    ) : null}

    <div
      className={cn(
        title || description || badge ? "mt-4" : null,
        contentClassName
      )}
    >
      {children}
    </div>
  </div>
);
