'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { User } from '../lib/types';
import { EmptyState } from './common/EmptyState';
import { PageHeader } from './common/PageHeader';
import { EntityStatusBadge } from './common/EntityStatusBadge';

export function DashboardView() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listUsers().then(setUsers).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({ total: users.length, active: users.filter((u) => u.isActive).length, admins: users.filter((u) => u.role === 'ADMIN').length }), [users]);

  return (
    <>
      <PageHeader title="Dashboard" description="Översikt över adminsystemet och användare." />
      <div className="card-grid">
        <section className="card"><h3>Totalt användare</h3><strong>{stats.total}</strong></section>
        <section className="card"><h3>Aktiva</h3><strong>{stats.active}</strong></section>
        <section className="card"><h3>Admins</h3><strong>{stats.admins}</strong></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Användare</h2>
        {loading ? <p>Laddar användare...</p> : null}
        {error ? <p>API-fel: {error}</p> : null}
        {!loading && !error && users.length === 0 ? <EmptyState title="Inga användare" description="När användare skapas visas de här." /> : null}
        {users.map((user) => (
          <div key={user.id} className="list-row static-row">
            <strong>{user.profile?.displayName ?? user.email}</strong>
            <span>{user.role} · {user.isActive ? 'Aktiv' : 'Inaktiv'}</span>
            <EntityStatusBadge label={user.isActive ? 'Aktiv' : 'Inaktiv'} tone={user.isActive ? 'green' : 'red'} />
          </div>
        ))}
      </section>
    </>
  );
}
