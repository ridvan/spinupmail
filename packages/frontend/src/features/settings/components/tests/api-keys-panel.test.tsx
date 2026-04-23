import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiKeysPanel } from "@/features/settings/components/api-keys-panel";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
} from "@/features/settings/hooks/use-api-keys";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";

vi.mock("@/features/settings/hooks/use-api-keys", () => ({
  useApiKeysQuery: vi.fn(),
  useCreateApiKeyMutation: vi.fn(),
  useDeleteApiKeyMutation: vi.fn(),
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUseApiKeysQuery = vi.mocked(useApiKeysQuery);
const mockedUseCreateApiKeyMutation = vi.mocked(useCreateApiKeyMutation);
const mockedUseDeleteApiKeyMutation = vi.mocked(useDeleteApiKeyMutation);
const mockedUseTimezone = vi.mocked(useTimezone);
const mockedToastPromise = vi.mocked(toast.promise);
const mockedToastSuccess = vi.mocked(toast.success);

const resolveToastPromise = <T,>(
  promise: Parameters<typeof toast.promise>[0]
): Promise<T> => {
  if (typeof promise === "function") {
    return promise() as Promise<T>;
  }
  return promise as Promise<T>;
};

describe("ApiKeysPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
      savedTimeZone: null,
      sessionTimeZone: "UTC",
      source: "browser",
      isSaving: false,
      error: null,
      setTimeZone: vi.fn(),
      clearTimeZone: vi.fn(),
    });

    mockedToastPromise.mockImplementation(
      ((promise: Parameters<typeof toast.promise>[0]) =>
        ({
          unwrap: () => resolveToastPromise(promise),
        }) as ReturnType<typeof toast.promise>) as typeof toast.promise
    );

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("creates an API key and allows copying the generated secret", async () => {
    const createMutateAsync = vi.fn().mockResolvedValue({
      key: "spin_live_secret_key_123",
    });
    mockedUseCreateApiKeyMutation.mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateApiKeyMutation>);
    mockedUseDeleteApiKeyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteApiKeyMutation>);
    mockedUseApiKeysQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [],
    } as unknown as ReturnType<typeof useApiKeysQuery>);

    render(<ApiKeysPanel />);

    fireEvent.change(
      screen.getByPlaceholderText("A descriptive name, e.g. 'Jenkins'"),
      {
        target: { value: "CI integration" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));

    await waitFor(() =>
      expect(createMutateAsync).toHaveBeenCalledWith("CI integration")
    );
    await waitFor(() => expect(screen.getByText("New API key")).toBeTruthy());
    const createdKeyInput = screen.getByLabelText(
      "New API key"
    ) as HTMLInputElement;
    expect(createdKeyInput.value).toBe("spin_live_secret_key_123");
    expect(createdKeyInput.type).toBe("password");
    expect(mockedToastSuccess).toHaveBeenCalledWith(
      "API key created.",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Copy" }),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Show API key" }));
    expect(createdKeyInput.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "spin_live_secret_key_123"
      )
    );
    expect(mockedToastSuccess).toHaveBeenCalledWith("API key copied.");
  });

  it("shows revoke confirmation and revokes key only after confirmation", async () => {
    const deleteMutateAsync = vi.fn().mockResolvedValue({ success: true });
    mockedUseCreateApiKeyMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateApiKeyMutation>);
    mockedUseDeleteApiKeyMutation.mockReturnValue({
      mutateAsync: deleteMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteApiKeyMutation>);
    mockedUseApiKeysQuery.mockReturnValue({
      isLoading: false,
      error: null,
      data: [
        {
          id: "key-1",
          name: "Production key",
          start: "spin_A",
          prefix: "spin_",
          createdAt: "2026-02-20T18:04:00.000Z",
        },
      ],
    } as unknown as ReturnType<typeof useApiKeysQuery>);

    render(<ApiKeysPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(screen.getByText("Revoke API key?")).toBeTruthy();
    expect(
      screen.getByText("This will immediately revoke", { exact: false })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke key" }));

    await waitFor(() =>
      expect(deleteMutateAsync).toHaveBeenCalledWith("key-1")
    );
    await waitFor(() =>
      expect(screen.queryByText("Revoke API key?")).toBeNull()
    );
  });
});
