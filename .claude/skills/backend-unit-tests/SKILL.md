---
name: backend-unit-tests
description: Writes Vitest unit tests for the Express + Prisma backend in backend/src without a database. Covers which seam to test each file through, how to fake Prisma, Supertest requests and env handling. Use when creating or updating a test in backend/tests/.
---

# Backend unit tests

Tests live flat in `backend/tests/<source name>.test.ts`, import from
`vitest` explicitly and import source with `.ts`
(`'../src/features/todos/router.ts'`). Fixtures: `record` (database row)
and `todo` (API shape) from `tests/fixture.ts`.

## Pick the seam by file

| File | Test through | Fake |
|---|---|---|
| `features/*/validators.ts`, `mappers.ts` | direct call | nothing |
| `core/config.ts` | `resolveDatabaseUrl()` | env via `vi.stubEnv` |
| `features/*/repository.ts` | repository methods | Prisma delegate (`vi.spyOn(database.todo, …)`) |
| `features/*/router.ts` | Supertest on `express()` + router | existing file uses a `vi.fn()` `TodoStore`: keep it there |
| `api/*.ts`, `factory.ts` | Supertest on `createApp(database)` | Prisma delegate |
| `core/database.ts` (`initialize`) | `initialize(database)` | `vi.spyOn(database, '$executeRaw')` |
| `core/lifespan.ts` | `start()` | `vi.mock` of `core/database.ts` |
| `main.ts` | skip: entry point, only calls `start()` | |

The database is the boundary: fake the Prisma client or the one module
that creates it (`core/database.ts`), never other modules of ours.

## Templates

Real client, faked IO (no connection is opened):

```ts
const database = createDatabase('postgresql://test:test@localhost:5432/test');
vi.spyOn(database.todo, 'findUnique').mockResolvedValue(record);
afterEach(() => vi.restoreAllMocks());
```

App-level request:

```ts
const app = createApp(database);
const response = await request(app).get('/api/health');
expect(response.status).toBe(200);
expect(response.body).toEqual({ status: 'ok' });
```

Server start (`lifespan.ts`): mock only `createDatabase`, keep the rest of
the module, listen on a free port and clean up.

```ts
const fake = vi.hoisted(() => ({ $connect: vi.fn(), $disconnect: vi.fn(), $executeRaw: vi.fn(), todo: { findFirst: vi.fn() } }));
vi.mock('../src/core/database.ts', async (original) => ({ ...(await original<object>()), createDatabase: () => fake }));
// in the test: vi.stubEnv('DATABASE_URL', 'postgresql://x/y'); vi.stubEnv('API_PORT', '0');
// afterEach: close the server, vi.unstubAllEnvs(), process.removeAllListeners('SIGTERM') and ('SIGINT')
```

## What to assert

- HTTP: status and body. Errors use `{ detail }`: invalid JSON → 422
  `'Invalid JSON.'`, unknown route → 404 `'Not Found'`, missing task → 404
  `'Task not found.'`, a throwing dependency → 500
  `'Internal Server Error'`.
- On rejected input, also assert the repository or delegate was not called.
- Repository: the mapped result and the query arguments sent to Prisma.
- Silence expected `console.error` / `console.log` with
  `vi.spyOn(console, 'error').mockImplementation(() => {})`.

## Do not

- Open a real connection or call `$connect` on a real client.
- Test Swagger UI at `/docs`: that is the library's job.
- Snapshot the SQL in `initialize`; assert the statement it must contain
  (`CREATE TABLE IF NOT EXISTS todos`).

Read `references/prisma-mocking.md` when a test needs a Prisma method not
shown above, a rejected query, or exact timestamps.
