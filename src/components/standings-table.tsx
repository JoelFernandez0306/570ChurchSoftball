import { formatPct } from "@/lib/utils";
import type { StandingsRow } from "@/lib/types";

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">No standings yet. Add teams and game results to begin.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>T</th>
            <th>Win %</th>
            <th>H2H %</th>
            <th>Override</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>{row.rank}</td>
              <td>{row.teamName}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>{row.ties}</td>
              <td>{formatPct(row.winPct)}</td>
              <td>{formatPct(row.headToHeadPct)}</td>
              <td>{row.overrideApplied ? "Applied" : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
