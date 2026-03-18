import type { ProgramPage } from "@/lib/programs";
import { generatePrintImposedPdf, generateProofPdf, renderProgramPdfWithPlaywright } from "@/lib/export-pdf";

type ExportType = "proof" | "print";

type ProgramSpread = {
  sheet: number;
  side: "front" | "back";
  left: { pageNumber: number; content: ProgramPage };
  right: { pageNumber: number; content: ProgramPage };
};

export type ProgramExportPayload = {
  title: string;
  slug: string;
  pageSequence: ProgramPage[];
  paddedPages: ProgramPage[];
  bookletSpreads: ProgramSpread[];
  paddingNeeded: number;
  previewExportParityOk: boolean;
};

type ExportCacheEntry = {
  bytes: Uint8Array;
  renderer: "playwright" | "fallback";
  fallbackReason: string;
  cachedAt: number;
};

type ExportCacheStore = Map<string, ExportCacheEntry>;

const EXPORT_CACHE_TTL_MS = 5 * 60 * 1000;
const EXPORT_RETRY_DELAYS_MS = [250, 650] as const;

function getCacheStore(): ExportCacheStore {
  const g = globalThis as typeof globalThis & { __playbillExportCache?: ExportCacheStore };
  if (!g.__playbillExportCache) {
    g.__playbillExportCache = new Map<string, ExportCacheEntry>();
  }
  return g.__playbillExportCache;
}

function getCachedExport(cacheKey: string) {
  const cache = getCacheStore();
  const cached = cache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.cachedAt > EXPORT_CACHE_TTL_MS) {
    cache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedExport(cacheKey: string, value: Omit<ExportCacheEntry, "cachedAt">) {
  const cache = getCacheStore();
  cache.set(cacheKey, {
    ...value,
    cachedAt: Date.now()
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRenderTargetPath(programSlug: string, exportType: ExportType) {
  return exportType === "print" ? `/programs/${programSlug}?view=booklet&export=1` : `/programs/${programSlug}?export=1`;
}

export async function generateExportBinary(params: {
  cacheKey: string;
  origin: string;
  programSlug: string;
  exportType: ExportType;
  program: ProgramExportPayload;
}) {
  const renderTargetPath = buildRenderTargetPath(params.programSlug, params.exportType);
  const cached = getCachedExport(params.cacheKey);
  if (cached) {
    return {
      bytes: cached.bytes,
      renderer: cached.renderer,
      fallbackReason: cached.fallbackReason,
      cacheHit: true,
      renderTargetPath
    };
  }

  let renderer: "playwright" | "fallback" = "playwright";
  let fallbackReason = "";

  for (let attempt = 0; attempt < EXPORT_RETRY_DELAYS_MS.length + 1; attempt += 1) {
    try {
      const bytes = await renderProgramPdfWithPlaywright({
        origin: params.origin,
        programSlug: params.programSlug,
        exportType: params.exportType
      });
      setCachedExport(params.cacheKey, { bytes, renderer: "playwright", fallbackReason: "" });
      return {
        bytes,
        renderer: "playwright" as const,
        fallbackReason: "",
        cacheHit: false,
        renderTargetPath
      };
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "playwright_failed";
      console.warn("[playbill-export] Playwright render failed", {
        exportType: params.exportType,
        targetPath: renderTargetPath,
        attempt: attempt + 1,
        maxAttempts: EXPORT_RETRY_DELAYS_MS.length + 1,
        error: fallbackReason
      });
      const delay = EXPORT_RETRY_DELAYS_MS[attempt];
      if (delay) {
        await wait(delay);
        continue;
      }
    }
  }

  renderer = "fallback";
  const fallbackBytes =
    params.exportType === "print"
      ? await generatePrintImposedPdf({ title: params.program.title, spreads: params.program.bookletSpreads })
      : await generateProofPdf({ title: params.program.title, pages: params.program.pageSequence });

  setCachedExport(params.cacheKey, {
    bytes: fallbackBytes,
    renderer,
    fallbackReason
  });

  return {
    bytes: fallbackBytes,
    renderer,
    fallbackReason,
    cacheHit: false,
    renderTargetPath
  };
}

export function buildExportPageMap(program: ProgramExportPayload, exportType: ExportType) {
  const paddedIndex = new Map<string, number>();
  program.paddedPages.forEach((page, index) => {
    paddedIndex.set(String(page.id), index + 1);
  });

  const spreadsBySheet = new Map<
    number,
    {
      sheet: number;
      front: {
        leftPage: number;
        rightPage: number;
        leftTitle: string;
        rightTitle: string;
        leftType: string;
        rightType: string;
      } | null;
      back: {
        leftPage: number;
        rightPage: number;
        leftTitle: string;
        rightTitle: string;
        leftType: string;
        rightType: string;
      } | null;
    }
  >();

  for (const spread of program.bookletSpreads) {
    const row = spreadsBySheet.get(spread.sheet) ?? { sheet: spread.sheet, front: null, back: null };
    const sideData = {
      leftPage: spread.left.pageNumber,
      rightPage: spread.right.pageNumber,
      leftTitle: spread.left.content.title || "(untitled)",
      rightTitle: spread.right.content.title || "(untitled)",
      leftType: spread.left.content.type,
      rightType: spread.right.content.type
    };
    if (spread.side === "front") {
      row.front = sideData;
    } else {
      row.back = sideData;
    }
    spreadsBySheet.set(spread.sheet, row);
  }

  return {
    generated_at: new Date().toISOString(),
    export_type: exportType,
    page_count: program.pageSequence.length,
    padded_page_count: program.paddedPages.length,
    blank_padding_pages: Math.max(0, program.paddedPages.length - program.pageSequence.length),
    preview_export_parity_ok: program.previewExportParityOk,
    reader_order: program.paddedPages.map((page, index) => ({
      padded_page_number: index + 1,
      source_page_number: paddedIndex.get(String(page.id)) ?? index + 1,
      page_id: String(page.id),
      page_type: page.type,
      title: page.title || "(untitled)",
      is_padding: page.type === "filler" && !(page.title || "").trim() && !("body" in page && String(page.body ?? "").trim())
    })),
    imposition_by_sheet: [...spreadsBySheet.values()].sort((a, b) => a.sheet - b.sheet)
  };
}

function escCsv(value: string | number | boolean) {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function toPageMapCsv(pageMap: ReturnType<typeof buildExportPageMap>) {
  const lines: string[] = [];
  lines.push([
    "sheet",
    "side",
    "left_page",
    "left_title",
    "left_type",
    "right_page",
    "right_title",
    "right_type"
  ].join(","));

  for (const row of pageMap.imposition_by_sheet) {
    if (row.front) {
      lines.push([
        row.sheet,
        "front",
        row.front.leftPage,
        row.front.leftTitle,
        row.front.leftType,
        row.front.rightPage,
        row.front.rightTitle,
        row.front.rightType
      ].map(escCsv).join(","));
    }
    if (row.back) {
      lines.push([
        row.sheet,
        "back",
        row.back.leftPage,
        row.back.leftTitle,
        row.back.leftType,
        row.back.rightPage,
        row.back.rightTitle,
        row.back.rightType
      ].map(escCsv).join(","));
    }
  }

  return lines.join("\n");
}
