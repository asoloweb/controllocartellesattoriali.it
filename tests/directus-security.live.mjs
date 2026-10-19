import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.PUBLIC_DIRECTUS_URL || process.env.DIRECTUS_URL || 'https://admin.controllocartellesattoriali.it';

for (const path of [
  '/items/richieste?limit=0',
  '/items/richieste/1?fields=id',
  '/items/richieste?aggregate[count]=*',
]) {
  test(`anonymous reads are forbidden: ${path}`, async () => {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.data, undefined);
    assert.ok(body.errors?.some(error => error.extensions?.code === 'FORBIDDEN'));
  });
}

test('anonymous GraphQL cannot query requests', async () => {
  const response = await fetch(new URL('/graphql', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ richieste(limit: 0) { id } }' }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.data, undefined);
  assert.ok(body.errors?.some(error => error.extensions?.code === 'GRAPHQL_VALIDATION'));
});

test('public website pages remain readable', async () => {
  const response = await fetch(new URL('/items/pages?limit=0', base), {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test('backend token can still read requests', { skip: !process.env.DIRECTUS_TOKEN }, async () => {
  const response = await fetch(new URL('/items/richieste?limit=0', base), {
    headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});
