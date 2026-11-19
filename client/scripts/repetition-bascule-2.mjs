#!/usr/bin/env node
// La répétition, sur des copies, de ce que la production fera le jour J de la bascule 2 : étape A (lot 11 « Bascule 2 », PR 3a ; docs/serveur.md, « Bascule 2 : préparation »,
// « Répétition complète du jour J »). Livré avec le service dans _serveur/scripts/ (serveur/livraison.mjs#FICHIERS_JOINTS) : deploy/installateur/repetition-bascule-2.sh le lance DANS un
// conteneur du code du site de dev (l'image et le site de son instance : docker compose run du service « serveur »), sur une COPIE de la base de la production posée dans `--travail`.
// Rien d'autre n'est lu ni écrit : la vraie production n'est jamais touchée, ni la base du site de dev, ni db/mise-a-jour/.
//   1. Le contenu à livrer, fabriqué comme le fait le bouton « Simulation de mise à jour » (serveur/paquet.mjs#fabriquerPaquet, mode `simulation`) : un PAQUET, pas un extrait. Choix : le
//      jour J, la production reçoit un paquet (la note de version de la prochaine version X.Y, les notes d'exemple retirées, la fiche d'identité) et le garde-fou 17 lit ce paquet
//      (version, structure, notes) ; un extrait n'a rien de tout cela. fabriquerPaquet est pur (fichiers en argument) : aucune écriture dans la base source ni dans db/mise-a-jour/.
//      La référence de la note est ce que la production publie (`--production` : son site monté en lecture seule, donnees/maverick.db et _serveur/version.json), comme le bouton.
//   2. controlerLeContenu (garde-fou 18) sur ce paquet : des comptes et des emplacements (table, identifiant, règle), jamais un texte de fiche.
//   3. controlerLActivation (garde-fou 17) : le kit est décrit par sa version et sa structure (`--kit-version`, `--kit-structure` : kit.json et le schema.sql du kit, lus par le .sh) ;
//      le paquet est celui qu'on vient de fabriquer, la production celle de la COPIE (ses notes de version). Tant que kit.json n'annonce pas son paquet, l'empreinte annoncée est celle du paquet
//      fabriqué : ce contrôle-là n'est pas éprouvé ici (le test de serveur/activation.mjs l'éprouve).
//   4. La base de la production refaite avec ses fiches, comme repetition-prod.mjs (preparerBaseVivante en mode production sur la copie) mais avec le paquet pour contenu.
// Le paquet (<travail>/contenu/paquet.db, 644) reste dans le dossier de travail : l'étape B (les pages) le donne à un conteneur sans privilège.
// Sortie : des COMPTES seulement. Code 0 : la bascule PASSERAIT pour cette étape ; 1 : REFUSEE (les raisons sont dites) ; 2 : impossible (usage, fichier, référence illisible).
// La dernière ligne `@@version-paquet=X.Y` est lue par le .sh (chiffres seulement) pour étiqueter les pages de la production.
//   node repetition-bascule-2.mjs --source <vivante.db du site de dev> --travail <dossier> --production <site de la production> --kit-version X.Y.Z --kit-structure N [--json]
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { lireReference } from '../serveur/notes-de-version.mjs';
import { fabriquerPaquet, lireMetaDuPaquet } from '../serveur/paquet.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { controlerLActivation } from '../serveur/activation.mjs';
import { versionCourte, versionDeLivraison } from '../src/lib/notes-de-version.mjs';
import { lignesDeLaBase, repeter, sansValeurs } from './repetition-prod.mjs';

export const FORMAT_DE_LA_REPETITION_2 = 'maverick-repetition-bascule-2/1';
/** Les problèmes du contenu nommés dans le rapport (le total reste exact). */
export const PROBLEMES_NOMMES = 20;

/** Une répétition qui ne peut pas avoir lieu (usage, fichier absent, référence de la production illisible) : code 2, jamais un verdict. */
export class RepetitionImpossible extends Error {}

/** La version du service livré à côté (_serveur/version.json), null hors livraison. */
function versionDuService() {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('../version.json', import.meta.url)), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

const octets = (chemin) => (existsSync(chemin) ? statSync(chemin).size : 0);

/** Ce que le contrôle du contenu et le garde-fou 17 lisent du paquet : { schema, notes (versions des notes réelles), tables (nombre de tables) }. Lecture seule. */
function lireLePaquet(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const controle = controlerLeContenu(db);
    return {
      controle,
      schema: db.prepare('PRAGMA user_version').get().user_version,
      notes: db.prepare('SELECT version FROM note_version WHERE exemple = 0').all().map((n) => n.version),
      tables: db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'").get().n,
    };
  } finally {
    db.close();
  }
}

/** Les versions des notes de version réelles (pas les exemples) de la base de la production (la copie). */
function notesDeLaProduction(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get()) return [];
    return db.prepare('SELECT version FROM note_version WHERE exemple = 0').all().map((n) => n.version);
  } finally {
    db.close();
  }
}

/**
 * La répétition de l'étape A : { format, verdict ('passera' | 'refusee'), version_du_code, version_cible, depuis, paquet, contenu, activation, base, refus, duree_ms }.
 * @param {{ source: string, travail: string, production: string, kit: { version: string, structure: number }, versionDev?: string | null, instant?: Date,
 *   chute?: { pourcent?: number, min?: number }, propre?: string | null }} o
 *   `production` : le site de la production (donnees/maverick.db, _serveur/version.json), monté en lecture seule ; `propre` : la base des règles de ce site (refus si c'est le même fichier).
 */
export function repeterLaBascule2({ source, travail, production, kit, versionDev = versionDuService(), instant = new Date(), chute = {}, propre = null }) {
  const t0 = performance.now();
  const copie = join(travail, 'prod', 'vivante.db');
  if (!existsSync(copie)) throw new RepetitionImpossible('copie de la base de la production absente (prod/vivante.db du dossier de travail)');
  if (!existsSync(source)) throw new RepetitionImpossible('base du site de dev introuvable (--source)');
  if (!versionDev) throw new RepetitionImpossible('version du code du site de dev inconnue (_serveur/version.json)');
  const reference = lireReference({ production, propre });
  if (!reference.disponible || reference.source !== 'production') {
    throw new RepetitionImpossible(`ce que la production publie n'est pas lisible : ${reference.raison ?? 'dossier de la production absent'} (--production)`);
  }
  const versionCible = versionDeLivraison(versionDev, reference.version);
  const depuis = versionCourte(reference.version);
  const refus = [];

  // 1. le paquet, comme la simulation de mise à jour (la base source n'est ni modifiée ni écrite : fabriquerPaquet n'écrit que la destination)
  const dossier = join(travail, 'contenu');
  mkdirSync(dossier, { recursive: true });
  chmodSync(dossier, 0o755);
  const chemin = join(dossier, 'paquet.db');
  let meta = null;
  try {
    meta = fabriquerPaquet({
      source, destination: chemin, production: reference.chemin, id: 'repetition-bascule-2', mode: 'simulation', version: versionCible, depuis,
      versionDuSite: versionDev, instant, majeure: false, texte: null,
    });
    chmodSync(chemin, 0o644);
  } catch (e) {
    refus.push({ etape: 'paquet', raison: 'paquet', message: `le paquet ne se fabrique pas : ${sansValeurs(e?.message ?? e)}` });
  }

  let contenu = null;
  let activation = null;
  let base = null;
  if (meta) {
    // 2. le contenu réel (garde-fou 18)
    const lu = lireLePaquet(chemin);
    const { problemes, emplacements } = lu.controle;
    contenu = {
      tables_controlees: lu.tables, problemes: problemes.length, avertissements: lu.controle.avertissements?.length ?? 0,
      nommes: problemes.slice(0, PROBLEMES_NOMMES).map((_, i) => ({ table: emplacements[i]?.table ?? null, id: emplacements[i]?.id ?? null, regle: emplacements[i]?.regle ?? null })),
    };
    if (problemes.length) refus.push({ etape: 'contenu', raison: 'contenu', message: `le contenu a ${problemes.length} problème(s) : le bouton refuserait la mise à jour (garde-fou 18)` });

    // 3. l'activation (garde-fou 17) : le kit tel que kit.json et son schema.sql le décrivent, le paquet tel qu'il est, la production telle que sa copie la dit
    const octetsDuPaquet = readFileSync(chemin);
    activation = controlerLActivation({
      kit: { version: kit.version, structure: kit.structure, paquet: { version: meta.version, sha256: meta.fichier.sha256 } },
      paquet: { sha256: createHash('sha256').update(octetsDuPaquet).digest('hex'), schema: lu.schema, version: lireMetaDuPaquet(chemin)?.version ?? null, notes: lu.notes },
      production: { notes: notesDeLaProduction(copie), version: depuis },
    });
    for (const r of activation.refus) refus.push({ etape: 'activation', raison: r.raison, message: r.message });

    // 4. la base de la production refaite avec ses fiches (le paquet pour contenu)
    base = repeter({ source, travail, version: versionDev, instant, chute, contenu: chemin });
    if (base.verdict !== 'passera') refus.push({ etape: 'base', raison: 'fiches', message: `les fiches ne passent pas dans le contenu à livrer (${base.refus.total} problème(s)) : la production garderait sa base` });
  }

  return {
    format: FORMAT_DE_LA_REPETITION_2,
    verdict: refus.length === 0 ? 'passera' : 'refusee',
    version_du_code: versionDev,
    version_cible: versionCible,
    depuis,
    kit,
    paquet: meta ? { schema: meta.schema, tables_de_contenu: meta.tables_de_contenu.length, lignes_de_note: meta.lignes, octets: meta.fichier.octets, empreinte: meta.fichier.sha256, duree_ms: meta.duree_ms } : null,
    contenu,
    activation: activation ? { ok: activation.ok, refus: activation.refus } : null,
    base,
    refus,
    duree_ms: Math.round(performance.now() - t0),
    octets: { paquet: octets(chemin) },
  };
}

const mo = (n) => `${(n / 1048576).toFixed(1)} Mo`;
const s = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** Le texte du rapport de l'étape A : une ligne par fait, des comptes (et des emplacements table/identifiant/règle) seulement. */
export function texteDeLaBascule2(x) {
  const l = [];
  l.push(x.verdict === 'passera'
    ? `étape A PASSERAIT : le contenu à livrer (V${x.version_cible}, depuis la V${x.depuis}) passe les contrôles, la production refait sa base avec ses fiches`
    : `étape A REFUSEE : ${x.refus.length} refus (${[...new Set(x.refus.map((r) => r.raison))].join(', ')})`);
  l.push(`code du site de dev essayé : ${x.version_du_code} ; kit : V${x.kit.version}, structure ${x.kit.structure ?? 'inconnue'}`);
  if (x.paquet) {
    l.push(`paquet (simulation de mise à jour) : V${x.version_cible}, schéma ${x.paquet.schema}, ${x.paquet.tables_de_contenu} table(s) de contenu, ${x.paquet.lignes_de_note} ligne(s) de note, ${mo(x.paquet.octets)}, empreinte ${x.paquet.empreinte.slice(0, 12)}…, fabriqué en ${s(x.paquet.duree_ms)}`);
    l.push(`contrôle du contenu : ${x.contenu.tables_controlees} table(s) contrôlée(s), ${x.contenu.problemes} problème(s)`);
    for (const p of x.contenu.nommes) l.push(`problème du contenu : ${p.table ?? 'base'}${p.id === null ? '' : ` ${p.id}`} (règle ${p.regle ?? 'inconnue'})`);
    if (x.contenu.problemes > x.contenu.nommes.length) l.push(`problème du contenu : … et ${x.contenu.problemes - x.contenu.nommes.length} autre(s)`);
    l.push(x.activation.ok ? 'activation (garde-fou 17) : acceptée' : `activation (garde-fou 17) : refusée (${x.activation.refus.length} raison(s))`);
    for (const r of x.activation.refus) l.push(`activation : ${r.message}`);
  }
  for (const r of x.refus.filter((e) => e.etape === 'paquet')) l.push(`paquet : ${r.message}`);
  if (x.base) {
    const b = x.base;
    l.push(`production (copie) : schéma ${b.production.schema}, ${b.production.fiches} fiche(s), ${mo(b.production.octets)}`);
    if (b.refus) {
      l.push(`base de la production : NON refaite (${b.refus.raison}, ${b.refus.total} problème(s))`);
      for (const p of b.refus.problemes) l.push(`problème : ${p}`);
    } else {
      l.push(`base de la production refaite : schéma ${b.base.schema_avant} → ${b.base.schema_apres}${b.base.identique ? ' (rien ne change)' : ''}, ${b.fiches_adaptees.fiches} fiche(s) adaptée(s)`);
      l.push(...lignesDeLaBase(b));
    }
    for (const j of b.journal) l.push(`journal du service : ${j}`);
  }
  l.push(`durée de l'étape A : ${s(x.duree_ms)} ; dossier de travail : ${mo(x.octets.paquet)} de paquet`);
  if (x.paquet) l.push(`@@version-paquet=${x.version_cible}`);
  return l.join('\n');
}

function principal(args) {
  const o = {};
  const valeurs = ['--source', '--travail', '--production', '--kit-version', '--kit-structure', '--chute-pourcent', '--chute-min', '--version-du-code'];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--json') o.json = true;
    else if (valeurs.includes(a) && i + 1 < args.length) o[a.slice(2)] = args[(i += 1)];
    else {
      console.error(`option inconnue : ${a}`);
      return 2;
    }
  }
  if (!o.source || !o.travail || !o.production || !/^\d+\.\d+\.\d+$/.test(o['kit-version'] ?? '') || !/^\d{1,6}$/.test(o['kit-structure'] ?? '')) {
    console.error('Usage : node repetition-bascule-2.mjs --source <vivante.db du site de dev> --travail <dossier> --production <site de la production> --kit-version X.Y.Z --kit-structure N [--json]');
    return 2;
  }
  const entier = (v, defaut) => (/^\d{1,6}$/.test(String(v ?? '')) ? Number(v) : defaut);
  const x = repeterLaBascule2({
    source: resolve(o.source), travail: resolve(o.travail), production: resolve(o.production), kit: { version: o['kit-version'], structure: Number(o['kit-structure']) },
    ...(o['version-du-code'] ? { versionDev: o['version-du-code'] } : {}), chute: { pourcent: entier(o['chute-pourcent'], 20), min: entier(o['chute-min'], 20) },
    propre: process.env.MAVERICK_REGLES ? resolve(process.env.MAVERICK_REGLES) : null,
  });
  console.log(o.json ? JSON.stringify(x) : texteDeLaBascule2(x));
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
