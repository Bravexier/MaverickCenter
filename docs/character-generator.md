# Fiche de personnage

Deux pages (demande du propriétaire), branchées sur le service des personnages ([`serveur.md`](serveur.md)) :

| Page | Rôle | Fichiers |
| --- | --- | --- |
| `/fiche/` (et `/fiche/?id=<id>`) | **Créer et modifier** un prétiré, sur le même écran | `client/src/pages/fiche/index.astro`, `src/scripts/fiche.mjs`, `styles/fiche/fiche.css` |
| `/personnages/` | **Rechercher** les personnages : filtres, tableau trié par la colonne choisie | `client/src/pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs` |

L'ancienne adresse `/generateur/` mène à `/fiche/` (page 404, `lib/nav.mjs#nouvelleAdresse`). Dans le menu, la rubrique « Personnages » réunit
« Fiche de personnage » (`/fiche/`) et « Listes » (`/personnages/`), puis « Groupes » et « Chroniques » (bientôt).

## La page `/fiche/`

La fiche suit les étapes du guide (« Créer son personnage »), un bloc par étape, teinté de la couleur de sa partie du guide, **sans numéro**, et les blocs
sont disposés **en rangées** (demandes du propriétaire ; l'un sous l'autre sur un écran étroit) : identité (nom, surnom, origine, **métier**, race et ethnie,
**alignement**) · magies et dieux · classe(s) et spécialités ; attributs et valeurs du moment · niveau (jauge d'XP), gains de niveau et dons à choisir ;
caractéristiques et compétences · sorts et rappel des dons ; **maîtrises d'armes** (et ambidextrie) ; équipement (armes, armure, bouclier, accessoires, inventaire, puis la
**bourse**) · notes et événements ; puis le contrôle des règles, sur toute la largeur. La page prend plus de largeur que les autres (100rem au plus) pour
ces rangées. Le panneau d'un menu déroulant s'étend sur toute sa rangée. **Compacte** (demandes du propriétaire) : pas de lien vers le guide ;
race, ethnie, magies innée et acquise, classes et spécialités sont des **menus déroulants** (`<details class="choix">` : fermé, le choix fait ; ouvert, les
**pastilles** dans les couleurs de `/races/`, `/magies/`, `/classes/`, celles que les règles ferment grisées ; un choix, un clic ailleurs ou Échap le
referme) ; les caractéristiques sont des **curseurs** bornés par la race, à 1 (le minimum) par défaut, jamais vides (`caracteristiquesCompletes`), et le
naturel et l'acquis des compétences des curseurs (naturel : jusqu'au maximum du niveau ; acquis : 5 par point de caractéristique de base). Un **clic droit**
sur un curseur (ou Entrée) le remplace par une case de saisie : le nombre tapé est ramené au maximum au-dessus, au minimum en dessous (`borner`) ; Échap
abandonne.

- **Métier** (décisions R33 à R40) : sous la liste des métiers, ce que donne le métier choisi (`bonusDuMetier`, `artisanatDe`, `objetsDuMetier`) — ses
  bonus, chacun **en Acquis** de sa compétence ou à un attribut : l'**initiative** (« +1 INI »), la **vitesse** ou la **vitesse de nage** (R37) ; un rang à plusieurs compétences (« +3% Diplomatie OU Intimidation »,
  « une compétence sociale au choix ») **se choisit ici** en pastilles (`personnage_metier_bonus`) ; un bonus en texte libre est rappelé sans effet. Sa
  **compétence d'artisanat** : 10 × chacune de ses deux caractéristiques, avec leur valeur (« Force 3 × 10 + Intelligence 2 × 10 = 50 % ») ; une croix sur
  l'une retire 20 (comme −2 à la caractéristique), deux croix la rendent inutilisable (R39). Ses **objets de
  départ** : choisir le métier les ajoute à l'inventaire, en changer retire ceux de l'ancien encore tels quels (même nom, même quantité :
  `inventaireSelonLeMetier`) ; un objet à choisir (« Pelle OU faucille… ») se choisit en pastilles (`choisirObjetDeMetier`). Dans les compétences, l'Acquis
  du métier s'affiche « +N » à côté du curseur : il compte dans le score, mais **le plafond de 5 par point de caractéristique de base prévaut sur lui**
  (R38 : au-delà, il est rogné, sans erreur ; le curseur s'arrête à ce qu'il laisse) ; l'initiative affiche 1D20 + l'Agilité + le métier, la vitesse
  celle de la race, de l'ethnie et du métier.
- **Alignement** : les quatre scores (L, C, B, M) serrés, axe Loi/Chaos puis axe Bien/Mal, et l'alignement qui en résulte à côté (`alignementDe`) : sur
  chaque axe, 5 points d'écart ou plus donnent la tendance, en dessous le personnage est Neutre (guide « Alignement », constante `alignement.ecart_axe`) ;
  les neuf noms sont ceux du guide « Les neuf alignements » (« Neutre » sur les deux axes, que la fiche auto écrit « Neutre Pur »).
- **Attributs et valeurs du moment**, fusionnés : une carte par attribut, santé · barrière · chakra (· Âme ou Sang, la 4ᵉ barre de la Nécromancie ou du
  Sang) sur une ligne ; initiative, vitesse et vitesse de nage en **simples pastilles**, à côté de la carte de la corruption ; santé **rouge**, barrière **jaune**,
  chakra **bleu**, corruption **noire** ; pas d'armure de base (les AP/AM viendront avec l'armure portée). Pas de texte de calcul (demande du propriétaire) : le
  détail d'un maximum est en infobulle sur sa valeur. Une valeur du moment s'affiche « actuelle / maximum », un curseur de 0 au maximum (au maximum tant qu'on n'y touche
  pas, la corruption à 0 ; le chakra actuel au plus chakra − corruption, sauf avec la magie de la Corruption, et la corruption qui monte emporte le chakra
  actuel, celle qui baisse ne le rend pas : `valeursDuMoment`, `ecrireValeurDuMoment`, guide « Fiche de personnage : Attributs »), et deux boutons **−** et
  **+** qui ouvrent une case où saisir le nombre à retirer ou à ajouter (`ajusterValeurDuMoment`, borné comme le curseur ; Entrée ou OK l'applique, Échap
  abandonne). Dessous, le **sélecteur des six postures** (table `posture`, dans leurs couleurs ; leurs effets du tableau de la fiche en infobulle et sous le
  sélecteur ; un second clic retire la posture) : la fiche garde la posture du moment (`personnage.posture_id`, migration `0027-posture-du-moment`).
- **Résistances et faiblesses**, dans le bloc des magies (demande du propriétaire, sur le modèle du tableau « Résistance / Faiblesse (Magie et Altération
  d'état) » de la fiche auto, `Personnage!BA2:BI12`) : les six paliers (`resistance_palier` : immunité, grande résistance, résistance, vulnérabilité, grande
  vulnérabilité, sensibilité, avec leur effet sur les dégâts), chacun avec ses magies, dans leur couleur, puis ses altérations d'état, cerclées de la couleur
  de leur magie ; le détail des crans en infobulle (`resistancesDe`). Une cible additionne ses crans (guide « Créer sa fiche », Tableau Résistances/Faiblesses :
  deux résistances font une grande résistance) : ceux des listes de la magie innée et de la magie acquise (`magie_resistance`, les listes des pages de magie et
  du guide : pour Arcane et Corruption, la fiche auto dit autre chose, question ouverte, `sql/a-valider.md` §2), et ceux que les dons écrivent
  (`lib/resistance-texte.mjs` : dons de la race et de l'ethnie de l'onglet, R13 — « 1 cran de résistance en plus à la magie innée et son altération d'état »,
  « Résistance à la magie du Sang », colonne « +1 cran de résistance » du Drakos —, dons de classe débloqués — « Augmente d'un cran la résistance à la magie
  innée et à son altération d'état » du Clerc). Une immunité écrite (« Immunisé contre le poison » du Mort-Vivant) range la cible en immunité ; une résistance
  au choix ou aléatoire (Drakos Orange, Anansi d'Arcane, Ocultomancien) n'est pas comptée et la fiche le signale sous le tableau. Pas encore : les objets.
- **Caractéristiques** : les six sur une seule ligne, chacune avec **deux cases de croix** (cochées = le nombre de croix, R19) ; à deux croix, le score des
  compétences est « N/A ». L'acquis d'une compétence va jusqu'à 5 par point de la caractéristique **totale**, le +1 de la magie innée compris (décision R41).
- **Maîtrises d'armes** : un curseur étroit par famille (0 à 4 points), les dés à côté (`notationDesDes`) ; le **Pugilat** montre le seul dé de la Force du
  personnage, +1 de la magie innée compris (`deDeLaFamille` : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », note de la famille, lue par
  `lib/maitrise-arme.mjs#desSelonLaForce`) ; dans le coin du bloc, les points répartis sur le **quota** des classes et de leurs dons (décision R32,
  `quotaDeMaitrise` ; sources en infobulle).
- **Sorts** : un tableau d'une ligne par emplacement, sans emplacement en plus (décision R27), chacune avec la liste des sorts possibles moins ceux des autres
  lignes (`lignesDeSorts`), groupée par NPM, le nom seul, chaque sort sur la couleur de sa magie comme sur les pages de magie, la liste fermée dans celle du
  sort choisi (`sortsParNpm`, demande du propriétaire) ; les **NM** d'un sort se notent par origine (de niveau, d'un livre — un par sort —, du MJ), 3 au plus
  sur un sort (décisions R24, R26). Colonnes (demandes du propriétaire) : coût, portée et **dégâts/soins/barrière**, à la **valeur du NM du sort** plutôt que
  « (+1/NM) » (`lib/sort-maitrise.mjs#valeurAuNm` : voir `content-guide.md`, « Niveaux de maîtrise ») ; pas de colonne NPM ; l'**effet secondaire** sur sa
  propre ligne, sous le sort (au NM aussi) ; une **étoile** quand le sort a une remarque, son texte en infobulle.
- **Rappel des dons**, sous les sorts : les **dons raciaux** — le don de base d'abord, puis le don de l'ethnie (`race_don`) et la ligne de l'ethnie dans le
  tableau de dons de la race (Drakos, Mort-vivant) : `donsDeRace` — puis les **dons de classe débloqués**, classe par classe : dons de la classe et de la
  spécialité choisie jusqu'au niveau de classe, dons à choix choisis (`donsAcquis`), avec leur niveau et leur type (passif, actif, action, réaction).
- **Gains de niveau** : une petite carte par niveau (santé en rouge, chakra en bleu, total ; aux niveaux qui en donnent un, le dé bonus), plusieurs par ligne ;
  le dé n'est décrit qu'une fois, au-dessus.
- **Couleurs des cadres** : la bordure et le bandeau du titre de chaque bloc, et le sommaire, prennent la couleur de la magie innée, en dégradé vers celle de
  la magie acquise (demande du propriétaire) ; sans magie innée, celle de la partie du guide. Seuls les cadres changent : caractéristiques, attributs,
  pastilles et curseurs gardent leurs couleurs.
- **Niveau** : la **jauge d'XP** (`progressionXp`) ouvre le bloc de progression : l'XP se modifie dans son champ ou s'ajoute avec le bouton +, le niveau
  suit (rappelé dans la barre d'enregistrement).

Une fiche enregistrée se **supprime** (bouton « Supprimer », après confirmation ; retour à la liste des personnages). Chaque caractéristique, et le tableau de ses compétences, a sa couleur
(demande du propriétaire, `lib/caracteristiques-postures.mjs`, transmise par `regles.json` : `couleur` et `texte` de chaque caractéristique). Le **Potentiel Illimité** en magie innée met l'Archimage en classe 1
et l'y **verrouille** (les autres classes 1 sont grisées, la pastille de l'Archimage ne se retire pas) ; sans lui, l'Archimage est grisée à tous les rangs,
et quitter le Potentiel Illimité la retire (décision R23) ; le Mage Bleu lui est fermé, à tous les rangs (décision R25), toute autre seconde classe reste permise. Les dons à choix d'une classe ou d'une spécialité retirée partent avec elle. Tout ce que la base
garde d'une fiche se saisit (section 13 de `data/schema.sql`, ci-dessous).

- **Règles** : `/fiche/regles.json`, tiré de la base au build par `lib/fiche-regles.mjs` (races et leurs bornes, ethnies, magies, dieux, métiers, classes,
  spécialités, dons à choix groupés comme sur la page de chaque classe, maîtrises d'armes des classes et points de maîtrise de leurs dons, sorts, tables
  de niveau, constantes, catalogues d'équipement et paliers du dé selon la Force, paliers de résistance, altérations d'état, résistances de chaque magie),
  rien de recalculé : les seuls textes lus le sont par `lib/maitrise-arme.mjs` (points de maîtrise d'un don, paliers du Pugilat ; `test/maitrise-arme.test.mjs`
  le rejoue sur toute la base) et par `lib/resistance-texte.mjs` (crans et immunités d'un don ; `test/resistance-texte.test.mjs` le rejoue sur toute la base et
  vérifie, sur les textes de l'import, l'accord des onglets avec les résistances des ethnies de la fiche auto, `ethnie_resistance`).
- **Calculs pendant la saisie** : `lib/fiche-moteur.mjs`, fonctions pures (testées par `test/fiche-moteur.test.mjs`, contre les vues de la base et les
  personnages fil rouge du guide) : niveau global et niveaux de classe (R2) ; classes et magies innées que la race permet (R8, R11), classe réservée à une
  magie innée et imposée par elle (`classe.magie_innee_id` : l'Archimage et le Potentiel Illimité, R23), ethnies et ethnie sans choix posée d'office
  (`ethnieImposee` : la seule de la race — Lamia, Majin, Hujin, Elfe doré — ou la seule de la magie innée — races hybrides, Drakos ; demande du propriétaire),
  magie acquise refusée et pourquoi (race à une seule magie R28, incompatibilité, mono-magie R15, exceptions R20) et retirée d'office quand un changement de race
  ou de magie innée la ferme (`magieAcquiseValable`, demande du propriétaire) ; caractéristiques (+1 de la magie innée, bornes de la race) et budget exact (R3) ;
  scores de compétences (10 × caractéristique + naturel + acquis, croix R19), plafonds et budget ; gains de niveau attendus ; classe magique (R6, R7) ;
  attributs comme la fiche automatique (santé, chakra, barrière, vitesse, armure de base, initiative, 4ᵉ barre, Corruption) et valeurs du moment
  (`valeursDuMoment`, `ajusterValeurDuMoment`) ; alignement (`alignementDe`) ; dé d'une famille d'armes selon la Force (`deDeLaFamille`) et quota de
  maîtrise (`quotaDeMaitrise`, R32) ; emplacements de sorts
  (conditions × puissance magique, R16), sorts possibles, NM ; dons à choisir selon la classe, la spécialité et le niveau de classe ; dons de classe
  débloqués (`donsAcquis`) et dons de la race (`donsDeRace`) ; résistances et faiblesses (`resistancesDe`).
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
| `personnage_competence` | Points « Nat. » et « Acquis » de chaque compétence (G22, I22…) ; l'Acquis du métier n'y est pas écrit (il se calcule : `v_personnage_metier_bonus`) |
| `personnage_metier_bonus` | Pour chaque rang de bonus du métier qui propose plusieurs compétences, celle que le joueur retient (décision R33) |
| `personnage_progression` | À chaque niveau global à partir du 2 : les 15 points d'attributs répartis entre santé et chakra, et le dé bonus des niveaux 5, 10, 15, 20 |
| `personnage_capacite` | Dons de classe **à choix** (options d'une ligne, paliers de l'Archimage) ; les autres se déduisent |
| `personnage_sort` | Sorts de la liste (AA55:AY74) et leur NM |
| `personnage_maitrise_arme` | Dés de maîtrise par famille d'armes (AA2:AV7) : 1 dé sans maîtrise, un de plus par point de maîtrise, 5 au plus ; la page fait choisir des points (4 au plus, constantes `maitrise_arme.*` de `regle_constante`) |
| `personnage_arme`, `personnage_armure`, `personnage_bouclier_materiau`, `personnage_accessoire`, `personnage_inventaire` | Équipement : catalogue de la base (arme, matériau, améliorations, pièces élémentaires, effets d'accessoire et valeur tirée, case « Malédiction ») et sac |
| `groupe`, `groupe_membre` | Groupe de jeu (one-shot ou campagne), ses membres (MJ ou joueur) et la fiche que chacun y a inscrite |

### Les vues

- `v_personnage_niveau` : niveau global (d'après l'XP) et niveaux de classe 1 et 2 (décision R2).
- `v_personnage_metier_bonus` : ce que le métier apporte (décision R33), une ligne par rang lié — la compétence (Acquis) ou l'initiative, et la valeur ; un rang
  à choix ne compte que par la compétence choisie.
- `v_personnage_visible` et `v_groupe_controle` : voir plus haut.
- `v_personnage_controle` : une ligne par règle enfreinte (`regle`, `detail`) : classe ou magie innée hors de la matrice de la race (R8, R11), classe réservée
  à une autre magie innée et classe 1 imposée par la magie innée (l'Archimage et le Potentiel Illimité, R23), classe fermée à la magie innée (le Mage Bleu
  et le Potentiel Illimité, R25), magie acquise d'une race à une seule magie (la Lamia, R28), magies incompatibles,
  mono-magie (R15 ; l'Elfe Noir Charbon et le Felfe Noir peuvent aussi acquérir la Corruption, R20), ethnie (de la race, liée à la magie innée quand elle en porte
  une), bornes et total exact des caractéristiques (R3), plafonds et total exact des compétences (R3 ; l'Acquis compte le bonus du métier, R33), bonus de métier choisi
  hors des options du métier ou rang à choix sans choix (R33), gains de niveau (points exacts, dé), 2ᵉ classe, spécialité
  avant le niveau de classe 10, dons hors classe ou exclusifs, sorts (magie du personnage, toutes pour le Potentiel Illimité ; NPM au plus la puissance magique
  du niveau, la 5 au niveau 16 et sans magie acquise, R16 ; 3 NM au plus sur un sort ; NM de niveau au plus niveau global − 1 sur un sort et au plus ceux gagnés, les autres d'un livre ou du MJ, R24, R26), matériaux du bouclier, améliorations, valeur d'un
  accessoire. Une fiche `valide` n'y a aucune ligne. Ce qui demande le moteur (bonus de classe, d'équipement et de race, nombre de sorts, plafond de NPM du
  Potentiel Illimité, résistances — calculées par le moteur, `resistancesDe` —, valeurs dérivées) n'y est pas encore.

Les tables restent **vides dans `data/rows`** : les fiches réelles vivent dans la base vivante du service des personnages (`db/` de l'instance,
[`serveur.md`](serveur.md) : les prétirés dès maintenant, les fiches de joueur à la 1.0), jamais dans git ni dans la base téléchargeable de `/donnees/`. `client/test/personnages-db.test.mjs` crée des fiches dans une copie de la base et vérifie chaque contrôle et chaque règle de
visibilité.

Le moteur pur (`lib/fiche-moteur.mjs`, ci-dessus) calcule déjà depuis ces choix le niveau, les budgets, les scores de compétences, les attributs et les
emplacements de sorts et les résistances ; restent à coder, sans les déduire, les effets d'équipement (AP/AM des pièces, bonus des améliorations, résistances
des objets) et ce qui sert à la simulation (`feuille-de-route.md`).
