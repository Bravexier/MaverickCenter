# Ce qu'il reste à valider sur la base de données

Deux listes : les **choix de forme** du schéma (ce que tu peux relire dans [`apercu.md`](apercu.md)) et les **questions de contenu** que les sources ne tranchent pas.
Les décisions déjà prises sont dans [`../decisions-regles.md`](../decisions-regles.md) (R1 à R13) ; la conception complète est dans [`conception.md`](conception.md) (§2 conventions, §12 points ouverts).

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
| F8 | **Noms ambigus conservés** : 13 noms sont à la fois une classe et une race (Anansi, Fenrir, Kitsune, Minotaure, Orios…) | Aucun `[[lien]]` actuel n'est concerné ; un futur `[[Anansi]]` sera signalé « ambigu » | Faut-il désambiguïser dès maintenant (`Anansi (classe)`) ? |
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
| Magies | Corruption : la phrase « mono magie uniquement » est-elle la règle, ou la liste de la fiche (Arcane, Sang, Espace/Temps seulement) ? Arcane et Corruption : résistance à elles-mêmes (fiche) ou à l'autre (V8, guide) ? | ouvert |
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
| Bestiaire | Sigles FPVSIA, « NPM », « EP » non définis ; 6 créatures aux résistances contradictoires ; « Golem d'Argile » sans créature ; 6 sorts cités sur 105 introuvables (3 variantes évidentes comme « Veilliessement ») | ouvert |
| Équipement | 9 prix de matière incohérents ; deux listes de kits d'alchimie ; tests de fabrication en conflit (Forgeron, Enchanteur) ; unité des prix d'armure et de bouclier | ouvert |

Pour chaque question ouverte, la base garde les deux lectures (`ecart_source`) et laisse la valeur absente à `NULL` : rien n'est inventé en attendant ta réponse.
