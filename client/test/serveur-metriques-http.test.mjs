// Métriques du service par le vrai serveur HTTP (client/serveur/service.mjs, api.mjs, metriques.mjs ; demande du propriétaire du 2026-10-15 et ses
// décisions : « deux jeux de données séparés entre la prod et le dev », « Active-le aussi en prod dans un premier temps ») : deux instances (site de
// dev et production) disposées comme sur le VPS — site/donnees/maverick.db, site/_serveur/version.json, db/ chacune, un dossier des métriques
// PARTAGÉ (MAVERICK_DOSSIER_METRIQUES) — reçoivent des requêtes ; le site de dev sert /api/debug/metriques/, …/requetes/, …/export/ et
// /api/debug/systeme/ (sa propre instance et celle de la production, lue en lecture seule), la production les refuse (403) ; la balise des pages
// répond 204 sur les deux (403 avec MAVERICK_METRIQUES_PAGES=0) et chaque instance l'écrit dans SON fichier ; tout est versé dans le fichier à l'arrêt.
//   node --test test/serveur-metriques-http.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { REPARTITION } from '../serveur/metriques.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { RESSOURCES } from '../src/lib/ressources.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-metriques-http-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const STATS = ['n', 'erreurs_4xx', 'erreurs_5xx', 'part_304', 'moyenne_ms', 'mediane_ms', 'p95_ms', 'p99_ms', 'min_ms', 'max_ms', 'ecart_type_ms', 'total_ms',
  'octets_entree', 'octets_sortie', 'sql_requetes_moyen', 'sql_ms_moyen'];

/**
 * Une instance disposée comme sur le serveur : <nom>/site (règles publiées, service livré, des pages — celles que la balise et le Referer citent :
 * le service ne garde que les pages que le site construit a —, un portrait publié) et <nom>/db.
 */
function instance(nom) {
  const site = join(racine, nom, 'site');
  mkdirSync(join(site, 'donnees'), { recursive: true });
  mkdirSync(join(site, '_serveur'), { recursive: true });
  mkdirSync(join(site, 'bestiaire', 'portraits'), { recursive: true });
  copyFileSync(REGLES, join(site, 'donnees', 'maverick.db'));
  writeFileSync(join(site, '_serveur', 'version.json'), JSON.stringify({ version: '0.3.2', empreinte: `code-${nom}` }));
  writeFileSync(join(site, 'index.html'), '<!doctype html><title>Maverick</title>'.repeat(200));
  for (const page of ['classes', 'races/elfe', 'fiche']) {
    mkdirSync(join(site, page), { recursive: true });
    writeFileSync(join(site, page, 'index.html'), `<!doctype html><title>${page}</title>`);
  }
  writeFileSync(join(site, 'bestiaire', 'portraits', 'a1b2c3.webp'), Buffer.alloc(9000, 1));
  return { regles: join(site, 'donnees', 'maverick.db'), dossier: join(racine, nom, 'db'), fichierVersion: join(site, '_serveur', 'version.json') };
}

/** Une requête : { statut, entetes, corps (JSON, texte ou null) }. */
async function appel(s, chemin, { methode = 'GET', corps, entetes = {} } = {}) {
  const r = await fetch(`${s.url}${chemin}`, { method: methode, headers: { 'User-Agent': CHROME, ...entetes }, body: corps });
  const texte = await r.text();
  let lu = texte || null;
  if (/json/.test(r.headers.get('content-type') ?? '') && texte) lu = JSON.parse(texte);
  return { statut: r.status, entetes: r.headers, corps: lu };
}
const balise = (s, page, { type = 'text/plain;charset=UTF-8', site = 'same-origin', ua = CHROME } = {}) => appel(s, '/api/metriques/page/', {
  methode: 'POST', corps: JSON.stringify({ page, ttfb_ms: 42.5, dom_ms: 180, charge_ms: 320.25, lcp_ms: 410 }),
  entetes: { 'Content-Type': type, 'Sec-Fetch-Site': site, 'User-Agent': ua },
});
const lecture = (chemin) => new DatabaseSync(chemin, { readOnly: true });
const empreinteDe = (chemin) => createHash('sha256').update(readFileSync(chemin)).digest('hex');

/** Exécute `f` avec ces variables d'environnement posées, puis rend l'environnement tel qu'il était. */
async function avecEnvironnement(variables, f) {
  const avant = Object.fromEntries(Object.keys(variables).map((k) => [k, process.env[k]]));
  Object.assign(process.env, variables);
  try {
    return await f();
  } finally {
    for (const [k, v] of Object.entries(avant)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('deux instances, un dossier des métriques partagé : chaque instance n’écrit que son fichier ; le site de dev sert les métriques des deux', async () => {
  const partage = join(racine, 'metriques-partagees');
  const lignes = [];
  const journal = (l) => lignes.push(l);
  // la production : réglages par l'environnement, comme dans son conteneur (MAVERICK_DOSSIER_METRIQUES, ni édition ni MAVERICK_INSTANCE)
  const prod = await avecEnvironnement({ MAVERICK_DOSSIER_METRIQUES: partage }, () => demarrerService({ ...instance('prod'), port: 0, intervalle: 0, journal, relancer: () => {} }));
  const dev = await demarrerService({ ...instance('dev'), port: 0, intervalle: 0, edition: true, journal, relancer: () => {}, metriques: { dossier: partage } });
  let prodArretee = false;
  try {
    assert.equal(prod.metriques.instance, 'prod');
    assert.equal(prod.metriques.fichier, join(partage, 'prod.db'));
    assert.equal(dev.metriques.fichier, join(partage, 'dev.db'));
    assert.equal(prod.metriques.pagesOuvertes, true, 'balise ouverte en production par défaut (décision du propriétaire)');

    // ---- production : requêtes ordinaires, balise acceptée, métriques fermées
    assert.equal((await appel(prod, '/api/etat/')).statut, 200);
    assert.equal((await appel(prod, '/api/personnages/')).statut, 200);
    assert.equal((await appel(prod, '/api/personnages/Fiche-Secrete/?jeton=abc', { entetes: { Referer: `${prod.url}/fiche/?id=Fiche-Secrete` } })).statut, 404);
    const recueProd = await balise(prod, '/races/elfe/', { ua: IPHONE });
    assert.equal(recueProd.statut, 204, 'balise reçue par la production');
    assert.equal(recueProd.corps, null);
    assert.equal((await balise(prod, '/races/elfe/', { type: 'application/json' })).statut, 204);
    for (const chemin of ['/api/debug/metriques/', '/api/debug/metriques/requetes/', '/api/debug/metriques/export/', '/api/debug/systeme/']) {
      assert.equal((await appel(prod, chemin)).statut, 403, `${chemin} : fermé en production`);
    }
    assert.equal((await appel(prod, '/api/v1/metiers/')).statut, 403);

    // ---- site de dev : requêtes ordinaires (avec page d'origine), balise, refus de la balise
    const origine = { Referer: `${dev.url}/classes/?onglet=2#x` };
    for (let i = 0; i < 3; i++) assert.equal((await appel(dev, `/api/v1/metiers/?q=forgeron&limite=${i + 1}`, { entetes: origine })).statut, 200);
    const metier = (await appel(dev, '/api/v1/metiers/?limite=1')).corps.elements[0];
    assert.match(metier.adresse, /^\/api\/v1\/metiers\/[^/]+\/$/);
    assert.equal((await appel(dev, metier.adresse, { entetes: origine })).statut, 200);
    await appel(dev, '/api/v1/metiers/n-existe-pas/');
    await appel(dev, '/api/etat/');
    await appel(dev, '/api/une/adresse/inconnue/');
    assert.equal((await balise(dev, '/classes/')).statut, 204);
    assert.equal((await balise(dev, '/classes/', { site: 'cross-site' })).statut, 403, 'balise d’un autre site');
    assert.equal((await balise(dev, '/classes/', { type: 'application/x-www-form-urlencoded' })).statut, 415);
    assert.equal((await appel(dev, '/api/metriques/page/', { methode: 'POST', corps: '{"page": "pas un chemin", "charge_ms": 1}', entetes: { 'Content-Type': 'application/json' } })).statut, 400);
    assert.equal((await appel(dev, '/api/metriques/page/')).statut, 405);

    // ---- GET /api/debug/metriques/ : sa propre instance
    const m = await appel(dev, '/api/debug/metriques/?periode=1h&tri=n');
    assert.equal(m.statut, 200);
    assert.equal(m.corps.instance, 'dev');
    assert.deepEqual(m.corps.instances, ['dev', 'prod'], 'le fichier de la production existe dans le dossier partagé');
    assert.equal(m.corps.periode, '1h');
    for (const c of ['depuis', 'jusqua', 'global', 'routes', 'serie', 'pages', 'navigateurs', 'origines']) assert.ok(c in m.corps, c);
    for (const c of STATS) assert.ok(c in m.corps.global, `global.${c}`);
    const liste = m.corps.routes.find((r) => r.route === '/api/v1/metiers/' && r.methode === 'GET');
    assert.ok(liste && liste.n >= 3, JSON.stringify(m.corps.routes.map((r) => [r.route, r.methode, r.n])));
    for (const c of STATS) assert.ok(c in liste, `route.${c}`);
    assert.ok(liste.moyenne_ms > 0 && liste.sql_requetes_moyen > 0, 'durée et requêtes SQL mesurées');
    assert.ok(m.corps.routes.some((r) => r.route === '/api/v1/metiers/{cle}/'), 'le gabarit, jamais la clé');
    assert.ok(m.corps.routes.some((r) => r.route === '/api/{inconnue}'));
    assert.ok(m.corps.routes.some((r) => r.route === '/api/metriques/page/' && r.methode === 'POST'));
    assert.ok(!m.corps.routes.some((r) => r.route.startsWith('/api/personnages/{id}')), 'les requêtes de la production n’y sont pas');
    assert.ok(!JSON.stringify(m.corps).includes('forgeron') && !JSON.stringify(m.corps).includes('Secrete'), 'ni chaîne de requête ni identifiant');
    assert.equal(m.corps.serie.length, 12, 'série de 5 minutes sur 1h');
    assert.deepEqual(m.corps.pages.map((p) => [p.page, p.n, p.ttfb_ms, p.charge_ms]), [['/classes/', 1, 42.5, 320.25]]);
    assert.ok(m.corps.navigateurs.some((n) => n.famille === 'Chrome' && n.appareil === 'ordinateur'));
    assert.ok(m.corps.origines.some((o) => o.page === '/classes/' && o.route === '/api/v1/metiers/' && o.n === 3), 'page d’origine : le chemin du Referer, sans requête');
    // les relèves de la page Debug sont comptées, mais pas notées au journal
    assert.ok(!lignes.some((l) => l.startsWith('GET /api/debug/metriques/')), 'relève absente du journal');

    // ---- GET /api/debug/metriques/requetes/ : les dernières requêtes une à une (mémoire du site de dev)
    const r = await appel(dev, '/api/debug/metriques/requetes/?limite=50&route=/api/v1/metiers/');
    assert.equal(r.statut, 200);
    assert.ok(r.corps.requetes.length >= 4);
    for (const q of r.corps.requetes) {
      for (const c of ['instant', 'methode', 'route', 'adresse', 'statut', 'duree_ms', 'phases', 'octets_entree', 'octets_sortie', 'sql', 'page', 'navigateur', 'appareil', 'simultanees']) assert.ok(c in q, c);
      assert.ok(!q.adresse.includes('?'), 'le chemin seulement');
      assert.ok(q.route.startsWith('/api/v1/metiers/'));
      assert.deepEqual(Object.keys(q.phases), ['corps_ms', 'traitement_ms', 'envoi_ms']);
    }
    assert.ok(r.corps.requetes.some((q) => q.sql.n > 0 && q.sql.plus_lente?.sql && !/forgeron/.test(q.sql.plus_lente.sql)), 'la requête SQL la plus lente, sans valeurs');
    assert.ok((await appel(dev, '/api/debug/metriques/requetes/?statut=4xx')).corps.requetes.every((q) => q.statut >= 400 && q.statut < 500));
    assert.equal((await appel(dev, '/api/debug/metriques/requetes/?statut=abc')).statut, 400);

    // ---- journal en mémoire : champs isolés de l'entrée http, filtre min_ms
    const j = await appel(dev, '/api/debug/journal/?categorie=http&min_ms=0');
    const entree = j.corps.entrees.find((e) => e.route === '/api/v1/metiers/');
    assert.ok(entree, JSON.stringify(j.corps.entrees.slice(-3)));
    assert.deepEqual([typeof entree.duree_ms, entree.methode, entree.statut, typeof entree.octets_sortie], ['number', 'GET', 200, 'number']);
    assert.equal((await appel(dev, '/api/debug/journal/?categorie=http&min_ms=999999')).corps.entrees.length, 0);

    // ---- GET /api/debug/systeme/ : processus, disque et sa répartition (somme = total), fichiers, volume
    const s = await appel(dev, '/api/debug/systeme/');
    assert.equal(s.statut, 200);
    for (const c of ['instance', 'maintenant', 'processus', 'disque', 'fichiers', 'echantillons', 'evenements', 'volume', 'alertes']) assert.ok(c in s.corps, c);
    for (const c of ['version', 'code', 'node', 'pid', 'depuis', 'duree_s', 'rss', 'tas_utilise', 'tas_total', 'externe', 'cpu_utilisateur_pct', 'cpu_systeme_pct',
      'boucle_p50_ms', 'boucle_p99_ms', 'boucle_max_ms', 'charge']) assert.ok(c in s.corps.processus, `processus.${c}`);
    assert.deepEqual([s.corps.processus.version, s.corps.processus.code], ['0.3.2', 'code-dev']);
    const d = s.corps.disque;
    for (const c of ['dossier', 'libre', 'total', 'utilise', 'part_libre', 'repartition']) assert.ok(c in d, `disque.${c}`);
    assert.deepEqual(d.repartition.map((c) => c.cle), REPARTITION.map((c) => c.cle));
    assert.equal(d.repartition.reduce((n, c) => n + c.octets, 0), d.total, 'la jauge fait EXACTEMENT la taille du disque');
    const rep = Object.fromEntries(d.repartition.map((c) => [c.cle, c.octets]));
    assert.ok(rep.base > 0, 'la base vivante');
    assert.ok(rep['site-donnees'] > 0, 'les règles publiées du site (site/donnees/maverick.db), trouvé d’après la base des règles');
    assert.ok(rep['site-code'] > 0 && rep.images >= 9000 && rep.metriques > 0);
    assert.equal(rep.libre, d.libre);
    assert.ok(s.corps.fichiers.some((f) => f.nom === 'base vivante' && f.octets > 0));
    assert.ok(s.corps.evenements.some((e) => e.type === 'demarrage' && e.detail.version === '0.3.2'));
    assert.ok(s.corps.volume.metriques_octets > 0 && s.corps.volume.croissance_octets_par_jour > 0);
    assert.equal((await appel(dev, '/api/debug/systeme/?periode=2h')).statut, 400);

    // ---- export : agrégats horaires en pièce jointe
    const csv = await appel(dev, '/api/debug/metriques/export/?format=csv&periode=24h');
    assert.equal(csv.statut, 200);
    assert.match(csv.entetes.get('content-type'), /^text\/csv/);
    assert.match(csv.entetes.get('content-disposition'), /^attachment; filename="metriques-dev-24h-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.match(csv.corps, /^debut,route,methode,n,/);
    assert.ok(csv.corps.includes('/api/v1/metiers/{cle}/'));
    const json = await appel(dev, '/api/debug/metriques/export/?format=json');
    assert.equal(json.statut, 200);
    assert.ok(json.corps.lignes.length > 0);
    assert.equal((await appel(dev, '/api/debug/metriques/export/?format=xml')).statut, 400);

    // ---- la production s'arrête : tout est versé dans prod.db (requêtes, balises, échantillon, répartition, démarrage et arrêt)
    await prod.arreter();
    prodArretee = true;
    const p = lecture(join(partage, 'prod.db'));
    try {
      const routes = p.prepare('SELECT route, methode, sum(n) AS n, sum(erreurs_4xx) AS e FROM agregat_heure GROUP BY route, methode ORDER BY route, methode').all().map((l) => ({ ...l }));
      assert.ok(routes.some((l) => l.route === '/api/personnages/{id}/' && l.n === 1 && l.e === 1), JSON.stringify(routes));
      // un refus avant tout traitement (403, 405) : sous « /api/<premier segment>/{refusee}/ » (cardinalité bornée), compté
      assert.ok(routes.some((l) => l.route === '/api/debug/{refusee}/' && l.e === 4), `les refus (403) comptés : ${JSON.stringify(routes)}`);
      assert.ok(!routes.some((l) => l.route === '/api/debug/metriques/'), 'jamais une ligne par route refusée');
      assert.ok(!routes.some((l) => l.route.startsWith('/api/v1/metiers/{cle}')), 'jamais les requêtes du site de dev');
      // deux balises, peut-être de part et d'autre d'une heure (une ligne par tranche) : sommées par page
      assert.deepEqual(p.prepare('SELECT page, sum(n) AS n FROM page_heure GROUP BY page').all().map((l) => [l.page, l.n]), [['/races/elfe/', 2]],
        'la balise reçue par la production, dans prod.db');
      assert.ok(p.prepare("SELECT 1 FROM navigateur_heure WHERE famille = 'Safari' AND appareil = 'telephone' AND pages = 1").get());
      assert.deepEqual(p.prepare("SELECT type FROM evenement WHERE type IN ('demarrage', 'arret') ORDER BY id").all().map((e) => e.type), ['demarrage', 'arret']);
      assert.ok(p.prepare('SELECT count(*) AS n FROM systeme_minute').get().n >= 1, 'un dernier échantillon à l’arrêt');
      assert.equal(p.prepare('SELECT count(*) AS n FROM disque_repartition').get().n, 1, 'et la répartition du disque');
      const tout = JSON.stringify(p.prepare('SELECT * FROM agregat_heure').all()) + JSON.stringify(p.prepare('SELECT * FROM origine_heure').all());
      for (const interdit of ['Fiche-Secrete', 'jeton', 'abc', 'Mozilla', 'iPhone', '127.0.0.1']) assert.ok(!tout.includes(interdit), interdit);
    } finally {
      p.close();
    }
    const d1 = lecture(join(partage, 'dev.db'));
    try {
      assert.equal(d1.prepare("SELECT count(*) AS n FROM page_heure WHERE page = '/races/elfe/'").get().n, 0, 'une balise de la production ne va jamais dans dev.db');
    } finally {
      d1.close();
    }

    // ---- le site de dev lit la production (LECTURE SEULE : le fichier n'est pas touché)
    const avant = empreinteDe(join(partage, 'prod.db'));
    const mp = await appel(dev, '/api/debug/metriques/?instance=prod&periode=24h');
    assert.equal(mp.statut, 200);
    assert.equal(mp.corps.instance, 'prod');
    assert.ok(mp.corps.routes.some((x) => x.route === '/api/personnages/{id}/'));
    assert.ok(!mp.corps.routes.some((x) => x.route === '/api/v1/metiers/{cle}/' || x.route === '/api/{inconnue}'), 'jamais mélangées : les routes que seul le site de dev a reçues');
    assert.equal(mp.corps.routes.find((x) => x.route === '/api/v1/{refusee}/')?.erreurs_4xx, 1, 'le 403 de la production, compté chez elle (sous sa route de refus)');
    assert.deepEqual(mp.corps.pages.map((x) => [x.page, x.n]), [['/races/elfe/', 2]]);
    const sp = await appel(dev, '/api/debug/systeme/?instance=prod');
    assert.equal(sp.statut, 200);
    assert.deepEqual([sp.corps.instance, sp.corps.processus.version, sp.corps.processus.code], ['prod', '0.3.2', 'code-prod']);
    assert.equal(sp.corps.disque.repartition.reduce((n, c) => n + c.octets, 0), sp.corps.disque.total, 'la jauge de la production, lue dans prod.db');
    assert.ok(Object.fromEntries(sp.corps.disque.repartition.map((c) => [c.cle, c.octets]))['site-donnees'] > 0);
    const ep = await appel(dev, '/api/debug/metriques/export/?instance=prod&format=csv');
    assert.match(ep.entetes.get('content-disposition'), /metriques-prod-tout-/);
    assert.equal(empreinteDe(join(partage, 'prod.db')), avant, 'prod.db inchangé par les lectures du site de dev');
    assert.equal((await appel(dev, '/api/debug/metriques/?instance=recette')).statut, 404, 'instance sans fichier');
    assert.equal((await appel(dev, '/api/debug/metriques/?instance=../prod')).statut, 400);
  } finally {
    if (!prodArretee) await prod.arreter();
    await dev.arreter();
  }
  // ---- le site de dev arrêté : ses requêtes sont dans dev.db, jamais dans prod.db
  const d2 = lecture(join(partage, 'dev.db'));
  try {
    assert.ok(d2.prepare("SELECT sum(n) AS n FROM agregat_heure WHERE route = '/api/v1/metiers/'").get().n >= 3);
    assert.deepEqual(d2.prepare('SELECT page, n FROM page_heure').all().map((l) => [l.page, l.n]), [['/classes/', 1]]);
    assert.equal(d2.prepare("SELECT count(*) AS n FROM agregat_heure WHERE route = '/api/personnages/{id}/'").get().n, 0);
  } finally {
    d2.close();
  }
});

test('MAVERICK_METRIQUES_PAGES=0 ferme la balise (403) — l’interrupteur pour plus tard ; le reste de la collecte continue', async () => {
  const partage = join(racine, 'metriques-fermees');
  const s = await avecEnvironnement({ MAVERICK_METRIQUES_PAGES: '0', MAVERICK_DOSSIER_METRIQUES: partage },
    () => demarrerService({ ...instance('prod-fermee'), port: 0, intervalle: 0, journal: () => {}, relancer: () => {} }));
  try {
    assert.equal(s.metriques.pagesOuvertes, false);
    const r = await balise(s, '/');
    assert.equal(r.statut, 403);
    assert.match(r.corps.erreur, /MAVERICK_METRIQUES_PAGES=0/);
    assert.equal((await appel(s, '/api/etat/')).statut, 200);
  } finally {
    await s.arreter();
  }
  const db = lecture(join(partage, 'prod.db'));
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM page_heure').get().n, 0, 'aucune page vue');
    assert.equal(db.prepare("SELECT n FROM agregat_heure WHERE route = '/api/metriques/{refusee}/'").get().n, 1, 'le refus est compté (route de refus)');
    assert.equal(db.prepare("SELECT n FROM agregat_heure WHERE route = '/api/etat/'").get().n, 1);
  } finally {
    db.close();
  }
});

test('panne des métriques (dossier impossible) : le service démarre, répond et s’arrête normalement ; la panne est notée une fois', async () => {
  const fichierALaPlace = join(racine, 'pas-un-dossier');
  writeFileSync(fichierALaPlace, 'x');
  const lignes = [];
  const s = await demarrerService({ ...instance('panne'), port: 0, intervalle: 0, edition: true, journal: (l) => lignes.push(l), relancer: () => {}, metriques: { dossier: fichierALaPlace } });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await appel(s, '/api/etat/')).statut, 200);
    assert.equal((await balise(s, '/')).statut, 204);
    const m = await appel(s, '/api/debug/metriques/?periode=1h');
    assert.equal(m.statut, 200);
    assert.ok(m.corps.panne, 'la panne est dite');
    assert.ok(m.corps.global.n >= 3, 'la collecte continue en mémoire');
    assert.ok(m.corps.global_avec_releves.n >= 4, 'la balise y est, comptée à part (relève automatique)');
    const sys = await appel(s, '/api/debug/systeme/');
    assert.ok(sys.corps.alertes.some((a) => a.niveau === 'erreur' && /panne/.test(a.message)));
  } finally {
    await s.arreter();
  }
  assert.equal(lignes.filter((l) => l.startsWith('ERREUR métriques')).length, 1, lignes.join('\n'));
});

test('balise sans Sec-Fetch-Site (navigateur sans Fetch Metadata) : un en-tête Origin d’un autre site est refusé (403) ; le même hôte ou aucun Origin passe', async () => {
  const partage = join(racine, 'metriques-origine');
  const s = await avecEnvironnement({ MAVERICK_DOSSIER_METRIQUES: partage }, () => demarrerService({ ...instance('prod-origine'), port: 0, intervalle: 0, journal: () => {}, relancer: () => {} }));
  try {
    const envoyer = (entetes) => appel(s, '/api/metriques/page/', {
      methode: 'POST', corps: JSON.stringify({ page: '/races/elfe/', ttfb_ms: 99 }), entetes: { 'Content-Type': 'text/plain', ...entetes },
    });
    assert.equal((await envoyer({ Origin: 'https://evil.example' })).statut, 403, 'une page tierce, requête « simple » sans requête préalable');
    assert.equal((await envoyer({ Origin: 'null' })).statut, 403);
    const hote = new URL(s.url).host;
    assert.equal((await envoyer({ Origin: `http://${hote}` })).statut, 204, 'le même hôte');
    assert.equal((await envoyer({ Origin: 'https://maverick-jdr.com', 'X-Forwarded-Host': 'maverick-jdr.com' })).statut, 204, 'derrière le mandataire');
    assert.equal((await envoyer({})).statut, 204, 'sans Origin (un outil)');
    assert.equal((await envoyer({ Origin: `http://${hote}`, 'Sec-Fetch-Site': 'cross-site' })).statut, 403, 'Sec-Fetch-Site prévaut');
  } finally {
    await s.arreter();
  }
  const db = lecture(join(partage, 'prod.db'));
  try {
    assert.equal(db.prepare('SELECT sum(n) AS n FROM page_heure').get().n, 3, 'seules les mesures acceptées');
  } finally {
    db.close();
  }
});

test('production : chaque gabarit du service × chaque méthode, une requête anonyme chacun — le nombre de lignes par heure reste borné (refus regroupés)', async () => {
  const partage = join(racine, 'metriques-cardinalite');
  const s = await avecEnvironnement({ MAVERICK_DOSSIER_METRIQUES: partage }, () => demarrerService({ ...instance('prod-cardinalite'), port: 0, intervalle: 0, journal: () => {}, relancer: () => {} }));
  const adresses = ['/api/etat/', '/api/maintenance/', '/api/maintenance/lever/', '/api/personnages/', '/api/personnages/x/', '/api/personnages/x/portrait/',
    '/api/edition/', ...['en-attente', 'lignes', 'listes', 'pages', 'journal', 'race', 'portrait'].map((a) => `/api/edition/${a}/`), '/api/mise-a-jour/',
    '/api/mise-a-jour/lancer/', '/api/mise-a-jour/lots/0f0e2c1a-1111-2222-3333-444455556666/', '/api/debug/journal/', '/api/debug/metriques/',
    '/api/debug/metriques/requetes/', '/api/debug/metriques/export/', '/api/debug/systeme/', '/api/metriques/page/', '/api/v1/', '/api/v1/openapi.json'];
  for (const r of RESSOURCES) {
    adresses.push(`/api/v1/${r.cle}/`, `/api/v1/${r.cle}/x/`);
    for (const e of r.enfants ?? []) adresses.push(`/api/v1/${r.cle}/x/${e.cle}/`, `/api/v1/${r.cle}/x/${e.cle}/y/`);
    for (const a of r.actions ?? []) adresses.push(`/api/v1/${r.cle}/x/${a.cle}/`);
  }
  const methodes = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'PROPFIND'];
  const statuts = new Map();
  try {
    const travaux = adresses.flatMap((a) => methodes.map((m) => [a, m]));
    for (let i = 0; i < travaux.length; i += 64) {
      await Promise.all(travaux.slice(i, i + 64).map(async ([a, m]) => {
        const r = await fetch(`${s.url}${a}`, { method: m, headers: { 'User-Agent': 'curl/8.5.0' } });
        await r.arrayBuffer();
        statuts.set(r.status, (statuts.get(r.status) ?? 0) + 1);
      }));
    }
  } finally {
    await s.arreter();
  }
  const db = lecture(join(partage, 'prod.db'));
  try {
    // une ligne par tranche × route × méthode : les requêtes du test peuvent chevaucher la fin d'une tranche de 5 minutes (ou d'une heure), qui
    // donne alors deux lignes au même couple (run 38881504111, lancé à 09:40:00 : « 78 !== 70 ») ; on compte donc les couples (route, méthode)
    const parCouple = (table) => db.prepare(`SELECT route, methode, sum(n) AS n FROM ${table} GROUP BY route, methode ORDER BY route, methode`).all().map((l) => ({ ...l }));
    const lignes = parCouple('agregat_heure');
    const total = lignes.reduce((n, l) => n + l.n, 0);
    assert.equal(total, adresses.length * methodes.length, `toutes comptées (${JSON.stringify([...statuts])})`);
    // avant : une ligne par gabarit × méthode (plus de 2 600) ; refus regroupés par premier segment, les routes servies seules gardent leur gabarit
    assert.ok(lignes.length <= 150, `${lignes.length} couples pour ${total} requêtes : ${lignes.map((l) => `${l.methode} ${l.route}`).join(', ')}`);
    assert.ok(!lignes.some((l) => /^\/api\/v1\/[a-z]/.test(l.route)), 'aucun gabarit de /api/v1/ (fermé en production)');
    assert.deepEqual(parCouple('agregat_5min'), lignes, 'de même par tranche de 5 minutes : les mêmes couples, autant de requêtes chacun');
  } finally {
    db.close();
  }
});
