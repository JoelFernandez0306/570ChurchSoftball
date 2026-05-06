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

SCOREBOOK LAYOUT — read carefully before extracting:

This is a play-by-play grid scorebook. Each player row has a grid of small cells, one per at-bat/inning slot. Each filled cell contains a notation showing what happened that plate appearance. You must decode EACH CELL per player to compute their stats.

CELL NOTATION KEY (standard softball scoring):
- Outs: any of "K", "k" = strikeout (SO). Numbers like "4-3", "6-3", "5-3", "1-3", "3u", "F7", "F8", "F9", "P6", "L6" etc. = out (not a hit, not a walk). Count these as AB only.
- Hits: "1B" or a single underline/dash = single. "2B" or double underline = double. "3B" = triple. "HR" or circle = home run. A circled number or special mark = hit. Count as AB + H.
- Walk/BB: "BB", "W", or "////" = walk. Count as BB but NOT as AB.
- HBP: "HBP" = hit by pitch. NOT an AB.
- Empty cell = player did not bat that slot. Do not count.

HOW TO COUNT PER PLAYER:
- AB = number of filled cells that are OUTS or HITS (not walks/HBP)
- H = number of filled cells that are HITS
- BB = number of walk cells
- SO = number of K/strikeout cells
- R = count any run-scoring indicators (circled cell, "R", arrow to home, etc.)
- RBI = count any RBI indicators if visible

ALSO CHECK: Some scorebooks have per-player totals written in small columns on the far right side of the page. If those summary columns are visible, use them — they are more reliable than cell counting.

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
- Commit to your best reading of each cell. A reasonable estimate is far better than returning 0.
- "crossed_out": true if the entire player row is visibly crossed out or voided.
- For notes: look for any extras/notes section, or infer from cells you identified as 2B/3B/HR.
- Skip the TEAM TOTALS row at the bottom.
- Most players will have 1–3 AB in a short softball game. If you count 0 for everyone, you have misread the format — look again.`;

  let text = "";
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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
    // Extract the first {...} block regardless of any surrounding explanation text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");
    const data = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(data.players)) throw new Error("Missing players array");
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Claude returned invalid JSON", raw: text }, { status: 422 });
  }
}
