// Les repères des mots-clés par un lot de changements du site de dev (table `repere`, migration 0135 ; chantier 4 des mots-clés, « le retrait des colonnes » :
// docs/chantier-retrait-des-colonnes.md, §2 et §7) :
//   - le lot que fabrique scripts/lot-des-reperes.mjs (lib/lot-des-reperes.mjs) pose une ligne par mot-clé sans page ni sort, copie du nom, de l'adresse, de la
//     définition, de la couleur et de l'icône du mot-clé ; déposé par la route comme sur le site de dev (la base source : le lot vaut pour les tables hors
//     édition), son essai à blanc n'écrit rien, son application écrit les lignes au journal ; une ligne s'annule seule, puis le lot entier (R291) ;
//   - le service refuse (409, sans numéro de décision : ce n'est pas un verrou) le repère d'un mot-clé que désigne une page ou un sort, ou qui n'existe pas ;
//   - un lot modifie et supprime un repère ; l'annulation d'une suppression le remet, sauf si le mot-clé a reçu une page entre-temps ;
//   - un mot-clé supprimé emporte son repère, noté au journal (serveur/edition-mots-cles.mjs#FILLES_DU_MOT_CLE).
// Depuis la migration 0136 (retrait des colonnes du mot-clé), la migration pose elle-même le repère de chaque mot-clé sans page ni sort : le lot du script
// n'a plus rien à poser et ne sert que de contrôle (un mot-clé resté sans élément est nommé, en erreur) ; sa copie des colonnes s'éprouve sur une base à
// l'ancienne structure. Le repère est un texte lu (mentions, citations, contrôles), et un mot-clé nu créé par le service naît avec le sien.
// Aucune valeur du site n'est figée : les mots-clés se prennent par ordre d'id, les textes écrits sont ceux du test.
//   node --test test/serveur-edition-lots-reperes.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { lotDeLaBase } from '../scripts/lot-des-reperes.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { decisionsCitees } from '../serveur/edition-lots.mjs';
import { refusDuRepere, TABLES_DES_FILLES_DU_MOT_CLE } from '../serveur/edition-mots-cles.mjs';
import { controlerLeLot } from '../src/lib/lot-de-changements.mjs';
import { AUTEUR_DU_LOT_DES_REPERES, COLONNES_DU_REPERE, lotDesReperes } from '../src/lib/lot-des-reperes.mjs';
import { DECISION_DE_L_ANCRAGE, estUnLotDAncrage } from '../src/lib/lots-d-ancrage.mjs';
import { textesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { estUneTableAutre } from '../src/lib/notes-de-version.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { lotHorsRoute } from './aide-mot-cle-nu.mjs';
import { lireUnMotCle, poserUnMotCle } from './aide-mots-cles.mjs';

const racine = dossierTemporaire('edition-lots-reperes');
const SCRIPT = fileURLToPath(new URL('../scripts/lot-des-reperes.mjs', import.meta.url));
const SCHEMA = readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8');
const JSON_ = { 'content-type': 'application/json' };
let n = 0;

function nouvelle() {
  const chemin = preparerBaseVivante({ regles: cheminDImport(), dossier: join(racine, `b${(n += 1)}`) }).chemin;
  const db = ouvrirBaseVivante(chemin);
  // `source` : la base du site de dev (db/source) : la route donne `ouvertHorsEdition` au contrôle du lot (serveur/api.mjs#traiterLots)
  const service = { base: () => db, etat: () => ({}), edition: true, journal: () => {}, lots: { enArrierePlan: false }, source: () => true };
  const appel = (methode, adresse, corps) => traiter({ methode, chemin: adresse, entetes: JSON_, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const un = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  const tous = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
  return { db, chemin, appel, un, tous };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const adresse = (id, suite = '') => `/api/edition/lots/${id}/${suite}`;
const SANS_ELEMENT = 'NOT EXISTS (SELECT 1 FROM page p WHERE p.mot_cle_id = m.id) AND NOT EXISTS (SELECT 1 FROM sort s WHERE s.mot_cle_id = m.id)';
const sansElement = (m) => m.tous(`SELECT m.id FROM mot_cle m WHERE ${SANS_ELEMENT} ORDER BY m.id`).map((l) => l.id);
const tousLesReperes = (m) => m.tous('SELECT * FROM repere ORDER BY mot_cle_id');
/** Ceux des mots-clés `ids` qui ont un repère, par id. */
const reperes = (m, ids) => tousLesReperes(m).map((l) => l.mot_cle_id).filter((id) => ids.includes(id));
const repere = (m, id) => m.un('SELECT * FROM repere WHERE mot_cle_id = ?', id);
const unLot = (operations) => ({ format: 'maverick-lot/1', titre: `Repères d’essai ${(n += 1)}`, nature: 'code', operations });
/** L'insertion d'un repère, ligne `r` de la table. */
const insertion = (r) => ({ table: 'repere', cle: { mot_cle_id: r.mot_cle_id }, operation: 'inserer', apres: { ...r } });

/**
 * Donne une page à un mot-clé sans élément, un sort à un autre (les deux premiers par id) : { dePage, deSort }, écrits en base comme le ferait l'ancrage,
 * qui leur retire leur repère (migration 0136 : un mot-clé a un repère si et seulement s'il n'a ni page ni sort).
 */
function ancrerDeuxMotsCles(m) {
  const [dePage, deSort] = sansElement(m);
  m.db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = (SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(dePage);
  m.db.prepare('UPDATE sort SET mot_cle_id = ? WHERE id = (SELECT id FROM sort WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(deSort);
  m.db.prepare('DELETE FROM repere WHERE mot_cle_id IN (?, ?)').run(dePage, deSort);
  return { dePage, deSort };
}
/** Donne au mot-clé `id` une page (la première sans mot-clé), comme le ferait l'ancrage. */
const donnerUnePage = (m, id) => m.db.prepare('UPDATE page SET mot_cle_id = ? WHERE id = (SELECT id FROM page WHERE mot_cle_id IS NULL ORDER BY id LIMIT 1)').run(id);
/** Dépose le lot par la route, vérifie son essai à blanc (rien n'est écrit), puis l'applique d'un clic. */
async function appliquer(m, lot) {
  const avant = tousLesReperes(m);
  const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
  assert.equal(proposition.verdict, 'applicable', JSON.stringify(proposition.essai?.operations?.filter((o) => o.etat !== 'applicable').slice(0, 5)));
  assert.deepEqual(tousLesReperes(m), avant, 'l’essai à blanc n’écrit rien dans la base');
  const applique = ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), {}));
  assert.equal(applique.etat, 'applique');
  return applique;
}

test('module pur : un repère par mot-clé qui n’en a pas, valeurs recopiées telles quelles (NULL compris) ; le lot passe le contrôle du format sans numéro à donner', () => {
  // une base à l'ancienne structure (d'avant la migration 0136 : les colonnes du mot-clé font foi), la seule où le lot a des repères à recopier
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  db.exec(SCHEMA);
  db.exec(`DROP VIEW v_mot_cle; PRAGMA foreign_keys = OFF; DROP TABLE mot_cle; PRAGMA foreign_keys = ON;
    CREATE TABLE mot_cle (id INTEGER NOT NULL PRIMARY KEY, libelle TEXT NOT NULL, cle TEXT NOT NULL UNIQUE, description TEXT, couleur TEXT, url TEXT,
      verrou INTEGER NOT NULL DEFAULT 0, monnaie_id TEXT UNIQUE, icone TEXT) STRICT;`);
  db.prepare('INSERT INTO mot_cle (id, libelle, cle, url, description, couleur, icone) VALUES (?, ?, ?, ?, ?, ?, ?)').run(3, 'Essai trois', 'essai-trois', '/essai/', 'Un texte d’essai.', '#a1b2c3', 'monnaie:rf');
  db.prepare('INSERT INTO mot_cle (id, libelle, cle) VALUES (?, ?, ?)').run(5, 'Essai cinq', 'essai-cinq');
  db.prepare('INSERT INTO mot_cle (id, libelle, cle) VALUES (?, ?, ?)').run(8, 'Essai huit', 'essai-huit');
  db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (8, ?)').run('Déjà posé');
  const lot = lotDesReperes(db);
  assert.deepEqual(lot.operations, [
    { table: 'repere', cle: { mot_cle_id: 3 }, operation: 'inserer', apres: { mot_cle_id: 3, nom: 'Essai trois', adresse: '/essai/', definition: 'Un texte d’essai.', couleur: '#a1b2c3', icone: 'monnaie:rf' } },
    { table: 'repere', cle: { mot_cle_id: 5 }, operation: 'inserer', apres: { mot_cle_id: 5, nom: 'Essai cinq', adresse: null, definition: null, couleur: null, icone: null } },
  ]);
  assert.deepEqual(Object.keys(lot.operations[0].apres), Object.keys(COLONNES_DU_REPERE), 'les colonnes du repère');
  assert.equal(lot.format, 'maverick-lot/1');
  assert.equal(lot.nature, 'decision');
  assert.match(lot.decision, /^R[0-9]+$/);
  assert.equal(lot.auteur, AUTEUR_DU_LOT_DES_REPERES);
  assert.equal(estUnLotDAncrage(lot), false, 'un lot de l’équipe, pas un lot de l’action « Préparer l’ancrage »');
  assert.equal(lotDesReperes(db, { titre: 'Titre donné' }).titre, 'Titre donné');

  // le format : `repere.mot_cle_id` cite un mot-clé qui existe, ce n'est pas un numéro à donner ; la clé entière d'un mot-clé, elle, se donne toujours
  const types = (table) => Object.fromEntries(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => [c.name, c.type.toUpperCase()]));
  const structure = (table) => {
    const colonnes = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (!colonnes.length) return null;
    return { colonnes: colonnes.map((c) => c.name), cle: colonnes.filter((c) => c.pk).map((c) => c.name), types: types(table),
      etrangeres: Object.fromEntries(db.prepare(`PRAGMA foreign_key_list("${table}")`).all().map((f) => [f.from, f.table])) };
  };
  assert.deepEqual(controlerLeLot(lot, { structure, ouvertHorsEdition: true }).erreurs, []);
  assert.deepEqual(controlerLeLot(lot, { structure }).erreurs, [], 'le repère est une entité de l’édition (lib/edition-modele.mjs) : ouvert aux lots, base source ou non');
  const motCle = unLot([{ table: 'mot_cle', cle: { id: 99 }, operation: 'inserer', apres: { id: 99, libelle: 'Essai', cle: 'essai' } }]);
  assert.equal(controlerLeLot(motCle, { structure, ouvertHorsEdition: true }).valide, false, 'un id de mot-clé écrit à la main reste refusé');

  // rien à poser : pas de lot
  for (const o of lot.operations) db.prepare('INSERT INTO repere (mot_cle_id, nom) VALUES (?, ?)').run(o.cle.mot_cle_id, o.apres.nom);
  assert.equal(lotDesReperes(db), null);
  db.exec('DROP TABLE repere');
  assert.throws(() => lotDesReperes(db), /0135/, 'une base d’avant la migration est refusée');
  db.close();

  // la structure d'aujourd'hui (migration 0136) : le repère de chaque mot-clé sans page ni sort est déjà posé, rien à poser ; un mot-clé resté sans
  // élément (base incohérente) est nommé, en erreur, puisque plus rien ne dit son nom
  const neuve = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  neuve.exec(SCHEMA);
  for (const [id, libelle] of [[3, 'Essai trois'], [5, 'Essai cinq']]) poserUnMotCle(neuve, { id, libelle });
  assert.equal(lotDesReperes(neuve), null);
  neuve.prepare("INSERT INTO mot_cle (id, cle) VALUES (8, 'essai-huit')").run();
  assert.throws(() => lotDesReperes(neuve), (e) => /0136/.test(e.message) && /\b8\b/.test(e.message));
  // le repère est un texte lu (mentions, citations, contrôles) : sa définition, à la place de celle du mot-clé
  assert.ok(textesDeLaBase(neuve).some((t) => t.table === 'repere' && t.colonne === 'definition'));
  assert.ok(!textesDeLaBase(neuve).some((t) => t.table === 'mot_cle' && t.colonne === 'description'));
  neuve.close();

  // les déclarations de la table : elle part avec son mot-clé ; la note de version la lit comme les tables des mots-clés
  assert.ok(TABLES_DES_FILLES_DU_MOT_CLE.includes('repere'));
  assert.equal(estUneTableAutre('repere'), false);
});

test('le lot du script : sur la base d’aujourd’hui, rien à poser ; un mot-clé resté sans élément est nommé, en erreur ; un lot de repères s’applique, journal ; une ligne puis le lot s’annulent (R291) une fois que leurs mots-clés ont un autre élément', async () => {
  const m = nouvelle();
  const { dePage, deSort } = ancrerDeuxMotsCles(m);
  const attendus = sansElement(m);
  assert.ok(attendus.length >= 2 && !attendus.includes(dePage) && !attendus.includes(deSort));
  // la migration 0136 a posé le repère de chacun : un repère si et seulement si ni page ni sort
  assert.deepEqual(tousLesReperes(m).map((l) => l.mot_cle_id), attendus);
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('repere')"), []);

  // la ligne de commande : rien sur la sortie standard, code 0 ; sans base : usage
  assert.equal(lotDeLaBase(m.chemin), null);
  const sortie = spawnSync(process.execPath, ['--no-warnings', SCRIPT, m.chemin], { encoding: 'utf8' });
  assert.equal(sortie.status, 0, sortie.stderr);
  assert.equal(sortie.stdout, '');
  assert.equal(spawnSync(process.execPath, ['--no-warnings', SCRIPT], { encoding: 'utf8' }).status, 2, 'sans base : usage');

  // des repères retirés hors du journal (base incohérente ; ceux dont la définition n'a pas de balise, pour que l'essai ne relève que ce que le lot
  // change) : le lot nomme chaque mot-clé resté sans élément, la ligne de commande sort en erreur (code 1)
  const remis = tousLesReperes(m).filter((r) => !r.definition?.includes('{{')).slice(0, 5);
  const ids = remis.map((r) => r.mot_cle_id);
  assert.ok(ids.length >= 2);
  m.db.prepare(`DELETE FROM repere WHERE mot_cle_id IN (${ids.join(', ')})`).run();
  assert.throws(() => lotDeLaBase(m.chemin), (e) => ids.every((id) => new RegExp(`\\b${id}\\b`).test(e.message)));
  const refus = spawnSync(process.execPath, ['--no-warnings', SCRIPT, m.chemin], { encoding: 'utf8' });
  assert.equal(refus.status, 1, refus.stderr);
  assert.match(refus.stderr, new RegExp(`\\b${ids[0]}\\b`));
  assert.equal(refus.stdout, '');

  // un lot de la nature du lot du script les remet : essai à blanc sans écriture, journal
  const lot = { ...unLot(remis.map(insertion)), nature: 'decision', decision: DECISION_DE_L_ANCRAGE, auteur: AUTEUR_DU_LOT_DES_REPERES };
  const applique = await appliquer(m, lot);
  assert.equal(applique.operations, ids.length);
  assert.deepEqual(ids.map((id) => repere(m, id)), remis);
  assert.deepEqual(m.tous("SELECT * FROM pragma_foreign_key_check('repere')"), []);
  assert.equal(m.un("SELECT count(*) AS n FROM modification WHERE table_nom = 'repere' AND operation = 'inserer' AND lot_id = ?", applique.lot_id).n, ids.length);
  assert.deepEqual(m.un('SELECT nature, decision FROM modification_lot WHERE id = ?', applique.lot_id), { nature: lot.nature, decision: lot.decision });
  assert.equal(lotDeLaBase(m.chemin), null, 'chaque mot-clé sans élément a son repère : plus rien à poser');

  // une ligne ne s'annule pas tant que son mot-clé n'a ni page ni sort (sans repère, son nom ne se lirait nulle part : contrôles du contenu) ; le lot
  // reste appliqué
  const { lignes } = ok(await m.appel('GET', adresse(applique.id)));
  assert.equal(lignes.length, ids.length);
  assert.ok(lignes.every((l) => l.genre === 'inserer' && l.etat === 'en_place' && l.annulable_seule), JSON.stringify(lignes.find((l) => !l.annulable_seule)));
  const rang = lot.operations.findIndex((o) => o.cle.mot_cle_id === ids[1]);
  const refusee = await m.appel('POST', adresse(applique.id, `lignes/${lignes[rang].n}/annuler/`), {});
  assert.notEqual(refusee.statut, 200);
  assert.ok(refusee.corps.problemes.some((p) => p.startsWith(`mot_cle ${ids[1]} :`)), JSON.stringify(refusee.corps));
  assert.deepEqual(reperes(m, ids), ids);

  // son mot-clé reçoit une page : la ligne s'annule seule, son repère part, les autres restent
  donnerUnePage(m, ids[1]);
  const apres = ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[rang].n}/annuler/`), {}));
  assert.equal(apres.etat, 'applique');
  assert.deepEqual(reperes(m, ids), ids.filter((id) => id !== ids[1]));

  // puis le lot entier, une fois que chacun de ses mots-clés a reçu une page : plus aucun repère, les mots-clés sont intacts
  const motsCles = m.un('SELECT count(*) AS n FROM mot_cle').n;
  assert.notEqual((await m.appel('POST', adresse(applique.id, 'annuler/'), {})).statut, 200, 'refusé tant qu’un mot-clé n’a pas d’autre élément');
  assert.deepEqual(reperes(m, ids), ids.filter((id) => id !== ids[1]));
  for (const id of ids) if (id !== ids[1]) donnerUnePage(m, id);
  const annule = ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}));
  assert.equal(annule.etat, 'annule');
  assert.deepEqual(reperes(m, ids), []);
  assert.equal(m.un('SELECT count(*) AS n FROM mot_cle').n, motsCles);
  m.db.close();
});

test('refus : le repère d’un mot-clé que désigne une page ou un sort, ou d’un mot-clé qui n’existe pas (409, sans numéro de décision) ; rien n’entre', async () => {
  const m = nouvelle();
  const { dePage, deSort } = ancrerDeuxMotsCles(m);
  const [libre] = sansElement(m);
  const absent = m.un('SELECT max(id) AS id FROM mot_cle').id + 1000;
  assert.equal(refusDuRepere(m.db, 'repere', { mot_cle_id: libre }), null);
  assert.equal(refusDuRepere(m.db, 'mot_cle_synonyme', { mot_cle_id: dePage }), null, 'la règle ne vaut que pour la table des repères');
  const messages = new Set();
  for (const id of [dePage, deSort, absent]) {
    const message = refusDuRepere(m.db, 'repere', { mot_cle_id: id });
    assert.equal(typeof message, 'string', `mot-clé ${id}`);
    assert.deepEqual(decisionsCitees(message), [], 'le refus ne cite aucune décision : une session Créateur ne l’ouvre pas');
    messages.add(message.replaceAll(String(id), ''));
    const lot = unLot([{ table: 'repere', cle: { mot_cle_id: id }, operation: 'inserer', apres: { mot_cle_id: id, nom: 'Repère d’essai', adresse: null, definition: null, couleur: null, icone: null } }]);
    const proposition = ok(await m.appel('POST', '/api/edition/lots/', lot), 201);
    assert.equal(proposition.verdict, 'a_corriger', `mot-clé ${id}`);
    assert.equal(proposition.essai.operations[0].etat, 'refusee');
    assert.equal(proposition.essai.operations[0].statut, 409);
    assert.ok(proposition.essai.operations[0].message.includes(message), 'le message du service est rendu tel quel');
    assert.deepEqual(proposition.essai.verrous_a_ouvrir ?? [], []);
    ok(await m.appel('POST', adresse(proposition.id, 'appliquer/'), { verrous_ouverts: ['R218', 'R219', 'R232', 'R309'] }), 409);
  }
  assert.equal(messages.size, 3, 'trois refus distincts : une page, un sort, un mot-clé absent');
  assert.deepEqual(reperes(m, [dePage, deSort, absent]), []);
  m.db.close();
});

test('un lot modifie et supprime des repères ; le repère d’un mot-clé sans page ni sort ne part pas ; annuler une suppression ne remet pas le repère d’un mot-clé qui a reçu une page', async () => {
  const m = nouvelle();
  const [a, b, c] = sansElement(m);
  // la migration 0136 leur a posé leur repère
  assert.deepEqual(reperes(m, [a, b, c]), [a, b, c]);

  const definition = `Définition d’essai ${process.pid}`;
  const avant = { [a]: repere(m, a), [b]: repere(m, b), [c]: repere(m, c) };
  const modifierA = { table: 'repere', cle: { mot_cle_id: a }, operation: 'modifier', avant: { definition: avant[a].definition }, apres: { definition } };

  // b n'a ni page ni sort : sans son repère, son nom ne se lirait nulle part ; le lot est à corriger et rien n'entre
  const refuse = ok(await m.appel('POST', '/api/edition/lots/', unLot([modifierA, { table: 'repere', cle: { mot_cle_id: b }, operation: 'supprimer', avant: avant[b] }])), 201);
  assert.equal(refuse.verdict, 'a_corriger');
  assert.ok(refuse.essai.problemes_nouveaux.some((p) => p.startsWith(`mot_cle ${b} :`)), JSON.stringify(refuse.essai.problemes_nouveaux));
  ok(await m.appel('POST', adresse(refuse.id, 'appliquer/'), {}), 409);
  assert.deepEqual([repere(m, a), repere(m, b)], [avant[a], avant[b]]);

  // c reçoit une page (comme par l'ancrage) : son repère part par un lot, avec la modification de a
  donnerUnePage(m, c);
  const applique = await appliquer(m, unLot([modifierA, { table: 'repere', cle: { mot_cle_id: c }, operation: 'supprimer', avant: avant[c] }]));
  assert.equal(repere(m, a).definition, definition);
  assert.equal(lireUnMotCle(m.db, a).description, definition, 'la définition du mot-clé se lit sur son repère');
  assert.deepEqual(reperes(m, [a, b, c]), [a, b]);

  // les lignes du lot, dans l'ordre de ses opérations : la suppression de c ne s'annule pas (409), ni par sa ligne ni avec le lot entier
  const { lignes } = ok(await m.appel('GET', adresse(applique.id)));
  assert.deepEqual(lignes.map((l) => l.genre), ['modifier', 'supprimer']);
  ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[1].n}/annuler/`), {}), 409);
  ok(await m.appel('POST', adresse(applique.id, 'annuler/'), {}), 409);
  assert.deepEqual(reperes(m, [a, b, c]), [a, b], 'un mot-clé qui a reçu une page ne retrouve pas son repère');
  assert.equal(repere(m, a).definition, definition, 'une annulation refusée n’écrit rien');

  // la modification de a s'annule seule : son repère revient à l'identique
  ok(await m.appel('POST', adresse(applique.id, `lignes/${lignes[0].n}/annuler/`), {}));
  assert.deepEqual(repere(m, a), avant[a]);
  m.db.close();
});

test('un mot-clé supprimé emporte son repère, noté au journal avant sa ligne', async () => {
  const m = nouvelle();
  // un mot-clé d'essai, nu (hors route : sans page de notion), que rien ne cite
  // il naît avec son repère, qui porte son nom
  const libelle = `Zq repère d’essai ${process.pid}`;
  const id = ok(lotHorsRoute(m.db, [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle } }], 'regles/glossaire/')).crees[0].id;
  assert.equal(repere(m, id).nom, libelle);
  ok(await m.appel('POST', '/api/edition/', { page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id }, forcer: true }] }));
  assert.equal(m.un('SELECT 1 AS x FROM mot_cle WHERE id = ?', id), undefined);
  assert.equal(repere(m, id), undefined);
  const retrait = (table, cle) => m.un("SELECT lot_id, rang FROM modification WHERE operation = 'supprimer' AND table_nom = ? AND cle = ?", table, JSON.stringify(cle));
  const [duRepere, duMotCle] = [retrait('repere', { mot_cle_id: id }), retrait('mot_cle', { id })];
  assert.ok(duRepere && duMotCle, 'les deux retraits sont au journal (la cascade du schéma ne retire rien hors du journal)');
  assert.equal(duRepere.lot_id, duMotCle.lot_id);
  assert.ok(duRepere.rang < duMotCle.rang, 'le repère d’abord');
  m.db.close();
});
