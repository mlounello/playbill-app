import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const source = readFileSync(new URL("../lib/programs.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("programs.ts", source, ts.ScriptTarget.Latest, true);
const names = new Set([
  "escapeHtml", "buildCategoryRoleListHtml", "countTag", "isBillingStyledPage", "isStackablePage",
  "estimateStackUnits", "getBillingStackBudget", "paginateRoleListPages", "splitRoleListForBudget", "getStackPageBudget",
  "getModulePlacementMode", "moduleDefaultPlacementMode", "normalizeModuleType", "buildRenderablePagesFromModules"
]);
const selected = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(selected.length, names.size);
const compiled = ts.transpileModule(selected.map((node) => node.getText(ast)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const context = {
  richTextHasContent: (html) => Boolean(html),
  async renderModulePages(module, index, ...args) {
    return context.paginateRoleListPages(module.id, module.display_title, module.rows, true, args.at(-1), module.settings.role_list_grouping_enabled !== false);
  }
};
vm.runInNewContext(compiled, context);
const rows = (count) => Array.from({ length: count }, (_, i) => ({ role: `Assistant Production Electrician ${i + 1}`, name: `Contributor ${i + 1}` }));
const moduleFor = (id, count, order = 0) => ({
  id, module_type: "production_team", display_title: id, module_order: order, visible: true,
  settings: { role_list_grouping_enabled: true }, rows: rows(count)
});
const pack = (modules, density = "normal") => context.buildRenderablePagesFromModules({ custom_pages: [] }, [], [], [], [], modules, density);

test("long team lists split into intact rows with continuation headings", () => {
  for (const density of ["compact", "normal", "loose"]) {
    const pages = context.paginateRoleListPages("production", "Production Team", rows(75), true, density);
    assert.ok(pages.length >= 2);
    assert.equal(pages.reduce((sum, page) => sum + (page.body.match(/<li /g) ?? []).length, 0), 75);
    assert.match(pages[1].body, /Production Team \(cont\.\)/);
    for (const page of pages) assert.ok(context.estimateStackUnits(page) <= context.getBillingStackBudget(density));
  }
});

test("creative and production teams do not combine onto an overflowing page", async () => {
  const pages = await pack([moduleFor("Creative Team", 15), moduleFor("Production Team", 28, 1)]);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].type, "stacked");
  assert.match(pages[0].sections[1].body, /Production Team/);
  assert.match(pages[1].body, /Production Team \(cont\.\)/);
});

test("cast and teams flow across two pages instead of reserving one page per section", async () => {
  const pages = await pack([moduleFor("Cast", 31), moduleFor("Creative Team", 15, 1), moduleFor("Production Team", 28, 2)]);
  assert.equal(pages.length, 2);
  const bodies = pages.flatMap((p) => p.type === "stacked" ? p.sections.map((s) => s.body) : [p.body]);
  assert.equal(bodies.reduce((sum, body) => sum + (body.match(/<li /g) ?? []).length, 0), 74);
  assert.ok(bodies.some((body) => body.includes("Creative Team (cont.)")));
});

test("explicitly disabling page sharing keeps sections separate", async () => {
  const isolated = moduleFor("Production Team", 5, 1);
  isolated.settings.role_list_grouping_enabled = false;
  const pages = await pack([moduleFor("Creative Team", 5), isolated]);
  assert.equal(pages.length, 2);
});

test("short team lists can still share a page", async () => {
  const pages = await pack([moduleFor("Creative Team", 5), moduleFor("Production Team", 7, 1)]);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].type, "stacked");
});

test("packed and continuation pages fit the real booklet CSS in Chromium", async () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    for (const modules of [
      [moduleFor("Creative Team", 15), moduleFor("Production Team", 28, 1)],
      [moduleFor("Production Team", 75)],
      [moduleFor("Creative Team", 5), moduleFor("Production Team", 7, 1)],
      [moduleFor("Cast", 31), moduleFor("Creative Team", 15, 1), moduleFor("Production Team", 28, 2)]
    ]) {
      const pages = await pack(modules);
      const body = pages.map((p) => p.type === "stacked"
        ? `<article class="booklet-page"><div class="stacked-sections">${p.sections.map((s) => `<section class="stacked-section"><div class="page-body rich-render">${s.body}</div></section>`).join("")}</div></article>`
        : `<article class="booklet-page"><h2 class="section-title playbill-title"></h2><div class="page-body rich-render">${p.body}</div></article>`).join("");
      await page.setContent(`<html><head><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.locator(".booklet-page").evaluateAll((pages) => pages.flatMap((p, index) => {
        const bottom = p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom) - 1;
        return [...p.querySelectorAll(".billing-item")].some((row) => row.getBoundingClientRect().bottom > bottom + 1) ? [index] : [];
      }));
      assert.deepEqual(overflow, [], "No team rows should cross the page's bottom margin");
      if (modules.length === 3) {
        await page.screenshot({ path: "/tmp/playbill-flowing-teams.png", fullPage: true });
        const bytes = await page.pdf({ width: "5.5in", height: "8.5in", margin: { top: 0, bottom: 0, left: 0, right: 0 } });
        const pdf = await PDFDocument.load(bytes);
        assert.equal(pdf.getPageCount(), 2);
        assert.equal(pdf.getPages()[0].getWidth(), 396);
        assert.equal(pdf.getPages()[0].getHeight(), 612);
      }
    }
  } finally {
    await browser.close();
  }
});
