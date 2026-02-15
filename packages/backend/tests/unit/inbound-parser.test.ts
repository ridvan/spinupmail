import fc from "fast-check";
import {
  capTextForStorage,
  extractBodiesFromRaw,
  readRawWithLimit,
  sanitizeEmailHtml,
} from "@/modules/inbound-email/parser";

const streamFromChunks = (chunks: string[]) => {
  const encoded = chunks.map(chunk => new TextEncoder().encode(chunk));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = encoded.shift();
      if (!next) {
        controller.close();
        return;
      }
      controller.enqueue(next);
    },
  });
};

describe("inbound email parser", () => {
  it("reads stream up to the limit and marks truncated payloads", async () => {
    const stream = streamFromChunks(["hello", " world"]);
    const result = await readRawWithLimit(stream, 5);

    expect(result.raw).toBe("hello");
    expect(result.bytes).toBe(5);
    expect(result.truncated).toBe(true);
  });

  it("caps oversized text payloads for DB storage", () => {
    expect(capTextForStorage("hello", 10)).toBe("hello");
    expect(capTextForStorage("hello", 4)).toBeUndefined();
  });

  it("sanitizes html and strips script tags", () => {
    const html = sanitizeEmailHtml(
      '<a href="https://example.com">link</a><script>alert(1)</script>'
    );
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).not.toContain("<script>");
  });

  it("extracts text and attachments from multipart raw MIME", async () => {
    const raw = [
      "From: sender@example.com",
      "To: recipient@example.com",
      "Subject: Test",
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="abc"',
      "",
      "--abc",
      'Content-Type: text/plain; charset="utf-8"',
      "",
      "Hello from parser test",
      "--abc",
      'Content-Type: text/plain; name="report.txt"',
      'Content-Disposition: attachment; filename="report.txt"',
      "Content-Transfer-Encoding: base64",
      "",
      "aGVsbG8=",
      "--abc--",
      "",
    ].join("\r\n");

    const parsed = await extractBodiesFromRaw(new TextEncoder().encode(raw));

    expect(parsed.text).toContain("Hello from parser test");
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]?.filename).toBe("report.txt");
    expect(parsed.attachments[0]?.size).toBe(5);
  });

  it("safely handles malformed MIME payloads", async () => {
    const parsed = await extractBodiesFromRaw(
      new Uint8Array([0xff, 0x00, 0x10])
    );
    expect(parsed.attachments).toEqual([]);
  });

  it("property check: capTextForStorage returns undefined when utf8 bytes exceed max", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 32 }),
        (value, max) => {
          const output = capTextForStorage(value, max);
          const bytes = new TextEncoder().encode(value).byteLength;

          if (value.length === 0) {
            expect(output).toBeUndefined();
            return;
          }

          if (bytes <= max) {
            expect(output).toBe(value);
          } else {
            expect(output).toBeUndefined();
          }
        }
      )
    );
  });
});
