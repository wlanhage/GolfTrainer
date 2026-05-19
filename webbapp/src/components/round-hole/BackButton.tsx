'use client';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Gå tillbaka"
      className="absolute left-3 top-3 z-10 w-10 h-10 rounded-full bg-slate-900/70 border border-white/30 text-white text-3xl leading-none flex items-center justify-center"
    >
      ‹
    </button>
  );
}
