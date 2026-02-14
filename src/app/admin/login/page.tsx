import { AdminLoginClient } from "@/app/admin/login/login-client";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <AdminLoginClient errorParam={params.error ?? null} />;
}
