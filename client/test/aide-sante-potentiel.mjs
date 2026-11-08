// Décision R225 (réponses du propriétaire du 2026-11-08 : « Oui, 5 santé max/niveau » ; V5 bis : « Non, le dé en plus ») : un personnage dont la magie
// innée est le Potentiel Illimité met au plus N santé par niveau sur les points d'attributs, le dé bonus des niveaux 5, 10, 15 et 20 en plus. La base
// le contrôle par la règle gains_sante_potentiel de v_personnage_controle (migration 0111) ; N est la donnée regle_constante
// `potentiel_illimite.sante_max_par_niveau`. Cette aide donne le plafond et des cas d'essai, tous lus dans la base passée (jamais une valeur écrite ici),
// pour le test de la vue (test/db-0111-relecture-des-regles.test.mjs) et pour celui du moteur de la fiche, qui doit rendre le même verdict.
//
//   CONSTANTE_SANTE_POTENTIEL                l'id de la donnée dans regle_constante.
//   MAGIE_POTENTIEL                          l'id de la magie (le Potentiel Illimité est toujours une magie innée, R176).
//   plafondDeSantePotentiel(db, niveau)      N × (niveaux atteints qui donnent des points d'attributs) + plus grand résultat cumulé des dés bonus atteints.
//   casDeSantePotentiel(db, niveaux?)        [{ niveau, xp, gains_sante, plafond, signale }] : sous le plafond, à sa limite et au-dessus, pour chaque niveau
//                                            (par défaut 1, 4 et 5 : rien à répartir, des points sans dé, le premier dé).

export const CONSTANTE_SANTE_POTENTIEL = 'potentiel_illimite.sante_max_par_niveau';
export const MAGIE_POTENTIEL = 'magies/potentiel-illimite';

/** La santé gagnée au plus par un Potentiel Illimité inné au niveau global `niveau` (les mêmes lectures que la règle de la vue). */
export function plafondDeSantePotentiel(db, niveau) {
  const n = db.prepare('SELECT valeur FROM regle_constante WHERE id = ?').get(CONSTANTE_SANTE_POTENTIEL);
  if (!n) throw new Error(`regle_constante « ${CONSTANTE_SANTE_POTENTIEL} » absente de la base`);
  const niveaux = db.prepare('SELECT count(*) AS k FROM niveau_global WHERE niveau <= ? AND points_attributs IS NOT NULL').get(niveau).k;
  const des = db.prepare('SELECT de_attributs_max_cumul AS d FROM v_niveau WHERE niveau = ?').get(niveau);
  if (!des) throw new Error(`niveau ${niveau} absent de v_niveau`);
  return n.valeur * niveaux + des.d;
}

/** Les cas d'essai : pour chaque niveau, la santé juste sous le plafond (s'il est positif), au plafond et juste au-dessus, avec le verdict attendu. */
export function casDeSantePotentiel(db, niveaux = [1, 4, 5]) {
  return niveaux.flatMap((niveau) => {
    const plafond = plafondDeSantePotentiel(db, niveau);
    const xp = db.prepare('SELECT xp_min FROM niveau_global WHERE niveau = ?').get(niveau).xp_min;
    return [...(plafond > 0 ? [plafond - 1] : []), plafond, plafond + 1]
      .map((gains_sante) => ({ niveau, xp, gains_sante, plafond, signale: gains_sante > plafond }));
  });
}
