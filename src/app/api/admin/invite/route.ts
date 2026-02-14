import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth";
import { getServiceSupabaseClient } from "@/lib/supabase/service";

function buildInviteRedirectUrl(baseUrl: string, invitedEmail: string): string {
  const normalizedEmail = invitedEmail.trim().toLowerCase();

  try {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set("invite", "1");
    parsed.searchParams.set("invited_email", normalizedEmail);
    return parsed.toString();
  } catch {
    const [withoutHash, hashPart] = baseUrl.split("#", 2);
    const [pathPart, queryPart] = withoutHash.split("?", 2);
    const searchParams = new URLSearchParams(queryPart ?? "");
    searchParams.set("invite", "1");
    searchParams.set("invited_email", normalizedEmail);

    const query = searchParams.toString();
    const hash = hashPart ? `#${hashPart}` : "";
    return `${pathPart}${query ? `?${query}` : ""}${hash}`;
  }
}

function redirectToDashboard(requestUrl: string, search: string) {
  return NextResponse.redirect(new URL(`/admin/dashboard${search}`, requestUrl), 303);
}

export async function POST(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) {
    return NextResponse.redirect(new URL("/admin/login?error=not-admin", request.url), 303);
  }

  const supabase = getServiceSupabaseClient();
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email) {
    return redirectToDashboard(request.url, "?invite_error=Email%20is%20required.");
  }

  let page = 1;
  let matchedUser:
    | { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
    | null = null;

  while (!matchedUser && page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      return redirectToDashboard(
        request.url,
        `?invite_error=${encodeURIComponent(`Failed to search auth users: ${error.message}`)}`,
      );
    }

    const users = data.users ?? [];
    matchedUser = users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  if (!matchedUser) {
    const directRedirect = process.env.ADMIN_INVITE_REDIRECT_URL?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const defaultInviteRedirect = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/admin/create/login`
      : undefined;
    const baseRedirectTo = directRedirect || defaultInviteRedirect;
    const redirectTo = baseRedirectTo ? buildInviteRedirectUrl(baseRedirectTo, email) : undefined;

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        ...(redirectTo ? { redirectTo } : {}),
        ...(fullName ? { data: { full_name: fullName } } : {}),
      },
    );

    if (inviteError) {
      return redirectToDashboard(
        request.url,
        `?invite_error=${encodeURIComponent(`Failed to invite admin: ${inviteError.message}`)}`,
      );
    }

    if (!inviteData.user) {
      return redirectToDashboard(
        request.url,
        `?invite_error=${encodeURIComponent(
          "Admin invite was sent but no user record was returned. Please try again.",
        )}`,
      );
    }

    matchedUser = {
      id: inviteData.user.id,
      email: inviteData.user.email,
      user_metadata: inviteData.user.user_metadata,
    };
  }

  const displayName =
    fullName ||
    (typeof matchedUser.user_metadata?.full_name === "string"
      ? String(matchedUser.user_metadata.full_name)
      : matchedUser.email) ||
    "League Admin";

  const { error } = await supabase.schema("league").from("admins").upsert(
    {
      user_id: matchedUser.id,
      full_name: displayName,
      active: true,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return redirectToDashboard(
      request.url,
      `?invite_error=${encodeURIComponent(`Failed to add admin: ${error.message}`)}`,
    );
  }

  revalidatePath("/admin/dashboard");
  return redirectToDashboard(request.url, "?invite_success=1");
}
