import { SiteHeader } from "@/components/site-header";
import { loadRulesContent } from "@/lib/league-data";

export const dynamic = "force-dynamic";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderLineWithLinks(line: string, lineIndex: number) {
  const matches = Array.from(line.matchAll(URL_REGEX));
  if (matches.length === 0) {
    return <span key={`line-${lineIndex}`}>{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, matchIndex) => {
    const url = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      parts.push(
        <span key={`text-${lineIndex}-${matchIndex}`}>{line.slice(cursor, start)}</span>,
      );
    }

    parts.push(
      <a
        key={`url-${lineIndex}-${matchIndex}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#0b4f82", textDecoration: "underline" }}
      >
        {url}
      </a>,
    );

    cursor = start + url.length;
  });

  if (cursor < line.length) {
    parts.push(<span key={`tail-${lineIndex}`}>{line.slice(cursor)}</span>);
  }

  return <span key={`line-${lineIndex}`}>{parts}</span>;
}

export default async function RulesPage() {
  const rules = await loadRulesContent();
  const lines = rules.split("\n");

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <section className="page-surface">
          <div className="page-header">
            <div>
              <h2>League Rules</h2>
              <p>Official rules and admin updates.</p>
            </div>
          </div>
          <article className="card">
            <div
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
                fontFamily: "var(--font-body)",
              }}
            >
              {lines.map((line, lineIndex) => (
                <span key={`row-${lineIndex}`}>
                  {renderLineWithLinks(line, lineIndex)}
                  {lineIndex < lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
