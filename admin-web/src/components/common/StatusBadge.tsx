import { SaveState } from '../../hooks/useAutosave';

const labels: Record<SaveState, string> = {
  saved: 'Sparat lokalt',
  unsaved: 'Osparade ändringar',
  saving: 'Sparar...',
  error: 'Fel vid sparning'
};

export function StatusBadge({ state }: { state: SaveState }) {
  return <span className={`status-badge ${state}`}>{labels[state]}</span>;
}
