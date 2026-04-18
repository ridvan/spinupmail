import * as React from "react";

export const useSystemTheme = () => {
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.classList.toggle("dark", mediaQuery.matches);
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);
};
