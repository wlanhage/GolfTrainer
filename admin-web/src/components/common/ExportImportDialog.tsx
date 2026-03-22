'use client';

import { useState } from 'react';
import { Course } from '../../lib/types';

export function ExportImportDialog({
  open,
  courses,
  onClose,
  onImport
}: {
  open: boolean;
  courses: Course[];
  onClose: () => void;
  onImport: (payload: Course[]) => void;
}) {
  const [importText, setImportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(courses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'golftrainer-courses-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText) as Course[];
      if (!Array.isArray(parsed)) throw new Error('Fel format');
      onImport(parsed);
      setImportText('');
      setError(null);
      onClose();
    } catch {
      setError('Kunde inte läsa JSON. Kontrollera formatet.');
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-box wide">
        <h3>Export / Import av banor</h3>
        <p className="small-note">Data sparas lokalt i denna webbläsare.</p>
        <button onClick={exportJson}>Exportera JSON</button>
        <textarea rows={10} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Klistra in JSON här" />
        {error ? <p>{error}</p> : null}
        <div className="dialog-actions">
          <button className="chip" onClick={onClose}>Stäng</button>
          <button onClick={importJson}>Importera</button>
        </div>
      </div>
    </div>
  );
}
