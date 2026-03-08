import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Self-host disposable emails on Cloudflare | SpinupMail",
      },
      {
        name: "description",
        content:
          "Create unlimited, highly configurable email addresses with attachment support for you/your team, hosted on Cloudflare.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: RootNotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center px-6 py-16 text-foreground">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
        The page you requested does not exist or may have been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          to="/"
          className="inline-flex border border-border/70 bg-background px-3 py-1.5 text-xs text-foreground"
        >
          Go home
        </Link>
        <Link
          to="/docs"
          className="inline-flex border border-border/70 bg-background px-3 py-1.5 text-xs text-foreground"
        >
          Open docs
        </Link>
      </div>
    </main>
  );
}
