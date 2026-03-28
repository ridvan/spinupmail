import { describe, expect, it, vi } from "vitest";
import {
  chunkArray,
  deleteR2ObjectsByPrefix,
  getRawEmailR2Key,
} from "@/shared/utils/r2";

describe("shared r2 utils", () => {
  it("keeps the full array together when chunk size is non-positive", () => {
    expect(chunkArray([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });

  it("lists paginated objects and deletes them in batches of 1000", async () => {
    const firstBatch = Array.from({ length: 1000 }, (_, index) => ({
      key: `email-raw/org/address/${index}.eml`,
    }));
    const secondBatch = [
      {
        key: "email-raw/org/address/1000.eml",
      },
      {
        key: "email-raw/org/address/1001.eml",
      },
    ];
    const bucket = {
      list: vi
        .fn()
        .mockResolvedValueOnce({
          objects: firstBatch,
          truncated: true,
          cursor: "page-2",
        })
        .mockResolvedValueOnce({
          objects: secondBatch,
          truncated: false,
          cursor: undefined,
        }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    await deleteR2ObjectsByPrefix({
      bucket: bucket as never,
      prefix: "email-raw/org/address/",
    });

    expect(bucket.list).toHaveBeenNthCalledWith(1, {
      prefix: "email-raw/org/address/",
      cursor: undefined,
      limit: 1000,
    });
    expect(bucket.list).toHaveBeenNthCalledWith(2, {
      prefix: "email-raw/org/address/",
      cursor: "page-2",
      limit: 1000,
    });
    expect(bucket.delete).toHaveBeenCalledTimes(2);
    expect(bucket.delete).toHaveBeenNthCalledWith(
      1,
      firstBatch.map(object => object.key)
    );
    expect(bucket.delete).toHaveBeenNthCalledWith(
      2,
      secondBatch.map(object => object.key)
    );
  });

  it("builds stable raw email storage keys", () => {
    expect(
      getRawEmailR2Key({
        organizationId: "org-1",
        addressId: "address-1",
        emailId: "email-1",
      })
    ).toBe("email-raw/org-1/address-1/email-1.eml");
  });
});
