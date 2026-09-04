import { config } from "dotenv";
config({ path: ".env.local" });

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const migrationClient = postgres(process.env.POSTGRES_URL!, { max: 1 });

async function main() {
  console.log("🔄 Running migrations...");
  await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations complete");
  await migrationClient.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
