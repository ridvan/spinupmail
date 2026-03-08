import { describe, expect, it } from "vitest";
import {
  getEmailDomain,
  normalizeEmailAddress,
  normalizeDomain,
} from "@/platform/auth/email-address";

describe("email qualification", () => {
  it("normalizes gmail aliases into a stable canonical form", () => {
    expect(normalizeEmailAddress(" Foo.Bar+promo@googlemail.com ")).toBe(
      "foobar@gmail.com"
    );
  });

  it("keeps non-gmail plus aliases unchanged", () => {
    expect(normalizeEmailAddress("person+tag@example.com")).toBe(
      "person+tag@example.com"
    );
  });

  it("extracts the normalized domain", () => {
    expect(getEmailDomain(" Foo.Bar+promo@googlemail.com ")).toBe("gmail.com");
  });

  it("rejects impractical local-part punctuation", () => {
    expect(
      normalizeEmailAddress(
        "asd_zxc****21q3bgf4%&^+%'^+^'!54&/+%/+%&'+!@example.com"
      )
    ).toBeNull();
  });

  it("rejects consecutive dots in the local part", () => {
    expect(normalizeEmailAddress("john..doe@example.com")).toBeNull();
  });

  it("rejects domains with invalid label endings", () => {
    expect(normalizeEmailAddress("john@example-.com")).toBeNull();
    expect(normalizeEmailAddress("john@-example.com")).toBeNull();
  });

  it("normalizes raw domain values for blocklist checks", () => {
    expect(normalizeDomain("@Mailinator.com.")).toBe("mailinator.com");
  });
});
