'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useI18n, useT } from '@/lib/i18n/I18nProvider';
import { SUPPORTED_LOCALES, localeLabel } from '@/lib/i18n/dictionaries';
import { UserAvatar } from './UserAvatar';

const MENU_KEYS: Array<{ href: string; key: string }> = [
  { href: '/', key: 'nav.home' },
  { href: '/play', key: 'nav.play' },
  { href: '/training', key: 'nav.training' },
  { href: '/caddy', key: 'nav.caddy' },
  { href: '/community', key: 'nav.community' },
  { href: '/profile', key: 'nav.profile' },
  { href: '/admin', key: 'nav.admin' }
];

const titleKeyForPath = (path: string): string => {
  const exact: Record<string, string> = {
    '/': 'title.home',
    '/play': 'title.play',
    '/play/add': 'title.addCourse',
    '/training': 'title.training',
    '/caddy': 'title.caddy',
    '/caddy/edit': 'title.editCaddy',
    '/profile': 'title.profile',
    '/community': 'title.community',
    '/admin': 'title.admin',
    '/admin/courses': 'title.adminCourses'
  };
  if (exact[path]) return exact[path];
  if (path.startsWith('/training/')) return 'title.training';
  if (path.startsWith('/u/')) {
    if (path.endsWith('/followers')) return 'title.followers';
    if (path.endsWith('/following')) return 'title.following';
    return 'title.profile';
  }
  if (path.startsWith('/caddy/')) return 'title.caddy';
  if (path.startsWith('/admin/courses/')) return 'title.adminCourses';
  if (path.startsWith('/play/round/') && path.includes('/overview')) return 'title.roundOverview';
  if (path.startsWith('/play/scorecard/')) return 'title.scorecardSetup';
  return 'title.brand';
};

export function AppShell({ children }: { children: ReactNode }) {
  const { status, me, logout } = useAuth();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status === 'loading') return;
    const isAuthRoute = pathname === '/login' || pathname === '/register';
    if (status === 'guest' && !isAuthRoute) router.replace('/login');
    if (status === 'authenticated' && isAuthRoute) router.replace('/');
    if (status === 'authenticated' && pathname.startsWith('/admin') && me?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [status, pathname, router, me?.role]);

  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isAdminPath = pathname.startsWith('/admin');

  if (
    status === 'loading' ||
    (status === 'guest' && !isAuthRoute) ||
    (status === 'authenticated' && isAuthRoute) ||
    (status === 'authenticated' && isAdminPath && me?.role !== 'ADMIN')
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-muted">{t('common.loading')}</div>
      </div>
    );
  }

  if (isAuthRoute) {
    return <main className="min-h-screen bg-white">{children}</main>;
  }

  const fullscreen = pathname.startsWith('/play/round/') && !pathname.includes('/overview');
  if (fullscreen) {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-white border-b border-border px-3 py-2 shadow-sm">
        <button
          aria-label={t('nav.openMenu')}
          onClick={() => setMenuOpen(true)}
          className="flex items-center justify-center w-11 h-11 text-2xl text-primary"
        >
          ☰
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-ink truncate">{t(titleKeyForPath(pathname))}</h1>
        <Link href="/profile" className="flex items-center justify-center">
          <UserAvatar
            avatarImage={me?.profile?.avatarImage}
            displayName={me?.profile?.displayName}
            email={me?.email}
            size={40}
          />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto">{children}</main>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 flex">
          <aside className="w-3/4 max-w-sm bg-white p-5 flex flex-col gap-3 shadow-2xl">
            <h2 className="text-xl font-extrabold text-primary">{t('nav.menu')}</h2>
            {MENU_KEYS.filter((item) => item.href !== '/admin' || me?.role === 'ADMIN').map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-3 font-semibold border-2 transition ${
                    active ? 'bg-primary text-white border-primary' : 'bg-white text-ink border-border'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {t(item.key)}
                </Link>
              );
            })}
            <div className="flex-1" />
            <div className="flex gap-2 mb-2">
              {SUPPORTED_LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold border ${
                    locale === l ? 'bg-primary border-primary text-white' : 'bg-white text-primary border-primary'
                  }`}
                >
                  {localeLabel(l)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="border-2 border-danger text-danger rounded-xl px-3 py-3 bg-white font-bold"
            >
              {t('nav.logout')}
            </button>
          </aside>
          <button aria-label={t('nav.closeMenu')} className="flex-1 bg-slate-900/30" onClick={() => setMenuOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
