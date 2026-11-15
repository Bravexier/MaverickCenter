// Le paquet de la base source (lot 8 : serveur/paquet.mjs ; docs/serveur.md, « Mise à jour depuis la base source (lot 8) ») : un fichier neuf sans fiche,
// compte, groupe ni journal, la note de version et l'historique écrits dedans (pas dans la base source : garde-fou 8), la copie vers le dépôt sans note,
// le refus avant l'envoi (attestation absente, élément cité par des fiches de la production absent du paquet, hors ce que R42 retire), les routes
// /api/mise-a-jour/lancer/ et …/copier/ avec le marqueur, le paquet servi tel quel, et le report de la note et de l'historique après la confirmation de la
// production, une seule fois.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, beforeEach, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ecrireAttestation, fabriquerAttestation } from '../serveur/attestation.mjs';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { annonceDuLancement } from '../serveur/maintenance.mjs';
import { CONFIRMATION, fichierPaquet, lireLancement } from '../serveur/notes-de-version.mjs';
import {
  actualiser, citationsManquantes, CONFIRMATION_COPIE, ENTETE_SQLITE, fabriquerPaquet, FORMAT_PAQUET, lireMetaDuPaquet, reporterPaquet, TABLES_RETIREES_DES_FICHES,
} from '../serveur/paquet.mjs';
import { RETRAITS } from '../serveur/fiches-retraits.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { CLASSES_DE_TABLES, classeDeLaTable } from '../src/lib/tables-de-la-base.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { versionLibre } from './aide-mise-a-jour.mjs';
import { marquesDesFiches, poserDesFiches } from './aide-fiches-sentinelles.mjs';

const racine = dossierTemporaire('paquet');
const regles = cheminBase({ sansExemples: false });
const dossier = join(racine, 'db');
const { chemin } = preparerBaseVivante({ regles, dossier });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

// des fiches, un compte et un groupe aux noms-sentinelles : aucun octet du paquet ne doit les porter
const poses = poserDesFiches(db);

// une version X.Y qu'aucune note de data/rows ne porte (une note peut attendre sa livraison) : la production et le service sont à la X.Y-1
const CIBLE = versionLibre(db);
const VERSION = `${CIBLE.split('.')[0]}.${Number(CIBLE.split('.')[1]) - 1}.0`;

// la production : les règles publiées (site/donnees/maverick.db, _serveur/version.json), et son attestation dans le dossier partagé des métriques
const production = join(racine, 'prod');
const baseDeProduction = join(production, 'donnees', 'maverick.db');
const publier = (fichier, version) => {
  mkdirSync(join(production, 'donnees'), { recursive: true });
  mkdirSync(join(production, '_serveur'), { recursive: true });
  copyFileSync(fichier, baseDeProduction);
  writeFileSync(join(production, '_serveur', 'version.json'), `${JSON.stringify({ version })}\n`);
};
publier(regles, VERSION);
const attestations = join(racine, 'metriques');
/** L'attestation de la production, à jour du contenu qu'elle publie ; `citations` : les éléments que ses fiches citent. */
const attester = (citations) => {
  const p = new DatabaseSync(baseDeProduction, { readOnly: true });
  try {
    const a = fabriquerAttestation({ db: p, regles: baseDeProduction, version: { version: VERSION }, preparation: { appliquee: true } });
    ecrireAttestation(attestations, { ...a, citations });
  } finally {
    p.close();
  }
};
const sansAttestation = () => rmSync(attestations, { recursive: true, force: true });

// une modification en attente dans la base source (le contenu déjà changé, le journal qui le dit) : le bonus d'un métier
const metier = db.prepare('SELECT id, bonus_brut FROM metier ORDER BY id LIMIT 1').get();
const LOT_DU_SITE = '11111111-2222-4333-8444-555555555555';
const nouveauBonus = `${metier.bonus_brut} (zqx)`;
db.prepare('UPDATE metier SET bonus_brut = ? WHERE id = ?').run(nouveauBonus, metier.id);
db.prepare("INSERT INTO modification_lot (id, fait_le, page_id, resume, nature) VALUES (?, '2026-11-14T10:00:00Z', ?, 'Métier : bonus', 'saisie')").run(LOT_DU_SITE, metier.id);
db.prepare("INSERT INTO modification (lot_id, rang, table_nom, cle, operation, avant, apres, etat) VALUES (?, 1, 'metier', ?, 'modifier', ?, ?, 'en_attente')")
  .run(LOT_DU_SITE, JSON.stringify({ id: metier.id }), JSON.stringify({ bonus_brut: metier.bonus_brut }), JSON.stringify({ bonus_brut: nouveauBonus }));

const sha256 = (o) => createHash('sha256').update(o).digest('hex');
const compter = (base, sql, ...p) => base.prepare(sql).get(...p).n;
const etatDeLaSource = () => ({
  historique: compter(db, 'SELECT count(*) AS n FROM historique_modification'),
  notes: compter(db, 'SELECT count(*) AS n FROM note_version'),
  attente: compter(db, "SELECT count(*) AS n FROM modification WHERE etat = 'en_attente'"),
});
const lireOctets = (fichier) => readFileSync(fichier);
const ouvrir = (fichier) => new DatabaseSync(fichier, { readOnly: true });

test('le paquet d\'une mise à jour : un fichier neuf, sans fiche ni journal, la note et l\'historique dedans, la base source intacte (garde-fous 8, 9, 10)', () => {
  const avant = etatDeLaSource();
  const destination = join(dossierTemporaire('paquet-mise-a-jour'), 'paquet.db');
  const meta = fabriquerPaquet({ source: chemin, destination, production: baseDeProduction, id: 'lot-essai-1', mode: 'mise-a-jour', version: CIBLE, depuis: '0.1',
    date: '2026-11-15', texte: 'Le texte libre', majeure: false, versionDuSite: '0.1.76' });
  assert.deepEqual([meta.format, meta.mode, meta.version, meta.lots], [FORMAT_PAQUET, 'mise-a-jour', CIBLE, [LOT_DU_SITE]]);
  assert.equal(meta.modifications, 1);
  assert.ok(meta.lignes >= 1, 'la note liste le bonus changé');
  const octets = lireOctets(destination);
  assert.equal(octets.subarray(0, ENTETE_SQLITE.length).toString('latin1'), ENTETE_SQLITE);
  assert.equal(meta.fichier.sha256, sha256(octets));
  for (const marque of marquesDesFiches(poses)) assert.equal(octets.includes(Buffer.from(marque)), false, `aucune trace de ${marque}`);
  assert.deepEqual(lireMetaDuPaquet(destination), { ...lireMetaDuPaquet(destination), id: 'lot-essai-1', mode: 'mise-a-jour', version: CIBLE, majeure: false });

  const p = ouvrir(destination);
  try {
    // garde-fou 9 : aucune ligne d'une table propre au site ou inconnue
    for (const { name } of p.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
      const classe = classeDeLaTable(name);
      if (classe === CLASSES_DE_TABLES.CONTENU || classe === CLASSES_DE_TABLES.CALCULEE) continue;
      if (/_fts_|_fts$/.test(name)) continue;
      assert.equal(compter(p, `SELECT count(*) AS n FROM "${name}"`), 0, name);
    }
    assert.deepEqual(meta.tables_de_contenu, meta.tables_de_contenu.filter((t) => classeDeLaTable(t) === CLASSES_DE_TABLES.CONTENU));
    // la note de ce lot, son texte, ses lignes ; garde-fou 10 : la modification en attente est versée, avec sa nature, livrée par cette note
    const note = p.prepare('SELECT version, depuis, texte, exemple FROM note_version WHERE lot = ?').get('lot-essai-1');
    assert.deepEqual({ ...note }, { version: CIBLE, depuis: '0.1', texte: 'Le texte libre', exemple: 0 });
    assert.equal(compter(p, 'SELECT count(*) AS n FROM note_version WHERE exemple = 1'), 0, 'les notes d\'exemple sont retirées');
    assert.equal(compter(p, 'SELECT count(*) AS n FROM note_version_ligne WHERE version = ?', CIBLE), meta.lignes);
    assert.ok(compter(p, "SELECT count(*) AS n FROM note_version_ligne WHERE version = ? AND table_nom = 'metier'", CIBLE) >= 1);
    const trace = p.prepare('SELECT version, nature, table_nom, apres FROM historique_modification WHERE lot_id = ?').get(LOT_DU_SITE);
    assert.deepEqual([trace.version, trace.nature, trace.table_nom, JSON.parse(trace.apres).bonus_brut], [CIBLE, 'saisie', 'metier', nouveauBonus]);
    assert.equal(p.prepare('SELECT bonus_brut FROM metier WHERE id = ?').get(metier.id).bonus_brut, nouveauBonus, 'le contenu du site');
  } finally {
    p.close();
  }
  assert.deepEqual(etatDeLaSource(), avant, 'la base source n\'est pas écrite (préparée, pas livrée)');
});

test('le paquet d\'une copie vers le dépôt : sans note, l\'historique versé sans version (comme db:appliquer-edition)', () => {
  const destination = join(dossierTemporaire('paquet-copie'), 'paquet.db');
  const meta = fabriquerPaquet({ source: chemin, destination, id: 'copie-1', mode: 'copie', versionDuSite: '0.1.76' });
  assert.deepEqual([meta.mode, meta.version, meta.lignes, meta.lots], ['copie', null, 0, [LOT_DU_SITE]]);
  const p = ouvrir(destination);
  try {
    assert.equal(compter(p, 'SELECT count(*) AS n FROM note_version WHERE lot = ?', 'copie-1'), 0);
    assert.equal(p.prepare('SELECT version FROM historique_modification WHERE lot_id = ?').get(LOT_DU_SITE).version, null);
    assert.equal(compter(p, 'SELECT count(*) AS n FROM note_version'), compter(db, 'SELECT count(*) AS n FROM note_version'), 'les notes telles quelles');
  } finally {
    p.close();
  }
});

test('les éléments cités par des fiches de la production : un absent bloque, sauf ce que R42 retire des fiches ; des nombres, jamais un nom', () => {
  assert.deepEqual(TABLES_RETIREES_DES_FICHES, [...new Set(RETRAITS.map((r) => r.vise))].sort());
  assert.ok(TABLES_RETIREES_DES_FICHES.includes('metier') && !TABLES_RETIREES_DES_FICHES.includes('race'));
  const destination = join(dossierTemporaire('paquet-citations'), 'paquet.db');
  fabriquerPaquet({ source: chemin, destination, id: 'copie-2', mode: 'copie' });
  const p = ouvrir(destination);
  try {
    const citations = [
      { table: 'race', id: poses.race, fiches: 2 },
      { table: 'race', id: 'races/zqx-absente', fiches: 3 },
      { table: 'race', id: 'races/zqx-absente-2', fiches: 1 },
      { table: 'metier', id: 'metiers/zqx-absent', fiches: 4 }, // R42 : retiré des fiches, ne bloque pas
      { table: 'metier', id: poses.metier, fiches: 2 },
    ];
    assert.deepEqual(citationsManquantes(p, citations), { elements: 2, fiches: 4, tables: [{ table: 'race', elements: 2, fiches: 4 }] });
    assert.deepEqual(citationsManquantes(p, citations.filter((c) => !c.id.includes('zqx'))), { elements: 0, fiches: 0, tables: [] });
    assert.deepEqual(citationsManquantes(p, [{ table: 'table_zqx_inconnue', id: '1', fiches: 1 }]).tables, [{ table: 'table_zqx_inconnue', elements: 1, fiches: 1 }]);
  } finally {
    p.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les routes, avec le marqueur (service.source)
// ---------------------------------------------------------------------------------------------------------------------------------------------

const journal = [];
const service = {
  base: () => db, etat: () => ({ service: 'essai', version: VERSION }), journal: (l) => journal.push(l), edition: true, dossier,
  reference: { production, depot: null, propre: regles }, attestations, depot: 'Bravexier/MaverickCenter', adresse: 'https://dev.exemple.org', github: null,
  limites: { delai: 0, parJour: Infinity }, source: () => true, paquetEnArrierePlan: false,
};
const JSON_ = { 'content-type': 'application/json' };
const appel = (methode, c, corps, s = service) => traiter({ methode, chemin: c, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, s);
const lancer = (corps = {}, s = service) => appel('POST', '/api/mise-a-jour/lancer/', { confirmation: CONFIRMATION, ...corps }, s);
const lots = join(dossier, 'mise-a-jour');

beforeEach(() => {
  rmSync(lots, { recursive: true, force: true });
  db.exec('DELETE FROM note_version_brouillon');
  attester([{ table: 'race', id: poses.race, fiches: 2 }, { table: 'metier', id: poses.metier, fiches: 2 }]);
});

test('sans le marqueur, « Copier vers le dépôt » n\'existe pas, et « Effectuer la mise à jour » fige toujours un lot du journal', async () => {
  const ancien = { ...service, source: () => false };
  const r = await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE }, ancien);
  assert.equal(r.statut, 409);
  const g = appel('GET', '/api/mise-a-jour/', undefined, ancien);
  assert.equal(g.corps.base_source, false);
  assert.equal(g.corps.confirmation_copie, undefined);
  const l = lancer({}, ancien);
  assert.equal(l.statut, 202);
  assert.equal(l.corps.lancement.paquet, undefined, 'l\'ancien circuit : un lot JSON');
  assert.ok(existsSync(join(lots, `${l.corps.lancement.lot}.json`)));
});

test('refus avant l\'envoi : attestation absente, puis élément cité par des fiches absent du paquet ; rien n\'est figé ni verrouillé', async () => {
  sansAttestation();
  const a = await lancer();
  assert.equal(a.statut, 409);
  assert.equal(a.corps.refus.raison, 'attestation');
  attester([{ table: 'race', id: 'races/zqx-absente', fiches: 3 }, { table: 'race', id: poses.race, fiches: 2 }, { table: 'sort', id: 'zqx', fiches: 9 }]);
  const c = await lancer();
  assert.equal(c.statut, 409, JSON.stringify(c.corps));
  assert.deepEqual(c.corps.refus, { raison: 'citations', elements: 1, fiches: 3, tables: [{ table: 'race', elements: 1, fiches: 3 }] }, 'un sort (R42) ne bloque pas');
  assert.match(c.corps.erreur, /1 élément\(s\).*race : 1 élément\(s\), 3 fiche\(s\)/);
  for (const marque of marquesDesFiches(poses)) assert.equal(JSON.stringify(c.corps).includes(marque), false);
  assert.equal(lireLancement(dossier), null, 'aucun lancement');
  assert.deepEqual(readdirSync(lots), [], 'aucun paquet laissé');
  assert.equal(db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get()?.lot ?? null, null, 'le texte reste modifiable');
});

test('« Effectuer la mise à jour » avec le marqueur : un paquet figé, servi tel quel, le texte verrouillé ; puis le report, une seule fois, après la production', async () => {
  appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Note du paquet' });
  const g = appel('GET', '/api/mise-a-jour/');
  assert.deepEqual([g.corps.base_source, g.corps.confirmation_copie, g.corps.version_cible], [true, CONFIRMATION_COPIE, CIBLE]);
  const r = await lancer({ version_cible: g.corps.version_cible });
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  const l = r.corps.lancement;
  assert.deepEqual([l.paquet, l.mode, l.copie, l.simulation, l.etat, l.version_cible, l.modifications], [true, 'mise-a-jour', false, false, 'manuel', g.corps.version_cible, 1]);
  assert.equal(l.adresse, `https://dev.exemple.org/api/mise-a-jour/lots/${l.lot}/`);
  const servi = appel('GET', `/api/mise-a-jour/lots/${l.lot}/`);
  assert.equal(servi.statut, 200);
  assert.ok(Buffer.isBuffer(servi.brut));
  assert.equal(servi.entetes['Content-Type'], 'application/vnd.sqlite3');
  assert.equal(sha256(servi.brut), l.empreinte, 'l\'empreinte couvre le paquet servi');
  assert.equal(db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get().lot, l.lot, 'le texte est verrouillé');
  assert.equal((await lancer()).statut, 409, 'un seul lancement à la fois');
  assert.equal(appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'autre' }).statut, 409);

  // la production n'a pas encore publié la note : rien n'est reporté
  const avant = etatDeLaSource();
  assert.equal(appel('GET', '/api/mise-a-jour/lancement/').corps.lancement.etat, 'manuel');
  assert.deepEqual(etatDeLaSource(), avant);

  // la production publie la note du lot (sa base est faite du paquet) : la note et l'historique entrent dans la base source, d'un bloc
  publier(fichierPaquet(dossier, l.lot), `${g.corps.version_cible}.0`);
  const fini = appel('GET', '/api/mise-a-jour/lancement/').corps.lancement;
  assert.deepEqual([fini.etat, fini.version_livree, Boolean(fini.reporte_le), fini.report.deja], ['termine', g.corps.version_cible, true, false]);
  assert.equal(db.prepare('SELECT texte FROM note_version WHERE lot = ?').get(l.lot).texte, 'Note du paquet');
  assert.equal(db.prepare('SELECT version FROM historique_modification WHERE lot_id = ?').get(LOT_DU_SITE).version, g.corps.version_cible);
  assert.equal(db.prepare('SELECT etat FROM modification WHERE lot_id = ?').get(LOT_DU_SITE).etat, 'integree', 'sorti du journal en attente');
  assert.equal(db.prepare('SELECT count(*) AS n FROM note_version_brouillon').get().n, 0, 'le brouillon de ce lot est vidé');
  assert.equal(compter(db, 'SELECT count(*) AS n FROM note_version WHERE exemple = 1'), 0, 'les notes d\'exemple retirées, comme dans le paquet');
  const apres = etatDeLaSource();
  const lignes = compter(db, 'SELECT count(*) AS n FROM note_version_ligne WHERE version = ?', g.corps.version_cible);
  assert.equal(lignes, lireMetaDuPaquet(fichierPaquet(dossier, l.lot)).lignes);

  // idempotent : relu, ou après un redémarrage entre le report et l'état (reporte_le perdu)
  appel('GET', '/api/mise-a-jour/lancement/');
  const etat = join(lots, 'etat.json');
  writeFileSync(etat, JSON.stringify({ ...JSON.parse(readFileSync(etat, 'utf8')), reporte_le: undefined, etat: 'manuel' }));
  const repris = actualiser(db, dossier, { reference: { disponible: true, chemin: baseDeProduction, source: 'production', raison: null } });
  assert.deepEqual([repris.etat, repris.report.deja], ['termine', true]);
  assert.deepEqual(etatDeLaSource(), apres, 'rien n\'est écrit deux fois');
  assert.equal(reporterPaquet(db, fichierPaquet(dossier, l.lot), { lot: l.lot }).deja, true);
  assert.deepEqual(etatDeLaSource(), apres);

  // remise en état pour les tests suivants : la production d'avant, la modification de nouveau en attente, la note retirée
  publier(regles, VERSION);
  db.prepare('DELETE FROM note_version_ligne WHERE version = ?').run(g.corps.version_cible);
  db.prepare('DELETE FROM historique_modification WHERE version = ?').run(g.corps.version_cible);
  db.prepare('DELETE FROM note_version WHERE version = ?').run(g.corps.version_cible);
  db.prepare("UPDATE modification SET etat = 'en_attente' WHERE lot_id = ?").run(LOT_DU_SITE);
});

test('« Copier vers le dépôt » : un paquet sans note (fil à part), le texte libre ni verrouillé ni emporté, aucune maintenance, rien reporté', async () => {
  appel('POST', '/api/mise-a-jour/brouillon/', { texte: 'Texte de la prochaine note' });
  assert.equal((await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION })).statut, 400, 'son propre mot de confirmation');
  const avant = etatDeLaSource();
  const r = await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE }, { ...service, paquetEnArrierePlan: true });
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  const l = r.corps.lancement;
  assert.deepEqual([l.paquet, l.mode, l.copie, l.simulation, l.version_cible, l.majeure], [true, 'copie', true, false, null, false]);
  assert.equal(lireMetaDuPaquet(fichierPaquet(dossier, l.lot)).mode, 'copie');
  assert.equal(db.prepare('SELECT lot, texte FROM note_version_brouillon WHERE id = 1').get().lot, null, 'le texte reste libre pour la prochaine note');
  assert.equal(annonceDuLancement(l, { instant: l.lance_le }), null, 'une copie ne met rien en maintenance');
  // la production publie (une autre note) ou non : une copie n'écrit rien dans la base source, ses modifications restent en attente
  assert.equal(appel('GET', '/api/mise-a-jour/').corps.lancement.etat, 'manuel');
  assert.deepEqual(etatDeLaSource(), avant);
  assert.equal(db.prepare('SELECT etat FROM modification WHERE lot_id = ?').get(LOT_DU_SITE).etat, 'en_attente');
  assert.ok(existsSync(join(dossier, FICHIER_BASE)));
});

test('simulation par paquet : même paquet, mode « simulation » ; elle se termine et libère le texte comme avant', async () => {
  const r = await lancer({ simulation: true });
  assert.equal(r.statut, 202, JSON.stringify(r.corps));
  const l = r.corps.lancement;
  assert.deepEqual([l.mode, l.simulation, l.copie], ['simulation', true, false]);
  assert.equal(lireMetaDuPaquet(fichierPaquet(dossier, l.lot)).mode, 'simulation');
  const etat = join(lots, 'etat.json');
  writeFileSync(etat, JSON.stringify({ ...JSON.parse(readFileSync(etat, 'utf8')), etat: 'termine' }));
  assert.equal(appel('GET', '/api/mise-a-jour/lancement/').corps.lancement.etat, 'simulation_reussie');
  assert.equal(appel('GET', `/api/mise-a-jour/lots/${l.lot}/`).statut, 410, 'le paquet n\'est plus servi');
  assert.ok(existsSync(fichierPaquet(dossier, l.lot, '.simulation')));
  assert.equal(db.prepare('SELECT lot FROM note_version_brouillon WHERE id = 1').get()?.lot ?? null, null);
});

test('un paquet livré pendant qu\'un autre lancement a pris la place est reporté quand même ; au-delà de trois, les paquets reportés ou sans note sont effacés', async () => {
  const a = (await lancer()).corps.lancement;
  assert.equal(a.mode, 'mise-a-jour');
  // livré sur master, la production tarde : au-delà de DUREE_MAX_RUN, le texte se libère et une copie prend la place
  const etat = join(lots, 'etat.json');
  writeFileSync(etat, JSON.stringify({ ...JSON.parse(readFileSync(etat, 'utf8')), etat: 'termine', lance_le: '2026-01-01T00:00:00Z' }));
  assert.equal(appel('POST', '/api/mise-a-jour/liberer/', { lot: a.lot }).statut, 200);
  const copies = [];
  for (let i = 0; i < 4; i += 1) copies.push((await appel('POST', '/api/mise-a-jour/copier/', { confirmation: CONFIRMATION_COPIE })).corps.lancement.lot);
  const restants = readdirSync(lots).filter((f) => f.endsWith('.db'));
  assert.ok(restants.includes(`${a.lot}.db`), 'le paquet de mise à jour pas encore reporté est gardé');
  assert.ok(restants.includes(`${copies.at(-1)}.db`));
  assert.equal(restants.length, 4, `trois récents, plus celui qui attend son report : ${restants.join(', ')}`);
  // la production publie enfin la note du premier : reportée, sans toucher au lancement de la copie
  publier(fichierPaquet(dossier, a.lot), `${CIBLE}.0`);
  const l = appel('GET', '/api/mise-a-jour/lancement/').corps.lancement;
  assert.deepEqual([l.lot, l.copie], [copies.at(-1), true]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM note_version WHERE lot = ?').get(a.lot).n, 1);
  assert.equal(db.prepare('SELECT etat FROM modification WHERE lot_id = ?').get(LOT_DU_SITE).etat, 'integree');
  // remise en état
  publier(regles, VERSION);
  db.prepare('DELETE FROM note_version_ligne WHERE version = ?').run(CIBLE);
  db.prepare('DELETE FROM historique_modification WHERE version = ?').run(CIBLE);
  db.prepare('DELETE FROM note_version WHERE version = ?').run(CIBLE);
  db.prepare("UPDATE modification SET etat = 'en_attente' WHERE lot_id = ?").run(LOT_DU_SITE);
});
