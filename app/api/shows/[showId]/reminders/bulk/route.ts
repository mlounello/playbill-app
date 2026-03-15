import { NextRequest } from "next/server";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { getReminderDeliveryMode, streamReminderDispatchForShow, type ReminderDispatchScope } from "@/lib/reminders";

export const runtime = "nodejs";

function normalizeScope(value: string): ReminderDispatchScope {
  if (value === "open_bios" || value === "open_notes") {
    return value;
  }
  return "all_open";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const current = await getCurrentUserWithProfile();
  if (!current) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!["owner", "admin", "editor"].includes(current.profile.platform_role)) {
    return Response.json({ error: "Not authorized." }, { status: 403 });
  }
  const { showId } = await params;
  const body = (await request.json().catch(() => ({}))) as { scope?: string };
  const scope = normalizeScope(String(body.scope ?? "all_open"));
  const deliveryMode = getReminderDeliveryMode();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({ type: "start", scope, deliveryMode: deliveryMode.label });
        const summary = await streamReminderDispatchForShow(showId, scope, async (progress) => {
          send({ type: "progress", ...progress });
        });
        send({ type: "done", ...summary });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Bulk reminder run failed."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
