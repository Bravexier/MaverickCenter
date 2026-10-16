// Édition des panneaux de règles depuis le site de dev (migration 0055 ; demande du propriétaire, 2026-10-16 : « Il faudrait que ce champ texte soit
// modifiable sur son titre, et son contenu. Son contenu peut d'ailleurs inclure des tuiles génériques (toujours insérables / modifiables en mode
// édition) ») : le domaine de la table panneau_regles_bloc pour serveur/edition.mjs (DOMAINES) — le titre d'un panneau n'a rien qui en dépende (colonne
// de TABLES seulement). Un bloc :
//   - modifié : son texte (Markdown sûr, comme le guide : lib/markdown-sur.mjs ; le texte part tel quel dans la page construite), le titre d'une tuile
//     (refusé sur un bloc de texte : « un titre seulement sur une tuile »), sa place (`ordre`, « ↑ », « ↓ » de la page : deux blocs échangent leurs
//     ordres dans le même lot ; la colonne n'est pas unique, à égalité le rang départage) ;
//   - créé : après le bloc de rang `apres` (les blocs qui le suivent à la lecture sont repoussés d'une place, chaque décalage noté au journal :
//     lib/panneaux-regles-db.mjs#ordresApresInsertion), sinon à la fin ; son rang (sa clé) est le plus grand de la table, du journal et de l'historique + 1,
//     jamais redonné (comme un bloc de description de la chronologie : serveur/edition.mjs#rangLibre, donné en outil) ;
//   - supprimé : sauf le dernier de son panneau (409 : un panneau garde au moins un bloc) ; les ordres des autres ne changent pas (un trou ne gêne pas).
// Le corps des pages (page.corps_md, la trace de l'import) n'est jamais touché. Les outils communs du service (refus, ErreurEdition, rangLibre) sont
// donnés par serveur/edition.mjs, sans import en retour.
import { fragmentsAjoutes, messageDeRefus } from '../src/lib/markdown-sur.mjs';
import { ordresApresInsertion } from '../src/lib/panneaux-regles-db.mjs';
import { lireLigne } from './edition-journal.mjs';

/**
 * Le domaine des blocs de panneau de règles ({ panneau_regles_bloc: { colonnes, creer, supprimer } }) : voir serveur/edition.mjs#DOMAINES.
 * @param {{ refus: Function, ErreurEdition: Function, rangLibre: Function }} outils
 */
export function domainesDesPanneaux({ refus, ErreurEdition, rangLibre }) {
  const panneauDe = (db, id) => (typeof id === 'string' ? lireLigne(db, 'panneau_regles', { id }) : null);
  // dans l'ordre de lecture (index panneau_regles_bloc_ordre)
  const blocsDe = (db, id) => db.prepare('SELECT * FROM panneau_regles_bloc WHERE panneau_id = ? ORDER BY ordre, rang').all(id).map((b) => ({ ...b }));
  const nomDe = (p) => `Panneau « ${p.titre} »`;

  /** Ni HTML brut ni lien non sûr ajouté au Markdown d'un bloc. */
  function verifierLeTexte(avant, texte, quoi) {
    const ajoutes = fragmentsAjoutes(avant ?? '', texte);
    if (ajoutes.length) throw refus(`${quoi} : ${messageDeRefus(ajoutes)}`);
  }

  const BLOC = {
    colonnes(ctx, ligne, valeurs, avant) {
      const panneau = panneauDe(ctx.db, ligne.panneau_id);
      const quoi = `${nomDe(panneau)}, bloc ${ligne.rang}`;
      if ('texte' in valeurs) verifierLeTexte(avant.texte, ligne.texte, quoi);
      if ('titre' in valeurs && ligne.titre !== null && Number(ligne.tuile) !== 1) throw refus(`${quoi} : un titre ne se donne qu’à une tuile, pas à un bloc de texte.`);
      return {};
    },
    /** Un bloc de plus : après le bloc `apres` (les suivants repoussés d'une place), sinon à la fin ; texte ou tuile (le titre : une tuile seulement). */
    creer(ctx, valeurs) {
      const { db, w } = ctx;
      const panneau = panneauDe(db, valeurs.panneau_id);
      if (!panneau) throw new ErreurEdition(404, `Panneau de règles introuvable : ${valeurs.panneau_id}`);
      const tuile = Number(valeurs.tuile ?? 0) === 1 ? 1 : 0;
      if (!tuile && valeurs.titre) throw refus(`${nomDe(panneau)} : un titre ne se donne qu’à une tuile, pas à un bloc de texte.`);
      verifierLeTexte('', valeurs.texte, nomDe(panneau));
      const place = ordresApresInsertion(blocsDe(db, panneau.id), valeurs.apres ?? null);
      if (!place) throw new ErreurEdition(404, `${nomDe(panneau)} : aucun bloc de rang ${valeurs.apres} après lequel insérer le nouveau.`);
      for (const d of place.decalages) w.modifier('panneau_regles_bloc', { panneau_id: panneau.id, rang: d.rang }, { ordre: d.ordre });
      const rang = rangLibre(db, 'panneau_regles_bloc', 'panneau_id', panneau.id);
      w.inserer('panneau_regles_bloc', { panneau_id: panneau.id, rang, ordre: place.ordre, tuile, titre: tuile ? valeurs.titre ?? null : null, texte: valeurs.texte });
      return { id: `${panneau.id}#${rang}`, resume: `${tuile ? 'Tuile' : 'Bloc de texte'} ajouté${tuile ? 'e' : ''} : ${panneau.titre}` };
    },
    /** Un bloc retiré ; le dernier d'un panneau reste (modifiez-le). */
    supprimer(ctx, cle) {
      const { db, w } = ctx;
      const rang = Number(cle?.rang);
      const bloc = typeof cle?.panneau_id === 'string' && Number.isSafeInteger(rang) ? lireLigne(db, 'panneau_regles_bloc', { panneau_id: cle.panneau_id, rang }) : null;
      if (!bloc) throw new ErreurEdition(404, `Bloc de règles introuvable : ${JSON.stringify(cle)}`);
      const panneau = panneauDe(db, bloc.panneau_id);
      if (blocsDe(db, bloc.panneau_id).length === 1) throw new ErreurEdition(409, `${nomDe(panneau)} : c’est son seul bloc ; modifiez-le plutôt.`);
      w.supprimer('panneau_regles_bloc', { panneau_id: bloc.panneau_id, rang: bloc.rang });
      return { id: `${bloc.panneau_id}#${bloc.rang}`, resume: `Bloc retiré : ${panneau.titre}${bloc.titre ? ` (${bloc.titre})` : ''}` };
    },
  };

  return { panneau_regles_bloc: BLOC };
}
