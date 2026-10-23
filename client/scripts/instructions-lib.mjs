// Contrôles des instructions de Claude (agents `.claude/agents/*.md`, skills `.claude/skills/*/SKILL.md`, `CLAUDE.md`, `docs/equipe.md`).
// Logique pure : chaque fonction prend des textes et des listes et rend la liste de ses constats (chaînes, vide si tout va bien). Le dépôt est
// lu par test/instructions-claude.test.mjs, qui la rejoue aussi sur des textes fabriqués. Format et budget : skill tenir-un-skill.
import YAML from 'yaml';
import { globVersRegex } from './tests-cibles-lib.mjs';

export const MODELES = ['opus', 'sonnet', 'haiku', 'fable', 'inherit'];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const OUTILS = ['Agent', 'SendMessage', 'Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Skill', 'ToolSearch'];
/** Les préfixes des skills de zone : un nom ainsi préfixé, cité entre accents graves, doit être un skill existant. */
export const PREFIXES_DE_ZONE = ['zone-', 'ui-', 'site-', 'base-', 'sources-'];

export const DESCRIPTION_MAX = 400;
/** Budget d'un SKILL.md, en octets : au-delà de `surveiller`, avertissement ; au-delà de `max`, échec. */
export const BUDGET = { surveiller: 12_000, max: 20_000 };
export const CLAUDE_MD_MAX_LIGNES = 150;

/** Le motif qui fait échouer un skill : un « (lot N) » de récit. */
export const RE_LOT_ENTRE_PARENTHESES = /\(lot [0-9]+\)/g;
/** Motifs signalés en avertissement seulement : un « lot N » nu, une date AAAA-MM-JJ sur une ligne qui ne cite aucune décision R…. */
export const RE_LOT = /\blot [0-9]+\b/g;
export const RE_DATE = /\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b/g;
const RE_DECISION = /\bR[0-9]+\b/;

// ------------------------------------------------------------------------------------------------------------------------- frontmatter

/**
 * Le frontmatter d'un fichier d'instructions, lu par le parseur YAML strict : { donnees, erreurs }. Erreurs : pas de bloc `---`, YAML invalide
 * (par exemple une `description` non entre guillemets qui contient « : » suivi d'un espace), ou un bloc qui n'est pas une table.
 */
export function lireFrontmatter(texte) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(texte);
  if (!m) return { donnees: null, erreurs: ['pas de frontmatter (bloc --- en tête)'] };
  const doc = YAML.parseDocument(m[1], { strict: true, uniqueKeys: true, prettyErrors: false });
  const erreurs = [...doc.errors, ...doc.warnings].map((e) => `YAML invalide : ${e.message.split('\n')[0]}`);
  if (erreurs.length) return { donnees: null, erreurs };
  const donnees = doc.toJS();
  if (!donnees || typeof donnees !== 'object' || Array.isArray(donnees)) return { donnees: null, erreurs: ['le frontmatter n\'est pas une table clé: valeur'] };
  return { donnees, erreurs: [] };
}

/** Une liste du frontmatter : tableau YAML, ou chaîne séparée par des virgules (hors accolades d'un glob `{a,b}`). */
export function liste(valeur) {
  if (valeur == null) return [];
  if (Array.isArray(valeur)) return valeur.map((v) => String(v).trim()).filter(Boolean);
  const morceaux = [];
  let courant = '';
  let profondeur = 0;
  for (const c of String(valeur)) {
    if (c === '{') profondeur += 1;
    else if (c === '}') profondeur = Math.max(0, profondeur - 1);
    if (c === ',' && profondeur === 0) { morceaux.push(courant); courant = ''; } else courant += c;
  }
  morceaux.push(courant);
  return morceaux.map((s) => s.trim()).filter(Boolean);
}

// ------------------------------------------------------------------------------------------------------------------------------ agents

/** Les constats sur un agent `fichier` (`x.md`), avec la liste des dossiers de skills existants. */
export function controlerAgent({ fichier, texte, skills }) {
  const { donnees: f, erreurs } = lireFrontmatter(texte);
  if (!f) return erreurs;
  const constats = [];
  const attendu = fichier.replace(/\.md$/, '');
  if (f.name !== attendu) constats.push(`name « ${f.name} » au lieu de « ${attendu} » (nom du fichier)`);
  if (!MODELES.includes(f.model)) constats.push(`model « ${f.model} » hors de ${MODELES.join(', ')}`);
  if (!EFFORTS.includes(f.effort)) constats.push(`effort « ${f.effort} » hors de ${EFFORTS.join(', ')}`);
  for (const outil of liste(f.tools)) {
    if (!OUTILS.includes(outil) && !outil.startsWith('mcp__')) constats.push(`outil inconnu « ${outil} »`);
  }
  if (f.skills != null && !Array.isArray(f.skills)) constats.push('skills: doit être une liste');
  for (const s of liste(f.skills)) if (!skills.includes(s)) constats.push(`skill préchargé absent « ${s} »`);
  return constats;
}

// ------------------------------------------------------------------------------------------------------------------------------ skills

/** Les constats sur le SKILL.md du dossier `dossier`, avec la liste des fichiers du dépôt (chemins depuis la racine, en `/`). */
export function controlerSkill({ dossier, texte, fichiers }) {
  const { donnees: f, erreurs } = lireFrontmatter(texte);
  if (!f) return erreurs;
  const constats = [];
  if (f.name !== dossier) constats.push(`name « ${f.name} » au lieu de « ${dossier} » (nom du dossier)`);
  if (typeof f.description !== 'string' || !f.description.trim()) constats.push('description absente');
  else if (f.description.length > DESCRIPTION_MAX) constats.push(`description de ${f.description.length} caractères (max ${DESCRIPTION_MAX})`);
  for (const glob of liste(f.paths)) {
    const re = globVersRegex(glob);
    if (!fichiers.some((c) => re.test(c))) constats.push(`paths « ${glob} » ne correspond à aucun fichier suivi`);
  }
  return constats;
}

/** Le budget d'un SKILL.md de `octets` octets : 'ok', 'surveiller' (12 000 à 20 000 octets) ou 'trop' (au-delà de 20 000). */
export function budget(octets) {
  if (octets > BUDGET.max) return 'trop';
  if (octets >= BUDGET.surveiller) return 'surveiller';
  return 'ok';
}

/** Le récit daté d'un texte, ligne par ligne : { echecs: ["L12 : (lot 3)"], avertissements: [...] } (motifs ci-dessus). */
export function recitDate(texte) {
  const echecs = [];
  const avertissements = [];
  texte.split('\n').forEach((ligne, i) => {
    const n = `L${i + 1}`;
    for (const m of ligne.matchAll(RE_LOT_ENTRE_PARENTHESES)) echecs.push(`${n} : ${m[0]}`);
    const nus = ligne.replace(RE_LOT_ENTRE_PARENTHESES, ' ');
    for (const m of nus.matchAll(RE_LOT)) avertissements.push(`${n} : ${m[0]}`);
    if (!RE_DECISION.test(ligne)) for (const m of ligne.matchAll(RE_DATE)) avertissements.push(`${n} : date ${m[0]}`);
  });
  return { echecs, avertissements };
}

// ---------------------------------------------------------------------------------------------------------------------------- renvois

/** Les noms entre accents graves d'un texte (`[a-z0-9-]+`, ni tiret initial ni final), dans l'ordre, sans doublon. */
export function nomsCites(texte) {
  return [...new Set([...texte.matchAll(/`([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)`/g)].map((m) => m[1]))];
}

/**
 * Les skills de zone cités dans `texte` (préfixe de PREFIXES_DE_ZONE) qui n'existent pas dans `skills`. `autres` : les noms qui désignent
 * autre chose qu'un skill sous ce préfixe — les tests de client/test/ cités par leur nom court (`site-html` pour site-html.test.mjs).
 */
export function renvoisAbsents(texte, skills, autres = []) {
  return nomsCites(texte).filter((n) => PREFIXES_DE_ZONE.some((p) => n.startsWith(p) && n.length > p.length) && !skills.includes(n) && !autres.includes(n));
}

/** Les `noms` (agents, skills) que `texte` ne cite pas entre accents graves. */
export function nonCites(texte, noms) {
  const cites = new Set(nomsCites(texte));
  return noms.filter((n) => !cites.has(n));
}

/** Les constats sur CLAUDE.md : au plus CLAUDE_MD_MAX_LIGNES lignes (le saut de ligne final ne compte pas). */
export function controlerClaudeMd(texte) {
  const lignes = texte.replace(/\n$/, '').split('\n').length;
  return lignes > CLAUDE_MD_MAX_LIGNES ? [`${lignes} lignes (max ${CLAUDE_MD_MAX_LIGNES})`] : [];
}
