import * as React from "react";
import { useLocation } from "react-router";

const HASH_SCROLL_RETRY_DELAY_MS = 80;
const HASH_SCROLL_MAX_ATTEMPTS = 6;

const getHashTargetId = (hash: string) => {
  if (!hash.startsWith("#")) return null;

  try {
    const decodedHash = decodeURIComponent(hash.slice(1)).trim();
    return decodedHash || null;
  } catch {
    return null;
  }
};

export const scrollToHashTarget = (hash: string) => {
  const targetId = getHashTargetId(hash);
  if (!targetId) return false;

  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) return false;

  target.scrollIntoView({
    block: "start",
    inline: "nearest",
  });

  return true;
};

export const useHashNavigation = () => {
  const location = useLocation();

  React.useEffect(() => {
    if (!location.hash) return;

    let isCancelled = false;
    const timeoutIds: number[] = [];

    const scrollWithRetry = (attemptsLeft: number) => {
      if (isCancelled) return;
      if (scrollToHashTarget(location.hash)) return;
      if (attemptsLeft <= 1) return;

      const timeoutId = window.setTimeout(() => {
        scrollWithRetry(attemptsLeft - 1);
      }, HASH_SCROLL_RETRY_DELAY_MS);

      timeoutIds.push(timeoutId);
    };

    scrollWithRetry(HASH_SCROLL_MAX_ATTEMPTS);

    return () => {
      isCancelled = true;
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId));
    };
  }, [location.hash, location.pathname]);
};
