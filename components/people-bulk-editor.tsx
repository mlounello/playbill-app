"use client";

import { useMemo, useState } from "react";

type PersonRow = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production";
  email: string;
};

export function PeopleBulkEditor({
  people,
  onSubmitAction
}: {
  people: PersonRow[];
  onSubmitAction: (formData: FormData) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const selectedCount = selectedIds.size;

  const sortedPeople = useMemo(
    () => [...people].sort((a, b) => a.full_name.localeCompare(b.full_name) || a.role_title.localeCompare(b.role_title)),
    [people]
  );

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sortedPeople.map((person) => person.id)));
  const clearAll = () => setSelectedIds(new Set());

  return (
    <section className="card grid" style={{ gap: "0.7rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
        <strong>Current People ({people.length})</strong>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.88rem", opacity: 0.85 }}>{selectedCount} selected</span>
          <button type="button" onClick={selectAll}>Select all</button>
          <button type="button" onClick={clearAll}>Clear</button>
          <button type="button" onClick={() => setOpen(true)} disabled={selectedCount === 0}>
            Bulk Edit Selected
          </button>
        </div>
      </div>

      {sortedPeople.length === 0 ? (
        <div>No people yet.</div>
      ) : (
        <div className="grid" style={{ gap: "0.35rem" }}>
          {sortedPeople.map((person, index) => (
            <label key={person.id} style={{ display: "flex", gap: "0.55rem", alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" checked={selectedIds.has(person.id)} onChange={() => toggle(person.id)} />
              <span>
                {index + 1}. {person.full_name} - {person.role_title} ({person.team_type}) • {person.email}
              </span>
            </label>
          ))}
        </div>
      )}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "1rem"
          }}
        >
          <div className="card grid" style={{ width: "min(760px, 96vw)", maxHeight: "92vh", overflow: "auto", gap: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.7rem" }}>
              <strong>Bulk Edit {selectedCount} Selected Person(s)</strong>
              <button type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              Enable only the fields you want changed. Only enabled fields will be saved across selected people.
            </p>

            <form action={onSubmitAction} className="grid" style={{ gap: "0.65rem" }}>
              {[...selectedIds].map((id) => (
                <input key={id} type="hidden" name="selectedPersonIds" value={id} />
              ))}

              <div className="grid" style={{ gap: "0.45rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" name="enableRoleTitle" />
                  Enable Role Title
                </label>
                <input name="roleTitle" placeholder="New role title" />
              </div>

              <div className="grid" style={{ gap: "0.45rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" name="enableTeamType" />
                  Enable Category
                </label>
                <select name="teamType" defaultValue="production">
                  <option value="cast">cast</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div className="grid" style={{ gap: "0.45rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" name="enableEmail" />
                  Enable Email
                </label>
                <input name="email" placeholder="new@email.com" />
              </div>

              <div className="grid" style={{ gap: "0.45rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 600 }}>
                  <input type="checkbox" name="enableFullName" />
                  Enable Full Name
                </label>
                <input name="fullName" placeholder="New Full Name" />
              </div>

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button type="submit">Save Enabled Fields</button>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
