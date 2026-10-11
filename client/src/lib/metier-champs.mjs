// Champs d'un métier et ce que la base en tire (tables metier, metier_bonus, metier_recette_famille, page du métier) : les mêmes découpages que
// l'importeur du Google Doc « MÉTIER », réécrits ici pour l'édition depuis le site de dev (client/serveur/edition.mjs). Un test les rejoue sur les
// 72 métiers de la base : ils doivent redonner exactement les lignes en place (test/metier-champs.test.mjs).
// Le corps de la page (champs « **Libellé :** valeur ») est fabriqué par lib/corps-metiers.mjs : ses fonctions sont réexportées ici.
// Fonctions pures, sans dépendance (sauf text.mjs et corps-metiers.mjs) : partagées par le service et par les pages.
import { normalize } from './text.mjs';

export { CHAMPS_DU_CORPS, corpsDeMetier, echapperMarkdown, remplacerChampDuCorps } from './corps-metiers.mjs';

/** Valeur d'un champ « rien » (Artisanat, Équipement) : écrite telle quelle dans la source. */
export const RIEN = 'Rien';

/**
 * Cibles qu'un bonus « +N% Cible » ou « +N Cible » peut viser pour être typé : les compétences de la fiche (table competence, passées par
 * l'appelant) et deux attributs que l'importeur reconnaissait aussi. Toute autre cible (« Vitesse au sol pour le sprint », « butin pour… ») laisse le
 * fragment en texte (valeur NULL).
 */
export const ATTRIBUTS_TYPES = ['INI', 'Vitesse nage'];

/**
 * Le champ « Bonus » découpé (table metier_bonus) : un rang par fragment séparé par « , » (quand le fragment suivant commence par un signe, ou que
 * le fragment en cours est un bonus typé ; sinon la virgule fait partie du texte : « armures cuir, peau, cellulose »), une option par « OU ».
 * `valeur`, `unite`, `cible` seulement pour « +N% Cible » / « +N Cible » dont la cible est connue ; le texte de chaque option est celui du rang.
 * @param {string} brut
 * @param {Iterable<string>} cibles noms des compétences (comparés par normalize)
 * @returns {{ rang: number, option: number, texte: string, valeur: number | null, unite: string | null, cible: string | null, cible_cle: string | null }[]}
 */
export function decouperBonus(brut, cibles) {
  const connues = new Set([...cibles, ...ATTRIBUTS_TYPES].map(normalize));
  const options = (fragment) => {
    const tete = /^([+-]\d+)(%?) (.+)$/.exec(fragment);
    if (!tete) return null;
    const noms = tete[3].split(' OU ').map((c, i, tout) => (i === tout.length - 1 ? c.replace(/\.$/, '') : c));
    if (!noms.every((c) => connues.has(normalize(c)))) return null;
    return noms.map((c) => ({ valeur: Number(tete[1]), unite: tete[2] || null, cible: c, cible_cle: normalize(c) }));
  };
  const fragments = [];
  for (const morceau of String(brut).split(', ')) {
    const precedent = fragments.at(-1);
    if (precedent === undefined || /^[+-]/.test(morceau) || options(precedent)) fragments.push(morceau);
    else fragments[fragments.length - 1] = `${precedent}, ${morceau}`;
  }
  const lignes = [];
  fragments.forEach((texte, i) => {
    const typees = options(texte);
    if (typees) typees.forEach((o, j) => lignes.push({ rang: i + 1, option: j + 1, texte, ...o }));
    else lignes.push({ rang: i + 1, option: 1, texte, valeur: null, unite: null, cible: null, cible_cle: null });
  });
  return lignes.filter((l) => l.texte !== '');
}

/**
 * Le champ « Artisanat possible » découpé (colonnes de metier) : « Rien » → rien à fabriquer ; sinon le texte avant le crochet final et le contenu
 * du crochet (test de fabrication), dont les deux caractéristiques ne sont typées que pour la forme exacte « CARAC + CARAC ».
 * @param {string} brut
 * @param {{ id: string, nom: string }[]} caracteristiques
 */
export function decouperArtisanat(brut, caracteristiques) {
  const texte = String(brut).trim();
  if (texte === RIEN) return { peut_fabriquer: 0, artisanat_texte: null, test_brut: null, test_carac_1_id: null, test_carac_2_id: null };
  const m = /^(.*?)\s*\[([^\]]*)\]$/s.exec(texte);
  if (!m) return { peut_fabriquer: 1, artisanat_texte: texte, test_brut: null, test_carac_1_id: null, test_carac_2_id: null };
  const parNom = new Map(caracteristiques.map((c) => [normalize(c.nom), c.id]));
  const deux = /^([A-ZÀ-Ý]+)\s*\+\s*([A-ZÀ-Ý]+)$/u.exec(m[2]);
  const a = deux ? parNom.get(normalize(deux[1])) : undefined;
  const b = deux ? parNom.get(normalize(deux[2])) : undefined;
  return { peut_fabriquer: 1, artisanat_texte: m[1], test_brut: m[2], test_carac_1_id: a && b ? a : null, test_carac_2_id: a && b ? b : null };
}

/** Les seuls mots du champ « Artisanat possible » qui désignent une famille de recettes de la base (table metier_recette_famille). */
export const FAMILLES_DE_RECETTE = [
  { mot: 'fioles', famille: 'fiole' },
  { mot: 'philtres', famille: 'philtre' },
  { mot: 'remèdes', famille: 'remede' },
  { mot: 'huiles', famille: 'huile' },
  { mot: 'alchimie primitive', famille: 'primitive' },
];

/** Familles de recettes citées par le champ « Artisanat possible » : [{ famille, mot_source }], dans l'ordre de FAMILLES_DE_RECETTE. */
export const famillesDeRecette = (brut) =>
  FAMILLES_DE_RECETTE.filter((f) => new RegExp(`(^|[^\\p{L}])${f.mot}([^\\p{L}]|$)`, 'iu').test(String(brut))).map((f) => ({ famille: f.famille, mot_source: f.mot }));

/** Le résumé de la page d'un métier : la première phrase de sa description (jusqu'au premier point suivi d'une espace). */
export function resumeDeDescription(description) {
  const texte = String(description ?? '').trim();
  const m = /^(.+?[.!?…])\s/s.exec(texte);
  return m ? m[1] : texte;
}
