// Inventaire et ceinture de la fiche de personnage (décisions R88, R89), sur les règles de la base telles que la page les reçoit (/fiche/regles.json) :
// emplacements de l'inventaire selon la Force (24, 28, 32, 36, puis 48 ; 48 avec le don « Organisé »), quantité d'une ligne du sac (1 à 99), maximum
// d'un emplacement de ceinture (3 exemplaires, 4 avec un don qui l'écrit, 1 pour un bâton magique, la contenance d'un carquois ou d'un sac), un objet du
// sac assigné à la ceinture (3 exemplaires, ou tous s'il y en a moins ; un carquois arrive plein), les boutons « Utiliser », « Remplir » et « Ranger »
// et les exemples du propriétaire, ce que la page pose pendant la frappe, et les lectures de texte qui les nourrissent (lib/ceinture-texte.mjs),
// rejouées sur toute la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contenanceEcrite, exemplairesDeCeintureEcrits, nomDeBaton, sacSansForceEcrit } from '../src/lib/ceinture-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  actionsDeLEmplacement, classesDe, dansLeSac, donDuSacSansForce, emplacementsSelonLaForce, exemplairesParEmplacement, inventaireDe, maximumDeLEmplacement,
  mettreALaCeinture, minimumDeLEmplacement, objetChoisiDansLaListe, objetDeCeinture, quantiteDuSac, rangerLEmplacement, remplirLEmplacement,
  suggestionsDeCeinture, utiliserLObjet,
} from '../src/lib/fiche-moteur.mjs';
import { chargerReglesDeFiche } from '../src/lib/fiche-regles.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';

const db = ouvrirBase({ sansExemples: false });
const regles = JSON.parse(JSON.stringify(chargerReglesDeFiche(db))); // tel que la page le reçoit
const nomDe = (id) => regles.ressources.find((r) => r.id === id).nom;
const contenant = regles.ceinture.objets.find((o) => o.famille === 'contenant' && o.contenance);
const potion = regles.ceinture.objets.find((o) => o.famille === 'fiole');
const baton = regles.ceinture.batons[0];
const materiel = regles.ressources.find((r) => r.genre === 'materiel' && !regles.ceinture.objets.some((o) => o.ressource_id === r.id));
const fiche = (extra = {}) => ({ ...ficheVide('Essai'), caracteristiques: [{ caracteristique_id: 'force', base: 1, croix: 0 }], ...extra });
const sac = (...lignes) => lignes.map(([nom, quantite], i) => ({ rang: i + 1, nom, quantite, ressource_id: regles.ressources.find((r) => r.nom === nom)?.id ?? null }));
// une fiche dont la classe a débloqué le don qui écrit « 4 fois le même objet » (Mercenaire « Organisé »), au premier niveau global qui le donne ; null
// quand aucun don ne l'écrit plus (supprimé sur le site de dev : le test des lectures de texte vérifie qu'il existait à l'import)
function ficheAvecLeDonDesQuatre() {
  const classe = regles.classes.find((c) => c.dons.some((d) => d.exemplaires_ceinture));
  if (!classe) return null;
  const don = classe.dons.find((d) => d.exemplaires_ceinture);
  const aLXp = (xp) => fiche({ xp, mode_classe: 'mono', classes: [{ rang: 1, classe_id: classe.id }] });
  const xp = regles.niveaux.map((n) => n.xp_min).find((x) => classesDe(regles, aLXp(x))[0].niveau >= don.niveau);
  return xp === undefined ? null : aLXp(xp);
}

test('inventaire : la Force donne la place, 24 à Force 1, puis 28, 32, 36, et 48 à partir de Force 5 (décision R88)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((f) => emplacementsSelonLaForce(regles, f)), [24, 24, 28, 32, 36, 48, 48, 48]);
  // la Force de la fiche : la valeur affichée (base, +1 de la magie innée, accessoire) ; les croix n'y sont pas
  assert.equal(inventaireDe(regles, fiche()).emplacements, 24);
  assert.equal(inventaireDe(regles, fiche({ caracteristiques: [{ caracteristique_id: 'force', base: 3, croix: 2 }] })).emplacements, 32);
  const force = regles.magies.find((m) => m.caracteristique_id === 'force');
  assert.ok(force, 'une magie innée donne +1 en Force');
  assert.equal(inventaireDe(regles, fiche({ magie_innee_id: force.id, caracteristiques: [{ caracteristique_id: 'force', base: 4, croix: 0 }] })).emplacements, 48);
  // une ligne = un emplacement, quelle que soit sa quantité ; au-delà de la place, rien n'est retiré, la fiche le signale
  const plein = inventaireDe(regles, fiche({ inventaire: Array.from({ length: 26 }, (_, i) => ({ rang: i + 1, nom: `Objet ${i}`, quantite: 12 })) }));
  assert.deepEqual([plein.occupes, plein.emplacements, plein.auDela], [26, 24, 2]);
});

test('lectures de texte : la contenance de chaque carquois ou sac, les exemplaires qu’un don permet, le nom d’un bâton', () => {
  assert.equal(contenanceEcrite('Étui en cuir à porter à la ceinture pouvant accueillir jusqu’à 10 flèches ou carreaux.'), 10);
  assert.equal(contenanceEcrite('Sac destiné à la fronde contenant jusqu\'à 10 pierres.'), 10);
  assert.equal(contenanceEcrite('Un sac.'), null);
  assert.equal(exemplairesDeCeintureEcrits('Permet d\'avoir 4 fois le même objet sur un emplacement de ceinture.'), 4);
  assert.equal(exemplairesDeCeintureEcrits('Permet d’avoir 4 fois le même objet sur un emplacement de ceinture.'), 4, 'apostrophe typographique');
  assert.equal(exemplairesDeCeintureEcrits('+2 points de maîtrise'), null);
  assert.equal(sacSansForceEcrit('Permet d\'utiliser n\'importe quel sac quels que soient la Force ou les malus.'), true);
  assert.equal(sacSansForceEcrit('Permet d’utiliser n’importe quel sac quel que soit la force.'), true, 'apostrophes typographiques, singulier');
  assert.equal(sacSansForceEcrit('Permet d\'utiliser n\'importe quelle arme.'), false);
  assert.equal(nomDeBaton('Feu', 2), 'Bâton magique Feu, niveau 2');
  // à l'import (le site de dev peut réécrire ces textes : historique_modification) : chaque carquois ou sac que la vue retient (sa règle : matériel dont la
  // clé écrit « carquois », « sac-de-bombe » ou « sac-de-pierre ») écrit sa contenance, et un don au moins écrit des exemplaires de ceinture, plus que 3
  const historique = historiqueSite(db);
  const contenantsDImport = historique.lignesDImport('ressource').filter((r) => r.genre === 'materiel' && /carquois|sac-de-bombe|sac-de-pierre/.test(r.nom_cle));
  assert.ok(contenantsDImport.length > 0);
  for (const r of contenantsDImport) assert.ok(contenanceEcrite(r.description) > 0, r.nom);
  const capacitesDImport = historique.lignesDImport('capacite');
  const ecritsDImport = capacitesDImport.map((c) => exemplairesDeCeintureEcrits(c.effet)).filter(Boolean);
  assert.ok(ecritsDImport.length >= 1 && ecritsDImport.every((n) => n > regles.constantes['ceinture.exemplaires_par_emplacement']));
  // « Organisé » : le don qui donne n'importe quel sac est celui qui écrit 4 exemplaires (décision R88 : les deux effets du même don)
  const sansForce = capacitesDImport.filter((c) => sacSansForceEcrit(c.effet));
  assert.deepEqual(sansForce.map((c) => c.nom), ['Organisé']);
  assert.equal(exemplairesDeCeintureEcrits(sansForce[0].effet), 4);
  // l'état courant, cohérent : une contenance que le texte n'écrit plus est absente, jamais fausse ; la page reçoit chaque objet de la vue, une fois
  for (const c of regles.ceinture.objets.filter((o) => o.famille === 'contenant')) {
    assert.ok(c.contenance === null || (Number.isInteger(c.contenance) && c.contenance > 0), nomDe(c.ressource_id));
  }
  for (const d of regles.classes.flatMap((c) => c.dons)) if ('exemplaires_ceinture' in d) assert.ok(Number.isInteger(d.exemplaires_ceinture) && d.exemplaires_ceinture > 0);
  assert.equal(regles.ceinture.objets.length + regles.ceinture.batons.length, db.prepare('SELECT COUNT(*) AS n FROM v_objet_ceinture').get().n);
  assert.equal(new Set(regles.ceinture.batons.map((b) => b.nom)).size, regles.ceinture.batons.length, 'un nom par bâton');
});

test('ceinture : 3 exemplaires par emplacement, 4 avec « Organisé », 1 pour un bâton, la contenance d’un carquois ; le sac de Force 5 avec ce don (R88, R89)', () => {
  assert.equal(regles.constantes['ceinture.exemplaires_par_emplacement'], 3);
  assert.deepEqual(regles.sac, { quantite_max: 99, force_avec_le_don: 5 }, 'décision R88 : « Maxé à 99 », « équivalent à 5 de Force »');
  assert.equal(maximumDeLEmplacement(regles, fiche(), nomDe(potion.ressource_id)), 3);
  assert.equal(maximumDeLEmplacement(regles, fiche(), 'Objet spécial du MJ'), 3, 'un objet du MJ aussi');
  assert.equal(maximumDeLEmplacement(regles, fiche(), materiel.nom), 3, 'tout objet du sac s’assigne : le matériel aussi');
  assert.equal(maximumDeLEmplacement(regles, fiche(), baton.nom), 1);
  assert.equal(maximumDeLEmplacement(regles, fiche(), nomDe(contenant.ressource_id)), contenant.contenance);
  // le don qui écrit « 4 fois le même objet », débloqué (sa classe au bon niveau), et pas avant (le test des lectures de texte vérifie qu'il existait à
  // l'import ; supprimé depuis sur le site de dev, il n'y a plus rien à vérifier ici)
  const classe = regles.classes.find((c) => c.dons.some((d) => d.exemplaires_ceinture));
  if (!classe) return;
  const don = classe.dons.find((d) => d.exemplaires_ceinture);
  // le niveau de la classe vient du niveau global (décision R2 : un monoclasse prend plusieurs niveaux de classe par niveau global)
  const aLXp = (xp) => fiche({ xp, mode_classe: 'mono', classes: [{ rang: 1, classe_id: classe.id }] });
  const niveauDeClasse = (f) => classesDe(regles, f)[0].niveau;
  const xps = regles.niveaux.map((n) => n.xp_min);
  const avecDon = aLXp(xps.find((x) => niveauDeClasse(aLXp(x)) >= don.niveau));
  assert.equal(exemplairesParEmplacement(regles, avecDon), don.exemplaires_ceinture);
  assert.equal(maximumDeLEmplacement(regles, avecDon, nomDe(potion.ressource_id)), don.exemplaires_ceinture);
  assert.equal(maximumDeLEmplacement(regles, avecDon, baton.nom), 1, 'le bâton reste à 1');
  assert.equal(maximumDeLEmplacement(regles, avecDon, nomDe(contenant.ressource_id)), contenant.contenance, '« ne peux être modifié par Organisé »');
  // le même don donne le sac de Force 5, quelle que soit la Force (48 emplacements à Force 1) ; une Force plus haute garde le sien
  if (don.sac_sans_force) {
    assert.deepEqual(donDuSacSansForce(regles, avecDon), { nom: don.nom, force: 5 });
    assert.equal(inventaireDe(regles, avecDon).emplacements, emplacementsSelonLaForce(regles, 5));
    assert.equal(inventaireDe(regles, { ...avecDon, caracteristiques: [{ caracteristique_id: 'force', base: 7, croix: 0 }] }).emplacements, emplacementsSelonLaForce(regles, 7));
  }
  const avant = xps.filter((x) => niveauDeClasse(aLXp(x)) < don.niveau);
  if (avant.length) {
    assert.equal(exemplairesParEmplacement(regles, aLXp(avant.at(-1))), 3, 'pas avant son niveau');
    assert.equal(donDuSacSansForce(regles, aLXp(avant.at(-1))), null);
    assert.equal(inventaireDe(regles, aLXp(avant.at(-1))).emplacements, 24);
  }
});

test('ceinture : ce qui va à la ceinture, d’après son nom ; les suggestions sont tous les objets du sac', () => {
  assert.equal(objetDeCeinture(regles, baton.nom).genre, 'baton');
  assert.equal(objetDeCeinture(regles, nomDe(potion.ressource_id)).genre, 'fiole');
  assert.equal(objetDeCeinture(regles, nomDe(contenant.ressource_id)).genre, 'contenant');
  assert.equal(objetDeCeinture(regles, materiel.nom), null, 'le matériel n’est pas listé (R81)');
  assert.equal(objetDeCeinture(regles, ''), null);
  // un homonyme hors de la liste (la base en a, le site de dev crée des composants), rangé avant elle, ne masque pas une potion
  const homonyme = { ...regles, ressources: [{ id: 'essai:homonyme', genre: 'materiel', nom: nomDe(potion.ressource_id) }, ...regles.ressources] };
  assert.deepEqual(objetDeCeinture(homonyme, nomDe(potion.ressource_id)), { genre: 'fiole', ressource_id: potion.ressource_id });
  // « On peut assigner n'importe quel objet de l'inventaire » : le matériel et un objet du MJ aussi, une fois chacun, dans l'ordre du sac
  const f = fiche({ inventaire: sac([nomDe(potion.ressource_id), 2], [materiel.nom, 1], [baton.nom, 1], ['Dague du MJ', 1], [nomDe(potion.ressource_id), 1]) });
  assert.deepEqual(suggestionsDeCeinture(f), [
    { nom: nomDe(potion.ressource_id), quantite: 3 }, { nom: materiel.nom, quantite: 1 }, { nom: baton.nom, quantite: 1 }, { nom: 'Dague du MJ', quantite: 1 },
  ]);
  assert.deepEqual(suggestionsDeCeinture(fiche({ inventaire: sac([nomDe(potion.ressource_id), 0], ['  ', 3]) })), [], 'ni une ligne à 0 ni une ligne sans nom');
});

// la fiche et le sac après une suite d'actions, et les deux comptes que les exemples du propriétaire donnent (sac, ceinture) pour l'objet `nom`
const comptes = (f, nom) => [dansLeSac(f, nom), (f.ceinture ?? []).filter((x) => x.nom === nom).reduce((n, x) => n + x.quantite, 0)];
const apres = (f, r) => ({ ...f, ...r });

test('ceinture, les exemples du propriétaire : assigner, « Utiliser », « Remplir », « Ranger » (décision R89, 2026-10-16)', () => {
  const fiole = nomDe(potion.ressource_id);
  // « 10 fioles bleues dans l'inventaire. Rien dans la ceinture. »
  let f = fiche({ inventaire: sac([fiole, 10]) });
  f = apres(f, mettreALaCeinture(regles, f, 1, fiole));
  assert.deepEqual(comptes(f, fiole), [7, 3], '« Assigner » : 7 dans l’inventaire, 3 à la ceinture');
  f = apres(f, utiliserLObjet(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [7, 2], '« Utiliser »');
  f = apres(f, utiliserLObjet(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [7, 1], '« Utiliser » une 2e fois');
  f = apres(f, remplirLEmplacement(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [5, 3], '« Remplir »');
  assert.equal(actionsDeLEmplacement(regles, f, 1).remplir, false, '« Masqué si quantité maximale atteinte »');
  f = apres(f, rangerLEmplacement(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [8, 0], '« Ranger » : 8 dans l’inventaire, rien à la ceinture');
  assert.deepEqual(f.ceinture, []);
  f = apres(f, mettreALaCeinture(regles, f, 1, fiole));
  f = apres(f, utiliserLObjet(regles, f, 1));
  f = apres(f, utiliserLObjet(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [5, 1], '« Assigner => Utiliser => Utiliser »');
  f = apres(f, utiliserLObjet(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [5, 0], '« Utiliser » : rien à la ceinture');
  assert.deepEqual(f.ceinture, [], '« saisie fioles bleue retirée de la ceinture »');
  assert.deepEqual(f.inventaire.map((l) => [l.rang, l.nom, l.quantite]), [[1, fiole, 5]], 'le sac : une ligne, renumérotée');
  // « (ou 6 et 4 si don "Organisé") »
  const organise = ficheAvecLeDonDesQuatre();
  if (organise) {
    const g = { ...organise, inventaire: sac([fiole, 10]) };
    assert.deepEqual(comptes(apres(g, mettreALaCeinture(regles, g, 1, fiole)), fiole), [6, 4]);
  }
});

test('ceinture : un objet assigné quitte le sac, 3 au plus ou tous s’il y en a moins, et ce que l’emplacement portait y retourne (R89)', () => {
  const fiole = nomDe(potion.ressource_id);
  // le sac en a moins que le maximum : tous ; plusieurs lignes, prises de la dernière à la première, les lignes vidées disparaissent
  let r = mettreALaCeinture(regles, fiche({ inventaire: sac([fiole, 1], [materiel.nom, 1], [fiole, 1]) }), 2, fiole);
  assert.deepEqual(r.ceinture, [{ nom: fiole, quantite: 2, ressource_id: potion.ressource_id, rang: 2 }]);
  assert.deepEqual(r.inventaire.map((l) => [l.rang, l.nom]), [[1, materiel.nom]]);
  // un autre objet assigné au même emplacement : le premier est rangé, le second sort du sac
  const f = fiche({ inventaire: sac([fiole, 5], [materiel.nom, 1]) });
  r = mettreALaCeinture(regles, f, 1, fiole);
  r = mettreALaCeinture(regles, apres(f, r), 1, materiel.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [[materiel.nom, 1]], 'le matériel aussi');
  assert.deepEqual([dansLeSac(r, fiole), dansLeSac(r, materiel.nom)], [5, 0]);
  // le même objet sur deux emplacements : chacun prend ce qui reste
  r = mettreALaCeinture(regles, f, 1, fiole);
  r = mettreALaCeinture(regles, apres(f, r), 2, fiole);
  assert.deepEqual(r.ceinture.map((x) => [x.rang, x.quantite]), [[1, 3], [2, 2]]);
  assert.equal(dansLeSac(r, fiole), 0);
  // un objet du MJ ajouté au sac s'assigne comme les autres
  const mj = fiche({ inventaire: sac(['Dague runique du MJ', 1]) });
  r = mettreALaCeinture(regles, mj, 3, 'Dague runique du MJ');
  assert.deepEqual(r.ceinture, [{ nom: 'Dague runique du MJ', quantite: 1, ressource_id: null, rang: 3 }]);
  assert.deepEqual(r.inventaire, []);
});

test('ceinture : un nom que le sac n’a pas est refusé, rien ne change (« Sac seulement ») ; un nom vide aussi (on vide un emplacement par « Ranger »)', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([materiel.nom, 1]), ceinture: [{ rang: 1, nom: fiole, quantite: 2, ressource_id: potion.ressource_id }] });
  assert.equal(mettreALaCeinture(regles, f, 1, 'Dague du MJ'), null);
  assert.equal(mettreALaCeinture(regles, f, 2, nomDe(contenant.ressource_id)), null, 'un carquois absent du sac aussi');
  assert.equal(mettreALaCeinture(regles, fiche(), 1, baton.nom), null);
  // l'objet de l'emplacement compte : rangé puis repris, il revient tel quel (le sac n'en avait plus)
  assert.deepEqual(mettreALaCeinture(regles, f, 1, fiole).ceinture.map((x) => [x.nom, x.quantite]), [[fiole, 2]]);
  assert.equal(mettreALaCeinture(regles, f, 1, '  '), null);
  assert.equal(mettreALaCeinture(regles, f, 1, ''), null);
});

test('ceinture : un bâton magique compte pour un, sans « Utiliser » ni « Remplir » ; « Ranger » le rend au sac (R89)', () => {
  const f = fiche({ inventaire: sac([baton.nom, 2]) });
  let r = apres(f, mettreALaCeinture(regles, f, 3, baton.nom));
  assert.deepEqual(comptes(r, baton.nom), [1, 1], '« Le max est 1 »');
  assert.deepEqual(actionsDeLEmplacement(regles, r, 3), { quantite: 1, min: 1, max: 1, genre: 'baton', utiliser: false, refus: null, remplir: false, duSac: 0 });
  assert.deepEqual(utiliserLObjet(regles, r, 3).ceinture, r.ceinture, '« Utiliser » masqué : rien ne change');
  assert.deepEqual(remplirLEmplacement(regles, r, 3).inventaire, r.inventaire);
  r = apres(r, rangerLEmplacement(regles, r, 3));
  assert.deepEqual(comptes(r, baton.nom), [2, 0]);
  // une fiche importée avec 3 bâtons sur un emplacement : au-delà du maximum, rangé, tous retournent au sac
  const importee = fiche({ inventaire: [], ceinture: [{ rang: 1, nom: baton.nom, quantite: 3, ressource_id: null }] });
  assert.equal(actionsDeLEmplacement(regles, importee, 1).remplir, false);
  assert.equal(dansLeSac(rangerLEmplacement(regles, importee, 1), baton.nom), 3);
});

test('ceinture : un carquois arrive plein, « Remplir » ajoute 1 sans rien sortir du sac, il reste à 0 et repart sans ses projectiles (R89)', () => {
  const carquois = nomDe(contenant.ressource_id);
  const n = contenant.contenance;
  const f = fiche({ inventaire: sac([carquois, 2]) });
  let r = apres(f, mettreALaCeinture(regles, f, 2, carquois));
  assert.deepEqual(comptes(r, carquois), [1, n], 'un carquois a quitté le sac, plein (« Carquois de 5 flèches => 5 »)');
  assert.equal(actionsDeLEmplacement(regles, r, 2).remplir, false, 'plein : « Remplir » masqué');
  r = apres(r, utiliserLObjet(regles, r, 2));
  assert.deepEqual(comptes(r, carquois), [1, n - 1]);
  assert.deepEqual(actionsDeLEmplacement(regles, r, 2), { quantite: n - 1, min: 0, max: n, genre: 'contenant', utiliser: true, refus: null, remplir: true, duSac: null });
  r = apres(r, remplirLEmplacement(regles, r, 2));
  assert.deepEqual(comptes(r, carquois), [1, n], '« ne fait qu’incrémenter de 1 » : le sac ne bouge pas');
  for (let i = 0; i < n; i += 1) r = apres(r, utiliserLObjet(regles, r, 2));
  assert.deepEqual(r.ceinture.map((x) => [x.rang, x.quantite]), [[2, 0]], '« Le carquois reste si 0 »');
  assert.equal(actionsDeLEmplacement(regles, r, 2).utiliser, false, '« A zéro "Utiliser" disparait »');
  assert.deepEqual(utiliserLObjet(regles, r, 2).ceinture, r.ceinture);
  r = apres(r, remplirLEmplacement(regles, r, 2));
  assert.equal(r.ceinture[0].quantite, 1);
  r = apres(r, rangerLEmplacement(regles, r, 2));
  assert.deepEqual(comptes(r, carquois), [2, 0], 'le carquois revient, ses projectiles ne sont pas des objets du sac');
  // « ne peux être modifié par Organisé »
  const organise = ficheAvecLeDonDesQuatre();
  if (organise) {
    const g = { ...organise, inventaire: sac([carquois, 1]) };
    assert.deepEqual(comptes(apres(g, mettreALaCeinture(regles, g, 1, carquois)), carquois), [0, n]);
  }
});

test('ceinture : un carquois se reconnaît aussi à son identifiant (renommé depuis sur le site de dev) ; sans contenance écrite, 3, sans le don ; remplacé, il revient seul', () => {
  const carquois = nomDe(contenant.ressource_id);
  const n = contenant.contenance;
  // la fiche garde l'ancien nom et l'identifiant : rangé, il rend un carquois au sac, pas autant de carquois que de projectiles
  const renomme = fiche({ ceinture: [{ rang: 1, nom: 'Carquois sous son ancien nom', quantite: n, ressource_id: contenant.ressource_id }] });
  assert.deepEqual(actionsDeLEmplacement(regles, renomme, 1), { quantite: n, min: 0, max: n, genre: 'contenant', utiliser: true, refus: null, remplir: false, duSac: null });
  assert.deepEqual(rangerLEmplacement(regles, renomme, 1).inventaire.map((l) => [l.nom, l.quantite]), [['Carquois sous son ancien nom', 1]]);
  // au sac sous son ancien nom : assigné, il arrive plein, comme un carquois
  const auSac = fiche({ inventaire: [{ rang: 1, nom: 'Carquois sous son ancien nom', quantite: 2, ressource_id: contenant.ressource_id }] });
  const r = mettreALaCeinture(regles, auSac, 1, 'Carquois sous son ancien nom');
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite, x.ressource_id]), [['Carquois sous son ancien nom', n, contenant.ressource_id]]);
  assert.equal(dansLeSac(r, 'Carquois sous son ancien nom'), 1);
  // un carquois dont le texte n'écrit plus de contenance : 3 (ceinture.exemplaires_par_emplacement), que « Organisé » ne change pas
  const sansContenance = { ...regles, ceinture: { ...regles.ceinture, objets: regles.ceinture.objets.map((o) => (o === contenant ? { ...o, contenance: null } : o)) } };
  assert.equal(maximumDeLEmplacement(sansContenance, fiche(), carquois), 3);
  const organise = ficheAvecLeDonDesQuatre();
  if (organise) assert.equal(maximumDeLEmplacement(sansContenance, organise, carquois), 3);
  const g = fiche({ inventaire: sac([carquois, 1]) });
  assert.equal(mettreALaCeinture(sansContenance, g, 1, carquois).ceinture[0].quantite, 3);
  // un carquois à demi vide remplacé par un autre objet : il revient au sac, seul, l'autre objet en sort
  const fiole = nomDe(potion.ressource_id);
  const h = fiche({ inventaire: sac([fiole, 4]), ceinture: [{ rang: 2, nom: carquois, quantite: 4, ressource_id: contenant.ressource_id }] });
  const s2 = mettreALaCeinture(regles, h, 2, fiole);
  assert.deepEqual(s2.ceinture.map((x) => [x.nom, x.quantite]), [[fiole, 3]]);
  assert.deepEqual(s2.inventaire.map((l) => [l.nom, l.quantite]), [[fiole, 1], [carquois, 1]]);
});

test('ceinture : au-delà du maximum (une fiche importée), « Utiliser » retire 1, « Remplir » reste masqué', () => {
  const fiole = nomDe(potion.ressource_id);
  let f = fiche({ inventaire: sac([fiole, 5]), ceinture: [{ rang: 1, nom: fiole, quantite: 7, ressource_id: potion.ressource_id }] });
  assert.deepEqual(actionsDeLEmplacement(regles, f, 1), { quantite: 7, min: 1, max: 3, genre: 'fiole', utiliser: true, refus: null, remplir: false, duSac: 0 });
  assert.deepEqual(remplirLEmplacement(regles, f, 1), { ceinture: f.ceinture, inventaire: f.inventaire });
  f = apres(f, utiliserLObjet(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [5, 6]);
  assert.deepEqual(comptes(apres(f, rangerLEmplacement(regles, f, 1)), fiole), [11, 0], 'rangé : tout retourne au sac');
});

test('ceinture : « Remplir » prend ce que le sac a, même moins que le maximum ; rien quand il n’en a plus', () => {
  const fiole = nomDe(potion.ressource_id);
  let f = fiche({ inventaire: sac([materiel.nom, 1], [fiole, 1]), ceinture: [{ rang: 1, nom: fiole, quantite: 1, ressource_id: potion.ressource_id }] });
  assert.equal(actionsDeLEmplacement(regles, f, 1).duSac, 1);
  f = apres(f, remplirLEmplacement(regles, f, 1));
  assert.deepEqual(comptes(f, fiole), [0, 2]);
  assert.deepEqual(f.inventaire.map((l) => [l.rang, l.nom]), [[1, materiel.nom]], 'la ligne vidée disparaît');
  assert.deepEqual(actionsDeLEmplacement(regles, f, 1), { quantite: 2, min: 1, max: 3, genre: 'fiole', utiliser: true, refus: null, remplir: true, duSac: 0 });
  assert.deepEqual(remplirLEmplacement(regles, f, 1), { ceinture: f.ceinture, inventaire: f.inventaire }, 'le sac n’en a plus : rien ne change');
  // un emplacement vide : ni action ni changement
  assert.equal(actionsDeLEmplacement(regles, f, 2), null);
  assert.deepEqual(utiliserLObjet(regles, f, 2).ceinture, f.ceinture);
  assert.deepEqual(remplirLEmplacement(regles, f, 2).ceinture, f.ceinture);
  // un objet que la fiche importée avait à la ceinture sans l'avoir au sac (un objet du MJ, un nom inconnu) : utilisé, rangé comme les autres
  const importee = fiche({ ceinture: [{ rang: 1, nom: 'Corde du MJ', quantite: 2, ressource_id: null }] });
  assert.equal(actionsDeLEmplacement(regles, importee, 1).duSac, 0);
  assert.deepEqual(comptes(apres(importee, utiliserLObjet(regles, importee, 1)), 'Corde du MJ'), [0, 1]);
  assert.deepEqual(comptes(apres(importee, rangerLEmplacement(regles, importee, 1)), 'Corde du MJ'), [2, 0], '« Pas de règle spéciale »');
});

test('quantités : un nombre saisi de 1 à 99 au sac ; le minimum d’un emplacement de ceinture, 0 pour un carquois (R88, R89)', () => {
  assert.deepEqual([-2, 0, 1, 42, 99, 100, 250].map((q) => quantiteDuSac(regles, q)), [1, 1, 1, 42, 99, 99, 99]);
  const fiole = nomDe(potion.ressource_id);
  const carquois = nomDe(contenant.ressource_id);
  assert.deepEqual([fiole, baton.nom, carquois, 'Dague du MJ'].map((n) => minimumDeLEmplacement(regles, n)), [1, 1, 0, 1], '« Le carquois reste si 0 »');
});

test('sac : un objet rangé remplit sa ligne jusqu’à 99, le reste sur une ligne nouvelle (R88)', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 98]), ceinture: [{ rang: 1, nom: fiole, quantite: 3, ressource_id: potion.ressource_id }] });
  const r = rangerLEmplacement(regles, f, 1);
  assert.deepEqual(r.inventaire.map((l) => [l.rang, l.nom, l.quantite]), [[1, fiole, 99], [2, fiole, 2]]);
  // une ligne à 0 (une saisie en cours, un import) n'est ni proposée ni comptée, et elle part quand l'objet sort du sac
  const zero = fiche({ inventaire: sac([fiole, 0], [materiel.nom, 1]) });
  assert.equal(dansLeSac(zero, fiole), 0);
  assert.equal(mettreALaCeinture(regles, zero, 1, fiole), null);
});

test('ceinture, pendant la frappe : seul un objet du sac choisi dans la liste se pose aussitôt ; le reste attend que le champ soit validé', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 2], [materiel.nom, 1]) });
  assert.equal(objetChoisiDansLaListe(f, fiole, 'insertReplacementText'), fiole, 'choisi dans la liste');
  assert.equal(objetChoisiDansLaListe(f, fiole, undefined), fiole, 'un navigateur qui ne dit pas d’où vient la saisie');
  assert.equal(objetChoisiDansLaListe(f, fiole, 'insertText'), null, 'tapé lettre à lettre : un nom plus long peut suivre');
  assert.equal(objetChoisiDansLaListe(f, fiole, 'deleteContentBackward'), null);
  assert.equal(objetChoisiDansLaListe(f, materiel.nom, 'insertReplacementText'), materiel.nom, 'tout objet du sac');
  assert.equal(objetChoisiDansLaListe(f, 'Dague du MJ', 'insertReplacementText'), null, 'pas dans le sac');
  // des noms qui se prolongent existent bien dans la liste (la raison de la règle)
  const noms = regles.ceinture.objets.map((o) => nomDe(o.ressource_id));
  assert.ok(noms.some((a) => noms.some((b) => b !== a && b.startsWith(`${a} `))), 'un nom de potion en prolonge un autre');
});
