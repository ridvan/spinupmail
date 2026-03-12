import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { TestCookie, TestHelpers } from "better-auth/plugins";
import type { AppHonoEnv } from "@/app/types";
import { createEmailAddress } from "@/modules/email-addresses/service";
import { findAddressByIdAndOrganization } from "@/modules/emails/repo";
import {
  incrementAddressEmailCount,
  insertInboundEmail,
  updateAddressLastReceivedAt,
} from "@/modules/inbound-email/repo";
import { getDb } from "@/platform/db/client";
import { getE2ETestSecret, isE2ETestUtilsEnabled } from "@/shared/env";

const organizationSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    role: z.string().trim().min(1).optional(),
  })
  .optional();

const credentialsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  name: z.string().trim().min(1).optional(),
  organization: organizationSchema,
});

const sessionSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().min(1).optional(),
  organization: organizationSchema,
});

const addressSchema = z.object({
  organizationId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  localPart: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
});

const emailSchema = z.object({
  organizationId: z.string().trim().min(1),
  addressId: z.string().trim().min(1),
  from: z.string().trim().min(1).optional(),
  sender: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
});

const cleanupSchema = z.object({
  organizationIds: z.array(z.string().trim().min(1)).optional(),
  userIds: z.array(z.string().trim().min(1)).optional(),
});

type AuthTestContext = Awaited<AppHonoEnv["Variables"]["auth"]["$context"]>;

const getTestContext = async (c: Context<AppHonoEnv>) => {
  const auth = c.get("auth");
  const ctx = (await auth.$context) as AuthTestContext & {
    test?: TestHelpers;
    internalAdapter: {
      findUserByEmail: (
        email: string,
        options: { includeAccounts: boolean }
      ) => Promise<{ user?: { id: string } } | null>;
      updateUser: (
        userId: string,
        data: Record<string, unknown>
      ) => Promise<unknown>;
      updateSession: (
        sessionToken: string,
        data: Record<string, unknown>
      ) => Promise<unknown>;
    };
  };

  if (!ctx.test) {
    throw new Error("Better Auth test utils are not enabled.");
  }

  return { auth, ctx, test: ctx.test };
};

const requireE2EAccess = async (
  c: Context<AppHonoEnv>,
  next: () => Promise<void>
) => {
  if (!isE2ETestUtilsEnabled(c.env)) {
    return c.notFound();
  }

  const expectedSecret = getE2ETestSecret(c.env)?.trim();
  if (!expectedSecret) {
    return c.notFound();
  }

  const providedSecret = c.req.header("x-e2e-test-secret")?.trim();
  if (!providedSecret || providedSecret !== expectedSecret) {
    return c.json({ error: "unauthorized" }, 401);
  }

  await next();
};

const createOrganizationForUser = async (
  test: TestHelpers,
  userId: string,
  options?: z.infer<typeof organizationSchema>
) => {
  if (!options) return null;
  if (!test.createOrganization || !test.saveOrganization || !test.addMember) {
    throw new Error("Organization helpers are unavailable.");
  }

  const organization = await test.saveOrganization(
    test.createOrganization(
      options.name
        ? {
            name: options.name,
          }
        : undefined
    )
  );

  await test.addMember({
    userId,
    organizationId: String(organization.id),
    role: options.role,
  });

  return organization;
};

const uniq = (values?: string[]) =>
  Array.from(
    new Set((values ?? []).map(value => value.trim()).filter(Boolean))
  );

export const createE2EAuthTestRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.use("/test/auth/*", requireE2EAccess);

  router.post(
    "/test/auth/credentials",
    zValidator("json", credentialsSchema),
    async c => {
      const payload = c.req.valid("json");
      const { auth, ctx, test } = await getTestContext(c);
      const email = payload.email?.trim() || test.createUser().email;
      const password = payload.password ?? "Password123!";
      const name = payload.name?.trim() || "E2E Test User";

      await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
      });

      const user = await ctx.internalAdapter.findUserByEmail(email, {
        includeAccounts: false,
      });

      if (!user?.user) {
        throw new Error(`Failed to create credential user for ${email}`);
      }

      await ctx.internalAdapter.updateUser(user.user.id, {
        emailVerified: true,
      });

      const organization = await createOrganizationForUser(
        test,
        user.user.id,
        payload.organization
      );

      return c.json({
        userId: user.user.id,
        organizationId: organization ? String(organization.id) : null,
        email,
        password,
      });
    }
  );

  router.post(
    "/test/auth/session",
    zValidator("json", sessionSchema),
    async c => {
      const payload = c.req.valid("json");
      const { ctx, test } = await getTestContext(c);
      const user = await test.saveUser(
        test.createUser({
          ...(payload.email ? { email: payload.email.trim() } : {}),
          ...(payload.name ? { name: payload.name.trim() } : {}),
        })
      );

      const organization = await createOrganizationForUser(
        test,
        user.id,
        payload.organization
      );
      const login = await test.login({ userId: user.id });

      if (organization) {
        await ctx.internalAdapter.updateSession(login.token, {
          activeOrganizationId: String(organization.id),
          updatedAt: new Date(),
        });
      }

      return c.json({
        userId: user.id,
        organizationId: organization ? String(organization.id) : null,
        cookies: login.cookies as TestCookie[],
      });
    }
  );

  router.post(
    "/test/auth/cleanup",
    zValidator("json", cleanupSchema),
    async c => {
      const payload = c.req.valid("json");
      const { test } = await getTestContext(c);

      for (const organizationId of uniq(payload.organizationIds)) {
        if (!test.deleteOrganization) continue;
        await test.deleteOrganization(organizationId).catch(() => undefined);
      }

      for (const userId of uniq(payload.userIds)) {
        await test.deleteUser(userId).catch(() => undefined);
      }

      return c.json({ status: true });
    }
  );

  router.post(
    "/test/auth/address",
    zValidator("json", addressSchema),
    async c => {
      const payload = c.req.valid("json");

      const result = await createEmailAddress({
        env: c.env,
        session: {
          session: {
            id: crypto.randomUUID(),
            userId: payload.userId,
            activeOrganizationId: payload.organizationId,
          },
          user: {
            id: payload.userId,
            emailVerified: true,
          },
        },
        organizationId: payload.organizationId,
        payload: {
          localPart:
            payload.localPart?.trim() ||
            `e2e-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
          domain: payload.domain?.trim(),
          tag: payload.tag?.trim(),
          acceptedRiskNotice: true,
        },
      });

      return c.json(result.body, result.status);
    }
  );

  router.post("/test/auth/email", zValidator("json", emailSchema), async c => {
    const payload = c.req.valid("json");
    const db = getDb(c.env);
    const address = await findAddressByIdAndOrganization(
      db,
      payload.organizationId,
      payload.addressId
    );

    if (!address) {
      return c.json({ error: "address not found" }, 404);
    }

    const emailId = crypto.randomUUID();
    const receivedAt = payload.receivedAt
      ? new Date(payload.receivedAt)
      : new Date();
    const from = payload.from?.trim() || "sender@example.com";
    const sender = payload.sender?.trim() || `Mailbox Sender <${from}>`;
    const subject = payload.subject?.trim() || "Seeded mailbox message";
    const bodyText =
      payload.bodyText ?? "This is a seeded mailbox email for E2E tests.";
    const raw = [
      `From: ${sender}`,
      `To: ${address.address}`,
      `Subject: ${subject}`,
      "",
      bodyText,
    ].join("\r\n");

    await insertInboundEmail(db, {
      id: emailId,
      addressId: address.id,
      messageId: `<${emailId}@spinupmail-e2e.test>`,
      sender,
      from,
      to: address.address,
      subject,
      bodyHtml: payload.bodyHtml,
      bodyText,
      raw,
      rawSize: raw.length,
      rawTruncated: false,
      receivedAt,
    });
    await incrementAddressEmailCount(db, address.id);
    await updateAddressLastReceivedAt(db, address.id, receivedAt);

    return c.json({
      id: emailId,
      addressId: address.id,
      subject,
      from,
      sender,
      receivedAt: receivedAt.toISOString(),
    });
  });

  return router;
};
