import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdminPageAccess } from "@/lib/auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    await requireAdminPageAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("image") as File | null;
  const teamName = (formData.get("teamName") as string | null)?.trim() ?? "the team";
  if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 });

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — Anthropic base64 limit
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please resize to under 5 MB.` },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const prompt = `You are analyzing a handwritten softball scorebook page for the team "${teamName}".

SCOREBOOK LAYOUT: This is a standard paper softball scorebook. Each row is one player.
- Left column: player name
- Middle columns: small cells or diamonds tracking each at-bat per inning (ignore these)
- Right side: summary totals for the game — typically columns labeled AB, R, H, RBI, and sometimes BB/SO

Your job: read the SUMMARY TOTALS columns on the right side of each player row.
Typical values: AB is 1–5, R is 0–5, H is 0–5, RBI is 0–6. Numbers are small single digits.

Return ONLY valid JSON — no markdown, no explanation.

{
  "players": [
    {
      "name": "Player name as written",
      "ab": 2,
      "r": 1,
      "h": 1,
      "rbi": 0,
      "bb": 0,
      "so": 0,
      "crossed_out": false
    }
  ],
  "notes": {
    "2B": ["Player name"],
    "3B": ["Player name"],
    "HR": ["Player name 2"]
  }
}

Rules:
- Read every digit you can see. Commit to your best reading — do not default to 0 just because handwriting is hard to read. A reasonable guess is better than 0.
- If BB or SO columns are not present in the scorebook, leave them as 0.
- "crossed_out": true if the entire player row is crossed out or marked as an error/void.
- For notes (2B/3B/HR): look for a notes/extras section on the page listing who hit extra-base hits. If a player hit multiple, write "Name 2" (e.g., "Zach 2").
- Skip any TEAM totals row at the bottom — only individual player rows.`;

  let text = "";
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    text = response.content[0]?.type === "text" ? response.content[0].text : "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Anthropic API error:", msg);
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 502 });
  }

  try {
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const data = JSON.parse(clean);
    // Validate expected shape
    if (!Array.isArray(data.players)) throw new Error("Missing players array");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Claude returned invalid JSON", raw: text }, { status: 422 });
  }
}
