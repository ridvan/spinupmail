import { describe, expect, it } from "vitest";
import {
  matchesManageDocumentTitle,
  resolveDocumentTitle,
  resolveRouteTitle,
} from "@/lib/route-title";

describe("route-title", () => {
  it("resolves the deepest matched handle title", () => {
    expect(
      resolveRouteTitle([
        { handle: { title: "Inbox" } },
        { handle: { title: "View Email", managesDocumentTitle: true } },
      ])
    ).toBe("View Email");
  });

  it("detects when a matched route manages the document title", () => {
    expect(
      matchesManageDocumentTitle([
        { route: { id: "inbox", handle: { title: "Inbox" } } },
        {
          route: {
            id: "view-email",
            handle: { managesDocumentTitle: true },
          },
        },
      ])
    ).toBe(true);
  });

  it("builds a document title from the deepest matched handle title", () => {
    expect(
      resolveDocumentTitle(
        [
          { route: { id: "inbox", handle: { title: "Inbox" } } },
          { route: { id: "view-email", handle: { title: "View Email" } } },
        ],
        "SpinupMail"
      )
    ).toBe("View Email | SpinupMail");
  });
});
