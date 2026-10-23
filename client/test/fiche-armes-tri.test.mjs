// L'ordre des familles dans la liste des armes 1 et 2 de la fiche (lib/fiche-moteur.mjs#groupesDArmesParMaitrise), demande du propriétaire du
// 2026-10-23, mot pour mot : « pour les armes il faudrai trier les catégories d'arme dans la dropdown en fonction de leur niveau de maitrise. (les plus
// hauts d'abord) ensuite parordre alphabétique si même niveau de maitrise. » Le niveau d'une famille : ses points comptés (`comptes` de
// maitrisesParFamille, 4 au plus : décision R149) ; à niveau égal, l'ordre alphabétique français (accents et majuscules ignorés) ; les armes sans
// famille (« Autres ») à la fin ; l'ordre des armes d'une famille ne change pas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { groupesDArmesParMaitrise, maitrisesParFamille } from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

// des règles d'essai : seules les familles et les armes servent (les niveaux sont donnés)
const ESSAI = {
  familles_armes: [
    { id: 'hache', nom: 'HACHE', maitrisable: true },
    { id: 'epees', nom: 'épées', maitrisable: true },
    { id: 'arc', nom: 'ARC', maitrisable: true },
    { id: 'baton', nom: 'BÂTON DE COMBAT', maitrisable: true },
    { id: 'bombes', nom: 'Bombes', maitrisable: true },
    { id: 'monstres', nom: 'ARME DE MONSTRES', maitrisable: false },
  ],
  armes: [
    { id: 'a1', nom: 'Hachette', famille_id: 'hache' },
    { id: 'a2', nom: 'Fleuret', famille_id: 'epees' },
    { id: 'a3', nom: 'Rapière', famille_id: 'epees' },
    { id: 'a4', nom: 'Arc court', famille_id: 'arc' },
    { id: 'a5', nom: 'Bâton', famille_id: 'baton' },
    { id: 'a6', nom: 'Grenade', famille_id: 'bombes' },
    { id: 'a7', nom: 'Griffe', famille_id: 'monstres' },
    { id: 'a8', nom: 'Bricolage', famille_id: null },
    { id: 'a9', nom: 'Hache double', famille_id: 'hache' },
    { id: 'a10', nom: 'Objet perdu', famille_id: 'famille-inconnue' },
    { id: 'a11', nom: 'Épée longue', famille_id: 'epees' },
  ],
};
const niveaux = (comptes) => Object.entries(comptes).map(([famille, n]) => ({ famille, comptes: n }));
const ordre = (groupes) => groupes.map((g) => g.famille);

test('demande du propriétaire du 2026-10-23 : les familles de la liste des armes, la plus haute maîtrise d’abord', () => {
  const g = groupesDArmesParMaitrise(ESSAI, null, niveaux({ hache: 1, epees: 3, arc: 2, baton: 0, bombes: 0 }));
  assert.deepEqual(ordre(g), ['epees', 'arc', 'hache', 'monstres', 'baton', 'bombes', null]);
  assert.deepEqual(g.map((x) => x.niveau), [3, 2, 1, 0, 0, 0, 0]);
});

test('à niveau égal, l’ordre alphabétique français : accents et majuscules ignorés', () => {
  // « ARME DE MONSTRES » < « BÂTON DE COMBAT » < « Bombes » < « épées » < « HACHE » : l'ordre des codes mettrait « Bombes » avant « BÂTON » (Â après O)
  // et « épées » (minuscule accentuée) après tout le reste
  const g = groupesDArmesParMaitrise(ESSAI, null, niveaux({ hache: 0, epees: 0, arc: 0, baton: 0, bombes: 0 }));
  assert.deepEqual(g.map((x) => x.nom), ['ARC', 'ARME DE MONSTRES', 'BÂTON DE COMBAT', 'Bombes', 'épées', 'HACHE', 'Autres']);
  // deux familles au même niveau, au-dessus des autres : départagées de même
  const deux = groupesDArmesParMaitrise(ESSAI, null, niveaux({ hache: 2, epees: 2, baton: 2, bombes: 1 }));
  assert.deepEqual(ordre(deux).slice(0, 4), ['baton', 'epees', 'hache', 'bombes']);
});

test('une famille sans maîtrise, ou sans ligne de maîtrise (ARME DE MONSTRES, R45), est au niveau 0', () => {
  const g = groupesDArmesParMaitrise(ESSAI, null, niveaux({ bombes: 1 }));
  assert.equal(g[0].famille, 'bombes');
  assert.ok(g.filter((x) => x.famille !== 'bombes').every((x) => x.niveau === 0));
  assert.equal(g.find((x) => x.famille === 'monstres').niveau, 0);
});

test('décision R149 : le niveau est celui des points comptés, 4 au plus ; l’excédent ne départage pas', () => {
  // HACHE a 5 points, dont 1 au-delà du plafond (comptes = 4) ; épées en a 4 : même niveau, l'ordre alphabétique les départage
  const maitrises = [{ famille: 'hache', points: 5, comptes: 4, excedent: 1 }, { famille: 'epees', points: 4, comptes: 4, excedent: 0 }];
  const g = groupesDArmesParMaitrise(ESSAI, null, maitrises);
  assert.deepEqual(ordre(g).slice(0, 2), ['epees', 'hache']);
  assert.deepEqual(g.slice(0, 2).map((x) => x.niveau), [4, 4]);
});

test('les armes sans famille connue forment « Autres », à la fin ; l’ordre des armes d’une famille ne change pas', () => {
  const g = groupesDArmesParMaitrise(ESSAI, null, niveaux({}));
  const autres = g.at(-1);
  assert.deepEqual([autres.famille, autres.nom, autres.niveau], [null, 'Autres', 0]);
  assert.deepEqual(autres.armes.map((a) => a.id), ['a8', 'a10']);
  assert.deepEqual(g.find((x) => x.famille === 'epees').armes.map((a) => a.nom), ['Fleuret', 'Rapière', 'Épée longue'], 'l’ordre des règles');
  assert.deepEqual(g.find((x) => x.famille === 'hache').armes.map((a) => a.id), ['a1', 'a9']);
  assert.equal(g.reduce((n, x) => n + x.armes.length, 0), ESSAI.armes.length, 'chaque arme une fois');
  // sans arme sans famille, pas de groupe « Autres »
  const sans = { ...ESSAI, armes: ESSAI.armes.filter((a) => a.famille_id && a.famille_id !== 'famille-inconnue') };
  assert.ok(!groupesDArmesParMaitrise(sans, null, niveaux({})).some((x) => x.famille === null));
});

test('sur les vraies règles : la fiche donne le niveau (maitrisesParFamille), et chaque arme reste dans sa famille', () => {
  const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(ouvrirBase({ sansExemples: false }))));
  const xp = regles.niveaux.find((l) => l.niveau === 11).xp_min;
  // Lanceur Fantassin puis Lancier (comme test/fiche-maitrises.test.mjs, R149) : ARME DE JET à 4 points, HACHE à 2 (deux points choisis)
  const fiche = {
    ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp, mode_classe: 'mono',
    classes: [{ rang: 1, classe_id: 'classes/lanceur', specialite_id: 'classes/lanceur#specialite:fantassin' }, { rang: 2, classe_id: 'classes/lancier', specialite_id: null }],
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    maitrise_choix: [
      { source: 'classes/lanceur#maitrise-arme:2', rang: 1, arme_famille_id: 'hache' },
      { source: 'capacites/lanceur-fantassin', rang: 1, arme_famille_id: 'hache' },
    ],
  };
  const maitrises = maitrisesParFamille(regles, fiche);
  const g = groupesDArmesParMaitrise(regles, fiche);
  assert.deepEqual(g, groupesDArmesParMaitrise(regles, fiche, maitrises), 'les maîtrises de la fiche par défaut');
  const comptes = new Map(maitrises.map((m) => [m.famille, m.comptes]));
  for (const x of g) assert.equal(x.niveau, comptes.get(x.famille) ?? 0, x.nom);
  for (let i = 1; i < g.length; i += 1) assert.ok(g[i - 1].niveau >= g[i].niveau, `${g[i - 1].nom} avant ${g[i].nom}`);
  assert.equal(g[0].famille, 'arme-de-jet');
  assert.ok(g.findIndex((x) => x.famille === 'hache') < g.findIndex((x) => x.niveau === 0), 'HACHE avant les familles sans maîtrise');
  // les familles sans maîtrise : « BÂTON DE COMBAT » avant « BOMBES » (accent ignoré)
  const zero = g.filter((x) => x.niveau === 0).map((x) => x.famille);
  assert.ok(zero.indexOf('baton-de-combat') < zero.indexOf('bombes'));
  for (const x of g) assert.ok(x.armes.every((a) => a.famille_id === x.famille), x.nom);
  assert.equal(g.reduce((n, x) => n + x.armes.length, 0), regles.armes.length);
});
