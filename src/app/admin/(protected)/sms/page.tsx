import {
  addAllowedSmsNumberAction,
  removeAllowedSmsNumberAction,
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
                  <form action={removeAllowedSmsNumberAction}>
                    <input type="hidden" name="id" value={record.id} />
                    <button type="submit" className="danger-button">
                      Remove
                    </button>
                  </form>
                </div>
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
MM/DD G1 Saint Johns T Calvary Bible T
MM/DD/YYYY G2 St John vs Cal Bible Tie game

Notes:
- Year is optional. If omitted, current year in America/New_York is assumed.
- If aliases are unclear, the system replies asking for exact team names.
- Schedule must already contain the matching game slot.`}
          </pre>
        </article>
      </section>
    </>
  );
}
