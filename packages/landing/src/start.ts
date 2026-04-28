import { createMiddleware, createStart } from "@tanstack/react-start";

import {
  agentDiscovery,
  agentLinkHeader,
  createApiCatalog,
  createHomepageMarkdown,
  createOpenApiDocument,
  estimateMarkdownTokens,
} from "@/lib/agent-discovery";

export const acceptsMarkdown = (request: Request) => {
  const accept = request.headers.get("accept");
  if (!accept) return false;

  const ranges = accept.split(",").map((range, index) => {
    const [mediaRange, ...parameters] = range.split(";");
    const [type, subtype] = mediaRange.trim().toLowerCase().split("/", 2);

    const qParameter = parameters.find(parameter => {
      const [name] = parameter.trim().split("=", 1);
      return name.toLowerCase() === "q";
    });

    const [, rawQuality = "1"] = qParameter?.split("=", 2) ?? [];
    const quality = Number.parseFloat(rawQuality.trim());

    return {
      type,
      subtype,
      index,
      quality: Number.isFinite(quality) ? quality : 0,
    };
  });

  const qualityFor = (type: string, subtype: string, minSpecificity = 0) => {
    const matches = ranges
      .map(range => {
        const typeMatches = range.type === type || range.type === "*";
        const subtypeMatches =
          range.subtype === subtype || range.subtype === "*";

        if (!typeMatches || !subtypeMatches) return null;

        const specificity =
          (range.type === type ? 1 : 0) + (range.subtype === subtype ? 1 : 0);

        return {
          specificity,
          quality: range.quality,
          index: range.index,
        };
      })
      .filter(match => match !== null)
      .sort((a, b) => b.specificity - a.specificity || a.index - b.index);

    const match = matches.at(0);
    return match && match.specificity >= minSpecificity ? match.quality : 0;
  };

  const markdownQuality = qualityFor("text", "markdown", 2);
  const htmlQuality = qualityFor("text", "html");

  return markdownQuality > 0 && markdownQuality > htmlQuality;
};

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
