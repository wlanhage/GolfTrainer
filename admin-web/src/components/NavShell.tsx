'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '../lib/api';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/courses', label: 'Banor & Hål' },
  { href: '/missions', label: 'Träning/Missions' },
  { href: '/caddy', label: 'Caddy' }
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const crumb = pathname.split('/').filter(Boolean).join(' / ') || 'dashboard';

  const confirmIfUnsaved = () => {
    if (typeof window === 'undefined') return true;
    const unsaved = window.localStorage.getItem('gt_admin_unsaved_changes_v1') === '1';
    if (!unsaved) return true;
    return window.confirm('Du har osparade ändringar. Vill du lämna sidan?');
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-left">
          <h1>GolfTrainer Admin</h1>
          <span>Desktop kontrollpanel · {crumb}</span>
        </div>
        <nav className="top-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? 'active' : ''} onClick={(event) => { if (!confirmIfUnsaved()) event.preventDefault(); }}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          className="logout-btn"
          onClick={() => {
            if (!confirmIfUnsaved()) return;
            api.tokenStorage.clear();
            router.replace('/login');
          }}
        >
          Logga ut
        </button>
      </header>

      <main className="page-content">{children}</main>
    </div>
  );
}
