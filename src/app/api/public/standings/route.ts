import { NextResponse } from "next/server";
import { loadStandings } from "@/lib/standings";
import { loadActiveCompetitionPhase, loadActiveSeasonName } from "@/lib/league-data";

export async function GET() {
  try {
    const [standings, seasonName, competitionPhase] = await Promise.all([
      loadStandings(),
      loadActiveSeasonName(),
      loadActiveCompetitionPhase(),
    ]);
    return NextResponse.json({ seasonName, competitionPhase, standings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load standings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
