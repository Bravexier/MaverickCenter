---
name: zone-recherche
description: "Page /recherche/ (menu Outils) : recherche mêlée au glossaire, vue d'un mot-clé (?mot-cle=<id>), index search-index.json, gestion du vocabulaire en mode modification. À charger avant de lire, modifier ou relire cette page, son script, ses modules ou leurs tests."
paths: ["client/src/pages/recherche.astro", "client/src/pages/search-index.json.ts", "client/src/scripts/recherche.mjs", "client/src/lib/search.mjs", "client/src/lib/recherche-*.mjs", "client/src/lib/recherche-index.ts", "client/src/styles/recherche/**", "client/src/scripts/edition/mots-cles.mjs", "client/src/lib/mots-cles-edition.mjs", "client/test/recherche-*.test.mjs", "client/test/search.test.mjs", "client/test/edition-mots-cles.test.mjs"]
user-invocable: false
---
# Recherche (`/recherche/`)

## Fichiers
- Page : `pages/recherche.astro`, `src/scripts/recherche.mjs`, `styles/recherche/`.
- Recherche : `lib/search.mjs` (`searchIndex`, `filtrerMotsCles`), `lib/recherche-mots-cles.mjs` (adresse `?mot-cle=`, pages et vue d'un mot-clé), `lib/recherche-index.ts`, `pages/search-index.json.ts`.
- Gestion du vocabulaire (site de dev) : extension `src/scripts/edition/mots-cles.mjs`, fonctions pures `lib/mots-cles-edition.mjs` (`operationsDuVocabulaire`) ; service : `serveur/edition-chronologie.mjs` (opérations du vocabulaire).
- Le glossaire, ses balises et ce que le service refuse sur le vocabulaire (`MOTS_CLES_PROTEGES`, mot-clé qui étiquette un sort, fusion) : skill `zone-mots-cles`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) » : adresse `/recherche/?mot-cle=<id>`, balise à copier, renommer / supprimer / fusionner.
- `docs/serveur.md`, « Édition des règles (site de dev) », ligne « Mots-clés » du tableau.

## La page
- Menu Outils ; plus de barre dans l'en-tête. Mêlée au glossaire : tous les mots-clés sans recherche, ceux qui correspondent sinon (`filtrerMotsCles`), puis les pages et les événements de la chronologie (cherchés par leur texte et le nom de leurs catégories ; ils ne portent pas d'étiquette ; une page servie par un panneau de règles est aussi cherchée dans ses blocs).
- Tous les mots-clés affichés, même sans page, chacun avec l'infobulle de sa définition et le nombre de ses pages visibles qui le portent ou le citent.
- Cliquer un mot-clé (lien `?mot-cle=<id>`, état dans l'adresse) montre libellé, définition et pages (demande du propriétaire) ; un id inconnu dit « n'existe plus ». Les pastilles des pages y mènent.
- `/tags/` mène à `/recherche/`, `/tags/<clé>/` à `/recherche/?mot-cle=<clé>` (page 404, `adresseComplete` ; plus de pages `/tags/`).
- `scripts/recherche.mjs` n'importe que `lib/recherche-mots-cles.mjs` et `lib/search.mjs` (testé) ; `recherche-mots-cles.mjs` n'importe jamais `lib/mots-cles.mjs` (qui entraîne la chaîne de l'édition).
- `loadWiki()` ne rend plus de `tags`. La vue d'un mot-clé lit le `search-index.json` construit : sur le site de dev, après une fusion ou une suppression, elle est en retard jusqu'au build suivant (les comptes viennent de la base vivante).

## Gestion du vocabulaire (site de dev, mode modification)
- Créer (avec sa définition), renommer, définir (protégés compris), fusionner (balises reciblées), supprimer (retiré des pages et de ses balises) ; la balise à copier près de chaque mot-clé.
- Les mots-clés protégés ne se renomment ni ne se suppriment sur `/recherche/` ; leur définition se modifie (« définir, protégés compris »). Leur liste et les refus du service : skill `zone-mots-cles`.
- La page et l'extension `edition/mots-cles.mjs` ne communiquent que par l'évènement `recherche:mots-cles` (`detail.gestion`) et les `li[data-id][data-cle][data-n][data-libelle]`.
- Ordre d'un lot du vocabulaire : fusions, suppressions, renommages (`operationsDuVocabulaire`).

## Tests
- `recherche-mots-cles.test.mjs`, `recherche-script.test.mjs`, `search.test.mjs`.
- `edition-mots-cles.test.mjs` : l'extension dans un faux navigateur.
