// Notes de cellule du classeur de magie (V8 jusqu'à la migration 0117, « Nouveauté mise à jour Décembre » depuis : R237) dans les pages `magies/` (tools/sheets/magies.py).
// Une note (le petit commentaire jaune d'une cellule) précise parfois une règle : elle est citée telle quelle, jamais interprétée,
// sous la table des sorts, avec le libellé « **Note de la cellule « <colonne> » du sort « <sort> »** : <texte> ».
// Les fils de commentaires (conversations « Commentaire » de Google Sheets) suivent le même modèle, après la note de leur cellule.
//
// Trois familles de tests :
//   - le contenu RÉEL des pages : les 110 notes du classeur de Décembre (aucun fil : R243 (2)), LIGNE PAR LIGNE, contre la copie de contrôle
//     `fixtures/magies-commentaires.json` (tirée du classeur par `magies.py --exporter-commentaires`), puis le rendu de ces pages par le
//     processeur Markdown du site (une page qui fusionnerait deux lignes à l'affichage est refusée) ;
//   - l'extracteur lui-même, sur des classeurs SYNTHÉTIQUES (les vrais dumps ne font pas partie du dépôt) : couverture des notes,
//     --verifier (y compris retours à la ligne), et les cas d'erreur (note sur une cellule vide, dans un onglet non publié, non
//     placée, dupliquée, absente) ;
//   - facultatif : `--verifier` et la copie de contrôle contre le vrai dump (MAGIES_DUMP).
//
// Le site de dev est la source des sorts qu'il modifie (décision du propriétaire ; historique_modification, lib/historique-site.mjs) : la copie de
// contrôle (le classeur) ne vaut que pour les sorts qu'il n'a pas touchés. Un sort renommé garde ses entrées sous son nouveau nom ; une remarque
// réécrite remplace les entrées de son sort par une seule « Remarque du sort » (lib/corps-magies.mjs), qui ne se compare plus au classeur.
//
// Contrat de citation (voir la docstring de tools/sheets/magies.py) : chaque ligne du commentaire est une ligne de la page, dans le
// même ordre, lignes vides comprises ; seuls les espaces et tabulations de début et de fin de ligne ne sont pas portés (Markdown ne
// les distingue pas). Les caractères Markdown sont échappés, une URL devient un lien automatique <url> : le texte affiché est le même.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor, unified } from '@astrojs/markdown-remark';
import { lignesDEntree, nomDeNote, nomPlie } from '../src/lib/corps-magies.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { historiqueSite } from '../src/lib/historique-site.mjs';
import { baseDImport, lotsAvant } from './aide-base-d-import.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const dossierPages = fileURLToPath(new URL('../src/content/wiki/magies', import.meta.url));
const racineWiki = fileURLToPath(new URL('../src/content/wiki', import.meta.url));
const fichierReference = fileURLToPath(new URL('./fixtures/magies-commentaires.json', import.meta.url));
const script = fileURLToPath(new URL('../../tools/sheets/magies.py', import.meta.url));
const SECTION = 'Notes et commentaires des sorts';
const REGENERER = 'tools/sheets/magies.py --exporter-commentaires (tech-sources) depuis le classeur de Décembre, sinon les lignes note_cellule de la 0117 : voir le champ `regenerer` de la copie';

// ---------------------------------------------------------------------------------------------------------------------------------
// Lecture d'une page : les entrées de la section des notes
// ---------------------------------------------------------------------------------------------------------------------------------

const page = (slug) => readFileSync(join(dossierPages, `${slug}.md`), 'utf8');
/**
 * La section des notes d'une page telle que le classeur la donne : les entrées de la copie de contrôle, écrites comme l'importeur et la base les écrivent
 * (lib/corps-magies.mjs#lignesDEntree), quoi que le site de dev ait fait depuis des noms et des remarques des sorts.
 */
const pageDuClasseur = (slug) => `## ${SECTION}\n\n${reference().filter((e) => e.page === slug)
  .map((e) => lignesDEntree(`${e.genre} de la cellule « ${e.colonne} » du sort « ${e.sort} »`, e.lignes).join('\n')).join('\n\n')}\n`;
const section = (texte) => texte.split(new RegExp(`^## ${SECTION}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? null;
// « Remarque du sort « … » » : la remarque d'un sort réécrite par le site de dev (lib/corps-magies.mjs), sans cellule
const ETIQUETTE = /^\*\*(Note|Commentaire résolu|Commentaire|Remarque)(?: de la cellule « (.+?) »)? du sort « (.+?) »\*\*(?: : (.*))?$/;
const sansEchappement = (s) => s.replace(/\\([\\`*_[\]<~&>#+\-.)=|])/g, '$1').replace(/<(https?:\/\/[^>\s]+)>/g, '$1');
const norme = (s) => s.replace(/\s+/g, ' ').trim();
const bord = (s) => s.replace(/^[ \t]+|[ \t]+$/g, ''); // espaces et tabulations de début et de fin de ligne (rien d'autre : NBSP conservé)
const estPuce = (ligne) => /^- \S/.test(ligne);

/**
 * [{ genre, colonne, sort, lignes, texte, sautsNonForces }] : `lignes` = les lignes du commentaire telles que la page les cite (échappements
 * Markdown retirés, blancs de bord retirés, lignes vides conservées) ; `texte` = ces lignes ramenées à une seule, aux espaces près ;
 * `sautsNonForces` = nombre de lignes que Markdown fusionnerait avec la suivante (pas de saut forcé : deux espaces en fin de ligne).
 */
function entrees(texte) {
  const corps = section(texte);
  if (corps === null) return [];
  const brutes = [];
  for (const ligne of corps.split('\n')) {
    const m = ETIQUETTE.exec(ligne);
    if (m) brutes.push({ genre: m[1], colonne: m[2], sort: m[3], corps: m[4] === undefined ? [] : [m[4]] });
    else if (brutes.length) brutes.at(-1).corps.push(ligne);
  }
  return brutes.map(({ corps, ...e }) => {
    const sautsNonForces = corps.filter((l, i) => l.trim() !== '' && corps[i + 1]?.trim() && !estPuce(corps[i + 1]) && !/ {2}$/.test(l)).length;
    const lignes = corps.map((l) => bord(sansEchappement(l)));
    while (lignes.length && lignes[0] === '') lignes.shift();
    while (lignes.length && lignes.at(-1) === '') lignes.pop();
    return { ...e, lignes, texte: norme(lignes.join(' ')), sautsNonForces };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Rendu réel : ce que le site affiche (processeur Markdown du projet, sans apostrophes typographiques)
// ---------------------------------------------------------------------------------------------------------------------------------

const processeur = await createMarkdownProcessor({ processor: unified(), smartypants: false });
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITES[e] ?? m)));
// <br> = saut de ligne forcé ; un retour à la ligne nu dans le HTML est une espace à l'affichage (saut « mou » : les lignes fusionnent)
const enTexte = (html) => decode(html.replace(/<br\s*\/?>\n?/g, '\u0000').replace(/<\/?(?:a|strong|em|code|del)\b[^>]*>/g, '').replace(/\n/g, ' ').replace(/\u0000/g, '\n'));

/** Markdown de la section des notes -> [{ genre, colonne, sort, blocs: [{ type: 'p' | 'li', texte }] }] d'après le HTML rendu. */
async function entreesRendues(markdown) {
  const { code } = await processeur.render(markdown);
  const sortie = [];
  for (const [, paragraphe, liste] of code.matchAll(/<p>([\s\S]*?)<\/p>|<ul>([\s\S]*?)<\/ul>/g)) {
    if (liste !== undefined) {
      sortie.at(-1).blocs.push(...[...liste.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, li]) => ({ type: 'li', texte: enTexte(li.replace(/<\/?p>/g, '')).trim() })));
      continue;
    }
    const m = /^<strong>(Note|Commentaire résolu|Commentaire|Remarque)(?: de la cellule « (.+?) »)? du sort « (.+?) »<\/strong>(?: : ([\s\S]*))?$/.exec(paragraphe);
    if (m) sortie.push({ genre: m[1], colonne: m[2] === undefined ? undefined : decode(m[2]), sort: decode(m[3]), blocs: m[4] === undefined ? [] : [{ type: 'p', texte: enTexte(m[4]) }] });
    else sortie.at(-1).blocs.push({ type: 'p', texte: enTexte(paragraphe) });
  }
  return sortie;
}

/** Lignes d'un commentaire -> les blocs que Markdown doit en tirer : paragraphes (lignes successives) et puces (avec leurs lignes de suite). */
function blocsDeLignes(lignes) {
  const blocs = [];
  let courant = null;
  for (const ligne of lignes) {
    if (ligne === '') courant = null;
    else if (estPuce(ligne)) blocs.push((courant = { type: 'li', lignes: [ligne.slice(2)] }));
    else if (courant) courant.lignes.push(ligne);
    else blocs.push((courant = { type: 'p', lignes: [ligne] }));
  }
  return blocs.map((b) => ({ type: b.type, texte: b.lignes.join('\n') }));
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Copie de contrôle des commentaires du classeur (tests/fixtures/magies-commentaires.json) et comparaison avec une page
// ---------------------------------------------------------------------------------------------------------------------------------

/** [{ page, onglet, genre, cellule, colonne, sort, lignes }] dans l'ordre des pages (celui de SLUGS) puis de la table des sorts. */
const reference = () => JSON.parse(readFileSync(fichierReference, 'utf8')).entrees;

// Sorts que le site de dev a renommés ou dont il a réécrit la remarque : page -> nom plié d'import -> { nom (du libellé), remarque (réécrite) }
const base = ouvrirBase({ sansExemples: false });
const historique = historiqueSite(base);
const sortsDuSite = new Map();
for (const s of base.prepare('SELECT id, magie_id, nom FROM sort').all()) {
  const cle = { id: s.id };
  const remarque = historique.modifiee('sort', cle, 'remarque');
  if (!remarque && !historique.modifiee('sort', cle, 'nom')) continue;
  const slug = s.magie_id.replace(/^magies\//, '');
  if (!sortsDuSite.has(slug)) sortsDuSite.set(slug, new Map());
  sortsDuSite.get(slug).set(nomPlie(historique.valeurDImport('sort', cle, 'nom', s.nom)), { nom: nomDeNote(s.nom), remarque });
}
/**
 * Le corps de la page magies/<slug> tel que la migration 0117 l'a écrit (les notes du classeur de Décembre) : les modifications du site de dev d'avant
 * elle sont gardées (lotsAvant('0117')), celles d'après défaites. `valeurDImport` rendrait ici le corps d'avant la 0117, que le site avait modifié.
 */
const apres0117 = baseDImport({ garder: lotsAvant('0117') });
const pageDImport = (slug) => apres0117.prepare('SELECT corps_md FROM page WHERE id = ?').get(`magies/${slug}`).corps_md;
/** Ce que le site a fait du sort `sort` (nom d'import) de la page : undefined s'il n'y a pas touché. */
const duSite = (slug, sort) => sortsDuSite.get(slug)?.get(nomPlie(sort));
/** Les sorts de la page dont le site a réécrit la remarque, sous leur nom actuel. */
const reecrits = (slug) => new Set([...(sortsDuSite.get(slug)?.values() ?? [])].filter((x) => x.remarque).map((x) => x.nom));
/** La copie de contrôle telle que la page doit la citer aujourd'hui : sorts à remarque réécrite retirés, sorts renommés sous leur nouveau nom. */
const referenceDuSite = () => reference().flatMap((e) => {
  const site = duSite(e.page, e.sort);
  if (!site) return [e];
  return site.remarque ? [] : [{ ...e, sort: site.nom }];
});
/** Les entrées d'une page hors sorts à remarque réécrite (comparées au classeur). */
const entreesDuClasseur = (slug, texte) => {
  const exclus = reecrits(slug);
  return entrees(texte).filter((e) => e.genre !== 'Remarque' && !exclus.has(e.sort));
};

/**
 * Écarts entre les entrées d'une page et la copie de contrôle : lignes, genre, colonne, sort, ordre, sauts forcés. `dImport` : une page telle que le
 * classeur la donne (pageDuClasseur), comparée à la copie telle quelle (aucun sort renommé ni réécrit).
 */
function ecartsPage(slug, texte, { dImport = false } = {}) {
  const attendu = (dImport ? reference() : referenceDuSite()).filter((e) => e.page === slug);
  const lues = dImport ? entrees(texte).filter((e) => e.genre !== 'Remarque') : entreesDuClasseur(slug, texte);
  const problemes = [];
  for (let i = 0; i < Math.max(attendu.length, lues.length); i++) {
    const a = attendu[i];
    const l = lues[i];
    const meme = a && l && a.genre === l.genre && a.colonne === l.colonne && a.sort === l.sort && JSON.stringify(a.lignes) === JSON.stringify(l.lignes);
    if (!meme || l.sautsNonForces) {
      problemes.push(`${slug} entrée ${i + 1}${a ? ` (${a.cellule}, « ${a.sort} »)` : ''} : attendu ${JSON.stringify(a?.lignes)} (${a?.genre}, ${a?.colonne}), lu ${JSON.stringify(l?.lignes)} (${l?.genre}, ${l?.colonne})${l?.sautsNonForces ? ' sans saut de ligne forcé' : ''}`);
    }
  }
  return problemes;
}

// notes citées « Note de la cellule … » par page à l'import (copie de contrôle : 70 ; les 40 autres des 110 notes du classeur de Décembre sont citées sous
// « Remarque du sort », sorts créés par la 0117 : test dédié)
const SLUGS = {
  'potentiel-illimite': 0, 'magie-du-sang': 7, 'magie-de-larcane': 4, 'magie-de-la-corruption': 7, 'magie-de-lespace-temps': 9,
  'magie-du-vide': 7, 'magie-de-la-necromancie': 4, 'magie-du-feu': 1, 'magie-de-leau': 3, 'magie-de-la-glace': 5,
  'magie-de-la-terre': 6, 'magie-du-vent': 3, 'magie-de-la-foudre': 3, 'magie-de-la-lumiere': 2, 'magie-de-lombre': 9,
};
const REMARQUES_0117 = JSON.parse(readFileSync(fileURLToPath(new URL('../../data/migrations/0117-magies-v10-specialisations.json', import.meta.url)), 'utf8')).remarques;
const NOTES_V10 = REMARQUES_0117.notes_v10;
// R243 (2) : 8 sorts gardent la remarque que le site de dev leur avait donnée (la page la cite, pas la note du classeur)
const GARDEES_DU_SITE = new Set(REMARQUES_0117.remarques_du_site_gardees.map((r) => r.id));

// ---------------------------------------------------------------------------------------------------------------------------------
// Contenu réel des pages
// ---------------------------------------------------------------------------------------------------------------------------------

test('les notes de cellule du classeur de Décembre sont dans les pages sous « Note de la cellule… », réparties comme dans le classeur (les autres : test « Remarque du sort »)', () => {
  let total = 0;
  let reecrites = 0;
  for (const [slug, attendu] of Object.entries(SLUGS)) {
    // moins les notes des sorts dont le site a réécrit la remarque
    const retirees = reference().filter((e) => e.page === slug && e.genre === 'Note' && duSite(slug, e.sort)?.remarque).length;
    const notes = entreesDuClasseur(slug, page(slug)).filter((e) => e.genre === 'Note');
    assert.equal(notes.length, attendu - retirees, `${slug} : nombre de notes`);
    total += notes.length;
    reecrites += retirees;
  }
  assert.equal(total + reecrites, reference().length);
});

test('chaque note est citée avec son texte intégral, sous le sort dont la cellule la porte (la première de chaque page, lue dans la copie de contrôle)', () => {
  const premieres = Object.keys(SLUGS).map((slug) => reference().find((e) => e.page === slug)).filter(Boolean);
  assert.ok(premieres.length >= 10);
  // à l'import : chacune, sans condition
  for (const e of premieres) {
    const trouvees = entrees(pageDImport(e.page)).filter((x) => x.genre === 'Note' && x.sort === e.sort);
    assert.ok(trouvees.length >= 1, `${e.page} ${e.cellule} (${e.sort}) : une note attendue à l'import`);
    assert.ok(trouvees.some((x) => x.colonne === e.colonne && x.texte === norme(e.lignes.join(' '))), `${e.page} ${e.cellule} (${e.sort}) : texte à l'import`);
  }
  // aujourd'hui : celles des sorts dont le site n'a pas réécrit la remarque, sous le nom courant du sort
  for (const e of premieres.filter((x) => !duSite(x.page, x.sort)?.remarque)) {
    const nom = duSite(e.page, e.sort)?.nom ?? e.sort;
    const trouvees = entrees(page(e.page)).filter((x) => x.genre === 'Note' && x.sort === nom);
    assert.ok(trouvees.some((x) => x.colonne === e.colonne && x.texte === norme(e.lignes.join(' '))), `${e.page} ${e.cellule} (${e.sort}) : texte`);
  }
});

test('le libellé est « Note de la cellule « … » du sort « … » », sur la ligne ou au-dessus du texte (comme les pages de races)', () => {
  // à l'import, sans condition (le site de dev peut renommer ces sorts ou réécrire leur remarque) ; les entrées sont lues dans la copie de contrôle
  const unique = reference().find((e) => e.lignes.length === 1 && !estPuce(e.lignes[0]));
  const plusieurs = reference().find((e) => e.lignes.length > 1);
  assert.ok(unique && plusieurs);
  for (const e of [unique, plusieurs]) {
    const bloc = lignesDEntree(`Note de la cellule « ${e.colonne} » du sort « ${e.sort} »`, e.lignes);
    assert.ok(pageDImport(e.page).includes(`${bloc.join('\n')}\n`), `${e.page} ${e.cellule} : l'entrée telle que la page l'écrit`);
  }
  // une seule ligne : le texte suit le libellé ; plusieurs : le libellé seul, une ligne vide, puis les lignes
  assert.match(lignesDEntree('Note de la cellule « C » du sort « S »', unique.lignes)[0], /^\*\*Note de la cellule « C » du sort « S »\*\* : /);
  assert.deepEqual(lignesDEntree('Note de la cellule « C » du sort « S »', plusieurs.lignes).slice(0, 2), ['**Note de la cellule « C » du sort « S »**', '']);
  for (const texte of Object.keys(SLUGS).flatMap((slug) => [pageDImport(slug), page(slug)])) assert.doesNotMatch(texte, /^\*Note :\*$/m, 'plus de « *Note :* » : un seul libellé pour toutes les familles');
});

test('les notes suivent la table des sorts (même ordre qu\'elle), avant les textes de niveau 5 et la légende', () => {
  for (const slug of Object.keys(SLUGS).filter((s) => SLUGS[s] > 0)) {
    const texte = page(slug);
    const titres = [...texte.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1]);
    assert.ok(titres.indexOf(SECTION) > titres.indexOf('Sorts'), `${slug} : la section des notes suit « Sorts »`);
    for (const suivant of ['Textes des sorts de niveau 5', 'Légende']) {
      if (titres.includes(suivant)) assert.ok(titres.indexOf(suivant) > titres.indexOf(SECTION), `${slug} : « ${suivant} » après les notes`);
    }
    const noms = texte.split(/^## Sorts\s*$/m)[1].split(/^## /m)[0].split('\n').filter((l) => /^\| \d/.test(l)).map((l) => l.split(' | ')[1]);
    const ordre = entrees(texte).map((e) => noms.indexOf(e.sort));
    assert.ok(ordre.length >= referenceDuSite().filter((e) => e.page === slug && e.genre === 'Note').length, `${slug} : les notes sont dans la section`);
    assert.ok(ordre.every((i) => i >= 0), `${slug} : un sort de la table pour chaque note (${ordre})`);
    assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, `${slug} : ordre de la table des sorts`);
  }
});

test('des notes de même texte sur plusieurs sorts sont citées autant de fois, sous chaque sort', () => {
  const parTexte = new Map();
  for (const e of reference()) parTexte.set(`${e.page}\u0000${e.lignes.join('\n')}`, [...(parTexte.get(`${e.page}\u0000${e.lignes.join('\n')}`) ?? []), e.sort]);
  const groupes = [...parTexte].filter(([, sorts]) => sorts.length > 1);
  assert.ok(groupes.length > 0, 'la copie de contrôle a des notes identiques sur plusieurs sorts (Corruption : les Verrouillages)');
  for (const [cle, sorts] of groupes) {
    const [slug, texte] = cle.split('\u0000');
    // à l'import, sans condition
    const aLImport = entrees(pageDImport(slug)).filter((e) => e.genre === 'Note' && e.texte === norme(texte.split('\n').join(' ')));
    assert.deepEqual(aLImport.map((e) => e.sort), sorts, `${slug} : « ${texte.slice(0, 40)}… » citée sous chaque sort`);
  }
});

test('aucun fil de commentaire (R243 (2)) : les pages ne citent que des notes, et des remarques réécrites par le site', () => {
  for (const slug of Object.keys(SLUGS)) {
    for (const texte of [pageDImport(slug), page(slug)]) {
      assert.ok(entrees(texte).every((e) => e.genre === 'Note' || e.genre === 'Remarque'), `${slug} : un fil de commentaire`);
    }
  }
  assert.ok(reference().every((e) => e.genre === 'Note'));
});

test('le message de conversation sans rapport avec les règles (Eau, AN46) est écarté, et déclaré comme tel dans l\'extracteur', () => {
  assert.doesNotMatch(page('magie-de-leau'), /salut viens en vocal/);
  assert.match(readFileSync(script, 'utf8'), /salut viens en vocal stp/);
});

// --- les notes, ligne par ligne, contre la copie de contrôle (`npm test` seul les protège tous) -----------------------------------------------

test('copie de contrôle : 70 notes (aucun fil), réparties comme les pages, chaque entrée avec son texte intégral ; les 110 notes du registre de la 0117 sont dans les pages', () => {
  const lignes = reference();
  assert.equal(lignes.length, 70);
  assert.ok(lignes.every((e) => e.genre === 'Note'));
  assert.ok(lignes.every((e) => e.colonne && e.sort && e.cellule && e.lignes.length > 0 && e.lignes.every((l) => typeof l === 'string')));
  assert.ok(lignes.every((e) => e.lignes[0] !== '' && e.lignes.at(-1) !== ''), 'ni ligne vide en tête ni en queue');
  for (const [slug, attendu] of Object.entries(SLUGS)) {
    assert.equal(lignes.filter((e) => e.page === slug && e.genre === 'Note').length, attendu, slug);
  }
  // les autres notes du classeur de Décembre (lignes note_cellule des sorts, tracées par la 0117) sont citées par leur page sous « Remarque du sort », telles
  // que la remarque du sort les porte (texte d'import)
  const notes = apres0117.prepare("SELECT n.texte, s.id, s.nom, s.remarque, s.magie_id FROM note_cellule n JOIN sort s ON s.id = n.entite_id WHERE n.entite_table = 'sort'").all();
  assert.equal(notes.length, NOTES_V10);
  const citees = new Set(lignes.map((e) => `${e.page}\u0000${norme(e.lignes.join(' '))}`));
  const parSort = new Map();
  for (const n of notes) parSort.set(n.id, [...(parSort.get(n.id) ?? []), n]);
  let remarques = 0;
  for (const [id, siennes] of parSort) {
    const slug = siennes[0].magie_id.replace(/^magies\//, '');
    if (siennes.every((n) => citees.has(`${slug}\u0000${norme(n.texte)}`))) continue;
    if (GARDEES_DU_SITE.has(id)) {
      remarques += siennes.length; // la remarque du site, R243 (2) : sa page la cite, elle ne se compare pas aux notes du classeur
      continue;
    }
    // les notes d'un sort sont sa remarque (séparées par une ligne vide), citée en une seule entrée « Remarque du sort »
    const nom = siennes[0].nom.replace(/\s+/g, ' ').trim();
    const attendu = norme(siennes.map((n) => n.texte.trim()).join('\n\n'));
    assert.ok(entrees(pageDImport(slug)).some((e) => e.genre === 'Remarque' && e.sort === nom && e.texte === attendu), `${id} : les notes citées sous « Remarque du sort »`);
    remarques += siennes.length;
  }
  assert.equal(remarques + lignes.length, NOTES_V10);
});

test('les pages citent les notes du classeur de Décembre LIGNE PAR LIGNE, dans l\'ordre, sous le bon sort et dans la bonne colonne (aucun fil)', () => {
  const ecarts = Object.keys(SLUGS).flatMap((slug) => ecartsPage(slug, page(slug)));
  assert.deepEqual(ecarts, [], `écarts avec la copie de contrôle (si le classeur a changé, la regénérer : ${REGENERER})`);
});

test('toute altération d\'une page réelle est vue par le contrôle : texte, lignes fusionnées, saut forcé retiré, colonne, ordre, entrée en trop', () => {
  // les pages telles que le classeur les donne (pageDuClasseur) : le contrôle se juge sur ce texte (le site de dev réécrit librement noms et remarques des
  // sorts). Les notes à muter sont choisies dans la copie de contrôle selon leur forme, jamais écrites ici.
  const ref = reference();
  const bloc = (e) => lignesDEntree(`Note de la cellule « ${e.colonne} » du sort « ${e.sort} »`, e.lignes).join('\n');
  const choisir = (nom, predicat) => {
    const e = ref.find(predicat);
    assert.ok(e, `${nom} : aucune note de cette forme dans la copie de contrôle`);
    return e;
  };
  const mots = (e) => e.lignes.length === 1 && e.lignes[0].split(' ').length > 6;
  const mutations = [
    ['mot changé dans une note', choisir('mot', mots), (e, b) => b.replace(/(\p{L}{5,})([^\p{L}]*)$/u, 'ZZZZZ$2')],
    ['mot ajouté à une note', choisir('mot', mots), (e, b) => `${b} normalement`],
    ['colonne changée', choisir('colonne', mots), (e, b) => b.replace(`« ${e.colonne} »`, '« Portée »')],
    ['deux lignes fusionnées (saut forcé remplacé par une espace)', choisir('saut', (e) => bloc(e).includes('  \n')), (e, b) => b.replace('  \n', ' ')],
    ['saut de ligne forcé retiré : Markdown fusionnerait les deux lignes', choisir('saut', (e) => bloc(e).includes('  \n')), (e, b) => b.replace('  \n', '\n')],
    ['puces fusionnées en un paragraphe', choisir('puces', (e) => e.lignes.length > 1 && e.lignes.every((l) => estPuce(l))), (e, b) => b.replace(/\n- /g, ' - ')],
    ['ligne vide retirée entre deux paragraphes', choisir('vide', (e) => e.lignes.length > 2 && e.lignes.indexOf('') > 0), (e, b) => b.replace('\n\n', '\n').replace(/\n\n(?!$)/, '\n')],
  ];
  for (const [nom, e, muter] of mutations) {
    const origine = pageDuClasseur(e.page);
    assert.deepEqual(ecartsPage(e.page, origine, { dImport: true }), [], `${e.page} : la page d'origine est conforme`);
    const mutee = origine.replace(bloc(e), muter(e, bloc(e)));
    assert.notEqual(mutee, origine, `${nom} : la mutation s'applique`);
    assert.ok(ecartsPage(e.page, mutee, { dImport: true }).length > 0, `${nom} : non vu par le contrôle`);
  }
  // entrée supprimée, entrée citée deux fois, deux entrées permutées
  const [a, b] = ref.filter((e) => e.page === ref[0].page);
  const origine = pageDuClasseur(a.page);
  assert.ok(ecartsPage(a.page, origine.replace(`${bloc(a)}\n\n`, ''), { dImport: true }).length > 0, 'entrée supprimée');
  assert.ok(ecartsPage(a.page, origine.replace(`${bloc(a)}\n\n`, `${bloc(a)}\n\n${bloc(a)}\n\n`), { dImport: true }).length > 0, 'entrée citée deux fois');
  assert.ok(ecartsPage(a.page, origine.replace(`${bloc(a)}\n\n${bloc(b)}`, `${bloc(b)}\n\n${bloc(a)}`), { dImport: true }).length > 0, 'entrées permutées');
});

test('citation fidèle des blancs : espace insécable, lignes vides multiples, liste collée au texte, adresse web, telles que la copie de contrôle les porte', () => {
  // à l'import, sans condition (le site de dev peut réécrire ces remarques) : chaque entrée de la copie, ligne par ligne, avec ses blancs de bord (NBSP compris)
  // et ses adresses en lien automatique ; la copie de contrôle porte ces cas quand le classeur les a (les tests synthétiques les fabriquent sinon)
  for (const e of reference()) {
    const page = pageDImport(e.page);
    assert.ok(page.includes(`${lignesDEntree(`Note de la cellule « ${e.colonne} » du sort « ${e.sort} »`, e.lignes).join('\n')}\n`), `${e.page} ${e.cellule} (${e.sort})`);
    for (const ligne of e.lignes.filter((l) => /https?:\/\//.test(l))) {
      const url = /https?:\/\/[^\s]+/.exec(ligne)[0];
      assert.ok(page.includes(`<${url}>`) || page.includes(url), `${e.page} ${e.cellule} : adresse intacte`);
    }
  }
});

test('rendu réel : le processeur Markdown du site affiche chaque note avec les mêmes lignes, puces et paragraphes que le classeur', async () => {
  let vues = 0;
  for (const slug of Object.keys(SLUGS)) {
    const attendu = referenceDuSite().filter((e) => e.page === slug);
    if (!attendu.length) continue;
    const exclus = reecrits(slug);
    const rendues = (await entreesRendues(section(page(slug)))).filter((e) => e.genre !== 'Remarque' && !exclus.has(e.sort));
    assert.equal(rendues.length, attendu.length, `${slug} : nombre d'entrées rendues`);
    attendu.forEach((a, i) => {
      assert.deepEqual(rendues[i], { genre: a.genre, colonne: a.colonne, sort: a.sort, blocs: blocsDeLignes(a.lignes) }, `${slug} ${a.cellule} « ${a.sort} » : rendu`);
      vues++;
    });
  }
  assert.equal(vues, referenceDuSite().length);
});

test('rendu réel : la même vérification refuse une page dont Markdown fusionnerait deux lignes (saut forcé retiré)', async () => {
  // la page telle que le classeur la donne (le site de dev réécrit librement les remarques)
  const a = reference().find((e) => lignesDEntree('x', e.lignes).join('\n').includes('  \n'));
  assert.ok(a, 'une note à saut de ligne forcé dans la copie de contrôle');
  const origine = pageDuClasseur(a.page);
  const avec = lignesDEntree(`Note de la cellule « ${a.colonne} » du sort « ${a.sort} »`, a.lignes).join('\n');
  const mutee = origine.replace(avec, avec.replace('  \n', '\n'));
  assert.notEqual(mutee, origine, 'la mutation s’applique');
  const rendues = await entreesRendues(section(mutee));
  const rendue = rendues.find((e) => e.sort === a.sort && e.genre === 'Note');
  assert.notDeepEqual(rendue.blocs, blocsDeLignes(a.lignes));
});

// ---------------------------------------------------------------------------------------------------------------------------------
// L'extracteur sur des classeurs synthétiques
// ---------------------------------------------------------------------------------------------------------------------------------

const MAGIES = [
  ['Potentiel illimité (magie diffi', 'Potentiel illimité', 'Potentiel Illimité', 'potentiel-illimite'],
  ['Sang', 'Magie du Sang', 'Sang', 'magie-du-sang'],
  ['Arcane', "Magie de l'Arcane", 'Arcane', 'magie-de-larcane'],
  ['Corruption', 'Magie de la Corruption', 'Corruption', 'magie-de-la-corruption'],
  ['TempsEspace', "Magie de l'Espace/Temps", 'Espace/Temps', 'magie-de-lespace-temps'],
  ['Vide', 'Magie du Vide', 'Vide', 'magie-du-vide'],
  ['Nécromancie', 'Magie de la Nécromancie', 'Nécromancie', 'magie-de-la-necromancie'],
  ['Feu', 'Magie du Feu', 'Feu', 'magie-du-feu'],
  ['Eau', "Magie de l'Eau", 'Eau', 'magie-de-leau'],
  ['Glace', 'Magie de la Glace', 'Glace', 'magie-de-la-glace'],
  ['Terre', 'Magie de la Terre', 'Terre', 'magie-de-la-terre'],
  ['Vent', 'Magie du Vent', 'Vent', 'magie-du-vent'],
  ['Foudre', 'Magie de la Foudre', 'Foudre', 'magie-de-la-foudre'],
  ['Lumière', 'Magie de la Lumière', 'Lumière', 'magie-de-la-lumiere'],
  ['Ombre', "Magie de l'Ombre", 'Ombre', 'magie-de-lombre'],
];

/** Un onglet minimal : bannière, description, deux sorts (Éclair en ligne 4, Bouclier en ligne 7), cellule « Effets secondaires » en BJ. */
const onglet = ([name, titre]) => ({
  name, state: 'visible', max_row: 9, max_col: 62, validations: [],
  merged: ['A4:AJ4', 'AL4:AM6', 'AL7:AM9'],
  cells: [
    { r: 1, c: 14, v: titre },
    ...[[38, 'Niveau'], [40, 'Nom'], [46, 'Type'], [50, 'Coût'], [53, 'Portée'], [56, 'Zone'], [59, 'D/S/B'], [62, 'Effets secondaires']].map(([c, v]) => ({ r: 3, c, v })),
    { r: 4, c: 1, v: 'Une description.' },
    { r: 4, c: 38, v: 1 }, { r: 4, c: 40, v: 'Éclair' }, { r: 4, c: 62, v: 'Un effet.' },
    { r: 7, c: 38, v: 2 }, { r: 7, c: 40, v: 'Bouclier' }, { r: 7, c: 62, v: 'Un autre effet.' },
  ],
});
const classeur = () => ({ sheets: MAGIES.map(onglet) });
const fiche = () => ({ sheets: [{ name: 'Accessibilité Magie', cells: MAGIES.map((m, i) => ({ r: 1, c: 2 + i, v: m[2] })) }] });
const BJ4 = { r: 4, c: 62 }; // « Effets secondaires » d'Éclair
const BJ7 = { r: 7, c: 62 }; // « Effets secondaires » de Bouclier
const cellule = (dump, nom, { r, c }) => dump.sheets.find((s) => s.name === nom).cells.find((x) => x.r === r && x.c === c);
const ajoute = (dump, nom, cell) => { dump.sheets.find((s) => s.name === nom).cells.push(cell); return dump; };

function lancer({ dump = classeur(), args = ['--sans-formats'], sortie, verifier = false } = {}) {
  const dir = dossierTemporaire('magies-notes');
  const out = sortie ?? join(dir, 'wiki');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(dir, 'magie-v8.json'), JSON.stringify(dump));
  writeFileSync(join(dir, 'fiche-auto-v15.json'), JSON.stringify(fiche()));
  const r = spawnSync('python3', ['-I', script, '--dump', join(dir, 'magie-v8.json'), '--fiche', join(dir, 'fiche-auto-v15.json'), '--out', out, ...args, ...(verifier ? ['--verifier'] : [])], { encoding: 'utf8' });
  return { ...r, dir, out, page: (slug) => { const f = join(out, 'magies', `${slug}.md`); return existsSync(f) ? readFileSync(f, 'utf8') : null; } };
}
const verifie = (r, dump, extra = {}) => lancer({ dump, sortie: r.out, verifier: true, ...extra });
const compte = (texte, motif) => texte.split(motif).length - 1;

test('synthétique : une note est écrite sous son sort, le contrôle de couverture et --verifier sont au vert', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Une règle précisée.\n\nEn deux paragraphes.';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const sang = r.page('magie-du-sang');
  assert.ok(sang.includes('**Note de la cellule « Effets secondaires » du sort « Éclair »**\n\nUne règle précisée.\n\nEn deux paragraphes.\n'), sang);
  assert.equal(entrees(sang).length, 1);
  assert.match(r.stdout, /1 note/);
  const v = verifie(r, dump);
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /vérification : OK/);
});

/** Un classeur dont Sang porte une note sur Éclair et une autre sur Bouclier. */
function avecNotes() {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Première note.';
  cellule(dump, 'Sang', BJ7).note = 'Seconde note, avec *étoiles*, _tirets bas_ et [crochets].';
  return dump;
}

test('synthétique : le texte est cité tel quel, les caractères Markdown sont échappés mais restent lisibles', () => {
  const r = lancer({ dump: avecNotes() });
  assert.equal(r.status, 0, r.stderr);
  const sang = r.page('magie-du-sang');
  assert.ok(sang.includes('**Note de la cellule « Effets secondaires » du sort « Bouclier »** : Seconde note, avec \\*étoiles\\*, \\_tirets bas\\_ et \\[crochets\\].'), sang);
  assert.deepEqual(entrees(sang).map((e) => [e.sort, e.texte]), [['Éclair', 'Première note.'], ['Bouclier', 'Seconde note, avec *étoiles*, _tirets bas_ et [crochets].']]);
});

test('synthétique : deux notes identiques sur deux cellules sont citées deux fois', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Même texte.';
  cellule(dump, 'Sang', BJ7).note = 'Même texte.';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(entrees(r.page('magie-du-sang')).length, 2);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : un fil identique à la note de sa cellule n\'est pas répété, un autre fil est cité, les réponses d\'état sont ignorées', () => {
  const dump = classeur();
  const c = cellule(dump, 'Sang', BJ4);
  c.note = 'Règle   précisée.';
  c.threads = [
    { text: 'Règle précisée.', done: true, replies: ['Marquée comme fermée', 'Rouverte'] },
    { text: 'Autre précision.' },
    { text: 'Fil résolu.', done: true },
  ];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => [e.genre, e.texte]), [['Note', 'Règle précisée.'], ['Commentaire', 'Autre précision.'], ['Commentaire résolu', 'Fil résolu.']]);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : une vraie réponse dans un fil arrête le script (rien n\'est perdu en silence)', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'Question ?', replies: ['Voici la réponse, une règle.'] }];
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /réponse/);
  assert.equal(r.page('magie-du-sang'), null, 'la page n\'est pas écrite');
});

test('synthétique : le message de conversation de l\'Eau (AN46) est écarté, et le reste de la cellule est cité', () => {
  const dump = classeur();
  const eau = dump.sheets.find((s) => s.name === 'Eau');
  eau.merged.push('AL46:AM48');
  eau.cells.push({ r: 46, c: 38, v: 3 }, { r: 46, c: 40, v: 'Eau Parfaite', threads: [{ text: 'salut viens en vocal stp', done: true }, { text: 'Une vraie précision.' }] });
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const texte = r.page('magie-de-leau');
  assert.doesNotMatch(texte, /salut viens en vocal/);
  assert.deepEqual(entrees(texte).map((e) => [e.colonne, e.sort, e.texte]), [['Nom', 'Eau Parfaite', 'Une vraie précision.']]);
  assert.match(r.stdout, /écarté/);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : l\'exclusion tient à l\'adresse ET au texte : un message modifié, ou le même ailleurs, est cité', () => {
  const dump = classeur();
  const eau = dump.sheets.find((s) => s.name === 'Eau');
  eau.merged.push('AL46:AM48');
  eau.cells.push({ r: 46, c: 38, v: 3 }, { r: 46, c: 40, v: 'Eau Parfaite', threads: [{ text: 'salut viens en vocal stp, vite' }] });
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'salut viens en vocal stp' }];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(entrees(r.page('magie-de-leau')).map((e) => e.texte), ['salut viens en vocal stp, vite']);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => e.texte), ['salut viens en vocal stp']);
  assert.doesNotMatch(r.stdout, /écarté : /);
});

test('synthétique : une note sur une cellule VIDE arrête le script avec un message clair, et la page n\'est pas écrite', () => {
  const dump = classeur();
  ajoute(dump, 'Sang', { r: 5, c: 62, v: '', note: 'Une note sans texte à côté' });
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Sang/);
  assert.match(r.stderr, /BJ5/);
  assert.match(r.stderr, /vide/);
  assert.equal(r.page('magie-du-sang'), null);
});

test('synthétique : une note dans un onglet NON PUBLIÉ est refusée, un fil y est seulement signalé', () => {
  const dump = classeur();
  dump.sheets.push({ name: 'Sommaire', state: 'visible', merged: [], validations: [], cells: [{ r: 31, c: 1, v: 'Règle spéciale', note: 'Une note de plus' }] });
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Sommaire/);
  assert.match(r.stderr, /non publié/);
  assert.match(r.stderr, /A31/);
  assert.equal(r.page('magie-du-sang'), null, 'rien n\'est écrit');

  const fils = classeur();
  fils.sheets.push({ name: 'Statistiques', state: 'visible', merged: [], validations: [], cells: [{ r: 27, c: 60, v: 50.0, threads: [{ text: 'augmentation a 39', done: true }] }] });
  const ok = lancer({ dump: fils });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Statistiques/);
  assert.match(ok.stdout, /BH27/);
});

test('synthétique : une note hors de la table des sorts n\'a pas de place prévue : le script s\'arrête', () => {
  const dump = classeur();
  cellule(dump, 'Sang', { r: 4, c: 1 }).note = 'Une note sur la description';
  const r = lancer({ dump });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /A4/);
  assert.match(r.stderr, /hors de la table des sorts/);
  assert.equal(r.page('magie-du-sang'), null);
});

test('--verifier : une note absente de la page, altérée ou citée deux fois est un écart (code 1, message clair)', () => {
  const dump = avecNotes();
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const f = join(r.out, 'magies', 'magie-du-sang.md');
  const original = readFileSync(f, 'utf8');
  const ligne = '**Note de la cellule « Effets secondaires » du sort « Éclair »** : Première note.';
  assert.ok(original.includes(ligne));

  writeFileSync(f, original.replace(`${ligne}\n\n`, ''));
  let v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /ÉCART/);
  assert.match(v.stderr, /Éclair/);
  assert.match(v.stderr, /absente/);

  writeFileSync(f, original.replace('Première note.', 'Première note, retouchée.'));
  v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /Première note\./);

  writeFileSync(f, original.replace(`${ligne}\n\n`, `${ligne}\n\n${ligne}\n\n`));
  v = verifie(r, dump);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /2 fois/);

  writeFileSync(f, original);
  assert.equal(verifie(r, dump).status, 0, 'la page d\'origine est de nouveau conforme');
});

test('--verifier : une note ajoutée au dump après l\'écriture des pages (page périmée) est signalée', () => {
  const r = lancer({ dump: avecNotes() });
  const plus = avecNotes();
  cellule(plus, 'Sang', BJ4).threads = [{ text: 'Nouveau fil.' }];
  const v = verifie(r, plus);
  assert.equal(v.status, 1);
  assert.match(v.stderr, /Nouveau fil\./);
  assert.match(v.stderr, /absente/);
});

test('--verifier : une note vide, hors table ou dans un onglet non publié est refusée aussi (le dump seul suffit)', () => {
  const r = lancer({ dump: avecNotes() });
  for (const [nom, modif, motif] of [
    ['cellule vide', (d) => ajoute(d, 'Sang', { r: 5, c: 62, v: '', note: 'x' }), /vide/],
    ['hors de la table', (d) => { cellule(d, 'Sang', { r: 4, c: 1 }).note = 'x'; return d; }, /hors de la table des sorts/],
    ['onglet non publié', (d) => { d.sheets.push({ name: 'Météo', merged: [], cells: [{ r: 1, c: 1, v: 'a', note: 'x' }] }); return d; }, /non publié/],
  ]) {
    const v = verifie(r, modif(avecNotes()));
    assert.equal(v.status, 1, nom);
    assert.match(v.stderr, motif, nom);
  }
});

// --- retours à la ligne : le contrôle de couverture est STRICT (une ligne fusionnée avec la suivante n'est plus « aux espaces près ») ------

/** Une note de cinq lignes de forme variée : paragraphe à deux lignes, ligne vide, puces suivies d'une ligne de suite. */
const NOTE_LIGNES = 'Premier paragraphe,\nsuite du premier.\n\n- une puce\n- une autre  \nsa suite\n\nDernier paragraphe.';

function pageAvecNoteLignes() {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = NOTE_LIGNES;
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const f = join(r.out, 'magies', 'magie-du-sang.md');
  return { dump, r, f, original: readFileSync(f, 'utf8') };
}

test('synthétique : chaque ligne de la note est une ligne de la page (saut forcé, puces, lignes vides), sans ligne vide ajoutée', () => {
  const { original } = pageAvecNoteLignes();
  assert.ok(original.includes([
    '**Note de la cellule « Effets secondaires » du sort « Éclair »**',
    '',
    'Premier paragraphe,  ',
    'suite du premier.',
    '',
    '- une puce',
    '- une autre  ',
    'sa suite',
    '',
    'Dernier paragraphe.',
    '',
  ].join('\n')), original);
});

test('synthétique : blancs de la note conservés — espace insécable de fin de ligne, lignes vides multiples, liste collée au texte, blancs de bord retirés', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = '  Exemple : \n\nUn caillou \nUne dague\n\n\nFin \nListe :\n- a\n- b\t\n';
  cellule(dump, 'Sang', BJ7).threads = [{ text: 'Voir http://exemple.org/x_(y) ici\n--- \n===', done: true }];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const sang = r.page('magie-du-sang');
  assert.ok(sang.includes([
    '**Note de la cellule « Effets secondaires » du sort « Éclair »**',
    '',
    'Exemple :',
    '',
    'Un caillou   ',
    'Une dague',
    '',
    '',
    'Fin   ',
    'Liste :',
    '- a',
    '- b',
    '',
    '**Commentaire résolu de la cellule « Effets secondaires » du sort « Bouclier »**',
    '',
    'Voir <http://exemple.org/x_(y)> ici  ',
    '\\---  ',
    '\\===',
    '',
  ].join('\n')), sang);
  assert.equal(verifie(r, dump).status, 0);
  const lignes = entrees(sang).map((e) => e.lignes);
  assert.deepEqual(lignes[0], ['Exemple :', '', 'Un caillou ', 'Une dague', '', '', 'Fin ', 'Liste :', '- a', '- b']);
});

test('synthétique : le rendu du site redonne les lignes, puces et paragraphes de la note (saut forcé, puce collée au texte, filets échappés)', async () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = NOTE_LIGNES;
  cellule(dump, 'Sang', BJ7).note = 'Liste :\n- a\n- b\n---\n===\n# pas un titre\n> pas une citation\n1. pas une liste\n* pas une puce';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const rendues = await entreesRendues(section(r.page('magie-du-sang')));
  assert.deepEqual(rendues.map((e) => e.blocs), [
    blocsDeLignes(NOTE_LIGNES.split('\n').map(bord)),
    blocsDeLignes('Liste :\n- a\n- b\n---\n===\n# pas un titre\n> pas une citation\n1. pas une liste\n* pas une puce'.split('\n')),
  ]);
});

/** Des lignes que Markdown lirait autrement si l'extracteur ne les échappait pas : tableau, filet, titre, citation, liste, code, entités, lien. */
const LIGNES_PIEGEUSES = [
  'Simple.', '|a|b|\n|---|---|', 'a | b\n--- | ---\nc | d', 'texte\n---', 'texte\n===', 'texte\n---\nsuite', '1. l\n2) m', '* p\n+ q', '***\n___\n- - -',
  '```\ncode\n```', '~~~\nx\n~~~', '# t\n## u\n> c\n>> d', '<b>gras</b> &amp; &lt; &copy; &#35;', 'fin \\\nsuite \\',
  'http://x.org/a_(b).\nhttp://y.org/a|b', '<https://x.org> et [lien](http://z) et ![img](a)', 'Liste :\n- a\n- b\n\nTexte\n- c', '- a\nb\nc\n- d',
  '-  a\n-b\n- - c', '[ref]: http://x.org\n[ref]', 'a\n\n\n\nb', '*a* _b_ __c__ **d** ~~e~~ `f`', 'ligne avec insécable \nsuite',
  '    pas de code\n\tpas de code', 'a\\*b\\_c\\\\d', '- a\n\n- b\n\n  c', '=== \n---', ':::\nx', '$$x$$ $y$', '@mention #hash', 'a\n \nb',
];

test('rendu réel : 31 textes piégeux (un fil chacun) sont affichés avec leurs lignes, puces et paragraphes, jamais en titre, tableau, filet ni code', async () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).threads = LIGNES_PIEGEUSES.map((text) => ({ text }));
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(verifie(r, dump).status, 0);
  const rendues = await entreesRendues(section(r.page('magie-du-sang')));
  assert.equal(rendues.length, LIGNES_PIEGEUSES.length);
  LIGNES_PIEGEUSES.forEach((texte, i) => {
    const lignes = texte.split('\n').map(bord);
    assert.deepEqual(rendues[i].blocs, blocsDeLignes(lignes), `texte ${JSON.stringify(texte)}`);
  });
});

test('--verifier : deux lignes fusionnées en une, un paragraphe de puces, une ligne vide retirée ou ajoutée sont des écarts (code 1)', () => {
  const { dump, r, f, original } = pageAvecNoteLignes();
  const mutations = [
    ['lignes fusionnées', 'Premier paragraphe,  \nsuite du premier.', 'Premier paragraphe, suite du premier.', /altérée/],
    ['puces fusionnées en un paragraphe', '- une puce\n- une autre  \nsa suite', '- une puce - une autre sa suite', /altérée/],
    ['ligne vide retirée entre les paragraphes', 'suite du premier.\n\n- une puce', 'suite du premier.\n- une puce', /altérée/],
    ['ligne vide ajoutée dans la liste', '- une puce\n- une autre', '- une puce\n\n- une autre', /altérée/],
    ['ligne vide en double', 'sa suite\n\nDernier', 'sa suite\n\n\nDernier', /altérée/],
    ['ligne en trop', 'Dernier paragraphe.', 'Dernier paragraphe.\nUne ligne de plus.', /altérée/],
    ['ligne retirée', 'Premier paragraphe,  \nsuite du premier.', 'suite du premier.', /altérée/],
    ['ligne vide retirée entre le libellé et le texte', '« Éclair »**\n\nPremier', '« Éclair »**\nPremier', /libellé doit être suivi d'une ligne vide/],
    ['ligne vide ajoutée entre le libellé et le texte', '« Éclair »**\n\nPremier', '« Éclair »**\n\n\nPremier', /altérée/],
  ];
  for (const [nom, avant, apres, motif] of mutations) {
    assert.ok(original.includes(avant), nom);
    writeFileSync(f, original.replace(avant, apres));
    const v = verifie(r, dump);
    assert.equal(v.status, 1, `${nom} : non vu par --verifier`);
    assert.match(v.stderr, motif, nom);
  }
  writeFileSync(f, original);
  assert.equal(verifie(r, dump).status, 0, 'la page d\'origine est de nouveau conforme');
});

test('--verifier : un saut de ligne forcé retiré, une puce échappée, une ligne qui deviendrait un titre ou un filet sont des écarts (Markdown fusionnerait ou transformerait)', () => {
  const { dump, r, f, original } = pageAvecNoteLignes();
  const mutations = [
    ['saut de ligne forcé retiré (deux lignes de paragraphe)', 'Premier paragraphe,  \nsuite', 'Premier paragraphe,\nsuite', /saut de ligne forcé/],
    ['saut de ligne forcé retiré (suite de puce)', '- une autre  \nsa suite', '- une autre\nsa suite', /saut de ligne forcé/],
    ['puce échappée : ce ne serait plus une liste', '- une puce\n- une autre', '\\- une puce\n- une autre', /puce/],
    ['puce ajoutée devant un paragraphe', 'Dernier paragraphe.', '- Dernier paragraphe.', /puce|altérée/],
    ['ligne devenue un titre', 'Dernier paragraphe.', '# Dernier paragraphe.', /Markdown|altérée/],
  ];
  for (const [nom, avant, apres, motif] of mutations) {
    assert.ok(original.includes(avant), nom);
    writeFileSync(f, original.replace(avant, apres));
    const v = verifie(r, dump);
    assert.equal(v.status, 1, `${nom} : non vu par --verifier`);
    assert.match(v.stderr, motif, nom);
  }
  writeFileSync(f, original);
  assert.equal(verifie(r, dump).status, 0, 'la page d\'origine est de nouveau conforme');
});

test('--verifier : un titre ou un filet laissé sans échappement dans le texte d\'une note est refusé même si le texte relu est identique', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = '# pas un titre\n--- \n1. pas une liste';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  const f = join(r.out, 'magies', 'magie-du-sang.md');
  const original = readFileSync(f, 'utf8');
  for (const [nom, avant, apres] of [['titre', '\\# pas un titre', '# pas un titre'], ['filet', '\\---', '---'], ['liste', '1\\. pas une liste', '1. pas une liste']]) {
    assert.ok(original.includes(avant), nom);
    writeFileSync(f, original.replace(avant, apres));
    const v = verifie(r, dump);
    assert.equal(v.status, 1, `${nom} : non vu par --verifier`);
    assert.match(v.stderr, /Markdown/, nom);
  }
});

test('synthétique : un fil qui ne diffère de la note que par ses retours à la ligne n\'est pas un doublon (cité), un fil aux espaces répétés près l\'est', () => {
  const dump = classeur();
  const c = cellule(dump, 'Sang', BJ4);
  c.note = 'Une règle,\nsur deux lignes.';
  c.threads = [{ text: 'Une règle, sur deux lignes.', done: true }, { text: 'Une   règle,\nsur  deux lignes.', done: true }, { text: '  Une règle,  \n sur deux lignes.\n\n' }];
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => [e.genre, e.lignes]), [
    ['Note', ['Une règle,', 'sur deux lignes.']],
    ['Commentaire résolu', ['Une règle, sur deux lignes.']],
  ]);
  assert.match(r.stdout, /2 fil\(s\) identique\(s\)/);
  assert.equal(verifie(r, dump).status, 0);
});

test('synthétique : les blancs de début ou de fin de ligne que la page ne porte pas sont signalés dans le rapport (mots et lignes inchangés)', () => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = 'Exemple : \nsuite  \nfin';
  cellule(dump, 'Sang', BJ7).note = ' commence par une espace.';
  cellule(dump, 'Feu', BJ4).note = 'Rien à signaler,  \nsaut déjà forcé.';
  const r = lancer({ dump });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /RAPPORT blancs de début ou de fin de ligne non portés/);
  assert.match(r.stdout, /Sang BJ4 \(Note\) : fin de la ligne 1/);
  assert.match(r.stdout, /Sang BJ7 \(Note\) : début de la ligne 1/);
  assert.doesNotMatch(r.stdout, /Sang BJ4 \(Note\) : [^\n]*ligne 2/, 'deux espaces avant une ligne de texte : le saut forcé de la page les porte');
  assert.doesNotMatch(r.stdout, /Feu BJ4/);
  assert.deepEqual(entrees(r.page('magie-du-sang')).map((e) => e.lignes), [['Exemple :', 'suite', 'fin'], ['commence par une espace.']]);
  const propre = lancer({ dump: avecNotes() });
  assert.doesNotMatch(propre.stdout, /blancs de début ou de fin/);
});

// --- copie de contrôle exportée par l'extracteur ---------------------------------------------------------------------------------------

test('--exporter-commentaires : la copie de contrôle est tirée du dump (lignes, colonne, sort, cellule), sans écrire de page', (t) => {
  const dump = classeur();
  cellule(dump, 'Sang', BJ4).note = NOTE_LIGNES;
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'Un fil.', done: true }, { text: NOTE_LIGNES }];
  cellule(dump, 'Feu', BJ7).threads = [{ text: 'Autre fil \n\n\nsuite' }];
  const dir = dossierTemporaire('magies-export', { t });
  writeFileSync(join(dir, 'magie-v8.json'), JSON.stringify(dump));
  const sortie = join(dir, 'reference.json');
  const r = spawnSync('python3', ['-I', script, '--dump', join(dir, 'magie-v8.json'), '--sans-formats', '--exporter-commentaires', sortie], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(sortie));
  assert.ok(!existsSync(join(dir, 'magies')), 'aucune page écrite');
  const { entrees: copie } = JSON.parse(readFileSync(sortie, 'utf8'));
  assert.deepEqual(copie, [
    { page: 'magie-du-sang', onglet: 'Sang', genre: 'Note', cellule: 'BJ4', colonne: 'Effets secondaires', sort: 'Éclair', lignes: NOTE_LIGNES.split('\n').map(bord) },
    { page: 'magie-du-sang', onglet: 'Sang', genre: 'Commentaire résolu', cellule: 'BJ4', colonne: 'Effets secondaires', sort: 'Éclair', lignes: ['Un fil.'] },
    { page: 'magie-du-feu', onglet: 'Feu', genre: 'Commentaire', cellule: 'BJ7', colonne: 'Effets secondaires', sort: 'Bouclier', lignes: ['Autre fil ', '', '', 'suite'] },
  ]);
  // la même copie, relue deux fois, est identique (idempotence)
  const r2 = spawnSync('python3', ['-I', script, '--dump', join(dir, 'magie-v8.json'), '--sans-formats', '--exporter-commentaires', sortie], { encoding: 'utf8' });
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8')).entrees, copie);
});

test('--exporter-commentaires : une note sans place (cellule vide) est refusée, rien n\'est écrit', (t) => {
  const dump = classeur();
  ajoute(dump, 'Sang', { r: 5, c: 62, v: '', note: 'Sans texte à côté' });
  const dir = dossierTemporaire('magies-export', { t });
  writeFileSync(join(dir, 'magie-v8.json'), JSON.stringify(dump));
  const sortie = join(dir, 'reference.json');
  const r = spawnSync('python3', ['-I', script, '--dump', join(dir, 'magie-v8.json'), '--sans-formats', '--exporter-commentaires', sortie], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /BJ5/);
  assert.ok(!existsSync(sortie));
});

// --- facultatif : le vrai dump (hors dépôt) ---------------------------------------------------------------------------------------------
//   MAGIES_DUMP=<magie-v8.json avec notes> [MAGIES_FICHE=<fiche-auto-v15.json>] [MAGIES_XLSX=<classeur.xlsx>] node --test test/magies-notes.test.mjs
const dumpReel = process.env.MAGIES_DUMP;
const sansDump = !dumpReel && 'MAGIES_DUMP non défini (dump hors dépôt)';

test('magies.py --verifier : les pages du dépôt sont celles que le vrai dump produit, les 85 notes et 31 fils retrouvés ligne par ligne (MAGIES_DUMP)', { skip: sansDump }, () => {
  const fiche = process.env.MAGIES_FICHE ? ['--fiche', process.env.MAGIES_FICHE] : [];
  const r = spawnSync('python3', ['-I', script, '--dump', dumpReel, ...fiche, '--out', racineWiki, '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /vérification : OK \(15 pages\)/);
});

test('magies.py --exporter-commentaires sur le vrai dump : la copie de contrôle du dépôt est à jour (MAGIES_DUMP)', { skip: sansDump }, (t) => {
  const dir = dossierTemporaire('magies-reel', { t });
  const sortie = join(dir, 'reference.json');
  const r = spawnSync('python3', ['-I', script, '--dump', dumpReel, ...(process.env.MAGIES_XLSX ? ['--xlsx', process.env.MAGIES_XLSX] : []), '--exporter-commentaires', sortie], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(sortie, 'utf8'), readFileSync(fichierReference, 'utf8'), `copie de contrôle périmée : ${REGENERER}`);
});

test('les pages écrites sont identiques à la seconde exécution (idempotence)', () => {
  const dump = avecNotes();
  cellule(dump, 'Sang', BJ4).threads = [{ text: 'Un fil.', done: true }];
  const a = lancer({ dump });
  const avant = readFileSync(join(a.out, 'magies', 'magie-du-sang.md'), 'utf8');
  const b = lancer({ dump, sortie: a.out });
  assert.equal(b.status, 0, b.stderr);
  assert.equal(readFileSync(join(a.out, 'magies', 'magie-du-sang.md'), 'utf8'), avant);
  assert.equal(compte(avant, '**Note de la cellule'), 2);
});
