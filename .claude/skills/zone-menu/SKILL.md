---
name: zone-menu
description: "Menu du site (lib/nav.mjs : rubriques, entrées « bientôt », devSeulement, PAGES_RENOMMEES, renvois de la page 404) et en-tête (layouts/Base.astro, site-shell.css, logo et icônes). À charger avant de lire, modifier ou relire le menu, l'en-tête ou leurs tests."
paths: ["client/src/lib/nav.mjs", "client/src/layouts/Base.astro", "client/src/components/Acces.astro", "client/src/components/Compte.astro", "client/src/styles/global/acces.css", "client/src/styles/global/compte.css", "client/src/scripts/compte.mjs", "client/src/lib/compte.mjs", "client/src/pages/profil.astro", "client/src/pages/connexion.astro", "client/test/compte.test.mjs", "client/src/styles/global/site-shell.css", "client/public/logo.webp", "client/public/favicon.png", "client/public/apple-touch-icon.png", "client/test/nav.test.mjs"]
user-invocable: false
---
# Menu et en-tête

## Fichiers

- Menu : `client/src/lib/nav.mjs` (`NAV`, `entreesDuMenu`, `activeGroup`, `groupIsCurrent`, `legacyWikiRedirect`, `PAGES_RENOMMEES`, `nouvelleAdresse`, `adresseEclatee`, `adresseDeRenvoi`, `cheminVersUnePageEclatee`), `client/src/layouts/Base.astro`.
- En-tête : `layouts/Base.astro`, `styles/global/site-shell.css`, `public/logo.webp`, `public/favicon.png`, `public/apple-touch-icon.png`.

`Base.astro` porte aussi des scripts d'autres zones : infobulles (skill `ui-infobulles`), maintenance (skill `zone-maintenance`) et bandeau du site de dev (skill `zone-mise-a-jour`), balise des métriques (skill `zone-debug-metriques`), avis d'accès au site de dev (`components/Acces.astro`, `styles/global/acces.css` ; skill `site-version-portable`), feuille des mots-clés colorés et couleur de `<main>` (skill `zone-mots-cles-liens`).

## À lire

- `docs/feuille-de-route.md` : rubriques « bientôt » et visibilité future du menu.

## Menu (arborescence du propriétaire)

- Sept rubriques, dans l'ordre (clé) :
  - Règles (`regles`, la vitrine, l'accueil l'ouvre) : Découvrir (`/decouvrir/`), L'univers, puis les 4 onglets Fiche de personnage, Mécaniques générales, Les combats, Exploration (`/regles/<onglet>/`) (R184), puis Glossaire (`/regles/glossaire/`, réponse Q6 du propriétaire ; pas un onglet du plan : skill `zone-glossaire`). Plus de « Créer son personnage », « Les bases », « Règles avancées », « Liens » ni « Rejoindre une partie » (demandes du propriétaire) ; aucun onglet « Autre ». `autres: ['regles/']` : toute page sous `regles/` (pages des onglets à plat, Artisanat) ouvre les Règles. L'onglet marqué sur ces pages (`entree` de `Base.astro`, `aria-current`) vient du plan de la base (skill `zone-guide`), jamais de l'adresse.
  - Personnage (`personnage`) : Races, Magies, Classes, Métiers, Familiers. Familiers mène à `ressources/familiers/` ; son libellé est le titre de la page dans la base, comparé par `test/nav.test.mjs` (réponse du propriétaire : « Famillier devrai être dans Personnage, Le reste dans equipement (sous menu-autres pour commencer) »).
  - Équipement (`equipement`) : une entrée par page de l'équipement, sans ancre (libellé et adresse de `PAGES_DE_L_EQUIPEMENT` : Armes, Armures, Boucliers, Ceinture, Accessoires), puis Livres & Parchemins et « Autres » (`/ressources/`) : la liste de toutes les pages de ressources, provisoire (« pour commencer »). Plus d'entrée unique « Équipement » ni d'onglets de page (skill `zone-equipement`).
  - Espace joueur, Espace MJ, Codex, Outils.
- Plus d'entrée « Pièces élémentaires » (demande du propriétaire) : sa page n'est plus construite, son texte est sur Armes et Armures (skill `zone-equipement`).
- Rien n'est caché. À terme, les non-membres ne verront que les deux premières rubriques, « Règles et Personnage » (réponse du propriétaire ; `docs/feuille-de-route.md`).
- Une page ouvre la rubrique dont une entrée (sans son ancre) ou un début d'adresse `autres` est le plus long début de son adresse (`activeGroup`, `groupIsCurrent`). Une seule rubrique est courante.
- Une entrée sans `path` est affichée « bientôt » : la page n'existe pas encore, on n'invente pas de contenu.
- `autres` = débuts d'adresse des pages de la rubrique hors menu (`capacites/` ouvre le Personnage). `ressources/` ouvre l'Équipement, sauf Familiers, qui ouvre le Personnage par le plus long début d'adresse.
- `devSeulement` : entrée du site de dev seulement (Debug), retirée par `entreesDuMenu` d'un build `SITE_MODE=prod` et de la version portable.
- Les chemins de Découvrir et du Guide du MJ sont ceux de `lib/livres.mjs`, recopiés dans `nav.mjs`, qui n'importe rien (le script de la page 404 l'importe) : `test/livres.test.mjs` vérifie leur accord. Les libellés et chemins des onglets sont ceux de la table `regles_onglet` (libellé = titre, chemin = `regles/<id>/`, ordre) : `test/nav.test.mjs` et `test/livres.test.mjs` les comparent aux entrées `items.slice(2, -1)` des Règles (ni Découvrir, ni L'univers, ni Glossaire).
- Artisanat (`/regles/artisanat/`) n'est plus au menu Équipement : c'est une entrée du menu latéral d'Exploration (R184). Composants reste dans l'Équipement, son fil d'Ariane mène à l'Artisanat.
- Une page renommée : son ancienne adresse dans `PAGES_RENOMMEES` (renvoyée par la page 404 via `nouvelleAdresse`) ; il n'y reste que `baton-magique` pour l'équipement. Une page éclatée en plusieurs (l'ancienne `ressources/equipement/`, `ressources/pieces-elementaires/`) : `adresseEclatee` et `adresseDeRenvoi`, avec les renvois `RENVOIS_DES_PAGES_ECLATEES` que la page 404 reçoit par `data-eclatees` (`nav.mjs` n'importe rien) ; règles : skill `zone-equipement`. Adresses du wiki et du guide : skill `site-wiki-liens`.

## En-tête (demandes du propriétaire)

- Le logo officiel (`public/logo.webp`, redimensionné) remplace le titre et mène à l'accueil.
- Les rubriques sont sur la même bande, à droite du logo ; les entrées de la rubrique dessous. Sous 60rem, le menu passe sous le logo.
- Pas de barre de recherche : la recherche est une page du menu Outils, mêlée aux mots-clés (skill `zone-recherche`).
- La hauteur de la bande est celle du menu, pas du logo : l'image est en absolu dans le lien, qui garde sa largeur, et la pointe de l'épée dépasse sous la bordure (`test/site-html.test.mjs`).
- Le bandeau du site de dev (`.bandeau-test` de `site-shell.css`) lit les jetons `--bandeau-dev` et `--texte-sur-fonce` (skill `ui-couleurs-theme`).
- Le compte du visiteur est à droite de l'en-tête : `Base.astro` pose `components/Compte.astro` (R310 (7) ; absent du portable et de la page de maintenance). Un seul script, `scripts/compte.mjs` (logique : `lib/compte.mjs`), fait un `GET /api/moi/` par page : lien du profil (avatar, nom) ou bouton « Connexion via Discord » ; styles : `styles/global/compte.css`. Pages `/profil/` et `/connexion/` : `pages/profil.astro`, `pages/connexion.astro`. Détail : `docs/serveur.md`, « Accès au site de dev ». Plus de mention « Connecté · Se déconnecter » au pied de page.
- Le compte ne fait jamais passer le menu à la ligne (R317 (3)) : l'en-tête garde la largeur du contenu et le logo reste aligné sur le texte (« Aligner le logo sur le texte »). `.site-header__inner` est en `position: relative` ; le compte est en `position: absolute; left: 100%`, dans la marge de droite, hors du flux : il ne peut jamais pousser le menu. Seuils mesurés : au-delà de 93 rem, avatar et nom (tronqué à 10 rem) ou icône et libellé ; entre 72 et 93 rem, avatar ou icône seuls dans la marge ; sous 72 rem, le compte revient dans la ligne du menu, avatar ou icône seuls ; sous 60 rem, le menu passe sous le logo. Aucun défilement horizontal. Le nom et le libellé sont masqués à l'œil par `clip-path`, jamais par `display:none`, pour rester accessibles (`title`). Le bouton de connexion (menu, `/connexion/`, `/profil/`) porte la couleur et le symbole officiels de Discord (demande du propriétaire du 2026-11-27) : fond `--discord` (skill `ui-couleurs-theme`), symbole = le tracé du « Symbol.svg » de https://discord.com/branding, sans retouche, en masque CSS (`--dessin-discord`, `compte.css` ; un élément dans le menu, `::before` sur les pages). Tests : `test/compte.test.mjs`, `test/palette-css.test.mjs` (couleur, empreinte du tracé).
- `lib/compte.mjs` a un état `non_membre` (R313 (1)) : connecté sans être membre du serveur, aucun niveau. Son message est la constante `MESSAGE_DU_NON_MEMBRE`, affichée sur `/profil/` et `/connexion/` avec un bouton « Se déconnecter ». Le menu garde « Connexion via Discord ».
- Les icônes `favicon.png` (32 px) et `apple-touch-icon.png` sont tirées du même logo.

## Tests

- `test/nav.test.mjs` épingle le plan du menu et les renvois (pages renommées, pages éclatées) ; `test/livres.test.mjs` son accord avec `lib/livres.mjs`, et avec la table `regles_onglet` pour les onglets.
- `test/compte.test.mjs` : choix du menu, `retour` filtré comme le service, un seul `GET /api/moi/`, profil, déconnexion, messages d'erreur.
- `test/site-html.test.mjs` : en-tête, logo et icônes, hauteur de la bande, rubrique courante de Familiers et de `/ressources/`, Autres en dernière entrée (site construit, CI après le build).
- Le seul `href="/ressources/"` d'une page est l'entrée Autres (`test/composants-html.test.mjs`, `test/equipement-html.test.mjs`).
