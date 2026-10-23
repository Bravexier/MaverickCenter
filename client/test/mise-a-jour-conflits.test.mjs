// Les lignes en conflit sur la page « Mise à jour » du site de dev (src/scripts/mise-a-jour.mjs, rendu lib/conflits-rendu.mjs ; demande du propriétaire
// du 2026-10-22 : « Après les listes de modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le
// choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les deux. »), le script exécuté dans un faux navigateur contre un faux service : la section
// après les listes (la raison du rejeu de chaque lot en texte lisible), le choix d'un conflit (le 3 ouvre sa saisie), l'envoi refusé tant qu'un
// choix manque, le corps envoyé, le message après l'envoi, un diagnostic changé entre-temps (409 : le lot à jour reposé), un nouveau rendu de la
// note qui garde les choix en cours, et rien sans lot en conflit.
// Le diagnostic : test/fixtures/conflits-diagnostic.json (test/conflits-rendu.test.mjs).
//   node --test test/mise-a-jour-conflits.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { attendre, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const DIAG = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic.json', import.meta.url), 'utf8'));
const FORGERON = DIAG.lots.find((l) => l.resume === 'Métier Forgeron : Bonus');
const HYPER = DIAG.lots.find((l) => l.resume.startsWith('Page Le Mode Hyper'));

const NOTE = { version_cible: '0.4', reference: { disponible: true, version: '0.3.70' }, lignes: [], brouillon: { texte: '' }, lancement: null, occupe: false, liberable: false, confirmation: 'MAJ' };

/** Un évènement `type` venu de `cible`, qui remonte jusqu'à `ecoute` (la section : délégation). */
function evenement(type, cible, ecoute) {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'target', { value: cible });
  ecoute.dispatchEvent(e);
  return e;
}
const fini = async () => {
  for (let i = 0; i < 8; i += 1) await attendre();
};

let numero = 0;
/** La page construite (la note de production), le faux service (`routes` : « METHODE chemin » → réponse, ou fonction du corps), le script chargé. */
async function monter(routes) {
  const racine = el('div', { class: 'mise-a-jour', 'data-mise-a-jour': '', 'data-api': '/api/', 'data-maintenance': '/maintenance/' },
    el('section', { class: 'nv-dev', 'data-nv-dev': '', hidden: '' }), el('section', { class: 'nv-production', 'data-nv-production': '' }));
  const envois = [];
  Object.assign(globalThis, {
    document: fauxDocument(el('main', {}, racine)),
    Element,
    alert: () => {},
    fetch: async (url, options = {}) => {
      const cle = `${options.method ?? 'GET'} ${url.replace('/api/', '')}`;
      const corps = options.body ? JSON.parse(options.body) : undefined;
      envois.push([cle, corps]);
      let r = routes[cle];
      if (typeof r === 'function') r = r(corps);
      if (!r) return { ok: false, status: 404, json: async () => ({ erreur: 'inconnue' }) };
      const [statut, contenu] = Array.isArray(r) ? r : [200, r];
      return { ok: statut < 400, status: statut, json: async () => contenu };
    },
  });
  await import(`../src/scripts/mise-a-jour.mjs?page=${(numero += 1)}`);
  await fini();
  const section = () => racine.querySelector('[data-nv-conflits]');
  const lot = (id) => [...section().querySelectorAll('[data-nv-lot]')].find((f) => f.dataset.nvLot === id);
  const conflit = (form, id) => [...form.querySelectorAll('[data-nv-conflit]')].find((f) => f.dataset.nvConflit === id);
  const choisir = (fieldset, n) => {
    const radio = [...fieldset.querySelectorAll('[data-nv-choix]')].find((r) => r.getAttribute('value') === String(n));
    radio.checked = true;
    evenement('change', radio, section());
  };
  return { racine, envois, section, lot, conflit, choisir, envoyer: (form) => evenement('submit', form, section()) };
}

const routesDeBase = (extra = {}) => ({
  'GET etat/': { edition: true },
  'GET mise-a-jour/': { ...NOTE, en_conflit: { lots: DIAG.lots.length, modifications: 6 } },
  'GET mise-a-jour/conflits/': DIAG,
  ...extra,
});

test('après les listes de la note en préparation, la section des lignes en conflit ; le bilan les annonce', async () => {
  const page = await monter(routesDeBase());
  const dev = page.racine.querySelector('[data-nv-dev]');
  assert.equal(dev.hidden, false);
  const s = page.section();
  assert.ok(s && !s.hidden, 'la section');
  assert.equal(s.parentElement, dev, 'dans la note en préparation');
  assert.equal(dev.children.at(-1), s, 'après les listes');
  assert.ok(dev.children.indexOf(dev.querySelector('.nv-dev__liste')) < dev.children.indexOf(s));
  assert.match(dev.querySelector('.nv-dev__bilan').textContent, /6 lots en conflit ne partent pas avec cette mise à jour/);
  assert.equal(s.querySelectorAll('[data-nv-lot]').length, 6);
  assert.deepEqual(page.envois.map(([c]) => c), ['GET etat/', 'GET mise-a-jour/', 'GET mise-a-jour/conflits/']);
  // la raison du rejeu : le texte lisible du service (comme la légende), jamais la trace (id du lot, clé JSON, nom de colonne)
  assert.equal(page.lot(FORGERON.lot).querySelector('.nv-conflit-lot__detail').textContent, 'Au rejeu : Métier « Forgeron » : les règles ont changé « Bonus » autrement');
  for (const l of DIAG.lots) assert.doesNotMatch(page.lot(l.lot).querySelector('.nv-conflit-lot__detail').textContent, /^Au rejeu : lot |bonus_brut|corps_md/, l.lot);
  // la légende et la raison de chaque conflit, les saines : les textes lisibles du service (sans JSON, sans nom de colonne qui a un libellé)
  for (const l of DIAG.lots) {
    const form = page.lot(l.lot);
    for (const c of l.conflits) {
      const f = page.conflit(form, c.id);
      assert.ok(f.querySelector('legend').textContent.startsWith(c.libelle), `${l.lot} ${c.id}`);
      assert.doesNotMatch(f.querySelector('legend').textContent, /[{}"]/, `${l.lot} ${c.id} : légende sans JSON`);
      assert.equal(f.querySelector('.nv-conflit__raison').textContent, c.raison_lisible, `${l.lot} ${c.id} : la raison lisible`);
      assert.doesNotMatch(f.querySelector('.nv-conflit__raison').textContent, /bonus_brut|corps_md|page_id = /, `${l.lot} ${c.id}`);
    }
    const saines = form.querySelector('.nv-conflit-lot__saines').textContent;
    assert.doesNotMatch(saines, /[{}"]/, `${l.lot} : saines sans JSON`);
  }
  assert.equal(page.conflit(page.lot(FORGERON.lot), '1:bonus_brut').querySelector('.nv-conflit__raison').textContent, 'les règles ont changé « Bonus » autrement');
  assert.match(s.textContent, /Capacité de la carte « Amblypyge de brai », n° 1/);
  assert.doesNotMatch(s.textContent, /\{"/, 'aucun JSON dans la section');
});

test('le choix 3 ouvre sa saisie ; l’envoi attend un choix par conflit, puis part avec la valeur saisie ; le message dit ce qui est fait', async () => {
  let reste = DIAG.lots;
  const page = await monter(routesDeBase({
    'GET mise-a-jour/': () => ({ ...NOTE, en_conflit: { lots: reste.length, modifications: reste.length } }),
    'GET mise-a-jour/conflits/': () => ({ lots: reste, resolus: [] }),
    'POST mise-a-jour/conflits/': (corps) => {
      reste = reste.filter((l) => l.lot !== corps.lot);
      return { lot: corps.lot, nouveau_lot: 'L-NOUVEAU', modifications: 4, lignes: [], fiches: [], resolution: [] };
    },
  }));
  const form = page.lot(FORGERON.lot);
  const c = FORGERON.conflits[0];
  const fieldset = page.conflit(form, c.id);
  // sans choix : rien ne part, le message dit lequel manque
  page.envoyer(form);
  await fini();
  assert.equal(page.envois.filter(([k]) => k.startsWith('POST')).length, 0);
  assert.match(form.querySelector('[data-nv-lot-message]').textContent, /il manque : Métier « Forgeron » — Bonus/);
  // le 3 : la saisie s'ouvre ; le 2 la referme
  const saisie = fieldset.querySelector('[data-nv-saisie]');
  assert.equal(saisie.hidden, true);
  page.choisir(fieldset, 3);
  assert.equal(saisie.hidden, false);
  page.choisir(fieldset, 2);
  assert.equal(saisie.hidden, true);
  page.choisir(fieldset, 3);
  const champ = fieldset.querySelector('[data-nv-valeur]');
  champ.value = '+4% Parade';
  evenement('input', champ, page.section());
  page.envoyer(form);
  await fini();
  const [, corps] = page.envois.find(([k]) => k === 'POST mise-a-jour/conflits/');
  assert.deepEqual(corps, { lot: FORGERON.lot, empreinte: FORGERON.empreinte, choix: { [c.id]: { choix: 3, valeur: '+4% Parade' } } });
  // le message, puis tout est relu : la note (qui compte la nouvelle modification) et les conflits (le lot résolu n'y est plus)
  assert.match(page.section().querySelector('.nv-conflits__message').textContent, /^Conflit résolu : une nouvelle modification du site de dev a été enregistrée \(4 lignes ; lot L-NOUVEAU\)/);
  assert.equal(page.lot(FORGERON.lot), undefined);
  assert.equal(page.section().querySelectorAll('[data-nv-lot]').length, 5);
});

test('une page retirée : seul le 2 se choisit ; un choix impossible envoyé ne compte pas', async () => {
  const page = await monter(routesDeBase({ 'POST mise-a-jour/conflits/': { lot: HYPER.lot, nouveau_lot: null, modifications: 0, lignes: [], fiches: [], resolution: [] } }));
  const form = page.lot(HYPER.lot);
  const fieldset = page.conflit(form, HYPER.conflits[0].id);
  assert.deepEqual([...fieldset.querySelectorAll('[data-nv-choix]')].map((r) => [r.getAttribute('value'), r.hasAttribute('disabled')]), [['1', true], ['2', false], ['3', true]]);
  page.choisir(fieldset, 2);
  page.envoyer(form);
  await fini();
  assert.deepEqual(page.envois.find(([k]) => k.startsWith('POST'))[1].choix, { 1: { choix: 2 } });
  assert.match(page.section().querySelector('.nv-conflits__message').textContent, /rien n’a été écrit \(tout au choix 2\)/);
});

test('une saisie refusée par les contrôles de l’éditeur ne part pas ; le message est sous le conflit', async () => {
  const page = await monter(routesDeBase());
  const magie = DIAG.lots.find((l) => l.resume.startsWith('Page La magie en jeu'));
  const form = page.lot(magie.lot);
  const fieldset = page.conflit(form, magie.conflits[0].id);
  page.choisir(fieldset, 3);
  fieldset.querySelector('[data-nv-valeur]').value = '   ';
  page.envoyer(form);
  await fini();
  assert.equal(page.envois.filter(([k]) => k.startsWith('POST')).length, 0);
  const erreur = fieldset.querySelector('[data-nv-erreur]');
  assert.equal(erreur.hidden, false);
  assert.equal(erreur.textContent, '« Texte » : valeur obligatoire');
});

test('409 : le diagnostic a changé entre-temps, le lot à jour est reposé avec le message ; les choix qui y valent restent', async () => {
  const neuf = { ...FORGERON, empreinte: 'neuve', conflits: FORGERON.conflits.map((c) => ({ ...c, version_2: { genre: 'valeur', valeur: '+6% Parade' } })) };
  const page = await monter(routesDeBase({
    'POST mise-a-jour/conflits/': [409, { erreur: 'Les conflits de ce lot ont changé depuis leur affichage : relisez-les.', lot: neuf }],
  }));
  const fieldset = page.conflit(page.lot(FORGERON.lot), FORGERON.conflits[0].id);
  page.choisir(fieldset, 1);
  page.envoyer(page.lot(FORGERON.lot));
  await fini();
  const form = page.lot(FORGERON.lot);
  assert.equal(form.dataset.nvEmpreinte, 'neuve');
  assert.match(form.querySelector('[data-nv-lot-message]').textContent, /ont changé depuis leur affichage : relisez-les\. Les conflits affichés sont à jour\./);
  assert.match(form.textContent, /\+6% Parade/);
  const radio = [...page.conflit(form, FORGERON.conflits[0].id).querySelectorAll('[data-nv-choix]')].find((r) => r.getAttribute('value') === '1');
  assert.equal(radio.checked, true, 'le choix 1 reste');
});

test('un nouveau rendu de la note (suivi d’un lancement) garde la section et ses choix en cours', async () => {
  const page = await monter(routesDeBase());
  const s = page.section();
  const fieldset = page.conflit(page.lot(FORGERON.lot), FORGERON.conflits[0].id);
  page.choisir(fieldset, 3);
  const champ = fieldset.querySelector('[data-nv-valeur]');
  champ.value = 'saisi';
  evenement('input', champ, s);
  // « Voir la page de production » cache la section, la décocher la remet
  const bascule = page.racine.querySelector('[data-nv-voir-prod]');
  bascule.checked = true;
  evenement('change', bascule, bascule);
  assert.equal(s.hidden, true);
  bascule.checked = false;
  evenement('change', bascule, bascule);
  assert.equal(s.hidden, false);
  const apres = page.conflit(page.lot(FORGERON.lot), FORGERON.conflits[0].id);
  assert.equal([...apres.querySelectorAll('[data-nv-choix]')].find((r) => r.getAttribute('value') === '3').checked, true);
  assert.equal(apres.querySelector('[data-nv-saisie]').hidden, false);
  assert.equal(apres.querySelector('[data-nv-valeur]').value, 'saisi');
});

test('sans lot en conflit : ni section, ni requête des conflits ; hors du site de dev : rien', async () => {
  const sans = await monter(routesDeBase({ 'GET mise-a-jour/': { ...NOTE, en_conflit: { lots: 0, modifications: 0 } } }));
  assert.equal(sans.section().hidden, true);
  assert.equal(sans.section().innerHTML, '');
  assert.ok(!sans.envois.some(([k]) => k === 'GET mise-a-jour/conflits/'));
  assert.doesNotMatch(sans.racine.querySelector('.nv-dev__bilan').textContent, /conflit/);
  const prod = await monter({ 'GET etat/': { edition: false } });
  assert.equal(prod.racine.querySelector('[data-nv-dev]').hidden, true);
  assert.equal(prod.section(), null);
  assert.deepEqual(prod.envois.map(([k]) => k), ['GET etat/']);
});

test('avec la case « Version majeure » (PR #224) : la case à côté du titre et la section des conflits ensemble ; la changer garde la section et ses choix', async () => {
  const note = (majeure) => ({ ...NOTE, version_cible: majeure ? '1.0' : '0.4', version_mineure: '0.4', version_majeure: '1.0', brouillon: { texte: '', majeure },
    en_conflit: { lots: DIAG.lots.length, modifications: 6 } });
  const page = await monter(routesDeBase({ 'GET mise-a-jour/': note(true), 'POST mise-a-jour/majeure/': (corps) => note(corps.majeure) }));
  const dev = page.racine.querySelector('[data-nv-dev]');
  const caseMajeure = () => dev.querySelector('[data-nv-majeure]');
  assert.equal(dev.querySelector('h2').textContent, 'Mise à jour en préparation : V1.0');
  assert.equal(caseMajeure().hasAttribute('checked'), true);
  assert.match(dev.querySelector('.nv-dev__bilan').textContent, /6 lots en conflit ne partent pas avec cette mise à jour/);
  const s = page.section();
  assert.equal(dev.children.at(-1), s);
  page.choisir(page.conflit(page.lot(FORGERON.lot), FORGERON.conflits[0].id), 1);
  // décochée (sans confirmation) : le service répond, la note est refaite, la section reste la même avec son choix
  caseMajeure().checked = false;
  caseMajeure().dispatchEvent(new Event('change'));
  await fini();
  assert.deepEqual(page.envois.filter(([k]) => k.startsWith('POST')), [['POST mise-a-jour/majeure/', { majeure: false }]]);
  assert.equal(dev.querySelector('h2').textContent, 'Mise à jour en préparation : V0.4');
  assert.equal(caseMajeure().hasAttribute('checked'), false);
  assert.equal(page.section(), s, 'la même section');
  assert.equal(dev.children.at(-1), s, 'toujours après les listes');
  const radio = [...page.conflit(page.lot(FORGERON.lot), FORGERON.conflits[0].id).querySelectorAll('[data-nv-choix]')].find((r) => r.getAttribute('value') === '1');
  assert.equal(radio.checked, true, 'le choix en cours reste');
});
