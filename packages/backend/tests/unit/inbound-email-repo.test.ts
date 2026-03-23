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
  it("inserts the email row before running follow-up writes", async () => {
    const batch = vi
      .fn()
      .mockResolvedValueOnce([{ meta: { changes: 1 } }])
      .mockResolvedValueOnce([{}]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<typeof insertInboundEmail>[0];

    const result = await insertInboundEmail(db, {
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
      countAlreadyReserved: true,
    });

    expect(batch).toHaveBeenCalledTimes(2);
    const insertStatements = batch.mock.calls[0]?.[0] as Array<{
      query: string;
    }>;
    const followUpStatements = batch.mock.calls[1]?.[0] as Array<{
      query: string;
    }>;
    expect(insertStatements).toHaveLength(1);
    expect(insertStatements[0]?.query).toContain(
      "INSERT OR IGNORE INTO emails"
    );
    expect(followUpStatements).toHaveLength(1);
    expect(followUpStatements[0]?.query).toContain("INSERT INTO emails_search");
    expect(followUpStatements[0]?.query).not.toContain("WHERE changes() > 0");
    expect(result).toEqual({ inserted: true });
  });

  it("increments address counts after the insert succeeds when no slot was pre-reserved", async () => {
    const batch = vi
      .fn()
      .mockResolvedValueOnce([{ meta: { changes: 1 } }])
      .mockResolvedValueOnce([{}, {}]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<typeof insertInboundEmail>[0];

    await insertInboundEmail(db, {
      id: "email-2",
      addressId: "address-1",
      from: "john@example.com",
      to: "inbox@example.com",
      rawSize: 42,
      rawTruncated: false,
      receivedAt: new Date("2026-03-09T00:00:00.000Z"),
      countAlreadyReserved: false,
    });

    expect(batch).toHaveBeenCalledTimes(2);
    const statements = batch.mock.calls[1]?.[0] as Array<{ query: string }>;
    expect(statements).toHaveLength(2);
    expect(statements[0]?.query).toContain("UPDATE email_addresses");
    expect(statements[1]?.query).toContain("INSERT INTO emails_search");
    expect(statements[1]?.query).not.toContain("WHERE changes() > 0");
  });

  it("returns inserted=false when a matching address/message id already exists", async () => {
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 0 } }]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<typeof insertInboundEmail>[0];

    const result = await insertInboundEmail(db, {
      id: "email-3",
      addressId: "address-1",
      messageId: "message-1",
      from: "john@example.com",
      to: "inbox@example.com",
      rawSize: 42,
      rawTruncated: false,
      receivedAt: new Date("2026-03-09T00:00:00.000Z"),
      countAlreadyReserved: true,
    });

    expect(result).toEqual({ inserted: false });
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("deletes matching FTS rows before deleting email rows in one batch", async () => {
    const batch = vi.fn().mockResolvedValue([]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<typeof deleteEmailsForAddress>[0];

    await deleteEmailsForAddress(db, "address-1");

    expect(batch).toHaveBeenCalledTimes(1);
    const statements = batch.mock.calls[0]?.[0] as Array<{ query: string }>;
    expect(statements[0]?.query).toContain("DELETE FROM emails_search");
    expect(statements[1]?.query).toContain(
      "DELETE FROM emails WHERE address_id = ?"
    );
  });
});
