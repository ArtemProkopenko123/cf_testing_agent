# Prisma mocking reference

`createDatabase(url)` builds a real `PrismaClient` with the pg adapter.
Constructing it does not connect, so spying on its methods is enough to
test without PostgreSQL.

## Delegate methods used in this repo

| Method | Used by | Resolve with |
|---|---|---|
| `todo.findMany` | `repository.list` | `[record]` or `[]` |
| `todo.findUnique` | `repository.get` | `record` or `null` |
| `todo.findFirst` | `/api/health` | `null` is enough |
| `todo.create` | `repository.create` | `record` |
| `todo.updateManyAndReturn` | `repository.update` | `[record]`, or `[]` for a missing task |
| `todo.deleteMany` | `repository.delete` | `{ count: 1 }` or `{ count: 0 }` |
| `$executeRaw` | `initialize` | `0` (cast: `0 as never`) |

## Rows vs API objects

- A row (`record`) has `Date` objects; the API object (`todo`) has strings:
  `due_date` as `'YYYY-MM-DD'`, timestamps as ISO strings.
- The repository stores a due date as UTC midnight:
  `new Date('2026-10-15T00:00:00.000Z')`.
- Build variants by spreading: `{ ...record, completed: true }`.

## Failures

```ts
vi.spyOn(database.todo, 'findMany').mockRejectedValue(new Error('connection lost'));
```

Through `createApp`, a rejected query becomes 500
`{ detail: 'Internal Server Error' }` and logs with `console.error`.

## Timestamps

`create` and `update` set `created_at` / `updated_at` to `new Date()`.
Either assert `expect.any(Date)`, or pin the clock when the exact value
matters:

```ts
vi.useFakeTimers({ now: new Date('2026-11-01T12:00:00Z'), toFake: ['Date'] });
afterEach(() => vi.useRealTimers());
```

## Raw SQL

`$executeRaw` is a tagged template: the first call argument is the array of
SQL fragments.

```ts
const sql = (exec.mock.calls[0][0] as unknown as string[]).join('');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS todos');
```
