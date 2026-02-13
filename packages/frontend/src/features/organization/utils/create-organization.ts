import { authClient } from "@/lib/auth";

const MAX_CREATE_ATTEMPTS = 6;

const randomSlugSuffix = () => crypto.randomUUID().split("-")[0];

export const slugifyOrganizationName = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (normalized.length === 0) {
    return `org-${randomSlugSuffix()}`;
  }

  return normalized.slice(0, 48);
};

const isSlugCollisionError = (message: string | undefined) => {
  if (!message) return false;
  return /slug|already exists|taken|organization already exists/i.test(message);
};

export const createOrganizationWithGeneratedSlug = async (name: string) => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Organization name must be at least 2 characters");
  }

  const baseSlug = slugifyOrganizationName(trimmedName);

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${randomSlugSuffix().slice(0, 4)}`;
    const slug = `${baseSlug}${suffix}`.slice(0, 64);

    const result = await authClient.organization.create({
      name: trimmedName,
      slug,
    });

    if (!result.error) {
      if (result.data?.id) {
        const setActiveResult = await authClient.organization.setActive({
          organizationId: result.data.id,
        });

        if (setActiveResult.error) {
          throw new Error(
            setActiveResult.error.message || "Unable to set active organization"
          );
        }
      }
      return result.data;
    }

    if (!isSlugCollisionError(result.error.message)) {
      throw new Error(result.error.message || "Unable to create organization");
    }
  }

  throw new Error("Unable to create organization. Please try again.");
};
