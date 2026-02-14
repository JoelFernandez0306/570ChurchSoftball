import { NextResponse } from "next/server";
import { loadStandings } from "@/lib/standings";
import { loadActiveSeasonName } from "@/lib/league-data";

export async function GET() {
  try {
    const [standings, seasonName] = await Promise.all([loadStandings(), loadActiveSeasonName()]);
    return NextResponse.json({ seasonName, standings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load standings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
