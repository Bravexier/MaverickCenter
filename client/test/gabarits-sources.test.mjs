// Les gabarits des pages (src/components, src/layouts, src/pages) : leurs commentaires suivent la réponse du propriétaire du 2026-10-22 sur les
// sources (G43 : « Plus de sources ailleurs que dans les archives. On va épurer un peu ce qui est redondant. »), et ils finissent sans ligne vide
// (`git diff --check` : « new blank line at EOF »). Le rendu (aucun titre « Sources » hors de /archives/) : test/site-html.test.mjs.
//   node --test test/gabarits-sources.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const client = fileURLToPath(new URL('..', import.meta.url));
const DOSSIERS = ['src/components', 'src/layouts', 'src/pages'];
const gabarits = DOSSIERS.flatMap((d) => readdirSync(join(client, d), { recursive: true, withFileTypes: true }))
  .filter((e) => e.isFile() && /\.(astro|mjs|ts)$/.test(e.name))
  .map((e) => join(e.parentPath, e.name));

test('les gabarits des pages', () => {
  assert.ok(gabarits.length > 50, `${gabarits.length} gabarits`);
  assert.ok(gabarits.some((f) => f.endsWith(join('guide', 'PageDuPlan.astro'))) && gabarits.some((f) => f.endsWith('PiedDePage.astro')));
});

test('aucun commentaire de gabarit n’annonce encore des sources sous une page (seules les Archives les montrent)', () => {
  // ce que montre le pied d'une page : mots-clés et rétroliens, plus de sources (PageDuPlan.astro le disait encore : « mots-clés, rétroliens, sources »)
  const annonce = /(mots-clés|rétroliens|blocs)\s*,\s*(et\s+)?sources\b/i;
  const fautifs = gabarits.flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((ligne, i) => ({ ligne, n: i + 1 }))
      .filter(({ ligne }) => /^\s*(\/\/|\*|<!--|\{\/\*)/.test(ligne) && annonce.test(ligne))
      .map(({ n }) => `${relative(client, f)}:${n}`),
  );
  assert.deepEqual(fautifs, []);
});

test('aucun gabarit ne finit par une ligne vide (git diff --check)', () => {
  const fautifs = gabarits.filter((f) => /\n[ \t]*\n$/.test(readFileSync(f, 'utf8'))).map((f) => relative(client, f));
  assert.deepEqual(fautifs, []);
});
