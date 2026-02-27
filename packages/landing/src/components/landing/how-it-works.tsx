import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

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

const terminalLines = [
  {
    text: "git clone https://github.com/spinupmail/spinupmail",
    type: "cmd" as const,
  },
  { text: "cd spinupmail && pnpm install", type: "cmd" as const },
  { text: "", type: "blank" as const },
  { text: "# Provision Cloudflare resources", type: "comment" as const },
  { text: "pnpm exec wrangler d1 create SUM_DB", type: "cmd" as const },
  {
    text: "pnpm exec wrangler kv namespace create SUM_KV",
    type: "cmd" as const,
  },
  {
    text: "pnpm exec wrangler r2 bucket create spinupmail-attachments",
    type: "cmd" as const,
  },
  {
    text: "cp packages/backend/wrangler.toml.example packages/backend/wrangler.toml",
    type: "cmd" as const,
  },
  { text: "", type: "blank" as const },
  { text: "# Deploy services", type: "comment" as const },
  { text: "pnpm deploy:backend", type: "cmd" as const },
  { text: "pnpm deploy:frontend", type: "cmd" as const },
  { text: "", type: "blank" as const },
  { text: "✓ Worker deployed", type: "success" as const },
  { text: "✓ Pages deployed", type: "success" as const },
  { text: "✓ Route /api/* points to Worker", type: "success" as const },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  const sectionMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.65, ease },
      };

  return (
    <section id="setup" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
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
              render={
                <a href={landingLinks.docs} target="_blank" rel="noreferrer" />
              }
            >
              Open Full Deployment Guide
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          </div>
        </motion.div>

        <div className="mt-12 grid items-start gap-12 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-8">
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
                <motion.div
                  key={step.number}
                  className="flex gap-5"
                  {...itemMotion}
                >
                  <span className="mt-0.5 text-3xl font-bold text-muted-foreground/20">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

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
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="ml-2 text-xs text-muted-foreground">
                terminal
              </span>
            </div>

            <div className="p-4 font-mono text-[13px] leading-relaxed">
              {terminalLines.map((line, index) => (
                <div key={`${line.text}-${index}`}>
                  {line.type === "cmd" ? (
                    <span>
                      <span className="text-muted-foreground/55 select-none">
                        ${" "}
                      </span>
                      <span className="text-foreground/85">{line.text}</span>
                    </span>
                  ) : null}

                  {line.type === "comment" ? (
                    <span className="text-muted-foreground/45">
                      {line.text}
                    </span>
                  ) : null}

                  {line.type === "success" ? (
                    <span className="text-muted-foreground">{line.text}</span>
                  ) : null}

                  {line.type === "blank" ? <br /> : null}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
