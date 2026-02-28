import { useEffect, useState } from "react";
import { DocsHeader } from "./docs-header";
import { DocsSearchDialog } from "./docs-search-dialog";
import { DocsSidebar } from "./docs-sidebar";
import { DocsToc } from "./docs-toc";
import type { DocHeading } from "./content/docs-content";
import type { ReactNode } from "react";

type DocsLayoutProps = {
  currentSlug?: string;
  headings: Array<DocHeading>;
  children: ReactNode;
};

export function DocsLayout({
  currentSlug,
  headings,
  children,
}: DocsLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [currentSlug]);

  return (
    <div className="docs-shell min-h-screen bg-background text-foreground">
      <DocsHeader
        currentSlug={currentSlug}
        onOpenSearch={() => setSearchOpen(true)}
        onToggleMobileSidebar={() => setMobileSidebarOpen(state => !state)}
      />

      <DocsSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="h-full w-[88vw] max-w-sm border-r border-border/70 bg-background"
            onClick={event => event.stopPropagation()}
          >
            <DocsSidebar
              currentSlug={currentSlug}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1720px] pt-14 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <div className="hidden lg:block">
          <div className="sticky top-14 h-[calc(100vh-56px)] border-r border-border/60 bg-background/35 backdrop-blur-sm">
            <DocsSidebar currentSlug={currentSlug} />
          </div>
        </div>

        <main className="min-w-0 border-x border-border/60 bg-background/20">
          {headings.length ? (
            <details className="mx-4 mt-4 border border-border/70 bg-card/55 px-3 py-2 text-sm lg:hidden">
              <summary className="cursor-pointer text-sm font-medium tracking-tight">
                On this page
              </summary>
              <div className="mt-2">
                <DocsToc headings={headings} />
              </div>
            </details>
          ) : null}
          {children}
        </main>

        <div className="hidden xl:block">
          <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto border-l border-border/60 bg-background/35 backdrop-blur-sm">
            <DocsToc headings={headings} />
          </div>
        </div>
      </div>
    </div>
  );
}
