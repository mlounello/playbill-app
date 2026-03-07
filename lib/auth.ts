import { redirect } from "next/navigation";
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

async function resolveRoleViaRpc(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const db = supabase;
  const attempts: Array<() => ReturnType<typeof db.rpc>> = [
    () => db.rpc("get_user_role"),
    () => db.rpc("get_user_role", { p_app_id: APP_ID }),
    () => db.rpc("get_user_role", { app_id: APP_ID })
  ];

  let data: unknown = null;
  let resolved = false;
  for (const call of attempts) {
    const { data: result, error } = await call();
    if (error) {
      continue;
    }
    data = result;
    resolved = true;
    break;
  }
  if (!resolved) {
    return null;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      const normalized = normalizePlatformRole(entry);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  return normalizePlatformRole(data);
}

export async function ensureUserProfileIdentity(userId: string, email: string): Promise<UserProfile> {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);

  const { data: existing } = await db.from("user_profiles").select("user_id, email").eq("user_id", userId).maybeSingle();
  if (existing) {
    const existingEmail = String(existing.email ?? "");
    if (existingEmail && existingEmail.toLowerCase() === email.toLowerCase()) {
      return { user_id: String(existing.user_id), email: existingEmail };
    }
    await db.from("user_profiles").update({ email }).eq("user_id", userId);
    return { user_id: String(existing.user_id), email };
  }

  const { data: inserted, error: insertError } = await db
    .from("user_profiles")
    .insert({ user_id: userId, email })
    .select("user_id, email")
    .maybeSingle();

  if (insertError || !inserted) {
    return { user_id: userId, email };
  }

  return { user_id: String(inserted.user_id), email: String(inserted.email ?? email) };
}

async function resolveRoleFromLegacyProfile(userId: string): Promise<PlatformRole | null> {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data } = await db.from("user_profiles").select("platform_role").eq("user_id", userId).maybeSingle();
  return normalizePlatformRole((data as { platform_role?: unknown } | null)?.platform_role ?? null);
}

async function ensureProfile(userId: string, email: string): Promise<UserProfile> {
  return ensureUserProfileIdentity(userId, email);
}

export async function resolvePlatformRoleForUser(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
}) {
  const rpcRole = await resolveRoleViaRpc(params.supabase);
  if (rpcRole) {
    await ensureProfile(params.userId, params.email);
    return rpcRole;
  }
  await ensureProfile(params.userId, params.email);
  const legacyRole = await resolveRoleFromLegacyProfile(params.userId);
  return legacyRole ?? "contributor";
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
  const profile: UserProfile = {
    user_id: user.id,
    email: user.email
  };
  return { user, profile: { ...profile, platform_role: role } };
}

export async function requireRole(allowed: PlatformRole[]) {
  const current = await getCurrentUserWithProfile();
  if (!current) {
    redirect("/app/login");
  }

  if (!allowed.includes(current.profile.platform_role)) {
    redirect("/app/unauthorized");
  }

  return current;
}
