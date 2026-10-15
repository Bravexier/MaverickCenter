// Édition du bestiaire depuis le site de dev (serveur/edition-bestiaire.mjs ; demande du propriétaire : créer, modifier, supprimer un monstre) : une
// rubrique modifiée refait les valeurs typées de sa carte et ses tables de détail (lib/monstre-champs.mjs, comme l'extraction du doc), une échelle ses
// bornes, une catégorie son écriture, un lieu de rencontre les lieux de l'espèce ; une espèce et une carte se créent (identifiant tiré du nom une fois,
// jamais réutilisé ; rubriques de la carte : GABARIT_DE_CARTE) et se suppriment avec tout ce qui en vient ; le rejeu du journal redonne les mêmes
// tables ; POST /api/edition/bestiaire/ rend la ligne et la carte qu'une page construite avant n'a pas ; le portrait d'une carte ou d'une espèce
// (« de la même manière que dans la feuille de personnage ») garde son cadrage dans l'image, et ne sort en entier que par POST /api/edition/portrait/ ;
// les capacités (décisions R66 à R69) : une capacité commune se modifie pour toutes ses cartes, se crée, ne se supprime plus portée ; sur une carte, une
// capacité s'ajoute à la fin, se retire, change de préfixe (ep_min) ; une valeur propre à une carte se règle (valeurs_de_capacite), la valeur commune l'efface.
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
import { chargerMonstres, echellesDesCartes, magiesDesCibles, renvoisAuxDegatsMoyens } from '../src/lib/bestiaire-db.mjs';
import { htmlDeLigneMonstre, htmlDesCapacitesDeLaCarte } from '../src/lib/bestiaire-rendu.mjs';
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
  for (const t of ['monstre_groupe', 'monstre_espece', 'monstre', 'monstre_rubrique', 'monstre_espece_bloc', 'monstre_butin', 'monstre_capacite_commune', 'monstre_capacite',
    'monstre_capacite_valeur']) assert.ok(TABLES[t], t);
  assert.deepEqual(Object.fromEntries(CATEGORIES_DE_MONSTRE.map((c) => [c.valeur, c.libelle])), CATEGORIES);
  for (const e of ['monstre', 'monstre_espece', 'monstre_capacite_commune', 'monstre_capacite']) assert.equal(ENTITES[e].suppression, true, e);
  for (const r of ['monstre-rubrique', 'monstre-categorie', 'monstre-cellule', 'monstre-ep', 'monstre-lieux', 'monstre-variable', 'monstre-butin', 'monstre-echelle']) assert.ok(RENDUS[r], r);
  assert.equal(rendreChamp('monstre-rubrique', 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6', { rubrique: 'caracteristiques' }), htmlDeRubrique('caracteristiques', 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6'));
  assert.equal(rendreChamp('monstre-lieux', 'Marais, Forêt , '), 'Marais, Forêt');
  assert.equal(rendreChamp('monstre-ep', 'EP1 - 10'), '1 - 10');
  assert.match(rendreChamp('monstre-categorie', 'mini_boss', { categorie_brut: 'Mini boss' }), /class="bcat bcat--mini_boss" title="Mini boss">Mini-boss</);
});

test('rubrique modifiée : valeurs typées de la carte et tables de détail refaites depuis son texte, comme l’extraction', () => {
  const capacitesAvant = tous('SELECT * FROM monstre_capacite WHERE monstre_id = ? ORDER BY rang', carte.id);
  assert.ok(capacitesAvant.length > 0);
  const r = enregistrer(
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('attributs').rang }, valeurs: { texte: 'Santé : 999 Chakra : 12 Barrière : 3' } },
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('caracteristiques').rang }, valeurs: { texte: 'F : 1 / P : 2 / V : 3 / S : 4 / I : 5 / A : 6' } },
    { op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('defense').rang }, valeurs: { texte: '9 AP / 8 AM' } },
  );
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const m = un('SELECT * FROM monstre WHERE id = ?', carte.id);
  assert.deepEqual([m.sante, m.chakra, m.barriere, m.armure_physique, m.armure_magique], [999, 12, 3, 9, 8]);
  assert.deepEqual(tous('SELECT caracteristique_id, valeur FROM monstre_caracteristique WHERE monstre_id = ? ORDER BY rang', carte.id).map((c) => c.valeur), [1, 2, 3, 4, 5, 6]);
  // les capacités ne sont plus le texte d'une rubrique (décision R66) : modifier les autres rubriques ne les touche pas, la rubrique « Capacité(s) »
  // n'a pas de texte à modifier
  assert.deepEqual(tous('SELECT * FROM monstre_capacite WHERE monstre_id = ? ORDER BY rang', carte.id), capacitesAvant);
  const x = enregistrer({ op: 'modifier', table: 'monstre_rubrique', cle: { monstre_id: carte.id, rang: rubrique('capacites').rang }, valeurs: { texte: 'Première. Un effet.' } });
  assert.equal(x.statut, 400);
  assert.match(x.corps.erreur, /se modifient une à une/);
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

test('groupe d’espèces modifié (décision R64, « Ottar ») : nom et sa clé, description ; les lignes de ses espèces le suivent ; refus d’un nom vide', () => {
  const groupe = un('SELECT * FROM monstre_groupe ORDER BY id LIMIT 1');
  assert.ok(groupe, 'un groupe (Ottar)');
  const membres = tous('SELECT id FROM monstre_espece WHERE groupe_id = ? ORDER BY ordre', groupe.id).map((x) => x.id);
  assert.ok(membres.length > 1);
  // un nom absent de la base (CLAUDE.md : un test du service prend des noms absents)
  let nom = `${groupe.nom} essai`;
  for (let n = 2; un('SELECT 1 FROM monstre_groupe WHERE nom_cle = ?', normalize(nom)); n += 1) nom = `${groupe.nom} essai ${n}`;
  const r = enregistrer({ op: 'modifier', table: 'monstre_groupe', cle: { id: groupe.id }, valeurs: { nom, description: 'Texte\n\nsur deux paragraphes.' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.deepEqual({ ...un('SELECT nom, nom_cle, description FROM monstre_groupe WHERE id = ?', groupe.id) }, { nom, nom_cle: normalize(nom), description: 'Texte\n\nsur deux paragraphes.' });
  // l'appartenance et l'identifiant ne changent pas ; les lignes rendues (page, service) portent le nouveau nom dans la colonne Espèce, le tri et le filtre
  assert.deepEqual(tous('SELECT id FROM monstre_espece WHERE groupe_id = ? ORDER BY ordre', groupe.id).map((x) => x.id), membres);
  const lignes = chargerMonstres(db).lignes.filter((l) => membres.includes(l.espece.id));
  assert.ok(lignes.length >= membres.length);
  for (const l of lignes) {
    assert.deepEqual([l.tri.espece, l.facettes.espece], [nom, [normalize(nom)]], l.id);
    assert.match(htmlDeLigneMonstre(l, 0), new RegExp(`<td class="bligne__espece"[^>]*>${nom}</td>`), l.id);
  }
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_groupe', cle: { id: groupe.id }, valeurs: { nom: ' ' } }).statut, 400, 'un nom vide est refusé');
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_groupe', cle: { id: groupe.id }, valeurs: { nom: groupe.nom, description: groupe.description } }).statut, 200);
});

test('nouvelle espèce (décision R64) : rangée sous un groupe au choix ; une espèce au nom d’un groupe ne prend pas son identifiant', () => {
  const groupe = un('SELECT * FROM monstre_groupe ORDER BY id LIMIT 1');
  const avant = chargerMonstres(db).especes;
  // une espèce au nom du groupe : un autre identifiant, une espèce de plus, aucune ligne du groupe pour voisine
  const homonyme = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: groupe.nom, ep_brut: 'EP1' } });
  assert.equal(homonyme.statut, 200, JSON.stringify(homonyme.corps));
  const idHomonyme = homonyme.corps.crees[0].id;
  assert.notEqual(idHomonyme, groupe.id);
  assert.equal(chargerMonstres(db).especes, avant + 1);
  // un nouvel Ottar, rangé sous le groupe dès sa création
  let nom = `${groupe.nom} essai`;
  for (let n = 2; un('SELECT 1 FROM monstre_espece WHERE nom_cle = ?', normalize(nom)); n += 1) nom = `${groupe.nom} essai ${n}`;
  const r = enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom, ep_brut: 'EP1 - 10', groupe_id: groupe.id } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const cree = un('SELECT id, groupe_id FROM monstre_espece WHERE nom = ?', nom);
  assert.equal(cree.groupe_id, groupe.id);
  const ligne = chargerMonstres(db).lignes.find((l) => l.id === cree.id);
  assert.deepEqual([ligne.tri.espece, ligne.espece.groupe.id], [groupe.nom, groupe.id]);
  assert.equal(chargerMonstres(db).especes, avant + 1, 'le nouvel Ottar compte avec son groupe');
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre_espece', valeurs: { nom: `${nom} bis`, ep_brut: 'EP1', groupe_id: 'monstres/groupe-absent' } }).statut, 404);
  for (const id of [cree.id, idHomonyme]) assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_espece', cle: { id } }).statut, 200);
});

test('description de la créature (décision R65) : la carte reçoit la sienne, l’espèce garde la sienne ; vide = NULL', () => {
  const avantEspece = un('SELECT description FROM monstre_espece WHERE id = ?', carte.espece_id).description;
  assert.equal(un('SELECT description FROM monstre WHERE id = ?', carte.id).description, null, 'le doc n’en écrit aucune');
  const r = enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte.id }, valeurs: { description: 'Une créature à part.\n\nDeux paragraphes.' } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(un('SELECT description FROM monstre WHERE id = ?', carte.id).description, 'Une créature à part.\n\nDeux paragraphes.');
  assert.equal(un('SELECT description FROM monstre_espece WHERE id = ?', carte.espece_id).description, avantEspece);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre', cle: { id: carte.id }, valeurs: { description: '' } }).statut, 200);
  assert.equal(un('SELECT description FROM monstre WHERE id = ?', carte.id).description, null);
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
  for (const t of ['monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite', 'monstre_capacite_valeur', 'monstre_defense']) {
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
  assert.deepEqual(l.objetsDuButin, tous('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang'));
  assert.deepEqual(l.echellesDesCartes, echellesDesCartes(db));
  assert.deepEqual(l.magiesDesCibles, magiesDesCibles(db));
  assert.equal(rendreChamp('monstre-rubrique', 'Feu, Brûlure', { rubrique: 'vulnerabilite', monstre_id: 'x' }, l), htmlDeRubrique('vulnerabilite', 'Feu, Brûlure', { magiesDesCibles: l.magiesDesCibles }));
  assert.match(rendreChamp('monstre-butin', 'Fraise de feu x 1d2', {}, l), /data-bulle="bulle-butin-fraise"[^>]*>Fraise de feu<\/button> x 1d2$/);
  assert.deepEqual(l.renvoisAuxDegatsMoyens, renvoisAuxDegatsMoyens(db));
  const renvoi = l.renvoisAuxDegatsMoyens[0];
  assert.equal(rendreChamp('monstre-echelle', '1-10', { id: renvoi, categorie: 'boss' }, l), htmlDeLEchelle('1-10', 'boss', l.echellesDePuissance, true));
  const butin = un("SELECT texte FROM monstre_butin WHERE texte LIKE 'Gelée%' ORDER BY espece_id, rang LIMIT 1").texte;
  assert.equal(rendreChamp('monstre-butin', butin, {}, l), htmlDuButin(butin, l.objetsDuButin, l.magies.map((m) => m.nom)));
  assert.match(rendreChamp('monstre-butin', 'Minitaire de Foudre', {}, l), /data-bulle="bulle-butin-minitaire"[^>]*>Minitaire de Foudre<\/button>$/);
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

test('capacités communes (décisions R66, R69) : modifiées pour toutes leurs cartes, valeurs propres réglées, ajoutées et retirées d’une carte ; refus', () => {
  const html = (id) => appel('POST', '/api/edition/bestiaire/', { capacites: [id] }).corps.capacites[id];
  // une capacité à emplacement (« Minus », {10}) portée par plusieurs cartes, dont une à sa valeur propre
  const gabarit = un("SELECT * FROM monstre_capacite_commune WHERE description LIKE '%{%}%' AND (SELECT count(*) FROM monstre_capacite p WHERE p.capacite_commune_id = id) > 2 ORDER BY id LIMIT 1");
  assert.ok(gabarit, 'une capacité à emplacement');
  const porteurs = tous('SELECT * FROM monstre_capacite WHERE capacite_commune_id = ? ORDER BY monstre_id, rang', gabarit.id);
  const [p] = porteurs;
  const commune = Number(gabarit.description.match(/\{(\d+)\}/)[1]);
  // une valeur propre : écrite ; la valeur commune : effacée ; la réponse dit les deux
  let r = enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: p.rang, valeurs: { 1: commune + 7 } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(un('SELECT valeur FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? AND numero = 1', p.monstre_id, p.rang).valeur, commune + 7);
  assert.ok(html(p.monstre_id).includes(String(commune + 7)));
  r = enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: p.rang, valeurs: { 1: commune } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(un('SELECT count(*) AS n FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? AND numero = 1', p.monstre_id, p.rang).n, 0);
  for (const [valeurs, statut] of [[{ 9: 1 }, 400], [{ 1: -2 }, 400], [{ 1: 1.5 }, 400], [[], 400]]) {
    assert.equal(enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: p.rang, valeurs }).statut, statut, JSON.stringify(valeurs));
  }
  assert.equal(enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: 999, valeurs: { 1: 3 } }).statut, 404);

  // la description commune changée : toutes les cartes qui l'ont suivent ; une valeur propre égale à la nouvelle valeur commune n'est plus écrite
  assert.equal(enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: p.rang, valeurs: { 1: commune + 3 } }).statut, 200);
  const autre = porteurs.find((x) => x.monstre_id !== p.monstre_id && !un('SELECT 1 AS x FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ?', x.monstre_id, x.rang));
  const description = `${gabarit.description} Ajout du test {${commune + 3}}.`.replace(`{${commune}}`, `{${commune + 3}}`);
  r = enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description } });
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(un('SELECT count(*) AS n FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ?', p.monstre_id, p.rang).n, 0, 'devenue la valeur commune');
  for (const x of [p, autre]) assert.match(html(x.monstre_id), /Ajout du test \d+\./, x.monstre_id);
  // une description qui retire un emplacement emporte ses valeurs propres
  assert.equal(enregistrer({ op: 'valeurs_de_capacite', monstre_id: p.monstre_id, rang: p.rang, valeurs: { 2: 41 } }).statut, 200);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description: gabarit.description } }).statut, 200);
  assert.equal(un('SELECT count(*) AS n FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ? AND numero = 2', p.monstre_id, p.rang).n, 0);
  // un emplacement retiré au milieu : les valeurs propres des emplacements suivants les suivent (pas de glissement d'un emplacement à l'autre)
  const trois = nomLibre('Triple essai');
  r = enregistrer(
    { op: 'creer', entite: 'monstre_capacite_commune', valeurs: { nom: trois, description: 'Vise {10} cases, frappe {3} fois, dure {5} tours.' } },
    { op: 'creer', entite: 'monstre_capacite', valeurs: { monstre_id: p.monstre_id, capacite_commune_id: '@0' } },
  );
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const [tId, tPlace] = [r.corps.crees[0].id, JSON.parse(r.corps.crees[1].id)];
  assert.equal(enregistrer({ op: 'valeurs_de_capacite', ...tPlace, valeurs: { 2: 4, 3: 9 } }).statut, 200);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: tId }, valeurs: { description: 'Vise {10} cases, dure {5} tours.' } }).statut, 200);
  assert.deepEqual(tous('SELECT numero, valeur FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ?', tPlace.monstre_id, tPlace.rang), [{ numero: 2, valeur: 9 }]);
  assert.match(html(p.monstre_id), /Vise 10 cases, dure 9 tours\./);
  // la modification générique d'une valeur propre : jamais la valeur commune (la carte la suit sans ligne)
  r = enregistrer({ op: 'modifier', table: 'monstre_capacite_valeur', cle: { ...tPlace, numero: 2 }, valeurs: { valeur: 5 } });
  assert.equal(r.statut, 400);
  assert.match(r.corps.erreur, /valeur commune/);
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_capacite', cle: tPlace }).statut, 200);
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_capacite_commune', cle: { id: tId } }).statut, 200);
  // « Lanceur de sorts », seule capacité à liste de sorts (R66), ne se supprime pas
  const aListe = un('SELECT id FROM monstre_capacite_commune WHERE liste_de_sorts = 1 ORDER BY id LIMIT 1');
  r = enregistrer({ op: 'supprimer', entite: 'monstre_capacite_commune', cle: { id: aListe.id } });
  assert.equal(r.statut, 409);
  assert.match(r.corps.erreur, /liste de sorts/, 'refusée pour sa liste de sorts, pas seulement parce que des cartes la portent');
  for (const description of ['Accolade { seule.', 'Pas {x}.', '']) {
    assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description } }).statut, 400, description);
  }
  // une valeur commune au-delà de 2^53 ne s'écrirait plus telle quelle (« 1e+21 ») : refusée, comme une valeur propre ; 2^53 - 1 passe
  r = enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description: 'Malus de {9007199254740992}%.' } });
  assert.equal(r.statut, 400);
  assert.match(r.corps.erreur, /trop grand/);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description: 'Malus de {9007199254740991}%.' } }).statut, 200);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite_commune', cle: { id: gabarit.id }, valeurs: { description: gabarit.description } }).statut, 200);

  // une nouvelle capacité commune, ajoutée à une carte dans le même lot (« @0 »), à la fin de ses capacités ; identifiant tiré du nom, figé
  const nom = nomLibre('Souffle d’essai+');
  const rangAvant = un('SELECT max(rang) AS m FROM monstre_capacite WHERE monstre_id = ?', carte.id).m;
  r = enregistrer(
    { op: 'creer', entite: 'monstre_capacite_commune', valeurs: { nom, description: 'Souffle de {3} cases.' } },
    { op: 'creer', entite: 'monstre_capacite', valeurs: { monstre_id: carte.id, capacite_commune_id: '@0', prefixe: '[EP4]' } },
  );
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  const id = r.corps.crees[0].id;
  assert.equal(id, normalize(nom.replace(/\+/g, ' plus ')));
  const place = un('SELECT * FROM monstre_capacite WHERE monstre_id = ? AND capacite_commune_id = ?', carte.id, id);
  assert.deepEqual([place.rang, place.prefixe, place.ep_min, place.sorts], [rangAvant + 1, '[EP4]', 4, null]);
  assert.match(place.source_ref, /^Site de dev › édition du \d{4}-\d{2}-\d{2} › Capacité\(s\)$/);
  assert.match(html(carte.id), new RegExp(`data-eps="4 5 6 7 8 9 10" data-capacite="${id}" data-rang="${place.rang}">.*Souffle de 3 cases\\.`));
  // le même nom et la même description : refus ; le préfixe donne l'échelle ; une liste de sorts sur une capacité qui n'en a pas : refus
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre_capacite_commune', valeurs: { nom, description: 'Souffle de {3} cases.' } }).statut, 409);
  const cle = { monstre_id: carte.id, rang: place.rang };
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite', cle, valeurs: { prefixe: '(Neige) [EP7]' } }).statut, 200);
  assert.equal(un('SELECT ep_min FROM monstre_capacite WHERE monstre_id = ? AND rang = ?', carte.id, place.rang).ep_min, 7);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite', cle, valeurs: { prefixe: '[EP12]' } }).statut, 400);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite', cle, valeurs: { sorts: 'Boule de feu.' } }).statut, 400);
  const lanceur = un('SELECT * FROM monstre_capacite WHERE capacite_commune_id = ? ORDER BY monstre_id LIMIT 1', aListe.id);
  assert.equal(enregistrer({ op: 'modifier', table: 'monstre_capacite', cle: { monstre_id: lanceur.monstre_id, rang: lanceur.rang }, valeurs: { sorts: 'Éclair, Soin.' } }).statut, 200);
  assert.ok(html(lanceur.monstre_id).includes(' Éclair, Soin.</'), 'la liste de sorts suit la description');
  // une capacité commune encore portée ne se supprime pas (le refus nomme la carte) ; retirée de sa carte, si
  r = enregistrer({ op: 'supprimer', entite: 'monstre_capacite_commune', cle: { id } });
  assert.equal(r.statut, 409);
  assert.ok(r.corps.erreur.includes(un('SELECT nom FROM monstre WHERE id = ?', carte.id).nom), r.corps.erreur);
  assert.equal(enregistrer({ op: 'valeurs_de_capacite', ...cle, valeurs: { 1: 5 } }).statut, 200);
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_capacite', cle }).statut, 200);
  assert.equal(un('SELECT count(*) AS n FROM monstre_capacite_valeur WHERE monstre_id = ? AND rang = ?', carte.id, place.rang).n, 0, 'ses valeurs avec elle');
  assert.equal(enregistrer({ op: 'supprimer', entite: 'monstre_capacite_commune', cle: { id } }).statut, 200);
  // recréée : un autre identifiant ; ajoutée de nouveau à la carte : un rang jamais employé (le journal se souvient)
  r = enregistrer(
    { op: 'creer', entite: 'monstre_capacite_commune', valeurs: { nom, description: 'Autre souffle.' } },
    { op: 'creer', entite: 'monstre_capacite', valeurs: { monstre_id: carte.id, capacite_commune_id: '@0' } },
  );
  assert.equal(r.statut, 200, JSON.stringify(r.corps));
  assert.equal(r.corps.crees[0].id, `${id}-2`);
  assert.equal(JSON.parse(r.corps.crees[1].id).rang, place.rang + 1);
  assert.equal(enregistrer({ op: 'creer', entite: 'monstre_capacite', valeurs: { monstre_id: carte.id, capacite_commune_id: '@0' } }).statut, 400, '« @0 » sans création');
  // la liste du choix « Capacité » : deux capacités du même nom se distinguent par leur description
  const liste = appel('GET', '/api/edition/listes/').corps.capacitesDeMonstre;
  assert.equal(liste.length, un('SELECT count(*) AS n FROM monstre_capacite_commune').n);
  const memeNom = un('SELECT nom_cle FROM monstre_capacite_commune GROUP BY nom_cle HAVING count(*) > 1 ORDER BY nom_cle LIMIT 1').nom_cle;
  const homonymes = tous('SELECT id FROM monstre_capacite_commune WHERE nom_cle = ?', memeNom).map((c) => liste.find((x) => x.valeur === c.id));
  assert.ok(homonymes.length >= 2 && homonymes.every((c) => c.libelle.includes(' — ')), JSON.stringify(homonymes));
  // le bloc rendu par le service est celui de la page construite
  const l = chargerMonstres(db).lignes.find((x) => x.id === carte.id);
  assert.equal(html(carte.id), htmlDesCapacitesDeLaCarte(l));
  assert.equal(appel('POST', '/api/edition/bestiaire/', { capacites: 'x' }).statut, 400);
});

test('rejeu du journal sur les règles : les mêmes tables du bestiaire que la base vivante', () => {
  const tables = ['monstre_groupe', 'monstre_espece', 'monstre_espece_lieu', 'monstre', 'monstre_rubrique', 'monstre_caracteristique', 'monstre_attaque', 'monstre_capacite_commune',
    'monstre_capacite', 'monstre_capacite_valeur', 'monstre_defense'];
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
