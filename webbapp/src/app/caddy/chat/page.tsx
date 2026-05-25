'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAiApi } from '@/lib/api';
import { useT } from '@/lib/i18n/I18nProvider';
import { getAiErrorKey } from '@/lib/aiErrorMapper';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function CaddyChatPage() {
  const router = useRouter();
  const aiApi = useAiApi();
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { response } = await aiApi.caddyChat(text);
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: response };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = { id: `e-${Date.now()}`, role: 'assistant', content: t(getAiErrorKey(err)) };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <button onClick={() => router.back()} className="text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-slate-800">{t('caddy.title')}</h1>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 mt-12">
            <p className="text-4xl mb-3">🏌️</p>
            <p className="text-sm">{t('caddy.placeholder')}</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-400 shadow-sm border border-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
              {t('caddy.thinking')}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('caddy.placeholder')}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
