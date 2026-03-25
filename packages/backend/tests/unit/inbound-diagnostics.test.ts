import {
  logInboundInfo,
  normalizeInboundRawSize,
  safeJsonStringify,
} from "@/modules/inbound-email/diagnostics";

describe("inbound email diagnostics", () => {
  it("accepts non-negative safe integer numbers", () => {
    expect(normalizeInboundRawSize(42)).toEqual({
      ok: true,
      value: 42,
    });
  });

  it("converts supported bigint values to numbers", () => {
    expect(normalizeInboundRawSize(42n)).toEqual({
      ok: true,
      value: 42,
    });
  });

  it("rejects bigint values above Number.MAX_SAFE_INTEGER", () => {
    expect(
      normalizeInboundRawSize(BigInt(Number.MAX_SAFE_INTEGER) + 1n)
    ).toEqual({
      ok: false,
      reason: "rawSize bigint exceeds Number.MAX_SAFE_INTEGER",
      receivedType: "bigint",
      receivedValue: String(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    });
  });

  it("rejects invalid rawSize inputs", () => {
    expect(normalizeInboundRawSize(-1)).toEqual({
      ok: false,
      reason: "rawSize number must be a non-negative safe integer",
      receivedType: "number",
      receivedValue: "-1",
    });
    expect(normalizeInboundRawSize("42")).toEqual({
      ok: false,
      reason: "rawSize must be a number or bigint",
      receivedType: "string",
      receivedValue: "42",
    });
  });

  it("serializes bigint, errors, and circular references without throwing", () => {
    const error = new Error("boom");
    const payload: Record<string, unknown> = {
      rawSize: 42n,
      error,
    };
    payload.self = payload;

    expect(() => safeJsonStringify(payload)).not.toThrow();

    const parsed = JSON.parse(safeJsonStringify(payload)) as {
      rawSize: string;
      error: {
        name: string;
        message: string;
      };
      self: string;
    };

    expect(parsed.rawSize).toBe("42");
    expect(parsed.error.name).toBe("Error");
    expect(parsed.error.message).toBe("boom");
    expect(parsed.self).toBe("[Circular]");
  });

  it("swallows console logging failures", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("logger down");
    });

    try {
      expect(() =>
        logInboundInfo("[email] test log", {
          rawSize: 1n,
        })
      ).not.toThrow();
    } finally {
      infoSpy.mockRestore();
    }
  });
});
