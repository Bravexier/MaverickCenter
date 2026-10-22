// Règles du flux Git de Maverick Center (décision du propriétaire, voir docs/flux-git.md).
// Fonctions pures, sans dépendance ni accès à Git : la partie Git est dans cli.mjs, les workflows l'appellent.
// Testées par client/test/flux-git.test.mjs.
//
//   master  production ; ne reçoit que dev (livraison) et hotfix/<nom>
//   dev     intégration ; ne reçoit que feature/<nom>
//   hotfix/<nom>  créée depuis master, fusionnée dans master
//   feature/<nom> créée depuis dev, fusionnée dans dev
//
// Versions (X.Y.Z, dans client/package.json), tenues par le bot après chaque fusion :
//   feature → dev     dev : X.Y.Z+1                    master inchangée
//   dev → master      dev et master : X.Y+1.0          ou X+1.0.0 si la PR porte [V: X+1]
//   hotfix → master   master inchangée ; master est refusionnée dans dev, puis dev : X.Y.Z+1
// Chaque nouvelle version est étiquetée (tag Git) sur le commit qui la porte : VX.Y.Z sur dev, VX.Y sur master (etiquetteDeVersion).
//
// Ce qui est livré dépend de la version (PREMIERE_VERSION_HEBERGEE, décision du propriétaire ; la 1.0, elle, reste son signal d'ouverture à tout le Discord) :
//   avant la 0.2.0    un seul site, reconstruit depuis dev après chaque fusion (branche « site », fonctionnement d'avant le flux)
//   à partir de 0.2.0 un installateur de production (master) et un installateur de test (dev) après chaque fusion

export const MASTER = 'master';
export const DEV = 'dev';

/**
 * Familles de branches de travail : d'où elles partent, et les branches dont elles ne doivent rien contenir (`opposees`), hormis ce qui est
 * déjà dans `admises`. Une hotfix ne contient rien de dev ni d'une feature qui ne soit déjà en production. Une feature peut contenir master
 * (c'est la production : dev la reçoit de toute façon, et c'est ainsi qu'on résout une refusion en conflit), mais pas une hotfix encore non livrée.
 */
export const FAMILLES = {
  feature: { prefixe: 'feature/', depuis: DEV, opposees: ['hotfix/'], admises: [MASTER] },
  hotfix: { prefixe: 'hotfix/', depuis: MASTER, opposees: [DEV, 'feature/'], admises: [] },
};

/**
 * Première version livrée par installateurs (serveur normal et serveur de test) : avant elle, un seul site publié sur la branche « site ».
 * Décision du propriétaire (2026-10-10) : le duo normal / test est mis à l'essai en 0.Y, avant l'ouverture à tout le Discord (la 1.0).
 */
export const PREMIERE_VERSION_HEBERGEE = '0.2.0';

/** Branche de publication du site avant PREMIERE_VERSION_HEBERGEE, écrite par le bot seul. */
export const SITE = 'site';

/** `feature`, `hotfix`, `principale` (master, dev), `publication` (site) ou null pour tout autre nom. */
export function familleDe(branche) {
  if (branche === MASTER || branche === DEV) return 'principale';
  if (branche === SITE) return 'publication';
  for (const [nom, f] of Object.entries(FAMILLES)) {
    if (branche.startsWith(f.prefixe) && branche.length > f.prefixe.length && !branche.endsWith('/')) return nom;
  }
  return null;
}

const REGLE_NOMS = 'seules feature/<nom> (créée depuis dev) et hotfix/<nom> (créée depuis master) peuvent être créées';

/** Une branche qu'on vient de créer : son nom est-il permis, et de quelle branche doit-elle partir ? */
export function verifierCreation(branche) {
  const famille = familleDe(branche);
  if (famille === 'principale' || famille === 'publication') return { ok: true, famille, depuis: null };
  if (!famille) return { ok: false, famille, raison: `nom de branche interdit « ${branche} » : ${REGLE_NOMS}` };
  return { ok: true, famille, depuis: FAMILLES[famille].depuis };
}

/**
 * Une PR : la branche source est-elle permise pour cette cible ?
 * master n'accepte que dev et hotfix/<nom> ; dev n'accepte que feature/<nom> ; les autres cibles sont libres.
 * `memeDepot` : la source vient de ce dépôt (pas d'une copie), condition pour master et dev.
 */
export function verifierPR({ base, head, memeDepot = true }) {
  if (base !== MASTER && base !== DEV) return { ok: true, type: null };
  const type = typeDeFusion({ base, head });
  if (!type) {
    const attendu = base === MASTER ? 'dev ou hotfix/<nom>' : 'feature/<nom>';
    return { ok: false, type, raison: `${base} n'accepte que ${attendu} (source reçue : « ${head} »)` };
  }
  if (!memeDepot) return { ok: false, type, raison: `une PR vers ${base} doit venir d'une branche de ce dépôt` };
  return { ok: true, type };
}

/** `livraison` (dev → master), `hotfix` (hotfix/<nom> → master), `feature` (feature/<nom> → dev), ou null. */
export function typeDeFusion({ base, head }) {
  const famille = familleDe(head);
  if (base === MASTER && head === DEV) return 'livraison';
  if (base === MASTER && famille === 'hotfix') return 'hotfix';
  if (base === DEV && famille === 'feature') return 'feature';
  return null;
}

/**
 * Branche de travail à supprimer une fois sa fusion traitée par le bot : la feature ou la hotfix elle-même, jamais dev (source d'une
 * livraison) ni une branche hors des règles.
 */
export function brancheASupprimer({ base, head }) {
  const type = typeDeFusion({ base, head });
  return type === 'feature' || type === 'hotfix' ? head : null;
}

/** Le marqueur qui demande une version majeure sur une livraison : « [V: X+1] » (espaces et casse libres). */
export const MARQUEUR_MAJEURE = /\[\s*V\s*:\s*X\s*\+\s*1\s*\]/i;

export function demandeMajeure(...textes) {
  return textes.some((t) => typeof t === 'string' && MARQUEUR_MAJEURE.test(t));
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function lireVersion(version) {
  const m = SEMVER.exec(String(version ?? ''));
  if (!m) throw new Error(`version invalide « ${version} » (X.Y.Z attendu)`);
  return m.slice(1).map(Number);
}

export function comparerVersions(a, b) {
  const [x, y] = [lireVersion(a), lireVersion(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** `patch` : X.Y.Z+1 ; `mineure` : X.Y+1.0 ; `majeure` : X+1.0.0. */
export function incrementer(version, niveau) {
  const [x, y, z] = lireVersion(version);
  if (niveau === 'patch') return `${x}.${y}.${z + 1}`;
  if (niveau === 'mineure') return `${x}.${y + 1}.0`;
  if (niveau === 'majeure') return `${x + 1}.0.0`;
  throw new Error(`niveau d'incrément inconnu « ${niveau} »`);
}

/** Avant la 1.0 : version majeure 0. */
export function avantLaUn(version) {
  return lireVersion(version)[0] === 0;
}

/** Avant PREMIERE_VERSION_HEBERGEE : le site unique (branche « site »), pas d'installateurs. */
export function avantHebergement(version) {
  return comparerVersions(version, PREMIERE_VERSION_HEBERGEE) < 0;
}

/**
 * Ce que produit une branche arrivée à cette version : avant PREMIERE_VERSION_HEBERGEE, dev → `site` (le site unique) et master → rien ;
 * ensuite, master → `prod` (installateur du serveur normal) et dev → `test` (installateur du serveur de test).
 */
export function livrableDe(branche, version) {
  if (branche !== MASTER && branche !== DEV) throw new Error(`branche livrable : master ou dev (reçu « ${branche} »)`);
  if (avantHebergement(version)) return branche === DEV ? 'site' : null;
  return branche === DEV ? 'test' : 'prod';
}

/**
 * Ce que le bot fait après une fusion. `versionMaster` et `versionDev` : les versions lues sur les branches APRÈS la fusion
 * (pour une livraison, master porte alors la version de dev qu'elle vient de recevoir).
 * Résultat :
 *   master : { version } si master change de version, sinon null
 *   dev    : { version, synchroniser } ; `synchroniser` = refusionner master dans dev avant de poser la version
 *   livrer : ce qui est publié ensuite (voir livrableDe) : `prod` depuis master, puis `test` ou `site` depuis dev
 */
export function planifier({ type, versionMaster, versionDev, majeure = false }) {
  const livrer = (master, dev) => [master && livrableDe(MASTER, master), livrableDe(DEV, dev)].filter(Boolean);
  if (type === 'feature') {
    const dev = incrementer(versionDev, 'patch');
    return { master: null, dev: { version: dev, synchroniser: false }, livrer: livrer(null, dev) };
  }
  if (type === 'hotfix') {
    // Le hotfix change le contenu de master (pas sa version) : un nouvel installateur de production (livrableDe).
    const dev = incrementer(versionDev, 'patch');
    return { master: null, dev: { version: dev, synchroniser: true }, livrer: livrer(versionMaster, dev) };
  }
  if (type === 'livraison') {
    // Base : la version livrée (celle de dev, reçue par master). Le maximum des deux évite tout retour en arrière si une branche a été modifiée à la main.
    const base = comparerVersions(versionMaster, versionDev) >= 0 ? versionMaster : versionDev;
    const version = incrementer(base, majeure ? 'majeure' : 'mineure');
    return { master: { version }, dev: { version, synchroniser: true }, livrer: livrer(version, version) };
  }
  throw new Error(`type de fusion inconnu « ${type} »`);
}

/**
 * Étiquette de version (demande du propriétaire : retrouver une version sans passer par le numéro de commit), posée par le bot sur le
 * commit qui porte la nouvelle version d'une branche : VX.Y.Z sur dev, VX.Y sur master (master ne change de version qu'à une livraison,
 * toujours en X.Y.0). Toutes les étiquettes commencent par « V » majuscule, installateurs compris : deux étiquettes qui ne diffèrent que
 * par la casse (V0.2.0 et v0.2.0) se confondent dans un clone Windows ou macOS.
 */
export function etiquetteDeVersion(branche, version) {
  const [x, y, z] = lireVersion(version);
  if (branche === DEV) return `V${x}.${y}.${z}`;
  if (branche === MASTER) return `V${x}.${y}`;
  throw new Error(`branche versionnée : master ou dev (reçu « ${branche} »)`);
}

/**
 * Étiquette (tag Git) d'une livraison, unique parmi `existantes` : l'étiquette de version de la branche elle-même (décision du
 * propriétaire, 2026-10-11 : deux serveurs, deux formes d'étiquette, pas de suffixe « -test »).
 *   prod : VX.Y, l'étiquette de version de master (une livraison dev → master publie sa production sous le nom de sa version),
 *          puis VX.Y-hotfix.N (un hotfix ne change pas la version de master)
 *   test : VX.Y.Z, l'étiquette de version de dev (chaque fusion dans dev change sa version)
 * `motif` : suffixe quand l'étiquette de base existe déjà (`hotfix` pour un correctif, `rebuild` pour une régénération manuelle).
 */
export function etiquette({ mode, version, existantes = [], motif }) {
  lireVersion(version);
  if (mode !== 'prod' && mode !== 'test') throw new Error(`mode inconnu « ${mode} » (prod ou test)`);
  const deja = new Set(existantes);
  const base = etiquetteDeVersion(mode === 'prod' ? MASTER : DEV, version);
  if (!deja.has(base)) return base;
  const suffixe = motif ?? (mode === 'prod' ? 'hotfix' : 'rebuild');
  for (let n = 1; ; n += 1) if (!deja.has(`${base}-${suffixe}.${n}`)) return `${base}-${suffixe}.${n}`;
}

/**
 * Mode d'une étiquette de livraison, d'après sa forme : `test` (VX.Y.Z, VX.Y.Z-rebuild.N : la version complète de dev), `prod` (VX.Y,
 * VX.Y-hotfix.N, VX.Y-rebuild.N), null pour toute autre (dont V0.2.0-test, seule livraison de test d'avant cette règle).
 * Une étiquette VX.Y.Z d'avant la 0.2.1 est une étiquette de version sans installateur.
 */
export function modeDeEtiquette(tag) {
  if (/^V\d+\.\d+\.\d+(?:-rebuild\.\d+)?$/.test(tag)) return 'test';
  if (/^V\d+\.\d+(?:-(?:hotfix|rebuild)\.\d+)?$/.test(tag)) return 'prod';
  return null;
}

/**
 * Mise à jour d'un fichier JSON d'npm (package.json, package-lock.json) : seule la version change, le reste du texte est conservé.
 * package-lock porte la version deux fois (racine et `packages[""]`).
 */
export function poserVersionJson(texte, version) {
  lireVersion(version);
  const json = JSON.parse(texte);
  json.version = version;
  if (json.packages?.['']) json.packages[''].version = version;
  const fin = texte.endsWith('\n') ? '\n' : '';
  return JSON.stringify(json, null, 2) + fin;
}
