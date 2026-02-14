import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { parseSmsCommand } from "@/lib/sms-parser";
import { resolveTeamAlias } from "@/lib/team-resolver";
import { validateTwilioSignature, twimlMessage } from "@/lib/twilio";
import { cleanPhone } from "@/lib/utils";
import { env } from "@/lib/env";

function twimlResponse(message: string, status = 200) {
  return new NextResponse(twimlMessage(message), {
    status,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

function formDataToObject(formData: FormData): Record<string, string> {
  const object: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    object[key] = String(value);
  }

  return object;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const params = formDataToObject(formData);

    const signature = request.headers.get("x-twilio-signature");
    const expectedUrl = env.twilioWebhookUrl || request.url;
    const signatureOk = validateTwilioSignature(signature, expectedUrl, params);

    if (!signatureOk) {
      return twimlResponse("Unauthorized Twilio request.", 403);
    }

    const from = cleanPhone(params.From ?? "");
    const to = cleanPhone(params.To ?? "");
    const body = params.Body ?? "";

    if (!from || !body) {
      return twimlResponse("Missing phone number or message body.", 400);
    }

    const configuredTwilioNumber = cleanPhone(env.twilioPhoneNumber);
    if (configuredTwilioNumber && to && configuredTwilioNumber !== to) {
      return twimlResponse("Inbound number mismatch for this webhook.", 400);
    }

    const supabase = getServiceSupabaseClient();

    const { data: numberRecord, error: numberError } = await supabase
      .schema("league")
      .from("allowed_sms_numbers")
      .select("id,phone_number")
      .eq("phone_number", from)
      .eq("active", true)
      .maybeSingle();

    if (numberError) {
      return twimlResponse(`Error checking sender: ${numberError.message}`, 500);
    }

    if (!numberRecord) {
      return twimlResponse("This phone number is not allowed to report game results.", 403);
    }

    const parsed = parseSmsCommand(body);
    if (parsed.errors.length > 0) {
      return twimlResponse(`Could not parse message. ${parsed.errors.join(". ")}`);
    }

    const [teamsResult, aliasesResult] = await Promise.all([
      supabase.schema("league").from("teams").select("id,name,short_name"),
      supabase.schema("league").from("team_aliases").select("team_id,alias,normalized_alias"),
    ]);

    if (teamsResult.error) {
      return twimlResponse(`Failed to load teams: ${teamsResult.error.message}`, 500);
    }

    if (aliasesResult.error) {
      return twimlResponse(`Failed to load aliases: ${aliasesResult.error.message}`, 500);
    }

    const lookup = {
      teams: teamsResult.data ?? [],
      aliases: aliasesResult.data ?? [],
    };

    const winner = resolveTeamAlias(parsed.winnerAlias, lookup);
    const loser = resolveTeamAlias(parsed.loserAlias, lookup);
    const firstLabel = parsed.isTie ? "first team" : "winner team";
    const secondLabel = parsed.isTie ? "second team" : "loser team";

    if (!winner.teamId) {
      const hint = winner.ambiguousOptions.length
        ? ` Unsure ${firstLabel} "${parsed.winnerAlias}". Did you mean: ${winner.ambiguousOptions.join(", ")}?`
        : ` Unsure ${firstLabel} "${parsed.winnerAlias}".`;
      return twimlResponse(`No update saved.${hint} Reply with exact team name.`);
    }

    if (!loser.teamId) {
      const hint = loser.ambiguousOptions.length
        ? ` Unsure ${secondLabel} "${parsed.loserAlias}". Did you mean: ${loser.ambiguousOptions.join(", ")}?`
        : ` Unsure ${secondLabel} "${parsed.loserAlias}".`;
      return twimlResponse(`No update saved.${hint} Reply with exact team name.`);
    }

    if (winner.teamId === loser.teamId) {
      return twimlResponse(
        parsed.isTie
          ? "Both tie teams resolved to the same team. Please resend."
          : "Winner and loser resolved to the same team. Please resend.",
      );
    }

    const { data: game, error: gameError } = await supabase
      .schema("league")
      .from("games")
      .select("id")
      .eq("game_date", parsed.date)
      .eq("game_number", parsed.slot)
      .or(
        `and(home_team_id.eq.${winner.teamId},away_team_id.eq.${loser.teamId}),and(home_team_id.eq.${loser.teamId},away_team_id.eq.${winner.teamId})`,
      )
      .limit(1)
      .maybeSingle();

    if (gameError) {
      return twimlResponse(`Game lookup failed: ${gameError.message}`, 500);
    }

    if (!game) {
      return twimlResponse(
        `No scheduled game found for ${parsed.date} G${parsed.slot} between ${winner.teamName} and ${loser.teamName}.`,
      );
    }

    const { error: updateError } = await supabase
      .schema("league")
      .from("games")
      .update(
        parsed.isTie
          ? {
              is_tie: true,
              winner_team_id: null,
              loser_team_id: null,
              result_source: "sms",
            }
          : {
              is_tie: false,
              winner_team_id: winner.teamId,
              loser_team_id: loser.teamId,
              result_source: "sms",
            },
      )
      .eq("id", game.id);

    if (updateError) {
      return twimlResponse(`Failed to update game: ${updateError.message}`, 500);
    }

    await supabase.schema("league").from("audit_log").insert({
      action: "sms_result_update",
      entity_type: "game",
      entity_id: game.id,
      details: {
        from,
        body,
        parsedDate: parsed.date,
        gameNumber: parsed.slot,
        isTie: parsed.isTie,
        teamAId: winner.teamId,
        teamBId: loser.teamId,
      },
    });

    revalidatePath("/");
    revalidatePath("/schedule");
    revalidatePath("/standings");
    revalidatePath("/admin/schedule");
    revalidatePath("/admin/standings");

    if (parsed.isTie) {
      return twimlResponse(
        `Recorded: ${parsed.date} G${parsed.slot} ${winner.teamName} T and ${loser.teamName} T.`,
      );
    }

    return twimlResponse(
      `Recorded: ${parsed.date} G${parsed.slot} ${winner.teamName} W vs ${loser.teamName} L.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected SMS processing error";
    return twimlResponse(`Error processing SMS: ${message}`, 500);
  }
}
