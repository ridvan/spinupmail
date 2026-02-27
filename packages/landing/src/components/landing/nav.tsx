import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

const sections = [
  { href: "#overview", label: "Overview" },
  { href: "#features", label: "Features" },
  { href: "#pipeline", label: "Pipeline" },
  { href: "#setup", label: "Setup" },
  { href: "#api", label: "API" },
] as const;

export function Nav() {
  const [activeSection, setActiveSection] = useState<string>(sections[0].href);

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
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="pointer-events-auto overflow-hidden rounded-none border border-border/70 bg-background/60 shadow-[0_10px_40px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
            <a
              href="/"
              className="group inline-flex items-center gap-1 px-1 py-1.5"
            >
              <img
                src="/logo-transparent.png"
                alt="Spinupmail logo"
                className="size-7 object-contain"
              />
              <span className="text-sm font-semibold tracking-tight">
                Spinupmail
              </span>
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
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                className="rounded-xl px-3 max-lg:hidden"
                render={
                  <a
                    href={landingLinks.github}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                GitHub
              </Button>

              <Button
                size="sm"
                nativeButton={false}
                className="rounded-xl px-3.5"
                render={
                  <a href={landingLinks.app} target="_blank" rel="noreferrer" />
                }
              >
                Dashboard
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 sm:hidden">
              <Button
                size="sm"
                nativeButton={false}
                className="rounded-xl px-2.5"
                render={
                  <a href={landingLinks.app} target="_blank" rel="noreferrer" />
                }
              >
                Setup
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>
          </div>

          <div className="border-t border-border/60 px-3 py-2 lg:hidden">
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
                      ? "snap-start shrink-0 rounded-lg border border-border/90 bg-card/75 px-2.5 py-1 text-[11px] text-foreground/95 transition-colors"
                      : "snap-start shrink-0 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
