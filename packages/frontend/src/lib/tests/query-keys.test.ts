import { describe, expect, it } from "vitest";
import { queryKeys } from "../query-keys";

describe("queryKeys", () => {
  it("builds stable keys with expected ordering", () => {
    expect(queryKeys.organizationStats).toEqual(["app", "organization-stats"]);
    expect(queryKeys.addressesBase("org-1")).toEqual([
      "app",
      "organizations",
      "org-1",
      "addresses",
    ]);
    expect(queryKeys.addresses("org-1", 2, 25, "", "address", "asc")).toEqual([
      "app",
      "organizations",
      "org-1",
      "addresses",
      2,
      25,
      "",
      "address",
      "asc",
    ]);
    expect(
      queryKeys.recentAddressActivity(
        "org-1",
        "cursor-1",
        20,
        "sales",
        "recentActivity",
        "desc"
      )
    ).toEqual([
      "app",
      "organizations",
      "org-1",
      "recent-address-activity",
      20,
      "cursor-1",
      "sales",
      "recentActivity",
      "desc",
    ]);
    expect(queryKeys.emailDetail("org-1", "email-1")).toEqual([
      "app",
      "organizations",
      "org-1",
      "email-detail",
      "email-1",
    ]);
    expect(
      queryKeys.adminAnomalies({
        page: 2,
        pageSize: 10,
        severity: "error",
        type: "system_error",
        organizationId: "org-1",
        from: "2026-04-01",
        to: "2026-04-27",
      })
    ).toEqual([
      "app",
      "admin",
      "anomalies",
      2,
      10,
      "error",
      "system_error",
      "org-1",
      "2026-04-01",
      "2026-04-27",
    ]);
  });

  it("changes key when parameters change", () => {
    expect(queryKeys.emailSummary("org-1")).not.toEqual(
      queryKeys.emailSummary("org-2")
    );
    expect(queryKeys.emails("org-1", "address-1", "", 1, 10)).not.toEqual(
      queryKeys.emails("org-1", "address-2", "", 1, 10)
    );
    expect(
      queryKeys.emails("org-1", "address-1", "welcome", 1, 10)
    ).not.toEqual(queryKeys.emails("org-1", "address-1", "invoice", 1, 10));
    expect(queryKeys.emails("org-1", "address-1", "", 1, 10)).not.toEqual(
      queryKeys.emails("org-1", "address-1", "", 2, 10)
    );
    expect(queryKeys.emails("org-1", "address-1", "", 1, 10)).not.toEqual(
      queryKeys.emails("org-1", "address-1", "", 1, 20)
    );
    expect(
      queryKeys.addresses("org-1", 1, 20, "", "createdAt", "desc")
    ).not.toEqual(queryKeys.addresses("org-1", 2, 20, "", "createdAt", "desc"));
  });
});
