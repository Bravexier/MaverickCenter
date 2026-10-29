// Les règles dont la page /fiche/ a besoin, lues dans la base au build (publiées en /fiche/regles.json) : listes de choix (races, ethnies, magies,
// classes, spécialités, dons à choix, sorts, équipement…), ce que chaque choix apporte, et les tables de progression. Rien n'est recalculé ni
// déduit ici : chaque valeur vient d'une table (ou d'une vue) de la base, et les couleurs sont celles des autres pages du site. Les calculs de la
// fiche (niveau, budgets, attributs…) sont dans lib/fiche-moteur.mjs, qui ne lit que ce JSON.
// Les balises du glossaire des mots-clés (« {{recharge-longue|Recharge longue}} », lib/mots-cles-balises.mjs) sont retirées de tout texte lu dans la base,
// avant les lectures de ce module (lecteurs des dons, du Mode Hyper…) comme dans le JSON, et lues comme les découpages : le texte écrit (une case en a
// toujours un), le libellé pour une balise d'un texte mis en forme qui n'en a pas, jamais la définition (le mode complet ne donne que le libellé) ; jamais
// une balise brute.
// Node seulement (la base est ouverte par lib/donnees.mjs).
import { groupesDeChoix, typeDeDon } from './classe-dons.mjs';
import { ditClasseMagique } from './classe-magique.mjs';
import { COULEURS_ALIGNEMENTS } from './caracteristiques-postures.mjs';
import { effetDePosture } from './posture-texte.mjs';
import { CLASS_GROUPS, classCategory } from './class-groups.mjs';
import { competencesDArme, durabiliteDeLArme, porteeDeLArme } from './arme-champs.mjs';
import { DURABILITE_MIN } from './arme-forge.mjs';
import { BATON_A_REGLER, contenanceEcrite, effetsDeBaton, exemplairesDeCeintureEcrits, nomDeBaton, sacSansForceEcrit } from './ceinture-texte.mjs';
import { bonusDeDegatsEcrit } from './degats-texte.mjs';
import { bonusDeSortsEcrits, preparationEcrite } from './sort-bonus-texte.mjs';
import { lecteurDAcquis } from './acquis-texte.mjs';
import { chargerInvocations, tableauxDesSorts } from './bestiaire-db.mjs';
import { FAMILLES_DES_SAUF, desSelonLaForce, famillesAuChoix, idDeSourceDeClasse } from './maitrise-arme.mjs';
import { ORDRE_DES_RACES, raceKind } from './race-kinds.mjs';
import { lecteurDeResistances } from './resistance-texte.mjs';
import {
  CLASSE_NEUTRE, classeDAlignement, classeDUneClasse, classeDeCaracteristique, classeDeMagie, classeDePalier, classeDePosture, classeDeRace,
  classeDeSecondeMagie, classeDuModeHyper, classeDuPoids,
} from './palette-css.mjs';
import { normalize } from './text.mjs';
import { chargerVocabulaire } from './mots-cles-db.mjs';
import { texteSansBalises, vocabulaireDesMotsCles } from './mots-cles-balises.mjs';
import { valeurDuPoids } from './fiche-format.mjs';

const vocabulaires = new WeakMap(); // base -> vocabulaire des mots-clés
const vocabulaireDe = (db) => {
  if (!vocabulaires.has(db)) vocabulaires.set(db, vocabulaireDesMotsCles(chargerVocabulaire(db)));
  return vocabulaires.get(db);
};
/** Une valeur de la base sans balises du glossaire (le texte affiché, sans définition) ; les objets et listes, chacune de leurs chaînes. */
function sansBalises(db, v) {
  if (typeof v === 'string') return v.includes('{{') ? texteSansBalises(v, vocabulaireDe(db), { definitions: false }) : v;
  if (Array.isArray(v)) return v.map((x) => sansBalises(db, x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sansBalises(db, x)]));
  return v;
}
const lignes = (db, sql, ...params) => db.prepare(sql).all(...params).map((r) => sansBalises(db, { ...r }));
const parCle = (rows, cle, valeur = (r) => r) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[cle])) m.set(r[cle], []);
    m.get(r[cle]).push(valeur(r));
  }
  return m;
};

/** Entrées minimales (id, titre, tags) des pages de races et de classes : pour réutiliser raceKind et la couleur de la catégorie (classeDUneClasse), comme /races/ et /classes/. */
function entreesDesPages(db) {
  const tags = parCle(lignes(db, "SELECT t.page_id, m.libelle FROM page_tag t JOIN mot_cle m ON m.id = t.tag_id WHERE t.page_id LIKE 'classes/%' OR t.page_id LIKE 'races/%' ORDER BY t.page_id, t.ordre"), 'page_id', (r) => r.libelle);
  return lignes(db, "SELECT id, titre FROM page WHERE type IN ('classes', 'races')").map((p) => ({ id: p.id, data: { title: p.titre, tags: tags.get(p.id) ?? [] } }));
}

// Les « sauf » d'une maîtrise au choix écrits autrement que le bandeau de leur famille (décision R138), rattachés dans lib/maitrise-arme.mjs avec la
// lecture des sources de maîtrise ; réexportés ici pour les lecteurs des règles de la fiche.
export { FAMILLES_DES_SAUF };

/** Constantes de la fiche (table regle_constante) utilisées par le moteur, sous leur identifiant. */
const CONSTANTES = [
  'caracteristique.base_min', 'caracteristique.base_max', 'caracteristique.bonus_magie_innee', 'competence.base_par_point_caracteristique',
  'competence.acquis_max_par_point_caracteristique', 'competence.croix_1_malus', 'competence.croix_2_malus', 'classe.mono_niveau_max',
  'classe.mono_niveaux_par_niveau_global', 'classe.mode_verrou_xp', 'sort.nm_ecart_niveau_global', 'barriere.diviseur_chakra',
  'maitrise_arme.des_sans_maitrise', 'maitrise_arme.des_max', 'sort.nm_max', 'alignement.ecart_axe', 'metier.artisanat_par_point_caracteristique',
  // l'entraînement (décision R104) : « 15 compétences maximum […] à hauteur maximum 10% de bonus »
  'entrainement.competences_max', 'entrainement.bonus_max_pct',
  // inventaire et ceinture (décisions R88, R89, migration 0048)
  'inventaire.colonnes_de_depart', 'inventaire.lignes_par_colonne', 'inventaire.colonnes_max', 'inventaire.emplacements_force_2',
  'inventaire.emplacements_force_3', 'inventaire.emplacements_force_4', 'inventaire.force_tout_l_inventaire', 'ceinture.exemplaires_par_emplacement',
];

/** @param {import('node:sqlite').DatabaseSync} db */
export const chargerReglesDeFiche = (db) => sansBalises(db, reglesDeLaBase(db));

function reglesDeLaBase(db) {
  const constantes = Object.fromEntries(CONSTANTES.map((id) => {
    const r = db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(id);
    if (!r) throw new Error(`regle_constante « ${id} » absente de la base`);
    return [id, r.valeur];
  }));
  // « Ne peut dépasser 4 » (onglet Accessoires, « SI CARACTÉRISTIQUE ») : la caractéristique avec l'accessoire (décision R54)
  const accessoireMax = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'accessoire.caracteristique_max'").get();
  if (!accessoireMax) throw new Error('constante_equipement « accessoire.caracteristique_max » absente de la base');
  constantes['accessoire.caracteristique_max'] = accessoireMax.valeur;
  // solidité d'une armure élémentaire (décision R165 (3) : « Chaque pièce élémentaire possède 4 crans de solidité/durabilité », sur les six parties, plus
  // les crans de son amélioration : lib/fiche-moteur.mjs)
  const soliditePiece = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'piece_elementaire.solidite_base'").get();
  if (!soliditePiece) throw new Error('constante_equipement « piece_elementaire.solidite_base » absente de la base');
  constantes['piece_elementaire.solidite_base'] = soliditePiece.valeur;
  // solidité d'une arme forgée (décisions R51, R74) : les crans de l'arme, de son matériau et de son amélioration se cumulent, « impossible de descendre à
  // moins de 1 » ; le plancher vient de lib/arme-forge.mjs (page Armes), que le moteur de la fiche ne peut pas importer (un module par script de page)
  constantes['arme.durabilite_min'] = DURABILITE_MIN;
  const soliditeDeBase = db.prepare("SELECT valeur FROM constante_equipement WHERE id = 'arme.solidite_base'").get();
  if (!soliditeDeBase) throw new Error('constante_equipement « arme.solidite_base » absente de la base');
  // solidité d'une arme élémentaire (décision R167 : « Solidité : 4 crans + les crans de la ligne d'amélioration choisie » ; Pièces élémentaires › A3) :
  // celle de toute pièce élémentaire, `piece_elementaire.solidite_base` (migration 0080, lue plus haut), que le moteur lit telle quelle ; la base n'a plus de
  // constante propre aux armes (migration 0081)

  // gains de niveau (décision R73) : les points d'attributs et les bornes du dé de chaque niveau, et leurs cumuls (v_niveau), les mêmes que la règle
  // gains_niveau de v_personnage_controle : la plage à saisir se lit ici, jamais 15 × (N − 1) écrit dans le moteur
  const niveaux = lignes(db, `
    SELECT g.niveau, g.xp_min, g.points_competences, g.points_attributs, g.de_attributs_bonus, g.de_attributs_min, g.de_attributs_max,
           g.puissance_magique, g.puissance_magique_note, g.niveaux_maitrise, v.caracteristiques_total, v.competence_naturel_max,
           v.points_competences_cumul, v.niveaux_maitrise_cumul, v.points_attributs_cumul, v.de_attributs_min_cumul, v.de_attributs_max_cumul
    FROM niveau_global g JOIN v_niveau v ON v.niveau = g.niveau ORDER BY g.niveau`);

  // couleur de la caractéristique, reprise par ses compétences (demande du propriétaire, lib/caracteristiques-postures.mjs) : sa classe de la palette
  // (lib/palette-css.mjs, posée sur chaque page), jamais un hex
  const caracteristiques = lignes(db, 'SELECT id, nom, lettre FROM caracteristique ORDER BY ordre')
    .map((c) => ({ ...c, classe: classeDeCaracteristique(c.id) }));
  // celle d'une compétence dont la caractéristique est inconnue : la classe par défaut de la famille (COULEUR_NEUTRE)
  const caracteristique_par_defaut = { classe: classeDeCaracteristique(null) };
  const competences = lignes(db, 'SELECT id, nom, caracteristique_id FROM competence ORDER BY ordre');
  // les bonus d'acquis écrits dans le texte d'un don (décision R104, réponse « Lus dans les dons » : lib/acquis-texte.mjs)
  const lireAcquis = lecteurDAcquis(competences);
  // « parmi les autres » hors d'un tableau de dons (décision R124 : les autres lignes du tableau) : aucune compétence nommée, rien n'est deviné
  const horsDuTableau = (acquis) => acquis.map((b) => (b.autres ? { valeur: b.valeur, raison: 'inconnue', texte: b.texte } : b));
  const initiative = lignes(db, 'SELECT agilite, bonus, bonus_brut, note FROM initiative_agilite ORDER BY agilite');

  // Résistances (tableau « Résistance / Faiblesse » de la fiche auto V15.2.2, demande du propriétaire) : les six paliers (Personnage!BA2:BI12), les
  // altérations d'état, et ce que les dons écrivent en toutes lettres (lib/resistance-texte.mjs) : les cibles sont les magies et les altérations, sous
  // leur nom et sous les écritures que les importeurs leur ont rapprochées (magie_resistance, ethnie_resistance : « Gelé », « Pétrification »).
  // `multiplicateur` : celui des dégâts subis (« dégâts subis ÷2 » : 0,5), que le calcul des dégâts reçus applique (décision R98)
  const resistance_paliers = lignes(db, 'SELECT id, libelle, valeur_min, valeur_max, multiplicateur, effet_brut FROM resistance_palier ORDER BY ordre')
    // `classe` : la classe de la couleur du palier (lib/palette-css.mjs, famille `palier` ; null pour un palier sans couleur), jamais un hex
    .map((p) => ({ id: p.id, libelle: p.libelle, min: p.valeur_min, max: p.valeur_max, multiplicateur: p.multiplicateur, effet: p.effet_brut, classe: classeDePalier(p.id) }));
  const etats = lignes(db, 'SELECT id, nom FROM etat ORDER BY ordre');
  const lireResistances = lecteurDeResistances([
    ...lignes(db, 'SELECT id, nom FROM magie').map((m) => ({ type: 'magie', id: m.id, nom: m.nom })),
    ...etats.map((e) => ({ type: 'etat', id: e.id, nom: e.nom })),
    // les cibles physiques (décision R174) n'y vont pas : leur cible_brut est une phrase (« Surtension corporelle (Vulnérabilité… »), pas le nom
    // d'une cible qu'un don écrirait, et le lecteur ne reconnaît que des magies et des altérations
    ...lignes(db, `SELECT DISTINCT cible_type AS type, COALESCE(cible_magie_id, cible_etat_id) AS id, cible_brut AS nom FROM magie_resistance
                   WHERE cible_type IN ('magie', 'etat')
                   UNION SELECT DISTINCT cible_type, COALESCE(cible_magie_id, cible_etat_id), cible_brut FROM ethnie_resistance`),
  ]);
  /** `resistances` d'un don quand son texte en écrit (ou en laisse au choix) ; rien sinon, pour garder regles.json léger. */
  const resistancesEcrites = (lecture) => (lecture.effets.length || lecture.choix || lecture.au_choix?.length ? { resistances: lecture } : {});
  // Une magie au choix ou tirée (décision R137, « Q43: Oui » : Ocultomancien « Résilience », Anansi d'Arcane ; lib/resistance-texte.mjs, `magies_au_choix`) :
  // un choix de la fiche (`au_choix`, { rang, crans, magie: true, options (ids de magie), alteration? }), comme celui du Drakos orange (R124). Les options :
  // les magies de la base, dans leur ordre, sans celles que le don exclut (l'Arcane et la Corruption) ni le Potentiel Illimité, qui n'est pas une forme de
  // magie qu'on subit (décision R98 : « L'une des 14 formes de magie hors PI ») ; `alteration` : le cran va aussi à l'altération d'état de la magie
  // choisie (etat_magie, `magies[].etat_id`), que la fiche lit.
  const magiesSubies = lignes(db, "SELECT id FROM magie WHERE id <> 'magies/potentiel-illimite' ORDER BY ordre").map((m) => m.id);
  // Un don qui vise la magie innée et dont la remarque dit « Dans le cas du potentiel illimité, lancer un D14 pour déterminer une résistance magique
  // aléatoire » (Flagelleur, « Punis-moi ... » et « ... plus fort ! » ; décision R163 : « A chaque choix de don, tu choisi la résistance / altération
  // associée », « Les 14 magies ») : pour un personnage de cette magie innée (`si_magie_innee`), une magie tirée par le MJ (`de` : « D14 ») parmi les 14
  // magies qu'on subit, l'Arcane et la Corruption comprises, qui tient lieu de magie innée pour ce don seulement (`remplace_magie_innee`, sans `crans`) ;
  // un choix du tiroir (personnage_resistance_choix.magie_id, comme R137), après les magies au choix du don.
  const resistancesDuTexte = (texte, remarque = null) => {
    const { magies_au_choix: magiesAuChoix = [], si_magie_innee: siMagieInnee, de, ...lecture } = lireResistances(texte, { remarque });
    const au_choix = magiesAuChoix.map((c, i) => ({
      rang: i + 1, crans: c.crans, magie: true, options: magiesSubies.filter((id) => !c.sauf.includes(id)), ...(c.alteration ? { alteration: true } : {}),
    }));
    if (siMagieInnee && lecture.effets.some((e) => e.id === null)) {
      au_choix.push({ rang: au_choix.length + 1, magie: true, options: magiesSubies.filter((id) => id !== siMagieInnee), si_magie_innee: siMagieInnee, de, remplace_magie_innee: true });
    }
    return au_choix.length ? { ...lecture, au_choix } : lecture;
  };

  // Races : valeurs de départ de l'onglet de la race (décision R13), AP/AM de la race ; classes accessibles (matrice, R8) ; magies innées
  // accessibles (liste de l'onglet quand elle existe, R11, sinon la matrice) ; bornes des caractéristiques ; dons de l'onglet (race_don, un par ethnie
  // ou un seul) et son tableau de dons (race_don_tableau_* : une ligne par ethnie), pour le rappel des dons de la fiche (demande du propriétaire).
  const entrees = entreesDesPages(db);
  const accesClasses = parCle(lignes(db, 'SELECT race_id, classe_id FROM race_classe WHERE accessible = 1 ORDER BY race_id, ordre'), 'race_id', (r) => r.classe_id);
  const magiesOnglet = parCle(lignes(db, 'SELECT race_id, magie_id FROM race_magie_onglet ORDER BY race_id, rang'), 'race_id', (r) => r.magie_id);
  const magiesMatrice = parCle(lignes(db, 'SELECT race_id, magie_id FROM race_magie WHERE accessible = 1 ORDER BY race_id, ordre'), 'race_id', (r) => r.magie_id);
  const bornes = parCle(lignes(db, 'SELECT race_id, caracteristique_id, minimum, maximum FROM v_race_carac_borne'), 'race_id');
  const donsDeRace = parCle(lignes(db, 'SELECT id, race_id, forme, etiquette, nom, texte, ethnie_id FROM race_don ORDER BY race_id, rang'), 'race_id',
    (d) => {
      // les bonus de sorts que le don écrit (« Les dégâts de sorts, les soins […] gagnent un bonus de +3 » : lib/sort-bonus-texte.mjs, décision R102) ;
      // ses bonus d'acquis (« Magie, Concentration, Survie = 5% d'acquis » : lib/acquis-texte.mjs, décision R104)
      const sorts = bonusDeSortsEcrits(d.texte);
      const acquis = horsDuTableau(lireAcquis(d.texte));
      return {
        id: d.id, forme: d.forme, nom: d.nom, etiquette: d.etiquette, texte: d.texte, ethnie_id: d.ethnie_id, ...resistancesEcrites(resistancesDuTexte(d.texte)),
        ...(sorts.length ? { sorts } : {}), ...(acquis.length ? { acquis } : {}),
      };
    });
  const colonnesDuTableau = parCle(lignes(db, 'SELECT race_id, rang, libelle FROM race_don_tableau_colonne ORDER BY race_id, rang'), 'race_id');
  const cellulesDuTableau = parCle(lignes(db, 'SELECT race_id, ligne, colonne, valeur FROM race_don_tableau_cellule ORDER BY race_id, ligne, colonne'), 'race_id');
  const tableauDeDons = (raceId, titre) => {
    const colonnes = colonnesDuTableau.get(raceId);
    if (!colonnes) return null;
    const cellules = cellulesDuTableau.get(raceId) ?? [];
    // la ligne de l'ethnie donne ce qu'écrivent ses cellules (« +1 cran de résistance » : Brûlure ; « Résistance à la magie du Sang ») et ses bonus d'acquis
    // (« Bonus compétence » du Drakos : « 5% Athlétisme » ; décision R104), lus comme ceux d'un don, cellule par cellule
    const lues = lignes(db, 'SELECT rang, ethnie_id FROM race_don_tableau_ligne WHERE race_id = ? ORDER BY rang', raceId).map((l) => ({
      ethnie_id: l.ethnie_id,
      cellules: colonnes.map((c) => ({ colonne: c.rang, libelle: c.libelle, valeur: cellules.find((x) => x.ligne === l.rang && x.colonne === c.rang)?.valeur ?? null }))
        .filter((c) => c.valeur !== null)
        .map((c) => ({ ...c, resistances: lireResistances(c.valeur, { colonne: c.libelle }), acquis: lireAcquis(c.valeur) })),
    }));
    // « 5% parmi les autres » et « Au choix parmi les autres » (Drakos orange : décision R124, « au choix entre les bonus de compétence listés des autres
    // possiblité, pareil pour les résistance ») : un choix parmi ce que donnent les AUTRES lignes dans la même colonne, dans l'ordre du tableau, sans
    // doublon, jamais écrit à la main ; deux options au moins, sinon rien n'est deviné (la compétence reste non comptée, la résistance au choix signalée)
    const desAutres = (ligne, colonne) => lues.filter((x) => x !== ligne).flatMap((x) => x.cellules.filter((c) => c.colonne === colonne));
    const competencesDesAutres = (ligne, colonne) => [...new Set(desAutres(ligne, colonne).flatMap((c) => c.acquis.filter((b) => b.competence_id).map((b) => b.competence_id)))];
    // les résistances : des altérations d'état seulement (personnage_resistance_choix.etat_id), sinon le choix n'est pas proposé
    const etatsDesAutres = (ligne, colonne) => {
      const effets = desAutres(ligne, colonne).flatMap((c) => c.resistances.effets);
      return effets.every((e) => e.type === 'etat' && e.crans > 0) ? [...new Set(effets.map((e) => e.id))] : [];
    };
    return {
      titre,
      lignes: lues.map((l) => {
        const acquis = l.cellules.flatMap((c) => c.acquis.map((b) => {
          if (!b.autres) return b;
          const options = competencesDesAutres(l, c.colonne);
          return options.length >= 2 ? { valeur: b.valeur, choix: options, nombre: 1 } : { valeur: b.valeur, raison: 'inconnue', texte: b.texte };
        }));
        // `au_choix` : les résistances à choisir de la ligne, chacune { rang (1, 2… dans la ligne, celui de personnage_resistance_choix), crans, options }
        const au_choix = [];
        let choix = false;
        for (const c of l.cellules) {
          if (c.resistances.autres === undefined) {
            choix ||= c.resistances.choix;
            continue;
          }
          const options = etatsDesAutres(l, c.colonne);
          if (options.length >= 2) au_choix.push({ rang: au_choix.length + 1, crans: c.resistances.autres, options });
          else choix = true;
        }
        return {
          ethnie_id: l.ethnie_id,
          cellules: l.cellules.map(({ libelle, valeur }) => ({ libelle, valeur })),
          ...resistancesEcrites({ effets: l.cellules.flatMap((c) => c.resistances.effets), choix, ...(au_choix.length ? { au_choix } : {}) }),
          ...(acquis.length ? { acquis } : {}),
        };
      }),
    };
  };
  const rangDeRace = (id) => (ORDRE_DES_RACES.includes(id) ? ORDRE_DES_RACES.indexOf(id) : ORDRE_DES_RACES.length);
  const races = lignes(db, `
    SELECT r.id, r.nom, r.ap, r.am, r.mono_magie, o.sante_depart, o.chakra_depart, o.barriere_bonus, o.vitesse_sol, o.vitesse_nage, o.don_base,
           o.dons_tableau_titre, o.avantages
    FROM race r JOIN race_onglet o ON o.race_id = r.id`)
    .sort((a, b) => rangDeRace(a.id) - rangDeRace(b.id) || a.nom.localeCompare(b.nom, 'fr'))
    .map((r) => {
      const entree = entrees.find((e) => e.id === r.id) ?? { id: r.id, data: { title: r.nom, tags: [] } };
      const nature = raceKind(entrees, entree);
      return {
        // sa couleur : la classe de sa nature (lib/palette-css.mjs, famille `race`, celle de /races/ et des pages de race), jamais un hex
        id: r.id, nom: r.nom, nature, classe: classeDeRace(nature),
        sante: r.sante_depart, chakra: r.chakra_depart, barriere: r.barriere_bonus ?? 0, vitesse_sol: r.vitesse_sol, vitesse_nage: r.vitesse_nage,
        ap: r.ap ?? 0, am: r.am ?? 0, don_base: r.don_base, mono_magie: r.mono_magie === 1,
        classes: accesClasses.get(r.id) ?? [],
        magies: magiesOnglet.get(r.id) ?? magiesMatrice.get(r.id) ?? [],
        bornes: Object.fromEntries((bornes.get(r.id) ?? []).map((b) => [b.caracteristique_id, [b.minimum, b.maximum]])),
        dons: donsDeRace.get(r.id) ?? [],
        dons_tableau: tableauDeDons(r.id, r.dons_tableau_titre),
        // les avantages de l'onglet de la race, tels qu'écrits (race_onglet.avantages ; null sinon) : le moteur y lit ce qui change le poids portable
        // (décision R165 (6), Lamia : « peut porter une armure légère même si la classe l'interdit »), dans le texte, jamais par le nom de la race
        avantages: r.avantages ?? null,
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
  // Ses résistances et vulnérabilités : les listes de la page de la magie (magie_resistance, classeur V8), magies et altérations d'état, un cran
  // chacune ; et l'altération qui lui est liée (etat_magie), à laquelle un don « … à la magie innée et son altération d'état » donne un cran.
  // Les types de dégâts physiques aussi (décision R174, cible_type « physique ») : `{ type: 'physique', id: 'estoc' | 'taille' | 'frappe', crans }`,
  // l'id étant celui de DEGATS_PHYSIQUES (lib/fiche-moteur.mjs) ; aujourd'hui les trois vulnérabilités du Potentiel Illimité (« Surtension corporelle »),
  // un palier personnel dont l'annulation en Mode Hyper (R172, R174) n'est pas une donnée de la table.
  const resistancesDeMagie = parCle(lignes(db, `SELECT magie_id, sens, cible_type, COALESCE(cible_magie_id, cible_etat_id, cible_physique) AS cible_id
                                                 FROM magie_resistance ORDER BY magie_id, sens, cible_type, rang`), 'magie_id',
    (r) => ({ type: r.cible_type, id: r.cible_id, crans: r.sens === 'resistance' ? 1 : -1 }));
  const etatDeMagie = new Map(lignes(db, 'SELECT magie_id, etat_id FROM etat_magie').map((r) => [r.magie_id, r.etat_id]));
  const magies = lignes(db, `
    SELECT id, nom, caracteristique_id, caracteristique_brut, sante_offerte, chakra_offert, mono_magie, barre4_ressource, barre4_max, explication FROM magie ORDER BY ordre`)
    .map((m) => ({
      // sa couleur : les classes de la palette (lib/palette-css.mjs, posées sur chaque page), jamais un hex : `classe` (--couleur, --couleur-texte) et
      // `classe_2`, la classe de second rang (--couleur-2 : la magie acquise du dégradé des cadres)
      id: m.id, nom: m.nom, classe: classeDeMagie(m.nom), classe_2: classeDeSecondeMagie(m.nom),
      caracteristique_id: m.caracteristique_id, caracteristique_brut: m.caracteristique_id ? null : m.caracteristique_brut,
      sante: m.sante_offerte ?? 0, chakra: m.chakra_offert ?? 0, mono_magie: m.mono_magie === 1,
      barre4: m.barre4_ressource ? { ressource: m.barre4_ressource, max: m.barre4_max } : null,
      dieux: dieuxDeMagie.get(m.id) ?? [], incompatibles: incompatibles.get(m.id) ?? [], ethnies_secondaires: secondaires.get(m.id) ?? [],
      resistances: resistancesDeMagie.get(m.id) ?? [], etat_id: etatDeMagie.get(m.id) ?? null,
      // l'explication de la magie, telle qu'écrite (magie.explication ; null sinon) : le moteur y lit ce qui borne le poids portable (décision R165 (6),
      // Potentiel Illimité : « Impossible de porter des armures lourdes ou boucliers lourds même si la classe vous le permet »), dans le texte
      explication: m.explication ?? null,
    }));

  const dieux = lignes(db, 'SELECT id, nom FROM dieu ORDER BY ordre_choix IS NULL, ordre_choix, nom');
  // Métiers : bonus par rang, chacun vers une compétence (son Acquis) ou l'initiative, un rang à plusieurs compétences étant un choix (décision R33) ;
  // artisanat et ses deux caractéristiques (R34) ; objets de départ par rang, les options d'un choix ensemble (R35)
  const bonusDesMetiers = parCle(lignes(db, 'SELECT metier_id, rang, texte, valeur, unite, competence_id, attribut FROM metier_bonus ORDER BY metier_id, rang, option'), 'metier_id');
  const objetsDesMetiers = parCle(lignes(db, 'SELECT metier_id, rang, texte FROM metier_objet_depart ORDER BY metier_id, rang, option'), 'metier_id');
  const parRang = (rows, creer, ajouter) => {
    const rangs = [];
    for (const r of rows ?? []) ajouter((rangs[r.rang - 1] ??= creer(r)), r);
    return rangs.filter(Boolean);
  };
  const metiers = lignes(db, 'SELECT id, nom, artisanat_texte, test_carac_1_id, test_carac_2_id FROM metier ORDER BY nom COLLATE NOCASE')
    .map((m) => ({
      id: m.id, nom: m.nom,
      bonus: parRang(bonusDesMetiers.get(m.id), (r) => ({ rang: r.rang, texte: r.texte, valeur: r.valeur, unite: r.unite, options: [] }),
        (rang, r) => rang.options.push({ competence_id: r.competence_id, attribut: r.attribut })),
      artisanat: m.artisanat_texte ? { texte: m.artisanat_texte, caracteristiques: m.test_carac_1_id ? [m.test_carac_1_id, m.test_carac_2_id] : [] } : null,
      objets: parRang(objetsDesMetiers.get(m.id), (r) => ({ rang: r.rang, options: [] }), (rang, r) => rang.options.push(r.texte)),
    }));

  // Classes : apport de départ, catégorie et couleur de /classes/ ; classe magique par sa catégorie ou l'Archimage (R6), spécialité magique quand
  // son don de niveau 10 dit « considérer comme classe magique » (R7) ; dons à choix rangés en groupes (v_capacite_exclusive, comme la page de la classe) ;
  // magie innée qui réserve et impose la classe (classe.magie_innee_id : l'Archimage et le Potentiel Illimité, décision R23), ou qui la ferme
  // (classe.magie_innee_exclue_id : le Mage Bleu et le Potentiel Illimité, décision R25) ; maîtrises d'armes de la classe (classe_maitrise_arme, avec
  // leur source et leurs parts : décisions R148 à R151) ; ses dons, pour le rappel des dons débloqués (demande du propriétaire), avec les parts de
  // maîtrise d'arme que donne chacun (`maitrise`, maitrise_arme_part : ses points, R32, R148) et ses NM de sorts gagnés (`nm_gagnes`, R154).
  // bonus de dégâts d'arme qu'écrit un don passif (lib/degats-texte.mjs : pastille des dégâts des armes, demande du propriétaire) ; rien sinon
  // et ses bonus de sorts (coût, dégâts, soin, portée : lib/sort-bonus-texte.mjs, décision R102)
  const degatsEcrits = (d) => {
    const b = d.type === 'passif' ? bonusDeDegatsEcrit(d.effet) : null;
    const sorts = d.type === 'passif' ? bonusDeSortsEcrits(d.effet) : [];
    return { ...(b ? { degats: b } : {}), ...(sorts.length ? { sorts } : {}) };
  };
  // Familles d'armes : dé, paliers selon la Force (Pugilat), si une maîtrise peut s'y mettre (décision R45), contact ou distance (arme_famille.categorie,
  // décision R127 : « Arc / arbalète / arme de jet ou Bombe sont bien les 4 types d'armes à distance »), et les compétences que donnent ses armes (R48 :
  // arme.competence_brut, lib/arme-champs.mjs#competencesDArme), dans l'ordre de la table competence : la compétence du bonus de « l'arme choisie »
  // (décision R119 : « C'est cette arme qui détermine le bonus. En cas d'arme qui peu tout aussi bien avoir des armes lourdes et légère, ça reste au
  // choix » ; Arc : Arc ou Arme légère, R126)
  const rangDeCompetence = new Map(competences.map((k, i) => [k.id, i]));
  const ecrituresDesFamilles = parCle(lignes(db, 'SELECT famille_id, competence_brut FROM arme ORDER BY famille_id, ordre'), 'famille_id', (a) => a.competence_brut);
  // `nom_lecture` : le nom figé sous lequel la famille se lit aussi (décision R159, migration 0077) — par famillesAuChoix (les « sauf », R138) et par
  // l'import du classeur (une fiche exportée avant un renommage écrit l'ancien nom) ; `type_elementaire_id` : le type de l'arme élémentaire que devient
  // une arme de la famille (arme_famille.type_elementaire_id, décision R167 : « la transformation suit la famille sous laquelle l'arme est listée » ; null
  // pour ARME DE MONSTRES et pour une famille créée sur le site de dev)
  const famillesDArmes = lignes(db, 'SELECT id, nom, nom_lecture, de_brut, note_brut, maitrisable, categorie, type_elementaire_id FROM arme_famille ORDER BY ordre')
    .map((f) => ({
      id: f.id, nom: f.nom, nom_lecture: f.nom_lecture, de: f.de_brut, de_selon_force: desSelonLaForce(f.note_brut), maitrisable: f.maitrisable === 1, categorie: f.categorie,
      type_elementaire_id: f.type_elementaire_id,
      competences: [...new Set((ecrituresDesFamilles.get(f.id) ?? []).flatMap((e) => competencesDArme(e).map((k) => k.id)))]
        .sort((a, b) => rangDeCompetence.get(a) - rangDeCompetence.get(b)),
    }));
  // Les familles d'une maîtrise au choix d'une classe (décisions R119, R127, R138) : lib/maitrise-arme.mjs#famillesAuChoix, null quand son « sauf » ne se
  // lit pas ; FAMILLES_DES_SAUF y désigne des familles maîtrisables de la base, sinon le build s'arrête.
  for (const id of Object.values(FAMILLES_DES_SAUF)) {
    if (!famillesDArmes.some((f) => f.id === id && f.maitrisable)) throw new Error(`FAMILLES_DES_SAUF : la famille « ${id} » n'est pas une famille maîtrisable de la base`);
  }
  const amMagique = db.prepare("SELECT am_base FROM categorie_classe WHERE id = 'classe-magique'").get()?.am_base;
  if (!amMagique) throw new Error('categorie_classe « classe-magique » : am_base absent');
  const alternatives = parCle(lignes(db, 'SELECT capacite_id, autre_id FROM v_capacite_exclusive'), 'capacite_id', (r) => r.autre_id);
  const capacites = parCle(lignes(db, 'SELECT id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, type, type_brut, effet, remarque FROM capacite'), 'classe_id');
  const specialites = parCle(lignes(db, 'SELECT id, classe_id, rang, nom, description FROM specialite ORDER BY classe_id, rang'), 'classe_id');
  // le texte de présentation d'une classe ou d'une spécialité (infobulle d'une tuile de choix), tel qu'en base, sans les balises du glossaire comme tout
  // texte de ces règles (chargerReglesDeFiche : le texte affiché) ; null sans texte
  const texte = (v) => (typeof v === 'string' && v !== '' ? v : null);
  // Les sources de maîtrise d'arme (décisions R148 à R151), lues dans leurs tables de règles (maitrise_arme_part, maitrise_arme_part_famille : écrites par
  // lib/maitrise-arme.mjs, rejouées par test/maitrise-arme-sources.test.mjs ; rien n'est relu des textes ici) : les parts de chaque source, dans l'ordre
  // de son texte, { rang, genre ('imposee' | 'choix' | 'suit'), points (signés : le −1 de l'Épéiste), famille (la famille imposée, sinon null), options
  // (les familles d'une part à choisir, dans l'ordre d'arme_famille ; [] sinon), limite (points de la part au plus sur une même famille, R150 ; null) }.
  const optionsDesParts = parCle(lignes(db, `SELECT o.source_id, o.rang, o.arme_famille_id FROM maitrise_arme_part_famille o JOIN arme_famille f ON f.id = o.arme_famille_id
                                             ORDER BY o.source_id, o.rang, f.ordre`), 'source_id');
  const partsDesSources = parCle(lignes(db, 'SELECT source_id, rang, capacite_id, genre, points, arme_famille_id, limite_famille FROM maitrise_arme_part ORDER BY source_id, rang'),
    'source_id', (p) => ({
      rang: p.rang, genre: p.genre, points: p.points, famille: p.arme_famille_id,
      options: (optionsDesParts.get(p.source_id) ?? []).filter((o) => o.rang === p.rang).map((o) => o.arme_famille_id), limite: p.limite_famille,
    }));
  // une incohérence des tables arrête le build (comme FAMILLES_DES_SAUF) : une famille imposée ou proposée qui n'est pas maîtrisable (jamais ARME DE
  // MONSTRES, R45) ; une source qui a plus d'une part à choisir (la fiche range ses choix par source et numéro du point : le point 1 compterait deux
  // fois ; le site de dev la refuse à la saisie, serveur/edition-maitrises.mjs#illisiblesDuDon) ; un don qui suit la maîtrise au choix de sa classe
  // (R151) quand sa classe n'a pas exactement une ligne `au_choix`
  const maitrisables = new Set(famillesDArmes.filter((f) => f.maitrisable).map((f) => f.id));
  for (const [source, parts] of partsDesSources) {
    const aChoisir = parts.filter((p) => p.genre === 'choix').map((p) => p.rang);
    if (aChoisir.length > 1) throw new Error(`maitrise_arme_part : ${source} a ${aChoisir.length} parts à choisir (${aChoisir.join(', ')}) : une seule par source, la fiche range ses choix par source et numéro du point`);
    for (const p of parts) {
      const nonMaitrisable = [p.famille, ...p.options].find((id) => id !== null && !maitrisables.has(id));
      if (nonMaitrisable) throw new Error(`maitrise_arme_part : ${source}, part ${p.rang} : la famille « ${nonMaitrisable} » n'est pas maîtrisable (R45)`);
    }
  }
  const lignesAuChoix = new Map(lignes(db, "SELECT classe_id, count(*) AS n FROM classe_maitrise_arme WHERE forme = 'au_choix' GROUP BY classe_id").map((r) => [r.classe_id, r.n]));
  for (const p of lignes(db, "SELECT m.source_id, k.classe_id FROM maitrise_arme_part m JOIN capacite k ON k.id = m.capacite_id WHERE m.genre = 'suit'")) {
    const n = lignesAuChoix.get(p.classe_id) ?? 0;
    if (n !== 1) throw new Error(`maitrise_arme_part : ${p.source_id} suit la maîtrise au choix de ${p.classe_id}, qui en a ${n} (une seule attendue, R151)`);
  }
  const nmGagnes = new Map(lignes(db, 'SELECT capacite_id, nm FROM capacite_nm_gagne').map((r) => [r.capacite_id, r.nm]));
  // une maîtrise au choix porte ses familles (`au_choix` : familles, null si son « sauf » ne se lit pas ; décision R119) ; chaque ligne, sa source
  // (`source` : lib/maitrise-arme.mjs#idDeSourceDeClasse, l'identifiant que la fiche enregistre dans personnage_maitrise_choix) et ses parts
  const maitrises = parCle(lignes(db, 'SELECT classe_id, rang, brut, nombre, forme, categorie, sauf_cle FROM classe_maitrise_arme WHERE nombre IS NOT NULL ORDER BY classe_id, rang'), 'classe_id',
    (r) => ({
      brut: r.brut, nombre: r.nombre, ...(r.forme === 'au_choix' ? { au_choix: { familles: famillesAuChoix(r, famillesDArmes) } } : {}),
      source: idDeSourceDeClasse(r.classe_id, r.rang), parts: partsDesSources.get(idDeSourceDeClasse(r.classe_id, r.rang)) ?? [],
    }));
  // « Maîtrise Armures » de la classe (classe_maitrise_armure, objet 'armure' : Classe Maverick V7 › A11:F13), lue nulle part avant la décision R165 (6) :
  // ses lignes d'armure telles qu'écrites, { rang, brut, poids_min, poids_max (« Légère », « Intermédiaire », « Lourde »), valeur_max (la valeur de
  // poids_max, 0 = Vêtement … 3 = Lourd : lib/fiche-format.mjs#valeurDuPoids) } ; [] pour une classe dont la case ne nomme aucune armure (Mage, Mage Vert,
  // Ocultomancien, Flagelleur, Archimage). Le poids portable (le maximum des classes, puis les dons, la race, le Potentiel Illimité) est au moteur
  const maitrisesArmures = parCle(lignes(db, "SELECT classe_id, rang, brut, poids_min, poids_max FROM classe_maitrise_armure WHERE objet = 'armure' ORDER BY classe_id, rang"),
    'classe_id', (r) => ({ rang: r.rang, brut: r.brut, poids_min: r.poids_min, poids_max: r.poids_max, valeur_max: valeurDuPoids(r.poids_max) }));
  const classes = lignes(db, `
    SELECT c.id, c.nom, c.sante_depart, c.chakra_depart, c.barriere_depart, c.categorie_id, c.magie_innee_id, c.magie_innee_exclue_id, k.libelle AS categorie, k.am_base,
           c.description
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
        return {
          id: s.id, nom: s.nom, rang: s.rang, magique: ditClasseMagique(cartouche?.effet),
          description: texte(s.description),
        };
      });
      return {
        // sa couleur : la classe de sa catégorie de /classes/ (lib/palette-css.mjs, famille `classe`, celle des pages de classe), jamais un hex
        id: c.id, nom: c.nom, categorie: c.categorie, classe: classeDUneClasse(entree),
        // son texte de présentation, tel qu'en base (sans les balises du glossaire ; null sans texte) : l'infobulle de sa tuile
        description: texte(c.description),
        // colonne de /classes/ (Parleur sous « Spéciales ») et son rang de gauche à droite
        groupe: (({ key, label }) => ({ key, label, ordre: CLASS_GROUPS.findIndex((g) => g.key === key) }))(classCategory(entree) ?? { key: 'speciales', label: 'Spéciales' }),
        magique: (c.am_base ?? 0) > 0 || c.id === 'classes/archimage',
        sante: c.sante_depart, chakra: c.chakra_depart, barriere: c.barriere_depart,
        magie_innee_id: c.magie_innee_id, magie_innee_exclue_id: c.magie_innee_exclue_id,
        specialites: specialitesDeLaClasse,
        choix: [null, ...specialitesDeLaClasse.map((s) => s.id)].flatMap(parSpecialite).sort((a, b) => a.niveau - b.niveau),
        maitrises: maitrises.get(c.id) ?? [],
        maitrise_armures: maitrisesArmures.get(c.id) ?? [],
        dons: [...dons].sort((a, b) => a.niveau - b.niveau || a.ligne - b.ligne || a.rang - b.rang).map((d) => ({
          id: d.id, nom: d.nom, nature: d.nature, niveau: d.niveau, specialite_id: d.specialite_id, type: d.type, effet: d.effet,
          // ce que la cellule de type écrit entre parenthèses (« 2 fois/combat », « 3 tours de recharge »), tel quel, comme la page de la classe
          precision: typeDeDon(d.type_brut).precision,
          ...resistancesEcrites(resistancesDuTexte(d.effet, d.remarque)), ...degatsEcrits(d),
          // ses parts de maîtrise d'arme (maitrise_arme_part : décisions R148, R150, R151) et ses NM de sorts gagnés (capacite_nm_gagne : R154), quand il en a
          ...(partsDesSources.has(d.id) ? { maitrise: { parts: partsDesSources.get(d.id) } } : {}),
          ...(nmGagnes.has(d.id) ? { nm_gagnes: nmGagnes.get(d.id) } : {}),
          // exemplaires du même objet sur un emplacement de ceinture que le don permet (« Permet d'avoir 4 fois… », Mercenaire « Organisé » ; décision R89)
          ...(exemplairesDeCeintureEcrits(d.effet) ? { exemplaires_ceinture: exemplairesDeCeintureEcrits(d.effet) } : {}),
          ...(sacSansForceEcrit(d.effet) ? { sac_sans_force: true } : {}),
          // ses bonus d'acquis (« +7% Magie, +7% Médecine », « +7% Arme légères OU lourdes » : un choix ; décision R104)
          ...(() => { const acquis = horsDuTableau(lireAcquis(d.effet)); return acquis.length ? { acquis } : {}; })(),
          // le sort qu'il permet de préparer (« Préparation », « Chargement » : décision R115, lib/sort-bonus-texte.mjs#preparationEcrite)
          ...(() => { const preparation = preparationEcrite(d.effet); return preparation ? { preparation } : {}; })(),
        })),
      };
    });

  // Sorts : coût, portée, zone, dégâts/soins/barrière, effets et remarque tels qu'écrits, avec leurs expressions de NM (sort_bonus_maitrise) : la page les
  // montre à la valeur du NM du sort (lib/sort-maitrise.mjs#valeurAuNm, demande du propriétaire). Le mode (IC, imparable, inesquivable : sort_mode, valeur
  // de base) et l'expression de NM du type (« IC pour 3 NM ») donnent l'indication IC au NM du sort (lib/sort-maitrise.mjs#modesAuNm). Le type lui-même
  // (sort.type_brut, « Amplification (IC pour 3 NM) ») tel qu'écrit, pour la colonne « Type » du tableau des sorts de la fiche en tableur (au NM du sort).
  const champsAuNm = new Set(['type', 'cout', 'portee', 'zone', 'dsb', 'effets']);
  const modesDesSorts = parCle(lignes(db, 'SELECT sort_id, mode, libelle, fois FROM sort_mode ORDER BY sort_id, rang'), 'sort_id', (m) => ({ mode: m.mode, libelle: m.libelle, fois: m.fois }));
  const bonusDesSorts = parCle(lignes(db, 'SELECT sort_id, champ, nature, texte_brut, increment_brut, pas_nm, seuil_nm FROM sort_bonus_maitrise ORDER BY sort_id, champ, rang'),
    'sort_id', (b) => ({ champ: b.champ, nature: b.nature, texteBrut: b.texte_brut, incrementBrut: b.increment_brut, pasNm: b.pas_nm, seuilNm: b.seuil_nm }));
  const ciblesDesAccessoires = parCle(lignes(db, 'SELECT effet_id, cible, cible_id, valeur, choix FROM accessoire_effet_cible ORDER BY effet_id, rang'), 'effet_id',
    (c) => ({ cible: c.cible, cible_id: c.cible_id, valeur: c.valeur, choix: c.choix === 1 }));
  const attaques = new Set(lignes(db, "SELECT DISTINCT sort_id FROM sort_type WHERE type = 'attaque'").map((t) => t.sort_id));
  // ses types (sort_type : attaque, soin, amplification, protection…), pour les bonus du moment qui n'en visent que certains (décisions R101, R102)
  const typesDesSorts = parCle(lignes(db, 'SELECT sort_id, type FROM sort_type ORDER BY sort_id, type'), 'sort_id', (t) => t.type);
  // ses étiquettes (sort_mot_cle, migration 0067 : décision R114, « Sort grenade » ; migration 0079 : décision R164, « Sort fer »), dans l'ordre de leur libellé normalisé (`libelle_cle`) : les bonus écrits pour « les sorts
  // "grenades" » visent les sorts qui la portent, jamais un sort par son nom (lib/sort-bonus-texte.mjs#ETIQUETTES_DES_SORTS)
  const etiquettesDesSorts = parCle(lignes(db, `SELECT e.sort_id, e.mot_cle_id FROM sort_mot_cle e JOIN mot_cle m ON m.id = e.mot_cle_id
    ORDER BY e.sort_id, m.libelle_cle, e.mot_cle_id`), 'sort_id', (e) => e.mot_cle_id);
  const sorts = lignes(db, 'SELECT id, magie_id, nom, niveau, type_brut, cout_brut, cout_secondaire, portee_brut, zone_brut, dsb_brut, effets, remarque FROM sort ORDER BY magie_id, niveau, ordre')
    .map((s) => ({
      id: s.id, magie_id: s.magie_id, nom: s.nom, niveau: s.niveau, type: s.type_brut, cout: s.cout_brut, portee: s.portee_brut, zone: s.zone_brut, dsb: s.dsb_brut, effets: s.effets, remarque: s.remarque,
      // le second coût (âmes, Sang… : décision R105) ou sa précision (« Par tour » : R106), sans expression de NM ; absent quand le sort n'en a pas
      ...(s.cout_secondaire ? { cout_secondaire: s.cout_secondaire } : {}),
      modes: modesDesSorts.get(s.id) ?? [],
      bonus: (bonusDesSorts.get(s.id) ?? []).filter((b) => champsAuNm.has(b.champ)),
      // un sort d'attaque (sort_type) reçoit les « Dégâts magie +N » d'un accessoire (décision R54)
      ...(attaques.has(s.id) ? { attaque: true } : {}),
      types: typesDesSorts.get(s.id) ?? [],
      ...(etiquettesDesSorts.has(s.id) ? { mots_cles: etiquettesDesSorts.get(s.id) } : {}),
      // un sort « Fer » (décision R167 : « la fiche signale seulement quand le sort et l'arme élémentaire ne sont pas du même élément ») : reconnu à son
      // étiquette « Sort fer » (sort_mot_cle 'sort-fer', migration 0079, décision R164 ; comme « Sort grenade », R114), jamais à son nom ; son élément est sa
      // magie (`magie_id`)
      ...(etiquettesDesSorts.get(s.id)?.includes('sort-fer') ? { fer: true } : {}),
    }));

  // Postures (sélecteur de la page, demande du propriétaire) : les six, dans l'ordre de la page « Postures », leur couleur et leurs effets du tableau de la fiche.
  // Avantages et inconvénients (décision R47, migration 0031) : `inconvenients` = les rangs des lignes du tableau de la fiche qui sont des inconvénients
  // (posture_effet.inconvenient), les autres sont des avantages ; `ordre_postures` : l'ordre des cases sur la fiche (demande du propriétaire : Offensif,
  // Neutre, Défensif, puis Focus, Vigilance, Symbiose).
  const ordre_postures = ['offensif', 'neutre', 'defensif', 'focus', 'vigilance', 'symbiose'].map((slug) => `guide/postures#posture:${slug}`);
  const lignesDePosture = lignes(db, "SELECT posture_id, rang, texte, inconvenient FROM posture_effet WHERE version = 'fiche' ORDER BY posture_id, rang");
  const effetsDePosture = parCle(lignesDePosture, 'posture_id', (r) => r.texte);
  const inconvenientsDePosture = parCle(lignesDePosture.filter((r) => r.inconvenient === 1), 'posture_id', (r) => r.rang);
  const postures = lignes(db, 'SELECT id, nom FROM posture ORDER BY ordre')
    .map((p) => ({
      // sa couleur : la classe de la posture (lib/palette-css.mjs ; famille d'une zone, émise par pages/fiche/index.astro), jamais un hex
      id: p.id, nom: p.nom, classe: classeDePosture(p.id), effets: effetsDePosture.get(p.id) ?? [],
      inconvenients: inconvenientsDePosture.get(p.id) ?? [],
      // ce que chaque ligne change aux valeurs de la fiche (décision R100 : lib/posture-texte.mjs), au même rang que `effets` ; null = affichée seulement
      chiffres: (effetsDePosture.get(p.id) ?? []).map(effetDePosture),
    }));

  // Mode Hyper et Mode Hyper 100 % (demande du propriétaire : leurs cases à côté des postures, quand ils sont débloqués) : les niveaux et le Mode Hyper 100 %
  // tels qu'écrits par la page « Liste des effets mode hyper » (« se débloque au niveau 2 », « n'est disponible qu'au niveau 10 ») ; les effets de base de la
  // fiche (mode_hyper_effet version 'fiche', valeurs retenues par la décision R5) ; l'effet de chaque magie (onglet de la magie, comme sa page) et de chaque race
  // (onglet de la race, décision R13).
  const pageHyper = sansBalises(db, db.prepare("SELECT corps_md FROM page WHERE id = 'guide/liste-des-effets-mode-hyper'").get()?.corps_md ?? '');
  const niveauHyper = /se d[ée]bloque au niveau (\d+)/.exec(pageHyper)?.[1];
  const sectionCent = /## Mode Hyper 100 ?%\s*\n([\s\S]*?)(?=\n## |$)/.exec(pageHyper)?.[1] ?? '';
  const niveauCent = /disponible qu['’]au niveau (\d+)/.exec(sectionCent)?.[1];
  if (!niveauHyper || !niveauCent) throw new Error('page « Liste des effets mode hyper » : niveaux du Mode Hyper et du Mode Hyper 100 % introuvables');
  const mode_hyper = {
    niveau: Number(niveauHyper),
    effets: lignes(db, "SELECT effet FROM mode_hyper_effet WHERE version = 'fiche' AND portee = 'general' ORDER BY rang").map((r) => r.effet),
    magies: Object.fromEntries([...parCle(lignes(db, "SELECT magie_id, variante, effet FROM mode_hyper_effet WHERE version = 'onglet_magie' AND portee = 'magie'"), 'magie_id')]
      .map(([id, rows]) => [id, Object.fromEntries(rows.map((r) => [r.variante, r.effet]))])),
    races: Object.fromEntries(lignes(db, "SELECT race_id, nom, effet FROM mode_hyper_effet WHERE version = 'onglet_race'").map((r) => [r.race_id, { nom: r.nom, effet: r.effet }])),
    // la couleur des deux cases : la classe du mode (lib/palette-css.mjs, famille `mode`), jamais un hex
    classe: classeDuModeHyper('hyper'),
    cent: {
      classe: classeDuModeHyper('cent'),
      niveau: Number(niveauCent),
      effets: [...sectionCent.matchAll(/^- (.+)$/gm)].map((m) => m[1].trim()),
      suite: /^En revanche, (.+)$/m.exec(sectionCent)?.[1]?.trim() ?? null,
    },
  };

  // Attaque à deux armes, une dans chaque main (décision R46 : « −20 % Attaque main directrice, −40 % Attaque main secondaire. Ce malus est réduit de moitié
  // avec des dagues ou en étant classe bimane. Les deux se cumulent » ; l'arme 1 est l'arme principale ; seulement avec deux armes de mêlée). Aucune table de
  // la base ne porte ces valeurs : elles sont écrites ici, d'après la décision. Armes de mêlée : toutes, sauf les types des armes des quatre classes
  // « Physiques Distance » (arc, arbalète, arme de jet, bombes), lecture validée avec la maquette (R46).
  const ambidextrie = { malus_directrice: 20, malus_secondaire: 40, diviseur: 2, type_dague: 'dague', classe: 'classes/bimane', types_a_distance: ['arc', 'arbalete', 'arme-de-jet', 'bombe'] };

  // Équipement : les catalogues de la base, avec ce qu'il faut pour choisir (nom, famille, cible d'une amélioration, AP/AM indiqués).
  const nomDeRessource = (id) => db.prepare('SELECT nom FROM ressource WHERE id = ?').get(id)?.nom ?? id;
  const equipement = {
    // dé de la famille, et ses paliers selon la Force quand sa note les écrit (Pugilat : « D6 1-2 Force, D8 3-4 Force, D10 5 Force ») ; `maitrisable` :
    // la famille a sa ligne dans les maîtrises (pas ARME DE MONSTRES, décision R45), toutes nomment les armes de l'équipement ; `categorie` (R127) et
    // `competences` (R48, R119) : plus haut, avant les classes
    familles_armes: famillesDArmes,
    // le dé de l'arme (« D8 au lieu du D10 » de son effet, sinon celui de son type ; NULL pour le Pugilat : selon la Force), son bonus de dégâts (« +N dégâts »)
    // et ses types de dégâts (arme_degats), pour la pastille des dégâts ; son type (arme_type) pour l'attaque à deux armes. Pour la fiche en tableur : son
    // effet tel qu'écrit dans l'onglet (arme.effet, null pour une arme de monstre) et sa portée, celle de la colonne de la page « Armes » (décision R50 :
    // « la portée écrite, 1 par défaut », lib/arme-champs.mjs#porteeDeLArme, d'après arme.portee_min / portee_max), écrite « N » ou « N - M ».
    // `solidite` : les crans de l'arme nue, ceux de la colonne « Solidité » de la page Armes (lib/arme-champs.mjs#durabiliteDeLArme : « 1 seul cran » de
    // son effet, sinon la base de l'onglet, 2, corrigée de « ±N cran », au moins 1) ; null pour une arme de monstre (famille sans maîtrise, décision R45 :
    // la page Armes ne l'affiche pas et ne lui écrit aucune durabilité). Pas `durabilite` : c'est la solidité du moment d'une arme de la fiche (R74)
    armes: (() => {
      const types = parCle(lignes(db, 'SELECT arme_id, type_degats FROM arme_degats ORDER BY arme_id, type_degats'), 'arme_id', (r) => r.type_degats);
      const portee = (min, max) => porteeDeLArme({ portee_min: min, portee_max: max }).replace(/^(\d+)-(\d+)$/, '$1 - $2');
      return lignes(db, `SELECT a.id, a.nom, a.famille_id, a.type_id, a.mains, a.de, a.bonus_degats, a.effet, a.portee_min, a.portee_max, a.solidite_fixee,
                                a.solidite_delta, f.maitrisable
                         FROM arme a JOIN arme_famille f ON f.id = a.famille_id ORDER BY a.famille_id, a.ordre`)
        .map(({ portee_min, portee_max, solidite_fixee, solidite_delta, maitrisable, ...a }) => ({
          ...a, portee: portee(portee_min, portee_max), types_degats: types.get(a.id) ?? [],
          solidite: maitrisable === 1 ? durabiliteDeLArme({ solidite_fixee, solidite_delta }, soliditeDeBase.valeur) : null,
        }));
    })(),
    // « tous les bonus se cumulent une fois l'arme forgée » (page « Armes ») : celui de la composition et de l'amélioration ; de même les crans de solidité
    // de la composition et de l'amélioration (`cran_solidite`, `bonus_cran` : décisions R51, R74)
    materiaux_armes: lignes(db, 'SELECT ressource_id, bonus_degats, cran_solidite FROM materiau_arme ORDER BY ordre')
      .map((m) => ({ id: m.ressource_id, nom: nomDeRessource(m.ressource_id), bonus_degats: m.bonus_degats, cran_solidite: m.cran_solidite })),
    // le matériau d'une arme choisie, par défaut (décision R49 : « son matériau (par défaut le fer) ») : le fer du tableau des matériaux d'arme
    materiau_arme_defaut: db.prepare("SELECT m.ressource_id AS id FROM materiau_arme m JOIN ressource r ON r.id = m.ressource_id WHERE r.nom_cle = 'fer'").get()?.id ?? null,
    // `bonus_ap`, `bonus_am` : l'AP et l'AM d'une amélioration d'armure, d'armure élémentaire ou de bouclier, ceux du niveau choisi (décisions R76, R77)
    // et son coût, tel qu'écrit (`cout`) et en gemmes (cout_gemmes, cout_gemmes_qualite : « commune », « raffinee », « parfaite ») ou en pièces élémentaires
    // (cout_pieces_elementaires) : le tableau d'amélioration des armures élémentaires (décision R165 (2) ; les gemmes sont celles de la magie, table gemme).
    // Les armes : UN tableau (cible 'arme') pour l'arme du catalogue et l'arme élémentaire (décision R167, migration 0081 : « le niveau d'amélioration ne sert
    // que pour les calculs de solidité et de dégâts qui sont les mêmes pour l'amélioration matérielle de l'arme de base et pour l'arme élémentaire ») : son
    // `bonus_degats` et son `bonus_cran` au niveau choisi ; son coût (matériel ou élémentaire) ne sert pas à la fiche
    ameliorations: lignes(db, `SELECT id, cible, niveau, cout_brut, cout_gemmes, cout_gemmes_qualite, cout_pieces_elementaires, effet_brut, bonus_degats, bonus_ap,
                                      bonus_am, bonus_cran FROM amelioration_equipement ORDER BY cible, niveau`)
      .map((a) => ({
        id: a.id, cible: a.cible, niveau: a.niveau, effet: a.effet_brut, bonus_degats: a.bonus_degats, bonus_ap: a.bonus_ap, bonus_am: a.bonus_am, bonus_cran: a.bonus_cran,
        cout: a.cout_brut, cout_gemmes: a.cout_gemmes, cout_gemmes_qualite: a.cout_gemmes_qualite, cout_pieces_elementaires: a.cout_pieces_elementaires,
      })),
    // Armes élémentaires (décision R167 : une pièce élémentaire TRANSFORME l'arme, qui devient l'arme élémentaire de sa famille et de la magie et perd tout
    // ce qu'elle avait ; la fiche propose « les armes élémentaires de ses magies (innée et acquise, sans le Potentiel Illimité) », sur le fond de la magie) :
    // dans l'ordre de l'onglet Pièces élémentaires (arme_elementaire.ordre), son type (`type_id`, regles.types_elementaires : dé, portée, compétences), sa
    // magie et la classe de la palette de celle-ci (`classe`, comme regles.magies[].classe, jamais un hex), son bonus de dégâts (« +8 Dégâts » : dégâts = dé
    // du type + bonus_degats + l'effet de la ligne d'amélioration, R167) et sa capacité telle qu'écrite (nom, mode, texte). Sa solidité :
    // constantes['piece_elementaire.solidite_base'] + bonus_cran de la ligne d'amélioration fondue des armes (R167 ; les crans des armures ne s'en mêlent pas).
    // Les clés de la liste d'avant (id, nom, magie_id, bonus_degats) restent.
    armes_elementaires: lignes(db, `SELECT e.id, e.nom, e.type_id, e.magie_id, m.nom AS magie, e.bonus_degats, e.capacite_nom, e.capacite_mode, e.capacite_texte
                                    FROM arme_elementaire e JOIN magie m ON m.id = e.magie_id ORDER BY e.ordre`)
      .map(({ magie, ...e }) => ({ id: e.id, nom: e.nom, type_id: e.type_id, magie_id: e.magie_id, classe: classeDeMagie(magie), bonus_degats: e.bonus_degats,
        capacite_nom: e.capacite_nom, capacite_mode: e.capacite_mode, capacite_texte: e.capacite_texte })),
    // Types des armes élémentaires (arme_elementaire_type, décision R167 : « Dé et portée : ceux de son type », arme_type), dans l'ordre des en-têtes de
    // l'onglet : le dé du type (`de`, null pour le Pugilat) et ses paliers selon la Force (`de_selon_force`, lib/maitrise-arme.mjs#desSelonLaForce sur
    // arme_type.de_regle, comme regles.familles_armes[].de_selon_force) ; la portée du type (« N » ou « N - M », comme regles.armes[].portee) ; `ignore_ap`
    // (« ignore 4 AP » de l'Arbalète, null sinon) ; `exemplaire_unique` (Arme de jet, Bombe : « en un seul exemplaire, sans coût à l'unité ») et sa `mention`
    // telle qu'écrite ; `competences` : celles au choix du porteur (« l'arme s'adapte au porteur », arme_elementaire_type_competence), dans l'ordre de la
    // table competence ; `types_degats` : ses types physiques (arme_elementaire_type_degats, décision R167 : « Les deux », le type physique de sa famille et
    // celui de sa magie, `magie_id` de l'arme ; le plus fréquent de la famille), dans l'ordre alphabétique comme regles.armes[].types_degats ;
    // `type_degats_au_choix` : vrai quand le porteur en choisit un seul (la Bombe, personnage_arme.type_degats_choisi), faux quand tous s'appliquent
    types_elementaires: (() => {
      const portee = (min, max) => porteeDeLArme({ portee_min: min, portee_max: max }).replace(/^(\d+)-(\d+)$/, '$1 - $2');
      const competencesDuType = parCle(lignes(db, `SELECT c.type_id, c.competence_id FROM arme_elementaire_type_competence c JOIN competence k ON k.id = c.competence_id
                                                   ORDER BY c.type_id, k.ordre`), 'type_id', (r) => r.competence_id);
      const degatsDuType = parCle(lignes(db, 'SELECT type_id, type_degats FROM arme_elementaire_type_degats ORDER BY type_id, type_degats'), 'type_id', (r) => r.type_degats);
      return lignes(db, `SELECT e.type_id, t.nom, t.de, t.de_regle, t.portee_min, t.portee_max, e.ignore_ap, e.exemplaire_unique, e.mention, e.type_degats_au_choix
                         FROM arme_elementaire_type e JOIN arme_type t ON t.id = e.type_id ORDER BY e.ordre`)
        .map((t) => ({
          id: t.type_id, nom: t.nom, de: t.de, de_selon_force: desSelonLaForce(t.de_regle), portee: portee(t.portee_min, t.portee_max), ignore_ap: t.ignore_ap,
          exemplaire_unique: t.exemplaire_unique === 1, mention: t.mention, competences: competencesDuType.get(t.type_id) ?? [],
          types_degats: degatsDuType.get(t.type_id) ?? [], type_degats_au_choix: t.type_degats_au_choix === 1,
        }));
    })(),
    // les parties de l'armure portée (décision R95) : chacune a sa solidité du moment ; « armure-complete », celle d'une armure à solidité unifiée
    emplacements_armure: lignes(db, "SELECT id, nom FROM armure_emplacement WHERE id <> 'bouclier' ORDER BY ordre"),
    // `solidite` et `solidite_uni` : le maximum de chaque partie et l'armure à solidité unifiée (« Solidité uni ») (décision R95 : lib/fiche-moteur.mjs#partiesDeLArmure)
    // `degats` : sa résistance ou sa faiblesse aux dégâts d'estoc, de taille ou de frappe (armure_degats, « x2 » : multiplicateur 2), que le calcul des
    // dégâts reçus applique aux AP (décision R98 : lib/fiche-moteur.mjs#degatsRecus)
    armures: (() => {
      const degats = parCle(lignes(db, 'SELECT armure_id, sens, type_degats, multiplicateur FROM armure_degats ORDER BY armure_id, sens, type_degats'), 'armure_id',
        (r) => ({ sens: r.sens, type: r.type_degats, multiplicateur: r.multiplicateur ?? 1 }));
      // les bonus d'acquis qu'écrit son effet (« +25% Stabilité », « +5% Magie ou Concentration » : « Les bonus de race/classe/don/équipement vont dans la
      // case Acquis », guide « Fiche de personnage : Compétences » ; décision R104)
      // (décisions R157, R158 : « Cassée, l'armure ne donne plus aucun de ses effets, bonus comme malus, jusqu'à sa réparation » — l'initiative, la vitesse et
      // les croix qu'écrit l'effet, « +3 INI », « -5 INI, 1 Croix en AGI », ne sont pas lus ; un effet qu'on lira un jour devra cesser, comme l'acquis, quand
      // l'armure à cran uni est à 0 : lib/fiche-moteur.mjs#armureCassee. Le malus de la catégorie Lourd, lui, reste : « Non, elle pèse toujours », R158)
      return lignes(db, 'SELECT id, nom, type, ap, am, solidite, solidite_uni, effet FROM armure ORDER BY ordre').map(({ effet, ...a }) => {
        const acquis = horsDuTableau(lireAcquis(effet));
        return { ...a, degats: degats.get(a.id) ?? [], ...(acquis.length ? { acquis } : {}) };
      });
    })(),
    // la magie de chaque armure élémentaire (armure_elementaire.magie_id) : la fiche auto écrit l'élément d'une armure par le nom de sa magie, l'import en
    // tableur la retrouve par la magie et la catégorie de l'armure (lib/fiche-tableur-import.mjs)
    // les bonus de sorts qu'écrivent ses effets (« +4 dégâts avec les sorts d'Arcane » : lib/sort-bonus-texte.mjs, décision R102)
    // l'armure de la fiche quand une pièce élémentaire l'a transformée (décision R165 : une seule liste d'armures, celles des magies innée et acquise, sur
    // le fond de leur magie, `magies[].classe`) : `categorie`, son poids (« Vêtement » … « Lourd » : lib/fiche-format.mjs#valeurDuPoids) ; `ordre`,
    // celui des colonnes de l'onglet (une par magie : Sang, Arcane… Ombre ; le même pour les quatre poids) ; `effets`, les lignes de sa cellule « Effet(s) »
    // telles qu'écrites (armure_elementaire_effet). Rangées par magie (`ordre`), puis par identifiant (l'ordre des poids est à la page : valeurDuPoids)
    // `resistances` (décisions R165, R166 : « Le compter dans ce lot ») : les crans et immunités qu'écrivent ses effets, lus comme ceux des dons
    // (lib/resistance-texte.mjs, avec l'option `immunites` des armures élémentaires seulement : « … et immunité à la brûlure ») ; l'Arcane et la
    // Corruption tels qu'écrits (la colonne Arcane donne la Corruption, et l'inverse) ; absent quand ses effets n'en écrivent pas
    armures_elementaires: (() => {
      const effets = parCle(lignes(db, 'SELECT armure_elementaire_id, texte FROM armure_elementaire_effet ORDER BY armure_elementaire_id, rang'), 'armure_elementaire_id', (r) => r.texte);
      return lignes(db, 'SELECT id, nom, categorie, magie_id, ap, am, ordre FROM armure_elementaire ORDER BY ordre, id')
        .map((a) => {
          const sorts = (effets.get(a.id) ?? []).flatMap(bonusDeSortsEcrits);
          const lues = (effets.get(a.id) ?? []).map((t) => lireResistances(t, { immunites: true }));
          return {
            ...a, effets: effets.get(a.id) ?? [], ...(sorts.length ? { sorts } : {}),
            ...resistancesEcrites({ effets: lues.flatMap((l) => l.effets), choix: lues.some((l) => l.choix) }),
          };
        });
    })(),
    // le bouclier (décision R96 : « Forme + matière », comme l'onglet Boucliers et R78) : les formes (`boucliers`, bouclier_classe), les matières (leur
    // solidité, celle du bouclier : R78), les boucliers de la liste (une forme et une matière : AP, AM, poids R92) et les poids (Force minimum ; `classe` : la
    // classe de la couleur du poids, lib/palette-css.mjs, famille `poids`, émise par pages/fiche/index.astro, jamais un hex)
    boucliers: lignes(db, 'SELECT id, nom, classe FROM bouclier_classe ORDER BY classe'),
    materiaux_bouclier: lignes(db, 'SELECT ressource_id, ap, am, solidite FROM materiau_bouclier ORDER BY ordre')
      .map((m) => ({ id: m.ressource_id, nom: nomDeRessource(m.ressource_id), ap: m.ap, am: m.am, solidite: m.solidite })),
    boucliers_formes_matieres: lignes(db, 'SELECT id, classe_id, materiau_id, nom, ap, am, poids_id FROM bouclier ORDER BY classe_id, materiau_id'),
    poids_bouclier: lignes(db, 'SELECT id, nom, force_min FROM bouclier_poids ORDER BY ordre')
      .map((p) => ({ ...p, classe: classeDuPoids(p.id) })),
    // accessoires : l'effet, et ce qu'il change sur la fiche (accessoire_effet_cible, décision R54 : lib/fiche-moteur.mjs#effetsDesAccessoires) ; `usage` : rappelé
    // sous les dons de race (« (Action) » ou usage compté) ; `propriete_nom` : le nom de sa propriété (accessoire_propriete.nom, « Attributs »), écrit par la
    // fiche en tableur
    // `propriete_ordre` : l'ordre des propriétés (accessoire_propriete.ordre), celui des groupes de la liste des effets (décision R97)
    accessoires: lignes(db, `SELECT e.id, e.propriete_id, p.nom AS propriete_nom, p.ordre AS propriete_ordre, e.libelle, e.caracteristique_id, e.niveau, e.bonus_min,
                                    e.bonus_max, e.bonus_valeur, e.bonus_cible, e.malediction, e.usage
                             FROM accessoire_effet e JOIN accessoire_propriete p ON p.id = e.propriete_id ORDER BY e.propriete_id, e.ordre`)
      .map((a) => ({
        id: a.id, propriete: a.propriete_id, propriete_nom: a.propriete_nom, propriete_ordre: a.propriete_ordre, libelle: a.libelle, caracteristique_id: a.caracteristique_id, niveau: a.niveau, min: a.bonus_min, max: a.bonus_max,
        valeur: a.bonus_valeur, cible: a.bonus_cible, malediction: a.malediction === 1, usage: a.usage,
        effets: (ciblesDesAccessoires.get(a.id) ?? []),
      })),
    ressources: lignes(db, 'SELECT id, nom, genre FROM ressource ORDER BY nom COLLATE NOCASE'),
    // la ceinture (décisions R81, R89) : les objets du catalogue qui y vont (v_objet_ceinture), avec la contenance écrite d'un carquois ou d'un sac
    // (sa quantité à la ceinture = ses projectiles), et les bâtons magiques, sous le nom que la fiche leur donne (lib/ceinture-texte.mjs#nomDeBaton)
    ceinture: {
      // le bâton magique pas encore réglé (décision R101 : sa magie et son niveau se choisissent dans le sac avant la ceinture)
      baton_a_regler: BATON_A_REGLER,
      objets: lignes(db, `SELECT v.famille, v.ressource_id, r.description FROM v_objet_ceinture v JOIN ressource r ON r.id = v.ressource_id
                          ORDER BY v.famille, v.ressource_id`)
        .map((o) => ({ ressource_id: o.ressource_id, famille: o.famille, ...(o.famille === 'contenant' ? { contenance: contenanceEcrite(o.description) } : {}) })),
      // ses effets passifs (décision R101 : lib/ceinture-texte.mjs#effetsDeBaton, comptés à la ceinture)
      batons: lignes(db, `SELECT b.id, b.magie_id, b.niveau, b.bonus_brut, m.nom AS magie FROM v_objet_ceinture v JOIN baton_magique b ON b.id = v.baton_id
                          JOIN magie m ON m.id = b.magie_id ORDER BY m.ordre, b.niveau`)
        .map((b) => ({ id: b.id, nom: nomDeBaton(b.magie, b.niveau), magie_id: b.magie_id, magie: b.magie, niveau: b.niveau, effets: effetsDeBaton(b.bonus_brut) })),
    },
    // le sac (décision R88, réponses du propriétaire du 2026-10-16 ; des valeurs de la décision, pas d'une table, comme regles.ambidextrie) : la
    // quantité d'une ligne, un nombre saisi de 1 à 99 (« Maxé à 99 pour l'inventaire »), et la Force dont compte le sac d'un personnage qui a le don
    // « Organisé » (« un inventaire équivalent à 5 de Force, quelque soit la force du personnage » : lib/fiche-moteur.mjs#donDuSacSansForce)
    sac: { quantite_max: 99, force_avec_le_don: 5 },
    // le sort préparé (décision R115 : « noter le résultat du jet de magie si réussi », « le jet de magie (le D100) » ; des valeurs de la décision, comme le
    // sac, que le CHECK de personnage_sort.prepare_jet garde aussi) : le jet se note de 1 à 100 (lib/fiche-moteur.mjs#sortsApresLeJet)
    sort_prepare: { jet_min: 1, jet_max: 100 },
  };

  // Les invocations (décision R130 : « avoir la liste des invocations possibles pour les sorts qui invoquent des créatures », « adapter le monstre invoqué en
  // fonction de ses NPM ») : par sort qui invoque, ses créatures dans l'ordre du classeur, leurs magies de marge (la première est celle du sort), le NPM d'une
  // marionnette, ce qui change avec le NPM (lib/creature-npm.mjs, `donneesNpm`), leurs capacités (« (NPM n) » : `npm`) et les effets d'un sacrifice
  // (« Effet "Manteau noir" » : `sort_id` du sort qui sacrifie) ; et les tableaux qu'un sort désigne par son nom (« Amélioration cadavérique »).
  const { tableaux: tableauxDInvocation } = chargerInvocations(db);
  const invocations = tableauxDInvocation.filter((t) => t.invocation.sortId).map((t) => ({
    id: t.invocation.id,
    nom: t.invocation.nom,
    sort_id: t.invocation.sortId,
    magie_id: t.invocation.magieId,
    creatures: t.lignes.flatMap((l) => l.cases).map((c) => ({
      id: c.id,
      nom: c.nom,
      bloc: c.bloc,
      npm: c.npmDuBloc,
      magies: c.magiesDuBlocIds,
      donnees: c.donneesNpm,
      vitesse: c.vitesse,
      capacites: [...c.capacites.map((x) => ({ npm: x.npm, nom: x.nom, texte: x.texte })), ...c.communes.map((x) => ({ npm: null, nom: x.nom, texte: x.texte, commune: true }))],
      effets: c.effets.map((e) => ({ libelle: e.libelle, sort_id: e.sort_id, texte: e.texte })),
    })),
  }));
  const tableaux_de_sacrifice = [...tableauxDesSorts(db)].map(([sortId, t]) => ({ sort_id: sortId, invocation_id: t.invocationId, lignes: t.lignes }));

  // couleur de la pastille de l'alignement (demande du propriétaire : celle de son titre dans le guide pour MJ, lib/caracteristiques-postures.mjs) : sa
  // classe de la palette (famille d'une zone, émise par pages/fiche/index.astro), par nom ; `alignement_par_defaut` : celle d'un alignement inconnu
  const alignements = Object.fromEntries(Object.keys(COULEURS_ALIGNEMENTS).map((nom) => [nom, { classe: classeDAlignement(nom) }]));
  const alignement_par_defaut = { classe: classeDAlignement(null) };
  // la couleur d'un groupe de races (pures, hybrides), même vide : la classe de sa nature ; `neutre` : la classe de ce que la fiche montre sans couleur
  // de règle (la magie acquise « Aucune », un objet de départ au choix, une ethnie sans race choisie)
  const race_par_nature = Object.fromEntries(['pure', 'hybride'].map((nature) => [nature, { classe: classeDeRace(nature) }]));
  const neutre = { classe: CLASSE_NEUTRE };

  return {
    constantes, am_classe_magique: amMagique, niveaux, caracteristiques, caracteristique_par_defaut, competences, initiative, races, ethnies, magies, dieux, metiers, classes, sorts, postures,
    ordre_postures, mode_hyper, ambidextrie, resistance_paliers, etats, alignements, alignement_par_defaut, race_par_nature, neutre, invocations, tableaux_de_sacrifice, ...equipement,
  };
}

// ------------------------------------------------------------------------------------------------------------------ aide du champ « Entraînement »
/** La page du guide qui dit où se notent les bonus d'entraînement et leurs limites (« S’entraîner et exercer un métier », Les bases ; décision R71). */
export const PAGE_DE_L_ENTRAINEMENT = 'guide/s-entrainer-et-exercer-un-metier';

/**
 * Le texte d'un lien du wiki écrit sans texte (`[[cible]]`) : le titre de la page qu'il vise quand `titreDe` le donne (aideDeLEntrainement le cherche
 * dans la base), sinon, pour une cible écrite comme un identifiant (« guide/s-entrainer »), son dernier segment, tirets en espaces, jamais
 * l'identifiant brut ; une autre cible (un titre, un alias : « Règles des métiers ») telle qu'écrite.
 */
function texteDuLien(cible, titreDe) {
  const c = cible.trim();
  const titre = titreDe?.(c);
  if (titre) return titre;
  return /^[a-z0-9-]+(?:\/[a-z0-9-]+)+$/.test(c) ? c.slice(c.lastIndexOf('/') + 1).replace(/-/g, ' ') : c;
}

/**
 * Un paragraphe Markdown en texte : un lien du site ou du wiki par son texte (texteDuLien pour un lien du wiki sans texte), sans couleur de case,
 * les sauts de ligne en espaces, sans gras (`**…**`, `__…__`) ni italique (`*…*`, `_…_`, seulement entre limites de mot : ni « 2 * 3 », ni
 * « nom_de_fichier »).
 */
const enTexte = (paragraphe, titreDe) => paragraphe
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, (_, cible) => texteDuLien(cible, titreDe))
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\{couleur:[^}]*\}/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\*\*|__/g, '')
  .replace(/(^|[^\p{L}\p{N}*])\*(?=\S)([^*]*?\S)\*(?![\p{L}\p{N}*])/gu, '$1$2')
  .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu, '$1$2')
  .trim();

/**
 * Le paragraphe du corps de cette page qui renvoie à la case « Entraînement » des dons (« Les bonus se notent dans la case **Entraînement** des dons »,
 * avec les limites qui le précèdent : « il ne peut améliorer que **15 compétences** au plus, et de **10 %** au plus chacune »), tel qu'écrit, en texte
 * (enTexte : la case peut être écrite en gras ou en italique) ; null quand la page ne l'écrit plus (elle se modifie sur le site de dev : l'aide de la
 * fiche se passe alors de citation, rien n'est réécrit ici). `titreDe(cible)` : le titre de la page que vise un lien du wiki sans texte, ou null.
 */
export function limitesDeLEntrainement(corps, titreDe = null) {
  for (const bloc of String(corps ?? '').split(/\n[ \t]*\n/)) {
    const t = bloc.trim();
    if (!t || /^(#|<!--|\||- |\* |\d+\. )/.test(t)) continue;
    const texte = enTexte(t, titreDe);
    if (/\bcase Entraînement\b/i.test(texte)) return texte;
  }
  return null;
}

/**
 * Le titre de la page que vise un lien du wiki (`[[cible]]`), d'après la base, comme lib/wikilinks.mjs#resolve : une cible avec « / » par son
 * identifiant ; sinon (ou cet identifiant absent) par la clé de son titre, de son nom court ou d'un alias (vue cle_page), quand une seule page la
 * porte ; null sinon (introuvable ou ambiguë).
 */
function titreDeLaCible(db, cible) {
  if (cible.includes('/')) {
    const page = db.prepare('SELECT titre FROM page WHERE id = ?').get(cible.toLowerCase());
    if (page) return page.titre;
  }
  const pages = db.prepare('SELECT DISTINCT p.id, p.titre FROM cle_page c JOIN page p ON p.id = c.page_id WHERE c.cle = ?').all(normalize(cible));
  return pages.length === 1 ? pages[0].titre : null;
}

/**
 * L'aide du champ « Entraînement » de la fiche (décision R71), écrite dans la page au build : { titre, texte } de la page du guide (plus de numéro de
 * chapitre depuis la refonte des pages du guide, 2026-10-18 : la page cite le titre seul, la fiche restant sans lien vers le guide,
 * docs/character-generator.md, « Compacte »), ou null si la page manque ou n'écrit plus ce paragraphe.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function aideDeLEntrainement(db) {
  const page = db.prepare('SELECT titre, corps_md FROM page WHERE id = ?').get(PAGE_DE_L_ENTRAINEMENT);
  const texte = page ? limitesDeLEntrainement(page.corps_md, (cible) => titreDeLaCible(db, cible)) : null;
  return texte ? { titre: page.titre, texte } : null;
}
