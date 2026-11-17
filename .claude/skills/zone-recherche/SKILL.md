---
name: zone-recherche
description: "Page /recherche/ (menu Outils) : recherche mêlée au glossaire, vue d'un mot-clé (?mot-cle=<clé>), index search-index.json. À charger avant de lire, modifier ou relire cette page, son script, ses modules ou leurs tests."
paths: ["client/src/pages/recherche.astro", "client/src/pages/search-index.json.ts", "client/src/scripts/recherche.mjs", "client/src/lib/search.mjs", "client/src/lib/recherche-*.mjs", "client/src/lib/recherche-index.ts", "client/src/styles/recherche/**", "client/test/recherche-*.test.mjs", "client/test/search.test.mjs"]
user-invocable: false
---
# Recherche (`/recherche/`)

## Fichiers
- Page : `pages/recherche.astro`, `src/scripts/recherche.mjs`, `styles/recherche/`.
- Recherche : `lib/search.mjs` (`searchIndex`, `filtrerMotsCles`, `cleDeRecherche`), `lib/recherche-mots-cles.mjs` (adresse `?mot-cle=`, `idDeLaCle`, pages et vue d'un mot-clé), `lib/recherche-index.ts`, `pages/search-index.json.ts`.
- Le glossaire et ses balises : skill `zone-mots-cles` ; ce que le service refuse sur le vocabulaire : skill `zone-mots-cles-service`. La page Glossaire et la gestion du vocabulaire : skill `zone-glossaire`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) », paragraphe « Le Glossaire » : adresse `/recherche/?mot-cle=<clé>`, pastilles, vue d'un mot-clé.

## La page
- Menu Outils ; plus de barre dans l'en-tête. Mêlée au glossaire : tous les mots-clés sans recherche, ceux dont le libellé ou un synonyme correspond sinon (R233 (1) ; `filtrerMotsCles` sur `search.mjs#cleDeRecherche`, jamais la clé : les catégories d'un homonyme ne sont pas son nom), puis les pages et les événements de la chronologie (cherchés par leur texte et le nom de leurs catégories ; ils ne portent pas d'étiquette ; une page servie par un panneau de règles est aussi cherchée dans ses blocs).
- Tous les mots-clés affichés, même sans page, chacun avec l'infobulle de sa définition et le nombre de ses pages visibles qui le portent ou le citent. La pastille est `mots-cles-balises.mjs#htmlDeLaPastille` : le libellé seul, « Libellé · n » (R233 (9)) ; un mot-clé qui a une icône (R235, les monnaies) : le libellé suivi de son icône (`htmlDuNomDuMotCle` ; R63, « Libellé + icône »).
- Les pastilles (ici et au pied d'une page) mènent toujours à la liste des pages du mot-clé, `?mot-cle=<clé>` (R232 (3)), jamais à son adresse (Q12). Une clé quittée y mène encore (`idDeLaCle`, `data-anciennes-cles`) ; un renommage casse les adresses partagées, c'est voulu (R232 (3)).
- Chaque `li` de la liste porte `data-id` (l'id entier), `data-cle`, `data-synonymes` et `data-anciennes-cles` (JSON, absents sans valeur).
- Cliquer un mot-clé (état dans l'adresse) montre libellé, définition et pages (demande du propriétaire). La vue reprend le `.recherche-nom` de la pastille et recopie le `[data-definition-de=<id>]` de `#definitions-des-mots-cles`, rendu au build (monnaies en icônes) ; une clé inconnue dit « n'existe plus ». Les pastilles des pages y mènent.
- `/tags/` mène à `/recherche/`, `/tags/<clé>/` à `/recherche/?mot-cle=<clé>` (page 404, `adresseComplete` ; plus de pages `/tags/`).
- Sans mode modification : la liste est rendue au build et lue une fois, aucun script ne la redessine.
- `scripts/recherche.mjs` n'importe que `lib/recherche-mots-cles.mjs` et `lib/search.mjs` (testé) et ne lit aucune monnaie ; `recherche-mots-cles.mjs` n'importe que `./search.mjs` (jamais `lib/mots-cles.mjs`, qui entraîne la chaîne de l'édition).
- `loadWiki()` ne rend plus de `tags`. La vue d'un mot-clé lit le `search-index.json` construit : sur le site de dev, après une fusion ou une suppression, elle est en retard jusqu'au build suivant.

## Tests
- `recherche-mots-cles.test.mjs`, `recherche-script.test.mjs`, `search.test.mjs` ; `glossaire-html.test.mjs` vérifie que `/recherche/` ne gère plus le vocabulaire.
