import { docPages } from "./docs-content";
import type { DocPage } from "./docs-content";

export type SearchDocument = {
  id: string;
  slug: string;
  sectionId?: string;
  href: string;
  title: string;
  heading?: string;
  body: string;
  code: string;
  keywords: Array<string>;
};

export type SearchResult = {
  document: SearchDocument;
  score: number;
  snippet: string;
};

const overviewDocument: SearchDocument = {
  id: "overview",
  slug: "overview",
  href: "/docs",
  title: "Spinupmail Documentation",
  body: "Get started with setup, configuration, API usage, operations, and security guidance for Spinupmail.",
  code: "",
  keywords: ["docs", "overview", "spinupmail", "setup"],
};

function compactText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildSearchDocuments(
  pages: Array<DocPage> = docPages
): Array<SearchDocument> {
  const docs: Array<SearchDocument> = [overviewDocument];

  for (const page of pages) {
    const headingTitles = page.headings.map(heading => heading.title).join(" ");
    const pageBody = compactText(
      page.description,
      page.summary,
      headingTitles,
      page.searchText
    );

    docs.push({
      id: `${page.slug}::page`,
      slug: page.slug,
      href: `/docs/${page.slug}`,
      title: page.title,
      body: pageBody,
      code: page.codeText,
      keywords: page.keywords,
    });

    for (const heading of page.headings) {
      docs.push({
        id: `${page.slug}::${heading.id}`,
        slug: page.slug,
        sectionId: heading.id,
        href: `/docs/${page.slug}#${heading.id}`,
        title: page.title,
        heading: heading.title,
        body: compactText(heading.title, page.description, page.searchText),
        code: page.codeText,
        keywords: page.keywords,
      });
    }
  }

  return docs;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function toTerms(query: string): Array<string> {
  return normalize(query)
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);
}

function scoreDocument(document: SearchDocument, terms: Array<string>): number {
  if (terms.length === 0) return 0;

  const title = normalize(document.title);
  const heading = normalize(document.heading ?? "");
  const body = normalize(document.body);
  const code = normalize(document.code);
  const keywords = normalize(document.keywords.join(" "));

  let score = 0;
  let matchedTerms = 0;

  for (const term of terms) {
    let termMatched = false;

    if (title.startsWith(term)) {
      score += 80;
      termMatched = true;
    } else if (title.includes(term)) {
      score += 55;
      termMatched = true;
    }

    if (heading.startsWith(term)) {
      score += 45;
      termMatched = true;
    } else if (heading.includes(term)) {
      score += 34;
      termMatched = true;
    }

    if (keywords.includes(term)) {
      score += 26;
      termMatched = true;
    }

    if (body.includes(term)) {
      score += 16;
      termMatched = true;
    }

    if (code.includes(term)) {
      score += 8;
      termMatched = true;
    }

    if (termMatched) {
      matchedTerms += 1;
    }
  }

  if (matchedTerms === terms.length) {
    score += 20;
  }

  const phrase = terms.join(" ");
  if (phrase.length > 2) {
    if (title.includes(phrase)) {
      score += 35;
    } else if (heading.includes(phrase)) {
      score += 24;
    } else if (body.includes(phrase)) {
      score += 14;
    }
  }

  return score;
}

function makeSnippet(document: SearchDocument, terms: Array<string>): string {
  const source = [document.heading ?? "", document.body, document.code]
    .join(" ")
    .trim();

  if (!source) return document.title;

  const lowerSource = normalize(source);
  const firstMatchIndex = terms
    .map(term => lowerSource.indexOf(term))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)
    .at(0);

  if (firstMatchIndex === undefined) {
    return source.slice(0, 120);
  }

  const start = Math.max(0, firstMatchIndex - 42);
  const end = Math.min(source.length, firstMatchIndex + 98);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < source.length ? "..." : "";

  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

const SEARCH_LIMIT_DEFAULT = 12;

export function searchDocs(
  query: string,
  documents: Array<SearchDocument> = DOC_SEARCH_DOCUMENTS,
  limit = SEARCH_LIMIT_DEFAULT
): Array<SearchResult> {
  const terms = toTerms(query);

  if (terms.length === 0) {
    return documents.slice(0, limit).map(document => ({
      document,
      score: 0,
      snippet: document.body.slice(0, 120),
    }));
  }

  return documents
    .map(document => {
      const score = scoreDocument(document, terms);
      return {
        document,
        score,
        snippet: makeSnippet(document, terms),
      };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.document.href.localeCompare(right.document.href);
    })
    .slice(0, limit);
}

export const DOC_SEARCH_DOCUMENTS = buildSearchDocuments();
