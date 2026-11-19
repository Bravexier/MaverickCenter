// Les fichiers de référence des migrations mixtes (data/references/ ; src/lib/references-des-migrations.mjs) recalculés depuis leurs registres
// (data/migrations/*.json), tant qu'ils sont dans le dépôt. Une migration fusionnée ne change plus : `--verifier` doit toujours passer ; `--ecrire` ne
// sert qu'à poser les fichiers la première fois (ou à les reposer à l'identique). Sans registre (les mixtes sortis), il n'y a plus rien à recalculer.
//   node scripts/references-des-migrations.mjs --verifier   code 1 si un fichier manque ou diffère de son registre
//   node scripts/references-des-migrations.mjs --ecrire     écrit les fichiers
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { calculerLesReferences, texteDeLaReference } from '../src/lib/references-des-migrations.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/** Les registres `.json` d'un dossier de migrations : Map(nom sans extension → registre lu). */
export function lireLesRegistres(dossier = join(RACINE, 'data', 'migrations')) {
  if (!existsSync(dossier)) return new Map();
  return new Map(readdirSync(dossier).filter((f) => /^\d{4}-.*\.json$/.test(f)).sort()
    .map((f) => [f.slice(0, -'.json'.length), JSON.parse(readFileSync(join(dossier, f), 'utf8'))]));
}

/** Les écarts entre les fichiers de référence de `racine` et leur recalcul depuis `registres` : [chemin], vide si tout est égal. */
export function ecartsDesReferences({ racine = RACINE, registres = lireLesRegistres(join(racine, 'data', 'migrations')) } = {}) {
  return Object.entries(calculerLesReferences(registres))
    .filter(([chemin, contenu]) => !existsSync(join(racine, chemin)) || readFileSync(join(racine, chemin), 'utf8') !== texteDeLaReference(contenu))
    .map(([chemin]) => chemin);
}

function main(args) {
  const references = calculerLesReferences(lireLesRegistres());
  if (args.includes('--ecrire')) {
    for (const [chemin, contenu] of Object.entries(references)) {
      mkdirSync(dirname(join(RACINE, chemin)), { recursive: true });
      writeFileSync(join(RACINE, chemin), texteDeLaReference(contenu));
      console.log(`écrit : ${chemin}`);
    }
    return 0;
  }
  if (args.includes('--verifier')) {
    const ecarts = ecartsDesReferences();
    for (const chemin of ecarts) console.error(`${chemin} : absent ou différent de son registre`);
    console.log(ecarts.length ? `${ecarts.length} écart(s)` : `ok : ${Object.keys(references).length} fichier(s) de référence égaux à leurs registres`);
    return ecarts.length ? 1 : 0;
  }
  console.error('usage : node scripts/references-des-migrations.mjs --verifier | --ecrire');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
