import { NextResponse } from "next/server";
import { adminsExist, getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const [hasAdmins, user] = await Promise.all([adminsExist(), getAuthenticatedUser()]);

    return NextResponse.json({
      authenticated: Boolean(user),
      hasAdmins,
      userEmail: user?.email ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bootstrap status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
