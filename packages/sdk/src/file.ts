const parseFilenameFromDisposition = (headerValue: string | null) => {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=[^']*'[^']*'([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const fallbackMatch = headerValue.match(/filename="([^"]+)"/i);
  if (fallbackMatch?.[1]) return fallbackMatch[1];

  const unquotedMatch = headerValue.match(/filename=([^;"]+)/i);
  if (unquotedMatch?.[1]) return unquotedMatch[1].trim();

  return null;
};

export class SpinupMailFile {
  readonly filename: string | null;
  readonly contentType: string | null;
  readonly contentLength: number | null;
  readonly response: Response;

  constructor(response: Response) {
    this.response = response;
    this.filename = parseFilenameFromDisposition(
      response.headers.get("content-disposition")
    );
    this.contentType = response.headers.get("content-type");

    const contentLength = response.headers.get("content-length");
    const parsed = contentLength ? Number(contentLength) : Number.NaN;
    this.contentLength =
      Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }

  arrayBuffer() {
    return this.response.clone().arrayBuffer();
  }

  text() {
    return this.response.clone().text();
  }

  blob() {
    const clone = this.response.clone() as Response & {
      blob?: () => Promise<Blob>;
    };

    if (typeof clone.blob !== "function") {
      throw new Error("Response.blob() is not available in this runtime.");
    }

    return clone.blob();
  }
}
