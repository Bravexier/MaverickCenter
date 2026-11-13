// Le verrou des mots-clés et le gel de l'onglet Monnaie (décisions R218, R219, R220 ; migration 0110, `mot_cle.verrou`) :
//   - état d'import : verrou = 1 exactement pour les mots-clés à adresse, ceux des monnaies (ids de la table monnaie) et ceux dont le site se sert
//     (lib/mots-cles.mjs#MOTS_CLES_PROTEGES) présents (R219 (1), (2)) ;
//   - service et API v1 : un mot-clé verrouillé ne se supprime (même sans mention) ni ne se fusionne dans un autre (409, la raison cite R218 et
//     R219) ; ses champs, eux, se modifient (demande du propriétaire : « Seule leur suppression est bloquée. ») ; il se pose sur une page et s'en retire, se cite par une balise, reçoit la fusion d'un autre sans en prendre l'adresse
//     ni la couleur (R219 (4)) ; aucune route n'écrit `verrou` ; un mot-clé créé vaut 0, même avec une adresse (R219 (5)), sauf `race-hybride`, créé
//     verrouillé avec la première race hybride (R220 (2)), au rejeu aussi ; chaque race, magie et classe a son mot-clé verrouillé (R218) ;
//   - R222 (1) : la fusion d'un mot-clé que cite une balise de la définition d'un mot-clé verrouillé est refusée (le rejeu, lui, la fait) ;
//   - R221 : une page vers laquelle mène un mot-clé verrouillé ne se supprime pas, l'adresse du mot-clé reste ;
//   - page Mise à jour : un conflit sur une monnaie n'offre pas le choix 3 (une valeur saisie), refusé en 409 (R219 (6), R220 (1)) ; sur un mot-clé
//     verrouillé, il l'offre (ses champs se modifient) ;
//   - les monnaies : ni création, ni modification, ni suppression (409 qui cite R219), service et API v1 ; les lectures restent (R219 (3)) ;
//   - GET /api/edition/mots-cles/ : `verrou` et `mentions` de chaque mot-clé (R196 (2), la forme du 409 d'une suppression) ;
//   - rejeu : un lot ancien qui modifie ou supprime un mot-clé verrouillé passe (R219 (6)) ; un lot ancien qui crée, modifie (abréviation, remarque) ou
//     supprime une monnaie passe, un renommage de monnaie reste en conflit (R220 (1), R193).
// Aucun texte modifiable n'est figé : les lignes se choisissent par id ou par leur verrou, les essais créent leurs mots-clés sous des noms libres.
//   node --test test/serveur-edition-verrou.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { adaptateurDuJournal, COLONNES_FIGEES, enregistrer as enregistrerSansRoute, rejouerLeJournal } from '../serveur/edition.mjs';
import { examinerLeLot, resoudreLeConflit } from '../serveur/edition-conflits.mjs';
import { chargerJournal, nouveauLot } from '../serveur/edition-journal.mjs';
import { indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { ENTITES, MOT_CLE_RACE_HYBRIDE, TABLES, TABLES_FIGEES } from '../src/lib/edition-modele.mjs';
import { mentionsDe } from '../src/lib/mentions-des-mots-cles.mjs';
import { estVerrouille, MOTS_CLES_PROTEGES } from '../src/lib/mots-cles.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { IDS_DES_MOTS_CLES_PROTEGES as ID } from '../src/lib/mots-cles-proteges.mjs';
import { raisonsDeProtection } from '../src/lib/pages-protegees.mjs';
import { TAG_RACE_HYBRIDE } from '../src/lib/race-kinds.mjs';
import { normalize } from '../src/lib/text.mjs';
import { baseDImport, cheminDImport } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';
import { horsDeLa0119, MOTS_CLES_DE_LA_0119 } from './aide-races-0119.mjs';

const POSTERIEURS = new Set(Object.values(MOTS_CLES_DE_LA_0119));

const dossier = dossierTemporaire('edition-verrou');
let n = 0;
/** Une base vivante neuve (règles de l'import, pages d'exemple comprises) et le service qui l'écrit. */
function nouvelle() {
  const db = ouvrirBaseVivante(preparerBaseVivante({ regles: cheminDImport(), dossier: join(dossier, `b${(n += 1)}`) }).chemin);
  const service = { base: () => db, etat: () => ({}), edition: true };
  const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
  const lot = (operations, page = 'regles/glossaire/') => appel('POST', '/api/edition/', { page, operations });
  const ligne = (sql, ...p) => {
    const l = db.prepare(sql).get(...p);
    return l ? { ...l } : undefined;
  };
  /** Un libellé qu'aucun mot-clé (clé, libellé, synonyme), aucune page ni aucun métier n'a. */
  const libre = (base) => {
    let t = `${base} ${process.pid}`;
    const prise = (x) => motsClesDeLaBase(db).some((m) => normalize(m.libelle) === x || m.cle === x || m.synonymes.some((y) => normalize(y) === x));
    for (let i = 2; prise(normalize(t)) || ligne('SELECT 1 FROM page WHERE titre_cle = ? OR id LIKE ?', normalize(t), `%/${normalize(t)}`); i += 1) t = `${base} ${process.pid} ${i}`;
    return t;
  };
  const creer = (valeurs) => ok(lot([{ op: 'creer', entite: 'mot_cle', valeurs: { ...valeurs, libelle: libre(valeurs.libelle) } }])).crees[0].id;
  /** La clé d'un mot-clé (migration 0113 : ce que citent les balises). */
  const cle = (id) => ligne('SELECT cle FROM mot_cle WHERE id = ?', id)?.cle;
  return { db, appel, lot, ligne, libre, creer, cle };
}
const ok = (r, statut = 200) => {
  assert.equal(r.statut, statut, JSON.stringify(r.corps));
  return r.corps;
};
const refuse = (r, motif, quoi) => {
  assert.equal(r.statut, 409, `${quoi} : ${JSON.stringify(r.corps)}`);
  assert.match(r.corps.erreur, motif, quoi);
};
const VERROU = /est verrouillé.*\(décisions R218, R219\)/;

/** Un mot-clé verrouillé d'essai, mentionné nulle part (le test le pose dans sa copie, comme une migration le ferait). */
function verrouilleDEssai(s) {
  const libelle = s.libre('Essai verrouillé');
  const id = s.ligne('SELECT max(id) + 1 AS n FROM mot_cle').n;
  s.db.prepare('INSERT INTO mot_cle (id, libelle, cle, description, verrou) VALUES (?, ?, ?, ?, 1)').run(id, libelle, normalize(libelle), 'Définition d’essai.');
  return id;
}

test('R219 (1), (2), état d’import : verrou = 1 exactement pour les mots-clés à adresse, ceux des monnaies et ceux dont le site se sert', () => {
  const db = baseDImport();
  try {
    const monnaies = new Set(db.prepare('SELECT id FROM monnaie').all().map((m) => m.id));
    // un mot-clé de monnaie : par sa monnaie (monnaie_id, migration 0113), jamais par son id
    const lus = db.prepare('SELECT id, url, verrou, monnaie_id FROM mot_cle').all();
    const attendu = (m) => (m.url !== null || monnaies.has(m.monnaie_id) || MOTS_CLES_PROTEGES.has(m.id) ? 1 : 0);
    // les mots-clés de race d'une migration postérieure (0119 : Fongoïde et Gémidien) sont libres, R219 (5) : épinglés par test/db-0119-races-fongoide-gemidien.test.mjs
    for (const m of lus) if (!POSTERIEURS.has(m.id)) assert.equal(m.verrou, attendu(m), m.id);
    // le nombre se lit (il n'est pas figé) : des verrouillés et des libres, chaque monnaie et chaque protégé présent
    const verrouilles = lus.filter((m) => m.verrou === 1).length;
    assert.ok(verrouilles > 0 && verrouilles < lus.length, `${verrouilles} sur ${lus.length}`);
    for (const id of monnaies) assert.equal(lus.find((m) => m.monnaie_id === id)?.verrou, 1, `monnaie ${id}`);
  } finally {
    db.close();
  }
});

test('R218 (4), état courant : chaque mot-clé dont le site se sert est verrouillé ; `verrou` n’est ni une colonne modifiable ni un champ de création', () => {
  const s = nouvelle();
  for (const id of MOTS_CLES_PROTEGES.keys()) {
    const m = s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', id);
    if (m) assert.equal(m.verrou, 1, id);
  }
  assert.ok(!('verrou' in TABLES.mot_cle.colonnes) && !('verrou' in ENTITES.mot_cle.champs));
  assert.equal(estVerrouille({ verrou: 1 }), true);
  assert.equal(estVerrouille({ verrou: 0 }), false);
  assert.equal(estVerrouille({}), false, 'une base d’avant la 0110');
  s.db.close();
});

test('R218, R219 : un mot-clé verrouillé — sa suppression (même sans mention) et sa fusion dans un autre : 409, rien n’est écrit ; ses champs se modifient (demande du propriétaire)', () => {
  const s = nouvelle();
  const id = verrouilleDEssai(s);
  assert.deepEqual(mentionsDe(s.db, id), [], 'mentionné nulle part');
  const autre = s.creer({ libelle: 'Essai cible' });
  // ses champs : acceptés (« Seule leur suppression est bloquée »), le verrou reste
  const libelle = s.libre('Essai renommé');
  ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { libelle, description: 'Autre.' } }]));
  ok(s.lot([{ op: 'synonymes_mot_cle', mot_cle: id, synonymes: [`ZQV${process.pid}`] }]));
  const apres = s.ligne('SELECT * FROM mot_cle WHERE id = ?', id);
  assert.equal(apres.libelle, libelle);
  assert.equal(apres.description, 'Autre.');
  assert.equal(apres.verrou, 1, 'toujours verrouillé');
  assert.deepEqual(s.db.prepare('SELECT libelle FROM mot_cle_synonyme WHERE mot_cle_id = ?').all(id).map((x) => x.libelle), [`ZQV${process.pid}`]);
  // `verrou` ne s'écrit par aucune route
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id }, valeurs: { verrou: 0 } }]).statut, 400);
  // sa suppression et sa fusion dans un autre : refusées
  refuse(s.lot([{ op: 'supprimer', entite: 'mot_cle', cle: { id } }]), VERROU, 'suppression');
  refuse(s.lot([{ op: 'fusionner_mots_cles', mot_cle: id, dans: autre }]), /est verrouillé : il ne se fusionne pas dans un autre.*R218, R219/, 'fusion depuis lui');
  assert.deepEqual(s.ligne('SELECT * FROM mot_cle WHERE id = ?', id), apres);
  assert.ok(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', autre));
  s.db.close();
});

test('R219 (4) : un autre mot-clé se fusionne dans un mot-clé verrouillé — pages et balises reportées, son adresse et sa couleur inchangées', () => {
  const s = nouvelle();
  const cible = verrouilleDEssai(s);
  const source = s.creer({ libelle: 'Essai source', url: '/races/', couleur: '#654321' });
  // la source sur une page et citée par un mot-clé libre (posés dans la copie) ; aucune définition verrouillée ne la cite (R222)
  const page = s.ligne("SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1").id;
  const ordre = s.ligne('SELECT coalesce(max(ordre), -1) + 1 AS o FROM page_tag WHERE page_id = ?', page).o;
  s.db.prepare('INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (?, ?, ?)').run(page, ordre, source);
  const temoin = s.creer({ libelle: 'Essai témoin', description: `Voir {{${s.cle(source)}|la source}}.` });
  const avant = s.ligne('SELECT * FROM mot_cle WHERE id = ?', cible);
  const r = ok(s.lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }]));
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', source), undefined, 'la source part');
  assert.equal(s.ligne('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?', page, ordre).tag_id, cible, 'la page porte la cible');
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir {{${s.cle(cible)}|la source}}.`);
  assert.deepEqual(s.ligne('SELECT * FROM mot_cle WHERE id = ?', cible), avant, 'ni adresse, ni couleur, ni libellé, ni définition repris');
  assert.match(s.ligne('SELECT resume FROM modification_lot WHERE id = ?', r.lot).resume, /verrouillé, n’en prend pas le lien ni la couleur/);
  s.db.close();
});

test('R222 (1) : la fusion d’un mot-clé que cite la définition d’un mot-clé verrouillé (celle de la cible comprise ; par sa clé, son écriture ou un synonyme) est refusée, rien n’est écrit (service et API v1) ; citée ailleurs ou sans balise, elle passe', () => {
  const s = nouvelle();
  const cible = verrouilleDEssai(s);
  const autre = verrouilleDEssai(s);
  const abreviation = `ZQS${process.pid}`;
  // une source sans synonyme (une source qui en a ne se fusionne pas dans un mot-clé verrouillé, réponse du propriétaire à R233 (11) : ce refus
  // passerait avant celui de R222), et, pour la citation par un synonyme, une source qui en a, fusionnée dans un mot-clé libre
  const source = s.creer({ libelle: 'Essai source citée' });
  const sourceSynonyme = s.creer({ libelle: 'Essai source à synonyme', synonymes: [abreviation] });
  const libre = s.creer({ libelle: 'Essai cible libre' });
  const ecriture = s.ligne('SELECT libelle FROM mot_cle WHERE id = ?', source).libelle;
  // citée aussi par une page et par la définition d'un mot-clé libre : ailleurs, la fusion recible (plus bas)
  const page = s.ligne("SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1").id;
  const ordre = s.ligne('SELECT coalesce(max(ordre), -1) + 1 AS o FROM page_tag WHERE page_id = ?', page).o;
  s.db.prepare('INSERT INTO page_tag (page_id, ordre, tag_id) VALUES (?, ?, ?)').run(page, ordre, source);
  const temoin = s.creer({ libelle: 'Essai témoin libre', description: `Voir {{${s.cle(source)}|la source}}.` });
  const etat = () => JSON.stringify([
    s.db.prepare('SELECT * FROM mot_cle WHERE id IN (?, ?, ?, ?, ?, ?) ORDER BY id').all(source, cible, autre, temoin, sourceSynonyme, libre),
    s.db.prepare('SELECT * FROM mot_cle_synonyme WHERE mot_cle_id IN (?, ?, ?) ORDER BY id').all(sourceSynonyme, libre, cible),
    s.db.prepare('SELECT * FROM page_tag WHERE page_id = ? ORDER BY ordre').all(page),
    s.ligne('SELECT count(*) AS n FROM modification_lot').n,
  ]);
  const definir = (id, texte) => s.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(texte, id);
  for (const [quoi, ou, texte, de, dans] of [
    ['par sa clé, dans un autre mot-clé verrouillé', autre, `Voir {{${s.cle(source)}|la source}}.`, source, cible],
    ['par son écriture, dans la cible', cible, `Voir {{${ecriture}}}.`, source, cible],
    ['par un synonyme, dans un autre mot-clé verrouillé', autre, `Voir {{${abreviation}}}.`, sourceSynonyme, libre],
  ]) {
    definir(ou, texte);
    const avant = etat();
    const r = s.lot([{ op: 'fusionner_mots_cles', mot_cle: de, dans }]);
    refuse(r, /ne se fusionne pas : la définition du mot-clé verrouillé .* le cite \(décision R222\)/, quoi);
    assert.deepEqual(r.corps.mots_cles_verrouilles.map((m) => m.id), [ou], quoi);
    refuse(s.appel('POST', `/api/v1/mots-cles/${encodeURIComponent(de)}/fusion/`, { dans }), /\(décision R222\)/, `${quoi}, API v1`);
    assert.equal(etat(), avant, `${quoi} : rien n’est écrit`);
    definir(ou, 'Définition d’essai.');
  }
  // les deux refus à la fois (une source à synonyme, citée par une définition verrouillée, vers une cible verrouillée) : 409, rien n'est écrit
  definir(autre, `Voir {{${abreviation}}}.`);
  const avantLesDeux = etat();
  const lesDeux = s.lot([{ op: 'fusionner_mots_cles', mot_cle: sourceSynonyme, dans: cible }]);
  assert.equal(lesDeux.statut, 409, JSON.stringify(lesDeux.corps));
  assert.equal(etat(), avantLesDeux, 'les deux refus : rien n’est écrit');
  definir(autre, 'Définition d’essai.');
  // deux définitions verrouillées : toutes deux nommées
  definir(cible, `Voir {{${s.cle(source)}}}.`);
  definir(autre, `Voir {{${s.cle(source)}}}.`);
  assert.deepEqual(s.lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }]).corps.mots_cles_verrouilles.map((m) => m.id).sort(), [autre, cible].sort());
  // un mot écrit sans balise n'est pas une citation : la fusion passe, et recible la page et la définition libre
  definir(cible, `Voir ${ecriture} (${abreviation}).`);
  definir(autre, 'Définition d’essai.');
  ok(s.lot([{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }]));
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', source), undefined, 'la source part');
  assert.equal(s.ligne('SELECT tag_id FROM page_tag WHERE page_id = ? AND ordre = ?', page, ordre).tag_id, cible);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir {{${s.cle(cible)}|la source}}.`);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', cible).description, `Voir ${ecriture} (${abreviation}).`, 'la définition verrouillée reste');
  s.db.close();
});

test('R219 (6), R222 : la fusion d’un lot ancien (`gel` faux, comme le rejeu) passe et recible aussi la définition verrouillée', () => {
  const s = nouvelle();
  const cible = verrouilleDEssai(s);
  const source = s.creer({ libelle: 'Essai source ancienne' });
  s.db.prepare('UPDATE mot_cle SET description = ? WHERE id = ?').run(`Voir {{${s.cle(source)}|la source}}.`, cible);
  enregistrerSansRoute(s.db, { page: 'regles/glossaire/', operations: [{ op: 'fusionner_mots_cles', mot_cle: source, dans: cible }] }, { gel: false });
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', source), undefined);
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', cible).description, `Voir {{${s.cle(cible)}|la source}}.`);
  s.db.close();
});

test('R221 : une page vers laquelle mène un mot-clé verrouillé (métier par son ancre, fiche de don, page des Règles) ne se supprime pas (409, service et API v1) ; l’adresse du mot-clé reste', () => {
  const s = nouvelle();
  const adresses = indexDesAdresses(s.db, { exemples: true });
  const verrouilles = s.db.prepare('SELECT id, url FROM mot_cle WHERE verrou = 1 AND url IS NOT NULL ORDER BY id').all()
    .map((m) => ({ ...m, page: pageDeLAdresse(adresses, m.url) })).filter((m) => m.page);
  const premier = (filtre) => verrouilles.find(filtre);
  const metier = premier((m) => m.url.includes('#') && s.ligne('SELECT 1 FROM metier WHERE id = ?', m.page));
  const don = premier((m) => s.ligne('SELECT 1 FROM capacite WHERE id = ?', m.page));
  const regle = premier((m) => s.ligne('SELECT 1 FROM regles_onglet_entree WHERE page_id = ?', m.page) && !raisonsDeProtection(s.db, m.page).length);
  for (const [quoi, cas, op, api] of [
    ['métier, adresse avec ancre', metier, (id) => ({ op: 'supprimer', entite: 'metier', cle: { id } }), (id) => `/api/v1/metiers/${encodeURIComponent(id)}/`],
    ['fiche de don', don, (id) => ({ op: 'supprimer', entite: 'capacite', cle: { id } }), null],
    ['page des Règles', regle, (id) => ({ op: 'supprimer', entite: 'page_des_regles', cle: { id } }), null],
  ]) {
    assert.ok(cas, `${quoi} : un mot-clé verrouillé y mène dans l’état d’import`);
    const r = s.lot([op(cas.page)]);
    refuse(r, /ne se supprime pas sur le site : le mot-clé verrouillé .* y mène \(décision R221\)/, quoi);
    assert.ok(r.corps.mots_cles_verrouilles.some((m) => m.id === cas.id), quoi);
    if (api) refuse(s.appel('DELETE', api(cas.page)), /\(décision R221\)/, `${quoi}, API v1`);
    assert.ok(s.ligne('SELECT 1 FROM page WHERE id = ?', cas.page), `${quoi} : la page reste`);
    assert.equal(s.ligne('SELECT url FROM mot_cle WHERE id = ?', cas.id).url, cas.url, `${quoi} : l’adresse du mot-clé reste`);
  }
  s.db.close();
});

test('R219 (4) : un mot-clé verrouillé se pose sur une page et s’en retire (page créée puis supprimée), se cite par une balise', () => {
  const s = nouvelle();
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', ID.metier).verrou, 1);
  const metier = ok(s.lot([{ op: 'creer', entite: 'metier', valeurs: { nom: s.libre('Métier verrou') } }], 'metiers/')).crees[0].id;
  assert.ok(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', metier, ID.metier), 'posé');
  ok(s.lot([{ op: 'supprimer', entite: 'metier', cle: { id: metier } }], 'metiers/'));
  assert.equal(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', metier, ID.metier), undefined, 'retiré');
  const cite = s.ligne('SELECT id FROM mot_cle WHERE verrou = 1 ORDER BY id LIMIT 1').id;
  const temoin = s.creer({ libelle: 'Essai qui cite' });
  ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: temoin }, valeurs: { description: `Voir {{${s.cle(cite)}|ceci}}.` } }]));
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', temoin).description, `Voir {{${s.cle(cite)}|ceci}}.`);
  s.db.close();
});

test('R218 (4), R219 (5) : aucune route n’écrit `verrou` ; un mot-clé créé vaut 0, même avec une adresse (service et API v1)', () => {
  const s = nouvelle();
  const avecAdresse = s.creer({ libelle: 'Essai avec adresse', url: '/races/' });
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', avecAdresse).verrou, 0);
  assert.equal(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: avecAdresse }, valeurs: { verrou: 1 } }]).statut, 400);
  assert.equal(s.lot([{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: s.libre('Essai créé verrouillé'), verrou: 1 } }]).statut, 400);
  const parLApi = ok(s.appel('POST', '/api/v1/mots-cles/', { libelle: s.libre('Essai API'), url: '/races/' }), 201);
  assert.equal(parLApi.element.verrou, 0);
  assert.equal(s.appel('PATCH', parLApi.adresse, { verrou: 1 }).statut, 400);
  assert.equal(s.appel('POST', '/api/v1/mots-cles/', { libelle: s.libre('Essai API verrouillé'), verrou: 1 }).statut, 400);
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', parLApi.element.id).verrou, 0);
  s.db.close();
});

test('R218, R219, API v1 : `verrou` se lit (liste, détail, catalogue en lecture seule) ; PATCH accepté (sauf `verrou`) ; DELETE et fusion depuis un mot-clé verrouillé : 409', () => {
  const s = nouvelle();
  const id = verrouilleDEssai(s);
  const adresse = `/api/v1/mots-cles/${encodeURIComponent(id)}/`;
  assert.equal(ok(s.appel('GET', adresse)).element.verrou, 1);
  assert.ok(ok(s.appel('GET', '/api/v1/mots-cles/?limite=5')).elements.every((e) => e.verrou === 0 || e.verrou === 1));
  const colonne = ok(s.appel('GET', '/api/v1/')).ressources.find((r) => r.cle === 'mots-cles').colonnes.find((c) => c.nom === 'verrou');
  assert.equal(colonne.modifiable, false);
  ok(s.appel('PATCH', adresse, { description: 'Autre.' }));
  assert.equal(s.ligne('SELECT description FROM mot_cle WHERE id = ?', id).description, 'Autre.');
  assert.equal(s.appel('PATCH', adresse, { verrou: 0 }).statut, 400, 'PATCH du verrou');
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', id).verrou, 1);
  refuse(s.appel('DELETE', adresse), VERROU, 'DELETE');
  const autre = s.creer({ libelle: 'Essai cible API' });
  refuse(s.appel('POST', `${adresse}fusion/`, { dans: autre }), /est verrouillé : il ne se fusionne pas/, 'fusion');
  assert.ok(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', id));
  s.db.close();
});

test('R220 (2) : la première race hybride crée le mot-clé « race hybride » verrouillé (noté au journal) ; ses champs se modifient, le verrou reste', () => {
  const s = nouvelle();
  // le site de dev a pu le créer déjà : la copie repart sans lui
  // le mot-clé « race hybride » n'a pas d'id fixe (lib/mots-cles-proteges.mjs) : il se reconnaît par sa clé
  s.db.prepare('DELETE FROM page_tag WHERE tag_id IN (SELECT id FROM mot_cle WHERE cle = ?)').run(TAG_RACE_HYBRIDE);
  s.db.prepare('DELETE FROM mot_cle WHERE cle = ?').run(TAG_RACE_HYBRIDE);
  const race = ok(s.lot([{ op: 'creer', entite: 'race', valeurs: { nom: s.libre('Lycan verrou'), nature: 'hybride' } }], 'races/')).crees[0].id;
  const m = s.ligne('SELECT * FROM mot_cle WHERE cle = ?', TAG_RACE_HYBRIDE);
  assert.ok(Number.isInteger(m?.id), 'créé, l’id suivant');
  assert.ok(s.ligne('SELECT 1 FROM page_tag WHERE page_id = ? AND tag_id = ?', race, m.id));
  assert.equal(m.verrou, 1);
  assert.equal(m.libelle, MOT_CLE_RACE_HYBRIDE);
  const note = s.ligne("SELECT apres FROM modification WHERE table_nom = 'mot_cle' AND operation = 'inserer' AND json_extract(cle, '$.id') = ?", m.id);
  assert.equal(JSON.parse(note.apres).verrou, 1, 'le rejeu le recrée verrouillé');
  ok(s.lot([{ op: 'modifier', table: 'mot_cle', cle: { id: m.id }, valeurs: { description: 'Autre.' } }]));
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE id = ?', m.id).verrou, 1);
  s.db.close();
});

test('R219 (3) : les monnaies — création, modification de toute colonne, suppression refusées (409, R219), service et API v1 ; les lectures restent', () => {
  const s = nouvelle();
  assert.ok(TABLES_FIGEES.monnaie);
  const avant = s.db.prepare('SELECT * FROM monnaie ORDER BY id').all();
  const [premiere] = avant;
  const R219 = /décision R219/;
  refuse(s.lot([{ op: 'creer', entite: 'monnaie', valeurs: { nom: s.libre('Ricken d’essai'), abreviation: `RE${process.pid}`, valeur_rf: 10 } }], 'ressources/composants/'), R219, 'création');
  refuse(s.lot([{ op: 'modifier', table: 'monnaie', cle: { id: premiere.id }, valeurs: { abreviation: `RX${process.pid}` } }], 'ressources/composants/'), R219, 'modification');
  refuse(s.lot([{ op: 'supprimer', entite: 'monnaie', cle: { id: premiere.id } }], 'ressources/composants/'), R219, 'suppression');
  const adresse = `/api/v1/monnaies/${encodeURIComponent(premiere.id)}/`;
  assert.equal(ok(s.appel('GET', adresse)).element.id, premiere.id);
  assert.equal(ok(s.appel('GET', '/api/v1/monnaies/')).total, avant.length);
  for (const corps of [{ abreviation: `RX${process.pid}` }, { nom: 'Autre' }, { valeur_rf: 3 }]) refuse(s.appel('PATCH', adresse, corps), R219, `PATCH ${JSON.stringify(corps)}`);
  refuse(s.appel('DELETE', adresse), R219, 'DELETE');
  refuse(s.appel('POST', '/api/v1/monnaies/', { nom: s.libre('Ricken d’essai'), abreviation: `RE${process.pid}`, valeur_rf: 10 }), R219, 'POST');
  assert.deepEqual(s.db.prepare('SELECT * FROM monnaie ORDER BY id').all(), avant, 'rien d’écrit');
  // le catalogue et la description le disent ; ni corps de création ni clé de modification d'exemple
  assert.match(ok(s.appel('GET', '/api/v1/')).ressources.find((r) => r.cle === 'monnaies').figee, R219);
  const spec = ok(s.appel('GET', '/api/v1/openapi.json'));
  const chemin = spec.paths['/v1/monnaies/'];
  assert.equal(chemin.post.requestBody.content['application/json'].example, undefined);
  assert.match(chemin.post.description, /Refusé \(409\)/);
  assert.ok(!spec.paths['/v1/monnaies/{cle}/'].patch.parameters.some((p) => p.name === 'cle' && p.example !== undefined));
  s.db.close();
});

test('GET /api/edition/mots-cles/ : `verrou` de chaque mot-clé (celui de la base) et `mentions` (R196, la forme du 409 d’une suppression ; [] sans mention)', () => {
  const s = nouvelle();
  const libre = s.creer({ libelle: 'Essai sans mention' });
  const v = ok(s.appel('GET', '/api/edition/mots-cles/')).motsCles;
  const verrous = new Map(s.db.prepare('SELECT id, verrou FROM mot_cle').all().map((m) => [m.id, m.verrou]));
  assert.equal(v.length, verrous.size);
  for (const m of v) {
    assert.equal(m.verrou, verrous.get(m.id), m.id);
    assert.ok(Array.isArray(m.mentions), m.id);
    assert.equal('protege' in m, false);
  }
  assert.deepEqual(v.find((m) => m.id === libre).mentions, []);
  // un mot-clé porté par des pages : ses mentions sont celles du 409 de suppression (lib/mentions-des-mots-cles.mjs#mentionsDe)
  const porte = v.find((m) => m.pages > 0);
  assert.deepEqual(porte.mentions, JSON.parse(JSON.stringify(mentionsDe(s.db, porte.id))));
  for (const x of porte.mentions) {
    assert.ok('libelle' in x && 'exemple' in x && 'page' in x, JSON.stringify(x));
    assert.ok(x.page === null || (typeof x.page.id === 'string' && 'titre' in x.page), JSON.stringify(x));
  }
  s.db.close();
});

test('R219 (6), R220 (1), rejeu : un lot ancien qui modifie ou supprime un mot-clé verrouillé passe ; qui crée, modifie (abréviation, remarque) ou supprime une monnaie passe ; un renommage de monnaie reste en conflit (R193)', () => {
  const s = nouvelle();
  const db = s.db;
  const verrouilles = db.prepare('SELECT * FROM mot_cle WHERE verrou = 1 AND id NOT IN (SELECT mot_cle_id FROM sort_mot_cle) ORDER BY id').all();
  const modifie = verrouilles[0];
  const supprime = verrouilles.find((m) => m.id !== modifie.id && !mentionsDe(db, m.id).length);
  assert.ok(modifie && supprime, 'deux mots-clés verrouillés, dont un mentionné nulle part');
  const ro = db.prepare("SELECT * FROM monnaie WHERE id = 'ro'").get();
  const pp = db.prepare("SELECT * FROM monnaie WHERE id = 'pp'").get();
  const creee = { id: `re${process.pid}`, nom: `Ricken d’essai ${process.pid}`, abreviation: `RE${process.pid}`, valeur_rf: 10, convertisseur_brut: `1 RE${process.pid} : 10 RF`,
    origine: 'composants', source_ref: 'Essai', remarque: null };
  const lots = [];
  const lotAncien = (resume, modifications) => {
    const l = nouveauLot();
    lots.push({ id: l.id, fait_le: l.instant, page_id: 'regles/glossaire', resume, modifications: modifications.map((m, i) => ({ rang: i + 1, ...m })) });
    return l.id;
  };
  const definition = `${modifie.description ?? ''} (essai du rejeu)`.trim();
  const passent = [
    lotAncien('Mot-clé verrouillé modifié', [{ table: 'mot_cle', cle: { id: modifie.id }, operation: 'modifier', avant: { description: modifie.description }, apres: { description: definition } }]),
    lotAncien('Mot-clé verrouillé supprimé', [{ table: 'mot_cle', cle: { id: supprime.id }, operation: 'supprimer', avant: { ...supprime }, apres: null }]),
    lotAncien('Monnaie créée', [{ table: 'monnaie', cle: { id: creee.id }, operation: 'inserer', avant: null, apres: creee }]),
    lotAncien('Monnaie modifiée', [{ table: 'monnaie', cle: { id: 'ro' }, operation: 'modifier', avant: { abreviation: ro.abreviation, remarque: ro.remarque }, apres: { abreviation: `RX${process.pid}`, remarque: 'Essai.' } }]),
    lotAncien('Monnaie supprimée', [{ table: 'monnaie', cle: { id: creee.id }, operation: 'supprimer', avant: creee, apres: null }]),
  ];
  const renomme = lotAncien('Monnaie renommée', [{ table: 'monnaie', cle: { id: 'pp' }, operation: 'modifier', avant: { nom: pp.nom }, apres: { nom: `${pp.nom} taillée` } }]);
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, { format: 'maverick-edition/1', lots });
  const bilan = rejouerLeJournal(db);
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  const etat = (lot) => db.prepare('SELECT etat, detail FROM modification WHERE lot_id = ?').get(lot);
  // rejoués (toujours en attente de livraison sur le site de dev), aucun en conflit
  for (const lot of passent) assert.notEqual(etat(lot).etat, 'conflit', `${lot} : ${etat(lot).detail}`);
  assert.equal(etat(renomme).etat, 'conflit');
  assert.ok(etat(renomme).detail.includes(COLONNES_FIGEES.monnaie.nom), etat(renomme).detail);
  assert.equal(bilan.conflits, 1);
  assert.equal(db.prepare('SELECT description FROM mot_cle WHERE id = ?').get(modifie.id).description, definition);
  assert.equal(db.prepare('SELECT 1 FROM mot_cle WHERE id = ?').get(supprime.id), undefined);
  assert.deepEqual({ ...db.prepare("SELECT abreviation, remarque FROM monnaie WHERE id = 'ro'").get() }, { abreviation: `RX${process.pid}`, remarque: 'Essai.' });
  assert.equal(db.prepare('SELECT 1 FROM monnaie WHERE id = ?').get(creee.id), undefined);
  assert.equal(db.prepare("SELECT nom FROM monnaie WHERE id = 'pp'").get().nom, pp.nom);
  // le verrou ne tient pas au rejeu, mais il reste en place après
  assert.equal(db.prepare('SELECT verrou FROM mot_cle WHERE id = ?').get(modifie.id).verrou, 1, 'après le rejeu');
  db.close();
});

test('un lot écrit comme avant le verrou (`gel` faux, réservé aux tests qui reproduisent un lot ancien) passe ; aucune route ne le donne', () => {
  const s = nouvelle();
  const id = verrouilleDEssai(s);
  // le corps d'une requête ne le porte pas : `gel` n'est pas une clé du lot (la suppression d'un verrouillé reste refusée)
  refuse(s.appel('POST', '/api/edition/', { page: 'regles/glossaire/', gel: false, operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id } }] }), VERROU, 'gel dans le corps');
  enregistrerSansRoute(s.db, { page: 'regles/glossaire/', operations: [{ op: 'supprimer', entite: 'mot_cle', cle: { id } }] }, { gel: false });
  assert.equal(s.ligne('SELECT 1 FROM mot_cle WHERE id = ?', id), undefined, 'supprimé : le lot ancien ne lit pas le verrou');
  s.db.close();
});

test('R218, R219 (1) : chaque race, magie et classe a son mot-clé (adresse « /<id>/ ») verrouillé — état d’import et état courant', () => {
  // une connexion à soi : le premier test ferme celle de baseDImport()
  const dImport = new DatabaseSync(cheminDImport(), { readOnly: true });
  const courante = new DatabaseSync(cheminBase({ sansExemples: false }), { readOnly: true });
  try {
    // les lignes de l'import (le site ne supprime ni race, ni magie, ni classe ; une créée depuis a un mot-clé libre : R219 (5))
    // les races d'une migration postérieure (0119) ont un mot-clé libre, R219 (5) : test/db-0119-races-fongoide-gemidien.test.mjs
    const lignes = ['race', 'magie', 'classe'].flatMap((t) => dImport.prepare(`SELECT id FROM "${t}" ORDER BY id`).all().map((l) => [t, l.id])).filter(([t, id]) => t !== 'race' || horsDeLa0119(id));
    assert.ok(lignes.length > 0);
    // les mots-clés se lisent à l'import, par l'adresse ; sur l'état courant, on les suit par leur id : un mot-clé créé depuis sur la même adresse
    // reste libre (R219 (5)), et un mot-clé verrouillé ne change ni d'adresse ni de verrou par le site
    const motsClesDImport = lignes.map(([table, id]) => [table, id, dImport.prepare('SELECT id, verrou FROM mot_cle WHERE url = ?').all(`/${id}/`)]);
    // une classe créée par la migration 0119 (Boxeur, Porte-étendard) n'a pas de mot-clé de nom : le lot n'en crée aucun (R219 (5)) ; s'il existe un jour, il est verrouillé
    const sansMotCle = new Set(Object.keys(JSON.parse(readFileSync(new URL('../../data/migrations/0119-classes-materiaux-d12.json', import.meta.url), 'utf8')).classes.nouvelles));
    for (const [table, id, motsCles] of motsClesDImport) {
      assert.ok(motsCles.length > 0 || (table === 'classe' && sansMotCle.has(id)), `import : ${table} ${id} sans mot-clé`);
      for (const m of motsCles) {
        assert.equal(m.verrou, 1, `import : ${table} ${id} → ${m.id}`);
        const courant = courante.prepare('SELECT verrou, url FROM mot_cle WHERE id = ?').get(m.id);
        assert.ok(courant, `courant : ${m.id} supprimé`);
        assert.equal(courant.verrou, 1, `courant : ${table} ${id} → ${m.id}`);
        assert.equal(courant.url, `/${id}/`, `courant : adresse de ${m.id}`);
      }
    }
  } finally {
    dImport.close();
    courante.close();
  }
});

test('R219 (6), R220 (1), page Mise à jour : un conflit sur une monnaie n’offre que les choix 1 et 2 (un choix 3 envoyé quand même : 409) ; sur un mot-clé verrouillé, le choix 3 aussi', () => {
  const s = nouvelle();
  const db = s.db;
  const m = db.prepare('SELECT * FROM mot_cle WHERE verrou = 1 ORDER BY id LIMIT 1').get();
  const ro = db.prepare("SELECT * FROM monnaie WHERE id = 'ro'").get();
  // un lot ancien dont l'« avant » n'est plus la valeur en place : ses deux modifications sont en conflit
  const l = nouveauLot();
  const lot = { id: l.id, fait_le: l.instant, page_id: 'regles/glossaire', resume: 'Lot ancien en conflit', modifications: [
    { rang: 1, table: 'mot_cle', cle: { id: m.id }, operation: 'modifier', avant: { description: `${m.description ?? ''} autrefois` }, apres: { description: `Essai ${process.pid}.` } },
    { rang: 2, table: 'monnaie', cle: { id: 'ro' }, operation: 'modifier', avant: { abreviation: `${ro.abreviation}X` }, apres: { abreviation: `RY${process.pid}` } },
  ] };
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  chargerJournal(db, { format: 'maverick-edition/1', lots: [lot] });
  rejouerLeJournal(db);
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  const d = examinerLeLot(db, l.id);
  assert.ok(d, 'le lot est en conflit');
  const champs = d.conflits.filter((c) => c.genre === 'champ');
  assert.deepEqual(champs.map((c) => c.table).sort(), ['monnaie', 'mot_cle']);
  const [cm] = champs.filter((c) => c.table === 'mot_cle');
  assert.ok(cm.choix_possibles.includes(3) && cm.refus_3 === undefined, 'mot-clé verrouillé : ses champs se modifient');
  for (const c of champs.filter((x) => x.table === 'monnaie')) {
    // le choix 1 reste, sauf si l'éditeur refuse la valeur du lot (l'abréviation du RF, du RO et de la PP : R61, `refus_1`) ; le 2 toujours
    assert.deepEqual(c.choix_possibles, c.refus_1 ? [2] : [1, 2], c.id);
    assert.equal(c.saisie, null, c.id);
    assert.match(c.refus_3, /décision R219/, c.id);
  }
  // le meilleur choix permis de chaque conflit, sauf `trois` : le 3 envoyé quand même
  const choix = (trois) => Object.fromEntries(champs.map((c) => [c.id, c.id === trois ? { choix: 3, valeur: 'Autre.' } : { choix: c.choix_possibles[0] }]));
  for (const c of champs.filter((x) => x.table === 'monnaie')) {
    assert.throws(() => resoudreLeConflit(db, { lot: l.id, empreinte: d.empreinte, choix: choix(c.id) }), (e) => e.statut === 409 && e.message.includes(c.refus_3), c.id);
  }
  assert.equal(db.prepare('SELECT description FROM mot_cle WHERE id = ?').get(m.id).description, m.description, 'rien d’écrit');
  // le choix 1 (la valeur du lot ancien) passe : le verrou ne vise pas le lot ancien
  resoudreLeConflit(db, { lot: l.id, empreinte: d.empreinte, choix: choix(null) });
  assert.equal(db.prepare('SELECT description FROM mot_cle WHERE id = ?').get(m.id).description, `Essai ${process.pid}.`);
  db.close();
});

test('R220 (2), rejeu : « race hybride » créé par un lot noté avant la 0110 (insertion sans `verrou`, ou mot-clé à créer d’un lot d’avant la 0043) l’est verrouillé ; ce seul id', () => {
  const s = nouvelle();
  const db = s.db;
  db.prepare('DELETE FROM page_tag WHERE tag_id IN (SELECT id FROM mot_cle WHERE cle = ?)').run(TAG_RACE_HYBRIDE);
  db.prepare('DELETE FROM mot_cle WHERE cle = ?').run(TAG_RACE_HYBRIDE);
  // le mot-clé à créer d'une étiquette d'avant la 0043 (sa colonne `libelle`)
  const page = s.ligne("SELECT id FROM page WHERE statut <> 'example' ORDER BY id LIMIT 1").id;
  const etiquette = { lot_id: 'lot-essai', rang: 1, table_nom: 'page_tag', operation: 'inserer', cle: JSON.stringify({ page_id: page, ordre: 999 }), avant: null,
    apres: JSON.stringify({ page_id: page, ordre: 999, tag_id: TAG_RACE_HYBRIDE, libelle: MOT_CLE_RACE_HYBRIDE }) };
  // l'ancien id texte devient l'id suivant (migration 0113 : ancienneEcritureDesIds), sa clé celle de son écriture
  const aCreer = adaptateurDuJournal(db)(etiquette).aCreer;
  assert.deepEqual(aCreer.map((c) => [Number.isInteger(c.valeurs.id), c.valeurs.cle, c.valeurs.verrou]), [[true, TAG_RACE_HYBRIDE, 1]]);
  // l'insertion notée avant la 0110 (sans `verrou`), rejouée ; un autre mot-clé inséré de même reste libre
  const libelle = s.libre('Essai inséré');
  const l = nouveauLot();
  chargerJournal(db, { format: 'maverick-edition/1', lots: [{ id: l.id, fait_le: l.instant, page_id: 'regles/glossaire', resume: 'Mots-clés créés', modifications: [
    { rang: 1, table: 'mot_cle', cle: { id: TAG_RACE_HYBRIDE }, operation: 'inserer', avant: null,
      apres: { id: TAG_RACE_HYBRIDE, libelle: MOT_CLE_RACE_HYBRIDE, libelle_cle: normalize(MOT_CLE_RACE_HYBRIDE), description: null } },
    { rang: 2, table: 'mot_cle', cle: { id: normalize(libelle) }, operation: 'inserer', avant: null,
      apres: { id: normalize(libelle), libelle, libelle_cle: normalize(libelle), description: 'Essai.' } },
  ] }] });
  db.exec('BEGIN');
  const bilan = rejouerLeJournal(db);
  db.exec('COMMIT');
  assert.equal(bilan.conflits, 0, JSON.stringify(bilan));
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE cle = ?', TAG_RACE_HYBRIDE).verrou, 1);
  assert.equal(s.ligne('SELECT verrou FROM mot_cle WHERE cle = ?', normalize(libelle)).verrou, 0);
  db.close();
});
