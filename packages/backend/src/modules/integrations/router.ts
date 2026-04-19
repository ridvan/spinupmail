import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createIntegrationRequestSchema,
  listIntegrationDispatchesParamsSchema,
  validateIntegrationConnectionRequestSchema,
} from "@spinupmail/contracts";
import type { AppHonoEnv } from "@/app/types";
import {
  createIntegration,
  deleteIntegration,
  listIntegrationDispatches,
  listIntegrations,
  replayIntegrationDispatch,
  validateIntegrationConnection,
} from "./service";

export const createIntegrationsRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/integrations", async c => {
    const result = await listIntegrations({
      env: c.env,
      organizationId: c.get("organizationId"),
      session: c.get("session"),
    });

    return c.json(result.body, result.status, {
      "Cache-Control": "private, no-store",
    });
  });

  router.post(
    "/integrations/validate",
    zValidator(
      "json",
      validateIntegrationConnectionRequestSchema,
      (result, c) => {
        if (!result.success) {
          return c.json(
            {
              error:
                result.error.issues[0]?.message ??
                "invalid integration payload",
            },
            400
          );
        }
        return undefined;
      }
    ),
    async c => {
      const result = await validateIntegrationConnection({
        env: c.env,
        organizationId: c.get("organizationId"),
        session: c.get("session"),
        payload: c.req.valid("json"),
      });

      return c.json(result.body, result.status as 200 | 400 | 403 | 502, {
        "Cache-Control": "private, no-store",
      });
    }
  );

  router.post(
    "/integrations",
    zValidator("json", createIntegrationRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error:
              result.error.issues[0]?.message ?? "invalid integration payload",
          },
          400
        );
      }
      return undefined;
    }),
    async c => {
      const result = await createIntegration({
        env: c.env,
        organizationId: c.get("organizationId"),
        session: c.get("session"),
        payload: c.req.valid("json"),
      });

      return c.json(
        result.body,
        result.status as 201 | 400 | 403 | 409 | 500 | 502,
        {
          "Cache-Control": "private, no-store",
        }
      );
    }
  );

  router.delete("/integrations/:id", async c => {
    const result = await deleteIntegration({
      env: c.env,
      organizationId: c.get("organizationId"),
      session: c.get("session"),
      integrationId: c.req.param("id"),
    });

    return c.json(result.body, result.status, {
      "Cache-Control": "private, no-store",
    });
  });

  router.get(
    "/integrations/:id/dispatches",
    zValidator("query", listIntegrationDispatchesParamsSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error:
              result.error.issues[0]?.message ?? "invalid integration query",
          },
          400
        );
      }
      return undefined;
    }),
    async c => {
      const result = await listIntegrationDispatches({
        env: c.env,
        organizationId: c.get("organizationId"),
        session: c.get("session"),
        integrationId: c.req.param("id"),
        queryPayload: c.req.valid("query"),
      });

      return c.json(result.body, result.status, {
        "Cache-Control": "private, no-store",
      });
    }
  );

  router.post("/integrations/:id/dispatches/:dispatchId/replay", async c => {
    const result = await replayIntegrationDispatch({
      env: c.env,
      organizationId: c.get("organizationId"),
      session: c.get("session"),
      integrationId: c.req.param("id"),
      dispatchId: c.req.param("dispatchId"),
    });

    return c.json(result.body, result.status, {
      "Cache-Control": "private, no-store",
    });
  });

  return router;
};
