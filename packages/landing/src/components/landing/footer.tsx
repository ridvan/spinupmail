import { motion, useReducedMotion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { landingLinks } from "@/lib/links";

const ease = [0.16, 1, 0.3, 1] as const;

export function Footer() {
  const reduceMotion = useReducedMotion();
  const isInternalDocs = !landingLinks.docs.startsWith("http");
  const isInternalApiDocs = !landingLinks.apiDocs.startsWith("http");

  return (
    <motion.footer
      className="border-t border-border/60 py-8"
      {...(reduceMotion
        ? {}
        : {
            initial: { opacity: 0 },
            whileInView: { opacity: 1 },
            viewport: { once: true },
            transition: { duration: 0.55, ease },
          })}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Spinupmail
        </span>

        <div className="flex items-center gap-4">
          <a
            href={landingLinks.github}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          {isInternalDocs ? (
            <Link
              to="/docs"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Documentation
            </Link>
          ) : (
            <a
              href={landingLinks.docs}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Documentation
            </a>
          )}

          {isInternalApiDocs ? (
            <Link
              to="/docs/$slug"
              params={{ slug: "email-addresses" }}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              API Usage
            </Link>
          ) : (
            <a
              href={landingLinks.apiDocs}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              API Usage
            </a>
          )}
        </div>
      </div>
    </motion.footer>
  );
}
