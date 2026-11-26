import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPatch, checkReport, parsePatch } from './verify-agent.mjs';

const patch = (path, body, extra = '') =>
  `diff --git a/${path} b/${path}\n${extra}--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n${body}\n`;

test('accepts new test files with ordinary cases', () => {
  const files = parsePatch(patch('frontend/src/lib/http.test.ts', "+it('sends JSON', () => {})"));
  assert.deepEqual(checkPatch(files), []);
});

test('rejects source files, deletions, focused tests and secrets', () => {
  const problems = checkPatch([
    ...parsePatch(patch('frontend/src/lib/http.ts', '+export const x = 1')),
    ...parsePatch(patch('backend/tests/router.test.ts', '-old', 'deleted file mode 100644\n')),
    ...parsePatch(patch('backend/tests/config.test.ts', "+it.only('runs alone', () => {})")),
    ...parsePatch(patch('backend/tests/health.test.ts', "+const token = 'sk-ant-oat01-abcdefghijk'")),
  ]);
  assert.equal(problems.length, 4, problems.join('\n'));
});

test('validates the report format', () => {
  const good = {
    status: 'completed',
    files: [
      { path: 'a.ts', decision: 'create', reason: 'no tests', result: 'passed' },
      { path: 'README.md', decision: 'skip', reason: 'docs' },
    ],
    suspected_bugs: [],
  };
  assert.deepEqual(checkReport(good), []);
  // unknown status, unknown decision, no reason, no result, no suspected_bugs list
  assert.equal(checkReport({ status: 'done', files: [{ path: 'a.ts', decision: 'make' }] }).length, 5);
  assert.deepEqual(checkReport(null), ['the report is not a JSON object']);
});
