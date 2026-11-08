---
name: zone-mots-cles-service
description: "Ce que le service du site de dev écrit et refuse sur les mots-clés : clé recalculée et balises réécrites (R232), catégories, synonymes (R233), icône (R235), id suivant, fusion, verrou (R218 à R222), mentions (R196), suppression forcée (R223). À charger avant de lire, modifier ou relire serveur/edition-mots-cles.mjs, les mentions ou leurs tests."
paths: ["client/serveur/edition-mots-cles.mjs", "client/src/lib/mentions-des-mots-cles.mjs", "client/test/serveur-edition-mots-cles-{cles,fusion,icone}.test.mjs", "client/test/serveur-edition-verrou.test.mjs", "client/test/{mots-cles-r223,serveur-edition-suppression-forcee,mentions-des-mots-cles}.test.mjs", "data/migrations/0110-*"]
user-invocable: false
---
# Mots-clés : le service du site de dev

Tables, clé, balises et rendu : skill `zone-mots-cles`. La page de gestion : skill `zone-glossaire`. Le mode modification en général : skill `zone-edition`.

## Fichiers
- `serveur/edition-mots-cles.mjs` (`outilsDesMotsCles` : `recalculerLesCles`, `refusDesHomonymes`, `refuserLesSynonymes`, opérations `categories_mot_cle` et `synonymes_mot_cle`, domaine `categorie_mot_cle` ; `idSuivant`, `FILLES_DU_MOT_CLE`, `retirerLesFillesDuMotCle`, `recevoirLaFusion`).
- `serveur/edition-chronologie.mjs` : le domaine `mot_cle` (création, renommage, fusion, suppression ; `verifierNonVerrouille`, `verifierSansSort`, `vocabulaireEtFeuille`).
- `serveur/edition.mjs` : `creerMotCle`, `motCleDe`, `refuserLIcone`, `raisonDuGel`, `reecrireLesBalises`, `remplacerLesMentions`, `refusDesForcages`.
- `lib/mentions-des-mots-cles.mjs` (`mentionsDe`, `mentionsDesMotsCles`).

## À lire
- `docs/serveur.md`, « Édition des règles (site de dev) », ligne « Mots-clés » du tableau : opérations, refus et leurs `details`, verrou, suppression forcée.

## Clé, catégories, synonymes (R232, R233)
- `recalculerLesCles` refait la clé de tout le vocabulaire après chaque création, renommage, changement de catégories, suppression, fusion et renommage de catégorie. Une clé qui change est écrite, la clé quittée va dans `mot_cle_ancienne_cle` (retirée quand elle redevient courante), et chaque balise qui la cite est réécrite dans tous les textes (`textesDeLaBase`, `reciblerLaCle`), définitions verrouillées comprises (R232 (3), (11)). Tout est noté au journal.
- Une clé quittée n'est pas « prise » (R233 (11), « Le nouveau la prend ») : un mot-clé créé ou renommé sous elle la reprend, et le renvoi disparaît.
- Refus 409, avec `champ` : un homonyme sans catégorie propre face à chacun des autres (`categories`, R232 (9)) ; une clé déjà prise (`libelle`, R232 (10)) ; une clé ou un libellé qui s'écrit comme le synonyme d'un autre mot-clé (`libelle`, R233 (4), `synonymesPris`). Renommer vers le libellé d'un autre crée donc un homonyme s'il a une catégorie distinctive ; sinon refus, et la fusion se demande explicitement (`fusionner_mots_cles`).
- `categories_mot_cle` : permise sur un mot-clé verrouillé (R232 (11)). `synonymes_mot_cle` : refusée sur un verrouillé (R233 (6)) ; un synonyme mal écrit 400, pris par un autre 409 (`champ: 'synonymes'`, `mot_cle`). Les deux portent `avant` : 409 si la liste a changé entre-temps.
- `categorie_mot_cle` : création, renommage (libellé unique, 409 sinon ; recalcule les clés), suppression d'une catégorie vide seulement (409 avec `mots_cles`) (R232 (5)).
- Un mot-clé, une catégorie, un synonyme créés prennent `idSuivant` : plus grand que tout id de la table, de l'historique et du journal (pour un mot-clé, aussi de `mot_cle_ancienne_cle` et du registre 0113) ; jamais réutilisé (R232 (1)).
- Icône (R235) : hors de `lib/icones.mjs#ICONES`, 400 (`refuserLIcone`, `champ: 'icone'`) ; gelée par le verrou (409).
- `GET /api/edition/mots-cles/` rend `{ motsCles, categories, icones, css }` ; chaque mot-clé avec `verrou`, `mentions`, `refus_du_forcage`, `page_du_lien`, `titre_du_lien` (`lib/mots-cles-db.mjs#pagesDesLiens`).

## Verrou (`mot_cle.verrou`, migration 0110 ; R218 à R222)
- 1 à la migration pour les mots-clés à adresse, ceux des monnaies, ceux de `MOTS_CLES_PROTEGES` et celui d'une race, d'une magie ou d'une classe (celui dont l'adresse est sa page). Création : 0, même avec une adresse (R219 (5)), sauf `race-hybride` : 1 (R220 (2)), au rejeu aussi. Aucune route n'écrit `verrou` (R218 (4)).
- Le service refuse en 409 (`raisonDuGel`, `RAISON_DU_VERROU`) toute modification d'un verrouillé, synonymes compris, et sa suppression, même sans mention ; `verifierNonVerrouille` refuse sa fusion dans un autre. Il se pose encore sur une page, se cite, reçoit une fusion (sans reprendre l'adresse, la couleur ni l'icône de la source, ni ses synonymes : plus bas) et ses catégories changent. Le rejeu ne le contrôle pas (skill `zone-edition-rejeu`). Test : `serveur-edition-verrou`.
- R222 (1) : une définition verrouillée n'est jamais réécrite par une fusion. Une fusion dont la source est citée par une balise de la définition d'un verrouillé, celle de la cible comprise, est refusée en 409 avant toute écriture (`mots_cles_verrouilles`). Un mot sans balise ne cite pas. Le recalcul des clés, lui, réécrit ces définitions (R232 (11)).
- R221 : une page vers laquelle mène un mot-clé verrouillé ne se supprime pas (`refuserSiUnMotCleYMene`) et son adresse n'est jamais vidée (skill `zone-mots-cles-liens`).
- Une page créée par le service ne reçoit que des mots-clés protégés (`motCleDe`, par `idDuProtege`) ; « race hybride » est créé verrouillé avec la première race hybride.

## Supprimer, fusionner
- Les lignes filles d'un mot-clé (`TABLES_DES_FILLES_DU_MOT_CLE` : `mot_cle_categorie`, `mot_cle_synonyme`, `mot_cle_ancienne_cle`) sont notées au journal avant sa suppression, simple ou forcée, et avant sa fusion (`retirerLesFillesDuMotCle`), de même à la résolution d'un conflit (`edition-conflits.mjs#avantLaSuppression`) : la cascade du schéma n'écrit rien hors du journal. Elles sont dans `tablesCompletees` (`edition.mjs`) et `scripts/mise-a-jour-github.mjs#tablesDuLot`, dont la copie est comparée par `mise-a-jour-github.test.mjs`.
- Fusion (R233 (11), « tout transmettre ») : la cible garde son adresse, sa couleur et son icône et prend celles de la source qu'elle n'a pas (pas une cible verrouillée) ; elle reçoit les clés quittées de la source, puis sa clé, puis ses synonymes (`recevoirLaFusion`) ; un synonyme que R233 (4) refuse est écarté et nommé au résumé. Les catégories de la source sont retirées. Une source qui a des synonymes ne se fusionne pas dans une cible verrouillée : 409, `champ: 'synonymes'`, avant toute écriture (`edition-chronologie.mjs#fusionner`) ; sans synonyme, elle passe et ne transmet que ses clés.
- Un mot-clé qui étiquette un sort ne se supprime ni ne se fusionne (409 qui nomme les sorts : `verifierSansSort`, R114, R164 ; test `serveur-edition-chronologie`).
- R196 : il ne se supprime que si rien ne le mentionne (409 avec `mentions`). Une mention : l'étiquette d'une page (`page_tag`) et une balise qui le désigne (toute ref que `motCleDeLaRef` résout vers lui) dans un texte de la base (`textesDeLaBase`), pages d'exemple comprises. Ni le code, ni sa propre définition, ni son adresse, ni sa couleur, ni un prix « 100 RO » sans balise. La fusion reporte les mentions sur la cible. Test : `mentions-des-mots-cles`.
- R223 (amende R196 pour les non verrouillés) : `forcer: true` sur `supprimer` de `mot_cle` (`refusDuForcage`). Refus 409 avant toute écriture, dans cet ordre : verrou ; sort étiqueté ; définition verrouillée qui le cite (`mots_cles_verrouilles`) ; adresse qui mène sans ancre à une page de la base (`pageDeLAdresse`, `url` et `page` ; R223 (7)) ; mention que le site ne réécrit pas (`mentions_bloquantes`). Puis chaque balise devient son texte affiché (réponse du propriétaire : `texteQuiRemplaceLaBalise`, `remplacerParLeTexteAffiche`, `echapperDebutDeLigne` en tête de ligne) et les étiquettes sont retirées ; s'il reste une mention, 409 et lot annulé. `forcer` hors d'un mot-clé : 400. Rejeu : skill `zone-edition-rejeu`. Tests : `mots-cles-r223`, `serveur-edition-suppression-forcee`.

## Tests
- `serveur-edition-mots-cles-cles` (clé recalculée et réécrite, homonymes, verrouillé, catégories, synonymes, id suivant), `serveur-edition-mots-cles-fusion` (R233 (11)), `serveur-edition-mots-cles-icone` (R235), `serveur-edition-verrou`, `mentions-des-mots-cles`, `mots-cles-r223`, `serveur-edition-suppression-forcee`, `edition-mots-cles` (la page, skill `zone-glossaire`).
