---
name: zone-mots-cles-liens
description: "Liens et couleurs des mots-clés (migration 0096) : mot_cle.url et mot_cle.couleur, liens [[…]] et Markdown convertis en balises, adresses permises, refus du service, fusion, db:check, couleur de la page où mène un mot-clé. À charger avant de lire, modifier ou relire ce code, la migration ou leurs tests."
paths: ["client/src/lib/mots-cles-liens.mjs", "client/src/lib/liens-en-mots-cles.mjs", "client/src/lib/adresses-db.mjs", "client/src/lib/couleur-de-la-page.mjs", "client/scripts/liens-en-mots-cles.mjs", "data/migrations/0096-*", "client/test/db-liens-en-mots-cles.test.mjs", "client/test/mots-cles-liens.test.mjs", "client/test/adresses-db.test.mjs", "client/test/serveur-edition-mots-cles-liens.test.mjs", "client/test/serveur-edition-rejeu-liens.test.mjs", "client/test/fixtures/lots-avant-0096.json"]
user-invocable: false
---
# Liens et couleurs des mots-clés

## Fichiers
- `lib/mots-cles-liens.mjs` : forme d'une adresse, lecture et classe d'une couleur, mot-clé d'une page, mots-clés d'une adresse, `LIENS_GARDES`, `REGISTRE_DES_LIENS`. Sans aucun import : un script de page peut l'importer.
- `lib/adresses-db.mjs` : `adressesDuSite` (où une adresse peut mener), `pageDeLAdresse` (la page où elle mène), `ADRESSES_FIXES`.
- `lib/liens-en-mots-cles.mjs#convertirLesLiens`, son générateur `scripts/liens-en-mots-cles.mjs` et le registre `data/migrations/0096-liens-en-mots-cles.json`.
- `lib/couleur-de-la-page.mjs` : la couleur d'une page et la feuille des mots-clés colorés.
- Rendu d'une balise à adresse ou colorée : skill `zone-mots-cles`. Saisie du lien et de la couleur sur le Glossaire : skill `zone-glossaire`. Fonctions de la palette (`fauteDeLaCouleur`, `cssDesMotsCles`) : skill `ui-couleurs`.

## À lire
- `docs/content-guide.md`, « Liens entre pages » et la puce « Les couleurs des mots-clés » de « Couleurs du site : la palette en classes ».
- `docs/serveur.md`, « Édition des règles (site de dev) » : liens saisis, rejeu d'un lot d'avant la 0096.

## Choix du propriétaire
- « tous les liens deviendront des mots-clés et tous les mots-clés deviendront des liens » : un lien est la balise d'un mot-clé qui a une adresse.
- `mot_cle.couleur` et `mot_cle.url`, NULL par défaut ; « URL interne seulement » : relative à la racine du site, sans `SITE_BASE`.
- Les `[[…]]` et les liens Markdown internes `[texte](/…)` sont convertis (Q1). Sans adresse, un mot-clé n'est pas cliquable (Q2) ; avec, il est en gras et cliquable, même sans définition (Q11).
- Couleur (Q3, Q4) : une référence `famille:id` d'une couleur de la palette, qui suit le site, toutes familles comprises, ou `#rrggbb` (le cercle).
- La page vers laquelle mène un mot-clé coloré prend sa couleur (Q5) : le mot-clé coloré dont l'adresse y mène, ancre ignorée, le premier par libellé ; « il ne faut pas de changement par rapport à avant en terme de résultat ». Un mot-clé par page colorée (Q8), qui reprend la couleur de sa page (classes et races comprises, Q9).
- « La couleur inclue la tuile (quand on a la définition complète {{X:}} ) et l'habillage de l'infobulle » (Q13).
- Les routes du menu ont leur mot-clé, au libellé du menu ; le lien Discord de l'accueil reste un lien (Q10 : `LIENS_GARDES`, `/#lien-discord`).
- Homonymes race et classe : « La race garde le nom », la classe s'écrit « <Titre> (classe) » (Q14). Collision avec un mot-clé existant : « Le mot-clé existant prend l'URL » (id et définition gardés) ; la liste des mots-clés repris est `MOTS_CLES_EXISTANTS_REPRIS` du générateur, jamais recopiée ici.

## Choix du leader-technique
- Fusion : la cible garde son adresse et sa couleur, et prend celles de la source qu'elle n'a pas (modification notée au journal, le résumé dit ce qu'elle garde).
- Mots-clés protégés : adresse et couleur modifiables.
- L'existence de l'adresse se vérifie au service (base vivante) et par `db:check` ; l'ancre et la requête ne sont pas vérifiées.
- Supprimer une page qu'un mot-clé vise est refusé (409 : citations `mot-cle` et `balise` de `lib/citations-db.mjs`, skill `zone-edition-menus`).
- Un lien saisi est converti si un seul mot-clé mène à sa cible, sinon refusé (400).
- Les pages d'exemple gardent leurs `[[…]]`.
- `npm run autolink` reste un outil d'aperçu relu ; il exclut `lore` et `metiers` (skill `site-wiki-liens`). `codex.py` ne pose jamais le mot-clé d'une page en étiquette (skill `sources-codex`).
- Routes fixes admises (`ADRESSES_FIXES`) : les routes publiques, jamais Debug, Maintenance ni Mise à jour.

## Invariants
- Adresse (CHECK de `mot_cle.url`, `fauteDeLUrl`) : `/` au début, jamais `//`, ASCII imprimable sans espace ni `\`, avec la barre finale du site ; son chemin, sans ancre ni requête, est dans `adressesDuSite` : une page qui n'est pas d'exemple (`cheminDePage` : un métier mène à `/metiers/#metier-<slug>`), une rubrique (`type_page`), une route de `ADRESSES_FIXES` (comparée à `src/pages` par `adresses-db.test.mjs`).
- Couleur : `#rrggbb` en minuscules (le modèle d'édition les abaisse) ou une référence que la palette connaît. Classe (`classeDuMotCle`) : celle de la palette, ou `couleur-mot-cle-<id>` pour une couleur écrite.
- Refus du service (`serveur/edition.mjs#refuserLeLien`, `#refuserLaCouleur`) : 400 `{ champ: 'url' | 'couleur' }`, jamais 409 ; une valeur inchangée n'est pas contrôlée.
- Lien saisi (`serveur/edition.mjs#texteSansLiens`, avant la forme canonique) : un `[[…]]` ou `[texte](/…)` ajouté à un texte de `CHAMPS_DE_TEXTE`, hors code, devient la balise du seul mot-clé qui mène à sa cible (`motsClesDeLAdresse` : même adresse, requête ignorée ; sinon même chemin sans ancre) ; aucun, plusieurs, une cible introuvable, un texte qu'une balise n'écrit pas : 400 `{ champ, liens }`, qui renvoie au Glossaire. Un lien externe, un lien déjà présent, `LIENS_GARDES` et une page d'exemple passent.
- Conversion (`convertirLesLiens`) : `{{id}}` quand le texte affiché est le libellé, `{{id|texte}}` sinon (`\|` sur une ligne de tableau) ; `{{id|texte}}` toujours dans un texte de case ; un lien dans un code reste.
- `db:check` : adresse et couleur de chaque mot-clé ; aucun `[[…]]` ni lien Markdown interne hors code dans `textesDeLaBase`, sauf pages d'exemple et `LIENS_GARDES`.
- Un import ne crée jamais de mot-clé : une page sans mot-clé qui y mène ne se lie pas (renvoi du Codex en texte simple signalé, page sans cible pour le maillage).
- Couleur de la page (`classeDeLaPage`, repli : la couleur d'avant) : les gabarits des magies, classes, races et du guide la posent à la place de la leur (`couleurPropre` de `layouts/Base.astro`) ; toute autre page la reçoit sur `<main class="page-coloree …">`, seulement quand un mot-clé coloré y mène. Les tuiles des listes, la carte de `/magies/`, les puces et les tableaux gardent leurs couleurs.
- Feuille des mots-clés colorés (`cssDesMotsClesDuSite`, `<style data-couleurs-mots-cles>` de `Base.astro`, sur chaque page) : couleurs écrites et familles d'une zone qu'un mot-clé nomme, sous 1,5 ko (`palette-css.test.mjs`) ; le site de dev la remplace par le `css` de `GET /api/edition/mots-cles/` (`mots-cles-vivants.mjs`).
- Le registre de la 0096 sert au rejeu d'un lot d'avant (`ancienneEcritureDesLiens` : skill `zone-edition`) ; il est livré avec le service (`FICHIERS_JOINTS` : skill `zone-service`). Tables dérivées `lien` et `page_fts` : skill `base-sqlite`.

## Migration 0096
- Un mot-clé par page visée ou colorée, libellé = titre de la page, sans définition ni abréviation ; une route sans page prend le libellé de son menu ; un mot-clé existant de même écriture, ou désigné comme le même, prend l'adresse (`MOTS_CLES_EXISTANTS_REPRIS`). Comptes et table de conversion : le registre `0096-liens-en-mots-cles.json`.

## Tests
- `db-liens-en-mots-cles`, `mots-cles-liens`, `adresses-db`, `serveur-edition-mots-cles-liens`, `serveur-edition-rejeu-liens`, `citations-db`, `serveur-edition-pages-regles`.
- Rendu : `mots-cles-liens-rendu`, `mots-cles-vivants-liens`, `palette-css`, `glossaire-html` (site construit : les pages colorées gardent leur classe).
