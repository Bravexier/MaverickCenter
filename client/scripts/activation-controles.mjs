#!/usr/bin/env node
// Les contrôles d'activation d'un kit par la production (lot 11 « Bascule 2 », PR 5a ; docs/chantier-base-de-dev.md §9, garde-fous 17 et 18 ; docs/serveur.md, « Bascule 2 : préparation »,
// « PR 5a »). Ils tournent DANS le conteneur sans privilège que lance deploy/installateur/activer.sh (aucun réseau, système de fichiers en lecture seule, aucune capacité, utilisateur 65534),
// avec le CODE DU KIT (celui qu'on va activer) : le paquet n'est jamais ouvert par root. Rien n'est écrit hors du dossier de travail et du fichier de résultat.
//   1. le paquet : ses octets (empreinte sha256), sa structure (PRAGMA user_version), sa version et son mode (`paquet_meta`), les versions de ses notes réelles, le contrôle du fichier de contenu
//      (verifierLeContenu : une base SQLite saine, de la structure du kit, sans fiche ni compte) ;
//   2. le contenu réel (garde-fou 18, controlerLeContenu) : des comptes et des emplacements (table, identifiant, règle), jamais un texte de fiche ;
//   3. l'activation (garde-fou 17, serveur/activation.mjs#controlerLActivation) : le kit tel que kit.json le décrit, le paquet tel qu'il est, la production telle que sa base le dit (ses notes) ;
//   4. la base de la production refaite avec ses fiches, sur une COPIE (`<travail>/prod/vivante.db`, que root a prise par `sqlite3 .backup`), comme le fera le service à son redémarrage :
//      preparerBaseVivante avec le paquet pour contenu (scripts/repetition-prod.mjs#repeter, le code de la répétition).
// `--correctif` (le correctif urgent : pas de paquet neuf) : le paquet est celui que la production a déjà activé ; le contrôle de sa version contre la production, qui refuserait « la même version »,
// n'est pas fait (il est celui de la production), tout le reste l'est : sa structure doit être celle du kit.
// Sortie : des COMPTES seulement. `--resultat` : un JSON (une valeur par ligne) que root lit sans l'interpréter (des mots et des nombres seulement). Code 0 : l'activation PASSERAIT ; 1 : REFUSEE
// (les raisons sont dites) ; 2 : impossible (usage, fichier illisible).
//   node activation-controles.mjs --travail <dossier avec prod/vivante.db> --resultat <fichier.json> --kit-version X.Y.Z --kit-structure N [--paquet <fichier>]
//        [--kit-paquet-version X.Y --kit-paquet-empreinte <sha256> [--kit-paquet-structure N]] [--production <site de la production>] [--schema <data/schema.sql du kit>] [--correctif]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { controlerLActivation } from '../serveur/activation.mjs';
import { controlerLeContenu } from '../serveur/controles-du-contenu.mjs';
import { verifierLeContenu } from '../serveur/fichier-de-contenu.mjs';
import { lireReference } from '../serveur/notes-de-version.mjs';
import { lireMetaDuPaquet } from '../serveur/paquet.mjs';
import { versionCourte } from '../src/lib/notes-de-version.mjs';
import { lignesDeLaBase, repeter, sansValeurs } from './repetition-prod.mjs';

export const FORMAT_DES_CONTROLES = 'maverick-activation-controles/1';
/** Les problèmes du contenu nommés (le total reste exact). */
export const PROBLEMES_NOMMES = 20;

/** Des contrôles qui ne peuvent pas avoir lieu (usage, fichier absent) : code 2, jamais un verdict. */
export class ControlesImpossibles extends Error {}

const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');

/** Les notes de version réelles d'une base (les versions) ; vide si elle n'a pas la table. Lecture seule. */
function notesDeLaBase(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get()) return [];
    return db.prepare('SELECT version FROM note_version WHERE exemple = 0').all().map((n) => n.version);
  } finally {
    db.close();
  }
}

/**
 * Les contrôles : { format, verdict ('passe' | 'refuse'), raisons, kit, paquet, contenu, activation, fichier, base, correctif, refus }.
 * @param {{ travail: string, paquet: string | null, kit: { version: string, structure: number | null, paquet: { version?: string, empreinte: string, structure?: number } | null },
 *   production?: string | null, schema?: string | null, correctif?: boolean, instant?: Date, chute?: { pourcent?: number, min?: number } }} o
 *   `paquet` null : root n'a trouvé aucun paquet (le garde-fou 17 refuse : `kit_sans_paquet`).
 */
export function controlerLActivationDuKit({ travail, paquet, kit, production = null, schema = null, correctif = false, instant = new Date(), chute = {} }) {
  const copie = join(travail, 'prod', 'vivante.db');
  if (!existsSync(copie)) throw new ControlesImpossibles('copie de la base de la production absente (prod/vivante.db du dossier de travail)');
  const refus = [];
  const note = (raison, message) => refus.push({ raison, message });
  const notesDeProduction = notesDeLaBase(copie);
  let depuis = null;
  if (production) {
    const reference = lireReference({ production, propre: null });
    if (reference.disponible && reference.source === 'production' && reference.version) depuis = versionCourte(reference.version);
  }

  let lu = null;
  let fichier = null;
  let contenu = null;
  if (paquet) {
    if (!existsSync(paquet)) throw new ControlesImpossibles('paquet absent du dossier de travail');
    const octets = readFileSync(paquet);
    // 1. le fichier : une base saine, de la structure du kit, sans fiche ni compte (le même contrôle que la fabrication)
    fichier = schema ? verifierLeContenu(paquet, { schema }) : { valide: true, problemes: [], meta: null };
    if (!fichier.valide) note('paquet_irregulier', `le paquet n’est pas un fichier de contenu valide (${fichier.problemes.length} problème(s) : ${fichier.problemes.slice(0, 3).map(sansValeurs).join(' ; ')})`);
    if (!fichier.valide) {
      // un fichier qui n'est pas une base lisible, de la bonne structure et sans fiche n'est pas ouvert plus loin : ses octets suffisent à dire s'il est celui que le kit annonce
      lu = { empreinte: sha256(octets), octets: octets.length, schema: null, notes: [], meta: null };
      const annonce = kit.paquet?.empreinte;
      if (annonce && annonce !== lu.empreinte) note('empreinte', `le paquet reçu a l’empreinte ${lu.empreinte.slice(0, 12)}…, le kit annonce ${String(annonce).slice(0, 12)}… : ce n’est pas le paquet de ce kit`);
    } else {
      const db = new DatabaseSync(paquet, { readOnly: true });
      try {
        db.exec('PRAGMA foreign_keys = ON');
        lu = {
          empreinte: sha256(octets),
          octets: octets.length,
          schema: db.prepare('PRAGMA user_version').get().user_version,
          notes: db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'note_version'").get().n
            ? db.prepare('SELECT version FROM note_version WHERE exemple = 0').all().map((n) => n.version) : [],
          meta: null,
        };
        try {
          lu.meta = lireMetaDuPaquet(paquet);
        } catch {
          lu.meta = null;
        }
        // 2. le contenu réel (garde-fou 18)
        const { problemes, emplacements } = controlerLeContenu(db);
        contenu = {
          problemes: problemes.length, avertissements: 0,
          nommes: problemes.slice(0, PROBLEMES_NOMMES).map((_, i) => ({ table: emplacements[i]?.table ?? null, id: emplacements[i]?.id ?? null, regle: emplacements[i]?.regle ?? null })),
        };
        if (problemes.length) note('contenu', `le contenu a ${problemes.length} problème(s) : l’activation le refuse (garde-fou 18)`);
      } finally {
        db.close();
      }
      if (lu.meta && lu.meta.mode !== 'mise-a-jour') note('paquet_irregulier', `le paquet est de mode « ${String(lu.meta.mode).slice(0, 20)} », pas « mise-a-jour » : ce n’est pas le paquet d’une mise à jour`);
      if (!lu.meta) note('paquet_irregulier', 'le paquet n’a pas de fiche d’identité (paquet_meta) : ce n’est pas un paquet de mise à jour');
    }
  }

  // 3. l'activation (garde-fou 17) : le kit tel que kit.json le décrit, le paquet tel qu'il est, la production telle que sa copie la dit
  const versionDuPaquet = lu?.meta?.version ?? null;
  const irregulier = Boolean(fichier && !fichier.valide);
  const activation = irregulier ? { ok: false, refus: [] } : controlerLActivation({
    kit,
    paquet: lu ? { empreinte: lu.empreinte, schema: lu.schema, version: versionDuPaquet, notes: lu.notes } : null,
    production: { notes: notesDeProduction, version: depuis },
  });
  for (const r of activation.refus) {
    // le correctif recontrôle le paquet EN PLACE : « la même version » est celle de la production (le paquet qu'elle a déjà activé), pas une version en arrière
    if (correctif && r.raison === 'version_en_arriere' && versionDuPaquet && versionDuPaquet === depuis) continue;
    note(r.raison, r.message);
  }

  // 4. la base de la production refaite avec ses fiches, sur la copie (seulement si le reste passe : sinon le refus le dit déjà)
  let base = null;
  if (paquet && refus.length === 0) {
    base = repeter({ source: paquet, travail, version: kit.version, instant, chute, contenu: paquet });
    if (base.verdict !== 'passera') note('fiches', `les fiches de la production ne passent pas dans ce contenu (${base.refus.total} problème(s)) : la production garderait sa base`);
  }
  const raisons = [...new Set(refus.map((r) => r.raison))];
  return {
    format: FORMAT_DES_CONTROLES,
    verdict: refus.length === 0 ? 'passe' : 'refuse',
    raisons,
    correctif,
    kit,
    depuis,
    paquet: lu ? { version: versionDuPaquet, schema: lu.schema, empreinte: lu.empreinte, octets: lu.octets, notes: lu.notes.length, lot: lu.meta?.id ?? null } : null,
    fichier: fichier ? { valide: fichier.valide, problemes: fichier.problemes.length } : null,
    contenu,
    activation: { ok: activation.ok, refus: activation.refus },
    base,
    refus,
    notes_de_la_production: notesDeProduction.length,
  };
}

const mo = (n) => `${(n / 1048576).toFixed(1)} Mo`;

/** Le rapport lisible : une ligne par fait, des comptes (et des emplacements table/identifiant/règle) seulement. */
export function texteDesControles(x) {
  const l = [];
  l.push(x.verdict === 'passe'
    ? `contrôles : l’activation PASSERAIT (kit V${x.kit.version}${x.paquet ? `, paquet V${x.paquet.version}, depuis la V${x.depuis ?? 'inconnue'}` : ''}${x.correctif ? ', correctif urgent' : ''})`
    : `contrôles : l’activation est REFUSÉE (${x.refus.length} refus : ${x.raisons.join(', ')})`);
  l.push(`kit : V${x.kit.version}, structure ${x.kit.structure ?? 'illisible'} ; paquet annoncé : ${x.kit.paquet ? `V${x.kit.paquet.version ?? '?'}, empreinte ${String(x.kit.paquet.empreinte).slice(0, 12)}…` : 'aucun'}`);
  if (x.paquet) {
    l.push(`paquet reçu : V${x.paquet.version ?? 'inconnue'}, structure ${x.paquet.schema}, ${x.paquet.notes} note(s) de version, ${mo(x.paquet.octets)}, empreinte ${x.paquet.empreinte.slice(0, 12)}…`);
    if (x.fichier) l.push(`fichier de contenu : ${x.fichier.valide ? 'sain' : `refusé (${x.fichier.problemes} problème(s))`}`);
    if (x.contenu) {
      l.push(`contrôle du contenu : ${x.contenu.problemes} problème(s)`);
      for (const p of x.contenu.nommes) l.push(`problème du contenu : ${p.table ?? 'base'}${p.id === null ? '' : ` ${p.id}`} (règle ${p.regle ?? 'inconnue'})`);
      if (x.contenu.problemes > x.contenu.nommes.length) l.push(`problème du contenu : … et ${x.contenu.problemes - x.contenu.nommes.length} autre(s)`);
    }
  } else l.push('paquet reçu : aucun');
  l.push(`production : ${x.notes_de_la_production} note(s) de version`);
  for (const r of x.activation.refus) l.push(r.message);
  for (const r of x.refus.filter((e) => !x.activation.refus.some((a) => a.raison === e.raison))) l.push(`refus (${r.raison}) : ${r.message}`);
  if (x.base) {
    const b = x.base;
    l.push(`production (copie) : structure ${b.production.schema}, ${b.production.fiches} fiche(s), ${mo(b.production.octets)}`);
    if (b.refus) {
      l.push(`base de la production : NON refaite (${b.refus.raison}, ${b.refus.total} problème(s))`);
      for (const p of b.refus.problemes) l.push(`problème : ${p}`);
    } else {
      l.push(`base de la production refaite : structure ${b.base.schema_avant} → ${b.base.schema_apres}${b.base.identique ? ' (rien ne change)' : ''}, ${b.fiches_adaptees.fiches} fiche(s) adaptée(s)`);
      l.push(...lignesDeLaBase(b));
    }
    for (const j of b.journal) l.push(`journal du service : ${j}`);
  }
  return l.join('\n');
}

/** Un JSON dont chaque valeur est sur sa ligne : root n'en lit que des mots et des nombres (sed), jamais un texte. */
export function resultatPourRoot(x) {
  const mots = (liste) => `[${liste.map((m) => `"${String(m).replace(/[^a-z_]/g, '')}"`).join(', ')}]`;
  const nombre = (v) => (Number.isInteger(v) && v >= 0 ? String(v) : 'null');
  const version = (v) => (/^\d+\.\d+$/.test(String(v ?? '')) ? `"${v}"` : 'null');
  return [
    '{',
    `  "format": "${FORMAT_DES_CONTROLES}",`,
    `  "verdict": "${x.verdict === 'passe' ? 'passe' : 'refuse'}",`,
    `  "raisons": ${mots(x.raisons)},`,
    `  "version_du_paquet": ${version(x.paquet?.version)},`,
    `  "structure_du_paquet": ${nombre(x.paquet?.schema)},`,
    `  "empreinte_du_paquet": ${/^[0-9a-f]{64}$/.test(x.paquet?.empreinte ?? '') ? `"${x.paquet.empreinte}"` : 'null'},`,
    `  "problemes_du_contenu": ${nombre(x.contenu?.problemes)},`,
    `  "fiches": ${nombre(x.base?.production?.fiches)}`,
    '}',
    '',
  ].join('\n');
}

function principal(args) {
  const o = {};
  const valeurs = ['--travail', '--resultat', '--kit-version', '--kit-structure', '--paquet', '--kit-paquet-version', '--kit-paquet-empreinte', '--kit-paquet-structure', '--production', '--schema', '--chute-pourcent', '--chute-min'];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--correctif') o.correctif = true;
    else if (valeurs.includes(a) && i + 1 < args.length) o[a.slice(2)] = args[(i += 1)];
    else {
      console.error(`option inconnue : ${a}`);
      return 2;
    }
  }
  if (!o.travail || !o.resultat || !/^\d+\.\d+\.\d+$/.test(o['kit-version'] ?? '') || !/^\d{1,6}$/.test(o['kit-structure'] ?? '')
    || (o['kit-paquet-empreinte'] !== undefined && !/^[0-9a-f]{64}$/.test(o['kit-paquet-empreinte']))) {
    console.error('Usage : node activation-controles.mjs --travail <dossier> --resultat <fichier.json> --kit-version X.Y.Z --kit-structure N [--paquet <fichier>] [--kit-paquet-version X.Y --kit-paquet-empreinte <sha256> [--kit-paquet-structure N]] [--production <site>] [--schema <schema.sql>] [--correctif]');
    return 2;
  }
  const entier = (v, defaut) => (/^\d{1,6}$/.test(String(v ?? '')) ? Number(v) : defaut);
  const annonce = o['kit-paquet-empreinte']
    ? { empreinte: o['kit-paquet-empreinte'], ...(o['kit-paquet-version'] ? { version: o['kit-paquet-version'] } : {}), ...(o['kit-paquet-structure'] !== undefined ? { structure: Number(o['kit-paquet-structure']) } : {}) }
    : null;
  const x = controlerLActivationDuKit({
    travail: resolve(o.travail), paquet: o.paquet ? resolve(o.paquet) : null, production: o.production ? resolve(o.production) : null, schema: o.schema ? resolve(o.schema) : null,
    kit: { version: o['kit-version'], structure: Number(o['kit-structure']), paquet: annonce }, correctif: Boolean(o.correctif), chute: { pourcent: entier(o['chute-pourcent'], 20), min: entier(o['chute-min'], 20) },
  });
  console.log(texteDesControles(x));
  const provisoire = `${resolve(o.resultat)}.${process.pid}.tmp`;
  writeFileSync(provisoire, resultatPourRoot(x), { mode: 0o644 });
  renameSync(provisoire, resolve(o.resultat));
  return x.verdict === 'passe' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    console.error(`contrôles impossibles : ${sansValeurs(e?.message ?? e)}`);
    process.exitCode = 2;
  }
}
