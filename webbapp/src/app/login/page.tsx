'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useT } from '@/lib/i18n/I18nProvider';
import { API_BASE_URL } from '@/lib/config';

export default function LoginPage() {
  const { login } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warm up Render's cold-started backend while the user types so the actual
  // POST /auth/login doesn't eat the first ~30s of spin-up time.
  useEffect(() => {
    const healthUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, '') + '/health';
    fetch(healthUrl, { method: 'GET', cache: 'no-store' }).catch(() => undefined);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 gap-3 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-3">{t('title.brand')}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          autoComplete="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>
      <Link href="/register" className="text-center text-primary font-semibold mt-2">
        {t('auth.noAccount')}
      </Link>
    </div>
  );
}
