import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSupabaseWriteClient } from "@/lib/supabase";

type ReminderRecipient = {
  personId: string;
  email: string;
  name: string;
  roleTitle: string;
  requestId: string;
  requestType: string;
  dueDate: string | null;
  status: string;
};

function withError(path: string, message: string): never {
  const qp = new URLSearchParams({ error: message });
  redirect(`${path}?${qp.toString()}`);
}

function withSuccess(path: string, message: string): never {
  const qp = new URLSearchParams({ success: message });
  redirect(`${path}?${qp.toString()}`);
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

  const response = await fetch("https://api.resend.com/emails", {
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
    })
  });

  if (!response.ok) {
    return { sent: false, reason: `provider_error_${response.status}` as const };
  }

  return { sent: true, reason: "sent" as const };
}

async function getShowContext(showId: string) {
  const client = getSupabaseWriteClient();
  const { data: show } = await client
    .from("shows")
    .select("id, title, slug, reminders_paused")
    .eq("id", showId)
    .maybeSingle();
  if (!show) {
    return null;
  }
  const { data: program } = await client.from("programs").select("slug").eq("slug", show.slug).maybeSingle();
  return {
    id: String(show.id),
    title: String(show.title ?? "Show"),
    slug: String(show.slug ?? ""),
    programSlug: String(program?.slug ?? show.slug ?? ""),
    remindersPaused: Boolean(show.reminders_paused)
  };
}

async function getReminderRecipients(showId: string) {
  const client = getSupabaseWriteClient();
  const { data: roles } = await client.from("show_roles").select("id, person_id").eq("show_id", showId);
  const roleIds = (roles ?? []).map((row) => String(row.id));
  if (roleIds.length === 0) {
    return [] as ReminderRecipient[];
  }

  const { data: requests } = await client
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
  const { data: people } = await client
    .from("people")
    .select("id, full_name, role_title, email, submission_status")
    .in("id", personIds);
  const personById = new Map(
    (people ?? []).map((person) => [
      String(person.id),
      {
        name: String(person.full_name ?? ""),
        roleTitle: String(person.role_title ?? ""),
        email: String(person.email ?? ""),
        status: String(person.submission_status ?? "pending")
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
        personId,
        email: person.email,
        name: person.name,
        roleTitle: person.roleTitle,
        requestId: String(request.id),
        requestType: String(request.request_type ?? "bio"),
        dueDate: request.due_date ? String(request.due_date) : null,
        status: person.status
      } satisfies ReminderRecipient;
    })
    .filter((row): row is ReminderRecipient => row !== null);
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

async function writeReminderAudit(params: {
  personId: string;
  field: "invite_sent" | "reminder_sent";
  reason: string;
  payload: Record<string, unknown>;
}) {
  const client = getSupabaseWriteClient();
  await client.from("audit_log").insert({
    entity: "people",
    entity_id: params.personId,
    field: params.field,
    before_value: null,
    after_value: params.payload,
    reason: params.reason
  });
}

export async function getShowReminderSummary(showId: string) {
  const recipients = await getReminderRecipients(showId);
  const now = Date.now();

  const missing = recipients.filter((item) => shouldRemind(item.status)).length;
  const overdue = recipients.filter((item) => {
    if (!shouldRemind(item.status) || !item.dueDate) return false;
    return new Date(item.dueDate).getTime() < now;
  }).length;
  const dueSoon = recipients.filter((item) => {
    if (!shouldRemind(item.status) || !item.dueDate) return false;
    const diffDays = Math.floor((new Date(item.dueDate).getTime() - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  return { missing, overdue, dueSoon };
}

export async function setShowDueDate(showId: string, formData: FormData) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const dueDate = String(formData.get("dueDate") ?? "").trim();
  if (!dueDate) {
    withError(`/app/shows/${showId}?tab=overview`, "Please choose a due date.");
  }

  const client = getSupabaseWriteClient();
  const { data: roles } = await client.from("show_roles").select("id").eq("show_id", showId);
  const roleIds = (roles ?? []).map((row) => String(row.id));
  if (roleIds.length === 0) {
    withError(`/app/shows/${showId}?tab=overview`, "No roles found. Add people first.");
  }

  const { error } = await client
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

  const recipients = await getReminderRecipients(showId);
  if (recipients.length === 0) {
    withError(`/app/shows/${showId}?tab=overview`, "No recipients found.");
  }

  let sent = 0;
  for (const item of recipients) {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/contribute`;
    const requestLabel = getRequestLabel(item.requestType);
    const subject = `${context.title}: ${requestLabel} submission invite`;
    const text = `Hi ${item.name},\n\nPlease submit your ${requestLabel} for ${context.title}.\nRole: ${item.roleTitle}\nDue: ${formatDate(item.dueDate)}\nLink: ${link}\n`;
    const html = `<p>Hi ${item.name},</p><p>Please submit your ${requestLabel} for <strong>${context.title}</strong>.</p><p>Role: ${item.roleTitle}<br/>Due: ${formatDate(item.dueDate)}</p><p><a href="${link}">Open contributor portal</a></p>`;

    const result = await sendEmail({ to: item.email, subject, text, html });
    await writeReminderAudit({
      personId: item.personId,
      field: "invite_sent",
      reason: result.reason,
      payload: { request_id: item.requestId, due_date: item.dueDate, sent: result.sent }
    });
    if (result.sent) sent += 1;
  }

  withSuccess(`/app/shows/${showId}?tab=overview`, `Invites processed: ${sent}/${recipients.length} sent.`);
}

export async function sendShowRemindersNow(showId: string) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);
  const context = await getShowContext(showId);
  if (!context) {
    withError("/app/shows", "Show not found.");
  }
  if (context.remindersPaused) {
    withSuccess(`/app/shows/${showId}?tab=overview`, "Reminders are currently paused for this show.");
  }
  const summary = await runReminderDispatchForShow(showId, "manual");
  withSuccess(
    `/app/shows/${showId}?tab=overview`,
    `Reminders processed: ${summary.sent}/${summary.total}.`
  );
}

export async function setShowRemindersPaused(showId: string, formData: FormData) {
  "use server";
  await requireRole(["owner", "admin", "editor"]);

  const intent = String(formData.get("intent") ?? "pause");
  const shouldPause = intent === "pause";
  const client = getSupabaseWriteClient();
  const { error } = await client
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
  const client = getSupabaseWriteClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await client
    .from("audit_log")
    .select("id")
    .eq("entity", "people")
    .eq("entity_id", personId)
    .eq("field", "reminder_sent")
    .gte("changed_at", since)
    .limit(1);
  return (data ?? []).length > 0;
}

export async function runReminderDispatchForShow(showId: string, mode: "manual" | "cron") {
  const context = await getShowContext(showId);
  if (!context) {
    return { sent: 0, total: 0 };
  }
  if (context.remindersPaused) {
    return { sent: 0, total: 0 };
  }
  const recipients = (await getReminderRecipients(showId)).filter((item) => shouldRemind(item.status));
  let sent = 0;

  for (const item of recipients) {
    const due = item.dueDate ? new Date(item.dueDate).getTime() : null;
    const now = Date.now();
    const diffDays = due ? Math.floor((due - now) / (1000 * 60 * 60 * 24)) : null;
    const isLastDay = diffDays !== null && diffDays <= 0;
    const shouldSendInCron = mode === "manual" || isLastDay || !(await wasReminderSentRecently(item.personId, 6));
    if (!shouldSendInCron) {
      continue;
    }

    const link = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/contribute`;
    const requestLabel = getRequestLabel(item.requestType);
    const subject = `${context.title}: ${requestLabel} reminder`;
    const text = `Reminder for ${context.title}\nPlease submit your ${requestLabel}.\nRole: ${item.roleTitle}\nDue: ${formatDate(item.dueDate)}\nLink: ${link}\n`;
    const html = `<p>This is a reminder for <strong>${context.title}</strong>.</p><p>Please submit your ${requestLabel}.<br/>Role: ${item.roleTitle}<br/>Due: ${formatDate(item.dueDate)}</p><p><a href="${link}">Open contributor portal</a></p>`;
    const result = await sendEmail({ to: item.email, subject, text, html });

    await writeReminderAudit({
      personId: item.personId,
      field: "reminder_sent",
      reason: mode === "manual" ? `manual_${result.reason}` : isLastDay ? `last_day_${result.reason}` : `weekly_${result.reason}`,
      payload: { request_id: item.requestId, due_date: item.dueDate, sent: result.sent, mode }
    });
    if (result.sent) sent += 1;
  }

  return { sent, total: recipients.length };
}

export async function runReminderCron() {
  const client = getSupabaseWriteClient();
  const { data: shows } = await client.from("shows").select("id").eq("reminders_paused", false);
  let sent = 0;
  let total = 0;
  for (const show of shows ?? []) {
    const result = await runReminderDispatchForShow(String(show.id), "cron");
    sent += result.sent;
    total += result.total;
  }
  return { sent, total, shows: (shows ?? []).length };
}
