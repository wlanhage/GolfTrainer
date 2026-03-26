import { SaveState } from '../hooks/useAutosave';
import { SaveStatusBadge } from './common/SaveStatusBadge';

type Layer = 'pan' | 'tee' | 'green' | 'fairway' | 'bunker' | 'trees' | 'ob';

export function EditorToolbar({
  active,
  onSelect,
  onUndo,
  onRedo,
  onClearActiveLayer,
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
  onClearActiveLayer: () => void;
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
        <button className="chip" onClick={onClearActiveLayer}>Rensa aktivt lager</button>
      </div>
      <div className="save-status-wrap">
        <SaveStatusBadge state={saveState} lastSavedAt={lastSavedAt} />
        <button className="chip" onClick={onSaveNow}>Spara nu</button>
      </div>
    </div>
  );
}
