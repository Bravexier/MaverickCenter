-- 0071-sort-prepare-resistances-a-une-magie : décisions du propriétaire du 2026-10-22 (réponses aux questions Q34 et Q43, docs/decisions-regles.md).
-- Migration de DONNÉES et de STRUCTURE (section 13 : data/rows garde les tables des fiches vides).
--   1. R134 (« Ce don va changer. autant l'intégrer dans sa nouvelle version : Donne un NM supplémentaire au sort préparé. Ne peux pas dépasser 3NM ») :
--      l'effet du don « À l'aise » (Mage Vert, spécialité Mage jade, niveau de classe 10 : capacites/mage-vert-a-laise), « Le sort influé aura toujours
--      au minimum un Niveau de Maîtrise. », devient « Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM. » (le texte de la décision).
--      La fiche du don (page capacites/mage-vert-a-laise) suit, comme le service d'édition la refait quand l'effet change (serveur/edition.mjs,
--      CAPACITE.deriver) : son corps (l'effet, le don n'a pas de remarque : lib/corps-classes.mjs#corpsDeDon) et son résumé (l'effet entier, une ligne
--      courte : resumeDeDon) ; ni la page de la classe ni les `donnees` de la fiche du don ne citent l'effet. Chaque UPDATE est gardé par la valeur
--      d'avant, et la garde ci-dessous refuse la migration si l'une ne change pas exactement une ligne. La fiche de personnage lit le nouveau texte
--      (lib/sort-bonus-texte.mjs : +1 NM au sort préparé, au plus 3). La cellule du classeur « Classe Maverick V7 » garde l'ancien texte : entrée
--      `voulus` de tools/sources/ignorer/classe-maverick-v7.json.
--   2. R137 (« Q43: Oui » : comme le Drakos orange, R124) : Ocultomancien « Résilience » (« Augmente de 1 cran la résistance à une magie au choix, à
--      l'exception de l'arcane et de la corruption ») et Anansi d'Arcane (« 1 cran de résistance sur une magie aléatoire (sauf arcane et corruption)
--      et son altération d'état ») deviennent des choix de la fiche : personnage_resistance_choix retient désormais une altération d'état (etat_id,
--      R124) OU une magie (magie_id, colonne ajoutée en dernier ; l'altération de la magie tirée de l'Anansi se lit dans etat_magie par la fiche,
--      jamais gardée). etat_id devient NULL permis, d'où la table reconstruite (NOT NULL ne se retire pas par ALTER TABLE) ; le CHECK exige
--      exactement l'une des deux. Aucune vue ni index ne cite la table ; ses lignes (aucune dans data/rows ; celles d'une base vivante, reconstruite
--      et non migrée : colonnes communes recopiées par serveur/base-vivante.mjs) gardent leur altération.
-- Rien ne va dans historique_modification (la migration n'est pas une modification du site de dev) ; v_personnage_controle ne change pas.

-- 1. R134 : la nouvelle version d'« À l'aise »
CREATE TEMP TABLE garde_0071 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL CHECK (lignes = 1));

UPDATE capacite SET effet = 'Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.'
WHERE id = 'capacites/mage-vert-a-laise' AND effet = 'Le sort influé aura toujours au minimum un Niveau de Maîtrise.';
INSERT INTO garde_0071 VALUES ('capacite', changes());

UPDATE page SET resume = 'Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.',
                corps_md = 'Donne un NM supplémentaire au sort préparé. Ne peut pas dépasser 3 NM.' || char(10)
WHERE id = 'capacites/mage-vert-a-laise' AND resume = 'Le sort influé aura toujours au minimum un Niveau de Maîtrise.'
  AND corps_md = 'Le sort influé aura toujours au minimum un Niveau de Maîtrise.' || char(10);
INSERT INTO garde_0071 VALUES ('page', changes());

DROP TABLE garde_0071;

-- 2. R137 : une résistance au choix retient une altération d'état ou une magie
CREATE TABLE personnage_resistance_choix_0071 (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  source         TEXT    NOT NULL CHECK (length(source) > 0),
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  etat_id        TEXT    REFERENCES etat(id),    -- l'altération d'état retenue (R124) ; NULL pour une magie
  magie_id       TEXT    REFERENCES magie(id),   -- la magie choisie ou tirée (R137, migration 0071) ; NULL pour une altération
  PRIMARY KEY (personnage_id, source, rang),
  CHECK ((etat_id IS NULL) <> (magie_id IS NULL))
) STRICT, WITHOUT ROWID;

INSERT INTO personnage_resistance_choix_0071 (personnage_id, source, rang, etat_id, magie_id)
  SELECT personnage_id, source, rang, etat_id, NULL FROM personnage_resistance_choix;

DROP TABLE personnage_resistance_choix;
ALTER TABLE personnage_resistance_choix_0071 RENAME TO personnage_resistance_choix;
