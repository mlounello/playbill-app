import Link from "next/link";
import { getCurrentUserWithProfile } from "@/lib/auth";

const publicNavItems = [
  { href: "/", label: "Home" },
  { href: "/programs", label: "Programs" },
  { href: "/api/health", label: "System Health" }
] as const;

const staffNavItems = [
  { href: "/app", label: "Admin" },
  { href: "/app/shows/new", label: "New Show" },
  { href: "/app/roles", label: "Roles" },
  { href: "/app/seasons", label: "Seasons" },
  { href: "/app/producing-profiles", label: "Profiles" }
] as const;

const contributorNavItems = [
  { href: "/contribute", label: "Contribute" }
] as const;

export async function SiteHeader() {
  const current = await getCurrentUserWithProfile();
  const isLoggedIn = Boolean(current?.user?.id);
  const role = current?.profile.platform_role ?? null;
  const showStaffNav = role === "owner" || role === "admin" || role === "editor";
  const showContributorNav = Boolean(role);

  return (
    <header className="site-header hide-print">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          Playbill Platform
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {publicNavItems.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav-link">
              {item.label}
            </Link>
          ))}
          {showStaffNav
            ? staffNavItems.map((item) => (
                <Link key={item.href} href={item.href} className="site-nav-link">
                  {item.label}
                </Link>
              ))
            : null}
          {showContributorNav
            ? contributorNavItems.map((item) => (
                <Link key={item.href} href={item.href} className="site-nav-link">
                  {item.label}
                </Link>
              ))
            : null}
          {isLoggedIn ? (
            <form action="/auth/signout" method="post" className="site-nav-form">
              <button type="submit" className="site-nav-link site-nav-button">
                Sign Out
              </button>
            </form>
          ) : (
            <Link href="/login" className="site-nav-link">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
