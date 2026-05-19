'use client';

type Props = {
  score: string;
  onScoreChange: (value: string) => void;
  isLastHole: boolean;
  onSubmit: () => void;
};

export function RoundControlBar({ score, onScoreChange, isLastHole, onSubmit }: Props) {
  return (
    <div className="absolute left-0 right-0 bottom-0 z-10 bg-slate-900/90 rounded-t-2xl px-3 pt-3 pb-4 flex gap-2 items-stretch">
      <label className="flex-1 min-h-11 rounded-lg bg-white px-3 flex items-center gap-2">
        <span className="text-ink font-extrabold flex-1 text-sm">Antal slag</span>
        <input
          value={score}
          onChange={(e) => onScoreChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          type="number"
          inputMode="numeric"
          min={0}
          max={30}
          step={1}
          placeholder="0"
          className="min-w-12 text-right font-bold text-ink bg-transparent text-lg"
        />
      </label>
      <button onClick={onSubmit} className="flex-1 min-h-11 bg-primary text-white rounded-lg font-bold">
        {isLastHole ? 'Avsluta runda' : 'Nästa hål'}
      </button>
    </div>
  );
}
