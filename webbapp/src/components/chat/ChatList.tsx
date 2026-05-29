'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useChatApi } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';
import { formatRelativeShort } from '@/lib/format';
import { NewChatPicker } from './NewChatPicker';
import type { ChatConversation } from '@/lib/types';

export function ChatList() {
  const chatApi = useChatApi();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const load = async () => {
    try {
      const list = await chatApi.listConversations();
      setConversations(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [chatApi]);

  if (showPicker) {
    return <NewChatPicker onClose={() => setShowPicker(false)} />;
  }

  if (loading) {
    return <p className="text-slate-500 text-sm text-center mt-6">Laddar...</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setShowPicker(true)}
        className="btn-primary self-start text-sm px-4 py-2 rounded-xl"
      >
        Ny chatt
      </button>

      {conversations.length === 0 ? (
        <p className="text-slate-500 text-center mt-6">Inga chattar ännu.</p>
      ) : (
        conversations.map((c) => (
          <Link
            key={c.partnerId}
            href={`/community/chat/${c.partnerId}`}
            className="bg-white border border-border rounded-xl px-3 py-3 flex items-center gap-3"
          >
            <UserAvatar
              avatarImage={c.partnerAvatarImage}
              displayName={c.partnerDisplayName}
              size={44}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink truncate">{c.partnerDisplayName}</span>
                <span className="text-xs text-slate-400 ml-2 shrink-0">
                  {formatRelativeShort(c.lastMessageAt)}
                </span>
              </div>
              <p className="text-sm text-slate-500 truncate">
                {c.lastMessageSenderId !== c.partnerId ? (
                  <span className="text-slate-400">Du: </span>
                ) : null}
                {c.lastMessageContent}
              </p>
            </div>
            {c.unreadCount > 0 ? (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            ) : null}
          </Link>
        ))
      )}
    </div>
  );
}
