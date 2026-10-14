// Découpage d'une carte de monstre du « Bestiaire 2.0 » : ce que la base tire du texte de ses rubriques (data/schema.sql, section 8 bis). Le même découpage
// sert à l'extraction du doc (tools/bestiaire/extraire.mjs), à la page (lib/bestiaire-db.mjs, rendu de la carte) et au mode modification du site de dev
// (serveur/edition.mjs : une rubrique modifiée refait les valeurs typées de la carte). Rien n'est déduit : une valeur n'est typée que si son écriture est
// sans ambiguïté (sinon NULL, le texte de la rubrique fait foi). Fonctions pures ; seule dépendance : lib/text.mjs.
import { normalize } from './text.mjs';

/** Rubriques qui listent des cibles (« Brûlure, Paralysie ») : sens d'une ligne de `monstre_defense`, dans l'ordre. */
export const SENS_DEFENSE = ['vulnerabilite', 'grande_vulnerabilite', 'resistance', 'grande_resistance', 'double_resistance', 'immunite', 'reflexion'];

/** Toutes les rubriques d'une carte (colonne `monstre_rubrique.rubrique`), dans l'ordre où le doc les écrit d'habitude, avec leur titre par défaut. */
export const RUBRIQUES = {
  attributs: 'Santé, chakra, barrière',
  sante: 'Santé',
  chakra: 'Chakra',
  barriere: 'Barrière',
  degats: 'Dégâts',
  defense: 'Défense',
  vitesse: 'Vitesse',
  caracteristiques: 'Caractéristiques (F.P.V.S.I.A.)',
  competences: 'Compétence(s) secondaire(s)',
  vulnerabilite: 'Vulnérabilité(s) Dégâts x2',
  grande_vulnerabilite: 'Grande(s) Vulnérabilité(s) Dégâts x4',
  resistance: 'Résistance(s) Dégâts ÷2',
  grande_resistance: 'Grande(s) Résistance(s) Dégâts ÷4',
  double_resistance: 'Double(s) Résistance(s) Dégâts/Effets ÷4',
  immunite: 'Immunité(s) Dégâts/Effets = 0',
  reflexion: 'Réflexion(s) Renvoi des dégâts/effets',
  capacites: 'Capacité(s)',
  tactique: 'TACTIQUE COMBAT',
};

/**
 * Rubriques d'une carte créée depuis le site de dev (serveur/edition-bestiaire.mjs), vides, avec leur titre par défaut : la disposition de la plupart
 * des cartes du doc (181 cartes sur 315 : santé, chakra et barrière sur une ligne, dégâts, défense, vitesse, caractéristiques, compétences,
 * vulnérabilités, résistances, immunités, capacités, tactique).
 */
export const GABARIT_DE_CARTE = ['attributs', 'degats', 'defense', 'vitesse', 'caracteristiques', 'competences', 'vulnerabilite', 'resistance', 'immunite', 'capacites', 'tactique'];

/** Lieux de rencontre d'une espèce (`monstre_espece_lieu`) : la ligne « Lieu de rencontre » découpée aux virgules, chaque lieu tel qu'écrit. */
export const lieux = (texte) =>
  String(texte ?? '')
    .split(/\s*,\s*/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((lieu, k) => ({ rang: k + 1, lieu, lieu_cle: normalize(lieu) }));

/** Catégories d'un monstre : clé de `monstre.categorie` -> libellé ; et lecture de l'écriture du doc (« Mini boss », « Mini-Boss » -> 'mini_boss'). */
export const CATEGORIES = { ennemi_simple: 'Ennemi simple', mini_boss: 'Mini-boss', boss: 'Boss' };
const CLES_CATEGORIES = { 'ennemi-simple': 'ennemi_simple', 'mini-boss': 'mini_boss', boss: 'boss' };
export const categorieDe = (brut) => CLES_CATEGORIES[normalize(brut ?? '')] ?? null;

/** Les six caractéristiques, dans l'ordre F.P.V.S.I.A. (même ordre que creature_caracteristique). */
export const FPVSIA = ['force', 'perception', 'volonte', 'social', 'intelligence', 'agilite'];

const paragraphes = (texte) => (texte ? texte.split(/\n\n+/) : []);
const entiers = (texte) => [...String(texte ?? '').matchAll(/\d+/g)].map((m) => Number(m[0]));

/** Échelles couvertes par une écriture (« 2 », « 1-10 », « EP3, 5, 7 ») : [min, max], ou [null, null] sans nombre. */
export function bornes(texte) {
  const n = entiers(texte);
  return n.length ? [Math.min(...n), Math.max(...n)] : [null, null];
}

/**
 * Les échelles qu'écrit une carte ou une espèce (`monstre.echelle_brut`, `monstre_espece.ep_brut` : « 2 », « 1-10 », « 2-6 », « 3,5,7 », « 3, 5, 7 »,
 * « EP1 - 10 », « EP3, 5, 7 ») : la liste croissante, sans doublon. Une plage « a-b » donne toutes ses échelles, une liste seulement celles qu'elle nomme
 * (« 3, 5, 7 » : ni 4 ni 6) ; une écriture sans nombre, aucune. Le curseur d'échelle de la carte et le filtre EP du tableau la suivent (bornes() garde le
 * plus petit et le plus grand nombre : `ep_min`, `ep_max`, le tri).
 */
export function echellesEcrites(texte) {
  const eps = String(texte ?? '')
    .replace(/^\s*EP\s*/i, '')
    .split(/\s*,\s*/)
    .flatMap((p) => {
      const plage = p.trim().match(/^(\d+)\s*-\s*(\d+)$/);
      if (plage) {
        const [a, b] = [Number(plage[1]), Number(plage[2])];
        return a <= b ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : [];
      }
      return /^\d+$/.test(p.trim()) ? [Number(p.trim())] : [];
    });
  return [...new Set(eps)].sort((x, y) => x - y);
}

// Une ligne d'une rubrique écrite par échelle (carte qui « varie selon son échelle de puissance ») : « EP 2 - 5 : … », « EP3 : … », « [EP3] … »,
// « [EP3,5,7] … », avec une forme devant (« (Guerrier) EP 1 - 10 : 10 », « (Neige) [EP3] … ») ; la ligne à deux colonnes du doc (« EP 1 : 20 EP 6 : 140 »).
const LIGNE_PAR_ECHELLE = /^(\([^)\n]+\)\s*)?(?:\[EP\s*(\d[\d,\s-]*)\]\s*|EP\s*(\d[\d,\s-]*?)\s*:\s*)(.*)$/;
const DEUX_COLONNES = /^EP\s*\d+\s*:\s*\d[\d ]*\s+EP\s*\d+\s*:\s*\d[\d ]*$/;
// un titre de groupe seul sur sa ligne (« Neige », « Cristal », « Âme », « Sang ») : un mot, sa majuscule
const TITRE_DE_GROUPE = /^\p{Lu}[\p{Ll}’']+$/u;

/**
 * Le texte d'une rubrique découpé ligne à ligne pour le curseur d'échelle de la carte (lib/monstre-rendu.mjs) : chaque ligne écrite pour une ou plusieurs
 * échelles est un segment { eps, forme, etiquette, valeur, texte } (`etiquette` : « EP 2 - 5 » tel qu'écrit, `valeur` : la suite de la ligne) ; la ligne à
 * deux colonnes donne deux segments ; un titre de groupe (« Neige ») donne { titre } ; une ligne vide { vide: true } ; toute autre ligne { texte } (elle
 * reste affichée à toutes les échelles). Rien n'est calculé : chaque valeur est celle que la carte écrit pour cette échelle. Le texte des segments redonne
 * celui de la rubrique (aux espaces de la ligne à deux colonnes près).
 */
export function segmentsParEchelle(texte) {
  const sortie = [];
  for (const ligne of String(texte ?? '').split('\n')) {
    const l = ligne.trim();
    if (!l) {
      sortie.push({ vide: true });
      continue;
    }
    if (DEUX_COLONNES.test(l)) {
      for (const m of l.matchAll(/EP\s*(\d+)\s*:\s*(\d[\d ]*?)(?=\s+EP|\s*$)/g)) {
        sortie.push({ eps: [Number(m[1])], forme: null, etiquette: `EP ${m[1]}`, valeur: m[2].trim(), texte: m[0].trim() });
      }
      continue;
    }
    const m = l.match(LIGNE_PAR_ECHELLE);
    const eps = m ? echellesEcrites(m[2] ?? m[3]) : [];
    if (m && eps.length) {
      const etiquette = m[2] !== undefined ? `EP ${m[2].trim()}` : `EP ${m[3].trim()}`;
      sortie.push({ eps, forme: m[1]?.trim() ?? null, etiquette, valeur: m[4].trim(), texte: l });
      continue;
    }
    if (TITRE_DE_GROUPE.test(l)) sortie.push({ titre: l });
    else sortie.push({ texte: l });
  }
  return sortie;
}

/** Une rubrique écrite par échelle : au moins une ligne de segmentsParEchelle porte des échelles. */
export const parEchelle = (texte) => segmentsParEchelle(texte).some((s) => s.eps);

/**
 * « Pince - 2d10 + 2 dégâts d’estoc », « Bâton mal-foutue: 1d6 dégâts de frappe » -> { rang, nom, texte } ; une ligne sans « nom - texte » chiffré n'est pas
 * une attaque (« Arme de la créature : », « Se fier au dégâts moyen… », « EP 1 - 10 : Faux déformée… » d'une carte qui varie selon l'échelle).
 */
export function attaques(texte) {
  return String(texte ?? '')
    .split('\n')
    .map((l) => l.match(/^(.{1,60}?)(?:\s+[-–]\s+|\s*:\s+)(.*\d.*)$/))
    .filter((m) => m && !/^(\[?EP\s*\d|Arme de la créature)/i.test(m[1]))
    .map((m, k) => ({ rang: k + 1, nom: m[1].trim(), texte: m[2].trim() }));
}

/**
 * Capacités : un paragraphe « [EP2] Nom. Texte » ouvre une capacité ; un paragraphe qui ne commence pas par un nom (tableau, suite) continue la précédente.
 * Préfixe : les crochets et parenthèses avant le nom, tels qu'écrits (« [EP2] », « [Gauche] » d'une tête du Cerbère, « (Neige) [EP3] » d'une forme) ;
 * ep_min : le N du premier « [EPN] » du préfixe (capacité gagnée à partir de cette échelle), sinon NULL. Un premier paragraphe sans nom n'en a pas (nom NULL).
 */
export function capacites(texte) {
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

/**
 * L'objet du glossaire du butin (`monstre_butin_objet`) qu'une case de butin cite (demande du propriétaire : le contenu du glossaire « pour faire un
 * tooltip […] sur le butin concerné ») : son nom écrit tel quel (casse, accents, espaces et apostrophe compris ; seule la ligature compte pour ses deux
 * lettres : « Coeur polaire » cite « Cœur polaire ») en tête de la case, suivi de rien, d'une quantité (« x 1d6 », « x1 », « (1d4) ») ou d'une
 * amélioration (« + 1 », « +2 ») ; le nom le plus long l'emporte (« Gelée verte foncée » avant « Gelée verte »). Rien d'autre n'est rapproché
 * (« Peau de radrak » / « Peau du radrak », « Citron de foudre » / « Citron », « 4 os moyen » : à l'avis du propriétaire, docs/bestiaire.md).
 * `glossaire` : [{ id, nom }] ; -> { objet, ecrit, reste } (`ecrit` : le nom tel que la case l'écrit) ou null.
 */
const SUFFIXE_DU_BUTIN = /^(?:| x ?\d+(?:d\d+)?| \(\d+d\d+\)| ?\+ ?\d+)$/;
const sansLigature = (texte) => texte.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe');
export function objetDuButin(texte, glossaire = []) {
  const t = String(texte ?? '');
  for (const objet of [...glossaire].filter((g) => g.nom).sort((a, b) => b.nom.length - a.nom.length)) {
    const nom = sansLigature(objet.nom);
    // la longueur du nom dans la case (une ligature y vaut une ou deux lettres)
    for (let k = Math.max(1, nom.length - 3); k <= Math.min(t.length, nom.length + 3); k += 1) {
      if (sansLigature(t.slice(0, k)) === nom && SUFFIXE_DU_BUTIN.test(t.slice(k))) return { objet, ecrit: t.slice(0, k), reste: t.slice(k) };
    }
  }
  return null;
}

/** Cibles d'une rubrique de défense, quand elle est UNE liste « A, B, C » de noms courts ; sinon aucune (« Varie selon la magie », tableau…). */
export function cibles(texte) {
  if (!texte || texte.includes('\n')) return [];
  const morceaux = texte.split(/\s*,\s*/).map((m) => m.trim().replace(/\.$/, '')).filter(Boolean);
  if (!morceaux.every((m) => m.length <= 30 && !/[:.;]/.test(m) && !/^(varie|variable|selon|voir|aucun|rien)/i.test(m))) return [];
  return morceaux;
}

/** « Santé : 70 Chakra : 0 Barrière : 0 » (une seule ligne) -> { sante, chakra, barriere } ; sinon des NULL (valeurs par EP, gardées en texte). */
export function attributs(texte) {
  const a = String(texte ?? '').match(/^Santé\s*:\s*(\d+)\s+Chakra\s*:\s*(\d+)\s+Barrière\s*:\s*(\d+)$/);
  return { sante: a ? Number(a[1]) : null, chakra: a ? Number(a[2]) : null, barriere: a ? Number(a[3]) : null };
}

/**
 * « 4 armure physique / 2 armure magique (Peau) » ou « 4 AP / 2 AM » -> { armure_physique, armure_magique } ; « 0 points d'armure / 8 résistance magique »
 * n'est pas lu (le rapprochement de ces mots avec l'armure physique et magique attend le propriétaire : docs/bestiaire.md).
 */
export function defense(texte) {
  const d = String(texte ?? '').match(/^(\d+) (?:armure physique|AP) ?\/ ?(\d+) (?:armure magique|AM)\b/i);
  return { armure_physique: d ? Number(d[1]) : null, armure_magique: d ? Number(d[2]) : null };
}

/** « 4 cases sol / 4 cases nage » -> { vitesse_sol, vitesse_nage }. */
export function vitesse(texte) {
  const v = String(texte ?? '').match(/^(\d+) cases? sol \/ (\d+) cases? nage$/i);
  return { vitesse_sol: v ? Number(v[1]) : null, vitesse_nage: v ? Number(v[2]) : null };
}

/** « F : 6 / P : 4 / V : 6 / S : 2 / I : 3 / A : 6 » (une seule ligne) -> [{ caracteristique_id, rang, valeur }] ; sinon [] (valeurs par EP). */
export function caracteristiques(texte) {
  const f = String(texte ?? '').match(/^F\s*:\s*(\d+)\s*\/\s*P\s*:\s*(\d+)\s*\/\s*V\s*:\s*(\d+)\s*\/\s*S\s*:\s*(\d+)\s*\/\s*I\s*:\s*(\d+)\s*\/\s*A\s*:\s*(\d+)$/);
  return f ? FPVSIA.map((c, k) => ({ caracteristique_id: c, rang: k + 1, valeur: Number(f[k + 1]) })) : [];
}

/**
 * Tout ce que la base tire des rubriques d'une carte ([{ rubrique, texte }], dans l'ordre) : colonnes typées de `monstre` et lignes des tables de détail
 * (`monstre_caracteristique`, `monstre_attaque`, `monstre_capacite`, `monstre_defense`). La première rubrique d'une clé fait foi pour les valeurs uniques ;
 * les cibles de deux rubriques de même sens se suivent.
 */
export function valeursDeLaCarte(rubriques) {
  const de = (cle) => rubriques.find((r) => r.rubrique === cle)?.texte ?? '';
  return {
    ...attributs(de('attributs')),
    ...defense(de('defense')),
    ...vitesse(de('vitesse')),
    caracteristiques: caracteristiques(de('caracteristiques')),
    attaques: attaques(de('degats')),
    // un premier paragraphe sans nom reste dans le texte de la rubrique (aucune ligne : `monstre_capacite.nom` est obligatoire)
    capacites: capacites(de('capacites'))
      .filter((c) => c.nom !== null)
      .map((c, k) => ({ ...c, rang: k + 1 })),
    defenses: SENS_DEFENSE.flatMap((sens) =>
      rubriques
        .filter((r) => r.rubrique === sens)
        .flatMap((r) => cibles(r.texte))
        .map((cible, k) => ({ sens, rang: k + 1, cible, cible_cle: normalize(cible) })),
    ),
  };
}
