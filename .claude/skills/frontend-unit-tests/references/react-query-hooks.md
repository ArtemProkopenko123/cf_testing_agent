# React Query hooks reference

Use `setup()` from the skill: one `QueryClient` per test, `retry: false`
for queries and mutations, wrapper around `AppProviders client={client}`.
Without `retry: false` an error test waits for retries and times out.

## Queries

```tsx
fetchMock.mockResolvedValue(new Response(JSON.stringify([todoFixture])))
const { result } = renderHook(() => useTodosQuery(), { wrapper })
await waitFor(() => expect(result.current.isSuccess).toBe(true))
expect(result.current.data).toEqual([todoFixture])
```

- Error: respond with `{ status: 500 }` and a `detail`, wait for
  `isError`, assert `result.current.error?.message`.
- Abort signal: `todosApi.list` forwards it; assert
  `fetchMock.mock.calls[0][1].signal` is an `AbortSignal`.

## Mutations and the cache

Mutations update the cached list in `onSuccess` instead of refetching.
Seed the cache, run the mutation, read the cache back with the same key:

```tsx
const { client, wrapper } = setup()
client.setQueryData(todoKeys.list, [older])
fetchMock.mockResolvedValue(new Response(JSON.stringify(saved), { status: 201 }))
const { result } = renderHook(() => useCreateTodoMutation(), { wrapper })
await act(() => result.current.mutateAsync(input))
expect(client.getQueryData(todoKeys.list)).toEqual([saved, older])
```

| Hook | Expected cache after success |
|---|---|
| `useCreateTodoMutation` | saved task first, an older copy with the same id removed |
| `useUpdateTodoMutation` | the task with the same id replaced, order kept |
| `useDeleteTodoMutation` | the task with that id removed |

Also cover: the request sent (URL, method, body without read-only fields
such as `id` or `created_at`), an empty cache, and a failed request that
leaves the cache unchanged. On failure, `mutateAsync` rejects: use
`await expect(act(() => result.current.mutateAsync(input))).rejects.toThrow(...)`.

## Pending state

To observe a pending mutation, hold the response with a promise you
resolve yourself:

```tsx
let release!: (response: Response) => void
fetchMock.mockReturnValue(new Promise<Response>((resolve) => { release = resolve }))
act(() => { result.current.mutate(input) })
await waitFor(() => expect(result.current.isPending).toBe(true))
await act(async () => release(new Response(JSON.stringify(saved))))
```

`useTodosBusy` is true while any mutation under `todoKeys.all` is pending:
render it together with a mutation hook in one `renderHook` callback.

## Fake timers

React Query and `waitFor` need real timers. Fake time only in hooks that
schedule work themselves (`useNotice` hides its message after 4000 ms):

```tsx
vi.useFakeTimers()
afterEach(() => vi.useRealTimers())
act(() => vi.advanceTimersByTime(4000))
```
