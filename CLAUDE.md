# Taskly

Todo app. Two independent npm projects, no root package.json:
run every command inside `backend/` or `frontend/`.

- `backend/`: Express 5, Prisma 7 (PostgreSQL), Zod. Feature code in
  `src/features/todos/`: router → repository → Prisma; validators and
  mappers are pure functions.
- `frontend/`: React 19, Vite, React Query, styled-components. Feature code
  in `src/features/todos/` (api, hooks, components, utils).

## Commands (in each folder)
- Install: `npm ci`. Backend generates the Prisma client into
  `src/generated/` on install; it is not in git.
- `npm test`, `npm run test:coverage`, `npm run typecheck`.
- One file: `npx vitest run <path>`.

## Tests
- Vitest. Tests use no real database and no network.
- Backend: tests in `backend/tests/`, fixtures in `tests/fixture.ts`.
  Router tests use Supertest with a fake repository; repository tests
  spy on `database.todo`. Validators and mappers must stay at 100%
  coverage.
- Backend imports: source files use `.js` extensions, tests import
  source with `.ts` (`'../src/features/todos/router.ts'`).
- Frontend: Testing Library + jsdom. Tests sit next to the source as
  `*.test.ts(x)`; fixtures in `src/test/todoFixture.ts`.
- Existing frontend tests mock our own modules with `vi.mock` (`request`
  from `src/lib/http.ts`, hooks, `design-system/mocks`). Keep those mocks
  when editing such a file; new test files mock only at system boundaries
  (network, database, time).
- Do not test generated code, `types.ts`, `index.ts` or `src/design-system/`.

## Gotchas
- The database schema is created by raw SQL in `backend/src/core/database.ts`,
  not by Prisma migrations. Change it together with `backend/prisma/schema.prisma`.
- `backend/openapi.json` is maintained by hand. Update it when an endpoint
  changes.
