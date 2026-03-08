import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { startTransition, useState } from "react";
import type { AnimatedTerminalLine } from "@/components/landing/animated-terminal-code";
import { AnimatedTerminalCode } from "@/components/landing/animated-terminal-code";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const steps = [
  {
    number: "01",
    title: "Clone and install",
    description:
      "Clone the repository and install dependencies from the project root with pnpm.",
  },
  {
    number: "02",
    title: "Provision Cloudflare resources",
    description:
      "Create D1, KV, and R2 resources, then configure Worker bindings and secrets in wrangler.toml.",
  },
  {
    number: "03",
    title: "Deploy backend and frontend",
    description:
      "Deploy the Worker and Pages app separately, then route /api/* to the Worker on your domain.",
  },
] as const;

type TerminalTokenTone = "base" | "muted" | "comment" | "flag" | "value";

type TerminalToken = {
  text: string;
  tone?: TerminalTokenTone;
};

type TerminalLine =
  | {
      kind: "code";
      prompt?: boolean;
      tokens: ReadonlyArray<TerminalToken>;
    }
  | {
      kind: "blank";
    };

type TerminalStep = {
  id: string;
  label: string;
  detail: string;
  lines: ReadonlyArray<TerminalLine>;
  output?: ReadonlyArray<string>;
};

const toneClassName: Record<TerminalTokenTone, string> = {
  base: "text-foreground/90 dark:text-foreground/88",
  muted: "text-foreground/72 dark:text-muted-foreground/72",
  comment: "text-muted-foreground/72 dark:text-muted-foreground/42",
  flag: "text-foreground/66 dark:text-muted-foreground/62",
  value: "text-foreground/82 dark:text-foreground/78",
};

const terminalSteps: ReadonlyArray<TerminalStep> = [
  {
    id: "01",
    label: "Bootstrap",
    detail: "Clone the repo and install workspace dependencies.",
    lines: [
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "git", tone: "base" },
          { text: " clone ", tone: "muted" },
          {
            text: "https://github.com/ridvan/spinupmail",
            tone: "value",
          },
        ],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "cd", tone: "base" },
          { text: " spinupmail ", tone: "value" },
          { text: "&&", tone: "muted" },
          { text: " pnpm", tone: "base" },
          { text: " install", tone: "value" },
        ],
      },
    ],
  },
  {
    id: "02",
    label: "Provision",
    detail: "Create Cloudflare primitives and copy the backend config.",
    lines: [
      {
        kind: "code",
        tokens: [{ text: "# Provision Cloudflare resources", tone: "comment" }],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "pnpm", tone: "base" },
          { text: " exec wrangler d1 create ", tone: "muted" },
          { text: "SUM_DB", tone: "value" },
        ],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "pnpm", tone: "base" },
          { text: " exec wrangler kv namespace create ", tone: "muted" },
          { text: "SUM_KV", tone: "value" },
        ],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "pnpm", tone: "base" },
          { text: " exec wrangler r2 bucket create ", tone: "muted" },
          { text: "spinupmail-attachments", tone: "value" },
        ],
      },
      { kind: "blank" },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "cp", tone: "base" },
          {
            text: " packages/backend/wrangler.toml.example",
            tone: "value",
          },
          { text: " packages/backend/wrangler.toml", tone: "value" },
        ],
      },
    ],
  },
  {
    id: "03",
    label: "Deploy",
    detail: "Ship the backend and frontend, then confirm routing.",
    lines: [
      {
        kind: "code",
        tokens: [{ text: "# Deploy services", tone: "comment" }],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "pnpm", tone: "base" },
          { text: " deploy:backend", tone: "value" },
        ],
      },
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "pnpm", tone: "base" },
          { text: " deploy:frontend", tone: "value" },
        ],
      },
    ],
    output: [
      "Worker deployed",
      "Pages deployed",
      "Route /api/* points to Worker",
    ],
  },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();
  const [activeTerminalStepId, setActiveTerminalStepId] = useState(
    terminalSteps[0].id
  );
  const [terminalReplayKey, setTerminalReplayKey] = useState(0);
  const docsRender = landingLinks.docs.startsWith("http") ? (
    <a href={landingLinks.docs} target="_blank" rel="noreferrer" />
  ) : (
    <Link to="/docs/$slug" params={{ slug: "deploy-routing" }} />
  );
  const activeTerminalStep =
    terminalSteps.find(step => step.id === activeTerminalStepId) ??
    terminalSteps[0];

  const sectionMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.65, ease },
      };

  const activateTerminalStep = (stepId: string) => {
    startTransition(() => {
      setActiveTerminalStepId(stepId);
      setTerminalReplayKey(current => current + 1);
    });
  };

  return (
    <section id="setup" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-14">
          <motion.div {...sectionMotion}>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Self-host setup in three steps
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              The deployment flow is explicit: provision Cloudflare resources,
              configure bindings, deploy Worker + Pages, then route API traffic.
            </p>
            <div className="mt-5">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={docsRender}
              >
                Open Full Deployment Guide
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>

            <div className="mt-12 space-y-8">
              {steps.map((step, index) => {
                const itemMotion = reduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 18 },
                      whileInView: { opacity: 1, y: 0 },
                      viewport: { once: true, margin: "-40px" },
                      transition: { duration: 0.5, ease, delay: index * 0.08 },
                    };

                return (
                  <div key={step.number} className="relative">
                    <motion.div className="flex gap-5" {...itemMotion}>
                      <span
                        className={cn(
                          "mt-0.5 text-3xl font-bold transition-colors",
                          activeTerminalStepId === step.number
                            ? "text-muted-foreground/55"
                            : "text-muted-foreground/20"
                        )}
                      >
                        {step.number}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold">{step.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            className="overflow-hidden border border-border/70 bg-card"
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 24 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, margin: "-60px" },
                  transition: { duration: 0.65, ease, delay: 0.12 },
                })}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="ml-2 text-xs text-muted-foreground">
                terminal
              </span>
              <div
                role="tablist"
                aria-label="Setup steps"
                className="ml-auto flex flex-wrap items-center justify-end gap-1.5 max-sm:w-full max-sm:justify-start"
              >
                {terminalSteps.map(step => {
                  const isActive = step.id === activeTerminalStep.id;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`setup-terminal-panel-${step.id}`}
                      id={`setup-terminal-tab-${step.id}`}
                      onClick={() => activateTerminalStep(step.id)}
                      className={cn(
                        "border px-2.5 py-1 text-[11px] transition-colors",
                        isActive
                          ? "border-border/90 bg-background text-foreground"
                          : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {step.id} {step.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              role="tabpanel"
              id={`setup-terminal-panel-${activeTerminalStep.id}`}
              aria-labelledby={`setup-terminal-tab-${activeTerminalStep.id}`}
              className="bg-linear-to-b from-muted/10 via-transparent to-transparent p-4"
            >
              <p className="mb-3 text-[11px] text-muted-foreground/60">
                {activeTerminalStep.detail}
              </p>

              <AnimatedTerminalCode
                sequenceKey={`${activeTerminalStep.id}-${terminalReplayKey}`}
                lines={
                  activeTerminalStep.lines as ReadonlyArray<AnimatedTerminalLine>
                }
                output={activeTerminalStep.output}
                reduceMotion={!!reduceMotion}
                getToneClassName={tone =>
                  toneClassName[
                    (tone as TerminalTokenTone | undefined) ?? "base"
                  ]
                }
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
