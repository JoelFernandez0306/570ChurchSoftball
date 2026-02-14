import { normalizeAlias } from "@/lib/utils";
import type { ResolvedTeam, TeamAlias, Team } from "@/lib/types";

interface TeamLookupInput {
  teams: Pick<Team, "id" | "name" | "short_name">[];
  aliases: Pick<TeamAlias, "team_id" | "alias" | "normalized_alias">[];
}

interface Candidate {
  id: string;
  name: string;
  aliases: Set<string>;
}

function buildCandidates(input: TeamLookupInput): Candidate[] {
  return input.teams.map((team) => {
    const teamAliases = new Set<string>();

    teamAliases.add(normalizeAlias(team.name));
    if (team.short_name) {
      teamAliases.add(normalizeAlias(team.short_name));
    }

    input.aliases
      .filter((alias) => alias.team_id === team.id)
      .forEach((alias) => {
        teamAliases.add(normalizeAlias(alias.alias));
        teamAliases.add(normalizeAlias(alias.normalized_alias));
      });

    return {
      id: team.id,
      name: team.name,
      aliases: teamAliases,
    };
  });
}

export function resolveTeamAlias(aliasInput: string, lookup: TeamLookupInput): ResolvedTeam {
  const normalized = normalizeAlias(aliasInput);
  const candidates = buildCandidates(lookup);

  if (!normalized) {
    return {
      teamId: null,
      teamName: null,
      ambiguousOptions: [],
    };
  }

  const exactMatches = candidates.filter((candidate) => candidate.aliases.has(normalized));

  if (exactMatches.length === 1) {
    return {
      teamId: exactMatches[0].id,
      teamName: exactMatches[0].name,
      ambiguousOptions: [],
    };
  }

  if (exactMatches.length > 1) {
    return {
      teamId: null,
      teamName: null,
      ambiguousOptions: exactMatches.map((candidate) => candidate.name),
    };
  }

  const partialMatches = candidates.filter((candidate) =>
    Array.from(candidate.aliases).some(
      (alias) =>
        alias.includes(normalized) ||
        normalized.includes(alias),
    ),
  );

  if (partialMatches.length === 1) {
    return {
      teamId: partialMatches[0].id,
      teamName: partialMatches[0].name,
      ambiguousOptions: [],
    };
  }

  return {
    teamId: null,
    teamName: null,
    ambiguousOptions: partialMatches.map((candidate) => candidate.name),
  };
}
