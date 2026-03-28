import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import {
  getOrganizationAttachmentStorageUsage,
  insertEmailAttachmentIfOrganizationQuotaAllows,
  deleteEmailsForAddress,
  insertInboundEmail,
  reserveInboxSlot,
} from "@/modules/inbound-email/repo";

const dialect = new SQLiteDialect();

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

const renderSql = (fragment: unknown) =>
  dialect.sqlToQuery(fragment as Parameters<typeof dialect.sqlToQuery>[0]);

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

  it("returns zero organization attachment usage when the aggregate is null", async () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      get: vi.fn().mockResolvedValue({
        totalBytes: null,
      }),
    };
    const db = {
      select: vi.fn(() => chain),
    } as unknown as Parameters<typeof getOrganizationAttachmentStorageUsage>[0];

    await expect(
      getOrganizationAttachmentStorageUsage(db, "org-1")
    ).resolves.toBe(0);
  });

  it("returns inserted=false when the attachment quota guard prevents an insert", async () => {
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 0 } }]);
    const prepare = vi.fn((query: string) => createPreparedStatement(query));
    const db = {
      $client: {
        batch,
        prepare,
      },
    } as unknown as Parameters<
      typeof insertEmailAttachmentIfOrganizationQuotaAllows
    >[0];

    await expect(
      insertEmailAttachmentIfOrganizationQuotaAllows(db, {
        id: "attachment-1",
        emailId: "email-1",
        organizationId: "org-1",
        addressId: "address-1",
        userId: "user-1",
        filename: "invoice.pdf",
        contentType: "application/pdf",
        size: 2048,
        r2Key: "attachments/org-1/address-1/email-1/attachment-1",
        maxOrganizationAttachmentStorageBytes: 1024,
      })
    ).resolves.toEqual({
      inserted: false,
    });

    const statement = batch.mock.calls[0]?.[0]?.[0] as {
      query: string;
      values: unknown[];
    };
    expect(statement.query).toContain("INSERT INTO email_attachments");
    expect(statement.query).toContain("SELECT sum(size)");
    expect(statement.values).toEqual([
      "attachment-1",
      "email-1",
      "org-1",
      "address-1",
      "user-1",
      "invoice.pdf",
      "application/pdf",
      2048,
      "attachments/org-1/address-1/email-1/attachment-1",
      null,
      null,
      "org-1",
      2048,
      1024,
    ]);
  });

  it("returns whether inbox reservation updated a row under the email-count cap", async () => {
    const state: {
      where?: unknown;
    } = {};
    const run = vi.fn().mockResolvedValue({
      meta: {
        changes: 1,
      },
    });
    const chain = {
      set: vi.fn(() => chain),
      where: vi.fn((value: unknown) => {
        state.where = value;
        return chain;
      }),
      run,
    };
    const db = {
      update: vi.fn(() => chain),
    } as unknown as Parameters<typeof reserveInboxSlot>[0]["db"];

    await expect(
      reserveInboxSlot({
        db,
        addressId: "address-1",
        maxReceivedEmailCount: 10,
      })
    ).resolves.toBe(true);

    const where = renderSql(state.where);
    expect(where.sql).toContain('"email_addresses"."id" = ?');
    expect(where.sql).toContain('"email_addresses"."email_count" < ?');
    expect(where.params).toEqual(["address-1", 10]);
  });

  it("returns false when inbox reservation does not update a row under the email-count cap", async () => {
    const state: {
      where?: unknown;
    } = {};
    const run = vi.fn().mockResolvedValue({
      meta: {
        changes: 0,
      },
    });
    const chain = {
      set: vi.fn(() => chain),
      where: vi.fn((value: unknown) => {
        state.where = value;
        return chain;
      }),
      run,
    };
    const db = {
      update: vi.fn(() => chain),
    } as unknown as Parameters<typeof reserveInboxSlot>[0]["db"];

    await expect(
      reserveInboxSlot({
        db,
        addressId: "address-1",
        maxReceivedEmailCount: 10,
      })
    ).resolves.toBe(false);

    const where = renderSql(state.where);
    expect(where.sql).toContain('"email_addresses"."id" = ?');
    expect(where.sql).toContain('"email_addresses"."email_count" < ?');
    expect(where.params).toEqual(["address-1", 10]);
  });
});
