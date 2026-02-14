import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminApiAccess } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

const bodySchema = z.object({
  teamId: z.string().uuid(),
  priority: z.number().int().positive().nullable(),
  reason: z.string().max(400).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiAccess();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const payload = bodySchema.parse(await request.json());
    const supabase = getServiceSupabaseClient();

    if (payload.priority === null) {
      const { error } = await supabase
        .schema("league")
        .from("tie_overrides")
        .delete()
        .eq("team_id", payload.teamId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.schema("league").from("tie_overrides").upsert(
        {
          team_id: payload.teamId,
          priority: payload.priority,
          reason: payload.reason ?? null,
          active: true,
          updated_by: admin.user.id,
        },
        { onConflict: "team_id" },
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    revalidatePath("/standings");
    revalidatePath("/admin/standings");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to set tie override";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
