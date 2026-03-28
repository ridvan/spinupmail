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
    expect(screen.getByText("of 100 MB")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Attachment storage usage" })
        .getAttribute("aria-valuenow")
    ).toBe("15");
  });

  it("turns the storage usage yellow at halfway", () => {
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

    expect(screen.getByText("50 MB").className).toContain("text-amber-600");
    expect(screen.getByText("of 100 MB")).toBeTruthy();
  });

  it("turns the storage usage red at the limit", () => {
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

    expect(screen.getByText("100 MB").className).toContain("text-destructive");
    expect(screen.getByText("of 100 MB")).toBeTruthy();
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
    expect(screen.getByText("of 2 TB")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Attachment storage usage" })
        .getAttribute("aria-valuenow")
    ).toBe("50");
  });
});
