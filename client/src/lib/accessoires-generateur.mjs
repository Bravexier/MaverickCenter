// Générateur d'accessoires de la page /ressources/accessoires/ (demande du propriétaire, 2026-10-14 : « au lieu d'un tableau Markdown, un générateur
// d'accessoire ») : fonctions pures, sans dépendance, partagées par le gabarit (components/accessoires/AccessoiresPage.astro) et le script de la page
// (src/scripts/accessoires.mjs, le seul script de page qui importe ce module). Aucune règle n'est déduite : les dés sont ceux des tables de l'onglet
// (le plus grand jet écrit d'une table donne ses faces : 1d4, 1d100, 1d6, 1d20), la qualité de gemme d'un niveau est la phrase des règles de la page.

/**
 * Couleurs des niveaux (demande du propriétaire : « coloriser les lignes des effets et du produit final par le niveau de la même manière que l'Excel
 * d'origine ») : fond des cases « Niveau 1 » à « Niveau 5 » du tableau « Monture » de l'onglet « Accessoires » (capture fournie par le propriétaire le
 * 2026-10-14). Repère visuel sans valeur de règle ; le texte reste foncé sur ces fonds clairs, en thème sombre aussi.
 */
export const COULEURS_DES_NIVEAUX = { 1: '#d9ead3', 2: '#fff2cc', 3: '#fce5cd', 4: '#f4cccc', 5: '#e6b8af' };

/** Variable CSS `--niv` d'une ligne d'un niveau ; rien pour un niveau absent (« Niveau ? », ligne vide). */
export const styleDeNiveau = (niveau) => (COULEURS_DES_NIVEAUX[niveau] ? `--niv: ${COULEURS_DES_NIVEAUX[niveau]}` : undefined);

/**
 * Qualité de gemme d'un niveau d'accessoire, d'après les règles de la page : « Gemme classique = Accessoire niveau 1 et 2 », « Gemme raffinée =
 * Accessoire niveau 3 et 4 », « Gemme parfaite = Accessoire niveau 5 ». Clés = colonnes de la table `gemme` (`quart_commune_rf`…).
 */
export const QUALITES_DE_GEMME = [
  { id: 'commune', libelle: 'classique', niveaux: [1, 2] },
  { id: 'raffinee', libelle: 'raffinée', niveaux: [3, 4] },
  { id: 'parfaite', libelle: 'parfaite', niveaux: [5] },
];

/** La qualité de gemme d'un niveau ({ id, libelle, niveaux }), ou null (niveau inconnu). */
export const qualiteDeGemme = (niveau) => QUALITES_DE_GEMME.find((q) => q.niveaux.includes(Number(niveau))) ?? null;

/** Faces du dé d'une table : son plus grand jet écrit (« 1d4 » pour les jets 1 à 4, « 1d100 » pour les plages jusqu'à 100). */
export const facesDuDe = (jets) => Math.max(0, ...jets.map(Number).filter(Number.isFinite));

/** Un jet de 1 à `faces` ; `alea` rend un nombre dans [0, 1[ (Math.random par défaut, remplaçable pour les tests). */
export const lancer = (faces, alea = Math.random) => 1 + Math.min(faces - 1, Math.floor(alea() * faces));

/** L'élément dont la plage [min, max] contient `jet` (propriétés : 1-5, 6-20…), ou null. */
export const dansLaPlage = (plages, jet) => plages.find((p) => Number(p.min) <= jet && jet <= Number(p.max)) ?? null;

/**
 * Paramètres de l'adresse de la page : ?emplacement=<id>&propriete=<id>&effet=<fin de l'id de l'effet>&acquis=<jet>&monture=<niveau>&maudit=1.
 * `lireEtat` ne garde que des chaînes non vides ; `ecrireEtat` les remet dans le même ordre (les vides sont retirés).
 */
export const PARAMETRES = ['emplacement', 'propriete', 'effet', 'acquis', 'monture', 'maudit'];

export function lireEtat(recherche) {
  const p = new URLSearchParams(recherche);
  return Object.fromEntries(PARAMETRES.map((k) => [k, p.get(k) || null]).filter(([, v]) => v !== null));
}

export function ecrireEtat(recherche, etat) {
  const p = new URLSearchParams(recherche);
  for (const k of PARAMETRES) p.delete(k);
  for (const k of PARAMETRES) if (etat[k] !== undefined && etat[k] !== null && etat[k] !== '' && etat[k] !== false) p.set(k, String(etat[k] === true ? 1 : etat[k]));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Partie d'un identifiant d'effet après « #effet: » (« attaque:5 », « competence:force:2 ») : ce qui va dans l'adresse et dans `data-effet`. */
export const cleDEffet = (id) => String(id).slice(String(id).indexOf('#effet:') + 7);
