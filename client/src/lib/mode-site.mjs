// Mode de la construction du site, lu au build (voir docs/flux-git.md) :
//   SITE_MODE=test  serveur de test (installateur fabriqué après chaque fusion dans dev) : bandeau, titre d'onglet et pied de page marqués ;
//   SITE_TAG        étiquette de la livraison (V0.2 en production, V0.2.3 sur le serveur de test, V0.2-hotfix.1…) ; sans elle, l'étiquette de version de dev (VX.Y.Z).
// Sans dépendance : importable partout.

/** @param {Record<string, string | undefined>} env @param {string} version */
export function modeDuSite(env, version) {
  const test = env.SITE_MODE === 'test';
  return { test, etiquette: env.SITE_TAG || `V${version}` };
}
