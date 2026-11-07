---
name: zone-mots-cles-liens
description: "Liens et couleurs des mots-clés (migration 0098) : mot_cle.url et mot_cle.couleur, liens [[…]] et Markdown convertis en balises, adresses permises, refus du service, fusion, db:check, couleur de la page où mène un mot-clé. À charger avant de lire, modifier ou relire ce code, la migration ou leurs tests."
paths: ["client/src/lib/mots-cles-liens.mjs", "client/src/lib/liens-en-mots-cles.mjs", "client/src/lib/adresses-db.mjs", "client/src/lib/couleur-de-la-page.mjs", "client/scripts/liens-en-mots-cles.mjs", "data/migrations/0098-*", "client/test/db-liens-en-mots-cles.test.mjs", "client/test/mots-cles-liens.test.mjs", "client/test/adresses-db.test.mjs", "client/test/serveur-edition-mots-cles-liens.test.mjs", "client/test/serveur-edition-rejeu-liens.test.mjs", "client/test/fixtures/lots-avant-0098.json"]
user-invocable: false
---
# Liens et couleurs des mots-clés

## Fichiers
- `lib/mots-cles-liens.mjs` : forme d'une adresse, lecture et classe d'une couleur, mot-clé d'une page, mots-clés d'une adresse, `LIENS_GARDES`, `REGISTRE_DES_LIENS`. Sans aucun import : un script de page peut l'importer.
- `lib/adresses-db.mjs` : `adressesDuSite` (où une adresse peut mener), `pageDeLAdresse` (la page où elle mène), `indexDesAdresses(db, { exemples, enPlus })` (l'index des pages par adresse ; `enPlus` : des ids de pages absentes de la base, supprimées par un lot rejoué, que `citationsDesPages` y ajoute pour voir les citations des adresses de mots-clés), `ADRESSES_FIXES`.
- `lib/liens-en-mots-cles.mjs#convertirLesLiens`, son générateur `scripts/liens-en-mots-cles.mjs` et le registre `data/migrations/0098-liens-en-mots-cles.json`.
- `lib/couleur-de-la-page.mjs` : la couleur d'une page et la feuille des mots-clés colorés.
- Rendu d'une balise à adresse ou colorée : skill `zone-mots-cles`. Saisie du lien et de la couleur sur le Glossaire : skill `zone-glossaire`. Fonctions de la palette (`fauteDeLaCouleur`, `cssDesMotsCles`) : skill `ui-couleurs`.

## À lire
- `docs/content-guide.md`, « Liens entre pages » et la puce « Les couleurs des mots-clés » de « Couleurs du site : la palette en classes ».
- `docs/serveur.md`, « Édition des règles (site de dev) » : liens saisis, rejeu d'un lot d'avant la 0098.

## Choix du propriétaire
- « tous les liens deviendront des mots-clés et tous les mots-clés deviendront des liens » : un lien est la balise d'un mot-clé qui a une adresse.
- `mot_cle.couleur` et `mot_cle.url`, NULL par défaut ; « URL interne seulement » : relative à la racine du site, sans `SITE_BASE`.
- Les `[[…]]` et les liens Markdown internes `[texte](/…)` sont convertis (Q1). Sans adresse, un mot-clé n'est pas cliquable (Q2) ; avec, il est en gras et cliquable, même sans définition (Q11).
- Couleur (Q3, Q4) : une référence `famille:id` d'une couleur de la palette, qui suit le site, toutes familles comprises, ou `#rrggbb` (le cercle).
- La page vers laquelle mène un mot-clé coloré prend sa couleur (Q5) : le mot-clé coloré dont l'adresse y mène, ancre ignorée, le premier par libellé ; « il ne faut pas de changement par rapport à avant en terme de résultat ». Un mot-clé par page colorée (Q8), qui reprend la couleur de sa page (classes et races comprises, Q9).
- « La couleur inclue la tuile (quand on a la définition complète {{X:}} ) et l'habillage de l'infobulle » (Q13).
- Les routes du menu ont leur mot-clé, au libellé du menu ; le lien Discord de l'accueil reste un lien (Q10 : `LIENS_GARDES`, `/#lien-discord`).
- Homonymes race et classe : « La race garde le nom », la classe s'écrit « <Titre> (classe) » (Q14) ; hors du Glossaire, de la Recherche et de Données, le mot-clé s'affiche sans le suffixe (R191 : skill `zone-mots-cles`). Collision avec un mot-clé existant : « Le mot-clé existant prend l'URL » (id et définition gardés) ; la liste des mots-clés repris est `MOTS_CLES_EXISTANTS_REPRIS` du générateur, jamais recopiée ici. Résistance : aucun mot-clé fondu, on garde le nouveau.

## Choix du leader-technique
- Fusion : la cible garde son adresse et sa couleur, et prend celles de la source qu'elle n'a pas (modification notée au journal, le résumé dit ce qu'elle garde).
- Mots-clés protégés : adresse et couleur modifiables.
- L'existence de l'adresse se vérifie au service (base vivante) et par `db:check` ; l'ancre et la requête ne sont pas vérifiées.
- Supprimer une page qu'un mot-clé vise est refusé (409 : citations `mot-cle` et `balise` de `lib/citations-db.mjs`, skill `zone-edition-menus`) ; de même la fiche d'un don ou d'une spécialité et l'ancre d'un métier (skill `zone-edition`).
- Un lien saisi est converti si un seul mot-clé mène à sa cible, sinon refusé (400). Deux mots-clés ne partagent donc jamais une adresse (choix de la migration 0104 : `attaque-gratuite` renvoie à `attaque-dopportunite` par sa définition, sans adresse), sinon un lien saisi vers cette page est refusé (`motsClesDeLAdresse`).
- Les pages d'exemple gardent leurs `[[…]]`.
- `npm run autolink` reste un outil d'aperçu relu ; il exclut `lore` et `metiers` (skill `site-wiki-liens`). `codex.py` ne pose jamais le mot-clé d'une page en étiquette (skill `sources-codex`).
- Routes fixes admises (`ADRESSES_FIXES`) : les routes publiques, jamais Debug, Maintenance ni Mise à jour.

## Invariants
- Adresse (CHECK de `mot_cle.url`, puis `fauteDeLUrl`) : `/` au début, jamais `//`, ASCII imprimable sans espace ni `\`, avec la barre finale du site. Hors CHECK, `fauteDeFormeDeLUrl` refuse aussi `"` `'` `<` `>` `` ` `` et tout blanc, requête et ancre comprises (service et `db:check`) ; son chemin, sans ancre ni requête, est dans `adressesDuSite` : une page qui n'est pas d'exemple (`cheminDePage` : un métier mène à `/metiers/#metier-<slug>`), une rubrique (`type_page`), une route de `ADRESSES_FIXES` (comparée à `src/pages` par `adresses-db.test.mjs`).
- Couleur : `#rrggbb` en minuscules (le modèle d'édition les abaisse) ou une référence que la palette connaît. Classe (`classeDuMotCle`) : celle de la palette, ou `couleur-mot-cle-<id>` pour une couleur écrite.
- Refus du service (`serveur/edition.mjs#refuserLeLien`, `#refuserLaCouleur`) : 400 `{ champ: 'url' | 'couleur' }`, jamais 409 ; une valeur inchangée n'est pas contrôlée.
- Lien saisi (`serveur/edition.mjs#texteSansLiens`, avant la forme canonique) : un `[[…]]` ou `[texte](/…)` ajouté à un texte de `CHAMPS_DE_TEXTE`, hors code, devient la balise du seul mot-clé qui mène à sa cible (`motsClesDeLAdresse` : même adresse, requête ignorée ; sinon même chemin sans ancre) ; aucun, plusieurs, une cible introuvable, un texte affiché vide, ou avec Markdown ou balise : 400 `{ champ, liens }`, qui renvoie au Glossaire (choix du leader-technique). Limite connue : un lien dont le texte n'est que du code en ligne n'est pas lu par `liensDuTexte` (non corrigée : la lib sert à la 0098). Un lien externe, un lien déjà présent, `LIENS_GARDES` et une page d'exemple passent.
- Conversion (`convertirLesLiens`) : `{{id}}` quand le texte affiché est le libellé, `{{id|texte}}` sinon (`\|` sur une ligne de tableau) ; `{{id|texte}}` toujours dans un texte de case ; un lien dans un code reste.
- `db:check` : adresse et couleur de chaque mot-clé ; aucun `[[…]]` ni lien Markdown interne hors code dans `textesDeLaBase`, sauf pages d'exemple et `LIENS_GARDES`.
- Un import ne crée jamais de mot-clé : une page sans mot-clé qui y mène ne se lie pas (renvoi du Codex en texte simple signalé, page sans cible pour le maillage).
- Couleur de la page (`classeDeLaPage`, repli : la couleur d'avant) : les gabarits des magies, classes, races et du guide la posent à la place de la leur (`couleurPropre` de `layouts/Base.astro`) ; toute autre page la reçoit sur `<main class="page-coloree …">`, seulement quand un mot-clé coloré y mène. Les tuiles des listes, la carte de `/magies/`, les puces et les tableaux gardent leurs couleurs.
- Feuille des mots-clés colorés (`cssDesMotsClesDuSite`, `<style data-couleurs-mots-cles>` de `Base.astro`, sur chaque page) : couleurs écrites et familles d'une zone qu'un mot-clé nomme, sous 1,5 ko (`palette-css.test.mjs`) ; le site de dev la remplace par le `css` de `GET /api/edition/mots-cles/` (`mots-cles-vivants.mjs`).
- Le registre de la 0098 sert au rejeu d'un lot d'avant (`ancienneEcritureDesLiens` : skill `zone-edition`) ; il est livré avec le service (`FICHIERS_JOINTS` : skill `zone-service`). Tables dérivées `lien` et `page_fts` : skill `base-sqlite`.

## Migration 0098
- Un mot-clé par page visée ou colorée, libellé = titre de la page, sans définition ni abréviation ; une route sans page prend le libellé de son menu ; un mot-clé existant de même écriture, ou désigné comme le même, prend l'adresse (`MOTS_CLES_EXISTANTS_REPRIS`).
- Fusion dans l'existant (« Fusionner dans l'existant ») : pour chaque paire de `FUSIONS_DANS_L_EXISTANT`, le mot-clé existant prend l'URL de la page (comme Bouclier et Ceinture), les liens convertis le visent avec le même texte affiché (`{{id|texte}}`), et le mot-clé nouveau n'est pas créé. Les protégés (classe, race, metier) y mènent. Le lien converti vers un existant qui a une définition prend son infobulle (« Oui, avec infobulle »). Comptes et table de conversion : le registre `0098-liens-en-mots-cles.json`.

## Tests
- `db-liens-en-mots-cles`, `mots-cles-liens`, `adresses-db`, `serveur-edition-mots-cles-liens`, `serveur-edition-rejeu-liens`, `citations-db`, `serveur-edition-pages-regles`.
- Rendu : `mots-cles-liens-rendu`, `mots-cles-vivants-liens`, `palette-css`, `glossaire-html` (site construit : les pages colorées gardent leur classe), `conflits-rendu` (`FORME_D_ADRESSE` recopie la règle de `fauteDeFormeDeLUrl` sans l'importer, le graphe de `mise-a-jour.mjs` étant épinglé : le test compare les deux).
