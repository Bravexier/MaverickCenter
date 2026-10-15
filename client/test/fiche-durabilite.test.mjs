// Solidité du moment des armes de la fiche (décision R74 : « Un slider qui va de 0 au max de l'arme. A zéro, l'arme est cassée ») : le maximum est
// celui de l'arme forgée de la page « Armes » (décision R51 : arme + matériau + amélioration, au moins 1). Le moteur de la fiche (lib/fiche-moteur.mjs)
// ne peut pas importer lib/arme-forge.mjs (le script de la page Armes l'importe : deux scripts de page ne partagent jamais un module) : il en recopie le
// calcul, comparé ici à forgerArme sur TOUTES les combinaisons de la base (arme de la page × matériau ou aucun × amélioration 0 à 10), l'arme lue par
// lib/armes-db.mjs et lib/arme-champs.mjs (la chaîne de la page), pas dans les règles de la fiche. Puis : armes de monstres sans solidité, bornage,
// arme cassée, choix d'une autre arme, d'une autre composition ou amélioration, et l'aller-retour par le service.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { durabiliteDeLArme } from '../src/lib/arme-champs.mjs';
import { DURABILITE_MIN, forgerArme } from '../src/lib/arme-forge.mjs';
import { chargerArmes, contexteDesArmes } from '../src/lib/armes-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  armesApresChoix, armesApresReglage, armesValables, degatsDArme, durabiliteAEcrire, durabiliteDArme, durabiliteMaxDArme,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const page = chargerArmes(db);
const soliditeDeBase = contexteDesArmes(db).soliditeDesArmes;
const armesDeLaPage = page.familles.flatMap((f) => f.armes);
const ameliorationsDArme = regles.ameliorations.filter((a) => a.cible === 'arme');

/** Une arme de la page, un matériau et une amélioration, choisis dans les règles d'après ce qu'ils donnent (rien de la base en dur). */
const armeDeBase = regles.armes.find((a) => a.solidite !== null && a.solidite >= 2);
const sansCran = regles.materiaux_armes.find((m) => !m.cran_solidite);
const avecCran = regles.materiaux_armes.find((m) => m.cran_solidite > 0);
const ameliorationAvecCran = ameliorationsDArme.find((a) => a.bonus_cran > 0);
const ligne = (surcharge = {}) => ({ rang: 1, arme_id: armeDeBase.id, materiau_id: sansCran.id, ...surcharge });

test('les règles de la fiche : la solidité de l’arme nue (null pour une arme de monstre), les crans des matériaux et des améliorations, le minimum de R51', () => {
  assert.equal(regles.constantes['arme.durabilite_min'], DURABILITE_MIN);
  const avecSolidite = new Set(regles.armes.filter((a) => a.solidite !== null).map((a) => a.id));
  assert.deepEqual([...avecSolidite].sort(), armesDeLaPage.map((a) => a.id).sort(), 'exactement les armes de la page Armes (sans les armes de monstres, R45)');
  const monstres = regles.armes.filter((a) => regles.familles_armes.find((f) => f.id === a.famille_id)?.maitrisable === false);
  assert.ok(monstres.length > 0 && monstres.every((a) => a.solidite === null), 'une arme de monstre n’a pas de solidité');
  for (const a of armesDeLaPage) assert.equal(regles.armes.find((x) => x.id === a.id).solidite, durabiliteDeLArme(a, soliditeDeBase), a.id);
  for (const m of page.materiaux) assert.equal(regles.materiaux_armes.find((x) => x.id === m.ligne.ressource_id).cran_solidite, m.ligne.cran_solidite, m.nom);
  for (const a of page.ameliorations) assert.equal(regles.ameliorations.find((x) => x.id === a.id).bonus_cran, a.bonus_cran, a.id);
  assert.ok(armeDeBase && sansCran && avecCran && ameliorationAvecCran, 'une arme d’au moins 2 crans, un matériau sans cran, un avec, une amélioration qui en donne');
});

test('maximum de la fiche = durabilité de l’arme forgée de la page Armes (lib/arme-forge.mjs), sur toutes les combinaisons de la base', () => {
  let combinaisons = 0;
  let plancher = 0;
  const totaux = new Set();
  for (const a of armesDeLaPage) {
    const arme = { de: 'D10', bonus_degats: a.bonus_degats, durabilite: durabiliteDeLArme(a, soliditeDeBase ?? 0), cout_ro: 0 };
    for (const m of [null, ...page.materiaux]) {
      for (let niveau = 0; niveau <= 10; niveau += 1) {
        const attendu = forgerArme(arme, m && { ...m.ligne, nom: m.nom }, page.ameliorations, niveau).durabilite;
        const amelioration = page.ameliorations.find((x) => x.niveau === niveau);
        const l = { rang: 1, arme_id: a.id, materiau_id: m?.ligne.ressource_id ?? null, amelioration_id: niveau ? amelioration.id : null };
        assert.equal(durabiliteMaxDArme(regles, l), attendu.total, `${a.nom}, ${m?.nom ?? 'sans matériau'}, +${niveau}`);
        const d = durabiliteDArme(regles, { armes: [l] }, 1);
        assert.equal(d.max, attendu.total);
        assert.equal(d.actuelle, attendu.total, 'sans valeur enregistrée : à son maximum');
        assert.equal(d.cassee, false);
        assert.equal(d.plancher, attendu.arme + attendu.materiau + attendu.amelioration < attendu.total, 'le minimum de R51 est dit');
        assert.equal(d.detail.reduce((s, c) => s + c.valeur, 0), attendu.arme + attendu.materiau + attendu.amelioration, 'le détail : arme, composition, amélioration');
        combinaisons += 1;
        if (d.plancher) plancher += 1;
        totaux.add(attendu.total);
      }
    }
  }
  assert.equal(combinaisons, armesDeLaPage.length * (page.materiaux.length + 1) * 11);
  assert.ok(Math.min(...totaux) >= DURABILITE_MIN);
  assert.ok(plancher > 0, 'des combinaisons ramenées au minimum (Fonte sur une arme à 1 cran…)');
});

test('arme de monstre, pas d’arme : pas de solidité, rien d’enregistré', () => {
  const monstre = regles.armes.find((a) => a.solidite === null);
  assert.equal(durabiliteMaxDArme(regles, { rang: 1, arme_id: monstre.id, materiau_id: sansCran.id }), null);
  assert.equal(durabiliteDArme(regles, { armes: [{ rang: 1, arme_id: monstre.id, durabilite: 0 }] }, 1), null);
  assert.equal(durabiliteAEcrire(regles, { rang: 1, arme_id: monstre.id }, 0), null);
  assert.equal(durabiliteDArme(regles, { armes: [] }, 1), null);
  assert.equal(durabiliteDArme(regles, { armes: [ligne()] }, 2), null, 'pas d’arme 2');
  assert.equal(durabiliteMaxDArme(regles, null), null);
});

test('bornage : de 0 au maximum ; au maximum ou au-delà, rien d’enregistré (à son maximum) ; à 0, l’arme est cassée', () => {
  const max = durabiliteMaxDArme(regles, ligne());
  assert.equal(max, armeDeBase.solidite);
  const etat = (durabilite) => durabiliteDArme(regles, { armes: [ligne({ durabilite })] }, 1);
  assert.deepEqual([etat(null).actuelle, etat(undefined).actuelle, etat('').actuelle], [max, max, max], 'sans valeur : à son maximum');
  assert.equal(etat(max + 3).actuelle, max, 'au-delà : le maximum');
  assert.equal(etat(max - 1).actuelle, max - 1);
  assert.equal(etat(-1).actuelle, 0);
  assert.equal(etat(0).cassee, true, '« A zéro, l’arme est cassée »');
  assert.equal(etat(1).cassee, false);
  const ecrire = (v) => durabiliteAEcrire(regles, ligne(), v);
  assert.deepEqual([ecrire(max), ecrire(max + 3), ecrire(String(max))], [null, null, null], 'à son maximum : rien d’enregistré');
  assert.deepEqual([ecrire(0), ecrire('0'), ecrire(-2), ecrire(max - 1), ecrire(max - 1.4)], [0, 0, 0, max - 1, max - 1]);
  assert.deepEqual([ecrire(null), ecrire(undefined), ecrire(''), ecrire('abc')], [null, null, null, null], 'sans valeur ou illisible : à son maximum');
});

test('une arme cassée garde ses dégâts (la pastille dit « Cassée », ses dégâts en infobulle) : degatsDArme ne change pas', () => {
  const fiche = { ...ficheVide('Essai'), armes: [ligne()] };
  const intacte = degatsDArme(regles, fiche, 1);
  const cassee = degatsDArme(regles, { ...fiche, armes: [ligne({ durabilite: 0 })] }, 1);
  assert.deepEqual(cassee, intacte);
});

test('une autre arme est neuve ; une autre composition ou amélioration ramène la solidité sous son nouveau maximum (une arme pleine le reste)', () => {
  const autre = regles.armes.find((a) => a.solidite !== null && a.id !== armeDeBase.id);
  const fiche = { armes: [ligne({ durabilite: 0 })] };
  const apres = armesApresChoix(regles, fiche, 1, autre.id)[0];
  assert.ok(!('durabilite' in apres), 'la clé disparaît (pas null) : une autre arme est à son maximum');
  assert.equal(armesApresChoix(regles, fiche, 1, armeDeBase.id)[0].durabilite, 0, 'la même arme garde ses crans');
  assert.deepEqual(armesApresChoix(regles, fiche, 1, null), [], 'plus d’arme');

  // avec le matériau qui donne des crans, abîmée d'un cran ; puis sans lui : son maximum baisse, elle est pleine
  const max = durabiliteMaxDArme(regles, ligne({ materiau_id: avecCran.id }));
  assert.equal(max, armeDeBase.solidite + avecCran.cran_solidite);
  const abimee = { armes: [ligne({ materiau_id: avecCran.id, durabilite: max - 1 })] };
  const sans = armesApresReglage(regles, abimee, 1, 'materiau_id', sansCran.id)[0];
  assert.equal(sans.materiau_id, sansCran.id);
  assert.equal(sans.durabilite, max - 1 >= armeDeBase.solidite ? null : max - 1);
  // très abîmée : ses crans tiennent sous le nouveau maximum, elle les garde
  const tres = armesApresReglage(regles, { armes: [ligne({ materiau_id: avecCran.id, durabilite: 1 })] }, 1, 'materiau_id', sansCran.id)[0];
  assert.equal(tres.durabilite, armeDeBase.solidite > 1 ? 1 : null);
  // pleine : elle le reste avec une amélioration qui donne des crans, et sans
  const pleine = armesApresReglage(regles, { armes: [ligne()] }, 1, 'amelioration_id', ameliorationAvecCran.id)[0];
  assert.ok(!('durabilite' in pleine), 'sans valeur, elle suit son maximum');
  assert.equal(durabiliteDArme(regles, { armes: [pleine] }, 1).actuelle, armeDeBase.solidite + ameliorationAvecCran.bonus_cran);
  const pleineNulle = armesApresReglage(regles, { armes: [ligne({ amelioration_id: ameliorationAvecCran.id, durabilite: null })] }, 1, 'amelioration_id', null)[0];
  assert.equal(pleineNulle.durabilite, null);
  // l'élément et l'effet en plus ne touchent pas la solidité ; l'autre arme ne bouge pas
  const deux = { armes: [ligne({ durabilite: 1 }), { rang: 2, arme_id: armeDeBase.id, durabilite: 0 }] };
  const element = armesApresReglage(regles, deux, 1, 'arme_elementaire_id', regles.armes_elementaires[0].id);
  assert.equal(element[0].durabilite, 1);
  assert.equal(element[1], deux.armes[1]);
  assert.deepEqual(armesApresReglage(regles, { armes: [] }, 1, 'materiau_id', sansCran.id), [], 'sans arme, rien ne change');
});

test('à l’enregistrement : chaque solidité bornée à son maximum (armesValables), une ligne sans solidité inchangée', () => {
  const max = durabiliteMaxDArme(regles, ligne());
  const monstre = regles.armes.find((a) => a.solidite === null);
  const armes = armesValables(regles, { armes: [ligne({ durabilite: max + 2 }), { rang: 2, arme_id: monstre.id, durabilite: 0 }] });
  assert.deepEqual(armes.map((a) => a.durabilite), [null, null]);
  assert.deepEqual(armesValables(regles, { armes: [ligne({ durabilite: 0 })] })[0].durabilite, 0);
  const sansCle = ligne();
  assert.equal(armesValables(regles, { armes: [sansCle] })[0], sansCle, 'pas de clé ajoutée');
  assert.deepEqual(armesValables(regles, {}), []);
});

const racine = mkdtempSync(join(tmpdir(), 'maverick-durabilite-'));
after(() => rmSync(racine, { recursive: true, force: true }));

test('le service garde la solidité du moment : 0 (cassée), un cran, ou rien (à son maximum)', () => {
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);
  const fiche = { ...ficheVide('Solidité'), armes: [ligne({ durabilite: 0 }), { rang: 2, arme_id: armeDeBase.id, durabilite: 1 }] };
  const { personnage } = enregistrerFiche(vivante, { ...fiche, armes: armesValables(regles, fiche) });
  const relue = lireFiche(vivante, personnage.id);
  assert.deepEqual(relue.armes.map((a) => [a.rang, a.durabilite]), [[1, 0], [2, armeDeBase.solidite > 1 ? 1 : null]]);
  assert.equal(durabiliteDArme(regles, relue, 1).cassee, true);
  const autre = regles.armes.find((a) => a.solidite !== null && a.id !== armeDeBase.id);
  const neuve = enregistrerFiche(vivante, { ...fiche, armes: armesValables(regles, { armes: armesApresChoix(regles, fiche, 1, autre.id) }) }).personnage;
  assert.equal(neuve.armes.find((a) => a.rang === 1).durabilite, null, 'une autre arme : à son maximum');
  vivante.close();
});
