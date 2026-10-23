// Index des décisions (A3) : docs/decisions-index.md fabriqué depuis le registre docs/decisions-regles.md (logique : scripts/decisions-index-lib.mjs).
// `npm run decisions:index` écrit l'index ; `-- --verifier` ne l'écrit pas et sort en erreur s'il n'est pas à jour.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHEMIN_INDEX, CHEMIN_REGISTRE, octets, TAILLE_CIBLE, verifier } from './decisions-index-lib.mjs';

const AIDE = `node scripts/decisions-index.mjs [--verifier]

Lit ${CHEMIN_REGISTRE} et écrit ${CHEMIN_INDEX} : une ligne par décision R… (sujet et décision coupés), dans l'ordre du registre.
  --verifier   n'écrit rien ; code 1 si l'index n'est pas à jour (relancer sans --verifier), ou si le registre a une erreur
Code 0 si tout va bien, 1 pour un index périmé ou une erreur du registre (numéro en double, ligne R… incomplète), 2 pour une option inconnue.
Un trou dans la numérotation et un index de plus de ${TAILLE_CIBLE / 1024} Ko sont signalés, sans erreur.`;

function principal(argv) {
  const inconnues = argv.filter((a) => !['--verifier', '--aide', '--help', '-h'].includes(a));
  if (inconnues.length) { console.error(`option inconnue : ${inconnues.join(' ')}\n\n${AIDE}`); return 2; }
  if (argv.some((a) => ['--aide', '--help', '-h'].includes(a))) { console.log(AIDE); return 0; }
  const modeVerifier = argv.includes('--verifier');

  const racine = fileURLToPath(new URL('../..', import.meta.url));
  const cheminIndex = join(racine, CHEMIN_INDEX);
  const registre = readFileSync(join(racine, CHEMIN_REGISTRE), 'utf8');
  const actuel = existsSync(cheminIndex) ? readFileSync(cheminIndex, 'utf8') : null;
  const { aJour, attendu, analyse } = verifier(registre, actuel);

  for (const a of analyse.avertissements) console.warn(`avertissement : ${a}`);
  for (const e of analyse.erreurs) console.error(`erreur : ${e}`);
  const taille = octets(attendu);
  const resume = `${analyse.decisions.length} décisions, index de ${taille} octets (${(taille / 1024).toFixed(1)} Ko)`;
  if (taille > TAILLE_CIBLE) console.warn(`avertissement : l'index dépasse la cible de ${TAILLE_CIBLE / 1024} Ko (${resume})`);
  if (analyse.erreurs.length) return 1;

  if (modeVerifier) {
    if (aJour) { console.log(`${CHEMIN_INDEX} à jour : ${resume}`); return 0; }
    console.error(`${CHEMIN_INDEX} ${actuel == null ? 'absent' : "n'est pas à jour"} : lancer \`npm run decisions:index\` (depuis client/)`);
    return 1;
  }
  if (aJour) console.log(`${CHEMIN_INDEX} déjà à jour : ${resume}`);
  else { writeFileSync(cheminIndex, attendu); console.log(`${CHEMIN_INDEX} écrit : ${resume}`); }
  return 0;
}

process.exitCode = principal(process.argv.slice(2));
