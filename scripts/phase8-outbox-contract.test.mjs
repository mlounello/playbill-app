import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/integrations/production-management/outbox/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../db/phase19_integration_outbox_preview.sql", import.meta.url), "utf8");

test("Playbill accepts only the Production Management direction secret", () => {
  assert.match(route, /PM_TO_PLAYBILL_INTEGRATION_SECRET/);
  assert.match(route, /process_production_management_publicity_events/);
  assert.match(route, /requestProductionManagementOutboxDrain/);
});

test("Preview queues Playbill changes while preserving the legacy trigger for rollback", () => {
  assert.match(migration, /queue_publicity_to_production_management/);
  assert.doesNotMatch(migration, /drop trigger if exists sync_publicity_to_production_management/);
  assert.match(migration, /core\.enqueue_integration_event/);
});
