-- Migration 0119 : races Fongoïde et Gémidien (lot 4 « Races » de la mise à jour de Décembre) : décisions R239, R256 ; Modes Hyper changés (R237 (12)).
-- Source : la pièce jointe du propriétaire « Nouveauté mise à jour Décembre.xlsx » (instantané sources/raw/classeurs/magie-maverick-v10.json), onglets
-- 21 « Fongoïde » et 22 « Gémidien », cités « Nouveauté mise à jour Décembre › <onglet> › <case> » ; le docx de la même mise à jour pour les deux Modes Hyper changés ;
-- R237 (12) : pas de lecture des originaux Google. Textes copiés tels qu'écrits (fautes comprises), sous la forme que la base enregistre
-- (lib/corps-races.mjs#valeurCanonique : paragraphes séparés par une ligne vide, sans espace en fin de ligne).
-- Générée par un script du lot (hors dépôt) depuis le plan de tech-sources (plan-races.json) et la base à la version 118 ; corps des pages par
-- lib/corps-races.mjs (corpsDeRaceCreee pour les deux races : aucune section de la fiche V15.2.2, qui ne les a pas ; corpsDeRace pour les deux Modes Hyper).
-- Registre : 0119-races-fongoide-gemidien.json (ids créés, textes réécrits).
--   - R239 (1) : deux races pures, races/fongoide et races/gemidien (29 races) ; race.ordre et race.rang_liste à la fin des races pures, les suivantes
--     reculent de deux (ORDRE_DES_RACES de lib/race-kinds.mjs suit). Colonnes de la fiche V15.2.2 de race à NULL (la fiche n'a pas ces races).
--   - R13 : race_onglet (A4, AK3, AK30, H13, U13, AG13, H16, H19), don de race (A27, H27, forme « unique »), Mode Hyper (A32, H32, version onglet_race,
--     rang 28 et 29 : après les 27 races de l'index du classeur « Les races »). Ni restriction de caractéristique, ni AP/AM, ni « Divers » (rien n'est écrit).
--   - R239 (2) : don de base des races pures (« Méditation (Action 3 fois/jour) », 3d6 + 6 chakra), copié de leur race_onglet.don_base, pas H22.
--   - R256 : vitesse 4 au sol et 4 à la nage.
--   - R239 (3) : une ethnie chacune (« Fongoïde », « Gémidien »), sans don d'ethnie (ethnie.descriptif NULL) ;
--     race_don.ethnie_id NULL : c'est la sous-race de la fiche V15.2.2, qui n'a pas ces races (un don « unique » vaut pour toute la race).
--   - Magies innées (race_magie) : Fongoïde 14 (tableau A52:W65, sans le Potentiel Illimité ; R14, R22 ; la Corruption innée reste mono-magie, R15) ;
--     Gémidien mono-magie (race.mono_magie = 1, R28), 13 (ni Potentiel Illimité ni Corruption, H19). Pas de race_magie_onglet.
--   - R239 (4) : race_classe comme les races pures (les 26 classes générales, Archimage compris comme pour les autres pures, R23 restant appliquée par
--     classe.magie_innee_id ; aucune classe raciale) ; Fongoïde × Barde et × Parleur fermées (H19).
--   - Absents : relations entre peuples (aucun peuple), race.presentation, matrices de la fiche V15.2.2.
--   - Mot-clé de chaque race (demande de game-design, lot 4), sur le modèle des mots-clés des races pures : libellé = nom de la race, adresse
--     /races/<slug>/, couleur race:pure, catégorie « Race » ; ids 408 et 409 (les suivants : serveur/edition-mots-cles.mjs#idSuivant) ; verrou 0
--     (R219 (5) : « Un mot-clé créé plus tard n'est pas verrouillé, même pour une nouvelle race »).
--   - Modes Hyper (R237 (12), version onglet_race qui prime, R13) : Elfe argenté « Sang argenté », Felfe « Surpuissance magique » (1d au lieu de 2d) ;
--     les versions classeur_modes et fiche restent les traces de leurs sources.

-- 1. Places des deux races à la fin des races pures : race.ordre (après le Mort-vivant, 12) et race.rang_liste (après le Mort-vivant, 13) ;
--    les races suivantes reculent de deux places (deux temps : race.ordre est UNIQUE).
UPDATE race SET ordre = ordre + 1000 WHERE ordre >= 13;
UPDATE race SET ordre = ordre - 998 WHERE ordre >= 1000;
UPDATE race SET rang_liste = rang_liste + 2 WHERE rang_liste >= 14;

-- 2. Fongoïde (onglet 21 « Fongoïde » de la pièce jointe ; titre N1 « FONGOÏDE »)
INSERT INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) VALUES ('ref:nouveaute-mise-a-jour-decembre-onglet-fongoide', 'libelle', 'Nouveauté mise à jour Décembre, onglet « Fongoïde »', NULL, NULL, NULL, NULL, NULL);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('races/fongoide', 'races', 'fongoide', 'Fongoïde', 'fongoide', NULL, '{"magies_innees": ["Sang", "Arcane", "Corruption", "Espace/Temps", "Vide", "Nécromancie", "Feu", "Eau", "Glace", "Terre", "Vent", "Foudre", "Lumière", "Ombre"]}', '## Présentation

Une race entièrement fait de champignons dont l''origine remonte le jour où le Dieu de la Terre s''est donné la mort.

Ils ont une forme humanoïde car avec le temps, ils sont adaptés aux autres races intelligente et ont pris cette forme car plus pratique ? moins intimidante ? Personne ne le sait.

Selon la lignée première, cette race est apparu sous la forme humanoïde la première fois en l''an 80.

## Histoire

L''origine des Fongoïdes remonte à une époque aujourd''hui révolue : l''époque du Premier Champignon.

À cette époque, la Mort Fertile apparut dans la Forêt Colossale. Ce lieu, profondément marqué par l''énergie de la Terre, permit à un champignon qui passait par là d''assimilé une quantité folle d''énergie divine.

Le Premier Champignon fut le premier de son genre à développer une conscience dépassant celle d''un simple organisme. Sa croissance au sein de la Mort Fertile lui permit progressivement d''assimiler son énergie et de développer une intelligence collective.

Cette évolution attira l''attention de plusieurs dieux. Intrigués par cette forme de vie qui semble commencer à naître mais semble manquer de beaucoup de choses pour pouvoir évolué, certains dieux décidèrent d''intervenir en donnant au Premier plusieurs capacités. On ne connait pas les dieux qui ont influencés directement mais dans tout les cas, ça a fonctionné.

Les premières colonies commencèrent alors à développer des formes de plus en plus complexes. Au fil des générations, elles s''adaptèrent à leur environnement et aux autres peuples qu''elles côtoyaient. Leur corps finit progressivement par adopter une forme humanoïde.

La Mort Fertile n''existe cependant plus. Les Fongoïdes modernes ne dépendent donc pas de ce lieu pour exister : la Mort Fertile est leur berceau, pas leur habitat obligatoire.

Les Fongoïdes se reproduisent par spores. Une nouvelle génération commence son existence sous une forme primitive avant de se développer progressivement au sein même d''un autre fongoïde, une fois assez développé, ce dernier va l''enterrer dans un sol assez fertile et ainsi naîtra un ou plusieurs nouveaux fongoïdes qui auront une magie selon la ou les magie(s) dominante de l''environnement. Leur croissance est donc différente de celle des races humanoïdes classiques : un Fongoïde ne naît pas véritablement, il pousse.

Avec le temps, ils développèrent une conscience individuelle tout en conservant l''héritage de leur nature collective.

Les Fongoïdes sont incapables de communiquer par la parole. Ils possèdent néanmoins une forme de communication mentale leur permettant d''échanger directement avec les autres êtres vivants.

Choses assez singulière mais ils ont développé culturellement une manière de parler à eux : Ils ne disent pas "Quel age avez vous ?", ils disent "Depuis combien de saisons poussez vous ?" mais il possède un sens du deuil très fort, avec des rites funéraires qui varie selon leur magie innée.

## Description

Les Fongoïdes possèdent une silhouette humanoïde recouverte de caractéristiques fongiques. Avec une taille variable entre 1m50 et 1m80.

Ils n''ont pas de genre masculin ou féminin, ce concept est absent chez eux vu que leur reproduction ne repose pas sur deux individus.

Leur corps est fait de chair, de tissus fongiques et de différentes structures rappelant les champignons. Leur apparence varie fortement selon leur environnement et leur magie.

Leur couleur est notamment déterminée par la magie dominante assimilée durant leur croissance. Deux Fongoïdes issus de régions différentes peuvent ainsi présenter des couleurs et des caractéristiques radicalement différentes. Très influencé par la magie même dans la psyché, ils peuvent faire prevue d''hostilité envers ceux qui porte des magies opposés ou efficace contre eux.

Leur apparence humanoïde est le résultat de leur longue évolution. Leurs ancêtres ont progressivement adopté cette forme en s''adaptant aux créatures humanoïdes avec lesquelles ils entraient en contact. Ce cumule de connaissance fait qu''ils sont parfaitement capable d''utiliser des armes et leur magie comme les autres.

Ils possèdent des organes permettant une apparence proche de celle des autres races, mais leur nature fongique reste évidente : leur peau, leur tête, leurs excroissances et leur morphologie peuvent présenter différentes formes de chapeaux, de filaments, de spores ou de structures propres aux champignons. Ils possède deux jambes, deux bras, des mains, une tête, des yeux et un tronc comme les humonoïdes.

Ils ne possèdent pas de véritable capacité à parler à cause de l''absence totale de bouche, mais leur communication repose sur une autre forme de communication, par la pensée et les parfums.

## Caractéristiques de départ

| Santé de départ | Chakra de départ | Barrière bonus | Vitesse Sol/Nage |
| --- | --- | --- | --- |
| 5 | 10 | 5 | 4 / 4 |

## Avantage(s) et inconvénient(s)

**Avantage(s)** : Accès à toutes les magies.

**Inconvénient(s)** : Ne possède pas la parole, Classe barde et parleur interdite.

## Don de base

Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).

## Ethnies et dons raciaux

### Conscience collective

Permet de faire un lien avec un allié et lui permettre de partager les perceptions avec lui. (une fois par scène)

**Fiche de personnage V15.2.2** : aucune sous-race correspondante.

## Capacité Mode Hyper

**Unité** : Ne peut pas subir de croix, les soigne si il en possède, les parties du corps ne peuvent plus être ciblés et récupère 10% de barrière par tour de mode hyper.

## Classes accessibles

Nombre : 24 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur

## Magies accessibles

Nombre : 14 sur 15.

Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre
', 'draft', 'races', 'Nouveauté mise à jour Décembre, onglet « Fongoïde »');
INSERT INTO page_source (page_id, ordre, source_id) VALUES ('races/fongoide', 0, 'ref:nouveaute-mise-a-jour-decembre-onglet-fongoide');
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('races/fongoide', 0, 298);
INSERT INTO race (id, nom, ordre, presentation, sante, chakra_depart, barriere_bonus, vitesse_terre, vitesse_nage, ap, am, divers, don_base_brut, don_base_nom, don_base_type, don_base_effets, origine, source_ref, remarque, mono_magie, rang_liste) VALUES ('races/fongoide', 'Fongoïde', 13, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'races', 'Nouveauté mise à jour Décembre › Fongoïde › N1 ; décisions R239, R256', NULL, 0, 14);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race', 'races/fongoide', 'races/fongoide', 1, 'races');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/fongoide', 'Fongoïde', 'Une race entièrement fait de champignons dont l''origine remonte le jour où le Dieu de la Terre s''est donné la mort.

Ils ont une forme humanoïde car avec le temps, ils sont adaptés aux autres races intelligente et ont pris cette forme car plus pratique ? moins intimidante ? Personne ne le sait.

Selon la lignée première, cette race est apparu sous la forme humanoïde la première fois en l''an 80.', 'L''origine des Fongoïdes remonte à une époque aujourd''hui révolue : l''époque du Premier Champignon.

À cette époque, la Mort Fertile apparut dans la Forêt Colossale. Ce lieu, profondément marqué par l''énergie de la Terre, permit à un champignon qui passait par là d''assimilé une quantité folle d''énergie divine.

Le Premier Champignon fut le premier de son genre à développer une conscience dépassant celle d''un simple organisme. Sa croissance au sein de la Mort Fertile lui permit progressivement d''assimiler son énergie et de développer une intelligence collective.

Cette évolution attira l''attention de plusieurs dieux. Intrigués par cette forme de vie qui semble commencer à naître mais semble manquer de beaucoup de choses pour pouvoir évolué, certains dieux décidèrent d''intervenir en donnant au Premier plusieurs capacités. On ne connait pas les dieux qui ont influencés directement mais dans tout les cas, ça a fonctionné.

Les premières colonies commencèrent alors à développer des formes de plus en plus complexes. Au fil des générations, elles s''adaptèrent à leur environnement et aux autres peuples qu''elles côtoyaient. Leur corps finit progressivement par adopter une forme humanoïde.

La Mort Fertile n''existe cependant plus. Les Fongoïdes modernes ne dépendent donc pas de ce lieu pour exister : la Mort Fertile est leur berceau, pas leur habitat obligatoire.

Les Fongoïdes se reproduisent par spores. Une nouvelle génération commence son existence sous une forme primitive avant de se développer progressivement au sein même d''un autre fongoïde, une fois assez développé, ce dernier va l''enterrer dans un sol assez fertile et ainsi naîtra un ou plusieurs nouveaux fongoïdes qui auront une magie selon la ou les magie(s) dominante de l''environnement. Leur croissance est donc différente de celle des races humanoïdes classiques : un Fongoïde ne naît pas véritablement, il pousse.

Avec le temps, ils développèrent une conscience individuelle tout en conservant l''héritage de leur nature collective.

Les Fongoïdes sont incapables de communiquer par la parole. Ils possèdent néanmoins une forme de communication mentale leur permettant d''échanger directement avec les autres êtres vivants.

Choses assez singulière mais ils ont développé culturellement une manière de parler à eux : Ils ne disent pas "Quel age avez vous ?", ils disent "Depuis combien de saisons poussez vous ?" mais il possède un sens du deuil très fort, avec des rites funéraires qui varie selon leur magie innée.', 'Les Fongoïdes possèdent une silhouette humanoïde recouverte de caractéristiques fongiques. Avec une taille variable entre 1m50 et 1m80.

Ils n''ont pas de genre masculin ou féminin, ce concept est absent chez eux vu que leur reproduction ne repose pas sur deux individus.

Leur corps est fait de chair, de tissus fongiques et de différentes structures rappelant les champignons. Leur apparence varie fortement selon leur environnement et leur magie.

Leur couleur est notamment déterminée par la magie dominante assimilée durant leur croissance. Deux Fongoïdes issus de régions différentes peuvent ainsi présenter des couleurs et des caractéristiques radicalement différentes. Très influencé par la magie même dans la psyché, ils peuvent faire prevue d''hostilité envers ceux qui porte des magies opposés ou efficace contre eux.

Leur apparence humanoïde est le résultat de leur longue évolution. Leurs ancêtres ont progressivement adopté cette forme en s''adaptant aux créatures humanoïdes avec lesquelles ils entraient en contact. Ce cumule de connaissance fait qu''ils sont parfaitement capable d''utiliser des armes et leur magie comme les autres.

Ils possèdent des organes permettant une apparence proche de celle des autres races, mais leur nature fongique reste évidente : leur peau, leur tête, leurs excroissances et leur morphologie peuvent présenter différentes formes de chapeaux, de filaments, de spores ou de structures propres aux champignons. Ils possède deux jambes, deux bras, des mains, une tête, des yeux et un tronc comme les humonoïdes.

Ils ne possèdent pas de véritable capacité à parler à cause de l''absence totale de bouche, mais leur communication repose sur une autre forme de communication, par la pensée et les parfums.', 5, 10, 5, 4, 4, 'Accès à toutes les magies.', 'Ne possède pas la parole, Classe barde et parleur interdite.', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A4, AK3, AK30, H13, U13, AG13, H16, H19 ; don de base : décision R239 (2) ; vitesses : décision R256');
INSERT INTO ethnie (id, race_id, slug, nom, ordre, libelle, magie_id, descriptif, race_brut, bonus_pv, bonus_chakra, bonus_barriere, bonus_ap, bonus_am, bonus_vitesse, origine, source_ref, remarque) VALUES ('races/fongoide#ethnie:fongoide', 'races/fongoide', 'fongoide', 'Fongoïde', 97, NULL, NULL, NULL, 'Fongoïde', NULL, NULL, NULL, NULL, NULL, NULL, 'races', 'Décision R239 (3) : une seule ethnie, sans don d’ethnie', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('ethnie', 'races/fongoide#ethnie:fongoide', 'races/fongoide', 0, 'races');
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/fongoide#don:conscience-collective', 'races/fongoide', 'conscience-collective', 1, 'unique', NULL, 'Conscience collective', 'Permet de faire un lien avec un allié et lui permettre de partager les perceptions avec lui. (une fois par scène)', NULL, 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A27, H27', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/fongoide#don:conscience-collective', 'races/fongoide', 0, 'races');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/fongoide', 'onglet_race', 'race', 28, 'Fongoïde', NULL, NULL, 'races/fongoide', NULL, NULL, 'Ne peut pas subir de croix, les soigne si il en possède, les parties du corps ne peuvent plus être ciblés et récupère 10% de barrière par tour de mode hyper.', NULL, 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A32, H32', NULL, 'Unité');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/potentiel-illimite', 1, 0, '0', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A50:W65 (le tableau ne cite pas le Potentiel Illimité) ; décision R239');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-du-sang', 2, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A52');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-larcane', 3, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A54');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-corruption', 4, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A56');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-lespace-temps', 5, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A58');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-du-vide', 6, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A60');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-necromancie', 7, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A62');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-du-feu', 8, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › A64');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-leau', 9, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S52');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-glace', 10, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S54');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-terre', 11, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S60');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-du-vent', 12, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S56');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-foudre', 13, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S58');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-la-lumiere', 14, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S62');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'magies/magie-de-lombre', 15, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › S64');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/guerrier', 1, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/cuirasse', 2, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/lancier', 3, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/martiale', 4, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/moine', 5, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/frappeur', 6, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/voleur', 7, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/tueur', 8, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/mercenaire', 9, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/pugiliste', 10, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/parleur', 11, 0, '0', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › H19 ; décision R239 (4)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/bimane', 12, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/archer', 13, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/arbaletrier', 14, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/lanceur', 15, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/grenadier', 16, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/mage', 17, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/barde', 18, 0, '0', 'races', 'Nouveauté mise à jour Décembre › Fongoïde › H19 ; décision R239 (4)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/mage-rouge', 19, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/mage-bleu', 20, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/mage-vert', 21, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/clerc', 22, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/maclier', 23, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/ocultomancien', 24, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/archimage', 25, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/flagelleur', 26, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/orios', 27, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/fenrir', 28, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/kitsune', 29, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/olwman', 30, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/rokh', 31, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/namazu', 32, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/minotaure', 33, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/satyre', 34, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/medusain', 35, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/jackalope', 36, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/marcass', 37, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/anansi', 38, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/fongoide', 'classes/goleois', 39, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');

-- 2. Gémidien (onglet 22 « Gémidien » de la pièce jointe ; titre N1 « GÉMIDIEN »)
INSERT INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) VALUES ('ref:nouveaute-mise-a-jour-decembre-onglet-gemidien', 'libelle', 'Nouveauté mise à jour Décembre, onglet « Gémidien »', NULL, NULL, NULL, NULL, NULL);
INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, origine, source_ref) VALUES ('races/gemidien', 'races', 'gemidien', 'Gémidien', 'gemidien', NULL, '{"magies_innees": ["Sang", "Arcane", "Espace/Temps", "Vide", "Nécromancie", "Feu", "Eau", "Glace", "Terre", "Vent", "Foudre", "Lumière", "Ombre"]}', '## Présentation

Race mélant humain et corps en partie en gemme, leur origine sont profondément relié au super-gemme élémentaire.

Ils possèdent une grande polyvalence comme les humain mais n''ont pas accès au potentiel illimité.

Cette race est apparu la première fois en 70.

## Histoire

Les Gémidiens sont une race née d''un événement unique remontant à plusieurs générations.

Leur origine est liée aux Super Gemmes, des grosses gemmes parfaites qui concentre l''essence magique la plus pure.

Le premier Gémidien était autrefois un humain. En entrant en contact avec une Super Gemme, il chercha à établir un lien avec elle. L''expérience provoqua cependant un phénomène inattendu : une conscience naquit dans son esprit au contact de l''essence contenue dans la gemme. Cette conscience et l''humain finirent par fusionner, transformant progressivement son corps.

Une partie de son corps devint alors entièrement constituée de gemme, tandis que le reste demeura charnel. Cette transformation ne fut pas une simple altération physique : elle donna naissance à une nouvelle lignée.

Au fil des générations, cette particularité se transmit aux descendants du premier Gémidien. La transformation devint alors naturelle et héréditaire, faisant des Gémidiens une véritable race.

Chaque Gémidien est lié à une seule magie, correspondant à l''essence élémentaire héritée de la Super Gemme à l''origine de sa lignée. Cette essence demeure profondément inscrite dans leur organisme.

Malgré leur origine extraordinaire, les Gémidiens ne forment pas nécessairement un peuple isolé. Leur ascendance humaine leur permet de s''intégrer facilement aux différentes sociétés de Maverick et ils peuvent être rencontrés aux côtés des autres races à travers le monde.

Beaucoup considèrent simplement les Gémidiens comme des humains ayant autrefois subi une étrange transformation, mais la vérité reste encore voilée de mystères.

Bien entendu, certains ont essayer de produire la première génération de gémidien en cherchant quelque chose dans les supers-gemmes mais rien n''a été trouvé, les supers-gemmes aujourd''hui sont des objets inerte permettant beaucoup de choses (cf. Codex|Outils légendaires|Super gemme)

## Description

Les Gémidiens possèdent une apparence globalement humanoïde, leur ascendance humaine restant particulièrement visible. Leur peau est tout de fois un peu plus grise, comme pour rappeler l''origine en partie minérale.

Environ la moitié de leur corps est cependant constituée de gemme, répartie de manière irrégulière à travers leur anatomie. Il ne s''agit donc pas d''une partie précise du corps transformée : un Gémidien peut posséder un bras presque entièrement cristallin, quelques doigts, une partie du visage, des côtes visibles sous la peau ou encore des portions visibles de la colonne vertébrale constituées de gemme.

La disposition des parties cristallines varie considérablement d''un individu à l''autre.

La gemme présente sur leur corps correspond à leur magie et en reprend les couleurs et les caractéristiques. Un Gémidien lié au Feu arbora des partie en rubis, tandis qu''un Gémidien de Foudre pourra présenter des topazes parcourues de lueurs électriques.

Le reste de leur corps conserve une apparence organique humaine normale avec de la pilosité, des cheveux, etc...

Évidemment leur corps ne peux pas être utile pour être des ressources, si leur gemmes sont retiré de leur corps, ils dépérissent et deviennent de la caillasse inutile.

## Caractéristiques de départ

| Santé de départ | Chakra de départ | Barrière bonus | Vitesse Sol/Nage |
| --- | --- | --- | --- |
| 10 | 10 | 0 | 4 / 4 |

## Avantage(s) et inconvénient(s)

**Avantage(s)** : Accès à toutes les classes

**Inconvénient(s)** : Mono-magie uniquement, Magie potentiel illimité et corruption interdite

## Don de base

Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).

## Ethnies et dons raciaux

### Gemmoïde

Inflige un bonus +3 dégâts (+2/5 niveau global) de l''élément de la magie innée.

**Fiche de personnage V15.2.2** : aucune sous-race correspondante.

## Capacité Mode Hyper

**Surcharge élémentaire** : Chaque début de tour de mode hyper, le lanceur peut choisir un bonus parmi : +1D dégâts (+1D au niveau 10 global) | +1 vitesse (+1 au niveau 10 global) | avantages sur les jets contre les altérations d''états | +10 AM (+5 au niveau 10 global)

## Classes accessibles

Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur

## Magies accessibles

Nombre : 13 sur 15.

Sang, Arcane, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre
', 'draft', 'races', 'Nouveauté mise à jour Décembre, onglet « Gémidien »');
INSERT INTO page_source (page_id, ordre, source_id) VALUES ('races/gemidien', 0, 'ref:nouveaute-mise-a-jour-decembre-onglet-gemidien');
INSERT INTO page_tag (page_id, ordre, tag_id) VALUES ('races/gemidien', 0, 298);
INSERT INTO race (id, nom, ordre, presentation, sante, chakra_depart, barriere_bonus, vitesse_terre, vitesse_nage, ap, am, divers, don_base_brut, don_base_nom, don_base_type, don_base_effets, origine, source_ref, remarque, mono_magie, rang_liste) VALUES ('races/gemidien', 'Gémidien', 14, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'races', 'Nouveauté mise à jour Décembre › Gémidien › N1 ; décisions R239, R256', NULL, 1, 15);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race', 'races/gemidien', 'races/gemidien', 1, 'races');
INSERT INTO race_onglet (race_id, onglet, description_generale, histoire, description, sante_depart, chakra_depart, barriere_bonus, vitesse_sol, vitesse_nage, avantages, inconvenients, don_base, dons_rubrique, dons_rubrique_nom, dons_rubrique_don, dons_tableau_titre, origine, source_ref) VALUES ('races/gemidien', 'Gémidien', 'Race mélant humain et corps en partie en gemme, leur origine sont profondément relié au super-gemme élémentaire.

Ils possèdent une grande polyvalence comme les humain mais n''ont pas accès au potentiel illimité.

Cette race est apparu la première fois en 70.', 'Les Gémidiens sont une race née d''un événement unique remontant à plusieurs générations.

Leur origine est liée aux Super Gemmes, des grosses gemmes parfaites qui concentre l''essence magique la plus pure.

Le premier Gémidien était autrefois un humain. En entrant en contact avec une Super Gemme, il chercha à établir un lien avec elle. L''expérience provoqua cependant un phénomène inattendu : une conscience naquit dans son esprit au contact de l''essence contenue dans la gemme. Cette conscience et l''humain finirent par fusionner, transformant progressivement son corps.

Une partie de son corps devint alors entièrement constituée de gemme, tandis que le reste demeura charnel. Cette transformation ne fut pas une simple altération physique : elle donna naissance à une nouvelle lignée.

Au fil des générations, cette particularité se transmit aux descendants du premier Gémidien. La transformation devint alors naturelle et héréditaire, faisant des Gémidiens une véritable race.

Chaque Gémidien est lié à une seule magie, correspondant à l''essence élémentaire héritée de la Super Gemme à l''origine de sa lignée. Cette essence demeure profondément inscrite dans leur organisme.

Malgré leur origine extraordinaire, les Gémidiens ne forment pas nécessairement un peuple isolé. Leur ascendance humaine leur permet de s''intégrer facilement aux différentes sociétés de Maverick et ils peuvent être rencontrés aux côtés des autres races à travers le monde.

Beaucoup considèrent simplement les Gémidiens comme des humains ayant autrefois subi une étrange transformation, mais la vérité reste encore voilée de mystères.

Bien entendu, certains ont essayer de produire la première génération de gémidien en cherchant quelque chose dans les supers-gemmes mais rien n''a été trouvé, les supers-gemmes aujourd''hui sont des objets inerte permettant beaucoup de choses (cf. Codex|Outils légendaires|Super gemme)', 'Les Gémidiens possèdent une apparence globalement humanoïde, leur ascendance humaine restant particulièrement visible. Leur peau est tout de fois un peu plus grise, comme pour rappeler l''origine en partie minérale.

Environ la moitié de leur corps est cependant constituée de gemme, répartie de manière irrégulière à travers leur anatomie. Il ne s''agit donc pas d''une partie précise du corps transformée : un Gémidien peut posséder un bras presque entièrement cristallin, quelques doigts, une partie du visage, des côtes visibles sous la peau ou encore des portions visibles de la colonne vertébrale constituées de gemme.

La disposition des parties cristallines varie considérablement d''un individu à l''autre.

La gemme présente sur leur corps correspond à leur magie et en reprend les couleurs et les caractéristiques. Un Gémidien lié au Feu arbora des partie en rubis, tandis qu''un Gémidien de Foudre pourra présenter des topazes parcourues de lueurs électriques.

Le reste de leur corps conserve une apparence organique humaine normale avec de la pilosité, des cheveux, etc...

Évidemment leur corps ne peux pas être utile pour être des ressources, si leur gemmes sont retiré de leur corps, ils dépérissent et deviennent de la caillasse inutile.', 10, 10, 0, 4, 4, 'Accès à toutes les classes', 'Mono-magie uniquement, Magie potentiel illimité et corruption interdite', 'Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).', NULL, NULL, NULL, NULL, 'races', 'Nouveauté mise à jour Décembre › Gémidien › A4, AK3, AK30, H13, U13, AG13, H16, H19 ; don de base : décision R239 (2) ; vitesses : décision R256');
INSERT INTO ethnie (id, race_id, slug, nom, ordre, libelle, magie_id, descriptif, race_brut, bonus_pv, bonus_chakra, bonus_barriere, bonus_ap, bonus_am, bonus_vitesse, origine, source_ref, remarque) VALUES ('races/gemidien#ethnie:gemidien', 'races/gemidien', 'gemidien', 'Gémidien', 98, NULL, NULL, NULL, 'Gémidien', NULL, NULL, NULL, NULL, NULL, NULL, 'races', 'Décision R239 (3) : une seule ethnie, sans don d’ethnie', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('ethnie', 'races/gemidien#ethnie:gemidien', 'races/gemidien', 0, 'races');
INSERT INTO race_don (id, race_id, slug, rang, forme, etiquette, nom, texte, ethnie_id, origine, source_ref, remarque) VALUES ('races/gemidien#don:gemmoide', 'races/gemidien', 'gemmoide', 1, 'unique', NULL, 'Gemmoïde', 'Inflige un bonus +3 dégâts (+2/5 niveau global) de l''élément de la magie innée.', NULL, 'races', 'Nouveauté mise à jour Décembre › Gémidien › A27, H27', NULL);
INSERT INTO page_entite (entite_table, entite_id, page_id, principale, origine) VALUES ('race_don', 'races/gemidien#don:gemmoide', 'races/gemidien', 0, 'races');
INSERT INTO mode_hyper_effet (id, version, portee, rang, libelle, magie_id, magie2_id, race_id, variante, variante_brut, effet, commentaire, origine, source_ref, remarque, nom) VALUES ('onglet_race:races/gemidien', 'onglet_race', 'race', 29, 'Gémidien', NULL, NULL, 'races/gemidien', NULL, NULL, 'Chaque début de tour de mode hyper, le lanceur peut choisir un bonus parmi : +1D dégâts (+1D au niveau 10 global) | +1 vitesse (+1 au niveau 10 global) | avantages sur les jets contre les altérations d''états | +10 AM (+5 au niveau 10 global)', NULL, 'races', 'Nouveauté mise à jour Décembre › Gémidien › A32, H32', NULL, 'Surcharge élémentaire');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/potentiel-illimite', 1, 0, '0', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-du-sang', 2, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-larcane', 3, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-corruption', 4, 0, '0', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-lespace-temps', 5, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-du-vide', 6, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-necromancie', 7, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-du-feu', 8, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-leau', 9, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-glace', 10, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-terre', 11, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-du-vent', 12, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-foudre', 13, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-la-lumiere', 14, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_magie (race_id, magie_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'magies/magie-de-lombre', 15, 1, '1', 'races', 'Nouveauté mise à jour Décembre › Gémidien › H19 ; décision R239 (mono-magie, sans Potentiel Illimité ni Corruption)');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/guerrier', 1, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/cuirasse', 2, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/lancier', 3, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/martiale', 4, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/moine', 5, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/frappeur', 6, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/voleur', 7, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/tueur', 8, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/mercenaire', 9, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/pugiliste', 10, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/parleur', 11, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/bimane', 12, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/archer', 13, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/arbaletrier', 14, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/lanceur', 15, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/grenadier', 16, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/mage', 17, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/barde', 18, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/mage-rouge', 19, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/mage-bleu', 20, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/mage-vert', 21, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/clerc', 22, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/maclier', 23, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/ocultomancien', 24, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/archimage', 25, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/flagelleur', 26, 1, '1', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/orios', 27, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/fenrir', 28, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/kitsune', 29, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/olwman', 30, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/rokh', 31, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/namazu', 32, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/minotaure', 33, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/satyre', 34, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/medusain', 35, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/jackalope', 36, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/marcass', 37, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/anansi', 38, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');
INSERT INTO race_classe (race_id, classe_id, ordre, accessible, valeur_brut, origine, source_ref) VALUES ('races/gemidien', 'classes/goleois', 39, 0, '0', 'races', 'Décision R239 (4) : comme les races pures');

-- 3. Modes Hyper de l’Elfe argenté et du Felfe (docx de la mise à jour de Décembre, R237 (12)) : version onglet_race, noms inchangés ;
--    corps des deux pages recalculés par lib/corps-races.mjs#corpsDeRace (section « Capacité Mode Hyper », colonne « Onglet (retenu) » des écarts).
UPDATE mode_hyper_effet SET effet = 'Les sorts d''attaques imposent un désavantage sur les jets de défenses.' WHERE id = 'onglet_race:races/elfe-argente' AND effet = 'Tous les sortilèges d''attaques sont imparables.';
UPDATE page SET corps_md = 'Des elfes très forts en magie

## Présentation

Les descendants les plus proches des Elfes Dorés, ce sont les êtres qui sont le plus reliés à la magie.

Il s''agit d''humanoïdes qui ont un excellent taux de {{chakra|Chakra}} et font partie des meilleurs mages de Maverick, au détriment de la force physique.

Cette race est apparue pour la première fois en l''an -100, après un "accident".

## Histoire

Tout comme les forestiers et les noirs, ils ont été des esclaves des dorés. Leur origine reste encore assez inconnue, mais on parle d''une expérience qui aura mal tourné qui a changé une partie des elfes dorés en elfe argenté. Malgré leur statut d''esclave, les elfes argentés devenaient très nombreux et ont pu réussir à créer une mutinerie avec l''aide des elfes noirs et forestiers. Après une guerre fratricide, les elfes argentés ont réussi à libérer leur chaîne et celle des autres.

Malgré cet événement, les 3 elfes se détestent surtout qu''au fur et à mesure du temps, les argentés ont commencé à penser comme les dorés et à devenir des suprémacistes. Une partie des argentés se sont rebellés contre cette tendance suprémaciste, mais garde la mauvaise réputation de leur race proche des elfes dorés.

## Description

Un elfe argenté adulte mesure en moyenne 1,85 mètre, ce qui en fait les elfes les plus grands en moyenne. Leur poids moyen se situe autour de 75 kg.

Comme tous les elfes, ils possèdent des oreilles pointues. Celles des elfes argentés sont particulièrement longues, similaires à celles des elfes dorés. Chez les femelles, elles sont dressées, tandis que chez les mâles, elles sont légèrement tombantes. Hormis cela, les différences entre les deux sexes restent classiques et concernent principalement les cheveux, la forme du visage ou encore la morphologie.

Les elfes argentés présentent trois couleurs d’yeux principales : beige, argent et bleu. Leur peau ainsi que leurs cheveux sont naturellement d’une teinte argentée pâle, caractéristique de leur lignée.

Les variations de couleur sont extrêmement rares chez les individus de sang pur. Lorsqu’un elfe argenté possède des yeux ou des cheveux d’une autre couleur, cela indique généralement un métissage avec une autre race.

Culture : Rome antique/Grèce antique

## Caractéristiques de départ

| Santé de départ | Chakra de départ | Barrière bonus | Vitesse Sol/Nage | AP (fiche) | AM (fiche) |
| --- | --- | --- | --- | --- | --- |
| 3 | 14 | 0 | 5 / 4 | 0.0 | 0.0 |

## Avantage(s) et inconvénient(s)

**Avantage(s)** : Accès à toutes les magies

**Inconvénient(s)** : La Force a un maximum de 2, l''Intelligence est au minimum à 3.

## Restrictions

Valeurs de la fiche de personnage V15.2.2. Chaque valeur est précédée de l''opérateur de la colonne « \< ou > » qui la précède dans l''onglet « Race ».

| Restrictions Force | Restrictions Intelligence |
| --- | --- |
| \< 3.0 | \> 2.0 |

## Don de base

Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).

## Ethnies et dons raciaux

Rubriques de l''onglet « Elfe Argenté » : « Condition d''origine », « Don ».

Nombre : 3.

### Territoire Elfes Argentés

**Don**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 {{barriere|Barrière}}.

**Fiche de personnage V15.2.2** : sous-race « Elfe Argenté Suprémaciste » (voir « Sous-races et origines »).

### Barrage Argenté

**Don**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Santé.

**Fiche de personnage V15.2.2** : sous-race « Elfe Argenté Barrage argenté » (voir « Sous-races et origines »).

### Ailleurs

**Don**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 {{chakra|Chakra}}.

**Fiche de personnage V15.2.2** : sous-race « Elfe Argenté Autre » (voir « Sous-races et origines »).

## Capacité Mode Hyper

**Sang argenté** : Les sorts d''attaques imposent un désavantage sur les jets de défenses.

## Sous-races et origines

Section issue de la fiche de personnage V15.2.2 (onglet « Bonus Race »), avec ses bonus chiffrés et résistances ; l''onglet de la race, qui prime, est la section « Ethnies et dons raciaux ».

Nombre : 3.

Colonne « Race » de l''onglet « Bonus Race » : Elfe Argenté.

### Elfe Argenté Suprémaciste

**Nom** : Territoire Elfes Argentés

**Descriptif**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Barrière.

| Bonus Barrière |
| --- |
| 3 |

### Elfe Argenté Barrage argenté

**Nom** : Barrage Argenté

**Descriptif**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Santé.

| Bonus PV |
| --- |
| 3 |

### Elfe Argenté Autre

**Nom** : Ailleurs

**Descriptif**

- +2 aux dégâts magiques, qui augmente de +2 tous les 5 niveaux globaux.
- +3 Chakra.

| Bonus Chakra |
| --- |
| 3 |

## Classes accessibles

Section issue de la fiche de personnage V15.2.2 (onglet « Accessibilité de Classe »), pas de l''onglet de la race.

Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur

## Magies accessibles

Section issue de la fiche de personnage V15.2.2 (onglet « Accessibilité Magie »), pas de l''onglet de la race.

Nombre : 15 sur 15.

Potentiel Illimité, Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre

## Écarts avec la fiche de personnage V15.2.2

Cette page suit l''onglet « Elfe Argenté » du Google Sheet « Les races », qui prime sur la fiche de personnage (décision du propriétaire du projet). La fiche V15.2.2 dit autre chose, ou ce que l''onglet ne dit pas, sur les points suivants ; ses valeurs sont citées telles qu''elles y sont écrites.

| Élément | Onglet « Elfe Argenté » (retenu) | Fiche V15.2.2 (citée telle quelle) |
| --- | --- | --- |
| Don de base<br>(fiche : colonne « Don base ») | Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra\|chakra}} (jet de calme en stress)). | Méditation/Action/Permet de récupérer 2d6 chakra (jet de calme en stress). |
| Capacité Mode Hyper<br>(fiche : colonne « Capacité Hyper », sans nom de capacité) | Sang argenté<br>Les sorts d''attaques imposent un désavantage sur les jets de défenses. | Toutes les sortilèges d''attaques sont imparable. |
' WHERE id = 'races/elfe-argente';
UPDATE mode_hyper_effet SET effet = 'Peut voler, les dégâts et soins magiques sont augmentés de 1d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2.' WHERE id = 'onglet_race:races/felfe' AND effet = 'Peut voler, les dégâts et soins magiques sont augmentés de 2d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2.';
UPDATE page SET corps_md = 'Une race hybride entre elfe et farfadet

## Présentation

Un hybride entre Elfe et Grande fée, leur apparence peut grandement varier selon les parents, mais tous sont gracieux et agiles, mais également de santé fragile.

Ils sont apparus en l''an 80, une belle union taboue entre une grande fée et un elfe argenté.

## Histoire

L’origine des felfes demeure incertaine, et nul ne sait avec certitude qui fut le premier de leur espèce. Selon une légende ancienne, leur naissance remonterait à l’union secrète entre le dirigeant des Elfes Argentés de l’époque et la grande reine des Farfadets. De cette relation serait née la première felfe : une femelle à la peau argentée.

Les deux autres variantes seraient apparues plus tard, issues d’unions similaires entre elfes et farfadets, donnant naissance à une descendance hybride aux caractéristiques variées.

Les felfes sont aujourd’hui présents à travers tout le monde. Ils ne possèdent pas de nation propre, vivant au sein des sociétés elfiques ou farfadet, où ils sont généralement acceptés comme des membres à part entière.

## Description

Un Felfe adulte mesure en moyenne entre 1m40 et 1m70, c''est une race qui est petite en taille en plus d''être assez frêle.

Le poids moyen d''un Felfe est de 50kg, ce sont des créatures humanoïdes plutôt légères.

Ils possèdent des ailes des fées (ailes de papillons) qui ne leur permettent pas de voler (sauf en mode hyper). Il existe 3 variantes de felfes qui ont leur petite subtilité au niveau de l''apparence :

- Les felfes forestiers possèdent une peau beige, une carrure plutôt élancée ainsi que les oreilles des elfes forestiers, la couleur de cheveux principale est le blond ainsi que ses différents tons. Les couleurs d''yeux principales sont : Vert, Doré, Marron.

- Les felfes noirs ont la peau noire, une carrure un peu plus équilibrée ainsi que les oreilles des elfes noirs, la couleur de cheveux principale est le gris dans les tons foncés. Les couleurs d''yeux principales sont : Rouge, Mauve et Gris. Une légende parle de l''existence de felfes noirs à la peau blanche comme les salés, mais ça n''a jamais été prouvé officiellement, la raison officielle est qu''ils sont tellement rares qu''on les considère comme inexistants.

- Les felfes argentés ont la peau argentée, une carrure très frêle ainsi que les oreilles des elfes argentés, la couleur de cheveux principale est le gris dans les tons clairs. Les couleurs d''yeux principales sont : Beige, Argent et Bleu.

Culture : Rome antique

## Caractéristiques de départ

| Santé de départ | Chakra de départ | Barrière bonus | Vitesse Sol/Nage | AP (fiche) | AM (fiche) |
| --- | --- | --- | --- | --- | --- |
| 2 | 13 | 5 | 5 / 3 | 0.0 | 0.0 |

## Avantage(s) et inconvénient(s)

**Avantage(s)** : Accès à toutes les magies.

**Inconvénient(s)** : La Force à un maximum de 2.

## Restrictions

Valeurs de la fiche de personnage V15.2.2. Chaque valeur est précédée de l''opérateur de la colonne « \< ou > » qui la précède dans l''onglet « Race ».

| Restrictions Force |
| --- |
| \< 3.0 |

## Don de base

Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra|chakra}} (jet de calme en stress)).

## Ethnies et dons raciaux

Rubriques de l''onglet « Felfe » : « Type », « Nom », « Don ».

Nombre : 3.

### Felfe Forestier

**Nom** : Sang féerique forêt

**Don** : Magie, Concentration, Esquive, Ruse = 5% d''acquis.

**Fiche de personnage V15.2.2** : sous-race « Felfe Forestier » (voir « Sous-races et origines »).

### Felfe Noir

**Nom** : Sang féerique corrompu

**Don**

- Magie, Concentration, Survie = 5% d''acquis.
- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec.

**Fiche de personnage V15.2.2** : sous-race « Felfe Noir » (voir « Sous-races et origines »).

### Felfe Argenté

**Nom** : Sang féerique brillant

**Don**

- Magie, Concentration, Survie = 5% d''acquis.
- +1 aux dégâts magiques, qui augmente de +1 tous les 5 niveaux globaux.

**Fiche de personnage V15.2.2** : sous-race « Felfe Argenté » (voir « Sous-races et origines »).

## Capacité Mode Hyper

**Surpuissance magique** : Peut voler, les dégâts et soins magiques sont augmentés de 1d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2.

## Sous-races et origines

Section issue de la fiche de personnage V15.2.2 (onglet « Bonus Race »), avec ses bonus chiffrés et résistances ; l''onglet de la race, qui prime, est la section « Ethnies et dons raciaux ».

Nombre : 3.

Colonne « Race » de l''onglet « Bonus Race » : Felfle.

### Felfe Forestier

**Nom** : Sang féerique forêt

**Descriptif** : Magie, Concentration, Esquive, Ruse = 5% d''acquis.

### Felfe Noir

**Nom** : Sang féerique corrompu

**Descriptif**

- Magie, Concentration, Survie = 5% d''acquis.
- Peut avoir une magie acquise en plus de la Corruption en innée.

### Felfe Argenté

**Nom** : Sang féerique brillant

**Descriptif**

- Magie, Concentration, Survie = 5% d''acquis.
- +1 aux dégâts magiques, qui augmente de +1 tous les 5 niveaux globaux.

## Classes accessibles

Section issue de la fiche de personnage V15.2.2 (onglet « Accessibilité de Classe »), pas de l''onglet de la race.

Nombre : 26 sur 39.

Guerrier, Cuirassé, Lancier, Martiale, Moine, Frappeur, Voleur, Tueur, Mercenaire, Pugiliste, Parleur, Bimane, Archer, Arbalétrier, Lanceur, Grenadier, Mage, Barde, Mage Rouge, Mage Bleu, Mage Vert, Clerc, Maclier, Ocultomancien, Archimage, Flagelleur

## Magies accessibles

Section issue de la fiche de personnage V15.2.2 (onglet « Accessibilité Magie »), pas de l''onglet de la race.

Nombre : 15 sur 15.

Potentiel Illimité, Sang, Arcane, Corruption, Espace/Temps, Vide, Nécromancie, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre

## Écarts avec la fiche de personnage V15.2.2

Cette page suit l''onglet « Felfe » du Google Sheet « Les races », qui prime sur la fiche de personnage (décision du propriétaire du projet). La fiche V15.2.2 dit autre chose, ou ce que l''onglet ne dit pas, sur les points suivants ; ses valeurs sont citées telles qu''elles y sont écrites.

| Élément | Onglet « Felfe » (retenu) | Fiche V15.2.2 (citée telle quelle) |
| --- | --- | --- |
| Don de base<br>(fiche : colonne « Don base ») | Méditation (Action 3 fois/jour) (Permet de récupérer 3d6 + 6 {{chakra\|chakra}} (jet de calme en stress)). | Méditation/Action/Permet de récupérer 2d6 chakra (jet de calme en stress). |
| Don de l''ethnie « Felfe Noir »<br>(fiche : sous-race « Felfe Noir », colonne « Descriptif ») | \- Magie, Concentration, Survie = 5% d''acquis.<br>\- N''est pas forcé d''avoir la corruption en innée et peut avoir une autre magie avec. | \- Magie, Concentration, Survie = 5% d''acquis.<br>\- Peut avoir une magie acquise en plus de la Corruption en innée. |
' WHERE id = 'races/felfe';

-- 4. Mots-clés des deux races (R218 (5) pour leur forme, R219 (5) pour le verrou à 0), catégorie 3 « Race » ; clé = normalize(libellé), sans homonyme
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (408, 'Fongoïde', 'fongoide', NULL, 'race:pure', '/races/fongoide/', 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (408, 3);
INSERT INTO mot_cle (id, libelle, cle, description, couleur, url, verrou, monnaie_id, icone) VALUES (409, 'Gémidien', 'gemidien', NULL, 'race:pure', '/races/gemidien/', 0, NULL, NULL);
INSERT INTO mot_cle_categorie (mot_cle_id, categorie_id) VALUES (409, 3);
