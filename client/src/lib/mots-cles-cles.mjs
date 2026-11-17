// La clé des mots-clés (mot_cle.cle, migration 0113 ; décision R232 (2), (9), (10)) : la jumelle JavaScript de tools/db/maverick.py#cles_des_mots_cles,
// la référence de la règle (test/mots-cles-cles.test.mjs compare les deux). Une seule fonction, pure, que reprennent le service du site de dev
// (serveur/edition-mots-cles.mjs : recalcul à chaque renommage, changement de catégorie, homonyme qui apparaît ou disparaît, catégorie renommée) et
// db:check (aucun écart admis).
// Règle (réponses du propriétaire, 2026-11-08) :
//   - sans homonyme (aucun autre mot-clé de même normalize(libellé)) : normalize(libellé) ;
//   - des homonymes : normalize(libellé), puis, chacune précédée d'un tiret, le normalize du libellé de chacune de SES catégories qui n'est pas
//     commune à tous ses homonymes, dans l'ordre croissant de l'id de catégorie (« namazu-race », « namazu-classe » ; trois homonymes ou plus, de même).
// Refus (`strict`) : un homonyme sans catégorie, ou dont les catégories sont incluses dans celles d'un autre (mêmes catégories comprises : il n'a pas
// au moins une catégorie propre face à chacun des autres, R232 (9)) ; deux mots-clés de même clé (« Namazu race » face à namazu-race, R232 (10)).
// Sans `strict`, un homonyme sans catégorie propre prend normalize(libellé) seul ; deux clés égales restent refusées (mot_cle.cle est UNIQUE).
// Sans dépendance navigateur ni Astro (lib/text.mjs seulement).
import { normalize } from './text.mjs';

/**
 * Le registre de la migration 0113 (ancien id texte → id entier, pour les 407 mots-clés de la version 112), relatif à la racine du dépôt : le rejeu d'un
 * lot d'avant la migration y traduit ses mots-clés (serveur/edition.mjs#registreDes0113) ; livré avec le service (serveur/livraison.mjs#FICHIERS_JOINTS).
 */
export const REGISTRE_DES_IDS_DE_MOTS_CLES = 'data/migrations/0113-mots-cles-id-entier.json';

/** Le refus de la règle des clés : `fautes` = [{ base (normalize du libellé), ids, raison: 'sans-categorie' | 'incluses' | 'cle-prise', cle? }]. */
export class HomonymesRefuses extends Error {
  constructor(fautes) {
    super(fautes.map((f) => `${f.base} [${[...f.ids].sort((a, b) => a - b).join(', ')}] : ${RAISONS[f.raison]}`).join(' ; '));
    this.name = 'HomonymesRefuses';
    this.fautes = fautes;
  }
}

/** Le texte de chaque raison d'un refus (le même sens que celui de maverick.py). */
export const RAISONS = Object.freeze({
  'sans-categorie': 'homonyme sans catégorie',
  incluses: 'aucune catégorie propre face à un homonyme (catégories incluses ou égales)',
  'cle-prise': 'clé déjà prise',
});

/**
 * La clé de chaque mot-clé : Map(id → clé). `motsCles` : [{ id, libelle, categories: [ids de catégorie] }] ; `categories` : Map ou objet { id de
 * catégorie → libellé }. Lève HomonymesRefuses (voir l'en-tête) ; une Error pour un libellé sans lettre ni chiffre.
 */
export function clesDesMotsCles(motsCles, categories, { strict = true } = {}) {
  const libelleDe = categories instanceof Map ? (c) => categories.get(c) : (c) => categories[c];
  const groupes = new Map();
  for (const m of motsCles) {
    const base = normalize(m.libelle ?? '');
    if (!groupes.has(base)) groupes.set(base, []);
    groupes.get(base).push({ id: m.id, cats: new Set((m.categories ?? []).map(Number)) });
  }
  const cles = new Map();
  const fautes = [];
  for (const [base, membres] of groupes) {
    if (!base) throw new Error(`mot-clé sans lettre ni chiffre : ${membres.map((x) => x.id).join(', ')}`);
    if (membres.length === 1) {
      cles.set(membres[0].id, base);
      continue;
    }
    const communes = new Set([...membres[0].cats].filter((c) => membres.every((x) => x.cats.has(c))));
    for (const { id, cats } of membres) {
      if (!cats.size) fautes.push({ base, ids: [id], raison: 'sans-categorie' });
      else {
        for (const autre of membres) {
          if (autre.id !== id && [...cats].every((c) => autre.cats.has(c))) fautes.push({ base, ids: [id, autre.id], raison: 'incluses' });
        }
      }
      const propres = [...cats].filter((c) => !communes.has(c)).sort((a, b) => a - b);
      cles.set(id, [base, ...propres.map((c) => normalize(libelleDe(c) ?? ''))].join('-'));
    }
  }
  const parCle = new Map();
  for (const [id, cle] of cles) (parCle.get(cle) ?? parCle.set(cle, []).get(cle)).push(id);
  const doubles = [...parCle].filter(([, ids]) => ids.length > 1).map(([cle, ids]) => ({ base: cle, ids, raison: 'cle-prise', cle }));
  if (doubles.length || (strict && fautes.length)) throw new HomonymesRefuses([...doubles, ...(strict ? fautes : [])]);
  return cles;
}
