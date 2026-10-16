// Page /ressources/objets-a-la-ceinture/ construite (dist/) : rendue depuis la base (lib/ceinture-db.mjs, vue v_objet_ceinture : décisions R81 et R82),
// un tableau repliable par famille dans l'ordre, une ligne par objet, des liens qui mènent à des pages et des ancres qui existent (dont l'onglet
// « Bâtons magiques » de la page « Équipement », où sont les bâtons), les monnaies en icônes (R63), les règles de la ceinture, l'entrée du menu Ressources. Se saute sans dist/ (npm run build) ;
// la CI le lance après le build.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FAMILLES_DE_LA_CEINTURE, chargerObjetsDeCeinture } from '../src/lib/ceinture-db.mjs';
import { ancreDObjet } from '../src/lib/ceinture-rendu.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fichier = join(dist, 'ressources', 'objets-a-la-ceinture', 'index.html');
const present = existsSync(fichier);
const options = present ? {} : { skip: 'site non construit (npm run build)' };
const html = present ? readFileSync(fichier, 'utf8') : '';
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
const objets = present ? chargerObjetsDeCeinture(ouvrirBase({ sansExemples: process.env.HIDE_EXAMPLES === '1' })) : null;
const tableau = (famille) => objets.tableaux.find((t) => t.famille === famille);

test('les tableaux, dans l’ordre : fioles, philtres, remèdes, alchimie primitive, huiles, carquois et sacs ; pas de bâtons magiques (« Équipement »)', options, () => {
  const ids = [...main.matchAll(/<details class="ceint-tableau" id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, FAMILLES_DE_LA_CEINTURE.map((f) => `objets-${f.famille}`));
  assert.match(html, /href="[^"]*ressources\/objets-a-la-ceinture\/"[^>]*>Objets à la ceinture</, 'l’entrée du menu Ressources');
  assert.ok(!html.includes('data-edition'), 'pas encore modifiable sur le site de dev');
  assert.ok(!main.includes('id="objets-baton"') && !main.includes('class="ceint-magie"'), 'le tableau des bâtons est dans l’onglet de la page « Équipement »');
});

test('une ligne par objet de la vue (sauf les bâtons), aux ancres uniques ; le compte de chaque tableau', options, () => {
  const lignes = [...main.matchAll(/<tr class="ceint-ligne" id="([^"]+)"/g)].map((m) => m[1]);
  const attendues = [
    ...objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages.flatMap((p) => p.potions.map((x) => ancreDObjet(x.id)))),
    ...tableau('contenant').objets.map((r) => ancreDObjet(r.id)),
  ];
  assert.deepEqual(lignes, attendues);
  assert.equal(new Set(lignes).size, lignes.length, 'ancres uniques');
  for (const t of objets.tableaux) {
    const bloc = main.slice(main.indexOf(`id="objets-${t.famille}"`));
    assert.match(bloc, new RegExp(`data-compte>${t.nombre}<`), `${t.famille} : ${t.nombre} objets`);
  }
  assert.match(main, new RegExp(`data-ceinture-compte aria-live="polite">${objets.tableaux.reduce((n, t) => n + t.nombre, 0)} objets<`));
});

test('les liens mènent à des pages construites et à des ancres qui existent (potions, Composants, Équipement, guide)', options, () => {
  const liens = [...new Set([...main.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
  assert.ok(liens.length > 50);
  const pages = new Map();
  for (const lien of liens) {
    const [chemin, ancre] = lien.split('#');
    const page = join(dist, decodeURI(chemin), 'index.html');
    assert.ok(existsSync(page), `page absente : ${lien}`);
    if (ancre) {
      if (!pages.has(page)) pages.set(page, readFileSync(page, 'utf8'));
      assert.ok(pages.get(page).includes(`id="${ancre}"`), `ancre absente : ${lien}`);
    }
  }
  for (const p of objets.tableaux.filter((t) => t.pages).flatMap((t) => t.pages)) assert.ok(liens.includes(`/${p.id}/`), `la page ${p.id}`);
  assert.ok(liens.includes('/guide/l-equipement/') && liens.includes('/guide/fiche-accessoires-et-ceinture/'), 'les pages du guide');
  assert.ok(liens.includes('/ressources/equipement/#batons-magiques'), 'l’onglet des bâtons magiques');
  assert.ok(liens.includes('/ressources/equipement/#famille-bombes'), 'les bombes, dans l’onglet Armes');
});

test('les prix et les textes écrivent les monnaies en icônes, jamais en abréviations (R63)', options, () => {
  const tableaux = main.slice(main.indexOf('class="ceinture-tableaux"'));
  const texte = tableaux.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(texte, /\b\d[\d\s,.]*\s*(?:R[oOfF]|PP)\b/, 'pas de « 2 Ro » écrit');
  assert.ok((tableaux.match(/class="piece piece--/g) ?? []).length >= objets.tableaux.filter((t) => t.pages).reduce((n, t) => n + t.nombre, 0), 'un prix par potion');
});

test('les règles : la ceinture (guide, et le texte de la source en dépliable) ; les titres des pages', options, () => {
  // les textes se modifient sur le site de dev (lib/ceinture-db.mjs les lit dans la base, ceinture-db.test.mjs les compare) : ici, leur place
  const regles = main.slice(main.indexOf('class="ceinture-regles"'), main.indexOf('class="ceinture-sommaire"'));
  assert.equal(regles.includes('class="prose ceinture-regles__texte"'), Boolean(objets.regles.ceinture));
  assert.equal(/<details class="ceinture-regles__detail">[\s\S]*<\/details>/.test(regles), Boolean(objets.regles.reference), 'le texte de la source, en dépliable');
  for (const s of [objets.sources.chapitre, objets.sources.reference]) if (s) assert.ok(regles.includes(`>${s.titre.replace(/'/g, '&#39;')}</a>`) || regles.includes(`>${s.titre}</a>`), s.id);
});

test('les tableaux d’un groupe sont dans sa <section> (« Potions »), les autres hors de toute section', options, () => {
  const sections = [...main.matchAll(/<section class="ceinture-bloc" data-ceinture-groupe aria-labelledby="([^"]+)">([\s\S]*?)<\/section>/g)];
  const groupes = [...new Set(FAMILLES_DE_LA_CEINTURE.map((f) => f.groupe).filter(Boolean))];
  assert.equal(sections.length, groupes.length);
  for (const [, titre, contenu] of sections) {
    assert.ok(main.includes(`<h2 class="ceinture-groupe" id="${titre}">`), titre);
    const ids = [...contenu.matchAll(/<details class="ceint-tableau" id="([^"]+)"/g)].map((m) => m[1]);
    const groupe = groupes.find((g) => contenu.includes(`>${g}</h2>`));
    assert.deepEqual(ids, FAMILLES_DE_LA_CEINTURE.filter((f) => f.groupe === groupe).map((f) => `objets-${f.famille}`));
  }
  assert.equal((main.match(/<tbody[^>]*data-ceinture-corps/g) ?? []).length, objets.tableaux.reduce((n, t) => n + (t.pages ? t.pages.length : 1), 0),
    'un <tbody> filtré par groupe de potions, un par autre tableau');
});
