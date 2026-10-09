-- 0010-mono-magie : bloc « Magie non compatible » du Potentiel Illimité et de la Corruption, et ethnies de la Corruption (décision R15 du propriétaire :
-- « Sur la catégorie "Magie non compatible" du Potentiel illimité, met juste "Mono-magie uniquement" » ; « Pour la magie Corruption remplace le contenu
-- par "Mono-magie uniquement", excepté pour Elfe Noir Charbon et Felfe Noir (l'ajout de l'elfe noir salé est une erreur) »).
-- Migration de STRUCTURE et de DONNÉES.
--   * Structure : colonne magie.mono_magie (1 = ne se combine avec aucune autre magie, sauf pour les ethnies de magie_ethnie_secondaire), placée en dernier.
--     NOT NULL sans valeur par défaut (schema.sql : « jamais de valeur par défaut inventée ») : la table est reconstruite (mêmes colonnes, même index ;
--     aucune vue ne la lit), comme en 0006. Les listes d'incompatibilités (magie_incompatibilite) ne changent pas : le Potentiel Illimité reste
--     incompatible avec les 14 autres magies et la Corruption avec Sang, Arcane, Espace/Temps et Potentiel Illimité ; la phrase de l'onglet de la Corruption
--     (magie.incompatibilite_note) est gardée comme trace. La page d'une magie mono-magie affiche « Mono-magie uniquement » à la place de la liste.
--   * Données : mono_magie = 1 pour le Potentiel Illimité et la Corruption, 0 pour les 13 autres ; l'Elfe Noir Salé, écrit par erreur dans la cellule
--     « Magie secondaire si Race » de la fiche (Magie!U5), est retiré des ethnies de la Corruption (la phrase de l'onglet ne cite que les Elfes noirs
--     Charbon et les Felfes noirs) ; le Felfe Noir passe au rang 2.

CREATE TABLE magie__0010 (
  id                    TEXT    NOT NULL PRIMARY KEY REFERENCES page(id),   -- = id de la page (entité typée qui a SA page)
  nom                   TEXT    NOT NULL UNIQUE CHECK (length(nom) > 0),    -- nom court tel qu'écrit dans les listes de résistances et d'incompatibilités :
                                                    -- 'Sang', 'Espace/Temps', 'Potentiel Illimité' (onglet « Magie » de la fiche)
  nom_cle               TEXT    NOT NULL UNIQUE CHECK (nom_cle NOT GLOB '*[^a-z0-9-]*' AND nom_cle NOT GLOB '*--*' AND nom_cle NOT GLOB '-*' AND nom_cle NOT GLOB '*-'),    -- normalize(nom) comme text.mjs : 'sang', 'espace-temps', 'potentiel-illimite'
  onglet                TEXT    NOT NULL,           -- nom exact de l'onglet du classeur V8 (le dump tronque 'Potentiel illimité (magie diffi')
  ordre                 INTEGER NOT NULL UNIQUE CHECK (ordre >= 1),   -- rang de l'onglet dans le classeur (1 = Potentiel illimité)
  banniere              TEXT,                       -- texte d'avertissement de la bannière d'en-tête (Potentiel : « MAGIE DIFFICILE A JOUER !! »)
  description           TEXT,                       -- texte d'introduction (A4), paragraphes séparés par des lignes vides
  description_physique  TEXT,                       -- bloc « Description physique »
  explication           TEXT,                       -- bloc « Explication » (Arcane, Corruption, Potentiel Illimité seulement)
  sante_offerte         INTEGER CHECK (sante_offerte >= 0),   -- « Santé offert » (valeurs entières dans la source)
  chakra_offert         INTEGER CHECK (chakra_offert >= 0),   -- « Chakra offert »
  caracteristique_id    TEXT    REFERENCES caracteristique(id),   -- « Caractéritiques bonus » reconnue ; NULL pour « AU CHOIX ou ALEATOIRE »
  caracteristique_brut  TEXT,                       -- cellule telle qu'écrite (« FORCE », « AU CHOIX ou ALEATOIRE »)
  barre4_ressource      TEXT    CHECK (barre4_ressource IN ('sang', 'ame')),   -- ressource de la « 4ème barre » (Sang, Nécromancie) ; NULL = pas de 4ème barre
  barre4_texte          TEXT,                       -- cellule « 4ème barre » telle qu'écrite
  barre4_max            INTEGER,                    -- « maximum de 10 Sang » : extrait du texte ci-dessus (NULL si la forme ne correspond pas)
  barre4_regen          INTEGER,                    -- « la régénère de 1 par tour » : idem
  incompatibilite_note  TEXT,                       -- bloc « Magie non compatible » quand ce n'est PAS une liste de noms de magies (Corruption : phrase de la source,
                                                    -- gardée comme trace : la page affiche « Mono-magie uniquement », voir mono_magie)
  origine               TEXT    NOT NULL REFERENCES famille(id)
    CHECK (origine = 'magies'),
  source_ref            TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque TEXT,   -- remarque ou information supplémentaire (texte libre, vide par défaut) ; reprend les notes de cellule du classeur de la ligne
  mono_magie            INTEGER NOT NULL CHECK (mono_magie IN (0, 1)),   -- 1 = « Mono-magie uniquement » : ne se combine avec aucune autre magie, sauf pour les
                                                    -- ethnies de magie_ethnie_secondaire (décision R15 du propriétaire : Potentiel Illimité et Corruption ; migration 0010)
  CHECK ((barre4_ressource IS NULL) = (barre4_texte IS NULL))
) STRICT;
INSERT INTO "magie__0010" ("id", "nom", "nom_cle", "onglet", "ordre", "banniere", "description", "description_physique", "explication", "sante_offerte", "chakra_offert", "caracteristique_id", "caracteristique_brut", "barre4_ressource", "barre4_texte", "barre4_max", "barre4_regen", "incompatibilite_note", "origine", "source_ref", "remarque", "mono_magie") SELECT "id", "nom", "nom_cle", "onglet", "ordre", "banniere", "description", "description_physique", "explication", "sante_offerte", "chakra_offert", "caracteristique_id", "caracteristique_brut", "barre4_ressource", "barre4_texte", "barre4_max", "barre4_regen", "incompatibilite_note", "origine", "source_ref", "remarque", CASE WHEN "id" IN ('magies/potentiel-illimite', 'magies/magie-de-la-corruption') THEN 1 ELSE 0 END FROM "magie";
DROP TABLE "magie";
ALTER TABLE "magie__0010" RENAME TO "magie";
CREATE INDEX magie_caracteristique ON magie (caracteristique_id) WHERE caracteristique_id IS NOT NULL;

DELETE FROM magie_ethnie_secondaire
WHERE magie_id = 'magies/magie-de-la-corruption' AND ethnie_id = 'races/elfe-noir#ethnie:elfe-noir-sale' AND ethnie_brut = 'Elfe Noir Salé';
UPDATE magie_ethnie_secondaire SET rang = 2
WHERE magie_id = 'magies/magie-de-la-corruption' AND ethnie_id = 'races/felfe#ethnie:felfe-noir' AND rang = 3;
