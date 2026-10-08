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

/** `feature`, `hotfix`, `principale` (master, dev) ou null pour tout autre nom. */
export function familleDe(branche) {
  if (branche === MASTER || branche === DEV) return 'principale';
  for (const [nom, f] of Object.entries(FAMILLES)) {
    if (branche.startsWith(f.prefixe) && branche.length > f.prefixe.length && !branche.endsWith('/')) return nom;
  }
  return null;
}

const REGLE_NOMS = 'seules feature/<nom> (créée depuis dev) et hotfix/<nom> (créée depuis master) peuvent être créées';

/** Une branche qu'on vient de créer : son nom est-il permis, et de quelle branche doit-elle partir ? */
export function verifierCreation(branche) {
  const famille = familleDe(branche);
  if (famille === 'principale') return { ok: true, famille, depuis: null };
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

/** Le marqueur qui demande une version majeure sur une livraison : « [V: X+1] » (espaces et casse libres). */
export const MARQUEUR_MAJEURE = /\[\s*V\s*:\s*X\s*\+\s*1\s*\]/i;

export function demandeMajeure(...textes) {
  return textes.some((t) => typeof t === 'string' && MARQUEUR_MAJEURE.test(t));
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function lireVersion(version) {
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

/**
 * Ce que le bot fait après une fusion. `versionMaster` et `versionDev` : les versions lues sur les branches APRÈS la fusion
 * (pour une livraison, master porte alors la version de dev qu'elle vient de recevoir).
 * Résultat :
 *   master : { version } si master change de version, sinon null
 *   dev    : { version, synchroniser } ; `synchroniser` = refusionner master dans dev avant de poser la version
 *   livrer : les installateurs à générer (`prod` depuis master, `test` depuis dev)
 */
export function planifier({ type, versionMaster, versionDev, majeure = false }) {
  if (type === 'feature') {
    return { master: null, dev: { version: incrementer(versionDev, 'patch'), synchroniser: false }, livrer: ['test'] };
  }
  if (type === 'hotfix') {
    return { master: null, dev: { version: incrementer(versionDev, 'patch'), synchroniser: true }, livrer: ['prod', 'test'] };
  }
  if (type === 'livraison') {
    // Base : la version livrée (celle de dev, reçue par master). Le maximum des deux évite tout retour en arrière si une branche a été modifiée à la main.
    const base = comparerVersions(versionMaster, versionDev) >= 0 ? versionMaster : versionDev;
    const version = incrementer(base, majeure ? 'majeure' : 'mineure');
    return { master: { version }, dev: { version, synchroniser: true }, livrer: ['prod', 'test'] };
  }
  throw new Error(`type de fusion inconnu « ${type} »`);
}

/**
 * Étiquette (tag Git) d'une livraison, unique parmi `existantes` :
 *   prod : vX.Y.Z, puis vX.Y.Z-hotfix.N (un hotfix ne change pas la version de master)
 *   test : vX.Y.Z-test
 * `motif` : suffixe quand l'étiquette de base existe déjà (`hotfix` pour un correctif, `rebuild` pour une régénération manuelle).
 */
export function etiquette({ mode, version, existantes = [], motif }) {
  lireVersion(version);
  if (mode !== 'prod' && mode !== 'test') throw new Error(`mode inconnu « ${mode} » (prod ou test)`);
  const deja = new Set(existantes);
  const base = mode === 'prod' ? `v${version}` : `v${version}-test`;
  if (!deja.has(base)) return base;
  const suffixe = motif ?? (mode === 'prod' ? 'hotfix' : 'rebuild');
  for (let n = 1; ; n += 1) if (!deja.has(`${base}-${suffixe}.${n}`)) return `${base}-${suffixe}.${n}`;
}

/** Mode d'une étiquette de livraison (les installateurs de test portent « -test »). */
export function modeDeEtiquette(tag) {
  return /^v\d+\.\d+\.\d+-test(?:-|$)/.test(tag) ? 'test' : 'prod';
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
