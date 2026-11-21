// Le contrôle du contenu écrit dans le dépôt (lot 8 du chantier « la base du site de dev devient la source de vérité », garde-fou 12 ; docs/flux-git.md,
// « Contenu écrit à la main (lot 8) »). Une fois la base du site de dev devenue la source, le contenu n'entre plus dans le dépôt que par le workflow de mise
// à jour ; ce module porte les règles, pures (des listes de fichiers et de commits), sans git : scripts/controler-le-contenu-ecrit.mjs les lit dans le dépôt.
//
// ÉTEINT tant que l'interrupteur (tools/flux-git/bascule-1.json, `actif`) vaut false dans `origin/dev` : rien n'est refusé. Allumé :
//   ecrit-a-la-main     une PR vers dev qui change data/rows/ : chaque commit de la PR qui y touche doit être celui du workflow de mise à jour (branche
//                       feature/mise-a-jour-regles-…, auteur et commiteur github-actions[bot], une ligne « Lot : <uuid> » ou « Copie : <uuid> », et rien
//                       hors de data/rows/) — sauf l'export qu'une migration de STRUCTURE ajoutée par la PR refait : data/rows/<t>.sql des seules tables que
//                       ses migrations nomment (CREATE, ALTER, DROP TABLE <t>, renommage, cible d'un INSERT … SELECT : tablesDeLaStructure), data/rows/VERSION
//                       (schema_version) et, pour un renommage seulement, les quatre tables qui gardent des noms (fichiersDeLaStructure). L'égalité
//                       exacte de cet export est prouvée par le job controle-des-migrations (base remplie migrée), pas ici ;
//   donnees             une PR vers dev qui ajoute une migration de données (sans DDL : controler-les-migrations-lib.mjs#analyserUneMigration) ; seule la
//                       structure reste ;
//   correctif-urgent    une PR hotfix/<nom> vers master qui change data/rows/, data/migrations/ ou data/schema.sql : ni contenu ni structure dans un
//                       correctif urgent.
// Sous l'interrupteur de la bascule 2 (tools/flux-git/bascule-2.json, `bascule2`, lu comme le premier dans origin/dev ; lot 11, PR 4), en plus et même quand le premier est éteint :
//   paquet-a-la-main    data/paquet.json (l'identité du dernier lot, sans contenu ; mise-a-jour-github.mjs#FICHIER_D_IDENTITE) ne change que dans un commit du workflow de mise à jour
//                       (« Lot : » ou « Copie : », mêmes conditions que pour data/rows/) ; ce commit peut porter data/rows/ ET data/paquet.json, rien d'autre ;
//   correctif-urgent    (suite) une PR hotfix/<nom> vers master qui change data/paquet.json.
// Éteint, rien de ceci n'existe : data/paquet.json n'est pas vu, et un commit du workflow qui le porterait serait refusé comme tout fichier hors de data/rows/.
// Limite : l'identité d'un commit se déclare (git) ; le contrôle écarte l'erreur et l'oubli, pas une falsification délibérée.
import { analyserUneMigration, TABLES_QUI_GARDENT_DES_NOMS } from './controler-les-migrations-lib.mjs';
import { BOT, BRANCHE_DU_WORKFLOW, FICHIER_D_IDENTITE } from './mise-a-jour-github.mjs';

/** L'interrupteur, relatif à la racine du dépôt ; il est lu dans `origin/dev` (la branche où arrive la PR du jour J), jamais dans la PR contrôlée. */
export const INTERRUPTEUR = 'tools/flux-git/bascule-1.json';
/** L'interrupteur de la bascule 2 (même branche) : le lire, c'est gel-des-fusions-lib.mjs#lireLInterrupteur. */
export const INTERRUPTEUR_BASCULE_2 = 'tools/flux-git/bascule-2.json';
export { FICHIER_D_IDENTITE };
/** La branche dont on lit l'interrupteur. */
export const BRANCHE_DE_L_INTERRUPTEUR = 'origin/dev';

const LIGNE_DU_WORKFLOW = /^(?:Lot|Copie) : [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/m;
const MIGRATION = /^data\/migrations\/\d{4}-[a-z0-9.-]+\.sql$/;
const dansLesLignes = (f) => f.startsWith('data/rows/');
const STRUCTURE = (f) => dansLesLignes(f) || f.startsWith('data/migrations/') || f === 'data/schema.sql';

/** L'interrupteur lu : `texte` (le fichier, ou null s'il manque : éteint). Lève une Error sur un fichier illisible (le contrôle ne se devine pas). */
export function lireLInterrupteur(texte) {
  if (texte === null || texte === undefined) return false;
  let v;
  try {
    v = JSON.parse(texte);
  } catch {
    throw new Error(`${INTERRUPTEUR} illisible (JSON attendu : { "actif": false } ou { "actif": true })`);
  }
  if (!v || typeof v !== 'object' || typeof v.actif !== 'boolean') throw new Error(`${INTERRUPTEUR} : « actif » doit valoir true ou false`);
  return v.actif;
}

/**
 * Le commit est-il celui du workflow de mise à jour ? `c` : { sha, auteur, courriel, commiteur, courrielCommiteur, message, fichiers } ; `source` : la branche
 * de la PR. Rend null s'il l'est, sinon la raison.
 */
export function raisonHorsWorkflow(c, source, { identite = false } = {}) {
  if (!BRANCHE_DU_WORKFLOW.test(String(source))) return `la PR ne vient pas d’une branche du workflow (feature/mise-a-jour-regles-…)`;
  if (c.auteur !== BOT.nom || c.courriel !== BOT.courriel || c.commiteur !== BOT.nom || c.courrielCommiteur !== BOT.courriel) return 'auteur ou commiteur autre que github-actions[bot]';
  if (!LIGNE_DU_WORKFLOW.test(String(c.message))) return 'message sans ligne « Lot : <uuid> » ni « Copie : <uuid> »';
  const autres = c.fichiers.filter((f) => !dansLesLignes(f) && !(identite && f === FICHIER_D_IDENTITE));
  if (autres.length) return `le commit change aussi ${autres.slice(0, 3).join(', ')}${autres.length > 3 ? '…' : ''}`;
  return null;
}

/**
 * Les tables que les migrations de STRUCTURE de `migrations` ({ fichier → texte }) nomment : objet d'un CREATE, ALTER ou DROP TABLE, les deux noms d'un
 * renommage de table, la table d'un renommage de colonne, la cible d'un INSERT (ou REPLACE) … SELECT. Une migration de données n'en donne aucune.
 */
export function tablesDeLaStructure(migrations = new Map()) {
  const tables = new Set();
  for (const sql of migrations.values()) {
    const analyse = analyserUneMigration(sql);
    if (analyse.nature !== 'structure') continue;
    for (const x of analyse.instructions) {
      if (x.genre === 'ddl' && x.objet === 'TABLE' && x.nom) tables.add(String(x.nom).toLowerCase());
      const r = x.renommage;
      for (const n of !r ? [] : r.type === 'table' ? [r.de, r.vers] : [r.table]) if (n) tables.add(String(n).toLowerCase());
      if (x.genre === 'dml' && ['INSERT', 'REPLACE'].includes(x.verbe) && x.nom && x.jetons.some((j) => j.t === 'w' && j.v.toUpperCase() === 'SELECT')) tables.add(String(x.nom).toLowerCase());
    }
  }
  return tables;
}
const nomDuFichier = (f) => f.replace(/^data\/rows\//, '').replace(/\.sql$/, '');

/**
 * Les fichiers de `data/rows/` que l'export refait quand la PR ajoute une migration de STRUCTURE : le fichier de chaque table que ces migrations nomment
 * (`tablesDeLaStructure`) ; `VERSION` (`schema_version`, réécrit par tools/db/maverick.py#exporter à chaque changement de schéma) ; et, seulement si l'une
 * renomme une table ou une colonne, les tables qui gardent des noms (`TABLES_QUI_GARDENT_DES_NOMS` : journal, historique, lots déposés, plafond des numéros),
 * que la règle `renommage` de controler-les-migrations-lib.mjs oblige cette migration à réécrire. Sans migration de structure : rien.
 */
export function fichiersDeLaStructure(migrations = new Map()) {
  const fichiers = new Set();
  let structure = false;
  let renomme = false;
  for (const sql of migrations.values()) {
    const analyse = analyserUneMigration(sql);
    if (analyse.nature !== 'structure') continue;
    structure = true;
    if (analyse.renommages.length) renomme = true;
  }
  if (!structure) return fichiers;
  for (const t of tablesDeLaStructure(migrations)) fichiers.add(`data/rows/${t}.sql`);
  fichiers.add('data/rows/VERSION');
  if (renomme) for (const t of TABLES_QUI_GARDENT_DES_NOMS) fichiers.add(`data/rows/${t}.sql`);
  return fichiers;
}

/**
 * Les règles. `actif` : l'interrupteur ; `cible`, `source` : les branches de la PR ; `fichiers` : les chemins changés par la PR (merge-base → tête) ;
 * `commits` : ceux de la PR qui touchent data/rows/ (raisonHorsWorkflow) ; `migrations` : { fichier → texte } des migrations AJOUTÉES par la PR.
 * Rend { actif, refus: [{ regle, message }] } ; éteint, jamais de refus.
 */
export function controlerLeContenu({ actif, bascule2 = false, cible, source, fichiers = [], commits = [], migrations = new Map() }) {
  const refus = [];
  if (bascule2) refus.push(...refusDeLIdentite({ cible, source, fichiers, commits }));
  if (!actif) return { actif: false, ...(bascule2 ? { bascule2 } : {}), refus };
  if (cible === 'master' && String(source).startsWith('hotfix/')) {
    const touches = fichiers.filter(STRUCTURE);
    if (touches.length) {
      refus.push({ regle: 'correctif-urgent', message: `un correctif urgent ne porte ni contenu ni structure : ${touches.slice(0, 5).join(', ')}${touches.length > 5 ? ` (et ${touches.length - 5} autre(s))` : ''}. Le contenu se corrige sur le site de dev, la structure par une PR vers dev.` });
    }
    return { actif, ...(bascule2 ? { bascule2 } : {}), refus };
  }
  if (cible !== 'dev') return { actif, ...(bascule2 ? { bascule2 } : {}), refus };
  if (fichiers.some(dansLesLignes)) {
    const refaites = fichiersDeLaStructure(migrations);
    // un commit qui ne touche que data/paquet.json (la liste des commits le contient sous l'interrupteur de la bascule 2) relève de refusDeLIdentite
    for (const c of commits.filter((x) => x.fichiers.some(dansLesLignes))) {
      const raison = raisonHorsWorkflow(c, source, { identite: bascule2 });
      // hors du workflow, seul l'export refait par les migrations de structure de la PR est admis (fichiersDeLaStructure)
      const autres = c.fichiers.filter(dansLesLignes).filter((f) => !refaites.has(f));
      if (raison && refaites.size && !autres.length) continue;
      if (raison) refus.push({ regle: 'ecrit-a-la-main', message: `commit ${String(c.sha).slice(0, 7)} : change data/rows/ hors du workflow de mise à jour (${raison})${refaites.size ? ' ; fichiers hors de ce que refont les migrations de structure de la PR (tables nommées, VERSION, et pour un renommage le journal, l’historique, les lots déposés et le plafond des numéros)' : ' ; fichiers (aucune migration de structure dans la PR)'} : ${autres.slice(0, 5).map(nomDuFichier).join(', ')}. Le contenu s’écrit sur le site de dev, puis « Effectuer la mise à jour » ou « Copier vers le dépôt ».` });
    }
    if (!commits.length) refus.push({ regle: 'ecrit-a-la-main', message: 'data/rows/ change sans commit qui le porte (contrôle impossible) : refusé.' });
  }
  for (const [fichier, sql] of [...migrations].sort(([a], [b]) => a.localeCompare(b))) {
    if (!MIGRATION.test(`data/migrations/${fichier}`)) continue;
    if (analyserUneMigration(sql).nature === 'donnees') {
      refus.push({ regle: 'donnees', message: `${fichier} : migration de données (sans DDL). Depuis la bascule, une migration ne porte que de la structure ; une donnée se change sur le site de dev.` });
    }
  }
  return { actif, ...(bascule2 ? { bascule2 } : {}), refus };
}

/**
 * L'identité du lot (bascule 2 allumée) : `data/paquet.json` ne change que dans un commit du workflow de mise à jour, jamais dans une hotfix. Ne lit que les
 * chemins et les commits ; `commits` contient ceux qui touchent data/rows/ ou data/paquet.json.
 */
export function refusDeLIdentite({ cible, source, fichiers = [], commits = [] }) {
  if (!fichiers.includes(FICHIER_D_IDENTITE)) return [];
  if (cible === 'master' && String(source).startsWith('hotfix/')) {
    return [{ regle: 'correctif-urgent', message: `un correctif urgent ne porte pas ${FICHIER_D_IDENTITE} (l'identité du paquet : elle ne change que par une mise à jour du site de dev). Retirer ce fichier de la PR.` }];
  }
  if (cible !== 'dev') return [];
  const portent = commits.filter((c) => c.fichiers.includes(FICHIER_D_IDENTITE));
  if (!portent.length) return [{ regle: 'paquet-a-la-main', message: `${FICHIER_D_IDENTITE} change sans commit qui le porte (contrôle impossible) : refusé.` }];
  const refus = [];
  for (const c of portent) {
    const raison = raisonHorsWorkflow(c, source, { identite: true });
    if (raison) refus.push({ regle: 'paquet-a-la-main', message: `commit ${String(c.sha).slice(0, 7)} : change ${FICHIER_D_IDENTITE} hors du workflow de mise à jour (${raison}). Ce fichier est écrit par « Effectuer la mise à jour » ; une PR ne le change pas.` });
  }
  return refus;
}
