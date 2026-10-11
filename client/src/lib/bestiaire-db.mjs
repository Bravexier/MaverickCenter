// Page /bestiaire/ (demande du propriétaire, 2026-10-11 : « Un tableau immense, avec menu de recherche et filtre. On peut choisir filtrer plusieurs
// champs » ; « Les créatures invoquées doivent être dans une catégorie à part car ils ne fonctionnent pas tout à fait pareillement ») : deux catégories,
// chacune son tableau, ses filtres et sa recherche (components/bestiaire/).
//   * Monstres : les tables du « Bestiaire 2.0 » (data/schema.sql, section 8 bis) ; une ligne par carte (ennemi simple, mini-boss, boss), et une ligne
//     par espèce qui n'a pas encore de carte (description seule : la plupart des Ottar).
//   * Créatures invoquées : les tables des invocations (section 8) ; une ligne par créature.
// Chaque ligne porte ce que le tableau affiche, le texte de sa fiche (sous la ligne) et ses valeurs de filtre (`facettes` : clé -> valeurs) et de tri
// (`tri`). Rien n'est calculé ni déduit : une valeur que la base n'a pas typée reste son texte (`*_brut`, rubriques) ; les libellés des filtres sont
// l'écriture la plus fréquente de chaque valeur dans la base (« Non-mort » réunit « Non-mort » et « Non-Mort »).
// `chargerBestiaire` reçoit la base ouverte par lib/donnees.mjs (build) ; module sans dépendance navigateur ni Astro.
import { normalize } from './text.mjs';

/** Libellés des catégories de monstre (colonne `categorie`). */
export const CATEGORIES = { ennemi_simple: 'Ennemi simple', mini_boss: 'Mini-boss', boss: 'Boss' };

/** Rubriques d'une carte : libellé de la fiche, et les rubriques de défense rangées par colonne du tableau. */
export const LIBELLES_RUBRIQUES = {
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
  double_resistance: 'Double(s) résistance(s)',
  immunite: 'Immunité(s)',
  reflexion: 'Réflexion(s)',
  capacites: 'Capacité(s)',
  tactique: 'Tactique de combat',
};
export const SENS_PAR_COLONNE = {
  vulnerabilites: ['vulnerabilite', 'grande_vulnerabilite'],
  resistances: ['resistance', 'grande_resistance', 'double_resistance'],
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
  for (const l of lignes) for (const v of new Set(l.facettes[cle] ?? [])) effectifs.set(v, (effectifs.get(v) ?? 0) + 1);
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

/** Échelles couvertes par une plage (« EP1 - 10 » -> 1 à 10) ; aucune si la plage n'est pas connue. */
const echellesDe = (min, max) => (min === null || max === null ? [] : Array.from({ length: max - min + 1 }, (_, k) => String(min + k)));

/** Les monstres du Bestiaire 2.0 : { lignes, facettes, regles, echelles, glossaire, especes }. */
export function chargerMonstres(db) {
  const all = (sql) => db.prepare(sql).all();
  const especes = all('SELECT * FROM monstre_espece ORDER BY ordre');
  const cartes = regrouper(all('SELECT * FROM monstre ORDER BY espece_id, rang'), 'espece_id');
  const lieux = regrouper(all('SELECT * FROM monstre_espece_lieu ORDER BY espece_id, rang'), 'espece_id');
  const blocs = regrouper(all('SELECT * FROM monstre_espece_bloc ORDER BY espece_id, rang'), 'espece_id');
  const butins = regrouper(all('SELECT * FROM monstre_butin ORDER BY espece_id, rang'), 'espece_id');
  const rubriques = regrouper(all('SELECT * FROM monstre_rubrique ORDER BY monstre_id, rang'), 'monstre_id');
  const caracs = regrouper(all('SELECT * FROM monstre_caracteristique ORDER BY monstre_id, rang'), 'monstre_id');
  const attaques = regrouper(all('SELECT * FROM monstre_attaque ORDER BY monstre_id, rang'), 'monstre_id');
  const capacites = regrouper(all('SELECT * FROM monstre_capacite ORDER BY monstre_id, rang'), 'monstre_id');
  const defenses = regrouper(all('SELECT * FROM monstre_defense ORDER BY monstre_id, sens, rang'), 'monstre_id');

  const ec = { type: ecritures(), alignement: ecritures(), lieu: ecritures(), capacite: ecritures(), vulnerabilite: ecritures(), resistance: ecritures(), immunite: ecritures() };
  const lignes = [];
  const ancres = new Set(especes.filter((e) => !(cartes.get(e.id) ?? []).length).map((e) => e.id.slice(e.id.indexOf('/') + 1)));
  for (const e of especes) {
    const lieuxDe = (lieux.get(e.id) ?? []).map((l) => ({ lieu: l.lieu, cle: ec.lieu.noter(l.lieu) }));
    const espece = {
      id: e.id,
      nom: e.nom,
      ep: e.ep_brut,
      description: e.description,
      lieu: e.lieu_brut,
      complement: e.complement,
      lieux: lieuxDe.map((l) => l.lieu),
      blocs: (blocs.get(e.id) ?? []).map((b) => ({ titre: b.titre, texte: b.texte })),
      butin: tableauDuButin(butins.get(e.id) ?? []),
    };
    const sesCartes = cartes.get(e.id) ?? [];
    const base = (slug) => ({ ancre: `monstre-${slug}`, espece, texteLieux: lieuxDe.map((l) => l.lieu).join(', ') });
    if (!sesCartes.length) {
      lignes.push({
        ...base(e.id.slice(e.id.indexOf('/') + 1)),
        id: e.id,
        carte: null,
        nom: e.nom,
        facettes: { ep: echellesDe(e.ep_min, e.ep_max), lieu: unique(lieuxDe.map((l) => l.cle)) },
        tri: { nom: e.nom, espece: e.nom, ep: e.ep_min, lieu: lieuxDe.map((x) => x.lieu).join(', ') || null },
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
      const caps = (capacites.get(c.id) ?? []).map((x) => ({ prefixe: x.prefixe, nom: x.nom, texte: x.texte, cle: ec.capacite.noter(x.nom) }));
      // ancre : le nom de la carte (« monstre-amblypyge-de-brai ») ; un nom déjà pris (une carte écrite dans deux espèces) : « -2 »
      let slug = c.nom_cle;
      for (let n = 2; ancres.has(slug); n++) slug = `${c.nom_cle}-${n}`;
      ancres.add(slug);
      const colonnes = Object.fromEntries(Object.keys(SENS_PAR_COLONNE).map((col) => [col, cibles(col)]));
      lignes.push({
        ...base(slug),
        id: c.id,
        nom: c.nom,
        carte: {
          nomBrut: c.nom_brut,
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
        facettes: {
          categorie: [c.categorie],
          ep: echellesDe(c.ep_min, c.ep_max),
          type: unique([ec.type.noter(c.type_brut)]),
          alignement: unique([ec.alignement.noter(c.alignement_brut)]),
          lieu: unique(lieuxDe.map((l) => l.cle)),
          vulnerabilite: unique(colonnes.vulnerabilites.map((x) => ec.vulnerabilite.noter(x.cible))),
          resistance: unique(colonnes.resistances.map((x) => ec.resistance.noter(x.cible))),
          immunite: unique(colonnes.immunites.map((x) => ec.immunite.noter(x.cible))),
          capacite: unique(caps.map((x) => x.cle)),
        },
        tri: {
          nom: c.nom,
          espece: e.nom,
          ep: c.ep_min,
          categorie: ['ennemi_simple', 'mini_boss', 'boss'].indexOf(c.categorie),
          type: c.type_brut,
          alignement: c.alignement_brut,
          sante: c.sante,
          chakra: c.chakra,
          barriere: c.barriere,
          defense: c.armure_physique,
          vitesse: c.vitesse_sol,
          ...Object.fromEntries(FPVSIA.map((k) => [k.id, fpvsia.get(k.id) ?? null])),
          lieu: lieuxDe.map((x) => x.lieu).join(', ') || null,
        },
      });
    }
  }
  const echellesDispo = [...new Set(lignes.flatMap((l) => l.facettes.ep))].sort((a, b) => a - b);
  const facettes = [
    { cle: 'categorie', libelle: 'Catégorie', options: optionsDeFacette(lignes, 'categorie', new Map(Object.entries(CATEGORIES).map(([k, v]) => [k, new Map([[v, 1]])])), Object.keys(CATEGORIES)) },
    { cle: 'ep', libelle: 'Échelle (EP)', options: optionsDeFacette(lignes, 'ep', new Map(echellesDispo.map((n) => [n, new Map([[`EP ${n}`, 1]])])), echellesDispo) },
    { cle: 'type', libelle: 'Type', options: optionsDeFacette(lignes, 'type', ec.type.m) },
    { cle: 'alignement', libelle: 'Alignement', options: optionsDeFacette(lignes, 'alignement', ec.alignement.m) },
    { cle: 'lieu', libelle: 'Lieu de rencontre', options: optionsDeFacette(lignes, 'lieu', ec.lieu.m) },
    { cle: 'vulnerabilite', libelle: 'Vulnérabilité', options: optionsDeFacette(lignes, 'vulnerabilite', ec.vulnerabilite.m) },
    { cle: 'resistance', libelle: 'Résistance', options: optionsDeFacette(lignes, 'resistance', ec.resistance.m) },
    { cle: 'immunite', libelle: 'Immunité', options: optionsDeFacette(lignes, 'immunite', ec.immunite.m) },
    { cle: 'capacite', libelle: 'Capacité', options: optionsDeFacette(lignes, 'capacite', ec.capacite.m) },
  ];
  return {
    lignes,
    facettes,
    especes: especes.length,
    cartes: lignes.filter((l) => l.carte).length,
    regles: all('SELECT rang, texte FROM monstre_regle ORDER BY rang'),
    echelles: all('SELECT * FROM monstre_echelle ORDER BY ep'),
    glossaire: all('SELECT id, nom, texte FROM monstre_butin_objet ORDER BY rang'),
  };
}

/** Tableau du butin d'une espèce : [{ score, ennemi_simple, mini_boss, boss }] dans l'ordre des tranches ; une cellule vide reste null. */
export function tableauDuButin(lignes) {
  const tranches = new Map();
  for (const b of lignes) {
    if (!tranches.has(b.rang)) tranches.set(b.rang, { score: b.score_brut, ennemi_simple: null, mini_boss: null, boss: null });
    tranches.get(b.rang)[b.categorie] = b.texte;
  }
  return [...tranches.values()];
}

/** Libellés des sens de défense des créatures invoquées (v_creature_resistance). */
const SENS_CREATURE = { resistance: 'Résistance', vulnerabilite: 'Vulnérabilité', immunite: 'Immunité', sensibilite: 'Sensibilité' };
const DEGATS = { physique: 'Dégâts physiques', frappe: 'Dégâts de frappe', taille: 'Dégâts de taille', estoc: 'Dégâts d’estoc', sonore: 'Dégâts sonores' };
const premiereMajuscule = (s) => (s ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s);

/** Les créatures invoquées (section 8) : { lignes, facettes, invocations }. */
export function chargerInvocations(db) {
  const all = (sql) => db.prepare(sql).all();
  const invocations = all(
    `SELECT i.id, i.nom, i.nom_cle, i.genre, i.ordre, i.sort_id, s.nom AS sort_nom, s.magie_id AS sort_magie_id, m.nom AS sort_magie
     FROM invocation i LEFT JOIN sort s ON s.id = i.sort_id LEFT JOIN magie m ON m.id = s.magie_id ORDER BY i.ordre`,
  );
  const parInvocation = new Map(invocations.map((i) => [i.id, i]));
  const communes = regrouper(all('SELECT invocation_id, nom, texte FROM invocation_capacite_commune ORDER BY invocation_id, rang'), 'invocation_id');
  const creatures = all(
    `SELECT c.*, b.marge_brut, b.ep, b.rang AS bloc_rang FROM creature c JOIN invocation_bloc b ON b.id = c.bloc_id JOIN invocation i ON i.id = c.invocation_id
     ORDER BY i.ordre, b.rang, c.rang`,
  );
  const magiesDuBloc = regrouper(
    all('SELECT bm.bloc_id, bm.rang, m.id, m.nom, m.nom_cle FROM invocation_bloc_magie bm JOIN magie m ON m.id = bm.magie_id ORDER BY bm.bloc_id, bm.rang'),
    'bloc_id',
  );
  const magies = regrouper(all('SELECT vm.creature_id, m.id, m.nom, m.nom_cle, m.ordre FROM v_creature_magie vm JOIN magie m ON m.id = vm.magie_id ORDER BY m.ordre'), 'creature_id');
  const caracs = regrouper(all('SELECT creature_id, caracteristique_id, valeur FROM creature_caracteristique ORDER BY creature_id, rang'), 'creature_id');
  const bonus = regrouper(all('SELECT creature_id, texte_brut FROM creature_bonus_npm ORDER BY creature_id, rang'), 'creature_id');
  const attaques = regrouper(all('SELECT id, creature_id, nom, brut FROM creature_attaque ORDER BY creature_id, rang'), 'creature_id');
  const types = regrouper(all('SELECT a.creature_id, t.type, t.libelle FROM creature_attaque_type t JOIN creature_attaque a ON a.id = t.attaque_id ORDER BY a.creature_id, a.rang, t.rang'), 'creature_id');
  const capacites = regrouper(all('SELECT creature_id, npm_min, etiquette, nom, nom_cle, texte FROM creature_capacite ORDER BY creature_id, rang'), 'creature_id');
  const effets = regrouper(all('SELECT creature_id, libelle, texte FROM creature_effet ORDER BY creature_id, rang'), 'creature_id');
  const ressources = regrouper(all('SELECT creature_id, libelle, brut FROM creature_ressource ORDER BY creature_id, ressource'), 'creature_id');
  const couts = new Map(all('SELECT creature_id, cout_brut FROM v_creature_cout_invocation').map((r) => [r.creature_id, r.cout_brut]));
  const memeBloc = regrouper(all('SELECT v.creature_id, c.id, c.nom FROM v_creature_meme_bloc v JOIN creature c ON c.id = v.autre_creature_id'), 'creature_id');
  const defenses = regrouper(
    all(
      `SELECT r.creature_id, r.sens, r.cible_type, r.cible_brut, r.cible_degat, r.provenance, r.npm_min, mc.nom AS cible_magie, e.nom AS cible_etat, mv.nom AS via_magie
       FROM v_creature_resistance r LEFT JOIN magie mc ON mc.id = r.cible_magie_id LEFT JOIN etat e ON e.id = r.cible_etat_id LEFT JOIN magie mv ON mv.id = r.via_magie_id
       ORDER BY r.creature_id, r.provenance, r.sens, r.cible_brut`,
    ),
    'creature_id',
  );

  const ec = { magie: ecritures(), degat: ecritures(), capacite: ecritures(), defense: ecritures() };
  const ordreMagies = new Map();
  const lignes = creatures.map((c) => {
    const inv = parInvocation.get(c.invocation_id);
    const fpvsia = new Map((caracs.get(c.id) ?? []).map((x) => [x.caracteristique_id, x.valeur]));
    const sesMagies = magies.get(c.id) ?? [];
    for (const m of sesMagies) ordreMagies.set(normalize(m.nom), m.ordre);
    const d = (defenses.get(c.id) ?? []).map((x) => {
      const cible = x.cible_type === 'magie' ? x.cible_magie : x.cible_type === 'etat' ? x.cible_etat : x.cible_type === 'degat' ? DEGATS[x.cible_degat] : premiereMajuscule(x.cible_brut);
      const libelle = `${SENS_CREATURE[x.sens]} : ${cible}`;
      return { ...x, cible, libelle, cle: ec.defense.noter(libelle) };
    });
    const caps = (capacites.get(c.id) ?? []).map((x) => ({ ...x, cle: ec.capacite.noter(x.nom) }));
    const slug = c.id.slice(c.id.indexOf('/') + 1);
    return {
      id: c.id,
      ancre: `invoquee-${slug}`,
      nom: c.nom,
      description: c.description,
      invocation: { id: inv.id, nom: inv.nom, sortId: inv.sort_id, sortNom: inv.sort_nom, magieId: inv.sort_magie_id, magie: inv.sort_magie },
      bloc: c.marge_brut,
      magiesDuBloc: (magiesDuBloc.get(c.bloc_id) ?? []).map((m) => m.nom),
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
      ressources: ressources.get(c.id) ?? [],
      cout: couts.get(c.id) ?? null,
      memeBloc: memeBloc.get(c.id) ?? [],
      defensesEcrites: d.filter((x) => x.provenance !== 'element'),
      defensesParMagie: [...regrouper(d.filter((x) => x.provenance === 'element'), 'via_magie')].map(([magie, liste]) => ({
        magie,
        resiste: liste.filter((x) => x.sens === 'resistance').map((x) => x.cible),
        vulnerable: liste.filter((x) => x.sens === 'vulnerabilite').map((x) => x.cible),
      })),
      facettes: {
        invocation: [inv.nom_cle],
        magie: unique(sesMagies.map((m) => ec.magie.noter(m.nom))),
        degat: unique((types.get(c.id) ?? []).map((t) => ec.degat.noter(premiereMajuscule(t.type)))),
        capacite: unique(caps.map((x) => x.cle)),
        defense: unique(d.map((x) => x.cle)),
      },
      tri: {
        nom: c.nom,
        invocation: inv.ordre,
        magies: c.marge_brut,
        sante: c.sante_valeur,
        chakra: c.chakra_valeur,
        barriere: c.barriere_valeur,
        defense: c.armure_physique,
        vitesse: c.vitesse_sol,
        ...Object.fromEntries(FPVSIA.map((k) => [k.id, fpvsia.get(k.id) ?? null])),
      },
    };
  });
  const ordreInvocations = invocations.map((i) => i.nom_cle);
  const ordreDesMagies = [...ordreMagies].sort((a, b) => a[1] - b[1]).map(([cle]) => cle);
  const facettes = [
    { cle: 'invocation', libelle: 'Invocation', options: optionsDeFacette(lignes, 'invocation', new Map(invocations.map((i) => [i.nom_cle, new Map([[i.nom, 1]])])), ordreInvocations) },
    { cle: 'magie', libelle: 'Magie', options: optionsDeFacette(lignes, 'magie', ec.magie.m, ordreDesMagies) },
    { cle: 'degat', libelle: 'Type de dégâts', options: optionsDeFacette(lignes, 'degat', ec.degat.m) },
    { cle: 'defense', libelle: 'Résistance, vulnérabilité, immunité', options: optionsDeFacette(lignes, 'defense', ec.defense.m) },
    { cle: 'capacite', libelle: 'Capacité', options: optionsDeFacette(lignes, 'capacite', ec.capacite.m) },
  ];
  return { lignes, facettes, invocations: invocations.map((i) => ({ id: i.id, nom: i.nom, sortId: i.sort_id, sortNom: i.sort_nom, magieId: i.sort_magie_id, magie: i.sort_magie })) };
}

/** Le bestiaire entier, pour la page. */
export const chargerBestiaire = (db) => ({ monstres: chargerMonstres(db), invocations: chargerInvocations(db) });
