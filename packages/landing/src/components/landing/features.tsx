import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  ConnectIcon,
  LayoutIcon,
  MailIcon,
  ShieldIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { CloudflareCloudIcon } from "@/components/icons/cloudflare-cloud-icon";

const ease = [0.16, 1, 0.3, 1] as const;

export function Features() {
  const reduceMotion = useReducedMotion();

  const sectionMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-80px" },
        transition: { duration: 0.65, ease },
      };

  const cardMotion = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.55, ease, delay },
        };

  return (
    <section id="features" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          {...sectionMotion}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Built for temporary emails
            <br className="hidden sm:block" />
            <span className="text-foreground/80">in real team workflows</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Spinupmail gives teams controlled inboxes, isolated workspaces, and
            automation-ready APIs for testing, verification, and internal
            operations.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-8"
            {...cardMotion()}
          >
            <AddressControlsCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-4"
            {...cardMotion(0.05)}
          >
            <TeamsCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-4"
            {...cardMotion(0.1)}
          >
            <ApiCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-8"
            {...cardMotion(0.125)}
          >
            <IntegrationsCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-4"
            {...cardMotion(0.15)}
          >
            <AnalyticsCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-4"
            {...cardMotion(0.2)}
          >
            <CloudflareCard />
          </motion.div>

          <motion.div
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card lg:col-span-4"
            {...cardMotion(0.25)}
          >
            <SecurityCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CardHeader({
  icon,
  iconNode,
  title,
  description,
}: {
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
  iconNode?: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="px-6 pt-4 pb-5">
      <div className="flex items-center gap-2.5">
        {iconNode ??
          (icon ? (
            <HugeiconsIcon
              icon={icon}
              className="size-4 text-muted-foreground"
            />
          ) : null)}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function AddressControlsCard() {
  return (
    <>
      <CardHeader
        icon={MailIcon}
        title="Address controls"
        description="Create addresses with TTL, domain allowlists, and configurable inbox cleanup behavior."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="space-y-2.5 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-muted-foreground/60">
              Address
            </span>
            <div className="flex-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-foreground">
              test-signup-flow@spinupmail.dev
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-3">
              <span className="w-16 shrink-0 text-muted-foreground/60">
                TTL
              </span>
              <div className="flex-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-foreground">
                120 minutes
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <span className="w-16 shrink-0 text-muted-foreground/60">
                Max
              </span>
              <div className="flex-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-foreground">
                25 emails
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-3">
              <span className="w-16 shrink-0 text-muted-foreground/60">
                Action
              </span>
              <div className="flex-1 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-foreground">
                cleanAll on limit
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3">
              <span className="w-16 shrink-0 text-muted-foreground/60">
                Allow
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {["gmail.com", "example.com"].map(domain => (
                  <span
                    key={domain}
                    className="rounded-lg border border-border/70 bg-background px-2 py-0.5"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TeamsCard() {
  const orgs = [
    {
      name: "Operations",
      members: 6,
      colors: ["#D4D4D8", "#A1A1AA", "#71717A", "#52525B", "#3F3F46"],
    },
    { name: "QA", members: 4, colors: ["#D4D4D8", "#A1A1AA", "#71717A"] },
    { name: "Support", members: 3, colors: ["#D4D4D8", "#A1A1AA", "#71717A"] },
  ];

  return (
    <>
      <CardHeader
        icon={UserMultipleIcon}
        title="Team workspaces"
        description="Role-based organizations, and shared inbox visibility keep projects isolated by default."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="space-y-3">
          {orgs.map(org => (
            <div
              key={org.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex -space-x-1.5">
                  {org.colors.map((color, index) => (
                    <div
                      key={`${org.name}-${index}`}
                      className="size-5 rounded-full ring-2 ring-card"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="truncate text-xs font-medium">{org.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {org.members} members
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ApiCard() {
  const endpoints = [
    { method: "POST", path: "/email-addresses", color: "text-foreground" },
    {
      method: "GET",
      path: "/emails?addressId=...",
      color: "text-muted-foreground",
    },
    {
      method: "GET",
      path: "/emails/:id/attachments/:attachmentId",
      color: "text-muted-foreground",
    },
    {
      method: "DEL",
      path: "/email-addresses/:id",
      color: "text-foreground/70",
    },
  ];

  return (
    <>
      <CardHeader
        icon={CodeIcon}
        title="REST API"
        description="Automate everything with API keys (`spin_...`) plus required `X-Org-Id` scoping."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="space-y-1.5 font-mono text-xs">
          {endpoints.map(endpoint => (
            <div key={endpoint.path} className="flex gap-2">
              <span className={`w-10 shrink-0 font-semibold ${endpoint.color}`}>
                {endpoint.method}
              </span>
              <span className="truncate text-muted-foreground">
                {endpoint.path}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AnalyticsCard() {
  const bars = [
    38, 47, 54, 41, 63, 69, 57, 76, 62, 73, 81, 66, 72, 84, 70, 88, 75, 79, 91,
    83,
  ];

  return (
    <>
      <CardHeader
        icon={LayoutIcon}
        title="Operational visibility"
        description="Track org-level email volume, inbox growth, and recent address activity from the dashboard."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="flex h-16 items-end gap-0.75">
          {bars.map((height, index) => (
            <div
              key={`bar-${index}`}
              className="flex-1 bg-muted-foreground/35 transition-colors hover:bg-muted-foreground/45"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/65">
          <span>14 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </>
  );
}

function IntegrationsCard() {
  const channels = [
    { name: "Telegram", desc: "Provider available" },
    { name: "email.received", desc: "Supported event" },
    { name: "Queue dispatch", desc: "Async delivery" },
  ];

  return (
    <>
      <CardHeader
        icon={ConnectIcon}
        title="Integrations"
        description="Route inbound email events to external notification channels with organization-scoped subscriptions. Events are dispatched asynchronously via Cloudflare Queues with retry controls."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="flex flex-wrap gap-2">
          {channels.map(channel => (
            <Badge
              key={channel.name}
              variant="outline"
              className="gap-1.5 border-border/70 py-1"
            >
              <span className="size-1.5 rounded-full bg-muted-foreground/70" />
              <span className="font-medium">{channel.name}</span>
              <span className="text-muted-foreground">{channel.desc}</span>
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}

function CloudflareCard() {
  const stack = [
    { name: "Workers", desc: "API + email handler" },
    { name: "Email Routing", desc: "Inbound delivery" },
    { name: "D1", desc: "Message metadata" },
    { name: "R2", desc: "Attachments/raw" },
    { name: "Pages", desc: "Frontend" },
  ];

  return (
    <>
      <CardHeader
        iconNode={
          <span className="inline-flex h-4 w-6 shrink-0 items-center justify-center text-muted-foreground">
            <CloudflareCloudIcon
              className="h-4 w-auto -mt-0.5"
              aria-hidden="true"
            />
          </span>
        }
        title="Cloudflare-native architecture"
        description="Run API, intake, storage, and frontend on Cloudflare services."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="flex flex-wrap gap-2">
          {stack.map(service => (
            <Badge
              key={service.name}
              variant="outline"
              className="gap-1.5 border-border/70 py-1"
            >
              <span className="size-1.5 rounded-full bg-muted-foreground/70" />
              <span className="font-medium">{service.name}</span>
              <span className="text-muted-foreground">{service.desc}</span>
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}

function SecurityCard() {
  const features = [
    "Turnstile protection",
    "Email verification",
    "Two-factor auth",
    "Scoped API keys",
    "Rate limiting",
  ];

  return (
    <>
      <CardHeader
        icon={ShieldIcon}
        title="Security defaults"
        description="Guardrails for identity, abuse prevention, and access control are available out of the box."
      />
      <div className="mt-auto border-t border-border/60 bg-muted/20 px-6 py-5">
        <div className="flex flex-wrap gap-1.5">
          {features.map(feature => (
            <Badge
              key={feature}
              variant="secondary"
              className="bg-secondary/75 text-[11px]"
            >
              {feature}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}
