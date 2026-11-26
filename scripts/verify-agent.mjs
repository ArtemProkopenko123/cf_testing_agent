#!/usr/bin/env node
// Checks the test agent's work without trusting it: applies its patch to the
// pull request, runs deterministic checks and writes verify-result.json.
// Usage: PATCH=agent.patch REPORT=agent-report.json MANIFEST=manifest.json BASE_SHA=<sha> node scripts/verify-agent.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// The same paths the agent instructions allow it to write.
const ALLOWED = [
  /^backend\/tests\/.+\.test\.ts$/,
  /^backend\/tests\/fixture\.ts$/,
  /^frontend\/src\/.+\.test\.tsx?$/,
  /^frontend\/src\/test\/.+\.tsx?$/,
];
const FOCUS_OR_SKIP = /\b(?:it|test|describe)\.(?:only|skip)\b|\b[fx](?:it|describe)\(/;
const SECRET = /sk-ant-[\w-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/;
const STATUSES = ['completed', 'partial', 'env_error'];
const DECISIONS = ['create', 'update', 'skip'];
const RESULTS = ['passed', 'failed', 'suspected_bug', 'not_run'];

export function parsePatch(patch) {
  const files = [];
  let current = null;
  for (const line of patch.split('\n')) {
    const header = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (header) {
      current = { path: header[2], deleted: false, added: [] };
      files.push(current);
    } else if (current && line.startsWith('deleted file mode')) {
      current.deleted = true;
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push(line.slice(1));
    }
  }
  return files;
}

export function checkPatch(files) {
  const problems = [];
  for (const file of files) {
    if (!ALLOWED.some((pattern) => pattern.test(file.path))) problems.push(`changed a file outside the allowed test paths: ${file.path}`);
    if (file.deleted) problems.push(`deleted a file: ${file.path}`);
    for (const line of file.added) {
      if (FOCUS_OR_SKIP.test(line)) problems.push(`left .only or .skip in ${file.path}: ${line.trim()}`);
      if (SECRET.test(line)) problems.push(`added something that looks like a secret to ${file.path}`);
    }
  }
  return problems;
}

export function checkReport(report) {
  const problems = [];
  if (!report || typeof report !== 'object') return ['the report is not a JSON object'];
  if (!STATUSES.includes(report.status)) problems.push(`unknown status: ${report.status}`);
  if (!Array.isArray(report.files)) return [...problems, 'the report has no files list'];
  for (const file of report.files) {
    const name = file?.path ?? '(no path)';
    if (typeof file?.path !== 'string') problems.push('a file entry has no path');
    if (!DECISIONS.includes(file?.decision)) problems.push(`${name}: unknown decision ${file?.decision}`);
    if (typeof file?.reason !== 'string' || !file.reason) problems.push(`${name}: no reason`);
    if (file?.decision !== 'skip' && !RESULTS.includes(file?.result)) problems.push(`${name}: unknown result ${file?.result}`);
  }
  if (!Array.isArray(report.suspected_bugs)) problems.push('the report has no suspected_bugs list');
  return problems;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.slice(-2000) };
}

const sideOf = (path) => (path.startsWith('backend/') ? 'backend' : 'frontend');
const inSide = (side, path) => path.slice(side.length + 1);

function main() {
  const env = process.env;
  const checks = [];
  const warnings = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const report = existsSync(env.REPORT) ? JSON.parse(readFileSync(env.REPORT, 'utf8')) : null;
  const reportProblems = checkReport(report);
  add('Report matches the agent format', !reportProblems.length, reportProblems.join('; '));

  const patch = existsSync(env.PATCH) ? readFileSync(env.PATCH, 'utf8') : '';
  const files = parsePatch(patch);
  const patchProblems = checkPatch(files);
  add('Only test files changed, no .only/.skip, no secrets', !patchProblems.length, patchProblems.join('; '));

  const applied = patch ? run('git', ['apply', '--whitespace=nowarn', env.PATCH]) : { ok: true };
  add('Patch applies to the pull request', applied.ok, applied.ok ? '' : applied.output);

  const testFiles = files.filter((f) => !f.deleted && /\.test\.tsx?$/.test(f.path)).map((f) => f.path);
  const sides = [...new Set(files.map((f) => sideOf(f.path)))];

  if (applied.ok && !patchProblems.length) {
    for (const side of sides) {
      const typecheck = run('npm', ['run', 'typecheck', '--prefix', side]);
      add(`${side}: typecheck`, typecheck.ok, typecheck.ok ? '' : typecheck.output);
      const suite = run('npm', ['run', 'test:coverage', '--prefix', side]);
      add(`${side}: all tests pass and coverage stays above the thresholds`, suite.ok, suite.ok ? '' : suite.output);

      const own = testFiles.filter((path) => sideOf(path) === side).map((path) => inSide(side, path));
      let stable = true;
      for (let i = 0; i < 3 && stable && own.length; i += 1) {
        stable = run('npx', ['vitest', 'run', ...own], { cwd: side }).ok;
      }
      if (own.length) add(`${side}: the agent's tests pass 3 runs in a row`, stable);
    }

    // Do the new tests notice the change? Put the changed source files back to
    // their base version and expect at least one new test file to fail.
    const manifest = existsSync(env.MANIFEST) ? JSON.parse(readFileSync(env.MANIFEST, 'utf8')) : { files: [] };
    for (const side of sides) {
      const sources = manifest.files.map((f) => f.path).filter((path) => sideOf(path) === side);
      const own = testFiles.filter((path) => sideOf(path) === side);
      if (!sources.length || !own.length) continue;
      const existed = sources.filter((path) => run('git', ['cat-file', '-e', `${env.BASE_SHA}:${path}`]).ok);
      if (!existed.length) continue;
      execFileSync('git', ['checkout', env.BASE_SHA, '--', ...existed]);
      const caught = own.filter((path) => !run('npx', ['vitest', 'run', inSide(side, path)], { cwd: side }).ok);
      execFileSync('git', ['checkout', 'HEAD', '--', ...existed]);
      if (caught.length) {
        add(`${side}: new tests fail on the code before this pull request`, true, caught.join(', '));
      } else {
        warnings.push(`${side}: the agent's tests also pass on the code before this pull request, so they do not catch this change (fine for a refactor or comment change).`);
      }
    }
  }

  const passed = checks.every((check) => check.ok);
  const result = { passed, checks, warnings, test_files: testFiles };
  writeFileSync(env.RESULT ?? 'verify-result.json', JSON.stringify(result, null, 2) + '\n');
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `passed=${passed}\n`);

  const lines = ['## Test agent: verify', '', passed ? 'All checks passed.' : 'Some checks failed.', '', '| Check | Result |', '|---|---|'];
  for (const check of checks) lines.push(`| ${check.name} | ${check.ok ? 'pass' : 'FAIL'} |`);
  for (const warning of warnings) lines.push('', `Warning: ${warning}`);
  for (const check of checks.filter((c) => !c.ok && c.detail)) lines.push('', `**${check.name}**`, '```', check.detail, '```');
  const text = lines.join('\n') + '\n';
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text);
  process.stdout.write(text);
  process.exitCode = passed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
