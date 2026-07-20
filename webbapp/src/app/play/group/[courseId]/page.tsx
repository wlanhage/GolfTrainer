'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFollowsApi, useCoursesApi } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { UserAvatar } from '@/components/UserAvatar';
import { QrInviteSheet } from '@/components/QrInviteSheet';
import type { MutualFollower } from '@/lib/types';
import { saveGroupSetup } from '@/lib/groupSetupStorage';

export default function GroupSetupPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = String(params?.courseId ?? '');
  const followsApi = useFollowsApi();
  const coursesApi = useCoursesApi();
  const { me } = useAuth();

  const [course, setCourse] = useState<{ courseName: string; clubName: string } | null>(null);
  const [mutuals, setMutuals] = useState<MutualFollower[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      followsApi.listMutualFollowers().catch(() => [] as MutualFollower[]),
      coursesApi.listCourses('')
    ]).then(([m, courses]) => {
      setMutuals(m);
      const c = courses.find((x) => x.id === courseId);
      if (c) setCourse({ courseName: c.courseName, clubName: c.clubName });
      setLoading(false);
    });
  }, [followsApi, coursesApi, courseId]);

  const togglePick = (userId: string) => {
    setInvited((s) => {
      const next = new Set(s);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const proceed = () => {
    if (invited.size === 0) {
      router.push(`/play/format?mode=solo&courseId=${courseId}`);
      return;
    }
    saveGroupSetup({ courseId, invitedUserIds: Array.from(invited) });
    router.push(`/play/format?mode=group&courseId=${courseId}`);
  };

  const invitedList = mutuals.filter((m) => invited.has(m.userId));
  const totalPlayers = invited.size + 1; // host included

  if (loading) {
    return <div className="p-4 text-slate-500">Laddar…</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold text-ink">Spelare</h1>
      {course ? (
        <p className="text-slate-600 text-sm">
          {course.courseName} • {course.clubName}
        </p>
      ) : null}
      <p className="text-slate-700 text-sm">
        Lägg till medspelare om du vill spela i grupp — eller fortsätt direkt för att spela själv.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* Host som första kort */}
        <div className="card flex flex-col items-center text-center gap-2">
          <UserAvatar
            avatarImage={me?.profile?.avatarImage ?? null}
            displayName={me?.profile?.displayName ?? null}
            email={me?.email}
            size={56}
          />
          <span className="text-sm font-bold">{me?.profile?.displayName ?? 'Du'}</span>
          <span className="text-xs text-slate-500">Host</span>
        </div>

        {invitedList.map((m) => (
          <div key={m.userId} className="card flex flex-col items-center text-center gap-2">
            <UserAvatar avatarImage={m.avatarImage} displayName={m.displayName} size={56} />
            <span className="text-sm font-bold">{m.displayName}</span>
            <button onClick={() => togglePick(m.userId)} className="text-xs text-danger font-semibold">
              Ta bort
            </button>
          </div>
        ))}

        <button
          onClick={() => setPickerOpen(true)}
          className="card flex flex-col items-center justify-center gap-1.5 border-dashed border-2 border-primary text-primary"
        >
          <span className="text-3xl">+</span>
          <span className="text-sm font-bold">Lägg till spelare</span>
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <p className="text-sm text-slate-700">
          Totalt: <strong>{totalPlayers} spelare</strong>
        </p>
        <button onClick={proceed} className="btn-primary">
          Välj spelform
        </button>
        <button onClick={() => router.back()} className="btn-ghost">
          Tillbaka
        </button>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-900/45 flex flex-col justify-end">
          <button className="flex-1" aria-label="Stäng" onClick={() => setPickerOpen(false)} />
          <div className="bg-white rounded-t-2xl p-4 flex flex-col gap-3 max-h-[70vh]">
            <h3 className="text-lg font-extrabold">Bjud in</h3>
            {mutuals.length === 0 ? (
              <p className="text-sm text-slate-600">
                Du har inga vänner som följer dig tillbaka än. Be dem följa dig från deras profil.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 overflow-y-auto">
                {mutuals.map((m) => {
                  const isInvited = invited.has(m.userId);
                  return (
                    <button
                      key={m.userId}
                      onClick={() => togglePick(m.userId)}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
                        isInvited ? 'border-primary bg-primary-softer' : 'border-border bg-white'
                      }`}
                    >
                      <UserAvatar avatarImage={m.avatarImage} displayName={m.displayName} size={40} />
                      <span className="flex-1 text-left font-semibold">{m.displayName}</span>
                      {isInvited ? <span className="text-primary font-bold text-sm">✓ Tillagd</span> : null}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => {
                setPickerOpen(false);
                setQrOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary text-primary font-bold py-2.5"
            >
              Visa QR-kod — bjud in vem som helst
            </button>
            <button onClick={() => setPickerOpen(false)} className="btn-primary">
              Klar
            </button>
          </div>
        </div>
      ) : null}

      <QrInviteSheet open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}

