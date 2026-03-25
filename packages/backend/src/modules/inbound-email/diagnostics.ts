type LogRecord = Record<string, unknown>;

type RawSizeNormalizationResult =
  | {
      ok: true;
      value: number;
    }
  | {
      ok: false;
      reason: string;
      receivedType: string;
      receivedValue: string | null;
    };

const CIRCULAR_REFERENCE_LABEL = "[Circular]";

const describeValueType = (value: unknown) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const serializeError = (error: Error, seen: WeakSet<object>) => {
  const details: LogRecord = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    details.stack = error.stack;
  }

  if ("cause" in error && error.cause !== undefined) {
    details.cause = toLogValue(error.cause, seen);
  }

  for (const [key, value] of Object.entries(error)) {
    if (key in details) continue;
    details[key] = toLogValue(value, seen);
  }

  return details;
};

const toLogValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (value === undefined) {
    return "[Undefined]";
  }

  if (typeof value === "symbol" || typeof value === "function") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array) {
    return {
      type: "Uint8Array",
      byteLength: value.byteLength,
    };
  }

  if (value instanceof Error) {
    if (seen.has(value)) {
      return CIRCULAR_REFERENCE_LABEL;
    }

    seen.add(value);
    return serializeError(value, seen);
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR_REFERENCE_LABEL;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => toLogValue(item, seen));
    }

    const serialized: LogRecord = {};
    for (const [key, entry] of Object.entries(value)) {
      serialized[key] = toLogValue(entry, seen);
    }
    return serialized;
  }

  return String(value);
};

export const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(toLogValue(value));
  } catch (error) {
    try {
      return JSON.stringify({
        loggingFailure: "safeJsonStringify_failed",
        error: toLogValue(error),
        valueType: describeValueType(value),
      });
    } catch {
      return '{"loggingFailure":"safeJsonStringify_failed"}';
    }
  }
};

const safeLog = (
  level: "info" | "warn" | "error",
  message: string,
  fields?: LogRecord
) => {
  try {
    const payload = fields ? ` ${safeJsonStringify(fields)}` : "";
    console[level](`${message}${payload}`);
  } catch {
    try {
      console[level](message);
    } catch {
      // Intentionally swallow logging failures so diagnostics never break processing.
    }
  }
};

export const logInboundInfo = (message: string, fields?: LogRecord) => {
  safeLog("info", message, fields);
};

export const logInboundWarn = (message: string, fields?: LogRecord) => {
  safeLog("warn", message, fields);
};

export const logInboundError = (message: string, fields?: LogRecord) => {
  safeLog("error", message, fields);
};

export const normalizeInboundRawSize = (
  rawSize: unknown
): RawSizeNormalizationResult => {
  if (typeof rawSize === "number") {
    if (Number.isSafeInteger(rawSize) && rawSize >= 0) {
      return {
        ok: true,
        value: rawSize,
      };
    }

    return {
      ok: false,
      reason: "rawSize number must be a non-negative safe integer",
      receivedType: "number",
      receivedValue: String(rawSize),
    };
  }

  if (typeof rawSize === "bigint") {
    if (rawSize < 0n) {
      return {
        ok: false,
        reason: "rawSize bigint must be non-negative",
        receivedType: "bigint",
        receivedValue: rawSize.toString(),
      };
    }

    if (rawSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      return {
        ok: false,
        reason: "rawSize bigint exceeds Number.MAX_SAFE_INTEGER",
        receivedType: "bigint",
        receivedValue: rawSize.toString(),
      };
    }

    return {
      ok: true,
      value: Number(rawSize),
    };
  }

  return {
    ok: false,
    reason: "rawSize must be a number or bigint",
    receivedType: describeValueType(rawSize),
    receivedValue:
      rawSize === null || rawSize === undefined ? null : String(rawSize),
  };
};
