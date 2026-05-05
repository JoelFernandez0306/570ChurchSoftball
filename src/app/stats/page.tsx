import { SiteHeader } from "@/components/site-header";
import { loadBattingStats, BattingStatRow } from "@/lib/league-data";
import { formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic";

function fmtAvg(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}


function fmtInt(val: number | undefined): string {
  if (val === undefined || val === null) return "—";
  return val === 0 ? "0" : String(val);
}

const LEGEND = [
  { abbr: "GP",  def: "Games played" },
  { abbr: "AB",  def: "At bats" },
  { abbr: "R",   def: "Runs scored" },
  { abbr: "H",   def: "Hits" },
  { abbr: "2B",  def: "Doubles" },
  { abbr: "3B",  def: "Triples" },
  { abbr: "HR",  def: "Home runs" },
  { abbr: "RBI", def: "Runs batted in" },
  { abbr: "BB",  def: "Walks (bases on balls)" },
  { abbr: "SO",  def: "Strikeouts" },
  { abbr: "AVG", def: "Batting average (H ÷ AB)" },
];

function PhaseStats({ rows }: { rows: BattingStatRow[] }) {
  const teamOrder: string[] = [];
  const byTeam = new Map<string, BattingStatRow[]>();
  for (const row of rows) {
    const t = row.team_name ?? "Unknown";
    if (!byTeam.has(t)) { byTeam.set(t, []); teamOrder.push(t); }
    byTeam.get(t)!.push(row);
  }

  return (
    <>
      {teamOrder.map(team => (
        <div key={team} style={{ marginBottom: "2rem", minWidth: 0 }}>
          <h3 style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            padding: "0.6rem 0",
            borderBottom: "3px solid var(--accent, #2563eb)",
            marginBottom: "0.75rem",
          }}>
            {team}
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--surface-alt)" }}>Player</th>
                  <th title="Games Played">GP</th>
                  <th title="At Bats">AB</th>
                  <th title="Runs Scored">R</th>
                  <th title="Hits">H</th>
                  <th title="Doubles">2B</th>
                  <th title="Triples">3B</th>
                  <th title="Home Runs">HR</th>
                  <th title="Runs Batted In">RBI</th>
                  <th title="Walks">BB</th>
                  <th title="Strikeouts">SO</th>
                  <th title="Batting Average" style={{ fontWeight: 700 }}>AVG</th>
                </tr>
              </thead>
              <tbody>
                {byTeam.get(team)!.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, position: "sticky", left: 0, zIndex: 1, background: "var(--surface-alt)" }}>{row.player_name}</td>
                    <td>{fmtInt(row.gp)}</td>
                    <td>{fmtInt(row.ab)}</td>
                    <td>{fmtInt(row.r)}</td>
                    <td>{fmtInt(row.h)}</td>
                    <td>{fmtInt(row.doubles)}</td>
                    <td>{fmtInt(row.triples)}</td>
                    <td>{fmtInt(row.hr)}</td>
                    <td>{fmtInt(row.rbi)}</td>
                    <td>{fmtInt(row.bb)}</td>
                    <td>{fmtInt(row.so)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtAvg(row.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

export default async function StatsPage() {
  const { rows, syncedAt } = await loadBattingStats();

  const syncLabel = syncedAt
    ? formatInTimeZone(new Date(syncedAt), "America/New_York", "MMM d 'at' h:mm a zzz")
    : null;

  const regularRows = rows.filter(r => r.season_type !== "playoff");
  const playoffRows = rows.filter(r => r.season_type === "playoff");

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
            <>
              {/* Regular Season */}
              {regularRows.length > 0 && (
                <>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "0.25rem" }}>
                    Regular Season
                  </h2>
                  <PhaseStats rows={regularRows} />
                </>
              )}

              {/* Playoffs */}
              {playoffRows.length > 0 && (
                <>
                  <h2 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "1.5rem 0 0.25rem" }}>
                    Playoffs
                  </h2>
                  <PhaseStats rows={playoffRows} />
                </>
              )}

              {/* Stat Legend */}
              <article className="card" style={{ marginTop: "2rem" }}>
                <h3 style={{ marginBottom: "1rem" }}>Stat Definitions</h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "0.4rem 2rem",
                }}>
                  {LEGEND.map(({ abbr, def }) => (
                    <div key={abbr} style={{ display: "flex", gap: "0.5rem", fontSize: "0.875rem" }}>
                      <span style={{ fontWeight: 700, minWidth: "4.5rem", flexShrink: 0 }}>{abbr}</span>
                      <span style={{ color: "var(--ink-soft)" }}>{def}</span>
                    </div>
                  ))}
                </div>
              </article>
            </>
          )}
        </section>
      </main>
    </>
  );
}
