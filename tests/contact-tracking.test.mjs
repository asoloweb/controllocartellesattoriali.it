import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Execute the actual inline component script with browser/network boundaries
// replaced by local test doubles. No requests or analytics events leave Node.
const component = readFileSync(new URL('../src/components/PartecipaForm.astro', import.meta.url), 'utf8');
const script = component.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Contact component must contain its client script');

function setup({ responseOk = true, networkError = false, search = '', fields = {} } = {}) {
  const googleEvents = [];
  const umamiEvents = [];
  const requests = [];
  const storage = new Map();
  class HTMLElement { constructor() { this.dataset = {}; this.listeners = {}; } }
  class HTMLAnchorElement extends HTMLElement {
    href = 'https://wa.me/393517444368';
    addEventListener(type, callback) { this.listeners[type] = callback; }
  }
  class HTMLButtonElement extends HTMLElement { disabled = false; }
  const status = new HTMLElement();
  const button = new HTMLButtonElement();
  class HTMLFormElement extends HTMLElement {
    fields = { email: 'test@example.invalid', telefono: '0000000000', privacy: 'on', ...fields };
    resets = 0;
    querySelector(selector) { return selector === '.contact_form_status' ? status : button; }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    reset() { this.resets += 1; }
  }
  const form = new HTMLFormElement();
  const whatsapp = new HTMLAnchorElement();
  const context = vm.createContext({
    window: {
      location: { pathname: '/legge-3', search },
      gtag: (...args) => googleEvents.push(args),
      umami: { track: (...args) => umamiEvents.push(args) },
    },
    document: {
      querySelector: () => form,
      querySelectorAll: (selector) => selector === '.contact_form_whatsapp' ? [whatsapp] : [],
    },
    HTMLElement, HTMLFormElement, HTMLAnchorElement, HTMLButtonElement,
    FormData: class { constructor(element) { this.fields = element.fields; } get(key) { return this.fields[key]; } },
    URLSearchParams, Intl, Date,
    crypto: { randomUUID: () => 'test-request-id' },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      if (networkError) throw new Error('Test network failure');
      return { ok: responseOk, status: responseOk ? 200 : 500, json: async () => ({ error: 'Test server failure' }) };
    },
    console: { error() {} },
    setInterval() {},
  });
  vm.runInContext(script, context, { filename: 'PartecipaForm.client.js' });
  return { googleEvents, umamiEvents, requests, storage, status, form, whatsapp, context,
    submit: () => form.listeners.submit({ preventDefault() {} }),
    clickWhatsapp: () => whatsapp.listeners.click(),
  };
}

const conversions = (env) => env.googleEvents.filter((event) => event[1] === 'conversion');

test('WhatsApp records a separate click event, never a form conversion', () => {
  const env = setup();
  env.clickWhatsapp();
  assert.equal(conversions(env).length, 0, 'A WhatsApp click must not be counted as a submitted form');
  assert.equal(env.googleEvents.filter((event) => event[1] === 'click_to_whatsapp').length, 1);
  assert.equal(env.googleEvents.filter((event) => event[1] === 'generate_lead').length, 0);
  assert.equal(env.umamiEvents[0][0], 'whatsapp_verifica_subito_click');
  assert.equal(env.requests.length, 0);
});

test('Successful form submission records exactly one Ads form conversion', async () => {
  const env = setup({ search: '?gclid=test-click-id' });
  await env.submit();
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].payload.gclid, 'test-click-id');
  assert.equal(conversions(env).length, 1);
  assert.equal(conversions(env)[0][2].send_to, 'AW-10932709528/eZrDCM_fkKkcEJjRj90o');
  assert.equal(env.googleEvents.filter((event) => event[1] === 'generate_lead').length, 1);
  assert.equal(env.status.dataset.state, 'success');
});

test('Server rejection does not record a lead or a form conversion', async () => {
  const env = setup({ responseOk: false });
  await env.submit();
  assert.equal(env.requests.length, 1);
  assert.equal(env.googleEvents.length, 0);
  assert.equal(env.status.dataset.state, 'error');
  assert.equal(env.form.resets, 0);
});

test('Network failure does not record a lead or a form conversion', async () => {
  const env = setup({ networkError: true });
  await env.submit();
  assert.equal(env.googleEvents.length, 0);
  assert.equal(env.status.dataset.state, 'error');
});

test('Invalid form does not send a request or record a conversion', async () => {
  const env = setup({ fields: { privacy: '' } });
  await env.submit();
  assert.equal(env.requests.length, 0);
  assert.equal(env.googleEvents.length, 0);
  assert.equal(env.status.dataset.state, 'error');
});

test('Immediate repeated submission does not duplicate conversions', async () => {
  const env = setup();
  await env.submit();
  await env.submit();
  assert.equal(env.requests.length, 1);
  assert.equal(conversions(env).length, 1);
});

test('Form forwards advertising identifiers preserved in session storage', async () => {
  const env = setup();
  for (const key of ['gclid', 'gbraid', 'wbraid']) env.storage.set(`attribution_${key}`, `test-${key}`);
  await env.submit();
  for (const key of ['gclid', 'gbraid', 'wbraid']) assert.equal(env.requests[0].payload[key], `test-${key}`);
});

test('Form without advertising identifiers still completes normally', async () => {
  const env = setup();
  await env.submit();
  assert.equal(env.requests[0].payload.gclid, '');
  assert.equal(env.status.dataset.state, 'success');
  assert.equal(conversions(env).length, 1);
});

test('WhatsApp still works when the Google tag is unavailable', () => {
  const env = setup();
  delete env.context.window.gtag;
  assert.doesNotThrow(() => env.clickWhatsapp());
  assert.equal(env.umamiEvents[0][0], 'whatsapp_verifica_subito_click');
});
