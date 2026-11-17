// Décision R207 du propriétaire (2026-11-07), points (1) E6 et (3) tests de fabrication, appliqués à la base par les migrations
// data/migrations/0105-r207-armures-boucliers-et-fabrication, 0108-r207-prix-des-armures et 0109-r207-panneau-des-batons (registres .json). Lecture
// seule de la base construite.
//   - (1) E6 : le type, l'AP, l'AM et le prix des armures de la grille et des boucliers se calculent d'après les matériaux. Ces colonnes, les prix des
//     matériaux et les coûts de fabrication se modifient sur le site de dev, source de ce qu'il modifie : les formules se vérifient sur toute la grille
//     dans l'état des migrations (baseDImport({ garder: lotsAvant('0108') }), skill tests-conventions), leurs nombres lus dans la base (10 RO de
//     « Armure Complète », prix de chaque forme de bouclier par classe, constante des 6 unités), jamais écrits ici. Le terme de fabrication du
//     bouclier est bouclier_classe.prix (game-design, 2026-11-07 : RO par classe et par forme, R49, R79) ; « 250 RF / Classe » d'armure_emplacement
//     n'en est qu'une autre écriture, égale à l'import.
//   - (3) les 42 recettes de bâton magique en Perception + Volonté : recette n'est écrite ni par lib/edition-modele.mjs ni par le service, ses valeurs
//     se lisent telles quelles sur l'état courant ; les panneaux « Armes » et « Bâtons magiques » (0109) et les corps des pages se lisent dans l'état
//     de la migration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { colonnesDeLArmure, coutDeLaPiece } from '../src/lib/armure-champs.mjs';
import { chargerArmures } from '../src/lib/armures-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport, lotsAvant, texteDImport } from './aide-base-d-import.mjs';

const db = ouvrirBase({ sansExemples: false });
const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0105-r207-armures-boucliers-et-fabrication.json', import.meta.url), 'utf8'));
const registre0108 = JSON.parse(readFileSync(new URL('../../data/migrations/0108-r207-prix-des-armures.json', import.meta.url), 'utf8'));
const registre0109 = JSON.parse(readFileSync(new URL('../../data/migrations/0109-r207-panneau-des-batons.json', import.meta.url), 'utf8'));
const APRES = { garder: lotsAvant('0108') };
const apresLa0108 = () => baseDImport(APRES);
const POIDS = { Léger: 1, Intermédiaire: 2, Lourd: 3 };
const arrondi = (n) => Math.round(n * 100) / 100;
const somme = (a, b) => (a ?? 0) + (b ?? 0) || null;

/** Les nombres des formules E6, lus dans la base : fabrication de l'armure complète et du bouclier par classe (RO), unités de chaque matériau. */
function nombresDesFormules(base) {
  const piece = (id) => base.prepare('SELECT cout_brut FROM armure_emplacement WHERE id = ?').get(id).cout_brut;
  const parClasse = /(\d[\d\s  ]*)\s*RF\s*\/\s*Classe/i.exec(piece('bouclier'));
  assert.ok(parClasse, 'le coût de fabrication du bouclier s’écrit « N RF / Classe »');
  return {
    armure: coutDeLaPiece(piece('armure-complete')) / 100,
    bouclierParClasse: Number(parClasse[1].replace(/[\s  ]/g, '')) / 100,
    unites: base.prepare("SELECT valeur FROM constante_equipement WHERE id = 'armure.unites_par_materiau'").get().valeur,
  };
}

/** Les armures de la grille avec leurs valeurs calculées (E6). */
function grille(base) {
  const n = nombresDesFormules(base);
  const prix = (id) => base.prepare('SELECT prix_rf FROM ressource WHERE id = ?').get(id).prix_rf / 100;
  const mat = (id) => base.prepare('SELECT * FROM materiau_armure WHERE ressource_id = ?').get(id);
  return base.prepare("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre").all().map((a) => {
    const [m1, m2] = [mat(a.materiau_ligne_id), mat(a.materiau_colonne_id)];
    return {
      a,
      type: POIDS[m1.type] >= POIDS[m2.type] ? m1.type : m2.type,
      ap: somme(m1.ap, m2.ap),
      am: somme(m1.am, m2.am),
      prix: arrondi(n.armure + n.unites * (prix(a.materiau_ligne_id) + prix(a.materiau_colonne_id))),
    };
  });
}

/** Les boucliers avec leurs valeurs calculées (E6). */
function boucliers(base) {
  return base.prepare(`SELECT b.*, c.classe, c.prix AS prix_forme, m.ap AS m_ap, m.am AS m_am, r.prix_rf FROM bouclier b JOIN bouclier_classe c ON c.id = b.classe_id
    JOIN materiau_bouclier m ON m.ressource_id = b.materiau_id JOIN ressource r ON r.id = b.materiau_id ORDER BY b.id`).all().map((b) => ({
    b,
    ap: b.m_ap === null ? null : b.classe * b.m_ap,
    am: b.m_am === null ? null : b.classe * b.m_am,
    prix: arrondi(b.classe * (b.prix_rf / 100) + b.prix_forme),
  }));
}

test('R207 (1) E6 : les nombres des formules sont des données (10 RO, 2,5 RO par classe, 6 unités), la constante est celle de la page', () => {
  const n = nombresDesFormules(apresLa0108());
  assert.equal(n.armure, 10, '« Armure Complète » : 10 RO (R93)');
  assert.equal(n.bouclierParClasse, 2.5, '« Coût (RO) : 2,5 / Classe »');
  // constante_equipement n'est écrite ni par lib/edition-modele.mjs ni par le service : sa valeur se lit telle quelle (6 : R93) ; la page la reçoit de
  // la base (lib/armures-db.mjs#chargerArmures, `unitesParMateriau`), jamais du code
  const c = db.prepare("SELECT * FROM constante_equipement WHERE id = 'armure.unites_par_materiau'").get();
  assert.deepEqual([c.valeur, c.unite, c.page_id], [6, 'unites', 'ressources/armures']);
  assert.equal(chargerArmures(db).unitesParMateriau, c.valeur);
  assert.match(c.source_ref, /R93/);
  assert.match(c.source_ref, /R207/);
  // le coût du bouclier par classe est aussi le prix de chaque forme (« Prix : 2,5 » … « 12,5 »)
  for (const f of apresLa0108().prepare('SELECT classe, prix FROM bouclier_classe').all()) assert.equal(f.prix, f.classe * n.bouclierParClasse);
});

test('R207 (1) E6 : sur toute la grille (231 armures), type = le plus lourd des deux matériaux, AP et AM = leur somme', () => {
  const g = grille(apresLa0108());
  assert.equal(g.length, 231);
  for (const x of g) assert.deepEqual([x.a.type, x.a.ap, x.a.am], [x.type, x.ap, x.am], x.a.id);
});

test('R207 (1) E6 : le prix de chaque armure de la grille (231) est le prix calculé, et son prix écrit se lit en ce prix', () => {
  for (const x of grille(apresLa0108())) {
    assert.equal(x.a.prix, x.prix, x.a.id);
    assert.equal(colonnesDeLArmure(x.a).prix, x.prix, `${x.a.id} : prix_brut`);
  }
});

test('R207 (1) : le registre de la 0108 — les 18 prix que la 0105 laissait hors formule, chacun le prix calculé', () => {
  const calc = new Map(grille(apresLa0108()).map((x) => [x.a.id, x]));
  const attendus = registre.prix_d_armure_hors_formule;
  assert.equal(attendus.length, 18);
  const prix = registre0108.valeurs.filter((v) => v.colonne === 'prix');
  assert.deepEqual(prix.map((v) => v.cle.id).sort(), attendus.map((p) => p.id).sort());
  for (const v of prix) {
    assert.notEqual(v.avant, v.apres, v.cle.id);
    assert.equal(v.apres, calc.get(v.cle.id).prix, v.cle.id);
    assert.equal(v.apres, attendus.find((p) => p.id === v.cle.id).prix_calcule, v.cle.id);
  }
  assert.ok(registre0108.valeurs.every((v) => v.table === 'armure' && ['prix', 'prix_brut'].includes(v.colonne)));
});

test('R207 (1) E6 : les 100 boucliers, AP et AM = classe x ceux du matériau, prix = classe x prix du matériau + prix de la forme', () => {
  const b = boucliers(apresLa0108());
  assert.equal(b.length, 100);
  for (const x of b) assert.deepEqual([x.b.ap, x.b.am, x.b.prix], [x.ap, x.am, x.prix], x.b.id);
});

test('R207 (1) : le registre de la 0105 — 6 armures (AP ou AM) et 10 prix de bouclier, chacun la valeur calculée, la défense écrite refaite', () => {
  const calc = new Map([...grille(apresLa0108()).map((x) => [x.a.id, x]), ...boucliers(apresLa0108()).map((x) => [x.b.id, x])]);
  const lignes = (table) => [...new Set(registre.valeurs.filter((v) => v.table === table).map((v) => v.cle.id))];
  assert.equal(lignes('armure').length, 6);
  assert.equal(lignes('bouclier').length, 10);
  for (const v of registre.valeurs.filter((x) => x.table === 'armure' || x.table === 'bouclier')) {
    assert.notDeepEqual(v.avant, v.apres, `${v.cle.id}.${v.colonne}`);
    const x = calc.get(v.cle.id);
    if (['ap', 'am', 'prix'].includes(v.colonne)) assert.equal(v.apres, x[v.colonne], `${v.cle.id}.${v.colonne}`);
    // la défense écrite et le prix écrit se lisent exactement en ces valeurs (lib/armure-champs.mjs : ce que le service refait)
    if (v.colonne === 'stats_brut') assert.equal(v.apres, `+${x.ap}AP +${x.am}AM`, v.cle.id);
    if (v.colonne === 'prix_brut') assert.equal(Number(v.apres.replace(',', '.')), x.prix, v.cle.id);
  }
  // la solidité n'entre pas dans E6
  assert.ok(!registre.valeurs.some((v) => v.colonne === 'solidite'));
});

test('R207 (3) : les 42 recettes de bâton magique en Perception + Volonté ; les 21 recettes de matériau ne changent pas', () => {
  // recette n'est écrite ni par lib/edition-modele.mjs ni par le service : ses valeurs se lisent telles quelles sur l'état courant
  const parGenre = (genre) => db.prepare('SELECT test_brut, test_carac_1_id, test_carac_2_id, count(*) AS n FROM recette WHERE genre = ? GROUP BY 1, 2, 3').all(genre).map((r) => ({ ...r }));
  assert.deepEqual(parGenre('baton_magique'), [{ test_brut: 'Test de Perception + Volonté', test_carac_1_id: 'perception', test_carac_2_id: 'volonte', n: 42 }]);
  assert.deepEqual(parGenre('materiau'), [{ test_brut: 'jet de FORCE + INTELLIGENCE', test_carac_1_id: 'force', test_carac_2_id: 'intelligence', n: 21 }]);
  const v = registre.valeurs.filter((x) => x.table === 'recette');
  assert.deepEqual(v.map((x) => x.colonne), ['test_brut', 'test_carac_1_id', 'test_carac_2_id']);
  for (const x of v) assert.equal(x.cles.length, 42);
});

test('R207 (3) : la page Bâton magique, le panneau « Armes » et le corps de la page Armes disent les caractéristiques du Doc « MÉTIER »', () => {
  const baton = texteDImport('page', { id: 'ressources/baton-magique' }, 'corps_md', APRES);
  assert.ok(baton.includes('Test de Perception + Volonté'));
  assert.ok(!baton.includes('Volonté + Intelligence'));
  for (const [table, cle, col] of [['panneau_regles_bloc', { panneau_id: 'armes', rang: 1 }, 'texte'], ['page', { id: 'ressources/armes' }, 'corps_md']]) {
    const t = texteDImport(table, cle, col, APRES);
    assert.ok(t.includes('Les caractéristiques Force et Volonté seront utilisées lors du test'), `${table} ${JSON.stringify(cle)}`);
    assert.ok(!t.includes('Force et Intelligence'), `${table} ${JSON.stringify(cle)}`);
  }
  // chaque fragment du registre est remplacé dans l'état de la migration
  for (const x of [...registre.textes, ...registre0108.textes]) {
    const t = texteDImport(x.table, x.cle, x.col, APRES);
    assert.ok(t.includes(x.apres) && !t.includes(x.avant), `${x.table} ${JSON.stringify(x.cle)} : ${x.apres.slice(0, 50)}`);
  }
});

test('R207 (3) : la 0109 — le panneau « Bâtons magiques » suit la page ; aucun bloc de panneau ne garde l’ancien test de fabrication', () => {
  assert.deepEqual(registre0109.textes.map((x) => [x.table, x.cle, x.col]), [['panneau_regles_bloc', { panneau_id: 'batons-magiques', rang: 2 }, 'texte']]);
  // les blocs de panneau se modifient sur le site de dev : lus dans l'état de la migration (seuls les lots rapatriés après elle sont défaits)
  const apres = baseDImport({ garder: lotsAvant('0109') });
  for (const x of registre0109.textes) {
    const t = texteDImport(x.table, x.cle, x.col, { garder: lotsAvant('0109') });
    assert.ok(t.includes(x.apres) && !t.includes(x.avant), `${x.table} ${JSON.stringify(x.cle)}`);
    // la même phrase que la 0105 a écrite dans la page Bâton magique
    assert.ok(registre.textes.some((p) => p.table === 'page' && p.cle.id === 'ressources/baton-magique' && p.avant === x.avant && p.apres === x.apres));
  }
  // les tests que R207 (3) écarte (« Force et Intelligence » du Forgeron, « Volonté + Intelligence » de l'Enchanteur) ne restent dans aucun bloc
  const anciens = apres.prepare("SELECT panneau_id, rang FROM panneau_regles_bloc WHERE instr(texte, 'Force et Intelligence') > 0 OR instr(texte, 'Volonté + Intelligence') > 0").all();
  assert.deepEqual(anciens.map((b) => ({ ...b })), []);
});
