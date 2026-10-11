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
// quand l'écriture est sans ambiguïté (sinon NULL, le texte reste).
// Transformations : les quatre graphies que la base a déjà corrigées partout (CORRECTIONS) ; et le nom d'une carte, écrit en capitales dans le doc (« AMBLYPYGE DE BRAI ») ; `nom` le remet en minuscules en gardant la
// casse que le doc donne ailleurs à chaque mot (titre de l'espèce, puis texte courant : « Amblypyge de brai », « Élémentaire de l'Eau ») et les chiffres romains
// en capitales (« Golem de fer II ») ; `nom_brut` garde l'original.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalize } from '../../client/src/lib/text.mjs';

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
  ['double_resistance', /^Double\(s\)\s*Résistance\(s\)/i],
  ['grande_resistance', /^Grande\(s\)\s*résistance\(s\)/i],
  ['resistance', /^Résistance\(s\)\s*Dégâts/i],
  ['immunite', /^Immunité\(s\)/i],
  ['reflexion', /^Réflexion\(s\)/i],
  ['capacites', /^Capacité\(s\)\s*$/],
  ['tactique', /^TACTIQUE COMBAT\s*$/],
];
export const CLES_RUBRIQUES = RUBRIQUES.map(([cle]) => cle);

/** Rubriques qui listent des cibles (« Brûlure, Paralysie ») : sens de la ligne de `monstre_defense`. */
export const SENS_DEFENSE = ['vulnerabilite', 'grande_vulnerabilite', 'resistance', 'grande_resistance', 'double_resistance', 'immunite', 'reflexion'];

export const CATEGORIES = { 'ennemi-simple': 'ennemi_simple', 'mini-boss': 'mini_boss', boss: 'boss' };

const SEPARATEUR = /^_{6,}\s*$/;
const TITRE_ESPECE = /^([^\t*\s].*?)\s*\((EP[^)]*)\)\s*$/;
const LETTRE = /^[A-Z]\s*$/;
const CARTE = /Créature échelle/;
const DEBUT_GLOSSAIRE = /^GLOSSAIRE BUTIN\s*$/;
const DEBUT_BUTIN = /^(BUTIN\s*$|Score \(3d100\))/;
const VARIABLE = /^Ses stats varient selon son échelle de puissance\.?\s*$/;
/** Ligne toute en capitales (titre de bloc après les cartes : « POTENTIEL ILLIMITÉ », « SANG ») : au moins trois lettres, aucune minuscule. */
const TITRE_DE_BLOC = (l) => /\p{Lu}.*\p{Lu}.*\p{Lu}/u.test(l) && !/\p{Ll}/u.test(l) && !CARTE.test(l) && !/^TACTIQUE COMBAT/.test(l);

/**
 * Corrections déjà décidées pour toute la base (une graphie corrigée l'est partout où elle est écrite : CLAUDE.md, « Orthographe ») et que le doc écrit
 * encore à l'ancienne : [motif, remplacement, origine]. Rien d'autre n'est corrigé ; sources/raw garde le texte du doc.
 */
export const CORRECTIONS = [
  [/le Démon d'Eau Noire/g, 'Eaunoire', 'décision R21, migration 0012-eaunoire'],
  [/\bOccultomancien/g, 'Ocultomancien', 'graphie majoritaire, migration 0006-orthographe-noms'],
  [/([Pp])urée de poix/g, '$1urée de pois', 'migration 0006-orthographe-noms'],
  [/\bect\b/g, 'etc', 'migration 0005-orthographe-base'],
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
const paragraphes = (texte) => (texte ? texte.split(/\n\n+/) : []);
const entiers = (texte) => [...String(texte).matchAll(/\d+/g)].map((m) => Number(m[0]));
const bornes = (texte) => {
  const n = entiers(texte);
  return n.length ? [Math.min(...n), Math.max(...n)] : [null, null];
};

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
  for (const m of texte.matchAll(/(Ennemi simple|Mini[- ]boss|Boss)\s*:\s*(\d+)/gi)) valeurs[CATEGORIES[normalize(m[1])]] = Number(m[2]);
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
  for (const c of cellules(lignes.slice(i + 1))) {
    const t = c.trim();
    if (!t || /^Butin possible$/.test(t)) continue;
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      tranche = { score_min: Number(m[1]), score_max: Number(m[2]), score_brut: t };
      rang++;
      categorie = null;
      continue;
    }
    const cat = CATEGORIES[normalize(t)];
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
 * « Pince - 2d10 + 2 dégâts d’estoc », « Bâton mal-foutue: 1d6 dégâts de frappe » -> { nom, texte } ; une ligne sans « nom - texte » chiffré n'est pas
 * une attaque (« Arme de la créature : », « Se fier au dégâts moyen… », « EP 1 - 10 : Faux déformée… » d'une carte qui varie selon l'échelle).
 */
function attaques(texte) {
  return texte
    .split('\n')
    .map((l) => l.match(/^(.{1,60}?)(?:\s+[-–]\s+|\s*:\s+)(.*\d.*)$/))
    .filter((m) => m && !/^(\[?EP\s*\d|Arme de la créature)/i.test(m[1]))
    .map((m, k) => ({ rang: k + 1, nom: m[1].trim(), texte: m[2].trim() }));
}

/**
 * Capacités : un paragraphe « [EP2] Nom. Texte » ouvre une capacité ; un paragraphe qui ne commence pas par un nom (tableau, suite) continue la précédente.
 * Préfixe : les crochets et parenthèses avant le nom, tels qu'écrits (« [EP2] », « [Gauche] » d'une tête du Cerbère, « (Neige) [EP3] » d'une forme) ;
 * ep_min : le N du premier « [EPN] » du préfixe (capacité gagnée à partir de cette échelle), sinon NULL.
 */
function capacites(texte) {
  const sortie = [];
  for (const p of paragraphes(texte)) {
    const m = p.match(/^((?:[[(][^\])\n]*[\])]\s*)*)([^.:\n]{1,70}?)\s*\.\s+([\s\S]*)$/);
    if (m && /^[\p{Lu}\d]/u.test(m[2])) {
      const prefixe = m[1].trim() || null;
      const ep = prefixe?.match(/\[EP\s*(\d+)/);
      sortie.push({ rang: sortie.length + 1, prefixe, ep_min: ep ? Number(ep[1]) : null, nom: m[2].trim(), texte: m[3].trim() });
    } else if (sortie.length) sortie.at(-1).texte += `\n\n${p}`;
    else sortie.push({ rang: 1, prefixe: null, ep_min: null, nom: null, texte: p });
  }
  return sortie;
}

/** Cibles d'une rubrique de défense, quand elle est UNE liste « A, B, C » de noms courts ; sinon aucune (« Varie selon la magie », tableau…). */
function cibles(texte) {
  if (!texte || texte.includes('\n')) return [];
  const morceaux = texte.split(/\s*,\s*/).map((m) => m.trim().replace(/\.$/, '')).filter(Boolean);
  if (!morceaux.every((m) => m.length <= 30 && !/[:.;]/.test(m) && !/^(varie|variable|selon|voir|aucun|rien)/i.test(m))) return [];
  return morceaux;
}

/** Une carte de monstre : de son en-tête (« NOM   Créature échelle 2 ») à `fin` (exclue). */
function carte(L, debut, fin, espece, rang, casse) {
  const m = L[debut].match(/^(.*?)\s*Créature échelle\s*(.*?)\s*$/);
  const nomBrut = compacter(m[1]);
  let i = debut + 1;
  while (i < fin && !L[i].trim()) i++;
  const [type_brut = null, alignement_brut = null, categorie_brut = null] = L[i].split('|').map((p) => compacter(p) || null);
  const categorie = CATEGORIES[normalize(categorie_brut ?? '')];
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
  const r = rubriques.map((x, k) => ({ rang: k + 1, rubrique: x.rubrique, titre: x.rubrique === 'attributs' ? null : x.titre, texte: texteDe(x.lignes), source_ref: ref(x.debut) }));
  const de = (cle) => r.find((x) => x.rubrique === cle)?.texte ?? '';
  // Santé, chakra, barrière : une seule ligne « Santé : 70  Chakra : 0  Barrière : 0 » (sinon : valeurs par EP, gardées en texte)
  const a = de('attributs').match(/^Santé\s*:\s*(\d+)\s+Chakra\s*:\s*(\d+)\s+Barrière\s*:\s*(\d+)$/);
  const defense = de('defense').match(/^(\d+) (?:armure physique|AP) ?\/ ?(\d+) (?:armure magique|AM)\b/i);
  const vitesse = de('vitesse').match(/^(\d+) cases? sol \/ (\d+) cases? nage$/i);
  const fpvsia = de('caracteristiques').match(/^F\s*:\s*(\d+)\s*\/\s*P\s*:\s*(\d+)\s*\/\s*V\s*:\s*(\d+)\s*\/\s*S\s*:\s*(\d+)\s*\/\s*I\s*:\s*(\d+)\s*\/\s*A\s*:\s*(\d+)$/);
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
    sante: a ? Number(a[1]) : null,
    chakra: a ? Number(a[2]) : null,
    barriere: a ? Number(a[3]) : null,
    armure_physique: defense ? Number(defense[1]) : null,
    armure_magique: defense ? Number(defense[2]) : null,
    vitesse_sol: vitesse ? Number(vitesse[1]) : null,
    vitesse_nage: vitesse ? Number(vitesse[2]) : null,
    source_ref: ref(debut, fin - 1),
    rubriques: r,
    caracteristiques: fpvsia ? ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'].map((c, k) => ({ caracteristique_id: c, rang: k + 1, valeur: Number(fpvsia[k + 1]) })) : [],
    attaques: attaques(de('degats')),
    capacites: capacites(de('capacites')),
    defenses: SENS_DEFENSE.flatMap((sens) =>
      r.filter((x) => x.rubrique === sens).flatMap((x) => cibles(x.texte)).map((c, k) => ({ sens, rang: k + 1, cible: c, cible_cle: normalize(c) })),
    ),
  };
}

/** Une espèce : de son titre « Nom (EPx) » à `fin` (exclue) : description, lieu de rencontre, cartes, blocs qui suivent les cartes, butin. */
function espece(L, debut, fin, ordre, lettre, ids, casse) {
  const [, nom, ep] = L[debut].match(TITRE_ESPECE);
  let cle = normalize(nom);
  let id = `monstres/${cle}`;
  for (let n = 2; ids.has(id); n++) id = `monstres/${cle}-${n}`;
  ids.add(id);
  const e = { id, nom: compacter(nom), nom_cle: cle, ordre, lettre, ep_brut: ep, source_ref: ref(debut, fin - 1) };
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
  e.lieux = (e.lieu_brut ?? '').split(/\s*,\s*/).filter(Boolean).map((l, k) => ({ rang: k + 1, lieu: l, lieu_cle: normalize(l) }));
  e.cartes = [];
  e.blocs = [];
  e.butin = [];
  marques.forEach((m, k) => {
    if (m.genre === 'carte') e.cartes.push(carte(L, m.i, finDe(k), e, e.cartes.length + 1, casse));
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
    sortie.push({ id: normalize(m[1]), rang: sortie.length + 1, nom: m[1].trim(), texte: m[2].trim(), source_ref: ref(i) });
  }
  return sortie;
}

/** Le doc entier -> { regles, echelles, especes, glossaire }. */
export function extraireBestiaire(texte) {
  const L = lignesDuDoc(texte);
  const iGlossaire = L.findIndex((l) => DEBUT_GLOSSAIRE.test(l.trim()));
  if (iGlossaire < 0) throw new Error('« GLOSSAIRE BUTIN » introuvable');
  const titres = [];
  for (let i = 0; i < iGlossaire; i++) if (TITRE_ESPECE.test(L[i]) && !/^\[/.test(L[i])) titres.push(i);
  // l'introduction (règles, deux tableaux, modèle de carte, liste par EP) précède le premier titre d'espèce
  const intro = introduction(L);
  const casse = casseur(L.filter((l) => !CARTE.test(l)).join('\n'));
  const ids = new Set();
  const especes = [];
  let lettre = null;
  for (let k = 0; k < titres.length; k++) {
    const debut = titres[k];
    for (let i = (k ? titres[k - 1] : 0); i < debut; i++) if (LETTRE.test(L[i])) lettre = L[i].trim();
    let fin = k + 1 < titres.length ? titres[k + 1] : iGlossaire;
    // la fin d'une espèce : avant le séparateur de page et la lettre de l'espèce suivante
    while (fin - 1 > debut && (!L[fin - 1].trim() || SEPARATEUR.test(L[fin - 1].trim()) || LETTRE.test(L[fin - 1]))) fin--;
    especes.push(espece(L, debut, fin, k + 1, lettre, ids, casse));
  }
  return { ...intro, especes, glossaire: glossaire(L, iGlossaire) };
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
  for (const e of b.especes) {
    out.push(insert('monstre_espece', { id: e.id, nom: e.nom, nom_cle: e.nom_cle, ordre: e.ordre, lettre: e.lettre, ep_brut: e.ep_brut, ep_min: e.ep_min, ep_max: e.ep_max, description: e.description, lieu_brut: e.lieu_brut, complement: e.complement, ...O, source_ref: e.source_ref }));
    for (const l of e.lieux) out.push(insert('monstre_espece_lieu', { espece_id: e.id, rang: l.rang, lieu: l.lieu, lieu_cle: l.lieu_cle, ...O, source_ref: e.source_ref }));
    for (const x of e.blocs) out.push(insert('monstre_espece_bloc', { espece_id: e.id, rang: x.rang, titre: x.titre, texte: x.texte, ...O, source_ref: x.source_ref }));
    for (const x of e.butin) out.push(insert('monstre_butin', { espece_id: e.id, rang: x.rang, categorie: x.categorie, score_min: x.score_min, score_max: x.score_max, score_brut: x.score_brut, texte: x.texte, ...O, source_ref: x.source_ref }));
    for (const c of e.cartes) {
      const { rubriques, caracteristiques, attaques: att, capacites: cap, defenses, ...ligne } = c;
      out.push(insert('monstre', { ...ligne, ...O }));
      for (const r of rubriques) out.push(insert('monstre_rubrique', { monstre_id: c.id, ...r, ...O }));
      for (const x of caracteristiques) out.push(insert('monstre_caracteristique', { monstre_id: c.id, ...x, ...O, source_ref: rubriques.find((r) => r.rubrique === 'caracteristiques').source_ref }));
      const refDe = (cle) => rubriques.find((r) => r.rubrique === cle)?.source_ref ?? c.source_ref;
      for (const x of att) out.push(insert('monstre_attaque', { monstre_id: c.id, ...x, ...O, source_ref: refDe('degats') }));
      for (const x of cap) out.push(insert('monstre_capacite', { monstre_id: c.id, ...x, ...O, source_ref: refDe('capacites') }));
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
    especes: b.especes.length,
    cartes: cartes.length,
    rubriques: cartes.reduce((n, c) => n + c.rubriques.length, 0),
    attaques: cartes.reduce((n, c) => n + c.attaques.length, 0),
    capacites: cartes.reduce((n, c) => n + c.capacites.length, 0),
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
  if (args.includes('--sql')) process.stdout.write(lignesSql(b).join('\n') + '\n');
  else if (args.includes('--json')) process.stdout.write(JSON.stringify(b, null, 1));
  else console.log(JSON.stringify(bilan(b), null, 1));
}
