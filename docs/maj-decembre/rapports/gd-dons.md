# gd-dons (af8c2852137036678)


---

## Rapport 1 sur 1

Statut : partiel. L'analyse est complète. Elle s'arrête sur 11 questions au propriétaire (MAJ-C1 à C11) et sur des textes que les extraits ne contiennent pas : le Sommaire, les onglets Archimage et Parleur, et la matrice d'accessibilité des classes. Rien n'est écrit dans le dépôt.

Base lue : copie `/tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/base-gdc.db`, construite par `db-build` et `db-derive`. Les tables de fiches sont vides. Je ne peux donc pas compter les fiches touchées.

## Fait

**1. Boxeur et Porte-étendard (onglets 24 et 23)**

Les deux onglets ont la grille exacte d'un onglet de classe (P4, P11, P49 pour les niveaux 1, 5 et 20 ; D22 et AA22 pour les cartouches ; lignes 29, 36 et 43 pour les choix). Chacun donne 17 dons, comme le Cuirassé : 1 + 1 + 2 cartouches + 4 + 4 + 4 + 1. R43 (2 spécialités) et R44 (niveaux 1, 5, 10, 15, 20) sont respectées. Santé + chakra + barrière = 10 dans les deux cas, comme les 39 classes actuelles.

| Champ de la base | Boxeur (24) | Porte-étendard (23) |
|---|---|---|
| Santé / chakra / barrière | E3 = 8, E4 = 2, E5 = 0 | E3 = 5, E4 = 0, E5 = 5 |
| Maîtrise d'arme (A7) | « 1 maîtrise Pugilat » (forme nommée) | « 1 maîtrise Hast » et « 1 maîtrise dans une arme contact au choix (sauf hast) » (même forme que le Cuirassé) |
| Maîtrise d'armure (A11) | Légère ; Bouclier classe 1 à 4 | Légère à Intermédiaire, sans bouclier (donc `bouclier_classe_max` NULL) |
| Inventaire (G3) | P fiole rouge, KDR Armure, briquet, bandage (x2), corde (x5) | P fiole rouge, KDR Arme, KDR Armure, briquet, lanterne |
| Arme / armure de départ (G7, G11) | Gants en Acier ; Écu bois | Lance en acier ; Armure de fer complet |
| Spécialités (A17, X17) | CARCASSE ROUILLÉE, PERCUTEUR | CHEF DE GUERRE, STRATEGE DE BATAILLE |
| Niveau 1 | Bouclier d'attaque (P5), passif | Motivation (P5), action 2 fois/combat |
| Niveau 5 | Mur (P12), passif | Chef résiliant (P12), passif |
| Niveau 20, don de classe | Égide d'assaut (P50), passif | Au delà des limites (P50), action 1 fois/combat |

- Cartouches de niveau 10 : Boxeur D23 et AA23, Porte-étendard D23 et AA23. Les choix de niveaux 10, 15 et 20 sont aux lignes 29-34, 36-41 et 43-48 de chaque onglet.
- Aucune note de cellule dans ces deux onglets (seulement des formules). Les `remarque` restent donc vides. Aucun bloc « CHOSE A SAVOIR » (colonne Z) : `chose_a_savoir` reste NULL.
- Lecture par les outils existants :
  - « +10% Diplomatie OU Intimidation » et « Observation OU Distinction » sont des compétences connues ; `lib/acquis-texte.mjs` sait lire « X OU Y ».
  - « Maîtrise les armures lourdes » (Carcasse rouillée, 24!D23) existe déjà dans Zélote et Maître d'arme.
  - Toutes les compétences nommées existent dans la table `competence`.
  - Les objets lanterne, briquet, bandage, KDR Arme et KDR Armure existent au glossaire. « corde (x5) » ne s'y rattache pas (glossaire : « Corde (5-10m) ») : `objet_depart_id` resterait NULL, comme l'actuel « corde (5m) ».
  - `arme_depart` et `armure_depart` sont du texte libre. « Armure de fer complet » ne suit pas le nom `Armure Matériau/Matériau` de la table `armure` : elle reste telle quelle.
- Postures : la base connaît déjà les six (mot-clé 290, `posture_effet`). Les dons du Stratège (23!X30, AE30, X37, AE37, X44, AE44) les imposent à un allié ou à un ennemi désigné. La base n'a pas cette mécanique, c'est une règle nouvelle.
- Mots-clés absents du glossaire, utilisés sans définition :
  - « EdG » et « BdC » (23!D23), que rien ne définit ;
  - « avantage » et « désavantage » (3 dons existants s'en servent, aucun mot-clé) ;
  - « cran » (employé pour la posture Focus, sans mot-clé) ;
  - « tomber à terre » (Boxeur 24!AG44 ; les dons existants disent « au sol » ou « tomber au sol »).
  Aucun nouveau terme de règle n'est défini par ces onglets. « Étourdi » est un état existant. « Attaque d'opportunité » (Repli !), « zone d'influence », « Défense partielle » et « altération d'état » ont déjà leur mot-clé.
- Races : aucune source dans les extraits. La matrice `race_classe` vient de la fiche auto V15.2.2 (27 races × 39 classes). Sans ligne, la règle `classe_inaccessible` de `v_personnage_controle` (`data/schema.sql:5009`) signale les deux classes pour toutes les races. Seuls les onglets de races donnent deux indices : Gémidien « Accès à toutes les classes » (22!H16) et Fongoïde « Classe barde et parleur interdite » (21!H19).
- Coquilles dans les textes sources : « Description Carcasse rouillé » (24!AM17), « Bouragé » (24!Z29, noms de dons en « Bou… »). R9 (noms qui se répondent) ne s'applique pas : aucun nom n'est coupé sur deux cases. Les coquilles relèvent des registres d'orthographe, pas de moi.

**2. Cuirassé V2 (onglet 25) contre la base**

J'ai comparé don par don avec `capacite` pour `classes/cuirasse`. Seuls les accents et accords diffèrent, sauf ce qui suit.
- **Vindicatif, niveau 15** : « Appui » (ligne 36, rang 1, réaction) devient « Écrasant » (25!C36 ; effet A37 ; type A41, passif) : « Inflige +5 dégâts si la cible de l'attaque à moins d'AP total. » « Aucune fuite » reste en place.
- **Protecteur, niveau 20** : « Large » (passif, « Les diagonales sont comptées dans la zone d'influence. ») disparaît. « Appui » (25!AG43, texte AE44, type AE48 réaction) prend sa place : ligne 43, rang 2, même effet qu'aujourd'hui (« Permet d'intervenir quand un allié à 3 cases se prend un coup. »). C'est bien ce que dit la mise à jour (`MISE-A-JOUR-DECEMBRE.md` l. 171 et 173).
- **Écarts que la mise à jour n'annonce pas** :
  - Nanochakra (25!Z29 et X30) : « récupérer 1d8 barrière » ; la base et le V7 disent « 1d8 santé » (`capacites/cuirasse-nanochakra`).
  - Armure de départ (25!G11) : « Armure de Cellulose/Argent, Écu de bois » ; la base dit « Armure de Fer/Bronze, Bouclier Rond Corail ».
- **Ce qui ne change pas** : santé, chakra, barrière (10, 0, 0), maîtrises, inventaire, arme de départ, « CHOSE A SAVOIR », descriptions, Défensif et sa remarque (25!P5), Aisance int.
- **R42** (supprimé : retiré des fiches avec une note datée ; modifié : conservé). Les identifiants de capacité sont `capacites/<classe>-<nom>`.
  - **Large** (`capacites/cuirasse-large`) est supprimé : il part des fiches des Protecteurs qui l'ont choisi, avec la note datée.
  - **Appui** (`capacites/cuirasse-appui`) garde le même identifiant, mais change de spécialité, de niveau, de ligne et de rang.
    - Sa spécialité devient Protecteur. Une fiche de Vindicatif qui l'avait choisi le garderait donc hors spécialité : la règle `capacite_hors_classe` (`schema.sql:5183`) la signalerait.
    - Traiter Appui en « modifié » ou en « supprimé puis recréé » donne deux résultats différents sur les fiches : c'est MAJ-C7.
  - **Écrasant** est nouveau (`capacites/cuirasse-ecrasant`). La table `personnage_capacite` ne stocke que les dons à choix, tous concernés ici.
  - **Ordre de pose.** L'index unique `capacite_emplacement` oblige à supprimer Large, puis à déplacer Appui, puis à poser Écrasant dans l'emplacement libéré.

**3. Parleur**
- En base : `categorie_id = classe-physique-corps-a-corps`, `ordre` 11, santé 0, chakra 0, barrière 10 (requête sur `classe`).
- **Le site le range déjà sous « Spéciales ».** `client/src/lib/class-groups.mjs:31` pose `CLASS_OVERRIDES = {'classes/parleur': 'speciales'}`, une exception décidée par le propriétaire, sans numéro R (`docs/content-guide.md:557`). Les tests `class-groups.test.mjs`, `classes-html.test.mjs` et `fiche-regles.test.mjs` la figent.
- Le groupe « Spéciales » du site réunit déjà `hybride` (Flagelleur) et `speciale` (Archimage). Dans la source V7, le Flagelleur est en « Classe Hybride » (Sommaire G2), pas en « Classe spéciale ». La phrase « comme pour Archimage et Flagelleur » décrit donc le regroupement du site, pas deux catégories identiques.
- Ce que « rejoindre les spéciaux » change :
  - `classe.categorie_id` et le mot-clé de page de Parleur (`cac` devient `speciale` ou `hybride`, via `MOT_CLE_DE_CATEGORIE` dans `classe-champs.mjs`) ;
  - `CLASS_OVERRIDES` devient inutile ;
  - `classe.ordre` (unique, suit le Sommaire) est à renuméroter.
- Ce qui ne change pas : l'AM. R6 et R7 ne concernent que les classes magiques ; `am_base` est NULL pour le Parleur comme pour les autres classes physiques, et `guide-fil-rouge.mjs:45` reste correct. Le Parleur n'est pas une classe magique. La couleur et l'ordre d'affichage du site ne bougent pas.

**4. Archimage**
- Aujourd'hui, `classe_maitrise_arme` (source « Classe Maverick V7 › Archimage › A7:F9 ») donne deux lignes :
  - rang 1, « 1 maîtrise arme à distance au choix » : forme `au_choix`, catégorie `distance` ;
  - rang 2, « 1 maîtrise de Bâton » : forme `nommee`. La table `maitrise_arme_part` en tire une part `imposee` sur `baton-de-combat`, de source `classes/archimage#maitrise-arme:2`.
  - Autres textes : `arme_depart` = « Arme à distance au choix en fer et Bâton de fer » ; `maitrise_armure` = « Comment ça une armure ? ».
- La nouvelle ligne : rien de plus que la phrase de la mise à jour (l. 177), car l'onglet Archimage n'est pas dans les extraits.
- **« De contact » est sourcé.**
  - R127 (consigné en `arme_famille.categorie`) donne comme contact : Épées, Dagues, Masse/Marteau, Hache, Lance/Arme d'hast, Pugilat et Bâton de combat. Les quatre autres (Arc, Arbalète, Arme de jet, Bombes) sont à distance. R151 : « corps à corps » = contact.
  - La forme `au_choix` / `contact` existe déjà : l'Élémentaliste de l'Archimage lit « +1 point de maîtrise d'arme de contact » avec ces sept familles.
  - Le Bâton de combat est donc une des sept options, ce qui s'accorde avec « au choix au lieu du bâton imposé ».
- Conséquences :
  - La ligne rang 2 change de forme : de `nommee` à `au_choix`, sans « sauf ». Sa part passe de `imposee` à `choix`, avec 7 familles. La source `classes/archimage#maitrise-arme:2` est conservée.
  - Les fiches d'Archimage existantes perdent le point Bâton automatique et ont un choix en attente (R148).
  - L'Archimage aura deux lignes `au_choix`. `ligneAuChoixDeLaClasse` (`fiche-moteur.mjs:631`) rend alors NULL (une seule ligne attendue). Cela ne touche aucun don de l'Archimage : Élémentaliste et Occultiste sont des parts de type `choix`, pas `suit`.
  - Le plafond de 4 points par famille (R149) joue : la ligne rang 2, l'Élémentaliste, et le Bâton du Moine pourraient s'additionner.
- **« Plus obligatoire d'avoir la classe archimage » (l. 179) contre les décisions :**
  - **R23, partie « imposée »** : elle tombe. Le texte de la source (« CHOSE A SAVOIR » de l'Archimage, Z2) disait « imposée quand vous êtes du potentiel illimité ». Restent à retirer : la règle `classe_imposee` (`schema.sql:5025`), `classeImposee` et `classesSelonLaMagieInnee` (`fiche-moteur.mjs:126`, qui insère l'Archimage en classe 1), le test de `refusClasse`, le verrou de `fiche.mjs:368`, le libellé de `fiche-controles.mjs:10`, les commentaires de `classe.magie_innee_id` (« RÉSERVE et IMPOSE ») et `docs/character-generator.md:652`, 675 et 1205.
  - **R23, partie « réservée »** (pas d'Archimage sans Potentiel Illimité) : non annoncée comme changée, donc inchangée. À confirmer (C11).
  - **R25** : la décision porte déjà « toute classe, sauf le Mage Bleu » en bi-classe et en seconde classe. Elle devient la règle de la classe 1 aussi. Le Mage Bleu fermé au Potentiel Illimité reste, rien ne dit le contraire.
  - **R176** (le Potentiel Illimité est toujours la magie innée, mono-magie) : inchangée.
  - **R188 et R189** : inchangées. « Semi-complet » (niveau 20 de l'Archimage) et « Grimoire » (niveau 5) sont des dons de l'Archimage. Un Potentiel Illimité sans Archimage reste plafonné au NPM 3 et n'a pas d'emplacement « Grimoire ». C'est cohérent avec « toujours recommandée pour optimiser cette magie ». R225 (5 santé par niveau au plus) n'est pas liée à la classe.
  - **R6** : l'Archimage reste « spéciale » et classe magique (+4 AM). Un Potentiel Illimité d'une autre classe n'a pas ce +4.
- **Contradiction restante avec les sources.** La page du Potentiel Illimité, copiée dans l'onglet 02 de la mise à jour (02!A26), écrit toujours « Classe unique = Archimage. » et « Impossible de porter des armures lourdes… même si la classe vous le permet ». C'est identique à `magie.explication` en base. Voir C11.

## Reste
- Non analysé, faute de source dans les extraits :
  - le Sommaire de la nouvelle version (catégories, ordre des classes, place du Parleur) ;
  - le texte exact de l'onglet Archimage mis à jour (A7, G7, Z2) ;
  - la matrice d'accessibilité aux classes de la nouvelle version.
- Je n'ai pas reçu le diff scripté du `leader-technique` ; mon propre repérage couvre le Cuirassé (cellules ci-dessus).

## Pour les autres
- **`leader-technique` (puis `tech-sources`, `tech-db`, `tech-front`, `tech-skills`)**
  - `tech-sources` : lire les originaux Google (R83), car ils font foi. Il faut le Sommaire, l'onglet Archimage (A7, G7, Z2), l'onglet Parleur et la matrice « Accessibilité de Classe ».
  - `tech-db` : une migration pour les deux classes (ids probables `classes/boxeur` et `classes/porte-etendard`, à confirmer), le Cuirassé (ordre Large → Appui → Écrasant), le Parleur (`categorie_id` ; renuméroter `classe.ordre`) et l'Archimage (ligne rang 2). Aussi le retrait de la règle `classe_imposee` et la mise à jour des commentaires de schéma. Les nouveaux emplacements d'import suivent la même grille que le V7.
  - `tech-front` : retirer `CLASS_OVERRIDES` et mettre à jour `docs/content-guide.md:557`.
  - Anticiper l'importeur : la ligne « 1 maîtrise dans une arme contact au choix  (sauf hast) » du Porte-étendard (23!A7) a deux espaces et « hast » en minuscules.
- **`gd-fiche`**
  - Retrait de l'imposition de l'Archimage (liste ci-dessus) ; tests `personnages-db`, `fiche-moteur`, `r188-r189-npm-et-grimoire`.
  - Choix de maîtrise en attente de l'Archimage (rang 2).
  - Retraits R42 de Large et d'Appui.
  - Vérifier que les dons du Porte-étendard et du Boxeur se lisent par `acquis-texte` (« OU », « Maîtrise les armures lourdes »).
  - Deux lignes `au_choix` de l'Archimage.
- **`gd-races`** : Fongoïde interdit Barde et Parleur (21!H19), donc lignes `race_classe` à 0 pour ces deux classes. Gémidien « Accès à toutes les classes » (22!H16). L'accessibilité du Boxeur et du Porte-étendard pour les 29 races (27 + 2 nouvelles) n'est pas sourcée.
- **`gd-mecaniques`** : postures imposées à un allié ou à un ennemi désigné (Stratège de bataille) ; vocabulaire « avantage », « désavantage », « cran », « à terre » / « au sol ». L'interaction du Boxeur avec R96 (C5).
- **`gd-magies`** : la ligne « Classe unique = Archimage. » de la page du Potentiel Illimité (C11) ; l'onglet 02 est dans la mise à jour.

## Questions (propriétaire, sauf mention)

Contexte de tout le volet : la mise à jour de Décembre ajoute deux classes et modifie le Cuirassé, le Parleur et l'Archimage.

- **MAJ-C1 (bloquante pour le Boxeur et le Porte-étendard).** Les onglets 24 et 23 ne disent ni la catégorie ni la place dans le Sommaire (colonne de classe, rang parmi les autres). Dans quelle catégorie du Sommaire va chacune ?
  - (a) « Classe Physique Corps à Corps » pour les deux, en fin de colonne.
  - (b) Autre : la préciser.
  - Une réponse fixe `categorie_id` et `classe.ordre`, donc l'ordre de la fiche.
- **MAJ-C2 (bloquante pour la fiche).** Quelles races peuvent prendre le Boxeur et le Porte-étendard ? Rien dans la mise à jour. Sans réponse, la fiche signale ces classes pour toutes les races. Indices : Gémidien « Accès à toutes les classes » (22!H16), Fongoïde « Classe barde et parleur interdite » (21!H19).
  - (a) Toutes les races, y compris Fongoïde et Gémidien.
  - (b) Une liste à fournir.
- **MAJ-C3.** Que veulent dire « EdG » et « BdC » dans 23!D23 (Chef de guerre : « le bonus donné par l'EdG ou la BdC dure un tour de plus ») ? Aucun don de l'onglet ne porte ces noms. Quels dons désignent-ils ?
- **MAJ-C4.** Le Porte-étendard bénéficie-t-il de ses propres bonus d'« alliés » (Motivation 23!P5, Chef résiliant P12, Chef agile H30, etc.) ?
  - (a) Oui.
  - (b) Non, seulement les autres.
- **MAJ-C5.** Le Boxeur lit l'AP et l'AM du bouclier hors parade : « Bouclier d'attaque » (24!P5, dégât bonus = (AP+AM du bouclier) ÷ 4), « Mur » (P12), « Boucassant » (X44). R96 dit que ces valeurs ne comptent qu'en parade partielle. Est-ce une exception voulue pour le Boxeur ?
  - (a) Oui, exception pour ces dons.
  - (b) Non, R96 s'applique.
- **MAJ-C6.** Lectures chiffrées du Boxeur, en réponse libre ou par oui/non :
  - « poids du bouclier » (X30, X44) = 1 (Léger) à 4 (Très lourd), comme R92 ?
  - arrondi du « divisé par 4 » (minimum 1) ;
  - « Les boucliers donne +2AP et AM » (P12) = +2 AP et +2 AM ?
  - « Posture inébran » (A43) est typée « Réaction (2 fois/combat) » (A48) alors que son effet est passif : le type est-il correct ?
  - « se met automatiquement en défense » (H44) = posture Défensif ?
- **MAJ-C7.** Cuirassé : Appui passe de Vindicatif niveau 15 à Protecteur niveau 20, Large disparaît, Écrasant est nouveau. Les Vindicatifs qui avaient choisi Appui :
  - (a) on le retire de leur fiche avec la note datée de R42 : ils rechoisissent Écrasant ou Aucune fuite ;
  - (b) on le garde (modifié = conservé), et la fiche le signale comme hors spécialité.
- **MAJ-C8.** Cuirassé V2 contient deux changements non annoncés dans la mise à jour. Les applique-t-on ?
  - Nanochakra (25!X30) : 1d8 barrière au lieu de santé.
  - Armure de départ (25!G11) : « Armure de Cellulose/Argent, Écu de bois » au lieu de « Armure de Fer/Bronze, Bouclier Rond Corail ».
  - Réponses : (a) les deux, (b) aucun, (c) un seul.
- **MAJ-C9.** Parleur « rejoint les spéciaux comme Archimage et Flagelleur » : dans la source, ces deux classes sont dans deux colonnes différentes (Archimage « Classe spéciale », Flagelleur « Classe Hybride »). Quelle colonne du Sommaire pour le Parleur ?
  - (a) « Classe spéciale ».
  - (b) « Classe Hybride ».
  - (c) Une autre, à préciser.
  - L'affichage du site ne change pas (les deux colonnes sont « Spéciales »).
- **MAJ-C10.** Archimage : « maîtrise d'arme de contact au choix au lieu du bâton imposé ». Lecture proposée : la ligne « 1 maîtrise de Bâton » devient « 1 maîtrise arme de contact au choix », parmi les 7 familles de contact de R127, Bâton de combat compris. Confirmez-vous, et que devient l'arme de départ « Arme à distance au choix en fer et Bâton de fer » ? Pour les fiches d'Archimage existantes : le point Bâton est-il rechoisi (réponse proposée) ou repris d'office ?
- **MAJ-C11 (au `game-design`, qui peut trancher les points a et b s'il y voit une décision existante).** Archimage et Potentiel Illimité. Une fois l'imposition de l'Archimage retirée :
  - (a) l'Archimage reste-t-elle fermée aux personnages sans Potentiel Illimité (R23, partie « réservée ») ?
  - (b) le Mage Bleu reste-t-il fermé au Potentiel Illimité (R25) ?
  - (c) que devient la ligne « Classe unique = Archimage. » de la page du Potentiel Illimité (02!A26, `magie.explication`) ? La conserver telle quelle, la retirer, ou donner un texte. Pour le « CHOSE A SAVOIR » de l'Archimage (Z2), le texte à jour est à lire dans l'original (`tech-sources`).
