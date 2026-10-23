// Édition des consommables de l'onglet Ceinture de /ressources/equipement/ (sous-onglet Consommables : les tableaux Fioles, Remèdes, Philtres, Huiles,
// Alchimie primitive) depuis le site de dev — demande du propriétaire (2026-10-17) : « Les tableaux des consommables devrai pouvoir aussi être
// modifiées . (sauf pour les champ calculés) ». Les domaines pour serveur/edition.mjs (DOMAINES) :
//   - une potion (une ligne d'un tableau) : son nom et son prix (sa ligne de la table ressource, genre 'potion' ; le prix en RF en est recalculé,
//     lib/composants-champs.mjs#prixEnRf), son niveau d'alchimie et son effet (table potion ; les altérations d'état de l'effet, potion_etat, en sont
//     refaites : lib/potion-etats.mjs) ; rien d'autre ne se saisit (la couleur de la ligne suit la règle du site, lib/alchimie-couleurs.mjs ; la valeur en
//     RF d'un prix, la page et l'ordre d'une potion sont tirés d'ailleurs) ;
//   - le corps de la page de la potion (« Fiole rouge »… : son tableau du palier) suit (lib/corps-potions.mjs), ni HTML brut ni lien non sûr ajouté ;
//   - ni création ni suppression (non demandées ; les fiches de personnage citent les potions dans leur inventaire et leur ceinture).
// Les autres ressources restent au domaine des composants (serveur/edition-composants.mjs) : ressourcesParGenre aiguille une ligne de la table ressource
// d'après son genre. Les outils communs du service (refus, synchroniser…) sont donnés par serveur/edition.mjs, sans import en retour.
import { prixEnRf } from '../src/lib/composants-champs.mjs';
import { cleDeCase } from '../src/lib/corps-composants.mjs';
import { corpsDeLaPotionApres, ErreurCorpsPotions, pageDeLaPotion } from '../src/lib/corps-potions.mjs';
import { etatsDeLaPotion } from '../src/lib/potion-etats.mjs';
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { lireLigne } from './edition-journal.mjs';
import { corpsOuRefus } from './edition-corps.mjs';

/** Le contexte du corps des pages de potions (lib/corps-potions.mjs#corpsDeLaPotionApres), lu dans la base. */
export const contexteDuCorpsDesPotions = (db) => ({
  ressource: (id) => db.prepare('SELECT * FROM ressource WHERE id = ?').get(id) ?? null,
  niveau: (id) => db.prepare('SELECT * FROM niveau_alchimie WHERE id = ?').get(id) ?? null,
});

/** Les niveaux d'alchimie, dans l'ordre (choix « Niveau » d'une potion, liste `niveauxDAlchimie` de GET /api/edition/listes/). */
export const niveauxDAlchimie = (db) => db.prepare('SELECT id AS valeur, nom AS libelle FROM niveau_alchimie ORDER BY rang').all();

/**
 * Une ligne de la table ressource va au domaine des potions si c'est une potion, sinon à celui des composants (création et suppression : les composants
 * seulement, une potion ne se crée ni ne se supprime depuis le site).
 */
export const ressourcesParGenre = (desComposants, desPotions) => {
  const domaine = (ligne) => (ligne?.genre === 'potion' ? desPotions : desComposants);
  return {
    colonnes: (ctx, ligne, valeurs, avant) => domaine(avant).colonnes?.(ctx, ligne, valeurs, avant) ?? {},
    deriver: (ctx, avant, apres) => domaine(avant).deriver?.(ctx, avant, apres),
    creer: (...a) => desComposants.creer(...a),
    supprimer: (...a) => desComposants.supprimer(...a),
  };
};

/**
 * Les domaines des consommables ({ ressource, potion } : la ressource d'une potion, à aiguiller par ressourcesParGenre ; voir serveur/edition.mjs#DOMAINES).
 * @param {{ refus: Function, ErreurEdition: Function, synchroniser: Function }} outils
 */
export function domainesDesConsommables({ refus, ErreurEdition, synchroniser }) {
  /** Le corps de la page de la potion, après la modification de sa ressource ou de sa ligne de potion. */
  function suivreLaPage(ctx, table, avant, apres) {
    const contexte = contexteDuCorpsDesPotions(ctx.db);
    const id = pageDeLaPotion(table, apres, contexte);
    const page = id ? lireLigne(ctx.db, 'page', { id }) : null;
    if (!page) return;
    const corps = corpsOuRefus(ErreurEdition, ErreurCorpsPotions, id, () => corpsDeLaPotionApres(page.corps_md, table, avant, apres, contexte));
    if (corps === page.corps_md) return;
    // ni HTML brut ni lien non sûr ajouté : le Markdown part tel quel dans la page construite, puis en production (lib/markdown-sur.mjs)
    const ajoutes = fragmentsAjoutes(page.corps_md, corps);
    if (ajoutes.length) throw refus(`${contexte.ressource(apres.ressource_id ?? apres.id)?.nom ?? ''} : ${messageDeRefus(ajoutes)}`);
    ctx.w.modifier('page', { id }, { corps_md: corps });
  }

  const RESSOURCE = {
    colonnes(ctx, ligne, valeurs, avant) {
      // l'onglet ne montre pas de description de potion (le service l'accepterait sans qu'elle se voie)
      if ('description' in valeurs) throw refus(`${avant.nom} : une potion n’a pas de description dans l’onglet Ceinture (nom, niveau, prix, effet).`);
      // le corps de la page retrouve le tableau d'une potion par son nom, sans casse, accents ni signes : deux paliers de la même page ne s'écrivent pas
      // ainsi de la même façon (le même nom exactement, ou la même clé : refusés par la base, index ressource_genre_section_cle)
      if ('nom' in valeurs && ligne.nom !== avant.nom) {
        const autre = ctx.db.prepare("SELECT nom FROM ressource WHERE genre = 'potion' AND page_id = ? AND id <> ?").all(avant.page_id, avant.id)
          .find((r) => cleDeCase(r.nom) === cleDeCase(ligne.nom));
        if (autre) throw new ErreurEdition(409, `Nom « ${ligne.nom} » : c’est, à la casse, aux accents ou aux signes près, le nom d’un autre palier de la même page (« ${autre.nom} »).`);
      }
      return 'prix_brut' in valeurs ? { prix_rf: prixEnRf(ligne.prix_brut) } : {};
    },
    deriver: (ctx, avant, apres) => suivreLaPage(ctx, 'ressource', avant, apres),
  };

  const POTION = {
    colonnes(ctx, ligne, valeurs) {
      // le niveau : un niveau d'alchimie de la base (la clé étrangère le refuserait aussi, sans le dire aussi clairement)
      if ('niveau_id' in valeurs && !lireLigne(ctx.db, 'niveau_alchimie', { id: ligne.niveau_id })) throw refus(`Niveau d’alchimie inconnu : « ${ligne.niveau_id} ».`);
      return {};
    },
    deriver(ctx, avant, apres) {
      // les altérations d'état que l'effet inflige, réduit ou soigne (un index tiré du texte : lib/potion-etats.mjs, la règle de l'import) ; une ligne
      // créée prend la provenance de sa potion, comme celles de l'import
      if ((avant.effet ?? null) !== (apres.effet ?? null)) {
        const etats = ctx.db.prepare('SELECT id, nom FROM etat').all();
        synchroniser(ctx, 'potion_etat', { ressource_id: apres.ressource_id }, etatsDeLaPotion(apres.effet, etats), { origine: apres.origine, source_ref: apres.source_ref });
      }
      suivreLaPage(ctx, 'potion', avant, apres);
    },
  };

  return { ressource: RESSOURCE, potion: POTION };
}
