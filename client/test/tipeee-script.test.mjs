// Le script de Bienvenue qui reprend la partie « Bienvenue » de Tipeee (src/scripts/tipeee.mjs ; réponses du propriétaire du 2026-10-22 : « autant en
// faire un hook pour que ça reprenne directement le texte au cas où il change sur Tipee », « La partie « Bienvenue » », « En direct par le serveur »),
// exécuté dans un faux navigateur : la page construite montre l'instantané ; le texte du service (GET /api/tipeee/) le remplace s'il diffère, en texte
// seul (jamais de HTML) ; une réponse vide, mal formée, hors des bornes, une erreur ou un service absent laissent l'instantané.
//   node --test test/tipeee-script.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CARACTERES_MAX, CHEMIN_INSTANTANE, PARAGRAPHES_MAX } from '../src/lib/tipeee.mjs';
import { attendre, el, fauxDocument } from './aide-faux-dom.mjs';

const INSTANTANE = JSON.parse(readFileSync(new URL(`../../${CHEMIN_INSTANTANE}`, import.meta.url), 'utf8'));

let numero = 0;
/** La citation telle que components/guide/SousBienvenue.astro l'écrit (les paragraphes de l'instantané), le script chargé à neuf ; `repondre` : le faux service. */
async function monter(repondre) {
  const citation = el('blockquote', { class: 'bienvenue-tipeee', 'data-tipeee': '', 'data-tipeee-api': '/api/tipeee/', 'data-tipeee-lu-le': INSTANTANE.lu_le },
    ...INSTANTANE.paragraphes.map((p) => el('p', {}, p)));
  const appels = [];
  Object.assign(globalThis, {
    document: fauxDocument(el('main', {}, citation)),
    fetch: async (url, options) => {
      appels.push([url, options]);
      return repondre(url);
    },
  });
  await import(`../src/scripts/tipeee.mjs?page=${(numero += 1)}`);
  for (let i = 0; i < 5; i += 1) await attendre();
  return { citation, appels, paragraphes: () => [...citation.querySelectorAll('p')].map((p) => p.textContent) };
}
const reponse = (corps, statut = 200) => ({ ok: statut < 400, status: statut, json: async () => (typeof corps === 'function' ? corps() : corps) });

test('le texte du service remplace l’instantané quand il diffère, en texte seul (un « < » reste un caractère)', async () => {
  const nouveaux = ['Bienvenue sur le Tipeee de MaverickJDR !', 'Un texte <b>changé</b> sur Tipeee.\nSur deux lignes.'];
  const page = await monter(() => reponse({ paragraphes: nouveaux, lu_le: '2026-10-23T08:00:00Z', origine: 'tipeee' }));
  assert.deepEqual(page.appels.map(([url]) => url), ['/api/tipeee/']);
  assert.deepEqual(page.paragraphes(), nouveaux);
  assert.equal(page.citation.querySelectorAll('b').length, 0, 'jamais de HTML de Tipeee');
  assert.match(page.citation.innerHTML, /Un texte &lt;b&gt;changé&lt;\/b&gt;/);
  assert.equal(page.citation.dataset.tipeeeLuLe, '2026-10-23T08:00:00Z');
});

test('le même texte : rien ne change (la page garde ses éléments)', async () => {
  const page = await monter(() => reponse({ paragraphes: INSTANTANE.paragraphes, lu_le: '2026-10-23T08:00:00Z', origine: 'tipeee' }));
  assert.deepEqual(page.paragraphes(), INSTANTANE.paragraphes);
  assert.equal(page.citation.dataset.tipeeeLuLe, INSTANTANE.lu_le);
});

test('sans texte valable du service, l’instantané reste', async () => {
  const trop = Array.from({ length: PARAGRAPHES_MAX + 1 }, (_, i) => `paragraphe ${i}`);
  const cas = [
    ['aucun texte connu du service', () => reponse({ paragraphes: [], lu_le: null, origine: 'repli' })],
    ['réponse sans paragraphes', () => reponse({ erreur: 'x' })],
    ['un paragraphe qui n’est pas un texte', () => reponse({ paragraphes: ['a', 3] })],
    ['un paragraphe vide', () => reponse({ paragraphes: ['a', '  '] })],
    ['trop de paragraphes', () => reponse({ paragraphes: trop })],
    ['texte trop long', () => reponse({ paragraphes: ['x'.repeat(CARACTERES_MAX + 1)] })],
    ['service en erreur (503)', () => reponse({ erreur: 'indisponible' }, 503)],
    ['réponse illisible', () => reponse(() => { throw new SyntaxError('JSON'); })],
    ['service absent', () => { throw new TypeError('fetch failed'); }],
  ];
  for (const [nom, repondre] of cas) {
    const page = await monter(repondre);
    assert.deepEqual(page.paragraphes(), INSTANTANE.paragraphes, nom);
  }
});

test('sans citation de Tipeee dans la page, aucune requête', async () => {
  const appels = [];
  Object.assign(globalThis, { document: fauxDocument(el('main', {})), fetch: async (...a) => (appels.push(a), reponse({})) });
  await import(`../src/scripts/tipeee.mjs?page=${(numero += 1)}`);
  await attendre();
  assert.deepEqual(appels, []);
});
