---
name: zone-mots-cles
description: "Glossaire mot_cle et balises {{ref}} (rendu par le middleware, forme canonique, db:check), outil baliser-mot-cle, importeurs, MOTS_CLES_PROTEGES et refus du service, lots d'avant 0043 et 0056. À charger avant de lire, modifier ou relire ce code ou un texte qui cite un mot-clé."
paths: ["client/src/lib/mots-cles*.mjs", "client/src/middleware.mjs", "client/src/styles/global/mots-cles.css", "client/src/scripts/edition/mots-cles-vivants.mjs", "client/src/lib/glossaire-balisage.mjs", "client/scripts/baliser-mot-cle.mjs", "tools/glossaire/**", "tools/db/homonymes.py", "client/test/mots-cles*.test.mjs", "client/test/aide-mots-cles.mjs", "client/test/*glossaire*.test.mjs", "client/test/baliser-mot-cle.test.mjs", "client/test/texte-en-place-mots-cles.test.mjs", "data/migrations/0043-*", "data/migrations/0056-*", "data/migrations/0058-*"]
user-invocable: false
---
# Mots-clés (glossaire)

## Fichiers
- Balises : `client/src/lib/mots-cles-balises.mjs` (lecture, forme canonique, rendu `htmlAvecMotsCles`, `texteSansBalises`, `avecLeursBalises`, `zonesDeCode`, `ambiguiteDe`, `formeCanonique`, `formesNonCanoniques`, `EXCLUS`, `texteEcrit`).
- Rendu sur tout le site : `src/middleware.mjs` (build et `astro dev`), CSS `styles/global/mots-cles.css`.
- Vocabulaire : `lib/mots-cles.mjs` (`MOTS_CLES_PROTEGES`), `lib/mots-cles-db.mjs` (`textesDeLaBase`).
- Site de dev : `src/scripts/edition/mots-cles-vivants.mjs` (vocabulaire vivant) ; service : `serveur/edition.mjs` (`texteAvecMotsClesCanoniques`, `motCleDe`, `reecrireLesBalises`), `serveur/edition-chronologie.mjs` (`verifierSansSort`, opérations du vocabulaire).
- Balisage d'un mot : `client/scripts/baliser-mot-cle.mjs`, `lib/glossaire-balisage.mjs`, entrées `tools/glossaire/chakra-barriere.json`, `tools/glossaire/corruption.json`.
- Importeurs : `tools/db/maverick.py` (`mot_cle`, `poser_les_mots_cles`), `tools/db/homonymes.py` (`MAGIES_HOMONYMES`), `tools/docs/codex.py --vocabulaire`.
- Page `/recherche/`, index de recherche et gestion du vocabulaire en mode modification (`src/scripts/edition/mots-cles.mjs`, `lib/mots-cles-edition.mjs`) : skill `zone-recherche`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) » : écritures, forme canonique, refus, renommer / supprimer / fusionner, ce qui n'est pas un mot-clé, « Baliser un mot dans tous les textes », « Seulement là où il est pertinent », adresse `/recherche/?mot-cle=<id>`.
- `docs/serveur.md`, « Édition des règles (site de dev) » : rejeu des balises d'un mot-clé supprimé ou fusionné, lots d'avant 0043 et 0056.
- La forme canonique est aussi à appliquer côté édition : skill `zone-edition`. La chronologie a des catégories, pas des mots-clés : skill `zone-chronologie`.

## Le glossaire (table `mot_cle`)
- Migrations `0043`, `0056` (et `0058` pour « Solidité »). Colonnes : `id` figé, `libelle`, `libelle_cle` = `normalize`, `description` (la définition).
- La définition est NULL tant qu'elle n'est pas écrite, partout (base, service, `mots-cles-db.mjs`) ; elle se lit `?? ''`.
- La 0056 n'a gardé sur les pages que `MOTS_CLES_PROTEGES` et le glossaire ; les ids des 400 mots-clés retirés peuvent resservir.
- Une page porte un mot-clé par `page_tag.tag_id` (`ON DELETE CASCADE`) ; un sort, en étiquette, par `sort_mot_cle` (migration 0067, sans cascade : R114).
- Les événements de la chronologie n'ont pas d'étiquette mais des catégories (`categorie_chronologie`).
- Un mot-clé renommé garde son id (et ses adresses `?mot-cle=<id>`).
- Une capacité, un état ou un type homonyme reste ce qu'il est : aucun lien implicite. Seule une balise fait un mot-clé.

## Balises
- Marquage explicite seulement, jamais de repérage automatique (demande du propriétaire). `{{ref}}`, `{{ref|texte}}` (gras, définition en infobulle), `{{ref:}}` (= `{{ref :}}`, mode complet « **Libellé** : définition »). Dans une case de tableau Markdown, `\|`.
- Dans une saisie, `ref` = id ou écriture du mot-clé, quelle que soit la casse ; la casse écrite est gardée (`{{solidité}}` → `{{solidite|solidité}}`, `texteEcrit` ; demande du propriétaire).
- La base ne garde que des ids, sous la forme canonique de la colonne (`typeDeTexte`, `CHAMPS_DE_TEXTE` de `lib/edition-modele.mjs`, la seule liste des types de champ texte) :
  - texte mis en forme (Markdown : pages, chronologie, panneaux) : `{{id}}` (suit le libellé ; le libellé écrit en texte y revient), `{{id|texte}}` pour un autre texte, `{{id:}}` ; une balise dans un code (`zonesDeCode`) est gardée telle quelle ;
  - texte de case (`ligne`, `texte`) : `{{id|texte}}` toujours (il se lit sans le vocabulaire) ; le mode complet est refusé.
- Le service enregistre la forme canonique (`texteAvecMotsClesCanoniques`, avant les dérivations et le journal). Il refuse une ref inconnue ou ambiguë (l'id d'un mot-clé et l'écriture d'un autre : `ambiguiteDe`), sauf si elle était déjà présente avant, et le mode complet dans un texte de case.
- Supprimer retire les balises, fusionner les recible, dans les colonnes texte de `TABLES`, par le chemin normal d'une modification (`reecrireLesBalises`). Renommer ne réécrit aucun texte.
- Un emplacement `{N}` n'est jamais `{{N}}`. Les monnaies ne lisent rien dans une balise.

## Rendu (middleware)
- Rendues dans les nœuds de texte, une bulle par mot-clé et par page. Jamais dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous `[data-mots-cles-bruts]` (`/donnees/`, textes d'aide, dialogues et zone d'annonce du mode modification, page Debug), ni dans leurs attributs. La liste `EXCLUS` est la même dans `mots-cles-vivants.mjs`.
- Dans une `.bulle` : le gras seul. Dans un élément focalisable (a, button, summary, label, select, `[tabindex]`) : sans `tabindex`. Dans un bouton ou un résumé : sans bulle.
- Texte simple dans `<title>`, `<option>` et les attributs de texte (`data-*` JSON compris, sauf `data-balise` et `data-ed…`) ; une entité inconnue n'est pas échappée deux fois.
- L'id `mot-cle-<id>` est réservé aux bulles (posées en fin de page, jamais à la main : skill `ui-infobulles`).
- Un JSON servi retire lui-même les balises (`texteSansBalises` : `regles.json` sans les définitions, index de recherche).
- Un découpage lit le texte sans balises ; un affichage morceau par morceau les garde (`avecLeursBalises` : bonus et objets d'un métier, inventaire d'une classe, lieux d'une espèce).
- Site de dev : `mots-cles-vivants.mjs` refait les bulles et rend les balises du HTML posé après le chargement.

## Invariants
- `db:check` refuse une ref qui n'est pas un id et une forme non canonique (la règle de `formeCanonique`, sauf `{{id|Libellé}}` dans un texte mis en forme), dans toutes les colonnes de texte des règles et des pages (`lib/mots-cles-db.mjs#textesDeLaBase`, `formesNonCanoniques`) ; ni les sections 13 à 15, ni les tables dérivées `lien` et `lien_candidat`, ni les traces gardées telles quelles (`lib/tables-de-la-base.mjs`).
- Aucun script de page n'importe `mots-cles-balises.mjs` (il entraîne `text.mjs`).
- Les lectures du sens d'une modification (R29, `lib/notes-de-version-sens.mjs`) lisent les cases sans balises.
- Un test qui compare un texte « tel qu'écrit » à une sortie qui retire les balises (fiche, `regles.json`, découpages, site construit) lit ce texte sans elles (`texteSansBalises`) ou rend ses balises comme le middleware (`htmlAvecMotsCles`).
- Les tests du vocabulaire créent leurs mots-clés d'essai (`test/aide-mots-cles.mjs`).

## Vocabulaire : ce que le service refuse
- `MOTS_CLES_PROTEGES` : ceux dont le site se sert pour ranger ses pages (catégories de `/classes/`, « classe », « race », « race hybride », « capacité de classe », « métier », « codex ») et « Sort grenade », que la fiche lit (R114). Ils ne se suppriment ni ne changent de clé (`409` avec la raison) ; leur définition se modifie. Sur `/recherche/` : skill `zone-recherche`.
- Un mot-clé qui étiquette un sort ne se supprime ni ne se fusionne, dans un sens ou l'autre (`409` qui nomme les sorts : `serveur/edition-chronologie.mjs#verifierSansSort`).
- Un renommage vers une écriture déjà prise est une fusion explicite (`fusionner_mots_cles`).

## Importeurs
- Le `tags:` d'une page s'écrit par libellé : `tools/db/maverick.py#mot_cle` et `serveur/edition.mjs#motCleDe` retrouvent le mot-clé par son écriture.
- Un import ne crée jamais de mot-clé : une écriture inconnue n'est pas posée, `db:sync-pages` la signale ; `codex.py --vocabulaire`.
- Le service ne pose sur une page qu'il crée que des mots-clés protégés (une fiche de don : « capacité de classe » seul).
- Le site de dev est la source du vocabulaire (`historique_modification`) : une écriture qu'un mot-clé a quittée mène à lui (renommé) ou au mot-clé qui l'a reçu (fusionné) ; celle d'un mot-clé supprimé n'est pas reposée (`poser_les_mots_cles`, `test/mots-cles-python.test.mjs`).
- Un homonyme n'est jamais posé par un import (`tools/db/homonymes.py#MAGIES_HOMONYMES` : la magie « corruption » d'un temple du Codex, d'une page de magie, d'une créature invoquée).

## Baliser un mot dans tous les textes
- Chakra et Barrière, puis seulement là où il est pertinent : Corruption et « CR » (R103) (demandes du propriétaire). Entrées `tools/glossaire/chakra-barriere.json`, `tools/glossaire/corruption.json`.
- `client/scripts/baliser-mot-cle.mjs` passe par le service du site de dev ; le journal est rapatrié (`historique_modification` : l'import reste lisible).
- Les balises déjà posées du mot sont relues, celles posées à la main comprises : retirées puis reposées (`sansLesBalisesDuMot`). Un second passage avec d'autres exclusions retire celles qui ne sont plus pertinentes. Le rapport liste chaque balise retirée ou nouvelle, et ce que l'entrée écrit pour rien.
- Jamais balisé : un nom de la base, une écriture ou un contexte exclu de l'entrée (nom propre du Codex, autre sens du mot : l'énergie du monde, la magie de la Corruption, son élément), un texte hors du balisage (`horsDe` : le récit du Codex et de la chronologie, sauf le glossaire du Codex et, au cas par cas, une page qui écrit la règle : `sauf`), un code, un lien, une adresse, un titre de section, un intitulé en gras seul sur sa ligne, une rubrique de carte découpée.
- Détail (mots collés, liste des textes non touchés) : `docs/content-guide.md`, « Baliser un mot dans tous les textes ».

## Rejeu du journal
- Ce que le rejeu fait des balises d'un mot-clé supprimé ou fusionné (textes réécrits, colonnes dérivées, tables écrites au-delà du journal) : skill `zone-edition`, « Rejeu du journal ».
- Un lot d'avant la 0056 qui pose l'étiquette d'un mot-clé absent et non protégé, crée un mot-clé non protégé sans définition ou renomme un mot-clé que les règles n'ont plus est rejoué sans effet (`ancienneEcritureDuGlossaire`, `sansEffet` de l'adaptateur de `rejouer`), sans mettre son lot en conflit. De même pour le mot-clé libre d'un lot d'avant la 0043 et ce qui suit sur la même ligne ou le même mot-clé. Une insertion qui suit (mot-clé recréé sous le même id, étiquette reposée) est jugée pour elle-même.

## Tests
- `mots-cles-balises.test.mjs`, `mots-cles-vivants.test.mjs`, `mots-cles-python.test.mjs`, `glossaire-balisage.test.mjs`, `baliser-mot-cle.test.mjs`, `texte-en-place-mots-cles.test.mjs`.
- Page `/recherche/` et gestion du vocabulaire : skill `zone-recherche`.
- Aide : `test/aide-mots-cles.mjs`.
