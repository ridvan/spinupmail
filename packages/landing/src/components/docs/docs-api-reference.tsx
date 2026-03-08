import { useState } from "react";
import { getApiEndpointSpecById } from "./content/api-reference";
import type {
  ApiEndpointSpec,
  ApiErrorSpec,
  ApiFieldSpec,
} from "./content/api-reference";
import { cn } from "@/lib/utils";

const requirementTone: Record<string, string> = {
  required: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
  optional: "border-white/16 bg-white/6 text-white/72",
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
    GET: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
    POST: "border-sky-400/35 bg-sky-400/12 text-sky-200",
    PATCH: "border-amber-400/35 bg-amber-400/12 text-amber-200",
    DELETE: "border-rose-400/35 bg-rose-400/12 text-rose-200",
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
    <div className="docs-reference-table-wrap">
      <table className="docs-reference-table">
        <caption>{caption}</caption>
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
    </div>
  );
}

function ApiHeaderTable({ spec }: { spec: ApiEndpointSpec }) {
  return (
    <div className="docs-reference-table-wrap">
      <table className="docs-reference-table">
        <caption>Request headers</caption>
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
    </div>
  );
}

function ApiErrorTable({ errors }: { errors: Array<ApiErrorSpec> }) {
  return (
    <div className="docs-reference-table-wrap">
      <table className="docs-reference-table">
        <caption>Common error responses</caption>
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
    </div>
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
          <span className="inline-flex h-6 min-w-6 items-center justify-center border border-white/20 bg-white/10 px-1.5 font-mono text-[12px] font-semibold uppercase tracking-tight text-white/90">
            {language.slice(0, 2)}
          </span>
          <span className="truncate text-[13px] font-medium tracking-tight text-white/85">
            {title}
          </span>
        </div>

        <button
          type="button"
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] transition-colors",
            copied
              ? "border-white/25 bg-white/14 text-white"
              : "border-white/15 bg-black/80 text-white/70 hover:border-white/25 hover:text-white"
          )}
          onClick={() => void onCopy()}
          aria-label={`Copy ${title}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="docs-code-pre">
        <code className="docs-code-plain">{code}</code>
      </pre>
    </div>
  );
}

export function ApiEndpointReference({ specId }: { specId: string }) {
  const spec = getApiEndpointSpecById(specId);

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
        <div className="flex flex-wrap items-center gap-2">
          <ApiMethodBadge method={spec.method} />
          <code className="text-[15px] text-foreground">{spec.path}</code>
        </div>

        <p className="mt-3 text-[15px] leading-7 text-foreground/88">
          {spec.purpose}
        </p>

        <dl className="docs-api-summary-grid">
          <div>
            <dt>Auth</dt>
            <dd>{spec.auth.summary}</dd>
          </div>
          <div>
            <dt>Success</dt>
            <dd>
              <code>{spec.successStatus}</code>
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
          <h3>Headers</h3>
          <ApiHeaderTable spec={spec} />
        </section>

        {spec.pathParams?.length ? (
          <section>
            <h3>Path parameters</h3>
            <ApiFieldTable caption="Path parameters" fields={spec.pathParams} />
          </section>
        ) : null}

        {spec.queryParams?.length ? (
          <section>
            <h3>Query parameters</h3>
            <ApiFieldTable
              caption="Query parameters"
              fields={spec.queryParams}
            />
          </section>
        ) : null}

        {spec.bodyFields?.length ? (
          <section>
            <h3>Request body</h3>
            <ApiFieldTable
              caption="Request body fields"
              fields={spec.bodyFields}
            />
          </section>
        ) : null}

        <section>
          <h3>Success response</h3>
          <ApiFieldTable
            caption="Successful response fields"
            fields={spec.responseFields}
            showRequirement={false}
          />
        </section>

        <section>
          <h3>Common errors</h3>
          <ApiErrorTable errors={spec.errors} />
        </section>

        <section className="space-y-4">
          <h3>Example request</h3>
          <ApiCodePanel
            code={spec.exampleRequest}
            language="bash"
            title={`${spec.method.toLowerCase()}.sh`}
          />
        </section>

        {spec.exampleResponse ? (
          <section className="space-y-4">
            <h3>Example response</h3>
            <ApiCodePanel
              code={spec.exampleResponse}
              language="json"
              title="response.json"
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
