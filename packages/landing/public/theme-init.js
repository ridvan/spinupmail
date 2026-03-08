(() => {
  const storageKey = "spinupmail-theme";
  const root = document.documentElement;

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const theme =
      storedTheme === "light" ||
      storedTheme === "dark" ||
      storedTheme === "system"
        ? storedTheme
        : "system";
    const resolvedTheme =
      theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    root.classList.toggle("dark", resolvedTheme === "dark");
  } catch {
    root.classList.toggle(
      "dark",
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }
})();
