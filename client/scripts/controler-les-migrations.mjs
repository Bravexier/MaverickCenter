// `npm run db:controler-migrations` (dans client/) : les règles des migrations, contrôlées par GitHub à chaque PR (lot 7 du chantier « la base du site de dev
// devient la source de vérité », R274, R275 ; docs/flux-git.md, « Règles des migrations (lot 7) »). Les règles sont dans scripts/controler-les-migrations-lib.mjs
// (fonctions pures), le passage sur une base remplie dans scripts/controler-les-migrations-base.mjs.
//   node scripts/controler-les-migrations.mjs [--base origin/dev] [--resume <fichier.md>] [--sans-essai] [--racine <dépôt>]
//     --base      la branche (ou le commit) de comparaison : les fichiers de data/migrations/ sont comparés à ceux de `git merge-base <base> HEAD`, l'arbre étant celui
//                 du dossier de travail (une migration pas encore commitée compte) ;
//     --resume    un fichier Markdown où AJOUTER le bilan (le $GITHUB_STEP_SUMMARY de la CI) ; le même texte va sur la sortie ;
//     --sans-essai  les règles seules, sans reconstruire la base ni lui appliquer les migrations (quelques millisecondes).
// Sortie : 0 (rien à dire, ou tout est admis), 1 (une règle est violée : le fichier, la règle, ce qu'il faut faire), 2 (usage, dépôt ou outil : base introuvable, erreur inattendue…).
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lireLesMigrations, versionDuSchemaSql } from '../serveur/structure-sur-place.mjs';
import { essayerSurBaseRemplie, reconstruireLaBase } from './controler-les-migrations-base.mjs';
import {
  AVERTISSEMENT_DONNEES, ErreurDeControle, extraireDuCommit, lireUnDossierDeMigrations, refus, rendreLeResume, reglesDUneMigration, reglesDesFichiers, versionDeLaBase,
} from './controler-les-migrations-lib.mjs';

const RACINE_DU_DEPOT = fileURLToPath(new URL('../../', import.meta.url));
const numeroDe = (fichier) => Number(fichier.slice(0, 4));

/**
 * Contrôle les migrations de `racine` (un dépôt git) contre `base`. Rend { base, mergeBase, version, nouvelles: [{ fichier, numero, nature }], violations,
 * avertissements, essai } (voir rendreLeResume) ; ne lève que ErreurDeControle (dépôt ou base illisible).
 * @param {{ racine?: string, base?: string, essai?: boolean, dossier?: string }} [o] `dossier` : où travailler (sinon un dossier temporaire, effacé)
 */
export function controlerLesMigrations({ racine = RACINE_DU_DEPOT, base = 'origin/dev', essai = true, dossier } = {}) {
  const mergeBase = versionDeLaBase(racine, base);
  const travail = dossier ?? mkdtempSync(join(tmpdir(), 'maverick-migrations-'));
  try {
    extraireDuCommit({ racine, commit: mergeBase, dossier: join(travail, 'depart'), chemins: ['data/migrations', 'data/schema.sql'] });
    const dePart = lireUnDossierDeMigrations(join(travail, 'depart', 'data', 'migrations'));
    const arbre = lireUnDossierDeMigrations(join(racine, 'data', 'migrations'));
    // le plancher : la version du schema.sql de la base (quand des migrations sont sorties du dépôt, il est au-dessus de la dernière qui reste)
    const schemaDeLaBase = join(travail, 'depart', 'data', 'schema.sql');
    const plancher = existsSync(schemaDeLaBase) ? versionDuSchemaSql(readFileSync(schemaDeLaBase, 'utf8')) ?? 0 : 0;
    const version = Math.max(0, plancher, ...[...dePart.keys()].filter((f) => f.endsWith('.sql')).map(numeroDe));

    const { violations, nouvelles: fichiersNouveaux } = reglesDesFichiers(dePart, arbre, { plancher });
    const avertissements = [];
    const nouvelles = [];
    for (const fichier of fichiersNouveaux.filter((f) => f.endsWith('.sql'))) {
      const { violations: v, analyse } = reglesDUneMigration(fichier, arbre.get(fichier));
      violations.push(...v);
      nouvelles.push({ fichier, numero: numeroDe(fichier), nature: analyse.nature });
      if (analyse.nature === 'donnees') avertissements.push(`\`${fichier}\` — ${AVERTISSEMENT_DONNEES}.`);
    }
    const resultat = { base, mergeBase, version, nouvelles, violations, avertissements, essai: null };
    if (!essai || !nouvelles.length) return resultat;

    // le passage sur une base remplie : la version de la base, ses fiches, son journal ; puis toutes les migrations nouvelles
    let livre;
    try {
      livre = lireLesMigrations({ migrations: join(racine, 'data', 'migrations'), schema: join(racine, 'data', 'schema.sql') });
    } catch (e) {
      violations.push(refus('data/migrations', 'numero', e.message));
      return resultat;
    }
    const depart = reconstruireLaBase({ racine, commit: mergeBase, dossier: join(travail, 'base') });
    const essaye = essayerSurBaseRemplie({ base: depart.chemin, migrations: livre.migrations, schema: livre.schema, dossier: travail });
    const nature = new Map(nouvelles.map((m) => [m.numero, m.nature]));
    essaye.etapes = essaye.etapes.map((e) => ({ ...e, nature: nature.get(e.numero) ?? 'donnees' }));
    resultat.version = depart.version;
    resultat.essai = essaye;
    resultat.avertissements.push(...(essaye.avertissements ?? []));
    if (essaye.verdict === 'refuse') violations.push(refus(essaye.refus.fichier ?? 'data/migrations', 'base-remplie', `${essaye.refus.raison}${essaye.refus.details?.length ? ` — ${essaye.refus.details.slice(0, 5).join(' ; ')}` : ''}`));
    if (essaye.verdict === 'perte') for (const p of essaye.pertes) violations.push(refus(p.split(' : ')[0], 'base-remplie', `perte dans la base remplie (fiches, journal, historique ou notes) : ${p.split(' : ').slice(1).join(' : ')}`));
    return resultat;
  } finally {
    if (!dossier) rmSync(travail, { recursive: true, force: true });
  }
}

function main(args) {
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const base = option('--base', 'origin/dev');
  const resume = option('--resume', null);
  const racine = resolve(option('--racine', RACINE_DU_DEPOT));
  // une erreur qui n'est pas une règle violée (dépôt, base, outil illisible, résumé non écrit) sort en 2, jamais en 1
  try {
    const resultat = controlerLesMigrations({ racine, base, essai: !args.includes('--sans-essai') });
    const texte = rendreLeResume(resultat);
    process.stdout.write(texte);
    if (resume) appendFileSync(resume, `${texte}\n`);
    for (const v of resultat.violations) console.error(`REFUS ${v.fichier} [${v.regle}] : ${v.message}`);
    return resultat.violations.length ? 1 : 0;
  } catch (e) {
    console.error(`contrôle des migrations impossible : ${e instanceof ErreurDeControle ? e.message : (e?.stack ?? e)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
