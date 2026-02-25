"use client";

import { useMemo, useState } from "react";

type RoleRow = {
  id: string;
  person_name: string;
  role_name: string;
  category: "cast" | "creative" | "production";
};

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RoleListOrderEditor({
  roles,
  onSubmitAction
}: {
  roles: RoleRow[];
  onSubmitAction: (formData: FormData) => void;
}) {
  const [ordered, setOrdered] = useState<RoleRow[]>(roles);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const byCategory = useMemo(
    () => ({
      cast: ordered.filter((item) => item.category === "cast"),
      creative: ordered.filter((item) => item.category === "creative"),
      production: ordered.filter((item) => item.category === "production")
    }),
    [ordered]
  );

  const reorderWithinCategory = (category: "cast" | "creative" | "production", fromLocalIndex: number, toLocalIndex: number) => {
    const group = ordered.filter((item) => item.category === category);
    const movedGroup = moveItem(group, fromLocalIndex, toLocalIndex);
    const queue = [...movedGroup];
    const rebuilt = ordered.map((item) => (item.category === category ? queue.shift() ?? item : item));
    setOrdered(rebuilt);
  };

  const renderCategory = (label: string, category: "cast" | "creative" | "production") => {
    const rows = byCategory[category];
    return (
      <div className="card stack-sm">
        <strong>{label}</strong>
        {rows.length === 0 ? (
          <div className="meta-text">No roles in this category yet.</div>
        ) : (
          rows.map((row, localIndex) => (
            <div
              key={row.id}
              className="order-row"
              draggable
              onDragStart={() => setDragIndex(localIndex)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex === null || dragIndex === localIndex) return;
                reorderWithinCategory(category, dragIndex, localIndex);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="meta-text">::</span>
              <span>{row.role_name}</span>
              <span className="meta-text">...</span>
              <strong>{row.person_name}</strong>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <form action={onSubmitAction} className="stack-sm" data-pending-label="Saving role list order..." data-preserve-scroll="true">
      <input type="hidden" name="orderedRoleIds" value={JSON.stringify(ordered.map((item) => item.id))} readOnly />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.7rem" }}>
        {renderCategory("Cast Order", "cast")}
        {renderCategory("Creative Team Order", "creative")}
        {renderCategory("Production Team Order", "production")}
      </div>
      <button type="submit">Save List Order</button>
    </form>
  );
}
