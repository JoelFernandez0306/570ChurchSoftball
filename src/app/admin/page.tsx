import { redirect } from "next/navigation";
import { getAuthenticatedUser, isAdminUser } from "@/lib/auth";

export default async function AdminIndexPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/admin/login");
  }

  const admin = await isAdminUser(user.id);
  if (admin) {
    redirect("/admin/dashboard");
  }

  redirect("/admin/login?error=not-admin");
}
