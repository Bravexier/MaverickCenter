-- 0111-relecture-des-regles-contre-les-decisions : relecture des pages des Règles contre les décisions du propriétaire (R224 à R230, réponses du 2026-11-08 ; cahier de
-- game-design, corrections C1 à C26), suite des migrations 0104 et 0107 (même méthode). Migration de DONNÉES et d'une VUE (sections 1, 2, 9 et 13 ;
-- PRAGMA user_version 110 -> 111) ; rien ne va dans historique_modification (la migration n'est pas une modification du site de dev). Registre :
-- 0111-relecture-des-regles-contre-les-decisions.json (`textes` : une entrée par remplacement, avec sa correction C… et sa décision ; `titres`, `alias`, `mots_cles`, `mots_cles_crees`,
-- `constantes` ; pas sous `corrections` : ce ne sont pas des corrections d'un classeur, tools/sources/rapprocher.mjs lit `corrections`).
--   * Nos pages du guide (C1 à C17, C20 à C22, C24, C25) : postures (R198 (6), R111, R226 (2)) ; numéros « (décision R…) » retirés du texte visible
--     (G43) ; libellés de liens = titre de la page visée (R184 (2), (5), (11), R187 (1)) ; ligne perdue à la découpe (R184 (1), R104) ; Grimoire
--     (R189) ; plafond du Potentiel Illimité dans la montée de niveau (R188 ; rien dans guide/premiers-sorts, R224 (4)) ; quatrième façon d'obtenir un NM
--     (R154) ; Surtension corporelle ; maîtrises d'armes ; équipement (9 AP et 9 AM lus dans la table armure en base version 110 ; renvois aux pages de la
--     rubrique Équipement) ; défense contre un critique (R226 (1)) ; tours en trop du Mode Hyper au-delà de la durée seulement (R226 (3)) ; Forgeron et
--     Armurier (R227 (1)) ; santé du Potentiel Illimité (R225).
--   * Copies de source (C18, C19 ; R224 (1), (2), (3)) : seule la phrase qui contredit une décision change, au plus près des mots de la copie.
--   * C26 (R230 (1)) : le texte d'artisanat du Bijoutier (metier.artisanat_texte, sa recopie artisanat_brut et le corps de sa page, rendu de la ligne)
--     ajoute « sauf un accessoire maudit, que seul un Enchanteur retire » (R227 (3)).
--   * C23 (R226 (4)) : guide/liste-des-effets-mode-super s'intitule « Mode Super » ; l'ancien titre devient un alias ; id et adresse inchangés.
--   * Mot-clé reussites-echecs-et-critiques créé (C18, guide/attaque-et-defense : le lien vers la page des critiques) : libellé = titre de la page,
--     sans définition, adresse de la page, verrouillé comme tout mot-clé à adresse (0110, R219 (1)).
--   * R228 : le mot-clé mode-super mène à la page du Mode Super, à l'adresse que lui donne lib/livres.mjs#ADRESSES_RENOMMEES_DU_GUIDE (/regles/mode-super/,
--     l'id de la page ne change pas) ; verrouillé comme tout mot-clé à adresse (0110, R219 (1)). R229 : « Comme expliqué plus haut, » retiré de
--     guide/jet-de-des (corps et résumé).
--   * R225 : regle_constante potentiel_illimite.sante_max_par_niveau (5) et la règle gains_sante_potentiel de v_personnage_controle (vue recréée,
--     copiée de data/schema.sql ; les autres règles sont celles de 0097, inchangées).
-- La garde : chaque UPDATE ne remplace qu'un fragment présent une seule fois dans la valeur d'avant, et doit changer exactement une ligne. Une valeur
-- que le site de dev aurait réécrite arrête la migration.


CREATE TEMP TABLE garde_0111 (quoi TEXT NOT NULL, lignes INTEGER NOT NULL, attendu INTEGER NOT NULL DEFAULT 1, CHECK (lignes = attendu));

-- page.resume

-- guide/les-postures (C1, R198 (6))
UPDATE page SET resume = replace(resume, 'à déclarer au début de chaque tour',
  'que l’on prend ou change au début de son tour et que l’on garde tant qu’on n’en change pas')
  WHERE id = 'guide/les-postures' AND length(resume) - length(replace(resume, 'à déclarer au début de chaque tour', '')) = length('à déclarer au début de chaque tour');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-postures : C1 R198 (6)', changes());

-- page.corps_md

-- guide/les-postures (C2, R111)
UPDATE page SET corps_md = replace(corps_md, 'avec deux magies, l’autre est désactivée le temps de la posture, et tous ses avantages et ses inconvénients avec elle.',
  'avec deux magies, l’autre est désactivée le temps de la posture : elle perd ses sorts et ses résistances et faiblesses, et rien d’autre (son effet de Mode Hyper, sa ressource propre, la santé et le chakra qu’elle offre et le +1 de caractéristique de la magie innée restent).')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, 'avec deux magies, l’autre est désactivée le temps de la posture, et tous ses avantages et ses inconvénients avec elle.', '')) = length('avec deux magies, l’autre est désactivée le temps de la posture, et tous ses avantages et ses inconvénients avec elle.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-postures : C2 R111', changes());

-- guide/les-postures (C3, G43)
UPDATE page SET corps_md = replace(corps_md, '- Exception (décision R167) :',
  '- Exception :')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- Exception (décision R167) :', '')) = length('- Exception (décision R167) :');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-postures : C3 G43', changes());

-- guide/les-postures (C3, G43)
UPDATE page SET corps_md = replace(corps_md, 'les autres armes restent interdites (décision R112).',
  'les autres armes restent interdites.')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, 'les autres armes restent interdites (décision R112).', '')) = length('les autres armes restent interdites (décision R112).');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-postures : C3 G43', changes());

-- guide/l-equipement (C3, G43)
UPDATE page SET corps_md = replace(corps_md, 'son matériau et son amélioration (décision R167).',
  'son matériau et son amélioration.')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'son matériau et son amélioration (décision R167).', '')) = length('son matériau et son amélioration (décision R167).');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C3 G43', changes());

-- guide/l-equipement (C3, G43)
UPDATE page SET corps_md = replace(corps_md, '6 au +10 (décision R167).',
  '6 au +10.')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, '6 au +10 (décision R167).', '')) = length('6 au +10 (décision R167).');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C3 G43', changes());

-- guide/les-degats (C4, R184 (2))
UPDATE page SET corps_md = replace(corps_md, '{{blessure-et-mort|Blessures et états}}',
  '{{blessure-et-mort}}')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, '{{blessure-et-mort|Blessures et états}}', '')) = length('{{blessure-et-mort|Blessures et états}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-degats : C4 R184 (2)', changes());

-- guide/le-mode-hyper (C4, R184 (2))
UPDATE page SET corps_md = replace(corps_md, '{{blessure-et-mort|Blessures et états}}',
  '{{blessure-et-mort}}')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, '{{blessure-et-mort|Blessures et états}}', '')) = length('{{blessure-et-mort|Blessures et états}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/le-mode-hyper : C4 R184 (2)', changes());

-- guide/la-magie-en-jeu (C4, R184 (2))
UPDATE page SET corps_md = replace(corps_md, '{{blessure-et-mort|Blessures et états}}',
  '{{blessure-et-mort}}')
  WHERE id = 'guide/la-magie-en-jeu' AND length(corps_md) - length(replace(corps_md, '{{blessure-et-mort|Blessures et états}}', '')) = length('{{blessure-et-mort|Blessures et états}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-magie-en-jeu : C4 R184 (2)', changes());

-- guide/le-tour-de-jeu (C5, R184 (5))
UPDATE page SET corps_md = replace(corps_md, '{{alteration-detat|Blessures et états}}',
  '{{alteration-detat|Altérations d’états}}')
  WHERE id = 'guide/le-tour-de-jeu' AND length(corps_md) - length(replace(corps_md, '{{alteration-detat|Blessures et états}}', '')) = length('{{alteration-detat|Blessures et états}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/le-tour-de-jeu : C5 R184 (5)', changes());

-- guide/le-tour-de-jeu (C6)
UPDATE page SET corps_md = replace(corps_md, '{{etape-6-finaliser-son-personnage|Créer son personnage}}',
  '{{etape-6-finaliser-son-personnage}}')
  WHERE id = 'guide/le-tour-de-jeu' AND length(corps_md) - length(replace(corps_md, '{{etape-6-finaliser-son-personnage|Créer son personnage}}', '')) = length('{{etape-6-finaliser-son-personnage|Créer son personnage}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/le-tour-de-jeu : C6', changes());

-- guide/la-magie-en-jeu (C6)
UPDATE page SET corps_md = replace(corps_md, '{{etape-5-choisir-ses-premiers-sorts|Créer son personnage}}',
  '{{etape-5-choisir-ses-premiers-sorts}}')
  WHERE id = 'guide/la-magie-en-jeu' AND length(corps_md) - length(replace(corps_md, '{{etape-5-choisir-ses-premiers-sorts|Créer son personnage}}', '')) = length('{{etape-5-choisir-ses-premiers-sorts|Créer son personnage}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-magie-en-jeu : C6', changes());

-- guide/la-montee-de-niveau (C6)
UPDATE page SET corps_md = replace(corps_md, '(voir l’étape 4 de {{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}})',
  '(voir {{etape-4-repartir-caracteristiques-et-competences}})')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, '(voir l’étape 4 de {{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}})', '')) = length('(voir l’étape 4 de {{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}})');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C6', changes());

-- guide/la-montee-de-niveau (C6)
UPDATE page SET corps_md = replace(corps_md, '{{etape-3-choisir-sa-classe|Créer son personnage}}',
  '{{etape-3-choisir-sa-classe}}')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, '{{etape-3-choisir-sa-classe|Créer son personnage}}', '')) = length('{{etape-3-choisir-sa-classe|Créer son personnage}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C6', changes());

-- guide/reussir-une-action (C6)
UPDATE page SET corps_md = replace(corps_md, '{{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}}',
  '{{etape-4-repartir-caracteristiques-et-competences}}')
  WHERE id = 'guide/reussir-une-action' AND length(corps_md) - length(replace(corps_md, '{{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}}', '')) = length('{{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/reussir-une-action : C6', changes());

-- guide/finaliser-son-personnage (C7, R184 (2), R184 (11))
UPDATE page SET corps_md = replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}',
  '{{sentrainer}}')
  WHERE id = 'guide/finaliser-son-personnage' AND length(corps_md) - length(replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}', '')) = length('{{sentrainer|S’entraîner et exercer un métier}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/finaliser-son-personnage : C7 R184 (2), R184 (11)', changes());

-- guide/la-montee-de-niveau (C7, R184 (2), R184 (11))
UPDATE page SET corps_md = replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}',
  '{{sentrainer}}')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}', '')) = length('{{sentrainer|S’entraîner et exercer un métier}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C7 R184 (2), R184 (11)', changes());

-- guide/reussir-une-action (C7, R184 (2), R184 (11))
UPDATE page SET corps_md = replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}',
  '{{sentrainer}}')
  WHERE id = 'guide/reussir-une-action' AND length(corps_md) - length(replace(corps_md, '{{sentrainer|S’entraîner et exercer un métier}}', '')) = length('{{sentrainer|S’entraîner et exercer un métier}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/reussir-une-action : C7 R184 (2), R184 (11)', changes());

-- guide/la-montee-de-niveau (C8, R187 (1), R184 (2))
UPDATE page SET corps_md = replace(corps_md, '{{mode-hyper|Le Mode Hyper et le Mode Super}}',
  '{{mode-hyper|Le Mode Hyper}}')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, '{{mode-hyper|Le Mode Hyper et le Mode Super}}', '')) = length('{{mode-hyper|Le Mode Hyper et le Mode Super}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C8 R187 (1), R184 (2)', changes());

-- guide/s-entrainer-et-exercer-un-metier (C9, R184 (1), R104)
UPDATE page SET corps_md = replace(corps_md, 'un seul par sort (voir {{la-magie-en-jeu}}) ;',
  'un seul par sort (voir {{la-magie-en-jeu}}) ;' || char(10) || '- en texte libre, les **dons évènementiels** et ce que le MJ accorde.')
  WHERE id = 'guide/s-entrainer-et-exercer-un-metier' AND length(corps_md) - length(replace(corps_md, 'un seul par sort (voir {{la-magie-en-jeu}}) ;', '')) = length('un seul par sort (voir {{la-magie-en-jeu}}) ;');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/s-entrainer-et-exercer-un-metier : C9 R184 (1), R104', changes());

-- guide/premiers-sorts (C10, R189)
UPDATE page SET corps_md = replace(corps_md, '2. avoir une magie acquise ;',
  '2. avoir une magie acquise, ou le don « Grimoire » de l’Archimage, qui compte comme elle sans donner de seconde magie ;')
  WHERE id = 'guide/premiers-sorts' AND length(corps_md) - length(replace(corps_md, '2. avoir une magie acquise ;', '')) = length('2. avoir une magie acquise ;');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/premiers-sorts : C10 R189', changes());

-- guide/la-montee-de-niveau (C10, R189)
UPDATE page SET corps_md = replace(corps_md, '(avoir une magie innée, une magie acquise, une classe magique, une seconde classe magique)',
  '(avoir une magie innée, une magie acquise ou le don « Grimoire » de l’Archimage, une classe magique, une seconde classe magique)')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, '(avoir une magie innée, une magie acquise, une classe magique, une seconde classe magique)', '')) = length('(avoir une magie innée, une magie acquise, une classe magique, une seconde classe magique)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C10 R189', changes());

-- guide/la-montee-de-niveau (C11, R188 (1), R188 (2))
UPDATE page SET corps_md = replace(corps_md, 'les emplacements de ce palier, eux, s’ouvrent quand même.',
  'les emplacements de ce palier, eux, s’ouvrent quand même.' || char(10) || '- **Avec le {{potentiel-illimite|Potentiel Illimité}}** en magie innée, le choix des sorts a de plus son propre plafond, donné sur la page de sa magie et relevé par le don « Semi-complet » de l’Archimage, jamais avant le niveau où la puissance magique l’ouvre ; ce plafond ne change pas le nombre d’emplacements.')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, 'les emplacements de ce palier, eux, s’ouvrent quand même.', '')) = length('les emplacements de ce palier, eux, s’ouvrent quand même.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C11 R188 (1), R188 (2)', changes());

-- guide/la-magie-en-jeu (C12, R154, R26)
UPDATE page SET corps_md = replace(corps_md, 'Un NM s’obtient de trois façons :',
  'Un NM s’obtient de quatre façons :')
  WHERE id = 'guide/la-magie-en-jeu' AND length(corps_md) - length(replace(corps_md, 'Un NM s’obtient de trois façons :', '')) = length('Un NM s’obtient de trois façons :');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-magie-en-jeu : C12 R154, R26', changes());

-- guide/la-magie-en-jeu (C12, R154, R26)
UPDATE page SET corps_md = replace(corps_md, '- **en cadeau du MJ**.',
  '- **en cadeau du MJ** ;' || char(10) || '- **par un don** : « Maîtrise » de l’Ocultomancien (niveau de classe 20) donne 4 NM gagnés, qui s’ajoutent à ceux des niveaux ; ce ne sont pas des NM du MJ.')
  WHERE id = 'guide/la-magie-en-jeu' AND length(corps_md) - length(replace(corps_md, '- **en cadeau du MJ**.', '')) = length('- **en cadeau du MJ**.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-magie-en-jeu : C12 R154, R26', changes());

-- guide/resistances-et-faiblesses (C13)
UPDATE page SET corps_md = replace(corps_md, 'le Potentiel Illimité n’a ni résistance ni vulnérabilité.',
  'le Potentiel Illimité n’a ni résistance ni vulnérabilité à une magie (sa Surtension corporelle, qui touche les dégâts physiques, est décrite plus bas).')
  WHERE id = 'guide/resistances-et-faiblesses' AND length(corps_md) - length(replace(corps_md, 'le Potentiel Illimité n’a ni résistance ni vulnérabilité.', '')) = length('le Potentiel Illimité n’a ni résistance ni vulnérabilité.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/resistances-et-faiblesses : C13', changes());

-- guide/choisir-sa-classe (C14)
UPDATE page SET corps_md = replace(corps_md, '**maîtrises d’armes** : les armes que le personnage sait manier dès le départ',
  '**maîtrises d’armes** : des points de maîtrise par famille d’armes, qui ajoutent des dés de dégâts aux armes de ces familles')
  WHERE id = 'guide/choisir-sa-classe' AND length(corps_md) - length(replace(corps_md, '**maîtrises d’armes** : les armes que le personnage sait manier dès le départ', '')) = length('**maîtrises d’armes** : les armes que le personnage sait manier dès le départ');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/choisir-sa-classe : C14', changes());

-- guide/l-equipement (C15)
UPDATE page SET corps_md = replace(corps_md, 'écailles et bois 8 AP et 1 AM.',
  'écailles et bois 9 AP et 9 AM.')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'écailles et bois 8 AP et 1 AM.', '')) = length('écailles et bois 8 AP et 1 AM.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C15', changes());

-- guide/l-equipement (C16)
UPDATE page SET corps_md = replace(corps_md, 'est de **4 crans**, plus un au +4 et un autre au +5.',
  'est de **4 crans**, 5 au +4 et au +5 (la ligne d’amélioration donne le total).')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'est de **4 crans**, plus un au +4 et un autre au +5.', '')) = length('est de **4 crans**, plus un au +4 et un autre au +5.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C16', changes());

-- guide/l-equipement (C17)
UPDATE page SET corps_md = replace(corps_md, 'est sur la page {{armes|Équipement}} : les armes, les armures, les boucliers, les objets de ceinture et les accessoires,',
  'est dans la rubrique Équipement du menu, une page par catégorie : les {{armes|armes}}, les {{armures|armures}}, les {{bouclier|boucliers}}, les objets de {{ceinture|ceinture}} et les {{accessoires|accessoires}},')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'est sur la page {{armes|Équipement}} : les armes, les armures, les boucliers, les objets de ceinture et les accessoires,', '')) = length('est sur la page {{armes|Équipement}} : les armes, les armures, les boucliers, les objets de ceinture et les accessoires,');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C17', changes());

-- guide/equipement-et-butin (C17)
UPDATE page SET corps_md = replace(corps_md, 'est sur la page {{armes|Équipement}}.',
  'est dans la rubrique Équipement du menu : {{armes|armes}}, {{armures|armures}}, {{bouclier|boucliers}}, {{ceinture|ceinture}} et {{accessoires|accessoires}}.')
  WHERE id = 'guide/equipement-et-butin' AND length(corps_md) - length(replace(corps_md, 'est sur la page {{armes|Équipement}}.', '')) = length('est sur la page {{armes|Équipement}}.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/equipement-et-butin : C17', changes());

-- guide/l-equipement (C17)
UPDATE page SET corps_md = replace(corps_md, 'La grille de l’onglet {{armures}}',
  'La grille de la page {{armures}}')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'La grille de l’onglet {{armures}}', '')) = length('La grille de l’onglet {{armures}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C17', changes());

-- guide/l-equipement (C17)
UPDATE page SET corps_md = replace(corps_md, 'Les prix sont dans l’onglet Armures.',
  'Les prix sont sur la page {{armures}}.')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'Les prix sont dans l’onglet Armures.', '')) = length('Les prix sont dans l’onglet Armures.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C17', changes());

-- guide/l-equipement (C17)
UPDATE page SET corps_md = replace(corps_md, 'sont dans l’onglet {{bouclier|Boucliers}}.',
  'sont sur la page {{bouclier|Boucliers}}.')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'sont dans l’onglet {{bouclier|Boucliers}}.', '')) = length('sont dans l’onglet {{bouclier|Boucliers}}.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C17', changes());

-- guide/l-equipement (C17)
UPDATE page SET corps_md = replace(corps_md, 'le générateur de l’onglet {{accessoires}}',
  'le générateur de la page {{accessoires}}')
  WHERE id = 'guide/l-equipement' AND length(corps_md) - length(replace(corps_md, 'le générateur de l’onglet {{accessoires}}', '')) = length('le générateur de l’onglet {{accessoires}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/l-equipement : C17', changes());

-- guide/les-degats (C17)
UPDATE page SET corps_md = replace(corps_md, 'L’onglet {{armures}}',
  'La page {{armures}}')
  WHERE id = 'guide/les-degats' AND length(corps_md) - length(replace(corps_md, 'L’onglet {{armures}}', '')) = length('L’onglet {{armures}}');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-degats : C17', changes());

-- guide/fiche-personnage (C18, R1)
UPDATE page SET corps_md = replace(corps_md, 'parmi les 23 disponibles',
  'parmi les 27 disponibles')
  WHERE id = 'guide/fiche-personnage' AND length(corps_md) - length(replace(corps_md, 'parmi les 23 disponibles', '')) = length('parmi les 23 disponibles');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-personnage : C18 R1', changes());

-- guide/fiche-personnage (C18, R202 (7))
UPDATE page SET corps_md = replace(corps_md, 'ainsi que le score d''alignement (gauche = score Loyal/Chaos, droite = score Bon/Mauvais)',
  'ainsi que les quatre scores d''alignement : Loyal (L), Chaos (C), Bon (B) et Mauvais (M)')
  WHERE id = 'guide/fiche-personnage' AND length(corps_md) - length(replace(corps_md, 'ainsi que le score d''alignement (gauche = score Loyal/Chaos, droite = score Bon/Mauvais)', '')) = length('ainsi que le score d''alignement (gauche = score Loyal/Chaos, droite = score Bon/Mauvais)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-personnage : C18 R202 (7)', changes());

-- guide/fiche-attributs (C18, R202 (4))
UPDATE page SET corps_md = replace(corps_md, 'ainsi que de la Magie du Sang (si jamais vous avez cette magie)',
  'ainsi que de la Magie du Sang ou de la Nécromancie (si jamais vous avez l''une de ces magies)')
  WHERE id = 'guide/fiche-attributs' AND length(corps_md) - length(replace(corps_md, 'ainsi que de la Magie du Sang (si jamais vous avez cette magie)', '')) = length('ainsi que de la Magie du Sang (si jamais vous avez cette magie)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-attributs : C18 R202 (4)', changes());

-- guide/fiche-attributs (C18, R201, R175)
UPDATE page SET corps_md = replace(corps_md, '[{{chakra}} total divisé par 2 = {{barriere}} totale]',
  '[{{chakra}} total divisé par 2, arrondi à l’inférieur = {{barriere}} totale]')
  WHERE id = 'guide/fiche-attributs' AND length(corps_md) - length(replace(corps_md, '[{{chakra}} total divisé par 2 = {{barriere}} totale]', '')) = length('[{{chakra}} total divisé par 2 = {{barriere}} totale]');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-attributs : C18 R201, R175', changes());

-- guide/fiche-caracteristiques (C18, R202 (5))
UPDATE page SET corps_md = replace(corps_md, 'Le Potentiel Illimité détermine aléatoirement le bonus.',
  'Pour le Potentiel Illimité, le joueur choisit le bonus ou le tire au hasard.')
  WHERE id = 'guide/fiche-caracteristiques' AND length(corps_md) - length(replace(corps_md, 'Le Potentiel Illimité détermine aléatoirement le bonus.', '')) = length('Le Potentiel Illimité détermine aléatoirement le bonus.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-caracteristiques : C18 R202 (5)', changes());

-- guide/fiche-competences (C18, R41)
UPDATE page SET corps_md = replace(corps_md, 'dans la limite de 5 par point de caractéristique de base =',
  'dans la limite de 5 par point de la caractéristique totale (le +1 de la magie innée compris) =')
  WHERE id = 'guide/fiche-competences' AND length(corps_md) - length(replace(corps_md, 'dans la limite de 5 par point de caractéristique de base =', '')) = length('dans la limite de 5 par point de caractéristique de base =');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-competences : C18 R41', changes());

-- guide/fiche-tableau-magie (C18, R189)
UPDATE page SET corps_md = replace(corps_md, '- Avoir une magie acquise.',
  '- Avoir une magie acquise, ou le don « Grimoire » de l’Archimage, qui compte comme elle sans donner de seconde magie.')
  WHERE id = 'guide/fiche-tableau-magie' AND length(corps_md) - length(replace(corps_md, '- Avoir une magie acquise.', '')) = length('- Avoir une magie acquise.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-magie : C18 R189', changes());

-- guide/fiche-tableau-posture (C18, R198 (1))
UPDATE page SET corps_md = replace(corps_md, 'MAIS chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.',
  'MAIS au-delà de deux parades ou esquives, chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'MAIS chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.', '')) = length('MAIS chaque coup va diminuer la réussite de la prochaine parade/esquive de 10%.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R198 (1)', changes());

-- guide/fiche-tableau-posture (C18, R198 (2))
UPDATE page SET corps_md = replace(corps_md, 'd''un bon dialogue et d''un jet de diplomatie',
  'd''un bon dialogue ou d''un jet de diplomatie')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'd''un bon dialogue et d''un jet de diplomatie', '')) = length('d''un bon dialogue et d''un jet de diplomatie');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R198 (2)', changes());

-- guide/fiche-tableau-posture (C18, R198 (3))
UPDATE page SET corps_md = replace(corps_md, 'Permet grâce un jet d''observation/distinction d''avoir',
  'Permet grâce un jet d''observation d''avoir')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'Permet grâce un jet d''observation/distinction d''avoir', '')) = length('Permet grâce un jet d''observation/distinction d''avoir');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R198 (3)', changes());

-- guide/fiche-tableau-posture (C18, R198 (3))
UPDATE page SET corps_md = replace(corps_md, 'détecter une résistance ou vulnérabilité aléatoire de l’ennemi.',
  'détecter 1d4 résistances ou vulnérabilités de l’ennemi.')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'détecter une résistance ou vulnérabilité aléatoire de l’ennemi.', '')) = length('détecter une résistance ou vulnérabilité aléatoire de l’ennemi.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R198 (3)', changes());

-- guide/fiche-tableau-posture (C18, R100)
UPDATE page SET corps_md = replace(corps_md, 'bonus de dégâts de +6 ou alors',
  'bonus de dégâts de +5 ou alors')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, 'bonus de dégâts de +6 ou alors', '')) = length('bonus de dégâts de +6 ou alors');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R100', changes());

-- guide/fiche-tableau-posture (C18, R112, R167, R198 (4))
UPDATE page SET corps_md = replace(corps_md, '- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (la forgemagie est un sort qui permet de créer des armes faites de magie, donc c''est bon)',
  '- **Ni armes ni objets, on ne peut que lancer des sorts :** Vous êtes quasiment un élémentaire : la Forgemagie (qui crée des armes faites de magie) et la « Forge de ses morts » sont des sorts. Les parchemins restent permis, et les effets passifs restent actifs : accessoires, bâtons magiques, armure et bouclier portés. L’arme élémentaire de la magie de la symbiose reste utilisable et reçoit le bonus de dégâts de la posture ; les autres armes restent interdites.')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, '- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (la forgemagie est un sort qui permet de créer des armes faites de magie, donc c''est bon)', '')) = length('- **Impossible d''utiliser les objets et armes (sauf forgemagie) :** Vous êtes quasiment un élémentaire, les armes physiques et les objets ne sont pas dans votre optique (la forgemagie est un sort qui permet de créer des armes faites de magie, donc c''est bon)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R112, R167, R198 (4)', changes());

-- guide/fiche-tableau-posture (C18, R111)
UPDATE page SET corps_md = replace(corps_md, ', ainsi tous ses avantages et inconvénients sont annulés également.',
  ' : elle perd ses sorts et ses résistances et faiblesses, et rien d’autre (son effet de Mode Hyper, sa ressource propre, la santé et le chakra qu’elle offre et le +1 de caractéristique de la magie innée restent).')
  WHERE id = 'guide/fiche-tableau-posture' AND length(corps_md) - length(replace(corps_md, ', ainsi tous ses avantages et inconvénients sont annulés également.', '')) = length(', ainsi tous ses avantages et inconvénients sont annulés également.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-tableau-posture : C18 R111', changes());

-- guide/fiche-maitrise-darme-et-armes (C18, R149)
UPDATE page SET corps_md = replace(corps_md, '1 point de maîtrise = 2d de dégâts, etc....',
  '1 point de maîtrise = 2d de dégâts, jusqu’à 4 points au plus par catégorie, donc 5 dés.')
  WHERE id = 'guide/fiche-maitrise-darme-et-armes' AND length(corps_md) - length(replace(corps_md, '1 point de maîtrise = 2d de dégâts, etc....', '')) = length('1 point de maîtrise = 2d de dégâts, etc....');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-maitrise-darme-et-armes : C18 R149', changes());

-- guide/fiche-maitrise-darme-et-armes (C18, R49)
UPDATE page SET corps_md = replace(corps_md, 'Chaque catégorie d''arme possède son dé de dégâts, toutes les dagues feront le D6 et ainsi de suite.',
  'Chaque arme possède son dé de dégâts, le plus souvent celui de sa catégorie : la plupart des dagues feront le D6 et ainsi de suite.')
  WHERE id = 'guide/fiche-maitrise-darme-et-armes' AND length(corps_md) - length(replace(corps_md, 'Chaque catégorie d''arme possède son dé de dégâts, toutes les dagues feront le D6 et ainsi de suite.', '')) = length('Chaque catégorie d''arme possède son dé de dégâts, toutes les dagues feront le D6 et ainsi de suite.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-maitrise-darme-et-armes : C18 R49', changes());

-- guide/fiche-armure-defense-bouclier (C18, R93, R95)
UPDATE page SET corps_md = replace(corps_md, 'L''armure est divisée en 6 morceaux :',
  'L''armure est une armure complète, divisée en 6 parties :')
  WHERE id = 'guide/fiche-armure-defense-bouclier' AND length(corps_md) - length(replace(corps_md, 'L''armure est divisée en 6 morceaux :', '')) = length('L''armure est divisée en 6 morceaux :');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-armure-defense-bouclier : C18 R93, R95', changes());

-- guide/fiche-armure-defense-bouclier (C18, R95, R156)
UPDATE page SET corps_md = replace(corps_md, 'Elle possède également une Dur. ({{solidite|solidité}} comme pour les armes)',
  'Chaque partie possède sa {{solidite|solidité}} (comme pour les armes), sauf une armure à cran de solidité uni, qui n’en a qu’une pour toute l’armure.')
  WHERE id = 'guide/fiche-armure-defense-bouclier' AND length(corps_md) - length(replace(corps_md, 'Elle possède également une Dur. ({{solidite|solidité}} comme pour les armes)', '')) = length('Elle possède également une Dur. ({{solidite|solidité}} comme pour les armes)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-armure-defense-bouclier : C18 R95, R156', changes());

-- guide/fiche-armure-defense-bouclier (C18, R78, R96)
UPDATE page SET corps_md = replace(corps_md, 'Il peut être de différentes compositions,',
  'Il est fait d’une forme et d’une matière,')
  WHERE id = 'guide/fiche-armure-defense-bouclier' AND length(corps_md) - length(replace(corps_md, 'Il peut être de différentes compositions,', '')) = length('Il peut être de différentes compositions,');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-armure-defense-bouclier : C18 R78, R96', changes());

-- guide/fiche-accessoires-et-ceinture (C18, R89, R131)
UPDATE page SET corps_md = replace(corps_md, 'ne peuvent pas dépasser le nombre de 3 (impossible',
  'ne peuvent pas dépasser 3 exemplaires du même objet par emplacement, 4 avec le don « Organisé » du Mercenaire (impossible')
  WHERE id = 'guide/fiche-accessoires-et-ceinture' AND length(corps_md) - length(replace(corps_md, 'ne peuvent pas dépasser le nombre de 3 (impossible', '')) = length('ne peuvent pas dépasser le nombre de 3 (impossible');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-accessoires-et-ceinture : C18 R89, R131', changes());

-- guide/fiche-inventaire-sac-a-dos (C18, R88, R227 (2))
UPDATE page SET corps_md = replace(corps_md, 'Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sacs à dos.' || char(10) || '' || char(10) || '- Grand sac à dos, permet d’avoir 4 emplacements supplémentaires |Demande 2 de Force.' || char(10) || '- Super sac à dos, permet d’avoir 8 emplacements supplémentaires |Demande 3 de Force.' || char(10) || '- Méga sac à dos, permet d’avoir 12 emplacements supplémentaires |Demande 4 de Force.' || char(10) || '- Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.',
  'La place de l’inventaire est donnée par la Force de votre personnage, sans sac à dos à choisir ; un sac à dos reste un objet possible de l’inventaire.')
  WHERE id = 'guide/fiche-inventaire-sac-a-dos' AND length(corps_md) - length(replace(corps_md, 'Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sacs à dos.' || char(10) || '' || char(10) || '- Grand sac à dos, permet d’avoir 4 emplacements supplémentaires |Demande 2 de Force.' || char(10) || '- Super sac à dos, permet d’avoir 8 emplacements supplémentaires |Demande 3 de Force.' || char(10) || '- Méga sac à dos, permet d’avoir 12 emplacements supplémentaires |Demande 4 de Force.' || char(10) || '- Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.', '')) = length('Par défaut, votre personnage commence avec un sac à dos normal, ce qui correspond à deux colonnes complètes d’inventaire mais il existe d’autres sacs à dos.' || char(10) || '' || char(10) || '- Grand sac à dos, permet d’avoir 4 emplacements supplémentaires |Demande 2 de Force.' || char(10) || '- Super sac à dos, permet d’avoir 8 emplacements supplémentaires |Demande 3 de Force.' || char(10) || '- Méga sac à dos, permet d’avoir 12 emplacements supplémentaires |Demande 4 de Force.' || char(10) || '- Ultra sac à dos, permet d’avoir tout l’inventaire |Demande 5 de Force.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/fiche-inventaire-sac-a-dos : C18 R88, R227 (2)', changes());

-- metiers/regles-des-metiers (C18, R208 (4))
UPDATE page SET corps_md = replace(corps_md, 'Pour fabriquer un soin, un remède ou un philtre : il faut être alchimiste.',
  'Pour fabriquer un soin ou un remède : il faut être apothicaire. Pour fabriquer un philtre : il faut être alchimiste.')
  WHERE id = 'metiers/regles-des-metiers' AND length(corps_md) - length(replace(corps_md, 'Pour fabriquer un soin, un remède ou un philtre : il faut être alchimiste.', '')) = length('Pour fabriquer un soin, un remède ou un philtre : il faut être alchimiste.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page metiers/regles-des-metiers : C18 R208 (4)', changes());

-- metiers/regles-des-metiers (C18, R208 (7))
UPDATE page SET corps_md = replace(corps_md, 'j’ai un bonus de 3% en Connaissance et 3% en Distinction.',
  'j’ai un bonus de 3% en Connaissance et 3% en Orientation.')
  WHERE id = 'metiers/regles-des-metiers' AND length(corps_md) - length(replace(corps_md, 'j’ai un bonus de 3% en Connaissance et 3% en Distinction.', '')) = length('j’ai un bonus de 3% en Connaissance et 3% en Distinction.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page metiers/regles-des-metiers : C18 R208 (7)', changes());

-- metiers/regles-des-metiers (C18, R208 (7))
UPDATE page SET corps_md = replace(corps_md, 'je commence avec une pelle en acier.',
  'je commence avec une pelle en acier ou une faucille en acier.')
  WHERE id = 'metiers/regles-des-metiers' AND length(corps_md) - length(replace(corps_md, 'je commence avec une pelle en acier.', '')) = length('je commence avec une pelle en acier.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page metiers/regles-des-metiers : C18 R208 (7)', changes());

-- guide/attaque-et-defense (C18, R180, R182, R203)
UPDATE page SET corps_md = replace(corps_md, '(score au dé = 1 - 5)',
  '(score au dé = 1 - 5 de base, voir {{reussites-echecs-et-critiques}})')
  WHERE id = 'guide/attaque-et-defense' AND length(corps_md) - length(replace(corps_md, '(score au dé = 1 - 5)', '')) = length('(score au dé = 1 - 5)');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/attaque-et-defense : C18 R180, R182, R203', changes());

-- guide/attaque-et-defense (C18, R226 (1))
UPDATE page SET corps_md = replace(corps_md, 'La défense doit faire une réussite critique supérieure',
  'La défense doit faire une réussite critique égale ou plus basse')
  WHERE id = 'guide/attaque-et-defense' AND length(corps_md) - length(replace(corps_md, 'La défense doit faire une réussite critique supérieure', '')) = length('La défense doit faire une réussite critique supérieure');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/attaque-et-defense : C18 R226 (1)', changes());

-- guide/attaque-et-defense (C18, R199 (1), R226 (1))
UPDATE page SET corps_md = replace(corps_md, 'doit faire un score égal ou meilleur que celui de l''attaquant',
  'doit faire un résultat égal ou plus bas que celui de l''attaquant')
  WHERE id = 'guide/attaque-et-defense' AND length(corps_md) - length(replace(corps_md, 'doit faire un score égal ou meilleur que celui de l''attaquant', '')) = length('doit faire un score égal ou meilleur que celui de l''attaquant');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/attaque-et-defense : C18 R199 (1), R226 (1)', changes());

-- guide/formule-des-degats (C18, R100, R199 (4))
UPDATE page SET corps_md = replace(corps_md, 'Dégâts du lanceur x Réussite critique (donc par 2) - Armure',
  '(Dégâts du lanceur + bonus fixes) x Réussite critique (donc par 2) ÷ Posture défensive de l''attaquant (donc par 2) - Armure')
  WHERE id = 'guide/formule-des-degats' AND length(corps_md) - length(replace(corps_md, 'Dégâts du lanceur x Réussite critique (donc par 2) - Armure', '')) = length('Dégâts du lanceur x Réussite critique (donc par 2) - Armure');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/formule-des-degats : C18 R100, R199 (4)', changes());

-- guide/les-attaques-discretes (C18, R224 (1))
UPDATE page SET corps_md = replace(corps_md, 'si vous êtes en posture discrète',
  'si vous êtes en mode discret')
  WHERE id = 'guide/les-attaques-discretes' AND length(corps_md) - length(replace(corps_md, 'si vous êtes en posture discrète', '')) = length('si vous êtes en posture discrète');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-attaques-discretes : C18 R224 (1)', changes());

-- guide/les-portes (C18, R224 (3))
UPDATE page SET corps_md = replace(corps_md, 'Une porte de pierre de niveau 12 aura 240 santé.',
  'Une porte de pierre de niveau 12 aura 480 santé.')
  WHERE id = 'guide/les-portes' AND length(corps_md) - length(replace(corps_md, 'Une porte de pierre de niveau 12 aura 240 santé.', '')) = length('Une porte de pierre de niveau 12 aura 240 santé.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-portes : C18 R224 (3)', changes());

-- guide/alignement (C19, R224 (2))
UPDATE page SET corps_md = replace(corps_md, 'maintenant on va expliquer les 9 combinaisons possibles.',
  'les 9 combinaisons possibles sont expliquées dans {{les-neuf-alignements}}.')
  WHERE id = 'guide/alignement' AND length(corps_md) - length(replace(corps_md, 'maintenant on va expliquer les 9 combinaisons possibles.', '')) = length('maintenant on va expliquer les 9 combinaisons possibles.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/alignement : C19 R224 (2)', changes());

-- guide/jet-de-des (C19, R229)
UPDATE page SET corps_md = replace(corps_md, 'Comme expliqué plus haut, le jeu de rôle',
  'Le jeu de rôle')
  WHERE id = 'guide/jet-de-des' AND length(corps_md) - length(replace(corps_md, 'Comme expliqué plus haut, le jeu de rôle', '')) = length('Comme expliqué plus haut, le jeu de rôle');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/jet-de-des : C19 R229', changes());

-- page.resume

-- guide/jet-de-des (C19, R229)
UPDATE page SET resume = replace(resume, 'Comme expliqué plus haut, le jeu de rôle',
  'Le jeu de rôle')
  WHERE id = 'guide/jet-de-des' AND length(resume) - length(replace(resume, 'Comme expliqué plus haut, le jeu de rôle', '')) = length('Comme expliqué plus haut, le jeu de rôle');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/jet-de-des : C19 R229', changes());

-- page.corps_md

-- guide/les-postures (C20, R226 (2))
UPDATE page SET corps_md = replace(corps_md, '- **Anticiper l’adversaire** : un jet d’*Observation* donne',
  '- **Anticiper l’adversaire** : en action rapide (IC), un jet d’*Observation* donne')
  WHERE id = 'guide/les-postures' AND length(corps_md) - length(replace(corps_md, '- **Anticiper l’adversaire** : un jet d’*Observation* donne', '')) = length('- **Anticiper l’adversaire** : un jet d’*Observation* donne');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/les-postures : C20 R226 (2)', changes());

-- guide/attaquer-et-se-defendre (C21, R226 (1))
UPDATE page SET corps_md = replace(corps_md, 'par une réussite critique meilleure que celle de l’attaquant',
  'par une réussite critique égale ou plus basse que celle de l’attaquant')
  WHERE id = 'guide/attaquer-et-se-defendre' AND length(corps_md) - length(replace(corps_md, 'par une réussite critique meilleure que celle de l’attaquant', '')) = length('par une réussite critique meilleure que celle de l’attaquant');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/attaquer-et-se-defendre : C21 R226 (1)', changes());

-- guide/le-mode-hyper (C22, R226 (3), R200 (3))
UPDATE page SET corps_md = replace(corps_md, 'quand la réserve de {{chakra|chakra}} est épuisée ou que les tours sont passés.',
  'quand les tours de sa durée sont passés (le {{chakra|chakra}} épuisé, lui, se paie en santé et ne fait pas compter de tour en trop).')
  WHERE id = 'guide/le-mode-hyper' AND length(corps_md) - length(replace(corps_md, 'quand la réserve de {{chakra|chakra}} est épuisée ou que les tours sont passés.', '')) = length('quand la réserve de {{chakra|chakra}} est épuisée ou que les tours sont passés.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/le-mode-hyper : C22 R226 (3), R200 (3)', changes());

-- guide/equipement-et-butin (C24, R227 (1))
UPDATE page SET corps_md = replace(corps_md, '{{forgeron|forgeron}} pour les armes, les armures lourdes et les boucliers ;',
  '{{forgeron|forgeron}} pour les armes ; {{armurier|armurier}} pour les armures lourdes et les boucliers ;')
  WHERE id = 'guide/equipement-et-butin' AND length(corps_md) - length(replace(corps_md, '{{forgeron|forgeron}} pour les armes, les armures lourdes et les boucliers ;', '')) = length('{{forgeron|forgeron}} pour les armes, les armures lourdes et les boucliers ;');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/equipement-et-butin : C24 R227 (1)', changes());

-- metier.artisanat_texte

-- metiers/bijoutier (C26, R230 (1))
UPDATE metier SET artisanat_texte = replace(artisanat_texte, 'Peut fabriquer les accessoires ou les désenchanter',
  'Peut fabriquer les accessoires ou les désenchanter, sauf un accessoire maudit, que seul un Enchanteur retire')
  WHERE id = 'metiers/bijoutier' AND length(artisanat_texte) - length(replace(artisanat_texte, 'Peut fabriquer les accessoires ou les désenchanter', '')) = length('Peut fabriquer les accessoires ou les désenchanter');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('metier metiers/bijoutier : C26 R230 (1)', changes());

-- metier.artisanat_brut

-- metiers/bijoutier (C26, R230 (1))
UPDATE metier SET artisanat_brut = replace(artisanat_brut, 'Peut fabriquer les accessoires ou les désenchanter',
  'Peut fabriquer les accessoires ou les désenchanter, sauf un accessoire maudit, que seul un Enchanteur retire')
  WHERE id = 'metiers/bijoutier' AND length(artisanat_brut) - length(replace(artisanat_brut, 'Peut fabriquer les accessoires ou les désenchanter', '')) = length('Peut fabriquer les accessoires ou les désenchanter');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('metier metiers/bijoutier : C26 R230 (1)', changes());

-- page.corps_md

-- metiers/bijoutier (C26, R230 (1))
UPDATE page SET corps_md = replace(corps_md, 'Peut fabriquer les accessoires ou les désenchanter',
  'Peut fabriquer les accessoires ou les désenchanter, sauf un accessoire maudit, que seul un Enchanteur retire')
  WHERE id = 'metiers/bijoutier' AND length(corps_md) - length(replace(corps_md, 'Peut fabriquer les accessoires ou les désenchanter', '')) = length('Peut fabriquer les accessoires ou les désenchanter');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page metiers/bijoutier : C26 R230 (1)', changes());

-- guide/la-montee-de-niveau (C25, R225)
UPDATE page SET corps_md = replace(corps_md, 'entre la **santé** et le **{{chakra|chakra}}**.',
  'entre la **santé** et le **{{chakra|chakra}}** (avec le {{potentiel-illimite|Potentiel Illimité}} en magie innée, 5 santé au plus par niveau sur ces points, le dé bonus en plus).')
  WHERE id = 'guide/la-montee-de-niveau' AND length(corps_md) - length(replace(corps_md, 'entre la **santé** et le **{{chakra|chakra}}**.', '')) = length('entre la **santé** et le **{{chakra|chakra}}**.');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/la-montee-de-niveau : C25 R225', changes());

-- page.titre et alias (C23, R226 (4)) : le titre change, l'ancien reste en alias (comme R184 (2)) ; titre_cle = normalize(titre)
UPDATE page SET titre = 'Mode Super', titre_cle = 'mode-super' WHERE id = 'guide/liste-des-effets-mode-super' AND titre = 'Liste des effets mode super';
INSERT INTO garde_0111 (quoi, lignes) VALUES ('page guide/liste-des-effets-mode-super : C23 titre', changes());
INSERT INTO alias (page_id, ordre, texte, cle)
  SELECT 'guide/liste-des-effets-mode-super', suivant, 'Liste des effets mode super', 'liste-des-effets-mode-super'
  FROM (SELECT coalesce(max(ordre) + 1, 0) AS suivant FROM alias WHERE page_id = 'guide/liste-des-effets-mode-super');
INSERT INTO garde_0111 (quoi, lignes) VALUES ('alias guide/liste-des-effets-mode-super : C23', changes());

-- mot_cle (C18, guide/attaque-et-defense) : le lien vers la page des critiques ; une ligne déjà présente arrête la migration (clé primaire)
INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, couleur, url, verrou) VALUES ('reussites-echecs-et-critiques', 'Réussites / échecs / critiques', 'reussites-echecs-critiques', NULL, NULL, NULL, '/regles/reussites-echecs-et-critiques/', 1);
INSERT INTO garde_0111 (quoi, lignes) SELECT 'mot_cle reussites-echecs-et-critiques : son adresse mène à une page', count(*) FROM page WHERE id = 'guide/reussites-echecs-et-critiques';

-- mot_cle mode-super (R228) : son adresse, celle de la page du Mode Super ; une adresse déjà posée (le site de dev) arrête la migration
UPDATE mot_cle SET url = '/regles/mode-super/', verrou = 1 WHERE id = 'mode-super' AND url IS NULL;
INSERT INTO garde_0111 (quoi, lignes) VALUES ('mot_cle mode-super : R228', changes());

-- regle_constante (R225) : la valeur de la décision, jamais relue d'un texte ; la phrase est celle que C25 écrit
INSERT INTO regle_constante (id, valeur, unite, nature, texte, page_id, origine, source_ref, remarque) VALUES ('potentiel_illimite.sante_max_par_niveau', 5, 'points', 'texte', '5 santé au plus par niveau sur ces points', 'guide/la-montee-de-niveau', 'fiche', 'Décision R225 du propriétaire', 'Santé au plus par niveau gagné sur les points d’attributs (niveau_global.points_attributs) d’un personnage dont la magie innée est le Potentiel Illimité ; le dé bonus des niveaux 5, 10, 15 et 20 s’y ajoute (réponse à V5 bis : « Non, le dé en plus »). Règle gains_sante_potentiel de v_personnage_controle.');

DROP TABLE garde_0111;

-- v_personnage_controle : copiée de data/schema.sql (santé du Potentiel Illimité : décision R225)
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
  -- Classe réservée à une magie innée, qui l'impose en classe 1 (classe.magie_innee_id ; l'Archimage et le Potentiel Illimité, décision R23)
  SELECT pc.personnage_id, 'classe_reservee', pc.classe_id
  FROM personnage_classe pc JOIN classe c ON c.id = pc.classe_id JOIN personnage p ON p.id = pc.personnage_id
  WHERE c.magie_innee_id IS NOT NULL AND c.magie_innee_id IS NOT p.magie_innee_id
  UNION ALL
  SELECT p.id, 'classe_imposee', c.id
  FROM personnage p
  JOIN classe c ON c.magie_innee_id = p.magie_innee_id
  JOIN personnage_classe pc ON pc.personnage_id = p.id AND pc.rang = 1
  WHERE pc.classe_id <> c.id
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
