# Fiche de personnage

Deux pages (demande du propriétaire), branchées sur le service des personnages ([`serveur.md`](serveur.md)) :

| Page | Rôle | Fichiers |
| --- | --- | --- |
| `/fiche/` (et `/fiche/?id=<id>`) | **Créer et modifier** un prétiré, sur le même écran | `client/src/pages/fiche/index.astro`, `src/scripts/fiche.mjs`, `styles/fiche/fiche.css` |
| `/personnages/` | **Rechercher** les personnages : filtres, puis une liste (portrait, nom, race, magies, niveau) triée par la colonne choisie, chaque ligne étant le lien vers la fiche | `client/src/pages/personnages.astro`, `src/scripts/personnages.mjs`, `lib/personnages-liste.mjs` |

L'ancienne adresse `/generateur/` mène à `/fiche/` (page 404, `lib/nav.mjs#nouvelleAdresse`). Dans le menu, la rubrique « Personnages » réunit
« Fiche de personnage » (`/fiche/`) et « Listes » (`/personnages/`), puis « Groupes » et « Chroniques » (bientôt).

## La page `/fiche/`

La fiche est rangée en **quatre zones** (demande du propriétaire, maquette validée le 2026-10-11), sans cadre, titre ni pastille visibles (les titres
restent pour les lecteurs d'écran) ; chaque zone garde la couleur d'une partie du guide pour ses accents, et chaque bloc le cadre aux couleurs des magies :

1. **Identité** : le **portrait** (le logo en attendant une image), le **nom** en grand, le **niveau** seul (dans un médaillon ; l'XP est dans la zone 4),
   surnom, lieu d'origine et **alignement**, puis trois colonnes de menus : race, ethnie et **métier** (facultatif, sous l'ethnie) · magies innée et acquise,
   dieux · case **« Bi-classé »**, classe(s) et spécialités.
2. **À portée de main** : les attributs et valeurs du moment ; caractéristiques et compétences, à côté les **armes** (avec leur **solidité**) **et maîtrises
   d'armes** et la **ceinture** ; les sorts, à côté les **dons débloqués** (et l'**entraînement**).
3. **Selon la situation** : les **postures** (et le Mode Hyper) sur toute la largeur ; l'armure et les accessoires, à côté l'initiative et les vitesses, les
   résistances et faiblesses, le bouclier.
4. **Paramètres et suivi**, en **onglets** (`components/Onglets.astro`) : Progression (jauge d'XP, gains de niveau) · Choix (ce que donne le métier et ses
   choix, le +1 d'une magie au choix, la spécialité, les dons de classe à choisir, ce que donnent la race et les magies) · Inventaire (sac, bourse) · Notes et
   événements · Contrôle. L'onglet « Choix » compte les choix qui restent, l'onglet « Contrôle » les règles à revoir ; sans JavaScript et à l'impression,
   les panneaux se suivent.

La page prend plus de largeur que les autres (100rem au plus) ; sur un écran étroit, les blocs passent l'un sous l'autre. Le panneau d'un menu déroulant
s'étend sur toute sa rangée de menus. **Compacte** (demandes du propriétaire) : pas de lien vers le guide ;
race, ethnie, magies innée et acquise, classes et spécialités sont des **menus déroulants** (`<details class="choix">` : fermé, le choix fait ; ouvert, les
**pastilles** dans les couleurs de `/races/`, `/magies/`, `/classes/`, celles que les règles ferment grisées ; un choix, un clic ailleurs ou Échap le
referme ; l'explication d'une classe imposée est en infobulle sur sa pastille « · imposée ») ; les caractéristiques sont des **curseurs** bornés par la race, à 1 (le minimum) par défaut, jamais vides (`caracteristiquesCompletes`), et le
naturel et l'acquis des compétences des curseurs (naturel : jusqu'au maximum du niveau ; acquis : 5 par point de caractéristique de base). Un **clic droit**
sur un curseur (ou Entrée) le remplace par une case de saisie : le nombre tapé est ramené au maximum au-dessus, au minimum en dessous (`borner`) ; Échap
abandonne.

- **Portrait** (migration `0031-fiche-zones`) : « Choisir une image » ouvre le **recadrage** (un cadre carré où l'image se déplace au doigt, à la souris ou aux
  flèches ; un curseur ou la molette zoome de 1 à 4) ; la fiche garde l'image, réduite à 600 000 pixels et sous 700 000 caractères en data URL
  (`personnage.portrait`), et son cadrage (`portrait_x`, `portrait_y`, `portrait_zoom`) : « Recadrer » rouvre l'image d'origine, « ✕ » revient au logo.
  Réduction et dialogue : `src/scripts/portrait.mjs` (CSS `styles/portrait/recadrage.css`, inséré à la première ouverture), partagé avec le portrait des
  monstres du bestiaire (mode modification, `docs/bestiaire.md`) ; bornes, formats et empreinte : `lib/portrait.mjs` (`test/portrait.test.mjs`).
- **Ceinture** (guide « Fiche de personnage : Accessoires et Ceinture », migration `0031-fiche-zones`, décision R89) : ses **3 emplacements** d'objets
  rapides, chacun un objet et sa quantité (`personnage_ceinture`, rang 1 à 3). Un emplacement **propose les objets du sac qui vont à la ceinture**
  (`suggestionsDeCeinture` : ceux que liste la page « Objets à la ceinture », vue `v_objet_ceinture`, décision R81 : potions, huiles, carquois et sacs,
  bâtons magiques) **ou une saisie libre** (un objet spécial du MJ, le matériel que le guide cite aussi : sa liste est « non exhaustive »). **Un objet
  du sac le quitte** pour la ceinture et y revient quand l'emplacement se vide ou change (`mettreALaCeinture`, `viderLEmplacement`) ; **une saisie
  libre ne touche pas au sac** (un objet que la vue ne liste pas, même présent dans le sac) : retirée, elle disparaît, et corrigée (« Corde » puis
  « Corde de 10 m »), elle est renommée sur place avec sa quantité. Choisi dans la liste, un objet du sac se pose aussitôt ; tapé, il attend que le
  champ soit validé (`objetChoisiDansLaListe` : « Méga fiole verte » ne sort pas du sac avant « … foncée »). Quantité de 1 au maximum de
  l'emplacement (`maximumDeLEmplacement`) : **3 exemplaires du même objet** (`ceinture.exemplaires_par_emplacement`, migration
  `0050-inventaire-ceinture`), plus quand un don débloqué l'écrit (« Permet d'avoir 4 fois le même objet sur un emplacement de ceinture »,
  Mercenaire « Organisé » : `exemplairesParEmplacement`, texte lu par `lib/ceinture-texte.mjs`) ; **1 pour un bâton magique** (utilisations
  illimitées) ; pour un carquois ou un sac, **ses projectiles**, jusqu'à la contenance que sa description écrit (« jusqu'à N »). Plus ou moins
  d'exemplaires d'un objet du sac en prennent au sac ou lui rendent la différence (`changerLaQuantiteDeCeinture`), **sans dépasser ce que le sac en
  a** (`quantiteMaxDeLEmplacement` ; seule exception, un objet posé sans être dans le sac compte 1 et y va quand on le retire) ;
  un contenant ou un bâton ne sort du sac qu'une unité. Choix de la fiche, non tranchés (R89) : baisser la quantité rend les exemplaires au sac (un objet consommé en jeu se retire donc aussi du sac) ; les projectiles d'un carquois ne sont pas pris aux
  flèches du sac et partent avec lui, la Parasole et la Perche (« compte pour 3 flèches dans un carquois ») ne sont pas comptées, un objet du MJ
  retiré ne va pas au sac. Une quantité au-delà du maximum (un import, un don perdu) est marquée invalide (`aria-invalid`). Un bâton se reconnaît à
  son nom (« Bâton magique Feu, niveau 2 », `nomDeBaton`) : il n'est pas lié au catalogue dans la fiche (pas de clé vers `baton_magique`) ; une
  magie renommée sur le site de dev fait de ses bâtons des saisies libres (maximum 3 au lieu de 1).
- **Sac** (onglet Inventaire ; décision R88) : **autant d'emplacements que la Force en donne** — une colonne = 12 lignes (la grille de la fiche auto), 24
  à Force 1, 28, 32, 36, puis 48 (« tout l'inventaire ») à partir de Force 5 (`emplacementsSelonLaForce`, constantes `inventaire.*` de `regle_constante`,
  migration `0050-inventaire-ceinture`) ; la Force est la valeur affichée (base, magie innée, accessoire ; les croix n'y sont pas). **Une ligne = un
  emplacement**, quelle que soit sa quantité (au moins 1), et le tableau montre autant de lignes que d'emplacements : les objets, l'emplacement libre
  suivant (y écrire crée la ligne ; une ligne dont le nom a été effacé en tient lieu), puis les emplacements vides. Chaque ligne propose le catalogue
  (ressources et bâtons magiques) ou une saisie libre. Au-delà de la place (une Force qui baisse, un import), les lignes restent, signalées en rouge
  (`inventaireDe`) : rien n'est retiré. Le don « Organisé » (« Permet d'utiliser n'importe quel sac quels que soient la Force ou les malus ») n'est pas
  compté (question ouverte de R88). Ni le sac trop plein ni une ceinture au-delà du maximum ne sont des règles de `v_personnage_controle` : la page
  les signale seule.
- **Choix à faire** (`choixEnAttente`) : l'ethnie d'une race choisie, la spécialité d'une classe au niveau de son don de spécialité, chaque groupe de dons à
  choisir, chaque bonus ou objet de départ du métier à choisir, le +1 d'une magie qui le laisse au choix. Leur champ est **surligné** (ambre, `data-a-choisir`),
  et tant qu'il en reste le panneau « Choix » sort en **tiroir** en bas de l'écran, par-dessus la fiche, avec la liste de ce qui manque ; il ne se range que
  quand la zone 4 est à l'écran ; « Réduire » le replie sur sa poignée (le survol le rouvre), « Aller aux choix » y descend. La spécialité s'y choisit aussi
  (demande du propriétaire : « le doubler dans le menu de choix »).
- **Dégâts des armes** (`degatsDArme`) : une pastille « XDY+Z » par arme — les dés de la maîtrise de sa famille, le dé de l'arme (son effet, sinon son type ;
  le Pugilat selon la Force), plus les bonus qui se cumulent (page « Armes ») : l'arme, sa composition, son amélioration, son élément et l'amélioration de
  l'élément, et les **dons passifs acquis** dont le texte dit quelles armes ils visent (`lib/degats-texte.mjs` : famille, type de dégâts, armes de corps à corps,
  toutes les armes ; formule « 3+x […] x = +2 dégâts/6 niveaux » au niveau de la classe). Le détail est en infobulle, avec les bonus de dons qui ne se
  comptent pas (situation, au choix, deux armes, bouclier, armes visées non écrites : « augmente les dégâts de 3 » de Tir renforcé, par exemple).
- **Solidité des armes** (décision R74 : « Un slider qui va de 0 au max de l'arme. A zéro, l'arme est cassée ») : sous chaque arme, un **curseur** de 0 au
  maximum de l'arme forgée et « N / M » à côté (clic droit ou Entrée : saisir le nombre) ; le maximum est celui de la page « Armes » (R51 : crans de l'arme,
  de sa composition et de son amélioration, au moins 1 ; l'élément n'est pas compté, question Q12), le détail en infobulle (`durabiliteDArme`). La fiche ne
  garde que ce qui manque : à son maximum, rien (`personnage_arme.durabilite` NULL, `durabiliteAEcrire`) ; une autre arme est neuve (`armesApresChoix`), une
  autre composition ou amélioration ramène la solidité sous le nouveau maximum (`armesApresReglage`, une arme pleine le reste ; `armesValables` à
  l'enregistrement). À 0, la pastille des dégâts est **grisée** et dit **« Cassée »**, ses dégâts (réparée) en infobulle ; ils restent comptés ailleurs (tableur,
  attaque à deux armes). Pas de curseur pour une arme de monstre (sans solidité, R45). Le moteur recopie le calcul de `lib/arme-forge.mjs`, que son script ne
  peut pas importer (le script de la page Armes l'importe) : `test/fiche-durabilite.test.mjs` compare les deux sur toutes les combinaisons de la base.
- **Attaque à deux armes** (décision R46, `attaqueADeuxArmes`) : avec deux armes de mêlée, une **étoile** à côté des dégâts de chaque arme donne son malus en
  infobulle (« −10 % si ambidextre ») : −20 % main directrice (l'arme 1), −40 % main secondaire, moitié pour la main qui tient une dague, moitié pour un
  Bimane, cumulables ; Équilibré et Équilibre s'en retranchent (texte des dons), Directrice, Fausse Patte et Ravageur sont signalés. Plus de case « Ambidextrie ».
- **Postures et Mode Hyper** : une **case par posture**, ses effets toujours lisibles, **avantages en vert, inconvénients en rouge** (décision R47,
  `posture_effet.inconvenient`), sur deux lignes : Offensif, Neutre, Défensif, puis Focus, Vigilance, Symbiose (`regles.ordre_postures`) ; un clic choisit la
  posture du moment. À droite, une fois débloqués (`modeHyperDe` : niveaux 2 et 10, page « Liste des effets mode hyper »), les cases du **Mode Hyper** (effets
  de base de la fiche, décision R5 ; effet de la magie, « Mono-Magie » ou « Bi-magie » ; effet de la race, R13) et du **Mode Hyper 100 %**, pour lecture.
- **Méditation ou Repos** : le don de base de la race s'affiche sous son nom (`donDeBase`), en tête des dons raciaux.
- **Compétences** : six blocs sur deux colonnes remplies de haut en bas, comme la fiche auto : Force, Volonté, Intelligence ; Perception, Social, Agilité.
- **Métier** (décisions R33 à R40) : dans l'onglet « Choix », ce que donne le métier choisi (`bonusDuMetier`, `artisanatDe`, `objetsDuMetier`) — ses
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
  Sang), puis la corruption, sur une ligne ; initiative, vitesse et vitesse de nage en **tuiles** (zone 3) ; santé **rouge**, barrière **jaune**,
  chakra **bleu**, corruption **noire** ; pas d'armure de base (les AP/AM viendront avec l'armure portée). Pas de texte de calcul (demande du propriétaire) : le
  détail d'un maximum est en infobulle sur sa valeur. Une valeur du moment s'affiche « actuelle / maximum », un curseur de 0 au maximum (au maximum tant qu'on n'y touche
  pas, la corruption à 0 ; le chakra actuel au plus chakra − corruption, sauf avec la magie de la Corruption, et la corruption qui monte emporte le chakra
  actuel, celle qui baisse ne le rend pas : `valeursDuMoment`, `ecrireValeurDuMoment`, guide « Fiche de personnage : Attributs »), et deux boutons **−** et
  **+** qui ouvrent une case où saisir le nombre à retirer ou à ajouter (`ajusterValeurDuMoment`, borné comme le curseur ; Entrée ou OK l'applique, Échap
  abandonne). La posture du moment se choisit dans les cases des postures (zone 3 ; un second clic la retire) : la fiche la garde (`personnage.posture_id`,
  migration `0027-posture-du-moment`).
- **Résistances et faiblesses**, dans la zone 3 (demande du propriétaire, sur le modèle du tableau « Résistance / Faiblesse (Magie et Altération
  d'état) » de la fiche auto, `Personnage!BA2:BI12`) : les six paliers (`resistance_palier` : immunité, grande résistance, résistance, vulnérabilité, grande
  vulnérabilité, sensibilité, avec leur effet sur les dégâts), chacun avec ses magies, dans leur couleur, puis ses altérations d'état, cerclées de la couleur
  de leur magie ; le détail des crans en infobulle (`resistancesDe`). Une cible additionne ses crans (guide « Créer sa fiche », Tableau Résistances/Faiblesses :
  deux résistances font une grande résistance) : ceux des listes de la magie innée et de la magie acquise (`magie_resistance`, les listes des pages de magie et
  du guide ; l'Arcane et la Corruption se résistent l'une à l'autre, décision R90), et ceux que les dons écrivent
  (`lib/resistance-texte.mjs` : dons de la race et de l'ethnie de l'onglet, R13 — « 1 cran de résistance en plus à la magie innée et son altération d'état »,
  « Résistance à la magie du Sang », colonne « +1 cran de résistance » du Drakos —, dons de classe débloqués — « Augmente d'un cran la résistance à la magie
  innée et à son altération d'état » du Clerc). Une immunité écrite (« Immunisé contre le poison » du Mort-Vivant) range la cible en immunité ; une résistance
  au choix ou aléatoire (Drakos Orange, Anansi d'Arcane, Ocultomancien) n'est pas comptée et la fiche le signale sous le tableau. Pas encore : les objets.
  Les résistances et faiblesses des combinaisons de deux magies (R85, vue `v_resistance_combinaison`) iront dans un onglet « Statistiques » de la fiche,
  une fois la fiche finalisée (demande du propriétaire, 2026-10-16) : rien n'est affiché d'ici là.
- **Caractéristiques** : les six sur une seule ligne, chacune avec **deux cases de croix** (cochées = le nombre de croix, R19) ; à deux croix, le score des
  compétences est « N/A ». L'acquis d'une compétence va jusqu'à 5 par point de la caractéristique **totale**, le +1 de la magie innée compris (décision R41).
- **Maîtrises d'armes** : un curseur étroit par famille (0 à 4 points), les dés à côté (`notationDesDes`) ; pas de ligne pour « ARME DE MONSTRES », des armes
  exclusives aux monstres (décision R45, `arme_famille.maitrisable`, `famillesMaitrisables` ; une maîtrise déjà posée n'est ni comptée ni enregistrée : `maitrisesValables`) ; le **Pugilat** montre le seul dé de la Force du
  personnage, +1 de la magie innée compris (`deDeLaFamille` : « D6 1-2 Force, D8 3-4 Force, D10 5 Force », note de la famille, lue par
  `lib/maitrise-arme.mjs#desSelonLaForce`) ; dans le coin du bloc, les points répartis sur le **quota** des classes et de leurs dons (décision R32,
  `quotaDeMaitrise` ; sources en infobulle).
- **Sorts** : un tableau d'une ligne par emplacement, sans emplacement en plus (décision R27), chacune avec la liste des sorts possibles moins ceux des autres
  lignes (`lignesDeSorts`), groupée par NPM, le nom seul, chaque sort sur la couleur de sa magie comme sur les pages de magie, la liste fermée dans celle du
  sort choisi (`sortsParNpm`, demande du propriétaire) ; les **NM** d'un sort se notent par origine (de niveau, d'un livre — un par sort —, du MJ), 3 au plus
  sur un sort (décisions R24, R26). Colonnes (demandes du propriétaire) : coût, portée et **dégâts/soins/barrière**, à la **valeur du NM du sort** plutôt que
  « (+1/NM) » (`lib/sort-maitrise.mjs#valeurAuNm` : voir `content-guide.md`, « Niveaux de maîtrise ») ; pas de colonne NPM ; l'**effet secondaire** sur sa
  propre ligne, sous le sort (au NM aussi) ; une **étoile** quand le sort a une remarque, son texte en infobulle.
- **Dons débloqués**, à côté des sorts : les **dons raciaux** — le don de base d'abord, puis le don de l'ethnie (`race_don`) et la ligne de l'ethnie dans le
  tableau de dons de la race (Drakos, Mort-vivant) : `donsDeRace` — puis les **dons de classe débloqués**, classe par classe : dons de la classe et de la
  spécialité choisie jusqu'au niveau de classe, dons à choix choisis (`donsAcquis`), avec leur niveau et leur type (passif, actif, action, réaction).
  Entre les deux, l'**entraînement** (décision R71, `personnage.entrainement`) : un texte libre — bonus d'entraînement, livres de magie lus, ce que le MJ
  accorde —, **jamais compté** (les points gagnés se saisissent dans l'acquis, le NM d'un livre sur son sort) ; son aide cite, tel que la base l'écrit, le
  paragraphe du guide « S’entraîner et exercer un métier » (chapitre 21) qui en dit les limites (`lib/fiche-regles.mjs#aideDeLEntrainement`, écrit dans la page
  au build ; en texte : sans gras ni italique, un lien par son texte, un lien du wiki sans texte par le titre de sa page ; rien si la page ne l'écrit plus).
- **Gains de niveau** (décision R73) : deux champs, la santé gagnée (bordée de rouge) et le chakra gagné (de bleu), jamais négatifs ni vides, et à côté le
  **total attribué** et le **total à saisir** — « entre min et max » quand un dé bonus est atteint —, en rouge hors de la plage (`gainsDeNiveau`, les mêmes
  bornes que la règle `gains_niveau` de la base : `test/fiche-moteur.test.mjs` les compare aux niveaux 1 à 20) ; au-dessus, d'où vient le total : les points
  par niveau et les dés atteints, leur texte et ce que chacun ajoute (`gainsAttendus`, tout lu dans `regles.niveaux`). Visible dès le niveau 1 (rien à
  saisir) ; pas dans les choix à faire.
- **Couleurs des cadres** : la bordure et le bandeau du titre de chaque bloc, le portrait et le médaillon du niveau prennent la couleur de la magie innée, en dégradé vers celle de
  la magie acquise (demande du propriétaire) ; sans magie innée, celle de la partie du guide. Seuls les cadres changent : caractéristiques, attributs,
  pastilles et curseurs gardent leurs couleurs.
- **Niveau** : la **jauge d'XP** (`progressionXp`) ouvre le bloc de progression : l'XP se modifie dans son champ ou s'ajoute avec le bouton +, le niveau
  suit (rappelé dans la barre d'enregistrement).

Une fiche enregistrée se **supprime** (bouton « Supprimer », après confirmation ; retour à la liste des personnages). Chaque caractéristique, et le tableau de ses compétences, a sa couleur
(demande du propriétaire, `lib/caracteristiques-postures.mjs`, transmise par `regles.json` : `couleur` et `texte` de chaque caractéristique). Le **Potentiel Illimité** en magie innée met l'Archimage en classe 1
et l'y **verrouille** (les autres classes 1 sont grisées, la pastille de l'Archimage ne se retire pas) ; sans lui, l'Archimage est grisée à tous les rangs,
et quitter le Potentiel Illimité la retire (décision R23) ; le Mage Bleu lui est fermé, à tous les rangs (décision R25), toute autre seconde classe reste permise. Les dons à choix d'une classe ou d'une spécialité retirée partent avec elle, comme un don qu'aucun choix des règles ne range (supprimé ou devenu reçu d'office sur le site de dev, D11) ; un don, une spécialité, un sort, un métier ou une arme que les règles suppriment est retiré de la fiche par le service, avec sa note datée (R42, R52, ci-dessous « Quand les règles changent »). Tout ce que la base
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
  scores de compétences (10 × caractéristique + naturel + acquis, croix R19), plafonds et budget ; gains de niveau à saisir (`gainsAttendus`,
  `gainsDeNiveau`, R73) ; solidité des armes (`durabiliteDArme`, R74) ; classe magique (R6, R7) ;
  attributs comme la fiche automatique (santé, chakra, barrière, vitesse, armure de base, initiative, 4ᵉ barre, Corruption) et valeurs du moment
  (`valeursDuMoment`, `ajusterValeurDuMoment`) ; alignement (`alignementDe`) ; dé d'une famille d'armes selon la Force (`deDeLaFamille`) et quota de
  maîtrise (`quotaDeMaitrise`, R32) ; emplacements de sorts
  (conditions × puissance magique, R16), sorts possibles, NM ; dons à choisir selon la classe, la spécialité et le niveau de classe ; dons de classe
  débloqués (`donsAcquis`) et dons de la race (`donsDeRace`) ; résistances et faiblesses (`resistancesDe`).
- **Accessoires** (demande du propriétaire : « l'accessoire influe sur le reste de la fiche » ; décision R54) : ce que chaque effet change est dans la table
  `accessoire_effet_cible` (migration `0037`, découpage `lib/accessoire-champs.mjs`, comme les armes) ; `effetsDesAccessoires` le lit pour les accessoires
  portés, signé par la malédiction (effet contraire). Caractéristique : +1, sans dépasser 4 ni la borne de la race ; « Compétence X » : la valeur tirée en
  Acquis d'une compétence de cette caractéristique choisie sous l'effet (`personnage_accessoire.competence_id`), rognée au plafond après le métier ;
  santé, chakra, barrière, initiative, vitesse, 4ᵉ barre, AP et AM de base ; dégâts physiques de toutes les armes et dégâts de la famille choisie
  (`arme_famille_id`), portée des armes à distance (infobulle des dégâts) ; « Dégâts magie » et portée sur les sorts (`accessoiresDesSorts` : dégâts des
  seuls sorts d'attaque, `sort_type`) ; point de maîtrise (`quotaDeMaitrise`) ; tour de Mode Hyper ; un cran de résistance par cible (`resistancesDe`).
  Un choix qui manque est dans le tiroir (`choixEnAttente`, nature `accessoire`). Les effets « (Action) » et à usage compté (`accessoire_effet.usage`)
  sont rappelés à la suite des dons de race, sous le même format (`actionsDesAccessoires`). Sous chaque effet, ce qu'il change en quelques mots.
- **Contrôle** : à chaque enregistrement, le service rend les règles de `v_personnage_controle` que la fiche enfreint, affichées en français
  (`lib/fiche-controles.mjs`) : elles signalent, elles n'empêchent jamais d'enregistrer, et toute fiche est contrôlée, même inachevée (une fiche n'a
  plus de statut brouillon / validé / archivé : demande du propriétaire, migration 0038). Ce que la base ne contrôle pas encore (bonus d'équipement, nombre de
  sorts par emplacement, plafond de NPM du Potentiel Illimité) n'est montré que comme compteur.
- **Enregistrement** : création (`POST`) puis modification (`PUT` avec la version lue : si quelqu'un a modifié la fiche entre-temps, rien n'est écrasé et
  la page propose de la recharger), suppression (`DELETE` avec la version lue). Sans le service (service arrêté), ou quand il refuse
  l'enregistrement (version changée entre-temps, requête trop volumineuse, fiche refusée), la fiche se remplit et se **télécharge** (« Télécharger »
  reste alors actif, pour ne rien perdre) ; le classeur téléchargé se **réimporte** pour créer le prétiré (ou, après rechargement, mettre à jour le
  prétiré ouvert). La barre,
  le classeur et Google Sheets : voir « Tableur » ci-dessous.
- Avant la 1.0, la page ne crée que des **prétirés** (à personne, visibles de tous) : les fiches de joueur arriveront avec la connexion Discord.

### Tableur : export et import (demande du propriétaire, 2026-10-15)

> La fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle.
> Le portrait peut remplacer l'icône du logo en haut à gauche. Inutile de mettre les formules dans le fichier généré, seul le résultat.
> Évidemment toutes les infos ne rentrent peut-être pas dans ces fiches-là. Toute info supplémentaire peut être notée dans les « Notes ».

La barre (demande du propriétaire, 2026-10-15 : « [Nouveau] => Inchangé ; [Exporter(Tableur)] => [Télécharger] Le nom du fichier deviens juste nom
du personnage. Grisé tant que la fiche n'a pas été enregistrée ; [Exporter(Json)] =>[Exporter] Exporte sous le format Google Sheet. ; [Importer] =>
[Importer(PC)] Demande un fichier Xlsx ; [Imprimer] => [Importer(EnLigne)] Demande l'url d'un Google Sheet. » ; précisions choisies : Exporter =
« Créer un Google Sheet en ligne », Importer (en ligne) = « Feuille partagée par lien ») : **Nouveau**, **Télécharger**, **Exporter**, **Importer
(PC)**, **Importer (en ligne)**, Supprimer. Plus d'export ni d'import en JSON (un ancien `.json` choisi par « Importer (PC) » est refusé en le
disant), plus de bouton « Imprimer » (Ctrl+P reste possible : la mise en page d'impression ne change pas).

- **Télécharger** : le classeur `.xlsx` au modèle ci-dessous, nommé d'après le personnage seul (`nomDuFichier` de `lib/fiche-tableur-export.mjs` :
  chaque suite de caractères qu'un système de fichiers refuse remplacée par « - », 120 caractères au plus, « Personnage » s'il ne reste rien ;
  « Kaël/Nox » → `Kaël-Nox.xlsx`). **Grisé** tant que la fiche n'est pas enregistrée telle qu'elle est (jamais enregistrée, ou modifiée depuis ;
  infobulle « Enregistrez la fiche pour la télécharger »), sauf quand le service ne répond pas, ou qu'il a **refusé le dernier enregistrement**
  (toute réponse non OK : version changée entre-temps — 409, la fiche ouverte dans un autre onglet, ou un retrait R42 —, requête trop volumineuse —
  413 —, fiche refusée — 400 — ; infobulle « L’enregistrement a échoué : téléchargez la fiche pour ne rien perdre ») : la fiche ne peut alors pas être
  enregistrée, et la télécharger évite de la perdre (`etatDesExports`, recalculé par `etatDesBoutons` de `src/scripts/fiche.mjs` à chaque
  rafraîchissement et à la fin de chaque action ; le refus est oublié quand une autre fiche est à l'écran : relue, enregistrée, rechargée, nouvelle, ou
  nouveau prétiré tiré d'un classeur). Message : « Classeur téléchargé. », suivi de ce que le classeur n'a pas pu garder.
- **Exporter** (Google Sheets) : le même classeur, envoyé dans le Drive de la personne et converti en **nouvelle feuille Google Sheets** à chaque
  export (nommée d'après le personnage). Même condition de grisé que « Télécharger » (après un refus : « L’enregistrement a échoué : exportez la
  fiche pour ne rien perdre ») ; grisé aussi sans **identifiant client OAuth** (variable de
  build `SITE_GOOGLE_CLIENT_ID`, infobulle « Export vers Google Sheets pas encore configuré » ; mise en place : [`deploy/vps/README.md`](../deploy/vps/README.md),
  « Export vers Google Sheets »). La page charge **Google Identity Services** (`https://accounts.google.com/gsi/client`, créé par
  `document.createElement` dès que le pointeur ou le focus approche du bouton : ni balise dans le HTML ni import), demande le droit
  `drive.file` (le site ne voit que les fichiers qu'il crée) dans le clic même (`requestAccessToken`, sinon le navigateur bloque la fenêtre de
  connexion : un message invite alors à cliquer de nouveau), garde le jeton **en mémoire** jusqu'à son expiration (jamais enregistré, jamais
  envoyé au service), puis envoie le classeur à l'API Drive (`POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
  `corpsMultipart` de `lib/google-sheets.mjs`). Message « Feuille Google créée. », le rappel « pour la réimporter ici, partagez-la par lien », et un
  lien « Ouvrir dans Google Sheets » (une fenêtre s'ouvre aussi quand le navigateur le permet). La page `/fiche/` porte `<meta name="referrer"
  content="strict-origin-when-cross-origin">` (le reste du site garde `Referrer-Policy: same-origin`).
- **Importer (PC)** : un `.xlsx` (le chemin de l'import ci-dessous ; la lecture sait aussi les `.ods` et `.csv`, que le sélecteur ne propose plus).
- **Importer (en ligne)** : un dialogue (`#import-en-ligne`) demande le lien d'une feuille Google Sheets **partagée par lien** (« Partager », Accès
  général « Tous les utilisateurs disposant du lien ») ; le lien est vérifié dans le dialogue (`idDeFeuille` : `https://docs.google.com/spreadsheets/d/<id>…`),
  puis le **service** télécharge la feuille au format `.xlsx` (`POST /api/classeur/`, [`serveur.md`](serveur.md) ; une page ne peut pas la lire
  elle-même) et la page l'importe comme un classeur de l'ordinateur (dialogue « import-cible », notes datées au nom de la feuille). Une feuille
  non partagée, un lien d'autre chose, une feuille trop grosse : le message du service le dit ; service injoignable : télécharger la feuille
  depuis Google Sheets (Fichier › Télécharger › Microsoft Excel), puis « Importer (PC) ».
- **Version portable** : « Télécharger », « Exporter » et « Importer (en ligne) » masqués (`tools/build-artifact.mjs` : ni téléchargement, ni
  fenêtre de Google, ni service dans un cadre isolé) ; « Importer (PC) » reste.
- **À vérifier avec le vrai Google** (rien n'a pu être essayé contre Google : les tests et la vérification dans Chromium remplacent Google par
  des faux) : la connexion et la création de la feuille sur `dev.maverick-jdr.com`, puis « Importer (en ligne) » de cette feuille partagée par
  lien — ce que la conversion de Google garde du classeur (portrait et sa description « portrait:<empreinte> », couleurs des maîtrises, notes).

- **Le modèle** : « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » du propriétaire, rangé en texte dans `client/src/modeles/fiche-personnage/`
  (14 parties fabriquées par `tools/fiche/modele.py` depuis son `.ods` : aucun classeur binaire dans le dépôt ; fins de ligne LF, `.gitattributes`),
  assemblé au build en `/fiche/modele.xlsx` (`lib/fiche-modele.mjs`, `pages/fiche/modele.xlsx.ts`, mêmes octets d'un build à l'autre). Feuille unique
  « Personnage », A1:BZ75, aucune formule ; le logo (A1 → E5) est marqué « Logo » / « logo ». Les adresses des cases, de ce modèle et de la fiche
  auto, sont dans `lib/fiche-tableur-cases.mjs`.
- **Export** (`lib/fiche-tableur-export.mjs`, `cellulesDeLaFiche`) : les valeurs de la fiche, calculées par les mêmes fonctions du moteur que la
  page, jamais une règle de plus. Deux sommes pour l'affichage, comme la fiche auto : bonus d'une caractéristique = magie + accessoires (G18,
  correction 9 de [`fiche-auto.md`](fiche-auto.md)), acquis d'une compétence = acquis du joueur + bonus du métier (R33, rogné au plafond : R38) +
  accessoires (R54) ; dégâts de l'arme forgée (R49) ; portée d'une arme, celle de la page
  « Armes » (R50 : la portée écrite, 1 par défaut), plus celle des accessoires ; « Deux armes : −N % » dans l'effet de l'arme (R46) ; sorts au NM du
  sort ; paliers de résistance et leur effet tels que la base les écrit (R70). **Restent vides** les cases que la fiche ne calcule pas : AP, AM et
  solidité des pièces d'armure et du bouclier. La **solidité d'une arme** (AK17, AX17) s'écrit « N / M » : la solidité du moment et le maximum de
  l'arme forgée (R74, `durabiliteDArme`, le calcul R51 de la page « Armes ») ; une arme cassée, « 0 / M », garde ses dégâts en AG10 (ils départagent
  deux armes du même nom à l'import) ; une arme de monstre (sans solidité, R45) laisse le « / » du modèle. La case **« Entraînement »** (L42) porte le
  texte libre de la fiche (R71, `personnage.entrainement`), tel quel, blancs de bord retirés ; le nom et le type du modèle restent. Les dés de maîtrise
  atteints sont remplis de gris (`REMPLISSAGE_DE_ATTEINT`), la posture du moment marquée « ✔ ». Ce qui n'a pas de case (bi-classe, caractéristique du
  Potentiel Illimité, gains de niveau — deux totaux, R73 : « Gains de niveau : santé X, chakra Y » ; la note d'un classeur exporté avant, niveau par
  niveau, se relit sommée, le dé « les deux » sur chacun —, NM offerts de livre et
  du MJ (R26), accessoires de ceinture et « autre », dons, sorts, objets et événements au-delà des places du modèle : 7 dons par classe, 20 sorts,
  48 objets, 4 événements ; un événement par ligne non vide de `evenements`, blancs de bord retirés : lignes vides et retraits ne reviennent pas) va dans la case **NOTE**, sous les notes du joueur et la ligne `MARQUEUR_DES_NOTES`, en lignes « Clé : valeur » que
  l'import relit ; suivent des lignes d'information refaites à chaque export (résistances au choix, « Mode Hyper 100 % : débloqué », choix à faire),
  que l'import ignore. La note ne porte que des **données du personnage**, jamais un texte de règles. Le classeur est écrit par
  `lib/tableur-ecriture.mjs` (le modèle, ses styles gardés, les valeurs, les fonds, la taille des polices réduites, le portrait).
- **Écritures courtes** (pour que les cases que l'import relit tiennent d'ordinaire) : un accessoire, son nom en première ligne, puis l'effet sur
  une ligne, « <libellé>[ = valeur][ → compétence ou famille choisie] » (« <propriété> : » devant seulement quand le libellé seul ne suffit pas :
  vide, comme « Attaque : », ou partagé par plusieurs propriétés, comme « MALÉDICTION »), « Effet : <texte> » pour l'effet hors table, « Maudit »
  sur sa ligne ; une pièce d'armure par ligne (AQ21), « [<Emplacement> : ]<armure> · amél. niv. N (effet) · élément <nom> · amél. élément niv. N
  (effet) » (l'emplacement omis pour l'armure complète), avec les statistiques du catalogue (AP, AM) quand la case les tient, sans elles sinon, puis
  sans l'effet des améliorations ; « Nom Armure » (AD22) : l'armure complète, sinon les noms des pièces. Une case d'une seule rangée (description et
  colonnes d'un sort, dons de base, de race et du métier) écrit ses parties sur une ligne, séparées par « · ». L'import lit aussi l'ancienne
  écriture (« Caractéristique : Force » puis « → … » sur sa ligne ; « Torse : … · Amélioration : niv. 1 — … » ; parties sur plusieurs lignes).
- **Textes trop longs** (« toute info supplémentaire peut être notée dans les Notes ») : la page lit la taille des cases du modèle
  (`zonesDuClasseur`) et mesure chaque texte (`lib/tableur-mesure.mjs` : chasses de Calibri et d'Arial). Une case de plusieurs rangées prend le retour
  à la ligne ; une case d'une rangée rapetisse son texte (réduction au besoin, jusqu'à 60 %, comme les noms et types de dons du modèle) ; s'il ne tient
  toujours pas, la case en garde le début, fini par « … », écrit à 60 % (comme ses voisines réduites de la même colonne). Chaque case est **relue**
  (l'import en tire un choix du personnage : noms, sorts et NM, noms des dons, accessoires, ceinture, inventaire, événements, pièces d'armure,
  composition, améliorations, élément, effet en plus et solidité d'une arme, choix du métier, entraînement…) ou **affichée** (un texte de règles ou un
  calcul que le site
  refait : type, coût, portée, zone et description des sorts, type et effets des dons, textes de la race, don de base, artisanat, Mode Hyper,
  résistances, dégâts, effet du catalogue d'une arme, titres…). Une case affichée coupée perd sa fin, **sans rien dans la note** ; seule la part
  relue d'une case coupée a une suite dans la note (« Suite de la case AA51 : … », sauts de ligne en « ⏎ »), que l'import recolle avant de lire la
  case. Une case à la fois relue et affichée écrit d'abord ses lignes relues : l'effet d'une arme (AA13, AN13) donne la composition, les
  améliorations, l'élément et l'effet en plus, puis l'effet du catalogue, « Deux armes » et « Non compté » (`partiesDeLArme`) ; le métier (L41), les
  rangs à choix « → compétence », puis les autres rangs et l'artisanat (`partiesDuMetier`). Un texte affiché coupé sert encore à départager deux
  homonymes (sorts, armes) par son début. Une note qui déborde elle-même s'aligne en haut : ses premières lignes restent lisibles à l'impression.
  Google Sheets ne réduit pas un texte : il rogne ce qui dépasse.
- **Plus de 32 767 caractères** (ce qu'une case de tableur garde) : dans la case NOTE, le marqueur et les lignes qui le suivent restent toujours
  entiers ; les notes du joueur sont raccourcies (fin remplacée par « … »), puis, s'il le faut encore, les dernières lignes de données retirées
  (une dernière ligne « Lignes retirées (case NOTE pleine) : N » le dit, et l'import le rappelle).
  Chaque perte est un avertissement (`avertissements` de `cellulesDeLaFiche`) que la page ajoute à son message : « Classeur téléchargé. Notes trop
  longues pour une case de tableur (32 767 caractères) : les N derniers caractères ne sont pas dans le classeur. » (« Télécharger » ; « Feuille Google
  créée. Notes trop longues… » pour « Exporter »), sur le ton « attente » (au lieu de « ok », `messageDExport`). À l'import, une remarque le dit.
- **Portrait** : la vignette cadrée de la page (JPEG) remplace le logo en A1, décrite « portrait:<empreinte de l'image d'origine> » ; sans portrait,
  le logo reste, décrit « logo ». Le fichier s'appelle « <nom du personnage>.xlsx » (`nomDuFichier`, plus haut).
- **Lecture** (`lib/tableur-lecture.mjs`) : `.xlsx` (Excel, Google Sheets, LibreOffice), `.ods` (LibreOffice ; les blancs d'une case lus comme
  LibreOffice les relit), `.csv` (« ; », « , » ou tabulation ; UTF-8, UTF-16 ou Windows-1252) ; aucune formule évaluée (le résultat en cache) ;
  d'un `.xlsx`, une date se lit JJ/MM/AAAA et un pourcentage « 18 % » (un `.ods` porte le texte affiché) ; un `.xls` ou un classeur protégé par mot
  de passe est refusé en le disant. Bornes, pour un onglet de navigateur : 16 Mio par partie et 64 Mio en tout une fois décompressés (tailles
  annoncées vérifiées avant toute décompression, puis tailles réelles), 500 000 cases par feuille, 40 000 caractères par case (au-delà, la case est
  coupée et l'import le dit).
- **Import** (`lib/fiche-tableur-import.mjs`, `ficheDuClasseur`) : l'onglet « Personnage » s'il suit le modèle ordinateur ou la **fiche auto
  V15.2.2** (voir [`fiche-auto.md`](fiche-auto.md)), sinon le premier onglet qui suit l'un des deux (`feuilleDeLaFiche` : un onglet renommé ou
  déplacé est retrouvé à son contenu, et le message le nomme). Un nom se retrouve dans son contexte (sorts : les magies du personnage ; dons et
  spécialités : la classe ; ethnie : la race…), par sa clé puis par l'ancienne graphie gardée dans l'identifiant (depuis la migration 0006, un nom
  corrigé garde son identifiant : « Démon d'Eau Noire » mène à Eaunoire, R21, migration 0012) ; rien n'est rapproché par vraisemblance. Puis la même chaîne que la
  page (caractéristiques complètes, ethnie imposée, magie acquise valable, classes selon la magie innée, dons et choix de métier valables,
  maîtrises). Les écritures de la page (lignes de la note, objets, accessoires, armure, effet d'une arme, choix du métier) se relisent par les
  lecteurs de `lib/fiche-tableur-export.mjs`, qui les écrit (un seul jeu de lecteurs ; la fiche auto a les siens). Ce que la fiche calcule n'est
  pas relu, sauf pour retrouver un choix que le classeur n'écrit pas, dit dans `remarques` (sauf le mode bi-classe et la spécialité tirée d'un don
  de spécialité) :
  - **bi-classe** : la ligne de la note ; sinon deux classes au niveau global, sous le niveau 20 (R2 : en mono-classe, la classe 1 est à deux fois
    le niveau global, 20 au plus ; au niveau 20, les deux s'écrivent pareil : mono-classe) ;
  - **acquis du joueur** = acquis écrit − bonus du métier − accessoires (R54). Le bonus du métier retiré : pour un classeur de la page, celui de la
    base (R33, rogné au plafond : R38), qu'elle a écrit ; pour un classeur qui n'en vient pas (fiche auto, modèle rempli à la main), **celui qu'écrit
    sa case L41** (R72 : « Le métier suit la base » — l'ancien bonus est retiré, brut, le site ajoute celui de la base, le joueur ne garde que ses
    points ; `bonusDuMetierEcrit`). Lucien : Connaissance 0 au joueur (4 écrits, « 4% Connaissance »), affichée 3 ; Louise : Esquive, Réflexe et Ruse
    0 (« +2% Reflexe, Esquive et Ruse »), affichées 3, 3 et 0. Une remarque de synthèse quand l'ancien bonus n'est pas celui de la base (« Métier
    Acrobate : le classeur comptait Esquive +2, Réflexe +2, Ruse +2 ; la base donne Esquive +3, Réflexe +3 : les acquis suivent la base (R72) ») ;
    une case L41 qui ne se lit pas exactement (liste en « OU » sans « → », liste où se mêlent compétences et autres mots, nom de compétence écrit
    avant son « N% » (« Esquive +3% ») ou pris dans d'autres mots (« aux jets d'Esquive »), nombre précédé d'un signe moins, décimal, case coupée
    dans un bonus) : le bonus de la base, et « à vérifier » si le métier en donne un ; un métier introuvable : son ancien bonus est retiré quand même, et
    dit. L41 se lit comme la page l'écrit (rangs à choix « … → Compétence », « → ? » pas choisi ; l'artisanat « = N % » n'est pas un bonus) et comme
    la fiche auto (« 4% Connaissance. … », « Bonus +2% Reflexe, Esquive et Ruse. ») ; le test relit la case de chaque métier de la base, pour chaque
    choix. Une remarque par compétence touchée pour un classeur qui ne vient pas de la page (« Connaissance : acquis 4 du classeur − 4 du métier
    Écrivain (classeur) = 0 au joueur »), et toujours quand l'acquis écrit est plus petit que ces bonus (« 0 au joueur ») ;
  - **gains de niveau** (classeur qui ne vient pas de la page, sans la ligne de la note) : deux totaux (R73 : « gains = maximum lu − le reste du
    calcul »), le maximum de santé et de chakra lu (fiche auto : F14, M14 ; modèle ordinateur : le « b » de « a / b ») moins ce que la fiche calcule
    sans gains (race, ethnie, magies, classes, accessoires : `gainsDesMaximums`) ; une remarque dit la déduction (« Gains de niveau déduits des
    maximums du classeur (santé 60, chakra 150) : santé 41, chakra 121 »), « à vérifier » quand un maximum est sous ce calcul (ramené à 0) ou que le
    total sort de ce que donnent les niveaux atteints (« : hors du total à saisir (152 à 166), à vérifier » : `gainsDeNiveau`, la règle
    `gains_niveau`) ;
  - **NM** : une fiche auto ne dit pas lesquels viennent d'un livre ou du MJ (R26) : tous comptés de niveau, et dit si cela dépasse ;
  - élément d'armure écrit par sa magie (fiche auto) : l'armure élémentaire de cette magie et de la catégorie de l'armure ; caractéristique du
    Potentiel Illimité d'après le bonus ; compétence d'un accessoire « Compétence X » de la fiche auto d'après la case « Entraînement » ; sans
    remarque, la composition d'une arme absente : le fer (R49), comme sur la page.
  Un nombre : celui qu'écrit la case quand elle montre « % » (« 20% » = 20) ; un décimal où la fiche veut un entier est arrondi vers le bas (une
  remarque). **Rien ne se perd sans être dit** (`nonRepris`, une ligne par information avec sa valeur) : nom introuvable ou ambigu, ce que la chaîne
  de la page retire, la case « Ambidextrie » de la fiche auto (l'attaque à deux armes est calculée, R46) ; dans le modèle ordinateur, les saisies
  sans place sur le site (grille AP/AM/Sol des pièces, AP, AM et solidité du bouclier, sac de l'inventaire en AA38), une solidité d'arme illisible,
  sans arme reconnue ou pour une arme sans solidité (arme de monstre), une ligne de « Bonus/ Malus » (AQ21) qui n'est pas une pièce d'armure, une
  ligne de note en double (la première compte), une image hors de A1 ou une seconde image. **Relus** aussi : l'**entraînement** (L42, R71), dans les
  deux dispositions, tel quel (recollé à sa suite dans la note quand la page l'a coupé) ; dans le modèle ordinateur, la **solidité** de chaque arme
  (AK17, AX17, R74 : « N / M » lu sur la ligne d'arme finale, composition et amélioration relues ; à son maximum ou au-delà, rien d'enregistré ; le
  « / » du modèle n'est pas une valeur ; un décimal arrondi vers le bas, dit) ; la « Solidité » de la fiche auto (AK15, AX15) n'est qu'un maximum
  calculé, jamais relu. Remarques encore : un maximum de solidité écrit autre que celui du site (R51) ; « Nom Armure » (AD22, toujours lu) qui ne
  nomme pas les pièces de AQ21 ; lignes libres sous « Effet en
  plus » (AA13) reprises comme effet en plus de l'arme ; case relue finie par « … » sans sa suite dans la note, quand la page a dû retirer des lignes de données (sinon le « … » est celui du joueur) ; case NOTE pleine ; un `.csv` du
  modèle ordinateur ne porte pas les couleurs des maîtrises (`REMARQUE_MAITRISES_CSV`). Le type d'un événement (colonne I, rangées 71 à 74) entre
  dans son texte, « titre (type) : texte ». Dans la note, c'est le **dernier** marqueur qui compte (des notes collées peuvent en contenir un). Le
  tout s'ajoute à la fin des notes, sous une ligne « [JJ/MM/AAAA] Import du classeur « <fichier> » : » ; pour un fichier exporté par la page, il
  n'y a rien.
- **Où va la fiche importée** : le message « Lecture du classeur… » est retiré, puis, si un prétiré enregistré est ouvert, le dialogue « Importer la
  fiche » (`#import-cible`) propose de le **mettre à jour** (il garde son identifiant et sa version), de **créer un nouveau prétiré** (l'un et l'autre
  oubliés) ou d'annuler, en rappelant la perte des modifications non enregistrées ; sinon, une confirmation s'il y a des modifications. De même
  pour une feuille d'« Importer (en ligne) ». Rien n'est enregistré avant « Enregistrer ». Le **portrait** (`portraitDeLImport`) : celui de la fiche ouverte, avec son cadrage,
  quand le classeur porte son empreinte (exporté par la page avec ce portrait), ou pour une **mise à jour** depuis un classeur sans image (fiche
  auto, `.csv`, export sans portrait) ; sinon l'image ancrée en A1 qui n'est pas le logo du modèle, réduite comme une image choisie (cadrage par
  défaut ; illisible, elle est dite dans les notes et l'on fait comme sans elle) ; un **nouveau prétiré** tiré d'un classeur sans image n'a pas de
  portrait.
- **Messages** (`messageDImport`, `messageDExport`) : « Classeur importé (modèle ordinateur|auto[, onglet « <nom> »])[ : N informations sans
  équivalent et N remarques ajoutées aux notes]. Enregistrez pour mettre à jour « <nom> » | créer le prétiré. » (l'onglet n'est nommé que si ce
  n'est pas « Personnage » ; un `.csv` n'en a pas) ; une erreur : « Ce classeur n’a pas pu être lu : <raison> » ; l'export : « Classeur téléchargé. »
  (« Télécharger ») ou « Feuille Google créée. » (« Exporter »), suivi de ses avertissements (`messageDExport(avertissements, debut)` ; « Classeur
  exporté. » par défaut).
- **Aller-retour** (`test/fiche-tableur-aller-retour.test.mjs`) : export → `.xlsx` → lecture → import redonne la fiche, sans rien dans les notes, et
  l'export de la fiche relue redonne les mêmes cases, pour une fiche riche (débordements et textes coupés compris, une arme abîmée et une arme cassée,
  des gains de niveau, un entraînement long sur trois lignes, coupé, sa suite dans la note), une bi-classe au Potentiel
  Illimité, les personnages fil rouge du guide et les deux fiches auto du propriétaire ; des notes trop longues reviennent raccourcies, avec toutes
  leurs données ; par un `.csv`, tout revient sauf les maîtrises (une remarque le dit). L'aller-retour exact vaut pour le `.xlsx` ; les blancs d'une
  case d'un `.ods` se lisent comme LibreOffice les relit (`test/tableur-lecture.test.mjs`).
- **Modules** : `zip.mjs`, `xml-mini.mjs`, `tableur-lecture.mjs`, `tableur-ecriture.mjs`, `tableur-mesure.mjs`, `fiche-tableur-cases.mjs`,
  `fiche-tableur-export.mjs`, `fiche-tableur-import.mjs` (dans `client/src/lib/`) : purs, sans DOM ; parmi les scripts de page, seul
  `src/scripts/fiche.mjs` les importe (un module partagé entre deux scripts de page casse la version portable), jamais `lib/text.mjs` (`cle()` de
  `fiche-tableur-cases.mjs` le remplace) ; `fiche-modele.mjs` (Node : il importe `zip.mjs` pour assembler le modèle) ne sert qu'au build et aux
  tests. Ce que la page fait d'un classeur hors du DOM (onglet, portrait, messages, nom du fichier, état des boutons) est testé dans
  `test/fiche-tableur-page.test.mjs`. `lib/google-sheets.mjs` (Google : identifiant client, lien d'une feuille, envoi à l'API Drive) suit la même
  règle (seul script de page : `src/scripts/fiche.mjs` ; le service et la page Astro l'importent aussi), sans aucun import (`test/google-sheets.test.mjs`).
- **Décisions du 2026-10-15** (questions Q6 à Q11 de [`sql/a-valider.md`](sql/a-valider.md)) : les paliers de résistance sont ceux de la fiche auto
  et de la base, ÷2, ÷4, x2, x4, x8 (R70 : le modèle ordinateur, ÷3, x3, x4, se trompe ; l'export écrit ceux de la base) ; la case « Entraînement » est
  un texte libre de la fiche (R71) ; à l'import, le métier suit la base (R72) ; les gains de niveau sont deux totaux (R73) ; la durabilité d'une arme se
  note (R74) ; un texte de règles trop long est coupé par « … » (Q11).
- **Questions ouvertes** : « Vague déferlante » (Corruption et Arcane) reste ambiguë dans les lignes de la note d'un Potentiel Illimité qui aurait les
  deux ; maximum de solidité d'une arme élémentaire (Q12) et « Vieille Branche » du Mage Vert (Q13) : [`sql/a-valider.md`](sql/a-valider.md).

## La page `/personnages/`

La liste montre tous les prétirés, et seulement (demande du propriétaire, 2026-10-14) : **portrait** (le carré cadré de l'image, le logo en attendant ;
l'image vient de `GET /api/personnages/<id>/portrait/`, la liste n'en reçoit que l'empreinte et le style du cadrage), **nom**, **race**, **magies** (une
case : l'innée puis l'acquise, « Feu, Eau ») et **niveau** (trié par l'XP). **Toute la ligne est le lien vers la fiche** (le nom n'a pas l'air d'un lien),
et sa bordure prend la couleur de la magie innée, en dégradé vers celle de l'acquise en bi-magie (couleurs des pages de magie, posées au build :
`couleursDeBordure`). Chaque colonne sauf le portrait **se trie** dans les deux sens (bouton dans l'en-tête) ; filtres : texte (nom, surnom, origine,
sans accents), race, magie (innée ou acquise), classe (1ʳᵉ ou 2ᵉ), niveaux, règles à revoir. Ni phrase d'introduction ni bouton de création (la fiche
se crée depuis le menu, « Fiche de personnage »). Filtres et tri vivent dans l'adresse de la page : une recherche se garde et se partage. Logique pure
et testée : `lib/personnages-liste.mjs`.

## Fiches dans la base

Les vraies fiches de personnages ont leurs tables dans la base (section 13 de `data/schema.sql`, migration `0011-personnages`). Elles reprennent la
« Fiche personnage Maverick Auto V15.2.2 » (onglet Personnage) **hormis ses bugs** (liste dans [`sql/a-valider.md`](sql/a-valider.md) §3) : chaque colonne cite sa cellule.

**Principe : on stocke les choix, jamais les calculs.** Une fiche garde ce que le joueur décide ou tire aux dés ; tout ce que la fiche auto calcule se recalcule
depuis les règles de la base, si bien qu'une règle corrigée corrige toutes les fiches.

**Quand les règles changent (décision R42).** Une fiche ne garde que des **identifiants** de règles (race, classe, spécialité, don, sort, métier…), qui
ne changent jamais, même quand on renomme (migration 0006) : un élément **renommé ou modifié** se lit sous son nouveau nom, sans toucher la fiche (ni
ligne, ni note, ni version ; « Si par contre le don / sort / métier est juste modifié, il reste dans les fiches concernées (juste automatiquement mis à
jour) »). Un **don, une spécialité (avec les dons choisis qui en dépendent), un sort ou un métier supprimé** — sur le site de dev, ou par une livraison
qui refait la base vivante — est **retiré** des fiches qui l'utilisent (la fiche reste, la classe d'une spécialité retirée aussi) et une **ligne datée**
par élément s'ajoute à la fin de ses notes (« NOTE », BA53), pour que le joueur s'en souvienne et s'adapte (« Le don supprimé peut subsister en tant que
note dans la fiche ») :
`[11/10/2026] Retrait (règles modifiées) : le don « Botte secrète » (classe Bretteur des dunes, spécialité LAME COURBE, niveau 20) n’existe plus dans
les règles. Choisissez autre chose ou adaptez la fiche à la nouvelle règle.` (texte : `lib/fiche-format.mjs#ligneDeRetrait` ; retrait :
`serveur/fiches-retraits.mjs`, voir `docs/serveur.md`, « Fiches de personnage (R42) »). La version de la fiche change : ouverte ailleurs, son prochain
enregistrement reçoit `409` et la page dit combien d'éléments ont été retirés depuis son ouverture (« Recharger la fiche » garde le comportement
habituel : les saisies non enregistrées sont perdues). Tant que ces lignes sont dans les notes, une **bannière** en haut de `/fiche/` les résume
(« Règles modifiées : 1 élément retiré de cette fiche le 11/10/2026. », lien vers les notes ; `resumeDesRetraits`) ; elle part quand le joueur les
efface, et ne s'imprime pas (les notes, si). Une race, une classe ou une magie disparue n'est pas retirée (non tranché : la reconstruction reste
bloquée), ni un don, une spécialité ou un sort qui en relève. Après un retrait, aucun contrôle de la base ne signale le manque : une spécialité ou
un don à choix retiré revient dans les choix à faire de la page `/fiche/` (`choixEnAttente`) ; un métier, un sort ou une arme retiré n'y apparaît
pas, et la note datée est le seul signal.

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
| `personnage` | Nature (joueur ou prétiré), propriétaire, visibilité ; identité (F1, P1, F3), race (I2), ethnie (C40), magies innée et acquise (S2, S3), point de caractéristique d'une magie « au choix » (Potentiel Illimité), dieu choisi (S5), métier (C41), mode mono/bi-classe (BDD!K26), XP (S11), scores d'alignement L/C/B/M (L5:O5), bourse PP/RO/RF (I6, N6, T6), ambidextrie (AU8), classe de bouclier (AA26), valeurs courantes (santé, chakra, barrière, corruption, 4ᵉ barre), notes et événements (plus de statut depuis la migration 0038) ; **portrait** et son cadrage (demande du propriétaire, migration 0031) ; **gains de niveau** en deux totaux, `gains_sante` et `gains_chakra` (la santé et le chakra gagnés par les niveaux atteints, décision R73), et **entraînement** (`entrainement`, case L42 : texte libre, jamais compté, décision R71) : migration 0045, qui a remplacé la table `personnage_progression` (une ligne par niveau) par la somme de ses lignes |
| `personnage_partage` | Utilisateurs à qui le propriétaire montre sa fiche |
| `personnage_classe` | Classes 1 et 2 (A9, A11) et leur spécialité (choisie au niveau de classe 10) |
| `personnage_caracteristique` | Valeur de base des six caractéristiques (E18…U19) et leurs **croix** (cases H18, I18… ; 0 à 2, décision R19 : 1 croix = −20 % à tout test de la caractéristique, 2 = plus utilisable) |
| `personnage_competence` | Points « Nat. » et « Acquis » de chaque compétence (G22, I22…) ; l'Acquis du métier n'y est pas écrit (il se calcule : `v_personnage_metier_bonus`) |
| `personnage_metier_bonus` | Pour chaque rang de bonus du métier qui propose plusieurs compétences, celle que le joueur retient (décision R33) |
| `personnage_capacite` | Dons de classe **à choix** (options d'une ligne, paliers de l'Archimage) ; les autres se déduisent |
| `personnage_sort` | Sorts de la liste (AA55:AY74) et leur NM |
| `personnage_maitrise_arme` | Dés de maîtrise par famille d'armes (AA2:AV7) : 1 dé sans maîtrise, un de plus par point de maîtrise, 5 au plus ; la page fait choisir des points (4 au plus, constantes `maitrise_arme.*` de `regle_constante`) ; jamais sur ARME DE MONSTRES (R45, règle `maitrise_arme_exclue`) |
| `personnage_arme`, `personnage_armure`, `personnage_bouclier_materiau`, `personnage_accessoire`, `personnage_inventaire` | Équipement : catalogue de la base (arme, matériau, améliorations, pièces élémentaires, effets d'accessoire et valeur tirée, case « Malédiction ») et sac ; durabilité du moment d'une arme (`personnage_arme.durabilite`, « Solidité » AK17, AX17 : NULL = à son maximum, 0 = cassée ; décision R74, migration 0045) |
| `personnage_ceinture` | Les 3 emplacements de la ceinture (guide « Fiche de personnage : Accessoires et Ceinture ») : objet et quantité ; demande du propriétaire, migration 0031 |
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
  hors des options du métier ou rang à choix sans choix (R33), gains de niveau (`gains_niveau`, R73 : santé + chakra gagnés = 15 points par niveau à partir du 2,
  plus 1 à 8 par dé atteint, `niveau_global.de_attributs_min` et `de_attributs_max` ; détail « total / à saisir » ou « total / minimum à maximum »), 2ᵉ classe, spécialité
  avant le niveau de classe 10, dons hors classe ou exclusifs, sorts (magie du personnage, toutes pour le Potentiel Illimité ; NPM au plus la puissance magique
  du niveau, la 5 au niveau 16 et sans magie acquise, R16 ; 3 NM au plus sur un sort ; NM de niveau au plus niveau global − 1 sur un sort et au plus ceux gagnés, les autres d'un livre ou du MJ, R24, R26), matériaux du bouclier, améliorations, valeur d'un
  accessoire ; une fiche sans race ou sans magie innée (`race_manquante`, `magie_innee_manquante` : contrainte de la table jusqu'à la migration 0038).
  Toute fiche est contrôlée, même inachevée ; une fiche conforme n'y a aucune ligne. Ce qui demande le moteur (bonus de classe, d'équipement et de race, nombre de sorts, plafond de NPM du
  Potentiel Illimité, résistances — calculées par le moteur, `resistancesDe` —, valeurs dérivées) n'y est pas encore.

Les tables restent **vides dans `data/rows`** : les fiches réelles vivent dans la base vivante du service des personnages (`db/` de l'instance,
[`serveur.md`](serveur.md) : les prétirés dès maintenant, les fiches de joueur à la 1.0), jamais dans git ni dans la base téléchargeable de `/donnees/`. `client/test/personnages-db.test.mjs` crée des fiches dans une copie de la base et vérifie chaque contrôle et chaque règle de
visibilité.

Le moteur pur (`lib/fiche-moteur.mjs`, ci-dessus) calcule déjà depuis ces choix le niveau, les budgets, les scores de compétences, les attributs et les
emplacements de sorts et les résistances ; restent à coder, sans les déduire, les effets d'équipement (AP/AM des pièces, bonus des améliorations, résistances
des objets) et ce qui sert à la simulation (`feuille-de-route.md`).
