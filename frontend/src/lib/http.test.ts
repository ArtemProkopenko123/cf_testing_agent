import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './http'

const fetchMock = vi.fn()
const genericError = 'The operation failed. Please try again.'
const validationHint =
  'Check the task details: title up to 120 characters, description up to 2000 characters, and a valid due date.'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('request', () => {
  it('prefixes the path with /api and sends a JSON content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))
    await request('/todos')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/todos')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('passes the method and body of the call through to fetch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 7 }))
    await request('/todos', { method: 'POST', body: '{"title":"Demo"}' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"title":"Demo"}')
  })

  it('resolves with the parsed JSON body of a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 7, title: 'Demo' }))
    await expect(request('/todos/7')).resolves.toEqual({ id: 7, title: 'Demo' })
  })

  it('resolves to undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(
      request('/todos/7', { method: 'DELETE' }),
    ).resolves.toBeUndefined()
  })

  it('throws the server detail message for a failed request', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'Task not found.' }, 404),
    )
    await expect(request('/todos/7')).rejects.toThrow('Task not found.')
  })

  it('shows the validation hint for 422 instead of the server detail', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'title: String should have at most 120 characters' }, 422),
    )
    await expect(request('/todos')).rejects.toThrow(validationHint)
  })

  it('shows a generic message when the error body has no string detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: [{ msg: 'bad' }] }, 500))
    await expect(request('/todos')).rejects.toThrow(genericError)
  })

  it('shows a generic message when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502 }),
    )
    await expect(request('/todos')).rejects.toThrow(genericError)
  })

  it('reports a connection problem when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(request('/todos')).rejects.toThrow(
      'Cannot connect to the server. Please try again.',
    )
  })

  it('rethrows the original error when the caller aborted the request', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    controller.abort()
    fetchMock.mockRejectedValue(abortError)
    await expect(
      request('/todos', { signal: controller.signal }),
    ).rejects.toBe(abortError)
  })
})
