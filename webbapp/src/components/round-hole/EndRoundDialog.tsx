'use client';

type Props = {
  open: boolean;
  isHost: boolean;
  hasIncompleteHoles: boolean;
  saving: boolean;
  onLeaveSelf: () => void;
  onEndForAll: () => void;
  onCancel: () => void;
};

export function EndRoundDialog({
  open,
  isHost,
  hasIncompleteHoles,
  saving,
  onLeaveSelf,
  onEndForAll,
  onCancel
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/55 flex flex-col justify-end">
      <button className="flex-1" aria-label="Stäng" onClick={onCancel} />
      <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3">
        <h3 className="text-lg font-extrabold text-ink">Avsluta runda</h3>
        <p className="text-sm text-slate-600">
          {isHost
            ? 'Vill du avsluta hela rundan eller bara för dig själv?'
            : 'Du kan lämna rundan här — övriga spelare fortsätter.'}
        </p>

        <button
          onClick={onLeaveSelf}
          disabled={saving}
          className="w-full bg-primary text-white rounded-xl py-3 font-bold disabled:opacity-60"
        >
          Avsluta för mig
        </button>

        {isHost ? (
          <button
            onClick={onEndForAll}
            disabled={saving}
            className="w-full bg-danger text-white rounded-xl py-3 font-bold disabled:opacity-60"
          >
            Avsluta för alla
          </button>
        ) : null}

        <button onClick={onCancel} disabled={saving} className="btn-ghost">
          Avbryt
        </button>

        {hasIncompleteHoles && isHost ? (
          <p className="text-xs text-amber-700 text-center">
            Vissa spelare har hål kvar — du får bekräfta innan avslut för alla.
          </p>
        ) : null}
      </div>
    </div>
  );
}

type ConfirmProps = {
  open: boolean;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EndRoundConfirmIncomplete({ open, saving, onConfirm, onCancel }: ConfirmProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex flex-col justify-end">
      <button className="flex-1" aria-label="Stäng" onClick={onCancel} />
      <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3">
        <h3 className="text-lg font-extrabold text-ink">Är du säker?</h3>
        <p className="text-sm text-slate-600">
          Spelare har hål kvar. Är du säker på att du vill avsluta spelet för alla?
          Det går ej att ändra i efterhand.
        </p>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="w-full bg-danger text-white rounded-xl py-3 font-bold disabled:opacity-60"
        >
          Ja, avsluta för alla
        </button>
        <button onClick={onCancel} disabled={saving} className="btn-ghost">
          Nej
        </button>
      </div>
    </div>
  );
}
