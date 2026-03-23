import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { APP_SCHEMA, getSupabaseWriteClient, getSupabaseWriteClientRaw } from "@/lib/supabase";

type ReminderRecipient = {
  showId: string;
  personId: string;
  email: string;
  name: string;
  roleTitle: string;
  requestId: string;
  requestType: string;
  dueDate: string | null;
  status: string;
};

export type ReminderDispatchScope = "all_open" | "open_bios" | "open_notes";

type ReminderRecipientGroup = {
  showId: string;
  personId: string;
  email: string;
  name: string;
  roleTitle: string;
  items: ReminderRecipient[];
};

type ReminderDispatchProgress = {
  processed: number;
  sent: number;
  total: number;
  recipientName?: string;
  reason?: string;
};

type AdminSubmissionNotificationArgs = {
  showId: string;
  showTitle: string;
  personName: string;
  roleTitle: string;
  submissionType: "bio" | "director_note" | "dramaturgical_note" | "music_director_note";
  taskId: string;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${qp.toString()}`);
}

function withSuccess(path: string, message: string): never {
  const qp = new URLSearchParams({ success: message });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${qp.toString()}`);
}

function getReminderScopeLabel(scope: ReminderDispatchScope) {
  if (scope === "open_bios") return "all open bios";
  if (scope === "open_notes") return "all open notes";
  return "all open tasks";
}

function parseEmailList(value: string) {
  return value
    .split(/[\n,;]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(params: { to: string; subject: string; text: string; html: string }) {
  const disableOutboundEmail = /^(1|true|yes|on)$/i.test(String(process.env.DISABLE_OUTBOUND_EMAIL ?? "").trim());
  if (disableOutboundEmail) {
    return { sent: false, reason: "email_disabled_test_mode" as const };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, reason: "email_provider_not_configured" as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      return { sent: false, reason: "provider_timeout" as const };
    }
    return { sent: false, reason: "provider_request_failed" as const };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    return { sent: false, reason: `provider_error_${response.status}` as const };
  }

  return { sent: true, reason: "sent" as const };
}

async function sendEmailWithThrottle(params: { to: string; subject: string; text: string; html: string }) {
  const attempts = 3;
  let result: { sent: boolean; reason: string } = { sent: false, reason: "provider_request_failed" };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(1200 * attempt);
    }

    result = await sendEmail(params);
    if (result.sent) {
      return result;
    }

    const retryable =
      result.reason === "provider_timeout" ||
      result.reason === "provider_request_failed" ||
      String(result.reason).startsWith("provider_error_429");
    if (!retryable) {
      return result;
    }
  }

  return result;
}

export function getReminderDeliveryMode() {
  const disabledByEnv = /^(1|true|yes|on)$/i.test(String(process.env.DISABLE_OUTBOUND_EMAIL ?? "").trim());
  if (disabledByEnv) {
    return {
      mode: "test" as const,
      label: "Email Test Mode (delivery disabled)",
      isDelivering: false
    };
  }

  const hasProvider = Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);
  if (!hasProvider) {
    return {
      mode: "unconfigured" as const,
      label: "Email provider not configured",
      isDelivering: false
    };
  }

  return {
    mode: "live" as const,
    label: "Email delivery active",
    isDelivering: true
  };
}

async function getAdminSubmissionNotificationRecipients(showId: string) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: show } = await db
    .from("shows")
    .select("admin_submission_notifications_enabled, admin_submission_notification_emails")
    .eq("id", showId)
    .maybeSingle();

  const enabled =
    show?.admin_submission_notifications_enabled === undefined
      ? false
      : Boolean(show.admin_submission_notifications_enabled);
  if (!enabled) {
    return { enabled: false, emails: [] as string[] };
  }

  const configured = parseEmailList(String(show?.admin_submission_notification_emails ?? ""));
  if (configured.length > 0) {
    return { enabled: true, emails: configured };
  }

  const { data: admins } = await db
    .from("user_profiles")
    .select("email, platform_role")
    .in("platform_role", ["owner", "admin", "editor"]);
  const fallbackEmails = (admins ?? [])
    .map((row) => String(row.email ?? "").trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, index, array) => array.indexOf(entry) === index);

  return { enabled: true, emails: fallbackEmails };
}

export async function sendAdminSubmissionNotification(args: AdminSubmissionNotificationArgs) {
  const deliveryMode = getReminderDeliveryMode();
  if (deliveryMode.mode === "unconfigured") {
    return { sent: false as const, reason: "email_provider_not_configured" as const };
  }

  const recipients = await getAdminSubmissionNotificationRecipients(args.showId);
  if (!recipients.enabled) {
    return { sent: false as const, reason: "notifications_disabled" as const };
  }
  if (recipients.emails.length === 0) {
    return { sent: false as const, reason: "no_admin_recipients" as const };
  }

  const submissionLabel = (() => {
    if (args.submissionType === "director_note") return "Director's Note";
    if (args.submissionType === "dramaturgical_note") return "Dramaturgical Note";
    if (args.submissionType === "music_director_note") return "Music Director's Note";
    return "Bio";
  })();

  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const reviewPath = `/app/shows/${args.showId}/submissions/${args.taskId}`;
  const reviewUrl = baseUrl ? `${baseUrl}${reviewPath}` : reviewPath;
  const subject = `${args.showTitle}: ${args.personName} submitted ${submissionLabel}`;
  const roleLine = args.roleTitle ? `Role: ${args.roleTitle}\n` : "";
  const text =
    `${args.personName} submitted ${submissionLabel} for ${args.showTitle}.\n\n` +
    `${roleLine}` +
    `Status: Submitted for review\n\n` +
    `Open review: ${reviewUrl}\n`;
  const html =
    `<p><strong>${escapeHtml(args.personName)}</strong> submitted <strong>${escapeHtml(submissionLabel)}</strong> for <strong>${escapeHtml(
      args.showTitle
    )}</strong>.</p>` +
    (args.roleTitle ? `<p><strong>Role:</strong> ${escapeHtml(args.roleTitle)}</p>` : "") +
    `<p><strong>Status:</strong> Submitted for review</p>` +
    `<p><a href="${reviewUrl}">Open review</a></p>`;

  let sent = 0;
  for (const email of recipients.emails) {
    const result = await sendEmailWithThrottle({ to: email, subject, text, html });
    if (result.sent) {
      sent += 1;
    }
  }

  return {
    sent: sent > 0,
    sentCount: sent,
    recipientCount: recipients.emails.length,
    reason: sent > 0 ? ("sent" as const) : ("provider_request_failed" as const)
  };
}

async function getShowContext(showId: string) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: show } = await db
    .from("shows")
    .select(
      "id, title, slug, reminders_paused, reminder_automation_enabled, reminder_cadence_days, reminder_due_soon_days, reminder_send_last_day"
    )
    .eq("id", showId)
    .maybeSingle();
  if (!show) {
    return null;
  }
  const { data: program } = await db.from("programs").select("slug").eq("slug", show.slug).maybeSingle();
  return {
    id: String(show.id),
    title: String(show.title ?? "Show"),
    slug: String(show.slug ?? ""),
    programSlug: String(program?.slug ?? show.slug ?? ""),
    remindersPaused: Boolean(show.reminders_paused),
    reminderAutomationEnabled:
      show.reminder_automation_enabled === undefined ? true : Boolean(show.reminder_automation_enabled),
    reminderCadenceDays: Number(show.reminder_cadence_days ?? 7) || 7,
    reminderDueSoonDays: Number(show.reminder_due_soon_days ?? 7) || 7,
    reminderSendLastDay:
      show.reminder_send_last_day === undefined ? true : Boolean(show.reminder_send_last_day)
  };
}

async function getReminderRecipients(showId: string) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: roles } = await db.from("show_roles").select("id, person_id").eq("show_id", showId);
  const roleIds = (roles ?? []).map((row) => String(row.id));
  if (roleIds.length === 0) {
    return [] as ReminderRecipient[];
  }

  const { data: requests } = await db
    .from("submission_requests")
    .select("id, show_role_id, due_date, status, request_type")
    .in("show_role_id", roleIds);
  const requestRows = (requests ?? []).filter((row) =>
    ["bio", "director_note", "dramaturgical_note", "music_director_note"].includes(String(row.request_type ?? "bio"))
  );
  if (requestRows.length === 0) {
    return [] as ReminderRecipient[];
  }

  const personIds = [...new Set((roles ?? []).map((row) => String(row.person_id)).filter(Boolean))];
  const { data: people } = await db
    .from("people")
    .select("id, full_name, role_title, email")
    .in("id", personIds);
  const personById = new Map(
    (people ?? []).map((person) => [
      String(person.id),
      {
        name: String(person.full_name ?? ""),
        roleTitle: String(person.role_title ?? ""),
        email: String(person.email ?? "")
      }
    ])
  );
  const personIdByRoleId = new Map((roles ?? []).map((row) => [String(row.id), String(row.person_id)]));

  return requestRows
    .map((request) => {
      const personId = personIdByRoleId.get(String(request.show_role_id));
      if (!personId) return null;
      const person = personById.get(personId);
      if (!person || !person.email) return null;
      return {
        showId,
        personId,
        email: person.email,
        name: person.name,
        roleTitle: person.roleTitle,
        requestId: String(request.id),
        requestType: String(request.request_type ?? "bio"),
        dueDate: request.due_date ? String(request.due_date) : null,
        status: String(request.status ?? "pending")
      } satisfies ReminderRecipient;
    })
    .filter((row): row is ReminderRecipient => row !== null);
}

async function getReminderRecipientByRequestId(showId: string, requestId: string) {
  const recipients = await getReminderRecipients(showId);
  return recipients.find((item) => item.requestId === requestId) ?? null;
}

function shouldRemind(status: string) {
  return !["submitted", "approved", "locked"].includes(status);
}

function formatDate(value: string | null) {
  if (!value) return "TBD";
  return new Date(value).toLocaleDateString("en-US");
}

function getRequestLabel(value: string) {
  if (value === "director_note") return "director's note";
  if (value === "dramaturgical_note") return "dramaturgical note";
  if (value === "music_director_note") return "music director's note";
  return "bio";
}

function getContributorTaskPath(item: ReminderRecipient) {
  return `/contribute/shows/${item.showId}/tasks/${item.requestId}`;
}

function getContributorAccessPath(item: Pick<ReminderRecipient, "showId" | "requestId">) {
  return `/access/shows/${item.showId}/tasks/${item.requestId}`;
}

function getContributorAccessUrl(item: Pick<ReminderRecipient, "showId" | "requestId">) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const path = getContributorAccessPath(item);
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
}

function getContributorLinkRefreshPath(item: Pick<ReminderRecipient, "showId" | "requestId">) {
  return `/request-link/shows/${item.showId}/tasks/${item.requestId}`;
}

function getContributorLinkRefreshUrl(item: Pick<ReminderRecipient, "showId" | "requestId">) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const path = getContributorLinkRefreshPath(item);
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
}

function buildAuthCallbackRedirectUrl(targetPath: string) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return "";
  }
  return `${baseUrl}/auth/callback?next=${encodeURIComponent(targetPath)}`;
}

async function generateDirectMagicLink(email: string, targetPath: string) {
  const redirectTo = buildAuthCallbackRedirectUrl(targetPath);
  if (!redirectTo) {
    return "";
  }

  const supabase = getSupabaseWriteClientRaw();
  const attempts: Array<"magiclink" | "invite"> = ["magiclink", "invite"];
  for (const type of attempts) {
    const { data, error } = await withTimeout(
      supabase.auth.admin.generateLink({
        type,
        email,
        options: { redirectTo }
      }),
      15_000,
      "generate_magic_link_timeout"
    );
    const hashedToken = String(data?.properties?.hashed_token ?? "").trim();
    if (!error && hashedToken) {
      const directCallback = new URL(redirectTo);
      directCallback.searchParams.set("token_hash", hashedToken);
      directCallback.searchParams.set("type", type);
      return directCallback.toString();
    }
  }

  return "";
}

type ContributorAccessContext = {
  recipient: ReminderRecipient;
  recipientGroup: ReminderRecipientGroup;
  requestedItem: ReminderRecipient;
  targetItem: ReminderRecipient;
  openItems: ReminderRecipient[];
  destinationPath: string;
  accessPath: string;
  accessUrl: string;
  refreshPath: string;
  refreshUrl: string;
};

async function resolveContributorAccessContext(showId: string, requestId: string): Promise<ContributorAccessContext | null> {
  const recipient = await getReminderRecipientByRequestId(showId, requestId);
  if (!recipient) {
    return null;
  }

  const recipientGroup = groupReminderRecipients(await getReminderRecipients(showId)).find((group) => group.personId === recipient.personId);
  if (!recipientGroup) {
    return null;
  }

  const requestedItem = recipientGroup.items.find((item) => item.requestId === requestId) ?? recipient;
  const openItems = getOpenReminderItems(recipientGroup);
  const targetItem = openItems.find((item) => item.requestId === requestId) ?? openItems[0] ?? requestedItem;
  const destinationPath = openItems.length > 1 ? "/contribute" : getContributorTaskPath(targetItem);

  return {
    recipient,
    recipientGroup,
    requestedItem,
    targetItem,
    openItems,
    destinationPath,
    accessPath: getContributorAccessPath(requestedItem),
    accessUrl: getContributorAccessUrl(requestedItem),
    refreshPath: getContributorLinkRefreshPath(requestedItem),
    refreshUrl: getContributorLinkRefreshUrl(requestedItem)
  };
}

type ContributorReminderEmail =
  | {
      ok: true;
      subject: string;
      text: string;
      html: string;
      accessUrl: string;
      openItems: ReminderRecipient[];
    }
  | {
      ok: false;
      reason: "secure_link_generation_failed";
      openItems: ReminderRecipient[];
    };

function groupReminderRecipients(items: ReminderRecipient[]) {
  const grouped = new Map<string, ReminderRecipientGroup>();
  for (const item of items) {
    const key = `${item.personId}::${item.email.toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    grouped.set(key, {
      showId: item.showId,
      personId: item.personId,
      email: item.email,
      name: item.name,
      roleTitle: item.roleTitle,
      items: [item]
    });
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    items: group.items.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue || getRequestLabel(a.requestType).localeCompare(getRequestLabel(b.requestType));
    })
  }));
}

function getOpenReminderItems(group: ReminderRecipientGroup) {
  return group.items.filter((item) => shouldRemind(item.status));
}

function getEarliestDueDate(items: ReminderRecipient[]) {
  const dueTimes = items
    .map((item) => (item.dueDate ? new Date(item.dueDate).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);
  return dueTimes.length > 0 ? dueTimes[0] : null;
}

function getDaysRemainingPhrase(items: ReminderRecipient[]) {
  const earliest = getEarliestDueDate(items);
  if (earliest === null) {
    return "as soon as possible";
  }
  const diffDays = Math.ceil((earliest - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) {
    return `${diffDays} days`;
  }
  if (diffDays === 1) {
    return "1 day";
  }
  if (diffDays === 0) {
    return "today";
  }
  return "as soon as possible";
}

function getOptionalBioNote(items: ReminderRecipient[]) {
  const hasBio = items.some((item) => item.requestType === "bio");
  const hasNotes = items.some((item) => item.requestType !== "bio");

  if (hasBio && hasNotes) {
    return "If you do not want a bio included, you can select the box to omit your bio. Any other outstanding items should still be completed.";
  }

  if (hasBio) {
    return "If you do not want a bio included, you can select the box to omit your bio.";
  }

  return "";
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildOutstandingItemsHtml(items: ReminderRecipient[]) {
  const rows = items.map((item) => {
    return `<li><strong>${getRequestLabel(item.requestType)}</strong> — Status: ${formatStatusLabel(item.status)}${item.dueDate ? ` — Due: ${formatDate(item.dueDate)}` : ""}</li>`;
  });
  return `<ul>${rows.join("")}</ul>`;
}

function buildOutstandingItemsText(items: ReminderRecipient[]) {
  return items
    .map((item) => `- ${getRequestLabel(item.requestType)} | Status: ${formatStatusLabel(item.status)}${item.dueDate ? ` | Due: ${formatDate(item.dueDate)}` : ""}`)
    .join("\n");
}

async function buildContributorReminderEmail(params: {
  context: Awaited<ReturnType<typeof getShowContext>>;
  group: ReminderRecipientGroup;
  explicitTargetRequestId?: string;
}): Promise<ContributorReminderEmail | null> {
  const openItems = getOpenReminderItems(params.group);
  if (!params.context || openItems.length === 0) {
    return null;
  }

  const targetItem =
    (params.explicitTargetRequestId
      ? openItems.find((item) => item.requestId === params.explicitTargetRequestId)
      : null) ?? openItems[0];
  const subject = `${params.context.title}: submission reminder`;
  const daysRemainingPhrase = getDaysRemainingPhrase(openItems);
  const optionalBioNote = getOptionalBioNote(openItems);
  const accessUrl = getContributorAccessUrl(targetItem);
  const freshLinkUrl = getContributorLinkRefreshUrl(targetItem);
  const textParts = [
    `Hello ${params.group.name},`,
    `This is a reminder that you still have items to submit for ${params.context.title}.`,
    buildOutstandingItemsText(openItems),
    `You have ${daysRemainingPhrase} to complete your outstanding submission items for inclusion in the program.`,
    optionalBioNote,
    `Please click here to open your submission.`,
    accessUrl,
    "When you arrive, click Continue to start your one-time secure session.",
    "Need a new link? Click here to have a fresh secure link sent to you if the one above has expired.",
    freshLinkUrl,
    "Thanks,",
    "Mike"
  ].filter(Boolean);
  const text =
    `${textParts.join("\n\n")}\n`;
  const html =
    `<p>Hello ${params.group.name},</p>` +
    `<p>This is a reminder that you still have items to submit for <strong>${params.context.title}</strong>.</p>` +
    buildOutstandingItemsHtml(openItems) +
    `<p>You have ${daysRemainingPhrase} to complete your outstanding submission items for inclusion in the program.</p>` +
    (optionalBioNote ? `<p>${optionalBioNote}</p>` : "") +
    `<p><a href="${accessUrl}">Please click here to open your submission.</a></p>` +
    `<p>When you arrive, click Continue to start your one-time secure session.</p>` +
    `<p><a href="${freshLinkUrl}">Need a new link? Click here to have a fresh secure link sent to you if the one above has expired.</a></p>` +
    `<p>Thanks,<br/>Mike</p>`;

  return {
    ok: true,
    subject,
    text,
    html,
    accessUrl,
    openItems
  };
}

async function writeReminderAudit(params: {
  personId: string;
  field: "invite_sent" | "reminder_sent" | "secure_link_requested";
  reason: string;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  await db.from("audit_log").insert({
    entity: "people",
    entity_id: params.personId,
    field: params.field,
    before_value: null,
    after_value: params.payload,
    reason: params.reason
  });
}

async function wasSecureLinkRequestedRecently(personId: string, minutes: number) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data } = await db
    .from("audit_log")
    .select("id")
    .eq("entity", "people")
    .eq("entity_id", personId)
    .eq("field", "secure_link_requested")
    .gte("changed_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function getShowReminderSummary(showId: string) {
  const context = await getShowContext(showId);
  const recipients = await getReminderRecipients(showId);
  const now = Date.now();
  const dueSoonWindow = context?.reminderDueSoonDays ?? 7;
  const openItems = recipients.filter((item) => shouldRemind(item.status));
  const currentDueDate =
    openItems
      .map((item) => item.dueDate)
      .find((value): value is string => Boolean(value)) ?? null;

  const missing = openItems.length;
  const overdue = recipients.filter((item) => {
    if (!shouldRemind(item.status) || !item.dueDate) return false;
    return new Date(item.dueDate).getTime() < now;
  }).length;
  const dueSoon = recipients.filter((item) => {
    if (!shouldRemind(item.status) || !item.dueDate) return false;
    const diffDays = Math.floor((new Date(item.dueDate).getTime() - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= dueSoonWindow;
  }).length;

  return { missing, overdue, dueSoon, currentDueDate };
}

export async function setShowDueDate(showId: string, formData: FormData) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (!dueDate) {
    withError(`/app/shows/${showId}?tab=overview`, "Please choose a due date.");
  }

  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: roles } = await db.from("show_roles").select("id").eq("show_id", showId);
  const roleIds = (roles ?? []).map((row) => String(row.id));
  if (roleIds.length === 0) {
    withError(`/app/shows/${showId}?tab=overview`, "No roles found. Add people first.");
  }

  const { error } = await db
    .from("submission_requests")
    .update({ due_date: `${dueDate}T23:59:59.000Z` })
    .in("show_role_id", roleIds);
  if (error) {
    withError(`/app/shows/${showId}?tab=overview`, error.message);
  }

  withSuccess(`/app/shows/${showId}?tab=overview`, "Submission due date updated.");
}

export async function sendShowInvites(showId: string) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }

  const recipients = groupReminderRecipients(await getReminderRecipients(showId));
  if (recipients.length === 0) {
    withError(`/app/shows/${showId}?tab=overview`, "No recipients found.");
  }
  const deliveryMode = getReminderDeliveryMode();

  let sent = 0;
  for (const group of recipients) {
    const email = await buildContributorReminderEmail({ context, group });
    if (!email) {
      continue;
    }
    if (!email.ok) {
      await writeReminderAudit({
        personId: group.personId,
        field: "invite_sent",
        reason: email.reason,
        payload: {
          request_ids: email.openItems.map((item) => item.requestId),
          due_dates: email.openItems.map((item) => item.dueDate),
          sent: false
        }
      });
      continue;
    }

    const result = await sendEmailWithThrottle({ to: group.email, subject: email.subject, text: email.text, html: email.html });
    await writeReminderAudit({
      personId: group.personId,
      field: "invite_sent",
      reason: result.reason,
      payload: {
        request_ids: email.openItems.map((item) => item.requestId),
        due_dates: email.openItems.map((item) => item.dueDate),
        sent: result.sent
      }
    });
    if (result.sent) sent += 1;
    await sleep(600);
  }

  const baseMessage = `Invites processed: ${sent}/${recipients.length} sent.`;
  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    deliveryMode.isDelivering ? baseMessage : `${baseMessage} ${deliveryMode.label}.`
  );
}

export async function sendReminderTestEmail(showId: string) {
  "use server";
  const current = await requireRole(["owner", "admin", "editor"]);
  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }

  const deliveryMode = getReminderDeliveryMode();
  const link = (await generateDirectMagicLink(current.profile.email, "/contribute")) || "/contribute";
  const subject = `${context.title}: test reminder email`;
  const text = `This is a test reminder email for ${context.title}.\nIf you received this, email delivery is working.\nPlease click here to submit your materials:\n${link}\n`;
  const html = `<p>This is a test reminder email for <strong>${context.title}</strong>.</p><p>If you received this, email delivery is working.</p><p><a href="${link}">Please click here to submit your materials.</a></p>`;
  const result = await sendEmail({
    to: current.profile.email,
    subject,
    text,
    html
  });

  const baseMessage = result.sent
    ? `Test reminder sent to ${current.profile.email}.`
    : `Test reminder processed for ${current.profile.email}, but delivery was not live (${result.reason}).`;
  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    deliveryMode.isDelivering ? baseMessage : `${baseMessage} ${deliveryMode.label}.`
  );
}

export async function sendReminderPreviewEmail(showId: string) {
  "use server";
  const current = await requireRole(["owner", "admin", "editor"]);
  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }

  const recipientGroup = groupReminderRecipients(await getReminderRecipients(showId)).find((group) => getOpenReminderItems(group).length > 0);
  if (!recipientGroup) {
    withError(`/app/shows/${showId}?tab=overview`, "No open reminder-eligible requests were found for this show.");
  }

  const deliveryMode = getReminderDeliveryMode();
  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const previewEmail = await buildContributorReminderEmail({ context, group: recipientGroup });
  if (!previewEmail) {
    withError(`/app/shows/${showId}?tab=overview`, "No open reminder-eligible requests were found for this show.");
  }
  if (!previewEmail.ok) {
    withError(`/app/shows/${showId}?tab=overview`, "Could not generate a secure contributor link for this reminder preview.");
  }
  const firstOpenItem = previewEmail.openItems[0] ?? null;
  if (!firstOpenItem) {
    withError(`/app/shows/${showId}?tab=overview`, "No open reminder-eligible requests were found for this show.");
  }
  const adminPreviewLink = baseUrl
    ? `${baseUrl}/app/shows/${showId}/submissions/${firstOpenItem.requestId}`
    : `/app/shows/${showId}/submissions/${firstOpenItem.requestId}`;
  const subject = `${context.title}: submission reminder preview`;
  const text =
    `This is a preview copy of the live reminder email.\n\n` +
    `Originally addressed to: ${recipientGroup.name} <${recipientGroup.email}>\n\n` +
    `${previewEmail.text}\n` +
    `Live email note: the real recipient email links to a Playbill access page, where the contributor clicks Continue to start a fresh secure session.\n\n` +
    `Admin preview link: ${adminPreviewLink}\n`;
  const html =
    `<p><strong>This is a preview copy of the live reminder email.</strong></p>` +
    `<p>Originally addressed to: ${recipientGroup.name} &lt;${recipientGroup.email}&gt;</p>` +
    `<div>${previewEmail.html}</div>` +
    `<p><strong>Live email note:</strong> the real recipient email links to a Playbill access page, where the contributor clicks Continue to start a fresh secure session.</p>` +
    `<p><strong>Admin preview link:</strong><br/><a href="${adminPreviewLink}">Open review in admin workspace</a></p>`;
  const result = await sendEmail({
    to: current.profile.email,
    subject,
    text,
    html
  });

  const baseMessage = result.sent
    ? `Reminder preview sent to ${current.profile.email} for ${recipientGroup.name}.`
    : `Reminder preview processed for ${current.profile.email}, but delivery was not live (${result.reason}).`;
  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    deliveryMode.isDelivering ? baseMessage : `${baseMessage} ${deliveryMode.label}.`
  );
}

export async function sendSingleReminderNow(showId: string, requestId: string) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }
  if (context.remindersPaused) {
    withSuccess(`/app/shows/${showId}?tab=submissions`, "Reminders are currently paused for this show.");
  }

  const recipient = await getReminderRecipientByRequestId(showId, requestId);
  if (!recipient) {
    withError(`/app/shows/${showId}?tab=submissions`, "That submission request could not be found.");
  }
  if (!shouldRemind(recipient.status)) {
    withSuccess(
      `/app/shows/${showId}?tab=submissions`,
      `${recipient.name} does not currently need a reminder for ${getRequestLabel(recipient.requestType)}.`
    );
  }

  const deliveryMode = getReminderDeliveryMode();
  const recipientGroup = groupReminderRecipients(await getReminderRecipients(showId)).find((group) => group.personId === recipient.personId);
  if (!recipientGroup) {
    withError(`/app/shows/${showId}?tab=submissions`, "That submission request could not be found.");
  }
  const email = await buildContributorReminderEmail({ context, group: recipientGroup, explicitTargetRequestId: requestId });
  if (!email) {
    withError(`/app/shows/${showId}?tab=submissions`, "No open reminder items were found for this person.");
  }
  if (!email.ok) {
    await writeReminderAudit({
      personId: recipientGroup.personId,
      field: "reminder_sent",
      reason: `manual_single_${email.reason}`,
      payload: {
        request_ids: email.openItems.map((item) => item.requestId),
        due_dates: email.openItems.map((item) => item.dueDate),
        sent: false,
        mode: "manual_single"
      }
    });
    withError(`/app/shows/${showId}?tab=submissions`, "Could not generate a secure contributor link for this reminder.");
  }
  const result = await sendEmail({ to: recipientGroup.email, subject: email.subject, text: email.text, html: email.html });

  await writeReminderAudit({
    personId: recipientGroup.personId,
    field: "reminder_sent",
    reason: `manual_single_${result.reason}`,
    payload: {
      request_ids: email.openItems.map((item) => item.requestId),
      due_dates: email.openItems.map((item) => item.dueDate),
      sent: result.sent,
      mode: "manual_single"
    }
  });

  const baseMessage = result.sent
    ? `Reminder sent to ${recipientGroup.name}.`
    : `Reminder processed for ${recipientGroup.name}, but delivery was not live (${result.reason}).`;
  withSuccess(
    `/app/shows/${showId}?tab=submissions`,
    deliveryMode.isDelivering ? baseMessage : `${baseMessage} ${deliveryMode.label}.`
  );
}

export async function sendShowRemindersNow(showId: string, formData?: FormData) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);
  const rawScope = String(formData?.get("scope") ?? "all_open");
  const scope: ReminderDispatchScope =
    rawScope === "open_bios" || rawScope === "open_notes" ? rawScope : "all_open";
  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }
  if (context.remindersPaused) {
    withSuccess(`/app/shows/${showId}?tab=overview`, "Reminders are currently paused for this show.");
  }
  const summary = await runReminderDispatchForShow(showId, "manual", scope);
  const deliveryMode = getReminderDeliveryMode();
  const scopeLabel = getReminderScopeLabel(scope);
  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    deliveryMode.isDelivering
      ? `Reminders (${scopeLabel}) processed: ${summary.sent}/${summary.total}.`
      : `Reminders (${scopeLabel}) processed: ${summary.sent}/${summary.total}. ${deliveryMode.label}.`
  );
}

export async function setShowRemindersPaused(showId: string, formData: FormData) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const intent = String(formData.get("intent") ?? "pause");
  const shouldPause = intent === "pause";
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { error } = await db
    .from("shows")
    .update({
      reminders_paused: shouldPause,
      updated_at: new Date().toISOString()
    })
    .eq("id", showId);
  if (error) {
    withError(`/app/shows/${showId}?tab=overview`, error.message);
  }

  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    shouldPause ? "Reminders paused for this show." : "Reminders resumed for this show."
  );
}

async function wasReminderSentRecently(personId: string, days: number) {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("audit_log")
    .select("id")
    .eq("entity", "people")
    .eq("entity_id", personId)
    .eq("field", "reminder_sent")
    .gte("changed_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

async function dispatchReminderRun(
  showId: string,
  mode: "manual" | "cron",
  scope: ReminderDispatchScope = "all_open",
  onProgress?: (progress: ReminderDispatchProgress) => Promise<void> | void
) {
  const context = await getShowContext(showId);
  if (!context) {
    return { sent: 0, total: 0 };
  }
  if (context.remindersPaused) {
    return { sent: 0, total: 0 };
  }
  if (mode === "cron" && !context.reminderAutomationEnabled) {
    return { sent: 0, total: 0 };
  }
  const now = Date.now();
  const cadenceDays = context.reminderCadenceDays ?? 7;
  const recipients = groupReminderRecipients(await getReminderRecipients(showId))
    .map((group) => ({
      ...group,
      items: getOpenReminderItems(group).filter((item) => {
        if (scope === "all_open") return true;
        if (scope === "open_bios") {
          return item.requestType === "bio";
        }
        return item.requestType !== "bio";
      })
    }))
    .filter((group) => group.items.length > 0);
  let sent = 0;
  let processed = 0;

  for (const group of recipients) {
    const earliestDue = getEarliestDueDate(group.items);
    const diffDays = earliestDue ? Math.floor((earliestDue - now) / (1000 * 60 * 60 * 24)) : null;
    const isLastDay = context.reminderSendLastDay && diffDays !== null && diffDays <= 0;
    const shouldSendInCron = mode === "manual" || isLastDay || !(await wasReminderSentRecently(group.personId, cadenceDays - 1));
    if (!shouldSendInCron) {
      processed += 1;
      await onProgress?.({
        processed,
        sent,
        total: recipients.length,
        recipientName: group.name,
        reason: "skipped_recently_sent"
      });
      continue;
    }

    const email = await buildContributorReminderEmail({ context, group });
    if (!email) {
      processed += 1;
      await onProgress?.({
        processed,
        sent,
        total: recipients.length,
        recipientName: group.name,
        reason: "no_open_items"
      });
      continue;
    }
    if (!email.ok) {
      await writeReminderAudit({
        personId: group.personId,
        field: "reminder_sent",
        reason: mode === "manual" ? `manual_${email.reason}` : isLastDay ? `last_day_${email.reason}` : `weekly_${email.reason}`,
        payload: {
          request_ids: email.openItems.map((item) => item.requestId),
          due_dates: email.openItems.map((item) => item.dueDate),
          sent: false,
          mode
        }
      });
      processed += 1;
      await onProgress?.({
        processed,
        sent,
        total: recipients.length,
        recipientName: group.name,
        reason: email.reason
      });
      continue;
    }
    const result = await sendEmailWithThrottle({ to: group.email, subject: email.subject, text: email.text, html: email.html });

    await writeReminderAudit({
      personId: group.personId,
      field: "reminder_sent",
      reason: mode === "manual" ? `manual_${result.reason}` : isLastDay ? `last_day_${result.reason}` : `weekly_${result.reason}`,
      payload: {
        request_ids: email.openItems.map((item) => item.requestId),
        due_dates: email.openItems.map((item) => item.dueDate),
        sent: result.sent,
        mode
      }
    });
    if (result.sent) sent += 1;
    processed += 1;
    await onProgress?.({
      processed,
      sent,
      total: recipients.length,
      recipientName: group.name,
      reason: result.reason
    });
    await sleep(600);
  }

  return { sent, total: recipients.length };
}

export async function runReminderDispatchForShow(showId: string, mode: "manual" | "cron", scope: ReminderDispatchScope = "all_open") {
  return dispatchReminderRun(showId, mode, scope);
}

export async function streamReminderDispatchForShow(
  showId: string,
  scope: ReminderDispatchScope,
  onProgress: (progress: ReminderDispatchProgress) => Promise<void> | void
) {
  return dispatchReminderRun(showId, "manual", scope, onProgress);
}

export async function runReminderCron() {
  const supabase = getSupabaseWriteClient();
  const db = supabase.schema(APP_SCHEMA);
  const { data: shows } = await db.from("shows").select("id").eq("reminders_paused", false);
  let sent = 0;
  let total = 0;
  for (const show of shows ?? []) {
    const result = await runReminderDispatchForShow(String(show.id), "cron");
    sent += result.sent;
    total += result.total;
  }
  return { sent, total, shows: (shows ?? []).length };
}

export async function sendContributorSubmissionConfirmation(params: {
  email: string;
  name: string;
  showTitle: string;
  submissionLabel: string;
  showId: string;
  taskId: string;
}) {
  const link = getContributorAccessUrl({ showId: params.showId, requestId: params.taskId });

  const subject = `${params.showTitle}: ${params.submissionLabel} received`;
  const text = link
    ? `Thank you ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}. You can view or edit your submission until it is accepted by clicking the link here: ${link}\n\nThanks,`
    : `Thank You ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}. ` +
      `If you need to reopen your task, use the secure link from your invite or reminder email. ` +
      `If that link is no longer available, contact the production team and ask them to resend it.\n\n` +
      `Thanks,`;
  const html = link
    ? `<p>Thank you ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}. You can view or edit your submission until it is accepted by clicking the link <a href="${link}">here</a>.</p><p>Thanks,</p>`
    : `<p>Thank You ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}.</p>` +
      `<p>If you need to reopen your task, use the secure link from your invite or reminder email. If that link is no longer available, contact the production team and ask them to resend it.</p>` +
      `<p>Thanks,</p>`;

  return sendEmail({
    to: params.email,
    subject,
    text,
    html
  });
}

export async function continueContributorTaskAccess(showId: string, taskId: string) {
  "use server";

  const accessContext = await resolveContributorAccessContext(showId, taskId);
  const responsePath = getContributorAccessPath({ showId, requestId: taskId });

  if (!accessContext) {
    withError(responsePath, "This submission link is no longer available.");
  }

  const directLink = await generateDirectMagicLink(accessContext.recipientGroup.email, accessContext.destinationPath);
  if (!directLink) {
    await writeReminderAudit({
      personId: accessContext.recipient.personId,
      field: "secure_link_requested",
      reason: "intermediate_access_generation_failed",
      payload: {
        request_ids: accessContext.openItems.map((item) => item.requestId),
        requested_task_id: taskId,
        sent: false,
        mode: "intermediate_access_continue"
      }
    });
    withError(responsePath, "We could not open a secure session right now. You can request a fresh email link below.");
  }

  const generatedUrl = new URL(directLink);
  console.info("[contributor/access]", "continue_redirect", {
    requested_task_id: taskId,
    destination_path: accessContext.destinationPath,
    pathname: generatedUrl.pathname,
    has_token_hash: generatedUrl.searchParams.has("token_hash"),
    type: generatedUrl.searchParams.get("type"),
    next: generatedUrl.searchParams.get("next")
  });

  await writeReminderAudit({
    personId: accessContext.recipient.personId,
    field: "secure_link_requested",
    reason: "intermediate_access_redirected",
    payload: {
      request_ids: accessContext.openItems.map((item) => item.requestId),
      requested_task_id: taskId,
      destination_path: accessContext.destinationPath,
      sent: true,
      mode: "intermediate_access_continue"
    }
  });

  redirect(directLink);
}

export async function requestContributorFreshLink(showId: string, taskId: string, formData: FormData) {
  "use server";

  const submittedEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const responsePath = getContributorLinkRefreshPath({ showId, requestId: taskId });
  const neutralMessage = "If that email matches the assignment, a fresh secure link has been sent.";

  const accessContext = await resolveContributorAccessContext(showId, taskId);
  if (!accessContext || !submittedEmail) {
    withSuccess(responsePath, neutralMessage);
  }

  if (accessContext.openItems.length === 0) {
    await writeReminderAudit({
      personId: accessContext.recipient.personId,
      field: "secure_link_requested",
      reason: "no_open_items",
      payload: {
        request_ids: accessContext.recipientGroup.items.map((item) => item.requestId),
        sent: false,
        mode: "self_service_refresh",
        email_matched: accessContext.recipientGroup.email.toLowerCase() === submittedEmail
      }
    });
    withSuccess(responsePath, neutralMessage);
  }

  const emailMatched = accessContext.recipientGroup.email.toLowerCase() === submittedEmail;
  if (!emailMatched) {
    await writeReminderAudit({
      personId: accessContext.recipient.personId,
      field: "secure_link_requested",
      reason: "email_mismatch",
      payload: {
        request_ids: accessContext.openItems.map((item) => item.requestId),
        sent: false,
        mode: "self_service_refresh",
        email_matched: false
      }
    });
    withSuccess(responsePath, neutralMessage);
  }

  if (await wasSecureLinkRequestedRecently(accessContext.recipient.personId, 15)) {
    await writeReminderAudit({
      personId: accessContext.recipient.personId,
      field: "secure_link_requested",
      reason: "rate_limited",
      payload: {
        request_ids: accessContext.openItems.map((item) => item.requestId),
        sent: false,
        mode: "self_service_refresh",
        email_matched: true
      }
    });
    withSuccess(responsePath, neutralMessage);
  }

  const context = await getShowContext(showId);
  const showTitle = context?.title || "your production";
  const subject = `${showTitle}: your fresh secure link`;
  const text =
    `Hello ${accessContext.recipientGroup.name},\n\n` +
    `Here is your fresh Playbill access link:\n\n` +
    `${accessContext.accessUrl}\n\n` +
    `When you arrive, click Continue to start your one-time secure session.\n\n` +
    `Thanks,\nMike\n`;
  const html =
    `<p>Hello ${accessContext.recipientGroup.name},</p>` +
    `<p>Here is your fresh Playbill access link:</p>` +
    `<p><a href="${accessContext.accessUrl}">${accessContext.accessUrl}</a></p>` +
    `<p>When you arrive, click Continue to start your one-time secure session.</p>` +
    `<p>Thanks,<br/>Mike</p>`;

  const result = await sendEmailWithThrottle({
    to: accessContext.recipientGroup.email,
    subject,
    text,
    html
  });

  await writeReminderAudit({
    personId: accessContext.recipient.personId,
    field: "secure_link_requested",
    reason: result.sent ? "sent" : result.reason,
    payload: {
      request_ids: accessContext.openItems.map((item) => item.requestId),
      sent: result.sent,
      mode: "self_service_refresh",
      email_matched: true
    }
  });

  withSuccess(responsePath, neutralMessage);
}
