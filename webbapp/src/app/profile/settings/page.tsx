'use client';

import { LogOut, RefreshCw, Globe, ChevronRight, Crosshair, Check, HelpCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { useI18n, useT } from '@/lib/i18n/I18nProvider';
import { SUPPORTED_LOCALES, localeLabel } from '@/lib/i18n/dictionaries';
import { caddyClubs } from '@/lib/caddyClubs';
import { shotTrackingStore } from '@/lib/shotTrackingStore';

export default function SettingsPage() {
  const { logout } = useAuth();
  const { locale, setLocale } = useI18n();
  const t = useT();
  const [langOpen, setLangOpen] = useState(false);
  const [shotTrackingEnabled, setShotTrackingEnabled] = useState(false);
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setShotTrackingEnabled(shotTrackingStore.isEnabled());
    setSelectedClubs(shotTrackingStore.getSelectedClubs());
  }, []);

  const toggleShotTracking = () => {
    const next = !shotTrackingEnabled;
    shotTrackingStore.setEnabled(next);
    setShotTrackingEnabled(next);
    if (next) {
      setSelectedClubs(shotTrackingStore.getSelectedClubs());
      setBagOpen(true);
    } else {
      setBagOpen(false);
    }
  };

  const toggleClub = (clubId: string) => {
    shotTrackingStore.toggleClub(clubId);
    setSelectedClubs(shotTrackingStore.getSelectedClubs());
  };

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
      {/* Shot tracking section */}
      <section className="card flex flex-col gap-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-base">{t('settings.shotTracking')}</h2>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-slate-400 active:text-slate-600"
            aria-label={t('settings.shotTrackingHelpTitle')}
          >
            <HelpCircle size={20} />
          </button>
        </div>

        {/* Toggle row */}
        <button
          type="button"
          onClick={toggleShotTracking}
          className="flex items-center justify-between py-3"
        >
          <div className="flex items-center gap-3">
            <Crosshair size={20} className="text-slate-500" />
            <div className="text-left">
              <span className="text-sm font-semibold text-ink block">{t('settings.shotTracking')}</span>
              <span className="text-xs text-slate-400">{t('settings.shotTrackingDesc')}</span>
            </div>
          </div>
          <div
            className={`w-11 h-6 rounded-full transition-colors relative ${
              shotTrackingEnabled ? 'bg-primary' : 'bg-slate-300'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                shotTrackingEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>

        {/* Collapsible club bag dropdown */}
        {shotTrackingEnabled && (
          <>
            <button
              type="button"
              onClick={() => setBagOpen((v) => !v)}
              className="flex items-center justify-between py-3 border-t border-slate-100"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink">{t('settings.clubBag')}</span>
                <span className="text-xs text-slate-400">{t('settings.clubBagDesc')}</span>
              </div>
              <ChevronRight
                size={16}
                className={`text-slate-400 transition-transform ${bagOpen ? 'rotate-90' : ''}`}
              />
            </button>

            {bagOpen && (
              <div className="pb-3 pt-1">
                <div className="flex flex-wrap gap-2">
                  {caddyClubs.map((club) => {
                    const isSelected = selectedClubs.includes(club.id);
                    return (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => toggleClub(club.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                        {club.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Help popup */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHelpOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-ink">{t('settings.shotTrackingHelpTitle')}</h3>
              <button onClick={() => setHelpOpen(false)} className="text-slate-400">
                <X size={22} />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('settings.shotTrackingHelp')}
            </p>
            <button
              onClick={() => setHelpOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

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
