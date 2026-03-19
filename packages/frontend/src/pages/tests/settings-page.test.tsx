import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/pages/settings-page";

vi.mock("@/features/settings/components/user-profile-panel", () => ({
  UserProfilePanel: ({
    withCard = true,
    wrapperId,
    wrapperClassName,
    headerClassName,
    contentClassName,
  }: {
    withCard?: boolean;
    wrapperId?: string;
    wrapperClassName?: string;
    headerClassName?: string;
    contentClassName?: string;
  }) => (
    <div
      data-testid="user-profile-panel"
      data-with-card={String(withCard)}
      data-wrapper-id={wrapperId ?? ""}
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
    wrapperId,
    wrapperClassName,
    headerClassName,
    contentClassName,
  }: {
    withCard?: boolean;
    wrapperId?: string;
    wrapperClassName?: string;
    headerClassName?: string;
    contentClassName?: string;
  }) => (
    <div
      data-testid="change-password-panel"
      data-with-card={String(withCard)}
      data-wrapper-id={wrapperId ?? ""}
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

    const responsiveGrid = cards[0]?.firstElementChild;
    expect(responsiveGrid).toBeTruthy();
    expect(responsiveGrid?.getAttribute("class")).toContain(
      "lg:grid-rows-[auto_1fr]"
    );

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
    expect(desktopUserProfilePanel.getAttribute("data-wrapper-id")).toBe(
      "profile"
    );
    expect(desktopChangePasswordPanel.getAttribute("data-wrapper-id")).toBe(
      "password"
    );

    const separators = container.querySelectorAll('[data-slot="separator"]');
    expect(separators).toHaveLength(2);
    const verticalSeparator = Array.from(separators).find(separator =>
      separator.className.includes("lg:block")
    );
    expect(verticalSeparator).toBeTruthy();
    expect(
      verticalSeparator?.getAttribute("data-orientation") === "vertical" ||
        verticalSeparator?.getAttribute("aria-orientation") === "vertical" ||
        verticalSeparator?.hasAttribute("data-vertical")
    ).toBe(true);
    expect(
      desktopUserProfilePanel.compareDocumentPosition(
        desktopChangePasswordPanel
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const twoFactorSection = screen
      .getByTestId("two-factor-panel")
      .closest("section");
    const apiKeysSection = screen
      .getByTestId("api-keys-panel")
      .closest("section");

    expect(twoFactorSection?.id).toBe("two-factor");
    expect(apiKeysSection?.id).toBe("api-keys");
  });
});
