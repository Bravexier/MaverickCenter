---
name: zone-api-rest
description: "API REST /api/v1/ du site de dev (registre lib/ressources.mjs et ses 8 modules, routeur serveur/ressources.mjs, OpenAPI, 403 en production, écritures par le service d'édition seulement). À charger avant de lire, modifier ou relire ce code, ou d'ajouter une table au schéma."
paths: ["client/serveur/ressources.mjs", "client/serveur/openapi.mjs", "client/src/lib/ressources.mjs", "client/src/lib/ressources/**", "client/test/ressources-registre.test.mjs", "client/test/serveur-api-v1.test.mjs", "client/test/api-doc.test.mjs", "client/test/aide-openapi.mjs", "docs/api.md"]
user-invocable: false
---
# API REST `/api/v1/`

## Fichiers
- Registre pur : `client/src/lib/ressources.mjs` (son en-tête est le contrat du format ; `HORS_RESSOURCE`, `OPERATIONS_DU_LOT`, `capacitesDe`) et ses 8 modules `src/lib/ressources/<module>.mjs` (`creation`, `regles`, `magie`, `equipement`, `artisanat`, `univers`, `bestiaire`, `wiki`).
- Routeur générique : `client/serveur/ressources.mjs` (`TRADUCTIONS` : une requête traduite en opération du lot).
- Description OpenAPI 3.1 : `client/serveur/openapi.mjs`, servie à `/api/v1/openapi.json`. Elle décrit tout le service : une route ajoutée à `serveur/api.mjs` (et à son en-tête) y est décrite avec ses méthodes (`cheminsDuService`, test `serveur-api-v1` qui lit l'en-tête).

## À lire
- `docs/api.md` : « Principes », « Adresses », « Lire », « Écrire » (opérations du lot), « Codes de réponse », « Ressources par module », « Rendre une ressource modifiable » (la recette), « Tests ».
- `docs/serveur.md`, « API REST `/api/v1/` et page Debug (site de dev) ».

## Choix du propriétaire
- Un CRUD pour tous les éléments du jeu (demande du propriétaire).
- Site de dev seulement : en production, tout `/api/v1/` répond `403`, lectures comprises (décision du propriétaire du 2026-10-15 : la base n'est ouverte que par le front). Le `403` passe avant tout le reste (`service.edition` faux).

## Invariants
- Une ressource n'est qu'une description dans le registre (`lib/ressources/<module>.mjs`, au format de l'en-tête de `lib/ressources.mjs`). Chaque table de la base y est rangée une fois et une seule : ressource, sous-ressource, extension, dérivée ou `HORS_RESSOURCE`.
- Une table ajoutée à `data/schema.sql` : la ranger dans le registre, ou la mettre dans `HORS_RESSOURCE` avec sa raison (`test/ressources-registre.test.mjs` l'exige). Une dérivée n'a qu'un parent : une table dont les lignes viennent de deux ressources (`maitrise_arme_part`, `maitrise_arme_part_famille` : une ligne de classe ou un don, migration 0073) va dans `HORS_RESSOURCE` (`ressources/creation.mjs`) ; `capacite_nm_gagne` est une dérivée de `dons-de-classe`.
- Le tableau « Ressources par module » de `docs/api.md` suit le registre (`test/api-doc.test.mjs`) : une ressource ajoutée ou une capacité changée y est reportée.
- Le routeur lit le registre : liste paginée (`?q=`, `?tri=`, `?limite=`, `?decalage=`, filtres par colonne), détail avec `ETag`, `POST`, `PATCH` avec `If-Match`, `DELETE`.
- Jamais d'écriture hors de `serveur/edition.mjs#enregistrer` (un lot du journal, skill `zone-edition`). Ce que le service d'édition ne sait pas écrire (colonnes absentes de `TABLES`, pas d'entité dans `ENTITES`, pas d'opération du lot) est en lecture seule : `405` avec `Allow` et la raison, jamais du SQL direct (il serait perdu au rejeu).
- Pour rendre une ressource modifiable, l'apprendre au service d'édition (recette : `docs/api.md`, « Rendre une ressource modifiable ») ; le registre suit (`capacitesDe`).
- Jamais une table des sections 13 et 14 (fiches, comptes, groupes : elles passent par `/api/personnages/` ; journal de l'édition). Jamais une image entière (`ligneSansImage`).
- Le routeur n'injecte un nom de colonne dans le SQL qu'après l'avoir trouvé par `PRAGMA table_info`.
- Les adresses finissent par « / » (skill `zone-service`).

## Tests
- `ressources-registre` (chaque table rangée une fois, registre cohérent ; `RESSOURCES_MODULE=<module>` pour un seul module).
- `serveur-api-v1` (fermeture en production, catalogue, OpenAPI — chaque route de l'en-tête de `serveur/api.mjs` décrite avec sa méthode — et ses exemples via `test/aide-openapi.mjs`, listes, détail et ETag, sous-ressources, `405`, écritures par le journal, `If-Match`, R42, images).
- `api-doc` (le tableau des ressources de `docs/api.md`).
