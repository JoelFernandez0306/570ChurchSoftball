import { SiteHeader } from "@/components/site-header";
import { loadBattingStats } from "@/lib/league-data";
import { formatInTimeZone } from "date-fns-tz";

export const dynamic = "force-dynamic";

function fmtAvg(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(3).replace(/^0/, "");
}

function fmtDec(val: number | null | undefined, places = 2): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(places);
}

function fmtInt(val: number | undefined): string {
  if (val === undefined || val === null) return "—";
  return val === 0 ? "0" : String(val);
}

const LEGEND = [
  { abbr: "PA",      def: "Plate appearances" },
  { abbr: "AB",      def: "At bats" },
  { abbr: "QAB",     def: "Quality at bats (any one of: 3 pitches after 2 strikes, 6+ pitch ABs, XBH, HHB, BB, SAC Bunt, SAC Fly)" },
  { abbr: "HHB",     def: "Hard hit balls: Total line drives and hard ground balls" },
  { abbr: "LD",      def: "Line drives" },
  { abbr: "FB",      def: "Fly balls" },
  { abbr: "GB",      def: "Ground balls" },
  { abbr: "BABIP",   def: "Batting average on balls in play" },
  { abbr: "BA/RISP", def: "Batting average with runners in scoring position" },
  { abbr: "LOB",     def: "Runners left on base" },
  { abbr: "2OUTRBI", def: "2-out RBI" },
  { abbr: "XBH",     def: "Extra-base hits" },
  { abbr: "TB",      def: "Total bases" },
  { abbr: "PS",      def: "Pitches seen" },
  { abbr: "PS/PA",   def: "Pitches seen per plate appearance" },
  { abbr: "2S+3",    def: "Plate appearances in which batter sees 3+ pitches after 2 strikes" },
  { abbr: "6+",      def: "Plate appearances with 6+ pitches" },
  { abbr: "GIDP",    def: "Hit into double play" },
  { abbr: "CI",      def: "Batter advances on catcher's interference" },
];

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
            <>
              {/* Group rows by team */}
              {(() => {
                const teamOrder: string[] = [];
                const byTeam = new Map<string, typeof rows>();
                for (const row of rows) {
                  const t = row.team_name ?? "Unknown";
                  if (!byTeam.has(t)) { byTeam.set(t, []); teamOrder.push(t); }
                  byTeam.get(t)!.push(row);
                }
                return teamOrder.map(team => (
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
                            <th title="Plate Appearances">PA</th>
                            <th title="At Bats">AB</th>
                            <th title="Quality At Bats">QAB</th>
                            <th title="Hard Hit Balls">HHB</th>
                            <th title="Line Drives">LD</th>
                            <th title="Fly Balls">FB</th>
                            <th title="Ground Balls">GB</th>
                            <th title="Batting Average on Balls in Play">BABIP</th>
                            <th title="Batting Average with Runners in Scoring Position">BA/RISP</th>
                            <th title="Runners Left on Base">LOB</th>
                            <th title="2-Out RBI">2OUTRBI</th>
                            <th title="Extra-Base Hits">XBH</th>
                            <th title="Total Bases">TB</th>
                            <th title="Pitches Seen">PS</th>
                            <th title="Pitches Seen per Plate Appearance">PS/PA</th>
                            <th title="PA with 3+ pitches after 2 strikes">2S+3</th>
                            <th title="Plate Appearances with 6+ Pitches">6+</th>
                            <th title="Hit into Double Play">GIDP</th>
                            <th title="Catcher's Interference">CI</th>
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
                          {byTeam.get(team)!.map((row, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600, position: "sticky", left: 0, zIndex: 1, background: "var(--surface-alt)" }}>{row.player_name}</td>
                              <td>{fmtInt(row.gp)}</td>
                              <td>{fmtInt(row.pa)}</td>
                              <td>{fmtInt(row.ab)}</td>
                              <td>{fmtInt(row.qab)}</td>
                              <td>{fmtInt(row.hhb)}</td>
                              <td>{fmtInt(row.ld)}</td>
                              <td>{fmtInt(row.fb)}</td>
                              <td>{fmtInt(row.gb)}</td>
                              <td>{fmtAvg(row.babip)}</td>
                              <td>{fmtAvg(row.ba_risp)}</td>
                              <td>{fmtInt(row.lob)}</td>
                              <td>{fmtInt(row.two_out_rbi)}</td>
                              <td>{fmtInt(row.xbh)}</td>
                              <td>{fmtInt(row.tb)}</td>
                              <td>{fmtInt(row.ps)}</td>
                              <td>{fmtDec(row.ps_pa)}</td>
                              <td>{fmtInt(row.two_s3)}</td>
                              <td>{fmtInt(row.six_plus)}</td>
                              <td>{fmtInt(row.gidp)}</td>
                              <td>{fmtInt(row.ci)}</td>
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
                  </div>
                ));
              })()}


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
