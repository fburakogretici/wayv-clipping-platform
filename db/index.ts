import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// For migrations (allows multiple statements)
export const migrationClient = postgres(process.env.POSTGRES_URL!, {
  max: 1,
});

// For queries (connection pool)
const queryClient = postgres(process.env.POSTGRES_URL!);

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
