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

type ReminderDispatchScope = "all_open" | "open_bios" | "open_notes";

type ReminderRecipientGroup = {
  showId: string;
  personId: string;
  email: string;
  name: string;
  roleTitle: string;
  items: ReminderRecipient[];
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

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${qp.toString()}`);
}

function withSuccess(path: string, message: string): never {
  const qp = new URLSearchParams({ success: message });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${qp.toString()}`);
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

function getContributorTaskLink(item: ReminderRecipient) {
  const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  const taskPath = getContributorTaskPath(item);
  const loginPath = `/login?next=${encodeURIComponent(taskPath)}`;
  if (!baseUrl) {
    return loginPath;
  }
  return `${baseUrl}${loginPath}`;
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

    const actionLink = String(data?.properties?.action_link ?? "").trim();
    if (!error && actionLink) {
      return actionLink;
    }
  }

  return "";
}

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

function getDaysRemainingCopy(items: ReminderRecipient[]) {
  const earliest = getEarliestDueDate(items);
  if (earliest === null) {
    return "Please submit your materials as soon as possible to be included in the program.";
  }
  const diffDays = Math.ceil((earliest - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1) {
    return `You have ${diffDays} days to complete the submission to be included in the program. If you do not want a bio in the program there is a box you can select to omit your bio.`;
  }
  if (diffDays === 1) {
    return "You have 1 day to complete the submission to be included in the program. If you do not want a bio in the program there is a box you can select to omit your bio.";
  }
  if (diffDays === 0) {
    return "Your submission is due today to be included in the program. If you do not want a bio in the program there is a box you can select to omit your bio.";
  }
  return "The submission deadline has passed, but you can still submit your materials now if the program is still being finalized. If you do not want a bio in the program there is a box you can select to omit your bio.";
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
}) {
  const openItems = getOpenReminderItems(params.group);
  if (!params.context || openItems.length === 0) {
    return null;
  }

  const targetItem =
    (params.explicitTargetRequestId
      ? openItems.find((item) => item.requestId === params.explicitTargetRequestId)
      : null) ?? openItems[0];
  const destinationPath = openItems.length > 1 ? "/contribute" : getContributorTaskPath(targetItem);
  const directLink = (await generateDirectMagicLink(params.group.email, destinationPath)) || getContributorTaskLink(targetItem);
  const subject = `${params.context.title}: submission reminder`;
  const text =
    `Hello ${params.group.name},\n\n` +
    `This is a reminder that you have items still needed to be submitted for ${params.context.title}.\n\n` +
    `${buildOutstandingItemsText(openItems)}\n\n` +
    `${getDaysRemainingCopy(openItems)}\n\n` +
    `Please click here to submit your materials:\n${directLink}\n`;
  const html =
    `<p>Hello ${params.group.name},</p>` +
    `<p>This is a reminder that you have items still needed to be submitted for <strong>${params.context.title}</strong>.</p>` +
    buildOutstandingItemsHtml(openItems) +
    `<p>${getDaysRemainingCopy(openItems)}</p>` +
    `<p><a href="${directLink}">Please click here to submit your materials.</a></p>`;

  return {
    subject,
    text,
    html,
    directLink,
    openItems
  };
}

async function writeReminderAudit(params: {
  personId: string;
  field: "invite_sent" | "reminder_sent";
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

    const result = await sendEmail({ to: group.email, subject: email.subject, text: email.text, html: email.html });
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
  const firstOpenItem = previewEmail?.openItems[0] ?? null;
  if (!previewEmail || !firstOpenItem) {
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
    `Live email note: the real recipient email includes a direct secure sign-in link tied to their inbox.\n\n` +
    `Admin preview link: ${adminPreviewLink}\n`;
  const html =
    `<p><strong>This is a preview copy of the live reminder email.</strong></p>` +
    `<p>Originally addressed to: ${recipientGroup.name} &lt;${recipientGroup.email}&gt;</p>` +
    `<div>${previewEmail.html}</div>` +
    `<p><strong>Live email note:</strong> the real recipient email includes a direct secure sign-in link tied to their inbox.</p>` +
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
  const scopeLabel =
    scope === "open_bios" ? "all open bios" : scope === "open_notes" ? "all open notes" : "all open tasks";
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

export async function runReminderDispatchForShow(showId: string, mode: "manual" | "cron", scope: ReminderDispatchScope = "all_open") {
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

  for (const group of recipients) {
    const earliestDue = getEarliestDueDate(group.items);
    const diffDays = earliestDue ? Math.floor((earliestDue - now) / (1000 * 60 * 60 * 24)) : null;
    const isLastDay = context.reminderSendLastDay && diffDays !== null && diffDays <= 0;
    const shouldSendInCron = mode === "manual" || isLastDay || !(await wasReminderSentRecently(group.personId, cadenceDays - 1));
    if (!shouldSendInCron) {
      continue;
    }

    const email = await buildContributorReminderEmail({ context, group });
    if (!email) {
      continue;
    }
    const result = await sendEmail({ to: group.email, subject: email.subject, text: email.text, html: email.html });

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
  }

  return { sent, total: recipients.length };
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
  const taskPath = `/contribute/shows/${params.showId}/tasks/${params.taskId}`;
  const link = (await generateDirectMagicLink(params.email, taskPath)) || getContributorTaskLink({
    showId: params.showId,
    personId: "",
    email: params.email,
    name: params.name,
    roleTitle: "",
    requestId: params.taskId,
    requestType: "bio",
    dueDate: null,
    status: "submitted"
  });

  const subject = `${params.showTitle}: ${params.submissionLabel} received`;
  const text =
    `Thank You ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}. ` +
    `You can view or edit your bio until it accepted by clicking the link here: ${link}\n\n` +
    `Thanks,`;
  const html =
    `<p>Thank You ${params.name} for submitting your ${params.submissionLabel} for ${params.showTitle}. ` +
    `You can view or edit your bio until it accepted by clicking the link <a href="${link}">here</a>.</p>` +
    `<p>Thanks,</p>`;

  return sendEmail({
    to: params.email,
    subject,
    text,
    html
  });
}
