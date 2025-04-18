import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
};

export const client =
  globalForDb.client ?? createClient({ 
    url: process.env.TURSO_DATABASE_URL ?? "",
    authToken: process.env.TURSO_AUTH_TOKEN, 
  });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client);
