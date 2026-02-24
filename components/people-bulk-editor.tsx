"use client";

import { useMemo, useState } from "react";

type PersonRow = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production" | "creative";
  email: string;
  submission_type?: "bio" | "director_note" | "dramaturgical_note" | "music_director_note";
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
  const [query, setQuery] = useState("");
  const [enableRoleTitle, setEnableRoleTitle] = useState(false);
  const [enableTeamType, setEnableTeamType] = useState(false);
  const [enableEmail, setEnableEmail] = useState(false);
  const [enableFullName, setEnableFullName] = useState(false);
  const [enableSubmissionType, setEnableSubmissionType] = useState(false);

  const sortedPeople = useMemo(
    () => [...people].sort((a, b) => a.full_name.localeCompare(b.full_name) || a.role_title.localeCompare(b.role_title)),
    [people]
  );
  const visiblePeople = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedPeople;
    return sortedPeople.filter((person) => {
      const haystack = `${person.full_name} ${person.role_title} ${person.team_type} ${person.email} ${person.submission_type ?? "bio"}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, sortedPeople]);
  const selectedCount = selectedIds.size;

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => setSelectedIds(new Set(visiblePeople.map((person) => person.id)));
  const clearVisible = () => {
    if (visiblePeople.length === 0) return;
    const visibleIds = new Set(visiblePeople.map((person) => person.id));
    setSelectedIds((current) => new Set([...current].filter((id) => !visibleIds.has(id))));
  };
  const clearAll = () => setSelectedIds(new Set());

  return (
    <section className="card people-editor">
      <header className="people-editor-header">
        <strong>Current People</strong>
        <span className="people-editor-count">{people.length} total</span>
      </header>

      <div className="people-toolbar">
        <div className="people-toolbar-left">
          <span className="people-editor-count">{selectedCount} selected</span>
          <button type="button" className="ghost-button" onClick={selectAllVisible}>
            Select visible
          </button>
          <button type="button" className="ghost-button" onClick={clearVisible}>
            Clear visible
          </button>
          <button type="button" className="ghost-button" onClick={clearAll}>
            Clear all
          </button>
          <button type="button" onClick={() => setOpen(true)} disabled={selectedCount === 0}>
            Bulk Edit Selected
          </button>
        </div>
        <label className="people-search">
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, role, email" />
        </label>
      </div>

      {sortedPeople.length === 0 ? (
        <div className="people-empty">No people yet.</div>
      ) : (
        <div className="people-table-wrap">
          <table className="people-table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Name</th>
                <th>Role</th>
                <th>Category</th>
                <th>Email</th>
                <th>Submission</th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((person) => {
                const checked = selectedIds.has(person.id);
                return (
                  <tr
                    key={person.id}
                    className={checked ? "is-selected" : ""}
                    onClick={() => toggle(person.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle(person.id);
                      }
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(person.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td>{person.full_name}</td>
                    <td>{person.role_title}</td>
                    <td style={{ textTransform: "capitalize" }}>{person.team_type}</td>
                    <td>{person.email || "No email"}</td>
                    <td>{person.submission_type ?? "bio"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div role="dialog" aria-modal="true" className="people-modal-backdrop">
          <div className="card people-modal">
            <div className="people-modal-header">
              <strong>Bulk Edit {selectedCount} Selected Person(s)</strong>
              <button type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <p className="people-modal-note">
              Enable only the fields you want changed. Only enabled fields will be saved across selected people.
            </p>

            <form action={onSubmitAction} className="people-modal-form">
              {[...selectedIds].map((id) => (
                <input key={id} type="hidden" name="selectedPersonIds" value={id} />
              ))}

              <div className="people-field-row">
                <label className="people-field-toggle">
                  <input
                    type="checkbox"
                    name="enableRoleTitle"
                    checked={enableRoleTitle}
                    onChange={(event) => setEnableRoleTitle(event.target.checked)}
                  />
                  Enable Role Title
                </label>
                <input name="roleTitle" placeholder="New role title" disabled={!enableRoleTitle} />
              </div>

              <div className="people-field-row">
                <label className="people-field-toggle">
                  <input
                    type="checkbox"
                    name="enableTeamType"
                    checked={enableTeamType}
                    onChange={(event) => setEnableTeamType(event.target.checked)}
                  />
                  Enable Category
                </label>
                <select name="teamType" defaultValue="production" disabled={!enableTeamType}>
                  <option value="cast">cast</option>
                  <option value="creative">creative</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div className="people-field-row">
                <label className="people-field-toggle">
                  <input
                    type="checkbox"
                    name="enableEmail"
                    checked={enableEmail}
                    onChange={(event) => setEnableEmail(event.target.checked)}
                  />
                  Enable Email
                </label>
                <input name="email" placeholder="new@email.com" disabled={!enableEmail} />
              </div>

              <div className="people-field-row">
                <label className="people-field-toggle">
                  <input
                    type="checkbox"
                    name="enableFullName"
                    checked={enableFullName}
                    onChange={(event) => setEnableFullName(event.target.checked)}
                  />
                  Enable Full Name
                </label>
                <input name="fullName" placeholder="New Full Name" disabled={!enableFullName} />
              </div>

              <div className="people-field-row">
                <label className="people-field-toggle">
                  <input
                    type="checkbox"
                    name="enableSubmissionType"
                    checked={enableSubmissionType}
                    onChange={(event) => setEnableSubmissionType(event.target.checked)}
                  />
                  Enable Submission Requirement
                </label>
                <select name="submissionType" defaultValue="bio" disabled={!enableSubmissionType}>
                  <option value="bio">Bio</option>
                  <option value="director_note">Director's Note</option>
                  <option value="dramaturgical_note">Dramaturgical Note</option>
                  <option value="music_director_note">Music Director's Note</option>
                </select>
              </div>

              <div className="people-modal-actions">
                <button type="submit">Save Enabled Fields</button>
                <button type="button" className="ghost-button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
