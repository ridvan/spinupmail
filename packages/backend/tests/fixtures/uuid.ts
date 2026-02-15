import { vi } from "vitest";

export const withMockedUuids = async <T>(
  uuids: string[],
  fn: () => T | Promise<T>
) => {
  const queue = [...uuids];
  const spy = vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    return queue.shift() ?? "00000000-0000-0000-0000-000000000000";
  });

  try {
    return await fn();
  } finally {
    spy.mockRestore();
  }
};
