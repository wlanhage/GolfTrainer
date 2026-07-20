'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useJoinApi } from '@/lib/api';

/**
 * Uppgradera ett gästkonto (skapat via QR-join) till ett riktigt konto.
 * Rundan och alla scores ligger redan på kontot och följer med.
 */
export default function ClaimGuestPage() {
  const router = useRouter();
  const { me, reloadMe } = useAuth();
  const joinApi = useJoinApi();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }
    setSubmitting(true);
    try {
      await joinApi.claimGuest(email, password);
      await reloadMe();
      const roundId = new URLSearchParams(window.location.search).get('roundId');
      router.replace(roundId ? `/play/round/${roundId}/summary` : '/');
    } catch (err) {
      const message = (err as Error).message;
      setError(
        message.includes('CONFLICT') || message.includes('409')
          ? 'E-postadressen är redan registrerad.'
          : 'Kunde inte skapa kontot. Försök igen.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 flex flex-col gap-3 max-w-md mx-auto">
      <h1 className="text-2xl font-extrabold text-ink">Registrera och spara rundan</h1>
      <p className="text-sm text-slate-600">
        Skapa ett konto så sparas rundan du just spelat
        {me?.profile?.displayName ? ` som ${me.profile.displayName}` : ''} — annars försvinner
        den när du lämnar.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          autoComplete="email"
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Lösenord (minst 8 tecken)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Bekräfta lösenord"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
        />
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Skapar konto…' : 'Registrera och spara rundan'}
        </button>
      </form>
    </div>
  );
}
