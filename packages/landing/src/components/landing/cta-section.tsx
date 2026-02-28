import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

const ease = [0.16, 1, 0.3, 1] as const;

export function CtaSection() {
  const reduceMotion = useReducedMotion();
  const docsRender = landingLinks.docs.startsWith("http") ? (
    <a href={landingLinks.docs} target="_blank" rel="noreferrer" />
  ) : (
    <Link to="/docs/$slug" params={{ slug: "quickstart" }} />
  );

  return (
    <section className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="relative overflow-hidden border border-border/70 bg-linear-to-br from-white/4 via-transparent to-black/10 p-px"
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 20 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: "-80px" },
                transition: { duration: 0.66, ease },
              })}
        >
          <div className="relative bg-card px-8 py-14 text-center md:px-14 md:py-18">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              <div className="absolute left-1/4 top-0 h-44 w-64 bg-white/6 blur-[70px]" />
              <div className="absolute bottom-0 right-1/4 h-44 w-64 bg-white/4 blur-[70px]" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Ready to deploy Spinupmail?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Use the setup guide to deploy Worker + Pages on Cloudflare, then
                create addresses and automate inbox workflows.
              </p>

              <motion.div
                className="mt-9 flex flex-wrap items-center justify-center gap-3"
                {...(reduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 12 },
                      whileInView: { opacity: 1, y: 0 },
                      viewport: { once: true },
                      transition: { duration: 0.45, ease, delay: 0.12 },
                    })}
              >
                <Button size="lg" nativeButton={false} render={docsRender}>
                  Start Quickstart
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    data-icon="inline-end"
                  />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  nativeButton={false}
                  render={
                    <a
                      href={landingLinks.github}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  Review Source
                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    data-icon="inline-end"
                  />
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
