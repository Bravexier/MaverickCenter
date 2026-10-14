// Notes de version (page /mise-a-jour/, demande du propriétaire) : la liste de ce qui a changé dans les règles entre la base de PRODUCTION
// (master, la base « classique ») et la base de DEV (règles de dev + modifications faites sur le site de dev), domaine par domaine (sorts,
// magies, classes et leurs dons, races, métiers, guide, Codex, bestiaire, armes, composants). Une ligne par champ modifié d'une entité, avec l'ancienne et la nouvelle valeur et sa
// couleur (lib/notes-de-version-sens.mjs : critères du propriétaire, décision R29). Les champs listés sont ceux que le site de dev modifie
// (lib/edition-modele.mjs#TABLES) : tout le reste de la base en est dérivé (colonnes typées, `X_cle`, tables de détail, pages) et n'est pas listé.
// Les deux bases peuvent avoir des schémas différents (master est plus ancien) : une table ou une colonne absente d'un côté est tolérée.
// Fonctions pures, sans dépendance navigateur : le service (serveur/notes-de-version.mjs) et le processus de mise à jour
// (scripts/mise-a-jour-regles.mjs) lisent les tables puis appellent comparerBases ; la page affiche avec lib/notes-de-version-rendu.mjs.
import { CATEGORIES_DE_MONSTRE, OUI_NON, STATS_VARIABLES, TABLES } from './edition-modele.mjs';
import { MAINS } from './arme-champs.mjs';
import { sensDuChangement } from './notes-de-version-sens.mjs';
import { resumeDuPortrait } from './portrait.mjs';
import { ORDRE_DES_RACES } from './race-kinds.mjs';

/** Domaines de la liste, dans l'ordre d'affichage, avec leur titre. */
export const DOMAINES = [
  { id: 'sorts', titre: 'Sorts' },
  { id: 'magies', titre: 'Magies' },
  { id: 'classes', titre: 'Classes' },
  { id: 'races', titre: 'Races' },
  { id: 'metiers', titre: 'Métiers' },
  { id: 'guide', titre: 'Guide' },
  { id: 'codex', titre: 'Codex' },
  { id: 'bestiaire', titre: 'Bestiaire' },
  { id: 'armes', titre: 'Armes' },
  { id: 'composants', titre: 'Composants' },
];

/**
 * Tables de la section 15 de data/schema.sql : les notes de version et l'historique des modifications du site, écrites par chaque mise à jour
 * (scripts/mise-a-jour-regles.mjs). Ce sont des TRACES : note_version_ligne cite la production telle qu'elle était avant la livraison (`avant`,
 * et le nom d'une entité retirée), historique_modification les valeurs au moment de chaque modification, note_version le champ libre des admins.
 * Elles peuvent donc écrire une graphie, un nom ou un identifiant que les migrations ont corrigés depuis (master peut être bien plus ancien que
 * dev) : les contrôles qui balaient tout le texte de la base pour vérifier qu'une ancienne forme n'est pas revenue les sautent — le texte des
 * règles qu'elles citent est contrôlé dans sa propre table.
 */
export const TABLES_DES_NOTES = Object.freeze(['note_version', 'note_version_ligne', 'historique_modification']);

/** Tables que les appelants doivent lire dans chaque base (celles qui manquent dans une base sont simplement absentes). */
export const TABLES_LUES = [
  'sort', 'magie', 'magie_role', 'mode_hyper_effet', 'classe', 'categorie_classe', 'specialite', 'capacite', 'race', 'race_onglet', 'race_don',
  'race_don_tableau_colonne', 'race_don_tableau_cellule', 'race_magie', 'race_magie_onglet', 'peuple', 'relation_peuple', 'echelle_relation',
  'metier', 'caracteristique', 'page', 'monstre_espece', 'monstre', 'monstre_rubrique', 'monstre_espece_bloc', 'monstre_butin',
  'arme', 'arme_famille', 'arme_type', 'materiau_arme', 'ressource', 'amelioration_equipement', 'gemme', 'bois', 'ingredient_alchimie', 'monnaie',
];

/** Les ressources de la page des composants, par genre (dans l'ordre de la page), et leur groupe dans la note. */
const GROUPES_DE_COMPOSANT = {
  materiau: 'Matériaux', gemme: 'Gemmes', bois: 'Bois', ingredient_alchimie: 'Ingrédients d’alchimie', produit: 'Produits non monétaires', materiel: 'Matos',
};
const colonnesDe = (table) => Object.entries(TABLES[table].colonnes).map(([colonne, c]) => ({ colonne, libelle: c.libelle }));
/** Le cadrage d'un portrait n'est pas une ligne à lui : il est dit avec l'image (portraitDit). */
const CADRAGE = ['portrait_x', 'portrait_y', 'portrait_zoom'];
const sansCadrage = (table) => colonnesDe(table).filter((c) => !CADRAGE.includes(c.colonne));
/**
 * Un portrait (migration 0033) dit sans recopier l'image : son empreinte, son poids et son cadrage (« image 3f2a9c01 (84 Ko), cadrage 0.5 × 0.5,
 * zoom 1 ») — une image changée ou seulement recadrée fait une ligne de la note ; null sans image.
 */
const portraitDit = (v, ligne) => (v ? `${resumeDuPortrait(v)}, cadrage ${ligne?.portrait_x ?? 0.5} × ${ligne?.portrait_y ?? 0.5}, zoom ${ligne?.portrait_zoom ?? 1}` : null);
const texte = (v) => (v === null || v === undefined ? null : String(v).replace(/\r\n?/g, '\n').trim() || null);
const pareil = (a, b) => texte(a) === texte(b);
const cleTriee = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const lignesDe = (base, table) => base?.tables?.[table] ?? null;
const indexer = (rows, cle) => new Map((rows ?? []).map((r) => [cle.map((c) => String(r[c])).join('\u0000'), r]));
const parId = (rows) => new Map((rows ?? []).map((r) => [r.id, r]));

/** Libellés des catégories de monstre et de la phrase « varie selon l'échelle » (lib/edition-modele.mjs : CATEGORIES_DE_MONSTRE, STATS_VARIABLES). */
const libelleDeChoix = (choix, v) => choix.find((c) => c.valeur === String(v))?.libelle ?? v;

/**
 * Définition de chaque table comparée : domaine, clé, colonnes listées, filtre des lignes, groupe et nom de l'entité, ordre d'affichage.
 * `ctx` = { dev, ref } : tables indexées des deux bases (une ligne se nomme d'après la base où elle existe, de préférence dev).
 * `detail` : une ligne qui n'existe qu'avec une autre (la rubrique d'une carte, le butin d'une espèce) ; seul un champ modifié est listé, son ajout ou
 * son retrait est dit par l'entité qui la porte. `resume(n)` : un contenu entièrement nouveau (aucune ligne en production : le Codex, le bestiaire
 * à leur première livraison) est dit en une ligne (« 116 pages du Codex »), pas entité par entité.
 */
const DEFINITIONS = [
  {
    table: 'sort', domaine: 'sorts', cle: ['id'], colonnes: colonnesDe('sort'), genre: 'Sort',
    groupe: (r, x) => x.nom('magie', r.magie_id), entite: (r) => r.nom,
    ordre: (r, x) => [x.ordre('magie', r.magie_id), r.niveau ?? 0, r.ordre ?? 0, r.nom],
  },
  {
    table: 'magie', domaine: 'magies', cle: ['id'], colonnes: colonnesDe('magie'), genre: 'Magie',
    groupe: (r) => r.nom, entite: (r) => r.nom, ordre: (r) => [r.ordre ?? 0, r.nom],
  },
  {
    table: 'magie_role', domaine: 'magies', cle: ['magie_id', 'rang'], colonnes: [{ colonne: 'role_brut', libelle: 'Rôle' }], genre: 'Rôle',
    groupe: (r, x) => x.nom('magie', r.magie_id), entite: (r) => `Rôle ${r.rang}`, ordre: (r, x) => [x.ordre('magie', r.magie_id), r.rang],
  },
  {
    // capacité Mode Hyper : seules les versions affichées par les pages (onglet de la magie, onglet de la race) se modifient
    table: 'mode_hyper_effet', domaine: (r) => (r.version === 'onglet_race' ? 'races' : 'magies'), cle: ['id'], genre: 'Capacité Mode Hyper',
    filtre: (r) => r.version === 'onglet_magie' || r.version === 'onglet_race', colonnes: colonnesDe('mode_hyper_effet'),
    groupe: (r, x) => (r.version === 'onglet_race' ? x.nom('race', r.race_id) : x.nom('magie', r.magie_id)),
    entite: (r) => `Capacité Mode Hyper${r.variante_brut ? ` (${r.variante_brut})` : ''}`,
    ordre: (r, x) => (r.version === 'onglet_race' ? [x.ordreRace(r.race_id), r.rang ?? 0] : [x.ordre('magie', r.magie_id), r.rang ?? 0]),
  },
  {
    table: 'classe', domaine: 'classes', cle: ['id'], colonnes: colonnesDe('classe'), genre: 'Classe',
    groupe: (r) => r.nom, entite: (r) => r.nom, ordre: (r, x) => [x.ordre('categorie_classe', r.categorie_id), r.ordre ?? 0, 0, 0, r.nom],
  },
  {
    table: 'specialite', domaine: 'classes', cle: ['id'], colonnes: colonnesDe('specialite'), genre: 'Spécialité',
    groupe: (r, x) => x.nom('classe', r.classe_id), entite: (r) => `Spécialité ${r.nom}`,
    ordre: (r, x) => [...x.ordreClasse(r.classe_id), 1, r.rang ?? 0, r.nom],
  },
  {
    table: 'capacite', domaine: 'classes', cle: ['id'], colonnes: colonnesDe('capacite'), genre: 'Don',
    groupe: (r, x) => x.nom('classe', r.classe_id),
    entite: (r, x) => {
      const specialite = r.specialite_id ? x.nom('specialite', r.specialite_id) : null;
      return `Don ${specialite ? `${specialite} › ` : ''}${r.nom}`;
    },
    ordre: (r, x) => [...x.ordreClasse(r.classe_id), 2, r.niveau ?? 0, r.ligne ?? 0, r.rang ?? 0, r.nom],
  },
  {
    table: 'race', domaine: 'races', cle: ['id'], colonnes: colonnesDe('race'), genre: 'Race',
    groupe: (r) => r.nom, entite: (r) => r.nom, ordre: (r, x) => [x.ordreRace(r.id), 0],
  },
  {
    table: 'race_onglet', domaine: 'races', cle: ['race_id'], colonnes: colonnesDe('race_onglet'), genre: 'Onglet de la race',
    groupe: (r, x) => x.nom('race', r.race_id), entite: (r, x) => x.nom('race', r.race_id), ordre: (r, x) => [x.ordreRace(r.race_id), 1],
  },
  {
    table: 'race_don', domaine: 'races', cle: ['id'], colonnes: colonnesDe('race_don'), genre: 'Don racial',
    groupe: (r, x) => x.nom('race', r.race_id), entite: (r) => `Don racial ${r.nom || r.etiquette || r.id}`,
    ordre: (r, x) => [x.ordreRace(r.race_id), 2, r.rang ?? 0],
  },
  {
    table: 'race_don_tableau_colonne', domaine: 'races', cle: ['race_id', 'rang'], colonnes: colonnesDe('race_don_tableau_colonne'),
    genre: 'En-tête du tableau', groupe: (r, x) => x.nom('race', r.race_id), entite: (r) => `Tableau des dons : en-tête ${r.rang}`,
    ordre: (r, x) => [x.ordreRace(r.race_id), 3, r.rang],
  },
  {
    table: 'race_don_tableau_cellule', domaine: 'races', cle: ['race_id', 'ligne', 'colonne'], colonnes: colonnesDe('race_don_tableau_cellule'),
    genre: 'Case du tableau', groupe: (r, x) => x.nom('race', r.race_id),
    entite: (r, x) => `Tableau des dons : ${x.caseDuTableau(r)}`, ordre: (r, x) => [x.ordreRace(r.race_id), 4, r.ligne, r.colonne],
  },
  {
    table: 'metier', domaine: 'metiers', cle: ['id'], colonnes: colonnesDe('metier'), genre: 'Métier',
    groupe: () => null, entite: (r) => r.nom, ordre: (r) => [r.nom],
    // les caractéristiques de l'artisanat (décision R34) se lisent par leur nom, pas par leur identifiant
    valeur: (colonne, v, x) => (colonne.startsWith('test_carac_') && v ? x.nom('caracteristique', v) : v),
  },
  {
    table: 'page', domaine: 'guide', cle: ['id'], colonnes: colonnesDe('page'), genre: 'Page du guide',
    filtre: (r) => r.type === 'guide' && r.statut !== 'example',
    groupe: (r) => {
      const n = chapitreDe(r);
      return n ? `Chapitre ${n}` : 'Pages de référence';
    },
    entite: (r) => r.titre, ordre: (r) => [chapitreDe(r) ?? 999, r.titre],
  },
  {
    // les pages du Codex (lore tiré du Google Doc « CODEX Maverick », famille docs : lib/edition-modele.mjs#texteDePageModifiable)
    table: 'page', domaine: 'codex', cle: ['id'], colonnes: colonnesDe('page'), genre: 'Page du Codex',
    filtre: (r) => r.type === 'lore' && r.origine === 'docs' && r.statut !== 'example',
    groupe: () => null, entite: (r) => r.titre, ordre: (r) => [r.titre], resume: (n) => `${n} pages du Codex`,
  },
  {
    table: 'monstre_espece', domaine: 'bestiaire', cle: ['id'], colonnes: sansCadrage('monstre_espece'), genre: 'Espèce',
    groupe: (r) => r.nom, entite: (r) => r.nom, ordre: (r) => [r.ordre ?? 0, 0], resume: (n) => `${n} espèces`,
    valeur: (colonne, v, _x, ligne) => (colonne === 'portrait' ? portraitDit(v, ligne) : v),
  },
  {
    table: 'monstre', domaine: 'bestiaire', cle: ['id'], colonnes: sansCadrage('monstre'), genre: 'Monstre',
    groupe: (r, x) => x.nom('monstre_espece', r.espece_id), entite: (r) => r.nom,
    ordre: (r, x) => [x.ordre('monstre_espece', r.espece_id), 1, r.rang ?? 0, 0], resume: (n) => `${n} monstres`,
    valeur: (colonne, v, _x, ligne) => (colonne === 'categorie' ? libelleDeChoix(CATEGORIES_DE_MONSTRE, v)
      : colonne === 'variable' ? libelleDeChoix(STATS_VARIABLES, v) : colonne === 'portrait' ? portraitDit(v, ligne) : v),
  },
  {
    table: 'monstre_rubrique', domaine: 'bestiaire', cle: ['monstre_id', 'rang'], colonnes: colonnesDe('monstre_rubrique'), genre: 'Rubrique', detail: true,
    groupe: (r, x) => x.nom('monstre_espece', x.ligne('monstre', r.monstre_id)?.espece_id),
    entite: (r, x) => `${x.nom('monstre', r.monstre_id)} › ${r.titre ?? 'Santé, chakra, barrière'}`,
    ordre: (r, x) => [x.ordre('monstre_espece', x.ligne('monstre', r.monstre_id)?.espece_id), 1, x.ligne('monstre', r.monstre_id)?.rang ?? 0, 1, r.rang],
  },
  {
    table: 'monstre_espece_bloc', domaine: 'bestiaire', cle: ['espece_id', 'rang'], colonnes: colonnesDe('monstre_espece_bloc'), genre: 'Bloc', detail: true,
    groupe: (r, x) => x.nom('monstre_espece', r.espece_id), entite: (r, x) => `${x.nom('monstre_espece', r.espece_id)} › ${r.titre}`,
    ordre: (r, x) => [x.ordre('monstre_espece', r.espece_id), 2, r.rang],
  },
  {
    table: 'monstre_butin', domaine: 'bestiaire', cle: ['espece_id', 'rang', 'categorie'], colonnes: colonnesDe('monstre_butin'), genre: 'Butin', detail: true,
    groupe: (r, x) => x.nom('monstre_espece', r.espece_id),
    entite: (r, x) => `${x.nom('monstre_espece', r.espece_id)} › butin ${r.score_brut} (${libelleDeChoix(CATEGORIES_DE_MONSTRE, r.categorie)})`,
    ordre: (r, x) => [x.ordre('monstre_espece', r.espece_id), 3, r.rang, ['ennemi_simple', 'mini_boss', 'boss'].indexOf(r.categorie)],
  },
  // la page des armes (migration 0034) : une arme sous sa famille, puis les matériaux, puis les améliorations d'arme
  {
    table: 'arme', domaine: 'armes', cle: ['id'], colonnes: colonnesDe('arme'), genre: 'Arme',
    groupe: (r, x) => x.nom('arme_famille', r.famille_id), entite: (r) => r.nom, ordre: (r, x) => [1, x.ordre('arme_famille', r.famille_id), r.ordre ?? 0],
    valeur: (colonne, v, x) =>
      colonne === 'depart_possible' ? libelleDeChoix(OUI_NON, v)
        : colonne === 'mains' ? (v ? libelleDeChoix(MAINS, v) : v)
          : colonne === 'type_id' ? x.nom('arme_type', v) : v,
  },
  {
    table: 'materiau_arme', domaine: 'armes', cle: ['ressource_id'], colonnes: colonnesDe('materiau_arme'), genre: 'Matériau',
    groupe: () => 'Matériaux', entite: (r, x) => x.nom('ressource', r.ressource_id), ordre: (r) => [2, r.ordre ?? 0],
  },
  {
    table: 'amelioration_equipement', domaine: 'armes', cle: ['id'], colonnes: colonnesDe('amelioration_equipement'), genre: 'Amélioration',
    filtre: (r) => r.cible === 'arme', groupe: () => 'Améliorations', entite: (r) => `Amélioration +${r.niveau}`, ordre: (r) => [3, r.niveau],
  },
  // la page des composants (migration 0040) : monnaies, puis les ressources par tableau (matériaux, gemmes et leurs prix, bois, ingrédients d'alchimie,
  // objets de l'onglet « Équipement inventaire ») ; les potions, livres et parchemins (consommables) n'en sont pas
  {
    table: 'monnaie', domaine: 'composants', cle: ['id'], colonnes: colonnesDe('monnaie'), genre: 'Monnaie',
    groupe: () => 'Monnaie', entite: (r) => r.nom, ordre: (r) => [0, r.valeur_rf ?? 0],
  },
  {
    table: 'ressource', domaine: 'composants', cle: ['id'], colonnes: colonnesDe('ressource'), genre: 'Composant', filtre: (r) => GROUPES_DE_COMPOSANT[r.genre] !== undefined,
    groupe: (r) => (['produit', 'materiel'].includes(r.genre) && r.section ? `${GROUPES_DE_COMPOSANT[r.genre]} › ${r.section}` : GROUPES_DE_COMPOSANT[r.genre]),
    entite: (r) => r.nom, ordre: (r) => [1, Object.keys(GROUPES_DE_COMPOSANT).indexOf(r.genre), r.section ?? '', r.ordre ?? 0],
  },
  {
    table: 'gemme', domaine: 'composants', cle: ['ressource_id'], colonnes: colonnesDe('gemme'), genre: 'Gemme', detail: true,
    groupe: () => GROUPES_DE_COMPOSANT.gemme, entite: (r, x) => x.nom('ressource', r.ressource_id), ordre: (r, x) => [1, 1, '', x.ordre('ressource', r.ressource_id)],
  },
  {
    table: 'ingredient_alchimie', domaine: 'composants', cle: ['ressource_id'], colonnes: colonnesDe('ingredient_alchimie'), genre: 'Ingrédient', detail: true,
    groupe: () => GROUPES_DE_COMPOSANT.ingredient_alchimie, entite: (r, x) => x.nom('ressource', r.ressource_id),
    ordre: (r, x) => [1, 3, x.ligne('ressource', r.ressource_id)?.section ?? '', x.ordre('ressource', r.ressource_id)],
  },
];

function chapitreDe(page) {
  try {
    return JSON.parse(page.donnees ?? 'null')?.chapitre ?? null;
  } catch {
    return null;
  }
}

/** Contexte de nommage : noms et ordres lus d'abord dans dev, puis dans la référence (entité retirée). */
function contexte(ref, dev) {
  const index = (base) => Object.fromEntries(['magie', 'classe', 'specialite', 'race', 'categorie_classe', 'peuple', 'caracteristique', 'monstre_espece', 'monstre',
    'arme_famille', 'arme_type', 'ressource']
    .map((t) => [t, parId(lignesDe(base, t))]));
  const d = index(dev);
  const r = index(ref);
  const ligne = (table, id) => d[table].get(id) ?? r[table].get(id) ?? null;
  const entetes = (base) => indexer(lignesDe(base, 'race_don_tableau_colonne'), ['race_id', 'rang']);
  const cellules = (base) => indexer(lignesDe(base, 'race_don_tableau_cellule'), ['race_id', 'ligne', 'colonne']);
  const tetes = [entetes(dev), entetes(ref)];
  const cases = [cellules(dev), cellules(ref)];
  const trouver = (maps, cle) => maps.map((m) => m.get(cle)).find(Boolean) ?? null;
  return {
    ligne,
    nom: (table, id) => {
      const l = ligne(table, id);
      return l?.nom ?? l?.libelle ?? (id ? String(id) : null);
    },
    ordre: (table, id) => ligne(table, id)?.ordre ?? 0,
    ordreClasse: (id) => {
      const c = ligne('classe', id);
      return [ligne('categorie_classe', c?.categorie_id)?.ordre ?? 0, c?.ordre ?? 0];
    },
    ordreRace: (id) => {
      const i = ORDRE_DES_RACES.indexOf(id);
      return i < 0 ? ORDRE_DES_RACES.length + (ligne('race', id)?.ordre ?? 0) : i;
    },
    // une case du tableau en panneaux : « Feu × Compétence » (première case de sa ligne × en-tête de sa colonne)
    caseDuTableau: (c) => {
      const tete = trouver(tetes, `${c.race_id}\u0000${c.colonne}`)?.libelle ?? `colonne ${c.colonne}`;
      const premiere = c.colonne === 1 ? null : trouver(cases, `${c.race_id}\u0000${c.ligne}\u00001`)?.valeur;
      return premiere ? `${premiere} × ${tete}` : `ligne ${c.ligne} × ${tete}`;
    },
  };
}

/** Une ligne de la liste, avec son sens (couleur). */
function ligneDeNote({ def, domaine, groupe, entite, ordre, champ, colonne, nature, avant, apres, cle }) {
  // un champ rempli ou vidé a aussi son sens (effet secondaire ajouté = amélioration, R29) ; une entité ajoutée ou retirée est neutre
  const s = colonne ? sensDuChangement(def.table, colonne, avant, apres) : { sens: 'neutre', parties: null };
  return {
    domaine, groupe: groupe ?? null, entite, champ: champ ?? null, nature, avant: texte(avant), apres: texte(apres), sens: s.sens,
    parties: s.parties?.length ? s.parties : null, table_nom: def.table, cle: cleTriee(cle), colonne: colonne ?? null, ordre,
  };
}

/** Les lignes d'une table : entités ajoutées, retirées, champs modifiés (colonnes absentes d'un côté : valeur ajoutée ou retirée). */
function comparerTable(def, ref, dev, x) {
  const refRows = lignesDe(ref, def.table);
  const devRows = lignesDe(dev, def.table);
  if (!devRows && !refRows) return [];
  const garder = (rows) => (rows ?? []).filter((r) => !def.filtre || def.filtre(r));
  const a = indexer(garder(refRows), def.cle);
  const b = indexer(garder(devRows), def.cle);
  const colonnesRef = refRows?.[0] ? new Set(Object.keys(refRows[0])) : null;
  const sortie = [];
  const decrire = (r) => {
    const domaine = typeof def.domaine === 'function' ? def.domaine(r) : def.domaine;
    return { def, domaine, groupe: def.groupe(r, x), entite: def.entite(r, x) || '—', ordre: def.ordre(r, x), cle: Object.fromEntries(def.cle.map((c) => [c, r[c]])) };
  };
  // un contenu entièrement nouveau : une ligne, pas une par entité
  if (def.resume && !a.size && b.size > 1) {
    const domaine = typeof def.domaine === 'function' ? def.domaine([...b.values()][0]) : def.domaine;
    return [ligneDeNote({ def, domaine, groupe: null, entite: def.resume(b.size), ordre: [-1], champ: null, nature: 'ajoute', avant: null, apres: def.resume(b.size), cle: {} })];
  }
  for (const [k, r] of b) {
    const avant = a.get(k);
    const base = decrire(r);
    if (!avant) {
      if (def.detail) continue; // dit par l'entité qui la porte
      // une table absente de la production (schéma plus ancien) : l'entité existait peut-être, mais pas ce contenu ; on le dit ajouté
      sortie.push(ligneDeNote({ ...base, champ: refRows ? null : def.genre, nature: 'ajoute', avant: null, apres: def.entite(r, x) }));
      continue;
    }
    def.colonnes.forEach(({ colonne, libelle }, i) => {
      const absente = colonnesRef && !colonnesRef.has(colonne);
      const lire = (v, ligne) => (def.valeur ? def.valeur(colonne, v, x, ligne) : v);
      const v1 = lire(absente ? null : avant[colonne], avant);
      const v2 = lire(r[colonne], r);
      if (pareil(v1, v2)) return;
      const nature = texte(v1) === null ? 'ajoute' : texte(v2) === null ? 'retire' : 'modifie';
      sortie.push(ligneDeNote({ ...base, ordre: [...base.ordre, i], champ: libelle, colonne, nature, avant: v1, apres: v2 }));
    });
  }
  for (const [k, r] of a) {
    if (b.has(k) || def.detail) continue;
    sortie.push(ligneDeNote({ ...decrire(r), champ: devRows ? null : def.genre, nature: 'retire', avant: def.entite(r, x), apres: null }));
  }
  return sortie;
}

/** Magies innées d'une race (la liste de l'onglet si elle en a une, sinon la matrice : décisions R11, R8), comme la page de la race. */
function magiesInnees(base, x) {
  const parRace = new Map();
  const onglet = lignesDe(base, 'race_magie_onglet');
  const matrice = lignesDe(base, 'race_magie');
  const ajouter = (race, magie) => {
    if (!parRace.has(race)) parRace.set(race, new Set());
    parRace.get(race).add(magie);
  };
  const avecOnglet = new Set((onglet ?? []).map((l) => l.race_id));
  for (const l of onglet ?? []) ajouter(l.race_id, l.magie_id);
  for (const l of matrice ?? []) if (l.accessible === 1 && !avecOnglet.has(l.race_id)) ajouter(l.race_id, l.magie_id);
  for (const r of lignesDe(base, 'race') ?? []) if (!parRace.has(r.id)) parRace.set(r.id, new Set());
  const nommer = (ids) => [...ids].sort((p, q) => x.ordre('magie', p) - x.ordre('magie', q)).map((id) => x.nom('magie', id)).join(', ');
  return { parRace, nommer };
}

function comparerMagiesInnees(ref, dev, x) {
  if (!lignesDe(dev, 'race')) return [];
  const a = magiesInnees(ref, x);
  const b = magiesInnees(dev, x);
  const sortie = [];
  const def = { table: 'race_magie' };
  for (const [race, magies] of b.parRace) {
    const avant = a.parRace.get(race);
    if (!avant) continue; // race ajoutée : déjà dite par la table race
    const v1 = a.nommer(avant);
    const v2 = b.nommer(magies);
    if (v1 === v2) continue;
    sortie.push(ligneDeNote({
      def, domaine: 'races', groupe: x.nom('race', race), entite: x.nom('race', race), ordre: [x.ordreRace(race), 5], champ: 'Magies innées',
      colonne: null, nature: v1 ? (v2 ? 'modifie' : 'retire') : 'ajoute', avant: v1 || null, apres: v2 || null, cle: { race_id: race },
    }));
  }
  return sortie;
}

/** Relations entre peuples : « <peuple> voit <peuple> : Neutre → Haine » (sens R12 : la ligne voit la colonne). */
function comparerRelations(ref, dev, x) {
  const devRows = lignesDe(dev, 'relation_peuple');
  if (!devRows) return [];
  const echelles = new Map([...(lignesDe(ref, 'echelle_relation') ?? []), ...(lignesDe(dev, 'echelle_relation') ?? [])].map((e) => [e.id, e.libelle]));
  const a = indexer(lignesDe(ref, 'relation_peuple'), ['ligne_peuple_id', 'colonne_peuple_id']);
  const b = indexer(devRows, ['ligne_peuple_id', 'colonne_peuple_id']);
  const def = { table: 'relation_peuple' };
  const sortie = [];
  const peupleDe = (id) => x.nom('peuple', id);
  const raceDuPeuple = (id) => {
    const p = [lignesDe(dev, 'peuple'), lignesDe(ref, 'peuple')].map((rows) => (rows ?? []).find((l) => l.id === id)).find(Boolean);
    return p?.race_id ?? null;
  };
  const ligne = (r, nature, v1, v2) => {
    const race = raceDuPeuple(r.ligne_peuple_id);
    sortie.push(ligneDeNote({
      def, domaine: 'races', groupe: race ? x.nom('race', race) : 'Relations entre peuples', entite: `${peupleDe(r.ligne_peuple_id)} voit ${peupleDe(r.colonne_peuple_id)}`,
      ordre: [race ? x.ordreRace(race) : 999, 6, x.ordre('peuple', r.ligne_peuple_id), x.ordre('peuple', r.colonne_peuple_id)], champ: 'Relation',
      colonne: 'echelle_id', nature, avant: v1 && (echelles.get(v1) ?? v1), apres: v2 && (echelles.get(v2) ?? v2),
      cle: { ligne_peuple_id: r.ligne_peuple_id, colonne_peuple_id: r.colonne_peuple_id },
    }));
  };
  for (const [k, r] of b) {
    const avant = a.get(k);
    if (!avant) ligne(r, 'ajoute', null, r.echelle_id);
    else if (avant.echelle_id !== r.echelle_id) ligne(r, 'modifie', avant.echelle_id, r.echelle_id);
  }
  for (const [k, r] of a) if (!b.has(k)) ligne(r, 'retire', r.echelle_id, null);
  return sortie;
}

const comparerOrdres = (p, q) => {
  for (let i = 0; i < Math.max(p.length, q.length); i++) {
    const u = p[i] ?? '';
    const v = q[i] ?? '';
    if (u === v) continue;
    if (typeof u === 'number' && typeof v === 'number') return u - v;
    return String(u).localeCompare(String(v), 'fr', { numeric: true });
  }
  return 0;
};

/**
 * La liste des modifications de la production (`ref`) à la dev (`dev`) : [{ domaine, groupe, entite, champ, nature, avant, apres, sens, parties,
 * table_nom, cle, colonne, rang }], dans l'ordre d'affichage (domaine, groupe, entité, champ). `ref` / `dev` = { tables: { <table>: lignes[] } }
 * pour les tables de TABLES_LUES (une table absente d'une base : undefined).
 */
export function comparerBases(ref, dev) {
  const x = contexte(ref, dev);
  const lignes = [
    ...DEFINITIONS.flatMap((def) => comparerTable(def, ref, dev, x)),
    ...comparerMagiesInnees(ref, dev, x),
    ...comparerRelations(ref, dev, x),
  ];
  const rangDomaine = (d) => DOMAINES.findIndex((x_) => x_.id === d);
  lignes.sort((p, q) => rangDomaine(p.domaine) - rangDomaine(q.domaine) || comparerOrdres(p.ordre, q.ordre));
  return lignes.map(({ ordre: _o, ...l }, i) => ({ ...l, rang: i + 1 }));
}

/** Compte des lignes par sens et par domaine (en-tête de la page). */
export function bilan(lignes) {
  const b = { total: lignes.length, amelioration: 0, affaiblissement: 0, neutre: 0, parDomaine: {} };
  for (const l of lignes) {
    b[l.sens] += 1;
    b.parDomaine[l.domaine] = (b.parDomaine[l.domaine] ?? 0) + 1;
  }
  return b;
}

/** « X.Y » d'une version « X.Y.Z » (la production ne montre que deux chiffres). */
export const versionCourte = (version) => String(version).split('.').slice(0, 2).join('.');

/**
 * La version que la prochaine livraison dev → master donnera (même règle que tools/flux-git/regles.mjs#planifier : X.Y+1 à partir de la plus haute
 * des deux versions), en X.Y. `majeure` : la PR de livraison porte [V: X+1] (signal du propriétaire seulement).
 */
export function versionDeLivraison(versionDev, versionMaster, { majeure = false } = {}) {
  const lire = (v) => String(v ?? '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [lire(versionDev), lire(versionMaster)];
  const haute = comparerOrdres(a, b) >= 0 ? a : b;
  return majeure ? `${haute[0] + 1}.0` : `${haute[0]}.${haute[1] + 1}`;
}

/** Versions triées de la plus récente à la plus ancienne (« 0.10 » après « 0.9 »). */
export const trierVersions = (versions) => [...versions].sort((p, q) => comparerOrdres(String(q).split('.').map(Number), String(p).split('.').map(Number)));
