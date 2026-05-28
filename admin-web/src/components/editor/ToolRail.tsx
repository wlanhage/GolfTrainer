import { Layer, LAYERS, LayerGlyph, PanGlyph, Tool } from './layers';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.3 3.9M6.6 6.6A16 16 0 0 0 2 12s3.5 6 10 6a9.4 9.4 0 0 0 3.4-.6" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      {locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7.5-2" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function ToolRail({
  activeTool,
  onSelectTool,
  counts,
  visibility,
  locks,
  onToggleVisibility,
  onToggleLock,
  onClearLayer
}: {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  counts: Record<Layer, number>;
  visibility: Record<Layer, boolean>;
  locks: Record<Layer, boolean>;
  onToggleVisibility: (layer: Layer) => void;
  onToggleLock: (layer: Layer) => void;
  onClearLayer: (layer: Layer) => void;
}) {
  return (
    <aside className="tool-rail">
      <button
        className={`tool-nav ${activeTool === 'pan' ? 'is-active' : ''}`}
        onClick={() => onSelectTool('pan')}
      >
        <span className="tool-nav-icon"><PanGlyph size={18} /></span>
        <span className="tool-nav-label">Panorera</span>
        <kbd>V</kbd>
      </button>

      <div className="tool-rail-heading">Lager</div>

      <div className="tool-rail-list">
        {LAYERS.map((def) => {
          const isActive = activeTool === def.key;
          const isLocked = locks[def.key];
          const isHidden = !visibility[def.key];
          const count = counts[def.key];
          return (
            <div
              key={def.key}
              className={`tool-row ${isActive ? 'is-active' : ''} ${isHidden ? 'is-hidden' : ''}`}
              style={{ ['--layer' as string]: def.color }}
            >
              <button
                className="tool-row-main"
                onClick={() => onSelectTool(def.key)}
                title={isLocked ? `${def.label} är låst — lås upp för att rita` : def.hint}
              >
                <span className="tool-swatch" style={{ background: def.color }}>
                  <LayerGlyph layer={def.key} size={15} />
                </span>
                <span className="tool-row-text">
                  <span className="tool-row-name">{def.label}</span>
                  <span className="tool-row-meta">
                    {count > 0 ? `${count} ${def.kind === 'point' ? 'punkt' : count === 1 ? 'figur' : 'figurer'}` : 'tom'}
                  </span>
                </span>
                {isLocked ? <span className="tool-row-locked"><LockIcon locked /></span> : null}
              </button>
              <div className="tool-row-toggles">
                <button
                  className={`icon-toggle ${isHidden ? 'is-off' : ''}`}
                  onClick={() => onToggleVisibility(def.key)}
                  title={isHidden ? 'Visa lager' : 'Dölj lager'}
                >
                  <EyeIcon open={!isHidden} />
                </button>
                <button
                  className={`icon-toggle ${isLocked ? 'is-on' : ''}`}
                  onClick={() => onToggleLock(def.key)}
                  title={isLocked ? 'Lås upp lager' : 'Lås lager'}
                >
                  <LockIcon locked={isLocked} />
                </button>
                <button
                  className="icon-toggle danger"
                  onClick={() => onClearLayer(def.key)}
                  disabled={count === 0}
                  title={`Rensa alla ${def.label.toLowerCase()}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
