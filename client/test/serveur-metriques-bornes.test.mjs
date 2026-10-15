// Bornes et justesse des métriques du service (client/serveur/metriques.mjs, metriques-sql.mjs ; relecture du 2026-10-15) : quantiles au-delà de la
// dernière classe (jamais tirés vers le maximum) et histogrammes des pages vues à leurs propres bornes (migration du schéma 4), croissance mesurée
// sur la taille LOGIQUE de la base (jamais le WAL) et projections à la rétention, deux échantillons de la même seconde fusionnés, fenêtres de la
// période « 1h » et de l'export, temps SQL d'un parcours `iterate`, global sans les relèves automatiques, adresse sans identifiant de fiche,
// cardinalité bornée (pages du site seulement, couples page × route, refus regroupés, plafond dur de la base), lectures lourdes classées par
// SQLite et gardées une minute, images de la base vivante de l'autre instance.
//   node --test test/serveur-metriques-bornes.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, StatementSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  BORNES_MS, BORNES_PAGE_MS, classeDe, creerMetriques, disqueDe, EXPORT_LIGNES_MAX, LIGNES_LUES_MAX, lireReleveDeLHote, METHODES, ORIGINES_PAR_HEURE, PAGE_AUTRES,
  pageDuSite, pagesDuSite, quantileDetaille, RELEVE_HOTE, ROUTE_INCONNUE, routeGardee, routeNormalisee, SCHEMA_METRIQUES,
} from '../serveur/metriques.mjs';
import { creerMesureSql } from '../serveur/metriques-sql.mjs';
import { RESSOURCES } from '../src/lib/ressources.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-metriques-bornes-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const dossierNeuf = () => join(racine, `m${++compteur}`);
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

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

/** Un site construit factice : une page index.html par chemin donné (« /races/elfe/ »). */
function siteFactice(pages) {
  const site = join(racine, `site-${++compteur}`);
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, 'index.html'), '<!doctype html>');
  for (const p of pages) {
    mkdirSync(join(site, p), { recursive: true });
    writeFileSync(join(site, p, 'index.html'), '<!doctype html>');
  }
  mkdirSync(join(site, '_astro'), { recursive: true });
  writeFileSync(join(site, '_astro', 'piege.html'), 'jamais une page');
  writeFileSync(join(site, '404.html'), '<!doctype html>');
  return site;
}

const lecture = (chemin) => new DatabaseSync(chemin, { readOnly: true });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Quantiles
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('quantiles : une valeur extrême au-delà de 5 s ne fait plus la médiane ni le p95 — borne basse de la dernière classe, marquée « au-delà »', () => {
  const histogramme = (valeurs, bornes = BORNES_MS) => valeurs.reduce((t, v) => { t[classeDe(v, bornes)] += 1; return t; }, new Array(bornes.length + 1).fill(0));
  // A (constat) : 98 requêtes à 6 000 ms et 2 à 60 000 ms — vraies médiane et p95 : 6 000 (avant : 33 000 et 57 300)
  const a = histogramme([...Array(98).fill(6000), 60000, 60000]);
  assert.deepEqual(quantileDetaille(a, 0.5, 6000, 60000), { valeur: 6000, au_dela: true });
  assert.deepEqual(quantileDetaille(a, 0.95, 6000, 60000), { valeur: 6000, au_dela: true });
  assert.ok(quantileDetaille(a, 0.99, 6000, 60000).valeur <= 6000, 'jamais interpolé vers le maximum');
  // le minimum sous la dernière borne : la borne elle-même (« > 5 000 ms »)
  assert.deepEqual(quantileDetaille(histogramme([100, 7000, 9000]), 0.9, 100, 9000), { valeur: 5000, au_dela: true });

  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0 });
  try {
    for (let i = 0; i < 98; i++) requete(m, { adresse: '/api/v1/metiers/', duree: 6000 });
    for (let i = 0; i < 2; i++) requete(m, { adresse: '/api/v1/metiers/', duree: 60000 });
    const r = m.lire({ periode: '1h' }).routes[0];
    assert.ok(r.mediane_ms <= r.moyenne_ms, `médiane ${r.mediane_ms} ≤ moyenne ${r.moyenne_ms}`);
    assert.ok(Math.abs(r.mediane_ms - 6000) < 1 && Math.abs(r.p95_ms - 6000) < 1, `${r.mediane_ms} ${r.p95_ms}`);
    assert.deepEqual(r.au_dela, ['mediane_ms', 'p95_ms', 'p99_ms'], 'la page les écrit « > 6 s »');
    // B (constat) : une page — 89 chargements à 3 000 ms, 10 à 5 500, 1 à 120 000 ; vrai p95 : 5 500 (avant : 67 727)
    for (let i = 0; i < 89; i++) m.recevoirPage({ page: '/fiche/', charge_ms: 3000, lcp_ms: 3000 }, {});
    for (let i = 0; i < 10; i++) m.recevoirPage({ page: '/fiche/', charge_ms: 5500, lcp_ms: 3000 }, {});
    m.recevoirPage({ page: '/fiche/', charge_ms: 120000, lcp_ms: 3000 }, {});
    const p = m.lire({ periode: '24h' }).pages[0];
    assert.ok(p.charge_p95_ms >= 5000 && p.charge_p95_ms <= 7500, `p95 du chargement : ${p.charge_p95_ms} (dans la classe ]5 000, 7 500] de BORNES_PAGE_MS)`);
    assert.equal(p.lcp_p95_ms, 3000, 'toutes à 3 000 ms : la valeur exacte (avant : 4 124, classe ]2 000, 5 000] trop large)');
    assert.deepEqual(p.au_dela, []);
  } finally {
    m.arreter();
  }
  assert.ok(BORNES_PAGE_MS.includes(2500) && BORNES_PAGE_MS.includes(4000), 'les seuils du LCP sont des bornes');
  assert.equal(BORNES_PAGE_MS.at(-1), 60000);
});

test('migration du schéma 4 : les pages vues d’un fichier plus ancien (bornes des requêtes) gardent vues, sommes, min et max ; leurs classes passent aux nouvelles bornes', () => {
  const dossier = dossierNeuf();
  creerMetriques({ dossier, instance: 'prod', intervalle: 0 }).arreter();
  // un fichier du schéma 3 : page_heure aux bornes des requêtes (`<mesure>_h0` à `_h12`)
  const ancien = new DatabaseSync(join(dossier, 'prod.db'));
  const mesures = ['ttfb', 'dom', 'charge', 'lcp'];
  const colonnes = mesures.flatMap((m) => [`${m}_n`, `${m}_somme`, `${m}_somme2`, `${m}_min`, `${m}_max`, ...Array.from({ length: 13 }, (_, i) => `${m}_h${i}`)]);
  ancien.exec(`DROP TABLE page_heure; CREATE TABLE page_heure (debut INTEGER NOT NULL, page TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
    ${colonnes.map((c) => `${c} ${/_(somme2?|min|max)$/.test(c) ? 'REAL' : 'INTEGER'}`).join(', ')}, PRIMARY KEY (debut, page)) STRICT, WITHOUT ROWID;
    PRAGMA user_version = 3;`);
  const valeurs = Object.fromEntries(colonnes.map((c) => [c, /_n$|_h\d+$/.test(c) ? 0 : null]));
  // chargement : 4 dans ]200, 500] (max de la ligne 4 200), 6 dans ]2 000, 5 000] ; TTFB : 3 dans ]5, 10] et 2 dans ]10, 20]
  Object.assign(valeurs, { charge_n: 10, charge_somme: 4 * 300 + 6 * 4000, charge_somme2: 0, charge_min: 300, charge_max: 4200, charge_h8: 4, charge_h11: 6 });
  Object.assign(valeurs, { ttfb_n: 5, ttfb_somme: 50, ttfb_somme2: 0, ttfb_min: 6, ttfb_max: 15, ttfb_h3: 3, ttfb_h4: 2 });
  const debut = Math.floor(Date.now() / 3_600_000) * 3600;
  ancien.prepare(`INSERT INTO page_heure (debut, page, n, ${colonnes.join(', ')}) VALUES (?, ?, ?, ${colonnes.map(() => '?').join(', ')})`)
    .run(debut, '/fiche/', 10, ...colonnes.map((c) => valeurs[c]));
  ancien.close();
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0 });
  try {
    const p = m.lire({ periode: '24h' }).pages[0];
    assert.deepEqual([p.page, p.n, p.charge_n, p.charge_ms, p.ttfb_n, p.ttfb_ms], ['/fiche/', 10, 10, 2520, 5, 10], 'vues, sommes et moyennes exactes');
    assert.ok(p.charge_p95_ms > 4000 && p.charge_p95_ms <= 4200, `p95 dans ]4 000, 4 200] : ${p.charge_p95_ms}`);
    assert.ok(p.ttfb_p95_ms >= 10 && p.ttfb_p95_ms <= 15, `${p.ttfb_p95_ms}`);
  } finally {
    m.arreter();
  }
  const lu = lecture(join(dossier, 'prod.db'));
  try {
    assert.equal(lu.prepare('PRAGMA user_version').get().user_version, SCHEMA_METRIQUES);
    const noms = lu.prepare('PRAGMA table_info(page_heure)').all().map((c) => c.name);
    assert.ok(noms.includes('charge_c21') && !noms.includes('charge_h0'), 'refaite aux nouvelles bornes');
    const l = lu.prepare('SELECT * FROM page_heure').get();
    const classes = (m) => Array.from({ length: BORNES_PAGE_MS.length + 1 }, (_, i) => l[`${m}_c${i}`]);
    assert.equal(classes('charge').reduce((a, b) => a + b, 0), 10, 'aucune mesure perdue');
    assert.equal(l.charge_c6, 4, ']200, 500] → la classe de min(500, max) : ]300, 500]');
    assert.equal(l.charge_c14, 6, ']2 000, 5 000] → la classe de min(5 000, 4 200) : ]4 000, 5 000]');
    assert.deepEqual([l.ttfb_c0, l.ttfb_c1], [3, 2], 'les classes contenues dans une nouvelle y vont telles quelles');
    for (const c of ['systeme_minute.taille_logique', 'systeme_heure.taille_logique_max', 'disque_repartition.images_base']) {
      const [table, colonne] = c.split('.');
      assert.ok(lu.prepare(`PRAGMA table_info(${table})`).all().some((x) => x.name === colonne), c);
    }
  } finally {
    lu.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Volume : croissance et projections
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('croissance mesurée sur la taille LOGIQUE (jamais le WAL, qui va de 0 à ~4 Mio) ; retenue seulement sur 7 jours et à moins d’un facteur 2 de l’estimée', () => {
  const dossier = dossierNeuf();
  const T = Date.parse('2026-06-20T12:00:00Z');
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => T });
  requete(prod, { adresse: '/api/etat/' });
  prod.echantillonner();
  prod.arreter();
  const db = new DatabaseSync(join(dossier, 'prod.db'));
  const s = T / 1000;
  // la vraie taille grossit de 100 000 octets par jour ; le WAL, lui, était plein il y a 8 jours (6 Mio) et vient d'être vidé (2 Mio)
  db.prepare('INSERT INTO systeme_minute (instant, taille_metriques, taille_logique) VALUES (?, ?, ?)').run(s - 8 * 86_400, 6 * 1024 ** 2, 1_000_000);
  db.prepare('INSERT OR REPLACE INTO systeme_minute (instant, taille_metriques, taille_logique) VALUES (?, ?, ?)').run(s, 2 * 1024 ** 2, 1_800_000);
  db.close();
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => T });
  try {
    const v = dev.systeme({ instance: 'prod' }).volume;
    assert.equal(v.croissance_mesuree_octets_par_jour, 100_000, 'la taille logique, pas fichier + WAL (qui donnerait une croissance négative)');
    assert.equal(v.croissance_mesuree_jours, 8);
    const accord = v.croissance_mesuree_octets_par_jour >= v.croissance_estimee_octets_par_jour / 2 && v.croissance_mesuree_octets_par_jour <= v.croissance_estimee_octets_par_jour * 2;
    assert.equal(v.croissance_octets_par_jour, accord ? 100_000 : v.croissance_estimee_octets_par_jour);
    assert.equal(v.croissance_source, accord ? 'mesuree' : 'estimee');
    assert.ok(v.croissance_octets_par_jour >= 0);
    // projections : à la rétention de chaque table, jamais taille + débit × 365 (le débit compte ce que la rétention purge vite)
    assert.ok(v.debit_ecriture_octets_par_jour > v.croissance_estimee_octets_par_jour, 'le débit brut compte les échantillons par minute');
    assert.ok(v.projection_un_an_octets > 0 && v.projection_un_an_octets <= v.taille_a_terme_octets);
    assert.ok(v.projection_un_an_octets < v.metriques_octets + v.debit_ecriture_octets_par_jour * 365);
    assert.equal(v.taille_logique_octets, 1_800_000, 'la dernière taille logique notée');
  } finally {
    dev.arreter();
  }
  // moins de 7 jours de mesures : l'estimée seule
  const court = dossierNeuf();
  creerMetriques({ dossier: court, instance: 'prod', intervalle: 0, horloge: () => T }).arreter();
  const db2 = new DatabaseSync(join(court, 'prod.db'));
  db2.prepare('INSERT INTO systeme_minute (instant, taille_metriques, taille_logique) VALUES (?, ?, ?)').run(s - 3 * 86_400, 4 * 1024 ** 2, 500_000);
  db2.prepare('INSERT OR REPLACE INTO systeme_minute (instant, taille_metriques, taille_logique) VALUES (?, ?, ?)').run(s, 1024 ** 2, 900_000);
  db2.close();
  const dev2 = creerMetriques({ dossier: court, instance: 'dev', intervalle: 0, horloge: () => T });
  try {
    const v = dev2.systeme({ instance: 'prod' }).volume;
    assert.equal(v.croissance_mesuree_octets_par_jour, null, 'pas avant 7 jours');
    assert.equal(v.croissance_source, 'estimee');
    assert.equal(v.croissance_octets_par_jour, v.croissance_estimee_octets_par_jour);
  } finally {
    dev2.arreter();
  }
});

test('échantillon par minute : la taille logique de la base est notée (sans le WAL)', () => {
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'dev', intervalle: 0 });
  try {
    for (let i = 0; i < 50; i++) requete(m, { adresse: `/api/v1/metiers/m${i}/` });
    m.verser();
    const e = m.echantillonner();
    assert.ok(e.taille_logique > 0, 'notée');
    m.verser();
    const s = m.systeme({});
    assert.ok(s.volume.taille_logique_octets > 0);
  } finally {
    m.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Échantillons, fenêtres de lecture, export
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('deux échantillons de la même seconde (arrêt juste après la minute) : fusionnés — ni requête ni 5xx perdue, l’alerte de la dernière heure les voit', () => {
  const dossier = dossierNeuf();
  let t = Date.parse('2026-10-15T10:30:00.100Z');
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t });
  for (let i = 0; i < 7; i++) requete(prod, { adresse: '/api/personnages/' });
  requete(prod, { adresse: '/api/personnages/', statut: 503 });
  prod.minute();
  t += 400; // la même seconde
  requete(prod, { adresse: '/api/personnages/' });
  prod.arreter();
  const lu = lecture(join(dossier, 'prod.db'));
  try {
    const lignes = lu.prepare('SELECT instant, requetes, erreurs_5xx, simultanees_max FROM systeme_minute').all().map((l) => ({ ...l }));
    assert.deepEqual(lignes, [{ instant: Math.floor(t / 1000), requetes: 9, erreurs_5xx: 1, simultanees_max: 1 }]);
    assert.equal(lu.prepare('SELECT sum(n) AS n FROM agregat_heure').get().n, 9);
  } finally {
    lu.close();
  }
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    const alertes = dev.systeme({ instance: 'prod' }).alertes.map((a) => a.message);
    assert.ok(alertes.some((a) => /1 réponse\(s\) 5xx dans la dernière heure/.test(a)), alertes.join(' | '));
  } finally {
    dev.arreter();
  }
});

test('période « 1h » : pages vues, navigateurs et origines (par heure) disent leur fenêtre — `depuis_horaire` ; l’export a la MÊME fenêtre que la page', () => {
  let t = Date.parse('2026-10-15T09:01:00Z');
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    for (let i = 0; i < 50; i++) requete(m, { adresse: '/api/personnages/', entetes: { referer: 'http://site/fiche/' } });
    t = Date.parse('2026-10-15T10:04:00Z');
    for (let i = 0; i < 3; i++) requete(m, { adresse: '/api/personnages/', entetes: { referer: 'http://site/fiche/' } });
    const l = m.lire({ periode: '1h' });
    assert.equal(l.depuis, '2026-10-15T09:05:00Z');
    assert.equal(l.depuis_horaire, '2026-10-15T09:00:00Z', 'la fenêtre réelle des listes horaires');
    assert.equal(l.global.n, 3);
    assert.equal(l.navigateurs[0].n, 53, 'comptés depuis 09:00 : la page le dit (noteDeFenetreHoraire)');
    assert.equal(m.lire({ periode: '24h' }).depuis_horaire, m.lire({ periode: '24h' }).depuis, 'même fenêtre ailleurs');
  } finally {
    m.arreter();
  }
  // l'export : la fenêtre de lire() (bornes), par tranches de 5 minutes pour « 1h »
  t = Date.parse('2026-06-10T09:05:00Z');
  const e = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    for (const minute of [5, 15, 25, 45, 55]) {
      t = Date.parse(`2026-06-10T09:${String(minute).padStart(2, '0')}:00Z`);
      requete(e, { adresse: '/api/etat/' });
    }
    for (const minute of [0, 1, 3]) {
      t = Date.parse(`2026-06-10T10:0${minute}:00Z`);
      requete(e, { adresse: '/api/etat/' });
    }
    t = Date.parse('2026-06-10T10:04:00Z');
    e.verser();
    const page = e.lire({ periode: '1h' });
    const json = JSON.parse(e.exporter({ periode: '1h', format: 'json' }).contenu);
    assert.equal(page.global.n, 8);
    assert.equal(json.lignes.reduce((n, x) => n + x.n, 0), page.global.n, 'les 5 requêtes de 9 h 05 à 9 h 55 y sont');
    assert.deepEqual([json.depuis, json.pas], [page.depuis, '5min']);
    // « 30j » : à partir du début d'un jour, comme la page
    t = Date.parse('2026-05-11T15:00:00Z');
    requete(e, { adresse: '/api/etat/' });
    t = Date.parse('2026-06-10T10:04:00Z');
    e.verser();
    const trente = e.lire({ periode: '30j' });
    const export30 = JSON.parse(e.exporter({ periode: '30j', format: 'json' }).contenu);
    assert.equal(export30.depuis, trente.depuis);
    assert.equal(export30.lignes.reduce((n, x) => n + x.n, 0), trente.global.n, 'la requête du 11 mai à 15 h n’est ni dans l’un ni dans l’autre');
    assert.equal(export30.tronque, false);
    assert.ok(EXPORT_LIGNES_MAX >= 10_000);
  } finally {
    e.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// SQL : iterate
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('mesure SQL : un parcours `iterate()` (paresseux : SQLite s’exécute aux next()) compte tout son temps — une seule requête, la plus lente comparée à la fin', () => {
  let horloge = 0;
  const mesure = creerMesureSql({ maintenant: () => (horloge += 1) });
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (x INTEGER); INSERT INTO t VALUES (1), (2), (3), (4), (5);');
  const e = mesure.envelopper(db);
  mesure.debuter();
  let somme = 0;
  for (const l of e.prepare('SELECT x FROM t').iterate()) somme += l.x;
  const r = mesure.terminer();
  assert.equal(somme, 15, 'mêmes résultats');
  // préparation (1) + création de l'itérateur (1) + six next() (cinq lignes et la fin) — avant : 2
  assert.equal(r.ms, 8);
  assert.equal(r.n, 1, 'une exécution');
  assert.deepEqual(r.plus_lente, { sql: 'SELECT x FROM t', ms: 7 });
  // interrompu (break : return()), et les aides des itérateurs (toArray) : comptés aussi
  mesure.debuter();
  for (const l of e.prepare('SELECT x FROM t').iterate()) if (l.x) break;
  assert.equal(mesure.terminer().ms, 4);
  mesure.debuter();
  assert.equal(e.prepare('SELECT x FROM t').iterate().toArray().length, 5);
  assert.equal(mesure.terminer().ms, 8);
  // hors d'une mesure : rien n'est compté, l'itérateur est le vrai
  assert.deepEqual([...e.prepare('SELECT x FROM t WHERE x > 3').iterate()].map((l) => l.x), [4, 5]);
  db.close();
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Global et série sans les relèves ; adresse sans identifiant
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('global et série SANS les relèves automatiques (journal et version de la base toutes les 2 s, métriques, système, maintenance, balise) ; chacune garde sa ligne', () => {
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0 });
  try {
    for (let i = 0; i < 60; i++) requete(m, { adresse: `/api/v1/metiers/m${i}/`, duree: 80 });
    for (let i = 0; i < 10; i++) requete(m, { adresse: `/api/v1/metiers/m${i}/`, methode: 'PATCH', duree: 300 });
    // une heure de page Debug ouverte, et une page ordinaire qui relève la maintenance
    for (let i = 0; i < 1800; i++) requete(m, { adresse: `/api/debug/journal/?depuis=${i}`, duree: 0.6 });
    for (const a of ['/api/debug/metriques/?periode=1h', '/api/debug/systeme/', '/api/debug/metriques/requetes/?limite=100', '/api/maintenance/', '/api/debug/base/']) {
      for (let i = 0; i < 120; i++) requete(m, { adresse: a, duree: 4 });
    }
    for (let i = 0; i < 20; i++) requete(m, { methode: 'POST', adresse: '/api/metriques/page/', statut: 204, duree: 1 });
    const l = m.lire({ periode: '1h' });
    assert.equal(l.global.n, 70, 'l’usage réel de l’API seulement');
    assert.ok(l.global.p95_ms >= 200, `p95 de l’API : ${l.global.p95_ms}`);
    assert.equal(l.global_avec_releves.n, 70 + 1800 + 600 + 20);
    assert.equal(l.releves.n, 1800 + 600 + 20);
    assert.ok(l.releves.routes.includes('GET /api/debug/journal/') && l.releves.routes.includes('POST /api/metriques/page/'));
    assert.ok(l.releves.routes.includes('GET /api/debug/base/'));
    assert.equal(l.routes.find((r) => r.route === '/api/debug/base/').n, 120, 'la version de la base garde sa ligne');
    assert.equal(l.serie.reduce((n, p) => n + p.n, 0), 70, 'la courbe aussi');
    assert.ok(Math.max(...l.serie.map((p) => p.p95_ms ?? 0)) >= 200);
    assert.equal(l.routes.find((r) => r.route === '/api/debug/journal/').n, 1800, 'la relève garde sa ligne');
  } finally {
    m.arreter();
  }
});

test('mémoire des requêtes : une adresse inconnue sous /api/personnages/ ne garde jamais l’identifiant de la fiche ; filtre par gabarit exact', () => {
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, memoireRequetes: 100 });
  try {
    requete(m, { adresse: '/api/personnages/fiche-secrete-1234/autre/?q=1', statut: 404 });
    requete(m, { adresse: '/api/personnages/fiche-secrete-1234/portrait/x/', statut: 404 });
    requete(m, { adresse: '/api/personnages/fiche-secrete-1234/portrait/' });
    requete(m, { adresse: '/api/v1/metiers/forgeron/' });
    // le filtre « Route » de la page : le gabarit EXACT (route_exacte) ; `route` reste une recherche dans le gabarit
    assert.deepEqual(m.requetes({ route_exacte: '/api/personnages/{id}/portrait/' }).requetes.length, 1);
    assert.deepEqual(m.requetes({ route_exacte: '/api/v1/metiers/' }).requetes.length, 0, 'le gabarit d’une liste ne ramène pas celui de ses éléments');
    assert.deepEqual(m.requetes({ route: '/api/v1/metiers/' }).requetes.length, 1);
    const adresses = m.requetes({}).requetes.map((r) => r.adresse);
    assert.deepEqual(adresses, ['/api/v1/metiers/forgeron/', '/api/personnages/{id}/portrait/', '/api/personnages/…', '/api/personnages/…']);
    assert.ok(!JSON.stringify(m.requetes({})).includes('secrete'));
  } finally {
    m.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Cardinalité : pages du site, couples, refus, plafond
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('pages du site : seules celles que le site construit a sont gardées (balise et Referer) ; une page fabriquée va dans « {autres} »', () => {
  const site = siteFactice(['races/elfe', 'classes', 'fiche']);
  const pages = pagesDuSite(site);
  assert.ok(pages.has('/') && pages.has('/races/elfe/') && pages.has('/classes/') && pages.has('/404.html') && pages.has('/404/'));
  assert.ok(![...pages].some((p) => p.includes('_astro')), 'ni _astro/ ni _serveur/');
  assert.equal(pageDuSite('/races/elfe', pages), '/races/elfe/');
  assert.equal(pageDuSite('/faux-1/', pages), null);
  assert.equal(pageDuSite('/x/', null), '/x/', 'sans le site : telle quelle');
  assert.equal(pagesDuSite(join(racine, 'absent')), null);
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0, fichiers: { site } });
  try {
    for (let i = 0; i < 50; i++) m.recevoirPage({ page: `/faux-${i}-${'z'.repeat(150)}/`, ttfb_ms: 1 }, {});
    m.recevoirPage({ page: '/races/elfe/', ttfb_ms: 10 }, {});
    for (let i = 0; i < 30; i++) requete(m, { adresse: '/api/personnages/', statut: 403, entetes: { referer: `http://site/fausse-page-${i}/` } });
    requete(m, { adresse: '/api/personnages/', entetes: { referer: 'http://site/fiche/?id=x' } });
    const l = m.lire({ periode: '24h' });
    assert.deepEqual(l.pages.map((p) => [p.page, p.n]).sort(), [['/races/elfe/', 1], [PAGE_AUTRES, 50]]);
    assert.deepEqual(new Set(l.origines.map((o) => o.page)), new Set([PAGE_AUTRES, '/fiche/']));
  } finally {
    m.arreter();
  }
});

test('couples (page d’origine, route) bornés par heure : au-delà de ORIGINES_PAR_HEURE, la page devient « {autres} »', () => {
  const pages = Array.from({ length: 40 }, (_, i) => `p${i}`);
  const site = siteFactice(pages);
  const routes = RESSOURCES.slice(0, 30).map((r) => `/api/v1/${r.cle}/`);
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'dev', intervalle: 0, fichiers: { site } });
  try {
    for (const p of pages) for (const r of routes) requete(m, { adresse: r, entetes: { referer: `http://site/${p}/` } });
    m.verser();
    const lu = lecture(m.fichier);
    try {
      const couples = lu.prepare('SELECT count(*) AS n FROM origine_heure').get().n;
      assert.ok(couples <= ORIGINES_PAR_HEURE + routes.length, `${couples} couples pour ${pages.length * routes.length} vus`);
      assert.ok(lu.prepare('SELECT 1 FROM origine_heure WHERE page = ?').get(PAGE_AUTRES));
    } finally {
      lu.close();
    }
  } finally {
    m.arreter();
  }
});

test('refus avant tout traitement (403, 405) : une route par premier segment, quel que soit le gabarit — la cardinalité ne dépend plus des requêtes refusées', () => {
  assert.equal(routeGardee('/api/v1/metiers/{cle}/', 403), '/api/v1/{refusee}/');
  assert.equal(routeGardee('/api/v1/openapi.json', 403), '/api/v1/{refusee}/');
  assert.equal(routeGardee('/api/etat/', 405), '/api/etat/{refusee}/');
  assert.equal(routeGardee('/api/personnages/{id}/', 404), '/api/personnages/{id}/', 'une fiche absente garde son gabarit');
  assert.equal(routeGardee(ROUTE_INCONNUE, 403), ROUTE_INCONNUE);
  assert.equal(routeGardee('/api/v1/metiers/', 200), '/api/v1/metiers/');
  // chaque gabarit de /api/v1/ et de /api/debug/, avec chaque méthode, refusé (production) : 2 clés par méthode au plus
  const adresses = ['/api/debug/journal/', '/api/debug/metriques/', '/api/debug/systeme/', '/api/debug/metriques/requetes/', '/api/debug/metriques/export/',
    '/api/v1/', '/api/v1/openapi.json'];
  for (const r of RESSOURCES) {
    adresses.push(`/api/v1/${r.cle}/`, `/api/v1/${r.cle}/x/`);
    for (const e of r.enfants ?? []) adresses.push(`/api/v1/${r.cle}/x/${e.cle}/`, `/api/v1/${r.cle}/x/${e.cle}/y/`);
    for (const a of r.actions ?? []) adresses.push(`/api/v1/${r.cle}/x/${a.cle}/`);
  }
  assert.ok(new Set(adresses.map((a) => routeNormalisee(a))).size > 250, 'des centaines de gabarits');
  const m = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0 });
  try {
    for (const a of adresses) for (const methode of [...METHODES, 'PROPFIND']) requete(m, { methode, adresse: a, statut: 403 });
    m.verser();
    const lu = lecture(m.fichier);
    try {
      const cles = lu.prepare('SELECT route, methode FROM agregat_heure').all().map((l) => `${l.methode} ${l.route}`);
      assert.equal(cles.length, 2 * (METHODES.length + 1), cles.join(', '));
      assert.equal(lu.prepare('SELECT sum(n) AS n FROM agregat_heure').get().n, adresses.length * (METHODES.length + 1), 'toutes comptées');
    } finally {
      lu.close();
    }
  } finally {
    m.arreter();
  }
});

test('plafond dur de la base des métriques (ou disque bas) : collecte restreinte — plus de nouvelle page ni d’origine, plus de requêtes brutes ; évènement et alerte', () => {
  const site = siteFactice(['races/elfe', 'classes']);
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0, fichiers: { site, disque: dossier }, plafond: 1, brutes: true });
  try {
    m.recevoirPage({ page: '/races/elfe/', ttfb_ms: 5 }, {});
    requete(m, { adresse: '/api/personnages/', entetes: { referer: 'http://site/classes/' } });
    const l = m.lire({ periode: '24h' });
    assert.deepEqual(l.pages.map((p) => p.page), [PAGE_AUTRES], 'même une vraie page : « {autres} »');
    assert.deepEqual(l.origines.map((o) => o.page), [PAGE_AUTRES]);
    assert.equal(l.routes[0].n, 1, 'les routes continuent');
    assert.ok(l.restreintes?.raison.includes('plafond'));
    const s = m.systeme({});
    assert.ok(s.alertes.some((a) => /Métriques restreintes/.test(a.message)), JSON.stringify(s.alertes));
    assert.ok(s.evenements.some((e) => e.type === 'metriques_restreintes' && e.detail.actif === true));
    m.verser();
    const lu = lecture(m.fichier);
    try {
      assert.equal(lu.prepare('SELECT count(*) AS n FROM requete_brute').get().n, 0, 'plus de requêtes brutes');
    } finally {
      lu.close();
    }
  } finally {
    m.arreter();
  }
  // sous le plafond, sur un disque qui a de la place : rien n'est restreint
  const libre = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0, fichiers: { site }, disqueMinimum: 0 });
  try {
    libre.recevoirPage({ page: '/races/elfe/', ttfb_ms: 5 }, {});
    assert.deepEqual(libre.lire({ periode: '24h' }).pages.map((p) => p.page), ['/races/elfe/']);
    assert.equal(libre.lire({ periode: '24h' }).restreintes, null);
  } finally {
    libre.arreter();
  }
  // le disque bas restreint aussi (seuil injecté au-dessus de la place libre réelle)
  const bas = creerMetriques({ dossier: dossierNeuf(), instance: 'prod', intervalle: 0, fichiers: { site }, disqueMinimum: Number.MAX_SAFE_INTEGER });
  try {
    assert.match(bas.lire({ periode: '24h' }).restreintes.raison, /disque/);
  } finally {
    bas.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Lectures lourdes
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('lectures lourdes : origines et pages vues classées et coupées par SQLite (jamais toutes les lignes en mémoire), lecture de l’autre instance gardée une minute', () => {
  const dossier = dossierNeuf();
  const T = Date.parse('2026-10-15T12:00:00Z');
  creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => T }).arreter();
  const db = new DatabaseSync(join(dossier, 'prod.db'));
  const heure = Math.floor(T / 3_600_000) * 3600;
  db.exec('BEGIN');
  const origine = db.prepare('INSERT INTO origine_heure (debut, page, route, n) VALUES (?, ?, ?, ?)');
  const page = db.prepare('INSERT INTO page_heure (debut, page, n, ttfb_n, ttfb_somme, ttfb_somme2, ttfb_min, ttfb_max, ttfb_c3) VALUES (?, ?, ?, 1, 50, 2500, 50, 50, 1)');
  for (let i = 0; i < 3000; i++) origine.run(heure - (i % 20) * 3600, `/page-${i}/`, '/api/personnages/', 1 + (i % 7));
  for (let i = 0; i < 1500; i++) page.run(heure - (i % 20) * 3600, `/page-${i}/`, 1 + (i % 5));
  db.exec('COMMIT');
  db.close();
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => T });
  const original = StatementSync.prototype.all;
  let plusGrande = 0;
  let lectures = 0;
  StatementSync.prototype.all = function toutLire(...args) {
    const lignes = original.apply(this, args);
    lectures += 1;
    plusGrande = Math.max(plusGrande, lignes.length);
    return lignes;
  };
  try {
    const l = dev.lire({ instance: 'prod', periode: 'tout' });
    assert.equal(l.origines.length, LIGNES_LUES_MAX);
    assert.equal(l.origines[0].n, 7, 'les plus nombreuses d’abord');
    assert.equal(l.pages.length, LIGNES_LUES_MAX);
    assert.equal(l.pages[0].n, 5);
    assert.ok(plusGrande <= LIGNES_LUES_MAX, `au plus ${LIGNES_LUES_MAX} lignes lues d’un coup (lues : ${plusGrande})`);
    const avant = lectures;
    assert.deepEqual(dev.lire({ instance: 'prod', periode: 'tout' }), l, 'la même réponse…');
    assert.equal(lectures, avant, '… sans relire le fichier (gardée une minute, tant qu’il n’a pas changé)');
  } finally {
    StatementSync.prototype.all = original;
    dev.arreter();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Images de la base vivante de l'autre instance (jauge de l'espace disque)
// ---------------------------------------------------------------------------------------------------------------------------------------------

test('relevé de l’hôte : la base vivante de l’AUTRE instance est comptée sans ses portraits, rangés dans « images » comme chez elle — les deux jauges s’accordent', () => {
  const T = Date.parse('2026-10-15T12:00:00Z');
  const dossier = dossierNeuf();
  mkdirSync(dossier, { recursive: true });
  const releve = (elements) => writeFileSync(join(dossier, RELEVE_HOTE.fichier), JSON.stringify({
    format: 1, instant: new Date(T).toISOString(), disque: { total: disqueDe(dossier).total }, elements,
  }));
  releve([
    { cle: 'base', instance: 'prod', chemin: '/srv/maverick-center/db/vivante.db', octets: 40_000_000 },
    { cle: 'base', instance: 'dev', chemin: '/srv/maverick-center-test/db/vivante.db', octets: 41_000_000 },
  ]);
  const chemin = join(dossier, RELEVE_HOTE.fichier);
  const lu = lireReleveDeLHote(chemin, { instance: 'dev', maintenant: T, imagesDesInstances: (nom) => (nom === 'prod' ? 35_000_000 : null) });
  assert.deepEqual([lu.comptes.base, lu.comptes.images], [5_000_000, 35_000_000], 'sa propre base (dev) est mesurée par le service : pas reprise');
  const sans = lireReleveDeLHote(chemin, { instance: 'dev', maintenant: T });
  assert.deepEqual([sans.comptes.base, sans.comptes.images ?? 0], [40_000_000, 0], 'sans les images de l’autre : la base entière');
  assert.equal(lireReleveDeLHote(chemin, { instance: 'dev', maintenant: T, imagesDesInstances: () => 99e9 }).comptes.base, 0, 'bornées par la base');
  // de bout en bout : la production note les images de SA base (sans ses portraits publiés) avec sa répartition ; le site de dev les lit dans prod.db
  const vivante = join(dossier, 'vivante-prod.db');
  writeFileSync(vivante, Buffer.alloc(200_000, 1));
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => T, fichiers: { vivante, disque: dossier }, imagesDeLaBase: () => 150_000 });
  prod.echantillonner();
  prod.arreter();
  const base = lecture(join(dossier, 'prod.db'));
  try {
    assert.equal(base.prepare('SELECT images_base FROM disque_repartition').get()?.images_base, 150_000);
  } finally {
    base.close();
  }
  releve([{ cle: 'base', instance: 'prod', chemin: '/srv/maverick-center/db/vivante.db', octets: 204_800 }]);
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => T + 1000, fichiers: { disque: dossier } });
  try {
    const disque = dev.systeme({}).disque;
    assert.equal(disque.repartition_hote?.utilise, true, JSON.stringify(disque.repartition_hote));
    const parCle = Object.fromEntries(disque.repartition.map((c) => [c.cle, c.octets]));
    assert.equal(parCle.images, 150_000, 'les portraits de la production en « Images importées », comme sur sa propre jauge');
    assert.ok(parCle.base >= 54_800, `le reste de sa base en « Base de données » : ${parCle.base}`);
  } finally {
    dev.arreter();
  }
});
