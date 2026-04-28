import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  agentDiscovery,
  agentLinkHeader,
  createApiCatalog,
  createHomepageMarkdown,
  createOpenApiDocument,
  estimateMarkdownTokens,
} from "@/lib/agent-discovery";

const acceptsMarkdown = (request: Request) =>
  request.headers.get("accept")?.toLowerCase().includes("text/markdown") ??
  false;

const AGENT_RESPONSE_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";

const mergeHeader = (headers: Headers, name: string, value: string) => {
  const existing = headers.get(name);
  headers.set(name, existing ? `${existing}, ${value}` : value);
};

const jsonResponse = (
  request: Request,
  body: unknown,
  contentType: string,
  extraHeaders?: HeadersInit
) => {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", AGENT_RESPONSE_CACHE_CONTROL);

  return new Response(
    request.method === "HEAD" ? null : JSON.stringify(body, null, 2),
    {
      headers,
    }
  );
};

const markdownResponse = (request: Request) => {
  const markdown = createHomepageMarkdown();
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Signal": agentDiscovery.contentSignal,
    "Cache-Control": AGENT_RESPONSE_CACHE_CONTROL,
    Link: agentLinkHeader,
    Vary: "Accept",
    "x-markdown-tokens": estimateMarkdownTokens(markdown),
  });

  return new Response(request.method === "HEAD" ? null : markdown, {
    headers,
  });
};

const agentDiscoveryMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const url = new URL(request.url);

    if (
      url.pathname === agentDiscovery.apiCatalogPath &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return jsonResponse(
        request,
        createApiCatalog(),
        "application/linkset+json; charset=utf-8"
      );
    }

    if (
      url.pathname === agentDiscovery.openApiPath &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      return jsonResponse(
        request,
        createOpenApiDocument(),
        "application/vnd.oai.openapi+json; charset=utf-8"
      );
    }

    if (
      url.pathname === "/" &&
      (request.method === "GET" || request.method === "HEAD") &&
      acceptsMarkdown(request)
    ) {
      return markdownResponse(request);
    }

    const result = await next();

    if (url.pathname !== "/") {
      return result;
    }

    const headers = new Headers(result.response.headers);
    mergeHeader(headers, "Link", agentLinkHeader);
    mergeHeader(headers, "Vary", "Accept");
    headers.set("Content-Signal", agentDiscovery.contentSignal);

    return {
      ...result,
      response: new Response(result.response.body, {
        status: result.response.status,
        statusText: result.response.statusText,
        headers,
      }),
    };
  }
);

export const startInstance = createStart(() => ({
  requestMiddleware: [agentDiscoveryMiddleware],
}));
