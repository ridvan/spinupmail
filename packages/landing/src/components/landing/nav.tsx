import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ChevronRightIconHandle } from "@/components/ui/chevron-right";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

const sections = [
  { href: "#overview", label: "Overview" },
  { href: "#features", label: "Features" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#setup", label: "Setup" },
  { href: "#api", label: "API" },
] as const;

const startArrowAnimation = (arrowRef: {
  current: ChevronRightIconHandle | null;
}) => {
  arrowRef.current?.startAnimation();
};

const stopArrowAnimation = (arrowRef: {
  current: ChevronRightIconHandle | null;
}) => {
  arrowRef.current?.stopAnimation();
};

export function Nav() {
  const [activeSection, setActiveSection] = useState<string>(sections[0].href);
  const desktopAppArrowRef = useRef<ChevronRightIconHandle>(null);
  const mobileAppArrowRef = useRef<ChevronRightIconHandle>(null);

  useEffect(() => {
    const ids = sections.map(section => section.href.slice(1));

    const resolveActiveSection = () => {
      const offsetY = window.scrollY + 140;
      let nextSection: (typeof sections)[number]["href"] = sections[0].href;

      for (const section of sections) {
        const element = document.getElementById(section.href.slice(1));
        if (element && element.offsetTop <= offsetY) {
          nextSection = section.href;
        }
      }

      setActiveSection(nextSection);
    };

    resolveActiveSection();
    window.addEventListener("scroll", resolveActiveSection, { passive: true });
    window.addEventListener("resize", resolveActiveSection);
    window.addEventListener("hashchange", resolveActiveSection);

    const observers = ids
      .map(id => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node))
      .map(node => {
        const observer = new IntersectionObserver(
          entries => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                setActiveSection(`#${entry.target.id}`);
              }
            }
          },
          { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
        );
        observer.observe(node);
        return observer;
      });

    return () => {
      window.removeEventListener("scroll", resolveActiveSection);
      window.removeEventListener("resize", resolveActiveSection);
      window.removeEventListener("hashchange", resolveActiveSection);
      for (const observer of observers) observer.disconnect();
    };
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-2 z-50 sm:top-3">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="pointer-events-auto overflow-hidden rounded-none border border-border/70 bg-background/60 shadow-[0_10px_40px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex h-12 items-center justify-between gap-2 px-2.5 sm:h-14 sm:gap-3 sm:px-4">
            <a
              href="/"
              className="group inline-flex min-w-0 items-center gap-1.5 px-1 py-1"
            >
              <img
                src="/logo-black.png"
                alt="Spinupmail logo"
                className="size-6 object-contain dark:hidden sm:size-7"
              />
              <img
                src="/logo-transparent.png"
                alt="Spinupmail logo"
                className="hidden size-6 object-contain dark:block sm:size-7"
              />
              <span className="truncate text-sm font-semibold">SpinupMail</span>
            </a>

            <nav className="hidden items-center gap-1 lg:flex">
              {sections.map(section => (
                <a
                  key={section.href}
                  href={section.href}
                  onClick={() => setActiveSection(section.href)}
                  aria-current={
                    activeSection === section.href ? "page" : undefined
                  }
                  className={
                    activeSection === section.href
                      ? "rounded-lg px-3 py-1.5 text-[13px] text-foreground/95 transition-colors"
                      : "rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {section.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-1.5 sm:flex">
              <ThemeSelector />

              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                className="px-3 max-lg:hidden"
                render={<Link to="/docs" />}
              >
                <HugeiconsIcon
                  icon={BookOpen01Icon}
                  data-icon="inline-start"
                  className="ml-1.5"
                />
                Docs
              </Button>

              <Button
                size="sm"
                nativeButton={false}
                className="px-3.5"
                onMouseEnter={() => startArrowAnimation(desktopAppArrowRef)}
                onMouseLeave={() => stopArrowAnimation(desktopAppArrowRef)}
                onFocus={() => startArrowAnimation(desktopAppArrowRef)}
                onBlur={() => stopArrowAnimation(desktopAppArrowRef)}
                render={
                  <a href={landingLinks.app} target="_blank" rel="noreferrer" />
                }
              >
                Open App
                <ChevronRightIcon
                  ref={desktopAppArrowRef}
                  size={14}
                  data-icon="inline-end"
                  aria-hidden="true"
                />
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:hidden">
              <ThemeSelector mobile />

              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                className="h-8 rounded-full px-2.5 text-[12px]"
                render={<Link to="/docs" />}
              >
                Docs
              </Button>

              <Button
                size="sm"
                nativeButton={false}
                className="h-8 rounded-full px-3 text-[12px]"
                onMouseEnter={() => startArrowAnimation(mobileAppArrowRef)}
                onMouseLeave={() => stopArrowAnimation(mobileAppArrowRef)}
                onFocus={() => startArrowAnimation(mobileAppArrowRef)}
                onBlur={() => stopArrowAnimation(mobileAppArrowRef)}
                render={
                  <a href={landingLinks.app} target="_blank" rel="noreferrer" />
                }
              >
                App
                <ChevronRightIcon
                  ref={mobileAppArrowRef}
                  size={14}
                  data-icon="inline-end"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 px-2 py-1.5 lg:hidden">
            <nav className="flex flex-wrap items-center justify-center gap-1">
              {sections.map(section => (
                <a
                  key={`mobile-${section.href}`}
                  href={section.href}
                  onClick={() => setActiveSection(section.href)}
                  aria-current={
                    activeSection === section.href ? "page" : undefined
                  }
                  className={
                    activeSection === section.href
                      ? "shrink-0 rounded-full border border-border/90 bg-card/75 px-2.5 py-1 text-[10px] font-medium text-foreground/95 transition-colors"
                      : "shrink-0 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {section.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
