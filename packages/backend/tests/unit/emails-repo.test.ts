import {
  buildDeleteEmailSearchEntriesByEmailIdsStatement,
  buildDeleteEmailSearchEntryByEmailIdStatement,
  buildDecrementAddressEmailCountStatement,
} from "@/modules/emails/repo";

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

describe("emails repo", () => {
  it("rejects empty email id lists when building FTS delete statements", () => {
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
});
