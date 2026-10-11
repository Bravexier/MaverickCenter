// Champs d'un métier et ce que la base en tire (tables metier, metier_bonus, metier_objet_depart, metier_recette_famille, page du métier) : les mêmes
// découpages que l'importeur du Google Doc « MÉTIER », réécrits ici pour l'édition depuis le site de dev (client/serveur/edition.mjs), et les liens de
// règle que la fiche de personnage applique (décisions R33 à R35). Un test les rejoue sur les métiers de la base : ils doivent redonner exactement
// les lignes en place (test/metier-champs.test.mjs).
// Le corps de la page (champs « **Libellé :** valeur ») est fabriqué par lib/corps-metiers.mjs : ses fonctions sont réexportées ici.
// Fonctions pures, sans dépendance (sauf text.mjs, corps-metiers.mjs et classe-champs.mjs) : partagées par le service et par les pages.
import { decouperInventaire } from './classe-champs.mjs';
import { normalize } from './text.mjs';

export { CHAMPS_DU_CORPS, corpsDeMetier, echapperMarkdown, remplacerChampDuCorps } from './corps-metiers.mjs';

/** Valeur d'un champ « rien » (Artisanat, Équipement) : écrite telle quelle dans la source. */
export const RIEN = 'Rien';

/**
 * Cibles typées d'un bonus « +N Cible » qui ne sont pas des compétences, par leur clé (normalize), et l'attribut de la fiche qu'elles augmentent
 * (colonne metier_bonus.attribut) : l'initiative (« +1 INI », décision R33), la vitesse et la vitesse de nage (« +1 Vitesse au sol pour le sprint »,
 * « +1 Vitesse nage », décision R37 : « Il y a une valeur de Vitesse, et une valeur vitesse de nage. Il faudrait bien les ajouter. ») ; « Vitesse »,
 * « Vitesse au sol » et « Vitesse de nage » sont les noms de ces attributs sur la fiche. Toute autre cible (« butin pour… ») laisse le fragment en texte
 * (valeur NULL).
 */
export const ATTRIBUT_DE_CIBLE = {
  ini: 'initiative',
  vitesse: 'vitesse',
  'vitesse-au-sol': 'vitesse',
  'vitesse-au-sol-pour-le-sprint': 'vitesse',
  'vitesse-nage': 'vitesse_nage',
  'vitesse-de-nage': 'vitesse_nage',
};

/** Liste de compétences reçue : des noms (« Esquive ») ou des lignes { id, nom, caracteristique_id?, ordre? } de la table competence. */
const lignesDeCompetences = (competences) =>
  [...competences].map((c) => (typeof c === 'string' ? { id: normalize(c), nom: c, caracteristique_id: null, ordre: null } : c));

/**
 * Le champ « Bonus » découpé (table metier_bonus) : un rang par fragment séparé par « , » (quand le fragment suivant commence par un signe, ou que
 * le fragment en cours est un bonus typé ; sinon la virgule fait partie du texte : « armures cuir, peau, cellulose »), une option par « OU ».
 * `valeur`, `unite`, `cible` seulement pour « +N% Cible » / « +N Cible » dont la cible est connue ; le texte de chaque option est celui du rang.
 * Liens de règle (décisions R33, R37) : `competence_id` quand la cible est le nom d'une compétence (son Acquis), `attribut` pour l'initiative ou
 * une vitesse (ATTRIBUT_DE_CIBLE) ;
 * « +N% dans une compétence sociale au choix » : une option par compétence de la caractéristique nommée (Social), dans l'ordre de la fiche.
 * @param {string} brut
 * @param {Iterable<string | { id: string, nom: string, caracteristique_id?: string, ordre?: number }>} competences la table competence (ou ses noms)
 * @returns {{ rang: number, option: number, texte: string, valeur: number | null, unite: string | null, cible: string | null, cible_cle: string | null,
 *   competence_id: string | null, attribut: string | null }[]}
 */
export function decouperBonus(brut, competences) {
  const liste = lignesDeCompetences(competences);
  const parCle = new Map(liste.map((c) => [normalize(c.nom), c]));
  const connues = new Set([...parCle.keys(), ...Object.keys(ATTRIBUT_DE_CIBLE)]);
  const lien = (cle) => ({ competence_id: parCle.get(cle)?.id ?? null, attribut: ATTRIBUT_DE_CIBLE[cle] ?? null });
  const options = (fragment) => {
    // « +5% dans une compétence sociale au choix » : les compétences de la caractéristique dont l'adjectif est le nom (« sociale » → Social)
    const auChoix = /^([+-]\d+)(%?) dans une compétence (\p{L}+) au choix\.?$/u.exec(fragment);
    if (auChoix) {
      const adjectif = normalize(auChoix[3]);
      const deLaCarac = liste
        .filter((c) => c.caracteristique_id && (c.caracteristique_id === adjectif || `${c.caracteristique_id}e` === adjectif))
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      if (!deLaCarac.length) return null;
      return deLaCarac.map((c) => ({ valeur: Number(auChoix[1]), unite: auChoix[2] || null, cible: c.nom, cible_cle: normalize(c.nom), competence_id: c.id, attribut: null }));
    }
    const tete = /^([+-]\d+)(%?) (.+)$/.exec(fragment);
    if (!tete) return null;
    const noms = tete[3].split(' OU ').map((c, i, tout) => (i === tout.length - 1 ? c.replace(/\.$/, '') : c));
    if (!noms.every((c) => connues.has(normalize(c)))) return null;
    return noms.map((c) => ({ valeur: Number(tete[1]), unite: tete[2] || null, cible: c, cible_cle: normalize(c), ...lien(normalize(c)) }));
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
    else lignes.push({ rang: i + 1, option: 1, texte, valeur: null, unite: null, cible: null, cible_cle: null, competence_id: null, attribut: null });
  });
  return lignes.filter((l) => l.texte !== '');
}

/**
 * Les deux caractéristiques du test d'artisanat écrit entre crochets (décision R34), ou null : « FORCE + VOLONTÉ », « Artisanat SOCIAL + INTELLIGENCE »
 * (mot « Artisanat » en tête), « PERCEPTION x2 » (deux fois la même).
 * @param {string | null} test
 * @param {{ id: string, nom: string }[]} caracteristiques
 * @returns {[string, string] | null}
 */
export function caracteristiquesDuTest(test, caracteristiques) {
  const parNom = new Map(caracteristiques.map((c) => [normalize(c.nom), c.id]));
  const texte = String(test ?? '').trim();
  const deux = /^(?:Artisanat\s+)?([A-ZÀ-Ý]+)\s*\+\s*([A-ZÀ-Ý]+)$/u.exec(texte);
  const double = /^([A-ZÀ-Ý]+)\s*x\s*2$/u.exec(texte);
  const [a, b] = deux ? [deux[1], deux[2]] : double ? [double[1], double[1]] : [];
  const ida = a && parNom.get(normalize(a));
  const idb = b && parNom.get(normalize(b));
  return ida && idb ? [ida, idb] : null;
}

/**
 * Le champ « Artisanat possible » découpé (colonnes de metier) : « Rien » → rien à fabriquer ; sinon le texte avant le crochet final et le contenu
 * du crochet (test de fabrication), dont les deux caractéristiques (caracteristiquesDuTest).
 * @param {string} brut
 * @param {{ id: string, nom: string }[]} caracteristiques
 */
export function decouperArtisanat(brut, caracteristiques) {
  const texte = String(brut).trim();
  if (texte === RIEN) return { peut_fabriquer: 0, artisanat_texte: null, test_brut: null, test_carac_1_id: null, test_carac_2_id: null };
  const m = /^(.*?)\s*\[([^\]]*)\]$/s.exec(texte);
  if (!m) return { peut_fabriquer: 1, artisanat_texte: texte, test_brut: null, test_carac_1_id: null, test_carac_2_id: null };
  const caracs = caracteristiquesDuTest(m[2], caracteristiques);
  return { peut_fabriquer: 1, artisanat_texte: m[1], test_brut: m[2], test_carac_1_id: caracs?.[0] ?? null, test_carac_2_id: caracs?.[1] ?? null };
}

/** Le test d'artisanat écrit d'après ses deux caractéristiques : « FORCE + VOLONTÉ » (noms en capitales, comme la source) ; null sans caractéristique. */
export function testDArtisanat(carac1, carac2, caracteristiques) {
  if (!carac1 || !carac2) return null;
  const nom = (id) => (caracteristiques.find((c) => c.id === id)?.nom ?? id).toLocaleUpperCase('fr');
  return `${nom(carac1)} + ${nom(carac2)}`;
}

/**
 * Le champ « Artisanat possible » tel que la page l'écrit, d'après ses parties (décision R34 : texte libre + test) : « Rien » sans texte, sinon le texte
 * suivi du test entre crochets s'il y en a un.
 */
export const artisanatBrut = (texte, test) => (!texte ? RIEN : test ? `${texte} [${test}]` : texte);

/**
 * L'« Équipement supplémentaire possible » découpé en objets de départ (table metier_objet_depart, décision R35), comme l'inventaire de départ d'une
 * classe (lib/classe-champs.mjs#decouperInventaire) : un rang par « , », une option par « OU », le lien vers le glossaire des objets ; « Rien » : aucun.
 * @param {string} brut
 * @param {{ id: string, nom_cle: string }[]} objets glossaire (table objet_depart)
 */
export const decouperEquipement = (brut, objets) => (String(brut ?? '').trim() === RIEN ? [] : decouperInventaire(brut, objets));

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
