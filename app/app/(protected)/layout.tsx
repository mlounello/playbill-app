import { requireRole } from "@/lib/auth";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const current = await requireRole(["owner", "admin", "editor"]);

  return (
    <>
      <div className="container hide-print" style={{ paddingBottom: 0 }}>
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.8rem",
            flexWrap: "wrap"
          }}
        >
          <div>
            Signed in as <strong>{current.profile.email}</strong> ({current.profile.platform_role})
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit">Sign Out</button>
          </form>
        </div>
      </div>
      {children}
    </>
  );
}
