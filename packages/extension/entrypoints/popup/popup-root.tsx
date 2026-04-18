import { PopupMemoryRouter } from "@/entrypoints/popup/router";
import { PopupSessionProvider } from "@/entrypoints/popup/hooks/popup-session-provider";
import { useSystemTheme } from "@/entrypoints/popup/hooks/use-system-theme";

export function PopupRoot() {
  useSystemTheme();

  return (
    <PopupSessionProvider>
      <PopupMemoryRouter />
    </PopupSessionProvider>
  );
}
