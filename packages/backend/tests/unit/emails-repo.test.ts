import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import {
  buildDeleteEmailSearchEntriesByAddressIdStatement,
  buildDeleteEmailByIdAndAddressStatement,
  buildDeleteEmailSearchEntriesByEmailIdsStatement,
  buildDeleteEmailSearchEntryByEmailIdStatement,
  buildDecrementAddressEmailCountStatement,
  buildInsertEmailSearchEntryStatement,
  deleteEmailSearchEntriesByEmailIds,
  deleteEmailSearchEntryByEmailId,
  findAddressByIdAndOrganization,
  findAddressByValueAndOrganization,
  findAttachmentByIdsAndOrganization,
  findAttachmentCountsForEmails,
  findAttachmentKeysByEmailAndOrganization,
  findEmailAttachmentsByEmailAndOrganization,
  findEmailDeleteTargetByIdAndOrganization,
  findEmailDetailByIdAndOrganization,
  findEmailRawSourceByIdAndOrganization,
  insertEmailSearchEntry,
  listEmailsForAddress,
  maybeBuildDeleteEmailSearchEntriesByEmailIdsStatement,
  searchEmailsForAddress,
} from "@/modules/emails/repo";

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

const createSelectChain = () => {
  const state: {
    where?: unknown;
    orderBy?: unknown[];
    groupBy?: unknown[];
    innerJoinOns?: unknown[];
  } = {};

  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn((_: unknown, on: unknown) => {
      state.innerJoinOns = [...(state.innerJoinOns ?? []), on];
      return chain;
    }),
    where: vi.fn((value: unknown) => {
      state.where = value;
      return chain;
    }),
    groupBy: vi.fn((...values: unknown[]) => {
      state.groupBy = values;
      return chain;
    }),
    orderBy: vi.fn((...values: unknown[]) => {
      state.orderBy = values;
      return chain;
    }),
    get: vi.fn(() => Promise.resolve(null)),
  };

  const db = {
    select: vi.fn(() => chain),
  } as unknown as AppDbLike;

  return { db, state, chain };
};

type AppDbLike = {
  select: ReturnType<typeof vi.fn>;
};

describe("emails repo", () => {
  it("rejects empty email id lists in the strict builder", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof buildDeleteEmailSearchEntriesByEmailIdsStatement
    >[0];

    expect(() =>
      buildDeleteEmailSearchEntriesByEmailIdsStatement(db, [])
    ).toThrowError("emailIds must not be empty");
  });

  it("returns null for empty email id lists in the conditional builder", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof maybeBuildDeleteEmailSearchEntriesByEmailIdsStatement
    >[0];

    expect(
      maybeBuildDeleteEmailSearchEntriesByEmailIdsStatement(db, [])
    ).toBeNull();
  });

  it("builds a single-email FTS delete statement", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof buildDeleteEmailSearchEntryByEmailIdStatement
    >[0];

    const statement = buildDeleteEmailSearchEntryByEmailIdStatement(
      db,
      "email-1"
    ) as { query: string; values: unknown[] };

    expect(statement.query).toContain(
      "DELETE FROM emails_search WHERE email_id = ?"
    );
    expect(statement.values).toEqual(["email-1"]);
  });

  it("builds an address-scoped FTS delete statement", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof buildDeleteEmailSearchEntriesByAddressIdStatement
    >[0];

    const statement = buildDeleteEmailSearchEntriesByAddressIdStatement(
      db,
      "address-1"
    ) as { query: string; values: unknown[] };

    expect(statement.query).toContain("DELETE FROM emails_search");
    expect(statement.query).toContain(
      "SELECT id FROM emails WHERE address_id = ?"
    );
    expect(statement.values).toEqual(["address-1"]);
  });

  it("builds a decrement statement for the address email count", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof buildDecrementAddressEmailCountStatement
    >[0];

    const statement = buildDecrementAddressEmailCountStatement(
      db,
      "address-1"
    ) as { query: string; values: unknown[] };

    expect(statement.query).toContain("UPDATE email_addresses");
    expect(statement.query).toContain(
      "SET email_count = max(email_count - 1, 0)"
    );
    expect(statement.values).toEqual(["address-1"]);
  });

  it("builds and executes insert/delete search-entry statements with normalized empty fields", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const prepare = vi.fn().mockImplementation((query: string) => {
      const statement = createPreparedStatement(query) as {
        query: string;
        values: unknown[];
        bind: (...values: unknown[]) => unknown;
        run?: () => Promise<void>;
      };
      statement.run = run;
      return statement;
    });
    const db = {
      $client: {
        prepare,
      },
    } as unknown as Parameters<typeof insertEmailSearchEntry>[0]["db"];

    const built = buildInsertEmailSearchEntryStatement({
      db,
      emailId: "email-1",
      senderAddress: "sender@example.com",
    }) as { query: string; values: unknown[] };

    expect(built.query).toContain("INSERT INTO emails_search");
    expect(built.values).toEqual(["", "", "sender@example.com", "", "email-1"]);

    await insertEmailSearchEntry({
      db,
      emailId: "email-2",
      senderAddress: "sender@example.com",
    });
    await deleteEmailSearchEntryByEmailId(db, "email-2");

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("builds address-scoped delete statements for email rows", () => {
    const db = {
      $client: {
        prepare: vi.fn((query: string) => createPreparedStatement(query)),
      },
    } as unknown as Parameters<
      typeof buildDeleteEmailByIdAndAddressStatement
    >[0];

    const statement = buildDeleteEmailByIdAndAddressStatement(
      db,
      "email-1",
      "address-1"
    ) as { query: string; values: unknown[] };

    expect(statement.query).toContain(
      "DELETE FROM emails WHERE id = ? AND address_id = ?"
    );
    expect(statement.values).toEqual(["email-1", "address-1"]);
  });

  it("deletes multiple email search entries when ids are provided", async () => {
    const statement = createPreparedStatement("");
    statement.run = vi.fn().mockResolvedValue(undefined);
    const db = {
      $client: {
        prepare: vi.fn((query: string) => {
          statement.query = query;
          return statement;
        }),
      },
    } as unknown as Parameters<typeof deleteEmailSearchEntriesByEmailIds>[0];

    await deleteEmailSearchEntriesByEmailIds(db, ["email-1", "email-2"]);

    expect(statement.query).toContain("WHERE email_id IN (?, ?)");
    expect(statement.values).toEqual(["email-1", "email-2"]);
    expect(statement.run).toHaveBeenCalledTimes(1);
  });

  it("returns no search results for punctuation-only queries without touching the database", async () => {
    const prepare = vi.fn();
    const db = {
      $client: {
        prepare,
      },
    } as unknown as Parameters<typeof searchEmailsForAddress>[0]["db"];

    await expect(
      searchEmailsForAddress({
        db,
        addressId: "address-1",
        search: " !!! ",
        limit: 10,
      })
    ).resolves.toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("binds ranked FTS search queries and normalizes result row types", async () => {
    const statement = {
      query: "",
      values: [] as unknown[],
      bind(...values: unknown[]) {
        statement.values = values;
        return statement;
      },
      all: vi.fn().mockResolvedValue({
        results: [
          {
            id: "email-1",
            addressId: "address-1",
            sender: "Sender",
            to: "inbox@spinupmail.com",
            from: "sender@example.com",
            subject: "Invoice",
            messageId: "msg-1",
            rawSize: 42,
            rawTruncated: 1,
            isSample: 0,
            receivedAtMs: new Date("2026-03-28T10:00:00.000Z").getTime(),
            hasHtml: 1,
            hasText: 0,
          },
        ],
      }),
    };
    const prepare = vi.fn((query: string) => {
      statement.query = query;
      return statement;
    });
    const db = {
      $client: {
        prepare,
      },
    } as unknown as Parameters<typeof searchEmailsForAddress>[0]["db"];

    await expect(
      searchEmailsForAddress({
        db,
        addressId: "address-1",
        search: "Invoice 2026",
        limit: 5,
      })
    ).resolves.toEqual([
      {
        id: "email-1",
        addressId: "address-1",
        sender: "Sender",
        to: "inbox@spinupmail.com",
        from: "sender@example.com",
        subject: "Invoice",
        messageId: "msg-1",
        rawSize: 42,
        rawTruncated: true,
        isSample: false,
        receivedAtMs: new Date("2026-03-28T10:00:00.000Z").getTime(),
        receivedAt: new Date("2026-03-28T10:00:00.000Z"),
        hasHtml: 1,
        hasText: 0,
      },
    ]);
    expect(statement.query).toContain("bm25(emails_search");
    expect(statement.values).toEqual(['"invoice" AND "2026"*', "address-1", 5]);
  });

  it("treats a trailing space as a completed final token in FTS queries", async () => {
    const statement = {
      query: "",
      values: [] as unknown[],
      bind(...values: unknown[]) {
        statement.values = values;
        return statement;
      },
      all: vi.fn().mockResolvedValue({
        results: [],
      }),
    };
    const db = {
      $client: {
        prepare: vi.fn(() => statement),
      },
    } as unknown as Parameters<typeof searchEmailsForAddress>[0]["db"];

    await searchEmailsForAddress({
      db,
      addressId: "address-1",
      search: "Invoice 2026 ",
      limit: 5,
    });

    expect(statement.values[0]).toBe('"invoice" AND "2026"');
  });

  it("builds bounded address listings with after and before filters", () => {
    const state: {
      where?: unknown;
      orderBy?: unknown[];
      limit?: number;
    } = {};
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn((value: unknown) => {
        state.where = value;
        return chain;
      }),
      orderBy: vi.fn((...values: unknown[]) => {
        state.orderBy = values;
        return chain;
      }),
      limit: vi.fn((value: number) => {
        state.limit = value;
        return chain;
      }),
    };
    const db = {
      select: vi.fn(() => chain),
    } as unknown as Parameters<typeof listEmailsForAddress>[0]["db"];

    listEmailsForAddress({
      db,
      addressId: "address-1",
      after: new Date("2026-03-28T09:00:00.000Z"),
      before: new Date("2026-03-28T11:00:00.000Z"),
      order: "asc",
      limit: 50,
    });

    expect(state.limit).toBe(50);
    const where = renderSql(state.where);
    expect(where.sql).toContain('"emails"."address_id" = ?');
    expect(where.sql).toContain('"emails"."received_at" >= ?');
    expect(where.sql).toContain('"emails"."received_at" <= ?');
    expect(where.params).toEqual([
      "address-1",
      new Date("2026-03-28T09:00:00.000Z").getTime(),
      new Date("2026-03-28T11:00:00.000Z").getTime(),
    ]);
    expect(renderSql(state.orderBy?.[0]).sql).toContain(
      '"emails"."received_at" asc'
    );
  });

  it("returns an empty attachment-count list without issuing a select when no emails are provided", async () => {
    const db = {
      select: vi.fn(),
    } as unknown as Parameters<typeof findAttachmentCountsForEmails>[0];

    await expect(
      findAttachmentCountsForEmails(db, "org-1", [])
    ).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("scopes address lookups to the organization by id or raw value", async () => {
    const byId = createSelectChain();
    const byValue = createSelectChain();

    findAddressByIdAndOrganization(byId.db as never, "org-1", "address-1");
    findAddressByValueAndOrganization(
      byValue.db as never,
      "org-1",
      "ops@spinupmail.com"
    );

    expect(renderSql(byId.state.where).params).toEqual(["address-1", "org-1"]);
    expect(renderSql(byValue.state.where).params).toEqual([
      "ops@spinupmail.com",
      "org-1",
    ]);
  });

  it("groups attachment counts by email within the organization", () => {
    const { db, state } = createSelectChain();

    findAttachmentCountsForEmails(db as never, "org-1", ["email-1", "email-2"]);

    const where = renderSql(state.where);
    expect(where.sql).toContain('"email_attachments"."organization_id" = ?');
    expect(where.sql).toContain("in (?, ?)");
    expect(where.params).toEqual(["org-1", "email-1", "email-2"]);
    expect(state.groupBy).toHaveLength(1);
  });

  it("keeps email detail and delete-target lookups organization scoped", () => {
    const detail = createSelectChain();
    const raw = createSelectChain();
    const del = createSelectChain();

    findEmailDetailByIdAndOrganization(detail.db as never, "org-1", "email-1");
    findEmailRawSourceByIdAndOrganization(raw.db as never, "org-1", "email-1");
    findEmailDeleteTargetByIdAndOrganization(
      del.db as never,
      "org-1",
      "email-1"
    );

    const detailJoin = renderSql(detail.state.innerJoinOns?.[0]);
    const rawJoin = renderSql(raw.state.innerJoinOns?.[0]);
    const deleteJoin = renderSql(del.state.innerJoinOns?.[0]);

    expect(detailJoin.sql).toContain('"email_addresses"."organization_id" = ?');
    expect([
      ...detailJoin.params,
      ...renderSql(detail.state.where).params,
    ]).toEqual(["org-1", "email-1"]);
    expect(rawJoin.sql).toContain('"email_addresses"."organization_id" = ?');
    expect([...rawJoin.params, ...renderSql(raw.state.where).params]).toEqual([
      "org-1",
      "email-1",
    ]);
    expect(deleteJoin.sql).toContain('"email_addresses"."organization_id" = ?');
    expect([
      ...deleteJoin.params,
      ...renderSql(del.state.where).params,
    ]).toEqual(["org-1", "email-1"]);
  });

  it("orders attachment lists by creation time and scopes attachment queries", () => {
    const attachments = createSelectChain();
    const singleAttachment = createSelectChain();
    const attachmentKeys = createSelectChain();

    findEmailAttachmentsByEmailAndOrganization(
      attachments.db as never,
      "org-1",
      "email-1"
    );
    findAttachmentByIdsAndOrganization(
      singleAttachment.db as never,
      "org-1",
      "email-1",
      "attachment-1"
    );
    findAttachmentKeysByEmailAndOrganization(
      attachmentKeys.db as never,
      "org-1",
      "email-1"
    );

    expect(renderSql(attachments.state.where).params).toEqual([
      "email-1",
      "org-1",
    ]);
    expect(renderSql(attachments.state.orderBy?.[0]).sql).toContain(
      '"email_attachments"."created_at" asc'
    );
    expect(renderSql(singleAttachment.state.where).params).toEqual([
      "attachment-1",
      "email-1",
      "org-1",
    ]);
    expect(renderSql(attachmentKeys.state.where).params).toEqual([
      "email-1",
      "org-1",
    ]);
  });
});
