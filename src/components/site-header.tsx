import Link from "next/link";
import Image from "next/image";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/standings", label: "Standings" },
  { href: "/stats", label: "Stats" },
  { href: "/teams", label: "Teams & Rosters" },
  { href: "/rules", label: "Rules" },
];

export async function SiteHeader() {
  const user = await getAuthenticatedUser();
  let adminHref = "/admin/login";
  let adminLabel = "Admin Login";

  if (user) {
    try {
      const admin = await isAdminUser(user.id);
      if (admin) {
        adminHref = "/admin/dashboard";
        adminLabel = "Admin Dashboard";
      }
    } catch {
      adminHref = "/admin/login";
      adminLabel = "Admin Login";
    }
  }

  return (
    <header className="site-header">
      <div className="content-width site-header-inner">
        <div className="site-title-wrap">
          <Image
            src="/all-glory-to-god.png"
            alt="570 Church Softball League logo"
            width={98}
            height={98}
            className="league-logo-floating"
            priority
          />
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
              <Link href={adminHref} className="pill-link">
                {adminLabel}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
