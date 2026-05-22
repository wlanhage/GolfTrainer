'use client';

import { LogOut, RefreshCw, Globe, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useI18n, useT } from '@/lib/i18n/I18nProvider';
import { SUPPORTED_LOCALES, localeLabel } from '@/lib/i18n/dictionaries';

export default function SettingsPage() {
  const { logout } = useAuth();
  const { locale, setLocale } = useI18n();
  const t = useT();
  const [langOpen, setLangOpen] = useState(false);

  const refreshApp = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <section className="card flex flex-col gap-0">
        <h2 className="font-bold text-base mb-2">{t('settings.general')}</h2>

        {/* Language */}
        <button
          type="button"
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center justify-between py-3 border-b border-slate-100"
        >
          <div className="flex items-center gap-3">
            <Globe size={20} className="text-slate-500" />
            <span className="text-sm font-semibold text-ink">{t('settings.language')}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <span className="text-sm">{localeLabel(locale)}</span>
            <ChevronRight size={16} className={`transition-transform ${langOpen ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {langOpen ? (
          <div className="flex gap-2 py-3 border-b border-slate-100 pl-9">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => { setLocale(l); setLangOpen(false); }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold border-2 transition ${
                  locale === l
                    ? 'bg-primary border-primary text-white'
                    : 'bg-white text-primary border-primary'
                }`}
              >
                {localeLabel(l)}
              </button>
            ))}
          </div>
        ) : null}

        {/* Refresh app */}
        <button
          type="button"
          onClick={() => void refreshApp()}
          className="flex items-center gap-3 py-3 border-b border-slate-100"
        >
          <RefreshCw size={20} className="text-slate-500" />
          <span className="text-sm font-semibold text-ink">{t('settings.refreshApp')}</span>
        </button>

        {/* Log out */}
        <button
          type="button"
          onClick={() => void logout()}
          className="flex items-center gap-3 py-3"
        >
          <LogOut size={20} className="text-danger" />
          <span className="text-sm font-semibold text-danger">{t('nav.logout')}</span>
        </button>
      </section>
    </div>
  );
}
