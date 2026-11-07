// Décisions R198 à R208 du propriétaire (2026-11-07), appliquées aux TEXTES par la migration data/migrations/0104-r198-r208-textes-du-guide.sql
// (registre 0104-r198-r208-textes-du-guide.json, `textes` : une entrée par remplacement ; `mots_cles_crees`), puis par sa suite, la migration
// 0107-r198-r200-posture-et-mode-hyper.sql (R198 (6) dans le mot-clé posture, R200 (3) dans guide/la-magie-en-jeu ; même registre `textes`). Lecture
// seule de la base construite.
// Ces textes (corps des pages, définitions des mots-clés) sont modifiables sur le site de dev, source de ce qu'il modifie : ce que la 0104 a écrit se
// lit dans l'état de la migration (baseDImport({ garder: lotsAvant('0104') }), skill tests-conventions) ; aucun texte courant n'est figé.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cheminDePage } from '../src/lib/metiers.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';

const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0104-r198-r208-textes-du-guide.json', import.meta.url), 'utf8'));
const apresLa0104 = () => baseDImport({ garder: lotsAvant('0104') });
const registre0107 = JSON.parse(readFileSync(new URL('../../data/migrations/0107-r198-r200-posture-et-mode-hyper.json', import.meta.url), 'utf8'));
const apresLa0107 = () => baseDImport({ garder: lotsAvant('0107') });
const valeur = (db, t) => db.prepare(`SELECT "${t.col}" AS v FROM "${t.table}" WHERE id = ?`).get(t.cle.id)?.v;

// Les copies de source ne se réécrivent pas (R198 à R200, « les copies de source restent ») ; seule exception, voulue par le propriétaire : « Prouesse »
// devient « Calme » dans la page copiée des compétences (R204).
const COPIES = ['guide/formule-des-degats', 'guide/attaque-et-defense', 'guide/les-attaques-d-opportunite', 'ressources/pieces-elementaires'];
const estUneCopie = (id) => COPIES.includes(id) || id.startsWith('lore/') || (id.startsWith('guide/fiche-') && id !== 'guide/fiche-competences');
// R205 (3) : les motifs de la 0103 (l'état écrit « Gelé » mot entier, ou « gelé N » avec un stade).
const ETAT_GELE = /(?<!\p{L})Gelé(?!\p{L})|(?<!\p{L})gelé(?= \d)/u;
const PAGES_TYPEES_DU_GEL = ['magies/magie-de-la-glace', 'magies/magie-de-la-necromancie', 'magies/magie-du-feu', 'magies/magie-du-sang',
  'magies/magie-du-vent', 'ressources/accessoires', 'ressources/maladie'];

test('0104 : le registre ne touche que des corps de pages et des définitions de mots-clés, jamais une copie de source (sauf R204), chaque fois sous une décision', () => {
  assert.ok(registre.textes.length > 0);
  for (const t of registre.textes) {
    assert.ok((t.table === 'page' && t.col === 'corps_md') || (t.table === 'mot_cle' && t.col === 'description'), `${t.table}.${t.col}`);
    assert.match(t.decision, /^R(19[89]|20[0-8])\b/, t.cle.id);
    assert.notEqual(t.avant, t.apres, t.cle.id);
    if (t.table === 'page') assert.ok(!estUneCopie(t.cle.id), `${t.cle.id} : copie de source`);
  }
  const r204 = registre.textes.filter((t) => t.cle.id === 'guide/fiche-competences');
  assert.deepEqual(r204.map((t) => [t.decision, /Prouesse/.test(t.avant), /Prouesse/.test(t.apres), /Calme/.test(t.apres)]), [['R204', true, false, true]]);
});

test('0104 : chaque remplacement est en place dans l’état de la migration (le fragment écrit présent, l’ancien absent)', () => {
  const imp = apresLa0104();
  for (const t of registre.textes) {
    const v = valeur(imp, t);
    assert.equal(typeof v, 'string', `${t.cle.id} présent`);
    if (t.apres) assert.ok(v.includes(t.apres), `${t.cle.id} (${t.decision}) : « ${t.apres.slice(0, 60)}… »`);
    if (!t.apres.includes(t.avant)) assert.ok(!v.includes(t.avant), `${t.cle.id} (${t.decision}) : l’ancien fragment reste`);
  }
});

test('R199 (3) : plus aucune « attaque gratuite » dans les pages du guide ; le mot-clé attaque-gratuite garde son identifiant et renvoie à l’attaque d’opportunité, sans adresse', () => {
  const imp = apresLa0104();
  assert.deepEqual(imp.prepare("SELECT id FROM page WHERE id LIKE 'guide/%' AND corps_md LIKE '%attaque gratuite%'").all(), []);
  const m = imp.prepare("SELECT url, description FROM mot_cle WHERE id = 'attaque-gratuite'").get();
  assert.ok(m, 'identifiant figé : le mot-clé reste');
  // une seconde adresse vers la page des attaques d'opportunité rendrait ambigu un lien saisi vers elle (lib/mots-cles-liens.mjs#motsClesDeLAdresse)
  assert.equal(m.url, null);
  assert.match(m.description, /\{\{attaque-dopportunite(\|[^}]*)?\}\}/);
  // aucune balise ni étiquette ne l'employait
  assert.equal(imp.prepare("SELECT count(*) AS n FROM page_tag WHERE tag_id = 'attaque-gratuite'").get().n, 0);
  assert.equal(imp.prepare("SELECT count(*) AS n FROM page WHERE instr(corps_md, '{{attaque-gratuite') > 0").get().n, 0);
});

test('R205 (3) : les corps des pages typées n’écrivent plus l’état « Gelé » ; « Cerveau gelé » et les adjectifs restent', () => {
  const imp = apresLa0104();
  for (const id of PAGES_TYPEES_DU_GEL) {
    const corps = imp.prepare('SELECT corps_md FROM page WHERE id = ?').get(id)?.corps_md;
    assert.equal(typeof corps, 'string', id);
    assert.doesNotMatch(corps, ETAT_GELE, id);
    assert.ok(registre.textes.some((t) => t.cle.id === id && t.decision.startsWith('R205')), `${id} : dans le registre`);
  }
  const glace = imp.prepare("SELECT corps_md FROM page WHERE id = 'magies/magie-de-la-glace'").get().corps_md;
  assert.ok(glace.includes('Cerveau gelé'), 'le sort garde son nom');
});

test('R207 : les mots-clés maroquinier et armurier mènent à leur métier, comme forgeron et couturier (lib/metiers.mjs#cheminDePage)', () => {
  const imp = apresLa0104();
  assert.deepEqual(registre.mots_cles_crees.map((m) => m.id).sort(), ['armurier', 'maroquinier']);
  for (const { id, page } of [...registre.mots_cles_crees, { id: 'forgeron', page: 'metiers/forgeron' }, { id: 'couturier', page: 'metiers/couturier' }]) {
    const m = imp.prepare('SELECT url FROM mot_cle WHERE id = ?').get(id);
    assert.ok(m, id);
    assert.ok(imp.prepare('SELECT 1 FROM page WHERE id = ?').get(page), `${page} existe`);
    assert.equal(m.url, `/${cheminDePage(page)}`, id);
  }
  // R207 (9) : le « travailleur du cuir » est le Maroquinier, lié dans la page de l'équipement
  assert.ok(imp.prepare("SELECT corps_md FROM page WHERE id = 'guide/equipement-et-butin'").get().corps_md.includes('{{maroquinier|'));
});

test('0107 : la suite de la 0104 — le mot-clé posture (R198 (6)) et guide/la-magie-en-jeu (R200 (3)), en place dans l’état de la migration', () => {
  const imp = apresLa0107();
  assert.deepEqual(registre0107.textes.map((t) => [t.table, t.col, t.cle.id, t.decision.split(' ')[0]]),
    [['mot_cle', 'description', 'posture', 'R198'], ['page', 'corps_md', 'guide/la-magie-en-jeu', 'R200']]);
  for (const t of registre0107.textes) {
    assert.ok(!estUneCopie(t.cle.id), t.cle.id);
    const v = valeur(imp, t);
    assert.ok(typeof v === 'string' && v.includes(t.apres) && !v.includes(t.avant), `${t.cle.id} (${t.decision})`);
  }
  // R200 (3) : seul le moment de la consommation change ; la phrase du manque payé en santé (R186) n'est pas dans le remplacement
  for (const t of registre0107.textes) assert.doesNotMatch(`${t.avant} ${t.apres}`, /santé/, t.cle.id);
});
