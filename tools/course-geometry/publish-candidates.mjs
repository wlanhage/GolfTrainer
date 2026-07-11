#!/usr/bin/env node
// Publish tied/unassigned greens as OPEN player-tap candidates.
//
// Usage: node publish-candidates.mjs candidates.<courseId>.json [--api-base ...] [--email ...] [--password ...]
//
// Input JSON: { courseId, candidates: [ { polygon: [{lat,lng}...], forHoles: [Int], source } ] }
import { readFileSync } from 'node:fs';
import { createApi } from './lib/api.mjs';
import { validateGreen } from './lib/match.mjs';

function parseArgs(argv) {
  const args = {
    file: argv[2],
    apiBase: process.env.GT_API_BASE ?? 'http://localhost:3000',
    email: process.env.GT_ADMIN_EMAIL ?? 'admin@golf.test',
    password: process.env.GT_ADMIN_PASSWORD ?? 'Admin123!'
  };
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--email') args.email = argv[++i];
    else if (a === '--password') args.password = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.file || args.file.startsWith('--')) throw new Error('Usage: node publish-candidates.mjs candidates.<courseId>.json');
  return args;
}

const args = parseArgs(process.argv);
const data = JSON.parse(readFileSync(args.file, 'utf8'));
if (!Array.isArray(data.candidates) || data.candidates.length === 0) throw new Error('No candidates in file');

const items = data.candidates.map((c, i) => {
  const v = validateGreen(c.polygon);
  if (!v.ok) throw new Error(`candidate ${i}: ${v.reasons.join('; ')}`);
  if (!Array.isArray(c.forHoles) || c.forHoles.length === 0) throw new Error(`candidate ${i}: forHoles required`);
  return { polygon: v.ring, forHoles: c.forHoles, source: c.source ?? 'manual' };
});

const api = createApi(args.apiBase);
await api.login(args.email, args.password);
const res = await api.createGreenCandidates(data.courseId, items);
console.log(`Published ${res.created ?? items.length} candidate(s) to course ${data.courseId}`);
