// Les règles des migrations, contrôlées par GitHub (lot 7 du chantier « la base du site de dev devient la source de vérité », R274, R275 ; docs/flux-git.md,
// « Règles des migrations (lot 7) »). Ce module porte les règles, sans le passage sur une base remplie (scripts/controler-les-migrations-base.mjs) ni la ligne
// de commande (scripts/controler-les-migrations.mjs). Les règles sont des fonctions pures sur des textes : elles se testent sans dépôt git.
//
//   figee          une migration fusionnée ne se modifie plus, ne se renomme pas, ne se supprime pas (ni son registre .json) : « elle ne s'annule pas, on en écrit
//                  un autre » ;
//   numero         une migration nouvelle prend un numéro après la dernière fusionnée, et un seul fichier par numéro ;
//   interdit       ni BEGIN, COMMIT, END, ROLLBACK ni PRAGMA (serveur/structure-sur-place.mjs#migrationInterdite : le service ouvre sa transaction) ;
//   structure      (numéro > 129) une migration qui porte du DDL (CREATE, ALTER, DROP) est « de structure » : son DML ne déplace ou ne recopie que des colonnes,
//                  et ses littéraux ressemblent à un code (jamais un texte de règle). Sans DDL, elle est « de données » : permise jusqu'à la bascule du lot 8,
//                  signalée ;
//   renommage      un ALTER TABLE … RENAME (de table ou de colonne) réécrit dans la même migration le journal et l'historique, le lot de changements et le
//                  plafond des numéros, qui gardent les noms de tables et de colonnes.
// Aucune dépendance hors de node: et de serveur/structure-sur-place.mjs.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { migrationInterdite } from '../serveur/structure-sur-place.mjs';

/** La première migration soumise à la règle « structure » : la 0129 est la dernière d'avant les règles (elle crée seulement `migration_recue`). */
export const PREMIERE_MIGRATION_CONTROLEE = 130;
/** Un fichier de data/migrations/ : la migration (.sql) ou son registre (.json). */
const FICHIER_DE_MIGRATION = /^(\d{4})-[a-z0-9.-]+\.(sql|json)$/;
/** Un littéral qui ressemble à un code (une nature, un mode, un identifiant) : jamais un texte de règle. */
const LITTERAL_DE_CODE = /^[a-z0-9_.-]{1,40}$/;
/** Un identifiant de page ou de ligne : un code qui peut porter des `/` (« races/x »), minuscules, sans espace. */
const LITTERAL_D_IDENTIFIANT = /^[a-z0-9_./-]{1,80}$/;
/** Un chemin JSON (`$.nom`, `$[0].x`), sans espace. */
const LITTERAL_DE_CHEMIN_JSON = /^\$[A-Za-z0-9_.[\]-]{0,78}$/;
/** Un format de `strftime` (`%Y-%m-%dT%H:%M:%SZ`) : des conversions `%x` et des séparateurs, sans espace. */
const LITTERAL_DE_FORMAT_DE_DATE = /^(?:%[A-Za-z%]|[-:.TZ/])+$/;
const litteralAdmis = (v) => v === '' || LITTERAL_DE_CODE.test(v) || LITTERAL_D_IDENTIFIANT.test(v) || LITTERAL_DE_CHEMIN_JSON.test(v) || (v.length <= 40 && LITTERAL_DE_FORMAT_DE_DATE.test(v));
/** Un littéral qui cite un nom renommé : chemin ou motif de clé JSON (`$.nom`, `"nom":`, `%"nom"%`), sans espace. */
const LITTERAL_DE_NOM = /^[A-Za-z0-9_.$"':,[\]{}%/-]{1,120}$/;
/** Les tables qui gardent des noms de tables et de colonnes : un renommage les réécrit (journal, historique, lot déposé, plafond des numéros). */
export const TABLES_QUI_GARDENT_DES_NOMS = Object.freeze(['modification', 'historique_modification', 'lot_de_changements', 'numero_donne']);

/** Une règle violée : le fichier, la règle (code ci-dessus) et ce qui est reproché. */
export const refus = (fichier, regle, message) => ({ fichier, regle, message });

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le SQL en jetons : chaînes, commentaires et déclencheurs respectés
// ---------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Les jetons d'un SQL : { t: 'w' (mot), 'id' (identifiant entre guillemets), 'str' (chaîne), 'blob', 'num', 'p' (ponctuation), v }. Les commentaires
 * (une ligne après deux tirets, ou entre barre-étoile et étoile-barre) sont retirés ; `''` dans une chaîne est une apostrophe.
 */
export function jetons(sql) {
  const s = String(sql);
  const sortie = [];
  const n = s.length;
  let i = 0;
  const lireEntre = (debut, fin) => {
    let v = '';
    let j = debut + 1;
    while (j < n) {
      if (s[j] === fin) {
        if (s[j + 1] === fin) { v += fin; j += 2; continue; }
        break;
      }
      v += s[j];
      j += 1;
    }
    return { v, suite: j + 1 };
  };
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '-' && s[i + 1] === '-') { const f = s.indexOf('\n', i); i = f < 0 ? n : f + 1; continue; }
    if (c === '/' && s[i + 1] === '*') { const f = s.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
    if (c === "'") { const { v, suite } = lireEntre(i, "'"); sortie.push({ t: 'str', v }); i = suite; continue; }
    if (c === '"' || c === '`') { const { v, suite } = lireEntre(i, c); sortie.push({ t: 'id', v }); i = suite; continue; }
    if (c === '[') { const f = s.indexOf(']', i); const fin = f < 0 ? n : f; sortie.push({ t: 'id', v: s.slice(i + 1, fin) }); i = fin + 1; continue; }
    if (/[\p{L}_]/u.test(c)) {
      let j = i + 1;
      while (j < n && /[\p{L}\p{N}_$]/u.test(s[j])) j += 1;
      const mot = s.slice(i, j);
      if (/^[xX]$/.test(mot) && s[j] === "'") { const { v, suite } = lireEntre(j, "'"); sortie.push({ t: 'blob', v }); i = suite; continue; }
      sortie.push({ t: 'w', v: mot });
      i = j;
      continue;
    }
    const nombre = /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(s.slice(i, i + 40));
    if (nombre) { sortie.push({ t: 'num', v: nombre[0] }); i += nombre[0].length; continue; }
    sortie.push({ t: 'p', v: c });
    i += 1;
  }
  return sortie;
}

const mot = (jeton) => (jeton && (jeton.t === 'w' || jeton.t === 'id') ? jeton.v.toLowerCase() : null);
const estMot = (jeton, ...attendus) => jeton?.t === 'w' && attendus.includes(jeton.v.toUpperCase());

/**
 * Le SQL découpé en instructions (listes de jetons) : `;` hors d'une chaîne et d'un commentaire, le corps BEGIN … END d'un déclencheur (CASE … END compris)
 * restant dans son instruction.
 */
export function decouperLeSql(sql) {
  const instructions = [];
  let courante = [];
  let declencheur = false;
  let corps = false;
  let cases = 0;
  for (const jeton of jetons(sql)) {
    if (jeton.t === 'p' && jeton.v === ';') {
      if (corps) { courante.push(jeton); continue; }
      if (courante.length) instructions.push(courante);
      courante = [];
      declencheur = false;
      continue;
    }
    courante.push(jeton);
    if (jeton.t !== 'w') continue;
    if (!declencheur && courante.length <= 4) {
      const mots = courante.filter((x) => x.t === 'w').map((x) => x.v.toUpperCase());
      if (mots[0] === 'CREATE' && mots.slice(1).find((m) => !['TEMP', 'TEMPORARY'].includes(m)) === 'TRIGGER') declencheur = true;
    }
    if (!declencheur) continue;
    const V = jeton.v.toUpperCase();
    if (V === 'BEGIN' && !corps) corps = true;
    else if (corps && V === 'CASE') cases += 1;
    else if (corps && V === 'END') { if (cases > 0) cases -= 1; else corps = false; }
  }
  if (courante.length) instructions.push(courante);
  return instructions;
}

/** Le nom (éventuellement `schema.nom`) qui commence au jeton `i` : { nom, suite }. */
function nomA(liste, i) {
  if (liste[i + 1]?.t === 'p' && liste[i + 1].v === '.' && liste[i + 2]) return { nom: mot(liste[i + 2]), suite: i + 3 };
  return { nom: mot(liste[i]), suite: i + 1 };
}

/** L'instruction en une ligne lisible (chaînes entre apostrophes), tronquée. */
export function extrait(liste, max = 90) {
  const texte = liste.map((j) => (j.t === 'str' ? `'${j.v}'` : j.t === 'id' ? `"${j.v}"` : j.v)).join(' ').replace(/ ([,;).]) ?/g, '$1 ').replace(/\( /g, '(').trim();
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

/** Les chaînes et blobs d'une liste de jetons. */
const litterauxDe = (liste) => liste.filter((j) => j.t === 'str' || j.t === 'blob').map((j) => ({ t: j.t, v: j.v }));

/**
 * Ce que dit une instruction : `genre` 'ddl' (CREATE, ALTER, DROP), 'dml' (INSERT, UPDATE, REPLACE, DELETE, ou WITH : un CTE se lit comme du DML) ou 'autre' ;
 * `verbe`, `objet` (TABLE, INDEX, VIEW, TRIGGER), `nom` (de l'objet, ou de la table visée par le DML), `litteraux` (chaînes et blobs du DML), `renommage`
 * ({ type: 'table', de, vers } ou { type: 'colonne', table, de, vers }).
 */
export function analyserUneInstruction(liste) {
  const verbe = liste[0]?.t === 'w' ? liste[0].v.toUpperCase() : '';
  const base = { verbe, jetons: liste, extrait: extrait(liste), litteraux: [], nom: null, objet: null, renommage: null };
  if (verbe === 'CREATE') {
    let i = 1;
    while (estMot(liste[i], 'TEMP', 'TEMPORARY', 'UNIQUE', 'VIRTUAL')) i += 1;
    const objet = liste[i]?.t === 'w' ? liste[i].v.toUpperCase() : null;
    i += 1;
    if (estMot(liste[i], 'IF')) i += 3; // IF NOT EXISTS
    // CREATE TABLE … AS SELECT : le SELECT remplit la table neuve, ses littéraux sont des données
    const as = objet === 'TABLE' ? liste.findIndex((j, k) => estMot(j, 'AS') && estMot(liste[k + 1], 'SELECT', 'WITH', 'VALUES')) : -1;
    const litteraux = as >= 0 ? litterauxDe(liste.slice(as)) : [];
    return { ...base, genre: 'ddl', objet, nom: nomA(liste, i).nom, litteraux };
  }
  if (verbe === 'DROP') {
    let i = 2;
    if (estMot(liste[i], 'IF')) i += 2; // IF EXISTS
    return { ...base, genre: 'ddl', objet: liste[1]?.t === 'w' ? liste[1].v.toUpperCase() : null, nom: nomA(liste, i).nom };
  }
  if (verbe === 'ALTER') {
    const { nom: table, suite } = nomA(liste, 2);
    let renommage = null;
    if (estMot(liste[suite], 'RENAME')) {
      let i = suite + 1;
      if (estMot(liste[i], 'TO')) renommage = { type: 'table', de: table, vers: mot(liste[i + 1]) };
      else {
        if (estMot(liste[i], 'COLUMN')) i += 1;
        if (estMot(liste[i + 1], 'TO')) renommage = { type: 'colonne', table, de: mot(liste[i]), vers: mot(liste[i + 2]) };
      }
    }
    // ADD COLUMN … DEFAULT '<texte>' remplit toutes les lignes existantes : le défaut est une donnée (celui d'un CREATE TABLE neuf est une définition)
    const litteraux = [];
    if (estMot(liste[suite], 'ADD')) {
      liste.forEach((j, k) => {
        if (!estMot(j, 'DEFAULT')) return;
        if (liste[k + 1]?.t === 'p' && liste[k + 1].v === '(') {
          let profondeur = 0;
          for (let m = k + 1; m < liste.length; m += 1) {
            if (liste[m].t === 'p' && liste[m].v === '(') profondeur += 1;
            else if (liste[m].t === 'p' && liste[m].v === ')') { profondeur -= 1; if (profondeur === 0) break; } else litteraux.push(...litterauxDe([liste[m]]));
          }
        } else litteraux.push(...litterauxDe([liste[k + 1]].filter(Boolean)));
      });
    }
    return { ...base, genre: 'ddl', objet: 'TABLE', nom: table, renommage, litteraux };
  }
  if (['INSERT', 'REPLACE', 'UPDATE', 'DELETE', 'WITH'].includes(verbe)) {
    let nom = null;
    if (verbe === 'UPDATE') { let i = 1; if (estMot(liste[i], 'OR')) i += 2; nom = nomA(liste, i).nom; }
    else if (verbe === 'DELETE') nom = nomA(liste, estMot(liste[1], 'FROM') ? 2 : 1).nom;
    else if (verbe === 'INSERT' || verbe === 'REPLACE') { const i = liste.findIndex((j) => estMot(j, 'INTO')); nom = i >= 0 ? nomA(liste, i + 1).nom : null; }
    return { ...base, genre: 'dml', nom, litteraux: litterauxDe(liste) };
  }
  return { ...base, genre: 'autre' };
}

/** `jeton` cite `nom` : un mot ou un identifiant égal, ou une chaîne qui le contient comme mot entier. */
function cite(jeton, nom) {
  if (jeton.t === 'w' || jeton.t === 'id') return jeton.v.toLowerCase() === nom;
  if (jeton.t === 'str') return new RegExp(`(?<![A-Za-z0-9_])${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'i').test(jeton.v);
  return false;
}
const citeInstruction = (instruction, nom) => instruction.jetons.some((j) => cite(j, nom));

/**
 * Ce qu'une migration est et ce qu'elle renomme : `nature` ('structure' : au moins une instruction DDL ; 'donnees' sinon), ses instructions, et ses
 * renommages RÉELS. Un renommage de table ou de colonne ne compte pas quand la table n'a jamais existé avant la migration (créée plus haut : l'idiome « table
 * `x__0006` recopiée puis renommée ») ni quand son nouveau nom est retiré plus bas (« x » renommée de côté, refaite, l'ancienne supprimée) : aucune trace du
 * journal ne cite un nom qui reste.
 * @returns {{ nature: 'structure' | 'donnees', instructions: object[], ddl: object[], dml: object[], renommages: object[] }}
 */
export function analyserUneMigration(sql) {
  const instructions = decouperLeSql(sql).map(analyserUneInstruction);
  const ddl = instructions.filter((x) => x.genre === 'ddl');
  const dml = instructions.filter((x) => x.genre === 'dml');
  const renommages = [];
  instructions.forEach((x, k) => {
    if (!x.renommage) return;
    const avant = instructions.slice(0, k);
    const apres = instructions.slice(k + 1);
    const creeeAvant = (nom) => avant.some((y) => y.verbe === 'CREATE' && y.objet === 'TABLE' && y.nom === nom);
    const retireeApres = (nom) => apres.some((y) => y.verbe === 'DROP' && y.objet === 'TABLE' && y.nom === nom);
    const r = x.renommage;
    if (r.type === 'table' && (creeeAvant(r.de) || retireeApres(r.vers))) return;
    if (r.type === 'colonne' && (creeeAvant(r.table) || retireeApres(r.table))) return;
    renommages.push(r);
  });
  return { nature: ddl.length ? 'structure' : 'donnees', instructions, ddl, dml, renommages };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Les règles, une par une
// ---------------------------------------------------------------------------------------------------------------------------------------------
const numeroDe = (fichier) => Number(FICHIER_DE_MIGRATION.exec(fichier)?.[1] ?? 0);

/**
 * Règles « figee » et « numero ». `base` et `arbre` : { fichier → texte } de data/migrations/ à la version de la base (merge-base) et dans l'arbre.
 * @returns {{ violations: object[], nouvelles: string[] }} `nouvelles` : les fichiers (.sql et .json) présents dans l'arbre et absents de la base
 */
export function reglesDesFichiers(base, arbre) {
  const violations = [];
  const memeTexte = (a, b) => String(a).replace(/\r\n/g, '\n') === String(b).replace(/\r\n/g, '\n');
  for (const fichier of [...base.keys()].sort()) {
    if (!arbre.has(fichier)) {
      violations.push(refus(fichier, 'figee', `${fichier} : migration déjà fusionnée, retirée ou renommée. Une migration fusionnée ne se supprime pas et ne se renomme pas, et une migration ne s’annule pas : écrire une migration NOUVELLE qui défait ou corrige la précédente.`));
    } else if (!memeTexte(base.get(fichier), arbre.get(fichier))) {
      violations.push(refus(fichier, 'figee', `${fichier} : migration déjà fusionnée, modifiée. Une migration fusionnée ne se modifie plus (les bases qui l’ont reçue en gardent l’empreinte) : écrire une migration NOUVELLE.`));
    }
  }
  const nouvelles = [...arbre.keys()].filter((f) => !base.has(f)).sort();
  const derniere = Math.max(0, ...[...base.keys()].filter((f) => f.endsWith('.sql')).map(numeroDe));
  const parNumero = new Map();
  for (const fichier of nouvelles.filter((f) => f.endsWith('.sql'))) {
    parNumero.set(numeroDe(fichier), [...(parNumero.get(numeroDe(fichier)) ?? []), fichier]);
    if (numeroDe(fichier) <= derniere) {
      violations.push(refus(fichier, 'numero', `${fichier} : numéro ${String(numeroDe(fichier)).padStart(4, '0')} déjà pris à la base (la dernière migration fusionnée est la ${String(derniere).padStart(4, '0')}) : la renuméroter après la dernière.`));
    }
  }
  for (const [numero, fichiers] of parNumero) {
    if (fichiers.length > 1) for (const fichier of fichiers) violations.push(refus(fichier, 'numero', `${fichier} : ${fichiers.length} migrations portent le numéro ${String(numero).padStart(4, '0')} (${fichiers.join(', ')}) : un seul fichier par numéro.`));
  }
  return { violations, nouvelles };
}

/** Règles « interdit » et « structure » d'une migration nouvelle (le texte du fichier). Rend { violations, analyse }. */
export function reglesDUneMigration(fichier, sql) {
  const violations = [];
  const analyse = analyserUneMigration(sql);
  const interdit = migrationInterdite(sql);
  if (interdit) violations.push(refus(fichier, 'interdit', `${fichier} : porte ${interdit}. Une migration ne gère ni ses transactions ni ses PRAGMA (le service ouvre la transaction, contrôle les clés étrangères et pose la version).`));

  if (numeroDe(fichier) >= PREMIERE_MIGRATION_CONTROLEE && analyse.nature === 'structure') {
    const noms = analyse.renommages.flatMap((r) => [r.de, r.vers]).filter(Boolean);
    const fautifs = [];
    for (const x of analyse.instructions.filter((i) => i.litteraux.length)) {
      for (const l of x.litteraux) {
        if (l.t === 'str' && (litteralAdmis(l.v) || (LITTERAL_DE_NOM.test(l.v) && noms.some((nom) => cite({ t: 'str', v: l.v }, nom))))) continue;
        const apercu = l.t === 'blob' ? `x'${l.v.slice(0, 20)}'` : `'${l.v.length > 50 ? `${l.v.slice(0, 49)}…` : l.v}'`;
        fautifs.push(`${apercu} (${x.verbe} ${x.nom ?? ''})`);
      }
    }
    if (fautifs.length) {
      const suivante = String(numeroDe(fichier) + 1).padStart(4, '0');
      violations.push(refus(fichier, 'structure', `${fichier} : migration de structure (elle porte du DDL) dont le DML écrit ${fautifs.slice(0, 3).join(', ')}${fautifs.length > 3 ? ` et ${fautifs.length - 3} autre(s)` : ''}. Une migration de structure ne porte aucun texte de règle : son DML ne déplace ou ne recopie que des colonnes (INSERT … SELECT, UPDATE … SET colonne = expression de colonnes ; seuls des codes, ${LITTERAL_DE_CODE}, des identifiants à « / », des chemins JSON « $.x », des formats de date, des nombres et NULL sont admis en littéral ; un DEFAULT ajouté par ALTER TABLE et un CREATE TABLE … AS SELECT remplissent des lignes : ils suivent la même règle). La scinder en deux : la structure dans ${String(numeroDe(fichier)).padStart(4, '0')}, les données dans la ${suivante}.`));
    }
  }

  for (const r of analyse.renommages) {
    const cible = r.type === 'table' ? `la table « ${r.de} » en « ${r.vers} »` : `la colonne « ${r.de} » de « ${r.table} » en « ${r.vers} »`;
    const manquantes = TABLES_QUI_GARDENT_DES_NOMS.filter((table) => !analyse.dml.some((x) => x.verbe === 'UPDATE' && x.nom === table && citeInstruction(x, r.de) && citeInstruction(x, r.vers)));
    if (manquantes.length) {
      violations.push(refus(fichier, 'renommage', `${fichier} : renomme ${cible} sans réécrire ${manquantes.map((t) => `\`${t}\``).join(', ')} : le journal, l’historique, les lots déposés et le plafond des numéros gardent ces noms. Ajouter à la même migration un UPDATE de chacune de ces tables qui cite « ${r.de} » et « ${r.vers} ».`));
    }
  }
  return { violations, analyse };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Git : la version de la base, ses fichiers, l'arbre
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Une erreur d'usage ou de dépôt (pas une règle violée) : la ligne de commande sort en code 2. */
export class ErreurDeControle extends Error {}

const git = (racine, ...args) => {
  try {
    return execFileSync('git', ['-C', racine, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (e) {
    throw new ErreurDeControle(`git ${args.join(' ')} : ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
  }
};

/** Le merge-base de `base` et de HEAD : la version de la base dont part la PR. */
export function versionDeLaBase(racine, base) {
  return git(racine, 'merge-base', base, 'HEAD');
}

/**
 * Extrait de `commit` (git archive) les chemins demandés qui y existent, dans `dossier` (data/… y est recréé). Rend la liste des chemins extraits.
 * @param {{ racine: string, commit: string, dossier: string, chemins: string[] }} o
 */
export function extraireDuCommit({ racine, commit, dossier, chemins }) {
  const presents = git(racine, 'ls-tree', '--name-only', commit, '--', ...chemins).split('\n').filter(Boolean);
  mkdirSync(dossier, { recursive: true });
  if (!presents.length) return [];
  const archive = spawnSync('git', ['-C', racine, 'archive', '--format=tar', commit, '--', ...presents], { maxBuffer: 1024 * 1024 * 1024 });
  if (archive.status !== 0) throw new ErreurDeControle(`git archive ${commit} : ${String(archive.stderr).trim().split('\n')[0]}`);
  const tar = spawnSync('tar', ['-x', '-C', dossier], { input: archive.stdout, maxBuffer: 1024 * 1024 });
  if (tar.status !== 0) throw new ErreurDeControle(`tar : ${String(tar.stderr).trim().split('\n')[0]}`);
  return presents;
}

/** Les fichiers (.sql et .json) d'un dossier de migrations : Map { fichier → texte }. Un dossier absent est vide. */
export function lireUnDossierDeMigrations(dossier) {
  const fichiers = new Map();
  if (!existsSync(dossier)) return fichiers;
  for (const nom of readdirSync(dossier).sort()) if (FICHIER_DE_MIGRATION.test(nom)) fichiers.set(nom, readFileSync(join(dossier, nom), 'utf8'));
  return fichiers;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Le résumé : Markdown, pour $GITHUB_STEP_SUMMARY et la sortie
// ---------------------------------------------------------------------------------------------------------------------------------------------
const NATURES = { structure: 'migration de structure', donnees: 'migration de données' };
export const AVERTISSEMENT_DONNEES = 'migration de données : cesse à la bascule du lot 8';
const code = (t) => `\`${t}\``;

/** Le tableau d'un bilan (serveur/structure-sur-place.mjs#bilanDesTables) en Markdown : lignes par table, objets, tables à l'empreinte inchangée repliées. */
export function rendreUnBilan(bilan) {
  const lignes = [];
  const { tables, objets } = bilan;
  for (const t of tables.creees) lignes.push(`| ${code(t.table)} | ${t.lignes} | 0 | 0 | table créée |`);
  for (const t of tables.retirees) lignes.push(`| ${code(t.table)} | 0 | ${t.lignes} | 0 | table retirée |`);
  for (const r of tables.renommees) lignes.push(`| ${code(r.de)} | 0 | 0 | 0 | table renommée en ${code(r.vers)} |`);
  for (const [table, e] of Object.entries(tables.modifiees)) {
    const notes = [];
    if (e.colonnes_ajoutees?.length) notes.push(`colonnes ajoutées : ${e.colonnes_ajoutees.join(', ')}`);
    if (e.colonnes_retirees?.length) notes.push(`colonnes retirées : ${e.colonnes_retirees.join(', ')}`);
    if (!notes.length && e.structure_changee) notes.push('structure changée');
    lignes.push(`| ${code(table)} | ${e.ajoutees} | ${e.retirees} | ${e.modifiees} | ${notes.join(' ; ')} |`);
  }
  const sortie = [];
  if (lignes.length) sortie.push('| Table | Lignes ajoutées | Lignes retirées | Lignes modifiées | Remarque |', '| --- | ---: | ---: | ---: | --- |', ...lignes);
  else sortie.push('Aucune table ne change.');
  const autres = [...objets.crees.map((o) => `créé : ${o}`), ...objets.modifies.map((o) => `modifié : ${o}`), ...objets.retires.map((o) => `retiré : ${o}`)];
  if (autres.length) sortie.push('', `Index, vues et déclencheurs : ${autres.map(code).join(', ')}.`);
  const n = tables.inchangees.length;
  sortie.push('', `<details><summary>${n} table${n > 1 ? 's' : ''} à l’empreinte inchangée</summary>`, '', n ? tables.inchangees.map(code).join(', ') : 'aucune', '', '</details>');
  return sortie.join('\n');
}

/**
 * Le résumé d'un contrôle.
 * @param {{ base: string, mergeBase: string | null, version: number | null, nouvelles: object[], violations: object[], avertissements: string[],
 *   essai: object | null, duree_ms?: number }} r
 */
export function rendreLeResume(r) {
  const sortie = ['## Contrôle des migrations', ''];
  const court = (r.mergeBase ?? '').slice(0, 10);
  sortie.push(`Base de comparaison : ${code(r.base)}${r.mergeBase ? ` (merge-base ${code(court)}${r.version === null || r.version === undefined ? '' : `, version ${r.version}`})` : ''}.`);
  sortie.push(r.nouvelles.length ? `${r.nouvelles.length} migration${r.nouvelles.length > 1 ? 's' : ''} nouvelle${r.nouvelles.length > 1 ? 's' : ''} : ${r.nouvelles.map((m) => code(m.fichier)).join(', ')}.` : 'Aucune migration nouvelle.');
  if (r.violations.length) {
    sortie.push('', '### Refus', '', ...r.violations.map((v) => `- ${code(v.fichier)} — règle ${code(v.regle)} : ${v.message}`));
  }
  if (r.avertissements.length) sortie.push('', '### Signalé', '', ...r.avertissements.map((a) => `- ${a}`));
  if (r.essai) {
    const e = r.essai;
    sortie.push('', '### Passage sur une base remplie', '');
    if (e.verdict === 'accepte') {
      sortie.push(`Accepté en ${e.duree_ms} ms : le schéma obtenu est celui de ${code('data/schema.sql')}, aucune clé étrangère rompue, rien de perdu dans les fiches, le journal, l’historique ni les lots déposés.`);
    } else if (e.verdict === 'refuse') {
      sortie.push(`Refusé (${e.refus.etape})${e.refus.fichier ? ` — ${code(e.refus.fichier)}` : ''} : ${e.refus.raison}`, ...e.refus.details.slice(0, 20).map((d) => `- ${d}`));
    } else if (e.verdict === 'perte') {
      sortie.push('Refusé (perte) : ce que les fiches, le journal ou l’historique avaient avant n’y est plus :', ...e.pertes.map((d) => `- ${d}`));
    } else sortie.push(`${e.verdict}.`);
    for (const etape of e.etapes ?? []) {
      sortie.push('', `### ${code(etape.fichier)} — ${NATURES[etape.nature] ?? etape.nature} (version ${etape.avant} → ${etape.apres})`, '', rendreUnBilan(etape.bilan));
    }
  } else if (r.nouvelles.length) {
    sortie.push('', '### Passage sur une base remplie', '', 'Non fait.');
    for (const m of r.nouvelles) sortie.push('', `- ${code(m.fichier)} — ${NATURES[m.nature] ?? m.nature}`);
  }
  return `${sortie.join('\n')}\n`;
}
