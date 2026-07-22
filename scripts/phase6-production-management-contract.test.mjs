import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../db/phase18_production_management_read_contract.sql", import.meta.url), "utf8");

test("Production Management receives only the show and role catalog it needs", () => {
  assert.match(migration, /production_management_shows/);
  assert.match(migration, /production_management_show_roles/);
  assert.doesNotMatch(migration, /auth\.users|app_playbill\.contributors|tax|vendor|address/i);
});

test("the read contract is service-role-only", () => {
  assert.match(migration, /revoke all on function app_playbill\.production_management_shows\(uuid\)[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function app_playbill\.production_management_shows\(uuid\) to service_role/);
  assert.match(migration, /revoke all on function app_playbill\.production_management_show_roles\(uuid, uuid\)[\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function app_playbill\.production_management_show_roles\(uuid, uuid\) to service_role/);
});

