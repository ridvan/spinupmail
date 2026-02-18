import { isAddressConflictError } from "@/shared/errors";

describe("shared errors", () => {
  it("detects unique address conflicts from nested drizzle+d1 causes", () => {
    const error = {
      message:
        'Failed query: insert into email_addresses ... params: ["qz@spinupmail.com"]',
      cause: {
        message:
          "D1_ERROR: UNIQUE constraint failed:\n  email_addresses.address: SQLITE_CONSTRAINT",
        cause: {
          message:
            "UNIQUE constraint failed:\n  email_addresses.address: SQLITE_CONSTRAINT",
        },
      },
    };

    expect(isAddressConflictError(error)).toBe(true);
  });

  it("does not flag non-address errors as conflict", () => {
    const error = {
      message: "Failed query",
      cause: {
        message: "SQLITE_ERROR: no such table: email_addresses",
      },
    };

    expect(isAddressConflictError(error)).toBe(false);
  });
});
