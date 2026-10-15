// Page « Maintenance en cours » (scripts/maintenance.mjs) : la page où revenir quand la maintenance est finie. Module pur, sans dépendance.

/**
 * L'adresse de retour : le paramètre `retour` de `recherche` (« ?retour=/races/elfe/ ») s'il désigne une page de ce site — même origine, sous
 * `accueil` (la racine du site, préfixe de déploiement compris), jamais la page de maintenance elle-même —, sinon `accueil`. Jamais un autre site
 * (« //exemple.org », « https://… », « /\\exemple.org »).
 */
export function adresseDeRetour(recherche, { origine, accueil = '/' }) {
  const brut = new URLSearchParams(recherche).get('retour');
  if (!brut || !brut.startsWith('/') || brut.startsWith('//') || brut.includes('\\')) return accueil;
  try {
    const cible = new URL(brut, origine);
    if (cible.origin !== new URL(origine).origin || !cible.pathname.startsWith(accueil) || cible.pathname.startsWith(`${accueil}maintenance/`)) return accueil;
    return cible.pathname + cible.search + cible.hash;
  } catch {
    return accueil;
  }
}
