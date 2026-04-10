import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "@/drizzle/schema";

/** True when a database URL is configured (server-only; never expose the URL to the client). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
