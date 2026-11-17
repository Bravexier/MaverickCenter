// Les tests d'une page retirée par migration (0094, 0095, 0096 : db-retrait-*.test.mjs) : chercher ce qui la cite encore, en admettant ce que le site de
// dev a écrit. Le site de dev est la source de ce qu'il modifie (skill tests-conventions) : un texte qu'il a écrit lui appartient, même s'il cite une
// adresse retirée ; une citation écrite par l'import ou par une migration, elle, reste interdite, même dans une cellule que le site a touchée avant.
// Une cellule n'est donc admise que si la DERNIÈRE valeur que le site y a écrite contient déjà le motif cherché (« le site a écrit cette colonne un
// jour » ne suffit pas). Les tests passent le même contrôle, sans admission, sur l'état de la migration (baseDImport({ garder: lotsAvant('NNNN') })).
//
//   ecritParLeSite(h)       (table, ligne, colonne, motif) => la dernière valeur que le site a écrite dans cette cellule (ligne créée comprise)
//                           contient `motif` ; pour un lien (tables dérivées lien, lien_candidat, refaites par db:build depuis le texte et jamais
//                           défaites par baseDImport), voir lienDuSite.
//   lienDuSite(h)           (table, ligne, colonne?, motif) => la ligne est un lien d'un texte que le site a écrit : le dernier corps_md que le site a
//                           écrit pour sa page contient la cible du lien (lien.cible ; pour lien_candidat, qui ne porte pas la cible, `motif`). Seule
//                           admission sur une base d'import, dont les liens sont ceux du texte courant.
//   lignesQuiCitent(base, table, colonne, motif, admise?)
//                           les lignes de `table` dont `colonne` contient `motif`, hors de celles que `admise(table, ligne, colonne, motif)` accepte.
//   citations(base, motif, admise?)
//                           ['table.colonne:n'] pour toute la base, hors des tables FTS et des notes de version (lib/notes-de-version.mjs#TABLES_DES_NOTES :
//                           l'historique du site et les notes gardent ce qui citait la page).
import { TABLES_DES_NOTES } from '../src/lib/notes-de-version.mjs';

const derivee = (table) => table === 'lien' || table === 'lien_candidat';

/**
 * La dernière valeur que le site a écrite dans la cellule (insertion ou modification), en texte ; undefined s'il ne l'a jamais écrite, ou si sa
 * dernière opération sur la ligne est une suppression (une ligne remise depuis l'a été hors du site).
 * @param {ReturnType<import('../src/lib/historique-site.mjs').historiqueSite>} h
 */
export function derniereValeurDuSite(h, table, ligne, colonne) {
  const ops = h.operations(table, ligne);
  if (!ops.length || ops.at(-1).operation === 'supprimer') return undefined;
  const o = ops.findLast((op) => op.operation !== 'supprimer' && op.apres && colonne in op.apres);
  const v = o?.apres[colonne];
  return v === undefined || v === null ? undefined : String(v);
}

const contient = (valeur, motif) => valeur !== undefined && typeof motif === 'string' && motif !== '' && valeur.includes(motif);

/** @param {ReturnType<import('../src/lib/historique-site.mjs').historiqueSite>} h l'historique de la base courante */
export const lienDuSite = (h) => (table, ligne, _colonne, motif) => derivee(table)
  && contient(derniereValeurDuSite(h, 'page', { id: ligne.page_id }, 'corps_md'), table === 'lien' ? ligne.cible : motif);

/** @param {ReturnType<import('../src/lib/historique-site.mjs').historiqueSite>} h l'historique de la base courante */
export function ecritParLeSite(h) {
  const lien = lienDuSite(h);
  return (table, ligne, colonne, motif) => (derivee(table)
    ? lien(table, ligne, colonne, motif)
    : contient(derniereValeurDuSite(h, table, ligne, colonne), motif));
}

const aucune = () => false;

/** Les lignes de `table` dont `colonne` contient `motif`, hors des lignes admises. */
export const lignesQuiCitent = (base, table, colonne, motif, admise = aucune) => base
  .prepare(`SELECT * FROM "${table}" WHERE instr(CAST("${colonne}" AS TEXT), ?) > 0`).all(motif)
  .filter((ligne) => !admise(table, ligne, colonne, motif));

/** Les colonnes de toute la base qui citent `motif` (« table.colonne:n », dans l'ordre de sqlite_master), hors des lignes admises. */
export function citations(base, motif, admise = aucune) {
  const sautees = new Set(TABLES_DES_NOTES);
  const resultat = [];
  for (const { name } of base.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%fts%'").all()) {
    if (sautees.has(name)) continue;
    for (const { name: colonne } of base.prepare(`PRAGMA table_info("${name}")`).all()) {
      const n = lignesQuiCitent(base, name, colonne, motif, admise).length;
      if (n) resultat.push(`${name}.${colonne}:${n}`);
    }
  }
  return resultat;
}
