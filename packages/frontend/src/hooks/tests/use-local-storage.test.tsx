import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocalStorage } from "@/hooks/use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads an existing value from localStorage on mount", () => {
    window.localStorage.setItem("theme", JSON.stringify("dark"));

    const { result } = renderHook(() =>
      useLocalStorage<string>("theme", "light")
    );

    expect(result.current[0]).toBe("dark");
  });

  it("falls back to initial value when storage is missing or invalid", () => {
    const { result: missingResult } = renderHook(() =>
      useLocalStorage<string>("missing-key", "fallback")
    );
    expect(missingResult.current[0]).toBe("fallback");

    window.localStorage.setItem("invalid-json", "{");
    const { result: invalidResult } = renderHook(() =>
      useLocalStorage<string>("invalid-json", "fallback")
    );
    expect(invalidResult.current[0]).toBe("fallback");
  });

  it("writes updated values to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage<number>("count", 0));

    act(() => {
      result.current[1](5);
    });

    expect(window.localStorage.getItem("count")).toBe("5");
    expect(result.current[0]).toBe(5);
  });

  it("uses latest persisted value for functional updates", () => {
    window.localStorage.setItem("count", "2");
    const { result } = renderHook(() => useLocalStorage<number>("count", 0));

    act(() => {
      result.current[1](prev => prev + 1);
    });

    expect(window.localStorage.getItem("count")).toBe("3");
    expect(result.current[0]).toBe(3);
  });

  it("applies multiple synchronous functional updates sequentially", () => {
    const { result } = renderHook(() => useLocalStorage<number>("count", 0));

    act(() => {
      result.current[1](prev => prev + 1);
      result.current[1](prev => prev + 1);
    });

    expect(window.localStorage.getItem("count")).toBe("2");
    expect(result.current[0]).toBe(2);
  });

  it("re-reads data when the key changes", () => {
    window.localStorage.setItem("key-a", JSON.stringify("value-a"));
    window.localStorage.setItem("key-b", JSON.stringify("value-b"));

    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string }) =>
        useLocalStorage<string>(storageKey, "fallback"),
      {
        initialProps: { storageKey: "key-a" },
      }
    );

    expect(result.current[0]).toBe("value-a");

    rerender({ storageKey: "key-b" });

    expect(result.current[0]).toBe("value-b");
  });

  it("updates when the custom local-storage event is dispatched", async () => {
    const key = "profile-name";
    window.localStorage.setItem(key, JSON.stringify("before"));

    const { result } = renderHook(() =>
      useLocalStorage<string>(key, "fallback")
    );

    act(() => {
      window.localStorage.setItem(key, JSON.stringify("after"));
      window.dispatchEvent(
        new CustomEvent<{ key: string }>("local-storage-change", {
          detail: { key },
        })
      );
    });

    await waitFor(() => expect(result.current[0]).toBe("after"));
  });
});
