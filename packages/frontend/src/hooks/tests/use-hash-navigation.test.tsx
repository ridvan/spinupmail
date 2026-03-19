import * as React from "react";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHashNavigation } from "@/hooks/use-hash-navigation";

const HashNavigationHarness = ({ mountDelay = 0 }: { mountDelay?: number }) => {
  useHashNavigation();

  React.useEffect(() => {
    if (mountDelay === 0) {
      const target = document.createElement("div");
      target.id = "api-keys";
      document.body.appendChild(target);

      return () => {
        target.remove();
      };
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.createElement("div");
      target.id = "api-keys";
      document.body.appendChild(target);
    }, mountDelay);

    return () => {
      window.clearTimeout(timeoutId);
      document.getElementById("api-keys")?.remove();
    };
  }, [mountDelay]);

  return null;
};

describe("useHashNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries until the hash target exists", async () => {
    const scrollIntoView = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <MemoryRouter initialEntries={["/settings#api-keys"]}>
        <HashNavigationHarness mountDelay={120} />
      </MemoryRouter>
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is no hash target", () => {
    const scrollIntoView = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <HashNavigationHarness />
      </MemoryRouter>
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
