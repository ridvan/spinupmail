type StoredObject = {
  body: Uint8Array;
  contentType?: string;
};

export class FakeR2Bucket {
  private readonly objects = new Map<string, StoredObject>();

  async put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<void> {
    this.objects.set(key, {
      body: value,
      contentType: options?.httpMetadata?.contentType,
    });
  }

  async get(key: string): Promise<{
    body?: ReadableStream<Uint8Array>;
    httpMetadata?: { contentType?: string };
  } | null> {
    const item = this.objects.get(key);
    if (!item) return null;

    return {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(item.body);
          controller.close();
        },
      }),
      httpMetadata: {
        contentType: item.contentType,
      },
    };
  }

  async delete(keys: string | string[]): Promise<void> {
    if (typeof keys === "string") {
      this.objects.delete(keys);
      return;
    }

    for (const key of keys) {
      this.objects.delete(key);
    }
  }

  async list(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix ?? "";
    const keys = [...this.objects.keys()].filter(key => key.startsWith(prefix));
    return {
      objects: keys.map(key => ({ key })),
      truncated: false,
      cursor: undefined,
    };
  }
}
