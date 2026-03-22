import './globals.css';
import { AuthGuard } from '../components/AuthGuard';
import { ToastProvider } from '../components/common/ToastProvider';

export const metadata = {
  title: 'GolfTrainer Admin Web',
  description: 'Desktop admin view for course, hole, mission and caddy management.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <ToastProvider><AuthGuard>{children}</AuthGuard></ToastProvider>
      </body>
    </html>
  );
}
