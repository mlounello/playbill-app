import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ProgramPage } from "@/lib/programs";

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizePage(page: ProgramPage) {
  if (page.type === "poster") {
    return page.subtitle || "Poster page";
  }
  if (page.type === "text") {
    return stripHtml(page.body);
  }
  if (page.type === "stacked") {
    return page.sections
      .map((section) => `${section.title ? `${section.title}: ` : ""}${stripHtml(section.body)}`)
      .join(" | ");
  }
  if (page.type === "image") {
    return "Image page";
  }
  if (page.type === "photo_grid") {
    return `${page.photos.length} photos`;
  }
  if (page.type === "bios") {
    return `${page.people.length} bios`;
  }
  return stripHtml(page.body);
}

export async function generateProofPdf(params: { title: string; pages: ProgramPage[] }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 396; // 5.5in
  const height = 612; // 8.5in
  const margin = 36;

  params.pages.forEach((item, index) => {
    const page = pdf.addPage([width, height]);
    page.drawText(params.title, {
      x: margin,
      y: height - margin,
      size: 12,
      font: bold,
      color: rgb(0.0, 0.42, 0.33)
    });
    page.drawText(item.title, {
      x: margin,
      y: height - margin - 24,
      size: 11,
      font: bold,
      color: rgb(0, 0, 0)
    });

    const summary = summarizePage(item);
    page.drawText(summary.slice(0, 1200) || "No content.", {
      x: margin,
      y: height - margin - 52,
      size: 10,
      font: regular,
      color: rgb(0, 0, 0),
      maxWidth: width - margin * 2,
      lineHeight: 13
    });

    if (index !== 0 && index !== params.pages.length - 1) {
      page.drawText(String(index + 1), {
        x: width / 2 - 4,
        y: 18,
        size: 9,
        font: regular
      });
    }
  });

  return pdf.save();
}

export async function generatePrintImposedPdf(params: {
  title: string;
  spreads: Array<{
    sheet: number;
    side: "front" | "back";
    left: { pageNumber: number; content: ProgramPage };
    right: { pageNumber: number; content: ProgramPage };
  }>;
}) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 792; // 11in landscape
  const height = 612; // 8.5in
  const gutterX = width / 2;
  const margin = 24;

  params.spreads.forEach((spread) => {
    const page = pdf.addPage([width, height]);

    page.drawLine({
      start: { x: gutterX, y: margin },
      end: { x: gutterX, y: height - margin },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });

    page.drawText(`${params.title} • Sheet ${spread.sheet} ${spread.side}`, {
      x: margin,
      y: height - margin,
      size: 10,
      font: bold
    });

    page.drawText(`Left p.${spread.left.pageNumber}: ${spread.left.content.title}`, {
      x: margin,
      y: height - margin - 24,
      size: 9,
      font: regular
    });
    page.drawText(summarizePage(spread.left.content).slice(0, 350) || "No content.", {
      x: margin,
      y: height - margin - 42,
      size: 8,
      font: regular,
      maxWidth: gutterX - margin * 2,
      lineHeight: 11
    });

    const rightX = gutterX + margin;
    page.drawText(`Right p.${spread.right.pageNumber}: ${spread.right.content.title}`, {
      x: rightX,
      y: height - margin - 24,
      size: 9,
      font: regular
    });
    page.drawText(summarizePage(spread.right.content).slice(0, 350) || "No content.", {
      x: rightX,
      y: height - margin - 42,
      size: 8,
      font: regular,
      maxWidth: gutterX - margin * 2,
      lineHeight: 11
    });
  });

  return pdf.save();
}

export async function renderProgramPdfWithPlaywright(params: {
  origin: string;
  programSlug: string;
  exportType: "proof" | "print";
}) {
  const targetPath =
    params.exportType === "print"
      ? `/programs/${params.programSlug}?view=booklet&export=1`
      : `/programs/${params.programSlug}?export=1`;
  const targetUrl = `${params.origin}${targetPath}`;

  const launchBrowser = async () => {
    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      const playwrightCore = await import("playwright-core");
      const chromium = await import("@sparticuz/chromium");
      const executablePath = await chromium.default.executablePath();
      return playwrightCore.chromium.launch({
        executablePath,
        headless: true,
        args: [...chromium.default.args, "--disable-dev-shm-usage"]
      });
    }

    const playwright = await import("playwright");
    return playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
  };

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewportSize(
      params.exportType === "print" ? { width: 1600, height: 1200 } : { width: 1200, height: 1600 }
    );
    page.on("pageerror", (error) => {
      console.warn("[playbill-export] Page error during PDF render", {
        exportType: params.exportType,
        targetPath,
        error: error.message
      });
    });
    page.on("requestfailed", (request) => {
      console.warn("[playbill-export] Asset request failed during PDF render", {
        exportType: params.exportType,
        targetPath,
        url: request.url(),
        error: request.failure()?.errorText ?? "request_failed"
      });
    });

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
      console.warn("[playbill-export] Network idle wait timed out", {
        exportType: params.exportType,
        targetPath
      });
    });
    await page.waitForFunction(
      (exportType) =>
        exportType === "print"
          ? Boolean(document.querySelector(".print-booklet .sheet-grid"))
          : Boolean(document.querySelector(".print-proof .export-sequence-item, .print-proof .sequence-item")),
      params.exportType,
      { timeout: 30_000 }
    );
    await page.evaluate(async () => {
      const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
      if (fonts?.ready) {
        await fonts.ready;
      }
      const images = Array.from(document.images);
      await Promise.all(
        images.map((image) => {
          if (image.complete) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const done = () => resolve();
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
            window.setTimeout(done, 10_000);
          });
        })
      );
    });
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(250);

    const pdf = await page.pdf(
      params.exportType === "print"
        ? {
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
            scale: 1
          }
        : {
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
            scale: 1
          }
    );

    return new Uint8Array(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : "playwright_render_failed";
    throw new Error(`[${params.exportType}] ${targetPath} :: ${message}`);
  } finally {
    await browser.close();
  }
}
