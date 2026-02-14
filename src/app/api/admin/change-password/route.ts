import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiAccess } from "@/lib/auth";
import { requireEnv } from "@/lib/env";
import { getServerSupabaseClient } from "@/lib/supabase/server";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm password must be at least 8 characters."),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiAccess();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const payload = changePasswordSchema.parse(await request.json());
    if (payload.newPassword !== payload.confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 },
      );
    }

    if (payload.newPassword === payload.currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password." },
        { status: 400 },
      );
    }

    if (!admin.user.email) {
      return NextResponse.json(
        { error: "This account does not support password sign-in." },
        { status: 400 },
      );
    }

    const verifier = createClient(requireEnv("supabaseUrl"), requireEnv("supabaseAnonKey"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: admin.user.email,
      password: payload.currentPassword,
    });

    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const supabase = await getServerSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: payload.newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstMessage =
        error.issues[0]?.message ?? "Please check the password form fields.";
      return NextResponse.json({ error: firstMessage }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Failed to update password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
