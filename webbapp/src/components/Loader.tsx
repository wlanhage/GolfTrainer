'use client';

import { useEffect, useState } from 'react';

type Props = {
  fullScreen?: boolean;
  label?: string;
  onDark?: boolean;
};

export function Loader({ fullScreen = false, label = 'Loading', onDark = false }: Props) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 400);
    return () => clearInterval(id);
  }, []);

  const textColor = onDark ? 'text-white' : 'text-slate-900';
  const wrapper = fullScreen
    ? `fixed inset-0 z-50 flex items-center justify-center ${onDark ? 'bg-slate-900' : 'bg-white'}`
    : 'flex items-center justify-center py-12';

  return (
    <div className={wrapper}>
      <div className="flex flex-col items-center gap-4">
        <video
          src="/loader.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-24 h-24 object-cover rounded-2xl"
        />
        <div className={`font-extrabold text-xl tracking-tight ${textColor}`}>
          <span>{label}</span>
          <span className="inline-block w-6 text-left">{'.'.repeat(dots)}</span>
        </div>
      </div>
    </div>
  );
}
