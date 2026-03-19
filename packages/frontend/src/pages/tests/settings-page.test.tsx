import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/pages/settings-page";

vi.mock("@/features/settings/components/user-profile-panel", () => ({
  UserProfilePanel: ({
    withCard = true,
    wrapperClassName,
    headerClassName,
    contentClassName,
  }: {
    withCard?: boolean;
    wrapperClassName?: string;
    headerClassName?: string;
    contentClassName?: string;
  }) => (
    <div
      data-testid="user-profile-panel"
      data-with-card={String(withCard)}
      data-wrapper-class={wrapperClassName ?? ""}
      data-header-class={headerClassName ?? ""}
      data-content-class={contentClassName ?? ""}
    >
      User Profile Section
    </div>
  ),
}));

vi.mock("@/features/settings/components/change-password-panel", () => ({
  ChangePasswordPanel: ({
    withCard = true,
    wrapperClassName,
    headerClassName,
    contentClassName,
  }: {
    withCard?: boolean;
    wrapperClassName?: string;
    headerClassName?: string;
    contentClassName?: string;
  }) => (
    <div
      data-testid="change-password-panel"
      data-with-card={String(withCard)}
      data-wrapper-class={wrapperClassName ?? ""}
      data-header-class={headerClassName ?? ""}
      data-content-class={contentClassName ?? ""}
    >
      Password Section
    </div>
  ),
}));

vi.mock("@/features/settings/components/two-factor-panel", () => ({
  TwoFactorPanel: () => <div data-testid="two-factor-panel" />,
}));

vi.mock("@/features/settings/components/api-keys-panel", () => ({
  ApiKeysPanel: () => <div data-testid="api-keys-panel" />,
}));

describe("SettingsPage", () => {
  it("renders profile and password inside one responsive card", () => {
    const { container } = render(<SettingsPage />);

    const userProfilePanels = screen.getAllByTestId("user-profile-panel");
    const changePasswordPanels = screen.getAllByTestId("change-password-panel");

    expect(userProfilePanels).toHaveLength(1);
    expect(changePasswordPanels).toHaveLength(1);

    for (const panel of [...userProfilePanels, ...changePasswordPanels]) {
      expect(panel.getAttribute("data-with-card")).toBe("false");
    }

    const cards = container.querySelectorAll('[data-slot="card"]');
    expect(cards).toHaveLength(1);

    expect(container.innerHTML).toContain("lg:grid-rows-[auto_1fr]");
    expect(container.innerHTML).toContain('orientation="vertical"');

    const desktopUserProfilePanel = userProfilePanels[0];
    const desktopChangePasswordPanel = changePasswordPanels[0];

    expect(
      desktopUserProfilePanel.getAttribute("data-wrapper-class")
    ).toContain("lg:contents");
    expect(
      desktopChangePasswordPanel.getAttribute("data-wrapper-class")
    ).toContain("lg:contents");
    expect(desktopUserProfilePanel.getAttribute("data-header-class")).toContain(
      "row-start-1"
    );
    expect(
      desktopUserProfilePanel.getAttribute("data-content-class")
    ).toContain("row-start-2");
    expect(
      desktopChangePasswordPanel.getAttribute("data-header-class")
    ).toContain("row-start-1");
    expect(
      desktopChangePasswordPanel.getAttribute("data-content-class")
    ).toContain("row-start-2");

    const separators = container.querySelectorAll('[data-slot="separator"]');
    expect(separators).toHaveLength(2);
    expect(
      desktopUserProfilePanel.compareDocumentPosition(
        desktopChangePasswordPanel
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
