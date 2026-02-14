import { saveRulesAction } from "@/app/admin/(protected)/actions";
import { loadActiveRuleRecord } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const ruleRecord = await loadActiveRuleRecord();

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Rules Editor</h2>
          <p>Update the official rules displayed on the public site.</p>
        </div>
      </div>

      <form action={saveRulesAction} className="stack">
        <input type="hidden" name="rule_id" value={ruleRecord?.id ?? ""} />

        <label>
          Title
          <input
            name="title"
            defaultValue={ruleRecord?.title ?? "League Rules"}
            placeholder="League Rules"
          />
        </label>

        <label>
          Rules content
          <textarea
            name="content"
            defaultValue={ruleRecord?.content ?? ""}
            placeholder="Enter complete rules text"
            required
          />
        </label>

        <div>
          <button type="submit">Save Rules</button>
        </div>
      </form>

      <p className="footer-note">
        Tip: keep numbered sections so updates are easy for players and coaches to follow.
      </p>
    </section>
  );
}
