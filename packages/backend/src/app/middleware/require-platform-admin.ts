import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import type { AppHonoEnv } from "@/app/types";
import { users } from "@/db";
import { getDb } from "@/platform/db/client";
import { isPlatformAdminRole } from "@/platform/auth/admin-access";

export const requirePlatformAdmin: MiddlewareHandler<AppHonoEnv> = async (
  c,
  next
) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  if (!isPlatformAdminRole(user?.role)) {
    return c.json({ error: "forbidden" }, 403);
  }

  await next();
};
