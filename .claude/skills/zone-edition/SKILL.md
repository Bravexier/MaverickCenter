---
name: zone-edition
description: "Mode modification du site de dev : champs data-ed, TABLES et CHAMPS_DE_TEXTE de edition-modele.mjs, rendus de edition-rendu.mjs, service /api/edition/, journal et son rejeu, colonnes dérivées, éditeur en place, Markdown sûr. À charger avant de lire, modifier ou relire l'édition ou ses tests."
paths: ["client/src/scripts/edition.mjs", "client/src/scripts/edition/**", "client/src/lib/edition-modele.mjs", "client/src/lib/edition-rendu.mjs", "client/src/lib/markdown-edition.mjs", "client/src/lib/markdown-couleurs.mjs", "client/src/lib/markdown-sur.mjs", "client/src/lib/tables-de-la-base.mjs", "client/src/lib/dons-edition.mjs", "client/src/components/edition/**", "client/src/styles/edition/**", "client/serveur/edition.mjs", "client/serveur/edition-*.mjs", "client/test/*edition*.test.mjs", "client/test/tables-de-la-base.test.mjs", "client/test/markdown-sur.test.mjs", "client/test/suppressions-d11.test.mjs"]
user-invocable: false
---
# Mode modification (site de dev)

## Fichiers
- Page : `src/scripts/edition.mjs`, extensions `src/scripts/edition/` (une par domaine : `classes.mjs`, `annonces.mjs`, `texte-en-place.mjs`, `mots-cles-vivants.mjs`…), `components/edition/Edition.astro`, `styles/edition/`.
- Modèle et rendus : `lib/edition-modele.mjs` (`TABLES`, `CHAMPS_DE_TEXTE`, `typeDeTexte`, `attributEd`, `ligneSansImage`), `lib/edition-rendu.mjs` (`RENDUS`), `lib/markdown-edition.mjs` (HTML → Markdown), `lib/markdown-couleurs.mjs`, `lib/markdown-sur.mjs`, `lib/tables-de-la-base.mjs`.
- Service : `serveur/edition.mjs` (un lot d'un bloc, tout ce qui dépend d'un champ recalculé), `serveur/edition-journal.mjs` (section 14, rejoué quand les règles changent), extensions `serveur/edition-<domaine>.mjs` (le refus commun d'un corps de page illisible : `serveur/edition-corps.mjs` ; les sources de maîtrise d'arme : `serveur/edition-maitrises.mjs`, ci-dessous).
- Dons et spécialités (D11) : `lib/dons-edition.mjs`, extension `edition/classes.mjs`, rendu pur `lib/classe-dons-rendu.mjs` sur `lib/classe-assemblage.mjs`.
- Ce que chaque domaine modifie et recalcule : le skill de sa zone. Balises du glossaire : skill `zone-mots-cles`. Rapatrier un journal : skill `rapatrier-l-edition`. Mise à jour et rejeu par GitHub : skill `zone-mise-a-jour`. `/api/v1/` (écrit par ce service) : skill `zone-api-rest`. Le service en général : skill `zone-service`.

## À lire
- `docs/serveur.md`, « Édition des règles (site de dev) » : ce qui se modifie page par page, balises, corps des pages typées, D11, fiches (R42), journal, rejeu, rapatriement, routes `/api/edition/`.

## Ce que couvre le mode modification (demande du propriétaire)
- Site de dev seulement (`MAVERICK_EDITION=1`, sinon `/api/edition/` répond 403 et la page ne charge pas l'éditeur), sur tous les écrans, téléphone compris.
- Crayon à cocher, bouton « Enregistrer » flottant : toutes les modifications de la page partent d'un bloc.
- Champs `data-ed` : pages du guide, du Codex, races, magies, classes, métiers, bestiaire, armes, armures et boucliers, composants, consommables de la ceinture (nom, niveau, prix, effet d'une potion), chronologie, panneaux de règles (titre, texte, titre des tuiles), annonce de l'encart « Notre prochaine rencontre IRL » sous le texte de Bienvenue (`edition/annonces.mjs`).
- Création : races, peuples, classes, métiers, spécialités, dons, espèces, cartes de monstre, événements, catégories de la chronologie, mots-clés, blocs de panneau de règles.
- Suppression : métiers, spécialités, dons, cartes de monstre, espèces sans carte, événements, catégories, mots-clés, blocs de panneau de règles. Supprimer un don, une spécialité ou un métier qu'une fiche utilise l'en retire (R42, réponse `fiches` du lot).
- Vocabulaire des mots-clés sur `/recherche/` (renommer, fusionner, supprimer, créer) : skill `zone-recherche`.
- Éditeur en place (`edition/texte-en-place.mjs`, HTML → Markdown) : texte du guide, descriptions de la chronologie, blocs des panneaux de règles, annonce sous Bienvenue. Barre d'outils à gauche de l'écran, à la hauteur de la zone où est le curseur (`hauteurDeLaBarre`, demande du propriétaire). Plusieurs éditeurs en place sur une page (Bienvenue : le texte, `edition/guide.mjs`, et l'annonce) : une seule barre se montre, celle de l'éditeur où est le curseur, sinon la dernière qui l'a eu, sinon la première posée (`texte-en-place.mjs#choisirLaBarre`, `test/texte-en-place-barres.test.mjs`).
- Surcouche : chaque page réaffiche les lignes modifiées depuis sa construction (`GET /api/edition/en-attente/`).

## Invariants
- Le service n'accepte que les colonnes de `TABLES` (`lib/edition-modele.mjs`).
- Un champ affiché porte `data-ed='["table",{clé},"colonne"]'` (`attributEd`) et, s'il ne s'affiche pas en texte brut, un rendu de `lib/edition-rendu.mjs` (`data-ed-rendu`) qui redonne le HTML du gabarit. Un seul HTML pour la page construite et le mode modification.
- Rendre une colonne modifiable : son entrée dans `TABLES`, ce qui en dépend recalculé dans `serveur/edition.mjs` (colonnes `X_cle`, typées, tables de détail, page du wiki) et un test `serveur-edition-*`.
- Les découpages (`metier-champs.mjs`, `sort-analyse.mjs`, `classe-champs.mjs`) refont ceux des importeurs : leurs tests les rejouent sur toute la base.
- Sources de maîtrise d'arme (`maitrise_arme_part`, `maitrise_arme_part_famille`, `capacite_nm_gagne` : migration 0072, R148 à R151, R154) : refaites par le lecteur `lib/maitrise-arme.mjs` à chaque écriture qui change ce qu'il lit — `classe.maitrise_arme` (`CLASSE.deriver`), l'effet d'un don (`CAPACITE.deriver`), `creerDon`, `retirerDon` — notées au journal par `serveur/edition-maitrises.mjs#partsAEcrire`, en deux temps à cause des clés étrangères (les parts qui partent avant leur ligne de classe ou leur don, les nouvelles après). Un don qui `suit` sans exactement une ligne `au_choix` dans sa classe : refus 409 (`verifierLesDonsQuiSuivent`, R151). `test/serveur-edition-maitrises.test.mjs` compare ces tables au lecteur rejoué sur toute la base après chaque écriture.
- Une table ajoutée à la section 14 va dans `TABLES_DU_JOURNAL`, une de la section 15 dans `TABLES_DES_NOTES` (`lib/tables-de-la-base.mjs`, la seule liste : `TABLES_EDITION` de `base-vivante.mjs` et `TABLES_INTERDITES` de `edition-journal.mjs` en sont tirées ; `test/tables-de-la-base.test.mjs` les compare au schéma).
- Une colonne tirée des tables (corps et résumé des pages typées, `donnees` des fiches de dons) est une colonne dérivée (`colonneDerivee`, `serveur/edition.mjs`) : le rejeu la refait (`recalculerLesPages`), elle n'est jamais recopiée du journal.
- Rien des fiches de personnages ne va au journal : `TABLES_INTERDITES` contient la section 13 (skill `zone-fiches-base`).
- `Edition.astro` n'est pas dans la version portable (`INLINE_CSS=1`).
- Un HTML redessiné par l'éditeur pose les couleurs comme la page construite : les classes de la palette (`lib/palette-css.mjs`, que l'éditeur peut importer, hors version portable : `scripts/edition/races.mjs`, `scripts/edition/nouvelles.mjs`, `edition-rendu.mjs` par les rendus du bestiaire, des composants et de la ceinture), jamais une couleur de magie, de caractéristique, de compétence, de catégorie de classe, de race, de matériau, de type d'armure ni de poids en style (skill `ui-couleurs` : un matériau ajouté sur Composants a la classe `couleur-materiau-par-defaut`, un type ou un poids modifié la classe de sa valeur, toutes émises par leur page ; `metier-cible`, `metier-carac` et la compétence d'une arme portent la classe de leur caractéristique ; la page d'une race ou d'une classe créée, dessinée sur la page 404, porte la classe de sa nature ou de sa catégorie, `classeDeRace`, `classeDUneClasse`, et émet sa famille avec sa feuille, `cssDesFamilles(['race'])`, `cssDesFamilles(['classe'])`).

## Rejeu du journal
- `rejouerLeJournal` (`serveur/edition.mjs`) rejoue le journal par `rejouer` (`serveur/edition-journal.mjs`). Son adaptateur (`adapter`) relit les écritures d'avant certaines migrations : mots-clés et glossaire (skill `zone-mots-cles`), capacités de monstre et résistances d'avant la 0075 (skill `zone-bestiaire`), armures et boucliers (skill `zone-armures`), coût secondaire des sorts.
- Le rejeu écrit `page_tag` au-delà du journal (cascade d'un mot-clé supprimé sur les pages d'exemple).
- Il refait aussi, après chaque lot qui touche une classe ou un don, les sources de maîtrise d'arme que le lot ne note pas (un lot d'avant 0072 : `sourcesRefaitesParLeLot`, crochet `apresLeLot`, hors journal) ; une source dont le lot note les lignes suit son journal (fantômes compris).
- Il réécrit les textes de toute la base qui citent un mot-clé supprimé ou fusionné, au moment où son lot est rejoué (`balisesRetireesParLeLot`, crochet `apresLeLot` de `rejouer`, dans le lot) : un lot suivant qui modifie un texte ainsi réécrit le retrouve tel que le site de dev l'a lu. Cela couvre pages d'exemple et textes reçus depuis ; la cible d'une fusion est reconnue aux étiquettes ou balises que le lot reporte (`cibleReportee`).
- Puis les colonnes dérivées après les pages refaites (`balisesDesColonnesDerivees`), les pages typées que ces textes refont (`page`) et `mot_cle` pour un lot d'avant la 0043 (un mot-clé protégé seulement).
- Tables autorisées : `rejouerLeJournal` (`tablesCompletees`) et `scripts/mise-a-jour-github.mjs#tablesDuLot` (même règle, recopiée ; les tables dont `data/rows` a une balise : `tablesAvecBalises`, `git grep` ; les sources de maîtrise d'arme pour un lot qui touche `classe`, `classe_maitrise_arme` ou `capacite` : `TABLES_DES_SOURCES_DE_MAITRISE`, comparée à `edition-maitrises.mjs#TABLES_DES_SOURCES`).
- `rejouerUne` est la forme courte d'`evaluerUne` (issue structurée : genre du conflit, colonnes) ; `parcourirUnLot` rejoue UN lot sans s'arrêter au premier conflit (colonnes saines écrites), pour l'examen et la résolution d'un lot en conflit (`serveur/edition-conflits.mjs`, skill `zone-mise-a-jour`). L'adaptateur est le même (`adaptateurDuJournal`) ; une forme ancienne de plus s'y ajoute une fois pour les deux.
- Résolution : les colonnes du modèle passent par l'opération « modifier » (`OUTILS_DE_RESOLUTION` de `serveur/edition.mjs`), jamais par du SQL direct ; le reste comme le rejeu, noté dans le nouveau lot.
- Les lots d'avant la 0043 et la 0056 que le glossaire rejoue sans effet (`ancienneEcritureDuGlossaire`) : skill `zone-mots-cles`, « Rejeu du journal ».

## Spécialités et dons créés ou supprimés (D11)
- Identifiant tiré une fois du nom puis figé, jamais réutilisé (l'historique et le journal comptent).
- Place « à la fin de son niveau » sur un numéro libre ; nature selon la règle des choix déjà écrite (un don seul sur sa ligne est reçu sans choix) ; rien d'autre n'est déduit.
- La fiche d'un don créé ne porte que le mot-clé « capacité de classe » (0056).

## Textes et balises du glossaire
- Tout texte d'un lot (colonnes ligne, texte, markdown : `CHAMPS_DE_TEXTE`) passe en forme canonique des balises, celle de sa colonne, avant les dérivations et le journal.
- L'éditeur en place montre les mots-clés en balises écrites : à l'entrée, `strong.mot-cle` et `span.mot-cle-definition` → `{{id}}`, `{{id|texte}}`, `{{id:}}` (`lib/markdown-edition.mjs#baliseEcrite`). Le Markdown relu à l'entrée se lit après, sinon un texte non retouché partirait modifié (demande du propriétaire).
- Ses outils écrivent la balise (`insertText`) ; toute nouvelle barre d'outils ajoute `outilsDesMotsCles(texte)`.
- `edition/mots-cles-vivants.mjs` rend les balises du HTML posé après le chargement et suit le vocabulaire vivant.

## Markdown sûr et aller-retour
- Guide : `data-ed-morceau` = un morceau de texte visible du corps (`decouperCorps`).
- Ni HTML brut ni lien non sûr ajouté au Markdown d'une page, d'un bloc de la chronologie, d'un panneau de règles ou de l'annonce sous Bienvenue (`serveur/edition.mjs#ANNONCE`). Contrôle par `lib/markdown-sur.mjs` : au service, au lot reçu, puis sur les textes après le rejeu de la mise à jour et du rapatriement (`scripts/mise-a-jour-regles.mjs#TEXTES_EN_MARKDOWN`, `texteNonSurApresLeRejeu`).
- Les liens du wiki portent `data-cible` (`wikilinks.mjs`), que l'éditeur réécrit en `[[cible|texte]]`.
- La couleur d'une case s'écrit `{couleur:x}` (`markdown-couleurs.mjs`) ; le plugin est déclaré dans `astro.config.mjs` ET `lib/guide-rendu.ts`, qui doivent rester d'accord.

## Tests
- `markdown-edition` : l'aller-retour Markdown → HTML → Markdown sur toutes les pages du guide.
- `serveur-edition*` (chaque domaine, journal, rejeu, corps, dérivations, rapatriement, fiches, conflits, sources de maîtrise d'arme : `serveur-edition-maitrises`), `edition-rendu`, `edition-tous-ecrans`, `edition-annonces`, `edition-panneaux`, `edition-mots-cles`, `dons-edition`, `tables-de-la-base`, `db-appliquer-edition`.
- `markdown-sur` (les barrières du Markdown sûr : service, lot reçu, pages après le rejeu), `suppressions-d11` (les tests qui lisent des spécialités et des dons importés tiennent quand le site de dev en supprime).
