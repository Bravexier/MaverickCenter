# Le Codex : le Google Doc « CODEX Maverick »

Le lore du jeu (histoire du monde, divinités, temples et guildes, civilisations, objets légendaires, glossaire) vient du Google Doc « CODEX Maverick ».
L'original (`1CwDqDKurMOdqig3ozX4NQETbBW9sggsxEqM1WfbOG5M`, document de l'ancien mainteneur) n'avait pas été copié par la migration `0014-sources-copies-drive` ;
le propriétaire en a fait une copie le **2026-10-11** (fichier « Copie de CODEX Maverick » de son Drive, `1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg`),
que citent le manifeste (`sources/sources.json`, `original` garde l'adresse d'origine), les pages et la page des Archives.

## Ce qui est importé

| Fichier | Contenu |
| --- | --- |
| `sources/raw/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg.md` | L'export Markdown du document (connecteur Google Drive, 2026-10-11), **tel quel** : 8 535 lignes, environ 680 000 caractères |
| `sources/raw/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg/` | Ses 27 images (l'export les embarquait en base64) : 21 symboles d'ordres et de guildes (189 px), 6 extraits de carte des provinces de Dombourg |
| `tools/docs/codex.py` | Le découpage en pages du wiki (type `lore`, famille `docs`), et son vérificateur (`--verifier`) |
| `tools/docs/codex-corrections.json` | Les corrections appliquées avant le découpage (voir plus bas) |
| `client/test/codex.test.mjs` | Les contrôles (vérificateur, pages dans la base, R21, registre) |

Le document compte huit parties :

| Partie | Pages produites |
| --- | --- |
| Au début … | Origine du monde, Situation actuelle, Les Impacts mineur et majeur (dates des grands événements : la chronologie, E5, [`chronologie.md`](chronologie.md)) |
| Les Divinités | 23 divinités (Tofrom et Morfot, 4 primordiaux, 13 dieux, 4 autres) et leur sommaire |
| Temples/Cultes/Guildes | 34 temples, cultes et guildes, rangés par magie, et leur sommaire (définitions, grades des croisés) |
| Les races non-jouable | Dragon, Vampires primordiaux et leur sommaire |
| Les Civilisations | Erisia (10 nations, dont l'Empire humain, plus les 4 royaumes de celui-ci, provinces en sections), Mrode (17 régions et territoires), une page par continent et leur sommaire ; Enhor, Engrevua, Désert Doré et Golopa n'ont qu'un titre |
| Les Outils Légendaires, Uniques | 14 objets et leur sommaire ; « Dague des zéphires » et « Lame de fer » ne sont que des gabarits vides (pas de page, nom au sommaire) ; « Armures » est vide |
| Les Chroniques | Vide dans le document |
| GLOSSAIRE | Glossaire (termes du jeu) |

Plus `lore/codex`, le sommaire de tout le document. Le menu **Codex › Mythologie** mène aux Divinités, **Codex › Factions** aux Temples/Cultes/Guildes ;
**Codex › Chronologie** reprend les événements datés du document (la liste des Impacts en entier, et les dates des autres pages) : [`chronologie.md`](chronologie.md) ;
Carte & lieux reste « bientôt » (E6 de la [feuille de route](feuille-de-route.md)).

## Règles du découpage

- **Le texte est copié, jamais réécrit** : coquilles, majuscules et formulations sont celles du document. Seule la forme Markdown change : niveaux de titre,
  ligne en gras-italique seule devenue un titre de section, tirets échappés devenus des listes, espaces de fin de ligne ; images, titres vides et ancres
  sont retirés.
- Une page = une section du document. Titre de la page = le nom (« Brock - Dieu primordial de la force » → « Brock ») ; le reste du titre (sous-titre,
  parenthèse « (Vénère Séraphe) », « (Avant 1145) ») est écrit en italique en tête de page. Une parenthèse « (Temple du …) » est aussi un alias.
- Résumé : le sous-titre d'une divinité, sinon la première phrase de la page.
- Mots-clés : « codex », la partie (divinité, faction, civilisation…), la magie d'un temple (nom de la magie dans la base), le continent.
- Le renvoi « Voir “Temple du Vent” » (Mrode) devient un lien vers « Temple de Vent », le titre de la section des temples.
- **Les liens sont des balises de mots-clés** (migration 0098 : « tous les liens deviendront des mots-clés et tous les mots-clés deviendront des liens »).
  Un renvoi (sommaires, « Voir aussi », renvoi du document) s'écrit avec la balise du mot-clé dont l'adresse (`mot_cle.url`) mène à la page visée,
  `/lore/<slug>/` sans ancre, citée par sa clé (`mot_cle.cle`, migration 0113) : `{{clé}}` quand le texte affiché est son libellé d'import (celui
  d'avant un renommage sur le site ; un renommage réécrit les balises qui le citent, journal compris, R232 (3) : ces pages sont contrôlées dans leur
  état d'import), `{{clé|texte}}` sinon (`{{temple-de-vent|Temple du Vent}}`) ; jamais un
  `[[…]]`, que `db:check` refuse. Un import ne crée jamais de mot-clé : sans **exactement un** mot-clé pour la page, le renvoi est écrit en texte simple
  et le script le signale (« renvoi sans mot-clé, écrit en texte simple », à l'écriture et au `--verifier`) ; il se répare en donnant l'adresse à un
  mot-clé sur le site de dev, puis en relançant le script (`Codex.lien`). Le mot-clé d'une page (« Mrode », « Erisia », « Glossaire », créés par la
  0098) n'est jamais posé comme étiquette de partie (`Vocabulaire.etiquette`) : les pages ne gardent que « codex ».
- L'état d'import d'une page modifiée par le site, relu dans l'historique, peut dater d'avant la 0098 : `--verifier` y lit ses `[[…]]` comme le script
  les écrit aujourd'hui (`liens_en_balises`), comme la migration a converti la page de la base.
- Un nouvel export : le remplacer dans `sources/raw/`, puis `python3 -I tools/docs/codex.py`, `--verifier`, `npm run db:sync-pages` (depuis `client/`).
  Puis la chronologie, qui cite le texte des pages : `node tools/chronologie/chronologie.mjs --verifier` ; un extrait à reprendre se corrige dans
  `tools/chronologie/evenements.json`, puis une migration écrite par `--sql` ([`chronologie.md`](chronologie.md)).
  Le script n'écrit que dans `lore/`, refuse d'écraser une page qui ne vient pas du document et signale (sans les supprimer) les pages qu'il ne produit plus.

## Modifier le Codex (site de dev)

Demande du propriétaire : « Exactement comme pour les pages des règles les pages du codex doivent pouvoir être modifiées aussi ». Sur le site de dev, en mode
modification (`docs/serveur.md`, « Édition »), le titre et le texte d'une page du Codex se modifient avec l'éditeur des pages du guide (la page entière est
un seul morceau de texte, réécrit en Markdown : `lib/markdown-edition.mjs`, dont l'aller-retour est rejoué sur toutes les pages du Codex). Seules les
pages tirées du document le sont (`lib/edition-modele.mjs#texteDePageModifiable`) ; « Relations entre les races », du classeur des races, ne l'est pas.
Un ancien titre devient un alias ; HTML brut et liens non sûrs sont refusés, comme pour le guide. Les modifications sont listées dans la note de version
(domaine « Codex » ; à sa première livraison, le Codex y tient en une ligne).

Le site est la source de ce qu'il modifie : une page qu'il a modifiée est contrôlée par `--verifier` **dans son état d'import** (titre, texte et alias
d'avant toute édition, relus dans `data/rows/historique_modification.sql` : `pages_du_site`) ; une nouvelle écriture des pages (`codex.py`) la **garde**
telle que le site l'a laissée, et `--verifier` signale alors si le document a changé depuis pour elle (à reprendre à la main). Les mots-clés sont un
vocabulaire géré sur le site (migration 0043, page Recherche) : une page dont un mot-clé a été renommé, fusionné ou retiré sur le site compte aussi comme
modifiée (gardée telle quelle à l'écriture, ses mots-clés non comparés au document : sinon l'ancienne écriture reviendrait). Depuis la migration 0056
(glossaire), un import ne crée jamais de mot-clé : le script n'écrit que les mots-clés du vocabulaire (`data/rows/mot_cle.sql`, option `--vocabulaire` ;
`vocabulaire()` → `Vocabulaire`, même règle que `tools/db/maverick.py#mot_cle`), dans son écriture ; les étiquettes de partie (« divinité », « faction »…) ne sont plus
dans le vocabulaire, chaque page ne porte que « codex », posé par son id (`MOT_CLE_DU_CODEX`, `Vocabulaire.protege` : l'id entier que lui donne
`tools/db/maverick.py#MOTS_CLES_PROTEGES`, migration 0113, écrit avec son libellé courant, jamais le mot-clé qui aurait pris l'écriture « codex » ;
`docs/sources.md`). `--verifier` refait le découpage attendu avec le vocabulaire **de l'état d'import**
(`Vocabulaire(…, etat_d_import=True)` : l'historique du site rejoué à l'envers sur `mot_cle`) : un mot-clé que le site a supprimé (R196 : seulement
s'il n'est mentionné nulle part), créé ou déplacé (adresse changée) ne change pas les renvois que l'import a écrits (par ex. deux mots-clés pour une
page, renvoi en texte simple, dont l'un est supprimé). L'écriture des pages garde le vocabulaire courant (une balise ne cite qu'un mot-clé qui existe).

## Corrections appliquées (`tools/docs/codex-corrections.json`)

L'export reste tel quel ; le script corrige, avant le découpage, **seulement** ce qu'une décision ou une correction déjà faite dans toute la base impose
(chaque entrée a son nombre d'occurrences attendu) :

- **Décision R21** : « le Démon d'Eau Noire » (2 fois) et « Eaunoir » (18 fois) deviennent « Eaunoire » ; le document écrit lui-même 3 fois « Eaunoire ».
  La page s'appelle « Eaunoire », alias « Eaunoir ».
- « ect » → « etc. » (comme la migration `0005`), « purée de poix » → « purée de pois » (comme `0006`).
- **Décision R266** (migration `0121-maj-decembre-suites`, exception explicite à « un texte copié n'est pas réécrit », limitée à trois graphies) : « dieu de la
  Terre » (9 fois) et « Dieu de la terre » (1 fois, le titre de Dimitri) → « Dieu de la Terre » ; « Mort fertile » (1) → « Mort Fertile » ; « super gemme » (2)
  → « Super Gemme ». Ces quatre entrées portent la clé `migration` : `--verifier` les applique aussi à l'état d'import d'une page que le site de dev avait
  modifiée avant la migration (son texte d'import garde l'ancienne graphie : `graphies_de_migration`, comme `liens_en_balises` pour la 0098).

La relecture orthographique du Codex (décision R10) reste à faire, par une migration de données avec son registre, comme `0005` pour le reste de la base.

## Questions au propriétaire

1. **Eaunoire, dieu ou déesse ?** R21 parle de « la déesse de la Corruption » ; le Codex en parle au masculin (« le dieu déchu », « Dieu de la corruption »,
   « l'Être de la corruption »). Le texte est gardé tel quel.
2. **« Enhor » ou « Enohr » ?** Le continent s'écrit « Enhor » dans les Civilisations, « Enohr » dans les Impacts mineurs (« Le Blizzard de la Peine »).
3. **Les images** (symboles des ordres, cartes des provinces) : les montrer sur leurs pages ? Elles sont dans `sources/raw/`, pas encore dans `client/public/`.
4. **Les sections vides** (Chroniques, Armures, Destruction, Enhor, Engrevua, Désert Doré, Golopa, Dague des zéphires, Lame de fer) : à écrire dans le document ;
   un nouvel export les ajoutera.
5. **Le glossaire** définit des termes de règles (Acquis, IC « Maximum 3 différentes par tour », Mode Hyper…) : il reste une page du Codex ; le relier au
   guide du joueur ?
