import { render, screen } from "@testing-library/react";
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

describe("SettingsPage", () => {
  it("renders all settings sections", () => {
    render(<SettingsPage />);

    expect(screen.getByTestId("user-profile-panel")).toBeTruthy();
    expect(screen.getByTestId("change-password-panel")).toBeTruthy();
    expect(screen.getByTestId("two-factor-panel")).toBeTruthy();
    expect(screen.getByTestId("api-keys-panel")).toBeTruthy();
  });
});
