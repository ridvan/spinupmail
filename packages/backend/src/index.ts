import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { registerCorsMiddleware } from "@/app/middleware/cors";
import { registerAuthInitializationMiddleware } from "@/app/middleware/init-auth";
import { requireAuth } from "@/app/middleware/require-auth";
import { requirePlatformAdmin } from "@/app/middleware/require-platform-admin";
import { requireOrganizationScope } from "@/app/middleware/require-organization-scope";
import { registerErrorHandling } from "@/app/middleware/error-handler";
import { createAuth } from "@/platform/auth/create-auth";
import { createAdminRouter } from "@/modules/admin/router";
import { createAuthHttpRouter } from "@/modules/auth-http/router";
import { createDomainsRouter } from "@/modules/domains/router";
import { createOrganizationsRouter } from "@/modules/organizations/router";
import { createEmailAddressesRouter } from "@/modules/email-addresses/router";
import { createEmailsRouter } from "@/modules/emails/router";
import { createIntegrationsRouter } from "@/modules/integrations/router";
import { createE2EAuthTestRouter } from "@/modules/e2e-auth/router";
import { createExtensionRouter } from "@/modules/extension/router";
import { InboundAbuseCounterDurableObject } from "@/modules/inbound-email/abuse-counter";
import { FixedWindowRateLimiterDurableObject } from "@/shared/rate-limiter";
import { pruneOperationalEvents } from "@/modules/admin/operational-events";
import { handleIncomingEmail } from "@/modules/inbound-email/handler";
import { handleIntegrationDispatchQueueBatch } from "@/modules/integrations/queue";

type AppFactoryOptions = {
  createAuthFactory?: typeof createAuth;
  includeE2ETestRoutes?: boolean;
};

type WorkerHandlerOptions = AppFactoryOptions & {
  emailHandler?: typeof handleIncomingEmail;
  queueHandler?: typeof handleIntegrationDispatchQueueBatch;
};

export const createApp = (options: AppFactoryOptions = {}) => {
  const app = new Hono<AppHonoEnv>();

  registerCorsMiddleware(app);
  registerAuthInitializationMiddleware(app, options.createAuthFactory);

  if (options.includeE2ETestRoutes) {
    app.route("/api", createE2EAuthTestRouter());
  }
  app.route("/api", createAuthHttpRouter());

  app.use("/api/domains", requireAuth);
  app.use("/api/admin/*", requireAuth);
  app.use("/api/admin/*", requirePlatformAdmin);
  app.use("/api/organizations/stats/*", requireAuth);
  app.use("/api/extension/bootstrap", requireAuth);
  app.use("/api/extension/invitations/*", requireAuth);
  app.use("/api/organizations/stats/email-activity", requireOrganizationScope);
  app.use("/api/organizations/stats/email-summary", requireOrganizationScope);
  app.use("/api/email-addresses/*", requireAuth);
  app.use("/api/emails/*", requireAuth);
  app.use("/api/integrations", requireAuth);
  app.use("/api/integrations/*", requireAuth);
  app.use("/api/email-addresses/*", requireOrganizationScope);
  app.use("/api/emails/*", requireOrganizationScope);
  app.use("/api/integrations", requireOrganizationScope);
  app.use("/api/integrations/*", requireOrganizationScope);

  app.route("/api", createExtensionRouter());
  app.route("/api", createAdminRouter());
  app.route("/api", createDomainsRouter());
  app.route("/api", createOrganizationsRouter());
  app.route("/api", createEmailAddressesRouter());
  app.route("/api", createEmailsRouter());
  app.route("/api", createIntegrationsRouter());

  app.get("/", c => {
    return c.json({
      status: "ok",
      message: "Spinupmail API is running. Use the frontend to manage inboxes.",
    });
  });

  app.get("/health", c => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  registerErrorHandling(app);
  return app;
};

export const createWorkerHandler = (options: WorkerHandlerOptions = {}) => {
  const app = createApp(options);
  const queueHandler =
    options.queueHandler ??
    ((args: { batch: MessageBatch; env: CloudflareBindings }) =>
      handleIntegrationDispatchQueueBatch(args));

  return {
    fetch: app.fetch,
    email: options.emailHandler ?? handleIncomingEmail,
    queue: (batch: MessageBatch, env: CloudflareBindings) =>
      queueHandler({ batch, env }),
    scheduled: (
      _controller: ScheduledController,
      env: CloudflareBindings,
      ctx: ExecutionContext
    ) => {
      ctx.waitUntil(
        pruneOperationalEvents(env).catch(error => {
          console.error("[admin] Failed to prune operational events", {
            error,
          });
        })
      );
    },
  };
};

export {
  FixedWindowRateLimiterDurableObject,
  InboundAbuseCounterDurableObject,
};

export default createWorkerHandler();
