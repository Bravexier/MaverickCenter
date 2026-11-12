# gd-fiche (a275b642f495ab5c3)


---

## Rapport 1 sur 1

Statut : fait (analyse en lecture seule, aucun fichier modifié). Plusieurs points de règle restent à trancher par le propriétaire (MAJ-F1 à MAJ-F12).

Fait :

1. Les emplacements de sorts aujourd'hui
- **Règle.** Page `guide/premiers-sorts` (data/rows/page.sql) : « Chacune de ces quatre conditions donne un emplacement de sort : magie innée ; magie acquise, ou le don "Grimoire" ; classe magique ; seconde classe magique », × la puissance magique, « Il n'y a jamais d'emplacement en plus ».
  - R27 : « Aucun emplacement de sort supplémentaire ». La question portait sur des lignes données par le MJ.
  - R189 : Grimoire compte comme une condition, sans donner de seconde magie.
  - R188 (2) : le multiplicateur reste la puissance du niveau. Le plafond du PI (3, ou 4 avec « Semi-complet ») ne borne que le choix des sorts.
  - R16 : NPM 5 au niveau 16.
  - R26 et R118 : au plus 3 NM par sort. R169 : livres de n'importe quel sort de sa magie.
- **Code** (`client/src/lib/fiche-moteur.mjs`) :
  - `puissanceMagique` :1971.
  - `npmMax` :1980-1985 : sans le palier 5 quand il y a une magie acquise.
  - `npmDesSorts` :1995-2001.
  - `emplacementsDeSorts` :2009-2014 : conditions = innée + acquise + classes magiques + dons `condition_emplacements` ; × `puissanceMagique`.
  - `sortsPossibles` :2020-2025.
  - `sortsDesLivres` :2035.
  - `lignesDeSorts` :2227-2239 : `enTrop`, `horsDesRegles`.
  - Doc : `docs/character-generator.md:461-468`.
- **Contrôles.** Aucune règle SQL ne compte les emplacements, seul le moteur le fait. `v_personnage_controle` contient `sort_hors_magie` (data/schema.sql:5203) et `sort_puissance` (:5208).
- **Niveau global → NPM** (data/rows/niveau_global.sql, colonne `puissance_magique`) : niv. 1 → 1, 4 → 2, **8 → 3**, 12 → 4, 16 → 5 (« non disponible pour les personnages avec une magie acquise »). Le niveau 8 donne bien le NPM 3.

2. Ce que la mise à jour change
- **Le classeur.** Chacune des 14 magies a désormais 5 sorts au NPM 1, 5 au NPM 2, puis deux spécialisations de 4 (NPM 3) + 4 (NPM 4) + 2 (NPM 5).
  - Comptage des onglets 03 à 16, colonnes V, E et AM. Exemples : Nécromancie LICHE / POISON, Feu VOLCAN / CENDRE.
  - Aujourd'hui la base a 5/5/5/5/3 sorts par magie (data/rows/sort.sql).
  - « 4 pour chaque spé » se lit donc comme 4 sorts par NPM.
  - Sommaire AP1 : « déblocable dès le niveau 3 de puissance magique » ; « Seuls les bi-magie doivent faire un choix de chemin ».
- **Super-magie.** Sommaire AP1 : « A partir du niveau 8 globale, si les personnages ont toujours mono-magie, leur magie est dans une état de "Super-magie" ce qui leur permet de débloquer les emplacement de sort de la magie acquise ». C'est mot pour mot l'effet de Grimoire : « débloquer les emplacements de sorts de magie acquise ».
  - Lecture proposée : une condition de plus, × la puissance magique, comme R189.
  - Cette lecture reste dans la formule de R27 et ne la contredit pas.
  - Lire « un emplacement » au sens littéral (+1 seul) ferait une exception à R27. Voir MAJ-F1.
- **Chiffré, lecture « condition ».** Exemple : Nécromancien mono-magie avec 1 classe magique.

  | Niveau | Avant | Après |
  | --- | --- | --- |
  | 8 | 2×3 = 6 | 3×3 = 9 (+1 seul : 7) |
  | 12 | 8 | 12 |
  | 16 | 10 | 15 |
  | 16, deux classes magiques | 15 | 20 |

  - Choix au NPM 3 pour ce mono-magie : 8 sorts (Liche 4 + Poison 4) au lieu de 5.
  - Bi-magie Nécromancie-Feu avec 1 classe magique au niveau 8 : 3×3 = 9 avant comme après. Choix au NPM 3 : 4 + 4, une spécialisation par magie (ex. Liche + Cendre), au lieu de 10.
- **Ce que la fiche doit enregistrer.** Pour le bi-magie, une spécialisation par magie.
  - Proposition pour `tech-db` : une table `personnage_specialisation_magie (personnage_id, magie_id, specialisation_id)`.
  - Côté règles : une table des spécialisations par magie et `sort.specialisation_id` (NULL aux NPM 1-2).
  - Ne pas réutiliser `specialite`, qui sert aux classes.
- **Ce que la fiche doit proposer.**
  - `sortsPossibles` filtre les sorts : sans spécialisation, ou mono-magie (les deux), ou la spécialisation choisie de la magie.
  - Spécialisation non choisie au NPM ≥ 3 : un choix « en attente » dans `choixEnAttente` (:2444), et aucun sort de NPM ≥ 3 de cette magie n'est proposé.
  - `emplacementsDeSorts` ajoute la condition Super-magie : niveau global ≥ seuil (8, en donnée, `regle_constante`), aucune magie acquise, sous réserve de MAJ-F2 et MAJ-F3.
  - `npmMax` est inchangé : pas de seconde magie, le palier 5 reste ouvert, comme pour R189.
  - Liste des sorts : un sous-groupe par spécialisation dans `sortsParNpm`, à confirmer en affichage.

3. Cas limites
- **PI.** « hormis le PI » : pas de branches pour lui.
  - Reste à savoir à quelles spécialisations il accède en piochant dans toutes les magies (MAJ-F4).
  - Reste aussi à savoir s'il reçoit la Super-magie. Avec Grimoire, l'Archimage PI mono-classe a déjà innée + Archimage + Grimoire = 9 emplacements au niveau 8. Si les deux se cumulent : 12 (MAJ-F3).
- **Magie acquise gagnée après le niveau 8.** Aucune source ne fixe quand on gagne une magie acquise ; la fiche permet de la saisir à tout moment.
  - La Super-magie s'éteint et la condition « magie acquise » la remplace : même nombre d'emplacements.
  - Il faut alors choisir deux spécialisations. Les sorts de l'autre branche de l'innée deviennent `horsDesRegles` (ligne rouge), ainsi que les NPM 5 (règle existante).
  - Retirer automatiquement ou signaler : MAJ-F5.
- **Bi-magie qui perd sa magie acquise.** Il devient Super-magie. Sa spécialisation de l'innée ne borne plus rien.
- **Fiches existantes.** Les sorts « disparaît » sont retirés avec une note (R42, `serveur/fiches-retraits.mjs`).
  - Un sort modifié reste. S'il passe dans la branche non choisie, il est seulement signalé.
  - Une règle SQL est à ajouter : `sort_hors_specialisation`, avec peut-être `specialisation_hors_magie`.
  - « Sang magie disparaît pour laisser place à Crachat bordeaux » et « Anti-Mytril a été remplacé par Anti-Alliage » : retrait (R42) ou renommage (même id) ? (MAJ-F6).
  - Fiche bi-magie au-delà du NPM 3 sans spécialisation : la déduire des sorts déjà pris ? (MAJ-F7).
  - Les fiches ne sont pas dans `data/rows` (personnage*.sql vides) : je n'ai pas pu compter les fiches touchées.
- **Bi-classé.** Avec deux classes magiques, le mono-magie passe de 3 à 4 conditions (le maximum actuel du guide), sauf cumul avec Grimoire (MAJ-F3).
- **Spécialisation figée ou modifiable après choix ?** MAJ-F8.

4. Autres lignes du docx
- **« Sang gain » et « Allègement » ne donnent plus d'Initiative.** La fiche ne compte aucun bonus d'initiative de sort : `initiativeBonus` = Agilité + métier + accessoires, et posture à part (fiche-moteur.mjs:1844-1901). Rien à changer côté fiche ; c'est une donnée de sort (`gd-magies`).
- **« Initiative Groupé »** et les deux effets de Nerveux et Pichenette : ils peuvent toucher le 1D20 + bonus de la fiche, à voir avec `gd-mecaniques`.
- **Limite D12.** La fiche monte déjà la nature des dés jusqu'au D20 :
  - `CRANS_DES_DES = [4, 6, 8, 10, 12, 20]` et `deMonte` (fiche-moteur.mjs:4268-4275) ;
  - appliqués aux sorts (:4623-4627) par la posture Focus, l'accessoire `cran_des_sorts` et les dons « cran » ;
  - test qui épingle le D20 : client/test/fiche-postures-sorts.test.mjs:371-372.

  La limite D12 contredit le texte copié de Focus (posture_effet.sql : « il n'y pas plus haut que le D20 ») (MAJ-F9). Exemple : « Foudre argenté » 3d10 en Focus avec l'accessoire (2 crans) donne 3d20 aujourd'hui, 3d12 après.
- **Archimage, maîtrise d'arme.** data/rows/classe_maitrise_arme.sql : rang 2 = `'nommee'` Bâton. Il deviendrait `'au_choix'`, catégorie `contact`, une forme que 13 classes ont déjà et que la fiche sait choisir (R148, R151). Une fiche existante aurait une maîtrise « à choisir » en attente : préremplir le Bâton ? (MAJ-F10).
- **Archimage non obligatoire pour le PI.** Cela contredit R23 (« la classe 1 est l'Archimage, verrouillée »).
  - Code concerné : `classeImposee` :95, `refusClasse` :116, `classesSelonLaMagieInnee` :126-135, règle `classe_imposee` (schema.sql:5025).
  - L'onglet PI du même classeur (02, A26) dit encore « Classe unique = Archimage ».
  - Questions ouvertes : la réservation reste-t-elle (pas d'Archimage sans PI : `classe_reservee`, :5021) ? L'Archimage en classe 2 ou au niveau 11 (R2, R25) ?
  - Un PI sans Archimage n'aurait ni Grimoire (R189) ni « Semi-complet » : NPM des sorts plafonné à 3 pour toujours (R188).
  - Pas d'effet sur R176 ni R225 (5 santé par niveau, lié à la magie).
  - Voir MAJ-F11.
- **« Parleur rejoint les spéciaux ».** Le Parleur est aujourd'hui `classe-physique-corps-a-corps`. R6 ne rend magique que l'Archimage (par son id, `lib/classe-magique.mjs`) : aucun effet sur les emplacements. Le Flagelleur est `classe-hybride` en base alors que le docx le dit « spécial » (pour `gd-dons`).

Reste :
- La lecture du docx brut (`nouveaute-mise-a-jour-decembre.json`) et des onglets 19-25 n'a pas été faite : hors du volet fiche demandé.
- Le classeur se dit « béta » (Sommaire AP1) : appliquer maintenant ou attendre ? (MAJ-F12).

Pour les autres :
- `gd-magies` : la liste des sorts par spécialisation, les sorts déplacés de NPM, les sorts « disparaît » ou « remplacé » (base pour R42), le texte de Sang gain et d'Allègement.
- `gd-mecaniques` : l'Initiative groupée, Focus et le D12.
- `gd-dons` : l'Archimage (maîtrise, R23), le Parleur.
- `leader-technique` (après décisions) :
  - côté base (`tech-db`) : une migration pour les spécialisations, `sort.specialisation_id`, la spécialisation par fiche, `sort_hors_specialisation`, le seuil 8 en donnée, le rang 2 de l'Archimage, la règle `classe_imposee` ;
  - côté pages et doc : la page `guide/premiers-sorts` (« quatre conditions ») et `docs/character-generator.md:461-468`.
- `tech-skills` : mettre à jour `zone-fiche-sorts` (« sans emplacement en plus », Super-magie) et le D12 dans le skill de la posture.

Questions (propriétaire) :
- **MAJ-F1.** Mono-magie au niveau 8 : « un emplacement de sort supplémentaire, comme s'il était BI-magie » (message), ou « débloquer les emplacement de sort de la magie acquise » (Sommaire AP1) ?
  - (a) une condition de plus, × la puissance magique, comme Grimoire (R189) : 6 → 9 au niveau 8 avec une classe magique ;
  - (b) +1 emplacement seul : 7 ;
  - autre.
- **MAJ-F2.** Qui est « mono-magie » pour la Super-magie : tout personnage sans magie acquise, y compris une Lamia (R28) et une Corruption innée (R15) ? Oui / non.
- **MAJ-F3.** Le PI reçoit-il la Super-magie au niveau 8 ? Si oui, s'ajoute-t-elle à Grimoire (Archimage PI au niveau 8 : 9 ou 12 emplacements) ?
- **MAJ-F4.** Le PI, qui pioche dans toutes les magies, a-t-il accès aux sorts des deux spécialisations de chaque magie (plafond NPM 3, puis 4) ? Oui / non.
- **MAJ-F5.** Un mono-magie qui prend une magie acquise après le niveau 8 : les sorts de la branche non retenue de son innée sont-ils (a) retirés de la fiche avec une note, comme R42, ou (b) laissés en rouge à changer ?
- **MAJ-F6.** « Sang magie disparaît pour laisser place à Crachat bordeaux » et « Anti-Mytril a été remplacé par Anti-Alliage » : nouveau sort (l'ancien est retiré des fiches, R42) ou même sort renommé (il reste) ?
- **MAJ-F7.** Fiche bi-magie déjà au NPM 3 ou plus, sans spécialisation : (a) la déduire des sorts déjà pris quand ils sont tous d'une seule branche, ou (b) toujours la laisser à choisir ?
- **MAJ-F8.** Une spécialisation choisie peut-elle être changée ensuite ? Oui / non.
- **MAJ-F9.** « La limite d'augmentation de la nature des dé est de maximum D12 » remplace-t-elle le « il n'y pas plus haut que le D20 » de Focus ? S'applique-t-elle aussi aux armes et aux dons ? Oui / non.
- **MAJ-F10.** Archimage existant (maîtrise Bâton imposée) : garder le Bâton comme choix déjà fait ? Oui / non.
- **MAJ-F11.** Le PI n'est plus obligé d'être Archimage : l'Archimage reste-t-il réservé au PI (R23) ? Peut-il être prise en classe 2 ou au niveau 11 ? L'onglet PI (« Classe unique = Archimage ») est-il à corriger ?
- **MAJ-F12.** Le classeur est marqué « béta » : appliquer la mise à jour sur le site maintenant, ou attendre la version finale ?

Fichiers cités : /home/user/MaverickCenter/client/src/lib/fiche-moteur.mjs, /home/user/MaverickCenter/data/schema.sql, /home/user/MaverickCenter/data/rows/niveau_global.sql, /home/user/MaverickCenter/data/rows/classe_maitrise_arme.sql, /home/user/MaverickCenter/docs/character-generator.md, /home/user/MaverickCenter/client/test/fiche-postures-sorts.test.mjs, /tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/maj-decembre/extraits/onglets/01-sommaire.txt, /tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/maj-decembre/extraits/onglets/02-potentiel-illimite-magie-diffi.txt, /tmp/claude-0/-home-user-MaverickCenter/fcaea524-05ea-5f4a-a500-aab8f41328fe/scratchpad/maj-decembre/extraits/MISE-A-JOUR-DECEMBRE.md
