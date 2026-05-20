// Seed-skript för utveckling. Skapar testanvändare, banor, missions, caddy-slag,
// följ-relationer och spelade rundor så att alla features har data att rendera.
//
// Idempotent: använder upsert/findFirst-create så att skriptet kan köras flera
// gånger utan duplicates.
//
// Kör:
//   npm --prefix backend run prisma:seed:supabase
//   npm --prefix backend run prisma:seed:local

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const log = (msg: string) => console.log(`[seed] ${msg}`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

// ─── Users ──────────────────────────────────────────────────────────────────

type ProfileSeed = {
  displayName: string;
  homeClub?: string;
  city?: string;
  country?: string;
  dominantHand?: 'RIGHT' | 'LEFT';
  handicap?: number;
  targetHandicap?: number;
  skillLevel?: string;
  yearsPlaying?: number;
  roundsLast12Months?: number;
  trainingDaysPerWeek?: number;
  favoriteClub?: string;
  strengthArea?: string;
  focusArea?: string;
  goals?: string;
};

async function upsertUser(input: {
  email: string;
  password: string;
  role: 'BASIC_USER' | 'USER' | 'PREMIUM_USER' | 'ADMIN';
  profile: ProfileSeed;
}) {
  const passwordHash = await argon2.hash(input.password);
  const p = input.profile;

  return prisma.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      passwordHash,
      role: input.role,
      isActive: true,
      profile: { create: { ...p, dominantHand: p.dominantHand ?? 'RIGHT' } }
    },
    update: {
      role: input.role,
      isActive: true,
      profile: {
        upsert: {
          create: { ...p, dominantHand: p.dominantHand ?? 'RIGHT' },
          update: { ...p, dominantHand: p.dominantHand ?? 'RIGHT' }
        }
      }
    },
    include: { profile: true }
  });
}

// ─── Courses ────────────────────────────────────────────────────────────────

async function upsertCourse(opts: {
  clubName: string;
  courseName: string;
  teeName: string;
  holes: Array<{ holeNumber: number; par: number; length: number; hcpIndex: number }>;
  createdByUserId: string;
}) {
  const existing = await prisma.course.findFirst({
    where: { clubName: opts.clubName, courseName: opts.courseName }
  });

  const course = existing
    ? await prisma.course.update({
        where: { id: existing.id },
        data: { teeName: opts.teeName, holeCount: opts.holes.length as 9 | 18 }
      })
    : await prisma.course.create({
        data: {
          clubName: opts.clubName,
          courseName: opts.courseName,
          teeName: opts.teeName,
          holeCount: opts.holes.length as 9 | 18,
          source: 'MANUAL',
          userId: opts.createdByUserId
        }
      });

  for (const h of opts.holes) {
    await prisma.hole.upsert({
      where: { courseId_holeNumber: { courseId: course.id, holeNumber: h.holeNumber } },
      create: {
        courseId: course.id,
        holeNumber: h.holeNumber,
        par: h.par,
        length: h.length,
        hcpIndex: h.hcpIndex
      },
      update: { par: h.par, length: h.length, hcpIndex: h.hcpIndex }
    });
  }

  return prisma.course.findUnique({
    where: { id: course.id },
    include: { holes: { orderBy: { holeNumber: 'asc' } } }
  });
}

// ─── Caddy ──────────────────────────────────────────────────────────────────

async function upsertCaddyClub(userId: string, label: string) {
  const existing = await prisma.userClub.findFirst({ where: { userId, label } });
  if (existing) return existing;
  return prisma.userClub.create({ data: { userId, label, isActive: true } });
}

async function addCaddyShots(userId: string, clubLabel: string, shots: Array<{ distance: number; lateral: number }>) {
  const club = await upsertCaddyClub(userId, clubLabel);
  const existing = await prisma.shotEntry.count({
    where: { userId, userClubId: club.id, resultTag: 'CADDY_CLUB' }
  });
  if (existing >= shots.length) return;

  await prisma.shotEntry.createMany({
    data: shots.map((s, i) => ({
      userId,
      userClubId: club.id,
      carryMeters: s.distance,
      curveDeg: s.lateral,
      resultTag: 'CADDY_CLUB',
      recordedAt: daysAgo(shots.length - i),
      notes: JSON.stringify({ source: 'CADDY_CLUB' })
    }))
  });
}

// ─── Missions ───────────────────────────────────────────────────────────────

async function upsertMission(input: {
  slug: string;
  name: string;
  description: string;
  icon: string;
  objective: string;
  scoreLabel: string;
  scoreInputType: 'STEPPER' | 'MANUAL_NUMBER';
  scoreDirection: 'ASC' | 'DESC';
  stepperMin?: number;
  stepperMax?: number;
  defaultScore: number;
  createdByUserId: string;
}) {
  return prisma.missionTemplate.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      name: input.name,
      description: input.description,
      icon: input.icon,
      objective: input.objective,
      scoreLabel: input.scoreLabel,
      scoreInputType: input.scoreInputType,
      scoreDirection: input.scoreDirection,
      stepperMin: input.stepperMin,
      stepperMax: input.stepperMax,
      defaultScore: input.defaultScore,
      status: 'PUBLISHED',
      createdByUserId: input.createdByUserId,
      leaderboard: { create: { isActive: true } }
    },
    update: {
      name: input.name,
      description: input.description,
      icon: input.icon,
      objective: input.objective,
      scoreLabel: input.scoreLabel,
      scoreInputType: input.scoreInputType,
      scoreDirection: input.scoreDirection,
      stepperMin: input.stepperMin,
      stepperMax: input.stepperMax,
      defaultScore: input.defaultScore,
      status: 'PUBLISHED'
    }
  });
}

async function addMissionEntry(userId: string, missionTemplateId: string, score: number, ageDays: number) {
  const existing = await prisma.missionEntry.findFirst({
    where: { userId, missionTemplateId, score, submittedAt: { gte: daysAgo(ageDays + 1), lte: daysAgo(ageDays - 1) } }
  });
  if (existing) return;
  await prisma.missionEntry.create({
    data: { userId, missionTemplateId, score, submittedAt: daysAgo(ageDays) }
  });
}

// ─── Rounds ─────────────────────────────────────────────────────────────────

type CourseWithHoles = NonNullable<Awaited<ReturnType<typeof upsertCourse>>>;

async function seedRound(opts: {
  user: { id: string };
  course: CourseWithHoles;
  startedDaysAgo: number;
  strokes: number[];
  status: 'COMPLETED' | 'ABANDONED';
}) {
  if (opts.strokes.length !== opts.course.holes.length) {
    throw new Error(`strokes length ${opts.strokes.length} != course holes ${opts.course.holes.length}`);
  }

  const dayStart = daysAgo(opts.startedDaysAgo);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const existing = await prisma.round.findFirst({
    where: {
      userId: opts.user.id,
      courseId: opts.course.id,
      startedAt: { gte: dayStart, lt: dayEnd }
    }
  });
  if (existing) return existing;

  const startedAt = daysAgo(opts.startedDaysAgo);
  const finishedAt = new Date(startedAt.getTime() + 3.5 * 3600 * 1000);
  const totalScore = opts.strokes.reduce((s, n) => s + n, 0);

  const round = await prisma.round.create({
    data: {
      userId: opts.user.id,
      courseId: opts.course.id,
      startedAt,
      finishedAt,
      currentHoleNumber: opts.course.holes.length,
      status: opts.status,
      teeNameSnapshot: opts.course.teeName,
      courseNameSnapshot: opts.course.courseName,
      clubNameSnapshot: opts.course.clubName,
      totalScore,
      syncStatus: 'SYNCED',
      roundHoles: {
        create: opts.course.holes.map((hole, i) => ({
          holeId: hole.id,
          holeNumber: hole.holeNumber,
          parSnapshot: hole.par,
          lengthSnapshot: hole.length,
          hcpIndexSnapshot: hole.hcpIndex,
          strokes: opts.strokes[i],
          completedAt: new Date(startedAt.getTime() + ((i + 1) / opts.course.holes.length) * 3.5 * 3600 * 1000)
        }))
      }
    }
  });

  return round;
}

// ─── Follows ────────────────────────────────────────────────────────────────

async function follow(followerId: string, followingId: string) {
  const existing = await prisma.userFollow.findUnique({
    where: { followerUserId_followingUserId: { followerUserId: followerId, followingUserId: followingId } }
  });
  if (existing) return;
  await prisma.userFollow.create({
    data: { followerUserId: followerId, followingUserId: followingId }
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('Skapar testanvändare med fulla profiler...');

  const admin = await upsertUser({
    email: 'admin@golf.test',
    password: 'Admin123!',
    role: 'ADMIN',
    profile: { displayName: 'Admin', handicap: 5, dominantHand: 'RIGHT' }
  });

  const anna = await upsertUser({
    email: 'anna@golf.test',
    password: 'Anna123!',
    role: 'USER',
    profile: {
      displayName: 'Anna Andersson',
      homeClub: 'Stockholm GK',
      city: 'Stockholm',
      country: 'Sverige',
      dominantHand: 'RIGHT',
      handicap: 12.4,
      targetHandicap: 8.0,
      skillLevel: 'Intermediate',
      yearsPlaying: 6,
      roundsLast12Months: 24,
      trainingDaysPerWeek: 2,
      favoriteClub: 'Järn 7',
      strengthArea: 'Approach och järnslag',
      focusArea: 'Långa puttar',
      goals: 'Nå single digit handicap inom 2 år'
    }
  });

  const erik = await upsertUser({
    email: 'erik@golf.test',
    password: 'Erik123!',
    role: 'USER',
    profile: {
      displayName: 'Erik Eriksson',
      homeClub: 'Vasatorps GK',
      city: 'Helsingborg',
      country: 'Sverige',
      dominantHand: 'LEFT',
      handicap: 8.2,
      targetHandicap: 5.0,
      skillLevel: 'Advanced',
      yearsPlaying: 12,
      roundsLast12Months: 42,
      trainingDaysPerWeek: 4,
      favoriteClub: 'Driver',
      strengthArea: 'Längd från tee',
      focusArea: 'Putting på snabba greener',
      goals: 'Vinna klubbmästerskapen'
    }
  });

  const lisa = await upsertUser({
    email: 'lisa@golf.test',
    password: 'Lisa123!',
    role: 'USER',
    profile: {
      displayName: 'Lisa Lindberg',
      homeClub: 'Halmstad GK',
      city: 'Halmstad',
      country: 'Sverige',
      dominantHand: 'RIGHT',
      handicap: 18.5,
      targetHandicap: 12.0,
      skillLevel: 'Beginner',
      yearsPlaying: 2,
      roundsLast12Months: 14,
      trainingDaysPerWeek: 3,
      favoriteClub: 'Hybrid 4',
      strengthArea: 'Korthålsspel',
      focusArea: 'Driver-konsistens',
      goals: 'Sänka HCP under 15 till sommaren'
    }
  });

  const markus = await upsertUser({
    email: 'markus@golf.test',
    password: 'Markus123!',
    role: 'USER',
    profile: {
      displayName: 'Markus Magnusson',
      homeClub: 'Bro Hof Slott',
      city: 'Bro',
      country: 'Sverige',
      dominantHand: 'RIGHT',
      handicap: 3.1,
      targetHandicap: 0.0,
      skillLevel: 'Advanced',
      yearsPlaying: 18,
      roundsLast12Months: 65,
      trainingDaysPerWeek: 5,
      favoriteClub: 'Sand wedge',
      strengthArea: 'Närspel runt green',
      focusArea: 'Mental hantering under press',
      goals: 'Tävlingsspel på elite-tour-nivå'
    }
  });

  log('Skapar banor...');
  const parkbanan = await upsertCourse({
    clubName: 'Stockholm Golfklubb',
    courseName: 'Parkbanan',
    teeName: 'Gul tee',
    createdByUserId: admin.id,
    holes: [
      { holeNumber: 1, par: 4, length: 320, hcpIndex: 7 },
      { holeNumber: 2, par: 3, length: 145, hcpIndex: 13 },
      { holeNumber: 3, par: 5, length: 480, hcpIndex: 1 },
      { holeNumber: 4, par: 4, length: 355, hcpIndex: 5 },
      { holeNumber: 5, par: 4, length: 290, hcpIndex: 11 },
      { holeNumber: 6, par: 3, length: 165, hcpIndex: 15 },
      { holeNumber: 7, par: 5, length: 460, hcpIndex: 3 },
      { holeNumber: 8, par: 4, length: 340, hcpIndex: 9 },
      { holeNumber: 9, par: 4, length: 380, hcpIndex: 17 }
    ]
  });

  const skogsbanan = await upsertCourse({
    clubName: 'Vasatorps GK',
    courseName: 'Skogsbanan',
    teeName: 'Vit tee',
    createdByUserId: admin.id,
    holes: Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: i % 5 === 2 ? 5 : i % 5 === 4 ? 3 : 4,
      length: i % 5 === 2 ? 490 : i % 5 === 4 ? 160 : 360 + (i % 3) * 20,
      hcpIndex: ((i * 7) % 18) + 1
    }))
  });

  if (!parkbanan || !skogsbanan) throw new Error('Course creation failed');

  log('Lägger till caddy-slag...');
  await addCaddyShots(anna.id, 'Driver', [
    { distance: 220, lateral: 5 },
    { distance: 230, lateral: -3 },
    { distance: 215, lateral: 12 },
    { distance: 235, lateral: -8 },
    { distance: 225, lateral: 2 },
    { distance: 240, lateral: 18 },
    { distance: 218, lateral: -5 }
  ]);
  await addCaddyShots(anna.id, 'Järn 7', [
    { distance: 128, lateral: 2 },
    { distance: 132, lateral: -1 },
    { distance: 130, lateral: 4 },
    { distance: 135, lateral: -3 },
    { distance: 127, lateral: 6 },
    { distance: 131, lateral: 0 }
  ]);
  await addCaddyShots(anna.id, 'Pitch', [
    { distance: 60, lateral: 3 },
    { distance: 55, lateral: -2 },
    { distance: 65, lateral: 1 },
    { distance: 58, lateral: -1 }
  ]);

  await addCaddyShots(erik.id, 'Driver', [
    { distance: 270, lateral: 3 },
    { distance: 285, lateral: -5 },
    { distance: 275, lateral: 8 },
    { distance: 290, lateral: -2 },
    { distance: 278, lateral: 4 },
    { distance: 295, lateral: -10 },
    { distance: 280, lateral: 2 }
  ]);
  await addCaddyShots(erik.id, 'Järn 5', [
    { distance: 175, lateral: -2 },
    { distance: 180, lateral: 3 },
    { distance: 178, lateral: -5 },
    { distance: 182, lateral: 1 },
    { distance: 176, lateral: 0 }
  ]);

  await addCaddyShots(lisa.id, 'Hybrid 4', [
    { distance: 145, lateral: 12 },
    { distance: 155, lateral: -18 },
    { distance: 138, lateral: 8 },
    { distance: 160, lateral: -5 },
    { distance: 142, lateral: 22 },
    { distance: 150, lateral: -10 }
  ]);
  await addCaddyShots(lisa.id, 'Järn 7', [
    { distance: 105, lateral: 8 },
    { distance: 115, lateral: -12 },
    { distance: 110, lateral: 3 },
    { distance: 108, lateral: -6 }
  ]);

  await addCaddyShots(markus.id, 'Driver', [
    { distance: 285, lateral: 2 },
    { distance: 290, lateral: -1 },
    { distance: 288, lateral: 0 },
    { distance: 292, lateral: 3 },
    { distance: 286, lateral: -2 },
    { distance: 295, lateral: 1 }
  ]);
  await addCaddyShots(markus.id, 'Järn 9', [
    { distance: 115, lateral: 1 },
    { distance: 118, lateral: -1 },
    { distance: 116, lateral: 2 },
    { distance: 117, lateral: 0 },
    { distance: 119, lateral: -1 }
  ]);
  await addCaddyShots(markus.id, 'Sand wedge', [
    { distance: 75, lateral: 1 },
    { distance: 80, lateral: 0 },
    { distance: 78, lateral: -1 },
    { distance: 82, lateral: 2 },
    { distance: 76, lateral: -1 }
  ]);

  log('Skapar missions...');
  const drivingDistance = await upsertMission({
    slug: 'driving-distance',
    name: 'Driving Distance',
    description: 'Mät längsta drive under 10 försök. Fokusera på teknik och träff i sweet spot.',
    icon: '🏌️',
    objective: 'Ange längsta slag i meter.',
    scoreLabel: 'Meter',
    scoreInputType: 'MANUAL_NUMBER',
    scoreDirection: 'DESC',
    defaultScore: 200,
    createdByUserId: admin.id
  });
  const puttingPrecision = await upsertMission({
    slug: 'putting-precision',
    name: 'Putting Precision',
    description: 'Träna precision från korta avstånd. Slå 20 puttar från markerad zon.',
    icon: '🎯',
    objective: 'Registrera antal lyckade puttar.',
    scoreLabel: 'Lyckade puttar',
    scoreInputType: 'STEPPER',
    scoreDirection: 'DESC',
    stepperMin: 0,
    stepperMax: 20,
    defaultScore: 0,
    createdByUserId: admin.id
  });
  const chipChallenge = await upsertMission({
    slug: 'chip-challenge',
    name: 'Chip Challenge',
    description: 'Placera bollen inom 1 meter från hål från 10 olika lägen runt green.',
    icon: '⛳',
    objective: 'Räkna antal chip inom målzon.',
    scoreLabel: 'Träffar',
    scoreInputType: 'STEPPER',
    scoreDirection: 'DESC',
    stepperMin: 0,
    stepperMax: 10,
    defaultScore: 0,
    createdByUserId: admin.id
  });

  log('Mission-historik...');
  await addMissionEntry(anna.id, drivingDistance.id, 215, 14);
  await addMissionEntry(anna.id, drivingDistance.id, 232, 7);
  await addMissionEntry(anna.id, drivingDistance.id, 241, 2);
  await addMissionEntry(anna.id, puttingPrecision.id, 12, 10);
  await addMissionEntry(anna.id, puttingPrecision.id, 15, 4);
  await addMissionEntry(anna.id, chipChallenge.id, 6, 6);
  await addMissionEntry(erik.id, drivingDistance.id, 258, 12);
  await addMissionEntry(erik.id, drivingDistance.id, 264, 5);
  await addMissionEntry(erik.id, puttingPrecision.id, 18, 8);
  await addMissionEntry(erik.id, chipChallenge.id, 9, 3);
  await addMissionEntry(lisa.id, drivingDistance.id, 168, 9);
  await addMissionEntry(lisa.id, drivingDistance.id, 175, 4);
  await addMissionEntry(lisa.id, puttingPrecision.id, 8, 7);
  await addMissionEntry(lisa.id, chipChallenge.id, 4, 5);
  await addMissionEntry(markus.id, drivingDistance.id, 295, 11);
  await addMissionEntry(markus.id, drivingDistance.id, 302, 4);
  await addMissionEntry(markus.id, puttingPrecision.id, 19, 6);
  await addMissionEntry(markus.id, chipChallenge.id, 10, 2);

  log('Spelade rundor...');
  await seedRound({ user: anna, course: parkbanan, startedDaysAgo: 28, strokes: [5, 4, 7, 5, 5, 4, 7, 5, 6], status: 'COMPLETED' });
  await seedRound({ user: anna, course: parkbanan, startedDaysAgo: 14, strokes: [5, 3, 6, 5, 4, 4, 6, 5, 5], status: 'COMPLETED' });
  await seedRound({ user: anna, course: parkbanan, startedDaysAgo: 3, strokes: [4, 4, 6, 4, 4, 3, 6, 4, 5], status: 'COMPLETED' });
  await seedRound({ user: erik, course: skogsbanan, startedDaysAgo: 21, strokes: [4, 5, 5, 4, 3, 5, 4, 4, 6, 4, 4, 5, 4, 4, 3, 5, 5, 4], status: 'COMPLETED' });
  await seedRound({ user: erik, course: parkbanan, startedDaysAgo: 5, strokes: [4, 3, 5, 4, 4, 3, 5, 4, 4], status: 'COMPLETED' });
  await seedRound({ user: lisa, course: parkbanan, startedDaysAgo: 18, strokes: [7, 5, 8, 6, 6, 5, 8, 7, 7], status: 'COMPLETED' });
  await seedRound({ user: lisa, course: parkbanan, startedDaysAgo: 6, strokes: [6, 4, 7, 6, 6, 4, 7, 6, 6], status: 'COMPLETED' });
  await seedRound({ user: markus, course: skogsbanan, startedDaysAgo: 17, strokes: [4, 4, 5, 4, 3, 4, 4, 4, 5, 4, 4, 5, 4, 4, 3, 4, 5, 4], status: 'COMPLETED' });
  await seedRound({ user: markus, course: parkbanan, startedDaysAgo: 2, strokes: [3, 3, 4, 4, 3, 3, 5, 4, 4], status: 'COMPLETED' });

  log('Följ-relationer...');
  await follow(anna.id, markus.id);
  await follow(erik.id, markus.id);
  await follow(lisa.id, markus.id);
  await follow(anna.id, erik.id);
  await follow(erik.id, anna.id);
  await follow(lisa.id, anna.id);
  await follow(anna.id, admin.id);

  log('');
  log('✅ Seed klar!');
  log('');
  log('Testkonton:');
  log('  admin@golf.test  / Admin123!    (ADMIN)');
  log('  anna@golf.test   / Anna123!     (USER — 3 rundor, HCP 12.4)');
  log('  erik@golf.test   / Erik123!     (USER vä-händt — 2 rundor, HCP 8.2)');
  log('  lisa@golf.test   / Lisa123!     (USER nybörjare — 2 rundor, HCP 18.5)');
  log('  markus@golf.test / Markus123!   (USER scratch — 2 rundor, HCP 3.1)');
}

main()
  .catch((err) => {
    console.error('[seed] Fel:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
