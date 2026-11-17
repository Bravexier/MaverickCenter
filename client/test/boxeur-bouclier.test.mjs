// Le Boxeur qui porte un bouclier (décisions R255 (1) à (4), R267 (1) et (3), R269 : « Égide d'assaut » divise par 3, arrondi toujours à l'inférieur, bouclier cassé : rien) : « Bouclier d'attaque » et « Bouragé » s'ajoutent aux dégâts de pugilat dès qu'un
// bouclier est porté, « Mur » ajoute toute l'AP et l'AM du bouclier (ses +2 compris) à la défense à chaque attaque subie, même sans parade partielle (exception
// à R96). « Boucassant », « Posture inébranlable » et « Posture d'urgence » restent un texte seul. Le lecteur des textes : lib/bouclier-texte.mjs.
// Les règles (textes et valeurs que le site de dev modifie) sont épinglées sur leur état d'import (test/aide-base-d-import.mjs) ; les écritures lues par le
// lecteur sont des exemples, pas des textes de la base.
//   node --test test/boxeur-bouclier.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effetDeBouclierEcrit } from '../src/lib/bouclier-texte.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import * as M from '../src/lib/fiche-moteur.mjs';
import { reglesDImport } from './aide-base-d-import.mjs';

const regles = reglesDImport(); // tel que la page le reçoit
const BOXEUR = 'classes/boxeur';
const DONS = { attaque: 'capacites/boxeur-bouclier-dattaque', mur: 'capacites/boxeur-mur', bourage: 'capacites/boxeur-bourage', egide: 'capacites/boxeur-egide-dassaut' };
const SANS_CALCUL = ['capacites/boxeur-boucassant', 'capacites/boxeur-posture-inebran', 'capacites/boxeur-posture-durgence'];
const dons = new Map(regles.classes.find((c) => c.id === BOXEUR).dons.map((d) => [d.id, d]));
const pugilat = regles.armes.find((a) => a.famille_id === 'pugilat');
const nonPugilat = regles.armes.find((a) => a.famille_id !== 'pugilat' && regles.familles_armes.find((f) => f.id === a.famille_id)?.maitrisable !== false);
const xpDuNiveau = (n) => regles.niveaux.find((l) => l.niveau === n).xp_min;

/** Un Boxeur, au niveau global `niveau`, un bouclier (forme + matière) de la liste, ses armes. */
const fiche = (niveau, { bouclier = null, armes = [pugilat], solidite = null, ...reste } = {}) => ({
  ...ficheVide('Essai'), race_id: 'races/humain', ethnie_id: 'races/humain#ethnie:humain-central', magie_innee_id: 'magies/magie-du-feu',
  classes: [{ rang: 1, classe_id: BOXEUR, specialite_id: null }], xp: xpDuNiveau(niveau),
  bouclier_classe_id: bouclier?.classe_id ?? null, bouclier_materiau_id: bouclier?.materiau_id ?? null, bouclier_solidite: solidite,
  armes: armes.map((a, i) => ({ rang: i + 1, arme_id: a.id, materiau_id: null })), ...reste,
});
/** Les règles sans l'effet « Mur » (pour comparer ce qu'il ajoute). */
const sansEffet = (cle) => ({
  ...regles, classes: regles.classes.map((c) => (c.id !== BOXEUR ? c : { ...c, dons: c.dons.map((d) => (d.bouclier?.cle === cle ? { ...d, bouclier: undefined } : d)) })),
});
/** Un bouclier de la liste par poids (id du poids), avec AP et AM lisibles. */
const boucliers = regles.poids_bouclier.map((p) => regles.boucliers_formes_matieres.find((b) => b.poids_id === p.id && (b.ap ?? 0) + (b.am ?? 0) > 0));
const degats = (r, f) => M.degatsDArme(r, f, 1);
const lignes = (d, id) => d.bonus.filter((b) => b.nom.startsWith(dons.get(id).nom));

test('lecture (lib/bouclier-texte.mjs) : Bouclier d’attaque, Bouragé et Mur se lisent sur leur texte entier ; toute autre écriture, ni lue ni devinée', () => {
  assert.deepEqual(effetDeBouclierEcrit('Permet d’utiliser son bouclier comme une extension de dégâts pour les pugilats pour infliger un dégât bonus d’AP+AM du bouclier divisé par 4 (minimum 1).'),
    { cle: 'extension_de_degats', diviseur: 4, minimum: 1 });
  assert.deepEqual(effetDeBouclierEcrit('Inflige un bonus de 2 dégâts aux attaques de pugilat avec les boucliers par poids du bouclier.'), { cle: 'degats_par_poids', valeur: 2 });
  assert.deepEqual(effetDeBouclierEcrit('Les boucliers donnent +2AP et AM.'), { cle: 'defense', ap: 2, am: 2 });
  for (const autre of ['Les attaques de pugilats avec un bouclier ignorent 1AP par poids du bouclier.', '5% stabilité, bénéficie d’un avantage lors des jets de cette compétence.',
    'Si tombe à terre : se met automatiquement en défense', '', null]) {
    assert.equal(effetDeBouclierEcrit(autre), null, String(autre));
  }
  // les dons de l'import : les trois sont lus ; Boucassant, Posture inébranlable et Posture d'urgence ne le sont pas (R255 (2), (5), (6) : texte seulement)
  assert.deepEqual(dons.get(DONS.attaque).bouclier, { cle: 'extension_de_degats', diviseur: 4, minimum: 1 });
  assert.deepEqual(dons.get(DONS.bourage).bouclier, { cle: 'degats_par_poids', valeur: 2 });
  assert.deepEqual(dons.get(DONS.mur).bouclier, { cle: 'defense', ap: 2, am: 2 });
  // R269 (1) : « Égide d'assaut » donne un autre diviseur à Bouclier d'attaque, lu dans son texte (celui qu'il remplace compris)
  assert.deepEqual(effetDeBouclierEcrit('La division pour « bouclier d’attaque » est de 3 au lieu de 4.'), { cle: 'extension_diviseur', diviseur: 3, au_lieu_de: 4 });
  assert.deepEqual(dons.get(DONS.egide).bouclier, { cle: 'extension_diviseur', diviseur: 3, au_lieu_de: dons.get(DONS.attaque).bouclier.diviseur });
  for (const id of SANS_CALCUL) {
    assert.ok(dons.get(id), id);
    assert.deepEqual([dons.get(id).bouclier, dons.get(id).degats, dons.get(id).sorts], [undefined, undefined, undefined], `${id} : aucun calcul`);
  }
  // aucun autre don de classe ne se lit comme un effet de bouclier
  const lus = regles.classes.flatMap((c) => c.dons.filter((d) => d.bouclier).map((d) => d.id)).sort();
  assert.deepEqual(lus, Object.values(DONS).sort());
  // un diviseur qui ne remplace pas celui de Bouclier d'attaque n'est pas appliqué
  const attaque = dons.get(DONS.attaque).bouclier;
  assert.equal(M.diviseurDeLExtension(attaque, [{ cle: 'extension_diviseur', diviseur: 3, au_lieu_de: attaque.diviseur }]), 3);
  assert.equal(M.diviseurDeLExtension(attaque, [{ cle: 'extension_diviseur', diviseur: 3, au_lieu_de: attaque.diviseur + 1 }]), attaque.diviseur);
  assert.equal(M.diviseurDeLExtension(attaque, []), attaque.diviseur);
});

test('R269 (2) : Bouclier d’attaque, (AP + AM) ÷ 4 (ou ÷ 3), toujours arrondi à l’inférieur (R175), minimum 1 (÷ 4 : 5 → 1, 6 → 1, 7 → 1, 10 → 2)', () => {
  const quatre = { diviseur: 4, minimum: 1 };
  assert.deepEqual([[5, 0], [6, 0], [7, 0], [10, 0], [3, 3], [2, 3], [4, 4], [8, 8]].map(([ap, am]) => M.extensionDeDegats(ap, am, quatre)), [1, 1, 1, 2, 1, 1, 2, 4]);
  // le minimum 1 de 0 à 7
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((somme) => M.extensionDeDegats(somme, 0, quatre)), [1, 1, 1, 1, 1, 1]);
  // ÷ 3 (Égide d'assaut) : 5 → 1, 6 → 2, 8 → 2, 9 → 3
  assert.deepEqual([5, 6, 8, 9].map((somme) => M.extensionDeDegats(somme, 0, { diviseur: 3, minimum: 1 })), [1, 2, 2, 3]);
});

test('R255 (2) : le poids du bouclier vaut Léger 1, Moyen 2, Lourd 3, Très lourd 4 (R92)', () => {
  assert.deepEqual({ ...M.POIDS_DU_BOUCLIER }, { leger: 1, moyen: 2, lourd: 3, 'tres-lourd': 4 });
  // les quatre poids de la liste, et la Force minimum de l'import qui l'écrit aussi
  assert.deepEqual(regles.poids_bouclier.map((p) => p.id).sort(), Object.keys(M.POIDS_DU_BOUCLIER).sort());
  for (const p of regles.poids_bouclier) assert.equal(M.POIDS_DU_BOUCLIER[p.id], p.force_min, p.id);
});

test('R267 (3), R255 (2), R269 : dès qu’un bouclier est porté, Bouclier d’attaque (÷ 4, ÷ 3 avec Égide d’assaut, à l’inférieur) et Bouragé s’ajoutent aux dégâts de pugilat', () => {
  assert.ok(boucliers.every(Boolean), 'un bouclier de chaque poids');
  // les états du Boxeur : de ses dons acquis (Bouclier d'attaque, puis Mur, puis Bouragé, un don à choisir au niveau 10 de la classe), sans fixer de niveau
  const etats = new Set();
  for (let niveau = 1; niveau <= 20; niveau += 1) {
    for (const choisi of [false, true]) {
      // (Bouragé est un don à choisir de la spécialité de sa classe ; Égide d'assaut est un don de classe du niveau 20)
      const reste = choisi ? { classes: [{ rang: 1, classe_id: BOXEUR, specialite_id: dons.get(DONS.bourage).specialite_id }], capacites: [{ capacite_id: DONS.bourage }] } : {};
      const sans = fiche(niveau, reste);
      const acquis = new Set(M.donsAcquis(regles, sans).flatMap((c) => c.dons.map((d) => d.id)));
      etats.add([DONS.attaque, DONS.mur, DONS.bourage, DONS.egide].map((id) => acquis.has(id)).join());
      for (const b of boucliers) {
        const f = fiche(niveau, { bouclier: b, ...reste });
        const porte = M.bouclierDe(regles, f);
        const poids = M.POIDS_DU_BOUCLIER[porte.poids.id];
        const dg = degats(regles, f);
        const murEnPlus = acquis.has(DONS.mur) ? 2 : 0;
        // Bouclier d'attaque : (AP + AM du bouclier, +2 et +2 de Mur s'il l'a) ÷ 4 (÷ 3 avec Égide d'assaut), arrondi à l'inférieur, au moins 1 (R269)
        const diviseur = acquis.has(DONS.egide) ? 3 : 4;
        const attendu = acquis.has(DONS.attaque) ? Math.max(1, Math.floor((porte.ap + porte.am + 2 * murEnPlus) / diviseur)) : null;
        const ou = `niveau ${niveau}, ${b.id}`;
        assert.deepEqual(lignes(dg, DONS.attaque).map((l) => l.valeur), attendu === null ? [] : [attendu], `${ou} : Bouclier d’attaque`);
        // Bouragé : +2 par poids du bouclier
        assert.deepEqual(lignes(dg, DONS.bourage).map((l) => l.valeur), acquis.has(DONS.bourage) ? [2 * poids] : [], `${ou} : Bouragé`);
        // le total suit : les dégâts sans bouclier plus ces deux lignes
        assert.equal(dg.total - degats(regles, fiche(niveau, reste)).total, (attendu ?? 0) + (acquis.has(DONS.bourage) ? 2 * poids : 0), `${ou} : total`);
        assert.deepEqual(dg.nonComptes.filter((n) => n.nom.startsWith(dons.get(DONS.bourage).nom)), [], 'Bouragé n’est plus « avec un bouclier » non compté');
      }
    }
  }
  assert.equal(etats.size, 5, 'les états de dons de la classe sont éprouvés : Bouclier d’attaque seul, avec Mur, avec Bouragé, avec Égide d’assaut, avec ou sans Bouragé');
  // l'AP et l'AM d'un bouclier amélioré comptent aussi (Bouclier d'attaque lit l'AP et l'AM du bouclier porté)
  const amelioration = regles.ameliorations.find((a) => a.cible === 'bouclier' && a.bonus_ap > 0);
  const b = boucliers[0];
  const ameliore = fiche(1, { bouclier: b, bouclier_amelioration_id: amelioration.id });
  const porte = M.bouclierDe(regles, ameliore);
  assert.equal(porte.ap, (b.ap ?? 0) + amelioration.bonus_ap);
  const murEnPlus = M.donsAcquis(regles, ameliore).some((c) => c.dons.some((d) => d.id === DONS.mur)) ? 4 : 0;
  assert.deepEqual(lignes(degats(regles, ameliore), DONS.attaque).map((l) => l.valeur), [Math.max(1, Math.floor((porte.ap + porte.am + murEnPlus) / (M.donsAcquis(regles, ameliore).some((c) => c.dons.some((d) => d.id === DONS.egide)) ? 3 : 4)))]);
});

test('R269 (3), R267 (3) : sans bouclier porté, avec une arme qui n’est pas du pugilat, ou le bouclier cassé (rien pour Bouragé, Bouclier d’attaque ni Mur : R108), rien n’est ajouté', () => {
  const b = boucliers[3];
  // sans bouclier (la forme seule, sans matière, n'est pas un bouclier de la liste)
  assert.deepEqual(lignes(degats(regles, fiche(20)), DONS.attaque), []);
  assert.deepEqual(lignes(degats(regles, fiche(20, { bouclier: { classe_id: b.classe_id, materiau_id: null } })), DONS.bourage), []);
  // une arme d'une autre famille que le pugilat
  const autre = degats(regles, fiche(20, { bouclier: b, armes: [nonPugilat] }));
  assert.deepEqual([lignes(autre, DONS.attaque), lignes(autre, DONS.bourage)], [[], []]);
  // un bouclier cassé (solidité 0) ne compte plus (R108, comme une arme cassée)
  const casse = fiche(20, { bouclier: b, solidite: 0 });
  assert.equal(M.bouclierDe(regles, casse).solidite.cassee, true);
  assert.deepEqual([lignes(degats(regles, casse), DONS.attaque), lignes(degats(regles, casse), DONS.bourage)], [[], []]);
  // et le bouclier porté ajoute bien quelque chose au même niveau, intact
  assert.ok(degats(regles, fiche(20, { bouclier: b })).total > degats(regles, fiche(20)).total);
});

test('R267 (1), R255 (1) et (4) : Mur ajoute toute l’AP et l’AM du bouclier, ses +2 compris, à la défense à chaque attaque, même sans parade partielle', () => {
  const sans = sansEffet('defense');
  for (const b of boucliers) {
    const f = fiche(20, { bouclier: b });
    const porte = M.bouclierDe(regles, f);
    const avecMur = M.defenseDe(regles, f);
    const sansMur = M.defenseDe(sans, f);
    const sansBouclier = M.defenseDe(regles, fiche(20));
    // l'AP et l'AM du bouclier + 2 chacune s'ajoutent à la défense (sans Mur, le bouclier ne compte pas hors parade partielle : R96)
    assert.equal(sansMur.ap.total, sansBouclier.ap.total, `${b.id} : sans Mur, rien hors parade partielle`);
    assert.equal(avecMur.ap.total - sansBouclier.ap.total, porte.ap + 2, `${b.id} : AP`);
    assert.equal(avecMur.am.total - sansBouclier.am.total, porte.am + 2, `${b.id} : AM`);
    assert.deepEqual([avecMur.ap.bouclier, avecMur.am.bouclier, avecMur.bouclier.mur], [porte.ap + 2, porte.am + 2, true]);
    // chaque attaque subie, sans défense partielle : physique (AP) et magique (AM)
    const physique = { entrants: 100, type: 'frappe' };
    const magique = { entrants: 100, type: 'magique', element: 'magies/magie-du-feu' };
    assert.equal(M.degatsRecus(regles, f, physique).armure - M.degatsRecus(regles, fiche(20), physique).armure, porte.ap + 2, `${b.id} : coup physique`);
    assert.equal(M.degatsRecus(regles, f, magique).armure - M.degatsRecus(regles, fiche(20), magique).armure, porte.am + 2, `${b.id} : coup magique`);
    assert.equal(M.degatsRecus(sans, f, physique).armure, M.degatsRecus(sans, fiche(20), physique).armure, `${b.id} : sans Mur, rien hors parade partielle`);
    // la parade partielle n'ajoute pas le bouclier une seconde fois
    const parade = { ...physique, reduits: true, parade: true };
    assert.equal(M.degatsRecus(regles, f, parade).armure, M.degatsRecus(regles, f, { ...physique, reduits: true }).armure, `${b.id} : une seule fois`);
    // sans Mur, la parade partielle ajoute l'AP du bouclier (R96, inchangé)
    assert.equal(M.degatsRecus(sans, f, parade).armure - M.degatsRecus(sans, fiche(20), { ...physique, reduits: true }).armure, porte.ap, `${b.id} : R96`);
  }
  // à un niveau où Mur n'est pas acquis (le premier trouvé en partant du niveau 1) : rien
  let niveau = 1;
  while (M.donsAcquis(regles, fiche(niveau)).some((c) => c.dons.some((d) => d.id === DONS.mur)) && niveau < 20) niveau += 1;
  const tot = M.defenseDe(regles, fiche(niveau, { bouclier: boucliers[0] }));
  assert.equal(tot.ap.bouclier, 0);
  assert.equal(tot.bouclier.mur, false);
  // un bouclier cassé n'ajoute plus rien (R108)
  const casse = M.defenseDe(regles, fiche(20, { bouclier: boucliers[0], solidite: 0 }));
  assert.deepEqual([casse.ap.bouclier, casse.am.bouclier, casse.ap.total], [0, 0, M.defenseDe(regles, fiche(20)).ap.total]);
});
