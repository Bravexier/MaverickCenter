# gd-objets (aff208cf7e9f92dcd)


---

## Rapport 1 sur 1

Statut : fait (analyse en lecture seule, rien écrit). Je n'ai pas construit de base : `var/maverick.db` est absente et `client/node_modules` aussi. J'ai lu `data/rows/*.sql` par Grep, qui est l'état d'import. Les modifications du site de dev non rapatriées ne se voient pas.

## Fait

### 1. État actuel et verdict par matériau
Source de l'état actuel : `data/rows/materiau_arme.sql`, onglet « Ressources et Craft › Armes » (O3:AC30), 14 lignes. Les bonus de dégâts du docx ne changent pas ; ils sont rappelés ci-dessous. Les crans sont déjà dans `cran_solidite` (R51, R194), et la fiche les calcule (`arme-forge.mjs`).

| Matériau (id) | Actuel en base | Docx (l. 185-209) | Verdict |
|---|---|---|---|
| Acier `armures#materiau:acier` | +2 dégâts, aucun effet | relance des dés de dégâts, 1×/combat | AJOUT |
| Fer noir `…:fer-noir` | +3 ; « 1d4 de {{corruption}} à chaque coup qui touche » | 4 de corruption si la cible n'en a pas ; sinon +2 dégâts et 2 de corruption | REMPLACE |
| Argent `…:argent` | +4 ; « +1d de dégâts contre les non-morts » | +1 dé contre les non-morts | DOUBLON (même règle) |
| Fonte `…:fonte` | +7 ; cran −1 | −1 cran | DOUBLON |
| Cuivre `…:cuivre` | +5, aucun effet | sorts « Fer » durent 4 tours au lieu de 3 | AJOUT |
| Bronze `…:bronze` | +5 ; cran +1 | +1 cran | DOUBLON |
| Os `ressources/armes#materiau:os` (type « Autres », R62) | +6, aucun effet | +1 dé contre les bêtes | AJOUT |
| Laiton `…:laiton` | +7 ; « dégâts doublés contre la barrière » | +1 dé contre les créatures mécaniques ou inertes | REMPLACE (l'ancien effet n'est plus cité) |
| Or `…:or` | +8 ; « +1d de dégâts contre les démons » | +1 dé contre les démons | DOUBLON |
| Vif-argent `…:vif-argent` | +6 ; « Touche l'immatériel » | permet de toucher les êtres immatériels | DOUBLON |
| Mythril `…:mythril` | +8 ; « Passe barrière » | +1 dé si l'arme touche une barrière | REMPLACE, sens changé (voir MAJ-O2) |
| Titane `…:titane` | +9 ; cran +1 | avantage contre les effets de désarmement | le cran n'est pas cité (voir MAJ-O1) |
| Maverium `…:maverium` | +10 ; « Casse barrière » | +1 dé si la créature n'a pas ou plus de barrière | REMPLACE, sens changé (voir MAJ-O2) |

- **Fonte et Bronze : même chose, pas de cumul.** Le −1 et le +1 sont déjà dans la colonne `cran_solidite`. Le docx les liste comme « effet secondaire », mais la règle est inchangée. R51 : cumul des crans, plancher de 1. R194 : plancher sur le total.
- **Argent, Or, Vif-argent : seule la formulation diffère** (« +1d » devient « +1 dé »).
- **Graphies.** La base écrit « Mythril » partout (412 occurrences, id `…:mythril`). « Mytril » : 0. « Mithril » : 4, uniquement dans `historique_modification`, l'ancien texte de la barrière. Le docx écrit « Mythril » dans la rubrique Armes et « Mytril » dans la phrase de Magie (l. 131). Je le lis comme une faute de frappe : MAJ-O3.
- **Anti-Mythril.** Le sort est `magies/magie-de-la-terre#sort:anti-mythril` : Terre, niveau 4, coût 23, « L'effet du Mythril est annulé pendant 3 tours. » (`data/rows/sort.sql`). Un renommage garde l'id (identifiants figés). Le nom apparaît aussi dans `sort_bonus_maitrise`, `sort_type`, `page`, `page_entite`, `monstre_capacite` et `tools/bestiaire/capacites.json` (trouvé par `grep -l`, occurrences non lues une à une).

### 2. Notions et mots-clés (`data/rows/mot_cle.sql`)
- **Sorts « Fer ».** R164 : mot-clé `sort-fer`, « Type de sort d'amélioration qui s'applique sur une arme. », posé sur les 13 sorts Fer. Vérifié : les 13 effets disent « pendant 3 tours » (Fer corrompu compris). « Sorts de type Fer » du Cuivre = ces 13 sorts. Cohérent avec « 3 tours » : le Cuivre passe à 4. Le mot-clé est protégé (`MOTS_CLES_PROTEGES`).
- **Mots-clés existants à rattacher.** `barriere` (37), `corruption` (78), `solidite` (331), `sort-fer` (332), `des` (88, « Dés »).
- **Mots-clés absents** : non-morts, bêtes, mécaniques/inertes, démons, immatériel, désarmement, avantage, alliage. `mort-vivant` (253) est une race, pas un type de créature.
- **Où ces termes vivent aujourd'hui.**
  - `monstre.type_brut` (bestiaire) : Non-mort (60 cartes), Mécanique (74), Bête (42) et Bête-ailé (9), Démon (18), Vermine (9), Fantôme (7).
  - Capacités communes (`monstre_capacite_commune`) : « Inerte » (golems, volonté 10), « Immatériel » (immunisé aux armes physiques ; seuls la magie, une arme spectrale ou une arme sous sort fer le touchent), « Anti-démon » (+1d contre les démons), « Anti-barrière » (propriété du maverium).
  - Désarmement : sort Désarmer (Vent, niveau 3, « Si jet de réflexe/stabilité raté = Désarme la cible »), capacité Guerrier « Désarmement » (Maître d'arme, niveau 20), mot-clé `sabotage`. « Avantage » est employé dans des textes de capacités (Tueur « Résilience »), sans mot-clé ni définition globale trouvés.
- **Fiche (R128 : seulement ce qui joue tout le temps).**
  - Tous les nouveaux effets sont conditionnels (cible, once par combat, situation) : texte seulement, rien à calculer.
  - La fiche reprend déjà `materiau_arme.effet_secondaire` comme passif textuel (`fiche-moteur.mjs:5150-5152`, `fiche-regles.mjs:683`) : les nouveaux textes y arrivent sans code.
  - Elle calcule les crans (Fonte, Bronze, Titane) par `arme-forge.mjs`, plancher 1.
  - Le « +1 dé » ne s'additionne pas au dé de l'arme (R49). Comme l'Argent aujourd'hui, c'est un texte.
- **Barrière sur la fiche (R171, R201).** Les cases « Passe la barrière » (Mythril), « Casse la barrière » (Maverium) et « Dégâts doublés contre la barrière » (Laiton) existent (`fiche-moteur.mjs:3507-3518`, `degatsALaBarriere`). Elles sont citées dans `docs/character-generator.md:747-757`, dans la description du mot-clé `barriere` (« le Mythril passe à travers, le Maverium la brise ») et dans trois pages du guide. Si le docx remplace ces effets, ces textes sont périmés. Les cases restent utiles pour les sorts « Si CR : Ignore la barrière », le carreau « Pré-mythril (Arbalétrier) » et la capacité de monstre « Anti-barrière » (maverium).

### 3. Matériaux de la base que le docx ne cite pas
- **Fer** (`…:fer`, « rien de particulier », 100 RF / 10 RO) : inchangé.
- **Matériaux d'armure seuls**, sans ligne `materiau_arme` : Peau, Bois, Cuir, Cellulose, Corail, Chitine, Corne/Os, Écailles. Hors sujet pour les armes.

## Pour les autres
- **tech-back / tech-db.**
  - `arme-champs.mjs:337-338` (`analyserEffetDeMateriau`) ne reconnaît que `Dégâts +N pour l'arme` et `±N cran(s) de solidité` avec un trait d'union ASCII `[+-]` et sans point final. Les « −1 cran de solidité. » du docx (signe « − » U+2212, point final) iraient dans `effet_secondaire` et le cran serait perdu. Les crans de Fonte, Bronze et Titane doivent rester sur leur ligne, au format actuel.
  - Les nouveaux textes sont à poser sur le site, via R62 (table Composants, seule source) et `materiau_arme.effet_brut`. Le texte brut ne passe pas par une migration.
- **gd-fiche.**
  - Rien à calculer (R128).
  - Si MAJ-O2 est confirmé : revoir les libellés et l'aide des cases de barrière (`CASES_DE_LA_BARRIERE`) et leur doc.
  - Si le dé du « +1 dé » est précisé : un passif d'arme textuel suffit.
- **tech-skills** (via le chef technique) : `zone-armes` et `zone-fiche-equipement`, si les cases R171 ou la lecture des effets changent.

## Questions (non bloquantes ; le travail continue sans la valeur, jamais devinée)

**MAJ-O1 – Titane.**
- La base a « +1 cran de solidité » en plus de +9 dégâts (Armes › O27:AC28). Le docx n'écrit que « Avantage contre les effets de désarmement », alors qu'il liste les crans de Fonte et Bronze.
- Choix : (a) le Titane garde son +1 cran et gagne l'avantage ; (b) l'avantage remplace le cran ; (c) autre.
- Propriétaire.

**MAJ-O2 – Mythril, Maverium, Laiton et la barrière.**
- La base écrit Mythril « Passe barrière » (la barrière est ignorée) et Maverium « Casse barrière ». Le docx les remplace par « +1 dé de dégâts si l'arme touche une barrière » et « +1 dé si la créature n'a pas ou plus de barrière ». L'effet « dégâts doublés contre la barrière » du Laiton n'est plus cité.
- Les anciens effets sont-ils supprimés (la barrière encaisse alors normalement, R201 « prend toujours les coups avant »), ou gardés en plus ?
- Si supprimés : faut-il retirer Mythril, Maverium et Laiton des cases R171, de la description du mot-clé « Barrière » et du guide ? Les cases restent pour les sorts et les capacités de monstre.
- La capacité de monstre « Anti-barrière » (« même propriété que le maverium, il casse la barrière ») et le carreau « Pré-mythril » (Arbalétrier) restent-ils tels quels ?
- Propriétaire.

**MAJ-O3 – Anti-Alliage.**
- Anti-Mythril (Terre, niveau 4, coût 23) dit « L'effet du Mythril est annulé pendant 3 tours. » Le docx ne donne que le nouveau nom.
- Que fait Anti-Alliage : annule l'effet secondaire de tout matériau d'arme qui est un alliage (lesquels : Acier, Fonte, Bronze, Laiton, Vif-argent ?), de tout matériau, ou toujours le Mythril seul ? Les crans de solidité sont-ils annulés aussi ? La durée reste 3 tours ?
- Graphie : « Mytril » (l. 131 du docx) est une faute ; on garde « Mythril » (base), id inchangé `…#sort:anti-mythril` ? Oui ou non.
- Propriétaire.

**MAJ-O4 – « +1 dé de dégâts ».**
- Quel dé : celui de l'arme (R49, ex. D10 d'un Espadon) ou un dé fixe ? Même question pour les lignes existantes Argent et Or, jamais précisées.
- Le dé s'ajoute-t-il en coup critique ?
- Choix : « dé de l'arme » / « 1d6 » / autre.
- Propriétaire.

**MAJ-O5 – Acier.**
- « Une fois par combat, relancer les dés de dégâts, le second résultat conservé » : tous les dés du coup (arme, sorts fer, +1 dé des autres matériaux) ou seulement ceux de l'arme ?
- Le « une fois par combat » vaut-il par arme ou par personnage ?
- Propriétaire.

**MAJ-O6 – Fer noir.**
- Le texte n'a plus « à chaque coup qui touche » comme l'ancien. Les 4 de corruption (ou +2 dégâts et 2 de corruption) valent-ils à chaque coup qui touche ou une fois par cible ?
- Que veut dire « possède déjà de la corruption » pour une créature sans jauge de corruption ? Compte-t-on le total de la cible ?
- Propriétaire.

**MAJ-O7 – Cuivre.**
- « Sorts de type Fer » = les 13 sorts du mot-clé `sort-fer` (R164), Fer corrompu compris : oui ou non ?
- Propriétaire (confirmation).

**MAJ-O8 – Cibles (Argent, Os, Laiton, Or).**
- Faut-il lier « non-morts », « bêtes », « créatures mécaniques ou inertes » et « démons » aux types du bestiaire : Non-mort, Bête (Bête-ailé compris ?), Mécanique (+ capacité commune « Inerte » ?), Démon ?
- Les morts invoqués (Animation de mort) comptent-ils comme non-morts ? Les golems invoqués, comme inertes ?
- Propriétaire.

**MAJ-O9 – Avantage et désarmement (Titane).**
- « Avantage » n'a pas de définition globale (mot-clé absent). Lire « avantage » comme les capacités existantes (« lancer 2d100 et garder le meilleur » sur le jet de résistance) ?
- Que sont les « effets de désarmement » : le sort Désarmer (Vent), la capacité Guerrier « Désarmement », d'autres ?
- Propriétaire.

**MAJ-O10 – Mots-clés du glossaire.**
- Créer des mots-clés (Non-mort, Bête, Mécanique, Démon, Immatériel, Désarmement, Avantage) pour baliser ces effets, ou garder du texte brut (usage actuel de « non-morts » et « démons ») ?
- Choix : créer / texte brut.
- Propriétaire.

**MAJ-O11 – Vif-argent.**
- Le docx dit « permet de toucher les êtres immatériels ». La capacité de monstre « Immatériel » exclut aussi les armes physiques ordinaires : la formulation de la base « Touche l'immatériel » est-elle simplement reprise ? Oui ou non.
- Propriétaire (confirmation, faible enjeu).

Fichiers lus : `/home/user/MaverickCenter/data/rows/materiau_arme.sql`, `/home/user/MaverickCenter/data/rows/materiau.sql`, `/home/user/MaverickCenter/data/rows/mot_cle.sql`, `/home/user/MaverickCenter/data/rows/sort.sql`, `/home/user/MaverickCenter/client/src/lib/arme-champs.mjs`, `/home/user/MaverickCenter/client/src/lib/fiche-moteur.mjs`, `/home/user/MaverickCenter/docs/decisions-regles.md` (lignes R49, R51, R62, R128, R164, R171, R194, R201).
