import { SaveState } from '../../hooks/useAutosave';
import { StatusBadge } from './StatusBadge';

export function SaveStatusBadge({ state, lastSavedAt }: { state: SaveState; lastSavedAt: Date | null }) {
  return (
    <div className="save-status-wrap">
      <StatusBadge state={state} />
      <span className="small-note">Senast sparad: {lastSavedAt ? lastSavedAt.toLocaleTimeString('sv-SE') : '—'}</span>
    </div>
  );
}
