import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  CheckmarkCircle02Icon,
  MailIcon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

const ease = [0.16, 1, 0.3, 1] as const;

const inboxRows = [
  { from: "github.com", subject: "Confirm your repository email", time: "2m" },
  { from: "stripe.com", subject: "Webhook health alert", time: "9m" },
  { from: "vercel.com", subject: "Preview deployment complete", time: "21m" },
] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();

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

  return (
    <section className="relative overflow-hidden border-b border-border/60 pb-18 pt-18 md:pb-24 md:pt-24">
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
        <motion.div className="mx-auto max-w-3xl text-center" {...topMotion}>
          <Badge
            variant="outline"
            className="mb-6 border-border/70 bg-muted/30 text-muted-foreground"
          >
            Cloudflare-native · Open Source · Self-hosted
          </Badge>

          <h1 className="text-pretty text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Self-host temporary emails
            <br />
            <span className="text-foreground/80">for teams on Cloudflare</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Create organization-scoped inbox addresses with sender policies and
            inspect inbound messages with attachments from the dashboard or API.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              render={
                <a
                  href={landingLinks.quickstart}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Read Quickstart
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              render={
                <a
                  href={landingLinks.github}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              View on GitHub
              <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon="inline-end" />
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px]">
            {[
              "Scoped API keys + X-Org-Id",
              "Sender-domain allowlists",
              "2FA, Turnstile, email verification",
            ].map(item => (
              <Badge
                key={item}
                variant="outline"
                className="border-border/70 bg-card/50 text-muted-foreground"
              >
                {item}
              </Badge>
            ))}
          </div>
        </motion.div>

        <motion.div className="mx-auto mt-14 max-w-4xl" {...previewMotion}>
          <div className="border border-border/70 bg-linear-to-br from-white/3 via-transparent to-black/10 p-px">
            <InboxPreview reduceMotion={Boolean(reduceMotion)} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground/75">
            <span className="font-medium text-foreground/80">Stack:</span>
            {["Cloudflare Workers", "Email Routing", "D1", "R2", "Pages"].map(
              tech => (
                <span key={tech}>{tech}</span>
              )
            )}
          </div>
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
            qa-suite@spinupmail.dev
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

      <div className="border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
        Sender policy active · Raw source available · Attachments downloadable
      </div>
    </div>
  );
}
