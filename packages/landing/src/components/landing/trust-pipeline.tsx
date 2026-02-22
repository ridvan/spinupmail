import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  DatabaseIcon,
  FolderCloudIcon,
  MailOpen02Icon,
  ShieldEnergyIcon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";

const ease = [0.16, 1, 0.3, 1] as const;

const steps = [
  {
    title: "Email Routing intake",
    copy: "Inbound messages arrive through Cloudflare Email Routing into the Worker email handler.",
  },
  {
    title: "Address + sender policy check",
    copy: "Unknown, expired, or disallowed sender-domain traffic is rejected before storage.",
  },
  {
    title: "MIME parse + sanitize",
    copy: "Bodies are parsed, HTML is sanitized, and oversized data is capped to protect D1 writes.",
  },
  {
    title: "Persist to D1 and R2",
    copy: "Metadata lands in D1. Attachments and optional raw MIME go to scoped R2 object paths.",
  },
  {
    title: "Scoped retrieval",
    copy: "UI/API reads require organization scope, including API key usage with X-Org-Id.",
  },
] as const;

export function TrustPipeline() {
  const reduceMotion = useReducedMotion();

  const sectionMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-90px" },
        transition: { duration: 0.62, ease },
      };

  return (
    <section id="pipeline" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          {...sectionMotion}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How inbound email is processed
          </h2>
          <p className="mt-4 text-muted-foreground">
            Requests are validated in sequence: intake, policy checks, parsing,
            storage, and organization-scoped reads.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-3 md:grid-cols-5">
          {steps.map((step, index) => {
            const cardMotion = reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 16 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, margin: "-70px" },
                  transition: { duration: 0.5, ease, delay: index * 0.05 },
                };

            return (
              <motion.article
                key={step.title}
                className="relative border border-border/70 bg-card p-4"
                {...cardMotion}
              >
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  STEP {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.copy}
                </p>
                {index < steps.length - 1 ? (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="absolute -right-2 top-4 hidden size-4 text-border lg:block"
                    aria-hidden="true"
                  />
                ) : null}
              </motion.article>
            );
          })}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          <div className="border border-border/70 bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon
                icon={DatabaseIcon}
                className="size-4 text-muted-foreground"
              />
              Stored in D1
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Address records, message metadata, sanitized body text/HTML, and
              attachment metadata for fast organization-scoped queries.
            </p>
          </div>

          <div className="border border-border/70 bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HugeiconsIcon
                icon={FolderCloudIcon}
                className="size-4 text-muted-foreground"
              />
              Stored in R2
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Attachments are persisted per org/address/email path. Raw MIME can
              be enabled for debugging and downloaded through authenticated
              routes.
            </p>
          </div>
        </div>

        <div className="mt-6 border border-border/70 bg-card px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <HugeiconsIcon
              icon={ShieldEnergyIcon}
              className="size-4 text-muted-foreground"
            />
            <span>Default operational limits</span>
            <HugeiconsIcon
              icon={MailOpen02Icon}
              className="ml-1 size-4 text-muted-foreground"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Raw email read cap: 512 KB",
              "Body storage cap: 512 KB",
              "Attachment cap: 10 MB",
              "Email list limit: 100",
            ].map(limit => (
              <Badge
                key={limit}
                variant="outline"
                className="border-border/70 bg-muted/20 text-muted-foreground"
              >
                {limit}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
