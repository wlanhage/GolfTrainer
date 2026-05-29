'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChatApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { formatRelativeShort } from '@/lib/format';
import type { ChatMessageItem } from '@/lib/types';

export default function ConversationPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const chatApi = useChatApi();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const msgs = await chatApi.getMessages(partnerId);
      setMessages(msgs);
      await chatApi.markRead(partnerId).catch(() => undefined);
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
  }, [partnerId, chatApi]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const msg = await chatApi.sendMessage(partnerId, content);
      setMessages((prev) => [...prev, msg]);
      setText('');
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-80px)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
        <button onClick={() => router.push('/community')} className="text-primary font-semibold text-sm">
          ← Tillbaka
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loading ? (
          <p className="text-slate-500 text-sm text-center mt-6">Laddar...</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-400 text-sm text-center mt-6">Skriv det första meddelandet!</p>
        ) : (
          sorted.map((msg) => {
            const isOwn = msg.senderId === me?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    isOwn
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-slate-100 text-ink rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-0.5 ${
                      isOwn ? 'text-white/60' : 'text-slate-400'
                    }`}
                  >
                    {formatRelativeShort(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-white px-4 py-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Skriv ett meddelande..."
          className="input flex-1"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          Skicka
        </button>
      </div>
    </div>
  );
}
