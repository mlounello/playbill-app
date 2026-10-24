import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../lib/submissions.ts", import.meta.url), "utf8");
const start = source.indexOf("export async function adminRestoreBioFromHistory(");
const end = source.indexOf("export async function adminReturnSubmission(", start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function setup({ status = "submitted", entry, permissionError = false } = {}) {
  const writes = [];
  const filters = [];
  const current = {
    task_id: "bio-request",
    person: { id: "hassan", submission_type: "bio", bio: "", no_bio: true, submission_status: status, headshot_url: "existing-headshot" }
  };
  const query = {
    select() { return this; },
    eq(...args) { filters.push(args); return this; },
    async maybeSingle() {
      return { data: entry === undefined ? { before_value: "<p>Complete previous bio.</p>", after_value: "", changed_at: "2026-10-24" } : entry, error: null };
    }
  };
  const context = {
    exports: {}, z,
    APP_SCHEMA: "app_playbill",
    NO_BIO_PLACEHOLDER: "<p><em>No biography provided.</em></p>",
    async requireRole(roles) {
      assert.deepEqual(Array.from(roles), ["owner", "admin", "editor"]);
      if (permissionError) throw new Error("Access denied");
    },
    getShowSubmissionByPerson: async () => current,
    getSupabaseWriteClient: () => ({ schema: () => ({ from: () => query }) }),
    sanitizeRichText: (value) => value,
    stripRichTextToPlain: (value) => value.replace(/<[^>]+>/g, ""),
    updateSubmissionCore: async (args) => { writes.push(args); return { ok: true }; },
    withError: (_path, message) => { throw new Error(message); },
    redirect: (path) => { throw new Error(`redirect:${path}`); }
  };
  vm.runInNewContext(compiled, context);
  const form = new FormData();
  form.set("auditId", "af791dd1-62ea-4e1f-a0d7-337f3076fa30");
  form.set("version", "before");
  form.set("expectedBio", "");
  form.set("expectedStatus", status);
  form.set("expectedNoBio", "true");
  return { run: () => context.exports.adminRestoreBioFromHistory("rent", "bio-request", form), form, writes, filters };
}

test("restores full stored text, clears no-bio, preserves status/headshot, and audits its source", async () => {
  const s = setup();
  await assert.rejects(s.run, /restored=1/);
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].bio, "<p>Complete previous bio.</p>");
  assert.equal(s.writes[0].skipBio, false);
  assert.equal(s.writes[0].headshotUrl, "existing-headshot");
  assert.equal(s.writes[0].status, "submitted");
  assert.match(s.writes[0].reason, /Restored before bio from audit/);
  assert.deepEqual(s.filters, [["id", s.form.get("auditId")], ["entity", "people"], ["entity_id", "hassan"], ["field", "bio"]]);
});

test("can restore the saved after version", async () => {
  const s = setup({ entry: { before_value: "old", after_value: "saved bio", changed_at: "2026-10-24" } });
  s.form.set("version", "after");
  await assert.rejects(s.run, /restored=1/);
  assert.equal(s.writes[0].bio, "saved bio");
});

test("rejects locked submissions and stale pages without writing", async () => {
  for (const s of [setup({ status: "locked" }), setup()]) {
    s.form.set("expectedBio", "stale page copy");
    await assert.rejects(s.run, /locked|changed since/);
    assert.equal(s.writes.length, 0);
  }
});

test("rejects missing, empty, and placeholder history versions", async () => {
  for (const entry of [null, { before_value: "" }, { before_value: "<p><em>No biography provided.</em></p>" }]) {
    const s = setup({ entry });
    await assert.rejects(s.run, /could not be loaded|does not contain a bio/);
    assert.equal(s.writes.length, 0);
  }
});

test("requires staff access before reading history", async () => {
  const s = setup({ permissionError: true });
  await assert.rejects(s.run, /Access denied/);
  assert.equal(s.filters.length, 0);
  assert.equal(s.writes.length, 0);
});

test("rejects invalid history ids and versions", async () => {
  for (const [key, value] of [["auditId", "invalid"], ["version", "other"]]) {
    const s = setup();
    s.form.set(key, value);
    await assert.rejects(s.run, /Choose a bio version/);
    assert.equal(s.writes.length, 0);
  }
});
