import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const { AbortController, Response } = globalThis;

test('loads the tag map with its version and preserves the API error contract', async t => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { getTagMap } = await server.ssrLoadModule('/src/services/lookupApi.ts');
  const { ApiError } = await server.ssrLoadModule('/src/services/apiClient.ts');
  const entry = { keyword: 'example keyword', tag: 'example tag' };
  const dictionary = { version: 'test-v1', entries: [entry] };
  const { signal } = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json(dictionary));

  assert.deepEqual(await getTagMap(signal), dictionary);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.ok(url.endsWith('/api/tag-map'));
  assert.equal(options.method ?? 'GET', 'GET');
  assert.deepEqual(options.headers, { Accept: 'application/json' });
  assert.equal(options.signal, signal);

  const emptyDictionary = { version: 'test-v2', entries: [] };
  fetch.mock.mockImplementation(async () => Response.json(emptyDictionary));
  assert.deepEqual(await getTagMap(), emptyDictionary);

  for (const body of [null, { entries: [] }, { ...dictionary, version: 1 },
    { ...dictionary, entries: null }, { ...dictionary, entries: [null] },
    { ...dictionary, entries: [{ ...entry, keyword: 1 }] },
    { ...dictionary, entries: [{ ...entry, tag: null }] }]) {
    fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(getTagMap(), /전공 키워드 사전 응답/);
  }

  for (const status of [401, 503]) {
    fetch.mock.mockImplementation(async () => Response.json({ code: 'TEST_ERROR' }, { status }));
    await assert.rejects(getTagMap(), error => error instanceof ApiError && error.status === status);
  }
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(getTagMap(), TypeError);
});
