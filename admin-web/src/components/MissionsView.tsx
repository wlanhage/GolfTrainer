'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Mission } from '../lib/types';

const initialForm = {
  slug: '',
  name: '',
  description: '',
  icon: '🎯',
  objective: '',
  scoreLabel: 'Poäng',
  scoreInputType: 'STEPPER' as const,
  status: 'PUBLISHED' as const
};

export function MissionsView() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listMissions().then(setMissions).catch((err) => setError(err.message));
  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    try {
      await api.createMission(form);
      setForm(initialForm);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="card-grid">
      <section className="card">
        <h2>Skapa mission</h2>
        <input placeholder="Slug" value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
        <input placeholder="Namn" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        <textarea placeholder="Beskrivning" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
        <input placeholder="Mål" value={form.objective} onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))} />
        <button onClick={create}>Skapa mission</button>
        {error ? <p>{error}</p> : null}
      </section>

      <section className="card">
        <h2>Befintliga missions</h2>
        {missions.map((mission) => (
          <div key={mission.id} className="list-row static-row">
            <strong>{mission.icon} {mission.name}</strong>
            <span>{mission.status} · {mission.slug}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
