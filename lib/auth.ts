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
      if (role) {
        return role;
      }
      return null;
    }
  }
  return null;
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
