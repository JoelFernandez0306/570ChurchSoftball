import { QuickResultForm } from "@/components/quick-result-form";
import { loadTeams } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminQuickResultPage() {
  const teams = await loadTeams();

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Quick Game Score Entry</h2>
          <p>
            Fast manual fallback when SMS was missed. Supports backdated updates and tie games.
          </p>
        </div>
      </div>

      <QuickResultForm teams={teams.map((team) => ({ id: team.id, name: team.name }))} />

      <p className="footer-note">
        This updates the matching scheduled game only. If no game exists, create it first on the
        Schedule page.
      </p>
    </section>
  );
}
