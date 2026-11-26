---
name: frontend-unit-tests
description: Writes Vitest and Testing Library unit tests for the React frontend in frontend/src. Covers which entry point to test each file through, faking the network with a fetch stub, rendering with the real design system and testing React Query hooks. Use when creating or updating a *.test.ts(x) file in frontend/src.
---

# Frontend unit tests

Tests sit next to the source as `<name>.test.ts(x)` and import from
`vitest` explicitly. Fixture: `todoFixture` from `src/test/todoFixture.ts`;
build variants by spreading (`{ ...todoFixture, id: 1, completed: true }`).

## Pick the entry point by file

| File | Test through | Fake |
|---|---|---|
| `features/*/utils/*.ts` | direct call | the clock, when the result depends on today |
| `lib/http.ts`, `features/*/api/*.ts` | call the function | `fetch` |
| React Query hooks (`features/*/hooks/use*Query.ts`, `use*Mutation.ts`, `useTodosBusy.ts`) | `renderHook` with the `wrapper` from `setup()` below | `fetch` |
| other hooks (`useNotice.ts`, `useTodoFilters.ts`) | `renderHook` | fake timers when time matters |
| components | `render` inside providers, `userEvent`, queries by role and text | `fetch` |
| `app/AppProviders.tsx` | render a child that reads the query client and the theme | nothing |
| `main.tsx`, `design-system/**`, `queryKeys.ts`, `lib/queryClient.ts` | skip: excluded from coverage | |

New test files fake only the network (`fetch`) and time. They render the
real design system and real hooks. An existing test file that mocks
`design-system/mocks` or our own hooks keeps those mocks. When those mocks
hide what you need to test, put the new cases in `<name>.flow.test.tsx`:
render the real children, drive them with `userEvent` the way a user would
(open the form, submit, confirm the delete) and check the result on screen
and in the requests sent to `fetch`.

## Templates

Network stub and a fresh client per test (never create the client inside
the wrapper: it would be recreated on every render):

```tsx
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => vi.resetAllMocks())

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <AppProviders client={client}>{children}</AppProviders>
  return { client, wrapper, user: userEvent.setup() }
}
```

Responses: `new Response(JSON.stringify(body), { status })`; for 204 use
`new Response(null, { status: 204 })`. The request is
`const [url, init] = fetchMock.mock.calls[0]`; the body is
`JSON.parse(init.body)`.

Components need `AppProviders`: styled components read the theme and crash
without it. Always pass the fresh `client` from `setup()`, even when the
component makes no requests; without it `AppProviders` falls back to the
app's shared client and its cache leaks between tests. Render with
`render(ui, { wrapper })`.

`Drawer` uses `<dialog>.showModal()`, which jsdom lacks. In a file that
renders a `Drawer`:

```ts
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
```

## What to assert

- What the user sees: `getByRole('button', { name: 'Delete task' })`,
  `findByText('Task not found.')`, `toBeDisabled()`. No class names, no
  styled-components internals.
- Callbacks a parent relies on: `expect(onDeleted).toHaveBeenCalledOnce()`.
- Requests at the boundary: URL, method and body, e.g. `'/api/todos/7'`
  with `DELETE`.
- Error text comes from `lib/http.ts`: a `detail` string is shown as is;
  422 shows the validation hint; a failed `fetch` shows
  `'Cannot connect to the server. Please try again.'`.

## Do not

- Mock `request`, `todosApi`, our hooks or the design system in a new file.
- Use `fireEvent` where `userEvent` works.
- Wait with `setTimeout`; use `findBy*` or `waitFor`.

Read `references/react-query-hooks.md` when testing a query or mutation
hook, cache updates, pending state or abort signals.
