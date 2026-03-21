'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { User } from '../lib/types';

export function DashboardView() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listUsers().then(setUsers).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="card-grid">
      <section className="card">
        <h2>Admin dashboard</h2>
        <p>Här har du samma ansvar som i appen: användare, missions och kurs/hål admin.</p>
      </section>
      <section className="card">
        <h2>Användare</h2>
        {error ? <p>API-fel: {error}. Kontrollera backend routes och admin-token.</p> : null}
        {users.map((user) => (
          <div key={user.id} className="list-row static-row">
            <strong>{user.profile?.displayName ?? user.email}</strong>
            <span>{user.role} · {user.isActive ? 'Aktiv' : 'Inaktiv'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
