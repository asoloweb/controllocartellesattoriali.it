import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/PartecipaForm.astro', import.meta.url), 'utf8');

test('Legge 3 form replaces its introduction with a three-point benefits checklist', () => {
  assert.match(source, /const isLeggeTrePage = Astro\.url\.pathname\.replace\(/);
  assert.match(source, /isLeggeTrePage \? \(/);
  assert.match(source, /Perché contattarci\?/);
  const checklist = source.match(/<ul class="contact_form_benefits_list">([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(checklist, 'Benefits must be a semantic list');
  assert.equal((checklist.match(/<li>/g) || []).length, 3);
  for (const text of ['Valutazione del tuo caso', 'Incontro gratuito con l’avvocato dedicato alla tua posizione', 'Proposte per risolvere la tua situazione']) {
    assert.ok(checklist.includes(text), `Missing checklist item: ${text}`);
  }
  assert.match(source, /:\s*\(\s*<p class="contact_form_intro">/);
});
