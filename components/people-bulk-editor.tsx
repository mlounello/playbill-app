"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

type PersonRow = {
  id: string;
  full_name: string;
  role_title: string;
  team_type: "cast" | "production" | "creative" | "mixed";
  email: string;
  role_count?: number;
  role_summary?: string;
  submission_type?: "bio" | "note" | "director_note" | "dramaturgical_note" | "music_director_note";
  request_bio?: boolean;
  request_notes?: boolean;
  request_summary?: string;
  bio_char_limit?: number;
  bio_char_limit_override?: number | null;
  submission_status?: "pending" | "draft" | "submitted" | "returned" | "approved" | "locked";
  submitted_at?: string | null;
};

type PersonRoleRow = {
  id: string;
  person_id: string;
  role_name: string;
  category: "cast" | "creative" | "production";
  role_template_id: string | null;
};

type RoleActionResult =
  | {
      ok?: boolean;
      message?: string;
      role?: Partial<PersonRoleRow> & { id: string };
      roleId?: string;
    }
  | undefined;

type RoleTemplateOption = {
  id: string;
  name: string;
  category: "cast" | "creative" | "production";
};

export function PeopleBulkEditor({
  people,
  onSubmitAction,
  onEditAction,
  onRemovePersonAction,
  onAddRoleAction,
  onUpdateRoleAction,
  onRemoveRoleAction,
  personRoles,
  roleTemplates,
  roleError,
  roleErrorRoleName,
  highlightedPersonId
}: {
  people: PersonRow[];
  onSubmitAction: (formData: FormData) => void;
  onEditAction: (formData: FormData) => void | Promise<unknown>;
  onRemovePersonAction: (formData: FormData) => void;
  onAddRoleAction: (formData: FormData) => void | Promise<unknown>;
  onUpdateRoleAction: (formData: FormData) => void | Promise<unknown>;
  onRemoveRoleAction: (formData: FormData) => void | Promise<unknown>;
  personRoles: PersonRoleRow[];
  roleTemplates: RoleTemplateOption[];
  roleError?: string;
  roleErrorRoleName?: string;
  highlightedPersonId?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localPeople, setLocalPeople] = useState(people);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [enableRoleTitle, setEnableRoleTitle] = useState(false);
  const [enableTeamType, setEnableTeamType] = useState(false);
  const [enableEmail, setEnableEmail] = useState(false);
  const [enableFullName, setEnableFullName] = useState(false);
  const [enableSubmissionType, setEnableSubmissionType] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRequestBio, setEditRequestBio] = useState(true);
  const [editRequestNotes, setEditRequestNotes] = useState(false);
  const [editBioCharLimitOverride, setEditBioCharLimitOverride] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editError, setEditError] = useState("");
  const [localPersonRoles, setLocalPersonRoles] = useState(personRoles);
  const [roleMessages, setRoleMessages] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});
  const [isSavingEdit, startSavingEdit] = useTransition();
  const [savingRoleIds, setSavingRoleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalPeople(people);
  }, [people]);

  useEffect(() => {
    setLocalPersonRoles(personRoles);
  }, [personRoles]);

  const sortedPeople = useMemo(
    () => [...localPeople].sort((a, b) => a.full_name.localeCompare(b.full_name) || a.role_title.localeCompare(b.role_title)),
    [localPeople]
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
  const openEdit = (person: PersonRow) => {
    setEditMessage("");
    setEditError("");
    setEditPersonId(person.id);
    setEditFullName(person.full_name);
    setEditEmail(person.email);
    setEditRequestBio(person.request_bio ?? (person.submission_type ?? "bio") === "bio");
    setEditRequestNotes(person.request_notes ?? (person.submission_type ?? "") === "note");
    setEditBioCharLimitOverride(person.bio_char_limit_override ? String(person.bio_char_limit_override) : "");
    setEditOpen(true);
  };
  const editPerson = localPeople.find((person) => person.id === editPersonId);
  const editPersonRoles = useMemo(
    () => localPersonRoles.filter((role) => role.person_id === editPersonId),
    [localPersonRoles, editPersonId]
  );
  const setRoleSaving = (id: string, saving: boolean) => {
    setSavingRoleIds((current) => {
      const next = new Set(current);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const getRoleTemplate = (id: string) => roleTemplates.find((template) => template.id === id);
  const getVisibleRoleSummary = (roles: PersonRoleRow[]) => {
    if (roles.length === 0) return "No roles yet";
    const cast = roles.filter((role) => role.category === "cast").map((role) => role.role_name);
    const nonCast = roles.filter((role) => role.category !== "cast").map((role) => role.role_name);
    if (cast.length > 0) {
      return `${cast.join(", ")}${nonCast.length > 0 ? ` (${nonCast.join(", ")})` : ""}`;
    }
    return nonCast.join(", ");
  };
  const handleRoleUpdate = (event: FormEvent<HTMLFormElement>, roleId: string) => {
    event.preventDefault();
    setRoleSaving(roleId, true);
    setRoleMessages((current) => ({ ...current, [roleId]: { tone: "success", text: "Saving..." } }));
    const formData = new FormData(event.currentTarget);
    formData.set("drawerMode", "true");
    startSavingEdit(async () => {
      try {
        const result = await onUpdateRoleAction(formData) as RoleActionResult;
        if (result?.ok === false) {
          setRoleMessages((current) => ({ ...current, [roleId]: { tone: "error", text: result.message || "Could not save role." } }));
          return;
        }
        const template = getRoleTemplate(String(formData.get("roleTemplateId") ?? ""));
        const nextRoleName = String(result?.role?.role_name ?? "").trim() || String(formData.get("roleName") ?? "").trim() || template?.name || "";
        const nextCategory = (result?.role?.category ?? String(formData.get("roleCategory") ?? "production")) as PersonRoleRow["category"];
        const nextTemplateId = result?.role?.role_template_id ?? (String(formData.get("roleTemplateId") ?? "") || null);
        setLocalPersonRoles((current) =>
          current.map((role) =>
            role.id === roleId
              ? {
                  ...role,
                  role_name: nextRoleName,
                  category: nextCategory,
                  role_template_id: nextTemplateId
                }
              : role
          )
        );
        setRoleMessages((current) => ({ ...current, [roleId]: { tone: "success", text: result?.message || "Role saved." } }));
      } catch (error) {
        setRoleMessages((current) => ({
          ...current,
          [roleId]: { tone: "error", text: error instanceof Error ? error.message : "Could not save role." }
        }));
      } finally {
        setRoleSaving(roleId, false);
      }
    });
  };
  const handleRoleRemove = (event: FormEvent<HTMLFormElement>, role: PersonRoleRow) => {
    event.preventDefault();
    if (!window.confirm(`Remove ${role.role_name} from this person?`)) {
      return;
    }
    setRoleSaving(role.id, true);
    setRoleMessages((current) => ({ ...current, [role.id]: { tone: "success", text: "Removing..." } }));
    const formData = new FormData(event.currentTarget);
    formData.set("drawerMode", "true");
    startSavingEdit(async () => {
      try {
        const result = await onRemoveRoleAction(formData) as RoleActionResult;
        if (result?.ok === false) {
          setRoleMessages((current) => ({ ...current, [role.id]: { tone: "error", text: result.message || "Could not remove role." } }));
          return;
        }
        setLocalPersonRoles((current) => current.filter((item) => item.id !== role.id));
        setRoleMessages((current) => ({ ...current, [`removed-${role.id}`]: { tone: "success", text: result?.message || "Role removed." } }));
      } catch (error) {
        setRoleMessages((current) => ({
          ...current,
          [role.id]: { tone: "error", text: error instanceof Error ? error.message : "Could not remove role." }
        }));
      } finally {
        setRoleSaving(role.id, false);
      }
    });
  };
  const handleRoleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savingKey = "new-role";
    setRoleSaving(savingKey, true);
    setRoleMessages((current) => ({ ...current, [savingKey]: { tone: "success", text: "Adding..." } }));
    const formData = new FormData(event.currentTarget);
    formData.set("drawerMode", "true");
    startSavingEdit(async () => {
      try {
        const result = await onAddRoleAction(formData) as RoleActionResult;
        if (result?.ok === false || !result?.role?.id) {
          setRoleMessages((current) => ({ ...current, [savingKey]: { tone: "error", text: result?.message || "Could not add role." } }));
          return;
        }
        const template = getRoleTemplate(String(formData.get("roleTemplateId") ?? ""));
        const nextRole: PersonRoleRow = {
          id: result.role.id,
          person_id: editPersonId,
          role_name: String(result.role.role_name ?? (String(formData.get("roleName") ?? "").trim() || template?.name || "")),
          category: (result.role.category ?? String(formData.get("roleCategory") ?? "production")) as PersonRoleRow["category"],
          role_template_id: result.role.role_template_id === undefined ? String(formData.get("roleTemplateId") ?? "") || null : result.role.role_template_id ?? null
        };
        setLocalPersonRoles((current) => [...current, nextRole]);
        setRoleMessages((current) => ({ ...current, [savingKey]: { tone: "success", text: result.message || "Role added." } }));
        event.currentTarget.reset();
      } catch (error) {
        setRoleMessages((current) => ({
          ...current,
          [savingKey]: { tone: "error", text: error instanceof Error ? error.message : "Could not add role." }
        }));
      } finally {
        setRoleSaving(savingKey, false);
      }
    });
  };
  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditMessage("");
    setEditError("");
    const formData = new FormData(event.currentTarget);
    formData.set("drawerMode", "true");
    startSavingEdit(async () => {
      try {
        const result = await onEditAction(formData) as
          | { ok?: boolean; message?: string; person?: Partial<PersonRow> & { id: string } }
          | undefined;
        if (result?.ok === false) {
          setEditError(result.message || "Could not save this person.");
          return;
        }
        setLocalPeople((current) =>
          current.map((person) =>
            person.id === editPersonId
              ? {
                  ...person,
                  full_name: editFullName,
                  email: editEmail,
                  request_bio: editRequestBio,
                  request_notes: editRequestNotes,
                  request_summary: result?.person?.request_summary ?? (
                    editRequestBio && editRequestNotes
                      ? "Bio + notes"
                      : editRequestBio
                        ? "Bio only"
                        : editRequestNotes
                          ? "Notes only"
                          : "Nothing requested"
                  ),
                  bio_char_limit: result?.person?.bio_char_limit ?? person.bio_char_limit,
                  bio_char_limit_override: result?.person?.bio_char_limit_override ?? (editBioCharLimitOverride ? Number(editBioCharLimitOverride) : null)
                }
              : person
          )
        );
        setEditMessage(result?.message || "Saved. You can keep editing.");
      } catch (error) {
        setEditError(error instanceof Error ? error.message : "Could not save this person.");
      }
    });
  };

  return (
    <section className="card people-editor">
      <header className="people-editor-header">
        <strong>Current People</strong>
        <span className="people-editor-count">{localPeople.length} total</span>
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
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
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
                    <td>
                      {person.role_title}
                      {person.role_count && person.role_count > 1 ? (
                        <div className="meta-text">
                          {person.role_count} roles • {person.role_summary || "multi-role"}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{person.team_type}</td>
                    <td>{person.email || "No email"}</td>
                    <td>{person.request_summary ?? person.submission_type ?? "Bio only"}</td>
                    <td>
                      <span className="status-pill">{person.submission_status ?? "pending"}</span>
                    </td>
                    <td>{person.submitted_at ? new Date(person.submitted_at).toLocaleDateString("en-US") : "Not submitted"}</td>
                    <td>
                      <div className="row-wrap" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => openEdit(person)}
                        >
                          Edit
                        </button>
                        <form action={onRemovePersonAction} data-row-pending="true" data-preserve-scroll="true">
                          <input type="hidden" name="personId" value={person.id} />
                          <button
                            type="submit"
                            className="ghost-button ghost-button-danger"
                            onClick={(event) => {
                              if (!window.confirm(`Remove ${person.full_name} from this show? This removes their roles and submission tasks too.`)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            Remove from Show
                          </button>
                        </form>
                      </div>
                    </td>
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
                  <option value="note">Notes</option>
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

      {editOpen ? (
        <div role="dialog" aria-modal="true" className="people-modal-backdrop people-drawer-backdrop">
          <div className="card people-modal people-drawer">
            <div className="people-modal-header">
              <div>
                <strong>Edit Person</strong>
                {editPerson ? <div className="meta-text">{editPerson.role_summary || editPerson.role_title}</div> : null}
              </div>
              <button type="button" onClick={() => setEditOpen(false)}>Close</button>
            </div>
            <p className="people-modal-note">
              Save keeps this drawer open so you can continue adjusting roles and submission requirements.
            </p>
            <form onSubmit={handleEditSubmit} className="people-modal-form">
              <input type="hidden" name="personId" value={editPersonId} />
              <input type="hidden" name="drawerMode" value="true" />
              <div className="people-field-row">
                <label className="people-field-toggle">Full Name</label>
                <input name="fullName" value={editFullName} onChange={(event) => setEditFullName(event.target.value)} required />
              </div>
              <div className="people-field-row">
                <label className="people-field-toggle">Role and category</label>
                <input value="Edit roles below in this modal" disabled />
                <input type="hidden" name="roleTitle" value="" />
                <input type="hidden" name="teamType" value="production" />
              </div>
              <div className="meta-text">Roles are managed below in this person editor.</div>
              <div className="people-field-row">
                <label className="people-field-toggle">Email</label>
                <input name="email" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required />
              </div>
              <div className="people-field-row">
                <label className="people-field-toggle">Submission Requests</label>
                <div className="stack-sm">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      name="requestBio"
                      checked={editRequestBio}
                      onChange={(event) => setEditRequestBio(event.target.checked)}
                    />
                    <span>Request a program bio</span>
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      name="requestNotes"
                      checked={editRequestNotes}
                      onChange={(event) => setEditRequestNotes(event.target.checked)}
                    />
                    <span>Request notes or production information</span>
                  </label>
                  <div className="meta-text">Leave both unchecked when this person does not need to submit anything.</div>
                </div>
              </div>
              <div className="people-field-row">
                <label className="people-field-toggle">Bio character limit override</label>
                <input
                  name="bioCharLimitOverride"
                  type="number"
                  min={100}
                  max={2000}
                  value={editBioCharLimitOverride}
                  onChange={(event) => setEditBioCharLimitOverride(event.target.value)}
                  placeholder={`Use show default${editPerson?.bio_char_limit ? ` (${editPerson.bio_char_limit})` : ""}`}
                />
                <div className="meta-text">
                  Leave blank to use the show default. Use this for guests or one-off limits.
                </div>
              </div>
              {editMessage ? <div className="alert-success">{editMessage}</div> : null}
              {editError ? <div className="alert">{editError}</div> : null}
              <div className="people-modal-actions">
                <button type="submit" disabled={isSavingEdit}>
                  {isSavingEdit ? "Saving..." : "Save Person"}
                </button>
                <button type="button" className="ghost-button" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
              <div className="people-field-row">
                <label className="people-field-toggle">Roles for this person</label>
                <div className="stack-sm">
                <div className="module-settings-empty">
                  <strong>Visible role summary:</strong> {getVisibleRoleSummary(editPersonRoles)}
                  <div className="meta-text">
                    Cast roles show first. Creative and production roles appear in parentheses when this person also has a cast role.
                  </div>
                </div>
                {editPersonRoles.length === 0 ? (
                  <div className="meta-text">No roles assigned yet.</div>
                  ) : (
                    editPersonRoles.map((role) => (
                      <div key={role.id} className="stack-sm">
                        <form onSubmit={(event) => handleRoleUpdate(event, role.id)} className="person-role-add-form">
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="drawerMode" value="true" />
                          <label>
                            Template
                            <select name="roleTemplateId" defaultValue={role.role_template_id ?? ""}>
                              <option value="">None</option>
                              {roleTemplates.map((template) => (
                                <option key={`role-edit-template-${role.id}-${template.id}`} value={template.id}>
                                  {template.name} ({template.category})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Role name
                            <input name="roleName" defaultValue={role.role_name} required />
                          </label>
                          <label>
                            Category
                            <select name="roleCategory" defaultValue={role.category}>
                              <option value="cast">cast</option>
                              <option value="creative">creative</option>
                              <option value="production">production</option>
                            </select>
                          </label>
                          <div className="row-wrap">
                            <button type="submit" className="ghost-button" disabled={savingRoleIds.has(role.id)}>
                              {savingRoleIds.has(role.id) ? "Saving..." : "Save Role"}
                            </button>
                            {roleMessages[role.id] ? (
                              <span className={`meta-text ${roleMessages[role.id].tone === "error" ? "danger-title" : ""}`}>
                                {roleMessages[role.id].text}
                              </span>
                            ) : null}
                          </div>
                        </form>
                        <form onSubmit={(event) => handleRoleRemove(event, role)} className="person-role-remove-form">
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="drawerMode" value="true" />
                          <button type="submit" className="ghost-button" disabled={savingRoleIds.has(role.id)}>Remove Role</button>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="people-field-row">
                <label className="people-field-toggle">Add role</label>
                <form onSubmit={handleRoleAdd} className="stack-sm person-role-add-form">
                <input type="hidden" name="personId" value={editPersonId} />
                <input type="hidden" name="drawerMode" value="true" />
                <label>
                  Role template (optional)
                  <select name="roleTemplateId" defaultValue="">
                    <option value="">None</option>
                    {roleTemplates.map((template) => (
                      <option key={`modal-template-${template.id}`} value={template.id}>
                        {template.name} ({template.category})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Role name
                  <input name="roleName" placeholder="If no template selected" />
                </label>
                <label>
                  Category fallback
                  <select name="roleCategory" defaultValue="production">
                    <option value="cast">cast</option>
                    <option value="creative">creative</option>
                    <option value="production">production</option>
                  </select>
                </label>
                <button type="submit" className="ghost-button" disabled={savingRoleIds.has("new-role")}>
                  {savingRoleIds.has("new-role") ? "Adding..." : "Add Role"}
                </button>
                {roleMessages["new-role"] ? (
                  <span className={`meta-text ${roleMessages["new-role"].tone === "error" ? "danger-title" : ""}`}>
                    {roleMessages["new-role"].text}
                  </span>
                ) : null}
              </form>
              {roleError === "duplicate" && highlightedPersonId && highlightedPersonId === editPersonId ? (
                <div className="meta-text danger-title">
                  Role already exists for this person{roleErrorRoleName ? `: ${roleErrorRoleName}` : ""}.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
