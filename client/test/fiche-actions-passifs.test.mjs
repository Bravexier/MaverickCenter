// Les actions et les passifs de la fiche (décision R173 : « Il faudrait lister toutes les actions utilisables (dons, accessoire activable(s) directement
// sous la case de la ceinture. Il faudrai pouvoir les sélectionner pour les "consommer" (et griser si plus utilisable). Un bouton "fin de combat" permet de
// remettre tous les compteur X/combat au maximum. Le compteur 1/ jour / semainee lui ne peut que remonter manuellement. Juste après, il faudra mettre les
// passifs (donc de race / classe ou equipement) ») : listes d'un personnage d'exemple, consommation, « Fin de combat », remontée à la main, rappels,
// accessoire qui se brise, Symbiose (R112, R167) et Mode Hyper 100 % (R172), bi-classé, « Noyau dur », objet changé, nettoyage à l'enregistrement.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const E = (id) => `ressources/accessoires#effet:${id}`;
const AE = (id) => `ressources/pieces-elementaires#arme-elementaire:${id}`;
const AR = (id) => `ressources/pieces-elementaires#armure-elementaire:${id}`;
const SYMBIOSE = 'guide/postures#posture:symbiose';
const porte = (emplacement, effet, autres = {}) => ({ emplacement, accessoire_effet_id: E(effet), valeur: null, maudit: 0, ...autres });

/**
 * Humain du Feu, Barde Danseur au niveau de classe 10 (niveau global 5, mono-classe), « Contournement » choisi ; un accessoire à usage par combat, un qui
 * se brise, un « 1 fois/jour », un sans usage ; l'Arbalète d'Espace/Temps (« 2 fois/combat ») et la Masse de Feu (« Explosion », sans limite) ;
 * l'armure élémentaire Léger de l'Espace/Temps (« (Réaction) … 1 fois par semaine »).
 */
function fiche(surcharge = {}) {
  return {
    ...ficheVide('Lyre'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(5),
    classes: [{ rang: 1, classe_id: 'classes/barde', specialite_id: 'classes/barde#specialite:danseur' }],
    capacites: [{ capacite_id: 'capacites/barde-contournement' }],
    accessoires: [porte('chef', 'autre:16'), porte('collier', 'autre:19'), porte('bracelet-1', 'jet-de-de:5'), porte('bague-1', 'caracteristique:force', { maudit: 1 })],
    armes: [{ rang: 1, arme_elementaire_id: AE('arbalete:espace-temps') }, { rang: 2, arme_elementaire_id: AE('masse:feu') }],
    armure_elementaire_id: AR('leger:espace-temps'),
    ...surcharge,
  };
}
const action = (f, cle) => M.actionsDeLaFiche(regles, f).find((a) => a.cle === cle);
/** La fiche après une écriture du moteur (comme la page : Object.assign puis rafraîchissement). */
const apres = (f, ecrit) => ({ ...f, ...ecrit });

test('décision R173 : la liste des actions d’un personnage d’exemple, dans l’ordre de la fiche (race, classes, accessoires, armes, armure)', () => {
  const actions = M.actionsDeLaFiche(regles, fiche());
  const armure = regles.armures_elementaires.find((a) => a.id === AR('leger:espace-temps')).nom;
  assert.deepEqual(actions.map((a) => [a.cle, a.nom, a.type, a.limite && `${a.limite.nombre ?? ''}/${a.limite.periode ?? ''}/${a.limite.genre}`, a.compteur && `${a.compteur.restants}/${a.compteur.max}/${a.compteur.remontee}`]), [
    ['race:don-de-base:races/humain', 'Méditation', 'action', '3/jour/manuel', '3/3/main'],
    ['capacite:capacites/barde-prestation', 'Prestation', 'action', '2/combat/combat', '2/2/fin_de_combat'],
    ['capacite:capacites/barde-son-perturbant', 'Son perturbant', 'actif', '2/combat/combat', '2/2/fin_de_combat'],
    ['capacite:capacites/barde-contournement', 'Contournement', 'actif', '1/tour/rappel', null],
    [`accessoire:chef:${E('autre:16')}`, 'Accessoire : Chef', null, '1/combat/combat', '1/1/fin_de_combat'],
    [`accessoire:collier:${E('autre:19')}`, 'Accessoire : Collier', null, null, null],
    [`accessoire:bracelet-1:${E('jet-de-de:5')}`, 'Accessoire : Bracelet 1', null, '1/jour/manuel', '1/1/main'],
    [`arme:1:${AE('arbalete:espace-temps')}`, 'Télerreau', 'actif', '2/combat/combat', '2/2/fin_de_combat'],
    [`arme:2:${AE('masse:feu')}`, 'Explosion', 'action', null, null],
    [`armure:${AR('leger:espace-temps')}:3`, armure, 'reaction', '1/semaine/manuel', '1/1/main'],
  ]);
  // les objets de la ceinture n'en sont pas (ils gardent leurs boutons, R89, R131) ; l'effet sans usage n'en est pas
  assert.ok(actions.every((a) => !a.cle.includes('caracteristique:force')));
  // le texte tel qu'écrit, sans « (Action) » de tête ; l'accessoire qui se brise ; la précision d'un don de classe telle qu'écrite
  assert.equal(action(fiche(), `accessoire:collier:${E('autre:19')}`).seBrise, true);
  assert.equal(action(fiche(), 'capacite:capacites/barde-prestation').precision, '2 fois/combat');
  assert.ok(actions.every((a) => !a.grisee && (a.compteur || a.seBrise ? a.utilisable : !a.utilisable)));
  assert.ok(!/^\((?:Action|Réaction)\)/.test(action(fiche(), `armure:${AR('leger:espace-temps')}:3`).texte));
});

test('décision R173 : les passifs du personnage d’exemple — race sans le don de base, dons de classe qui ne sont pas des actions, équipement tel qu’écrit', () => {
  const p = M.passifsDeLaFiche(regles, fiche());
  assert.deepEqual(p.race.map((x) => x.nom), M.donsDeRace(regles, fiche()).dons.map((d) => d.nom ?? d.etiquette));
  assert.ok(!p.race.some((x) => x.nom === 'Méditation'), 'le don de base est une action');
  assert.equal(p.classes.length, 1);
  const tous = M.donsAcquis(regles, fiche())[0].dons;
  assert.deepEqual(p.classes[0].dons.map((d) => d.don.id), tous.filter((d) => !M.TYPES_D_ACTION.includes(d.type)).map((d) => d.id));
  assert.ok(p.classes[0].dons.length > 0 && p.classes[0].dons.every((d) => d.type === 'passif'));
  // l'équipement : l'accessoire sans usage (maudit), les effets de l'armure élémentaire qui ne sont pas des actions, les armes 1 et 2 sans leur capacité
  const armure = regles.armures_elementaires.find((a) => a.id === AR('leger:espace-temps'));
  assert.deepEqual(p.equipement.map((x) => [x.origine, x.nom, x.texte, x.maudit]), [
    ['accessoire', 'Accessoire : Bague 1', 'Force', true],
    ['armure', armure.nom, armure.effets.filter((_, i) => i !== 2).join('\n'), false],
    ['arme', regles.armes_elementaires.find((a) => a.id === AE('arbalete:espace-temps')).nom, 'Ignore 4 AP', false],
  ]);
  // un bâton magique à la ceinture (R101), l'effet de l'arme du catalogue et de l'armure de base portées
  const baton = regles.ceinture.batons[0];
  const arme = regles.armes.find((a) => a.effet);
  const base = regles.armures.find((a) => a.effet && a.type !== 'Familier');
  const autre = M.passifsDeLaFiche(regles, fiche({ ceinture: [{ rang: 2, nom: baton.nom, quantite: 1 }], armes: [{ rang: 1, arme_id: arme.id }], armure_elementaire_id: null, armure_id: base.id, accessoires: [] }));
  assert.deepEqual(autre.equipement.map((x) => [x.origine, x.nom, x.texte]), [
    ['armure', base.nom, base.effet], ['baton', baton.nom, baton.effets.map((e) => e.texte).join('\n')], ['arme', arme.nom, arme.effet],
  ]);
});

test('décision R173 : « 2 fois/combat » consommé deux fois, grisé, remis au maximum par « Fin de combat »', () => {
  const cle = 'capacite:capacites/barde-prestation';
  let f = fiche();
  f = apres(f, M.consommerLAction(regles, f, cle));
  assert.deepEqual(f.actions_usage, [{ action_id: cle, restants: 1 }]);
  f = apres(f, M.consommerLAction(regles, f, cle));
  assert.deepEqual(f.actions_usage, [{ action_id: cle, restants: 0 }]);
  const epuisee = action(f, cle);
  assert.deepEqual([epuisee.epuisee, epuisee.utilisable, Boolean(epuisee.grisee)], [true, false, true]);
  assert.deepEqual(M.consommerLAction(regles, f, cle), {}, 'à 0, rien ne se consomme');
  f = apres(f, M.finDeCombat(regles, f));
  assert.deepEqual(f.actions_usage, [], 'au maximum, aucune ligne');
  assert.equal(action(f, cle).compteur.restants, 2);
});

test('décision R173 : « 1 fois/jour » (et « 3 fois/jour », « 1 fois par semaine ») ne remonte pas par « Fin de combat », seulement à la main', () => {
  const jour = `accessoire:bracelet-1:${E('jet-de-de:5')}`;
  const base = 'race:don-de-base:races/humain';
  const semaine = `armure:${AR('leger:espace-temps')}:3`;
  let f = fiche();
  for (const cle of [jour, base, semaine]) f = apres(f, M.consommerLAction(regles, f, cle));
  f = apres(f, M.consommerLAction(regles, f, 'capacite:capacites/barde-prestation'));
  f = apres(f, M.finDeCombat(regles, f));
  assert.deepEqual(f.actions_usage, [{ action_id: jour, restants: 0 }, { action_id: base, restants: 2 }, { action_id: semaine, restants: 0 }]);
  f = apres(f, M.remonterLAction(regles, f, jour));
  assert.equal(action(f, jour).compteur.restants, 1);
  assert.ok(!f.actions_usage.some((u) => u.action_id === jour), 'remonté au maximum : la ligne part');
  assert.deepEqual(M.remonterLAction(regles, f, jour), {}, 'au maximum, rien ne remonte');
  f = apres(f, M.remonterLAction(regles, f, base, 5));
  assert.equal(action(f, base).compteur.restants, 3, 'borné au maximum');
  assert.deepEqual(M.remonterLAction(regles, f, 'capacite:capacites/barde-contournement'), {}, 'sans compteur');
});

test('décision R173 : « 1 fois/tour » en rappel (sans compteur ni grisage) ; une action sans limite écrite n’est jamais grisée, rien ne se consomme', () => {
  const f = fiche();
  const tour = action(f, 'capacite:capacites/barde-contournement');
  assert.deepEqual([tour.limite.genre, tour.compteur, tour.grisee, tour.utilisable], ['rappel', null, null, false]);
  assert.deepEqual(M.consommerLAction(regles, f, tour.cle), {});
  const libre = action(f, `arme:2:${AE('masse:feu')}`);
  assert.deepEqual([libre.limite, libre.compteur, libre.grisee], [null, null, null]);
  assert.deepEqual(M.consommerLAction(regles, f, libre.cle), {});
  // une précision illisible (« X tour/combat » de la Rage du Goleois) : le texte seulement
  const rage = action({ ...fiche(), classes: [{ rang: 1, classe_id: 'classes/goleois', specialite_id: null }], capacites: [] }, 'capacite:capacites/goleois-rage');
  assert.deepEqual([rage.precision, rage.limite.genre, rage.compteur, rage.grisee], ['X tour/combat', 'texte', null, null]);
});

test('décision R173 : un accessoire « l’objet se brise après » est retiré de son emplacement dès qu’il est utilisé', () => {
  const f = fiche();
  const cle = `accessoire:collier:${E('autre:19')}`;
  const ecrit = M.consommerLAction(regles, f, cle);
  assert.deepEqual(ecrit.accessoires.map((a) => a.emplacement), ['chef', 'bracelet-1', 'bague-1']);
  const g = apres(f, ecrit);
  assert.equal(action(g, cle), undefined);
  for (const id of regles.accessoires.filter((a) => a.se_brise).map((a) => a.id)) {
    const h = fiche({ accessoires: [{ emplacement: 'chef', accessoire_effet_id: id, maudit: 0 }] });
    assert.deepEqual(M.consommerLAction(regles, h, `accessoire:chef:${id}`).accessoires, [], id);
  }
  assert.equal(regles.accessoires.filter((a) => a.se_brise).length, 5);
});

test('décision R173 : en Symbiose, les actions d’équipement grisées comme la ceinture (R112), sauf l’arme élémentaire de la magie de la Symbiose (R167) ; le Mode Hyper 100 % lève ce grisage (R172)', () => {
  const symbiose = fiche({ posture_id: SYMBIOSE });
  const grises = M.actionsDeLaFiche(regles, symbiose).filter((a) => a.grisee).map((a) => a.cle);
  assert.deepEqual(grises, [`accessoire:chef:${E('autre:16')}`, `accessoire:collier:${E('autre:19')}`, `accessoire:bracelet-1:${E('jet-de-de:5')}`,
    `arme:1:${AE('arbalete:espace-temps')}`, `armure:${AR('leger:espace-temps')}:3`]);
  assert.match(action(symbiose, `accessoire:chef:${E('autre:16')}`).grisee, /on ne peut que lancer des sorts/);
  // l'arme élémentaire du Feu, magie de la Symbiose : utilisable ; les dons et le don de base ne sont pas grisés
  assert.equal(action(symbiose, `arme:2:${AE('masse:feu')}`).grisee, null);
  assert.equal(action(symbiose, 'capacite:capacites/barde-prestation').utilisable, true);
  assert.equal(action(symbiose, 'race:don-de-base:races/humain').utilisable, true);
  assert.deepEqual(M.consommerLAction(regles, symbiose, `accessoire:chef:${E('autre:16')}`), {}, 'grisée : rien ne se consomme');
  assert.deepEqual(M.consommerLAction(regles, symbiose, `accessoire:collier:${E('autre:19')}`), {}, 'grisé : l’objet ne se brise pas');
  // le compteur se remonte quand même à la main
  const entame = { ...symbiose, actions_usage: [{ action_id: `accessoire:chef:${E('autre:16')}`, restants: 0 }] };
  assert.deepEqual(M.remonterLAction(regles, entame, `accessoire:chef:${E('autre:16')}`), { actions_usage: [] });
  // Mode Hyper 100 % (niveau 10) : la posture cochée ignorée, plus rien de grisé par la Symbiose
  const cent = fiche({ posture_id: SYMBIOSE, xp: xpDuNiveau(10), mode_hyper: 1, mode_hyper_100: 1 });
  assert.equal(M.modeHyperDe(regles, cent).cent.actif, true);
  assert.deepEqual(M.actionsDeLaFiche(regles, cent).filter((a) => a.grisee), []);
});

test('décision R173 : un bi-classé avec un don dans ses deux classes a deux compteurs (« Un par classe »)', () => {
  const f = {
    ...ficheVide('Double'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu', xp: xpDuNiveau(20), mode_classe: 'bi',
    classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: 'classes/guerrier#specialite:epeiste' }, { rang: 2, classe_id: 'classes/pugiliste', specialite_id: 'classes/pugiliste#specialite:cogneur' }],
    capacites: [{ capacite_id: 'capacites/guerrier-contre-attaque' }, { capacite_id: 'capacites/pugiliste-contre-attaque' }],
  };
  const contre = M.actionsDeLaFiche(regles, f).filter((a) => a.nom === 'Contre-attaque');
  assert.deepEqual(contre.map((a) => [a.cle, a.source]), [['capacite:capacites/guerrier-contre-attaque', 'Guerrier'], ['capacite:capacites/pugiliste-contre-attaque', 'Pugiliste']]);
  const g = apres(f, M.consommerLAction(regles, f, contre[0].cle));
  assert.deepEqual(M.actionsDeLaFiche(regles, g).filter((a) => a.nom === 'Contre-attaque').map((a) => a.compteur.restants), [0, 1]);
});

test('décision R173 : « Noyau dur » du Flagelleur reste parmi les passifs, sa limite en rappel (« Dans les passifs »)', () => {
  const f = { ...fiche(), classes: [{ rang: 1, classe_id: 'classes/flagelleur', specialite_id: null }], capacites: [], xp: xpDuNiveau(10) };
  assert.equal(M.actionsDeLaFiche(regles, f).some((a) => a.cle === 'capacite:capacites/flagelleur-noyau-dur'), false);
  const noyau = M.passifsDeLaFiche(regles, f).classes[0].dons.find((d) => d.don.id === 'capacites/flagelleur-noyau-dur');
  assert.deepEqual([noyau.type, noyau.precision], ['passif', '1 fois/combat']);
});

test('décision R173 : un objet changé ou retiré repart au maximum (sa ligne part) ; les compteurs des dons attendent l’enregistrement, qui nettoie les clés orphelines', () => {
  const chef = `accessoire:chef:${E('autre:16')}`;
  const arme = `arme:1:${AE('arbalete:espace-temps')}`;
  let f = fiche();
  for (const cle of [chef, arme, 'capacite:capacites/barde-prestation']) f = apres(f, M.consommerLAction(regles, f, cle));
  assert.equal(f.actions_usage.length, 3);
  // un autre accessoire au même emplacement, une autre arme au rang 1 : une autre clé, au maximum ; l'ancienne ligne part au rafraîchissement
  const change = { ...f, accessoires: f.accessoires.map((a) => (a.emplacement === 'chef' ? porte('chef', 'autre:17') : a)), armes: [{ rang: 1, arme_elementaire_id: AE('arc:lumiere') }] };
  assert.equal(action(change, `accessoire:chef:${E('autre:17')}`).compteur.restants, 1);
  assert.equal(action(change, `arme:1:${AE('arc:lumiere')}`).compteur.restants, 2);
  const nettoyee = { ...change, actions_usage: M.actionsUsageSansObjetRetire(regles, change) };
  assert.deepEqual(nettoyee.actions_usage, [{ action_id: 'capacite:capacites/barde-prestation', restants: 1 }]);
  // remis ensuite, le premier accessoire repart au maximum
  const remis = { ...nettoyee, accessoires: f.accessoires };
  assert.equal(action(remis, chef).compteur.restants, 1);
  // un don perdu (classe changée) garde sa ligne jusqu'à l'enregistrement, qui la retire ; une ligne au maximum, en double ou hors bornes est corrigée
  const autreClasse = { ...f, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }], capacites: [] };
  assert.ok(M.actionsUsageSansObjetRetire(regles, autreClasse).some((u) => u.action_id === 'capacite:capacites/barde-prestation'));
  assert.deepEqual(M.actionsUsageValables(regles, autreClasse), [{ action_id: chef, restants: 0 }, { action_id: arme, restants: 1 }]);
  const brouillon = {
    ...fiche(), actions_usage: [{ action_id: chef, restants: 7 }, { action_id: arme, restants: -3 }, { action_id: arme, restants: 1 },
      { action_id: 'race:don-de-base:races/humain', restants: '2' }, { action_id: 'capacite:capacites/barde-contournement', restants: 0 }, { action_id: 'race:inconnue', restants: 0 }],
  };
  assert.deepEqual(M.actionsUsageValables(regles, brouillon), [{ action_id: arme, restants: 0 }, { action_id: 'race:don-de-base:races/humain', restants: 2 }]);
});

test('décision R173 : la clé d’une action porte l’objet porté (cleDAction) ; seules les clés d’équipement sont liées à un objet', () => {
  assert.equal(M.cleDAction.capacite('capacites/x'), 'capacite:capacites/x');
  assert.equal(M.cleDAction.donDeBase('races/humain'), 'race:don-de-base:races/humain');
  assert.equal(M.cleDAction.accessoire('chef', E('autre:16')), `accessoire:chef:${E('autre:16')}`);
  assert.equal(M.cleDAction.arme(2, AE('masse:feu')), `arme:2:${AE('masse:feu')}`);
  assert.equal(M.cleDAction.armure(AR('lourd:glace'), 3), `armure:${AR('lourd:glace')}:3`);
  assert.deepEqual(['accessoire:x', 'arme:1:x', 'armure:x:1', 'capacite:x', 'race:don-de-base:x'].map(M.estUneActionDEquipement), [true, true, true, false, false]);
});

test('réponse du propriétaire à Q79 (« Deviennent des actions ») : les météos « (actif) » de l’armure élémentaire, sans compteur ; la relance et les 25 % de barrière, un compteur par combat que « Fin de combat » remet', () => {
  for (const id of ['leger:eau', 'intermediaire:foudre', 'leger:vent']) {
    const f = fiche({ armure_elementaire_id: AR(id) });
    const meteo = M.actionsDeLaFiche(regles, f).filter((a) => a.origine === 'armure');
    assert.equal(meteo.length, 1, id);
    assert.match(meteo[0].texte, /Invoque la météo/, id);
    assert.deepEqual([meteo[0].type, meteo[0].limite, meteo[0].compteur, meteo[0].grisee], ['actif', null, null, null], id);
    assert.ok(!M.passifsDeLaFiche(regles, f).equipement.some((x) => x.origine === 'armure' && x.texte.includes(meteo[0].texte)), `${id} : plus dans les passifs`);
  }
  for (const id of ['intermediaire:espace-temps', 'intermediaire:glace']) {
    let f = fiche({ armure_elementaire_id: AR(id) });
    const a = M.actionsDeLaFiche(regles, f).find((x) => x.origine === 'armure');
    assert.deepEqual([a.type, a.limite, a.compteur], [null, { nombre: 1, periode: 'combat', genre: 'combat' }, { max: 1, restants: 1, remontee: 'fin_de_combat' }], id);
    assert.ok(!M.passifsDeLaFiche(regles, f).equipement.some((x) => x.origine === 'armure' && x.texte.includes(a.texte)), `${id} : plus dans les passifs`);
    f = apres(f, M.consommerLAction(regles, f, a.cle));
    assert.equal(action(f, a.cle).epuisee, true, id);
    f = apres(f, M.finDeCombat(regles, f));
    assert.equal(action(f, a.cle).compteur.restants, 1, id);
  }
});

test('réponse du propriétaire à Q80 (« Non, grisée ») : la capacité d’une arme élémentaire cassée (solidité à 0, R74) est grisée, avec sa raison ; réparée, elle resert', () => {
  const cle = `arme:1:${AE('arbalete:espace-temps')}`;
  const cassee = fiche({ armes: [{ rang: 1, arme_elementaire_id: AE('arbalete:espace-temps'), durabilite: 0 }] });
  const a = action(cassee, cle);
  assert.match(a.grisee, /Arme cassée .*R74/);
  assert.deepEqual([a.utilisable, a.compteur.restants], [false, 2]);
  assert.deepEqual(M.consommerLAction(regles, cassee, cle), {});
  const reparee = fiche({ armes: [{ rang: 1, arme_elementaire_id: AE('arbalete:espace-temps'), durabilite: 1 }] });
  assert.deepEqual([action(reparee, cle).grisee, action(reparee, cle).utilisable], [null, true]);
  assert.equal(M.consommerLAction(regles, reparee, cle).actions_usage[0].restants, 1);
});

test('passifs d’équipement (« Oui, dans ce lot D ») : l’effet secondaire écrit du matériau des armes portées et le texte des améliorations portées, tels qu’écrits', () => {
  assert.equal(regles.materiaux_armes.filter((m) => m.effet_secondaire).length, 7);
  const argent = regles.materiaux_armes.find((m) => m.id === 'ressources/armures#materiau:argent');
  const fer = regles.materiaux_armes.find((m) => m.id === 'ressources/armures#materiau:fer');
  assert.equal(fer.effet_secondaire, undefined, 'sans effet secondaire, rien');
  const arme = regles.armes.find((x) => x.id === 'ressources/armes#arme:epees:epee-longue');
  const niveau = (cible, n) => regles.ameliorations.find((x) => x.cible === cible && x.niveau === n);
  const base = regles.armures.find((x) => x.type === 'Léger');
  const f = fiche({
    accessoires: [], armure_elementaire_id: null, armure_id: base.id, armure_amelioration_id: niveau('armure', 2).id,
    armes: [{ rang: 1, arme_id: arme.id, materiau_id: argent.id, amelioration_id: niveau('arme', 3).id }, { rang: 2, arme_elementaire_id: AE('masse:feu'), amelioration_id: niveau('arme', 1).id }],
    bouclier_classe_id: regles.boucliers[0].id, bouclier_materiau_id: 'ressources/armures#materiau:fer', bouclier_amelioration_id: niveau('bouclier', 4).id,
  });
  const p = M.passifsDeLaFiche(regles, f).equipement.filter((x) => ['materiau', 'amelioration'].includes(x.origine));
  const bouclier = M.bouclierDe(regles, f).nom;
  assert.deepEqual(p.map((x) => [x.origine, x.nom, x.source, x.texte]), [
    ['amelioration', 'Amélioration niveau 2', `Armure : ${base.nom}`, niveau('armure', 2).effet],
    ['materiau', argent.nom, `Arme 1 : ${arme.nom}`, argent.effet_secondaire],
    ['amelioration', 'Amélioration niveau 3', `Arme 1 : ${arme.nom}`, niveau('arme', 3).effet],
    ['amelioration', 'Amélioration niveau 1', `Arme 2 : ${regles.armes_elementaires.find((x) => x.id === AE('masse:feu')).nom}`, niveau('arme', 1).effet],
    ['amelioration', 'Amélioration niveau 4', `Bouclier : ${bouclier}`, niveau('bouclier', 4).effet],
  ]);
  // l'amélioration d'une autre cible (une fiche importée) n'est pas montrée ; celle de l'armure élémentaire, sous son nom
  assert.ok(!M.passifsDeLaFiche(regles, { ...f, armure_amelioration_id: niveau('arme', 2).id }).equipement.some((x) => x.source === `Armure : ${base.nom}`));
  const elementaire = fiche({ accessoires: [], armure_amelioration_elementaire_id: niveau('armure_elementaire', 5).id });
  assert.ok(M.passifsDeLaFiche(regles, elementaire).equipement.some((x) => x.origine === 'amelioration' && x.texte === niveau('armure_elementaire', 5).effet && x.source.startsWith('Armure élémentaire : ')));
});

test('la page (src/scripts/fiche.mjs, lue comme un texte) : une action qui quitte la liste (un accessoire qui se brise) rend le focus à sa voisine, jamais à un bouton', async () => {
  const { readFileSync } = await import('node:fs');
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const action = script.slice(script.indexOf('function elementDAction(a)'), script.indexOf('function construireActions()'));
  assert.match(action, /const place = \[\.\.\.\$\('actions'\)\.children\]\.indexOf\(li\);\s*Object\.assign\(fiche, ecrit\);\s*changer\(\);\s*if \(!li\.isConnected\) rendreLeFocusDesActions\(place\);/);
  assert.match(action, /tabindex: '-1'/, 'la ligne d’une action prend le focus');
  const rendre = action.slice(action.indexOf('function rendreLeFocusDesActions'));
  assert.match(rendre, /voisine\.focus\(\)/);
  assert.doesNotMatch(rendre, /querySelector\('button/, 'jamais un bouton');
});
