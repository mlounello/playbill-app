"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function GlobalLoadingOverlay() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Working...");

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      const method = (form.getAttribute("method") || "post").toLowerCase();
      if (method === "get") {
        setLabel("Loading...");
      } else {
        setLabel(form.dataset.pendingLabel || "Submitting...");
      }
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
