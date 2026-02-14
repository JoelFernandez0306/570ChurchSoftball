import { NextResponse } from "next/server";
import { loadStandings } from "@/lib/standings";

export async function GET() {
  try {
    const standings = await loadStandings();
    return NextResponse.json({ standings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load standings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
