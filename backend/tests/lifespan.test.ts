import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, it, expect, vi, type MockInstance } from 'vitest';
import { createDatabase } from '../src/core/database.ts';
import { start } from '../src/core/lifespan.ts';

const { fake, createDatabase: createFakeDatabase } = vi.hoisted(() => {
  const fake = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $executeRaw: vi.fn(),
    todo: { findFirst: vi.fn() },
  };
  return { fake, createDatabase: vi.fn(() => fake) };
});
vi.mock('../src/core/database.ts', async (original) => ({ ...(await original<object>()), createDatabase: createFakeDatabase }));

let onceSpy: MockInstance<typeof process.once>;
let consoleError: MockInstance<typeof console.error>;
const servers: Server[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  fake.$connect.mockReset().mockResolvedValue(undefined);
  fake.$disconnect.mockReset().mockResolvedValue(undefined);
  fake.$executeRaw.mockReset().mockResolvedValue(0);
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  vi.stubEnv('API_PORT', '0');
  // Capture signal handlers instead of registering them on the test process.
  onceSpy = vi.spyOn(process, 'once').mockImplementation(() => process);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.unstubAllEnvs();
  onceSpy.mockRestore();
  consoleError.mockRestore();
  process.exitCode = undefined;
});

async function startServer() {
  const result = await start();
  servers.push(result.server);
  return result;
}

function shutdownHandler(signal: string) {
  const call = onceSpy.mock.calls.find(([name]) => name === signal);
  expect(call).toBeDefined();
  return call![1] as () => void;
}

it('opens the database from DATABASE_URL, connects, then creates the schema', async () => {
  await startServer();
  expect(createDatabase).toHaveBeenCalledWith('postgresql://test:test@localhost:5432/test');
  expect(fake.$connect.mock.invocationCallOrder[0]).toBeLessThan(fake.$executeRaw.mock.invocationCallOrder[0]);
});

it('resolves the listening server and the database', async () => {
  const { server, database } = await startServer();
  expect(server.listening).toBe(true);
  expect(database).toBe(fake);
});

it('listens on the port from API_PORT', async () => {
  const { server } = await startServer();
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.stubEnv('API_PORT', String(port));
  const { server: restarted } = await startServer();
  expect((restarted.address() as AddressInfo).port).toBe(port);
});

it('rejects and disconnects when the database cannot be reached', async () => {
  fake.$connect.mockRejectedValue(new Error('connect ECONNREFUSED'));
  await expect(start()).rejects.toThrow('connect ECONNREFUSED');
  expect(fake.$disconnect).toHaveBeenCalledOnce();
  expect(fake.$executeRaw).not.toHaveBeenCalled();
});

it('rejects and disconnects when schema creation fails', async () => {
  fake.$executeRaw.mockRejectedValue(new Error('permission denied for schema public'));
  await expect(start()).rejects.toThrow('permission denied for schema public');
  expect(fake.$disconnect).toHaveBeenCalledOnce();
});

it('rejects with the real listen error and disconnects when the port is taken', async () => {
  const { server: occupier } = await startServer();
  vi.stubEnv('API_PORT', String((occupier.address() as AddressInfo).port));
  fake.$disconnect.mockClear();
  await expect(start()).rejects.toMatchObject({ code: 'EADDRINUSE' });
  expect(fake.$disconnect).toHaveBeenCalledOnce();
});

it.each(['SIGTERM', 'SIGINT'])('closes the server and disconnects on %s', async (signal) => {
  const { server } = await startServer();
  shutdownHandler(signal)();
  await vi.waitFor(() => expect(fake.$disconnect).toHaveBeenCalledOnce());
  expect(server.listening).toBe(false);
});

it('sets exit code 1 and logs the error when disconnecting on shutdown fails', async () => {
  await startServer();
  const error = new Error('disconnect failed');
  fake.$disconnect.mockRejectedValue(error);
  shutdownHandler('SIGTERM')();
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(consoleError).toHaveBeenCalledWith(error);
});
