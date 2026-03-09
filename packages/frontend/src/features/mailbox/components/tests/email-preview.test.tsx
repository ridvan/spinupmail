import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailPreview } from "@/features/mailbox/components/email-preview";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDeleteEmailMutation } from "@/features/mailbox/hooks/use-mailbox";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/mailbox/hooks/use-mailbox", () => ({
  useDeleteEmailMutation: vi.fn(),
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseDeleteEmailMutation = vi.mocked(useDeleteEmailMutation);
const mockedUseTimezone = vi.mocked(useTimezone);

describe("EmailPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeOrganizationId: "org-1",
    } as unknown as ReturnType<typeof useAuth>);

    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
    } as unknown as ReturnType<typeof useTimezone>);

    mockedUseDeleteEmailMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useDeleteEmailMutation>);
  });

  it("shows a load remote content action and reloads the renderer after opt-in", async () => {
    render(
      <EmailPreview
        email={{
          id: "email-1",
          addressId: "address-1",
          to: "inbox@example.com",
          from: "sender@example.com",
          subject: "Remote content",
          headers: [],
          html: '<img src="https://example.com/pixel.png" />',
          text: null,
          raw: null,
          rawSize: 10,
          rawTruncated: false,
          rawDownloadPath: undefined,
          attachments: [],
          receivedAt: "2026-03-09T00:00:00.000Z",
          receivedAtMs: 1741478400000,
        }}
      />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Load remote content" })
      ).toBeTruthy()
    );

    const host = screen.getByTestId("email-html-renderer");
    expect(
      host.shadowRoot?.querySelector("img")?.getAttribute("src")
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Load remote content" })
    );

    await waitFor(() =>
      expect(host.shadowRoot?.querySelector("img")?.getAttribute("src")).toBe(
        "https://example.com/pixel.png"
      )
    );
  });

  it("falls back to plain text when HTML is unavailable", () => {
    render(
      <EmailPreview
        email={{
          id: "email-2",
          addressId: "address-1",
          to: "inbox@example.com",
          from: "sender@example.com",
          subject: "Text only",
          headers: [],
          html: null,
          text: "Hello from plain text",
          raw: null,
          rawSize: 10,
          rawTruncated: false,
          rawDownloadPath: undefined,
          attachments: [],
          receivedAt: "2026-03-09T00:00:00.000Z",
          receivedAtMs: 1741478400000,
        }}
      />
    );

    expect(screen.getByDisplayValue("Hello from plain text")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Load remote content" })
    ).toBeNull();
  });
});
