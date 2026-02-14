import { redirect } from "next/navigation";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

export async function getAuthenticatedUser() {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .schema("league")
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify admin status: ${error.message}`);
  }

  return Boolean(data);
}

export async function requireAdminPageAccess() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/admin/login");
  }

  const isAdmin = await isAdminUser(user.id);

  if (!isAdmin) {
    redirect("/admin/login?error=not-admin");
  }

  return user;
}

export async function requireAdminApiAccess() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { ok: false as const, status: 401, message: "Not authenticated" };
  }

  const isAdmin = await isAdminUser(user.id);

  if (!isAdmin) {
    return { ok: false as const, status: 403, message: "Not an admin" };
  }

  return { ok: true as const, user };
}

export async function adminsExist() {
  const supabase = getServiceSupabaseClient();
  const { count, error } = await supabase
    .schema("league")
    .from("admins")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to check admins: ${error.message}`);
  }

  return (count ?? 0) > 0;
}
