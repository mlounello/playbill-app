"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "playbill_admin_density";

export function AdminDensityToggle() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const enabled = saved === "compact";
    setCompact(enabled);
    document.body.classList.toggle("density-compact", enabled);
  }, []);

  const onToggle = () => {
    setCompact((current) => {
      const next = !current;
      document.body.classList.toggle("density-compact", next);
      window.localStorage.setItem(STORAGE_KEY, next ? "compact" : "comfortable");
      return next;
    });
  };

  return (
    <button type="button" className="ghost-button" onClick={onToggle} aria-pressed={compact}>
      Density: {compact ? "Compact" : "Comfortable"}
    </button>
  );
}

