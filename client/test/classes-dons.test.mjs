// Pages de classe : les dons (table `capacite`) disposés comme l'onglet (lib/classe-dons.mjs) et la lecture de la base (lib/classes-db.mjs).
//   - fonctions pures sur des dons synthétiques : type et précision, groupes de choix, étages du plateau, lignes du tableau du Mage Bleu ;
//   - la base réelle : 39 classes, chaque don placé une fois et une seule, les choix sont ceux de la vue v_capacite_exclusive (la disposition
//     de l'onglet), exemples du propriétaire (Barde, Archimage), rien ne vient d'un tableau Markdown.
// Le site de dev est la source des classes et des dons qu'il modifie (décision du propriétaire) : les effectifs et les valeurs citées de l'import se lisent
// dans historique_modification (lib/historique-site.mjs) : les formes et les exemples de l'onglet se contrôlent sur les lignes de l'import (assemblées comme
// la page : lib/classe-assemblage.mjs), l'état courant d'une classe que le site a remaniée (D11 : spécialités et dons créés ou supprimés) par des invariants.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ditClasseMagique } from '../src/lib/classe-magique.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { chargerClasses } from '../src/lib/classes-db.mjs';
import { assemblerClasse } from '../src/lib/classe-assemblage.mjs';
import { alternativesDe } from '../src/lib/dons-edition.mjs';
import { donsDuPlateau, entreeAnnexe, groupesDeChoix, nomsSeRepondent, plateauDeDons, typeDeDon } from '../src/lib/classe-dons.mjs';

const don = (id, nature, ligne, rang, extra = {}) => ({ id, nature, ligne, rang, niveau: 10, specialiteId: null, alternatives: [], ...extra });

test('typeDeDon : le mot du type et la précision entre parenthèses, telle qu’écrite', () => {
  assert.deepEqual(typeDeDon('Actif (2 fois/Combat)'), { mot: 'Actif', precision: '2 fois/Combat' });
  assert.deepEqual(typeDeDon('Actif  (1 fois/24h)'), { mot: 'Actif', precision: '1 fois/24h' });
  assert.deepEqual(typeDeDon('Réaction (1/combat)'), { mot: 'Réaction', precision: '1/combat' });
  assert.deepEqual(typeDeDon('Passif'), { mot: 'Passif', precision: null });
  assert.deepEqual(typeDeDon('pAsSiF'), { mot: 'pAsSiF', precision: null });
  assert.deepEqual(typeDeDon(null), { mot: null, precision: null });
});

test('groupesDeChoix : composantes de la relation « un seul au choix », de haut en bas puis de gauche à droite', () => {
  const dons = [
    don('c', 'choix', 29, 2, { alternatives: ['a'] }),
    don('a', 'choix', 29, 1, { alternatives: ['c'] }),
    don('x', 'choix', 25, 3, { alternatives: ['y', 'z'] }),
    don('y', 'choix', 25, 1, { alternatives: ['x', 'z'] }),
    don('z', 'choix', 25, 2, { alternatives: ['x', 'y'] }),
    don('seul', 'choix', 40, 1),
  ];
  assert.deepEqual(
    groupesDeChoix(dons).map((g) => g.options.map((o) => o.id)),
    [['y', 'z', 'x'], ['a', 'c'], ['seul']],
  );
});

test('plateauDeDons : dons sans choix, spécialités côte à côte (cartouche puis choix), choix sans spécialité, dans l’ordre des lignes', () => {
  const s1 = { id: 'k#specialite:a', rang: 1 };
  const s2 = { id: 'k#specialite:b', rang: 2 };
  const s3 = { id: 'k#specialite:vide', rang: 3 }; // sans aucun don : pas de colonne (Archimage)
  const dons = [
    don('lvl20', 'classe', 49, 1, { niveau: 20 }),
    don('lvl1', 'classe', 4, 1, { niveau: 1 }),
    don('carA', 'specialite', 22, 1, { specialiteId: s1.id, alternatives: ['carB'] }),
    don('carB', 'specialite', 22, 1, { specialiteId: s2.id, alternatives: ['carA'] }),
    don('a1', 'choix', 29, 1, { specialiteId: s1.id, alternatives: ['a2'] }),
    don('a2', 'choix', 29, 2, { specialiteId: s1.id, alternatives: ['a1'] }),
    don('b1', 'choix', 29, 1, { specialiteId: s2.id, alternatives: ['b2'] }),
    don('b2', 'choix', 29, 2, { specialiteId: s2.id, alternatives: ['b1'] }),
    don('g1', 'choix', 18, 1, { alternatives: ['g2'] }),
    don('g2', 'choix', 18, 2, { alternatives: ['g1'] }),
  ];
  const etages = plateauDeDons(dons, [s2, s3, s1]);
  assert.deepEqual(etages.map((e) => e.forme), ['don', 'choix', 'specialites', 'don']);
  assert.deepEqual(etages[1].options.map((o) => o.id), ['g1', 'g2']);
  const colonnes = etages[2].specialites;
  assert.deepEqual(colonnes.map((c) => c.specialite.id), [s1.id, s2.id], 'rang de la bannière : gauche puis droite ; la spécialité sans don est absente');
  assert.deepEqual(colonnes.map((c) => c.cartouche.id), ['carA', 'carB']);
  assert.deepEqual(colonnes[0].choix.map((g) => g.options.map((o) => o.id)), [['a1', 'a2']]);
  assert.deepEqual(donsDuPlateau(etages).map((d) => d.id).sort(), dons.map((d) => d.id).sort(), 'chaque don une fois');
});

test('entreeAnnexe : précision entre parenthèses, nom jusqu’au premier point, reste ; la ligne se reconstruit à l’identique', () => {
  const lignes = [
    '(Passif) Téméraire. Diminue de 5% le malus pour toucher une cible de la posture offensive.',
    '(Actif 2 fois/combat) Attaque saignante. La prochaine attaque réussie obligera le jet de vigueur.',
    '(Passif] Sujet épineux. En posture de défense, cette créature inflige 4 dégâts lors d’une parade parfaite.',
    '(Passif) Attrape-moi !. Augmente les jets de défense de 2% par créature empoisonnée sur le terrain.',
  ];
  assert.deepEqual(entreeAnnexe(lignes[0]), { type: 'Passif', nom: 'Téméraire.', texte: 'Diminue de 5% le malus pour toucher une cible de la posture offensive.' });
  assert.equal(entreeAnnexe(lignes[1]).type, 'Actif 2 fois/combat');
  assert.equal(entreeAnnexe(lignes[2]).nom, 'Sujet épineux.');
  assert.equal(entreeAnnexe(lignes[3]).nom, 'Attrape-moi !.');
  assert.deepEqual(entreeAnnexe('Une phrase sans précision.'), { type: null, nom: null, texte: 'Une phrase sans précision.' });
});

test('nomsSeRepondent : deux noms coupés qui se complètent', () => {
  assert.ok(nomsSeRepondent('Tenir ...', '... ou charger ?'));
  assert.ok(nomsSeRepondent('… ou infini', 'Vers l’infini …'));
  assert.ok(!nomsSeRepondent('Écho', 'Nouvel accord'));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Base réelle
// ---------------------------------------------------------------------------------------------------------------------------------

const db = ouvrirBase({ sansExemples: false });
const { classes, typesDon } = chargerClasses(db);
const historique = historiqueSite(db);
const compte = (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
const classe = (slug) => classes.get(`classes/${slug}`);
// les noms des exemples du propriétaire sont ceux de l'import (le site de dev peut renommer un don ou une spécialité) : on contrôle la disposition
const nomDImport = (d) => historique.valeurDImport('capacite', { id: d.id }, 'nom', d.nom);
const noms = (dons) => dons.map(nomDImport);
const nomDeSpecialite = (s) => historique.valeurDImport('specialite', { id: s.id }, 'nom', s.nom);
// les lignes de l'import (supprimées par le site remises, créées retirées) et le plateau qu'elles donnent, choix d'après la règle de la vue
const specialitesImport = historique.lignesDImport('specialite');
const donsImport = historique.lignesDImport('capacite');
function classeDImport(id) {
  const dons = donsImport.filter((k) => k.classe_id === id);
  return assemblerClasse({ specialites: specialitesImport.filter((s) => s.classe_id === id), dons, exclusions: new Map(dons.map((d) => [d.id, alternativesDe(d, dons)])), typesDon });
}
// les classes dont le site a créé ou supprimé une spécialité ou un don, ou changé la nature, la ligne ou la spécialité d'un don
const classeDeLaLigne = (table, l) => l.classe_id ?? historique.ligneDImport(table, { id: l.id })?.classe_id;
const classesRemaniees = new Set([
  ...historique.lignesRemaniees('capacite', ['nature', 'ligne', 'specialite_id']).map((l) => classeDeLaLigne('capacite', l)),
  ...historique.lignesRemaniees('specialite').map((l) => classeDeLaLigne('specialite', l)),
].filter(Boolean));

test('39 classes (à l’import), dans l’ordre du Sommaire ; 660 dons ; les quatre types de don du guide', () => {
  assert.equal(classes.size, compte('classe'));
  assert.equal(historique.effectifDImport('classe'), 39);
  const ordres = [...classes.values()].map((c) => c.ordre);
  assert.deepEqual(ordres, [...ordres].sort((a, b) => a - b));
  assert.equal([...classes.values()].reduce((n, c) => n + c.dons.length, 0), compte('capacite'));
  assert.equal(historique.effectifDImport('capacite'), 660);
  assert.deepEqual(typesDon.map((t) => t.nom), ['Passif', 'Actif', 'Action', 'Réaction']);
});

test('chaque don est placé une fois et une seule sur le plateau de sa classe', () => {
  for (const c of classes.values()) {
    const places = donsDuPlateau(c.plateau).map((d) => d.id);
    assert.equal(new Set(places).size, places.length, `${c.id} : don placé deux fois`);
    assert.deepEqual([...places].sort(), c.dons.map((d) => d.id).sort(), `${c.id} : don manquant`);
  }
});

test('les choix affichés sont exactement ceux de la vue v_capacite_exclusive (la disposition de l’onglet fait foi)', () => {
  const vue = new Set(db.prepare('SELECT capacite_id, autre_id FROM v_capacite_exclusive').all().map((r) => `${r.capacite_id}|${r.autre_id}`));
  const affiches = new Set();
  for (const c of classes.values()) {
    const groupes = c.plateau.flatMap((e) =>
      e.forme === 'choix'
        ? [e.options]
        : e.forme === 'specialites'
          ? [e.specialites.map((s) => s.cartouche).filter(Boolean), ...e.specialites.flatMap((s) => s.choix.map((g) => g.options))]
          : [],
    );
    for (const g of groupes) {
      if (g.length < 2) continue;
      assert.equal(new Set(g.map((d) => d.ligne)).size, 1, `${c.id} : un choix est sur une seule ligne de l’onglet`);
      for (const a of g) for (const b of g) if (a !== b) affiches.add(`${a.id}|${b.id}`);
    }
  }
  assert.deepEqual([...affiches].sort(), [...vue].sort());
});

/** La forme de l'onglet d'une classe (sauf l'Archimage) : deux dons reçus sans choix en haut (niveaux 1 et 5), les deux spécialités, un don au niveau 20. */
function formeDeLOnglet(c) {
  assert.deepEqual(c.plateau.map((e) => e.forme), ['don', 'don', 'specialites', 'don'], c.id);
  assert.deepEqual(c.plateau.filter((e) => e.forme === 'don').map((e) => e.niveau), [1, 5, 20], c.id);
  const [s] = c.plateau.filter((e) => e.forme === 'specialites');
  assert.equal(s.specialites.length, 2, c.id);
  for (const col of s.specialites) {
    assert.ok(col.cartouche, `${c.id} : cartouche de ${col.specialite.nom}`);
    assert.deepEqual(col.choix.map((g) => [g.niveau, g.options.length]), [[10, 2], [15, 2], [20, 2]], `${c.id} : ${col.specialite.nom}`);
  }
}

test('38 classes (toutes sauf l’Archimage) : deux dons reçus sans choix en haut (niveaux 1 et 5), les deux spécialités, un don au niveau 20 en bas', (t) => {
  const importees = historique.lignesDImport('classe').filter((c) => c.id !== 'classes/archimage');
  assert.equal(importees.length, 38, 'à l’import');
  for (const c of importees) formeDeLOnglet({ id: c.id, ...classeDImport(c.id) });
  for (const c of classes.values()) {
    if (c.id === 'classes/archimage') continue;
    if (!c.dons.length) {
      // une classe créée depuis le site n'a pas forcément de don ; une classe importée en a toujours, sauf si le site les a retirés
      assert.ok(historique.creee('classe', { id: c.id }) || classesRemaniees.has(c.id), `${c.id} : classe importée sans don`);
      t.diagnostic(`${c.id} : sans don (à compléter)`);
      continue;
    }
    // une classe que le site a remaniée (D11) : les invariants des autres tests (chaque don placé une fois, choix de la vue) suffisent
    if (classesRemaniees.has(c.id) || historique.creee('classe', { id: c.id })) {
      t.diagnostic(`${c.id} : remaniée sur le site`);
      continue;
    }
    formeDeLOnglet(c);
  }
});

// les exemples du propriétaire : le plateau de l'import (le site peut ajouter ou retirer des dons)
test('exemple du propriétaire (Barde) : Danseur ou Ménestrel ; Nouvel accord ou Écho, Ballade guerrière ou Amplification, Exaltation ou Touérk !', () => {
  const barde = classeDImport('classes/barde');
  const [avant1, avant5, specialites, apres] = barde.plateau;
  assert.equal(nomDImport(avant1.don), 'Prestation');
  assert.equal(nomDImport(avant5.don), 'Son perturbant');
  assert.equal(nomDImport(apres.don), 'Chant double');
  const [danseur, menestrel] = specialites.specialites;
  assert.deepEqual([nomDeSpecialite(danseur.specialite), nomDeSpecialite(menestrel.specialite)], ['DANSEUR', 'MÉNESTREL']);
  assert.deepEqual(menestrel.choix.map((g) => noms(g.options)), [['Nouvel accord', 'Écho'], ['Ballade guerrière', 'Amplification'], ['Exaltation', 'Touérk !']]);
  assert.deepEqual(danseur.choix.map((g) => noms(g.options)), [['Perroquet', 'Contournement'], ['Shrapnel', 'Marche lunaire'], ['À bas les Badauds', 'Bain de foule']]);
  const nouvel = menestrel.choix[0].options[0];
  assert.equal(nouvel.ancre, 'don-barde-nouvel-accord');
  assert.equal(typeDeDon(historique.valeurDImport('capacite', { id: nouvel.id }, 'type_brut')).precision, '1 fois/Combat', 'à l’import');
  if (classe('barde').dons.some((d) => d.id === nouvel.id) && !historique.modifiee('capacite', { id: nouvel.id }, 'type_brut')) {
    assert.deepEqual(nouvel.type, { id: 'actif', libelle: 'Actif', definition: typesDon.find((t) => t.id === 'actif').definition });
    assert.equal(nouvel.precision, '1 fois/Combat');
  }
});

test('exemple du propriétaire (Archimage) : pas de spécialité, Élémentaliste ou Occultiste puis un choix parmi trois à chaque palier, Semi-complet en plus', () => {
  const a = classeDImport('classes/archimage');
  assert.deepEqual(a.plateau.map((e) => e.forme), ['don', 'don', 'choix', 'choix', 'choix', 'choix', 'don']);
  const choix = a.plateau.filter((e) => e.forme === 'choix');
  assert.deepEqual(noms(choix[0].options), ['Élémentaliste', 'Occultiste']);
  assert.deepEqual(choix.map((g) => [g.niveau, g.options.length]), [[10, 2], [10, 3], [15, 3], [20, 3]]);
  assert.equal(nomDImport(a.plateau.at(-1).don), 'Semi-complet');
});

test('types : le nom du guide pour les quatre types (« pAsSiF » s’affiche « Passif »), « Variable » tel qu’écrit', () => {
  const tous = [...classes.values()].flatMap((c) => c.dons);
  const superHache = tous.find((d) => d.id === 'capacites/marcass-super-hache');
  assert.equal(historique.valeurDImport('capacite', { id: superHache.id }, 'type_brut'), 'pAsSiF', 'à l’import');
  if (!historique.modifiee('capacite', { id: superHache.id }, 'type_brut')) {
    assert.equal(superHache.typeBrut, 'pAsSiF');
    assert.equal(superHache.type.libelle, 'Passif');
  }
  assert.ok(tous.filter((d) => d.type?.id === 'variable').every((d) => d.type.libelle === 'Variable' && d.type.definition === null));
  assert.ok(tous.every((d) => d.type !== null), 'chaque don a un type');
});

test('classe magique par sa spécialité : le don de spécialité le dit (classes raciales, Flagelleur), jamais celui d’une classe magique par catégorie', () => {
  // la page suit le texte du don de spécialité tel qu'il est dans la base
  const effet = new Map(db.prepare('SELECT id, nature, effet FROM capacite').all().map((k) => [k.id, k]));
  for (const c of classes.values()) {
    for (const d of c.dons) assert.equal(d.classeMagique, d.nature === 'specialite' && ditClasseMagique(effet.get(d.id).effet), d.id);
  }
  // à l'import : 14 classes (les 13 classes raciales et le Flagelleur), le Chaman pour l'Orios, aucune classe magique par catégorie
  const categorie = new Map(historique.lignesDImport('classe').map((c) => [c.id, c.categorie_id]));
  const dons = historique.lignesDImport('capacite').filter((k) => k.nature === 'specialite' && ditClasseMagique(k.effet));
  const parSpecialite = [...new Set(dons.map((k) => k.classe_id))].sort();
  assert.equal(parSpecialite.length, 14);
  assert.ok(parSpecialite.includes('classes/flagelleur') && parSpecialite.includes('classes/orios'));
  assert.deepEqual(dons.filter((k) => k.classe_id === 'classes/orios').map((k) => k.nom), ['Chaman']);
  assert.deepEqual(dons.filter((k) => categorie.get(k.classe_id) === 'classe-magique').map((k) => k.id), []);
  assert.equal(classe('barde').amMagique, 4);
});

test('départ, inventaire, tableau du Mage Bleu, race d’une classe raciale : lus dans les tables', () => {
  const barde = classe('barde');
  const ligneBarde = db.prepare("SELECT sante_depart, chakra_depart, barriere_depart FROM classe WHERE id = 'classes/barde'").get();
  assert.deepEqual(barde.depart.map((d) => d.valeur), [ligneBarde.sante_depart, ligneBarde.chakra_depart, ligneBarde.barriere_depart]);
  const dImport = (id, colonne) => historique.valeurDImport('classe', { id }, colonne);
  const intact = (id, colonne) => !historique.modifiee('classe', { id }, colonne);
  assert.deepEqual(['sante_depart', 'chakra_depart', 'barriere_depart'].map((c) => dImport('classes/barde', c)), [2, 6, 2], 'à l’import');
  if (intact('classes/barde', 'maitrise_armure')) assert.deepEqual(barde.maitriseArmure, ['Légère', 'Bouclier classe 1 à 2']);
  const mageBleu = classe('mage-bleu');
  if (intact('classes/mage-bleu', 'inventaire_depart')) {
    const kdr = mageBleu.inventaire.find((options) => options.length === 2);
    assert.deepEqual(kdr.map((o) => o.texte), ['KDR Arme', 'carquois N'], '« A OU B » : deux options du même emplacement');
    assert.ok(kdr.every((o) => o.description), 'objets du glossaire : description pour l’infobulle');
  }
  assert.equal(mageBleu.annexe.length, 14);
  assert.ok(mageBleu.annexe.every((a) => a.magie), 'chaque libellé est une magie');
  for (const a of mageBleu.annexe) for (const e of a.entrees) assert.ok(e.type && e.nom, `${a.libelle} : ${e.texte}`);
  assert.deepEqual(classe('orios').race, { id: 'races/orios', nom: 'Orios' });
  assert.equal(barde.race, null);
  assert.equal(classe('mage-bleu').aSavoirLien, null, 'lien vers le classeur « Familiers » retiré (demande du propriétaire, migration 0019)');
});
