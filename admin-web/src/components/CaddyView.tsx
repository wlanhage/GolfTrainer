'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { ClubDistance } from '../lib/types';
import { EmptyState } from './common/EmptyState';
import { PageHeader } from './common/PageHeader';

export function CaddyView() {
  const [clubs, setClubs] = useState<ClubDistance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'carryDistance'>('name');

  useEffect(() => {
    api.caddyClubs().then(setClubs).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const items = useMemo(() => {
    const filtered = clubs.filter((club) => club.name.toLowerCase().includes(query.toLowerCase()));
    return [...filtered].sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b.carryDistance - a.carryDistance);
  }, [clubs, query, sortBy]);

  return (
    <>
      <PageHeader title="Caddy" description="Klubbtabell med filter och sortering." />
      <section className="card">
        <div className="hole-list">
          <input placeholder="Sök klubb" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'name' | 'carryDistance')}>
            <option value="name">Sortera: Namn</option>
            <option value="carryDistance">Sortera: Carry</option>
          </select>
        </div>
        {loading ? <p>Laddar caddy-data...</p> : null}
        {error ? <p>API-fel: {error}</p> : null}
        {!loading && !error && items.length === 0 ? <EmptyState title="Ingen klubbdata" description="Ingen träff för valt filter." /> : null}
        {items.map((club) => (
          <div key={club.clubId} className="list-row static-row">
            <strong>{club.name}</strong>
            <span>Carry {club.carryDistance}m · Total {club.totalDistance}m · Shape {club.shotShape}</span>
          </div>
        ))}
      </section>
    </>
  );
}
