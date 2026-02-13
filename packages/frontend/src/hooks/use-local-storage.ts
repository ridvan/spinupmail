import * as React from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Re-read when key changes (e.g. org switch)
  const prevKeyRef = React.useRef(key);
  React.useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      try {
        const item = localStorage.getItem(key);
        setStoredValue(item !== null ? (JSON.parse(item) as T) : initialValue);
      } catch {
        setStoredValue(initialValue);
      }
    }
  }, [key, initialValue]);

  // Writes to localStorage inside the state updater to avoid race conditions
  const setValue = React.useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue(prev => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore write errors (quota exceeded, incognito, etc.)
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
