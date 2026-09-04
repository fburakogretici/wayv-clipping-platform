import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST(req: Request) {
  const { userId } = await req.json();
  const cookieStore = await cookies();

  if (!userId) {
    cookieStore.delete("wayv_user_id");
    return NextResponse.json({ ok: true });
  }

  // Verify user exists
  const result = await db
    .select()
    .from(users)
    .where(
      (await import("drizzle-orm")).eq(users.id, userId)
    )
    .limit(1);

  if (!result[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  cookieStore.set("wayv_user_id", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return NextResponse.json({ ok: true, user: result[0] });
}

export async function GET() {
  const { cookies: getCookies } = await import("next/headers");
  const cookieStore = await getCookies();
  const userId = cookieStore.get("wayv_user_id")?.value;

  if (!userId) return NextResponse.json({ user: null });

  const { eq } = await import("drizzle-orm");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return NextResponse.json({ user: result[0] ?? null });
}
