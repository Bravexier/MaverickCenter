// Dons de classe (pages `capacites/…` ; « capacités » dans la base et les onglets) : une page par don, avec les choix exclusifs. Fonctions pures sur les pages du wiki.
//
// Données lues dans le frontmatter d'une page `capacites/<slug>` (posé par l'import, voir content.config.ts) :
//   classe                id de la page de la classe          nature   « classe » | « specialite » | « choix »
//   specialite            bannière de spécialité (absente pour une capacité de classe et pour l'Archimage)
//   niveau, rang, ligne   niveau de classe ; position de gauche à droite ; ligne de la cellule dans l'onglet
//   choix_exclusif_avec   ids des autres capacités de la même ligne : UNE SEULE au choix
//
// Règles de la fiche, telles que les décrit le propriétaire du projet et que les montre la mise en page du classeur :
//  - les capacités côte à côte sur une même ligne sont un choix « l'une ou l'autre » (on ne peut pas avoir les deux) ;
//  - les deux cartouches de spécialité sont sur la même ligne : choisir une spécialité exclut l'autre, donc aussi
//    toutes les capacités de l'autre spécialité ;
//  - l'Archimage n'a pas de spécialité mais des groupes de 2 ou 3 capacités au même niveau ; une capacité seule sur sa
//    ligne est reçue sans choix.
// L'exclusivité est lue dans les deux sens (si A cite B, B est une alternative de A).

import { nomsSeRepondent as nomsCoupesSeRepondent } from './classe-dons.mjs';

const isCapacite = (e) => e.id.startsWith('capacites/');

/** Nom de la capacité tel qu'écrit dans l'onglet : sans le « (Classe) » ni le « , niveau N » ajoutés au titre pour distinguer les homonymes. */
export function nomCapacite(ability) {
  return ability.data.title.replace(/,\s*niveau \d+$/, '').replace(/ \([^()]*\)$/, '');
}

/**
 * Deux capacités d'une même ligne dont les noms sont coupés et se complètent (« Tenir ... » / « ... ou charger ? ») : le classeur
 * les écrit ainsi pour accentuer le choix entre les deux (confirmé par le propriétaire du projet). Ce sont bien deux capacités.
 */
export function nomsSeRepondent(a, b) {
  return nomsCoupesSeRepondent(nomCapacite(a), nomCapacite(b));
}
const declared = (e) => (Array.isArray(e.data.choix_exclusif_avec) ? e.data.choix_exclusif_avec : []);
const byPlace = (a, b) =>
  (a.data.niveau ?? 0) - (b.data.niveau ?? 0) || (a.data.ligne ?? 0) - (b.data.ligne ?? 0) || (a.data.rang ?? 0) - (b.data.rang ?? 0);
const byRang = (a, b) => (a.data.rang ?? 0) - (b.data.rang ?? 0) || a.data.title.localeCompare(b.data.title, 'fr');

/** Capacités qui s'excluent avec celle-ci (déclarées par elle ou la citant), sans doublon. */
export function alternativesOf(entries, ability) {
  const byId = new Map(entries.filter(isCapacite).map((e) => [e.id, e]));
  const out = [];
  const add = (e) => e && e.id !== ability.id && !out.includes(e) && out.push(e);
  for (const id of declared(ability)) add(byId.get(id));
  for (const other of byId.values()) if (declared(other).includes(ability.id)) add(other);
  return out;
}

/** Composantes connexes de la relation d'exclusivité parmi `abilities` (chaque groupe : options triées de gauche à droite). */
function components(entries, abilities) {
  const inSet = new Set(abilities.map((e) => e.id));
  const seen = new Set();
  const groups = [];
  for (const start of [...abilities].sort(byPlace)) {
    if (seen.has(start.id)) continue;
    const group = [];
    const queue = [start];
    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current.id)) continue;
      seen.add(current.id);
      group.push(current);
      for (const next of alternativesOf(entries, current)) if (inSet.has(next.id) && !seen.has(next.id)) queue.push(next);
    }
    groups.push(group.sort(byRang));
  }
  // Les groupes sortent déjà dans l'ordre de l'onglet : on part des capacités triées par (niveau, ligne, rang).
  return groups.map((options) => ({ niveau: options[0].data.niveau, options }));
}

/**
 * Les capacités d'une classe, rangées comme l'onglet : celles reçues sans choix ; pour chaque spécialité son cartouche et ses
 * groupes de choix ; les groupes de choix hors spécialité (Archimage).
 * @returns {{ automatiques: object[], specialites: { nom: string, cartouche: object | null, groupes: { niveau: number, options: object[] }[] }[], groupes: { niveau: number, options: object[] }[] }}
 */
export function capacitesOfClass(entries, classEntry) {
  const mine = entries.filter((e) => isCapacite(e) && e.data.classe === classEntry.id);
  const automatiques = mine.filter((e) => e.data.nature === 'classe').sort(byPlace);

  const names = [...new Set(mine.filter((e) => e.data.specialite).map((e) => e.data.specialite))];
  const specialites = names
    .map((nom) => {
      const own = mine.filter((e) => e.data.specialite === nom);
      return {
        nom,
        cartouche: own.find((e) => e.data.nature === 'specialite') ?? null,
        groupes: components(entries, own.filter((e) => e.data.nature === 'choix')),
      };
    })
    .sort((a, b) => (a.cartouche?.data.rang ?? 99) - (b.cartouche?.data.rang ?? 99) || a.nom.localeCompare(b.nom, 'fr'));

  const groupes = components(entries, mine.filter((e) => e.data.nature === 'choix' && !e.data.specialite));
  return { automatiques, specialites, groupes };
}

/**
 * Contrôle un ensemble de capacités choisies : deux capacités d'une même ligne se contredisent (« meme-choix ») ; deux capacités de
 * spécialités différentes d'une même classe aussi (« autre-specialite »).
 * @returns {{ ok: boolean, conflits: { a: string, b: string, raison: 'meme-choix' | 'autre-specialite' }[], inconnues: string[] }}
 */
export function checkSelection(entries, ids) {
  const byId = new Map(entries.filter(isCapacite).map((e) => [e.id, e]));
  const unique = [...new Set(ids)];
  const inconnues = unique.filter((id) => !byId.has(id));
  const chosen = unique.filter((id) => byId.has(id)).map((id) => byId.get(id));
  const conflits = [];
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      const a = chosen[i];
      const b = chosen[j];
      if (alternativesOf(entries, a).includes(b)) conflits.push({ a: a.id, b: b.id, raison: 'meme-choix' });
      else if (a.data.classe === b.data.classe && a.data.specialite && b.data.specialite && a.data.specialite !== b.data.specialite) {
        conflits.push({ a: a.id, b: b.id, raison: 'autre-specialite' });
      }
    }
  }
  return { ok: conflits.length === 0 && inconnues.length === 0, conflits, inconnues };
}

/** Exclusivités déclarées dans un seul sens (contrôle d'intégrité du contenu importé). */
export function asymmetricChoices(entries) {
  const byId = new Map(entries.filter(isCapacite).map((e) => [e.id, e]));
  const out = [];
  for (const e of byId.values()) {
    for (const id of declared(e)) {
      const other = byId.get(id);
      if (other && !declared(other).includes(e.id)) out.push({ de: e.id, vers: id });
    }
  }
  return out;
}

/** Classe ou alternative qui ne désigne aucune page (contrôle d'intégrité). */
export function unresolvedCapacites(entries) {
  const known = new Set(entries.map((e) => e.id));
  const out = [];
  for (const e of entries.filter(isCapacite)) {
    if (e.data.classe && !known.has(e.data.classe)) out.push({ id: e.id, champ: 'classe', valeur: e.data.classe });
    for (const id of declared(e)) if (!known.has(id)) out.push({ id: e.id, champ: 'choix_exclusif_avec', valeur: id });
  }
  return out;
}

/** Les capacités rangées par classe (page de liste) : classes triées par titre, capacités dans l'ordre de l'onglet ; les orphelines à la fin. */
export function groupByClass(entries) {
  const classes = new Map(entries.filter((e) => e.id.startsWith('classes/')).map((e) => [e.id, e]));
  const buckets = new Map();
  for (const e of entries.filter(isCapacite)) {
    const key = classes.has(e.data.classe) ? e.data.classe : null;
    buckets.set(key, [...(buckets.get(key) ?? []), e]);
  }
  const named = [...buckets.entries()]
    .filter(([key]) => key !== null)
    .map(([key, list]) => ({ classe: classes.get(key), entries: list.sort(byPlace) }))
    .sort((a, b) => a.classe.data.title.localeCompare(b.classe.data.title, 'fr'));
  return buckets.has(null) ? [...named, { classe: null, entries: buckets.get(null).sort(byPlace) }] : named;
}
