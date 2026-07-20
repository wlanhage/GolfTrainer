'use client';

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Labelat inputfält med ikon till vänster och valfri knapp till höger. */
function Field({
  label,
  icon,
  trailing,
  children
}: {
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative flex items-center">
        <span className="absolute left-3.5 text-slate-400 pointer-events-none">{icon}</span>
        {children}
        {trailing ? <span className="absolute right-2">{trailing}</span> : null}
      </span>
    </label>
  );
}

/** Rad i krav-checklistan under lösenordsfälten. */
function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
        met ? 'text-primary' : 'text-slate-400'
      }`}
    >
      <span
        className={`flex items-center justify-center w-4 h-4 rounded-full transition-colors ${
          met ? 'bg-primary text-white' : 'bg-slate-200 text-transparent'
        }`}
      >
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      </span>
      {label}
    </span>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = displayName.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const passwordOk = password.length >= 8;
  const matchOk = confirmPassword.length > 0 && confirmPassword === password;
  const formOk = nameOk && emailOk && passwordOk && matchOk;

  const inputClass =
    'input w-full pl-10 placeholder:text-slate-400';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formOk || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password });
      const next = new URLSearchParams(window.location.search).get('next');
      router.replace(next && next.startsWith('/') ? next : '/welcome');
    } catch (err) {
      setError(
        (err as Error).message === 'EMAIL_TAKEN'
          ? 'Det finns redan ett konto med den e-postadressen. Prova att logga in i stället.'
          : 'Kontot kunde inte skapas just nu. Kontrollera uppgifterna och försök igen.'
      );
      setSubmitting(false);
    }
  };

  // Bevara ev. ?next= (t.ex. QR-join-flödet) på länken till inloggningen.
  // Sätts i effect för att undvika hydration-skillnad mot serverns render.
  const [loginHref, setLoginHref] = useState('/login');
  useEffect(() => {
    if (window.location.search) setLoginHref(`/login${window.location.search}`);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-softer via-white to-white">
      <div className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto px-5 py-10">
        {/* Brand */}
        <header className="flex flex-col items-center text-center gap-3 mb-8">
          <img
            src="/icon.png"
            alt=""
            aria-hidden="true"
            className="w-16 h-16 rounded-2xl shadow-lg shadow-primary/20"
          />
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] font-bold text-primary">Kaddy</p>
            <h1 className="text-3xl font-extrabold text-ink leading-tight mt-1">Skapa ditt konto</h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-[34ch] mx-auto">
              Följ dina rundor, spela med vänner och se din golf bli bättre.
            </p>
          </div>
        </header>

        {/* Form card */}
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="bg-white border border-border rounded-3xl p-5 shadow-sm flex flex-col gap-4"
          noValidate
        >
          <Field label="Namn" icon={<User size={18} aria-hidden="true" />}>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ditt namn"
              autoComplete="name"
              maxLength={40}
              className={inputClass}
            />
          </Field>

          <Field label="E-post" icon={<Mail size={18} aria-hidden="true" />}>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
              autoComplete="email"
              className={inputClass}
            />
          </Field>

          <Field
            label="Lösenord"
            icon={<Lock size={18} aria-hidden="true" />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
                className="p-2 text-slate-400 active:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          >
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 8 tecken"
              autoComplete="new-password"
              className={`${inputClass} pr-11`}
            />
          </Field>

          <Field label="Bekräfta lösenord" icon={<Lock size={18} aria-hidden="true" />}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Samma lösenord igen"
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>

          {/* Live-krav */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 -mt-1">
            <Requirement met={passwordOk} label="Minst 8 tecken" />
            <Requirement met={matchOk} label="Lösenorden matchar" />
          </div>

          {error ? (
            <p
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3.5 py-2.5"
            >
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={!formOk || submitting} className="btn-primary mt-1">
            {submitting ? 'Skapar konto…' : 'Skapa konto'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Har du redan ett konto?{' '}
          <Link href={loginHref} className="text-primary font-bold">
            Logga in
          </Link>
        </p>
      </div>
    </div>
  );
}
