// Page /bestiaire/ (demande du propriétaire, 2026-10-11 : « Un tableau immense, avec menu de recherche et filtre. On peut choisir filtrer plusieurs
// champs » ; « Les créatures invoquées doivent être dans une catégorie à part car ils ne fonctionnent pas tout à fait pareillement ») : deux catégories,
// chacune son tableau, ses filtres et sa recherche (components/bestiaire/).
//   * Monstres : les tables du « Bestiaire 2.0 » (data/schema.sql, section 8 bis) ; une ligne par carte (ennemi simple, mini-boss, boss), et une ligne
//     par espèce qui n'a pas encore de carte (description seule : la plupart des Ottar). Une espèce d'un groupe (`monstre_groupe`, décision R64 : les
//     Ottar) prend son nom dans la colonne Espèce, son filtre et « Même espèce ».
//   * Créatures invoquées : les tables des invocations (section 8) ; une ligne par créature.
// Chaque ligne porte ce que le tableau affiche, le texte de sa carte (à côté du tableau), son portrait (migration 0033) et ses valeurs de filtre
// (`facettes` : clé -> valeurs) et de tri (`tri`), pour les colonnes affichées seulement (« Inutile de filtrer par les colonnes non affichées »).
// Rien n'est calculé ni déduit : une valeur que la base n'a pas typée reste son texte (`*_brut`, rubriques) ; les libellés des filtres sont l'écriture
// la plus fréquente de chaque valeur dans la base (« Non-mort » réunit « Non-mort » et « Non-Mort »).
// `chargerBestiaire` reçoit la base ouverte par lib/donnees.mjs (build) ; module sans dépendance navigateur ni Astro.
import { echellesEcrites, magiesDesCibles as tableDesCibles, RENVOI_AUX_DEGATS_MOYENS } from './monstre-champs.mjs';
import { coutEnUneCase } from './sort-cout.mjs';
import { normalize } from './text.mjs';

/** Libellés des catégories de monstre (colonne `categorie`). */
export const CATEGORIES = { ennemi_simple: 'Ennemi simple', mini_boss: 'Mini-boss', boss: 'Boss' };

/** Rubriques d'une carte : libellé de la fiche, et les rubriques de défense rangées par colonne du tableau. */
const LIBELLES_RUBRIQUES = {
  attributs: 'Santé, chakra, barrière',
  sante: 'Santé',
  chakra: 'Chakra',
  barriere: 'Barrière',
  degats: 'Dégâts',
  defense: 'Défense',
  vitesse: 'Vitesse',
  caracteristiques: 'Caractéristiques (F.P.V.S.I.A.)',
  competences: 'Compétence(s) secondaire(s)',
  vulnerabilite: 'Vulnérabilité(s)',
  grande_vulnerabilite: 'Grande(s) vulnérabilité(s)',
  resistance: 'Résistance(s)',
  grande_resistance: 'Grande(s) résistance(s)',
  immunite: 'Immunité(s)',
  reflexion: 'Réflexion(s)',
  capacites: 'Capacité(s)',
  tactique: 'Tactique de combat',
};
// pas de 'double_resistance' (décision R148 : devenue la Grande résistance, migration 0073) : plus aucune cible de ce sens, et le rejeu d'un journal
// noté avant 0073 la range en grande_resistance (serveur/edition-bestiaire.mjs#ancienneEcritureDesResistances)
const SENS_PAR_COLONNE = {
  vulnerabilites: ['vulnerabilite', 'grande_vulnerabilite'],
  resistances: ['resistance', 'grande_resistance'],
  immunites: ['immunite', 'reflexion'],
};

/** Les six caractéristiques, dans l'ordre F.P.V.S.I.A. (même ordre que creature_caracteristique et monstre_caracteristique). */
export const FPVSIA = [
  { id: 'force', sigle: 'F', nom: 'Force' },
  { id: 'perception', sigle: 'P', nom: 'Perception' },
  { id: 'volonte', sigle: 'V', nom: 'Volonté' },
  { id: 'social', sigle: 'S', nom: 'Social' },
  { id: 'intelligence', sigle: 'I', nom: 'Intelligence' },
  { id: 'agilite', sigle: 'A', nom: 'Agilité' },
];

const regrouper = (lignes, cle) => {
  const m = new Map();
  for (const l of lignes) {
    if (!m.has(l[cle])) m.set(l[cle], []);
    m.get(l[cle]).push(l);
  }
  return m;
};
const unique = (valeurs) => [...new Set(valeurs.filter((v) => v !== null && v !== undefined && v !== ''))];

/**
 * Options d'un filtre : les valeurs portées par les lignes, avec leur libellé (l'écriture la plus fréquente, puis la première dans l'ordre alphabétique)
 * et leur effectif ; `ordre` : 'alpha' (par libellé) ou une liste de valeurs dans l'ordre voulu (les autres ensuite, par libellé).
 */
export function optionsDeFacette(lignes, cle, ecritures, ordre = 'alpha') {
  const effectifs = new Map();
  // une ligne compte pour ses cases (une combinaison de magies : ses deux créatures), comme le compte de la page
  for (const l of lignes) for (const v of new Set(l.facettes[cle] ?? [])) effectifs.set(v, (effectifs.get(v) ?? 0) + (l.cases?.length ?? 1));
  const libelle = (v) => {
    const compte = ecritures.get(v);
    if (!compte) return v;
    return [...compte].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0][0];
  };
  const options = [...effectifs].map(([valeur, nombre]) => ({ valeur, libelle: libelle(valeur), nombre }));
  const rang = (v) => (Array.isArray(ordre) && ordre.includes(v) ? ordre.indexOf(v) : Infinity);
  return options.sort((a, b) => rang(a.valeur) - rang(b.valeur) || a.libelle.localeCompare(b.libelle, 'fr', { sensitivity: 'base', numeric: true }));
}

/** Compteur d'écritures : clé normalisée -> Map(écriture -> nombre). */
function ecritures() {
  const m = new Map();
  const noter = (texte) => {
    if (texte === null || texte === undefined || texte === '') return null;
    const cle = normalize(texte);
    if (!cle) return null;
    if (!m.has(cle)) m.set(cle, new Map());
    m.get(cle).set(texte, (m.get(cle).get(texte) ?? 0) + 1);
    return cle;
  };
  return { m, noter };
}

/** Le portrait d'une carte, ou d'une espèce sans carte (migration 0033) : l'image et son cadrage tels que la base les garde, ou null. */
const portraitDe = (r) => (r.portrait ? { donnees: r.portrait, x: r.portrait_x, y: r.portrait_y, zoom: r.portrait_zoom } : null);

/** Échelles du filtre EP : celles qu'écrit la carte ou l'espèce (lib/monstre-champs.mjs#echellesEcrites : « 1-10 » -> 1 à 10, « 3, 5, 7 » -> 3, 5 et 7,
 *  ni 4 ni 6) ; une écriture sans échelle lisible : la plage de ses bornes (ep_min à ep_max), sinon aucune. */
const echellesDe = (brut, min, max) => {
  const ecrites = echellesEcrites(brut);
  if (ecrites.length) return ecrites.map(String);
  return min === null || max === null ? [] : Array.from({ length: max - min + 1 }, (_, k) => String(min + k));
};

/** Les monstres du Bestiaire 2.0 : { lignes, facettes, regles, echelles, glossaire, elements, especes } (`elements` : les noms des magies, décision R57). */
export function chargerMonstres(db) {
  const all = (sql) => db.prepare(sql).all();
  const especes = all('SELECT * FROM monstre_espece ORDER BY ordre');
  // les groupes d'espèces (décision R64 : « regrouper tous les Ottar (et le presqu'Ottar) sous la même espèce d'Ottar »)
  const groupes = new Map(all('SELECT id, nom, description FROM monstre_groupe').map((g) => [g.id, g]));
  const cartes = regrouper(all('SELECT * FROM monstre ORDER BY espece_id, rang'), 'espece_id');
  const lieux = regrouper(all('SELECT * FROM monstre_espece_lieu ORDER BY espece_id, rang'), 'espece_id');
  const blocs = regrouper(all('SELECT * FROM monstre_espece_bloc ORDER BY espece_id, rang'), 'espece_id');
  const butins = regrouper(all('SELECT * FROM monstre_butin ORDER BY espece_id, rang'), 'espece_id');
  const rubriques = regrouper(all('SELECT * FROM monstre_rubrique ORDER BY monstre_id, rang'), 'monstre_id');
  const caracs = regrouper(all('SELECT * FROM monstre_caracteristique ORDER BY monstre_id, rang'), 'monstre_id');
  const attaques = regrouper(all('SELECT * FROM monstre_attaque ORDER BY monstre_id, rang'), 'monstre_id');
  const capacites = regrouper(all('SELECT * FROM monstre_capacite ORDER BY monstre_id, rang'), 'monstre_id');
  // capacités communes (décision R66) et valeurs propres à une carte (R69)
  const communes = new Map(all('SELECT * FROM monstre_capacite_commune').map((x) => [x.id, x]));
  const valeurs = regrouper(all('SELECT * FROM monstre_capacite_valeur ORDER BY monstre_id, rang, numero'), 'monstre_id');
  const defenses = regrouper(all('SELECT * FROM monstre_defense ORDER BY monstre_id, sens, rang'), 'monstre_id');

  // filtres : les colonnes du tableau seulement (demande du propriétaire : « Inutile de filtrer par les colonnes non affichées ») ; le nom passe par la recherche
  const ec = { espece: ecritures(), type: ecritures(), lieu: ecritures() };
  const lignes = [];
  const ancres = new Set(especes.filter((e) => !(cartes.get(e.id) ?? []).length).map((e) => e.id.slice(e.id.indexOf('/') + 1)));
  for (const e of especes) {
    const lieuxDe = (lieux.get(e.id) ?? []).map((l) => ({ lieu: l.lieu, cle: ec.lieu.noter(l.lieu) }));
    const g = groupes.get(e.groupe_id) ?? null;
    const espece = {
      id: e.id,
      nom: e.nom,
      // son groupe (Ottar) : son nom, et sa description, celle de l'espèce ; la description de l'espèce du doc est alors celle de la créature (décision R65)
      groupe: g && { id: g.id, nom: g.nom, description: g.description },
      ep: e.ep_brut,
      description: e.description,
      lieu: e.lieu_brut,
      complement: e.complement,
      lieux: lieuxDe.map((l) => l.lieu),
      blocs: (blocs.get(e.id) ?? []).map((b) => ({ rang: b.rang, titre: b.titre, texte: b.texte })),
      butin: tableauDuButin(butins.get(e.id) ?? []),
    };
    const sesCartes = cartes.get(e.id) ?? [];
    const base = (slug) => ({ ancre: `monstre-${slug}`, espece, texteLieux: lieuxDe.map((l) => l.lieu).join(', ') });
    // la colonne Espèce : le nom du groupe d'une espèce qui en a un (« Ottar »), sinon le sien
    const nomDEspece = g?.nom ?? e.nom;
    const cleEspece = ec.espece.noter(nomDEspece);
    const texteDesLieux = lieuxDe.map((x) => x.lieu).join(', ') || null;
    if (!sesCartes.length) {
      lignes.push({
        ...base(e.id.slice(e.id.indexOf('/') + 1)),
        id: e.id,
        carte: null,
        nom: e.nom,
        portrait: portraitDe(e),
        facettes: { espece: unique([cleEspece]), ep: echellesDe(e.ep_brut, e.ep_min, e.ep_max), lieu: unique(lieuxDe.map((l) => l.cle)) },
        tri: { espece: nomDEspece, nom: e.nom, ep: e.ep_min, lieu: texteDesLieux },
      });
      continue;
    }
    for (const c of sesCartes) {
      const r = rubriques.get(c.id) ?? [];
      const de = (cle) => r.filter((x) => x.rubrique === cle);
      const texteDe = (cle) => de(cle).map((x) => x.texte).join('\n\n');
      const d = defenses.get(c.id) ?? [];
      const cibles = (colonne) => {
        const sens = SENS_PAR_COLONNE[colonne];
        return d.filter((x) => sens.includes(x.sens)).map((x) => ({ cible: x.cible, sens: x.sens }));
      };
      const fpvsia = new Map((caracs.get(c.id) ?? []).map((x) => [x.caracteristique_id, x.valeur]));
      const sesValeurs = valeurs.get(c.id) ?? [];
      const caps = (capacites.get(c.id) ?? []).map((x) => {
        const cm = communes.get(x.capacite_commune_id);
        return {
          rang: x.rang,
          prefixe: x.prefixe,
          id: cm.id,
          nom: cm.nom,
          description: cm.description,
          listeDeSorts: cm.liste_de_sorts === 1,
          sorts: x.sorts,
          valeurs: Object.fromEntries(sesValeurs.filter((v) => v.rang === x.rang).map((v) => [v.numero, v.valeur])),
        };
      });
      // ancre : le nom de la carte (« monstre-amblypyge-de-brai ») ; un nom déjà pris (une carte écrite dans deux espèces) : « -2 »
      let slug = c.nom_cle;
      for (let n = 2; ancres.has(slug); n++) slug = `${c.nom_cle}-${n}`;
      ancres.add(slug);
      const colonnes = Object.fromEntries(Object.keys(SENS_PAR_COLONNE).map((col) => [col, cibles(col)]));
      lignes.push({
        ...base(slug),
        id: c.id,
        nom: c.nom,
        portrait: portraitDe(c),
        carte: {
          nomBrut: c.nom_brut,
          // la description de la créature elle-même, après celle de l'espèce (décision R65) ; le doc n'en écrit aucune
          description: c.description,
          echelle: c.echelle_brut,
          categorie: c.categorie,
          categorieBrut: c.categorie_brut,
          type: c.type_brut,
          alignement: c.alignement_brut,
          variable: c.variable === 1,
          sante: c.sante,
          chakra: c.chakra,
          barriere: c.barriere,
          armurePhysique: c.armure_physique,
          armureMagique: c.armure_magique,
          vitesseSol: c.vitesse_sol,
          vitesseNage: c.vitesse_nage,
          defense: texteDe('defense'),
          vitesse: texteDe('vitesse'),
          fpvsia: FPVSIA.map((k) => fpvsia.get(k.id) ?? null),
          attaques: (attaques.get(c.id) ?? []).map((a) => ({ nom: a.nom, texte: a.texte })),
          capacites: caps,
          ...colonnes,
          rubriques: r.map((x) => ({ rang: x.rang, rubrique: x.rubrique, titre: x.titre ?? LIBELLES_RUBRIQUES[x.rubrique], texte: x.texte })),
        },
        // filtres et tri : les colonnes du tableau, dans leur ordre (TableauMonstres.astro)
        facettes: {
          espece: unique([cleEspece]),
          type: unique([ec.type.noter(c.type_brut)]),
          categorie: [c.categorie],
          ep: echellesDe(c.echelle_brut, c.ep_min, c.ep_max),
          lieu: unique(lieuxDe.map((l) => l.cle)),
        },
        tri: {
          espece: nomDEspece,
          nom: c.nom,
          type: c.type_brut,
          categorie: ['ennemi_simple', 'mini_boss', 'boss'].indexOf(c.categorie),
          ep: c.ep_min,
          lieu: texteDesLieux,
        },
      });
    }
  }
  const echellesDispo = [...new Set(lignes.flatMap((l) => l.facettes.ep))].sort((a, b) => a - b);
  // un filtre par colonne affichée (sauf le nom : la recherche), dans l'ordre des colonnes ; une longue liste (espèces, lieux) a sa recherche (Filtres.astro)
  const facettes = [
    { cle: 'espece', libelle: 'Espèce', options: optionsDeFacette(lignes, 'espece', ec.espece.m) },
    { cle: 'type', libelle: 'Type', options: optionsDeFacette(lignes, 'type', ec.type.m) },
    { cle: 'categorie', libelle: 'Catégorie', options: optionsDeFacette(lignes, 'categorie', new Map(Object.entries(CATEGORIES).map(([k, v]) => [k, new Map([[v, 1]])])), Object.keys(CATEGORIES)) },
    { cle: 'ep', libelle: 'Échelle (EP)', options: optionsDeFacette(lignes, 'ep', new Map(echellesDispo.map((n) => [n, new Map([[`EP ${n}`, 1]])])), echellesDispo) },
    { cle: 'lieu', libelle: 'Lieux', options: optionsDeFacette(lignes, 'lieu', ec.lieu.m) },
  ];
  return {
    lignes,
    facettes,
    // les espèces du tableau : un groupe compte pour une (les 22 Ottar, décision R64)
    especes: new Set(especes.map((e) => (e.groupe_id ? `groupe:${e.groupe_id}` : `espece:${e.id}`))).size,
    cartes: lignes.filter((l) => l.carte).length,
    regles: all('SELECT rang, texte FROM monstre_regle ORDER BY rang'),
    echelles: all('SELECT * FROM monstre_echelle ORDER BY ep'),
    glossaire: all('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang'),
    // les éléments devant lesquels le butin écrit un objet du glossaire (« Fraise de feu », « Minitaire de Foudre » : lib/monstre-champs.mjs#objetDuButin)
    elements: all('SELECT nom FROM magie ORDER BY ordre').map((m) => m.nom),
    // la couleur des vulnérabilités et résistances : la magie qui va avec chaque cible
    magiesDesCibles: magiesDesCibles(db),
  };
}

/** Les cartes qui renvoient au tableau de l'introduction pour leurs dégâts (lib/monstre-champs.mjs#renvoieAuxDegatsMoyens), pour le rendu « monstre-echelle »
 *  du mode modification (serveur/edition.mjs#listes) : leurs identifiants. */
export const renvoisAuxDegatsMoyens = (db) => [
  ...new Set(
    db
      .prepare("SELECT monstre_id, texte FROM monstre_rubrique WHERE rubrique = 'degats' ORDER BY monstre_id, rang")
      .all()
      .filter((r) => RENVOI_AUX_DEGATS_MOYENS.test(r.texte ?? ''))
      .map((r) => r.monstre_id),
  ),
];

/** La magie qui va avec chaque cible des vulnérabilités et résistances (lib/monstre-champs.mjs#magiesDesCibles) : les magies, et la magie liée des
 *  altérations d'état (etat_magie, dans l'ordre de leur rang). Page construite (chargerMonstres) et mode modification (serveur/edition.mjs#listes). */
export const magiesDesCibles = (db) =>
  tableDesCibles(
    db.prepare('SELECT nom FROM magie ORDER BY ordre').all().map((m) => m.nom),
    db.prepare('SELECT e.nom AS nom, m.nom AS magie FROM etat e JOIN etat_magie em ON em.etat_id = e.id JOIN magie m ON m.id = em.magie_id ORDER BY e.ordre, em.rang').all(),
  );

/** L'échelle écrite de chaque carte ({ id: echelle_brut }), pour le rendu « monstre-rubrique » du mode modification (une formule « N (+k/mEP) » ou « N (+k/EP) »,
 *  décisions R55, R59 : serveur/edition.mjs#listes). */
export const echellesDesCartes = (db) => Object.fromEntries(db.prepare('SELECT id, echelle_brut FROM monstre ORDER BY id').all().map((r) => [r.id, r.echelle_brut]));

/** Tableau du butin d'une espèce : [{ rang, score, ennemi_simple, mini_boss, boss }] dans l'ordre des tranches ; une cellule vide reste null. */
export function tableauDuButin(lignes) {
  const tranches = new Map();
  for (const b of lignes) {
    if (!tranches.has(b.rang)) tranches.set(b.rang, { rang: b.rang, score: b.score_brut, ennemi_simple: null, mini_boss: null, boss: null });
    tranches.get(b.rang)[b.categorie] = b.texte;
  }
  return [...tranches.values()];
}

/** Libellés des sens de défense des créatures invoquées (v_creature_resistance). */
const SENS_CREATURE = { resistance: 'Résistance', vulnerabilite: 'Vulnérabilité', immunite: 'Immunité', sensibilite: 'Sensibilité' };
const DEGATS = { physique: 'Dégâts physiques', frappe: 'Dégâts de frappe', taille: 'Dégâts de taille', estoc: 'Dégâts d’estoc', sonore: 'Dégâts sonores' };
const premiereMajuscule = (s) => (s ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s);

/**
 * Le libellé d'un bloc de la marge du classeur « Invocation » (`invocation_bloc` : `marge_brut`, `npm`) : sa combinaison de magies telle qu'écrite
 * (« Terre + Sang », « Terre Mono ») ou, pour une marionnette, son NPM, « NPM 3 ». La marge de l'onglet Marionette écrit « EP3 », une faute du classeur
 * (décision R53 : les créatures invoquées n'ont pas d'échelle de puissance, leur rang est le niveau de puissance magique) ; elle reste en trace dans la
 * base, jamais affichée. Le même libellé partout : bestiaire (tableaux, cartes) et pages de magie (lib/magies-db.mjs).
 */
export const libelleDuBloc = ({ marge_brut, npm }) => (npm === null || npm === undefined ? marge_brut : `NPM ${npm}`);

/** Une valeur de la ligne « Santé » d'une carte ou une ressource, typée (table creature : `*_forme`, `*_valeur`, `*_brut`) ; null quand elle n'est pas écrite. */
const valeurTypee = (brut, forme, valeur) => (brut === null || brut === undefined ? null : { forme, valeur, brut });

/**
 * Ce qui change avec le NPM d'une créature invoquée (décision R130, lib/creature-npm.mjs) : ses valeurs typées par l'import (forme « par_npm »,
 * armures « /NPM », formule des dégâts, bonus « au niveau N magique », capacités et résistances « (NPM n) »). `c` : la ligne de `creature` ; le reste,
 * ses lignes de détail.
 */
export function donneesNpm(c, { fpvsia, bonus, attaques, ressources, capacites, defenses }) {
  return {
    sante: valeurTypee(c.sante_brut, c.sante_forme, c.sante_valeur),
    chakra: valeurTypee(c.chakra_brut, c.chakra_forme, c.chakra_valeur),
    barriere: valeurTypee(c.barriere_brut, c.barriere_forme, c.barriere_valeur),
    ressources: ressources.map((r) => ({ libelle: r.libelle, forme: r.forme, valeur: r.valeur, brut: r.brut })),
    defense: c.defense_forme
      ? {
          forme: c.defense_forme,
          physique: c.armure_physique,
          physiqueParNpm: c.armure_physique_par_npm === 1,
          magique: c.armure_magique,
          magiqueParNpm: c.armure_magique_par_npm === 1,
          brut: c.defense_brut,
        }
      : null,
    fpvsia,
    bonus: bonus.map((b) => ({ niveau: b.niveau_magique, increment: b.increment, caracteristique: b.caracteristique_id, texte: b.texte_brut })),
    attaques: attaques.map((a) => ({
      brut: a.brut,
      formule: a.formule_brut,
      des: a.des_nombre,
      faces: a.des_faces,
      bonus: a.bonus_fixe,
      parNpm: a.par_npm === 1,
    })),
    // les « (NPM n) » écrits devant ses capacités et les résistances qu'elles donnent (une carte qui en a change avec le NPM)
    npmMin: [...capacites.map((x) => x.npm_min), ...defenses.map((x) => x.npm_min)].filter((n) => n !== null && n !== undefined),
  };
}

/**
 * Les créatures invoquées (section 8) : { lignes, tableaux, facettes, invocations }. `lignes` : une par créature (sa carte) ; `tableaux` : un par invocation
 * (demande du propriétaire : « Fait 3 tableaux. Un tableau Appel aux Golem et un Animation des morts sous le même modèle, et déroulable. Il faudra mettre
 * deux cases à chaque fois côte à côte pour chaque combinaison de magie (avec le mono en premier). Quant à ceux de la manipulation de l'ombre une seule
 * ligne par NM ») : une ligne par bloc de la marge du classeur, dans son ordre — combinaison de magies et ses deux créatures (carte de gauche, carte de
 * droite ; le mono est le premier bloc) ou NPM d'une marionnette (« une seule ligne par NM » ; décision R53 : libelleDuBloc) et sa créature.
 */
export function chargerInvocations(db) {
  const all = (sql) => db.prepare(sql).all();
  const invocations = all(
    `SELECT i.id, i.nom, i.nom_cle, i.genre, i.ordre, i.sort_id, s.nom AS sort_nom, s.magie_id AS sort_magie_id, m.nom AS sort_magie
     FROM invocation i LEFT JOIN sort s ON s.id = i.sort_id LEFT JOIN magie m ON m.id = s.magie_id ORDER BY i.ordre`,
  );
  const parInvocation = new Map(invocations.map((i) => [i.id, i]));
  const communes = regrouper(all('SELECT invocation_id, nom, texte FROM invocation_capacite_commune ORDER BY invocation_id, rang'), 'invocation_id');
  const creatures = all(
    `SELECT c.*, b.marge_brut, b.npm, b.rang AS bloc_rang FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id JOIN invocation i ON i.id = c.invocation_id
     ORDER BY i.ordre, b.rang, c.rang`,
  );
  const magiesDuBloc = regrouper(
    all('SELECT bm.bloc_id, bm.rang, m.id, m.nom, m.nom_cle FROM invocation_bloc_magie bm JOIN magie m ON m.id = bm.magie_id ORDER BY bm.bloc_id, bm.rang'),
    'bloc_id',
  );
  const magies = regrouper(all('SELECT vm.creature_id, m.id, m.nom, m.nom_cle, m.ordre FROM v_creature_magie vm JOIN magie m ON m.id = vm.magie_id ORDER BY m.ordre'), 'creature_id');
  const caracs = regrouper(all('SELECT creature_id, caracteristique_id, valeur FROM creature_caracteristique ORDER BY creature_id, rang'), 'creature_id');
  const bonus = regrouper(all('SELECT creature_id, niveau_magique, increment, caracteristique_id, texte_brut FROM creature_bonus_npm ORDER BY creature_id, rang'), 'creature_id');
  const attaques = regrouper(
    all('SELECT id, creature_id, nom, brut, formule_brut, des_nombre, des_faces, bonus_fixe, par_npm FROM creature_attaque ORDER BY creature_id, rang'),
    'creature_id',
  );
  const capacites = regrouper(all('SELECT creature_id, npm_min, etiquette, nom, nom_cle, texte FROM creature_capacite ORDER BY creature_id, rang'), 'creature_id');
  const effets = regrouper(all('SELECT creature_id, libelle, nom, sort_id, texte FROM creature_effet ORDER BY creature_id, rang'), 'creature_id');
  const ressources = regrouper(all('SELECT creature_id, libelle, brut, forme, valeur FROM creature_ressource ORDER BY creature_id, ressource'), 'creature_id');
  // le coût du sort qui l'invoque, ses deux colonnes en une écriture (décisions R105, R106 : « 6 par NPM de la créature invoquée » ; lib/sort-cout.mjs#coutEnUneCase)
  const lignesDesCouts = all('SELECT creature_id, cout_brut, cout_secondaire FROM v_creature_cout_invocation');
  const couts = new Map(lignesDesCouts.map((r) => [r.creature_id, coutEnUneCase(r.cout_brut, r.cout_secondaire)]));
  const coutsNpm = new Map(lignesDesCouts.map((r) => [r.creature_id, { cout: r.cout_brut, secondaire: r.cout_secondaire }]));
  const memeBloc = regrouper(all('SELECT v.creature_id, c.id, c.nom FROM v_creature_meme_bloc v JOIN creature c ON c.id = v.autre_creature_id'), 'creature_id');
  const defenses = regrouper(
    all(
      `SELECT r.creature_id, r.sens, r.cible_type, r.cible_brut, r.cible_degat, r.provenance, r.npm_min, mc.nom AS cible_magie, e.nom AS cible_etat, mv.nom AS via_magie
       FROM v_creature_resistance r LEFT JOIN magie mc ON mc.id = r.cible_magie_id LEFT JOIN etat e ON e.id = r.cible_etat_id LEFT JOIN magie mv ON mv.id = r.via_magie_id
       ORDER BY r.creature_id, r.provenance, r.sens, r.cible_brut`,
    ),
    'creature_id',
  );

  const ec = { magie: ecritures() };
  const ordreMagies = new Map();
  const lignes = creatures.map((c) => {
    const inv = parInvocation.get(c.invocation_id);
    const fpvsia = new Map((caracs.get(c.id) ?? []).map((x) => [x.caracteristique_id, x.valeur]));
    const sesMagies = magies.get(c.id) ?? [];
    for (const m of sesMagies) ordreMagies.set(normalize(m.nom), m.ordre);
    const d = (defenses.get(c.id) ?? []).map((x) => {
      const cible = x.cible_type === 'magie' ? x.cible_magie : x.cible_type === 'etat' ? x.cible_etat : x.cible_type === 'degat' ? DEGATS[x.cible_degat] : premiereMajuscule(x.cible_brut);
      const libelle = `${SENS_CREATURE[x.sens]} : ${cible}`;
      return { ...x, cible, libelle };
    });
    const caps = capacites.get(c.id) ?? [];
    const slug = c.id.slice(c.id.indexOf('/') + 1);
    return {
      id: c.id,
      ancre: `invoquee-${slug}`,
      nom: c.nom,
      description: c.description,
      invocation: { id: inv.id, nom: inv.nom, sortId: inv.sort_id, sortNom: inv.sort_nom, magieId: inv.sort_magie_id, magie: inv.sort_magie },
      bloc: libelleDuBloc(c),
      // le NPM d'une marionnette (une créature par NPM, décision R53) ; null pour un golem ou un non-mort
      npmDuBloc: c.npm,
      blocId: c.bloc_id,
      // 1 = carte de gauche, 2 = carte de droite du bloc (classeur)
      rang: c.rang,
      magiesDuBloc: (magiesDuBloc.get(c.bloc_id) ?? []).map((m) => m.nom),
      // les mêmes, par identifiant (la fiche : les combinaisons à la portée du personnage)
      magiesDuBlocIds: (magiesDuBloc.get(c.bloc_id) ?? []).map((m) => m.id),
      magies: sesMagies.map((m) => m.nom),
      sante: c.sante_brut,
      chakra: c.chakra_brut,
      barriere: c.barriere_brut,
      defense: c.defense_brut,
      vitesse: c.vitesse_brut,
      fpvsia: FPVSIA.map((k) => fpvsia.get(k.id) ?? null),
      bonus: (bonus.get(c.id) ?? []).map((b) => b.texte_brut),
      attaques: (attaques.get(c.id) ?? []).map((a) => ({ nom: a.nom, brut: a.brut })),
      capacites: caps.map((x) => ({ npm: x.npm_min, etiquette: x.etiquette, nom: x.nom, texte: x.texte })),
      communes: communes.get(c.invocation_id) ?? [],
      effets: effets.get(c.id) ?? [],
      ressources: (ressources.get(c.id) ?? []).map((r) => ({ libelle: r.libelle, brut: r.brut })),
      cout: couts.get(c.id) ?? null,
      // ce qui change avec le NPM de la créature, typé (décision R130 : lib/creature-npm.mjs) ; `coutNpm` : le coût du sort qui l'invoque, ses deux colonnes
      donneesNpm: donneesNpm(c, {
        fpvsia: FPVSIA.map((k) => fpvsia.get(k.id) ?? null),
        bonus: bonus.get(c.id) ?? [],
        attaques: attaques.get(c.id) ?? [],
        ressources: ressources.get(c.id) ?? [],
        capacites: caps,
        defenses: defenses.get(c.id) ?? [],
      }),
      coutNpm: coutsNpm.get(c.id) ?? null,
      memeBloc: memeBloc.get(c.id) ?? [],
      defensesEcrites: d.filter((x) => x.provenance !== 'element'),
      defensesParMagie: [...regrouper(d.filter((x) => x.provenance === 'element'), 'via_magie')].map(([magie, liste]) => ({
        magie,
        resiste: liste.filter((x) => x.sens === 'resistance').map((x) => x.cible),
        vulnerable: liste.filter((x) => x.sens === 'vulnerabilite').map((x) => x.cible),
      })),
      // le filtre « Magie » (les magies de la créature : celles de sa combinaison, ou celle du sort qui l'invoque)
      magiesCles: unique(sesMagies.map((m) => ec.magie.noter(m.nom))),
    };
  });
  const ordreDesMagies = [...ordreMagies].sort((a, b) => a[1] - b[1]).map(([cle]) => cle);
  const versInvocation = (i) => ({ id: i.id, nom: i.nom, nomCle: i.nom_cle, sortId: i.sort_id, sortNom: i.sort_nom, magieId: i.sort_magie_id, magie: i.sort_magie });
  // les tableaux : une ligne par bloc, dans l'ordre du classeur (la requête des créatures est déjà triée par invocation, bloc, rang)
  const blocs = all('SELECT id, invocation_id, rang, marge_brut, npm FROM invocation_bloc ORDER BY invocation_id, rang');
  const parBloc = regrouper(lignes, 'blocId');
  let ordre = 0;
  const tableaux = invocations.map((i) => {
    const lignesDuTableau = blocs
      .filter((b) => b.invocation_id === i.id && parBloc.has(b.id))
      .map((b) => {
        const cases = parBloc.get(b.id).sort((x, y) => x.rang - y.rang);
        const magiesDuBlocNoms = cases[0].magiesDuBloc;
        return {
          id: b.id,
          ordre: ordre++,
          // la combinaison de magies telle qu'écrite, ou le NPM d'une marionnette (décision R53)
          libelle: libelleDuBloc(b),
          npm: b.npm,
          // les magies de la combinaison, dans l'ordre de la marge ; une seule : le bloc « mono » (« Terre + Terre » en a deux, la même)
          magies: magiesDuBlocNoms,
          mono: magiesDuBlocNoms.length === 1,
          cases,
          // filtre : la seule colonne filtrable affichée, la magie (« Inutile de filtrer par les colonnes non affichées ») ; pas de tri : l'ordre du classeur
          facettes: { magie: unique(cases.flatMap((c) => c.magiesCles)) },
        };
      });
    return {
      invocation: versInvocation(i),
      // deux créatures par combinaison (golems, non-morts : « sous le même modèle ») ou une par NPM (marionnettes)
      duo: lignesDuTableau.some((l) => l.cases.length > 1),
      lignes: lignesDuTableau,
      creatures: lignesDuTableau.reduce((n, l) => n + l.cases.length, 0),
    };
  });
  const lignesDesTableaux = tableaux.flatMap((t) => t.lignes);
  const facettes = [{ cle: 'magie', libelle: 'Magie', options: optionsDeFacette(lignesDesTableaux, 'magie', ec.magie.m, ordreDesMagies) }];
  return { lignes, tableaux, facettes, invocations: invocations.map(versInvocation) };
}

/**
 * Le tableau d'une invocation (invocation.tableau_titre : « TABLEAU "AMÉLIORATION CADAVÉRIQUE" », la table amelioration_cadaverique de la magie de son sort)
 * est aussi celui du sort de cette magie qui porte le nom écrit entre guillemets (« Amélioration cadavérique » : « Sacrifie l'invocation pour des
 * amplifications pendant 3 tours (voir invocations) ») : demande du propriétaire, « avoir toutes les améliorations visibles en fonction de l'invocation
 * sacrifiée » (décision R130). Map(id du sort -> { titre, nom (le nom entre guillemets), invocationId, invocation, magieId, lignes: [{ nom, effet }] }),
 * pour les pages de magie (lib/magies-db.mjs) et la fiche (lib/fiche-regles.mjs).
 */
export function tableauxDesSorts(db) {
  const tableaux = new Map();
  const invocations = db
    .prepare('SELECT i.id, i.nom, i.tableau_titre, s.magie_id FROM invocation i JOIN sort s ON s.id = i.sort_id WHERE i.tableau_titre IS NOT NULL ORDER BY i.ordre')
    .all();
  for (const i of invocations) {
    const nom = /["“«]\s*([^"”»]+?)\s*["”»]/.exec(i.tableau_titre)?.[1];
    const sort = nom ? db.prepare('SELECT id FROM sort WHERE magie_id = ? AND nom_cle = ?').get(i.magie_id, normalize(nom)) : null;
    if (!sort) continue;
    const lignes = db.prepare('SELECT nom, effet FROM amelioration_cadaverique WHERE magie_id = ? ORDER BY rang').all(i.magie_id);
    tableaux.set(sort.id, { titre: i.tableau_titre, nom, invocationId: i.id, invocation: i.nom, magieId: i.magie_id, lignes });
  }
  return tableaux;
}

/** Le bestiaire entier, pour la page. */
export const chargerBestiaire = (db) => ({ monstres: chargerMonstres(db), invocations: chargerInvocations(db) });
