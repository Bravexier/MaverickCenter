// L'atelier du site de dev, côté service (serveur/atelier.mjs ; lot 9 du chantier de la base de dev, PR 3) : les états (pas d'atelier, non installé, en attente, en cours,
// rapport), la lecture bornée et validée des rapports de root (jamais un champ inconnu, jamais un lien, jamais un fichier trop gros), l'extrait du contenu tenu à jour
// (version changée : tout de suite ; contenu changé : après un délai ; jamais avant l'installation), la route GET /api/debug/atelier/ (403 en production).
//   node --test test/serveur-atelier.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  ANCIEN_DOSSIER_DE_L_EXTRAIT, FICHIER_DU_CONTENU, FORMAT_ETAT_DE_L_ATELIER, RAPPORTS_GARDES, creerAtelier, lireUnRapport, listerLesRapports, nomDeLExtrait, validerLaComparaison,
  validerLaFabrication, validerLeKit, validerLeRapport,
} from '../serveur/atelier.mjs';
import { demarrerService } from '../serveur/service.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const KIT = { format: 'maverick-kit/1', version: '0.4.95', node: '22', image: 'node:22-bookworm-slim', plateforme: { os: 'linux', arch: 'x64', libc: 'glibc' }, fichiers: 11902, taille_decompressee_octets: 191021072, taille_archive_octets: 57504685 };
const INSTALLE = { format: 'maverick-atelier-installe/1', installe_le: '2026-11-15T10:00:00Z', reglages: { memoire_max_ko: 2621440, besoin_ko: 1572864, cpus: 1, disque_min_ko: 2097152, delai_s: 1800 } };
const rapportDe = (id, plus = {}) => ({
  format: 'maverick-atelier/1', id, issue: 'fait', motif: null, horodatage: '2026-11-15T10:15:00Z', version_installee: '0.4.95', version_du_kit: '0.4.95', tag: 'v0.4.95',
  serveur: { processeurs: 4, memoire_totale_ko: 8388608, memoire_disponible_ko: 6291456, disque_total_ko: 100000000, disque_libre_ko: 60000000, charge: [0.5, 0.4, 0.3] },
  reglages: INSTALLE.reglages, plafond_ko: 2621440, marge_ko: 3670016, duree_ms: 21000, code_sortie: 0, memoire: { pic_ko: 1400000, source: 'cgroup' }, cpu_ms: 40000,
  place: { kit_ko: 190000, travail_ko: 190000, sortie_ko: 180000 }, fabrication: true, comparaison: true, ...plus,
});
const FABRICATION = { format: 'maverick-fabrication/1', statut: 'ok', mode: 'deux-temps', node: 'v22.23.4', debut: '2026-11-15T10:15:00.000Z', duree_ms: 20000,
  etapes: [{ nom: 'controle', duree_ms: 300, statut: 'ok' }, { nom: 'build', duree_ms: 18000, statut: 'ok' }], contenu: { octets: 30000000, version_du_site: '0.4.95', schema: 129, pages: 1169, empreinte: 'a'.repeat(64), fabrique_le: '2026-11-15T10:00:00Z' },
  sortie: { fichiers: 2107, octets: 185765000 }, memoire: { pic_ko: 1380000, cumul_ko: 1500000, processus: 3, par_etape: { build: { pic_ko: 1380000, cumul_ko: 1380000, processus: 2 } } }, erreur: null, secret: 'jamais' };
const COMPARAISON = { format: 'maverick-comparaison/1', a: { fichiers: 2109, octets: 1 }, b: { fichiers: 2107, octets: 1 }, identiques: 2106, differents: { nombre: 0, exemples: [] },
  seulement_a: { nombre: 0, exemples: [] }, seulement_b: { nombre: 0, exemples: [] }, variables: { nombre: 3, par_cause: { 'base publiée : autre forme': 3 }, exemples: [{ fichier: 'donnees/maverick.db', cause: 'base publiée' }] }, equivalents: true };

const ecrire = (chemin, valeur) => { mkdirSync(join(chemin, '..'), { recursive: true }); writeFileSync(chemin, typeof valeur === 'string' ? valeur : `${JSON.stringify(valeur)}\n`); };
function poserUnRapport(rapports, id, { rapport = rapportDe(id), fabrication = FABRICATION, comparaison = COMPARAISON } = {}) {
  ecrire(join(rapports, id, 'rapport.json'), rapport);
  if (fabrication) ecrire(join(rapports, id, 'fabrication.json'), fabrication);
  if (comparaison) ecrire(join(rapports, id, 'comparaison.json'), comparaison);
}

/** Un monde : db/ (où le service range l'extrait), rapports/ (ce que root écrit), une petite base vivante, un atelier avec une fabrication de l'extrait simulée. */
function monde(t, { edition = true, version = '0.4.95', kit = true, installe = true, delai = 600_000, ...options } = {}) {
  const racine = dossierTemporaire('serveur-atelier', { t });
  const dossier = join(racine, 'db');
  const rapports = join(racine, 'rapports');
  const depot = join(racine, 'depot'); // le dépôt de l'atelier : créé par root au geste, monté dans le service
  mkdirSync(dossier);
  mkdirSync(rapports);
  if (installe) mkdirSync(depot);
  if (kit) ecrire(join(rapports, 'kit.json'), KIT);
  if (installe) ecrire(join(rapports, 'installe.json'), INSTALLE);
  // de quoi calculer la clé de changement du contenu (extrait.mjs#cleDeChangement)
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE modification (lot_id INTEGER, rang INTEGER, etat TEXT, avant TEXT, apres TEXT, detail TEXT);
    CREATE TABLE modification_lot (id INTEGER PRIMARY KEY, fait_le TEXT, resolu_le TEXT, resolu_par INTEGER, resolution TEXT);
    CREATE TABLE historique_modification (id INTEGER PRIMARY KEY); CREATE TABLE note_version (id INTEGER PRIMARY KEY); CREATE TABLE note_version_ligne (id INTEGER PRIMARY KEY)`);
  t.after(() => db.close());
  const etat = { version, horloge: 1_000_000, fabrications: [], echec: false };
  const atelier = creerAtelier({
    dossier, rapports, depot: installe ? depot : null, edition, version: () => etat.version, base: () => db, delai, intervalle: 0, horloge: () => etat.horloge,
    fabriquer: async ({ destination, version: v }) => {
      etat.fabrications.push(v);
      if (etat.echec) throw new Error('fabrication refusée par l’essai');
      writeFileSync(destination, `extrait de la version ${v}`);
      return { fabrique_le: '2026-11-15T10:00:00Z', fichier: { octets: 24 }, empreinte: 'b'.repeat(64), duree_ms: 12 };
    },
    journal: (m) => etat.journal?.push(m), evenement: (type, o) => etat.evenements?.push({ type, ...o }), ...options,
  });
  etat.journal = [];
  etat.evenements = [];
  return { racine, dossier, rapports, db, atelier, etat, extrait: depot };
}

test('états : pas d’atelier (production, kit absent d’un dossier monté), non installé (rien de monté, ou kit sans geste), en attente, en cours, rapport', async (t) => {
  const prod = monde(t, { edition: false });
  assert.equal(prod.atelier.lire().etat, 'pas_d_atelier');
  assert.equal(prod.atelier.lire().format, FORMAT_ETAT_DE_L_ATELIER);

  const sansDossier = creerAtelier({ dossier: join(prod.racine, 'db'), rapports: join(prod.racine, 'absent'), edition: true, version: () => '0.4.95', base: () => null, intervalle: 0 });
  // avant le geste du propriétaire (rien de monté) : « non installé », sans erreur, et sans rien fabriquer
  assert.equal(sansDossier.lire().etat, 'non_installe');
  assert.match(sansDossier.lire().message, /installer\.sh/);
  const sansMontage = creerAtelier({ dossier: prod.dossier, rapports: null, edition: true, version: () => '0.4.95', base: () => null, intervalle: 0 });
  assert.equal(sansMontage.lire().etat, 'non_installe');
  assert.equal(await sansMontage.passer(), 'inactif');

  const sansKit = monde(t, { kit: false, installe: false });
  const e1 = sansKit.atelier.lire();
  assert.equal(e1.etat, 'pas_d_atelier');
  assert.match(e1.message, /kit/i);

  const nonInstalle = monde(t, { installe: false });
  const e2 = nonInstalle.atelier.lire();
  assert.equal(e2.etat, 'non_installe');
  assert.match(e2.message, /installer\.sh/);
  assert.equal(e2.kit.image, 'node:22-bookworm-slim');
  assert.equal(e2.installe, null);

  const attente = monde(t);
  const e3 = attente.atelier.lire();
  assert.equal(e3.etat, 'en_attente');
  assert.deepEqual(e3.historique, []);
  assert.equal(e3.installe.reglages.cpus, 1);

  ecrire(join(attente.rapports, 'en-cours.json'), { format: 'maverick-atelier-en-cours/1', debut: '2026-11-15T10:10:00Z', version_installee: '0.4.95' });
  const e4 = attente.atelier.lire();
  assert.equal(e4.etat, 'en_cours');
  assert.equal(e4.en_cours.version_installee, '0.4.95');
  writeFileSync(join(attente.rapports, 'en-cours.json'), '{ pas du json');
  assert.equal(attente.atelier.lire().etat, 'en_attente', 'un en-cours illisible n’en est pas un');
  writeFileSync(join(attente.rapports, 'en-cours.json'), '{}');
  poserUnRapport(attente.rapports, '20261115-101500');
  const e5 = attente.atelier.lire();
  assert.equal(e5.etat, 'rapport');
  assert.equal(e5.dernier.id, '20261115-101500');
  assert.equal(e5.dernier.fabrication.sortie.fichiers, 2107);
  assert.equal(e5.dernier.comparaison.equivalents, true);
  assert.match(e5.resume, /tient/);
  assert.equal(e5.historique.length, 1);
  assert.equal(e5.historique[0].pic_ko, 1400000);

  attente.etat.version = '0.4.96';
  const e6 = attente.atelier.lire();
  assert.equal(e6.etat, 'en_attente', 'le rapport est celui d’une autre version : on attend la suivante');
  assert.equal(e6.dernier.version_installee, '0.4.95', 'mais la dernière mesure reste visible');
});

test('un refus et un arrêt par manque de mémoire sont des mesures : le résumé les dit, avec les chiffres relevés', (t) => {
  const m = monde(t);
  poserUnRapport(m.rapports, '20261115-101500', {
    rapport: rapportDe('20261115-101500', { issue: 'refus', motif: 'memoire_insuffisante', plafond_ko: 900000, marge_ko: 900000, fabrication: false, comparaison: false, duree_ms: 40, memoire: { pic_ko: null, source: null } }),
    fabrication: null, comparaison: null,
  });
  const refus = m.atelier.lire();
  assert.equal(refus.etat, 'rapport');
  assert.equal(refus.dernier.issue, 'refus');
  assert.equal(refus.dernier.plafond_ko, 900000);
  assert.equal(refus.dernier.fabrication, null);
  assert.match(refus.resume, /ne tient pas/);
  poserUnRapport(m.rapports, '20261115-111500', { rapport: rapportDe('20261115-111500', { issue: 'oom', code_sortie: 137, fabrication: false, comparaison: false }), fabrication: null, comparaison: null });
  const oom = m.atelier.lire();
  assert.equal(oom.dernier.issue, 'oom');
  assert.deepEqual(oom.historique.map((h) => h.issue), ['oom', 'refus']);
  assert.match(oom.resume, /manque de mémoire/);
});

test('les rapports : bornés, validés, jamais un lien, un champ inconnu, un autre format ou un identifiant qui n’est pas celui du dossier', (t) => {
  const { rapports } = monde(t);
  poserUnRapport(rapports, '20261115-101500');
  const lu = lireUnRapport(rapports, '20261115-101500');
  assert.ok(!('secret' in lu.fabrication), 'un champ inconnu n’entre pas');
  assert.equal(lu.fabrication.etapes.length, 2);
  assert.deepEqual(lu.invalides, []);

  // un autre format, un autre identifiant
  poserUnRapport(rapports, '20261115-102000', { rapport: { ...rapportDe('20261115-102000'), format: 'autre/1' } });
  assert.equal(lireUnRapport(rapports, '20261115-102000'), null);
  poserUnRapport(rapports, '20261115-102500', { rapport: rapportDe('20261115-999999') });
  assert.equal(lireUnRapport(rapports, '20261115-102500'), null);
  assert.equal(validerLeRapport({ ...rapportDe('20261115-103000'), issue: 'inconnue' }, '20261115-103000'), null);

  // trop gros : refusé, et dit
  poserUnRapport(rapports, '20261115-103500', { fabrication: { ...FABRICATION, remplissage: 'x'.repeat(300_000) } });
  const gros = lireUnRapport(rapports, '20261115-103500');
  assert.equal(gros.fabrication, null);
  assert.match(gros.invalides.join(' '), /fabrication\.json/);
  // un lien symbolique à la place du fichier : jamais suivi
  poserUnRapport(rapports, '20261115-104000', { comparaison: null });
  ecrire(join(rapports, 'ailleurs.json'), COMPARAISON);
  symlinkSync(join(rapports, 'ailleurs.json'), join(rapports, '20261115-104000', 'comparaison.json'));
  const lien = lireUnRapport(rapports, '20261115-104000');
  assert.equal(lien.comparaison, null);
  assert.match(lien.invalides.join(' '), /comparaison\.json/);
  // du JSON qui n'en est pas
  poserUnRapport(rapports, '20261115-104500', { comparaison: '{ pas du json' });
  assert.match(lireUnRapport(rapports, '20261115-104500').invalides.join(' '), /comparaison/);

  // des textes et des nombres hors bornes sont ramenés à rien
  const hostile = validerLaFabrication({ ...FABRICATION, erreur: { etape: '<b>build</b>', message: '<script>alert(1)</script> échec' }, duree_ms: -5, sortie: { fichiers: 1e30, octets: 'beaucoup' } });
  assert.ok(!/[<>]/.test(hostile.erreur.etape + hostile.erreur.message));
  assert.equal(hostile.duree_ms, null);
  assert.deepEqual(hostile.sortie, { fichiers: null, octets: null });
  assert.equal(validerLaComparaison({ ...COMPARAISON, equivalents: 'oui' }).equivalents, null);
  assert.equal(validerLeKit({ ...KIT, format: 'autre' }), null);
  assert.equal(validerLeKit({ ...KIT, image: 'node:22; rm -rf /' }).image, null, 'une image qui n’a pas la forme de celles du kit n’est pas rendue');
});

test('l’historique garde les derniers rapports, du plus récent au plus ancien ; seuls les dossiers de la bonne forme comptent', (t) => {
  const m = monde(t);
  for (let i = 0; i < RAPPORTS_GARDES + 5; i += 1) poserUnRapport(m.rapports, `20261115-${String(1000000 + i).slice(1)}`, { fabrication: null, comparaison: null, rapport: rapportDe(`20261115-${String(1000000 + i).slice(1)}`, { fabrication: false, comparaison: false }) });
  mkdirSync(join(m.rapports, 'pas-un-rapport'));
  writeFileSync(join(m.rapports, '20261115-999999'), 'un fichier, pas un dossier');
  const ids = listerLesRapports(m.rapports);
  assert.equal(ids.length, RAPPORTS_GARDES);
  assert.deepEqual([...ids].sort().reverse(), ids);
  const etat = m.atelier.lire();
  assert.equal(etat.historique.length, RAPPORTS_GARDES);
  assert.equal(etat.dernier.id, ids[0]);
  assert.equal(etat.historique[0].id, ids[0]);
});

test('l’extrait du contenu : rien avant l’installation de l’atelier, jamais en production ; puis un fichier par version, tenu à jour', async (t) => {
  const prod = monde(t, { edition: false });
  assert.equal(await prod.atelier.passer(), 'inactif');
  const nonInstalle = monde(t, { installe: false });
  assert.equal(await nonInstalle.atelier.passer(), 'inactif');
  assert.ok(!existsSync(nonInstalle.extrait), 'avant le geste du propriétaire, le service ne fabrique rien');
  // l'extrait d'avant le dépôt de root, sous db/ : retiré
  const avant = monde(t);
  mkdirSync(join(avant.dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT), { recursive: true });
  writeFileSync(join(avant.dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT, 'contenu-0.4.90.db'), 'ancien extrait');
  assert.equal(await avant.atelier.passer(), 'fabrique');
  assert.ok(!existsSync(join(avant.dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT)), 'plus rien de l’atelier sous db/');
  assert.ok(existsSync(join(avant.extrait, nomDeLExtrait('0.4.95'))));

  const m = monde(t);
  // sans dépôt monté (avant le geste), le service ne fabrique rien : il n'a nulle part où écrire
  const sansDepot = creerAtelier({ dossier: m.dossier, rapports: m.rapports, depot: null, edition: true, version: () => '0.4.95', base: () => m.db, intervalle: 0, fabriquer: async () => { throw new Error('jamais'); } });
  assert.equal(await sansDepot.passer(), 'inactif');
  assert.equal(sansDepot.lire().extrait, null);
  assert.ok(!existsSync(join(m.dossier, ANCIEN_DOSSIER_DE_L_EXTRAIT)), 'et jamais sous db/');
  const rapportsAvant = readdirSync(m.rapports).sort();
  assert.equal(await m.atelier.passer(), 'fabrique');
  assert.deepEqual(m.etat.fabrications, ['0.4.95']);
  assert.equal(readFileSync(join(m.extrait, nomDeLExtrait('0.4.95')), 'utf8'), 'extrait de la version 0.4.95');
  const contenu = JSON.parse(readFileSync(join(m.extrait, FICHIER_DU_CONTENU), 'utf8'));
  assert.equal(contenu.version, '0.4.95');
  assert.equal(m.etat.evenements.at(-1).type, 'atelier_extrait');
  assert.equal(await m.atelier.passer(), 'a_jour', 'rien n’a changé : rien n’est refait');
  assert.equal(m.etat.fabrications.length, 1);
  assert.equal(m.atelier.lire().extrait.a_jour, true);
  assert.deepEqual(readdirSync(m.rapports).sort(), rapportsAvant, 'le service n’écrit jamais dans le dossier des rapports de root');
  assert.ok(!readdirSync(m.extrait).some((n) => n.startsWith('.')), 'aucun fichier provisoire');

  // le contenu change (une saisie sur le site de dev) : le délai d'abord, puis l'extrait refait, au même nom
  m.db.exec("INSERT INTO modification_lot (id, fait_le) VALUES (1, '2026-11-15T10:30:00Z')");
  assert.equal(await m.atelier.passer(), 'attente');
  assert.equal(m.atelier.lire().extrait.a_jour, false);
  m.etat.horloge += 599_000;
  assert.equal(await m.atelier.passer(), 'attente');
  m.etat.horloge += 2_000;
  assert.equal(await m.atelier.passer(), 'fabrique');
  assert.deepEqual(m.etat.fabrications, ['0.4.95', '0.4.95']);

  // l'atelier est retiré (root a effacé installe.json) : l'extrait s'en va avec lui, rien d'autre
  rmSync(join(m.rapports, 'installe.json'));
  assert.equal(await m.atelier.passer(), 'inactif');
  assert.deepEqual(readdirSync(m.extrait), [], 'le dépôt (le dossier de root) reste, vide : seul ce que le service y a mis part');
  ecrire(join(m.rapports, 'installe.json'), INSTALLE);
  assert.equal(await m.atelier.passer(), 'fabrique');

  // une nouvelle version : tout de suite, et l'extrait de l'ancienne version part
  m.etat.version = '0.4.96';
  assert.equal(await m.atelier.passer(), 'fabrique');
  assert.deepEqual(readdirSync(m.extrait).filter((n) => n.endsWith('.db')), [nomDeLExtrait('0.4.96')]);
});

test('une fabrication de l’extrait qui échoue n’arrête rien : « echec », rien de provisoire, le journal le dit, elle est retentée au passage suivant', async (t) => {
  const m = monde(t);
  m.etat.echec = true;
  assert.equal(await m.atelier.passer(), 'echec');
  assert.ok(!existsSync(join(m.extrait, nomDeLExtrait('0.4.95'))));
  assert.deepEqual(readdirSync(m.extrait), [], 'rien de provisoire dans le dépôt');
  assert.match(m.etat.journal.join('\n'), /ERREUR atelier/);
  m.etat.echec = false;
  assert.equal(await m.atelier.passer(), 'fabrique');
});

test('un rapport nouveau est noté : une ligne du journal et un évènement des métriques (refus et OOM compris) ; pas celui d’avant le démarrage', async (t) => {
  const m = monde(t);
  poserUnRapport(m.rapports, '20261115-090000');
  await m.atelier.passer();
  assert.ok(!m.etat.evenements.some((e) => e.type === 'atelier_fabrication'), 'le rapport d’avant n’est pas renoté');
  poserUnRapport(m.rapports, '20261115-101500', { rapport: rapportDe('20261115-101500', { issue: 'oom', code_sortie: 137, fabrication: false, comparaison: false }), fabrication: null, comparaison: null });
  await m.atelier.passer();
  const evenement = m.etat.evenements.find((e) => e.type === 'atelier_fabrication');
  assert.equal(evenement.detail.issue, 'oom');
  assert.match(m.etat.journal.join('\n'), /atelier : .*manque de mémoire/);
  await m.atelier.passer();
  assert.equal(m.etat.evenements.filter((e) => e.type === 'atelier_fabrication').length, 1, 'une seule fois');
});

test('GET /api/debug/atelier/ : l’état sur le site de dev, 403 en production, jamais une écriture', async (t) => {
  const racine = dossierTemporaire('serveur-atelier-api', { t });
  const regles = join(racine, 'regles.db');
  copyFileSync(cheminBase({ sansExemples: false }), regles);
  const rapports = join(racine, 'rapports');
  ecrire(join(rapports, 'kit.json'), KIT);
  poserUnRapport(rapports, '20261115-101500');
  ecrire(join(rapports, 'installe.json'), INSTALLE);
  const demarrer = (nom, options) => demarrerService({ regles, dossier: join(racine, nom), port: 0, intervalle: 0, journal: () => {}, tipeee: false, metriques: false, ...options });
  const dev = await demarrer('dev', { edition: true, atelier: { rapports, intervalle: 0 } });
  t.after(() => dev.arreter());
  const r = await fetch(`${dev.url}/api/debug/atelier/`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const corps = await r.json();
  assert.equal(corps.format, FORMAT_ETAT_DE_L_ATELIER);
  assert.ok(['rapport', 'en_attente'].includes(corps.etat));
  assert.equal(corps.dernier.id, '20261115-101500');
  assert.equal((await fetch(`${dev.url}/api/debug/atelier/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405);

  const prod = await demarrer('prod', { edition: false });
  t.after(() => prod.arreter());
  assert.equal((await fetch(`${prod.url}/api/debug/atelier/`)).status, 403);
  const sans = await demarrer('sans', { edition: true, atelier: false });
  t.after(() => sans.arreter());
  assert.equal((await fetch(`${sans.url}/api/debug/atelier/`)).status, 503);
});
