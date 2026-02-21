import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default function SmsConsentPage() {
  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>SMS Consent (Opt-In)</h2>
              <p>How 570 Church Softball League collects and manages text-message consent.</p>
            </div>
          </div>

          <article className="card stack">
            <h3 style={{ margin: 0 }}>Verbal Opt-In Script</h3>
            <p style={{ margin: 0 }}>
              570 Church Softball League can text you schedule updates, weather cancellations, and
              event reminders. Message frequency varies. Message and data rates may apply. Reply
              STOP to unsubscribe or HELP for help. Do you agree to receive these text messages at
              this number?
            </p>
          </article>

          <article className="card stack" style={{ marginTop: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Consent Collection Process</h3>
            <p style={{ margin: 0 }}>
              Verbal consent is collected by a league official in person or by phone before a
              number is added to SMS notifications. Numbers are added only after a clear “Yes.”
            </p>
            <p style={{ margin: 0 }}>
              We record: full name, mobile number, date/time of consent, method (phone or in
              person), staff member who collected consent, consent status, and source notes.
            </p>
          </article>

          <article className="card stack" style={{ marginTop: "0.75rem" }}>
            <h3 style={{ margin: 0 }}>Confirmation, Help, and Opt-Out</h3>
            <p style={{ margin: 0 }}>
              Confirmation message: “You are now subscribed to 570 Church Softball text updates.
              Reply STOP to opt out, HELP for help. Message and data rates may apply.”
            </p>
            <p style={{ margin: 0 }}>
              STOP, END, CANCEL, UNSUBSCRIBE, and QUIT are honored immediately. START and UNSTOP
              request re-enrollment and are accepted only after renewed consent.
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
