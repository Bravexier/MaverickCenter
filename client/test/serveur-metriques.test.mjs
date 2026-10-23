// Métriques du service (client/serveur/metriques.mjs, metriques-sql.mjs ; demande du propriétaire du 2026-10-15) : routes normalisées (toutes celles
// d'api.mjs et de /api/v1/, cardinalité bornée), histogrammes et quantiles, navigateur et page d'origine, mesure SQL sans changement de comportement,
// collecte et versement, lecture du fichier de l'autre instance en lecture seule, rétention et purge (horloge injectée), panne de la base des
// métriques (jamais d'échec : mémoire bornée, notée une fois), balise des pages, volume et alertes, surcoût mesuré.
//   node --test test/serveur-metriques.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  alertesDu, BALISE, BORNES_MS, CLASSES, classeDe, creerMetriques, empreinteDePile, estUnSuivi, instanceDuService, methodeNormalisee, navigateurDe,
  PAGES_PAR_HEURE, pageDuReferent, quantile, quantileDetaille, RETENTION, ROUTE_INCONNUE, routeNormalisee, SEUILS, statistiques,
} from '../serveur/metriques.mjs';
import { creerMesureSql, normaliserSql } from '../serveur/metriques-sql.mjs';
import { RESSOURCES } from '../src/lib/ressources.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('metriques');
let compteur = 0;
const dossierNeuf = () => join(racine, `m${++compteur}`);
const JOUR = 86_400_000;
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const hasard = () => `x${Math.random().toString(36).slice(2)}%2F${Math.random().toString(36).slice(2, 6)}%23,9`;

/** Une requête simulée : debut, phases posées, fin. */
function requete(m, { methode = 'GET', adresse = '/api/etat/', statut = 200, duree = null, entetes = {}, sql = null, octets = 100 } = {}) {
  const r = m.debut(methode, adresse, { host: 'site', 'user-agent': CHROME, ...entetes });
  // une durée donnée est exacte : `fin` lit performance.now(), figé ici à t0 + duree le temps de son appel (synchrone) ; sinon le temps réellement
  // écoulé entre ces lignes et `fin` s'ajoute à la durée (sur une machine chargée, +3 ms sur quatre requêtes : run 38825777373 de la CI)
  const t = performance.now();
  if (duree !== null) r.t0 = t - duree;
  r.tCorps = r.t0;
  r.tTraite = r.t0;
  r.sql = sql;
  if (duree === null) return m.fin(r, { statut, octets_sortie: octets });
  Object.defineProperty(performance, 'now', { value: () => t, configurable: true, writable: true });
  try {
    return m.fin(r, { statut, octets_sortie: octets });
  } finally {
    delete performance.now; // la méthode du prototype revient
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Routes normalisées
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('routes d’api.mjs : chaque adresse de son en-tête a un gabarit sans identifiant ; la chaîne de requête et la « / » finale ne comptent pas', () => {
  const entete = readFileSync(new URL('../serveur/api.mjs', import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//'));
  const adresses = new Set();
  for (const l of entete) for (const m of l.matchAll(/(?:GET|POST|PUT|PATCH|DELETE|GET\|POST)\s+(\/api\/[^\s,]+)/g)) adresses.add(m[1]);
  assert.ok(adresses.size >= 30, `adresses trouvées : ${adresses.size}`);
  for (const a of adresses) {
    if (a.includes('<ressource>') || a.includes('[')) continue; // /api/v1/… : le test suivant
    const id = hasard();
    const reelle = a.replace(/<[^>]+>/g, id);
    const route = routeNormalisee(reelle);
    assert.notEqual(route, ROUTE_INCONNUE, a);
    assert.ok(!route.includes('x') || !route.includes(id), `${a} → ${route}`);
    assert.ok(!route.includes(id), `${a} → ${route} : sans l’identifiant`);
    assert.match(route, /\/$|openapi\.json$/, route);
  }
  const attendues = {
    '/api/etat': '/api/etat/',
    '/api/etat/?x=1': '/api/etat/',
    '/api/personnages/': '/api/personnages/',
    '/api/personnages/elfe-1/': '/api/personnages/{id}/',
    '/api/personnages/a%2Fb/portrait/': '/api/personnages/{id}/portrait/',
    '/api/edition/': '/api/edition/',
    '/api/edition/lignes/': '/api/edition/lignes/',
    '/api/mise-a-jour/lots/0f0e2c1a-1111-2222-3333-444455556666/': '/api/mise-a-jour/lots/{lot}/',
    '/api/mise-a-jour/lancer/': '/api/mise-a-jour/lancer/',
    '/api/mise-a-jour/majeure/': '/api/mise-a-jour/majeure/',
    '/api/mise-a-jour/conflits/': '/api/mise-a-jour/conflits/',
    '/api/maintenance/lever/': '/api/maintenance/lever/',
    '/api/debug/journal/?depuis=3': '/api/debug/journal/',
    '/api/debug/metriques/?periode=7j': '/api/debug/metriques/',
    '/api/debug/metriques/requetes/': '/api/debug/metriques/requetes/',
    '/api/debug/metriques/export/': '/api/debug/metriques/export/',
    '/api/debug/systeme/': '/api/debug/systeme/',
    '/api/debug/base/': '/api/debug/base/',
    '/api/debug/base?x=1': '/api/debug/base/',
    '/api/debug/tables/metier/?limite=100': '/api/debug/tables/{table}/',
    '/api/metriques/page/': '/api/metriques/page/',
    '/api/classeur/': '/api/classeur/',
    '/api/classeur': '/api/classeur/',
    '/api/tipeee/': '/api/tipeee/',
    '/api/tipeee': '/api/tipeee/',
    '/api/v1/': '/api/v1/',
    '/api/v1/openapi.json': '/api/v1/openapi.json',
    '/api/v1/metiers/?q=forge&limite=1': '/api/v1/metiers/',
    '/api/v1/metiers/forgeron/': '/api/v1/metiers/{cle}/',
  };
  for (const [a, r] of Object.entries(attendues)) assert.equal(routeNormalisee(a), r, a);
  for (const a of ['/', '/api/', '/autre/api/etat/', '/api/inconnue/', '/api/etat/x/', '/api/personnages//', '/api/personnages/a/b/', '/api/personnages/a/portrait/b/',
    '/api/edition/inconnue/', '/api/edition/lignes/x/', '/api/mise-a-jour/lots/', '/api/mise-a-jour/lots/a/b/', '/api/debug/', '/api/debug/autre/',
    '/api/debug/metriques/autre/', '/api/debug/base/x/', '/api/metriques/', '/api/metriques/page/x/', '/api/classeur/x/', '/api/classeur/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit/', '/api/tipeee/x/', '/api/v1/inconnue/', '/api/v1/openapi.json/x', '/api/v1/metiers/x/inconnu/',
    '/api/v1/metiers/x/y/z/w/', '', null]) {
    assert.equal(routeNormalisee(a), ROUTE_INCONNUE, String(a));
  }
});

test('routes de /api/v1/ : chaque ressource, sous-ressource et action du registre a son gabarit ; un identifiant ne crée jamais de nouvelle route', () => {
  const gabarits = new Set(['/api/v1/', '/api/v1/openapi.json']);
  for (const r of RESSOURCES) {
    const c = r.cle;
    assert.equal(routeNormalisee(`/api/v1/${c}/`), `/api/v1/${c}/`);
    assert.equal(routeNormalisee(`/api/v1/${c}/${hasard()}/`), `/api/v1/${c}/{cle}/`);
    gabarits.add(`/api/v1/${c}/`).add(`/api/v1/${c}/{cle}/`);
    for (const e of r.enfants ?? []) {
      assert.equal(routeNormalisee(`/api/v1/${c}/${hasard()}/${e.cle}/`), `/api/v1/${c}/{cle}/${e.cle}/`);
      assert.equal(routeNormalisee(`/api/v1/${c}/${hasard()}/${e.cle}/${hasard()}/?x=1`), `/api/v1/${c}/{cle}/${e.cle}/{cle}/`);
      gabarits.add(`/api/v1/${c}/{cle}/${e.cle}/`).add(`/api/v1/${c}/{cle}/${e.cle}/{cle}/`);
    }
    for (const a of r.actions ?? []) {
      assert.equal(routeNormalisee(`/api/v1/${c}/${hasard()}/${a.cle}/`), `/api/v1/${c}/{cle}/${a.cle}/`);
      assert.equal(routeNormalisee(`/api/v1/${c}/${hasard()}/${a.cle}/${hasard()}/`), ROUTE_INCONNUE, 'une action n’a pas de ligne');
      gabarits.add(`/api/v1/${c}/{cle}/${a.cle}/`);
    }
  }
  // 20 000 adresses tirées au hasard (identifiants, chaînes de requête, segments inconnus) : jamais une route hors des gabarits
  const vues = new Set();
  for (let i = 0; i < 20_000; i++) {
    const r = RESSOURCES[i % RESSOURCES.length];
    const enfant = r.enfants?.[i % (r.enfants.length || 1)];
    const formes = [`/api/v1/${r.cle}/${hasard()}/`, `/api/v1/${r.cle}/?q=${hasard()}`, `/api/v1/${hasard()}/`, `/api/v1/${r.cle}/${hasard()}/${hasard()}/`];
    if (enfant) formes.push(`/api/v1/${r.cle}/${hasard()}/${enfant.cle}/${hasard()}/`);
    vues.add(routeNormalisee(formes[i % formes.length]));
  }
  for (const v of vues) assert.ok(v === ROUTE_INCONNUE || gabarits.has(v), v);
  assert.ok(vues.size <= gabarits.size + 1);
});

test('méthodes gardées ; relèves (suivi) : réussies seulement', () => {
  assert.equal(methodeNormalisee('get'), 'GET');
  assert.equal(methodeNormalisee('PROPFIND'), 'AUTRE');
  assert.equal(methodeNormalisee(undefined), 'AUTRE');
  assert.equal(estUnSuivi('GET', '/api/maintenance/', 200), true);
  assert.equal(estUnSuivi('GET', '/api/debug/metriques/', 304), true);
  assert.equal(estUnSuivi('GET', '/api/debug/metriques/export/', 200), false, 'un export se demande à la main');
  assert.equal(estUnSuivi('GET', '/api/debug/journal/', 403), false);
  // la version de la base (menu « DB » ouvert, toutes les 2 s) : une relève ; le contenu d'une table, relu quand elle change, n'en est pas une
  assert.equal(estUnSuivi('GET', '/api/debug/base/', 200), true);
  assert.equal(estUnSuivi('GET', '/api/debug/base/', 503), false);
  assert.equal(estUnSuivi('GET', '/api/debug/tables/{table}/', 304), false);
  assert.equal(estUnSuivi('POST', '/api/metriques/page/', 204), true);
  assert.equal(estUnSuivi('POST', '/api/metriques/page/', 400), false);
  assert.equal(estUnSuivi('GET', '/api/etat/', 200), false);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Histogrammes, quantiles, statistiques
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('classes de l’histogramme : ]borne précédente, borne], la dernière au-delà de 5 000 ms', () => {
  assert.equal(CLASSES, 13);
  assert.deepEqual(BORNES_MS, [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]);
  assert.equal(classeDe(0), 0);
  assert.equal(classeDe(1), 0);
  assert.equal(classeDe(1.0001), 1);
  assert.equal(classeDe(5), 2);
  assert.equal(classeDe(5000), 11);
  assert.equal(classeDe(5000.01), 12);
  assert.equal(classeDe(1e9), 12);
});

test('quantiles tirés de l’histogramme : interpolation linéaire dans la classe, bornée par le min et le max observés ; jamais jusqu’au maximum dans la dernière classe', () => {
  const h = (valeurs) => valeurs.reduce((t, v) => { t[classeDe(v)] += 1; return t; }, new Array(CLASSES).fill(0));
  assert.equal(quantile(new Array(CLASSES).fill(0), 0.5, 0, 0), null, 'sans valeur');
  // dix valeurs dans ]2, 5], min 2,5, max 4,5 : la classe est réduite à [2,5 ; 4,5] et le rang 5 tombe au milieu
  const dix = new Array(CLASSES).fill(0);
  dix[2] = 10;
  assert.equal(quantile(dix, 0.5, 2.5, 4.5), 3.5);
  assert.equal(quantile(dix, 0, 2.5, 4.5), 2.5, 'q = 0 : le minimum');
  assert.equal(quantile(dix, 1, 2.5, 4.5), 4.5, 'q = 1 : le maximum');
  // toutes égales : le quantile est la valeur
  assert.equal(quantile(h([3, 3, 3, 3]), 0.95, 3, 3), 3);
  // la dernière classe (au-delà de 5 000 ms) n'a pas de borne haute : sa borne basse (ou le minimum, plus haut), marquée « au-delà »
  assert.equal(quantile(h([6000, 8000]), 0.5, 6000, 8000), 6000);
  assert.deepEqual(quantileDetaille(h([6000, 8000]), 0.5, 6000, 8000), { valeur: 6000, au_dela: true });
  assert.deepEqual(quantileDetaille(h([7000, 7000]), 0.5, 7000, 7000), { valeur: 7000, au_dela: false }, 'toutes égales : exacte');
  // deux classes : 90 valeurs ≤ 1 ms, 10 valeurs dans ]100, 200] → p95 au milieu de la seconde
  const deux = new Array(CLASSES).fill(0);
  deux[0] = 90;
  deux[7] = 10;
  assert.equal(quantile(deux, 0.95, 0.2, 200), 150);
  assert.equal(quantile(deux, 0.5, 0.2, 200), 0.2 + (50 / 90) * 0.8);
  // propriété : sur des données tirées au hasard, le quantile estimé est dans la classe du vrai quantile
  for (let essai = 0; essai < 50; essai++) {
    const valeurs = Array.from({ length: 200 + essai * 7 }, () => Math.exp(Math.random() * 9) - 0.9);
    const tries = [...valeurs].sort((a, b) => a - b);
    const min = tries[0];
    const max = tries.at(-1);
    for (const q of [0.5, 0.95, 0.99]) {
      const vrai = tries[Math.ceil(q * tries.length) - 1];
      const estime = quantile(h(valeurs), q, min, max);
      const i = classeDe(vrai);
      const bas = Math.max(i === 0 ? 0 : BORNES_MS[i - 1], min);
      const haut = Math.min(i < BORNES_MS.length ? BORNES_MS[i] : max, max);
      assert.ok(estime >= bas - 1e-9 && estime <= haut + 1e-9, `q ${q} : ${estime} hors de [${bas}, ${haut}] (vrai ${vrai})`);
    }
  }
});

test('statistiques : moyenne, écart type, part de 304, erreurs, phases, requête SQL la plus lente ; vide : des null', () => {
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0 });
  try {
    for (const [d, s] of [[10, 200], [20, 304], [30, 404], [40, 500]]) {
      requete(m, { duree: d, statut: s, sql: { n: 2, ms: d / 10, plus_lente: { sql: `SELECT ${d}`, ms: d / 20 } } });
    }
    const l = m.lire({ periode: '1h' });
    const r = l.routes[0];
    assert.equal(r.route, '/api/etat/');
    assert.deepEqual([r.n, r.erreurs_4xx, r.erreurs_5xx, r.part_304], [4, 1, 1, 0.25]);
    assert.ok(Math.abs(r.moyenne_ms - 25) < 0.5, r.moyenne_ms);
    assert.ok(Math.abs(r.ecart_type_ms - Math.sqrt(125)) < 0.5, r.ecart_type_ms);
    assert.ok(Math.abs(r.total_ms - 100) < 1);
    assert.ok(r.min_ms >= 10 && r.max_ms >= 40 && r.max_ms < 45);
    assert.equal(r.sql_requetes_moyen, 2);
    assert.deepEqual(r.sql_plus_lente, { sql: 'SELECT 40', ms: 2 });
    assert.deepEqual(Object.keys(r.phases), ['corps_ms', 'traitement_ms', 'envoi_ms']);
    assert.deepEqual(l.global.n, 4);
  } finally {
    m.arreter();
  }
  const vide = statistiques({ n: 0 });
  assert.deepEqual([vide.n, vide.moyenne_ms, vide.p95_ms, vide.min_ms], [0, null, null, null]);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Navigateur, page d'origine, SQL
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('navigateur et appareil d’après le User-Agent (jamais gardé entier)', () => {
  const cas = [
    [CHROME, 'Chrome', 'ordinateur'],
    [`${CHROME} Edg/129.0.0.0`, 'Edge', 'ordinateur'],
    [`${CHROME} OPR/114.0.0.0`, 'Opera', 'ordinateur'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 'Firefox', 'telephone'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', 'Safari', 'telephone'],
    ['Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1', 'Safari', 'tablette'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15', 'Safari', 'ordinateur'],
    ['Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 'Chrome', 'tablette'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36', 'Samsung Internet', 'telephone'],
    ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Robot', 'robot'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36', 'Robot', 'robot'],
    ['curl/8.5.0', 'Outil', 'robot'],
    ['node', 'Outil', 'robot'],
    ['', 'Inconnu', 'robot'],
    [undefined, 'Inconnu', 'robot'],
    ['Lynx/2.9', 'Autre', 'ordinateur'],
  ];
  for (const [ua, famille, appareil] of cas) assert.deepEqual(navigateurDe(ua), { famille, appareil }, String(ua));
});

test('page d’origine : le chemin du Referer du même site seulement, sans requête ni fragment, 200 caractères au plus', () => {
  assert.equal(pageDuReferent('https://dev.exemple.fr/classes/?x=1#a', 'dev.exemple.fr'), '/classes/');
  assert.equal(pageDuReferent('https://autre.fr/classes/', 'dev.exemple.fr'), null);
  assert.equal(pageDuReferent('pas une adresse', 'h'), null);
  assert.equal(pageDuReferent('https://h/', undefined), null);
  assert.equal(pageDuReferent(`https://h/${'a'.repeat(400)}`, 'h').length, BALISE.page_max);
});

test('SQL normalisé : sans valeurs (chaînes, nombres, listes), blancs réduits, 200 caractères au plus ; les noms restent', () => {
  assert.equal(normaliserSql("SELECT * FROM metier WHERE id = 'l''elfe' AND n > 3.5"), 'SELECT * FROM metier WHERE id = ? AND n > ?');
  assert.equal(normaliserSql('SELECT h0, h12, "t2"."c3" FROM t\n\n  WHERE x IN (1, 2, 3) -- note\n'), 'SELECT h0, h12, "t2"."c3" FROM t WHERE x IN (?…)');
  assert.equal(normaliserSql('UPDATE t SET a = ? WHERE b IN (?, ?, ?)'), 'UPDATE t SET a = ? WHERE b IN (?…)');
  const long = normaliserSql(`SELECT ${'colonne, '.repeat(60)} x FROM t`);
  assert.equal(long.length, 200);
  assert.ok(long.endsWith('…'));
});

test('mesure SQL : l’enveloppe ne change rien (résultats, exceptions, propriétés, identité stable) ; elle ne compte que pendant une requête', () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO t (nom) VALUES ('a'), ('b'), ('c')");
  const sql = creerMesureSql();
  const e = sql.envelopper(db);
  assert.equal(sql.envelopper(db), e, 'même enveloppe : les caches indexés par la base la reconnaissent');
  assert.equal(sql.envelopper(null), null);
  const caches = new WeakMap([[e, 'vu']]);
  assert.equal(caches.get(sql.envelopper(db)), 'vu');
  assert.deepEqual(e.prepare('SELECT * FROM t ORDER BY id').all(), db.prepare('SELECT * FROM t ORDER BY id').all());
  assert.equal(sql.terminer(), null, 'hors d’une requête : rien de compté');
  sql.debuter();
  const instruction = e.prepare('SELECT nom FROM t WHERE id = ?');
  assert.equal(instruction.get(2).nom, 'b');
  assert.deepEqual(instruction.columns().map((c) => c.column), ['nom']);
  assert.equal(instruction.sourceSQL, 'SELECT nom FROM t WHERE id = ?');
  assert.equal(e.prepare("INSERT INTO t (nom) VALUES ('d')").run().changes, 1);
  e.exec("UPDATE t SET nom = 'z' WHERE id = 4");
  assert.equal([...e.prepare('SELECT id FROM t').iterate()].length, 4);
  assert.throws(() => e.prepare('SELECT * FROM absente'), (err) => /no such table: absente/.test(err.message));
  assert.throws(() => e.exec('INSERT INTO t (id) VALUES (1)'), /UNIQUE constraint failed/);
  if ('isOpen' in db) assert.equal(e.isOpen, true);
  const m = sql.terminer();
  assert.equal(m.n, 5, 'get, run, exec, iterate, et l’exec en échec');
  assert.ok(m.ms >= 0);
  assert.ok(m.plus_lente && !/'/.test(m.plus_lente.sql), JSON.stringify(m.plus_lente));
  assert.equal(sql.terminer(), null);
  db.close();
});

test('empreinte d’une pile : la même pour la même erreur au même endroit, sans numéros de ligne', () => {
  const lancer = (message) => {
    try {
      throw new TypeError(message);
    } catch (e) {
      return e;
    }
  };
  const a = empreinteDePile(lancer('un'));
  const b = empreinteDePile(lancer('deux'));
  assert.match(a.empreinte, /^[0-9a-f]{12}$/);
  assert.equal(a.empreinte, b.empreinte, 'le message ne compte pas');
  assert.equal(a.nom, 'TypeError');
  assert.ok(!/\d+:\d+/.test(a.origine ?? ''), a.origine);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Collecte, versement, lecture
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('instance : « dev » avec l’édition, « prod » sans, MAVERICK_INSTANCE si valable ; un fichier par instance, en WAL et auto_vacuum incrémental', () => {
  assert.equal(instanceDuService({ edition: true }), 'dev');
  assert.equal(instanceDuService({ edition: false }), 'prod');
  assert.equal(instanceDuService({ edition: false, instance: 'Essai' }), 'essai');
  assert.equal(instanceDuService({ edition: true, instance: '../x' }), 'dev', 'nom invalide : ignoré');
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0 });
  m.arreter();
  const db = new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
  assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  assert.equal(db.prepare('PRAGMA auto_vacuum').get().auto_vacuum, 2, 'INCREMENTAL');
  assert.equal(db.prepare("SELECT valeur FROM meta WHERE cle = 'instance'").get().valeur, 'prod');
  db.close();
  assert.throws(() => creerMetriques({ dossier, instance: 'a b', intervalle: 0 }), /invalide/);
});

test('collecte : agrégats en mémoire, versés en une transaction ; rien de personnel (ni requête, ni identifiant de fiche, ni User-Agent)', () => {
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0, memoireRequetes: 100 });
  try {
    requete(m, { adresse: '/api/personnages/Mon-Elfe/?secret=1', entetes: { referer: 'http://site/fiche/?id=Mon-Elfe', cookie: 'c=1', authorization: 'Basic x' } });
    requete(m, { adresse: '/api/v1/metiers/forgeron/?q=jean', methode: 'PATCH', statut: 409 });
    requete(m, { adresse: '/api/v1/metiers/tanneur/', duree: 30 });
    const brute = m.requetes({}).requetes;
    assert.equal(brute.length, 3);
    assert.equal(brute[2].adresse, '/api/personnages/{id}/', 'jamais l’identifiant d’une fiche');
    assert.equal(brute[2].page, '/fiche/');
    assert.equal(brute[1].adresse, '/api/v1/metiers/forgeron/', 'le chemin seul');
    assert.deepEqual([brute[0].navigateur, brute[0].appareil], ['Chrome', 'ordinateur']);
    assert.equal(m.etat().en_attente > 0, true);
    assert.equal(m.verser(), true);
    assert.equal(m.etat().en_attente, 0);
    const db = new DatabaseSync(join(dossier, 'dev.db'), { readOnly: true });
    const routes = db.prepare('SELECT route, methode, n, erreurs_4xx FROM agregat_heure ORDER BY route, methode').all().map((l) => ({ ...l }));
    assert.deepEqual(routes, [
      { route: '/api/personnages/{id}/', methode: 'GET', n: 1, erreurs_4xx: 0 },
      { route: '/api/v1/metiers/{cle}/', methode: 'GET', n: 1, erreurs_4xx: 0 },
      { route: '/api/v1/metiers/{cle}/', methode: 'PATCH', n: 1, erreurs_4xx: 1 },
    ]);
    const tout = JSON.stringify(Object.fromEntries(['agregat_heure', 'agregat_5min', 'origine_heure', 'navigateur_heure', 'evenement', 'requete_brute']
      .map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()])));
    for (const interdit of ['Mon-Elfe', 'secret', 'jean', 'forgeron', 'Basic', 'c=1', 'Mozilla', 'Windows']) assert.ok(!tout.includes(interdit), interdit);
    assert.equal(db.prepare('SELECT count(*) AS n FROM requete_brute').get().n, 0, 'requêtes brutes : jamais persistées par défaut');
    db.close();
    // un second versement s'ajoute (upsert) ; rien n'est compté deux fois
    requete(m, { adresse: '/api/v1/metiers/tanneur/' });
    m.verser();
    assert.equal(m.lire({ periode: '24h' }).routes.find((r) => r.route === '/api/v1/metiers/{cle}/' && r.methode === 'GET').n, 2);
  } finally {
    m.arreter();
  }
});

test('requêtes brutes : persistées 30 jours seulement avec MAVERICK_METRIQUES_BRUTES=1 ; la mémoire des requêtes (site de dev) les filtre', () => {
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0, memoireRequetes: 5, brutes: true });
  try {
    for (let i = 0; i < 8; i++) requete(m, { adresse: `/api/v1/metiers/m${i}/`, statut: i % 2 ? 404 : 200, duree: i * 10 });
    requete(m, { adresse: '/api/maintenance/', statut: 200 });
    const r = m.requetes({});
    assert.equal(r.requetes.length, 5, 'capacité');
    assert.ok(!r.requetes.some((q) => q.route === '/api/maintenance/'), 'les relèves ne sont pas gardées une à une');
    // les cinq dernières : m3 à m7 (404, 200, 404, 200, 404)
    assert.deepEqual(m.requetes({ statut: '4xx' }).requetes.map((q) => q.statut), [404, 404, 404]);
    assert.deepEqual(m.requetes({ statut: '200' }).requetes.length, 2);
    assert.ok(m.requetes({ min_ms: 60 }).requetes.every((q) => q.duree_ms >= 60));
    assert.equal(m.requetes({ route: 'maintenance' }).requetes.length, 0);
    assert.equal(m.requetes({ limite: 2 }).requetes.length, 2);
    assert.throws(() => m.requetes({ statut: 'abc' }), /Statut/);
    m.verser();
    const db = new DatabaseSync(join(dossier, 'dev.db'), { readOnly: true });
    assert.equal(db.prepare('SELECT count(*) AS n FROM requete_brute').get().n, 9);
    assert.ok(!JSON.stringify(db.prepare('SELECT * FROM requete_brute').all()).includes('/m3/'), 'la route, pas l’adresse');
    db.close();
  } finally {
    m.arreter();
  }
});

test('lecture : périodes, tris, série (pas de 5 min, heure, jour), instances ; paramètres invalides : 400', () => {
  let t = Date.parse('2026-06-10T12:34:00Z');
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    requete(m, { adresse: '/api/etat/', duree: 5 });
    requete(m, { adresse: '/api/v1/metiers/', duree: 50 });
    requete(m, { adresse: '/api/v1/metiers/', duree: 70, statut: 500 });
    t -= 2 * 3600_000;
    requete(m, { adresse: '/api/personnages/', duree: 500 });
    t += 2 * 3600_000;
    const h = m.lire({ periode: '1h' });
    assert.equal(h.pas, '5min');
    assert.equal(h.serie.length, 12);
    assert.equal(h.depuis, '2026-06-10T11:35:00Z');
    assert.equal(h.global.n, 3, 'la requête d’il y a deux heures n’est pas dans « 1h »');
    const j = m.lire({ periode: '24h', tri: 'moyenne' });
    assert.equal(j.pas, 'heure');
    assert.equal(j.serie.length, 24);
    assert.equal(j.global.n, 4);
    assert.deepEqual(j.routes.map((r) => r.route), ['/api/personnages/', '/api/v1/metiers/', '/api/etat/']);
    assert.equal(m.lire({ periode: '24h', tri: 'erreurs' }).routes[0].route, '/api/v1/metiers/');
    assert.equal(m.lire({ periode: '24h', tri: 'n' }).routes[0].route, '/api/v1/metiers/');
    assert.equal(m.lire({ periode: '30j' }).pas, 'jour');
    assert.equal(m.lire({ periode: '30j' }).serie.length, 30);
    assert.equal(m.lire({ periode: 'tout' }).serie.length, 1);
    assert.deepEqual(m.lire({}).instances, ['dev']);
    assert.throws(() => m.lire({ periode: '2h' }), (e) => e.statut === 400);
    assert.throws(() => m.lire({ tri: 'x' }), (e) => e.statut === 400);
    assert.throws(() => m.lire({ instance: '../prod' }), (e) => e.statut === 400);
    assert.throws(() => m.lire({ instance: 'prod' }), (e) => e.statut === 404, 'instance sans fichier');
  } finally {
    m.arreter();
  }
});

test('deux jeux de données séparés : chaque instance n’écrit que son fichier ; le site de dev lit celui de la production en LECTURE SEULE', () => {
  const dossier = dossierNeuf();
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0 });
  requete(prod, { adresse: '/api/personnages/', duree: 12 });
  prod.recevoirPage({ page: '/classes/', charge_ms: 300 }, {});
  prod.evenement('demarrage', { detail: { version: '0.3.2', node: 'v22' } });
  prod.echantillonner();
  prod.arreter();
  const empreinte = () => createHash('sha256').update(readFileSync(join(dossier, 'prod.db'))).digest('hex');
  const avant = { empreinte: empreinte(), mtime: statSync(join(dossier, 'prod.db')).mtimeMs };
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0 });
  try {
    requete(dev, { adresse: '/api/v1/metiers/' });
    const l = dev.lire({ instance: 'prod', periode: '24h' });
    assert.equal(l.instance, 'prod');
    assert.deepEqual(l.instances, ['dev', 'prod']);
    assert.deepEqual(l.routes.map((r) => r.route), ['/api/personnages/'], 'jamais mélangées');
    assert.deepEqual(l.pages.map((p) => [p.page, p.n, p.charge_ms]), [['/classes/', 1, 300]]);
    assert.deepEqual(dev.lire({ periode: '24h' }).routes.map((r) => r.route), ['/api/v1/metiers/']);
    const s = dev.systeme({ instance: 'prod' });
    assert.equal(s.processus.version, '0.3.2');
    assert.ok(s.echantillons.length >= 1);
    assert.equal(s.evenements[0].type, 'arret' === s.evenements[0].type ? 'arret' : 'demarrage');
    dev.exporter({ instance: 'prod' });
    dev.verser();
    assert.deepEqual({ empreinte: empreinte(), mtime: statSync(join(dossier, 'prod.db')).mtimeMs }, avant, 'le fichier de la production n’est pas touché');
    const lecture = new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
    assert.equal(lecture.prepare("SELECT count(*) AS n FROM agregat_heure WHERE route = '/api/v1/metiers/'").get().n, 0);
    lecture.close();
  } finally {
    dev.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Rétention, purge
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('rétention (horloge injectée) : agrégats 400 jours, 5 min 2 jours, échantillons 14 jours puis résumés par heure, évènements 400 jours, brutes 30 jours', () => {
  const T0 = Date.parse('2025-01-01T10:15:00Z');
  let t = T0;
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t, brutes: true });
  const db = () => new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
  const compte = (table) => {
    const d = db();
    try {
      return d.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
    } finally {
      d.close();
    }
  };
  try {
    const ecrire = () => {
      requete(m, { adresse: '/api/etat/' });
      m.recevoirPage({ page: '/', charge_ms: 100 }, { 'user-agent': CHROME });
      m.evenement('essai', { detail: { t } });
      m.echantillonner();
      assert.equal(m.verser(), true);
    };
    ecrire(); // T0 : 401 jours avant la purge
    t = T0 + (401 - 40) * JOUR;
    ecrire(); // 40 jours avant la purge
    t = T0 + (401 - 15) * JOUR;
    ecrire(); // 15 jours avant la purge
    t = T0 + (401 - 1) * JOUR;
    ecrire(); // la veille
    t = T0 + 401 * JOUR + 3600_000;
    assert.deepEqual(['agregat_heure', 'agregat_5min', 'systeme_minute', 'evenement', 'requete_brute', 'page_heure'].map(compte), [4, 4, 4, 4, 4, 4]);
    const r = m.purger();
    assert.ok(r, 'purge faite');
    assert.equal(m.verser(), true, 'l’évènement de la purge');
    assert.equal(compte('agregat_heure'), 3, '400 jours : 40 jours, 15 jours et la veille');
    assert.equal(compte('page_heure'), 3);
    assert.equal(compte('navigateur_heure'), 3);
    assert.equal(compte('origine_heure'), 0, 'aucune page d’origine dans ces requêtes');
    assert.equal(compte('agregat_5min'), 1, '2 jours : la veille seulement');
    assert.equal(compte('systeme_minute'), 1, '14 jours : la veille seulement');
    assert.equal(compte('systeme_heure'), 2, 'les échantillons d’il y a 40 et 15 jours résumés par heure ; ceux d’il y a 401 jours, hors des 400 jours');
    assert.equal(compte('evenement'), 4, 'les trois récents et l’évènement de la purge');
    assert.equal(compte('requete_brute'), 2, '30 jours : 15 jours et la veille (pas 40 jours)');
    const d = db();
    assert.equal(Number(d.prepare("SELECT valeur FROM meta WHERE cle = 'derniere_purge_ms'").get().valeur), t);
    assert.equal(d.prepare("SELECT type FROM evenement ORDER BY id DESC LIMIT 1").get().type, 'purge_metriques');
    assert.equal(d.prepare('PRAGMA freelist_count').get().freelist_count, 0, 'VACUUM incrémental : les pages libérées sont rendues');
    d.close();
    assert.equal(r.lignes.agregat_heure, 1);
    // la purge suivante n'a lieu qu'un jour plus tard (minute())
    requete(m, { adresse: '/api/etat/' });
    t += 23 * 3600_000;
    m.minute();
    assert.equal(compte('evenement'), 4, 'pas encore');
    t += 2 * 3600_000;
    m.minute();
    assert.equal(compte('evenement'), 5, 'une purge par jour');
    // les rétentions publiées
    assert.deepEqual({ ...RETENTION }, {
      agregats_heure: 400, agregats_5min: 2, pages: 400, navigateurs: 400, origines: 400, echantillons_minute: 14, echantillons_heure: 400, repartition_10min: 14,
      repartition_jour: 400, evenements: 400, requetes_brutes: 30,
    });
  } finally {
    m.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Pannes
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('panne : dossier impossible (un fichier à sa place) — ni exception, notée une fois, la collecte continue en mémoire et se relit', () => {
  const fichier = join(racine, 'pas-un-dossier');
  writeFileSync(fichier, 'x');
  const notees = [];
  const m = creerMetriques({ dossier: fichier, instance: 'prod', intervalle: 0, journal: (l) => notees.push(l) });
  try {
    requete(m, { adresse: '/api/etat/', duree: 3 });
    m.recevoirPage({ page: '/', dom_ms: 20 }, {});
    m.evenement('essai', {});
    m.echantillonner();
    assert.equal(m.verser(), false);
    assert.equal(m.verser(), false);
    m.minute();
    assert.equal(notees.length, 1, notees.join('\n'));
    assert.match(notees[0], /^ERREUR métriques : .*la collecte continue en mémoire/);
    const l = m.lire({ periode: '24h' });
    assert.equal(l.global.n, 1, 'lu dans la mémoire');
    assert.equal(l.pages[0].dom_ms, 20);
    assert.ok(l.panne);
    const s = m.systeme({});
    assert.ok(s.alertes.some((a) => a.niveau === 'erreur' && /panne/.test(a.message)));
    assert.equal(s.evenements.length, 1);
    assert.equal(m.purger(), null);
    assert.equal(m.exporter({ format: 'json' }).contenu.includes('/api/etat/'), true);
  } finally {
    m.arreter();
  }
});

test('panne : base verrouillée par un autre — le versement échoue sans bloquer, puis reprend sans rien perdre ni compter deux fois', () => {
  const dossier = dossierNeuf();
  const notees = [];
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0, journal: (l) => notees.push(l) });
  try {
    requete(m, { adresse: '/api/etat/' });
    assert.equal(m.verser(), true);
    const autre = new DatabaseSync(join(dossier, 'dev.db'));
    autre.exec('PRAGMA busy_timeout = 0');
    autre.exec('BEGIN IMMEDIATE');
    requete(m, { adresse: '/api/etat/' });
    requete(m, { adresse: '/api/etat/' });
    const t0 = performance.now();
    assert.equal(m.verser(), false);
    assert.ok(performance.now() - t0 < 2000, 'busy_timeout court');
    assert.equal(m.lire({ periode: '1h' }).global.n, 3, 'base + mémoire, sans double compte');
    autre.exec('ROLLBACK');
    autre.close();
    assert.equal(m.verser(), true);
    assert.equal(m.etat().panne, null);
    assert.equal(m.lire({ periode: '1h' }).global.n, 3);
    assert.equal(notees.filter((l) => l.startsWith('ERREUR métriques')).length, 1);
    assert.ok(notees.some((l) => /de nouveau disponible/.test(l)) || m.etat().panne === null);
  } finally {
    m.arreter();
  }
});

test('évènements : durée et détail gardés ; une même erreur 5xx au plus une fois par minute (les suivantes comptées)', () => {
  let t = Date.parse('2026-03-01T00:00:00Z');
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    const erreur = { empreinte: 'abc', route: '/api/etat/', statut: 500 };
    assert.equal(m.evenement('erreur_5xx', { detail: erreur }), true);
    assert.equal(m.evenement('erreur_5xx', { detail: erreur }), false);
    assert.equal(m.evenement('erreur_5xx', { detail: erreur }), false);
    assert.equal(m.evenement('erreur_5xx', { detail: { ...erreur, empreinte: 'autre' } }), true);
    t += 61_000;
    assert.equal(m.evenement('erreur_5xx', { detail: erreur }), true);
    m.evenement('lot_edition', { duree_ms: 12.345, detail: { lot: 'x', operations: 2 } });
    const ev = m.systeme({ periode: '24h' }).evenements;
    assert.deepEqual(ev[0], { instant: '2026-03-01T00:01:01Z', type: 'lot_edition', duree_ms: 12.35, detail: { lot: 'x', operations: 2 } });
    assert.deepEqual(ev[1].detail, { ...erreur, repetitions_omises: 2 });
    assert.equal(ev.length, 4);
  } finally {
    m.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Balise des pages vues
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('balise des pages : valeurs bornées, chemin du site seulement, débit limité, cardinalité bornée ; fermée : 403', () => {
  let t = Date.parse('2026-03-01T10:00:00Z');
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0, horloge: () => t });
  try {
    assert.deepEqual(m.recevoirPage({ page: '/classes/?x=1', ttfb_ms: 10, dom_ms: 20, charge_ms: 30, lcp_ms: 40, autre: 1 }, {}).mesures, { ttfb: 10, dom: 20, charge: 30, lcp: 40 });
    for (const mauvais of [null, [], 'x', { page: 'classes', charge_ms: 1 }, { page: '//autre.fr/', charge_ms: 1 }, { page: '/a b/', charge_ms: 1 },
      { page: `/${'a'.repeat(250)}`, charge_ms: 1 }, { page: '/', charge_ms: -1 }, { page: '/', charge_ms: 120_001 }, { page: '/', charge_ms: '3' },
      { page: '/', charge_ms: Number.NaN }, { page: '/' }]) {
      assert.throws(() => m.recevoirPage(mauvais, {}), (e) => e.statut === 400, JSON.stringify(mauvais));
    }
    for (let i = 1; i < BALISE.par_minute; i++) m.recevoirPage({ page: `/p${i % 3}/`, charge_ms: i }, {});
    assert.throws(() => m.recevoirPage({ page: '/', charge_ms: 1 }, {}), (e) => e.statut === 429);
    t += 60_000;
    m.recevoirPage({ page: '/', charge_ms: 1 }, {});
    // cardinalité : au-delà de PAGES_PAR_HEURE pages distinctes dans l'heure, « {autres} »
    for (let i = 0; i < PAGES_PAR_HEURE + 5; i++) {
      if (i % (BALISE.par_minute - 1) === 0) t += 60_000;
      m.recevoirPage({ page: `/distincte-${i}/`, charge_ms: 1 }, {});
    }
    const pages = m.lire({ periode: '24h' }).pages;
    assert.ok(pages.some((p) => p.page === '{autres}'));
    assert.ok(new Set(pages.map((p) => p.page)).size <= PAGES_PAR_HEURE + 1);
  } finally {
    m.arreter();
  }
  const fermee = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0, pages: false });
  try {
    assert.equal(fermee.pagesOuvertes, false);
    assert.throws(() => fermee.recevoirPage({ page: '/', charge_ms: 1 }, {}), (e) => e.statut === 403);
  } finally {
    fermee.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Système, volume, alertes, export
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('état du système : processus, disque, fichiers mesurés, échantillons, volume (taille, croissance, taille à terme, rétention)', () => {
  const dossier = dossierNeuf();
  const db = join(racine, `vivante-${compteur}`);
  writeFileSync(`${db}.db`, Buffer.alloc(4096));
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0, identite: { version: '0.3.2', code: 'abc' }, fichiers: { vivante: `${db}.db`, disque: racine } });
  try {
    for (let i = 0; i < 30; i++) requete(m, { adresse: `/api/v1/metiers/m${i}/` });
    m.echantillonner();
    const s = m.systeme({});
    assert.deepEqual(Object.keys(s), ['instance', 'instances', 'maintenant', 'periode', 'processus', 'disque', 'fichiers', 'echantillons', 'evenements', 'volume', 'alertes', 'panne', 'perdues']);
    for (const c of ['version', 'code', 'node', 'pid', 'depuis', 'duree_s', 'rss', 'tas_utilise', 'tas_total', 'externe', 'cpu_utilisateur_pct', 'cpu_systeme_pct',
      'boucle_p50_ms', 'boucle_p99_ms', 'boucle_max_ms', 'charge']) assert.ok(c in s.processus, c);
    assert.equal(s.processus.version, '0.3.2');
    assert.equal(s.processus.charge.length, 3);
    for (const c of ['dossier', 'libre', 'total', 'utilise', 'part_libre']) assert.ok(c in s.disque, c);
    assert.ok(s.disque.total > 0);
    assert.deepEqual(s.fichiers.find((f) => f.nom === 'base vivante')?.octets, 4096);
    assert.ok(s.fichiers.some((f) => f.nom === 'métriques dev' && f.octets > 0));
    assert.equal(s.echantillons.length, 1);
    assert.deepEqual(Object.keys(s.echantillons[0]).slice(0, 6), ['instant', 'rss', 'tas_utilise', 'boucle_p99_ms', 'cpu_pct', 'disque_libre']);
    assert.equal(s.echantillons[0].requetes, 30);
    assert.ok(s.volume.metriques_octets > 0);
    assert.ok(s.volume.croissance_octets_par_jour > 0);
    assert.ok(s.volume.taille_a_terme_octets > 0);
    assert.equal(s.volume.lignes_par_jour.systeme_minute, 1440);
    assert.deepEqual(s.volume.retention, RETENTION);
    assert.equal(s.volume.brutes, false);
    assert.equal(s.volume.pages, true);
  } finally {
    m.arreter();
  }
});

test('alertes : disque (10 % ou 2 Gio ; grave sous 5 % ou 1 Gio), base des métriques, archives, boucle, mémoire, 5xx, panne', () => {
  const Gio = 1024 ** 3;
  const niveaux = (o) => alertesDu(o).map((a) => a.niveau);
  assert.deepEqual(alertesDu({}), []);
  assert.deepEqual(niveaux({ disque: { total: 100 * Gio, libre: 50 * Gio, part_libre: 0.5 } }), []);
  assert.deepEqual(niveaux({ disque: { total: 100 * Gio, libre: 8 * Gio, part_libre: 0.08 } }), ['avertissement']);
  assert.deepEqual(niveaux({ disque: { total: 10 * Gio, libre: 1.5 * Gio, part_libre: 0.15 } }), ['avertissement'], 'moins de 2 Gio');
  assert.deepEqual(niveaux({ disque: { total: 100 * Gio, libre: 4 * Gio, part_libre: 0.04 } }), ['erreur']);
  assert.deepEqual(niveaux({ volume: { metriques_octets: SEUILS.base_metriques_octets + 1 } }), ['avertissement']);
  assert.deepEqual(niveaux({ volume: { metriques_octets: 1, taille_a_terme_octets: SEUILS.base_metriques_octets * 2 } }), ['avertissement']);
  assert.deepEqual(niveaux({ croissanceArchives: { octets: 60 * 1024 ** 2, jours: 7, taille: 200 * 1024 ** 2 } }), ['avertissement']);
  assert.deepEqual(niveaux({ processus: { boucle_p99_ms: 150 } }), ['avertissement']);
  assert.deepEqual(niveaux({ processus: { rss: 900, memoire_limite: 1000 } }), ['avertissement']);
  assert.deepEqual(niveaux({ processus: { rss: 500, memoire_limite: 1000 } }), []);
  assert.deepEqual(niveaux({ erreursRecentes: 2 }), ['avertissement']);
  assert.deepEqual(niveaux({ panne: 'disk I/O error' }), ['erreur']);
  assert.deepEqual(niveaux({ brutes: true }), ['info']);
});

test('export : agrégats horaires bruts en CSV ou JSON, avec l’histogramme ; format inconnu : 400', () => {
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0 });
  try {
    requete(m, { adresse: '/api/etat/', duree: 3, sql: { n: 1, ms: 0.5, plus_lente: { sql: 'SELECT "a,b"', ms: 0.5 } } });
    requete(m, { adresse: '/api/etat/', duree: 7 });
    m.verser();
    requete(m, { adresse: '/api/personnages/' });
    const csv = m.exporter({ format: 'csv' });
    assert.equal(csv.type, 'text/csv; charset=utf-8');
    assert.match(csv.nom, /^metriques-dev-tout-\d{4}-\d{2}-\d{2}\.csv$/);
    const lignes = csv.contenu.trim().split('\r\n');
    assert.equal(lignes.length, 3);
    const entete = lignes[0].split(',');
    assert.deepEqual(entete.slice(0, 4), ['debut', 'route', 'methode', 'n']);
    assert.ok(entete.includes('h_le_1ms') && entete.includes('h_plus_5000ms') && entete.includes('p95_ms'));
    assert.ok(lignes.some((l) => l.includes('"SELECT ""a,b"""')), 'cellule échappée');
    const json = JSON.parse(m.exporter({ format: 'json', periode: '24h' }).contenu);
    assert.deepEqual(json.bornes_ms, BORNES_MS);
    assert.equal(json.lignes.find((l) => l.route === '/api/etat/').n, 2);
    assert.throws(() => m.exporter({ format: 'xml' }), (e) => e.statut === 400);
  } finally {
    m.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Surcoût
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('surcoût : 10 000 requêtes simulées coûtent quelques microsecondes chacune, leur versement quelques dizaines de ms ; l’enveloppe SQL presque rien', (t) => {
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, memoireRequetes: 2000 });
  try {
    const routes = RESSOURCES.slice(0, 40).map((r) => `/api/v1/${r.cle}/`);
    const entetes = { host: 'site', referer: 'https://site/classes/', 'user-agent': CHROME };
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) {
      const r = m.debut(i % 7 ? 'GET' : 'POST', `${routes[i % routes.length]}x${i}/?q=${i}`, entetes);
      r.tCorps = performance.now();
      r.tTraite = r.tCorps;
      r.sql = { n: 3, ms: 0.2, plus_lente: { sql: 'SELECT * FROM t WHERE id = ?', ms: 0.1 } };
      m.fin(r, { statut: 200, octets_sortie: 1234 });
    }
    const parRequete = (performance.now() - t0) / 10_000;
    const t1 = performance.now();
    assert.equal(m.verser(), true);
    const versement = performance.now() - t1;
    t.diagnostic(`collecte : ${(parRequete * 1000).toFixed(1)} µs par requête ; versement de 10 000 requêtes (80 routes × méthodes) : ${versement.toFixed(1)} ms`);
    assert.ok(parRequete < 0.2, `${parRequete} ms par requête`);
    assert.ok(versement < 1000, `${versement} ms`);
    assert.equal(m.lire({ periode: '1h' }).global.n, 10_000);
  } finally {
    m.arreter();
  }
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1000) INSERT INTO t (v) SELECT hex(randomblob(8)) FROM n');
  const sql = creerMesureSql();
  const direct = db.prepare('SELECT v FROM t WHERE id = ?');
  const enveloppee = sql.envelopper(db).prepare('SELECT v FROM t WHERE id = ?');
  const mesurer = (instruction) => {
    const debut = performance.now();
    for (let i = 0; i < 20_000; i++) instruction.get((i % 1000) + 1);
    return (performance.now() - debut) / 20_000;
  };
  mesurer(direct);
  sql.debuter();
  const a = mesurer(direct);
  const b = mesurer(enveloppee);
  sql.terminer();
  t.diagnostic(`requête SQL : ${(a * 1000).toFixed(2)} µs directe, ${(b * 1000).toFixed(2)} µs enveloppée (+${((b - a) * 1000).toFixed(2)} µs)`);
  assert.ok(b - a < 0.02, `surcoût de l’enveloppe : ${(b - a) * 1000} µs`);
  db.close();
});
