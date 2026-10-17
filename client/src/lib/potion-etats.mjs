// Altérations d'état que l'effet d'une potion inflige, réduit ou soigne (table potion_etat, data/schema.sql section 9) : la règle de l'import des potions
// (Google Doc « Alchimie »), réécrite pour l'édition depuis le site de dev (serveur/edition-consommables.mjs : un effet modifié refait les lignes de sa
// potion). test/potion-etats.test.mjs la rejoue sur toutes les potions de la base : elle redonne les lignes de potion_etat.
//
// Seules les tournures que les lignes de l'import retiennent, une ligne de l'effet chacune ; `action` redit la tournure, pas une règle :
//   'inflige' : « Inflige <état> <n> » (« Oblige un jet de vigueur, si raté : Inflige gel 1 ») ; valeur = n (sans nombre écrit : pas de ligne) ;
//   'reduit'  : « Réduit d'un cran <état> », « Réduit de deux crans <état> » (article compris : « la brûlure », « l’aveuglement ») ; valeur = le nombre
//               de crans écrit ;
//   'soigne'  : « Soigne totalement <état> » ; valeur NULL.
// Une autre mention n'en est pas une (« Soigne le coma », « les altérations d’états » de la panacée). L'état est écrit par son nom (sans tenir compte des
// accents ni des majuscules) ou par l'écriture que les lignes de l'import rapprochent d'un état (FORMES_D_ETAT : « la pétrification » → Pétrifié) ;
// aucune autre n'est supposée. `texte` : la ligne de l'effet qui porte la tournure (l'effet lu sans les balises du glossaire, lib/mots-cles-balises.mjs).
// Une potion n'a qu'une ligne par état et par action (clé primaire de potion_etat) : la première écrite.
// Fonctions pures, sans dépendance navigateur ni Astro (dépendances : lib/text.mjs, lib/mots-cles-balises.mjs).
import { texteSansBalises } from './mots-cles-balises.mjs';
import { normalize } from './text.mjs';

/** Écritures d'un état autres que son nom, relevées dans les lignes de l'import (forme normalisée → nom normalisé de l'état). */
const FORMES_D_ETAT = { petrification: 'petrifie' };

/** Les nombres de crans écrits en lettres (« d'un cran », « de deux crans »). */
const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5 };

const L = '\\p{L}';
const BLANC = '[\\s\\u00a0\\u202f]';
const TOURNURE = new RegExp(
  `(?<![${L}])(?:(?<inflige>inflige)|r[ée]duit${BLANC}+(?:d['’]${BLANC}*(?<un>une?)|de${BLANC}+(?<crans>[0-9]+|deux|trois|quatre|cinq))${BLANC}+crans?|(?<soigne>soigne${BLANC}+totalement))(?![${L}])`,
  'giu',
);
const ARTICLE = new RegExp(`^${BLANC}*(?:(?:la|le|les)${BLANC}+|l['’]${BLANC}*)`, 'iu');
const MOTS = new RegExp(`^${BLANC}*([${L}]+(?:${BLANC}+[${L}]+){0,2})`, 'u');
const NIVEAU = new RegExp(`^${BLANC}*([0-9]+)(?![0-9])`, 'u');

/** Table des écritures reconnues (forme normalisée → id de l'état) pour une liste d'états { id, nom } (table etat). */
export function formesDesEtatsDePotion(etats) {
  const parNom = new Map(etats.map((e) => [normalize(e.nom), e.id]));
  const formes = new Map(parNom);
  for (const [forme, nom] of Object.entries(FORMES_D_ETAT)) if (parNom.has(nom)) formes.set(forme, parNom.get(nom));
  return formes;
}

/** L'état écrit au début de `reste` (le plus long groupe de un à trois mots reconnu) : { etatId, fin } ou null. */
function etatEnTete(reste, formes) {
  const m = MOTS.exec(reste);
  if (!m) return null;
  const debut = m[0].length - m[1].length;
  const mots = [...m[1].matchAll(new RegExp(`[${L}]+`, 'gu'))];
  for (let n = mots.length; n >= 1; n -= 1) {
    const dernier = mots[n - 1];
    const forme = m[1].slice(0, dernier.index + dernier[0].length);
    const etatId = formes.get(normalize(forme));
    if (etatId) return { etatId, fin: debut + forme.length };
  }
  return null;
}

/**
 * Les lignes de potion_etat d'un effet (sans ressource_id, origine ni source_ref), dans l'ordre du texte : [{ etat_id, action, valeur, texte }].
 * @param {string | null} effet la colonne potion.effet
 * @param {{ id: string, nom: string }[] | Map<string, string>} etats la table etat, ou formesDesEtatsDePotion(table etat)
 */
export function etatsDeLaPotion(effet, etats) {
  const formes = etats instanceof Map ? etats : formesDesEtatsDePotion(etats);
  const vus = new Set();
  const sortie = [];
  const lignes = String(texteSansBalises(effet ?? '') ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const texte of lignes) {
    for (const m of texte.matchAll(TOURNURE)) {
      const action = m.groups.inflige ? 'inflige' : m.groups.soigne ? 'soigne' : 'reduit';
      let reste = texte.slice(m.index + m[0].length);
      const article = ARTICLE.exec(reste);
      if (article) reste = reste.slice(article[0].length);
      const e = etatEnTete(reste, formes);
      if (!e) continue;
      let valeur = null;
      if (action === 'inflige') {
        const n = NIVEAU.exec(reste.slice(e.fin));
        if (!n) continue;
        valeur = Number(n[1]);
      } else if (action === 'reduit') {
        valeur = m.groups.un ? 1 : NOMBRES[m.groups.crans.toLowerCase()] ?? Number(m.groups.crans);
      }
      if (valeur !== null && !(valeur >= 1)) continue;
      const cle = `${e.etatId}\u0000${action}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      sortie.push({ etat_id: e.etatId, action, valeur, texte });
    }
  }
  return sortie;
}
