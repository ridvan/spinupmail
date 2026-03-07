import {
  ArrowRight01Icon,
  CodeIcon,
  ComputerIcon,
  DatabaseIcon,
  FolderCloudIcon,
  MailIcon,
  ShieldIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

const steps = [
  {
    icon: MailIcon,
    title: "Email Routing intake",
    copy: "Inbound messages arrive through Cloudflare Email Routing into the Worker email handler.",
  },
  {
    icon: ShieldIcon,
    title: "Address + sender policy check",
    copy: "Unknown, expired, or disallowed sender-domain traffic is rejected before storage.",
  },
  {
    icon: CodeIcon,
    title: "MIME parse + sanitize",
    copy: "Bodies are parsed, HTML is sanitized, and oversized data is capped to protect D1 writes.",
  },
  {
    icon: DatabaseIcon,
    title: "Persist to D1 and R2",
    copy: "Metadata lands in D1. Attachments and optional raw MIME go to scoped R2 object paths.",
  },
  {
    icon: ComputerIcon,
    title: "Scoped retrieval",
    copy: "UI/API reads require organization scope, including API key usage with X-Org-Id.",
  },
] as const;

const storageTargets = [
  {
    title: "Stored in D1",
    copy: "Address records, message metadata, sanitized body text/HTML, and attachment metadata for fast organization-scoped queries.",
    detail: "Relational store",
    icon: DatabaseIcon,
  },
  {
    title: "Stored in R2",
    copy: "Attachments are persisted per org/address/email path. Raw MIME can be enabled for debugging and downloaded through authenticated routes.",
    detail: "Object store",
    icon: FolderCloudIcon,
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

  const itemMotion = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, x: 10, y: 18, scale: 0.985 },
          whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
          viewport: { once: true, margin: "-70px" },
          transition: { duration: 0.55, ease, delay },
        };

  return (
    <section id="pipeline" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          {...sectionMotion}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Inbound email process
          </h2>
          <p className="mt-4 text-muted-foreground">
            Requests are validated in sequence: intake, policy checks, parsing,
            storage, and organization-scoped reads.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, index) => (
            <motion.article
              key={step.title}
              className="group border border-border/70 bg-card p-4"
              {...itemMotion(index * 0.05)}
              whileHover={reduceMotion ? undefined : { y: -3 }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={step.icon}
                    className="size-4 text-muted-foreground/70"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/75">
                    Step {String(index + 1).padStart(2, "0")}
                  </p>
                </div>
                {index < steps.length - 1 ? (
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-3.5 text-muted-foreground/45 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground/45">done</span>
                )}
              </div>
              <h3 className="mt-4 text-base font-semibold leading-tight">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {step.copy}
              </p>
            </motion.article>
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {storageTargets.map((target, index) => (
            <motion.div
              key={target.title}
              className="border border-border/70 bg-card p-5"
              {...itemMotion(0.15 + index * 0.06)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <HugeiconsIcon
                    icon={target.icon}
                    className="size-4 text-muted-foreground"
                  />
                  {target.title}
                </div>
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {target.detail}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {target.copy}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
