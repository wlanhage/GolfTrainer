'use client';

import Link from 'next/link';
import { LayoutGrid, Settings } from 'lucide-react';

type Props = {
  /** Utelämnas (t.ex. för gäster) → ingen inställningsknapp visas. */
  onSettings?: () => void;
  overviewHref: string;
};

export function TopRightFabs({ onSettings, overviewHref }: Props) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-row gap-2">
      <Link
        href={overviewHref}
        aria-label="Översikt"
        className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-slate-700"
      >
        <LayoutGrid size={20} aria-hidden="true" />
      </Link>
      {onSettings ? (
        <button
          onClick={onSettings}
          aria-label="Inställningar"
          className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-slate-700"
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
