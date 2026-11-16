import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const { AbortController, Response } = globalThis;

test('loads the majors dictionary and distinguishes failed responses', async t => {
  const server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false },
  });
  t.after(() => server.close());
  const { getMajors } = await server.ssrLoadModule('/src/services/lookupApi.ts');
  const { ApiError } = await server.ssrLoadModule('/src/services/apiClient.ts');
  const major = { code: 'code-without-format-assumption', name: '테스트 학과' };
  const signal = new AbortController().signal;
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ majors: [major] }));

  assert.deepEqual(await getMajors(signal), [major]);
  const [[url, options]] = fetch.mock.calls.map(call => call.arguments);
  assert.ok(url.endsWith('/api/majors'));
  assert.equal(options.method ?? 'GET', 'GET');
  assert.deepEqual(options.headers, { Accept: 'application/json' });
  assert.equal(options.signal, signal);

  fetch.mock.mockImplementation(async () => Response.json({ majors: [] }));
  assert.deepEqual(await getMajors(), []);

  for (const body of [{}, { majors: null }, { majors: [null] }, { majors: [{ ...major, code: 1 }] },
    { majors: [{ ...major, name: null }] }, { majors: [major, major] }]) {
    fetch.mock.mockImplementation(async () => Response.json(body));
    await assert.rejects(getMajors(), /학과 목록 응답/);
  }

  fetch.mock.mockImplementation(async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(getMajors(), /JSON 형식/);

  for (const status of [401, 403, 503]) {
    fetch.mock.mockImplementation(async () => Response.json({ code: 'TEST_ERROR' }, { status }));
    await assert.rejects(getMajors(), error => error instanceof ApiError && error.status === status);
  }

  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(getMajors(), TypeError);
});
