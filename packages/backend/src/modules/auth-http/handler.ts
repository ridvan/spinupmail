import type { Context } from "hono";
import type { AppHonoEnv } from "@/app/types";
import { getAuthUserEmailConflictResponse } from "@/shared/errors";

export const handleAuthRequest = async (c: Context<AppHonoEnv>) => {
  const auth = c.get("auth");

  try {
    return await auth.handler(c.req.raw);
  } catch (error) {
    const conflict = getAuthUserEmailConflictResponse(error);
    if (conflict) {
      return c.json(conflict.body, conflict.status);
    }
    throw error;
  }
};
