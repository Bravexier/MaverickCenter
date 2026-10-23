// Règles pures de l'état d'une branche (tools/flux-git/etat-branche.mjs ; docs/flux-git.md) : classement d'un conflit selon la table du skill
// resoudre-un-conflit, migrations dont la base a pris le numéro, branche de refusion. Sans accès à Git ni au disque. Testées par
// client/test/flux-git-etat.test.mjs.

/** Les natures d'un conflit (skill resoudre-un-conflit, « Qui résout quoi ») : qui le résout, et comment. */
export const NATURES = {
  mecanique: { qui: 'tech-publication', comment: 'ajouts des deux côtés : garder les deux apports, dans l\'ordre du fichier' },
  'version-verrou': { qui: 'tech-publication', comment: 'garder la version de la base (tenue par le bot)' },
  dependances: { qui: 'tech-publication', comment: 'réunir les deux apports dans client/package.json, puis npm install --package-lock-only (jamais le verrou à la main)' },
  schema: { qui: 'tech-db', comment: 'garder les apports des deux côtés ; PRAGMA user_version au numéro de la migration de la branche' },
  migration: { qui: 'tech-db', comment: 'renuméroter la migration de la branche au numéro suivant (.sql, registre .json, tests et skills qui la citent)' },
  outil: { qui: 'tech-db', comment: 'jamais à la main : partir de la base, rejouer l\'outil de la branche (db:migrate, db:sync-pages, db:appliquer-edition), puis npm run db:doc' },
  sens: { qui: 'l\'auteur de la zone, appelé par le leader-technique', comment: 'garder le comportement voulu des deux côtés, avec le skill de la zone ; un choix du propriétaire perdu : question' },
};

/** Les fichiers d'instructions : un conflit de sens y est résolu par la session principale. */
const INSTRUCTIONS = [/^CLAUDE\.md$/, /^\.claude\//, /^docs\/equipe\.md$/];

/** Fichiers tenus par un outil (jamais résolus à la main). */
const FICHIERS_D_OUTIL = [/^data\/rows\//, /^docs\/sql\/structure\.md$/, /^docs\/sql\/apercu\.md$/];

const lignesDe = (texte) => (texte ?? '').split('\n');

/** Vrai si toutes les lignes de `base` restent, dans l'ordre, dans `cote` : ce côté n'a fait qu'ajouter. */
export function ajoutsSeuls(base, cote) {
  const b = lignesDe(base);
  const c = lignesDe(cote);
  let i = 0;
  for (const ligne of c) if (i < b.length && ligne === b[i]) i += 1;
  return i === b.length;
}

const sansVersion = (texte) => lignesDe(texte).filter((l) => !/^\s*"version"\s*:/.test(l)).join('\n');

/**
 * La nature d'un fichier en conflit : `chemin` (depuis la racine) et ses trois versions — `base` (ancêtre commun, `git show :1:<chemin>`), `nous`
 * (`:2:`) et `eux` (`:3:`), null quand un côté n'a pas le fichier (ajout ou suppression). Rend { nature, qui, comment }. Un conflit qu'aucune
 * règle ne range est un conflit de sens (le plus prudent).
 */
export function classerConflit({ chemin, base = null, nous = null, eux = null }) {
  const avec = (nature, extra = {}) => ({ nature, ...NATURES[nature], ...extra });
  if (FICHIERS_D_OUTIL.some((re) => re.test(chemin))) return avec('outil');
  if (chemin === 'data/schema.sql') return avec('schema');
  if (/^data\/migrations\//.test(chemin)) return avec('migration');
  if (/(^|\/)package-lock\.json$/.test(chemin)) return avec('version-verrou', { comment: 'garder le verrou de la base, puis npm install --package-lock-only si les dépendances ont changé' });
  if (/(^|\/)package\.json$/.test(chemin)) {
    if (base !== null && nous !== null && eux !== null) {
      const [b, n, e] = [base, nous, eux].map(sansVersion);
      if (n === b || e === b || n === e) return avec('version-verrou');
    }
    return avec('dependances');
  }
  if (base !== null && nous !== null && eux !== null && ajoutsSeuls(base, nous) && ajoutsSeuls(base, eux)) return avec('mecanique');
  const sens = avec('sens');
  if (INSTRUCTIONS.some((re) => re.test(chemin))) sens.qui = 'la session principale (instructions)';
  if (base === null || nous === null || eux === null) sens.comment = `${base === null ? 'ajouté des deux côtés' : 'supprimé d\'un côté, modifié de l\'autre'} : ${sens.comment}`;
  return sens;
}

/**
 * Les migrations ajoutées par le lot dont la base a déjà pris le numéro (sous un autre nom) : à renuméroter (tech-db). `ajoutees` : chemins
 * `data/migrations/NNNN-nom.ext` ajoutés par la branche ; `dansLaBase` : ceux de la base. Rend [{ chemin, numero, prisPar: [chemins] }].
 */
export function migrationsARenumeroter({ ajoutees, dansLaBase }) {
  const numero = (c) => /^data\/migrations\/(\d+)-/.exec(c)?.[1] ?? null;
  const souche = (c) => c.replace(/\.[^./]+$/, '');
  const parNumero = new Map();
  for (const c of dansLaBase) {
    const n = numero(c);
    if (n) { if (!parNumero.has(n)) parNumero.set(n, new Set()); parNumero.get(n).add(souche(c)); }
  }
  const ajouteesSouches = new Set(ajoutees.map(souche));
  const resultat = [];
  for (const c of [...ajoutees].sort()) {
    const n = numero(c);
    if (!n || !parNumero.has(n)) continue;
    const autres = [...parNumero.get(n)].filter((s) => s !== souche(c) && !ajouteesSouches.has(s));
    if (autres.length) resultat.push({ chemin: c, numero: n, prisPar: autres.sort() });
  }
  return resultat;
}

/**
 * Une branche de refusion contient une fusion qui doit rester (docs/flux-git.md) : elle ne se rebase jamais. `fusions` : les commits de fusion
 * propres à la branche (`git rev-list --merges <base>..HEAD`), chacun { sha, apporteMaster } (un parent atteint depuis master).
 * Rend { refusion, raison }.
 */
export function brancheDeRefusion(fusions) {
  if (!fusions.length) return { refusion: false, raison: 'aucune fusion propre à la branche' };
  const deMaster = fusions.filter((f) => f.apporteMaster);
  return {
    refusion: true,
    raison: deMaster.length
      ? `${deMaster.length} fusion(s) de master (refusion) : ne pas rebaser ; si la base bouge, refaire la refusion depuis la nouvelle base`
      : `${fusions.length} fusion(s) qui ne viennent pas de master : ne pas rebaser sans comprendre (aucune autre fusion n'est permise dans une branche)`,
  };
}

/**
 * La branche distante face à la locale. `distants` : [{ sha, sujet, equivalent }], les commits de origin/<branche> absents de HEAD
 * (`git log --right-only --cherry-mark HEAD...origin/<branche>` ; `equivalent` : le même patch existe en local) ; `connus` : les commits que la
 * branche locale a portés un jour (son reflog). Un commit équivalent ou connu a été remplacé par un rebase : la branche est réécrite et la distante
 * attend `push --force-with-lease`. Les autres sont de vrais commits distants (une suggestion appliquée sur GitHub) à reprendre avant tout :
 * `git rebase <ref>` si la branche n'a pas été réécrite, sinon `git cherry-pick` (un rebase sur la distante remettrait les anciens commits).
 */
export function etatDeLaDistante({ distants, connus, nonPousses, ref }) {
  const remplace = (c) => c.equivalent || connus.has(c.sha);
  const remplaces = distants.filter(remplace);
  const reecrite = remplaces.length > 0;
  const aReprendre = distants.filter((c) => !remplace(c))
    .map((c) => ({ sha: c.sha, sujet: c.sujet, commande: reecrite ? `git cherry-pick ${c.sha.slice(0, 10)}` : `git rebase ${ref}` }));
  let conseil;
  if (aReprendre.length) conseil = `reprendre d'abord ${aReprendre.length} commit(s) distant(s)${reecrite ? ' un par un (branche réécrite : pas de rebase sur la distante)' : ''}, puis pousser`;
  else if (reecrite) conseil = 'branche réécrite par un rebase : git push --force-with-lease --force-if-includes attendu';
  else if (nonPousses) conseil = `${nonPousses} commit(s) à pousser (git push)`;
  else conseil = 'à jour avec la distante';
  return { aReprendre, remplaces: remplaces.map((c) => ({ sha: c.sha, sujet: c.sujet })), reecrite, nonPousses, conseil };
}

/** Ce que l'état dit de faire pour le rebase : { necessaire, conseil }. */
export function conseilDeRebase({ aJour, refusion }) {
  if (aJour) return { necessaire: false, conseil: 'la base est déjà dans la branche : rien à rebaser' };
  if (refusion) return { necessaire: false, conseil: 'branche de refusion : ne pas rebaser, refaire la refusion depuis la nouvelle base' };
  return { necessaire: true, conseil: 'la base a bougé : git rebase <base>' };
}
