// Livraison du service avec le site (docs/serveur.md) : à la fin de chaque build, ses modules — et les modules purs de src/lib qu'il importe —
// sont copiés dans dist/_serveur/, sous les mêmes chemins qu'ici depuis client/ (serveur/index.mjs, src/lib/…), avec version.json. Le site et son
// service arrivent donc ensemble sur le serveur (branche « site » du NAS, installateurs) ; nginx refuse cette adresse (deploy/nginx.conf) et le
// conteneur « serveur » l'exécute (docker-compose.yml), puis se relance quand version.json change. Utilisé par astro.config.mjs ; jamais livré.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLIENT = fileURLToPath(new URL('..', import.meta.url));
/** Dossier du service dans le site construit, et son point d'entrée (chemin relatif à client/, gardé tel quel dans ce dossier). */
export const DOSSIER_LIVRE = '_serveur';
export const ENTREE = 'serveur/index.mjs';

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

/** Copie le service dans <dist>/_serveur/ et écrit version.json (version du site, empreinte du code, modules). */
export function livrerServeur(dist, { client = CLIENT, version } = {}) {
  const cible = join(dist, DOSSIER_LIVRE);
  rmSync(cible, { recursive: true, force: true });
  const modules = modulesDuServeur(client);
  const empreinte = createHash('sha256');
  for (const rel of modules) {
    const contenu = readFileSync(join(client, rel));
    mkdirSync(dirname(join(cible, rel)), { recursive: true });
    writeFileSync(join(cible, rel), contenu);
    empreinte.update(`${rel}\0`).update(contenu).update('\0');
  }
  const info = { version, empreinte: empreinte.digest('hex').slice(0, 16), entree: `${DOSSIER_LIVRE}/${ENTREE}`, modules };
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
