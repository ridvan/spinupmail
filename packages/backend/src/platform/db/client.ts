import { drizzle } from "drizzle-orm/d1";
import { schema } from "@/db";

export const getDb = (env: CloudflareBindings) =>
  drizzle(env.SUM_DB, { schema });

export type AppDb = ReturnType<typeof getDb>;
export type AppTransaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
export type AppDatabase = AppDb | AppTransaction;
