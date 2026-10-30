// Retraits des fiches (décision R42 ; client/serveur/fiches-retraits.mjs) : un don, une spécialité (avec ses dons choisis), un sort ou un métier que les
// règles suppriment est retiré des fiches qui l'utilisent, avec une ligne datée dans leurs notes ; les fiches ne passent jamais par le journal de
// l'édition (serveur/edition-journal.mjs). Base vivante temporaire ; les données d'essai (classe, spécialité, dons, métier) sont créées ici sous des noms
// absents de la base, le sort est lu dans la base.
import assert from 'node:assert/strict';
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
import { jourDuRetrait, TABLES_FICHES } from '../src/lib/fiche-format.mjs';
import { normalize } from '../src/lib/text.mjs';
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

test('RETRAITS : exactement les clés étrangères des fiches vers metier, specialite, capacite, sort, arme et classe_annexe_entree (colonnes dans l’ordre)', () => {
  const vers = new Set(['metier', 'specialite', 'capacite', 'sort', 'arme', 'classe_annexe_entree']);
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
  // « Variable » (capacite) et son entrée (classe_annexe_entree)
  assert.equal(cles.length, 8);
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
