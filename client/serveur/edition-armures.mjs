// Édition de la page « Armures » (et de son onglet Boucliers) depuis le site de dev (demande du propriétaire, 2026-10-15 : la refonte « de la même manière
// que les Armes », « Modifiable tout de suite ») : les domaines des tables armure, armure_emplacement, bouclier_classe, bouclier, bouclier_poids et des
// améliorations d'armure et de bouclier pour serveur/edition.mjs (DOMAINES). Ce que la base tire des cases (prix, résistances et faiblesses d'une armure,
// coût en RF d'une pièce, prix d'une forme, Force minimum d'un poids, coût et effet d'une amélioration d'armure, ligne TOTAL) est recalculé par les
// découpages de lib/armure-champs.mjs (rejoués sur toute la base par test/armure-champs.test.mjs), jamais saisi ; le corps des pages « Armures » et
// « Bouclier » suit (lib/corps-armures.mjs). Sens inverse depuis la demande du propriétaire du 2026-10-17 : l'AP et l'AM d'une armure et d'un bouclier,
// et les quatre cases d'une amélioration de bouclier (coût en RO, coût en matériaux, AP, cran ; lib/armure-champs.mjs#CASES_D_AMELIORATION_DE_BOUCLIER),
// sont saisis ; la défense écrite et le coût et l'effet écrits d'une amélioration de bouclier en sont refaits (gardés tels qu'écrits tant qu'ils se
// lisent exactement en ces valeurs). Un lot du journal noté avant (défense ou coût et effet saisis en texte) : ancienneEcritureDesArmures.
// Depuis la décision R207 (1), E6 (migrations 0105, 0108) : le type, l'AP, l'AM et le prix d'une armure de la grille, l'AP, l'AM et le prix d'un bouclier
// se calculent d'après les matériaux (+ le coût de fabrication pour le prix) ; ils ne se saisissent plus (une armure particulière garde les siens, R80)
// et suivent leurs entrées (suivreLesValeursCalculees).
// Ni création ni suppression : la fiche de personnage cite les armures, les pièces, les formes et les améliorations. Les matériaux se modifient sur la
// page « Composants » (décision R62 : serveur/edition-composants.mjs).
// Les outils communs du service (refus, synchroniser…) sont donnés par serveur/edition.mjs (domainesDesArmures), sans import en retour.
import {
  ameliorationDeBouclierExacte, analyserAmeliorationDeProtection, CASES_D_AMELIORATION_DE_BOUCLIER, colonnesDeLArmure, colonnesDuBouclier, coutDeLaPiece,
  defenseEcrite, defenseExacte, degatsDeLArmure, forceDuPoids, prixDeLaForme, textesDeBouclierEcrits, totalDesAmeliorationsDeProtection, TYPES_D_ARMURE,
} from '../src/lib/armure-champs.mjs';
import { nombre } from '../src/lib/armure-forge.mjs';
import { valeursCalculees } from '../src/lib/armures-db.mjs';
import { corpsDesArmuresApres, ErreurCorpsArmures, pageDeLaLigne } from '../src/lib/corps-armures.mjs';
import { TABLES } from '../src/lib/edition-modele.mjs';
import { lireLigne } from './edition-journal.mjs';
import { jsonOuNull } from './partage.mjs';
import { corpsOuRefus } from './edition-corps.mjs';

/** Le coût et l'effet écrits d'une amélioration : les cases d'une amélioration d'arme ou d'armure, refaits pour une amélioration de bouclier. */
export const TEXTES_D_AMELIORATION = ['cout_brut', 'effet_brut'];

/** Les cibles d'amélioration de la page des armures. */
export const CIBLES_DES_ARMURES = ['armure', 'bouclier'];

/**
 * Le corps de la page (« Armures » ou « Bouclier ») qui écrit cette ligne, après sa modification (lib/corps-armures.mjs#corpsDesArmuresApres) ; un corps
 * sans la forme de l'importeur refuse le lot.
 */
export function suivreLeCorpsDesArmures(ctx, table, avant, apres, ErreurEdition) {
  const id = pageDeLaLigne(table, apres ?? avant);
  const page = id && lireLigne(ctx.db, 'page', { id });
  if (!page) return;
  const corps = corpsOuRefus(ErreurEdition, ErreurCorpsArmures, id, () => corpsDesArmuresApres(page.corps_md, table, avant, apres));
  if (corps !== page.corps_md) ctx.w.modifier('page', { id }, { corps_md: corps });
}

/**
 * Le prix écrit (prix_brut) d'une armure de la grille recalculé : le format de la colonne, celui du classeur et des migrations 0105 et 0108 (« 640 »,
 * « 2 500 » : milliers séparés par une espace, virgule décimale) ; null sans prix.
 */
export const prixEcritDeLArmure = (prix) => (prix === null ? null : nombre(prix));

/**
 * Le prix écrit (prix_brut) d'un bouclier recalculé : le format de la colonne, celui du classeur et de la migration 0105 (« 12 », « 112,5 », « 1207,5 » :
 * aucun séparateur de milliers, virgule décimale, arrondi au Ricken de fer) ; null sans prix. Lu par nombreEcrit (lib/armure-champs.mjs) comme l'autre.
 */
export const prixEcritDuBouclier = (prix) => (prix === null ? null : String(Math.round(prix * 100) / 100).replace('.', ','));

/**
 * Les lignes dont une colonne calculée d'après les matériaux n'est plus celle de la formule (décision R207 (1), E6 ; formules : lib/armure-forge.mjs, entrées
 * lues par lib/armures-db.mjs#valeursCalculees) : [{ table, ligne (telle qu'en base), valeurs (les colonnes à écrire) }] — le type, l'AP, l'AM et le prix
 * des armures de la grille, l'AP, l'AM et le prix des boucliers, avec la défense écrite (stats_brut, defense_brut, refaite par defenseEcrite) et le prix
 * écrit (prix_brut ; vide quand un prix de matériau manque), dans le format de la donnée en place (prixEcritDeLArmure, prixEcritDuBouclier). Une
 * valeur qui ne change pas n'est pas écrite. Un type que les matériaux ne donnent pas laisse celui en place (la colonne n'admet pas NULL).
 */
function changementsCalcules(db) {
  const { armures, boucliers } = valeursCalculees(db);
  const sortie = [];
  for (const a of db.prepare("SELECT * FROM armure WHERE sorte = 'combinaison' ORDER BY ordre").all()) {
    const v = armures.get(a.id);
    const valeurs = {};
    if (v.type !== null && v.type !== a.type) valeurs.type = v.type;
    if (v.ap !== a.ap || v.am !== a.am) Object.assign(valeurs, { ap: v.ap, am: v.am, stats_brut: defenseEcrite(v.ap, v.am, a.stats_brut) });
    if (v.prix !== a.prix) Object.assign(valeurs, { prix: v.prix, prix_brut: prixEcritDeLArmure(v.prix) });
    if (Object.keys(valeurs).length) sortie.push({ table: 'armure', ligne: a, valeurs });
  }
  for (const b of db.prepare('SELECT * FROM bouclier ORDER BY id').all()) {
    const v = boucliers.get(b.id);
    const valeurs = {};
    if (v.ap !== b.ap || v.am !== b.am) Object.assign(valeurs, { ap: v.ap, am: v.am, defense_brut: defenseEcrite(v.ap, v.am, b.defense_brut) });
    if (v.prix !== b.prix) Object.assign(valeurs, { prix: v.prix, prix_brut: prixEcritDuBouclier(v.prix) });
    if (Object.keys(valeurs).length) sortie.push({ table: 'bouclier', ligne: b, valeurs });
  }
  return sortie;
}

/**
 * Les colonnes calculées d'après les matériaux (décision R207 (1), E6 : changementsCalcules) ne se saisissent pas (ARMURE.colonnes, TABLES) : elles
 * suivent ce dont elles se calculent, appelé après la modification d'un matériau (prix de sa ressource, type : serveur/edition-composants.mjs), du coût
 * de « Armure Complète » (armure_emplacement) ou du prix d'une forme de bouclier (bouclier_classe). Seules les lignes dont une valeur change sont écrites,
 * notées au lot comme le reste, et la ligne du corps de leur page suit. Au rejeu, valeursCalculeesParLeLot refait le même calcul après chaque lot.
 */
export function suivreLesValeursCalculees(ctx, ErreurEdition) {
  for (const { table, ligne, valeurs } of changementsCalcules(ctx.db)) {
    suivreLeCorpsDesArmures(ctx, table, ligne, ctx.w.modifier(table, { id: ligne.id }, valeurs), ErreurEdition);
  }
}

/**
 * Les tables des entrées du calcul (décision R207 (1)) : un lot qui en écrit une peut changer les valeurs calculées (prix d'un matériau dans `ressource`,
 * type dans `materiau` et `materiau_armure`, AP et AM des matières, coût de « Armure Complète », prix d'une forme, constante des unités).
 * scripts/mise-a-jour-github.mjs#tablesDuLot en recopie la règle (TABLES_DES_ENTREES_DU_CALCUL, TABLES_DES_VALEURS_CALCULEES : comparées par
 * test/serveur-edition-armures.test.mjs).
 */
export const TABLES_DES_ENTREES_DU_CALCUL = Object.freeze([
  'ressource', 'materiau', 'materiau_armure', 'materiau_bouclier', 'armure_emplacement', 'bouclier_classe', 'constante_equipement',
]);
/** Les tables que le recalcul écrit au rejeu, au-delà du journal : armure, bouclier, et page (le corps des pages Armures et Bouclier qui en suit). */
export const TABLES_DES_VALEURS_CALCULEES = Object.freeze(['armure', 'bouclier', 'page']);

/**
 * Après chaque lot rejoué qui écrit une entrée du calcul (edition-journal.mjs#rejouer : `apresLeLot`, dans le lot et annulé avec lui ; serveur/edition.mjs
 * #rejouerLeJournal) : les colonnes calculées qui ne sont plus celles de la formule sont refaites, hors journal (un lot noté avant la décision R207 qui
 * change le prix d'un matériau ne note pas les armures et les boucliers qui en suivent ; un lot noté depuis les note, et rien ne reste à refaire). Rend
 * ces écritures ({ lot, rang, table, cle, operation: 'modifier', avant, apres, calculees: true }) : recalculerLesPages en refait la ligne du corps des pages,
 * et leurs tables vont dans `tablesCompletees`. `lot` : ses modifications, telles que le journal les note (table_nom).
 */
export function valeursCalculeesParLeLot(db, lot) {
  if (!lot.length || !lot.some((m) => TABLES_DES_ENTREES_DU_CALCUL.includes(m.table_nom ?? m.table))) return [];
  const { lot_id: lotId, rang } = lot.at(-1);
  const ecrites = [];
  for (const { table, ligne, valeurs } of changementsCalcules(db)) {
    const colonnes = Object.keys(valeurs); // des colonnes de changementsCalcules, jamais une saisie
    db.prepare(`UPDATE "${table}" SET ${colonnes.map((c) => `"${c}" = ?`).join(', ')} WHERE id = ?`).run(...colonnes.map((c) => valeurs[c]), ligne.id);
    ecrites.push({
      lot: lotId, rang, table, cle: { id: ligne.id }, operation: 'modifier', avant: Object.fromEntries(colonnes.map((c) => [c, ligne[c]])), apres: valeurs,
      calculees: true,
    });
  }
  return ecrites;
}

/** Les colonnes calculées (décision R207 (1)) qu'un ancien lot pouvait écrire directement : celles d'une armure de la grille et d'un bouclier. */
const ECRITES_AVANT_R203 = Object.freeze({ armure: ['type', 'ap', 'am', 'prix', 'prix_brut'], bouclier: ['ap', 'am', 'prix', 'prix_brut'] });

/**
 * Un lot noté avant la décision R207 (1) qui écrit directement une colonne calculée (adaptateur de edition-journal.mjs#rejouer, comme
 * serveur/edition.mjs#ecrituresFigees) : le type, l'AP, l'AM ou le prix d'une armure de la grille, l'AP, l'AM ou le prix d'un bouclier, à une valeur que
 * les règles n'ont pas, sans écrire aucune entrée du calcul (TABLES_DES_ENTREES_DU_CALCUL : un lot du service d'aujourd'hui note ces colonnes avec le
 * matériau ou le coût qui les change). Une forme ancienne sans équivalent : `conflit`, avec sa raison ; son lot entier est en conflit au rejeu (service,
 * mise à jour, db:appliquer-edition), et sur la page « Mise à jour » la modification n'a que le choix 2 (la règle livrée). Une valeur déjà dans les règles
 * passe (« intégrée ») ; une armure particulière (R80) n'est pas visée. Le lot de chaque modification est lu une fois dans `modification` de `db`.
 */
export function ecrituresDesValeursCalculees(db) {
  const parLot = new Map();
  const journal = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'modification'").get());
  const ecritUneEntree = (lot) => {
    if (!journal) return false;
    if (!parLot.has(lot)) {
      parLot.set(lot, Boolean(db.prepare(`SELECT 1 FROM modification WHERE lot_id = ? AND table_nom IN (${TABLES_DES_ENTREES_DU_CALCUL.map(() => '?').join(', ')}) LIMIT 1`)
        .get(lot, ...TABLES_DES_ENTREES_DU_CALCUL)));
    }
    return parLot.get(lot);
  };
  const raison = (table) => `noté avant la décision R207 (1) : ${table === 'armure'
    ? 'le type, l’AP, l’AM et le prix d’une armure de la grille se calculent d’après ses deux matériaux'
    : 'l’AP, l’AM et le prix d’un bouclier se calculent d’après sa forme et sa matière'} et ne se saisissent plus ; à refaire sur le site de dev, `
    + 'par les matériaux (page Composants) ou le coût de fabrication';
  return (m) => {
    const colonnes = ECRITES_AVANT_R203[m.table_nom];
    if (!colonnes || m.operation !== 'modifier' || m.conflit || m.sansEffet) return m;
    const apres = jsonOuNull(m.apres) ?? {};
    const cle = jsonOuNull(m.cle);
    const ligne = cle && lireLigne(db, m.table_nom, cle);
    if (!ligne || (m.table_nom === 'armure' && ligne.sorte !== 'combinaison')) return m;
    if (!colonnes.some((c) => c in apres && (ligne[c] ?? null) !== (apres[c] ?? null)) || ecritUneEntree(m.lot_id)) return m;
    return { ...m, conflit: raison(m.table_nom) };
  };
}

/** Les colonnes d'une armure de la grille calculées d'après ses deux matériaux (décision R207 (1), E6) : elles ne se saisissent pas. */
export const COLONNES_CALCULEES_DE_LA_GRILLE = Object.freeze(['type', 'ap', 'am', 'prix_brut']);
/**
 * Les colonnes d'un bouclier calculées d'après sa forme et sa matière (décision R207 (1), E6) : dans TABLES pour que leurs cases en lecture suivent la
 * ligne renvoyée, elles ne se saisissent pas (une valeur renvoyée telle qu'en place passe, une valeur changée est refusée).
 */
export const COLONNES_CALCULEES_DU_BOUCLIER = Object.freeze(['ap', 'am', 'prix_brut']);

/** Les colonnes calculées que `valeurs` change par rapport à la ligne en place `avant` (une valeur renvoyée telle qu'en place n'en est pas une). */
const calculeesChangees = (colonnes, valeurs, avant) => colonnes.filter((c) => c in valeurs && (valeurs[c] ?? null) !== (avant[c] ?? null));

/**
 * Les domaines de la page des armures : { domaines: { table: { colonnes, deriver } }, amelioration: { colonnes, deriver } } (voir
 * serveur/edition.mjs#DOMAINES ; `amelioration` est le domaine des améliorations d'armure et de bouclier, que serveur/edition.mjs choisit par la cible
 * de la ligne, celles d'arme restant à serveur/edition-armes.mjs).
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function }} outils
 */
export function domainesDesArmures({ refus, ErreurEdition, synchroniser }) {
  const suivreLeCorps = (ctx, table, avant, apres) => suivreLeCorpsDesArmures(ctx, table, avant, apres, ErreurEdition);
  // un prix modifié qui écrit un nombre doit être lisible (« 2050 RO » : faute de frappe) ; « ???? » ou une case vide : la source ne le donne pas
  const prixLisible = (valeurs, ligne, colonnes, avant) => {
    if ('prix_brut' in valeurs && colonnes.prix === null && /\d/.test(ligne.prix_brut ?? '')) {
      throw refus(`${avant.nom} : le prix s’écrit en RO, un nombre seul (« 28 », « 1207,5 ») ; « ???? » ou une case vide s’il n’est pas connu.`);
    }
    return colonnes;
  };

  const ARMURE = {
    colonnes(_ctx, ligne, valeurs, avant) {
      // décision R207 (1), E6 : le type, l'AP, l'AM et le prix d'une armure de la grille se calculent d'après ses deux matériaux (suivreLesValeursCalculees) ;
      // une valeur renvoyée telle qu'en place passe (une autre case de la ligne se modifie), une valeur changée est refusée. Une armure particulière
      // garde les siennes, saisies (R80)
      const calculees = avant.sorte === 'combinaison' ? calculeesChangees(COLONNES_CALCULEES_DE_LA_GRILLE, valeurs, avant) : [];
      if (calculees.length) {
        throw refus(`${avant.nom} : ${calculees.map((c) => `« ${TABLES.armure.colonnes[c].libelle} »`).join(', ')} d’une armure de la grille se calculent d’après ses deux `
          + 'matériaux (décision R207) : modifiez les matériaux sur la page Composants, ou le coût de fabrication de l’armure complète.');
      }
      if (!TYPES_D_ARMURE.includes(ligne.type)) throw refus(`${avant.nom} : type d’armure inconnu (${ligne.type}).`);
      // la grille écrit une résistance et une faiblesse, une armure particulière un effet : chacune garde la forme de sa case
      if (avant.sorte === 'particuliere' && (('resistance_brut' in valeurs && valeurs.resistance_brut) || ('faiblesse_brut' in valeurs && valeurs.faiblesse_brut))) {
        throw refus(`${avant.nom} : une armure particulière n’a ni résistance ni faiblesse dans l’onglet (son effet les écrit).`);
      }
      if (avant.sorte === 'combinaison' && 'effet' in valeurs && valeurs.effet) throw refus(`${avant.nom} : une armure de la grille n’a pas d’effet dans l’onglet.`);
      const colonnes = colonnesDeLArmure(ligne);
      if (!colonnes.nom_cle) throw refus(`« ${ligne.nom} » : le nom doit contenir au moins une lettre ou un chiffre.`);
      return prixLisible(valeurs, ligne, colonnes, avant);
    },
    deriver(ctx, avant, apres) {
      // ses résistances et faiblesses, une ligne par type de dégâts (provenance de la ligne de l'armure)
      if ((apres.resistance_brut ?? null) !== (avant.resistance_brut ?? null) || (apres.faiblesse_brut ?? null) !== (avant.faiblesse_brut ?? null)) {
        synchroniser(ctx, 'armure_degats', { armure_id: apres.id }, degatsDeLArmure(apres.resistance_brut, apres.faiblesse_brut),
          { origine: apres.origine, source_ref: apres.source_ref });
      }
      suivreLeCorps(ctx, 'armure', avant, apres);
    },
  };

  const ARMURE_EMPLACEMENT = {
    colonnes(_ctx, ligne, valeurs, avant) {
      const cout = coutDeLaPiece(ligne.cout_brut);
      // « 250 RF / Classe » (le bouclier) : le coût dépend de la classe, sans montant fixe
      if ('cout_brut' in valeurs && cout === null && !/\/\s*classe/i.test(ligne.cout_brut ?? '')) {
        throw refus(`${avant.nom} : le coût s’écrit en RF puis en RO (« 100 RF / 1 RO »).`);
      }
      return { cout_rf: cout };
    },
    deriver(ctx, avant, apres) {
      suivreLeCorps(ctx, 'armure_emplacement', avant, apres);
      // le coût de « Armure Complète » entre dans le prix des armures de la grille (R93, R207 (1))
      if ((avant.cout_rf ?? null) !== (apres.cout_rf ?? null)) suivreLesValeursCalculees(ctx, ErreurEdition);
    },
  };

  const BOUCLIER_CLASSE = {
    colonnes(_ctx, ligne, _valeurs, avant) {
      const prix = prixDeLaForme(ligne.prix_brut);
      if (prix === null) throw refus(`${avant.nom} : le prix d’une forme est un nombre de RO (« 2,5 »).`);
      return { prix };
    },
    deriver(ctx, avant, apres) {
      suivreLeCorps(ctx, 'bouclier_classe', avant, apres);
      // le prix d'une forme est le coût de fabrication de ses boucliers (R207 (1), choix de game-design : il fait foi devant « 250 RF / Classe »)
      if (avant.prix !== apres.prix) suivreLesValeursCalculees(ctx, ErreurEdition);
    },
  };

  const BOUCLIER = {
    colonnes(_ctx, ligne, valeurs, avant) {
      // décision R207 (1), E6 : l'AP, l'AM et le prix d'un bouclier se calculent d'après sa forme et sa matière (suivreLesValeursCalculees) ; une valeur
      // renvoyée telle qu'en place passe (le nom ou le poids se modifie), une valeur changée est refusée
      const calculees = calculeesChangees(COLONNES_CALCULEES_DU_BOUCLIER, valeurs, avant);
      if (calculees.length) {
        throw refus(`${avant.nom} : ${calculees.map((c) => `« ${TABLES.bouclier.colonnes[c].libelle} »`).join(', ')} d’un bouclier se calculent d’après sa forme et `
          + 'sa matière (décision R207) : modifiez la matière sur la page Composants, ou le prix de la forme.');
      }
      return prixLisible(valeurs, ligne, colonnesDuBouclier(ligne), avant);
    },
    deriver: (ctx, avant, apres) => suivreLeCorps(ctx, 'bouclier', avant, apres),
  };

  const BOUCLIER_POIDS = {
    colonnes(_ctx, ligne, _valeurs, avant) {
      const force = forceDuPoids(ligne.force_brut);
      if (!force) throw refus(`${avant.nom} : la Force minimum s’écrit avec un nombre (« 2 de Force minimum »).`);
      return { force_min: force };
    },
    deriver: (ctx, avant, apres) => suivreLeCorps(ctx, 'bouclier_poids', avant, apres),
  };

  // une case Oui / Non dont « Non » est NULL (lib/edition-modele.mjs#OUI_SEUL : « Oui » arrive en '1') : 1 ou null, en nombre (le journal note la
  // valeur telle que la base la garde)
  const ouiOuNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const AMELIORATION = {
    colonnes(_ctx, ligne, valeurs = {}, avant = ligne) {
      if (!CIBLES_DES_ARMURES.includes(ligne.cible)) throw refus('Seules les améliorations d’armure et de bouclier se modifient ici.');
      if (ligne.cible === 'bouclier') {
        // les quatre cases (demande du propriétaire, 2026-10-17) ; le coût et l'effet écrits en sont refaits, jamais saisis
        const texte = TEXTES_D_AMELIORATION.find((c) => c in valeurs);
        if (texte) {
          throw refus(`Amélioration de bouclier +${avant.niveau} : « ${TABLES.amelioration_equipement.colonnes[texte].libelle} » est refait depuis ses cases (coût en RO, `
            + 'coût en matériaux, AP supplémentaire, +1 cran de solidité) ; modifiez ces cases.');
        }
        const cases = {
          cout_ro: ligne.cout_ro, cout_materiaux: ouiOuNull(ligne.cout_materiaux), bonus_ap: ligne.bonus_ap ?? null, bonus_cran: ouiOuNull(ligne.bonus_cran),
        };
        // l'AM d'une amélioration de bouclier n'est pas une case (la source n'en écrit aucune) : NULL, comme dans toute la base
        return { ...cases, bonus_am: null, ...textesDeBouclierEcrits(cases, avant) };
      }
      const saisie = CASES_D_AMELIORATION_DE_BOUCLIER.find((c) => c in valeurs);
      if (saisie) {
        throw refus(`Amélioration d’armure +${avant.niveau} : « ${TABLES.amelioration_equipement.colonnes[saisie].libelle} » ne se modifie que pour un bouclier ; `
          + 'ici, le coût et l’effet écrits.');
      }
      return analyserAmeliorationDeProtection(ligne.cible, ligne.cout_brut, ligne.effet_brut);
    },
    deriver(ctx, avant, apres) {
      const { db, w } = ctx;
      suivreLeCorps(ctx, 'amelioration_equipement', avant, apres);
      // la ligne TOTAL de son tableau, refaite depuis les niveaux (« 1 300 Ro + 2 Matériaux », « 1550 »)
      const total = totalDesAmeliorationsDeProtection(apres.cible, db.prepare('SELECT * FROM amelioration_equipement WHERE cible = ? ORDER BY niveau').all(apres.cible));
      const ligne = lireLigne(db, 'amelioration_total', { cible: apres.cible });
      if (ligne && ligne.total_brut !== total) {
        const nouvelle = w.modifier('amelioration_total', { cible: apres.cible }, { total_brut: total });
        suivreLeCorps(ctx, 'amelioration_total', ligne, nouvelle);
      }
    },
  };

  return {
    domaines: {
      armure: ARMURE, armure_emplacement: ARMURE_EMPLACEMENT, bouclier_classe: BOUCLIER_CLASSE, bouclier: BOUCLIER, bouclier_poids: BOUCLIER_POIDS,
    },
    amelioration: AMELIORATION,
  };
}

/**
 * Le domaine de la table amelioration_equipement, partagée par les pages des armes et des armures : chaque ligne va au domaine de sa cible (armure,
 * bouclier : celui de la page des armures ; les autres : celui des armes, qui refuse ce qui n'est pas une amélioration d'arme).
 */
export const ameliorationsParCible = (desArmes, desArmures) => {
  const domaine = (ligne) => (CIBLES_DES_ARMURES.includes(ligne?.cible) ? desArmures : desArmes);
  return {
    colonnes: (ctx, ligne, valeurs, avant) => domaine(avant).colonnes(ctx, ligne, valeurs, avant),
    deriver: (ctx, avant, apres) => domaine(avant).deriver(ctx, avant, apres),
  };
};

/**
 * Les écritures des armures, des boucliers et des améliorations de bouclier notées avant la demande du propriétaire du 2026-10-17 (journal du site de
 * dev encore en attente quand la livraison arrive, lot figé, journal exporté) : la défense d'une armure ou d'un bouclier se saisissait en un texte
 * (`stats_brut`, `defense_brut`), le coût et l'effet d'une amélioration de bouclier aussi (`cout_brut`, `effet_brut`), et le service en tirait l'AP,
 * l'AM, le coût en RO, les matériaux et les crans (lib/armure-champs.mjs#statsDeProtection, #analyserAmeliorationDeProtection), notés avec le texte.
 * Règle : jamais un rejeu vers une ligne dont le texte et les cases divergent. Pour chaque modification qui touche le texte ou les cases d'une armure,
 * d'un bouclier ou d'une amélioration de bouclier, la ligne telle qu'elle sera APRÈS elle (la ligne des règles, les valeurs que les modifications
 * gardées du journal y ont déjà notées, puis les siennes) doit avoir un texte qui se lit EXACTEMENT en ses cases (lib/armure-champs.mjs#defenseExacte,
 * #ameliorationDeBouclierExacte, qui tirent leurs valeurs des lectures de l'ancien service : « +5AP, +6AM » se rejoue, rien n'y est perdu) ; sinon
 * (un mot de plus, un signe détaché que l'ancien service ne lisait pas, une AM ou plus d'un cran pour une amélioration de bouclier, des cases notées
 * qui ne sont pas celles du texte…), rien n'est rapproché : son lot passe en conflit avec un message qui dit quoi refaire. Une modification d'un lot mis
 * en conflit ici ne compte pas pour les suivantes (un lot indépendant sur la même ligne n'est pas emporté avec lui). Les lots notés depuis passent :
 * le service écrit le texte et les cases ensemble. Rend l'adaptateur de edition-journal.mjs#rejouer (serveur/edition.mjs#rejouerLeJournal), fabriqué
 * au début de chaque passe (base dans l'état des règles, sans les lots que les passes précédentes ont mis en conflit).
 */
export function ancienneEcritureDesArmures(db) {
  const DEFENSES = { armure: 'stats_brut', bouclier: 'defense_brut' };
  const CASES = ['cout_ro', 'cout_materiaux', 'bonus_ap', 'bonus_am', 'bonus_cran'];
  const dit = (v) => (v === null || v === undefined ? '—' : String(v));
  const conflitDeDefense = (texte, lue, ligne) => 'noté avant que l’AP et l’AM ne se saisissent chacun dans sa case (demande du propriétaire du '
    + `2026-10-17) : la défense « ${texte} » ${lue
      ? `se lit AP ${dit(lue.ap)}, AM ${dit(lue.am)}, mais la ligne aurait AP ${dit(ligne.ap)}, AM ${dit(ligne.am)}`
      : 'ne se lit pas seulement en AP et en AM'} ; à refaire sur le site de dev, dans les cases AP et AM`;
  const conflitDAmelioration = (ligne, lue) => 'noté avant que l’amélioration d’un bouclier ne se saisisse en quatre cases (demande du propriétaire du '
    + `2026-10-17) : le coût « ${ligne.cout_brut} » et l’effet « ${ligne.effet_brut} » ${lue
      ? `se lisent ${CASES.map((c) => `${c} ${dit(lue[c])}`).join(', ')}, mais la ligne aurait ${CASES.map((c) => `${c} ${dit(ligne[c])}`).join(', ')}`
      : 'ne se lisent pas exactement en un coût en RO, au plus un matériau, un AP et au plus un cran de solidité'} ; à refaire sur le site de dev, dans ces cases`;
  const notees = new Map(); // ligne (« table\u0000clé ») → [{ lot, valeurs }] : les valeurs notées par les modifications déjà lues
  const rejetes = new Set(); // lots mis en conflit par cet adaptateur : leurs valeurs ne comptent plus
  const dejaNotees = (k) => Object.assign({}, ...(notees.get(k) ?? []).filter((n) => !rejetes.has(n.lot)).map((n) => n.valeurs));
  return (m) => {
    const surveillees = DEFENSES[m.table_nom] ? [DEFENSES[m.table_nom], 'ap', 'am'] : m.table_nom === 'amelioration_equipement' ? [...TEXTES_D_AMELIORATION, ...CASES] : null;
    if (!surveillees || m.operation === 'supprimer' || rejetes.has(m.lot_id)) return m;
    const apres = jsonOuNull(m.apres);
    if (!apres) return m;
    const k = `${m.table_nom}\u0000${m.cle}`;
    const cle = jsonOuNull(m.cle);
    const ligne = { ...(m.operation === 'modifier' && cle ? lireLigne(db, m.table_nom, cle) : null), ...dejaNotees(k), ...apres };
    if (!notees.has(k)) notees.set(k, []);
    notees.get(k).push({ lot: m.lot_id, valeurs: apres });
    if (!surveillees.some((c) => c in apres) || (m.table_nom === 'amelioration_equipement' && ligne.cible !== 'bouclier')) return m;
    let conflit = null;
    if (DEFENSES[m.table_nom]) {
      const texte = ligne[DEFENSES[m.table_nom]];
      const lue = defenseExacte(texte);
      if (!lue || lue.ap !== (ligne.ap ?? null) || lue.am !== (ligne.am ?? null)) conflit = conflitDeDefense(texte, lue, ligne);
    } else {
      const lue = ameliorationDeBouclierExacte(ligne.cout_brut, ligne.effet_brut);
      if (!lue || CASES.some((c) => lue[c] !== (ligne[c] ?? null))) conflit = conflitDAmelioration(ligne, lue);
    }
    if (!conflit) return m;
    rejetes.add(m.lot_id);
    return { ...m, conflit };
  };
}
