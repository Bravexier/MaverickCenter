// Les couleurs qu'un mot-clé peut prendre sur le site de dev (migration 0098 ; réponses du propriétaire du 2026-11-06, Q3 et Q4 : deux sélecteurs, « une
// liste des couleurs prédéfinies » — toutes les familles de la palette, lib/palette-css.mjs#FAMILLES_DE_LA_PALETTE, couleurs techniques et entrées
// « par défaut » comprises, groupées par famille, chaque couleur désignée par l'élément de référence (« Feu », « Chakra », « Mythril »…) — et un
// cercle qui donne une couleur écrite, « #rrggbb »). La page du Glossaire (pages/regles/glossaire.astro) la donne à son script et à l'éditeur
// (`data-couleurs`) : le navigateur n'importe jamais la palette (skill ui-couleurs). Chaque couleur : sa référence « famille:id » (ce que
// mot_cle.couleur enregistre ; id = celui de sa classe, lib/palette-css.mjs#idDeCouleur), son libellé, sa classe et son fond (pour le cercle).
// Les libellés viennent de la base quand elle nomme l'élément (magies, caractéristiques, postures, affinités et attributs, paliers de résistance, genres
// de sort, types de don, matériaux), des modules du site sinon (catégories de classe, parties du guide, types de dégâts : lib/arme-champs.mjs#LIBELLES_DES_DEGATS) ; à défaut, la clé du module mise en forme.
// Lu au build ; sans dépendance navigateur ni Astro.
import { LIBELLES_DES_DEGATS } from './arme-champs.mjs';
import { CLASS_GROUPS } from './class-groups.mjs';
import { PARTIES } from './livres.mjs';
import { couleursDeLaPalette, FAMILLES_DE_LA_PALETTE, idDeCouleur, PAR_DEFAUT } from './palette-css.mjs';
import { cleDeMagieConnue } from './sort-format.mjs';

/** Le nom de chaque famille de la palette, dans la liste (l'ordre : celui de FAMILLES_DE_LA_PALETTE). */
export const NOMS_DES_FAMILLES = Object.freeze({
  magie: 'Magies',
  attribut: 'Attributs',
  caracteristique: 'Caractéristiques',
  affinite: 'Affinités',
  posture: 'Postures',
  alignement: 'Alignements',
  classe: 'Catégories de classe',
  race: 'Natures de race',
  palier: 'Paliers de résistance',
  mode: 'Mode Hyper',
  neutre: 'Neutre',
  materiau: 'Matériaux',
  arme: 'Armes',
  armure: 'Types d’armure',
  poids: 'Poids des boucliers',
  degats: 'Types de dégâts',
  niveau: 'Niveaux des accessoires',
  partie: 'Parties du guide',
  genre: 'Genres de sort',
  don: 'Types de don',
  case: 'Cases de tableau',
});

/** Les libellés écrits ici, faute d'une table qui les nomme : une clé de module → son libellé, par famille. */
const LIBELLES_ECRITS = Object.freeze({
  race: { pure: 'Race pure', hybride: 'Race hybride' },
  mode: { hyper: 'Mode Hyper', cent: 'Mode Hyper 100 %' },
  arme: { depart: 'Armes de départ' },
  poids: { leger: 'Léger', moyen: 'Moyen', lourd: 'Lourd', 'tres-lourd': 'Très lourd' },
  degats: LIBELLES_DES_DEGATS,
});

/** Une clé de module mise en forme (« fer-noir » → « Fer noir ») ; « par-defaut » → « Par défaut ». */
export const libelleDeCle = (cle) => {
  if (cle === PAR_DEFAUT) return 'Par défaut';
  const t = String(cle).replace(/[-_]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : String(cle);
};

/** Une table de la base lue sans planter (une base d'essai ou d'avant une migration peut ne pas l'avoir) : [] sinon. */
const lignes = (db, sql) => {
  try {
    return db?.prepare(sql).all() ?? [];
  } catch {
    return [];
  }
};

/** Les libellés que la base donne : famille → Map(id de la classe → libellé). */
function libellesDeLaBase(db) {
  const parFamille = new Map();
  const poser = (famille, cle, libelle) => {
    if (!libelle) return;
    if (!parFamille.has(famille)) parFamille.set(famille, new Map());
    const m = parFamille.get(famille);
    if (!m.has(idDeCouleur(cle))) m.set(idDeCouleur(cle), String(libelle));
  };
  for (const r of lignes(db, 'SELECT nom FROM magie')) poser('magie', cleDeMagieConnue(r.nom) ?? r.nom, r.nom);
  for (const r of lignes(db, 'SELECT id, nom FROM caracteristique')) poser('caracteristique', r.id, r.nom);
  for (const r of lignes(db, 'SELECT id, nom FROM posture')) poser('posture', String(r.id).slice(String(r.id).lastIndexOf(':') + 1), r.nom);
  for (const r of lignes(db, 'SELECT id, libelle FROM affinite')) {
    poser('affinite', r.id, r.libelle);
    poser('attribut', r.id, r.libelle);
  }
  for (const r of lignes(db, 'SELECT id, libelle FROM resistance_palier')) poser('palier', r.id, r.libelle);
  for (const r of lignes(db, 'SELECT DISTINCT type, libelle FROM sort_type')) poser('genre', r.type, r.libelle);
  for (const r of lignes(db, 'SELECT id, nom FROM type_don')) poser('don', r.id, r.nom);
  for (const r of lignes(db, "SELECT id, nom FROM ressource WHERE id LIKE '%materiau:%'")) poser('materiau', String(r.id).slice(String(r.id).lastIndexOf(':') + 1), r.nom);
  for (const g of CLASS_GROUPS) poser('classe', g.key, g.label);
  for (const p of PARTIES) poser('partie', p.id, p.titre);
  return parFamille;
}

/**
 * Les couleurs proposées, groupées par famille : [{ famille, libelle, couleurs: [{ valeur: 'famille:id', libelle, classe, fond }] }], toutes les
 * familles de la palette, chacune dans l'ordre de son module. `db` : la base (lib/donnees.mjs#ouvrirBase) d'où viennent les libellés ; sans elle, ceux
 * des modules et les clés mises en forme.
 */
export function choixDesCouleurs(db = null) {
  const libelles = libellesDeLaBase(db);
  const groupes = new Map(Object.keys(FAMILLES_DE_LA_PALETTE).map((f) => [f, { famille: f, libelle: NOMS_DES_FAMILLES[f] ?? libelleDeCle(f), couleurs: [] }]));
  for (const c of couleursDeLaPalette()) {
    const id = idDeCouleur(c.cle);
    const libelle = libelles.get(c.famille)?.get(id) ?? LIBELLES_ECRITS[c.famille]?.[c.cle] ?? (c.famille === 'niveau' ? `Niveau ${c.cle}` : libelleDeCle(c.cle));
    groupes.get(c.famille).couleurs.push({ valeur: `${c.famille}:${id}`, libelle, classe: c.classe, fond: c.fond });
  }
  return [...groupes.values()];
}
