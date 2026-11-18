#!/usr/bin/env node
// `npm run db:sync-pages -- --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--wiki <dossier>] [--auteur <nom>]` (dans client/) : les pages .md
// modifiées (à la main, ou réécrites par un importeur : tools/sheets/*.py, tools/docs/codex.py) deviennent un lot de changements de nature `source`, à
// PROPOSER au site de dev. Lot 12 du chantier « la base du site de dev devient la source de vérité » (R274, R278) : `db:sync-pages` n'écrit plus data/rows
// (copie du site de dev, écrite par le workflow seul : contrôle `controle-du-contenu-ecrit`). Étapes :
//   1. une base de travail : une COPIE de l'extrait du jour (`--avant`, défaut var/extrait/maverick-dev.db : `npm run db:extrait`), préparée comme celle
//      du build, sans pages d'exemple (scripts/db-preparer-contenu.mjs : migrations du dépôt manquantes appliquées) ; l'extrait n'est jamais écrit ;
//   2. les .md (`--wiki`, défaut client/src/content/wiki) y sont reportés par `tools/db/pages_md.py sync --base <copie>` (mêmes règles qu'avant : une page
//      ajoutée ou retirée seulement pour les familles `docs` et `exemple`, provenance inchangée, mots-clés inconnus signalés, références contrôlées) ;
//   3. le lot est la différence entre l'extrait et la base de travail (scripts/lot-de-source.mjs#ecrireLeLotDeSource : contrôlé comme au dépôt ; les
//      colonnes que le service refait, comme le corps d'une page typée, n'y sont pas).
// Les .md de départ doivent venir du même extrait (`MAVERICK_CONTENU=<extrait> npm run db:export-pages`), sinon le lot défait ce que le site a changé
// depuis. L'outil n'envoie rien : le lot se propose au site de dev par un humain (POST /api/edition/lots/, skill modifier-une-page-wiki).
// Code de sortie : 0 (lot écrit, ou aucune différence : aucun fichier), 1 (refus de pages_md.py ou des contrôles du lot), 2 (usage).
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparerLeContenu } from './db-preparer-contenu.mjs';
import { EXTRAIT_PAR_DEFAUT, ecrireLeLotDeSource } from './lot-de-source.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Reporte les .md de `wiki` dans une copie préparée de `avant` (un extrait du site de dev, jamais modifié), puis écrit dans `sortie` le lot `source` de la
 * différence. Rend `{ pages, lot, bilan }` (`pages` : la sortie de pages_md.py ; `lot` null sans différence, aucun fichier écrit). Lève une Error si
 * pages_md.py refuse (rien n'est écrit) ou si le lot ne passerait pas les contrôles du service.
 * @param {{ avant: string, titre: string, sortie: string, wiki?: string, auteur?: string, racine?: string }} o
 */
export function synchroniserLesPages({ avant, titre, sortie, wiki, auteur, racine = RACINE }) {
  const tmp = mkdtempSync(join(tmpdir(), 'maverick-sync-pages-'));
  try {
    const travail = join(tmp, 'travail.db');
    copyFileSync(resolve(avant), travail);
    preparerLeContenu(travail, { racine, exemples: false });
    const args = ['-I', join(racine, 'tools', 'db', 'pages_md.py'), 'sync', '--base', travail, ...(wiki ? ['--wiki', resolve(wiki)] : [])];
    const r = spawnSync('python3', args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`pages_md.py sync : ${(r.stdout || '') + (r.stderr || '') || r.error?.message}`.trim());
    return { pages: r.stdout.trim(), ...ecrireLeLotDeSource({ avant, apres: travail, titre, auteur, sortie, racine }) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
  const [sortie, titre] = [option('--lot'), option('--titre')];
  if (!sortie || !titre) {
    console.error('usage : npm run db:sync-pages -- --lot <lot.json> --titre <titre> [--avant <extrait.db>] [--wiki <dossier>] [--auteur <nom>]');
    console.error('(db:sync-pages n’écrit plus data/rows : il écrit un lot `source` à proposer au site de dev.)');
    process.exit(2);
  }
  const avant = resolve(option('--avant') ?? EXTRAIT_PAR_DEFAUT);
  try {
    const { pages, lot, bilan } = synchroniserLesPages({ avant, titre, sortie, wiki: option('--wiki'), auteur: option('--auteur') });
    console.log(pages);
    if (!lot) {
      console.log(`aucune différence avec ${avant} : rien à proposer, aucun fichier écrit.`);
    } else {
      for (const [table, n] of Object.entries(bilan.tables)) console.log(`${table} : ${n.inserer} insérée(s), ${n.modifier} modifiée(s), ${n.supprimer} supprimée(s)`);
      console.log(`lot « ${titre} » (source) : ${bilan.operations} opération(s) -> ${resolve(sortie)}`);
      console.log('à PROPOSER au site de dev par un humain : POST /api/edition/lots/ (skill modifier-une-page-wiki) ; l’outil n’envoie rien.');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
