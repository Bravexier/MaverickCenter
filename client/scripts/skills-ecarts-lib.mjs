// Écarts de skills (scripts/skills-ecarts.mjs) : ce qu'un skill disait avant un découpage ou un resserrement, et qui ne se retrouve plus nulle
// part. Logique pure, testée par test/skills-ecarts.test.mjs.

/** Les types d'éléments relevés, dans l'ordre de la sortie. */
export const TYPES = ['decision', 'test', 'fichier', 'identifiant', 'ligne-de-code'];
export const LIBELLES = { decision: 'décisions', test: 'tests', fichier: 'fichiers', identifiant: 'identifiants', 'ligne-de-code': 'lignes de blocs de code' };

const EXTENSIONS = 'mjs|cjs|js|ts|mts|md|sql|json|py|yml|yaml|astro|css|sh|txt|html|csv|xlsx|svg|png';
const RE_DECISION = /\bR[0-9]+\b/g;
const RE_FICHIER = new RegExp(String.raw`(?<![\w./*?-])((?:[\w.*?-]+/)+[\w.*?-]*|[\w*?-]+(?:\.[\w-]+)*\.(?:${EXTENSIONS}))(?![\w/-])`, 'g');
const RE_EST_FICHIER = new RegExp(String.raw`\.(?:${EXTENSIONS})\b|/\*|/$`);

/** Le type d'un élément entre accents graves ou relevé dans le texte. */
export function typeDe(element) {
  if (/^R[0-9]+$/.test(element)) return 'decision';
  if (/\.test\.mjs\b/.test(element)) return 'test';
  if (RE_EST_FICHIER.test(element)) return 'fichier';
  return 'identifiant';
}

/**
 * Les éléments d'un skill : Map(élément → type). Relevés :
 * - entre accents graves (hors blocs ```), tels quels ; typés fichier ou test s'ils en ont la forme, sinon identifiant ;
 * - dans un bloc ``` : chaque ligne non vide (`ligne-de-code`) ;
 * - partout (frontmatter compris) : les décisions `\bR[0-9]+\b`, les chemins et noms de fichiers (avec une extension connue, ou un glob).
 */
export function extraireElements(texte) {
  const elements = new Map();
  const ajouter = (e, type = typeDe(e)) => { if (e && !elements.has(e)) elements.set(e, type); };
  let horsBlocs = '';
  let dansBloc = false;
  for (const ligne of texte.split('\n')) {
    if (/^\s*```/.test(ligne)) { dansBloc = !dansBloc; continue; }
    if (dansBloc) { if (ligne.trim()) ajouter(ligne.trim(), 'ligne-de-code'); continue; }
    horsBlocs += `${ligne}\n`;
  }
  for (const m of horsBlocs.matchAll(/`([^`\n]+)`/g)) ajouter(m[1].trim());
  const sansCode = horsBlocs.replace(/`[^`\n]+`/g, ' ');
  for (const m of texte.matchAll(RE_DECISION)) ajouter(m[0], 'decision');
  for (const m of sansCode.matchAll(RE_FICHIER)) {
    const e = m[1].replace(/\.+$/, '');
    if (RE_EST_FICHIER.test(e)) ajouter(e);
  }
  return elements;
}

/** Vrai si `element` se retrouve dans `corpus` (une décision : le numéro entier, R4 ne vaut pas R41). */
export function trouve(element, type, corpus) {
  if (type === 'decision') return new RegExp(`\\b${element}\\b`).test(corpus);
  return corpus.includes(element);
}

/**
 * Les exceptions de --ignorer : une par ligne, `élément  # raison` ou, pour un élément qui commence par `#` (une couleur), entre accents graves
 * (raison obligatoire dans les deux cas) ; lignes vides et lignes qui commencent par `#` hors accents graves : des commentaires.
 * Rend Map(élément → raison) ; lève une erreur pour une ligne sans raison.
 */
export function lireIgnorer(texte, nom = '--ignorer') {
  const ignores = new Map();
  texte.split('\n').forEach((ligne, i) => {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) return;
    // Un élément entre accents graves peut commencer par `#` (une couleur) : les accents graves sont retirés.
    const m = /^`([^`]+)`\s+#\s+(.*\S)\s*$/.exec(l) ?? (l.startsWith('`') ? null : /^(.*?)\s+#\s+(.*\S)\s*$/.exec(l));
    if (!m || !m[1].trim()) throw new Error(`${nom}, ligne ${i + 1} : « élément  # raison » ou « \`élément\`  # raison » attendu, la raison est obligatoire (${l})`);
    ignores.set(m[1].trim(), m[2].trim());
  });
  return ignores;
}

/**
 * Les écarts : `avant` = [{ skill, texte }] (les skills à la réf d'avant), `corpus` = le texte où chercher (skills actuels, docs). Rend
 * { releves, manquants: [{ element, type, skills }], ignores: [{ element, raison }], inutiles: [éléments de --ignorer jamais manquants] }.
 */
export function ecarts({ avant, corpus, ignores = new Map() }) {
  const parElement = new Map();
  for (const { skill, texte } of avant) {
    for (const [element, type] of extraireElements(texte)) {
      if (!parElement.has(element)) parElement.set(element, { element, type, skills: [] });
      parElement.get(element).skills.push(skill);
    }
  }
  const manquants = [];
  const ignoresUtilises = [];
  for (const e of parElement.values()) {
    if (trouve(e.element, e.type, corpus)) continue;
    if (ignores.has(e.element)) { ignoresUtilises.push({ element: e.element, raison: ignores.get(e.element) }); continue; }
    manquants.push(e);
  }
  manquants.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || a.element.localeCompare(b.element));
  const utilises = new Set(ignoresUtilises.map((x) => x.element));
  return { releves: parElement.size, manquants, ignores: ignoresUtilises, inutiles: [...ignores.keys()].filter((e) => !utilises.has(e)) };
}
