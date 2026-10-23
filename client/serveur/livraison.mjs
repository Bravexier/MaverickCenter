// Livraison du service avec le site (docs/serveur.md) : à la fin de chaque build, ses modules — et les modules purs de src/lib qu'il importe —
// sont copiés dans dist/_serveur/, sous les mêmes chemins qu'ici depuis client/ (serveur/index.mjs, src/lib/…), avec version.json. Le site et son
// service arrivent donc ensemble sur le serveur (branche « site » du NAS, installateurs) ; nginx refuse cette adresse (deploy/nginx.conf) et le
// conteneur « serveur » l'exécute (docker-compose.yml), puis se relance quand version.json change. Utilisé par astro.config.mjs ; jamais livré.
// Hors de ses modules, le service emporte aussi les fichiers de FICHIERS_JOINTS : l'instantané de la partie « Bienvenue » de Tipeee (premier repli
// de GET /api/tipeee/, serveur/tipeee.mjs), versionné dans sources/ à la racine du dépôt et copié dans _serveur/sources/ ; absent, il n'est pas copié
// (le service le dit à son démarrage) ; il compte dans l'empreinte du code.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHEMIN_INSTANTANE } from '../src/lib/tipeee.mjs';

export const CLIENT = fileURLToPath(new URL('..', import.meta.url));
/** Dossier du service dans le site construit, et son point d'entrée (chemin relatif à client/, gardé tel quel dans ce dossier). */
export const DOSSIER_LIVRE = '_serveur';
export const ENTREE = 'serveur/index.mjs';

/** Fichiers livrés avec le service hors de ses modules : `source` relatif à client/, `cible` relatif au dossier livré. */
export const FICHIERS_JOINTS = Object.freeze([Object.freeze({ source: `../${CHEMIN_INSTANTANE}`, cible: CHEMIN_INSTANTANE })]);

const IMPORTS = /\b(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Modules livrés : l'entrée et tout ce qu'elle importe, chemins relatifs à client/, triés. Seuls les modules de Node (node:…) et des chemins relatifs sont permis. */
export function modulesDuServeur(client = CLIENT, entree = ENTREE) {
  const vus = new Set();
  const pile = [resolve(client, entree)];
  while (pile.length) {
    const fichier = pile.pop();
    const rel = relative(client, fichier).split(sep).join('/');
    if (vus.has(rel)) continue;
    if (rel.startsWith('../')) throw new Error(`${rel} : le service n'importe que des modules de client/`);
    vus.add(rel);
    for (const m of readFileSync(fichier, 'utf8').matchAll(IMPORTS)) {
      const specificateur = m[1] ?? m[2];
      if (specificateur.startsWith('node:')) continue;
      if (!/^\.\.?\//.test(specificateur)) throw new Error(`${rel} importe « ${specificateur} » : le service n'utilise que Node (node:…) et ses propres modules, sans paquet npm`);
      pile.push(resolve(dirname(fichier), specificateur));
    }
  }
  return [...vus].sort();
}

/**
 * Copie le service dans <dist>/_serveur/ et écrit version.json (version du site, empreinte du code, modules, fichiers joints copiés).
 * @param {string} dist
 * @param {{ client?: string, version?: string, joints?: readonly { source: string, cible: string }[] }} [o]
 */
export function livrerServeur(dist, { client = CLIENT, version, joints = FICHIERS_JOINTS } = {}) {
  const cible = join(dist, DOSSIER_LIVRE);
  rmSync(cible, { recursive: true, force: true });
  const modules = modulesDuServeur(client);
  const empreinte = createHash('sha256');
  const copier = (de, vers) => {
    const contenu = readFileSync(de);
    mkdirSync(dirname(join(cible, vers)), { recursive: true });
    writeFileSync(join(cible, vers), contenu);
    empreinte.update(`${vers}\0`).update(contenu).update('\0');
  };
  for (const rel of modules) copier(join(client, rel), rel);
  const fichiers = [];
  for (const { source, cible: vers } of joints) {
    const de = resolve(client, source);
    if (!existsSync(de)) continue;
    copier(de, vers);
    fichiers.push(vers);
  }
  const info = { version, empreinte: empreinte.digest('hex').slice(0, 16), entree: `${DOSSIER_LIVRE}/${ENTREE}`, modules, fichiers };
  writeFileSync(join(cible, 'version.json'), `${JSON.stringify(info, null, 2)}\n`);
  return info;
}

/** Intégration Astro : livre le service à la fin du build. */
export function integrationServeur() {
  return {
    name: 'maverick-serveur',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const version = JSON.parse(readFileSync(join(CLIENT, 'package.json'), 'utf8')).version;
        const info = livrerServeur(fileURLToPath(dir), { version });
        logger.info(`service des personnages livré dans ${DOSSIER_LIVRE}/ (${info.modules.length} modules, code ${info.empreinte})`);
      },
    },
  };
}
