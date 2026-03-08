import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { AnimatedTerminalLine } from "@/components/landing/animated-terminal-code";
import { AnimatedTerminalCode } from "@/components/landing/animated-terminal-code";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

const highlights = [
  "Create and update temporary addresses",
  "List messages with org-scoped headers",
  "Download attachment binaries securely",
  "Use API keys with required X-Org-Id scope",
] as const;

type TokenTone =
  | "base"
  | "muted"
  | "comment"
  | "flag"
  | "string"
  | "value"
  | "jsonKey";

type TerminalToken = {
  text: string;
  tone?: TokenTone;
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

type ApiExample = {
  id: string;
  label: string;
  method: "POST" | "GET" | "DELETE";
  path: string;
  note: string;
  lines: ReadonlyArray<TerminalLine>;
};

const methodBadgeClassName: Record<ApiExample["method"], string> = {
  GET: "border-foreground/18 text-foreground/72 dark:border-white/18 dark:text-white/72",
  POST: "border-foreground/18 text-foreground/72 dark:border-white/18 dark:text-white/72",
  DELETE:
    "border-foreground/18 text-foreground/72 dark:border-white/18 dark:text-white/72",
};

const toneClassName: Record<TokenTone, string> = {
  base: "text-foreground/90 dark:text-foreground/88",
  muted: "text-foreground/74 dark:text-muted-foreground/78",
  comment: "text-muted-foreground/72 dark:text-muted-foreground/42",
  flag: "text-foreground/68 dark:text-muted-foreground/62",
  string: "text-foreground/76 dark:text-foreground/72",
  value: "text-foreground/84 dark:text-foreground/82",
  jsonKey: "text-foreground/68 dark:text-muted-foreground/62",
};

const apiExamples: ReadonlyArray<ApiExample> = [
  {
    id: "create-address",
    label: "Create address",
    method: "POST",
    path: "/api/email-addresses",
    note: "Create an email address with TTL and sender controls.",
    lines: [
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "curl", tone: "base" },
          { text: " -X POST ", tone: "muted" },
          { text: "/api/email-addresses", tone: "value" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-API-Key: spin_..."', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-Org-Id: org_abc123"', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"Content-Type: application/json"', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -d ", tone: "flag" },
          { text: "'{", tone: "string" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: '    "localPart"', tone: "jsonKey" },
          { text: ": ", tone: "muted" },
          { text: '"signup-test"', tone: "string" },
          { text: ",", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: '    "domain"', tone: "jsonKey" },
          { text: ": ", tone: "muted" },
          { text: '"spinupmail.dev"', tone: "string" },
          { text: ",", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: '    "ttlMinutes"', tone: "jsonKey" },
          { text: ": ", tone: "muted" },
          { text: "120", tone: "value" },
          { text: ",", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: '    "acceptedRiskNotice"', tone: "jsonKey" },
          { text: ": ", tone: "muted" },
          { text: "true", tone: "value" },
        ],
      },
      {
        kind: "code",
        tokens: [{ text: "  }'", tone: "string" }],
      },
    ],
  },
  {
    id: "list-emails",
    label: "List emails",
    method: "GET",
    path: "/api/emails?addressId=addr_123",
    note: "Poll an inbox for CI, QA, or signup verification flows.",
    lines: [
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "curl", tone: "base" },
          { text: ' "/api/emails?addressId=addr_123"', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-API-Key: spin_..."', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-Org-Id: org_abc123"', tone: "string" },
        ],
      },
      { kind: "blank" },
      {
        kind: "code",
        tokens: [{ text: "# returns newest emails first", tone: "comment" }],
      },
      {
        kind: "code",
        tokens: [
          { text: "[{ id, from, subject, receivedAt }]", tone: "muted" },
        ],
      },
    ],
  },
  {
    id: "download-attachment",
    label: "Download",
    method: "GET",
    path: "/api/emails/mail_123/attachments/att_987",
    note: "Fetch raw binaries for test fixtures, receipts, or screenshots.",
    lines: [
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "curl", tone: "base" },
          { text: " -L ", tone: "muted" },
          {
            text: '"/api/emails/mail_123/attachments/att_987"',
            tone: "string",
          },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-API-Key: spin_..."', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-Org-Id: org_abc123"', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  --output ", tone: "flag" },
          { text: "attachment.bin", tone: "value" },
        ],
      },
    ],
  },
  {
    id: "delete-address",
    label: "Delete address",
    method: "DELETE",
    path: "/api/email-addresses/addr_123",
    note: "Clean up inboxes at the end of a test run or workflow.",
    lines: [
      {
        kind: "code",
        prompt: true,
        tokens: [
          { text: "curl", tone: "base" },
          { text: " -X DELETE ", tone: "muted" },
          { text: "/api/email-addresses/addr_123", tone: "value" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-API-Key: spin_..."', tone: "string" },
          { text: " \\", tone: "muted" },
        ],
      },
      {
        kind: "code",
        tokens: [
          { text: "  -H ", tone: "flag" },
          { text: '"X-Org-Id: org_abc123"', tone: "string" },
        ],
      },
      { kind: "blank" },
      {
        kind: "code",
        tokens: [{ text: "# 204 No Content", tone: "comment" }],
      },
    ],
  },
] as const;

export function ApiShowcase() {
  const reduceMotion = useReducedMotion();
  const [activeExampleId, setActiveExampleId] = useState<ApiExample["id"]>(
    apiExamples[0].id
  );

  const apiDocsRender = landingLinks.apiDocs.startsWith("http") ? (
    <a href={landingLinks.apiDocs} target="_blank" rel="noreferrer" />
  ) : (
    <Link to="/docs/$slug" params={{ slug: "api-overview" }} />
  );

  const activeExample =
    apiExamples.find(example => example.id === activeExampleId) ??
    apiExamples[0];

  return (
    <section id="api" className="border-t border-border/60 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-start gap-10 md:grid-cols-2 md:gap-14">
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, x: -24 },
                  whileInView: { opacity: 1, x: 0 },
                  viewport: { once: true, margin: "-80px" },
                  transition: { duration: 0.65, ease },
                })}
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              All actions available in the API
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Use the API for CI, QA harnesses, and scripted workflows with the
              same organization-scoped endpoints shown in the dashboard.
            </p>

            <ul className="mt-7 space-y-3">
              {highlights.map((item, index) => (
                <motion.li
                  key={item}
                  className="flex items-center gap-2.5 text-sm"
                  {...(reduceMotion
                    ? {}
                    : {
                        initial: { opacity: 0, x: -14 },
                        whileInView: { opacity: 1, x: 0 },
                        viewport: { once: true },
                        transition: {
                          duration: 0.45,
                          ease,
                          delay: 0.16 + index * 0.07,
                        },
                      })}
                >
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {item}
                </motion.li>
              ))}
            </ul>

            <div className="mt-7">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={apiDocsRender}
              >
                Read API Usage Docs
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
              </Button>
            </div>
          </motion.div>

          <motion.div
            className="overflow-hidden border border-border/70 bg-card"
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, x: 24 },
                  whileInView: { opacity: 1, x: 0 },
                  viewport: { once: true, margin: "-80px" },
                  transition: { duration: 0.65, ease, delay: 0.08 },
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
                aria-label="API examples"
                className="ml-auto flex flex-wrap items-center justify-end gap-1.5 max-sm:w-full max-sm:justify-start"
              >
                {apiExamples.map(example => {
                  const isActive = example.id === activeExample.id;

                  return (
                    <button
                      key={example.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`api-example-panel-${example.id}`}
                      id={`api-example-tab-${example.id}`}
                      onClick={() => setActiveExampleId(example.id)}
                      className={cn(
                        "border px-2.5 py-1 text-[11px] transition-colors",
                        isActive
                          ? "border-border/90 bg-background text-foreground"
                          : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {example.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              role="tabpanel"
              id={`api-example-panel-${activeExample.id}`}
              aria-labelledby={`api-example-tab-${activeExample.id}`}
              className="p-4"
            >
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px]">
                <span
                  className={cn(
                    "inline-flex border px-1.5 font-semibold tracking-[0.08em]",
                    methodBadgeClassName[activeExample.method]
                  )}
                >
                  {activeExample.method}
                </span>
                <span className="text-foreground/74 dark:text-muted-foreground/55">
                  {activeExample.path}
                </span>
              </div>

              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-foreground/62 dark:text-muted-foreground/55">
                {activeExample.note}
              </p>

              <AnimatedTerminalCode
                sequenceKey={activeExample.id}
                lines={
                  activeExample.lines as ReadonlyArray<AnimatedTerminalLine>
                }
                reduceMotion={!!reduceMotion}
                getToneClassName={tone =>
                  toneClassName[(tone as TokenTone | undefined) ?? "base"]
                }
                codeClassName="bg-background/60 px-4 whitespace-pre"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
