// Le rendu des lignes du journal en conflit sur la page « Mise à jour » du site de dev (src/lib/conflits-rendu.mjs ; demande du propriétaire du
// 2026-10-22 : « Après les listes de modifications, montrer les lignes en conflits. 1. Pour chaque conflit, montrer les deux versions 2. Laisser le
// choix entre 1, 2, ou 3 pour saisir à la main ce qui remplace les deux. »).
// Le diagnostic lu est celui du service sur le scénario de test/serveur-edition-conflits.test.mjs (GET /api/mise-a-jour/conflits/ : trois pages du guide
// modifiées sur le site de dev puis réécrites ou retirées par les règles livrées, le bonus du forgeron, une référence rompue, une forme d'avant la 0044,
// un mot-clé supprimé sur le site de dev que les règles posent sur un sort, un métier renommé des deux bords),
// enregistré dans test/fixtures/conflits-diagnostic.json, ses longs textes raccourcis (début et fin gardés).
//   node --test test/conflits-rendu.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import {
  colonnesDeLaSaine, corpsDeLaResolution, erreurDeSaisie, htmlDeLaSaisie, htmlDesConflits, htmlDuConflit, htmlDuLot, instantLisible, libelleDuChoix, messageDeResolution,
  avecDateLisible, lotLisible, optionsDeLaSaisie, origineDeLaValeur, raisonDuChoix, raisonDuConflit, texteDeLaVersion, texteDeValeur, titreDeLaVersion,
} from '../src/lib/conflits-rendu.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { htmlAvecMotsCles } from '../src/lib/mots-cles-balises.mjs';
import { fauteDeFormeDeLUrl } from '../src/lib/mots-cles-liens.mjs';
import { nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';

const DIAG = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic.json', import.meta.url), 'utf8'));
// le diagnostic d'un lot gardé (fusion à trois voies ambiguë : la valeur du site en place), d'un lot retenu derrière lui et d'un champ court
// (serveur-edition-fusion.test.mjs, tech-back) : on n'y lit que la structure et les provenances, jamais le contenu des textes
const GARDE = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic-garde.json', import.meta.url), 'utf8'));
const lotDe = (resume) => DIAG.lots.find((l) => l.resume.startsWith(resume));
const MAGIE = lotDe('Page La magie en jeu');
const HYPER = lotDe('Page Le Mode Hyper');
const FORGERON = lotDe('Métier Forgeron : Bonus');
const ALIAS = lotDe('Alias');
/** Le texte visible d'un HTML (balises retirées, entités courantes décodées). */
const texte = (html) => html.replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('le diagnostic enregistré a la forme du service (lots, saines, conflits, choix permis)', () => {
  assert.equal(DIAG.lots.length, 8);
  for (const l of DIAG.lots) {
    assert.ok(l.lot && l.empreinte && Array.isArray(l.saines) && l.conflits.length, l.lot);
    for (const c of l.conflits) assert.ok(c.id && c.genre && c.version_1 && c.version_2 && c.choix_possibles.length, `${l.lot} ${c.id}`);
  }
});

test('une page du guide modifiée puis réécrite : seulement les différences, les deux versions entières repliées, d’où vient chacune, les trois choix', () => {
  const c = MAGIE.conflits[0];
  const html = htmlDuConflit(c, 0, { faitLe: MAGIE.fait_le });
  // version 1 : modifiée sur le site de dev (par ce lot, daté) ; version 2 : la valeur actuelle, dont le titre dit la provenance (demande du 2026-11-07)
  const entieres = html.match(/<details class="nv-conflit__entieres">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(entieres, 'les deux versions entières, dans un bloc fermé');
  const versions = [...entieres.matchAll(/<div class="nv-version nv-version--(\d)"><h5 class="nv-version__titre">([^<]+)<\/h5><div class="nv-version__texte">([\s\S]*?)<\/div><\/div>/g)];
  assert.deepEqual(versions.map((m) => [m[1], m[2]]), [['1', titreDeLaVersion(1, c, MAGIE.fait_le)], ['2', titreDeLaVersion(2, c)]]);
  assert.ok(titreDeLaVersion(1, c).includes(instantLisible(c.provenance_1.fait_le)), 'la version 1 datée par son lot');
  assert.match(titreDeLaVersion(1, c), /site de dev/);
  assert.ok(titreDeLaVersion(2, c).endsWith(origineDeLaValeur(c.provenance_2)), 'la version 2 dit sa provenance');
  assert.equal(texte(versions[0][3]), c.version_1.valeur, 'le texte long, lisible en entier');
  assert.equal(texte(versions[1][3]), c.version_2.valeur);
  assert.match(texte(versions[0][3]), /Paragraphe ajouté sur le site de dev/);
  // le Markdown se lit tel quel : aucune balise venue du texte, et l'aperçu HTML de l'éditeur n'est pas posé
  assert.doesNotMatch(versions[0][3], /<(?!\/?(?:del|ins)>)/);
  assert.doesNotMatch(html, /aperçu 0/);
  // les différences mot à mot (barré : la version 2 seulement ; en gras : la version 1 seulement), montrées d'office, avant les versions entières
  const diff = html.match(/<div class="nv-conflit__differences">[\s\S]*?<div class="nv-diff">([\s\S]*?)<\/div><\/div><details class="nv-conflit__entieres">/)?.[1];
  assert.ok(diff, 'les différences');
  assert.match(diff, /<ins>[^<]*Paragraphe/);
  assert.match(diff, /<del>[^<]*réécrite/);
  // les trois choix permis ; la saisie du 3 suit le type (markdown : une zone de texte, la version 1 en départ), cachée tant que 3 n'est pas choisi
  assert.deepEqual([...html.matchAll(/<input type="radio" id="nv-conflit-0-choix-(\d)" name="nv-conflit-0" value="\d" data-nv-choix( disabled)?>/g)].map((m) => [m[1], Boolean(m[2])]),
    [['1', false], ['2', false], ['3', false]]);
  assert.match(html, /<div class="nv-conflit__saisie" data-nv-saisie hidden><label for="nv-conflit-0-valeur">Texte <span class="nv-conflit__aide">\(obligatoire, Markdown de la page, comme dans l’éditeur\)<\/span><\/label><textarea id="nv-conflit-0-valeur" data-nv-valeur/);
  assert.equal(texte(html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1]), c.version_1.valeur);
  assert.match(html, /<legend>Page « La magie en jeu » — Texte <span class="nv-conflit__operation">modification<\/span><\/legend>/);
  assert.match(html, /<p class="nv-conflit__raison">les règles ont changé « Texte » autrement<\/p>/, 'la raison lisible, jamais la trace');
});

// Demande du propriétaire du 2026-11-07 (« ne se limite qu'à la différence entre les deux ») : un long texte dont un seul paragraphe change ne montre que
// ce paragraphe et un peu de contexte ; le reste, identique, est replié (lib/diff-replie.mjs), et rien n'est perdu.
test('un long texte en conflit : seulement le passage qui change, les passages identiques repliés, les deux versions entières dans un bloc fermé', () => {
  const c = structuredClone(MAGIE.conflits[0]);
  const paragraphes = Array.from({ length: 40 }, (_, i) => `Paragraphe ${i} identique aux deux versions, assez long pour peser dans la page.`);
  c.version_2.valeur = paragraphes.join('\n');
  c.version_1.valeur = paragraphes.map((p, i) => (i === 20 ? `${p} Phrase ajoutée.` : p)).join('\n');
  const html = htmlDuConflit(c, 0, { faitLe: MAGIE.fait_le });
  const bloc = html.match(/<div class="nv-conflit__differences">([\s\S]*?)<\/div><\/div><details class="nv-conflit__entieres">/)?.[1];
  assert.ok(bloc, 'les différences, montrées d’office');
  const diff = bloc.slice(bloc.indexOf('<div class="nv-diff">'));
  const replies = [...diff.matchAll(/<details class="nv-diff__replie"><summary>[^<]*<\/summary>([^<]*)<\/details>/g)].map((m) => m[1]);
  assert.equal(replies.length, 2, 'avant et après le changement');
  // hors des passages repliés : le paragraphe changé et ses voisins, pas plus
  const visible = texte(diff.replace(/<details class="nv-diff__replie">[\s\S]*?<\/details>/g, ''));
  assert.match(visible, /Paragraphe 20 /);
  assert.match(visible, /Paragraphe 19 /);
  assert.match(visible, /Paragraphe 21 /);
  assert.doesNotMatch(visible, /Paragraphe (?:[0-9]|1[0-8]|2[2-9]|3\d) /);
  assert.ok(visible.length < c.version_1.valeur.length / 5, 'bien plus court que le texte entier');
  assert.match(diff, /<ins>[^<]*Phrase ajoutée\.<\/ins>/);
  // rien n'est perdu : visible + replié redonnent la version 1 ; les deux versions entières restent lisibles dans leur bloc fermé
  assert.equal(texte(diff.replace(/<summary>[^<]*<\/summary>/g, '').replace(/<del>[^<]*<\/del>/g, '')), c.version_1.valeur);
  assert.ok(texte(html).includes(c.version_1.valeur) && texte(html).includes(c.version_2.valeur));
});

test('deux textes identiques : les deux versions côte à côte, sans bloc de différences', () => {
  const c = structuredClone(MAGIE.conflits[0]);
  c.version_2.valeur = c.version_1.valeur;
  c.valeur_2 = structuredClone(c.version_2); // chaque choix laisse sa version entière (pas de fusion)
  const html = htmlDuConflit(c, 0);
  assert.doesNotMatch(html, /nv-conflit__differences|nv-conflit__entieres/);
  assert.equal([...html.matchAll(/<div class="nv-version nv-version--\d">/g)].length, 2);
});

// R164 : une balise de plusieurs mots posée sur le site de dev autour d'un texte que les règles livrées ont gardé (« Sort fer ») : les différences
// (lib/notes-de-version-rendu.mjs#diffMots) la gardent entière dans un seul morceau, et le middleware la rend ; aucune « {{ » dans le texte visible.
test('les différences d’un conflit : une balise de plusieurs mots posée autour d’un texte existant reste entière et se rend (R164)', () => {
  const c = structuredClone(MAGIE.conflits[0]);
  c.version_1.valeur = 'Lance des {{sort-fer|sorts "fer"}}, perce les défenses.';
  c.version_2.valeur = 'Lance des sorts "fer", perce les défenses.';
  const diff = htmlDuConflit(c, 0).match(/<div class="nv-diff">([\s\S]*?)<\/div><\/div>/)?.[1];
  assert.ok(diff, 'les différences');
  assert.match(diff, /<ins>\{\{sort-fer\|sorts &quot;fer&quot;\}\},<\/ins>/, 'la balise entière dans un seul <ins>');
  for (const m of diff.match(/<(del|ins)>[^<]*<\/\1>/g)) assert.equal(m.split('{{').length, m.split('}}').length, m);
  const rendu = htmlAvecMotsCles(diff, [{ id: 'sort-fer', libelle: 'Sort fer', description: 'Définition d’essai.' }]);
  assert.deepEqual(rendu.employes, ['sort-fer']);
  assert.ok(!texte(rendu.html).includes('{{'), rendu.html);
});

test('une page retirée des règles : seul le choix 2 (abandonner), la raison dite ; la version 1 reste lisible', () => {
  const c = HYPER.conflits[0];
  assert.equal(c.genre, 'ligne_supprimee');
  const html = htmlDuConflit(c, 4);
  assert.deepEqual([...html.matchAll(/value="(\d)" data-nv-choix( disabled)?>/g)].map((m) => [m[1], Boolean(m[2])]), [['1', true], ['2', false], ['3', true]]);
  assert.match(texte(html), /1 : la version 1 \(le site de dev\) \(la ligne n’existe plus dans les règles livrées \(la version 1 reste lisible ci-dessus, pour la recopier ailleurs\)\)/);
  assert.match(texte(html), /2 : abandonner cette modification \(la valeur actuelle reste\)/);
  assert.match(texte(html), /3 : saisir à la main ce qui remplace les deux \(seul un champ se saisit à la main/);
  assert.doesNotMatch(html, /data-nv-saisie/, 'pas de saisie');
  // une ligne entière face à une ligne supprimée : pas de différences, les deux versions côte à côte, en entier
  assert.doesNotMatch(html, /nv-conflit__differences|nv-conflit__entieres/);
  assert.ok(texte(html).includes(`${titreDeLaVersion(1, c)}${texteDeLaVersion(c.version_1)}`));
  assert.ok(texte(html).includes(`${titreDeLaVersion(2, c)}${texteDeLaVersion(c.version_2)}`));
});

test('une modification sans valeur de champ (référence rompue, forme ancienne) : la raison, et seul le choix 2', () => {
  for (const lot of [ALIAS, lotDe('avant 0044')]) {
    const c = lot.conflits[0];
    assert.equal(c.genre, 'sans_valeur');
    assert.deepEqual([1, 2, 3].map((n) => raisonDuChoix(c, n) === null), [false, true, false]);
    assert.equal(raisonDuChoix(c, 1), 'cette modification ne peut plus s’écrire');
    assert.match(htmlDuConflit(c, 0), /<p class="nv-conflit__raison">[^<]+<\/p>/);
  }
});

test('un champ d’une ligne : la saisie suit le type de la colonne (ligne, entier, réel, choix, liste du service)', () => {
  const c = FORGERON.conflits[0];
  assert.match(htmlDuConflit(c, 2), /<input type="text" id="nv-conflit-2-valeur" data-nv-valeur aria-label="Valeur saisie : Bonus" value="\+3% Esquive">/);
  // la saisie part de `valeur_1` (le résultat du choix 1), ici la version 1 entière
  const champ = (saisie, valeur = '7') => htmlDuConflit({ ...c, saisie, version_1: { genre: 'valeur', valeur }, valeur_1: { genre: 'valeur', valeur } }, 9);
  assert.match(champ({ type: 'entier', libelle: 'Niveau', min: 1, max: 20 }), /<input type="text" inputmode="numeric" id="nv-conflit-9-valeur" data-nv-valeur [^>]*data-min="1" data-max="20" value="7">/);
  assert.match(champ({ type: 'reel', libelle: 'Zoom' }), /inputmode="decimal"/);
  const choix = champ({ type: 'choix', libelle: 'Catégorie', choix: [{ valeur: 'a', libelle: 'A' }, { valeur: 'b', libelle: 'B' }] }, 'b');
  assert.match(choix, /<select id="nv-conflit-9-valeur" data-nv-valeur [^>]*><option value="">—<\/option><option value="a">A<\/option><option value="b" selected>B<\/option><\/select>/);
  // une liste lue dans la base vivante (GET /api/edition/listes/) ; une valeur hors de la liste reste choisie (comme l'éditeur)
  assert.deepEqual(optionsDeLaSaisie({ type: 'choix', liste: 'magies', requis: true }, { magies: [{ valeur: 'feu', libelle: 'Feu' }] }), [{ valeur: 'feu', libelle: 'Feu' }]);
  assert.match(champ({ type: 'choix', liste: 'magies', requis: true }, 'eau'), /<option value="eau" selected>eau<\/option>/);
  assert.match(champ({ type: 'texte', libelle: 'Effet' }, 'a\nb'), /<textarea id="nv-conflit-9-valeur" data-nv-valeur [^>]*rows="3">a\nb<\/textarea>/);
  // une image ne se saisit pas
  assert.equal(raisonDuChoix({ ...c, colonne: 'portrait', saisie: null, choix_possibles: [1, 2] }, 3), 'une image ne se saisit pas ici');
});

test('les raisons des choix refusés par l’édition ou la re-dérivation', () => {
  const c = { ...FORGERON.conflits[0], choix_possibles: [2, 3], refus_1: '« Bonus » : valeur obligatoire' };
  assert.equal(raisonDuChoix(c, 1), 'l’édition refuse aujourd’hui cette valeur : « Bonus » : valeur obligatoire');
  assert.equal(raisonDuChoix({ ...c, choix_possibles: [1, 3], refus_2: 'bonus illisible' }, 2), 'la règle livrée ne se recalcule pas : bonus illisible');
  assert.equal(libelleDuChoix({ genre: 'suppression' }, 1), '1 : la version 1 (supprimer la ligne)');
  assert.equal(libelleDuChoix({ genre: 'champ' }, 2), '2 : la version 2 (la valeur actuelle reste)');
});

test('les versions en texte : valeur, vide, image, liste, ligne, suppression, absente', () => {
  assert.equal(texteDeValeur(null), '(vide)');
  assert.equal(texteDeValeur(''), '(vide)');
  assert.equal(texteDeValeur(['a', 'b']), 'a, b');
  assert.equal(texteDeValeur({ image: true, empreinte: '3f2a', resume: '3f2a (84 Ko)' }), 'image 3f2a (84 Ko)');
  assert.equal(texteDeValeur(3), '3');
  assert.equal(texteDeLaVersion({ genre: 'ligne', valeur: { id: 'x', nom: 'Nom', vide: null } }), 'id : x\nnom : Nom');
  assert.equal(texteDeLaVersion({ genre: 'suppression', valeur: { id: 'x' } }), 'Ligne supprimée par le site de dev. Elle était :\nid : x');
  assert.equal(texteDeLaVersion({ genre: 'absente', valeur: null }), 'Ligne supprimée : elle n’existe plus dans les règles livrées.');
});

test('la section : après les listes, chaque lot avec ses modifications saines, ses conflits et son envoi ; les lots résolus ; rien sans conflit', () => {
  assert.equal(htmlDesConflits({ lots: [], resolus: [] }), '');
  const html = htmlDesConflits(DIAG);
  assert.match(html, /^<h3 class="nv-conflits__titre">Lignes en conflit<\/h3><p>8 lots du site de dev sont en conflit avec les règles livrées depuis : ils ne partent pas avec cette mise à jour\./);
  assert.equal((html.match(/<form class="nv-conflit-lot"/g) ?? []).length, 8);
  assert.equal((html.match(/<fieldset class="nv-conflit"/g) ?? []).length, DIAG.lots.reduce((n, l) => n + l.conflits.length, 0));
  // des identifiants uniques dans la page
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  // les modifications saines du lot de la magie : la description du forgeron repart, sa page est recalculée
  const magie = html.slice(html.indexOf(`data-nv-lot="${MAGIE.lot}"`));
  assert.match(texte(magie), /2 modifications saines de ce lot \(sans conflit\)Métier « Forgeron » modification : repartira telle quellePage « Forgeron » modification : recalculée d’après sa source/);
  assert.match(texte(html), /Aucune modification saine dans ce lot : seulement les conflits ci-dessous\./);
  assert.match(html, new RegExp(`<form class="nv-conflit-lot" id="nv-lot-\\d+" data-nv-lot="${MAGIE.lot}" data-nv-empreinte="${MAGIE.empreinte}">`));
  assert.match(html, /<button type="submit" class="nv-principal">Résoudre ce lot<\/button>/);
  // les lots résolus
  const resolus = htmlDesConflits({ lots: [], resolus: [
    { lot: 'L1', fait_le: '2026-10-21T08:00:00Z', resume: 'Page X', resolu_le: '2026-10-22T20:00:00Z', resolu_par: 'L9', resolution: [] },
    { lot: 'L2', fait_le: '2026-10-21T08:00:00Z', resume: 'Page Y', resolu_le: '2026-10-22T20:00:00Z', resolu_par: null, resolution: [] },
  ] });
  assert.match(resolus, /<p>Aucun lot en conflit à résoudre\.<\/p><details class="nv-conflits__resolus"><summary>Lots en conflit déjà résolus \(2\)<\/summary>/);
  assert.match(texte(resolus), /par une nouvelle modification \(lot L9\)/);
  assert.match(texte(resolus), /sans rien écrire \(tout au choix 2 : la valeur actuelle reste\)/);
});

test('la raison du rejeu d’un lot se lit comme la légende de ses conflits : ni l’id du lot, ni clé JSON, ni nom de colonne', () => {
  const auRejeu = (lot) => texte(htmlDuLot(lot)).match(/Au rejeu : (.*)/)?.[1];
  assert.equal(auRejeu(FORGERON), 'Métier « Forgeron » : les règles ont changé « Bonus » autrement');
  assert.ok(auRejeu(FORGERON).startsWith(FORGERON.conflits[0].libelle), 'la ligne nommée comme la légende de son conflit');
  assert.ok(auRejeu(FORGERON).includes(`« ${FORGERON.conflits[0].colonne_libelle} »`), 'la colonne par son libellé');
  assert.equal(auRejeu(MAGIE), 'Page « La magie en jeu » : les règles ont changé « Texte » autrement');
  assert.equal(auRejeu(ALIAS), 'Autre nom de la page : clé étrangère rompue vers Page');
  for (const lot of DIAG.lots) {
    const t = auRejeu(lot);
    assert.equal(t, lot.detail_lisible, lot.lot);
    assert.notEqual(t, lot.detail, `${lot.lot} : jamais la trace telle quelle`);
    assert.ok(!t.includes(lot.lot) && !t.startsWith('lot '), `${lot.lot} : sans l’id du lot`);
    assert.doesNotMatch(t, /\b(corps_md|bonus_brut)\b/, `${lot.lot} : sans nom de colonne technique`);
    // une clé JSON n'apparaît que si la légende de son conflit la montre déjà (même nom que la légende)
    const horsLegendes = lot.conflits.reduce((r, c) => r.replaceAll(c.libelle, ''), t);
    assert.doesNotMatch(horsLegendes, /\{"/, `${lot.lot} : sans JSON hors légende`);
  }
  // sans texte lisible, la trace n'est pas montrée à sa place
  assert.doesNotMatch(htmlDuLot({ ...FORGERON, detail_lisible: null }), /Au rejeu|nv-conflit-lot__detail/);
});

/**
 * Les noms de colonnes techniques qui ont un libellé dans le modèle (lib/edition-modele.mjs#TABLES, que la page n'importe pas : le service donne les
 * libellés) : ceux qui ne peuvent pas se lire comme un mot de la phrase (un « _ » : corps_md, bonus_brut, capacite_commune_id…).
 */
const TECHNIQUES = [...new Set(Object.values(TABLES).flatMap((t) => Object.entries(t.colonnes).filter(([c, ch]) => c.includes('_') && ch?.libelle && ch.libelle !== c).map(([c]) => c)))];
const techniquesDans = (t) => TECHNIQUES.filter((c) => new RegExp(`(^|[^a-z0-9_])${c}($|[^a-z0-9_])`).test(t));
/** Le HTML sans le texte des versions 1 et 2 (le contenu écrit par le site de dev ou les règles, vérifié à part). */
const sansLesVersions = (html) => html.replace(/<div class="nv-version__texte">[\s\S]*?<\/div>/g, '');

/**
 * Les noms techniques du schéma (data/schema.sql) qui ne se lisent pas comme un mot : chaque table et chaque colonne à « _ » (metier_bonus, corps_md,
 * page_id, capacite_commune_id…). Demande du propriétaire du 2026-10-23 (« Un vrai nom serai mieux ») : aucun dans la section, versions comprises.
 */
const NOMS_DU_SCHEMA = (() => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const noms = new Set([...tables, ...tables.flatMap((t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name))].filter((n) => n.includes('_')));
  db.close();
  return noms;
})();
/** Les noms du schéma lus dans un texte, même collés au mot d'avant (le texte d'un HTML sans ses balises : « écrit » + « page_id » → « écritpage_id »). */
const nomsDuSchemaDans = (t) => [...new Set((String(t).match(/[a-z0-9]+(?:_[a-z0-9]+)+/g) ?? []).flatMap((m) => [...NOMS_DU_SCHEMA].filter((n) => m.endsWith(n))))];
/**
 * Les noms de tables du schéma dits comme un mot, mots sans « _ » compris (« invocation », « lien », « page ») : comparés à la liste exacte des tables,
 * après avoir retiré du texte les vrais noms du registre (« Étiquette du sort ») et les valeurs entre guillemets (le nom d'une ligne) ; un id (« / »,
 * « - », « # ») n'en est pas un. Pour les textes du service hors du contenu des versions (relecture du 2026-10-23 : « sort_mot_cle », mais aussi une
 * table d'un seul mot, seraient passés).
 */
const { TABLES_DU_SCHEMA, NOMS_AFFICHES } = (() => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../data/schema.sql', import.meta.url), 'utf8'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const noms = new Set(tables.flatMap((t) => [nomDeTable(t), ...db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => nomDeColonne(t, c.name))]).filter(Boolean));
  db.close();
  return { TABLES_DU_SCHEMA: new Set(tables), NOMS_AFFICHES: [...noms].sort((a, b) => b.length - a.length) };
})();
const tablesDans = (t) => NOMS_AFFICHES.reduce((x, n) => x.split(n).join(' '), String(t ?? '')).replace(/«[^«»]*»/g, ' ')
  .split(/[\s,;()«»"]+/).map((m) => m.replace(/[:.]+$/, '')).filter((m) => TABLES_DU_SCHEMA.has(m));
/** Les versions faites d'une ligne (entière, ses valeurs, supprimée) du diagnostic : [lot, conflit, version]. */
const VERSIONS_EN_LIGNES = DIAG.lots.flatMap((l) => l.conflits.flatMap((c) => [c.version_1, c.version_2].map((v) => [l, c, v])))
  .filter(([, , v]) => ['ligne', 'valeurs', 'suppression'].includes(v?.genre) && v.valeur);

test('la section se lit sans nom technique : légendes, raisons, saines, rejeu sans JSON ni nom de colonne qui a un libellé (fixture du service)', () => {
  assert.ok(TECHNIQUES.includes('corps_md') && TECHNIQUES.includes('bonus_brut'), 'les noms cherchés');
  const html = htmlDesConflits(DIAG);
  // aucun JSON nulle part dans la section, versions comprises
  assert.doesNotMatch(texte(html), /\{"|"\}/);
  // hors du contenu des versions : aucun nom de colonne qui a un libellé
  assert.deepEqual(techniquesDans(texte(sansLesVersions(html))), []);
  for (const lot of DIAG.lots) {
    for (const c of lot.conflits) {
      const h = htmlDuConflit(c, 0);
      const legende = texte(h.match(/<legend>([\s\S]*?)<\/legend>/)[1]);
      assert.doesNotMatch(legende, /[{}"]/, `${lot.lot} ${c.id} : légende sans JSON`);
      assert.ok(legende.startsWith(c.libelle), `${lot.lot} ${c.id} : la légende du service`);
      // la raison sous la légende : le texte lisible du service, jamais la trace quand elle en diffère
      const raison = texte(h.match(/<p class="nv-conflit__raison">([\s\S]*?)<\/p>/)?.[1] ?? '');
      assert.equal(raison, c.raison_lisible ?? '', `${lot.lot} ${c.id}`);
      assert.deepEqual(techniquesDans(raison), [], `${lot.lot} ${c.id} : raison sans nom technique`);
      // une ligne entière dont le service nomme les colonnes : par leurs libellés
      for (const v of [c.version_1, c.version_2]) if (v?.libelles) assert.deepEqual(techniquesDans(texteDeLaVersion(v)), [], `${lot.lot} ${c.id}`);
    }
    for (const s of lot.saines) assert.doesNotMatch(s.libelle, /[{}"]/, `${lot.lot} saine ${s.rang} : sans JSON`);
  }
  // la clé composée d'une capacité de carte : la carte nommée, « n° N » (point 3 de la relecture)
  assert.match(texte(html), /Capacité de la carte « Amblypyge de brai », n° 1/);
  assert.match(texte(html), /Autre nom de la page : clé étrangère rompue vers Page guide\/le-mode-hyper/);
});

test('un vrai nom partout (demande du 2026-10-23) : aucun nom de table ni de colonne du schéma dans la section, versions ligne entière comprises', () => {
  assert.ok(NOMS_DU_SCHEMA.has('metier_bonus') && NOMS_DU_SCHEMA.has('page_id') && NOMS_DU_SCHEMA.has('capacite_commune_id'), 'les noms cherchés');
  const html = htmlDesConflits(DIAG);
  // toute la section, le contenu des versions compris : ni nom du schéma à « _ », ni JSON, ni les tables « alias » et « metier_bonus » sous leur nom
  assert.deepEqual(nomsDuSchemaDans(texte(html)), []);
  assert.doesNotMatch(texte(html), /\{"|"\}|":/);
  assert.doesNotMatch(texte(html), /\balias\b|metier_bonus/);
  assert.match(texte(html), /Bonus du métier « Forgeron », n° 1, option 2/);
  assert.match(texte(html), /Autre nom de la page guide\/le-mode-hyper, ordre 900/);
  assert.doesNotMatch(texte(html), /\((?:Métier|Page) /, 'la ligne citée sans parenthèses ni nom de sa table (demande du propriétaire du 2026-10-23)');
  // les textes du service hors du contenu des versions : aucune table du schéma, même d'un seul mot (la liste exacte)
  for (const l of DIAG.lots) {
    const textes = [l.detail_lisible, ...l.saines.flatMap((x) => [x.libelle, ...(x.colonnes_libelles ?? [])]),
      ...l.conflits.flatMap((c) => [c.libelle, c.colonne_libelle, c.raison_lisible, ...[c.version_1, c.version_2].flatMap((v) => Object.values(v?.libelles ?? {}))])];
    for (const t of textes) assert.deepEqual(tablesDans(t), [], `${l.lot} : « ${t} »`);
  }
  assert.deepEqual(tablesDans('sort_mot_cle : clé étrangère rompue vers Mot-clé ; invocation, lien'), ['sort_mot_cle', 'invocation', 'lien'], 'la garde les voit');
  // la rupture « enfant » (la table qui cite, par son nom) et le renommage des deux bords (sans la clé normalisée)
  assert.match(texte(html), /Étiquette du sort : clé étrangère rompue vers Mot-clé \d+/);
  assert.match(texte(html), /Au rejeu : Métier « Acrobate des règles \(essai des conflits\) » : les règles ont changé « Nom » autrement/);
  // chaque version faite d'une ligne : ses colonnes par le nom que donne le service, jamais leur nom technique devant « : »
  assert.ok(VERSIONS_EN_LIGNES.some(([, c]) => c.table === 'alias') && VERSIONS_EN_LIGNES.some(([, c]) => c.table === 'monstre_capacite'), 'les lignes du scénario');
  for (const [l, c, v] of VERSIONS_EN_LIGNES) {
    assert.ok(v.libelles, `${l.lot} ${c.id} : le service nomme les colonnes`);
    const t = texteDeLaVersion(v);
    assert.deepEqual(nomsDuSchemaDans(t), [], `${l.lot} ${c.id}`);
    for (const [col, x] of Object.entries(v.valeur)) {
      if (x === null || x === undefined || x === '') continue;
      assert.ok(t.includes(`${v.libelles[col]} : `), `${l.lot} ${c.id} : « ${v.libelles[col]} » montré`);
      if (v.libelles[col] !== col) assert.doesNotMatch(t, new RegExp(`(^|\\n)${col} : `), `${l.lot} ${c.id} : jamais « ${col} »`);
    }
  }
  // la ligne entière d'un autre nom de page : son texte complet, ni clé normalisée ni provenance
  const alias = VERSIONS_EN_LIGNES.find(([, c]) => c.table === 'alias')[2];
  assert.equal(texteDeLaVersion(alias), 'Page : guide/le-mode-hyper\nOrdre : 900\nAutre nom : Alias du site de dev (essai des conflits)');
  // la capacité de la carte dans les règles livrées : chaque colonne non vide par son nom
  const capacite = DIAG.lots.find((l) => l.resume === 'avant 0044').conflits[0].version_2;
  assert.match(texteDeLaVersion(capacite), /^Monstre : monstres\/amblypyge-noir#carte:amblypyge-de-brai\nRang : 1\nCapacité : carapace-huileuse$/);
});

test('raison, colonnes des saines, ligne entière : les textes du service, avec repli sur l’ancien champ (réponse ancienne)', () => {
  const c = MAGIE.conflits[0];
  assert.equal(raisonDuConflit(c), 'les règles ont changé « Texte » autrement');
  assert.equal(raisonDuConflit({ ...c, raison_lisible: undefined }), 'les règles ont changé corps_md autrement', 'réponse ancienne : la trace');
  assert.equal(raisonDuConflit({ raison: null }), null);
  assert.doesNotMatch(htmlDuConflit({ ...c, raison: null, raison_lisible: null }, 0), /nv-conflit__raison/);
  // une saine partielle : ses colonnes par leurs libellés
  const saine = { rang: 2, table: 'metier', cle: { id: 'metiers/x' }, operation: 'modifier', libelle: 'Métier « X »', issue: 'reappliquee', colonnes: ['remarque', 'bonus_brut'], colonnes_libelles: ['Remarque', 'Bonus'] };
  assert.deepEqual(colonnesDeLaSaine(saine), ['Remarque', 'Bonus']);
  assert.deepEqual(colonnesDeLaSaine({ ...saine, colonnes_libelles: undefined }), ['remarque', 'bonus_brut'], 'réponse ancienne : les noms');
  assert.deepEqual(colonnesDeLaSaine({ ...saine, colonnes: undefined, colonnes_libelles: undefined }), []);
  const lot = { ...FORGERON, saines: [saine] };
  assert.match(texte(htmlDuLot(lot)), /1 modification saine de ce lot \(sans conflit\)Métier « X » \(Remarque, Bonus\) modification : repartira telle quelle/);
  assert.doesNotMatch(texte(htmlDuLot(lot)), /bonus_brut|remarque,/);
  // une ligne entière : les colonnes que le service nomme, par leur nom ; une colonne qu'il ne nomme pas ne s'affiche pas (jamais sous son nom
  // technique) ; sans `libelles` (réponse ancienne), chaque colonne sous son nom ; une valeur objet sans JSON
  assert.equal(texteDeLaVersion({ genre: 'ligne', valeur: { capacite_commune_id: 'carapace-huileuse', rang: 1 }, libelles: { capacite_commune_id: 'Capacité' } }), 'Capacité : carapace-huileuse');
  assert.equal(texteDeLaVersion({ genre: 'valeurs', valeur: { cle: 'x', origine: 'import' }, libelles: {} }), '(vide)');
  assert.equal(texteDeLaVersion({ genre: 'ligne', valeur: { capacite_commune_id: 'carapace-huileuse', rang: 1 } }), 'capacite_commune_id : carapace-huileuse\nrang : 1');
  assert.equal(texteDeLaVersion({ genre: 'suppression', valeur: { corps_md: 'x' }, libelles: { corps_md: 'Texte' } }), 'Ligne supprimée par le site de dev. Elle était :\nTexte : x');
  assert.equal(texteDeValeur({ monstre_id: 'monstres/a', rang: 1, vide: null }), 'monstre_id : monstres/a, rang : 1');
  assert.equal(texteDeValeur([{ a: 1 }, 'b']), 'a : 1, b');
  assert.equal(texteDeValeur({}), '(vide)');
});

test('le corps de la résolution : un choix par conflit, la saisie du 3 contrôlée comme l’éditeur', () => {
  const c = FORGERON.conflits[0];
  assert.deepEqual(corpsDeLaResolution(FORGERON, new Map()), { manquants: ['Métier « Forgeron » — Bonus'] });
  assert.deepEqual(corpsDeLaResolution(HYPER, new Map([['1', { choix: 1 }]])), { manquants: ['Page guide/le-mode-hyper'] }, 'un choix impossible ne compte pas');
  assert.deepEqual(corpsDeLaResolution(HYPER, { 1: { choix: 2 } }), { corps: { lot: HYPER.lot, empreinte: HYPER.empreinte, choix: { 1: { choix: 2 } } } });
  assert.deepEqual(corpsDeLaResolution(FORGERON, new Map([[c.id, { choix: 3, valeur: '+4% Parade' }]])).corps.choix, { [c.id]: { choix: 3, valeur: '+4% Parade' } });
  assert.deepEqual(corpsDeLaResolution(FORGERON, new Map([[c.id, { choix: 1 }]])).corps.choix, { [c.id]: { choix: 1 } });
  // la saisie refusée : le message de l'éditeur, sous le conflit
  const requis = { ...MAGIE, conflits: [MAGIE.conflits[0]] };
  assert.deepEqual([...corpsDeLaResolution(requis, new Map([['1:corps_md', { choix: 3, valeur: '  ' }]])).erreurs], [['1:corps_md', '« Texte » : valeur obligatoire']]);
  assert.equal(erreurDeSaisie({ type: 'entier', libelle: 'Niveau', min: 1, max: 20 }, '0'), '« Niveau » : au moins 1');
  assert.equal(erreurDeSaisie({ type: 'entier', libelle: 'Niveau' }, '2,5'), '« Niveau » : nombre entier attendu');
  assert.equal(erreurDeSaisie({ type: 'entier', libelle: 'Niveau', max: 20 }, '+20'), null);
  assert.equal(erreurDeSaisie({ type: 'reel', libelle: 'Zoom', max: 4 }, '4,5'), '« Zoom » : au plus 4');
  assert.equal(erreurDeSaisie({ type: 'reel', libelle: 'Zoom' }, '1,5'), null);
  assert.equal(erreurDeSaisie({ type: 'choix', libelle: 'C', choix: [{ valeur: 'a' }] }, 'z'), '« C » : valeur hors de la liste');
  assert.equal(erreurDeSaisie({ type: 'ligne', libelle: 'Bonus', vide: '' }, ''), null, 'un champ non requis se vide');
});

test('migration 0098 : l’adresse et la couleur d’un mot-clé se saisissent en une ligne, avec leur aide ; une forme impossible est refusée avant l’envoi (le service refait tout)', () => {
  const lien = { type: 'adresse', libelle: 'Lien' };
  const couleur = { type: 'couleur', libelle: 'Couleur' };
  for (const [s, valeur, aide] of [[lien, '/races/humain/', 'depuis sa racine'], [couleur, 'magie:feu', '« #rrggbb »']]) {
    const html = htmlDeLaSaisie({ saisie: s, colonne_libelle: s.libelle, version_1: { genre: 'valeur', valeur } }, 'c1');
    assert.match(html, new RegExp(`<input type="text" id="c1" data-nv-valeur aria-label="[^"]*" value="${valeur.replace(/[/]/g, '\\/')}">`), s.type);
    assert.ok(html.includes(aide), `${s.type} : ${html}`);
  }
  for (const v of ['/races/humain/', '/magies/#relations', '']) assert.equal(erreurDeSaisie(lien, v), null, v);
  for (const v of ['races/humain/', '//hote/x', 'https://example.org/', '/a b', '/a\\b', '/a"b/', "/a'b/", '/a<b/', '/a>b/', '/a`b/', '/x/?q="1"', '/x/#a<b']) {
    assert.match(erreurDeSaisie(lien, v), /^« Lien » : adresse d’une page du site/, v);
  }
  // la même règle de forme que lib/mots-cles-liens.mjs#fauteDeFormeDeLUrl (que ce module n'importe pas : skill site-version-portable), sur chaque
  // caractère ASCII et quelques écritures : refusée ici si et seulement si elle l'est là
  const essais = ['/', '/races/humain/', '/magies/#relations', '/x/?q=1&r=2', '/a b', '/a\tb', '//x', 'x/', '/é/', '/a\\b',
    ...Array.from({ length: 128 }, (_, i) => `/a${String.fromCharCode(i)}b/`)];
  for (const v of essais.filter((x) => x.trim() === x && x)) {
    assert.equal(erreurDeSaisie(lien, v) === null, fauteDeFormeDeLUrl(v) === null, JSON.stringify(v));
  }
  for (const v of ['magie:feu', '#12ab9f', '#12AB9F', 'classe:melee', '']) assert.equal(erreurDeSaisie(couleur, v), null, v);
  for (const v of ['feu', '#12ab9', 'magie:', 'Magie Feu']) assert.match(erreurDeSaisie(couleur, v), /^« Couleur » : « #rrggbb »/, v);
});

test('le message après l’envoi', () => {
  assert.equal(messageDeResolution({ lot: 'L1', nouveau_lot: 'L2', modifications: 3, fiches: [] }),
    'Conflit résolu : une nouvelle modification du site de dev a été enregistrée (3 lignes ; lot L2). Elle partira avec la prochaine mise à jour.');
  assert.equal(messageDeResolution({ lot: 'L1', nouveau_lot: null, modifications: 0, fiches: [{ fiche: 'x' }] }),
    'Conflit résolu : rien n’a été écrit (tout au choix 2), la valeur actuelle reste. 1 fiche de personnage adaptée (un élément supprimé lui est retiré).');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------
// Lots gardés (demande du propriétaire du 2026-11-12 : « les modification apporté sur le site prime » ; « Quand un conflit est trop ambigüe
// seulement là il est listé dans l'onglet mise à jour avec à gauche "modification sur site" et à droite "modification du code" » ; réponse : pendant
// qu'un conflit ambigu attend son choix, la page affiche la modification du site). Fixture : conflits-diagnostic-garde.json.
// ---------------------------------------------------------------------------------------------------------------------------------------------------

const LOT_GARDE = GARDE.lots.find((l) => l.garde);
/** Un conflit gardé de deux textes avec ses passages, et un champ gardé sans passage (champ court), choisis par leur forme, pas par leur texte. */
const AVEC_PASSAGES = LOT_GARDE.conflits.find((c) => c.passages?.length);
const SANS_PASSAGE = LOT_GARDE.conflits.find((c) => !c.passages?.length && typeof c.version_1?.valeur === 'string');
/** Les colonnes d'un champ gardé : [titre, texte visible de chaque passage] pour la gauche (1) et la droite (2). */
function colonnesGardees(html) {
  const bloc = html.match(/<div class="nv-conflit__versions nv-conflit__versions--garde">([\s\S]*?)<\/div><\/div><\/div><\/div>/)?.[0];
  assert.ok(bloc, 'les deux colonnes');
  return [1, 2].map((n) => {
    const col = bloc.match(new RegExp(`<div class="nv-version nv-version--${n}"><h5 class="nv-version__titre">([^<]+)</h5><div class="nv-passages">([\\s\\S]*?)</div></div>(?=<div class="nv-version|</div>)`));
    assert.ok(col, `la colonne ${n}`);
    // le contenu des passages, sans la fin du dernier (le motif s'arrête avant elle)
    const contenu = `${col[2]}</div>`;
    return { titre: texte(col[1]), html: contenu, passages: [...contenu.matchAll(/<div class="nv-diff nv-passage">([\s\S]*?)<\/div>(?=<div class="nv-diff nv-passage">|$)/g)].map((m) => m[1]) };
  });
}

test('la fixture du lot gardé a la forme du service (garde, provenances, passages, actuelle, lots suivants, retenus)', () => {
  assert.ok(LOT_GARDE && LOT_GARDE.conflits.length && LOT_GARDE.bloque === false);
  for (const c of LOT_GARDE.conflits) {
    assert.equal(c.garde, true, c.id);
    assert.equal(c.provenance_1.genre, 'site', c.id);
    assert.equal(c.provenance_1.lot, LOT_GARDE.lot, `${c.id} : la version 1 vient de ce lot`);
    assert.ok(['regles', 'regles_et_site'].includes(c.provenance_2.genre), c.id);
    assert.ok(Array.isArray(c.passages) && Array.isArray(c.lots_suivants) && 'actuelle' in c && 'bloque' in c, c.id);
    assert.equal(c.valeur_1?.genre, 'valeur', `${c.id} : ce que laisse le choix 1`);
    assert.ok(c.valeur_2 === null || c.valeur_2.genre === 'valeur', `${c.id} : ce que laisse le choix 2`);
  }
  assert.ok(AVEC_PASSAGES && SANS_PASSAGE, 'un texte à passages et un champ court');
  assert.ok(AVEC_PASSAGES.actuelle && AVEC_PASSAGES.lots_suivants.length, 'un lot plus récent a changé la valeur depuis');
  assert.ok(GARDE.retenus.length && GARDE.retenus.every((r) => GARDE.lots.some((l) => l.lot === r.derriere)));
});

test('un lot gardé : à gauche la modification sur le site (datée par son lot), à droite la modification du code ; seulement les passages en conflit', () => {
  const c = AVEC_PASSAGES;
  const html = htmlDuConflit(c, 0, { faitLe: LOT_GARDE.fait_le });
  assert.match(html, /<fieldset class="nv-conflit nv-conflit--garde"/);
  const [gauche, droite] = colonnesGardees(html);
  // les titres suivent les provenances du service
  assert.equal(gauche.titre, titreDeLaVersion(1, c));
  assert.equal(droite.titre, titreDeLaVersion(2, c));
  assert.match(gauche.titre, /^Version 1 : modification sur le site/);
  assert.ok(gauche.titre.includes(instantLisible(c.provenance_1.fait_le)), 'la date du lot du site');
  assert.match(droite.titre, /^Version 2 : modification du code \(règles livrées\)$/);
  // une version 2 fusionnée avec un lot plus ancien du site : il est dit, par sa date et son résumé, jamais son id
  const fusionne = { ...c, provenance_2: { genre: 'regles_et_site', lot: 'L-ancien', fait_le: '2026-11-01T09:00:00Z', resume: 'Résumé d’essai' } };
  assert.ok(titreDeLaVersion(2, fusionne).includes(lotLisible(fusionne.provenance_2)));
  assert.ok(!titreDeLaVersion(2, fusionne).includes('L-ancien'));
  // chaque colonne : un bloc par passage en conflit, rien d'autre ; à gauche le texte du site (le code seulement barré à droite)
  assert.equal(gauche.passages.length, c.passages.length);
  assert.equal(droite.passages.length, c.passages.length);
  c.passages.forEach((p, i) => {
    assert.equal(texte(gauche.passages[i].replace(/<details[^>]*><summary>[^<]*<\/summary>/g, '')), p.site, `passage ${i} : le site`);
    assert.equal(texte(droite.passages[i].replace(/<details[^>]*><summary>[^<]*<\/summary>/g, '')), p.code, `passage ${i} : le code`);
    assert.doesNotMatch(gauche.passages[i], /<del>/, 'à gauche, rien du code');
    assert.doesNotMatch(droite.passages[i], /<ins>/, 'à droite, rien du site');
  });
  // les colonnes ne montrent que les passages : bien moins que les textes entiers, qui restent dans le bloc fermé
  const montre = c.passages.reduce((n, p) => n + p.site.length + p.code.length, 0);
  assert.ok(texte(gauche.html).length + texte(droite.html).length <= montre + 8, 'seulement les passages');
  assert.ok(texte(gauche.html).length < c.version_1.valeur.length);
  const entieres = html.match(/<details class="nv-conflit__entieres">([\s\S]*?)<\/details>/)?.[1];
  assert.ok(entieres && texte(entieres).includes(c.version_1.valeur) && texte(entieres).includes(c.version_2.valeur), 'les deux versions entières, dans un bloc fermé');
  // la version 1 est à gauche, la version 2 à droite, dans l'ordre du HTML
  assert.ok(html.indexOf('nv-version--1') < html.indexOf('nv-version--2'));
});

test('un champ court gardé (sans passage) : les deux valeurs côte à côte, comparées, sans bloc fermé redondant', () => {
  const c = SANS_PASSAGE;
  const html = htmlDuConflit(c, 0);
  const [gauche, droite] = colonnesGardees(html);
  assert.equal(gauche.passages.length, 1);
  assert.equal(texte(gauche.passages[0]), c.version_1.valeur);
  assert.equal(texte(droite.passages[0]), c.version_2.valeur);
  assert.equal(texteDeLaVersion(c.valeur_1), texteDeLaVersion(c.version_1));
  assert.doesNotMatch(html, /nv-conflit__entieres|data-nv-resultat/, 'rien de caché, chaque choix laisse sa modification entière : pas de bloc fermé');
  // deux valeurs non textuelles : côte à côte, en entier
  const nombres = { ...c, version_1: { genre: 'valeur', valeur: 3 }, version_2: { genre: 'valeur', valeur: 4 }, valeur_1: { genre: 'valeur', valeur: 3 }, valeur_2: { genre: 'valeur', valeur: 4 }, passages: [] };
  const h = htmlDuConflit(nombres, 0);
  assert.doesNotMatch(h, /nv-conflit__versions--garde/);
  assert.deepEqual([...h.matchAll(/<h5 class="nv-version__titre">([^<]+)<\/h5>/g)].map((m) => m[1]), [titreDeLaVersion(1, nombres), titreDeLaVersion(2, nombres)]);
});

test('ce que la page affiche en attendant le choix : le résultat du choix 1 (valeur_1), avec la provenance d’une valeur plus récente ; le résultat de chaque choix, en entier', () => {
  // un champ gardé : la page affiche le résultat du choix 1 (réponse du propriétaire « Les garder (Recommandé) », décision du leader-technique)
  for (const c of LOT_GARDE.conflits) {
    const p = htmlDuConflit(c, 0).match(/<p class="nv-conflit__affichee" data-nv-affichee="1">([^<]*)<\/p>/)?.[1];
    assert.ok(p && /choix 1/.test(p), c.id);
    // une valeur plus récente (`actuelle`) : sa provenance, jamais l'id de son lot
    if (c.actuelle) assert.ok(texte(p).includes(origineDeLaValeur(c.actuelle.provenance)) && !p.includes(c.actuelle.provenance.lot), c.id);
    else assert.ok(!texte(p).includes('plus récente'), c.id);
  }
  // le résultat de chaque choix d'un texte à passages : dans le bloc fermé, en entier, le 1 dit affiché sur la page
  const c = AVEC_PASSAGES;
  const entieres = htmlDuConflit(c, 0).match(/<details class="nv-conflit__entieres">([\s\S]*?)<\/details>/)?.[1];
  const resultats = Object.fromEntries([...entieres.matchAll(/data-nv-resultat="(\d)"><h5 class="nv-version__titre">([^<]+)<\/h5><div class="nv-version__texte">([\s\S]*?)<\/div>/g)].map((m) => [m[1], { titre: m[2], texte: texte(m[3]) }]));
  assert.equal(resultats[1].texte, texteDeLaVersion(c.valeur_1));
  assert.equal(resultats[2].texte, texteDeLaVersion(c.valeur_2));
  assert.match(resultats[1].titre, /affiché sur la page/);
  // le choix 2 refusé (valeur_2 null) : son résultat dit impossible
  const refuse = htmlDuConflit({ ...c, valeur_2: null, choix_possibles: [1, 3], refus_2: '« Description » : valeur obligatoire' }, 0);
  assert.match(refuse, /data-nv-resultat="2"><h5 class="nv-version__titre">[^<]+<\/h5><div class="nv-version__texte">Ce choix n’est pas possible ici/);
  // la saisie du choix 3 part du résultat du choix 1 (la valeur affichée)
  assert.equal(texte(htmlDuConflit(c, 0).match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1]), c.valeur_1.valeur);
  // un lot annulé dont un lot plus récent a changé la valeur : cette valeur et sa provenance ; sans elle, rien (la version 2 est la valeur actuelle)
  const annule = { ...MAGIE.conflits[0], actuelle: c.actuelle };
  const bloc = htmlDuConflit(annule, 0).match(/<div class="nv-conflit__affichee" data-nv-affichee="actuelle">([\s\S]*?)<\/details><\/div>/)?.[1];
  assert.ok(bloc && texte(bloc).includes(origineDeLaValeur(c.actuelle.provenance)) && texte(bloc).includes(texteDeLaVersion(c.actuelle)));
  assert.doesNotMatch(htmlDuConflit(MAGIE.conflits[0], 0), /nv-conflit__affichee/);
  // la saisie d'un lot annulé part toujours de la version 1
  assert.equal(texte(htmlDuConflit(MAGIE.conflits[0], 0).match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1]), MAGIE.conflits[0].version_1.valeur);
});

test('les choix d’un champ gardé : 1 garder le site, 2 prendre le code (sur les passages en conflit, le reste fusionné), 3 saisir ; un refus grise le choix avec sa raison', () => {
  const c = AVEC_PASSAGES;
  assert.match(libelleDuChoix(c, 1), /^1 : garder la modification du site sur les passages en conflit \(/);
  assert.match(libelleDuChoix(c, 2), /^2 : prendre la modification du code sur les passages en conflit \(/);
  // un champ court (sans passage) : la modification entière
  assert.doesNotMatch(libelleDuChoix(SANS_PASSAGE, 1), /passages/);
  assert.doesNotMatch(libelleDuChoix(SANS_PASSAGE, 2), /passages/);
  assert.equal(libelleDuChoix(c, 3), '3 : saisir à la main ce qui remplace les deux');
  assert.deepEqual([1, 2, 3].map((n) => raisonDuChoix(c, n)), [null, null, null]);
  // refus_2 venu d'un lot plus récent (`refus_2_lot`) : le 2 grisé, la phrase du service avec la date lisible de ce lot
  const par = c.lots_suivants[0];
  const refus = { ...c, choix_possibles: [1, 3], valeur_2: null, refus_2_lot: par, refus_2: `Le lot du ${par.fait_le} (« ${par.resume} »), plus récent, a supprimé cette ligne depuis : gardez la valeur du site (choix 1).` };
  const r2 = raisonDuChoix(refus, 2);
  assert.ok(r2.includes(instantLisible(par.fait_le)) && !r2.includes(par.fait_le) && !r2.includes(par.lot), r2);
  assert.match(htmlDuConflit(refus, 0), /value="2" data-nv-choix disabled>/);
  // refus_2 de l'éditeur (sans lot) : dit comme tel
  assert.match(raisonDuChoix({ ...c, choix_possibles: [1, 3], refus_2: '« Description » : valeur obligatoire' }, 2), /^l’édition refuse aujourd’hui la modification du code : /);
});

test('lots suivants, colonnes fusionnées, lots retenus : dits par leur date et leur résumé, jamais par leur id', () => {
  const html = htmlDesConflits(GARDE);
  // les lots plus récents du même champ
  const suivants = htmlDuConflit(AVEC_PASSAGES, 0).match(/<p class="nv-conflit__suivants" data-nv-suivants>([\s\S]*?)<\/p>/)?.[1];
  assert.ok(suivants);
  for (const l of AVEC_PASSAGES.lots_suivants) assert.ok(texte(suivants).includes(lotLisible(l)));
  assert.doesNotMatch(htmlDuConflit(SANS_PASSAGE, 0), /data-nv-suivants/);
  // une saine fusionnée sans conflit : « fusionné automatiquement », ses colonnes par leur libellé
  const lot = structuredClone(LOT_GARDE);
  lot.saines[0].fusionnees = ['description'];
  lot.saines[0].fusionnees_libelles = ['Libellé d’essai'];
  const fusion = htmlDuLot(lot).match(/<span class="nv-conflit__fusion" data-nv-fusion>([^<]*)<\/span>/)?.[1];
  assert.equal(texte(fusion), '(fusionné automatiquement : Libellé d’essai)');
  assert.doesNotMatch(htmlDuLot(LOT_GARDE), /data-nv-fusion/, 'rien sans colonne fusionnée');
  // les lots retenus : un par entrée, avec un lien vers le lot qu'ils attendent
  const retenus = html.match(/<details class="nv-conflits__retenus" data-nv-retenus open>([\s\S]*?)<\/details>/)?.[1];
  assert.ok(retenus, 'les lots retenus');
  assert.equal((retenus.match(/<li>/g) ?? []).length, GARDE.retenus.length);
  const ancre = html.match(new RegExp(`<form class="nv-conflit-lot nv-conflit-lot--garde" id="([^"]+)" data-nv-lot="${LOT_GARDE.lot}"`))?.[1];
  assert.ok(ancre && retenus.includes(`href="#${ancre}"`), 'le lien vers le lot attendu');
  for (const r of GARDE.retenus) assert.ok(texte(retenus).includes(instantLisible(r.fait_le)));
  // sans lot ni résolu, des retenus suffisent à poser la section
  assert.notEqual(htmlDesConflits({ lots: [], resolus: [], retenus: GARDE.retenus }), '');
  // aucun id de lot dans le texte, aucun nom du schéma
  for (const id of [...GARDE.lots.map((l) => l.lot), ...GARDE.retenus.map((r) => r.lot)]) assert.ok(!texte(html).includes(id), id);
  assert.deepEqual(nomsDuSchemaDans(texte(html)), []);
  assert.doesNotMatch(texte(html), /\{"|"\}|":/);
});

test('un lot qui attend un lot plus ancien (bloque) : « Résoudre ce lot » grisé, la raison dite par la date et le résumé du lot, avec un lien', () => {
  assert.match(htmlDuLot(LOT_GARDE), /<button type="submit" class="nv-principal">Résoudre ce lot<\/button>/, 'sans blocage : le bouton actif');
  assert.doesNotMatch(htmlDuLot(LOT_GARDE), /data-nv-bloque|nv-conflit-lot__bloque/);
  const ancien = { lot: 'L-ancien', fait_le: '2026-11-01T09:00:00Z', resume: 'Résumé d’essai', conflits: [], saines: [], empreinte: 'e' };
  const bloque = { lot: ancien.lot, fait_le: ancien.fait_le, resume: ancien.resume, raison: `Le lot du ${ancien.fait_le} (« ${ancien.resume} »), plus ancien, touche aussi ce champ et n’est pas résolu : résolvez-le d’abord.` };
  const lot = structuredClone(LOT_GARDE);
  lot.bloque = true;
  lot.conflits[0].bloque = bloque;
  const html = htmlDesConflits({ lots: [ancien, lot], resolus: [], retenus: [] });
  const form = html.slice(html.indexOf(`data-nv-lot="${lot.lot}"`));
  assert.match(form, /<button type="submit" class="nv-principal" disabled>Résoudre ce lot<\/button>/);
  assert.match(html, new RegExp(`id="(nv-lot-\\d+)" data-nv-lot="${lot.lot}" data-nv-empreinte="[^"]*" data-nv-bloque>`));
  const ancre = html.match(/id="(nv-lot-\d+)" data-nv-lot="L-ancien"/)[1];
  // sous le conflit et près du bouton : le lot à résoudre d'abord, lié, par sa date lisible et son résumé
  const sousLeConflit = form.match(/<p class="nv-conflit__bloque" data-nv-bloque>([\s\S]*?)<\/p>/)?.[1];
  const presDuBouton = form.match(/<p class="nv-conflit-lot__bloque" data-nv-lot-bloque>([\s\S]*?)<\/p>/)?.[1];
  for (const t of [sousLeConflit, presDuBouton]) {
    assert.ok(t && t.includes(`href="#${ancre}"`), t);
    assert.ok(texte(t).includes(lotLisible(bloque)), t);
    assert.ok(!texte(t).includes('L-ancien') && !/\d{4}-\d{2}-\d{2}T/.test(texte(t)), t);
  }
  // les choix restent possibles (ils se gardent pour après) ; seul l'envoi attend
  assert.doesNotMatch(form.slice(0, form.indexOf('</fieldset>')), /data-nv-choix disabled/);
  // le lot plus ancien, lui, reste envoyable
  assert.match(html.slice(html.indexOf('data-nv-lot="L-ancien"'), html.indexOf(`data-nv-lot="${lot.lot}"`)), /<button type="submit" class="nv-principal">/);
});

test('bug des titres : la version 2 d’un lot annulé suit sa vraie provenance (règles livrées, un lot du site de dev, une résolution), jamais « la dernière livraison » par défaut', () => {
  const c = MAGIE.conflits[0];
  assert.equal(c.provenance_2.genre, 'regles');
  for (const conflit of DIAG.lots.flatMap((l) => l.conflits)) {
    assert.doesNotMatch(titreDeLaVersion(2, conflit), /dernière livraison/, conflit.id);
    assert.equal(titreDeLaVersion(1, conflit), titreDeLaVersion(1, conflit, conflit.provenance_1.fait_le));
  }
  const site = { ...c, provenance_2: { genre: 'site', lot: 'L-recent', fait_le: '2026-11-13T09:00:00Z', resume: 'Résumé d’essai' } };
  assert.ok(titreDeLaVersion(2, site).includes(`écrite sur le site de dev par le ${lotLisible(site.provenance_2)}`));
  assert.doesNotMatch(titreDeLaVersion(2, site), /règles livrées/);
  // une résolution (le service donne son résumé sans id de lot, et le lot résolu dans `resout`) : dite comme telle, sans aucun id
  const resolution = { ...c, provenance_2: { genre: 'resolution', lot: 'L-res', fait_le: '2026-11-13T09:00:00Z', resume: 'Résumé d’essai', resout: 'L-resolu' } };
  const t = titreDeLaVersion(2, resolution);
  assert.match(t, /résolution d’un conflit/);
  assert.ok(t.includes(lotLisible(resolution.provenance_2)) && !t.includes('L-res') && !t.includes('L-resolu'), t);
  // sans provenance (réponse ancienne) : rien n'est affirmé sur sa source ; une ligne absente : les règles livrées
  assert.equal(titreDeLaVersion(2, { ...c, provenance_2: undefined }), 'Version 2 : la valeur actuelle');
  assert.match(titreDeLaVersion(2, HYPER.conflits[0]), /règles livrées/);
  // le choix 1 retiré parce qu'un lot plus récent a écrit le champ (`refus_1_lot`) : la phrase du service, la date de ce lot lisible, sans id
  const p = site.provenance_2;
  const recent = { ...site, choix_possibles: [2, 3], refus_1_lot: { lot: p.lot, fait_le: p.fait_le, resume: p.resume },
    refus_1: `Le lot du ${p.fait_le} (« ${p.resume} »), plus récent, a modifié ce champ depuis : sa valeur reste (choix 2), ou saisissez-en une (choix 3).` };
  const r1 = raisonDuChoix(recent, 1);
  assert.ok(r1.includes(instantLisible(p.fait_le)) && r1.includes(p.resume) && !r1.includes(p.fait_le) && !r1.includes(p.lot), r1);
  // la raison de l'éditeur (sans lot) reste dite comme telle
  assert.match(raisonDuChoix({ ...recent, refus_1_lot: undefined, refus_1: '« Texte » : valeur obligatoire' }, 1), /^l’édition refuse aujourd’hui cette valeur : /);
});

test('l’instant d’un lot cité par un texte du service devient sa date lisible ; le message d’un lot gardé résolu dit sa reprise', () => {
  const l = { lot: 'L', fait_le: '2026-11-12T10:00:00Z', resume: 'x' };
  const t = avecDateLisible(`Le lot du ${l.fait_le} (« x »), plus ancien.`, l);
  assert.ok(t.includes(instantLisible(l.fait_le)) && !t.includes(l.fait_le), t);
  assert.equal(avecDateLisible('aucune date', null), 'aucune date');
  assert.match(messageDeResolution({ lot: 'L1', reprise: 'L1-reprise', nouveau_lot: null, modifications: 4, fiches: [] }), /^Conflit résolu : la modification du site est reprise \(4 lignes\)\./);
  assert.match(messageDeResolution({ lot: 'L1', reprise: 'L1-reprise', nouveau_lot: 'L2', modifications: 5, fiches: [] }), /reprise, et vos choix 2 et 3 forment une nouvelle modification/);
});

// Réponse du propriétaire du 2026-11-12 (« Les garder (Recommandé) »), étendue aux lots annulés par le leader-technique : un texte long ambigu ne se
// tranche que sur ses passages en conflit (`valeur_1`, `valeur_2` du service : serveur/edition-conflits.mjs#completerLeDiagnostic). Le diff du texte
// entier reste (décision du leader-technique) ; le résultat de chaque choix s'ajoute dans le bloc fermé.
test('un lot annulé : un choix fusionné dit qu’il ne tranche que les passages en conflit, montre son résultat ; la saisie du 3 part de valeur_1', () => {
  const c = MAGIE.conflits[0];
  // la fixture : chaque choix d'un lot annulé laisse sa version entière, rien ne change
  for (const x of DIAG.lots.flatMap((l) => l.conflits).filter((x) => 'valeur_1' in x)) {
    assert.equal(texteDeLaVersion(x.valeur_1), texteDeLaVersion(x.version_1), x.id);
    assert.doesNotMatch(htmlDuConflit(x, 0), /data-nv-resultat/, x.id);
    assert.doesNotMatch(libelleDuChoix(x, 1), /passages/, x.id);
  }
  // une fusion : le passage en conflit d'un côté, le reste de l'autre (valeurs bâties à partir des versions, aucun texte figé)
  const fusion = { ...c, valeur_1: { genre: 'valeur', valeur: `${c.version_1.valeur}\nFusionné 1.` }, valeur_2: { genre: 'valeur', valeur: `${c.version_2.valeur}\nFusionné 2.` } };
  assert.match(libelleDuChoix(fusion, 1), /^1 : la version 1 sur les passages en conflit/);
  assert.match(libelleDuChoix(fusion, 2), /^2 : la version 2 sur les passages en conflit/);
  const html = htmlDuConflit(fusion, 0);
  // le diff du texte entier reste
  assert.match(html, /<div class="nv-conflit__differences"><h5 class="nv-version__titre">[^<]+<\/h5><p class="nv-diff__legende">[\s\S]*?<div class="nv-diff">/);
  const entieres = html.match(/<details class="nv-conflit__entieres">([\s\S]*?)<\/details>/)?.[1];
  const resultats = Object.fromEntries([...entieres.matchAll(/data-nv-resultat="(\d)"><h5 class="nv-version__titre">([^<]+)<\/h5><div class="nv-version__texte">([\s\S]*?)<\/div>/g)].map((m) => [m[1], { titre: m[2], texte: texte(m[3]) }]));
  assert.equal(resultats[1].texte, fusion.valeur_1.valeur);
  assert.equal(resultats[2].texte, fusion.valeur_2.valeur);
  assert.doesNotMatch(resultats[1].titre, /affiché sur la page/, 'un lot annulé : la page affiche la version 2');
  assert.ok(texte(entieres).includes(c.version_1.valeur) && texte(entieres).includes(c.version_2.valeur), 'les deux versions entières restent');
  assert.equal(texte(html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/)[1]), fusion.valeur_1.valeur, 'la saisie du 3 part de valeur_1');
  // la consigne du lot ne dit plus que le choix 2 laisse toujours la valeur actuelle
  assert.match(texte(htmlDuLot({ ...MAGIE, conflits: [fusion] })), /sauf sur un texte dont le choix 2 est fusionné/);
  assert.doesNotMatch(texte(htmlDuLot(MAGIE)), /sauf sur un texte/);
});
