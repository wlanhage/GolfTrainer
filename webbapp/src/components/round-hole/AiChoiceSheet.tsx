'use client';

import { Camera, Sparkles } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCamera: () => void;
  onData: () => void;
};

export function AiChoiceSheet({ isOpen, onClose, onCamera, onData }: Props) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs">
        <h3 className="text-base font-bold text-slate-800 text-center mb-4">
          AI Klubbrekommendation
        </h3>

        <div className="flex gap-3">
          {/* Data-only option */}
          <button
            onClick={() => { onClose(); onData(); }}
            className="flex-1 flex flex-col items-center gap-2 py-5 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={24} className="text-primary" />
            </div>
            <span className="text-sm font-bold text-ink">Snabb AI</span>
            <span className="text-[11px] text-slate-400 text-center leading-tight">
              Baserat på dina klubbor, avstånd & statistik
            </span>
          </button>

          {/* Camera option */}
          <button
            onClick={() => { onClose(); onCamera(); }}
            className="flex-1 flex flex-col items-center gap-2 py-5 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
              <Camera size={24} className="text-amber-600" />
            </div>
            <span className="text-sm font-bold text-ink">Kamera</span>
            <span className="text-[11px] text-slate-400 text-center leading-tight">
              Ta en bild för visuell analys av läget
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
