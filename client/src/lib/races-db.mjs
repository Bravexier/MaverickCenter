// Races lues dans la base typée (tables race, race_onglet, race_don, race_don_tableau_*, race_magie_onglet, race_magie, race_classe, mode_hyper_effet,
// peuple, v_regard_peuple ; voir docs/sql/structure.md). Le gabarit des pages de race (components/race/RacePage.astro) n'interprète aucun Markdown : il
// affiche ces lignes. Décision R13 du propriétaire : l'onglet de la race (classeur « Les races ») est la source ; la fiche V15.2.2 n'en est qu'un dérivé,
// ses écarts ne sont pas affichés. Seules les matrices de la fiche servent encore : classes accessibles (R8) et magies innées quand l'onglet ne les limite
// pas lui-même (R8, R11 : race_magie_onglet prime).
// Node seulement (la base est ouverte par lib/donnees.mjs au build). Une requête par table, puis assemblage en mémoire.
import { blocsDeTexte } from './sort-format.mjs';

const apres = (id, separateur) => id.slice(id.indexOf(separateur) + separateur.length);
const regrouper = (rows, cle) => {
  const m = new Map();
  for (const r of rows) {
    const k = r[cle];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};

/**
 * @returns {{ races: Map<string, object>, relations: { peuples: object[], regards: object[], echelle: object[] } }}
 *   races : clé = id de la page (« races/elfe-noir »), dans l'ordre de la fiche (race.ordre) ;
 *   relations : de quoi alimenter lib/race-relations.mjs#relationsDeRace (matrice « Relation entre les races », sens R12).
 */
export function chargerRaces(db) {
  const all = (sql) => db.prepare(sql).all();

  const magies = all('SELECT id, nom, ordre FROM magie ORDER BY ordre');
  const magiesOnglet = regrouper(
    all('SELECT o.race_id, o.magie_id FROM race_magie_onglet o JOIN magie m ON m.id = o.magie_id ORDER BY o.race_id, m.ordre'),
    'race_id',
  );
  const magiesMatrice = regrouper(all('SELECT race_id, magie_id FROM race_magie WHERE accessible = 1 ORDER BY race_id, ordre'), 'race_id');
  const classes = regrouper(
    all(
      `SELECT rc.race_id, rc.accessible, c.id, c.nom, c.categorie_id FROM race_classe rc JOIN classe c ON c.id = rc.classe_id
       ORDER BY rc.race_id, rc.ordre`,
    ),
    'race_id',
  );
  // Classe raciale : la classe « Hybride Animal » qui porte le nom de la race (même règle que lib/race-kinds.mjs, ici sur les tables)
  const classesRaciales = new Map(
    all("SELECT id, nom, nom_cle FROM classe WHERE categorie_id = 'classe-hybride-animal'").map((c) => [c.nom_cle, { id: c.id, nom: c.nom }]),
  );
  const dons = regrouper(all('SELECT * FROM race_don ORDER BY race_id, rang'), 'race_id');
  const colonnes = regrouper(all('SELECT race_id, rang, libelle FROM race_don_tableau_colonne ORDER BY race_id, rang'), 'race_id');
  const lignes = regrouper(all('SELECT race_id, rang, ethnie_id FROM race_don_tableau_ligne ORDER BY race_id, rang'), 'race_id');
  const cellules = regrouper(all('SELECT race_id, ligne, colonne, valeur FROM race_don_tableau_cellule ORDER BY race_id, ligne, colonne'), 'race_id');
  const hyper = new Map(
    all("SELECT race_id, nom, effet FROM mode_hyper_effet WHERE version = 'onglet_race' AND portee = 'race'").map((h) => [h.race_id, h]),
  );
  const onglets = new Map(all('SELECT * FROM race_onglet').map((o) => [o.race_id, o]));

  const races = new Map();
  for (const r of all('SELECT * FROM race ORDER BY ordre')) {
    const o = onglets.get(r.id) ?? null;
    const slug = apres(r.id, '/');
    const innees = magiesOnglet.get(r.id) ?? magiesMatrice.get(r.id) ?? [];
    const idsInnees = new Set(innees.map((m) => m.magie_id));
    const h = hyper.get(r.id);
    const colonnesTableau = colonnes.get(r.id) ?? [];
    const cellulesParLigne = regrouper(cellules.get(r.id) ?? [], 'ligne');
    races.set(r.id, {
      id: r.id,
      slug,
      nom: r.nom,
      ordre: r.ordre,
      presentation: r.presentation,
      onglet: o?.onglet ?? null,
      // valeurs de départ de l'onglet (« DONNÉES »)
      stats: o
        ? [
            { label: 'Santé de départ', valeur: o.sante_depart },
            { label: 'Chakra de départ', valeur: o.chakra_depart },
            { label: 'Barrière bonus', valeur: o.barriere_bonus },
            { label: 'Vitesse au sol', valeur: o.vitesse_sol },
            { label: 'Vitesse de nage', valeur: o.vitesse_nage },
          ]
        : [],
      descriptionGenerale: blocsDeTexte(o?.description_generale),
      histoire: blocsDeTexte(o?.histoire),
      description: blocsDeTexte(o?.description),
      avantages: blocsDeTexte(o?.avantages),
      inconvenients: blocsDeTexte(o?.inconvenients),
      donBase: blocsDeTexte(o?.don_base),
      rubriques: o?.dons_rubrique ? { etiquette: o.dons_rubrique, nom: o.dons_rubrique_nom, don: o.dons_rubrique_don } : null,
      dons: (dons.get(r.id) ?? []).map((d) => ({
        id: d.id,
        slug: d.slug,
        forme: d.forme,
        etiquette: d.etiquette,
        nom: d.nom,
        texte: blocsDeTexte(d.texte),
        remarque: d.remarque,
      })),
      tableau:
        colonnesTableau.length > 0
          ? {
              titre: o?.dons_tableau_titre ?? null,
              colonnes: colonnesTableau.map((c) => c.libelle),
              lignes: (lignes.get(r.id) ?? []).map((l) => (cellulesParLigne.get(l.rang) ?? []).map((c) => blocsDeTexte(c.valeur))),
            }
          : null,
      hyper: h ? { nom: h.nom, blocs: blocsDeTexte(h.effet) } : null,
      // magies innées : la liste de l'onglet quand il en écrit une (R11), sinon la matrice de la fiche (R8)
      magiesInnees: {
        source: magiesOnglet.has(r.id) ? 'onglet' : 'matrice',
        avec: magies.filter((m) => idsInnees.has(m.id)).map((m) => ({ id: m.id, nom: m.nom })),
        sans: magies.filter((m) => !idsInnees.has(m.id)).map((m) => ({ id: m.id, nom: m.nom })),
      },
      classes: {
        avec: (classes.get(r.id) ?? []).filter((c) => c.accessible === 1).map((c) => ({ id: c.id, nom: c.nom, categorie: c.categorie_id })),
        sans: (classes.get(r.id) ?? []).filter((c) => c.accessible === 0).map((c) => ({ id: c.id, nom: c.nom, categorie: c.categorie_id })),
      },
      classeRaciale: classesRaciales.get(slug) ?? null,
    });
  }

  return {
    races,
    relations: {
      peuples: all('SELECT id, nom, ordre, race_id AS raceId FROM peuple ORDER BY ordre'),
      regards: all('SELECT peuple_id AS peupleId, vu_peuple_id AS vuPeupleId, echelle_id AS echelleId FROM v_regard_peuple'),
      echelle: all('SELECT id, libelle, ordre FROM echelle_relation ORDER BY ordre'),
    },
  };
}
