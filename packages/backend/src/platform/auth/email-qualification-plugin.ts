import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth/types";
import {
  assertAllowedAuthEmailDomain,
  getInvalidAuthEmailError,
} from "./auth-domain-restriction";
import { qualifyEmailAddress } from "./disposable-email-domains";

const EMAIL_QUALIFICATION_PATHS = new Set(["/sign-up/email", "/change-email"]);
const AUTH_DOMAIN_RESTRICTION_PATHS = new Set([
  "/sign-in/email",
  "/sign-up/email",
  "/change-email",
]);

const getEmailQualificationError = (reason: "invalid" | "disposable") => {
  if (reason === "disposable") {
    return new APIError("BAD_REQUEST", {
      message:
        "This address is not allowed. Please use a different email provider.",
      code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
    });
  }

  return getInvalidAuthEmailError();
};

const extractRequestEmail = (path: string, body: unknown, query: unknown) => {
  if (path === "/change-email") {
    const newEmail = (body as { newEmail?: unknown } | undefined)?.newEmail;
    return typeof newEmail === "string" ? newEmail : null;
  }

  const bodyEmail = (body as { email?: unknown } | undefined)?.email;
  if (typeof bodyEmail === "string") return bodyEmail;

  const queryEmail = (query as { email?: unknown } | undefined)?.email;
  return typeof queryEmail === "string" ? queryEmail : null;
};

export const createEmailQualificationPlugin = (
  env?: CloudflareBindings
): BetterAuthPlugin => ({
  id: "email-qualification",
  init() {
    return {
      options: {
        databaseHooks: {
          user: {
            create: {
              before: async (user, context) => {
                if (!user.email) {
                  return { data: user };
                }

                const qualification = await qualifyEmailAddress(
                  user.email,
                  env,
                  {
                    runInBackground: promise =>
                      context?.context.runInBackground(promise),
                  }
                );
                if (!qualification.ok) {
                  throw getEmailQualificationError(qualification.reason);
                }

                assertAllowedAuthEmailDomain(
                  qualification.normalizedEmail,
                  env
                );

                return {
                  data: {
                    ...user,
                    normalizedEmail: qualification.normalizedEmail,
                  },
                };
              },
            },
            update: {
              before: async (user, context) => {
                if (!user.email) {
                  return { data: user };
                }

                const qualification = await qualifyEmailAddress(
                  user.email,
                  env,
                  {
                    runInBackground: promise =>
                      context?.context.runInBackground(promise),
                  }
                );
                if (!qualification.ok) {
                  throw getEmailQualificationError(qualification.reason);
                }

                assertAllowedAuthEmailDomain(
                  qualification.normalizedEmail,
                  env
                );

                return {
                  data: {
                    ...user,
                    normalizedEmail: qualification.normalizedEmail,
                  },
                };
              },
            },
          },
        },
      },
    };
  },
  hooks: {
    before: [
      {
        matcher: ({ path }) =>
          typeof path === "string" &&
          (EMAIL_QUALIFICATION_PATHS.has(path) ||
            AUTH_DOMAIN_RESTRICTION_PATHS.has(path)),
        handler: createAuthMiddleware(async context => {
          const rawEmail = extractRequestEmail(
            context.path,
            context.body,
            context.query
          );
          if (!rawEmail) return;

          if (EMAIL_QUALIFICATION_PATHS.has(context.path)) {
            const qualification = await qualifyEmailAddress(rawEmail, env, {
              runInBackground: promise =>
                context.context.runInBackground(promise),
            });
            if (!qualification.ok) {
              throw getEmailQualificationError(qualification.reason);
            }

            assertAllowedAuthEmailDomain(qualification.normalizedEmail, env);

            const existingUser = (await context.context.adapter.findOne({
              model: "user",
              where: [
                {
                  field: "normalizedEmail",
                  value: qualification.normalizedEmail,
                },
              ],
            })) as { id?: string } | null;

            const currentUserId = context.context.session?.user?.id;
            if (existingUser?.id && existingUser.id !== currentUserId) {
              throw new APIError("BAD_REQUEST", {
                message: "An account already exists for this email",
                code: "USER_ALREADY_EXISTS",
              });
            }
          }

          if (
            AUTH_DOMAIN_RESTRICTION_PATHS.has(context.path) &&
            !EMAIL_QUALIFICATION_PATHS.has(context.path)
          ) {
            assertAllowedAuthEmailDomain(rawEmail, env);
          }
        }),
      },
    ],
  },
});
