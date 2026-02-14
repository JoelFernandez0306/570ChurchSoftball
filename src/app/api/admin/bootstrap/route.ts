import { NextResponse } from "next/server";
import { adminsExist, getAuthenticatedUser } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabase = getServiceSupabaseClient();

    const { data: existingAdmin, error: existingAdminError } = await supabase
      .schema("league")
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingAdminError) {
      return NextResponse.json({ error: existingAdminError.message }, { status: 500 });
    }

    if (existingAdmin) {
      return NextResponse.json({ ok: true, message: "User is already an admin." });
    }

    const hasAdmins = await adminsExist();

    if (hasAdmins) {
      return NextResponse.json(
        {
          error:
            "An admin already exists. Ask an existing admin to add your account.",
        },
        { status: 403 },
      );
    }

    const { error } = await supabase.schema("league").from("admins").insert({
      user_id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email ?? "Initial Admin",
      active: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "First admin created." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to bootstrap admin";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
