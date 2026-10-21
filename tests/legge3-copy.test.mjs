import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/legge-3.astro', import.meta.url), 'utf8');
const form = readFileSync(new URL('../src/components/PartecipaForm.astro', import.meta.url), 'utf8');

test('Legge 3 promotes a preliminary eligibility assessment without guaranteed outcomes', () => {
  assert.match(page, /Verifica i requisiti per le procedure di sovraindebitamento/);
  assert.match(page, /Controllo Cartelle Esattoriali/);
  assert.doesNotMatch(page, /Comincia da zero senza pensieri|niente piu problemi|Salva la tua casa|Cancella il tuo sovraindebitamento/);
  assert.doesNotMatch(page, /<PageContent\b/);
  assert.match(form, /La richiesta non garantisce/);
});
