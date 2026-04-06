import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { CreateAddressForm } from "@/features/addresses/components/create-address-form";
import { useCreateAddressMutation } from "@/features/addresses/hooks/use-addresses";

vi.mock("react-router", () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/features/addresses/hooks/use-addresses", () => ({
  useCreateAddressMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUseCreateAddressMutation = vi.mocked(useCreateAddressMutation);
const mockedToastPromise = vi.mocked(toast.promise);

const createMutation = {
  isPending: false,
  mutateAsync: vi.fn(),
};

describe("CreateAddressForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutation.mutateAsync.mockReset();
    mockedUseCreateAddressMutation.mockReturnValue(
      createMutation as unknown as ReturnType<typeof useCreateAddressMutation>
    );
    mockedToastPromise.mockImplementation(((
      promise: PromiseLike<unknown> | (() => PromiseLike<unknown>)
    ) => ({
      unwrap: () =>
        typeof promise === "function"
          ? Promise.resolve(promise())
          : Promise.resolve(promise),
    })) as typeof toast.promise);
  });

  it("prefills max stored emails and updates it when the configured default arrives", async () => {
    const { rerender } = render(
      <CreateAddressForm domains={["example.com"]} />
    );

    expect(
      (screen.getByLabelText("Max stored emails") as HTMLInputElement).value
    ).toBe("100");
    expect(screen.getByText("Required")).toBeTruthy();

    rerender(
      <CreateAddressForm
        domains={["example.com"]}
        maxReceivedEmailsPerAddress={250}
      />
    );

    await waitFor(() =>
      expect(
        (screen.getByLabelText("Max stored emails") as HTMLInputElement).value
      ).toBe("250")
    );
  });

  it("blocks submit until the limit action is selected explicitly", async () => {
    mockedUseCreateAddressMutation.mockReturnValue(
      createMutation as unknown as ReturnType<typeof useCreateAddressMutation>
    );

    render(<CreateAddressForm domains={["example.com"]} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "ops-team" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create address" }));

    await waitFor(() =>
      expect(createMutation.mutateAsync).not.toHaveBeenCalled()
    );
    expect(
      screen.getByText("Choose what happens when the limit is reached")
    ).toBeTruthy();
  });

  it("submits with the only available domain when domains load after mount", async () => {
    createMutation.mutateAsync.mockResolvedValue({
      address: "mailbox01@spinupmail.dev",
    });

    const { rerender } = render(
      <CreateAddressForm domains={[]} isDomainsLoading />
    );

    rerender(
      <CreateAddressForm
        domains={["spinupmail.dev"]}
        isDomainsLoading={false}
      />
    );

    expect(
      (screen.getByDisplayValue("spinupmail.dev") as HTMLInputElement).disabled
    ).toBe(true);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "mailbox01" },
    });
    fireEvent.click(screen.getByText("Delete all"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create address" }));

    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          localPart: "mailbox01",
          domain: "spinupmail.dev",
          maxReceivedEmailAction: "cleanAll",
          acceptedRiskNotice: true,
        })
      )
    );
    expect(screen.queryByText("Domain is required")).toBeNull();
    expect(
      screen.queryByText("Select one of the available domains")
    ).toBeNull();
  });
});
