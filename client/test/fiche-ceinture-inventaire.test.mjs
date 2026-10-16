// Inventaire et ceinture de la fiche de personnage (décisions R88, R89), sur les règles de la base telles que la page les reçoit (/fiche/regles.json) :
// emplacements de l'inventaire selon la Force (24, 28, 32, 36, puis 48), quantité au plus d'un emplacement de ceinture (3 exemplaires, 4 avec un don qui
// l'écrit, 1 pour un bâton magique, la contenance d'un carquois ou d'un sac), un objet du sac mis à la ceinture qui le quitte et y revient (sans monter
// au-delà de ce que le sac en a ; posé sans y être, il compte 1), une saisie libre qui ne touche pas au sac, ce que la page pose pendant la frappe, et les lectures de texte qui les nourrissent
// (lib/ceinture-texte.mjs), rejouées sur toute la base.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contenanceEcrite, exemplairesDeCeintureEcrits, nomDeBaton } from '../src/lib/ceinture-texte.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { ficheVide } from '../src/lib/fiche-format.mjs';
import {
  changerLaQuantiteDeCeinture, classesDe, dansLeSac, emplacementsSelonLaForce, exemplairesParEmplacement, inventaireDe, maximumDeLEmplacement, mettreALaCeinture,
  objetChoisiDansLaListe, objetDeCeinture, quantiteMaxDeLEmplacement, suggestionsDeCeinture, viderLEmplacement,
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
  assert.equal(nomDeBaton('Feu', 2), 'Bâton magique Feu, niveau 2');
  // à l'import (le site de dev peut réécrire ces textes : historique_modification) : chaque carquois ou sac que la vue retient (sa règle : matériel dont la
  // clé écrit « carquois », « sac-de-bombe » ou « sac-de-pierre ») écrit sa contenance, et un don au moins écrit des exemplaires de ceinture, plus que 3
  const historique = historiqueSite(db);
  const contenantsDImport = historique.lignesDImport('ressource').filter((r) => r.genre === 'materiel' && /carquois|sac-de-bombe|sac-de-pierre/.test(r.nom_cle));
  assert.ok(contenantsDImport.length > 0);
  for (const r of contenantsDImport) assert.ok(contenanceEcrite(r.description) > 0, r.nom);
  const ecritsDImport = historique.lignesDImport('capacite').map((c) => exemplairesDeCeintureEcrits(c.effet)).filter(Boolean);
  assert.ok(ecritsDImport.length >= 1 && ecritsDImport.every((n) => n > regles.constantes['ceinture.exemplaires_par_emplacement']));
  // l'état courant, cohérent : une contenance que le texte n'écrit plus est absente, jamais fausse ; la page reçoit chaque objet de la vue, une fois
  for (const c of regles.ceinture.objets.filter((o) => o.famille === 'contenant')) {
    assert.ok(c.contenance === null || (Number.isInteger(c.contenance) && c.contenance > 0), nomDe(c.ressource_id));
  }
  for (const d of regles.classes.flatMap((c) => c.dons)) if ('exemplaires_ceinture' in d) assert.ok(Number.isInteger(d.exemplaires_ceinture) && d.exemplaires_ceinture > 0);
  assert.equal(regles.ceinture.objets.length + regles.ceinture.batons.length, db.prepare('SELECT COUNT(*) AS n FROM v_objet_ceinture').get().n);
  assert.equal(new Set(regles.ceinture.batons.map((b) => b.nom)).size, regles.ceinture.batons.length, 'un nom par bâton');
});

test('ceinture : 3 exemplaires par emplacement, 4 avec le don qui l’écrit, 1 pour un bâton, la contenance d’un carquois (décision R89)', () => {
  assert.equal(regles.constantes['ceinture.exemplaires_par_emplacement'], 3);
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
  const avant = xps.filter((x) => niveauDeClasse(aLXp(x)) < don.niveau);
  if (avant.length) assert.equal(exemplairesParEmplacement(regles, aLXp(avant.at(-1))), 3, 'pas avant son niveau');
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

test('ceinture ↔ sac : l’objet quitte le sac (au plus le maximum de l’emplacement) et y revient quand on vide ou change l’emplacement', () => {
  const fiole = nomDe(potion.ressource_id);
  let f = fiche({ inventaire: sac([fiole, 5], [materiel.nom, 1]) });
  let r = mettreALaCeinture(regles, f, 1, fiole);
  assert.deepEqual(r.ceinture, [{ nom: fiole, quantite: 3, ressource_id: potion.ressource_id, rang: 1 }], '3 exemplaires au plus');
  assert.equal(dansLeSac({ inventaire: r.inventaire }, fiole), 2, 'ils ont quitté le sac');
  f = { ...f, ...r };
  // moins d'exemplaires : la différence retourne au sac ; plus : ils en ressortent, sans dépasser le maximum
  r = changerLaQuantiteDeCeinture(regles, f, 1, 1);
  assert.equal(r.ceinture[0].quantite, 1);
  assert.equal(dansLeSac({ inventaire: r.inventaire }, fiole), 4);
  r = changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 1, 9);
  assert.equal(r.ceinture[0].quantite, 3, 'borné au maximum');
  assert.equal(dansLeSac({ inventaire: r.inventaire }, fiole), 2);
  f = { ...f, ...r };
  // changer l'objet de l'emplacement : l'ancien revient au sac
  r = mettreALaCeinture(regles, f, 1, baton.nom);
  assert.deepEqual(r.ceinture, [{ nom: baton.nom, quantite: 1, ressource_id: null, rang: 1 }], 'un bâton absent du sac, posé à 1');
  assert.equal(dansLeSac({ inventaire: r.inventaire }, fiole), 5, 'les fioles sont revenues');
  // vider : un objet du sac y retourne (sur une ligne nouvelle quand le sac ne l'avait pas : posé sans y être, il y va quand on le retire)
  r = viderLEmplacement(regles, { ...f, ...r }, 1);
  assert.deepEqual(r.ceinture, []);
  assert.equal(dansLeSac({ inventaire: r.inventaire }, baton.nom), 1);
  assert.deepEqual(r.inventaire.map((l) => l.rang), r.inventaire.map((_, i) => i + 1), 'rangs du sac renumérotés');
});

test('ceinture ↔ sac : un bâton ou un contenant sort une unité ; la quantité d’un contenant compte ses projectiles, sans toucher au sac', () => {
  const carquois = nomDe(contenant.ressource_id);
  const f = fiche({ inventaire: sac([carquois, 2], [baton.nom, 1]) });
  let r = mettreALaCeinture(regles, f, 2, carquois);
  assert.equal(r.ceinture[0].quantite, 1);
  assert.equal(dansLeSac({ inventaire: r.inventaire }, carquois), 1, 'un carquois a quitté le sac');
  r = changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 2, contenant.contenance + 5);
  assert.equal(r.ceinture[0].quantite, contenant.contenance, 'ses projectiles, jusqu’à sa contenance');
  assert.equal(dansLeSac({ inventaire: r.inventaire }, carquois), 1, 'le sac ne bouge pas');
  r = mettreALaCeinture(regles, { ...f, ...r }, 3, baton.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.rang, x.quantite]), [[2, contenant.contenance], [3, 1]]);
  assert.equal(dansLeSac({ inventaire: r.inventaire }, baton.nom), 0, 'le bâton a quitté le sac');
  const g = changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 3, 3);
  assert.equal(g.ceinture.find((x) => x.rang === 3).quantite, 1, 'un bâton reste à 1');
  // une fiche importée avec 3 bâtons sur un emplacement : ramenés à 1, les 2 autres retournent au sac ; l'emplacement vidé, tous y retournent
  const importee = fiche({ inventaire: [], ceinture: [{ rang: 1, nom: baton.nom, quantite: 3, ressource_id: null }] });
  assert.equal(dansLeSac(changerLaQuantiteDeCeinture(regles, importee, 1, 1), baton.nom), 2);
  assert.equal(dansLeSac(viderLEmplacement(regles, importee, 1), baton.nom), 3);
  // vider l'emplacement du carquois : une unité retourne au sac, pas ses projectiles
  const v = viderLEmplacement(regles, { ...f, ...r }, 2);
  assert.equal(dansLeSac({ inventaire: v.inventaire }, carquois), 2);
});

test('ceinture : une saisie libre (objet spécial du MJ) ne touche pas au sac, ni posée, ni renommée, ni retirée ; un nom vide vide l’emplacement', () => {
  const fiole = nomDe(potion.ressource_id);
  const f = fiche({ inventaire: sac([fiole, 1], [materiel.nom, 2]) });
  const sacDe = (x) => x.inventaire.map((l) => [l.nom, l.quantite]);
  let r = mettreALaCeinture(regles, f, 1, 'Dague runique du MJ');
  assert.deepEqual(r.ceinture, [{ nom: 'Dague runique du MJ', quantite: 1, ressource_id: null, rang: 1 }]);
  assert.deepEqual(sacDe(r), [[fiole, 1], [materiel.nom, 2]]);
  r = changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 1, 2);
  assert.equal(r.ceinture[0].quantite, 2, 'hors du sac : la fiche suit la saisie, jusqu’au maximum');
  assert.equal(quantiteMaxDeLEmplacement(regles, { ...f, ...r }, 1), 3);
  // corrigée (« Corde » puis « Corde de 10 m ») : renommée sur place, elle garde sa quantité et rien n'entre au sac
  r = mettreALaCeinture(regles, { ...f, ...r }, 1, 'Dague runique du MJ +1');
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [['Dague runique du MJ +1', 2]]);
  assert.deepEqual(sacDe(r), [[fiole, 1], [materiel.nom, 2]], 'le premier nom n’entre pas au sac');
  // retirée : elle disparaît
  r = mettreALaCeinture(regles, { ...f, ...r }, 1, '  ');
  assert.deepEqual(r.ceinture, []);
  assert.deepEqual(sacDe(r), [[fiole, 1], [materiel.nom, 2]], 'vidée : une saisie libre disparaît');
  // un objet du sac hors de la liste (R81 : le matériel) se saisit librement : le sac le garde
  r = mettreALaCeinture(regles, f, 2, materiel.nom);
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite, x.ressource_id]), [[materiel.nom, 1, materiel.id]]);
  assert.deepEqual(sacDe(r), [[fiole, 1], [materiel.nom, 2]]);
  // une fiole remplacée par une saisie libre (« Xyz »), puis l'emplacement vidé : la fiole revient au sac, « Xyz » n'y entre jamais
  r = mettreALaCeinture(regles, f, 1, fiole);
  r = mettreALaCeinture(regles, { ...f, ...r }, 1, 'Xyz');
  assert.deepEqual(r.ceinture.map((x) => [x.nom, x.quantite]), [['Xyz', 1]], 'une fiole remplacée par une saisie libre : quantité 1');
  r = viderLEmplacement(regles, { ...f, ...r }, 1);
  assert.deepEqual(sacDe(r), [[materiel.nom, 2], [fiole, 1]]);
});

test('ceinture ↔ sac : pas plus d’exemplaires que le sac n’en a ; le sac fournit ce qu’il a, sur plusieurs lignes, et reprend ce qu’on lui rend', () => {
  const fiole = nomDe(potion.ressource_id);
  // le sac n'en a que 2 (maximum 3) : la ceinture en prend 2 et ne monte pas au-delà
  let f = fiche({ inventaire: sac([fiole, 2], [materiel.nom, 1]) });
  let r = mettreALaCeinture(regles, f, 1, fiole);
  assert.equal(r.ceinture[0].quantite, 2);
  assert.deepEqual(r.inventaire.map((l) => l.nom), [materiel.nom], 'la ligne vidée disparaît');
  f = { ...f, ...r };
  assert.equal(quantiteMaxDeLEmplacement(regles, f, 1), 2, 'ce qu’elle porte et ce que le sac en a encore');
  r = changerLaQuantiteDeCeinture(regles, f, 1, 3);
  assert.equal(r.ceinture[0].quantite, 2, 'pas d’exemplaire en plus de ce que le sac avait');
  r = viderLEmplacement(regles, { ...f, ...r }, 1);
  assert.equal(dansLeSac(r, fiole), 2, 'vidée : le sac retrouve ses 2 fioles, pas plus');
  // une fiole de plus au sac : la ceinture peut monter à 3
  f = { ...f, inventaire: [...f.inventaire, { rang: 2, nom: fiole, quantite: 1, ressource_id: potion.ressource_id }] };
  assert.equal(quantiteMaxDeLEmplacement(regles, f, 1), 3);
  r = changerLaQuantiteDeCeinture(regles, f, 1, 3);
  assert.equal(r.ceinture[0].quantite, 3);
  assert.equal(dansLeSac(r, fiole), 0);
  // plusieurs lignes : prises de la dernière à la première, rendues sur la première qui reste
  f = fiche({ inventaire: sac([fiole, 1], [materiel.nom, 1], [fiole, 1], [fiole, 2]) });
  r = mettreALaCeinture(regles, f, 1, fiole);
  assert.equal(r.ceinture[0].quantite, 3);
  assert.deepEqual(r.inventaire.map((l) => [l.rang, l.nom, l.quantite]), [[1, fiole, 1], [2, materiel.nom, 1]]);
  r = changerLaQuantiteDeCeinture(regles, { ...f, ...r }, 1, 1);
  assert.deepEqual(r.inventaire.map((l) => [l.nom, l.quantite]), [[fiole, 3], [materiel.nom, 1]]);
  // une ligne à 0 (une saisie en cours, un import) n'est ni proposée ni comptée, et elle part quand l'objet sort du sac
  f = fiche({ inventaire: sac([fiole, 0], [materiel.nom, 1]) });
  assert.deepEqual(suggestionsDeCeinture(regles, f), []);
  assert.equal(dansLeSac(f, fiole), 0);
  r = mettreALaCeinture(regles, f, 1, fiole);
  assert.equal(r.ceinture[0].quantite, 1, 'posée sans être dans le sac : 1');
  assert.deepEqual(r.inventaire.map((l) => [l.nom, l.quantite]), [[materiel.nom, 1]]);
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
