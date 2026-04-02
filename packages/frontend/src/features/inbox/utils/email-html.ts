import * as csstree from "css-tree";
import createDOMPurify from "dompurify";
import { resolveApiUrl } from "@/lib/api";

const CONFIGURED_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const EMAIL_ALLOWED_TAGS = [
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
  "style",
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

const EMAIL_ALLOWED_ATTRIBUTES = [
  "align",
  "alt",
  "background",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "class",
  "color",
  "colspan",
  "content",
  "dir",
  "height",
  "href",
  "id",
  "lang",
  "name",
  "nowrap",
  "poster",
  "rel",
  "role",
  "rowspan",
  "span",
  "src",
  "srcset",
  "start",
  "style",
  "target",
  "title",
  "type",
  "valign",
  "width",
];

const BLOCKED_CSS_ATRULES = new Set(["font-face", "import", "namespace"]);
const ALLOWED_NESTED_CSS_ATRULES = new Set(["media", "supports"]);
const BLOCKED_CSS_PROPERTIES = new Set(["behavior", "-moz-binding"]);
const REMOTE_CONTENT_ATTRIBUTES = ["background", "poster", "src"] as const;
const HOST_STYLES = `
  :host {
    contain: inline-size;
    display: block;
    color: inherit;
    height: 100%;
    max-width: 100%;
    min-width: 0;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  [data-email-content-root] {
    min-height: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 0.75rem;
    width: 100%;
  }

  html,
  body {
    margin: 0;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  img {
    display: block;
    height: auto;
    max-width: 100%;
  }

  pre {
    overflow-x: auto;
    white-space: pre-wrap;
  }

  table {
    max-width: 100%;
  }

  blockquote {
    margin-inline: 0;
  }
`;

type CssSanitizeOptions = {
  allowRemoteUrls: boolean;
  onRemoteBlocked: () => void;
};

type PreparedEmailHtml = {
  fragment: DocumentFragment;
  remoteContentBlocked: boolean;
};

const buildList = <TData>(items: TData[]) =>
  new csstree.List<TData>().fromArray(items);

const normalizeCssUrl = (value: string) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const isRemoteUrl = (value: string) =>
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("//");

const isInternalUrl = (value: string) =>
  value.startsWith("/") ||
  value.startsWith("./") ||
  value.startsWith("../") ||
  value.startsWith("#");

const hasExplicitScheme = (value: string) => /^[a-z][a-z0-9+.-]*:/i.test(value);

const hasAbsoluteApiBase =
  CONFIGURED_API_BASE.startsWith("http://") ||
  CONFIGURED_API_BASE.startsWith("https://") ||
  CONFIGURED_API_BASE.startsWith("//");

const toAbsoluteAssetUrl = (value: string) =>
  value.startsWith("/api/") && hasAbsoluteApiBase
    ? resolveApiUrl(value)
    : value;

const sanitizeRemoteAssetUrl = (
  value: string,
  allowRemoteUrls: boolean,
  onRemoteBlocked: () => void
) => {
  const normalized = normalizeCssUrl(value);
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("data:")) return normalized;
  if (isInternalUrl(normalized)) return toAbsoluteAssetUrl(normalized);
  if (lowered.startsWith("cid:")) return null;

  if (isRemoteUrl(lowered)) {
    if (allowRemoteUrls) return normalized;
    onRemoteBlocked();
    return null;
  }

  if (hasExplicitScheme(lowered)) return null;
  return normalized;
};

type SrcsetCandidate = {
  descriptor: string;
  url: string;
};

const SRCSET_DESCRIPTOR_PATTERN = /^\d+(?:\.\d+)?[wx]$/i;

const parseSrcsetCandidate = (value: string): SrcsetCandidate | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return {
      descriptor: "",
      url: parts[0] ?? "",
    };
  }

  if (parts.length === 2 && SRCSET_DESCRIPTOR_PATTERN.test(parts[1] ?? "")) {
    return {
      descriptor: parts[1] ?? "",
      url: parts[0] ?? "",
    };
  }

  return null;
};

const parseSrcset = (value: string) => {
  const segments = value.split(",");
  const candidates: SrcsetCandidate[] = [];
  let buffer = "";

  for (const segment of segments) {
    buffer = buffer ? `${buffer},${segment}` : segment;

    const candidate = parseSrcsetCandidate(buffer);
    if (!candidate) continue;

    if (
      candidate.url.toLowerCase().startsWith("data:") &&
      !candidate.url.includes(",")
    ) {
      continue;
    }

    candidates.push(candidate);
    buffer = "";
  }

  if (buffer.trim()) {
    const candidate = parseSrcsetCandidate(buffer);
    if (!candidate) return null;
    candidates.push(candidate);
  }

  return candidates;
};

const sanitizeSrcset = (
  value: string,
  allowRemoteUrls: boolean,
  onRemoteBlocked: () => void
) => {
  const candidates = parseSrcset(value);
  if (!candidates || candidates.length === 0) return null;

  const sanitizedCandidates = candidates.flatMap(candidate => {
    const safeUrl = sanitizeRemoteAssetUrl(
      candidate.url,
      allowRemoteUrls,
      onRemoteBlocked
    );
    if (!safeUrl) return [];

    return candidate.descriptor
      ? `${safeUrl} ${candidate.descriptor}`
      : safeUrl;
  });

  if (sanitizedCandidates.length === 0) return null;
  return sanitizedCandidates.join(", ");
};

const serializeCssUrl = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

const updateCssFunctionUrl = (node: csstree.FunctionNode, value: string) => {
  node.children = buildList<csstree.CssNode>([
    {
      type: "String",
      value: serializeCssUrl(value),
    },
  ]);
};

const sanitizeCssValue = (
  value: csstree.Value | csstree.Raw,
  property: string,
  options: CssSanitizeOptions
) => {
  if (value.type === "Raw") return null;

  let rejected = false;

  csstree.walk(value, {
    enter(node: csstree.CssNode) {
      if (node.type === "Function") {
        const functionName = node.name.toLowerCase();
        if (functionName === "expression") {
          rejected = true;
          return csstree.walk.break;
        }

        if (functionName === "url") {
          const rawUrl = csstree.generate(node);
          const innerValue = rawUrl.slice(4, -1);
          const safeUrl = sanitizeRemoteAssetUrl(
            innerValue,
            options.allowRemoteUrls,
            options.onRemoteBlocked
          );
          if (!safeUrl) {
            rejected = true;
            return csstree.walk.break;
          }
          updateCssFunctionUrl(node, safeUrl);
        }
      }

      if (node.type === "Url") {
        const safeUrl = sanitizeRemoteAssetUrl(
          node.value,
          options.allowRemoteUrls,
          options.onRemoteBlocked
        );
        if (!safeUrl) {
          rejected = true;
          return csstree.walk.break;
        }
        node.value = safeUrl;
      }

      return undefined;
    },
  });

  if (rejected) return null;
  if (property.startsWith("--")) return value;
  if (BLOCKED_CSS_PROPERTIES.has(property)) return null;
  return value;
};

const sanitizeDeclaration = (
  node: csstree.CssNode,
  options: CssSanitizeOptions
): csstree.Declaration | null => {
  if (node.type !== "Declaration") return null;

  const property = node.property.trim().toLowerCase();
  const sanitizedValue = sanitizeCssValue(node.value, property, options);
  if (!sanitizedValue) return null;

  node.value = sanitizedValue;
  return node;
};

const sanitizeCssBlock = (
  block: csstree.Block,
  options: CssSanitizeOptions
): csstree.Block | null => {
  const children: csstree.CssNode[] = [];

  for (const child of block.children.toArray()) {
    if (child.type === "Declaration") {
      const declaration = sanitizeDeclaration(child, options);
      if (declaration) children.push(declaration);
      continue;
    }

    if (child.type === "Rule") {
      const rule = sanitizeCssRule(child, options);
      if (rule) children.push(rule);
      continue;
    }

    if (child.type === "Atrule") {
      const atrule = sanitizeCssAtrule(child, options);
      if (atrule) children.push(atrule);
    }
  }

  if (children.length === 0) return null;
  block.children = buildList(children);
  return block;
};

const sanitizeCssRule = (
  rule: csstree.Rule,
  options: CssSanitizeOptions
): csstree.Rule | null => {
  const block = sanitizeCssBlock(rule.block, options);
  if (!block) return null;
  rule.block = block;
  return rule;
};

const sanitizeCssAtrule = (
  atrule: csstree.Atrule,
  options: CssSanitizeOptions
): csstree.Atrule | null => {
  const name = atrule.name.trim().toLowerCase();
  if (BLOCKED_CSS_ATRULES.has(name)) return null;
  if (!ALLOWED_NESTED_CSS_ATRULES.has(name)) return null;
  if (!atrule.block) return null;

  const block = sanitizeCssBlock(atrule.block, options);
  if (!block) return null;
  atrule.block = block;
  return atrule;
};

const sanitizeCssDeclarationBlock = (
  css: string,
  options: CssSanitizeOptions
) => {
  try {
    const parsed = csstree.parse(css, {
      context: "declarationList",
      parseValue: true,
    });

    if (parsed.type !== "DeclarationList") return "";

    const declarations = parsed.children
      .toArray()
      .map(node => sanitizeDeclaration(node, options))
      .filter((node): node is csstree.Declaration => Boolean(node));

    if (declarations.length === 0) return "";
    parsed.children = buildList(declarations);
    return csstree.generate(parsed);
  } catch {
    return "";
  }
};

const sanitizeCssStylesheet = (css: string, options: CssSanitizeOptions) => {
  try {
    const parsed = csstree.parse(css, {
      context: "stylesheet",
      parseValue: true,
    });

    if (parsed.type !== "StyleSheet") return "";

    const rules = parsed.children
      .toArray()
      .reduce<csstree.CssNode[]>((accumulator, node) => {
        if (node.type === "Rule") {
          const rule = sanitizeCssRule(node, options);
          if (rule) accumulator.push(rule);
          return accumulator;
        }
        if (node.type === "Atrule") {
          const atrule = sanitizeCssAtrule(node, options);
          if (atrule) accumulator.push(atrule);
        }
        return accumulator;
      }, []);

    if (rules.length === 0) return "";
    parsed.children = buildList<csstree.CssNode>(rules);
    return csstree.generate(parsed);
  } catch {
    return "";
  }
};

export const prepareEmailHtmlForRender = ({
  html,
  allowRemoteContent,
  ownerDocument,
}: {
  html: string;
  allowRemoteContent: boolean;
  ownerDocument: Document;
}): PreparedEmailHtml => {
  const fragment = ownerDocument.createDocumentFragment();
  const view = ownerDocument.defaultView;

  if (!view) {
    return { fragment, remoteContentBlocked: false };
  }

  let remoteContentBlocked = false;
  const onRemoteBlocked = () => {
    remoteContentBlocked = true;
  };

  const DOMPurify = createDOMPurify(view);
  const originalStyleByElement = new WeakMap<HTMLElement, string>();
  const originalStyleTagTextByElement = new WeakMap<HTMLElement, string>();
  const originalDocument = new view.DOMParser().parseFromString(
    html,
    "text/html"
  );

  originalDocument.querySelectorAll<HTMLElement>("*").forEach(element => {
    const styleValue = element.getAttribute("style");
    if (styleValue) {
      originalStyleByElement.set(element, styleValue);
      element.removeAttribute("style");
    }

    if (element.tagName.toLowerCase() === "style") {
      originalStyleTagTextByElement.set(element, element.textContent ?? "");
      element.textContent = "";
    }
  });

  const sanitizedRoot = DOMPurify.sanitize(originalDocument.documentElement, {
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTRIBUTES,
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
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
      : originalDocument;

  parsed.querySelectorAll<HTMLElement>("*").forEach(element => {
    const srcsetValue = element.getAttribute("srcset");
    if (srcsetValue) {
      const sanitizedSrcset = sanitizeSrcset(
        srcsetValue,
        allowRemoteContent,
        onRemoteBlocked
      );

      if (sanitizedSrcset) {
        element.setAttribute("srcset", sanitizedSrcset);
      } else {
        element.removeAttribute("srcset");
      }
    }

    const tagName = element.tagName.toLowerCase();
    if (tagName === "style") {
      const sanitizedCss = sanitizeCssStylesheet(
        originalStyleTagTextByElement.get(element) ?? element.textContent ?? "",
        {
          allowRemoteUrls: allowRemoteContent,
          onRemoteBlocked,
        }
      );

      if (sanitizedCss) {
        element.textContent = sanitizedCss;
      } else {
        element.remove();
      }
      return;
    }

    const styleValue =
      originalStyleByElement.get(element) ?? element.getAttribute("style");
    if (styleValue) {
      const sanitizedStyle = sanitizeCssDeclarationBlock(styleValue, {
        allowRemoteUrls: allowRemoteContent,
        onRemoteBlocked,
      });

      if (sanitizedStyle) {
        element.setAttribute("style", sanitizedStyle);
      } else {
        element.removeAttribute("style");
      }
    }

    for (const attributeName of REMOTE_CONTENT_ATTRIBUTES) {
      const value = element.getAttribute(attributeName);
      if (!value) continue;

      const safeUrl = sanitizeRemoteAssetUrl(
        value,
        allowRemoteContent,
        onRemoteBlocked
      );

      if (safeUrl) {
        element.setAttribute(attributeName, safeUrl);
      } else {
        element.removeAttribute(attributeName);
      }
    }

    if (tagName === "a") {
      const href = element.getAttribute("href");
      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        element.setAttribute("rel", "noopener noreferrer nofollow");
        element.setAttribute("target", "_blank");
      }
    }
  });

  const emailDocumentRoot =
    parsed.documentElement ?? parsed.body ?? parsed.head ?? null;

  if (emailDocumentRoot) {
    fragment.appendChild(ownerDocument.importNode(emailDocumentRoot, true));
  }

  return {
    fragment,
    remoteContentBlocked,
  };
};

export const getEmailRendererHostStyles = () => HOST_STYLES;
