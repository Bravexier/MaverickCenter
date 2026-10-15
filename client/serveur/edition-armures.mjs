// Édition de la page « Armures » (et de son onglet Boucliers) depuis le site de dev (demande du propriétaire, 2026-10-15 : la refonte « de la même manière
// que les Armes », « Modifiable tout de suite ») : les domaines des tables armure, armure_emplacement, bouclier_classe, bouclier, bouclier_poids et des
// améliorations d'armure et de bouclier pour serveur/edition.mjs (DOMAINES). Ce que la base tire des cases (prix, AP et AM d'une armure ou d'un bouclier,
// résistances et faiblesses d'une armure, coût en RF d'une pièce, prix d'une forme, Force minimum d'un poids, coût et effet d'une amélioration, ligne
// TOTAL) est recalculé par les découpages de lib/armure-champs.mjs (rejoués sur toute la base par test/armure-champs.test.mjs), jamais saisi ; le corps
// des pages « Armures » et « Bouclier » suit (lib/corps-armures.mjs). Ni création ni suppression : la fiche de personnage cite les armures, les pièces, les
// formes et les améliorations. Les matériaux se modifient sur la page « Composants » (décision R62 : serveur/edition-composants.mjs).
// Les outils communs du service (refus, synchroniser…) sont donnés par serveur/edition.mjs (domainesDesArmures), sans import en retour.
import {
  analyserAmeliorationDeProtection, colonnesDeLArmure, colonnesDuBouclier, coutDeLaPiece, degatsDeLArmure, forceDuPoids, prixDeLaForme,
  totalDesAmeliorationsDeProtection, TYPES_D_ARMURE,
} from '../src/lib/armure-champs.mjs';
import { corpsDesArmuresApres, ErreurCorpsArmures, pageDeLaLigne } from '../src/lib/corps-armures.mjs';
import { lireLigne } from './edition-journal.mjs';

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
  let corps;
  try {
    corps = corpsDesArmuresApres(page.corps_md, table, avant, apres);
  } catch (e) {
    if (e instanceof ErreurCorpsArmures) throw new ErreurEdition(500, `Page ${id} : corps illisible (${e.message}) ; rien n’est enregistré.`);
    throw e;
  }
  if (corps !== page.corps_md) ctx.w.modifier('page', { id }, { corps_md: corps });
}

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
    deriver: (ctx, avant, apres) => suivreLeCorps(ctx, 'armure_emplacement', avant, apres),
  };

  const BOUCLIER_CLASSE = {
    colonnes(_ctx, ligne, _valeurs, avant) {
      const prix = prixDeLaForme(ligne.prix_brut);
      if (prix === null) throw refus(`${avant.nom} : le prix d’une forme est un nombre de RO (« 2,5 »).`);
      return { prix };
    },
    deriver: (ctx, avant, apres) => suivreLeCorps(ctx, 'bouclier_classe', avant, apres),
  };

  const BOUCLIER = {
    colonnes: (_ctx, ligne, valeurs, avant) => prixLisible(valeurs, ligne, colonnesDuBouclier(ligne), avant),
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

  const AMELIORATION = {
    colonnes(_ctx, ligne) {
      if (!CIBLES_DES_ARMURES.includes(ligne.cible)) throw refus('Seules les améliorations d’armure et de bouclier se modifient ici.');
      return analyserAmeliorationDeProtection(ligne.cible, ligne.cout_brut, ligne.effet_brut);
    },
    deriver(ctx, avant, apres) {
      const { db, w } = ctx;
      suivreLeCorps(ctx, 'amelioration_equipement', avant, apres);
      // la ligne TOTAL de son tableau, refaite depuis les niveaux (« 1 300 Ro + 2 Matériaux », « 15500 »)
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
