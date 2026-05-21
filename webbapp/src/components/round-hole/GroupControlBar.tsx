'use client';

type Props = {
  isLastHole: boolean;
  onSubmit: () => void;
  saving?: boolean;
};

export function GroupControlBar({ isLastHole, onSubmit, saving = false }: Props) {
  return (
    <div className="absolute left-0 right-0 bottom-0 z-10 bg-slate-900/90 rounded-t-2xl px-3 pt-3 pb-4 flex">
      <button
        onClick={onSubmit}
        disabled={saving}
        className="flex-1 min-h-11 bg-primary text-white rounded-lg font-bold disabled:opacity-60"
      >
        {saving ? 'Sparar…' : isLastHole ? 'Avsluta runda' : 'Nästa hål'}
      </button>
    </div>
  );
}
