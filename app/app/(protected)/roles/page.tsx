import Link from "next/link";
import { FlashToast } from "@/components/flash-toast";
import {
  createRoleTemplate,
  deleteRoleTemplate,
  getRoleLibraryData,
  importRolesFromPaste,
  updateRoleTemplate
} from "@/lib/roles";

export default async function RolesLibraryPage({
  searchParams
}: {
  searchParams: Promise<{ showId?: string; error?: string; success?: string }>;
}) {
  const { showId, error, success } = await searchParams;
  const data = await getRoleLibraryData(showId ?? "");

  return (
    <main>
      <div className="container page-shell">
        <div className="title-row">
          <h1>Role Library</h1>
          <Link className="button-link" href="/app/shows">
            Back to Shows
          </Link>
        </div>

        <FlashToast message={error} tone="error" />
        <FlashToast message={success} tone="success" />

        <section className="card stack-sm">
          <strong>Create Role Template</strong>
          <form action={createRoleTemplate} className="stack-sm">
            <div className="form-row-2">
              <label>
                Role name
                <input name="name" required placeholder="Lighting Designer" />
              </label>
              <label>
                Category
                <select name="category" defaultValue="production">
                  <option value="cast">cast</option>
                  <option value="creative">creative</option>
                  <option value="production">production</option>
                </select>
              </label>
            </div>
            <div className="form-row-2">
              <label>
                Scope
                <select name="scope" defaultValue="global">
                  <option value="global">global (reused)</option>
                  <option value="show_only">show_only (cast defaults)</option>
                </select>
              </label>
              <label>
                Show (required for show_only)
                <select name="showId" defaultValue={data.selectedShowId}>
                  <option value="">Select show</option>
                  {data.shows.map((show) => (
                    <option key={show.id} value={show.id}>
                      {show.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit">Create Role</button>
          </form>
        </section>

        <section className="card stack-sm">
          <strong>Paste / CSV Import</strong>
          <p className="section-note">
            Accepted format: <code>Role | Category | Scope | Show</code> per line, or CSV with headers
            <code> role, category, scope, show</code>. For <code>show_only</code>, show can be id, slug, or show title.
          </p>
          <form action={importRolesFromPaste} className="stack-sm">
            <textarea
              name="rows"
              className="rich-textarea"
              placeholder={"Lighting Designer | creative | global\nJuliet | cast | show_only | rumors-0298"}
              required
            />
            <button type="submit">Import Roles From Paste</button>
          </form>
        </section>

        <section className="card stack-sm">
          <strong>Filter</strong>
          <form action="/app/roles" method="get" className="top-actions">
            <label>
              Show filter
              <select name="showId" defaultValue={data.selectedShowId}>
                <option value="">All roles</option>
                {data.shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
        </section>

        <section className="card stack-sm">
          <strong>Existing Roles ({data.roles.length})</strong>
          {data.roles.length === 0 ? (
            <div className="meta-text">No roles found.</div>
          ) : (
            <div className="stack-sm">
              {data.roles.map((role) => (
                <article key={role.id} className="card card-soft stack-sm">
                  <form action={updateRoleTemplate} className="stack-sm">
                    <input type="hidden" name="id" value={role.id} />
                    <div className="form-row-2">
                      <label>
                        Role name
                        <input name="name" defaultValue={role.name} required />
                      </label>
                      <label>
                        Category
                        <select name="category" defaultValue={role.category}>
                          <option value="cast">cast</option>
                          <option value="creative">creative</option>
                          <option value="production">production</option>
                        </select>
                      </label>
                    </div>
                    <div className="form-row-2">
                      <label>
                        Scope
                        <select name="scope" defaultValue={role.scope}>
                          <option value="global">global</option>
                          <option value="show_only">show_only</option>
                        </select>
                      </label>
                      <label>
                        Show
                        <select name="showId" defaultValue={role.show_id ?? ""}>
                          <option value="">None</option>
                          {data.shows.map((show) => (
                            <option key={show.id} value={show.id}>
                              {show.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                      <input type="checkbox" name="isHidden" defaultChecked={role.is_hidden} />
                      Hidden
                    </label>
                    <div className="meta-text">
                      {role.scope === "show_only" ? `show_only for ${role.show_title || "selected show"}` : "global"}
                    </div>
                    <button type="submit">Save Role</button>
                  </form>
                  <form action={deleteRoleTemplate}>
                    <input type="hidden" name="id" value={role.id} />
                    <button type="submit">Delete Role</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
