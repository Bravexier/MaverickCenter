// Spécialisations magiques (Magie V10, R236 (1), migration 0117) côté service et lecture : ce que la page d'une magie reçoit (`chargerMagies` : chaque magie
// ses deux spécialisations, chaque sort la sienne), le contrôle `db:check` dans l'autre sens que le CHECK du schéma (un sort de NPM 3 à 5 a une
// spécialisation), le retrait des fiches (R42) des sorts supprimés par la mise à jour de Décembre (R237 (2)), la note de version (R29) des spécialisations
// modifiées, et la fin du tableau « Amélioration cadavérique » (R237 (7), décision G1). Aucun nom ni texte figé : les noms se lisent dans la base par
// identifiant, les effectifs de l'import dans le registre de la migration.
//   node --test test/magies-specialisations.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { retirerLesManquants } from '../serveur/fiches-retraits.mjs';
import * as bestiaire from '../src/lib/bestiaire-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { chargerMagies } from '../src/lib/magies-db.mjs';
import { blocsDeTexte } from '../src/lib/sort-format.mjs';
import { comparerBases } from '../src/lib/notes-de-version.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire, fichierTemporaire } from './aide-dossier-temporaire.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const REGISTRE = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/migrations/0117-magies-v10-specialisations.json', import.meta.url)), 'utf8'));
const db = ouvrirBase({ sansExemples: false });
const modele = chargerMagies(db);
const specialisations = db.prepare('SELECT * FROM magie_specialisation ORDER BY magie_id, ordre').all();

// --- Lecture : ce que la page d'une magie reçoit ------------------------------------------------------------------------------------------------

test('chargerMagies : chaque magie sauf le Potentiel Illimité expose ses deux spécialisations (ordre 1 puis 2, nom tel quel, textes en blocs), le Potentiel Illimité aucune', () => {
  assert.ok(modele.magies.size > 1);
  for (const [id, magie] of modele.magies) {
    const siennes = specialisations.filter((s) => s.magie_id === id);
    assert.equal(magie.specialisations.length, id === POTENTIEL_ILLIMITE ? 0 : 2, id);
    assert.deepEqual(magie.specialisations.map((s) => s.id), siennes.map((s) => s.id), `${id} : dans l'ordre de la table`);
    assert.deepEqual(magie.specialisations.map((s) => s.ordre), id === POTENTIEL_ILLIMITE ? [] : [1, 2], id);
    for (const [i, sp] of magie.specialisations.entries()) {
      const ligne = siennes[i];
      assert.equal(sp.nom, ligne.nom, `${sp.id} : le nom tel que la base l'écrit`);
      assert.equal(sp.cle, ligne.nom_cle);
      assert.deepEqual(sp.description, blocsDeTexte(ligne.description));
      assert.deepEqual(sp.remarque, blocsDeTexte(ligne.remarque));
      assert.equal(sp.descriptionBrute, ligne.description);
      assert.equal(sp.remarqueBrute, ligne.remarque);
    }
  }
  // l'effectif de l'import : 28 (le registre de la 0117), que le site de dev ne change pas (ni création ni suppression)
  assert.equal(specialisations.length, Object.keys(REGISTRE.specialisations).length);
});

test('chargerMagies : un sort de NPM 1 ou 2 est commun (specialisationId nul), un sort de NPM 3 à 5 porte une spécialisation de sa magie', () => {
  let rattaches = 0;
  for (const sort of modele.sorts.values()) {
    const magie = modele.magies.get(sort.magieId);
    assert.equal(sort.specialisationId, db.prepare('SELECT specialisation_id FROM sort WHERE id = ?').get(sort.id).specialisation_id, sort.id);
    if (sort.niveau <= 2) {
      assert.equal(sort.specialisationId, null, `${sort.id} : commun`);
    } else {
      assert.ok(magie.specialisations.some((s) => s.id === sort.specialisationId), `${sort.id} : une spécialisation de ${sort.magieId}`);
      rattaches += 1;
    }
  }
  assert.ok(rattaches > 0);
  // les sorts d'une magie restent dans l'ordre NPM puis ordre : les deux spécialisations se suivent dans chaque NPM
  for (const magie of modele.magies.values()) {
    const ordres = magie.sorts.map((s) => [s.niveau, s.ordre]);
    assert.deepEqual([...ordres].sort((a, b) => a[0] - b[0] || a[1] - b[1]), ordres, magie.id);
  }
});

test('R237 (7) et G1 : plus de tableau « Amélioration cadavérique » dans les données de la page (ni sur la magie, ni sur le sort, ni dans une invocation), ni dans le bestiaire', () => {
  for (const magie of modele.magies.values()) assert.equal('ameliorations' in magie, false, magie.id);
  for (const sort of modele.sorts.values()) {
    assert.equal('ameliorations' in sort, false, sort.id);
    for (const invocation of sort.invoque) assert.equal('tableau' in invocation, false, invocation.id);
  }
  assert.equal(bestiaire.tableauxDesSorts, undefined);
});

// --- db:check : l'autre sens de la règle ---------------------------------------------------------------------------------------------------------

/** Une copie de la base d'import où écrire (clés étrangères actives), et son contrôle `db:check` : les problèmes qui parlent des spécialisations (R236). */
function copieEtControle(t, modifier = () => {}) {
  const chemin = fichierTemporaire('maverick.db', 'specialisations-check', { t });
  copyFileSync(cheminDImport(), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  try { modifier(base); } finally { base.close(); }
  const r = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', 'db-check.mjs'), chemin], { cwd: CLIENT, encoding: 'utf8' });
  const sortie = JSON.parse(r.stdout);
  return { ...sortie, specialisations: sortie.problemes.filter((p) => p.includes('R236')) };
}

test('db:check : la base d’import est conforme (chaque sort de NPM 3 à 5 a sa spécialisation, chaque magie ses deux spécialisations, le Potentiel Illimité aucune)', (t) => {
  const r = copieEtControle(t);
  assert.deepEqual(r.specialisations, []);
  assert.equal(r.bilan.specialisations, specialisations.length);
});

test('db:check : un sort de NPM 3 à 5 sans spécialisation est signalé (le CHECK du schéma ne dit que l’autre sens) ; une magie qui n’a qu’une spécialisation aussi', (t) => {
  let sort = null;
  let magie = null;
  const r = copieEtControle(t, (base) => {
    sort = base.prepare('SELECT id, niveau FROM sort WHERE specialisation_id IS NOT NULL ORDER BY id LIMIT 1').get();
    base.prepare('UPDATE sort SET specialisation_id = NULL WHERE id = ?').run(sort.id);
    // une spécialisation et ses sorts retirés : la magie n'en a plus qu'une
    const sp = base.prepare('SELECT id, magie_id FROM magie_specialisation WHERE ordre = 2 ORDER BY id LIMIT 1').get();
    magie = sp.magie_id;
    base.prepare('UPDATE sort SET specialisation_id = NULL WHERE specialisation_id = ?').run(sp.id);
    base.prepare('DELETE FROM magie_specialisation WHERE id = ?').run(sp.id);
  });
  assert.equal(r.ok, false);
  assert.ok(r.specialisations.some((p) => p.includes(`sort ${sort.id}`) && p.includes(`NPM ${sort.niveau} a une spécialisation`)), JSON.stringify(r.specialisations));
  assert.ok(r.specialisations.some((p) => p.includes(`magie ${magie} : 1 spécialisation(s) au lieu de 2`)), JSON.stringify(r.specialisations));
});

test('db:check : le Potentiel Illimité n’a pas de spécialisation (une ligne posée par SQL est signalée) ; le schéma garde le sens du CHECK (NPM 1 ou 2, ou autre magie : refusé)', (t) => {
  const r = copieEtControle(t, (base) => {
    base.prepare("INSERT INTO magie_specialisation (id, magie_id, ordre, nom, nom_cle, origine, source_ref) VALUES (?, ?, 1, 'X', 'x', 'magies', 's')")
      .run(`${POTENTIEL_ILLIMITE}#specialisation:x`, POTENTIEL_ILLIMITE);
  });
  assert.equal(r.ok, false);
  assert.ok(r.specialisations.some((p) => p.includes(`magie ${POTENTIEL_ILLIMITE} : 1 spécialisation(s) au lieu de 0`)), JSON.stringify(r.specialisations));

  const chemin = fichierTemporaire('maverick.db', 'specialisations-check-schema', { t });
  copyFileSync(cheminDImport(), chemin);
  const base = new DatabaseSync(chemin);
  base.exec('PRAGMA foreign_keys = ON');
  t.after(() => base.close());
  const commun = base.prepare('SELECT s.id, p.id AS specialisation FROM sort s JOIN magie_specialisation p ON p.magie_id = s.magie_id WHERE s.niveau <= 2 ORDER BY s.id LIMIT 1').get();
  assert.throws(() => base.prepare('UPDATE sort SET specialisation_id = ? WHERE id = ?').run(commun.specialisation, commun.id), /CHECK/);
  const autreMagie = base.prepare('SELECT s.id, p.id AS specialisation FROM sort s JOIN magie_specialisation p ON p.magie_id <> s.magie_id WHERE s.niveau >= 3 ORDER BY s.id LIMIT 1').get();
  assert.throws(() => base.prepare('UPDATE sort SET specialisation_id = ? WHERE id = ?').run(autreMagie.specialisation, autreMagie.id), /CHECK/);
});

// --- R42 : les sorts supprimés partent des fiches, sans liste -----------------------------------------------------------------------------------

test('R42 : les sorts que la mise à jour de Décembre supprime (registre de la 0117) sont retirés des fiches à la reconstruction de la base vivante, une note chacun, sans liste dans le code', (t) => {
  const supprimes = REGISTRE.sorts.supprimes;
  assert.ok(supprimes.length > 0);
  for (const id of supprimes) assert.equal(db.prepare('SELECT count(*) AS n FROM sort WHERE id = ?').get(id).n, 0, `${id} n'existe plus`);
  assert.equal(/magies\/[a-z-]+#sort:/.test(readFileSync(fileURLToPath(new URL('../serveur/fiches-retraits.mjs', import.meta.url)), 'utf8')), false, 'aucun identifiant de sort écrit dans le code');

  const dossier = dossierTemporaire('specialisations-retraits', { t });
  const base = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(dossier, 'vivante') }).chemin);
  t.after(() => base.close());
  // une fiche qui a des sorts réels, puis chacun repointé vers un sort supprimé (clés étrangères coupées, comme à la reconstruction)
  const reels = base.prepare('SELECT id FROM sort WHERE niveau <= 2 ORDER BY id LIMIT ?').all(supprimes.length).map((s) => s.id);
  assert.equal(reels.length, supprimes.length);
  const cree = traiter({ methode: 'POST', chemin: '/api/personnages/', entetes: { 'content-type': 'application/json' },
    corps: JSON.stringify({ ...ficheVide(`Témoin ${process.pid}`), magie_innee_id: POTENTIEL_ILLIMITE, sorts: reels.map((id, i) => ({ sort_id: id, rang: i + 1, niveau_maitrise: 0 })) }) },
  { base: () => base, etat: () => ({}), edition: true });
  assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
  const fiche = cree.corps.personnage.id;
  base.exec('PRAGMA foreign_keys = OFF');
  reels.forEach((id, i) => base.prepare('UPDATE personnage_sort SET sort_id = ? WHERE personnage_id = ? AND sort_id = ?').run(supprimes[i], fiche, id));
  // l'ancienne base : les règles d'avant, qui ont encore ces sorts (une copie où chacun est recréé sous son identifiant, d'une magie qui existe)
  const ancienne = fichierTemporaire('ancienne.db', 'specialisations-retraits', { t });
  copyFileSync(cheminDImport(), ancienne);
  const avant = new DatabaseSync(ancienne);
  avant.exec('PRAGMA foreign_keys = OFF');
  const colonnes = avant.prepare('PRAGMA table_info(sort)').all().map((c) => c.name);
  supprimes.forEach((id, i) => {
    const modele0 = avant.prepare('SELECT * FROM sort WHERE magie_id = ? ORDER BY id LIMIT 1').get(id.slice(0, id.indexOf('#')));
    const ligne = { ...modele0, id, nom: `Ancien sort ${i}`, nom_cle: `ancien-sort-${i}`, ordre: 900 + i, niveau: 1, specialisation_id: null };
    avant.prepare(`INSERT INTO sort (${colonnes.map((c) => `"${c}"`).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...colonnes.map((c) => ligne[c]));
  });
  avant.close();
  base.prepare('ATTACH DATABASE ? AS ancienne').run(ancienne);
  const acc = retirerLesManquants(base);
  base.exec('DETACH DATABASE ancienne');
  const retraits = acc.get(fiche)?.retraits ?? [];
  assert.equal(retraits.filter((r) => r.nature === 'sort').length, supprimes.length, 'une note par sort supprimé');
  assert.deepEqual(retraits.filter((r) => r.nature === 'sort').map((r) => r.id).sort(), [...supprimes].sort());
  assert.equal(base.prepare('SELECT count(*) AS n FROM personnage_sort WHERE personnage_id = ?').get(fiche).n, 0, 'plus aucun sort supprimé sur la fiche');
});

// --- R29 : la note de version dit une spécialisation modifiée ------------------------------------------------------------------------------------

test('note de version (R29) : le nom, la description ou la remarque d’une spécialisation modifiée sur le site est listé sous sa magie, sans couleur ; un sort ajouté ou retiré est neutre', () => {
  const magie = { id: 'magies/feu', nom: 'Feu', ordre: 1, description: 'Brûle.' };
  const spec = (ordre, valeurs = {}) => ({ id: `magies/feu#specialisation:s${ordre}`, magie_id: magie.id, ordre, nom: `SPÉ ${ordre}`, nom_cle: `spe-${ordre}`, description: 'Une description.', remarque: null, ...valeurs });
  const sort = (id, valeurs = {}) => ({ id, magie_id: magie.id, nom: id, niveau: 3, ordre: 1, type_brut: 'Attaque', cout_brut: '6', portee_brut: '6', zone_brut: null, dsb_brut: '2D6',
    effets: null, remarque: null, texte_niveau5: null, specialisation_id: spec(1).id, ...valeurs });
  const ref = { tables: { magie: [magie], magie_specialisation: [spec(1), spec(2)], sort: [sort('sorts/a'), sort('sorts/b')] } };
  const dev = { tables: { magie: [magie], magie_specialisation: [spec(1, { nom: 'SPÉ RENOMMÉE', remarque: 'Nouvelle remarque.' }), spec(2)], sort: [sort('sorts/a'), sort('sorts/c')] } };
  const lignes = comparerBases(ref, dev);
  const deSpe = lignes.filter((l) => l.table_nom === 'magie_specialisation');
  assert.deepEqual(deSpe.map((l) => [l.domaine, l.groupe, l.nature, l.colonne]), [['magies', 'Feu', 'modifie', 'nom'], ['magies', 'Feu', 'ajoute', 'remarque']]);
  assert.ok(deSpe.every((l) => l.sens === 'neutre'));
  assert.deepEqual(lignes.filter((l) => l.table_nom === 'sort').map((l) => [l.nature, l.sens]), [['retire', 'neutre'], ['ajoute', 'neutre']]);
  // le rattachement d'un sort à sa spécialisation n'est pas une colonne que le site modifie : il ne fait pas de ligne
  const autre = { tables: { ...ref.tables, sort: [sort('sorts/a', { specialisation_id: spec(2).id }), sort('sorts/b')] } };
  assert.deepEqual(comparerBases(ref, autre), []);
});
