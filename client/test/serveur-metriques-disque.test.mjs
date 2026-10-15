// Répartition du disque des métriques (client/serveur/metriques.mjs ; demande du propriétaire du 2026-10-15 : « la métrique de la place occupée sur
// le serveur sur la place totale sous forme de jauge, colorée en fonction du type de données (DB, Code, Import images, etc.) ») : catégories des
// fichiers du site, relevé d'un dossier temporaire aux tailles connues (liens symboliques jamais suivis, dossiers jamais comptés deux fois, bornes),
// somme EXACTEMENT égale à la taille du disque (« autres » jamais négatif, dépassement ramené et signalé), images de la base vivante retranchées de
// la base, relevé gardé 10 minutes et noté dans les échantillons toutes les 10 minutes (horloge injectée), lu par le site de dev dans le fichier de la
// production, éclairci au-delà de 14 jours.
//   node --test test/serveur-metriques-disque.test.mjs
import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import {
  alertesDu, CATEGORIES_COMPTEES, CATEGORIES_HOTE, categorieDuFichierDuSite, colonnesImagesDe, comptesAvecLHote, creerMetriques, disqueDe, lireReleveDeLHote,
  octetsDesImages, octetsSurDisque, PARCOURS, RELEVE_HOTE, releverRepartition, REPARTITION, REPARTITION_HOTE, repartitionDu, RETENTION, SCHEMA_METRIQUES,
} from '../serveur/metriques.mjs';
import { dossierDuSite } from '../serveur/service.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-metriques-disque-'));
after(() => rmSync(racine, { recursive: true, force: true }));
let compteur = 0;
const dossierNeuf = () => {
  const d = join(racine, `d${++compteur}`);
  mkdirSync(d, { recursive: true });
  return d;
};
const MINUTE = 60_000;
const JOUR = 86_400_000;
const somme = (repartition) => repartition.reduce((n, c) => n + c.octets, 0);
const parCle = (repartition) => Object.fromEntries(repartition.map((c) => [c.cle, c.octets]));

/** Écrit `octets` octets dans `chemin` (dossiers créés) et rend ce qu'il occupe sur le disque (octetsSurDisque). */
function fichier(chemin, octets) {
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, Buffer.alloc(octets, 7));
  return octetsSurDisque(lstatSync(chemin));
}

/**
 * Une instance aux tailles connues : db/ (base vivante et son WAL, archives/, mise-a-jour/, metriques/, un fichier d'état), site/ (service livré,
 * pages, scripts, données, index de recherche, règles de la fiche, images, portraits publiés, police), un lien symbolique vers un gros fichier hors
 * de l'instance et un vers un dossier (jamais suivis). Rend { db, site, attendu: { cle: octets } }.
 */
function instanceConnue() {
  const d = dossierNeuf();
  const db = join(d, 'db');
  const site = join(d, 'site');
  const attendu = Object.fromEntries(CATEGORIES_COMPTEES.map((c) => [c, 0]));
  attendu.base += fichier(join(db, 'vivante.db'), 40_960);
  attendu.base += fichier(join(db, 'vivante.db-wal'), 8192);
  attendu.base += fichier(join(db, 'archives', 'vivante-2026-10-01.db'), 20_480);
  attendu.base += fichier(join(db, 'archives', 'ancien', 'vivante-2026-09-01.db'), 12_288);
  attendu['mises-a-jour'] += fichier(join(db, 'mise-a-jour', 'lot-1.json'), 3000);
  attendu['mises-a-jour'] += fichier(join(db, 'mise-a-jour', 'lot-2.json'), 9000);
  // des fichiers du dossier des métriques qui ne sont pas des bases d'instance (celles des tests s'y ajoutent)
  attendu.metriques += fichier(join(db, 'metriques', 'ancien.sqlite'), 16_384);
  attendu.metriques += fichier(join(db, 'metriques', 'notes', 'lisez-moi.txt'), 24_576);
  fichier(join(db, 'etat.json'), 500); // ni base ni métriques : « Système et autres »
  attendu['site-code'] += fichier(join(site, '_serveur', 'serveur', 'index.mjs'), 6000);
  attendu['site-code'] += fichier(join(site, '_serveur', 'version.json'), 300);
  attendu['site-code'] += fichier(join(site, 'index.html'), 5000);
  attendu['site-code'] += fichier(join(site, 'classes', 'guerrier', 'index.html'), 7000);
  attendu['site-code'] += fichier(join(site, 'donnees', 'metier', 'index.html'), 4500);
  attendu['site-code'] += fichier(join(site, '_astro', 'page.BdX1.js'), 12_000);
  attendu['site-code'] += fichier(join(site, '_astro', 'style.css'), 2500);
  attendu['site-donnees'] += fichier(join(site, 'donnees', 'maverick.db'), 81_920);
  attendu['site-donnees'] += fichier(join(site, 'donnees', 'reference.db'), 61_440);
  attendu['site-donnees'] += fichier(join(site, 'donnees', 'reference.json'), 400);
  attendu['site-donnees'] += fichier(join(site, 'search-index.json'), 30_000);
  attendu['site-donnees'] += fichier(join(site, 'fiche', 'regles.json'), 15_000);
  attendu['site-images'] += fichier(join(site, 'logo.webp'), 9000);
  attendu['site-images'] += fichier(join(site, 'favicon.png'), 1200);
  attendu.images += fichier(join(site, 'bestiaire', 'portraits', 'a1b2c3.webp'), 7000);
  attendu.images += fichier(join(site, 'bestiaire', 'portraits', 'd4e5f6.jpg'), 5000);
  attendu['site-autres'] += fichier(join(site, 'polices', 'texte.woff2'), 20_000);
  // liens symboliques : un fichier énorme et un dossier hors de l'instance — jamais suivis
  const dehors = dossierNeuf();
  fichier(join(dehors, 'enorme.bin'), 2_000_000);
  fichier(join(dehors, 'sous', 'autre.bin'), 1_000_000);
  symlinkSync(join(dehors, 'enorme.bin'), join(site, 'lien-vers-enorme.bin'));
  symlinkSync(join(dehors, 'sous'), join(site, 'lien-vers-dossier'));
  // les blocs des dossiers eux-mêmes (comme du et deploy/vps/volume.sh) : avec leur contenu ; ceux du site avec ses autres fichiers
  attendu.base += blocsDesDossiers(join(db, 'archives'));
  attendu['mises-a-jour'] += blocsDesDossiers(join(db, 'mise-a-jour'));
  attendu.metriques += blocsDesDossiers(join(db, 'metriques'));
  attendu['site-autres'] += blocsDesDossiers(site);
  return { db, site, attendu };
}

/** Les octets alloués aux dossiers eux-mêmes (la racine comprise), sans suivre un lien symbolique. */
function blocsDesDossiers(dossier) {
  let n = octetsSurDisque(lstatSync(dossier));
  for (const e of readdirSync(dossier, { withFileTypes: true })) if (e.isDirectory()) n += blocsDesDossiers(join(dossier, e.name));
  return n;
}

test('catégories des fichiers du site : service livré, pages et scripts (code), données, images, portraits publiés (images importées), le reste', () => {
  const attendues = {
    '_serveur/serveur/index.mjs': 'site-code',
    '_serveur/version.json': 'site-code',
    '_serveur/src/lib/portraits/x.png': 'site-code',
    'index.html': 'site-code',
    'classes/guerrier/index.html': 'site-code',
    'donnees/metier/index.html': 'site-code',
    '_astro/page.BdX1.js': 'site-code',
    '_astro/style.css': 'site-code',
    '_astro/style.css.map': 'site-code',
    'donnees/maverick.db': 'site-donnees',
    'donnees/reference.json': 'site-donnees',
    'search-index.json': 'site-donnees',
    'fiche/regles.json': 'site-donnees',
    'autre/base.db': 'site-donnees',
    'logo.webp': 'site-images',
    'favicon.png': 'site-images',
    'apple-touch-icon.PNG': 'site-images',
    'images/carte.svg': 'site-images',
    'icone.ico': 'site-images',
    'photo.avif': 'site-images',
    'photo.jpeg': 'site-images',
    'anim.gif': 'site-images',
    'bestiaire/portraits/a1b2c3.webp': 'images',
    'bestiaire/portraits/a1b2c3.jpg': 'images',
    'portraits/x.png': 'images',
    'polices/texte.woff2': 'site-autres',
    'robots.txt': 'site-autres',
    LISEZMOI: 'site-autres',
    '.htaccess': 'site-autres',
  };
  for (const [chemin, categorie] of Object.entries(attendues)) assert.equal(categorieDuFichierDuSite(chemin), categorie, chemin);
  assert.equal(categorieDuFichierDuSite('bestiaire\\portraits\\a.webp'), 'images', 'séparateur de Windows');
  for (const c of new Set(Object.values(attendues))) assert.ok(CATEGORIES_COMPTEES.includes(c), c);
});

test('catégories de la jauge : clés figées, dans l’ordre, avec leurs libellés', () => {
  assert.deepEqual(REPARTITION.map((c) => [c.cle, c.libelle]), [
    ['base', 'Base de données'], ['images', 'Images importées'], ['mises-a-jour', 'Mises à jour'], ['metriques', 'Métriques'], ['site-code', 'Code du site'],
    ['site-donnees', 'Données du site'], ['site-images', 'Images du site'], ['site-autres', 'Autres fichiers du site'], ['autres', 'Système et autres'],
    ['reserve', 'Réservé au système'], ['libre', 'Libre'],
  ]);
  assert.deepEqual(CATEGORIES_COMPTEES, REPARTITION.slice(0, -3).map((c) => c.cle));
  assert.ok(Object.isFrozen(REPARTITION) && REPARTITION.every((c) => Object.isFrozen(c)));
});

test('répartition : la somme fait EXACTEMENT le total ; « libre » = la place libre ; « autres » = le reste, jamais négatif ; dépassement ramené et signalé', () => {
  const comptes = { base: 1000, images: 200, 'mises-a-jour': 30, metriques: 40, 'site-code': 500, 'site-donnees': 700, 'site-images': 6, 'site-autres': 4 };
  const { repartition, depasse } = repartitionDu({ total: 10_000, libre: 6000, comptes });
  assert.deepEqual(repartition.map((c) => c.cle), REPARTITION.map((c) => c.cle));
  assert.equal(somme(repartition), 10_000);
  assert.deepEqual(parCle(repartition), { ...comptes, autres: 10_000 - 6000 - 2480, reserve: 0, libre: 6000 });
  assert.equal(depasse, null);
  // la réserve de root à part : la place prise (df : Used) = tout sauf « reserve » et « libre » ; une réserve plus grande que le reste est bornée
  const avecReserve = repartitionDu({ total: 10_000, libre: 6000, reserve: 500, comptes });
  assert.deepEqual(parCle(avecReserve.repartition), { ...comptes, autres: 10_000 - 6000 - 500 - 2480, reserve: 500, libre: 6000 });
  assert.equal(somme(avecReserve.repartition), 10_000);
  assert.equal(parCle(repartitionDu({ total: 100, libre: 60, reserve: 1e9 }).repartition).reserve, 40);
  assert.deepEqual(repartitionDu({ total: 100, libre: 60, reserve: 30, comptes: { base: 50 } }).depasse, { compte: 50, occupe: 10 }, 'la réserve n’est pas de la place prise');
  assert.ok(repartition.every((c) => Number.isSafeInteger(c.octets) && c.octets >= 0));
  // très grands disques, valeurs à l'octet près
  const gros = repartitionDu({ total: 16 * 1024 ** 4 + 7, libre: 3 * 1024 ** 4 + 3, comptes: { base: 1024 ** 3 + 1, 'site-code': 123_456_789 } });
  assert.equal(somme(gros.repartition), 16 * 1024 ** 4 + 7);
  assert.equal(parCle(gros.repartition).libre, 3 * 1024 ** 4 + 3);
  // une catégorie absente, négative ou illisible compte 0 ; un libre au-delà du total est borné
  assert.deepEqual(parCle(repartitionDu({ total: 100, libre: 500, comptes: { base: -5, images: 'x' } }).repartition), {
    base: 0, images: 0, 'mises-a-jour': 0, metriques: 0, 'site-code': 0, 'site-donnees': 0, 'site-images': 0, 'site-autres': 0, autres: 0, reserve: 0, libre: 100,
  });
  assert.equal(somme(repartitionDu({ total: 0, libre: 0 }).repartition), 0);
  // dépassement : les catégories comptées (un dossier sur un autre disque…) dépassent la place prise → ramenées au prorata, « autres » à 0
  for (const [total, libre, c] of [[10_000, 9000, comptes], [1_000_003, 999_990, { base: 1, images: 1, metriques: 1, 'site-code': 17 }], [997, 0, { base: 333, images: 333, 'site-code': 333, 'site-autres': 333 }]]) {
    const r = repartitionDu({ total, libre, comptes: c });
    const occupe = total - libre;
    assert.equal(somme(r.repartition), total, `${total}, ${libre}`);
    assert.equal(parCle(r.repartition).libre, libre);
    assert.equal(parCle(r.repartition).autres, 0);
    assert.deepEqual(r.depasse, { compte: Object.values(c).reduce((a, b) => a + b, 0), occupe });
    for (const k of CATEGORIES_COMPTEES) assert.ok(parCle(r.repartition)[k] <= (c[k] ?? 0) + 1 && parCle(r.repartition)[k] >= 0, k);
  }
});

test('relevé d’un dossier aux tailles connues : chaque catégorie à l’octet près ; liens symboliques jamais suivis ; images de la base retranchées de la base', () => {
  const { db, site, attendu } = instanceConnue();
  const fichiers = { vivante: join(db, 'vivante.db'), archives: join(db, 'archives'), miseAJour: join(db, 'mise-a-jour'), metriques: join(db, 'metriques'), site };
  const r = releverRepartition(fichiers);
  assert.deepEqual(r.comptes, attendu);
  assert.equal(r.partiel, false);
  assert.equal(r.fichiers, 23, 'les fichiers des dossiers parcourus (pas la base vivante ni son WAL, nommés ; ni etat.json ; ni les liens)');
  assert.ok(r.duree_ms >= 0);
  // les octets des images de la base vivante passent de « base » à « images » (jamais plus que la base)
  const avecImages = releverRepartition({ ...fichiers, imagesDeLaBase: 10_000 });
  assert.equal(avecImages.comptes.base, attendu.base - 10_000);
  assert.equal(avecImages.comptes.images, attendu.images + 10_000);
  assert.equal(releverRepartition({ ...fichiers, imagesDeLaBase: 1e12 }).comptes.base, 0);
  // un dossier compté une fois : le site placé autour de db/ ne recompte ni la base ni ses dossiers
  const englobant = releverRepartition({ ...fichiers, site: dirname(db) });
  assert.equal(englobant.comptes.base, attendu.base);
  assert.equal(englobant.comptes.metriques, attendu.metriques);
  const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  assert.equal(total(englobant.comptes), total(attendu) + octetsSurDisque(lstatSync(dirname(db))),
    'chaque fichier compté une fois (db/ et ses dossiers ne sont pas recomptés dans le site ; seul le dossier englobant s’ajoute)');
  // bornes : le parcours s'arrête (partiel) ; le reste n'est pas compté
  const borne = releverRepartition({ ...fichiers, bornes: { ...PARCOURS, fichiers_max: 5 } });
  assert.equal(borne.partiel, true);
  assert.equal(borne.fichiers, 5);
  assert.equal(releverRepartition({ ...fichiers, bornes: { ...PARCOURS, duree_max_ms: -1 } }).partiel, true);
  // rien à mesurer, ou des dossiers absents : des zéros, sans exception
  assert.deepEqual(releverRepartition({}).comptes, Object.fromEntries(CATEGORIES_COMPTEES.map((c) => [c, 0])));
  assert.deepEqual(releverRepartition({ vivante: join(racine, 'absente.db'), archives: join(racine, 'absent'), site: join(racine, 'absent-aussi') }).comptes.base, 0);
});

test('images de la base vivante : colonnes d’image du modèle de l’édition et portrait des fiches, octets sans lire les images', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE monstre (id TEXT PRIMARY KEY, portrait TEXT); CREATE TABLE monstre_espece (id TEXT PRIMARY KEY, portrait TEXT);
    CREATE TABLE personnage (id TEXT PRIMARY KEY, portrait TEXT, nom TEXT); CREATE TABLE groupe (id TEXT PRIMARY KEY);
    CREATE TABLE race (id TEXT PRIMARY KEY, portrait TEXT)`);
  const image = (n) => `data:image/webp;base64,${'A'.repeat(n - 'data:image/webp;base64,'.length)}`;
  db.prepare('INSERT INTO monstre VALUES (?, ?), (?, ?), (?, NULL)').run('a', image(1000), 'b', image(2500), 'c');
  db.prepare('INSERT INTO monstre_espece VALUES (?, ?)').run('e', image(700));
  db.prepare('INSERT INTO personnage VALUES (?, ?, ?), (?, NULL, ?)').run('p', image(40_000), 'Aldric', 'q', 'Béa');
  db.prepare('INSERT INTO race VALUES (?, ?)').run('r', image(99_999));
  assert.deepEqual(colonnesImagesDe(db).map((c) => `${c.table}.${c.colonne}`).sort(), ['monstre.portrait', 'monstre_espece.portrait', 'personnage.portrait']);
  assert.equal(octetsDesImages(db), 1000 + 2500 + 700 + 40_000, 'ni la colonne « portrait » d’une table hors du modèle, ni une table sans image');
  assert.equal(octetsDesImages(null), 0);
  db.close();
});

test('dossier du site : déduit de la base des règles publiée ou de version.json du service livré ; aucun en développement', () => {
  assert.equal(dossierDuSite({ regles: '/srv/maverick/prod/site/donnees/maverick.db' }), '/srv/maverick/prod/site');
  assert.equal(dossierDuSite({ regles: '/x/var/maverick.db', fichierVersion: '/srv/site/_serveur/version.json' }), '/srv/site');
  assert.equal(dossierDuSite({ regles: '/x/var/maverick.db', fichierVersion: null }), null);
  assert.equal(dossierDuSite({}), null);
});

test('état du système : disque.repartition dont la somme fait disque.total ; relevé gardé 10 minutes ; images de la base demandées au plus une fois par relevé', () => {
  const { db, site, attendu } = instanceConnue();
  let t = Date.parse('2026-10-15T08:00:00Z');
  let appels = 0;
  const m = creerMetriques({
    dossier: join(db, 'metriques'), instance: 'dev', intervalle: 0, horloge: () => t,
    fichiers: { vivante: join(db, 'vivante.db'), archives: join(db, 'archives'), miseAJour: join(db, 'mise-a-jour'), disque: db, site },
    imagesDeLaBase: () => {
      appels += 1;
      return 4096;
    },
  });
  try {
    const s = m.systeme({});
    const d = s.disque;
    assert.equal(somme(d.repartition), d.total, 'EXACTEMENT la taille du disque');
    assert.deepEqual(d.repartition.map((c) => c.cle), REPARTITION.map((c) => c.cle));
    const r = parCle(d.repartition);
    assert.equal(r.libre, d.libre);
    assert.equal(r.base, attendu.base - 4096);
    assert.equal(r.images, attendu.images + 4096);
    assert.equal(r['site-code'], attendu['site-code']);
    assert.equal(r['site-donnees'], attendu['site-donnees']);
    assert.equal(r['mises-a-jour'], attendu['mises-a-jour']);
    assert.ok(r.metriques >= attendu.metriques, 'le dossier des métriques, dev.db de cette instance compris');
    assert.ok(r.autres >= 0);
    assert.equal(d.reserve >= 0, true);
    assert.equal(d.repartition_le, '2026-10-15T08:00:00Z');
    assert.equal(d.repartition_partielle, false);
    assert.equal(appels, 1);
    // gardé : un fichier ajouté ne compte qu'au relevé suivant (10 minutes)
    fichier(join(site, 'nouveau.html'), 50_000);
    t += 9 * MINUTE;
    assert.equal(parCle(m.systeme({}).disque.repartition)['site-code'], attendu['site-code']);
    assert.equal(appels, 1);
    t += 2 * MINUTE;
    const apres = m.systeme({}).disque;
    assert.ok(parCle(apres.repartition)['site-code'] > attendu['site-code']);
    assert.equal(somme(apres.repartition), apres.total);
    assert.equal(apres.repartition_le, '2026-10-15T08:11:00Z');
    assert.equal(appels, 2);
  } finally {
    m.arreter();
  }
});

test('répartition notée dans les échantillons toutes les 10 minutes ; le site de dev affiche celle de la production en lisant prod.db (somme = son disque)', () => {
  const { db, site, attendu } = instanceConnue();
  const dossier = join(db, 'metriques');
  let t = Date.parse('2026-10-15T08:00:00Z');
  const fichiers = { vivante: join(db, 'vivante.db'), archives: join(db, 'archives'), miseAJour: join(db, 'mise-a-jour'), disque: db, site };
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t, fichiers, imagesDeLaBase: () => 1000 });
  const lignes = () => {
    const l = new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
    try {
      return l.prepare('SELECT instant, total, libre, comptes, partiel FROM disque_repartition ORDER BY instant').all().map((x) => ({ ...x }));
    } finally {
      l.close();
    }
  };
  try {
    prod.echantillonner();
    for (let i = 1; i <= 9; i++) {
      t += MINUTE;
      prod.echantillonner();
    }
    prod.verser();
    assert.equal(lignes().length, 1, 'une seule en 10 minutes');
    t += MINUTE;
    prod.echantillonner();
    prod.verser();
    const notees = lignes();
    assert.equal(notees.length, 2, 'la suivante 10 minutes plus tard');
    assert.equal(notees[1].instant - notees[0].instant, 600);
    const comptes = JSON.parse(notees[0].comptes);
    assert.deepEqual(Object.keys(comptes), CATEGORIES_COMPTEES);
    assert.equal(comptes.base, attendu.base - 1000);
    assert.equal(comptes.images, attendu.images + 1000);
    assert.equal(notees[0].partiel, 0);
    assert.ok(Buffer.byteLength(notees[0].comptes) < 220, `une ligne compacte : ${notees[0].comptes}`);
  } finally {
    prod.arreter();
  }
  // le site de dev lit le fichier de la production (lecture seule) : sa dernière répartition, rapportée à son dernier échantillon du disque
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    const s = dev.systeme({ instance: 'prod' });
    assert.equal(s.instance, 'prod');
    assert.equal(somme(s.disque.repartition), s.disque.total);
    assert.equal(parCle(s.disque.repartition).base, attendu.base - 1000);
    assert.equal(parCle(s.disque.repartition)['site-donnees'], attendu['site-donnees']);
    assert.equal(parCle(s.disque.repartition).libre, s.disque.libre);
    assert.equal(s.disque.repartition_le, '2026-10-15T08:10:00Z');
    // une instance sans répartition notée (fichier d'une version plus ancienne) : pas de jauge, sans erreur
    const ancien = new DatabaseSync(join(dossier, 'prod.db'));
    ancien.exec('DROP TABLE disque_repartition');
    ancien.close();
    assert.equal(dev.systeme({ instance: 'prod' }).disque.repartition, null);
    assert.ok(dev.systeme({ instance: 'prod' }).volume.metriques_octets > 0, 'le volume se calcule quand même');
  } finally {
    dev.arreter();
  }
});

test('rétention de la répartition (horloge injectée) : 14 jours toutes les 10 minutes, puis la dernière de chaque jour jusqu’à 400 jours', () => {
  const T = Date.parse('2026-10-15T12:00:00Z');
  let t = T;
  const dossier = dossierNeuf();
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t, fichiers: { disque: dossier } });
  const instants = () => {
    const l = new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
    try {
      return l.prepare('SELECT instant FROM disque_repartition ORDER BY instant').all().map((x) => x.instant);
    } finally {
      l.close();
    }
  };
  try {
    const noter = (quand) => {
      t = quand;
      m.echantillonner();
    };
    noter(T - 401 * JOUR); // hors des 400 jours
    for (const h of [8, 9, 10]) noter(Date.parse('2026-09-20T00:00:00Z') + h * 3600_000); // il y a 25 jours : la dernière (10 h) reste
    for (const h of [8, 9]) noter(T - 2 * JOUR + h * 3600_000); // il y a 2 jours : toutes restent
    t = T;
    assert.equal(m.verser(), true);
    assert.equal(instants().length, 6);
    const r = m.purger();
    assert.equal(r.lignes.disque_repartition, 3, 'deux éclaircies, une trop ancienne');
    assert.deepEqual(instants(), [Date.parse('2026-09-20T10:00:00Z') / 1000, (T - 2 * JOUR + 8 * 3600_000) / 1000, (T - 2 * JOUR + 9 * 3600_000) / 1000]);
    // le volume la compte : 144 par jour, à terme 14 jours × 144 + 386 jours × 1
    const v = m.systeme({}).volume;
    assert.equal(v.lignes_par_jour.disque_repartition, 144);
    assert.equal(RETENTION.repartition_10min, 14);
    assert.equal(RETENTION.repartition_jour, 400);
  } finally {
    m.arreter();
  }
});

test('alertes de la répartition : fichiers comptés au-delà de la place prise (avertissement), parcours arrêté à sa borne (info)', () => {
  const a = alertesDu({ repartition: { depasse: { compte: 3 * 1024 ** 3, occupe: 2 * 1024 ** 3 }, partiel: true } });
  assert.deepEqual(a.map((x) => x.niveau), ['avertissement', 'info']);
  assert.match(a[0].message, /3\.0 Gio.*2\.0 Gio.*autre disque/);
  assert.match(a[1].message, /partielle.*Système et autres/);
  assert.deepEqual(alertesDu({ repartition: { depasse: null, partiel: false } }), []);
  // le parcours borné par le collecteur : l'alerte arrive dans l'état du système
  const { db, site } = instanceConnue();
  const m = creerMetriques({ dossier: join(db, 'metriques'), instance: 'dev', intervalle: 0, fichiers: { disque: db, site }, parcours: { ...PARCOURS, fichiers_max: 2 } });
  try {
    const s = m.systeme({});
    assert.equal(s.disque.repartition_partielle, true);
    assert.ok(s.alertes.some((x) => x.niveau === 'info' && /partielle/.test(x.message)));
    assert.equal(somme(s.disque.repartition), s.disque.total);
  } finally {
    m.arreter();
  }
  assert.ok(disqueDe(racine).total > 0);
});

test('relevé de l’hôte (volume-hote.json, VPS) : ce que le conteneur ne voit pas s’ajoute avant « Système et autres » ; périmé, illisible ou d’un autre disque : écarté et signalé', () => {
  const dossier = dossierNeuf();
  const chemin = join(dossier, RELEVE_HOTE.fichier);
  const T = Date.parse('2026-10-15T12:00:00Z');
  const total = 80 * 1024 ** 3;
  const element = (cle, nom, instance, cheminElement, octets) => ({ cle, nom, instance, chemin: cheminElement, octets });
  const releve = (o = {}) => ({
    format: 1, instant: '2026-10-15T11:50:00Z', duree_ms: 600, disque: { dossier: '/srv/maverick-center', total, utilise: 0, libre: 0, reserve: 0 },
    depasse: null, repartition: [],
    elements: [
      element('base', 'base vivante', 'prod', '/srv/maverick-center/db/vivante.db', 1000),
      element('base', 'archives de la base vivante', 'prod', '/srv/maverick-center/db/archives', 2000),
      element('base', 'autres fichiers de db/', 'prod', '/srv/maverick-center/db', 30),
      element('base', 'base vivante', 'dev', '/srv/maverick-center-test/db/vivante.db', 4000),
      element('base', 'sauvegardes à la main (vivante-*.db)', null, '/root', 500),
      element('images', 'portraits publiés du site', 'prod', '/srv/maverick-center/site', 70),
      element('images', 'portraits publiés du site', 'dev', '/srv/maverick-center-test/site', 80),
      element('mises-a-jour', 'lots figés de la mise à jour', 'dev', '/srv/maverick-center-test/db/mise-a-jour', 90),
      element('site-code', 'code du site', 'prod', '/srv/maverick-center/site', 100),
      element('site-code', 'code du site', 'dev', '/srv/maverick-center-test/site', 200),
      element('site-autres', 'réglages, scripts et dossiers de l’instance', 'prod', '/srv/maverick-center', 7),
      element('metriques', 'bases des métriques', null, '/srv/maverick-center/metriques', 999_999),
      element('docker', 'images, conteneurs et volumes', null, '/var/lib/docker', 300_000),
      element('journaux', 'journaux des conteneurs (docker logs)', null, '/var/lib/docker/containers', 5000),
      element('journaux', 'journaux des scripts (*.log)', 'prod', '/srv/maverick-center', 11),
      element('installations', 'installation en cours ou interrompue', 'dev', '/srv/maverick-center-test', 600),
      element('inconnue', 'une clé d’une version future', null, '/x', 12_345),
    ],
    hors_disque: [element('journaux', 'journaux du système', null, '/var/log', 77_777)],
    ...o,
  });
  const ecrire = (r) => writeFileSync(chemin, typeof r === 'string' ? r : JSON.stringify(r));
  assert.equal(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total }), null, 'pas de fichier : NAS, développement');
  ecrire(releve());
  // la production : ses propres base vivante, archives, lots et site sont mesurés par son service (pas repris) ; le reste de l'hôte s'ajoute
  const prod = lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total });
  assert.equal(prod.utilise, true);
  assert.equal(prod.instant, Date.parse('2026-10-15T11:50:00Z'));
  assert.deepEqual(prod.comptes, {
    docker: 300_000, journaux: 5000 + 11, installations: 600, base: 30 + 4000 + 500, images: 80, 'mises-a-jour': 90, 'site-code': 200, 'site-autres': 7,
  });
  // le site de dev : l'inverse pour les deux instances ; jamais les métriques (le dossier partagé est compté par le service), ni hors_disque, ni une
  // clé inconnue
  const dev = lireReleveDeLHote(chemin, { instance: 'dev', maintenant: T, total });
  assert.deepEqual(dev.comptes, {
    docker: 300_000, journaux: 5000 + 11, installations: 600, base: 1000 + 2000 + 30 + 500, images: 70, 'site-code': 100, 'site-autres': 7,
  });
  // additionné aux comptes du service : les catégories de l'hôte apparaissent dans la jauge, avant « autres », et la somme fait toujours le disque
  const comptes = comptesAvecLHote({ base: 10, images: 1, 'mises-a-jour': 0, metriques: 5, 'site-code': 20, 'site-donnees': 0, 'site-images': 0, 'site-autres': 0 }, prod);
  const { repartition } = repartitionDu({ total: 1_000_000, libre: 400_000, comptes });
  assert.deepEqual(repartition.map((c) => c.cle), [...CATEGORIES_COMPTEES, ...CATEGORIES_HOTE, 'autres', 'reserve', 'libre']);
  assert.deepEqual(repartition.slice(-6, -3).map((c) => c.libelle), REPARTITION_HOTE.map((c) => c.libelle));
  assert.equal(somme(repartition), 1_000_000);
  assert.equal(parCle(repartition).base, 10 + 4530);
  assert.equal(parCle(repartition).docker, 300_000);
  assert.deepEqual(comptesAvecLHote({ base: 1 }, null), { base: 1 }, 'sans relevé : rien ne change (et pas de catégorie de l’hôte à 0)');
  assert.deepEqual(repartitionDu({ total: 10, libre: 5, comptes: { base: 1 } }).repartition.map((c) => c.cle), REPARTITION.map((c) => c.cle));
  // écarté : périmé (plus d'une heure), d'un autre disque, illisible, d'un autre format
  const perime = lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T + RELEVE_HOTE.perime_ms, total });
  assert.equal(perime.utilise, false);
  assert.match(perime.raison, /périmé.*maverick-volume\.timer/);
  assert.equal(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total: total * 1.05 }).utilise, false);
  assert.match(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total: total * 1.05 }).raison, /autre disque/);
  assert.equal(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total: total * 1.005 }).utilise, true, 'à 1 % près');
  ecrire('{ pas du json');
  assert.match(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total }).raison, /illisible/);
  ecrire(releve({ format: 2 }));
  assert.match(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total }).raison, /format inconnu/);
  ecrire(releve({ instant: 'hier' }));
  assert.equal(lireReleveDeLHote(chemin, { instance: 'prod', maintenant: T, total }).utilise, false);
  // un relevé écarté laisse la jauge du service telle quelle et le dit (info) ; l'état du système le porte (repartition_hote)
  const alertes = alertesDu({ repartition: { depasse: null, partiel: false, hote: perime } });
  assert.deepEqual(alertes.map((a) => a.niveau), ['info']);
  assert.match(alertes[0].message, /sans le relevé de l’hôte.*Système et autres/);
  const m = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => T + 2 * RELEVE_HOTE.perime_ms, fichiers: { disque: dossier } });
  try {
    ecrire(releve());
    const s = m.systeme({});
    assert.equal(s.disque.repartition_hote.utilise, false);
    assert.equal(s.disque.repartition_hote.releve_le, '2026-10-15T11:50:00Z');
    assert.deepEqual(s.disque.repartition.map((c) => c.cle), REPARTITION.map((c) => c.cle), 'pas de catégorie de l’hôte');
    assert.ok(s.alertes.some((a) => /sans le relevé de l’hôte/.test(a.message)));
  } finally {
    m.arreter();
  }
});

test('réserve de root : notée avec la répartition (schéma 3) ; un fichier de la version 2 reçoit la colonne à l’ouverture, et lu par une autre instance il garde la réserve dans « Système et autres »', () => {
  const dossier = dossierNeuf();
  // un fichier de la version 2 : le schéma d'aujourd'hui sans la colonne de la réserve
  const t = 1_792_000_060_000;
  creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t }).arreter();
  const ancien = new DatabaseSync(join(dossier, 'prod.db'));
  ancien.exec('ALTER TABLE disque_repartition DROP COLUMN reserve; ALTER TABLE disque_repartition DROP COLUMN images_base; PRAGMA user_version = 2;');
  // après l'échantillon que l'arrêt vient de noter (le dernier est celui qui compte)
  ancien.prepare('INSERT INTO systeme_minute (instant, disque_libre, disque_total) VALUES (?, ?, ?)').run(1_792_000_100, 600, 1000);
  ancien.prepare('INSERT INTO disque_repartition VALUES (?, ?, ?, ?, 0)').run(1_792_000_100, 1000, 600, JSON.stringify({ base: 100 }));
  ancien.close();
  const dev = creerMetriques({ dossier, instance: 'dev', intervalle: 0, horloge: () => t });
  try {
    const d = dev.systeme({ instance: 'prod' }).disque;
    assert.deepEqual(parCle(d.repartition), { ...Object.fromEntries(CATEGORIES_COMPTEES.map((c) => [c, 0])), base: 100, autres: 300, reserve: 0, libre: 600 });
  } finally {
    dev.arreter();
  }
  // la production rouvre son fichier : les colonnes sont ajoutées, la réserve notée (schéma 3, puis 4)
  const prod = creerMetriques({ dossier, instance: 'prod', intervalle: 0, horloge: () => t, fichiers: { disque: dossier } });
  try {
    prod.echantillonner();
    assert.equal(prod.verser(), true);
  } finally {
    prod.arreter();
  }
  const lu = new DatabaseSync(join(dossier, 'prod.db'), { readOnly: true });
  try {
    assert.equal(lu.prepare('PRAGMA user_version').get().user_version, SCHEMA_METRIQUES);
    const l = lu.prepare('SELECT total, libre, reserve FROM disque_repartition WHERE instant = ?').get(t / 1000);
    const disque = disqueDe(dossier);
    assert.equal(l.reserve, disque.reserve, 'la réserve de statfs');
    assert.ok(l.total === disque.total);
  } finally {
    lu.close();
  }
});
