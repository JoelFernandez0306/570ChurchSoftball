import { SiteHeader } from "@/components/site-header";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>Terms & Conditions</h2>
              <p>Effective date: February 21, 2026</p>
            </div>
          </div>

          <article className="card stack">
            <p style={{ margin: 0 }}>
              By using 570 Church Softball League services, you agree to these terms.
            </p>
            <p style={{ margin: 0 }}>
              The site provides league information, schedules, standings, rosters, and
              administrative tools. Content is provided for league operations and may be updated at
              any time.
            </p>
            <p style={{ margin: 0 }}>
              SMS notifications are for schedule updates, weather cancellations, and league
              reminders. Message frequency varies. Message and data rates may apply.
            </p>
            <p style={{ margin: 0 }}>
              You may opt out of SMS at any time by replying STOP. For assistance, reply HELP.
            </p>
            <p style={{ margin: 0 }}>
              Unauthorized use of league systems is prohibited. League administration may suspend
              access when needed for security or compliance.
            </p>
            <p style={{ margin: 0 }}>
              Please also review our <Link href="/privacy">Privacy Policy</Link> and{" "}
              <Link href="/sms-consent">SMS Consent</Link> details.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
