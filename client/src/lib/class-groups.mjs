// Présentation des classes par catégorie (page /wiki/classes/ et fil d'Ariane d'une classe). Fonctions pures.
//
// La catégorie vient de l'import : le Sommaire du classeur « Classe Maverick V7 » range chaque classe sous un intitulé
// (« Classe Physique Corps à Corps », « Classe Physique Distance », « Classe Magique », « Classe Hybride Animal »,
// « Classe Hybride », « Classe spéciale »), et l'extracteur le pose en tag sur la page. On regroupe d'après ces tags :
// aucune catégorie n'est déduite du contenu d'une classe.
//
// Correspondance avec les rubriques demandées par le propriétaire du projet :
//   Physiques > Mêlée     = « Classe Physique Corps à Corps »
//   Physiques > Distance  = « Classe Physique Distance »
//   Magiques              = « Classe Magique »
//   Raciales              = « Classe Hybride Animal » (ces classes portent le nom d'une race)
//   Autres                = « Classe Hybride » (Flagelleur) et « Classe spéciale » (Archimage)
// Exception décidée par le propriétaire : le Parleur, rangé « Physique Corps à Corps » par le classeur, est présenté
// sous « Autres » (voir CLASS_OVERRIDES). Une classe sans catégorie reconnue n'est jamais perdue : elle va dans
// « Non classées », sous « Autres ».
import { normalize } from './text.mjs';

/** key = ancre HTML ; tags = tags posés par l'import (comparés sans casse ni accents) ; label null = pas de sous-titre. */
export const CLASS_GROUPS = [
  {
    key: 'physiques',
    label: 'Physiques',
    sections: [
      { key: 'melee', label: 'Mêlée', tags: ['càc'] },
      { key: 'distance', label: 'Distance', tags: ['distance'] },
    ],
  },
  { key: 'magiques', label: 'Magiques', sections: [{ key: 'magiques', label: null, tags: ['magique'] }] },
  { key: 'raciales', label: 'Raciales', sections: [{ key: 'hybride-animal', label: null, tags: ['hybride animal'] }] },
  { key: 'autres', label: 'Autres', sections: [{ key: 'autres', label: null, tags: ['hybride', 'spéciale'] }] },
];

/** Pages présentées ailleurs que dans la catégorie de leur tag : id de page -> clé de groupe (première rubrique). */
export const CLASS_OVERRIDES = { 'classes/parleur': 'autres' };

const UNCLASSIFIED = { key: 'non-classees', label: 'Non classées' };
const byTitle = (a, b) => a.data.title.localeCompare(b.data.title, 'fr');

// Rubrique d'une page : l'exception éventuelle, sinon la première rubrique (dans l'ordre d'affichage) dont un tag figure sur la page.
function findSection(entry) {
  const forced = CLASS_GROUPS.find((g) => g.key === CLASS_OVERRIDES[entry.id]);
  if (forced) return { group: forced, section: forced.sections[0] };
  const tags = new Set((entry.data.tags ?? []).map(normalize));
  for (const group of CLASS_GROUPS) {
    for (const section of group.sections) {
      if (section.tags.some((tag) => tags.has(normalize(tag)))) return { group, section };
    }
  }
  return null;
}

/**
 * Range des pages de classes en groupes ordonnés, sans groupe ni section vide ; chaque section est triée par titre.
 * @param {{ data: { title: string, tags?: string[] } }[]} entries
 * @returns {{ key: string, label: string, sections: { key: string, label: string | null, entries: object[] }[] }[]}
 */
export function groupClasses(entries) {
  const buckets = new Map(); // "groupe/section" -> pages
  const lost = [];
  for (const entry of entries) {
    const hit = findSection(entry);
    if (!hit) {
      lost.push(entry);
      continue;
    }
    const id = `${hit.group.key}/${hit.section.key}`;
    buckets.set(id, [...(buckets.get(id) ?? []), entry]);
  }

  const groups = [];
  for (const group of CLASS_GROUPS) {
    const sections = group.sections
      .filter((s) => buckets.has(`${group.key}/${s.key}`))
      .map((s) => ({ key: s.key, label: s.label, entries: [...buckets.get(`${group.key}/${s.key}`)].sort(byTitle) }));
    if (group.key === 'autres' && lost.length) sections.push({ ...UNCLASSIFIED, entries: [...lost].sort(byTitle) });
    if (sections.length) groups.push({ key: group.key, label: group.label, sections });
  }
  if (lost.length && !groups.some((g) => g.key === 'autres')) {
    // aucune classe « hybride » ni « spéciale » : le groupe « Autres » n'existe que pour les non classées
    groups.push({ key: 'autres', label: 'Autres', sections: [{ ...UNCLASSIFIED, entries: [...lost].sort(byTitle) }] });
  }
  return groups;
}

/** Groupe et rubrique d'une page de classe, ou null si aucune catégorie n'est reconnue. */
export function classCategory(entry) {
  const hit = findSection(entry);
  return hit
    ? { group: hit.group.label, groupKey: hit.group.key, section: hit.section.label, sectionKey: hit.section.key }
    : null;
}
