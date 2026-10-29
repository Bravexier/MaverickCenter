---
name: zone-equipement
description: "Page /ressources/equipement/ (cinq onglets Armes, Armures, Boucliers, Ceinture, Accessoires ; sous-onglets de la ceinture ; identifiants uniques ; pages du wiki servies et renvois) et panneaux de règles (panneau_regles, panneau_regles_bloc). À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/equipement.mjs", "client/src/components/equipement/**", "client/src/pages/ressources/equipement.astro", "client/src/styles/equipement/**", "client/src/lib/panneaux-regles-db.mjs", "client/src/lib/panneaux-regles-rendu.mjs", "client/serveur/edition-panneaux.mjs", "client/src/scripts/edition/panneaux.mjs", "client/test/equipement*.test.mjs", "client/test/panneaux-regles.test.mjs", "client/test/serveur-edition-panneaux.test.mjs", "client/test/edition-panneaux.test.mjs", "data/migrations/0053-liens-page-equipement*", "data/migrations/0056-glossaire-et-panneaux-de-regles*", "tools/sheets/equipement.py"]
user-invocable: false
---
# Page « Équipement » et panneaux de règles

## Fichiers
- Page : `client/src/pages/ressources/equipement.astro`, `components/equipement/EquipementPage.astro`, CSS `styles/equipement/equipement.css`.
- Onglets, pages servies, adresses : `lib/equipement.mjs` (`ONGLETS_DE_L_EQUIPEMENT`, `SOUS_ONGLETS_DE_LA_CEINTURE`, `PAGES_SERVIES_PAR_L_EQUIPEMENT`, `adresseDePage`).
- Panneaux de règles : lecture `lib/panneaux-regles-db.mjs` (`chargerPanneau`, `ordonnerBlocs`), HTML `lib/panneaux-regles-rendu.mjs`, composant `components/equipement/PanneauDeRegles.astro`, service `serveur/edition-panneaux.mjs`, extension `src/scripts/edition/panneaux.mjs`.
- Importeur des pages du classeur « Ressources et Craft » (une page par onglet, dont les pages servies) : `tools/sheets/equipement.py`.
- Contenu des onglets : skill `zone-armes`, skill `zone-armures`, skill `zone-ceinture`, skill `zone-accessoires`.

## À lire
- `docs/content-guide.md`, « Équipement (`/ressources/equipement/`) » et « Panneaux de règles (en tête des onglets et du sous-onglet Bâtons magiques) ».
- `docs/serveur.md`, « Édition des règles (site de dev) », ligne « Panneaux de règles » ; notes de version des panneaux : `docs/serveur.md` (domaine « Équipement », `comparerOrdreDesBlocs`).

## Page et onglets
- Une page sans page du wiki, rendue depuis la base. Au menu, pas d'entrée unique : la rubrique Équipement a une entrée par onglet (libellé et ancre de `ONGLETS_DE_L_EQUIPEMENT`, `lib/nav.mjs` ; skill `zone-menu`), comparées par `test/equipement.test.mjs` et `test/equipement-html.test.mjs`.
- Cinq onglets dans l'ordre de `ONGLETS_DE_L_EQUIPEMENT` : Armes, Armures, Boucliers, Ceinture, Accessoires (demandes du propriétaire). `components/Onglets.astro` est posé une fois, par `EquipementPage.astro` (skill `ui-onglets`). Sans JavaScript, les panneaux se suivent.
- Un onglet = une `section.equipement-panneau` dont l'id est l'ancre de l'onglet (`lib/equipement.mjs`). Un sous-onglet de la ceinture = une `section.ceinture-panneau`, ancre unique sur la page aussi.
- Un lien vers un élément d'un panneau ouvre son onglet, et son sous-onglet.
- La pastille d'une gemme (`.acc-gemme`, `styles/equipement/equipement.css`, partagée par les Accessoires et les Bâtons magiques de la ceinture) : sa couleur est `--couleur` / `--couleur-texte` de la classe de la magie qu'elle porte (accessoires et bâtons ; skill `ui-couleurs`), plus de `--g` en style. Aucune couleur écrite pour elle.
- Couleurs d'interface communes (`equipement.css`) : le liseré des types de dégâts (`--degats-taille`, `--degats-estoc`) et l'ombre des fiches (`--ombre-fiche`) sont des jetons du thème (`styles/global/base.css`) ; la feuille n'écrit plus aucune couleur, hors le noir de mélange de `.acc-gemme` (`test/palette-css.test.mjs`). L'onglet Armes est `<div class="armes couleur-arme-depart">` (le bleu des armes de départ : skill `zone-armes`). L'onglet Accessoires émet la feuille des couleurs des niveaux (`couleur-niveau-<n>`, `AccessoiresPage.astro` ; skill `zone-accessoires`), l'onglet Armes celle des matériaux et des armes de départ, les onglets Armures et Boucliers celle des types et des poids : chaque famille d'une zone, une fois sur la page.
- Le bloc des armures (`.armures`) se cache entier quand ni Armures ni Boucliers n'est ouvert (`armures.css` : `html.js .armures:not(:has(> .armures-panneau.is-active))`).

## Pages servies et renvois
- Pages du wiki servies : `PAGES_SERVIES_PAR_L_EQUIPEMENT` = `ressources/armes`, `ressources/armures`, `ressources/bouclier`, `ressources/accessoires`, et `ressources/baton-magique` par le sous-onglet Bâtons magiques de la ceinture.
- Elles ne sont plus construites (`lib/metiers.mjs#pageSansAdresse`) mais restent dans la base (recherche, `[[liens]]`, contexte des liens de leur panneau). Leurs liens mènent à leur onglet (`adresseDePage`).
- Leurs anciennes adresses mènent à l'onglet par la page 404 (`lib/nav.mjs#PAGES_RENOMMEES`, requête gardée), comme l'ancienne page « Objets à la ceinture » (→ `#ceinture`).
- Les liens écrits à la main dans le guide mènent aux onglets depuis la migration `0053-liens-page-equipement` (la version portable n'a pas de page 404).
- Une page servie par un onglet ou un sous-onglet : son entrée dans `ONGLETS_DE_L_EQUIPEMENT` (ou `SOUS_ONGLETS_DE_LA_CEINTURE`) ET dans `lib/nav.mjs#PAGES_RENOMMEES`. `nav.mjs` n'importe rien : le script de la page 404 l'importe. `test/equipement.test.mjs` compare les deux.

## Invariants
- Identifiants uniques sur toute la page : `#materiaux-armes`, `#ameliorations-arme`, `#ameliorations-armure`, `#ameliorations-bouclier` (`test/equipement-html.test.mjs`).
- Les scripts des onglets (`armes.mjs`, `armures.mjs`, `batons.mjs`, `accessoires.mjs`) n'ont aucun paramètre d'adresse en commun (`amelioration-armure` pour une armure, `amelioration` pour une arme) : une même adresse garde l'état de plusieurs onglets.
- Un script n'agit pas sur un onglet caché : Échap ne ferme l'arme ouverte que si l'onglet Armes est affiché.
- Mode modification : les onglets Armes, Armures et Boucliers par leurs extensions (`edition/armes.mjs`, `edition/armures.mjs`), les panneaux de règles par `edition/panneaux.mjs`, les consommables de la ceinture par l'éditeur commun (skill `zone-ceinture`). Ni carquois, ni bâtons, ni tableaux des accessoires.

## Panneaux de règles
- En tête de chaque onglet ou sous-onglet qui sert une page de `PAGES_SERVIES_PAR_L_EQUIPEMENT` : Armes, Armures, Boucliers, Accessoires, Bâtons magiques de la ceinture. Un panneau par page, `panneau_regles.id` = l'ancre de son onglet ou sous-onglet (testé). L'onglet Ceinture n'en a pas : il garde ses règles tirées du guide.
- Tables `panneau_regles` (titre, `page_id` : contexte des `[[liens]]`) et `panneau_regles_bloc` (`rang` = la clé, jamais redonné ; `ordre` = place de lecture, non unique, à égalité le rang ; `tuile` 0 ou 1 ; titre facultatif d'une tuile, jamais d'un bloc de texte ; texte Markdown). Migration 0056.
- `page.corps_md` des pages servies n'est plus que la trace de l'import : jamais affiché ni modifié. Le texte des panneaux (titre et blocs) est en tête de l'entrée de recherche de la page (`lib/recherche-index.ts`), le corps suit.
- Affichage : plus de phrase au-dessus du panneau. `details.preg#regles-<id>`, `data-panneau-regles`, replié (celui des Accessoires déplié), titre dans le `<summary>`, blocs dans l'ordre (ordre puis rang). Bloc de texte = prose qui suit les colonnes ; tuile = cadre au titre facultatif. Deux colonnes à partir de 64rem, une seule en dessous ; une tuile, un paragraphe ou une liste ne se coupe jamais entre deux colonnes, la fin d'un texte suivi d'une tuile reste avec elle (`break-after: avoid`).
- Markdown rendu au build (`rendreMarkdown`, `lib/guide-rendu.ts`) avec la page du panneau (`page_id`) comme contexte, balises du glossaire comprises. Le même HTML au build et sur le site de dev (`lib/panneaux-regles-rendu.mjs`).
- Dans le panneau des armes, « Les armes en bleu… » prend le bleu des armes de départ : skill `zone-armes` (`avecPhraseDesArmesDeDepart`).
- Site de dev : chaque panneau s'ouvre et reste ouvert, son summary ne se replie pas en mode modification. Titre, texte en place (outils « Mots-clés » compris : skill `zone-mots-cles`), titre des tuiles, ↑ ↓, « + Texte » / « + Tuile » créés tout de suite après un bloc, « Supprimer » (pas le dernier bloc). Les extensions armes et armures laissent le panneau (`.preg`) à `edition/panneaux.mjs`.
- Un texte n'est envoyé que si son Markdown relu diffère de celui relu à l'entrée (pas du texte de la base).
- Note de version : un bloc nommé par son titre de tuile, ses premiers mots ou son mot-clé ; l'ordre des blocs en une ligne par panneau (`comparerOrdreDesBlocs`), jamais la colonne `ordre`.

## Tests
- `test/equipement.test.mjs` (onglets et sous-onglets, adresses, menu, chargement), `test/equipement-html.test.mjs` (site construit : ordre, identifiants uniques, panneaux, anciennes pages absentes, scripts).
- `test/panneaux-regles.test.mjs` (un panneau par page servie, id = ancre, blocs de l'import lus mot pour mot dans le corps), `test/serveur-edition-panneaux.test.mjs` (service), `test/edition-panneaux.test.mjs` (extension dans un faux navigateur).
- Contenu des onglets : `armes-html`, `armures-html`, `ceinture-html`, `accessoires-html.test.mjs`.
