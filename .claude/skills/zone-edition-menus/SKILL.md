---
name: zone-edition-menus
description: "Mode modification des menus latéraux (Règles, races) et des pages des Règles : ordre par glisser-déposer, onglet d'une page, création et suppression, pages protégées ou citées, plan vivant /api/edition/plan/. À charger avant de lire, modifier ou relire ce code ou ses tests."
paths: ["client/serveur/edition-plan.mjs", "client/src/scripts/edition/menus.mjs", "client/src/scripts/edition/glisser.mjs", "client/src/lib/ordre-des-menus.mjs", "client/src/lib/pages-protegees.mjs", "client/src/lib/citations-db.mjs", "client/test/ordre-des-menus.test.mjs", "client/test/serveur-edition-plan.test.mjs", "client/test/serveur-edition-pages-regles.test.mjs", "client/test/pages-protegees.test.mjs", "client/test/citations-db.test.mjs", "client/test/db-pages-du-site.test.mjs"]
user-invocable: false
---
# Menus latéraux et pages des Règles (mode modification)

## Fichiers
- Service : `serveur/edition-plan.mjs` (`domainesDuPlan` : opération `ordonner`, domaine de `regles_onglet_entree`, création et suppression d'une page des Règles ; `planVivant`, route `GET /api/edition/plan/`). Les outils communs (`refus`, `creerPage`, `supprimerPage`) lui sont donnés par `serveur/edition.mjs`, sans import en retour.
- Page : extension `menus` (`src/scripts/edition/menus.mjs`), geste `glisser.mjs`, logique pure `lib/ordre-des-menus.mjs`.
- Protection `lib/pages-protegees.mjs`, citations `lib/citations-db.mjs` (sur `lib/wikilinks-resolution.mjs`, sans `yaml`, que le service n'a pas).
- Attributs `data-ed-*` du menu : skill `zone-guide`. Ordre des races : skill `zone-races`. Le reste de l'édition : skill `zone-edition`.

## À lire
- `docs/serveur.md`, « Édition des règles (site de dev) » (ligne « Plan des Règles et liste des races », route `/api/edition/plan/`) ; `docs/api.md` (action `ordre`, `pages-du-guide/`).

## Choix du propriétaire
- Ordre des menus par glisser-déposer : les 4 onglets des Règles, l'Artisanat et les races ; entrées « bientôt » déplaçables ; ordre des onglets fixe.
- Pages des Règles ajoutées et supprimées (Guide du MJ, Découvrir et pages typées hors périmètre). Création : titre, onglet, résumé, tous obligatoires, texte écrit ensuite en place, aucune source ; adresse `/regles/<slug>/` tirée du titre et figée ; page en fin de menu. Une entrée « bientôt » se remplit (son libellé pour titre). L'onglet d'une page se change par une liste, l'adresse reste.
- Suppression : refusée tant qu'une page la cite (le service donne la liste), puis son adresse donne la 404 ; pas de table des renvois. Aucun bouton « Supprimer » sur une page protégée (`boutonSupprimer`, décision du leader-technique) ; une page seulement citée garde le bouton, et le refus 409 liste les textes qui la citent.
- Un titre modifié change le libellé de son entrée de menu (« Changer le titre avec l'édition devrai aussi changer le nom sur le menu lattéral »).

## Invariants
- `ordonner` : la liste exacte des ids de l'onglet, sinon 409 ; pour les races, un groupe (pures ou hybrides) dont les rangs sont redonnés. `rang` n'est jamais unique (l'id départage) ; seules les lignes dont le rang change vont au journal.
- Changer d'onglet (`modifier` de `regles_onglet_entree.onglet_id`) : la page passe en fin du menu cible ; refus avant écriture pour une page d'ouverture, un lien, une entrée « bientôt ».
- Création : famille `docs` (`FAMILLE_DES_PAGES_DU_SITE`, d'accord en JS et en Python, skill `modifier-une-page-wiki`), statut `draft`, corps « À compléter. ». Titre déjà pris : 409. Identifiant pris (page, historique, page supprimée, absorbée ou retirée, nom réservé, id d'onglet) : suffixe `-2`, `-3`. Remplir une entrée « bientôt » : dans le même lot, retrait de `bientot:…` et insertion de `page:<id>` au même onglet et rang.
- Suppression, refus avant écriture : 404 inconnue, 400 hors des Règles, 409 protégée (`details.raisons`), 409 citée (`details.citations`). La citation d'une page d'exemple ne bloque pas. L'entrée de menu part d'abord, puis `supprimerPage`, qui refuse seule une page protégée.
- Protection : `lib/pages-protegees.mjs` est la seule source (service, route, bouton). `PAGES_LUES_PAR_LE_CODE` est une liste à tenir : toute page `guide/…` que le code lit y entre (garde-fou de `test/pages-protegees.test.mjs`) ; elle compte `guide/le-mode-hyper`, où les pages des magies et des races renvoient (R187). Les ids d'entités `guide/postures#posture:…` et `guide/liste-des-effets-mode-hyper#texte:…` ne sont pas des pages pour ce garde-fou. Un id de `PAGES_SUPPRIMEES` reste réservé à la création (`serveur/edition-plan.mjs#idPris`). La cible d'un renvoi figé d'ancienne adresse n'est pas protégée (skill `zone-guide`).
- Citations lues dans les textes de la base (liens `[[…]]`, `/regles/<slug>/`, `guide/<slug>`, `evenement_extrait`, balise d'un mot-clé qui mène à la page : `balise`) et le mot-clé lui-même dont l'adresse y mène (`mot-cle`, migration 0098 : skill `zone-mots-cles-liens`), jamais dans la table `lien`, périmée sur le site de dev.
- Geste : Pointer Events, pas de glisser-déposer HTML5 (il ne marche pas au toucher). On déplace les voisins, jamais l'élément glissé (`lib/ordre-des-menus.mjs#voisinsADeplacer` : un élément sorti du DOM perd la capture du pointeur) ; le pointeur est suivi sur `document`, sans `lostpointercapture`. Le clavier (↑ ↓ Début Fin) passe par le même `placer`. Place annoncée (aria-live) ; une race reste dans son groupe.
- `refus(ed, e)`, point d'entrée d'une extension (`extensions.mjs`) : un nœud DOM que l'annonce montre à la place du message (les pages qui citent, en liens).
- Avant la reconstruction : une page supprimée mais encore construite affiche un avis avec un lien vers son onglet (`pageSupprimeeEnAttente`) ; `/races/` (pastilles et tableau des magies innées) suit `plan.races` dans la surcouche (`raceDuLien`, `ordonnerSelon`), l'extension `menus` y est donc active aussi. Une page créée sans aperçu s'édite en place (`lib/markdown-edition.mjs#etatDeLApercu`).
- Le résumé se pose sous le titre (`edition/guide.mjs#poserLeResume`) ; `page.resume` n'est modifiable que pour une page du guide.
- La page d'une Règle créée est dessinée sur la 404 (`edition/nouvelles.mjs`) tant que le site n'est pas reconstruit ; le plan vivant redessine les menus.

## Tests
- `ordre-des-menus`, `serveur-edition-plan`, `serveur-edition-pages-regles`, `pages-protegees`, `citations-db`, `db-pages-du-site` (une page créée sur le site passe `db:sync-pages`), `edition-tous-ecrans`.
