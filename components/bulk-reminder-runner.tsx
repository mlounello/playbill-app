"use client";

import { useMemo, useState } from "react";

type ScopeValue = "all_open" | "open_bios" | "open_notes";

type ScopeOption = {
  value: ScopeValue;
  label: string;
};

export function BulkReminderRunner({
  showId,
  remindersPaused,
  defaultScope = "all_open",
  options
}: {
  showId: string;
  remindersPaused: boolean;
  defaultScope?: ScopeValue;
  options: ScopeOption[];
}) {
  const [scope, setScope] = useState<ScopeValue>(defaultScope);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [error, setError] = useState("");

  const progressPercent = useMemo(() => {
    if (total <= 0) return 8;
    return Math.max(8, Math.min(100, Math.round((processed / total) * 100)));
  }, [processed, total]);

  async function handleSend() {
    if (running || remindersPaused) {
      return;
    }
    setRunning(true);
    setProcessed(0);
    setSent(0);
    setTotal(0);
    setCurrentLabel("Starting bulk reminder run...");
    setError("");

    try {
      const response = await fetch(`/api/shows/${showId}/reminders/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scope })
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not start bulk reminder run.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let finalSent = 0;
      let finalTotal = 0;

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line) as {
            type?: string;
            processed?: number;
            sent?: number;
            total?: number;
            recipientName?: string;
            message?: string;
          };
          if (payload.type === "progress") {
            setProcessed(payload.processed ?? 0);
            setSent(payload.sent ?? 0);
            setTotal(payload.total ?? 0);
            setCurrentLabel(payload.recipientName ? `Sending to ${payload.recipientName}...` : "Sending reminders...");
          } else if (payload.type === "done") {
            finalSent = payload.sent ?? 0;
            finalTotal = payload.total ?? 0;
            setProcessed(payload.total ?? 0);
            setSent(finalSent);
            setTotal(finalTotal);
            setCurrentLabel("Finalizing...");
          } else if (payload.type === "error") {
            throw new Error(payload.message || "Bulk reminder run failed.");
          }
        }
      }

      const params = new URLSearchParams(window.location.search);
      params.set("tab", "overview");
      params.set("success", `Reminders processed: ${finalSent}/${finalTotal}.`);
      window.location.href = `${window.location.pathname}?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk reminder run failed.");
      setRunning(false);
    }
  }

  return (
    <div className="bulk-reminder-runner">
      <label>
        Reminder scope
        <select value={scope} onChange={(event) => setScope(event.target.value as ScopeValue)} disabled={running}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handleSend} disabled={running || remindersPaused}>
        {remindersPaused ? "Reminders Paused" : running ? "Sending..." : "Send Reminders Now"}
      </button>

      {running ? (
        <div className="bulk-reminder-progress" role="status" aria-live="polite">
          <div className="bulk-reminder-progress-header">
            <strong>{currentLabel || "Sending reminders..."}</strong>
            <span>
              {processed}/{total || "?"}
            </span>
          </div>
          <div className="bulk-reminder-progress-bar">
            <div className="bulk-reminder-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="meta-text">
            Sent successfully: {sent}
          </div>
        </div>
      ) : null}

      {error ? <div className="flash-toast flash-error" style={{ position: "static", maxWidth: "100%" }}>{error}</div> : null}
    </div>
  );
}
