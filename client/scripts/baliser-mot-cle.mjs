// `node scripts/baliser-mot-cle.mjs --mots <mots.json> --lot <lot.json> --nature <nature> [--decision R…] [--titre <titre>] [--base <fichier.db> | --rows <dossier>]
//   [--journal <journal.json>] [--rapport <rapport.json>]`
// (dans client/) : pose la balise d'un mot-clé du glossaire autour de chaque écriture d'un mot dans les textes de la base (demande du propriétaire du
// 2026-10-17 : « Transforme dans tous les textes le mot "Chakra" (ou chakra) en mot clé {{Charka}} […] Fait de même avec {{Barrière}} »). Le site ne
// repère jamais un mot-clé tout seul (marquage explicite, lib/mots-cles-balises.mjs) : cet outil écrit une fois les balises, comme le ferait le mode
// modification du site de dev, et ce sont elles que les textes gardent.
// `--mots` : [{ libelle, motif, casse, description, exclus, contextes, horsDe, sauf }] (un mot-clé par entrée, dans l'ordre : une définition peut citer un
// mot-clé qui la précède ; créé s'il manque, sinon gardé tel quel) : `motif`, les écritures du mot, source d'une expression régulière sans la casse
// (« chakras? » ; avec la casse si `casse`) ; puis où le mot n'est pas balisé (demande du propriétaire du 2026-10-18 : « Seulement là où il est
// pertinent ») : `exclus`, des écritures laissées telles quelles (un nom propre que la base ne range pas, un autre sens du mot ; une liste, ou des listes
// rangées par raison) ; `contextes`, { raison: [expressions régulières] } (les passages où le mot n'a pas le sens du mot-clé, « magie de la Corruption ») ;
// `horsDe`, les textes qu'il ne balise pas (« page:lore/ » : les pages dont l'identifiant commence ainsi, « page:lore/glossaire » : cette page,
// « evenement_extrait.texte » : une colonne), sauf ceux de `sauf`. Une écriture exclue ou un contexte se lit dans le texte qui porte déjà les balises
// des mots qui le précèdent dans l'entrée : il ne cite aucun d'eux (refusé). Les balises du mot-clé déjà posées autour du mot sont relues, celles de
// l'outil comme celles posées à la main (rien ne les distingue) : retirées partout, puis reposées là où elles sont pertinentes (un second passage avec
// d'autres exclusions retire donc celles qui ne le sont plus ; avec les mêmes, il ne change rien). Le rapport liste chaque balise retirée sans être
// reposée et chaque balise nouvelle (`changements`), et ce que l'entrée écrit pour rien (`inutilises` : une exclusion, un contexte qui ne se lit dans
// aucun texte relu, un texte de `horsDe` ou de `sauf` qui n'en désigne aucun). Les entrées : tools/glossaire/chakra-barriere.json (2026-10-17),
// tools/glossaire/corruption.json (2026-10-18, qui reprend Chakra et Barrière), tools/glossaire/sort-fer.json (2026-10-23, décision R164).
// Étapes : la base de départ est une copie de l'extrait du jour du site de dev (`--base`, défaut var/extrait/maverick-dev.db : `npm run db:extrait`), ou, à
// défaut (tests, `--rows`), la base des règles construite depuis un dossier de lignes dont on tire une base vivante ; le service du site de dev
// (serveur/api.mjs, édition ouverte) y fait les modifications — les mots-clés créés (/recherche/), puis un lot par colonne (au plus LOT_MAX textes
// chacun) qui réécrit les textes ; tout ce qui en dépend (pages typées, colonnes tirées d'un texte) est refait par le service. Ce qui a changé, table de
// contenu par table de contenu, devient un lot de changements (`--lot`, « maverick-lot/1 », serveur/epreuve-des-lots.mjs#lotDeLaDifference), contrôlé
// comme au dépôt : il se PROPOSE au site de dev (`POST /api/edition/lots/`, skill modifier-une-page-wiki) et n'entre dans la base qu'au clic du
// propriétaire (R274, R275 (4)). L'outil n'écrit jamais data/rows (bascule 1 : plus de `--appliquer`). `--journal` garde, au besoin, le journal du service.
// Les textes réécrits (TEXTES, lib/glossaire-balisage.mjs pour ce qui n'est jamais balisé) : ceux que le site de dev modifie (lib/edition-modele.mjs#TABLES),
// les textes longs (champ « texte ») et mis en forme (« markdown » : le guide et le Codex, la chronologie, les panneaux de règles), plus quatre textes
// d'une ligne qui sont des phrases ; jamais un nom, un titre, un libellé, une liste de noms, une valeur rangée (affinité), ni une rubrique de carte de
// monstre que la carte découpe en tuiles ou en pastilles (RUBRIQUES_DECOUPEES) : sa balise en changerait l'affichage.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traiter } from '../serveur/api.mjs';
import { FICHIER_BASE, ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { copierLaBase } from '../serveur/epreuve-des-lots.mjs';
import { controlerLaNature } from '../src/lib/lot-de-changements.mjs';
import { TABLES, texteDePageModifiable } from '../src/lib/edition-modele.mjs';
import { baliserLeMot, ecrituresDuMot, ecrituresDuMotDans, sansLesBalisesDuMot } from '../src/lib/glossaire-balisage.mjs';
import { motsClesDeLaBase } from '../src/lib/mots-cles-db.mjs';
import { motCleDeLaRef } from '../src/lib/mots-cles-balises.mjs';
import { SENS_DEFENSE } from '../src/lib/monstre-champs.mjs';
import { lotDesChangements } from './lot-de-source.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** L'extrait du jour du site de dev (scripts/db-extrait.mjs : var/extrait/maverick-dev.db), la base de départ par défaut de la ligne de commande. */
export const EXTRAIT_PAR_DEFAUT = join(RACINE, 'var', 'extrait', 'maverick-dev.db');

/** Au plus tant de textes par lot (un lot par colonne, coupé au-delà). */
export const LOT_MAX = 100;

/** Les textes d'une ligne qui sont des phrases (le reste des champs « ligne » : noms, titres, libellés, listes, valeurs rangées). */
export const PHRASES_D_UNE_LIGNE = Object.freeze([
  ['capacite', 'type_brut'], // « Action (Coût 10 Chakra) »
  ['sort', 'dsb_brut'], // « Retire du 2d10 de chakra à la cible »
  ['metier', 'artisanat_texte'], // « Fabriquer de l’alcool, ce dernier peut redonner 5 chakra si consommé »
  ['monstre_butin', 'texte'], // « Perte de 25% du chakra »
]);

/**
 * Les rubriques d'une carte de monstre que la carte découpe (lib/monstre-rendu.mjs#htmlDeRubrique : tuiles des attributs et des valeurs par échelle,
 * cases F.P.V.S.I.A., pastilles des cibles, progressions de la défense) : leur texte n'est pas balisé.
 */
export const RUBRIQUES_DECOUPEES = Object.freeze([...new Set(['attributs', 'sante', 'chakra', 'barriere', 'defense', 'vitesse', 'caracteristiques', 'competences',
  ...SENS_DEFENSE])]);

/** Les colonnes réécrites, dans l'ordre des lots : [{ table, colonne, markdown }] (TABLES : champs « texte » et « markdown », et PHRASES_D_UNE_LIGNE). */
export const TEXTES = Object.freeze(Object.entries(TABLES).flatMap(([table, def]) => Object.entries(def.colonnes)
  .filter(([colonne, champ]) => champ.type === 'texte' || champ.type === 'markdown' || PHRASES_D_UNE_LIGNE.some(([t, c]) => t === table && c === colonne))
  // la définition d'un mot-clé n'est écrite que pour les mots-clés créés ici (une définition qui en cite un autre : `--mots`)
  .filter(() => table !== 'mot_cle')
  .map(([colonne, champ]) => ({ table, colonne, markdown: champ.type === 'markdown' }))));

/**
 * Les noms de la base qui contiennent une écriture du mot avec d'autres mots (« Boule de Chakra », « Barrière rocheuse ») : colonnes `nom`, `titre`,
 * `capacite_nom` de toutes les tables ; pas un nom qui n'est que le mot (« Chakra ») ou le mot et un nombre (« +5 Chakra »).
 */
export function nomsAvecLeMot(db, motif, casse = false) {
  const ecriture = ecrituresDuMot(motif, 'iu', casse);
  const noms = new Set();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql NOT LIKE 'CREATE VIRTUAL%'").all();
  for (const { name: table } of tables) {
    for (const { name: colonne, type } of db.prepare(`PRAGMA table_info("${table}")`).all()) {
      if (!['nom', 'titre', 'capacite_nom'].includes(colonne) || !/TEXT/i.test(type)) continue;
      for (const { v } of db.prepare(`SELECT DISTINCT "${colonne}" AS v FROM "${table}" WHERE "${colonne}" IS NOT NULL`).all()) {
        if (ecriture.test(v) && /\p{L}{3,}/u.test(v.replace(new RegExp(ecriture.source, `g${ecriture.flags}`), ''))) noms.add(v);
      }
    }
  }
  return [...noms].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Construit la base des règles (db-build puis db-derive, comme le site) depuis un dossier de lignes. */
function construireRegles(rows, sortie) {
  for (const [script, args] of [['db-build.mjs', ['--out', sortie, '--rows', rows]], ['db-derive.mjs', [sortie]]]) {
    const r = spawnSync(process.execPath, ['--no-warnings', join(CLIENT, 'scripts', script), ...args], { encoding: 'utf8', cwd: RACINE });
    if (r.status !== 0) throw new Error(`${script} a échoué : ${r.stderr || r.stdout}`);
  }
}

/** Les colonnes de la clé primaire d'une table. */
const cleDe = (db, table) => db.prepare(`PRAGMA table_info("${table}")`).all().filter((c) => c.pk).sort((a, b) => a.pk - b.pk).map((c) => c.name);

/** Un texte de `--mots` (`horsDe`, `sauf`) désigne-t-il ce texte (`ou` : « page:<id> » ou « <table>.<colonne> ») ? Fini par « / », un début d'identifiant. */
const designe = (entree, ou) => (entree.endsWith('/') ? ou.startsWith(entree) : ou === entree);

/** Le mot est-il balisé dans ce texte (`ou`) : il n'est pas dans `horsDe`, ou il est dans `sauf`. */
export const baliseDans = (mot, ou) => !(mot.horsDe ?? []).some((e) => designe(e, ou)) || (mot.sauf ?? []).some((e) => designe(e, ou));

/** Une forme d'un texte pour y chercher une écriture exclue : en minuscules, apostrophes droites (comme lib/glossaire-balisage.mjs). */
const pourChercher = (t) => t.toLowerCase().replace(/[’ʼ]/g, "'");

/** Un court extrait de `texte` autour de la position `debut` (le rapport), ses balises lues comme leur texte (« {{id}} » : l'identifiant). */
const extraitDe = (texte, debut) => texte.slice(Math.max(0, debut - 60), debut + 60)
  .replace(/\{\{([^{}|\n]+?)(?:\\?\|([^{}\n]*?))?\}\}/g, (_, ref, x) => x ?? ref.replace(/:$/, '')).replace(/\s+/g, ' ').trim();

/**
 * Les modifications d'une colonne : [{ op, rapport }] (une opération « modifier » du service par ligne dont le texte change, et ce qui a été balisé,
 * retiré ou laissé ; `rapport.sautee` : une ligne qui écrit le mot sans être relue, et pourquoi), d'après les mots `mots` ([{ id, libelle, motif, casse,
 * noms, exclus, contextes, horsDe, sauf, usage }], dans l'ordre : les balises du premier sont des zones déjà écrites pour le suivant). Les balises des
 * mots posées autour du mot sont d'abord toutes retirées (lib/glossaire-balisage.mjs#sansLesBalisesDuMot), puis chaque mot est balisé là où il est
 * pertinent ; `rapport.changements` : chaque écriture dont la balise part ou arrive. `usage` (par mot) note les exclusions, contextes et textes de
 * l'entrée qui servent. Toutes les lignes sont lues (l'expression régulière du motif fait le tri : aucun filtre SQL qui en manquerait une).
 */
function modificationsDe(db, { table, colonne, markdown }, mots) {
  const cle = cleDe(db, table);
  const lignes = db.prepare(`SELECT ${[...cle, colonne].map((c) => `"${c}"`).join(', ')}${table === 'page' ? ', type, statut' : ''}${table === 'monstre_rubrique' ? ', rubrique' : ''}
    FROM "${table}" WHERE "${colonne}" IS NOT NULL`).all();
  const ecrit = mots.map((m) => ecrituresDuMot(m.motif, 'iu', m.casse));
  const sortie = [];
  for (const l of lignes) {
    if (typeof l[colonne] !== 'string' || !(ecrit.some((r) => r.test(l[colonne])) || mots.some((m) => l[colonne].includes(`{{${m.id}`)))) continue;
    const rapport = { table, colonne, cle: Object.fromEntries(cle.map((c) => [c, l[c]])), balisees: {}, retirees: {}, ignorees: [], changements: [] };
    const sauter = (raison) => sortie.push({ op: null, rapport: { ...rapport, sautee: raison } });
    const ou = table === 'page' ? `page:${l.id}` : `${table}.${colonne}`;
    for (const m of mots) {
      for (const e of m.horsDe) if (designe(e, ou)) m.usage.horsDe.add(e);
      for (const e of m.sauf) if (designe(e, ou)) m.usage.sauf.add(e);
    }
    if (table === 'page') {
      if (l.statut === 'example') {
        sauter('page d’exemple'); // une fixture de démonstration, pas du lore
        continue;
      }
      const source = db.prepare('SELECT s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id = ? ORDER BY ps.ordre LIMIT 1').get(l.id)?.texte;
      if (!texteDePageModifiable(l.type, source ?? null)) {
        sauter('page qui suit ses tables'); // refaite par le service depuis les tables balisées
        continue;
      }
    }
    if (table === 'monstre_rubrique' && RUBRIQUES_DECOUPEES.includes(l.rubrique)) {
      sauter(`rubrique découpée par la carte (${l.rubrique})`);
      continue;
    }
    const avant = l[colonne];
    let texte = avant;
    for (const m of mots) {
      const r = sansLesBalisesDuMot(texte, { ...m, markdown });
      texte = r.texte;
      if (r.retirees) rapport.retirees[m.id] = r.retirees;
    }
    for (const m of mots) {
      const r = baliserLeMot(texte, { ...m, markdown });
      if (!baliseDans(m, ou)) {
        // ce que le mot aurait reçu ici, laissé tel quel
        rapport.ignorees.push(...r.balisees.map((ecriture) => ({ mot: m.id, ecriture, raison: 'texte qui ne balise pas le mot (horsDe)' })));
        continue;
      }
      const cherche = pourChercher(texte);
      for (const e of m.exclus) if (cherche.includes(pourChercher(e))) m.usage.exclus.add(e);
      for (const c of m.contextes) if (new RegExp(`(?<![\\p{L}\\p{N}])(?:${c.motif})`, 'imu').test(texte)) m.usage.contextes.add(c.motif);
      texte = r.texte;
      if (r.balisees.length) rapport.balisees[m.id] = r.balisees.length;
      rapport.ignorees.push(...r.ignorees.map((i) => ({ mot: m.id, ...i })));
    }
    // écriture par écriture, ce qui change (le texte affiché, lui, est le même : la même suite d'écritures)
    for (const m of mots) {
      const a = ecrituresDuMotDans(avant, { ...m, markdown });
      const b = ecrituresDuMotDans(texte, { ...m, markdown });
      if (a.length !== b.length) throw new Error(`${table} ${JSON.stringify(rapport.cle)} : les écritures de « ${m.libelle} » ne sont plus les mêmes`);
      a.forEach((x, i) => {
        if (x.balisee !== b[i].balisee) rapport.changements.push({ mot: m.id, sens: x.balisee ? 'retiree' : 'posee', ecriture: x.ecriture, extrait: extraitDe(avant, x.debut) });
      });
    }
    // une remarque qui recopie la note d'une cellule du classeur (note_cellule) la garde mot pour mot : le contrôle du contenu (serveur/controles-du-contenu.mjs,
    // « remarque : la note … ne figure pas dans la remarque ») refuserait le lot ; elle reste telle quelle, et le rapport le dit
    if (texte !== avant && colonne === 'remarque' && rapport.cle.id !== undefined && Object.keys(rapport.cle).length === 1) {
      const notes = db.prepare('SELECT texte FROM note_cellule WHERE entite_table = ? AND entite_id = ?').all(table, rapport.cle.id);
      if (notes.some((n) => avant.includes(n.texte.trim()) && !texte.includes(n.texte.trim()))) {
        sortie.push({ op: null, rapport: { ...rapport, balisees: {}, retirees: {}, changements: [], sautee: 'remarque qui recopie la note d’une cellule (note_cellule)' } });
        continue;
      }
    }
    if (texte !== avant) sortie.push({ op: { op: 'modifier', table, cle: rapport.cle, valeurs: { [colonne]: texte }, avant: { [colonne]: avant } }, rapport: { ...rapport, modifie: true } });
    else if (rapport.ignorees.length || Object.keys(rapport.retirees).length) sortie.push({ op: null, rapport });
  }
  return sortie;
}

/** Les écritures exclues d'une entrée de `--mots` : une liste, ou des listes rangées par raison ({ raison: [écritures] }). */
export const exclusDe = (exclus) => (Array.isArray(exclus) ? exclus : Object.values(exclus ?? {}).flat());

/** Les contextes exclus d'une entrée de `--mots` ({ raison: [expressions régulières] }) : [{ motif, raison }]. */
const contextesDe = (contextes) => Object.entries(contextes ?? {}).flatMap(([raison, motifs]) => motifs.map((motif) => ({ motif, raison })));

/** Le lot de changements de ce qui diffère entre `avant` et `apres` : scripts/lot-de-source.mjs#lotDesChangements (l'outil générique, qu'importent aussi les importeurs). */
export { lotDesChangements };

/**
 * Balise les mots `mots` ([{ libelle, motif, casse, description, exclus, contextes, horsDe, sauf }]) dans les textes d'une copie de la base `base` (l'extrait
 * du jour du site de dev), ou à défaut d'une base vivante tirée de `rows` (data/rows par défaut) ; rien n'est écrit hors d'un dossier temporaire. Rend
 * { journal, rapport, lot } (`journal` : le journal exporté, « maverick-edition/1 » ; `rapport` : les mots-clés, et colonne par colonne ce qui a été
 * balisé, retiré ou laissé avec la raison ; `lot` : avec l'en-tête `lot` ({ titre, nature, decision? }), le lot de changements à proposer, sinon null).
 */
export function baliser(mots, { rows = join(RACINE, 'data', 'rows'), base = null, lot: entete = null } = {}) {
  // l'en-tête du lot se contrôle avant tout travail
  const nature = entete ? controlerLaNature(entete) : [];
  if (nature.length) throw new Error(`lot : ${nature.join(' ; ')}`);
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-baliser-'));
  try {
    const vivante = join(tmp, 'db');
    let chemin;
    if (base) {
      if (!existsSync(base)) throw new Error(`base introuvable : ${base} (npm run db:extrait)`);
      mkdirSync(vivante, { recursive: true });
      chemin = join(vivante, FICHIER_BASE);
      copyFileSync(base, chemin);
    } else {
      const regles = join(tmp, 'regles.db');
      construireRegles(rows, regles);
      chemin = preparerBaseVivante({ regles, dossier: vivante }).chemin;
    }
    const db = ouvrirBaseVivante(chemin);
    // la base telle qu'elle était avant l'outil : l'« avant » du lot
    const avant = entete ? copierLaBase(db, join(tmp, 'avant.db')) : null;
    try {
      const version = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
      const service = { base: () => db, etat: () => ({ version }), edition: true, dossier: vivante, reference: null, adresse: null, github: null, limites: { delai: 0, parJour: Infinity }, journal: () => {} };
      const appel = (methode, chemin, corps) => traiter({ methode, chemin, entetes: { 'content-type': 'application/json' }, corps: corps === undefined ? undefined : JSON.stringify(corps) }, service);
      const enregistrer = (corps) => {
        const r = appel('POST', '/api/edition/', corps);
        if (r.statut !== 200) throw new Error(`le service refuse un lot (${r.statut}) : ${JSON.stringify(r.corps)}`);
        return r.corps;
      };
      // les mots-clés, sur la page du glossaire (comme « + Mot-clé » de /recherche/ en mode modification)
      const motsCles = [];
      for (const m of mots) {
        // le mot-clé de cette écriture (sa clé, ou son libellé quand un seul mot-clé le porte : lib/mots-cles-balises.mjs#motCleDeLaRef, la règle des balises),
        // sinon créé ; les balises citent sa clé (mot_cle.cle, migration 0113) : `id` est ici la clé que l'outil écrit
        const existant = motCleDeLaRef(motsClesDeLaBase(db), m.libelle);
        let numero = existant?.id;
        if (!numero) {
          const r = enregistrer({ page: 'recherche', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: m.libelle, description: m.description } }] });
          numero = r.crees[0].id;
        }
        const { libelle, cle: id } = db.prepare('SELECT libelle, cle FROM mot_cle WHERE id = ?').get(numero);
        const mot = { id, libelle, motif: m.motif, casse: m.casse === true, noms: nomsAvecLeMot(db, m.motif, m.casse === true), exclus: exclusDe(m.exclus),
          contextes: contextesDe(m.contextes), horsDe: m.horsDe ?? [], sauf: m.sauf ?? [], cree: !existant,
          usage: { exclus: new Set(), contextes: new Set(), horsDe: new Set(), sauf: new Set() } };
        // une exclusion ou un contexte qui cite un mot précédent ne se lirait jamais (ce mot y est déjà balisé)
        for (const precedent of motsCles) {
          const cite = [...mot.exclus, ...mot.contextes.map((c) => c.motif)].find((e) => ecrituresDuMot(precedent.motif, 'iu', precedent.casse).test(e));
          if (cite) throw new Error(`« ${m.libelle} » : « ${cite} » cite « ${precedent.libelle} », déjà balisé quand il est lu`);
        }
        motsCles.push(mot);
      }
      // les textes, un lot par colonne (coupé au-delà de LOT_MAX textes)
      const colonnes = [];
      for (const texte of TEXTES) {
        const modifs = modificationsDe(db, texte, motsCles);
        colonnes.push(...modifs.map((x) => x.rapport));
        const ops = modifs.map((x) => x.op).filter(Boolean);
        for (let k = 0; k < ops.length; k += LOT_MAX) enregistrer({ page: `glossaire:${texte.table}.${texte.colonne}`, operations: ops.slice(k, k + LOT_MAX) });
      }
      const journal = journalExporte(db);
      const rapportDuMot = ({ usage, ...m }) => ({ ...m, inutilises: {
        exclus: m.exclus.filter((e) => !usage.exclus.has(e)),
        contextes: m.contextes.filter((c) => !usage.contextes.has(c.motif)).map((c) => c.motif),
        horsDe: m.horsDe.filter((e) => !usage.horsDe.has(e)),
        sauf: m.sauf.filter((e) => !usage.sauf.has(e)),
      } });
      const lot = avant ? lotDesChangements(avant, db, entete) : null;
      return { journal, rapport: { motsCles: motsCles.map(rapportDuMot), colonnes }, lot };
    } finally {
      avant?.close();
      db.close();
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  const fichierMots = option('--mots');
  const sortie = option('--lot');
  if (args.includes('--appliquer')) {
    console.error('--appliquer est retiré (bascule 1, R274) : l\'outil écrit un lot de changements (--lot), à proposer au site de dev (POST /api/edition/lots/).');
    process.exit(2);
  }
  if (!fichierMots || !sortie || !option('--nature')) {
    console.error('usage : node scripts/baliser-mot-cle.mjs --mots <mots.json> --lot <lot.json> --nature <source|decision|migration|code> [--decision R…] [--titre <titre>] '
      + '[--base <fichier.db> | --rows <dossier>] [--journal <journal.json>] [--rapport <rapport.json>]');
    process.exit(2);
  }
  const mots = JSON.parse(readFileSync(resolve(fichierMots), 'utf8'));
  const rows = option('--rows') ? resolve(option('--rows')) : undefined;
  const base = rows ? null : resolve(option('--base') ?? EXTRAIT_PAR_DEFAUT);
  const entete = { titre: option('--titre') ?? `Baliser ${mots.map((m) => `« ${m.libelle} »`).join(', ')} dans les textes`, nature: option('--nature'),
    ...(option('--decision') ? { decision: option('--decision') } : {}) };
  const { journal, rapport, lot } = baliser(mots, { rows, base, lot: entete });
  writeFileSync(resolve(sortie), `${JSON.stringify(lot, null, 2)}\n`);
  if (option('--journal')) writeFileSync(resolve(option('--journal')), `${JSON.stringify(journal, null, 2)}\n`);
  if (option('--rapport')) writeFileSync(resolve(option('--rapport')), `${JSON.stringify(rapport, null, 2)}\n`);
  const compte = (id, cle) => rapport.colonnes.reduce((s, c) => s + (c[cle]?.[id] ?? 0), 0);
  const changements = (id, sens) => rapport.colonnes.flatMap((c) => c.changements ?? []).filter((x) => x.mot === id && x.sens === sens).length;
  for (const m of rapport.motsCles) {
    const ignorees = rapport.colonnes.flatMap((c) => c.ignorees).filter((i) => i.mot === m.id);
    console.log(`${m.libelle} (${m.id}${m.cree ? ', créé' : ''}) : ${compte(m.id, 'retirees')} balise(s) relue(s), ${compte(m.id, 'balisees')} posée(s) `
      + `(${changements(m.id, 'retiree')} retirée(s) sans être reposée(s), ${changements(m.id, 'posee')} nouvelle(s)), `
      + `${ignorees.length} écriture(s) laissée(s) dans les textes relus`);
    const inutiles = Object.entries(m.inutilises).filter(([, l]) => l.length).map(([k, l]) => `${k} : ${l.map((e) => `« ${e} »`).join(', ')}`);
    if (inutiles.length) console.log(`  écrit pour rien (aucun texte relu) — ${inutiles.join(' ; ')}`);
  }
  const reecrits = rapport.colonnes.filter((c) => c.modifie).length;
  const sautees = Object.entries(Object.groupBy(rapport.colonnes.filter((c) => c.sautee), (c) => c.sautee)).map(([r, l]) => `${l.length} ${r}`);
  console.log(`${reecrits} texte(s) réécrit(s) ; lignes qui écrivent le mot sans être relues : ${sautees.join(', ') || 'aucune'}`);
  console.log(`base de départ : ${base ?? rows} ; lot : ${lot.operations.length} opération(s) -> ${sortie} (à proposer : POST /api/edition/lots/, skill modifier-une-page-wiki)`);
  if (!base) console.log('attention : base tirée d\'un dossier de lignes, copie datée ; l\'essai à blanc du site de dev refusera un « avant » qui n\'est plus en place.');
}
