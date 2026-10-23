---
name: zone-chronologie
description: "Chronologie /chronologie/ (frise, page par événement, chevrons, filtre par catégorie, mini-frise et tiroir du téléphone), tables evenement, evenement_extrait, categorie_chronologie, evenement_categorie, édition sur le site de dev. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/chronologie*.mjs", "client/src/components/chronologie/**", "client/src/pages/chronologie/**", "client/src/styles/chronologie/**", "client/serveur/edition-chronologie.mjs", "client/src/scripts/edition/chronologie.mjs", "tools/chronologie/**", "client/test/chronologie*.test.mjs", "client/test/serveur-edition-chronologie.test.mjs", "data/migrations/0035-chronologie*", "data/migrations/0043-chronologie*", "docs/chronologie.md"]
user-invocable: false
---
# Chronologie

## Fichiers
- Logique pure : `client/src/lib/chronologie.mjs` (`ordonner`, `couleursDesEvenements`, `surlignerLaDate`, `SANS_CATEGORIE`).
- Chargeur et choix du filtre : `lib/chronologie-db.mjs`. Rendu d'un événement (build et éditeur) : `lib/chronologie-rendu.mjs`.
- Composants : `components/chronologie/Chronologie.astro` (mise en page, chevrons, clavier, mini-frise et tiroir), `Frise.astro` (frise, filtre et son script), `ChronologieEvenement.astro`.
- Pages : `pages/chronologie/index.astro`, `[slug].astro`. CSS : `styles/chronologie/chronologie.css` (inséré en `?raw`).
- Site de dev : `serveur/edition-chronologie.mjs` (service ; il porte aussi les opérations du vocabulaire des mots-clés : skill `zone-mots-cles`), `src/scripts/edition/chronologie.mjs`.
- Import : `tools/chronologie/chronologie.mjs`, registre `tools/chronologie/evenements.json`.

## À lire
- `docs/chronologie.md` : « La page », « Modifier la chronologie (site de dev) », « Les données », « Règles de sélection », « Questions au propriétaire ». C'est l'évolution E5 de `docs/feuille-de-route.md`.

## Choix du propriétaire
- Menu Codex. Une page par événement daté (`/chronologie/<id>/`). `/chronologie/` = la frise et son mode d'emploi.
- À gauche, en vertical, la frise : une immense barre en dégradé, une ligne par événement, la date à gauche de la barre, le titre à droite ; losange = Impact majeur. Elle défile seule.
- Un clic ouvre la page de l'événement à droite (75 % de la largeur). Tout à droite, deux chevrons : Haut (précédent) et Bas (suivant).
- Petit écran (« la mini-frise, en plus du tiroir ») : la frise est `/chronologie/` ; sur la page d'un événement, la mini-frise (barre et points, sans texte) collée à gauche, un appui l'ouvre en tiroir par-dessus la page, et une barre du bas porte les chevrons et l'événement affiché.
- Filtre par catégorie en tête de la frise : liste déroulante, une catégorie à la fois ; caché s'il n'y a rien à choisir ; `?filtre=` dans l'adresse, suivi par les chevrons.
- « Sans catégorie (à trier) » pour les événements qui n'en ont pas, hors de la production seulement : `SITE_MODE=prod` l'ôte (`modeDuSite(...).prod`).
- Catégories plutôt que mots-clés (les mots-clés sont « trop nombreux et trop libres » pour faire des catégories stables) : vocabulaire à part, plusieurs catégories par événement.
- La liste « Les Impacts mineur et majeur » est reprise en entier, titres tels quels. Pas de règnes.
- Modifiable sur le site de dev : date, titre, descriptions en place, liens, catégories en cases à cocher ; créer, supprimer un événement ; bouton « Catégories » : créer, renommer, supprimer une catégorie, qui quitte alors ses événements.

## Données
- Tables `evenement`, `evenement_extrait` (les blocs de description : texte et lien facultatif vers une page), `categorie_chronologie` et `evenement_categorie` (section 5 bis de `data/schema.sql`, migrations `0035-chronologie`, `0043-chronologie-modifiable-mots-cles`).
- Ordre de lecture : époque, année, puis `evenement.rang` (l'ordre à date égale ; un événement créé prend le plus grand + 1) : `ordonner`.
- `categorie_chronologie` : id figé, écriture unique. `SANS_CATEGORIE` n'est jamais l'id d'une catégorie.

## Invariants
- Une page par événement, rendue depuis les tables `evenement` / `evenement_extrait`, jamais depuis un Markdown. Pas de type de page `chronologie` : un type ferait entrer en conflit `[type]/` et `pages/chronologie/`.
- À l'import, le texte d'un extrait est copié d'une page (`page.corps_md`, `tools/chronologie/chronologie.mjs`), jamais réécrit ; date surlignée.
- Depuis la migration 0043, le site de dev est la source de la chronologie. Le registre `evenements.json` n'est plus que la trace de l'import (`--verifier` relit l'état d'import) : `test/chronologie.test.mjs` le compare aux lignes d'import (`lib/historique-site.mjs`).
- Un bloc (`evenement_extrait`) a un texte Markdown simple, rendu par `lib/chronologie-rendu.mjs` (le même au build et dans l'éditeur). HTML brut et lien non sûr refusés par le service et la mise à jour, comme le guide (`lib/markdown-sur.mjs` : skill `zone-edition`).
- Le lien d'un bloc (`page_id`) vise une page qui n'est pas un exemple ; supprimer la page détache le bloc. Un événement garde au moins un bloc.
- Le titre d'un événement de la liste « Les Impacts mineur et majeur » est sa ligne telle quelle. Un autre titre n'ajoute aucun nom ni fait à ses extraits.
- `data-a-trier` est posé sur le choix du filtre et sur les pastilles ; l'extension le relit.
- Le filtre (`[data-frise-choix]`, script en ligne de `Frise.astro`) cache les lignes des autres catégories (`data-categories`), refait les couleurs voisines et ajoute `?filtre=` aux liens. `Chronologie.astro` refait chevrons et « Commencer » d'après les lignes visibles (évènement `chronologie:frise-filtree`).
- En mode modification, `edition/chronologie.mjs` refait frise et événement d'après la base vivante (`GET /api/edition/chronologie/`, `POST /api/edition/evenement/`). Un événement créé depuis le build s'affiche sur `/chronologie/?evenement=<id>`.
- La frise (`Frise.astro`, `[data-frise]`) défile seule à hauteur d'écran. Son script, en ligne juste après elle, la remet où on l'a laissée (`sessionStorage`) avant le premier affichage.
- Chaque ligne porte sa couleur et celles de ses voisines (`--c`, `--c-avant`, `--c-apres` : `couleursDesEvenements`) ; chaque morceau de barre fait son dégradé.
- D'une page de la chronologie à l'autre, transition entre documents (`@view-transition`), dans `chronologie.css` seulement.
- Les scripts sont en ligne. `Chronologie.astro` : ← → (propres à la chronologie : les pages du guide n'en ont pas, skill `zone-guide`), mini-frise et tiroir du téléphone.
- Plus de glissement du doigt (réponses du propriétaire du 2026-10-22 : « Le slide du doigt devrai faire changer d'onglet », puis « Laisse tomber. Trop de cas spécifiques compliquées. Supprime juste le swipe. ») : sur écran tactile, les chevrons. Le retour arrière au glissement horizontal est empêché pour tout le site par la feuille globale (skill `ui-defilement`), plus par `chronologie.css`.
- Site de dev : le panneau du crayon (`.ed-cote`, skill `zone-edition`) descend en bas à droite (`body:has(.chrono)`) ; sur la page d'un événement en téléphone, il se pose au-dessus de la barre du bas (`bottom` plus grand que sa hauteur, couché compris), jamais sur le chevron Bas, seul moyen d'avancer sans glissement (essai réel en 390 px du 2026-10-22, `chronologie-html.test.mjs`).
- Téléphone : la même liste de `Frise.astro` sert de page (`/chronologie/`), de mini-frise (`.frise:not(.est-ouverte)`, inerte, le bouton `.frise-ouvrir` posé dessus) et de tiroir (`.frise.est-ouverte`, le reste de la page inerte). Tout cela sous `html.js`, posée par `Chronologie.astro` avant la frise. Le script de la frise d'ordinateur ne s'occupe que d'une frise qui défile (`overflow-y: auto`).
- La date d'un extrait est surlignée par deux marqueurs de la zone d'usage privé posés dans le Markdown, puis changés en `<mark class="chrono-surligne">` (`surlignerLaDate`).
- Les descriptions peuvent citer des mots-clés (balises du glossaire, forme canonique d'un texte mis en forme) ; le récit de la chronologie est hors de l'outil qui balise un mot dans tous les textes (`horsDe`) : skill `zone-mots-cles`.

## Tests
- `client/test/chronologie.test.mjs` (logique, base, registre comparé à l'import).
- `chronologie-html.test.mjs` (site construit, CI après le build).
- `chronologie-filtre.test.mjs` (scripts du filtre et des chevrons, faux navigateur), `chronologie-rendu.test.mjs`, `serveur-edition-chronologie.test.mjs` (le service).
