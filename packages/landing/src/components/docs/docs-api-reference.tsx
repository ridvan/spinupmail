import { startTransition, useEffect, useState } from "react";
import { getApiEndpointSpecById } from "./content/api-reference";
import { formatCodeLanguageLabel } from "./docs-code-meta";
import type { ReactNode } from "react";
import type {
  ApiEndpointSpec,
  ApiErrorSpec,
  ApiFieldSpec,
} from "./content/api-reference";
import {
  getDocsHighlighter,
  getDocsTheme,
  normalizeDocsLanguage,
} from "@/lib/docs-shiki";
import { cn } from "@/lib/utils";

const requirementTone: Record<string, string> = {
  required: "docs-api-chip docs-api-chip-required",
  optional: "docs-api-chip docs-api-chip-optional",
};

function ApiRequirementBadge({ required = false }: { required?: boolean }) {
  const label = required ? "Required" : "Optional";

  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-none border px-1.5 py-0.5 text-[11px] font-medium",
        requirementTone[required ? "required" : "optional"]
      )}
    >
      {label}
    </span>
  );
}

function ApiMethodBadge({ method }: { method: ApiEndpointSpec["method"] }) {
  const toneClassName = {
    GET: "docs-api-chip docs-api-method-badge docs-api-method-badge-get",
    POST: "docs-api-chip docs-api-method-badge docs-api-method-badge-post",
    PATCH: "docs-api-chip docs-api-method-badge docs-api-method-badge-patch",
    DELETE: "docs-api-chip docs-api-method-badge docs-api-method-badge-delete",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex rounded-none border px-1.5 py-0.5 font-mono text-[11px] font-semibold",
        toneClassName[method]
      )}
    >
      {method}
    </span>
  );
}

function ApiTableShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="docs-reference-table-wrap">
      <div className="docs-reference-table-header">
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ApiFieldTable({
  caption,
  fields,
  showRequirement = true,
}: {
  caption: string;
  fields: Array<ApiFieldSpec>;
  showRequirement?: boolean;
}) {
  if (fields.length === 0) return null;

  return (
    <ApiTableShell title={caption}>
      <table className="docs-reference-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Type</th>
            {showRequirement ? <th scope="col">Requirement</th> : null}
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(field => (
            <tr key={field.name}>
              <th scope="row">
                <code>{field.name}</code>
              </th>
              <td>
                <code>{field.type}</code>
              </td>
              {showRequirement ? (
                <td>
                  <ApiRequirementBadge required={field.required} />
                </td>
              ) : null}
              <td>
                <p>{field.description}</p>
                {field.defaultValue ? (
                  <p>
                    <strong>Default:</strong> <code>{field.defaultValue}</code>
                  </p>
                ) : null}
                {field.constraints ? (
                  <p>
                    <strong>Constraints:</strong> {field.constraints}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ApiTableShell>
  );
}

function ApiHeaderTable({ spec }: { spec: ApiEndpointSpec }) {
  return (
    <ApiTableShell title="Request headers">
      <table className="docs-reference-table">
        <caption className="sr-only">Request headers</caption>
        <thead>
          <tr>
            <th scope="col">Header</th>
            <th scope="col">Example</th>
            <th scope="col">Requirement</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {spec.auth.headers.map(header => (
            <tr key={header.name}>
              <th scope="row">
                <code>{header.name}</code>
              </th>
              <td>
                <code>{header.value}</code>
              </td>
              <td>
                <ApiRequirementBadge required={header.required} />
              </td>
              <td>{header.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ApiTableShell>
  );
}

function ApiErrorTable({ errors }: { errors: Array<ApiErrorSpec> }) {
  return (
    <ApiTableShell title="Common error responses">
      <table className="docs-reference-table">
        <caption className="sr-only">Common error responses</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Error</th>
            <th scope="col">When it happens</th>
          </tr>
        </thead>
        <tbody>
          {errors.map(error => (
            <tr key={`${error.status}-${error.error}`}>
              <th scope="row">
                <code>{error.status}</code>
              </th>
              <td>
                <code>{error.error}</code>
              </td>
              <td>{error.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ApiTableShell>
  );
}

function ApiCodePanel({
  code,
  language,
  title,
}: {
  code: string;
  language: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const languageLabel = formatCodeLanguageLabel(language);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const syncTheme = () => {
      setIsDark(root.classList.contains("dark"));
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const highlightCode = async () => {
      try {
        const highlighter = await getDocsHighlighter();
        const html = highlighter.codeToHtml(code, {
          lang: normalizeDocsLanguage(language),
          theme: getDocsTheme(isDark),
        });

        if (cancelled) return;

        startTransition(() => {
          setHighlightedCode(html);
        });
      } catch {
        if (cancelled) return;

        startTransition(() => {
          setHighlightedCode(null);
        });
      }
    };

    void highlightCode();

    return () => {
      cancelled = true;
    };
  }, [code, isDark, language]);

  const onCopy = async () => {
    if (typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="docs-code-shell">
      <div className="docs-code-toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <span className="docs-code-language-badge">{languageLabel}</span>
          <span className="docs-code-title">{title}</span>
        </div>

        <button
          type="button"
          className={cn(
            "docs-code-copy-button",
            copied && "docs-code-copy-button-copied"
          )}
          onClick={() => void onCopy()}
          aria-label={`Copy ${title}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {highlightedCode ? (
        <div
          className="docs-code-pre docs-code-rendered"
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      ) : (
        <pre className="docs-code-pre">
          <code className="docs-code-plain">{code}</code>
        </pre>
      )}
    </div>
  );
}

const apiExampleTitlesBySpecId: Partial<
  Record<
    ApiEndpointSpec["id"],
    {
      request: string;
      response?: string;
    }
  >
> = {
  "get-domains": {
    request: "Request to list configured inbound domains",
    response: "Configured inbound domains and default selection",
  },
  "get-organization-stats": {
    request: "Request to list organization counts",
    response: "Organization-level member, address, and email counts",
  },
  "get-organization-email-activity": {
    request: "Request daily email activity for an organization",
    response: "Daily email counts in the selected timezone",
  },
  "get-organization-email-summary": {
    request: "Request organization email summary metrics",
    response: "Organization email and attachment summary metrics",
  },
  "get-email-addresses": {
    request: "Request email addresses for an organization",
    response: "Email addresses that belong to an organization",
  },
  "get-recent-address-activity": {
    request: "Request recent inbox activity",
    response: "Recently active inboxes for the organization",
  },
  "post-email-address": {
    request: "Request to create a new email address",
    response: "The newly created email address",
  },
  "patch-email-address": {
    request: "Request to update an existing email address",
    response: "The updated email address",
  },
  "delete-email-address": {
    request: "Request to delete an email address",
    response: "Deleted email address confirmation",
  },
  "get-emails": {
    request: "Request emails for a specific inbox",
    response: "Emails that match the requested inbox",
  },
  "get-email-detail": {
    request: "Request detailed email content",
    response: "Parsed email body, headers, and attachment metadata",
  },
  "get-email-raw": {
    request: "Request raw MIME source for an email",
  },
  "get-email-attachment": {
    request: "Request a binary attachment download",
  },
  "delete-email": {
    request: "Request to delete a stored email",
    response: "Deleted email confirmation",
  },
};

function getApiExampleTitles(spec: ApiEndpointSpec): {
  requestTitle: string;
  responseTitle: string;
} {
  const fromMap = apiExampleTitlesBySpecId[spec.id];

  return {
    requestTitle: fromMap?.request ?? `Request to ${spec.method} ${spec.path}`,
    responseTitle:
      fromMap?.response ?? `Response payload for ${spec.method} ${spec.path}`,
  };
}

export function ApiEndpointReference({ specId }: { specId: string }) {
  const spec = getApiEndpointSpecById(specId);
  const { requestTitle, responseTitle } = spec
    ? getApiExampleTitles(spec)
    : { requestTitle: "", responseTitle: "" };

  if (!spec) {
    return (
      <div className="docs-api-section">
        <p>Unknown API endpoint spec: {specId}</p>
      </div>
    );
  }

  return (
    <div className="docs-api-section" data-endpoint-id={spec.id}>
      <section
        className="docs-api-summary-card"
        aria-label={`${spec.method} ${spec.path}`}
      >
        <div className="docs-api-summary-header">
          <div className="flex flex-wrap items-center gap-2">
            <ApiMethodBadge method={spec.method} />
            <code className="font-mono text-[15px] text-foreground">
              {spec.path}
            </code>
          </div>
        </div>

        <p className="mt-3 text-[15px] leading-7 text-foreground/88">
          {spec.purpose}
        </p>

        <dl className="docs-api-summary-grid">
          <div className="docs-api-summary-item">
            <dt>Auth</dt>
            <dd>{spec.auth.summary}</dd>
          </div>
          <div className="docs-api-summary-item docs-api-summary-item-success">
            <dt>Success</dt>
            <dd>
              <span className="docs-api-status-badge">
                <code>{spec.successStatus}</code>
              </span>
            </dd>
          </div>
        </dl>

        {spec.notes?.length ? (
          <ul className="docs-api-note-list">
            {spec.notes.map(note => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="space-y-8">
        <section>
          <ApiHeaderTable spec={spec} />
        </section>

        {spec.pathParams?.length ? (
          <section>
            <ApiFieldTable caption="Path parameters" fields={spec.pathParams} />
          </section>
        ) : null}

        {spec.queryParams?.length ? (
          <section>
            <ApiFieldTable
              caption="Query parameters"
              fields={spec.queryParams}
            />
          </section>
        ) : null}

        {spec.bodyFields?.length ? (
          <section>
            <ApiFieldTable caption="Request body" fields={spec.bodyFields} />
          </section>
        ) : null}

        <section>
          <ApiFieldTable
            caption="Success response"
            fields={spec.responseFields}
            showRequirement={false}
          />
        </section>

        <section>
          <ApiErrorTable errors={spec.errors} />
        </section>

        <section className="space-y-4">
          <h3>Example request</h3>
          <ApiCodePanel
            code={spec.exampleRequest}
            language="bash"
            title={requestTitle}
          />
        </section>

        {spec.exampleResponse ? (
          <section className="space-y-4">
            <h3>Example response</h3>
            <ApiCodePanel
              code={spec.exampleResponse}
              language="json"
              title={responseTitle}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
