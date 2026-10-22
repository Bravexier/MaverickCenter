// Résistances, faiblesses et immunités écrites en toutes lettres dans les dons (de race : onglet de la race, décision R13 ; de classe : capacite.effet),
// lues au build (lib/fiche-regles.mjs) pour le tableau « Résistance / Faiblesse » de la fiche de personnage (lib/fiche-moteur.mjs#resistancesDe).
// Rien n'est déduit : seul ce que le texte écrit compte.
//   « 1 cran de résistance en plus à la magie innée et son altération d'état » (ethnies des races hybrides), « Augmente d'un cran la résistance à la
//   magie innée et à son altération d'état » (Clerc) : +1 à la magie innée du personnage et +1 à l'altération d'état liée à cette magie ; « … la
//   résistance aux altérations d'état lié à la magie innée » : +1 à l'altération seule ;
//   « 1 cran de résistance au gel et à la brûlure » : +1 à chaque cible nommée ; « Résistance à la magie du Sang », « Vulnérabilité à la magie de la
//   Nécromancie » (tableau du Mort-Vivant) : +1, −1 ; une cellule sous la colonne « +1 cran de résistance » (tableau du Drakos) : +1 à ce qu'elle nomme ;
//   « Immunisé contre le poison et la maladie », « Totalement immunisé à l'aveuglement » : immunité (seules les cibles connues comptent : une magie ou
//   une altération d'état ; « la maladie » n'en est pas une).
// « Au choix parmi les autres » sous la colonne « +1 cran de résistance » (tableau du Drakos, ligne du Drakos orange) : un choix (`choix`) parmi les
// résistances des autres lignes de la colonne (décision R124 : « au choix entre les bonus de compétence listés des autres possiblité, pareil pour les
// résistance »), `autres` = ses crans ; lib/fiche-regles.mjs en tire les options, que la fiche fait choisir (personnage_resistance_choix).
// « Augmente de 1 cran la résistance à une magie au choix, à l'exception de l'arcane et de la corruption » (Ocultomancien, « Résilience ») et « 1 cran
// de résistance sur une magie aléatoire (sauf arcane et corruption) et son altération d'état » (Anansi d'Arcane) : une magie choisie ou tirée
// (`magies_au_choix` : ses crans, les magies que la phrase exclut, et `alteration` quand elle donne aussi le cran à l'altération d'état de cette magie),
// que la fiche fait choisir comme celle du Drakos orange (décision R137, « Q43: Oui » ; personnage_resistance_choix.magie_id) ; lib/fiche-regles.mjs en
// tire les options.
// Pas compté : une autre résistance au choix ou aléatoire (« une vulnérabilité magique », signalée par `choix`), ce qui ne dure
// qu'un temps (« pendant 2 tours », « le temps de la téléportation ») ou vise un autre que le personnage (« la cible », « un allié », « un
// adversaire », « le lanceur » d'un piège), une immunité partielle (« à 95% »). Pur, sans dépendance.

const plier = (texte) => String(texte ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’`]/g, "'");
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Une phrase qui parle de résistance, de vulnérabilité ou d'immunité du porteur. */
const PARLE_DE_RESISTANCE = /\bcrans?\b.*\b(?:resistance|vulnerabilite|faiblesse)\b|\bimmunise|^-?\s*(?:resistance|vulnerabilite|faiblesse) a\b/;
/** Ce qui ne vaut qu'un temps, vise un autre que le porteur, ou n'est que partiel : jamais compté. */
const PASSAGER_OU_AUTRUI = /\b(?:pendant|le temps|cible|allie|adversaire|ennemi|lanceur|piege)\b|\b\d+\s+tours?\b|\d+\s*%/;
/** Une résistance que le joueur choisit (ou que le hasard donne) : pas comptée, signalée. */
const AU_CHOIX = /\bau choix\b|\baleatoire\b|\bune (?:magie|vulnerabilite|alteration|resistance)\b/;
/**
 * Un cran à une magie choisie ou tirée, sauf celles que la phrase nomme (décision R137) : « augmente de 1 cran la resistance a une magie au choix, a
 * l'exception de l'arcane et de la corruption », « - 1 cran de resistance sur une magie aleatoire (sauf arcane et corruption) et son alteration d'etat »
 * (textes pliés) ; [, crans, « au choix » | « aleatoire », la suite].
 */
const MAGIE_AU_CHOIX = /^-?\s*(?:augmente de )?(\d+) crans? (?:de |la )resistance (?:a|sur) une magie (au choix|aleatoire)\b(.*)$/;

/**
 * Lecteur des résistances écrites dans un texte, pour un jeu de cibles connues.
 * @param {{ type: 'magie' | 'etat', id: string, nom: string }[]} cibles  magies et altérations d'état, sous chacune de leurs écritures
 *   (le nom, et les écritures que les importeurs ont rapprochées : « Gelé » et « Pétrification » pour les altérations « Gel » et « Pétrifié »)
 */
export function lecteurDeResistances(cibles) {
  const entrees = cibles
    .map((c) => ({ type: c.type, id: c.id, motif: new RegExp(`(?:^|[^a-z0-9])${echapper(plier(c.nom))}s?(?![a-z0-9])`) }))
    .filter((c, i, toutes) => toutes.findIndex((d) => d.motif.source === c.motif.source) === i);

  /** Cibles nommées dans un bout de texte, dans l'ordre du texte, sans doublon. */
  const nommees = (bout) => {
    const t = plier(bout);
    const trouvees = [];
    for (const c of entrees) {
      const m = c.motif.exec(t);
      if (m && !trouvees.some((d) => d.type === c.type && d.id === c.id)) trouvees.push({ type: c.type, id: c.id, position: m.index });
    }
    return trouvees.sort((a, b) => a.position - b.position).map(({ type, id }) => ({ type, id }));
  };

  /** Une phrase : ce qu'elle donne au porteur. */
  const phrase = (texte, lecture) => {
    const t = plier(texte).trim();
    if (!PARLE_DE_RESISTANCE.test(t) || PASSAGER_OU_AUTRUI.test(t)) return;
    // une magie au choix ou tirée, sauf celles que la phrase exclut (« à l'exception de… », « (sauf …) ») : un choix de la fiche (décision R137)
    const magie = MAGIE_AU_CHOIX.exec(t);
    if (magie) {
      const [, crans, mode, suite] = magie;
      const sauf = /(?:\bsauf\b|a l'exception d)([^)]*)/.exec(suite);
      (lecture.magies_au_choix ??= []).push({
        crans: Number(crans), sauf: sauf ? nommees(sauf[1]).filter((c) => c.type === 'magie').map((c) => c.id) : [],
        alteration: /\bet son alteration d'etat\b/.test(suite), aleatoire: mode === 'aleatoire',
      });
      return;
    }
    if (AU_CHOIX.test(t)) {
      lecture.choix = true;
      return;
    }
    const immunite = /immunise\w*\s+(?:totalement\s+)?(?:a|aux|au|contre)\b(.*)$/.exec(t);
    if (immunite) {
      for (const c of nommees(immunite[1])) lecture.effets.push({ ...c, immunite: true });
      return;
    }
    const nombre = /(\d+)\s+crans?\b/.exec(t);
    const sens = /vulnerabilite|faiblesse/.test(t) && !/resistance/.test(t) ? -1 : 1;
    const inverse = /\b(?:diminue|reduit|baisse|retire)\b/.test(t) ? -1 : 1;
    const crans = (nombre ? Number(nombre[1]) : 1) * sens * inverse;
    if (/magie innee/.test(t)) {
      const alterationSeule = /alterations? d'etat liee?s? a la magie innee/.test(t) && !/a la magie innee et/.test(t);
      if (!alterationSeule) lecture.effets.push({ type: 'magie_innee', id: null, crans });
      if (alterationSeule || /magie innee et (?:a )?son alteration d'etat/.test(t)) lecture.effets.push({ type: 'etat_magie_innee', id: null, crans });
      return;
    }
    const apres = /(?:resistance|vulnerabilite|faiblesse)\b(.*)$/.exec(t);
    for (const c of nommees(apres ? apres[1] : t)) lecture.effets.push({ ...c, crans });
  };

  /**
   * Ce que donne un texte : `effets` comptés ({ type: 'magie' | 'etat', id, crans } ou { …, immunite: true } ; `magie_innee` et `etat_magie_innee`,
   * sans id, désignent la magie innée du personnage et l'altération qui lui est liée), et `choix` quand une résistance est laissée au choix ; `autres`
   * (une cellule « Au choix parmi les autres », décision R124) : les crans de ce choix, à prendre parmi les autres lignes de la colonne ;
   * `magies_au_choix` (une magie au choix ou aléatoire, décision R137) : [{ crans, sauf (ids des magies exclues), alteration, aleatoire }], absent sinon.
   * `colonne` : en-tête de la colonne d'une cellule de tableau de dons ; sous « +1 cran de résistance », la cellule nomme la cible (ou un choix),
   * sous un autre en-tête elle se lit comme un texte.
   */
  return (texte, { colonne } = {}) => {
    const lecture = { effets: [], choix: false };
    const entete = colonne === undefined ? null : /([+\-−]?)\s*(\d+)\s+crans? de (resistance|vulnerabilite|faiblesse)/.exec(plier(colonne));
    if (entete) {
      const crans = Number(entete[2]) * (entete[1] && entete[1] !== '+' ? -1 : 1) * (entete[3] === 'resistance' ? 1 : -1);
      if (/^au choix parmi les autres\.?$/.test(plier(texte).trim())) Object.assign(lecture, { choix: true, autres: crans });
      else if (AU_CHOIX.test(plier(texte)) || /\bchoix\b/.test(plier(texte))) lecture.choix = true;
      else for (const c of nommees(texte)) lecture.effets.push({ ...c, crans });
      return lecture;
    }
    for (const morceau of String(texte ?? '').split(/\n|(?<=[a-zà-ÿ)"»])\.\s+/i)) phrase(morceau, lecture);
    return lecture;
  };
}
