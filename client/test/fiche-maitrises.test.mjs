// Les maîtrises d'armes calculées par la fiche (lib/fiche-moteur.mjs : sourcesDeMaitrise, maitrisesParFamille, compteurDeMaitrise,
// maitriseChoixValables, maitriseApresChoix ; refonte des maîtrises, migration 0072) sur les vraies règles (lib/fiche-regles.mjs, la base construite),
// selon les décisions du propriétaire :
//   - R148 : les points de chaque famille se calculent depuis leurs sources (lignes des classes prises, dons acquis, accessoire), la fiche ne garde que
//     la famille de chaque point à choisir (maitrise_choix) ; pas de points du MJ ; une source perdue perd ses choix ;
//   - R149 : 4 points comptés au plus par famille (5 dés), les sources s'additionnent, l'excédent est signalé, jamais refusé ;
//   - R150 : « à répartir » sans limite écrite, la même famille peut revenir ; une limite écrite (Maître d'arme 2, Combattant libre 3, lignes Bimane,
//     Frappeur, Mercenaire 1) ne compte que les points de sa source, et une famille à la limite sort des autres sélecteurs de la source ;
//   - R151 : « avec l'arme déterminée avant » et le −1 de l'Épéiste suivent la maîtrise au choix de la classe, jamais sous 0 ; le Ménestrel, les quatre
//     familles à distance ; l'accessoire, une famille au choix (R54 : maudit, −1) ;
//   - R152 : l'arme du bonus « de l'arme choisie » (R119) est la famille de la maîtrise au choix de la classe du don, la compétence se déduit ou se choisit
//     (R126) ;
//   - R154 : le don « Maîtrise » de l'Ocultomancien ajoute 4 NM gagnés.
// Chaque exemple est comparé à la base (une copie vivante, par le service) : v_personnage_maitrise_arme et les règles maitrise_* de v_personnage_controle.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { enregistrerFiche } from '../serveur/fiches.mjs';
import { cheminBase, ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const racine = mkdtempSync(join(tmpdir(), 'maverick-maitrises-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const vivante = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminBase({ sansExemples: false }), dossier: racine }).chemin);

const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;
const ligne = (classe, rang) => `classes/${classe}#maitrise-arme:${rang}`;
const specialite = (classe, nom) => `classes/${classe}#specialite:${nom}`;
const choix = (source, rang, famille) => ({ source, rang, arme_famille_id: famille });
const ACCESSOIRE = regles.accessoires.find((a) => a.effets.some((e) => e.cible === 'maitrise_arme'));
const accessoire = (emplacement, famille, maudit = 0) => ({ emplacement, accessoire_effet_id: ACCESSOIRE.id, valeur: null, maudit, arme_famille_id: famille });
const MAITRISABLES = regles.familles_armes.filter((f) => f.maitrisable).map((f) => f.id);
const A_DISTANCE = ['arme-de-jet', 'arc', 'arbalete', 'bombes'];

/**
 * Humain central, Feu inné ; `classes` : [[classe, spécialité ?], …] ; mono-classe au niveau global `niveau` (10 : classe de niveau 20 ; 11 : la seconde
 * classe au niveau 2, décision R2), ou bi-classe (`bi`, chaque classe au niveau global).
 */
function fiche(classes, { niveau = 11, bi = false, maitrise_choix = [], ...autres } = {}) {
  return {
    ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
    xp: xpDuNiveau(niveau), mode_classe: bi ? 'bi' : 'mono',
    classes: classes.map(([c, s = null], i) => ({ rang: i + 1, classe_id: `classes/${c}`, specialite_id: s && specialite(c, s) })),
    caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: 3, croix: 0 })),
    maitrise_choix, ...autres,
  };
}

/** Les points de chaque famille qui en a, selon le moteur : { famille: points }. */
const points = (f) => Object.fromEntries(M.maitrisesParFamille(regles, f).filter((m) => m.points).map((m) => [m.famille, m.points]));
const famille = (f, id) => M.maitrisesParFamille(regles, f).find((m) => m.famille === id);
const source = (f, id) => M.sourcesDeMaitrise(regles, f).find((s) => s.source === id);

/** Les règles maitrise_* que la fiche devrait avoir, selon le moteur, au format des `detail` de v_personnage_controle. */
function controlesDuMoteur(f) {
  const lignes = [];
  for (const s of M.sourcesDeMaitrise(regles, f)) {
    if (s.aChoisir) lignes.push(`maitrise_a_choisir ${s.source} = ${s.aChoisir}`);
    for (const p of s.parts.filter((x) => x.genre === 'choix' && x.limite !== null)) {
      const parFamille = new Map();
      for (const c of p.choisis.filter((x) => x.famille)) parFamille.set(c.famille, (parFamille.get(c.famille) ?? 0) + 1);
      for (const [id, n] of parFamille) if (n > p.limite) lignes.push(`maitrise_meme_famille ${s.source} : ${id} = ${n} / ${p.limite}`);
    }
  }
  for (const m of M.maitrisesParFamille(regles, f)) if (m.excedent) lignes.push(`maitrise_plafond ${m.famille} = ${m.points} / ${m.comptes}`);
  return lignes.sort();
}

/**
 * La fiche telle que la page l'enregistre (maitriseChoixValables) dans la base vivante : les points et les dés de v_personnage_maitrise_arme égalent
 * ceux du moteur, famille par famille, et ses règles maitrise_* celles que le moteur déduit. Rend les contrôles maitrise_* de la base.
 */
function accordAvecLaBase(f, message) {
  const envoyee = { ...f, maitrise_choix: M.maitriseChoixValables(regles, f) };
  assert.deepEqual(M.maitrisesParFamille(regles, envoyee), M.maitrisesParFamille(regles, f), `${message} : les choix enregistrés suffisent`);
  const { personnage, controles } = enregistrerFiche(vivante, envoyee);
  const vue = new Map(vivante.prepare('SELECT arme_famille_id, points, des FROM v_personnage_maitrise_arme WHERE personnage_id = ?').all(personnage.id)
    .map((r) => [r.arme_famille_id, { points: r.points, des: r.des }]));
  assert.ok([...vue.keys()].every((id) => MAITRISABLES.includes(id)), `${message} : jamais ARME DE MONSTRES (R45)`);
  for (const m of M.maitrisesParFamille(regles, f)) {
    assert.deepEqual({ points: m.points, des: m.des }, vue.get(m.famille) ?? { points: 0, des: M.maitriseDArme(regles).desSansMaitrise }, `${message} : ${m.famille}`);
  }
  const enBase = controles.filter((c) => c.regle.startsWith('maitrise_')).map((c) => `${c.regle} ${c.detail}`).sort();
  assert.deepEqual(controlesDuMoteur(f), enBase, `${message} : contrôles`);
  return enBase;
}

test('décision R148 : sans choix, seules les familles imposées ont des points ; chaque point à choisir est un choix du tiroir ; la base dit la même chose', () => {
  const f = fiche([['guerrier']], { niveau: 1 });
  assert.deepEqual(points(f), { epees: 1 });
  assert.deepEqual(M.sourcesDeMaitrise(regles, f).map((s) => [s.source, s.type, s.titre, s.texte, s.etat]), [
    [ligne('guerrier', 1), 'classe', 'Guerrier (maîtrise 1)', '1 maîtrise Épée', 'complete'],
    [ligne('guerrier', 2), 'classe', 'Guerrier (maîtrise 2)', '1 maîtrise dans une arme contact au choix  (sauf épée)', 'a_choisir'],
  ]);
  assert.deepEqual(M.compteurDeMaitrise(regles, f), { points: 2, aChoisir: 1, refus: 0 }, '« 2 points · 1 à choisir »');
  assert.deepEqual(M.choixEnAttente(regles, f).filter((c) => c.nature === 'maitrise'),
    [{ nature: 'maitrise', cle: M.cleDeChoix.maitrise(ligne('guerrier', 2), 1), libelle: 'Maîtrise à choisir : Guerrier (maîtrise 2) (1 point)' }]);
  assert.deepEqual(accordAvecLaBase(f, 'Guerrier sans choix'), [`maitrise_a_choisir ${ligne('guerrier', 2)} = 1`]);
  // le choix posé, enregistré tel quel ; retiré, il repart
  const g = { ...f, ...M.maitriseApresChoix(f, ligne('guerrier', 2), 1, 'hache') };
  assert.deepEqual(g.maitrise_choix, [choix(ligne('guerrier', 2), 1, 'hache')]);
  assert.deepEqual(points(g), { epees: 1, hache: 1 });
  assert.deepEqual(M.compteurDeMaitrise(regles, g), { points: 2, aChoisir: 0, refus: 0 });
  assert.deepEqual(M.choixEnAttente(regles, g).filter((c) => c.nature === 'maitrise'), []);
  assert.deepEqual(accordAvecLaBase(g, 'Guerrier, HACHE'), []);
  assert.deepEqual(M.maitriseApresChoix(g, ligne('guerrier', 2), 1, null), { maitrise_choix: [] });
  // les dés : 1 sans maîtrise, un de plus par point (constantes maitrise_arme.*) ; les dégâts d'une arme lisent les dés calculés
  assert.deepEqual([famille(g, 'epees').notation, famille(g, 'dagues').notation], ['2D10', '1D6']);
  const epee = regles.armes.find((a) => a.famille_id === 'epees');
  assert.equal(M.degatsDArme(regles, { ...g, armes: [{ rang: 1, arme_id: epee.id }] }, 1).nombre, 2);
});

test('décision R148 : un choix hors des options (ARME DE MONSTRES comprise, R45), d’un point que la part n’a pas ou d’une source perdue n’est pas gardé', () => {
  const g = fiche([['guerrier', 'maitre-darme']], {
    niveau: 10,
    maitrise_choix: [choix(ligne('guerrier', 2), 1, 'epees'), choix(ligne('guerrier', 2), 2, 'hache'), choix('capacites/guerrier-maitre-darme', 1, 'arme-de-monstres'),
      choix('capacites/guerrier-maitre-darme', 2, 'arc'), choix('capacites/guerrier-maitre-darme', 6, 'arc'), choix('capacites/inconnu', 1, 'arc')],
  });
  assert.deepEqual(M.maitriseChoixValables(regles, g), [choix('capacites/guerrier-maitre-darme', 2, 'arc')], 'ÉPÉES n’est pas proposée (« sauf épée », R138)');
  assert.deepEqual(points(g), { epees: 1, arc: 1 });
  // une autre spécialité, un niveau plus bas : la source n'est plus acquise, ses choix partent
  assert.deepEqual(M.maitriseChoixValables(regles, { ...g, classes: [{ rang: 1, classe_id: 'classes/guerrier', specialite_id: specialite('guerrier', 'epeiste') }] }), []);
  assert.deepEqual(M.maitriseChoixValables(regles, { ...g, xp: xpDuNiveau(4) }), []);
  assert.equal(source({ ...g, xp: xpDuNiveau(4) }, 'capacites/guerrier-maitre-darme'), undefined);
  // la base signale ce que la page retire
  const { controles } = enregistrerFiche(vivante, g);
  assert.deepEqual(controles.filter((c) => c.regle.startsWith('maitrise_') && c.regle !== 'maitrise_a_choisir').map((c) => `${c.regle} ${c.detail}`).sort(), [
    'maitrise_arme_exclue capacites/guerrier-maitre-darme : 1 = arme-de-monstres',
    'maitrise_hors_choix classes/guerrier#maitrise-arme:2 : 1 = epees',
    'maitrise_source_perdue capacites/guerrier-maitre-darme : 6 = arc',
    'maitrise_source_perdue capacites/inconnu : 1 = arc',
    'maitrise_source_perdue classes/guerrier#maitrise-arme:2 : 2 = hache',
  ]);
});

test('maquette, exemple 1 : Barde Ménestrel et Mage Bleu Mage saphir — Ménestrel parmi les quatre familles à distance, le Mage saphir suit la maîtrise du Mage Bleu (R151, R152)', () => {
  const sans = fiche([['barde', 'menestrel'], ['mage-bleu', 'mage-saphir']], { niveau: 20, bi: true, maitrise_choix: [choix(ligne('barde', 1), 1, 'arc'), choix('capacites/barde-menestrel', 1, 'arbalete')] });
  // Ménestrel : les quatre familles à distance seulement (R151), indépendant de la maîtrise du Barde
  assert.deepEqual(source(sans, 'capacites/barde-menestrel').parts[0].options, A_DISTANCE);
  assert.ok(A_DISTANCE.every((id) => regles.familles_armes.find((x) => x.id === id).categorie === 'distance'));
  // sans la maîtrise au choix du Mage Bleu : le Mage saphir attend, et son bonus d'acquis aussi (R152)
  const saphir = source(sans, 'capacites/mage-bleu-mage-saphir');
  assert.equal(saphir.etat, 'attente');
  assert.deepEqual(saphir.parts, [{ rang: 1, genre: 'suit', points: 2, famille: null, options: [], limite: null,
    suit: { source: ligne('mage-bleu', 1), titre: 'Mage Bleu (maîtrise 1)', classe: 'Mage Bleu', famille: null } }]);
  assert.deepEqual(points(sans), { dagues: 1, arc: 1, arbalete: 1 });
  assert.deepEqual(M.compteurDeMaitrise(regles, sans), { points: 6, aChoisir: 3, refus: 0 }, '1 + 1 + 1 + 1 + 2 ; le Mage Bleu et les 2 du Mage saphir');
  const attente = M.choixEnAttente(regles, sans).filter((c) => c.nature === 'maitrise' || (c.nature === 'acquis' && c.cle.includes('capacites/')));
  assert.deepEqual(attente, [
    { nature: 'maitrise', cle: M.cleDeChoix.maitrise(ligne('mage-bleu', 1), 1), libelle: 'Maîtrise à choisir : Mage Bleu (maîtrise 1) (1 point)' },
    { nature: 'maitrise', cle: M.cleDeChoix.maitrise(ligne('mage-bleu', 1), 1), libelle: 'Maîtrise Mage saphir (Mage Bleu) : +2 suit la maîtrise au choix de Mage Bleu, pas encore choisie' },
    { nature: 'acquis', cle: M.cleDeChoix.acquis('capacites/barde-menestrel', 1), libelle: 'Acquis Ménestrel (Barde) : +6 % ARC : Arc ou Arme Légère' },
    { nature: 'acquis', cle: M.cleDeChoix.acquis('capacites/mage-bleu-mage-saphir', 1), libelle: 'Acquis Mage saphir (Mage Bleu) : +7 % — choisissez d’abord la maîtrise au choix de Mage Bleu' },
  ]);
  accordAvecLaBase(sans, 'exemple 1, sans la maîtrise du Mage Bleu');
  // la maîtrise posée : +2 sur ÉPÉES, verrouillé
  const avec = { ...sans, ...M.maitriseApresChoix(sans, ligne('mage-bleu', 1), 1, 'epees') };
  assert.deepEqual(points(avec), { epees: 3, dagues: 1, arc: 1, arbalete: 1 });
  assert.deepEqual(famille(avec, 'epees').detail, [
    { source: ligne('mage-bleu', 1), titre: 'Mage Bleu (maîtrise 1)', genre: 'choix', points: 1 },
    { source: 'capacites/mage-bleu-mage-saphir', titre: 'Mage saphir (Mage Bleu)', genre: 'suit', points: 2 },
  ]);
  assert.deepEqual(M.sourcesDeMaitrise(regles, avec).map((s) => s.etat), ['complete', 'complete', 'complete', 'complete', 'complete']);
  assert.deepEqual(M.compteurDeMaitrise(regles, avec), { points: 6, aChoisir: 0, refus: 0 });
  assert.deepEqual(accordAvecLaBase(avec, 'exemple 1'), []);
});

test('maquette, exemple 2 : Guerrier Épéiste, Mercenaire et l’accessoire — ÉPÉES au-delà de 4 points, signalé, 5 dés (R149) ; l’Épéiste retire 1 à la maîtrise au choix (R151)', () => {
  const f = fiche([['guerrier', 'epeiste'], ['mercenaire']], {
    maitrise_choix: [choix(ligne('guerrier', 2), 1, 'hache'), choix(ligne('mercenaire', 1), 1, 'epees'), choix(ligne('mercenaire', 1), 2, 'arc'), choix(ligne('mercenaire', 1), 3, 'dagues')],
    accessoires: [accessoire('bague-1', 'epees')],
  });
  // ÉPÉES : Guerrier 1, Épéiste 2, Mercenaire 1, accessoire 1 ; DAGUES : Épéiste 1, Mercenaire 1 ; HACHE : 1 − 1
  const epees = famille(f, 'epees');
  assert.deepEqual({ points: epees.points, comptes: epees.comptes, excedent: epees.excedent, des: epees.des, notation: epees.notation }, { points: 5, comptes: 4, excedent: 1, des: 5, notation: '5D10' });
  assert.deepEqual(points(f), { epees: 5, dagues: 2, arc: 1 });
  assert.equal(famille(f, 'hache').points, 0);
  assert.deepEqual(famille(f, 'hache').detail.map((d) => [d.titre, d.genre, d.points]), [['Guerrier (maîtrise 2)', 'choix', 1], ['Épéiste (Guerrier)', 'suit', -1]]);
  const accessoireSource = source(f, 'accessoire:bague-1');
  assert.deepEqual({ type: accessoireSource.type, titre: accessoireSource.titre, maudit: accessoireSource.maudit, etat: accessoireSource.etat },
    { type: 'accessoire', titre: 'Accessoire : Bague 1', maudit: false, etat: 'complete' });
  assert.equal(accessoireSource.texte, ACCESSOIRE.libelle, 'tel qu’écrit, « (ne peut changer une fois décidé) » compris (un rappel, R151)');
  assert.deepEqual(accessoireSource.parts[0].choisis[0].options, MAITRISABLES, 'les 11 familles maîtrisables');
  // compteur : 1 + 1 + (2 + 1 − 1) + 3 + 1
  assert.deepEqual(M.compteurDeMaitrise(regles, f), { points: 8, aChoisir: 0, refus: 0 });
  assert.deepEqual(accordAvecLaBase(f, 'exemple 2'), ['maitrise_plafond epees = 5 / 4']);
  // l'accessoire sans famille : un choix du tiroir de nature « accessoire », jamais deux fois
  const sansFamille = { ...f, accessoires: [accessoire('bague-1', null)] };
  assert.equal(source(sansFamille, 'accessoire:bague-1').etat, 'a_choisir');
  assert.deepEqual(M.choixEnAttente(regles, sansFamille).filter((c) => ['maitrise', 'accessoire'].includes(c.nature)).map((c) => [c.nature, c.cle]), [['accessoire', 'accessoire:bague-1']]);
  assert.deepEqual(accordAvecLaBase(sansFamille, 'accessoire sans famille'), ['maitrise_a_choisir accessoire:bague-1 = 1']);
});

test('décision R149 : Lancier et Lanceur Fantassin, 4 points d’ARME DE JET ; avec l’accessoire, 5 points, dont 1 au-delà du plafond, toujours 5 dés', () => {
  const f = fiche([['lanceur', 'fantassin'], ['lancier']], { maitrise_choix: [choix(ligne('lanceur', 2), 1, 'hache'), choix('capacites/lanceur-fantassin', 1, 'hache')] });
  assert.equal(famille(f, 'arme-de-jet').points, 4);
  assert.deepEqual(famille(f, 'arme-de-jet').detail.map((d) => d.points), [1, 2, 1], 'Lanceur, Fantassin, Lancier : les sources s’additionnent');
  assert.deepEqual(accordAvecLaBase(f, 'Lanceur Fantassin et Lancier'), []);
  const plus = { ...f, accessoires: [accessoire('chef', 'arme-de-jet')] };
  const m = famille(plus, 'arme-de-jet');
  assert.deepEqual([m.points, m.comptes, m.excedent, m.des], [5, 4, 1, 5]);
  assert.deepEqual(accordAvecLaBase(plus, 'avec l’accessoire'), ['maitrise_plafond arme-de-jet = 5 / 4']);
  // maudit : −1 (R54)
  const maudit = { ...f, accessoires: [accessoire('chef', 'arme-de-jet', 1)] };
  assert.equal(famille(maudit, 'arme-de-jet').points, 3);
  assert.equal(source(maudit, 'accessoire:chef').maudit, true);
  accordAvecLaBase(maudit, 'accessoire maudit');
});

test('décision R150 : sans limite écrite, la même famille revient (2 points d’un don, les 5 du Chasseur de primes : 4 comptés, 1 signalé)', () => {
  const protecteur = fiche([['cuirasse', 'protecteur']], { niveau: 10, maitrise_choix: [choix('capacites/cuirasse-protecteur', 1, 'epees'), choix('capacites/cuirasse-protecteur', 2, 'epees')] });
  const s = source(protecteur, 'capacites/cuirasse-protecteur');
  assert.deepEqual(s.parts[0].choisis.map((c) => [c.famille, c.refus, c.options.length]), [['epees', false, 11], ['epees', false, 11]]);
  assert.equal(famille(protecteur, 'epees').points, 2);
  accordAvecLaBase(protecteur, 'Protecteur');
  const chasseur = fiche([['mercenaire', 'chasseur-de-primes']], { niveau: 10, maitrise_choix: [1, 2, 3, 4, 5].map((r) => choix('capacites/mercenaire-chasseur-de-primes', r, 'epees')) });
  assert.deepEqual(source(chasseur, 'capacites/mercenaire-chasseur-de-primes').parts[0].choisis.map((c) => c.refus), [false, false, false, false, false]);
  assert.deepEqual([famille(chasseur, 'epees').points, famille(chasseur, 'epees').comptes, famille(chasseur, 'epees').excedent], [5, 4, 1]);
  assert.deepEqual(famille(chasseur, 'epees').detail, [{ source: 'capacites/mercenaire-chasseur-de-primes', titre: 'Chasseur de primes (Mercenaire)', genre: 'choix', points: 5 }]);
  assert.deepEqual(accordAvecLaBase(chasseur, 'Chasseur de primes'), ['maitrise_a_choisir classes/mercenaire#maitrise-arme:1 = 3', 'maitrise_plafond epees = 5 / 4']);
});

test('décision R150 : une limite écrite — Maître d’arme 2 admis et le 3ᵉ refusé, Combattant libre 3 et le 4ᵉ, Mercenaire et Bimane 1 ; une famille à la limite sort des autres sélecteurs', () => {
  const sur = (classe, spec, source, familles) => fiche([[classe, spec]], { niveau: 10, maitrise_choix: familles.map((x, i) => choix(source, i + 1, x)) });
  const maitre = sur('guerrier', 'maitre-darme', 'capacites/guerrier-maitre-darme', ['epees', 'epees', 'epees']);
  const s = source(maitre, 'capacites/guerrier-maitre-darme');
  assert.deepEqual(s.parts[0].limite, 2);
  assert.deepEqual(s.parts[0].choisis.map((c) => [c.famille, c.refus]), [['epees', false], ['epees', false], ['epees', true], [null, false], [null, false]]);
  assert.equal(s.etat, 'refus');
  // ÉPÉES reste proposée aux deux points admis, plus aux autres
  assert.deepEqual(s.parts[0].choisis.map((c) => c.options.includes('epees')), [true, true, false, false, false]);
  assert.ok(s.parts[0].choisis.every((c) => c.options.length >= MAITRISABLES.length - 1));
  assert.equal(famille(maitre, 'epees').points, 4, 'Guerrier 1 + Maître d’arme 3 : le point refusé compte (la base le compte et le signale)');
  assert.deepEqual(M.compteurDeMaitrise(regles, maitre), { points: 7, aChoisir: 3, refus: 1 }, 'Guerrier 1 + 1, Maître d’arme 5');
  assert.deepEqual(M.maitriseChoixValables(regles, maitre).length, 3, 'un point refusé reste enregistré : seul un choix hors de la liste ne l’est pas');
  assert.deepEqual(accordAvecLaBase(maitre, 'Maître d’arme'),
    ['maitrise_a_choisir capacites/guerrier-maitre-darme = 2', `maitrise_a_choisir ${ligne('guerrier', 2)} = 1`, 'maitrise_meme_famille capacites/guerrier-maitre-darme : epees = 3 / 2']);
  const deux = sur('guerrier', 'maitre-darme', 'capacites/guerrier-maitre-darme', ['epees', 'epees']);
  assert.equal(source(deux, 'capacites/guerrier-maitre-darme').etat, 'a_choisir');
  assert.deepEqual(source(deux, 'capacites/guerrier-maitre-darme').parts[0].choisis.map((c) => c.options.includes('epees')), [true, true, false, false, false]);
  accordAvecLaBase(deux, 'Maître d’arme, 2 points');

  const libre = (n) => sur('mercenaire', 'combattant-libre', 'capacites/mercenaire-combattant-libre', Array(n).fill('arc'));
  assert.deepEqual(source(libre(3), 'capacites/mercenaire-combattant-libre').parts[0].choisis.map((c) => c.refus), [false, false, false, false, false]);
  assert.deepEqual(source(libre(4), 'capacites/mercenaire-combattant-libre').parts[0].choisis.map((c) => c.refus), [false, false, false, true, false]);
  accordAvecLaBase(libre(3), 'Combattant libre, 3 points');
  assert.ok(accordAvecLaBase(libre(4), 'Combattant libre, 4 points').includes('maitrise_meme_famille capacites/mercenaire-combattant-libre : arc = 4 / 3'));

  for (const [classe, familles] of [['mercenaire', ['hache', 'hache', 'arc']], ['bimane', ['hache', 'hache']]]) {
    const f = fiche([[classe]], { niveau: 1, maitrise_choix: familles.map((x, i) => choix(ligne(classe, 1), i + 1, x)) });
    const p = source(f, ligne(classe, 1)).parts[0];
    assert.deepEqual([p.limite, p.choisis[1].refus, p.choisis[0].options.includes('hache'), p.choisis[1].options.includes('hache')], [1, true, true, false], classe);
    assert.ok(accordAvecLaBase(f, classe).includes(`maitrise_meme_famille ${ligne(classe, 1)} : hache = 2 / 1`), classe);
  }
  // Bimane : les familles de contact seulement (« corps à corps » = contact, R151)
  const bimane = source(fiche([['bimane']], { niveau: 1 }), ligne('bimane', 1)).parts[0];
  assert.deepEqual(bimane.options, MAITRISABLES.filter((id) => !A_DISTANCE.includes(id)));
});

test('décision R151 : Mage Grenat suit la maîtrise au choix du Mage Rouge (HACHE +2) ; l’Épéiste retire 1 à celle du Guerrier, jamais sous 0', () => {
  const grenat = fiche([['mage-rouge', 'mage-grenat']], { niveau: 10, maitrise_choix: [choix(ligne('mage-rouge', 1), 1, 'hache')] });
  assert.equal(famille(grenat, 'hache').points, 3);
  assert.deepEqual(famille(grenat, 'hache').detail.find((d) => d.genre === 'suit'), { source: 'capacites/mage-rouge-mage-grenat', titre: 'Mage Grenat (Mage Rouge)', genre: 'suit', points: 2 });
  assert.deepEqual(accordAvecLaBase(grenat, 'Mage Grenat'), []);
  // un changement de la maîtrise au choix emporte les points qui la suivent
  const autre = { ...grenat, ...M.maitriseApresChoix(grenat, ligne('mage-rouge', 1), 1, 'dagues') };
  assert.deepEqual(points(autre), { dagues: 3 });
  const epeiste = fiche([['guerrier', 'epeiste']], { niveau: 10, maitrise_choix: [choix(ligne('guerrier', 2), 1, 'dagues')] });
  assert.deepEqual(points(epeiste), { epees: 3, dagues: 1 }, 'DAGUES : 1 (Guerrier) + 1 − 1 (Épéiste)');
  assert.deepEqual(accordAvecLaBase(epeiste, 'Épéiste, DAGUES'), []);
  // sous 0 : l'accessoire maudit sur la même famille
  const sous = { ...epeiste, maitrise_choix: [choix(ligne('guerrier', 2), 1, 'hache')], accessoires: [accessoire('chef', 'hache', 1)] };
  assert.equal(famille(sous, 'hache').points, 0, '1 − 1 − 1 : 0, jamais −1');
  assert.equal(famille(sous, 'hache').des, 1);
  accordAvecLaBase(sous, 'sous 0');
  // sans la maîtrise au choix : l'Épéiste attend
  const attend = { ...epeiste, maitrise_choix: [] };
  assert.equal(source(attend, 'capacites/guerrier-epeiste').etat, 'attente');
  assert.deepEqual(M.compteurDeMaitrise(regles, attend), { points: 4, aChoisir: 2, refus: 0 }, '1 + 1 + (2 + 1 − 1) ; le point du Guerrier et le −1 qui le suit');
  assert.ok(M.choixEnAttente(regles, attend).some((c) => c.libelle === 'Maîtrise Épéiste (Guerrier) : -1 suit la maîtrise au choix de Guerrier, pas encore choisie'));
  accordAvecLaBase(attend, 'Épéiste sans la maîtrise au choix');
});

test('décisions R119, R152 : l’arme du bonus est la maîtrise au choix de la classe — Tueur Flétrisseur sur ARBALÈTE, +5 Arbalète sans autre choix ; sur ÉPÉES, la compétence à choisir', () => {
  const don = 'capacites/tueur-fletrisseur';
  const tueur = (famille, acquis_choix = []) => fiche([['tueur', 'fletrisseur']], { niveau: 10, acquis_choix, maitrise_choix: famille ? [choix(ligne('tueur', 1), 1, famille)] : [] });
  const bonus = (f, k) => M.competencesDe(regles, f).find((c) => c.id === k).donsDetail.find((d) => d.nom === 'Flétrisseur (Tueur)')?.valeur ?? 0;
  const choixArme = (f) => M.acquisDesDons(regles, f).choix.find((c) => c.source === don && c.arme);
  const attente = (f) => M.choixEnAttente(regles, f).filter((c) => c.cle === M.cleDeChoix.acquis(don, 1)).map((c) => c.libelle);

  const arbalete = tueur('arbalete');
  assert.deepEqual(choixArme(arbalete), {
    source: don, rang: 1, nom: 'Flétrisseur (Tueur)', valeur: 5, arme: true, familles: MAITRISABLES, maitrise: ligne('tueur', 1), classe: 'Tueur',
    arme_famille_id: 'arbalete', options: ['arbalete'], deduite: true, choisi: 'arbalete', fait: true,
  });
  assert.equal(bonus(arbalete, 'arbalete'), 5);
  assert.deepEqual(attente(arbalete), []);
  assert.deepEqual(M.acquisChoixValables(regles, arbalete).filter((c) => c.source === don), [], 'déduite : rien d’enregistré');

  const epees = tueur('epees');
  assert.deepEqual([choixArme(epees).options, choixArme(epees).fait], [['arme-lourde', 'arme-legere'], false]);
  assert.deepEqual(attente(epees), ['Acquis Flétrisseur (Tueur) : +5 % ÉPÉES : Arme Lourde ou Arme Légère']);
  const legere = { ...epees, ...M.acquisApresChoix(epees, don, 1, 'arme-legere') };
  assert.equal(bonus(legere, 'arme-legere'), 5);
  assert.deepEqual(M.acquisChoixValables(regles, legere).filter((c) => c.source === don), [{ source: don, rang: 1, competence_id: 'arme-legere', valeur: null }], 'sans arme_famille_id (migration 0072)');
  // la maîtrise au choix change : le bonus la suit ; la compétence est gardée quand la nouvelle famille l'offre
  const arc = { ...legere, ...M.maitriseApresChoix(legere, ligne('tueur', 1), 1, 'arc') };
  assert.deepEqual([choixArme(arc).arme_famille_id, choixArme(arc).choisi, bonus(arc, 'arme-legere')], ['arc', 'arme-legere', 5]);
  const lourde = { ...epees, ...M.acquisApresChoix(epees, don, 1, 'arme-lourde') };
  const versArc = { ...lourde, ...M.maitriseApresChoix(lourde, ligne('tueur', 1), 1, 'arc') };
  assert.deepEqual([choixArme(versArc).choisi, bonus(versArc, 'arme-lourde')], [null, 0], 'l’Arc n’offre pas Arme lourde (R126) : à choisir de nouveau');
  assert.deepEqual(M.acquisChoixValables(regles, versArc).filter((c) => c.source === don), []);
  const versArbalete = { ...lourde, ...M.maitriseApresChoix(lourde, ligne('tueur', 1), 1, 'arbalete') };
  assert.deepEqual([choixArme(versArbalete).choisi, bonus(versArbalete, 'arbalete')], ['arbalete', 5]);

  // sans maîtrise posée, le bonus attend, même avec une compétence notée
  const sans = tueur(null, [{ source: don, rang: 1, competence_id: 'arme-legere', valeur: null }]);
  assert.deepEqual([choixArme(sans).arme_famille_id, choixArme(sans).options, choixArme(sans).fait], [null, [], false]);
  assert.equal(bonus(sans, 'arme-legere'), 0);
  assert.deepEqual(attente(sans), ['Acquis Flétrisseur (Tueur) : +5 % — choisissez d’abord la maîtrise au choix de Tueur']);
  assert.deepEqual(M.acquisChoixValables(regles, sans).filter((c) => c.source === don), []);
  // une famille hors des options de la maîtrise au choix ne fait pas l'arme
  assert.equal(choixArme(tueur('arme-de-monstres')).arme_famille_id, null);
  // l'arme n'est plus un choix d'acquis : aucun choix d'acquis n'a de famille
  assert.ok(M.acquisDesDons(regles, legere).choix.every((c) => !('arme_famille_id' in c) || c.arme));
});

test('décision R154 : un Ocultomancien de niveau de classe 20 a les 4 NM gagnés de son don « Maîtrise » en plus de ceux des niveaux ; aucun autre don n’en donne ; la base dit la même chose', () => {
  assert.deepEqual(regles.classes.flatMap((c) => c.dons.filter((d) => d.nm_gagnes).map((d) => [d.id, d.niveau, d.nm_gagnes])), [['capacites/ocultomancien-maitrise', 20, 4]]);
  const oculto = (niveau, sorts = []) => fiche([['ocultomancien']], { niveau, bi: true, sorts });
  const a19 = M.maitriseDesSorts(regles, oculto(19));
  const a20 = M.maitriseDesSorts(regles, oculto(20));
  assert.deepEqual([a19.dons, a20.dons], [[], [{ nom: 'Maîtrise (Ocultomancien)', nm: 4 }]]);
  assert.equal((a20.disponibles - a20.niveaux) - (a19.disponibles - a19.niveaux), 4);
  assert.equal(a20.disponibles, regles.niveaux.find((n) => n.niveau === 20).niveaux_maitrise_cumul + 4);
  assert.equal(a20.limite, a20.disponibles + a20.mj);
  assert.deepEqual([a20.maxParSort, a20.maxCompteParSort, a20.plafond], [a19.maxParSort + 1, a19.maxCompteParSort + 1, 3], 'R118, R26 : inchangés');
  // la base : sorts_nm_total compte les NM des dons
  const sorts = (total) => regles.sorts.filter((s) => s.magie_id === 'magies/magie-du-feu').slice(0, Math.ceil(total / 3))
    .map((s, i) => ({ sort_id: s.id, rang: i + 1, niveau_maitrise: Math.min(3, total - 3 * i), nm_livre: 0 }));
  const enBase = (f) => enregistrerFiche(vivante, f).controles.filter((c) => c.regle === 'sorts_nm_total').map((c) => c.detail);
  const juste = oculto(20, sorts(a20.disponibles));
  assert.equal(M.maitriseDesSorts(regles, juste).comptes, a20.disponibles);
  assert.deepEqual(enBase(juste), []);
  assert.deepEqual(enBase(oculto(20, sorts(a20.disponibles + 1))), [`${a20.disponibles + 1} / ${a20.niveaux} + 4 des dons`]);
  assert.deepEqual(enBase(oculto(19, sorts(a20.disponibles))), [`${a20.disponibles} / ${a19.niveaux}`]);
});
