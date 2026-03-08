import { getApiEndpointSpecById } from "./api-reference";
import type { ApiEndpointSpec, ApiFieldSpec } from "./api-reference";

const API_ENDPOINT_REFERENCE_TAG_PATTERN =
  /<ApiEndpointReference\s+specId=["']([^"']+)["']\s*\/>/g;

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br />");
}

function toMarkdownCode(value: string): string {
  return `\`${value.replaceAll("`", "\\`")}\``;
}

function buildMarkdownTable(
  headers: Array<string>,
  rows: Array<Array<string>>
): string {
  const headerRow = `| ${headers.map(escapeTableCell).join(" | ")} |`;
  const dividerRow = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyRows = rows.map(
    row => `| ${row.map(escapeTableCell).join(" | ")} |`
  );

  return [headerRow, dividerRow, ...bodyRows].join("\n");
}

function buildFieldTable(
  fields: Array<ApiFieldSpec>,
  showRequirement = true
): string {
  const headers = showRequirement
    ? ["Field", "Type", "Requirement", "Details"]
    : ["Field", "Type", "Details"];

  const rows = fields.map(field => {
    const details = [field.description];

    if (field.defaultValue) {
      details.push(`Default: ${toMarkdownCode(field.defaultValue)}`);
    }

    if (field.constraints) {
      details.push(`Constraints: ${field.constraints}`);
    }

    if (showRequirement) {
      return [
        toMarkdownCode(field.name),
        toMarkdownCode(field.type),
        field.required ? "Required" : "Optional",
        details.join("<br />"),
      ];
    }

    return [
      toMarkdownCode(field.name),
      toMarkdownCode(field.type),
      details.join("<br />"),
    ];
  });

  return buildMarkdownTable(headers, rows);
}

export function renderApiEndpointSpecAsMarkdown(spec: ApiEndpointSpec): string {
  const sections: Array<string> = [];

  sections.push(
    "### Endpoint summary",
    buildMarkdownTable(
      ["Method", "Path", "Success"],
      [
        [
          toMarkdownCode(spec.method),
          toMarkdownCode(spec.path),
          String(spec.successStatus),
        ],
      ]
    ),
    `**Purpose:** ${spec.purpose}`,
    `**Auth:** ${spec.auth.summary}`
  );

  if (spec.notes?.length) {
    sections.push("**Notes:**", ...spec.notes.map(note => `- ${note}`));
  }

  sections.push(
    "### Request headers",
    buildMarkdownTable(
      ["Header", "Example", "Requirement", "Details"],
      spec.auth.headers.map(header => [
        toMarkdownCode(header.name),
        toMarkdownCode(header.value),
        header.required ? "Required" : "Optional",
        header.notes,
      ])
    )
  );

  if (spec.pathParams?.length) {
    sections.push("### Path parameters", buildFieldTable(spec.pathParams));
  }

  if (spec.queryParams?.length) {
    sections.push("### Query parameters", buildFieldTable(spec.queryParams));
  }

  if (spec.bodyFields?.length) {
    sections.push("### Request body", buildFieldTable(spec.bodyFields));
  }

  sections.push(
    "### Success response",
    buildFieldTable(spec.responseFields, false),
    "### Common error responses",
    buildMarkdownTable(
      ["Status", "Error", "When it happens"],
      spec.errors.map(error => [
        toMarkdownCode(String(error.status)),
        toMarkdownCode(error.error),
        error.when,
      ])
    ),
    "### Example request",
    "```bash",
    spec.exampleRequest,
    "```"
  );

  if (spec.exampleResponse) {
    sections.push(
      "### Example response",
      "```json",
      spec.exampleResponse,
      "```"
    );
  }

  return sections.join("\n\n");
}

export function expandApiEndpointReferencesInMarkdown(
  markdown: string
): string {
  return markdown.replace(
    API_ENDPOINT_REFERENCE_TAG_PATTERN,
    (_match, specId: string) => {
      const spec = getApiEndpointSpecById(specId);
      if (!spec) {
        return `> Unknown API endpoint spec: ${specId}`;
      }

      return renderApiEndpointSpecAsMarkdown(spec);
    }
  );
}
