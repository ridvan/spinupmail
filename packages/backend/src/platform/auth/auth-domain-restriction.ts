import { APIError } from "better-auth/api";
import { getAuthAllowedEmailDomain } from "@/shared/env";
import { getEmailDomain } from "./email-address";

export const AUTH_EMAIL_DOMAIN_NOT_ALLOWED_CODE =
  "AUTH_EMAIL_DOMAIN_NOT_ALLOWED";

export const getAuthEmailDomainRestrictionError = (allowedDomain: string) =>
  new APIError("BAD_REQUEST", {
    message: `Use your @${allowedDomain} email address to continue.`,
    code: AUTH_EMAIL_DOMAIN_NOT_ALLOWED_CODE,
  });

export const assertAllowedAuthEmailDomain = (
  email: string,
  env?: Pick<CloudflareBindings, "AUTH_ALLOWED_EMAIL_DOMAIN">
) => {
  const allowedDomain = getAuthAllowedEmailDomain(env);
  if (!allowedDomain) return;

  const emailDomain = getEmailDomain(email);
  if (!emailDomain || emailDomain === allowedDomain) return;

  throw getAuthEmailDomainRestrictionError(allowedDomain);
};
