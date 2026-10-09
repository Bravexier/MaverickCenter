// Liens entre races et magies, et entre magies. Fonctions pures sur les pages du wiki.
//
// Données lues dans le frontmatter (posé par l'import, vérifié contre le classeur) :
//   page de race   : magies_innees: ["Sang", "Eau", …]   magies que la race peut avoir en magie innée (onglet « Accessibilité Magie »)
//   page de magie  : nom_court: "Sang"                   nom de la magie dans les listes
//                    resiste_a / vulnerable_a / incompatible_avec: [noms courts]   (bloc « Données » de la page de la magie)
// Un champ absent veut dire « la source ne donne pas de liste » (null) ; une liste vide, « Aucune » dans la source.
// Les noms sont comparés sans casse ni accents.
import { normalize } from './text.mjs';

const isMagie = (e) => e.id.startsWith('magies/') && typeof e.data.nom_court === 'string' && e.data.nom_court.trim() !== '';
const isRace = (e) => e.id.startsWith('races/');
const byTitle = (a, b) => a.data.title.localeCompare(b.data.title, 'fr');
const byNom = (a, b) => a.data.nom_court.localeCompare(b.data.nom_court, 'fr');

/** Nom court normalisé -> page de la magie. */
export function magieIndex(entries) {
  const index = new Map();
  for (const entry of entries) if (isMagie(entry)) index.set(normalize(entry.data.nom_court), entry);
  return index;
}

/** Résout une liste de noms ; garde l'ordre de la source et un nom cité deux fois n'est gardé qu'une fois. */
function resolveNames(names, index) {
  const found = [];
  const missing = [];
  for (const name of names) {
    const hit = index.get(normalize(name));
    if (!hit) missing.push(name);
    else if (!found.includes(hit)) found.push(hit);
  }
  return { found, missing };
}

/**
 * Magies innées d'une race. null si la page n'a pas le champ (pas de donnée).
 * @returns {{ magies: object[], missing: string[], total: number, toutes: boolean } | null}
 */
export function magiesOfRace(entries, race) {
  const names = race.data.magies_innees;
  if (!Array.isArray(names)) return null;
  const index = magieIndex(entries);
  const { found, missing } = resolveNames(names, index);
  return { magies: found, missing, total: index.size, toutes: index.size > 0 && found.length === index.size };
}

/** Races qui peuvent / ne peuvent pas avoir la magie en magie innée ; une race sans donnée n'est dans aucune des deux listes. */
export function racesOfMagie(entries, magie) {
  const key = normalize(magie.data.nom_court ?? '');
  const avec = [];
  const sans = [];
  for (const race of entries.filter(isRace)) {
    const names = race.data.magies_innees;
    if (!Array.isArray(names)) continue;
    (names.some((n) => normalize(n) === key) ? avec : sans).push(race);
  }
  return { avec: avec.sort(byTitle), sans: sans.sort(byTitle) };
}

/**
 * Relations d'une magie avec les autres.
 *  fortContre  = « Résistance magique » de sa page ; faibleContre = « Vulnérabilité magique » ;
 *  incompatible = « Magie non compatible » de sa page, plus les magies dont la page la cite (la relation est symétrique
 *  dans les sources : source « deduite » quand seule l'autre page la déclare).
 * null pour fortContre/faibleContre quand la page n'a pas de liste ; incompatible est null seulement si aucune page ne donne de liste.
 */
export function relationsOfMagie(entries, magie) {
  const index = magieIndex(entries);
  const manquants = [];
  const resolve = (names) => {
    if (!Array.isArray(names)) return null;
    const { found, missing } = resolveNames(names, index);
    manquants.push(...missing.filter((m) => !manquants.includes(m)));
    return found.map((entry) => ({ entry, self: entry.id === magie.id }));
  };

  const fortContre = resolve(magie.data.resiste_a);
  const faibleContre = resolve(magie.data.vulnerable_a);

  const direct = resolve(magie.data.incompatible_avec);
  const key = normalize(magie.data.nom_court ?? '');
  const deduites = [...index.values()]
    .filter((other) => other.id !== magie.id && Array.isArray(other.data.incompatible_avec) && other.data.incompatible_avec.some((n) => normalize(n) === key))
    .filter((other) => !(direct ?? []).some((r) => r.entry.id === other.id))
    .sort(byNom);
  const incompatible =
    direct === null && deduites.length === 0
      ? [...index.values()].some((other) => Array.isArray(other.data.incompatible_avec))
        ? []
        : null
      : [...(direct ?? []).map((r) => ({ ...r, source: 'directe' })), ...deduites.map((entry) => ({ entry, self: false, source: 'deduite' }))];

  return { fortContre, faibleContre, incompatible, manquants };
}

/**
 * Pages de magie dont `resiste_a`, `vulnerable_a` et `incompatible_avec` sont celles de la base (lib/magies-db.mjs : tables magie_resistance et
 * v_magie_incompatible) : les pages de magie et le tableau des relations de /wiki/magies/ n'ont ainsi qu'une source. Les autres pages sont rendues telles quelles.
 * `magies` = le résultat de chargerMagies().
 */
export function entriesAvecRelationsDeLaBase(entries, magies) {
  const nom = (id) => magies.magies.get(id).nom;
  return entries.map((entry) => {
    const m = magies.magies.get(entry.id);
    if (!m) return entry;
    return {
      ...entry,
      data: {
        ...entry.data,
        resiste_a: m.resistances.resistance.magies.map((r) => nom(r.id)),
        vulnerable_a: m.resistances.vulnerabilite.magies.map((r) => nom(r.id)),
        incompatible_avec: m.incompatibles.map(nom),
      },
    };
  });
}

/**
 * Pages de magie dans l'ordre `ordre` (ids de page : l'ordre du classeur, magie.ordre dans la base) ; une magie absente de
 * `ordre` vient après, par nom court. Sans `ordre`, l'ordre alphabétique des noms courts.
 */
function magiesDansLOrdre(entries, ordre) {
  const rang = (m) => {
    const i = ordre.indexOf(m.id);
    return i < 0 ? ordre.length : i;
  };
  return [...magieIndex(entries).values()].sort((a, b) => rang(a) - rang(b) || byNom(a, b));
}

/** Tableau race × magie : lignes = races avec données (par titre), colonnes = magies (voir magiesDansLOrdre), cellule vraie si la race peut l'avoir. */
export function accessMatrix(entries, ordre = []) {
  const magies = magiesDansLOrdre(entries, ordre);
  const races = entries.filter((e) => isRace(e) && Array.isArray(e.data.magies_innees)).sort(byTitle);
  const cells = races.map((race) => {
    const own = new Set(race.data.magies_innees.map(normalize));
    return magies.map((m) => own.has(normalize(m.data.nom_court)));
  });
  return { races, magies, cells };
}

/**
 * Tableau magie × magie : ligne = la magie décrite, colonne = l'autre (les deux dans l'ordre de magiesDansLOrdre). Cellule { fort, faible, incompatible },
 * ou null quand la page de la ligne ne donne aucune liste de résistances (rien n'est supposé).
 */
export function relationMatrix(entries, ordre = []) {
  const magies = magiesDansLOrdre(entries, ordre);
  const cells = magies.map((row) => {
    const rel = relationsOfMagie(entries, row);
    const has = (list, col) => (list ?? []).some((r) => r.entry.id === col.id);
    return magies.map((col) => {
      if (rel.fortContre === null && rel.faibleContre === null && rel.incompatible === null) return null;
      if (rel.fortContre === null && rel.faibleContre === null && !has(rel.incompatible, col)) return null;
      return { fort: has(rel.fortContre, col), faible: has(rel.faibleContre, col), incompatible: has(rel.incompatible, col) };
    });
  });
  return { magies, cells };
}

/** Noms de magies qui ne correspondent à aucune page de magie, par page et par champ (contrôle d'intégrité). */
export function unresolvedNames(entries) {
  const index = magieIndex(entries);
  const out = [];
  for (const entry of entries) {
    for (const field of ['magies_innees', 'resiste_a', 'vulnerable_a', 'incompatible_avec']) {
      const names = entry.data[field];
      if (!Array.isArray(names)) continue;
      for (const name of names) if (!index.has(normalize(name))) out.push({ id: entry.id, field, name });
    }
  }
  return out;
}
