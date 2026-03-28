import { SQLiteDialect } from "drizzle-orm/sqlite-core";
import {
  findEmailActivity,
  findEmailSummary,
  findOrganizationCounts,
  findOrganizationIdsForUser,
} from "@/modules/organizations/repo";

const dialect = new SQLiteDialect();

const renderSql = (fragment: unknown) =>
  dialect.sqlToQuery(fragment as Parameters<typeof dialect.sqlToQuery>[0]);

const createPromiseLikeChain = <T>(result: T) => {
  const state: {
    where?: unknown;
    orderBy?: unknown[];
    groupBy?: unknown[];
    limit?: number;
  } = {};

  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
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
    limit: vi.fn((value: number) => {
      state.limit = value;
      return chain;
    }),
    then: (
      onFulfilled?: (value: T) => unknown,
      onRejected?: (error: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };

  return {
    chain,
    state,
  };
};

describe("organizations repo", () => {
  it("deduplicates organization ids for a user while preserving first-seen order", async () => {
    const membershipRows = [
      { organizationId: "org-2" },
      { organizationId: "org-1" },
      { organizationId: "org-2" },
      { organizationId: "org-3" },
    ];
    const { chain, state } = createPromiseLikeChain(membershipRows);
    const db = {
      select: vi.fn(() => chain),
    } as unknown as Parameters<typeof findOrganizationIdsForUser>[0];

    await expect(findOrganizationIdsForUser(db, "user-1")).resolves.toEqual([
      "org-2",
      "org-1",
      "org-3",
    ]);

    const where = renderSql(state.where);
    expect(where.params).toEqual(["user-1"]);
  });

  it("returns grouped member, address, and email count result sets", async () => {
    const memberCountRows = [{ organizationId: "org-1", count: 2 }];
    const addressCountRows = [{ organizationId: "org-1", count: 5 }];
    const emailCountRows = [{ organizationId: "org-1", count: 9 }];
    const memberQuery = createPromiseLikeChain(memberCountRows);
    const addressQuery = createPromiseLikeChain(addressCountRows);
    const emailQuery = createPromiseLikeChain(emailCountRows);
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(memberQuery.chain)
        .mockReturnValueOnce(addressQuery.chain)
        .mockReturnValueOnce(emailQuery.chain),
    } as unknown as Parameters<typeof findOrganizationCounts>[0];

    await expect(
      findOrganizationCounts(db, ["org-1", "org-2"])
    ).resolves.toEqual({
      memberCountRows,
      addressCountRows,
      emailCountRows,
    });

    expect(memberQuery.state.groupBy).toHaveLength(1);
    expect(addressQuery.state.groupBy).toHaveLength(1);
    expect(emailQuery.state.groupBy).toHaveLength(1);
  });

  it("builds minute-bucketed email activity with a half-open time window", async () => {
    const query = createPromiseLikeChain([]);
    const db = {
      select: vi.fn(() => query.chain),
    } as unknown as Parameters<typeof findEmailActivity>[0];

    await findEmailActivity(
      db,
      "org-1",
      new Date("2026-03-28T10:00:00.000Z"),
      new Date("2026-03-28T11:00:00.000Z")
    );

    const where = renderSql(query.state.where);
    const groupBy = renderSql(query.state.groupBy?.[0]);
    const orderBy = renderSql(query.state.orderBy?.[0]);

    expect(where.sql).toContain('"email_addresses"."organization_id" = ?');
    expect(where.sql).toContain('"emails"."received_at" >= ?');
    expect(where.sql).toContain('"emails"."received_at" < ?');
    expect(where.params).toEqual([
      "org-1",
      new Date("2026-03-28T10:00:00.000Z").getTime(),
      new Date("2026-03-28T11:00:00.000Z").getTime(),
    ]);
    expect(groupBy.sql).toContain(
      'cast("emails"."received_at" / 60000 as integer) * 60000'
    );
    expect(orderBy.sql).toContain(
      'cast("emails"."received_at" / 60000 as integer) * 60000 asc'
    );
  });

  it("runs all summary queries, including top-domain and dormant-inbox limits", async () => {
    const emailCountRow = [{ count: 12 }];
    const attachmentStatsRows = [
      { attachmentCount: 3, attachmentSizeTotal: 2048 },
    ];
    const topDomainsRows = [{ domain: "example.com", count: 5 }];
    const busiestInboxesRows = [
      { addressId: "address-1", address: "ops@spinupmail.com", count: 4 },
    ];
    const dormantInboxesRows = [
      {
        addressId: "address-2",
        address: "old@spinupmail.com",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    const q1 = createPromiseLikeChain(emailCountRow);
    const q2 = createPromiseLikeChain(attachmentStatsRows);
    const q3 = createPromiseLikeChain(topDomainsRows);
    const q4 = createPromiseLikeChain(busiestInboxesRows);
    const q5 = createPromiseLikeChain(dormantInboxesRows);
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(q1.chain)
        .mockReturnValueOnce(q2.chain)
        .mockReturnValueOnce(q3.chain)
        .mockReturnValueOnce(q4.chain)
        .mockReturnValueOnce(q5.chain),
    } as unknown as Parameters<typeof findEmailSummary>[0];

    await expect(
      findEmailSummary(db, "org-1", new Date("2026-02-01T00:00:00.000Z"))
    ).resolves.toEqual({
      emailCountRow,
      attachmentStatsRows,
      topDomainsRows,
      busiestInboxesRows,
      dormantInboxesRows,
    });

    expect(q3.state.limit).toBe(3);
    expect(q4.state.limit).toBe(3);
    const dormantWhere = renderSql(q5.state.where);
    expect(dormantWhere.sql).toContain(
      '"email_addresses"."last_received_at" is null'
    );
    expect(dormantWhere.sql).toContain('"email_addresses"."created_at" <= ?');
    expect(dormantWhere.params).toEqual([
      "org-1",
      new Date("2026-02-01T00:00:00.000Z").getTime(),
    ]);
  });
});
