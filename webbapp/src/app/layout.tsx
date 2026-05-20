import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/AuthProvider';
import { ToastProvider } from '@/lib/ToastProvider';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { AppShell } from '@/components/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'GolfTrainer',
    template: '%s · GolfTrainer'
  },
  description: 'Spåra slag, spela rundor, träna missioner och följ andra golfare.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GolfTrainer'
  },
  openGraph: {
    type: 'website',
    siteName: 'GolfTrainer',
    title: 'GolfTrainer',
    description: 'Spåra slag, spela rundor, träna missioner och följ andra golfare.',
    locale: 'sv_SE'
  },
  twitter: {
    card: 'summary',
    title: 'GolfTrainer',
    description: 'Spåra slag, spela rundor, träna missioner och följ andra golfare.'
  }
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <ErrorBoundary>
          <I18nProvider>
            <AuthProvider>
              <ToastProvider>
                <AppShell>
                  <ErrorBoundary>{children}</ErrorBoundary>
                </AppShell>
              </ToastProvider>
            </AuthProvider>
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
