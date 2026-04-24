import {
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
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
  forcedSection?: string;
  className?: string;
  tabsHeaderClassName?: string;
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
  forcedSection,
  className,
  tabsHeaderClassName,
  listClassName,
  ...tabsProps
}: HashTabsPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const sectionIds = useMemo(
    () => new Set(sections.map(section => section.id)),
    [sections]
  );
  const hashSection = getActiveHashSection({
    hash: location.hash,
    defaultSection,
    sectionIds,
  });
  const activeSection =
    forcedSection && sectionIds.has(forcedSection)
      ? forcedSection
      : hashSection;

  useLayoutEffect(() => {
    const activeTab = tabsScrollerRef.current?.querySelector<HTMLElement>(
      `[data-section-tab="${activeSection}"]`
    );

    activeTab?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeSection]);

  return (
    <Tabs
      className={cn(
        "flex w-full flex-col gap-6 [&_button]:cursor-pointer",
        className
      )}
      value={activeSection}
      onValueChange={value => {
        if (forcedSection && sectionIds.has(forcedSection)) return;

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
      <div
        className={cn(
          "min-w-0 max-w-full overflow-hidden border-b border-border/70",
          tabsHeaderClassName
        )}
      >
        <div
          ref={tabsScrollerRef}
          className="max-w-full overflow-x-auto overflow-y-hidden [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-border/80"
        >
          <TabsList
            aria-label={ariaLabel}
            variant="line"
            className={cn("min-w-max gap-6 p-0", listClassName)}
          >
            {sections.map(section => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                data-section-tab={section.id}
              >
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
