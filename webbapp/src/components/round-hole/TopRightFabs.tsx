'use client';

type Props = {
  onSettings: () => void;
};

export function TopRightFabs({ onSettings }: Props) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
      <button
        onClick={onSettings}
        aria-label="Inställningar"
        className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center text-xl"
      >
        ⚙️
      </button>
    </div>
  );
}
