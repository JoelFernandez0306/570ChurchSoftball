import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminApiAccess } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import {
  DEFAULT_COMPETITION_PHASE,
  formatCompetitionPhaseLabel,
} from "@/lib/league-data";
import type { CompetitionPhase } from "@/lib/types";

const seasonSchema = z.object({
  seasonName: z.string().trim().min(1).max(120),
  competitionPhase: z.enum(["regular_season", "playoffs"]).optional(),
  confirmNewSeason: z.boolean().optional().default(false),
});

function normalizeSeasonName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseSeasonYear(value: string): number | null {
  const match = value.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiAccess();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const payload = seasonSchema.parse(await request.json());
    const nextSeasonName = normalizeSeasonName(payload.seasonName);
    const supabase = getServiceSupabaseClient();

    const { data: settings, error: settingsError } = await supabase
      .schema("league")
      .from("settings")
      .select("id,active_season_name,active_competition_phase,season_year")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      return NextResponse.json({ error: settingsError.message }, { status: 500 });
    }

    if (!settings) {
      return NextResponse.json({ error: "League settings not found." }, { status: 500 });
    }

    const currentSeasonName = normalizeSeasonName(settings.active_season_name ?? "");
    const currentCompetitionPhase =
      settings.active_competition_phase === "playoffs"
        ? "playoffs"
        : DEFAULT_COMPETITION_PHASE;
    const nextCompetitionPhase =
      payload.competitionPhase === "playoffs"
        ? "playoffs"
        : payload.competitionPhase === "regular_season"
          ? "regular_season"
          : currentCompetitionPhase;

    const seasonChanged = currentSeasonName !== nextSeasonName;
    const phaseChanged = currentCompetitionPhase !== nextCompetitionPhase;

    if (!seasonChanged && !phaseChanged) {
      return NextResponse.json({ ok: true, message: "Active season and phase are already set." });
    }

    if (seasonChanged) {
      const { count: currentSeasonGameCount, error: countError } = await supabase
        .schema("league")
        .from("games")
        .select("id", { count: "exact", head: true })
        .eq("season_name", currentSeasonName);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if ((currentSeasonGameCount ?? 0) > 0 && !payload.confirmNewSeason) {
        return NextResponse.json(
          {
            error:
              "Changing season name starts a new season. Confirm the warning and try again.",
          },
          { status: 409 },
        );
      }
    }

    const seasonYearFromName = parseSeasonYear(nextSeasonName);
    const updatePayload: {
      active_season_name: string;
      active_competition_phase: CompetitionPhase;
      season_year?: number;
    } = {
      active_season_name: nextSeasonName,
      active_competition_phase: nextCompetitionPhase,
    };

    if (seasonYearFromName) {
      updatePayload.season_year = seasonYearFromName;
    }

    const { error: updateError } = await supabase
      .schema("league")
      .from("settings")
      .update(updatePayload)
      .eq("id", settings.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (seasonChanged) {
      const { error: tieOverrideError } = await supabase
        .schema("league")
        .from("tie_overrides")
        .update({
          active: false,
          updated_by: admin.user.id,
          reason: `Archived after season change to ${nextSeasonName}`,
        })
        .eq("active", true);

      if (tieOverrideError) {
        return NextResponse.json({ error: tieOverrideError.message }, { status: 500 });
      }
    }

    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/standings");
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/standings");
    revalidatePath("/admin/dashboard");

    return NextResponse.json({
      ok: true,
      message: `Active scope updated to ${nextSeasonName} (${formatCompetitionPhaseLabel(nextCompetitionPhase)}).`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Failed to update season";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
