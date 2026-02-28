import {
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { DocsLayout } from "@/components/docs/docs-layout";
import {
  buildDocToc,
  getDocPageBySlug,
} from "@/components/docs/content/docs-content";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      {
        title: "Spinupmail Docs",
      },
      {
        name: "description",
        content:
          "Spinupmail documentation for setup, Cloudflare resources, auth, API usage, and production operations.",
      },
    ],
  }),
  component: DocsRoute,
});

function DocsRoute() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const slug = pathname.startsWith("/docs/")
    ? pathname.split("/").filter(Boolean)[1]
    : undefined;
  const page = slug ? getDocPageBySlug(slug) : undefined;
  const headings = page ? buildDocToc(page) : [];

  return (
    <DocsLayout currentSlug={slug} headings={headings}>
      <Outlet />
    </DocsLayout>
  );
}
