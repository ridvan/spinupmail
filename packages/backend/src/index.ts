import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { registerCorsMiddleware } from "@/app/middleware/cors";
import { registerAuthInitializationMiddleware } from "@/app/middleware/init-auth";
import { requireAuth } from "@/app/middleware/require-auth";
import { requireOrganizationScope } from "@/app/middleware/require-organization-scope";
import { registerErrorHandling } from "@/app/middleware/error-handler";
import { createAuth } from "@/platform/auth/create-auth";
import { createAuthHttpRouter } from "@/modules/auth-http/router";
import { createDomainsRouter } from "@/modules/domains/router";
import { createOrganizationsRouter } from "@/modules/organizations/router";
import { createEmailAddressesRouter } from "@/modules/email-addresses/router";
import { createEmailsRouter } from "@/modules/emails/router";
import { createE2EAuthTestRouter } from "@/modules/e2e-auth/router";
import { InboundAbuseCounterDurableObject } from "@/modules/inbound-email/abuse-counter";
import { handleIncomingEmail } from "@/modules/inbound-email/handler";

type AppFactoryOptions = {
  createAuthFactory?: typeof createAuth;
  includeE2ETestRoutes?: boolean;
};

type WorkerHandlerOptions = AppFactoryOptions & {
  emailHandler?: typeof handleIncomingEmail;
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
  app.use("/api/organizations/stats/*", requireAuth);
  app.use("/api/organizations/stats/email-activity", requireOrganizationScope);
  app.use("/api/organizations/stats/email-summary", requireOrganizationScope);
  app.use("/api/email-addresses/*", requireAuth);
  app.use("/api/emails/*", requireAuth);
  app.use("/api/email-addresses/*", requireOrganizationScope);
  app.use("/api/emails/*", requireOrganizationScope);

  app.route("/api", createDomainsRouter());
  app.route("/api", createOrganizationsRouter());
  app.route("/api", createEmailAddressesRouter());
  app.route("/api", createEmailsRouter());

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
  return {
    fetch: app.fetch,
    email: options.emailHandler ?? handleIncomingEmail,
  };
};

export { InboundAbuseCounterDurableObject };

export default createWorkerHandler();
