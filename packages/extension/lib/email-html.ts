import createDOMPurify from "dompurify";
import type { ExtensionConnection } from "@/lib/types";
import { extensionApi, normalizeBaseUrl, resolveApiUrl } from "@/lib/api";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "body",
  "br",
  "caption",
  "center",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "hr",
  "html",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "u",
  "ul",
];

const ALLOWED_ATTRIBUTES = [
  "align",
  "alt",
  "background",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "colspan",
  "content",
  "dir",
  "height",
  "href",
  "lang",
  "poster",
  "rel",
  "role",
  "rowspan",
  "src",
  "srcset",
  "target",
  "title",
  "type",
  "valign",
  "width",
];

const REMOTE_ATTRIBUTES = ["background", "poster", "src"] as const;
const HOST_STYLES = `
  :host {
    display: block;
    min-width: 0;
    max-width: 100%;
    color: inherit;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  [data-email-content-root] {
    min-height: 100%;
    padding: 0.75rem;
    width: 100%;
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  html,
  body {
    margin: 0;
    max-width: 100%;
    min-width: 0;
  }

  img {
    display: block;
    max-width: 100%;
    height: auto;
  }

  pre {
    overflow-x: auto;
    white-space: pre-wrap;
  }

  table {
    max-width: 100%;
  }
`;

const normalizeAssetUrl = (value: string) => value.trim();
const isRemoteUrl = (value: string) =>
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("//");

const isInternalApiPath = (value: string) => value.startsWith("/api/");

const parseSrcset = (value: string) =>
  value
    .split(",")
    .map(segment => {
      const [url, descriptor] = segment.trim().split(/\s+/, 2);
      return { descriptor: descriptor ?? "", url: url ?? "" };
    })
    .filter(candidate => candidate.url.length > 0);

const serializeSrcset = (
  value: string,
  allowRemoteContent: boolean,
  onRemoteBlocked: () => void
) => {
  const sanitized = parseSrcset(value)
    .flatMap(candidate => {
      const normalized = normalizeAssetUrl(candidate.url);

      if (
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:") ||
        isInternalApiPath(normalized)
      ) {
        return candidate.descriptor
          ? `${normalized} ${candidate.descriptor}`
          : normalized;
      }

      if (isRemoteUrl(normalized)) {
        if (!allowRemoteContent) {
          onRemoteBlocked();
          return [];
        }

        return candidate.descriptor
          ? `${normalized} ${candidate.descriptor}`
          : normalized;
      }

      return [];
    })
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized.join(", ") : null;
};

const sanitizeHtmlDocument = ({
  allowRemoteContent,
  html,
  ownerDocument,
}: {
  allowRemoteContent: boolean;
  html: string;
  ownerDocument: Document;
}) => {
  const fragment = ownerDocument.createDocumentFragment();
  const view = ownerDocument.defaultView;

  if (!view) {
    return {
      fragment,
      remoteContentBlocked: false,
    };
  }

  let remoteContentBlocked = false;
  const onRemoteBlocked = () => {
    remoteContentBlocked = true;
  };

  const DOMPurify = createDOMPurify(view);
  const document = new view.DOMParser().parseFromString(html, "text/html");
  const sanitizedRoot = DOMPurify.sanitize(document.documentElement, {
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORCE_BODY: true,
    IN_PLACE: true,
    RETURN_DOM: true,
    WHOLE_DOCUMENT: true,
  });

  const parsed =
    sanitizedRoot instanceof view.HTMLHtmlElement
      ? sanitizedRoot.ownerDocument
      : document;

  parsed.querySelectorAll<HTMLElement>("*").forEach(element => {
    const srcset = element.getAttribute("srcset");
    if (srcset) {
      const sanitizedSrcset = serializeSrcset(
        srcset,
        allowRemoteContent,
        onRemoteBlocked
      );

      if (sanitizedSrcset) {
        element.setAttribute("srcset", sanitizedSrcset);
      } else {
        element.removeAttribute("srcset");
      }
    }

    for (const attributeName of REMOTE_ATTRIBUTES) {
      const value = element.getAttribute(attributeName);
      if (!value) continue;

      const normalized = normalizeAssetUrl(value);
      if (
        normalized.startsWith("data:") ||
        normalized.startsWith("blob:") ||
        normalized.startsWith("cid:") ||
        isInternalApiPath(normalized)
      ) {
        if (normalized.startsWith("cid:")) {
          element.removeAttribute(attributeName);
        }
        continue;
      }

      if (isRemoteUrl(normalized) && !allowRemoteContent) {
        onRemoteBlocked();
        element.removeAttribute(attributeName);
      }
    }

    if (element.tagName.toLowerCase() === "a") {
      const href = element.getAttribute("href");
      if (href?.startsWith("http")) {
        element.setAttribute("rel", "noopener noreferrer nofollow");
        element.setAttribute("target", "_blank");
      }
    }
  });

  fragment.appendChild(ownerDocument.importNode(parsed.documentElement, true));

  return {
    fragment,
    remoteContentBlocked,
  };
};

const collectInternalAssetTargets = (document: Document) => {
  const targets: Array<{
    attribute: "background" | "poster" | "src";
    element: Element;
    path: string;
  }> = [];

  document.querySelectorAll<HTMLElement>("*").forEach(element => {
    for (const attribute of REMOTE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;

      const normalized = normalizeAssetUrl(value);
      if (isInternalApiPath(normalized)) {
        targets.push({
          attribute,
          element,
          path: normalized,
        });
      }
    }
  });

  document.querySelectorAll<HTMLElement>("[srcset]").forEach(element => {
    const srcset = element.getAttribute("srcset");
    if (!srcset) return;

    const rewritten = parseSrcset(srcset).map(candidate => candidate.url);
    if (!rewritten.some(isInternalApiPath)) return;
  });

  return targets;
};

export const hydrateEmailHtmlAssets = async ({
  connection,
  html,
  organizationId,
}: {
  connection: ExtensionConnection;
  html: string;
  organizationId: string;
}) => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const targets = collectInternalAssetTargets(document);
  const objectUrls: string[] = [];
  const assetCache = new Map<string, string>();

  await Promise.all(
    targets.map(async target => {
      let objectUrl = assetCache.get(target.path);

      if (!objectUrl) {
        try {
          const blob = await extensionApi.fetchBlob(connection, {
            organizationId,
            path: target.path,
          });
          objectUrl = URL.createObjectURL(blob);
          assetCache.set(target.path, objectUrl);
          objectUrls.push(objectUrl);
        } catch {
          objectUrl = resolveApiUrl(connection.baseUrl, target.path);
        }
      }

      target.element.setAttribute(target.attribute, objectUrl);
    })
  );

  return {
    html: document.documentElement.outerHTML,
    revoke: () => {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    },
  };
};

export const getEmailRendererHostStyles = () => HOST_STYLES;

export const prepareEmailHtmlForRender = sanitizeHtmlDocument;

export const isApiUrlForConnection = (
  value: string,
  connection: ExtensionConnection
) => {
  try {
    const url = new URL(value, connection.baseUrl);
    return (
      normalizeBaseUrl(url.origin) === normalizeBaseUrl(connection.baseUrl)
    );
  } catch {
    return false;
  }
};
