import { SiteHeader } from "@/components/site-header";
import { loadBattingStats } from "@/lib/league-data";
import { formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic";

function fmtAvg(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function fmtInt(val: number): string {
  return val === 0 ? "0" : String(val);
}

export default async function StatsPage() {
  const { rows, syncedAt } = await loadBattingStats();

  const syncLabel = syncedAt
    ? formatInTimeZone(new Date(syncedAt), "America/New_York", "MMM d 'at' h:mm a zzz")
    : null;

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface stack">
          <div className="page-header">
            <div>
              <h2>Player Stats</h2>
              <p>Season batting statistics for all players across all teams.</p>
            </div>
            {syncLabel && (
              <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                Updated {syncLabel}
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <article className="card">
              <h3>Stats coming soon</h3>
              <p>
                Batting stats will appear here automatically after games are scored in GameChanger.
                Stats sync nightly.
              </p>
            </article>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th title="Games Played">GP</th>
                    <th title="Plate Appearances">PA</th>
                    <th title="At Bats">AB</th>
                    <th title="Batting Average">AVG</th>
                    <th title="On-Base Percentage">OBP</th>
                    <th title="OPS">OPS</th>
                    <th title="Slugging Percentage">SLG</th>
                    <th title="Hits">H</th>
                    <th title="Singles">1B</th>
                    <th title="Doubles">2B</th>
                    <th title="Triples">3B</th>
                    <th title="Home Runs">HR</th>
                    <th title="Runs Batted In">RBI</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.player_name}</td>
                      <td style={{ color: "var(--ink-soft)", fontSize: "0.88rem" }}>{row.team_name ?? "—"}</td>
                      <td>{fmtInt(row.gp)}</td>
                      <td>{fmtInt(row.pa)}</td>
                      <td>{fmtInt(row.ab)}</td>
                      <td style={{ fontWeight: 650 }}>{fmtAvg(row.avg)}</td>
                      <td>{fmtAvg(row.obp)}</td>
                      <td>{fmtAvg(row.ops)}</td>
                      <td>{fmtAvg(row.slg)}</td>
                      <td>{fmtInt(row.h)}</td>
                      <td>{fmtInt(row.singles)}</td>
                      <td>{fmtInt(row.doubles)}</td>
                      <td>{fmtInt(row.triples)}</td>
                      <td>{fmtInt(row.hr)}</td>
                      <td>{fmtInt(row.rbi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
