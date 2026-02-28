import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { landingLinks } from "@/lib/links";

const ease = [0.16, 1, 0.3, 1] as const;

const highlights = [
  "Create and update temporary addresses",
  "List messages with org-scoped headers",
  "Download attachment binaries securely",
  "Use API keys with required X-Org-Id scope",
] as const;

const codeExample = `# Create a disposable address
curl -X POST /api/email-addresses \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "localPart": "signup-test",
    "domain": "spinupmail.dev",
    "ttlMinutes": 120,
    "acceptedRiskNotice": true
  }'

# List emails for an address
curl "/api/emails?addressId=addr_123" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123"

# Download an attachment
curl -L "/api/emails/mail_123/attachments/att_987" \\
  -H "X-API-Key: spin_..." \\
  -H "X-Org-Id: org_abc123" \\
  --output attachment.bin`;

export function ApiShowcase() {
  const reduceMotion = useReducedMotion();
  const apiDocsRender = landingLinks.apiDocs.startsWith("http") ? (
    <a href={landingLinks.apiDocs} target="_blank" rel="noreferrer" />
  ) : (
    <Link to="/docs/$slug" params={{ slug: "email-addresses" }} />
  );

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
            <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <div className="size-2.5 rounded-full bg-muted-foreground/20" />
              <span className="ml-2 text-xs text-muted-foreground">
                terminal
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <pre className="font-mono text-[13px] leading-relaxed text-muted-foreground">
                <code>{codeExample}</code>
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
