import { describe, expect, it } from "vitest";
import { decryptSecret } from "@/shared/utils/encryption";

describe("encryption utils", () => {
  it("rejects parsed payloads that are not objects", async () => {
    await expect(
      decryptSecret({
        encrypted: "null",
        encodedKey: Buffer.alloc(32).toString("base64"),
      })
    ).rejects.toThrow("Encrypted payload is invalid");

    await expect(
      decryptSecret({
        encrypted: JSON.stringify("not-an-object"),
        encodedKey: Buffer.alloc(32).toString("base64"),
      })
    ).rejects.toThrow("Encrypted payload is invalid");
  });
});
