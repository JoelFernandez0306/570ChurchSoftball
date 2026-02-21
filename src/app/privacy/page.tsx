import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Privacy Policy</h2>
              <p>Effective date: February 21, 2026</p>
            </div>
          </div>

          <article className="card stack">
            <p style={{ margin: 0 }}>
              570 Church Softball League uses this website to manage league schedules, standings,
              rosters, rules, and text-message updates.
            </p>
            <p style={{ margin: 0 }}>
              We may collect personal information such as names, phone numbers, and email
              addresses for league operations and approved notifications.
            </p>
            <p style={{ margin: 0 }}>
              SMS consent and phone numbers are used only for league-related messaging and are not
              sold to third parties.
            </p>
            <p style={{ margin: 0 }}>
              Message frequency varies. Message and data rates may apply. You can opt out anytime
              by replying STOP and request help by replying HELP.
            </p>
            <p style={{ margin: 0 }}>
              We use service providers (such as hosting, messaging, and database providers) to
              operate league services.
            </p>
            <p style={{ margin: 0 }}>
              For privacy questions, contact league administrators Aaron at
              aaronstaner17@gmail.com, Sarah at sarahgtanner18@gmail.com, or Joel at
              joelcool65@gmail.com.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
