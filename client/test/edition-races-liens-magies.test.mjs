// Les magies innées d'une page de race, redessinées par le mode modification (src/scripts/edition/races.mjs) après une modification, gardent le lien de leur
// mot-clé du glossaire (migration 0125) : le même HTML que la page construite (components/race/RacePage.astro : `htmlDeLaMagie(liens, id, nom)`), avec les
// `liens` de `ed.listes` (serveur/edition.mjs#listes) ; sans `liens`, le nom nu. L'extension tourne dans un faux navigateur, avec les listes du vrai service ;
// les liens se lisent par la base (lib/mots-cles-des-valeurs.mjs), jamais par un nom ni une clé supposés.
//   node --test test/edition-races-liens-magies.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listes } from '../serveur/edition.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { lienDeLaMagie, liensDesValeursFermees } from '../src/lib/mots-cles-des-valeurs.mjs';
import { baliseDeLaValeur, htmlDeLaMagie } from '../src/lib/valeurs-fermees-rendu.mjs';
import { races } from '../src/scripts/edition/races.mjs';
import { el, fauxDocument } from './aide-faux-dom.mjs';

const db = ouvrirBase({ sansExemples: false });
const contexte = listes(db);
const liens = liensDesValeursFermees(db);
const magies = contexte.magies;
const liees = magies.filter((m) => lienDeLaMagie(liens, m.id));

/** La section des magies innées d'une race après une modification (`surcouche`), avec `ids` pour magies innées de la page ; rend son HTML. */
async function surcouche(ids, listes) {
  const section = el('div', { 'data-ed-magies-innees': 'race-essai' });
  globalThis.document = fauxDocument(section);
  globalThis.document.body.append(section);
  const ed = {
    base: '/',
    listes,
    appel: async () => ({ magiesInnees: { ids, source: 'matrice' }, relations: { regards: [] }, races: [], peuples: [] }),
  };
  await races.surcouche(ed, [{ table: 'race_magie', cle: {} }]);
  return section.innerHTML;
}

test('la base a des magies liées à leur mot-clé (garde-fou du test)', () => {
  assert.ok(liees.length >= 1, 'au moins une magie liée');
});

test('une magie innée redessinée garde la balise de son mot-clé, comme la page construite ; une magie sans mot-clé reste nue', async () => {
  const html = await surcouche(magies.map((m) => m.id), contexte);
  for (const m of magies) {
    const attendu = htmlDeLaMagie(liens, m.id, m.nom);
    assert.ok(html.includes(attendu), `${m.id} : ${attendu}`);
    if (lienDeLaMagie(liens, m.id)) assert.ok(attendu.startsWith('{{') && attendu.endsWith('}}'), `${m.id} : une balise`);
    else assert.ok(!attendu.includes('{{'), `${m.id} : le nom nu`);
  }
  assert.equal([...html.matchAll(/\{\{/g)].length, liees.length, 'une balise par magie liée');
});

test('les magies innées non disponibles sont liées de même', async () => {
  const html = await surcouche([], contexte);
  assert.ok(html.includes('<details>'), 'la liste des non disponibles');
  for (const m of liees) assert.ok(html.includes(baliseDeLaValeur(lienDeLaMagie(liens, m.id), m.nom)), m.id);
});

test('sans `liens` dans les listes, le nom nu (aucune balise devinée)', async () => {
  const html = await surcouche(magies.map((m) => m.id), { ...contexte, liens: undefined });
  assert.ok(!html.includes('{{'), 'aucune balise');
  for (const m of magies) assert.ok(html.includes(m.nom.replace(/&/g, '&amp;')), m.id);
});
