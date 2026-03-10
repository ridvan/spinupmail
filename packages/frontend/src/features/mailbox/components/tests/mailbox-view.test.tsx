import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { MailboxView } from "@/features/mailbox/components/mailbox-view";

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: () => ({
    effectiveTimeZone: "UTC",
  }),
}));

describe("MailboxView", () => {
  it("shows the sender label in the email list instead of the raw from address", () => {
    render(
      <MemoryRouter>
        <MailboxView
          addresses={[
            {
              id: "address-1",
              address: "inbox@example.com",
              localPart: "inbox",
              domain: "example.com",
              createdAt: null,
              createdAtMs: null,
              expiresAt: null,
              expiresAtMs: null,
              lastReceivedAt: null,
              lastReceivedAtMs: null,
              maxReceivedEmailCount: null,
              maxReceivedEmailAction: null,
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
              hasHtml: true,
              hasText: false,
              attachmentCount: 0,
              receivedAt: "2026-03-09T00:00:00.000Z",
              receivedAtMs: 1741478400000,
            },
          ]}
          emailsLoading={false}
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
});
