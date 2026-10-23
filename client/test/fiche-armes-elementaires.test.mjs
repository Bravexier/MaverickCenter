// Armes élémentaires sur la fiche de personnage (décision R167 du propriétaire, migration 0081) : la liste des armes propose directement les armes
// élémentaires des magies du personnage (innée et acquise, jamais le Potentiel Illimité), sur le fond de leur magie ; une ligne d'arme porte soit une
// arme du catalogue, soit une arme élémentaire, et un seul niveau d'amélioration ; dégâts = dé du type + 8 + l'effet de la ligne (Arc de Sang +5 :
// D8+18), solidité = 4 + les crans de la ligne ; la maîtrise et les bonus de sa famille ; l'arbalète élémentaire ignore 4 AP ; en Symbiose, l'arme
// élémentaire de la magie de la Symbiose reste utilisable avec le bonus de dégâts de la posture (exception à R112) ; les sorts « Fer » d'un autre élément
// sont signalés ; la règle arme_elementaire_hors_magie de v_personnage_controle (par le service) a son libellé ; les fiches d'avant sont converties par
// la page (ses noms, src/scripts/fiche.mjs#nomsDesRetraits, lus comme un texte et évalués). Solidité comparée à lib/arme-forge.mjs :
// test/fiche-durabilite.test.mjs ; tableur : test/fiche-tableur-aller-retour.test.mjs et test/fiche-tableur-import.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { libelleDuControle, LIBELLES_DES_CONTROLES } from '../src/lib/fiche-controles.mjs';
import { ficheVide, sansPartiesRetirees } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { partiesDeLArme } from '../src/lib/fiche-tableur-export.mjs';
import { texteSansBalises } from '../src/lib/mots-cles-balises.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/fiche/fiche.css', import.meta.url), 'utf8');

const SANG = 'magies/magie-du-sang';
const FEU = 'magies/magie-du-feu';
const PI = 'magies/potentiel-illimite';
const SYMBIOSE = 'guide/postures#posture:symbiose';
const elementaire = (type, magie) => {
  const a = regles.armes_elementaires.find((x) => x.type_id === type && x.magie_id === magie);
  assert.ok(a, `${type} de ${magie}`);
  return a;
};
const niveau = (n) => regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === n);
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', magie_innee_id: SANG, ...x });
const arme = (rang, id, x = {}) => ({ rang, arme_elementaire_id: id, ...x });
const ARC_DE_SANG = elementaire('arc', SANG);

test('R167 : la liste propose les armes élémentaires de la magie innée puis de l’acquise, chacune avec la classe de sa magie ; aucune pour le Potentiel Illimité seul', () => {
  const types = regles.types_elementaires.map((t) => t.id);
  assert.equal(types.length, 11);
  const innee = M.armesElementairesProposees(regles, fiche());
  assert.deepEqual(innee.map((a) => a.magie_id), Array(11).fill(SANG));
  assert.deepEqual(innee.map((a) => a.type_id).sort(), [...types].sort(), 'une par type');
  const deux = M.armesElementairesProposees(regles, fiche({ magie_acquise_id: FEU }));
  assert.deepEqual(deux.map((a) => a.magie_id), [...Array(11).fill(SANG), ...Array(11).fill(FEU)], 'l’innée, puis l’acquise');
  assert.deepEqual(M.armesElementairesProposees(regles, fiche({ magie_innee_id: PI })), [], 'Potentiel Illimité seul : aucune');
  assert.deepEqual(M.armesElementairesProposees(regles, fiche({ magie_innee_id: PI, magie_acquise_id: FEU })).map((a) => a.magie_id), Array(11).fill(FEU), 'jamais le Potentiel Illimité');
  assert.deepEqual(M.armesElementairesProposees(regles, fiche({ magie_innee_id: null })), []);
  // le fond de la magie : la classe de la palette de sa magie (regles.magies[].classe), jamais une couleur
  for (const a of regles.armes_elementaires) assert.equal(a.classe, regles.magies.find((m) => m.id === a.magie_id).classe, a.id);
  // la page : la liste de chaque arme, refaite quand les magies changent ; chaque arme élémentaire dans le groupe de sa famille, sur le fond de sa magie
  // (teinteDe, comme un sort) ; la liste choisie aussi (data-couleur) ; plus de champ « Élément » ni « Amélioration de l'élément »
  const bloc = script.slice(script.indexOf('function construireEquipement()'), script.indexOf("// l'armure portée (décision R95"));
  assert.match(bloc, /const armesProposees = armesElementairesProposees\(regles, fiche\);/);
  assert.match(bloc, /reconstruire\(\$\('armes'\), JSON\.stringify\(\[armesProposees\.map\(\(a\) => a\.id\)/);
  assert.match(bloc, /el\('option', \{ value: a\.id, class: teinteDe\(a\)\.join\(' '\) \|\| null/);
  assert.match(bloc, /regles\.familles_armes\.find\(\(x\) => x\.type_elementaire_id === a\.type_id\)/);
  assert.match(bloc, /poserTeinte\(choixDArme, teinteDe\(element\)\);\n\s*attribut\(choixDArme, 'data-couleur', Boolean\(element\)\);/);
  assert.match(bloc, /composition\.disabled = !x \|\| Boolean\(element\);/);
  assert.doesNotMatch(bloc, /champ\('Élément'|Amélioration de l’élément'/);
  assert.match(css, /\.fiche \.objet select\[data-couleur\] \{ background-color: var\(--c\); color: var\(--texte-sur-c\);/);
});

test('R167 : choisir une arme élémentaire vide le matériau sans remettre l’amélioration à zéro ; revenir au catalogue reprend le fer (R49)', () => {
  const avant = fiche({ armes: [{ rang: 1, arme_id: regles.armes.find((a) => a.famille_id === 'arc').id, materiau_id: regles.materiau_arme_defaut, amelioration_id: niveau(3).id, durabilite: 1, effet_en_plus: 'Gravé' }] });
  const [l] = M.armesApresChoix(regles, avant, 1, ARC_DE_SANG.id);
  assert.deepEqual(l, { rang: 1, arme_id: null, arme_elementaire_id: ARC_DE_SANG.id, materiau_id: null, amelioration_id: niveau(3).id, effet_en_plus: 'Gravé' }, 'une autre arme est neuve (R74)');
  // le matériau ne se pose pas sur une arme élémentaire
  assert.deepEqual(M.armesApresReglage(regles, { armes: [l] }, 1, 'materiau_id', regles.materiau_arme_defaut), [l]);
  const [retour] = M.armesApresChoix(regles, { armes: [l] }, 1, regles.armes[0].id);
  assert.deepEqual([retour.arme_id, retour.arme_elementaire_id, retour.materiau_id, retour.amelioration_id], [regles.armes[0].id, null, regles.materiau_arme_defaut, niveau(3).id]);
});

test('R167 : Arc de Sang — D8, portée 2 - 10, +8, solidité 4 ; au +5 : D8+18, solidité 5 ; au +10 : solidité 6 ; une ou deux mains, Arc ou Arme légère', () => {
  const a = M.armeDeLaLigne(regles, arme(1, ARC_DE_SANG.id));
  assert.deepEqual([a.nom, a.famille_id, a.type_id, a.de, a.portee, a.bonus_degats, a.solidite, a.mains, a.competences],
    ['Arc de Sang', 'arc', 'arc', 'D8', '2 - 10', 8, 4, 'une_ou_deux', ['arc', 'arme-legere']]);
  const degats = (n) => M.degatsDArme(regles, fiche({ armes: [arme(1, ARC_DE_SANG.id, { amelioration_id: n ? niveau(n).id : null })] }), 1);
  assert.deepEqual([degats(0).de, degats(0).total, degats(0).texte], ['D8', 8, `${degats(0).notation}+8`]);
  assert.deepEqual([degats(5).de, degats(5).total], ['D8', 18], 'D8+18');
  assert.deepEqual(degats(5).bonus, [{ nom: 'Arc de Sang', valeur: 8 }, { nom: 'Amélioration niveau 5', valeur: 10 }]);
  const solidite = (n) => M.durabiliteDArme(regles, { armes: [arme(1, ARC_DE_SANG.id, { amelioration_id: n ? niveau(n).id : null })] }, 1).max;
  assert.deepEqual([solidite(0), solidite(5), solidite(10)], [4, 5, 6]);
  // sa capacité « Nom (mode) : texte », dans l'effet de l'arme (la page et la case de l'effet du tableur)
  assert.equal(a.effet, `${ARC_DE_SANG.capacite_nom} (${ARC_DE_SANG.capacite_mode}) : ${ARC_DE_SANG.capacite_texte}`);
  assert.deepEqual(partiesDeLArme(regles, fiche({ armes: [arme(1, ARC_DE_SANG.id)] }), 1).affichees, [a.effet]);
  // le Pugilat élémentaire : le dé de la Force, comme une arme du catalogue de la famille
  const gants = elementaire('pugilat', SANG);
  const pugilat = regles.armes.find((x) => x.famille_id === 'pugilat');
  const f = (l) => fiche({ caracteristiques: [{ caracteristique_id: 'force', base: 4, croix: 0 }], armes: [l] });
  assert.equal(M.degatsDArme(regles, f(arme(1, gants.id)), 1).de, M.degatsDArme(regles, f({ rang: 1, arme_id: pugilat.id }), 1).de);
});

test('R167 : l’arbalète élémentaire ignore 4 AP (dans son effet, comme l’Arbalète du catalogue) ; l’arme de jet et la bombe, leur mention en texte', () => {
  const arbalete = M.armeDeLaLigne(regles, arme(1, elementaire('arbalete', SANG).id));
  assert.equal(arbalete.ignore_ap, 4);
  assert.ok(arbalete.effet.split('\n').includes('Ignore 4 AP'));
  assert.match(regles.armes.find((x) => x.nom === 'Arbalète').effet, /ignore 4 AP/, 'l’Arbalète du catalogue l’écrit dans son effet');
  assert.deepEqual(arbalete.competences, ['arbalete']);
  for (const type of ['arme-de-jet', 'bombe']) {
    const x = M.armeDeLaLigne(regles, arme(1, elementaire(type, SANG).id));
    assert.equal(x.effet.split('\n').at(-1), regles.types_elementaires.find((t) => t.id === type).mention, type);
    assert.equal(x.ignore_ap, null);
  }
  for (const type of ['epee', 'arc']) assert.ok(!M.armeDeLaLigne(regles, arme(1, elementaire(type, SANG).id)).effet.includes('AP'), type);
});

test('R167 : la maîtrise et les bonus de sa famille (celle de son type élémentaire), comme une arme du catalogue de cette famille ; mains : comme une arme `une_ou_deux` (R46)', () => {
  const maitrise = regles.accessoires.find((a) => a.effets.some((e) => e.cible === 'maitrise_arme'));
  const parCategorie = regles.accessoires.find((a) => a.effets.some((e) => e.cible === 'degats_famille'));
  assert.ok(maitrise && parCategorie);
  const accessoires = [{ emplacement: 'bague-1', accessoire_effet_id: maitrise.id, valeur: null, maudit: 0, arme_famille_id: 'arc' },
    { emplacement: 'bague-2', accessoire_effet_id: parCategorie.id, valeur: null, maudit: 0, arme_famille_id: 'arc' }];
  const arcCourt = regles.armes.find((x) => x.nom === 'Arc court');
  const f = fiche({ accessoires, armes: [arme(1, ARC_DE_SANG.id), { rang: 2, arme_id: arcCourt.id }] });
  const des = M.maitrisesParFamille(regles, f).find((m) => m.famille === 'arc').des;
  assert.ok(des >= 2, 'le point de maîtrise de l’accessoire sur ARC');
  const elem = M.degatsDArme(regles, f, 1);
  assert.equal(elem.nombre, des, 'les dés de la maîtrise d’ARC');
  assert.equal(elem.nombre, M.degatsDArme(regles, f, 2).nombre, 'les mêmes que l’Arc court');
  const bonus = M.effetsDesAccessoires(regles, f).find((e) => e.cible === 'degats_famille').valeur;
  assert.ok(elem.bonus.some((b) => b.nom.endsWith('(accessoire)') && b.valeur === bonus), '« +N dégâts avec une catégorie d’arme » sur ARC');
  // chaque type élémentaire a exactement une famille : aucun bonus ni maîtrise ne se rattache à deux familles
  for (const t of regles.types_elementaires) assert.equal(regles.familles_armes.filter((x) => x.type_elementaire_id === t.id).length, 1, t.id);
  // deux armes de mêlée (R46) : une épée élémentaire et une dague élémentaire, comme deux armes du catalogue (la dague : moitié du malus)
  const deux = M.attaqueADeuxArmes(regles, fiche({ armes: [arme(1, elementaire('epee', SANG).id), arme(2, elementaire('dague', SANG).id)] }));
  assert.deepEqual(deux.mains.map((m) => [m.malus, m.dague]), [[20, false], [20, true]]);
  assert.equal(M.attaqueADeuxArmes(regles, fiche({ armes: [arme(1, ARC_DE_SANG.id), arme(2, elementaire('dague', SANG).id)] })), null, 'un arc n’est pas une arme de mêlée');
});

test('R167 : Symbiose — l’arme élémentaire de sa magie reste utilisable avec le bonus de dégâts de la posture (R100) ; une autre arme, grisée ; magie à choisir : grisée ; PI : aucune', () => {
  const f = (x = {}) => fiche({ magie_acquise_id: FEU, posture_id: SYMBIOSE, symbiose_magie_id: SANG,
    armes: [arme(1, ARC_DE_SANG.id), arme(2, elementaire('arc', FEU).id)], ...x });
  const posture = M.postureDuMoment(regles, f());
  assert.equal(posture.symbiose.magie.id, SANG);
  assert.equal(posture.symbiose.degats, 5 + 2 * Math.max(0, M.npmMax(regles, f()) - 1), 'R100 : +5, +2 par NPM au-delà du premier');
  const sang = M.degatsDArmeDuMoment(regles, f(), 1);
  assert.equal(sang.inutilisable, null, 'utilisable');
  assert.deepEqual(sang.moment, [{ nom: 'Posture Symbiose (Sang)', valeur: posture.symbiose.degats }].map((m) => ({ ...m, nom: `Posture ${posture.posture.nom} (${posture.symbiose.magie.nom})` })));
  assert.equal(sang.texte, `${sang.notation}+${M.degatsDArme(regles, f(), 1).total + posture.symbiose.degats}`);
  assert.equal(M.degatsDArmeDuMoment(regles, f(), 2).inutilisable, posture.posture.nom, 'l’arme élémentaire de l’autre magie : grisée');
  const catalogue = f({ armes: [{ rang: 1, arme_id: regles.armes[0].id }] });
  assert.equal(M.degatsDArmeDuMoment(regles, catalogue, 1).inutilisable, posture.posture.nom, 'une arme du catalogue : grisée (R112)');
  // deux magies, celle de la Symbiose pas encore choisie : l'arme reste grisée
  const aChoisir = f({ symbiose_magie_id: null });
  assert.equal(M.postureDuMoment(regles, aChoisir).symbiose.aChoisir, true);
  assert.equal(M.degatsDArmeDuMoment(regles, aChoisir, 1).inutilisable, posture.posture.nom);
  // une seule magie : c'est celle de la Symbiose
  assert.equal(M.degatsDArmeDuMoment(regles, f({ magie_acquise_id: null, symbiose_magie_id: null }), 1).inutilisable, null);
  // Potentiel Illimité (R109) : sa Symbiose n'a pas de magie, aucune arme élémentaire ne correspond
  const pi = f({ magie_innee_id: PI, magie_acquise_id: null, symbiose_magie_id: null });
  assert.equal(M.postureDuMoment(regles, pi).symbiose.potentielIllimite, true);
  assert.equal(M.degatsDArmeDuMoment(regles, pi, 1).inutilisable, posture.posture.nom);
  // hors de la Symbiose : ni bonus ni grisé
  const neutre = M.degatsDArmeDuMoment(regles, f({ posture_id: null }), 1);
  assert.deepEqual([neutre.inutilisable, neutre.moment], [null, []]);
});

test('R167 : un sort « Fer » d’un autre élément que l’arme élémentaire portée est signalé (rien de compté) ; du même élément, ou sur une arme du catalogue, rien', () => {
  const fers = regles.sorts.filter((s) => s.fer);
  assert.equal(fers.length, 13);
  const ferSanglant = fers.find((s) => s.magie_id === SANG);
  const ferBrulant = fers.find((s) => s.magie_id === FEU);
  const sorts = [{ sort_id: ferSanglant.id, rang: 1, niveau_maitrise: 0 }, { sort_id: ferBrulant.id, rang: 2, niveau_maitrise: 0 }];
  const f = fiche({ magie_acquise_id: FEU, sorts, armes: [arme(1, ARC_DE_SANG.id), arme(2, elementaire('epee', FEU).id)] });
  assert.deepEqual(M.sortsFerDAutreElement(regles, f).map((r) => [r.rang, r.sort.nom]), [[1, ferBrulant.nom], [2, ferSanglant.nom]]);
  assert.deepEqual(M.sortsFerDAutreElement(regles, { ...f, sorts: [sorts[0]], armes: [arme(1, ARC_DE_SANG.id)] }), [], 'même élément : rien');
  assert.deepEqual(M.sortsFerDAutreElement(regles, { ...f, armes: [{ rang: 1, arme_id: regles.armes[0].id }] }), [], 'une arme du catalogue : rien');
  // rien n'est compté : les dégâts de l'arme ne changent pas
  assert.equal(M.degatsDArme(regles, f, 1).total, M.degatsDArme(regles, { ...f, sorts: [] }, 1).total);
  // la page : le rappel près de l'arme, la phrase de la page « Pièces élémentaires » en infobulle, telle qu'écrite
  assert.match(script, /texte: \(sort\) => `\$\{sort\.nom\} : sort « Fer » d’un autre élément que cette arme`/);
  // la page, sans les balises du glossaire (« {{sort-fer|sorts "fer"}} » : le mot-clé de l'étiquette « Sort fer »), telle qu'elle se lit
  const page = texteSansBalises(db.prepare("SELECT corps_md FROM page WHERE corps_md LIKE '%sont utilisables sur les armes élémentaires%'").get()?.corps_md ?? '');
  const phrase = /Les sorts "fer" sont utilisables[^\n]*/.exec(page)?.[0];
  assert.ok(phrase, 'la phrase est dans la page « Pièces élémentaires »');
  assert.ok(script.includes(phrase.replace(/'/g, "\\'")), 'citée telle qu’écrite');
});


test('R167 : contrôle arme_elementaire_hors_magie (vue v_personnage_controle, par le service) : une arme élémentaire d’une magie que le personnage n’a pas, libellée ; ses magies, rien', (t) => {
  assert.ok(LIBELLES_DES_CONTROLES.arme_elementaire_hors_magie);
  assert.notEqual(libelleDuControle('arme_elementaire_hors_magie'), 'arme_elementaire_hors_magie');
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: dossierTemporaire('armes-elementaires', { t }) }).chemin);
  try {
    const regle = (f) => enregistrerFiche(vivante, f).controles.filter((c) => c.regle === 'arme_elementaire_hors_magie').map((c) => c.detail);
    const feu = elementaire('epee', FEU);
    assert.deepEqual(regle(fiche({ nom: 'Hors magie R167', armes: [arme(1, ARC_DE_SANG.id), arme(2, feu.id)] })), [`2 : ${feu.id}`]);
    assert.deepEqual(regle(fiche({ nom: 'Deux magies R167', magie_acquise_id: FEU, armes: [arme(1, ARC_DE_SANG.id), arme(2, feu.id)] })), []);
    assert.deepEqual(regle(fiche({ nom: 'PI R167', magie_innee_id: PI, armes: [arme(1, ARC_DE_SANG.id)] })), [`1 : ${ARC_DE_SANG.id}`], 'le Potentiel Illimité n’en ouvre aucune');
  } finally {
    vivante.close();
  }
  // la page nomme l'arme du détail (indexerNoms : regles.armes_elementaires)
  const index = script.slice(script.indexOf('function indexerNoms()'), script.indexOf('function remplirListesFixes()'));
  assert.match(index, /'armes', 'armes_elementaires', 'armures'/);
});

test('R167 : une fiche d’avant (un élément posé sur une arme du catalogue) convertie par la page, avec ses noms : même type, autre type, amélioration de l’élément seule', () => {
  // les noms que la page passe à sansPartiesRetirees (src/scripts/fiche.mjs#nomsDesRetraits), évalués tels qu'écrits
  const source = script.slice(script.indexOf('const nomsDesRetraits = () => ('), script.indexOf('function appliquer('));
  const nomsDesRetraits = new Function('regles', 'trouver', `${source}\nreturn nomsDesRetraits;`)(regles, M.trouver);
  const noms = nomsDesRetraits();
  const epeeLongue = regles.armes.find((a) => a.nom === 'Épée Longue');
  const arcCourt = regles.armes.find((a) => a.nom === 'Arc court');
  const epeeDeFeu = elementaire('epee', FEU);
  assert.deepEqual(noms.arme(epeeLongue.id), { nom: 'Épée Longue', famille: 'ÉPÉES', type_elementaire_id: 'epee' });
  assert.deepEqual(noms.armeElementaire(epeeDeFeu.id), { nom: epeeDeFeu.nom, type_id: 'epee' });
  assert.deepEqual(noms.ameliorationDArme(5), { id: niveau(5).id, bonus_cran: 1 });
  assert.equal(noms.niveau(niveau(3).id), 3);
  assert.equal(noms.soliditeElementaire, 4);
  const ancienne = (n) => `ressources/pieces-elementaires#amelioration:arme-elementaire:${n}`;
  const instant = '2026-10-23T10:00:00Z';
  const avant = fiche({
    magie_innee_id: FEU, notes: null,
    armes: [
      { rang: 1, arme_id: epeeLongue.id, materiau_id: regles.materiau_arme_defaut, amelioration_id: niveau(3).id, arme_elementaire_id: epeeDeFeu.id, amelioration_elementaire_id: ancienne(5), durabilite: 2 },
      { rang: 2, arme_id: arcCourt.id, materiau_id: regles.materiau_arme_defaut, amelioration_id: niveau(1).id, arme_elementaire_id: epeeDeFeu.id, amelioration_elementaire_id: ancienne(2) },
    ],
  });
  const apres = sansPartiesRetirees(avant, { instant, noms });
  // même type (ÉPÉES → Épée) : l'arme élémentaire, au niveau de l'ancienne amélioration de l'élément, sans matériau ; sa solidité gardée sous le maximum
  assert.deepEqual(apres.armes[0], { rang: 1, arme_id: null, materiau_id: null, amelioration_id: niveau(5).id, arme_elementaire_id: epeeDeFeu.id, type_degats_choisi: null, durabilite: 2 });
  // autre type : l'élément part, l'arme garde son matériau et son amélioration
  assert.deepEqual(apres.armes[1], { rang: 2, arme_id: arcCourt.id, materiau_id: regles.materiau_arme_defaut, amelioration_id: niveau(1).id, arme_elementaire_id: null, type_degats_choisi: null });
  const lignes = apres.notes.split('\n');
  assert.ok(lignes.some((l) => l.includes(`« ${epeeLongue.nom} »`) && l.includes(`est devenue l’arme élémentaire « ${epeeDeFeu.nom} », avec l’amélioration +5 de son élément`)), apres.notes);
  assert.ok(lignes.some((l) => l.includes(`l’élément « ${epeeDeFeu.nom} » de l’arme « ${arcCourt.nom} »`) && l.includes('n’est plus posé')), apres.notes);
  // la fiche convertie se calcule : D10 + 8 + l'effet du +5, solidité 4 + 1
  assert.equal(M.degatsDArme(regles, apres, 1).total, 8 + niveau(5).bonus_degats);
  assert.equal(M.durabiliteDArme(regles, apres, 1).max, 5);
  // l'amélioration de l'élément seule : retirée, notée ; une fiche déjà dans la forme de R167 : rendue telle quelle
  const seule = sansPartiesRetirees(fiche({ armes: [{ rang: 1, arme_id: arcCourt.id, amelioration_elementaire_id: ancienne(2) }] }), { instant, noms });
  assert.deepEqual(seule.armes, [{ rang: 1, arme_id: arcCourt.id }]);
  assert.match(seule.notes, /l’amélioration de l’élément \+2 de l’arme « Arc court »/);
  const neuve = fiche({ armes: [arme(1, ARC_DE_SANG.id, { amelioration_id: niveau(2).id })] });
  assert.equal(sansPartiesRetirees(neuve, { instant, noms }), neuve);
});

test('R167, type de dégâts (« Les deux » : « Estoc + Feu pour un arc de feu par exemple ») : le type physique de sa famille puis celui de sa magie, pour les 14 éléments', () => {
  // le type de la magie : l'identifiant de la magie, comme typesDeDegats l'écrit pour une magie
  const magiques = new Map(M.typesDeDegats(regles).filter((t) => !t.physique).map((t) => [t.id, t.nom]));
  assert.equal(new Set(regles.armes_elementaires.map((a) => a.magie_id)).size, 14);
  for (const a of regles.armes_elementaires) {
    const t = regles.types_elementaires.find((x) => x.id === a.type_id);
    const x = M.armeDeLaLigne(regles, arme(1, a.id));
    assert.deepEqual(x.types_degats, [...(t.type_degats_au_choix ? [] : t.types_degats), a.magie_id], a.id);
    assert.ok(magiques.has(a.magie_id), `${a.id} : un type de dégâts de magie de la fiche`);
  }
  // les types physiques de R167 (« Épée = Taille, Dague = Estoc+Taille, Masse = Frappe … Bombe : Estoc, Frappe ou Taille au choix »)
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, elementaire('dague', SANG).id)).types_degats, ['estoc', 'taille', SANG], 'Dague de Sang : Estoc + Taille + Sang');
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, elementaire('masse', FEU).id)).types_degats, ['frappe', FEU], 'Masse de Feu : Frappe + Feu');
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, elementaire('arc', FEU).id)).types_degats, ['estoc', FEU], 'Arc de Feu : Estoc + Feu');
  // une liste absente des règles (une autre base) : le type de la magie seul, rien de deviné
  const arcDeFeu = elementaire('arc', FEU);
  const sansDonnee = { ...regles, types_elementaires: regles.types_elementaires.map((t) => (t.id === 'arc' ? { ...t, types_degats: undefined } : t)) };
  assert.deepEqual(M.armeDeLaLigne(sansDonnee, arme(1, arcDeFeu.id)).types_degats, [FEU], 'liste absente : le type de la magie seul');
  // un don qui vise un type physique (lib/degats-texte.mjs : « dégâts d'estoc ») compte sur l'arme qui le porte, comme sur une arme du catalogue
  const guerrier = regles.classes.find((c) => c.id === 'classes/guerrier');
  const don = { id: 'test#don-estoc', nom: 'Essai estoc', nature: 'passif', niveau: 1, specialite_id: null, effet: '', degats: { valeur: 3, portee: { types: ['estoc'] } } };
  const avecDon = { ...regles, classes: regles.classes.map((c) => (c === guerrier ? { ...c, dons: [...(c.dons ?? []), don] } : c)) };
  const f = fiche({ magie_innee_id: FEU, classes: [{ rang: 1, classe_id: guerrier.id, specialite_id: null }], armes: [arme(1, arcDeFeu.id)] });
  assert.ok(M.degatsDArme(avecDon, f, 1).bonus.some((b) => b.nom === 'Essai estoc (Guerrier)' && b.valeur === 3));
  const sansEstoc = { ...avecDon, types_elementaires: sansDonnee.types_elementaires };
  assert.ok(!M.degatsDArme(sansEstoc, f, 1).bonus.some((b) => b.nom.startsWith('Essai estoc')), 'sans type physique en données : rien de deviné');
});

test('R167, bombe élémentaire : un seul type physique, au choix du porteur (type_degats_choisi) ; sans choix, la magie seule ; le choix part avec une arme qui ne se choisit pas', () => {
  const t = regles.types_elementaires.find((x) => x.id === 'bombe');
  assert.deepEqual([t.type_degats_au_choix, t.types_degats], [true, ['estoc', 'frappe', 'taille']]);
  assert.deepEqual(regles.types_elementaires.filter((x) => x.type_degats_au_choix).map((x) => x.id), ['bombe'], 'seule la bombe');
  const bombe = elementaire('bombe', FEU);
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, bombe.id)).types_degats, [FEU], 'pas encore choisi : la magie seule, jamais les trois');
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, bombe.id, { type_degats_choisi: 'taille' })).types_degats, ['taille', FEU]);
  assert.equal(M.typeDegatsChoisi(regles, arme(1, bombe.id, { type_degats_choisi: 'taille' })), 'taille');
  // un choix que le type n'offre pas, ou sur une arme qui ne se choisit pas : ne compte pas (la base le signale : arme_type_degats_choisi)
  assert.equal(M.typeDegatsChoisi(regles, arme(1, bombe.id, { type_degats_choisi: 'feu' })), null);
  assert.deepEqual(M.armeDeLaLigne(regles, arme(1, ARC_DE_SANG.id, { type_degats_choisi: 'taille' })).types_degats, ['estoc', SANG]);
  // le choix : il se pose sur une bombe élémentaire seulement ; il reste d'une bombe à l'autre ; il part avec une autre arme
  const f = fiche({ magie_innee_id: FEU, armes: [arme(1, bombe.id)] });
  const choisie = M.armesApresReglage(regles, f, 1, 'type_degats_choisi', 'frappe');
  assert.equal(choisie[0].type_degats_choisi, 'frappe');
  assert.deepEqual(M.armesApresReglage(regles, { armes: [arme(1, ARC_DE_SANG.id)] }, 1, 'type_degats_choisi', 'frappe'), [arme(1, ARC_DE_SANG.id)], 'pas sur un arc');
  assert.equal(M.armesApresChoix(regles, { armes: choisie }, 1, elementaire('bombe', SANG).id)[0].type_degats_choisi, 'frappe', 'd’une bombe à l’autre');
  assert.equal(M.armesApresChoix(regles, { armes: choisie }, 1, elementaire('epee', FEU).id)[0].type_degats_choisi, null, 'une épée élémentaire : retiré');
  assert.equal(M.armesApresChoix(regles, { armes: choisie }, 1, regles.armes.find((a) => a.famille_id === 'bombes').id)[0].type_degats_choisi, null, 'une bombe du catalogue : retiré');
  // la page : le champ du type physique, montré pour une arme dont le type se choisit, ses options celles du type
  const bloc = script.slice(script.indexOf('function construireEquipement()'), script.indexOf("// l'armure portée (décision R95"));
  assert.match(bloc, /poserChamp\('type_degats_choisi'\)/);
  assert.match(bloc, /typeLigne\.hidden = !arme\?\.type_degats_au_choix;/);
});

/**
 * Une fiche qui a le don `donId` (dons de classe : sa classe au niveau global 10, mono-classe, sa spécialité, le don choisi), une arme `ligne` au rang 1 ;
 * les dégâts de cette arme et le nom affiché du don.
 */
function degatsAvecLeDon(donId, ligne) {
  const classe = regles.classes.find((c) => (c.dons ?? []).some((d) => d.id === donId));
  assert.ok(classe, donId);
  const don = classe.dons.find((d) => d.id === donId);
  const f = fiche({ xp: regles.niveaux.find((l) => l.niveau === 10).xp_min, classes: [{ rang: 1, classe_id: classe.id, specialite_id: don.specialite_id ?? null }],
    capacites: don.nature === 'choix' ? [{ capacite_id: don.id }] : [], armes: [{ rang: 1, ...ligne }] });
  assert.ok(M.donsAcquis(regles, f).some((c) => c.dons.some((d) => d.id === donId)), `${donId} acquis`);
  return { degats: M.degatsDArme(regles, f, 1), nom: `${don.nom} (${classe.nom})` };
}
const compte = ({ degats, nom }) => degats.bonus.filter((b) => b.nom === nom).map((b) => b.valeur);

test('R167 : « Tissière » (Anansi, « Les dégâts d’Arcane, Nécromancie et Ombre augmentent de +10. ») compte sur une arme élémentaire d’Arcane, de Nécromancie ou d’Ombre ; rien sur une autre', () => {
  const tissiere = regles.classes.find((c) => c.id === 'classes/anansi').dons.find((d) => d.id === 'capacites/anansi-tissiere');
  assert.equal(tissiere.effet, 'Les dégâts d\'Arcane,  Nécromancie et Ombre augmentent de +10.', 'le texte de la base, tel qu’écrit');
  assert.deepEqual(tissiere.degats, { valeur: 10, portee: { types: ['magies/magie-de-larcane', 'magies/magie-de-la-necromancie', 'magies/magie-de-lombre'] } });
  for (const magie of ['magies/magie-de-larcane', 'magies/magie-de-la-necromancie', 'magies/magie-de-lombre']) {
    const r = degatsAvecLeDon(tissiere.id, { arme_elementaire_id: elementaire('epee', magie).id });
    assert.equal(r.nom, 'Tissière (Anansi)');
    assert.deepEqual(compte(r), [10], magie);
  }
  for (const autre of [{ arme_elementaire_id: elementaire('epee', FEU).id }, { arme_id: regles.armes.find((a) => a.famille_id === 'epees').id }]) {
    const { degats } = degatsAvecLeDon(tissiere.id, autre);
    assert.ok(!degats.bonus.some((b) => b.nom.startsWith('Tissière')) && !degats.nonComptes.some((b) => b.nom.startsWith('Tissière')), JSON.stringify(autre));
  }
});

test('R167 : les onze autres dons de l’écriture de Tissière (« Oui, tous ») — Orios + Épée de Sang +10 ; Olwman (« Temps » : l’Espace/Temps) + Épée d’Espace/Temps +10, + Épée de Feu rien ; Médusain « Fil conducteur » non compté', () => {
  const avec = (don, type, magie) => degatsAvecLeDon(don, { arme_elementaire_id: elementaire(type, magie).id });
  const orios = avec('capacites/orios-au-poil', 'epee', SANG);
  assert.deepEqual(compte(orios), [10], 'Orios « Au poil » + Épée de Sang');
  assert.equal(orios.nom, 'Au poil (Orios)', 'le même affichage que Tissière');
  assert.deepEqual(compte(avec('capacites/olwman-obscure', 'epee', 'magies/magie-de-lespace-temps')), [10], 'Olwman « Obscure » + Épée d’Espace/Temps');
  assert.deepEqual(compte(avec('capacites/olwman-obscure', 'epee', FEU)), [], 'Olwman « Obscure » + Épée de Feu');
  // une arme du catalogue n'a pas de type de magie : rien
  assert.deepEqual(compte(degatsAvecLeDon('capacites/orios-au-poil', { arme_id: regles.armes.find((a) => a.famille_id === 'epees').id })), []);
  // Médusain « Fil conducteur » (« quand ils sont faits dans l'eau ») : une situation, non comptée (R128)
  for (const magie of ['magies/magie-de-leau', 'magies/magie-de-la-foudre']) assert.deepEqual(compte(avec('capacites/medusain-fil-conducteur', 'epee', magie)), [], magie);
});

test('R167 : une famille créée sur le site de dev n’a aucune arme élémentaire, ni sur la page (son modèle) ni sur la fiche', async () => {
  const { MODELE_DE_FAMILLE } = await import('../src/lib/armes-rendu.mjs');
  assert.deepEqual([MODELE_DE_FAMILLE.type_elementaire, [...MODELE_DE_FAMILLE.armes_elementaires]], [null, []]);
  // la fiche : une famille créée (type_elementaire_id null) ne reçoit aucune arme élémentaire ; chacune reste dans la famille de son type
  const creee = { id: 'frondes-de-test', nom: 'FRONDES', nom_lecture: 'FRONDES', de: 'D6', de_selon_force: null, maitrisable: true, categorie: 'distance', type_elementaire_id: null, competences: [] };
  const avecCreee = { ...regles, familles_armes: [...regles.familles_armes, creee] };
  for (const a of regles.armes_elementaires) assert.notEqual(M.armeDeLaLigne(avecCreee, arme(1, a.id)).famille_id, creee.id, a.id);
  // la page de la fiche range une arme élémentaire dans le groupe de la famille de son type, jamais dans celui d'une famille sans type
  const bloc = script.slice(script.indexOf('function construireEquipement()'), script.indexOf("// l'armure portée (décision R95"));
  assert.match(bloc, /const f = regles\.familles_armes\.find\(\(x\) => x\.type_elementaire_id === a\.type_id\);/);
});

test('R167 : « Fer corrompu » (Corruption) sur une Épée de Feu : un rappel ; sur une Épée de Corruption : rien ; les sorts « Fer » reconnus par leur étiquette (`sorts[].fer`), jamais par leur nom', () => {
  const CORRUPTION = 'magies/magie-de-la-corruption';
  const ferCorrompu = regles.sorts.find((s) => s.magie_id === CORRUPTION && s.fer);
  assert.equal(ferCorrompu?.nom, 'Fer corrompu');
  const sorts = [{ sort_id: ferCorrompu.id, rang: 1, niveau_maitrise: 0 }];
  const avec = (id) => M.sortsFerDAutreElement(regles, fiche({ magie_innee_id: CORRUPTION, magie_acquise_id: FEU, sorts, armes: [arme(1, id)] }));
  assert.deepEqual(avec(elementaire('epee', FEU).id).map((r) => [r.rang, r.sort.nom]), [[1, 'Fer corrompu']]);
  assert.deepEqual(avec(elementaire('epee', CORRUPTION).id), []);
  // l'étiquette « Sort fer » (sort_mot_cle 'sort-fer') fait le sort « Fer » : `fer` vaut exactement pour les sorts qui la portent
  for (const s of regles.sorts) assert.equal(Boolean(s.fer), (s.mots_cles ?? []).includes('sort-fer'), s.id);
  // un nom ne suffit pas, l'étiquette seule compte : sans elle, rien ; avec elle, sous un autre nom, le rappel
  const sansEtiquette = { ...regles, sorts: regles.sorts.map((s) => (s.id === ferCorrompu.id ? { ...s, fer: undefined } : s)) };
  assert.deepEqual(M.sortsFerDAutreElement(sansEtiquette, fiche({ sorts, armes: [arme(1, elementaire('epee', FEU).id)] })), []);
  const autreNom = { ...regles, sorts: regles.sorts.map((s) => (s.id === ferCorrompu.id ? { ...s, nom: 'Lame noire' } : s)) };
  assert.deepEqual(M.sortsFerDAutreElement(autreNom, fiche({ sorts, armes: [arme(1, elementaire('epee', FEU).id)] })).map((r) => r.sort.nom), ['Lame noire']);
});

test('R167 : solidité d’une arme élémentaire — la constante de toute pièce élémentaire (`piece_elementaire.solidite_base`) et le cran de la ligne d’arme : 4 au +4, 5 au +5', () => {
  assert.equal(regles.constantes['piece_elementaire.solidite_base'], 4);
  assert.ok(!('arme_elementaire.solidite_base' in regles.constantes));
  const max = (n) => M.durabiliteMaxDArme(regles, arme(1, ARC_DE_SANG.id, { amelioration_id: niveau(n).id }));
  assert.deepEqual([max(4), max(5)], [4, 5]);
  // les crans des armures n'y entrent pas : seule la ligne fondue des armes (cible `arme`)
  assert.deepEqual(M.durabiliteDArme(regles, { armes: [arme(1, ARC_DE_SANG.id, { amelioration_id: niveau(5).id })] }, 1).detail,
    [{ nom: ARC_DE_SANG.nom, valeur: 4 }, { nom: 'Amélioration niveau 5', valeur: niveau(5).bonus_cran }]);
});
