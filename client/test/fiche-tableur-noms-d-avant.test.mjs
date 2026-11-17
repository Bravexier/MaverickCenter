// Une fiche en tableur écrite avant un renommage sur le site de dev reste lisible (lot « Défauts du code », point 6) : l'import
// (lib/fiche-tableur-import.mjs#ficheDuClasseur) retrouve un don ou un sort par son nom actuel, sinon par l'id (le nom d'origine), sinon par un nom qu'il a
// porté avant (`noms_d_avant` des règles de la fiche, lib/fiche-regles.mjs, lus dans l'historique : lib/historique-site.mjs#valeursDAvant). Le scénario
// renomme deux fois, sur une base vivante d'essai, par le service d'édition (le journal en attente, comme sur le site de dev) : la fiche est écrite sous
// le second nom, que ni le nom actuel ni l'id ne portent.
//   node --test test/fiche-tableur-noms-d-avant.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrer } from '../serveur/edition.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { modeleXlsx } from '../src/lib/fiche-modele.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { cellulesDeLaFiche } from '../src/lib/fiche-tableur-export.mjs';
import { ficheDuClasseur, libellesSousLesNomsDAvant } from '../src/lib/fiche-tableur-import.mjs';
import { valeursDAvant } from '../src/lib/historique-site.mjs';
import { ecrireXlsx } from '../src/lib/tableur-ecriture.mjs';
import { lireClasseur } from '../src/lib/tableur-lecture.mjs';
import { cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

// ------------------------------------------------------------------ le scénario : une base vivante d'essai, deux renommages par le service

const racine = dossierTemporaire('fiche-noms-d-avant');
const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: racine }).chemin);
after(() => db.close());
const PID = process.pid;
const DATE = '07/11/2026';
const MODELE = await modeleXlsx();
const reglesDe = () => JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit

// Mage Rouge Rubis de niveau 10 (patron : test/fiche-tableur-aller-retour.test.mjs) : un don à choix (« Charge lente… »), six sorts du Feu dont
// Boule de feu, préparée (R115) et offerte par un livre (R169) ; tout par id (figé)
const BOULE = 'magies/magie-du-feu#sort:boule-de-feu';
const CHARGE = 'capacites/mage-rouge-charge-lente';
const regles0 = reglesDe();
const fiche = (() => {
  const f = {
    ...ficheVide('Ignis'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-toundra', magie_innee_id: 'magies/magie-du-feu',
    xp: regles0.niveaux.find((l) => l.niveau === 10).xp_min,
    classes: [{ rang: 1, classe_id: 'classes/mage-rouge', specialite_id: 'classes/mage-rouge#specialite:mage-rubis' }],
    caracteristiques: regles0.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    capacites: [{ capacite_id: CHARGE }],
    livres_sorts: [{ sort_id: BOULE, rang: 1 }],
  };
  f.sorts = M.sortsPossibles(regles0, f).filter((s) => s.magie_id === 'magies/magie-du-feu').slice(0, 6).map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: 0 }));
  f.sorts = f.sorts.map((s) => (s.sort_id === BOULE ? { ...s, prepare: 1, prepare_jet: 57, prepare_posture_id: 'guide/postures#posture:offensif' } : s));
  return f;
})();

/** Le classeur que la page écrit pour la fiche (règles `exporter`), relu et importé (règles `importer`). */
async function allerRetour(exporter, importer) {
  const sortie = cellulesDeLaFiche(exporter, fiche, { date: DATE });
  const octets = await ecrireXlsx(MODELE, { cellules: sortie.cellules, remplis: sortie.remplis, alignements: sortie.alignements, descriptionImage: 'logo', titre: fiche.nom });
  const classeur = await lireClasseur(octets, { nom: 'essai.xlsx' });
  return ficheDuClasseur(importer, classeur.feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE });
}
const renommer = (sort, don) => enregistrer(db, { page: 'magies/magie-du-feu/', operations: [
  { op: 'modifier', table: 'sort', cle: { id: BOULE }, valeurs: { nom: sort } },
  { op: 'modifier', table: 'capacite', cle: { id: CHARGE }, valeurs: { nom: don } },
] });
const ce = (r) => ({ sorts: r.fiche.sorts, capacites: r.fiche.capacites, livres_sorts: r.fiche.livres_sorts, nonRepris: r.nonRepris });

test('renommés deux fois sur le site de dev, le sort et le don d’une fiche écrite sous leur nom intermédiaire se retrouvent par leur nom d’avant', async () => {
  assert.ok(M.trouver(regles0.sorts, BOULE) && M.trouver(M.trouver(regles0.classes, 'classes/mage-rouge').dons, CHARGE), 'le sort et le don existent');
  const temoin = await allerRetour(regles0, regles0);
  assert.ok(temoin.fiche.sorts.some((s) => s.sort_id === BOULE && s.prepare === 1), 'le sort préparé, relu');
  assert.ok(temoin.fiche.capacites.some((c) => c.capacite_id === CHARGE), 'le don à choix, relu');
  assert.ok(temoin.fiche.livres_sorts.some((l) => l.sort_id === BOULE), 'le livre, relu');
  // premier renommage : la fiche est écrite sous ce nom ; second : le classeur n'écrit ni le nom actuel ni celui de l'id
  renommer(`Boule intermédiaire ${PID}`, `Charge intermédiaire ${PID}`);
  const regles1 = reglesDe();
  renommer(`Boule actuelle ${PID}`, `Charge actuelle ${PID}`);
  const regles2 = reglesDe();
  const sort2 = M.trouver(regles2.sorts, BOULE);
  const don2 = M.trouver(M.trouver(regles2.classes, 'classes/mage-rouge').dons, CHARGE);
  assert.deepEqual(sort2.noms_d_avant, [M.trouver(regles0.sorts, BOULE).nom, `Boule intermédiaire ${PID}`], 'l’import d’abord, puis le nom intermédiaire');
  assert.ok(don2.noms_d_avant.includes(`Charge intermédiaire ${PID}`));
  assert.equal(M.trouver(regles0.sorts, BOULE).noms_d_avant, undefined, 'un sort jamais renommé n’a pas de noms d’avant');
  // la fiche écrite sous les noms intermédiaires, relue avec les règles d'aujourd'hui : la même que le témoin
  assert.deepEqual(ce(await allerRetour(regles1, regles2)), ce(temoin));
  // sans les noms d'avant, le sort et le don étaient perdus (l'id porte le nom d'origine, pas l'intermédiaire)
  const sans = structuredClone(regles2);
  for (const x of [...sans.sorts, ...sans.classes.flatMap((c) => c.dons)]) delete x.noms_d_avant;
  const perdu = await allerRetour(regles1, sans);
  assert.ok(!perdu.fiche.sorts.some((s) => s.sort_id === BOULE) && !perdu.fiche.capacites.some((c) => c.capacite_id === CHARGE), 'perdus sans les noms d’avant');
});

test('le nom actuel passe avant un nom d’avant : un autre sort qui prend l’ancien nom est celui que le classeur désigne', async () => {
  const regles = reglesDe();
  const autre = M.trouver(regles.sorts, fiche.sorts.find((s) => s.sort_id !== BOULE).sort_id);
  const ancien = M.trouver(regles.sorts, BOULE).noms_d_avant.at(-1);
  const copie = structuredClone(regles);
  M.trouver(copie.sorts, autre.id).nom = ancien;
  const f = { ...fiche, sorts: [{ sort_id: BOULE, rang: 1, niveau_maitrise: 0 }], livres_sorts: [] };
  const sortie = cellulesDeLaFiche({ ...regles, sorts: regles.sorts.map((s) => (s.id === BOULE ? { ...s, nom: ancien } : s)) }, f, { date: DATE });
  const octets = await ecrireXlsx(MODELE, { cellules: sortie.cellules, remplis: sortie.remplis, alignements: sortie.alignements, descriptionImage: 'logo', titre: f.nom });
  const r = ficheDuClasseur(copie, (await lireClasseur(octets, { nom: 'essai.xlsx' })).feuille('Personnage'), { nomFichier: 'essai.xlsx', date: DATE });
  assert.deepEqual(r.fiche.sorts.map((s) => s.sort_id), [autre.id]);
});

test('valeursDAvant : les noms portés avant l’actuel, dans l’ordre, de l’historique puis du journal en attente ; ni l’actuel, ni null, ni doublon', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE sort (id TEXT PRIMARY KEY, nom TEXT);
    CREATE TABLE historique_modification (lot_id TEXT, rang INTEGER, fait_le TEXT, resume TEXT, version TEXT, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT);
    CREATE TABLE modification_lot (id TEXT PRIMARY KEY, fait_le TEXT);
    CREATE TABLE modification (lot_id TEXT, rang INTEGER, table_nom TEXT, cle TEXT, operation TEXT, avant TEXT, apres TEXT, etat TEXT);`);
  const h = db.prepare('INSERT INTO historique_modification VALUES (?, 1, ?, \'r\', NULL, ?, ?, ?, ?, ?)');
  const cle = (id) => JSON.stringify({ id });
  h.run('l1', '2026-01-01T00:00:00Z', 'sort', cle('a'), 'modifier', JSON.stringify({ nom: 'A0' }), JSON.stringify({ nom: 'A1' }));
  h.run('l2', '2026-01-02T00:00:00Z', 'sort', cle('a'), 'modifier', JSON.stringify({ nom: 'A1', effets: 'x' }), JSON.stringify({ nom: 'A0', effets: 'y' }));
  h.run('l3', '2026-01-03T00:00:00Z', 'sort', cle('b'), 'modifier', JSON.stringify({ effets: 'x' }), JSON.stringify({ effets: 'y' }));
  h.run('l4', '2026-01-04T00:00:00Z', 'sort', cle('c'), 'inserer', null, JSON.stringify({ id: 'c', nom: 'C0' }));
  h.run('l5', '2026-01-05T00:00:00Z', 'autre', cle('a'), 'modifier', JSON.stringify({ nom: 'Z' }), JSON.stringify({ nom: 'Y' }));
  db.prepare('INSERT INTO modification_lot VALUES (?, ?)').run('j1', '2026-02-01T00:00:00Z');
  db.prepare('INSERT INTO modification_lot VALUES (?, ?)').run('j2', '2026-02-02T00:00:00Z');
  const j = db.prepare('INSERT INTO modification VALUES (?, 1, \'sort\', ?, \'modifier\', ?, ?, ?)');
  j.run('j1', cle('a'), JSON.stringify({ nom: 'A0' }), JSON.stringify({ nom: 'A2' }), 'en_attente');
  j.run('j2', cle('c'), JSON.stringify({ nom: 'C0' }), JSON.stringify({ nom: 'C9' }), 'conflit'); // pas appliquée : ne compte pas
  assert.deepEqual([...valeursDAvant(db, 'sort', 'nom')], [[cle('a'), ['A0', 'A1']]]);
});

test('libellesSousLesNomsDAvant : le nom actuel remplacé mot pour mot par chaque nom d’avant, « $ » compris ; rien sans nom d’avant ni nom dans le libellé', () => {
  const don = { nom: 'Charge lente', noms_d_avant: ['Charge $& lente', "Charge $' et $1", 'Charge $$'] };
  assert.deepEqual(libellesSousLesNomsDAvant('Charge lente (Mage Rouge)', don), ['Charge $& lente (Mage Rouge)', "Charge $' et $1 (Mage Rouge)", 'Charge $$ (Mage Rouge)']);
  assert.deepEqual(libellesSousLesNomsDAvant('Autre libellé', don), []);
  assert.deepEqual(libellesSousLesNomsDAvant('Charge lente', { nom: 'Charge lente' }), []);
  assert.deepEqual(libellesSousLesNomsDAvant('Charge lente', undefined), []);
});
