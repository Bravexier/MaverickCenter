# Feuille de route (vision du propriétaire du projet)

Ce que le site doit devenir, tel que l'a décrit le propriétaire du projet. Cela oriente les choix techniques d'aujourd'hui, même si rien
n'est encore réalisé au-delà de la première étape.

## Étapes

1. **Source rapide et navigable** (en cours) : les règles du jeu et le lore, en pages reliées par mots-clés, importées des classeurs et documents Google
   (les classeurs restent la source de vérité ; les pages et la base sont régénérées à chaque import).
2. **Un outil qui remplace Google Docs/Sheets** (à long terme) : modifier sorts, dons, classes et races depuis le site, avec historique et relecture. À ce moment-là
   la source de vérité bascule : la base devient canonique, les classeurs deviennent une archive en lecture seule. Le moment de la bascule se décide avec le
   propriétaire du contenu ; avant cela, aucune édition n'est faite dans le site (les corrections passent par `tools/sheets/corrections.json`).
   **Premier pas** (demande du propriétaire, 2026-10) : sur le site de dev seulement, les pages du guide, des races, des magies, des classes et des
   métiers se modifient en place (crayon) ; chaque modification est notée au journal (avant / après) et se rapatrie dans `data/rows` par
   `npm run db:appliquer-edition` (`docs/serveur.md`, « Édition »). **Deuxième pas** (2026-10) : la page « Mise à jour » liste ce que la dev change
   par rapport à la production, en note de version historisée, et son bouton apporte les modifications du site dans `data/rows` puis livre en
   production (`docs/serveur.md`, « Mise à jour ») ; le propriétaire a décidé que **le site devient la source** des données qu'il modifie (les
   modifications versées dans `historique_modification`, que les tests relisent pour ne plus épingler ce que le site a changé : `client/src/lib/historique-site.mjs`). Relecture (`brouillon / validé`), auteur (connexion Discord) et accès restreint au bouton restent à faire.
3. **Simulation de combats** (à long terme) : jouer des combats pour juger l'équilibrage des sorts, des classes et des races.

À côté de ces trois étapes, un axe **communauté de jeu** (comptes Discord, groupes, planning, bot, boîte à idées, statistiques) et l'achèvement du
**Codex** et des **Ressources** : voir « Prochaines évolutions » ci-dessous.

## Prochaines évolutions (liste du propriétaire, 2026-10-11)

Le propriétaire a donné ses prochaines évolutions « pêle-mêle » ; elles sont rangées ici par dépendances, avec un identifiant stable (**E1** à **E12**)
pour s'y référer dans les PR et les décisions. **L'ordre des jalons est une proposition**, à valider par le propriétaire ; ce qui attend sa réponse est
regroupé à la fin (« Questions au propriétaire »). Aucune règle du jeu ne se décide ici (valeurs d'objets, tirages, créatures, dates du lore…) : elle vient
d'une source ou d'une décision de [`decisions-regles.md`](decisions-regles.md) (règle d'or).

### Vue d'ensemble

| Id | Évolution | Jalon · version visée | Dépend de | Ce qui existe déjà |
| --- | --- | --- | --- | --- |
| E1 | Galerie : créations humaines / images d'IA | A · V0.3 | — | `/galeries/`, carrousel de l'accueil, `lib/galerie.mjs` (le logo seul) |
| E2 | Page du Bestiaire | A · V0.3, puis B · V0.5 | réponses du propriétaire (`docs/bestiaire.md`) | **premier jet en place** (2026-10-11) : `/bestiaire/`, monstres du « Bestiaire 2.0 » (section 8 bis) et créatures invoquées à part, tableaux filtrables |
| E3 | Refonte de l'équipement et intégration à la fiche | A · V0.4 | la liste des ratés de l'intégration | catalogues de la section 9, bloc équipement de `/fiche/`, tables `personnage_arme`, `personnage_armure`… |
| E4 | Générateur d'accessoires magiques | A · V0.4 | E3 pour les accessoires | tables de tirage `accessoire_emplacement`, `accessoire_propriete`, `accessoire_effet` ; `personnage_accessoire` |
| E5 | Chronologie | B · V0.5 | sources du lore | **premier jet en place** (2026-10-13) : `/chronologie/`, une page par événement daté du Codex et des races, ouverte à droite d'une frise verticale en dégradé, chevrons Haut et Bas ([`chronologie.md`](chronologie.md)) |
| E6 | Carte interactive et lieux | B · V0.5 | image de la carte, sources | type `cartes` (aucune page), entrée « bientôt » du menu Codex |
| E7 | Connexion par Discord seulement : touriste ou joueur, puis rôles | C · V0.6, éprouvée avant la V1.0 | application Discord du propriétaire | tables `utilisateur`, `utilisateur_role` ; « Authentification » plus bas |
| E8 | Fiches de personnage assignées à un compte | C · V0.6 | E7 | `personnage.proprietaire_id`, `personnage_partage`, `v_personnage_visible` |
| E9 | Groupes (OS, HC hors campagne, campagne) et planning des parties | D · V1.2 | E7, E8 | `groupe`, `groupe_membre`, `v_groupe_controle` ; entrée « bientôt » du menu Personnages |
| E10 | Bot Discord : lien site ↔ serveur, notifications | A · V0.3 (annonces), D · V1.3 | E7 pour les notifications ciblées | — |
| E11 | Boîte à idées, tickets, rapports de bugs | D · V1.1 | E7 | entrée « bientôt » du menu Outils |
| E12 | Statistiques | E · V1.4 | E8 et des fiches réelles | `v_personnage_niveau`, base vivante du service |

Jalons proposés :

- **A — avant la 1.0, sans comptes** : ce qui se fait avec la base actuelle et le mot de passe partagé d'aujourd'hui.
- **B — le Codex** : avant la 1.0 aussi, mais suspendu au rapatriement des sources (salons Discord du lore et des cartes) ; le
  « CODEX Maverick » est importé (2026-10-11, [`codex.md`](codex.md)) : une page `lore/` par divinité, temple ou guilde, civilisation et objet légendaire,
  Codex › Mythologie et Codex › Factions mènent à leurs sommaires ; le « Bestiaire 2.0 » aussi (2026-10-11, [`bestiaire.md`](bestiaire.md)) : Codex › Bestiaire.
- **C — la 1.0** : la connexion par Discord arrive dans la **dernière version 0.x** (V0.6 visée), qui reste en service le temps d'en corriger les bugs ;
  la **V1.0.0** vient quand la connexion est éprouvée et testée et l'ouvre à tout le Discord (précision du propriétaire, 2026-10-11). Le passage en 1.0
  reste son signal ([`flux-git.md`](flux-git.md)). Les fiches liées au compte (E8) sont proposées dans la même V0.6, pour être éprouvées avec la connexion.
- **D — la communauté** : ce que les comptes rendent possible.
- **E — la mesure** : quand il y a assez de fiches réelles ; puis la simulation de combats (étape 3).

Versions visées (proposition, 2026-10-11, depuis la V0.2.0) : chaque livraison `dev` → `master` augmente le deuxième chiffre ([`flux-git.md`](flux-git.md)),
donc **V0.3** est la prochaine livraison. Les numéros sont indicatifs : une livraison faite pour autre chose décale la suite, et la 1.0 reste le signal du
propriétaire.

| Version | Contenu visé |
| --- | --- |
| V0.3 | Galerie humaine / IA (E1), page du Bestiaire des invocations (E2), annonce des versions sur Discord par webhook (E10) |
| V0.4 | Refonte visuelle de l'équipement et de son intégration à la fiche (E3), générateur d'accessoires magiques (E4) |
| V0.5 | Codex, selon l'arrivée des sources : chronologie (E5), carte et lieux (E6), monstres du « Bestiaire 2.0 » (E2) |
| V0.6 | Connexion par Discord : touriste sans connexion, joueur pour les membres du serveur (E7), fiches liées au compte (E8) ; dernière version 0.x, le temps de corriger les bugs |
| V1.0 | La connexion par Discord est éprouvée et testée : ouverture à tout le Discord |
| V1.1 | Boîte à idées, tickets et rapports de bugs (E11) |
| V1.2 | Groupes one-shot (OS), hors campagne (HC) et campagne, planning des parties (E9) |
| V1.3 | Bot Discord : notifications ciblées, rappels de parties, rôles synchronisés (E10) |
| V1.4 | Statistiques des fiches (E12) |
| Ensuite | Remplacer Google Docs/Sheets (étape 2), simulation de combats (étape 3) |

La frise pour les joueurs (une étape par version, à partager sur le Discord) reprend ce tableau.

```mermaid
flowchart LR
  subgraph A["A — sans comptes"]
    E1[E1 Galerie]
    E2[E2 Bestiaire]
    E3[E3 Équipement] --> E4[E4 Accessoires magiques]
  end
  subgraph B["B — Codex"]
    E5[E5 Chronologie] -.- E6[E6 Carte et lieux]
  end
  subgraph C["C — V0.6 puis 1.0"]
    E7[E7 Connexion Discord] --> E8[E8 Fiches des comptes]
  end
  subgraph D["D — communauté"]
    E9[E9 Groupes et planning]
    E10[E10 Bot Discord]
    E11[E11 Boîte à idées]
  end
  S([Sources du lore]) --> E2 & E5 & E6
  E8 --> E9 --> E10
  E7 --> E10
  E7 --> E11 --> E10
  E8 --> E12[E12 Statistiques] --> SIM([Simulation de combats])
  E2 -.-> SIM
```

### E1 — Galerie : distinguer créations humaines et images d'IA (jalon A)

- **But** : chaque image dit clairement son origine, et aucune ne peut être publiée sans.
- **Premier pas** : les entrées de `GALERIE` (`lib/galerie.mjs`) gagnent `origine` (`'humaine'` ou `'ia'`, obligatoire : `test/galerie.test.mjs` refuse
  une entrée sans) et `auteur` (l'artiste, ou l'outil pour une image d'IA) ; une pastille sur chaque image de `/galeries/` et du carrousel de l'accueil
  (« Création humaine » / « Image générée par IA ») et un filtre (toutes, humaines, IA) gardé dans l'adresse, comme sur `/personnages/`.
- **Ensuite (après E7)** : les membres proposent des images (fichier, origine déclarée, auteur) qu'un administrateur valide ; les fichiers vivent dans le
  dossier de données de l'instance (à côté de `db/`, jamais dans git) et une table de la base vivante les décrit (auteur, origine, statut proposée / publiée / refusée).

### E2 — Page du Bestiaire (jalon A, puis B)

- **Déjà là** (premier jet, 2026-10-11, `docs/bestiaire.md`) : `/bestiaire/` (menu Codex › Bestiaire) en deux onglets, chacun un grand tableau avec recherche,
  filtres à cases et tri : les **monstres** du « Bestiaire 2.0 » (copie du propriétaire, migration `0029-bestiaire-monstres` : 144 espèces, 315 cartes, butin,
  échelles de puissance, glossaire) et, à part, les 63 **créatures invoquées** (section 8). Les questions au propriétaire sont dans `docs/bestiaire.md`.
- **Premier pas** : une page `/bestiaire/` et des fiches de créature rendues depuis les tables, sur le modèle des magies, des races et des classes
  (`lib/bestiaire-db.mjs`, `components/bestiaire/`, CSS inséré par le composant), créatures rangées par invocation et par magie, avec renvoi à la magie
  qui les invoque ; mode modification sur le site de dev comme les autres pages typées ; entrée du menu.
- **Ensuite** : les ajustements du propriétaire sur ce premier jet ; le mode modification sur le site de dev ; une fiche par monstre si elle est voulue.
  Le bestiaire prépare la simulation (une créature est un adversaire).

### E3 — Refonte de l'équipement et intégration à la fiche (jalon A)

- **Déjà là** : les catalogues typés (section 9 : armes, armures, boucliers, matériaux, améliorations, pièces élémentaires, accessoires, gemmes, bâtons
  magiques…) ; les pages des Ressources, rendues depuis leur Markdown ; dans `/fiche/`, le bloc équipement (armes, armure, bouclier, accessoires,
  inventaire, objets de départ du métier). Manquent ([`character-generator.md`](character-generator.md)) : les effets d'équipement dans les calculs (AP/AM
  des pièces, bonus des améliorations, résistances des objets), et « Objets à la ceinture » (boucliers, bâtons magiques) est « bientôt ».
- **Portée** (réponse du propriétaire, 2026-10-11) : une refonte **visuelle** et de l'**intégration à la fiche**, où il y a aujourd'hui des ratés ; les
  règles de l'équipement ne changent pas.
- **Étapes proposées** : (1) les pages des Ressources refaites et rendues depuis les tables (un tableau par catalogue, comme `/metiers/`), modifiables sur
  le site de dev ; (2) « Objets à la ceinture » ; (3) dans la fiche, les ratés corrigés un par un (chacun relevé avec le propriétaire, chacun son test), le
  choix dans le catalogue et les effets codés en données, un effet à la fois, cité et testé (`lib/fiche-moteur.mjs`) : un effet non codé reste affiché en
  texte et n'est pas compté ; (4) poids, prix et bourse, si les sources les donnent.

### E4 — Générateur d'accessoires magiques (jalon A, après E3 pour les accessoires)

- **Déjà là** : la création d'un accessoire est un tirage écrit dans le classeur et rangé dans la base — emplacement (1d4, `accessoire_emplacement`),
  propriété (1d100 en 8 plages, dont Malédiction de 96 à 100 : `accessoire_propriete`), effet selon la propriété (`accessoire_effet`, gemmes
  `accessoire_effet_gemme`), montures (`accessoire_monture`) ; une fiche garde un accessoire avec sa valeur tirée et sa case « Malédiction » (`personnage_accessoire`).
- **À faire** : un module pur `lib/generateur-accessoire.mjs` qui rejoue ces tables avec un tirage à graine (le même tirage se rejoue, comme prévu pour la
  simulation) et montre chaque jet ; une page (Ressources › Accessoires ou Outils) ; « Ajouter à la fiche » vers `personnage_accessoire`. Une ligne vide
  de la source donne « ligne vide dans la source », jamais un effet inventé ; tests contre les tables.

### E5 — Chronologie (jalon B)

- **Déjà là** (premier jet, 2026-10-13, [`chronologie.md`](chronologie.md)) : `/chronologie/` (menu Codex › Chronologie), une page par événement, ouverte à droite
  d'une frise verticale en dégradé (refaite à la demande du propriétaire : la date à gauche de la barre, le titre à droite, chevrons Haut et Bas) ; 74 événements : la liste « Les Impacts mineur et
  majeur » du Codex en entier, les dates des autres pages du Codex (fondations, guerres, objets légendaires…) et des pages de race (apparitions), chacun avec
  les extraits copiés de ses pages sources (tables `evenement`, `evenement_extrait`, migration `0035-chronologie`).
- **Ensuite** : les réponses du propriétaire aux questions de [`chronologie.md`](chronologie.md) (contradictions de dates, règnes, calendrier des mois) ;
  le salon « lore-bestiaire-codex » (export local ou bot, voir [`sources.md`](sources.md)) et le calendrier du monde ; des filtres (époque, peuple, lieu) ;
  la modification sur le site de dev ; les liens vers les lieux (E6).

### E6 — Carte interactive et lieux (jalon B)

- **Prérequis** : l'image (ou les images) de la carte en haute définition et la liste des lieux avec leur description (salon « cartes », non importé).
- **À faire** : une table des lieux (nom, nature — ville, région, donjon… —, position sur la carte, lieu parent, description, sources) ; une page
  Codex › Carte & lieux : carte zoomable (tuiles fabriquées au build depuis l'image), un repère par lieu, sa fiche au clic, une page par lieu pour la
  recherche et les `[[liens]]` ; liens avec la chronologie (E5), le bestiaire (où vit une créature) et le lieu d'origine des fiches ; un outil de placement
  des repères sur le site de dev.
- **Choix technique au prototype** : une bibliothèque de carte embarquée (Leaflet en coordonnées simples, sans fond de carte en ligne) ou un SVG maison ;
  elle doit passer dans la version portable (rien d'externe).

### E7 — Connexion par Discord seulement : touriste ou joueur, puis rôles (jalon C : V0.6, éprouvée avant la 1.0)

La connexion est décidée plus bas (« Authentification : Discord ») ; cette liste y ajoute :

- **Discord uniquement** : ni adresse électronique ni mot de passe ; le mot de passe partagé du site disparaît.
- **Deux statuts d'abord** (réponse du propriétaire, 2026-10-11) : **touriste** — pas connecté, ou connecté sans être membre du serveur Discord —, en
  lecture seule « en surface » ; **joueur** — membre du serveur Discord. À chaque connexion, le service vérifie l'appartenance au serveur (portée OAuth
  `guilds.members.read`) ; le bot (E10) la tient à jour entre deux connexions, et qui quitte le serveur redevient touriste.
- **Rôles MJ, éditeur, administrateur** : plus tard (réponse du propriétaire), d'après des rôles Discord à choisir ; une correspondance de configuration
  (identifiant de rôle Discord → `mj`, `editeur`, `admin`) en tirera `utilisateur_role`.
- **Pas de connexion de secours** (réponse du propriétaire) : Discord en panne, le site reste ouvert en touriste, en lecture seule ; c'est le mode dégradé.
  Le compte local que prévoyait la table `utilisateur` (`discord_id` NULL) n'a plus d'usage et se retire à la réalisation.
- **Ce que les rôles ouvriront** : l'édition des règles et le bouton « Effectuer la mise à jour » (sans protection aujourd'hui, décision du propriétaire)
  passent aux rôles `editeur` et `admin` ; l'auteur de chaque modification est inscrit à l'historique ; la relecture `brouillon / validé` devient possible.

### E8 — Fiches de personnage assignées à un compte (jalon C : V0.6)

- **Déjà là** : tout le modèle (fiche de joueur ou prétiré, propriétaire, visibilité privée / MJ / tous, partage à des utilisateurs désignés,
  `v_personnage_visible`), voir « Fiches de personnages » plus bas.
- **À faire** : le service ne lit que les fiches de `v_personnage_visible` et n'écrit que pour leur propriétaire (ou un administrateur) ; « Mes
  personnages » dans le menu Personnages ; création d'une fiche à son nom ; réglage de la visibilité et du partage ; **assignation** par un administrateur
  ou un MJ (donner à un joueur une copie d'un prétiré, qui reste prétiré, ou lui transférer une fiche existante) ; `/personnages/` ne liste que les fiches visibles.

### E9 — Groupes (OS, HC, campagne) et planning des parties (jalon D)

- **Déjà là** : `groupe` (natures `one_shot` et `campagne`), `groupe_membre` (rôle MJ ou joueur, une fiche inscrite par groupe), la visibilité par groupe.
- **Groupes** : création par un MJ, invitation des joueurs, inscription d'une fiche, page du groupe (membres, fiches inscrites, prochaines parties) ;
  trois natures : one-shot (OS), **hors campagne** (HC : plus court qu'une campagne, plus long qu'un one-shot, comme un chapitre indépendant ou un OAV ;
  réponse du propriétaire, 2026-10-11) et campagne ; la nature `hors_campagne` s'ajoute à `groupe.nature` par une migration, avec E9.
- **Planning** : nouvelles tables de la base vivante — partie (groupe, MJ, début, durée, lieu : vocal Discord ou table réelle, statut proposée / confirmée /
  annulée / jouée), sondage de dates (créneaux proposés, réponses oui / peut-être / non), présence ; calendrier du groupe et de chaque utilisateur,
  abonnement `.ics` (agenda du téléphone) ; rappels par le bot (E10). Instants en UTC dans la base, affichés à l'heure de Paris.

### E10 — Bot Discord : lien entre le site et le serveur (jalon D ; annonces dès A)

- **Notifications générales** (dans un salon) : version livrée et sa note (`/mise-a-jour/`), nouvelles pages, images de la galerie. Premier pas possible
  dès le jalon A par un simple webhook de salon appelé à la livraison, sans bot ni comptes.
- **Notifications ciblées** (après E7, en message privé ou dans le salon d'un groupe) : partie planifiée ou déplacée, rappel la veille, sondage de dates,
  fiche partagée avec soi, inscription dans un groupe, réponse à un ticket ; chacun choisit ce qu'il reçoit.
- **Autres usages** : synchroniser les rôles (E7) ; des commandes (consulter un sort, une fiche, les prochaines parties) ; lire en lecture seule les salons
  du lore pour l'import (option « bot dédié » de [`sources.md`](sources.md), utile à E2, E5 et E6).
- **Architecture proposée** : le service inscrit chaque événement dans une file (table de notifications de la base vivante : événement, destinataire,
  texte, état, essais) que le bot vide ; le site ne dépend jamais du bot (Discord en panne : rien ne bloque). L'API REST de Discord suffit pour écrire, et
  les commandes arrivent en HTTP signé Ed25519, vérifiable avec `node:crypto` : le bot peut rester sans paquet npm, comme le service. Son jeton est un
  secret de l'instance, jamais dans le dépôt ; aucun jeton personnel. Salons et rôles par configuration.

### E11 — Boîte à idées, tickets et rapports de bugs (jalon D)

- **But** : un seul endroit (Outils › Boîte à idée) pour proposer une idée, signaler un bug du site ou une erreur de règle, poser une question.
- **À faire** : tables de la base vivante — ticket (nature idée / bug / règle / question, titre, texte, page concernée, auteur, statut nouveau / accepté /
  en cours / fait / refusé, réponse), commentaires, votes sur les idées ; un bouton « Signaler » sur chaque page (adresse préremplie) ; une vue de tri pour
  les administrateurs ; notifications par le bot (E10).
- **Suite d'un ticket** : un bug accepté peut devenir une *issue* GitHub (le dépôt est privé : le ticket garde le lien, les joueurs ne la voient pas) ; une
  erreur de règle mène à une décision ([`decisions-regles.md`](decisions-regles.md)) ou à une modification sur le site de dev.

### E12 — Statistiques (jalon E ; celles des règles dès A)

- **Des fiches** (après E8, dans la base vivante) : popularité des races, des magies innées et acquises, des classes, des spécialités, des métiers et des
  dieux ; niveau moyen et répartition des niveaux (`v_personnage_niveau`), en tout et par groupe ; calculées par le service, en agrégats seulement (aucune
  fiche privée n'est montrée), page Outils › Statistiques.
- **Des règles** (sans comptes, dès le jalon A) : nombre de sorts par magie et par NPM, classes accessibles par race…, tirés de la base au build.
- **Ensuite** : les statistiques de la simulation de combats (étape 3).

### Ce qui vaut pour chaque évolution

- Une évolution = une ou plusieurs branches `feature/<nom>` vers `dev` ([`flux-git.md`](flux-git.md)), chacune avec ses tests (`client/test/`).
- Tables STRICT et SQL portable. Ce que saisissent les membres (comptes, groupes, parties, tickets, notifications, images proposées) vit dans la **base
  vivante** du service (`db/`), comme les fiches : jamais dans git ni dans `/donnees/maverick.db` ; une table nouvelle y est déclarée au service
  (`TABLES_VIVANTES`, `client/serveur/base-vivante.mjs`) et interdite au journal de l'édition.
- Le contenu du jeu (créatures, événements, lieux, effets d'objets, tirages) vient des sources ou d'une décision du propriétaire, jamais de la vraisemblance.
- Logique pure et testée dans `client/src/lib/`, code du DOM dans `src/scripts/` ; rien de propre à l'hébergement hors de `deploy/`.

### Réponses du propriétaire (2026-10-11)

1. **« HC »** = « hors campagne » : plus court qu'une campagne, plus long qu'un one-shot, comme un chapitre indépendant ou un OAV (E9).
2. **Pas de connexion de secours** : si Discord est en panne, on est déjà en difficulté ; le mode dégradé est l'accès sans connexion, en lecture seule (E7).
3. **Statuts** : touriste si l'on n'est pas connecté ou pas membre du serveur Discord (lecture seule en surface), joueur si l'on en est membre ; les
   autres rôles (MJ, éditeur, administrateur) se verront plus tard (E7).
4. **Équipement** : une refonte visuelle et de l'intégration à la fiche, où il y a aujourd'hui des ratés ; les règles ne changent pas (E3).
5. **Sources** (salons du lore et des cartes, image de la carte, calendrier du monde) : à voir plus tard (E5, E6). Le « CODEX Maverick » et le
   « Bestiaire 2.0 » sont arrivés le 2026-10-11 (copies du propriétaire : [`codex.md`](codex.md), [`bestiaire.md`](bestiaire.md)).

### Questions encore ouvertes

1. **Lecture « en surface »** : quelles pages un touriste voit-il, et lesquelles demandent d'être joueur (E7) ?
2. **Ratés de l'équipement** : lesquels, dans la fiche (E3) ?
3. **Fiches existantes** : les fiches Google des joueurs (V15.2.2) sont-elles importées automatiquement ou ressaisies dans `/fiche/` (E8) ?
4. **Visibilité** : tickets (E11) et statistiques (E12) visibles de tous les membres, ou des administrateurs seulement ? Les prétirés et les brouillons
   comptent-ils dans les statistiques ? Les images d'IA passent-elles dans le carrousel de l'accueil (E1) ?
5. **Discord** : un groupe a-t-il son salon ou son rôle, créé par le bot ? Quels salons pour les annonces ? « Chroniques » (menu Personnages) sert-il aux
   comptes rendus des parties jouées (E9, E10) ?
6. **Ordre** : les jalons A à E et les versions visées vous conviennent-ils ?

## Orthographe : relecture complète à la conversion en SQL

La relecture générale des coquilles et fautes des classeurs (décision R10 de `docs/decisions-regles.md`) se fait **dans la base**, domaine par domaine, par des migrations de données
(`data/migrations/`) : chacune garde son registre (table, id, colonne, avant, après, nature, raison). Faites : les sorts, les 15 magies et leurs tables dérivées
(`0003-orthographe-magies`, 500 corrections), puis toute la base (`0005-orthographe-base` : 2 247 corrections relues deux fois et 56 noms à clé inchangée, dans toutes les pages et tables typées),
puis les noms (`0006-orthographe-noms` : sens le plus probable, graphie majoritaire d'un nom propre ; les identifiants restent ceux d'origine, aucune table ne dérive plus l'id du nom).
Les points qui demandent une décision du propriétaire sont dans `docs/sql/orthographe-a-valider.md`.
Tant que les classeurs sont la source, **un réimport depuis un classeur réintroduirait ces fautes** : les lignes typées ne se réimportent pas encore (voir `docs/sql/remplissage.md`) ;
au moment de la bascule, la base est la référence. Le registre `tools/sheets/corrections.json` reste en vigueur pour les autres domaines.

## Ce que cela impose dès maintenant

- **Le NAS est temporaire.** Rien de spécifique au NAS en dehors de `deploy/` : le site et l'API doivent tourner dans un conteneur, configurés par variables
  d'environnement ; la mise à jour automatique (`update-site.sh`) est un habillage, pas l'architecture. L'hébergement final reste à choisir ; la solution y sera
  installée pour la 1.0 (décision du propriétaire), par les installateurs autonomes de `deploy/installateur/` (serveur normal et serveur de test, voir `flux-git.md`).
- **La base SQLite est le pivot.** Identifiants stables et jamais réutilisés (une page renommée garde son identifiant), SQL portable (une bascule vers PostgreSQL
  doit rester possible si plusieurs personnes éditent en même temps), modifications historisées (qui, quand, avant/après, état « brouillon / validé »).
- **Les règles sont des données, pas seulement du texte.** (Premier pas : les bonus de niveau de maîtrise des sorts, `sort_bonus_maitrise`, typés quand l'écriture est sans ambiguïté, lisibles par `lib/sort-maitrise.mjs`.) Le texte d'une capacité reste cité tel quel (règle d'or), mais une simulation exige des effets
  structurés (dégâts, durée, cible, jet, état infligé, résistance). On les code progressivement, capacité par capacité, à côté du texte, sans jamais en déduire
  une règle : un effet non codé est absent de la simulation, pas deviné.
- **Le moteur de règles reste pur et sans dépendance** (`client/src/lib/*.mjs`) : le même code sert au site, à l'API, au générateur de fiche et au simulateur.
- **Un site statique ne suffit plus pour l'édition ni pour la simulation** : il faudra un service (API + authentification, rôles lecteur / éditeur) ; le site
  de lecture peut rester statique ou devenir rendu côté serveur selon l'hébergement choisi. Premier pas, préparé avant la 1.0 (demande du propriétaire) :
  le **mode client / serveur** ([`serveur.md`](serveur.md)) — un service Node sans dépendance (`client/serveur/`), livré avec le site et servi par nginx sous
  `/api/`, qui enregistre les prétirés dans la base vivante (`db/`) ; l'authentification s'y ajoutera dans la dernière version 0.x, avant la 1.0.

## Authentification : Discord (décision du propriétaire du projet)

Toute la communauté est sur Discord : la connexion se fait par « Se connecter avec Discord » (OAuth2), personne n'a de compte ni de mot de passe à créer.

- **Ce qu'on garde** : l'identifiant Discord de l'utilisateur (immuable) et son nom d'affichage ; aucun mot de passe, aucun jeton Discord conservé au-delà de la connexion
  (le jeton ne sert qu'à lire l'identité et, au besoin, les rôles sur le serveur). Les modifications de contenu s'attribuent à cet identifiant (historique).
- **Statuts et rôles** : **touriste** (pas connecté, ou pas membre du serveur : lecture seule en surface), **joueur** (membre du serveur), puis MJ (le « groupe
  MJ » à qui un joueur peut ouvrir ses fiches), éditeur, administrateur, d'après des rôles Discord choisis plus tard ; un utilisateur peut cumuler ces rôles
  (table `utilisateur_role`) ; la correspondance rôle Discord → rôle du site est une configuration, pas du code. Quelqu'un qui quitte le serveur redevient
  touriste. **Pas de connexion de secours** (décision du propriétaire, 2026-10-11) : Discord en panne, le site reste lisible en touriste (« Prochaines évolutions », E7).
- **Ce que cela suppose** : un petit service (le site statique seul ne peut pas faire d'OAuth) qui gère la connexion et les sessions (cookie signé, HttpOnly, protection
  CSRF pour les modifications) ; le serveur web protège aussi les pages statiques réservées aux joueurs en lui demandant si la session est valide (`auth_request` avec nginx). L'adresse de
  retour de la connexion dépend de l'adresse publique du site (HTTPS) : elle se configure par variable d'environnement et se change dans le portail développeur Discord
  quand l'hébergement migre.
- **Quand** : dans la dernière version 0.x (V0.6 visée), qui reste en service le temps d'en corriger les bugs ; la **version 1.0** vient quand la connexion
  est éprouvée et testée, et l'ouvre à tout le Discord (décision du propriétaire, précisée le 2026-10-11 ; « Prochaines évolutions », E7). Les serveurs normal
  et de test existent dès la 0.2.0 (voir `flux-git.md`). Le mot de passe partagé d'aujourd'hui reste d'ici là.
  La table des utilisateurs et les colonnes « modifié par » de l'historique se prévoient dès la conception de la base.
- **À faire par le propriétaire le moment venu** : créer l'application dans le portail développeur Discord et fournir son identifiant et son secret comme secrets de
  l'environnement (jamais dans le dépôt). Aucun jeton personnel Discord n'est utilisé.

## Fiches de personnages : joueurs, prétirés, groupes et visibilité (demande du propriétaire)

Les tables sont prêtes dans la base (section 13 de `data/schema.sql`, détail dans `character-generator.md`, « Fiches dans la base »). Les **prétirés**
s'enregistrent dès avant la 1.0 par le service des personnages ([`serveur.md`](serveur.md)) ; les fiches de joueur, le partage et les groupes supposent
la connexion Discord (dernière version 0.x, puis 1.0).

- **Deux sortes de fiches** : celles qu'un joueur crée pour son propre personnage, et les **prétirés**, qui ne sont à personne et que tout le monde voit.
- Une fiche de joueur n'est **visible que de lui seul (et des administrateurs)**. Il peut l'ouvrir à **un ou plusieurs utilisateurs désignés**, à **tous les MJ**
  ou à **tout le monde**.
- **Groupes de jeu** (one-shot ou campagne) : quand un joueur rejoint un groupe et y inscrit son personnage, la fiche devient **automatiquement visible de tous
  les membres du groupe** ; ses fiches inscrites dans d'autres groupes restent cachées par défaut. Un joueur peut avoir plusieurs fiches et être inscrit dans
  plusieurs groupes, mais n'assigne **qu'une fiche par groupe** : en assigner une autre désinscrit automatiquement la précédente.

## Simulation : par où commencer (idée)

Un noyau minimal et vérifiable : un tour de combat (attaque, AP/AM, résistances et vulnérabilités des magies, états), un tirage aléatoire à graine (les
résultats se rejouent), des scénarios décrits en données (équipes, niveaux, sorts), des statistiques sur beaucoup de combats (taux de victoire, dégâts par
tour). On le valide sur des combats dont le propriétaire connaît l'issue avant d'élargir.
