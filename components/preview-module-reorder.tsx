"use client";

import { useMemo, useState } from "react";

type PreviewModule = {
  id: string;
  label: string;
  visible: boolean;
  fillerEligible: boolean;
};

function moveItem<T>(array: T[], from: number, to: number) {
  const next = [...array];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function PreviewModuleReorder({
  modules,
  onSubmitAction
}: {
  modules: PreviewModule[];
  onSubmitAction: (formData: FormData) => void;
}) {
  const [items, setItems] = useState<PreviewModule[]>(modules);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const payload = useMemo(() => JSON.stringify(items.map((item) => item.id)), [items]);

  return (
    <form action={onSubmitAction} className="stack-sm" data-pending-label="Reordering modules...">
      <input type="hidden" name="orderedModuleIds" value={payload} readOnly />
      {items.map((module, index) => (
        <article
          key={module.id}
          className="card card-soft row-between draggable-module"
          style={{ gap: "0.5rem", opacity: draggingId === module.id ? 0.6 : 1 }}
          draggable
          onDragStart={(event) => {
            setDragIndex(index);
            setDraggingId(module.id);
            event.dataTransfer.effectAllowed = "move";
            const ghost = event.currentTarget.cloneNode(true) as HTMLElement;
            ghost.style.position = "absolute";
            ghost.style.top = "-9999px";
            ghost.style.left = "-9999px";
            ghost.style.width = `${event.currentTarget.clientWidth}px`;
            document.body.appendChild(ghost);
            event.dataTransfer.setDragImage(ghost, 20, 20);
            requestAnimationFrame(() => document.body.removeChild(ghost));
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragIndex === null || dragIndex === index) return;
            setItems((current) => moveItem(current, dragIndex, index));
            setDragIndex(null);
            setDraggingId(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDraggingId(null);
          }}
        >
          <div>
            <span className="drag-handle" aria-hidden>
              ::
            </span>{" "}
            {index + 1}. {module.label} {module.visible ? "" : "(hidden)"} {module.fillerEligible ? "• filler eligible" : ""}
          </div>
          <div className="top-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setItems((current) => moveItem(current, index, Math.max(0, index - 1)))}
              disabled={index === 0}
            >
              Up
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setItems((current) => moveItem(current, index, Math.min(current.length - 1, index + 1)))}
              disabled={index === items.length - 1}
            >
              Down
            </button>
          </div>
        </article>
      ))}
      <button type="submit">Save Module Order</button>
    </form>
  );
}
