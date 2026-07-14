#!/usr/bin/env node
// Push captured screenshots to the `pr-assets` orphan branch and post (or
// update) a PR comment with the images inlined.
//
// Usage:
//   node post.mjs [--out ./out] [--pr <number>] [--branch <assets-branch>] [--dry-run]
//
// - Screenshots live on an orphan branch (`pr-assets` by default), namespaced
//   per source branch, so neither main nor the PR diff gets binary noise.
// - Images are referenced by immutable raw.githubusercontent URLs pinned to the
//   pushed commit SHA, so they keep rendering even after later runs.
// - The comment carries a hidden marker; re-running updates that comment in
//   place instead of stacking duplicates.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
// Per-app marker so multiple apps (webbapp + admin-web) each get their own
// comment instead of overwriting one another.
const markerFor = (app) => `<!-- pr-screenshots:${app || 'app'}:do-not-remove -->`;
const repoRoot = resolve(here, '..', '..');

function sh(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, { encoding: 'utf8', cwd: repoRoot, ...opts }).trim();
}

function parseArgs(argv) {
  const args = { out: resolve(here, 'out'), assetsBranch: 'pr-assets', dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = resolve(argv[++i]);
    else if (a === '--pr') args.pr = argv[++i];
    else if (a === '--branch') args.assetsBranch = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  return args;
}

function ownerRepo() {
  // In GitHub Actions, GITHUB_REPOSITORY is "owner/repo".
  if (process.env.GITHUB_REPOSITORY?.includes('/')) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return { owner, repo };
  }
  const url = sh('git', ['config', '--get', 'remote.origin.url']);
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error(`Cannot parse owner/repo from remote: ${url}`);
  return { owner: m[1], repo: m[2] };
}

function currentBranch() {
  // Actions checks out a detached merge ref; the real source branch is in
  // GITHUB_HEAD_REF (pull_request events). Fall back to git locally.
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  return sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
}

function pushAssets(assetsBranch, srcBranch, outDir, files) {
  // Use a throwaway worktree so the user's working tree is never touched.
  const wt = mkdtempSync(join(tmpdir(), 'pr-assets-'));
  try {
    sh('git', ['fetch', 'origin', assetsBranch], { stdio: 'ignore' });
  } catch {
    /* branch may not exist yet */
  }
  let hasRemote = false;
  try {
    sh('git', ['rev-parse', '--verify', `origin/${assetsBranch}`], { stdio: 'ignore' });
    hasRemote = true;
  } catch {
    hasRemote = false;
  }

  try {
    if (hasRemote) {
      sh('git', ['worktree', 'add', '--force', '-B', assetsBranch, wt, `origin/${assetsBranch}`]);
    } else {
      sh('git', ['worktree', 'add', '--detach', '--force', wt]);
      sh('git', ['checkout', '--orphan', assetsBranch], { cwd: wt });
      try {
        sh('git', ['rm', '-rf', '.'], { cwd: wt, stdio: 'ignore' });
      } catch {
        /* empty tree */
      }
    }

    const destDir = join(wt, srcBranch);
    mkdirSync(destDir, { recursive: true });
    for (const f of files) copyFileSync(join(outDir, f), join(destDir, f));

    sh('git', ['add', '-A'], { cwd: wt });
    // Allow empty in case identical files re-committed; --no-verify to skip hooks.
    sh('git', ['-c', 'user.name=pr-screenshots', '-c', 'user.email=pr-screenshots@local',
      'commit', '--no-verify', '--allow-empty', '-m', `screenshots: ${srcBranch}`], { cwd: wt });
    const sha = sh('git', ['rev-parse', 'HEAD'], { cwd: wt });
    sh('git', ['push', '--force', 'origin', `${assetsBranch}:${assetsBranch}`], { cwd: wt });
    return sha;
  } finally {
    try {
      sh('git', ['worktree', 'remove', '--force', wt]);
    } catch {
      rmSync(wt, { recursive: true, force: true });
    }
  }
}

function shotWarnings(s) {
  const w = [];
  if (s.navFailed) w.push('navigation failed / timed out');
  else if (typeof s.status === 'number' && s.status >= 400) w.push(`HTTP ${s.status}`);
  if (s.pageErrorCount) w.push(`${s.pageErrorCount} uncaught JS error(s)`);
  if (s.consoleErrorCount) w.push(`${s.consoleErrorCount} console error(s)`);
  return w;
}

function buildComment({ owner, repo, sha, srcBranch, index }) {
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encodeURIComponent(srcBranch)}`;
  const byViewport = {};
  for (const s of index.shots) (byViewport[s.viewport] ??= []).push(s);

  // Health summary: anything that smells like a broken page.
  const flagged = index.shots.filter(
    (s) => s.navFailed || (typeof s.status === 'number' && s.status >= 400) || s.pageErrorCount > 0,
  );

  let body = `${markerFor(index.app)}\n## 📸 Frontend screenshots — \`${index.title}\`\n\n`;
  body += `_Auto-captured from branch \`${srcBranch}\`. ${index.shots.length} shot(s)._\n\n`;
  if (flagged.length) {
    body += `> ⚠️ **${flagged.length} page(s) look broken** — ${flagged
      .map((s) => `\`${s.path}\` (${shotWarnings(s).join(', ')})`)
      .join(', ')}\n\n`;
  }

  for (const [vp, shots] of Object.entries(byViewport)) {
    body += `### ${vp}\n\n`;
    for (const s of shots) {
      const warnings = shotWarnings(s);
      const flag = warnings.length ? ' ⚠️' : '';
      body += `**\`${s.path}\`** — ${s.name}${flag}\n\n`;
      body += `<img src="${rawBase}/${encodeURIComponent(s.file)}" width="${vp === 'mobile' ? 320 : 720}" />\n\n`;
      if (warnings.length) {
        body += `> ⚠️ ${warnings.join(' · ')}\n`;
        const msgs = [...(s.pageErrors ?? []), ...(s.consoleErrors ?? [])];
        if (msgs.length) {
          body += `>\n> <details><summary>error details</summary>\n>\n`;
          for (const m of msgs) body += `> - \`${String(m).replace(/`/g, "'").slice(0, 200)}\`\n`;
          body += `> </details>\n`;
        }
        body += `\n`;
      }
    }
  }
  body += buildFooter(srcBranch);
  return body;
}

// Provenance line so reviewers know exactly which commit/run produced the shots.
function buildFooter(srcBranch) {
  const parts = [];
  let sha = process.env.PR_HEAD_SHA || process.env.GITHUB_SHA;
  if (!sha) {
    try {
      sha = sh('git', ['rev-parse', 'HEAD']);
    } catch {
      /* not a git checkout */
    }
  }
  parts.push(sha ? `\`${srcBranch}\` @ \`${sha.slice(0, 9)}\`` : `\`${srcBranch}\``);

  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    parts.push(`[Actions run](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID})`);
  }
  parts.push(`captured ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`);
  return `\n<sub>🤖 ${parts.join(' · ')}</sub>\n`;
}

function resolvePr(explicit) {
  if (explicit) return explicit;
  const json = sh('gh', ['pr', 'view', '--json', 'number']);
  return String(JSON.parse(json).number);
}

function upsertComment(pr, body, marker) {
  // Find an existing comment with this app's marker and edit it; otherwise create.
  const raw = sh('gh', ['api', `repos/{owner}/{repo}/issues/${pr}/comments`, '--paginate']);
  const comments = JSON.parse(raw);
  const existing = comments.find((c) => c.body && c.body.includes(marker));
  if (existing) {
    sh('gh', ['api', '--method', 'PATCH', `repos/{owner}/{repo}/issues/comments/${existing.id}`,
      '-f', `body=${body}`]);
    return `updated comment ${existing.id}`;
  }
  sh('gh', ['pr', 'comment', pr, '--body', body]);
  return 'created new comment';
}

function main() {
  const args = parseArgs(process.argv);
  const index = JSON.parse(readFileSync(join(args.out, '_shots.json'), 'utf8'));
  const files = readdirSync(args.out).filter((f) => f.endsWith('.png'));
  if (files.length === 0) throw new Error('No PNGs in out dir — run capture.mjs first.');

  const srcBranch = currentBranch();
  const { owner, repo } = ownerRepo();

  if (args.dryRun) {
    const body = buildComment({ owner, repo, sha: '<sha>', srcBranch, index });
    console.log(body);
    console.log(`\n(dry-run) would push ${files.length} file(s) to ${args.assetsBranch}/${srcBranch}`);
    return;
  }

  console.log(`→ Pushing ${files.length} screenshot(s) to ${args.assetsBranch}/${srcBranch} …`);
  const sha = pushAssets(args.assetsBranch, srcBranch, args.out, files);
  console.log(`  committed ${sha.slice(0, 9)}`);

  const pr = resolvePr(args.pr);
  const body = buildComment({ owner, repo, sha, srcBranch, index });
  console.log(`→ Posting to PR #${pr} …`);
  const result = upsertComment(pr, body, markerFor(index.app));
  console.log(`✓ ${result}`);
}

try {
  main();
} catch (err) {
  console.error(`\n✗ ${err.message}`);
  if (/gh auth|HTTP 401|not logged/i.test(String(err.message))) {
    console.error('  → Run `gh auth login` first.');
  }
  process.exit(1);
}
