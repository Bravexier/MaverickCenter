// Décision R165 (migration 0080-armure-elementaire-de-la-fiche) : l'armure élémentaire est l'armure de la fiche. Une fiche d'avant (une armure et son
// « élément », R95) est convertie : l'élément devient l'armure, avec l'amélioration de l'élément ; l'armure d'origine, son amélioration et la solidité de
// ses parties abîmées sont notées, datées, à la fin des notes (une ligne de retrait, que la page /fiche/ compte : lib/fiche-format.mjs#retraitsDesNotes) ;
// l'armure élémentaire repart à son maximum. Puis une armure « Familier » et une armure élémentaire d'une magie que le personnage n'a pas sont retirées
// et notées de même. Les tables des fiches sont vides dans data/rows : le test rejoue la migration sur une COPIE de la base construite, où il pose des
// fiches au format d'avant (les colonnes n'ont pas changé, seule la vue de contrôle est refaite, et la constante qu'elle ajoute est retirée d'abord).
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { test } from 'node:test';
import { cheminBase, trouverRacine } from '../src/lib/donnees.mjs';
import { retraitsDesNotes } from '../src/lib/fiche-format.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = trouverRacine();
const migration = readFileSync(join(racine, 'data', 'migrations', '0080-armure-elementaire-de-la-fiche.sql'), 'utf8');
const copie = fichierTemporaire('maverick.db', 'maverick-0080-');
copyFileSync(cheminBase({ sansExemples: false }), copie);
const db = new DatabaseSync(copie);
db.exec('PRAGMA foreign_keys = ON');

const INSTANT = '2026-10-09T12:00:00Z';
const un = (sql, ...p) => db.prepare(sql).get(...p);
const nom = (table, id) => un(`SELECT nom FROM ${table} WHERE id = ?`, id).nom;
const amelioration = (cible, niveau) => un('SELECT id FROM amelioration_equipement WHERE cible = ? AND niveau = ?', cible, niveau).id;
const elementaire = (magie, categorie) => un('SELECT id FROM armure_elementaire WHERE magie_id = ? AND categorie = ?', magie, categorie).id;
const GRILLE = un('SELECT id FROM armure WHERE solidite_uni IS NULL ORDER BY ordre LIMIT 1').id;
const FAMILIER = un("SELECT id FROM armure WHERE type = 'Familier' ORDER BY ordre LIMIT 1").id;
const FEU = elementaire('magies/magie-du-feu', 'Intermédiaire');
const VENT = elementaire('magies/magie-du-vent', 'Léger');

function inserer(table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
function fiche(id, colonnes = {}, parties = {}) {
  inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'joueuse', visibilite: 'privee', nom: `Fiche ${id}`, magie_innee_id: 'magies/magie-du-feu', mode_classe: 'mono',
    xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0,
    cree_le: INSTANT, modifie_le: INSTANT, ...colonnes,
  });
  for (const [emplacement_id, solidite] of Object.entries(parties)) inserer('personnage_armure_partie', { personnage_id: id, emplacement_id, solidite });
}
const ARMURE = ['armure_id', 'armure_amelioration_id', 'armure_elementaire_id', 'armure_amelioration_elementaire_id'];
const etat = (id) => {
  const p = un(`SELECT ${ARMURE.join(', ')}, notes, modifie_le FROM personnage WHERE id = ?`, id);
  const parties = db.prepare('SELECT emplacement_id, solidite FROM personnage_armure_partie WHERE personnage_id = ? ORDER BY emplacement_id').all(id);
  return { ...p, parties: Object.fromEntries(parties.map((l) => [l.emplacement_id, l.solidite])) };
};
const sansDate = (notes) => notes?.replace(/^\[\d{2}\/\d{2}\/\d{4}\] /gm, '[date] ') ?? null;
const reglesDArmure = (id) => db.prepare("SELECT regle FROM v_personnage_controle WHERE personnage_id = ? AND (regle LIKE 'armure%' OR regle = 'amelioration_cible')")
  .all(id).map((r) => r.regle);

inserer('utilisateur', { id: 'joueuse', discord_id: null, nom_affichage: 'joueuse', cree_le: INSTANT });
// avant : l'armure et son élément (R95), deux parties abîmées, des notes du joueur
fiche('transformee', { armure_id: GRILLE, armure_amelioration_id: amelioration('armure', 2), armure_elementaire_id: FEU,
  armure_amelioration_elementaire_id: amelioration('armure_elementaire', 3), notes: 'Mon texte' }, { casque: 1, torse: 0 });
// l'armure et un élément sans amélioration ni partie abîmée, d'une magie que le personnage n'a pas : convertie, puis retirée
fiche('autre-magie', { armure_id: GRILLE, armure_elementaire_id: VENT });
// une armure de familier (cran uni) : retirée
fiche('familier', { armure_id: FAMILIER, notes: 'Ligne\n' }, { 'armure-complete': 1 });
// déjà au nouveau format : une armure de base, une armure élémentaire de la magie acquise ; rien ne change
fiche('de-base', { armure_id: GRILLE, armure_amelioration_id: amelioration('armure', 1), notes: 'Rien' }, { torse: 2 });
fiche('acquise', { magie_acquise_id: 'magies/magie-du-vent', armure_elementaire_id: VENT }, { 'jambe-gauche': 3 });
const AVANT = { 'de-base': etat('de-base'), acquise: etat('acquise') };

db.prepare("DELETE FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").run();
db.exec(migration);

test('R165 : l’élément devient l’armure, avec son amélioration ; l’armure d’origine, son amélioration et ses parties notées ; à son maximum', () => {
  const e = etat('transformee');
  assert.deepEqual({ ...e, notes: undefined, modifie_le: undefined }, {
    armure_id: null, armure_amelioration_id: null, armure_elementaire_id: FEU, armure_amelioration_elementaire_id: amelioration('armure_elementaire', 3),
    notes: undefined, modifie_le: undefined, parties: {},
  });
  assert.equal(sansDate(e.notes), `Mon texte\n[date] Retrait (règles modifiées) : l’armure « ${nom('armure', GRILLE)} » (amélioration +2, solidité Casque 1, Torse 0) `
    + `est devenue l’armure élémentaire « ${nom('armure_elementaire', FEU)} » (amélioration +3) de la fiche, remise à sa solidité maximum : une armure `
    + 'transformée par une pièce élémentaire n’a plus rien de l’armure d’origine. Adaptez la fiche.');
  assert.equal(retraitsDesNotes(e.notes).length, 1, 'une ligne de retrait, comptée par la page /fiche/');
  assert.ok(e.modifie_le > INSTANT, 'la fiche est modifiée');
  assert.deepEqual(reglesDArmure('transformee'), []);
});

test('R165 : une armure élémentaire d’une magie que le personnage n’a pas, et une armure « Familier », retirées et notées', () => {
  const e = etat('autre-magie');
  assert.deepEqual(ARMURE.map((c) => e[c]), [null, null, null, null]);
  assert.equal(sansDate(e.notes), [
    `[date] Retrait (règles modifiées) : l’armure « ${nom('armure', GRILLE)} » est devenue l’armure élémentaire « ${nom('armure_elementaire', VENT)} » de la fiche, `
      + 'remise à sa solidité maximum : une armure transformée par une pièce élémentaire n’a plus rien de l’armure d’origine. Adaptez la fiche.',
    `[date] Retrait (règles modifiées) : l’armure élémentaire « ${nom('armure_elementaire', VENT)} » n’est plus portée : le personnage n’a pas la magie de cette `
      + 'armure (Vent). Adaptez la fiche.',
  ].join('\n'));
  const f = etat('familier');
  assert.deepEqual([...ARMURE.map((c) => f[c]), f.parties], [null, null, null, null, {}]);
  assert.equal(sansDate(f.notes), `Ligne\n[date] Retrait (règles modifiées) : l’armure « ${nom('armure', FAMILIER)} » (solidité Armure Complète 1) n’est plus `
    + 'portée : une armure de familier ne se porte pas sur une fiche de personnage. Adaptez la fiche.');
  assert.deepEqual([...reglesDArmure('autre-magie'), ...reglesDArmure('familier')], []);
});

test('R165 : une fiche déjà au nouveau format ne change pas', () => {
  assert.deepEqual(etat('de-base'), AVANT['de-base']);
  assert.deepEqual(etat('acquise'), AVANT.acquise);
  assert.equal(un("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").valeur, 4, '4 crans de solidité (R165)');
  assert.equal(un("SELECT count(*) AS n FROM sqlite_master WHERE name = 'note_0080'").n, 0, 'la table de travail est retirée');
});
