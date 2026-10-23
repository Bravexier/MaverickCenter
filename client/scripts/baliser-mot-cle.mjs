// `node scripts/baliser-mot-cle.mjs --mots <mots.json> --journal <journal.json> [--appliquer] [--rows <dossier>] [--rapport <rapport.json>]`
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
// Étapes, comme scripts/mise-a-jour-simulation.mjs : la base des règles est construite depuis data/rows, une base vivante en est tirée, et le service du
// site de dev (serveur/api.mjs, édition ouverte) y fait les modifications — les mots-clés créés (/recherche/), puis un lot par colonne (au plus LOT_MAX
// textes chacun) qui réécrit les textes ; tout ce qui en dépend (pages typées, colonnes tirées d'un texte) est refait par le service. Le journal est
// écrit dans `--journal` ; `--appliquer` le rapatrie dans data/rows (scripts/db-appliquer-edition.mjs#appliquerJournal : journal rejoué, versé dans
// historique_modification, data/rows réécrit). Ensuite : `npm run db:build && npm run db:check`, `npm test`, le build et ses tests.
// Les textes réécrits (TEXTES, lib/glossaire-balisage.mjs pour ce qui n'est jamais balisé) : ceux que le site de dev modifie (lib/edition-modele.mjs#TABLES),
// les textes longs (champ « texte ») et mis en forme (« markdown » : le guide et le Codex, la chronologie, les panneaux de règles), plus quatre textes
// d'une ligne qui sont des phrases ; jamais un nom, un titre, un libellé, une liste de noms, une valeur rangée (affinité), ni une rubrique de carte de
// monstre que la carte découpe en tuiles ou en pastilles (RUBRIQUES_DECOUPEES) : sa balise en changerait l'affichage.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliquerJournal } from './db-appliquer-edition.mjs';
import { traiter } from '../serveur/api.mjs';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { journalExporte } from '../serveur/edition-journal.mjs';
import { TABLES, texteDePageModifiable } from '../src/lib/edition-modele.mjs';
import { baliserLeMot, ecrituresDuMot, ecrituresDuMotDans, sansLesBalisesDuMot } from '../src/lib/glossaire-balisage.mjs';
import { SENS_DEFENSE } from '../src/lib/monstre-champs.mjs';
import { normalize } from '../src/lib/text.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

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
    if (texte !== avant) sortie.push({ op: { op: 'modifier', table, cle: rapport.cle, valeurs: { [colonne]: texte }, avant: { [colonne]: avant } }, rapport: { ...rapport, modifie: true } });
    else if (rapport.ignorees.length || Object.keys(rapport.retirees).length) sortie.push({ op: null, rapport });
  }
  return sortie;
}

/** Les écritures exclues d'une entrée de `--mots` : une liste, ou des listes rangées par raison ({ raison: [écritures] }). */
export const exclusDe = (exclus) => (Array.isArray(exclus) ? exclus : Object.values(exclus ?? {}).flat());

/** Les contextes exclus d'une entrée de `--mots` ({ raison: [expressions régulières] }) : [{ motif, raison }]. */
const contextesDe = (contextes) => Object.entries(contextes ?? {}).flatMap(([raison, motifs]) => motifs.map((motif) => ({ motif, raison })));

/**
 * Balise les mots `mots` ([{ libelle, motif, casse, description, exclus, contextes, horsDe, sauf }]) dans les textes d'une base vivante tirée de `rows`
 * (data/rows par défaut) ; rend { journal, rapport } (`journal` : le journal exporté, « maverick-edition/1 » ; `rapport` : les mots-clés, et colonne par
 * colonne ce qui a été balisé, retiré ou laissé avec la raison).
 */
export function baliser(mots, { rows = join(RACINE, 'data', 'rows') } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-baliser-'));
  try {
    const regles = join(tmp, 'regles.db');
    construireRegles(rows, regles);
    const vivante = join(tmp, 'db');
    const db = ouvrirBaseVivante(preparerBaseVivante({ regles, dossier: vivante }).chemin);
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
        const existant = db.prepare('SELECT id, libelle FROM mot_cle WHERE libelle_cle = ?').get(normalize(m.libelle));
        let id = existant?.id;
        if (!id) {
          const r = enregistrer({ page: 'recherche', operations: [{ op: 'creer', entite: 'mot_cle', valeurs: { libelle: m.libelle, description: m.description } }] });
          id = r.crees[0].id;
        }
        const libelle = db.prepare('SELECT libelle FROM mot_cle WHERE id = ?').get(id).libelle;
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
      return { journal, rapport: { motsCles: motsCles.map(rapportDuMot), colonnes } };
    } finally {
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
  const sortie = option('--journal');
  if (!fichierMots || !sortie) {
    console.error('usage : node scripts/baliser-mot-cle.mjs --mots <mots.json> --journal <journal.json> [--appliquer] [--rows <dossier>] [--rapport <rapport.json>]');
    process.exit(2);
  }
  const rows = option('--rows') ? resolve(option('--rows')) : undefined;
  const { journal, rapport } = baliser(JSON.parse(readFileSync(resolve(fichierMots), 'utf8')), { rows });
  writeFileSync(resolve(sortie), `${JSON.stringify(journal, null, 2)}\n`);
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
  console.log(`journal : ${journal.lots.length} lot(s), ${journal.lots.reduce((s, l) => s + l.modifications.length, 0)} modification(s) -> ${sortie}`);
  if (args.includes('--appliquer')) {
    const r = appliquerJournal(journal, rows ? { rows } : {});
    console.log(JSON.stringify({ bilan: r.bilan, conflits: r.conflits, ecrit: r.ecrit, historisees: r.historisees }));
    if (r.conflits.length) process.exit(1);
  }
}
