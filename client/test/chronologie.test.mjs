// Chronologie (/chronologie/, docs/chronologie.md) : la logique pure de lib/chronologie.mjs (dates, ordre, voisins, adresses, couleurs du dégradé de
// la frise, date surlignée) et les tables `evenement` / `evenement_extrait` de la base, rejouées depuis le registre tools/chronologie/evenements.json sur les pages
// telles que l'import les a laissées (le site de dev peut réécrire une page du Codex ou d'une race : l'extrait, lui, reste celui de l'import).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adresseDEvenement, contraste, couleursDesEvenements, dateCourte, dateDansLeTexte, erreurDeDate, extraitsParPage, libelleDeDate, marquerLaDate, ordonner,
  operationsDesCategories, surlignerLaDate, voisins,
} from '../src/lib/chronologie.mjs';
import { chargerChronologie } from '../src/lib/chronologie-db.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { normalize } from '../src/lib/text.mjs';
import { lireRegistre, pagesDeLaBase, resoudre, sectionA } from '../../tools/chronologie/chronologie.mjs';

const ev = (rang, epoque, annee = null, extra = {}) => ({ id: `e${rang}`, rang, titre: `E${rang}`, epoque, annee, annee_fin: null, portee: null, lieu: null, ...extra });

test('libelleDeDate : « An N », « An N à M », ou le nom de l’époque hors des années', () => {
  assert.equal(libelleDeDate(ev(1, 'datee', 505)), 'An 505');
  assert.equal(libelleDeDate(ev(1, 'datee', -400, { annee_fin: -350 })), 'An -400 à -350');
  assert.equal(libelleDeDate(ev(1, 'datee', 0)), 'An 0');
  assert.equal(libelleDeDate(ev(1, 'debut')), 'Au début');
  assert.equal(libelleDeDate(ev(1, 'inconnue')), 'Date inconnue');
  assert.equal(libelleDeDate(ev(1, 'aujourdhui')), 'Aujourd’hui');
});

test('dateCourte : la colonne des dates de la frise, sans « An » ; le nom de l’époque hors des années', () => {
  assert.equal(dateCourte(ev(1, 'datee', 505)), '505');
  assert.equal(dateCourte(ev(1, 'datee', -400, { annee_fin: -350 })), '-400 à -350');
  assert.equal(dateCourte(ev(1, 'datee', 0)), '0');
  assert.equal(dateCourte(ev(1, 'debut')), 'Au début');
  assert.equal(dateCourte(ev(1, 'inconnue')), 'Date inconnue');
  assert.equal(dateCourte(ev(1, 'aujourdhui')), 'Aujourd’hui');
});

test('ordonner : par époque, puis année (datés), puis rang (l’ordre à date égale, plus forcément contigu : migration 0043) ; rangs uniques, une année pour les datés seulement', () => {
  const bons = [ev(1, 'debut'), ev(2, 'datee', -30), ev(3, 'datee', -30), ev(4, 'datee', 20), ev(5, 'inconnue'), ev(6, 'aujourdhui')];
  assert.deepEqual(ordonner([...bons].reverse()).map((e) => e.id), bons.map((e) => e.id));
  // un événement créé sur le site prend le plus grand rang + 1 : il vient après ceux de sa date, à sa place parmi les années ; un trou de rang est permis
  const cree = { ...ev(9, 'datee', -30), id: 'cree' };
  assert.deepEqual(ordonner([...bons, cree]).map((e) => e.id), ['e1', 'e2', 'e3', 'cree', 'e4', 'e5', 'e6']);
  assert.deepEqual(ordonner([ev(1, 'debut'), ev(3, 'datee', 1)]).map((e) => e.id), ['e1', 'e3']);
  // une date changée déplace l'événement sans renuméroter les autres
  assert.deepEqual(ordonner([ev(1, 'datee', 10), ev(2, 'debut')]).map((e) => e.id), ['e2', 'e1']);
  assert.deepEqual(ordonner([ev(1, 'datee', 10), ev(2, 'datee', 5)]).map((e) => e.id), ['e2', 'e1']);
  assert.throws(() => ordonner([ev(1, 'debut'), { ...ev(1, 'debut'), id: 'double' }]), /rang 1 invalide ou déjà pris/);
  assert.throws(() => ordonner([ev(0, 'debut')]), /rang 0 invalide/);
  assert.throws(() => ordonner([ev(1, 'debut', 3)]), /une année pour les événements datés/);
  assert.throws(() => ordonner([ev(1, 'datee')]), /une année pour les événements datés/);
  assert.throws(() => ordonner([ev(1, 'plus-tard')]), /époque inconnue/);
});

test('erreurDeDate et dateDansLeTexte (site de dev : la date d’un événement modifié, la date surlignée d’une description retouchée)', () => {
  assert.equal(erreurDeDate({ epoque: 'datee', annee: -112 }), null);
  assert.equal(erreurDeDate({ epoque: 'datee', annee: -400, annee_fin: -350 }), null);
  assert.match(erreurDeDate({ epoque: 'datee', annee: null }), /un événement daté a une année/);
  assert.match(erreurDeDate({ epoque: 'debut', annee: 3 }), /n’a pas d’année/);
  assert.match(erreurDeDate({ epoque: 'datee', annee: 5, annee_fin: 5 }), /vient après/);
  assert.match(erreurDeDate({ epoque: 'plus-tard' }), /époque inconnue/);
  assert.equal(dateDansLeTexte('* **Date de création :** \\-112', '\\-112'), '\\-112', 'telle quelle');
  assert.equal(dateDansLeTexte('* **Date de création :** -112', '\\-112'), '-112', 'l’éditeur en place a retiré l’échappement');
  assert.equal(dateDansLeTexte('Âge de fer (An 150)', '150\\)'), '150)');
  assert.equal(dateDansLeTexte('Plus de date.', '\\-112'), null);
  assert.equal(dateDansLeTexte('Texte.', null), null);
});

test('voisins et adresses : chaque événement à /chronologie/<id>/ (le premier aussi : /chronologie/ est la frise seule), chevrons grisés aux bords', () => {
  const liste = ordonner([ev(1, 'debut'), ev(2, 'datee', 1), ev(3, 'aujourdhui')]);
  assert.deepEqual(Object.values(voisins(liste, 'e1')).map((e) => e?.id ?? null), ['e1', null, 'e2']);
  assert.deepEqual(Object.values(voisins(liste, 'e3')).map((e) => e?.id ?? null), ['e3', 'e2', null]);
  assert.throws(() => voisins(liste, 'x'), /n'est pas un événement/);
  assert.equal(adresseDEvenement('e1'), 'chronologie/e1/');
  assert.equal(adresseDEvenement('e2'), 'chronologie/e2/');
});

test('contraste : le calcul WCAG (noir sur blanc 21:1, une couleur avec elle-même 1:1, symétrique)', () => {
  assert.equal(Math.round(contraste('#000000', '#ffffff')), 21);
  assert.equal(contraste('#8a3b12', '#8a3b12'), 1);
  assert.equal(contraste('#ffffff', '#5a6470'), contraste('#5a6470', '#ffffff'));
  assert.ok(Math.abs(contraste('#767676', '#ffffff') - 4.54) < 0.01, 'le gris #767676 : 4,54:1 sur blanc');
});

test('couleursDesEvenements : une couleur par événement, du violet au rouge dans l’ordre de lecture, gris pour « Date inconnue »', () => {
  const liste = ordonner([ev(1, 'debut'), ev(2, 'datee', -450), ev(3, 'datee', 20), ev(4, 'datee', 1160), ev(5, 'inconnue'), ev(6, 'aujourdhui')]);
  const couleurs = couleursDesEvenements(liste);
  assert.deepEqual([...couleurs.keys()].sort(), liste.map((e) => e.id).sort(), 'une couleur pour chaque événement');
  for (const c of couleurs.values()) assert.match(c, /^#[0-9a-f]{6}$/);
  // teinte de « #rrggbb » (degrés) : violet au début, rouge à la fin des événements datés
  const teinte = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  assert.ok(teinte(couleurs.get('e1')) > 260 && teinte(couleurs.get('e1')) < 300, `début violet (${couleurs.get('e1')})`);
  assert.ok(teinte(couleurs.get('e4')) < 20, `fin rouge (${couleurs.get('e4')})`);
  assert.ok(teinte(couleurs.get('e2')) > teinte(couleurs.get('e3')) && teinte(couleurs.get('e3')) > teinte(couleurs.get('e4')), 'la teinte tourne dans l’ordre de lecture');
  assert.equal(couleurs.get('e5'), '#5a6470');
  assert.notEqual(couleurs.get('e6'), couleurs.get('e5'));
});

test('couleurs de la frise : un texte blanc sur leur aplat se lit (4,5:1), pour chaque événement de la base ; deux voisins datés diffèrent', () => {
  const evenements = chargerChronologie(ouvrirBase({ sansExemples: false }));
  const couleurs = couleursDesEvenements(evenements);
  for (const e of evenements) {
    const c = couleurs.get(e.id);
    assert.ok(contraste(c, '#ffffff') >= 4.5, `${e.id} (${c}) : ${contraste(c, '#ffffff').toFixed(2)}:1`);
  }
  const datees = evenements.filter((e) => e.epoque === 'datee');
  datees.slice(1).forEach((e, i) => assert.notEqual(couleurs.get(e.id), couleurs.get(datees[i].id), `${datees[i].id} → ${e.id} : le dégradé avance`));
});

test('extraitsParPage : les passages qui se suivent sur une même page partagent une légende', () => {
  const x = (page_id) => ({ page_id, page_titre: page_id.toUpperCase() });
  assert.deepEqual(extraitsParPage([x('a'), x('a'), x('b'), x('a')]).map((g) => [g.page_id, g.extraits.length]), [['a', 2], ['b', 1], ['a', 1]]);
});

test('date surlignée : marquée dans le Markdown, devenue <mark> si elle reste d’un seul tenant, retirée sinon', () => {
  const md = marquerLaDate('C’est en l’an 14 qu’ils découvrent', 'en l’an 14');
  assert.equal(surlignerLaDate(`<p>${md}</p>`), '<p>C’est <mark class="chrono-surligne">en l’an 14</mark> qu’ils découvrent</p>');
  assert.equal(marquerLaDate('sans date', null), 'sans date');
  assert.equal(marquerLaDate('texte', 'absente'), 'texte');
  const coupee = surlignerLaDate(`<p>a${''}b <strong>c${''}d</strong></p>`);
  assert.equal(coupee, '<p>ab <strong>cd</strong></p>');
  assert.equal(surlignerLaDate('<p>rien</p>'), '<p>rien</p>');
  // la date dans un attribut (texte d'une image, titre d'un lien) : jamais de balise insérée là (elle sortirait de l'attribut), les marqueurs partent
  const [d, f] = [marquerLaDate('505', '505').at(0), marquerLaDate('505', '505').at(-1)];
  assert.equal(surlignerLaDate(`<p><img src="x" alt="${d}505${f} onerror=alert(1)"></p>`), '<p><img src="x" alt="505 onerror=alert(1)"></p>');
  assert.equal(surlignerLaDate(`<p><a title="x > ${d}505${f}">z</a></p>`), '<p><a title="x > 505">z</a></p>', 'un « > » dans un attribut n’ouvre pas le texte');
  assert.equal(surlignerLaDate(`<p><a title="x > y">z</a> En ${d}505${f}.</p>`), '<p><a title="x > y">z</a> En <mark class="chrono-surligne">505</mark>.</p>');
});

test('sectionA : le dernier titre Markdown avant le passage', () => {
  const corps = 'intro\n\n## Histoire\n\nTexte A.\n\n### Détail\n\nTexte B.\n';
  assert.equal(sectionA(corps, 0), null);
  assert.equal(sectionA(corps, corps.indexOf('Texte A')), 'Histoire');
  assert.equal(sectionA(corps, corps.indexOf('Texte B')), 'Détail');
});

test('resoudre : un extrait est le texte de la page de son début à sa fin ; erreurs nommées sinon', () => {
  const pages = new Map([
    ['lore/x', { titre: 'X', corps: '## Histoire\n\nEn l’an 12, il advint ceci. Puis cela.\n\nAutre chose.\n' }],
    ['races/y', { titre: 'Y', corps: 'Phrase. Phrase.\n', onglet: 'Ygrec' }],
  ]);
  const registre = (extraits, plus = {}) => ({ evenements: [{ id: 'un', titre: 'Un fait', epoque: 'datee', annee: 12, extraits, ...plus }] });
  const r = resoudre(registre([{ page: 'lore/x', debut: 'En l’an 12', fin: 'Puis cela.', date: 'En l’an 12' }]), pages);
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.extraits[0], {
    evenement_id: 'un', rang: 1, page_id: 'lore/x', section: 'Histoire', texte: 'En l’an 12, il advint ceci. Puis cela.', date_brut: 'En l’an 12',
    origine: 'chronologie', source_ref: 'CODEX Maverick › X › Histoire',
  });
  assert.equal(r.evenements[0].titre_cle, 'un-fait');
  assert.equal(r.evenements[0].source_ref, 'CODEX Maverick › X › Histoire');
  const erreurs = (extraits, plus) => resoudre(registre(extraits, plus), pages).erreurs.join('\n');
  assert.match(erreurs([{ page: 'races/y', debut: 'Phrase.' }]), /écrit plusieurs fois/);
  const seconde = resoudre({ evenements: [{ id: 'y', titre: 'Y', epoque: 'debut', extraits: [{ page: 'races/y', debut: 'Phrase.', occurrence: 2 }] }] }, pages);
  assert.deepEqual([seconde.erreurs, seconde.extraits[0].texte], [[], 'Phrase.'], 'occurrence : laquelle des deux');
  assert.match(erreurs([{ page: 'races/y', debut: 'Phrase.', occurrence: 3 }]), /écrit plusieurs fois/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'absent' }]), /début introuvable/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'En l’an 12', fin: 'jamais' }]), /fin introuvable/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'En l’an 12', date: 'an 13' }]), /absente de l'extrait/);
  assert.match(erreurs([{ page: 'lore/z', debut: 'x' }]), /page introuvable/);
  assert.match(erreurs([{ page: 'lore/x', debut: '' }]), /début vide ou absent/, 'un début vide ne fait pas boucler la recherche');
  assert.match(erreurs([{ page: 'lore/x' }]), /début vide ou absent/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'En l’an 12', fin: '' }]), /fin vide/);
  assert.match(erreurs([{ page: 'races/y', debut: 'Phrase.', occurrence: 0 }]), /occurrence invalide/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'Autre chose.' }], { epoque: 'debut' }), /une année pour les événements datés/);
  assert.match(erreurs([{ page: 'lore/x', debut: 'Autre chose.' }], { lieu: 'Erisia' }), /un lieu seulement/);
  assert.equal(resoudre({ evenements: [{ id: 'y', titre: 'Y', epoque: 'debut', extraits: [{ page: 'races/y', debut: 'Phrase. Phrase.' }] }] }, pages).extraits[0].source_ref, 'Les races › Ygrec');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// La base

const db = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(db);
const registre = lireRegistre();
const evenements = chargerChronologie(db);
const IMPACTS = 'lore/les-impacts-mineur-et-majeur';
// la chronologie telle que l'import l'a écrite (le site de dev la modifie depuis la migration 0043 : historique_modification), dans l'ordre de lecture,
// chaque événement avec ses extraits d'import
const extraitsDImport = historique.lignesDImport('evenement_extrait');
const evenementsDImport = ordonner(historique.lignesDImport('evenement').map((e) => ({
  ...e, extraits: extraitsDImport.filter((x) => x.evenement_id === e.id).sort((a, b) => a.rang - b.rang),
})));

/** Le site de dev a réécrit le texte de cette page (une page du Codex, ou l'onglet d'une race dont la page est tirée) : son extrait n'est plus comparable. */
const sourceRetouchee = (pageId) =>
  historique.touchee('page', { id: pageId }) || (pageId.startsWith('races/') && historique.touchee('race_onglet', { race_id: pageId }));

test('la base : le registre résolu sur les pages telles que l’import les a laissées redonne les lignes de la migration 0035', () => {
  // titre et texte de la page, onglet de la race : tels que l'import les a laissés (le site de dev peut les réécrire)
  const pages = pagesDeLaBase(db, registre, (id, p) => ({
    titre: historique.valeurDImport('page', { id }, 'titre', p.titre),
    corps_md: historique.valeurDImport('page', { id }, 'corps_md', p.corps_md),
    onglet: p.onglet === null ? null : historique.valeurDImport('race_onglet', { race_id: id }, 'onglet', p.onglet),
  }));
  const resolu = resoudre(registre, pages);
  assert.deepEqual(resolu.erreurs.filter((e) => ![...pages.keys()].some((id) => sourceRetouchee(id) && e.includes(`(${id})`))), []);
  const sansNull = (l) => ({ ...l });
  const parRang = (a, b) => a.rang - b.rang;
  assert.deepEqual(historique.lignesDImport('evenement').map(sansNull).sort(parRang), resolu.evenements);
  const cle = (x) => `${x.evenement_id}#${x.rang}`;
  const garder = (x) => !sourceRetouchee(x.page_id);
  assert.deepEqual(
    historique.lignesDImport('evenement_extrait').map(sansNull).filter(garder).sort((a, b) => cle(a).localeCompare(cle(b))),
    resolu.extraits.filter(garder).sort((a, b) => cle(a).localeCompare(cle(b))),
  );
});

test('la base : les événements se lisent dans l’ordre (époques, puis années croissantes), chacun avec au moins une description ; à l’import, de « Au début » à « Aujourd’hui »', () => {
  assert.ok(evenements.length > 0);
  const rang = (e) => ['debut', 'datee', 'inconnue', 'aujourdhui'].indexOf(e.epoque);
  evenements.forEach((e, i) => {
    const avant = evenements[i - 1];
    if (avant) assert.ok(rang(avant) < rang(e) || (rang(avant) === rang(e) && (avant.annee ?? 0) <= (e.annee ?? 0)), `${e.id} après ${avant.id}`);
    assert.ok(e.extraits.length > 0, `${e.id} : au moins une description (le service refuse de retirer la dernière)`);
    for (const x of e.extraits) {
      if (x.page_id) assert.ok(x.page_titre, `${e.id} : la page du lien existe`);
      if (x.date_brut !== null) assert.ok(x.texte.includes(x.date_brut), `${e.id} : date dans la description`);
    }
  });
  assert.equal(evenementsDImport[0].epoque, 'debut');
  assert.equal(evenementsDImport.at(-1).epoque, 'aujourdhui');
  assert.ok(evenementsDImport.every((e) => e.extraits.length > 0 && e.extraits.every((x) => x.page_id)), 'à l’import, chaque événement a un extrait, chaque extrait sa page');
});

test('la liste « Les Impacts mineur et majeur » du Codex est reprise en entier : un événement par ligne, titre, année, portée et lieu tels qu’écrits', () => {
  const corps = historique.valeurDImport('page', { id: IMPACTS }, 'corps_md');
  const lignes = [];
  let portee = null;
  for (const ligne of corps.split('\n')) {
    const titre = ligne.match(/^## Impact (majeur|mineur) :$/);
    if (titre) portee = titre[1];
    if (ligne.startsWith('- ')) lignes.push({ portee, texte: ligne.slice(2) });
  }
  assert.equal(lignes.length, 17, 'six impacts majeurs et onze mineurs');
  for (const { portee: p, texte } of lignes) {
    const m = texte.match(/^(.+?) \((An (-?\d+)\\|\?\?\?)\)(?: \(([^()]+)\))?$/);
    assert.ok(m, `ligne lisible : ${texte}`);
    const e = evenementsDImport.find((x) => x.extraits.some((y) => y.page_id === IMPACTS && y.texte === texte));
    assert.ok(e, `événement de la ligne « ${texte} »`);
    assert.equal(e.titre, m[1], 'titre tel qu’écrit');
    assert.equal(e.portee, p);
    assert.equal(e.lieu, m[4] ?? null);
    assert.equal(e.annee, m[3] === undefined ? null : Number(m[3]));
    assert.equal(e.epoque, m[3] === undefined ? 'inconnue' : 'datee');
  }
  assert.equal(evenementsDImport.filter((e) => e.portee).length, 17, 'aucune autre portée (à l’import : le site de dev peut en poser)');
});

test('le lieu d’un Impact mène à la page du Codex qui porte exactement son nom, sinon à rien', () => {
  const pagesDuCodex = db.prepare("SELECT id, titre_cle FROM page WHERE type = 'lore'").all();
  const avecLieu = evenements.filter((e) => e.lieu);
  assert.ok(avecLieu.length > 0);
  for (const e of avecLieu) assert.equal(e.lieu_page_id, pagesDuCodex.find((p) => p.titre_cle === normalize(e.lieu))?.id ?? null, `${e.id} : ${e.lieu}`);
  // à l'import, « Erisia » et « Mrode » sont des pages du Codex, « Ici et là » n'en est pas une
  const lieux = new Set(evenementsDImport.map((e) => e.lieu).filter(Boolean));
  assert.ok(lieux.has('Erisia') && lieux.has('Ici et là'));
  if (!historique.touchee('page', { id: 'lore/erisia' }, 'titre')) assert.ok(pagesDuCodex.some((p) => p.id === 'lore/erisia' && p.titre_cle === normalize('Erisia')));
  assert.ok(!pagesDuCodex.some((p) => p.titre_cle === normalize('Ici et là')));
});

test('Au début, Date inconnue, Aujourd’hui : l’ouverture et la fin de la frise viennent du Codex (« Au début … » : Origine du monde, Situation actuelle)', () => {
  // à l'import (le site de dev peut ajouter un événement « Au début » ou « Aujourd'hui »)
  assert.equal(evenementsDImport[0].id, 'origine-du-monde');
  assert.equal(evenementsDImport[0].extraits[0].page_id, 'lore/origine-du-monde');
  assert.equal(evenementsDImport.at(-1).extraits[0].page_id, 'lore/situation-actuelle');
  assert.ok(evenementsDImport.filter((e) => e.epoque === 'inconnue').every((e) => e.extraits[0].page_id === IMPACTS), 'Date inconnue : les « ??? » de la liste des Impacts');
});

test('gestion des catégories : suppressions, puis chaque renommage quand son nom est libre, puis créations ; noms vides, doublons et échanges refusés', () => {
  const ligne = (id, libelle, nom, supprimee = false) => ({ id, libelle, nom, supprimee });
  const ops = (lignes) => operationsDesCategories(lignes).map((o) => (o.op === 'creer' ? `+${o.valeurs.libelle}` : o.op === 'supprimer' ? `-${o.cle.id}` : `${o.cle.id}→${o.valeurs.libelle}`));
  // rien à faire
  assert.deepEqual(ops([ligne('a', 'A', 'A')]), []);
  // « B » prend le nom « C », puis « A » prend celui de « B » ; « D » supprimée, son nom repris par une création
  assert.deepEqual(ops([ligne('a', 'A', 'B'), ligne('b', 'B', 'C'), ligne('d', 'D', 'D', true), ligne(null, null, ' D ')]), ['-d', 'b→C', 'a→B', '+D']);
  // la casse seule change : son propre nom
  assert.deepEqual(ops([ligne('a', 'Guerre', 'GUERRE')]), ['a→GUERRE']);
  assert.throws(() => operationsDesCategories([ligne('a', 'A', 'B'), ligne('b', 'B', 'A')]), /échangent leurs noms/);
  assert.throws(() => operationsDesCategories([ligne('a', 'A', 'X'), ligne(null, null, 'x')]), /de la même façon/);
  assert.throws(() => operationsDesCategories([ligne(null, null, ' !! ')]), /lettre ou un chiffre/);
  assert.throws(() => operationsDesCategories([ligne(null, null, 'Sans catégorie')]), /aucune catégorie/);
  assert.throws(() => operationsDesCategories([ligne(null, null, 'Sans catégorie (à trier)')]), /aucune catégorie/, 'ni le libellé réservé');
  assert.deepEqual(ops([ligne(null, null, 'Sanscatégorie')]), ['+Sanscatégorie'], 'une autre écriture reste permise');
  // une catégorie supprimée ne tient plus son nom
  assert.deepEqual(ops([ligne('a', 'A', 'B'), ligne('b', 'B', 'B', true)]), ['-b', 'a→B']);
});
