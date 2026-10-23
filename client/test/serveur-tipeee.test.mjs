// La partie « Bienvenue » de Tipeee relue en direct par le service (réponse du propriétaire du 2026-10-22 : « En direct par le serveur » — « Le
// serveur de production relit Tipeee lui-même, avec un cache de quelques heures, et garde le dernier texte si Tipeee ne répond pas ») :
// serveur/tipeee.mjs et GET /api/tipeee/ de serveur/api.mjs, avec un faux Tipeee (fetch injecté : les tests ne joignent pas Tipeee) et une horloge
// à soi — réponse d'exemple, adresse fixe, cache, une seule requête pour des appels simultanés, Tipeee injoignable, lent ou en erreur, repère
// absent, réponse trop grosse, redémarrage (dernier texte relu), repli sur l'instantané livré avec le site, alertes au journal ; la route ; le vrai
// serveur HTTP ; la livraison de l'instantané avec le service.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { niveauDuMessage } from '../serveur/journal-du-service.mjs';
import { DOSSIER_LIVRE, FICHIERS_JOINTS, livrerServeur } from '../serveur/livraison.mjs';
import { routeNormalisee } from '../serveur/metriques.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { CACHE_MS, DELAI_MS, FICHIER, OCTETS_MAX, REESSAI_MS, creerTipeee, reglagesTipeee } from '../serveur/tipeee.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { CHEMIN_INSTANTANE, REPERE, URL_API } from '../src/lib/tipeee.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('tipeee');
let n = 0;
const dossierNeuf = () => {
  n += 1;
  const d = join(racine, `db-${n}`);
  mkdirSync(d, { recursive: true });
  return d;
};

const EXEMPLE = readFileSync(new URL('./fixtures/tipeee-projet.json', import.meta.url), 'utf8');
const avecHtml = (html) => JSON.stringify({ contentv2: { translations: { fr: { html } } } });
const NOUVEAU = avecHtml(`<p>${REPERE}</p><p>Un texte changé sur Tipeee.</p>`);
const T0 = Date.parse('2026-10-22T12:00:00Z');
const PREMIER = 'Bienvenue sur le Tipeee de MaverickJDR !';

/** Un faux Tipeee : chaque appel prend l'étape suivante (la dernière se répète) ; `appels` garde l'adresse et les options. */
function fauxTipeee(...etapes) {
  const appels = [];
  const f = (adresse, options) => {
    appels.push({ adresse: String(adresse), options });
    return etapes[Math.min(appels.length - 1, etapes.length - 1)](adresse, options);
  };
  f.appels = appels;
  return f;
}
const repond = (corps = EXEMPLE, statut = 200, entetes = { 'content-type': 'application/json' }) => async () => new Response(corps, { status: statut, headers: entetes });
const injoignable = () => async () => {
  throw new TypeError('fetch failed');
};
/** Une réponse qui n'arrive jamais (sauf si le signal l'arrête). */
const jamais = () => (adresse, { signal }) => new Promise((ok, ko) => signal.addEventListener('abort', () => ko(signal.reason), { once: true }));

/** Un instantané écrit dans un fichier. */
function instantane(paragraphes = ['Bienvenue sur le Tipeee de MaverickJDR !', 'Texte de l’instantané.'], luLe = '2026-10-20T08:00:00Z') {
  n += 1;
  const chemin = join(racine, `instantane-${n}.json`);
  writeFileSync(chemin, JSON.stringify({ url: URL_API, lu_le: luLe, paragraphes }));
  return chemin;
}

/** Un lecteur avec son horloge (à avancer : `heure.t`) et ses comptes rendus. */
function lecteur(fetch, o = {}) {
  const heure = { t: o.t ?? T0 };
  const journal = [];
  const evenements = [];
  const l = creerTipeee({ fetch, horloge: () => heure.t, journal: (m, opt) => journal.push({ m, opt }), evenement: (type, e) => evenements.push({ type, ...e }), ...o });
  return { l, heure, journal, evenements };
}
const alertes = (journal) => journal.filter((e) => niveauDuMessage(e.m) === 'avertissement' && e.opt?.niveau === 'avertissement').map((e) => e.m);

test('bornes : cache de 6 heures, nouvel essai après 15 minutes, 8 s, 512 Kio ; réglages de l’environnement', () => {
  assert.deepEqual([CACHE_MS, REESSAI_MS, DELAI_MS, OCTETS_MAX], [6 * 3600_000, 15 * 60_000, 8000, 512 * 1024]);
  assert.deepEqual(reglagesTipeee({}, '/i.json'), { actif: true, cache: CACHE_MS, instantane: '/i.json' });
  assert.deepEqual(reglagesTipeee({ MAVERICK_TIPEEE: '0', MAVERICK_TIPEEE_CACHE_MIN: '90' }, null), { actif: false, cache: 90 * 60_000, instantane: null });
  for (const v of ['0', '-5', 'abc', '20000', '']) assert.equal(reglagesTipeee({ MAVERICK_TIPEEE_CACHE_MIN: v }, null).cache, CACHE_MS, v);
});

test('réponse d’exemple : l’adresse fixe de l’API (GET, sans cookie, sans redirection suivie), le texte en paragraphes, gardé sur disque, noté au journal et aux métriques', async () => {
  const dossier = dossierNeuf();
  const fetch = fauxTipeee(repond());
  const { l, journal, evenements } = lecteur(fetch, { dossier });
  const r = await l.lire();
  assert.equal(r.origine, 'tipeee');
  assert.equal(r.lu_le, '2026-10-22T12:00:00Z');
  assert.equal(r.paragraphes.length, 3);
  assert.equal(r.paragraphes[0], PREMIER);
  assert.deepEqual(fetch.appels.map((a) => [a.adresse, a.options.method, a.options.redirect, a.options.credentials]), [[URL_API, 'GET', 'manual', 'omit']]);
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, FICHIER), 'utf8')), { url: URL_API, lu_le: r.lu_le, paragraphes: r.paragraphes });
  assert.deepEqual(alertes(journal), []);
  assert.match(journal.at(-1).m, /^Tipeee : partie « Bienvenue » relue \(3 paragraphe\(s\), \d+ ms\), texte changé$/);
  assert.deepEqual(evenements.map((e) => [e.type, e.detail]), [['tipeee', { statut: 200, octets: Buffer.byteLength(EXEMPLE), paragraphes: 3, change: true }]]);
});

test('cache : aucune seconde requête pendant sa durée ; après, une relecture (qui suit le texte changé sur Tipeee)', async () => {
  const fetch = fauxTipeee(repond(), repond(NOUVEAU));
  const { l, heure } = lecteur(fetch, { dossier: dossierNeuf(), cache: 3 * 3600_000 });
  await l.lire();
  heure.t += 3 * 3600_000 - 1;
  for (let i = 0; i < 5; i += 1) assert.equal((await l.lire()).origine, 'tipeee');
  assert.equal(fetch.appels.length, 1);
  heure.t += 1;
  const r = await l.lire();
  assert.equal(fetch.appels.length, 2);
  assert.deepEqual(r, { paragraphes: [PREMIER, 'Un texte changé sur Tipeee.'], lu_le: '2026-10-22T15:00:00Z', origine: 'tipeee' });
});

test('une seule requête à la fois : des appels simultanés attendent la même lecture et reçoivent le même texte', async () => {
  let liberer;
  const retenue = new Promise((ok) => { liberer = ok; });
  const fetch = fauxTipeee(async () => {
    await retenue;
    return new Response(EXEMPLE, { status: 200 });
  });
  const { l } = lecteur(fetch, { dossier: dossierNeuf() });
  const appels = Array.from({ length: 20 }, () => l.lire());
  await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(fetch.appels.length, 1);
  liberer();
  const reponses = await Promise.all(appels);
  assert.equal(fetch.appels.length, 1);
  for (const r of reponses) assert.deepEqual(r, reponses[0]);
  assert.equal(reponses[0].origine, 'tipeee');
});

test('Tipeee injoignable, en erreur ou lent : l’instantané du site reste servi (« repli »), une alerte au journal, pas de nouvel essai avant 15 minutes', async () => {
  const chemin = instantane();
  for (const [etape, raison, motif] of [[injoignable(), 'injoignable', /injoignable \(fetch failed\)/], [repond('panne', 503), 'http', /HTTP 503/],
    [repond('', 301, { location: 'https://ailleurs.example/' }), 'http', /HTTP 301/], [jamais(), 'delai', /pas de réponse en 0 s/]]) {
    const fetch = fauxTipeee(etape, repond());
    const { l, heure, journal, evenements } = lecteur(fetch, { dossier: dossierNeuf(), instantane: chemin, delai: 30 });
    const r = await l.lire();
    assert.deepEqual(r, { paragraphes: [PREMIER, 'Texte de l’instantané.'], lu_le: '2026-10-20T08:00:00Z', origine: 'repli' }, raison);
    assert.equal(alertes(journal).length, 1, raison);
    assert.match(alertes(journal)[0], motif);
    assert.match(alertes(journal)[0], /l’instantané du site \(lu le 2026-10-20T08:00:00Z\) reste servi \(nouvel essai dans 15 min\)$/);
    assert.equal(evenements.at(-1).detail.raison, raison);
    assert.equal(fetch.appels.length, 1, `${raison} : une redirection n’est pas suivie`);
    heure.t += REESSAI_MS - 1;
    assert.equal((await l.lire()).origine, 'repli');
    assert.equal(fetch.appels.length, 1, `${raison} : pas de nouvel essai pendant 15 minutes`);
    heure.t += 1;
    assert.equal((await l.lire()).origine, 'tipeee', `${raison} : Tipeee revenu`);
    assert.equal(fetch.appels.length, 2);
  }
});

test('repère absent : le dernier texte valide reste servi et gardé, une alerte le dit', async () => {
  const dossier = dossierNeuf();
  const fetch = fauxTipeee(repond(), repond(avecHtml('<p>Bien le bonjour !</p><p>Plus de partie Bienvenue.</p>')));
  const { l, heure, journal } = lecteur(fetch, { dossier });
  const premier = await l.lire();
  heure.t += CACHE_MS;
  const r = await l.lire();
  assert.equal(fetch.appels.length, 2);
  assert.deepEqual(r, { ...premier, origine: 'repli' });
  assert.equal(alertes(journal).length, 1);
  assert.match(alertes(journal)[0], /^ATTENTION Tipeee : le repère « Bienvenue sur le Tipeee de MaverickJDR ! » est introuvable .* ; le texte lu le 2026-10-22T12:00:00Z reste servi/);
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, FICHIER), 'utf8')).paragraphes, premier.paragraphes, 'le fichier gardé ne change pas');
});

test('réponse trop grosse : annoncée (sans être lue) ou lue par morceaux au-delà de la borne, refusée', async () => {
  const chemin = instantane();
  let lue = false;
  const annoncee = async () => new Response(new ReadableStream({ pull(c) { lue = true; c.close(); } }, { highWaterMark: 0 }), { status: 200, headers: { 'content-length': String(OCTETS_MAX + 1) } });
  const enMorceaux = async () => new Response(new ReadableStream({
    start(c) {
      for (let i = 0; i < 4; i += 1) c.enqueue(new Uint8Array(1024).fill(32));
      c.close();
    },
  }), { status: 200 });
  for (const [etape, motif] of [[annoncee, /réponse annoncée de 524289 octets \(524288 au plus\)/], [enMorceaux, /réponse de plus de 3072 octets/]]) {
    const { l, journal, evenements } = lecteur(fauxTipeee(etape), { instantane: chemin, octetsMax: etape === enMorceaux ? 3 * 1024 : OCTETS_MAX });
    assert.equal((await l.lire()).origine, 'repli');
    assert.match(alertes(journal)[0], motif);
    assert.equal(evenements.at(-1).detail.raison, 'trop-gros');
  }
  assert.equal(lue, false, 'une taille annoncée trop grande n’est pas lue');
});

test('redémarrage : le dernier texte valide est relu ; pendant le cache, Tipeee n’est pas rejoint ; après, s’il ne répond pas, ce texte reste servi', async () => {
  const dossier = dossierNeuf();
  const chemin = instantane();
  const avant = await lecteur(fauxTipeee(repond(NOUVEAU)), { dossier, instantane: chemin }).l.lire();
  assert.equal(avant.origine, 'tipeee');
  // un nouveau service, une heure plus tard, Tipeee en panne
  const fetch = fauxTipeee(injoignable());
  const { l, heure, journal } = lecteur(fetch, { dossier, instantane: chemin, t: T0 + 3600_000 });
  assert.deepEqual(l.actuel(), avant, 'relu au démarrage');
  assert.deepEqual(await l.lire(), avant);
  assert.equal(fetch.appels.length, 0, 'pendant le cache : aucune requête');
  heure.t = T0 + CACHE_MS;
  assert.deepEqual(await l.lire(), { ...avant, origine: 'repli' });
  assert.equal(fetch.appels.length, 1);
  assert.match(alertes(journal)[0], /le texte lu le 2026-10-22T12:00:00Z reste servi/);
});

test('repli : le plus récent du texte gardé et de l’instantané ; un fichier gardé illisible est ignoré ; sans rien, une liste vide ; Tipeee jamais joint si fermé', async () => {
  // un instantané plus récent que le texte gardé (livré après) : c'est lui qui est servi, et Tipeee est relu
  const dossier = dossierNeuf();
  writeFileSync(join(dossier, FICHIER), JSON.stringify({ url: URL_API, lu_le: '2026-10-01T00:00:00Z', paragraphes: [PREMIER, 'Ancien.'] }));
  const recent = instantane([PREMIER, 'Récent.'], '2026-10-21T00:00:00Z');
  assert.deepEqual(lecteur(fauxTipeee(injoignable()), { dossier, instantane: recent }).l.actuel(), { paragraphes: [PREMIER, 'Récent.'], lu_le: '2026-10-21T00:00:00Z', origine: 'repli' });
  writeFileSync(join(dossier, FICHIER), '{ illisible');
  assert.deepEqual((await lecteur(fauxTipeee(injoignable()), { dossier, instantane: recent }).l.lire()).paragraphes, [PREMIER, 'Récent.']);
  // ni texte gardé ni instantané : une liste vide (la page garde le texte de son build), et l'instantané manquant est signalé
  const { l, journal } = lecteur(fauxTipeee(injoignable()), { dossier: dossierNeuf(), instantane: join(racine, 'absent.json') });
  assert.deepEqual(await l.lire(), { paragraphes: [], lu_le: null, origine: 'repli' });
  assert.match(alertes(journal)[0], /^ATTENTION Tipeee : l’instantané livré avec le site est absent ou illisible/);
  // MAVERICK_TIPEEE=0 : jamais de requête
  const ferme = fauxTipeee(repond());
  const f = lecteur(ferme, { dossier: dossierNeuf(), instantane: instantane(), actif: false });
  for (let i = 0; i < 3; i += 1) assert.equal((await f.l.lire()).origine, 'repli');
  assert.equal(ferme.appels.length, 0);  // un texte gardé encore dans la durée du cache (lu une heure avant), le service relancé fermé : servi, mais comme « dernier texte connu »
  const dossier2 = dossierNeuf();
  const lu = await lecteur(fauxTipeee(repond(NOUVEAU)), { dossier: dossier2 }).l.lire();
  assert.equal(lu.origine, 'tipeee');
  const ferme2 = fauxTipeee(repond());
  const g = lecteur(ferme2, { dossier: dossier2, actif: false, t: T0 + 3600_000 });
  assert.deepEqual(g.l.actuel(), { ...lu, origine: 'repli' });
  assert.deepEqual(await g.l.lire(), { ...lu, origine: 'repli' }, 'MAVERICK_TIPEEE=0 : le dernier texte connu, jamais « tipeee »');
  assert.equal(ferme2.appels.length, 0);
});

test('route GET /api/tipeee/ : une promesse de { paragraphes, lu_le, origine } ; GET seulement, rien après, 503 sans lecteur ; route normalisée des métriques', async () => {
  const { l } = lecteur(fauxTipeee(repond()));
  const service = { base: () => null, etat: () => ({}), tipeee: l };
  const reponse = traiter({ methode: 'GET', chemin: '/api/tipeee/', entetes: {} }, service);
  assert.equal(typeof reponse.then, 'function');
  const r = await reponse;
  assert.equal(r.statut, 200);
  assert.deepEqual(Object.keys(r.corps), ['paragraphes', 'lu_le', 'origine']);
  assert.equal(r.corps.paragraphes[0], PREMIER);
  assert.equal((await traiter({ methode: 'GET', chemin: '/api/tipeee', entetes: {} }, service)).statut, 200, 'sans « / » finale');
  assert.deepEqual(traiter({ methode: 'POST', chemin: '/api/tipeee/', entetes: {} }, service), { statut: 405, corps: { erreur: 'Méthode POST non permise ici.' }, entetes: { Allow: 'GET' } });
  assert.equal(traiter({ methode: 'GET', chemin: '/api/tipeee/x/', entetes: {} }, service).statut, 404);
  assert.equal(traiter({ methode: 'GET', chemin: '/api/tipeee/', entetes: {} }, { ...service, tipeee: null }).statut, 503);
  assert.equal(routeNormalisee('/api/tipeee/'), '/api/tipeee/');
  assert.equal(routeNormalisee('/api/tipeee?x=1'), '/api/tipeee/');
  assert.equal(routeNormalisee('/api/tipeee/x/'), '/api/{inconnue}');
});

test('le vrai service : GET /api/tipeee/ en HTTP, le dernier texte gardé à côté de la base vivante, puis relu par un service redémarré', async () => {
  const dossier = join(racine, 'service');
  const chemin = instantane();
  const demarrer = (fetch) => demarrerService({ regles: cheminBase({ sansExemples: false }), dossier, port: 0, intervalle: 0, metriques: false, journal: () => {},
    tipeee: { fetch, instantane: chemin } });
  let service = await demarrer(fauxTipeee(repond()));
  try {
    const r = await fetch(`${service.url}/api/tipeee/`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^application\/json/);
    const corps = await r.json();
    assert.equal(corps.origine, 'tipeee');
    assert.equal(corps.paragraphes[0], PREMIER);
    assert.ok(existsSync(join(dossier, FICHIER)) && existsSync(join(dossier, 'vivante.db')));
  } finally {
    await service.arreter();
  }
  const panne = fauxTipeee(injoignable());
  service = await demarrer(panne);
  try {
    const corps = await (await fetch(`${service.url}/api/tipeee/`)).json();
    assert.equal(corps.paragraphes.length, 3, 'le texte lu avant le redémarrage, pas l’instantané');
    assert.equal(panne.appels.length, 0, 'pendant le cache : Tipeee n’est pas rejoint');
  } finally {
    await service.arreter();
  }
});

test('livraison : l’instantané (sources/tipeee/bienvenue.json) copié dans _serveur/sources/, compté dans l’empreinte ; absent, rien n’est copié', () => {
  assert.deepEqual(FICHIERS_JOINTS, [{ source: `../${CHEMIN_INSTANTANE}`, cible: CHEMIN_INSTANTANE }]);
  const depot = join(racine, 'faux-depot');
  const client = join(depot, 'client');
  mkdirSync(join(client, 'serveur'), { recursive: true });
  writeFileSync(join(client, 'serveur', 'index.mjs'), 'export const a = 1;\n');
  const dist = join(racine, 'faux-dist');
  const sans = livrerServeur(dist, { client, version: '1.2.3' });
  assert.deepEqual(sans.fichiers, []);
  mkdirSync(join(depot, 'sources', 'tipeee'), { recursive: true });
  const contenu = JSON.stringify({ url: URL_API, lu_le: '2026-10-22T12:00:00Z', paragraphes: [PREMIER] });
  writeFileSync(join(depot, CHEMIN_INSTANTANE), contenu);
  const avec = livrerServeur(dist, { client, version: '1.2.3' });
  assert.deepEqual(avec.fichiers, [CHEMIN_INSTANTANE]);
  assert.equal(readFileSync(join(dist, DOSSIER_LIVRE, CHEMIN_INSTANTANE), 'utf8'), contenu);
  assert.notEqual(avec.empreinte, sans.empreinte, 'un instantané changé relance le service livré');
  assert.deepEqual(JSON.parse(readFileSync(join(dist, DOSSIER_LIVRE, 'version.json'), 'utf8')).fichiers, [CHEMIN_INSTANTANE]);
});
