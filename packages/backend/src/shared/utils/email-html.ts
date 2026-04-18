import * as csstree from "css-tree";
import render from "dom-serializer";
import { parseDocument } from "htmlparser2";
import { createRequire } from "node:module";

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

const EMAIL_GLOBAL_ALLOWED_ATTRIBUTES = [
  "align",
  "background",
  "bgcolor",
  "border",
  "class",
  "color",
  "dir",
  "height",
  "id",
  "lang",
  "role",
  "style",
  "title",
  "valign",
  "width",
];

const BLOCKED_CSS_ATRULES = new Set(["font-face", "import", "namespace"]);
const ALLOWED_NESTED_CSS_ATRULES = new Set(["media", "supports"]);
const BLOCKED_CSS_PROPERTIES = new Set(["behavior", "-moz-binding"]);
const SAFE_INLINE_IMAGE_CONTENT_TYPES = new Set([
  "image/apng",
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type CssSanitizeOptions = {
  allowRemoteUrls?: boolean;
  rewriteUrl?: ((value: string) => string | null) | undefined;
};

type InlineAttachment = {
  contentId: string | null;
  contentType: string;
  inlinePath: string;
};

type SrcsetCandidate = {
  descriptor: string;
  url: string;
};

type HtmlNode = {
  attribs?: Record<string, string>;
  children?: HtmlNode[];
  data?: string;
  name?: string;
  type: string;
};

type HtmlElement = HtmlNode & {
  attribs: Record<string, string>;
  children: HtmlNode[];
  name: string;
};

type HtmlDocument = {
  children: HtmlNode[];
};

const require = createRequire(
  import.meta.url ?? "file:///spinupmail/backend/src/shared/utils/email-html.ts"
);

const buildList = <TData>(items: TData[]) =>
  new csstree.List<TData>().fromArray(items);

const isElementNode = (node: HtmlNode): node is HtmlElement =>
  node.type === "style" || node.type === "script" || node.type === "tag";

const normalizeContentId = (value: string) => {
  const trimmed = value.trim();
  const withoutBrackets =
    trimmed.startsWith("<") && trimmed.endsWith(">")
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutBrackets.trim().toLowerCase();
};

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

const SRCSET_DESCRIPTOR_PATTERN = /^\d+(?:\.\d+)?[wx]$/i;

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

const sanitizeCssUrl = (value: string, options: CssSanitizeOptions) => {
  const normalized = normalizeCssUrl(value);
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  const rewritten = options.rewriteUrl?.(normalized);
  if (rewritten !== undefined) {
    return rewritten;
  }

  if (lowered.startsWith("data:")) return normalized;
  if (lowered.startsWith("cid:")) return normalized;
  if (isInternalUrl(normalized)) return normalized;
  if (isRemoteUrl(lowered)) {
    return options.allowRemoteUrls ? normalized : null;
  }
  if (hasExplicitScheme(lowered)) return null;

  return normalized;
};

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

const sanitizeSrcset = (value: string, options: CssSanitizeOptions) => {
  const candidates = parseSrcset(value);
  if (!candidates || candidates.length === 0) return null;

  const sanitizedCandidates = candidates.flatMap(candidate => {
    const safeUrl = sanitizeCssUrl(candidate.url, options);
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
          const safeUrl = sanitizeCssUrl(innerValue, options);
          if (!safeUrl) {
            rejected = true;
            return csstree.walk.break;
          }
          updateCssFunctionUrl(node, safeUrl);
        }
        return undefined;
      }

      if (node.type === "Url") {
        const safeUrl = sanitizeCssUrl(node.value, options);
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
  const nextChildren: csstree.CssNode[] = [];

  for (const child of block.children.toArray()) {
    if (child.type === "Declaration") {
      const declaration = sanitizeDeclaration(child, options);
      if (declaration) {
        nextChildren.push(declaration);
      }
      continue;
    }

    if (child.type === "Rule") {
      const rule = sanitizeCssRule(child, options);
      if (rule) {
        nextChildren.push(rule);
      }
      continue;
    }

    if (child.type === "Atrule") {
      const atrule = sanitizeCssAtrule(child, options);
      if (atrule) {
        nextChildren.push(atrule);
      }
    }
  }

  if (nextChildren.length === 0) return null;
  block.children = buildList(nextChildren);
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

export const sanitizeCssDeclarationBlock = (
  css: string,
  options: CssSanitizeOptions = {}
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

export const sanitizeCssStylesheet = (
  css: string,
  options: CssSanitizeOptions = {}
) => {
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

const sanitizeStyleAttribute = (
  element: HtmlElement,
  options: CssSanitizeOptions
) => {
  const styleValue = element.attribs.style;
  if (!styleValue) return;

  const sanitizedStyle = sanitizeCssDeclarationBlock(styleValue, options);
  if (sanitizedStyle) {
    element.attribs.style = sanitizedStyle;
    return;
  }

  delete element.attribs.style;
};

const buildStyleTextNodes = (css: string) => {
  const document = parseDocument(
    `<style>${css}</style>`
  ) as unknown as HtmlDocument;
  const styleNode = document.children.find(
    node => isElementNode(node) && node.name === "style"
  );

  return styleNode && isElementNode(styleNode) ? styleNode.children : [];
};

const sanitizeStyleElement = (
  element: HtmlElement,
  options: CssSanitizeOptions
): boolean => {
  const css = element.children
    .map(child =>
      typeof child.data === "string"
        ? child.data
        : render(child as Parameters<typeof render>[0])
    )
    .join("");
  const sanitizedCss = sanitizeCssStylesheet(css, options);
  if (!sanitizedCss) return false;
  element.children = buildStyleTextNodes(sanitizedCss);
  return true;
};

const rewriteHtmlAssetAttribute = (
  element: HtmlElement,
  attributeName: "background" | "poster" | "src",
  rewriteUrl?: ((value: string) => string | null) | undefined
) => {
  const attributeValue = element.attribs[attributeName];
  if (!attributeValue || !rewriteUrl) return;

  const rewritten = rewriteUrl(attributeValue);
  if (rewritten) {
    element.attribs[attributeName] = rewritten;
    return;
  }

  delete element.attribs[attributeName];
};

const rewriteHtmlSrcsetAttribute = (
  element: HtmlElement,
  options: CssSanitizeOptions
) => {
  const attributeValue = element.attribs.srcset;
  if (!attributeValue) return;

  const sanitized = sanitizeSrcset(attributeValue, options);
  if (sanitized) {
    element.attribs.srcset = sanitized;
    return;
  }

  delete element.attribs.srcset;
};

const transformHtmlChildren = (
  nodes: HtmlNode[],
  options: CssSanitizeOptions
): HtmlNode[] => {
  const nextChildren: HtmlNode[] = [];

  for (const node of nodes) {
    if (!isElementNode(node)) {
      nextChildren.push(node);
      continue;
    }

    node.children = transformHtmlChildren(node.children ?? [], options);
    sanitizeStyleAttribute(node, options);

    rewriteHtmlSrcsetAttribute(node, options);

    rewriteHtmlAssetAttribute(node, "background", options.rewriteUrl);
    rewriteHtmlAssetAttribute(node, "poster", options.rewriteUrl);
    rewriteHtmlAssetAttribute(node, "src", options.rewriteUrl);

    if (node.name === "style" && !sanitizeStyleElement(node, options)) {
      continue;
    }

    nextChildren.push(node);
  }

  return nextChildren;
};

const serializeHtmlDocument = (document: HtmlDocument) =>
  render(document.children as unknown as Parameters<typeof render>[0], {
    decodeEntities: false,
    encodeEntities: "utf8",
  });

const transformHtmlDocument = (html: string, options: CssSanitizeOptions) => {
  const document = parseDocument(html, {
    decodeEntities: false,
    lowerCaseAttributeNames: false,
    lowerCaseTags: true,
    recognizeSelfClosing: true,
  }) as unknown as HtmlDocument;

  document.children = transformHtmlChildren(document.children, options);
  return serializeHtmlDocument(document);
};

export const isSafeInlineImageContentType = (
  contentType: string | null | undefined
) => {
  if (!contentType) return false;
  return SAFE_INLINE_IMAGE_CONTENT_TYPES.has(contentType.trim().toLowerCase());
};

export const sanitizeEmailHtml = (html: string) => {
  const sanitizeHtmlModule = require("sanitize-html") as
    | {
        default?: (dirty: string, options?: Record<string, unknown>) => string;
      }
    | ((dirty: string, options?: Record<string, unknown>) => string);
  const sanitizeHtml =
    typeof sanitizeHtmlModule === "function"
      ? sanitizeHtmlModule
      : (sanitizeHtmlModule.default ??
        (() => {
          throw new TypeError("sanitize-html export not found");
        }));
  const sanitizedHtml = sanitizeHtml(html, {
    allowedTags: EMAIL_ALLOWED_TAGS,
    allowedAttributes: {
      "*": EMAIL_GLOBAL_ALLOWED_ATTRIBUTES,
      a: ["href", "name", "rel", "target", "title"],
      col: ["span"],
      img: ["alt", "border", "height", "src", "srcset", "title", "width"],
      ol: ["start", "type"],
      table: ["cellpadding", "cellspacing"],
      td: ["cellpadding", "cellspacing", "colspan", "nowrap", "rowspan"],
      th: ["cellpadding", "cellspacing", "colspan", "nowrap", "rowspan"],
      ul: ["type"],
    },
    allowedSchemes: ["cid", "data", "http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["background", "href", "poster", "src"],
    allowedSchemesByTag: {
      img: ["cid", "data", "http", "https"],
    },
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: false,
    parseStyleAttributes: false,
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    },
  });

  return transformHtmlDocument(sanitizedHtml, {
    allowRemoteUrls: true,
  });
};

export const rewriteEmailHtmlForRendering = (
  html: string,
  attachments: InlineAttachment[]
) => {
  const inlinePathByContentId = new Map<string, string>();

  for (const attachment of attachments) {
    if (!attachment.contentId) continue;
    if (!isSafeInlineImageContentType(attachment.contentType)) continue;
    inlinePathByContentId.set(
      normalizeContentId(attachment.contentId),
      attachment.inlinePath
    );
  }

  if (inlinePathByContentId.size === 0) {
    return transformHtmlDocument(html, {
      allowRemoteUrls: true,
      rewriteUrl: value =>
        value.trim().toLowerCase().startsWith("cid:") ? null : value,
    });
  }

  return transformHtmlDocument(html, {
    allowRemoteUrls: true,
    rewriteUrl: value => {
      const trimmed = value.trim();
      if (!trimmed.toLowerCase().startsWith("cid:")) {
        return trimmed;
      }

      const contentId = normalizeContentId(trimmed.slice(4));
      return inlinePathByContentId.get(contentId) ?? null;
    },
  });
};
