---
name: zone-fiche
description: "Fiche de personnage /fiche/ (noyau) : quatre zones, règles au build (fiche-regles.mjs, regles.json), moteur pur (fiche-moteur.mjs), contrôles, couleurs, race, magies, classes, progression ; liste les sous-skills. À charger avant de lire, modifier ou relire la page, son script ou son moteur."
paths: ["client/src/pages/fiche/index.astro", "client/src/pages/fiche/regles.json.ts", "client/src/scripts/fiche.mjs", "client/src/lib/fiche-regles.mjs", "client/src/lib/fiche-moteur.mjs", "client/src/lib/fiche-controles.mjs", "client/src/styles/fiche/**", "client/src/scripts/portrait.mjs", "client/src/lib/portrait.mjs", "client/src/scripts/liste-choix.mjs", "client/src/lib/liste-choix.mjs", "client/test/fiche-moteur.test.mjs", "client/test/fiche-regles.test.mjs", "client/test/fiche-controles.test.mjs", "client/test/fiche-html.test.mjs", "client/test/fiche-refonte.test.mjs", "client/test/fiche-format-retirees.test.mjs", "client/test/fiche-retraits-texte.test.mjs", "client/test/portrait.test.mjs", "client/test/liste-choix.test.mjs", "client/test/liste-choix-script.test.mjs", "client/test/fiche-listes-infobulles.test.mjs", "docs/character-generator.md"]
user-invocable: false
---
# Fiche de personnage (noyau)

## Sous-skills
Avant de toucher un sujet, son skill :
- skill `zone-fiche-tiroir` : choix à faire, tiroir « Choix », bulles, clavier ;
- skill `zone-fiche-acquis` : acquis (R104), entraînement, métier, fiche d'avant (`lib/fiche-format.mjs`) ;
- skill `zone-fiche-sorts` : sorts, NM, coûts, sort préparé, invocations ;
- skill `zone-fiche-equipement` : armes (R167), maîtrises, sac, ceinture, accessoires ;
- skill `zone-fiche-armure` : armure, bouclier, défense et dégâts reçus ;
- skill `zone-fiche-situation` : postures, Mode Hyper, résistances.
Autres : format d'une fiche, section 13, retraits R42, base vivante (skills `zone-fiches-base`, `zone-service`) ; tableur (`zone-fiche-tableur`) ; `/personnages/` (`zone-personnages-liste`).

## Fichiers
- Page `pages/fiche/index.astro` (`/fiche/`, `/fiche/?id=<id>`), CSS `styles/fiche/fiche.css`, script `scripts/fiche.mjs` (DOM, enregistrement, autocomplétion `#autocompletion`).
- Règles au build : `lib/fiche-regles.mjs` → `/fiche/regles.json`. Calculs purs : `lib/fiche-moteur.mjs`. Libellés des contrôles : `lib/fiche-controles.mjs`. Portrait : `scripts/portrait.mjs` + `lib/portrait.mjs`, partagés avec le bestiaire.

## À lire
- `docs/character-generator.md`, « La page `/fiche/` » : le détail de chaque bloc, à lire avant d'y toucher ; « Fiches dans la base » : tables et vues.
- `docs/decisions-regles.md` : le texte de chaque R….

## Invariants
- Les règles de la page viennent de la base au build (`lib/fiche-regles.mjs`), jamais écrites à la main. Rien n'y est recalculé ; seuls les lecteurs de textes (`lib/*-texte.mjs`, `maitrise-arme.mjs`, `accessoire-champs.mjs`) lisent des textes. Les balises du glossaire sont retirées de tout texte lu, avant les lectures et dans le JSON (skill `zone-mots-cles`).
- Chaque calcul de `lib/fiche-moteur.mjs` cite sa source (fiche auto V15.2.2, guide, décisions) et a son test, comparé aux vues SQL s'il y en a.
- Les contrôles sont ceux de `v_personnage_controle` (rendus par le service). Toute règle ajoutée à la vue a son libellé dans `lib/fiche-controles.mjs` (`test/fiche-controles.test.mjs`). Ils signalent, ils n'empêchent jamais d'enregistrer. Une règle est une erreur, sauf celles de `GRAVITES_DES_CONTROLES` (`maitrise_plafond`, avertissement : R170, skill `zone-fiche-equipement`), rangées après les erreurs (`controlesParGravite`) : la vue SQL n'a pas de gravité. Toute fiche est contrôlée, même inachevée (plus de statut, migration `0038-personnage-sans-statut`).
- Une colonne ajoutée à la section 13 entre dans le JSON d'une fiche sans toucher au service ; la page lui donne un champ.
- La fiche ne crée que des prétirés : création et modification sur un écran, enregistrement par le service (`/api/`). Suppression : `DELETE /api/personnages/<id>/` (avec sa version).
- `/generateur/` n'existe plus : la page 404 y renvoie (`lib/nav.mjs#nouvelleAdresse`, `PAGES_RENOMMEES`).
- Le script de page n'importe que des modules purs que seule cette page utilise (skill `site-version-portable`), `scripts/liste-choix.mjs` et `lib/liste-choix.mjs` compris (propres à la page), sauf le portrait (alias vers `src/scripts/edition-absente.mjs` dans la version portable : skill `zone-bestiaire`, « Portrait »). Ni `lib/arme-forge.mjs` ni `lib/armure-forge.mjs` (formules recopiées, un test compare), ni `lib/caracteristiques-postures.mjs`, `lib/fiche-couleurs.mjs`, `lib/class-groups.mjs`, `lib/race-kinds.mjs`, `lib/palette-css.mjs` : les noms des classes arrivent par `regles.json`.
- Rien de ce que la fiche calcule n'est stocké (skill `zone-fiches-base`).

## Choix du propriétaire

### Mise en page
- Quatre zones sans cadre ni titre visibles (maquette validée) : I identité (portrait recadrable, nom, niveau seul, race · ethnie · métier, magies, « Bi-classé » et classes) ; II à portée de main (attributs, dont la 2ᵉ ligne de leur tuile (demande du propriétaire) : AP, AM, initiative, vitesse, nage, puis les dégâts reçus (skill `zone-fiche-armure`) ; caractéristiques et compétences, armes (bloc « Armes » : les armes 1 et 2 seulement), ceinture, **actions** (`#etape-actions`, sous la ceinture ; « Fin de combat » remet les compteurs par combat et lâche aussi le sort préparé (`finDeCombat`, R179, Q86) ; montré dès qu'un compteur par combat existe ou qu'un sort est préparé : `finDeCombatMontree`), sorts, **passifs** (`#etape-passifs`, aire `don`, remplace « Dons débloqués ») ; grand écran, `min-width: 64rem`, aires `'attr attr' 'car col' 'sor don'` de `fiche.css` : la colonne `.zp-colonne` (aire `col`), armes, ceinture puis actions (« Garder l'armes visibles à coté des caractéristiques comme avant ») ) ; III selon la situation (postures et Mode Hyper, armure sans la défense, accessoires, inventaire juste en dessous, résistances, bouclier) ; IV paramètres et suivi en onglets (progression, choix — avec le bloc des maîtrises d'armes sur toute la largeur du panneau, sous ses deux piles (`.choix-maitrises`) —, **entraînement** (après « Choix » : skill `zone-fiche-acquis`), notes, contrôle ; `components/Onglets.astro` : skill `ui-onglets`).
- Les tuiles de choix (classe, spécialité, don à choisir) ont une infobulle, le texte de la base tel qu'écrit (demande du propriétaire), au survol et au focus : `infobulleDeClasse` (sa `description`), `infobulleDeSpecialite` (sa `description`, sinon l'effet de son cartouche, sinon aucune infobulle : choix du propriétaire), `infobulleDuDonAChoisir` (le texte du don : `texteDuDon`, type et précision d'abord). `regles.json` exporte `classes[].description` et `classes[].specialites[].description` (`lib/fiche-regles.mjs`) (`test/fiche-regles.test.mjs`). L'infobulle d'un don à choisir est posée sur l'option et sur son rond (clavier : skill `ui-infobulles`).
- Listes avec infobulle (demande du propriétaire : « Il faudrai également une infobulle au survol des choix pour voir ce qu'ils apportent. », « Liste personnalisée ») : les menus du métier, des sorts (emplacements, sort préparé, livres), des armes et de l'armure sont des listes du site (`scripts/liste-choix.mjs#listeDeChoix`), chaque option avec l'infobulle du site, du texte de la base seul ; « Dieu choisi » reste natif. Le `<select>` caché garde la valeur (`input` puis `change`). Chaque liste reçoit une clé fixe (`{ cle }` : `sort-<n>`, `sort-prepare`, `livre-<rang>`, `arme-<rang>`, `armure`, `metier`), jamais tirée du libellé : une liste refaite reprend le focus. Clavier : skill `ui-infobulles` ; détail : `docs/character-generator.md`, « Listes avec infobulles ».
- Page compacte, sans lien vers le guide : menus `<details class="choix">`, races, magies et classes en pastilles ; caractéristiques à 1 par défaut (`caracteristiquesCompletes`), naturel des compétences en curseurs ; clic droit ou Entrée sur un curseur : saisie bornée (`borner`).
- Caractéristiques sur une ligne, deux cases de croix chacune (R19), score « N/A » à deux croix. Compétences sur deux colonnes remplies de haut en bas.
- Attributs sans texte de calcul (détail en infobulle) ; valeurs du moment en curseurs dans leurs cartes, maximum et boutons + et − (`ajusterValeurDuMoment`). Chakra actuel ≤ chakra − corruption pour tous, Corruption innée ou acquise comprise (R142 ; la mort au maximum n'est épargnée qu'à la Corruption innée ou acquise, pas au Potentiel Illimité, R146) (`valeursDuMoment`). La santé du moment n'a pas de plancher (R171 : « Peut devenir négative » ; `min: null`) ; les autres jauges, barrière comprise, restent ≥ 0.
- Alignement calculé à côté de ses quatre scores (`alignementDe`). Jauge d'XP en tête de la progression (`progressionXp`).
- Portrait recadré dans un `<dialog>`, gardé en data URL avec son cadrage (`docs/character-generator.md`, « Portrait »).

### Couleurs (skill `ui-couleurs`)
- Toujours des classes de la palette, jamais un style ni un hex. `regles.json` donne `classe` (et `classe_2` pour une magie) de chaque magie, caractéristique, posture, alignement, race (sa nature), classe (sa catégorie), palier (`resistance_paliers[].classe`), poids de bouclier (skill `zone-fiche-armure`), de `mode_hyper` et `mode_hyper.cent`, plus `caracteristique_par_defaut`, `alignement_par_defaut`, `race_par_nature` et `neutre` (`couleur-neutre-par-defaut`). Le script ne lit aucune couleur : il pose `teinte-palette` et la classe (`teinteDe`, `poserTeinte` ; `pastille()`, `groupe()`, `afficherChoix()` par `teinte`), qui font lire `--c`, `--c-texte`, `--texte-sur-c` ; jamais `--c` en style. Éléments teintés : `docs/character-generator.md`, « Couleurs des cadres ».
- Cadres des blocs (eux seuls) : la magie innée en dégradé vers l'acquise ; le script pose la classe de l'innée et celle de second rang de l'acquise, ou de l'innée (`poserTeinte`), lues en `--couleur` et `--couleur-2`.
- Zones : chacune porte la classe de sa partie du guide (`.couleur-partie-<id>`, `palette-css.mjs#classeDePartie`, `classeDeZone`, famille `partie`), lue en `--etape`, jamais un style. Les cadres gardent la magie innée : `fiche.css` la lit sur `.fiche` (`--couleur-de-la-fiche`, `--couleur-texte-de-la-fiche`) pour les enfants directs d'une zone (`:where(.fiche-zone[class*='couleur-partie-']) > *`).
- Neutre (magie acquise « Aucune », objet de départ au choix, ethnie sans race, alignement dès le HTML construit) : `couleur-neutre-par-defaut` (choix du propriétaire, « Gris neutre du site »). Ethnie, spécialité, dons d'une classe : la classe de leur race ou classe. La page émet `cssDesFamilles(FAMILLES_DE_LA_FICHE)`.
- Attributs : santé rouge, barrière jaune, chakra bleu, corruption noire (`lib/attributs-couleurs.mjs`). La 4ᵉ barre prend la couleur de la magie qui la donne, Sang ou Nécromancie (demande du propriétaire) : `attributsDe` rend `quatriemeBarre.magie_id` et `.classe`, lues dans la magie, jamais dans le nom de la ressource ; le script la pose sur la carte `data-a='barre4'`, `fiche.css` en tire `--a: var(--couleur)` ; plus de couleur d'attribut `barre4` (`test/fiche-moteur.test.mjs`, `alchimie-couleurs.test.mjs`).
- Couleurs d'interface : des jetons du thème (`styles/global/base.css` : `--vert-action`, lu en `--vert`, `--a-choisir`, `--a-choisir-plein`, `--etoile`, `--texte-sur-fonce` : rôles dans le doc) ; le compteur d'un onglet (`.onglet__compte`) lit `--texte-sur-danger` (Contrôle ; sans erreur, ses avertissements en `--warn-bg` / `--warn-text`, R170), `--texte-sur-good` pour « ✓ » ; `fiche.css` et `fiche.mjs` n'écrivent aucune couleur, hors le noir de mélange (`test/palette-css.test.mjs`).

### Race, magies, classes
- L'Archimage n'est ouverte qu'au Potentiel Illimité inné, qui l'impose en classe 1 et l'y verrouille (R23 : `classe.magie_innee_id`, migration `0015-archimage-potentiel-illimite`, règles `classe_reservee` / `classe_imposee`, `classesSelonLaMagieInnee`).
- Le Mage Bleu est fermé au Potentiel Illimité (R25 : `classe.magie_innee_exclue_id`, migration `0020-mage-bleu-potentiel-illimite`, règle `classe_exclue`).
- La Lamia n'a pas de magie acquise (R28 : `race.mono_magie`, migration `0022-lamia-une-seule-magie`, règle `race_mono_magie`).
- Une ethnie sans choix se pose d'office (`ethnieImposee`) ; une magie acquise que la race ou l'innée ferme part d'office (`magieAcquiseValable`).
- Un don à choix d'une classe ou d'une spécialité retirée part avec elle, comme un don qu'aucun choix des règles ne range (D11 : `donsValables`).
- Dons de race (`donsDeRace`) et de classe débloqués (`donsAcquis`) ; Méditation ou Repos au lieu de « Don de base » (`donDeBase`).
- Actions et passifs (R173 : `actionsDeLaFiche`, `passifsDeLaFiche`). Le nom d'une action à compteur est le bouton qui la consomme ; grisée par `aria-disabled`, avec la raison écrite et sans opacité sur son texte (contraste). Une action qui quitte la liste rend le focus à sa voisine (`rendreLeFocusDesActions`) : la ligne `tabindex="-1"`, jamais un bouton. L'ordre sur téléphone (actions, sorts, passifs) est gardé (« Garder l'ordre actuel »). Équipement, clés : skill `zone-fiche-equipement` ; Symbiose : `zone-fiche-situation`.

### Progression
- Gains de niveau en deux totaux, santé et chakra, avec « Total attribué : T / à saisir : Y » ou « entre Ymin et Ymax » (R73 : `gainsAttendus`, `gainsDeNiveau`, lus dans les cumuls de `v_niveau` par `regles.niveaux`, jamais 15 × (N − 1) en dur ; accord avec la règle SQL `gains_niveau` testé aux niveaux 1 à 20).

## Tests
- `test/fiche-moteur.test.mjs` (contre les vues et le fil rouge du guide), `fiche-regles`, `fiche-controles`, `fiche-refonte`, `fiche-format-retirees`, `fiche-retraits-texte`, `fiche-html` (site construit).
- `test/palette-css.test.mjs` (zones : `--etape`, magie innée des enfants, lisibilité dans les deux thèmes) ; `portrait.test.mjs` ; `liste-choix.test.mjs`, `liste-choix-script.test.mjs` et `fiche-listes-infobulles.test.mjs` (la liste du site, ses menus).
- Fiches dans une copie de la base : `test/personnages-db.test.mjs` (skill `zone-fiches-base`). Tests de chaque sujet : dans son sous-skill.
