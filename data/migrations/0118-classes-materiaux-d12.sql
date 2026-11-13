-- Migration 0118 : Classes, matériaux d'armes et limite D12 de la mise à jour de Décembre (lot 3) : décisions R238, R241, R252 (et R10 pour les coquilles,
-- R237 (1) : le classeur fait foi ; R224 (1) : dans une copie de source, seule la phrase fausse se corrige). Migration de DONNÉES et d'une VUE (sections 1,
-- 2, 3, 6, 7, 9, 10 et 13 ; PRAGMA user_version 117 -> 118) ; rien ne va dans historique_modification. Registre : 0118-classes-materiaux-d12.json.
-- Source des classes : la pièce jointe du propriétaire « Nouveauté mise à jour Décembre.xlsx » (sha256 e89fc4be…), instantané
-- sources/raw/classeurs/magie-maverick-v10.json, onglets 23 « Porte-étendard », 24 « Boxeur », 25 « Cuirassé V2 », cités « Nouveauté mise à jour Décembre ›
-- <onglet> › <plage> » ; lignes du plan de tech-sources (textes après les coquilles R10 de tools/sheets/corrections.json, section magie-v10). Générée par un
-- script du lot (hors dépôt) depuis ce plan et la base à la version 117 : corps et résumés des pages par lib/corps-classes.mjs, lib/corps-races.mjs,
-- lib/corps-magies.mjs et lib/corps-armes.mjs, page.donnees des dons par lib/dons-edition.mjs#donneesDeDon, découpages par lib/classe-champs.mjs, sources
-- de maîtrise par lib/maitrise-arme.mjs (serveur/edition-maitrises.mjs), effets des matériaux relus par lib/arme-champs.mjs#analyserEffetDeMateriau.
--   - R238 (1) : Boxeur et Porte-étendard (« Classe Physique Corps à Corps », en fin de colonne : ordre 13 et 14, les suivants +2) ; 34 dons, 4 spécialités ;
--     ouverts aux 27 races (race_classe, colonnes 40 et 41) ; « Classes accessibles » des pages de race ; guide/l-univers (41 classes, 82 spécialités).
--   - R238 (2) : Cuirassé V2 : Large supprimé, Appui à Protecteur niveau 20 (même id), Écrasant (Vindicatif niveau 15), Nanochakra, armure de départ.
--   - R238 (3) : le Parleur en « Classe spéciale » (ordre 11 inchangé ; mot-clé de catégorie de sa page).
--   - R238 (4) : Archimage, « 1 maîtrise arme de contact au choix » (part à choisir sur les 7 familles de contact de R127).
--   - R238 (5) : règle classe_imposee retirée de v_personnage_controle ; « Classe unique = Archimage. » retirée du Potentiel Illimité ; guide/choisir-sa-classe.
--   - R241 : effets secondaires des matériaux d'armes (docx), Titane sans cran ; phrases du glossaire et du guide qui leur prêtaient les anciens effets de barrière.
--   - R252 : « pas plus haut que le D20 » -> « D12 » (posture Focus et sa copie) ; échelle des pages du guide.
-- Les fiches (section 13, vides dans data/rows) ne sont pas touchées ici : à la livraison, serveur/fiches-retraits.mjs#retirerLesManquants retire Large des
-- fiches (un id absent de `capacite`, note datée, R42). Appui (même id, autre spécialité) chez les Vindicatifs et le choix remis au joueur de la maîtrise de
-- l'Archimage (R148, note datée) demandent le code du service (voir le registre, `fiches`).
-- La garde : chaque UPDATE ou DELETE doit toucher le nombre de lignes attendu ; un texte ne se remplace que par un fragment présent une seule fois. Une
-- valeur que le site de dev aurait réécrite arrête la migration.

CREATE TEMP TABLE garde_0118 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 1. classe.ordre : le Boxeur (13) et le Porte-étendard (14) en fin de colonne « Classe Physique Corps à Corps », après le Bimane (12) (R238 (1)) ;
--    les classes d'ordre 13 et plus (Archer … Archimage) avancent de 2, leur ordre relatif ne change pas (UNIQUE : en deux temps). Le Parleur garde le 11.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE classe SET ordre = ordre + 1000 WHERE ordre >= 13;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('classe.ordre : décalage (1)', changes(), 27);
UPDATE classe SET ordre = ordre - 998 WHERE ordre >= 1013;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('classe.ordre : décalage (2)', changes(), 27);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 2. Nouvelles classes (R238 (1)) : Boxeur (onglet 24) et Porte-étendard (onglet 23), « Classe Physique Corps à Corps » ; pages, mots-clés de page
--    (Classe, càc, capacité de classe : existants), classe, spécialités, dons, objets et maîtrises de départ, sources de maîtrise d'arme.
-- --------------------------------------------------------------------------------------------------------------------------------------------
-- classes/boxeur
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('classes/boxeur', 'classes', 'boxeur', 'Boxeur', 'boxeur', 'Le Boxeur est un combattant spécialisé dans le pugilat, qui transforme ses poings et son bouclier en véritables armes.', NULL, '**Catégorie** : Classe Physique Corps à Corps

## Description Boxeur

Le Boxeur est un combattant spécialisé dans le pugilat, qui transforme ses poings et son bouclier en véritables armes. Robuste et tenace, il privilégie le combat rapproché et sait encaisser les coups tout en maintenant la pression sur ses adversaires.

Grâce à sa maîtrise du bouclier, il renforce ses frappes et sa résistance au combat. Son rôle est de tenir la ligne, repousser ses ennemis et leur faire comprendre que même un bouclier peut devenir une arme redoutable quand il est entre ses mains d''expert.

## Don de départ

| Santé | Chakra | Barrière |
| --- | --- | --- |
| 8.0 | 2.0 | 0.0 |

### Maîtrise Arme

- 1 maîtrise Pugilat

### Maîtrise Armures

- Légère
- Bouclier classe 1 à 4

## Inventaire de départ

P fiole rouge, KDR Armure, briquet, bandage (x2), corde (x5)

### Arme de départ

Gants en Acier

### Armure de départ

Écu de bois

## Sous-classes

### CARCASSE ROUILLÉE

#### Description Carcasse rouillée

La Carcasse Rouillée est un combattant lourdement cuirassé, capable d''encaisser les assauts les plus violents sans fléchir. Peu mobile et difficile à déplacer, il privilégie la résistance brute et l''endurance plutôt que l''agilité.

Son armure absorbe une partie des dégâts et le protège des altérations d''état. Même à terre, il reste au sommet de sa défense. Son rôle est d''être un rempart presque inébranlable, capable d''épuiser ses adversaires à force d''encaisser leurs assauts.

### PERCUTEUR

#### Description Percuteur

Le Percuteur est un combattant brutal spécialisé dans les attaques au bouclier et les frappes de pugilat. Il mise sur sa force et son impact pour déstabiliser ses adversaires plutôt que de chercher à les blesser directement.

Ses coups peuvent déséquilibrer, affaiblir et repousser ses ennemis, ouvrant ainsi des opportunités pour ses alliés. Son rôle est de briser les formations adverses, perturber leurs mouvements et maintenir la pression au cœur de la mêlée.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-bouclier-dattaque', 'capacites', 'boxeur-bouclier-dattaque', 'Bouclier d''attaque (Boxeur)', 'bouclier-dattaque-boxeur', 'Permet d''utiliser son bouclier comme une extension de dégâts pour les pugilats pour infliger un dégât bonus de AP+AM du bouclier divisé par 4 (minimum 1).', '{"classe": "classes/boxeur", "niveau": 1, "nature": "classe", "rang": 1, "ligne": 4, "type_capacite": "Passif"}', 'Permet d''utiliser son bouclier comme une extension de dégâts pour les pugilats pour infliger un dégât bonus de AP+AM du bouclier divisé par 4 (minimum 1).
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-mur', 'capacites', 'boxeur-mur', 'Mur (Boxeur)', 'mur-boxeur', 'Les boucliers donnent +2AP et AM.', '{"classe": "classes/boxeur", "niveau": 5, "nature": "classe", "rang": 2, "ligne": 11, "type_capacite": "Passif"}', 'Les boucliers donnent +2AP et AM.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-carcasse-rouillee', 'capacites', 'boxeur-carcasse-rouillee', 'Carcasse rouillée (Boxeur)', 'carcasse-rouillee-boxeur', '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade, Maîtrise les armures lourdes.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 10, "nature": "specialite", "rang": 1, "ligne": 22, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-percuteur"]}', '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade, Maîtrise les armures lourdes.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-percuteur', 'capacites', 'boxeur-percuteur', 'Percuteur (Boxeur)', 'percuteur-boxeur', '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 10, "nature": "specialite", "rang": 2, "ligne": 22, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-carcasse-rouillee"]}', '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-armure-vivante', 'capacites', 'boxeur-armure-vivante', 'Armure vivante (Boxeur)', 'armure-vivante-boxeur', 'La première fois qu''il subit des dégâts pendant le tour : Réduit les dégâts de 3 après l''armure.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 10, "nature": "choix", "rang": 1, "ligne": 29, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-poids-mort"]}', 'La première fois qu''il subit des dégâts pendant le tour : Réduit les dégâts de 3 après l''armure. Doit porter une armure lourde.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-poids-mort', 'capacites', 'boxeur-poids-mort', 'Poids mort (Boxeur)', 'poids-mort-boxeur', 'Tant qu''il porte une armure lourde, ne peut pas être déplacé physiquement sauf par un monstre de plus grande taille.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 10, "nature": "choix", "rang": 2, "ligne": 29, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-armure-vivante"]}', 'Tant qu''il porte une armure lourde, ne peut pas être déplacé physiquement sauf par un monstre de plus grande taille.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-bourage', 'capacites', 'boxeur-bourage', 'Bouragé (Boxeur)', 'bourage-boxeur', 'Inflige un bonus de 2 dégâts aux attaques de pugilat avec les boucliers par poids du bouclier.', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 10, "nature": "choix", "rang": 1, "ligne": 29, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-bouquilibre"]}', 'Inflige un bonus de 2 dégâts aux attaques de pugilat avec les boucliers par poids du bouclier.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-bouquilibre', 'capacites', 'boxeur-bouquilibre', 'Bouquilibre (Boxeur)', 'bouquilibre-boxeur', 'Une attaque réussie impose à l''ennemi un désavantage à son prochain jet de stabilité/réflexe', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 10, "nature": "choix", "rang": 2, "ligne": 29, "type_capacite": "Actif (2 fois/combat)", "choix_exclusif_avec": ["capacites/boxeur-bourage"]}', 'Une attaque réussie impose à l''ennemi un désavantage à son prochain jet de stabilité/réflexe
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-etourdissement', 'capacites', 'boxeur-etourdissement', 'Étourdissement (Boxeur)', 'etourdissement-boxeur', 'Les coups avec des armes de pugilats avec un bouclier ont 5% de chance d''étourdir l''ennemi.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-endurouille"]}', 'Les coups avec des armes de pugilats avec un bouclier ont 5% de chance d''étourdir l''ennemi.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-endurouille', 'capacites', 'boxeur-endurouille', 'Endurouille (Boxeur)', 'endurouille-boxeur', 'Tant qu''il porte une armure lourde, réduit d''un tour les altérations d''états infligés.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-etourdissement"]}', 'Tant qu''il porte une armure lourde, réduit d''un tour les altérations d''états infligés.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-boupact', 'capacites', 'boxeur-boupact', 'Boupact (Boxeur)', 'boupact-boxeur', 'Attaque en ciblant une partie du corps, si l''attaque réussit : divise par 2 donné par l''armure lors de la prochaine attaque subit.', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Action (1 fois/combat)", "choix_exclusif_avec": ["capacites/boxeur-bousee"]}', 'Attaque en ciblant une partie du corps, si l''attaque réussit : divise par 2 donné par l''armure lors de la prochaine attaque subit.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-bousee', 'capacites', 'boxeur-bousee', 'Bousée (Boxeur)', 'bousee-boxeur', 'Une attaque réussie impose un malus au jet d''attaque de l''ennemi de 10% pour son tour.', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Actif (2 fois/combat)", "choix_exclusif_avec": ["capacites/boxeur-boupact"]}', 'Une attaque réussie impose un malus au jet d''attaque de l''ennemi de 10% pour son tour.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-posture-inebran', 'capacites', 'boxeur-posture-inebran', 'Posture inébran (Boxeur)', 'posture-inebran-boxeur', '5% stabilité, bénéficie d''un avantage lors des jets de cette compétence.', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Réaction (2 fois/combat)", "choix_exclusif_avec": ["capacites/boxeur-posture-durgence"]}', '5% stabilité, bénéficie d''un avantage lors des jets de cette compétence.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-posture-durgence', 'capacites', 'boxeur-posture-durgence', 'Posture d''urgence (Boxeur)', 'posture-durgence-boxeur', 'Si tombe à terre : se met automatiquement en défense', '{"classe": "classes/boxeur", "specialite": "CARCASSE ROUILLÉE", "niveau": 20, "nature": "choix", "rang": 2, "ligne": 43, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-posture-inebran"]}', 'Si tombe à terre : se met automatiquement en défense
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-boucassant', 'capacites', 'boxeur-boucassant', 'Boucassant (Boxeur)', 'boucassant-boxeur', 'Les attaques de pugilats avec un bouclier ignorent 1AP par poids du bouclier.', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/boxeur-bouvasteur"]}', 'Les attaques de pugilats avec un bouclier ignorent 1AP par poids du bouclier.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-bouvasteur', 'capacites', 'boxeur-bouvasteur', 'Bouvasteur (Boxeur)', 'bouvasteur-boxeur', 'Une attaque réussie impose à l''ennemi un jet de stabilité/réflexe pour ne pas tomber à terre.', '{"classe": "classes/boxeur", "specialite": "PERCUTEUR", "niveau": 20, "nature": "choix", "rang": 2, "ligne": 43, "type_capacite": "Actif (2 fois/combat)", "choix_exclusif_avec": ["capacites/boxeur-boucassant"]}', 'Une attaque réussie impose à l''ennemi un jet de stabilité/réflexe pour ne pas tomber à terre.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/boxeur-egide-dassaut', 'capacites', 'boxeur-egide-dassaut', 'Égide d''assaut (Boxeur)', 'egide-dassaut-boxeur', 'La division pour « bouclier d''attaque » est de 3 au lieu de 4.', '{"classe": "classes/boxeur", "niveau": 20, "nature": "classe", "rang": 3, "ligne": 49, "type_capacite": "Passif"}', 'La division pour « bouclier d''attaque » est de 3 au lieu de 4.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Boxeur »');
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('classes/boxeur', 0, 66);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('classes/boxeur', 1, 51);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-bouclier-dattaque', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-mur', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-carcasse-rouillee', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-percuteur', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-armure-vivante', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-poids-mort', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-bourage', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-bouquilibre', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-etourdissement', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-endurouille', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-boupact', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-bousee', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-posture-inebran', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-posture-durgence', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-boucassant', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-bouvasteur', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/boxeur-egide-dassaut', 0, 54);
INSERT INTO classe (id, nom, nom_cle, categorie_id, ordre, sante_depart, chakra_depart, barriere_depart, maitrise_arme, maitrise_armure, bouclier_classe_max, inventaire_depart, arme_depart, armure_depart, chose_a_savoir, chose_a_savoir_lien, description_titre, description, origine, source_ref, remarque, magie_innee_id, magie_innee_exclue_id) VALUES ('classes/boxeur', 'Boxeur', 'boxeur', 'classe-physique-corps-a-corps', 13, 8, 2, 0, '- 1 maîtrise Pugilat', '- Légère
- Bouclier classe 1 à 4', 4, 'P fiole rouge, KDR Armure, briquet, bandage (x2), corde (x5)', 'Gants en Acier', 'Écu de bois', NULL, NULL, 'Description Boxeur', 'Le Boxeur est un combattant spécialisé dans le pugilat, qui transforme ses poings et son bouclier en véritables armes. Robuste et tenace, il privilégie le combat rapproché et sait encaisser les coups tout en maintenant la pression sur ses adversaires.

Grâce à sa maîtrise du bouclier, il renforce ses frappes et sa résistance au combat. Son rôle est de tenir la ligne, repousser ses ennemis et leur faire comprendre que même un bouclier peut devenir une arme redoutable quand il est entre ses mains d''expert.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A2:L13, AM1:BA12', NULL, NULL, NULL);
INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, description_titre, description, origine, source_ref, remarque) VALUES ('classes/boxeur#specialite:carcasse-rouillee', 'classes/boxeur', 1, 'CARCASSE ROUILLÉE', 'carcasse-rouillee', 'Description Carcasse rouillée', 'La Carcasse Rouillée est un combattant lourdement cuirassé, capable d''encaisser les assauts les plus violents sans fléchir. Peu mobile et difficile à déplacer, il privilégie la résistance brute et l''endurance plutôt que l''agilité.

Son armure absorbe une partie des dégâts et le protège des altérations d''état. Même à terre, il reste au sommet de sa défense. Son rôle est d''être un rempart presque inébranlable, capable d''épuiser ses adversaires à force d''encaisser leurs assauts.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A17:M19, AM17:BA29', NULL);
INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, description_titre, description, origine, source_ref, remarque) VALUES ('classes/boxeur#specialite:percuteur', 'classes/boxeur', 2, 'PERCUTEUR', 'percuteur', 'Description Percuteur', 'Le Percuteur est un combattant brutal spécialisé dans les attaques au bouclier et les frappes de pugilat. Il mise sur sa force et son impact pour déstabiliser ses adversaires plutôt que de chercher à les blesser directement.

Ses coups peuvent déséquilibrer, affaiblir et repousser ses ennemis, ouvrant ainsi des opportunités pour ses alliés. Son rôle est de briser les formations adverses, perturber leurs mouvements et maintenir la pression au cœur de la mêlée.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X17:AJ19, AM31:BA43', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-bouclier-dattaque', 'classes/boxeur', NULL, 1, 'classe', 4, 1, 'Bouclier d''attaque', 'bouclier-dattaque', 'passif', 'Passif', NULL, NULL, 'Permet d''utiliser son bouclier comme une extension de dégâts pour les pugilats pour infliger un dégât bonus de AP+AM du bouclier divisé par 4 (minimum 1).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › P4:U9', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-mur', 'classes/boxeur', NULL, 5, 'classe', 11, 1, 'Mur', 'mur', 'passif', 'Passif', NULL, NULL, 'Les boucliers donnent +2AP et AM.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › P11:U16', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-carcasse-rouillee', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 10, 'specialite', 22, 1, 'Carcasse rouillée', 'carcasse-rouillee', 'passif', 'Passif', NULL, NULL, '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade, Maîtrise les armures lourdes.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › D22:J27', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-percuteur', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 10, 'specialite', 22, 1, 'Percuteur', 'percuteur', 'passif', 'Passif', NULL, NULL, '+2 points de maîtrise à répartir, +5% Arme lourde, +10% Parade', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AA22:AG27', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-armure-vivante', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 10, 'choix', 29, 1, 'Armure vivante', 'armure-vivante', 'passif', 'Passif', NULL, NULL, 'La première fois qu''il subit des dégâts pendant le tour : Réduit les dégâts de 3 après l''armure. Doit porter une armure lourde.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A29:F34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-poids-mort', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 10, 'choix', 29, 2, 'Poids mort', 'poids-mort', 'passif', 'Passif', NULL, NULL, 'Tant qu''il porte une armure lourde, ne peut pas être déplacé physiquement sauf par un monstre de plus grande taille.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › H29:M34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-bourage', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 10, 'choix', 29, 1, 'Bouragé', 'bourage', 'passif', 'Passif', NULL, NULL, 'Inflige un bonus de 2 dégâts aux attaques de pugilat avec les boucliers par poids du bouclier.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X29:AC34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-bouquilibre', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 10, 'choix', 29, 2, 'Bouquilibre', 'bouquilibre', 'actif', 'Actif (2 fois/combat)', 2, 'combat', 'Une attaque réussie impose à l''ennemi un désavantage à son prochain jet de stabilité/réflexe', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE29:AJ34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-etourdissement', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 15, 'choix', 36, 1, 'Étourdissement', 'etourdissement', 'passif', 'Passif', NULL, NULL, 'Les coups avec des armes de pugilats avec un bouclier ont 5% de chance d''étourdir l''ennemi.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A36:F41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-endurouille', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 15, 'choix', 36, 2, 'Endurouille', 'endurouille', 'passif', 'Passif', NULL, NULL, 'Tant qu''il porte une armure lourde, réduit d''un tour les altérations d''états infligés.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › H36:M41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-boupact', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 15, 'choix', 36, 1, 'Boupact', 'boupact', 'action', 'Action (1 fois/combat)', 1, 'combat', 'Attaque en ciblant une partie du corps, si l''attaque réussit : divise par 2 donné par l''armure lors de la prochaine attaque subit.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X36:AC41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-bousee', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 15, 'choix', 36, 2, 'Bousée', 'bousee', 'actif', 'Actif (2 fois/combat)', 2, 'combat', 'Une attaque réussie impose un malus au jet d''attaque de l''ennemi de 10% pour son tour.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE36:AJ41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-posture-inebran', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 20, 'choix', 43, 1, 'Posture inébran', 'posture-inebran', 'reaction', 'Réaction (2 fois/combat)', 2, 'combat', '5% stabilité, bénéficie d''un avantage lors des jets de cette compétence.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A43:F48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-posture-durgence', 'classes/boxeur', 'classes/boxeur#specialite:carcasse-rouillee', 20, 'choix', 43, 2, 'Posture d''urgence', 'posture-durgence', 'passif', 'Passif', NULL, NULL, 'Si tombe à terre : se met automatiquement en défense', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › H43:M48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-boucassant', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 20, 'choix', 43, 1, 'Boucassant', 'boucassant', 'passif', 'Passif', NULL, NULL, 'Les attaques de pugilats avec un bouclier ignorent 1AP par poids du bouclier.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X43:AC48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-bouvasteur', 'classes/boxeur', 'classes/boxeur#specialite:percuteur', 20, 'choix', 43, 2, 'Bouvasteur', 'bouvasteur', 'actif', 'Actif (2 fois/combat)', 2, 'combat', 'Une attaque réussie impose à l''ennemi un jet de stabilité/réflexe pour ne pas tomber à terre.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE43:AJ48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/boxeur-egide-dassaut', 'classes/boxeur', NULL, 20, 'classe', 49, 1, 'Égide d''assaut', 'egide-dassaut', 'passif', 'Passif', NULL, NULL, 'La division pour « bouclier d''attaque » est de 3 au lieu de 4.', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › P49:U54', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('classe', 'classes/boxeur', 'classes/boxeur', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('specialite', 'classes/boxeur#specialite:carcasse-rouillee', 'classes/boxeur', 0, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('specialite', 'classes/boxeur#specialite:percuteur', 'classes/boxeur', 0, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-bouclier-dattaque', 'capacites/boxeur-bouclier-dattaque', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-mur', 'capacites/boxeur-mur', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-carcasse-rouillee', 'capacites/boxeur-carcasse-rouillee', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-percuteur', 'capacites/boxeur-percuteur', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-armure-vivante', 'capacites/boxeur-armure-vivante', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-poids-mort', 'capacites/boxeur-poids-mort', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-bourage', 'capacites/boxeur-bourage', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-bouquilibre', 'capacites/boxeur-bouquilibre', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-etourdissement', 'capacites/boxeur-etourdissement', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-endurouille', 'capacites/boxeur-endurouille', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-boupact', 'capacites/boxeur-boupact', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-bousee', 'capacites/boxeur-bousee', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-posture-inebran', 'capacites/boxeur-posture-inebran', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-posture-durgence', 'capacites/boxeur-posture-durgence', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-boucassant', 'capacites/boxeur-boucassant', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-bouvasteur', 'capacites/boxeur-bouvasteur', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/boxeur-egide-dassaut', 'capacites/boxeur-egide-dassaut', 1, 'classes');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/boxeur', 1, 1, 'P fiole rouge', 'ressources/objets-de-depart-des-classes#objet:p-fiole-rouge', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/boxeur', 2, 1, 'KDR Armure', 'ressources/objets-de-depart-des-classes#objet:kdr-armure', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/boxeur', 3, 1, 'briquet', 'ressources/objets-de-depart-des-classes#objet:briquet', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/boxeur', 4, 1, 'bandage (x2)', 'ressources/objets-de-depart-des-classes#objet:bandage', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/boxeur', 5, 1, 'corde (x5)', NULL, 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G3:L5');
INSERT INTO classe_maitrise_armure (classe_id, rang, brut, objet, poids_min, poids_max, classe_min, classe_max, origine, source_ref) VALUES ('classes/boxeur', 1, 'Légère', 'armure', 'Légère', 'Légère', NULL, NULL, 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A11:F13');
INSERT INTO classe_maitrise_armure (classe_id, rang, brut, objet, poids_min, poids_max, classe_min, classe_max, origine, source_ref) VALUES ('classes/boxeur', 2, 'Bouclier classe 1 à 4', 'bouclier', NULL, NULL, 1, 4, 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A11:F13');
INSERT INTO classe_maitrise_arme (classe_id, rang, brut, forme, nombre, arme, arme_cle, categorie, sauf, sauf_cle, origine, source_ref) VALUES ('classes/boxeur', 1, '1 maîtrise Pugilat', 'nommee', 1, 'Pugilat', 'pugilat', NULL, NULL, NULL, 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A7:F9');
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('classes/boxeur#maitrise-arme:1', 1, NULL, 'classes/boxeur', 1, 'imposee', 1, 'pugilat', NULL);
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'capacites/boxeur-carcasse-rouillee', NULL, NULL, 'choix', 2, NULL, NULL);
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('capacites/boxeur-percuteur', 1, 'capacites/boxeur-percuteur', NULL, NULL, 'choix', 2, NULL, NULL);
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'lance-arme-dhast');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'baton-de-combat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'arme-de-jet');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'arc');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'arbalete');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-carcasse-rouillee', 1, 'bombes');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'lance-arme-dhast');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'baton-de-combat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'arme-de-jet');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'arc');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'arbalete');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/boxeur-percuteur', 1, 'bombes');

-- classes/porte-etendard
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('classes/porte-etendard', 'classes', 'porte-etendard', 'Porte-étendard', 'porte-etendard', 'Le Porte-Étendard est un meneur de guerre qui galvanise ses compagnons par sa présence et sa détermination.', NULL, '**Catégorie** : Classe Physique Corps à Corps

## Description Porte-Étendard

Le Porte-Étendard est un meneur de guerre qui galvanise ses compagnons par sa présence et sa détermination. Équipé d''une lance et d''une armure robuste, il sait tenir sa position tout en incarnant un symbole de courage et de cohésion pour ceux qui combattent à ses côtés.

Sa force réside dans sa capacité à motiver ses alliés, renforçant temporairement leurs performances et leur détermination. Tant qu''il reste debout, sa présence inspire confiance et résilience à ses compagnons, leur permettant de garder leur sang-froid face à l''adversité.

Son rôle est de maintenir le moral des troupes, fédérer ses alliés et transformer une simple troupe en une véritable force de combat.

## Don de départ

| Santé | Chakra | Barrière |
| --- | --- | --- |
| 5.0 | 0.0 | 5.0 |

### Maîtrise Arme

- 1 maîtrise Hast
- 1 maîtrise dans une arme contact au choix (sauf Hast)

### Maîtrise Armures

- Légère à Intermédiaire

## Inventaire de départ

P fiole rouge, KDR Arme, KDR Armure, briquet, lanterne

### Arme de départ

Lance en acier

### Armure de départ

Armure de fer complet

## Sous-classes

### CHEF DE GUERRE

#### Description Chef de guerre

Le Chef de Guerre est un meneur tactique qui dirige ses compagnons au cœur de la bataille. Commandant, il sait exploiter les forces de chacun pour transformer son groupe en une unité redoutable. Sa présence impose le respect et inspire confiance à ceux qui combattent sous ses ordres.

Son aura renforce les capacités de ses alliés, qu''ils soient combattants ou utilisateurs de magie. Attentif au danger, il sait protéger ses compagnons, coordonner leurs mouvements et désorganiser les rangs ennemis. Son rôle est de diriger le combat et faire de la cohésion du groupe sa plus grande arme.

### STRATÈGE DE BATAILLE

#### Description Stratège de bataille

Le Stratège de Bataille est un combattant analytique qui observe le champ de bataille et exploite chaque opportunité. Maître de l''adaptation, il sait ajuster sa posture selon la situation pour prendre l''avantage sur ses adversaires.

Grâce à son sens tactique, il renforce les actions de ses alliés, exploite les faiblesses ennemies et adapte sa défense ou son offensive à chaque instant. Son rôle est de contrôler le rythme du combat et faire pencher la balance en faveur de son groupe.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-motivation', 'capacites', 'porte-etendard-motivation', 'Motivation (Porte-étendard)', 'motivation-porte-etendard', 'Donne un bonus de 5% à tous les jets des alliés. Dure 3 tours.', '{"classe": "classes/porte-etendard", "niveau": 1, "nature": "classe", "rang": 1, "ligne": 4, "type_capacite": "Action (2 fois/combat)"}', 'Donne un bonus de 5% à tous les jets des alliés. Dure 3 tours.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-chef-resiliant', 'capacites', 'porte-etendard-chef-resiliant', 'Chef résiliant (Porte-étendard)', 'chef-resiliant-porte-etendard', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de calme, vigueur et fermeté', '{"classe": "classes/porte-etendard", "niveau": 5, "nature": "classe", "rang": 2, "ligne": 11, "type_capacite": "Passif"}', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de calme, vigueur et fermeté
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-chef-de-guerre', 'capacites', 'porte-etendard-chef-de-guerre', 'Chef de guerre (Porte-étendard)', 'chef-de-guerre-porte-etendard', '+2 points de maîtrise à répartir, le bonus donné par l’EdG ou la BdC dure un tour de plus.', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 10, "nature": "specialite", "rang": 1, "ligne": 22, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/porte-etendard-stratege-de-bataille"]}', '+2 points de maîtrise à répartir, le bonus donné par l’EdG ou la BdC dure un tour de plus. +5% Arme lourde, +10% Diplomatie OU Intimidation
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-stratege-de-bataille', 'capacites', 'porte-etendard-stratege-de-bataille', 'Stratège de bataille (Porte-étendard)', 'stratege-de-bataille-porte-etendard', '+2 points de maîtrise à répartir, +5% Arme lourde et légère, +10% Observation OU Distinction', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 10, "nature": "specialite", "rang": 2, "ligne": 22, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/porte-etendard-chef-de-guerre"]}', '+2 points de maîtrise à répartir, +5% Arme lourde et légère, +10% Observation OU Distinction
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-provoc-du-porteur', 'capacites', 'porte-etendard-provoc-du-porteur', 'Provoc du porteur (Porte-étendard)', 'provoc-du-porteur-porte-etendard', 'Si un allié à côté de lui est ciblé par une attaque à distance, il peut rediriger l''attaque vers lui (dans la mesure du possible)', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 10, "nature": "choix", "rang": 1, "ligne": 29, "type_capacite": "Réaction (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-chef-agile"]}', 'Si un allié à côté de lui est ciblé par une attaque à distance, il peut rediriger l''attaque vers lui (dans la mesure du possible)
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-chef-agile', 'capacites', 'porte-etendard-chef-agile', 'Chef agile (Porte-étendard)', 'chef-agile-porte-etendard', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets d''esquive, arme légère et réflexe.', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 10, "nature": "choix", "rang": 2, "ligne": 29, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/porte-etendard-provoc-du-porteur"]}', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets d''esquive, arme légère et réflexe.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-avantage', 'capacites', 'porte-etendard-avantage', 'Avantage (Porte-étendard)', 'avantage-porte-etendard', '(Posture Symbiose) Désigne un allié visible : Le bonus de dégâts et d''AM est compté comme un cran au-dessus.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 10, "nature": "choix", "rang": 1, "ligne": 29, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-faille"]}', '(Posture Symbiose)  
Désigne un allié visible : Le bonus de dégâts et d''AM est compté comme un cran au-dessus. Dure 1 tour
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-faille', 'capacites', 'porte-etendard-faille', 'Faille (Porte-étendard)', 'faille-porte-etendard', '(Posture Vigilance) Désigne un ennemi visible : Divise par 2 les malus pour viser une partie de son corps.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 10, "nature": "choix", "rang": 2, "ligne": 29, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-avantage"]}', '(Posture Vigilance)  
Désigne un ennemi visible : Divise par 2 les malus pour viser une partie de son corps. Dure 1 tour.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-repli', 'capacites', 'porte-etendard-repli', 'Repli ! (Porte-étendard)', 'repli-porte-etendard', 'Permet à un allié désigné de se déplacer d''une case sans prendre d''attaque d''opportunité (dans la mesure du possible)', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Réaction (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-chef-fort"]}', 'Permet à un allié désigné de se déplacer d''une case sans prendre d''attaque d''opportunité (dans la mesure du possible)
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-chef-fort', 'capacites', 'porte-etendard-chef-fort', 'Chef fort (Porte-étendard)', 'chef-fort-porte-etendard', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de parade, arme lourde et arc.', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/porte-etendard-repli"]}', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de parade, arme lourde et arc.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-reagir', 'capacites', 'porte-etendard-reagir', 'Réagir ! (Porte-étendard)', 'reagir-porte-etendard', '(Posture Neutre) Désigne un allié visible : Lui autorise à changer de posture immédiatement.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-decontenance"]}', '(Posture Neutre)  
Désigne un allié visible : Lui autorise à changer de posture immédiatement.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-decontenance', 'capacites', 'porte-etendard-decontenance', 'Décontenance (Porte-étendard)', 'decontenance-porte-etendard', '(Posture Focus) Désigne un ennemi visible : Inflige un malus de 10% à tous ses jets.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-reagir"]}', '(Posture Focus)  
Désigne un ennemi visible : Inflige un malus de 10% à tous ses jets. Dure 1 tour.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-contre-les-laches', 'capacites', 'porte-etendard-contre-les-laches', 'Contre les lâches (Porte-étendard)', 'contre-les-laches-porte-etendard', 'Impose un malus de 20% aux ennemis qui utilisent des armes à distance ou des sorts qui ont plus de 2 de portée.', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-chef-malin"]}', 'Impose un malus de 20% aux ennemis qui utilisent des armes à distance ou des sorts qui ont plus de 2 de portée. Dure 2 tours.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-chef-malin', 'capacites', 'porte-etendard-chef-malin', 'Chef malin (Porte-étendard)', 'chef-malin-porte-etendard', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de magie, médecine et connaissance.', '{"classe": "classes/porte-etendard", "specialite": "CHEF DE GUERRE", "niveau": 20, "nature": "choix", "rang": 2, "ligne": 43, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/porte-etendard-contre-les-laches"]}', 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de magie, médecine et connaissance.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-premiere-ligne', 'capacites', 'porte-etendard-premiere-ligne', 'Première ligne (Porte-étendard)', 'premiere-ligne-porte-etendard', '(Posture Défensif) Désigne un allié visible : Ses parades partielles sont toujours parfaites.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-coordination"]}', '(Posture Défensif)  
Désigne un allié visible : Ses parades partielles sont toujours parfaites. Dure 1 tour.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-coordination', 'capacites', 'porte-etendard-coordination', 'Coordination (Porte-étendard)', 'coordination-porte-etendard', '(Posture Offensif) Désigne un ennemi visible : Le malus de l''offensif ne s''applique plus quand on l''attaque.', '{"classe": "classes/porte-etendard", "specialite": "STRATÈGE DE BATAILLE", "niveau": 20, "nature": "choix", "rang": 2, "ligne": 43, "type_capacite": "Action (2 fois/combat)", "choix_exclusif_avec": ["capacites/porte-etendard-premiere-ligne"]}', '(Posture Offensif)  
Désigne un ennemi visible : Le malus de l''offensif ne s''applique plus quand on l''attaque. Dure 1 tour.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/porte-etendard-au-dela-des-limites', 'capacites', 'porte-etendard-au-dela-des-limites', 'Au delà des limites (Porte-étendard)', 'au-dela-des-limites-porte-etendard', 'Dure 3 tours, si les alliés sont en dessous de 20% de santé = +10 dégâts, +1 Vitesse', '{"classe": "classes/porte-etendard", "niveau": 20, "nature": "classe", "rang": 3, "ligne": 49, "type_capacite": "Action (1 fois/combat)"}', 'Dure 3 tours, si les alliés sont en dessous de 20% de santé = +10 dégâts, +1 Vitesse
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Porte-étendard »');
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('classes/porte-etendard', 0, 66);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('classes/porte-etendard', 1, 51);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-motivation', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-chef-resiliant', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-provoc-du-porteur', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-chef-agile', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-avantage', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-faille', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-repli', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-chef-fort', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-reagir', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-decontenance', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-contre-les-laches', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-chef-malin', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-premiere-ligne', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-coordination', 0, 54);
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/porte-etendard-au-dela-des-limites', 0, 54);
INSERT INTO classe (id, nom, nom_cle, categorie_id, ordre, sante_depart, chakra_depart, barriere_depart, maitrise_arme, maitrise_armure, bouclier_classe_max, inventaire_depart, arme_depart, armure_depart, chose_a_savoir, chose_a_savoir_lien, description_titre, description, origine, source_ref, remarque, magie_innee_id, magie_innee_exclue_id) VALUES ('classes/porte-etendard', 'Porte-étendard', 'porte-etendard', 'classe-physique-corps-a-corps', 14, 5, 0, 5, '- 1 maîtrise Hast
- 1 maîtrise dans une arme contact au choix (sauf Hast)', '- Légère à Intermédiaire', NULL, 'P fiole rouge, KDR Arme, KDR Armure, briquet, lanterne', 'Lance en acier', 'Armure de fer complet', NULL, NULL, 'Description Porte-Étendard', 'Le Porte-Étendard est un meneur de guerre qui galvanise ses compagnons par sa présence et sa détermination. Équipé d''une lance et d''une armure robuste, il sait tenir sa position tout en incarnant un symbole de courage et de cohésion pour ceux qui combattent à ses côtés.

Sa force réside dans sa capacité à motiver ses alliés, renforçant temporairement leurs performances et leur détermination. Tant qu''il reste debout, sa présence inspire confiance et résilience à ses compagnons, leur permettant de garder leur sang-froid face à l''adversité. 

Son rôle est de maintenir le moral des troupes, fédérer ses alliés et transformer une simple troupe en une véritable force de combat.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A2:L13, AM1:BA12', NULL, NULL, NULL);
INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, description_titre, description, origine, source_ref, remarque) VALUES ('classes/porte-etendard#specialite:chef-de-guerre', 'classes/porte-etendard', 1, 'CHEF DE GUERRE', 'chef-de-guerre', 'Description Chef de guerre', 'Le Chef de Guerre est un meneur tactique qui dirige ses compagnons au cœur de la bataille. Commandant, il sait exploiter les forces de chacun pour transformer son groupe en une unité redoutable. Sa présence impose le respect et inspire confiance à ceux qui combattent sous ses ordres.

Son aura renforce les capacités de ses alliés, qu''ils soient combattants ou utilisateurs de magie. Attentif au danger, il sait protéger ses compagnons, coordonner leurs mouvements et désorganiser les rangs ennemis. Son rôle est de diriger le combat et faire de la cohésion du groupe sa plus grande arme.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A17:M19, AM17:BA29', NULL);
INSERT INTO specialite (id, classe_id, rang, nom, nom_cle, description_titre, description, origine, source_ref, remarque) VALUES ('classes/porte-etendard#specialite:stratege-de-bataille', 'classes/porte-etendard', 2, 'STRATÈGE DE BATAILLE', 'stratege-de-bataille', 'Description Stratège de bataille', 'Le Stratège de Bataille est un combattant analytique qui observe le champ de bataille et exploite chaque opportunité. Maître de l''adaptation, il sait ajuster sa posture selon la situation pour prendre l''avantage sur ses adversaires.

Grâce à son sens tactique, il renforce les actions de ses alliés, exploite les faiblesses ennemies et adapte sa défense ou son offensive à chaque instant. Son rôle est de contrôler le rythme du combat et faire pencher la balance en faveur de son groupe.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X17:AJ19, AM31:BA43', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-motivation', 'classes/porte-etendard', NULL, 1, 'classe', 4, 1, 'Motivation', 'motivation', 'action', 'Action (2 fois/combat)', 2, 'combat', 'Donne un bonus de 5% à tous les jets des alliés. Dure 3 tours.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › P4:U9', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-chef-resiliant', 'classes/porte-etendard', NULL, 5, 'classe', 11, 1, 'Chef résiliant', 'chef-resiliant', 'passif', 'Passif', NULL, NULL, 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de calme, vigueur et fermeté', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › P11:U16', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-chef-de-guerre', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 10, 'specialite', 22, 1, 'Chef de guerre', 'chef-de-guerre', 'passif', 'Passif', NULL, NULL, '+2 points de maîtrise à répartir, le bonus donné par l’EdG ou la BdC dure un tour de plus. +5% Arme lourde, +10% Diplomatie OU Intimidation', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › D22:J27', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-stratege-de-bataille', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 10, 'specialite', 22, 1, 'Stratège de bataille', 'stratege-de-bataille', 'passif', 'Passif', NULL, NULL, '+2 points de maîtrise à répartir, +5% Arme lourde et légère, +10% Observation OU Distinction', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › AA22:AG27', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-provoc-du-porteur', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 10, 'choix', 29, 1, 'Provoc du porteur', 'provoc-du-porteur', 'reaction', 'Réaction (2 fois/combat)', 2, 'combat', 'Si un allié à côté de lui est ciblé par une attaque à distance, il peut rediriger l''attaque vers lui (dans la mesure du possible)', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A29:F34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-chef-agile', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 10, 'choix', 29, 2, 'Chef agile', 'chef-agile', 'passif', 'Passif', NULL, NULL, 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets d''esquive, arme légère et réflexe.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › H29:M34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-avantage', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 10, 'choix', 29, 1, 'Avantage', 'avantage', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Symbiose)
Désigne un allié visible : Le bonus de dégâts et d''AM est compté comme un cran au-dessus. Dure 1 tour', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X29:AC34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-faille', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 10, 'choix', 29, 2, 'Faille', 'faille', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Vigilance)
Désigne un ennemi visible : Divise par 2 les malus pour viser une partie de son corps. Dure 1 tour.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › AE29:AJ34', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-repli', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 15, 'choix', 36, 1, 'Repli !', 'repli', 'reaction', 'Réaction (2 fois/combat)', 2, 'combat', 'Permet à un allié désigné de se déplacer d''une case sans prendre d''attaque d''opportunité (dans la mesure du possible)', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A36:F41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-chef-fort', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 15, 'choix', 36, 2, 'Chef fort', 'chef-fort', 'passif', 'Passif', NULL, NULL, 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de parade, arme lourde et arc.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › H36:M41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-reagir', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 15, 'choix', 36, 1, 'Réagir !', 'reagir', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Neutre)
Désigne un allié visible : Lui autorise à changer de posture immédiatement.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X36:AC41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-decontenance', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 15, 'choix', 36, 2, 'Décontenance', 'decontenance', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Focus)
Désigne un ennemi visible : Inflige un malus de 10% à tous ses jets. Dure 1 tour.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › AE36:AJ41', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-contre-les-laches', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 20, 'choix', 43, 1, 'Contre les lâches', 'contre-les-laches', 'action', 'Action (2 fois/combat)', 2, 'combat', 'Impose un malus de 20% aux ennemis qui utilisent des armes à distance ou des sorts qui ont plus de 2 de portée. Dure 2 tours.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A43:F48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-chef-malin', 'classes/porte-etendard', 'classes/porte-etendard#specialite:chef-de-guerre', 20, 'choix', 43, 2, 'Chef malin', 'chef-malin', 'passif', 'Passif', NULL, NULL, 'Tant qu''il est debout, les alliés ont un bonus de 5% à tous les jets de magie, médecine et connaissance.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › H43:M48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-premiere-ligne', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 20, 'choix', 43, 1, 'Première ligne', 'premiere-ligne', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Défensif)
Désigne un allié visible : Ses parades partielles sont toujours parfaites. Dure 1 tour.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X43:AC48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-coordination', 'classes/porte-etendard', 'classes/porte-etendard#specialite:stratege-de-bataille', 20, 'choix', 43, 2, 'Coordination', 'coordination', 'action', 'Action (2 fois/combat)', 2, 'combat', '(Posture Offensif)
Désigne un ennemi visible : Le malus de l''offensif ne s''applique plus quand on l''attaque. Dure 1 tour.', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › AE43:AJ48', NULL);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/porte-etendard-au-dela-des-limites', 'classes/porte-etendard', NULL, 20, 'classe', 49, 1, 'Au delà des limites', 'au-dela-des-limites', 'action', 'Action (1 fois/combat)', 1, 'combat', 'Dure 3 tours, si les alliés sont en dessous de 20% de santé = +10 dégâts, +1 Vitesse', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › P49:U54', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('classe', 'classes/porte-etendard', 'classes/porte-etendard', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('specialite', 'classes/porte-etendard#specialite:chef-de-guerre', 'classes/porte-etendard', 0, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('specialite', 'classes/porte-etendard#specialite:stratege-de-bataille', 'classes/porte-etendard', 0, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-motivation', 'capacites/porte-etendard-motivation', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-chef-resiliant', 'capacites/porte-etendard-chef-resiliant', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-chef-de-guerre', 'capacites/porte-etendard-chef-de-guerre', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-stratege-de-bataille', 'capacites/porte-etendard-stratege-de-bataille', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-provoc-du-porteur', 'capacites/porte-etendard-provoc-du-porteur', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-chef-agile', 'capacites/porte-etendard-chef-agile', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-avantage', 'capacites/porte-etendard-avantage', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-faille', 'capacites/porte-etendard-faille', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-repli', 'capacites/porte-etendard-repli', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-chef-fort', 'capacites/porte-etendard-chef-fort', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-reagir', 'capacites/porte-etendard-reagir', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-decontenance', 'capacites/porte-etendard-decontenance', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-contre-les-laches', 'capacites/porte-etendard-contre-les-laches', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-chef-malin', 'capacites/porte-etendard-chef-malin', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-premiere-ligne', 'capacites/porte-etendard-premiere-ligne', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-coordination', 'capacites/porte-etendard-coordination', 1, 'classes');
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/porte-etendard-au-dela-des-limites', 'capacites/porte-etendard-au-dela-des-limites', 1, 'classes');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/porte-etendard', 1, 1, 'P fiole rouge', 'ressources/objets-de-depart-des-classes#objet:p-fiole-rouge', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/porte-etendard', 2, 1, 'KDR Arme', 'ressources/objets-de-depart-des-classes#objet:kdr-arme', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/porte-etendard', 3, 1, 'KDR Armure', 'ressources/objets-de-depart-des-classes#objet:kdr-armure', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/porte-etendard', 4, 1, 'briquet', 'ressources/objets-de-depart-des-classes#objet:briquet', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › G3:L5');
INSERT INTO classe_objet_depart (classe_id, rang, option, texte, objet_depart_id, origine, source_ref) VALUES ('classes/porte-etendard', 5, 1, 'lanterne', 'ressources/objets-de-depart-des-classes#objet:lanterne', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › G3:L5');
INSERT INTO classe_maitrise_armure (classe_id, rang, brut, objet, poids_min, poids_max, classe_min, classe_max, origine, source_ref) VALUES ('classes/porte-etendard', 1, 'Légère à Intermédiaire', 'armure', 'Légère', 'Intermédiaire', NULL, NULL, 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A11:F13');
INSERT INTO classe_maitrise_arme (classe_id, rang, brut, forme, nombre, arme, arme_cle, categorie, sauf, sauf_cle, origine, source_ref) VALUES ('classes/porte-etendard', 1, '1 maîtrise Hast', 'nommee', 1, 'Hast', 'hast', NULL, NULL, NULL, 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A7:F9');
INSERT INTO classe_maitrise_arme (classe_id, rang, brut, forme, nombre, arme, arme_cle, categorie, sauf, sauf_cle, origine, source_ref) VALUES ('classes/porte-etendard', 2, '1 maîtrise dans une arme contact au choix (sauf Hast)', 'au_choix', 1, NULL, NULL, 'contact', 'Hast', 'hast', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A7:F9');
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('classes/porte-etendard#maitrise-arme:1', 1, NULL, 'classes/porte-etendard', 1, 'imposee', 1, 'lance-arme-dhast', NULL);
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, NULL, 'classes/porte-etendard', 2, 'choix', 1, NULL, NULL);
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'capacites/porte-etendard-chef-de-guerre', NULL, NULL, 'choix', 2, NULL, NULL);
INSERT INTO maitrise_arme_part (source_id, rang, capacite_id, classe_id, classe_rang, genre, points, arme_famille_id, limite_famille) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'capacites/porte-etendard-stratege-de-bataille', NULL, NULL, 'choix', 2, NULL, NULL);
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/porte-etendard#maitrise-arme:2', 1, 'baton-de-combat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'lance-arme-dhast');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'baton-de-combat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'arme-de-jet');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'arc');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'arbalete');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-chef-de-guerre', 1, 'bombes');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'lance-arme-dhast');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'baton-de-combat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'arme-de-jet');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'arc');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'arbalete');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('capacites/porte-etendard-stratege-de-bataille', 1, 'bombes');

-- race_classe : les deux classes ouvertes aux 27 races de la base (R238 (1)), colonnes 40 (Boxeur) et 41 (Porte-étendard), après les 39 de la fiche.
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/anansi', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/drakos', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/drassahthac', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-argente', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-dore', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-forestier', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-noir', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/farfadet', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/felfe', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fenrir', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/goleois', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/hujin', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/humain', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/jackalope', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/kitsune', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/lamia', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/majin', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/marcass', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/medusain', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/minotaure', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/mort-vivant', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/nain', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/namazu', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/olwman', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/orios', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/rokh', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/satyre', 'classes/boxeur', 40, 1, '1', 'races', 'Décision R238 (1) › Boxeur (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/anansi', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/drakos', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/drassahthac', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-argente', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-dore', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-forestier', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/elfe-noir', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/farfadet', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/felfe', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fenrir', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/goleois', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/hujin', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/humain', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/jackalope', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/kitsune', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/lamia', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/majin', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/marcass', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/medusain', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/minotaure', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/mort-vivant', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/nain', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/namazu', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/olwman', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/orios', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/rokh', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/satyre', 'classes/porte-etendard', 41, 1, '1', 'races', 'Décision R238 (1) › Porte-étendard (ouverte à toutes les races ; aucune case de la fiche)');


-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 3. Cuirassé V2 (R238 (2) ; onglet 25, le classeur fait foi : R237 (1)). Ordre imposé par l'index unique capacite_emplacement : Large supprimé,
--    Appui déplacé (Vindicatif 15 -> Protecteur 20, même id, effet et type inchangés), Écrasant créé à la place libérée ; Nanochakra « barrière » ;
--    armure de départ (25!G11) ; choix exclusifs des fiches de dons (page.donnees) et page de la classe.
-- --------------------------------------------------------------------------------------------------------------------------------------------
DELETE FROM page_tag WHERE page_id = 'capacites/cuirasse-large';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Large : page_tag', changes(), 1);
DELETE FROM page_entite WHERE page_id = 'capacites/cuirasse-large';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Large : page_entite', changes(), 1);
DELETE FROM page_source WHERE page_id = 'capacites/cuirasse-large';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Large : page_source', changes(), 2);
DELETE FROM capacite WHERE id = 'capacites/cuirasse-large' AND specialite_id = 'classes/cuirasse#specialite:protecteur' AND niveau = 20 AND ligne = 43 AND rang = 2;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Large : capacite', changes(), 1);
DELETE FROM page WHERE id = 'capacites/cuirasse-large';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Large : page', changes(), 1);
UPDATE capacite SET specialite_id = 'classes/cuirasse#specialite:protecteur', niveau = 20, ligne = 43, rang = 2, source_ref = 'Nouveauté mise à jour Décembre › Cuirassé V2 › AE43:AJ48'
  WHERE id = 'capacites/cuirasse-appui' AND specialite_id = 'classes/cuirasse#specialite:vindicatif' AND niveau = 15 AND ligne = 36 AND rang = 1;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Appui : Protecteur niveau 20', changes(), 1);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('capacites/cuirasse-ecrasant', 'capacites', 'cuirasse-ecrasant', 'Écrasant (Cuirassé)', 'ecrasant-cuirasse', 'Inflige +5 dégâts si la cible de l''attaque a moins d''AP total.', '{"classe": "classes/cuirasse", "specialite": "VINDICATIF", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Passif", "choix_exclusif_avec": ["capacites/cuirasse-aucune-fuite"]}', 'Inflige +5 dégâts si la cible de l''attaque a moins d''AP total.
', 'draft', 'classes', 'Classeur « Nouveauté mise à jour Décembre », onglet « Cuirassé V2 »');
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('capacites/cuirasse-ecrasant', 0, 54);
INSERT INTO capacite (id, classe_id, specialite_id, niveau, nature, ligne, rang, nom, nom_cle, type, type_brut, limite_nombre, limite_periode, effet, origine, source_ref, remarque) VALUES ('capacites/cuirasse-ecrasant', 'classes/cuirasse', 'classes/cuirasse#specialite:vindicatif', 15, 'choix', 36, 1, 'Écrasant', 'ecrasant', 'passif', 'Passif', NULL, NULL, 'Inflige +5 dégâts si la cible de l''attaque a moins d''AP total.', 'classes', 'Nouveauté mise à jour Décembre › Cuirassé V2 › A36:F41', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('capacite', 'capacites/cuirasse-ecrasant', 'capacites/cuirasse-ecrasant', 1, 'classes');
UPDATE capacite SET effet = 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 barrière.', source_ref = 'Nouveauté mise à jour Décembre › Cuirassé V2 › X29:AC34' WHERE id = 'capacites/cuirasse-nanochakra' AND effet = 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Nanochakra : barrière', changes(), 1);
UPDATE classe SET armure_depart = 'Armure de Cellulose/Argent, Écu de bois' WHERE id = 'classes/cuirasse' AND armure_depart = 'Armure de Fer/Bronze, Bouclier Rond Corail';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Cuirassé : armure de départ', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.', 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 barrière.')
  WHERE id = 'capacites/cuirasse-nanochakra' AND length(corps_md) - length(replace(corps_md, 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.', '')) = length('Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('capacites/cuirasse-nanochakra : corps_md', changes(), 1);
UPDATE page SET resume = replace(resume, 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.', 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 barrière.')
  WHERE id = 'capacites/cuirasse-nanochakra' AND length(resume) - length(replace(resume, 'Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.', '')) = length('Chaque attaque ennemie bloquée complètement permet de récupérer 1d8 santé.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('capacites/cuirasse-nanochakra : resume', changes(), 1);
UPDATE page SET donnees = '{"classe": "classes/cuirasse", "specialite": "VINDICATIF", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Réaction (1 fois/combat)", "choix_exclusif_avec": ["capacites/cuirasse-ecrasant"]}' WHERE id = 'capacites/cuirasse-aucune-fuite' AND donnees = '{"classe": "classes/cuirasse", "specialite": "VINDICATIF", "niveau": 15, "nature": "choix", "rang": 2, "ligne": 36, "type_capacite": "Réaction (1 fois/combat)", "choix_exclusif_avec": ["capacites/cuirasse-appui"]}';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('capacites/cuirasse-aucune-fuite : choix exclusif', changes(), 1);
UPDATE page SET donnees = '{"classe": "classes/cuirasse", "specialite": "PROTECTEUR", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Réaction (1 fois/combat)", "choix_exclusif_avec": ["capacites/cuirasse-appui"]}' WHERE id = 'capacites/cuirasse-muraille' AND donnees = '{"classe": "classes/cuirasse", "specialite": "PROTECTEUR", "niveau": 20, "nature": "choix", "rang": 1, "ligne": 43, "type_capacite": "Réaction (1 fois/combat)", "choix_exclusif_avec": ["capacites/cuirasse-large"]}';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('capacites/cuirasse-muraille : choix exclusif', changes(), 1);
UPDATE page SET donnees = '{"classe": "classes/cuirasse", "specialite": "PROTECTEUR", "niveau": 20, "nature": "choix", "rang": 2, "ligne": 43, "type_capacite": "Réaction", "choix_exclusif_avec": ["capacites/cuirasse-muraille"]}' WHERE id = 'capacites/cuirasse-appui' AND donnees = '{"classe": "classes/cuirasse", "specialite": "VINDICATIF", "niveau": 15, "nature": "choix", "rang": 1, "ligne": 36, "type_capacite": "Réaction", "choix_exclusif_avec": ["capacites/cuirasse-aucune-fuite"]}';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('capacites/cuirasse-appui : choix exclusif', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Armure de Fer/Bronze, Bouclier Rond Corail', 'Armure de Cellulose/Argent, Écu de bois')
  WHERE id = 'classes/cuirasse' AND length(corps_md) - length(replace(corps_md, 'Armure de Fer/Bronze, Bouclier Rond Corail', '')) = length('Armure de Fer/Bronze, Bouclier Rond Corail');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page classes/cuirasse : armure de départ', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 4. Parleur (R238 (3)) : catégorie « Classe spéciale » (comme l'Archimage) ; son ordre (11) ne change pas ; mot-clé de catégorie de sa page (càc -> spéciale,
--    lib/classe-champs.mjs#MOT_CLE_DE_CATEGORIE) ; la ligne « Catégorie » du corps de sa page.
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE classe SET categorie_id = 'classe-speciale' WHERE id = 'classes/parleur' AND categorie_id = 'classe-physique-corps-a-corps';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Parleur : catégorie', changes(), 1);
UPDATE page_tag SET tag_id = 334 WHERE page_id = 'classes/parleur' AND tag_id = 51;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Parleur : mot-clé de catégorie', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '**Catégorie** : Classe Physique Corps à Corps', '**Catégorie** : Classe spéciale')
  WHERE id = 'classes/parleur' AND length(corps_md) - length(replace(corps_md, '**Catégorie** : Classe Physique Corps à Corps', '')) = length('**Catégorie** : Classe Physique Corps à Corps');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page classes/parleur : catégorie', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 5. Archimage (R238 (4)) : « 1 maîtrise de Bâton » devient « 1 maîtrise arme de contact au choix » (forme au_choix, catégorie contact, sans « sauf ») ;
--    sa part (source classes/archimage#maitrise-arme:2, conservée) passe de « imposée » (Bâton de combat) à « choix » sur les 7 familles de contact (R127).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE classe SET maitrise_arme = replace(maitrise_arme, '- 1 maîtrise de Bâton', '- 1 maîtrise arme de contact au choix')
  WHERE id = 'classes/archimage' AND length(maitrise_arme) - length(replace(maitrise_arme, '- 1 maîtrise de Bâton', '')) = length('- 1 maîtrise de Bâton');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Archimage : cellule Maîtrise Arme', changes(), 1);
UPDATE classe_maitrise_arme SET brut = '1 maîtrise arme de contact au choix', forme = 'au_choix', nombre = 1, arme = NULL, arme_cle = NULL, categorie = 'contact', sauf = NULL, sauf_cle = NULL
  WHERE classe_id = 'classes/archimage' AND rang = 2 AND forme = 'nommee' AND arme_cle = 'baton';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Archimage : ligne de maîtrise 2', changes(), 1);
UPDATE maitrise_arme_part SET genre = 'choix', arme_famille_id = NULL WHERE source_id = 'classes/archimage#maitrise-arme:2' AND rang = 1 AND genre = 'imposee' AND arme_famille_id = 'baton-de-combat';
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Archimage : part à choisir', changes(), 1);
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'epees');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'dagues');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'masse-marteau');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'hache');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'lance-arme-dhast');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'pugilat');
INSERT INTO maitrise_arme_part_famille (source_id, rang, arme_famille_id) VALUES ('classes/archimage#maitrise-arme:2', 1, 'baton-de-combat');
UPDATE page SET corps_md = replace(corps_md, '- 1 maîtrise de Bâton', '- 1 maîtrise arme de contact au choix')
  WHERE id = 'classes/archimage' AND length(corps_md) - length(replace(corps_md, '- 1 maîtrise de Bâton', '')) = length('- 1 maîtrise de Bâton');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page classes/archimage : maîtrise d''arme', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 6. Potentiel Illimité (R238 (5)) : l'Archimage n'est plus imposée. Règle classe_imposee retirée de v_personnage_controle (vue recréée, copiée de
--    data/schema.sql ; les autres règles sont celles de 0111, inchangées : classe_reservee R23, classe_exclue R25…). Phrase « Classe unique = Archimage. »
--    retirée de magie.explication et de la page de la magie (lib/corps-magies.mjs) ; le « CHOSE A SAVOIR » de l'Archimage reste tel quel.
-- --------------------------------------------------------------------------------------------------------------------------------------------
DROP VIEW v_personnage_controle;
CREATE VIEW v_personnage_controle AS
  -- Race : classe accessible (matrice « Accessibilité de Classe », décision R8)
  SELECT pc.personnage_id, 'classe_inaccessible' AS regle, pc.classe_id AS detail
  FROM personnage_classe pc JOIN personnage p ON p.id = pc.personnage_id
  WHERE p.race_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM race_classe rc WHERE rc.race_id = p.race_id AND rc.classe_id = pc.classe_id AND rc.accessible = 1)
  UNION ALL
  -- Race et magie innée : toute fiche en a une (jusqu'à la migration 0038, une contrainte de la table pour toute fiche hors brouillon)
  SELECT p.id, 'race_manquante', NULL
  FROM personnage p
  WHERE p.race_id IS NULL
  UNION ALL
  SELECT p.id, 'magie_innee_manquante', NULL
  FROM personnage p
  WHERE p.magie_innee_id IS NULL
  UNION ALL
  -- Classe réservée à une magie innée, qui ne l'impose plus (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décisions R23 et R238 (5))
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  -- Classe que ferme la magie innée, à tous les rangs (classe.magie_innee_exclue_id ; le Mage Bleu et le Potentiel Illimité, décision R25)
  SELECT pc.personnage_id, 'classe_exclue', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_exclue_id = p.magie_innee_id
  UNION ALL
  -- Magie innée accessible à la race : matrice « Accessibilité Magie » (R8), sauf liste de l'onglet de la race qui prime (R11)
  SELECT p.id, 'magie_innee_inaccessible', p.magie_innee_id
  FROM personnage p
  WHERE p.race_id IS NOT NULL AND p.magie_innee_id IS NOT NULL
    AND CASE WHEN EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id)
             THEN NOT EXISTS (SELECT 1 FROM race_magie_onglet o WHERE o.race_id = p.race_id AND o.magie_id = p.magie_innee_id)
             ELSE NOT EXISTS (SELECT 1 FROM race_magie rm WHERE rm.race_id = p.race_id AND rm.magie_id = p.magie_innee_id AND rm.accessible = 1)
        END
  UNION ALL
  -- Magies incompatibles entre elles (bloc « Magie non compatible » des onglets de magie)
  SELECT p.id, 'magies_incompatibles', p.magie_innee_id || ' / ' || p.magie_acquise_id
  FROM personnage p
  JOIN v_magie_incompatible i ON i.a = p.magie_innee_id AND i.b = p.magie_acquise_id
  UNION ALL
  -- Mono-magie (décision R15) : pas de magie acquise avec une magie mono-magie, sauf ethnie citée par magie_ethnie_secondaire, que la magie
  -- mono-magie soit l'innée ou l'acquise (décision R20 : l'Elfe Noir Charbon et le Felfe Noir peuvent acquérir la Corruption)
  SELECT p.id, 'mono_magie', m.id
  FROM personnage p
  JOIN magie m ON m.mono_magie = 1 AND m.id IN (p.magie_innee_id, p.magie_acquise_id)
  WHERE p.magie_acquise_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM magie_ethnie_secondaire s WHERE s.magie_id = m.id AND s.ethnie_id = p.ethnie_id)
  UNION ALL
  -- Race à une seule magie (race.mono_magie ; la Lamia, décision R28) : pas de magie acquise
  SELECT p.id, 'race_mono_magie', p.magie_acquise_id
  FROM personnage p JOIN race r ON r.id = p.race_id
  WHERE r.mono_magie = 1 AND p.magie_acquise_id IS NOT NULL
  UNION ALL
  -- Ethnie : de la race choisie ; obligatoire quand la race en a ; liée à la magie innée quand elle porte une magie (BDD!X2). Sans race ou sans magie
  -- innée, rien à comparer : race_manquante, magie_innee_manquante le disent (migration 0038)
  SELECT p.id, 'ethnie_hors_race', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.race_id <> p.race_id
  UNION ALL
  SELECT p.id, 'ethnie_manquante', p.race_id
  FROM personnage p
  WHERE p.ethnie_id IS NULL AND EXISTS (SELECT 1 FROM ethnie e WHERE e.race_id = p.race_id)
  UNION ALL
  SELECT p.id, 'ethnie_magie', p.ethnie_id
  FROM personnage p JOIN ethnie e ON e.id = p.ethnie_id
  WHERE e.magie_id <> p.magie_innee_id
  UNION ALL
  -- Point de caractéristique de la magie innée : à choisir seulement quand la magie ne le fixe pas
  SELECT p.id, 'caracteristique_magie', COALESCE(p.caracteristique_magie_id, '(absente)')
  FROM personnage p JOIN magie m ON m.id = p.magie_innee_id
  WHERE (m.caracteristique_id IS NULL) <> (p.caracteristique_magie_id IS NOT NULL)
  UNION ALL
  -- Caractéristiques : les six, dans les bornes de la race, total exact du niveau (seuil 'caracteristiques_total', décision R3)
  SELECT p.id, 'caracteristique_manquante', c.id
  FROM personnage p CROSS JOIN caracteristique c
  WHERE NOT EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = p.id AND pc.caracteristique_id = c.id)
  UNION ALL
  SELECT pc.personnage_id, 'caracteristique_hors_bornes', pc.caracteristique_id || ' = ' || pc.base
  FROM personnage_caracteristique pc
  JOIN personnage p ON p.id = pc.personnage_id
  JOIN v_race_carac_borne b ON b.race_id = p.race_id AND b.caracteristique_id = pc.caracteristique_id
  WHERE pc.base < b.minimum OR pc.base > b.maximum
  UNION ALL
  SELECT n.personnage_id, 'caracteristiques_total', (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) || ' / ' || s.valeur
  FROM v_personnage_niveau n
  JOIN seuil_niveau s ON s.regle = 'caracteristiques_total'
   AND s.niveau_min = (SELECT MAX(t.niveau_min) FROM seuil_niveau t WHERE t.regle = 'caracteristiques_total' AND t.niveau_min <= n.niveau_global)
  WHERE EXISTS (SELECT 1 FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id)
    AND (SELECT SUM(pc.base) FROM personnage_caracteristique pc WHERE pc.personnage_id = n.personnage_id) <> s.valeur
  UNION ALL
  -- Compétences : naturel au plus le maximum du niveau, total naturel = budget cumulé (R3)
  SELECT pc.personnage_id, 'competence_naturel_max', pc.competence_id || ' = ' || pc.naturel
  FROM personnage_competence pc
  JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE pc.naturel > v.competence_naturel_max
  UNION ALL
  SELECT n.personnage_id, 'competences_total', COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) || ' / ' || v.points_competences_cumul
  FROM v_personnage_niveau n
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE COALESCE((SELECT SUM(pc.naturel) FROM personnage_competence pc WHERE pc.personnage_id = n.personnage_id), 0) <> v.points_competences_cumul
  UNION ALL
  -- Entraînement (décision R104) : 15 compétences au plus (« Vous ne pouvez monter que 15 compétences maximum »), 10 points au plus chacune (« à hauteur
  -- maximum 10% de bonus » ; une ligne à 0 ne monte rien) ; l'Acquis, lui, se calcule (le plafond de 5 par point de caractéristique est appliqué par la page)
  SELECT pe.personnage_id, 'entrainement_competences', COUNT(*) || ' / ' || (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  FROM personnage_entrainement pe
  WHERE pe.competence_id IS NOT NULL AND pe.valeur > 0
  GROUP BY pe.personnage_id
  HAVING COUNT(*) > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.competences_max')
  UNION ALL
  SELECT pe.personnage_id, 'entrainement_valeur', pe.competence_id || ' = ' || pe.valeur
  FROM personnage_entrainement pe
  WHERE pe.valeur > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'entrainement.bonus_max_pct')
  UNION ALL
  -- Métier (décision R33) : un bonus choisi est une compétence d'un rang à choix du métier de la fiche ; chaque rang à choix a le sien
  SELECT c.personnage_id, 'metier_bonus_hors_choix', c.competence_id
  FROM personnage_metier_bonus c JOIN personnage p ON p.id = c.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM metier_bonus b WHERE b.metier_id = p.metier_id AND b.rang = c.rang AND b.competence_id = c.competence_id
                      AND (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang) > 1)
  UNION ALL
  SELECT p.id, 'metier_bonus_manquant', b.texte
  FROM personnage p JOIN metier_bonus b ON b.metier_id = p.metier_id AND b.option = 1
  WHERE (SELECT count(*) FROM metier_bonus o WHERE o.metier_id = b.metier_id AND o.rang = b.rang AND o.competence_id IS NOT NULL) > 1
    AND NOT EXISTS (SELECT 1 FROM personnage_metier_bonus c WHERE c.personnage_id = p.id AND c.rang = b.rang)
  UNION ALL
  -- Gains de niveau (décision R73) : santé + chakra gagnés (personnage.gains_sante, gains_chakra) = les points d'attributs des niveaux atteints
  -- (v_niveau.points_attributs_cumul : 15 par niveau à partir du 2), plus le dé bonus de chaque niveau atteint qui en donne un, entre son plus petit
  -- et son plus grand résultat (niveau_global.de_attributs_min, de_attributs_max : 1 et 8) ; au niveau 1, rien. Détail : « total / à saisir », ou
  -- « total / minimum à maximum » quand un dé est atteint
  SELECT n.personnage_id, 'gains_niveau', (p.gains_sante + p.gains_chakra) || ' / ' || (v.points_attributs_cumul + v.de_attributs_min_cumul)
         || CASE WHEN v.de_attributs_max_cumul > v.de_attributs_min_cumul THEN ' à ' || (v.points_attributs_cumul + v.de_attributs_max_cumul) ELSE '' END
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  WHERE p.gains_sante + p.gains_chakra NOT BETWEEN v.points_attributs_cumul + v.de_attributs_min_cumul
                                               AND v.points_attributs_cumul + v.de_attributs_max_cumul
  UNION ALL
  -- Santé du Potentiel Illimité (décision R225, migration 0111) : avec le Potentiel Illimité en magie innée, au plus N santé par niveau sur les points
  -- d'attributs (regle_constante potentiel_illimite.sante_max_par_niveau ; les niveaux atteints dont niveau_global.points_attributs est renseigné), le
  -- dé bonus des niveaux qui en donnent un en plus, à son plus grand résultat (v_niveau.de_attributs_max_cumul). Signalé, jamais rogné ; la somme
  -- reste la règle gains_niveau. Détail : « santé / plafond »
  SELECT n.personnage_id, 'gains_sante_potentiel', p.gains_sante || ' / ' || (r.valeur * (SELECT count(*) FROM niveau_global g
           WHERE g.niveau <= n.niveau_global AND g.points_attributs IS NOT NULL) + v.de_attributs_max_cumul)
  FROM v_personnage_niveau n
  JOIN personnage p ON p.id = n.personnage_id
  JOIN v_niveau v ON v.niveau = n.niveau_global
  JOIN regle_constante r ON r.id = 'potentiel_illimite.sante_max_par_niveau'
  WHERE p.magie_innee_id = 'magies/potentiel-illimite'
    AND p.gains_sante > r.valeur * (SELECT count(*) FROM niveau_global g WHERE g.niveau <= n.niveau_global AND g.points_attributs IS NOT NULL)
                        + v.de_attributs_max_cumul
  UNION ALL
  -- Classes : la 2e existe exactement quand elle a des niveaux (R2) ; une spécialité se choisit au niveau de classe 10 (BDD!I2, J2)
  SELECT n.personnage_id, 'classe_2_manquante', CAST(n.niveau_classe_2 AS TEXT)
  FROM v_personnage_niveau n
  WHERE n.niveau_classe_2 > 0
    AND NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 2)
  UNION ALL
  SELECT n.personnage_id, 'classe_2_en_trop', pc.classe_id
  FROM v_personnage_niveau n JOIN personnage_classe pc ON pc.personnage_id = n.personnage_id AND pc.rang = 2
  WHERE n.niveau_classe_2 = 0
  UNION ALL
  SELECT n.personnage_id, 'classe_1_manquante', NULL
  FROM v_personnage_niveau n
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = n.personnage_id AND pc.rang = 1)
  UNION ALL
  SELECT pc.personnage_id, 'specialite_trop_tot', pc.specialite_id
  FROM personnage_classe pc JOIN v_personnage_niveau n ON n.personnage_id = pc.personnage_id
  WHERE pc.specialite_id IS NOT NULL
    AND CASE pc.rang WHEN 1 THEN n.niveau_classe_1 ELSE n.niveau_classe_2 END < 10
  UNION ALL
  -- Dons choisis : d'une classe du personnage, de sa spécialité s'ils en dépendent, jamais deux options exclusives ensemble
  SELECT pk.personnage_id, 'capacite_hors_classe', pk.capacite_id
  FROM personnage_capacite pk JOIN capacite c ON c.id = pk.capacite_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_classe pc WHERE pc.personnage_id = pk.personnage_id AND pc.classe_id = c.classe_id
                      AND (c.specialite_id IS NULL OR c.specialite_id = pc.specialite_id))
  UNION ALL
  SELECT a.personnage_id, 'capacites_exclusives', a.capacite_id || ' / ' || b.capacite_id
  FROM personnage_capacite a
  JOIN v_capacite_exclusive x ON x.capacite_id = a.capacite_id
  JOIN personnage_capacite b ON b.personnage_id = a.personnage_id AND b.capacite_id = x.autre_id
  WHERE a.capacite_id < b.capacite_id
  UNION ALL
  -- Sorts : d'une magie du personnage (le Potentiel Illimité « pioche ses sorts dans toutes les magies existantes », son Explication) ;
  -- NPM au plus la puissance magique du niveau (niveau_global : niveau 16 pour la 5, décision R16), le palier dont la note dit « non disponible pour
  -- les personnages avec une magie acquise » ne comptant pas pour eux. NM (décision R26) : au plus 3 sur un sort, toutes origines comprises ; ceux de niveau
  -- au plus niveau global − 1 sur un sort (BDD!BB6) et au plus les NM gagnés en tout ; au-delà, ils viennent d'un livre ou du MJ (décision R24). Depuis la
  -- décision R118 (migration 0066), les NM du MJ sont ceux de la fiche (personnage.nm_mj), pas d'un sort : les NM d'un sort sans celui de son livre
  -- comptent, au plus niveau global − 1 plus les NM du MJ sur un sort, au plus les NM gagnés plus ceux du MJ en tout (tant qu'un niveau donne un NM, la
  -- seconde règle implique la première, qui nomme le sort). Le livre d'un sort (personnage_livre_sort, décision R169, migration 0082) n'est ôté que
  -- d'un sort choisi (une ligne de personnage_sort, jointe par la clé primaire du livre : jamais deux lignes) qui a au moins 1 NM (comme
  -- lib/fiche-moteur.mjs#nmDuSort : jamais moins de 0 NM comptés) ; le livre d'un sort non choisi, en attente, ne change rien. Plafond de NPM (décision
  -- R188, migration 0097) : une magie innée qui en a un (magie_npm_plafond : le Potentiel Illimité, 3) borne aussi le NPM du sort, relevé par un don acquis
  -- (capacite_npm_plafond, v_personnage_don_acquis : « Semi-complet », 4) ; NPM au plus min(puissance du niveau, max de ces plafonds)
  SELECT ps.personnage_id, 'sort_hors_magie', ps.sort_id
  FROM personnage_sort ps JOIN sort s ON s.id = ps.sort_id JOIN personnage p ON p.id = ps.personnage_id
  WHERE s.magie_id <> COALESCE(p.magie_innee_id, '') AND s.magie_id <> COALESCE(p.magie_acquise_id, '')
    AND COALESCE(p.magie_innee_id, '') <> 'magies/potentiel-illimite'
  UNION ALL
  SELECT ps.personnage_id, 'sort_puissance', ps.sort_id || ' : NPM ' || s.niveau
  FROM personnage_sort ps
  JOIN sort s ON s.id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  LEFT JOIN magie_npm_plafond mp ON mp.magie_id = p.magie_innee_id
  WHERE s.niveau > (SELECT MAX(g.puissance_magique) FROM niveau_global g
                    WHERE g.niveau <= n.niveau_global AND (p.magie_acquise_id IS NULL OR g.puissance_magique_note IS NULL))
     OR (s.niveau > mp.npm
         AND NOT EXISTS (SELECT 1 FROM v_personnage_don_acquis a JOIN capacite_npm_plafond c ON c.capacite_id = a.capacite_id
                         WHERE a.personnage_id = ps.personnage_id AND c.npm >= s.niveau))
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_plafond', ps.sort_id || ' = ' || ps.niveau_maitrise
  FROM personnage_sort ps
  WHERE ps.niveau_maitrise > (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_max')
  UNION ALL
  SELECT ps.personnage_id, 'sort_nm_max', ps.sort_id || ' = ' || (ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END)
  FROM personnage_sort ps
  LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
  JOIN personnage p ON p.id = ps.personnage_id
  JOIN v_personnage_niveau n ON n.personnage_id = ps.personnage_id
  WHERE ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END > n.niveau_global - (SELECT r.valeur FROM regle_constante r WHERE r.id = 'sort.nm_ecart_niveau_global') + p.nm_mj
  UNION ALL
  -- NM gagnés : ceux des niveaux (v_niveau.niveaux_maitrise_cumul), plus ceux qu'écrit un don acquis (« Gagne 4 niveaux de maîtrise (NM). » de
  -- l'Ocultomancien : capacite_nm_gagne, v_personnage_don_acquis ; décision R154, migration 0076), plus ceux du MJ ; sort_nm_max ne les lit pas.
  -- Détail : « comptés / des niveaux », puis « + N des dons » et « + N du MJ » quand il y en a
  SELECT n.personnage_id, 'sorts_nm_total', (SELECT SUM(ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END) FROM personnage_sort ps
                                             LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
                                             WHERE ps.personnage_id = n.personnage_id) || ' / '
         || v.niveaux_maitrise_cumul || CASE WHEN d.nm > 0 THEN ' + ' || d.nm || ' des dons' ELSE '' END
         || CASE WHEN p.nm_mj > 0 THEN ' + ' || p.nm_mj || ' du MJ' ELSE '' END
  FROM v_personnage_niveau n JOIN v_niveau v ON v.niveau = n.niveau_global JOIN personnage p ON p.id = n.personnage_id
  JOIN (SELECT q.id AS personnage_id, COALESCE((SELECT SUM(g.nm) FROM v_personnage_don_acquis a JOIN capacite_nm_gagne g ON g.capacite_id = a.capacite_id
                                                WHERE a.personnage_id = q.id), 0) AS nm
        FROM personnage q) d ON d.personnage_id = n.personnage_id
  WHERE (SELECT SUM(ps.niveau_maitrise - CASE WHEN l.sort_id IS NULL OR ps.niveau_maitrise = 0 THEN 0 ELSE 1 END) FROM personnage_sort ps
         LEFT JOIN personnage_livre_sort l ON l.personnage_id = ps.personnage_id AND l.sort_id = ps.sort_id
         WHERE ps.personnage_id = n.personnage_id) > v.niveaux_maitrise_cumul + d.nm + p.nm_mj
  UNION ALL
  -- Bouclier (décision R96) : une forme et une matière ; la matière, l'amélioration ou la solidité n'existent qu'avec la forme, et la forme attend sa matière
  SELECT p.id, 'bouclier_manquant', COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT))
  FROM personnage p
  WHERE p.bouclier_classe_id IS NULL AND COALESCE(p.bouclier_materiau_id, p.bouclier_amelioration_id, CAST(p.bouclier_solidite AS TEXT)) IS NOT NULL
  UNION ALL
  SELECT p.id, 'bouclier_matiere_manquante', p.bouclier_classe_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NULL
  UNION ALL
  -- la forme et la matière désignent un bouclier de la liste (table bouclier) : un couple que l'onglet Boucliers n'écrit pas est signalé
  SELECT p.id, 'bouclier_inconnu', p.bouclier_classe_id || ' + ' || p.bouclier_materiau_id
  FROM personnage p
  WHERE p.bouclier_classe_id IS NOT NULL AND p.bouclier_materiau_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM bouclier b WHERE b.classe_id = p.bouclier_classe_id AND b.materiau_id = p.bouclier_materiau_id)
  UNION ALL
  -- Posture Symbiose (décision R100) : sa magie est la magie innée ou la magie acquise du personnage, pas le Potentiel Illimité (question Q15)
  SELECT p.id, 'symbiose_magie', p.symbiose_magie_id
  FROM personnage p
  WHERE p.symbiose_magie_id IS NOT NULL
    AND (p.symbiose_magie_id = 'magies/potentiel-illimite' OR p.symbiose_magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, '')))
  UNION ALL
  -- Maîtrises d'armes (décisions R148 à R151, migration 0076) : chaque point à choisir d'une source acquise (v_personnage_maitrise_part) a sa famille
  -- (personnage_maitrise_choix), parmi les options de sa part ; une ligne de choix relève d'une seule de ces règles : sur une famille sans maîtrise,
  -- maitrise_arme_exclue (ARME DE MONSTRES, R45) ; sinon, d'une source qui n'est plus acquise ou d'un point qu'elle n'a pas, maitrise_source_perdue ;
  -- sinon, hors des options, maitrise_hors_choix. Détail d'une ligne de choix : « source : point = famille ».
  -- Point sans famille (R148) : détail « source = nombre de points à choisir » ; l'accessoire « Un point de maîtrise d'arme » sans famille (R151),
  -- « accessoire:<emplacement> = 1 »
  SELECT a.personnage_id, 'maitrise_a_choisir', a.source_id || ' = ' || (a.points - (SELECT count(*) FROM personnage_maitrise_choix ch
                                                 WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points))
  FROM v_personnage_maitrise_part a
  WHERE a.genre = 'choix'
    AND (SELECT count(*) FROM personnage_maitrise_choix ch WHERE ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points) < a.points
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_a_choisir', 'accessoire:' || pa.emplacement || ' = ' || e.valeur
  FROM personnage_accessoire pa JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  WHERE pa.arme_famille_id IS NULL
  UNION ALL
  -- Maîtrise d'arme : pas sur une famille qui n'en a pas (arme_famille.maitrisable = 0 : ARME DE MONSTRES, armes exclusives aux monstres, décision R45),
  -- ni par un choix ni par l'accessoire (« accessoire:<emplacement> : 1 = famille »)
  SELECT ch.personnage_id, 'maitrise_arme_exclue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  SELECT pa.personnage_id, 'maitrise_arme_exclue', 'accessoire:' || pa.emplacement || ' : 1 = ' || pa.arme_famille_id
  FROM personnage_accessoire pa
  JOIN accessoire_effet_cible e ON e.effet_id = pa.accessoire_effet_id AND e.cible = 'maitrise_arme'
  JOIN arme_famille f ON f.id = pa.arme_famille_id
  WHERE f.maitrisable = 0
  UNION ALL
  -- Choix d'une source perdue (classe changée, spécialité perdue, niveau baissé, don à choix retiré) ou d'un point que sa part n'a pas : la page retire
  -- ces choix (comme acquisChoixValables), la base les signale
  SELECT ch.personnage_id, 'maitrise_source_perdue', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch JOIN arme_famille f ON f.id = ch.arme_famille_id
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM v_personnage_maitrise_part a WHERE a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix'
                      AND ch.rang <= a.points)
  UNION ALL
  -- Famille qui n'est pas une option de la part (Ménestrel : les quatre familles à distance, R151 ; « sauf », R138 ; catégorie, R127)
  SELECT ch.personnage_id, 'maitrise_hors_choix', ch.source || ' : ' || ch.rang || ' = ' || ch.arme_famille_id
  FROM personnage_maitrise_choix ch
  JOIN arme_famille f ON f.id = ch.arme_famille_id
  JOIN v_personnage_maitrise_part a ON a.personnage_id = ch.personnage_id AND a.source_id = ch.source AND a.genre = 'choix' AND ch.rang <= a.points
  WHERE f.maitrisable = 1
    AND NOT EXISTS (SELECT 1 FROM maitrise_arme_part_famille o WHERE o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id)
  UNION ALL
  -- Limite écrite par famille (R150 : Maître d'arme 2, Combattant libre 3, lignes Bimane, Frappeur, Mercenaire 1 ; « catégorie » = famille, seuls les
  -- points de cette source comptent) ; sans limite écrite, la même famille peut revenir. Détail : « source : famille = points / limite »
  SELECT a.personnage_id, 'maitrise_meme_famille', a.source_id || ' : ' || ch.arme_famille_id || ' = ' || COUNT(*) || ' / ' || a.limite_famille
  FROM v_personnage_maitrise_part a
  JOIN personnage_maitrise_choix ch ON ch.personnage_id = a.personnage_id AND ch.source = a.source_id AND ch.rang <= a.points
  JOIN maitrise_arme_part_famille o ON o.source_id = a.source_id AND o.rang = a.rang AND o.arme_famille_id = ch.arme_famille_id
  WHERE a.genre = 'choix' AND a.limite_famille IS NOT NULL
  GROUP BY a.personnage_id, a.source_id, a.limite_famille, ch.arme_famille_id
  HAVING COUNT(*) > a.limite_famille
  UNION ALL
  -- Plafond (R149) : 4 points au plus par famille (maitrise_arme.des_max − maitrise_arme.des_sans_maitrise), les sources additionnées ; au-delà, signalé
  -- sans rien refuser, les points en trop ne donnent pas de dé. Détail : « famille = points / plafond »
  SELECT m.personnage_id, 'maitrise_plafond', m.arme_famille_id || ' = ' || m.points || ' / ' || m.points_comptes
  FROM v_personnage_maitrise_arme m
  WHERE m.points > m.points_comptes
  UNION ALL
  -- Dons « Variable » du Mage Bleu (décision R181) : un don acquis (v_personnage_don_acquis) de capacite_variable obtient une entrée du tableau libre
  -- de sa classe (classe_annexe_entree), sur la ligne de sa magie innée, ou acquise pour Secondaire (capacite_variable.magie). Don qui vise la magie
  -- acquise sans magie acquise : il ne se choisit pas (détail : le don)
  SELECT a.personnage_id, 'don_obtenu_sans_magie_acquise', a.capacite_id
  FROM v_personnage_don_acquis a
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = a.personnage_id
  WHERE v.magie = 'acquise' AND p.magie_acquise_id IS NULL
  UNION ALL
  -- Don acquis sans choix, quand sa liste garde une entrée que la fiche n'a pas prise (« chaque entrée ne se prend qu'une fois ») : sans entrée libre
  -- (une magie à 3 entrées pour 4 dons « Variable », question Q96 ; une magie absente ou sans ligne), rien n'est exigé (détail : le don)
  SELECT a.personnage_id, 'don_obtenu_a_choisir', a.capacite_id
  FROM v_personnage_don_acquis a
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = a.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM personnage_don_obtenu o WHERE o.personnage_id = a.personnage_id AND o.source = a.capacite_id)
    AND EXISTS (SELECT 1 FROM classe_annexe x JOIN classe_annexe_entree e ON e.classe_id = x.classe_id AND e.annexe_rang = x.rang
                WHERE x.classe_id = a.classe_id
                  AND x.magie_id = CASE v.magie WHEN 'innee' THEN p.magie_innee_id ELSE p.magie_acquise_id END
                  AND NOT EXISTS (SELECT 1 FROM personnage_don_obtenu o WHERE o.personnage_id = a.personnage_id AND o.entree_id = e.id))
  UNION ALL
  -- Un choix relève d'une seule règle : d'un don qui n'est plus acquis (classe, spécialité, niveau, don à choix perdus) ou qui n'est pas un don
  -- « Variable », don_obtenu_source_perdue (gardé sans effet, comme maitrise_source_perdue) ; sinon, d'une entrée hors de la liste du don (autre classe,
  -- autre magie, magie visée absente), don_obtenu_hors_liste. Détail : « source = entrée »
  SELECT o.personnage_id, 'don_obtenu_source_perdue', o.source || ' = ' || o.entree_id
  FROM personnage_don_obtenu o
  WHERE NOT EXISTS (SELECT 1 FROM v_personnage_don_acquis a JOIN capacite_variable v ON v.capacite_id = a.capacite_id
                    WHERE a.personnage_id = o.personnage_id AND a.capacite_id = o.source)
  UNION ALL
  SELECT o.personnage_id, 'don_obtenu_hors_liste', o.source || ' = ' || o.entree_id
  FROM personnage_don_obtenu o
  JOIN v_personnage_don_acquis a ON a.personnage_id = o.personnage_id AND a.capacite_id = o.source
  JOIN capacite_variable v ON v.capacite_id = a.capacite_id
  JOIN personnage p ON p.id = o.personnage_id
  WHERE NOT EXISTS (SELECT 1 FROM classe_annexe_entree e JOIN classe_annexe x ON x.classe_id = e.classe_id AND x.rang = e.annexe_rang
                    WHERE e.id = o.entree_id AND x.classe_id = a.classe_id
                      AND x.magie_id = CASE v.magie WHEN 'innee' THEN p.magie_innee_id ELSE p.magie_acquise_id END)
  UNION ALL
  -- Équipement : chaque amélioration vise le bon genre d'objet ; celle d'une arme, du catalogue ou élémentaire, est une ligne du tableau fondu des armes
  -- (cible 'arme' : décision R167, migration 0081)
  SELECT pa.personnage_id, 'amelioration_cible', pa.rang || ' : ' || ae.id
  FROM personnage_arme pa JOIN amelioration_equipement ae ON ae.id = pa.amelioration_id
  WHERE ae.cible <> 'arme'
  UNION ALL
  -- Arme élémentaire d'une magie que le personnage n'a ni en innée ni en acquise (page « Pièces élémentaires » : « il est nécessaire de posséder la magie
  -- pour utiliser les armes ou les armures » ; décision R167 : « les armes élémentaires de ses magies (innée et acquise, sans le Potentiel Illimité) »,
  -- le Potentiel Illimité n'en ouvre aucune autre) : signalée, jamais refusée. Détail : « rang : arme élémentaire »
  SELECT pa.personnage_id, 'arme_elementaire_hors_magie', pa.rang || ' : ' || ael.id
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN personnage p ON p.id = pa.personnage_id
  WHERE ael.magie_id <> COALESCE(p.magie_innee_id, '') AND ael.magie_id <> COALESCE(p.magie_acquise_id, '')
  UNION ALL
  -- Type physique choisi (personnage_arme.type_degats_choisi ; décision R167, Bombe : « Au choix » entre Estoc, Frappe et Taille) sur une arme élémentaire
  -- dont le type ne se choisit pas (arme_elementaire_type.type_degats_au_choix = 0), ou hors des types qu'offre son type élémentaire
  -- (arme_elementaire_type_degats) : signalé, jamais refusé (une arme du catalogue, elle, le refuse : CHECK). Détail : « rang : type choisi »
  SELECT pa.personnage_id, 'arme_type_degats_choisi', pa.rang || ' : ' || pa.type_degats_choisi
  FROM personnage_arme pa
  JOIN arme_elementaire ael ON ael.id = pa.arme_elementaire_id
  JOIN arme_elementaire_type t ON t.type_id = ael.type_id
  WHERE pa.type_degats_choisi IS NOT NULL
    AND (t.type_degats_au_choix = 0
         OR NOT EXISTS (SELECT 1 FROM arme_elementaire_type_degats d WHERE d.type_id = t.type_id AND d.type_degats = pa.type_degats_choisi))
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_id
  WHERE ae.cible <> 'armure'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'armure élémentaire : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.armure_amelioration_elementaire_id
  WHERE ae.cible <> 'armure_elementaire'
  UNION ALL
  SELECT p.id, 'amelioration_cible', 'bouclier : ' || ae.id
  FROM personnage p JOIN amelioration_equipement ae ON ae.id = p.bouclier_amelioration_id
  WHERE ae.cible <> 'bouclier'
  UNION ALL
  -- Armure (décisions R95, R165) : une armure, de base ou élémentaire, jamais les deux (armure_double ; détail « armure / armure élémentaire ») ; une
  -- amélioration n'existe qu'avec son armure (armure_manquante) ; jamais une armure « Familier » (armure_familier) ; une armure élémentaire d'une
  -- magie innée ou acquise du personnage (armure_magie_absente ; le Potentiel Illimité n'en a pas) ; une partie n'a de solidité que si l'armure
  -- l'a (armure_partie_hors_armure) : une armure élémentaire a ses six parties, jamais « armure-complete » ; une armure de base à solidité unifiée
  -- (armure.solidite_uni = 1) n'a que « armure-complete », les autres les six parties (sans armure, toute partie est signalée ; une armure élémentaire
  -- compte comme une armure sans cran uni). Une fiche qui porte les deux armures est jugée sur l'élémentaire.
  SELECT p.id, 'armure_double', p.armure_id || ' / ' || p.armure_elementaire_id
  FROM personnage p
  WHERE p.armure_id IS NOT NULL AND p.armure_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_id
  FROM personnage p
  WHERE p.armure_id IS NULL AND p.armure_amelioration_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_manquante', p.armure_amelioration_elementaire_id
  FROM personnage p
  WHERE p.armure_elementaire_id IS NULL AND p.armure_amelioration_elementaire_id IS NOT NULL
  UNION ALL
  SELECT p.id, 'armure_familier', p.armure_id
  FROM personnage p JOIN armure a ON a.id = p.armure_id
  WHERE a.type = 'Familier'
  UNION ALL
  SELECT p.id, 'armure_magie_absente', p.armure_elementaire_id
  FROM personnage p JOIN armure_elementaire e ON e.id = p.armure_elementaire_id
  WHERE e.magie_id NOT IN (coalesce(p.magie_innee_id, ''), coalesce(p.magie_acquise_id, ''))
  UNION ALL
  SELECT ap.personnage_id, 'armure_partie_hors_armure', ap.emplacement_id
  FROM personnage_armure_partie ap JOIN personnage p ON p.id = ap.personnage_id LEFT JOIN armure a ON a.id = p.armure_id
  WHERE (p.armure_elementaire_id IS NULL AND a.id IS NULL)
     OR (CASE WHEN p.armure_elementaire_id IS NOT NULL THEN 0 ELSE COALESCE(a.solidite_uni, 0) END = 1) <> (ap.emplacement_id = 'armure-complete')
  UNION ALL
  -- Accessoire : valeur tirée dans la fourchette de l'effet
  SELECT pa.personnage_id, 'accessoire_valeur', pa.emplacement || ' = ' || COALESCE(CAST(pa.valeur AS TEXT), '(absente)')
  FROM personnage_accessoire pa JOIN accessoire_effet ae ON ae.id = pa.accessoire_effet_id
  WHERE (ae.bonus_min IS NULL) <> (pa.valeur IS NULL)
     OR pa.valeur < ae.bonus_min OR pa.valeur > ae.bonus_max;
UPDATE magie SET explication = replace(explication, '
- Classe unique = Archimage.
', '
')
  WHERE id = 'magies/potentiel-illimite' AND length(explication) - length(replace(explication, '
- Classe unique = Archimage.
', '')) = length('
- Classe unique = Archimage.
');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('Potentiel Illimité : explication', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '- Classe unique = Archimage.
- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).', '- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).')
  WHERE id = 'magies/potentiel-illimite' AND length(corps_md) - length(replace(corps_md, '- Classe unique = Archimage.
- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).', '')) = length('- Classe unique = Archimage.
- Surtension corporelle (Vulnérabilité contre les dégâts physiques, ne peut mettre plus de 5 Santé lors de la répartition des points lors du passage de niveau global).');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page magies/potentiel-illimite : Classe unique', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 7. Textes écrits par le site (R238) : guide/l-univers (41 classes, 82 spécialités), guide/choisir-sa-classe (l'Archimage n'est plus imposée) ;
--    « Classes accessibles » des 27 pages de race (nombre et liste, lib/corps-races.mjs, comme une classe créée sur le site).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE page SET corps_md = replace(corps_md, '**39 classes** et **78 spécialités**', '**41 classes** et **82 spécialités**')
  WHERE id = 'guide/l-univers' AND length(corps_md) - length(replace(corps_md, '**39 classes** et **78 spécialités**', '')) = length('**39 classes** et **78 spécialités**');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/l-univers : nombre de classes', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'en magie innée, il impose l’Archimage comme première classe (une classe réservée à lui seul), et il ne peut jamais prendre le Mage Bleu.', 'en magie innée, il peut prendre l’Archimage (une classe réservée à lui seul) sans y être obligé, et il ne peut jamais prendre le Mage Bleu.')
  WHERE id = 'guide/choisir-sa-classe' AND length(corps_md) - length(replace(corps_md, 'en magie innée, il impose l’Archimage comme première classe (une classe réservée à lui seul), et il ne peut jamais prendre le Mage Bleu.', '')) = length('en magie innée, il impose l’Archimage comme première classe (une classe réservée à lui seul), et il ne peut jamais prendre le Mage Bleu.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/choisir-sa-classe : Archimage non imposée', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Anansi', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Anansi, Boxeur, Porte-étendard')
  WHERE id = 'races/anansi' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Anansi', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Anansi');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/anansi : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/drakos' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/drakos : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/drassahthac' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/drassahthac : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/elfe-argente' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/elfe-argente : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/elfe-dore' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/elfe-dore : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/elfe-forestier' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/elfe-forestier : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/elfe-noir' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/elfe-noir : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/farfadet' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/farfadet : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/felfe' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/felfe : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Fenrir', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Fenrir, Boxeur, Porte-étendard')
  WHERE id = 'races/fenrir' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Fenrir', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Fenrir');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/fenrir : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Goleois', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Goleois, Boxeur, Porte-étendard')
  WHERE id = 'races/goleois' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Goleois', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Goleois');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/goleois : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/hujin' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/hujin : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/humain' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/humain : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Jackalope', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Jackalope, Boxeur, Porte-étendard')
  WHERE id = 'races/jackalope' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Jackalope', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Jackalope');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/jackalope : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Kitsune', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Kitsune, Boxeur, Porte-étendard')
  WHERE id = 'races/kitsune' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Kitsune', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Kitsune');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/kitsune : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/lamia' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/lamia : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/majin' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/majin : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Marcass', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Marcass, Boxeur, Porte-étendard')
  WHERE id = 'races/marcass' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Marcass', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Marcass');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/marcass : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 24 sur 39.

Lancier, Martiale, Moine, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Médusain', 'Nombre : 26 sur 41.

Lancier, Martiale, Moine, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Médusain, Boxeur, Porte-étendard')
  WHERE id = 'races/medusain' AND length(corps_md) - length(replace(corps_md, 'Nombre : 24 sur 39.

Lancier, Martiale, Moine, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Médusain', '')) = length('Nombre : 24 sur 39.

Lancier, Martiale, Moine, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Médusain');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/medusain : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Minotaure', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Minotaure, Boxeur, Porte-étendard')
  WHERE id = 'races/minotaure' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Minotaure', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Minotaure');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/minotaure : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/mort-vivant' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/mort-vivant : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', 'Nombre : 28 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Boxeur, Porte-étendard')
  WHERE id = 'races/nain' AND length(corps_md) - length(replace(corps_md, 'Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur', '')) = length('Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/nain : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Namazu', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Namazu, Boxeur, Porte-étendard')
  WHERE id = 'races/namazu' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Namazu', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Namazu');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/namazu : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Olwman', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Olwman, Boxeur, Porte-étendard')
  WHERE id = 'races/olwman' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Olwman', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Olwman');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/olwman : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Orios', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Orios, Boxeur, Porte-étendard')
  WHERE id = 'races/orios' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Orios', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Orios');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/orios : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Rokh', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Rokh, Boxeur, Porte-étendard')
  WHERE id = 'races/rokh' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Rokh', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Rokh');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/rokh : classes accessibles', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Satyre', 'Nombre : 29 sur 41.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Satyre, Boxeur, Porte-étendard')
  WHERE id = 'races/satyre' AND length(corps_md) - length(replace(corps_md, 'Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Satyre', '')) = length('Nombre : 27 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur, Satyre');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('page races/satyre : classes accessibles', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 8. Matériaux d'armes (R241) : effets secondaires du docx, tels quels (balises vers les mots-clés existants, comme la table : corruption,
--    barriere, sort-fer) ; bonus de dégâts inchangés ; Fer, Fonte et Bronze inchangés (crans dans cran_solidite) ; Titane : l'avantage remplace
--    son +1 cran (cran_solidite NULL). effet_brut = « Dégâts +N pour l'arme » + l'effet ; colonnes relues par lib/arme-champs.mjs#analyserEffetDeMateriau.
--    Tableau des matériaux de ressources/armes (lib/corps-armes.mjs#corpsDesArmesApres).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE materiau_arme SET effet_brut = 'Dégâts +2 pour l''arme
Une fois par combat, permet de relancer les dés de dégâts, mais le second résultat doit être conservé.', cran_solidite = NULL, effet_secondaire = 'Une fois par combat, permet de relancer les dés de dégâts, mais le second résultat doit être conservé.'
  WHERE ressource_id = 'ressources/armures#materiau:acier' AND effet_brut = 'Dégâts +2 pour l''arme' AND bonus_degats = 2;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme acier', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Acier | 200 RF / 20 RO | Dégâts +2 pour l''arme |', '| Acier | 200 RF / 20 RO | Dégâts +2 pour l''arme<br>Une fois par combat, permet de relancer les dés de dégâts, mais le second résultat doit être conservé. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Acier | 200 RF / 20 RO | Dégâts +2 pour l''arme |', '')) = length('| Acier | 200 RF / 20 RO | Dégâts +2 pour l''arme |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau acier', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +3 pour l''arme
Si la cible ne possède pas de {{corruption|corruption}}, lui inflige 4 points de {{corruption|corruption}}. Si elle possède déjà de la {{corruption|corruption}}, inflige +2 dégâts et 2 de {{corruption|corruption}}.', cran_solidite = NULL, effet_secondaire = 'Si la cible ne possède pas de {{corruption|corruption}}, lui inflige 4 points de {{corruption|corruption}}. Si elle possède déjà de la {{corruption|corruption}}, inflige +2 dégâts et 2 de {{corruption|corruption}}.'
  WHERE ressource_id = 'ressources/armures#materiau:fer-noir' AND effet_brut = 'Dégâts +3 pour l''arme
1d4 de {{corruption|corruption}} à chaque coup qui touche' AND bonus_degats = 3;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme fer-noir', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Fer noir | 350 RF / 35 RO | Dégâts +3 pour l''arme<br>1d4 de {{corruption\|corruption}} à chaque coup qui touche |', '| Fer noir | 350 RF / 35 RO | Dégâts +3 pour l''arme<br>Si la cible ne possède pas de {{corruption\|corruption}}, lui inflige 4 points de {{corruption\|corruption}}. Si elle possède déjà de la {{corruption\|corruption}}, inflige +2 dégâts et 2 de {{corruption\|corruption}}. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Fer noir | 350 RF / 35 RO | Dégâts +3 pour l''arme<br>1d4 de {{corruption\|corruption}} à chaque coup qui touche |', '')) = length('| Fer noir | 350 RF / 35 RO | Dégâts +3 pour l''arme<br>1d4 de {{corruption\|corruption}} à chaque coup qui touche |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau fer-noir', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +4 pour l''arme
+1 dé de dégâts contre les non-morts.', cran_solidite = NULL, effet_secondaire = '+1 dé de dégâts contre les non-morts.'
  WHERE ressource_id = 'ressources/armures#materiau:argent' AND effet_brut = 'Dégâts +4 pour l''arme
+1d de dégâts contre les non-morts' AND bonus_degats = 4;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme argent', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Argent | 350 RF / 35 RO | Dégâts +4 pour l''arme<br>+1d de dégâts contre les non-morts |', '| Argent | 350 RF / 35 RO | Dégâts +4 pour l''arme<br>+1 dé de dégâts contre les non-morts. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Argent | 350 RF / 35 RO | Dégâts +4 pour l''arme<br>+1d de dégâts contre les non-morts |', '')) = length('| Argent | 350 RF / 35 RO | Dégâts +4 pour l''arme<br>+1d de dégâts contre les non-morts |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau argent', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +5 pour l''arme
Les {{sort-fer|sorts de type « Fer »}} appliqués à l''arme durent un tour supplémentaire, soit 4 tours au lieu de 3.', cran_solidite = NULL, effet_secondaire = 'Les {{sort-fer|sorts de type « Fer »}} appliqués à l''arme durent un tour supplémentaire, soit 4 tours au lieu de 3.'
  WHERE ressource_id = 'ressources/armures#materiau:cuivre' AND effet_brut = 'Dégâts +5 pour l''arme' AND bonus_degats = 5;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme cuivre', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Cuivre | 400 RF / 40 RO | Dégâts +5 pour l''arme |', '| Cuivre | 400 RF / 40 RO | Dégâts +5 pour l''arme<br>Les {{sort-fer\|sorts de type « Fer »}} appliqués à l''arme durent un tour supplémentaire, soit 4 tours au lieu de 3. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Cuivre | 400 RF / 40 RO | Dégâts +5 pour l''arme |', '')) = length('| Cuivre | 400 RF / 40 RO | Dégâts +5 pour l''arme |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau cuivre', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +6 pour l''arme
+1 dé de dégâts contre les bêtes.', cran_solidite = NULL, effet_secondaire = '+1 dé de dégâts contre les bêtes.'
  WHERE ressource_id = 'ressources/armes#materiau:os' AND effet_brut = 'Dégâts +6 pour l''arme' AND bonus_degats = 6;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme os', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Os | 800 RF / 80 RO | Dégâts +6 pour l''arme |', '| Os | 800 RF / 80 RO | Dégâts +6 pour l''arme<br>+1 dé de dégâts contre les bêtes. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Os | 800 RF / 80 RO | Dégâts +6 pour l''arme |', '')) = length('| Os | 800 RF / 80 RO | Dégâts +6 pour l''arme |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau os', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +7 pour l''arme
+1 dé de dégâts contre les créatures mécaniques ou inertes.', cran_solidite = NULL, effet_secondaire = '+1 dé de dégâts contre les créatures mécaniques ou inertes.'
  WHERE ressource_id = 'ressources/armures#materiau:laiton' AND effet_brut = 'Dégâts +7 pour l''arme
dégâts doublés contre la {{barriere|barrière}}' AND bonus_degats = 7;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme laiton', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Laiton | 900 RF / 90 RO | Dégâts +7 pour l''arme<br>dégâts doublés contre la {{barriere\|barrière}} |', '| Laiton | 900 RF / 90 RO | Dégâts +7 pour l''arme<br>+1 dé de dégâts contre les créatures mécaniques ou inertes. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Laiton | 900 RF / 90 RO | Dégâts +7 pour l''arme<br>dégâts doublés contre la {{barriere\|barrière}} |', '')) = length('| Laiton | 900 RF / 90 RO | Dégâts +7 pour l''arme<br>dégâts doublés contre la {{barriere\|barrière}} |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau laiton', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +8 pour l''arme
+1 dé de dégâts contre les démons.', cran_solidite = NULL, effet_secondaire = '+1 dé de dégâts contre les démons.'
  WHERE ressource_id = 'ressources/armures#materiau:or' AND effet_brut = 'Dégâts +8 pour l''arme
+1d de dégâts contre les démons' AND bonus_degats = 8;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme or', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Or | 100 RO | Dégâts +8 pour l''arme<br>+1d de dégâts contre les démons |', '| Or | 100 RO | Dégâts +8 pour l''arme<br>+1 dé de dégâts contre les démons. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Or | 100 RO | Dégâts +8 pour l''arme<br>+1d de dégâts contre les démons |', '')) = length('| Or | 100 RO | Dégâts +8 pour l''arme<br>+1d de dégâts contre les démons |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau or', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +6 pour l''arme
Permet de toucher les êtres immatériels.', cran_solidite = NULL, effet_secondaire = 'Permet de toucher les êtres immatériels.'
  WHERE ressource_id = 'ressources/armures#materiau:vif-argent' AND effet_brut = 'Dégâts +6 pour l''arme
Touche l''immatériel' AND bonus_degats = 6;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme vif-argent', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Vif argent | 300 RO | Dégâts +6 pour l''arme<br>Touche l''immatériel |', '| Vif argent | 300 RO | Dégâts +6 pour l''arme<br>Permet de toucher les êtres immatériels. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Vif argent | 300 RO | Dégâts +6 pour l''arme<br>Touche l''immatériel |', '')) = length('| Vif argent | 300 RO | Dégâts +6 pour l''arme<br>Touche l''immatériel |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau vif-argent', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +8 pour l''arme
Si l''arme touche une {{barriere|barrière}}, elle inflige +1 dé de dégâts.', cran_solidite = NULL, effet_secondaire = 'Si l''arme touche une {{barriere|barrière}}, elle inflige +1 dé de dégâts.'
  WHERE ressource_id = 'ressources/armures#materiau:mythril' AND effet_brut = 'Dégâts +8 pour l''arme
Passe {{barriere|barrière}}' AND bonus_degats = 8;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme mythril', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Mythril | 200 RO | Dégâts +8 pour l''arme<br>Passe {{barriere\|barrière}} |', '| Mythril | 200 RO | Dégâts +8 pour l''arme<br>Si l''arme touche une {{barriere\|barrière}}, elle inflige +1 dé de dégâts. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Mythril | 200 RO | Dégâts +8 pour l''arme<br>Passe {{barriere\|barrière}} |', '')) = length('| Mythril | 200 RO | Dégâts +8 pour l''arme<br>Passe {{barriere\|barrière}} |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau mythril', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +9 pour l''arme
Avantage contre les effets de désarmement.', cran_solidite = NULL, effet_secondaire = 'Avantage contre les effets de désarmement.'
  WHERE ressource_id = 'ressources/armures#materiau:titane' AND effet_brut = 'Dégâts +9 pour l''arme
+1 cran de solidité' AND bonus_degats = 9;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme titane', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Titane | 200 RO | Dégâts +9 pour l''arme<br>+1 cran de solidité |', '| Titane | 200 RO | Dégâts +9 pour l''arme<br>Avantage contre les effets de désarmement. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Titane | 200 RO | Dégâts +9 pour l''arme<br>+1 cran de solidité |', '')) = length('| Titane | 200 RO | Dégâts +9 pour l''arme<br>+1 cran de solidité |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau titane', changes(), 1);
UPDATE materiau_arme SET effet_brut = 'Dégâts +10 pour l''arme
Si la créature ne possède pas ou plus de {{barriere|barrière}}, l''arme inflige +1 dé de dégâts.', cran_solidite = NULL, effet_secondaire = 'Si la créature ne possède pas ou plus de {{barriere|barrière}}, l''arme inflige +1 dé de dégâts.'
  WHERE ressource_id = 'ressources/armures#materiau:maverium' AND effet_brut = 'Dégâts +10 pour l''arme
Casse {{barriere|barrière}}' AND bonus_degats = 10;
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('materiau_arme maverium', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '| Maverium | 400 RO | Dégâts +10 pour l''arme<br>Casse {{barriere\|barrière}} |', '| Maverium | 400 RO | Dégâts +10 pour l''arme<br>Si la créature ne possède pas ou plus de {{barriere\|barrière}}, l''arme inflige +1 dé de dégâts. |')
  WHERE id = 'ressources/armes' AND length(corps_md) - length(replace(corps_md, '| Maverium | 400 RO | Dégâts +10 pour l''arme<br>Casse {{barriere\|barrière}} |', '')) = length('| Maverium | 400 RO | Dégâts +10 pour l''arme<br>Casse {{barriere\|barrière}} |');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('ressources/armes : matériau maverium', changes(), 1);

-- Barrière (R241 (3)) : les anciens effets du Mythril, du Maverium et du Laiton sont supprimés ; la phrase qui les cite est retirée ou remplacée par l'effet du
-- docx (R224 (1) dans une copie : seule la phrase fausse). Le bestiaire (« Anti-barrière ») et le carreau « Pré-mythril » restent tels quels.
UPDATE mot_cle SET description = replace(description, ' Certains matériaux d’arme la contrent : le Mythril passe à travers, le Maverium la brise à son contact.', '')
  WHERE id = 37 AND length(description) - length(replace(description, ' Certains matériaux d’arme la contrent : le Mythril passe à travers, le Maverium la brise à son contact.', '')) = length(' Certains matériaux d’arme la contrent : le Mythril passe à travers, le Maverium la brise à son contact.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('mot-clé barriere : matériaux', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, ' Le mythril la traverse, et le maverium la brise à son contact.', '')
  WHERE id = 'guide/finaliser-son-personnage' AND length(corps_md) - length(replace(corps_md, ' Le mythril la traverse, et le maverium la brise à son contact.', '')) = length(' Le mythril la traverse, et le maverium la brise à son contact.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/finaliser-son-personnage : matériaux', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, ' colossales MAIS ... il existe des matériaux pour les armes qui sont capables de contrer cette peau magique comme le Mythril qui est capable de passer à travers la {{barriere|barrière}}, mais aussi le Maverium, qui lui, casse la {{barriere|barrière}} à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des {{barriere|barrières}})', ' colossales.')
  WHERE id = 'guide/fiche-attributs' AND length(corps_md) - length(replace(corps_md, ' colossales MAIS ... il existe des matériaux pour les armes qui sont capables de contrer cette peau magique comme le Mythril qui est capable de passer à travers la {{barriere|barrière}}, mais aussi le Maverium, qui lui, casse la {{barriere|barrière}} à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des {{barriere|barrières}})', '')) = length(' colossales MAIS ... il existe des matériaux pour les armes qui sont capables de contrer cette peau magique comme le Mythril qui est capable de passer à travers la {{barriere|barrière}}, mais aussi le Maverium, qui lui, casse la {{barriere|barrière}} à son contact (donc un simple coup d''une arme de Maverium est capable de détruire instantanément la plus colossale des {{barriere|barrières}})');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/fiche-attributs : matériaux', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, ' ; mais certains matériaux d’arme la contrent, comme le **Mythril**, qui passe à travers, ou le **Maverium**, qui la brise à son contact, si colossale soit-elle. Une arme de **Laiton**, elle, fait des dégâts doublés contre la {{barriere|barrière}} (voir l’onglet {{composants|Matériaux}} des composants).', '. Une arme de **Mythril** inflige +1 dé de dégâts si elle touche une barrière ; une arme de **Maverium**, +1 dé de dégâts si la créature ne possède pas ou plus de barrière (voir l’onglet {{composants|Matériaux}} des composants).')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, ' ; mais certains matériaux d’arme la contrent, comme le **Mythril**, qui passe à travers, ou le **Maverium**, qui la brise à son contact, si colossale soit-elle. Une arme de **Laiton**, elle, fait des dégâts doublés contre la {{barriere|barrière}} (voir l’onglet {{composants|Matériaux}} des composants).', '')) = length(' ; mais certains matériaux d’arme la contrent, comme le **Mythril**, qui passe à travers, ou le **Maverium**, qui la brise à son contact, si colossale soit-elle. Une arme de **Laiton**, elle, fait des dégâts doublés contre la {{barriere|barrière}} (voir l’onglet {{composants|Matériaux}} des composants).');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/les-degats : matériaux (1)', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, ' Contre une arme de Laiton, ces deux effets se compensent ; une arme de Maverium, elle, casse la barrière sans tenir compte du Médusain.', '')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, ' Contre une arme de Laiton, ces deux effets se compensent ; une arme de Maverium, elle, casse la barrière sans tenir compte du Médusain.', '')) = length(' Contre une arme de Laiton, ces deux effets se compensent ; une arme de Maverium, elle, casse la barrière sans tenir compte du Médusain.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/les-degats : matériaux (2)', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, '« Passe la barrière » (Mythril, sorts qui l’ignorent), « Casse la barrière » (Maverium), « Dégâts doublés contre la barrière » (Laiton),', '« Passe la barrière » (sorts qui l’ignorent), « Casse la barrière », « Dégâts doublés contre la barrière »,')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, '« Passe la barrière » (Mythril, sorts qui l’ignorent), « Casse la barrière » (Maverium), « Dégâts doublés contre la barrière » (Laiton),', '')) = length('« Passe la barrière » (Mythril, sorts qui l’ignorent), « Casse la barrière » (Maverium), « Dégâts doublés contre la barrière » (Laiton),');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/les-degats : cases de la barrière', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 9. Limite D12 (R252) : la copie « pas plus haut que le D20 » devient « D12 » (R252 (4), R224 (1)) dans posture_effet (Focus, versions guide_fiche et
--    guide_mj) et guide/fiche-tableau-posture ; les pages écrites par le site suivent l'échelle (guide/les-postures, guide/les-degats).
-- --------------------------------------------------------------------------------------------------------------------------------------------
UPDATE posture_effet SET texte = replace(texte, 'plus haut que le D20)', 'plus haut que le D12)')
  WHERE posture_id = 'guide/postures#posture:focus' AND version = 'guide_fiche' AND rang = 3 AND length(texte) - length(replace(texte, 'plus haut que le D20)', '')) = length('plus haut que le D20)');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('posture_effet focus guide_fiche : D12', changes(), 1);
UPDATE posture_effet SET texte = replace(texte, 'plus haut que le D20)', 'plus haut que le D12)')
  WHERE posture_id = 'guide/postures#posture:focus' AND version = 'guide_mj' AND rang = 3 AND length(texte) - length(replace(texte, 'plus haut que le D20)', '')) = length('plus haut que le D20)');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('posture_effet focus guide_mj : D12', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'plus haut que le D20)', 'plus haut que le D12)')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'plus haut que le D20)', '')) = length('plus haut que le D20)');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/fiche-tableau-posture : D12', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'D4, D6, D8, D10, D12, puis D20, jamais au-delà.', 'D4, D6, D8, D10, puis D12, jamais au-delà.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, 'D4, D6, D8, D10, D12, puis D20, jamais au-delà.', '')) = length('D4, D6, D8, D10, D12, puis D20, jamais au-delà.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/les-postures : D12', changes(), 1);
UPDATE page SET corps_md = replace(corps_md, 'D4, D6, D8, D10, D12, puis D20, jamais au-delà.', 'D4, D6, D8, D10, puis D12, jamais au-delà.')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, 'D4, D6, D8, D10, D12, puis D20, jamais au-delà.', '')) = length('D4, D6, D8, D10, D12, puis D20, jamais au-delà.');
INSERT INTO garde_0118 (quoi, lignes, attendu) VALUES ('guide/les-degats : D12', changes(), 1);

-- --------------------------------------------------------------------------------------------------------------------------------------------
-- 10. Table correction : les 26 coquilles R10 des onglets Boxeur, Porte-étendard et Cuirassé V2 (tools/sheets/corrections.json, section magie-v10).
-- --------------------------------------------------------------------------------------------------------------------------------------------
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AM17', 'v', 'Description Carcasse rouillé', 'Description Carcasse rouillée', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : titre de la description de la spécialité CARCASSE ROUILLÉE (bannière A17, cartouche F22 : « rouillée »), accord au féminin (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AM17');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'P5', 'v', 'un dégâts bonus', 'un dégât bonus', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bouclier d''attaque : « dégâts » au pluriel derrière « un » (singulier, comme « divisé par 4 » qui suit) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › P5');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'P12', 'v', 'Les boucliers donne +2AP', 'Les boucliers donnent +2AP', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Mur : verbe accordé au sujet pluriel « Les boucliers » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › P12');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'A30', 'v', 'Réduit le dégâts', 'Réduit les dégâts', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Armure vivante : « dégâts » est pluriel (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › A30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'H30', 'v', 'être déplacer', 'être déplacé', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Poids mort : participe passé après « être » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › H30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'X30', 'v', 'avec les bouclier par', 'avec les boucliers par', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bouragé : pluriel de « les bouclier » (lecture la plus probable ; « le bouclier » donnerait le même sens) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AE30', 'v', 'Une attaque réussi', 'Une attaque réussie', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bouquilibre : accord au féminin avec « attaque » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AE30', 'v', 'désaventage', 'désavantage', 1, 'frappe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bouquilibre : « désavantage » (lettre fautive) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'X37', 'v', 'l''attaque réussi :', 'l''attaque réussit :', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Boupact : verbe « réussit » (3e personne) (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X37');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AE37', 'v', 'Une attaque réussi', 'Une attaque réussie', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bousée : accord au féminin avec « attaque » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE37');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AE37', 'v', 'une malus', 'un malus', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bousée : « malus » est masculin (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE37');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'X44', 'v', 'ignore 1AP', 'ignorent 1AP', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Boucassant : verbe accordé au sujet pluriel « Les attaques » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › X44');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'AE44', 'v', 'Une attaque réussi', 'Une attaque réussie', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Bouvasteur : accord au féminin avec « attaque » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › AE44');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Boxeur', 'G11', 'v', 'Écu bois', 'Écu de bois', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : armure de départ : « de » manquant (l''onglet « Cuirassé V2 », G11, écrit « Écu de bois ») (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Boxeur › G11');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'A7', 'v', '  (sauf', ' (sauf', 1, 'espace', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : maîtrise d''arme : deux espaces avant « (sauf » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A7');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'A7', 'v', 'sauf hast)', 'sauf Hast)', 1, 'casse', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : maîtrise d''arme : « Hast » est le nom de l''arme, écrit « Hast » deux lignes plus haut dans la même cellule et dans la ligne du Cuirassé (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A7');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'D23', 'v', '+2 point de maîtrise', '+2 points de maîtrise', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : cartouche CHEF DE GUERRE : « points » au pluriel après « +2 » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › D23');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'AA23', 'v', '+2 point de maîtrise', '+2 points de maîtrise', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : cartouche STRATEGE DE BATAILLE : « points » au pluriel après « +2 » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › AA23');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'X17', 'v', 'STRATEGE', 'STRATÈGE', 1, 'accent', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : bannière de la seconde spécialité (le cartouche AA22 du même onglet écrit « Stratège de bataille ») ; les majuscules gardent leurs accents, comme « GRAND ARBALÉTRIER » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X17');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'P5', 'v', 'tout les jets', 'tous les jets', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Motivation : « tous les jets » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › P5');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'A30', 'v', 'à côté lui', 'à côté de lui', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Provoc du porteur : « de » manquant dans « à côté de lui » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'X30', 'v', 'au dessus', 'au-dessus', 1, 'orthographe', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Avantage : « au-dessus » prend un trait d''union (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › X30');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'A44', 'v', 'armes à distances', 'armes à distance', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Contre les lâches : « arme à distance » (la catégorie d''armes, R127) reste au singulier (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › A44');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'C36', 'v', 'Repli ! ', 'Repli !', 1, 'espace', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : nom du don de niveau 15 : espace finale (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › C36');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Porte-étendard', 'Z36', 'v', 'Réagir ! ', 'Réagir !', 1, 'espace', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : nom du don de niveau 15 : espace finale (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Porte-étendard › Z36');
INSERT INTO correction (dump, classeur, onglet, cellule, champ, avant, apres, occurrences, nature, note, origine, source_ref) VALUES ('magie-v10', 'Nouveauté mise à jour Décembre', 'Cuirassé V2', 'A37', 'v', 'attaque à moins', 'attaque a moins', 1, 'grammaire', 'Classeur « Nouveauté mise à jour Décembre » (Magie V10, pièce jointe du propriétaire du 2026-11-12), lot 3 « Classes » (R238) : don Écrasant : verbe « a » (« la cible a moins d''AP total »), pas la préposition « à » (R10 : l''orthographe se corrige, jamais un chiffre ni le sens).', 'classes', 'Nouveauté mise à jour Décembre › Cuirassé V2 › A37');

DROP TABLE garde_0118;
