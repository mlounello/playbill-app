"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeRichText } from "@/lib/rich-text";
import type { ProgramPage } from "@/lib/programs";

function PublicRenderPage({ page }: { page: ProgramPage }) {
  if (page.type === "poster") {
    return (
      <article className="booklet-page poster-page">
        <img src={page.imageUrl} alt={page.title} className="poster-image" />
      </article>
    );
  }

  if (page.type === "text") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.body) }} />
      </article>
    );
  }

  if (page.type === "stacked") {
    return (
      <article className="booklet-page">
        <div className="stacked-sections">
          {page.sections.map((section, index) => (
            <section key={`${page.id}-${index}`} className="stacked-section">
              {section.title.trim() ? <h3 className="playbill-title stacked-section-title">{section.title}</h3> : null}
              <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.body) }} />
            </section>
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "image") {
    return (
      <article className="booklet-page image-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <img src={page.imageUrl} alt={page.title} className="full-page-image" />
      </article>
    );
  }

  if (page.type === "photo_grid") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="photo-grid">
          {page.photos.map((photo, index) => (
            <img key={`${photo}-${index}`} src={photo} alt={`${page.title} ${index + 1}`} className="photo-grid-item" />
          ))}
        </div>
      </article>
    );
  }

  if (page.type === "bios") {
    return (
      <article className="booklet-page">
        <h2 className="section-title playbill-title">{page.title}</h2>
        <div className="bios-list">
          {page.people.map((person) => (
            <section key={person.id} className="bio-row">
              {person.headshot_url ? <img src={person.headshot_url} alt={person.full_name} className="headshot" /> : null}
              <div>
                <div className="bio-name">
                  {person.full_name}
                  {person.role_title?.trim() ? <span className="bio-role-inline"> ({person.role_title})</span> : null}
                </div>
                <div className="page-body rich-render bio-body" dangerouslySetInnerHTML={{ __html: sanitizeRichText(person.bio) }} />
              </div>
            </section>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className="booklet-page">
      <h2 className="section-title playbill-title">{page.title}</h2>
      <div className="page-body rich-render" dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.body) }} />
    </article>
  );
}

export function PublicProgramViewer({
  pages,
  showSlug,
  programSlug
}: {
  pages: ProgramPage[];
  showSlug: string;
  programSlug: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [flipDirection, setFlipDirection] = useState<"forward" | "backward">("forward");
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(() => {
    const items: Array<{
      kind: "single" | "spread";
      left: ProgramPage;
      right: ProgramPage | null;
      startPage: number;
      endPage: number;
    }> = [];
    if (pages.length === 0) {
      return items;
    }
    if (pages.length === 1) {
      items.push({
        kind: "single",
        left: pages[0],
        right: null,
        startPage: 1,
        endPage: 1
      });
      return items;
    }

    // Cover starts as a single page.
    items.push({
      kind: "single",
      left: pages[0],
      right: null,
      startPage: 1,
      endPage: 1
    });

    // Middle pages render as spreads.
    const middleStart = 1;
    const middleEnd = pages.length - 2;
    for (let i = middleStart; i <= middleEnd; i += 2) {
      const left = pages[i];
      const right = i + 1 <= middleEnd ? pages[i + 1] : null;
      items.push({
        kind: right ? "spread" : "single",
        left,
        right,
        startPage: i + 1,
        endPage: right ? i + 2 : i + 1
      });
    }

    // Back cover ends as a single page.
    items.push({
      kind: "single",
      left: pages[pages.length - 1],
      right: null,
      startPage: pages.length,
      endPage: pages.length
    });
    return items;
  }, [pages]);

  const pageToStep = useMemo(() => {
    const map = new Map<number, number>();
    steps.forEach((step, index) => {
      for (let pageNumber = step.startPage; pageNumber <= step.endPage; pageNumber += 1) {
        map.set(pageNumber, index);
      }
    });
    return map;
  }, [steps]);

  const toc = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ title: string; page: number; step: number }> = [];
    pages.forEach((page, idx) => {
      const pageNumber = idx + 1;
      const title = page.title?.trim() || `Page ${pageNumber}`;
      if (!seen.has(title)) {
        seen.add(title);
        rows.push({ title, page: pageNumber, step: pageToStep.get(pageNumber) ?? 0 });
      }
    });
    return rows;
  }, [pageToStep, pages]);

  const current = steps[stepIndex] ?? null;

  useEffect(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `Viewing page view ${stepIndex + 1} of ${steps.length}.`;
    }
  }, [stepIndex, steps.length]);

  const goToStep = (targetStep: number) => {
    const bounded = Math.max(0, Math.min(steps.length - 1, targetStep));
    if (bounded === stepIndex) return;
    setFlipDirection(bounded > stepIndex ? "forward" : "backward");
    setStepIndex(bounded);
  };

  const goPrev = () => goToStep(stepIndex - 1);
  const goNext = () => goToStep(stepIndex + 1);

  return (
    <section
      className="card-list"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goPrev();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          goNext();
        }
      }}
      tabIndex={0}
      aria-label="Public program flip viewer"
    >
      <div aria-live="polite" aria-atomic="true" ref={liveRegionRef} className="sr-only" />
      <article className="card top-actions">
        <button type="button" onClick={goPrev} disabled={stepIndex <= 0} aria-label="Previous page view">
          Previous
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={stepIndex >= steps.length - 1}
          aria-label="Next page view"
        >
          Next
        </button>
        <span className="meta-text">
          View {stepIndex + 1}/{steps.length}
        </span>
        <a href={`/api/public/exports/${showSlug}/proof`}>Download Proof PDF</a>
        <a href={`/api/public/exports/${showSlug}/print`}>Download Print PDF</a>
        <a href={`/programs/${programSlug}`}>Legacy View</a>
      </article>

      <article className="card stack-sm">
        <strong>Table of Contents</strong>
        <div className="program-grid">
          {toc.map((item) => (
            <button
              key={`${item.title}-${item.page}`}
              type="button"
              className="tab-chip"
              onClick={() => goToStep(item.step)}
              style={{ textAlign: "left", width: "100%" }}
            >
              {item.title} (p.{item.page})
            </button>
          ))}
        </div>
      </article>

      {current ? (
        <article
          key={`flip-step-${stepIndex}`}
          className={`card flip-view-card flip-${flipDirection}`}
          aria-label={`View ${stepIndex + 1} content`}
        >
          <div
            className="sheet-grid"
            style={
              current.kind === "single"
                ? { gap: "0.3in", gridTemplateColumns: "5.5in", justifyContent: "center" }
                : { gap: "0.3in" }
            }
          >
            <div>
              <PublicRenderPage page={current.left} />
              <div className="folio">Page {current.startPage}</div>
            </div>
            {current.right ? (
              <div>
                <PublicRenderPage page={current.right} />
                <div className="folio">Page {current.endPage}</div>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}
