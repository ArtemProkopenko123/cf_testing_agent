import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManifest, classify } from './analyze-pr.mjs';

test('picks source files and tells the side', () => {
  assert.deepEqual(classify('backend/src/core/lifespan.ts'), { target: true, side: 'backend' });
  assert.deepEqual(classify('frontend/src/features/todos/utils/todos.ts'), { target: true, side: 'frontend' });
  assert.deepEqual(classify('frontend/src/features/todos/TodosPage.tsx'), { target: true, side: 'frontend' });
});

test('skips files with nothing to unit test', () => {
  const skipped = [
    'README.md',
    '.github/workflows/unit-tests.yml',
    'backend/package.json',
    'backend/tests/router.test.ts',
    'frontend/src/features/todos/TodosPage.test.tsx',
    'frontend/src/test/todoFixture.ts',
    'backend/src/features/todos/types.ts',
    'frontend/src/features/todos/index.ts',
    'frontend/src/design-system/components/Button/Button.tsx',
    'frontend/src/design-system/components/Button/Button.stories.tsx',
    'backend/src/generated/prisma/client.ts',
    'frontend/src/main.tsx',
    'backend/src/main.ts',
    'frontend/src/features/todos/api/queryKeys.ts',
  ];
  for (const path of skipped) assert.equal(classify(path).target, false, path);
});

test('splits a change into files for the agent and skipped files with reasons', () => {
  const manifest = buildManifest(['backend/src/factory.ts', 'README.md'], { title: 'T', body: '' });
  assert.deepEqual(manifest.files, [{ path: 'backend/src/factory.ts', side: 'backend' }]);
  assert.deepEqual(manifest.skipped, [
    { path: 'README.md', reason: 'not source code under backend/src or frontend/src' },
  ]);
});
