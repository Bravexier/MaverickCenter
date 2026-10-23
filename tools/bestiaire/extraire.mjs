// Extracteur du Google Doc « Bestiaire 2.0 » (copie du propriétaire, 2026-10-11 : sources/sources.json) : l'export texte du doc
// (sources/raw/bestiaire-2-0.txt, « Télécharger › Texte brut » ou connecteur Google Drive) -> les lignes des tables des monstres (data/schema.sql,
// section 8 bis). Fonctions pures, sans dépendance hors du dépôt ; le test client/test/bestiaire-extraction.test.mjs rejoue l'extraction et la compare à la base.
//
//   node tools/bestiaire/extraire.mjs [--source sources/raw/bestiaire-2-0.txt] --sql     -> les INSERT de la migration (sortie standard)
//   node tools/bestiaire/extraire.mjs --bilan                                           -> effectifs et points relevés
//
// Rien n'est déduit : chaque ligne cite sa place dans le doc (source_ref) et garde le texte tel qu'écrit. Une carte de monstre est découpée en rubriques
// (Santé, Dégâts, Défense, Vitesse, Caractéristiques, Compétences, Vulnérabilités, Résistances, Immunités, Capacités, Tactique…) gardées en entier dans
// `monstre_rubrique` ; les valeurs typées (santé, armures, vitesses, F.P.V.S.I.A., attaques, capacités, cibles des vulnérabilités…) n'en sont tirées que
// quand l'écriture est sans ambiguïté (sinon NULL, le texte reste). Seule exception, les capacités (décisions R66 à R69) : chaque capacité écrite sur une
// carte est rangée sous une capacité commune par le registre tools/bestiaire/capacites.json (monstre_capacite_commune, monstre_capacite,
// monstre_capacite_valeur), et la rubrique « Capacité(s) » ne garde que sa place (texte vide).
// Transformations : les graphies que la base a déjà corrigées partout et les multiplicateurs de la décision R148 (CORRECTIONS) ; et le nom d'une carte, écrit en capitales dans le doc (« AMBLYPYGE DE BRAI ») ; `nom` le remet en minuscules en gardant la
// casse que le doc donne ailleurs à chaque mot (titre de l'espèce, puis texte courant : « Amblypyge de brai », « Élémentaire de l'Eau ») et les chiffres romains
// en capitales (« Golem de fer II ») ; `nom_brut` garde l'original.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalize } from '../../client/src/lib/text.mjs';
import { bornes, categorieDe, emplacements, lieux, SENS_DEFENSE, valeursDeLaCarte } from '../../client/src/lib/monstre-champs.mjs';

export const DOCUMENT = 'Bestiaire 2.0';

/** Rubriques d'une carte, dans l'ordre où le doc les écrit d'habitude : clé (colonne `rubrique`), reconnaissance de l'en-tête. */
export const RUBRIQUES = [
  ['attributs', /^(\[EP[^\]]*\]\s*)?Santé\s*:/],
  ['sante', /^Santé\s*$/],
  ['chakra', /^Chakra\s*$/],
  ['barriere', /^Barrière\s*$/],
  ['degats', /^Dégâts\s*$/],
  ['defense', /^Défense\s*$/],
  ['vitesse', /^Vitesse\s*$/],
  ['caracteristiques', /^Caractéristiques\s*\(F\.P\.V\.S\.I\.A\.\)/],
  ['competences', /^Compétence\(s\) secondaire\(s\)/],
  ['grande_vulnerabilite', /^Grande\(s\s*\)\s*(vulnérabilité|faiblesse)\(s\)/i],
  ['vulnerabilite', /^Vulnérabilité\(s\)\s*Dégâts/i],
  // R148 : depuis 0073, plus aucune ligne du doc n'y tombe (les CORRECTIONS ancrées la mènent en grande_resistance) ; repli gardé, SENS_DEFENSE l'admet.
  ['double_resistance', /^Double\(s\)\s*Résistance\(s\)/i],
  ['grande_resistance', /^Grande\(s\)\s*résistance\(s\)/i],
  ['resistance', /^Résistance\(s\)\s*Dégâts/i],
  ['immunite', /^Immunité\(s\)/i],
  ['reflexion', /^Réflexion\(s\)/i],
  ['capacites', /^Capacité\(s\)\s*$/],
  ['tactique', /^TACTIQUE COMBAT\s*$/],
];

export { SENS_DEFENSE };

const SEPARATEUR = /^_{6,}\s*$/;
const TITRE_ESPECE = /^([^\t*\s].*?)\s*\((EP[^)]*)\)\s*$/;
// Un brouillon du doc, « Réanimé (EP5) (a continuer) », « Vouivre squelette (EP8) (a refaire) » : son bloc (description, cartes) n'est pas repris, mais son
// titre borne l'espèce qui le précède (décision R58 du propriétaire : « Oui » à « Faut-il les retirer ? »)
const TITRE_BROUILLON = /^([^\t*\s].*?)\s*\((EP[^)]*)\)\s*\([aà] (?:refaire|continuer)\)\s*$/i;
// Un groupe d'espèces, « Ottar (explication) » : son nom et sa description (les paragraphes qui suivent, jusqu'au trait) ; ses espèces, celles qui le suivent
// et dont le nom le contient (décision R64 du propriétaire : « regrouper tous les Ottar (et le presqu'Ottar) sous la même espèce d'Ottar, dont la
// description était auparavant perdue dans la mauvaise fiche »). Son titre ne borne pas l'espèce qui le précède : à l'import, le texte reste aussi dans la
// tactique de l'Os du blizzard, d'où le propriétaire l'a retiré sur le site de dev.
const TITRE_GROUPE = /^([^\t*\s].*?)\s*\(explication\)\s*$/i;
const LETTRE = /^[A-Z]\s*$/;
const CARTE = /Créature échelle/;
const DEBUT_GLOSSAIRE = /^GLOSSAIRE BUTIN\s*$/;
const DEBUT_BUTIN = /^(BUTIN\s*$|Score \(3d100\))/;
const VARIABLE = /^Ses stats varient selon son échelle de puissance\.?\s*$/;
/** Ligne toute en capitales (titre de bloc après les cartes : « POTENTIEL ILLIMITÉ », « SANG ») : au moins trois lettres, aucune minuscule. */
const TITRE_DE_BLOC = (l) => /\p{Lu}.*\p{Lu}.*\p{Lu}/u.test(l) && !/\p{Ll}/u.test(l) && !CARTE.test(l) && !/^TACTIQUE COMBAT/.test(l);

/**
 * Corrections déjà décidées pour toute la base (une graphie corrigée l'est partout où elle est écrite : skill base-orthographe) et que le doc écrit
 * encore à l'ancienne : [motif, remplacement, origine]. Rien d'autre n'est corrigé ; sources/raw garde le texte du doc. Les quatre du butin
 * (décision R57 : « Corrige et rapproche les. Les fautes de frappe ça arrive. ») sont écrites une seule fois dans le doc. Les quatre dernières (décision
 * R148 : « Oui là aussi c'est x3 et pas 4... », « Pareil remplace double résistance par Grande résistance », « Oui x4 aussi ») ne touchent qu'une ligne
 * entière, compactée : un titre de résistance ou de vulnérabilité (15, 22 et 10 lignes du doc), « Sensibilité(s) Dégâts x8 » (3) ; seul le
 * multiplicateur change (et « Double » -> « Grande »), et la correction passe avant le classement de la rubrique (RUBRIQUES, sur le titre corrigé).
 */
export const CORRECTIONS = [
  [/le Démon d'Eau Noire/g, 'Eaunoire', 'décision R21, migration 0012-eaunoire'],
  [/\bOccultomancien/g, 'Ocultomancien', 'graphie majoritaire, migration 0006-orthographe-noms'],
  [/([Pp])urée de poix/g, '$1urée de pois', 'migration 0006-orthographe-noms'],
  [/\bect\b/g, 'etc', 'migration 0005-orthographe-base'],
  // le glossaire écrit « Petit os » (15 fois ailleurs) ; une case du Karn « Petite os »
  [/\bPetite os\b/g, 'Petit os', 'décision R57, migration 0039-bestiaire-reponses'],
  // les trois cases du Radrak frénétique écrivent « Peau de radrak », le glossaire « Peau du radrak » (son identifiant reste peau-du-radrak)
  [/\bPeau du radrak\b/g, 'Peau de radrak', 'décision R57, migration 0039-bestiaire-reponses'],
  // la seule case qui met la quantité devant (Squelette) : « Os moyen x 4 », comme les autres
  [/\b4 os moyen\b/g, 'Os moyen x 4', 'décision R57, migration 0039-bestiaire-reponses'],
  // la chair du blob blanc (« blobs argents ») : « Gelée blanche » dans le glossaire et le doc « Alchimie », « Gelée argent » nulle part ailleurs
  [/\bGelée argent\b/g, 'Gelée blanche', 'décision R57, migration 0039-bestiaire-reponses'],
  // les titres de Grande résistance en ÷3 (« Grande(s) Résistance(s) » et « Grande(s) résistance(s) », chaque casse gardée)
  [/^(Grande\(s\) [Rr]ésistance\(s\) Dégâts) ÷4$/, '$1 ÷3', 'décision R148, migration 0073-r148-titres-du-bestiaire'],
  // les titres de Grande vulnérabilité en x3 (« Vulnérabilité », « vulnérabilité », « faiblesse » et l'espace de « Grande(s )Vulnérabilité(s) » gardés)
  [/^(Grande\(s ?\) ?(?:[Vv]ulnérabilité|faiblesse)\(s\) Dégâts) x4$/, '$1 x3', 'décision R148, migration 0073-r148-titres-du-bestiaire'],
  // la Double résistance devient la Grande résistance, en ÷3 (« Dégâts/Effets » gardé) : la carte est rangée en grande_resistance (RUBRIQUES)
  [/^Double\(s\) (Résistance\(s\) Dégâts(?:\/Effets)?) ÷4$/, 'Grande(s) $1 ÷3', 'décision R148, migration 0073-r148-titres-du-bestiaire'],
  // la sensibilité des golems de verre I à III, x4 (compétences)
  [/^(Sensibilité\(s\) Dégâts) x8$/, '$1 x4', 'décision R148, migration 0073-r148-titres-du-bestiaire'],
];
/** Une ligne du doc, blancs de mise en page (espaces, insécables) réduits et corrections déjà décidées appliquées. */
export const compacter = (l) => CORRECTIONS.reduce((t, [motif, par]) => t.replace(motif, par), l.replace(/[ \u00a0]+/g, ' ').trim());
/** Lignes d'un passage -> texte : blancs de mise en page réduits, cellules de tableau (tabulation) sur leur ligne, paragraphes séparés par une ligne vide. */
function texteDe(lignes) {
  const sortie = [];
  let vide = false;
  for (const brute of lignes) {
    const l = compacter(brute.replace(/\t/g, ' '));
    if (!l) {
      vide = sortie.length > 0;
      continue;
    }
    if (vide) sortie.push('');
    sortie.push(l);
    vide = false;
  }
  return sortie.join('\n');
}

/** Référence d'une ligne du doc : « Bestiaire 2.0 › ligne 670 » (ligne de l'export texte, 1 = première). */
const ref = (i, j = i) => (j > i ? `${DOCUMENT} › lignes ${i + 1}-${j + 1}` : `${DOCUMENT} › ligne ${i + 1}`);

/** Casse d'un nom écrit en capitales, d'après les mots du titre de l'espèce puis du texte courant du doc (voir l'en-tête). */
function casseur(texte) {
  const vus = new Map();
  for (const m of texte.matchAll(/(?<=[\p{Ll},;:’'()«»“”"\-–] |[’'])(\p{L}[\p{L}\-]*)/gu)) {
    const mot = m[1];
    if (mot === mot.toUpperCase()) continue;
    const cle = mot.toLowerCase();
    const compte = vus.get(cle) ?? new Map();
    compte.set(mot, (compte.get(mot) ?? 0) + 1);
    vus.set(cle, compte);
  }
  const prefere = new Map([...vus].map(([cle, compte]) => [cle, [...compte].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]]));
  return (brut, titre) => {
    const duTitre = new Map(titre.split(/[\s’']+/).filter(Boolean).map((m) => [m.toLowerCase(), m]));
    const mots = brut.toLowerCase().split(/(\s+|[’'\-])/);
    const remis = mots.map((m) => (/^[ivx]+$/.test(m) ? m.toUpperCase() : /^\p{L}/u.test(m) ? (duTitre.get(m) ?? prefere.get(m) ?? m) : m)).join('');
    return remis.charAt(0).toLocaleUpperCase('fr') + remis.slice(1);
  };
}

/** Le registre des capacités communes (tools/bestiaire/capacites.json, décisions R66 à R69 ; voir son en-tête « _ »). */
export function lireRegistre(chemin = new URL('./capacites.json', import.meta.url)) {
  const { capacites, ecritures } = JSON.parse(readFileSync(chemin, 'utf8'));
  return { capacites, ecritures };
}

/** Contrôles du registre : identifiants, emplacements, valeurs et listes de sorts cohérents ; renvoie les écarts (vide = bon). */
export function ecartsDuRegistre({ capacites, ecritures }) {
  const ecarts = [];
  const parId = new Map();
  for (const c of capacites) {
    if (parId.has(c.id)) ecarts.push(`capacité ${c.id} : identifiant en double`);
    parId.set(c.id, c);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) ecarts.push(`capacité ${c.id} : identifiant mal formé`);
    if (!c.nom || !c.description) ecarts.push(`capacité ${c.id} : nom ou description vide`);
    if (/[{}]/.test(c.description.replace(/\{\d+\}/g, ''))) ecarts.push(`capacité ${c.id} : accolade hors d'un emplacement « {N} »`);
  }
  const vues = new Set();
  for (const e of ecritures) {
    const cle = `${e.nom}\u0000${e.texte}`;
    if (vues.has(cle)) ecarts.push(`écriture « ${e.nom} » en double`);
    vues.add(cle);
    if (!e.placements?.length) ecarts.push(`écriture « ${e.nom} » : aucun placement`);
    for (const p of e.placements ?? []) {
      const c = parId.get(p.capacite);
      if (!c) { ecarts.push(`écriture « ${e.nom} » : capacité ${p.capacite} inconnue`); continue; }
      const n = emplacements(c.description).length;
      for (const [k, v] of Object.entries(p.valeurs ?? {})) {
        if (!(Number(k) >= 1 && Number(k) <= n)) ecarts.push(`écriture « ${e.nom} » : emplacement ${k} absent de ${c.id}`);
        if (!Number.isInteger(v) || v < 0) ecarts.push(`écriture « ${e.nom} » : valeur ${v} invalide`);
        if (v === emplacements(c.description)[Number(k) - 1]) ecarts.push(`écriture « ${e.nom} » : valeur ${k} égale à la valeur commune (à ne pas écrire)`);
      }
      if (Boolean(p.sorts) !== Boolean(c.liste_de_sorts)) ecarts.push(`écriture « ${e.nom} » : liste de sorts ${p.sorts ? 'sur une capacité sans liste' : 'manquante'}`);
    }
  }
  const utilisees = new Set(ecritures.flatMap((e) => (e.placements ?? []).map((p) => p.capacite)));
  for (const c of capacites) if (!utilisees.has(c.id)) ecarts.push(`capacité ${c.id} : aucune écriture ne la place`);
  return ecarts;
}

/** Lignes du doc, sans BOM ni retours chariot. */
export const lignesDuDoc = (texte) => texte.replace(/^﻿/, '').replace(/\r/g, '').split('\n');

/** Cellules d'un tableau exporté en texte : une tabulation ouvre une cellule, une ligne sans tabulation continue la précédente. */
function cellules(lignes) {
  const sortie = [];
  for (const l of lignes) {
    if (l.startsWith('\t')) sortie.push([l.slice(1)]);
    else if (sortie.length) sortie.at(-1).push(l);
    else sortie.push([l]);
  }
  return sortie.map((c) => texteDe(c));
}

/** « Ennemi simple : 35 / Mini boss : 70 / Boss : 140 » -> { ennemi_simple, mini_boss, boss } */
function parCategorie(texte) {
  const valeurs = {};
  for (const m of texte.matchAll(/(Ennemi simple|Mini[- ]boss|Boss)\s*:\s*(\d+)/gi)) valeurs[categorieDe(m[1])] = Number(m[2]);
  return valeurs;
}

/** Introduction : les règles « qui marchent dans toutes les échelles », puis les deux tableaux par échelle de puissance (EP). */
function introduction(L) {
  // les puces avant le premier tableau (« EP | Règle carac/comp | Dégâts moyen »)
  const debutRegles = L.findIndex((l) => /^EP\s*$/.test(l));
  const regles = [];
  for (let i = 0; i < debutRegles; i++) {
    const m = L[i].match(/^\*\s+(.*\S)\s*$/);
    if (m) regles.push({ rang: regles.length + 1, texte: compacter(m[1]), source_ref: ref(i) });
  }
  const debutAttributs = L.findIndex((l) => /^Echelle de puissance\s*$/.test(l));
  const finAttributs = L.findIndex((l, i) => i > debutAttributs && /^Modèle\s/.test(l));
  const echelles = new Map();
  // Tableau 1 : EP | Règle carac/comp | Dégâts moyen
  const t1 = cellules(L.slice(debutRegles + 1, L.findIndex((l, i) => i > debutRegles && /^Voici le tableau des attributs/.test(l))));
  for (let k = 2; k + 2 < t1.length; k += 3) {
    const ep = Number(t1[k].match(/^EP\s*(\d+)$/)?.[1]);
    if (!ep) throw new Error(`tableau des règles par EP : cellule inattendue « ${t1[k]} »`);
    echelles.set(ep, { ep, regle_brut: t1[k + 1], degats_brut: t1[k + 2] });
  }
  // Tableau 2 : Echelle de puissance | Attributs moyens | Expérience reçu
  const t2 = cellules(L.slice(debutAttributs + 1, finAttributs));
  for (let k = 2; k + 2 < t2.length; k += 3) {
    const m = t2[k].match(/^(\d+)\s*\(Niveau\s*(\d+)\s*-\s*(\d+)\)$/s) ?? t2[k].replace(/\s+/g, ' ').match(/^(\d+) \(Niveau (\d+) ?- ?(\d+)\)$/);
    if (!m) throw new Error(`tableau des attributs par EP : cellule inattendue « ${t2[k]} »`);
    const e = echelles.get(Number(m[1]));
    const a = parCategorie(t2[k + 1]);
    const x = parCategorie(t2[k + 2]);
    Object.assign(e, {
      niveau_min: Number(m[2]),
      niveau_max: Number(m[3]),
      attributs_brut: t2[k + 1],
      xp_brut: t2[k + 2],
      attributs_ennemi_simple: a.ennemi_simple ?? null,
      attributs_mini_boss: a.mini_boss ?? null,
      attributs_boss: a.boss ?? null,
      xp_ennemi_simple: x.ennemi_simple ?? null,
      xp_mini_boss: x.mini_boss ?? null,
      xp_boss: x.boss ?? null,
      source_ref: `${ref(debutRegles, debutAttributs - 1)} ; ${ref(debutAttributs, finAttributs - 1)}`,
    });
  }
  return { regles, echelles: [...echelles.values()] };
}

/** Butin d'une espèce (tableau « Score (3d100) | Butin possible ») : une ligne par (tranche de score, catégorie) ; une cellule vide n'a pas de ligne. */
function butin(L, debut, fin) {
  const sortie = [];
  let tranche = null;
  let categorie = null;
  let rang = 0;
  const lignes = L.slice(debut, fin);
  let i = lignes.findIndex((l) => /^Score \(3d100\)/.test(l));
  if (i < 0) return sortie;
  // une note sous le tableau (« *Parmi Rouge, Jaune, Vert foncé, Brun », hors cellule) ne se colle pas à la dernière case (décision R58)
  for (const c of cellules(lignes.slice(i + 1).filter((l) => !/^\*\S/.test(l)))) {
    const t = c.trim();
    if (!t || /^Butin possible$/.test(t)) continue;
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      tranche = { score_min: Number(m[1]), score_max: Number(m[2]), score_brut: t };
      rang++;
      categorie = null;
      continue;
    }
    const cat = categorieDe(t);
    if (cat) {
      categorie = cat;
      continue;
    }
    if (!tranche || !categorie) throw new Error(`butin : cellule hors tableau « ${t} » (${ref(debut + i)})`);
    const deja = sortie.find((b) => b.rang === rang && b.categorie === categorie);
    if (deja) deja.texte += `\n${t}`;
    else sortie.push({ rang, ...tranche, categorie, texte: t, source_ref: ref(debut + i, fin - 1) });
  }
  return sortie;
}

/**
 * Les capacités écrites sur une carte -> leurs placements (rang, préfixe, capacité commune, liste de sorts, valeurs propres à la carte), d'après le registre.
 * Une écriture absente du registre arrête l'extraction.
 */
function placementsDe(ecrites, registre, ou) {
  const sortie = [];
  for (const x of ecrites) {
    const e = registre.parEcriture.get(`${x.nom}\u0000${x.texte}`);
    if (!e) throw new Error(`capacité « ${x.nom} » (${ou}) : absente du registre tools/bestiaire/capacites.json`);
    e.employee = true;
    e.placements.forEach((p, k) => sortie.push({
      rang: sortie.length + 1,
      prefixe: k === 0 ? x.prefixe : null,
      ep_min: k === 0 ? x.ep_min : null,
      capacite_commune_id: p.capacite,
      sorts: p.sorts ?? null,
      valeurs: Object.entries(p.valeurs ?? {}).map(([numero, valeur]) => ({ numero: Number(numero), valeur })),
    }));
  }
  return sortie;
}

/** Une carte de monstre : de son en-tête (« NOM   Créature échelle 2 ») à `fin` (exclue). */
function carte(L, debut, fin, espece, rang, casse, registre) {
  const m = L[debut].match(/^(.*?)\s*Créature échelle\s*(.*?)\s*$/);
  const nomBrut = compacter(m[1]);
  let i = debut + 1;
  while (i < fin && !L[i].trim()) i++;
  const [type_brut = null, alignement_brut = null, categorie_brut = null] = L[i].split('|').map((p) => compacter(p) || null);
  const categorie = categorieDe(categorie_brut);
  if (!categorie) throw new Error(`catégorie inconnue « ${categorie_brut} » (${ref(i)})`);
  const rubriques = [];
  let variable = 0;
  let courante = null;
  for (i++; i < fin; i++) {
    const l = L[i];
    const s = compacter(l);
    const en = !l.startsWith('\t') && RUBRIQUES.find(([, re]) => re.test(s));
    if (en && !(en[0] === 'attributs' && courante?.rubrique === 'sante')) {
      courante = { rubrique: en[0], titre: s, debut: i, lignes: en[0] === 'attributs' ? [l] : [] };
      rubriques.push(courante);
    } else if (VARIABLE.test(s) && !courante) variable = 1;
    else if (courante) courante.lignes.push(l);
    else if (s) throw new Error(`ligne hors rubrique « ${s} » (${ref(i)})`);
  }
  if (rubriques.length === 0) throw new Error(`carte sans rubrique (${ref(debut)})`);
  const ecrites = rubriques.map((x, k) => ({ rang: k + 1, rubrique: x.rubrique, titre: x.rubrique === 'attributs' ? null : x.titre, texte: texteDe(x.lignes), source_ref: ref(x.debut) }));
  const v = valeursDeLaCarte(ecrites);
  // la rubrique « Capacité(s) » ne garde que sa place et son titre : ses capacités sont rangées par le registre (R66)
  const r = ecrites.map((x) => (x.rubrique === 'capacites' ? { ...x, texte: '' } : x));
  const [ep_min, ep_max] = bornes(m[2]);
  const cle = normalize(nomBrut);
  return {
    id: `${espece.id}#carte:${cle}`,
    espece_id: espece.id,
    rang,
    nom: casse(nomBrut, espece.nom),
    nom_brut: nomBrut,
    nom_cle: cle,
    echelle_brut: m[2],
    ep_min,
    ep_max,
    type_brut,
    alignement_brut,
    categorie_brut,
    categorie,
    variable,
    sante: v.sante,
    chakra: v.chakra,
    barriere: v.barriere,
    armure_physique: v.armure_physique,
    armure_magique: v.armure_magique,
    vitesse_sol: v.vitesse_sol,
    vitesse_nage: v.vitesse_nage,
    source_ref: ref(debut, fin - 1),
    rubriques: r,
    caracteristiques: v.caracteristiques,
    attaques: v.attaques,
    texteDesCapacites: ecrites.filter((x) => x.rubrique === 'capacites').map((x) => x.texte).join('\n\n'),
    capacitesEcrites: v.capacites,
    capacites: placementsDe(v.capacites, registre, ref(debut)),
    defenses: v.defenses,
  };
}

/** Une espèce : de son titre « Nom (EPx) » à `fin` (exclue) : description, lieu de rencontre, cartes, blocs qui suivent les cartes, butin. */
function espece(L, debut, fin, ordre, lettre, ids, casse, registre) {
  const [, nom, ep] = L[debut].match(TITRE_ESPECE);
  let cle = normalize(nom);
  let id = `monstres/${cle}`;
  for (let n = 2; ids.has(id); n++) id = `monstres/${cle}-${n}`;
  ids.add(id);
  const e = { id, nom: compacter(nom), nom_cle: cle, ordre, lettre, ep_brut: ep, source_ref: ref(debut, fin - 1), groupe_id: null };
  [e.ep_min, e.ep_max] = bornes(ep);
  // Découpage : une carte commence à son en-tête ; après la tactique d'une carte, « BUTIN » (ou « Score (3d100) ») ouvre le tableau du butin
  // et un titre en capitales (« POTENTIEL ILLIMITÉ », « SANG » : tableaux du Presque-Ottar) ouvre un bloc ; « DESCRIPTION » est une ligne de ces tableaux.
  const marques = [];
  let etat = 'avant';
  for (let i = debut + 1; i < fin; i++) {
    const s = compacter(L[i]);
    if (CARTE.test(L[i])) {
      marques.push({ i, genre: 'carte' });
      etat = 'carte';
    } else if (/^TACTIQUE COMBAT/.test(s)) etat = 'tactique';
    else if (DEBUT_BUTIN.test(s) && etat !== 'butin') {
      marques.push({ i, genre: 'butin' });
      etat = 'butin';
    } else if (etat === 'tactique' || etat === 'bloc') {
      if (!L[i].startsWith('\t') && TITRE_DE_BLOC(s) && s !== 'DESCRIPTION') {
        marques.push({ i, genre: 'bloc' });
        etat = 'bloc';
      }
    }
  }
  const finDe = (k) => (k + 1 < marques.length ? marques[k + 1].i : fin);
  // Avant la première marque : la description, puis « Lieu de rencontre : … »
  const avant = L.slice(debut + 1, marques[0]?.i ?? fin);
  const iLieu = avant.findIndex((l) => /^Lieu de rencontre\s*:/.test(l));
  e.description = texteDe(iLieu < 0 ? avant : avant.slice(0, iLieu)) || null;
  e.lieu_brut = iLieu < 0 ? null : compacter(avant[iLieu].replace(/^Lieu de rencontre\s*:/, '')) || null;
  e.complement = iLieu < 0 ? null : texteDe(avant.slice(iLieu + 1)) || null;
  e.lieux = lieux(e.lieu_brut);
  e.cartes = [];
  e.blocs = [];
  e.butin = [];
  marques.forEach((m, k) => {
    if (m.genre === 'carte') e.cartes.push(carte(L, m.i, finDe(k), e, e.cartes.length + 1, casse, registre));
    else if (m.genre === 'bloc') e.blocs.push({ rang: e.blocs.length + 1, titre: compacter(L[m.i]), texte: texteDe(L.slice(m.i + 1, finDe(k))), source_ref: ref(m.i, finDe(k) - 1) });
    else {
      const rang0 = e.butin.reduce((n, b) => Math.max(n, b.rang), 0);
      e.butin.push(...butin(L, m.i, finDe(k)).map((b) => ({ ...b, rang: b.rang + rang0 })));
    }
  });
  // Doublons de nom de carte dans une espèce : identifiant suffixé (aucun aujourd'hui)
  const vus = new Set();
  for (const c of e.cartes) {
    let idc = c.id;
    for (let n = 2; vus.has(idc); n++) idc = `${c.id}-${n}`;
    vus.add(idc);
    c.id = idc;
  }
  return e;
}

/** Glossaire du butin : « Nom. Définition » par paragraphe, après « GLOSSAIRE BUTIN » et ses deux phrases d'introduction. */
function glossaire(L, debut) {
  const sortie = [];
  for (let i = debut + 1; i < L.length; i++) {
    const s = compacter(L[i]);
    if (!s || /^(Ici vous pouvez|Les objets en rouge)/.test(s)) continue;
    const m = s.match(/^([^.]{1,60})\.\s+(.*)$/);
    if (!m) throw new Error(`glossaire : ligne inattendue « ${s} » (${ref(i)})`);
    // l'identifiant vient du nom tel que le doc l'écrit, avant les corrections (un nom corrigé garde son identifiant : « Peau du radrak », décision R57)
    const brut = L[i].replace(/[ \u00a0]+/g, ' ').trim().match(/^([^.]{1,60})\./)[1];
    sortie.push({ id: normalize(brut), rang: sortie.length + 1, nom: m[1].trim(), texte: m[2].trim(), source_ref: ref(i) });
  }
  return sortie;
}

/** Un groupe d'espèces : son titre « Nom (explication) » à la ligne `i`, sa description jusqu'au trait (ou au titre d'espèce) suivant. */
function groupe(L, i, titres) {
  const nom = compacter(L[i].match(TITRE_GROUPE)[1]);
  let fin = i + 1;
  while (fin < L.length && !SEPARATEUR.test(L[fin].trim()) && !titres.includes(fin)) fin++;
  let der = fin - 1;
  while (der > i && !L[der].trim()) der--;
  return { id: `monstres/${normalize(nom)}`, nom, nom_cle: normalize(nom), description: texteDe(L.slice(i + 1, fin)) || null, source_ref: ref(i, der), ligne: i };
}

/**
 * Le doc entier -> { regles, echelles, groupes, especes, glossaire, capacites } ; les brouillons (« (a refaire) », « (a continuer) ») ne sont pas repris.
 * `capacites` : les capacités communes du registre (par identifiant), chacune avec sa provenance : la première carte du doc qui écrit son texte, sinon la
 * source que lui donne le registre, sinon la première carte qui la place.
 */
export function extraireBestiaire(texte, registre = lireRegistre()) {
  const ecarts = ecartsDuRegistre(registre);
  if (ecarts.length) throw new Error(`registre des capacités : ${ecarts.join(' ; ')}`);
  const reg = { ...registre, parEcriture: new Map(registre.ecritures.map((e) => [`${e.nom}\u0000${e.texte}`, { ...e }])) };
  const L = lignesDuDoc(texte);
  const iGlossaire = L.findIndex((l) => DEBUT_GLOSSAIRE.test(l.trim()));
  if (iGlossaire < 0) throw new Error('« GLOSSAIRE BUTIN » introuvable');
  const titres = [];
  const brouillons = [];
  const titresDeGroupe = [];
  for (let i = 0; i < iGlossaire; i++) {
    if (TITRE_ESPECE.test(L[i]) && !/^\[/.test(L[i])) titres.push(i);
    else if (TITRE_BROUILLON.test(L[i])) brouillons.push(i);
    else if (TITRE_GROUPE.test(L[i])) titresDeGroupe.push(i);
  }
  // l'introduction (règles, deux tableaux, modèle de carte, liste par EP) précède le premier titre d'espèce
  const intro = introduction(L);
  const casse = casseur(L.filter((l) => !CARTE.test(l)).join('\n'));
  const ids = new Set();
  const especes = [];
  let lettre = null;
  for (let k = 0; k < titres.length; k++) {
    const debut = titres[k];
    for (let i = (k ? titres[k - 1] : 0); i < debut; i++) if (LETTRE.test(L[i])) lettre = L[i].trim();
    // la fin : le titre suivant, d'une espèce ou d'un brouillon (non repris)
    let fin = Math.min(k + 1 < titres.length ? titres[k + 1] : iGlossaire, brouillons.find((b) => b > debut) ?? iGlossaire);
    // la fin d'une espèce : avant le séparateur de page et la lettre de l'espèce suivante
    while (fin - 1 > debut && (!L[fin - 1].trim() || SEPARATEUR.test(L[fin - 1].trim()) || LETTRE.test(L[fin - 1]))) fin--;
    especes.push(espece(L, debut, fin, k + 1, lettre, ids, casse, reg));
  }
  // les groupes : chacun prend les espèces qui suivent son titre, tant que leur nom contient le sien (décision R64)
  const groupes = titresDeGroupe.map((i) => groupe(L, i, titres));
  for (const g of groupes) {
    if (ids.has(g.id)) throw new Error(`groupe « ${g.nom} » : l'identifiant ${g.id} est celui d'une espèce`);
    for (let k = titres.findIndex((t) => t > g.ligne); k >= 0 && k < especes.length && especes[k].nom_cle.includes(g.nom_cle); k++) especes[k].groupe_id = g.id;
    delete g.ligne;
  }
  const inemployees = [...reg.parEcriture.values()].filter((e) => !e.employee);
  if (inemployees.length) throw new Error(`registre des capacités : écritures absentes du doc : ${inemployees.map((e) => `« ${e.nom} »`).join(', ')}`);
  // les capacités communes, chacune avec la ligne de la première carte du doc qui écrit son texte (au plus avec une faute, ou découpé autrement) ; sinon
  // la source que lui donne le registre (texte du propriétaire, texte d'une créature invoquée retenu par le chef), sinon la première carte qui la place
  const premiere = new Map();
  const ecrite = new Map();
  const PROCHE = /^(R66 : fautes corrigées|R66 : description commune, fautes corrigées|découpage)/;
  for (const c of especes.flatMap((e) => e.cartes)) {
    const ligne = c.rubriques.find((r) => r.rubrique === 'capacites')?.source_ref ?? c.source_ref;
    for (const x of c.capacitesEcrites) {
      const e = reg.parEcriture.get(`${x.nom}\u0000${x.texte}`);
      for (const p of e.placements) {
        if (!premiere.has(p.capacite)) premiere.set(p.capacite, ligne);
        if (!ecrite.has(p.capacite) && (!e.decision || PROCHE.test(e.decision))) ecrite.set(p.capacite, ligne);
      }
    }
  }
  const capacites = registre.capacites
    .map((x) => ({ id: x.id, nom: x.nom, nom_cle: normalize(x.nom), description: x.description, liste_de_sorts: x.liste_de_sorts ? 1 : 0, source_ref: x.source ?? ecrite.get(x.id) ?? premiere.get(x.id) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { ...intro, groupes, especes, glossaire: glossaire(L, iGlossaire), capacites };
}

// ---------------------------------------------------------------- SQL de la migration
const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const insert = (table, ligne) => `INSERT INTO ${table} (${Object.keys(ligne).join(', ')}) VALUES (${Object.values(ligne).map(sql).join(', ')});`;
const O = { origine: 'monstres' };

/** Les INSERT des tables des monstres, dans l'ordre des clés étrangères. */
export function lignesSql(b) {
  const out = [];
  for (const r of b.regles) out.push(insert('monstre_regle', { rang: r.rang, texte: r.texte, ...O, source_ref: r.source_ref }));
  for (const e of b.echelles) out.push(insert('monstre_echelle', { ...e, ...O, source_ref: e.source_ref }));
  for (const g of b.glossaire) out.push(insert('monstre_butin_objet', { id: g.id, rang: g.rang, nom: g.nom, texte: g.texte, ...O, source_ref: g.source_ref }));
  for (const g of b.groupes) out.push(insert('monstre_groupe', { id: g.id, nom: g.nom, nom_cle: g.nom_cle, description: g.description, ...O, source_ref: g.source_ref }));
  for (const c of b.capacites) out.push(insert('monstre_capacite_commune', { id: c.id, nom: c.nom, nom_cle: c.nom_cle, description: c.description, liste_de_sorts: c.liste_de_sorts, ...O, source_ref: c.source_ref }));
  for (const e of b.especes) {
    out.push(insert('monstre_espece', { id: e.id, nom: e.nom, nom_cle: e.nom_cle, ordre: e.ordre, lettre: e.lettre, ep_brut: e.ep_brut, ep_min: e.ep_min, ep_max: e.ep_max, description: e.description, lieu_brut: e.lieu_brut, complement: e.complement, ...O, source_ref: e.source_ref, groupe_id: e.groupe_id }));
    for (const l of e.lieux) out.push(insert('monstre_espece_lieu', { espece_id: e.id, rang: l.rang, lieu: l.lieu, lieu_cle: l.lieu_cle, ...O, source_ref: e.source_ref }));
    for (const x of e.blocs) out.push(insert('monstre_espece_bloc', { espece_id: e.id, rang: x.rang, titre: x.titre, texte: x.texte, ...O, source_ref: x.source_ref }));
    for (const x of e.butin) out.push(insert('monstre_butin', { espece_id: e.id, rang: x.rang, categorie: x.categorie, score_min: x.score_min, score_max: x.score_max, score_brut: x.score_brut, texte: x.texte, ...O, source_ref: x.source_ref }));
    for (const c of e.cartes) {
      const { rubriques, caracteristiques, attaques: att, capacites: cap, defenses, texteDesCapacites, capacitesEcrites, ...ligne } = c;
      out.push(insert('monstre', { ...ligne, ...O }));
      for (const r of rubriques) out.push(insert('monstre_rubrique', { monstre_id: c.id, ...r, ...O }));
      for (const x of caracteristiques) out.push(insert('monstre_caracteristique', { monstre_id: c.id, ...x, ...O, source_ref: rubriques.find((r) => r.rubrique === 'caracteristiques').source_ref }));
      const refDe = (cle) => rubriques.find((r) => r.rubrique === cle)?.source_ref ?? c.source_ref;
      for (const x of att) out.push(insert('monstre_attaque', { monstre_id: c.id, ...x, ...O, source_ref: refDe('degats') }));
      for (const { valeurs, ...x } of cap) out.push(insert('monstre_capacite', { monstre_id: c.id, ...x, ...O, source_ref: refDe('capacites') }));
      for (const x of cap) for (const v of x.valeurs) out.push(insert('monstre_capacite_valeur', { monstre_id: c.id, rang: x.rang, ...v, ...O, source_ref: refDe('capacites') }));
      for (const x of defenses) out.push(insert('monstre_defense', { monstre_id: c.id, ...x, ...O, source_ref: refDe(x.sens) }));
    }
  }
  return out;
}

/** Effectifs et points à relever (bilan de l'extraction). */
export function bilan(b) {
  const cartes = b.especes.flatMap((e) => e.cartes);
  return {
    regles: b.regles.length,
    echelles: b.echelles.length,
    groupes: b.groupes.map((g) => ({ id: g.id, especes: b.especes.filter((e) => e.groupe_id === g.id).length })),
    especes: b.especes.length,
    cartes: cartes.length,
    rubriques: cartes.reduce((n, c) => n + c.rubriques.length, 0),
    attaques: cartes.reduce((n, c) => n + c.attaques.length, 0),
    capacitesCommunes: b.capacites.length,
    capacites: cartes.reduce((n, c) => n + c.capacites.length, 0),
    valeursPropres: cartes.reduce((n, c) => n + c.capacites.reduce((k, x) => k + x.valeurs.length, 0), 0),
    defenses: cartes.reduce((n, c) => n + c.defenses.length, 0),
    butin: b.especes.reduce((n, e) => n + e.butin.length, 0),
    especesAvecButin: b.especes.filter((e) => e.butin.length).length,
    blocs: b.especes.reduce((n, e) => n + e.blocs.length, 0),
    glossaire: b.glossaire.length,
    sansSante: cartes.filter((c) => c.sante === null).length,
    sansDefense: cartes.filter((c) => c.armure_physique === null).length,
    sansVitesse: cartes.filter((c) => c.vitesse_sol === null).length,
    sansCaracs: cartes.filter((c) => !c.caracteristiques.length).length,
    idsSuffixes: b.especes.filter((e) => /-\d+$/.test(e.id)).map((e) => e.id),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const source = args.includes('--source') ? args[args.indexOf('--source') + 1] : fileURLToPath(new URL('../../sources/raw/bestiaire-2-0.txt', import.meta.url));
  const b = extraireBestiaire(readFileSync(source, 'utf8'));
  // --tables a,b : seulement les INSERT de ces tables (une migration de données)
  const tables = args.includes('--tables') ? args[args.indexOf('--tables') + 1].split(',') : null;
  const garder = (l) => !tables || tables.includes(l.match(/^INSERT INTO (\w+)/)[1]);
  if (args.includes('--sql')) process.stdout.write(lignesSql(b).filter(garder).join('\n') + '\n');
  else if (args.includes('--json')) process.stdout.write(JSON.stringify(b, null, 1));
  else console.log(JSON.stringify(bilan(b), null, 1));
}
