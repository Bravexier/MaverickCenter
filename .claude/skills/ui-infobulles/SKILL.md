---
name: ui-infobulles
description: "Système unique d'infobulles du site (components/Infobulles.astro, styles/global/infobulles.css) : bulles riches data-bulle, title déplacé en data-infobulle, data-placement=\"cote\". À charger avant de lire, modifier ou relire une infobulle, un attribut title ou un script qui en lit un."
paths: ["client/src/components/Infobulles.astro", "client/src/styles/global/infobulles.css", "client/test/infobulles.test.mjs"]
user-invocable: false
---
# Infobulles

Toutes les infobulles sont habillées comme le reste du site (demande du propriétaire). Il n'y a qu'un système.

## Fichiers
- `client/src/components/Infobulles.astro` : script en ligne, posé une fois par page par `client/src/layouts/Base.astro`.
- `client/src/styles/global/infobulles.css` : fond clair, filet de couleur à gauche comme les cartes, serif, intitulés en petites capitales, pointe vers le déclencheur ; teinte = `--mag` du contexte, sinon l'accent. `--mag` vient d'une feuille, jamais d'un style, tirée de la classe de la magie (`couleur-magie-<id>`, skill `ui-couleurs`) : page de magie (`magie/base.css`), lignes des bâtons (`ceinture.css`), des gemmes et des bois (`composants.css`), infobulle d'une gemme des accessoires (`bulle--gemme`, `accessoires.css`) : le script lit la valeur calculée (`getComputedStyle`), une bulle riche en hérite.

## À lire
- `docs/content-guide.md`, puce « Infobulles » de « Pages de magie » (survol, focus clavier, toucher, position fixe bornée à l'écran, bulle faite de `<span>` seulement).

## Deux formes
- Bulle riche : `data-bulle="<id>"` sur le déclencheur + `<span class="bulle" role="tooltip" id="<id>" hidden>` écrit dans la page. Ou toute une tuile : `<div class="bulle bulle--carte" data-placement="cote">` (la carte d'une créature invoquée).
- Un attribut `title` : affiché dans la bulle partagée `#bulle-du-titre`.
- `data-placement="cote"` (sur une bulle riche, ou sur le déclencheur d'un `title`) place la bulle à côté de son déclencheur au lieu de dessous (carte d'une créature invoquée, chevrons de la chronologie).
- Bulle à champs : `data-bulle-champs` sur une bulle riche dont les champs se remplissent au clavier (seule la bulle d'un choix du tiroir de la fiche, `#bulle-choix`, `role="dialog"` : skill `zone-fiche-tiroir`). Elle reste ouverte tant que le focus est dans la bulle ou sur son déclencheur, et quand le pointeur la quitte si ce focus est celui du clavier (`pointerout` : pas de `fermerBientot` quand la dernière interaction est une touche ; après un appui, la souris seule, elle se ferme comme avant ; jugé juste après la perte du focus : un champ retiré quand la page refait la bulle, et auquel elle rend le focus, ne la ferme pas) ; Échap, le focus dans la bulle, la ferme et rend le focus au déclencheur (`focus({ preventScroll: true })`) sans la rouvrir ; son déclencheur porte `aria-expanded`, tenu par le script ; un bouton qui la déclenche ne la bascule pas au second appui (toucher) ni ne l'ouvre au clic (souris), comme un déclencheur qui n'est pas un bouton (les autres boutons, les noms de créatures, gardent leur bascule). Tant que le focus du clavier y est (la dernière interaction est une touche), aucune autre bulle ne la remplace : ni le survol d'un autre déclencheur, ni un `title` (`retenue()` dans `ouvrir`) ; après un appui du pointeur, ou sans l'attribut, comme avant (carte blanche du propriétaire, skill `zone-fiche-tiroir`). Entrer dans la bulle et en sortir (Entrée, Tab) est l'affaire du script de la page.

## Invariants
- Jamais l'infobulle du navigateur (demande du propriétaire : « uniquement l'habillée »). Tout attribut `title` est déplacé dans `data-infobulle` au chargement et dès qu'un script en pose un (observateur de toute la page) ; le texte reste une `aria-description`.
- Un script qui lit un `title` lit `data-infobulle` (`src/scripts/armes.mjs`, `src/scripts/bestiaire.mjs`, `src/lib/markdown-edition.mjs`).
- Un sélecteur CSS `[title]` s'écrit aussi `[data-infobulle]`.
- Pour retirer une infobulle, écrire `el.title = ''`. Un `removeAttribute('title')` ne fait plus rien.
- Rien au toucher pour un `title` (comme le navigateur).
- Une bulle riche n'est faite que de `<span>` : un bloc fermerait le `<p>` qui porte la pastille. Seule exception, la carte d'une créature invoquée, posée hors de tout paragraphe.
- Ne pas ajouter d'autre script de bulles ni d'infobulle en CSS.
- Sans `data-bulle-champs`, une bulle riche se ferme dès que son déclencheur perd le focus ou que le pointeur la quitte, Échap ne déplace pas le focus et le déclencheur n'a pas d'`aria-expanded` (`test/infobulles.test.mjs`) : l'attribut ne change que sa bulle.
- Les bulles `mot-cle-<id>` du glossaire sont posées par le middleware en fin de page, jamais à la main : skill `zone-mots-cles`.

## Tests
- `client/test/infobulles.test.mjs` : faux navigateur (déplacement des `title`, délais, clavier, toucher, `data-placement="cote"`, bulles riches, bulle à champs et non-régression sans l'attribut, mots-clés), puis site construit (script une fois par page, en ligne ; habillage dans la feuille commune).
- `client/test/magies-html.test.mjs` : bulles en `<span>` et câblage `aria-*` sur le site construit.
