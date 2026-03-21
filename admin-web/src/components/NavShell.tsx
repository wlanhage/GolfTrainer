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

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>GolfTrainer Admin</h1>
        <p>PC-läge för full kontroll</p>
        <nav>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? 'active' : ''}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => {
            api.tokenStorage.clear();
            router.replace('/login');
          }}
        >
          Logga ut
        </button>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
