'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useRoundsApi } from '@/lib/api';
import type { RoundReactionEntry } from '@/lib/types';

// Måste hållas i synk med ROUND_REACTION_EMOJIS i backend (rounds.schema.ts).
const REACTION_EMOJIS = ['👏', '🔥', '⛳', '💪', '😂', '💩'] as const;

/**
 * Emoji-reaktioner på EN spelares score i en runda: en rad knappar med
 * räknare, och under den namnen på de som reagerat. En reaktion per
 * användare och spelare — tryck på samma emoji igen för att ta bort,
 * eller på en annan för att byta.
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

  const toggle = async (emoji: string) => {
    if (busy || !me) return;
    setBusy(true);
    try {
      setReactions(await roundsApi.toggleReaction(roundId, playerId, emoji));
    } catch {
      // behåll nuvarande state vid fel
    } finally {
      setBusy(false);
    }
  };

  const countFor = (emoji: string) => mine.filter((r) => r.emoji === emoji).length;
  const withReactions = REACTION_EMOJIS.filter((emoji) => countFor(emoji) > 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {REACTION_EMOJIS.map((emoji) => {
          const count = countFor(emoji);
          const isMine = myEmoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => void toggle(emoji)}
              disabled={busy}
              aria-pressed={isMine}
              aria-label={`Reagera med ${emoji}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm leading-none transition-colors disabled:opacity-60 ${
                isMine
                  ? 'border-primary bg-primary-softer'
                  : 'border-border bg-white active:bg-slate-50'
              }`}
            >
              <span>{emoji}</span>
              {count > 0 ? (
                <span className={`text-xs font-bold ${isMine ? 'text-primary' : 'text-slate-500'}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {withReactions.length > 0 ? (
        <p className="text-xs text-slate-500">
          {withReactions.map((emoji, i) => (
            <span key={emoji}>
              {i > 0 ? ' · ' : ''}
              {emoji}{' '}
              {mine
                .filter((r) => r.emoji === emoji)
                .map((r) => r.displayName)
                .join(', ')}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
