import { redirect, type LoaderFunctionArgs } from "react-router";
import { isPlatformAdminRole } from "@spinupmail/contracts";
import {
  getLastActiveOrganizationId,
  setLastActiveOrganizationId,
} from "@/features/organization/utils/active-organization-storage";
import { authClient } from "@/lib/auth";

type OrganizationListItem = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.list>>["data"]
>[number];

const safeNextPath = (value: string | null) => {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
};

const readRequestPath = (request: Request) => {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}${url.hash}`;
};

const getSessionOrRedirect = async (request: Request) => {
  const session = await authClient.getSession();

  if (session.error || !session.data?.user || !session.data?.session) {
    const next = encodeURIComponent(readRequestPath(request));
    throw redirect(`/sign-in?next=${next}`);
  }

  return session.data;
};

const getActiveOrganizationId = (
  data: NonNullable<Awaited<ReturnType<typeof authClient.getSession>>["data"]>
) => {
  return (
    (data.session as { activeOrganizationId?: string | null })
      .activeOrganizationId ?? null
  );
};

const tryRestoreActiveOrganization = async (userId: string) => {
  const organizations = await authClient.organization.list();
  const orgList = organizations.error ? [] : (organizations.data ?? []);
  if (orgList.length === 0) return false;

  const lastActiveOrganizationId = getLastActiveOrganizationId(userId);
  const fallbackOrganizationId =
    (lastActiveOrganizationId &&
    orgList.some(
      (org: OrganizationListItem) => org.id === lastActiveOrganizationId
    )
      ? lastActiveOrganizationId
      : null) ?? orgList[0]?.id;

  if (!fallbackOrganizationId) return false;

  const setActive = await authClient.organization.setActive({
    organizationId: fallbackOrganizationId,
  });
  if (setActive.error) return false;

  setLastActiveOrganizationId(userId, fallbackOrganizationId);
  await authClient.getSession({
    query: {
      disableCookieCache: true,
    },
  });
  return true;
};

export const requireAuthLoader = async ({ request }: LoaderFunctionArgs) => {
  await getSessionOrRedirect(request);
  return null;
};

export const requirePlatformAdminLoader = async ({
  request,
}: LoaderFunctionArgs) => {
  const session = await getSessionOrRedirect(request);
  const freshSession = await authClient.getSession({
    query: {
      disableCookieCache: true,
    },
  });
  const user = freshSession.data?.user ?? session.user;

  if (!isPlatformAdminRole((user as { role?: unknown }).role)) {
    throw redirect("/");
  }

  return null;
};

export const requireActiveOrganizationLoader = async ({
  request,
}: LoaderFunctionArgs) => {
  const session = await getSessionOrRedirect(request);
  if (getActiveOrganizationId(session)) return null;
  if (await tryRestoreActiveOrganization(session.user.id)) return null;

  const requestedPath = readRequestPath(request);
  const next = encodeURIComponent(requestedPath);
  throw redirect(`/onboarding/organization?next=${next}`);
};

export const requireNoActiveOrganizationLoader = async ({
  request,
}: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const invitationId = url.searchParams.get("invitationId");
  if (invitationId) {
    await getSessionOrRedirect(request);
    return null;
  }

  const session = await getSessionOrRedirect(request);
  if (!getActiveOrganizationId(session)) {
    if (!(await tryRestoreActiveOrganization(session.user.id))) return null;
  }

  if (url.searchParams.has("next")) {
    const next = safeNextPath(url.searchParams.get("next"));
    throw redirect(next);
  }

  return null;
};

export const redirectIfAuthenticatedLoader = async ({
  request,
}: LoaderFunctionArgs) => {
  const session = await authClient.getSession();

  if (!session.error && session.data?.user && session.data?.session) {
    const url = new URL(request.url);
    const next = safeNextPath(url.searchParams.get("next"));
    throw redirect(next);
  }

  return null;
};
