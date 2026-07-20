'use client';

import { useEffect, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { useRoundsApi } from '@/lib/api';
import type { RoundReactionEntry } from '@/lib/types';

// Måste hållas i synk med ROUND_REACTION_EMOJIS i backend (rounds.schema.ts).
const REACTION_EMOJIS = ['👏', '🔥', '⛳', '💪', '😂', '💩'] as const;

/**
 * Emoji-reaktioner på EN spelares score.
 *
 * Kompakt vy: en grå smiley-knapp + de emojis som faktiskt använts med
 * antal. Smileyn öppnar väljaren med alla alternativ; tryck på en använd
 * emoji visar vilka som lagt den. En reaktion per användare och spelare —
 * samma emoji i väljaren igen tar bort, en annan byter.
 *
 * Skicka `initialReactions` (hela rundans lista — komponenten filtrerar på
 * playerId) när den redan finns, t.ex. från flödet; annars hämtas den.
 */
export function RoundReactions({
  roundId,
  playerId,
  initialReactions
}: {
  roundId: string;
  playerId: string;
  initialReactions?: RoundReactionEntry[];
}) {
  const { me } = useAuth();
  const roundsApi = useRoundsApi();
  const [reactions, setReactions] = useState<RoundReactionEntry[]>(initialReactions ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialReactions) return;
    let active = true;
    roundsApi
      .listReactions(roundId)
      .then((list) => {
        if (active) setReactions(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [roundId, roundsApi, initialReactions]);

  const mine = reactions.filter((r) => r.playerId === playerId);
  const myEmoji = me ? (mine.find((r) => r.userId === me.id)?.emoji ?? null) : null;
  const countFor = (emoji: string) => mine.filter((r) => r.emoji === emoji).length;
  const usedEmojis = REACTION_EMOJIS.filter((emoji) => countFor(emoji) > 0);

  const toggle = async (emoji: string) => {
    if (busy || !me) return;
    setBusy(true);
    try {
      setReactions(await roundsApi.toggleReaction(roundId, playerId, emoji));
      setPickerOpen(false);
    } catch {
      // behåll nuvarande state vid fel
    } finally {
      setBusy(false);
    }
  };

  const selectedNames =
    selectedEmoji !== null
      ? mine.filter((r) => r.emoji === selectedEmoji).map((r) => r.displayName)
      : [];

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center flex-wrap gap-1.5">
        {/* Smiley öppnar/stänger emoji-väljaren */}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Reagera på scoren"
          aria-expanded={pickerOpen}
          className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
            pickerOpen
              ? 'border-primary bg-primary-softer text-primary'
              : 'border-border bg-white text-slate-400/70 active:bg-slate-50'
          }`}
        >
          <SmilePlus size={17} aria-hidden="true" />
        </button>

        {/* Använda emojis med antal — tryck för att se vilka som reagerat */}
        {usedEmojis.map((emoji) => {
          const isSelected = selectedEmoji === emoji;
          const isMine = myEmoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => setSelectedEmoji(isSelected ? null : emoji)}
              aria-pressed={isSelected}
              aria-label={`Visa vilka som reagerat med ${emoji}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm leading-none transition-colors ${
                isSelected
                  ? 'border-primary bg-primary-softer'
                  : isMine
                    ? 'border-primary/40 bg-white'
                    : 'border-border bg-white active:bg-slate-50'
              }`}
            >
              <span>{emoji}</span>
              <span className={`text-xs font-bold ${isSelected || isMine ? 'text-primary' : 'text-slate-500'}`}>
                {countFor(emoji)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Väljaren: alla alternativ */}
      {pickerOpen ? (
        <div className="flex items-center gap-1 bg-white border border-border rounded-full px-2 py-1.5 shadow-sm">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void toggle(emoji)}
              disabled={busy}
              aria-label={`Reagera med ${emoji}`}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-lg leading-none transition-colors disabled:opacity-60 ${
                myEmoji === emoji ? 'bg-primary-softer ring-1 ring-primary' : 'active:bg-slate-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      {/* Vilka som lagt den valda emojin */}
      {selectedEmoji !== null && selectedNames.length > 0 ? (
        <p className="text-xs text-slate-500">
          {selectedEmoji} {selectedNames.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
