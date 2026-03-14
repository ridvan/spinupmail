import {
  deleteEmailsForAddress,
  insertInboundEmail,
} from "@/modules/inbound-email/repo";

const createPreparedStatement = (query: string) => {
  const statement = {
    query,
    values: [] as unknown[],
    bind(...values: unknown[]) {
      statement.values = values;
      return statement;
    },
  };

  return statement;
};

describe("inbound email repo", () => {
  it("batches email row and FTS row insertion atomically", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<typeof insertInboundEmail>[0];

    await insertInboundEmail(db, {
      id: "email-1",
      addressId: "address-1",
      messageId: "message-1",
      sender: "John Smith <john@example.com>",
      from: "john@example.com",
      to: "inbox@example.com",
      subject: "Hello",
      headers: "[]",
      bodyHtml: "<p>Hello</p>",
      bodyText: "Hello",
      raw: "RAW",
      rawSize: 42,
      rawTruncated: false,
      receivedAt: new Date("2026-03-09T00:00:00.000Z"),
    });

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("deletes email rows before deleting matching FTS rows in one batch", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const where = vi
      .fn()
      .mockResolvedValue([{ id: "email-1" }, { id: "email-2" }]);
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where,
      })),
    }));
    const db = {
      $client: {
        batch,
        prepare,
      },
      select,
    } as unknown as Parameters<typeof deleteEmailsForAddress>[0];

    await deleteEmailsForAddress(db, "address-1");

    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0]?.[0] as Array<{ query: string }>;
    expect(statements[0]?.query).toContain(
      "DELETE FROM emails WHERE address_id = ?"
    );
    expect(statements[1]?.query).toContain(
      "DELETE FROM emails_search WHERE email_id IN (?, ?)"
    );
  });
});
