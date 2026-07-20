'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useJoinApi } from '@/lib/api';
import { joinApi, type InviteInfo } from '@/lib/joinApi';

const POLL_MS = 4000;

/**
 * Publik landningssida för QR-join: "Joina X:s runda på Kaddy".
 * Välj att spela som inloggad användare (logga in / registrera) eller som
 * gäst med bara ett namn. Om rundan inte startats än pollas den tills den
 * finns.
 */
export default function JoinRoundPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params?.code ?? '');
  const { status, me, adoptTokens } = useAuth();
  const authedJoinApi = useJoinApi();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hämta + polla invite-info tills rundan är igång
  useEffect(() => {
    if (!code) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const next = await joinApi.getInviteInfo(code);
        if (!active) return;
        setInfo(next);
        setLoadError(null);
        if (!next.round) timer = setTimeout(() => void load(), POLL_MS);
      } catch (e) {
        if (!active) return;
        setLoadError((e as Error).message);
      }
    };
    void load();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [code]);

  const goToRound = useCallback(
    (roundId: string, holeNumber: number) => {
      router.replace(`/play/round/${roundId}/${holeNumber}`);
    },
    [router]
  );

  const joinAsUser = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authedJoinApi.joinAsUser(code);
      goToRound(result.roundId, result.currentHoleNumber);
    } catch {
      setError('Kunde inte joina rundan. Försök igen.');
      setSubmitting(false);
    }
  };

  const joinAsGuest = async () => {
    if (submitting) return;
    const name = guestName.trim();
    if (name.length < 2) {
      setError('Ange ditt namn (minst 2 tecken).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await joinApi.joinAsGuest(code, name);
      await adoptTokens(result.tokens);
      goToRound(result.roundId, result.currentHoleNumber);
    } catch {
      setError('Kunde inte joina rundan. Försök igen.');
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 gap-3 text-center">
        <h1 className="text-2xl font-extrabold text-ink">Hoppsan!</h1>
        <p className="text-slate-600">{loadError}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">Laddar…</div>
    );
  }

  const roundReady = info.round !== null;
  const roundOver = info.roundStatus === 'COMPLETED' || info.roundStatus === 'ABANDONED';
  const isLoggedInUser = status === 'authenticated' && me && me.isGuest !== true;

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 py-8 gap-4 max-w-md mx-auto">
      <header className="text-center flex flex-col gap-1">
        <p className="text-xs uppercase tracking-widest font-bold text-primary">Kaddy</p>
        <h1 className="text-2xl font-extrabold text-ink leading-tight">
          Joina {info.hostName}s runda
        </h1>
        {info.round ? (
          <p className="text-sm text-slate-500">
            {info.round.courseName} · {info.round.clubName}
          </p>
        ) : roundOver ? (
          <p className="text-sm text-slate-500">Rundan är redan avslutad.</p>
        ) : (
          <p className="text-sm text-slate-500">
            Rundan har inte startat än — sidan uppdateras automatiskt.
          </p>
        )}
      </header>

      {roundOver ? null : (
        <>
          <p className="text-center text-sm font-bold text-slate-600 uppercase tracking-wider mt-2">
            Spela som
          </p>

          {/* Användare */}
          <section className="bg-white border-2 border-border rounded-2xl p-4 flex flex-col gap-2">
            <h2 className="font-extrabold text-ink">Användare</h2>
            {isLoggedInUser ? (
              <button
                onClick={() => void joinAsUser()}
                disabled={!roundReady || submitting}
                className="btn-primary disabled:opacity-50"
              >
                {roundReady
                  ? `Gå med som ${me?.profile?.displayName ?? 'mig'}`
                  : 'Väntar på att rundan startar…'}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => router.push(`/login?next=/join/${code}`)}
                  className="btn-primary"
                >
                  Logga in
                </button>
                <button
                  onClick={() => router.push(`/register?next=/join/${code}`)}
                  className="btn-ghost border-2 border-border rounded-xl py-2.5 font-bold"
                >
                  Registrera
                </button>
              </div>
            )}
          </section>

          {/* Gäst */}
          <section className="bg-white border-2 border-border rounded-2xl p-4 flex flex-col gap-2">
            <h2 className="font-extrabold text-ink">Gäst</h2>
            <p className="text-xs text-slate-500">
              Spela utan konto — ange bara ditt namn. Du kan spara rundan genom att
              registrera dig efteråt.
            </p>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ditt namn"
              className="input"
              maxLength={40}
            />
            <button
              onClick={() => void joinAsGuest()}
              disabled={!roundReady || submitting}
              className="btn-primary disabled:opacity-50"
            >
              {roundReady ? 'Spela som gäst' : 'Väntar på att rundan startar…'}
            </button>
          </section>

          {error ? <p className="text-danger text-sm text-center">{error}</p> : null}
        </>
      )}
    </div>
  );
}
