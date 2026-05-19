'use client';

import { useRef, useState } from 'react';
import { UserAvatar } from './UserAvatar';
import { useToast } from '@/lib/ToastProvider';

type Props = {
  currentAvatar: string | null | undefined;
  displayName: string | null | undefined;
  email: string | null | undefined;
  size?: number;
  onUpload: (dataUrl: string) => Promise<void>;
  onRemove?: () => Promise<void>;
};

// Skala ner och komprimera bilden i en canvas innan vi skickar som data-URL.
// Mål: ~256×256 px, JPEG kvalitet 0.85 → typiskt 20-60 KB.
async function compressImage(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Kunde inte läsa filen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Kunde inte avkoda bilden'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D saknas'));
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({ currentAvatar, displayName, email, size = 100, onUpload, onRemove }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // tillåt att välja samma fil igen efteråt
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Filen är inte en bild.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Filen är för stor (max 10 MB).');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      await onUpload(dataUrl);
      toast.success('Profilbild uppdaterad.');
    } catch (err) {
      toast.error(`Kunde inte ladda upp bilden: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const triggerPick = () => fileRef.current?.click();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={triggerPick}
        disabled={busy}
        className="relative rounded-full overflow-hidden disabled:opacity-50"
        aria-label="Byt profilbild"
      >
        <UserAvatar avatarImage={currentAvatar} displayName={displayName} email={email} size={size} />
        <span
          className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity"
          style={{ borderRadius: size / 2 }}
        >
          {busy ? 'Sparar...' : 'Byt bild'}
        </span>
      </button>
      <div className="flex gap-2">
        <button type="button" onClick={triggerPick} disabled={busy} className="text-primary text-xs font-semibold disabled:opacity-50">
          {currentAvatar ? 'Byt' : 'Ladda upp'}
        </button>
        {currentAvatar && onRemove ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Ta bort profilbilden?')) void onRemove();
            }}
            disabled={busy}
            className="text-danger text-xs font-semibold disabled:opacity-50"
          >
            Ta bort
          </button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
    </div>
  );
}
