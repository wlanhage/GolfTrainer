'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ClubDistance } from '../lib/types';

export function CaddyView() {
  const [clubs, setClubs] = useState<ClubDistance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.caddyClubs().then(setClubs).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="card">
      <h2>Caddy-klubbdata</h2>
      <p>Web-admin översikt för klubbdata och distances.</p>
      {error ? <p>API-fel: {error}</p> : null}
      {clubs.map((club) => (
        <div key={club.clubId} className="list-row static-row">
          <strong>{club.name}</strong>
          <span>Carry {club.carryDistance}m · Total {club.totalDistance}m · Shape {club.shotShape}</span>
        </div>
      ))}
    </div>
  );
}
