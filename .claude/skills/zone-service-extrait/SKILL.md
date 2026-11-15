---
name: zone-service-extrait
description: "Extrait du contenu du site de dev (GET /api/edition/extrait/, npm run db:extrait), attestation de la production, empreintes, historiser, fabrication du site depuis un fichier de contenu (MAVERICK_CONTENU), comparaison de sites. À charger avant de lire, modifier ou relire ces modules."
paths: ["client/serveur/extrait.mjs", "client/serveur/attestation.mjs", "client/serveur/empreintes.mjs", "client/serveur/historique.mjs", "client/scripts/db-extrait.mjs", "client/test/serveur-extrait.test.mjs", "client/test/serveur-attestation.test.mjs", "client/test/db-extrait.test.mjs", "client/test/aide-fiches-sentinelles.mjs", "client/serveur/fichier-de-contenu.mjs", "client/serveur/fabrication-depuis-contenu.mjs", "client/serveur/comparaison-de-sites.mjs", "client/src/lib/contenu-fourni.mjs", "client/scripts/fabriquer-depuis-contenu.mjs", "client/scripts/comparer-sites.mjs", "client/scripts/mesure-memoire.mjs", "client/test/contenu-fourni.test.mjs", "client/test/fabrication-depuis-contenu.test.mjs", "client/test/comparaison-de-sites.test.mjs", "client/test/aide-contenu-fourni.mjs"]
user-invocable: false
---
# Extrait du contenu et attestation de la production

## Fichiers
- `serveur/extrait.mjs` (fabrique l'extrait, `cleDeChangement`), `serveur/attestation.mjs` (écriture par la production, `etatDeLaProduction` pour le site de dev), `serveur/empreintes.mjs` (le calcul commun aux deux et au client ; `empreinteLogique`, celle que la reconstruction de la base vivante compare : skill `zone-service`), `serveur/historique.mjs` (`historiser`, partagé avec `scripts/db-appliquer-edition.mjs` : `scripts/` n'est pas livré).
- `scripts/db-extrait.mjs` (`npm run db:extrait`) : le client que les sessions de Claude lancent (skill `interroger-la-base`).
- Fabrication depuis un extrait : `src/lib/contenu-fourni.mjs` (`MAVERICK_CONTENU`), `serveur/fichier-de-contenu.mjs` (le contrôle du fichier), `serveur/fabrication-depuis-contenu.mjs` (les étapes), `serveur/comparaison-de-sites.mjs` ; leurs lignes de commande dans `scripts/` : `fabriquer-depuis-contenu.mjs`, `comparer-sites.mjs`, `mesure-memoire.mjs`.
- Le service y branche l'option `attestation` de `demarrerService`, `service.extrait` (null hors site de dev) et `service.attestations` (le dossier lu par la page « Mise à jour » : skill `zone-mise-a-jour`).

## À lire
- `docs/serveur.md`, « Extrait du contenu et attestation de la production » (classes de tables, empreintes, contenu du méta, état de la production) ; « Fabriquer le site depuis un fichier de contenu » (étapes, mesure, kit).

## Invariants
- Aucune donnée de joueur ne sort : ni fiche, ni compte, ni groupe, ni journal, ni auteur d'une modification. Ce que `classeDeLaTable` (`lib/tables-de-la-base.mjs`) range « propre au site » ou ne connaît pas est vide dans l'extrait.
- `GET /api/edition/extrait/` et `/meta/` : 403 en production, avant tout. La route rend une promesse (comme `classeur` et `tipeee`, skill `zone-service`).
- Accès (R275, skill `zone-service`) : `GET /api/edition/extrait/` et `/meta/` sont classés en lecture (clé ou mot de passe, `acces-routes.mjs`). `scripts/db-extrait.mjs` envoie la clé dans `X-Maverick-Cle`, jamais en `Authorization` (Caddy et nginx l'effacent).
- L'extrait est un fichier neuf (jamais la base vivante copiée puis vidée), fabriqué dans un Worker, un seul à la fois, puis posé par rename (`extrait.json` en dernier : il fait foi). Un contrôle refuse le fichier si une table propre au site a une ligne.
- Les tables calculées sont recopiées telles que la base vivante les porte (elles peuvent retarder sur une édition ; le contenu, jamais).
- Les modifications du journal en attente sont versées dans `historique_modification`, version NULL (sinon un test prendrait une saisie récente pour le texte d'origine).
- Nature des traces (R275, migration 0127 : skill `base-sqlite-migrations`) : `historiser` et la copie des lots dans `extrait.mjs` reportent `nature` et `decision` de chaque lot (le schéma de l'extrait est celui de la base vivante, toujours courant).
- L'extrait n'est refait que si `cleDeChangement` bouge : elle lit l'état de la base vivante (`vivante.json.logique`, à défaut `regles`), `modification`, `modification_lot` et les comptes de l'historique et des notes, jamais une fiche. Toute voie qui écrit du contenu hors journal passe par le journal ou fait bouger la clé.
- L'attestation est écrite par la production seule (`attestation.publier`, vrai sans l'édition), par rename, dans `<dossier des métriques>/attestation-prod.json` (le dossier que les deux instances se partagent : rien dans `deploy/`), au démarrage et après chaque préparation de la base vivante. Elle ne porte que des nombres, des empreintes et des identifiants de règles (le nombre de fiches qui citent chacun), jamais le texte d'un problème. Son échec n'empêche jamais le démarrage : journal et évènement.
- Fabrication depuis un fichier de contenu (le build par défaut, sans variable, est inchangé) :
  - le fichier fourni n'est jamais modifié (tout se lit sur une copie) ; un fichier introuvable est une erreur, jamais un repli sur `data/rows`.
  - il garde vides les tables propres au site : c'est leur contenu qui est refusé, pas leur présence ; le message nomme la table, jamais une valeur. Son `user_version` égale celui du `data/schema.sql` du kit.
  - par défaut, deux temps : l'étape `derive` tourne dans son propre processus, puis Astro construit ; `--en-un-temps` garde l'ancien chemin. `MAVERICK_CONTENU_DERIVE` est une convention interne entre `fabrication-depuis-contenu.mjs` et `donnees.mjs#ouvrirBase` (copie telle quelle, pour la variante nommée seulement), pas un réglage extérieur.
  - la comparaison ne classe en « variable » que `donnees/maverick.db` (contenu, tables calculées et tables propres au site égaux) ; `donnees/reference.*` y est absent sans git, et c'est attendu.
  - la mémoire d'un processus enfant lancé par un gros processus est surestimée : le `fork` lui fait reprendre la taille de son parent (d'où les deux temps pour mesurer).
- Consommateurs de l'extrait : `db:extrait` et la fabrication depuis un fichier de contenu, et l'atelier du site de dev, qui en tient un à jour (`serveur/atelier.mjs`, skill `zone-service` ; l'atelier, skill `zone-hebergement-atelier`). Aucune donnée de joueur n'y entre : mêmes garanties.
- Évènements de métriques `extrait` et `attestation` : skill `zone-debug-metriques`.

## Tests
- `serveur-extrait`, `serveur-attestation`, `db-extrait`. Pour prouver qu'aucune donnée de joueur ne sort : `test/aide-fiches-sentinelles.mjs` (skill `tests-conventions`).
- `contenu-fourni`, `fabrication-depuis-contenu`, `comparaison-de-sites`, avec l'aide `aide-contenu-fourni.mjs` (skill `tests-conventions`).
- `mise-a-jour-etat-production` : skill `zone-mise-a-jour`.
