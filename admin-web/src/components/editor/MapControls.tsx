export function MapControls({
  onZoomIn,
  onZoomOut,
  onFitTee,
  canFitTee,
  onOpenCoord
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitTee: () => void;
  canFitTee: boolean;
  onOpenCoord: () => void;
}) {
  return (
    <div className="map-controls">
      <div className="map-control-group">
        <button onClick={onZoomIn} title="Zooma in" aria-label="Zooma in">+</button>
        <button onClick={onZoomOut} title="Zooma ut" aria-label="Zooma ut">−</button>
      </div>
      <button className="map-control-single" onClick={onFitTee} disabled={!canFitTee} title="Centrera på tee" aria-label="Centrera på tee">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      <button className="map-control-single" onClick={onOpenCoord} title="Hoppa till koordinat" aria-label="Hoppa till koordinat">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </button>
    </div>
  );
}
