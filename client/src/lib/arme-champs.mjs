// Champs de l'onglet « Armes » du classeur « Ressources et Craft » et ce que la base en tire (tables arme, arme_degats, arme_prerequis,
// materiau_arme, amelioration_equipement, amelioration_total) : les découpages de l'importeur, réécrits ici pour l'édition depuis le site de dev
// (client/serveur/edition.mjs) et pour l'onglet Armes de /ressources/equipement/ (demande du propriétaire : un tableau par famille, les colonnes
// Dégâts, Type de dégâts, Durabilité, Effets supplémentaires et Origine tirées de l'effet). Un test les rejoue sur toutes les armes, tous les
// matériaux et toutes les améliorations d'arme de la base : ils doivent redonner exactement les colonnes typées et les tables de détail en place
// (test/arme-champs.test.mjs).
//
// L'effet d'une arme est une suite de clauses séparées par des virgules ou des retours à la ligne. Une clause qui n'a pas exactement la forme attendue
// n'est pas interprétée (« +4 dégâts estoc » n'est PAS un bonus de dégâts : il ne vaut que pour l'estoc). Effet à plusieurs modes (« Ouvert = … » /
// « Fermé = … », « Une main = … » / « Deux mains = … ») : une valeur n'est retenue que si TOUS les modes la donnent (data/schema.sql, table arme).
// « Effets supplémentaires » (demande du propriétaire : « tous les autres effets du tableau effet de l'excel qui ne sont pas extraits ») : l'effet sans
// les clauses que la page montre dans une autre colonne (types de dégâts, dé, bonus de dégâts, portée, solidité, origine) ; les minimums de
// caractéristique, « ignore N AP » et la recharge n'ont pas de colonne : ils y restent, tels qu'écrits.
// Fonctions pures, sans dépendance (sauf text.mjs) : partagées par le service, les gabarits et le rendu du mode modification (lib/edition-rendu.mjs).
import { normalize } from './text.mjs';

/** Types de dégâts (table arme_degats), dans l'ordre où la page les écrit. */
export const TYPES_DE_DEGATS = ['taille', 'estoc', 'frappe'];
export const LIBELLES_DES_DEGATS = { taille: 'Taille', estoc: 'Estoc', frappe: 'Frappe' };

/** Mains d'une arme (arme.mains) : la mention entre parenthèses de la cellule Nom. */
export const MAINS = [
  { valeur: 'une', libelle: 'une main' },
  { valeur: 'deux', libelle: 'deux mains' },
  { valeur: 'une_ou_deux', libelle: 'une ou deux mains' },
];

/**
 * Compétence d'une arme (demande du propriétaire, décision R48, corrigée le 2026-10-13 : « Il y a bien une catégorie "Arc" […] Renomme également
 * "précision" en "Arbalète" ») : la 2ᵉ ligne de la case Catégorie de l'onglet (arme.competence_brut) écrit une ou deux compétences de la table `competence` ;
 * la pastille prend la couleur de la caractéristique de chacune (Arme Lourde et Arc : Force, Arme Légère : Agilité, Arbalète : Perception), en dégradé
 * pour deux. Les ids, noms et caractéristiques sont ceux de la base (test/arme-champs.test.mjs).
 */
export const COMPETENCES_D_ARME = {
  'arme-lourde': { libelle: 'Lourde', nom: 'Arme Lourde', caracteristique_id: 'force' },
  'arme-legere': { libelle: 'Légère', nom: 'Arme Légère', caracteristique_id: 'agilite' },
  arc: { libelle: 'Arc', nom: 'Arc', caracteristique_id: 'force' },
  arbalete: { libelle: 'Arbalète', nom: 'Arbalète', caracteristique_id: 'perception' },
};

/** Compétences de chaque écriture de l'onglet (décision R48) : « Arc » (case rouge) est l'Arc seul, « Arc / Arme Légère » (case jaune) l'Arc et l'Arme Légère. */
export const COMPETENCES_PAR_ECRITURE = {
  'Arme Lourde': ['arme-lourde'],
  'Arme Légère': ['arme-legere'],
  'Arme Lourde/Légère': ['arme-lourde', 'arme-legere'],
  Arc: ['arc'],
  'Arc / Arme Légère': ['arc', 'arme-legere'],
  Arbalète: ['arbalete'],
};

/** Écritures de la compétence d'une arme (arme.competence_brut), telles que l'onglet les écrit : la liste du champ modifiable et l'ordre de la légende. */
export const ECRITURES_DE_COMPETENCE = Object.keys(COMPETENCES_PAR_ECRITURE);

/**
 * Compétence d'une arme en pastilles : [{ id, libelle, nom, caracteristique_id }] d'après l'écriture de l'onglet (décision R48) ; vide pour une écriture
 * inconnue.
 */
export function competencesDArme(competenceBrut) {
  const ids = COMPETENCES_PAR_ECRITURE[String(competenceBrut ?? '').trim()] ?? [];
  return ids.map((id) => ({ id, ...COMPETENCES_D_ARME[id] }));
}

// ---------------------------------------------------------------------------------------------------------------------------------------- nom, catégorie, coût

const MENTION_DE_MAINS = /\s*\((une ou deux mains|deux mains|une main)\)\s*$/i;
const MAINS_DE_MENTION = { 'une main': 'une', 'deux mains': 'deux', 'une ou deux mains': 'une_ou_deux' };

/** Cellule Nom → { nom, mains } : « Flamberge⏎(deux mains) » → Flamberge, 'deux' ; « Arbalète de poing (une main) » → 'une'. */
export function decouperNomDArme(nomBrut) {
  const texte = String(nomBrut ?? '');
  const m = MENTION_DE_MAINS.exec(texte);
  return { nom: (m ? texte.slice(0, m.index) : texte).trim(), mains: m ? MAINS_DE_MENTION[m[1].toLowerCase()] : null };
}

/** La cellule Nom d'une arme modifiée depuis le site : le nom, et la mention de mains sur la ligne suivante (forme la plus courante de l'onglet). */
export function nomBrutDArme(nom, mains) {
  const mention = MAINS.find((m) => m.valeur === mains)?.libelle;
  return mention ? `${nom}\n(${mention})` : nom;
}

/** Cellule Catégorie → { type_brut, competence_brut } : « Épée⏎Arme Lourde » → « Épée », « Arme Lourde ». */
export function decouperCategorieDArme(categorieBrut) {
  const [type, ...reste] = String(categorieBrut ?? '').split('\n');
  return { type_brut: type.trim(), competence_brut: reste.join(' ').trim() || null };
}

/** Coût d'une arme : N de « N Ro » (arme.cout_ro) ; null si le coût n'a pas cette forme. */
export function coutEnRo(coutBrut) {
  const m = /^\s*(\d+)\s*Ro\s*$/i.exec(String(coutBrut ?? ''));
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------- effet

/** Libellé d'un mode en tête de ligne (« Une main = », « Fermé = ») : quelques mots sans ponctuation (« À l'assaut ! : … = » n'en est pas un). */
const MODE = /^\s*([\p{L} ]{2,20}?)\s*=\s*/u;

/** Une clause, telle que comparée : sans espaces de bord ni point final, espaces multiples réduits. */
const clauseNette = (c) => c.replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();

const RE = {
  types: /^(?:dégâts?\s+(?:de\s+|d['’]\s*)?)?((?:taille|estoc|frappe)(?:\s*\/\s*(?:taille|estoc|frappe))*)$/i,
  de: /^(?:tape dans le\s+(D\d+)|(D\d+)\s+au lieu du\s+D\d+)$/i,
  bonus: /^([+-]\d+)\s*dégâts?$/i,
  porteeAvant: /^(\d+)\s*-\s*(\d+)\s+portée$/i,
  porteeApres: /^portée\s+(\d+)\s*-\s*(\d+)$/i,
  porteeSeule: /^portée\s+(\d+)$/i,
  porteeAuLieu: /^la portée est de (\d+)\s*-\s*(\d+) au lieu de (\d+)\s*-\s*(\d+)$/i,
  ignore: /^ignore\s+(\d+)\s*(?:AP|PA)$/i,
  recharge: /^recharge\s+(très longue|longue)$/i,
  solidite: /^(\d+) seul (?:cran|point) de solidité$/i,
  soliditeDelta: /^([+-]\d+) crans? de solidité$/i,
  provenance: /^(Origine|Facture)\s+(.+)$/,
  prerequis: /^(\d+) (?:de |d['’])(.+?) (minimum|obligatoire|nécessaire)(?: pour une main)?$/i,
};

/** Ce qu'une clause donne, d'après sa forme ({ genre, valeur }), ou null : une clause qui n'a pas une des formes reconnues reste du texte. */
function lireClause(brute, caracteristiques) {
  const c = clauseNette(brute);
  let m;
  if ((m = RE.types.exec(c))) return { genre: 'types', valeur: m[1].split('/').map((t) => t.trim().toLowerCase()), affichee: true };
  if ((m = RE.de.exec(c))) return { genre: 'de', valeur: (m[1] ?? m[2]).toUpperCase(), affichee: true };
  if ((m = RE.bonus.exec(c))) return { genre: 'bonus', valeur: Number(m[1]), affichee: true };
  // la portée est une colonne de la page (demande du propriétaire : « la portée comme élément de l'arme (1 par défaut) », décision R50)
  if ((m = RE.porteeAuLieu.exec(c))) return { genre: 'porteeAuLieu', valeur: [Number(m[1]), Number(m[2])], remplace: [Number(m[3]), Number(m[4])], affichee: true };
  if ((m = RE.porteeAvant.exec(c) ?? RE.porteeApres.exec(c))) return { genre: 'portee', valeur: [Number(m[1]), Number(m[2])], affichee: true };
  if ((m = RE.porteeSeule.exec(c))) return { genre: 'portee', valeur: [Number(m[1]), Number(m[1])], affichee: true };
  if ((m = RE.ignore.exec(c))) return { genre: 'ignore', valeur: Number(m[1]) };
  if ((m = RE.recharge.exec(c))) return { genre: 'recharge', valeur: m[1].toLowerCase() === 'longue' ? 'longue' : 'tres_longue' };
  if ((m = RE.solidite.exec(c))) return { genre: 'solidite', valeur: Number(m[1]), affichee: true };
  if ((m = RE.soliditeDelta.exec(c))) return { genre: 'soliditeDelta', valeur: Number(m[1]), affichee: true };
  if ((m = RE.provenance.exec(c))) return { genre: 'provenance', valeur: [m[1], m[2].trim()], affichee: true };
  if ((m = RE.prerequis.exec(c))) {
    const noms = m[2].split(/\s+et\s+(?:de\s+|d['’])?/i);
    const ids = noms.map((n) => caracteristiques.find((k) => normalize(k.nom) === normalize(n))?.id);
    if (ids.every(Boolean)) {
      const exigence = m[3].toLowerCase();
      return { genre: 'prerequis', valeur: ids.map((id) => ({ caracteristique_id: id, minimum: Number(m[1]), exigence, texte: c })) };
    }
  }
  return null;
}

/** Caractéristiques connues par défaut (table caracteristique) : pour les minimums « 3 de Force et Agilité minimum ». */
const CARACTERISTIQUES = [
  { id: 'agilite', nom: 'Agilité' }, { id: 'force', nom: 'Force' }, { id: 'intelligence', nom: 'Intelligence' },
  { id: 'perception', nom: 'Perception' }, { id: 'social', nom: 'Social' }, { id: 'volonte', nom: 'Volonté' },
];

/**
 * L'effet d'une arme découpé : ses lignes, chacune avec son mode (« Une main », null hors mode) et ses clauses (texte tel qu'écrit, lecture).
 * @returns {{ mode: string | null, prefixe: string, clauses: { texte: string, lu: object | null }[] }[]}
 */
function lignesDEffet(effet, caracteristiques = CARACTERISTIQUES) {
  return String(effet ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((ligne) => {
      const m = MODE.exec(ligne);
      const mode = m ? m[1].trim() : null;
      const reste = m ? ligne.slice(m[0].length) : ligne;
      const clauses = reste.split(',').map((t) => ({ texte: t, lu: t.trim() ? lireClause(t, caracteristiques) : null }));
      return { mode, prefixe: m ? `${mode} = ` : '', clauses };
    });
}

/**
 * Les colonnes typées de l'arme, ses types de dégâts (arme_degats) et ses minimums de caractéristique (arme_prerequis), d'après son effet, et les
 * effets supplémentaires (le texte sans les clauses que la page montre ailleurs). Une valeur écrite dans des lignes à modes n'est retenue que si chaque
 * mode la donne ; la première clause de chaque sorte compte (la portée « la portée est de A-B au lieu de C-D » l'emporte sur une portée écrite avant).
 */
export function analyserEffetDArme(effet, caracteristiques = CARACTERISTIQUES) {
  const lignes = lignesDEffet(effet, caracteristiques);
  const avecMode = lignes.filter((l) => l.mode);
  // groupes : un par mode (s'il y en a au moins deux), plus les lignes sans mode, communes à tous
  const communes = lignes.filter((l) => !l.mode || avecMode.length < 2);
  const groupes = avecMode.length >= 2 ? avecMode.map((l) => [...communes, l]) : [communes];
  const premiere = (groupe, genre) => groupe.flatMap((l) => l.clauses).find((c) => c.lu?.genre === genre)?.lu.valeur;
  // les minimums : toutes les clauses (« 2 de Force minimum, 4 d'Agilité minimum »)
  const toutes = (groupe, genre) => {
    const v = groupe.flatMap((l) => l.clauses).filter((c) => c.lu?.genre === genre).flatMap((c) => c.lu.valeur);
    return v.length ? v : undefined;
  };
  const retenue = (genre) => {
    const valeurs = groupes.map((g) => (genre === 'prerequis' ? toutes(g, genre) : premiere(g, genre)));
    const texte = JSON.stringify(valeurs[0]);
    return valeurs[0] !== undefined && valeurs.every((v) => JSON.stringify(v) === texte) ? valeurs[0] : undefined;
  };
  const types = retenue('types');
  const de = retenue('de');
  const bonus = retenue('bonus');
  const portee = retenue('porteeAuLieu') ?? retenue('portee');
  const solidite = retenue('solidite');
  const delta = retenue('soliditeDelta');
  const provenance = retenue('provenance');
  const ignore = retenue('ignore');
  const recharge = retenue('recharge');
  // minimums : ceux de chaque mode, s'ils sont les mêmes ; une caractéristique n'a qu'une ligne (la première)
  const prerequis = [];
  for (const p of retenue('prerequis') ?? []) if (!prerequis.some((q) => q.caracteristique_id === p.caracteristique_id)) prerequis.push(p);
  // effets supplémentaires : chaque ligne sans les clauses montrées dans une colonne de la page — celles qui donnent la valeur retenue (une clause qui
  // en contredit une autre, « portée 1-2, Portée 1-3 », reste écrite), et la portée qu'une « portée est de A-B au lieu de C-D » remplace
  const auLieu = retenue('porteeAuLieu');
  const retenues = { types, de, bonus, portee: auLieu ?? retenue('portee'), porteeAuLieu: auLieu, solidite, soliditeDelta: delta, provenance };
  const remplacee = groupes.flatMap((g) => g.flatMap((l) => l.clauses)).find((c) => c.lu?.genre === 'porteeAuLieu')?.lu.remplace;
  const montree = (lu) => {
    if (!lu?.affichee) return false;
    const v = JSON.stringify(lu.valeur);
    if (lu.genre === 'portee' && auLieu) return v === JSON.stringify(remplacee);
    return retenues[lu.genre] !== undefined && v === JSON.stringify(retenues[lu.genre]);
  };
  const autres = lignes
    .map((l) => {
      const restent = l.clauses.filter((c) => c.texte.trim() && !montree(c.lu)).map((c) => c.texte.trim());
      return restent.length ? `${l.prefixe}${restent.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return {
    de: de ?? null,
    bonus_degats: bonus ?? null,
    portee_min: portee?.[0] ?? null,
    portee_max: portee?.[1] ?? null,
    ignore_ap: ignore ?? null,
    recharge: recharge ?? null,
    solidite_fixee: solidite ?? null,
    solidite_delta: delta ?? null,
    provenance_mot: provenance?.[0] ?? null,
    provenance: provenance?.[1] ?? null,
    degats: types ? TYPES_DE_DEGATS.filter((t) => types.includes(t)) : [],
    prerequis,
    autres,
  };
}

/** Le dé de l'arme et sa provenance : celui de l'effet (« D8 au lieu du D10 », « tape dans le D6 »), sinon celui de son type ; null pour le Pugilat. */
function deDeLArme(deDeLEffet, deDuType) {
  const de = deDeLEffet ?? deDuType ?? null;
  return { de, de_faces: de ? Number(de.slice(1)) : null, de_source: deDeLEffet ? 'effet' : de ? 'type' : null };
}

/**
 * Les colonnes de la ligne `arme` qui se tirent de ses cellules (pour une arme modifiée depuis le site) : cout_ro et les colonnes typées de l'effet ;
 * nom_brut (nom, mains) et categorie_brut (type, catégorie) seulement quand l'une de leurs colonnes change (`avant` : la ligne d'avant ; sans elle, ils
 * sont refaits) : la cellule de l'onglet reste telle qu'écrite (« Arbalète⏎ (une ou deux mains) ») tant qu'on n'y touche pas.
 * `type` : la ligne arme_type de l'arme ({ nom, de }).
 */
export function colonnesDeLArme(ligne, type, caracteristiques = CARACTERISTIQUES, avant = null) {
  const e = analyserEffetDArme(ligne.effet, caracteristiques);
  const typeEcrit = decouperCategorieDArme(ligne.categorie_brut).type_brut;
  const change = (...colonnes) => !avant || colonnes.some((c) => (avant[c] ?? null) !== (ligne[c] ?? null));
  return {
    ...(change('nom', 'mains') ? { nom_brut: nomBrutDArme(ligne.nom, ligne.mains) } : {}),
    ...(change('type_id', 'competence_brut')
      ? { categorie_brut: [normalize(typeEcrit) === normalize(type.nom) ? typeEcrit : type.nom, ligne.competence_brut].filter(Boolean).join('\n') }
      : {}),
    cout_ro: coutEnRo(ligne.cout_brut),
    ...deDeLArme(e.de, type.de),
    portee_min: e.portee_min,
    portee_max: e.portee_max,
    bonus_degats: e.bonus_degats,
    ignore_ap: e.ignore_ap,
    recharge: e.recharge,
    solidite_fixee: e.solidite_fixee,
    solidite_delta: e.solidite_delta,
    provenance_mot: e.provenance_mot,
    provenance: e.provenance,
  };
}

/**
 * Portée de l'arme (décision R50 : « la portée comme élément de l'arme (1 par défaut) ») : celle de son effet (« 2 - 10 portée » → « 2-10 », « portée 2 »
 * → « 2 »), sinon 1.
 */
export const porteeDeLArme = (arme) =>
  arme.portee_min === null || arme.portee_min === undefined ? '1' : arme.portee_min === arme.portee_max ? String(arme.portee_min) : `${arme.portee_min}-${arme.portee_max}`;

/**
 * Durabilité de l'arme nue, en crans : « 1 seul cran » de son effet, sinon la base de l'onglet (2) corrigée de « ±N cran » (vue v_arme) ; jamais moins de
 * 1 (décision R51).
 */
export const durabiliteDeLArme = (arme, base) => Math.max(1, arme.solidite_fixee ?? base + (arme.solidite_delta ?? 0));

// ---------------------------------------------------------------------------------------------------------------------------------- matériaux, améliorations

/** Prix d'un matériau en RO (demande du propriétaire : « Ignore le prix en RF, il n'est plus d'actualité ») : N de « … N RO » ; null sans RO. */
export function prixEnRo(prixBrut) {
  const m = /(\d+(?:[.,]\d+)?)\s*RO\b/i.exec(String(prixBrut ?? ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** materiau_arme.prix_rf, comme l'importeur : RO × 100 ; le RF seul s'il est le seul écrit ; null quand RF et RO sont écrits et se contredisent. */
export function prixEnRf(prixBrut) {
  const texte = String(prixBrut ?? '');
  const rf = /(\d+)\s*RF\b/i.exec(texte);
  const ro = prixEnRo(texte);
  if (rf && ro !== null) return Number(rf[1]) === ro * 100 ? Number(rf[1]) : null;
  if (rf) return Number(rf[1]);
  return ro === null ? null : Math.round(ro * 100);
}

/** Effet d'un matériau d'arme → { bonus_degats, cran_solidite, effet_secondaire } (« Dégâts +N pour l'arme », « ±N cran de solidité », le reste). */
export function analyserEffetDeMateriau(effetBrut) {
  let bonus = null;
  let cran = null;
  const autres = [];
  for (const brute of String(effetBrut ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const l = brute.trim();
    let m;
    if (!l || /^rien de particulier$/i.test(l)) continue;
    if (bonus === null && (m = /^Dégâts\s*([+-]\d+)\s*pour l['’]arme$/i.exec(l))) bonus = Number(m[1]);
    else if (cran === null && (m = /^([+-]\d+) crans? de solidité$/i.exec(l))) cran = Number(m[1]);
    else autres.push(l);
  }
  return { bonus_degats: bonus, cran_solidite: cran, effet_secondaire: autres.length ? autres.join('\n') : null };
}

/** Coût d'une amélioration → { cout_ro, cout_materiaux } : « 1 Matériel + 50 RO » → 50 RO et 1 matériau (null quand non écrit). */
export function analyserCoutDAmelioration(coutBrut) {
  const texte = String(coutBrut ?? '');
  const ro = /(\d+)\s*RO\b/i.exec(texte);
  const mat = /(\d+)\s*Mat[ée]ri(?:el|au)(?:x|s)?\b/i.exec(texte);
  return { cout_ro: ro ? Number(ro[1]) : null, cout_materiaux: mat ? Number(mat[1]) : null };
}

/** Effet d'une amélioration d'arme → { bonus_degats, bonus_cran } : « +10 dégâts, +1 cran de solidité ». */
export function analyserEffetDAmelioration(effetBrut) {
  const texte = String(effetBrut ?? '');
  const degats = /([+-]\d+)\s*dégâts?\b/i.exec(texte);
  const cran = /([+-]\d+)\s*crans? de solidité/i.exec(texte);
  return { bonus_degats: degats ? Number(degats[1]) : null, bonus_cran: cran ? Number(cran[1]) : null };
}

/** La ligne « TOTAL » du tableau des améliorations d'arme, refaite depuis les niveaux : « 5 matériaux + 1520 RO ». */
export function totalDesAmeliorations(niveaux) {
  const ro = niveaux.reduce((s, n) => s + (n.cout_ro ?? 0), 0);
  const mat = niveaux.reduce((s, n) => s + (n.cout_materiaux ?? 0), 0);
  return `${mat} matériau${mat > 1 ? 'x' : ''} + ${ro} RO`;
}
