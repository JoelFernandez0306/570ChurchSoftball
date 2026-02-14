import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminApiAccess } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import {
  formatCompetitionPhaseLabel,
  loadActiveLeagueScope,
} from "@/lib/league-data";

const resultSchema = z.object({
  gameId: z.string().uuid().optional(),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gameNumber: z.union([z.literal(1), z.literal(2)]).optional(),
  winnerTeamId: z.string().uuid().optional(),
  loserTeamId: z.string().uuid().optional(),
  tieGame: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApiAccess();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.message }, { status: admin.status });
    }

    const payload = resultSchema.parse(await request.json());
    if (!payload.gameId && (!payload.gameDate || !payload.gameNumber)) {
      return NextResponse.json(
        { error: "Game date and slot are required when game ID is not provided." },
        { status: 400 },
      );
    }

    if (!payload.tieGame && (!payload.winnerTeamId || !payload.loserTeamId)) {
      return NextResponse.json(
        { error: "Winner and loser are required unless the game is marked as a tie." },
        { status: 400 },
      );
    }

    if (
      !payload.tieGame &&
      payload.winnerTeamId &&
      payload.loserTeamId &&
      payload.winnerTeamId === payload.loserTeamId
    ) {
      return NextResponse.json({ error: "Winner and loser must be different teams." }, { status: 400 });
    }

    if (
      payload.tieGame &&
      payload.winnerTeamId &&
      payload.loserTeamId &&
      payload.winnerTeamId === payload.loserTeamId
    ) {
      return NextResponse.json({ error: "The two teams in a tie must be different teams." }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();
    const activeScope = await loadActiveLeagueScope();
    const updatePayload = payload.tieGame
      ? {
          winner_team_id: null,
          loser_team_id: null,
          is_tie: true,
          result_source: "manual",
          reported_by: admin.user.id,
        }
      : {
          winner_team_id: payload.winnerTeamId,
          loser_team_id: payload.loserTeamId,
          is_tie: false,
          result_source: "manual",
          reported_by: admin.user.id,
        };

    if (payload.gameId) {
      const { error } = await supabase
        .schema("league")
        .from("games")
        .update(updatePayload)
        .eq("id", payload.gameId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      let gameId: string | null = null;

      if (payload.winnerTeamId && payload.loserTeamId) {
        const { data: game, error: gameError } = await supabase
          .schema("league")
          .from("games")
          .select("id")
          .eq("season_name", activeScope.seasonName)
          .eq("game_phase", activeScope.competitionPhase)
          .eq("game_date", payload.gameDate!)
          .eq("game_number", payload.gameNumber!)
          .or(
            `and(home_team_id.eq.${payload.winnerTeamId},away_team_id.eq.${payload.loserTeamId}),and(home_team_id.eq.${payload.loserTeamId},away_team_id.eq.${payload.winnerTeamId})`,
          )
          .limit(1)
          .maybeSingle();

        if (gameError) {
          return NextResponse.json({ error: gameError.message }, { status: 500 });
        }

        if (!game) {
          return NextResponse.json(
            {
              error: `No scheduled game found for this date/slot/team pair in ${activeScope.seasonName} (${formatCompetitionPhaseLabel(activeScope.competitionPhase)}). Create the schedule first.`,
            },
            { status: 404 },
          );
        }

        gameId = game.id;
      } else {
        const { data: games, error: gamesError } = await supabase
          .schema("league")
          .from("games")
          .select("id")
          .eq("season_name", activeScope.seasonName)
          .eq("game_phase", activeScope.competitionPhase)
          .eq("game_date", payload.gameDate!)
          .eq("game_number", payload.gameNumber!)
          .limit(2);

        if (gamesError) {
          return NextResponse.json({ error: gamesError.message }, { status: 500 });
        }

        if (!games || games.length === 0) {
          return NextResponse.json(
            {
              error: `No scheduled game found for this date and slot in ${activeScope.seasonName} (${formatCompetitionPhaseLabel(activeScope.competitionPhase)}). Create the schedule first.`,
            },
            { status: 404 },
          );
        }

        if (games.length > 1) {
          return NextResponse.json(
            {
              error:
                "Multiple games match this date and slot. Select winner/loser teams to identify the game.",
            },
            { status: 409 },
          );
        }

        gameId = games[0].id;
      }

      const { error: updateError } = await supabase
        .schema("league")
        .from("games")
        .update(updatePayload)
        .eq("id", gameId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/standings");
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/standings");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Unable to save result";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
