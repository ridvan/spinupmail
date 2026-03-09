import fc from "fast-check";
import {
  capTextForStorage,
  extractBodiesFromRaw,
  repairLikelyMisdecodedUtf8,
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

  it("preserves safe email styles while dropping unsafe CSS constructs", () => {
    const html = sanitizeEmailHtml(
      [
        "<html><head>",
        "<style>",
        ".hero { color: #111; background-image: url('https://example.com/hero.png'); }",
        "@import url('https://example.com/fonts.css');",
        ".bad { behavior: url(#default#VML); }",
        "</style>",
        "</head><body>",
        '<table class="hero" style="margin:0; background-image:url(\'https://example.com/card.png\'); behavior:url(#bad);">',
        "<tr><td>Hello</td></tr>",
        "</table>",
        "</body></html>",
      ].join("")
    );

    expect(html).toContain("<style>");
    expect(html).toContain("background-image:url");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("behavior:");
    expect(html).toContain('class="hero"');
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

  it("repairs common utf8 mojibake in decoded html and text", () => {
    const repairedHtml = repairLikelyMisdecodedUtf8(
      "<html><body><p>â€” Example App Team</p><p>Â© 2026 Example App</p></body></html>"
    );
    const repairedText = repairLikelyMisdecodedUtf8("â€” Example App Team");

    expect(repairedHtml).toContain("— Example App Team");
    expect(repairedHtml).toContain("© 2026 Example App");
    expect(repairedHtml).not.toContain("â€”");
    expect(repairedHtml).not.toContain("Â©");
    expect(repairedText).toBe("— Example App Team");
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
