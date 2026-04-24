import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailStatsCard } from "@/features/dashboard/components/email-stats-card";
import { useEmailSummaryQuery } from "@/features/dashboard/hooks/use-email-summary";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";
import { TestQueryProvider, TestRouterProvider } from "@/test/render-utils";

vi.mock("@/features/dashboard/hooks/use-email-summary", () => ({
  useEmailSummaryQuery: vi.fn(),
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

const mockedUseEmailSummaryQuery = vi.mocked(useEmailSummaryQuery);
const mockedUseTimezone = vi.mocked(useTimezone);

const createEmailSummaryQueryResult = (overrides: {
  attachmentSizeTotal: number;
  attachmentSizeLimit: number;
}) =>
  ({
    data: {
      totalEmailCount: 42,
      attachmentCount: 7,
      attachmentSizeTotal: overrides.attachmentSizeTotal,
      attachmentSizeLimit: overrides.attachmentSizeLimit,
      topDomains: [],
      busiestInboxes: [],
      dormantInboxes: [],
    },
    isLoading: false,
    isFetching: false,
    error: null,
  }) as unknown as ReturnType<typeof useEmailSummaryQuery>;

const createLoadingEmailSummaryQueryResult = () =>
  ({
    data: undefined,
    isLoading: true,
    isFetching: true,
    error: null,
  }) as unknown as ReturnType<typeof useEmailSummaryQuery>;

const renderCard = () =>
  render(
    <TestRouterProvider>
      <TestQueryProvider>
        <EmailStatsCard />
      </TestQueryProvider>
    </TestRouterProvider>
  );

describe("EmailStatsCard", () => {
  it("shows attachment usage against the org limit", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue({
      ...createEmailSummaryQueryResult({
        attachmentSizeTotal: 15 * 1024 * 1024,
        attachmentSizeLimit: 100 * 1024 * 1024,
      }),
    });

    renderCard();

    expect(screen.getByText("15 MB")).toBeTruthy();
    expect(screen.getByText("Total: 100 MB")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Attachment storage policy" })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Attachment storage usage" })
        .getAttribute("aria-valuenow")
    ).toBe("15");
  });

  it("darkens the storage usage tone at halfway", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue(
      createEmailSummaryQueryResult({
        attachmentSizeTotal: 50 * 1024 * 1024,
        attachmentSizeLimit: 100 * 1024 * 1024,
      })
    );

    renderCard();

    expect(screen.getByText("50 MB").className).toContain("text-foreground/80");
    expect(screen.getByText("Total: 100 MB")).toBeTruthy();
  });

  it("uses the strongest neutral tone at the limit", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue(
      createEmailSummaryQueryResult({
        attachmentSizeTotal: 100 * 1024 * 1024,
        attachmentSizeLimit: 100 * 1024 * 1024,
      })
    );

    renderCard();

    expect(screen.getByText("100 MB").className).toContain("text-foreground");
    expect(screen.getByText("Total: 100 MB")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Attachment storage usage" })
        .getAttribute("aria-valuenow")
    ).toBe("100");
  });

  it("formats attachment usage values larger than a gigabyte", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue(
      createEmailSummaryQueryResult({
        attachmentSizeTotal: 1099511627776,
        attachmentSizeLimit: 2 * 1099511627776,
      })
    );

    renderCard();

    expect(screen.getByText("1 TB")).toBeTruthy();
    expect(screen.getByText("Total: 2 TB")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Attachment storage usage" })
        .getAttribute("aria-valuenow")
    ).toBe("50");
  });

  it("keeps the attachment storage section visible with fixed-size skeletons while loading", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue(
      createLoadingEmailSummaryQueryResult()
    );

    const { container } = renderCard();

    expect(screen.getByText("Attachment Storage")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Attachment storage policy" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("progressbar", { name: "Attachment storage usage" })
    ).toBeNull();

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(
      Array.from(skeletons).some(node => node.className.includes("w-8"))
    ).toBe(true);
    expect(
      Array.from(skeletons).some(
        node =>
          node.className.includes("h-1.5") && node.className.includes("w-full")
      )
    ).toBe(true);
    expect(
      Array.from(skeletons).filter(node => node.className.includes("h-5"))
        .length
    ).toBeGreaterThanOrEqual(6);
  });

  it("keeps summary rows visible when no summary data exists", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as ReturnType<typeof useTimezone>);
    mockedUseEmailSummaryQuery.mockReturnValue(
      createEmailSummaryQueryResult({
        attachmentSizeTotal: 0,
        attachmentSizeLimit: 100 * 1024 * 1024,
      })
    );

    renderCard();

    expect(screen.getByText("Busiest inboxes:")).toBeTruthy();
    expect(screen.getByText("Top Senders:")).toBeTruthy();
    expect(screen.getByText("Dormant inboxes:")).toBeTruthy();
    expect(screen.getAllByText("None")).toHaveLength(3);
  });
});
