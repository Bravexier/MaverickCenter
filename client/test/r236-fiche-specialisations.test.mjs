// Décisions R236 (spécialisations magiques) et R248 (coût de Projectile arcanique) dans le moteur de la fiche (lib/fiche-moteur.mjs) et sur sa page :
//   - R236 (1) : le NPM où s'ouvrent les spécialisations se lit dans les règles (le plus petit NPM d'un sort qui en a une), jamais un 3 écrit en dur ;
//   - R236 (2), (3), (7) : le mono-magie et le Potentiel Illimité gardent tous les sorts de leurs magies, le bi-magie n'a que les sorts communs et ceux de
//     la spécialisation choisie pour chaque magie (sortsPossibles) ; R236 (8) : ses livres de sort aussi (sortsDesLivres) ;
//   - R236 (6) : le choix reste modifiable ; un sort de l'ancienne spécialisation passe en rouge (lignesDeSorts.horsDesRegles, comme R27) ; un choix en
//     attente par magie, dès que le NPM des sorts atteint le seuil (choixEnAttente), jamais fait à la place du joueur ;
//   - R236 (4), (5) : la Super-magie, une condition d'emplacements de plus, la même que « Grimoire » (emplacementsDeSorts) ;
//   - R248 (et R251 pour le texte) : le coût de Projectile arcanique, « 4/projectile » et « +1 au coût de chaque projectile supplémentaire » : 4 + 5 + …
//     pour N projectiles (4, 9, 15… ; 85 pour dix), puis les réductions sur le total.
// Les règles sont celles de l'état d'import (test/aide-base-d-import.mjs) : les sorts, leurs spécialisations et leurs coûts se modifient sur le site de
// dev ; les valeurs des décisions (deux spécialisations par magie, hors Potentiel Illimité, coût 4 et pas de 1) sont écrites par les migrations 0117, 0118,
// que ni lib/edition-modele.mjs ni le service n'écrivent comme cela. Les ids sont figés ; rien n'est cherché par un nom, sauf le bâton de l'exemple de
// R129, par son id. Un dernier test lit le code de la page (src/scripts/fiche.mjs) comme un texte, comme test/fiche-controles.test.mjs.
//   node --test test/r236-fiche-specialisations.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { POTENTIEL_ILLIMITE } from '../src/lib/potentiel-illimite.mjs';
import { valeurAuNm } from '../src/lib/sort-maitrise.mjs';
import { reglesDImport } from './aide-base-d-import.mjs';

const regles = reglesDImport();
const FEU = 'magies/magie-du-feu';
const EAU = 'magies/magie-de-leau';
const CORRUPTION = 'magies/magie-de-la-corruption';
const ARCHIMAGE = 'classes/archimage';
const PROJECTILE = 'magies/magie-de-larcane#sort:projectile-arcanique';
const BATON_ARCANE_3 = 'ressources/baton-magique#baton:arcane:3';

const magie = (id) => M.trouver(regles.magies, id);
const specialisations = (id) => magie(id).specialisations.map((s) => s.id);
const sortsDe = (m, filtre = () => true) => regles.sorts.filter((s) => s.magie_id === m && filtre(s));
const ids = (sorts) => sorts.map((s) => s.id);
/** Les mêmes sorts, sans l'ordre (sortsPossibles suit l'ordre des règles, par magie puis NPM). */
const memes = (reel, attendu, message) => assert.deepEqual(ids(reel).sort(), ids(attendu).sort(), message);
const SEUIL = M.seuilDesSpecialisations(regles);
/** Le premier niveau global dont la puissance magique est au moins `p`. */
const niveauDePuissance = (p, r = regles) => r.niveaux.find((n) => M.puissanceMagique(r, n.niveau) >= p).niveau;
const xpDuNiveau = (n, r = regles) => r.niveaux.find((l) => l.niveau === n).xp_min;
const niveauSeuil = niveauDePuissance(SEUIL);
const fiche = (niveau, plus = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', xp: xpDuNiveau(niveau), ...plus });
const choix = (...couples) => ({ specialisations_magie: couples.map(([magie_id, specialisation_id]) => ({ magie_id, specialisation_id })) });
/** Un bi-magie Feu (innée) et Eau (acquise) avec ou sans choix. */
const biMagie = (niveau, ...couples) => fiche(niveau, { magie_innee_id: FEU, magie_acquise_id: EAU, ...choix(...couples) });
const [FEU_A, FEU_B] = specialisations(FEU);
const [EAU_A, EAU_B] = specialisations(EAU);
/** Les sorts communs (`sansSpecialisation`) ou, sinon, ceux qui ont une spécialisation. */
const communsOuSpecialises = (sorts, sansSpecialisation) => sorts.filter((s) => (sansSpecialisation ? !s.specialisation_id : s.specialisation_id));

test('R236 (1) : le seuil des spécialisations est lu dans les règles (le plus petit NPM d’un sort qui en a une) ; deux spécialisations par magie, aucune pour le Potentiel Illimité', () => {
  const avec = regles.sorts.filter((s) => s.specialisation_id);
  assert.ok(avec.length > 0);
  assert.equal(SEUIL, Math.min(...avec.map((s) => s.niveau)));
  assert.equal(SEUIL, 3, 'à l’import : le NPM 3 (R236 (1))');
  // le seuil suit les règles : sans les sorts de NPM 3 (ici sans spécialisation), il monte au NPM suivant ; sans aucun, il n'y en a pas
  const sans3 = structuredClone(regles);
  for (const s of sans3.sorts) if (s.niveau === SEUIL) s.specialisation_id = null;
  assert.equal(M.seuilDesSpecialisations(sans3), SEUIL + 1);
  for (const s of sans3.sorts) s.specialisation_id = null;
  assert.equal(M.seuilDesSpecialisations(sans3), null);
  for (const m of regles.magies) assert.equal(m.specialisations.length, m.id === POTENTIEL_ILLIMITE ? 0 : 2, m.id);
  // chaque sort à spécialisation est d'une spécialisation de sa magie
  for (const s of avec) assert.ok(specialisations(s.magie_id).includes(s.specialisation_id), s.id);
});

test('R236 (2), (3) : bi-magie = magie acquise et magie innée autre que le Potentiel Illimité ; mono-magie = sans magie acquise (Corruption innée et Potentiel Illimité compris)', () => {
  assert.equal(M.estBiMagie({ magie_innee_id: FEU, magie_acquise_id: EAU }), true);
  assert.equal(M.estBiMagie({ magie_innee_id: FEU, magie_acquise_id: null }), false);
  assert.equal(M.estBiMagie({ magie_innee_id: CORRUPTION, magie_acquise_id: null }), false);
  assert.equal(M.estBiMagie({ magie_innee_id: POTENTIEL_ILLIMITE, magie_acquise_id: null }), false);
  assert.equal(M.estBiMagie({ magie_innee_id: POTENTIEL_ILLIMITE, magie_acquise_id: EAU }), false);
  assert.equal(M.estBiMagie({ magie_innee_id: null, magie_acquise_id: EAU }), true, 'comme la règle SQL : l’innée seulement ≠ Potentiel Illimité');
  assert.equal(M.estBiMagie(ficheVide()), false);
});

test('R236 (3), (6) : specialisationsValables : une par magie de la fiche, d’une spécialisation de cette magie ; le choix se change et se retire', () => {
  const f = biMagie(niveauSeuil);
  const valables = (liste) => M.specialisationsValables(regles, { ...f, specialisations_magie: liste });
  assert.deepEqual(valables([{ magie_id: FEU, specialisation_id: FEU_B }, { magie_id: EAU, specialisation_id: EAU_A }]),
    [{ magie_id: FEU, specialisation_id: FEU_B }, { magie_id: EAU, specialisation_id: EAU_A }]);
  // une spécialisation d'une autre magie, inconnue, d'une magie que la fiche n'a pas : écartées ; deux pour une même magie : la première
  assert.deepEqual(valables([{ magie_id: FEU, specialisation_id: EAU_A }]), []);
  assert.deepEqual(valables([{ magie_id: FEU, specialisation_id: 'inconnue' }]), []);
  assert.deepEqual(valables([{ magie_id: CORRUPTION, specialisation_id: specialisations(CORRUPTION)[0] }]), []);
  assert.deepEqual(valables([{ magie_id: POTENTIEL_ILLIMITE, specialisation_id: FEU_A }]), []);
  assert.deepEqual(valables([{ magie_id: FEU, specialisation_id: FEU_A }, { magie_id: FEU, specialisation_id: FEU_B }]), [{ magie_id: FEU, specialisation_id: FEU_A }]);
  assert.deepEqual(M.specialisationsValables(regles, { ...ficheVide() }), [], 'sans la clé : aucun choix');
  // un mono-magie garde son choix, sans effet
  assert.equal(M.specialisationsValables(regles, fiche(niveauSeuil, { magie_innee_id: FEU, ...choix([FEU, FEU_A]) })).length, 1);
  // choisir, changer, bascule (le même choix retire), retirer
  let g = f;
  g = { ...g, specialisations_magie: M.specialisationsApresChoix(regles, g, FEU, FEU_A) };
  assert.deepEqual(g.specialisations_magie, [{ magie_id: FEU, specialisation_id: FEU_A }]);
  g = { ...g, specialisations_magie: M.specialisationsApresChoix(regles, g, EAU, EAU_B) };
  g = { ...g, specialisations_magie: M.specialisationsApresChoix(regles, g, FEU, FEU_B) };
  assert.deepEqual(M.specialisationsValables(regles, g), [{ magie_id: EAU, specialisation_id: EAU_B }, { magie_id: FEU, specialisation_id: FEU_B }]);
  g = { ...g, specialisations_magie: M.specialisationsApresChoix(regles, g, FEU, FEU_B) };
  assert.deepEqual(g.specialisations_magie, [{ magie_id: EAU, specialisation_id: EAU_B }], 'le même choix le retire');
  assert.deepEqual(M.specialisationsApresChoix(regles, g, EAU, null), []);
  assert.equal(M.specialisationsApresChoix(regles, g, EAU, FEU_A), g.specialisations_magie, 'une spécialisation d’une autre magie ne change rien');
});

test('R236 (2), (3), (7) : sortsPossibles : le bi-magie n’a que les sorts communs et ceux de la spécialisation choisie de chaque magie ; mono-magie et Potentiel Illimité gardent tout, sous le NPM des sorts', () => {
  for (const niveau of [niveauSeuil, niveauDePuissance(SEUIL + 1)]) {
    const npm = M.npmDesSorts(regles, biMagie(niveau));
    assert.ok(npm >= SEUIL, `niveau ${niveau} : le NPM des sorts atteint le seuil`);
    const jusquAuNpm = (sorts) => sorts.filter((s) => s.niveau <= npm);
    const deux = [...sortsDe(FEU), ...sortsDe(EAU)];
    // sans choix : aucun sort à spécialisation, seulement les sorts communs
    const sansChoix = M.sortsPossibles(regles, biMagie(niveau));
    memes(sansChoix, jusquAuNpm(communsOuSpecialises(deux, true)), `niveau ${niveau} : sans choix`);
    assert.ok(sansChoix.every((s) => s.specialisation_id === null));
    // avec un choix par magie : les communs et ceux des deux spécialisations choisies, rien des autres
    const choisi = M.sortsPossibles(regles, biMagie(niveau, [FEU, FEU_B], [EAU, EAU_A]));
    memes(choisi, jusquAuNpm(deux.filter((s) => !s.specialisation_id || [FEU_B, EAU_A].includes(s.specialisation_id))), `niveau ${niveau} : avec choix`);
    assert.ok(choisi.some((s) => s.specialisation_id === FEU_B) && choisi.some((s) => s.specialisation_id === EAU_A));
    assert.ok(!choisi.some((s) => [FEU_A, EAU_B].includes(s.specialisation_id)), 'les autres spécialisations restent fermées');
    assert.ok(choisi.every((s) => s.niveau <= npm), 'le NPM des sorts borne toujours');
    // un choix pour une seule magie : l'autre n'a aucun sort à spécialisation
    const unSeul = M.sortsPossibles(regles, biMagie(niveau, [FEU, FEU_A]));
    assert.ok(unSeul.some((s) => s.specialisation_id === FEU_A) && !unSeul.some((s) => s.magie_id === EAU && s.specialisation_id));
    // un choix qui n'est pas valable (spécialisation d'une autre magie) n'ouvre rien
    memes(M.sortsPossibles(regles, biMagie(niveau, [FEU, EAU_A])), sansChoix);
    // mono-magie : les deux spécialisations de sa magie, avec ou sans choix noté
    const mono = M.sortsPossibles(regles, fiche(niveau, { magie_innee_id: FEU }));
    memes(mono, jusquAuNpm(sortsDe(FEU)));
    assert.ok(mono.some((s) => s.specialisation_id === FEU_A) && mono.some((s) => s.specialisation_id === FEU_B));
    memes(M.sortsPossibles(regles, fiche(niveau, { magie_innee_id: FEU, ...choix([FEU, FEU_A]) })), mono, 'le choix d’un mono-magie est sans effet');
    // Corruption innée : mono-magie aussi
    assert.ok(M.sortsPossibles(regles, fiche(niveau, { magie_innee_id: CORRUPTION })).some((s) => s.specialisation_id === specialisations(CORRUPTION)[1]));
    // Potentiel Illimité : tous les sorts de toutes les magies, sous le NPM des sorts (R188)
    const pi = fiche(niveau, { magie_innee_id: POTENTIEL_ILLIMITE });
    const piNpm = M.npmDesSorts(regles, pi);
    memes(M.sortsPossibles(regles, pi), regles.sorts.filter((s) => s.niveau <= piNpm));
    if (piNpm >= SEUIL) assert.ok(M.sortsPossibles(regles, pi).some((s) => s.specialisation_id === EAU_B) && M.sortsPossibles(regles, pi).some((s) => s.specialisation_id === FEU_A));
  }
  // avant le seuil : aucun sort à spécialisation, choisie ou non
  const avant = biMagie(niveauSeuil - 1, [FEU, FEU_A], [EAU, EAU_A]);
  assert.ok(M.npmDesSorts(regles, avant) < SEUIL);
  assert.ok(M.sortsPossibles(regles, avant).every((s) => !s.specialisation_id));
});

test('R236 (8) : sortsDesLivres : le bi-magie, seulement les sorts communs et ceux d’une spécialisation choisie, quel que soit le NPM ; livre d’un sort fermé : en attente, hors des magies, jamais refusé', () => {
  const deux = [...sortsDe(FEU), ...sortsDe(EAU)];
  const niveau1 = biMagie(1);   // même au niveau 1 : tous les sorts communs, quel que soit le NPM (R169)
  assert.deepEqual(ids(M.sortsDesLivres(regles, niveau1)), ids(communsOuSpecialises(deux, true)));
  const choisi = biMagie(1, [FEU, FEU_A], [EAU, EAU_B]);
  assert.deepEqual(ids(M.sortsDesLivres(regles, choisi)), ids(sortsDe(FEU, (s) => !s.specialisation_id || s.specialisation_id === FEU_A))
    .concat(ids(sortsDe(EAU, (s) => !s.specialisation_id || s.specialisation_id === EAU_B))));
  // mono-magie et Potentiel Illimité : tous leurs sorts
  assert.deepEqual(ids(M.sortsDesLivres(regles, fiche(1, { magie_innee_id: FEU }))), ids(sortsDe(FEU)));
  assert.equal(M.sortsDesLivres(regles, fiche(1, { magie_innee_id: POTENTIEL_ILLIMITE })).length, regles.sorts.length);
  // un livre sur un sort d'une spécialisation fermée : noté, en attente (le sort n'est pas choisi), hors des magies ; rien n'est refusé
  const ferme = sortsDe(FEU, (s) => s.specialisation_id === FEU_B)[0];
  const ouvert = sortsDe(FEU, (s) => s.specialisation_id === FEU_A)[0];
  const livres = M.livresDe(regles, { ...choisi, livres_sorts: [{ sort_id: ferme.id, rang: 1 }, { sort_id: ouvert.id, rang: 2 }] });
  assert.deepEqual(livres.map((l) => [l.sort_id, l.enAttente, l.horsDesMagies]), [[ferme.id, true, true], [ouvert.id, true, false]]);
});

test('R236 (3), (6) : lignesDeSorts : le sort d’une spécialisation non choisie (ou changée depuis) passe hors des règles, comme R27 ; la liste de la ligne ne le propose plus', () => {
  const niveau = niveauSeuil;
  const sort = sortsDe(FEU, (s) => s.specialisation_id === FEU_A && s.niveau <= M.npmDesSorts(regles, biMagie(niveau)))[0];
  assert.ok(sort, 'un sort de la première spécialisation du Feu à portée');
  const avecSort = (plus) => ({ ...biMagie(niveau, ...plus), sorts: [{ sort_id: sort.id, niveau_maitrise: 0 }] });
  const ligne = (f) => M.lignesDeSorts(regles, f)[0];
  // choisie : en règle ; changée : en rouge, à remplacer ; jamais choisie : en rouge
  assert.equal(ligne(avecSort([[FEU, FEU_A]])).horsDesRegles, false);
  assert.equal(ligne(avecSort([[FEU, FEU_B]])).horsDesRegles, true);
  assert.equal(ligne(avecSort([])).horsDesRegles, true);
  assert.ok(!ligne(avecSort([[FEU, FEU_B]])).choix.some((s) => s.specialisation_id === FEU_A), 'les sorts de l’ancienne ne sont plus proposés');
  assert.ok(ligne(avecSort([[FEU, FEU_B]])).choix.some((s) => s.specialisation_id === FEU_B));
  // le mono-magie : jamais en rouge pour une spécialisation
  assert.equal(ligne({ ...fiche(niveau, { magie_innee_id: FEU }), sorts: [{ sort_id: sort.id, niveau_maitrise: 0 }] }).horsDesRegles, false);
  // un sort commun reste en règle sans aucun choix
  const commun = sortsDe(FEU, (s) => !s.specialisation_id)[0];
  assert.equal(ligne({ ...biMagie(niveau), sorts: [{ sort_id: commun.id, niveau_maitrise: 0 }] }).horsDesRegles, false);
});

test('R236 (3) : choixEnAttente : un choix par magie du bi-magie dès que le NPM des sorts atteint le seuil ; rien choisi à la place du joueur ; ni mono-magie ni Potentiel Illimité', () => {
  const attente = (f) => M.choixEnAttente(regles, f).filter((c) => c.nature === 'specialisation_magie');
  // avant le seuil : rien
  assert.deepEqual(attente(biMagie(niveauSeuil - 1)), []);
  // au seuil : un choix par magie, innée puis acquise, clé de la tuile de la page
  const deux = attente(biMagie(niveauSeuil));
  assert.deepEqual(deux.map((c) => c.cle), [M.cleDeChoix.specialisationMagie(FEU), M.cleDeChoix.specialisationMagie(EAU)]);
  assert.ok(deux[0].libelle.includes(magie(FEU).nom) && deux[1].libelle.includes(magie(EAU).nom), 'chaque libellé nomme sa magie');
  // une fiche d'avant (sans la clé) y tombe, rien n'est posé
  const avant = biMagie(niveauSeuil);
  delete avant.specialisations_magie;
  assert.equal(attente(avant).length, 2);
  assert.deepEqual(M.specialisationsValables(regles, avant), []);
  // un choix fait : l'autre reste ; les deux : plus rien ; un choix pas valable compte pour rien
  assert.deepEqual(attente(biMagie(niveauSeuil, [FEU, FEU_A])).map((c) => c.cle), [M.cleDeChoix.specialisationMagie(EAU)]);
  assert.deepEqual(attente(biMagie(niveauSeuil, [FEU, FEU_A], [EAU, EAU_B])), []);
  assert.equal(attente(biMagie(niveauSeuil, [FEU, EAU_A], [EAU, 'inconnue'])).length, 2);
  // pas de choix pour le mono-magie, le Corruption innée ni le Potentiel Illimité
  for (const innee of [FEU, CORRUPTION, POTENTIEL_ILLIMITE]) assert.deepEqual(attente(fiche(niveauDePuissance(SEUIL + 1), { magie_innee_id: innee })), [], innee);
  // la liste des spécialisations à choisir, pour la page : par magie, avec le choix valable
  const aChoisir = M.specialisationsAChoisir(regles, biMagie(niveauSeuil, [EAU, EAU_B]));
  assert.deepEqual(aChoisir.map((c) => [c.magie.id, c.choix]), [[FEU, null], [EAU, EAU_B]]);
  assert.deepEqual(aChoisir[0].specialisations.map((s) => s.id), specialisations(FEU));
  assert.deepEqual(M.specialisationsAChoisir(regles, biMagie(niveauSeuil - 1)), []);
  // le seuil vient des règles : sans sorts de NPM 3 à spécialisation, le choix attend le NPM suivant
  const sans3 = structuredClone(regles);
  for (const s of sans3.sorts) if (s.niveau === SEUIL) s.specialisation_id = null;
  const f = (niveau) => ({ ...biMagie(niveau), xp: xpDuNiveau(niveau, sans3) });
  assert.deepEqual(M.choixEnAttente(sans3, f(niveauSeuil)).filter((c) => c.nature === 'specialisation_magie'), []);
  assert.equal(M.choixEnAttente(sans3, f(niveauDePuissance(SEUIL + 1, sans3))).filter((c) => c.nature === 'specialisation_magie').length, 2);
});

/** Une classe magique qui n'est pas l'Archimage (réservé au Potentiel Illimité, R23), lue dans les règles. */
const classeMagique = regles.classes.find((c) => c.id !== ARCHIMAGE && M.classeMagique(regles, { classe_id: c.id, specialite_id: null }, 1)).id;
const uneClasse = [{ rang: 1, classe_id: classeMagique, specialite_id: null }];

test('R236 (4) : Super-magie : le mono-magie compte une condition de plus dès le seuil (une classe magique, niveau du seuil : 3 conditions × puissance ; le niveau d’avant : 2 × puissance)', () => {
  const mono = (niveau, plus = {}) => M.emplacementsDeSorts(regles, fiche(niveau, { magie_innee_id: FEU, classes: uneClasse, ...plus }));
  const puissance = M.puissanceMagique(regles, niveauSeuil);
  assert.equal(puissance, SEUIL, 'la puissance du niveau du seuil est le seuil');
  assert.deepEqual(mono(niveauSeuil), { conditions: 3, puissance, total: 3 * puissance, superMagie: true });
  const avant = mono(niveauSeuil - 1);
  assert.deepEqual(avant, { conditions: 2, puissance: M.puissanceMagique(regles, niveauSeuil - 1), total: 2 * M.puissanceMagique(regles, niveauSeuil - 1) });
  assert.ok(avant.puissance < SEUIL);
  // sans classe magique : innée + Super-magie
  assert.equal(M.emplacementsDeSorts(regles, fiche(niveauSeuil, { magie_innee_id: FEU })).conditions, 2);
  // sans magie, pas de Super-magie (rien n'est mono-magie)
  assert.equal(M.emplacementsDeSorts(regles, fiche(niveauSeuil)).conditions, 0);
  // la Corruption innée, mono-magie aussi
  assert.equal(M.emplacementsDeSorts(regles, fiche(niveauSeuil, { magie_innee_id: CORRUPTION })).superMagie, true);
  // plus haut, la condition reste, multipliée par la puissance du niveau
  const haut = mono(niveauDePuissance(SEUIL + 1));
  assert.deepEqual([haut.conditions, haut.total], [3, 3 * haut.puissance]);
  // la ligne de chaque emplacement (R27)
  assert.equal(M.lignesDeSorts(regles, fiche(niveauSeuil, { magie_innee_id: FEU, classes: uneClasse })).length, 3 * puissance);
});

test('R236 (4) : le bi-magie ne gagne rien (sa seconde magie est déjà la condition)', () => {
  const e = M.emplacementsDeSorts(regles, biMagie(niveauSeuil, [FEU, FEU_A]));
  assert.deepEqual(e, { conditions: 2, puissance: SEUIL, total: 2 * SEUIL });
  const avecClasse = M.emplacementsDeSorts(regles, { ...biMagie(niveauSeuil), classes: uneClasse });
  assert.deepEqual([avecClasse.conditions, avecClasse.total, avecClasse.superMagie], [3, 3 * SEUIL, undefined], 'bi-magie, une classe magique : 9 au niveau 8, sans changement');
});

test('R236 (5) : Grimoire et la Super-magie sont la même condition : l’Archimage du Potentiel Illimité de niveau 8 reste à 9 emplacements ; un Potentiel Illimité sans Grimoire gagne une condition', () => {
  const archimage = (niveau) => fiche(niveau, { magie_innee_id: POTENTIEL_ILLIMITE, mode_classe: 'mono', classes: [{ rang: 1, classe_id: ARCHIMAGE, specialite_id: null }] });
  const grimoire = (f) => M.donsAcquis(regles, f).flatMap((c) => c.dons).some((d) => d.condition_emplacements);
  assert.ok(grimoire(archimage(niveauSeuil)), 'le niveau 8 est assez haut pour « Grimoire »');
  // innée + classe magique + Grimoire = 3 conditions, pas 4 (R236 (5), MAJ-F3c)
  const avecGrimoire = M.emplacementsDeSorts(regles, archimage(niveauSeuil));
  assert.deepEqual([avecGrimoire.conditions, avecGrimoire.total, avecGrimoire.superMagie], [3, 3 * SEUIL, undefined], '9 emplacements, pas 12');
  // avant le seuil, Grimoire compte déjà (R189), la Super-magie pas encore
  const avant = archimage(niveauSeuil - 1);
  assert.ok(grimoire(avant));
  assert.equal(M.emplacementsDeSorts(regles, avant).conditions, 3);
  // sans le don (règles sans le marqueur), le Potentiel Illimité d'Archimage gagne la condition de la Super-magie : le même nombre
  const sansDon = structuredClone(regles);
  for (const d of sansDon.classes.find((c) => c.id === ARCHIMAGE).dons) delete d.condition_emplacements;
  const sansGrimoire = M.emplacementsDeSorts(sansDon, archimage(niveauSeuil));
  assert.deepEqual([sansGrimoire.conditions, sansGrimoire.superMagie], [3, true]);
  assert.equal(M.emplacementsDeSorts(sansDon, archimage(niveauSeuil - 1)).conditions, 2, 'avant le seuil, sans Grimoire : innée + classe');
  // Potentiel Illimité sans classe (donc sans Grimoire) : une condition de plus au seuil
  const nu = (niveau) => M.emplacementsDeSorts(regles, fiche(niveau, { magie_innee_id: POTENTIEL_ILLIMITE }));
  assert.deepEqual([nu(niveauSeuil - 1).conditions, nu(niveauSeuil).conditions, nu(niveauSeuil).superMagie], [1, 2, true]);
});

// ------------------------------------------------------------------------------------------------------------------------------------------------
// R248 : Projectile arcanique
// ------------------------------------------------------------------------------------------------------------------------------------------------

const projectile = M.trouver(regles.sorts, PROJECTILE);
const auNm = (s, nm = 0) => Object.fromEntries(['cout', 'portee', 'dsb', 'effets'].map((c) => [c, valeurAuNm(s[c], s.bonus ?? [], c, nm) ?? '']));
const coutDuProjectile = (fois, f = fiche(niveauSeuil, { magie_innee_id: 'magies/magie-de-larcane' }), sort = projectile) =>
  M.sortDuMoment(regles, f, sort, auNm(sort), undefined, { fois }).cout;

test('R248 : le coût d’un sort « N/<unité> » dont le coût secondaire est « +K au coût de chaque <unité> supplémentaire » se lit dans les données, sans l’id du sort', () => {
  assert.ok(projectile, 'Projectile arcanique, par son id figé');
  const m = M.multiplicateurDuCout(projectile);
  assert.equal(m.progressif.pas, 1, 'R251 : « +1 au coût de chaque projectile supplémentaire »');
  assert.deepEqual([m.creature, m.npm], [false, false]);
  assert.equal(m.unite, 'projectile');
  // un autre sort écrit pareil, sous un autre id, d'une autre unité et d'un autre pas : le même calcul
  const autre = { ...projectile, id: 'x', cout: '6/tir', cout_secondaire: '+2 au coût de chaque tir supplémentaire.' };
  assert.deepEqual(M.multiplicateurDuCout(autre).progressif, { pas: 2 });
  // l'unité du coût secondaire doit être celle du coût ; un coût sans unité, un taux au NM, un coût secondaire d'une autre forme : rien
  assert.equal(M.multiplicateurDuCout({ ...projectile, cout_secondaire: '+1 au coût de chaque tir supplémentaire.' }), null);
  assert.equal(M.multiplicateurDuCout({ ...projectile, cout: '4' }), null);
  assert.equal(M.multiplicateurDuCout({ ...projectile, cout: '5/NM' }), null);
  assert.equal(M.multiplicateurDuCout({ ...projectile, cout_secondaire: null }), null);
  assert.equal(M.multiplicateurDuCout({ ...projectile, cout_secondaire: '1 Âme' }), null);
  // bornes : au moins 1, au plus FOIS_MAX (la borne de saisie des autres coûts par unité)
  const bornes = M.bornesDuMultiplicateur(regles, fiche(niveauSeuil, { magie_innee_id: 'magies/magie-de-larcane' }), projectile);
  assert.equal(bornes.min, 1);
  assert.ok(bornes.max > 10, 'dix projectiles se règlent');
  assert.equal(bornes.max, M.bornesDuMultiplicateur(regles, ficheVide(), { ...projectile, cout_secondaire: 'Par personne' }).max, 'la même borne que les autres coûts par unité');
});

test('R248 : N projectiles coûtent 4 + 5 + … + (N + 3) : 4, 9, 15… et 85 pour dix ; les réductions s’appliquent au total, jamais à chaque projectile', () => {
  const base = Number(/^\d+/.exec(projectile.cout)[0]);
  assert.equal(base, 4, 'R251 : « 4/projectile »');
  const attendu = { 1: 4, 2: 9, 3: 15, 4: 22, 10: 85 };
  for (const [n, total] of Object.entries(attendu)) {
    const c = coutDuProjectile(Number(n));
    assert.equal(c.texte, String(total), `${n} projectile(s)`);
    assert.equal(c.fois.n, Number(n));
    assert.equal(c.fois.progressif.total, total);
    assert.equal(M.coutProgressifDe(4, 1, Number(n)), total);
    assert.deepEqual(c.detail, [], 'sans réduction');
  }
  // sans choix : un projectile
  assert.equal(coutDuProjectile(undefined).texte, '4');
  // bornes : au moins 1, un nombre entier, au plus la borne de saisie
  const max = M.bornesDuMultiplicateur(regles, fiche(niveauSeuil, { magie_innee_id: 'magies/magie-de-larcane' }), projectile).max;
  for (const fois of [0, -3, NaN, 'x']) assert.equal(coutDuProjectile(fois).fois.n, 1, String(fois));
  assert.equal(coutDuProjectile('2.7').fois.n, 2, 'tronqué');
  assert.equal(coutDuProjectile(max + 50).fois.n, max);
  // le pas vient des données
  assert.equal(coutDuProjectile(3, undefined, { ...projectile, cout_secondaire: '+2 au coût de chaque projectile supplémentaire.' }).texte, String(4 + 6 + 8));
  // le texte d'écriture n'est plus lu comme un coût chiffré : pas de « non chiffré »
  const sort = M.sortDuMoment(regles, fiche(niveauSeuil, { magie_innee_id: 'magies/magie-de-larcane' }), projectile, auNm(projectile), undefined, { fois: 3 });
  assert.ok(!sort.nonComptes.some((x) => x.raison === 'non_chiffre' && x.cible === 'cout'));
  // une réduction (le bâton d'Arcane de rang 3 : « Coût sort -3 ») sur le total : 85 − 3 = 82, pas 85 − 30 ; jamais moins de 1
  const baton = M.trouver(regles.ceinture.batons, BATON_ARCANE_3);
  const reduction = baton.effets.find((e) => e.cle === 'cout').valeur;
  assert.ok(reduction < 0);
  const avecBaton = fiche(niveauSeuil, { magie_innee_id: 'magies/magie-de-larcane', ceinture: [{ rang: 1, nom: baton.nom, quantite: 1, ressource_id: null }] });
  for (const [n, total] of Object.entries(attendu)) {
    const c = coutDuProjectile(Number(n), avecBaton);
    assert.equal(c.texte, String(Math.max(Math.min(total, 1), total + reduction)), `${n} projectile(s), avec le bâton`);
    assert.deepEqual(c.detail.map((d) => d.valeur), [reduction], 'une seule réduction, sur le total');
  }
  assert.equal(coutDuProjectile(10, avecBaton).texte, '82');
  assert.equal(coutDuProjectile(1, avecBaton).texte, '1');
});

test('R248 : l’autre coût par unité (R129) est inchangé : « × N » du coût écrit, sans progression', () => {
  const unites = regles.sorts.filter((s) => M.multiplicateurDuCout(s) && !M.multiplicateurDuCout(s).progressif);
  assert.ok(unites.length > 0);
  for (const s of unites) {
    const c = M.sortDuMoment(regles, fiche(niveauSeuil, { magie_innee_id: s.magie_id }), s, auNm(s), undefined, { fois: 2 }).cout;
    if (c.fois) assert.ok(!('progressif' in c.fois), s.id);
  }
});

// ------------------------------------------------------------------------------------------------------------------------------------------------
// La page (src/scripts/fiche.mjs, lue comme un texte) : le choix de chaque magie, l'enregistrement
// ------------------------------------------------------------------------------------------------------------------------------------------------

test('page : un choix de spécialisation par magie dans le panneau « Choix » (clé de la tuile du tiroir), nettoyé à l’enregistrement ; la liste des sorts suit le choix', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const astro = readFileSync(new URL('../src/pages/fiche/index.astro', import.meta.url), 'utf8');
  const corps = script.slice(script.indexOf('function construireChoixSpecialisationsMagie()'), script.indexOf('function construireChoixEnAttente()'));
  assert.match(corps, /specialisationsAChoisir\(regles, fiche\)/);
  assert.match(corps, /cadre\.dataset\.choixCle = cle;/, 'la tuile du tiroir (data-choix-cle = la clé de choixEnAttente)');
  assert.match(corps, /const cle = cleDeChoix\.specialisationMagie\(c\.magie\.id\);/);
  assert.match(corps, /fiche\.specialisations_magie = specialisationsApresChoix\(regles, fiche, c\.magie\.id, s\.id\);\s*changer\(\);/, 'modifiable à tout moment');
  assert.match(script, /f\.specialisations_magie = specialisationsValables\(regles, f\);/, 'aEnvoyer nettoie la liste');
  assert.match(script, /^  construireChoixSpecialisationsMagie\(\);$/m, 'refaite à chaque rafraîchissement');
  assert.match(astro, /<div id="choix-specialisations-magie" class="choix-specialites" hidden><\/div>/);
  // la liste des sorts est reconstruite quand le choix change
  assert.match(script, /specialisationsValables\(regles, fiche\)\]\);\s*\n\s*reconstruire\(\$\('sorts'\)/);
  // la Super-magie est dite dans le détail des emplacements
  assert.match(script, /emplacements\.superMagie \? ', dont la Super-magie' : ''/);
});
