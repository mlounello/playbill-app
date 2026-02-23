"use client";

import { useEffect, useState } from "react";

export function FlashToast({
  message,
  tone
}: {
  message?: string;
  tone: "error" | "success";
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message) return;
    const timeout = window.setTimeout(() => setVisible(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div
      className={`flash-toast ${tone === "success" ? "flash-success" : "flash-error"}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span>{message}</span>
      <button type="button" className="ghost-button" onClick={() => setVisible(false)}>
        Dismiss
      </button>
    </div>
  );
}
