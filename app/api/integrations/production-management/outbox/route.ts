import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasIntegrationSecret } from "@/lib/integration-auth";
import { requestProductionManagementOutboxDrain } from "@/lib/integration-outbox";
import { APP_SCHEMA, getSupabaseWriteClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasIntegrationSecret(request, process.env.PM_TO_PLAYBILL_INTEGRATION_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const worker = `playbill:${randomUUID()}`;
  const client = getSupabaseWriteClient();
  const { data, error } = await client.schema(APP_SCHEMA).rpc(
    "process_production_management_publicity_events",
    { worker_name: worker, batch_limit: 20 },
  );
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const returnDrain = await requestProductionManagementOutboxDrain();
  const metrics = await client.schema("core").rpc("capture_phase8_metrics");
  return NextResponse.json({
    ok: true,
    result: data,
    returnDrain,
    metrics: metrics.error ? null : metrics.data,
  });
}
