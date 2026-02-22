import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Shield01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";

const ease = [0.16, 1, 0.3, 1] as const;

const pillars = [
  {
    icon: CheckmarkCircle02Icon,
    title: "Address controls that match testing reality",
    copy: "Configure TTL, sender-domain allowlists, and inbox overflow policy per address for predictable test runs.",
    points: [
      "TTL up to 43,200 minutes",
      "cleanAll or rejectNew behavior",
      "Explicit risk acknowledgment on create",
    ],
  },
  {
    icon: UserGroupIcon,
    title: "Organization boundaries by default",
    copy: "Addresses and messages are scoped to organizations, with invitation flows and role-based collaboration for engineering, QA, and growth.",
    points: [
      "Organization-scoped mailboxes",
      "Member invites and role changes",
      "Active-org switching in UI + API",
    ],
  },
  {
    icon: Shield01Icon,
    title: "Security features available",
    copy: "Turnstile, email verification, optional 2FA, and scoped API keys help enforce access control.",
    points: [
      "Turnstile on auth entrypoints",
      "Email verification + reset flows",
      "API key revocation and org scoping",
    ],
  },
] as const;

export function WhyAdopt() {
  const reduceMotion = useReducedMotion();

  const sectionMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-90px" },
        transition: { duration: 0.6, ease },
      };

  return (
    <section id="why" className="border-b border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          {...sectionMotion}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            What teams use Spinupmail for
          </h2>
          <p className="mt-4 text-muted-foreground">
            Temporary inboxes with organization scope, clear policies, and API
            access for test and automation workflows.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {pillars.map((pillar, index) => {
            const itemMotion = reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 16 },
                  whileInView: { opacity: 1, y: 0 },
                  viewport: { once: true, margin: "-70px" },
                  transition: { duration: 0.55, ease, delay: index * 0.07 },
                };

            return (
              <motion.article
                key={pillar.title}
                className="flex flex-col border border-border/70 bg-card"
                {...itemMotion}
              >
                <div className="p-6">
                  <HugeiconsIcon
                    icon={pillar.icon}
                    className="size-5 text-muted-foreground"
                  />
                  <h3 className="mt-3 text-base font-semibold">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {pillar.copy}
                  </p>
                </div>

                <div className="mt-auto border-t border-border/60 bg-muted/20 p-6">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {pillar.points.map(point => (
                      <li key={point} className="flex items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/70" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[
            "Self-hosted Cloudflare stack",
            "Open-source codebase",
            "UI and REST parity",
          ].map(item => (
            <Badge
              key={item}
              variant="outline"
              className="border-border/70 bg-card/40 text-muted-foreground"
            >
              {item}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
