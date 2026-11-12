# gd-races (a7a257e9d330c42bf)


---

## Rapport 1 sur 1

Statut : fait (lecture seule). Dix questions pour le propriétaire (MAJ-R1 à MAJ-R10), dont aucune ne bloque l'analyse. Elles bloquent la création des deux races.

**Méthode**
- Les onglets 21 et 22 sont lus dans `.../maj-decembre/extraits/onglets/`. Les onglets 02 (PI), 05 (Corruption), 20 (Mode Hyper), 23 et 24 sont lus aussi.
- J'ai construit ma base dans `/tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/base-gdraces-F9bo2Q.db`.
- `db-derive` a échoué (paquet `yaml` absent). Je n'ai lu que des tables et vues de base, pas les tables dérivées.
- Aucune modification faite sur le site de dev ne touche ces Modes Hyper : `historique_modification` n'a aucune ligne `mode_hyper_effet` pour Felfe ou Elfe argenté.

**1. Fongoïde (onglet 21) et Gémidien (onglet 22), champ par champ**

| Champ de la base | Fongoïde | Gémidien |
| --- | --- | --- |
| `description_generale` | A4 | A4 |
| `histoire` | AK3 | AK3 |
| `description` (physique et culture) | AK30 | AK30 |
| Santé / Chakra / Barrière | H13=5, U13=10, AG13=5 | H13=10, U13=10, AG13=0 |
| `vitesse_sol` / `vitesse_nage` | **absentes** | **absentes** |
| Avantages | H16 « Accès à toutes les magies. » | H16 « Accès à toutes les classes » |
| Inconvénients | H19 « Ne possède pas la parole, Classe barde et parleur interdite. » | H19 « Mono-magie uniquement, Magie potentiel illimité et corruption interdite » |
| Don de base | H22 | H22 |
| Don de race | « Conscience collective » (H27, une fois par scène) | « Gemmoïde » (H27) |
| Mode Hyper | « Unité » (H32) | « Surcharge élémentaire » (H32) |
| Ethnies et dons par ethnie | tableau « Magie innée / Don » A50:AJ65, **colonnes Don vides** (F52:R65 et X52:AJ65 fusionnées sans texte) | aucun tableau |

- **Mise en page.** Les deux onglets suivent l'onglet « Modèle » du classeur « Les races » (Santé en A13, Chakra en M13, Barrière en Z13, sans « Vitesse Sol/Nage »). Les 27 onglets existants ont tous « Vitesse Sol/Nage ».
- **Colonnes obligatoires.** `race_onglet.vitesse_sol` et `vitesse_nage` sont `NOT NULL`.
- **Notes de cellule.** Il n'y en a aucune dans les deux onglets.
- **Dons de race.** Les deux dons sont de forme `unique` (comme Lamia, Majin, Hujin).
- **Restrictions de caractéristique, AP/AM naturels, « Divers ».** Rien n'est écrit : aucune ligne n'est à créer.
- **Gémidien, magies innées.**
  - H19 exclut PI et Corruption. AK3 dit « une seule magie » et A4 dit « pas accès au potentiel illimité ».
  - Il reste 13 magies innées possibles.
  - « Mono-magie uniquement » se lit comme R28 (`race.mono_magie=1`, aucune magie acquise).
  - L'interdiction de la Corruption vient de l'onglet, pas de R15, car R15 la permettrait en innée d'une race mono-magie.
- **Fongoïde, magies innées.**
  - H16 dit « toutes les magies ». Le tableau A52:W65 liste 14 magies, sans PI. L'onglet 02, ligne 22, limite le PI à 10 races, et le Fongoïde n'en fait pas partie.
  - Cela fait le même cas que Drassah'thac (R14) et Lamia (R22) : 14 magies innées.
  - La Corruption reste mono-magie (R15).
- **Don de base différent des autres races pures.**
  - Les deux onglets écrivent « Méditation (Action) (… 2d6 chakra …) » (H22).
  - Les 14 races pures ont en base « Méditation (Action 3 fois/jour) (… 3d6 + 6 chakra …) ».
  - La requête `group by don_base` sur `race_onglet` donne 14 et 13 races (Repos).
  - Le texte « 2d6 » est celui de l'ancienne fiche, dans `race.don_base_effets`.
- **Aucune trace dans les sources.** Le grep sur « fongo » et « gémidien » donne 0 dans la fiche auto V15.2.2, `les-races.json`, les classes, les magies et « Mode hyper et co ». Aucune matrice de fiche n'existe donc pour ces races. R8 et R13 ne s'appliquent qu'aux onglets.
- **Relations entre races.** Le classeur de Décembre n'a pas d'onglet « Relation entre les races ». La base a 69 peuples, et ces races n'y figurent pas.
- **Présentation.** La phrase de Sommaire (`race.presentation`) manque aussi.
- **Graphies.**
  - Noms : « Fongoïde » et « Gémidien », identiques à l'onglet, au titre (N1) et à la mise à jour. Les identifiants proposés sont `races/fongoide` et `races/gemidien`.
  - « Tempe/Espace » (A58 de l'onglet 21) est une coquille pour la magie « Espace/Temps ».
  - Les supers-gemmes sont écrites de trois façons : « Super Gemmes », « supers-gemmes », « Super gemme » (page de la base `lore/super-gemme`).
  - Il y a beaucoup de fautes d'orthographe (« humonoïdes », « prevue », « arbora », « ne peux pas »). Elles restent telles qu'écrites (registres `base-orthographe`).
- **Ce qui manque pour une race complète du site.**
  - La vitesse.
  - Les dons des 14 ethnies du Fongoïde.
  - La décision sur les ethnies du Gémidien.
  - Le don de base à trancher.
  - Les relations et la présentation.
  - Les lignes de matrice `race_classe` et `race_magie` pour ces races (voir 3).

**2. Elfe argenté et Felfe : Modes Hyper en base (version `onglet_race`, qui prime selon R13)**

| Race | Id | Nom | Effet en base | Adresse |
| --- | --- | --- | --- | --- |
| Elfe argenté | `onglet_race:races/elfe-argente` | « Sang argenté » | « Tous les sortilèges d'attaques sont imparables. » | `Les races › Elfe Argenté › Capacité Mode Hyper` |
| Felfe | `onglet_race:races/felfe` | « Surpuissance magique » | « Peut voler, les dégâts et soins magiques sont augmentés de 2d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2. » | `Les races › Felfe › Capacité Mode Hyper` |

- **Nouvelles phrases** (MISE-A-JOUR-DECEMBRE.md, lignes 5 et 7).
  - Elfe argenté : « Les sorts d'attaques imposent un désavantage sur les jets de défenses. » Elle remplace l'idée d'attaque imparable (l'effet de base tient en une phrase).
  - Felfe : « Les dégâts et soins magiques augmentent de 1d au lieu de 2d. » La mise à jour ne cite que ce morceau, le reste est inconnu (MAJ-R9).
- **Les deux autres lectures de la base restent à l'ancien texte** (import) : « Mode hyper et co › Mode Hyper » (A73:Y75 pour l'Elfe argenté, A82:Y84 pour le Felfe) et `Fiche auto V15.2.2 › Race › W`. Puisque l'onglet prime, seule la lecture `onglet_race` serait touchée.
- **Onglet 20 « Mode Hyper (Magie) » (caché).** Il ne contient aucune race. Un `grep` sur elfe, felfe, argent, race, imparable et défense ne donne rien. Il ne porte que les magies et « Avantages de base » (AZ2). Il n'y a donc pas de version de ces Modes Hyper dans le classeur.

**3. Règle d'or : combinaisons race × classe × magie**

- **R1 dit 27 races.** Il faudra une nouvelle décision pour 29 (numéro après R235).
- **Nombres figés à 27 dans le code, signalés au `leader-technique`.**
  - `ORDRE_DES_RACES` (`client/src/lib/race-kinds.mjs:48-53`).
  - Les tests `race-kinds.test.mjs:93-95`, `races-html.test.mjs:36-37, 132, 251` et `db-rang-des-races.test.mjs:45-47, 79`.
  - Les commentaires de `data/schema.sql` (« 27 races × 39 classes »).
- **Pures ou hybrides.** Aucune classe raciale n'est annoncée dans les onglets : les deux races sont pures.
- **Sourcé** :
  - Fongoïde × Barde et × Parleur = 0 (H19).
  - Gémidien × PI et × Corruption = 0 (H19 et A4).
  - Fongoïde × PI = 0 (onglet 02, ligne 22).
  - Sans PI, l'Archimage reste fermé par `classe.magie_innee_id` (R23). Mais la mise à jour dit « plus obligatoire d'avoir la classe archimage quand on est potentiel illimité » : cela change R23 (`classe_imposee`).
- **Non sourcé.**
  - Les autres classes générales des deux races : H16 du Gémidien (« toutes les classes ») est du genre que R8 appelle copier-coller, et le Fongoïde n'a aucune mention. L'état probable est celui des pures (26 classes accessibles dans `race_classe`).
  - Les 13 classes raciales : l'état probable est 0.
  - Boxeur et Porte-étendard × les 29 races. Les onglets 23 et 24 n'ont ni « CHOSE A SAVOIR » ni mention de race. Pour les 27 races existantes, rien n'existe non plus.
  - La seule exclusion existante, Médusain × Guerrier, Cuirassé et Frappeur, vient de la fiche (cases B23, C23, G23).
- **Volumes si on étend les matrices** : 29 × 41 = 1189 lignes `race_classe` (1053 aujourd'hui) et 29 × 15 = 435 lignes `race_magie` (405 aujourd'hui).
- **Preuve de l'état actuel.**
  - `race_classe` : 1053 lignes, 26 classes générales à 1 pour chaque race, sauf 24 pour le Médusain.
  - `race_magie` : 15 pour 10 races, 14 pour Drassah'thac, Lamia, Majin et Mort-vivant, 3 pour les 13 hybrides.

**Pour les autres**
- **`worldbuilding`**, à passer par toi :
  - les histoires AK3 des deux onglets ;
  - les descriptions AK30 (rites funéraires, parler en saisons, communication par pensée et parfums, gemme qui dépérit hors du corps) ;
  - les dates d'apparition (an 80 pour les Fongoïdes, an 70 pour les Gémidiens) ;
  - les dieux non nommés qui ont donné des capacités au Premier Champignon ;
  - le renvoi « Codex|Outils légendaires|Super gemme » (page `lore/super-gemme`).
  - Cohérence à vérifier : l'onglet 21 (A4) dit « le Dieu de la Terre s'est donné la mort » et AK3 dit « la Mort Fertile n'existe plus ». La source des lieux (`sources/raw/1tH-T9k-…md`, lignes 6559-6576) en fait la « zone centrale » de la Forêt Colossale. Le dieu Dimitri s'y laisse mourir après avoir tué la déesse du Vent.
- **`gd-fiche` / `leader-technique`** :
  - Surcharge élémentaire demande un choix par tour de Mode Hyper.
  - « Unité » parle de « croix » et de « barrière 10 % par tour ».
  - « Gemmoïde » s'écrit « (+2/5 niveau global) », alors que R110 vise « augmente de +N tous les M niveaux » : le format diffère.
  - La parole manquante (Barde et Parleur interdits) doit être une règle de classe.
  - La catégorie du Parleur change dans la mise à jour.

**Questions pour le propriétaire (numérotées MAJ-R…)**
- **MAJ-R1.** Les races passent-elles de 27 à 29 (Fongoïde et Gémidien, nouvelle décision remplaçant R1) ? Ces deux onglets sont-ils définitifs, sachant que le Sommaire de Décembre parle d'une « version en test » pour les magies ? Les ajoutez-vous au classeur « Les races » ? Réponse : oui, non, ou précisions.
- **MAJ-R2.** Quelle vitesse sol / nage pour chaque nouvelle race ? Les onglets n'en écrivent pas.
- **MAJ-R3.** Le don de base des deux races est-il (a) celui des onglets (« Action, 2d6 chakra »), ou (b) celui des 14 autres pures (« Action 3 fois/jour, 3d6 + 6 chakra ») ?
- **MAJ-R4.** Le Fongoïde a-t-il 14 magies innées (toutes sauf PI, comme R14 et R22) ?
- **MAJ-R5.** Le Fongoïde a-t-il 14 ethnies (une par magie innée) ? Quels sont leurs 14 dons (colonnes vides) ? Sinon, une seule ethnie ?
- **MAJ-R6.** Le Gémidien a-t-il une seule ethnie « Gémidien » (comme Lamia, Majin, Hujin) ou une par magie ? A-t-il 13 magies innées, sans PI ni Corruption, et aucune acquise (comme R28) ?
- **MAJ-R7.** Fongoïde : 24 classes générales accessibles (hors Barde et Parleur) et aucune classe raciale ? Gémidien : les 26 générales comme les pures (l'Archimage reste fermé sans PI) ? Réponse : oui, non, ou liste.
- **MAJ-R8.** Boxeur et Porte-étendard sont-ils accessibles aux 29 races, ou avec quelles exclusions (Médusain, Fongoïde) ?
- **MAJ-R9.** Pour l'Elfe argenté, la nouvelle phrase remplace-t-elle tout l'effet ? Pour le Felfe, le texte devient-il « Peut voler, les dégâts et soins magiques sont augmentés de 1d, ceux qui doivent faire des jets pour esquiver les effets secondaires des sorts ont leur score divisé par 2. » ?
- **MAJ-R10.** Les deux races restent-elles sans relations avec les 69 peuples, et sans phrase de présentation, tant que le classeur de Décembre n'en fournit pas ?

Aucun fichier modifié.
