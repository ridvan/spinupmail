import { fireEvent, render, screen } from "@testing-library/react";
import { TimezonePanel } from "@/features/settings/components/timezone-panel";
import { useTimezone } from "@/features/timezone/hooks/use-timezone";

vi.mock("@/features/timezone/lib/timezone-options", () => ({
  getSupportedTimeZones: () => ["UTC", "America/New_York", "Europe/Istanbul"],
}));

vi.mock("@/features/timezone/hooks/use-timezone", () => ({
  useTimezone: vi.fn(),
}));

const mockedUseTimezone = vi.mocked(useTimezone);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("TimezonePanel", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("saves a manual timezone selection", async () => {
    const setTimeZone = vi.fn().mockResolvedValue(undefined);
    const clearTimeZone = vi.fn().mockResolvedValue(undefined);

    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
      savedTimeZone: null,
      sessionTimeZone: "America/New_York",
      source: "browser",
      isSaving: false,
      error: null,
      setTimeZone,
      clearTimeZone,
    });

    render(<TimezonePanel />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("combobox", { name: "Search timezones" })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));

    expect(setTimeZone).toHaveBeenCalledWith("UTC");
    expect(clearTimeZone).not.toHaveBeenCalled();
  });

  it("clears saved timezone when switching to device mode", async () => {
    const setTimeZone = vi.fn().mockResolvedValue(undefined);
    const clearTimeZone = vi.fn().mockResolvedValue(undefined);

    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "America/New_York",
      savedTimeZone: "America/New_York",
      sessionTimeZone: "America/New_York",
      source: "user",
      isSaving: false,
      error: null,
      setTimeZone,
      clearTimeZone,
    });

    render(<TimezonePanel />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save timezone" }));

    expect(clearTimeZone).toHaveBeenCalledTimes(1);
    expect(setTimeZone).not.toHaveBeenCalled();
  });

  it("clears the timezone search when manual mode is turned off", () => {
    mockedUseTimezone.mockReturnValue({
      effectiveTimeZone: "UTC",
      savedTimeZone: null,
      sessionTimeZone: "America/New_York",
      source: "browser",
      isSaving: false,
      error: null,
      setTimeZone: vi.fn(),
      clearTimeZone: vi.fn(),
    });

    render(<TimezonePanel />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const searchInput = screen.getByRole("combobox", {
      name: "Search timezones",
    });
    fireEvent.change(searchInput, { target: { value: "new york" } });
    expect((searchInput as HTMLInputElement).value).toBe("new york");

    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(
      (
        screen.getByRole("combobox", {
          name: "Search timezones",
        }) as HTMLInputElement
      ).value
    ).toBe("");
  });
});
