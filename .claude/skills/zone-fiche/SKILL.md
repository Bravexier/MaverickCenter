---
name: zone-fiche
description: "Fiche de personnage /fiche/ (noyau) : quatre zones, règles au build (fiche-regles.mjs, regles.json), moteur pur (fiche-moteur.mjs), contrôles, couleurs, race, magies, classes, progression ; liste les sous-skills. À charger avant de lire, modifier ou relire la page, son script ou son moteur."
paths: ["client/src/pages/fiche/index.astro", "client/src/pages/fiche/regles.json.ts", "client/src/scripts/fiche.mjs", "client/src/lib/fiche-regles.mjs", "client/src/lib/fiche-moteur.mjs", "client/src/lib/fiche-controles.mjs", "client/src/styles/fiche/**", "client/src/scripts/portrait.mjs", "client/src/lib/portrait.mjs", "client/test/fiche-moteur.test.mjs", "client/test/fiche-regles.test.mjs", "client/test/fiche-controles.test.mjs", "client/test/fiche-html.test.mjs", "client/test/fiche-refonte.test.mjs", "client/test/fiche-format-retirees.test.mjs", "client/test/fiche-retraits-texte.test.mjs", "client/test/portrait.test.mjs", "docs/character-generator.md"]
user-invocable: false
---
# Fiche de personnage (noyau)

## Sous-skills
Avant de toucher un sujet, lire son skill :
- skill `zone-fiche-tiroir` : choix à faire, tiroir « Choix », bulles et parcours au clavier ;
- skill `zone-fiche-acquis` : acquis calculé (R104), entraînement, métier, fiche d'avant (`lib/fiche-format.mjs`) ;
- skill `zone-fiche-sorts` : sorts, NM, coûts, sort préparé, invocations ;
- skill `zone-fiche-equipement` : armes (R167) et maîtrises, sac, ceinture, accessoires ;
- skill `zone-fiche-armure` : armure (de base ou élémentaire, poids portable), bouclier, défense et dégâts reçus ;
- skill `zone-fiche-situation` : postures, Mode Hyper, résistances.
Autres : format d'une fiche, section 13, retraits R42, base vivante (skill `zone-fiches-base`, skill `zone-service`) ; tableur (skill `zone-fiche-tableur`) ; liste `/personnages/` (skill `zone-personnages-liste`).

## Fichiers
- Page `client/src/pages/fiche/index.astro` (`/fiche/`, `/fiche/?id=<id>`), CSS `styles/fiche/fiche.css`, script `src/scripts/fiche.mjs` (DOM, enregistrement, autocomplétion `#autocompletion`).
- Règles au build : `lib/fiche-regles.mjs` → `/fiche/regles.json` (`pages/fiche/regles.json.ts`). Calculs purs : `lib/fiche-moteur.mjs`. Libellés des contrôles : `lib/fiche-controles.mjs`.
- Portrait : `src/scripts/portrait.mjs` + `lib/portrait.mjs`, partagés avec le mode modification du bestiaire.

## À lire
- `docs/character-generator.md`, « La page `/fiche/` » : le détail de chaque bloc, à lire avant d'y toucher ; « Fiches dans la base » : tables et vues.
- `docs/decisions-regles.md` pour le texte exact de chaque R….

## Invariants
- Les règles de la page viennent de la base au build (`lib/fiche-regles.mjs`), jamais écrites à la main. Rien n'y est recalculé ; seuls les lecteurs de textes (`lib/*-texte.mjs`, `maitrise-arme.mjs`, `accessoire-champs.mjs` : voir les sous-skills) lisent des textes. Les balises du glossaire sont retirées de tout texte lu, avant les lectures et dans le JSON (skill `zone-mots-cles`).
- Chaque calcul de `lib/fiche-moteur.mjs` cite sa source (fiche auto V15.2.2, guide, décisions) et a son test, comparé aux vues SQL s'il y en a.
- Les contrôles qui font foi sont ceux de `v_personnage_controle` (rendus par le service). Toute règle ajoutée à la vue a son libellé dans `lib/fiche-controles.mjs` (`test/fiche-controles.test.mjs`). Ils signalent, ils n'empêchent jamais d'enregistrer ; toute fiche est contrôlée, même inachevée (plus de statut, migration `0038-personnage-sans-statut`).
- Une colonne ajoutée à la section 13 entre dans le JSON d'une fiche sans toucher au service ; la page lui donne un champ.
- La fiche ne crée que des prétirés : création et modification sur un écran, enregistrement par le service (`/api/`). Suppression : `DELETE /api/personnages/<id>/` avec sa version.
- `/generateur/` n'existe plus : la page 404 y renvoie (`lib/nav.mjs#nouvelleAdresse`, `PAGES_RENOMMEES`).
- Le script de page n'importe que des modules purs que seule cette page utilise (skill `site-version-portable`), sauf le portrait (le bestiaire qui le partage est absent de la version portable : alias vers `src/scripts/edition-absente.mjs`, skill `zone-bestiaire`, « Portrait »). Ni `lib/arme-forge.mjs` ni `lib/armure-forge.mjs` (formules recopiées, un test compare), ni `lib/caracteristiques-postures.mjs`, `lib/fiche-couleurs.mjs`, `lib/class-groups.mjs`, `lib/race-kinds.mjs`, `lib/palette-css.mjs` : les noms des classes arrivent par `regles.json`.
- Rien de ce que la fiche calcule n'est stocké (skill `zone-fiches-base`).

## Choix du propriétaire

### Mise en page
- Quatre zones sans cadre ni titre visibles (maquette validée) : I identité (portrait recadrable, nom, niveau seul, race · ethnie · métier, magies, « Bi-classé » et classes) ; II à portée de main (attributs, caractéristiques et compétences, armes (bloc « Armes » : les armes 1 et 2 seulement), ceinture, sorts, dons débloqués et entraînement ; sur grand écran, `min-width: 64rem`, aires `'attr attr' 'car col' 'sor don'` de `fiche.css` : la colonne `.zp-colonne` (aire `col`), les armes puis la ceinture dessous, à côté des caractéristiques et compétences, puis sorts et dons : choix du propriétaire du 2026-10-23, mot pour mot : « Il faudrai séparer les arme et les maitrises . Garder l'armes visibles à coté des caractéristiques comme avant. La partie maitrise d'arme vont déscendre dans l'encart des "choix" », qui remplace « Caractéristiques d'abord » (armes et maîtrises en pleine largeur, du même jour) ; l'ordre du DOM, donc du clavier, des écrans moyens et des téléphones : attributs, compétences, armes, ceinture, sorts, dons) ; III selon la situation (postures et Mode Hyper, armure avec défense et dégâts reçus, accessoires, inventaire juste en dessous, initiative et vitesses, résistances, bouclier) ; IV paramètres et suivi en onglets (progression, choix — avec le bloc des maîtrises d'armes sur toute la largeur du panneau, sous ses deux piles (`.choix-maitrises`, même demande) —, notes, contrôle ; `components/Onglets.astro`, un panneau caché seulement sous `html.js` : skill `ui-onglets`).
- Page compacte, sans lien vers le guide : choix en menus déroulants (`<details class="choix">`), races, magies et classes en pastilles ; caractéristiques à 1 par défaut, jamais vides (`caracteristiquesCompletes`), naturel des compétences en curseurs ; clic droit ou Entrée sur un curseur = saisie bornée (`borner`).
- Caractéristiques sur une ligne, deux cases de croix chacune (R19), score « N/A » à deux croix. Compétences sur deux colonnes remplies de haut en bas.
- Attributs sans texte de calcul (détail en infobulle) ; valeurs du moment en curseurs dans leurs cartes, maximum et boutons + et − (`ajusterValeurDuMoment`). Chakra actuel ≤ chakra − corruption pour tous, Corruption innée ou acquise comprise (R142 ; la mort au maximum n'est épargnée qu'à la Corruption innée ou acquise, pas au Potentiel Illimité, R146), infobulles comprises (`valeursDuMoment`). Initiative, vitesse et nage en tuiles.
- Alignement calculé à côté de ses quatre scores (`alignementDe`, guide « Alignement »). Jauge d'XP en tête du bloc de progression (`progressionXp`).
- Portrait recadré dans un `<dialog>`, gardé en data URL avec son cadrage (`docs/character-generator.md`, « Portrait »).

### Couleurs (skill `ui-couleurs`)
- Toujours des classes de la palette, jamais un style ni un hex. `regles.json` donne `classe` (et `classe_2` pour une magie) de chaque magie, caractéristique, posture, alignement, race (sa nature), classe (sa catégorie de `/classes/`), palier (`resistance_paliers[].classe`), poids de bouclier (skill `zone-fiche-armure`), de `mode_hyper` et `mode_hyper.cent`, plus `caracteristique_par_defaut`, `alignement_par_defaut`, `race_par_nature` et `neutre` (`couleur-neutre-par-defaut`). Le script ne lit aucune couleur : il pose `teinte-palette` et la classe (`teinteDe`, `poserTeinte` ; `pastille()`, `groupe()`, `afficherChoix()` par `teinte`), qui font lire `--c`, `--c-texte`, `--texte-sur-c` ; jamais `--c` en style. Éléments teintés : `docs/character-generator.md`, « Couleurs des cadres » et paragraphe « Une fiche enregistrée se supprime ».
- Cadres des blocs (eux seuls) : la magie innée en dégradé vers l'acquise ; le script pose la classe de l'innée et la classe de second rang de l'acquise, ou de l'innée (`poserTeinte`), lues en `--couleur` et `--couleur-2`.
- Zones : chacune porte la classe de sa partie du guide (`.couleur-partie-<id>`, `palette-css.mjs#classeDePartie`, posée par la page, `classeDeZone` ; famille `partie` de `FAMILLES_DE_LA_FICHE`), lue en `--etape`, jamais un style. Les cadres gardent la magie innée : `fiche.css` la lit sur `.fiche` (`--couleur-de-la-fiche`, `--couleur-texte-de-la-fiche`), que retrouvent les enfants directs d'une zone (`:where(.fiche-zone[class*='couleur-partie-']) > *`).
- L'alignement porte la classe de « Neutre » dès le HTML construit. La page émet `cssDesFamilles(FAMILLES_DE_LA_FICHE)`.
- Neutre (magie acquise « Aucune », objet de départ au choix, ethnie sans race) : `couleur-neutre-par-defaut` (choix du propriétaire, « Gris neutre du site »). Ethnie, spécialité, dons d'une classe : la classe de leur race ou classe.
- Attributs : santé rouge, barrière jaune, chakra bleu, corruption noire (`lib/attributs-couleurs.mjs`, `--attribut-<clé>` posé par `layouts/Base.astro`). La 4ᵉ barre prend la couleur de la magie qui la donne, Sang ou Nécromancie (demande du propriétaire) : `attributsDe` rend `quatriemeBarre.magie_id` et `.classe`, lue depuis la magie, jamais depuis le nom de la ressource ; le script la pose sur la carte `data-a='barre4'` à chaque calcul (la carte n'est pas reconstruite), `fiche.css` en tire `--a: var(--couleur)` ; plus de couleur d'attribut `barre4` (`test/fiche-moteur.test.mjs`, `alchimie-couleurs.test.mjs`).
- Couleurs d'interface : des jetons du thème (`styles/global/base.css` : `--vert-action`, lu en `--vert`, `--a-choisir`, `--a-choisir-plein`, `--etoile`, `--texte-sur-fonce` : rôles dans le doc) ; le compteur d'un onglet (`.onglet__compte`) lit `--texte-sur-danger` en rouge (Contrôle), `--texte-sur-good` pour « ✓ », `--texte-sur-fonce` pour les choix en attente ; `fiche.css` et `scripts/fiche.mjs` n'écrivent aucune couleur, hors le noir de mélange (`test/palette-css.test.mjs`).

### Race, magies, classes
- L'Archimage n'est ouverte qu'au Potentiel Illimité inné, qui l'impose en classe 1 et l'y verrouille (R23 : `classe.magie_innee_id`, migration `0015-archimage-potentiel-illimite`, règles `classe_reservee` / `classe_imposee`, `classesSelonLaMagieInnee`).
- Le Mage Bleu est fermé au Potentiel Illimité (R25 : `classe.magie_innee_exclue_id`, migration `0020-mage-bleu-potentiel-illimite`, règle `classe_exclue`).
- La Lamia n'a pas de magie acquise (R28 : `race.mono_magie`, migration `0022-lamia-une-seule-magie`, règle `race_mono_magie`).
- Une ethnie sans choix se pose d'office (`ethnieImposee`) ; une magie acquise que la race ou l'innée ferme part d'office (`magieAcquiseValable`).
- Un don à choix d'une classe ou d'une spécialité retirée part avec elle, comme un don qu'aucun choix des règles ne range (supprimé sur le site de dev, devenu reçu d'office : D11) (`donsValables`).
- Dons : le rappel des dons de race (don de base, don de l'ethnie, ligne du tableau de la race : `donsDeRace`) puis des dons de classe débloqués (`donsAcquis`) ; Méditation ou Repos au lieu de « Don de base » (`donDeBase`).

### Progression
- Gains de niveau en deux totaux, santé et chakra, avec « Total attribué : T / à saisir : Y » ou « entre Ymin et Ymax » (R73 : `gainsAttendus`, `gainsDeNiveau`, lus dans les cumuls de `v_niveau` passés par `regles.niveaux`, jamais 15 × (N − 1) en dur ; accord avec la règle SQL `gains_niveau` testé aux niveaux 1 à 20).

## Tests
- `test/fiche-moteur.test.mjs` (contre les vues et le fil rouge du guide), `fiche-regles`, `fiche-controles`, `fiche-refonte`, `fiche-format-retirees`, `fiche-retraits-texte`, `fiche-html` (site construit).
- `test/palette-css.test.mjs` (zones : `--etape`, magie innée des enfants, lisibilité de leur texte dans les deux thèmes), `fiche-html` (classe de la partie de chaque zone, plus de `--etape` en style).
- `portrait.test.mjs` : format accepté, bornes du cadrage, empreinte (le portrait d'une fiche ou d'une carte de monstre).
- Fiches dans une copie de la base : `test/personnages-db.test.mjs` (skill `zone-fiches-base`). Les tests de chaque sujet : dans son sous-skill.
