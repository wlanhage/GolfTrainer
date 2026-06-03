#!/usr/bin/env node
// Capture frontend screenshots for a PR.
//
// Usage:
//   node capture.mjs --manifest shots.json [--out ./out] [--headed] [--no-auth]
//
// The manifest describes which app, which routes, and which viewports to shoot.
// See shots.webbapp.example.json for the format.
//
// Auth: if the manifest has an `account`, we log in via the backend API
// (POST {apiBaseUrl}/auth/login) and inject the returned tokens into
// localStorage under `tokenKey` before each page loads — same contract the
// webbapp uses (see webbapp/src/lib/tokenStorage.ts + authApi.ts).

import { chromium } from 'playwright';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { out: resolve(here, 'out'), headed: false, auth: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--out') args.out = resolve(argv[++i]);
    else if (a === '--headed') args.headed = true;
    else if (a === '--no-auth') args.auth = false;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.manifest) throw new Error('Missing --manifest <file>');
  return args;
}

const DEFAULT_VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

async function login(apiBaseUrl, account) {
  const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!res.ok) {
    throw new Error(
      `Login failed (${res.status}). Is the backend running and seeded? ` +
        `Tried ${apiBaseUrl}/auth/login as ${account.email}.`,
    );
  }
  return res.json(); // { accessToken, refreshToken }
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(readFileSync(resolve(args.manifest), 'utf8'));

  const app = manifest.app ?? 'app';
  const baseUrl = (manifest.baseUrl ?? 'http://localhost:3002').replace(/\/$/, '');
  const apiBaseUrl = manifest.apiBaseUrl ?? 'http://localhost:3000/api/v1';
  const tokenKey = manifest.tokenKey ?? 'golftrainer.auth.tokens';
  const viewports = { ...DEFAULT_VIEWPORTS, ...(manifest.viewports ?? {}) };

  let tokens = null;
  if (args.auth && manifest.account) {
    process.stdout.write(`→ Logging in as ${manifest.account.email} … `);
    tokens = await login(apiBaseUrl, manifest.account);
    console.log('ok');
  }

  rmSync(args.out, { recursive: true, force: true });
  mkdirSync(args.out, { recursive: true });

  const browser = await chromium.launch({ headless: !args.headed });
  const written = [];

  try {
    for (const shot of manifest.shots) {
      const vpName = shot.viewport ?? 'desktop';
      const viewport = viewports[vpName];
      if (!viewport) throw new Error(`Unknown viewport "${vpName}" in shot "${shot.name}"`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        reducedMotion: 'reduce', // calmer, more deterministic frames
      });

      // Inject auth tokens before any app code runs.
      if (tokens) {
        await context.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          [tokenKey, JSON.stringify(tokens)],
        );
      }
      // Per-shot localStorage seeds (e.g. feature flags, onboarding-dismissed).
      if (shot.localStorage) {
        await context.addInitScript(
          (entries) => {
            for (const [k, v] of entries) {
              window.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            }
          },
          Object.entries(shot.localStorage),
        );
      }

      const page = await context.newPage();

      // Health signals so a crashed/blank page is flagged, not silently shot.
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });
      page.on('pageerror', (e) => pageErrors.push(e.message));

      const url = baseUrl + shot.path;
      process.stdout.write(`→ ${app} ${vpName} ${shot.path} … `);

      let status = null;
      let navFailed = false;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        status = resp ? resp.status() : null;
      } catch {
        navFailed = true; // timeout or navigation error
      }

      // Optional wait: number = ms, string = selector to wait for.
      if (typeof shot.waitFor === 'number') {
        await page.waitForTimeout(shot.waitFor);
      } else if (typeof shot.waitFor === 'string') {
        await page.waitForSelector(shot.waitFor, { timeout: 15000 }).catch(() => {});
      } else {
        await page.waitForTimeout(800);
      }

      // Wait for webfonts so text isn't captured mid-swap.
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});

      const file = `${app}__${shot.name}__${vpName}.png`;
      const path = resolve(args.out, file);
      await page.screenshot({
        path,
        fullPage: shot.fullPage !== false,
        animations: 'disabled', // freeze CSS animations/transitions
      });

      const cap = (arr) => arr.slice(0, 3);
      const bad = navFailed || (status !== null && status >= 400) || pageErrors.length > 0;
      written.push({
        file,
        name: shot.name,
        viewport: vpName,
        path: shot.path,
        status,
        navFailed,
        pageErrorCount: pageErrors.length,
        pageErrors: cap(pageErrors),
        consoleErrorCount: consoleErrors.length,
        consoleErrors: cap(consoleErrors),
      });
      console.log(bad ? 'saved ⚠' : 'saved');

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Manifest of what we captured — consumed by post.mjs.
  const indexPath = resolve(args.out, '_shots.json');
  const fs = await import('node:fs');
  fs.writeFileSync(
    indexPath,
    JSON.stringify({ app, baseUrl, title: manifest.title ?? app, shots: written }, null, 2),
  );

  console.log(`\n✓ ${written.length} screenshot(s) → ${args.out}`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
