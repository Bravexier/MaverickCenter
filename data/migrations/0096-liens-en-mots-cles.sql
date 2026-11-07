-- 0096-liens-en-mots-cles : les liens des textes deviennent des balises du glossaire, et un mot-clé gagne une couleur et une adresse.
-- Réponses du propriétaire (2026-11-06, transmises par le leader-technique) : « mot_cle » gagne « couleur » et « url », NULL par défaut, ajoutées en
-- dernier, une URL interne seulement ; les [[…]] et les liens Markdown internes [texte](/…) deviennent des balises ; un mot-clé par page visée
-- (libellé = titre de la page, url = son adresse, ni définition ni abréviation : aucune n'est inventée) ; un mot-clé existant de même libelle_cle ne
-- reçoit que l'url (et la couleur) : « alignement », « artisanat », « bouclier », « ceinture », « codex » (« Le mot-clé existant prend l'URL ») ;
-- la couleur est une référence « <famille>:<id> » (l'id de la classe CSS de la palette, lib/palette-css.mjs#idDeCouleur) ou « #rrggbb » ; « il ne faut pas de changement par rapport à avant en terme de résultat. Tu feras donc en sorte que
-- le mot clé reprenne la couleur de la page d'avant » ; « Un mot-clé par page colorée » (aussi pour celles que rien ne vise ; la couleur calculée des
-- classes et des races recopiée, gel accepté) ; un lien vers une route sans page devient le mot-clé de la route, libellé du menu du site ; homonymes
-- race/classe : « La race garde le nom » (la classe : « <Nom> (classe) »).
-- FICHIER GÉNÉRÉ par client/scripts/liens-en-mots-cles.mjs depuis la base construite à la version 95 (ne pas le modifier à la main) ; registre :
-- 0096-liens-en-mots-cles.json (chaque mot-clé, ses écritures de lien, chaque remplacement). Migration de STRUCTURE et de DONNÉES ; rien ne va dans
-- historique_modification (la migration n'est pas une modification du site de dev).
--   1. mot_cle.couleur, mot_cle.url (ADD COLUMN nullable, en dernier) ; la vue v_mot_cle les donne (refaite, en dernier). Qu'une référence de couleur
--      nomme une couleur de la palette (lib/palette-css.mjs#FAMILLES_DE_LA_PALETTE) ne se lit pas en SQL.
--   2. « alignement », « artisanat », « bouclier », « ceinture » et « codex » gardent id et définition, et reçoivent l'url de leur page (et sa
--      couleur si elle en a une).
--   3. Les mots-clés nouveaux : chaque page visée par un lien, chaque page colorée (magies, classes, races, pages de Découvrir et de la création du
--      personnage), chaque route visée sans page ; ni définition ni abréviation.
--   4. Les textes : chaque lien devient la balise de son mot-clé, son texte affiché gardé (« {{id}} » quand c'est le libellé), dans la forme canonique
--      de sa colonne (lib/liens-en-mots-cles.mjs#convertirLesLiens) ; un lien de l'ancienne page de l'équipement mène à la page où le site le renvoie
--      (lib/nav.mjs#adresseDeRenvoi) ; l'ancre d'un lien de route est perdue ; « /#lien-discord » reste un lien. Les pages d'exemple gardent leurs liens,
--      un lien dans un code reste tel quel, la section 15 n'est pas touchée. Les métiers Alchimiste et Apothicaire : la balise va à la source
--      (metier.artisanat_texte et artisanat_brut), le corps de leur page étant celui que lib/corps-metiers.mjs#corpsDeMetier en rend.

-- 1. La couleur et l'adresse
ALTER TABLE mot_cle ADD COLUMN couleur TEXT CHECK (couleur IS NULL OR couleur GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' OR (couleur GLOB '[a-z]*:[a-z0-9]*' AND couleur NOT GLOB '*[^a-z0-9:-]*' AND couleur NOT GLOB '*[^a-z]*:*' AND couleur NOT GLOB '*:*:*' AND couleur NOT GLOB '*--*' AND couleur NOT GLOB '*-'));
ALTER TABLE mot_cle ADD COLUMN url TEXT CHECK (url IS NULL OR (url GLOB '/*' AND url NOT GLOB '//*' AND url NOT GLOB '*[^!-~]*' AND instr(url, '\') = 0));

DROP VIEW v_mot_cle;
CREATE VIEW v_mot_cle AS
  SELECT m.id, m.libelle, m.libelle_cle,
    (SELECT count(*) FROM page_tag t WHERE t.tag_id = m.id) AS nb_pages,
    m.description,                                                         -- la définition du glossaire (migration 0056 ; NULL : pas encore décrit)
    m.abreviation,                                                         -- l'abréviation (migration 0090 ; NULL : aucune)
    m.couleur,                                                             -- la référence de couleur (migration 0096 ; NULL : aucune)
    m.url                                                                  -- l'adresse interne où mène le mot-clé (migration 0096 ; NULL : aucune)
  FROM mot_cle m;

-- 2. Les mots-clés existants qui mènent à une page ou à une route (id et définition gardés)
UPDATE mot_cle SET url = '/regles/alignement/', couleur = NULL WHERE id = 'alignement';
UPDATE mot_cle SET url = '/regles/artisanat/', couleur = NULL WHERE id = 'artisanat';
UPDATE mot_cle SET url = '/ressources/bouclier/', couleur = NULL WHERE id = 'bouclier';
UPDATE mot_cle SET url = '/ressources/objets-a-la-ceinture/', couleur = NULL WHERE id = 'ceinture';
UPDATE mot_cle SET url = '/lore/codex/', couleur = NULL WHERE id = 'codex';

-- 3. Les mots-clés nouveaux (par id)
INSERT INTO mot_cle (id, libelle, libelle_cle, description, abreviation, couleur, url) VALUES
  ('400', '400', '400', NULL, NULL, NULL, '/lore/400/'),
  ('academie-de-larcane', 'Académie de l’arcane', 'academie-de-larcane', NULL, NULL, NULL, '/lore/academie-de-larcane/'),
  ('accessoires', 'Accessoires', 'accessoires', NULL, NULL, NULL, '/ressources/accessoires/'),
  ('alchimie', 'Alchimie', 'alchimie', NULL, NULL, NULL, '/ressources/alchimie/'),
  ('alchimie-primitive', 'Alchimie primitive', 'alchimie-primitive', NULL, NULL, NULL, '/ressources/alchimie-primitive/'),
  ('alterations-detats', 'Altérations d’états', 'alterations-detats', NULL, NULL, NULL, '/regles/alterations-d-etats/'),
  ('alterations-detats-et-mode-hyper', 'Altérations d''états et Mode Hyper', 'alterations-detats-et-mode-hyper', NULL, NULL, NULL, '/regles/alterations-d-etats-et-mode-hyper/'),
  ('anansi', 'Anansi', 'anansi', NULL, NULL, 'race:hybride', '/races/anansi/'),
  ('anansi-classe', 'Anansi (classe)', 'anansi-classe', NULL, NULL, 'classe:raciales', '/classes/anansi/'),
  ('anna', 'Anna', 'anna', NULL, NULL, NULL, '/lore/anna/'),
  ('arbaletrier', 'Arbalétrier', 'arbaletrier', NULL, NULL, 'classe:distance', '/classes/arbaletrier/'),
  ('archer', 'Archer', 'archer', NULL, NULL, 'classe:distance', '/classes/archer/'),
  ('archimage', 'Archimage', 'archimage', NULL, NULL, 'classe:speciales', '/classes/archimage/'),
  ('armes', 'Armes', 'armes', NULL, NULL, NULL, '/ressources/armes/'),
  ('armures', 'Armures', 'armures', NULL, NULL, NULL, '/ressources/armures/'),
  ('attaque-et-defense', 'Attaque et Défense', 'attaque-et-defense', NULL, NULL, NULL, '/regles/attaque-et-defense/'),
  ('attaquer-et-se-defendre', 'Attaquer et se défendre', 'attaquer-et-se-defendre', NULL, NULL, NULL, '/regles/attaquer-et-se-defendre/'),
  ('aurora', 'Aurora', 'aurora', NULL, NULL, NULL, '/lore/aurora/'),
  ('balogne', 'Balogne', 'balogne', NULL, NULL, NULL, '/lore/balogne/'),
  ('barde', 'Barde', 'barde', NULL, NULL, 'classe:magiques', '/classes/barde/'),
  ('bardiche-du-bourreau-dechire', 'Bardiche du Bourreau déchiré', 'bardiche-du-bourreau-dechire', NULL, NULL, NULL, '/lore/bardiche-du-bourreau-dechire/'),
  ('barrage-argente', 'Barrage Argenté', 'barrage-argente', NULL, NULL, NULL, '/lore/barrage-argente/'),
  ('baton-de-la-destruction', 'Bâton de la destruction', 'baton-de-la-destruction', NULL, NULL, NULL, '/lore/baton-de-la-destruction/'),
  ('baton-magique', 'Bâton magique', 'baton-magique', NULL, NULL, NULL, '/ressources/objets-a-la-ceinture/#batons-magiques'),
  ('bauc', 'Bauc', 'bauc', NULL, NULL, NULL, '/lore/bauc/'),
  ('bestiaire', 'Bestiaire', 'bestiaire', NULL, NULL, NULL, '/bestiaire/'),
  ('bienvenue-dans-maverick', 'Bienvenue dans Maverick', 'bienvenue-dans-maverick', NULL, NULL, 'partie:decouvrir', '/decouvrir/'),
  ('bimane', 'Bimane', 'bimane', NULL, NULL, 'classe:melee', '/classes/bimane/'),
  ('blessure-et-mort', 'Blessure et mort', 'blessure-et-mort', NULL, NULL, NULL, '/regles/blessures-et-etats/'),
  ('bois-du-printemps', 'Bois du printemps', 'bois-du-printemps', NULL, NULL, NULL, '/lore/bois-du-printemps/'),
  ('brock', 'Brock', 'brock', NULL, NULL, NULL, '/lore/brock/'),
  ('camnau', 'Camnau', 'camnau', NULL, NULL, NULL, '/lore/camnau/'),
  ('capse', 'Capse', 'capse', NULL, NULL, NULL, '/lore/capse/'),
  ('celsius', 'Celsius', 'celsius', NULL, NULL, NULL, '/lore/celsius/'),
  ('champicer', 'Champicer', 'champicer', NULL, NULL, NULL, '/lore/champicer/'),
  ('champieu', 'Champieu', 'champieu', NULL, NULL, NULL, '/lore/champieu/'),
  ('chapelle-des-os', 'Chapelle des Os', 'chapelle-des-os', NULL, NULL, NULL, '/lore/chapelle-des-os/'),
  ('chargement-mage-vert', 'Chargement (Mage Vert)', 'chargement-mage-vert', NULL, NULL, NULL, '/capacites/mage-vert-chargement/'),
  ('chronologie', 'Chronologie', 'chronologie', NULL, NULL, NULL, '/chronologie/'),
  ('classes', 'Classes', 'classes', NULL, NULL, NULL, '/classes/'),
  ('clerc', 'Clerc', 'clerc', NULL, NULL, 'classe:magiques', '/classes/clerc/'),
  ('cloche-dor', 'Cloche d’or', 'cloche-dor', NULL, NULL, NULL, '/lore/cloche-dor/'),
  ('collines-humides', 'Collines humides', 'collines-humides', NULL, NULL, NULL, '/lore/collines-humides/'),
  ('compagnie-du-fer-noir', 'Compagnie du Fer Noir', 'compagnie-du-fer-noir', NULL, NULL, NULL, '/lore/compagnie-du-fer-noir/'),
  ('composants', 'Composants', 'composants', NULL, NULL, NULL, '/ressources/composants/'),
  ('confrerie-du-sang', 'Confrérie du Sang', 'confrerie-du-sang', NULL, NULL, NULL, '/lore/confrerie-du-sang/'),
  ('couturier', 'Couturier', 'couturier', NULL, NULL, NULL, '/metiers/#metier-couturier'),
  ('creer-son-personnage', 'Créer son personnage', 'creer-son-personnage', NULL, NULL, 'partie:creer', '/regles/creer-son-personnage/'),
  ('croc-du-volcan', 'Croc du Volcan', 'croc-du-volcan', NULL, NULL, NULL, '/lore/croc-du-volcan/'),
  ('cuirasse', 'Cuirassé', 'cuirasse', NULL, NULL, 'classe:melee', '/classes/cuirasse/'),
  ('dimitri', 'Dimitri', 'dimitri', NULL, NULL, NULL, '/lore/dimitri/'),
  ('dombourg', 'Dombourg', 'dombourg', NULL, NULL, NULL, '/lore/dombourg/'),
  ('donjon-pas-bon', 'Donjon Pas bon', 'donjon-pas-bon', NULL, NULL, NULL, '/regles/donjon-pas-bon/'),
  ('double-coup-mage-rouge', 'Double coup (Mage Rouge)', 'double-coup-mage-rouge', NULL, NULL, NULL, '/capacites/mage-rouge-double-coup/'),
  ('double-coup-mage-vert', 'Double coup (Mage Vert)', 'double-coup-mage-vert', NULL, NULL, NULL, '/capacites/mage-vert-double-coup/'),
  ('dragon', 'Dragon', 'dragon', NULL, NULL, NULL, '/lore/dragon/'),
  ('drakos', 'Drakos', 'drakos', NULL, NULL, 'race:pure', '/races/drakos/'),
  ('drassah', 'Drassah', 'drassah', NULL, NULL, NULL, '/lore/drassah/'),
  ('drassahthac', 'Drassah''thac', 'drassahthac', NULL, NULL, 'race:hybride', '/races/drassahthac/'),
  ('eaunoire', 'Eaunoire', 'eaunoire', NULL, NULL, NULL, '/lore/eaunoire/'),
  ('eglise-du-sel', 'Église du Sel', 'eglise-du-sel', NULL, NULL, NULL, '/lore/eglise-du-sel/'),
  ('eirnn', 'Eirnn', 'eirnn', NULL, NULL, NULL, '/lore/eirnn/'),
  ('elfe-argente', 'Elfe argenté', 'elfe-argente', NULL, NULL, 'race:pure', '/races/elfe-argente/'),
  ('elfe-dore', 'Elfe doré', 'elfe-dore', NULL, NULL, 'race:pure', '/races/elfe-dore/'),
  ('elfe-forestier', 'Elfe forestier', 'elfe-forestier', NULL, NULL, 'race:pure', '/races/elfe-forestier/'),
  ('elfe-noir', 'Elfe noir', 'elfe-noir', NULL, NULL, 'race:pure', '/races/elfe-noir/'),
  ('empire-argente', 'Empire Argenté', 'empire-argente', NULL, NULL, NULL, '/lore/empire-argente/'),
  ('empire-humain', 'Empire Humain', 'empire-humain', NULL, NULL, NULL, '/lore/empire-humain/'),
  ('eoline', 'Éoline', 'eoline', NULL, NULL, NULL, '/lore/eoline/'),
  ('episir', 'Épisir', 'episir', NULL, NULL, NULL, '/lore/episir/'),
  ('erisia', 'Erisia', 'erisia', NULL, NULL, NULL, '/lore/erisia/'),
  ('etape-1-imaginer-son-personnage-et-choisir-sa-race', 'Étape 1 : imaginer son personnage et choisir sa race', 'etape-1-imaginer-son-personnage-et-choisir-sa-race', NULL, NULL, 'partie:creer', '/regles/choisir-sa-race/'),
  ('etape-2-choisir-ses-magies', 'Étape 2 : choisir ses magies', 'etape-2-choisir-ses-magies', NULL, NULL, 'partie:creer', '/regles/choisir-ses-magies/'),
  ('etape-3-choisir-sa-classe', 'Étape 3 : choisir sa classe', 'etape-3-choisir-sa-classe', NULL, NULL, 'partie:creer', '/regles/choisir-sa-classe/'),
  ('etape-4-repartir-caracteristiques-et-competences', 'Étape 4 : répartir caractéristiques et compétences', 'etape-4-repartir-caracteristiques-et-competences', NULL, NULL, 'partie:creer', '/regles/caracteristiques-et-competences/'),
  ('etape-5-choisir-ses-premiers-sorts', 'Étape 5 : choisir ses premiers sorts', 'etape-5-choisir-ses-premiers-sorts', NULL, NULL, 'partie:creer', '/regles/premiers-sorts/'),
  ('etape-6-finaliser-son-personnage', 'Étape 6 : finaliser son personnage', 'etape-6-finaliser-son-personnage', NULL, NULL, 'partie:creer', '/regles/finaliser-son-personnage/'),
  ('evravonie', 'Evravonie', 'evravonie', NULL, NULL, NULL, '/lore/evravonie/'),
  ('excalibur', 'Excalibur', 'excalibur', NULL, NULL, NULL, '/lore/excalibur/'),
  ('farfadet', 'Farfadet', 'farfadet', NULL, NULL, 'race:pure', '/races/farfadet/'),
  ('felfe', 'Felfe', 'felfe', NULL, NULL, 'race:pure', '/races/felfe/'),
  ('fenrir', 'Fenrir', 'fenrir', NULL, NULL, 'race:hybride', '/races/fenrir/'),
  ('fenrir-classe', 'Fenrir (classe)', 'fenrir-classe', NULL, NULL, 'classe:raciales', '/classes/fenrir/'),
  ('fiche-de-personnage', 'Fiche de personnage', 'fiche-de-personnage', NULL, NULL, NULL, '/fiche/'),
  ('fiche-de-personnage-accessoires-et-ceinture', 'Fiche de personnage : Accessoires et Ceinture', 'fiche-de-personnage-accessoires-et-ceinture', NULL, NULL, NULL, '/regles/fiche-accessoires-et-ceinture/'),
  ('fiche-de-personnage-armure-defense-bouclier', 'Fiche de personnage : Armure/Défense/Bouclier', 'fiche-de-personnage-armure-defense-bouclier', NULL, NULL, NULL, '/regles/fiche-armure-defense-bouclier/'),
  ('fiche-de-personnage-experience-niveau-global', 'Fiche de personnage : Expérience/Niveau global', 'fiche-de-personnage-experience-niveau-global', NULL, NULL, NULL, '/regles/fiche-experience-niveau-global/'),
  ('fiche-de-personnage-inventaire-sac-a-dos', 'Fiche de personnage : Inventaire/Sac à dos', 'fiche-de-personnage-inventaire-sac-a-dos', NULL, NULL, NULL, '/regles/fiche-inventaire-sac-a-dos/'),
  ('fiche-de-personnage-maitrise-darme-et-armes', 'Fiche de personnage : Maîtrise d’arme et Armes', 'fiche-de-personnage-maitrise-darme-et-armes', NULL, NULL, NULL, '/regles/fiche-maitrise-darme-et-armes/'),
  ('fiche-de-personnage-tableau-posture', 'Fiche de personnage : Tableau Posture', 'fiche-de-personnage-tableau-posture', NULL, NULL, NULL, '/regles/fiche-tableau-posture/'),
  ('flagelleur', 'Flagelleur', 'flagelleur', NULL, NULL, 'classe:speciales', '/classes/flagelleur/'),
  ('foret-colossale', 'Forêt colossale', 'foret-colossale', NULL, NULL, NULL, '/lore/foret-colossale/'),
  ('foret-de-lete', 'Forêt de l’été', 'foret-de-lete', NULL, NULL, NULL, '/lore/foret-de-lete/'),
  ('forgeron', 'Forgeron', 'forgeron', NULL, NULL, NULL, '/metiers/#metier-forgeron'),
  ('formule-des-degats', 'Formule des dégâts', 'formule-des-degats', NULL, NULL, NULL, '/regles/formule-des-degats/'),
  ('foudre-etincelante', 'Foudre étincelante', 'foudre-etincelante', NULL, NULL, NULL, '/lore/foudre-etincelante/'),
  ('frappeur', 'Frappeur', 'frappeur', NULL, NULL, 'classe:melee', '/classes/frappeur/'),
  ('glossaire', 'Glossaire', 'glossaire', NULL, NULL, NULL, '/lore/glossaire/'),
  ('goleois', 'Goleois', 'goleois', NULL, NULL, 'race:hybride', '/races/goleois/'),
  ('goleois-classe', 'Goleois (classe)', 'goleois-classe', NULL, NULL, 'classe:raciales', '/classes/goleois/'),
  ('grelon', 'Grelon', 'grelon', NULL, NULL, NULL, '/lore/grelon/'),
  ('grenadier', 'Grenadier', 'grenadier', NULL, NULL, 'classe:distance', '/classes/grenadier/'),
  ('guerisseurs-silencieux', 'Guérisseurs silencieux', 'guerisseurs-silencieux', NULL, NULL, NULL, '/lore/guerisseurs-silencieux/'),
  ('guerrier', 'Guerrier', 'guerrier', NULL, NULL, 'classe:melee', '/classes/guerrier/'),
  ('guide-pour-mj-maverick', 'Guide pour MJ - Maverick', 'guide-pour-mj-maverick', NULL, NULL, NULL, '/mj/guide-pour-mj-maverick/'),
  ('hache-du-bourreau-dechire', 'Hache du Bourreau déchiré', 'hache-du-bourreau-dechire', NULL, NULL, NULL, '/lore/hache-du-bourreau-dechire/'),
  ('hujin', 'Hujin', 'hujin', NULL, NULL, 'race:pure', '/races/hujin/'),
  ('humain', 'Humain', 'humain', NULL, NULL, 'race:pure', '/races/humain/'),
  ('jackalope', 'Jackalope', 'jackalope', NULL, NULL, 'race:hybride', '/races/jackalope/'),
  ('jackalope-classe', 'Jackalope (classe)', 'jackalope-classe', NULL, NULL, 'classe:raciales', '/classes/jackalope/'),
  ('jet-de-des', 'Jet de dés', 'jet-de-des', NULL, NULL, NULL, '/regles/jet-de-des/'),
  ('kitsune', 'Kitsune', 'kitsune', NULL, NULL, 'race:hybride', '/races/kitsune/'),
  ('kitsune-classe', 'Kitsune (classe)', 'kitsune-classe', NULL, NULL, 'classe:raciales', '/classes/kitsune/'),
  ('la-confrerie-des-brandes-sacrileges', 'La Confrérie des Brandes Sacrilèges', 'la-confrerie-des-brandes-sacrileges', NULL, NULL, NULL, '/lore/la-confrerie-des-brandes-sacrileges/'),
  ('la-magie-en-jeu', 'La magie en jeu', 'la-magie-en-jeu', NULL, NULL, NULL, '/regles/la-magie-en-jeu/'),
  ('la-main-sanglante', 'La main sanglante', 'la-main-sanglante', NULL, NULL, NULL, '/lore/la-main-sanglante/'),
  ('la-montee-de-niveau', 'La montée de niveau', 'la-montee-de-niveau', NULL, NULL, NULL, '/regles/la-montee-de-niveau/'),
  ('la-pointe-de-sang', 'La pointe de sang', 'la-pointe-de-sang', NULL, NULL, NULL, '/lore/la-pointe-de-sang/'),
  ('la-prise-en-tenaille-et-zone-dinfluence', 'La prise en tenaille et zone d’influence', 'la-prise-en-tenaille-et-zone-dinfluence', NULL, NULL, NULL, '/regles/prise-en-tenaille-et-zone-d-influence/'),
  ('la-vitesse-et-la-portee', 'La Vitesse et la Portée', 'la-vitesse-et-la-portee', NULL, NULL, NULL, '/regles/vitesse-et-portee/'),
  ('lame-seuil', 'Lame-Seuil', 'lame-seuil', NULL, NULL, NULL, '/lore/lame-seuil/'),
  ('lamia', 'Lamia', 'lamia', NULL, NULL, 'race:pure', '/races/lamia/'),
  ('lance-du-bourreau-dechire', 'Lance du Bourreau déchiré', 'lance-du-bourreau-dechire', NULL, NULL, NULL, '/lore/lance-du-bourreau-dechire/'),
  ('lanceur', 'Lanceur', 'lanceur', NULL, NULL, 'classe:distance', '/classes/lanceur/'),
  ('lancier', 'Lancier', 'lancier', NULL, NULL, 'classe:melee', '/classes/lancier/'),
  ('le-mode-hyper', 'Le Mode Hyper', 'le-mode-hyper', NULL, NULL, NULL, '/regles/le-mode-hyper/'),
  ('le-tour-de-jeu', 'Le tour de jeu', 'le-tour-de-jeu', NULL, NULL, NULL, '/regles/le-tour-de-jeu/'),
  ('lembuscade', 'L’embuscade', 'lembuscade', NULL, NULL, NULL, '/regles/l-embuscade/'),
  ('lequipement', 'L’équipement', 'lequipement', NULL, NULL, NULL, '/regles/l-equipement/'),
  ('les-actions-et-mouvements', 'Les Actions et mouvements', 'les-actions-et-mouvements', NULL, NULL, NULL, '/regles/actions-et-mouvements/'),
  ('les-attaques-discretes', 'Les attaques discrètes', 'les-attaques-discretes', NULL, NULL, NULL, '/regles/les-attaques-discretes/'),
  ('les-attaques-dopportunite', 'Les attaques d''opportunité', 'les-attaques-dopportunite', NULL, NULL, NULL, '/regles/les-attaques-d-opportunite/'),
  ('les-belladones-fleurissantes', 'Les Belladones Fleurissantes', 'les-belladones-fleurissantes', NULL, NULL, NULL, '/lore/les-belladones-fleurissantes/'),
  ('les-civilisations', 'Les Civilisations', 'les-civilisations', NULL, NULL, NULL, '/lore/les-civilisations/'),
  ('les-degats', 'Les dégâts', 'les-degats', NULL, NULL, NULL, '/regles/les-degats/'),
  ('les-divinites', 'Les Divinités', 'les-divinites', NULL, NULL, NULL, '/lore/les-divinites/'),
  ('les-embaumeurs', 'Les embaumeurs', 'les-embaumeurs', NULL, NULL, NULL, '/lore/les-embaumeurs/'),
  ('les-exaltes', 'Les Exaltés', 'les-exaltes', NULL, NULL, NULL, '/lore/les-exaltes/'),
  ('les-flammes-bleues', 'Les Flammes Bleues', 'les-flammes-bleues', NULL, NULL, NULL, '/lore/les-flammes-bleues/'),
  ('les-guerisseurs', 'Les Guérisseurs', 'les-guerisseurs', NULL, NULL, NULL, '/lore/les-guerisseurs/'),
  ('les-impacts-mineur-et-majeur', 'Les Impacts mineur et majeur', 'les-impacts-mineur-et-majeur', NULL, NULL, NULL, '/lore/les-impacts-mineur-et-majeur/'),
  ('les-jardiniers-mycillis', 'Les Jardiniers Mycillis', 'les-jardiniers-mycillis', NULL, NULL, NULL, '/lore/les-jardiniers-mycillis/'),
  ('les-neuf-alignements', 'Les neuf alignements', 'les-neuf-alignements', NULL, NULL, NULL, '/regles/les-neuf-alignements/'),
  ('les-outils-legendaires-uniques', 'Les Outils Légendaires, Uniques', 'les-outils-legendaires-uniques', NULL, NULL, NULL, '/lore/les-outils-legendaires-uniques/'),
  ('les-pieges', 'Les pièges', 'les-pieges', NULL, NULL, NULL, '/regles/les-pieges/'),
  ('les-portes', 'Les portes', 'les-portes', NULL, NULL, NULL, '/regles/les-portes/'),
  ('les-postures', 'Les postures', 'les-postures', NULL, NULL, NULL, '/regles/les-postures/'),
  ('les-races-non-jouable', 'Les races non-jouable', 'les-races-non-jouable', NULL, NULL, NULL, '/lore/les-races-non-jouable/'),
  ('liste-des-alterations-detat', 'Liste des altérations d''état', 'liste-des-alterations-detat', NULL, NULL, NULL, '/regles/liste-des-alterations-d-etat/'),
  ('livre-parchemin', 'Livre/Parchemin', 'livre-parchemin', NULL, NULL, NULL, '/ressources/livre-parchemin/'),
  ('londolor', 'Londolor', 'londolor', NULL, NULL, NULL, '/lore/londolor/'),
  ('lordre-de-lacier', 'L’Ordre de l’acier', 'lordre-de-lacier', NULL, NULL, NULL, '/lore/lordre-de-lacier/'),
  ('lunivers', 'L’univers', 'lunivers', NULL, NULL, 'partie:decouvrir', '/decouvrir/l-univers/'),
  ('maclier', 'Maclier', 'maclier', NULL, NULL, 'classe:magiques', '/classes/maclier/'),
  ('mage', 'Mage', 'mage', NULL, NULL, 'classe:magiques', '/classes/mage/'),
  ('mage-bleu', 'Mage Bleu', 'mage-bleu', NULL, NULL, 'classe:magiques', '/classes/mage-bleu/'),
  ('mage-rouge', 'Mage Rouge', 'mage-rouge', NULL, NULL, 'classe:magiques', '/classes/mage-rouge/'),
  ('mage-vert', 'Mage Vert', 'mage-vert', NULL, NULL, 'classe:magiques', '/classes/mage-vert/'),
  ('magie-de-la-corruption', 'Magie de la Corruption', 'magie-de-la-corruption', NULL, NULL, 'magie:corruption', '/magies/magie-de-la-corruption/'),
  ('magie-de-la-foudre', 'Magie de la Foudre', 'magie-de-la-foudre', NULL, NULL, 'magie:foudre', '/magies/magie-de-la-foudre/'),
  ('magie-de-la-glace', 'Magie de la Glace', 'magie-de-la-glace', NULL, NULL, 'magie:glace', '/magies/magie-de-la-glace/'),
  ('magie-de-la-lumiere', 'Magie de la Lumière', 'magie-de-la-lumiere', NULL, NULL, 'magie:lumiere', '/magies/magie-de-la-lumiere/'),
  ('magie-de-la-necromancie', 'Magie de la Nécromancie', 'magie-de-la-necromancie', NULL, NULL, 'magie:necromancie', '/magies/magie-de-la-necromancie/'),
  ('magie-de-la-terre', 'Magie de la Terre', 'magie-de-la-terre', NULL, NULL, 'magie:terre', '/magies/magie-de-la-terre/'),
  ('magie-de-larcane', 'Magie de l''Arcane', 'magie-de-larcane', NULL, NULL, 'magie:arcane', '/magies/magie-de-larcane/'),
  ('magie-de-leau', 'Magie de l''Eau', 'magie-de-leau', NULL, NULL, 'magie:eau', '/magies/magie-de-leau/'),
  ('magie-de-lespace-temps', 'Magie de l''Espace/Temps', 'magie-de-lespace-temps', NULL, NULL, 'magie:espace-temps', '/magies/magie-de-lespace-temps/'),
  ('magie-de-lombre', 'Magie de l''Ombre', 'magie-de-lombre', NULL, NULL, 'magie:ombre', '/magies/magie-de-lombre/'),
  ('magie-du-feu', 'Magie du Feu', 'magie-du-feu', NULL, NULL, 'magie:feu', '/magies/magie-du-feu/'),
  ('magie-du-sang', 'Magie du Sang', 'magie-du-sang', NULL, NULL, 'magie:sang', '/magies/magie-du-sang/'),
  ('magie-du-vent', 'Magie du Vent', 'magie-du-vent', NULL, NULL, 'magie:vent', '/magies/magie-du-vent/'),
  ('magie-du-vide', 'Magie du Vide', 'magie-du-vide', NULL, NULL, 'magie:vide', '/magies/magie-du-vide/'),
  ('magies', 'Magies', 'magies', NULL, NULL, NULL, '/magies/'),
  ('majin', 'Majin', 'majin', NULL, NULL, 'race:pure', '/races/majin/'),
  ('maladie', 'Maladie', 'maladie', NULL, NULL, NULL, '/ressources/maladie/'),
  ('marais-fangeux', 'Marais fangeux', 'marais-fangeux', NULL, NULL, NULL, '/lore/marais-fangeux/'),
  ('marais-vert', 'Marais vert', 'marais-vert', NULL, NULL, NULL, '/lore/marais-vert/'),
  ('marcass', 'Marcass', 'marcass', NULL, NULL, 'race:hybride', '/races/marcass/'),
  ('marcass-classe', 'Marcass (classe)', 'marcass-classe', NULL, NULL, 'classe:raciales', '/classes/marcass/'),
  ('martiale', 'Martiale', 'martiale', NULL, NULL, 'classe:melee', '/classes/martiale/'),
  ('medecin-sans-frontiere', 'Médecin sans frontière', 'medecin-sans-frontiere', NULL, NULL, NULL, '/lore/medecin-sans-frontiere/'),
  ('medusain', 'Médusain', 'medusain', NULL, NULL, 'race:hybride', '/races/medusain/'),
  ('medusain-classe', 'Médusain (classe)', 'medusain-classe', NULL, NULL, 'classe:raciales', '/classes/medusain/'),
  ('mercenaire', 'Mercenaire', 'mercenaire', NULL, NULL, 'classe:melee', '/classes/mercenaire/'),
  ('meteo', 'Météo', 'meteo', NULL, NULL, NULL, '/regles/meteo/'),
  ('metiers', 'Métiers', 'metiers', NULL, NULL, NULL, '/metiers/'),
  ('mineur', 'Mineur', 'mineur', NULL, NULL, NULL, '/metiers/#metier-mineur'),
  ('minotaure', 'Minotaure', 'minotaure', NULL, NULL, 'race:hybride', '/races/minotaure/'),
  ('minotaure-classe', 'Minotaure (classe)', 'minotaure-classe', NULL, NULL, 'classe:raciales', '/classes/minotaure/'),
  ('mirada', 'Mirada', 'mirada', NULL, NULL, NULL, '/lore/mirada/'),
  ('moine', 'Moine', 'moine', NULL, NULL, 'classe:melee', '/classes/moine/'),
  ('mont-cendre', 'Mont cendré', 'mont-cendre', NULL, NULL, NULL, '/lore/mont-cendre/'),
  ('monts-couloirs', 'Monts Couloirs', 'monts-couloirs', NULL, NULL, NULL, '/lore/monts-couloirs/'),
  ('mora', 'Mora', 'mora', NULL, NULL, NULL, '/lore/mora/'),
  ('morfot', 'Morfot', 'morfot', NULL, NULL, NULL, '/lore/morfot/'),
  ('mort-vivant', 'Mort-vivant', 'mort-vivant', NULL, NULL, 'race:pure', '/races/mort-vivant/'),
  ('mrode', 'Mrode', 'mrode', NULL, NULL, NULL, '/lore/mrode/'),
  ('nain', 'Nain', 'nain', NULL, NULL, 'race:pure', '/races/nain/'),
  ('namazu', 'Namazu', 'namazu', NULL, NULL, 'race:hybride', '/races/namazu/'),
  ('namazu-classe', 'Namazu (classe)', 'namazu-classe', NULL, NULL, 'classe:raciales', '/classes/namazu/'),
  ('notix', 'Notix', 'notix', NULL, NULL, NULL, '/lore/notix/'),
  ('oceane', 'Océane', 'oceane', NULL, NULL, NULL, '/lore/oceane/'),
  ('ocultomancien', 'Ocultomancien', 'ocultomancien', NULL, NULL, 'classe:magiques', '/classes/ocultomancien/'),
  ('olwman', 'Olwman', 'olwman', NULL, NULL, 'race:hybride', '/races/olwman/'),
  ('olwman-classe', 'Olwman (classe)', 'olwman-classe', NULL, NULL, 'classe:raciales', '/classes/olwman/'),
  ('onir', 'Onir', 'onir', NULL, NULL, NULL, '/lore/onir/'),
  ('ordre-de-gardecroc', 'Ordre de Gardecroc', 'ordre-de-gardecroc', NULL, NULL, NULL, '/lore/ordre-de-gardecroc/'),
  ('ordre-de-la-glace-rouge', 'Ordre de la Glace Rouge', 'ordre-de-la-glace-rouge', NULL, NULL, NULL, '/lore/ordre-de-la-glace-rouge/'),
  ('ordre-de-la-mort', 'Ordre de la mort', 'ordre-de-la-mort', NULL, NULL, NULL, '/lore/ordre-de-la-mort/'),
  ('ordre-des-abeilles', 'Ordre des Abeilles', 'ordre-des-abeilles', NULL, NULL, NULL, '/lore/ordre-des-abeilles/'),
  ('ordre-du-brai', 'Ordre du brai', 'ordre-du-brai', NULL, NULL, NULL, '/lore/ordre-du-brai/'),
  ('ordre-solaire', 'Ordre Solaire', 'ordre-solaire', NULL, NULL, NULL, '/lore/ordre-solaire/'),
  ('origine-du-monde', 'Origine du monde', 'origine-du-monde', NULL, NULL, NULL, '/lore/origine-du-monde/'),
  ('orios', 'Orios', 'orios', NULL, NULL, 'race:hybride', '/races/orios/'),
  ('orios-classe', 'Orios (classe)', 'orios-classe', NULL, NULL, 'classe:raciales', '/classes/orios/'),
  ('parleur', 'Parleur', 'parleur', NULL, NULL, 'classe:speciales', '/classes/parleur/'),
  ('pieces-elementaires', 'Pièces élémentaires', 'pieces-elementaires', NULL, NULL, NULL, '/ressources/armes/#pieces-elementaires'),
  ('plaine-brillante', 'Plaine brillante', 'plaine-brillante', NULL, NULL, NULL, '/lore/plaine-brillante/'),
  ('plaines-seches', 'Plaines sèches', 'plaines-seches', NULL, NULL, NULL, '/lore/plaines-seches/'),
  ('plateau-tonnerre', 'Plateau Tonnerre', 'plateau-tonnerre', NULL, NULL, NULL, '/lore/plateau-tonnerre/'),
  ('potentiel-illimite', 'Potentiel illimité', 'potentiel-illimite', NULL, NULL, 'magie:potentiel-illimite', '/magies/potentiel-illimite/'),
  ('preparation-mage-rouge', 'Préparation (Mage Rouge)', 'preparation-mage-rouge', NULL, NULL, NULL, '/capacites/mage-rouge-preparation/'),
  ('pugiliste', 'Pugiliste', 'pugiliste', NULL, NULL, 'classe:melee', '/classes/pugiliste/'),
  ('races', 'Races', 'races', NULL, NULL, NULL, '/races/'),
  ('rater-ses-sortileges', 'Rater ses sortilèges', 'rater-ses-sortileges', NULL, NULL, NULL, '/regles/rater-ses-sortileges/'),
  ('regles-des-metiers', 'Règles des métiers', 'regles-des-metiers', NULL, NULL, NULL, '/metiers/regles-des-metiers/'),
  ('relations-entre-les-races', 'Relations entre les races', 'relations-entre-les-races', NULL, NULL, NULL, '/lore/relations-entre-les-races/'),
  ('republique-forestier', 'République Forestier', 'republique-forestier', NULL, NULL, NULL, '/lore/republique-forestier/'),
  ('republique-noire', 'République Noire', 'republique-noire', NULL, NULL, NULL, '/lore/republique-noire/'),
  ('resistances-et-faiblesses', 'Résistances et faiblesses', 'resistances-et-faiblesses', NULL, NULL, NULL, '/regles/resistances-et-faiblesses/'),
  ('reussir-une-action', 'Réussir une action', 'reussir-une-action', NULL, NULL, NULL, '/regles/reussir-une-action/'),
  ('rokh', 'Rokh', 'rokh', NULL, NULL, 'race:hybride', '/races/rokh/'),
  ('rokh-classe', 'Rokh (classe)', 'rokh-classe', NULL, NULL, 'classe:raciales', '/classes/rokh/'),
  ('ruines-rouges', 'Ruines Rouges', 'ruines-rouges', NULL, NULL, NULL, '/lore/ruines-rouges/'),
  ('satyre', 'Satyre', 'satyre', NULL, NULL, 'race:hybride', '/races/satyre/'),
  ('satyre-classe', 'Satyre (classe)', 'satyre-classe', NULL, NULL, 'classe:raciales', '/classes/satyre/'),
  ('saugnane', 'Saugnane', 'saugnane', NULL, NULL, NULL, '/lore/saugnane/'),
  ('selcalibur', 'Selcalibur', 'selcalibur', NULL, NULL, NULL, '/lore/selcalibur/'),
  ('sentrainer', 'S’entraîner', 'sentrainer', NULL, NULL, NULL, '/regles/s-entrainer-et-exercer-un-metier/'),
  ('seraphe', 'Séraphe', 'seraphe', NULL, NULL, NULL, '/lore/seraphe/'),
  ('seraphin', 'Séraphin', 'seraphin', NULL, NULL, NULL, '/lore/seraphin/'),
  ('signe-des-pirates', 'Signe des pirates', 'signe-des-pirates', NULL, NULL, NULL, '/lore/signe-des-pirates/'),
  ('situation-actuelle', 'Situation actuelle', 'situation-actuelle', NULL, NULL, NULL, '/lore/situation-actuelle/'),
  ('soir-matin', 'Soir-matin', 'soir-matin', NULL, NULL, NULL, '/lore/soir-matin/'),
  ('super-gemme', 'Super Gemme', 'super-gemme', NULL, NULL, NULL, '/lore/super-gemme/'),
  ('temple-de-la-foudre', 'Temple de la Foudre', 'temple-de-la-foudre', NULL, NULL, NULL, '/lore/temple-de-la-foudre/'),
  ('temple-de-la-glace', 'Temple de la Glace', 'temple-de-la-glace', NULL, NULL, NULL, '/lore/temple-de-la-glace/'),
  ('temple-de-la-lumiere', 'Temple de la Lumière', 'temple-de-la-lumiere', NULL, NULL, NULL, '/lore/temple-de-la-lumiere/'),
  ('temple-de-la-terre', 'Temple de la Terre', 'temple-de-la-terre', NULL, NULL, NULL, '/lore/temple-de-la-terre/'),
  ('temple-de-leau', 'Temple de l’Eau', 'temple-de-leau', NULL, NULL, NULL, '/lore/temple-de-leau/'),
  ('temple-de-lespace-temps', 'Temple de l’Espace/Temps', 'temple-de-lespace-temps', NULL, NULL, NULL, '/lore/temple-de-lespace-temps/'),
  ('temple-de-lombre', 'Temple de l’Ombre', 'temple-de-lombre', NULL, NULL, NULL, '/lore/temple-de-lombre/'),
  ('temple-de-vent', 'Temple de Vent', 'temple-de-vent', NULL, NULL, NULL, '/lore/temple-de-vent/'),
  ('temple-du-feu', 'Temple du Feu', 'temple-du-feu', NULL, NULL, NULL, '/lore/temple-du-feu/'),
  ('temple-du-savoir', 'Temple du Savoir', 'temple-du-savoir', NULL, NULL, NULL, '/lore/temple-du-savoir/'),
  ('temple-noir', 'Temple noir', 'temple-noir', NULL, NULL, NULL, '/lore/temple-noir/'),
  ('temples-cultes-guildes', 'Temples/Cultes/Guildes', 'temples-cultes-guildes', NULL, NULL, NULL, '/lore/temples-cultes-guildes/'),
  ('terre-grise', 'Terre grise', 'terre-grise', NULL, NULL, NULL, '/lore/terre-grise/'),
  ('tisseurs-de-soi', 'Tisseurs de soi', 'tisseurs-de-soi', NULL, NULL, NULL, '/lore/tisseurs-de-soi/'),
  ('tofrom', 'Tofrom', 'tofrom', NULL, NULL, NULL, '/lore/tofrom/'),
  ('tounne', 'Tounne', 'tounne', NULL, NULL, NULL, '/lore/tounne/'),
  ('tueur', 'Tueur', 'tueur', NULL, NULL, 'classe:melee', '/classes/tueur/'),
  ('umbro', 'Umbro', 'umbro', NULL, NULL, NULL, '/lore/umbro/'),
  ('un-maitre-du-jeu', 'Un maître du Jeu', 'un-maitre-du-jeu', NULL, NULL, NULL, '/mj/un-maitre-du-jeu/'),
  ('vampires-primordiaux', 'Vampires primordiaux', 'vampires-primordiaux', NULL, NULL, NULL, '/lore/vampires-primordiaux/'),
  ('ville-oeil', 'Ville-Oeil', 'ville-oeil', NULL, NULL, NULL, '/lore/ville-oeil/'),
  ('voleur', 'Voleur', 'voleur', NULL, NULL, 'classe:melee', '/classes/voleur/'),
  ('volt', 'Volt', 'volt', NULL, NULL, NULL, '/lore/volt/'),
  ('xendown', 'Xendown', 'xendown', NULL, NULL, NULL, '/lore/xendown/');

-- 4. Les liens des textes devenus des balises (une instruction par lien distinct d'un texte)
UPDATE competence SET description = replace(description, '[[Altérations d''états et Mode Hyper|altérations d''états]]', '{{alterations-detats-et-mode-hyper|altérations d''états}}') WHERE "id" = 'vigueur' AND instr(description, '[[Altérations d''états et Mode Hyper|altérations d''états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|la vitesse]]', '{{la-vitesse-et-la-portee|la vitesse}}') WHERE "id" = 'guide/actions-et-mouvements' AND instr(corps_md, '[[La Vitesse et la Portée|la vitesse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Jet de dés|jet de dés]]', '{{jet-de-des|jet de dés}}') WHERE "id" = 'guide/actions-et-mouvements' AND instr(corps_md, '[[Jet de dés|jet de dés]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-neuf-alignements|Les neuf alignements]]', '{{les-neuf-alignements}}') WHERE "id" = 'guide/alignement' AND instr(corps_md, '[[guide/les-neuf-alignements|Les neuf alignements]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/liste-des-alterations-d-etat|la liste des altérations d’état]]', '{{liste-des-alterations-detat|la liste des altérations d’état}}') WHERE "id" = 'guide/alterations-d-etats' AND instr(corps_md, '[[guide/liste-des-alterations-d-etat|la liste des altérations d’état]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/alterations-d-etats' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]', '{{le-tour-de-jeu}}') WHERE "id" = 'guide/alterations-d-etats' AND instr(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|la vitesse]]', '{{la-vitesse-et-la-portee|la vitesse}}') WHERE "id" = 'guide/attaque-et-defense' AND instr(corps_md, '[[La Vitesse et la Portée|la vitesse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/prise-en-tenaille-et-zone-d-influence|La prise en tenaille et zone d’influence]]', '{{la-prise-en-tenaille-et-zone-dinfluence}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/prise-en-tenaille-et-zone-d-influence|La prise en tenaille et zone d’influence]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-attaques-d-opportunite|Les attaques d''opportunité]]', '{{les-attaques-dopportunite}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/les-attaques-d-opportunite|Les attaques d''opportunité]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-attaques-discretes|Les attaques discrètes]]', '{{les-attaques-discretes}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/les-attaques-discretes|Les attaques discrètes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]', '{{guide-pour-mj-maverick|Doc « Guide pour MJ »}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]', '{{attaque-et-defense}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[armes](/ressources/equipement/#armes)', '{{armes|armes}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[armes](/ressources/equipement/#armes)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L’équipement]]', '{{lequipement}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/l-equipement|L’équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-embuscade|L’embuscade]]', '{{lembuscade}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/l-embuscade|L’embuscade]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-degats|Les dégâts]]', '{{les-degats}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[guide/les-degats|Les dégâts]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/bimane|Bimane]]', '{{bimane}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[classes/bimane|Bimane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/voleur|voleur]]', '{{voleur|voleur}}') WHERE "id" = 'guide/attaquer-et-se-defendre' AND instr(corps_md, '[[classes/voleur|voleur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/creer-son-personnage|Créer son personnage]]', '{{creer-son-personnage}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[guide/creer-son-personnage|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]', '{{la-montee-de-niveau}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/drassahthac|Drassah’thac]]', '{{drassahthac|Drassah’thac}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[races/drassahthac|Drassah’thac]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-univers|L’univers]]', '{{lunivers}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[guide/l-univers|L’univers]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/humain|humains]]', '{{humain|humains}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[races/humain|humains]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/drakos|Drakos]]', '{{drakos}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[races/drakos|Drakos]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/orios|Orios]]', '{{orios}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[races/orios|Orios]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/nain|nains]]', '{{nain|nains}}') WHERE "id" = 'guide/bienvenue' AND instr(corps_md, '[[races/nain|nains]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Consommables](/ressources/equipement/#ceinture-consommables)', '{{ceinture|Consommables}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[Consommables](/ressources/equipement/#ceinture-consommables)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]', '{{la-magie-en-jeu}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]', '{{le-mode-hyper}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[ressources/alchimie|alchimie]]', '{{alchimie|alchimie}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[[ressources/alchimie|alchimie]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[ressources/maladie|Maladie]]', '{{maladie}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[[ressources/maladie|Maladie]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[les races](/races/)', '{{races|les races}}') WHERE "id" = 'guide/blessures-et-etats' AND instr(corps_md, '[les races](/races/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/caracteristiques-et-competences' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[armes](/ressources/equipement/#armes)', '{{armes|armes}}') WHERE "id" = 'guide/caracteristiques-et-competences' AND instr(corps_md, '[armes](/ressources/equipement/#armes)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/flagelleur|Flagelleur]]', '{{flagelleur}}') WHERE "id" = 'guide/choisir-sa-classe' AND instr(corps_md, '[[classes/flagelleur|Flagelleur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[classes](/classes/)', '{{classes|classes}}') WHERE "id" = 'guide/choisir-sa-classe' AND instr(corps_md, '[classes](/classes/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[27 races](/races/)', '{{races|27 races}}') WHERE "id" = 'guide/choisir-sa-race' AND instr(corps_md, '[27 races](/races/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]', '{{resistances-et-faiblesses}}') WHERE "id" = 'guide/choisir-ses-magies' AND instr(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Magie de la Corruption|Corruption]]', '{{magie-de-la-corruption|Corruption}}') WHERE "id" = 'guide/choisir-ses-magies' AND instr(corps_md, '[[Magie de la Corruption|Corruption]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Potentiel Illimité]]', '{{potentiel-illimite|Potentiel Illimité}}') WHERE "id" = 'guide/choisir-ses-magies' AND instr(corps_md, '[[Potentiel Illimité]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/creer-son-personnage' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|La vitesse]]', '{{la-vitesse-et-la-portee|La vitesse}}') WHERE "id" = 'guide/distance-et-voyage' AND instr(corps_md, '[[La Vitesse et la Portée|La vitesse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les pièges]]', '{{les-pieges}}') WHERE "id" = 'guide/donjon-pas-bon' AND instr(corps_md, '[[Les pièges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Équipement](/ressources/equipement/)', '{{armes|Équipement}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[Équipement](/ressources/equipement/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L''équipement]]', '{{lequipement|L''équipement}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[[guide/l-equipement|L''équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[matériau](/ressources/composants/)', '{{composants|matériau}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[matériau](/ressources/composants/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[metiers/couturier|couturier]]', '{{couturier|couturier}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[[metiers/couturier|couturier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Artisanat](/regles/artisanat/)', '{{artisanat}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[Artisanat](/regles/artisanat/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[metiers/forgeron|forgeron]]', '{{forgeron|forgeron}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[[metiers/forgeron|forgeron]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[bestiaire](/bestiaire/)', '{{bestiaire|bestiaire}}') WHERE "id" = 'guide/equipement-et-butin' AND instr(corps_md, '[bestiaire](/bestiaire/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner]]', '{{sentrainer}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Composants](/ressources/composants/)', '{{composants}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[Composants](/ressources/composants/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[tableau des métiers](/metiers/)', '{{metiers|tableau des métiers}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[tableau des métiers](/metiers/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Artisanat](/regles/artisanat/)', '{{artisanat}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[Artisanat](/regles/artisanat/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Règles des métiers]]', '{{regles-des-metiers}}') WHERE "id" = 'guide/exercer-un-metier' AND instr(corps_md, '[[Règles des métiers]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Altérations d''états et Mode Hyper|altérations d''états]]', '{{alterations-detats-et-mode-hyper|altérations d''états}}') WHERE "id" = 'guide/fiche-competences' AND instr(corps_md, '[[Altérations d''états et Mode Hyper|altérations d''états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Jet de dés|jet de dés]]', '{{jet-de-des|jet de dés}}') WHERE "id" = 'guide/fiche-competences' AND instr(corps_md, '[[Jet de dés|jet de dés]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|la portée]]', '{{la-vitesse-et-la-portee|la portée}}') WHERE "id" = 'guide/fiche-maitrise-darme-et-armes' AND instr(corps_md, '[[La Vitesse et la Portée|la portée]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Alignement]]', '{{alignement}}') WHERE "id" = 'guide/fiche-personnage' AND instr(corps_md, '[[Alignement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Altérations d''états et Mode Hyper|mode hyper]]', '{{alterations-detats-et-mode-hyper|mode hyper}}') WHERE "id" = 'guide/fiche-tableau-posture' AND instr(corps_md, '[[Altérations d''états et Mode Hyper|mode hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/resistances-et-faiblesses|ici]]', '{{resistances-et-faiblesses|ici}}') WHERE "id" = 'guide/fiche-tableau-resistances-faiblesses' AND instr(corps_md, '[[guide/resistances-et-faiblesses|ici]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]', '{{sentrainer|S’entraîner et exercer un métier}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]', '{{la-montee-de-niveau}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|action rapide (IC)]]', '{{le-tour-de-jeu|action rapide (IC)}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[guide/le-tour-de-jeu|action rapide (IC)]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L’équipement]]', '{{lequipement}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[guide/l-equipement|L’équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Règles des métiers]]', '{{regles-des-metiers}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[Règles des métiers]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[métier](/metiers/)', '{{metiers|métier}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[métier](/metiers/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Alignement]]', '{{alignement}}') WHERE "id" = 'guide/finaliser-son-personnage' AND instr(corps_md, '[[Alignement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Résistance/Faiblesse Magie|Résistances/Faiblesses magique]]', '{{resistances-et-faiblesses|Résistances/Faiblesses magique}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Résistance/Faiblesse Magie|Résistances/Faiblesses magique]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Altérations d''états et Mode Hyper|Altérations d’états]]', '{{alterations-detats-et-mode-hyper|Altérations d’états}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Altérations d''états et Mode Hyper|Altérations d’états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Actions et mouvements|IC ou Action rapide]]', '{{les-actions-et-mouvements|IC ou Action rapide}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Les Actions et mouvements|IC ou Action rapide]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Un maître du Jeu|Maître du jeu, Conseils]]', '{{un-maitre-du-jeu|Maître du jeu, Conseils}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Un maître du Jeu|Maître du jeu, Conseils]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Attaque et Défense|Attaque et défense]]', '{{attaque-et-defense|Attaque et défense}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Attaque et Défense|Attaque et défense]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|La vitesse]]', '{{la-vitesse-et-la-portee|La vitesse}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[La Vitesse et la Portée|La vitesse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Donjon Pas bon|Donjon pas bon]]', '{{donjon-pas-bon|Donjon pas bon}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Donjon Pas bon|Donjon pas bon]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les situations avancées]]', '{{la-prise-en-tenaille-et-zone-dinfluence|Les situations avancées}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Les situations avancées]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Formule des dégâts]]', '{{formule-des-degats}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Formule des dégâts]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Alignement]]', '{{alignement}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Alignement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Postures]]', '{{les-postures|Postures}}') WHERE "id" = 'guide/guide-pour-mj-maverick' AND instr(corps_md, '[[Postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]', '{{attaque-et-defense}}') WHERE "id" = 'guide/initiative' AND instr(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/initiative' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Altérations d''états et Mode Hyper|altérations d''états]]', '{{alterations-detats-et-mode-hyper|altérations d''états}}') WHERE "id" = 'guide/jet-de-des' AND instr(corps_md, '[[Altérations d''états et Mode Hyper|altérations d''états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-maitrise-darme-et-armes|Maîtrise d’arme et Armes]]', '{{fiche-de-personnage-maitrise-darme-et-armes|Maîtrise d’arme et Armes}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/fiche-maitrise-darme-et-armes|Maîtrise d’arme et Armes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-accessoires-et-ceinture|Accessoires et Ceinture]]', '{{fiche-de-personnage-accessoires-et-ceinture|Accessoires et Ceinture}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/fiche-accessoires-et-ceinture|Accessoires et Ceinture]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-armure-defense-bouclier|Armure/Défense/Bouclier]]', '{{fiche-de-personnage-armure-defense-bouclier|Armure/Défense/Bouclier}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/fiche-armure-defense-bouclier|Armure/Défense/Bouclier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]', '{{attaquer-et-se-defendre}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-inventaire-sac-a-dos|Inventaire/Sac à dos]]', '{{fiche-de-personnage-inventaire-sac-a-dos|Inventaire/Sac à dos}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/fiche-inventaire-sac-a-dos|Inventaire/Sac à dos]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[ressources/pieces-elementaires|Pièces élémentaires]]', '{{pieces-elementaires}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[ressources/pieces-elementaires|Pièces élémentaires]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[ressources/pieces-elementaires|pièce élémentaire]]', '{{pieces-elementaires|pièce élémentaire}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[ressources/pieces-elementaires|pièce élémentaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Accessoires](/ressources/equipement/#accessoires)', '{{accessoires}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[Accessoires](/ressources/equipement/#accessoires)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Boucliers](/ressources/equipement/#boucliers)', '{{bouclier|Boucliers}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[Boucliers](/ressources/equipement/#boucliers)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Armures](/ressources/equipement/#armures)', '{{armures}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[Armures](/ressources/equipement/#armures)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/ocultomancien|Ocultomancien]]', '{{ocultomancien}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/ocultomancien|Ocultomancien]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]', '{{le-tour-de-jeu}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[armes](/ressources/equipement/#armes)', '{{armes|armes}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[armes](/ressources/equipement/#armes)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Composants](/ressources/composants/)', '{{composants}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[Composants](/ressources/composants/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Équipement](/ressources/equipement/)', '{{armes|Équipement}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[Équipement](/ressources/equipement/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/flagelleur|Flagelleur]]', '{{flagelleur}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/flagelleur|Flagelleur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/mercenaire|Mercenaire]]', '{{mercenaire}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/mercenaire|Mercenaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/archimage|Archimage]]', '{{archimage}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/archimage|Archimage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/mage-vert|Mage Vert]]', '{{mage-vert}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/mage-vert|Mage Vert]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-degats|Les dégâts]]', '{{les-degats}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[guide/les-degats|Les dégâts]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[les classes](/classes/)', '{{classes|les classes}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[les classes](/classes/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[classes/mage|Mage]]', '{{mage}}') WHERE "id" = 'guide/l-equipement' AND instr(corps_md, '[[classes/mage|Mage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/les-impacts-mineur-et-majeur|les Impacts, majeurs et mineurs]]', '{{les-impacts-mineur-et-majeur|les Impacts, majeurs et mineurs}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/les-impacts-mineur-et-majeur|les Impacts, majeurs et mineurs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Outils Légendaires, Uniques|armes et objets légendaires]]', '{{les-outils-legendaires-uniques|armes et objets légendaires}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Les Outils Légendaires, Uniques|armes et objets légendaires]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Relations entre les races|les relations entre les peuples]]', '{{relations-entre-les-races|les relations entre les peuples}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Relations entre les races|les relations entre les peuples]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/temple-de-lespace-temps|Temple de l’Espace/Temps]]', '{{temple-de-lespace-temps}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/temple-de-lespace-temps|Temple de l’Espace/Temps]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/choisir-ses-magies|la création du personnage]]', '{{etape-2-choisir-ses-magies|la création du personnage}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[guide/choisir-ses-magies|la création du personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temples/Cultes/Guildes|temples, cultes et guildes]]', '{{temples-cultes-guildes|temples, cultes et guildes}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Temples/Cultes/Guildes|temples, cultes et guildes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/creer-son-personnage|Créer son personnage]]', '{{creer-son-personnage}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[guide/creer-son-personnage|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les races non-jouable|races qu’on ne joue pas]]', '{{les-races-non-jouable|races qu’on ne joue pas}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Les races non-jouable|races qu’on ne joue pas]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/situation-actuelle|la situation actuelle]]', '{{situation-actuelle|la situation actuelle}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/situation-actuelle|la situation actuelle]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/origine-du-monde|l’ère des Élémentaires]]', '{{origine-du-monde|l’ère des Élémentaires}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/origine-du-monde|l’ère des Élémentaires]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/ordre-des-abeilles|Ordre des Abeilles]]', '{{ordre-des-abeilles}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/ordre-des-abeilles|Ordre des Abeilles]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/la-main-sanglante|La main sanglante]]', '{{la-main-sanglante}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/la-main-sanglante|La main sanglante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/la-pointe-de-sang|La pointe de sang]]', '{{la-pointe-de-sang}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/la-pointe-de-sang|La pointe de sang]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/republique-noire|République noire]]', '{{republique-noire|République noire}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/republique-noire|République noire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/ruines-rouges|ruines de Noname]]', '{{ruines-rouges|ruines de Noname}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/ruines-rouges|ruines de Noname]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/empire-humain|Empire humain]]', '{{empire-humain|Empire humain}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/empire-humain|Empire humain]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/ordre-du-brai|Ordre du brai]]', '{{ordre-du-brai}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/ordre-du-brai|Ordre du brai]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Civilisations|civilisations]]', '{{les-civilisations|civilisations}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Les Civilisations|civilisations]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/terre-grise|la Terre grise]]', '{{terre-grise|la Terre grise}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/terre-grise|la Terre grise]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/marais-vert|Marais vert]]', '{{marais-vert}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/marais-vert|Marais vert]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/lame-seuil|Lame-Seuil]]', '{{lame-seuil}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/lame-seuil|Lame-Seuil]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[races/humain|des humains]]', '{{humain|des humains}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[races/humain|des humains]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[carte des magies](/magies/)', '{{magies|carte des magies}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[carte des magies](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[chronologie](/chronologie/)', '{{chronologie|chronologie}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[chronologie](/chronologie/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Divinités|divinités]]', '{{les-divinites|divinités}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Les Divinités|divinités]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[bestiaire](/bestiaire/)', '{{bestiaire|bestiaire}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[bestiaire](/bestiaire/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Glossaire|glossaire]]', '{{glossaire|glossaire}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Glossaire|glossaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/erisia|Erisia]]', '{{erisia}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/erisia|Erisia]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/mirada|Mirada]]', '{{mirada}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/mirada|Mirada]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[lore/mrode|Mrode]]', '{{mrode}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[lore/mrode|Mrode]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[classes](/classes/)', '{{classes|classes}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[classes](/classes/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[magies](/magies/)', '{{magies|magies}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[magies](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[races](/races/)', '{{races|races}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[races](/races/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Codex]]', '{{codex|Codex}}') WHERE "id" = 'guide/l-univers' AND instr(corps_md, '[[Codex]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[capacites/mage-rouge-double-coup|Double coup du Mage Rouge]]', '{{double-coup-mage-rouge|Double coup du Mage Rouge}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[capacites/mage-rouge-double-coup|Double coup du Mage Rouge]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]', '{{resistances-et-faiblesses}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Bâtons magiques](/ressources/equipement/#batons-magiques)', '{{baton-magique|Bâtons magiques}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[Bâtons magiques](/ressources/equipement/#batons-magiques)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/rater-ses-sortileges|Rater ses sortilèges]]', '{{rater-ses-sortileges}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/rater-ses-sortileges|Rater ses sortilèges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[ressources/livre-parchemin|Livres et parchemins]]', '{{livre-parchemin|Livres et parchemins}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[ressources/livre-parchemin|Livres et parchemins]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]', '{{la-montee-de-niveau}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[capacites/mage-rouge-preparation|Préparation]]', '{{preparation-mage-rouge|Préparation}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[capacites/mage-rouge-preparation|Préparation]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[capacites/mage-vert-double-coup|du Mage Vert]]', '{{double-coup-mage-vert|du Mage Vert}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[capacites/mage-vert-double-coup|du Mage Vert]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/blessures-et-etats|Blessures et états]]', '{{blessure-et-mort|Blessures et états}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/blessures-et-etats|Blessures et états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[capacites/mage-vert-chargement|Chargement]]', '{{chargement-mage-vert|Chargement}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[capacites/mage-vert-chargement|Chargement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/premiers-sorts|Créer son personnage]]', '{{etape-5-choisir-ses-premiers-sorts|Créer son personnage}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/premiers-sorts|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]', '{{le-tour-de-jeu}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]', '{{le-mode-hyper}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[bestiaire](/bestiaire/)', '{{bestiaire|bestiaire}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[bestiaire](/bestiaire/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[les magies](/magies/)', '{{magies|les magies}}') WHERE "id" = 'guide/la-magie-en-jeu' AND instr(corps_md, '[les magies](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-experience-niveau-global|Fiche de personnage : Expérience/Niveau global]]', '{{fiche-de-personnage-experience-niveau-global}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/fiche-experience-niveau-global|Fiche de personnage : Expérience/Niveau global]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]', '{{sentrainer|S’entraîner et exercer un métier}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/caracteristiques-et-competences|Créer son personnage]]', '{{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/caracteristiques-et-competences|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]]', '{{le-mode-hyper|Le Mode Hyper et le Mode Super}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper et le Mode Super]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/choisir-sa-classe|Créer son personnage]]', '{{etape-3-choisir-sa-classe|Créer son personnage}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/choisir-sa-classe|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]', '{{la-magie-en-jeu}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[classe](/classes/)', '{{classes|classe}}') WHERE "id" = 'guide/la-montee-de-niveau' AND instr(corps_md, '[classe](/classes/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[accessoires](/ressources/equipement/#accessoires)', '{{accessoires|accessoires}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[accessoires](/ressources/equipement/#accessoires)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/blessures-et-etats|Blessures et états]]', '{{blessure-et-mort|Blessures et états}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[[guide/blessures-et-etats|Blessures et états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]', '{{le-tour-de-jeu}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/meteo|Météo]]', '{{meteo}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[[guide/meteo|Météo]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[magie](/magies/)', '{{magies|magie}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[magie](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[race](/races/)', '{{races|race}}') WHERE "id" = 'guide/le-mode-hyper' AND instr(corps_md, '[race](/races/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/le-mode-hyper-100' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/actions-et-mouvements|Les actions et mouvements]]', '{{les-actions-et-mouvements|Les actions et mouvements}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/actions-et-mouvements|Les actions et mouvements]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]', '{{attaquer-et-se-defendre}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/guide-pour-mj-maverick|Guide pour MJ - Maverick]]', '{{guide-pour-mj-maverick}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/guide-pour-mj-maverick|Guide pour MJ - Maverick]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/finaliser-son-personnage|Créer son personnage]]', '{{etape-6-finaliser-son-personnage|Créer son personnage}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/finaliser-son-personnage|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/vitesse-et-portee|La vitesse et la portée]]', '{{la-vitesse-et-la-portee|La vitesse et la portée}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/vitesse-et-portee|La vitesse et la portée]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/alterations-d-etats|Blessures et états]]', '{{alterations-detats|Blessures et états}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/alterations-d-etats|Blessures et états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L’équipement]]', '{{lequipement}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/l-equipement|L’équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/le-tour-de-jeu' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|la portée]]', '{{la-vitesse-et-la-portee|la portée}}') WHERE "id" = 'guide/les-attaques-d-opportunite' AND instr(corps_md, '[[La Vitesse et la Portée|la portée]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]', '{{resistances-et-faiblesses}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/resistances-et-faiblesses|Résistances et faiblesses]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]', '{{attaquer-et-se-defendre}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]', '{{guide-pour-mj-maverick|Doc « Guide pour MJ »}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/blessures-et-etats|Blessures et états]]', '{{blessure-et-mort|Blessures et états}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/blessures-et-etats|Blessures et états]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/formule-des-degats|Formule des dégâts]]', '{{formule-des-degats}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/formule-des-degats|Formule des dégâts]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Matériaux](/ressources/composants/#materiaux)', '{{composants|Matériaux}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[Matériaux](/ressources/composants/#materiaux)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Armures](/ressources/equipement/#armures)', '{{armures}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[Armures](/ressources/equipement/#armures)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]', '{{le-mode-hyper}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L’équipement]]', '{{lequipement}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/l-equipement|L’équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/les-degats' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]', '{{guide-pour-mj-maverick|Doc « Guide pour MJ »}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/guide-pour-mj-maverick|Doc « Guide pour MJ »]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/fiche-tableau-posture|Tableau Posture]]', '{{fiche-de-personnage-tableau-posture|Tableau Posture}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/fiche-tableau-posture|Tableau Posture]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]', '{{la-magie-en-jeu}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]', '{{le-tour-de-jeu}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/le-tour-de-jeu|Le tour de jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]', '{{le-mode-hyper}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-embuscade|L''embuscade]]', '{{lembuscade|L''embuscade}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/l-embuscade|L''embuscade]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-degats|Les dégâts]]', '{{les-degats}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[[guide/les-degats|Les dégâts]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/les-postures' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]', '{{la-montee-de-niveau}}') WHERE "id" = 'guide/premiers-sorts' AND instr(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[magie](/magies/)', '{{magies|magie}}') WHERE "id" = 'guide/premiers-sorts' AND instr(corps_md, '[magie](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-attaques-d-opportunite|Les attaques d''opportunité]]', '{{les-attaques-dopportunite}}') WHERE "id" = 'guide/prise-en-tenaille-et-zone-d-influence' AND instr(corps_md, '[[guide/les-attaques-d-opportunite|Les attaques d''opportunité]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[Relations entre magies](/magies/#relations)', '{{magies|Relations entre magies}}') WHERE "id" = 'guide/resistances-et-faiblesses' AND instr(corps_md, '[Relations entre magies](/magies/#relations)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]', '{{le-mode-hyper}}') WHERE "id" = 'guide/resistances-et-faiblesses' AND instr(corps_md, '[[guide/le-mode-hyper|Le Mode Hyper]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/l-equipement|L’équipement]]', '{{lequipement}}') WHERE "id" = 'guide/resistances-et-faiblesses' AND instr(corps_md, '[[guide/l-equipement|L’équipement]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/resistances-et-faiblesses' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[magie](/magies/)', '{{magies|magie}}') WHERE "id" = 'guide/resistances-et-faiblesses' AND instr(corps_md, '[magie](/magies/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]', '{{sentrainer|S’entraîner et exercer un métier}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/s-entrainer-et-exercer-un-metier|S’entraîner et exercer un métier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/caracteristiques-et-competences|Créer son personnage]]', '{{etape-4-repartir-caracteristiques-et-competences|Créer son personnage}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/caracteristiques-et-competences|Créer son personnage]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]', '{{attaquer-et-se-defendre}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/attaquer-et-se-defendre|Attaquer et se défendre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]', '{{la-montee-de-niveau}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/la-montee-de-niveau|La montée de niveau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]', '{{attaque-et-defense}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/attaque-et-defense|Attaque et Défense]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/jet-de-des|Jet de dés]]', '{{jet-de-des}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/jet-de-des|Jet de dés]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-portes|Les portes]]', '{{les-portes}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[[guide/les-portes|Les portes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/reussir-une-action' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/reussites-echecs-et-critiques' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/les-postures|Les postures]]', '{{les-postures}}') WHERE "id" = 'guide/reussites-echecs-et-critiques' AND instr(corps_md, '[[guide/les-postures|Les postures]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/reussir-une-action|Réussir une action]]', '{{reussir-une-action}}') WHERE "id" = 'guide/s-entrainer-et-exercer-un-metier' AND instr(corps_md, '[[guide/reussir-une-action|Réussir une action]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]', '{{la-magie-en-jeu}}') WHERE "id" = 'guide/s-entrainer-et-exercer-un-metier' AND instr(corps_md, '[[guide/la-magie-en-jeu|La magie en jeu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[fiche de personnage](/fiche/)', '{{fiche-de-personnage|fiche de personnage}}') WHERE "id" = 'guide/s-entrainer-et-exercer-un-metier' AND instr(corps_md, '[fiche de personnage](/fiche/)') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Confrérie des Brandes Sacrilèges]]', '{{la-confrerie-des-brandes-sacrileges}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[La Confrérie des Brandes Sacrilèges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Outils Légendaires, Uniques]]', '{{les-outils-legendaires-uniques}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Outils Légendaires, Uniques]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bardiche du Bourreau déchiré]]', '{{bardiche-du-bourreau-dechire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Bardiche du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Belladones Fleurissantes]]', '{{les-belladones-fleurissantes}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Belladones Fleurissantes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Impacts mineur et majeur]]', '{{les-impacts-mineur-et-majeur}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Impacts mineur et majeur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Hache du Bourreau déchiré]]', '{{hache-du-bourreau-dechire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Hache du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Lance du Bourreau déchiré]]', '{{lance-du-bourreau-dechire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Lance du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Espace/Temps]]', '{{temple-de-lespace-temps}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de l’Espace/Temps]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bâton de la destruction]]', '{{baton-de-la-destruction}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Bâton de la destruction]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Jardiniers Mycillis]]', '{{les-jardiniers-mycillis}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Jardiniers Mycillis]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de la Glace Rouge]]', '{{ordre-de-la-glace-rouge}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre de la Glace Rouge]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Guérisseurs silencieux]]', '{{guerisseurs-silencieux}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Guérisseurs silencieux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Médecin sans frontière]]', '{{medecin-sans-frontiere}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Médecin sans frontière]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temples/Cultes/Guildes]]', '{{temples-cultes-guildes}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temples/Cultes/Guildes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Compagnie du Fer Noir]]', '{{compagnie-du-fer-noir}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Compagnie du Fer Noir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les races non-jouable]]', '{{les-races-non-jouable}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les races non-jouable]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Académie de l’arcane]]', '{{academie-de-larcane}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Académie de l’arcane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[République Forestier]]', '{{republique-forestier}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[République Forestier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Lumière]]', '{{temple-de-la-lumiere}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de la Lumière]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Vampires primordiaux]]', '{{vampires-primordiaux}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Vampires primordiaux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Foudre]]', '{{temple-de-la-foudre}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de la Foudre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Foudre étincelante]]', '{{foudre-etincelante}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Foudre étincelante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[L’Ordre de l’acier]]', '{{lordre-de-lacier}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[L’Ordre de l’acier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Flammes Bleues]]', '{{les-flammes-bleues}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Flammes Bleues]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de Gardecroc]]', '{{ordre-de-gardecroc}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre de Gardecroc]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre des Abeilles]]', '{{ordre-des-abeilles}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre des Abeilles]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Situation actuelle]]', '{{situation-actuelle}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Situation actuelle]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Glace]]', '{{temple-de-la-glace}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de la Glace]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Terre]]', '{{temple-de-la-terre}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de la Terre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bois du printemps]]', '{{bois-du-printemps}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Bois du printemps]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Confrérie du Sang]]', '{{confrerie-du-sang}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Confrérie du Sang]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La main sanglante]]', '{{la-main-sanglante}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[La main sanglante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La pointe de sang]]', '{{la-pointe-de-sang}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[La pointe de sang]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Civilisations]]', '{{les-civilisations}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Civilisations]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Signe des pirates]]', '{{signe-des-pirates}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Signe des pirates]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Ombre]]', '{{temple-de-lombre}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de l’Ombre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Collines humides]]', '{{collines-humides}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Collines humides]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de la mort]]', '{{ordre-de-la-mort}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre de la mort]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Origine du monde]]', '{{origine-du-monde}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Origine du monde]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plaine brillante]]', '{{plaine-brillante}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Plaine brillante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plateau Tonnerre]]', '{{plateau-tonnerre}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Plateau Tonnerre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[République Noire]]', '{{republique-noire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[République Noire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple du Savoir]]', '{{temple-du-savoir}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple du Savoir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Barrage Argenté]]', '{{barrage-argente}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Barrage Argenté]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Chapelle des Os]]', '{{chapelle-des-os}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Chapelle des Os]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Forêt colossale]]', '{{foret-colossale}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Forêt colossale]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Guérisseurs]]', '{{les-guerisseurs}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Guérisseurs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Eau]]', '{{temple-de-leau}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de l’Eau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tisseurs de soi]]', '{{tisseurs-de-soi}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Tisseurs de soi]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Croc du Volcan]]', '{{croc-du-volcan}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Croc du Volcan]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Empire Argenté]]', '{{empire-argente}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Empire Argenté]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Forêt de l’été]]', '{{foret-de-lete}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Forêt de l’été]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les embaumeurs]]', '{{les-embaumeurs}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les embaumeurs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Marais fangeux]]', '{{marais-fangeux}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Marais fangeux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Monts Couloirs]]', '{{monts-couloirs}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Monts Couloirs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plaines sèches]]', '{{plaines-seches}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Plaines sèches]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de Vent]]', '{{temple-de-vent}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple de Vent]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Église du Sel]]', '{{eglise-du-sel}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Église du Sel]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Empire Humain]]', '{{empire-humain}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Empire Humain]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Divinités]]', '{{les-divinites}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Divinités]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre du brai]]', '{{ordre-du-brai}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre du brai]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre Solaire]]', '{{ordre-solaire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ordre Solaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ruines Rouges]]', '{{ruines-rouges}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ruines Rouges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple du Feu]]', '{{temple-du-feu}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple du Feu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Cloche d’or]]', '{{cloche-dor}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Cloche d’or]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Exaltés]]', '{{les-exaltes}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Les Exaltés]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Marais vert]]', '{{marais-vert}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Marais vert]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mont cendré]]', '{{mont-cendre}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Mont cendré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Super Gemme]]', '{{super-gemme}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Super Gemme]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple noir]]', '{{temple-noir}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Temple noir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Terre grise]]', '{{terre-grise}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Terre grise]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Lame-Seuil]]', '{{lame-seuil}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Lame-Seuil]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Selcalibur]]', '{{selcalibur}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Selcalibur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Soir-matin]]', '{{soir-matin}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Soir-matin]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ville-Oeil]]', '{{ville-oeil}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Ville-Oeil]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Champicer]]', '{{champicer}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Champicer]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Evravonie]]', '{{evravonie}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Evravonie]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Excalibur]]', '{{excalibur}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Excalibur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Glossaire]]', '{{glossaire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Glossaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Champieu]]', '{{champieu}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Champieu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dombourg]]', '{{dombourg}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Dombourg]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Eaunoire]]', '{{eaunoire}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Eaunoire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Londolor]]', '{{londolor}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Londolor]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Saugnane]]', '{{saugnane}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Saugnane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Séraphin]]', '{{seraphin}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Séraphin]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Balogne]]', '{{balogne}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Balogne]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Celsius]]', '{{celsius}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Celsius]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dimitri]]', '{{dimitri}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Dimitri]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Drassah]]', '{{drassah}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Drassah]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Séraphe]]', '{{seraphe}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Séraphe]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Xendown]]', '{{xendown}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Xendown]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Aurora]]', '{{aurora}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Aurora]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Camnau]]', '{{camnau}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Camnau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dragon]]', '{{dragon}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Dragon]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Éoline]]', '{{eoline}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Éoline]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Épisir]]', '{{episir}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Épisir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Erisia]]', '{{erisia}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Erisia]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Grelon]]', '{{grelon}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Grelon]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mirada]]', '{{mirada}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Mirada]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Morfot]]', '{{morfot}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Morfot]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Océane]]', '{{oceane}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Océane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tofrom]]', '{{tofrom}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Tofrom]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tounne]]', '{{tounne}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Tounne]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Brock]]', '{{brock}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Brock]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Capse]]', '{{capse}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Capse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Eirnn]]', '{{eirnn}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Eirnn]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mrode]]', '{{mrode}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Mrode]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Notix]]', '{{notix}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Notix]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Umbro]]', '{{umbro}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Umbro]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Anna]]', '{{anna}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Anna]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bauc]]', '{{bauc}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Bauc]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mora]]', '{{mora}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Mora]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Onir]]', '{{onir}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Onir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Volt]]', '{{volt}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[Volt]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[400]]', '{{400}}') WHERE "id" = 'lore/codex' AND instr(corps_md, '[[400]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Cloche d’or]]', '{{cloche-dor}}') WHERE "id" = 'lore/empire-humain' AND instr(corps_md, '[[Cloche d’or]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Champieu]]', '{{champieu}}') WHERE "id" = 'lore/empire-humain' AND instr(corps_md, '[[Champieu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dombourg]]', '{{dombourg}}') WHERE "id" = 'lore/empire-humain' AND instr(corps_md, '[[Dombourg]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Xendown]]', '{{xendown}}') WHERE "id" = 'lore/empire-humain' AND instr(corps_md, '[[Xendown]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[République Forestier]]', '{{republique-forestier}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[République Forestier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Signe des pirates]]', '{{signe-des-pirates}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Signe des pirates]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plateau Tonnerre]]', '{{plateau-tonnerre}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Plateau Tonnerre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[République Noire]]', '{{republique-noire}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[République Noire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Barrage Argenté]]', '{{barrage-argente}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Barrage Argenté]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Empire Argenté]]', '{{empire-argente}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Empire Argenté]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Empire Humain]]', '{{empire-humain}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Empire Humain]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ruines Rouges]]', '{{ruines-rouges}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Ruines Rouges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Cloche d’or]]', '{{cloche-dor}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Cloche d’or]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Marais vert]]', '{{marais-vert}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Marais vert]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Champieu]]', '{{champieu}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Champieu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dombourg]]', '{{dombourg}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Dombourg]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Londolor]]', '{{londolor}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Londolor]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Xendown]]', '{{xendown}}') WHERE "id" = 'lore/erisia' AND instr(corps_md, '[[Xendown]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Erisia]]', '{{erisia}}') WHERE "id" = 'lore/les-civilisations' AND instr(corps_md, '[[Erisia]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mrode]]', '{{mrode}}') WHERE "id" = 'lore/les-civilisations' AND instr(corps_md, '[[Mrode]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Evravonie]]', '{{evravonie}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Evravonie]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Eaunoire]]', '{{eaunoire}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Eaunoire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Séraphin]]', '{{seraphin}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Séraphin]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Celsius]]', '{{celsius}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Celsius]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dimitri]]', '{{dimitri}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Dimitri]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Drassah]]', '{{drassah}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Drassah]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Séraphe]]', '{{seraphe}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Séraphe]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Aurora]]', '{{aurora}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Aurora]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Éoline]]', '{{eoline}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Éoline]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mirada]]', '{{mirada}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Mirada]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Morfot]]', '{{morfot}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Morfot]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Océane]]', '{{oceane}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Océane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tofrom]]', '{{tofrom}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Tofrom]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Brock]]', '{{brock}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Brock]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Capse]]', '{{capse}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Capse]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Eirnn]]', '{{eirnn}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Eirnn]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Notix]]', '{{notix}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Notix]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Umbro]]', '{{umbro}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Umbro]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Anna]]', '{{anna}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Anna]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bauc]]', '{{bauc}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Bauc]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mora]]', '{{mora}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Mora]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Onir]]', '{{onir}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Onir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Volt]]', '{{volt}}') WHERE "id" = 'lore/les-divinites' AND instr(corps_md, '[[Volt]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bardiche du Bourreau déchiré]]', '{{bardiche-du-bourreau-dechire}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Bardiche du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Hache du Bourreau déchiré]]', '{{hache-du-bourreau-dechire}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Hache du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Lance du Bourreau déchiré]]', '{{lance-du-bourreau-dechire}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Lance du Bourreau déchiré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bâton de la destruction]]', '{{baton-de-la-destruction}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Bâton de la destruction]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Foudre étincelante]]', '{{foudre-etincelante}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Foudre étincelante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Guérisseurs]]', '{{les-guerisseurs}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Les Guérisseurs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Croc du Volcan]]', '{{croc-du-volcan}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Croc du Volcan]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Super Gemme]]', '{{super-gemme}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Super Gemme]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Lame-Seuil]]', '{{lame-seuil}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Lame-Seuil]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Selcalibur]]', '{{selcalibur}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Selcalibur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Soir-matin]]', '{{soir-matin}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Soir-matin]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Champicer]]', '{{champicer}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Champicer]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Excalibur]]', '{{excalibur}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[Excalibur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[400]]', '{{400}}') WHERE "id" = 'lore/les-outils-legendaires-uniques' AND instr(corps_md, '[[400]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Vampires primordiaux]]', '{{vampires-primordiaux}}') WHERE "id" = 'lore/les-races-non-jouable' AND instr(corps_md, '[[Vampires primordiaux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Dragon]]', '{{dragon}}') WHERE "id" = 'lore/les-races-non-jouable' AND instr(corps_md, '[[Dragon]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de Vent|Temple du Vent]]', '{{temple-de-vent|Temple du Vent}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Temple de Vent|Temple du Vent]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Terre]]', '{{temple-de-la-terre}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Temple de la Terre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Bois du printemps]]', '{{bois-du-printemps}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Bois du printemps]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Collines humides]]', '{{collines-humides}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Collines humides]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plaine brillante]]', '{{plaine-brillante}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Plaine brillante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Forêt colossale]]', '{{foret-colossale}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Forêt colossale]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Forêt de l’été]]', '{{foret-de-lete}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Forêt de l’été]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Marais fangeux]]', '{{marais-fangeux}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Marais fangeux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Monts Couloirs]]', '{{monts-couloirs}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Monts Couloirs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Plaines sèches]]', '{{plaines-seches}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Plaines sèches]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mont cendré]]', '{{mont-cendre}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Mont cendré]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Terre grise]]', '{{terre-grise}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Terre grise]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ville-Oeil]]', '{{ville-oeil}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Ville-Oeil]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Saugnane]]', '{{saugnane}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Saugnane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Balogne]]', '{{balogne}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Balogne]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Camnau]]', '{{camnau}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Camnau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Épisir]]', '{{episir}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Épisir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Grelon]]', '{{grelon}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Grelon]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tounne]]', '{{tounne}}') WHERE "id" = 'lore/mrode' AND instr(corps_md, '[[Tounne]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Confrérie des Brandes Sacrilèges]]', '{{la-confrerie-des-brandes-sacrileges}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[La Confrérie des Brandes Sacrilèges]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Belladones Fleurissantes]]', '{{les-belladones-fleurissantes}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Les Belladones Fleurissantes]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Espace/Temps]]', '{{temple-de-lespace-temps}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de l’Espace/Temps]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Jardiniers Mycillis]]', '{{les-jardiniers-mycillis}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Les Jardiniers Mycillis]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de la Glace Rouge]]', '{{ordre-de-la-glace-rouge}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre de la Glace Rouge]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Guérisseurs silencieux]]', '{{guerisseurs-silencieux}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Guérisseurs silencieux]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Médecin sans frontière]]', '{{medecin-sans-frontiere}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Médecin sans frontière]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Compagnie du Fer Noir]]', '{{compagnie-du-fer-noir}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Compagnie du Fer Noir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Académie de l’arcane]]', '{{academie-de-larcane}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Académie de l’arcane]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Lumière]]', '{{temple-de-la-lumiere}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de la Lumière]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Foudre]]', '{{temple-de-la-foudre}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de la Foudre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[L’Ordre de l’acier]]', '{{lordre-de-lacier}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[L’Ordre de l’acier]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Flammes Bleues]]', '{{les-flammes-bleues}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Les Flammes Bleues]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de Gardecroc]]', '{{ordre-de-gardecroc}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre de Gardecroc]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre des Abeilles]]', '{{ordre-des-abeilles}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre des Abeilles]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Glace]]', '{{temple-de-la-glace}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de la Glace]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de la Terre]]', '{{temple-de-la-terre}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de la Terre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Confrérie du Sang]]', '{{confrerie-du-sang}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Confrérie du Sang]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La main sanglante]]', '{{la-main-sanglante}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[La main sanglante]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La pointe de sang]]', '{{la-pointe-de-sang}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[La pointe de sang]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Ombre]]', '{{temple-de-lombre}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de l’Ombre]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre de la mort]]', '{{ordre-de-la-mort}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre de la mort]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple du Savoir]]', '{{temple-du-savoir}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple du Savoir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Chapelle des Os]]', '{{chapelle-des-os}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Chapelle des Os]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de l’Eau]]', '{{temple-de-leau}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de l’Eau]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Tisseurs de soi]]', '{{tisseurs-de-soi}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Tisseurs de soi]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les embaumeurs]]', '{{les-embaumeurs}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Les embaumeurs]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple de Vent]]', '{{temple-de-vent}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple de Vent]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Église du Sel]]', '{{eglise-du-sel}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Église du Sel]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre du brai]]', '{{ordre-du-brai}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre du brai]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Ordre Solaire]]', '{{ordre-solaire}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Ordre Solaire]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple du Feu]]', '{{temple-du-feu}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple du Feu]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Les Exaltés]]', '{{les-exaltes}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Les Exaltés]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Temple noir]]', '{{temple-noir}}') WHERE "id" = 'lore/temples-cultes-guildes' AND instr(corps_md, '[[Temple noir]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Alchimie primitive|alchimie primitive]]', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/alchimiste' AND instr(corps_md, '[[Alchimie primitive|alchimie primitive]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Alchimie primitive|alchimie primitive]]', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/apothicaire' AND instr(corps_md, '[[Alchimie primitive|alchimie primitive]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[Mineur]]', '{{mineur}}') WHERE "id" = 'metiers/regles-des-metiers' AND instr(corps_md, '[[Mineur]]') > 0;
UPDATE page SET corps_md = replace(corps_md, '[[La Vitesse et la Portée|la vitesse]]', '{{la-vitesse-et-la-portee|la vitesse}}') WHERE "id" = 'ressources/fiole-rose' AND instr(corps_md, '[[La Vitesse et la Portée|la vitesse]]') > 0;
UPDATE metier SET artisanat_texte = replace(artisanat_texte, 'alchimie primitive', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/alchimiste' AND instr(artisanat_texte, 'alchimie primitive') > 0;
UPDATE metier SET artisanat_brut = replace(artisanat_brut, 'alchimie primitive', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/alchimiste' AND instr(artisanat_brut, 'alchimie primitive') > 0;
UPDATE metier SET artisanat_texte = replace(artisanat_texte, 'alchimie primitive', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/apothicaire' AND instr(artisanat_texte, 'alchimie primitive') > 0;
UPDATE metier SET artisanat_brut = replace(artisanat_brut, 'alchimie primitive', '{{alchimie-primitive|alchimie primitive}}') WHERE "id" = 'metiers/apothicaire' AND instr(artisanat_brut, 'alchimie primitive') > 0;
