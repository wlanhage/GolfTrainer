import { prisma } from '../../infrastructure/prisma/client.js';
import { AppError } from '../../common/errors/AppError.js';
import type { ClubRecommendInput } from './ai.schema.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemma-4-31b-it:free';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type MultimodalContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>;
type MultimodalMessage = { role: 'system' | 'user' | 'assistant'; content: string | MultimodalContent };

const buildRoundContext = async (roundId: string): Promise<string> => {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      roundHoles: { orderBy: { holeNumber: 'asc' }, include: { scores: true } },
      shots: { orderBy: [{ holeNumber: 'asc' }, { shotOrder: 'asc' }] },
      players: { orderBy: { order: 'asc' } }
    }
  });
  if (!round) return '';

  let ctx = `Runda: ${round.clubNameSnapshot} - ${round.courseNameSnapshot}\n`;
  ctx += `Status: ${round.status}\n\n`;

  for (const hole of round.roundHoles) {
    const scores = hole.scores.map(s => `${s.strokes ?? '?'} slag`).join(', ');
    const holeShots = round.shots.filter(s => s.holeNumber === hole.holeNumber);
    ctx += `Hål ${hole.holeNumber} (par ${hole.parSnapshot ?? '?'}): ${scores}`;
    if (holeShots.length > 0) {
      ctx += ` | Slag: ${holeShots.map(s => `${s.clubId} ${s.distanceMeters ? Math.round(Number(s.distanceMeters)) + 'm' : ''}`).join(', ')}`;
    }
    ctx += '\n';
  }
  return ctx;
};

type GeoPoint = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;
const toRadians = (v: number) => (v * Math.PI) / 180;

const geoDistance = (a: GeoPoint, b: GeoPoint) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

const parseGeoPoint = (p: unknown): GeoPoint | null => {
  if (p && typeof p === 'object') {
    const o = p as Record<string, unknown>;
    if (typeof o.lat === 'number' && typeof o.lng === 'number') return { lat: o.lat, lng: o.lng };
  }
  return null;
};

const parsePolygon = (p: unknown): GeoPoint[] => {
  if (!Array.isArray(p)) return [];
  return p.map(parseGeoPoint).filter((x): x is GeoPoint => x !== null);
};

const polygonAreaMeters = (points: GeoPoint[]): number => {
  if (points.length < 3) return 0;
  // Shoelace on projected coords
  const cLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(toRadians(cLat));
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const xi = points[i].lng * mPerLng, yi = points[i].lat * mPerLat;
    const xj = points[j].lng * mPerLng, yj = points[j].lat * mPerLat;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
};

const polygonMaxWidth = (points: GeoPoint[]): number => {
  if (points.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, geoDistance(points[i], points[j]));
    }
  }
  return max;
};

const polygonCenter = (points: GeoPoint[]): GeoPoint | null => {
  if (points.length === 0) return null;
  const sum = points.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
};

/** Build a text description of the hole layout for AI context */
const buildHoleLayoutContext = async (roundId: string, holeNumber: number): Promise<string> => {
  // Find the round to get courseId
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { courseId: true },
  });
  if (!round) return '';

  // Find the hole
  const hole = await prisma.hole.findFirst({
    where: { courseId: round.courseId, holeNumber },
    include: { holeLayout: true },
  });
  if (!hole) return '';

  const parts: string[] = [];
  parts.push(`Hål ${holeNumber}: Par ${hole.par ?? '?'}, ${hole.length ?? '?'}m`);
  if (hole.hcpIndex) parts.push(`HCP-index: ${hole.hcpIndex}`);

  const layout = hole.holeLayout;
  if (!layout) return parts.join('. ');

  // Hole length from derived data
  if (layout.holeLengthMeters) {
    parts.push(`Hållängd (tee→green): ${Math.round(Number(layout.holeLengthMeters))}m`);
  }

  // Green
  const greenPoly = parsePolygon(layout.greenPolygon);
  if (greenPoly.length >= 3) {
    const greenArea = polygonAreaMeters(greenPoly);
    const greenWidth = polygonMaxWidth(greenPoly);
    parts.push(`Green: ca ${Math.round(greenArea)}m² yta, ca ${Math.round(greenWidth)}m bred`);
  }

  // Fairway
  const fairwayPoly = parsePolygon(layout.fairwayPolygon);
  if (fairwayPoly.length >= 3) {
    const fairwayArea = polygonAreaMeters(fairwayPoly);
    const fairwayWidth = polygonMaxWidth(fairwayPoly);
    parts.push(`Fairway: ca ${Math.round(fairwayArea)}m² yta, ca ${Math.round(fairwayWidth)}m längd/bredd`);
  }

  // Bunkers
  const bunkerPolys = Array.isArray(layout.bunkerPolygons) ? layout.bunkerPolygons : [];
  const bunkers = bunkerPolys.map(parsePolygon).filter(p => p.length >= 3);
  if (bunkers.length > 0) {
    const greenCenter = polygonCenter(greenPoly);
    const bunkerDescs = bunkers.map((b) => {
      const bc = polygonCenter(b);
      if (greenCenter && bc) {
        const dist = Math.round(geoDistance(bc, greenCenter));
        return `${dist}m från green-center`;
      }
      return 'nära green';
    });
    parts.push(`Bunkrar (${bunkers.length} st): ${bunkerDescs.join(', ')}`);
  }

  // Trees
  const treePolys = Array.isArray(layout.treesPolygons) ? layout.treesPolygons : [];
  const trees = treePolys.map(parsePolygon).filter(p => p.length >= 3);
  if (trees.length > 0) {
    parts.push(`Trädområden: ${trees.length} st`);
  }

  // OB
  const obPolys = Array.isArray(layout.obPolygons) ? layout.obPolygons : [];
  const obs = obPolys.map(parsePolygon).filter(p => p.length >= 3);
  if (obs.length > 0) {
    const greenCenter = polygonCenter(greenPoly);
    const obDescs = obs.map((o) => {
      const oc = polygonCenter(o);
      if (greenCenter && oc) {
        const dist = Math.round(geoDistance(oc, greenCenter));
        return `${dist}m från green-center`;
      }
      return 'nära hålet';
    });
    parts.push(`OB-zoner (${obs.length} st): ${obDescs.join(', ')}`);
  }

  return parts.join('\n');
};

/** Map OpenRouter HTTP status to a structured AppError */
const throwAiError = (status: number, _rawBody: string): never => {
  if (status === 429) {
    throw new AppError('AI_RATE_LIMITED', 503, 'AI model is rate limited');
  }
  if (status === 402) {
    throw new AppError('AI_QUOTA_EXCEEDED', 503, 'AI quota exceeded');
  }
  if (status === 408 || status === 504) {
    throw new AppError('AI_TIMEOUT', 504, 'AI model timed out');
  }
  if (status === 503 || status === 502) {
    throw new AppError('AI_UNAVAILABLE', 503, 'AI model is temporarily unavailable');
  }
  if (status === 404) {
    throw new AppError('AI_MODEL_NOT_FOUND', 503, 'AI model not available');
  }
  throw new AppError('AI_ERROR', 502, 'AI request failed');
};

export const aiService = {
  async caddyChat(userId: string, message: string, roundId?: string) {
    if (!OPENROUTER_API_KEY) {
      throw new AppError('AI_NOT_CONFIGURED', 503, 'AI is not configured');
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'Du är en golfcaddy-AI för appen GolfTrainer. Du hjälper spelaren med tips, strategier och analyser av deras spel. Svara på svenska om inte annat anges. Håll svaren korta och konkreta (max 200 ord).'
      }
    ];

    if (roundId) {
      const context = await buildRoundContext(roundId);
      if (context) {
        messages.push({ role: 'system', content: `Aktuell runda-data:\n${context}` });
      }
    }

    // Fetch user profile for personalization
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true, handicap: true, homeClub: true }
    });
    if (profile) {
      let profileCtx = `Spelare: ${profile.displayName}`;
      if (profile.handicap !== null) profileCtx += `, HCP ${profile.handicap}`;
      if (profile.homeClub) profileCtx += `, hemmaklubb: ${profile.homeClub}`;
      messages.push({ role: 'system', content: profileCtx });
    }

    messages.push({ role: 'user', content: message });

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://golftrainer.app',
        'X-Title': 'GolfTrainer'
      },
      body: JSON.stringify({ model: MODEL, messages })
    });

    if (!response.ok) {
      const err = await response.text();
      throwAiError(response.status, err);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? 'Kunde inte generera svar.';
  },

  async recommendClub(userId: string, input: ClubRecommendInput) {
    if (!OPENROUTER_API_KEY) {
      throw new AppError('AI_NOT_CONFIGURED', 503, 'AI is not configured');
    }

    // Fetch user profile for HCP
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { handicap: true },
    });
    const hcp = profile?.handicap !== null && profile?.handicap !== undefined
      ? Number(profile.handicap)
      : null;

    // Fetch user's club data
    const userClubs = await prisma.userClub.findMany({
      where: { userId, isActive: true },
      include: {
        distanceSamples: {
          orderBy: { recordedAt: 'desc' },
          take: 50,
        },
      },
    });

    // Build club context string
    let clubContext = '';
    if (userClubs.length > 0) {
      clubContext = 'Spelarens klubbor:\n';
      for (const club of userClubs) {
        if (club.distanceSamples.length === 0) {
          clubContext += `- ${club.label}: inga registrerade slag\n`;
          continue;
        }
        const distances = club.distanceSamples.map(s => Number(s.carryMeters));
        const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
        const stdDev = Math.sqrt(
          distances.reduce((sum, d) => sum + (d - avg) ** 2, 0) / distances.length
        );
        clubContext += `- ${club.label}: snitt ${Math.round(avg)}m, spridning ±${Math.round(stdDev)}m (baserat på ${distances.length} slag)\n`;
      }
    }

    // Fetch hole layout context if we have roundId + holeNumber
    let holeLayoutContext = '';
    if (input.roundId && input.holeNumber) {
      holeLayoutContext = await buildHoleLayoutContext(input.roundId, input.holeNumber);
    }

    const hcpRiskProfile = `HCP-baserad riskprofil:
- plus-HCP till 5: Elitspelare. Attackera flaggan, shape:a slag, kan spela högrisk.
- 5-10: Låg-HCP. Attackera goda lägen, spela smart vid svåra, undvik dubbelbogey.
- 10-15: Medel-bra. Sikta bredare del av green, ta en klubba mer vid tveksamt läge.
- 15-20: Medel. Center green, undvik bunkers, prioritera att vara på green.
- 20-28: Hög-HCP. Spela säkert, undvik hazards, layup är ofta bättre.
- 28-36: Nybörjare. Kortaste vägen till green, undvik OB till varje pris, ta klubban du träffar bäst.
- 36+: Ny i spelet. Fokusera på att komma framåt, lita på din bästa klubba.`;

    const systemPrompt = `Du är en erfaren golfcaddy-AI. Spelaren visar dig en bild av sitt läge på banan.

Baserat på bilden, distansen till green, håldata, spelarens HCP och deras klubbdata — rekommendera:
1. Vilken klubba att använda
2. Var att sikta (center green, vänster, höger, layup etc.)
3. Kort motivering (1-2 meningar)

Ta hänsyn till håldata: bunkrar, OB-zoner, trädlinjer, greenens storlek och fairwayns bredd. Om green är liten eller smal — var mer konservativ. Om det finns OB nära — undvik den sidan.

Anpassa risknivån baserat på spelarens HCP:
${hcpRiskProfile}

${clubContext}
${holeLayoutContext ? `\nHåldata:\n${holeLayoutContext}` : ''}

Svara KORT och KONKRET. Max 3-4 meningar. Formatera som:
🏌️ **[Klubba]** — [Sikta mot X]
[Kort motivering]`;

    // Build user text message
    const parts: string[] = [];
    if (input.distanceToGreenFront != null || input.distanceToGreenMiddle != null || input.distanceToGreenBack != null) {
      const dParts: string[] = [];
      if (input.distanceToGreenFront != null) dParts.push(`fram: ${input.distanceToGreenFront}m`);
      if (input.distanceToGreenMiddle != null) dParts.push(`mitt: ${input.distanceToGreenMiddle}m`);
      if (input.distanceToGreenBack != null) dParts.push(`bak: ${input.distanceToGreenBack}m`);
      parts.push(`Distans till green: ${dParts.join(', ')}`);
    }
    if (input.holeNumber != null) parts.push(`Hål ${input.holeNumber}`);
    if (input.par != null) parts.push(`Par ${input.par}`);
    if (hcp !== null) parts.push(`Mitt HCP: ${hcp}`);
    const userText = parts.length > 0
      ? `Här är mitt läge. ${parts.join('. ')}. Vilken klubba rekommenderar du?`
      : 'Här är mitt läge. Vilken klubba rekommenderar du?';

    const messages: MultimodalMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` } },
          { type: 'text', text: userText },
        ],
      },
    ];

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://golftrainer.app',
        'X-Title': 'GolfTrainer',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!response.ok) {
      const err = await response.text();
      throwAiError(response.status, err);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? 'Kunde inte generera rekommendation.';
  },
};
