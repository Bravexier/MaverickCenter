// Données de la page « Accessoires » (lib/accessoires-db.mjs) lues dans la base : les tables du générateur forment des dés complets (chaque jet a sa
// ligne), chaque gemme a la couleur de sa magie, les gemmes d'un effet sont celles de accessoire_effet_gemme ; les règles et les consignes viennent du
// Markdown de la page sans ses tableaux.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bulleDeGemme, chargerAccessoires, consignesDesEtapes, titreDeCompetence } from '../src/lib/accessoires-db.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { facesDuDe, gemmesAuChoix, prixDeLAccessoire, qualiteDeGemme, QUALITES_DE_GEMME } from '../src/lib/accessoires-generateur.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { couleurDeMagie } from '../src/lib/sort-format.mjs';

const db = ouvrirBase();
const a = chargerAccessoires(db);
const suite = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('étape 1 : un emplacement par face du dé', () => {
  const jets = a.emplacements.map((e) => e.jet);
  assert.deepEqual(jets, suite(facesDuDe(jets)));
});

test('étape 2 : les plages des propriétés couvrent le dé sans trou ni chevauchement', () => {
  let attendu = 1;
  for (const p of a.proprietes) {
    assert.equal(p.jet_min, attendu, p.id);
    attendu = p.jet_max + 1;
  }
  assert.equal(attendu - 1, facesDuDe(a.proprietes.map((p) => p.jet_max)));
});

test('étape 3 : chaque tableau d’effets a une ligne par jet ; la compétence, une ligne par caractéristique et un effet par niveau', () => {
  for (const p of a.proprietes.filter((x) => x.effets.length && x.id !== 'competence')) {
    const jets = p.effets.map((e) => e.jet).sort((x, y) => x - y);
    assert.deepEqual(jets, suite(facesDuDe(jets)), p.id);
  }
  const { colonnes, lignes } = a.competences;
  assert.deepEqual(lignes.map((l) => l.jet), suite(lignes.length));
  assert.ok(lignes.every((l) => l.effets.length === colonnes.length && l.effets.every((e, i) => e.niveau === colonnes[i].niveau)));
  // les colonnes du bonus d'acquis couvrent le 1d20 sans trou
  let attendu = 1;
  for (const c of colonnes) {
    assert.equal(c.min, attendu);
    attendu = c.max + 1;
  }
  assert.equal(attendu - 1, 20);
  assert.equal(a.proprietes.find((p) => p.id === 'malediction').effets.length, 0);
});

test('compétence : « Compétence Force » pour « Compétence F » (la caractéristique dans le titre, demande du propriétaire)', () => {
  for (const l of a.competences.lignes) assert.equal(l.titre, `Compétence ${l.caracteristique}`, l.libelle);
  assert.equal(titreDeCompetence('Compétence F', 'Force'), 'Compétence Force');
  assert.equal(titreDeCompetence('Compétence A', 'Agilité'), 'Compétence Agilité');
  assert.equal(titreDeCompetence('Compétence V', 'Volonté'), 'Compétence Volonté');
  // une écriture qui n'est pas « Compétence » + l'initiale de la caractéristique reste telle quelle
  assert.equal(titreDeCompetence('Compétence F', 'Agilité'), 'Compétence F');
  assert.equal(titreDeCompetence('Compétence Force', 'Force'), 'Compétence Force');
  assert.equal(titreDeCompetence('Compétence F', null), 'Compétence F');
});

test('gemmes : une par magie, dans la couleur de sa magie ; les gemmes d’un effet sont celles de la base', () => {
  assert.equal(new Set(a.gemmes.map((g) => g.magie.id)).size, a.gemmes.length);
  for (const g of a.gemmes) {
    assert.equal(g.couleur, couleurDeMagie(g.magie.nom), g.nom);
    assert.ok(g.quarts.commune && g.quarts.raffinee && g.quarts.parfaite, g.nom);
  }
  assert.equal(new Set(a.gemmes.map(({ id }) => bulleDeGemme(id))).size, a.gemmes.length, 'identifiants d’infobulle distincts');
  const effets = a.proprietes.flatMap((p) => p.effets);
  const comptees = effets.reduce((n, e) => n + e.gemmes.flat().length, 0);
  assert.equal(comptees, db.prepare('SELECT COUNT(*) AS n FROM accessoire_effet_gemme').get().n);
});

test('montures : une par niveau, du niveau 1 au niveau 5', () => {
  assert.deepEqual(a.montures.map((m) => m.niveau), [1, 2, 3, 4, 5]);
  assert.ok(a.montures.every((m) => m.matiere && m.prix_brut && m.effet_brut));
});

test('règles (le panneau de l’onglet tel que la migration 0055 l’a copié du texte avant la création) : sans tableau ; la qualité de gemme de chaque niveau y est écrite', () => {
  const regles = historiqueSite(db).lignesDImport('panneau_regles_bloc').filter((b) => b.panneau_id === 'accessoires').map((b) => b.texte).join('\n\n');
  assert.ok(regles.includes('Les accessoires maudits'));
  assert.ok(!regles.includes('|'), 'aucun tableau');
  assert.ok(!regles.includes('CRÉATION'));
  for (const q of QUALITES_DE_GEMME) {
    const phrase = `Gemme ${q.libelle} = Accessoire niveau ${q.niveaux.join(' et ')}`;
    assert.ok(regles.includes(phrase), phrase);
  }
});

test('consignes des étapes : le texte sous chaque étape, sans les lignes du dé ni les tableaux', () => {
  const c = consignesDesEtapes(a.page.corps_md, a.proprietes);
  for (const lignes of Object.values(c)) for (const l of lignes) assert.ok(!/^[|-]/.test(l) && !/= ?1d\d+$/.test(l), l);
  assert.ok(Object.keys(c).every((k) => k === 'emplacement' || k === 'propriete' || a.proprietes.some((p) => p.id === k)));
  assert.deepEqual(consignesDesEtapes('', a.proprietes), {});
});

test('prix d’un accessoire = quarts de gemme à la qualité du niveau + monture du niveau : la composition des prix écrits du tableau', () => {
  const monture = new Map(a.montures.map((m) => [m.niveau, m.prix_ro]));
  const ecarts = [];
  let verifies = 0;
  for (const e of a.proprietes.flatMap((p) => p.effets)) {
    const rangs = e.gemmes.map((r) => r.map((g) => g.id));
    if (e.prix_ro === null || !e.niveau || !rangs.length || gemmesAuChoix(rangs).max) continue;
    const q = qualiteDeGemme(e.niveau).id;
    const prix = prixDeLAccessoire(e.gemmes.map((r) => r[0].quartsRf[q]), monture.get(e.niveau));
    if (prix === e.prix_ro) verifies++;
    else ecarts.push(e.id);
  }
  // « Permet à un dé de dégâts d'être maximum » (Grenat + Onyx, niveau 4) : 179 Ro écrits, 124 Ro par la composition
  assert.deepEqual(ecarts, ['ressources/accessoires#effet:attaque:5']);
  assert.ok(verifies >= 100, `${verifies} prix vérifiés`);
  // les effets aux gemmes au choix n'ont pas de prix écrit : il se calcule une fois les gemmes cochées
  for (const e of a.proprietes.flatMap((p) => p.effets).filter((x) => gemmesAuChoix(x.gemmes.map((r) => r.map((g) => g.id))).max)) assert.equal(e.prix_ro, null, e.id);
});
