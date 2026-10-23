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
  colonnesDeLaSaine, corpsDeLaResolution, erreurDeSaisie, htmlDesConflits, htmlDuConflit, htmlDuLot, libelleDuChoix, messageDeResolution, optionsDeLaSaisie,
  raisonDuChoix, raisonDuConflit, texteDeLaVersion, texteDeValeur,
} from '../src/lib/conflits-rendu.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { nomDeColonne, nomDeTable } from '../src/lib/libelles-de-la-base.mjs';

const DIAG = JSON.parse(readFileSync(new URL('./fixtures/conflits-diagnostic.json', import.meta.url), 'utf8'));
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

test('une page du guide modifiée puis réécrite : les deux versions côte à côte, en texte, leurs différences, les trois choix', () => {
  const c = MAGIE.conflits[0];
  const html = htmlDuConflit(c, 0);
  // version 1 : ce que le site de dev avait écrit ; version 2 : les règles livrées
  const versions = [...html.matchAll(/<div class="nv-version nv-version--(\d)"><h5 class="nv-version__titre">([^<]+)<\/h5><div class="nv-version__texte">([\s\S]*?)<\/div><\/div>/g)];
  assert.deepEqual(versions.map((m) => [m[1], m[2]]), [['1', 'Version 1 : ce que le site de dev avait écrit'], ['2', 'Version 2 : ce que disent les règles livrées']]);
  assert.equal(texte(versions[0][3]), c.version_1.valeur, 'le texte long, lisible en entier');
  assert.equal(texte(versions[1][3]), c.version_2.valeur);
  assert.match(texte(versions[0][3]), /Paragraphe ajouté sur le site de dev/);
  // le Markdown se lit tel quel : aucune balise venue du texte, et l'aperçu HTML de l'éditeur n'est pas posé
  assert.doesNotMatch(versions[0][3], /<(?!\/?(?:del|ins)>)/);
  assert.doesNotMatch(html, /aperçu 0/);
  // les différences mot à mot (barré : la version 2 seulement ; en gras : la version 1 seulement)
  const diff = html.match(/<details class="nv-conflit__differences">[\s\S]*?<div class="nv-diff">([\s\S]*?)<\/div><\/details>/)?.[1];
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

test('une page retirée des règles : seul le choix 2 (abandonner), la raison dite ; la version 1 reste lisible', () => {
  const c = HYPER.conflits[0];
  assert.equal(c.genre, 'ligne_supprimee');
  const html = htmlDuConflit(c, 4);
  assert.deepEqual([...html.matchAll(/value="(\d)" data-nv-choix( disabled)?>/g)].map((m) => [m[1], Boolean(m[2])]), [['1', true], ['2', false], ['3', true]]);
  assert.match(texte(html), /1 : la version 1 \(le site de dev\) \(la ligne n’existe plus dans les règles livrées \(la version 1 reste lisible ci-dessus, pour la recopier ailleurs\)\)/);
  assert.match(texte(html), /2 : abandonner cette modification \(la règle livrée reste\)/);
  assert.match(texte(html), /3 : saisir à la main ce qui remplace les deux \(seul un champ se saisit à la main/);
  assert.doesNotMatch(html, /data-nv-saisie/, 'pas de saisie');
  assert.match(texte(html), /Version 1 : ce que le site de dev avait écritTexte : > « Ne plus faire qu’un avec soi-même. »/);
  assert.match(texte(html), /Version 2 : ce que disent les règles livréesLigne supprimée : elle n’existe plus dans les règles livrées\./);
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
  const champ = (saisie, valeur = '7') => htmlDuConflit({ ...c, saisie, version_1: { genre: 'valeur', valeur } }, 9);
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
  assert.equal(libelleDuChoix({ genre: 'champ' }, 2), '2 : la version 2 (la règle livrée reste)');
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
  assert.match(html, new RegExp(`<form class="nv-conflit-lot" data-nv-lot="${MAGIE.lot}" data-nv-empreinte="${MAGIE.empreinte}">`));
  assert.match(html, /<button type="submit" class="nv-principal">Résoudre ce lot<\/button>/);
  // les lots résolus
  const resolus = htmlDesConflits({ lots: [], resolus: [
    { lot: 'L1', fait_le: '2026-10-21T08:00:00Z', resume: 'Page X', resolu_le: '2026-10-22T20:00:00Z', resolu_par: 'L9', resolution: [] },
    { lot: 'L2', fait_le: '2026-10-21T08:00:00Z', resume: 'Page Y', resolu_le: '2026-10-22T20:00:00Z', resolu_par: null, resolution: [] },
  ] });
  assert.match(resolus, /<p>Aucun lot en conflit à résoudre\.<\/p><details class="nv-conflits__resolus"><summary>Lots en conflit déjà résolus \(2\)<\/summary>/);
  assert.match(texte(resolus), /par une nouvelle modification \(lot L9\)/);
  assert.match(texte(resolus), /sans rien écrire \(tout au choix 2 : les règles livrées restent\)/);
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
  assert.match(texte(html), /Bonus du métier \(Métier « Forgeron »\), n° 1, option 2/);
  assert.match(texte(html), /Autre nom de la page \(Page guide\/le-mode-hyper\), ordre 900/);
  // les textes du service hors du contenu des versions : aucune table du schéma, même d'un seul mot (la liste exacte)
  for (const l of DIAG.lots) {
    const textes = [l.detail_lisible, ...l.saines.flatMap((x) => [x.libelle, ...(x.colonnes_libelles ?? [])]),
      ...l.conflits.flatMap((c) => [c.libelle, c.colonne_libelle, c.raison_lisible, ...[c.version_1, c.version_2].flatMap((v) => Object.values(v?.libelles ?? {}))])];
    for (const t of textes) assert.deepEqual(tablesDans(t), [], `${l.lot} : « ${t} »`);
  }
  assert.deepEqual(tablesDans('sort_mot_cle : clé étrangère rompue vers Mot-clé ; invocation, lien'), ['sort_mot_cle', 'invocation', 'lien'], 'la garde les voit');
  // la rupture « enfant » (la table qui cite, par son nom) et le renommage des deux bords (sans la clé normalisée)
  assert.match(texte(html), /Étiquette du sort : clé étrangère rompue vers Mot-clé essai-conflits-etiquette/);
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

test('le message après l’envoi', () => {
  assert.equal(messageDeResolution({ lot: 'L1', nouveau_lot: 'L2', modifications: 3, fiches: [] }),
    'Conflit résolu : une nouvelle modification du site de dev a été enregistrée (3 lignes ; lot L2). Elle partira avec la prochaine mise à jour.');
  assert.equal(messageDeResolution({ lot: 'L1', nouveau_lot: null, modifications: 0, fiches: [{ fiche: 'x' }] }),
    'Conflit résolu : rien n’a été écrit (tout au choix 2), les règles livrées restent. 1 fiche de personnage adaptée (un élément supprimé lui est retiré).');
});
