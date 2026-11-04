import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const source = readFileSync(new URL("../lib/songs.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const songs = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const bookletSource = readFileSync(new URL("../lib/booklet.ts", import.meta.url), "utf8");
const bookletJs = ts.transpileModule(bookletSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const booklet = await import(`data:text/javascript;base64,${Buffer.from(bookletJs).toString("base64")}`);
const cast = [
  { id: "roger", person_id: "p-roger", role_title: "Roger Davis", full_name: "Roger Performer", short_name: "Roger" },
  { id: "mark", person_id: "p-mark", role_title: "Mark Cohen", full_name: "Mark Performer" }
];
const credit = (kind, values = {}) => ({ id: "credit", kind, roleId: "", personId: "", label: "", displayName: "", ...values });
const sample = [
  { id: "tune", act: "ACT I", title: "Tune Up/Voicemail #1", singer_role_ids: ["roger", "mark"], include_company: true },
  { id: "vie", act: "ACT I", title: "La Vie Boheme/I Should Tell You", credits: [credit("role", { roleId: "mark" }), credit("custom", { label: "Waiter", personId: "p-roger" }), credit("group", { label: "Ensemble" })] },
  { id: "year", act: "ACT II", title: "Happy New Year/Voicemail #3", singerIds: ["p-mark"] },
  { id: "cover", act: "ACT II", title: "I'll Cover You: Reprise", credits: [] }
];
const resolve = (value = sample) => songs.resolveSongs(songs.normalizeSongRows(value), cast, { mark: "Mark" });

test("legacy camelCase and snake_case assignments survive normalization and JSON roundtrips", () => {
  const rows = songs.normalizeSongRows(sample);
  assert.deepEqual(rows[0].singerRoleIds, ["roger", "mark"]);
  assert.equal(rows[0].includeCompany, true);
  assert.deepEqual(songs.normalizeSongRows(JSON.parse(JSON.stringify(rows))), rows);
  assert.deepEqual(resolve()[0].credits, ["Roger", "Mark", "Company"]);
  assert.deepEqual(resolve()[2].credits, ["Mark"]);
});

test("the actual server settings normalizer preserves role and custom credit data", () => {
  const src = readFileSync(new URL("../lib/shows.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("shows.ts", src, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && ["normalizeModuleSettings", "normalizeModuleType"].includes(node.name?.text));
  const context = { normalizeSongRows: songs.normalizeSongRows, normalizeSongShortNames: songs.normalizeSongShortNames };
  vm.runInNewContext(ts.transpileModule(selected.map((node) => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const saved = context.normalizeModuleSettings({ songs: sample, songs_layout: "two_columns", song_character_names: { mark: "Mark" } }, "songs");
  assert.deepEqual(saved.songs[0].singerRoleIds, ["roger", "mark"]);
  assert.equal(saved.songs[1].credits[1].personId, "p-roger");
  assert.equal(saved.songs_layout, "two_columns");
});

test("song override wins over a reusable short name, existing short name, and full name", () => {
  const row = [{ title: "Test", credits: [credit("role", { roleId: "roger", displayName: "A Waiter" }), credit("role", { roleId: "roger" }), credit("role", { roleId: "mark" })] }];
  assert.deepEqual(resolve(row)[0].credits, ["A Waiter", "Roger", "Mark"]);
  assert.deepEqual(songs.resolveSongs(songs.normalizeSongRows(row), cast, { roger: "R" })[0].credits, ["A Waiter", "R", "Mark Cohen"]);
  assert.equal(cast[0].role_title, "Roger Davis");
});

test("mixed credits preserve order, custom performer links, and blank instrumental credits", () => {
  assert.deepEqual(resolve()[1].credits, ["Mark", "Waiter", "Ensemble"]);
  assert.deepEqual(resolve()[3].credits, []);
  const normalized = songs.normalizeSongRows(sample);
  normalized[1].credits.reverse();
  assert.deepEqual(songs.resolveSongs(normalized, cast, { mark: "Mark" })[1].credits, ["Ensemble", "Waiter", "Mark"]);
  assert.deepEqual(songs.normalizeSongRows([{ ...sample[0], credits: [] }])[0].singerRoleIds, []);
});

test("new performer credits print their name while legacy credits retain character names", () => {
  const row = [{ title: "Duet", credits: [credit("person", { personId: "p-roger" }), credit("person", { personId: "p-mark", useCharacterName: true })] }];
  assert.deepEqual(resolve(row)[0].credits, ["Roger Performer", "Mark"]);
});

test("two columns keep their act slots through independently paginated continuations", () => {
  const long = [...Array.from({ length: 40 }, (_, i) => ({ title: `Act one number ${i}`, act: "ACT I" })), sample[3]];
  const pages = songs.paginateSongs(resolve(long), { idBase: "rent", title: "Songs", twoColumns: true });
  assert.ok(pages.length > 1);
  assert.equal(pages[0].columns[1].title, "ACT II");
  assert.equal(pages[1].columns[1], null);
  assert.equal(pages[1].columns[0].continued, true);
  assert.equal(pages.flatMap((p) => p.columns.flatMap((a) => a?.songs ?? [])).length, 41);
});

test("one-act productions use the full width and empty song lists render no pages", () => {
  assert.equal(songs.paginateSongs(resolve([sample[0]]), { idBase: "one", title: "Songs", twoColumns: true })[0].columns.length, 1);
  assert.deepEqual(songs.paginateSongs([], { idBase: "empty", title: "", twoColumns: true }), []);
});

test("missing assignments and a single oversized song produce explicit warnings", () => {
  const rows = resolve([{ title: "Long song", credits: [credit("role", { roleId: "removed" }), credit("custom", { label: "Ensemble ".repeat(800) })] }]);
  const pages = songs.paginateSongs(rows, { idBase: "long", title: "", twoColumns: false });
  assert.ok(pages[0].warnings.some((warning) => warning.includes("too long")));
  assert.ok(pages[0].warnings.some((warning) => warning.includes("missing character")));
});

test("titles and custom labels are escaped when rendering", () => {
  const html = songs.renderSongPageHtml(songs.paginateSongs(resolve([{ title: "<script>alert(1)</script>", credits: [credit("custom", { label: "<img src=x onerror=alert(1)>" })] }]), { idBase: "safe", title: "<b>Acts</b>", twoColumns: false })[0]);
  assert.doesNotMatch(html, /<script>|<img|<b>/);
  assert.match(html, /&lt;script&gt;/);
});

test("RENT wraps and paginates within booklet margins in browser and PDF", async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const longRows = Array.from({ length: 32 }, (_, i) => ({ ...sample[i % 4], id: `song-${i}`, act: i < 23 ? "ACT I" : "ACT II", credits: [credit("custom", { label: "Roger, Mark, Joanne, Maureen, Collins, Angel, Benny, Street Vendors and Homeless Ensemble" })] }));
    for (const twoColumns of [false, true]) {
      const resolved = resolve(longRows);
      await page.setContent(`<style>${css}${songs.SONG_PAGE_CSS}</style>${songs.buildSongMeasurementHtml(resolved, "Musical Numbers", twoColumns)}`);
      await page.evaluate(() => document.fonts.ready);
      const measured = await page.evaluate(`(${songs.readSongMeasurements.toString()})(document)`);
      const pages = songs.paginateSongs(resolved, { idBase: "rent", title: "Musical Numbers", twoColumns }, measured);
      const html = pages.map((p) => `<article class="booklet-page songs-print-page">${songs.renderSongPageHtml(p)}</article>`).join("");
      await page.setContent(`<style>${css}${songs.SONG_PAGE_CSS}</style>${html}`);
      await page.evaluate(() => document.fonts.ready);
      const failures = await page.locator(".songs-print-page").evaluateAll((articles) => articles.flatMap((article, index) => {
        const rect = article.getBoundingClientRect(), styles = getComputedStyle(article);
        const bottom = rect.bottom - parseFloat(styles.paddingBottom), right = rect.right - parseFloat(styles.paddingRight);
        return [...article.querySelectorAll(".song-entry")].some((row) => row.getBoundingClientRect().bottom > bottom + 1 || row.getBoundingClientRect().right > right + 1 || row.scrollWidth > row.clientWidth + 1) ? [index] : [];
      }));
      assert.deepEqual(failures, [], "Every title and credit must fit within the printable content area");
      if (twoColumns) {
        const tops = await page.locator(".songs-print-page").first().locator(".songs-act-title").evaluateAll((heads) => heads.map((head) => head.getBoundingClientRect().top));
        assert.equal(tops[0], tops[1]);
        await page.screenshot({ path: "/tmp/rent-songs-preview.png", fullPage: false });
      }
      const bytes = await page.pdf({ width: "5.5in", height: "8.5in", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), pages.length);
      assert.equal(pdf.getPages()[0].getWidth(), 396);
      assert.equal(pdf.getPages()[0].getHeight(), 612);
      const padded = booklet.padToMultipleOf4(pages, (index) => ({ id: `blank-${index}`, type: "filler" }));
      const spreads = booklet.buildBookletSpreads(padded);
      const render = (p) => `<article class="booklet-page songs-print-page">${p.type === "songs" ? songs.renderSongPageHtml(p) : ""}</article>`;
      const sheets = spreads.map((spread) => `<div class="sheet"><div class="sheet-grid"><div>${render(spread.left.content)}</div><div>${render(spread.right.content)}</div></div></div>`).join("");
      await page.setContent(`<style>${css}${songs.SONG_PAGE_CSS}</style><body class="print-booklet"><section class="booklet-sheets">${sheets}</section></body>`);
      await page.evaluate(() => document.fonts.ready);
      const printBytes = await page.pdf({ width: "11in", height: "8.5in", preferCSSPageSize: true, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
      const printPdf = await PDFDocument.load(printBytes);
      assert.equal(printPdf.getPageCount(), spreads.length);
      assert.equal(printPdf.getPages()[0].getWidth(), 792);
      assert.equal(printPdf.getPages()[0].getHeight(), 612);
    }
  } finally {
    await browser.close();
  }
});
