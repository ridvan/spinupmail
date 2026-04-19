import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const renderEditAddressSheet = (onOpenChange = vi.fn()) =>
  render(
    <EditAddressSheet
      address={baseAddress as never}
      domains={["example.com"]}
      maxReceivedEmailsPerAddress={100}
      open
      onOpenChange={onOpenChange}
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
});
