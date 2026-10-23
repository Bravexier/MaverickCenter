// Poser la balise d'un mot-clé du glossaire autour de chaque écriture d'un mot dans un texte de la base (demande du propriétaire du 2026-10-17 :
// « Transforme dans tous les textes le mot "Chakra" (ou chakra) en mot clé », puis « Barrière ») : l'outil hors ligne scripts/baliser-mot-cle.mjs, qui
// envoie les textes réécrits au service d'édition comme le ferait le mode modification. Le site, lui, ne repère jamais un mot-clé tout seul (marquage
// explicite : lib/mots-cles-balises.mjs) ; ce module écrit une fois, à la demande, les balises que le texte gardera.
// Une écriture du mot est balisée sous la forme canonique de sa colonne (lib/mots-cles-balises.mjs#formeCanonique) : dans un texte mis en forme
// (`markdown`), « {{id}} » quand elle est le libellé, sinon « {{id|texte}} » (« {{id\|texte}} » sur une ligne de tableau) ; dans un texte de case,
// « {{id|texte}} » toujours. Le texte affiché ne change donc pas (texteSansBalises le redonne). Ne sont jamais balisées (`ignorees`, avec leur raison) :
//   - une écriture collée à une lettre, un chiffre, un trait d'union ou une accolade (« Nanochakra », « chakratique », « Anti-barrière », « {chakra} ») ;
//   - une écriture dans le nom d'une chose (`noms` : « Boule de Chakra », « Barrière rocheuse » ; un nom se lit sans la casse ni la forme des apostrophes),
//     ou dans une écriture exclue à la demande (`exclus` : un nom propre que la base ne range pas, « Académie de Chakra », ou un autre sens du mot,
//     « barrière naturelle » ; lue de même), ou dans un contexte exclu (`contextes` : une expression régulière et sa raison, « magie de la Corruption » :
//     demande du propriétaire du 2026-10-18, « Seulement là où il est pertinent » ; jamais commencé au milieu d'un mot : « sources? » ne prend pas
//     « ressources ») ;
//   - une écriture dans une balise déjà écrite (« {{…}} »), une balise HTML ou un commentaire (« <…> », « <!-- … --> »), une adresse (« https://… ») ;
//   - dans un texte mis en forme : un code (zonesDeCode), un lien du wiki (« [[…]] »), le texte ou l'adresse d'un lien Markdown (« [texte](adresse) »,
//     « [x]: adresse »), un titre de section (« ## … », ou souligné de « === » / « --- » : son ancre est tirée de son texte), ni un intitulé en gras
//     seul sur sa ligne (« **Forteresse de Chakra** », le nom d'un lieu du Codex : un titre de section écrit en gras).
// sansLesBalisesDuMot retire les balises du mot-clé autour d'une écriture du mot (posées par l'outil ou à la main, rien ne les distingue) : l'outil
// les repose ensuite là où elles sont pertinentes, et seulement là ; ecrituresDuMotDans dit, écriture par écriture, lesquelles sont balisées (le
// rapport de l'outil liste ainsi chaque balise retirée sans être reposée).
// Fonction pure, sans dépendance navigateur ni Astro (dépendance : lib/mots-cles-balises.mjs). Le module des balises elles-mêmes (lecture, forme
// canonique, rendu) est lib/mots-cles-balises.mjs ; celui-ci ne sert qu'à l'outil de balisage.
import { dansUneLigneDeTableau, lireBalises, zonesDeCode } from './mots-cles-balises.mjs';

/** Ce qui colle à une écriture et en fait un autre mot : une lettre, un chiffre, un trait d'union, une accolade (« _ » est une mise en forme). */
const COLLE = '[\\p{L}\\p{N}{}-]';

/**
 * Les écritures d'un mot (`motif` : source d'une expression régulière, sans la casse ; avec, si `casse` : « CR » n'est pas « cr »), entières : pas
 * collées à ce qui en ferait un autre mot.
 */
export const ecrituresDuMot = (motif, drapeaux = 'giu', casse = false) =>
  new RegExp(`(?<!${COLLE})(?:${motif})(?!${COLLE})`, casse ? drapeaux.replace('i', '') : drapeaux);

/** Une forme de `texte` de même longueur, pour y chercher un nom : en minuscules (caractère par caractère), apostrophes droites. */
const formeDeRecherche = (texte) => Array.from(texte, (c) => {
  const m = c.toLowerCase();
  return m.length === c.length ? m : c;
}).join('').replace(/[’ʼ]/g, "'");

/** Les zones [debut, fin) de `texte` qui correspondent à `motif` (une expression globale). */
const zonesDe = (texte, motif) => [...texte.matchAll(motif)].map((m) => [m.index, m.index + m[0].length]);

/**
 * Les zones de `texte` où une écriture du mot ne se balise pas, chacune avec sa raison : [{ debut, fin, raison }]. `noms` : les noms (sans la casse ni la
 * forme des apostrophes), cherchés entiers (pas collés à une lettre, un chiffre ou un trait d'union).
 */
function zonesExclues(texte, { markdown, noms, exclus, contextes }) {
  const zones = [];
  const ajouter = (liste, raison) => liste.forEach(([debut, fin]) => zones.push({ debut, fin, raison }));
  ajouter(lireBalises(texte, { markdown }).map((b) => [b.debut, b.fin]), 'balise déjà écrite');
  ajouter(zonesDe(texte, /<!--[\s\S]*?(?:-->|$)|<[a-zA-Z/!?][^<>]*>/g), 'balise HTML');
  ajouter(zonesDe(texte, /\b(?:https?:\/\/|www\.)[^\s<>()[\]]+/gi), 'adresse');
  if (markdown) {
    ajouter(zonesDeCode(texte), 'code');
    ajouter(zonesDe(texte, /\[\[[^\]\n]*\]\]/g), 'lien du wiki');
    ajouter(zonesDe(texte, /!?\[[^\][\n]*\]\([^)\n]*\)/g), 'lien');
    ajouter(zonesDe(texte, /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*\S.*$/gm), 'lien');
    ajouter(zonesDe(texte, /^[ \t]{0,3}#{1,6}(?:[ \t].*)?$/gm), 'titre de section');
    ajouter(zonesDe(texte, /^[ \t]{0,3}\S.*(?=\n[ \t]{0,3}(?:=+|-+)[ \t]*$)/gm), 'titre de section');
    // tout en gras, sans autre mise en forme dedans, seul sur sa ligne (un retour à la ligne forcé « \ », deux-points ou espaces après)
    ajouter(zonesDe(texte, /^[ \t]*(\*{2,3}|_{2,3})(?=[^\s*_])[^*_\n]*[^\s*_]\1[ \t:\\]*$/gm), 'intitulé en gras');
  }
  const cherche = formeDeRecherche(texte);
  const chercher = (ecriture, raison) => {
    const n = formeDeRecherche(String(ecriture).trim());
    if (!n) return;
    const motif = new RegExp(`(?<!${COLLE})${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${COLLE})`, 'gu');
    ajouter(zonesDe(cherche, motif), `${raison} « ${ecriture} »`);
  };
  for (const nom of noms) chercher(nom, 'nom');
  for (const e of exclus) chercher(e, 'écriture exclue');
  for (const c of contextes) ajouter(zonesDe(texte, new RegExp(`(?<![\\p{L}\\p{N}])(?:${c.motif})`, 'gimu')), c.raison);
  return zones;
}

/**
 * Balise chaque écriture du mot dans `texte`.
 * @param {string} texte
 * @param {{ id: string, libelle: string, motif: string, casse?: boolean, markdown?: boolean, noms?: string[], exclus?: string[],
 *   contextes?: { motif: string, raison: string }[] }} o `id`, `libelle` : le mot-clé ; `motif` : les écritures du mot (source d'une expression régulière,
 *   sans la casse sauf `casse` : « chakras? ») ; `markdown` : un texte mis en forme ; `noms` : les noms qui contiennent le mot ; `exclus` : les écritures
 *   qui ne sont pas le mot-clé (noms propres, autre sens) ; `contextes` : les passages où le mot n'a pas le sens du mot-clé (source d'une expression
 *   régulière, sans la casse, « ^ » et « $ » au début et à la fin d'une ligne ; une écriture qui en touche un n'est pas balisée, avec sa raison)
 * @returns {{ texte: string, balisees: string[], ignorees: { ecriture: string, raison: string }[] }}
 */
export function baliserLeMot(texte, { id, libelle, motif, casse = false, markdown = false, noms = [], exclus = [], contextes = [] }) {
  const balisees = [];
  const ignorees = [];
  if (typeof texte !== 'string' || !texte) return { texte, balisees, ignorees };
  const ecritures = ecrituresDuMot(motif, 'giu', casse);
  if (!ecritures.test(texte)) return { texte, balisees, ignorees };
  ecritures.lastIndex = 0;
  const exclues = zonesExclues(texte, { markdown, noms, exclus, contextes });
  let sortie = '';
  let fin = 0;
  for (const m of texte.matchAll(ecritures)) {
    const a = m.index;
    const b = a + m[0].length;
    const zone = exclues.find((z) => a < z.fin && b > z.debut);
    if (zone) {
      ignorees.push({ ecriture: m[0], raison: zone.raison });
      continue;
    }
    let balise;
    if (!markdown) balise = `{{${id}|${m[0]}}}`;
    else if (m[0] === libelle) balise = `{{${id}}}`;
    else balise = `{{${id}${dansUneLigneDeTableau(texte, a) ? '\\|' : '|'}${m[0]}}}`;
    sortie += texte.slice(fin, a) + balise;
    fin = b;
    balisees.push(m[0]);
  }
  return { texte: fin === 0 ? texte : sortie + texte.slice(fin), balisees, ignorees };
}

/**
 * Retire de `texte` les balises du mot-clé `id` qui entourent une écriture du mot (« {{chakra}} » du libellé dans un texte mis en forme,
 * « {{chakra|chakra}} », « {{chakra\|chakra}} ») : le texte affiché est gardé tel quel. Une autre balise du mot-clé (un autre texte, « {{chakra|énergie}} »,
 * ou le mode complet) n'est pas touchée. Rend { texte, retirees } (le nombre de balises retirées).
 * @param {string} texte
 * @param {{ id: string, libelle: string, motif: string, casse?: boolean, markdown?: boolean }} o
 */
export function sansLesBalisesDuMot(texte, { id, libelle, motif, casse = false, markdown = false }) {
  if (typeof texte !== 'string' || !texte.includes(`{{${id}`)) return { texte, retirees: 0 };
  const mot = new RegExp(`^(?:${motif})$`, casse ? 'u' : 'iu');
  let sortie = '';
  let fin = 0;
  let retirees = 0;
  for (const b of lireBalises(texte, { markdown })) {
    if (b.ref !== id || b.complet) continue;
    const affiche = b.texte ?? (markdown ? libelle : null);
    if (affiche === null || !mot.test(affiche)) continue;
    sortie += texte.slice(fin, b.debut) + affiche;
    fin = b.fin;
    retirees += 1;
  }
  return { texte: retirees ? sortie + texte.slice(fin) : texte, retirees };
}

/**
 * Les écritures du mot dans `texte`, dans l'ordre : [{ ecriture, balisee, debut }] (`balisee` : dans une balise du mot-clé `id` qui l'entoure, comme
 * sansLesBalisesDuMot la lit ; sinon une écriture hors de toute balise). Deux états d'un texte qui ne diffèrent que par ces balises donnent la même
 * suite d'écritures : on lit ainsi celles qu'un passage a balisées ou débalisées.
 * @param {string} texte
 * @param {{ id: string, libelle: string, motif: string, casse?: boolean, markdown?: boolean }} o
 */
export function ecrituresDuMotDans(texte, { id, libelle, motif, casse = false, markdown = false }) {
  if (typeof texte !== 'string' || !texte) return [];
  const mot = new RegExp(`^(?:${motif})$`, casse ? 'u' : 'iu');
  const balises = lireBalises(texte, { markdown });
  const sortie = [];
  for (const b of balises) {
    if (b.ref !== id || b.complet) continue;
    const affiche = b.texte ?? (markdown ? libelle : null);
    if (affiche !== null && mot.test(affiche)) sortie.push({ ecriture: affiche, balisee: true, debut: b.debut });
  }
  for (const m of texte.matchAll(ecrituresDuMot(motif, 'giu', casse))) {
    if (!balises.some((b) => m.index < b.fin && m.index + m[0].length > b.debut)) sortie.push({ ecriture: m[0], balisee: false, debut: m.index });
  }
  return sortie.sort((a, b) => a.debut - b.debut);
}
