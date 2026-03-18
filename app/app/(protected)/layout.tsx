import { requireRole } from "@/lib/auth";
import { AdminDensityToggle } from "@/components/admin-density-toggle";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const current = await requireRole(["owner", "admin", "editor"]);

  return (
    <>
      <div className="container container-wide hide-print" style={{ paddingBottom: 0 }}>
        <div className="card row-between">
          <div>
            Signed in as <strong>{current.profile.email}</strong> ({current.profile.platform_role})
          </div>
          <div className="top-actions">
            <AdminDensityToggle />
            <form action="/auth/signout" method="post">
              <button type="submit">Sign Out</button>
            </form>
          </div>
        </div>
      </div>
      <div className="admin-surface">{children}</div>
    </>
  );
}
