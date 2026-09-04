import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import type { User } from "@/db/schema";

export type Context = {
  user: User | null;
  db: typeof db;
};

export async function createContext(): Promise<Context> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("wayv_user_id")?.value ?? null;

  let user: User | null = null;
  if (userId) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    user = result[0] ?? null;
  }

  return { user, db };
}
