import { describe, expect, it } from "vitest";
import { expandApiEndpointReferencesInMarkdown } from "./api-reference-markdown";

describe("api-reference-markdown", () => {
  it("expands ApiEndpointReference tags into Markdown sections", () => {
    const source = [
      "## List emails",
      "",
      '<ApiEndpointReference specId="get-emails" />',
    ].join("\n");

    const output = expandApiEndpointReferencesInMarkdown(source);

    expect(output).toContain("## List emails");
    expect(output).toContain("### Endpoint summary");
    expect(output).toContain("| Method | Path | Success |");
    expect(output).toContain("`GET`");
    expect(output).toContain("`/api/emails`");
    expect(output).toContain("### Query parameters");
    expect(output).toContain("### Example request");
    expect(output).toContain("```bash");
    expect(output).not.toContain("<ApiEndpointReference");
  });

  it("returns a visible fallback for unknown spec ids", () => {
    const source = '<ApiEndpointReference specId="unknown-spec" />';
    const output = expandApiEndpointReferencesInMarkdown(source);

    expect(output).toContain("> Unknown API endpoint spec: unknown-spec");
  });
});
