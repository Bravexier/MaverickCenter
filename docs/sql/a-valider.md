# Ce qu'il reste à valider sur la base de données

Deux listes : les **choix de forme** du schéma (ce que tu peux relire dans [`apercu.md`](apercu.md)) et les **questions de contenu** que les sources ne tranchent pas.
Les décisions déjà prises sont dans [`../decisions-regles.md`](../decisions-regles.md) (R1 à R20) ; la conception complète est dans [`conception.md`](conception.md) (§2 conventions, §12 points ouverts).

## 1. Choix de forme du schéma

| # | Choix | Pourquoi | À valider |
| --- | --- | --- | --- |
| F1 | **Identifiants texte lisibles et stables**, jamais d'auto-incrément : une page = `<type>/<slug>` ; une entité qui a sa page réutilise l'id de la page ; une sous-entité = `<page>#<sorte>:<slug>` ; un référentiel garde sa clé courte (`force`, `epee`) | Un identifiant doit survivre à un réimport et à une bascule d'hébergement ; une page renommée garde son identifiant (redirection) | Renommer une capacité ou un sort dans un classeur change son id : acceptable ? |
| F2 | **Absent = `NULL`**, jamais une valeur par défaut inventée. Une colonne typée (nombre, énumération) n'existe que si la forme est sans ambiguïté ; sinon `NULL` et la colonne `*_brut` garde le texte de la source | Règle d'or : ne pas déduire | Les colonnes typées qui te semblent trop audacieuses |
| F3 | **Quand deux sources se contredisent, les deux lectures sont gardées** (table `ecart_source`, ou colonnes côte à côte). La base ne tranche pas | Les décisions sont les tiennes (`decisions-regles.md`) | Voir la liste du §2 : lesquelles trancher pour que la base n'ait plus qu'une valeur |
| F4 | **Provenance sur chaque ligne** : `origine` (famille d'import) et `source_ref` (« classeur › onglet › plage ») | Retrouver la cellule d'origine, réimporter une famille sans toucher aux autres | Le niveau de détail de `source_ref` (plage de cellules, pas la section d'un Google Doc) |
| F5 | **`page.corps_md` garde le texte de la source** ; les tables typées sont la vue structurée de la même entité (relation `page_entite`) | Le texte cité tel quel reste la référence ; les simulations auront des données structurées | Le Markdown ne devient pas une présentation générée des tables (choix par défaut) |
| F6 | **Références génériques sans clé étrangère SQL** : `page_entite`, `note_cellule`, `ecart_source` visent `(table, id)`, car une même table sert à toutes les entités | Évite une table de liaison par table d'entité (37 aujourd'hui) | Contrôlées par `npm run db:check`, pas par SQLite. Acceptable ? |
| F7 | **Champs structurés encore dans `page.donnees` (JSON)** pour les pages non portées (`magies_innees`, `nom_court`…) | Rien perdu en attendant les importeurs de famille | Quand ils sont portés, ces valeurs quittent le JSON pour les tables |
| F8 | **Noms ambigus conservés** : 13 noms sont à la fois une classe et une race (Anansi, Fenrir, Kitsune, Minotaure, Orios…) | Aucun `[[lien]]` actuel n'est concerné ; un futur `[[Anansi]]` sera signalé « ambigu » | **Décidé** : pas de suffixe « (classe) », supprimé de partout (demande du propriétaire, migration 0009) ; un lien se désambiguïse par le chemin (`[[classes/anansi]]`, `[[races/anansi]]`) |
| F9 | **Recherche plein texte par mots** (FTS5) : `ortée` ne trouve plus `portée` ; l'apostrophe sépare les mots ; `œ` n'est pas replié (`coeur` : 2 pages, `cœur` : 13) | Meilleur classement des réponses ; comportement actuel du site conservé pour `œ` | Replier `œ → oe` ? Garder la recherche par sous-chaîne (`LIKE`) en plus ? |
| F11 | **Colonne `remarque`** (texte libre, vide par défaut) dans chaque table d'entités (60 tables) : les notes de cellule des classeurs y sont recopiées, dans la ligne qu'elles commentent (la note de « Laser noir » est dans la ligne du sort). Plusieurs notes sur une ligne sont réunies, séparées par une ligne vide. La table `note_cellule` est **conservée comme trace** (cellule d'origine, nature : note ou commentaire résolu) | La remarque est ce qu'on lit et ce qu'on pourra éditer ; la trace permet de remonter à la cellule | Supprimer `note_cellule` ? Elle fait doublon tant que les classeurs sont la source ; un contrôle (`db:check`) garantit qu'aucune note n'est absente de sa remarque. À la bascule vers l'édition, la trace n'a plus d'utilité |
| F10 | **SQL portable** : seuls `STRICT`, `GLOB` dans quelques `CHECK`, `json_valid`, `instr`, FTS5 et les `PRAGMA` sont propres à SQLite | Une bascule vers PostgreSQL doit rester possible pour l'édition à plusieurs | Rien à faire maintenant ; équivalents listés dans `conception.md` §10.4 |

## 2. Questions de contenu

Le statut « décidé » veut dire que tu as tranché (`decisions-regles.md`) **mais que la base garde encore les deux lectures** : la décision n'y est pas appliquée.

| Domaine | Question | Statut |
| --- | --- | --- |
| Règles | « Calme » ou « Prouesse » (compétence de Volonté) | **décidé : Calme** (R4) |
| Règles | Mode hyper : quelle version fait foi (+15/+7 ou +10/+5), cinq lectures stockées dans `mode_hyper_effet` | **décidé : +15 / +7** (R5) |
| Règles | Total de points à répartir : égalité ou maximum | **décidé : exactement** (R3) |
| Règles | Puissance magique 5 au niveau 16 ou 17 ; plafond de caractéristique aux niveaux 5, 10, 15 ; sens des deux « croix » ; entraînement 10 % par compétence ou au total | ouvert |
| Magies | Corruption : la phrase « mono magie uniquement » est-elle la règle, ou la liste de la fiche (Arcane, Sang, Espace/Temps seulement) ? Arcane et Corruption : résistance à elles-mêmes (fiche) ou à l'autre (V8, guide) ? (les pages de magie, le guide et le tableau des résistances de `/fiche/` suivent V8) | ouvert |
| Magies | Niveaux de maîtrise (migration 0004) : la lecture typée de quelques expressions ambiguës de `sort_bonus_maitrise` ; « /3NM » collé à une proposition en toutes lettres typé **palier à 3 NM** (Grenade cryogénique « gel 1/3NM », Échange « 3CK = 2BA/3NM », Planète chakratique « 1CK/3NM », Lame sous pression « ou verticales/3NM », comme les grenades voisines « 3NM = … »), « (x4/3NM) » typé par NM de pas 3, « (+1/NM) » sans unité écrite (Image diffuse, Aspect vide, Pichenette, Lame d'ombre) typé sans unité. Le texte de la cellule est conservé tel quel dans chaque ligne | ouvert |
| Magies | « D/S/B » non développé dans les sources ; 32 sorts sans chakra écrit ; noms d'états (« Gelé » / « Gel ») | ouvert |
| Magies | 26 fils de commentaires orphelins (cellules supprimées, certains textes sont des règles) ; 28 dieux dont 16 reliés à une magie | ouvert |
| Classes | Valeurs par niveau absentes (seul le niveau 1 est donné) ; « Don de départ » = niveau 1 ? ; les choix 10/15/20 dépendent-ils de la spécialité ? | ouvert |
| Classes | Archimage et +4 AM des classes magiques (y compris la 2ᵉ spécialité des classes raciales) | **décidé** (R6, R7) ; la base a `am_base` par catégorie et pas de booléen « magique » : à refléter |
| Races | 27 races ou 23 | **décidé : 27** (R1) ; la base en a 27 |
| Races | « Accès à toutes les classes / magies » contre la matrice de la fiche | **décidé : copier-coller, matrice retenue** (R8) |
| Races | Fautes de saisie de la fiche (« Felfle », « Satyre » avec espace) | **décidé : à corriger** (R10) ; relecture faite dans toute la base (migrations 0003, 0005 et 0006) ; les citations de la fiche dans les tableaux d'écarts et la colonne « Race » de l'onglet « Bonus Race » (`ethnie.race_brut`) restent telles quelles |
| Magies | Orthographe : 188 points laissés tels quels (mot manquant ou en trop, accord douteux, terme du jeu possible) ; les noms de sorts sont tranchés (0006) | **à valider** : liste dans [`orthographe-a-valider.md`](orthographe-a-valider.md) |
| Toute la base | Orthographe : 390 phrases laissées telles quelles par la passe complète (mêmes raisons) ; les 178 noms sont **tranchés** (décision du propriétaire, migration 0006) | **à valider** : liste dans [`orthographe-a-valider.md`](orthographe-a-valider.md) |
| Races | Sens de lecture de la matrice « Relation entre les races » | **décidé : la case (ligne A, colonne B) dit comment A voit B** (R12) ; vue `v_regard_peuple` |
| Races | Fiche V15.2.2 contre l'onglet de la race (valeurs de départ, don de base, mode Hyper, dons d'ethnie) | **décidé : l'onglet est la source, écarts non affichés** (R13) ; tables de l'onglet (migration 0007), la fiche reste dans `race`, `ethnie`… |
| Races | Capacité hyper : deux versions (fiche, guide) divergent pour 8 races ; bonus d'ethnie issu de formules (faux positif probable : Elfe forestier Forêt +3 AP) | la page suit l'onglet (R13 : version `onglet_race`) ; bonus d'ethnie de la fiche : ouvert |
| Bestiaire | Sigle FPVSIA non défini (« NPM » = niveau de puissance magique, et le « EP » des marionnettes en est une faute du classeur : décision R53) ; 6 créatures aux résistances contradictoires ; « Golem d'Argile » sans créature ; 6 sorts cités sur 105 introuvables (3 variantes évidentes comme « Veilliessement ») | ouvert |
| Métiers | Après les décisions R33 à R40 (migrations `0024-metiers-fiche`, `0025-metiers-precisions`) : Survie du Prostitué (R36), vitesses (R37), plafond d'Acquis qui prévaut sur le bonus (R38), croix et artisanat (R39), options des équipements à choix (R40) sont **décidés**. Restent : (1) un objet « (Arme) » va dans l'inventaire, pas dans un emplacement d'arme ; (2) l'Artisan (« Un peu tout ») n'a pas de caractéristiques d'artisanat ; (3) « Démarre avec une pioche en acier (arme) » (Mineur) entre tel quel dans l'inventaire (à réécrire depuis le site de dev si besoin) | **à valider** ; la base applique la lecture indiquée |
| Équipement | 9 prix de matière incohérents ; deux listes de kits d'alchimie ; tests de fabrication en conflit (Forgeron, Enchanteur) ; unité des prix d'armure et de bouclier | ouvert |

Pour chaque question ouverte, la base garde les deux lectures (`ecart_source`) et laisse la valeur absente à `NULL` : rien n'est inventé en attendant ta réponse.

## 3. Fiches de personnages : bugs de la fiche auto et questions

La base des fiches (section 13, `docs/character-generator.md`, « Fiches dans la base ») suit la « Fiche personnage Maverick Auto V15.2.2 » **hormis ses bugs**. Bugs relevés dans ses formules, **non reproduits** :

| # | Cellule(s) | Ce que fait la fiche | Ce que fera la base |
| --- | --- | --- | --- |
| B1 | BDD!M14:Q14 | Le plafonnement des bonus d'accessoire de Volonté, Intelligence, Perception, Social et Agilité lit `Personnage!$E$18` (la Force) au lieu de la caractéristique de sa colonne (copier-coller de L14) | Chaque caractéristique avec sa propre valeur |
| B2 | Personnage!I63:L67 | Les dons de la **classe 2** s'ouvrent selon `$G$9`, le niveau de la classe 1 (une 2ᵉ classe d'un mono-classe, niveau 2 au niveau global 11, recevrait d'emblée ses dons de niveau 10 à 20) | Le niveau de la classe 2 (`v_personnage_niveau.niveau_classe_2`) |
| B3 | Personnage!L65 | Compare `$C$65` à la cellule `C65` de l'onglet de classe au lieu de `C64` (l'effet du 2ᵉ don de niveau 15 de la classe 2 ne s'affiche jamais) | La capacité choisie, lue dans `capacite` |
| B4 | BDD!H40, I40, BB2 | Liste des classes magiques écrite en dur (9 classes) ; la classe 2 n'a pas le bonus d'AM de sa spécialité ; les 2ᵉ spécialités des classes raciales et du Flagelleur (décision R7) sont oubliées | `categorie_classe.am_base` et `lib/classe-bonus.mjs` (R6, R7) |
| B5 | BDD!AK6 contre BDD!BB2 | Puissance magique 5 à partir du niveau **17** (`W8>16`) pour les paliers de sorts, mais du niveau **16** (`W8>=16`) pour le nombre de sorts | **Décidé : niveau 16** (R16) ; `v_personnage_controle` lit `niveau_global`, `seuil_niveau` garde la formule de la fiche comme trace |

La « Fiche personnage Auto Maverick V1.1 » du Drive (créée le 3 avril 2026, après la V15.2.2) a la même disposition (les cellules citées par la base y sont les mêmes). Elle corrige **B2** et **B3** (dons de la classe 2 au niveau de la classe 2), **en partie B4** (+4 AM de la 2ᵉ spécialité « Masochiste » du Flagelleur, mais pas des 2ᵉ spécialités des classes raciales, R7), et **ni B1 ni B5**. Elle ajoute des calculs absents de la V15.2.2 (+3 Atk du Guerrier, +10 avec « Hyper contact » ; portée +1 des armes de mêlée du Hujin ; XP du palier suivant), que le moteur reprendra de leurs dons.

La **V1.2** (2026-10-10, Drive du propriétaire : copie de la V1.1 qui lit les copies des classeurs) corrige B1 à B5 et les autres erreurs relevées depuis ; la liste, les cellules et ce qui reste à trancher (armure élémentaire, Mode Hyper des magies, matrice Arcane/Corruption) sont dans `docs/fiche-auto.md`.

Questions :

| # | Question | Ce que fait la base en attendant |
| --- | --- | --- |
| Q1 | Que signifient les deux cases à cocher de chaque caractéristique (H18, I18…) ? | **Décidé : les croix** (R19) : 1 croix = −20 % à tout test de la caractéristique, 2 = plus utilisable ; colonne `personnage_caracteristique.croix` (0 à 2) |
| Q2 | Corruption en **magie acquise** pour l'Elfe Noir Charbon et le Felfe Noir, que la fiche (BDD!F2) refuse toujours | **Décidé : permise** (R20, modification récente pas encore sur la fiche) |
| Q3 | Les personnages déjà en jeu, que les joueurs ont remplis dans leur copie de la fiche auto (Google Sheets) : faut-il les reprendre dans la base ? Le Drive accessible ne montre que les modèles (V15.0.5, V15.2.2, V1.1, « Proposition Fiche de personnage Maverick ») | Rien n'est repris d'office ; la page `/fiche/` importe une fiche auto téléchargée de Google Sheets (.xlsx, .ods, .csv : [`character-generator.md`](../character-generator.md), « Tableur ») |
| Q4 | Un joueur qui prend un **prétiré** dans un groupe joue-t-il la fiche partagée (son état en jeu, santé ou XP, est alors commun à toutes les tables qui l'utilisent) ou une **copie** qui devient sa fiche ? | Les deux sont possibles : `groupe_membre.personnage_id` accepte un prétiré, et une copie serait une fiche `joueur` ordinaire |
| Q5 | Quelle fiche auto fait référence : la V15.2.2, que cite la base, la V1.1, plus récente, ou la V1.2 corrigée (`docs/fiche-auto.md`) ? | La base cite la V15.2.2 (sa copie d'archive, migration 0014) ; ses cellules sont les mêmes dans la V1.1 et la V1.2 |
| Q6 | Paliers de résistance : le modèle « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » écrit « Grande résistance (dégâts subits ÷3) », « Grande vulnérabilité (dégâts subits x3) » et « Sensibilité (dégâts subits x4) » ; la fiche auto V15.2.2 (Personnage › BA4, BA10, BA12, et les deux fiches d'essai du propriétaire) écrit ÷4, x4 et x8. Lequel fait foi ? | La base garde ceux de la fiche auto (`resistance_palier`, ÷4, x4, x8 ; Immunité, Résistance ÷2 et Vulnérabilité x2 sont les mêmes partout) ; la page `/fiche/` les affiche et l'export en tableur les écrit à la place du texte du modèle (`docs/character-generator.md`, « Tableur ») |
| Q7 | Case « Entraînement » (L42) : le guide (« Fiche de personnage : Capacités/Dons ») y met les bonus d'entraînement (15 compétences, 10 % au plus), que le site ne distingue pas des autres acquis. Faut-il un champ « entraînement » dans la fiche du site ? | L'export la laisse vide ; l'import d'une fiche auto ne s'en sert que pour retrouver la compétence d'un accessoire « Compétence X » (remarque dans les notes) |
| Q8 | Métiers de la fiche auto différents de la base (Écrivain « 4% Connaissance » contre +3 % ; Acrobate « +2% Reflexe, Esquive et Ruse » contre « +3% Esquive, +3% Réflexe ») : à l'import, l'écart devient-il un acquis du joueur ? | L'acquis écrit moins le bonus de la base revient au joueur (Lucien : Connaissance 1 ; Louise : Ruse 2), avec une remarque par compétence que le bonus de la base touche ; Ruse, que la base ne touche pas, est reprise sans remarque |
| Q9 | Gains de niveau d'une fiche auto (la fiche n'écrit que les maximums de santé et de chakra) : garder une répartition reconstituée, ou laisser les gains vides en notant les maximums lus ? | Reconstitués (santé d'abord, dés sur le chakra, bornés par le dé écrit du niveau), avec la remarque « à vérifier » |
| Q10 | Solidité d'une arme (AK17, AX17 du modèle ordinateur) : l'écrire comme la page « Armes » la calcule (R51) ? | Case vide : la fiche ne calcule pas encore la solidité |
| Q11 | Les textes de règles trop longs pour leur case (effets des dons, descriptions des sorts) : les reprendre en entier dans la case NOTE ? | Coupés par « … » sans suite (le site les a en entier) ; la note ne garde que les données du personnage |

