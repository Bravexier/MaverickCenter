// Édition du bestiaire depuis le site de dev (serveur/edition-bestiaire.mjs ; demande du propriétaire : créer, modifier, supprimer un monstre) : une
// rubrique modifiée refait les valeurs typées de sa carte et ses tables de détail (lib/monstre-champs.mjs, comme l'extraction du doc), une échelle ses
// bornes, une catégorie son écriture, un lieu de rencontre les lieux de l'espèce ; une espèce et une carte se créent (identifiant tiré du nom une fois,
// jamais réutilisé ; rubriques de la carte : GABARIT_DE_CARTE) et se suppriment avec tout ce qui en vient ; le rejeu du journal redonne les mêmes
// tables ; POST /api/edition/bestiaire/ rend la ligne et la carte qu'une page construite avant n'a pas ; le portrait d'une carte ou d'une espèce
// (« de la même manière que dans la feuille de personnage ») garde son cadrage dans l'image, et ne sort en entier que par POST /api/edition/portrait/.
// Le test lit l'état avant d'écrire et crée des noms absents de la base (docs/serveur.md, « Mise à jour »).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { rejouerLeJournal } from '../serveur/edition.mjs';
import { chargerJournal, journalExporte } from '../serveur/edition-journal.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { CATEGORIES_DE_MONSTRE, ENTITES, journalSansImage, TABLES } from '../src/lib/edition-modele.mjs';
import { RENDUS, rendreChamp } from '../src/lib/edition-rendu.mjs';
import { CATEGORIES, GABARIT_DE_CARTE, RUBRIQUES, valeursDeLaCarte } from '../src/lib/monstre-champs.mjs';
import { htmlDeLEchelle, htmlDeRubrique, htmlDuButin } from '../src/lib/monstre-rendu.mjs';
import { renvoisAuxDegatsMoyens } from '../src/lib/bestiaire-db.mjs';
import { comparerBases } from '../src/lib/notes-de-version.mjs';
import { empreinte, PORTRAIT_MAX, resumeDuPortrait } from '../src/lib/portrait.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireTables } from '../serveur/notes-de-version.mjs';

const racine = mkdtempSync(join(tmpdir(), 'maverick-edition-bestiaire-'));
after(() => rmSync(racine, { recursive: true, force: true }));
const REGLES = cheminBase({ sansExemples: false });
let n = 0;
const baseNeuve = () => ouvrirBaseVivante(preparerBaseVivante({ regles: REGLES, dossier: join(racine, `b${(n += 1)}`) }).chemin);
const db = baseNeuve();
const service = { base: () => db, etat: () => ({}), edition: true };
const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps && JSON.stringify(corps) }, service);
const enregistrer = (...operations) => appel('POST', '/api/edition/', { page: 'bestiaire/', operations });
const un = (sql, ...p) => db.prepare(sql).get(...p);
const tous = (sql, ...p) => db.prepare(sql).all(...p).map((l) => ({ ...l }));
const nomLibre = (base) => `${base} ${process.pid} ${(n += 1)}`;

// une carte dont la ligne « Santé : … Chakra : … Barrière : … » est typée, et ses rubriques
const carte = un('SELECT * FROM monstre WHERE sante IS NOT NULL AND armure_physique IS NOT NULL ORDER BY espece_id, rang LIMIT 1');
const rubrique = (cle) => un('SELECT * FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = ? ORDER BY rang LIMIT 1', carte.id, cle);

test('modèle : tables et entités du bestiaire, catégories de lib/monstre-champs.mjs, rendus des champs', () => {
  for (const t of ['monstre_espece', 'monstre', 'monstre_rubrique', 'monstre_espece_bloc', 'monstre_butin']) assert.ok(TABLES[t], t);
  assert.deepEqual(Object.fromEntries(CATEGORIES_DE_MONSTRE.map((c) => [c.valeur, c.libelle])), CATEGORIES);
  assert.equal(ENTITES.monstre.suppression, true);
  assert.equal(ENTITES.monstre_espece.suppression, true);
  for (const r of ['monstre-rubrique', 'monstre-categorie', 'monstre-cellule', 'monstre-ep', 'monstre-lieux', 'monstre-variable', 'monstre-butin', 'monstre-echelle']) assert.ok(RENDUS[r], r);
  assert.equal(rendreChamp('monstre-rubrique', 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6', { rubrique: 'caracteristiques' }), htmlDeRubrique('caracteristiques', 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6'));
  assert.equal(rendreChamp('monstre-lieux', 'Marais, Forêt , '), 'Marais, Forêt');
  assert.equal(rendreChamp('monstre-ep', 'EP1 - 10'), '1 - 10');
  assert.match(rendreChamp('monstre-categorie', 'mini_boss', { categorie_brut: 'Mini boss' }), /class="bcat bcat--mini_boss" title="Mini boss">Mini-boss</);
});

test('rubrique modifiée : valeurs typées de la carte et tables de détail refaites depuis son texte, comme l’extraction', () => {
  const r = enregistrer(
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('attributs').rang }, valeurs: { texte: 'Santé : 999 Chakra : 12 Barrière : 3' } },
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('caracteristiques').rang }, valeurs: { texte: 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6' } },
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('defense').rang }, valeurs: { texte: '9 AP / 8 AM' } },
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('capacites').rang }, valeurs: { texte: 'Première. Un effet.\n\nSuite du premier.\n\n[EP3] Seconde. Autre effet.' } },
  );
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const m = un('SELECT * FROM monstre WHERE id = ?', carte.id);
  assert.deepEqual([m.sante, m.chakra, m.barriere, m.armure_physique, m.armure_magique], [999, 12, 3, 9, 8]);
  assert.deepEqual(tous('SELECT caracteristique_id, valeur FROM monstre_caracteristique WHERE monstre_id = ? ORDER BY rang', carte.id).map((c) => c.valeur), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(tous('SELECT prefixe, ep_min, nom, texte FROM monstre_capacite WHERE monstre_id = ? ORDER BY rang', carte.id), [
    { prefixe: null, ep_min: null, nom: 'Première', texte: 'Un effet.\n\nSuite du premier.' },
    { prefixe: '[EP3]', ep_min: 3, nom: 'Seconde', texte: 'Autre effet.' },
  ]);
  // la même lecture que l'extraction, sur toutes les rubriques de la carte
  const v = valeursDeLaCarte(tous('SELECT rubrique, texte FROM monstre_rubrique WHERE monstre_id = ? ORDER BY rang', carte.id));
  assert.deepEqual(tous('SELECT sens, rang, cible, cible_cle FROM monstre_defense WHERE monstre_id = ? ORDER BY sens, rang', carte.id),
    [...v.defenses].sort((a, b) => a.sens.localeCompare(b.sens) || a.rang - b.rang));
  // une ligne qui n'est plus lisible : les valeurs typées redeviennent NULL (le texte fait foi), les cases F.P.V.S.I.A. disparaissent
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('attributs').rang }, valeurs: { texte: 'EP 1 : 20\nEP 2 : 40' } }).statut, 200);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('caracteristiques').rang }, valeurs: { texte: '' } }).statut, 200);
  const apres = un('SELECT sante, chakra, barriere FROM monstre WHERE id = ?', carte.id);
  assert.deepEqual({ ...apres }, { sante: null, chakra: null, barriere: null });
  assert.equal(un('SELECT count(*) AS n FROM monstre_caracteristique WHERE monstre_id = ?', carte.id).n, 0);
  assert.equal(rubrique('caracteristiques').texte, '', 'une rubrique vidée reste, vide');
});

test('carte modifiée : nom et sa clé, échelle et ses bornes, catégorie et son écriture, phrase « varie selon l’échelle » ; refus', () => {
  const autre = Object.keys(CATEGORIES).find((c) => c !== carte.categorie);
  const r = enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte.id }, valeurs: { nom: 'Bête renommée', echelle_brut: '3-5', categorie: autre, variable: '1' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const m = un('SELECT * FROM monstre WHERE id = ?', carte.id);
  assert.deepEqual([m.nom, m.nom_cle, m.ep_min, m.ep_max, m.categorie, m.categorie_brut, m.variable], ['Bête renommée', 'bete-renommee', 3, 5, autre, CATEGORIES[autre], 1]);
  assert.equal(m.nom_brut, carte.nom_brut, 'l’écriture du doc reste comme trace');
  assert.equal(m.id, carte.id, 'l’identifiant ne change jamais');
  const refus = [
    [{ echelle_brut: '12' }, 400, /de 1 à 10/],
    [{ categorie: 'roi' }, 400, /hors de la liste/],
    [{ nom: '' }, 400, /obligatoire/],
    [{ nom_cle: 'x' }, 400, /ne se modifie pas ici/],
  ];
  for (const [valeurs, statut, motif] of refus) {
    const x = enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte.id }, valeurs });
    assert.equal(x.statut, statut, JSON.stringify(valeurs));
    assert.match(x.corps.erreur, motif);
  }
});

test('espèce modifiée : échelles, lieux de rencontre découpés aux virgules', () => {
  const espece = un('SELECT * FROM monstre_espece WHERE id = ?', carte.espece_id);
  const r = enregistrer({ op: 'modifier', table: 'monstre_espece', cle: { id: espece.id }, valeurs: { ep_brut: 'EP2 - 4', lieu_brut: 'Marais noir, Forêt, Grotte' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const e = un('SELECT * FROM monstre_espece WHERE id = ?', espece.id);
  assert.deepEqual([e.ep_min, e.ep_max], [2, 4]);
  assert.deepEqual(tous('SELECT rang, lieu, lieu_cle FROM monstre_espece_lieu WHERE espece_id = ? ORDER BY rang', espece.id), [
    { rang: 1, lieu: 'Marais noir', lieu_cle: 'marais-noir' },
    { rang: 2, lieu: 'Forêt', lieu_cle: 'foret' },
    { rang: 3, lieu: 'Grotte', lieu_cle: 'grotte' },
  ]);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_espece', cle: { id: espece.id }, valeurs: { lieu_brut: '' } }).statut, 200);
  assert.equal(un('SELECT count(*) AS n FROM monstre_espece_lieu WHERE espece_id = ?', espece.id).n, 0);
  assert.equal(un('SELECT lieu_brut FROM monstre_espece WHERE id = ?', espece.id).lieu_brut, null);
});

test('créer une espèce, puis un monstre dedans ; supprimer le monstre, puis l’espèce ; un identifiant ne resert jamais', () => {
  const nom = nomLibre('Gobelours');
  const ordre = un('SELECT max(ordre) AS m FROM monstre_espece').m;
  let r = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom, ep_brut: 'EP3', lieu_brut: 'Plaine, Colline' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const especeId = r.corps.crees[0].id;
  assert.equal(especeId, `monstres/${normalize(nom)}`);
  const espece = un('SELECT * FROM monstre_espece WHERE id = ?', especeId);
  assert.deepEqual([espece.ordre, espece.lettre, espece.ep_min, espece.ep_max, espece.origine], [ordre + 1, 'G', 3, 3, 'monstres']);
  assert.match(espece.source_ref, /^Site de dev › édition du \d{4}-\d{2}-\d{2}$/);
  assert.equal(un('SELECT count(*) AS n FROM monstre_espece_lieu WHERE espece_id = ?', especeId).n, 2);
  // le même nom : refusé
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom, ep_brut: 'EP1' } }).statut, 409);
  // l'espèce paraît dans la liste du formulaire « Nouveau monstre »
  assert.ok(appel('GET', '/api/edition/listes/').corps.especesDeMonstres.some((e) => e.valeur === especeId && e.libelle === nom));

  const nomCarte = nomLibre('Gobelours chef');
  r = enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: especeId, nom: nomCarte, echelle_brut: '3', categorie: 'boss', type_brut: 'Bête' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const monstreId = r.corps.crees[0].id;
  assert.equal(monstreId, `${especeId}#carte:${normalize(nomCarte)}`);
  const m = un('SELECT * FROM monstre WHERE id = ?', monstreId);
  assert.deepEqual([m.rang, m.nom, m.nom_brut, m.categorie, m.categorie_brut, m.ep_min, m.variable, m.sante], [1, nomCarte, nomCarte, 'boss', 'Boss', 3, 0, null]);
  assert.deepEqual(tous('SELECT rubrique, titre, texte FROM monstre_rubrique WHERE monstre_id = ? ORDER BY rang', monstreId),
    GABARIT_DE_CARTE.map((x) => ({ rubrique: x, titre: x === 'attributs' ? null : RUBRIQUES[x], texte: '' })));
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: especeId, nom: nomCarte, echelle_brut: '3', categorie: 'boss' } }).statut, 409);
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: 'monstres/absente', nom: 'X', echelle_brut: '3', categorie: 'boss' } }).statut, 404);
  // remplie, la carte a ses valeurs typées
  const attributs = un("SELECT rang FROM monstre_rubrique WHERE monstre_id = ? AND rubrique = 'attributs'", monstreId).rang;
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: monstreId, rang: attributs }, valeurs: { texte: 'Santé : 50 Chakra : 5 Barrière : 0' } }).statut, 200);
  assert.equal(un('SELECT sante FROM monstre WHERE id = ?', monstreId).sante, 50);

  // une espèce qui a encore une carte ne se supprime pas
  r = enregistrer({ op: 'supprimer', entite: 'monstre_espece', cle: { id: especeId } });
  assert.equal(r.statut, 409);
  assert.match(r.corps.erreur, /supprimez-les d’abord/);
  r = enregistrer({ op: 'supprimer', entite: 'monstre', cle: { id: monstreId } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  for (const t of ['monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite', 'monstre_defense']) {
    assert.equal(un(`SELECT count(*) AS n FROM ${t} WHERE monstre_id = ?`, monstreId).n, 0, t);
  }
  assert.equal(un('SELECT 1 AS x FROM monstre WHERE id = ?', monstreId), undefined);
  r = enregistrer({ op: 'supprimer', entite: 'monstre_espece', cle: { id: especeId } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(un('SELECT count(*) AS n FROM monstre_espece_lieu WHERE espece_id = ?', especeId).n, 0);
  assert.equal(un('SELECT 1 AS x FROM monstre_espece WHERE id = ?', especeId), undefined);
  // recréée sous le même nom : un nouvel identifiant (le journal se souvient de l'ancien)
  r = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom, ep_brut: 'EP3' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.crees[0].id, `monstres/${normalize(nom)}-2`);
});

test('curseur d’échelle et butin en infobulle : les listes du service (serveur/edition.mjs#listes) redonnent les rendus de la page ; une carte créée a son curseur', () => {
  const l = JSON.parse(JSON.stringify(appel('GET', '/api/edition/listes/').corps));
  assert.deepEqual(l.echellesDePuissance, tous('SELECT * FROM monstre_echelle ORDER BY ep'));
  assert.deepEqual(l.objetsDuButin, tous('SELECT id, nom FROM monstre_butin_objet ORDER BY rang'));
  assert.deepEqual(l.renvoisAuxDegatsMoyens, renvoisAuxDegatsMoyens(db));
  const renvoi = l.renvoisAuxDegatsMoyens[0];
  assert.equal(rendreChamp('monstre-echelle', '1-10', { id: renvoi, categorie: 'boss' }, l), htmlDeLEchelle('1-10', 'boss', l.echellesDePuissance, true));
  const butin = un("SELECT texte FROM monstre_butin WHERE texte LIKE 'Gelée%' ORDER BY espece_id, rang LIMIT 1").texte;
  assert.equal(rendreChamp('monstre-butin', butin, {}, l), htmlDuButin(butin, l.objetsDuButin));
  assert.match(rendreChamp('monstre-butin', butin, {}, l), /<button type="button" class="bobjet" data-bulle="bulle-butin-/);
  assert.equal(rendreChamp('monstre-echelle', '2-4', { categorie: 'boss' }, l), htmlDeLEchelle('2-4', 'boss', l.echellesDePuissance));
  assert.equal(rendreChamp('monstre-echelle', '2', { categorie: 'boss' }, l), '');

  const especeId = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: nomLibre('Crabe-tonnerre'), ep_brut: 'EP2 - 4' } }).corps.crees[0].id;
  const r = enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: especeId, nom: nomLibre('Crabe-tonnerre roi'), echelle_brut: '2-4', categorie: 'mini_boss' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  const connues = appel('POST', '/api/edition/bestiaire/', { connues: [], logo: '/logo.webp' }).corps.ordre.filter((x) => x !== id);
  const [ligne] = appel('POST', '/api/edition/bestiaire/', { connues, logo: '/logo.webp' }).corps.lignes;
  assert.equal(ligne.id, id);
  assert.match(ligne.carte, /<div class="bcarte__echelle" data-ed-lecture="[^"]+" data-ed-rendu="monstre-echelle"><div class="bechelle">/);
  assert.match(ligne.carte, /data-echelles="\[2,3,4\]"/);
  const xp = un('SELECT xp_mini_boss AS x FROM monstre_echelle WHERE ep = 3').x;
  assert.ok(ligne.carte.includes(`expérience reçue : ${xp}`));
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre', cle: { id } }).statut, 200);
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_espece', cle: { id: especeId } }).statut, 200);
});

test('POST /api/edition/bestiaire/ : l’ordre des lignes, et la ligne et la carte de celles que la page n’a pas', () => {
  const nom = nomLibre('Crapaud-lune');
  const r = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom, ep_brut: 'EP1' } });
  const id = r.corps.crees[0].id;
  const ordre = appel('POST', '/api/edition/bestiaire/', { connues: [], logo: '/x/logo.webp' });
  assert.equal(ordre.statut, 200);
  const connues = ordre.corps.ordre.filter((x) => x !== id);
  const rendu = appel('POST', '/api/edition/bestiaire/', { connues, logo: '/x/logo.webp' }).corps;
  assert.equal(rendu.ordre.at(-1), id, 'une espèce créée vient à la fin du doc');
  assert.deepEqual(rendu.lignes.map((l) => l.id), [id]);
  const [l] = rendu.lignes;
  assert.match(l.ligne, new RegExp(`^<tr class="bligne" id="${l.ancre}" data-ligne`));
  assert.match(l.ligne, /data-ed-nature="espece"/);
  assert.match(l.carte, new RegExp(`^<article class="bcarte" id="carte-${l.ancre}"`));
  assert.match(l.carte, /<img src="\/x\/logo\.webp"/);
  for (const corps of [{}, { connues: 'x' }, { connues: [1] }, { connues: [], logo: 3 }]) assert.equal(appel('POST', '/api/edition/bestiaire/', corps).statut, 400, JSON.stringify(corps));
});

test('portrait d’une carte et d’une espèce : l’image et son cadrage vont ensemble ; les réponses n’en donnent que l’empreinte ; notes et historique la résument', () => {
  const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
  // une espèce et une carte à ce test (le site de dev pose des portraits : on ne compte pas sur ceux qui manquent encore)
  const especeId = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: nomLibre('Portraitiste'), ep_brut: 'EP1' } }).corps.crees[0].id;
  const nom = nomLibre('Portraitiste de garde');
  const id = enregistrer({ op: 'creer', entite: 'monstre', valeurs: { espece_id: especeId, nom, echelle_brut: 'EP1', categorie: 'boss' } }).corps.crees[0].id;
  const cle = { id };
  const portraitDe = (table, i) => ({ ...un(`SELECT portrait, portrait_x, portrait_y, portrait_zoom FROM ${table} WHERE id = ?`, i) });
  const resume = (image) => ({ image: true, empreinte: empreinte(image), resume: resumeDuPortrait(image) });
  const recopie = (corps, image) => JSON.stringify(corps).includes(image.slice(40, 120));
  // une image sans cadrage : centrée, sans zoom ; la réponse ne la recopie pas
  let r = enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs: { portrait: IMAGES.webp }, avant: { portrait: null } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(portraitDe('monstre', id), { portrait: IMAGES.webp, portrait_x: 0.5, portrait_y: 0.5, portrait_zoom: 1 });
  assert.deepEqual(r.corps.lignes.find((l) => l.table === 'monstre').ligne.portrait, resume(IMAGES.webp));
  assert.ok(!recopie(r.corps, IMAGES.webp), 'la réponse d’un lot ne recopie pas l’image');
  // recadrer seul : le carré reste dans l'image (3 × 2 pixels, zoom 2 : un carré d'un pixel, x de 1/6 à 5/6, y de 1/4 à 3/4) ; « 0,1 » se lit 0.1
  const lu = { portrait: { empreinte: empreinte(IMAGES.webp) }, portrait_x: 0.5, portrait_y: 0.5, portrait_zoom: 1 };
  r = enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs: { portrait_x: 0.95, portrait_y: '0,1', portrait_zoom: 2 }, avant: lu });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual(portraitDe('monstre', id), { portrait: IMAGES.webp, portrait_x: 0.8333, portrait_y: 0.25, portrait_zoom: 2 });
  // conflit : un recadrage lu sur une autre image (ou un autre cadrage) est refusé, même sans toucher à l'image
  const autreImage = enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs: { portrait_zoom: 1 }, avant: { portrait: { empreinte: empreinte(IMAGES.png) } } });
  assert.equal(autreImage.statut, 409);
  assert.match(autreImage.corps.erreur, /modifié entre-temps.*portrait/);
  assert.deepEqual(autreImage.corps.ligne.portrait, resume(IMAGES.webp), 'le conflit dit l’image actuelle, résumée');
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs: { portrait_zoom: 1 }, avant: lu }).statut, 409, 'cadrage changé entre-temps');
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs: { portrait: null }, avant: { portrait: null } }).statut, 409, 'image posée entre-temps');
  assert.deepEqual(portraitDe('monstre', id), { portrait: IMAGES.webp, portrait_x: 0.8333, portrait_y: 0.25, portrait_zoom: 2 }, 'rien n’a changé');
  // lecture (mode modification), lignes en attente : l'empreinte ; l'image entière par POST /api/edition/portrait/
  const lues = appel('POST', '/api/edition/lignes/', { lignes: [{ table: 'monstre', cle }] });
  assert.deepEqual(lues.corps.lignes[0].ligne.portrait, resume(IMAGES.webp));
  const attente = appel('GET', '/api/edition/en-attente/');
  assert.deepEqual(attente.corps.lignes.find((l) => l.table === 'monstre' && l.cle.id === id).ligne.portrait, resume(IMAGES.webp));
  assert.ok(!recopie(attente.corps, IMAGES.webp) && !recopie(lues.corps, IMAGES.webp));
  assert.deepEqual(appel('POST', '/api/edition/portrait/', { table: 'monstre', cle }).corps,
    { table: 'monstre', cle, portrait: IMAGES.webp, portrait_x: 0.8333, portrait_y: 0.25, portrait_zoom: 2 });
  for (const corps of [{}, { table: 'sort', cle: { id: 'x' } }, { table: 'monstre', cle: 'x' }, { table: 'monstre', cle: ['x'] }]) {
    assert.equal(appel('POST', '/api/edition/portrait/', corps).statut, 400, JSON.stringify(corps));
  }
  assert.equal(appel('POST', '/api/edition/portrait/', { table: 'monstre', cle: { id: `${especeId}#carte:absente` } }).statut, 404);
  assert.equal(appel('GET', '/api/edition/portrait/').statut, 405);
  // refus : ce qui n'est pas une image que la page écrit (base64 incomplet, en-tête illisible), trop lourd, cadrage hors bornes ; jamais une erreur 500
  const entete = IMAGES.png.slice(0, IMAGES.png.length - (IMAGES.png.length % 4));
  for (const [valeurs, motif] of [
    [{ portrait: 'data:image/svg+xml;base64,PHN2Zz4=' }, /image attendue/],
    [{ portrait: 'https://exemple.fr/image.png' }, /image attendue/],
    [{ portrait: 'data:image/png;base64,AAAAA' }, /image attendue/],
    [{ portrait: `${entete}${'A'.repeat(100_001 - (entete.length % 4))}` }, /image attendue/],
    [{ portrait: `data:image/png;base64,${'AAAA'.repeat(100)}` }, /image attendue/],
    [{ portrait: `data:image/png;base64,${'A'.repeat(PORTRAIT_MAX)}` }, /trop lourde/],
    [{ portrait_zoom: 5 }, /au plus 4/],
    [{ portrait_x: 'gauche' }, /nombre attendu/],
  ]) {
    const refus = enregistrer({ op: 'modifier', table: 'monstre', cle, valeurs });
    assert.equal(refus.statut, 400, JSON.stringify(valeurs).slice(0, 60));
    assert.match(refus.corps.erreur, motif);
  }
  // le journal garde l'image (rapatriée dans data/rows : rejeu, test suivant) ; l'historique n'en garde que le résumé
  const notees = journalExporte(db).lots.flatMap((l) => l.modifications).filter((m) => m.table === 'monstre' && m.cle.id === id && typeof m.apres?.portrait === 'string');
  assert.equal(notees[0].apres.portrait, IMAGES.webp);
  assert.deepEqual(JSON.parse(journalSansImage('monstre', JSON.stringify(notees[0].apres))), { ...notees[0].apres, portrait: resumeDuPortrait(IMAGES.webp) });
  assert.equal(journalSansImage('monstre', JSON.stringify({ nom: 'x' })), JSON.stringify({ nom: 'x' }), 'sans image : tel quel');
  assert.equal(journalSansImage('sort', null), null);
  // la note de version : une ligne « Portrait » (empreinte, poids, cadrage), aucune pour le cadrage seul ; la carte, nouvelle, est dite ajoutée
  const production = baseNeuve();
  const note = comparerBases(lireTables(production), lireTables(db)).filter((l) => l.domaine === 'bestiaire' && /portrait|cadrage|zoom/i.test(l.champ ?? ''));
  production.close();
  assert.deepEqual(note, [], 'une carte absente de la production : dite ajoutée, ses champs ne sont pas listés');
  const avecPortrait = lireTables(db);
  const sansPortrait = structuredClone(avecPortrait);
  Object.assign(sansPortrait.tables.monstre.find((m) => m.id === id), { portrait: null, portrait_x: null, portrait_y: null, portrait_zoom: null });
  assert.deepEqual(comparerBases(sansPortrait, avecPortrait).filter((l) => l.domaine === 'bestiaire').map((l) => [l.entite, l.champ, l.nature, l.avant, l.apres]), [
    [nom, 'Portrait', 'ajoute', null, `${resumeDuPortrait(IMAGES.webp)}, cadrage 0.8333 × 0.25, zoom 2`],
  ]);
});

test('le portrait suit la tuile : la première carte d’une espèce prend le sien, l’espèce reprend celui de sa dernière carte supprimée', () => {
  const IMAGES = JSON.parse(readFileSync(new URL('./fixtures/portraits.json', import.meta.url), 'utf8'));
  const portraitDe = (table, i) => ({ ...un(`SELECT portrait, portrait_x, portrait_y, portrait_zoom FROM ${table} WHERE id = ?`, i) });
  const vide = { portrait: null, portrait_x: null, portrait_y: null, portrait_zoom: null };
  const especeId = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: nomLibre('Tuile'), ep_brut: 'EP2' } }).corps.crees[0].id;
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_espece', cle: { id: especeId }, valeurs: { portrait: IMAGES.png, portrait_zoom: 3 } }).statut, 200);
  // 3 × 2 pixels, zoom 3 : x de 1/9 à 8/9, y de 1/6 à 5/6
  assert.deepEqual(portraitDe('monstre_espece', especeId), { portrait: IMAGES.png, portrait_x: 0.5, portrait_y: 0.5, portrait_zoom: 3 });
  // POST /api/edition/bestiaire/ : la ligne de l'espèce, rendue avec le logo, dit son portrait (la page le charge à l'ouverture de la carte)
  const rendue = appel('POST', '/api/edition/bestiaire/', { connues: [], logo: '/logo.webp' }).corps.lignes.find((l) => l.id === especeId);
  assert.deepEqual(rendue.portrait, { empreinte: empreinte(IMAGES.png), x: 0.5, y: 0.5, zoom: 3 });
  assert.match(rendue.carte, /<figure class="bcarte__portrait" data-portrait="" data-vide/);
  const valeurs = (n) => ({ espece_id: especeId, nom: nomLibre(n), echelle_brut: 'EP2', categorie: 'ennemi_simple' });
  const premiere = enregistrer({ op: 'creer', entite: 'monstre', valeurs: valeurs('Première') }).corps.crees[0].id;
  assert.deepEqual(portraitDe('monstre', premiere), { portrait: IMAGES.png, portrait_x: 0.5, portrait_y: 0.5, portrait_zoom: 3 });
  assert.deepEqual(portraitDe('monstre_espece', especeId), vide);
  const seconde = enregistrer({ op: 'creer', entite: 'monstre', valeurs: valeurs('Seconde') }).corps.crees[0].id;
  assert.deepEqual(portraitDe('monstre', seconde), vide, 'seule la première carte prend le portrait de la tuile');
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre', cle: { id: premiere } }).statut, 200);
  assert.deepEqual(portraitDe('monstre_espece', especeId), vide, 'il reste une carte : l’espèce n’a pas de tuile');
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre', cle: { id: seconde }, valeurs: { portrait: IMAGES.webpAlpha } }).statut, 200);
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre', cle: { id: seconde } }).statut, 200);
  assert.deepEqual(portraitDe('monstre_espece', especeId), { portrait: IMAGES.webpAlpha, portrait_x: 0.5, portrait_y: 0.5, portrait_zoom: 1 });
});

test('rejeu du journal sur les règles : les mêmes tables du bestiaire que la base vivante', () => {
  const tables = ['monstre_espece', 'monstre_espece_lieu', 'monstre', 'monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite', 'monstre_defense'];
  const lire = (base) => Object.fromEntries(tables.map((t) => [t, base.prepare(`SELECT * FROM ${t} ORDER BY 1, 2, 3`).all().map((l) => JSON.stringify(l))]));
  const journal = journalExporte(db);
  const neuve = baseNeuve();
  neuve.exec('PRAGMA foreign_keys = OFF');
  neuve.exec('BEGIN');
  chargerJournal(neuve, journal);
  rejouerLeJournal(neuve, {});
  assert.deepEqual(neuve.prepare("SELECT DISTINCT detail FROM modification WHERE etat = 'conflit'").all(), []);
  neuve.exec('COMMIT');
  neuve.exec('PRAGMA foreign_keys = ON');
  assert.deepEqual(lire(neuve), lire(db));
  neuve.close();
});
