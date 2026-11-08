// Races lues dans la base typée (tables race, race_onglet, race_don, race_don_tableau_*, race_magie_onglet, race_magie, classe, mode_hyper_effet,
// peuple, v_regard_peuple ; voir docs/sql/structure.md). Le gabarit des pages de race (components/race/RacePage.astro) n'interprète aucun Markdown : il
// affiche ces lignes. Décision R13 du propriétaire : l'onglet de la race (classeur « Les races ») est la source ; la fiche V15.2.2 n'en est qu'un dérivé,
// ses écarts ne sont pas affichés. Seule la matrice des magies innées de la fiche sert encore, quand l'onglet ne les limite pas lui-même (R8, R11 :
// race_magie_onglet prime). Les classes accessibles (race_classe) ne sont pas affichées (demande du propriétaire) : seule la classe raciale l'est.
// Node seulement (la base est ouverte par lib/donnees.mjs au build). Une requête par table, puis assemblage en mémoire.
import { celluleDeNoteDuDon } from './corps-races.mjs';
import { HYBRIDES_SANS_CLASSE_RACIALE, TAG_RACE_HYBRIDE } from './race-kinds.mjs';
import { nomDuProtege } from './mots-cles-proteges.mjs';
import { etiquettesDesPages } from './pages-db.mjs';

/**
 * Les pages qui portent le mot-clé « race hybride » (TAG_RACE_HYBRIDE), reconnu par son id, ou par sa clé tant qu'il n'en a pas
 * (lib/mots-cles-proteges.mjs#nomDuProtege ; décision R195 : jamais par son écriture) : Set de page_id.
 */
export const pagesDeLaRaceHybride = (db) => new Set(etiquettesDesPages(db).filter((t) => nomDuProtege(t) === TAG_RACE_HYBRIDE).map((t) => t.page_id));
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
  // Classe raciale : la classe « Hybride Animal » qui porte le nom de la race (même règle que lib/race-kinds.mjs, ici sur les tables)
  const classesRaciales = new Map(
    all("SELECT id, nom, nom_cle FROM classe WHERE categorie_id = 'classe-hybride-animal'").map((c) => [c.nom_cle, { id: c.id, nom: c.nom }]),
  );
  const dons = regrouper(all('SELECT * FROM race_don ORDER BY race_id, rang'), 'race_id');
  const colonnes = regrouper(all('SELECT race_id, rang, libelle FROM race_don_tableau_colonne ORDER BY race_id, rang'), 'race_id');
  const lignes = regrouper(all('SELECT race_id, rang, ethnie_id FROM race_don_tableau_ligne ORDER BY race_id, rang'), 'race_id');
  const cellules = regrouper(all('SELECT race_id, ligne, colonne, valeur FROM race_don_tableau_cellule ORDER BY race_id, ligne, colonne'), 'race_id');
  const hyper = new Map(
    all("SELECT id, race_id, nom, effet FROM mode_hyper_effet WHERE version = 'onglet_race' AND portee = 'race'").map((h) => [h.race_id, h]),
  );
  const onglets = new Map(all('SELECT * FROM race_onglet').map((o) => [o.race_id, o]));
  // races créées hybrides depuis le site de dev, avant leur classe raciale (même règle que lib/race-kinds.mjs#raceKind : le mot-clé par son id, R195)
  const marqueesHybrides = pagesDeLaRaceHybride(db);

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
      // place dans la liste des races (menu latéral, /races/, tableau des magies innées : migration 0092) ; null = pas encore rangée, en fin de liste,
      // par nom (comparerRangsDeListe). La fiche et /magies/ gardent ORDRE_DES_RACES (lib/race-kinds.mjs), race.ordre reste l'ordre de l'onglet « Race »
      rangListe: r.rang_liste ?? null,
      presentation: r.presentation,
      onglet: o?.onglet ?? null,
      // valeurs de départ de l'onglet (« DONNÉES »)
      stats: o
        ? [
            { label: 'Santé de départ', valeur: o.sante_depart, colonne: 'sante_depart' },
            { label: 'Chakra de départ', valeur: o.chakra_depart, colonne: 'chakra_depart' },
            { label: 'Barrière bonus', valeur: o.barriere_bonus, colonne: 'barriere_bonus' },
            { label: 'Vitesse au sol', valeur: o.vitesse_sol, colonne: 'vitesse_sol' },
            { label: 'Vitesse de nage', valeur: o.vitesse_nage, colonne: 'vitesse_nage' },
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
        // mode modification : une remarque n'a de place dans la page de la race (et ne se relit, tools/db/races_onglet.py) que sur un don dont
        // l'onglet porte une note de cellule (les trois du Médusain) ; ailleurs, le service la refuse
        remarqueModifiable: celluleDeNoteDuDon(d) !== null,
      })),
      tableau:
        colonnesTableau.length > 0
          ? {
              titre: o?.dons_tableau_titre ?? null,
              colonnes: colonnesTableau.map((c) => c.libelle),
              rangsColonnes: colonnesTableau.map((c) => c.rang),
              lignes: (lignes.get(r.id) ?? []).map((l) => (cellulesParLigne.get(l.rang) ?? []).map((c) => blocsDeTexte(c.valeur))),
              // (ligne, colonne) de chaque case, pour le mode modification du site de dev
              cases: (lignes.get(r.id) ?? []).map((l) => (cellulesParLigne.get(l.rang) ?? []).map((c) => ({ ligne: c.ligne, colonne: c.colonne }))),
            }
          : null,
      hyper: h ? { id: h.id, nom: h.nom, blocs: blocsDeTexte(h.effet) } : null,
      // magies innées : la liste de l'onglet quand il en écrit une (R11), sinon la matrice de la fiche (R8)
      magiesInnees: {
        source: magiesOnglet.has(r.id) ? 'onglet' : 'matrice',
        avec: magies.filter((m) => idsInnees.has(m.id)).map((m) => ({ id: m.id, nom: m.nom })),
        sans: magies.filter((m) => !idsInnees.has(m.id)).map((m) => ({ id: m.id, nom: m.nom })),
      },
      classeRaciale: classesRaciales.get(slug) ?? null,
      // race hybride : elle a sa classe raciale, ou c'est une exception du propriétaire (Drassah'thac, décision R14) ; même règle que lib/race-kinds.mjs
      hybride: classesRaciales.has(slug) || HYBRIDES_SANS_CLASSE_RACIALE.has(r.id) || marqueesHybrides.has(r.id),
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

/**
 * L'ordre de la liste des races (migration 0092, réponse du propriétaire « /races/ suit, le reste figé » : le menu latéral des races, la liste /races/
 * et le tableau des magies innées en bas de /races/) : `rang_liste` croissant, une race sans rang (NULL : créée sur le site de dev avant d'être
 * rangée) en fin de liste, puis le nom à égalité — comme `ORDER BY rang_liste IS NULL, rang_liste, nom`. Pour trier des races de chargerRaces
 * (`{ rangListe, nom }`) ; la fiche et /magies/ gardent ORDRE_DES_RACES (lib/race-kinds.mjs).
 */
export const comparerRangsDeListe = (a, b) =>
  Number(a.rangListe === null || a.rangListe === undefined) - Number(b.rangListe === null || b.rangListe === undefined)
  || (a.rangListe ?? 0) - (b.rangListe ?? 0) || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0);

/**
 * Les races de la base en deux groupes, dans l'ordre de la liste (comparerRangsDeListe) : { pures, hybrides }, chacune { id, nom, rang_liste }. Une race
 * est hybride si elle a sa classe raciale (catégorie « Classe Hybride Animal », même nom), si c'est une exception du propriétaire (le Drassah'thac,
 * décision R14) ou si elle a été créée hybride sur le site de dev avant sa classe raciale (mot-clé « race hybride ») : la règle de chargerRaces et de
 * lib/race-kinds.mjs#raceKind. Lu par le service (l'opération `ordonner` d'un groupe, GET /api/edition/plan/). Une base d'avant la migration 0092
 * (sans la colonne) : `rang_liste` null partout.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function racesParNature(db) {
  const avecRang = db.prepare('PRAGMA table_info(race)').all().some((c) => c.name === 'rang_liste');
  const raciales = new Set(db.prepare("SELECT nom_cle FROM classe WHERE categorie_id = 'classe-hybride-animal'").all().map((c) => c.nom_cle));
  const marquees = pagesDeLaRaceHybride(db);
  const groupes = { pures: [], hybrides: [] };
  for (const r of db.prepare(`SELECT id, nom, ${avecRang ? 'rang_liste' : 'NULL AS rang_liste'} FROM race`).all()) {
    const hybride = raciales.has(apres(r.id, '/')) || HYBRIDES_SANS_CLASSE_RACIALE.has(r.id) || marquees.has(r.id);
    groupes[hybride ? 'hybrides' : 'pures'].push({ id: r.id, nom: r.nom, rang_liste: r.rang_liste });
  }
  const ordre = (a, b) => comparerRangsDeListe({ rangListe: a.rang_liste, nom: a.nom }, { rangListe: b.rang_liste, nom: b.nom });
  return { pures: groupes.pures.sort(ordre), hybrides: groupes.hybrides.sort(ordre) };
}
