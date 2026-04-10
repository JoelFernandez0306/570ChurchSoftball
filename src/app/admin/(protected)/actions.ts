"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPageAccess } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";
import { cleanPhone, normalizeAlias } from "@/lib/utils";
import {
  DEFAULT_COMPETITION_PHASE,
} from "@/lib/league-data";
import type { CompetitionPhase } from "@/lib/types";

function parseGameNumber(value: FormDataEntryValue | null): 1 | 2 {
  const raw = Number(value);
  return raw === 2 ? 2 : 1;
}

function parseRosterRole(value: FormDataEntryValue | null): "player" | "coach" {
  return String(value ?? "").toLowerCase() === "coach" ? "coach" : "player";
}

function parseCompetitionPhase(value: FormDataEntryValue | null): CompetitionPhase {
  return String(value ?? "").toLowerCase() === "playoffs"
    ? "playoffs"
    : DEFAULT_COMPETITION_PHASE;
}

function buildInviteRedirectUrl(baseUrl: string, invitedEmail: string): string {
  const normalizedEmail = invitedEmail.trim().toLowerCase();

  try {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set("invite", "1");
    parsed.searchParams.set("invited_email", normalizedEmail);
    return parsed.toString();
  } catch {
    const [withoutHash, hashPart] = baseUrl.split("#", 2);
    const [pathPart, queryPart] = withoutHash.split("?", 2);
    const searchParams = new URLSearchParams(queryPart ?? "");
    searchParams.set("invite", "1");
    searchParams.set("invited_email", normalizedEmail);

    const query = searchParams.toString();
    const hash = hashPart ? `#${hashPart}` : "";
    return `${pathPart}${query ? `?${query}` : ""}${hash}`;
  }
}

function redirectToAdminDashboardWithInviteError(message: string): never {
  redirect(`/admin/dashboard?invite_error=${encodeURIComponent(message)}`);
}

export async function createTeamAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const name = String(formData.get("name") ?? "").trim();
  const shortName = String(formData.get("short_name") ?? "").trim();

  if (!name) {
    throw new Error("Team name is required");
  }

  const { error } = await supabase.schema("league").from("teams").insert({
    name,
    short_name: shortName || null,
    created_by: user.id,
  });

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  revalidatePath("/");
}

export async function deleteTeamAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const teamId = String(formData.get("team_id") ?? "");

  if (!teamId) {
    throw new Error("Team ID is required");
  }

  const { error } = await supabase.schema("league").from("teams").delete().eq("id", teamId);

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`);
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/rosters");
  revalidatePath("/admin/schedule");
  revalidatePath("/teams");
  revalidatePath("/schedule");
}

export async function createAliasAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const teamId = String(formData.get("team_id") ?? "");
  const alias = String(formData.get("alias") ?? "").trim();

  if (!teamId || !alias) {
    throw new Error("Team and alias are required");
  }

  const normalizedAlias = normalizeAlias(alias);

  const { error } = await supabase.schema("league").from("team_aliases").insert({
    team_id: teamId,
    alias,
    normalized_alias: normalizedAlias,
    created_by: user.id,
  });

  if (error) {
    throw new Error(`Failed to add alias: ${error.message}`);
  }

  revalidatePath("/admin/teams");
}

export async function deleteAliasAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const aliasId = String(formData.get("alias_id") ?? "");

  if (!aliasId) {
    throw new Error("Alias ID is required");
  }

  const { error } = await supabase
    .schema("league")
    .from("team_aliases")
    .delete()
    .eq("id", aliasId);

  if (error) {
    throw new Error(`Failed to delete alias: ${error.message}`);
  }

  revalidatePath("/admin/teams");
}

export async function createPlayerAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const teamId = String(formData.get("team_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const jerseyNumber = String(formData.get("jersey_number") ?? "").trim();
  const role = parseRosterRole(formData.get("role"));

  if (!teamId || !fullName) {
    throw new Error("Team and full name are required");
  }

  const { error } = await supabase.schema("league").from("players").insert({
    team_id: teamId,
    full_name: fullName,
    jersey_number: jerseyNumber || null,
    role,
    created_by: user.id,
  });

  if (error) {
    throw new Error(`Failed to add player: ${error.message}`);
  }

  revalidatePath("/admin/rosters");
  revalidatePath("/teams");
  redirect(`/admin/rosters?team_id=${encodeURIComponent(teamId)}`);
}

export async function updatePlayerAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const playerId = String(formData.get("player_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const jerseyNumber = String(formData.get("jersey_number") ?? "").trim();
  const role = parseRosterRole(formData.get("role"));

  if (!playerId) {
    throw new Error("Player ID is required");
  }

  if (!fullName) {
    throw new Error("Full name is required");
  }

  const { error } = await supabase
    .schema("league")
    .from("players")
    .update({
      full_name: fullName,
      jersey_number: jerseyNumber || null,
      role,
    })
    .eq("id", playerId);

  if (error) {
    throw new Error(`Failed to update player: ${error.message}`);
  }

  revalidatePath("/admin/rosters");
  revalidatePath("/teams");
}

export async function deletePlayerAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const playerId = String(formData.get("player_id") ?? "");

  if (!playerId) {
    throw new Error("Player ID is required");
  }

  const { error } = await supabase.schema("league").from("players").delete().eq("id", playerId);

  if (error) {
    throw new Error(`Failed to remove player: ${error.message}`);
  }

  revalidatePath("/admin/rosters");
  revalidatePath("/teams");
}

export async function createGameAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const gameDate = String(formData.get("game_date") ?? "");
  const gameTime = String(formData.get("game_time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const gameNumber = parseGameNumber(formData.get("game_number"));
  const gamePhase = parseCompetitionPhase(formData.get("game_phase"));
  const homeTeamId = String(formData.get("home_team_id") ?? "");
  const awayTeamId = String(formData.get("away_team_id") ?? "");

  if (!gameDate || !homeTeamId || !awayTeamId) {
    throw new Error("Date, home team, and away team are required");
  }

  if (homeTeamId === awayTeamId) {
    throw new Error("Home team and away team must be different.");
  }

  const { data: settings, error: settingsError } = await supabase
    .schema("league")
    .from("settings")
    .select("id,active_season_name")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`Failed to load active season: ${settingsError.message}`);
  }

  const activeSeasonName = settings?.active_season_name?.trim();
  if (!activeSeasonName) {
    throw new Error("Active season is not configured.");
  }

  const { error } = await supabase.schema("league").from("games").insert({
    season_name: activeSeasonName,
    game_phase: gamePhase,
    game_date: gameDate,
    game_time: gameTime || null,
    location: location || null,
    game_number: gameNumber,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    reported_by: user.id,
  });

  if (error) {
    throw new Error(`Failed to create game: ${error.message}`);
  }

  // Keep selected phase sticky for the next game slot form load.
  if (settings?.id) {
    await supabase
      .schema("league")
      .from("settings")
      .update({ active_competition_phase: gamePhase })
      .eq("id", settings.id);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/schedule");
  revalidatePath("/admin/standings");
  revalidatePath("/standings");
  revalidatePath("/");
  redirect(`/admin/schedule?game_phase=${encodeURIComponent(gamePhase)}`);
}

export async function updateGameResultAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const gameId = String(formData.get("game_id") ?? "");
  const winnerTeamId = String(formData.get("winner_team_id") ?? "");
  const loserTeamId = String(formData.get("loser_team_id") ?? "");
  const tieGame = formData.get("is_tie") === "on";

  if (!gameId) {
    throw new Error("Game ID is required");
  }

  if (!tieGame && winnerTeamId && loserTeamId && winnerTeamId === loserTeamId) {
    throw new Error("Winner and loser must be different teams.");
  }

  const payload = tieGame
    ? {
        winner_team_id: null,
        loser_team_id: null,
        is_tie: true,
        result_source: "manual",
        reported_by: user.id,
      }
    : {
        winner_team_id: winnerTeamId || null,
        loser_team_id: loserTeamId || null,
        is_tie: false,
        result_source: winnerTeamId && loserTeamId ? "manual" : null,
        reported_by: user.id,
      };

  const { error } = await supabase
    .schema("league")
    .from("games")
    .update(payload)
    .eq("id", gameId);

  if (error) {
    throw new Error(`Failed to update game result: ${error.message}`);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/standings");
  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/");
}

export async function updateGameAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const gameId = String(formData.get("game_id") ?? "");
  const gameDate = String(formData.get("game_date") ?? "").trim();
  const gameTime = String(formData.get("game_time") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const gameNumber = parseGameNumber(formData.get("game_number"));
  const gamePhase = parseCompetitionPhase(formData.get("game_phase"));
  const homeTeamId = String(formData.get("home_team_id") ?? "");
  const awayTeamId = String(formData.get("away_team_id") ?? "");

  if (!gameId) {
    throw new Error("Game ID is required");
  }

  if (!gameDate || !homeTeamId || !awayTeamId) {
    throw new Error("Date, home team, and away team are required");
  }

  if (homeTeamId === awayTeamId) {
    throw new Error("Home team and away team must be different.");
  }

  const { error } = await supabase
    .schema("league")
    .from("games")
    .update({
      game_date: gameDate,
      game_time: gameTime || null,
      location: location || null,
      game_number: gameNumber,
      game_phase: gamePhase,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
    })
    .eq("id", gameId);

  if (error) {
    throw new Error(`Failed to update game: ${error.message}`);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/standings");
  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/");
}

export async function deleteGameAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const gameId = String(formData.get("game_id") ?? "");

  if (!gameId) {
    throw new Error("Game ID is required");
  }

  const { error } = await supabase.schema("league").from("games").delete().eq("id", gameId);

  if (error) {
    throw new Error(`Failed to delete game: ${error.message}`);
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/standings");
  revalidatePath("/schedule");
  revalidatePath("/standings");
}

export async function saveRulesAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const title = String(formData.get("title") ?? "League Rules").trim() || "League Rules";
  const content = String(formData.get("content") ?? "").trim();
  const ruleId = String(formData.get("rule_id") ?? "").trim();

  if (!content) {
    throw new Error("Rules content is required");
  }

  if (ruleId) {
    const { error } = await supabase
      .schema("league")
      .from("rules")
      .update({ title, content, is_active: true, created_by: user.id })
      .eq("id", ruleId);

    if (error) {
      throw new Error(`Failed to update rules: ${error.message}`);
    }
  } else {
    const { error } = await supabase.schema("league").from("rules").insert({
      title,
      content,
      is_active: true,
      created_by: user.id,
    });

    if (error) {
      throw new Error(`Failed to create rules: ${error.message}`);
    }
  }

  revalidatePath("/admin/rules");
  revalidatePath("/rules");
}

export async function addAllowedSmsNumberAction(formData: FormData) {
  const user = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const phoneNumber = cleanPhone(String(formData.get("phone_number") ?? "").trim());
  const label = String(formData.get("label") ?? "").trim();

  if (!phoneNumber) {
    throw new Error("Phone number is required");
  }

  const { error } = await supabase.schema("league").from("allowed_sms_numbers").upsert(
    {
      phone_number: phoneNumber,
      label: label || null,
      active: true,
      created_by: user.id,
    },
    { onConflict: "phone_number" },
  );

  if (error) {
    throw new Error(`Failed to save phone number: ${error.message}`);
  }

  revalidatePath("/admin/sms");
}

export async function removeAllowedSmsNumberAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Record ID is required");
  }

  const { error } = await supabase
    .schema("league")
    .from("allowed_sms_numbers")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to remove phone number: ${error.message}`);
  }

  revalidatePath("/admin/sms");
}

export async function updateAllowedSmsNumberAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const id = String(formData.get("id") ?? "").trim();
  const phoneNumber = cleanPhone(String(formData.get("phone_number") ?? "").trim());
  const label = String(formData.get("label") ?? "").trim();

  if (!id) {
    throw new Error("Record ID is required");
  }

  if (!phoneNumber) {
    throw new Error("Phone number is required");
  }

  const { error } = await supabase
    .schema("league")
    .from("allowed_sms_numbers")
    .update({
      phone_number: phoneNumber,
      label: label || null,
      active: true,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update phone number: ${error.message}`);
  }

  revalidatePath("/admin/sms");
}

export async function addAdminByEmailAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email) {
    redirectToAdminDashboardWithInviteError("Email is required.");
  }

  let page = 1;
  let matchedUser:
    | { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
    | null = null;

  while (!matchedUser && page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      redirectToAdminDashboardWithInviteError(`Failed to search auth users: ${error.message}`);
    }

    const users = data.users ?? [];
    matchedUser =
      users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  if (!matchedUser) {
    const directRedirect = process.env.ADMIN_INVITE_REDIRECT_URL?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const defaultInviteRedirect = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/admin/create/login`
      : undefined;
    const baseRedirectTo = directRedirect || defaultInviteRedirect;
    const redirectTo = baseRedirectTo
      ? buildInviteRedirectUrl(baseRedirectTo, email)
      : undefined;

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        ...(redirectTo ? { redirectTo } : {}),
        ...(fullName
          ? { data: { full_name: fullName } }
          : {}),
      },
    );

    if (inviteError) {
      redirectToAdminDashboardWithInviteError(`Failed to invite admin: ${inviteError.message}`);
    }

    if (!inviteData.user) {
      redirectToAdminDashboardWithInviteError(
        "Admin invite was sent but no user record was returned. Please try again.",
      );
    }

    matchedUser = {
      id: inviteData.user.id,
      email: inviteData.user.email,
      user_metadata: inviteData.user.user_metadata,
    };
  }

  const displayName =
    fullName ||
    (typeof matchedUser.user_metadata?.full_name === "string"
      ? String(matchedUser.user_metadata.full_name)
      : matchedUser.email) ||
    "League Admin";

  const { error } = await supabase.schema("league").from("admins").upsert(
    {
      user_id: matchedUser.id,
      full_name: displayName,
      active: true,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    redirectToAdminDashboardWithInviteError(`Failed to add admin: ${error.message}`);
  }

  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard?invite_success=1");
}

export async function saveGcOrgScoreboardUrlAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const url = String(formData.get("gamechanger_org_scoreboard_url") ?? "").trim();

  const { data: settings, error: settingsError } = await supabase
    .schema("league")
    .from("settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError) throw new Error(`Failed to load settings: ${settingsError.message}`);
  if (!settings) throw new Error("League settings not found.");

  const { error } = await supabase
    .schema("league")
    .from("settings")
    .update({ gamechanger_org_scoreboard_url: url || null })
    .eq("id", settings.id);

  if (error) throw new Error(`Failed to save scoreboard URL: ${error.message}`);

  revalidatePath("/");
  revalidatePath("/admin/dashboard");
}

export async function saveGcOrgStatsUrlAction(formData: FormData) {
  await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();

  const url = String(formData.get("gamechanger_org_stats_url") ?? "").trim();

  const { data: settings, error: settingsError } = await supabase
    .schema("league")
    .from("settings")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`Failed to load settings: ${settingsError.message}`);
  }

  if (!settings) {
    throw new Error("League settings not found.");
  }

  const { error } = await supabase
    .schema("league")
    .from("settings")
    .update({ gamechanger_org_stats_url: url || null })
    .eq("id", settings.id);

  if (error) {
    throw new Error(`Failed to save stats URL: ${error.message}`);
  }

  revalidatePath("/stats");
  revalidatePath("/admin/dashboard");
}

export async function removeAdminAction(formData: FormData) {
  const currentUser = await requireAdminPageAccess();
  const supabase = getServiceSupabaseClient();
  const adminId = String(formData.get("admin_id") ?? "");

  if (!adminId) {
    throw new Error("Admin record ID is required");
  }

  const { data: target, error: targetError } = await supabase
    .schema("league")
    .from("admins")
    .select("id,user_id")
    .eq("id", adminId)
    .maybeSingle();

  if (targetError) {
    throw new Error(`Failed to load target admin: ${targetError.message}`);
  }

  if (!target) {
    throw new Error("Admin record not found");
  }

  if (target.user_id === currentUser.id) {
    throw new Error("You cannot remove your own admin access.");
  }

  const { error } = await supabase.schema("league").from("admins").delete().eq("id", adminId);

  if (error) {
    throw new Error(`Failed to remove admin: ${error.message}`);
  }

  revalidatePath("/admin/dashboard");
}
