import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "@/test/msw/server";

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

const createMatchMediaMock = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

beforeAll(() => {
  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  }

  if (typeof window !== "undefined") {
    const matchMedia = (query: string) => createMatchMediaMock(query);

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMedia,
    });

    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      writable: true,
      value: matchMedia,
    });
  }

  if (
    typeof Element !== "undefined" &&
    !("scrollIntoView" in Element.prototype)
  ) {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: () => {},
    });
  }

  if (
    typeof Element !== "undefined" &&
    !("getAnimations" in Element.prototype)
  ) {
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      writable: true,
      value: () => [],
    });
  }

  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
});
