// Les règles dont la page /fiche/ a besoin, lues dans la base au build (publiées en /fiche/regles.json) : listes de choix (races, ethnies, magies,
// classes, spécialités, dons à choix, sorts, équipement…), ce que chaque choix apporte, et les tables de progression. Rien n'est recalculé ni
// déduit ici : chaque valeur vient d'une table (ou d'une vue) de la base, et les couleurs sont celles des autres pages du site. Les calculs de la
// fiche (niveau, budgets, attributs…) sont dans lib/fiche-moteur.mjs, qui ne lit que ce JSON.
// Node seulement (la base est ouverte par lib/donnees.mjs).
import { groupesDeChoix } from './classe-dons.mjs';
import { ditClasseMagique } from './classe-magique.mjs';
import { couleurDeCaracteristique } from './caracteristiques-postures.mjs';
import { CLASS_GROUPS, classCategory, classColor } from './class-groups.mjs';
import { desSelonLaForce, pointsDeMaitriseDArme } from './maitrise-arme.mjs';
import { ORDRE_DES_RACES, RACE_COLORS, raceKind } from './race-kinds.mjs';
import { couleurDeMagie, texteSurCouleur } from './sort-format.mjs';

const lignes = (db, sql, ...params) => db.prepare(sql).all(...params).map((r) => ({ ...r }));
const parCle = (rows, cle, valeur = (r) => r) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[cle])) m.set(r[cle], []);
    m.get(r[cle]).push(valeur(r));
  }
  return m;
};

/** Entrées minimales (id, titre, tags) des pages de races et de classes : pour réutiliser raceKind et classColor, comme /races/ et /classes/. */
function entreesDesPages(db) {
  const tags = parCle(lignes(db, "SELECT page_id, libelle FROM page_tag WHERE page_id LIKE 'classes/%' OR page_id LIKE 'races/%' ORDER BY page_id, ordre"), 'page_id', (r) => r.libelle);
  return lignes(db, "SELECT id, titre FROM page WHERE type IN ('classes', 'races')").map((p) => ({ id: p.id, data: { title: p.titre, tags: tags.get(p.id) ?? [] } }));
}

/** Constantes de la fiche (table regle_constante) utilisées par le moteur, sous leur identifiant. */
const CONSTANTES = [
  'caracteristique.base_min', 'caracteristique.base_max', 'caracteristique.bonus_magie_innee', 'competence.base_par_point_caracteristique',
  'competence.acquis_max_par_point_caracteristique', 'competence.croix_1_malus', 'competence.croix_2_malus', 'classe.mono_niveau_max',
  'classe.mono_niveaux_par_niveau_global', 'classe.mode_verrou_xp', 'sort.nm_ecart_niveau_global', 'barriere.diviseur_chakra',
  'maitrise_arme.des_sans_maitrise', 'maitrise_arme.des_max', 'sort.nm_max', 'alignement.ecart_axe',
];

/** @param {import('node:sqlite').DatabaseSync} db */
export function chargerReglesDeFiche(db) {
  const constantes = Object.fromEntries(CONSTANTES.map((id) => {
    const r = db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(id);
    if (!r) throw new Error(`regle_constante « ${id} » absente de la base`);
    return [id, r.valeur];
  }));

  const niveaux = lignes(db, `
    SELECT g.niveau, g.xp_min, g.points_competences, g.points_attributs, g.de_attributs_bonus, g.puissance_magique, g.puissance_magique_note,
           g.niveaux_maitrise, v.caracteristiques_total, v.competence_naturel_max, v.points_competences_cumul, v.niveaux_maitrise_cumul
    FROM niveau_global g JOIN v_niveau v ON v.niveau = g.niveau ORDER BY g.niveau`);

  // couleur de la caractéristique, reprise par ses compétences (demande du propriétaire, lib/caracteristiques-postures.mjs)
  const caracteristiques = lignes(db, 'SELECT id, nom, lettre FROM caracteristique ORDER BY ordre')
    .map((c) => ({ ...c, couleur: couleurDeCaracteristique(c.id), texte: texteSurCouleur(couleurDeCaracteristique(c.id)) }));
  const competences = lignes(db, 'SELECT id, nom, caracteristique_id FROM competence ORDER BY ordre');
  const initiative = lignes(db, 'SELECT agilite, bonus, bonus_brut, note FROM initiative_agilite ORDER BY agilite');

  // Races : valeurs de départ de l'onglet de la race (décision R13), AP/AM de la race ; classes accessibles (matrice, R8) ; magies innées
  // accessibles (liste de l'onglet quand elle existe, R11, sinon la matrice) ; bornes des caractéristiques.
  const entrees = entreesDesPages(db);
  const accesClasses = parCle(lignes(db, 'SELECT race_id, classe_id FROM race_classe WHERE accessible = 1 ORDER BY race_id, ordre'), 'race_id', (r) => r.classe_id);
  const magiesOnglet = parCle(lignes(db, 'SELECT race_id, magie_id FROM race_magie_onglet ORDER BY race_id, rang'), 'race_id', (r) => r.magie_id);
  const magiesMatrice = parCle(lignes(db, 'SELECT race_id, magie_id FROM race_magie WHERE accessible = 1 ORDER BY race_id, ordre'), 'race_id', (r) => r.magie_id);
  const bornes = parCle(lignes(db, 'SELECT race_id, caracteristique_id, minimum, maximum FROM v_race_carac_borne'), 'race_id');
  const rangDeRace = (id) => (ORDRE_DES_RACES.includes(id) ? ORDRE_DES_RACES.indexOf(id) : ORDRE_DES_RACES.length);
  const races = lignes(db, `
    SELECT r.id, r.nom, r.ap, r.am, r.mono_magie, o.sante_depart, o.chakra_depart, o.barriere_bonus, o.vitesse_sol, o.vitesse_nage, o.don_base
    FROM race r JOIN race_onglet o ON o.race_id = r.id`)
    .sort((a, b) => rangDeRace(a.id) - rangDeRace(b.id) || a.nom.localeCompare(b.nom, 'fr'))
    .map((r) => {
      const entree = entrees.find((e) => e.id === r.id) ?? { id: r.id, data: { title: r.nom, tags: [] } };
      const nature = raceKind(entrees, entree);
      return {
        id: r.id, nom: r.nom, nature, couleur: RACE_COLORS[nature],
        sante: r.sante_depart, chakra: r.chakra_depart, barriere: r.barriere_bonus ?? 0, vitesse_sol: r.vitesse_sol, vitesse_nage: r.vitesse_nage,
        ap: r.ap ?? 0, am: r.am ?? 0, don_base: r.don_base, mono_magie: r.mono_magie === 1,
        classes: accesClasses.get(r.id) ?? [],
        magies: magiesOnglet.get(r.id) ?? magiesMatrice.get(r.id) ?? [],
        bornes: Object.fromEntries((bornes.get(r.id) ?? []).map((b) => [b.caracteristique_id, [b.minimum, b.maximum]])),
      };
    });

  const ethnies = lignes(db, `
    SELECT id, race_id, nom, magie_id, bonus_pv, bonus_chakra, bonus_barriere, bonus_ap, bonus_am, bonus_vitesse FROM ethnie ORDER BY ordre`)
    .map((e) => ({ id: e.id, race_id: e.race_id, nom: e.nom, magie_id: e.magie_id, sante: e.bonus_pv ?? 0, chakra: e.bonus_chakra ?? 0,
      barriere: e.bonus_barriere ?? 0, ap: e.bonus_ap ?? 0, am: e.bonus_am ?? 0, vitesse: e.bonus_vitesse ?? 0 }));

  // Magies : ce qu'elles offrent (onglet « Magie » de la fiche), dieux innés, incompatibilités, mono-magie (R15) et ses exceptions (R20).
  const dieuxDeMagie = parCle(lignes(db, 'SELECT magie_id, dieu_id FROM magie_dieu ORDER BY magie_id, rang'), 'magie_id', (r) => r.dieu_id);
  const incompatibles = parCle(lignes(db, 'SELECT a, b FROM v_magie_incompatible'), 'a', (r) => r.b);
  const secondaires = parCle(lignes(db, 'SELECT magie_id, ethnie_id FROM magie_ethnie_secondaire WHERE ethnie_id IS NOT NULL'), 'magie_id', (r) => r.ethnie_id);
  const magies = lignes(db, `
    SELECT id, nom, caracteristique_id, caracteristique_brut, sante_offerte, chakra_offert, mono_magie, barre4_ressource, barre4_max FROM magie ORDER BY ordre`)
    .map((m) => ({
      id: m.id, nom: m.nom, couleur: couleurDeMagie(m.nom), texte: texteSurCouleur(couleurDeMagie(m.nom)),
      caracteristique_id: m.caracteristique_id, caracteristique_brut: m.caracteristique_id ? null : m.caracteristique_brut,
      sante: m.sante_offerte ?? 0, chakra: m.chakra_offert ?? 0, mono_magie: m.mono_magie === 1,
      barre4: m.barre4_ressource ? { ressource: m.barre4_ressource, max: m.barre4_max } : null,
      dieux: dieuxDeMagie.get(m.id) ?? [], incompatibles: incompatibles.get(m.id) ?? [], ethnies_secondaires: secondaires.get(m.id) ?? [],
    }));

  const dieux = lignes(db, 'SELECT id, nom FROM dieu ORDER BY ordre_choix IS NULL, ordre_choix, nom');
  const metiers = lignes(db, 'SELECT id, nom FROM metier ORDER BY nom COLLATE NOCASE');

  // Classes : apport de départ, catégorie et couleur de /classes/ ; classe magique par sa catégorie ou l'Archimage (R6), spécialité magique quand
  // son don de niveau 10 dit « considérer comme classe magique » (R7) ; dons à choix rangés en groupes (v_capacite_exclusive, comme la page de la classe) ;
  // magie innée qui réserve et impose la classe (classe.magie_innee_id : l'Archimage et le Potentiel Illimité, décision R23), ou qui la ferme
  // (classe.magie_innee_exclue_id : le Mage Bleu et le Potentiel Illimité, décision R25) ; maîtrises d'armes de la classe (classe_maitrise_arme) et
  // points de maîtrise que donnent ses dons (texte du don, lib/maitrise-arme.mjs), pour le quota de maîtrise de la fiche (décision R32).
  const amMagique = db.prepare("SELECT am_base FROM categorie_classe WHERE id = 'classe-magique'").get()?.am_base;
  if (!amMagique) throw new Error('categorie_classe « classe-magique » : am_base absent');
  const alternatives = parCle(lignes(db, 'SELECT capacite_id, autre_id FROM v_capacite_exclusive'), 'capacite_id', (r) => r.autre_id);
  const capacites = parCle(lignes(db, 'SELECT id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, type, effet FROM capacite'), 'classe_id');
  const specialites = parCle(lignes(db, 'SELECT id, classe_id, rang, nom FROM specialite ORDER BY classe_id, rang'), 'classe_id');
  const maitrises = parCle(lignes(db, 'SELECT classe_id, brut, nombre FROM classe_maitrise_arme WHERE nombre IS NOT NULL ORDER BY classe_id, rang'), 'classe_id',
    (r) => ({ brut: r.brut, nombre: r.nombre }));
  const classes = lignes(db, `
    SELECT c.id, c.nom, c.sante_depart, c.chakra_depart, c.barriere_depart, c.categorie_id, c.magie_innee_id, c.magie_innee_exclue_id, k.libelle AS categorie, k.am_base
    FROM classe c JOIN categorie_classe k ON k.id = c.categorie_id ORDER BY c.ordre`)
    .map((c) => {
      const dons = capacites.get(c.id) ?? [];
      const entree = entrees.find((e) => e.id === c.id) ?? { id: c.id, data: { title: c.nom, tags: [] } };
      const parSpecialite = (specialiteId) =>
        groupesDeChoix(dons.filter((d) => d.nature === 'choix' && d.specialite_id === specialiteId).map((d) => ({ ...d, alternatives: alternatives.get(d.id) ?? [] })))
          .filter((g) => g.options.length > 1)
          .map((g) => ({ niveau: g.niveau, specialite_id: specialiteId, options: g.options.map((o) => ({ id: o.id, nom: o.nom, type: o.type })) }));
      const specialitesDeLaClasse = (specialites.get(c.id) ?? []).map((s) => {
        const cartouche = dons.find((d) => d.nature === 'specialite' && d.specialite_id === s.id);
        return { id: s.id, nom: s.nom, rang: s.rang, magique: ditClasseMagique(cartouche?.effet) };
      });
      return {
        id: c.id, nom: c.nom, categorie: c.categorie, couleur: classColor(entree),
        // colonne de /classes/ (Parleur sous « Spéciales ») et son rang de gauche à droite
        groupe: (({ key, label }) => ({ key, label, ordre: CLASS_GROUPS.findIndex((g) => g.key === key) }))(classCategory(entree) ?? { key: 'speciales', label: 'Spéciales' }),
        magique: (c.am_base ?? 0) > 0 || c.id === 'classes/archimage',
        sante: c.sante_depart, chakra: c.chakra_depart, barriere: c.barriere_depart,
        magie_innee_id: c.magie_innee_id, magie_innee_exclue_id: c.magie_innee_exclue_id,
        specialites: specialitesDeLaClasse,
        choix: [null, ...specialitesDeLaClasse.map((s) => s.id)].flatMap(parSpecialite).sort((a, b) => a.niveau - b.niveau),
        maitrises: maitrises.get(c.id) ?? [],
        dons_maitrise: dons.map((d) => ({ id: d.id, nom: d.nom, nature: d.nature, niveau: d.niveau, specialite_id: d.specialite_id, points: pointsDeMaitriseDArme(d.effet) }))
          .filter((d) => d.points !== 0),
      };
    });

  const sorts = lignes(db, 'SELECT id, magie_id, nom, niveau, cout_brut, portee_brut FROM sort ORDER BY magie_id, niveau, ordre')
    .map((s) => ({ id: s.id, magie_id: s.magie_id, nom: s.nom, niveau: s.niveau, cout: s.cout_brut, portee: s.portee_brut }));

  // Équipement : les catalogues de la base, avec ce qu'il faut pour choisir (nom, famille, cible d'une amélioration, AP/AM indiqués).
  const nomDeRessource = (id) => db.prepare('SELECT nom FROM ressource WHERE id = ?').get(id)?.nom ?? id;
  const equipement = {
    // dé de la famille, et ses paliers selon la Force quand sa note les écrit (Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force »)
    familles_armes: lignes(db, 'SELECT id, nom, de_brut, note_brut FROM arme_famille ORDER BY ordre')
      .map((f) => ({ id: f.id, nom: f.nom, de: f.de_brut, de_selon_force: desSelonLaForce(f.note_brut) })),
    armes: lignes(db, 'SELECT id, nom, famille_id, mains FROM arme ORDER BY famille_id, ordre'),
    materiaux_armes: lignes(db, 'SELECT ressource_id FROM materiau_arme ORDER BY ordre').map((m) => ({ id: m.ressource_id, nom: nomDeRessource(m.ressource_id) })),
    ameliorations: lignes(db, 'SELECT id, cible, niveau, effet_brut FROM amelioration_equipement ORDER BY cible, niveau')
      .map((a) => ({ id: a.id, cible: a.cible, niveau: a.niveau, effet: a.effet_brut })),
    armes_elementaires: lignes(db, 'SELECT id, nom, magie_id FROM arme_elementaire ORDER BY ordre'),
    emplacements_armure: lignes(db, "SELECT id, nom FROM armure_emplacement WHERE id <> 'bouclier' ORDER BY ordre"),
    armures: lignes(db, 'SELECT id, nom, type, ap, am FROM armure ORDER BY ordre'),
    armures_elementaires: lignes(db, 'SELECT id, nom, categorie, ap, am FROM armure_elementaire ORDER BY ordre'),
    boucliers: lignes(db, 'SELECT id, nom, classe FROM bouclier_classe ORDER BY classe'),
    materiaux_bouclier: lignes(db, 'SELECT ressource_id, ap, am FROM materiau_bouclier ORDER BY ordre').map((m) => ({ id: m.ressource_id, nom: nomDeRessource(m.ressource_id), ap: m.ap, am: m.am })),
    accessoires: lignes(db, 'SELECT id, propriete_id, libelle, bonus_min, bonus_max, bonus_valeur, bonus_cible, malediction FROM accessoire_effet ORDER BY propriete_id, ordre')
      .map((a) => ({ id: a.id, propriete: a.propriete_id, libelle: a.libelle, min: a.bonus_min, max: a.bonus_max, valeur: a.bonus_valeur, cible: a.bonus_cible, malediction: a.malediction === 1 })),
    ressources: lignes(db, 'SELECT id, nom, genre FROM ressource ORDER BY nom COLLATE NOCASE'),
  };

  return { constantes, am_classe_magique: amMagique, niveaux, caracteristiques, competences, initiative, races, ethnies, magies, dieux, metiers, classes, sorts, ...equipement };
}
