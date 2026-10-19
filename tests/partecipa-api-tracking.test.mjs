import assert from 'node:assert/strict';
import test from 'node:test';
import { POST, GET } from '../src/pages/api/complete-partecipa.js';
import { onRequestPost } from '../functions/api/complete-partecipa.js';

// All handlers are real exports; only external fetch is replaced. Never read runtime credentials.
const handlers = { POST, GET, onRequestPost };
const fields = { email: 'test@example.invalid', telefono: '0000000000', privacy: 'si', idempotency_key: 'local-test-key' };
async function invoke(handler, { existing = null, saved = 123, saveStatus = 200, payload = fields } = {}) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (new URL(url).origin !== 'https://directus.invalid') throw new Error('Unexpected external request');
    return Response.json({ data: options.method === 'GET' ? (existing ? [{ id: existing }] : []) : { id: saved } }, { status: options.method === 'GET' ? 200 : saveStatus });
  };
  try {
    const env = { DIRECTUS_URL: 'https://directus.invalid', DIRECTUS_TOKEN: 'local-test-only' };
    const isGet = handler === GET;
    const request = new Request(`https://site.invalid/api/complete-partecipa${isGet ? `?${new URLSearchParams(payload)}` : ''}`, {
      method: isGet ? 'GET' : 'POST',
      ...(!isGet && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    });
    const response = await handler({ request, locals: { runtime: { env } }, env });
    return { status: response.status, body: await response.json(), calls };
  } finally { globalThis.fetch = originalFetch; }
}

for (const [name, handler] of Object.entries(handlers)) {
  test(`${name}: created record returns canonical transaction ID`, async () => {
    const result = await invoke(handler);
    assert.equal(result.status, 200);
    assert.equal(result.body.richiesta_id, 123);
    assert.equal(result.body.transaction_id, 'richiesta-123');
  });
  test(`${name}: deduplicated record returns the same canonical transaction ID`, async () => {
    const result = await invoke(handler, { existing: 123 });
    assert.deepEqual(result.body, { richiesta_id: 123, transaction_id: 'richiesta-123', deduplicated: true });
    assert.equal(result.calls.length, 1);
  });
  test(`${name}: saving a lead never sends a server analytics request`, async () => {
    const result = await invoke(handler, { payload: { ...fields, gclid: 'local-click' } });
    assert.equal(result.calls.length, 2);
    assert.ok(result.calls.every(call => new URL(call.url).origin === 'https://directus.invalid'));
    assert.equal('ads_fallback_attempted' in result.body, false);
  });
  test(`${name}: malformed saved IDs are not acknowledged as a successful lead`, async () => {
    for (const saved of [null, '', 0, -1, {}, true, 'test@example.invalid']) {
      const result = await invoke(handler, { saved });
      assert.equal(result.status, 502, JSON.stringify(saved));
      assert.equal('transaction_id' in result.body, false);
      assert.equal(result.calls.length, 2);
    }
  });
  test(`${name}: validation and Directus rejection never return tracking IDs`, async () => {
    const invalid = await invoke(handler, { payload: { ...fields, privacy: 'no' } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.calls.length, 0);
    const rejected = await invoke(handler, { saveStatus: 500 });
    assert.equal(rejected.status, 500);
    assert.equal('transaction_id' in rejected.body, false);
    assert.equal(rejected.calls.length, 2);
  });
}
