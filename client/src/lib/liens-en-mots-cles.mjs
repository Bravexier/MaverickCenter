// Les liens d'un texte devenus des balises du glossaire (migration 0098, data/migrations/0098-liens-en-mots-cles.sql ; réponses du propriétaire du
// 2026-11-06 : `mot_cle` gagne une couleur et une adresse, et « les [[…]] et les liens Markdown internes [texte](/…) deviennent des balises ») : un lien
// `[[cible]]`, `[[cible|texte]]` ou `[texte](/adresse)` qui mène à une page (ou à une route du site) devient la balise du mot-clé de cette page, son
// texte affiché gardé : « {{id}} » quand il est le libellé du mot-clé, « {{id|texte}} » sinon (« {{id\|texte}} » sur une ligne de tableau Markdown) ;
// dans un texte de case, « {{id|texte}} » toujours (la forme canonique de lib/mots-cles-balises.mjs#formeCanonique). Un lien dans un code
// (lib/mots-cles-balises.mjs#zonesDeCode) reste tel quel ; un lien que la table ne connaît pas aussi (`restes`).
// La table de conversion vient du registre de la migration (data/migrations/0098-liens-en-mots-cles.json : `motsCles`, chacun avec ses `cles` de lien
// `[[…]]` et ses `adresses` de lien Markdown) : tableDeConversion. Le générateur de la migration (scripts/liens-en-mots-cles.mjs) s'en sert ; le rejeu
// du journal du site de dev aussi (un lot d'avant la 0098 qui écrit encore un lien).
// Pur, sans dépendance navigateur ni Astro (dépendances : lib/wikilinks-resolution.mjs, lib/mots-cles-balises.mjs, lib/text.mjs).
import { dansUneLigneDeTableau, zonesDeCode } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';
import { WIKILINK_SOURCE } from './wikilinks-resolution.mjs';

/** Un lien Markdown interne `[texte](/adresse)` (ni une image, ni « //hôte » ; l'adresse sans espace ni parenthèse). */
export const LIEN_MARKDOWN_SOURCE = String.raw`(?<!!)\[([^\[\]\n]*)\]\((\/(?!\/)[^()\s]*)\)`;

/** Le texte d'un lien tel que le Markdown l'affiche (ses échappements retirés), pour le comparer au libellé. */
const texteAffiche = (t) => String(t).replace(/\\([\\`*_[\]|<{}])/g, '$1');

/**
 * Les clés sous lesquelles un lien `[[cible]]` cherche sa page (lib/wikilinks-resolution.mjs#resolve) : l'id de la page en minuscules quand la cible
 * contient « / », puis normalize(cible).
 */
export function clesDeCible(cible) {
  const voulue = String(cible).trim();
  const cles = [];
  if (voulue.includes('/')) cles.push(`id:${voulue.toLowerCase()}`);
  const n = normalize(voulue);
  if (n) cles.push(n);
  return cles;
}

/** Une adresse découpée : { chemin, requete, ancre } (« /magies/#relations » → { chemin: '/magies/', requete: '', ancre: 'relations' }). */
export function decouperAdresse(adresse) {
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(String(adresse));
  return { chemin: m[1], requete: (m[2] ?? '').slice(1), ancre: (m[3] ?? '').slice(1) };
}

/**
 * Les liens d'un texte, dans l'ordre : [{ debut, fin, brut, sorte ('wiki' | 'markdown'), cible (wiki : la cible écrite ; markdown : l'adresse),
 * texte (le texte affiché) }]. `markdown` : un texte mis en forme, dont les liens dans un code ne comptent pas.
 */
export function liensDuTexte(texte, { markdown = false } = {}) {
  if (typeof texte !== 'string' || (!texte.includes('[[') && !texte.includes(']('))) return [];
  const zones = markdown ? zonesDeCode(texte) : [];
  const dansUnCode = (debut, fin) => zones.some(([a, b]) => debut < b && fin > a);
  const liens = [];
  for (const m of texte.matchAll(new RegExp(WIKILINK_SOURCE, 'g'))) {
    const debut = m.index;
    const fin = debut + m[0].length;
    if (!dansUnCode(debut, fin)) liens.push({ debut, fin, brut: m[0], sorte: 'wiki', cible: m[1].trim(), texte: (m[2] ?? m[1]).trim() });
  }
  for (const m of texte.matchAll(new RegExp(LIEN_MARKDOWN_SOURCE, 'g'))) {
    const debut = m.index;
    const fin = debut + m[0].length;
    if (dansUnCode(debut, fin) || liens.some((l) => debut < l.fin && fin > l.debut)) continue;
    liens.push({ debut, fin, brut: m[0], sorte: 'markdown', cible: m[2], texte: m[1].trim() });
  }
  return liens.sort((a, b) => a.debut - b.debut);
}

/**
 * La table de conversion d'après les mots-clés du registre ([{ id, libelle, cles?, adresses? }]) : { parCle (clé de cible → mot-clé), parAdresse
 * (adresse → mot-clé) }. Une clé ou une adresse donnée à deux mots-clés est une erreur.
 */
export function tableDeConversion(motsCles) {
  const parCle = new Map();
  const parAdresse = new Map();
  const poser = (carte, k, m, quoi) => {
    if (carte.has(k) && carte.get(k).id !== m.id) throw new Error(`${quoi} « ${k} » donnée à deux mots-clés : ${carte.get(k).id}, ${m.id}`);
    carte.set(k, m);
  };
  for (const m of motsCles ?? []) {
    const motCle = { id: m.id, libelle: m.libelle };
    for (const k of m.cles ?? []) poser(parCle, k, motCle, 'clé');
    for (const a of m.adresses ?? []) poser(parAdresse, a, motCle, 'adresse');
  }
  return { parCle, parAdresse };
}

/** Le mot-clé où mène un lien (lu par liensDuTexte), ou null. */
export function motCleDuLien(table, lien) {
  if (lien.sorte === 'markdown') return table.parAdresse.get(lien.cible) ?? null;
  for (const k of clesDeCible(lien.cible)) if (table.parCle.has(k)) return table.parCle.get(k);
  return null;
}

/**
 * La balise canonique d'un lien converti vers le mot-clé `m` ({ id, libelle }), son texte affiché gardé ; null si le texte ne peut pas être celui d'une
 * balise (accolades, « | », saut de ligne) ou s'il est vide. `markdown` : un texte mis en forme ; `tableau` : le lien est sur une ligne de tableau.
 */
export function baliseDuLien(lien, m, { markdown = false, tableau = false } = {}) {
  const texte = lien.texte;
  if (!texte || /[{}|\n\r]/.test(texteAffiche(texte))) return null;
  // la ref : la clé du mot-clé (migration 0113) ; le registre de la 0098, d'avant elle, n'a que l'id texte, qui était alors la clé
  const ref = m.cle ?? m.id;
  if (markdown) return texteAffiche(texte) === m.libelle ? `{{${ref}}}` : `{{${ref}${tableau ? '\\|' : '|'}${texte}}}`;
  return `{{${ref}|${texte}}}`;
}

/**
 * Le texte dont les liens connus de `table` (tableDeConversion) sont devenus des balises : { texte, convertis: [{ brut, balise, id }], restes: [brut] }
 * (`restes` : un lien que la table ne connaît pas, ou dont le texte ne peut pas être celui d'une balise, laissé tel quel). `markdown` : un texte mis en
 * forme (lib/edition-modele.mjs#typeDeTexte) ; sinon un texte de case.
 */
export function convertirLesLiens(texte, table, { markdown = false } = {}) {
  const liens = liensDuTexte(texte, { markdown });
  const convertis = [];
  const restes = [];
  if (!liens.length) return { texte, convertis, restes };
  let sortie = '';
  let dernier = 0;
  for (const lien of liens) {
    const m = motCleDuLien(table, lien);
    const balise = m ? baliseDuLien(lien, m, { markdown, tableau: markdown && dansUneLigneDeTableau(texte, lien.debut) }) : null;
    if (!balise) {
      restes.push(lien.brut);
      continue;
    }
    sortie += texte.slice(dernier, lien.debut) + balise;
    dernier = lien.fin;
    convertis.push({ brut: lien.brut, balise, id: m.id });
  }
  return { texte: sortie + texte.slice(dernier), convertis, restes };
}
