import type { ComponentProps } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { EmptyEmailSelected } from "@/features/inbox/components/empty-email-selected";
import { InboxView } from "@/features/inbox/components/inbox-view";
import { INBOX_EMAIL_SEARCH_MAX_LENGTH } from "@/features/inbox/constants";
import { renderWithAct } from "@/test/render-with-act";

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: () => ({
    effectiveTimeZone: "UTC",
  }),
}));

type InboxViewProps = ComponentProps<typeof InboxView>;

const inboxAddress: InboxViewProps["addresses"][number] = {
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
};

const inboxEmail: InboxViewProps["emails"][number] = {
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
};

const renderInboxView = (props: Partial<InboxViewProps> = {}) =>
  renderWithAct(
    <MemoryRouter>
      <InboxView
        addresses={[inboxAddress]}
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
        {...props}
      />
    </MemoryRouter>
  );

describe("InboxView", () => {
  it("renders the empty preview illustration without animation for reduced motion users", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      query =>
        ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList
    );

    const { container } = await renderWithAct(<EmptyEmailSelected />);

    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(
      container.querySelectorAll("animate, animateTransform")
    ).toHaveLength(0);
    expect(screen.getByText("Select an email to view")).toBeTruthy();
  });

  it("shows the sender label in the email list instead of the raw from address", async () => {
    await renderWithAct(
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
          emails={[inboxEmail]}
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

  it("keeps existing email rows visible during background email fetches", async () => {
    await renderWithAct(
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
          emailsFetching={true}
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

    expect(screen.getByTestId("inbox-email-row")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("keeps the search placeholder active while addresses load", async () => {
    await renderInboxView({
      addressesLoading: true,
      selectedAddressId: null,
    });

    const searchInput = screen.getByRole("searchbox", {
      name: "Search emails",
    }) as HTMLInputElement;
    expect(searchInput.placeholder).toBe("Search this inbox...");
    expect(searchInput.disabled).toBe(true);
  });

  it("does not render pagination controls when pagination is not wired", async () => {
    await renderInboxView({
      emailTotalItems: 30,
      emailTotalPages: 3,
    });

    expect(
      screen.queryByRole("button", { name: "Go to previous page" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Go to next page" })
    ).toBeNull();
  });

  it("renders pagination controls when pagination has multiple pages", async () => {
    const onEmailPageChange = vi.fn();

    await renderInboxView({
      emailPage: 1,
      emailPageSize: 10,
      emailTotalItems: 30,
      emailTotalPages: 3,
      onEmailPageChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onEmailPageChange).toHaveBeenCalledWith(2);
  });

  it("sanitizes invalid pagination inputs before rendering ranges", async () => {
    await renderInboxView({
      emails: [inboxEmail],
      emailPage: 2.9,
      emailPageSize: 2.9,
      emailTotalItems: 30,
      emailTotalPages: 3,
      onEmailPageChange: vi.fn(),
    });

    expect(screen.getByText("3 of 30")).toBeTruthy();
  });

  it("clamps pagination inputs to a positive first page", async () => {
    await renderInboxView({
      emails: [inboxEmail],
      emailPage: -1,
      emailPageSize: 0,
      emailTotalItems: 30,
      emailTotalPages: 3,
      onEmailPageChange: vi.fn(),
    });

    expect(screen.getByText("1 of 30")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Go to previous page",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("renders an email search input above the email list", async () => {
    const onEmailSearchChange = vi.fn();
    const onClearEmailSearch = vi.fn();

    await renderWithAct(
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

  it("renders a sample badge for generated onboarding emails", async () => {
    await renderWithAct(
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

  it("shows received count and last received timing in the address selector", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T14:30:00.000Z"));
    try {
      await renderWithAct(
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
