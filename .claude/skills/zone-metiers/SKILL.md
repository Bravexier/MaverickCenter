---
name: zone-metiers
description: "Page /metiers/ (un tableau tiré des tables metier, metier_bonus, metier_objet_depart, pas de page par métier), règles des métiers R33 à R40, renvoi des liens par cheminDePage. À charger avant de lire, modifier ou relire ce code."
paths: ["client/src/lib/metiers.mjs", "client/src/lib/metier-champs.mjs", "client/src/lib/metiers-tri.mjs", "client/src/lib/corps-metiers.mjs", "client/src/components/metier/**", "client/src/styles/metier/**", "client/test/metier*.test.mjs", "client/test/corps-metiers.test.mjs", "client/test/serveur-edition-rejeu-metiers.test.mjs", "data/migrations/0024-metiers-fiche*", "data/migrations/0025-metiers-precisions*"]
user-invocable: false
---
# Métiers

## Fichiers
- Lecture : `client/src/lib/metiers.mjs` (`chargerMetiers`, `contexteDesMetiers`, `cheminDePage`, `PAGE_DES_REGLES`).
- Découpage des champs : `lib/metier-champs.mjs` (`decouperBonus`, `ATTRIBUT_DE_CIBLE`).
- Filtres et tri dans l'adresse : `lib/metiers-tri.mjs`.
- Tableau : `components/metier/MetiersTableau.astro`, CSS `styles/metier/tableau.css` (inséré en `?raw`).
- Cellules : rendus `metier-bonus`, `metier-artisanat`, `metier-carac`, `metier-equipement` de `lib/edition-rendu.mjs`.
- Pastilles d'une compétence visée et d'une caractéristique de l'artisanat : la classe de la caractéristique (`couleur-caracteristique-<id>`, `par-defaut` si inconnue ; skill `ui-couleurs`), que `styles/metier/tableau.css` lit en `--couleur` / `--couleur-texte`, jamais un style.
- Corps Markdown tenu d'accord : `lib/corps-metiers.mjs` (skill `zone-edition`).
- `metiers.mjs` porte aussi des adresses d'autres zones (`adresseDePage`, `estServieASonId`, `pageSansAdresse`, `renvoisDuGuide`) : skill `site-wiki-liens`, skill `zone-equipement`, skill `zone-guide`.

## À lire
- `docs/content-guide.md`, « Métiers (`/metiers/`) : un tableau, pas de page par métier » (colonnes, champs et liens, filtres et tri, renvoi des liens).
- `docs/decisions-regles.md`, R33 à R40.

## Invariants
- Pas de page par métier (demande du propriétaire). `/metiers/` est un tableau tiré de la table `metier` (`chargerMetiers`), la description sous la ligne. Colonnes : Nom, Bonus, Artisanat, Caractéristiques, Équipement supplémentaire.
- Les pages `metiers/<slug>` restent (recherche, mots-clés, `[[liens]]`), mais `[slug].astro` ne les construit pas. Tout lien vers une page passe par `cheminDePage` (via `entryHref`, `pageHref`, `entryUrl`), qui renvoie un métier à `/metiers/#metier-<slug>`. Ne jamais écrire `${id}/` à la main.
- Seule « Règles des métiers » (`PAGE_DES_REGLES`, sans ligne dans `metier`) garde sa page.
- Les cellules du tableau sont les rendus de `lib/edition-rendu.mjs` : un seul HTML avec le mode modification.
- Un nom de compétence dans « Bonus » la lie (`decouperBonus`). Ne rien lier d'autre par vraisemblance.
- Sur le site de dev, l'artisanat se modifie en texte + deux listes de caractéristiques ; `artisanat_brut` en est recalculé, jamais saisi.
- Le découpage de `metier-champs.mjs` refait celui de l'importeur : `test/metier-champs.test.mjs` le rejoue sur toute la base.

## Règles des métiers (R33 à R40)
- Migrations `0024-metiers-fiche`, `0025-metiers-precisions`.
- Un bonus vise une compétence (`metier_bonus.competence_id` : son Acquis, rogné au plafond, R38) ou un attribut (`attribut` : initiative, vitesse, vitesse de nage ; `ATTRIBUT_DE_CIBLE`, R37).
- Un rang à plusieurs compétences se choisit dans la fiche (`personnage_metier_bonus`, `v_personnage_metier_bonus`).
- L'artisanat = un texte + 2 caractéristiques (R34), 10 × chacune (constante `metier.artisanat_par_point_caracteristique`).
- L'équipement = des objets de départ (`metier_objet_depart`) ajoutés à l'inventaire (R35 ; options d'un choix données en entier, R40).
- Effets sur la fiche (Acquis, plafond R41, croix R39, `artisanatDe`, `bonusDuMetier`) : skill `zone-fiche-acquis`.

## Tests
- `client/test/metiers-html.test.mjs` : aucun lien du site construit ne mène à une page de métier (CI après le build).
- `metiers.test.mjs` (les pages du type sont exactement les lignes de `metier`), `metier-champs.test.mjs`, `metiers-tri.test.mjs`, `corps-metiers.test.mjs`, `edition-rendu.test.mjs`, `serveur-edition-rejeu-metiers.test.mjs`.
