import { Hono } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getDomainsResponse } from "./service";

export const createDomainsRouter = () => {
  const router = new Hono<AppHonoEnv>();

  router.get("/domains", c => {
    const result = getDomainsResponse(c.env);
    return c.json(result.body, result.status, {
      "Cache-Control":
        result.status === 200 ? "private, max-age=300" : "no-store",
    });
  });

  return router;
};
