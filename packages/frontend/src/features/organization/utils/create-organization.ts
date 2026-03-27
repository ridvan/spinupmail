import { authClient } from "@/lib/auth";
import { createOrganization } from "@/lib/api";

export const createOrganizationWithGeneratedSlug = async (name: string) => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Organization name must be at least 2 characters");
  }

  const result = await createOrganization(trimmedName);

  if (result.organization.id) {
    const setActiveResult = await authClient.organization.setActive({
      organizationId: result.organization.id,
    });

    if (setActiveResult.error) {
      throw new Error(
        setActiveResult.error.message || "Unable to set active organization"
      );
    }
  }

  return result.organization;
};
