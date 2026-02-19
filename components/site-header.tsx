import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/programs/new", label: "New Program" },
  { href: "/api/health", label: "System Health" }
];

export function SiteHeader() {
  return (
    <header className="site-header hide-print">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          Playbill Platform
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
