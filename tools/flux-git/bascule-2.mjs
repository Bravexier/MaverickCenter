#!/usr/bin/env node
// Ce que GitHub publie, selon l'interrupteur de la bascule 2 (lot 11, PR 4 ; docs/flux-git.md, « Ce que GitHub publie avec la bascule 2 »). Appelé par
// .github/workflows/livraison.yml ; la décision est pure (decisionDeLaLivraison), testée par test/flux-git-bascule-2.test.mjs.
//
//   node tools/flux-git/bascule-2.mjs lire [--ref origin/dev] [--racine <dépôt>]
//       écrit « actif=true|false » sur la sortie standard (et dans $GITHUB_OUTPUT s'il existe) : l'interrupteur tools/flux-git/bascule-2.json lu dans `--ref`
//       (jamais dans la branche livrée). Fichier absent, référence introuvable ou fichier illisible : « actif=false » et un avertissement : la publication ne se bloque pas,
//       elle reste celle d'aujourd'hui.
//   node tools/flux-git/bascule-2.mjs decider --mode prod|test --actif true|false
//       écrit « kit_seul=true|false » et « construire_le_site=true|false » (ce que le job « Installateur » fait) (le job « Site » lit l'interrupteur lui-même : `bascule_2` du job version).
//
// ÉTEINT (`actif` absent ou false) : kit_seul=false, construire_le_site=true : la livraison est celle d'avant. Allumé : un installateur de TEST ne porte plus de pages (le
// site est fabriqué par l'atelier du site de dev : deploy/installateur/fabriquer.mjs --kit-seul), le job « Site » (branche NAS) est sauté. La production reste inchangée dans cette
// PR : l'installateur de production porte toujours le site complet.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** L'interrupteur, relatif à la racine du dépôt. */
export const INTERRUPTEUR = 'tools/flux-git/bascule-2.json';
/** La branche où il se lit. */
export const BRANCHE_DE_L_INTERRUPTEUR = 'origin/dev';

/** Lit l'interrupteur (le texte du fichier, ou null s'il est absent : éteint). Lève une Error sur un fichier illisible. */
export function lireLInterrupteur(texte) {
  if (texte === null || texte === undefined) return false;
  let v;
  try {
    v = JSON.parse(texte);
  } catch {
    throw new Error(`${INTERRUPTEUR} illisible (JSON attendu : { "actif": false } ou { "actif": true })`);
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${INTERRUPTEUR} : un objet JSON est attendu, avec « actif » à true ou false`);
  // « actif » seul gouverne la publication ; « gel_des_fusions » est l'autre clé du fichier (client/scripts/gel-des-fusions-lib.mjs). Absent : éteint.
  if (v.actif === undefined) return false;
  if (typeof v.actif !== 'boolean') throw new Error(`${INTERRUPTEUR} : « actif » doit valoir true ou false`);
  return v.actif;
}

/**
 * Ce que la livraison d'un installateur fait. `mode` : `prod` ou `test` ; `actif` : l'interrupteur.
 * @returns {{ kit_seul: boolean, construire_le_site: boolean }}
 */
export function decisionDeLaLivraison({ mode, actif }) {
  if (!['prod', 'test'].includes(mode)) throw new Error(`mode « ${mode} » inconnu (prod ou test)`);
  const kitSeul = actif === true && mode === 'test';
  return { kit_seul: kitSeul, construire_le_site: !kitSeul };
}

/** L'interrupteur lu dans la référence git `ref` de `racine` : { actif, avertissement }. Jamais d'exception : la publication ne dépend pas d'une lecture qui échoue. */
export function interrupteurDans(racine, ref = BRANCHE_DE_L_INTERRUPTEUR) {
  const git = (...args) => spawnSync('git', ['-C', racine, ...args], { encoding: 'utf8' });
  if (git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`).status !== 0) return { actif: false, avertissement: `${ref} introuvable : ${INTERRUPTEUR} ne se lit pas, la livraison reste celle d'avant` };
  const lu = git('show', `${ref}:${INTERRUPTEUR}`);
  try {
    return { actif: lireLInterrupteur(lu.status === 0 ? lu.stdout : null), avertissement: null };
  } catch (e) {
    return { actif: false, avertissement: `${e.message} : la livraison reste celle d'avant` };
  }
}

function ecrire(lignes) {
  const texte = `${lignes.join('\n')}\n`;
  process.stdout.write(texte);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, texte);
}

function main(args) {
  const option = (nom, defaut) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : defaut);
  const commande = args[0];
  if (commande === 'lire') {
    const racine = resolve(option('--racine', fileURLToPath(new URL('../../', import.meta.url))));
    const { actif, avertissement } = interrupteurDans(racine, option('--ref', BRANCHE_DE_L_INTERRUPTEUR));
    if (avertissement) console.error(`::warning::${avertissement}`);
    ecrire([`actif=${actif}`]);
    return 0;
  }
  if (commande === 'decider') {
    const actif = option('--actif', 'false');
    if (!['true', 'false', ''].includes(actif)) {
      console.error(`--actif : true ou false attendu (reçu « ${actif} »)`);
      return 2;
    }
    try {
      const d = decisionDeLaLivraison({ mode: option('--mode', ''), actif: actif === 'true' });
      ecrire(Object.entries(d).map(([cle, valeur]) => `${cle}=${valeur}`));
      return 0;
    } catch (e) {
      console.error(e.message);
      return 2;
    }
  }
  console.error('Usage : node tools/flux-git/bascule-2.mjs lire [--ref origin/dev] [--racine <dépôt>] | decider --mode prod|test --actif true|false');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
