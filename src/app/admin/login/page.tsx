import { redirect } from "next/navigation";
import { AdminLoginClient } from "@/app/admin/login/login-client";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (user) {
    try {
      const admin = await isAdminUser(user.id);
      if (admin) {
        redirect("/admin/dashboard");
      }
    } catch {
      // Keep login page available if admin lookup fails.
    }
  }

  const params = await searchParams;

  return <AdminLoginClient errorParam={params.error ?? null} />;
}
