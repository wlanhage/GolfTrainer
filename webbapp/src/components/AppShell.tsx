'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronLeft, Users, Target, Home, Play, Briefcase } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useT } from '@/lib/i18n/I18nProvider';
import { UserAvatar } from './UserAvatar';
import { Loader } from './Loader';

const BASE_ROUTES = new Set(['/', '/play', '/training', '/caddy', '/community', '/profile']);

const isSubPage = (path: string): boolean => !BASE_ROUTES.has(path) && !path.startsWith('/admin');

const TAB_ITEMS = [
  { href: '/community', labelKey: 'nav.communityShort', icon: Users },
  { href: '/training', labelKey: 'nav.trainingShort', icon: Target },
  { href: '/', labelKey: 'nav.homeShort', icon: Home },
  { href: '/play', labelKey: 'nav.playShort', icon: Play },
  { href: '/caddy', labelKey: 'nav.caddyShort', icon: Briefcase },
] as const;

const titleKeyForPath = (path: string): string => {
  const exact: Record<string, string> = {
    '/': 'title.home',
    '/play': 'title.play',
    '/play/add': 'title.addCourse',
    '/training': 'title.training',
    '/caddy': 'title.caddy',
    '/caddy/edit': 'title.editCaddy',
    '/profile': 'title.profile',
    '/profile/settings': 'title.settings',
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

const activeTab = (pathname: string): string => {
  if (pathname === '/') return '/';
  for (const tab of TAB_ITEMS) {
    if (tab.href !== '/' && pathname.startsWith(tab.href)) return tab.href;
  }
  if (pathname.startsWith('/u/')) return '/community';
  return '/';
};

export function AppShell({ children }: { children: ReactNode }) {
  const { status, me } = useAuth();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  // Gästkonton (QR-join) har bara tillgång till spel-relaterade vyer.
  const isGuestUser = me?.isGuest === true;
  const guestAllowed = (path: string) =>
    path.startsWith('/play') || path.startsWith('/join') || path === '/register/claim';

  useEffect(() => {
    if (status === 'loading') return;
    const isAuthRoute = pathname === '/login' || pathname === '/register';
    const isPublicRoute = isAuthRoute || pathname === '/welcome' || pathname.startsWith('/join/');
    if (status === 'guest' && !isPublicRoute) router.replace('/login');
    if (status === 'authenticated' && isAuthRoute) {
      // Auth-sidor kan skickas en ?next= (t.ex. tillbaka till QR-join-sidan)
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
    }
    if (status === 'authenticated' && pathname.startsWith('/admin') && me?.role !== 'ADMIN') {
      router.replace('/');
    }
    if (status === 'authenticated' && isGuestUser && !isAuthRoute && !guestAllowed(pathname)) {
      router.replace('/play');
    }
  }, [status, pathname, router, me?.role, isGuestUser]);

  const isAuthRoute = pathname === '/login' || pathname === '/register';
  const isWelcome = pathname === '/welcome';
  const isJoinRoute = pathname.startsWith('/join/');
  const isAdminPath = pathname.startsWith('/admin');

  if (
    status === 'loading' ||
    (status === 'guest' && !isAuthRoute && !isWelcome && !isJoinRoute) ||
    (status === 'authenticated' && isAuthRoute) ||
    (status === 'authenticated' && isAdminPath && me?.role !== 'ADMIN') ||
    (status === 'authenticated' && isGuestUser && !guestAllowed(pathname))
  ) {
    return <Loader fullScreen />;
  }

  if (isAuthRoute || isWelcome || isJoinRoute) {
    return <main className="min-h-screen bg-white">{children}</main>;
  }

  const fullscreen = pathname.startsWith('/play/round/') && !pathname.includes('/overview');
  if (fullscreen) {
    return <main className="min-h-screen bg-slate-900">{children}</main>;
  }

  const showBack = isSubPage(pathname);
  const current = activeTab(pathname);

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-white border-b border-border px-3 py-2 shadow-sm">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="flex items-center justify-center w-11 h-11 text-primary"
          >
            <ChevronLeft size={26} />
          </button>
        ) : (
          <div className="w-11 h-11" />
        )}
        <h1 className="flex-1 text-center text-base font-bold text-ink truncate">
          {t(titleKeyForPath(pathname))}
        </h1>
        {isGuestUser ? (
          <div className="flex items-center justify-center" aria-hidden="true">
            <UserAvatar displayName={me?.profile?.displayName} size={40} />
          </div>
        ) : (
          <Link href="/profile" className="flex items-center justify-center">
            <UserAvatar
              avatarImage={me?.profile?.avatarImage}
              displayName={me?.profile?.displayName}
              email={me?.email}
              size={40}
            />
          </Link>
        )}
      </header>

      <main className="max-w-3xl mx-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="pwa-bottom-nav fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className={`max-w-3xl mx-auto grid ${isGuestUser ? 'grid-cols-1' : 'grid-cols-5'}`}>
          {(isGuestUser ? TAB_ITEMS.filter((tab) => tab.href === '/play') : TAB_ITEMS).map(({ href, labelKey, icon: Icon }) => {
            const active = current === href;
            return (
              <Link
                key={href}
                href={href}
                className={`pwa-nav-tab flex flex-col items-center gap-0.5 py-2 transition-all duration-200 ${
                  active
                    ? 'text-primary scale-105'
                    : 'text-slate-400 active:scale-95'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`pwa-nav-label text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
                  {t(labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
