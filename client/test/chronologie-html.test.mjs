// Pages /chronologie/ construites (dist/) : une page par événement (le premier à /chronologie/), une frise en haut et une en bas avec un point par
// événement, la page affichée repérée dans chacune, flèches grisées aux bords, extraits et date surlignée, scripts en ligne sans import, entrée du menu
// Codex. Se saute sans dist/ (npm run build) ; la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';
import { adresseDEvenement } from '../src/lib/chronologie.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const present = existsSync(join(dist, 'chronologie', 'index.html'));
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const evenements = present ? chargerChronologie(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : [];
const lire = (e) => readFileSync(join(dist, adresseDEvenement(evenements, e.id), 'index.html'), 'utf8');
const principal = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const frises = (main) => [...main.matchAll(/<nav class="frise frise--(haut|bas)" aria-label="([^"]+)">([\s\S]*?)<\/nav>/g)].map((m) => ({ position: m[1], etiquette: m[2], html: m[3] }));

test('une page par événement : le premier est l’accueil de /chronologie/, les autres à /chronologie/<id>/', options, () => {
  assert.ok(evenements.length > 0);
  assert.ok(!existsSync(join(dist, 'chronologie', evenements[0].id)), 'pas de seconde adresse pour le premier événement');
  const decoder = (t) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  for (const e of evenements) {
    const titre = principal(lire(e)).match(/<h1 id="chrono-titre">([^<]*)<\/h1>/)?.[1];
    assert.equal(titre === undefined ? undefined : decoder(titre), e.titre, `${e.id} : titre`);
  }
});

test('deux frises par page, en haut et en bas : un point par événement, dans l’ordre, la page affichée repérée dans chacune', options, () => {
  const hrefs = evenements.map((e) => `/${adresseDEvenement(evenements, e.id)}`);
  for (const e of evenements) {
    const main = principal(lire(e));
    const [haut, bas] = frises(main);
    assert.deepEqual([haut?.position, bas?.position], ['haut', 'bas'], `${e.id} : une frise en haut, une en bas`);
    assert.notEqual(haut.etiquette, bas.etiquette, 'étiquettes distinctes (lecteurs d’écran)');
    for (const frise of [haut, bas]) {
      const points = [...frise.html.matchAll(/<a class="frise__point[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(points, hrefs, `${e.id} : tous les événements, dans l’ordre`);
      const courants = [...frise.html.matchAll(/<a class="frise__point[^"]*" href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
      assert.deepEqual(courants, [`/${adresseDEvenement(evenements, e.id)}`], `${e.id} : la page affichée, une seule fois`);
    }
    assert.ok(main.indexOf('frise--haut') < main.indexOf('<article class="chrono-page"'), 'la frise du haut avant la page');
    assert.ok(main.indexOf('frise--bas') > main.indexOf('<nav class="chrono-voisins"'), 'la frise du bas après les liens Précédent / Suivant');
  }
});

test('flèches et liens du bas : Précédent et Suivant mènent aux voisins, grisés au premier et au dernier événement', options, () => {
  evenements.forEach((e, i) => {
    const main = principal(lire(e));
    const lien = (sens) => main.match(new RegExp(`<a class="chrono-fleche chrono-fleche--${sens}" href="([^"]+)"`))?.[1] ?? null;
    const attendu = (j) => (evenements[j] ? `/${adresseDEvenement(evenements, evenements[j].id)}` : null);
    assert.equal(lien('precedent'), attendu(i - 1), `${e.id} : précédent`);
    assert.equal(lien('suivant'), attendu(i + 1), `${e.id} : suivant`);
    if (i === 0) assert.match(main, /<span class="chrono-fleche chrono-fleche--precedent" role="link" aria-disabled="true"/);
    if (i === evenements.length - 1) assert.match(main, /<span class="chrono-fleche chrono-fleche--suivant" role="link" aria-disabled="true"/);
  });
});

test('les extraits : un bloc par passage, la date surlignée, un lien vers la page source ; identifiants uniques, chaque bulle existe', options, () => {
  for (const e of evenements) {
    const main = principal(lire(e));
    // un morceau par extrait : de son début à celui du suivant (un extrait peut contenir une citation, donc un <blockquote> imbriqué)
    const blocs = main.split('<blockquote class="chrono-extrait">').slice(1);
    assert.equal(blocs.length, e.extraits.length, `${e.id} : un bloc par extrait`);
    e.extraits.forEach((x, i) => {
      const marques = (blocs[i].match(/<mark class="chrono-surligne">/g) ?? []).length;
      assert.equal(marques, x.date_brut ? 1 : 0, `${e.id}, extrait ${i + 1} : ${x.date_brut ? `date « ${x.date_brut} » surlignée` : 'aucune date'}`);
    });
    for (const page of new Set(e.extraits.map((x) => x.page_id))) assert.ok(main.includes(`<a href="/${page}/">`), `${e.id} : lien vers ${page}`);
    const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${e.id} : identifiants uniques`);
    const connus = new Set(ids);
    for (const [, cible] of main.matchAll(/data-bulle="([^"]+)"/g)) assert.ok(connus.has(cible), `${e.id} : bulle ${cible}`);
    assert.ok(!main.includes('\uE000') && !main.includes('\uE001'), `${e.id} : aucun marqueur de date oublié`);
  }
});

test('scripts en ligne sans import (version portable) ; le menu Codex mène à la chronologie', options, () => {
  const html = readFileSync(join(dist, 'chronologie', 'index.html'), 'utf8');
  for (const [, code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.ok(!/(^|[;}\n])\s*import[\s{*"']|\bimport\(/.test(code), 'script de page sans import');
  assert.match(html, /<a href="\/chronologie\/" aria-current="page">Chronologie<\/a>/);
  assert.match(html, /html \{ overscroll-behavior-x: none; \}/, 'le glissement du doigt ne fait pas un retour dans l’historique');
});
