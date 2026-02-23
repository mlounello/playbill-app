export default function ShowWorkspaceLoading() {
  return (
    <main>
      <div className="container grid workspace-grid">
        <aside className="card workspace-sidebar">
          <div className="stack-sm">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="skeleton-line" style={{ height: "2rem", borderRadius: "999px" }} />
            ))}
          </div>
        </aside>
        <section className="page-shell">
          <div className="skeleton-line" style={{ width: "38%", height: "2rem" }} />
          <div className="card stack-sm">
            <div className="skeleton-line" style={{ width: "28%" }} />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" style={{ width: "72%" }} />
          </div>
          <div className="card stack-sm">
            <div className="skeleton-line" style={{ width: "24%" }} />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </section>
      </div>
    </main>
  );
}

