import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { EditAddressSheet } from "@/features/addresses/components/edit-address-sheet";
import { useUpdateAddressMutation } from "@/features/addresses/hooks/use-addresses";

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useUpdateAddressMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
  },
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetDescription: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props}>{children}</p>
  ),
  SheetFooter: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetHeader: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  SheetTitle: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
}));

const mockedUseUpdateAddressMutation = vi.mocked(useUpdateAddressMutation);
const mockedToastPromise = vi.mocked(toast.promise);

const updateMutation = {
  isPending: false,
  mutateAsync: vi.fn(),
};

const baseAddress = {
  id: "address-1",
  address: "hello@example.com",
  localPart: "hello",
  domain: "example.com",
  integrations: [],
  emailCount: 0,
  allowedFromDomains: [],
  maxReceivedEmailCount: null,
  maxReceivedEmailAction: null,
  createdAt: null,
  createdAtMs: null,
  expiresAt: null,
  expiresAtMs: null,
  lastReceivedAt: null,
  lastReceivedAtMs: null,
};

const telegramIntegration = {
  id: "integration-1",
  provider: "telegram" as const,
  name: "Ops alerts",
  status: "active" as const,
  supportedEventTypes: ["email.received" as const],
  mailboxCount: 2,
  lastValidatedAt: "2026-04-20T10:00:00.000Z",
  lastValidatedAtMs: 1_745_143_200_000,
  createdAt: "2026-04-20T10:00:00.000Z",
  createdAtMs: 1_745_143_200_000,
  updatedAt: "2026-04-20T10:00:00.000Z",
  updatedAtMs: 1_745_143_200_000,
  publicConfig: {
    telegramBotId: "123456",
    botUsername: "spinupmail_bot",
    chatId: "-1001234567890",
    chatLabel: "Product alerts",
  },
};

const addressWithTelegramIntegration = {
  ...baseAddress,
  integrations: [
    {
      id: telegramIntegration.id,
      provider: telegramIntegration.provider,
      name: telegramIntegration.name,
      eventType: "email.received" as const,
    },
  ],
};

const renderEditAddressSheet = (
  onOpenChange = vi.fn(),
  props?: Partial<React.ComponentProps<typeof EditAddressSheet>>
) =>
  render(
    <EditAddressSheet
      address={baseAddress as never}
      domains={["example.com"]}
      maxReceivedEmailsPerAddress={100}
      open
      onOpenChange={onOpenChange}
      {...props}
    />
  );

describe("EditAddressSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMutation.mutateAsync.mockReset();
    mockedToastPromise.mockImplementation(((
      promise: PromiseLike<unknown> | (() => PromiseLike<unknown>)
    ) => ({
      unwrap: () =>
        typeof promise === "function"
          ? Promise.resolve(promise())
          : Promise.resolve(promise),
    })) as typeof toast.promise);
  });

  it("only shows the username change warning when the username is edited", () => {
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet();

    expect(
      screen.queryByText("Changing the username replaces this address")
    ).toBeNull();
    expect(
      screen.queryByRole("checkbox", {
        name: "I understand the consequences of changing username.",
      })
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });

    expect(
      screen.getByText("Changing the username replaces this address")
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "I understand the consequences of changing username.",
      })
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello" },
    });

    expect(
      screen.queryByText("Changing the username replaces this address")
    ).toBeNull();
  });

  it("prefills the default inbox limit for addresses that do not have one yet", () => {
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet();

    expect(
      (screen.getByLabelText("Max emails") as HTMLInputElement).value
    ).toBe("100");
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.queryByText("Unlimited")).toBeNull();
    expect(
      screen
        .getByRole("radio", { name: "Delete all" })
        .getAttribute("aria-checked")
    ).toBe("true");
  });

  it("refreshes the inherited inbox limit when the parent default changes", () => {
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    const { rerender } = render(
      <EditAddressSheet
        address={baseAddress as never}
        domains={["example.com"]}
        maxReceivedEmailsPerAddress={100}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      (screen.getByLabelText("Max emails") as HTMLInputElement).value
    ).toBe("100");

    rerender(
      <EditAddressSheet
        address={baseAddress as never}
        domains={["example.com"]}
        maxReceivedEmailsPerAddress={250}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      (screen.getByLabelText("Max emails") as HTMLInputElement).value
    ).toBe("250");
  });

  it("blocks submit until the username change is acknowledged", async () => {
    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).not.toHaveBeenCalled()
    );
    expect(
      screen.getByText(
        "You must confirm that changing the username disables the old address"
      )
    ).toBeTruthy();
  });

  it("submits with the backend default limit action for legacy addresses", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );
    renderEditAddressSheet(onOpenChange);

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("allows submit without the extra acknowledgment when the username is unchanged", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );
    renderEditAddressSheet(onOpenChange);

    fireEvent.click(screen.getByRole("radio", { name: "Delete all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits after the username change is acknowledged", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );
    renderEditAddressSheet(onOpenChange);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "hello-2" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "I understand the consequences of changing username.",
      })
    );
    fireEvent.click(screen.getByRole("radio", { name: "Delete all" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello-2",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows provider radios only after integrations are enabled", () => {
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet(vi.fn(), {
      canManageIntegrations: true,
      integrations: [telegramIntegration],
    });

    expect(screen.queryByRole("radio", { name: "Telegram" })).toBeNull();
    expect(screen.queryByText("Ops alerts")).toBeNull();

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Enable integrations",
      })
    );

    expect(screen.getByRole("radio", { name: "Telegram" })).toBeTruthy();
    expect(screen.getByText("Ops alerts")).toBeTruthy();
    expect(
      screen.getByText("Send emails to Telegram (Product alerts)")
    ).toBeTruthy();
  });

  it("submits selected integrations from the enabled provider section", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet(onOpenChange, {
      canManageIntegrations: true,
      integrations: [telegramIntegration],
    });

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Enable integrations",
      })
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Ops alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          integrationSubscriptions: [
            {
              integrationId: "integration-1",
              eventType: "email.received",
            },
          ],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rehydrates existing integrations when matching providers load after mount", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    let view: ReturnType<typeof render> | undefined;

    await act(async () => {
      view = render(
        <EditAddressSheet
          address={addressWithTelegramIntegration as never}
          domains={["example.com"]}
          maxReceivedEmailsPerAddress={100}
          integrations={[]}
          canManageIntegrations
          open
          onOpenChange={onOpenChange}
        />
      );
    });

    expect(
      screen
        .getByRole("switch", { name: "Enable integrations" })
        .getAttribute("aria-checked")
    ).toBe("false");

    await act(async () => {
      view?.rerender(
        <EditAddressSheet
          address={addressWithTelegramIntegration as never}
          domains={["example.com"]}
          maxReceivedEmailsPerAddress={100}
          integrations={[telegramIntegration]}
          canManageIntegrations
          open
          onOpenChange={onOpenChange}
        />
      );
    });

    await waitFor(() =>
      expect(
        screen
          .getByRole("switch", { name: "Enable integrations" })
          .getAttribute("aria-checked")
      ).toBe("true")
    );

    expect(screen.getByRole("radio", { name: "Telegram" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Ops alerts" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          integrationSubscriptions: [
            {
              integrationId: "integration-1",
              eventType: "email.received",
            },
          ],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits no integrations after unchecking an existing telegram connection", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet(onOpenChange, {
      address: addressWithTelegramIntegration as never,
      canManageIntegrations: true,
      integrations: [telegramIntegration],
    });

    expect(
      screen
        .getByRole("switch", { name: "Enable integrations" })
        .getAttribute("aria-checked")
    ).toBe("true");

    fireEvent.click(screen.getByRole("checkbox", { name: "Ops alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          integrationSubscriptions: [],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("allows disabling integrations from the edit sheet", async () => {
    const onOpenChange = vi.fn();

    updateMutation.mutateAsync.mockResolvedValue(undefined);
    mockedUseUpdateAddressMutation.mockReturnValue(
      updateMutation as unknown as ReturnType<typeof useUpdateAddressMutation>
    );

    renderEditAddressSheet(onOpenChange, {
      address: addressWithTelegramIntegration as never,
      canManageIntegrations: true,
      integrations: [telegramIntegration],
    });

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Enable integrations",
      })
    );

    await waitFor(() =>
      expect(
        screen
          .getByRole("switch", { name: "Enable integrations" })
          .getAttribute("aria-checked")
      ).toBe("false")
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
        addressId: "address-1",
        payload: {
          localPart: "hello",
          domain: "example.com",
          ttlMinutes: null,
          allowedFromDomains: [],
          integrationSubscriptions: [],
          maxReceivedEmailCount: 100,
          maxReceivedEmailAction: "cleanAll",
        },
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
