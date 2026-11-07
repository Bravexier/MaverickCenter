// Décision R207 (1), E6 (« D'après les matériaux (+ cout de fabrication pour le prix) », réponse du propriétaire, 2026-11-07) : le type, l'AP, l'AM et le
// prix d'une armure de la grille, l'AP, l'AM et le prix d'un bouclier se calculent d'après leurs matériaux, plus le coût de fabrication pour le prix
// (« Armure Complète », R93 ; le prix de la forme pour un bouclier, choix de game-design). Les formules : lib/armure-forge.mjs ; leurs entrées lues dans la
// base : lib/armures-db.mjs#valeursCalculees ; le service les garde à jour (test/serveur-edition-armures.test.mjs, « R207 »).
// Les matériaux, les coûts de fabrication et les prix des formes se modifient sur le site de dev : aucun nombre n'est écrit ici. Chaque formule est
// refaite en SQL, à part du code, sur toute la base courante ; seuls les essais des fonctions pures prennent des nombres posés ici, sans lien aux règles.
// La constante des 6 unités (constante_equipement), que ni lib/edition-modele.mjs ni le service n'écrivent, se lit en base.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { coutParClasseDuBouclier, defenseExacte, nombreEcrit } from '../src/lib/armure-champs.mjs';
import {
  defenseDeLaCombinaison, defenseDuBouclier, prixDeLArmure, prixDuBouclier, TYPES_DES_MATERIAUX, typeDeLaCombinaison,
} from '../src/lib/armure-forge.mjs';
import { chargerArmures, ecartsDeFabricationDuBouclier, valeursCalculees } from '../src/lib/armures-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const calculees = valeursCalculees(db);
const ro = db.prepare("SELECT valeur_rf FROM monnaie WHERE id = 'ro'").get().valeur_rf;
const toutes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const combinaisons = () => toutes("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre");

test('R207 (1) : les fonctions pures — type le plus lourd, somme des AP et AM (une somme nulle n’est pas écrite), classe × matière, prix de bouclier', () => {
  // le type : l'ordre de materiau_armure.type (son CHECK), du plus léger au plus lourd
  const ordre = /type\s+TEXT\s+NOT NULL CHECK \(type IN \(([^)]*)\)\)/.exec(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'materiau_armure'").get().sql)[1];
  assert.deepEqual(ordre.split(',').map((t) => t.trim().slice(1, -1)), [...TYPES_DES_MATERIAUX]);
  for (const [i, a] of TYPES_DES_MATERIAUX.entries()) {
    for (const [j, b] of TYPES_DES_MATERIAUX.entries()) assert.equal(typeDeLaCombinaison(a, b), TYPES_DES_MATERIAUX[Math.max(i, j)], `${a}/${b}`);
  }
  assert.equal(typeDeLaCombinaison('Autres', TYPES_DES_MATERIAUX[0]), null, 'un type qui n’est pas d’armure : rien n’est déduit');
  assert.deepEqual(defenseDeLaCombinaison({ ap: 2, am: null }, { ap: 3, am: 4 }), { ap: 5, am: 4 });
  assert.deepEqual(defenseDeLaCombinaison({ ap: null, am: null }, { ap: 0, am: null }), { ap: null, am: null });
  assert.deepEqual(defenseDuBouclier(3, { ap: 2, am: null }), { ap: 6, am: null });
  assert.equal(prixDuBouclier(3, 1.5, 7.5), 12);
  assert.equal(prixDuBouclier(3, null, 7.5), null);
  assert.equal(prixDeLArmure(10, [1, 2], 4).achetes, 22, 'les unités sont un paramètre (la constante de la base)');
});

test('R207 (1) : le type d’une armure de la grille est le plus lourd de ses deux matériaux (refait en SQL)', () => {
  const rang = TYPES_DES_MATERIAUX.map((t, i) => `WHEN '${t}' THEN ${i}`).join(' ');
  const attendus = toutes(`SELECT a.id, CASE WHEN (CASE m1.type ${rang} END) >= (CASE m2.type ${rang} END) THEN m1.type ELSE m2.type END AS type
    FROM armure a JOIN materiau_armure m1 ON m1.ressource_id = a.materiau_ligne_id JOIN materiau_armure m2 ON m2.ressource_id = a.materiau_colonne_id
    WHERE a.sorte = 'combinaison'`);
  assert.equal(attendus.length, calculees.armures.size);
  for (const a of attendus) assert.equal(calculees.armures.get(a.id).type, a.type, a.id);
});

test('R207 (1), R75 : l’AP et l’AM d’une armure de la grille sont la somme de ceux de ses deux matériaux (refait en SQL)', () => {
  const attendus = toutes(`SELECT a.id, NULLIF(coalesce(m1.ap, 0) + coalesce(m2.ap, 0), 0) AS ap, NULLIF(coalesce(m1.am, 0) + coalesce(m2.am, 0), 0) AS am
    FROM armure a JOIN materiau_armure m1 ON m1.ressource_id = a.materiau_ligne_id JOIN materiau_armure m2 ON m2.ressource_id = a.materiau_colonne_id
    WHERE a.sorte = 'combinaison'`);
  for (const a of attendus) {
    const c = calculees.armures.get(a.id);
    assert.deepEqual([c.ap, c.am], [a.ap, a.am], a.id);
  }
});

test('R207 (1), R93 : le prix d’une armure de la grille est « Armure Complète » + les unités de chaque matériau (constante) à leur prix (refait en SQL)', () => {
  const attendus = toutes(`SELECT a.id, round((f.cout_rf + u.valeur * (r1.prix_rf + r2.prix_rf)) * 1.0 / ?, 2) AS prix
    FROM armure a JOIN ressource r1 ON r1.id = a.materiau_ligne_id JOIN ressource r2 ON r2.id = a.materiau_colonne_id
    JOIN armure_emplacement f ON f.id = 'armure-complete' JOIN constante_equipement u ON u.id = 'armure.unites_par_materiau'
    WHERE a.sorte = 'combinaison'`, ro);
  assert.equal(attendus.length, calculees.armures.size);
  for (const a of attendus) assert.equal(calculees.armures.get(a.id).prix, a.prix, a.id);
});

test('R207 (1) : l’AP, l’AM et le prix d’un bouclier — classe × ceux de sa matière ; classe × prix de la matière + prix de la forme (refait en SQL)', () => {
  const attendus = toutes(`SELECT b.id, c.classe * m.ap AS ap, c.classe * m.am AS am, round(c.classe * r.prix_rf * 1.0 / ? + c.prix, 2) AS prix
    FROM bouclier b JOIN bouclier_classe c ON c.id = b.classe_id JOIN materiau_bouclier m ON m.ressource_id = b.materiau_id
    JOIN ressource r ON r.id = b.materiau_id`, ro);
  assert.equal(attendus.length, calculees.boucliers.size);
  for (const b of attendus) assert.deepEqual({ ...calculees.boucliers.get(b.id) }, { ap: b.ap, am: b.am, prix: b.prix }, b.id);
});

test('R207 (1), E6 sur la base courante : toute la grille et tous les boucliers valent la formule ; défense et prix écrits s’y lisent ; la page lit le même prix', () => {
  const grille = combinaisons();
  assert.equal(grille.length, calculees.armures.size);
  for (const a of grille) {
    const c = calculees.armures.get(a.id);
    assert.deepEqual([a.type, a.ap, a.am, a.prix], [c.type, c.ap, c.am, c.prix], a.id);
    assert.equal(nombreEcrit(a.prix_brut), a.prix, `${a.id} : prix écrit`);
    assert.deepEqual(defenseExacte(a.stats_brut), { ap: a.ap, am: a.am }, `${a.id} : défense écrite`);
  }
  for (const b of toutes('SELECT * FROM bouclier')) {
    const c = calculees.boucliers.get(b.id);
    assert.deepEqual([b.ap, b.am, b.prix], [c.ap, c.am, c.prix], b.id);
    assert.equal(nombreEcrit(b.prix_brut), b.prix, `${b.id} : prix écrit`);
    assert.deepEqual(defenseExacte(b.defense_brut), { ap: b.ap, am: b.am }, `${b.id} : défense écrite`);
  }
  // la page : le prix calculé de chaque armure de la grille est celui de la base, et la constante des unités lui est donnée
  const page = chargerArmures(db);
  for (const a of page.combinaisons) assert.equal(a.prix_calcule, a.prix, a.id);
  assert.equal(page.unitesParMateriau, db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'armure.unites_par_materiau'").get().valeur);
});

/** Lance db:check sur une copie de la base modifiée par `modifier` : sa sortie JSON. */
function dbCheck(t, modifier) {
  const copie = join(dossierTemporaire('armures-e6', { t }), 'maverick.db');
  copyFileSync(cheminBase({ sansExemples: false }), copie);
  const base = new DatabaseSync(copie);
  modifier(base);
  base.close();
  const r = spawnSync(process.execPath, ['--no-warnings', fileURLToPath(new URL('../scripts/db-check.mjs', import.meta.url)), copie], { encoding: 'utf8' });
  return { statut: r.status, ...JSON.parse(r.stdout) };
}

test('R207 (1) : db:check avertit quand le prix d’une forme de bouclier ne vaut plus classe × « N RF / Classe » (une autre écriture du même coût)', (t) => {
  // les deux écritures se modifient à part sur le site de dev : le test pose dans sa copie un coût par classe et des prix de forme qui s'accordent
  // (ses nombres, pas ceux des règles), puis en écarte une forme
  const forme = db.prepare('SELECT * FROM bouclier_classe ORDER BY classe DESC LIMIT 1').get();
  const accord = (base) => {
    base.prepare("UPDATE armure_emplacement SET cout_brut = ? WHERE id = 'bouclier'").run(`${3 * ro} RF / Classe`);
    base.prepare('UPDATE bouclier_classe SET prix = classe * 3').run();
  };
  assert.equal(coutParClasseDuBouclier(`${3 * ro} RF / Classe`), 3 * ro);
  const sans = dbCheck(t, accord);
  assert.equal(sans.statut, 0, JSON.stringify(sans.problemes));
  assert.deepEqual(sans.avertissements, []);
  const ecart = dbCheck(t, (base) => {
    accord(base);
    base.prepare('UPDATE bouclier_classe SET prix = prix + 1 WHERE id = ?').run(forme.id);
  });
  assert.equal(ecart.statut, 0, 'un avertissement ne fait pas échouer db:check');
  assert.deepEqual(ecart.problemes, []);
  assert.equal(ecart.avertissements.length, 1, JSON.stringify(ecart.avertissements));
  assert.ok(ecart.avertissements[0].startsWith(`bouclier_classe ${forme.id} : `) && ecart.avertissements[0].includes('R207'), ecart.avertissements[0]);
  const illisible = dbCheck(t, (base) => base.prepare("UPDATE armure_emplacement SET cout_brut = 'à voir' WHERE id = 'bouclier'").run());
  assert.equal(illisible.statut, 0);
  assert.ok(illisible.avertissements.some((a) => a.startsWith('armure_emplacement bouclier : ')), JSON.stringify(illisible.avertissements));
  // la même lecture que db:check sur la base courante (sans en figer le résultat : les deux écritures s'y modifient à part)
  assert.ok(Array.isArray(ecartsDeFabricationDuBouclier(db)));
});
