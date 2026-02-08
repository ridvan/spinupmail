import { redirect, type LoaderFunctionArgs } from "react-router";
import { authClient } from "@/lib/auth";

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

export const requireAuthLoader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authClient.getSession();

  if (session.error || !session.data?.user || !session.data?.session) {
    const next = encodeURIComponent(readRequestPath(request));
    throw redirect(`/login?next=${next}`);
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
