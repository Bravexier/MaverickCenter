// Refonte de la fiche (demandes du propriétaire, 2026-10-11) sur les vraies règles (lib/fiche-regles.mjs, la base construite) : le don de base de la race sous
// son nom (Méditation ou Repos), les choix qui restent à faire (tiroir des choix), l'attaque à deux armes (décision R46 : −20 % / −40 %, moitié
// avec une dague, moitié pour un Bimane, cumulables), les dégâts d'une arme avec ses bonus (équipement et dons passifs), le Mode Hyper, les avantages et
// inconvénients des postures (décision R47) ; le portrait et la ceinture enregistrés par le service (migration 0031).
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche, lireFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import { armesApresChoix, attaqueADeuxArmes, choixEnAttente, degatsDArme, donDeBase, maitriseDArme, modeHyperDe } from '../src/lib/fiche-moteur.mjs';
import { forgerArme } from '../src/lib/arme-forge.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const arme = (famille, nom) => {
  const a = regles.armes.find((x) => x.famille_id === famille && x.nom === nom);
  assert.ok(a, `${famille} : ${nom}`);
  return a.id;
};

/** Felfe forestier, Vide inné, Archer ; niveau global `niveau` (mono-classe : classe 1 au double). */
function archer(niveau, surcharge = {}) {
  return {
    ...ficheVide('Essai'), race_id: 'races/felfe', ethnie_id: 'races/felfe#ethnie:felfe-forestier', magie_innee_id: 'magies/magie-du-vide', xp: xpDuNiveau(niveau),
    classes: [{ rang: 1, classe_id: 'classes/archer', specialite_id: null }], ...surcharge,
  };
}

test('don de base : « Méditation » ou « Repos » selon la race, ses parenthèses jointes par « · »', () => {
  assert.deepEqual(donDeBase('Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 chakra (jet de calme en stress)).'),
    { nom: 'Méditation', texte: 'Action 3 fois/jour · Permet de récupérer 3d6 + 6 chakra (jet de calme en stress).' });
  assert.deepEqual(donDeBase('Un texte sans parenthèse'), { nom: 'Don de base', texte: 'Un texte sans parenthèse' });
  assert.deepEqual(donDeBase(null), { nom: 'Don de base', texte: null });
  const noms = new Set(regles.races.map((r) => donDeBase(r.don_base).nom));
  assert.deepEqual([...noms].sort(), ['Méditation', 'Repos'], 'chaque race a Méditation ou Repos');
  assert.equal(donDeBase(regles.races.find((r) => r.id === 'races/kitsune').don_base).nom, 'Repos');
});

test('choix à faire : spécialité au niveau de classe 10, dons à choisir, bonus et objet du métier, +1 d’une magie au choix', () => {
  assert.deepEqual(choixEnAttente(regles, archer(1)), [], 'niveau 1 : rien à choisir');
  assert.deepEqual(choixEnAttente(regles, archer(5)).map((c) => c.nature), ['specialite'], 'classe niveau 10 : la spécialité');
  const specialite = 'classes/archer#specialite:tireur-delite';
  const avecSpecialite = archer(5, { classes: [{ rang: 1, classe_id: 'classes/archer', specialite_id: specialite }] });
  assert.deepEqual(choixEnAttente(regles, avecSpecialite).map((c) => c.nature), ['don'], 'puis le don de niveau 10 de la spécialité');
  assert.match(choixEnAttente(regles, avecSpecialite)[0].libelle, /Archer niv\. 10 : Archer monté ou Coup inéluctable/);
  assert.match(choixEnAttente(regles, avecSpecialite)[0].cle, /^don:1:capacites\/archer-/);
  assert.equal(choixEnAttente(regles, archer(5))[0].cle, 'specialite:1');
  assert.deepEqual(choixEnAttente(regles, { ...avecSpecialite, capacites: [{ capacite_id: 'capacites/archer-coup-ineluctable' }] }), []);
  // le Chasseur : « +2% Arc OU Arbalète » et « Arc en acier (Arme) » ou « Arbalète en acier (Arme) »
  const chasseur = archer(1, { metier_id: 'metiers/chasseur' });
  assert.deepEqual(choixEnAttente(regles, chasseur).map((c) => c.nature), ['metier_bonus', 'metier_objet']);
  assert.deepEqual(choixEnAttente(regles, chasseur).map((c) => c.cle), ['metier_bonus:1', 'metier_objet:1'], 'la clé de la tuile de chaque choix (infobulle du tiroir)');
  assert.deepEqual(choixEnAttente(regles, { ...chasseur, metier_bonus: [{ rang: 1, competence_id: 'arc' }], inventaire: [{ rang: 1, nom: 'Arc en acier (Arme)', quantite: 1 }] }), []);
  // le Potentiel Illimité laisse son +1 au choix
  const potentiel = { ...ficheVide('PI'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/potentiel-illimite' };
  assert.deepEqual(choixEnAttente(regles, potentiel).map((c) => c.nature), ['carac_magie']);
  assert.deepEqual(choixEnAttente(regles, { ...potentiel, caracteristique_magie_id: 'force' }), []);
});

test('attaque à deux armes (décision R46) : −20 % / −40 %, moitié avec une dague, moitié pour un Bimane, cumulables', () => {
  const armes = (a1, a2) => [{ rang: 1, arme_id: a1 }, { rang: 2, arme_id: a2 }];
  const epee = arme('epees', 'Épée Longue');
  const dague = arme('dagues', 'Dague');
  const malus = (f) => attaqueADeuxArmes(regles, f)?.mains.map((m) => m.malus) ?? null;
  const guerrier = (a) => ({ ...ficheVide('G'), race_id: 'races/humain', xp: 0, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }], armes: a });
  const bimane = (a) => ({ ...guerrier(a), classes: [{ rang: 1, classe_id: 'classes/bimane', specialite_id: null }] });
  assert.deepEqual(malus(guerrier(armes(epee, epee))), [20, 40]);
  assert.deepEqual(malus(guerrier(armes(epee, dague))), [20, 20], 'la dague, en main secondaire');
  assert.deepEqual(malus(bimane(armes(epee, dague))), [10, 10], '« un bimane avec une épée et une dague aura −10 % et −10 % »');
  assert.deepEqual(malus(bimane(armes(dague, dague))), [5, 10], '« avec deux dagues −5 % et −10 % »');
  assert.equal(attaqueADeuxArmes(regles, guerrier(armes(arme('arc', 'Arc'), dague))), null, 'un arc : pas d’attaque à deux armes');
  assert.equal(attaqueADeuxArmes(regles, guerrier([{ rang: 1, arme_id: epee }])), null, 'une seule arme');
});

test('dégâts d’une arme : dés de la maîtrise, dé de l’arme, bonus de l’équipement et des dons passifs qui la visent', () => {
  const acier = regles.materiaux_armes.find((m) => m.nom === 'Acier');
  const niveau1 = regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === 1);
  const fiche = archer(6, {
    classes: [{ rang: 1, classe_id: 'classes/archer', specialite_id: 'classes/archer#specialite:tireur-delite' }],
    maitrises_armes: [{ arme_famille_id: 'arc', des: maitriseDArme(regles).desDe(3) }],
    armes: [{ rang: 1, arme_id: arme('arc', 'Arc'), materiau_id: acier.id, amelioration_id: niveau1.id }],
  });
  const d = degatsDArme(regles, fiche, 1);
  assert.equal(d.notation, '4D8');
  assert.deepEqual(d.bonus, [{ nom: 'Composition : Acier', valeur: acier.bonus_degats }, { nom: 'Amélioration niveau 1', valeur: niveau1.bonus_degats }]);
  assert.equal(d.texte, `4D8+${acier.bonus_degats + niveau1.bonus_degats}`);
  // « Donne +5% à la Compétence « Arc » et augmente les dégâts de 3 » : les armes visées ne sont pas écrites, le bonus n'est pas compté
  assert.deepEqual(d.nonComptes.find((n) => n.nom.startsWith('Tir renforcé')), { nom: 'Tir renforcé (Archer)', valeur: 3, raison: 'portee' });
  assert.equal(degatsDArme(regles, fiche, 2), null, 'pas d’arme 2');
  // formule au niveau de la classe : « 3+x dégâts avec une arme de jet / x = +2 dégâts/6 niveaux du lanceur » (lanceur niveau 12 : 3 + 2 × 2)
  const jet = regles.armes.find((a) => a.famille_id === 'arme-de-jet');
  const lanceur = { ...archer(6), classes: [{ rang: 1, classe_id: 'classes/lanceur', specialite_id: null }], armes: [{ rang: 1, arme_id: jet.id }] };
  const oh = degatsDArme(regles, lanceur, 1).bonus.find((b) => b.nom.startsWith('Oh hisse'));
  assert.equal(oh?.valeur, 7);
});

test('arme choisie : le fer par défaut (décision R49) ; le matériau, l’amélioration et l’élément déjà choisis restent ; vide retire la ligne', () => {
  const fer = regles.materiau_arme_defaut;
  assert.ok(fer && regles.materiaux_armes.find((m) => m.id === fer)?.nom === 'Fer', 'le fer du tableau des matériaux d’arme');
  const epee = regles.armes.find((a) => a.famille_id === 'epees');
  const dague = regles.armes.find((a) => a.famille_id === 'dagues');
  const titane = regles.materiaux_armes.find((m) => m.id.endsWith('#materiau:titane'));
  assert.deepEqual(armesApresChoix(regles, { armes: [] }, 1, epee.id), [{ rang: 1, arme_id: epee.id, materiau_id: fer }]);
  const avecTitane = { armes: [{ rang: 1, arme_id: epee.id, materiau_id: titane.id, amelioration_id: 'x' }, { rang: 2, arme_id: dague.id, materiau_id: fer }] };
  assert.deepEqual(armesApresChoix(regles, avecTitane, 1, dague.id)[0], { rang: 1, arme_id: dague.id, materiau_id: titane.id, amelioration_id: 'x' });
  assert.deepEqual(armesApresChoix(regles, avecTitane, 2, null), [avecTitane.armes[0]]);
});

test('dégâts de la fiche = ceux de la page des armes (lib/arme-forge.mjs) : le dé de l’arme, son bonus, celui du matériau et de l’amélioration', () => {
  // l'exemple du propriétaire, lu dans la base : Espadon en titane, amélioration +5 (D10+29 tant que la base n'a pas changé)
  const espadon = regles.armes.find((a) => a.id === 'ressources/armes#arme:epees:espadon');
  const titane = regles.materiaux_armes.find((m) => m.id.endsWith('#materiau:titane'));
  const plus5 = regles.ameliorations.find((a) => a.cible === 'arme' && a.niveau === 5);
  const fiche = { ...archer(6), classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: null }], armes: [{ rang: 1, arme_id: espadon.id, materiau_id: titane.id, amelioration_id: plus5.id }] };
  const d = degatsDArme(regles, fiche, 1);
  const f = forgerArme({ de: espadon.de, bonus_degats: espadon.bonus_degats, durabilite: 2, cout_ro: 0 }, { ...titane, cran_solidite: 0, prix_ro: 0 },
    regles.ameliorations.filter((a) => a.cible === 'arme').map((a) => ({ ...a, cout_ro: 0, cout_materiaux: 0, bonus_cran: 0 })), 5);
  assert.equal(d.de, espadon.de, 'le dé de l’arme, pas celui de son type');
  const donsDeClasse = d.bonus.filter((b) => !b.nom.startsWith('Composition') && !b.nom.startsWith('Amélioration') && b.nom !== espadon.nom).reduce((s, b) => s + b.valeur, 0);
  assert.equal(d.total - donsDeClasse, f.bonus.total);
});

test('Mode Hyper : débloqué au niveau 2, Mode Hyper 100 % au niveau 10 ; effets de base, de la magie (mono ou bi) et de la race', () => {
  assert.equal(regles.mode_hyper.niveau, 2);
  assert.equal(regles.mode_hyper.cent.niveau, 10);
  assert.equal(regles.mode_hyper.cent.effets.length, 4);
  assert.ok(regles.mode_hyper.effets.some((e) => /\+15/.test(e)), 'effets de base de la fiche (décision R5 : +15)');
  const h1 = modeHyperDe(regles, archer(1));
  assert.equal(h1.debloque, false);
  const h6 = modeHyperDe(regles, archer(6));
  assert.equal(h6.debloque, true);
  assert.equal(h6.cent.debloque, false);
  assert.equal(h6.magies.length, 1);
  assert.equal(h6.magies[0].effet, regles.mode_hyper.magies['magies/magie-du-vide'].mono);
  assert.equal(h6.race.nom, regles.mode_hyper.races['races/felfe'].nom);
  const bi = modeHyperDe(regles, archer(10, { magie_acquise_id: 'magies/magie-du-vent' }));
  assert.equal(bi.cent.debloque, true);
  assert.deepEqual(bi.magies.map((m) => m.effet), [regles.mode_hyper.magies['magies/magie-du-vide'].bi, regles.mode_hyper.magies['magies/magie-du-vent'].bi]);
});

test('postures (décision R47, capture de la fiche) : cases dans l’ordre Offensif, Neutre, Défensif, Focus, Vigilance, Symbiose ; inconvénients en rouge', () => {
  const parId = Object.fromEntries(regles.postures.map((p) => [p.id.split(':').pop(), p]));
  assert.deepEqual(regles.ordre_postures.map((id) => id.split(':').pop()), ['offensif', 'neutre', 'defensif', 'focus', 'vigilance', 'symbiose']);
  assert.deepEqual(regles.ordre_postures.slice().sort(), regles.postures.map((p) => p.id).sort(), 'les six postures de la base');
  const inconvenients = (slug) => parId[slug].effets.filter((_, i) => parId[slug].inconvenients.includes(i + 1));
  // les lignes encadrées en rouge sur la capture du propriétaire
  assert.deepEqual(inconvenients('offensif'), ['Malus de 10% pour toucher une cible', 'Esquive/Parade impossible']);
  assert.deepEqual(inconvenients('defensif'), ['Divise par 2 les dégâts infligés (division AVANT l\'armure)']);
  assert.deepEqual(inconvenients('neutre'), ['2 esquives/parades par tour']);
  assert.deepEqual(inconvenients('focus'), ['Esquive/Parade impossible']);
  assert.deepEqual(inconvenients('vigilance'), ['1 seule parade/esquive par tour']);
  assert.deepEqual(inconvenients('symbiose'), ['Impossible d\'utiliser les armes ou objets', '1 seule parade/esquive par tour', 'Une seule magie active']);
});

test('choix à faire : l’ethnie d’une race choisie qui en a', () => {
  const sansEthnie = archer(1, { ethnie_id: null });
  assert.deepEqual(choixEnAttente(regles, sansEthnie).map((c) => c.nature), ['ethnie']);
  assert.match(choixEnAttente(regles, sansEthnie)[0].libelle, /Ethnie : Felfe/);
  assert.deepEqual(choixEnAttente(regles, { ...ficheVide('Vide') }), [], 'une fiche neuve n’a encore rien à choisir');
});

test('portrait et ceinture (migration 0031) : enregistrés par le service avec la fiche, relus tels quels ; la base borne le cadrage et la ceinture', () => {
  const racine = mkdtempSync(join(tmpdir(), 'maverick-refonte-'));
  after(() => rmSync(racine, { recursive: true, force: true }));
  const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);
  const image = `data:image/webp;base64,${'A'.repeat(2000)}`;
  const fiche = {
    ...archer(2), portrait: image, portrait_x: 0.4, portrait_y: 0.25, portrait_zoom: 1.8,
    ceinture: [{ rang: 1, nom: 'Carquois normal (10)', quantite: 10, ressource_id: null }, { rang: 3, nom: 'Corde', quantite: 1, ressource_id: null }],
  };
  const { personnage } = enregistrerFiche(vivante, fiche);
  const relue = lireFiche(vivante, personnage.id);
  assert.equal(relue.portrait, image);
  assert.deepEqual([relue.portrait_x, relue.portrait_y, relue.portrait_zoom], [0.4, 0.25, 1.8]);
  assert.deepEqual(relue.ceinture.map((o) => [o.rang, o.nom, o.quantite]), [[1, 'Carquois normal (10)', 10], [3, 'Corde', 1]], 'les emplacements gardent leur rang');
  assert.throws(() => enregistrerFiche(vivante, { ...fiche, ceinture: [{ rang: 4, nom: 'Torche', quantite: 1 }] }), (e) => e.statut === 400, '3 emplacements au plus');
  assert.throws(() => enregistrerFiche(vivante, { ...fiche, portrait_zoom: 5 }), (e) => e.statut === 400, 'zoom de 1 à 4');
  assert.throws(() => enregistrerFiche(vivante, { ...fiche, portrait: 'https://exemple.org/image.png' }), (e) => e.statut === 400, 'une data URL d’image');
  vivante.close();
});
