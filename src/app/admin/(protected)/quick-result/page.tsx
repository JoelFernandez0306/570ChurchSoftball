import { QuickResultForm } from "@/components/quick-result-form";
import { loadActiveSeasonName, loadTeams } from "@/lib/league-data";

export const dynamic = "force-dynamic";

export default async function AdminQuickResultPage() {
  const [teams, activeSeasonName] = await Promise.all([loadTeams(), loadActiveSeasonName()]);

  return (
    <section className="page-surface stack">
      <div className="page-header">
        <div>
          <h2>Quick Game Score Entry</h2>
          <p>
            Fast manual fallback when SMS was missed. Supports backdated updates and tie games for{" "}
            {activeSeasonName}.
          </p>
        </div>
      </div>

      <QuickResultForm teams={teams.map((team) => ({ id: team.id, name: team.name }))} />

      <p className="footer-note">
        This updates the matching scheduled game in {activeSeasonName} only. If no game exists,
        create it first on the Schedule page.
      </p>
    </section>
  );
}
