// Migration 0118-r236-specialisation-de-la-fiche : la spécialisation magique choisie sur la fiche (décision R236 : (3) le bi-magie en choisit une par
// magie, (6) le choix reste modifiable, (2) le mono-magie a les deux, (7) le Potentiel Illimité celles de chaque magie), les règles
// sort_hors_specialisation et specialisation_hors_magie de v_personnage_controle, et le coût secondaire de Projectile arcanique (décision R251).
// La vue s'essaie sur une COPIE de la base d'import (test/aide-base-d-import.mjs) ; magies, spécialisations et sorts se choisissent par id dans la
// copie, jamais par nom. Les écritures de R251 se lisent dans le registre de la migration et dans docs/decisions-regles.md, jamais en dur.
//   node --test test/db-0118-specialisation-de-la-fiche.test.mjs
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { analyserCout } from '../src/lib/sort-analyse.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { fichierTemporaire } from './aide-dossier-temporaire.mjs';

const PROJECTILE_ARCANIQUE = 'magies/magie-de-larcane#sort:projectile-arcanique';
const REGISTRE = JSON.parse(readFileSync(new URL('../../data/migrations/0118-r236-specialisation-de-la-fiche.json', import.meta.url), 'utf8'));
const INSTANT = '2026-11-12T12:00:00Z';
const REGLES = ['sort_hors_specialisation', 'specialisation_hors_magie'];

const copie = fichierTemporaire('maverick.db', 'r236-fiche');
copyFileSync(cheminDImport(), copie);
const db = new DatabaseSync(copie);
db.exec('PRAGMA foreign_keys = ON');
const un = (sql, ...p) => db.prepare(sql).get(...p);
const tous = (sql, ...p) => db.prepare(sql).all(...p).map((r) => ({ ...r }));

function inserer(table, ligne) {
  const cols = Object.keys(ligne);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(ligne));
}

test('R251 : Projectile arcanique porte le coût, sa valeur et le coût secondaire de la décision (état d’import, écritures lues dans le registre et la décision)', () => {
  assert.deepEqual(REGISTRE.decisions, ['R236', 'R251']);
  const valeurs = Object.fromEntries(REGISTRE.valeurs.map((v) => [v.col, v]));
  assert.deepEqual(Object.keys(valeurs).sort(), ['cout_brut', 'cout_chakra', 'cout_secondaire']);
  for (const v of REGISTRE.valeurs) assert.deepEqual([v.table, v.cle.id, v.decision], ['sort', PROJECTILE_ARCANIQUE, 'R251'], v.col);
  const decision = readFileSync(new URL('../../docs/decisions-regles.md', import.meta.url), 'utf8').split('\n').find((l) => l.startsWith('| R251 |'));
  // « Coût : « 4/projectile » (valeur 4) ; coût secondaire : « … » » : les écritures et la valeur du registre sont celles de la décision
  assert.ok(decision?.split('**').join('').includes(`« ${valeurs.cout_brut.apres} » (valeur ${valeurs.cout_chakra.apres})`), 'le coût et sa valeur sont ceux de R251');
  assert.ok(decision.includes(`« ${valeurs.cout_secondaire.apres} »`), 'le coût secondaire est celui de R251');
  const sort = un('SELECT cout_secondaire, cout_brut, cout_chakra, cout_ressource, cout_ressource_valeur FROM sort WHERE id = ?', PROJECTILE_ARCANIQUE);
  assert.ok(sort, 'le sort existe (id figé)');
  assert.deepEqual([sort.cout_brut, sort.cout_chakra, sort.cout_secondaire], [valeurs.cout_brut.apres, valeurs.cout_chakra.apres, valeurs.cout_secondaire.apres]);
  // la valeur typée est celle que lit le service (le calcul par projectile est celui de la fiche, R248)
  assert.deepEqual({ cout_chakra: sort.cout_chakra, cout_ressource: sort.cout_ressource, cout_ressource_valeur: sort.cout_ressource_valeur },
    analyserCout(sort.cout_brut, sort.cout_secondaire));
  // la case « Coût » du corps de la page de l'Arcane suit (registre `textes`)
  const corps = un("SELECT corps_md FROM page WHERE id = 'magies/magie-de-larcane'").corps_md;
  for (const t of REGISTRE.textes) assert.ok(corps.includes(t.apres) && !corps.includes(t.avant), `${t.cle.id} : case « Coût »`);
});

// --- fiches d'essai -------------------------------------------------------------------------------------------------------------------------------------
inserer('utilisateur', { id: 'r236', discord_id: '100000000000000236', nom_affichage: 'r236', cree_le: INSTANT });

/** Deux magies qui ont leurs deux spécialisations (jamais le Potentiel Illimité), et une troisième ; par id. */
const [A, B, C] = tous('SELECT magie_id FROM magie_specialisation GROUP BY magie_id HAVING count(*) = 2 ORDER BY magie_id LIMIT 3').map((r) => r.magie_id);
const specialisation = (magie, ordre) => un('SELECT id FROM magie_specialisation WHERE magie_id = ? AND ordre = ?', magie, ordre).id;
const sortDe = (magie, spe) => un(`SELECT id FROM sort WHERE magie_id = ? AND specialisation_id ${spe ? '= ?' : 'IS NULL'} ORDER BY id LIMIT 1`, magie, ...(spe ? [spe] : [])).id;

/** Une fiche inachevée (la vue en signale d'autres manques : seules les deux règles de R236 sont regardées), avec ses sorts et ses choix. */
function fiche(id, { innee, acquise = null, sorts = [], choix = {} }) {
  inserer('personnage', {
    id, nature: 'joueur', proprietaire_id: 'r236', visibilite: 'privee', nom: id, race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central',
    magie_innee_id: innee, magie_acquise_id: acquise, mode_classe: 'mono', xp: 0, alignement_loyal: 0, alignement_chaotique: 0, alignement_bon: 0,
    alignement_mauvais: 0, bourse_pp: 0, bourse_ro: 0, bourse_rf: 0, ambidextrie: 0, cree_le: INSTANT, modifie_le: INSTANT,
  });
  sorts.forEach((sort_id, i) => inserer('personnage_sort', { personnage_id: id, sort_id, rang: i + 1, niveau_maitrise: 0 }));
  for (const [magie_id, specialisation_id] of Object.entries(choix)) inserer('personnage_specialisation_magie', { personnage_id: id, magie_id, specialisation_id });
  return id;
}
const signale = (id) => tous(`SELECT regle, detail FROM v_personnage_controle WHERE personnage_id = ? AND regle IN (${REGLES.map(() => '?').join(', ')}) ORDER BY regle, detail`, id, ...REGLES);

test('R236 (3) : le bi-magie voit signalé un sort de la spécialisation non choisie, ou d’une magie sans choix ; jamais un sort commun ni de la branche choisie', () => {
  assert.ok(A && B && C, 'trois magies à spécialisations');
  const [a1, a2, b1] = [specialisation(A, 1), specialisation(A, 2), specialisation(B, 1)];
  const sorts = { commun: sortDe(A, null), a1: sortDe(A, a1), a2: sortDe(A, a2), b1: sortDe(B, b1) };
  const id = fiche('r236-bi', { innee: A, acquise: B, sorts: Object.values(sorts), choix: { [A]: a1 } });
  assert.deepEqual(signale(id), [
    { regle: 'sort_hors_specialisation', detail: sorts.a2 },
    { regle: 'sort_hors_specialisation', detail: sorts.b1 },
  ].sort((x, y) => (x.detail < y.detail ? -1 : 1)));

  // R236 (6) : le choix se change (pas de verrou) ; la branche quittée devient signalée, la nouvelle ne l'est plus
  db.prepare('UPDATE personnage_specialisation_magie SET specialisation_id = ? WHERE personnage_id = ? AND magie_id = ?').run(a2, id, A);
  inserer('personnage_specialisation_magie', { personnage_id: id, magie_id: B, specialisation_id: b1 });
  assert.deepEqual(signale(id), [{ regle: 'sort_hors_specialisation', detail: sorts.a1 }]);
});

test('R236 (2), (7) : ni le mono-magie ni le Potentiel Illimité ne sont signalés, même avec une ligne de choix', () => {
  const [a1, a2, c1] = [specialisation(A, 1), specialisation(A, 2), specialisation(C, 1)];
  const mono = fiche('r236-mono', { innee: A, sorts: [sortDe(A, a1), sortDe(A, a2)], choix: { [A]: a1, [C]: c1 } });
  assert.deepEqual(signale(mono), []);
  const pi = fiche('r236-pi', { innee: POTENTIEL_ILLIMITE, sorts: [sortDe(A, a1), sortDe(A, a2), sortDe(C, c1)], choix: { [C]: c1 } });
  assert.deepEqual(signale(pi), []);
});

test('specialisation_hors_magie : une spécialisation choisie pour une magie qui n’est ni l’innée ni l’acquise du bi-magie est signalée', () => {
  const c1 = specialisation(C, 1);
  const id = fiche('r236-hors', { innee: A, acquise: B, choix: { [A]: specialisation(A, 1), [C]: c1 } });
  assert.deepEqual(signale(id), [{ regle: 'specialisation_hors_magie', detail: c1 }]);
});

test('personnage_specialisation_magie : une spécialisation de CETTE magie (clé composée), une par magie, effacée avec la fiche', () => {
  const id = fiche('r236-cles', { innee: A, acquise: B });
  assert.throws(() => inserer('personnage_specialisation_magie', { personnage_id: id, magie_id: A, specialisation_id: specialisation(B, 1) }), /FOREIGN KEY/);
  inserer('personnage_specialisation_magie', { personnage_id: id, magie_id: A, specialisation_id: specialisation(A, 1) });
  assert.throws(() => inserer('personnage_specialisation_magie', { personnage_id: id, magie_id: A, specialisation_id: specialisation(A, 2) }), /UNIQUE|PRIMARY KEY/);
  assert.throws(() => inserer('personnage_specialisation_magie', { personnage_id: id, magie_id: POTENTIEL_ILLIMITE, specialisation_id: specialisation(A, 1) }), /FOREIGN KEY/);
  db.prepare('DELETE FROM personnage WHERE id = ?').run(id);
  assert.equal(un('SELECT count(*) AS n FROM personnage_specialisation_magie WHERE personnage_id = ?', id).n, 0);
});

test('data/rows garde la table vide (section 13 : les fiches vivent dans la base du serveur)', () => {
  const lignes = readFileSync(new URL('../../data/rows/personnage_specialisation_magie.sql', import.meta.url), 'utf8').trim().split('\n');
  assert.equal(lignes.length, 1, 'en-tête seul');
});

after(() => db.close());
