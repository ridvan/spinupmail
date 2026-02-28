import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import type { DocHeading } from "./content/docs-content";
import { cn } from "@/lib/utils";

const ACTIVE_TOP_OFFSET = 120;

function getItemOffset(level: number): number {
  if (level <= 2) return 14;
  if (level === 3) return 26;
  return 36;
}

function getLineOffset(level: number): number {
  return level >= 3 ? 10 : 0;
}

export function DocsToc({ headings }: { headings: Array<DocHeading> }) {
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(
    headings[0]?.id
  );
  const [lineMask, setLineMask] = useState<
    | {
        path: string;
        width: number;
        height: number;
      }
    | undefined
  >();
  const [thumb, setThumb] = useState({
    top: 0,
    height: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIds = useMemo(() => {
    if (!activeHeadingId) return [];

    const activeHeading = headings.find(
      heading => heading.id === activeHeadingId
    );
    if (!activeHeading) return [];
    if (activeHeading.level === 2) return [activeHeading.id];

    const activeIndex = headings.findIndex(
      heading => heading.id === activeHeading.id
    );
    const parentId = headings
      .slice(0, activeIndex)
      .reverse()
      .find(heading => heading.level === 2)?.id;

    return parentId ? [parentId, activeHeading.id] : [activeHeading.id];
  }, [headings, activeHeadingId]);

  useEffect(() => {
    if (!headings.length) {
      setActiveHeadingId(undefined);
      return;
    }

    let rafId: number | undefined;
    const getHeadingElements = () =>
      headings
        .map(heading => document.getElementById(heading.id))
        .filter((element): element is HTMLElement => Boolean(element));

    const updateActiveHeading = () => {
      const headingElements = getHeadingElements();
      if (!headingElements.length) {
        return;
      }

      let nextActiveId = headingElements[0]?.id;
      const isNearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;

      if (isNearBottom) {
        nextActiveId = headingElements[headingElements.length - 1].id;
      } else {
        for (const element of headingElements) {
          const offsetTop =
            element.getBoundingClientRect().top - ACTIVE_TOP_OFFSET;
          if (offsetTop <= 0) {
            nextActiveId = element.id;
            continue;
          }
          break;
        }
      }

      setActiveHeadingId(current =>
        current === nextActiveId ? current : nextActiveId
      );
    };

    const scheduleUpdate = () => {
      if (rafId !== undefined) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = undefined;
        updateActiveHeading();
      });
    };

    setActiveHeadingId(headings[0]?.id);
    const hashId = window.location.hash.replace(/^#/, "");
    const initialElements = getHeadingElements();
    if (hashId && initialElements.some(element => element.id === hashId)) {
      setActiveHeadingId(hashId);
    } else {
      scheduleUpdate();
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);
    window.requestAnimationFrame(updateActiveHeading);
    const lateSyncTimer = window.setTimeout(scheduleUpdate, 180);

    return () => {
      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(lateSyncTimer);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [headings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !headings.length) {
      setLineMask(undefined);
      setThumb({ top: 0, height: 0 });
      return;
    }

    const update = () => {
      if (container.clientHeight === 0) return;

      let width = 0;
      let height = 0;
      const pathParts: Array<string> = [];

      for (const heading of headings) {
        const anchor = container.querySelector<HTMLElement>(
          `a[href="#${heading.id}"]`
        );
        if (!anchor) continue;

        const styles = getComputedStyle(anchor);
        const offset = getLineOffset(heading.level) + 1;
        const top = anchor.offsetTop + parseFloat(styles.paddingTop);
        const bottom =
          anchor.offsetTop +
          anchor.clientHeight -
          parseFloat(styles.paddingBottom);

        width = Math.max(width, offset);
        height = Math.max(height, bottom);

        pathParts.push(`${pathParts.length === 0 ? "M" : "L"}${offset} ${top}`);
        pathParts.push(`L${offset} ${bottom}`);
      }

      setLineMask(
        pathParts.length > 0
          ? {
              path: pathParts.join(" "),
              width: width + 1,
              height,
            }
          : undefined
      );

      if (!activeIds.length) {
        setThumb({ top: 0, height: 0 });
        return;
      }

      let top = Number.MAX_VALUE;
      let bottom = 0;
      let found = false;

      for (const id of activeIds) {
        const anchor = container.querySelector<HTMLElement>(`a[href="#${id}"]`);
        if (!anchor) continue;

        const styles = getComputedStyle(anchor);
        top = Math.min(top, anchor.offsetTop + parseFloat(styles.paddingTop));
        bottom = Math.max(
          bottom,
          anchor.offsetTop +
            anchor.clientHeight -
            parseFloat(styles.paddingBottom)
        );
        found = true;
      }

      setThumb(
        found
          ? { top, height: Math.max(bottom - top, 2) }
          : { top: 0, height: 0 }
      );
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [headings, activeIds]);

  if (!headings.length) {
    return (
      <aside className="docs-toc pb-6 pt-11">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
          <HugeiconsIcon
            icon={Menu01Icon}
            className="size-3.5 text-muted-foreground/70"
            strokeWidth={1.8}
          />
          On this page
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          No headings for this page.
        </p>
      </aside>
    );
  }

  return (
    <aside className="docs-toc pb-6 pt-11">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70">
        <HugeiconsIcon
          icon={Menu01Icon}
          className="size-3.5 text-muted-foreground/70"
          strokeWidth={1.8}
        />
        On this page
      </p>

      <nav className="relative mt-3" aria-label="Table of contents">
        {lineMask ? (
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              width: lineMask.width,
              height: lineMask.height,
              maskImage: `url("data:image/svg+xml,${encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lineMask.width} ${lineMask.height}"><path d="${lineMask.path}" stroke="black" stroke-width="0.8" fill="none" /></svg>`
              )}")`,
            }}
          >
            <div
              className="absolute left-0 w-full bg-foreground/75 transition-[top,height]"
              style={{
                top: thumb.top,
                height: thumb.height,
                opacity: thumb.height > 0 ? 1 : 0,
              }}
            />
          </div>
        ) : null}

        <div ref={containerRef} className="flex flex-col">
          {headings.map((heading, index) => {
            const upper = headings[index - 1]?.level ?? heading.level;
            const lower = headings[index + 1]?.level ?? heading.level;
            const offset = getLineOffset(heading.level);
            const upperOffset = getLineOffset(upper);
            const lowerOffset = getLineOffset(lower);
            const isCurrent = heading.id === activeHeadingId;
            const isInActivePath = activeIds.includes(heading.id);

            return (
              <a
                key={heading.id}
                href={heading.href}
                aria-current={isCurrent ? "location" : undefined}
                onClick={() => setActiveHeadingId(heading.id)}
                className={cn(
                  "relative py-1.5 text-[13px] leading-[1.45] transition-colors first:pt-0 last:pb-0",
                  isInActivePath
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  isCurrent ? "font-semibold" : undefined
                )}
                style={{
                  paddingInlineStart: getItemOffset(heading.level),
                }}
              >
                {offset !== upperOffset ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    className="absolute -top-1.5 left-0 size-4"
                    aria-hidden
                  >
                    <line
                      x1={upperOffset}
                      y1="0"
                      x2={offset}
                      y2="12"
                      className="stroke-foreground/10"
                      strokeWidth="0.8"
                    />
                  </svg>
                ) : null}

                <div
                  className={cn(
                    "absolute inset-y-0 w-[0.5px] bg-foreground/10",
                    offset !== upperOffset ? "top-1.5" : undefined,
                    offset !== lowerOffset ? "bottom-1.5" : undefined
                  )}
                  style={{ left: offset }}
                  aria-hidden
                />

                {heading.title}
              </a>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
