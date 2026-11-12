# gd-mecaniques (aca06b3ef6a85d932)


---

## Rapport 1 sur 1

Statut : partiel. Les quatre analyses sont faites. L'écriture de l'Initiative groupée est bloquée : la règle n'est écrite nulle part dans le dépôt. Les questions sont en fin de rapport (MAJ-G1 à MAJ-G8).

Fait

1. L'initiative

- **Règle actuelle (individuelle).**
  - `guide/le-tour-de-jeu`, étape 1 : « Chaque joueur lance 1D20 et ajoute le bonus d'initiative de son personnage, qui vient de son Agilité [...] On joue du plus haut résultat au plus bas. Les initiatives se relancent à chaque tour. »
  - Le mot-clé `initiative` (`data/rows/mot_cle.sql`, id 162) dit la même chose.
  - La table `initiative_agilite` donne le bonus : Agilité 1 = −2, 2 = 0, 3 = +2, 4 = +4, 5 = +6.
  - La fiche calcule 1D20 + ce bonus + le métier (R33) + les accessoires (`client/src/lib/fiche-moteur.mjs:1866-1899`).
  - `guide/initiative` ajoute que les boss ont « deux initiatives par tour ».
  - Le Doc « Règle du jeu » (`sources/raw/1tH-T9k-…md:8439`) dit : « Jet effectué en début de tour [...] (D20 + modificateur selon l'agilité) ».
  - Aucune décision R… ne porte sur l'initiative en elle-même. Seules R33, R37, R100 (Vigilance +2) et R158 la touchent.
- **« Initiative groupée » (IG) et « Initiative individuelle » (II) : aucune description.**
  - Grep sur « initiative group / collect / individuelle » dans tout le dépôt (`sources/`, `data/`, `docs/`, `.claude/`, `client/`) : zéro résultat hors l'extrait de la mise à jour.
  - `sources/discord/` est vide (un `.gitkeep`) ; `sources/tipeee` ne contient rien.
  - Dans l'extrait de la mise à jour, ces deux sigles n'apparaissent que dans la note de `14-foudre.txt:AT45` et de `16-ombre.txt:AT48`. La rubrique « Gameplay » ne dit que « Nouvelle façon de faire les initiatives : Initiative Groupé ».
  - Seuls deux indices existent, que je ne déduis pas :
    - Nerveux (Foudre, AT45) : « II : Augmente l'initiative au prochain tour. IG : Augmente l'initiative passivement du premier jet d'initiative. »
    - Pichenette (Ombre, AT48) : « II : Diminue l'initiative de la cible à son prochain tour. IG : Diminue l'initiative passivement du premier jet d'initiative ennemi. »
  - La mise à jour dit « selon les règles d'initiative utilisées » : deux règles semblent coexister, mais rien ne le dit.
- **Sorts.**
  - Nerveux et Pichenette gagnent deux effets (II et IG).
  - Sang gain : `+2 Vitesse, +2INI` devient `+2 Vitesse. Dure 3 tours.` (`03-sang.txt:172`).
  - Allègement : `6 Initiative et +2 Vitesse` devient `+2 Vitesse`, sans initiative (`13-vent.txt:303`).
  - Distorsion (Espace/Temps) : « Réduit l'initiative de 5 immédiatement » devient « Étourdi pour 1 tour » (`06-espacetemps.txt:373-375`). Ce n'est pas dans la liste de la mise à jour.
  - Célérité : l'effet « +1 tour » devient « +1 action ». La note qui disait « ça implique d'avoir 2 initiatives donc de jeter 2 fois un dé » a disparu ; il reste « Un boss qui a naturellement 2 tours n'aura qu'un seul tour avec deux actions » (`06-espacetemps.txt:287-290`).
  - Les autres sorts d'initiative gardent leur texte : Pétrole (Corruption, AQ69) et Enracinement (Terre, AC80).
- **Ce que le passage à deux règles touche en base** (Grep sur `data/rows`, environ 120 lignes).
  - Météo, 4 lignes de `meteo_effet` : Neige −2, Tempête de neige −3, Lune de sang +2 aux monstres et vampires. Saccage temporel (« l'initiative la plus basse commence ») est supprimé du classeur, voir le point 4.
  - États : `etat_stade` Paralysie stade 3, voir le point 4.
  - Postures : Vigilance +2 (`posture_effet`).
  - Dons de classe (`capacite`, 11 lignes) :
    - Anansi PT lent (−6) ;
    - Arbalétrier Charger (« tirer en premier au prochain tour juste avant les dés d'initiative ») ;
    - Bimane Vivacité ;
    - Goleois Blanc ;
    - Jackalope Empressement ;
    - Kitsune Rapide le bougre ;
    - Lancier Charge (« annule 1 initiative dans le cas d'un boss ») ;
    - Lancier Myrmidon ;
    - Marcass ;
    - Namazu Allure de peur ;
    - Satyre Menottes.
  - Autres lignes de classe : Mage Bleu (`classe_annexe`, `classe_annexe_entree`), et `classe` Jackalope (texte).
  - Races et Mode Hyper (`mode_hyper_effet`) : Jackalope (immunité aux retraits d'initiative), Anansi Ombre (−5), Sang + Vide (−2 / +2).
  - Équipement :
    - accessoires +2 et +5 ;
    - armures Familier, Montagne, Nomade, Voyage ;
    - armures élémentaires Espace/Temps (« Lance 2 initiatives, garde le résultat au choix ») et Foudre ;
    - 5 armes élémentaires (Ombre, Vide, Nécromancie, Terre, Vent) ;
    - 7 potions (fioles rose et multicolore) ;
    - familier Chat ;
    - Foudre étincelante (`mode_super_objet`).
  - Bestiaire : 26 capacités communes dont « 3 têtes » (3 initiatives), Initiative extrême, Annule horloge et Annule 12 (« l'initiative tombe à 0 »), plus des capacités de monstre, de la butin et des espèces.
  - Mot-clé `boss` (« deux initiatives par tour »).
  - La liste d'une ligne par entrée a été produite par le Grep ; je ne l'ai pas recopiée ici.
- **Pages du guide qui écrivent l'initiative (à garder cohérentes)** :
  - `guide/le-tour-de-jeu`
  - `guide/initiative`
  - `guide/finaliser-son-personnage`
  - `guide/fiche-attributs` (texte copié)
  - `guide/bienvenue` (1D20)
  - `guide/attaquer-et-se-defendre` (jambe gauche −4 « au prochain tour »)
  - `guide/les-postures`
  - `guide/meteo`
  - `guide/liste-des-alterations-d-etat`
  - `guide/liste-des-effets-mode-super`
  - mot-clé `initiative`

2. La limite D12

- **Règle actuelle : le plafond est le D20.**
  - Posture Focus : « Permet d'augmenter d'un cran la nature des dés [...] (le D6 devient D8, etc… en sachant qu'il n'y pas plus haut que le D20) ». C'est `posture_effet` versions `guide_fiche` et `guide_mj` (texte recopié du Doc), et `guide/fiche-tableau-posture` (page importée).
  - Pages écrites par le site : `guide/les-postures` et `guide/les-degats` (« D4, D6, D8, D10, D12, puis D20, jamais au-delà »). `guide/formule-des-degats` donne l'exemple 2d6+2 → 2d8+2.
  - R100 porte la liste « D4 → D6 → D8 → D10 → D12 → D20 », et R102 les crans de dé des sorts.
  - Le code : `CRANS_DES_DES = [4, 6, 8, 10, 12, 20]` et `deMonte()` (`client/src/lib/fiche-moteur.mjs:4267-4274`), appelé en `:4625`. Commentaires dans `client/src/lib/posture-texte.mjs:46`.
- **Où la nature d'un dé monte aujourd'hui** :
  - posture Focus, dégâts et soins des sorts ;
  - accessoire « Augmente le dé de dégâts des sorts » (`accessoire_effet` `attaque:11`, niveau 5) ;
  - don Farfadet maritime « Augmente d'un cran les dés des soins magiques » (`race_don`) ;
  - capacité Mage Noir « Excès » (`capacites/mage-exces`) : « augmenter d'un cran le dé (maximum D12) ». C'est un précédent qui écrit déjà ce plafond.
- **Sans lien avec la limite.**
  - Les maîtrises d'armes R149/R170 comptent le nombre de dés (1 + points, 5 au plus), pas leur nature.
  - Les matériaux de la mise à jour (« +1 dé de dégâts contre... ») ajoutent des dés, pas des crans.
  - Le Felfe en Mode Hyper (« 1d au lieu de 2d ») compte aussi des dés.
  - Le Frappeur « réduit de 1 cran » (`arme.sql`) et le Hujin « diminue d'un cran » sont des baisses de dé.
- **Les sorts ont déjà D12 pour plus gros dé** (Grep sur `sort.sql`). Le seul D20 est l'effet aléatoire « Lance 1d20 » d'Aléa négatif (Vide). Seuls D12 → D20 (Focus, accessoire) sont donc concernés.
- **Exemple chiffré.**
  - Avant : Focus sur 3d12+2 donne 3d20+2.
  - Après le plafond : 3d12+2 reste 3d12+2.
  - Avec Focus puis l'accessoire sur d10 : d10 → d12 → d20 avant ; d12 après.
  - Focus + accessoire sur d6 donne d10, inchangé (cf. `client/test/fiche-mode-hyper.test.mjs:552`).

3. « Construction »

- C'est déjà un genre de sort. `sort_type.type` accepte `'construction'` (`data/schema.sql:891-895`). Il y a 6 sorts en base : Mine noire, Gel profond, Sculpteur glacé, Mur d'os, Prison d'os, Sable changeant.
- Genre de sort validé en couleur par le propriétaire (2026-10-23, registre).
- **Pas de mot-clé** : il n'y a aucune entrée `construction` dans `mot_cle` (seul `Météo` existe parmi les genres de sort).
- **Aucune définition** n'est écrite en base ni dans le guide.
- Dans la mise à jour, « Mur de chakra est une construction » : il est aujourd'hui `entrave` (`sort_type`).
- Le genre se généralise. Types « Construction » dans les nouveaux onglets : Coagulation (Sang), Forge-Magie, Mur de chakra (Arcane), Forge de ses morts (Nécro), Mur de flammes, Tas de cendre (Feu), Zone abyssal (Eau), Mur de glace (Glace), Mur hertz (Foudre), Lame prismatique, Mur gamma, Révélation (Lumière). Mine noire est renommée Mine poisseuse. Cela fait environ 16 sorts au lieu de 6.
- Les règles qui visent les constructions sont nouvelles (absentes de V8) :
  - Désintégration (Corruption, `04-corruption`, r98) : « Double les dégâts contre les sorts "Construction" et les éléments du décor. SI CR : +15 dégâts » ;
  - Vide, Regard de Mora, note de la liste de règles : « Détruit les sorts "Construction" sur le terrain et empêche ces sorts d'être utilisés » ;
  - Vide, État zéro (r98 c63) : « Supprime toutes les amplifications, entrave, protections, effets de sorts et constructions magiques dans la zone ».
- Il existe ainsi trois sortes de sorts à la fois « posés » et visés. Je ne sais pas si le mot-clé est voulu.

4. Altérations d'état, météo, Mode Hyper (Magie). Comparaison faite avec l'instantané V8 ; seuls les changements de règle sont listés, les décalages de lignes sont ignorés.

- **Altérations (`17-alteration-detats.txt`).** Les paliers (Sensibilité, Grande vulnérabilité, etc.) sont inchangés : R155 reste valable, ÷3/×3/×4. R70 est déjà remplacée par R155.
  - **Somnolence est nouvelle** (ligne 58 ; les lignes suivantes sont décalées de 5). Magie liée « Ombre (Songe) », type Mental.
    - Stade 1 : malus de 5 à tous les dégâts, −5 % au jet de Force et d'Agilité, +5 % aux jets de Volonté, dure 3 tours.
    - Stade 2 : −7 aux dégâts, −10 % Force et Agilité, +10 % Volonté.
    - Stade 3 : −10 aux dégâts, −15 % Force et Agilité, +15 % Volonté.
    - Les cinq lignes de résistances/vulnérabilités (AV58-62) sont vides : aucun effet de palier n'est écrit pour elle.
    - Les sorts d'Ombre Songe l'inflictent (« somnolence 1 », « niveau de somnolence »).
  - **Paralysie, stade 3** : « Le résultat d'initiative sera toujours 01 » devient « Force à jouer en dernier le tour » (AG33).
  - **Surdité, stade 3** : « Les dégâts sonores ne fonctionnent plus sur la victime » est remplacé par « Un placement sur la victime fait qu'elle tombera toujours par terre juste après » (AG68).
  - **Décompte à mettre à jour** : le guide dit « treize altérations liées à une magie » (`guide/blessures-et-etats`, remèdes et panacées). Il y en a maintenant 14, avec deux pour l'Ombre (Peur et Somnolence).
  - Les durées ne sont pas supprimées. Mon premier diff les croyait retirées ; c'était une erreur de mon analyseur, corrigée.
- **Météo (`18-meteo.txt`).**
  - Les 18 météos restantes sont inchangées.
  - **Saccage temporel et Zone vide sont retirés du classeur.** Il en reste 18 sur les 20 de la base (`meteo`).
  - Dans l'onglet Vide, les sorts qui les posaient ont disparu aussi. La mise à jour dit « Anti-magie disparaît » (le sort qui posait Zone Vide). Rien ne dit que le sort Saccage Temporel disparaît.
  - Conséquences : les effets de `meteo_effet` de ces deux météos, le sort `magies/magie-du-vide#sort:saccage-temporel`, et la mention d'initiative inversée (Saccage temporel, rang 5).
- **Mode Hyper (Magie), onglet caché (`20-mode-hyper-magie.txt`)** : aucun changement par rapport à V8 (diff cellule à cellule vide).
  - Il reste hors règle : R5 (la fiche prime, +15/+7, pas le +10/+5 de l'onglet) ; R184 (9) a supprimé la page `guide/mode-hyper-magie`, « règle obsolète » ; R187 retire la page `liste-des-effets-mode-hyper` ; R200 (5) retire la phrase sur l'onglet masqué et fait foi l'onglet de la magie pour l'Espace/Temps.
  - Rien à faire côté base : `mode_hyper_effet` garde ses lectures `magie_masque`, `onglet_magie`, `fiche`.
  - La mise à jour ne change que deux Mode Hyper de race : Elfe argenté (« Les sorts d'attaques imposent un désavantage sur les jets de défenses ») et Felfe (« 1d au lieu de 2d »). Elles sont dans le périmètre de `gd-races`.

Reste

- L'Initiative groupée ne peut pas s'écrire sans la règle.
- Je ne propose pas de texte de pages.
- Je n'ai ni écrit dans le dépôt ni ouvert la base `var/`.
- Je n'ai pas pu lire les originaux Google ni le Discord (bloqués ; `sources/discord/` est vide). Seul le propriétaire connaît le texte de l'IG.

Pour les autres

- **gd-fiche** :
  - `initiativeBonus` est calculé dans `fiche-moteur.mjs:1899` (Agilité + métier + accessoires) ; le Vigilance +2 de la posture est séparé.
  - `CRANS_DES_DES` (`fiche-moteur.mjs:4267`) retirerait 20 pour le plafond D12.
  - Les tests concernés : `fiche-postures-sorts.test.mjs` (R102) et `fiche-mode-hyper.test.mjs:552`.
  - Les crans d'accessoire (`accessoire-champs.mjs:45`) et de don de soin (`sort-bonus-texte.mjs`) suivent le même plafond.
  - L'affichage de l'IG sur la fiche attend la règle (MAJ-G1).
- **gd-magies** : la liste des sorts de la mise à jour (nouveaux genres Construction, Désintégration / Regard de Mora / État zéro, Songe, Anti-magie supprimé, Saccage Temporel disparu sans mention, rangs des onglets V10 décalés par la Spécialisation). Somnolence relève des deux (état et magie Ombre/Songe).
- **gd-objets** : les remèdes et panacées (« un pour chacune des treize altérations ») ; Somnolence n'a peut-être pas de remède.
- **gd-races** : le Mode Hyper Elfe argenté et Felfe (R172, `fiche-moteur.mjs`, dés de race).
- **tech-sources** : vérifier à l'original Google (R83) si le Doc « Créer sa fiche » / Guide du MJ a changé, car `guide/fiche-tableau-posture` et `posture_effet` (versions `guide_fiche` et `guide_mj`) recopient « pas plus haut que le D20 ».
- **leader-technique** : la décision à venir sur l'IG touche `guide/le-tour-de-jeu`, `guide/initiative`, le mot-clé `initiative` et la fiche.

Questions pour le propriétaire (format `poser-une-question`)

**MAJ-G1. Description de l'Initiative groupée.** La mise à jour annonce « Nouvelle façon de faire les initiatives : Initiative Groupé ». Nerveux écrit « IG : Augmente l'initiative passivement du premier jet d'initiative ». Pichenette écrit « IG : Diminue l'initiative passivement du premier jet d'initiative ennemi ». Aucune source ne décrit l'IG. Écrivez-la en quelques phrases : qui lance, combien de jets, quand, dans quel ordre on joue. Sans cela, aucune page ni la fiche ne peut l'écrire.

**MAJ-G2. L'IG remplace-t-elle l'initiative individuelle ?** La mise à jour dit « selon les règles d'initiative utilisées » pour Nerveux et Pichenette. Le guide actuel (`guide/le-tour-de-jeu`) dit que chacun lance 1D20 + son Agilité à chaque tour.
- (a) Les deux règles coexistent, au choix du MJ, et l'initiative individuelle reste la règle écrite par défaut.
- (b) L'IG remplace l'initiative individuelle partout.
- (c) Autre.
Cela change quelles pages disent quoi, et si les deux effets des sorts s'affichent.

**MAJ-G3. Les autres effets d'initiative « au prochain tour ».** Seuls Nerveux et Pichenette ont un texte IG. Les autres sont écrits pour l'initiative individuelle : la jambe gauche (−4 au prochain tour), les armes élémentaires, les potions, le Chat, l'armure élémentaire Foudre, Anansi, Lancier, Arbalétrier... Faut-il écrire leur version IG, et lesquelles ? Réponses possibles : « non, on laisse tel quel » ou une liste.

**MAJ-G4. Boss et initiatives multiples en IG.** Les boss ont « deux initiatives par tour », la capacité « 3 têtes » en donne 3, la Célérité n'en parle plus. Que deviennent-ils en IG ? (a) rien de changé ; (b) à écrire par vous.

**MAJ-G5. Portée du plafond D12.** Aujourd'hui Focus, l'accessoire (+1 cran des dégâts de sorts) et le don Farfadet maritime (soins) montent le dé jusqu'au D20. « La limite d'augmentation de la nature des dés est de maximum D12 » : le plafond vaut-il pour toutes les montées de cran (Focus, accessoire, Farfadet maritime, Excès du Mage Noir qui l'écrit déjà), de sorte que 3d12 reste 3d12 ? Un dé déjà au-dessus de D12 sans montée (le 1d20 aléatoire d'Aléa négatif, par exemple) reste-t-il tel quel ? Réponses : (a) oui à tout ; (b) autre, à préciser.

**MAJ-G6. « Construction » : mot-clé ?** Le genre « Construction » est un genre de sort existant (étiquette). Désintégration double ses dégâts contre les « sorts Construction », le Regard de Mora du Vide les détruit, État zéro supprime « les constructions magiques ». Voulez-vous (a) un mot-clé du glossaire `construction` dont vous donnez la définition ; (b) seulement l'étiquette actuelle, sans définition ?

**MAJ-G7. Somnolence : résistances et décompte.** Somnolence (Ombre, Songe) arrive sans effet de palier (cinq cases vides). Voulez-vous (a) laisser ces effets vides, rien d'affiché ; (b) donner leur texte ? Le guide dit « treize altérations liées à une magie » : à passer à quatorze ?

**MAJ-G8. Saccage temporel et Zone vide.** La mise à jour ne les cite pas, mais ils ont disparu du classeur (météos) et du Vide. Anti-magie disparaît (dit). Saccage Temporel est-il supprimé aussi ? Et les deux météos : supprimées, ou à garder sans sort ? Réponses : (a) supprimer les deux météos et le sort Saccage Temporel ; (b) les garder ; (c) autre.

Fichiers utiles (lecture seule) :
- `/home/user/MaverickCenter/data/rows/page.sql` (`guide/initiative`, `guide/le-tour-de-jeu`)
- `/home/user/MaverickCenter/data/rows/posture_effet.sql:26,30`
- `/home/user/MaverickCenter/client/src/lib/fiche-moteur.mjs:4267-4274,1866-1899`
- `/home/user/MaverickCenter/data/schema.sql:891-895`

Scripts de comparaison, dans le scratchpad : `/tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/mecanique/diff.py`.
