// Migration data/migrations/0123-fusion-pages-alignement.sql (demande du propriétaire du 2026-11-13) : « Les neuf alignements »
// (guide/les-neuf-alignements) est fondue dans « Alignement » (guide/alignement), sous l'intertitre à ancre figée #les-neuf-alignements, ses neuf
// sections descendues d'un niveau ; la page est retirée (alias, sources, entrée du menu) ; le mot-clé 192 mène à l'intertitre ; neuf mots-clés, un
// par alignement, mènent chacun à sa section, avec la couleur de l'alignement (lib/caracteristiques-postures.mjs#COULEURS_ALIGNEMENTS).
// Le site de dev est la source de ce qu'il modifie : ce que la migration écrit se lit dans la base d'import (test/aide-base-d-import.mjs) ; ids, avant
// et après viennent du registre de la migration ; aucun texte n'est écrit ici. Le texte fondu se compare au dernier texte que le site a écrit pour la
// page retirée (historique_modification, lot rapatrié avant la migration). Sur l'état courant : la page reste retirée, et chaque mot-clé encore là
// mène à la page qui porte le contenu.
//   node --test test/db-0123-fusion-pages-alignement.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ancresDuCorps, sectionParAncre } from '../src/lib/ancres-figees.mjs';
import { COULEURS_ALIGNEMENTS } from '../src/lib/caracteristiques-postures.mjs';
import { morceauxDuChapitre } from '../src/lib/guide.mjs';
import { cheminDeLAdresse } from '../src/lib/mots-cles-liens.mjs';
import { fauteDeLaCouleur, idDeCouleur } from '../src/lib/palette-css.mjs';
import { normalize } from '../src/lib/text.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { baseDImport } from './aide-base-d-import.mjs';
import { rendreCommeLeGuide } from './aide-rendu-du-site.mjs';

const registre = JSON.parse(readFileSync(new URL('../../data/migrations/0123-fusion-pages-alignement.json', import.meta.url), 'utf8'));
const [retiree] = registre.pages_retirees;
const ACCUEIL = retiree.contenu_dans;
const ANCRE = retiree.ancre;
const dImport = baseDImport();
const courante = ouvrirBase();
const corpsDImport = () => dImport.prepare('SELECT corps_md FROM page WHERE id = ?').get(ACCUEIL)?.corps_md;
/** Le dernier texte que le site de dev a écrit pour la page retirée (lot rapatrié avant la migration). */
function dernierTexteDuSite(db, id) {
  const lignes = db.prepare("SELECT apres FROM historique_modification WHERE table_nom = 'page' AND cle = ? AND operation = 'modifier' ORDER BY fait_le, lot_id, rang")
    .all(JSON.stringify({ id })).map((l) => JSON.parse(l.apres ?? '{}').corps_md).filter((v) => typeof v === 'string');
  return lignes.at(-1);
}
/** Les ids d'intertitres d'un corps de page du guide, rendus comme au build (skill tests-conventions, « Ancres »). */
async function intertitresRendus(corps) {
  const ids = [];
  for (const m of morceauxDuChapitre(corps)) {
    if ('markdown' in m) ids.push(...[...(await rendreCommeLeGuide(m.markdown)).matchAll(/<h[2-6] id="([^"]+)"/g)].map((x) => x[1]));
  }
  return ids;
}

test('0123 : la page retirée n’a plus aucune ligne, à l’import comme aujourd’hui (page, alias, sources, étiquettes, entrée du menu)', () => {
  for (const db of [dImport, courante]) {
    for (const [table, col] of [['page', 'id'], ['alias', 'page_id'], ['page_source', 'page_id'], ['page_tag', 'page_id'], ['page_entite', 'page_id'], ['regles_onglet_entree', 'page_id']]) {
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${col} = ?`).get(retiree.id).n, 0, `${table} : ${retiree.id}`);
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM regles_onglet_entree WHERE id = ?').get(retiree.entree_du_menu).n, 0, retiree.entree_du_menu);
  }
  // la page qui l'accueille garde sa place dans le menu (état d'import ; les autres entrées gardent leur rang, ni UNIQUE ni continu, comme à la 0122)
  assert.equal(dImport.prepare('SELECT count(*) AS n FROM regles_onglet_entree WHERE page_id = ?').get(ACCUEIL).n, 1, `${ACCUEIL} : une entrée du menu`);
});

test('0123 : le texte fondu est, mot pour mot, celui de la page d’avant puis le dernier texte du site de la page retirée, intertitres descendus à ancre figée', () => {
  const corps = corpsDImport();
  assert.ok(corps, ACCUEIL);
  const [texte] = registre.textes;
  assert.equal(texte.cle.id, ACCUEIL);
  assert.ok(corps.includes(texte.apres), 'le fragment du registre est en place');
  const marques = ancresDuCorps(corps).filter((a) => a.ancre === ANCRE);
  assert.equal(marques.length, 1, `un seul intertitre #${ANCRE}`);
  assert.equal(marques[0].niveau, 2);
  const source = dernierTexteDuSite(courante, retiree.id); // l'historique (la base d'import défait le site et n'en garde pas la trace)
  assert.ok(source, `${retiree.id} : son dernier texte, écrit par le site de dev`);
  // la section : le texte retiré, chaque « ## X » devenu « ### X {#ancre} » (aucun autre caractère changé)
  const section = sectionParAncre(corps, ANCRE);
  const sousTitres = ancresDuCorps(section);
  assert.equal(sousTitres.length, Object.keys(COULEURS_ALIGNEMENTS).length, 'un intertitre par alignement');
  let attendu = source.trim();
  for (const s of sousTitres) {
    assert.equal(s.niveau, 3, s.texte);
    attendu = attendu.replace(`\n## ${s.texte}\n`, `\n### ${s.texte} {#${s.ancre}}\n`);
  }
  assert.equal(section, attendu);
  assert.ok(corps.trimEnd().endsWith(section), 'la section est en fin de page');
  // le texte d'avant la section est celui de la page d'avant, intact : la ligne `avant` du registre la termine, une fois
  const avant = corps.slice(0, corps.indexOf(`{#${ANCRE}}`)).replace(/\n## [^\n]*$/, '');
  assert.ok(avant.trimEnd().endsWith(texte.avant.trimEnd()), 'la fin de la page d’avant');
  assert.equal(avant.split(texte.avant.trimEnd()).length, 2);
});

test('0123 : les ancres posées sont celles que le rendu donne, une par alignement (état d’import)', async () => {
  const corps = corpsDImport();
  const rendus = await intertitresRendus(corps);
  const sousTitres = ancresDuCorps(sectionParAncre(corps, ANCRE));
  for (const a of [ANCRE, ...sousTitres.map((s) => s.ancre)]) assert.ok(rendus.includes(a), `#${a} rendu`);
  assert.equal(new Set(rendus).size, rendus.length, 'aucun id d’intertitre en double');
  // chaque ancre d'alignement est l'id de sa couleur (palette-css.mjs#idDeCouleur), et son intertitre nomme un alignement de la palette
  for (const s of sousTitres) {
    assert.ok(Object.hasOwn(COULEURS_ALIGNEMENTS, s.texte), s.texte);
    assert.equal(s.ancre, idDeCouleur(s.texte));
  }
});

test('0123 : le mot-clé 192 mène à l’intertitre ; les neuf mots-clés des alignements (libellé, clé, adresse, couleur, verrou, catégorie, définition) à l’import', () => {
  const [modifie] = registre.mots_cles_modifies;
  assert.equal(dImport.prepare('SELECT url FROM mot_cle WHERE id = ?').get(modifie.id)?.url, modifie.apres);
  assert.equal(cheminDeLAdresse(modifie.apres), `/regles/${ACCUEIL.slice('guide/'.length)}/`);
  assert.ok(modifie.apres.endsWith(`#${ANCRE}`));
  const corps = corpsDImport();
  const sousTitres = ancresDuCorps(sectionParAncre(corps, ANCRE));
  assert.deepEqual(registre.mots_cles_crees.map((m) => m.libelle), sousTitres.map((s) => s.texte), 'un mot-clé par section, dans l’ordre');
  const ids = registre.mots_cles_crees.map((m) => m.id);
  assert.deepEqual(ids, ids.map((_, i) => ids[0] + i), 'ids consécutifs');
  for (const m of registre.mots_cles_crees) {
    const l = dImport.prepare('SELECT * FROM mot_cle WHERE id = ?').get(m.id);
    assert.ok(l, `mot-clé ${m.id}`);
    const s = sousTitres.find((x) => x.texte === l.libelle);
    assert.ok(s, `${l.libelle} : sa section`);
    assert.equal(l.cle, normalize(l.libelle), 'R232 : clé = normalize(libellé), sans homonyme');
    assert.equal(l.url, `${cheminDeLAdresse(modifie.apres)}#${s.ancre}`);
    assert.equal(l.couleur, `alignement:${idDeCouleur(l.libelle)}`);
    assert.equal(fauteDeLaCouleur(l.couleur), null);
    assert.equal(l.verrou, 1, 'R219 (1) : un mot-clé à adresse est verrouillé');
    assert.deepEqual(dImport.prepare('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = ?').all(m.id).map((c) => c.categorie_id),
      dImport.prepare('SELECT categorie_id FROM mot_cle_categorie WHERE mot_cle_id = 10').all().map((c) => c.categorie_id), 'les catégories d’« Alignement » (10)');
    // la définition : la première phrase du premier paragraphe de sa section, telle quelle
    const paragraphe = sectionParAncre(corps, s.ancre).split('\n\n')[0];
    assert.ok(paragraphe.startsWith(l.description), `${l.libelle} : le début de son premier paragraphe`);
    assert.match(l.description, /[.!?…]$/);
    assert.ok(!/[.!?…]\s/.test(l.description), `${l.libelle} : une seule phrase`);
  }
});

test('0123 : aujourd’hui, chaque mot-clé de la migration encore présent mène à une page qui existe', () => {
  const ids = [registre.mots_cles_modifies[0].id, ...registre.mots_cles_crees.map((m) => m.id)];
  for (const id of ids) {
    const l = courante.prepare('SELECT url FROM mot_cle WHERE id = ?').get(id);
    if (!l?.url) continue; // supprimé ou sans adresse sur le site de dev : admis
    const chemin = cheminDeLAdresse(l.url);
    if (chemin !== cheminDeLAdresse(registre.mots_cles_modifies[0].apres)) continue; // adresse changée sur le site
    assert.ok(courante.prepare('SELECT 1 FROM page WHERE id = ?').get(ACCUEIL), `${id} : ${ACCUEIL} existe`);
  }
});
