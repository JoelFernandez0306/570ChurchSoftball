import {
  addAllowedSmsNumberAction,
  removeAllowedSmsNumberAction,
  updateAllowedSmsNumberAction,
} from "@/app/admin/(protected)/actions";
import { loadAllowedSmsNumbers } from "@/lib/league-data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminSmsPage() {
  const numbers = await loadAllowedSmsNumbers();
  const twilioNumber = env.twilioPhoneNumber || "Not configured";

  return (
    <>
      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h2>SMS Reporting</h2>
            <p>Only approved phone numbers can report winners, losers, and ties via Twilio webhook.</p>
          </div>
        </div>

        <article className="card">
          <h4 style={{ marginTop: 0 }}>League Twilio Number</h4>
          <p>{twilioNumber}</p>
        </article>

        <form action={addAllowedSmsNumberAction} className="form-grid">
          <label>
            Phone number (E.164)
            <input name="phone_number" placeholder="+15705551234" required />
          </label>
          <label>
            Label
            <input name="label" placeholder="Commissioner" />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit">Allow Number</button>
          </div>
        </form>

        <p className="footer-note">
          US numbers can be entered as 5705551234 or +15705551234. The system stores them as
          +1...
        </p>
      </section>

      <section className="page-surface stack">
        <div className="page-header">
          <div>
            <h3>Allowed Reporters</h3>
            <p>These numbers can send game outcomes.</p>
          </div>
        </div>

        {numbers.length === 0 ? (
          <p className="empty-state">No numbers added yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {numbers.map((record) => (
              <li className="card" key={record.id}>
                <div className="page-header">
                  <div>
                    <h4 style={{ margin: 0 }}>{record.phone_number}</h4>
                    <p>{record.label || "No label"}</p>
                  </div>
                  <div style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                    <button type="submit" form={`edit-sms-${record.id}`} className="ghost-button">
                      Edit
                    </button>
                    <form action={removeAllowedSmsNumberAction}>
                      <input type="hidden" name="id" value={record.id} />
                      <button type="submit" className="danger-button">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                <form id={`edit-sms-${record.id}`} action={updateAllowedSmsNumberAction} className="form-grid">
                  <input type="hidden" name="id" value={record.id} />
                  <label>
                    Edit phone
                    <input name="phone_number" defaultValue={record.phone_number} required />
                  </label>
                  <label>
                    Edit label
                    <input name="label" defaultValue={record.label ?? ""} />
                  </label>
                </form>
              </li>
            ))}
          </ul>
        )}

        <article className="card">
          <h4 style={{ marginTop: 0 }}>Accepted SMS format</h4>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-body)",
              lineHeight: 1.45,
            }}
          >
{`MM/DD G1 Saint Johns W Calvary Bible L
MM/DD/YYYY G2 St John W Cal Bible L
MM/DD Game 1 Saint Johns W Calvary Bible L
MM/DD/YYYY Game 2 St John W Cal Bible L
MM/DD game1 Saint Johns W Calvary Bible L
MM/DD 1stgame Saint Johns W Calvary Bible L
MM/DD 2ndgame Saint Johns W Calvary Bible L
MM/DD g 1 Saint Johns W Calvary Bible L
MM/DD G 2 Saint Johns W Calvary Bible L
MM/DD 1st game Saint Johns won against Calvary Bible
MM/DD 2nd game Saint Johns lost to Calvary Bible
MM/DD G1 Saint Johns T Calvary Bible T
MM/DD/YYYY G2 St John vs Cal Bible Tie game

Notes:
- Date can be MM/DD or MM/DD/YYYY. If omitted, today in America/New_York is used.
- Year is optional. If omitted, current year in America/New_York is assumed.
- Game slot can be G1/G2, G 1/G 2, g 1/g 2, Game 1/Game 2, game1/game2, 1stgame/2ndgame, 1st Game/2nd Game, 1st/2nd, or first/second.
- Result words accepted include W/L, won/lost, beat/defeated, and tie formats above.
- If aliases are unclear, the system replies asking for exact team names.
- Schedule must already contain the matching game slot in the active season.`}
          </pre>
        </article>
      </section>
    </>
  );
}
