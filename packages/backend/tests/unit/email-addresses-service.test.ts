const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findAddressByIdAndOrganization: vi.fn(),
  deleteAddressByIdAndOrganization: vi.fn(),
  deleteEmailSearchEntriesByAddressId: vi.fn(),
  deleteR2ObjectsByPrefix: vi.fn(),
}));

vi.mock("@/platform/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/modules/email-addresses/repo", () => ({
  findAddressByIdAndOrganization: mocks.findAddressByIdAndOrganization,
  deleteAddressByIdAndOrganization: mocks.deleteAddressByIdAndOrganization,
}));

vi.mock("@/modules/emails/repo", () => ({
  deleteEmailSearchEntriesByAddressId:
    mocks.deleteEmailSearchEntriesByAddressId,
}));

vi.mock("@/shared/utils/r2", () => ({
  deleteR2ObjectsByPrefix: mocks.deleteR2ObjectsByPrefix,
}));

import { deleteEmailAddress } from "@/modules/email-addresses/service";

describe("email addresses service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({});
    mocks.deleteAddressByIdAndOrganization.mockResolvedValue(undefined);
    mocks.deleteEmailSearchEntriesByAddressId.mockResolvedValue(undefined);
    mocks.deleteR2ObjectsByPrefix.mockResolvedValue(undefined);
  });

  it("deletes FTS search rows before deleting the address record", async () => {
    mocks.findAddressByIdAndOrganization.mockResolvedValue({
      id: "address-1",
      address: "inbox@example.com",
    });

    const result = await deleteEmailAddress({
      env: {} as CloudflareBindings,
      organizationId: "org-1",
      addressId: "address-1",
    });

    expect(mocks.deleteEmailSearchEntriesByAddressId).toHaveBeenCalledWith(
      {},
      "address-1"
    );
    expect(mocks.deleteAddressByIdAndOrganization).toHaveBeenCalledWith(
      {},
      "address-1",
      "org-1"
    );
    expect(
      mocks.deleteEmailSearchEntriesByAddressId.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.deleteAddressByIdAndOrganization.mock.invocationCallOrder[0]
    );
    expect(result).toEqual({
      status: 200,
      body: {
        id: "address-1",
        address: "inbox@example.com",
        deleted: true,
      },
    });
  });
});
