// Les limites d'usage écrites dans le texte d'une action de la fiche (décision R173 : « Il faudrait lister toutes les actions utilisables […] Il faudrai
// pouvoir les sélectionner pour les "consommer" (et griser si plus utilisable). Un bouton "fin de combat" permet de remettre tous les compteur X/combat
// au maximum. Le compteur 1/ jour / semainee lui ne peut que remonter manuellement. ») : les effets d'accessoire (accessoire_effet.libelle), les
// capacités des armes élémentaires (arme_elementaire.capacite_texte), les effets de l'armure élémentaire (armure_elementaire_effet.texte) et le don de
// base de la race (race_onglet.don_base). Les dons de classe n'en ont pas besoin : leur limite est déjà lue dans leur type (capacite.limite_nombre,
// limite_periode : lib/classe-champs.mjs#analyserTypeDeDon) ; seul leur genre vient d'ici (genreDeLaPeriode). Lu au build par lib/fiche-regles.mjs ;
// test/limite-texte.test.mjs rejoue la lecture sur toute la base. Pur, sans dépendance.
//
// Rien n'est déduit au-delà de ce que le texte écrit et de la décision R173 :
//   - « N fois/combat », « N fois par combat », « une fois par combat », « une seule fois par combat » : un compteur que « Fin de combat » remet au
//     maximum (genre `combat`) ;
//   - « N fois » par jour, 24 h (« traité comme le jour »), semaine, mois, nuit, session ou partie, et « 1 semaine de recharge » (« un compteur d'une
//     utilisation par semaine ») : un compteur qui ne remonte qu'à la main (genre `manuel`) ;
//   - par tour, par N tours, par Mode Hyper, par personnage, allié, ennemi ou dialogue : un rappel en texte, sans compteur ni grisage (genre `rappel`) ;
//   - toute autre période (« X tour/combat », « 3 tours de recharge », « 2 CK/Case », « 10 munitions/Combat », « Coût 10 chakra ») : le texte
//     seulement (genre `texte`, jamais rendu par limiteEcrite : la fiche montre le texte tel qu'écrit).

/** Un texte sans accents, en minuscules, apostrophes droites, espaces simples. */
const plier = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

/** Les genres d'une limite (décision R173), dans l'ordre de la décision. */
export const GENRES_DE_LIMITE = Object.freeze(['combat', 'manuel', 'rappel', 'texte']);

/** Les périodes dont le compteur ne remonte qu'à la main (décision R173 : « jour, 24 h (traité comme le jour), semaine, mois, nuit, session et partie »). */
const PERIODES_A_LA_MAIN = new Set(['jour', '24h', 'semaine', 'mois', 'nuit', 'session', 'partie']);
/** Les périodes rappelées en texte (décision R173 : « 1 fois/tour », « 1 fois/2 tours », « par Mode Hyper », « 1 fois/personnage », allié, ennemi, dialogue). */
const PERIODES_RAPPELEES = new Set(['tour', 'mode hyper', 'personnage', 'allie', 'ennemi', 'dialogue']);

/**
 * Le genre d'une période écrite (décision R173) : 'combat' (« Fin de combat » remet le compteur au maximum), 'manuel' (le compteur ne remonte qu'à la
 * main), 'rappel' (un rappel en texte, sans compteur) ou 'texte' (illisible : le texte seulement). « 24 h » est le jour ; « 2 tours », un rappel.
 */
export function genreDeLaPeriode(periode) {
  const p = plier(periode).replace(/^(\d+) ?h$/, '$1h');
  if (p === 'combat') return 'combat';
  if (PERIODES_A_LA_MAIN.has(p)) return 'manuel';
  if (PERIODES_RAPPELEES.has(p) || /^\d+ tours$/.test(p)) return 'rappel';
  return 'texte';
}

/** « N fois » (ou « une fois », « une seule fois ») « / » ou « par » une période que la décision R173 range. */
const FOIS = /(?:^|[^\p{L}\d])(\d+|une(?: seule)?) fois ?(?:\/|par ) ?(combat|jour|24 ?h|semaine|mois|nuit|session|partie|\d+ tours|tour|mode hyper|personnage|allie|ennemi|dialogue)(?![\p{L}\d])/u;

/**
 * La limite d'usage qu'écrit un texte (décision R173) : { nombre, periode, genre } — `periode` telle que la fiche la nomme (« combat », « jour »,
 * « 24h », « semaine »…, sans accent), `genre` celui de genreDeLaPeriode ; « 1 semaine de recharge » : une utilisation par semaine (« Compteur manuel
 * 1/semaine ») ; « se recharge toutes les 24h » : une utilisation par 24 h. null quand le texte n'en écrit pas (une action sans limite écrite : sans
 * compteur, jamais grisée).
 */
export function limiteEcrite(texte) {
  const t = plier(texte);
  const m = FOIS.exec(t);
  if (m) {
    const periode = m[2].replace(/^24 ?h$/, '24h');
    return { nombre: /^\d+$/.test(m[1]) ? Number(m[1]) : 1, periode, genre: genreDeLaPeriode(periode) };
  }
  if (/(?:^|[^\p{L}\d])1 semaine de recharge(?![\p{L}\d])/u.test(t)) return { nombre: 1, periode: 'semaine', genre: 'manuel' };
  if (/\bse recharge toutes les 24 ?h\b/.test(t)) return { nombre: 1, periode: '24h', genre: 'manuel' };
  return null;
}

/** Vrai quand l'effet écrit que l'objet se brise à l'usage (« l'objet se brise après », « l'objet est brisé après », « L'objet est brisé. ») : R173. */
export const seBriseEcrit = (texte) => /\bl'objet (?:se brise|est brise)\b/.test(plier(texte));

/**
 * Le type d'action qu'écrit un texte entre parenthèses (décision R173 : les effets « (Action) », « (Réaction) » et, réponse du propriétaire à Q79
 * (« Deviennent des actions »), « (actif) » de l'armure élémentaire ; le don de base « (Action 3 fois/jour) ») : 'action', 'reaction', 'actif', ou null
 * (rien d'écrit).
 */
export function typeDActionEcrit(texte) {
  const m = /\((action|reaction|actif)(?![\p{L}\d])/u.exec(plier(texte));
  return m ? m[1] : null;
}
