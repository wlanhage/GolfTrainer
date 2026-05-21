'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useRoundsStore } from '@/lib/roundsStore';
import { useToast } from '@/lib/ToastProvider';
import { GROUP_FORMATS, SOLO_FORMATS, type PlayFormat } from '@/lib/playFormats';
import { FormatCarousel } from '@/components/play/FormatCarousel';
import { clearGroupSetup, loadGroupSetup } from '@/lib/groupSetupStorage';

export default function FormatPickerPage() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params?.get('mode') as 'solo' | 'group') ?? 'solo';
  const courseId = params?.get('courseId') ?? '';
  const roundsStore = useRoundsStore();
  const toast = useToast();

  const groupSetup = useMemo(() => (mode === 'group' ? loadGroupSetup() : null), [mode]);
  const formats: PlayFormat[] = useMemo(() => {
    if (mode === 'solo') return SOLO_FORMATS;
    const playerCount = (groupSetup?.invitedUserIds.length ?? 0) + 1;
    return GROUP_FORMATS.filter((f) => playerCount >= f.minPlayers && playerCount <= f.maxPlayers);
  }, [mode, groupSetup]);

  const [selected, setSelected] = useState<PlayFormat['key']>(formats[0]?.key ?? 'STROKE_PLAY');
  const [starting, setStarting] = useState(false);

  const start = async () => {
    if (!courseId) {
      toast.error('Saknar bana.');
      return;
    }
    setStarting(true);
    try {
      const players =
        mode === 'group'
          ? groupSetup?.invitedUserIds.map((userId) => ({ userId })) ?? []
          : undefined;
      const round = await roundsStore.startRound({
        courseId,
        format: selected,
        players
      });
      clearGroupSetup();
      router.replace(`/play/round/${round.id}/${round.currentHoleNumber}`);
    } catch (e) {
      toast.error(`Kunde inte starta runda: ${(e as Error).message}`);
    } finally {
      setStarting(false);
    }
  };

  if (formats.length === 0) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <p className="text-slate-700">Inga spelformer matchar antalet spelare. Lägg till eller ta bort spelare.</p>
        <button onClick={() => router.back()} className="btn-secondary">
          Tillbaka
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold text-ink">Välj spelform</h1>
      <p className="text-slate-600 text-sm">Swipea eller använd pilarna för att bläddra.</p>

      <FormatCarousel formats={formats} selectedKey={selected} onSelect={setSelected} />

      <button onClick={start} disabled={starting} className="btn-primary mt-2 disabled:opacity-50">
        {starting ? 'Startar…' : `Starta runda`}
      </button>
      <button onClick={() => router.back()} className="btn-ghost">
        Tillbaka
      </button>
    </div>
  );
}
