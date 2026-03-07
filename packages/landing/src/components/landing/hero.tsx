import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  GithubIcon,
  MailIcon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import type { ArrowUpRightIconHandle } from "@/components/ui/arrow-up-right";
import type { ChevronRightIconHandle } from "@/components/ui/chevron-right";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRightIcon } from "@/components/ui/arrow-up-right";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { CloudflareCloudIcon } from "@/components/icons/cloudflare-cloud-icon";
import { landingLinks } from "@/lib/links";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const inboxRows = [
  { from: "gmail.com", subject: "Password Reset Request", time: "2m" },
  { from: "github.com", subject: "Pipeline Alert", time: "9m" },
  { from: "example.com", subject: "SMTP Service Testing", time: "21m" },
] as const;

type AnimatedArrowHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

const startArrowAnimation = (arrowRef: {
  current: AnimatedArrowHandle | null;
}) => {
  arrowRef.current?.startAnimation();
};

const stopArrowAnimation = (arrowRef: {
  current: AnimatedArrowHandle | null;
}) => {
  arrowRef.current?.stopAnimation();
};

const techStack = [
  {
    name: "Cloudflare Workers, D1, R2",
    logo: "/logos/cloudflare-workers.svg",
    logoClassName: "h-4 w-auto",
  },
  {
    name: "Better Auth",
    logo: "/logos/better-auth.svg",
    logoClassName: "h-4 w-auto dark:invert",
  },
  {
    name: "Drizzle",
    logo: "/logos/drizzle.svg",
    logoClassName: "h-7 w-auto brightness-0 invert opacity-90",
  },
  {
    name: "Hono",
    logo: "/logos/hono.svg",
    logoClassName:
      "h-4 w-auto saturate-0 brightness-[2.2] contrast-75 opacity-90",
  },
  {
    name: "TanStack Start",
    logo: "/logos/tanstack.svg",
    logoClassName: "h-4 w-auto",
  },
] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();
  const getStartedArrowRef = useRef<ChevronRightIconHandle>(null);
  const githubArrowRef = useRef<ArrowUpRightIconHandle>(null);

  const topMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.75, ease },
      };

  const previewMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.8, ease, delay: 0.2 },
      };

  const cloudMotion = reduceMotion
    ? {}
    : {
        initial: { x: -5, opacity: 0.75 },
        animate: { x: 0, opacity: 1 },
        transition: {
          duration: 0.42,
          ease,
          delay: 0.05,
        },
      };

  return (
    <section
      id="overview"
      className="relative overflow-hidden border-b border-border/60 pb-18 pt-32 md:pb-24 lg:pt-24"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(200, 200, 200, 0.1) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-72 bg-linear-to-b from-white/8 via-white/2 to-transparent" />
        <div className="absolute -left-18 top-20 h-72 w-72 rounded-full bg-white/6 blur-[72px]" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-white/4 blur-[84px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <motion.div className="mx-auto max-w-4xl text-center" {...topMotion}>
          <Badge
            variant="outline"
            className="mb-6 border-border/70 bg-muted/30 text-muted-foreground"
          >
            Free & Open Source
          </Badge>

          <h1 className="text-pretty text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Self-host disposable emails
            <br />
            <span className="text-foreground/80">
              for teams on{" "}
              <span className="inline-flex items-baseline gap-[0.16em] whitespace-nowrap">
                <motion.span
                  className="inline-flex shrink-0 text-foreground/65 dark:text-white/80"
                  {...cloudMotion}
                >
                  <CloudflareCloudIcon
                    label="Cloudflare"
                    className="h-[0.82em] w-auto"
                  />
                </motion.span>
                <span>Cloudflare</span>
              </span>
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Create unlimited email addresses with attachment support for
            you/your team, access via dashboard or API. Set TTL, allowed
            senders, auto-cleanup, and more.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="px-5"
              nativeButton={false}
              onMouseEnter={() => startArrowAnimation(getStartedArrowRef)}
              onMouseLeave={() => stopArrowAnimation(getStartedArrowRef)}
              onFocus={() => startArrowAnimation(getStartedArrowRef)}
              onBlur={() => stopArrowAnimation(getStartedArrowRef)}
              render={
                <a href={landingLinks.app} target="_blank" rel="noreferrer" />
              }
            >
              Get Started
              <ChevronRightIcon
                ref={getStartedArrowRef}
                size={16}
                data-icon="inline-end"
                aria-hidden="true"
              />
            </Button>

            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              onMouseEnter={() => startArrowAnimation(githubArrowRef)}
              onMouseLeave={() => stopArrowAnimation(githubArrowRef)}
              onFocus={() => startArrowAnimation(githubArrowRef)}
              onBlur={() => stopArrowAnimation(githubArrowRef)}
              render={
                <a
                  href={landingLinks.github}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <HugeiconsIcon
                icon={GithubIcon}
                className="size-4 text-muted-foreground/75"
                aria-hidden="true"
              />
              View on GitHub
              <ArrowUpRightIcon
                ref={githubArrowRef}
                size={16}
                data-icon="inline-end"
                aria-hidden="true"
              />
            </Button>
          </div>
        </motion.div>

        <motion.div className="mx-auto mt-10 max-w-4xl" {...previewMotion}>
          <div className="border border-border/70 bg-linear-to-br from-white/3 via-transparent to-black/10 p-px">
            <InboxPreview reduceMotion={Boolean(reduceMotion)} />
          </div>

          <p className="pt-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">
            Tech Stack
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground/75">
            {techStack.map(tech => (
              <span
                key={tech.name}
                className="inline-flex h-7 items-center gap-1.5 text-[13px] text-foreground/85"
              >
                <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center">
                  <img
                    src={tech.logo}
                    alt={`${tech.name} logo`}
                    loading="lazy"
                    className={cn(
                      "max-h-full object-contain",
                      tech.logoClassName
                    )}
                  />
                </span>
                <span className="leading-none">{tech.name}</span>
              </span>
            ))}
          </div>

          <p className="mt-4 text-center font-mono text-[11px] text-muted-foreground/70">
            scaffolded with{" "}
            <a
              href="https://github.com/zpg6/better-auth-cloudflare"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-3 hover:text-foreground"
            >
              better-auth-cloudflare
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function InboxPreview({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="bg-card shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <HugeiconsIcon
            icon={MailIcon}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate font-mono text-sm font-medium">
            test-user-1@spinupmail.dev
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            8/25 received
          </span>
          <Badge variant="secondary">Expires in 42m</Badge>
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {inboxRows.map((row, index) => {
          const rowMotion = reduceMotion
            ? {}
            : {
                initial: { opacity: 0, x: -10 },
                animate: { opacity: 1, x: 0 },
                transition: {
                  duration: 0.35,
                  ease,
                  delay: 0.18 + index * 0.06,
                },
              };

          return (
            <motion.div
              key={`${row.from}-${row.subject}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/45"
              {...rowMotion}
            >
              <div className="flex min-w-0 items-center gap-3">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="shrink-0 text-sm font-medium">{row.from}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {row.subject}
                </span>
              </div>

              <span className="shrink-0 text-xs text-muted-foreground">
                {row.time}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
