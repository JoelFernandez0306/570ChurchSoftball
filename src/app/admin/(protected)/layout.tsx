import { SiteHeader } from "@/components/site-header";
import { AdminNav } from "@/components/admin-nav";
import { requireAdminPageAccess } from "@/lib/auth";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();

  return (
    <>
      <SiteHeader />
      <main className="main-shell content-width">
        <div className="admin-layout">
          <AdminNav />
          <section className="admin-main">{children}</section>
        </div>
      </main>
    </>
  );
}
