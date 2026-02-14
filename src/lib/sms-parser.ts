import { parseLeagueDate, toLeagueDateString } from "@/lib/utils";
import type { GameSlot, SmsParseResult } from "@/lib/types";

const DATE_TOKEN = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;
const WIN_WORDS = new Set(["w", "win", "won"]);
const LOSS_WORDS = new Set(["l", "loss", "lost"]);

function parseSlot(token: string): GameSlot | null {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (["g1", "game1", "1", "1st", "first"].includes(normalized)) {
    return 1;
  }

  if (["g2", "game2", "2", "2nd", "second"].includes(normalized)) {
    return 2;
  }

  return null;
}

function parseDateToken(token: string): string | null {
  const match = token.match(DATE_TOKEN);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = match[3] ? Number(match[3]) : undefined;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const year = rawYear
    ? rawYear < 100
      ? 2000 + rawYear
      : rawYear
    : undefined;

  const validatedYear = year ?? Number(new Date().getUTCFullYear());
  const dateProbe = new Date(Date.UTC(validatedYear, month - 1, day));
  if (
    dateProbe.getUTCFullYear() !== validatedYear ||
    dateProbe.getUTCMonth() !== month - 1 ||
    dateProbe.getUTCDate() !== day
  ) {
    return null;
  }

  return parseLeagueDate(month, day, year);
}

function normalizeResultToken(token: string): "w" | "l" | null {
  const clean = token.toLowerCase().replace(/[^a-z]/g, "");

  if (WIN_WORDS.has(clean)) {
    return "w";
  }

  if (LOSS_WORDS.has(clean)) {
    return "l";
  }

  return null;
}

export function parseSmsCommand(input: string): SmsParseResult {
  const errors: string[] = [];
  const cleaned = input.replace(/[,:;()\[\]]/g, " ").replace(/\s+/g, " ").trim();
  const rawTokens = cleaned.split(" ").filter(Boolean);

  let date = toLeagueDateString();
  if (rawTokens.length === 0) {
    return {
      date,
      slot: 1,
      isTie: false,
      winnerAlias: "",
      loserAlias: "",
      confidence: "low",
      errors: ["No content in SMS"],
    };
  }

  let tokens = [...rawTokens];
  const firstToken = tokens[0];
  const isDateLike = DATE_TOKEN.test(firstToken);
  const maybeDate = parseDateToken(firstToken);
  if (maybeDate) {
    date = maybeDate;
    tokens = tokens.slice(1);
  } else if (isDateLike) {
    errors.push("Date must be valid MM/DD or MM/DD/YYYY");
  }

  if (tokens.length === 0) {
    return {
      date,
      slot: 1,
      isTie: false,
      winnerAlias: "",
      loserAlias: "",
      confidence: "low",
      errors: ["Missing game slot and teams"],
    };
  }

  const slotIndex = tokens.findIndex((token) => parseSlot(token) !== null);
  if (slotIndex === -1) {
    errors.push("Missing game slot (G1 or G2)");
  }

  const slot = slotIndex >= 0 ? parseSlot(tokens[slotIndex]) ?? 1 : 1;
  if (slotIndex >= 0) {
    tokens.splice(slotIndex, 1);
  }

  const body = tokens.join(" ");
  const tieByMarker = body.match(/(.+?)\s+(T|TIE)\s+(.+?)\s+(T|TIE)$/i);
  if (tieByMarker) {
    const teamA = tieByMarker[1].trim();
    const teamB = tieByMarker[3].trim();

    return {
      date,
      slot,
      isTie: true,
      winnerAlias: teamA,
      loserAlias: teamB,
      confidence: errors.length === 0 ? "high" : "low",
      errors,
    };
  }

  const tieByPhrase = body.match(/(.+?)\s+(VS|V)\s+(.+?)\s+TIE(?:\s+GAME)?$/i);
  if (tieByPhrase) {
    const teamA = tieByPhrase[1].trim();
    const teamB = tieByPhrase[3].trim();

    return {
      date,
      slot,
      isTie: true,
      winnerAlias: teamA,
      loserAlias: teamB,
      confidence: errors.length === 0 ? "high" : "low",
      errors,
    };
  }

  const match = body.match(
    /(.+?)\s+(W|WIN|WON|L|LOSS|LOST)\s+(.+?)\s+(W|WIN|WON|L|LOSS|LOST)$/i,
  );

  if (!match) {
    errors.push(
      "Could not parse teams. Use format: MM/DD G1 TeamA W TeamB L or MM/DD G1 TeamA T TeamB T",
    );

    return {
      date,
      slot,
      isTie: false,
      winnerAlias: "",
      loserAlias: "",
      confidence: "low",
      errors,
    };
  }

  const teamA = match[1].trim();
  const statusA = normalizeResultToken(match[2]);
  const teamB = match[3].trim();
  const statusB = normalizeResultToken(match[4]);

  if (!statusA || !statusB || statusA === statusB) {
    errors.push("Result markers must include one winner and one loser");
  }

  const winnerAlias = statusA === "w" ? teamA : teamB;
  const loserAlias = statusA === "w" ? teamB : teamA;

  const confidence = errors.length === 0 ? "high" : "low";

  return {
    date,
    slot,
    isTie: false,
    winnerAlias,
    loserAlias,
    confidence,
    errors,
  };
}
