// Chronologie (/chronologie/, docs/chronologie.md) : la logique pure de lib/chronologie.mjs (dates, ordre, voisins, adresses, périodes de la frise,
// date surlignée) et les tables `evenement` / `evenement_extrait` de la base, rejouées depuis le registre tools/chronologie/evenements.json sur les pages
// telles que l'import les a laissées (le site de dev peut réécrire une page du Codex ou d'une race : l'extrait, lui, reste celui de l'import).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adresseDEvenement, extraitsParPage, libelleDeDate, marquerLaDate, ordonner, periodesDeLaFrise, siecle, surlignerLaDate, voisins,
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

test('siecle : par centaines, vers le bas (l’an -450 est dans le siècle qui commence en -500)', () => {
  assert.deepEqual([-450, -400, -1, 0, 99, 100, 1138].map(siecle), [-500, -400, -100, 0, 0, 100, 1100]);
});

test('ordonner : rangs sans trou, époques dans l’ordre, années croissantes au sens large, une année pour les datés seulement', () => {
  const bons = [ev(1, 'debut'), ev(2, 'datee', -30), ev(3, 'datee', -30), ev(4, 'datee', 20), ev(5, 'inconnue'), ev(6, 'aujourdhui')];
  assert.deepEqual(ordonner([...bons].reverse()).map((e) => e.id), bons.map((e) => e.id));
  assert.throws(() => ordonner([ev(1, 'debut'), ev(3, 'datee', 1)]), /rang 2 attendu/);
  assert.throws(() => ordonner([ev(1, 'datee', 10), ev(2, 'debut')]), /vient après/);
  assert.throws(() => ordonner([ev(1, 'datee', 10), ev(2, 'datee', 5)]), /an 5\) vient après/);
  assert.throws(() => ordonner([ev(1, 'debut', 3)]), /une année pour les événements datés/);
  assert.throws(() => ordonner([ev(1, 'datee')]), /une année pour les événements datés/);
  assert.throws(() => ordonner([ev(1, 'plus-tard')]), /époque inconnue/);
});

test('voisins et adresses : le premier événement est l’accueil de /chronologie/, flèches grisées aux bords', () => {
  const liste = ordonner([ev(1, 'debut'), ev(2, 'datee', 1), ev(3, 'aujourdhui')]);
  assert.deepEqual(Object.values(voisins(liste, 'e1')).map((e) => e?.id ?? null), ['e1', null, 'e2']);
  assert.deepEqual(Object.values(voisins(liste, 'e3')).map((e) => e?.id ?? null), ['e3', 'e2', null]);
  assert.throws(() => voisins(liste, 'x'), /n'est pas un événement/);
  assert.equal(adresseDEvenement(liste, 'e1'), 'chronologie/');
  assert.equal(adresseDEvenement(liste, 'e2'), 'chronologie/e2/');
});

test('periodesDeLaFrise : une période par époque hors des années, un siècle par période datée, chacune sa couleur', () => {
  const liste = ordonner([ev(1, 'debut'), ev(2, 'datee', -450), ev(3, 'datee', -430), ev(4, 'datee', 20), ev(5, 'datee', 99), ev(6, 'datee', 150), ev(7, 'inconnue'), ev(8, 'aujourdhui')]);
  const periodes = periodesDeLaFrise(liste);
  assert.deepEqual(periodes.map((p) => [p.titre, p.evenements.map((e) => e.id).join(',')]), [
    ['Au début', 'e1'], ['-500', 'e2,e3'], ['0', 'e4,e5'], ['100', 'e6'], ['Date inconnue', 'e7'], ['Aujourd’hui', 'e8'],
  ]);
  assert.equal(periodes[1].description, 'De l’an -500 à l’an -401');
  assert.equal(new Set(periodes.map((p) => p.couleur)).size, periodes.length, 'une couleur par période');
  for (const p of periodes) assert.match(p.couleur, /^(#[0-9a-f]{6}|hsl\(\d+ \d+% \d+%\))$/);
});

/** Contraste WCAG d'une couleur de période (« #rrggbb » ou « hsl(h s% l%) ») avec le blanc. */
function contrasteAvecLeBlanc(couleur) {
  let rgb;
  const h = couleur.match(/^hsl\((\d+) (\d+)% (\d+)%\)$/);
  if (h) {
    const [t, s, l] = [Number(h[1]), Number(h[2]) / 100, Number(h[3]) / 100];
    const f = (n) => { const k = (n + t / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    rgb = [f(0), f(8), f(4)];
  } else rgb = [1, 3, 5].map((i) => parseInt(couleur.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return 1.05 / (L + 0.05);
}

test('couleurs des périodes : un texte blanc sur leur aplat se lit (4,5:1), sur toute la frise de la base', () => {
  assert.ok(contrasteAvecLeBlanc('#000000') > 20 && contrasteAvecLeBlanc('#ffffff') === 1, 'calcul du contraste');
  for (const p of periodesDeLaFrise(chargerChronologie(ouvrirBase({ sansExemples: false })))) {
    assert.ok(contrasteAvecLeBlanc(p.couleur) >= 4.5, `${p.titre} (${p.couleur}) : ${contrasteAvecLeBlanc(p.couleur).toFixed(2)}:1`);
  }
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

test('la base : les événements se lisent dans l’ordre (époques, puis années croissantes), chacun avec au moins un extrait', () => {
  assert.ok(evenements.length > 0);
  assert.equal(evenements[0].epoque, 'debut');
  assert.equal(evenements.at(-1).epoque, 'aujourdhui');
  for (const e of evenements) {
    assert.ok(e.extraits.length > 0, `${e.id} : au moins un extrait`);
    for (const x of e.extraits) {
      assert.ok(x.page_titre, `${e.id} : la page de l’extrait existe`);
      if (x.date_brut !== null) assert.ok(x.texte.includes(x.date_brut), `${e.id} : date dans l’extrait`);
    }
  }
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
    const e = evenements.find((x) => x.extraits.some((y) => y.page_id === IMPACTS && y.texte === texte));
    assert.ok(e, `événement de la ligne « ${texte} »`);
    assert.equal(e.titre, m[1], 'titre tel qu’écrit');
    assert.equal(e.portee, p);
    assert.equal(e.lieu, m[4] ?? null);
    assert.equal(e.annee, m[3] === undefined ? null : Number(m[3]));
    assert.equal(e.epoque, m[3] === undefined ? 'inconnue' : 'datee');
  }
  assert.equal(evenements.filter((e) => e.portee).length, 17, 'aucune autre portée');
});

test('le lieu d’un Impact mène à la page du Codex qui porte exactement son nom, sinon à rien', () => {
  const pagesDuCodex = db.prepare("SELECT id, titre_cle FROM page WHERE type = 'lore'").all();
  const avecLieu = evenements.filter((e) => e.lieu);
  assert.ok(avecLieu.length > 0);
  for (const e of avecLieu) assert.equal(e.lieu_page_id, pagesDuCodex.find((p) => p.titre_cle === normalize(e.lieu))?.id ?? null, `${e.id} : ${e.lieu}`);
  // à l'import, « Erisia » et « Mrode » sont des pages du Codex, « Ici et là » n'en est pas une
  if (!historique.touchee('page', { id: 'lore/erisia' }, 'titre')) assert.ok(avecLieu.some((e) => e.lieu === 'Erisia' && e.lieu_page_id === 'lore/erisia'));
  assert.ok(avecLieu.some((e) => e.lieu === 'Ici et là' && e.lieu_page_id === null));
});

test('Au début, Date inconnue, Aujourd’hui : l’ouverture et la fin de la frise viennent du Codex (« Au début … » : Origine du monde, Situation actuelle)', () => {
  assert.equal(evenements[0].id, 'origine-du-monde');
  assert.equal(evenements[0].extraits[0].page_id, 'lore/origine-du-monde');
  assert.equal(evenements.at(-1).extraits[0].page_id, 'lore/situation-actuelle');
  assert.ok(evenements.filter((e) => e.epoque === 'inconnue').every((e) => e.extraits[0].page_id === IMPACTS), 'Date inconnue : les « ??? » de la liste des Impacts');
});
