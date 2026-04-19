import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { InboxView } from "@/features/inbox/components/inbox-view";
import { INBOX_EMAIL_SEARCH_MAX_LENGTH } from "@/features/inbox/constants";

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: () => ({
    effectiveTimeZone: "UTC",
  }),
}));

describe("InboxView", () => {
  it("shows the sender label in the email list instead of the raw from address", () => {
    render(
      <MemoryRouter>
        <InboxView
          addresses={[
            {
              id: "address-1",
              address: "inbox@example.com",
              localPart: "inbox",
              domain: "example.com",
              emailCount: 0,
              createdAt: null,
              createdAtMs: null,
              expiresAt: null,
              expiresAtMs: null,
              lastReceivedAt: null,
              lastReceivedAtMs: null,
              maxReceivedEmailCount: null,
              maxReceivedEmailAction: null,
              integrations: [],
            },
          ]}
          addressesLoading={false}
          selectedAddressId="address-1"
          onSelectAddress={vi.fn()}
          emails={[
            {
              id: "email-1",
              addressId: "address-1",
              to: "inbox@example.com",
              from: "sender@example.com",
              sender: "John Smith <sender@example.com>",
              senderLabel: "John Smith",
              subject: "Hello",
              messageId: "message-1",
              rawSize: 42,
              rawTruncated: false,
              isSample: false,
              hasHtml: true,
              hasText: false,
              attachmentCount: 0,
              receivedAt: "2026-03-09T00:00:00.000Z",
              receivedAtMs: 1741478400000,
            },
          ]}
          emailsLoading={false}
          emailSearch=""
          onEmailSearchChange={vi.fn()}
          onEmailSearchFocusChange={vi.fn()}
          selectedEmailId={null}
          onSelectEmail={vi.fn()}
          previewEmail={null}
          previewEmailLoading={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("John Smith")).toBeTruthy();
    expect(screen.queryByText("sender@example.com")).toBeNull();
  });

  it("renders an email search input above the email list", () => {
    const onEmailSearchChange = vi.fn();
    const onClearEmailSearch = vi.fn();

    render(
      <MemoryRouter>
        <InboxView
          addresses={[
            {
              id: "address-1",
              address: "inbox@example.com",
              localPart: "inbox",
              domain: "example.com",
              emailCount: 0,
              createdAt: null,
              createdAtMs: null,
              expiresAt: null,
              expiresAtMs: null,
              lastReceivedAt: null,
              lastReceivedAtMs: null,
              maxReceivedEmailCount: null,
              maxReceivedEmailAction: null,
              integrations: [],
            },
          ]}
          addressesLoading={false}
          selectedAddressId="address-1"
          onSelectAddress={vi.fn()}
          emails={[]}
          emailsLoading={false}
          emailSearch="reset"
          onEmailSearchChange={onEmailSearchChange}
          onClearEmailSearch={onClearEmailSearch}
          onEmailSearchFocusChange={vi.fn()}
          selectedEmailId={null}
          onSelectEmail={vi.fn()}
          previewEmail={null}
          previewEmailLoading={false}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole("searchbox", {
      name: "Search emails",
    });
    expect((searchInput as HTMLInputElement).value).toBe("reset");
    expect(searchInput.getAttribute("maxlength")).toBe(
      String(INBOX_EMAIL_SEARCH_MAX_LENGTH)
    );

    fireEvent.change(searchInput, { target: { value: "invoice" } });
    expect(onEmailSearchChange).toHaveBeenCalledWith("invoice");

    fireEvent.click(screen.getByRole("button", { name: "Clear email search" }));
    expect(onClearEmailSearch).toHaveBeenCalledTimes(1);
  });

  it("renders a sample badge for generated onboarding emails", () => {
    render(
      <MemoryRouter>
        <InboxView
          addresses={[
            {
              id: "address-1",
              address: "inbox@example.com",
              localPart: "inbox",
              domain: "example.com",
              emailCount: 0,
              createdAt: null,
              createdAtMs: null,
              expiresAt: null,
              expiresAtMs: null,
              lastReceivedAt: null,
              lastReceivedAtMs: null,
              maxReceivedEmailCount: null,
              maxReceivedEmailAction: null,
              integrations: [],
            },
          ]}
          addressesLoading={false}
          selectedAddressId="address-1"
          onSelectAddress={vi.fn()}
          emails={[
            {
              id: "email-1",
              addressId: "address-1",
              to: "inbox@example.com",
              from: "sender@example.com",
              sender: "Spinupmail Team <sender@example.com>",
              senderLabel: "Spinupmail Team",
              subject: "Welcome",
              messageId: "message-1",
              rawSize: 42,
              rawTruncated: false,
              isSample: true,
              hasHtml: true,
              hasText: true,
              attachmentCount: 0,
              receivedAt: "2026-03-09T00:00:00.000Z",
              receivedAtMs: 1741478400000,
            },
          ]}
          emailsLoading={false}
          emailSearch=""
          onEmailSearchChange={vi.fn()}
          onEmailSearchFocusChange={vi.fn()}
          selectedEmailId={null}
          onSelectEmail={vi.fn()}
          previewEmail={null}
          previewEmailLoading={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Sample")).toBeTruthy();
  });

  it("shows received count and last received timing in the address selector", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T14:30:00.000Z"));
    try {
      render(
        <MemoryRouter>
          <InboxView
            addresses={[
              {
                id: "address-1",
                address: "inbox@example.com",
                localPart: "inbox",
                domain: "example.com",
                emailCount: 12,
                createdAt: null,
                createdAtMs: null,
                expiresAt: null,
                expiresAtMs: null,
                lastReceivedAt: "2026-03-09T13:05:00.000Z",
                lastReceivedAtMs: Date.parse("2026-03-09T13:05:00.000Z"),
                maxReceivedEmailCount: null,
                maxReceivedEmailAction: null,
                integrations: [],
              },
              {
                id: "address-2",
                address: "sales@example.com",
                localPart: "sales",
                domain: "example.com",
                emailCount: 3,
                createdAt: null,
                createdAtMs: null,
                expiresAt: null,
                expiresAtMs: null,
                lastReceivedAt: "2026-03-08T10:00:00.000Z",
                lastReceivedAtMs: Date.parse("2026-03-08T10:00:00.000Z"),
                maxReceivedEmailCount: null,
                maxReceivedEmailAction: null,
                integrations: [],
              },
            ]}
            addressesLoading={false}
            selectedAddressId="address-1"
            onSelectAddress={vi.fn()}
            emails={[]}
            emailsLoading={false}
            emailSearch=""
            onEmailSearchChange={vi.fn()}
            onEmailSearchFocusChange={vi.fn()}
            selectedEmailId={null}
            onSelectEmail={vi.fn()}
            previewEmail={null}
            previewEmailLoading={false}
          />
        </MemoryRouter>
      );

      const trigger = screen.getByRole("button", {
        name: /inbox@example\.com/i,
      });
      expect(trigger.textContent).toContain("12 Total");
      expect(trigger.textContent).toContain("Last: 13:05");

      fireEvent.click(trigger);

      const selectedAddressItem = screen
        .getAllByText("inbox@example.com")
        .at(-1)
        ?.closest('[data-slot="command-item"]');
      const secondaryAddressItem = screen
        .getByText("sales@example.com")
        .closest('[data-slot="command-item"]');

      expect(selectedAddressItem?.textContent).toContain("12");
      expect(selectedAddressItem?.textContent).toContain("Last: 13:05");
      expect(secondaryAddressItem?.textContent).toContain("3");
      expect(secondaryAddressItem?.textContent).toContain("Last: Yesterday");
    } finally {
      vi.useRealTimers();
    }
  });
});
