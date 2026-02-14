import Link from "next/link";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/teams", label: "Create Teams" },
  { href: "/admin/rosters", label: "Create Rosters" },
  { href: "/admin/schedule", label: "Schedule Builder" },
  { href: "/admin/quick-result", label: "Quick Game Score" },
  { href: "/admin/rules", label: "Create Rules" },
  { href: "/admin/standings", label: "Standings" },
  { href: "/admin/sms", label: "SMS" },
];

export function AdminNav() {
  return (
    <aside className="admin-sidebar">
      <h2>Admin</h2>
      <nav aria-label="Admin">
        <ul className="admin-nav-list">
          {adminLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action="/api/auth/signout" method="post">
        <button type="submit" className="ghost-button">
          Sign Out
        </button>
      </form>
    </aside>
  );
}
