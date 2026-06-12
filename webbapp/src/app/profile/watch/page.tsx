'use client';

import { useState, type FormEvent } from 'react';
import { Watch, Check } from 'lucide-react';
import { useWatchApi } from '@/lib/api';

export default function WatchPairingPage() {
  const watchApi = useWatchApi();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    setStatus('loading');
    setError('');
    try {
      await watchApi.pairClaim(clean);
      setStatus('done');
    } catch {
      setStatus('error');
      setError('Koden är ogiltig eller har gått ut. Kontrollera koden på klockan och försök igen.');
    }
  };

  if (status === 'done') {
    return (
      <div className="px-5 py-8 max-w-md mx-auto flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="text-green-600" size={32} />
        </div>
        <h1 className="text-2xl font-bold">Klockan är parad!</h1>
        <p className="text-sm text-slate-500">
          Din Apple Watch loggas in automatiskt inom någon sekund och håller sig inloggad.
        </p>
        <button
          onClick={() => {
            setStatus('idle');
            setCode('');
          }}
          className="btn-secondary mt-2"
        >
          Para en till
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-md mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Watch size={26} className="text-primary" />
        <h1 className="text-2xl font-bold">Para Apple Watch</h1>
      </div>
      <p className="text-sm text-slate-600">
        Öppna golf-appen på din Apple Watch och skriv in koden som visas där.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="4K7PQH"
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          className="input text-center text-2xl font-mono tracking-[0.35em] uppercase"
        />
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        <button
          type="submit"
          disabled={status === 'loading' || code.trim().length < 4}
          className="btn-primary disabled:opacity-50"
        >
          {status === 'loading' ? 'Parar…' : 'Para klockan'}
        </button>
      </form>

      <p className="text-xs text-slate-400">
        Koden visas på klockans paringsskärm och gäller i 10 minuter.
      </p>
    </div>
  );
}
