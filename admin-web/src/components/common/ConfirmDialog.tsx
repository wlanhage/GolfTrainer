'use client';

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog-box">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="chip" onClick={onCancel}>Avbryt</button>
          <button onClick={onConfirm}>Bekräfta</button>
        </div>
      </div>
    </div>
  );
}
