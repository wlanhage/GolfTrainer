'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Mission } from '../lib/types';
import { ConfirmDialog } from './common/ConfirmDialog';
import { EmptyState } from './common/EmptyState';
import { PageHeader } from './common/PageHeader';
import { EntityStatusBadge } from './common/EntityStatusBadge';
import { useToast } from './common/ToastProvider';

const initialForm = { slug: '', name: '', description: '', icon: '🎯', objective: '', scoreLabel: 'Poäng', scoreInputType: 'STEPPER' as const, status: 'PUBLISHED' as const };

export function MissionsView() {
  const { push } = useToast();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => api.listMissions().then(setMissions).catch((err) => setError(err.message)).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const create = async () => {
    if (form.slug.trim().length < 2 || form.name.trim().length < 2) {
      setError('Slug och namn måste vara minst 2 tecken.');
      return;
    }

    try {
      await api.createMission(form);
      setForm(initialForm);
      push('Mission skapad', 'success');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Missions" description="Skapa, granska och ta bort träningsmissions." />
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
          {loading ? <p>Laddar missions...</p> : null}
          {!loading && !error && missions.length === 0 ? <EmptyState title="Inga missions" description="Skapa första missionen till vänster." /> : null}
          {missions.map((mission) => (
            <div key={mission.id} className="list-row static-row">
              <strong>{mission.icon} {mission.name}</strong>
              <span>{mission.status} · {mission.slug}</span>
              <div className="hole-list">
                <EntityStatusBadge label={mission.status} tone={mission.status === 'PUBLISHED' ? 'green' : mission.status === 'DRAFT' ? 'yellow' : 'red'} />
                <button className="chip" onClick={() => setDeleteId(mission.id)}>Ta bort</button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Ta bort mission"
        message="Är du säker?"
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await api.deleteMission(deleteId);
          setDeleteId(null);
          push('Mission borttagen', 'info');
          reload();
        }}
      />
    </>
  );
}
