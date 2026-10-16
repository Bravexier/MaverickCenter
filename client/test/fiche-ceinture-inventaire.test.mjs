// Inventaire et ceinture de la fiche de personnage (décisions R88, R89), sur les règles de la base telles que la page les reçoit (/fiche/regles.json) :
// emplacements de l'inventaire selon la Force (24, 28, 32, 36, puis 48 ; 48 avec le don « Organisé »), quantité d'une ligne du sac (1 à 99), quantité
// d'un emplacement de ceinture, un nombre saisi (1 à 3 exemplaires, 4 avec un don qui l'écrit, 1 pour un bâton magique, 0 à la contenance d'un carquois
// ou d'un sac), un objet du sac mis à la ceinture qui le quitte et y revient, un autre nom qui renomme l'objet de l'emplacement, ce que la page pose
// pendant la frappe, et les lectures de texte qui les nourrissent (lib/ceinture-texte.mjs), rejouées sur toute la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contenanceEcrite, exemplairesDeCeintureEcrits, nomDeBaton, sacSansForceEcrit } from '../src/lib/ceinture-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  changerLaQuantiteDeCeinture, classesDe, dansLeSac, donDuSacSansForce, emplacementsSelonLaForce, exemplairesParEmplacement, inventaireDe, maximumDeLEmplacement,
  mettreALaCeinture, minimumDeLEmplacement, objetChoisiDansLaListe, objetDeCeinture, quantiteDeCeinture, quantiteDuSac, suggestionsDeCeinture, viderLEmplacement,
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
  assert.equal(maximumDeLEmplacement(regles, fiche(), 'Objet spécial du MJ'), 3, 'une saisie libre aussi');
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

test('ceinture : ce qui va à la ceinture, d’après son nom ; les suggestions sont les objets du sac qui y vont', () => {
  assert.equal(objetDeCeinture(regles, baton.nom).genre, 'baton');
  assert.equal(objetDeCeinture(regles, nomDe(potion.ressource_id)).genre, 'fiole');
  assert.equal(objetDeCeinture(regles, nomDe(contenant.ressource_id)).genre, 'contenant');
  assert.equal(objetDeCeinture(regles, materiel.nom), null, 'le matériel n’est pas listé (R81), il se saisit librement');
  assert.equal(objetDeCeinture(regles, ''), null);
  // un homonyme hors de la liste (la base en a, le site de dev crée des composants), rangé avant elle, ne masque pas une potion
  const homonyme = { ...regles, ressources: [{ id: 'essai:homonyme', genre: 'materiel', nom: nomDe(potion.ressource_id) }, ...regles.ressources] };
  assert.deepEqual(objetDeCeinture(homonyme, nomDe(potion.ressource_id)), { genre: 'fiole', ressource_id: potion.ressource_id });
  const f = fiche({ inventaire: sac([nomDe(potion.ressource_id), 2], [materiel.nom, 1], [baton.nom, 1], [nomDe(potion.ressource_id), 1]) });
  assert.deepEqual(suggestionsDeCeinture(regles, f), [{ nom: nomDe(potion.ressource_id), quantite: 3 }, { nom: baton.nom, quantite: 1 }]);
});

test('quantités : un nombre saisi, de 1 à 99 au sac, de 1 à 3 à la ceinture (1 pour un bâton), de 0 à sa contenance pour un carquois (R88, R89)', () => {
  assert.deepEqual([-2, 0, 1, 42, 99, 100, 250].map((q) => quantiteDuSac(regles, q)), [1, 1, 1, 42, 99, 99, 99]);
  const fiole = nomDe(potion.ressource_id);
  const carquois = nomDe(contenant.ressource_id);
  assert.deepEqual([0, 1, 3, 9].map((q) => quantiteDeCeinture(regles, fiche(), fiole, q)), [1, 1, 3, 3]);
  assert.deepEqual([0, 1, 3].map((q) => quantiteDeCeinture(regles, fiche(), baton.nom, q)), [1, 1, 1]);
  assert.deepEqual([-1, 0, 7, contenant.contenance + 5].map((q) => quantiteDeCeinture(regles, fiche(), carquois, q)), [0, 0, 7, contenant.contenance]);
  assert.deepEqual([fiole, baton.nom, carquois, 'Dague du MJ'].map((n) => minimumDeLEmplacement(regles, n)), [1, 1, 0, 1], '« Un Carquois à 0 est juste un carquois vide »');
  // la quantité se saisit : le sac ne change pas, ni pour plus ni pour moins (« On va juste mettre un nombre à saisir »)
  const f = fiche({ inventaire: sac([fiole, 1]), ceinture: [{ rang: 1, nom: fiole, quantite: 2, ressource_id: potion.ressource_id }] });
  for (const q of [1, 3]) {
    const r = changerLaQuantiteDeCeinture(regles, f, 1, q);
    assert.equal(r.ceinture[0].quantite, q);
    assert.deepEqual(r.inventaire, f.inventaire);
  }
  assert.deepEqual(changerLaQuantiteDeCeinture(regles, f, 2, 3).ceinture, f.ceinture, 'un emplacement vide n’a pas de quantité');
});

test('ceinture ↔ sac : un objet choisi dans le sac le quitte (au plus le maximum), et ce que l’emplacement portait y retourne (R89)', () => {
  const fiole = nomDe(potion.ressource_id);
  let f = fiche({ inventaire: sac([fiole, 5], [materiel.nom, 1]) });
  let r = mettreALaCeinture(regles, f, 1, fiole);
  assert.deepEqual(r.ceinture, [{ nom: fiole, quantite: 3, ressource_id: potion.ressource_id, rang: 1 }], '3 exemplaires au plus');
  assert.equal(dansLeSac(r, fiole), 2, 'ils ont quitté le sac');
  f = { ...f, ...r };
  // le sac en a moins que le maximum : il donne ce qu'il a ; plusieurs lignes, prises de la dernière à la première
  r = mettreALaCeinture(regles, fiche({ inventaire: sac([fiole, 1], [materiel.nom, 1], [fiole, 1]) }), 2, fiole);
  assert.equal(r.ceinture[0].quantite, 2);
  assert.deepEqual(r.inventaire.map((l) => l.nom), [materiel.nom], 'les lignes vidées disparaissent');
  // une fiole bue : la quantité baisse, le sac ne bouge pas ; puis l'emplacement change pour un objet du sac : ce qui reste retourne au sac
  f = { ...f, ...changerLaQuantiteDeCeinture(regles, f, 1, 1) };
  r = mettreALaCeinture(regles, f, 1, materiel.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [[materiel.nom, 1]], 'un objet du sac hors de la liste s’y prend aussi');
  assert.equal(dansLeSac(r, fiole), 3, '2 restées au sac + celle de la ceinture');
  assert.equal(dansLeSac(r, materiel.nom), 0);
  // vider : l'objet retourne au sac, sur sa ligne
  r = viderLEmplacement(regles, { ...f, ...r }, 1);
  assert.deepEqual(r.ceinture, []);
  assert.equal(dansLeSac(r, materiel.nom), 1);
  assert.deepEqual(r.inventaire.map((l) => l.rang), r.inventaire.map((_, i) => i + 1), 'rangs du sac renumérotés');
});

test('ceinture ↔ sac : un carquois arrive vide et repart sans ses projectiles ; un bâton compte pour un', () => {
  const carquois = nomDe(contenant.ressource_id);
  const f = fiche({ inventaire: sac([carquois, 2], [baton.nom, 1]) });
  let r = mettreALaCeinture(regles, f, 2, carquois);
  assert.equal(r.ceinture[0].quantite, 0, '« Un Carquois à 0 est juste un carquois vide »');
  assert.equal(dansLeSac(r, carquois), 1, 'un carquois a quitté le sac');
  r = { ...r, ...changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 2, contenant.contenance + 5) };
  assert.equal(r.ceinture[0].quantite, contenant.contenance, 'ses projectiles, jusqu’à sa contenance');
  assert.equal(dansLeSac(r, carquois), 1, 'le sac ne bouge pas');
  r = mettreALaCeinture(regles, { ...f, ...r }, 3, baton.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.rang, x.quantite]), [[2, contenant.contenance], [3, 1]]);
  assert.equal(dansLeSac(r, baton.nom), 0, 'le bâton a quitté le sac');
  const v = viderLEmplacement(regles, { ...f, ...r }, 2);
  assert.equal(dansLeSac(v, carquois), 2, 'le carquois revient, ses projectiles ne sont pas des objets du sac');
  // une fiche importée avec 3 bâtons sur un emplacement : vidé, tous retournent au sac
  const importee = fiche({ inventaire: [], ceinture: [{ rang: 1, nom: baton.nom, quantite: 3, ressource_id: null }] });
  assert.equal(dansLeSac(viderLEmplacement(regles, importee, 1), baton.nom), 3);
});

test('ceinture : un nom hors du sac corrige une saisie libre, ou y est posé (l’objet du catalogue remplacé retourne au sac) ; un objet du MJ retourne au sac comme les autres (R89)', () => {
  const fiole = nomDe(potion.ressource_id);
  const carquois = nomDe(contenant.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 1]) });
  const sacDe = (x) => x.inventaire.map((l) => [l.nom, l.quantite]);
  // posé : un objet du MJ à 1, un carquois absent du sac à 0 ; le sac ne change pas
  let r = mettreALaCeinture(regles, f, 1, 'Dague runique du MJ');
  assert.deepEqual(r.ceinture, [{ nom: 'Dague runique du MJ', quantite: 1, ressource_id: null, rang: 1 }]);
  assert.deepEqual(sacDe(r), [[fiole, 1]]);
  assert.equal(mettreALaCeinture(regles, f, 2, carquois).ceinture[0].quantite, 0);
  // corrigé (« Corde » puis « Corde de 10 m ») : renommé sur place, il garde sa quantité, et rien n'entre au sac
  r = { ...f, ...r, ...changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 1, 2) };
  r = mettreALaCeinture(regles, r, 1, 'Dague runique du MJ +1');
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [['Dague runique du MJ +1', 2]]);
  assert.deepEqual(sacDe(r), [[fiole, 1]]);
  // retiré : il retourne au sac comme les autres objets (« Pas de règle spéciale »)
  r = viderLEmplacement(regles, { ...f, ...r }, 1);
  assert.deepEqual(sacDe(r), [[fiole, 1], ['Dague runique du MJ +1', 2]]);
  // remplacé par un objet du sac : il retourne au sac, l'objet choisi en sort
  r = mettreALaCeinture(regles, { ...f, ceinture: [{ rang: 1, nom: 'Xyz', quantite: 1, ressource_id: null }] }, 1, fiole);
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [[fiole, 1]]);
  assert.deepEqual(sacDe(r), [['Xyz', 1]]);
  // un objet du catalogue remplacé par un nom absent du sac (un bâton, l'autre fiole déjà à la ceinture) : il retourne au sac, rien ne se perd
  const g = fiche({ inventaire: sac([fiole, 5]) });
  r = mettreALaCeinture(regles, g, 1, fiole);
  r = mettreALaCeinture(regles, { ...g, ...r }, 1, baton.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [[baton.nom, 1]]);
  assert.equal(dansLeSac(r, fiole), 5, 'les 3 fioles de l’emplacement sont revenues');
  r = mettreALaCeinture(regles, { ...g, ceinture: [{ rang: 1, nom: carquois, quantite: 4, ressource_id: contenant.ressource_id }] }, 1, 'Dague du MJ');
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [['Dague du MJ', 1]]);
  assert.equal(dansLeSac(r, carquois), 1, 'le carquois remplacé est revenu au sac');
  // un nom vide vide l'emplacement
  assert.deepEqual(mettreALaCeinture(regles, { ...f, ...r }, 1, '  ').ceinture, []);
});

test('sac : un objet rendu par la ceinture remplit sa ligne jusqu’à 99, le reste sur une ligne nouvelle (R88)', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 98]), ceinture: [{ rang: 1, nom: fiole, quantite: 3, ressource_id: potion.ressource_id }] });
  const r = viderLEmplacement(regles, f, 1);
  assert.deepEqual(r.inventaire.map((l) => [l.rang, l.nom, l.quantite]), [[1, fiole, 99], [2, fiole, 2]]);
  // une ligne à 0 (une saisie en cours, un import) n'est ni proposée ni comptée, et elle part quand l'objet sort du sac
  const zero = fiche({ inventaire: sac([fiole, 0], [materiel.nom, 1]) });
  assert.deepEqual(suggestionsDeCeinture(regles, zero), []);
  assert.equal(dansLeSac(zero, fiole), 0);
});

test('ceinture, pendant la frappe : seul un objet du sac choisi dans la liste se pose aussitôt ; le reste attend que le champ soit validé', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 2], [materiel.nom, 1]) });
  assert.equal(objetChoisiDansLaListe(regles, f, fiole, 'insertReplacementText'), fiole, 'choisi dans la liste');
  assert.equal(objetChoisiDansLaListe(regles, f, fiole, undefined), fiole, 'un navigateur qui ne dit pas d’où vient la saisie');
  assert.equal(objetChoisiDansLaListe(regles, f, fiole, 'insertText'), null, 'tapé lettre à lettre : un nom plus long peut suivre');
  assert.equal(objetChoisiDansLaListe(regles, f, fiole, 'deleteContentBackward'), null);
  assert.equal(objetChoisiDansLaListe(regles, f, materiel.nom, 'insertReplacementText'), null, 'pas un objet de ceinture');
  assert.equal(objetChoisiDansLaListe(regles, f, 'Dague du MJ', 'insertReplacementText'), null);
  // des noms qui se prolongent existent bien dans la liste (la raison de la règle)
  const noms = regles.ceinture.objets.map((o) => nomDe(o.ressource_id));
  assert.ok(noms.some((a) => noms.some((b) => b !== a && b.startsWith(`${a} `))), 'un nom de potion en prolonge un autre');
});
