type StoredValue = {
  value: string;
  expiresAtMs: number | null;
};

export class FakeKvNamespace {
  private readonly store = new Map<string, StoredValue>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAtMs !== null && item.expiresAtMs <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const expiresAtMs =
      options?.expirationTtl && options.expirationTtl > 0
        ? Date.now() + options.expirationTtl * 1000
        : null;

    this.store.set(key, { value, expiresAtMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
