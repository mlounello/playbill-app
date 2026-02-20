"use client";

import { useMemo, useState } from "react";

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
  initialShowDatesOverride
}: {
  initialPerformances?: Array<{ date?: string; time?: string }>;
  initialShowDatesOverride?: string;
}) {
  const seeded =
    initialPerformances && initialPerformances.length > 0
      ? initialPerformances.map((item) => ({ date: item.date ?? "", time: item.time ?? "" }))
      : [{ date: "", time: "" }];
  const [performances, setPerformances] = useState<Performance[]>(seeded);

  const summary = useMemo(() => {
    return performances
      .filter((p) => p.date)
      .map((p) => formatDateTime(p.date, p.time))
      .filter(Boolean)
      .join(" | ");
  }, [performances]);

  const encodedSchedule = useMemo(() => JSON.stringify(performances.filter((p) => p.date)), [performances]);

  const update = (index: number, key: keyof Performance, value: string) => {
    setPerformances((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const add = () => {
    setPerformances((current) => [...current, { date: "", time: "" }]);
  };

  const remove = (index: number) => {
    setPerformances((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  };

  return (
    <div className="card grid">
      <h3 style={{ marginBottom: 0 }}>Performance Dates & Times</h3>
      <p style={{ margin: 0, fontSize: "0.95rem" }}>Only one date is required. Add times when relevant.</p>

      {performances.map((performance, index) => (
        <div key={`performance-${index}`} style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr auto" }}>
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

          <button type="button" onClick={() => remove(index)} style={{ alignSelf: "end" }}>
            Remove
          </button>
        </div>
      ))}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
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
          defaultValue={initialShowDatesOverride ?? ""}
        />
      </label>

      <input type="hidden" name="showDates" value={summary} readOnly required />
      <input type="hidden" name="performanceSchedule" value={encodedSchedule} readOnly />

      <div style={{ fontSize: "0.9rem" }}>
        <strong>Preview:</strong> {summary || "Select at least one date"}
      </div>
    </div>
  );
}
