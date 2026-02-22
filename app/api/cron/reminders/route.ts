import { NextResponse } from "next/server";
import { runReminderCron } from "@/lib/reminders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || bearer !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await runReminderCron();
  return NextResponse.json({ ok: true, ...result });
}
