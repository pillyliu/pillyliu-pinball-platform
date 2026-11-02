import assert from 'node:assert/strict';
import test from 'node:test';
import { prefetchPinballTextAssets } from '../../shared/ui/pinballCache';

test('catalog prefetch leaves foreground capacity and retries unsuccessful files', async (t) => {
  const state = new Map<string, string>([['pinball-cache:v1:asset-hashes:text', JSON.stringify({
    '/pinball/gameinfo/game-0.md': 'old-version',
    '/pinball/gameinfo/retired.md': 'retired-version',
  })]]);
  const downloaded = new Set<string>();
  const deleted = new Set<string>();
  let active = 0, maximum = 0, allowLast = false;
  const paths = Array.from({ length: 24 }, (_, i) => `/pinball/gameinfo/game-${i}.md`);
  const manifest = { schemaVersion: 2, files: Object.fromEntries(paths.map(path => [path, { hash: path }])) };
  const cache = { put: async (url: string) => { downloaded.add(url); }, delete: async (url: string) => { deleted.add(url); return true; } };
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    if (url.endsWith('cache-manifest.json')) return new Response(JSON.stringify(manifest));
    active++; maximum = Math.max(maximum, active);
    try {
      await new Promise(resolve => setTimeout(resolve, 2));
      if (url.endsWith('game-23.md') && !allowLast) throw new Error('temporary network failure');
      return new Response('Game notes');
    } finally { active--; }
  });
  Object.assign(globalThis, {
    window: { caches: {}, location: { origin: 'https://pillyliu.com' } },
    caches: { open: async () => cache },
    localStorage: { getItem: (key: string) => state.get(key) ?? null, setItem: (key: string, value: string) => state.set(key, value) },
  });
  await prefetchPinballTextAssets(['/pinball/gameinfo/']);
  assert.ok(maximum > 1 && maximum <= 8, `maximum concurrent downloads: ${maximum}`);
  assert.equal(downloaded.size, 23);
  assert.ok(!deleted.has(paths[0]), 'a refreshed file must remain cached');
  assert.ok(deleted.has('/pinball/gameinfo/retired.md'), 'retired files should be removed');
  const hashes = () => JSON.parse(state.get('pinball-cache:v1:asset-hashes:text')!);
  assert.equal(hashes()[paths[23]], undefined, 'failed file must not be recorded as cached');
  allowLast = true;
  await prefetchPinballTextAssets(['/pinball/gameinfo/']);
  assert.equal(downloaded.size, 24);
  assert.equal(hashes()[paths[23]], paths[23]);
});
