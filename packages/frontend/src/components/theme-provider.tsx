import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_CHANGE_EVENT = "theme-change";

const isTheme = (value: string | null): value is Theme =>
  value === "dark" || value === "light" || value === "system";

const getStoredTheme = (storageKey: string, defaultTheme: Theme): Theme => {
  const storedTheme = localStorage.getItem(storageKey);
  return isTheme(storedTheme) ? storedTheme : defaultTheme;
};

const resolveTheme = (theme: Theme) => {
  if (theme !== "system") return theme;
  return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
};

const applyTheme = (theme: Theme) => {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolveTheme(theme));
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const getSnapshot = useCallback(
    () => getStoredTheme(storageKey, defaultTheme),
    [storageKey, defaultTheme]
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);

      const handleThemeStoreChange = () => {
        applyTheme(getSnapshot());
        onStoreChange();
      };

      const handleStorageChange = (event: StorageEvent) => {
        if (event.key && event.key !== storageKey) return;
        handleThemeStoreChange();
      };

      const handleThemeChangeEvent = (event: Event) => {
        const customEvent = event as CustomEvent<{ storageKey?: string }>;
        if (customEvent.detail?.storageKey !== storageKey) return;
        handleThemeStoreChange();
      };

      const handleSystemThemeChange = () => {
        if (getSnapshot() !== "system") return;
        applyTheme("system");
      };

      window.addEventListener("storage", handleStorageChange);
      window.addEventListener(THEME_CHANGE_EVENT, handleThemeChangeEvent);
      mediaQuery.addEventListener("change", handleSystemThemeChange);

      handleThemeStoreChange();

      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChangeEvent);
        mediaQuery.removeEventListener("change", handleSystemThemeChange);
      };
    },
    [getSnapshot, storageKey]
  );

  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultTheme
  );

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme);
      window.dispatchEvent(
        new CustomEvent(THEME_CHANGE_EVENT, { detail: { storageKey } })
      );
    },
    [storageKey]
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme, setTheme]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
