import * as React from "react";

const LOCAL_STORAGE_CHANGE_EVENT = "local-storage-change";

function readLocalStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === "undefined") {
    return initialValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    return item !== null ? (JSON.parse(item) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === window.localStorage && event.key === key) {
          onStoreChange();
        }
      };

      const onLocalChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ key: string }>;
        if (customEvent.detail?.key === key) {
          onStoreChange();
        }
      };

      window.addEventListener("storage", onStorage);
      window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, onLocalChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, onLocalChange);
      };
    },
    [key]
  );

  const getSnapshot = React.useCallback(
    () => readLocalStorageValue<T>(key, initialValue),
    [key, initialValue]
  );

  const storedValue = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => initialValue
  );
  const storedValueRef = React.useRef(storedValue);
  storedValueRef.current = storedValue;

  const setValue = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      if (typeof window === "undefined") {
        return;
      }

      const prevValue = storedValueRef.current;
      const nextValue =
        typeof value === "function"
          ? (value as (prev: T) => T)(prevValue)
          : value;
      storedValueRef.current = nextValue;

      try {
        window.localStorage.setItem(key, JSON.stringify(nextValue));
        window.dispatchEvent(
          new CustomEvent<{ key: string }>(LOCAL_STORAGE_CHANGE_EVENT, {
            detail: { key },
          })
        );
      } catch {
        // Ignore write errors (quota exceeded, incognito, etc.)
      }
    },
    [key]
  );

  return [storedValue, setValue];
}
