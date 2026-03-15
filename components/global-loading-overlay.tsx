"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function GlobalLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Working...");
  const submittingRef = useState<{ form: HTMLFormElement | null; startedAt: number }>(() => ({
    form: null,
    startedAt: 0
  }))[0];

  useEffect(() => {
    setActive(false);
    submittingRef.form = null;
    submittingRef.startedAt = 0;
    try {
      const raw = window.sessionStorage.getItem("playbill:return-scroll");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { path?: string; y?: number; ts?: number; focusId?: string; focusName?: string };
      const samePath = parsed?.path === pathname;
      const fresh = typeof parsed?.ts === "number" ? Date.now() - parsed.ts < 90_000 : false;
      if (samePath && fresh && typeof parsed?.y === "number") {
        window.requestAnimationFrame(() => window.scrollTo({ top: parsed.y as number, behavior: "auto" }));
      }
      if (samePath && fresh && (parsed?.focusId || parsed?.focusName)) {
        window.requestAnimationFrame(() => {
          const byId = parsed.focusId ? (document.getElementById(parsed.focusId) as HTMLElement | null) : null;
          const byName = !byId && parsed.focusName ? (document.querySelector(`[name="${parsed.focusName}"]`) as HTMLElement | null) : null;
          const target = byId || byName;
          if (target && typeof target.focus === "function") {
            target.focus({ preventScroll: true });
          }
        });
      }
      window.sessionStorage.removeItem("playbill:return-scroll");
    } catch {
      // Ignore scroll restore errors.
    }
  }, [pathname, searchParams, submittingRef]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = window.setInterval(() => {
      const now = Date.now();
      const form = submittingRef.form;
      const startedAt = submittingRef.startedAt || now;
      const elapsed = now - startedAt;

      // If the submitting form was replaced during same-route refresh, clear overlay.
      const disconnected = Boolean(form) && !document.contains(form);
      // Fallback so the overlay never gets stuck indefinitely.
      const timedOut = elapsed > 90_000;

      if (disconnected || timedOut) {
        setActive(false);
        submittingRef.form = null;
        submittingRef.startedAt = 0;
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [active, submittingRef]);

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      if (form.dataset.noOverlay === "true") {
        return;
      }
      if (form.dataset.preserveScroll === "true") {
        try {
          const activeElement = document.activeElement as HTMLElement | null;
          const focusId = activeElement?.id || "";
          const focusName =
            activeElement && "getAttribute" in activeElement
              ? String(activeElement.getAttribute("name") ?? "")
              : "";
          window.sessionStorage.setItem(
            "playbill:return-scroll",
            JSON.stringify({ path: window.location.pathname, y: window.scrollY, ts: Date.now(), focusId, focusName })
          );
        } catch {
          // Ignore.
        }
      }
      if (form.dataset.rowPending === "true" || form.classList.contains("role-assignment-row")) {
        form.setAttribute("data-pending", "true");
        const buttons = form.querySelectorAll("button, input[type='submit']");
        buttons.forEach((button) => {
          (button as HTMLButtonElement | HTMLInputElement).disabled = true;
        });
      }
      const method = (form.getAttribute("method") || "post").toLowerCase();
      if (method === "get") {
        setLabel("Loading...");
      } else {
        setLabel(form.dataset.pendingLabel || "Submitting...");
      }
      submittingRef.form = form;
      submittingRef.startedAt = Date.now();
      setActive(true);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      setLabel("Loading...");
      setActive(true);
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="global-loading-overlay" role="status" aria-live="polite">
      <div className="global-loading-card">
        <div className="global-loading-title">{label}</div>
        <div className="global-loading-bar" />
      </div>
    </div>
  );
}
