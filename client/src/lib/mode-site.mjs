// Mode de la construction du site, lu au build (voir docs/flux-git.md) :
//   SITE_MODE=test  serveur de test (installateur fabriqué après chaque fusion dans dev) : bandeau, titre d'onglet et pied de page marqués ;
//   SITE_TAG        étiquette de la livraison (v0.2.3-test, v0.2.0-hotfix.1…) ; sans elle, la version de package.json.
// Sans dépendance : importable partout.

/** @param {Record<string, string | undefined>} env @param {string} version */
export function modeDuSite(env, version) {
  const test = env.SITE_MODE === 'test';
  return { test, etiquette: env.SITE_TAG || `v${version}` };
}
