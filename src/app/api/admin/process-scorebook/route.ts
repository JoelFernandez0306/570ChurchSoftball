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

Extract the batting lineup stats for THIS ONE TEAM ONLY. Return ONLY valid JSON — no markdown, no explanation.

Return this exact structure:
{
  "players": [
    {
      "name": "Player name as written",
      "ab": 0,
      "r": 0,
      "h": 0,
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
- "crossed_out": true if the player row is scribbled out, crossed out, or otherwise marked as an error. Include these rows but flag them.
- For notes (2B/3B/HR): list player names as written. If a player hit multiple, write "Name 2" (e.g., "Zach Zimmerman 2").
- If a stat cell is crossed out but it is part of a valid row, still flag the whole row as crossed_out: true.
- If you cannot read a number clearly, use 0.
- Skip TEAM totals rows — only include individual player rows.
- Extract exactly what you see. Do not invent or guess missing values.`;

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
