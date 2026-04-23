import { useMemo, type ComponentProps, type ReactNode } from "react";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLocation, useNavigate } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type HashTabSection = {
  id: string;
  label: string;
  icon?: IconSvgElement;
  content: ReactNode;
  contentClassName?: string;
};

type HashTabsPageProps = {
  sections: HashTabSection[];
  ariaLabel: string;
  defaultSection: string;
  className?: string;
  listClassName?: string;
} & Omit<ComponentProps<typeof Tabs>, "children" | "value" | "onValueChange">;

const getActiveHashSection = ({
  hash,
  defaultSection,
  sectionIds,
}: {
  hash: string;
  defaultSection: string;
  sectionIds: Set<string>;
}) => {
  const sectionId = hash.startsWith("#") ? hash.slice(1) : hash;
  return sectionIds.has(sectionId) ? sectionId : defaultSection;
};

export const HashTabsPage = ({
  sections,
  ariaLabel,
  defaultSection,
  className,
  listClassName,
  ...tabsProps
}: HashTabsPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const sectionIds = useMemo(
    () => new Set(sections.map(section => section.id)),
    [sections]
  );
  const activeSection = getActiveHashSection({
    hash: location.hash,
    defaultSection,
    sectionIds,
  });

  return (
    <Tabs
      className={cn(
        "flex w-full flex-col gap-6 [&_button]:cursor-pointer",
        className
      )}
      value={activeSection}
      onValueChange={value => {
        const nextSection = getActiveHashSection({
          hash: String(value),
          defaultSection,
          sectionIds,
        });
        const nextHash = `#${nextSection}`;

        if (location.hash === nextHash) return;

        void navigate(
          {
            pathname: location.pathname,
            hash: nextHash,
          },
          { replace: true }
        );
      }}
      {...tabsProps}
    >
      <div>
        <TabsList
          aria-label={ariaLabel}
          variant="line"
          className={cn(
            "min-w-max gap-6 border-b border-border/70 p-0",
            listClassName
          )}
        >
          {sections.map(section => (
            <TabsTrigger key={section.id} value={section.id}>
              {section.icon ? (
                <HugeiconsIcon
                  data-icon="inline-start"
                  icon={section.icon}
                  strokeWidth={2}
                />
              ) : null}
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {sections.map(section => (
        <TabsContent
          key={section.id}
          data-section-id={section.id}
          value={section.id}
          className={cn(
            "min-w-0 scroll-mt-24 md:scroll-mt-28",
            section.contentClassName
          )}
        >
          {section.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};
