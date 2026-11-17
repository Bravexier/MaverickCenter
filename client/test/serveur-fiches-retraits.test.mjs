// Retraits des fiches (décision R42 ; client/serveur/fiches-retraits.mjs) : un don, une spécialité (avec ses dons choisis), un sort ou un métier que les
// règles suppriment est retiré des fiches qui l'utilisent, avec une ligne datée dans leurs notes ; les fiches ne passent jamais par le journal de
// l'édition (serveur/edition-journal.mjs). Base vivante temporaire ; les données d'essai (classe, spécialité, dons, métier) sont créées ici sous des noms
// absents de la base, le sort est lu dans la base.
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { ErreurJournal, ouvrirLot, TABLES_INTERDITES } from '../serveur/edition-journal.mjs';
import {
  libelleDeFiche, noterLesRetraits, nouveauxRetraitsDeFiches, numerosDesFichesDeJoueur, ordreDesLibelles, RETRAITS, retirerDesFiches,
} from '../serveur/fiches-retraits.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { jourDuRetrait, ligneDeRetrait, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { normalize } from '../src/lib/text.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('fiches-retraits');
const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
const ligne = (sql, ...p) => db.prepare(sql).get(...p);
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));
const INSTANT = '2026-10-11T08:30:00Z';
const inserer = (t, l) => db.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
const FICHE = { visibilite: 'tous', mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0,
  alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: '2026-10-10T12:00:00Z', modifie_le: '2026-10-10T12:00:00Z' };
/** Un nom que la table n'a pas encore (ni l'id de page `<type>/<slug>`). */
const nomLibre = (nom, table, type) => {
  let n = nom;
  for (let i = 2; ligne(`SELECT 1 FROM "${table}" WHERE nom = ? UNION ALL SELECT 1 FROM page WHERE id = ?`, n, `${type}/${normalize(n)}`); i += 1) n = `${nom} ${i}`;
  return n;
};
const lot = (operations) => enregistrer(db, { page: 'essai', operations });

test('RETRAITS : exactement les clés étrangères des fiches vers metier, specialite, magie_specialisation, capacite, sort, arme et classe_annexe_entree (colonnes dans l’ordre)', () => {
  const vers = new Set(['metier', 'specialite', 'magie_specialisation', 'capacite', 'sort', 'arme', 'classe_annexe_entree']);
  const cles = [];
  for (const t of TABLES_FICHES) {
    const parId = new Map();
    for (const f of db.prepare(`PRAGMA foreign_key_list("${t}")`).all()) {
      if (!vers.has(f.table)) continue;
      if (!parId.has(f.id)) parId.set(f.id, { table: t, vise: f.table, colonnes: [] });
      parId.get(f.id).colonnes[f.seq] = f.from;
    }
    cles.push(...parId.values());
  }
  // un sort est cité par la liste des sorts et par les livres (décision R169) : deux clés vers `sort` ; un don obtenu (décision R181) cite son don
  // « Variable » (capacite) et son entrée (classe_annexe_entree) ; le choix de spécialisation magique (décision R236) cite le couple (spécialisation, magie)
  assert.equal(cles.length, 9);
  assert.deepEqual(RETRAITS.map((r) => ({ table: r.table, vise: r.vise, colonnes: [...r.colonnes] })), cles);
  for (const r of RETRAITS) {
    assert.ok(['vider', 'supprimer'].includes(r.action), r.table);
    if (r.action === 'vider') assert.ok(r.colonnes.includes(r.colonne), `${r.table} : la colonne vidée cite la règle`);
    for (const c of r.cle) assert.ok(db.prepare(`PRAGMA table_info("${r.table}")`).all().some((x) => x.name === c), `${r.table}.${c}`);
  }
});

test('journal : les tables des fiches sont interdites à l’édition ; une écriture de fiche par le rédacteur du lot est refusée et rien n’est écrit', () => {
  for (const t of TABLES_FICHES) assert.ok(TABLES_INTERDITES.has(t), t);
  inserer('personnage', { ...FICHE, id: 'p-garde', nature: 'pretire', nom: 'Garde du journal' });
  const avant = { personnage: lignes("SELECT * FROM personnage WHERE id = 'p-garde'"), modifications: ligne('SELECT count(*) AS n FROM modification').n,
    lots: ligne('SELECT count(*) AS n FROM modification_lot').n };
  for (const ecrire of [
    (w) => w.supprimer('personnage_capacite', { personnage_id: 'p-garde', capacite_id: 'capacites/x' }),
    (w) => w.modifier('personnage', { id: 'p-garde' }, { notes: 'par le journal' }),
    (w) => w.inserer('personnage_inventaire', { personnage_id: 'p-garde', rang: 1, nom: 'Corde', quantite: 1 }),
  ]) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const w = ouvrirLot(db, { id: `lot-garde-${Math.random()}`, instant: INSTANT });
      assert.throws(() => ecrire(w), (e) => e instanceof ErreurJournal && /table du journal ou des fiches/.test(e.message));
    } finally {
      db.exec('ROLLBACK');
    }
  }
  assert.deepEqual({ personnage: lignes("SELECT * FROM personnage WHERE id = 'p-garde'"), modifications: ligne('SELECT count(*) AS n FROM modification').n,
    lots: ligne('SELECT count(*) AS n FROM modification_lot').n }, avant);
  db.prepare("DELETE FROM personnage WHERE id = 'p-garde'").run();
});

test('retirerDesFiches puis noterLesRetraits : éléments retirés, ligne de classe gardée, notes datées à la fin, prétiré nommé, fiche de joueur anonyme, rien au journal', () => {
  // données d'essai : une classe, sa spécialité (et son don de spécialité), deux dons au choix de la spécialité, un métier ; un sort de la base
  const nomClasse = nomLibre('Classe des retraits', 'classe', 'classes');
  const classe = lot([{ op: 'creer', entite: 'classe', valeurs: { categorie_id: 'classe-physique-corps-a-corps', nom: nomClasse } }]).crees[0].id;
  const spec = lot([{ op: 'creer', entite: 'specialite', valeurs: { classe_id: classe, nom: 'LAME D’ESSAI', don_nom: 'Lame d’essai', don_type: 'Passif' } }]).crees[0].id;
  const [donA, donB] = lot([
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, specialite_id: spec, niveau: '15', nom: 'Don témoin A', type: 'Passif' } },
    { op: 'creer', entite: 'capacite', valeurs: { classe_id: classe, specialite_id: spec, avec: '@0', nom: 'Don témoin B', type: 'Passif' } },
  ]).crees.map((c) => c.id);
  const cartouche = ligne("SELECT id FROM capacite WHERE specialite_id = ? AND nature = 'specialite'", spec).id;
  const nomMetier = nomLibre('Métier des retraits', 'metier', 'metiers');
  const metier = lot([{ op: 'creer', entite: 'metier', valeurs: { nom: nomMetier } }]).crees[0].id;
  const sort = ligne('SELECT s.id, s.nom, s.niveau, m.nom AS magie FROM sort s JOIN magie m ON m.id = s.magie_id ORDER BY s.id LIMIT 1');

  // un prétiré qui a tout (avec des notes), une fiche de joueur créée APRÈS l'instant qui a un don de la spécialité sans elle (fiche non conforme)
  inserer('utilisateur', { id: 'u-retraits', nom_affichage: 'Joueur', cree_le: '2026-10-01T00:00:00Z' });
  inserer('personnage', { ...FICHE, id: 'p-retraits', nature: 'pretire', nom: 'Témoin des retraits', notes: 'Note du joueur.', metier_id: metier });
  inserer('personnage_classe', { personnage_id: 'p-retraits', rang: 1, classe_id: classe, specialite_id: spec });
  inserer('personnage_capacite', { personnage_id: 'p-retraits', capacite_id: donA });
  inserer('personnage_sort', { personnage_id: 'p-retraits', sort_id: sort.id, rang: 1, niveau_maitrise: 2 });
  inserer('personnage_livre_sort', { personnage_id: 'p-retraits', sort_id: sort.id, rang: 1 });
  inserer('personnage', { ...FICHE, id: 'j-retraits', nature: 'joueur', proprietaire_id: 'u-retraits', visibilite: 'privee', nom: 'Nom secret du joueur',
    cree_le: '2026-10-12T00:00:00Z', modifie_le: '2026-10-12T00:00:00Z' });
  inserer('personnage_classe', { personnage_id: 'j-retraits', rang: 1, classe_id: classe });
  inserer('personnage_capacite', { personnage_id: 'j-retraits', capacite_id: donB });
  // décision R169 : le livre seul d'un sort que la fiche n'a pas choisi (en attente) part aussi avec le sort, la clé n'a pas d'ON DELETE
  inserer('personnage_livre_sort', { personnage_id: 'j-retraits', sort_id: sort.id, rang: 1 });
  const journal = ligne('SELECT count(*) AS n FROM modification').n;

  const acc = nouveauxRetraitsDeFiches();
  retirerDesFiches(db, { specialites: [spec], capacites: [cartouche, donA, donB], metiers: [metier], sorts: [sort.id] }, acc);
  const fiches = noterLesRetraits(db, acc, INSTANT);

  const attendus = {
    metier: `le métier « ${nomMetier} »`,
    specialite: `la spécialité « LAME D’ESSAI » (classe ${nomClasse}, avec le don choisi « Don témoin A »)`,
    sort: `le sort « ${sort.nom} » (magie ${sort.magie}, NPM ${sort.niveau}, 2 NM sur cette fiche dont 1 de livre)`,
    donB: `le don « Don témoin B » (classe ${nomClasse}, spécialité LAME D’ESSAI, niveau 15)`,
    livre: `le sort « ${sort.nom} » (magie ${sort.magie}, NPM ${sort.niveau}, livre de sort en attente, sort hors de la liste)`,
  };
  assert.deepEqual(fiches, [
    { fiche: 'Témoin des retraits', retraits: [attendus.metier, attendus.specialite, attendus.sort] },
    { fiche: 'fiche de joueur n° 1', retraits: [attendus.donB, attendus.livre] },
  ]);
  assert.ok(!JSON.stringify(fiches).includes('Nom secret du joueur'), 'le nom d’une fiche de joueur ne sort pas');

  const p = ligne("SELECT metier_id, notes, modifie_le FROM personnage WHERE id = 'p-retraits'");
  assert.equal(p.metier_id, null);
  assert.deepEqual(lignes("SELECT rang, classe_id, specialite_id FROM personnage_classe WHERE personnage_id = 'p-retraits'"), [{ rang: 1, classe_id: classe, specialite_id: null }]);
  assert.deepEqual(lignes("SELECT * FROM personnage_capacite WHERE personnage_id IN ('p-retraits', 'j-retraits')"), []);
  assert.deepEqual(lignes("SELECT * FROM personnage_sort WHERE personnage_id = 'p-retraits'"), []);
  assert.deepEqual(lignes("SELECT * FROM personnage_livre_sort WHERE personnage_id IN ('p-retraits', 'j-retraits')"), [], 'R169 : les livres du sort partent avec lui');
  const suite = ' n’existe plus dans les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.';
  const jour = jourDuRetrait(INSTANT);
  assert.equal(p.notes, ['Note du joueur.', ...[attendus.metier, attendus.specialite, attendus.sort].map((d) => `[${jour}] Retrait (règles modifiées) : ${d}${suite}`)].join('\n'));
  assert.equal(p.modifie_le, INSTANT);
  const j = ligne("SELECT notes, modifie_le, cree_le FROM personnage WHERE id = 'j-retraits'");
  assert.equal(j.notes, [attendus.donB, attendus.livre].map((d) => `[${jour}] Retrait (règles modifiées) : ${d}${suite}`).join('\n'));
  assert.equal(j.modifie_le, j.cree_le, 'fiche plus récente que l’instant : modifie_le = cree_le (CHECK modifie_le >= cree_le)');
  assert.deepEqual(lignes("SELECT rang, classe_id FROM personnage_classe WHERE personnage_id = 'j-retraits'"), [{ rang: 1, classe_id: classe }]);

  assert.equal(ligne('SELECT count(*) AS n FROM modification').n, journal, 'rien au journal');
  assert.equal(ligne(`SELECT count(*) AS n FROM modification WHERE table_nom IN (SELECT value FROM json_each(?))`, JSON.stringify(TABLES_FICHES)).n, 0);
  assert.deepEqual(lignes('PRAGMA foreign_key_check'), []);
  assert.deepEqual(noterLesRetraits(db, nouveauxRetraitsDeFiches(), INSTANT), [], 'rien à noter');
});

test('numerosDesFichesDeJoueur : toutes les fiches de joueur par date de création puis id (pas les prétirés) ; libelleDeFiche les lit ; ordreDesLibelles : prétirés, puis fiches de joueur', () => {
  const m = new DatabaseSync(':memory:');
  try {
    m.exec('CREATE TABLE personnage (id TEXT PRIMARY KEY, nature TEXT NOT NULL, nom TEXT NOT NULL, cree_le TEXT NOT NULL)');
    const fiche = (id, nature, creeLe) => m.prepare('INSERT INTO personnage (id, nature, nom, cree_le) VALUES (?, ?, ?, ?)').run(id, nature, `Secret ${id}`, creeLe);
    fiche('n-z', 'joueur', '2026-10-01T00:00:00Z');
    fiche('n-b', 'joueur', '2026-10-03T00:00:00Z');
    fiche('n-a', 'joueur', '2026-10-03T00:00:00Z');
    fiche('n-pretire', 'pretire', '2026-09-01T00:00:00Z');
    const numeros = numerosDesFichesDeJoueur(m);
    assert.deepEqual([...numeros], [['n-z', 1], ['n-a', 2], ['n-b', 3]]);
    assert.equal(libelleDeFiche({ personnage: 'n-b', nom: 'Secret n-b', nature: 'joueur' }, numeros), 'fiche de joueur n° 3');
    assert.equal(libelleDeFiche({ personnage: 'n-b', nom: 'Secret n-b', nature: 'joueur' }, numeros), 'fiche de joueur n° 3', 'lire ne change rien');
    assert.equal(libelleDeFiche({ personnage: 'n-pretire', nom: 'Aldric', nature: 'pretire' }, numeros), 'Aldric');
    assert.throws(() => libelleDeFiche({ personnage: 'inconnue', nom: 'X', nature: 'joueur' }, numeros), /absente des numéros/);
    // une fiche créée plus tard prend le numéro suivant, sans décaler les autres
    fiche('n-0', 'joueur', '2026-10-05T00:00:00Z');
    assert.deepEqual([...numerosDesFichesDeJoueur(m)], [['n-z', 1], ['n-a', 2], ['n-b', 3], ['n-0', 4]]);
  } finally {
    m.close();
  }
  assert.deepEqual(['fiche de joueur n° 10', 'Zora', 'fiche de joueur n° 2', 'aldric'].sort(ordreDesLibelles), ['aldric', 'Zora', 'fiche de joueur n° 2', 'fiche de joueur n° 10']);
});

test('R238 (2), MAJ-C7, R42 : Appui (même id, passé de Vindicatif à Protecteur) est retiré des Vindicatifs qui l’avaient, Large supprimé des Protecteurs, avec une note datée ; les autres fiches ne bougent pas', () => {
  const APPUI = 'capacites/cuirasse-appui';
  const LARGE = 'capacites/cuirasse-large';
  const VINDICATIF = 'classes/cuirasse#specialite:vindicatif';
  const PROTECTEUR = 'classes/cuirasse#specialite:protecteur';
  const MURAILLE = 'capacites/cuirasse-muraille';
  const regles = cheminDImport();
  const dossier = dossierTemporaire('retraits-cuirasse');
  const { chemin: vivante } = preparerBaseVivante({ regles, dossier: join(dossier, 'db') });

  // la base « d'avant » (la migration 0119 n'est pas encore passée) : Appui chez les Vindicatifs, Large chez les Protecteurs ; quatre prétirés
  const avant = new DatabaseSync(vivante);
  avant.exec('PRAGMA foreign_keys = ON');
  const un = (sql, ...p) => ({ ...avant.prepare(sql).get(...p) });
  const appui = un('SELECT * FROM capacite WHERE id = ?', APPUI);
  const pageAppui = un('SELECT * FROM page WHERE id = ?', APPUI);
  assert.equal(appui.specialite_id, PROTECTEUR, 'à l’import, Appui est chez les Protecteurs (migration 0119)');
  assert.equal(avant.prepare('SELECT count(*) AS n FROM capacite WHERE id = ?').get(LARGE).n, 0, 'Large n’existe plus (migration 0119)');
  const ins = (t, l) => avant.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
  // Large : la ligne d'avant, à la place qu'Appui a prise (Protecteur, niveau 20, ligne 43, rang 2) ; Appui, à une place libre chez les Vindicatifs
  avant.prepare('UPDATE capacite SET specialite_id = ?, niveau = 15, ligne = 36, rang = 9 WHERE id = ?').run(VINDICATIF, APPUI);
  ins('page', { ...pageAppui, id: LARGE, slug: 'cuirasse-large', titre: 'Large (Cuirassé)', titre_cle: 'large-cuirasse' });
  ins('capacite', { ...appui, id: LARGE, specialite_id: PROTECTEUR, niveau: 20, ligne: 43, rang: 2, nom: 'Large', nom_cle: 'large' });
  const FICHE_COMMUNE = { visibilite: 'tous', mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: '2026-10-10T12:00:00Z', modifie_le: '2026-10-10T12:00:00Z', nature: 'pretire' };
  const fiche = (id, specialite, dons) => {
    ins('personnage', { ...FICHE_COMMUNE, id, nom: `Prétiré ${id}`, notes: 'Note du joueur.' });
    ins('personnage_classe', { personnage_id: id, rang: 1, classe_id: 'classes/cuirasse', specialite_id: specialite });
    for (const d of dons) ins('personnage_capacite', { personnage_id: id, capacite_id: d });
  };
  fiche('c-vindicatif', VINDICATIF, [APPUI]);
  fiche('c-protecteur-large', PROTECTEUR, [LARGE]);
  fiche('c-protecteur-muraille', PROTECTEUR, [MURAILLE]);
  fiche('c-vindicatif-autre', VINDICATIF, ['capacites/cuirasse-aucune-fuite']);
  avant.close();

  // la livraison : les règles d'import (Appui chez les Protecteurs, Large supprimé), une modification sans rapport pour que la base soit refaite
  const livraison = join(dossier, 'livraison.db');
  copyFileSync(regles, livraison);
  const l = new DatabaseSync(livraison, { enableForeignKeyConstraints: false });
  l.exec("UPDATE race SET nom = 'Humain (livraison)' WHERE id = 'races/humain'");
  l.close();
  const instant = new Date('2026-11-12T09:00:00Z');
  const iso = '2026-11-12T09:00:00Z';
  const r = preparerBaseVivante({ regles: livraison, dossier: join(dossier, 'db'), instant });
  assert.equal(r.refaite, true);

  const apres = new DatabaseSync(vivante, { readOnly: true });
  try {
    const dons = (id) => apres.prepare('SELECT capacite_id FROM personnage_capacite WHERE personnage_id = ?').all(id).map((x) => x.capacite_id);
    assert.deepEqual(dons('c-vindicatif'), [], 'Appui retiré du Vindicatif : le joueur rechoisit');
    assert.deepEqual(dons('c-protecteur-large'), [], 'Large supprimé du Protecteur');
    assert.deepEqual(dons('c-protecteur-muraille'), [MURAILLE], 'une autre fiche de Protecteur ne bouge pas');
    assert.deepEqual(dons('c-vindicatif-autre'), ['capacites/cuirasse-aucune-fuite'], 'un autre choix du Vindicatif ne bouge pas');
    assert.deepEqual(apres.prepare("SELECT personnage_id, specialite_id FROM personnage_classe WHERE personnage_id LIKE 'c-%' ORDER BY personnage_id").all().map((x) => ({ ...x })), [
      { personnage_id: 'c-protecteur-large', specialite_id: PROTECTEUR }, { personnage_id: 'c-protecteur-muraille', specialite_id: PROTECTEUR },
      { personnage_id: 'c-vindicatif', specialite_id: VINDICATIF }, { personnage_id: 'c-vindicatif-autre', specialite_id: VINDICATIF }], 'la classe et la spécialité de la fiche restent');
    const noms = (id) => apres.prepare('SELECT nom FROM capacite WHERE id = ?').get(id)?.nom;
    const niveau = (id) => apres.prepare('SELECT niveau FROM capacite WHERE id = ?').get(id)?.niveau;
    const cuirasse = apres.prepare("SELECT nom FROM classe WHERE id = 'classes/cuirasse'").get().nom;
    const nomDe = (id) => apres.prepare('SELECT nom FROM specialite WHERE id = ?').get(id).nom;
    const notes = (id) => apres.prepare('SELECT notes FROM personnage WHERE id = ?').get(id).notes;
    const jour = jourDuRetrait(iso);
    // la note d'Appui : datée, avec la place d'avant (Vindicatif, niveau 15) et la nouvelle (Protecteur, niveau 20)
    const noteAppui = ligneDeRetrait({ nature: 'capacite', cas: 'deplace', id: APPUI, nom: noms(APPUI), classe: cuirasse, specialite: nomDe(VINDICATIF), niveau: 15,
      vers: `${nomDe(PROTECTEUR)}, niveau ${niveau(APPUI)}` }, iso);
    assert.equal(notes('c-vindicatif'), `Note du joueur.\n${noteAppui}`);
    assert.ok(noteAppui.startsWith(`[${jour}] Retrait (règles modifiées) : le don « ${noms(APPUI)} »`));
    assert.match(noteAppui, /spécialité .+, niveau 15\) a changé de spécialité dans les règles \(maintenant .+, niveau 20\)/);
    // la note de Large : celle d'un don supprimé (R42), avec sa place d'avant lue dans l'ancienne base
    const noteLarge = ligneDeRetrait({ nature: 'capacite', id: LARGE, nom: 'Large', classe: cuirasse, specialite: nomDe(PROTECTEUR), niveau: 20 }, iso);
    assert.equal(notes('c-protecteur-large'), `Note du joueur.\n${noteLarge}`);
    assert.match(noteLarge, /n’existe plus dans les règles/);
    assert.equal(notes('c-protecteur-muraille'), 'Note du joueur.');
    assert.equal(notes('c-vindicatif-autre'), 'Note du joueur.');
    // le bilan de la reconstruction (/api/etat) liste les deux fiches
    assert.deepEqual(r.fiches.map((f) => f.fiche).sort(), ['Prétiré c-protecteur-large', 'Prétiré c-vindicatif']);
    assert.deepEqual(apres.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    apres.close();
  }
  // idempotence : la même livraison relue ne retire ni ne note rien de plus
  const encore = preparerBaseVivante({ regles: livraison, dossier: join(dossier, 'db'), instant });
  assert.equal(encore.refaite, false);
});

test('R238 (4), MAJ-C10, R148 : le point de maîtrise imposé de l’Archimage devient à choisir ; la fiche garde ses choix, une note datée le dit, une seule fois ; une autre classe ne bouge pas', () => {
  const SOURCE = 'classes/archimage#maitrise-arme:2';
  const regles = cheminDImport();
  const dossier = dossierTemporaire('retraits-archimage');
  const { chemin: vivante } = preparerBaseVivante({ regles, dossier: join(dossier, 'db') });

  // la base « d'avant » : la ligne 2 de l'Archimage imposait le Bâton (part `imposee`, sans options)
  const avant = new DatabaseSync(vivante);
  avant.exec('PRAGMA foreign_keys = ON');
  const part = { ...avant.prepare('SELECT * FROM maitrise_arme_part WHERE source_id = ?').get(SOURCE) };
  assert.equal(part.genre, 'choix', 'à l’import, la ligne 2 de l’Archimage est à choisir (migration 0119)');
  avant.prepare('DELETE FROM maitrise_arme_part_famille WHERE source_id = ? AND rang = ?').run(SOURCE, part.rang);
  avant.prepare("UPDATE maitrise_arme_part SET genre = 'imposee', arme_famille_id = 'baton-de-combat' WHERE source_id = ? AND rang = ?").run(SOURCE, part.rang);
  const ins = (t, l) => avant.prepare(`INSERT INTO ${t} (${Object.keys(l).join(', ')}) VALUES (${Object.keys(l).map(() => '?').join(', ')})`).run(...Object.values(l));
  const COMMUNE = { visibilite: 'tous', mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: '2026-10-10T12:00:00Z', modifie_le: '2026-10-10T12:00:00Z', nature: 'pretire' };
  for (const [id, classe] of [['m-archimage', 'classes/archimage'], ['m-guerrier', 'classes/guerrier']]) {
    ins('personnage', { ...COMMUNE, id, nom: `Prétiré ${id}`, notes: 'Note du joueur.' });
    ins('personnage_classe', { personnage_id: id, rang: 1, classe_id: classe });
  }
  ins('personnage_maitrise_choix', { personnage_id: 'm-archimage', source: 'classes/archimage#maitrise-arme:1', rang: 1, arme_famille_id: 'arc' });
  avant.close();

  const livraison = join(dossier, 'livraison.db');
  copyFileSync(regles, livraison);
  const l = new DatabaseSync(livraison, { enableForeignKeyConstraints: false });
  l.exec("UPDATE race SET nom = 'Humain (livraison)' WHERE id = 'races/humain'");
  l.close();
  const iso = '2026-11-12T09:00:00Z';
  const r = preparerBaseVivante({ regles: livraison, dossier: join(dossier, 'db'), instant: new Date(iso) });
  assert.equal(r.refaite, true);

  const apres = new DatabaseSync(vivante, { readOnly: true });
  try {
    const notes = (id) => apres.prepare('SELECT notes FROM personnage WHERE id = ?').get(id).notes;
    const famille = apres.prepare("SELECT nom FROM arme_famille WHERE id = 'baton-de-combat'").get().nom;
    const classe = apres.prepare("SELECT nom FROM classe WHERE id = 'classes/archimage'").get().nom;
    const ligne = ligneDeRetrait({ nature: 'maitrise_imposee', id: `${SOURCE}:${part.rang}`, nom: famille, classe, rang: 2 }, iso);
    assert.equal(notes('m-archimage'), `Note du joueur.\n${ligne}`);
    assert.match(ligne, /^\[12\/11\/2026\] Retrait \(règles modifiées\) : le point de maîtrise d’arme imposé « .+ » \(classe .+, maîtrise 2\) n’est plus imposé/);
    assert.equal(notes('m-guerrier'), 'Note du joueur.', 'une autre classe : aucune note');
    // rien d'autre ne change : le choix de la ligne 1 est gardé, aucun choix n'est inventé pour la ligne 2 (elle reste « à choisir », R148)
    assert.deepEqual(apres.prepare("SELECT source, rang, arme_famille_id FROM personnage_maitrise_choix WHERE personnage_id = 'm-archimage'").all().map((x) => ({ ...x })),
      [{ source: 'classes/archimage#maitrise-arme:1', rang: 1, arme_famille_id: 'arc' }]);
    assert.deepEqual(apres.prepare("SELECT genre FROM maitrise_arme_part WHERE source_id = ?").all(SOURCE).map((x) => x.genre), ['choix']);
    assert.deepEqual(r.fiches.map((f) => f.fiche), ['Prétiré m-archimage']);
  } finally {
    apres.close();
  }
  // une seconde livraison : l'ancienne base est celle de la première, aucune seconde note
  const suivante = join(dossier, 'livraison2.db');
  copyFileSync(regles, suivante);
  const s2 = new DatabaseSync(suivante, { enableForeignKeyConstraints: false });
  s2.exec("UPDATE race SET nom = 'Humain (livraison 2)' WHERE id = 'races/humain'");
  s2.close();
  const r2 = preparerBaseVivante({ regles: suivante, dossier: join(dossier, 'db'), instant: new Date('2026-11-13T09:00:00Z') });
  assert.equal(r2.refaite, true);
  assert.deepEqual(r2.fiches, []);
  const fin = new DatabaseSync(vivante, { readOnly: true });
  try {
    assert.equal(fin.prepare("SELECT count(*) AS n FROM personnage WHERE id = 'm-archimage' AND notes LIKE '%Retrait%'").get().n, 1);
    assert.equal(fin.prepare("SELECT length(notes) - length(replace(notes, 'Retrait (règles modifiées)', '')) AS n FROM personnage WHERE id = 'm-archimage'").get().n, 'Retrait (règles modifiées)'.length);
  } finally {
    fin.close();
  }
});
