// Le bouclier de la fiche (décision R96 : « Forme + matière », comme l'onglet Boucliers de /ressources/equipement/), la défense totale et les dégâts
// reçus (décision R98), la liste des effets d'accessoire (décision R97) et les propositions du sac (demande du propriétaire du 2026-10-17 : « un
// véritable autocomplete […] à partir de 2 caractères »). Le bouclier de la fiche refait le calcul de lib/armure-forge.mjs#forgerBouclier (le moteur ne
// peut pas l'importer : deux scripts de page ne partagent jamais un module) : comparé ici sur TOUTES les formes × matières × améliorations 0 à 5.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { forgerBouclier } from '../src/lib/armure-forge.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const lignes = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const AMELIORATIONS = lignes("SELECT * FROM amelioration_equipement WHERE cible = 'bouclier' ORDER BY niveau");
const ameliorationDuNiveau = (n) => regles.ameliorations.find((a) => a.cible === 'bouclier' && a.niveau === n);
const fiche = (x = {}) => ({ ...ficheVide('Essai'), race_id: 'races/humain', ...x });

test('bouclierDe (R96) : AP, AM et solidité de la page Équipement (forgerBouclier) pour chaque forme, matière et amélioration ; le poids du bouclier de la liste', () => {
  let n = 0;
  for (const b of lignes('SELECT b.*, m.solidite FROM bouclier b JOIN materiau_bouclier m ON m.ressource_id = b.materiau_id')) {
    for (const niveau of [0, 1, 2, 3, 4, 5]) {
      const f = fiche({ bouclier_classe_id: b.classe_id, bouclier_materiau_id: b.materiau_id, bouclier_amelioration_id: ameliorationDuNiveau(niveau)?.id ?? null });
      const page = forgerBouclier(b, { solidite: b.solidite, prix_ro: null }, AMELIORATIONS, niveau);
      const x = M.bouclierDe(regles, f);
      assert.deepEqual([x.bouclier.id, x.ap, x.am, x.solidite.max], [b.id, page.ap.total, page.am.total, page.solidite.total], `${b.nom} +${niveau}`);
      assert.equal(x.poids?.id ?? null, b.poids_id, b.nom);
      n += 1;
    }
  }
  assert.equal(n, 100 * 6, 'les 100 boucliers de la liste');
});

test('bouclierDe : forme seule, solidité du moment bornée, Force minimum du poids (« il est nécessaire d’avoir le score de Force ou plus »)', () => {
  assert.equal(M.bouclierDe(regles, fiche()), null, 'sans forme');
  const seule = M.bouclierDe(regles, fiche({ bouclier_classe_id: 'ecu' }));
  assert.deepEqual([seule.forme.id, seule.matiere, seule.bouclier, seule.solidite, seule.ap], ['ecu', null, null, null, 0]);
  const lourd = lignes("SELECT b.classe_id, b.materiau_id, p.force_min FROM bouclier b JOIN bouclier_poids p ON p.id = b.poids_id WHERE p.force_min >= 3 LIMIT 1")[0];
  const f = fiche({ bouclier_classe_id: lourd.classe_id, bouclier_materiau_id: lourd.materiau_id });
  const avecForce = (base) => ({ ...f, caracteristiques: regles.caracteristiques.map((k) => ({ caracteristique_id: k.id, base: k.id === 'force' ? base : 1, croix: 0 })) });
  assert.equal(M.bouclierDe(regles, avecForce(lourd.force_min - 1)).forceManquante, true);
  assert.equal(M.bouclierDe(regles, avecForce(lourd.force_min)).forceManquante, false);
  const max = M.bouclierDe(regles, f).solidite.max;
  assert.equal(M.soliditeDuBouclierAEcrire(regles, f, max), null, 'au maximum : rien d’enregistré');
  assert.equal(M.soliditeDuBouclierAEcrire(regles, f, max + 3), null);
  assert.equal(M.soliditeDuBouclierAEcrire(regles, f, -2), 0);
  assert.equal(M.soliditeDuBouclierAEcrire(regles, fiche({ bouclier_classe_id: 'ecu' }), 1), null, 'sans matière, pas de solidité');
  const casse = M.bouclierDe(regles, { ...f, bouclier_solidite: 0 }).solidite;
  assert.deepEqual([casse.actuelle, casse.cassee], [0, true]);
});

test('bouclierApresChoix : une autre forme ou matière est neuve ; sans forme, rien ; une autre amélioration borne la solidité', () => {
  const f = fiche({ bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer', bouclier_amelioration_id: ameliorationDuNiveau(5).id, bouclier_solidite: 4 });
  assert.equal(M.bouclierApresChoix(regles, f, 'bouclier_materiau_id', 'ressources/armures#materiau:bois').bouclier_solidite, null);
  assert.equal(M.bouclierApresChoix(regles, f, 'bouclier_classe_id', 'targe').bouclier_solidite, null);
  assert.deepEqual(M.bouclierApresChoix(regles, f, 'bouclier_classe_id', ''),
    { bouclier_classe_id: null, bouclier_materiau_id: null, bouclier_amelioration_id: null, bouclier_solidite: null });
  // Fer : solidité 3 ; +5 : +2 crans (R76), 5 ; sans amélioration : 3, la solidité 4 enregistrée devient « à son maximum »
  assert.equal(M.bouclierApresChoix(regles, f, 'bouclier_amelioration_id', '').bouclier_solidite, null);
  assert.equal(M.bouclierApresChoix(regles, f, 'bouclier_amelioration_id', ameliorationDuNiveau(4).id).bouclier_solidite, null, '+4 : 4 crans, 4 = le maximum');
  assert.equal(M.bouclierApresChoix(regles, { ...f, bouclier_solidite: 2 }, 'bouclier_amelioration_id', ameliorationDuNiveau(1).id).bouclier_solidite, 2);
});

test('defenseDe (R98) : base, accessoires, armure portée et son amélioration ; une armure élémentaire et son amélioration du tableau élémentaire (R99, R165) ; le bouclier à part', () => {
  const armure = regles.armures.find((a) => a.ap >= 2 && a.am >= 1);
  const amelioration = regles.ameliorations.find((a) => a.cible === 'armure' && a.niveau === 3);
  const f = fiche({ armure_id: armure.id, armure_amelioration_id: amelioration.id });
  const base = M.attributsDe(regles, f);
  const d = M.defenseDe(regles, f);
  assert.equal(d.ap.total, base.ap + armure.ap + amelioration.bonus_ap);
  assert.equal(d.am.total, base.am + armure.am + amelioration.bonus_am);
  assert.equal(d.ap.armure, armure.ap + amelioration.bonus_ap, 'la part de l’armure portée');
  assert.equal(d.bouclier, null);
  const element = regles.armures_elementaires.find((e) => e.ap !== armure.ap);
  const ameliorationElement = regles.ameliorations.find((a) => a.cible === 'armure_elementaire' && a.niveau === 2);
  // décision R165 : l'armure élémentaire est l'armure de la fiche (une fiche d'avant qui porte encore les deux : l'armure élémentaire, que la conversion garde)
  for (const g of [{ ...f, armure_id: null, armure_amelioration_id: null }, f]) {
    const e = M.defenseDe(regles, { ...g, armure_elementaire_id: element.id, armure_amelioration_elementaire_id: ameliorationElement.id });
    assert.equal(e.ap.total, base.ap + (element.ap ?? 0) + ameliorationElement.bonus_ap);
    assert.equal(e.element.id, element.id);
  }
  const b = M.defenseDe(regles, { ...f, bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer' });
  assert.equal(b.ap.total, d.ap.total, 'le bouclier ne compte qu’en parade partielle');
  assert.ok(b.bouclier.ap > 0);
  // les accessoires « Les AP de base augmentent de 5 »
  const acc = regles.accessoires.find((a) => a.effets.some((c) => c.cible === 'armure_ap'));
  const avec = M.defenseDe(regles, { ...f, accessoires: [{ emplacement: 'chef', accessoire_effet_id: acc.id, valeur: null, maudit: 0 }] });
  assert.equal(avec.ap.total - d.ap.total, acc.effets.find((c) => c.cible === 'armure_ap').valeur);
});

test('degatsRecus (R98) : la formule du guide (« Les dégâts ») — armure, défense partielle ÷ 2, résistance ou faiblesse ; arrondi à l’inférieur', () => {
  // physique : l'armure résiste à un type (AP × 2), y est faible (AP ÷ 2), « x2 » double l'effet (réponse « Sur les AP »)
  const avec = (sens, multiplicateur) => regles.armures.find((a) => a.ap >= 2 && a.degats.some((r) => r.sens === sens && r.multiplicateur === multiplicateur));
  for (const [sens, multiplicateur, facteur] of [['resistance', 1, 2], ['vulnerabilite', 1, 0.5], ['resistance', 2, 4], ['vulnerabilite', 2, 0.25]]) {
    const armure = avec(sens, multiplicateur);
    const type = armure.degats.find((r) => r.sens === sens && r.multiplicateur === multiplicateur).type;
    const f = fiche({ armure_id: armure.id });
    const d = M.defenseDe(regles, f);
    const r = M.degatsRecus(regles, f, { entrants: 100, type });
    assert.equal(r.recus, Math.floor(Math.max(0, 100 - (d.ap.total - d.ap.armure + armure.ap * facteur))), `${armure.nom} : ${sens} ×${multiplicateur} ${type}`);
    // défense partielle : ÷ 2 après l'armure
    assert.equal(M.degatsRecus(regles, f, { entrants: 100, type, reduits: true }).recus, Math.floor(Math.max(0, 100 - r.armure) / 2));
  }
  // l'exemple 1 du guide : 20 dégâts de frappe, 5 AP qui résistent à la frappe (AP comptés double) → 10
  const frappe = regles.armures.find((a) => a.ap === 5 && a.degats.some((r) => r.sens === 'resistance' && r.type === 'frappe' && r.multiplicateur === 1)
    && !a.degats.some((r) => r.type === 'frappe' && r.sens !== 'resistance'));
  assert.ok(frappe, 'une armure de 5 AP qui résiste à la frappe (l’exemple du guide)');
  assert.equal(M.degatsRecus(regles, fiche({ armure_id: frappe.id }), { entrants: 20, type: 'frappe' }).recus, 10);
  // magie : l'AM, puis le palier de résistance (Feu : la magie innée du personnage lui résiste d'un cran, ÷ 2)
  const feu = fiche({ magie_innee_id: 'magies/magie-du-feu' });
  const palier = M.resistancesDe(regles, feu).paliers.find((p) => p.cibles.some((c) => c.id === 'magies/magie-du-feu'));
  const mult = regles.resistance_paliers.find((p) => p.id === palier.id).multiplicateur;
  const am = M.defenseDe(regles, feu).am.total;
  assert.equal(M.degatsRecus(regles, feu, { entrants: 41, type: 'magies/magie-du-feu' }).recus, Math.floor(Math.max(0, 41 - am) * mult));
  // le bouclier : seulement en parade partielle au bouclier
  const b = fiche({ bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer' });
  const sans = M.degatsRecus(regles, b, { entrants: 30, type: 'taille', reduits: true }).recus;
  const parade = M.degatsRecus(regles, b, { entrants: 30, type: 'taille', reduits: true, parade: true }).recus;
  assert.equal(sans - parade, Math.floor(30 / 2) - Math.floor(Math.max(0, 30 - M.bouclierDe(regles, b).ap) / 2));
  assert.equal(M.degatsRecus(regles, b, { entrants: 30, type: 'taille', parade: true }).recus, 30, 'sans défense partielle, pas de bouclier');
  // « ÷ 2 si un don divise les dégâts » : à cocher, après la défense partielle
  assert.equal(M.degatsRecus(regles, b, { entrants: 30, type: 'taille', don: true }).recus, Math.floor(30 / 2));
  assert.equal(M.degatsRecus(regles, b, { entrants: 30, type: 'taille', reduits: true, don: true }).recus, Math.floor(30 / 4));
  // jamais négatif ; un type inconnu ou le Potentiel Illimité : rien
  assert.equal(M.degatsRecus(regles, fiche({ armure_id: frappe?.id ?? regles.armures[0].id }), { entrants: 1, type: 'estoc' }).recus, 0);
  assert.equal(M.degatsRecus(regles, feu, { entrants: 10, type: 'magies/potentiel-illimite' }), null);
});

test('degatsRecus (R98, R155) : grande résistance ÷ 3 exactement, puis arrondi à l’inférieur ; grande vulnérabilité × 3, sensibilité × 4', () => {
  // Fenrir de glace, Glace innée : 1 cran de la page de la Glace + 1 cran de l'ethnie, grande résistance à la Glace (« dégâts subis ÷3 »)
  const fenrir = fiche({ race_id: 'races/fenrir', ethnie_id: 'races/fenrir#ethnie:fenrir-de-glace', magie_innee_id: 'magies/magie-de-la-glace' });
  const glace = 'magies/magie-de-la-glace';
  assert.equal(M.resistancesDe(regles, fenrir).paliers.find((p) => p.cibles.some((c) => c.id === glace))?.id, 'grande_resistance');
  const am = M.defenseDe(regles, fenrir).am.total;
  const recus = (f, type, entrants, x = {}) => M.degatsRecus(regles, f, { entrants: entrants + am, type, ...x });
  // le quotient exact, jamais un point perdu par 30 × 0,333… = 9,999… : 9 → 3, 30 → 10, 300 → 100, 31 → 10
  for (const [entrants, attendu] of [[9, 3], [30, 10], [300, 100], [31, 10], [2, 0]]) assert.equal(recus(fenrir, glace, entrants).recus, attendu, `${entrants} ÷ 3`);
  // défense partielle : 7 → 3,5, puis ÷ 3 → 1,166… → 1
  const partielle = recus(fenrir, glace, 7, { reduits: true });
  assert.equal(partielle.recus, 1);
  assert.deepEqual(partielle.etapes.slice(-2).map((e) => e.texte), ['Défense partielle : ÷ 2', 'Grande résistance (dégâts subis ÷3)']);
  // toute somme de 0 à 3000 (et sa défense partielle) : l'arrondi à l'inférieur du quotient exact
  for (let n = 0; n <= 3000; n += 1) {
    assert.equal(recus(fenrir, glace, n).recus, Math.floor(n / 3), `${n}`);
    assert.equal(recus(fenrir, glace, n, { reduits: true }).recus, Math.floor(n / 6), `${n} en défense partielle`);
  }
  // Glace innée, Terre acquise : grande vulnérabilité au Feu (« dégâts subis x3 »)
  const terre = fiche({ magie_innee_id: glace, magie_acquise_id: 'magies/magie-de-la-terre' });
  const feu = 'magies/magie-du-feu';
  assert.equal(M.resistancesDe(regles, terre).paliers.find((p) => p.cibles.some((c) => c.id === feu))?.id, 'grande_vulnerabilite');
  const amTerre = M.defenseDe(regles, terre).am.total;
  assert.equal(M.degatsRecus(regles, terre, { entrants: 10 + amTerre, type: feu }).recus, 30);
  assert.equal(M.degatsRecus(regles, terre, { entrants: 7 + amTerre, type: feu, reduits: true }).recus, 10, '3,5 × 3 = 10,5 → 10');
  // chaque palier de la base appliqué à 30 dégâts (la sensibilité, −3 crans et moins, ne s'atteint pas avec deux magies seules)
  const mult = Object.fromEntries(regles.resistance_paliers.map((p) => [p.id, p.multiplicateur]));
  assert.deepEqual(Object.entries(mult).map(([id, m]) => [id, M.appliquerMultiplicateur(30, m)]),
    [['immunite', 0], ['grande_resistance', 10], ['resistance', 15], ['vulnerabilite', 60], ['grande_vulnerabilite', 90], ['sensibilite', 120]]);
  // un tiers écrit avec moins de chiffres divise aussi par 3 ; un multiplicateur qui n'est pas l'inverse d'un entier multiplie
  assert.equal(M.appliquerMultiplicateur(30, 0.333333333333333), 10);
  assert.equal(Math.floor(30 * 0.333333333333333), 9, 'ce que la multiplication aurait donné');
  assert.equal(M.appliquerMultiplicateur(30, 0.4), 12);
});

test('R108 : un bouclier cassé (solidité 0) ne compte plus, même en parade partielle au bouclier ; réparé, il compte de nouveau', () => {
  const b = fiche({ bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer' });
  const casse = { ...b, bouclier_solidite: 0 };
  assert.equal(M.bouclierDe(regles, casse).solidite.cassee, true);
  const d = M.defenseDe(regles, casse);
  assert.deepEqual([d.bouclier.cassee, d.bouclier.ap > 0], [true, true], 'ses AP et AM restent ceux du bouclier, pour l’infobulle');
  assert.equal(M.defenseDe(regles, b).bouclier.cassee, false);
  for (const type of ['taille', 'magies/magie-du-feu']) {
    const options = { entrants: 30, type, reduits: true };
    const sansParade = M.degatsRecus(regles, casse, options);
    const auBouclier = M.degatsRecus(regles, casse, { ...options, parade: true });
    assert.deepEqual([auBouclier.recus, auBouclier.armure], [sansParade.recus, sansParade.armure], `${type} : cassé, il ne compte plus`);
    assert.match(auBouclier.etapes[1].texte, /bouclier cassé : il ne compte plus/);
    // réparé (une solidité au-dessus de 0) : il compte
    const repare = M.degatsRecus(regles, { ...b, bouclier_solidite: 1 }, { ...options, parade: true });
    const valeur = type === 'taille' ? M.bouclierDe(regles, b).ap : M.bouclierDe(regles, b).am;
    assert.equal(repare.armure, sansParade.armure + valeur, `${type} : réparé`);
  }
});

test('R108, la page (src/scripts/fiche.mjs, lue comme un texte) : les tuiles AP et AM d’un bouclier cassé grisées à 0, l’infobulle le dit (plus « Comptés en parade partielle ») ; réparé, ses valeurs', () => {
  const script = readFileSync(new URL('../src/scripts/fiche.mjs', import.meta.url), 'utf8');
  const debut = script.indexOf("reconstruire($('bouclier')");
  const corps = script.slice(debut, script.indexOf("reconstruire($('accessoires')", debut));
  assert.ok(debut > 0 && corps.length > 0, 'le bloc du bouclier');
  // la solidité de bouclierDe dit « cassé » ; les deux tuiles le marquent, comme la pastille d'une arme cassée (data-cassee)
  assert.match(corps, /const casse = Boolean\(b\.solidite\?\.cassee\);/);
  assert.match(corps, /for \(const t of \[tuileAp, tuileAm\]\) t\.li\.toggleAttribute\('data-cassee', casse\);/);
  assert.match(corps, /ecrire\(tuileAp, String\(casse \? 0 : b\.ap\)\);/);
  assert.match(corps, /ecrire\(tuileAm, String\(casse \? 0 : b\.am\)\);/);
  // l'infobulle (habillée : infobulle() pose un title, que Infobulles.astro déplace) : pourquoi, et ses valeurs réparé ; « Comptés en parade partielle » seulement entier
  assert.match(corps, /ses AP et AM ne comptent plus, même en parade partielle \(décision R108\)/);
  assert.match(corps, /Réparé : \$\{b\.ap\} AP/);
  assert.match(corps, /Réparé : \$\{b\.am\} AM/);
  assert.match(corps, /\.\.\.\(casse \? \[\] : \['Comptés en parade partielle/);
  assert.match(corps, /infobulle\(tuileAm\.li, casse \? .* : 'Comptés en parade partielle'\);/);
  // grisées comme les autres valeurs cassées de la page (la pastille d'une arme : .objet__des[data-cassee])
  const css = readFileSync(new URL('../src/styles/fiche/fiche.css', import.meta.url), 'utf8');
  const regle = (selecteur) => new RegExp(`${selecteur.replace(/[.[\]]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  for (const s of ['.objet__des[data-cassee]', '.bouclier__tuile[data-cassee]']) {
    assert.match(regle(s), /background: var\(--border\)/, s);
    assert.match(regle(s), /color: var\(--muted\)/, s);
  }
  // le moteur garde les valeurs du bouclier entier (l'infobulle « Réparé : … ») et dit qu'il est cassé ; la défense ne le compte plus
  const casse = fiche({ bouclier_classe_id: 'ecu', bouclier_materiau_id: 'ressources/armures#materiau:fer', bouclier_solidite: 0 });
  const b = M.bouclierDe(regles, casse);
  assert.deepEqual([b.solidite.cassee, b.ap > 0], [true, true]);
  assert.equal(M.degatsRecus(regles, casse, { entrants: 30, type: 'taille', reduits: true, parade: true }).armure,
    M.degatsRecus(regles, casse, { entrants: 30, type: 'taille', reduits: true }).armure);
});

test('R108 : chaque partie a l’AP et l’AM de l’armure, ou 0 cassée ; seule la part de l’armure tombe (base, accessoires, posture restent) ; le torse par défaut', () => {
  const armure = regles.armures.find((a) => a.ap >= 2 && a.am >= 1 && Number(a.solidite_uni) !== 1 && a.solidite >= 2);
  const amelioration = regles.ameliorations.find((a) => a.cible === 'armure' && a.niveau === 2);
  const acc = regles.accessoires.find((a) => a.effets.some((c) => c.cible === 'armure_ap'));
  const posture = regles.postures.find((p) => p.nom === 'Défensif');
  const f = fiche({
    armure_id: armure.id, armure_amelioration_id: amelioration.id, posture_id: posture.id,
    accessoires: [{ emplacement: 'chef', accessoire_effet_id: acc.id, valeur: null, maudit: 0 }],
    armure_parties: [{ emplacement_id: 'bras-droit', solidite: 0 }, { emplacement_id: 'casque', solidite: 1 }],
  });
  const valeurAp = armure.ap + amelioration.bonus_ap;
  const valeurAm = armure.am + amelioration.bonus_am;
  // les six parties du corps, dans l'ordre de la base ; le bras droit cassé, le casque abîmé mais pas cassé
  assert.deepEqual(M.partiesDuCorps(regles).map((p) => p.id), ['casque', 'torse', 'bras-gauche', 'bras-droit', 'jambe-gauche', 'jambe-droit']);
  assert.deepEqual(M.armureParPartie(regles, f).map((p) => [p.id, p.cassee, p.ap, p.am]),
    M.partiesDuCorps(regles).map((p) => (p.id === 'bras-droit' ? [p.id, true, 0, 0] : [p.id, false, valeurAp, valeurAm])));
  assert.equal(M.armureParPartie(regles, fiche()), null, 'sans armure');
  const torse = M.defenseDe(regles, f);
  assert.deepEqual(M.defenseDe(regles, f, undefined, { partie: 'torse' }), torse, 'le torse par défaut');
  assert.deepEqual(M.defenseDe(regles, f, undefined, { partie: 'inconnue' }), torse, 'une partie inconnue : le torse');
  assert.deepEqual([torse.partie, torse.cassees], [{ id: 'torse', nom: 'Torse', cassee: false }, [{ id: 'bras-droit', nom: 'Bras Droit' }]]);
  assert.deepEqual([torse.ap.armure, torse.am.armure], [valeurAp, valeurAm]);
  const bras = M.defenseDe(regles, f, undefined, { partie: 'bras-droit' });
  assert.deepEqual([bras.partie.cassee, bras.ap.armure, bras.am.armure], [true, 0, 0]);
  assert.deepEqual([bras.ap.total, bras.am.total], [torse.ap.total - valeurAp, torse.am.total - valeurAm], 'seule la part de l’armure tombe');
  // le reste demeure : base, accessoires, posture (Défensif : AP et AM)
  const restent = (d) => d.ap.detail.filter((l) => !l.nom.startsWith(armure.nom) && !l.nom.startsWith('Amélioration'));
  assert.deepEqual(restent(bras), restent(torse));
  assert.ok(restent(bras).some((l) => l.nom === 'Accessoires') && restent(bras).some((l) => l.nom === `Posture ${posture.nom}`), JSON.stringify(restent(bras)));
  for (const id of ['casque', 'bras-gauche', 'jambe-gauche', 'jambe-droit']) assert.deepEqual(M.defenseDe(regles, f, undefined, { partie: id }).ap, torse.ap, id);
  // les dégâts reçus suivent la partie (le torse par défaut), avec la raison dans l'étape de l'armure
  const torseRecus = M.degatsRecus(regles, f, { entrants: 100, type: 'magies/magie-du-feu' });
  assert.deepEqual(torseRecus, M.degatsRecus(regles, f, { entrants: 100, type: 'magies/magie-du-feu', partie: 'torse' }));
  const brasRecus = M.degatsRecus(regles, f, { entrants: 100, type: 'magies/magie-du-feu', partie: 'bras-droit' });
  assert.deepEqual([brasRecus.armure, brasRecus.recus, brasRecus.partie.id], [torseRecus.armure - valeurAm, torseRecus.recus + valeurAm, 'bras-droit']);
  assert.match(brasRecus.etapes[1].texte, /partie Bras Droit cassée : l’armure n’y compte pas/);
  // le torse cassé : l'attaque non ciblée ne compte plus l'armure
  const torseCasse = M.defenseDe(regles, { ...f, armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] });
  assert.deepEqual([torseCasse.partie.cassee, torseCasse.ap.armure], [true, 0]);
});

test('R108 : une partie cassée n’a pas la résistance ni la faiblesse de l’armure aux dégâts physiques ; une armure à solidité unifiée à 0 : toutes ses parties cassées', () => {
  const armure = regles.armures.find((a) => a.ap >= 2 && Number(a.solidite_uni) !== 1 && a.degats.some((r) => r.sens === 'resistance'));
  const type = armure.degats.find((r) => r.sens === 'resistance').type;
  const f = fiche({ armure_id: armure.id, armure_parties: [{ emplacement_id: 'jambe-gauche', solidite: 0 }] });
  const torse = M.degatsRecus(regles, f, { entrants: 100, type });
  assert.ok(torse.armure > armure.ap, `${armure.nom} : la résistance au ${type} double l’armure du torse`);
  const jambe = M.degatsRecus(regles, f, { entrants: 100, type, partie: 'jambe-gauche' });
  const base = M.defenseDe(regles, f, undefined, { partie: 'jambe-gauche' }).ap.total;
  assert.deepEqual([jambe.armure, jambe.recus], [base, 100 - base], 'ni l’AP de l’armure ni sa résistance');
  assert.ok(!/contre/.test(jambe.etapes[1].texte), jambe.etapes[1].texte);

  const uni = regles.armures.find((a) => Number(a.solidite_uni) === 1 && a.solidite >= 2 && a.ap >= 1);
  const intacte = fiche({ armure_id: uni.id });
  const abimee = { ...intacte, armure_parties: [{ emplacement_id: M.ARMURE_ENTIERE, solidite: 1 }] };
  const cassee = { ...intacte, armure_parties: [{ emplacement_id: M.ARMURE_ENTIERE, solidite: 0 }] };
  assert.ok(M.armureParPartie(regles, abimee).every((p) => !p.cassee && p.ap === uni.ap), 'abîmée : la valeur de l’armure partout');
  assert.ok(M.armureParPartie(regles, cassee).every((p) => p.cassee && p.ap === 0 && p.am === 0), 'à 0 : les six parties cassées');
  assert.equal(M.defenseDe(regles, cassee).cassees.length, 6);
  for (const p of M.partiesDuCorps(regles)) assert.equal(M.defenseDe(regles, cassee, undefined, { partie: p.id }).ap.armure, 0, p.id);
});

test('R108 avec une armure élémentaire (R99, R165) : chaque partie a la valeur de l’armure élémentaire et de son amélioration, ou 0 cassée', () => {
  const armure = regles.armures.find((a) => a.ap >= 1 && Number(a.solidite_uni) !== 1 && a.solidite >= 1);
  const element = regles.armures_elementaires.find((e) => e.ap && e.am && e.ap !== armure.ap);
  const ameliorationElement = regles.ameliorations.find((a) => a.cible === 'armure_elementaire' && a.niveau === 2);
  const f = fiche({ armure_elementaire_id: element.id, armure_amelioration_elementaire_id: ameliorationElement.id,
    armure_parties: [{ emplacement_id: 'torse', solidite: 0 }] });
  const ap = element.ap + ameliorationElement.bonus_ap;
  const am = element.am + ameliorationElement.bonus_am;
  assert.deepEqual(M.armureParPartie(regles, f).map((p) => [p.id, p.ap, p.am]),
    M.partiesDuCorps(regles).map((p) => (p.id === 'torse' ? [p.id, 0, 0] : [p.id, ap, am])));
  const torse = M.defenseDe(regles, f);
  const bras = M.defenseDe(regles, f, undefined, { partie: 'bras-gauche' });
  assert.deepEqual([torse.element.id, torse.ap.armure, torse.am.armure, bras.ap.armure, bras.am.armure], [element.id, 0, 0, ap, am]);
  assert.ok(bras.ap.detail.some((l) => l.nom === element.nom) && bras.ap.detail.some((l) => l.nom === 'Amélioration niveau 2'));
  // une fiche d'avant qui porte encore l'armure d'origine : seule l'armure élémentaire compte (R165 (8))
  const avant = M.defenseDe(regles, { ...f, armure_id: armure.id }, undefined, { partie: 'bras-gauche' });
  assert.deepEqual([avant.ap.armure, avant.am.armure], [ap, am]);
  assert.ok(!avant.ap.detail.some((l) => l.nom === armure.nom), 'l’armure d’origine ne compte plus');
});

test('typesDeDegats : Estoc, Taille, Frappe, puis les quatorze magies (sans le Potentiel Illimité)', () => {
  const t = M.typesDeDegats(regles);
  assert.deepEqual(t.slice(0, 3).map((x) => x.id), ['estoc', 'taille', 'frappe']);
  assert.equal(t.filter((x) => !x.physique).length, 14);
  assert.ok(!t.some((x) => x.id === 'magies/potentiel-illimite'));
});

test('effetsDAccessoireProposes (R97) : un groupe par propriété dans l’ordre de la page, une « Compétence X » par caractéristique, ni MALÉDICTION ni effet sans libellé, rangés par cible puis valeur', () => {
  const groupes = M.effetsDAccessoireProposes(regles);
  assert.deepEqual(groupes.map((g) => g.propriete), ['caracteristique', 'competence', 'attributs', 'attaque', 'defense', 'jet-de-de', 'autre']);
  const competences = groupes.find((g) => g.propriete === 'competence').options;
  assert.deepEqual(competences.map((o) => o.valeur), regles.caracteristiques.map((k) => M.cleDEffetDeCompetence(k.id)), 'dans l’ordre des caractéristiques de la fiche');
  assert.equal(competences.length, 6);
  const tous = groupes.flatMap((g) => g.options);
  assert.ok(!tous.some((o) => o.texte === 'MALÉDICTION'));
  const attributs = groupes.find((g) => g.propriete === 'attributs').options.map((o) => o.texte);
  const sante = attributs.filter((x) => /Santé$/.test(x));
  assert.deepEqual(sante, ['+5 Santé', '+10 Santé', '+15 Santé', '+20 Santé', '+25 Santé'], 'les mêmes cibles ensemble, par valeur croissante');
  // l'effet d'une fiche reste proposé, même une ligne MALÉDICTION
  const malediction = regles.accessoires.find((a) => a.libelle === 'MALÉDICTION');
  assert.ok(M.effetsDAccessoireProposes(regles, [malediction.id]).flatMap((g) => g.options).some((o) => o.valeur === malediction.id));
});

test('effetDeCompetence : la valeur tirée choisit le niveau ; valeurDEffetDAccessoire : la clé de la caractéristique', () => {
  const niveaux = regles.accessoires.filter((a) => a.propriete === 'competence' && a.caracteristique_id === 'force').sort((a, b) => a.min - b.min);
  for (const n of niveaux) {
    for (const v of [n.min, n.max]) assert.equal(M.effetDeCompetence(regles, 'force', v).id, n.id, `${v}`);
  }
  assert.equal(M.effetDeCompetence(regles, 'force', null).id, niveaux[0].id);
  // bornée aux plages écrites, comme le générateur (bonusBorne) : au-dessus, le dernier niveau ; en dessous ou pas un nombre, le premier
  assert.equal(M.effetDeCompetence(regles, 'force', 999).id, niveaux.at(-1).id, 'au-dessus des fourchettes : le dernier niveau');
  assert.equal(M.effetDeCompetence(regles, 'force', -3).id, niveaux[0].id, 'en dessous : le premier niveau');
  assert.equal(M.effetDeCompetence(regles, 'force', 'abc').id, niveaux[0].id);
  assert.equal(M.effetDeCompetence(regles, 'inconnue', 3), null);
  // la valeur enregistrée : bornée de la même façon (l'Acquis compté est celui du niveau choisi)
  assert.deepEqual([999, -3, '', 'abc', niveaux[1].min].map((v) => M.valeurDeCompetenceBornee(regles, 'force', v)),
    [Math.max(...niveaux.map((n) => n.max)), Math.min(...niveaux.map((n) => n.min)), null, null, niveaux[1].min]);
  assert.equal(M.valeurDeCompetenceBornee(regles, 'inconnue', 3), null);
  assert.equal(M.valeurDEffetDAccessoire(regles, { accessoire_effet_id: niveaux[2].id }), M.cleDEffetDeCompetence('force'));
  const autre = regles.accessoires.find((a) => a.propriete === 'attributs');
  assert.equal(M.valeurDEffetDAccessoire(regles, { accessoire_effet_id: autre.id }), autre.id);
  assert.equal(M.valeurDEffetDAccessoire(regles, {}), '');
});

test('propositionsDuCatalogue : rien sous deux caractères ; sans accents ni casse ; le début d’abord, puis le début d’un mot, puis le reste ; au plus N', () => {
  const catalogue = ['Fiole de soin', 'Méga fiole verte', 'Corde (1m)', 'Bâton magique Feu, niveau 2', 'Soin de fiole', 'Arc long'];
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, 'f'), []);
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, ' f '), []);
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, 'FIOLE'), ['Fiole de soin', 'Méga fiole verte', 'Soin de fiole']);
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, 'bat'), ['Bâton magique Feu, niveau 2']);
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, 'iol'), ['Fiole de soin', 'Méga fiole verte', 'Soin de fiole'], 'au milieu d’un mot aussi');
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, '(1'), ['Corde (1m)'], 'une parenthèse n’est pas une expression rationnelle');
  assert.deepEqual(M.propositionsDuCatalogue(catalogue, 'fi', 2), ['Fiole de soin', 'Méga fiole verte']);
  const sac = M.catalogueDuSac(regles);
  assert.equal(new Set(sac).size, sac.length, 'chaque nom une fois');
  assert.ok(sac.includes(regles.ceinture.baton_a_regler), 'le bâton magique à régler (décision R101)');
});

test('degatsDArme (R99, « L’élément remplace tout ») : avec un élément, les dés restent, les bonus du matériau et de l’amélioration sont remplacés par ceux de l’élément', () => {
  const arme = regles.armes.find((a) => a.de && regles.familles_armes.find((f) => f.id === a.famille_id)?.maitrisable !== false);
  const materiau = regles.materiaux_armes.find((m) => m.bonus_degats > 0);
  const amelioration = regles.ameliorations.find((a) => a.cible === 'arme' && a.bonus_degats > 0);
  const element = regles.armes_elementaires.find((e) => e.bonus_degats > 0);
  const ameliorationElement = regles.ameliorations.find((a) => a.cible === 'arme_elementaire' && a.bonus_degats > 0);
  assert.ok(arme && materiau && amelioration && element && ameliorationElement);
  const ligne = { rang: 1, arme_id: arme.id, materiau_id: materiau.id, amelioration_id: amelioration.id };
  const sans = M.degatsDArme(regles, fiche({ armes: [ligne] }), 1);
  const avec = M.degatsDArme(regles, fiche({ armes: [{ ...ligne, arme_elementaire_id: element.id, amelioration_elementaire_id: ameliorationElement.id }] }), 1);
  assert.equal(avec.notation, sans.notation, 'les dés restent');
  assert.equal(avec.total, sans.total - materiau.bonus_degats - amelioration.bonus_degats + element.bonus_degats + ameliorationElement.bonus_degats);
  assert.deepEqual(avec.nonComptes.filter((n) => n.raison === 'element').map((n) => n.valeur), [materiau.bonus_degats, amelioration.bonus_degats]);
  // l'amélioration de l'élément ne compte qu'avec un élément
  const seule = M.degatsDArme(regles, fiche({ armes: [{ ...ligne, amelioration_elementaire_id: ameliorationElement.id }] }), 1);
  assert.equal(seule.total, sans.total);
});
