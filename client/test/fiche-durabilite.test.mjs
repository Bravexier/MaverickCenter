// Solidité du moment des armes de la fiche (décision R74 : « Un slider qui va de 0 au max de l'arme. A zéro, l'arme est cassée ») : le maximum est
// celui de l'arme forgée de la page « Armes » (décision R51 : arme + matériau + amélioration, au moins 1). Le moteur de la fiche (lib/fiche-moteur.mjs)
// ne peut pas importer lib/arme-forge.mjs (le script de la page Armes l'importe : deux scripts de page ne partagent jamais un module) : il en recopie le
// calcul, comparé ici à forgerArme sur TOUTES les combinaisons de la base (arme de la page × matériau ou aucun × amélioration 0 à 10), l'arme lue par
// lib/armes-db.mjs et lib/arme-champs.mjs (la chaîne de la page), pas dans les règles de la fiche. Puis : armes de monstres sans solidité, bornage,
// arme cassée, les crans perdus dans les dégâts avec Vieille Branche (décision R107), choix d'une autre arme, d'une autre composition ou amélioration,
// et l'aller-retour par le service.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { durabiliteDeLArme } from '../src/lib/arme-champs.mjs';
import { DURABILITE_MIN, forgerArme, forgerArmeElementaire } from '../src/lib/arme-forge.mjs';
import { chargerArmes, contexteDesArmes } from '../src/lib/armes-db.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  armesApresChoix, armesApresReglage, armesValables, degatsDArme, degatsDArmeDuMoment, donsAcquis, durabiliteAEcrire, durabiliteDArme, durabiliteMaxDArme,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

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
const entier = (v) => Number(v) || 0;

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

test('R167 : maximum d’une arme élémentaire = celui de lib/arme-forge.mjs#forgerArmeElementaire (4 + les crans de la ligne), sur toutes les armes élémentaires et tous les niveaux', () => {
  assert.equal(regles.constantes['piece_elementaire.solidite_base'], page.solidite_elementaire);
  let combinaisons = 0;
  for (const f of page.familles) {
    for (const ae of f.armes_elementaires ?? []) {
      for (let niveau = 0; niveau <= 10; niveau += 1) {
        const attendu = forgerArmeElementaire({ de: f.type_elementaire?.de, bonus_degats: ae.bonus_degats, solidite: page.solidite_elementaire }, page.ameliorations, niveau);
        const amelioration = page.ameliorations.find((x) => x.niveau === niveau);
        const l = { rang: 1, arme_elementaire_id: ae.id, amelioration_id: niveau ? amelioration.id : null };
        assert.equal(durabiliteMaxDArme(regles, l), attendu.durabilite.total, `${ae.nom}, +${niveau}`);
        const d = durabiliteDArme(regles, { armes: [l] }, 1);
        assert.deepEqual([d.max, d.actuelle, d.cassee], [attendu.durabilite.total, attendu.durabilite.total, false]);
        assert.equal(d.detail.reduce((s, c) => s + c.valeur, 0), attendu.durabilite.arme + attendu.durabilite.amelioration, 'le détail : l’arme, la ligne d’amélioration');
        // ses dégâts (sans maîtrise ni don) : « +8 » et l'effet de la ligne, comme la page des armes
        assert.equal(degatsDArme(regles, { armes: [l] }, 1).total, attendu.bonus.total, `${ae.nom}, +${niveau} : dégâts`);
        combinaisons += 1;
      }
    }
  }
  assert.equal(combinaisons, regles.armes_elementaires.length * 11);
  // pas de cumul des lignes : 4, puis 5 du +5 au +9, puis 6 au +10
  const arc = regles.armes_elementaires.find((a) => a.nom === 'Arc de Sang');
  const max = (n) => durabiliteMaxDArme(regles, { arme_elementaire_id: arc.id, amelioration_id: n ? regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === n).id : null });
  assert.deepEqual([0, 4, 5, 9, 10].map(max), [4, 4, 5, 5, 6]);
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

test('Vieille Branche (décision R107) : la valeur du don (+4 à l’import) par cran perdu de chaque arme portée, ses propres crans ; rien intacte, cassée ou sans le don', () => {
  // le don lu « par cran perdu » (lib/degats-texte.mjs), tel que regles.json le transmet : Vieille Branche, choix du niveau 10 de la spécialité Mage jade
  const lus = regles.classes.flatMap((c) => (c.dons ?? []).filter((d) => d.degats?.parCranPerdu).map((d) => ({ classe: c, don: d })));
  assert.deepEqual(lus.map((x) => x.don.id), ['capacites/mage-vert-vieille-branche']);
  const [{ classe, don }] = lus;
  // la valeur d'un cran perdu, lue dans les règles (le site de dev en est la source ; +4 à l'import)
  const { valeur, ...lecture } = don.degats;
  assert.deepEqual(lecture, { portee: { toutes: true }, parCranPerdu: true });
  assert.ok(Number.isInteger(valeur) && valeur > 0, `valeur ${valeur}`);
  const autre = classe.dons.find((d) => d.nature === 'choix' && d.niveau === don.niveau && d.specialite_id === don.specialite_id && d.id !== don.id);
  assert.ok(autre && !autre.degats?.parCranPerdu, 'l’autre don du choix (À l’aise)');
  const mage = (capacites, armes) => ({
    ...ficheVide('Mage jade'), xp: regles.niveaux.find((l) => l.niveau === don.niveau).xp_min,
    classes: [{ rang: 1, classe_id: classe.id, specialite_id: don.specialite_id }], capacites: capacites.map((id) => ({ capacite_id: id })), armes,
  });
  const avecLeDon = (...armes) => mage([don.id], armes);
  assert.ok(donsAcquis(regles, avecLeDon()).some((c) => c.dons.some((d) => d.id === don.id)), 'le don est débloqué');
  // une arme d'au moins 4 crans (le matériau et l'amélioration qui en donnent le plus) : 1, 2 ou 3 crans perdus sans être cassée
  const plus = (liste, champ) => liste.reduce((a, b) => (entier(b[champ]) > entier(a[champ]) ? b : a));
  const solide = (surcharge = {}) => ligne({ materiau_id: plus(regles.materiaux_armes, 'cran_solidite').id, amelioration_id: plus(ameliorationsDArme, 'bonus_cran').id, ...surcharge });
  const max = durabiliteMaxDArme(regles, solide());
  assert.ok(max >= 4, `${max} crans`);
  const nom = (n) => `${don.nom} (${classe.nom}) : ${n} cran${n > 1 ? 's' : ''} perdu${n > 1 ? 's' : ''}`;
  const vieille = (d) => [...d.bonus, ...d.nonComptes].filter((b) => b.nom.startsWith(don.nom));

  const intacte = degatsDArme(regles, avecLeDon(solide()), 1);
  assert.deepEqual(vieille(intacte), [], 'intacte : 0 cran perdu, rien (ni bonus ni « non compté »)');
  const deux = degatsDArme(regles, avecLeDon(solide({ durabilite: max - 2 })), 1);
  assert.deepEqual(vieille(deux), [{ nom: nom(2), valeur: valeur * 2 }]);
  assert.equal(deux.total, intacte.total + valeur * 2);
  assert.equal(deux.texte, `${intacte.notation}+${intacte.total + valeur * 2}`);
  assert.deepEqual(vieille(degatsDArme(regles, avecLeDon(solide({ durabilite: max - 1 })), 1)), [{ nom: nom(1), valeur }]);
  // la pastille du moment le compte aussi (degatsDArmeDuMoment part de degatsDArme)
  assert.equal(degatsDArmeDuMoment(regles, avecLeDon(solide({ durabilite: max - 2 })), 1).total, deux.total);
  // cassée (R74) : la pastille dit « Cassée », sa valeur réparée est celle de l'arme sans cran perdu
  assert.deepEqual(degatsDArme(regles, avecLeDon(solide({ durabilite: 0 })), 1), intacte);

  // deux armes : chacune ses crans perdus ; une arme sans solidité (arme de monstre) n'en a pas
  const armes = [solide({ durabilite: max - 1 }), { ...solide({ durabilite: max - 3 }), rang: 2 }];
  assert.deepEqual([1, 2].map((r) => vieille(degatsDArme(regles, avecLeDon(...armes), r))), [[{ nom: nom(1), valeur }], [{ nom: nom(3), valeur: valeur * 3 }]]);
  const monstre = regles.armes.find((a) => a.solidite === null);
  assert.deepEqual(vieille(degatsDArme(regles, avecLeDon({ rang: 1, arme_id: monstre.id, durabilite: 0 }), 1)), []);

  // sans le don (l'autre don du choix, ou aucun) : les crans perdus ne changent rien
  for (const capacites of [[autre.id], []]) {
    const sansLeDon = degatsDArme(regles, mage(capacites, [solide()]), 1);
    assert.deepEqual(degatsDArme(regles, mage(capacites, [solide({ durabilite: max - 2 })]), 1), sansLeDon);
    assert.equal(sansLeDon.total, intacte.total);
  }
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

const racine = dossierTemporaire('durabilite');

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
