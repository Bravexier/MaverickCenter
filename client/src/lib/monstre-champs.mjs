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
