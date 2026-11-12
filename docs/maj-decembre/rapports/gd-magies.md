# gd-magies (a6bcee7bc8194501b)


---

## Rapport 1 sur 1

Statut : fait. 16 questions non bloquantes (MAJ-M1 à M16), rien écrit dans le dépôt.
Détail complet, lisible par script :
- /tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/maj-decembre/gd-magies/specialisations.tsv (28 spécialisations : nom exact, adresses, description, sorts par niveau avec adresse)
- /tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/maj-decembre/gd-magies/notes-de-cellule.tsv (110 notes des onglets 03-16, dont 31 neuves ou changées, avec statut NEW)

## Fait

### 1. Les spécialisations (onglets 03-16 ; le 02 Potentiel illimité n'en a aucune)
- Chaque onglet a le même gabarit.
  - Ligne H : « SPÉCIALISATION » en E{H} et AM{H}.
  - Nom de la spé gauche en M{H}, droite en AU{H}. Descriptions en M{H+2} et AU{H+2}.
  - Sorts à partir de la ligne H+5 : gauche E (niveau), G (nom) ; droite AM (niveau), AO (nom).
  - Sorts communs : colonne V (niveau), X (nom), à partir de la ligne qui suit l'en-tête « Niveau ».
- Les noms, tels qu'écrits (majuscules, parfois un saut de ligne final dans la cellule). Les deux premiers, puis les suivants :
  - Sang (H=70) : PUISSANCE / SANGUILONANT
  - Arcane (H=75) : CONSTRUCTION / DESTRUCTION
  - Corruption (H=75) : PÉTROLE / BLOQUEUR
  - Espace/Temps (H=69) : SPACIO / TEMPORELLE
  - Vide (H=69) : ESPRIT / CONTESTATION
  - Nécromancie (H=72) : LICHE / POISON
  - Feu (H=66) : **VOLCAN** / CENDRE. Le propriétaire a écrit « Voclan » : c'est une faute de frappe, le classeur dit VOLCAN (09-feu, M66).
  - Eau (H=65) : DÉFERLANTE / SOURCE
  - Glace (H=66) : NEIGE / CRISTAL
  - Terre (H=66) : VÉGÉTAL / MINÉRAL
  - Vent (H=66) : TEMPÊTE / SON
  - Foudre (H=66) : PLASMA / MAGNÉTISME
  - Lumière (H=66) : SOLAIRE / BÉNÉDICTION
  - Ombre (H=66) : LUNE / SONGE
- Les 4 combinaisons de l'exemple du propriétaire existent : Nécromancie LICHE ou POISON, Feu VOLCAN ou CENDRE.
- Lignes de l'en-tête « Niveau » des sorts communs (la ligne de la colonne V) : Sang 39, Arcane 44, Corruption 44, Espace/Temps 38, Vide 38, Nécromancie 41, Feu 35, Eau 34, les six autres 35.
- Nombre de sorts :
  - **Chaque spé fait 4 sorts au NPM 3, 4 au NPM 4 et 2 au NPM 5, soit 10 par spé (28 spés, sans exception).**
  - Le tableau commun fait 5 sorts au NPM 1 et 5 au NPM 2 dans les 14 magies.
  - Total : 30 sorts par magie, contre 23 en V8 (5/5/5/5/3, d'après `data/rows/sort.sql`).
  - « 4 par spé » n'est donc vrai que par niveau (NPM 3 et NPM 4). Voir MAJ-M1.
  - Le NPM 3 passe de 5 sorts à 4 par spé (8 pour un mono-magie). Le NPM 4 de même. Le NPM 5 passe de 3 à 2 par spé (4 pour un mono-magie).
- Particularités :
  - Corruption : ses deux spés existent (05, M75 et AU75). Les deux sorts « Contre-sort » (Arcane Destruction et Corruption Bloqueur, niveau 4) et « Vague déferlante » (communs de l'Arcane et de la Corruption) sont en double entre les deux magies.
  - Collisions de noms : la spé PÉTROLE et le sort commun « Pétrole » (Corruption) ; la spé POISON et l'état Poison ; la spé CONSTRUCTION et le type de sort ; la spé BÉNÉDICTION et le sort « Bénédiction » (Lumière, NPM 2) ; la spé TEMPÊTE et le sort « Tempête » (Vent, NPM 4). Il faudra des identifiants de spé qui ne se confondent avec rien.
  - Faute dans une description, à garder telle quelle : « spécialisatino » (Vide, AU71).
  - Incantations du NPM 5 : le classeur en porte 8 (V8 : 13 ; Glace 3 à 0, Terre 1 à 0, Vide 3 à 2). Certains titres ne correspondent à aucun sort : Feu L113 « Météore Cramoisi » (le sort s'appelle « Météore éruptif »), Eau L100 « Laser Hydraulique » (« Torrant colérique »), Ombre AU102 « Armée du rêve » (« Armée de l'ombre ») et AU113 « Prémonition » (« Prophétie »).

### 2. La règle d'accès : le Sommaire (01, AP1) rapproché des mots du propriétaire
- **Concorde**
  - Les spécialisations s'ouvrent au NPM 3 (AP1, 1re ligne). `data/rows/niveau_global.sql` donne NPM 3 au niveau global 8, NPM 2 au 4, NPM 4 au 12 et NPM 5 au 16 (R16). « Niveau global 8 = NPM 3 » est donc exact.
  - Les mono-magie ont accès aux deux spés sans choix, et seuls les bi-magie choisissent un chemin (AP1, 2e ligne).
  - Au niveau global 8, le mono-magie est en « Super-magie » et débloque « les emplacement de sort de la magie acquise » (AP1, 3e ligne), ce que le propriétaire dit par « comme s'il était BI-magie ».
  - Le Potentiel illimité n'a pas de spé. L'onglet 02 est inchangé (A26 est seulement remis en forme). Il garde « Mono magie uniquement » et « niveau 3 de puissance magique maximum » (R188).
- **Diffère ou se précise**
  - Le propriétaire dit « un emplacement » ; le Sommaire dit « les emplacements de la magie acquise ». Sur la fiche, les emplacements valent conditions × NPM (`guide/fiche-tableau-magie`, R27, R189) : une magie acquise est une condition de plus, soit +3 emplacements au NPM 3, +4 au NPM 4, +5 au NPM 5. Voir MAJ-M2.
  - « 4 pour chaque spé » n'est pas dans le Sommaire (voir MAJ-M1). Le mot « Super-magie » n'est pas dans les mots du propriétaire.
  - NPM 5 : le guide dit « avec deux magies, les sorts du niveau 5 restent fermés » (`niveau_global` 16 : « non disponible pour les personnages avec une magie acquise »). Un bi-magie n'atteint donc jamais les 2+2 sorts de NPM 5 des spés. Le mono-magie en Super-magie les atteint, car il est « toujours mono-magie » (AP1). C'est une lecture à confirmer (MAJ-M3).
  - Le Sommaire est une « version en test » (AP1, « béta »), alors que le docx dit « Magie V10 disponible ». Aucun V9 n'est vu dans les sources.
- **Ouvert** (questions) : définitif ou non (M6) ; livre de sort et spé non choisie (M7) ; PI (M8) ; Lamia (M5) ; Archimage avec Grimoire (M4). La magie acquise se choisit à la création (`guide`, « La magie acquise »), sans condition de niveau trouvée : un bi-magie du niveau 1 choisit donc sa spé au niveau 8, ce qui ne pose pas de cas à part. Un PI bi-magie n'existe pas (R15, R176). Corruption : mono-magie sauf l'Elfe Noir Charbon et le Felfe Noir (R15, R20). Le Charbon et le Felfe Noir en bi-magie choisissent une spé de Corruption et une de l'autre magie ; les autres Corruption sont mono-magie, avec les deux spés.

### 3. Notes de cellule et textes généraux nouveaux (onglets 02-16 et 20)
- Mode Hyper (20) : aucune différence avec le V8. Onglet 02 : aucune règle nouvelle.
- Le texte de description de la Corruption (05, A7) change un mot : « l'antithèse de l'Arcane » devient « l'ombre de l'Arcane ».
- **Disparu : la « Règle spéciale pour sort niveau 5 »** (tour de charge). Elle était dans le Sommaire V8 (A31:AN36, ligne `regle_magie` `magies#regle:regle-speciale-pour-sort-niveau-5`). Les 19 cellules du nouveau Sommaire ne la portent plus (MAJ-M9).
- **Disparues : les légendes de chaque onglet de magie** (« IC = Instant Cast », « Par Niveau / Lecture / Cadeau du MJ » : V8 en 75-77 des 14 onglets, base `legende_sort`, 7 lignes). Il ne reste que « Niveau de Maîtrise (NM) » (04, AT59).
- **Disparu : le tableau « Amélioration cadavérique »** de la Nécromancie. La base en a 14 lignes (`amelioration_cadaverique`) ; voir MAJ-M10.
- Nouveaux sigles, définis seulement par des notes :
  - Foudre AT45 et Ombre AT48 : « II : Initiative individuelle / IG : Initiative groupée ».
  - Foudre Z92 : « CE = Charge électrique, CK = Chakra ». Foudre AC98 : « BA = Barrière ».
- Notes nouvelles ou changées qui posent une règle :
  - Feu BK77 (Aspect cendreuse) : l'« insensibilité » est un état où aucun sortilège ne touche le lanceur ; un coup physique l'annule.
  - Nécromancie AC80 (Forge de ses morts) : « Arme Spectrale = Peut toucher l'immatériel et ignore 50% des AP ».
  - Vent BK89 (Sonar) : définition de « Ligne de vue ».
  - Vent AT63 (Recul forcé) : règle de recul sur une cible grande.
  - Glace AC80 (Sublimation) : « gel 2 correspond à 2 états de gel ».
  - Terre BK71 (Barrière rocheuse) : règle de « tolérance » d'une protection.
  - Glace BK86 et Terre AC89 : protection à 1 de santé pendant 2 tours.
  - Lumière AC80 (Mur gamma) : les non-morts prennent 2 fois plus de dégâts.
  - Terre AC98 : la plante géante prend 2 fois plus des sorts de feu ou de sang.
  - Foudre BK74 et AC92 (plaques, charges) ; Arcane AC83 et AC104.
  - Vide AC98 (Regard de Mora) : une liste de règles dont « Détruit les sorts Construction » et « Les ennemis perdent un niveau de puissance magique ».
  - Vide BK89 (Déni de classe) : « Ne retire pas le premier don niveau 10 des spécialisations ». Ce « spécialisations » est probablement les spécialités de classe, pas les spés magiques. Les deux mots se ressemblent.
- Nouvel état dans l'onglet 17 : « Somnolence », magie liée « Ombre (Songe) » (A58, E58), absent des 20 états de la base. C'est le premier lien d'un état avec une spé (`etat_magie`).

### 4. Les règles de sort touchées
- **Mur de chakra « est une construction »** (04, M80 ; V8 : « Entrave »). Le type existe : `sort_type.type = 'construction'` (6 sorts en V8, `data/rows/sort_type.sql`). Il n'y a aucun mot-clé de glossaire « Construction ». Le classeur l'emploie sur 16 sorts.
  - Les 16 : Coagulation 03 AU81 ; Forge-Magie 04 AD57 ; Mur de chakra 04 M80 ; Mine poisseuse 05 M80 ; Mur d'os 08 AD48 ; Prison d'os 08 M83 ; Mur de flammes 09 M80 ; Zone abyssal 10 M97 ; Sculpteur glacé 11 AD42 ; Gel profond 11 AU77 ; Mur de glace 11 AU80 ; Sable changeant 12 AU77 ; Mur hertz 14 M80 ; Lame prismatique 15 M74 ; Mur gamma 15 M80 ; Révélation 15 M83.
  - Le type est désormais une cible de règles : Regard de Mora (07 AC98), Sapeur (05 AC98 : « Double les dégâts contre les sorts Construction »), Extinction (07 BK98 : « constructions magiques »).
- **« Ignore que l'AM »** : la formule « Tire un rayon qui ignore l'AM. » est écrite telle quelle en 04 BK83 (Laser de chakra), 05 AC83 (Laser noir), 06 BK95 (Vision déphasé), 09 AC92 (Rayon de fusion), 10 BK82 (Laser hydraulique), 12 BK80 (Rayon géode), 15 AC92 (Rai solaire). V8 écrivait « Ignore totalement les AP, AM et la barrière » (Laser de chakra) ou « les AM et la barrière » (Laser noir), et « Ignore AM, AP et BA » (ancien Rai solaire de Feu). Le docx et le classeur concordent. Aucune décision n'est nécessaire.
- **Nerveux (14 AT45) et Pichenette (16 AT48)** : deux effets « II » (individuelle, au prochain tour) et « IG » (groupée, « passivement du premier jet d'initiative »). Les valeurs D/S/B sont inchangées, « +2 INI (+1/NM) » et « -5 INI (-2/NM) » (MAJ-M14). Aucune règle d'initiative n'existe dans les décisions (recherche sur `docs/decisions-index.md`). « Initiative Groupé » vient du docx, rubrique Gameplay.
- **Clou** (03 AQ43) : « 1d6 dégâts (+3/NM) », V8 « (+2/NM) ». Le coût passe aussi de « 3 + 2 Sang » à « 2 + 2 Sang », ce que le docx ne dit pas.
- **Marquage** (03) : portée « 1 (+1/NM) » (AK46) ; D/S/B « +1d de dégâts reçu » sans « (+1d/3NM) ».
- **Cape hivernale** (11 BH89 / BK89) :
  - D/S/B « -25% dégâts finaux magique » ; effet « 3NM = réduit les dégâts de 50% au lieu de 25% ».
  - Le type « Amplification (IC pour 3 NM) » devient « Amplification » : l'IC à 3 NM disparaît.
  - « Dégâts finaux » existe déjà (`guide/formule-des-degats` ; Mode Hyper de l'Eau : « réduit ses dégâts finaux de 20% »). Aucune décision n'est nécessaire. L'ordre exact avec la résistance n'est pas écrit.
- **Fer (R164)**
  - Les 12 sorts Fer élémentaires sont inchangés.
  - Fer corrompu précise : « inflige 5 point de corruption par coup qui touche. Dure 3 tours. », ce qui va dans le sens de R164.
  - **Nouveau : Fer brillant (Arcane, 04 V69), « +10 dégâts », « énergie brillante », 3 tours.** R164 en comptait 13, « sauf l'Arcane » (MAJ-M12).
  - Cuivre (docx) : « sorts de type Fer … 4 tours au lieu de 3 ». C'est cohérent avec la durée de 3 tours et le mot-clé « sort fer » de R164.
- **Anti-Mytril devient Anti-Alliage** (12, AO92 / BK92, Terre NPM 4) : « Reforce la peau et bloque l'effet secondaire des matériaux pendant 3 tours. Ne bloque leur bonus de dégâts. » (MAJ-M13). V8 : « L'effet du Mythril est annulé pendant 3 tours. »
- **Le docx est inexact sur deux « disparaît »** : « Image diffuse » est inchangée (06 E95), et « Esprit solide » est devenu « Intérieur solide » (07 G92), avec le même texte (MAJ-M11). J'ai retrouvé les 10 autres disparus sans homonyme, par recherche de leur texte V8.
- Ce que disent les expressions de NM, sans calcul :
  - « (+3/NM) » du Clou, « 1 (+1/NM) » de la portée du Marquage : écrits tels quels.
  - Bénédiction (15 AT54) : « (+1/NM) » vient après « pendant 2 tours », sans unité écrite ; le D/S/B perd son « (+1d/3NM) ».
  - Miroir des arcanes (04 G98) : « 3NM = Ne prend plus l'effet en question ». Le type n'est plus « IC pour 3 NM » (docx).
- **Coût de Boules plasmiques** (14 Q71) : la cellule dit « 5/boule ». Le docx dit « 6 chakra par boule » (MAJ-M15). C'est un cas du type « N par unité » des coûts R105 et R106 (« Par … »).

## Reste
- Je n'ai pas fait la comparaison sort par sort (script du leader-technique).
- Je n'ai pas lu les onglets 17 (hors Somnolence), 18, 19, ni les onglets de races ou de classes (21-25).

## Pour les autres
- `gd-fiche` :
  - tableau des sorts : choix de la spé d'un bi-magie, `sortsPossibles`, contrôles ;
  - emplacements : MAJ-M2 ;
  - R27 reste valable ;
  - le NPM 5 de la Super-magie.
- `gd-races` : Lamia (R28), Elfe Noir Charbon et Felfe Noir (R20), MAJ-M5.
- `gd-mecaniques` : Initiative groupée et sigles II/IG ; « insensibilité », « Arme spectrale », « Ligne de vue », compte des « gel » ; état Somnolence (« Ombre (Songe) ») ; sigles CE/CK/BA.
- `gd-objets` : Cuivre (« sorts de type Fer », 4 tours), Anti-Alliage et effets secondaires des matériaux, Fonte et Bronze (solidité).
- `gd-dons` : Archimage (MAJ-M4, MAJ-M15) ; note de « Déni de classe » (« premier don niveau 10 des spécialisations »).
- leader-technique / `tech-db` :
  - modèle de données des spés (28 lignes ; les sorts communs n'en ont pas ; identifiants sans collision) ;
  - `legende_sort` et `regle_magie` absents du classeur ;
  - `amelioration_cadaverique` (14 lignes) ;
  - sorts disparus ou renommés encore cités par le bestiaire : `monstre_capacite.sorts` cite Anti-magie (5), Rayon négatif (2), Anti-Mythril (2) ; `creature_capacite_sort` cite Autel sanglant (1) et Rayon négatif (1) ;
  - R130 et R206 (cartes de créatures invoquées) dépendent de l'amélioration cadavérique ;
  - skill `zone-magies` : à mettre à jour par `tech-skills` (spés, Super-magie).

## Questions (pour le propriétaire ; format `poser-une-question`)
- **MAJ-M1.** « 4 pour chaque spé » : lequel est vrai ?
  - (a) 4 sorts par spé à chaque NPM de 3 et 4, puis 2 au NPM 5, soit 10 par spé, comme le classeur (onglets 03-16, ligne H+5 et suivantes). Un mono-magie choisit alors parmi 8 sorts de NPM 3, 8 de NPM 4 et 4 de NPM 5 ; un bi-magie parmi 4, 4 et aucun au NPM 5.
  - (b) autre.
- **MAJ-M2.** Le mono-magie du niveau 8 gagne :
  - (a) une condition de plus au calcul des emplacements, soit les emplacements d'une magie acquise = +NPM emplacements (AP1 : « les emplacement de sort de la magie acquise » ; `guide/fiche-tableau-magie` ; R27, R189) ;
  - (b) un seul emplacement, comme le dit le propriétaire à la lettre ;
  - (c) autre.
- **MAJ-M3.** La Super-magie ne change rien d'autre que les emplacements : le mono-magie reste mono-magie pour le Mode Hyper (onglet 20 « Mono-Magie / Bi-magie »), la Symbiose, et garde le NPM 5 (AP1 : « toujours mono-magie ») ? Oui, non, ou préciser.
- **MAJ-M4.** Un Archimage au don « Grimoire » (R189, compte comme une magie acquise) et mono-magie, au niveau 8 : (a) Super-magie s'ajoute à Grimoire (2 conditions de plus) ; (b) Grimoire suffit (1 seule) ; (c) autre.
- **MAJ-M5.** La Lamia (R28 : une seule magie, aucune acquise) et toute race qui ne peut avoir de magie acquise : a-t-elle la Super-magie au niveau 8 (emplacements en plus) ? Oui, non.
- **MAJ-M6.** Le choix de spé d'un bi-magie est-il définitif, ou modifiable ? (Le Sommaire, AP1, ne dit rien.) Définitif / modifiable librement / modifiable à une condition à préciser.
- **MAJ-M7.** Un livre de sort (R169, tous les sorts de la magie, choisis ou non, NM « en attente ») peut-il porter sur un sort d'une spé que le bi-magie n'a pas choisie ? Oui, en attente comme R169 / non.
- **MAJ-M8.** Le Potentiel illimité (onglet 02 : « pioche ses sorts dans toute les magies », NPM 3 maximum, R188 ; le propriétaire : « hormis le PI ») : ses sorts de NPM 3 (et 4 avec « Semi-complet ») viennent de :
  - (a) toutes les spés de toutes les magies ;
  - (b) une spé par magie, au choix ;
  - (c) autre.
- **MAJ-M9.** La « Règle spéciale pour sort niveau 5 » (tour de charge, V8 Sommaire A31:AN36), retirée du nouveau Sommaire, est-elle toujours en vigueur ? Oui / non, supprimée.
- **MAJ-M10.** « Amélioration cadavérique disparaît » (docx) : les 14 améliorations (`amelioration_cadaverique`, R130 « selon l'invocation sacrifiée ») disparaissent aussi du site ? Oui / non, elles restent en lore / autre.
- **MAJ-M11.** Le docx dit que « Image diffuse » et « Esprit solide » disparaissent. Le classeur garde Image diffuse (06 E95) et renomme Esprit solide en Intérieur solide (07 G92, texte identique). Qui a raison : le classeur / le docx / autre ?
- **MAJ-M12.** Fer brillant (Arcane, 04 V69 : « +10 dégâts ») porte-t-il le mot-clé « Sort fer » comme les 13 de R164 (donc concerné par Cuivre, et par « Brutale » +2) ? Oui / non.
- **MAJ-M13.** Anti-Alliage (12 BK92 : « bloque l'effet secondaire des matériaux … Ne bloque leur bonus de dégâts ») : faut-il lire « Ne bloque pas leur bonus de dégâts » ? Oui / non, le texte est voulu tel quel.
- **MAJ-M14.** En initiative groupée (IG), la valeur écrite (« +2 INI (+1/NM) » de Nerveux, « -5 INI (-2/NM) » de Pichenette) s'ajoute-t-elle telle quelle au premier jet d'initiative ? Oui / non, autre valeur à préciser (la durée n'est pas écrite).
- **MAJ-M15.** Le texte « Classe unique = Archimage » du Potentiel illimité (02 A26, inchangé) est-il obsolète d'après le docx (« Il n'est plus obligatoire d'avoir la classe archimage quand on est potentiel illimité ») ? Oui (docx) / non. Sans Archimage, le PI n'a jamais « Semi-complet », donc plafond NPM 3 (R188).
- **MAJ-M16.** Boules plasmiques : le coût est-il 5 par boule (cellule 14 Q71 : « 5/boule ») ou 6 (docx : « coûte 6 chakra par boule ») ? 5 / 6.
