type ExtensionAuthHandoffRow = {
  envelope: string;
  expiresAtMs: number;
};

const INSERT_EXTENSION_AUTH_HANDOFF_SQL =
  "INSERT INTO extension_auth_handoffs (code, envelope, expires_at)";
const DELETE_EXTENSION_AUTH_HANDOFF_SQL = "DELETE FROM extension_auth_handoffs";

const assertDeleteExtensionAuthHandoffArgs = (
  args: unknown[]
): asserts args is [string, number] => {
  if (
    args.length !== 2 ||
    typeof args[0] !== "string" ||
    typeof args[1] !== "number"
  ) {
    throw new Error(
      `Invalid D1 bind args for extension auth handoff delete/select: ${JSON.stringify(args)}`
    );
  }
};

const assertInsertExtensionAuthHandoffArgs = (
  args: unknown[]
): asserts args is [string, string, number] => {
  if (
    args.length !== 3 ||
    typeof args[0] !== "string" ||
    typeof args[1] !== "string" ||
    typeof args[2] !== "number"
  ) {
    throw new Error(
      `Invalid D1 bind args for extension auth handoff insert: ${JSON.stringify(args)}`
    );
  }
};

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
            assertDeleteExtensionAuthHandoffArgs(args);
            const [code, now] = args;
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

            assertInsertExtensionAuthHandoffArgs(args);
            const [code, envelope, expiresAtMs] = args;
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
