'use client';

import { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';
import { getAiErrorKey } from '@/lib/aiErrorMapper';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string) => Promise<string>;
  loading: boolean;
};

export function CameraRecommendSheet({ isOpen, onClose, onCapture, loading }: Props) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setPreview(null);
    setRecommendation(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize image to reduce base64 size (max 800px wide)
    const resized = await resizeImage(file, 800);
    setPreview(resized);
    setRecommendation(null);
    setError(null);

    try {
      // Strip the data:image/jpeg;base64, prefix
      const base64 = resized.split(',')[1];
      const result = await onCapture(base64);
      setRecommendation(result);
    } catch (err) {
      setError(t(getAiErrorKey(err)));
    }

    // Reset file input so same image can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">AI Klubbrekommendation</h3>
          <button onClick={handleClose} className="text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* Camera input (hidden) */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />

        {/* Content */}
        {!preview && !loading && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 active:bg-slate-50"
          >
            <Camera size={40} />
            <span className="text-sm font-medium">Ta en bild av ditt läge</span>
          </button>
        )}

        {preview && (
          <div className="mb-4">
            <img
              src={preview}
              alt="Läge på banan"
              className="w-full rounded-xl object-cover max-h-48"
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-4 px-4 bg-slate-50 rounded-xl">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="text-sm text-slate-600">Analyserar ditt läge...</span>
          </div>
        )}

        {recommendation && !loading && (
          <div className="py-4 px-4 bg-green-50 border border-green-100 rounded-xl">
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{recommendation}</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-4 px-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        {preview && !loading && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                handleReset();
                fileRef.current?.click();
              }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
            >
              Ny bild
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              Stäng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Resize image to maxWidth, returns data URL */
async function resizeImage(file: File, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
