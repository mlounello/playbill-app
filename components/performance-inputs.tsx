"use client";

import { useEffect, useMemo, useState } from "react";

type Performance = {
  date: string;
  time: string;
};

const formatDateTime = (date: string, time: string) => {
  try {
    const [year, month, day] = date.split("-").map((x) => Number(x));
    const [hourRaw, minuteRaw] = (time || "00:00").split(":").map((x) => Number(x));

    const dateObj = new Date(year, month - 1, day, hourRaw, minuteRaw);

    const datePart = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(dateObj);

    if (!time) {
      return datePart;
    }

    const timePart = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(dateObj);

    return `${datePart} ${timePart}`;
  } catch {
    return "";
  }
};

export function PerformanceInputs({
  initialPerformances,
  initialShowDatesOverride,
  draftNamespace
}: {
  initialPerformances?: Array<{ date?: string; time?: string }>;
  initialShowDatesOverride?: string;
  draftNamespace?: string;
}) {
  const seeded = (() => {
    if (draftNamespace && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(`${draftNamespace}:performances`);
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ date?: string; time?: string }>;
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item) => ({ date: item.date ?? "", time: item.time ?? "" }));
          }
        }
      } catch {
        // Ignore draft parse errors.
      }
    }
    return initialPerformances && initialPerformances.length > 0
      ? initialPerformances.map((item) => ({ date: item.date ?? "", time: item.time ?? "" }))
      : [{ date: "", time: "" }];
  })();
  const [performances, setPerformances] = useState<Performance[]>(seeded);
  const [showDatesOverride, setShowDatesOverride] = useState(() => {
    if (draftNamespace && typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(`${draftNamespace}:showDatesOverride`);
        if (saved !== null) {
          return saved;
        }
      } catch {
        // Ignore.
      }
    }
    return initialShowDatesOverride ?? "";
  });

  const summary = useMemo(() => {
    return performances
      .filter((p) => p.date)
      .map((p) => formatDateTime(p.date, p.time))
      .filter(Boolean)
      .join(" | ");
  }, [performances]);

  const encodedSchedule = useMemo(() => JSON.stringify(performances.filter((p) => p.date)), [performances]);

  useEffect(() => {
    if (!draftNamespace || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(`${draftNamespace}:performances`, JSON.stringify(performances));
      window.localStorage.setItem(`${draftNamespace}:showDatesOverride`, showDatesOverride);
    } catch {
      // Ignore.
    }
  }, [draftNamespace, performances, showDatesOverride]);

  const update = (index: number, key: keyof Performance, value: string) => {
    setPerformances((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const add = () => {
    setPerformances((current) => {
      const last = current[current.length - 1];
      if (!last) {
        return [...current, { date: "", time: "" }];
      }

      let nextDate = "";
      if (last.date) {
        const date = new Date(`${last.date}T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
          date.setDate(date.getDate() + 1);
          nextDate = date.toISOString().slice(0, 10);
        }
      }

      return [...current, { date: nextDate, time: last.time || "" }];
    });
  };

  const remove = (index: number) => {
    setPerformances((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  return (
    <div className="card stack-sm">
      <h3 style={{ marginBottom: 0 }}>Performance Dates & Times</h3>
      <p className="section-note">Only one date is required. Add times when relevant.</p>

      {performances.map((performance, index) => (
        <div key={`performance-${index}`} className="performance-row">
          <label>
            Date
            <input
              type="date"
              value={performance.date}
              required={index === 0}
              onChange={(event) => update(index, "date", event.target.value)}
            />
          </label>

          <label>
            Time (optional)
            <input type="time" value={performance.time} onChange={(event) => update(index, "time", event.target.value)} />
          </label>

          <button type="button" onClick={() => remove(index)} className="ghost-button performance-remove">
            Remove
          </button>
        </div>
      ))}

      <div className="top-actions">
        <button type="button" onClick={add}>
          Add Performance
        </button>
      </div>

      <label>
        Display Text Override (optional)
        <input
          type="text"
          name="showDatesOverride"
          placeholder="If empty, this is auto-generated from selected dates/times."
          value={showDatesOverride}
          onChange={(event) => setShowDatesOverride(event.target.value)}
        />
      </label>

      <input type="hidden" name="showDates" value={summary} readOnly required />
      <input type="hidden" name="performanceSchedule" value={encodedSchedule} readOnly />

      <div className="meta-text">
        <strong>Preview:</strong> {summary || "Select at least one date"}
      </div>
    </div>
  );
}
