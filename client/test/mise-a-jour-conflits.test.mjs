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
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { attendre, el, Element, fauxDocument } from './aide-faux-dom.mjs';

const DIAG = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic.json', import.meta.url), 'utf8'));
const FORGERON = DIAG.lots.find((l) => l.resume === 'Métier Forgeron : Bonus');
const HYPER = DIAG.lots.find((l) => l.resume.startsWith('Page Le Mode Hyper'));

const ALIAS = DIAG.lots.find((l) => l.resume === 'Alias d’essai');
// un lot gardé (la valeur du site en place), un lot retenu derrière lui (test/fixtures/conflits-diagnostic-garde.json, tech-back) : structure seulement
const GARDE = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic-garde.json', import.meta.url), 'utf8'));
const LOT_GARDE = GARDE.lots.find((l) => l.garde);
/** Un instant ISO 8601 resté brut dans un texte de la page. */
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/** Le lot gardé qui attend un lot plus ancien, en conflit sur le même champ (`bloque` du service). */
const BLOCAGE = { lot: 'L-ancien', fait_le: '2026-11-01T09:00:00Z', resume: 'Résumé d’essai', raison: 'Le lot du 2026-11-01T09:00:00Z (« Résumé d’essai »), plus ancien, touche aussi ce champ et n’est pas résolu : résolvez-le d’abord.' };
const lotBloque = () => {
  const l = structuredClone(LOT_GARDE);
  l.bloque = true;
  l.conflits[0].bloque = BLOCAGE;
  return l;
};
const routesGardees = (extra = {}) => routesDeBase({
  'GET mise-a-jour/': { ...NOTE, en_conflit: { lots: GARDE.lots.length, modifications: 2 } },
  'GET mise-a-jour/conflits/': GARDE,
  ...extra,
});

/** Les tables et colonnes du schéma (data/schema.sql) à « _ » : aucune ne doit se lire dans la section (demande du 2026-10-23 : « Un vrai nom serai mieux »). */
const NOMS_DU_SCHEMA = (() => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const noms = new Set([...tables, ...tables.flatMap((t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name))].filter((n) => n.includes('_')));
  db.close();
  return noms;
})();
/** Les noms du schéma lus dans un texte, même collés au mot d'avant (le texte d'un HTML sans ses balises : « écrit » + « page_id » → « écritpage_id »). */
const nomsDuSchemaDans = (t) => [...new Set((String(t).match(/[a-z0-9]+(?:_[a-z0-9]+)+/g) ?? []).flatMap((m) => [...NOMS_DU_SCHEMA].filter((n) => m.endsWith(n))))];

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
  assert.match(dev.querySelector('.nv-dev__bilan').textContent, /8 lots en conflit ne partent pas avec cette mise à jour/);
  assert.equal(s.querySelectorAll('[data-nv-lot]').length, 8);
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

test('un vrai nom partout dans la section posée (demande du 2026-10-23) : ni nom de table ni nom de colonne du schéma, versions ligne entière comprises', async () => {
  const page = await monter(routesDeBase());
  const s = page.section();
  assert.ok(NOMS_DU_SCHEMA.has('metier_bonus') && NOMS_DU_SCHEMA.has('page_id'), 'les noms cherchés');
  assert.deepEqual(nomsDuSchemaDans(s.textContent), [], 'toute la section, le contenu des versions compris');
  assert.doesNotMatch(s.textContent, /\balias\b|metier_bonus|\{"|":/);
  assert.match(s.textContent, /Bonus du métier « Forgeron », n° 1, option 2/);
  // la rupture « enfant » par le nom de la table qui cite, le renommage des deux bords sans sa clé normalisée (relecture du 2026-10-23)
  assert.match(s.textContent, /Étiquette du sort : clé étrangère rompue vers Mot-clé/);
  assert.match(s.textContent, /Au rejeu : Métier « Acrobate des règles \(essai des conflits\) » : les règles ont changé « Nom » autrement/);
  assert.doesNotMatch(s.textContent, /sort_mot_cle|nom_cle|\bmot_cle\b/);
  // la ligne entière de l'autre nom de page (version 1) : chaque colonne par le nom du service, ni clé normalisée ni provenance
  const versions = [...page.conflit(page.lot(ALIAS.lot), ALIAS.conflits[0].id).querySelectorAll('.nv-version__texte')].map((v) => v.textContent);
  assert.equal(versions[0], 'Page : guide/le-mode-hyper\nOrdre : 900\nAutre nom : Alias du site de dev (essai des conflits)');
  assert.equal(versions[1], 'Ligne supprimée : elle n’existe plus dans les règles livrées.');
});

test('le script de la page n’importe ni le modèle ni le registre des noms (skill site-version-portable) : les noms viennent du service', () => {
  /** Les modules importés, directement ou non, par un module (imports relatifs statiques). */
  const importes = (url, vus = new Set()) => {
    for (const m of readFileSync(url, 'utf8').matchAll(/\bfrom\s+'(\.{1,2}\/[^']+)'/g)) {
      const dep = new URL(m[1], url);
      if (!vus.has(dep.href)) {
        vus.add(dep.href);
        importes(dep, vus);
      }
    }
    return vus;
  };
  const graphe = [...importes(new URL('../src/scripts/mise-a-jour.mjs', import.meta.url))].map((h) => h.replace(/^.*\/src\//, ''));
  assert.deepEqual(graphe.sort(), ['lib/conflits-rendu.mjs', 'lib/diff-replie.mjs', 'lib/notes-de-version-rendu.mjs']);
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
  assert.equal(page.section().querySelectorAll('[data-nv-lot]').length, 7);
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
  assert.match(dev.querySelector('.nv-dev__bilan').textContent, /8 lots en conflit ne partent pas avec cette mise à jour/);
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

// Demande du propriétaire du 2026-11-12 : « Quand un conflit est trop ambigüe seulement là il est listé dans l'onglet mise à jour avec à gauche
// "modification sur site" et à droite "modification du code". C'est là que tu peux choisir entre 1, 2, ou 3 modification manuelle » ; réponse : en
// attendant le choix, la page affiche la modification du site.
test('un lot gardé posé : à gauche la modification sur le site, à droite celle du code ; ce que la page affiche ; les lots retenus', async () => {
  const page = await monter(routesGardees());
  const form = page.lot(LOT_GARDE.lot);
  assert.ok(form && form.classList.contains('nv-conflit-lot--garde'));
  for (const c of LOT_GARDE.conflits) {
    const f = page.conflit(form, c.id);
    const colonnes = f.querySelector('.nv-conflit__versions--garde');
    assert.ok(colonnes, `${c.id} : les deux colonnes`);
    const [gauche, droite] = colonnes.querySelectorAll(':scope > .nv-version');
    assert.ok(gauche.classList.contains('nv-version--1') && droite.classList.contains('nv-version--2'), `${c.id} : la version 1 à gauche, la 2 à droite`);
    assert.match(gauche.querySelector('.nv-version__titre').textContent, /^Version 1 : modification sur le site/);
    assert.match(droite.querySelector('.nv-version__titre').textContent, /^Version 2 : modification du code/);
    // ce que la page affiche en attendant le choix : le résultat du choix 1 (`valeur_1`), dont la saisie du 3 part
    assert.equal(f.querySelector('[data-nv-affichee]').dataset.nvAffichee, '1', c.id);
    const champ = f.querySelector('[data-nv-valeur]');
    assert.equal(champ.tagName === 'TEXTAREA' ? champ.textContent : champ.getAttribute('value'), c.valeur_1.valeur, c.id);
    // le résultat de chaque choix, quand il diffère des modifications entières
    if (c.passages.length) assert.equal(f.querySelectorAll('[data-nv-resultat]').length, 2, c.id);
    assert.equal(Boolean(f.querySelector('[data-nv-suivants]')), c.lots_suivants.length > 0, c.id);
  }
  // les lots retenus : un par entrée, liés au formulaire du lot qu'ils attendent
  const retenus = page.section().querySelector('[data-nv-retenus]');
  assert.ok(retenus);
  assert.equal(retenus.querySelectorAll('li').length, GARDE.retenus.length);
  assert.equal(retenus.querySelector('a').getAttribute('href'), `#${form.id}`);
  // ni identifiant de lot, ni instant ISO, ni nom du schéma
  const t = page.section().textContent;
  for (const id of [...GARDE.lots.map((l) => l.lot), ...GARDE.retenus.map((r) => r.lot)]) assert.ok(!t.includes(id), id);
  assert.doesNotMatch(t, ISO);
  assert.deepEqual(nomsDuSchemaDans(t), []);
  // le bouton d'un lot qui n'attend rien reste actif
  assert.equal(form.querySelector('[type="submit"]').hasAttribute('disabled'), false);
});

test('un lot gardé se résout : 1 garder le site, 2 prendre le code ; le message dit la reprise', async () => {
  let reste = GARDE.lots;
  const page = await monter(routesGardees({
    'GET mise-a-jour/': () => ({ ...NOTE, en_conflit: { lots: reste.length, modifications: reste.length } }),
    'GET mise-a-jour/conflits/': () => ({ lots: reste, resolus: [], retenus: [] }),
    'POST mise-a-jour/conflits/': (corps) => {
      reste = reste.filter((l) => l.lot !== corps.lot);
      return { lot: corps.lot, reprise: `${corps.lot}-reprise`, nouveau_lot: 'L-NOUVEAU', modifications: 5, lignes: [], fiches: [], resolution: [] };
    },
  }));
  const form = page.lot(LOT_GARDE.lot);
  const [premier, second] = LOT_GARDE.conflits;
  page.choisir(page.conflit(form, premier.id), 1);
  page.choisir(page.conflit(form, second.id), 2);
  page.envoyer(form);
  await fini();
  const [, corps] = page.envois.find(([k]) => k === 'POST mise-a-jour/conflits/');
  assert.deepEqual(corps, { lot: LOT_GARDE.lot, empreinte: LOT_GARDE.empreinte, choix: { [premier.id]: { choix: 1 }, [second.id]: { choix: 2 } } });
  assert.match(page.section().querySelector('.nv-conflits__message').textContent, /^Conflit résolu : la modification du site est reprise/);
  assert.equal(page.lot(LOT_GARDE.lot), undefined);
});

test('bug 1 : un lot qui attend un lot plus ancien (bloque) a son bouton grisé et sa raison ; rien ne part', async () => {
  const page = await monter(routesGardees({ 'GET mise-a-jour/conflits/': { ...GARDE, lots: [lotBloque()] } }));
  const form = page.lot(LOT_GARDE.lot);
  assert.ok(form.hasAttribute('data-nv-bloque'));
  assert.equal(form.querySelector('[type="submit"]').hasAttribute('disabled'), true);
  // la raison : sous le conflit et près du bouton, par la date lisible et le résumé du lot à résoudre d'abord
  const sousLeConflit = page.conflit(form, LOT_GARDE.conflits[0].id).querySelector('[data-nv-bloque]');
  const presDuBouton = form.querySelector('[data-nv-lot-bloque]');
  for (const p of [sousLeConflit, presDuBouton]) {
    assert.ok(p && p.textContent.includes(BLOCAGE.resume));
    assert.doesNotMatch(p.textContent, ISO);
    assert.ok(!p.textContent.includes(BLOCAGE.lot));
  }
  // même avec chaque choix fait, un envoi (touche Entrée) ne part pas : le message le dit
  for (const c of LOT_GARDE.conflits) page.choisir(page.conflit(form, c.id), 1);
  page.envoyer(form);
  await fini();
  assert.equal(page.envois.filter(([k]) => k.startsWith('POST')).length, 0);
  assert.equal(form.querySelector('[data-nv-lot-message]').hidden, false);
});

test('bug 1 : un 409 de blocage reçu repose le lot à jour (bouton grisé) et affiche le message du service, sa date lisible', async () => {
  const erreur = `Métier « Forgeron » (Description) : ${BLOCAGE.raison}`;
  const page = await monter(routesGardees({ 'POST mise-a-jour/conflits/': [409, { erreur, lot: lotBloque(), bloque: BLOCAGE }] }));
  let form = page.lot(LOT_GARDE.lot);
  for (const c of LOT_GARDE.conflits) page.choisir(page.conflit(form, c.id), 1);
  page.envoyer(form);
  await fini();
  form = page.lot(LOT_GARDE.lot);
  assert.equal(form.querySelector('[type="submit"]').hasAttribute('disabled'), true);
  const message = form.querySelector('[data-nv-lot-message]');
  assert.equal(message.hidden, false);
  assert.ok(message.textContent.includes(BLOCAGE.resume), message.textContent);
  assert.doesNotMatch(message.textContent, ISO);
  // les choix faits restent
  const radio = [...page.conflit(form, LOT_GARDE.conflits[0].id).querySelectorAll('[data-nv-choix]')].find((r) => r.getAttribute('value') === '1');
  assert.equal(radio.checked, true);
});
