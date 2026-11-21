import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reminders = readFileSync(new URL("../lib/reminders.ts", import.meta.url), "utf8");

test("published shows are excluded from the automatic reminder query", () => {
  assert.match(reminders, /\.eq\("is_published", false\)/);
});

test("manual and automatic reminder runs stop for a published show", () => {
  assert.match(reminders, /if \(context\.isPublished\) \{\s*return \{ sent: 0, total: 0 \};\s*\}/);
});
