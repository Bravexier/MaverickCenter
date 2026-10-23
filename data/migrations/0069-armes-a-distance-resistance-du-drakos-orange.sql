-- 0069-armes-a-distance-resistance-du-drakos-orange : deux décisions du propriétaire du 2026-10-18 (réponses aux questions Q31 et Q27,
-- docs/decisions-regles.md). Migration de STRUCTURE et de DONNÉES.
--   1. R127 (« Arc / arbalète / arme de jet ou Bombe sont bien les 4 types d'armes à distance. ») : arme_famille.categorie, arme de contact ou à
--      distance, dans le vocabulaire de classe_maitrise_arme.categorie ('contact', 'distance'), qu'une maîtrise « arme à distance au choix » (Mage
--      Vert, Barde, Mage, Archimage) ou « arme contact au choix » d'une classe lira (R119 ; la répartition des points de maîtrise, R32, ne la lit pas). Colonne ajoutée en dernier, NULL permis (ARME DE
--      MONSTRES), CHECK des deux valeurs. Les 12 familles, citées par leur id (bandeaux de l'onglet « Armes » de « Ressources et Craft ») :
--        * 'distance' : 'arc' (ARC), 'arbalete' (ARBALÈTE), 'arme-de-jet' (ARME DE JET), 'bombes' (BOMBES) ;
--        * 'contact' : les autres familles maîtrisables, 'epees' (ÉPÉES), 'dagues' (DAGUES), 'masse-marteau' (MASSE/MARTEAU), 'hache' (HACHE),
--          'lance-arme-dhast' (LANCE/ARME D'HAST), 'pugilat' (PUGILAT), 'baton-de-combat' (BÂTON DE COMBAT) ;
--        * NULL : 'arme-de-monstres' (ARME DE MONSTRES, maitrisable = 0 : décision R45, migration 0030). La décision ne classe que les familles
--          maîtrisables, et ce bandeau renvoie chacune de ses armes à sa propre catégorie (« Se référer à la catégorie d'arme ») : aucune valeur
--          n'est juste pour toute la famille, et aucune maîtrise ne s'y met.
--      Le CHECK lie la moitié possible sans reconstruire la table : une famille classée est maîtrisable (« maîtrisable ⇒ classée » ne peut pas
--      s'écrire par ADD COLUMN, toutes les lignes valant NULL à l'ajout : il faudrait reconstruire la table et ses deux vues, v_arme et
--      v_personnage_controle, comme 0030) ; la garde ci-dessous contrôle le tout à la migration, un test de client/ ensuite (relecture expert-sql).
--   2. R124 (Drakos orange, tableau « Écaille draconique », colonne « +1 cran de résistance » : « Au choix parmi les autres » = « au choix entre les
--      bonus de compétence listés des autres possiblité, pareil pour les résistance » ; « Tu peux en avoir un avec +5% Ruse et résisstance Poison ») :
--      la résistance choisie est gardée dans la fiche, table personnage_resistance_choix (section 13), sur le modèle de personnage_acquis_choix, qui
--      garde déjà la compétence (« 5% parmi les autres ») : la source du choix (`source`, la même que celle du choix d'acquis de la ligne, sans clé
--      étrangère), son rang dans la source et l'altération d'état retenue (etat_id → etat), une par choix (clé primaire). Une table à part et non une
--      colonne de personnage_acquis_choix : les deux choix sont indépendants (la compétence y est NOT NULL et dans la clé) ; une table et non une
--      colonne de personnage : le choix suit sa source, comme un choix d'acquis (une ethnie changée laisse un choix sans effet, que la page retire).
--      Une altération d'état et non une magie : les 13 résistances des autres lignes en sont toutes, sans ambiguïté — 12 portent le nom de leur
--      altération (Saignement, Surcharge magique (« Surcharge Magique »), Fatigue, Enragé, Poison, Brûlure, Confusion, Gel, Surdité, Paralysie,
--      Aveuglement, Peur) et « Pétrification » est l'altération « Pétrifié » (rapprochement de l'importeur dans ethnie_resistance) ; chacune est
--      aussi la résistance typée de l'ethnie de sa ligne dans ethnie_resistance (cible_type 'etat', Drakos bordeau à mauve), la même que la
--      cellule. Les options ne sont pas écrites dans la base : la fiche les lit dans les autres lignes du tableau.
-- Les tables des fiches restent vides dans data/rows ; rien ne va dans historique_modification (la migration n'est pas une modification du site de
-- dev). v_personnage_controle ne change pas (pas de règle pour les choix d'acquis non plus : la page garde les options).

-- 1. R127 : arme de contact ou à distance
ALTER TABLE arme_famille ADD COLUMN categorie TEXT CHECK (categorie IS NULL OR (categorie IN ('contact', 'distance') AND maitrisable = 1));

UPDATE arme_famille SET categorie = 'distance' WHERE id IN ('arc', 'arbalete', 'arme-de-jet', 'bombes');
UPDATE arme_famille SET categorie = 'contact'  WHERE id IN ('epees', 'dagues', 'masse-marteau', 'hache', 'lance-arme-dhast', 'pugilat', 'baton-de-combat');

-- garde : 4 familles à distance, 7 de contact, et la seule famille non maîtrisable (ARME DE MONSTRES) sans catégorie ; un id absent ou une famille
-- de plus laisse une famille maîtrisable sans catégorie, et le CHECK de cette table temporaire fait refuser toute la migration
CREATE TEMP TABLE garde_0069 (
  distance       INTEGER NOT NULL CHECK (distance = 4),
  contact        INTEGER NOT NULL CHECK (contact = 7),
  sans_categorie INTEGER NOT NULL CHECK (sans_categorie = 1),
  accordees      INTEGER NOT NULL CHECK (accordees = 12)
);
INSERT INTO garde_0069 SELECT count(*) FILTER (WHERE categorie = 'distance'), count(*) FILTER (WHERE categorie = 'contact'),
  count(*) FILTER (WHERE categorie IS NULL), count(*) FILTER (WHERE (categorie IS NULL) = (maitrisable = 0))
FROM arme_famille;
DROP TABLE garde_0069;

-- 2. R124 : la résistance choisie du Drakos orange
CREATE TABLE personnage_resistance_choix (
  personnage_id  TEXT    NOT NULL REFERENCES personnage(id) ON DELETE CASCADE,
  source         TEXT    NOT NULL CHECK (length(source) > 0),
  rang           INTEGER NOT NULL CHECK (rang >= 1),
  etat_id        TEXT    NOT NULL REFERENCES etat(id),
  PRIMARY KEY (personnage_id, source, rang)
) STRICT, WITHOUT ROWID;
