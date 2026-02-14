import Link from "next/link";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams & Rosters" },
  { href: "/rules", label: "Rules" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="content-width site-header-inner">
        <div>
          <h1 className="league-title">570 Church Softball League</h1>
          <p className="league-kicker">Faith. Fellowship. Competition.</p>
        </div>

        <nav aria-label="Primary">
          <ul className="header-nav-list">
            {publicLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/admin/login" className="pill-link">
                Admin
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
