-- 0085-r173-compteurs-d-actions : décision R173 du propriétaire (docs/decisions-regles.md) : « Il faudrait lister toutes les actions utilisables
-- (dons, accessoire activable(s) directement sous la case de la ceinture. Il faudrai pouvoir les sélectionner pour les "consommer" (et griser si plus
-- utilisable). Un bouton "fin de combat" permet de remettre tous les compteur X/combat au maximum. Le compteur 1/ jour / semainee lui ne peut que
-- remonter manuellement. » ; les compteurs s'enregistrent avec la fiche (un compteur qui ne remonte qu'à la main doit survivre au rechargement).
-- Migration de STRUCTURE (section 13 seulement : data/rows garde les tables des fiches vides ; la base vivante d'un serveur est reconstruite, pas
-- migrée).
--   * personnage_action_usage : une ligne par action dont le compteur est entamé, la clé de l'action (action_id, fabriquée par le moteur de la fiche,
--     sans clé étrangère : l'action dépend de l'équipement porté et de l'état de la fiche) et les utilisations restantes (entier >= 0). Une ligne
--     absente = compteur au maximum (le maximum est une règle, jamais stocké), comme personnage.mode_hyper_semaine NULL (R172) : aucune fiche
--     existante n'a de compteur entamé, la table naît vide. Aucune vue ne change.

CREATE TABLE personnage_action_usage (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  action_id      TEXT    NOT NULL CHECK (length(action_id) > 0),   -- clé de l'action du moteur de la fiche (sans clé étrangère)
  restants       INTEGER NOT NULL CHECK (restants >= 0),           -- utilisations restantes ; ligne absente = au maximum
  PRIMARY KEY (personnage_id, action_id)
) STRICT, WITHOUT ROWID;
