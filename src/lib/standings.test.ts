import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";

describe("computeStandings", () => {
  const teams = [
    { id: "team-a", name: "Saint Johns" },
    { id: "team-b", name: "Calvary Bible" },
    { id: "team-c", name: "St Lukes" },
  ];

  it("sorts by winning percentage", () => {
    const standings = computeStandings(
      teams,
      [
        { home_team_id: "team-a", away_team_id: "team-b", is_tie: false, winner_team_id: "team-a", loser_team_id: "team-b" },
        { home_team_id: "team-a", away_team_id: "team-c", is_tie: false, winner_team_id: "team-a", loser_team_id: "team-c" },
        { home_team_id: "team-c", away_team_id: "team-b", is_tie: false, winner_team_id: "team-c", loser_team_id: "team-b" },
      ],
      [],
    );

    expect(standings[0].teamId).toBe("team-a");
    expect(standings[0].wins).toBe(2);
    expect(standings[0].losses).toBe(0);
  });

  it("applies tie override when still tied", () => {
    const standings = computeStandings(
      teams.slice(0, 2),
      [
        { home_team_id: "team-a", away_team_id: "team-b", is_tie: false, winner_team_id: "team-a", loser_team_id: "team-b" },
        { home_team_id: "team-b", away_team_id: "team-a", is_tie: false, winner_team_id: "team-b", loser_team_id: "team-a" },
      ],
      [
        { team_id: "team-b", priority: 1, active: true },
        { team_id: "team-a", priority: 2, active: true },
      ],
    );

    expect(standings[0].teamId).toBe("team-b");
    expect(standings[0].overrideApplied).toBe(true);
    expect(standings[1].overrideApplied).toBe(true);
  });

  it("counts ties into standings and win percentage", () => {
    const standings = computeStandings(
      teams.slice(0, 2),
      [
        { home_team_id: "team-a", away_team_id: "team-b", is_tie: true, winner_team_id: null, loser_team_id: null },
      ],
      [],
    );

    expect(standings[0].ties).toBe(1);
    expect(standings[1].ties).toBe(1);
    expect(standings[0].winPct).toBe(0.5);
    expect(standings[1].winPct).toBe(0.5);
  });
});
