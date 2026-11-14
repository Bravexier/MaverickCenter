// Le versement des modifications du journal dans historique_modification (section 15 de data/schema.sql). Une seule règle, deux appelants :
// `npm run db:appliquer-edition` (scripts/db-appliquer-edition.mjs : les modifications rapatriées dans data/rows) et l'extrait du contenu pour les
// sessions de Claude (serveur/extrait.mjs : les modifications en attente, versées dans l'extrait seulement — garde-fou 10 du chantier de la base de dev,
// « sinon les tests prennent une saisie récente pour le texte d'origine »). Il vit ici, dans le service, parce que `scripts/` n'est pas livré avec lui.
import { traceDAujourdhui } from './edition.mjs';
import { journalSansImage } from '../src/lib/edition-modele.mjs';

/**
 * Verse dans historique_modification les modifications du journal qui ne sont pas en conflit (réécrites par le rejeu ou déjà dans les règles), dans
 * l'ordre du rejeu, avec version NULL (rapatriées à la main : aucune note de version ne les a livrées). Un lot déjà dans l'historique (journal
 * appliqué deux fois, ou livré par « Effectuer la mise à jour ») n'est pas repris. Rend le nombre de lignes versées. Jamais l'auteur du lot :
 * historique_modification n'en a pas.
 */
export function historiser(db) {
  const modifications = db
    .prepare(
      `SELECT m.lot_id, m.rang, l.fait_le, l.resume, l.nature, l.decision, m.table_nom, m.cle, m.operation, m.avant, m.apres FROM modification m JOIN modification_lot l ON l.id = m.lot_id
       WHERE m.etat <> 'conflit' AND NOT EXISTS (SELECT 1 FROM historique_modification h WHERE h.lot_id = m.lot_id) ORDER BY l.fait_le, l.id, m.rang`,
    )
    .all();
  // la nature et le numéro de décision du lot suivent chaque ligne (migration 0127 : saisie, source, decision, migration, code)
  const inserer = db.prepare(`INSERT INTO historique_modification (lot_id, rang, fait_le, resume, version, table_nom, cle, operation, avant, apres, nature, decision)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`);
  // un lot noté avant la 0113 nomme ses mots-clés par leur ancien id texte : la trace les nomme par leur id entier (serveur/edition.mjs#traceDAujourdhui)
  const enTrace = traceDAujourdhui(db);
  // une image (portrait) n'y est que résumée : la ligne de sa table la garde
  for (const brute of modifications) {
    const m = enTrace(brute);
    inserer.run(m.lot_id, m.rang, m.fait_le, m.resume, m.table_nom, m.cle, m.operation, journalSansImage(m.table_nom, m.avant), journalSansImage(m.table_nom, m.apres),
      m.nature, m.decision);
  }
  return modifications.length;
}
