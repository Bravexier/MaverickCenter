// Décision R181 du propriétaire : les dons « Variable » du Mage Bleu (Mimétisme, Mime, Principale, Secondaire, Ultime raison) obtiennent une entrée du
// tableau du bas de l'onglet Mage Bleu (« limité sa magie innée (sauf mention contraire) pour le don "secondaire" » ; « Dans le cas où il n'a pas de
// magie aquise, il ne peut pas choisir le don "secondaire" ») ; chaque entrée une seule fois (Q93) ; une entrée Actif, Action ou Réaction dans la liste
// des actions avec son compteur (Q94, comme R173) ; « (Ne peut pas être changé une fois choisi) » seulement rappelé (Q95) ; une magie sans entrée libre
// (Arcane, Espace/Temps : 3 entrées) : le don ne donne rien, la fiche le dit (Q96). Un choix d'un don qui n'est plus acquis : gardé sans effet, signalé
// (choix de game-design, comme R148). Le moteur de la page (lib/fiche-moteur.mjs : donsVariables, choixEnAttente, actionsDeLaFiche, passifsDeLaFiche,
// finDeCombat) ; ses choix à faire comparés aux règles don_obtenu_* de v_personnage_controle par le service, dans une base vivante temporaire.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { LIBELLES_DES_CONTROLES } from '../src/lib/fiche-controles.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const MAGE_BLEU = 'classes/mage-bleu';
const SAPHIR = 'classes/mage-bleu#specialite:mage-saphir';
const DON = (nom) => `capacites/mage-bleu-${nom}`;
const ENTREE = (magie, nom) => `${MAGE_BLEU}#entree:${magie}:${nom}`;
const MAGIE = { feu: 'magies/magie-du-feu', glace: 'magies/magie-de-la-glace', arcane: 'magies/magie-de-larcane', lumiere: 'magies/magie-de-la-lumiere' };
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const entreesDe = (magie) => regles.classes.find((c) => c.id === MAGE_BLEU).entrees.filter((e) => e.magie_id === magie);

/** Un Mage Bleu mono-classe (niveau de classe = 2 × niveau global) de magie innée `innee`, Mage saphir, ses dons à choix et ses dons obtenus. */
function mageBleu({ niveau = 10, innee = MAGIE.feu, acquise = null, specialite = SAPHIR, dons = ['mime', 'principale'], obtenus = [] } = {}) {
  return {
    ...ficheVide('Essai R181'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: innee, magie_acquise_id: acquise,
    xp: xpDuNiveau(niveau), classes: [{ rang: 1, classe_id: MAGE_BLEU, specialite_id: specialite }], capacites: dons.map((d) => ({ capacite_id: DON(d) })),
    dons_obtenus: obtenus.map(([don, entree]) => ({ source: DON(don), entree_id: entree })),
  };
}
const etats = (f) => M.donsVariables(regles, f).dons.map((d) => [d.source, d.etat]);
const attente = (f) => M.choixEnAttente(regles, f).filter((c) => c.nature === 'don_obtenu');
/** Les choix faits l'un après l'autre comme la page (donsObtenusApresChoix), chacun parmi les options de son don. */
function choisir(f, ...choix) {
  let g = f;
  for (const [don, entree] of choix) {
    const d = M.donsVariables(regles, g).dons.find((x) => x.source === DON(don));
    assert.ok(d.options.some((e) => e.id === entree), `${entree} est une option de ${don}`);
    g = { ...g, dons_obtenus: M.donsObtenusApresChoix(g, DON(don), entree) };
  }
  return g;
}

test('R181 : un Mage saphir de niveau de classe 20, magie innée Feu — 4 dons « Variable », 4 choix, les 4 entrées du Feu, chacune une seule fois', () => {
  const f = mageBleu();
  assert.deepEqual(etats(f), ['mimetisme', 'mime', 'principale', 'ultime-raison'].map((d) => [DON(d), 'a_choisir']));
  const feu = entreesDe(MAGIE.feu).map((e) => e.id);
  assert.equal(feu.length, 4);
  for (const d of M.donsVariables(regles, f).dons) {
    assert.deepEqual(d.options.map((e) => e.id), feu, `${d.don.nom} : les entrées de la magie innée seulement`);
    assert.equal(d.magie.id, MAGIE.feu);
  }
  // quatre choix dans le tiroir, un par don, nature don_obtenu
  assert.deepEqual(attente(f).map((c) => [c.cle, c.libelle]), [
    [`don_obtenu:${DON('mimetisme')}`, 'Don obtenu par Mimétisme (Mage Bleu) : Feu'], [`don_obtenu:${DON('mime')}`, 'Don obtenu par Mime (Mage Bleu) : Feu'],
    [`don_obtenu:${DON('principale')}`, 'Don obtenu par Principale (Mage Bleu) : Feu'], [`don_obtenu:${DON('ultime-raison')}`, 'Don obtenu par Ultime raison (Mage Bleu) : Feu'],
  ]);
  assert.equal(M.cleDeChoix.donObtenu(DON('mime')), `don_obtenu:${DON('mime')}`);
  // une entrée prise sort de la liste des autres dons
  const un = choisir(f, ['mimetisme', feu[0]]);
  for (const d of M.donsVariables(regles, un).dons.filter((x) => x.source !== DON('mimetisme'))) assert.deepEqual(d.options.map((e) => e.id), feu.slice(1));
  assert.deepEqual(M.donsVariables(regles, un).dons[0].options.map((e) => e.id), feu, 'la sienne reste dans sa liste (il peut changer)');
  // la page ne pose jamais une entrée déjà prise (la base la refuserait) : rien ne change
  assert.deepEqual(M.donsObtenusApresChoix(un, DON('mime'), feu[0]), un.dons_obtenus);
  const tous = choisir(f, ['mimetisme', feu[0]], ['mime', feu[1]], ['principale', feu[2]], ['ultime-raison', feu[3]]);
  assert.deepEqual(etats(tous).map(([, e]) => e), ['choisi', 'choisi', 'choisi', 'choisi']);
  assert.deepEqual(M.donsVariables(regles, tous).dons.map((d) => d.entree.id), feu, 'chacune une fois');
  assert.deepEqual(attente(tous), []);
  // Q95 : « Ne peut pas être changé une fois choisi » n'est qu'un rappel — le choix se change, puis se retire
  const change = { ...tous, dons_obtenus: M.donsObtenusApresChoix(tous, DON('ultime-raison'), null) };
  assert.deepEqual(etats(change).at(-1), [DON('ultime-raison'), 'a_choisir']);
  assert.deepEqual(M.donsVariables(regles, change).dons.at(-1).options.map((e) => e.id), [feu[3]]);
  assert.deepEqual(M.donsObtenusValables(regles, tous), tous.dons_obtenus);
});

test('R181 : Secondaire vise la magie acquise — sans magie acquise il ne peut pas être choisi ; avec, seules les entrées de la magie acquise', () => {
  const sans = mageBleu({ niveau: 8, dons: ['mime', 'secondaire'] });
  assert.deepEqual(etats(sans), [[DON('mimetisme'), 'a_choisir'], [DON('mime'), 'a_choisir'], [DON('secondaire'), 'sans_magie_acquise']]);
  assert.deepEqual(attente(sans).map((c) => c.cle), [`don_obtenu:${DON('mimetisme')}`, `don_obtenu:${DON('mime')}`], 'rien à choisir pour Secondaire');
  const secondaire = M.donsVariables(regles, sans).dons[2];
  assert.equal(M.texteDuDonVariable(secondaire), '→ rien : sans magie acquise, ce don ne peut pas être choisi (décision R181)');
  // la page grise l'option Secondaire (pas Principale) tant qu'il n'y a pas de magie acquise
  assert.equal(M.refusDuDon(regles, sans, DON('secondaire')), 'Sans magie acquise, ce don ne peut pas être choisi (décision R181)');
  assert.equal(M.refusDuDon(regles, sans, DON('principale')), null);
  assert.equal(M.refusDuDon(regles, { ...sans, magie_acquise_id: MAGIE.glace }, DON('secondaire')), null);
  const avec = mageBleu({ niveau: 8, acquise: MAGIE.glace, dons: ['mime', 'secondaire'] });
  const d = M.donsVariables(regles, avec).dons;
  assert.deepEqual(d.map((x) => [x.source, x.magie.id]), [[DON('mimetisme'), MAGIE.feu], [DON('mime'), MAGIE.feu], [DON('secondaire'), MAGIE.glace]]);
  assert.deepEqual(d[2].options.map((e) => e.id), entreesDe(MAGIE.glace).map((e) => e.id));
  assert.ok(d[0].options.every((e) => e.magie_id === MAGIE.feu), 'Mimétisme ne prend pas dans la magie acquise');
});

test('R181 (Q94, comme R173) : une entrée « Actif 2 fois/combat » dans les actions, consommée puis remise par « Fin de combat » ; « 1 fois/tour » en rappel', () => {
  const glace = choisir(mageBleu({ innee: MAGIE.glace, niveau: 1, dons: [] }), ['mimetisme', ENTREE('glace', 'attaque-glacante')]);
  const cle = M.cleDAction.entree(ENTREE('glace', 'attaque-glacante'));
  assert.equal(cle, `entree:${ENTREE('glace', 'attaque-glacante')}`);
  const action = () => M.actionsDeLaFiche(regles, glace).find((a) => a.cle === cle);
  const a = action();
  assert.deepEqual([a.origine, a.nom, a.source, a.type, a.precision, a.limite, a.compteur], ['don_obtenu', 'Attaque glaçante', 'Mimétisme (Mage Bleu)', 'actif',
    '2 fois/combat', { nombre: 2, periode: 'combat', genre: 'combat' }, { max: 2, restants: 2, remontee: 'fin_de_combat' }]);
  assert.equal(a.texte, entreesDe(MAGIE.glace).find((e) => e.nom === 'Attaque glaçante').effet, 'son effet tel qu’écrit');
  assert.equal(a.teinte.id, MAGIE.glace);
  assert.ok(M.finDeCombatMontree(regles, glace));
  const apres = { ...glace, ...M.consommerLAction(regles, glace, cle) };
  assert.deepEqual(M.actionsDeLaFiche(regles, apres).find((x) => x.cle === cle).compteur, { max: 2, restants: 1, remontee: 'fin_de_combat' });
  assert.deepEqual(M.actionsUsageValables(regles, apres), [{ action_id: cle, restants: 1 }], 'son compteur s’enregistre');
  const fin = { ...apres, ...M.finDeCombat(regles, apres) };
  assert.deepEqual(M.actionsDeLaFiche(regles, fin).find((x) => x.cle === cle).compteur.restants, 2, 'remis au maximum par « Fin de combat »');
  // elle n'est pas un passif ; le don « Variable » y reste, avec ce qu'il obtient
  const passifs = M.passifsDeLaFiche(regles, glace).classes[0].dons;
  assert.ok(!passifs.some((p) => p.nom === 'Attaque glaçante'));
  assert.equal(passifs.find((p) => p.don.id === DON('mimetisme') && p.origine === 'classe').obtenu, '→ Attaque glaçante');
  // « (Réaction 1 fois/tour) » : un rappel, sans compteur ; « (Action) » sans limite : listée sans compteur
  const lumiere = choisir(mageBleu({ innee: MAGIE.lumiere, niveau: 1, dons: [] }), ['mimetisme', ENTREE('lumiere', 'lumiere-de-force')]);
  const reaction = M.actionsDeLaFiche(regles, lumiere).find((x) => x.cle === M.cleDAction.entree(ENTREE('lumiere', 'lumiere-de-force')));
  assert.deepEqual([reaction.type, reaction.precision, reaction.limite.genre, reaction.compteur, reaction.utilisable], ['reaction', '1 fois/tour', 'rappel', null, false]);
  const vent = choisir(mageBleu({ innee: 'magies/magie-du-vent', niveau: 1, dons: [] }), ['mimetisme', ENTREE('vent', 'crache-spore')]);
  const crache = M.actionsDeLaFiche(regles, vent).find((x) => x.cle === M.cleDAction.entree(ENTREE('vent', 'crache-spore')));
  assert.deepEqual([crache.type, crache.precision, crache.limite, crache.compteur], ['action', null, null, null]);
});

test('R181 : une entrée Passif dans les passifs, juste après son don « Variable » (« → <entrée> ») ; aucune action', () => {
  const f = choisir(mageBleu({ niveau: 1, dons: [] }), ['mimetisme', ENTREE('feu', 'moteur-thermique')]);
  const dons = M.passifsDeLaFiche(regles, f).classes[0].dons;
  const i = dons.findIndex((p) => p.don.id === DON('mimetisme') && p.origine === 'classe');
  assert.equal(dons[i].obtenu, '→ Moteur thermique');
  const entree = entreesDe(MAGIE.feu).find((e) => e.nom === 'Moteur thermique');
  assert.deepEqual([dons[i + 1].origine, dons[i + 1].nom, dons[i + 1].source, dons[i + 1].type, dons[i + 1].texte, dons[i + 1].entree.id],
    ['don_obtenu', 'Moteur thermique', 'Mimétisme (Mage Bleu)', 'passif', entree.effet, entree.id]);
  assert.ok(!M.actionsDeLaFiche(regles, f).some((a) => a.origine === 'don_obtenu'));
  // sans choix : le don dit ce qu'il attend
  assert.equal(M.passifsDeLaFiche(regles, mageBleu({ niveau: 1, dons: [] })).classes[0].dons.find((p) => p.don.id === DON('mimetisme')).obtenu, '→ à choisir parmi les entrées de Feu');
  assert.equal(M.precisionDeLEntree({ type_brut: '(Passif]' }), null);
  assert.equal(M.infobulleDEntree(entree), `(Passif)\n${entree.effet}`);
});

test('R181 : un choix dont le don n’est plus acquis (niveau baissé, Anti-monstre au lieu de Mime, Mage Bleu retiré) est gardé sans effet et signalé', () => {
  const choix = [['mimetisme', ENTREE('glace', 'neige-permanente')], ['mime', ENTREE('glace', 'attaque-glacante')]];
  // niveau global 4 : niveau de classe 8, Mime (niveau 10) pas encore acquis — choisi d'avance
  const bas = mageBleu({ niveau: 4, innee: MAGIE.glace, dons: ['mime'], obtenus: choix });
  const v = M.donsVariables(regles, bas);
  assert.deepEqual(v.dons.map((d) => [d.source, d.etat]), [[DON('mimetisme'), 'choisi']]);
  assert.deepEqual(v.perdus.map((p) => [p.source, p.entree_id, p.don.nom, p.entree.nom]), [[DON('mime'), ENTREE('glace', 'attaque-glacante'), 'Mime', 'Attaque glaçante']]);
  assert.ok(!M.actionsDeLaFiche(regles, bas).some((a) => a.origine === 'don_obtenu'), 'sans effet');
  assert.deepEqual(M.donsObtenusValables(regles, bas), bas.dons_obtenus, 'gardé à l’enregistrement');
  // l'entrée gardée n'est plus libre (une entrée une fois par fiche, comme la base)
  const remonte = { ...bas, xp: xpDuNiveau(5), dons_obtenus: [bas.dons_obtenus[1]] };
  assert.ok(!M.donsVariables(regles, remonte).dons[0].options.some((e) => e.id === ENTREE('glace', 'attaque-glacante')));
  // Anti-monstre au lieu de Mime : Mime n'est plus acquis
  const anti = mageBleu({ niveau: 5, innee: MAGIE.glace, dons: ['anti-monstre'], obtenus: choix });
  assert.deepEqual(M.donsVariables(regles, anti).perdus.map((p) => p.source), [DON('mime')]);
  // Mage Bleu retiré : tous perdus, rien dans les actions ni les passifs
  const guerrier = { ...anti, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }], capacites: [] };
  assert.deepEqual(M.donsVariables(regles, guerrier).perdus.map((p) => p.source), [DON('mimetisme'), DON('mime')]);
  assert.deepEqual(M.donsVariables(regles, guerrier).dons, []);
  assert.deepEqual(M.donsObtenusValables(regles, guerrier), guerrier.dons_obtenus);
  // une ligne d'un don qui n'est pas « Variable », ou d'une entrée inconnue, ne s'enregistre pas ; un doublon non plus
  const sale = { ...bas, dons_obtenus: [...bas.dons_obtenus, { source: DON('vision-dacier'), entree_id: ENTREE('feu', 'gluant') },
    { source: DON('ultime-raison'), entree_id: 'classes/mage-bleu#entree:feu:inconnue' }, { source: DON('mimetisme'), entree_id: ENTREE('glace', 'peau-froide') }] };
  assert.deepEqual(M.donsObtenusValables(regles, sale), bas.dons_obtenus);
  // la base le signale : un libellé pour chacune des quatre règles
  for (const r of ['don_obtenu_sans_magie_acquise', 'don_obtenu_a_choisir', 'don_obtenu_source_perdue', 'don_obtenu_hors_liste']) assert.ok(LIBELLES_DES_CONTROLES[r], r);
});

test('R181, Q96 : Arcane ou Espace/Temps (3 entrées) pour 4 dons de magie innée — le 4ᵉ ne donne rien, et la fiche le dit', () => {
  for (const [magie, cle_] of [[MAGIE.arcane, 'arcane'], ['magies/magie-de-lespace-temps', 'espace-temps']]) {
    const entrees = entreesDe(magie).map((e) => e.id);
    assert.equal(entrees.length, 3, cle_);
    const f = choisir(mageBleu({ innee: magie }), ['mimetisme', entrees[0]], ['mime', entrees[1]], ['principale', entrees[2]]);
    const ultime = M.donsVariables(regles, f).dons.at(-1);
    assert.deepEqual([ultime.source, ultime.etat, ultime.options], [DON('ultime-raison'), 'epuise', []]);
    assert.deepEqual(attente(f), [], `${cle_} : rien à choisir`);
    const nom = regles.magies.find((m) => m.id === magie).nom;
    assert.equal(M.texteDuDonVariable(ultime), `→ rien : ${nom} n’a plus d’entrée libre, ce don ne donne rien (décision R181)`);
    assert.equal(M.passifsDeLaFiche(regles, f).classes[0].dons.find((p) => p.don.id === DON('ultime-raison')).obtenu, M.texteDuDonVariable(ultime));
  }
});

test('R181 : un choix hors de la liste (magie innée changée) est sans effet, signalé, et à refaire dans le tiroir', () => {
  const f = { ...choisir(mageBleu({ niveau: 1, dons: [] }), ['mimetisme', ENTREE('feu', 'moteur-thermique')]), magie_innee_id: MAGIE.glace };
  const d = M.donsVariables(regles, f).dons[0];
  assert.deepEqual([d.etat, d.entree, d.choisie.nom], ['hors_liste', null, 'Moteur thermique']);
  assert.equal(M.texteDuDonVariable(d), '→ Moteur thermique : hors de la liste de Glace, sans effet');
  assert.deepEqual(attente(f).map((c) => c.libelle), ['Don obtenu par Mimétisme (Mage Bleu) : Glace (le choix est hors de la liste)']);
  assert.ok(!M.passifsDeLaFiche(regles, f).classes[0].dons.some((p) => p.origine === 'don_obtenu'));
});

test('R181 : les choix à faire du moteur (nature don_obtenu) sont les règles don_obtenu_a_choisir de la base ; les choix gardés, ses autres règles', (t) => {
  const { chemin } = preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: join(dossierTemporaire('fiche-dons-variables', { t }), 'db') });
  const vivante = ouvrirBaseVivante(chemin);
  t.after(() => vivante.close());
  const enBase = (f) => enregistrerFiche(vivante, f).controles.filter((c) => c.regle.startsWith('don_obtenu')).map((c) => [c.regle, c.detail]).sort();
  const duMoteur = (f) => attente(f).map((c) => ['don_obtenu_a_choisir', c.cle.slice('don_obtenu:'.length)]).sort();
  const arcane = entreesDe(MAGIE.arcane).map((e) => e.id);
  const cas = [
    ['Mage saphir Feu, rien de choisi', mageBleu()],
    ['Mage saphir Feu, deux choix', choisir(mageBleu(), ['mimetisme', ENTREE('feu', 'deflagration')], ['ultime-raison', ENTREE('feu', 'sang-de-feu')])],
    ['Arcane, trois choix (Q96)', choisir(mageBleu({ innee: MAGIE.arcane }), ['mimetisme', arcane[0]], ['mime', arcane[1]], ['principale', arcane[2]])],
    ['Arcane, deux choix', choisir(mageBleu({ innee: MAGIE.arcane }), ['mimetisme', arcane[0]], ['mime', arcane[1]])],
    ['Secondaire avec magie acquise', mageBleu({ niveau: 8, acquise: MAGIE.glace, dons: ['mime', 'secondaire'] })],
  ];
  cas.forEach(([quoi, f], i) => assert.deepEqual(enBase({ ...f, nom: `Essai R181 moteur ${i}` }), duMoteur(f), quoi));
  // sans magie acquise : la base signale Secondaire, le moteur ne le met pas dans le tiroir (refusDuDon grise l'option)
  const sans = mageBleu({ niveau: 8, dons: ['mime', 'secondaire'] });
  assert.deepEqual(enBase({ ...sans, nom: 'Essai R181 moteur sans acquise' }), [...duMoteur(sans), ['don_obtenu_sans_magie_acquise', DON('secondaire')]].sort());
  // un choix d'avance (Mime au niveau de classe 8) : gardé, source perdue pour la base comme pour le moteur
  const avance = mageBleu({ niveau: 4, dons: ['mime'], obtenus: [['mimetisme', ENTREE('feu', 'deflagration')], ['mime', ENTREE('feu', 'sang-de-feu')]] });
  assert.deepEqual(enBase({ ...avance, nom: 'Essai R181 moteur avance' }), [['don_obtenu_source_perdue', `${DON('mime')} = ${ENTREE('feu', 'sang-de-feu')}`]]);
  assert.deepEqual(M.donsVariables(regles, avance).perdus.map((p) => `${p.source} = ${p.entree_id}`), [`${DON('mime')} = ${ENTREE('feu', 'sang-de-feu')}`]);
});
