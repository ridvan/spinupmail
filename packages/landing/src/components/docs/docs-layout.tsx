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
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    if (typeof document === "undefined") return;

    setIsDark(current => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("spinupmail-theme", next ? "dark" : "light");
      return next;
    });
  };

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    const savedTheme = window.localStorage.getItem("spinupmail-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;

    document.documentElement.classList.toggle("dark", shouldUseDark);
    setIsDark(shouldUseDark);
  }, []);

  return (
    <div className="docs-shell min-h-screen bg-background text-foreground">
      <DocsHeader
        currentSlug={currentSlug}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onToggleMobileSidebar={() => setMobileSidebarOpen(state => !state)}
      />

      <DocsSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-70 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <div
            className="h-full w-[88vw] max-w-sm border-r border-border/70 bg-background"
            onClick={event => event.stopPropagation()}
          >
            <DocsSidebar
              currentSlug={currentSlug}
              onOpenSearch={() => {
                setMobileSidebarOpen(false);
                setSearchOpen(true);
              }}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="docs-layout-grid pt-14 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_19.5rem]">
        <div className="hidden lg:block">
          <div className="docs-left-pane sticky top-14 h-[calc(100vh-56px)] border-r border-border/60 bg-background">
            <DocsSidebar
              currentSlug={currentSlug}
              onOpenSearch={() => setSearchOpen(true)}
            />
          </div>
        </div>

        <main className="docs-main-pane min-w-0 bg-background">{children}</main>

        <div className="hidden 2xl:block">
          <div className="docs-right-pane sticky top-14 h-[calc(100vh-56px)] overflow-y-auto bg-background">
            <DocsToc headings={headings} />
          </div>
        </div>
      </div>
    </div>
  );
}
