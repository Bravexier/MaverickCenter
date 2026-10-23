// Les accessoires sur la fiche de personnage (demande du propriétaire : « l'accessoire influe sur le reste de la fiche » ; décision R54 ; table
// accessoire_effet_cible) : caractéristique +1 plafonnée, compétence choisie, attributs, armure de base, dégâts des armes et des sorts, maîtrise,
// résistances, Mode Hyper, malédiction (effet contraire), choix en attente, effets « (Action) » et usages comptés rappelés sous les dons de race, et
// l'enregistrement des choix dans la base.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { CIBLES } from '../src/lib/accessoire-champs.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  accessoiresDesSorts, actionsDesAccessoires, attributsDe, caracteristiquesDe, choixEnAttente, competencesDe, degatsDArme, effetsDesAccessoires, modeHyperDe,
  compteurDeMaitrise, resistancesDe,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db)));
const racine = dossierTemporaire('accessoires');
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);

const E = (id) => `ressources/accessoires#effet:${id}`;
const porte = (emplacement, effet, autres = {}) => ({ emplacement, accessoire_effet_id: E(effet), valeur: null, maudit: 0, ...autres });

/** Humain central, Feu inné (Social), Guerrier ; Force 4, le reste à 2. */
function fiche(accessoires = [], surcharge = {}) {
  return {
    ...ficheVide('Essai'),
    race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }],
    caracteristiques: Object.entries({ force: 4, volonte: 2, intelligence: 2, perception: 2, social: 2, agilite: 2 }).map(([caracteristique_id, base]) => ({ caracteristique_id, base, croix: 0 })),
    competences: [{ competence_id: 'arme-lourde', naturel: 20 }],
    accessoires,
    ...surcharge,
  };
}
const carac = (f, id) => caracteristiquesDe(regles, f).find((c) => c.id === id);
const comp = (f, id) => competencesDe(regles, f).find((c) => c.id === id);

test('les règles portent ce que chaque effet change (accessoire_effet_cible) et son usage', () => {
  const force = regles.accessoires.find((a) => a.id === E('caracteristique:force'));
  assert.deepEqual(force.effets, [{ cible: 'caracteristique', cible_id: 'force', valeur: 1, choix: false }]);
  assert.equal(regles.accessoires.find((a) => a.id === E('autre:13')).usage, 'action');
  assert.equal(regles.constantes['accessoire.caracteristique_max'], 4);
});

test('caractéristique : +1, sans dépasser 4 ni la borne de la race ; maudit, −1 ; le score des compétences suit', () => {
  assert.deepEqual([carac(fiche([porte('chef', 'caracteristique:volonte')]), 'volonte').valeur, carac(fiche(), 'volonte').valeur], [3, 2]);
  const force = carac(fiche([porte('chef', 'caracteristique:force')]), 'force');
  assert.deepEqual([force.valeur, force.accessoire, force.accessoireBrut], [4, 0, 1], 'déjà à 4 : rien');
  assert.equal(carac(fiche([porte('chef', 'caracteristique:force', { maudit: 1 })]), 'force').valeur, 3);
  const lourde = comp(fiche([porte('chef', 'caracteristique:force', { maudit: 1 })]), 'arme-lourde');
  assert.equal(lourde.score, 3 * 10 + 20 + lourde.acquis, 'l’acquis (les dons du Guerrier : décision R104) n’y change rien');
});

test('compétence : la valeur tirée en Acquis de la compétence choisie, de la bonne caractéristique, rognée au plafond ; sinon un choix en attente', () => {
  const bonne = fiche([porte('collier', 'competence:force:2', { valeur: 7, competence_id: 'arme-lourde' })]);
  // (les dons du Guerrier qui donnent de l'acquis en Arme lourde passent avant l'accessoire : décision R104)
  const dons = comp(bonne, 'arme-lourde').dons;
  assert.deepEqual([comp(bonne, 'arme-lourde').accessoire, comp(bonne, 'arme-lourde').score], [7, 4 * 10 + 20 + dons + 7]);
  assert.equal(comp(bonne, 'arme-lourde').acquis, dons + 7);
  assert.deepEqual(choixEnAttente(regles, bonne).filter((c) => c.nature === 'accessoire'), []);
  const mauvaise = fiche([porte('collier', 'competence:force:2', { valeur: 7, competence_id: 'esquive' })]);
  assert.ok(competencesDe(regles, mauvaise).every((c) => c.accessoire === 0));
  assert.deepEqual(choixEnAttente(regles, mauvaise).filter((c) => c.nature === 'accessoire').map((c) => c.cle), ['accessoire:collier']);
  // plafond : 5 par point de Force (4) = 20 ; deux accessoires (18 + 16) rognés à ce que les dons laissent : le plafond prévaut (comme pour le métier, R38)
  const pleine = fiche([porte('collier', 'competence:force:4', { valeur: 18, competence_id: 'arme-lourde' }), porte('chef', 'competence:force:4', { valeur: 16, competence_id: 'arme-lourde' })]);
  assert.deepEqual([comp(pleine, 'arme-lourde').accessoireBrut, comp(pleine, 'arme-lourde').accessoire, comp(pleine, 'arme-lourde').acquis], [34, 20 - dons, 20]);
  const maudite = fiche([porte('collier', 'competence:force:2', { valeur: 7, competence_id: 'arme-lourde', maudit: 1 })]);
  assert.equal(comp(maudite, 'arme-lourde').accessoire, -7);
});

test('attributs : santé, initiative, vitesse, AP et AM de base, 4ᵉ barre ; maudit, en moins', () => {
  const a0 = attributsDe(regles, fiche());
  const a = attributsDe(regles, fiche([porte('chef', 'attributs:7'), porte('collier', 'attributs:9'), porte('bague-1', 'defense:14'), porte('bague-2', 'defense:7'), porte('bracelet-1', 'attributs:5', { maudit: 1 })]));
  assert.equal(a.initiativeBonus, a0.initiativeBonus + 5);
  assert.equal(a.vitesseSol, a0.vitesseSol + 1);
  assert.deepEqual([a.ap - a0.ap, a.am - a0.am], [5, 5]);
  assert.equal(a.sante, a0.sante - 5);
  const sang = fiche([porte('chef', 'attributs:8')], { magie_innee_id: 'magies/magie-du-sang' });
  const sansAcc = attributsDe(regles, { ...sang, accessoires: [] }).quatriemeBarre;
  assert.ok(sansAcc, 'la magie du Sang a une 4ᵉ barre');
  assert.equal(attributsDe(regles, sang).quatriemeBarre.max, sansAcc.max + 2);
});

test('dégâts : physiques sur toutes les armes, +5 sur la famille choisie ; magie sur les sorts d’attaque ; portée des sorts', () => {
  const armeEpee = regles.armes.find((x) => x.famille_id === 'epees');
  const armes = [{ rang: 1, arme_id: armeEpee.id, materiau_id: null }];
  const sans = degatsDArme(regles, fiche([], { armes }), 1);
  const avec = degatsDArme(regles, fiche([porte('chef', 'attaque:1'), porte('collier', 'attaque:15', { arme_famille_id: 'epees' })], { armes }), 1);
  assert.equal(avec.total, sans.total + 2 + 5);
  const autreFamille = degatsDArme(regles, fiche([porte('collier', 'attaque:15', { arme_famille_id: 'dagues' })], { armes }), 1);
  assert.equal(autreFamille.total, sans.total);
  assert.deepEqual(choixEnAttente(regles, fiche([porte('collier', 'attaque:15')], { armes })).filter((c) => c.nature === 'accessoire').length, 1);
  const s = accessoiresDesSorts(regles, fiche([porte('chef', 'attaque:20'), porte('collier', 'attaque:17')]));
  assert.deepEqual([s.degats, s.portee], [5, 1]);
  assert.ok(regles.sorts.some((x) => x.attaque) && regles.sorts.some((x) => !x.attaque), 'sorts d’attaque repérés (sort_type)');
});

test('maîtrise d’arme, Mode Hyper, résistances (maudit : vulnérabilité)', () => {
  const avec = fiche([porte('chef', 'attaque:7'), porte('collier', 'attaque:8'), porte('bague-1', 'defense:5')]);
  // l'accessoire « Un point de maîtrise d'arme » (décision R54) : un point de plus, à choisir (R151)
  assert.deepEqual(compteurDeMaitrise(regles, avec), { ...compteurDeMaitrise(regles, fiche()), points: compteurDeMaitrise(regles, fiche()).points + 1, aChoisir: compteurDeMaitrise(regles, fiche()).aChoisir + 1 });
  assert.equal(modeHyperDe(regles, avec).toursAccessoires, 1);
  const crans = (f, id) => resistancesDe(regles, f).paliers.flatMap((p) => p.cibles).find((c) => c.id === id)?.crans ?? 0;
  assert.equal(crans(avec, 'magies/magie-du-feu') - crans(fiche(), 'magies/magie-du-feu'), 1);
  const maudit = fiche([porte('bague-1', 'defense:5', { maudit: 1 })]);
  assert.equal(crans(maudit, 'magies/magie-du-feu') - crans(fiche(), 'magies/magie-du-feu'), -1);
});

test('rappel sous les dons de race : les effets « (Action) » et à usage compté, pas les autres', () => {
  // un accessoire n'a plus de nom donné (décision R97) : son emplacement le nomme
  const f = fiche([porte('chef', 'autre:13'), porte('collier', 'autre:16'), porte('bague-1', 'attaque:1')]);
  assert.deepEqual(actionsDesAccessoires(regles, f), [
    { nom: 'Accessoire : Chef', type: 'action', texte: 'Permet de respirer sous l\'eau pendant 1 heure (1 semaine de recharge)', maudit: false },
    { nom: 'Accessoire : Collier', type: null, texte: 'Rend Invisible pendant un tour (1 fois par combat)', maudit: false },
  ]);
});

test('les choix (compétence, famille d’armes) s’enregistrent dans la base sans contrôle en plus', () => {
  const f = fiche([porte('collier', 'competence:force:2', { valeur: 7, competence_id: 'arme-lourde' }), porte('chef', 'attaque:15', { arme_famille_id: 'epees' })]);
  const { personnage, controles } = enregistrerFiche(vivante, f);
  assert.deepEqual(controles.filter((c) => c.regle.startsWith('accessoire')), []);
  const lignes = vivante.prepare('SELECT emplacement, competence_id, arme_famille_id FROM personnage_accessoire WHERE personnage_id = ? ORDER BY emplacement').all(personnage.id).map((l) => ({ ...l }));
  assert.deepEqual(lignes, [{ emplacement: 'chef', competence_id: null, arme_famille_id: 'epees' }, { emplacement: 'collier', competence_id: 'arme-lourde', arme_famille_id: null }]);
  assert.equal(effetsDesAccessoires(regles, f).length, 2);
});

test('la page dit en mots chaque cible d’un effet d’accessoire, jamais son identifiant (« cran_des_sorts +1 »)', () => {
  const page = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const bloc = /const NOMS_DES_CIBLES = \{([\s\S]*?)\n\};/.exec(page)?.[1];
  assert.ok(bloc, 'NOMS_DES_CIBLES introuvable dans src/scripts/fiche.mjs');
  const nommees = new Set([...bloc.matchAll(/(\w+): '/g)].map((m) => m[1]));
  // texteDEffet nomme ces quatre-là d'après la base (caractéristique, compétence, famille d'armes, magie ou altération)
  const parLaBase = new Set(['caracteristique', 'competence', 'degats_famille', 'resistance']);
  assert.deepEqual(CIBLES.filter((c) => !parLaBase.has(c) && !nommees.has(c)), []);
  // et chaque cible que les règles portent est de la liste
  const portees = new Set(regles.accessoires.flatMap((a) => (a.effets ?? []).map((e) => e.cible)));
  assert.deepEqual([...portees].filter((c) => !CIBLES.includes(c)), []);
});
