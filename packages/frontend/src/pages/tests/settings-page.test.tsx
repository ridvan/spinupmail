import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/pages/settings-page";

vi.mock("@/features/settings/components/user-profile-panel", () => ({
  UserProfilePanel: () => <div data-testid="user-profile-panel" />,
}));

vi.mock("@/features/settings/components/change-password-panel", () => ({
  ChangePasswordPanel: () => <div data-testid="change-password-panel" />,
}));

vi.mock("@/features/settings/components/two-factor-panel", () => ({
  TwoFactorPanel: () => <div data-testid="two-factor-panel" />,
}));

vi.mock("@/features/settings/components/api-keys-panel", () => ({
  ApiKeysPanel: () => <div data-testid="api-keys-panel" />,
}));

const LocationDisplay = () => {
  const location = useLocation();

  return (
    <div data-testid="location-display">{`${location.pathname}${location.hash}`}</div>
  );
};

describe("SettingsPage", () => {
  it("defaults to the profile section and shows tabs", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("tablist", { name: "Settings sections" })
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Profile", selected: true })
    ).toBeTruthy();
    expect(screen.getByTestId("user-profile-panel")).toBeTruthy();
    expect(screen.queryByTestId("change-password-panel")).toBeNull();
    expect(screen.queryByTestId("two-factor-panel")).toBeNull();
    expect(screen.queryByTestId("api-keys-panel")).toBeNull();
  });

  it("selects the section from the hash and updates the hash when tabs change", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/settings#api-keys"]}>
        <SettingsPage />
        <LocationDisplay />
      </MemoryRouter>
    );

    expect(screen.getByTestId("api-keys-panel")).toBeTruthy();
    expect(screen.queryByTestId("user-profile-panel")).toBeNull();
    expect(screen.getByTestId("location-display").textContent).toBe(
      "/settings#api-keys"
    );

    await user.click(screen.getByRole("tab", { name: "Two-Factor" }));

    expect(screen.getByTestId("two-factor-panel")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Two-Factor", selected: true })
    ).toBeTruthy();
    expect(screen.getByTestId("location-display").textContent).toBe(
      "/settings#two-factor"
    );
  });
});
