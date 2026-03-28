import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import {
  countAddressesByOrganization,
  insertAddress,
  listAddressesByOrganization,
  listRecentAddressActivityPage,
} from "@/modules/email-addresses/repo";

const dialect = new SQLiteDialect();

const renderSql = (fragment: unknown) =>
  dialect.sqlToQuery(fragment as Parameters<typeof dialect.sqlToQuery>[0]);

const createQueryChain = () => {
  const state: {
    where?: unknown;
    orderBy?: unknown[];
    limit?: number;
    offset?: number;
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
    offset: vi.fn((value: number) => {
      state.offset = value;
      return chain;
    }),
    get: vi.fn(() => Promise.resolve({ count: 0 })),
  };

  const db = {
    select: vi.fn(() => chain),
    run: vi.fn(),
  } as unknown as Parameters<typeof listAddressesByOrganization>[0]["db"];

  return { db, state, chain };
};

describe("email addresses repo", () => {
  it("escapes wildcard search terms and paginates organization lists", () => {
    const { db, state } = createQueryChain();

    listAddressesByOrganization({
      db,
      organizationId: "org-1",
      page: 3,
      pageSize: 25,
      search: " %_Foo\\Bar ",
      sortBy: "address",
      sortDirection: "asc",
    });

    expect(state.limit).toBe(25);
    expect(state.offset).toBe(50);
    const where = renderSql(state.where);
    expect(where.sql).toContain('lower("email_addresses"."address") like ?');
    expect(where.sql).toContain("escape '");
    expect(where.params).toEqual(["org-1", "%\\%\\_foo\\\\bar%"]);
  });

  it("sorts by recent activity using a stable id tie-breaker", () => {
    const { db, state } = createQueryChain();

    listAddressesByOrganization({
      db,
      organizationId: "org-1",
      page: 1,
      pageSize: 10,
      sortBy: "lastReceivedAt",
      sortDirection: "desc",
    });

    expect(state.orderBy).toHaveLength(2);
    const primaryOrder = renderSql(state.orderBy?.[0]);
    const secondaryOrder = renderSql(state.orderBy?.[1]);

    expect(primaryOrder.sql).toContain("coalesce");
    expect(primaryOrder.sql).toContain('"email_addresses"."last_received_at"');
    expect(primaryOrder.sql).toContain("desc");
    expect(secondaryOrder.sql).toContain('"email_addresses"."id" desc');
  });

  it("builds recent-activity cursor predicates and requests one extra row", () => {
    const { db, state } = createQueryChain();

    listRecentAddressActivityPage({
      db,
      organizationId: "org-1",
      limit: 20,
      cursor: {
        sortValueMs: 1_700_000_000_000,
        id: "address-9",
      },
      sortBy: "recentActivity",
      sortDirection: "asc",
      search: "Inbox",
    });

    expect(state.limit).toBe(21);
    const where = renderSql(state.where);
    expect(where.sql).toContain("coalesce");
    expect(where.sql).toContain("> ?");
    expect(where.sql).toContain("OR (coalesce(");
    expect(where.params).toEqual([
      "org-1",
      "%inbox%",
      1_700_000_000_000,
      1_700_000_000_000,
      "address-9",
    ]);
  });

  it("counts organization addresses using the same escaped search predicate", async () => {
    const { db, state, chain } = createQueryChain();

    await countAddressesByOrganization({
      db,
      organizationId: "org-1",
      search: "foo_bar",
    });

    expect(chain.get).toHaveBeenCalledTimes(1);
    const where = renderSql(state.where);
    expect(where.params).toEqual(["org-1", "%foo\\_bar%"]);
  });

  it("inserts addresses with organization caps, expiry timestamps, and autocreate flags", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const db = {
      run,
    } as unknown as Parameters<typeof insertAddress>[0];

    await insertAddress(
      db,
      {
        id: "address-1",
        organizationId: "org-1",
        userId: "user-1",
        address: "sales@spinupmail.com",
        localPart: "sales",
        domain: "spinupmail.com",
        meta: '{"ttlSeconds":3600}',
        expiresAt: new Date("2026-03-28T10:00:00.000Z"),
        autoCreated: true,
      },
      100
    );

    expect(run).toHaveBeenCalledTimes(1);
    const statement = renderSql(run.mock.calls[0]?.[0]);
    expect(statement.sql).toContain("insert into email_addresses");
    expect(statement.sql).toContain("select count(*)");
    expect(statement.params).toEqual([
      "address-1",
      "org-1",
      "user-1",
      "sales@spinupmail.com",
      "sales",
      "spinupmail.com",
      '{"ttlSeconds":3600}',
      new Date("2026-03-28T10:00:00.000Z").getTime(),
      1,
      "org-1",
      100,
    ]);
  });
});
