-- 0091-r184-plan-des-regles : le nouveau plan des pages de règles (décisions R184 et R185, spécification de game-design du 2026-11-06 et son
-- delta). Les rubriques « Créer son personnage », « Les bases » et « Règles avancées » font place à quatre onglets sous la rubrique Règles, après
-- Découvrir et L'univers : Fiche de personnage, Mécaniques générales, Les combats, Exploration, chacun avec son menu latéral.
-- Migration de STRUCTURE et de DONNÉES ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev).
--   1. Le plan, donnée de la base (choix du leader-technique : un lot suivant le rendra modifiable sur le site de dev, par glisser-déposer) :
--      regles_onglet (un onglet, son titre, sa place, sa page d'ouverture) et regles_onglet_entree (une entrée du menu latéral, à son rang : une page
--      guide/…, un lien « Artisanat » vers regles/artisanat/, ou une entrée « bientôt », aucune aujourd'hui). Lignes dans l'ordre des listes de la
--      spécification (§ 1 A, B, D ; « Les combats » et les deux pages nouvelles de Mécaniques générales et d'Exploration : delta R185 § 2).
--   2. Les pages découpées (seize pages nouvelles de R184, sept de R185 : les six étapes de « Créer son personnage » aux ids repris, et dix-sept
--      ids nouveaux), les retouches E1 à E12 et les liens reciblés sont écrits par db:sync-pages AVANT cette migration, dans le même lot : les lignes du
--      plan citent ces pages (clé étrangère contrôlée à la fin de la migration). La migration suppose donc data/rows synchronisé ; elle ne se rejoue
--      pas seule sur des lignes d'avant le lot.
--   3. Six pages retirées, avec leurs lignes d'import (page_source), leurs alias, leurs mots-clés, les sources qu'elles seules citaient et leurs liens
--      (table dérivée, refaite par db:build), retirés d'abord : une migration s'applique clés étrangères coupées (tools/db/maverick.py#migrer), sans
--      cascade. Supprimées (R184 (9) ; leurs adresses mènent à la page 404) : guide/les-documents-des-regles, guide/en-resume-deroulement-d-un-tour,
--      guide/aide-memoire, et guide/mode-hyper-magie (famille annexes, que tools/sheets/annexes-magie.py ne produit plus ; les données
--      mode_hyper_effet de l'onglet masqué restent). Absorbées (leur texte est dans d'autres pages, leurs alias passés par db:sync-pages) :
--      guide/resistance-faiblesse-magie (R184 (7), dans guide/resistances-et-faiblesses) et guide/situations-avancees (R185 (3), répartie en sept
--      pages ; son titre est un alias de guide/prise-en-tenaille-et-zone-d-influence). L'écart d'import de l'en-tête de la table de
--      guide/resistance-faiblesse-magie (« Cible \ Attaque ») est retiré : la table n'est reprise dans aucune page (le tableau des relations de
--      /magies/ la remplace, R185 (4)). Les lignes de historique_modification et de note_version_ligne qui les citent restent : c'est l'historique.
--   4. E7 (R184 (5)) : la note de fin de guide/liste-des-effets-mode-hyper (famille annexes) ne renvoie plus à la page retirée, comme
--      tools/sheets/annexes-magie.py l'écrit désormais.
--   5. Les constantes critique.base (« La réussite critique : de 1 à 5 ») et critique.plafond (« ne dépasse jamais 1 à 15, toutes sources
--      ensemble ») citent une phrase partie de guide/reussir-une-action dans guide/reussites-echecs-et-critiques : regle_constante.page_id, la page
--      qui présente la phrase, suit le texte.

-- 1. Le plan
CREATE TABLE regles_onglet (
  id                TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0 AND id NOT GLOB '*[^a-z0-9-]*' AND id NOT GLOB '*--*' AND id NOT GLOB '-*' AND id NOT GLOB '*-'),
                                                       -- 'fiche-de-personnage', 'mecaniques-generales', 'combats', 'exploration'
  titre             TEXT    NOT NULL CHECK (length(titre) > 0),   -- le nom de l'onglet (« Les combats »)
  ordre             INTEGER NOT NULL CHECK (ordre >= 1),          -- place parmi ces onglets (1 = le premier après L'univers) ; pas UNIQUE, pour qu'un
                                                                  -- réordonnancement puisse échanger deux ordres dans un même lot (à égalité, l'id)
  ouverture_page_id TEXT    NOT NULL,                             -- la page montrée à l'adresse de l'onglet, qui n'est pas forcément la première du menu
                                                                  -- (« Fiche de personnage » ouvre sur guide/creer-son-personnage)
  FOREIGN KEY (id, ouverture_page_id) REFERENCES regles_onglet_entree (onglet_id, page_id) DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE regles_onglet_entree (
  id        TEXT    NOT NULL PRIMARY KEY CHECK (length(id) > 0),
  onglet_id TEXT    NOT NULL REFERENCES regles_onglet(id),
  rang      INTEGER NOT NULL CHECK (rang >= 1),           -- place dans le menu latéral de l'onglet (1 = en haut)
  page_id   TEXT    UNIQUE REFERENCES page(id) ON DELETE CASCADE,   -- la page de l'entrée ; NULL : un lien ou une entrée « bientôt »
  libelle   TEXT    CHECK (libelle IS NULL OR length(libelle) > 0), -- le texte d'un lien ou d'une entrée « bientôt » ; NULL pour une page (son titre)
  adresse   TEXT    CHECK (adresse IS NULL OR (adresse GLOB '[a-z0-9]*/' AND adresse NOT GLOB '*[^a-z0-9/-]*' AND adresse NOT GLOB '*//*')),
                                                          -- l'adresse d'un lien, sans la base ni la barre initiale ('regles/artisanat/') ; NULL sinon
  CHECK ((page_id IS NULL) = (libelle IS NOT NULL)),      -- une page, ou un libellé
  CHECK (adresse IS NULL OR libelle IS NOT NULL),         -- un lien a son libellé
  CHECK (CASE WHEN page_id IS NULL THEN id GLOB 'lien:?*' OR id GLOB 'bientot:?*' ELSE id = 'page:' || page_id END),   -- 'page:<id de la page>', 'lien:…', 'bientot:…'
  CHECK (id NOT GLOB 'lien:*' OR adresse IS NOT NULL),
  CHECK (id NOT GLOB 'bientot:*' OR (adresse IS NULL AND page_id IS NULL)),
  UNIQUE (onglet_id, page_id)                             -- cible de la clé étrangère de la page d'ouverture (regles_onglet)
) STRICT;

INSERT INTO regles_onglet (id, titre, ordre, ouverture_page_id) VALUES
  ('fiche-de-personnage', 'Fiche de personnage', 1, 'guide/creer-son-personnage'),
  ('mecaniques-generales', 'Mécaniques générales', 2, 'guide/reussir-une-action'),
  ('combats', 'Les combats', 3, 'guide/le-tour-de-jeu'),
  ('exploration', 'Exploration', 4, 'guide/la-montee-de-niveau');

INSERT INTO regles_onglet_entree (id, onglet_id, rang, page_id, libelle, adresse) VALUES
  ('page:guide/fiche-personnage', 'fiche-de-personnage', 1, 'guide/fiche-personnage', NULL, NULL),
  ('page:guide/fiche-classe', 'fiche-de-personnage', 2, 'guide/fiche-classe', NULL, NULL),
  ('page:guide/fiche-experience-niveau-global', 'fiche-de-personnage', 3, 'guide/fiche-experience-niveau-global', NULL, NULL),
  ('page:guide/fiche-attributs', 'fiche-de-personnage', 4, 'guide/fiche-attributs', NULL, NULL),
  ('page:guide/fiche-caracteristiques', 'fiche-de-personnage', 5, 'guide/fiche-caracteristiques', NULL, NULL),
  ('page:guide/fiche-competences', 'fiche-de-personnage', 6, 'guide/fiche-competences', NULL, NULL),
  ('page:guide/fiche-capacites-dons', 'fiche-de-personnage', 7, 'guide/fiche-capacites-dons', NULL, NULL),
  ('page:guide/fiche-maitrise-darme-et-armes', 'fiche-de-personnage', 8, 'guide/fiche-maitrise-darme-et-armes', NULL, NULL),
  ('page:guide/fiche-armure-defense-bouclier', 'fiche-de-personnage', 9, 'guide/fiche-armure-defense-bouclier', NULL, NULL),
  ('page:guide/fiche-accessoires-et-ceinture', 'fiche-de-personnage', 10, 'guide/fiche-accessoires-et-ceinture', NULL, NULL),
  ('page:guide/fiche-inventaire-sac-a-dos', 'fiche-de-personnage', 11, 'guide/fiche-inventaire-sac-a-dos', NULL, NULL),
  ('page:guide/fiche-tableau-magie', 'fiche-de-personnage', 12, 'guide/fiche-tableau-magie', NULL, NULL),
  ('page:guide/fiche-tableau-resistances-faiblesses', 'fiche-de-personnage', 13, 'guide/fiche-tableau-resistances-faiblesses', NULL, NULL),
  ('page:guide/fiche-tableau-posture', 'fiche-de-personnage', 14, 'guide/fiche-tableau-posture', NULL, NULL),
  ('page:guide/creer-son-personnage', 'fiche-de-personnage', 15, 'guide/creer-son-personnage', NULL, NULL),
  ('page:guide/choisir-sa-race', 'fiche-de-personnage', 16, 'guide/choisir-sa-race', NULL, NULL),
  ('page:guide/choisir-ses-magies', 'fiche-de-personnage', 17, 'guide/choisir-ses-magies', NULL, NULL),
  ('page:guide/choisir-sa-classe', 'fiche-de-personnage', 18, 'guide/choisir-sa-classe', NULL, NULL),
  ('page:guide/caracteristiques-et-competences', 'fiche-de-personnage', 19, 'guide/caracteristiques-et-competences', NULL, NULL),
  ('page:guide/premiers-sorts', 'fiche-de-personnage', 20, 'guide/premiers-sorts', NULL, NULL),
  ('page:guide/finaliser-son-personnage', 'fiche-de-personnage', 21, 'guide/finaliser-son-personnage', NULL, NULL),
  ('page:guide/alignement', 'fiche-de-personnage', 22, 'guide/alignement', NULL, NULL),
  ('page:guide/les-neuf-alignements', 'fiche-de-personnage', 23, 'guide/les-neuf-alignements', NULL, NULL),
  ('page:guide/reussir-une-action', 'mecaniques-generales', 1, 'guide/reussir-une-action', NULL, NULL),
  ('page:guide/jet-de-des', 'mecaniques-generales', 2, 'guide/jet-de-des', NULL, NULL),
  ('page:guide/reussites-echecs-et-critiques', 'mecaniques-generales', 3, 'guide/reussites-echecs-et-critiques', NULL, NULL),
  ('page:guide/la-magie-en-jeu', 'mecaniques-generales', 4, 'guide/la-magie-en-jeu', NULL, NULL),
  ('page:guide/rater-ses-sortileges', 'mecaniques-generales', 5, 'guide/rater-ses-sortileges', NULL, NULL),
  ('page:guide/resistances-et-faiblesses', 'mecaniques-generales', 6, 'guide/resistances-et-faiblesses', NULL, NULL),
  ('page:guide/alterations-d-etats', 'mecaniques-generales', 7, 'guide/alterations-d-etats', NULL, NULL),
  ('page:guide/liste-des-alterations-d-etat', 'mecaniques-generales', 8, 'guide/liste-des-alterations-d-etat', NULL, NULL),
  ('page:guide/alterations-d-etats-et-mode-hyper', 'mecaniques-generales', 9, 'guide/alterations-d-etats-et-mode-hyper', NULL, NULL),
  ('page:guide/meteo', 'mecaniques-generales', 10, 'guide/meteo', NULL, NULL),
  ('page:guide/le-tour-de-jeu', 'combats', 1, 'guide/le-tour-de-jeu', NULL, NULL),
  ('page:guide/initiative', 'combats', 2, 'guide/initiative', NULL, NULL),
  ('page:guide/attaquer-et-se-defendre', 'combats', 3, 'guide/attaquer-et-se-defendre', NULL, NULL),
  ('page:guide/attaque-et-defense', 'combats', 4, 'guide/attaque-et-defense', NULL, NULL),
  ('page:guide/les-attaques-d-opportunite', 'combats', 5, 'guide/les-attaques-d-opportunite', NULL, NULL),
  ('page:guide/les-attaques-discretes', 'combats', 6, 'guide/les-attaques-discretes', NULL, NULL),
  ('page:guide/l-embuscade', 'combats', 7, 'guide/l-embuscade', NULL, NULL),
  ('page:guide/vitesse-deplacement-et-portee', 'combats', 8, 'guide/vitesse-deplacement-et-portee', NULL, NULL),
  ('page:guide/actions-et-mouvements', 'combats', 9, 'guide/actions-et-mouvements', NULL, NULL),
  ('page:guide/vitesse-et-portee', 'combats', 10, 'guide/vitesse-et-portee', NULL, NULL),
  ('page:guide/prise-en-tenaille-et-zone-d-influence', 'combats', 11, 'guide/prise-en-tenaille-et-zone-d-influence', NULL, NULL),
  ('page:guide/deplacement-ou-sortie-de-la-zone-d-influence', 'combats', 12, 'guide/deplacement-ou-sortie-de-la-zone-d-influence', NULL, NULL),
  ('page:guide/les-degats', 'combats', 13, 'guide/les-degats', NULL, NULL),
  ('page:guide/formule-des-degats', 'combats', 14, 'guide/formule-des-degats', NULL, NULL),
  ('page:guide/les-postures', 'combats', 15, 'guide/les-postures', NULL, NULL),
  ('page:guide/postures', 'combats', 16, 'guide/postures', NULL, NULL),
  ('page:guide/les-boss-et-leurs-postures', 'combats', 17, 'guide/les-boss-et-leurs-postures', NULL, NULL),
  ('page:guide/le-mode-hyper', 'combats', 18, 'guide/le-mode-hyper', NULL, NULL),
  ('page:guide/liste-des-effets-mode-hyper', 'combats', 19, 'guide/liste-des-effets-mode-hyper', NULL, NULL),
  ('page:guide/le-mode-hyper-100', 'combats', 20, 'guide/le-mode-hyper-100', NULL, NULL),
  ('page:guide/le-mode-super', 'combats', 21, 'guide/le-mode-super', NULL, NULL),
  ('page:guide/liste-des-effets-mode-super', 'combats', 22, 'guide/liste-des-effets-mode-super', NULL, NULL),
  ('page:guide/blessures-et-etats', 'combats', 23, 'guide/blessures-et-etats', NULL, NULL),
  ('page:guide/la-montee-de-niveau', 'exploration', 1, 'guide/la-montee-de-niveau', NULL, NULL),
  ('page:guide/s-entrainer-et-exercer-un-metier', 'exploration', 2, 'guide/s-entrainer-et-exercer-un-metier', NULL, NULL),
  ('page:guide/equipement-et-butin', 'exploration', 3, 'guide/equipement-et-butin', NULL, NULL),
  ('page:guide/l-equipement', 'exploration', 4, 'guide/l-equipement', NULL, NULL),
  ('page:guide/mordhau-ou-demi-epee', 'exploration', 5, 'guide/mordhau-ou-demi-epee', NULL, NULL),
  ('page:guide/exercer-un-metier', 'exploration', 6, 'guide/exercer-un-metier', NULL, NULL),
  ('lien:regles/artisanat', 'exploration', 7, NULL, 'Artisanat', 'regles/artisanat/'),
  ('page:guide/les-pieges', 'exploration', 8, 'guide/les-pieges', NULL, NULL),
  ('page:guide/donjon-pas-bon', 'exploration', 9, 'guide/donjon-pas-bon', NULL, NULL),
  ('page:guide/les-portes', 'exploration', 10, 'guide/les-portes', NULL, NULL),
  ('page:guide/distance-et-voyage', 'exploration', 11, 'guide/distance-et-voyage', NULL, NULL);

-- 3. Les six pages retirées
DELETE FROM ecart_source WHERE entite_table = 'page' AND entite_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');
DELETE FROM source
  WHERE id IN (SELECT p.source_id FROM page_source p WHERE p.page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees'))
    AND id NOT IN (SELECT p.source_id FROM page_source p WHERE p.page_id NOT IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees'));
DELETE FROM page_source WHERE page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');
DELETE FROM alias WHERE page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');
DELETE FROM page_tag WHERE page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');
DELETE FROM lien WHERE page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees') OR cible_page_id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');
DELETE FROM page WHERE id IN ('guide/aide-memoire', 'guide/en-resume-deroulement-d-un-tour', 'guide/les-documents-des-regles', 'guide/mode-hyper-magie', 'guide/resistance-faiblesse-magie', 'guide/situations-avancees');

-- 4. E7
UPDATE page SET corps_md = replace(corps_md, 'mode hyper (page « Mode Hyper (Magie) ») ; les', 'mode hyper ; les')
  WHERE id = 'guide/liste-des-effets-mode-hyper';

-- 5. Les phrases de « Réussir une action » que citent deux constantes du critique (R180) sont dans la page des critiques
UPDATE regle_constante SET page_id = 'guide/reussites-echecs-et-critiques' WHERE id IN ('critique.base', 'critique.plafond');
