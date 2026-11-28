---
name: zone-menu
description: "Menu du site (cinq rubriques, menu latéral, menu du profil : lib/nav.mjs, menu-db.mjs, menu-rendu.mjs, MenuDuSite.astro, MenuDuProfil.astro, menu-site.css ; PAGES_RENOMMEES, page 404) et en-tête (layouts/Base.astro, site-shell.css, logo, compte). À charger avant de lire, modifier ou relire le menu, l'en-tête ou leurs tests."
paths: ["client/src/lib/nav.mjs", "client/src/lib/menu-db.mjs", "client/src/lib/menu-rendu.mjs", "client/src/layouts/Base.astro", "client/src/components/MenuDuSite.astro", "client/src/components/MenuDuProfil.astro", "client/src/components/Acces.astro", "client/src/components/Compte.astro", "client/src/styles/global/menu-site.css", "client/src/styles/global/acces.css", "client/src/styles/global/compte.css", "client/src/scripts/compte.mjs", "client/src/lib/compte.mjs", "client/src/pages/profil.astro", "client/src/pages/connexion.astro", "client/test/compte.test.mjs", "client/src/styles/global/site-shell.css", "client/public/logo.webp", "client/public/favicon.png", "client/public/apple-touch-icon.png", "client/test/nav.test.mjs", "client/test/menu-*.test.mjs", "client/test/aide-menu-html.mjs"]
user-invocable: false
---
# Menu et en-tête

## Fichiers

- Plan : `lib/nav.mjs` (`NAV`, `MENU_DU_PROFIL`, `entreesVisibles`, `rubriqueCourante`, `activeGroup`, `groupIsCurrent`, `legacyWikiRedirect`, `PAGES_RENOMMEES`, renvois de la page 404). Il n'importe rien (le script de la page 404 l'importe).
- Résolution : `lib/menu-db.mjs` (`menuDuSite`, `htmlDeLEntree`, `adresseDeLOnglet`). Rendu : `lib/menu-rendu.mjs` (lu au build seulement).
- Pose : `layouts/Base.astro`, `components/MenuDuSite.astro`, `components/MenuDuProfil.astro`, `components/Compte.astro`. Styles : `styles/global/menu-site.css`, `site-shell.css`, `compte.css`. Les scripts de `MenuDuSite.astro` et `MenuDuProfil.astro` sont en ligne, sans import ; `Compte.astro` pose `scripts/compte.mjs` (skill `site-version-portable`).
- `Base.astro` porte aussi des scripts d'autres zones : infobulles (skill `ui-infobulles`), maintenance (`zone-maintenance`), bandeau du site de dev (`zone-mise-a-jour`), métriques (`zone-debug-metriques`), avis d'accès (`components/Acces.astro` ; `site-version-portable`), couleurs des mots-clés (`zone-mots-cles-liens`).

## À lire

- `docs/content-guide.md`, « Menu du site : cinq rubriques et un menu latéral (R319) » ; `docs/feuille-de-route.md` (niveaux).
- Les en-têtes de `nav.mjs`, `menu-db.mjs`, `menu-rendu.mjs` (forme d'une entrée).

## Rubriques et entrées (R319)

- Cinq rubriques, dans l'ordre : Le Jeu, Règles, Ressources, Le monde, Taverne. Une entrée à `enfants` n'a pas de lien : Introduction se plie sur Découvrir et L'univers.
- Pas d'entrée pour `/fiche/` (R319 (6)) : on y arrive par « Personnages prétirés » et l'onglet des Règles.
- « Personnages prétirés » mène à `personnages/#pretires`, la section Prétirés de `/personnages/` (R320 (4) ; skill `zone-personnages-liste`). Une ancre ne change ni la rubrique ni la page courante : `courantDe` (`menu-rendu.mjs`) l'ignore pour `aria-current="page"`. Seule entrée du plan à porter une ancre.
- Niveaux (`niveau`, R319 (3)) : appliqués, accès cumulatif Créateur ⊃ MJ ⊃ Joueur ⊃ Observateur (`lib/compte.mjs#niveauSuffit` ; `nav.mjs#NIVEAUX_DU_MENU` en est la suite sans Observateur, `test/compte.test.mjs` compare).
  - Le build écrit le menu d'un Observateur : le bouton d'une rubrique et l'entrée à niveau portent `data-niveau-menu` et `hidden` (jamais `data-niveau`, que d'autres pages emploient) ; `montree` n'est jamais une rubrique à niveau. `entreesVisibles` retire `devSeulement` (build de production, version portable) et `prodSeulement` (menu du profil : « Site de dev », production seulement) ; ces deux-là restent au build. `sansNiveau` retire tout `niveau` (version portable).
  - Le navigateur : `scripts/compte.mjs` applique le niveau vu après son UNIQUE `GET /api/moi/` (jamais de second appel) aux seuls `.nav-group__toggle[data-niveau-menu]`, `[data-menu-site] [data-niveau-menu]` et `[data-categorie]` de sa zone `[data-compte]`, jamais à tout le document ; il annonce ensuite `maverick:niveau` (`document`) et `window.maverickNiveau`, qu'écoute le script en ligne de `MenuDuSite.astro` : lui seul décide de l'affichage des listes et titres de rubrique (qui ne portent aucun niveau). Sans réponse, hors ligne ou non-membre : Observateur.
  - Masquer un lien ne protège pas la page : la protection reste celle du serveur (R310 (3)).
- Les chemins de Découvrir et du Guide du MJ sont ceux de `lib/livres.mjs`, recopiés dans `nav.mjs` ; ceux des onglets des Règles, ceux de `regles_onglet` : `test/livres.test.mjs` et `test/nav.test.mjs` les comparent.
- Rubrique courante (`rubriqueCourante`) : la page d'une entrée, sinon l'entrée du plan (`entree` de `Base.astro`, jamais l'adresse), sinon le plus long début d'adresse (`autres` compris : `ressources/familiers/` est du Jeu, `ressources/` des Ressources). L'accueil, le Glossaire, la Recherche et `/profil/` n'en ont aucune : le menu du Jeu est montré.
- Une entrée sans adresse est « bientôt » (grisée, sans lien) : la page n'existe pas, on n'invente rien.
- Une page renommée : `PAGES_RENOMMEES` (404, `nouvelleAdresse`) ; une page éclatée : `adresseEclatee`, `adresseDeRenvoi`, `RENVOIS_DES_PAGES_ECLATEES` reçus par `data-eclatees` (skill `zone-equipement`). Adresses du wiki : skill `site-wiki-liens`.

## Résolution d'une entrée

Un seul endroit : `lib/menu-db.mjs#menuDuSite(entrées)`, appelé par `Base.astro` (une fois par rubrique) et `MenuDuProfil.astro`. Contrat d'une entrée : `motCle` (id entier), `libelleArbo`, `onglet` (id de `regles_onglet`), `path` (repli), `enfants`.
- Adresse : celle de l'onglet, puis l'`url` du mot-clé, puis `path`.
- Libellé : `libelleArbo` (dix entrées gardent le nom de l'arborescence, R319 (4)), puis le titre de l'onglet, puis le libellé du mot-clé, puis `label`.
- Le lien est rendu comme la balise d'un mot-clé d'un texte (`htmlDeLEntree` : couleur, icône, infobulle sur le côté `data-placement="cote"`). Un mot-clé ou un onglet absent ne lève rien.
- `adresseDeLOnglet` est le seul endroit qui compose `regles/<id>/` : l'adresse ne suit pas encore le titre (un lot à part).
- `scripts/edition/mots-cles-vivants.mjs` ignore `[data-menu-site]` (skill `zone-mots-cles`).

## Menu latéral

- Une liste par rubrique, rendue au serveur ; cliquer une rubrique change la liste sans changer de page. La rubrique courante est marquée (`aria-current`), la rubrique montrée est enfoncée (`aria-pressed`). La page courante : `aria-current="page"`, l'onglet du plan qui y mène : `"true"`.
- Entrée à sous-pages : repli animé par `grid-template-rows`. Bouton fixe, bande réduite `--menu-bande`.
- État dans `localStorage`, clé `menu-du-site:etat`, déclarée sur la page Confidentialité ; absent ou refusé : toléré. Le menu démarre réduit, sans l'écrire, sur une page qui a son menu de gauche (`MENU_PROPRE` du script) et sur écran étroit.
- `prefers-reduced-motion` : aucune animation. `.menu-site [hidden] { display: none !important; }` est épinglé (`test/menu-du-site-css.test.mjs`).
- Sous 56 rem : un tiroir, ouvert par le bouton à trois barres ou une rubrique, fermé par le bouton, le voile, Échap ou le choix d'une entrée. Les tiroirs des classes et de la chronologie rendent `.menu-site` inerte. Surcouche déclarée : skill `ui-defilement`.

## En-tête (demandes du propriétaire)

- Le logo (`public/logo.webp`) mène à l'accueil ; la hauteur de la bande est celle du menu, la pointe de l'épée dépasse sous la bordure (`test/site-html.test.mjs`). Pas de barre de recherche (R319).
- L'en-tête suit la colonne de la page : `padding-left: var(--menu-courante)` (`:root:has`, animé comme le menu). R317 (3) est maintenu : logo aligné sur le texte, le compte ne fait jamais passer le menu à la ligne, placé par rapport à l'en-tête entier (`right` calculé sur `--menu-courante`) ; seuils : commentaire de `compte.css`. L'alignement du bouton sous la pointe de l'épée est abandonné (« Oublie c'était une mauvaise idée »).
- Le bandeau du site de dev (`.bandeau-test`) lit `--bandeau-dev` et `--texte-sur-fonce` (skill `ui-couleurs-theme`). Icônes : `favicon.png`, `apple-touch-icon.png`, tirées du logo.

## Compte et menu du profil

- Un seul `GET /api/moi/` par page (`scripts/compte.mjs`, logique de `lib/compte.mjs`, niveaux compris) ; la zone reste invisible (`data-attente`) jusqu'à la réponse, qu'il publie : `window.maverickMoi` (undefined avant son arrivée, null en cas d'échec) et l'événement `maverick:moi` sur `document` (`detail` = la réponse ou null) ; les autres scripts les lisent, sans requête ni module commun. Détail : `docs/serveur.md`, « Accès au site de dev ».
- Membre ou non-membre connecté (R313 (1) : aucun niveau, `MESSAGE_DU_NON_MEMBRE` sur `/profil/` et `/connexion/`) : les entrées du profil, au niveau du compte (le non-membre a le menu d'un Observateur). Visiteur, service muet et version portable : petit menu Glossaire et Recherche ; le non-membre et le visiteur gardent « Connexion via Discord ». Le portable ne pose que `MenuDuProfil`, sans `/profil/` ni Debug.
- « Voir le site en tant que… » : réservé au Créateur réel (lu au niveau réel, `data-niveau-reel`), un `<select>` ; le choix, gardé dans `localStorage` sous `menu-du-profil:niveau-vu` (déclarée sur Confidentialité), ne change que le menu (jamais plus que le niveau réel).
- L'état `non_membre` est celui de `lib/compte.mjs`. Le bouton de connexion (menu, `/connexion/`, `/profil/`) porte la couleur et le symbole officiels de Discord (demande du propriétaire du 2026-11-27) : fond `--discord` (skill `ui-couleurs-theme`), symbole = le tracé du « Symbol.svg » de https://discord.com/branding, sans retouche, en masque CSS (`--dessin-discord`, `compte.css` ; un élément dans le menu, `::before` sur les pages). Le nom et le libellé sont masqués à l'œil par `clip-path`, jamais par `display:none` (accessibilité).

## Tests

- `nav` (plan dont « Mes personnages », l'ancre `#pretires` et l'id de la section, renvois), `livres` (accord avec le plan), `menu-db` (résolution), `menu-rendu` (HTML, `courantDe` et l'ancre), `menu-du-site-script` et `menu-du-profil-script` (faux navigateur), `menu-du-site-css`, `mots-cles-vivants-menu`, `compte` (choix du menu, niveaux, `retour` filtré, un seul `GET`, profil, déconnexion), `palette-css` (couleur et empreinte du tracé de Discord), `site-html` (en-tête, logo, bande, rubrique courante), `composants-html` et `equipement-html` (le seul lien vers `/ressources/` est l'entrée Autres), `confidentialite-html` (la clé du stockage local est dite).
- `test/aide-menu-html.mjs` lit le menu d'une page construite (`rubriquesAuNiveau` dit quelles rubriques sont à niveau) : les tests `*-html` (`ceinture`, `chronologie`, `glossaire`, `bestiaire`…) s'en servent au lieu de recopier le balisage.
