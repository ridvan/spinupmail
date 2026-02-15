import {
  buildContentDisposition,
  getUtf8ByteLength,
  sanitizeFilename,
} from "@/shared/utils/string";

describe("shared string utilities", () => {
  it("sanitizes unsafe filename characters", () => {
    expect(sanitizeFilename(" ../../some\\bad:file?.txt ")).toBe(
      ".._.._some_bad_file_.txt"
    );
  });

  it("falls back when filename is empty", () => {
    expect(sanitizeFilename("  ")).toBe("attachment");
  });

  it("builds RFC5987-compatible content disposition", () => {
    const header = buildContentDisposition('a "report".txt');
    expect(header).toContain('filename="a _report_.txt"');
    expect(header).toContain("filename*=UTF-8''a%20%22report%22.txt");
  });

  it("returns utf8 byte length", () => {
    expect(getUtf8ByteLength("abc")).toBe(3);
    expect(getUtf8ByteLength("你好")).toBe(6);
  });
});
