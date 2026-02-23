import Link from "next/link";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { getContributorTasksForCurrentUser } from "@/lib/submissions";

export default async function ContributorHomePage() {
  const current = await getCurrentUserWithProfile();
  const tasks = await getContributorTasksForCurrentUser();

  return (
    <main>
      <div className="container page-shell page-shell-narrow">
        <h1>Contributor Portal</h1>
        {current ? (
          <section className="card">
            Signed in as <strong>{current.profile.email}</strong> ({current.profile.platform_role})
          </section>
        ) : null}
        {tasks.length === 0 ? (
          <section className="card stack-sm">
            <p className="section-note">No tasks are assigned to your email yet.</p>
            <Link href="/programs">Browse public programs</Link>
          </section>
        ) : (
          <section className="card stack-sm">
            <strong>Your Tasks ({tasks.length})</strong>
            {tasks.map((task) => (
              <article key={`${task.show_id}-${task.person_id}`} className="card card-soft">
                <div className="row-between">
                  <div>
                    <strong>{task.show_title}</strong>
                    <div>{task.person_name} - {task.role_title}</div>
                    <div className="meta-text">
                      Status: <span className="status-pill">{task.submission_status}</span>
                      {task.due_date ? ` • Due ${new Date(task.due_date).toLocaleDateString("en-US")}` : ""}
                    </div>
                  </div>
                  <div className="link-row">
                    <Link href={`/contribute/shows/${task.show_id}/tasks/${task.person_id}`}>Open Task</Link>
                    <Link href={`/programs/${task.program_slug}`}>Preview Program</Link>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
        <form action="/auth/signout" method="post" className="hide-print">
          <button type="submit">Sign Out</button>
        </form>
      </div>
    </main>
  );
}
