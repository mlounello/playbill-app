import "server-only";

import { APP_SCHEMA, getSupabaseWriteClient, getSupabaseWriteClientRaw } from "@/lib/supabase";

const CONTROL_ROOM_SYNC_URL = process.env.CONTROL_ROOM_APP_USERS_SYNC_URL || "https://mlounello.com/api/admin/sync/app-users";
const CONTROL_ROOM_SYNC_SECRET = process.env.APP_SYNC_SECRET || "";
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID || "";
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET || "";
const APP_SLUG = "playbill-app";

type PlatformRole = "owner" | "admin" | "editor" | "contributor";

type AppUserProfileRow = {
  user_id: string;
  email: string;
  platform_role: PlatformRole | string;
  created_at?: string;
};

type AuthUserSummary = {
  id: string;
  email?: string;
  banned_until?: string | null;
  deleted_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ControlRoomUserPayload = {
  fullName: string;
  email: string;
  globalRole: string;
  accountStatus: string;
  appRole: string;
  permissionLevel: string;
  membershipStatus: string;
  notes: string;
};

export type AppUserSyncResult = {
  ok: boolean;
  syncedCount: number;
  skippedCount: number;
  users: ControlRoomUserPayload[];
  status?: number;
  error?: string;
  responseBody?: string;
};

function normalizePlatformRole(value: unknown): PlatformRole {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "owner" || normalized === "admin" || normalized === "editor") {
    return normalized;
  }
  return "contributor";
}

function pickFullName(authUser: AuthUserSummary | null | undefined, email: string) {
  const metadata = authUser?.user_metadata ?? {};
  const candidate =
    String(metadata.full_name ?? "").trim() ||
    String(metadata.name ?? "").trim() ||
    String(metadata.display_name ?? "").trim();
  if (candidate) {
    return candidate;
  }
  const localPart = email.split("@")[0]?.trim() ?? "";
  return localPart || email;
}

function mapGlobalRole(platformRole: PlatformRole) {
  if (platformRole === "owner" || platformRole === "admin") {
    return "admin";
  }
  return "member";
}

function mapPermissionLevel(platformRole: PlatformRole) {
  if (platformRole === "owner" || platformRole === "admin" || platformRole === "editor") {
    return "managed";
  }
  return "standard";
}

function mapAccountStatus(authUser: AuthUserSummary | null | undefined) {
  if (!authUser) {
    return "banned";
  }
  if (authUser.deleted_at) {
    return "banned";
  }
  if (authUser.banned_until) {
    const bannedUntil = new Date(authUser.banned_until).getTime();
    if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) {
      return "banned";
    }
  }
  return "active";
}

function mapMembershipStatus(accountStatus: string) {
  return accountStatus === "active" ? "active" : "suspended";
}

function buildNotes(platformRole: PlatformRole) {
  return `Imported from Playbill App (${platformRole})`;
}

function isCloudflareHtmlFailure(contentType: string, body: string) {
  return contentType.includes("text/html") && /cloudflare access/i.test(body);
}

function hasJsonErrorShape(contentType: string, body: string) {
  if (!contentType.includes("application/json")) {
    return false;
  }
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed.error === "string" && parsed.error.trim().length > 0;
  } catch {
    return false;
  }
}

async function listAllAuthUsers() {
  const supabase = getSupabaseWriteClientRaw();
  const users: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Could not load auth users: ${error.message}`);
    }

    const batch = (data?.users ?? []) as AuthUserSummary[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }
    page += 1;
    if (page > 100) {
      break;
    }
  }

  return users;
}

export async function buildAppUserSyncPayload(): Promise<ControlRoomUserPayload[]> {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);

  const [{ data: profileRows, error: profileError }, authUsers] = await Promise.all([
    db.from("user_profiles").select("user_id, email, platform_role, created_at").order("created_at", { ascending: true }),
    listAllAuthUsers()
  ]);

  if (profileError) {
    throw new Error(`Could not load app users: ${profileError.message}`);
  }

  const authUsersById = new Map(authUsers.map((user) => [String(user.id), user]));

  const mapped: Array<ControlRoomUserPayload | null> = (profileRows ?? [])
    .map((row): ControlRoomUserPayload | null => {
      const profile = row as AppUserProfileRow;
      const email = String(profile.email ?? "").trim().toLowerCase();
      if (!email) {
        return null;
      }
      const platformRole = normalizePlatformRole(profile.platform_role);
      const authUser = authUsersById.get(String(profile.user_id));
      const accountStatus = mapAccountStatus(authUser);
      return {
        fullName: pickFullName(authUser, email),
        email,
        globalRole: mapGlobalRole(platformRole),
        accountStatus,
        appRole: platformRole,
        permissionLevel: mapPermissionLevel(platformRole),
        membershipStatus: mapMembershipStatus(accountStatus),
        notes: buildNotes(platformRole)
      };
    })
    ;

  const payload = mapped.filter((user): user is ControlRoomUserPayload => user !== null);
  return payload;
}

async function postAppUsersToControlRoom(users: ControlRoomUserPayload[]): Promise<AppUserSyncResult> {
  if (!CONTROL_ROOM_SYNC_SECRET) {
    return {
      ok: false,
      syncedCount: 0,
      skippedCount: users.length,
      users,
      error: "Missing APP_SYNC_SECRET"
    };
  }

  if (!CF_ACCESS_CLIENT_ID || !CF_ACCESS_CLIENT_SECRET) {
    return {
      ok: false,
      syncedCount: 0,
      skippedCount: users.length,
      users,
      error: "Missing Cloudflare Access service token environment variables"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(CONTROL_ROOM_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Access-Client-Id": CF_ACCESS_CLIENT_ID,
        "CF-Access-Client-Secret": CF_ACCESS_CLIENT_SECRET,
        "X-App-Sync-Secret": CONTROL_ROOM_SYNC_SECRET
      },
      body: JSON.stringify({
        appSlug: APP_SLUG,
        fullSync: true,
        users
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    const responseText = await response.text();
    const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();

    if (isCloudflareHtmlFailure(contentType, responseText)) {
      console.error("[app-user-sync] Control room sync blocked by Cloudflare Access", {
        status: response.status,
        body: responseText.slice(0, 500),
        syncedAttemptCount: users.length
      });
      return {
        ok: false,
        syncedCount: 0,
        skippedCount: users.length,
        users,
        status: response.status,
        error: "Control room sync blocked by Cloudflare Access",
        responseBody: responseText.slice(0, 500)
      };
    }

    if (!response.ok) {
      console.error("[app-user-sync] Control room sync failed", {
        status: response.status,
        body: responseText.slice(0, 500),
        syncedAttemptCount: users.length
      });
      return {
        ok: false,
        syncedCount: 0,
        skippedCount: users.length,
        users,
        status: response.status,
        error: `Control room sync failed (${response.status})`,
        responseBody: responseText.slice(0, 500)
      };
    }

    if (hasJsonErrorShape(contentType, responseText)) {
      console.error("[app-user-sync] Control room sync returned JSON error", {
        status: response.status,
        body: responseText.slice(0, 500),
        syncedAttemptCount: users.length
      });
      return {
        ok: false,
        syncedCount: 0,
        skippedCount: users.length,
        users,
        status: response.status,
        error: "Control room sync rejected by control room route",
        responseBody: responseText.slice(0, 500)
      };
    }

    console.info("[app-user-sync] Control room sync complete", {
      syncedCount: users.length,
      responsePreview: responseText.slice(0, 200)
    });

    return {
      ok: true,
      syncedCount: users.length,
      skippedCount: 0,
      users,
      status: response.status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    console.error("[app-user-sync] Control room sync request error", {
      error: message,
      syncedAttemptCount: users.length
    });
    return {
      ok: false,
      syncedCount: 0,
      skippedCount: users.length,
      users,
      error: message
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncAppUsersToControlRoom(): Promise<AppUserSyncResult> {
  const users = await buildAppUserSyncPayload();
  return postAppUsersToControlRoom(users);
}

async function withAutoSyncTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function tryAutoSyncAppUsers(reason: string) {
  try {
    const result = await withAutoSyncTimeout(syncAppUsersToControlRoom(), 2500);
    if (result === null) {
      console.warn("[app-user-sync] Auto sync timed out", { reason });
      return;
    }
    if (!result.ok) {
      console.warn("[app-user-sync] Auto sync failed", {
        reason,
        error: result.error,
        syncedCount: result.syncedCount,
        skippedCount: result.skippedCount
      });
    }
  } catch (error) {
    console.warn("[app-user-sync] Auto sync threw", {
      reason,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
