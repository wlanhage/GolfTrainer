'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useT } from '@/lib/i18n/I18nProvider';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const t = useT();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await register({ displayName, email, password });
      router.replace('/welcome');
    } catch {
      setError(t('auth.registerFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 gap-3 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-3">{t('auth.createAccount')}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input placeholder={t('auth.name')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
        <input type="email" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        <input type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        <input type="password" placeholder={t('auth.confirmPassword')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" />
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? t('auth.registering') : t('auth.register')}
        </button>
      </form>
      <Link href="/login" className="text-center text-primary font-semibold mt-2">
        {t('auth.hasAccount')}
      </Link>
    </div>
  );
}
