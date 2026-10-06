// Moteur du générateur de fiche : fonctions pures pilotées par src/data/rules.json.
// Aucune règle de Maverick n'est codée ici : tout vient des données (voir docs/character-generator.md).

/**
 * @typedef {{ id: string, label: string }} Attribute
 * @typedef {{ id: string, name: string, wiki?: string, modifiers?: Record<string, number>, traits?: string[], allowedRaces?: string[], allowedClasses?: string[] }} Choice
 * @typedef {{ id: string, label: string, base?: number, add?: Record<string, number> }} Derived
 * @typedef {{
 *   meta: { status: string, version: string, note?: string },
 *   attributes: Attribute[],
 *   creation: { base: number, pool: number, max: number },
 *   limits: { classes: number, magies: number },
 *   races: Choice[], classes: Choice[], magies: Choice[], derived?: Derived[]
 * }} Rules
 * @typedef {{ name: string, race: string, classes: string[], magies: string[], spent: Record<string, number>, notes: string }} Character
 */

export const FORMAT = 'maverick-character';
export const FORMAT_VERSION = 1;

const find = (list, id) => list.find((item) => item.id === id);
const sum = (values) => values.reduce((total, value) => total + value, 0);

/** @returns {Character} */
export function newCharacter(rules) {
  return {
    name: '',
    race: '',
    classes: [],
    magies: [],
    spent: Object.fromEntries(rules.attributes.map((a) => [a.id, 0])),
    notes: '',
  };
}

export const pointsSpent = (ch) => sum(Object.values(ch.spent));
export const pointsLeft = (rules, ch) => rules.creation.pool - pointsSpent(ch);

export const isClassAllowed = (ch, cls) => !cls.allowedRaces || cls.allowedRaces.includes(ch.race);
export const isMagicAllowed = (ch, magic) => !magic.allowedClasses || magic.allowedClasses.some((id) => ch.classes.includes(id));

/** Bonus cumulés de la race et des classes, par caractéristique. */
export function bonuses(rules, ch) {
  const out = Object.fromEntries(rules.attributes.map((a) => [a.id, 0]));
  const sources = [find(rules.races, ch.race), ...ch.classes.map((id) => find(rules.classes, id))].filter(Boolean);
  for (const source of sources) {
    for (const [attr, value] of Object.entries(source.modifiers ?? {})) {
      if (attr in out) out[attr] += value;
    }
  }
  return out;
}

export function finalAttributes(rules, ch) {
  const bonus = bonuses(rules, ch);
  return Object.fromEntries(
    rules.attributes.map((a) => [a.id, rules.creation.base + (ch.spent[a.id] ?? 0) + bonus[a.id]]),
  );
}

/** Valeurs dérivées : base + somme(caractéristique × coefficient). Pas d'évaluation de formule libre. */
export function derivedStats(rules, ch) {
  const attrs = finalAttributes(rules, ch);
  return (rules.derived ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    value: (d.base ?? 0) + sum(Object.entries(d.add ?? {}).map(([attr, coef]) => (attrs[attr] ?? 0) * coef)),
  }));
}

/**
 * Reconstruit un personnage cohérent à partir d'une entrée non fiable (import, localStorage) :
 * ids inconnus retirés, choix incompatibles retirés en cascade (race → classes → magies), limites respectées.
 * @returns {Character}
 */
export function sanitize(rules, raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const ch = newCharacter(rules);
  ch.name = typeof input.name === 'string' ? input.name.slice(0, 100) : '';
  ch.notes = typeof input.notes === 'string' ? input.notes.slice(0, 5000) : '';
  ch.race = find(rules.races, input.race) ? input.race : '';

  const maxSpent = rules.creation.max - rules.creation.base;
  for (const attr of rules.attributes) {
    const value = Number(input.spent?.[attr.id]);
    ch.spent[attr.id] = Number.isInteger(value) ? Math.min(Math.max(value, 0), Math.max(maxSpent, 0)) : 0;
  }

  const unique = (ids) => [...new Set(Array.isArray(ids) ? ids : [])];
  ch.classes = unique(input.classes)
    .filter((id) => {
      const cls = find(rules.classes, id);
      return cls && isClassAllowed(ch, cls);
    })
    .slice(0, rules.limits.classes);
  ch.magies = unique(input.magies)
    .filter((id) => {
      const magic = find(rules.magies, id);
      return magic && isMagicAllowed(ch, magic);
    })
    .slice(0, rules.limits.magies);
  return ch;
}

export function setRace(rules, ch, id) {
  return sanitize(rules, { ...ch, race: id });
}

/** Coche/décoche une classe ou une magie. Limite à 1 : le nouveau choix remplace l'ancien. */
export function toggleChoice(rules, ch, kind, id) {
  const current = ch[kind];
  const limit = rules.limits[kind];
  if (current.includes(id)) return sanitize(rules, { ...ch, [kind]: current.filter((x) => x !== id) });

  // Ajout : refusé sans toucher à la sélection existante si le choix est inconnu ou interdit.
  const item = find(rules[kind], id);
  const allowed = kind === 'classes' ? isClassAllowed : isMagicAllowed;
  if (!item || !allowed(ch, item)) return ch;

  if (limit === 1) return sanitize(rules, { ...ch, [kind]: [id] });
  if (current.length < limit) return sanitize(rules, { ...ch, [kind]: [...current, id] });
  return ch;
}

/** Ajoute/retire des points à une caractéristique, sans dépasser la réserve ni le maximum. */
export function changeAttribute(rules, ch, attrId, delta) {
  if (!(attrId in ch.spent)) return ch;
  const spent = ch.spent[attrId] + delta;
  const maxSpent = rules.creation.max - rules.creation.base;
  if (spent < 0 || spent > maxSpent || pointsLeft(rules, ch) - delta < 0) return ch;
  return { ...ch, spent: { ...ch.spent, [attrId]: spent } };
}

/** @returns {{ errors: string[], warnings: string[] }} */
export function validate(rules, ch) {
  const errors = [];
  const warnings = [];
  const left = pointsLeft(rules, ch);
  if (left < 0) errors.push(`${-left} point(s) dépensé(s) en trop.`);
  if (!ch.name.trim()) warnings.push('Le personnage n’a pas de nom.');
  if (!ch.race) warnings.push('Aucune race choisie.');
  if (rules.limits.classes > 0 && ch.classes.length === 0) warnings.push('Aucune classe choisie.');
  if (left > 0) warnings.push(`${left} point(s) de caractéristique non dépensé(s).`);
  return { errors, warnings };
}

export function serialize(rules, ch) {
  return JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, rules: rules.meta.version, character: ch }, null, 2);
}

/** @throws {Error} si le texte n'est pas une fiche exportée par ce générateur */
export function parseExport(rules, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier JSON invalide.');
  }
  if (data?.format !== FORMAT || typeof data.character !== 'object') {
    throw new Error('Ce fichier n’est pas une fiche Maverick.');
  }
  return sanitize(rules, data.character);
}
