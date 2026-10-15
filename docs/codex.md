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
modifiée (gardée telle quelle à l'écriture, ses mots-clés non comparés au document : sinon l'ancienne écriture reviendrait et `db:sync-pages` en ferait un
second mot-clé).

## Corrections appliquées (`tools/docs/codex-corrections.json`)

L'export reste tel quel ; le script corrige, avant le découpage, **seulement** ce qu'une décision ou une correction déjà faite dans toute la base impose
(chaque entrée a son nombre d'occurrences attendu) :

- **Décision R21** : « le Démon d'Eau Noire » (2 fois) et « Eaunoir » (18 fois) deviennent « Eaunoire » ; le document écrit lui-même 3 fois « Eaunoire ».
  La page s'appelle « Eaunoire », alias « Eaunoir ».
- « ect » → « etc. » (comme la migration `0005`), « purée de poix » → « purée de pois » (comme `0006`).

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
