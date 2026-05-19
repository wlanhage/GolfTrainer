'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAdminApi } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import type { AdminMission, AdminUser, MissionScoreInputType, MissionStatus, UserRole } from '@/lib/types';

type Subject = 'users' | 'trainings';

export default function AdminDashboardPage() {
  const api = useAdminApi();
  const toast = useToast();
  const [subject, setSubject] = useState<Subject>('users');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [homeClub, setHomeClub] = useState('');
  const [role, setRole] = useState<UserRole>('USER');

  const [editingMission, setEditingMission] = useState<AdminMission | null>(null);
  const [missionModalOpen, setMissionModalOpen] = useState(false);
  const [missionSlug, setMissionSlug] = useState('');
  const [missionName, setMissionName] = useState('');
  const [missionDescription, setMissionDescription] = useState('');
  const [missionIcon, setMissionIcon] = useState('🎯');
  const [missionObjective, setMissionObjective] = useState('');
  const [missionScoreLabel, setMissionScoreLabel] = useState('Poäng');
  const [missionScoreType, setMissionScoreType] = useState<MissionScoreInputType>('STEPPER');
  const [missionStepperMin, setMissionStepperMin] = useState('0');
  const [missionStepperMax, setMissionStepperMax] = useState('10');
  const [missionDefaultScore, setMissionDefaultScore] = useState('0');
  const [missionMaxScore, setMissionMaxScore] = useState('10');
  const [missionStatus, setMissionStatus] = useState<MissionStatus>('PUBLISHED');
  const [leaderboardTitle, setLeaderboardTitle] = useState('Leaderboard');
  const [leaderboardActive, setLeaderboardActive] = useState(true);

  const loadUsers = async () => setUsers(await api.listUsers());
  const loadMissions = async () => setMissions(await api.listMissions());

  useEffect(() => {
    void loadUsers();
    void loadMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = useMemo(() => ['BASIC_USER', 'USER', 'PREMIUM_USER', 'ADMIN'] as const, []);

  const selectUser = (user: AdminUser) => {
    setSelectedUser(user);
    setRole(user.role);
    setDisplayName(user.profile?.displayName ?? '');
    setCity(user.profile?.city ?? '');
    setCountry(user.profile?.country ?? '');
    setHomeClub(user.profile?.homeClub ?? '');
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    await api.updateUser(selectedUser.id, { role, displayName, city, country, homeClub });
    await loadUsers();
    toast.success('Användaren är uppdaterad.');
  };

  const removeUser = async () => {
    if (!selectedUser) return;
    if (!window.confirm('Är du säker på att du vill ta bort den här?')) return;
    await api.updateUser(selectedUser.id, { isActive: false });
    setSelectedUser(null);
    await loadUsers();
    toast.success('Användaren markerades som borttagen (inaktiv).');
  };

  const resetMissionForm = () => {
    setEditingMission(null);
    setMissionSlug('');
    setMissionName('');
    setMissionDescription('');
    setMissionIcon('🎯');
    setMissionObjective('');
    setMissionScoreLabel('Poäng');
    setMissionScoreType('STEPPER');
    setMissionStepperMin('0');
    setMissionStepperMax('10');
    setMissionDefaultScore('0');
    setMissionMaxScore('10');
    setMissionStatus('PUBLISHED');
    setLeaderboardTitle('Leaderboard');
    setLeaderboardActive(true);
  };

  const openEditMission = (m: AdminMission) => {
    setEditingMission(m);
    setMissionSlug(m.slug);
    setMissionName(m.name);
    setMissionDescription(m.description);
    setMissionIcon(m.icon);
    setMissionObjective(m.objective);
    setMissionScoreLabel(m.scoreLabel);
    setMissionScoreType(m.scoreInputType);
    setMissionStepperMin(String(m.stepperMin ?? 0));
    setMissionStepperMax(String(m.stepperMax ?? 10));
    setMissionDefaultScore(String(m.defaultScore ?? 0));
    setMissionMaxScore(String(m.maxScore ?? 10));
    setMissionStatus(m.status);
    setLeaderboardTitle(m.leaderboard?.title ?? 'Leaderboard');
    setLeaderboardActive(m.leaderboard?.isActive ?? true);
    setMissionModalOpen(true);
  };

  const saveMission = async () => {
    const payload = {
      slug: missionSlug,
      name: missionName,
      description: missionDescription,
      icon: missionIcon,
      objective: missionObjective,
      scoreLabel: missionScoreLabel,
      scoreInputType: missionScoreType,
      stepperMin: missionScoreType === 'STEPPER' ? Number(missionStepperMin) : undefined,
      stepperMax: missionScoreType === 'STEPPER' ? Number(missionStepperMax) : undefined,
      defaultScore: Number(missionDefaultScore),
      maxScore: Number(missionMaxScore),
      status: missionStatus,
      leaderboardTitle,
      leaderboardActive
    };
    if (editingMission) {
      await api.updateMission(editingMission.id, payload);
      toast.success('Training uppdaterad.');
    } else {
      await api.createMission(payload);
      toast.success('Ny training skapad.');
    }
    setMissionModalOpen(false);
    resetMissionForm();
    await loadMissions();
  };

  const removeMission = async (m: AdminMission) => {
    if (!window.confirm('Är du säker på att du vill ta bort den här?')) return;
    await api.deleteMission(m.id);
    await loadMissions();
    toast.success('Träning borttagen.');
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Admin dashboard</h1>

      <Link href="/admin/courses" className="btn-primary self-start py-2.5 px-3 text-sm">
        Hantera banor &amp; hål
      </Link>

      <div>
        <button onClick={() => setDropdownOpen((v) => !v)} className="border-2 border-border bg-white rounded-xl p-3 font-semibold w-full text-left">
          {subject === 'users' ? 'Användare' : 'Trainings / Missions'} ▾
        </button>
        {dropdownOpen ? (
          <div className="border-2 border-border rounded-xl bg-white mt-1">
            <button
              onClick={() => {
                setSubject('users');
                setDropdownOpen(false);
              }}
              className="block w-full text-left p-2.5 border-b border-border"
            >
              Användare
            </button>
            <button
              onClick={() => {
                setSubject('trainings');
                setDropdownOpen(false);
              }}
              className="block w-full text-left p-2.5"
            >
              Trainings / Missions
            </button>
          </div>
        ) : null}
      </div>

      {subject === 'users' ? (
        <div className="bg-white rounded-xl p-3 flex flex-col gap-2">
          <h2 className="font-bold">Alla users</h2>
          {users.map((u) => (
            <button key={u.id} onClick={() => selectUser(u)} className="border border-border rounded-lg p-2.5 text-left">
              <div>{u.profile?.displayName ?? u.email}</div>
              <div className="text-xs text-slate-500">{u.role} • {u.isActive ? 'Aktiv' : 'Inaktiv'}</div>
            </button>
          ))}

          {selectedUser ? (
            <div className="mt-2 flex flex-col gap-2">
              <h3 className="font-bold">Redigera user</h3>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="input" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="input" />
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="input" />
              <input value={homeClub} onChange={(e) => setHomeClub(e.target.value)} placeholder="Home club" className="input" />
              <div className="flex gap-2 flex-wrap">
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`border-2 rounded-lg p-2 text-sm font-semibold ${role === r ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => void removeUser()} className="w-[30%] btn-danger">Ta bort</button>
                <button onClick={() => void saveUser()} className="w-[70%] btn-primary">Spara user</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Alla trainings/missions</h2>
            <button
              onClick={() => {
                resetMissionForm();
                setMissionModalOpen(true);
              }}
              className="w-9 h-9 rounded-full bg-primary text-white text-xl font-bold flex items-center justify-center shadow-md"
            >
              ＋
            </button>
          </div>

          {missions.map((m) => (
            <div key={m.id} className="flex items-center justify-between border border-border rounded-lg p-2.5">
              <span className="font-semibold flex-1">{m.name}</span>
              <div className="flex gap-3">
                <button onClick={() => openEditMission(m)}>✏️</button>
                <button onClick={() => void removeMission(m)}>❌</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {missionModalOpen ? (
        <div className="fixed inset-0 z-30 bg-white overflow-auto p-4 flex flex-col gap-2.5">
          <h2 className="text-2xl font-bold">{editingMission ? 'Redigera training' : 'Lägg till training'}</h2>
          <input value={missionSlug} onChange={(e) => setMissionSlug(e.target.value)} placeholder="Slug" className="input" />
          <input value={missionName} onChange={(e) => setMissionName(e.target.value)} placeholder="Titel" className="input" />
          <input value={missionIcon} onChange={(e) => setMissionIcon(e.target.value)} placeholder="Emoji" className="input" />
          <input value={missionDescription} onChange={(e) => setMissionDescription(e.target.value)} placeholder="Description" className="input" />
          <input value={missionObjective} onChange={(e) => setMissionObjective(e.target.value)} placeholder="Objective" className="input" />
          <input value={missionScoreLabel} onChange={(e) => setMissionScoreLabel(e.target.value)} placeholder="Score label" className="input" />

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setMissionScoreType('STEPPER')} className={`border-2 rounded-lg p-2 text-sm font-semibold ${missionScoreType === 'STEPPER' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>Plus/minus</button>
            <button onClick={() => setMissionScoreType('MANUAL_NUMBER')} className={`border-2 rounded-lg p-2 text-sm font-semibold ${missionScoreType === 'MANUAL_NUMBER' ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>Skriv siffra</button>
          </div>

          {missionScoreType === 'STEPPER' ? (
            <>
              <input value={missionStepperMin} onChange={(e) => setMissionStepperMin(e.target.value)} placeholder="Min" inputMode="numeric" className="input" />
              <input value={missionStepperMax} onChange={(e) => setMissionStepperMax(e.target.value)} placeholder="Max" inputMode="numeric" className="input" />
            </>
          ) : null}

          <input value={missionDefaultScore} onChange={(e) => setMissionDefaultScore(e.target.value)} placeholder="Default score" inputMode="numeric" className="input" />
          <input value={missionMaxScore} onChange={(e) => setMissionMaxScore(e.target.value)} placeholder="Max score" inputMode="numeric" className="input" />
          <input value={leaderboardTitle} onChange={(e) => setLeaderboardTitle(e.target.value)} placeholder="Leaderboard title" className="input" />

          <div className="flex gap-2 flex-wrap">
            {(['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const).map((s) => (
              <button key={s} onClick={() => setMissionStatus(s)} className={`border-2 rounded-lg p-2 text-sm font-semibold ${missionStatus === s ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>
                {s}
              </button>
            ))}
          </div>

          <button onClick={() => setLeaderboardActive((v) => !v)} className={`border-2 rounded-lg p-2 text-sm font-semibold ${leaderboardActive ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary'}`}>
            Leaderboard aktiv
          </button>

          <button onClick={() => void saveMission()} className="btn-primary">
            {editingMission ? 'Uppdatera' : 'Skapa'}
          </button>
          <button onClick={() => setMissionModalOpen(false)} className="btn-ghost">Stäng</button>
        </div>
      ) : null}
    </div>
  );
}
