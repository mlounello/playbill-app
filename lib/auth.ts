import { redirect } from "next/navigation";
import { tryAutoSyncAppUsers } from "@/lib/app-user-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_ID, APP_SCHEMA, getSupabaseWriteClient } from "@/lib/supabase";

export type PlatformRole = "owner" | "admin" | "editor" | "contributor";

type UserProfile = {
  user_id: string;
  email: string;
};

function normalizePlatformRole(value: unknown): PlatformRole | null {
  const role = String(value ?? "").toLowerCase();
  if (role === "owner" || role === "admin" || role === "editor" || role === "contributor") {
    return role;
  }
  return null;
}

function pickRoleFromRpcPayload(payload: unknown): PlatformRole | null {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const normalized = pickRoleFromRpcPayload(entry);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
  const direct = normalizePlatformRole(payload);
  if (direct) {
    return direct;
  }
  if (payload && typeof payload === "object") {
    const roleValue =
      (payload as { role?: unknown; user_role?: unknown; platform_role?: unknown }).role ??
      (payload as { role?: unknown; user_role?: unknown; platform_role?: unknown }).user_role ??
      (payload as { role?: unknown; user_role?: unknown; platform_role?: unknown }).platform_role;
    return normalizePlatformRole(roleValue);
  }
  return null;
}

async function resolveRoleViaRpc(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const bases = [supabase.schema(APP_SCHEMA), supabase, supabase.schema("public")];
  for (const base of bases) {
    const attempts: Array<() => ReturnType<typeof base.rpc>> = [
      () => base.rpc("get_user_role"),
      () => base.rpc("get_user_role", { p_app_id: APP_ID }),
      () => base.rpc("get_user_role", { app_id: APP_ID })
    ];
    for (const call of attempts) {
      const { data, error } = await call();
      if (error) {
        continue;
      }
      const role = pickRoleFromRpcPayload(data);
      if (isElevatedRole(role)) {
        return role;
      }
      continue;
    }
  }
  return null;
}

function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function isElevatedRole(role: PlatformRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "editor";
}

async function findStoredUserProfileByIdentity(userId: string, email: string): Promise<UserProfile | null> {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const normalizedEmail = normalizeEmail(email);

  const { data: existingByUserId } = await db
    .from("user_profiles")
    .select("user_id, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingByUserId) {
    return {
      user_id: String(existingByUserId.user_id),
      email: String(existingByUserId.email ?? "")
    };
  }

  if (!normalizedEmail) {
    return null;
  }

  const { data: existingByEmail } = await db
    .from("user_profiles")
    .select("user_id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();
  if (existingByEmail) {
    return {
      user_id: String(existingByEmail.user_id),
      email: String(existingByEmail.email ?? "")
    };
  }

  return null;
}

export async function getApprovedStaffProfile(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
}) {
  const role = await resolveRoleViaRpc(params.supabase);
  if (!role) {
    return null;
  }
  return {
    user_id: params.userId,
    email: params.email,
    platform_role: role
  };
}

export async function ensureUserProfileIdentity(
  userId: string,
  email: string,
  options?: { allowCreate?: boolean }
): Promise<UserProfile> {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const normalizedEmail = normalizeEmail(email);
  const allowCreate = options?.allowCreate !== false;

  const { data: existing } = await db
    .from("user_profiles")
    .select("user_id, email, platform_role")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const existingEmail = normalizeEmail(existing.email);
    const existingRole = normalizePlatformRole(existing.platform_role);
    if (existingEmail === normalizedEmail && existingRole) {
      return { user_id: String(existing.user_id), email: String(existing.email ?? normalizedEmail) };
    }
    const updatePayload: { email: string; platform_role?: PlatformRole } = { email: normalizedEmail };
    if (!existingRole) {
      updatePayload.platform_role = "contributor";
    }
    await db.from("user_profiles").update(updatePayload).eq("user_id", userId);
    await tryAutoSyncAppUsers("profile-email-updated");
    return { user_id: String(existing.user_id), email: normalizedEmail };
  }

  const { data: existingByEmail } = await db
    .from("user_profiles")
    .select("user_id, email, platform_role")
    .ilike("email", normalizedEmail)
    .maybeSingle();
  if (existingByEmail?.user_id) {
    const previousUserId = String(existingByEmail.user_id);
    const relinkPayload: { user_id: string; email: string; platform_role?: PlatformRole } = {
      user_id: userId,
      email: normalizedEmail
    };
    if (!normalizePlatformRole(existingByEmail.platform_role)) {
      relinkPayload.platform_role = "contributor";
    }
    await db.from("user_profiles").update(relinkPayload).eq("user_id", previousUserId);
    await tryAutoSyncAppUsers(previousUserId === userId ? "profile-email-updated" : "profile-relinked-by-email");
    return { user_id: userId, email: normalizedEmail };
  }

  if (!allowCreate) {
    return { user_id: userId, email: normalizedEmail };
  }

  const { data: inserted, error: insertError } = await db
    .from("user_profiles")
    .insert({ user_id: userId, email: normalizedEmail, platform_role: "contributor" })
    .select("user_id, email")
    .maybeSingle();

  if (insertError || !inserted) {
    return { user_id: userId, email: normalizedEmail };
  }

  await tryAutoSyncAppUsers("profile-created");
  return { user_id: String(inserted.user_id), email: String(inserted.email ?? normalizedEmail) };
}

export async function resolvePlatformRoleForUser(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
}) {
  const membershipRole = await resolveRoleViaRpc(params.supabase);
  if (membershipRole) {
    return membershipRole;
  }

  const storedProfile = await findStoredUserProfileByIdentity(params.userId, params.email);
  if (storedProfile) {
    return "contributor";
  }

  return null;
}

export async function getCurrentUserWithProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const role = await resolvePlatformRoleForUser({ supabase, userId: user.id, email: user.email });
  if (!role) {
    return null;
  }
  const profile: UserProfile & { platform_role: PlatformRole } = {
    user_id: user.id,
    email: user.email,
    platform_role: role
  };
  return { user, profile };
}

export async function requireRole(allowed: PlatformRole[]) {
  const current = await getCurrentUserWithProfile();
  if (!current) {
    redirect("/login");
  }

  if (!allowed.includes(current.profile.platform_role)) {
    redirect("/app/unauthorized");
  }

  return current;
}
