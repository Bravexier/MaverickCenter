// Tests réservés à Linux, avec l'accord du propriétaire (2026-11-22) : ils lancent les scripts de déploiement ou reposent sur un comportement POSIX
// (tar GNU, flock, droits, FIFO, signaux, fichier renommé pendant qu'il est ouvert). La CI, sous Ubuntu, les exécute tous.

/** La raison de sauter un test sur `plateforme`, ou `false` sous Linux. */
export const reserveALinux = (plateforme = process.platform) => plateforme !== 'linux' && 'réservé à Linux : outils et comportement POSIX';

/** À donner à l'option `skip` d'un test réservé à Linux. */
export const SEUL_LINUX = reserveALinux();
