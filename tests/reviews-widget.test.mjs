import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/components/google_reviews_block.astro', import.meta.url), 'utf8');

test('review block embeds the supplied SociableKIT widget instead of Google Places', () => {
  assert.match(component, /class="sk-ww-google-reviews"\s+data-embed-id="25722287"/);
  assert.match(component, /<script\b[^>]*src="https:\/\/widgets\.sociablekit\.com\/google-reviews\/widget\.js"[^>]*\bdefer\b[^>]*><\/script>/);
  assert.doesNotMatch(component, /maps\.googleapis\.com|GOOGLE_MAPS_API_KEY|fallbackReviews|Cliente verificato/);
});
