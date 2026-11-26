#!/usr/bin/env node
// Lists the files a pull request changed and decides which ones the unit test
// agent should look at. Writes manifest.json for the agent job.
// Usage: BASE_SHA=<sha> HEAD_SHA=<sha> [PR_TITLE=..] [PR_BODY=..] node scripts/analyze-pr.mjs
import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Commits pushed by the publish job carry this marker; the agent never runs on them.
export const AGENT_MARKER = '[unit-test-agent]';

const SOURCE = /^(backend\/src\/.+\.ts|frontend\/src\/.+\.tsx?)$/;

// Kept in line with the coverage excludes in backend/vitest.config.ts and frontend/vite.config.ts.
const NOT_TESTABLE = [
  [/\.test\.tsx?$/, 'test file'],
  [/^frontend\/src\/test\//, 'test setup or fixture'],
  [/(^|\/)types\.ts$|\.types\.ts$/, 'types only'],
  [/(^|\/)index\.ts$/, 're-exports only'],
  [/\.stories\.tsx?$/, 'Storybook story'],
  [/(^|\/)constants\.tsx?$|\.constants\.ts$/, 'constants only'],
  [/^backend\/src\/generated\//, 'generated code'],
  [/^backend\/src\/main\.ts$/, 'entry point, excluded from coverage'],
  [/^frontend\/src\/design-system\//, 'design system, excluded from coverage'],
  [/^frontend\/src\/main\.tsx$/, 'entry point, excluded from coverage'],
  [/^frontend\/src\/features\/todos\/api\/queryKeys\.ts$/, 'query keys, excluded from coverage'],
  [/^frontend\/src\/lib\/queryClient\.ts$/, 'query client setup, excluded from coverage'],
];

export function classify(path) {
  if (!SOURCE.test(path)) {
    return { target: false, reason: 'not source code under backend/src or frontend/src' };
  }
  for (const [pattern, reason] of NOT_TESTABLE) {
    if (pattern.test(path)) return { target: false, reason };
  }
  return { target: true, side: path.startsWith('backend/') ? 'backend' : 'frontend' };
}

export function buildManifest(changedPaths, pr) {
  const files = [];
  const skipped = [];
  for (const path of changedPaths) {
    const result = classify(path);
    if (result.target) files.push({ path, side: result.side });
    else skipped.push({ path, reason: result.reason });
  }
  return { pr, files, skipped };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function summary(manifest, skipReason) {
  const lines = ['## Test agent: changed files', ''];
  if (skipReason) lines.push(`Agent skipped: ${skipReason}.`, '');
  lines.push(`Files for the agent: ${manifest.files.length}. Skipped: ${manifest.skipped.length}.`, '');
  if (manifest.files.length || manifest.skipped.length) {
    lines.push('| File | Decision |', '|---|---|');
    for (const f of manifest.files) lines.push(`| \`${f.path}\` | test (${f.side}) |`);
    for (const f of manifest.skipped) lines.push(`| \`${f.path}\` | skip: ${f.reason} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  if (!base || !head) throw new Error('BASE_SHA and HEAD_SHA are required');
  // PR text is untrusted input: it only goes into manifest.json as data.
  const pr = { title: process.env.PR_TITLE ?? '', body: process.env.PR_BODY ?? '' };

  let manifest;
  let skipReason = null;
  if (git('log', '-1', '--format=%B', head).includes(AGENT_MARKER)) {
    skipReason = 'the latest commit was made by the agent';
    manifest = { pr, files: [], skipped: [] };
  } else {
    const changed = git('diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`);
    manifest = buildManifest(changed ? changed.split('\n') : [], pr);
    if (!manifest.files.length) skipReason = 'no source files to test';
  }

  writeFileSync(process.env.MANIFEST_PATH ?? 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `has_targets=${manifest.files.length > 0}\n`);
  }
  const text = summary(manifest, skipReason);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  process.stdout.write(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
