#!/usr/bin/env node
// La répétition de la dernière mise à jour de la production par l'ancien circuit (lot 8 du chantier « la base du site de dev devient la source de vérité » ;
// docs/serveur.md, « Répétition de la mise à jour de la production »). Livré avec le service dans _serveur/scripts/ (serveur/livraison.mjs#FICHIERS_JOINTS) :
// deploy/installateur/repetition-prod.sh le lance DANS un conteneur du code du site de dev (l'image et le site de son instance), sur une COPIE de la base de
// la production posée dans `--travail`. Rien d'autre n'est lu ni écrit : la vraie production n'est jamais touchée.
//   1. le contenu à venir : l'extrait du contenu de la base du site de dev (serveur/extrait.mjs : les tables de contenu, les modifications en attente versées
//      dans l'historique ; ni fiche, ni compte, ni journal), comme le fichier des règles que la production recevra ;
//   2. ce que ferait le service de la production à son démarrage : preparerBaseVivante en mode production (sans essai dans l'ombre) sur la copie : fiches
//      recopiées, conversions, retraits de la décision R42 et de l'armure (R165), contrôle des clés des fiches.
// Sortie : des COMPTES seulement (jamais un nom de fiche ni une valeur) : « PASSERA … » (code 0 : la production prendra le nouveau contenu, ses fiches
// adaptées), ou « REFUSEE … » (code 1 : la production garderait sa base, et son service tournerait sur elle), puis le détail ; code 2 : usage ou fichier illisible.
//   node repetition-prod.mjs --source <vivante.db du site de dev> --travail <dossier> [--chute-pourcent 20 --chute-min 20] [--json]
// (`--chute-*` : les seuils des sauvegardes, pour annoncer les « chutes anormales » que la copie horaire verra après l'installation.)
// `--travail` contient prod/vivante.db (la copie) et, s'il existe, prod/vivante.json ; le script y écrit contenu.db et refait prod/ (la copie, archivée dans
// prod/archives/ comme la production le ferait). L'appelant efface le dossier.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { ErreurBaseVivante, FICHIER_BASE, preparerBaseVivante, TABLES_VIVANTES } from '../serveur/base-vivante.mjs';
import { fabriquerExtrait } from '../serveur/extrait.mjs';
import { ORDRE_DES_NATURES, TABLES_FICHES } from '../src/lib/fiche-format.mjs';

export const FORMAT_DE_LA_REPETITION = 'maverick-repetition-prod/1';

/** La version du service livré à côté (_serveur/version.json), null hors livraison. */
function versionDuService() {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../version.json', import.meta.url)), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

const octets = (chemin) => (existsSync(chemin) ? statSync(chemin).size : 0);
const octetsDuDossier = (dossier) => (existsSync(dossier) ? readdirSync(dossier, { recursive: true }).reduce((n, f) => {
  const s = statSync(join(dossier, String(f)));
  return n + (s.isFile() ? s.size : 0);
}, 0) : 0);

/**
 * user_version et nombre de lignes de chaque table (celles que comptent les sauvegardes, sauvegarde/lib.sh#comptes_de : tout `type = 'table'` hors sqlite_*) :
 * { schema, toutes: { table → n }, lignes: { table des fiches → n } }. Lecture seule ; les noms viennent de sqlite_master.
 */
function relever(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const toutes = {};
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name").all()) {
      toutes[name] = db.prepare(`SELECT count(*) AS n FROM "${name.replace(/"/g, '""')}"`).get().n;
    }
    const lignes = Object.fromEntries(TABLES_FICHES.filter((t) => t in toutes).map((t) => [t, toutes[t]]));
    return { schema: db.prepare('PRAGMA user_version').get().user_version, toutes, lignes };
  } finally {
    db.close();
  }
}

/**
 * Les « chutes anormales » que la copie horaire des sauvegardes verra après l'installation (sauvegarde/copie.sh#chutes, mêmes seuils : une table qui avait au moins
 * `min` lignes et en perd plus de `pourcent` %, une table disparue comprise) : la copie sera mise de côté et l'alerte restera jusqu'à « copie.sh accepter prod ».
 */
export function chutesAttendues(avant, apres, { pourcent = 20, min = 20 } = {}) {
  return Object.entries(avant).filter(([t, r]) => r >= min && (apres[t] ?? 0) * 100 < r * (100 - pourcent))
    .map(([table, r]) => ({ table, avant: r, apres: apres[table] ?? null }));
}

/** Contrôle de la base refaite : integrity_check et clés étrangères (des comptes). */
function controler(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const integrite = db.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]);
    const rompues = db.prepare('PRAGMA foreign_key_check').all();
    // celles des fiches (et du journal) d'abord : le contenu peut en porter de lui-même (l'extrait les compte aussi)
    const desFiches = rompues.filter((l) => TABLES_VIVANTES.includes(l.table)).length;
    return { integrite: integrite.join() === 'ok' ? 'ok' : `${integrite.length} problème(s)`, cles_rompues_fiches: desFiches, cles_rompues_contenu: rompues.length - desFiches };
  } finally {
    db.close();
  }
}

/** Un problème sans valeur citée : « … = « x » absent de … » devient « … = « … » absent de … » (une valeur peut venir d'une fiche). */
export const sansValeurs = (texte) => String(texte).replace(/« [^»]*»/g, '« … »').slice(0, 400);

/**
 * La répétition : { format, verdict ('passera' | 'refusee'), version, production, contenu, base, fiches_adaptees, rejeu, refus, controle, duree_ms, octets }.
 * @param {{ source: string, travail: string, version?: string | null, instant?: Date }} o
 */
export function repeter({ source, travail, version = versionDuService(), instant = new Date(), chute = {} }) {
  const t0 = performance.now();
  const dossier = join(travail, 'prod');
  const copie = join(dossier, FICHIER_BASE);
  if (!existsSync(copie)) throw new Error('copie de la base de la production absente (prod/vivante.db du dossier de travail)');
  if (!existsSync(source)) throw new Error('base du site de dev introuvable (--source)');
  const avant = relever(copie);
  const production = { schema: avant.schema, fiches: avant.lignes.personnage ?? 0, octets: octets(copie) };

  const contenuChemin = join(travail, 'contenu.db');
  const meta = fabriquerExtrait({ source, destination: contenuChemin, version, instant });
  const contenu = {
    schema: meta.schema, tables: Object.keys(meta.tables ?? {}).length, modifications_versees: meta.modifications_versees, cles_etrangeres_rompues: meta.cles_etrangeres_rompues,
    octets: meta.fichier?.octets ?? octets(contenuChemin), duree_ms: meta.duree_ms,
  };

  const evenements = {};
  const journal = [];
  let r = null;
  let refus = null;
  const t1 = performance.now();
  try {
    r = preparerBaseVivante({ regles: contenuChemin, dossier, instant, version, journal: (m) => journal.push(sansValeurs(m)), evenement: (type, e) => { evenements[type] = e?.detail ?? null; } });
  } catch (e) {
    refus = {
      raison: e instanceof ErreurBaseVivante ? 'les fiches ne passent pas dans le contenu à venir' : 'la préparation a échoué',
      problemes: (e?.problemes?.length ? e.problemes : [e?.message ?? String(e)]).map(sansValeurs).slice(0, 30),
      total: e?.problemes?.length || 1,
    };
  }
  const preparation_ms = Math.round(performance.now() - t1);
  const apres = relever(copie);
  const lignes = Object.fromEntries([...new Set([...Object.keys(avant.lignes), ...Object.keys(apres.lignes)])]
    .filter((t) => avant.lignes[t] !== apres.lignes[t]).map((t) => [t, { avant: avant.lignes[t] ?? null, apres: apres.lignes[t] ?? null }]));
  const natures = evenements.retraits_fiches?.natures ?? {};
  const resultat = {
    format: FORMAT_DE_LA_REPETITION,
    verdict: refus ? 'refusee' : 'passera',
    version,
    production,
    contenu,
    base: refus ? { refaite: false, gardee: true, schema: avant.schema }
      : { refaite: Boolean(r.refaite), identique: Boolean(r.identique), schema_avant: avant.schema, schema_apres: apres.schema, fiches_avant: avant.lignes.personnage ?? 0,
        fiches_apres: apres.lignes.personnage ?? 0, lignes_changees: lignes, archive_octets: r.archive ? octets(r.archive) : 0, octets: octets(copie) },
    fiches_adaptees: refus ? null : {
      fiches: r.fiches?.length ?? 0,
      par_nature: Object.fromEntries(Object.entries(natures).sort(([a], [b]) => ORDRE_DES_NATURES.indexOf(a) - ORDRE_DES_NATURES.indexOf(b))),
    },
    rejeu: evenements.rejeu ?? null,
    refus,
    controle: refus ? null : controler(copie),
    chutes: refus ? [] : chutesAttendues(avant.toutes, apres.toutes, chute),
    journal: journal.slice(0, 10),
    duree_ms: { contenu: contenu.duree_ms, preparation: preparation_ms, totale: Math.round(performance.now() - t0) },
    octets: { travail: octetsDuDossier(travail) },
  };
  return resultat;
}

const mo = (n) => `${(n / 1048576).toFixed(1)} Mo`;
const s = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** Le texte du rapport : une ligne par fait, des comptes seulement. */
export function texteDeLaRepetition(x) {
  const l = [];
  if (x.verdict === 'passera') {
    l.push(`PASSERA : la production prendra le contenu du site de dev (base refaite${x.base.identique ? ' : rien ne change' : ''}, schéma ${x.base.schema_avant} → ${x.base.schema_apres}), ${x.fiches_adaptees.fiches} fiche(s) adaptée(s)`);
  } else {
    l.push(`REFUSEE : la production garderait sa base (schéma ${x.base.schema}) et son service nouveau tournerait sur elle ; ${x.refus.raison} (${x.refus.total} problème(s))`);
  }
  l.push(`version du code essayé : ${x.version ?? 'inconnue'}`);
  l.push(`production (copie) : schéma ${x.production.schema}, ${x.production.fiches} fiche(s), ${mo(x.production.octets)}`);
  l.push(`contenu à venir (extrait du site de dev) : schéma ${x.contenu.schema}, ${x.contenu.tables} table(s) de contenu, ${x.contenu.modifications_versees} modification(s) en attente versée(s) dans l’historique, ${x.contenu.cles_etrangeres_rompues} clé(s) étrangère(s) rompue(s), ${mo(x.contenu.octets)}`);
  if (x.refus) {
    for (const p of x.refus.problemes) l.push(`problème : ${p}`);
  } else {
    l.push(`fiches : ${x.base.fiches_avant} avant, ${x.base.fiches_apres} après`);
    for (const [t, n] of Object.entries(x.base.lignes_changees)) l.push(`table ${t} : ${n.avant ?? 'absente'} → ${n.apres ?? 'absente'} ligne(s)`);
    for (const [nature, n] of Object.entries(x.fiches_adaptees.par_nature)) l.push(`adaptées (${nature}) : ${n.fiches} fiche(s), ${n.elements} élément(s) retiré(s) ou converti(s), une note datée dans chacune`);
    if (x.rejeu) l.push(`journal rejoué : ${x.rejeu.lots ?? 0} lot(s), ${x.rejeu.conflits ?? 0} conflit(s)`);
    l.push(`contrôle de la base refaite : intégrité ${x.controle.integrite}, ${x.controle.cles_rompues_fiches} clé(s) étrangère(s) rompue(s) dans les fiches, ${x.controle.cles_rompues_contenu} dans le contenu`);
    l.push(`base refaite : ${mo(x.base.octets)} ; l’ancienne archivée : ${mo(x.base.archive_octets)} (db/archives/ de la production, 5 gardées)`);
    if (x.chutes.length) {
      l.push(`sauvegardes : ${x.chutes.length} table(s) en « chute anormale » pour la copie horaire suivante (copie mise de côté, alerte sur la page Debug jusqu’à « copie.sh accepter prod ») : ${x.chutes.map((c) => `${c.table} ${c.avant} → ${c.apres ?? 'absente'}`).join(', ')}`);
    } else l.push('sauvegardes : aucune chute anormale attendue');
  }
  for (const j of x.journal) l.push(`journal du service : ${j}`);
  l.push(`durée : contenu ${s(x.duree_ms.contenu)}, préparation ${s(x.duree_ms.preparation)}, totale ${s(x.duree_ms.totale)} ; dossier de travail : ${mo(x.octets.travail)}`);
  return l.join('\n');
}

function principal(args) {
  const o = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--json') o.json = true;
    else if (['--source', '--travail', '--chute-pourcent', '--chute-min'].includes(a) && i + 1 < args.length) o[a.slice(2)] = args[(i += 1)];
    else {
      console.error(`option inconnue : ${a}\nUsage : node repetition-prod.mjs --source <vivante.db du site de dev> --travail <dossier> [--chute-pourcent N --chute-min N] [--json]`);
      return 2;
    }
  }
  if (!o.source || !o.travail) {
    console.error('Usage : node repetition-prod.mjs --source <vivante.db du site de dev> --travail <dossier> [--json]');
    return 2;
  }
  const entier = (v, defaut) => (/^\d{1,6}$/.test(String(v ?? '')) ? Number(v) : defaut);
  const x = repeter({ source: resolve(o.source), travail: resolve(o.travail), chute: { pourcent: entier(o['chute-pourcent'], 20), min: entier(o['chute-min'], 20) } });
  console.log(o.json ? JSON.stringify(x) : texteDeLaRepetition(x));
  return x.verdict === 'passera' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    console.error(`répétition impossible : ${sansValeurs(e?.message ?? e)}`);
    process.exitCode = 2;
  }
}
