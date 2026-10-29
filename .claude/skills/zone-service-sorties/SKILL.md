---
name: zone-service-sorties
description: "Sorties du service vers l'extérieur : POST /api/classeur/ (feuille Google Sheets téléchargée en .xlsx) et GET /api/tipeee/ (texte « Bienvenue » de Tipeee, cache, repli, instantané). À charger avant de lire, modifier ou relire serveur/classeur.mjs, serveur/tipeee.mjs, lib/tipeee.mjs ou leurs tests."
paths: ["client/serveur/classeur.mjs", "client/serveur/tipeee.mjs", "client/src/lib/tipeee.mjs", "client/test/serveur-classeur.test.mjs", "client/test/serveur-tipeee.test.mjs", "client/test/tipeee.test.mjs"]
user-invocable: false
---
# Sorties du service : classeur et Tipeee

Le reste du service (routes, base vivante, fiches) : skill `zone-service`. Détail des deux routes : `docs/serveur.md`, « Hébergement ».

## Classeur (`POST /api/classeur/`)
- `serveur/classeur.mjs`, en production comme en dev : une feuille Google Sheets partagée par lien, téléchargée en .xlsx par le service, à la demande de n'importe quel visiteur. C'est sa seule sortie vers une adresse que donne le visiteur ; en production, l'autre sortie est Tipeee ; le site de dev joint aussi l'API GitHub pour la page « Mise à jour » (`serveur/notes-de-version.mjs#creerGithub`).
- Limites : 16 Mio (`OCTETS_MAX`), 20 s (`DELAI_MS`), 2 à la fois, 30 par minute (`PAR_MINUTE`) ; `fetch` injectable (les tests ne joignent pas Google). Hôtes, redirections, rien de l'adresse noté : `docs/serveur.md`, « Hébergement ».

## Tipeee (`GET /api/tipeee/`)
- Choix du propriétaire : l'accueil reprend « La partie « Bienvenue » » de Tipeee (de « Bienvenue sur le Tipeee de MaverickJDR ! » jusqu'à la fin), « En direct par le serveur » (production et dev, cache de quelques heures, dernier texte gardé si Tipeee ne répond pas).
- `serveur/tipeee.mjs` (`creerTipeee`, un par service) → `{ paragraphes, lu_le, origine }` (`tipeee` : lu il y a moins que le cache ; `repli` : dernier texte connu ou instantané). Adresse fixe (`lib/tipeee.mjs#URL_API`), sans redirection suivie ; cache 6 h (`MAVERICK_TIPEEE_CACHE_MIN`), nouvel essai 15 min après un échec, une requête à la fois, 8 s, 512 Kio ; `MAVERICK_TIPEEE=0` : jamais joint, origine toujours `repli` ; `fetch` et horloge injectables (`demarrerService({ tipeee })`, jamais le `fetch` du classeur).
- Texte seul, jamais de HTML de Tipeee servi : `lib/tipeee.mjs#bienvenueDeTipeee` (pur ; repère sans casse ni espaces ; un `<br>` seul = `\n` dans le paragraphe).
- Dernier texte valide dans `<dossier>/tipeee.json` (format de l'instantané `{ url, lu_le, paragraphes }`, `instantaneValide`), relu au démarrage ; premier repli : l'instantané versionné `sources/tipeee/bienvenue.json` (`CHEMIN_INSTANTANE`), copié dans `_serveur/` par `serveur/livraison.mjs#FICHIERS_JOINTS` ; le plus récent des deux est servi. Échec ou repère absent : « ATTENTION Tipeee : … » au journal, évènement `tipeee` des métriques.

## Tests
- `serveur-tipeee` (réponse d'exemple, cache, appels simultanés, injoignable, repère absent, trop grosse, redémarrage, repli, route, livraison de l'instantané) et `tipeee` (extraction pure ; réponse d'exemple réduite dans `test/fixtures/tipeee-projet.json`).
- `serveur-classeur`.
