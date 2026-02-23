"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORAGE_KEY = "playbill_submission_view";

function buildHref({
  showId,
  filter,
  sort,
  query,
  view
}: {
  showId: string;
  filter: string;
  sort: string;
  query: string;
  view: "table" | "cards";
}) {
  const params = new URLSearchParams();
  params.set("tab", "submissions");
  params.set("submissionFilter", filter);
  params.set("submissionSort", sort);
  params.set("submissionQuery", query);
  params.set("submissionView", view);
  return `/app/shows/${showId}?${params.toString()}`;
}

export function SubmissionViewToggle({
  showId,
  filter,
  sort,
  query,
  activeView,
  submissionViewProvided
}: {
  showId: string;
  filter: string;
  sort: string;
  query: string;
  activeView: "table" | "cards";
  submissionViewProvided: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (submissionViewProvided) {
      return;
    }
    const preferred = window.localStorage.getItem(STORAGE_KEY);
    if (preferred !== "table" && preferred !== "cards") {
      return;
    }
    if (preferred === activeView) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set("submissionView", preferred);
    router.replace(`${pathname}?${next.toString()}`);
  }, [activeView, pathname, router, searchParams, submissionViewProvided]);

  const tableHref = buildHref({ showId, filter, sort, query, view: "table" });
  const cardsHref = buildHref({ showId, filter, sort, query, view: "cards" });

  return (
    <div className="chip-row">
      <Link
        href={tableHref}
        className="tab-chip"
        style={activeView === "table" ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
        onClick={() => window.localStorage.setItem(STORAGE_KEY, "table")}
      >
        Table view
      </Link>
      <Link
        href={cardsHref}
        className="tab-chip"
        style={activeView === "cards" ? { borderColor: "#006b54", color: "#006b54", fontWeight: 700 } : undefined}
        onClick={() => window.localStorage.setItem(STORAGE_KEY, "cards")}
      >
        Card view
      </Link>
    </div>
  );
}

