// Décisions R188 et R189 (migration 0097-r188-r189-plafond-npm-et-grimoire) : le plafond de NPM des sorts du Potentiel Illimité (magie_npm_plafond),
// relevé par un don acquis (capacite_npm_plafond : « Semi-complet » de l'Archimage), contrôlé par la règle sort_puissance de v_personnage_controle :
// NPM d'un sort au plus min(puissance magique du niveau, max des plafonds), le don n'ouvrant jamais un NPM que le niveau n'ouvre pas (R188 (1)) ; et le
// don « Grimoire » qui compte comme une condition d'emplacements de sorts (capacite_condition_emplacements, R189 : aucune règle SQL). Ces lignes sont des
// valeurs de la décision, écrites par la migration ; ni lib/edition-modele.mjs ni le service ne les écrivent : le test les lit en base, jamais en dur.
// La vue s'essaie sur une COPIE de la base d'import (test/aide-base-d-import.mjs) : le niveau d'un don, l'XP d'un niveau se modifient sur le site de dev.
//   node --test test/r188-npm-potentiel-illimite-base.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

// identifiants figés (jamais un nom) : le don de R188, celui de R189, la classe qui les donne
const SEMI_COMPLET = 'capacites/archimage-semi-complet';
const GRIMOIRE = 'capacites/archimage-grimoire';
const ARCHIMAGE = 'classes/archimage';
const INSTANT = '2026-11-07T12:00:00Z';

const copie = fichierTemporaire('maverick.db', 'r188');
copyFileSync(cheminDImport(), copie);
const db = new DatabaseSync(copie);
db.exec('PRAGMA foreign_keys = ON');
const un = (sql, ...p) => db.prepare(sql).get(...p);
const tous = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));

function inserer(table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}
inserer('utilisateur', { id: 'r188', discord_id: '100000000000000188', nom_affichage: 'r188', cree_le: INSTANT });

const plafondDeLaMagie = un('SELECT npm FROM magie_npm_plafond WHERE magie_id = ?', POTENTIEL_ILLIMITE)?.npm;
const plafondDuDon = un('SELECT npm FROM capacite_npm_plafond WHERE capacite_id = ?', SEMI_COMPLET)?.npm;
const niveauDuDon = un('SELECT niveau FROM capacite WHERE id = ?', SEMI_COMPLET).niveau;
const xpDuNiveau = (n) => un('SELECT xp_min FROM niveau_global WHERE niveau = ?', n).xp_min;
/** La puissance magique du niveau global `n` (R16) ; le palier réservé aux personnages sans magie acquise compte (aucune fiche de ce test n'en a). */
const puissance = (n) => un('SELECT MAX(puissance_magique) AS p FROM niveau_global WHERE niveau <= ?', n).p;
const niveaux = tous('SELECT niveau FROM niveau_global ORDER BY niveau').map((r) => r.niveau);
/** Le premier niveau global dont la puissance magique atteint `p`. */
const premierNiveau = (p) => niveaux.find((n) => puissance(n) >= p);
const sortDeNpm = (npm) => un('SELECT id FROM sort WHERE niveau = ? ORDER BY id LIMIT 1', npm).id;

/** Une fiche inachevée (la vue en signale les manques : seule sort_puissance est regardée), au niveau global `niveau`, avec sa classe et un sort. */
function fiche(id, { niveau, magie = POTENTIEL_ILLIMITE, mode = 'bi', classe = ARCHIMAGE, npm }) {
  inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'r188', visibilite: 'privee', nom: id, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: magie, mode_classe: mode, xp: xpDuNiveau(niveau), alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0, alignement_mauvais: 0,
    bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT,
  });
  inserer('personnage_classe', { personnage_id: id, rang: 1, classe_id: classe });
  inserer('personnage_sort', { personnage_id: id, sort_id: sortDeNpm(npm), rang: 1, niveau_maitrise: 0 });
  assert.equal(un('SELECT niveau_global FROM v_personnage_niveau WHERE personnage_id = ?', id).niveau_global, niveau, `${id} : niveau global`);
  return id;
}
const signale = (id) => tous("SELECT detail FROM v_personnage_controle WHERE personnage_id = ? AND regle = 'sort_puissance'", id).length > 0;
const aLeDon = (id, don) => Boolean(un('SELECT 1 AS x FROM v_personnage_don_acquis WHERE personnage_id = ? AND capacite_id = ?', id, don));

test('migration 0097 : les plafonds de R188 et la condition d’emplacements de R189 sont des lignes de la base, sur les dons et la magie de la décision', () => {
  assert.deepEqual(tous('SELECT magie_id FROM magie_npm_plafond').map((r) => r.magie_id), [POTENTIEL_ILLIMITE], 'seul le Potentiel Illimité a un plafond');
  assert.deepEqual(tous('SELECT capacite_id FROM capacite_npm_plafond').map((r) => r.capacite_id), [SEMI_COMPLET]);
  assert.deepEqual(tous('SELECT capacite_id FROM capacite_condition_emplacements').map((r) => r.capacite_id), [GRIMOIRE]);
  for (const don of [SEMI_COMPLET, GRIMOIRE]) assert.equal(un('SELECT classe_id FROM capacite WHERE id = ?', don).classe_id, ARCHIMAGE, don);
  // le don relève le plafond (R188 : « jusqu'au NPM 4 s'il a acquis le don ») sans dépasser le NPM le plus haut de la table des niveaux
  assert.ok(Number.isInteger(plafondDeLaMagie) && Number.isInteger(plafondDuDon));
  assert.ok(plafondDeLaMagie < plafondDuDon && plafondDuDon < puissance(niveaux.at(-1)), `${plafondDeLaMagie} < ${plafondDuDon} < NPM max`);
  // CHECK : un plafond hors de 1 à 5 est refusé
  assert.throws(() => db.exec(`UPDATE magie_npm_plafond SET npm = 6 WHERE magie_id = '${POTENTIEL_ILLIMITE}'`), /CHECK/);
  assert.throws(() => db.exec(`UPDATE capacite_npm_plafond SET npm = 0 WHERE capacite_id = '${SEMI_COMPLET}'`), /CHECK/);
});

test('R188 : le Potentiel Illimité ne choisit ses sorts que jusqu’à son plafond, jusqu’à celui du don « Semi-complet » acquis, jamais au-delà du niveau', () => {
  const max = premierNiveau(niveaux.map(puissance).at(-1)); // le niveau où la puissance magique atteint son maximum (16 à l'import, R16)
  assert.ok(puissance(max) > plafondDuDon);
  // bi-classe au niveau du NPM maximal : niveau d'Archimage = niveau global, sous celui du don (R2) ; le plafond de la magie seul
  assert.ok(max < niveauDuDon, 'en bi-classe, « Semi-complet » n’est pas acquis à ce niveau');
  const npmMax = fiche('pi-bi-npm-max', { niveau: max, npm: puissance(max) });
  assert.ok(!aLeDon(npmMax, SEMI_COMPLET));
  assert.ok(signale(npmMax), 'NPM du niveau, au-delà de tout plafond : signalé');
  assert.ok(signale(fiche('pi-bi-npm-don', { niveau: max, npm: plafondDuDon })), 'NPM du don, sans le don : signalé');
  assert.ok(!signale(fiche('pi-bi-npm-magie', { niveau: max, npm: plafondDeLaMagie })), 'NPM du plafond de la magie : permis');
  // mono-classe : « Semi-complet » acquis dès que le niveau d'Archimage (2 par niveau global, R2) atteint celui du don
  const avecLeDon = Math.max(Math.ceil(niveauDuDon / 2), premierNiveau(plafondDuDon));
  const mono = fiche('pi-mono-npm-don', { niveau: avecLeDon, mode: 'mono', npm: plafondDuDon });
  assert.ok(aLeDon(mono, SEMI_COMPLET), 'le don est acquis');
  assert.ok(!signale(mono), 'NPM du don, avec le don, au niveau qui l’ouvre : permis');
  const monoMax = fiche('pi-mono-npm-max', { niveau: max, mode: 'mono', npm: puissance(max) });
  assert.ok(aLeDon(monoMax, SEMI_COMPLET) && signale(monoMax), 'le don relève le plafond à son NPM, pas au-delà');
});

test('R188 (1) : « Semi-complet » relève le plafond sans ouvrir le NPM avant le niveau qui l’ouvre à tous (question A, « Il doit attendre le niveau 12 »)', () => {
  // à l'import : le don arrive au niveau global 10 en mono-classe, la table n'ouvre le NPM 4 qu'au niveau 12
  const arrivee = Math.ceil(niveauDuDon / 2);
  assert.ok(puissance(arrivee) < plafondDuDon, 'à l’import, le don arrive avant le niveau qui ouvre son NPM');
  const tot = fiche('pi-mono-don-tot', { niveau: arrivee, mode: 'mono', npm: plafondDuDon });
  assert.ok(aLeDon(tot, SEMI_COMPLET) && signale(tot));
  assert.ok(!signale(fiche('pi-mono-don-tot-niveau', { niveau: arrivee, mode: 'mono', npm: puissance(arrivee) })), 'la puissance du niveau, sous le plafond');
});

test('R188 : une magie innée sans plafond garde la puissance du niveau (R16)', () => {
  const max = premierNiveau(niveaux.map(puissance).at(-1));
  const sansPlafond = un('SELECT m.id FROM magie m WHERE NOT EXISTS (SELECT 1 FROM magie_npm_plafond p WHERE p.magie_id = m.id) ORDER BY m.ordre LIMIT 1').id;
  const classe = un('SELECT id FROM classe WHERE magie_innee_id IS NULL ORDER BY ordre LIMIT 1').id;
  assert.ok(!signale(fiche('sans-plafond-npm-max', { niveau: max, magie: sansPlafond, classe, npm: puissance(max) })));
  assert.ok(signale(fiche('sans-plafond-trop-tot', { niveau: max - 1, magie: sansPlafond, classe, npm: puissance(max) })), 'R16 inchangée');
});

test('R188, R189 : les règles de la fiche (lib/fiche-regles.mjs) et la page des magies (lib/magies-db.mjs#chargerMagies) suivent les tables', () => {
  const base = ouvrirBase({ sansExemples: false });
  const regles = chargerReglesDeFiche(base);
  const plafonds = Object.fromEntries(base.prepare('SELECT magie_id, npm FROM magie_npm_plafond').all().map((r) => [r.magie_id, r.npm]));
  for (const m of regles.magies) assert.equal(m.npm_plafond, plafonds[m.id] ?? null, m.id);
  const dons = regles.classes.flatMap((c) => c.dons);
  assert.deepEqual(Object.fromEntries(dons.filter((d) => d.npm_plafond !== undefined).map((d) => [d.id, d.npm_plafond])),
    Object.fromEntries(base.prepare('SELECT capacite_id, npm FROM capacite_npm_plafond').all().map((r) => [r.capacite_id, r.npm])));
  assert.deepEqual(dons.filter((d) => d.condition_emplacements).map((d) => d.id).sort(),
    base.prepare('SELECT capacite_id FROM capacite_condition_emplacements ORDER BY capacite_id').all().map((r) => r.capacite_id));
  assert.ok(dons.every((d) => d.condition_emplacements === undefined || d.condition_emplacements === true));
  // la page : le plafond de la magie, et ce plafond relevé par le meilleur don ; null pour une magie sans plafond
  const meilleurDon = base.prepare('SELECT MAX(npm) AS npm FROM capacite_npm_plafond').get().npm ?? 0;
  for (const m of chargerMagies(base).magies.values()) {
    assert.equal(m.npmPlafond, plafonds[m.id] ?? null, m.id);
    assert.equal(m.npmPlafondAvecDon, m.id in plafonds ? Math.max(plafonds[m.id], meilleurDon) : null, m.id);
  }
});
