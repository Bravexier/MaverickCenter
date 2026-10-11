# Fiche de personnage

Deux pages (demande du propriétaire), branchées sur le service des personnages ([`serveur.md`](serveur.md)) :

| Page | Rôle | Fichiers |
| --- | --- | --- |
| `/fiche/` (et `/fiche/?id=<id>`) | **Créer et modifier** un prétiré, sur le même écran | `client/src/pages/fiche/index.astro`, `src/scripts/fiche.mjs`, `styles/fiche/fiche.css` |
| `/personnages/` | **Rechercher** les personnages : filtres, tableau trié par la colonne choisie | `client/src/pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs` |

L'ancienne adresse `/generateur/` mène à `/fiche/` (page 404, `lib/nav.mjs#nouvelleAdresse`). Dans le menu, la rubrique « Personnages » réunit
« Fiche de personnage » (`/fiche/`) et « Listes » (`/personnages/`), puis « Groupes » et « Chroniques » (bientôt).

## La page `/fiche/`

La fiche se remplit dans l'ordre du guide (« Créer son personnage »), une section par étape, numérotée et teintée de la couleur de sa partie du
guide : 1 race et ethnie, 2 magies et dieux, 3 classe(s) et spécialités, 4 caractéristiques, compétences et maîtrises d'armes,
5 sorts, 6 attributs, alignement, bourse, métier ; puis 7 gains de niveau et dons à choisir, 8 équipement (armes, armure, bouclier, accessoires,
inventaire), 9 état en jeu, notes, événements, et le contrôle des règles. **Compacte** (demandes du propriétaire) : pas de lien vers le guide ;
race, ethnie, magies innée et acquise, classes et spécialités sont des **menus déroulants** (`<details class="choix">` : fermé, le choix fait ; ouvert, les
**pastilles** dans les couleurs de `/races/`, `/magies/`, `/classes/`, celles que les règles ferment grisées ; un choix, un clic ailleurs ou Échap le
referme) ; les caractéristiques sont des **curseurs** bornés par la race, à 1 (le minimum) par défaut, jamais vides (`caracteristiquesCompletes`), et le
naturel et l'acquis des compétences des curseurs (naturel : jusqu'au maximum du niveau ; acquis : 5 par point de caractéristique de base), comme les
**maîtrises d'armes** (0 à 4 points, les dés dans la colonne « Dés » : `notationDesDes`) et les **valeurs du moment** (santé, chakra, barrière, corruption,
4ᵉ barre ; de 0 au maximum, au maximum tant qu'on n'y touche pas, la corruption à 0 ; le chakra actuel au plus chakra − corruption, sauf avec la magie de la
Corruption, et la corruption qui monte emporte le chakra actuel, celle qui baisse ne le rend pas : `valeursDuMoment`, `ecrireValeurDuMoment`, guide
« Fiche de personnage : Attributs »). Un **clic droit** sur un curseur (ou Entrée) le remplace par une case de saisie : le nombre tapé est ramené au
maximum au-dessus, au minimum en dessous (`borner`) ; Échap abandonne ; les **sorts**
sont un tableau d'une ligne par emplacement, sans emplacement en plus (décision R27), chacune avec la liste des sorts possibles moins ceux des autres lignes
(`lignesDeSorts`) ; les **NM** d'un sort se notent par origine (de niveau, d'un livre — un par sort —, du MJ), 3 au plus sur un sort (décisions R24, R26). L'en-tête porte
la **jauge d'XP** (`progressionXp`) : l'XP se modifie dans son champ ou s'ajoute avec le bouton +, le niveau suit. Une fiche enregistrée se **supprime**
(bouton « Supprimer », après confirmation ; retour à la liste des personnages). Chaque caractéristique, et le tableau de ses compétences, a sa couleur
(demande du propriétaire, `lib/caracteristiques-postures.mjs`, transmise par `regles.json` : `couleur` et `texte` de chaque caractéristique). Le **Potentiel Illimité** en magie innée met l'Archimage en classe 1
et l'y **verrouille** (les autres classes 1 sont grisées, la pastille de l'Archimage ne se retire pas) ; sans lui, l'Archimage est grisée à tous les rangs,
et quitter le Potentiel Illimité la retire (décision R23) ; le Mage Bleu lui est fermé, à tous les rangs (décision R25), toute autre seconde classe reste permise. Les dons à choix d'une classe ou d'une spécialité retirée partent avec elle. Tout ce que la base
garde d'une fiche se saisit (section 13 de `data/schema.sql`, ci-dessous).

- **Règles** : `/fiche/regles.json`, tiré de la base au build par `lib/fiche-regles.mjs` (races et leurs bornes, ethnies, magies, dieux, métiers, classes,
  spécialités, dons à choix groupés comme sur la page de chaque classe, sorts, tables de niveau, constantes, catalogues d'équipement), rien de recalculé.
- **Calculs pendant la saisie** : `lib/fiche-moteur.mjs`, fonctions pures (testées par `test/fiche-moteur.test.mjs`, contre les vues de la base et les
  personnages fil rouge du guide) : niveau global et niveaux de classe (R2) ; classes et magies innées que la race permet (R8, R11), classe réservée à une
  magie innée et imposée par elle (`classe.magie_innee_id` : l'Archimage et le Potentiel Illimité, R23), ethnies et ethnie sans choix posée d'office
  (`ethnieImposee` : la seule de la race — Lamia, Majin, Hujin, Elfe doré — ou la seule de la magie innée — races hybrides, Drakos ; demande du propriétaire),
  magie acquise refusée et pourquoi (race à une seule magie R28, incompatibilité, mono-magie R15, exceptions R20) et retirée d'office quand un changement de race
  ou de magie innée la ferme (`magieAcquiseValable`, demande du propriétaire) ; caractéristiques (+1 de la magie innée, bornes de la race) et budget exact (R3) ;
  scores de compétences (10 × caractéristique + naturel + acquis, croix R19), plafonds et budget ; gains de niveau attendus ; classe magique (R6, R7) ;
  attributs comme la fiche automatique (santé, chakra, barrière, vitesse, armure de base, initiative, 4ᵉ barre, Corruption) ; emplacements de sorts
  (conditions × puissance magique, R16), sorts possibles, NM ; dons à choisir selon la classe, la spécialité et le niveau de classe.
- **Contrôle** : à chaque enregistrement, le service rend les règles de `v_personnage_controle` que la fiche enfreint, affichées en français
  (`lib/fiche-controles.mjs`) ; une fiche ne passe « validée » que sans aucune. Ce que la base ne contrôle pas encore (bonus d'équipement, nombre de
  sorts par emplacement, plafond de NPM du Potentiel Illimité) n'est montré que comme compteur.
- **Enregistrement** : création (`POST`) puis modification (`PUT` avec la version lue : si quelqu'un a modifié la fiche entre-temps, rien n'est écrasé et
  la page propose de la recharger), suppression (`DELETE` avec la version lue). Sans le service (version portable, service arrêté), la fiche se remplit, s'**exporte** en JSON et s'**imprime** ; un
  fichier exporté se **réimporte** pour créer le prétiré.
- Avant la 1.0, la page ne crée que des **prétirés** (à personne, visibles de tous) : les fiches de joueur arriveront avec la connexion Discord.

## La page `/personnages/`

Le tableau liste les prétirés (archivés cachés par défaut) : nom (lien vers la fiche) et surnom, statut, race et ethnie, magies, classes et spécialités,
niveau (trié par l'XP), métier, nombre de règles à revoir, date de modification. **Chaque colonne se trie** dans les deux sens (bouton dans l'en-tête,
`aria-sort`) ; filtres : texte (nom, surnom, origine, sans accents), statut, race, magie (innée ou acquise), classe (1ʳᵉ ou 2ᵉ), niveaux, règles à revoir.
Filtres et tri vivent dans l'adresse de la page : une recherche se garde et se partage. Logique pure et testée : `lib/personnages-liste.mjs`.

## Fiches dans la base

Les vraies fiches de personnages ont leurs tables dans la base (section 13 de `data/schema.sql`, migration `0011-personnages`). Elles reprennent la
« Fiche personnage Maverick Auto V15.2.2 » (onglet Personnage) **hormis ses bugs** (liste dans [`sql/a-valider.md`](sql/a-valider.md) §3) : chaque colonne cite sa cellule.

**Principe : on stocke les choix, jamais les calculs.** Une fiche garde ce que le joueur décide ou tire aux dés ; tout ce que la fiche auto calcule se recalcule
depuis les règles de la base, si bien qu'une règle corrigée corrige toutes les fiches.

### Joueurs, prétirés, groupes et visibilité (demande du propriétaire)

- **Deux natures de fiche** (`personnage.nature`) : la fiche d'un **joueur** (`joueur`), qu'il crée pour son propre personnage, et le **prétiré** (`pretire`),
  qui n'est à personne (`proprietaire_id` vide) et que **tout le monde voit**.
- **Visibilité** d'une fiche de joueur : **lui seul et les administrateurs** par défaut (`visibilite = 'privee'`). Il peut l'ouvrir à **tous les MJ**
  (`'mj'` : les utilisateurs de rôle `mj`, le « groupe MJ »), à **tout le monde** (`'tous'`), et la montrer à des **utilisateurs désignés**, autant qu'il veut
  (`personnage_partage`).
- **Groupes de jeu** (`groupe` : un one-shot ou une campagne ; `groupe_membre`) : un joueur peut avoir plusieurs fiches et être dans plusieurs groupes, mais
  n'inscrit **qu'une fiche par groupe** (une ligne par membre et par groupe) : en inscrire une autre **désinscrit** la précédente. La fiche inscrite devient
  **visible de tous les membres de ce groupe**, et d'eux seuls : ses autres fiches restent cachées. On inscrit sa propre fiche ou un prétiré (`v_groupe_controle`).
- **Rôles** (`utilisateur_role`, cumulables) : `mj`, `editeur` (modification des règles, phase 2), `admin` (voit et gère tout) ; tout utilisateur connecté est
  lecteur. La page de gestion de ces règles n'est pas encore faite : les tables et les vues les portent déjà.
- `v_personnage_visible` dit qui voit quelle fiche : une ligne par (fiche, utilisateur, motif), motif `proprietaire`, `admin`, `tous`, `mj`, `groupe`
  (avec le groupe) ou `partage`. Un utilisateur voit une fiche s'il y a au moins une ligne.

### Les tables

| Table | Contenu (cellules de la fiche) |
| --- | --- |
| `utilisateur`, `utilisateur_role` | Personne connectée (identifiant Discord, nom d'affichage) et ses rôles : connexion Discord prévue à la 1.0 (`feuille-de-route.md`) |
| `personnage` | Nature (joueur ou prétiré), propriétaire, visibilité ; identité (F1, P1, F3), race (I2), ethnie (C40), magies innée et acquise (S2, S3), point de caractéristique d'une magie « au choix » (Potentiel Illimité), dieu choisi (S5), métier (C41), mode mono/bi-classe (BDD!K26), XP (S11), scores d'alignement L/C/B/M (L5:O5), bourse PP/RO/RF (I6, N6, T6), ambidextrie (AU8), classe de bouclier (AA26), valeurs courantes (santé, chakra, barrière, corruption, 4ᵉ barre), notes et événements, statut `brouillon` / `valide` / `archive` |
| `personnage_partage` | Utilisateurs à qui le propriétaire montre sa fiche |
| `personnage_classe` | Classes 1 et 2 (A9, A11) et leur spécialité (choisie au niveau de classe 10) |
| `personnage_caracteristique` | Valeur de base des six caractéristiques (E18…U19) et leurs **croix** (cases H18, I18… ; 0 à 2, décision R19 : 1 croix = −20 % à tout test de la caractéristique, 2 = plus utilisable) |
| `personnage_competence` | Points « Nat. » et « Acquis » de chaque compétence (G22, I22…) |
| `personnage_progression` | À chaque niveau global à partir du 2 : les 15 points d'attributs répartis entre santé et chakra, et le dé bonus des niveaux 5, 10, 15, 20 |
| `personnage_capacite` | Dons de classe **à choix** (options d'une ligne, paliers de l'Archimage) ; les autres se déduisent |
| `personnage_sort` | Sorts de la liste (AA55:AY74) et leur NM |
| `personnage_maitrise_arme` | Dés de maîtrise par famille d'armes (AA2:AV7) : 1 dé sans maîtrise, un de plus par point de maîtrise, 5 au plus ; la page fait choisir des points (4 au plus, constantes `maitrise_arme.*` de `regle_constante`) |
| `personnage_arme`, `personnage_armure`, `personnage_bouclier_materiau`, `personnage_accessoire`, `personnage_inventaire` | Équipement : catalogue de la base (arme, matériau, améliorations, pièces élémentaires, effets d'accessoire et valeur tirée, case « Malédiction ») et sac |
| `groupe`, `groupe_membre` | Groupe de jeu (one-shot ou campagne), ses membres (MJ ou joueur) et la fiche que chacun y a inscrite |

### Les vues

- `v_personnage_niveau` : niveau global (d'après l'XP) et niveaux de classe 1 et 2 (décision R2).
- `v_personnage_visible` et `v_groupe_controle` : voir plus haut.
- `v_personnage_controle` : une ligne par règle enfreinte (`regle`, `detail`) : classe ou magie innée hors de la matrice de la race (R8, R11), classe réservée
  à une autre magie innée et classe 1 imposée par la magie innée (l'Archimage et le Potentiel Illimité, R23), classe fermée à la magie innée (le Mage Bleu
  et le Potentiel Illimité, R25), magie acquise d'une race à une seule magie (la Lamia, R28), magies incompatibles,
  mono-magie (R15 ; l'Elfe Noir Charbon et le Felfe Noir peuvent aussi acquérir la Corruption, R20), ethnie (de la race, liée à la magie innée quand elle en porte
  une), bornes et total exact des caractéristiques (R3), plafonds et total exact des compétences (R3), gains de niveau (points exacts, dé), 2ᵉ classe, spécialité
  avant le niveau de classe 10, dons hors classe ou exclusifs, sorts (magie du personnage, toutes pour le Potentiel Illimité ; NPM au plus la puissance magique
  du niveau, la 5 au niveau 16 et sans magie acquise, R16 ; 3 NM au plus sur un sort ; NM de niveau au plus niveau global − 1 sur un sort et au plus ceux gagnés, les autres d'un livre ou du MJ, R24, R26), matériaux du bouclier, améliorations, valeur d'un
  accessoire. Une fiche `valide` n'y a aucune ligne. Ce qui demande le moteur (bonus de classe, d'équipement et de race, nombre de sorts, plafond de NPM du
  Potentiel Illimité, résistances, valeurs dérivées) n'y est pas encore.

Les tables restent **vides dans `data/rows`** : les fiches réelles vivent dans la base vivante du service des personnages (`db/` de l'instance,
[`serveur.md`](serveur.md) : les prétirés dès maintenant, les fiches de joueur à la 1.0), jamais dans git ni dans la base téléchargeable de `/donnees/`. `client/test/personnages-db.test.mjs` crée des fiches dans une copie de la base et vérifie chaque contrôle et chaque règle de
visibilité.

Le moteur pur (`lib/fiche-moteur.mjs`, ci-dessus) calcule déjà depuis ces choix le niveau, les budgets, les scores de compétences, les attributs et les
emplacements de sorts ; restent à coder, sans les déduire, les effets d'équipement (AP/AM des pièces, bonus des améliorations), les résistances et ce qui
sert à la simulation (`feuille-de-route.md`).
