import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const { AbortController, Response, URL } = globalThis;

test('requests the university listing with the shared API client', async t => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { getUniversities } = await server.ssrLoadModule('/src/services/lookupApi.ts');
  const { ApiError } = await server.ssrLoadModule('/src/services/apiClient.ts');
  const { signal } = new AbortController();
  const responseBody = 'opaque JSON test payload';
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(responseBody));

  assert.equal(await getUniversities(signal), responseBody);
  const [url, options] = fetch.mock.calls[0].arguments;
  const requestUrl = new URL(url, 'http://localhost');
  assert.equal(requestUrl.pathname, '/api/universities');
  assert.equal(requestUrl.search, '');
  assert.deepEqual(options, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  fetch.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  await assert.rejects(getUniversities(), error => error instanceof ApiError && error.status === 503);
});
