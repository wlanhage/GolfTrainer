import { SaveState } from '../hooks/useAutosave';
import { SaveStatusBadge } from './common/SaveStatusBadge';

type Layer = 'pan' | 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';

export function EditorToolbar({
  active,
  onSelect,
  onUndo,
  onRedo,
  onResetView,
  onSaveNow,
  canUndo,
  canRedo,
  saveState,
  lastSavedAt
}: {
  active: Layer;
  onSelect: (layer: Layer) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetView: () => void;
  onSaveNow: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: SaveState;
  lastSavedAt: Date | null;
}) {
  const tools: Layer[] = ['pan', 'tee', 'green', 'fairway', 'bunker', 'trees', 'ob'];
  return (
    <div className="editor-toolbar">
      <div className="hole-list">
        {tools.map((tool) => <button key={tool} className={active === tool ? 'active-chip' : 'chip'} onClick={() => onSelect(tool)}>{tool.toUpperCase()}</button>)}
        <button className="chip" disabled={!canUndo} onClick={onUndo}>Undo</button>
        <button className="chip" disabled={!canRedo} onClick={onRedo}>Redo</button>
        <button className="chip" onClick={onSaveNow}>Spara nu</button>
        <button className="chip" onClick={onResetView}>Reset view</button>
      </div>
      <SaveStatusBadge state={saveState} lastSavedAt={lastSavedAt} />
    </div>
  );
}
