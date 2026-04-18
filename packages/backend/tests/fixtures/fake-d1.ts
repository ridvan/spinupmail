type ExtensionAuthHandoffRow = {
  envelope: string;
  expiresAtMs: number;
};

const INSERT_EXTENSION_AUTH_HANDOFF_SQL =
  "INSERT INTO extension_auth_handoffs (code, envelope, expires_at)";
const DELETE_EXTENSION_AUTH_HANDOFF_SQL = "DELETE FROM extension_auth_handoffs";

export class FakeD1Database {
  private readonly extensionAuthHandoffs = new Map<
    string,
    ExtensionAuthHandoffRow
  >();

  constructor(
    private readonly options: {
      failInsert?: Error;
    } = {}
  ) {}

  prepare(query: string) {
    return {
      bind: (...args: unknown[]) => ({
        first: async <TRow>() => {
          if (query.includes(DELETE_EXTENSION_AUTH_HANDOFF_SQL)) {
            const [code, now] = args as [string, number];
            const row = this.extensionAuthHandoffs.get(code);

            if (!row) return null;
            if (row.expiresAtMs <= now) {
              this.extensionAuthHandoffs.delete(code);
              return null;
            }

            this.extensionAuthHandoffs.delete(code);
            return { envelope: row.envelope } as TRow;
          }

          throw new Error(`Unsupported D1 first() query: ${query}`);
        },
        run: async () => {
          if (query.includes(INSERT_EXTENSION_AUTH_HANDOFF_SQL)) {
            if (this.options.failInsert) {
              throw this.options.failInsert;
            }

            const [code, envelope, expiresAtMs] = args as [
              string,
              string,
              number,
            ];
            this.extensionAuthHandoffs.set(code, {
              envelope,
              expiresAtMs,
            });
            return;
          }

          throw new Error(`Unsupported D1 run() query: ${query}`);
        },
      }),
    };
  }
}
