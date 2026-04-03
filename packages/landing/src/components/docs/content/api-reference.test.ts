import { describe, expect, it } from "vitest";
import { apiEndpointSpecs } from "./api-reference";

describe("api-reference coverage", () => {
  it("covers every required product endpoint exactly once", () => {
    const requiredEndpoints = [
      "POST /api/organizations",
      "GET /api/domains",
      "GET /api/organizations/stats",
      "GET /api/organizations/stats/email-activity",
      "GET /api/organizations/stats/email-summary",
      "GET /api/email-addresses",
      "GET /api/email-addresses/recent-activity",
      "POST /api/email-addresses",
      "GET /api/email-addresses/:id",
      "PATCH /api/email-addresses/:id",
      "DELETE /api/email-addresses/:id",
      "GET /api/emails",
      "GET /api/emails/:id",
      "GET /api/emails/:id/raw",
      "GET /api/emails/:id/attachments/:attachmentId",
      "DELETE /api/emails/:id",
    ];

    const actualEndpoints = apiEndpointSpecs.map(
      spec => `${spec.method} ${spec.path}`
    );

    expect(new Set(actualEndpoints).size).toBe(actualEndpoints.length);
    expect(actualEndpoints).toEqual(requiredEndpoints);
  });
});
