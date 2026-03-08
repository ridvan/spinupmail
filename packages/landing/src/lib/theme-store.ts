import { useSyncExternalStore } from "react";

export type LandingTheme = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "spinupmail-theme";
const THEME_CHANGE_EVENT = "spinupmail-theme-change";
const DEFAULT_THEME: LandingTheme = "system";
const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const isTheme = (value: string | null): value is LandingTheme =>
  value === "dark" || value === "light" || value === "system";

const readTheme = (): LandingTheme => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;
};

const resolveTheme = (theme: LandingTheme) => {
  if (typeof window === "undefined") {
    return "dark";
  }

  if (theme !== "system") return theme;
  return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
};

const applyTheme = (theme: LandingTheme) => {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(theme) === "dark"
  );
};

const emitThemeChange = () => {
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
};

const subscribe = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const syncTheme = () => {
    applyTheme(readTheme());
    onStoreChange();
  };

  const handleStorageChange = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage) return;
    if (event.key && event.key !== THEME_STORAGE_KEY) return;
    syncTheme();
  };

  const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
  const handleSystemThemeChange = () => {
    if (readTheme() !== "system") return;
    syncTheme();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
  mediaQuery.addEventListener("change", handleSystemThemeChange);

  syncTheme();

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
    mediaQuery.removeEventListener("change", handleSystemThemeChange);
  };
};

export function setLandingTheme(theme: LandingTheme) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  emitThemeChange();
}

export function toggleLandingTheme() {
  setLandingTheme(readTheme() === "dark" ? "light" : "dark");
}

export function useLandingTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  const resolvedTheme = resolveTheme(theme);

  return {
    isDark: resolvedTheme === "dark",
    resolvedTheme,
    theme,
    setTheme: setLandingTheme,
    toggleTheme: toggleLandingTheme,
  };
}
