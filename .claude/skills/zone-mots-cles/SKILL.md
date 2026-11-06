---
name: zone-mots-cles
description: "Glossaire mot_cle (dont l'abréviation) et balises {{ref}} (rendu par le middleware, forme canonique, db:check), importeurs, MOTS_CLES_PROTEGES et refus du service, lots d'avant 0043 et 0056. À charger avant de lire, modifier ou relire ce code ou un texte qui cite un mot-clé."
paths: ["client/src/lib/mots-cles*.mjs", "client/src/middleware.mjs", "client/src/styles/global/mots-cles.css", "client/src/scripts/edition/mots-cles-vivants.mjs", "tools/db/homonymes.py", "client/test/mots-cles*.test.mjs", "client/test/aide-mots-cles.mjs", "client/test/texte-en-place-mots-cles.test.mjs", "client/test/importeurs-etiquettes.test.mjs", "client/test/db-lexique-en-mots-cles.test.mjs", "data/migrations/0043-*", "data/migrations/0056-*", "data/migrations/0058-*", "data/migrations/0090-*"]
user-invocable: false
---
# Mots-clés (glossaire)

## Fichiers
- Balises : `client/src/lib/mots-cles-balises.mjs` (lecture, forme canonique `formeCanonique`, rendu `htmlAvecMotsCles`, `texteSansBalises`, `avecLeursBalises`, `zonesDeCode`, `ambiguiteDe`, `EXCLUS`).
- Rendu sur tout le site : `src/middleware.mjs` (build et `astro dev`), CSS `styles/global/mots-cles.css`.
- Vocabulaire : `lib/mots-cles.mjs` (`MOTS_CLES_PROTEGES`), `lib/mots-cles-db.mjs` (`textesDeLaBase`).
- Site de dev : `src/scripts/edition/mots-cles-vivants.mjs` (vocabulaire vivant ; refait les bulles et rend les balises du HTML posé après le chargement) ; service : `serveur/edition.mjs` (`texteAvecMotsClesCanoniques`, `motCleDe`, `reecrireLesBalises`), `serveur/edition-chronologie.mjs` (`verifierSansSort`, opérations du vocabulaire).
- Importeurs : `tools/db/maverick.py` (`mot_cle`, `poser_les_mots_cles`), `tools/db/homonymes.py` (`MAGIES_HOMONYMES`), `tools/docs/codex.py --vocabulaire`.
- Page `/recherche/`, index de recherche et gestion du vocabulaire en mode modification (`src/scripts/edition/mots-cles.mjs`, `lib/mots-cles-edition.mjs`) : skill `zone-recherche`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) » : écritures, forme canonique, refus, renommer / supprimer / fusionner, ce qui n'est pas un mot-clé.
- `docs/serveur.md`, « Édition des règles (site de dev) » : rejeu des balises d'un mot-clé supprimé ou fusionné, lots d'avant 0043 et 0056.
- Baliser un mot dans tous les textes : skill `zone-mots-cles-balisage`. La forme canonique est aussi à appliquer côté édition : skill `zone-edition`. La chronologie a des catégories, pas des mots-clés : skill `zone-chronologie`.

## Le glossaire (table `mot_cle`)
- Migrations `0043`, `0056` (et `0058` pour « Solidité »), `0090` (R183 : le Lexique converti en mots-clés, 110 au total). Colonnes : `id` figé, `libelle`, `libelle_cle` = `normalize`, `description` (la définition), `abreviation` (une par mot-clé, NULL sinon).
- La définition est NULL tant qu'elle n'est pas écrite, partout (base, service, `mots-cles-db.mjs`) ; elle se lit `?? ''`.
- La 0056 n'a gardé sur les pages que `MOTS_CLES_PROTEGES` et le glossaire ; les ids des 400 mots-clés retirés peuvent resservir.
- Une page porte un mot-clé par `page_tag.tag_id` (`ON DELETE CASCADE`) ; un sort, en étiquette, par `sort_mot_cle` (migration 0067, sans cascade : R114 ; « Sort fer » sur les 13 sorts « Fer… », migration 0079 : R164).
- La chronologie a des catégories (`categorie_chronologie`), pas d'étiquettes.
- Un mot-clé renommé garde son id (et ses adresses `?mot-cle=<id>`).
- Une abréviation peut valoir l'id de son propre mot-clé (`rf`, `ro`, `pp`, ids de la table `monnaie`). `des` remplace `d100-d20-d6` ; `cr` n'existe plus (« CR » est l'abréviation de `corruption`, R183 (3)). Les étiquettes protégées s'appellent « Classe » et « Métier » (R183 (8)) ; leur clé ne change pas.
- Une capacité, un état ou un type homonyme reste ce qu'il est : aucun lien implicite. Seule une balise fait un mot-clé.

## Balises
- Marquage explicite seulement, jamais de repérage automatique (demande du propriétaire). `{{ref}}`, `{{ref|texte}}` (gras, définition en infobulle), `{{ref:}}` (= `{{ref :}}`, mode complet « **Libellé** : définition »). Dans une case de tableau Markdown, `\|`.
- Dans une saisie, `ref` = id, écriture ou abréviation du mot-clé, quelle que soit la casse ; la casse écrite est gardée pour le libellé et l'écriture (`{{solidité}}` → `{{solidite|solidité}}`, `texteEcrit` ; demande du propriétaire). Une abréviation s'enregistre telle que la base l'écrit, quelle que soit la casse tapée : `{{cr}}`, `{{Cr}}`, `{{CR}}` → `{{corruption|CR}}`, `{{AM}}` → `{{armure-magique|AM}}` (choix du leader-technique, consigné dans R183 (2) ; R140 écrit « CR » en majuscules).
- La base ne garde que des ids, sous la forme canonique de la colonne (`typeDeTexte`, `CHAMPS_DE_TEXTE` de `lib/edition-modele.mjs`, la seule liste des types de champ texte) :
  - texte mis en forme (Markdown : pages, chronologie, panneaux) : `{{id}}` (suit le libellé ; le libellé écrit en texte y revient), `{{id|texte}}` pour un autre texte, `{{id:}}` ; une balise dans un code (`zonesDeCode`) est gardée telle quelle ;
  - texte de case (`ligne`, `texte`) : `{{id|texte}}` toujours (il se lit sans le vocabulaire) ; le mode complet est refusé.
- Le service enregistre la forme canonique (`texteAvecMotsClesCanoniques`, avant les dérivations et le journal). Il refuse une ref inconnue ou ambiguë (deux mots-clés visés par deux des trois chemins, id, écriture, abréviation : `ambiguiteDe`), sauf si elle était déjà présente avant, et le mode complet dans un texte de case.
- Supprimer retire les balises, fusionner les recible, dans les colonnes texte de `TABLES`, par le chemin normal d'une modification (`reecrireLesBalises`). Renommer ne réécrit aucun texte.
- Un emplacement `{N}` n'est jamais `{{N}}`. Le passage Markdown des monnaies (`morceauxDeMonnaie`) ne lit rien dans une balise.

## Rendu (middleware)
- Rendues dans les nœuds de texte, une bulle par mot-clé et par page. Jamais dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous `[data-mots-cles-bruts]` (`/donnees/`, aides, dialogues et annonce du mode modification, page Debug), ni dans leurs attributs. `EXCLUS` est la même liste dans `mots-cles-vivants.mjs`.
- Dans une `.bulle` : le gras seul. Dans un élément focalisable (a, button, summary, label, select, `[tabindex]`) : sans `tabindex` ; dans un bouton ou un résumé : sans bulle.
- Texte simple dans `<title>`, `<option>` et les attributs de texte (`data-*` JSON compris, sauf `data-balise` et `data-ed…`) ; une entité inconnue n'est pas échappée deux fois (`mots-cles-balises.test.mjs`).
- Le titre d'une bulle est `htmlDuNomDuMotCle` : « Libellé (ABR) » ; pour une monnaie, le libellé suivi de l'icône. Un mot-clé de monnaie se reconnaît à son id (celui de la table `monnaie`), jamais à son abréviation. Le texte d'une balise, la définition du mode complet et celle de la bulle montrent les monnaies en icônes (R63, R183 (9)) ; le passage Markdown ne lit rien dans une balise, et au rendu son texte affiché et la définition du mode complet passent par `htmlAvecMonnaies`, décomposition comprise (R183 (12)). Le module dépend de `lib/monnaies.mjs`. `/recherche/` : skill `zone-recherche`.
- L'id `mot-cle-<id>` est réservé aux bulles (posées en fin de page, jamais à la main : skill `ui-infobulles`).
- Un JSON servi retire lui-même les balises (`texteSansBalises` : `regles.json` sans les définitions, index de recherche).
- Un découpage lit le texte sans balises ; un affichage morceau par morceau les garde (`avecLeursBalises`).

## Invariants
- `db:check` refuse une ref qui n'est pas un id et une forme non canonique (la règle de `formeCanonique`, sauf `{{id|Libellé}}` dans un texte mis en forme), dans toutes les colonnes de texte des règles et des pages (`lib/mots-cles-db.mjs#textesDeLaBase`, `formesNonCanoniques`), sauf les sections 13 à 15, les tables dérivées et les traces gardées telles quelles (`lib/tables-de-la-base.mjs`).
- `db:check` refuse une abréviation qui rendrait une ref ambiguë (`fautesDeLAbreviation`) : sans lettre ni chiffre ; avec une espace au début ou à la fin ; avec `{`, `}`, `|`, un saut de ligne ou un `:` final ; égale à l'écriture du mot-clé lui-même ; égale à l'id, à l'écriture ou à l'abréviation d'un autre. Égaler son propre id est permis. `abreviationsPrises` : un mot-clé créé ou renommé ne prend pas l'id ou l'écriture qui est l'abréviation d'un autre.
- Aucun script de page n'importe `mots-cles-balises.mjs` (il entraîne `text.mjs` et `monnaies.mjs`).
- Les lectures du sens d'une modification (R29, `lib/notes-de-version-sens.mjs`) lisent les cases sans balises. Un test qui compare un texte « tel qu'écrit » à une sortie qui retire les balises lit ce texte sans elles (`texteSansBalises`) ou le rend comme le middleware (`htmlAvecMotsCles`).

## Vocabulaire : ce que le service refuse
- `MOTS_CLES_PROTEGES` : ceux dont le site se sert pour ranger ses pages (catégories de `/classes/`, « classe », « race », « race hybride », « capacité de classe », « métier », « codex »), « Sort grenade » (R114) et « Sort fer » (R164), que la fiche lit. Ils ne se suppriment ni ne changent de clé (`409` avec la raison) ; leur définition se modifie. Sur `/recherche/` : skill `zone-recherche`.
- Un mot-clé qui étiquette un sort ne se supprime ni ne se fusionne, dans un sens ou l'autre (`409` qui nomme les sorts : `serveur/edition-chronologie.mjs#verifierSansSort`, test `serveur-edition-chronologie.test.mjs`, R114, R164).
- Un renommage vers une écriture déjà prise est une fusion explicite (`fusionner_mots_cles`).
- L'abréviation se modifie pour tous, protégés compris. `serveur/edition.mjs#refuserLAbreviation` (création, renommage, abréviation changée) applique la règle de `db:check` : 400 si elle est mal écrite, 409 si un autre mot-clé la prend (`mot_cle` le nomme) ; le détail porte `champ: 'abreviation'`. Lecture : `mots-cles-db.mjs#motsClesDeLaBase`.

## Importeurs
- Le `tags:` d'une page s'écrit par libellé : `tools/db/maverick.py#mot_cle` et `serveur/edition.mjs#motCleDe` retrouvent le mot-clé par son écriture.
- Un import ne crée jamais de mot-clé : une écriture inconnue n'est pas posée, `db:sync-pages` la signale ; `codex.py --vocabulaire`.
- Le service ne pose sur une page qu'il crée que des mots-clés protégés (une fiche de don : « capacité de classe »).
- Le site de dev est la source du vocabulaire (`historique_modification`) : une écriture qu'un mot-clé a quittée mène à lui (renommé) ou au mot-clé qui l'a reçu (fusionné) ; celle d'un mot-clé supprimé n'est pas reposée (`poser_les_mots_cles`, `test/mots-cles-python.test.mjs`).
- Un homonyme n'est jamais posé par un import (`tools/db/homonymes.py#MAGIES_HOMONYMES` : la magie « corruption » ou « sang » d'un temple du Codex, d'une page de magie, d'une créature invoquée).
- Un import ne pose jamais les étiquettes de `homonymes.py#ETIQUETTES_NON_POSEES` (Bouclier, Pièce élémentaire, Amélioration, Tour, Mode Hyper, Mode Super), écrites par `equipement.py`, `divers-craft.py` et `annexes-magie.py` (R183 (11)) : un mot-clé créé plus tard ferait poser par le prochain import une étiquette qui ne l'était pas. Test : `importeurs-etiquettes.test.mjs`.

## Rejeu du journal
- Ce que le rejeu fait des balises d'un mot-clé supprimé ou fusionné : skill `zone-edition`, « Rejeu du journal ».
- Un lot d'avant la 0056 qui pose l'étiquette d'un mot-clé absent et non protégé, crée un mot-clé non protégé sans définition ou renomme un mot-clé que les règles n'ont plus est rejoué sans effet, sans conflit (`ancienneEcritureDuGlossaire`, `sansEffet` de l'adaptateur de `rejouer`) ; de même pour le mot-clé libre d'un lot d'avant la 0043 et ce qui suit sur la même ligne ou le même mot-clé. Une insertion qui suit (mot-clé recréé sous le même id, étiquette reposée) est jugée pour elle-même. Un lot d'avant la 0090 voit `cr` reciblé vers `corruption` (`FUSIONS_DE_MIGRATION` : skill `zone-edition`, « Rejeu »).

## Tests
- `mots-cles-balises.test.mjs`, `mots-cles-vivants.test.mjs`, `mots-cles-python.test.mjs`, `texte-en-place-mots-cles.test.mjs`, `importeurs-etiquettes.test.mjs`, `db-lexique-en-mots-cles.test.mjs`, `serveur-edition-rejeu-fusions.test.mjs` (R183). Le test des homonymes du Codex (`codex.test.mjs`, R145, R183) couvre aussi « sang ». Les tests du vocabulaire créent leurs mots-clés d'essai (`test/aide-mots-cles.mjs`).
- Un test qui vérifie les mots-clés protégés d'une page compare leur `libelle_cle`, jamais leur libellé.
- Page `/recherche/` et gestion du vocabulaire : skill `zone-recherche`.
