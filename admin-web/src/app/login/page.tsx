'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form className="card" style={{ width: '100%', maxWidth: 420 }} onSubmit={submit}>
        <h1>GolfTrainer Admin</h1>
        <p>Logga in med adminkonto.</p>
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} placeholder="Lösenord" />
        <button type="submit">Logga in</button>
        {error ? <p>{error}</p> : null}
      </form>
    </main>
  );
}
