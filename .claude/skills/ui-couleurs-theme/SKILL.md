---
name: ui-couleurs-theme
description: "Couleurs hors des règles du jeu : jetons du thème (styles/global/base.css), exception du noir et du blanc de mélange, couleurs sans texte, contrastes tranchés par le propriétaire, ce qui n'est pas encore en classes. À charger avant de lire, modifier ou relire base.css, un jeton ou une couleur écrite dans une feuille."
paths: ["client/src/styles/global/base.css"]
user-invocable: false
---
# Couleurs : thème et dérogations

La règle et la palette : skill `ui-couleurs` (principe « Aucune couleur en dur. »). Détail et réponses du propriétaire mot pour mot : `docs/content-guide.md`, « Couleurs du site : la palette en classes ».

## Choix du propriétaire
- Exception, le noir et le blanc de mélange (« Non, exception ») : `#000`, `#fff`, `#000000`, `#ffffff` comme argument d'un `color-mix(…)` (liseré de `.acc-gemme`, `equipement.css`). Rien d'autre : `test/palette-css.test.mjs#couleursEcrites` tolère exactement cela (une teinte écrite dans une variable, `--gh: 5`, n'y est pas vue).
- Valeurs et contrastes tranchés (réponses citées dans `docs/content-guide.md`) : Feu `#ff4500`, Arcane `#a8adb5` (« Garder les deux », `sort-format.mjs#COULEURS_DES_MAGIES`) ; Loyal Bon, Loyal Neutre et le Titane à peine éclaircis (« Éclaircir ») ; le gris neutre de la fiche (« Gris neutre du site ») ; les violets du maudit (`--maudit`, `--maudit-texte`, `--maudit-choisi`) ; le texte coloré des pages du guide assombri en clair (« Comme les cartes du fil rouge »). Deux autres corrections des parties (« Vert assombri », « Plus clair en sombre ») ne sont pas des choix du propriétaire : sans préférence de sa part, l'option recommandée au nom de « Privilégé la lisibilité ». Potions et nuances d'alchimie (`NUANCES_D_UNE_BASE_BLANCHE`, « Dégradé visible ») : skill `zone-ceinture`. 4ᵉ barre de la fiche : skill `zone-fiche`.

## Dérogations
- Une couleur qui ne porte pas de texte n'est pas corrigée : le seuil de 4,5:1 vaut pour un texte. Ses familles sont dans `FAMILLES_SANS_TEXTE` (`palier`, le trait d'une ligne de résistance ; `arme`, le bleu des armes de départ, sous lequel un test interdit `var(--couleur-texte)`) ; `lisible` ne s'y applique pas, le test de contraste ne les mesure pas. Une famille dont la couleur porte un texte n'y va jamais.
- Une couleur d'interface sans règle du jeu est un jeton de `styles/global/base.css`, avec la valeur qu'écrivait sa feuille (en clair et en sombre si elle en avait deux) ; la liste et les valeurs : le doc, « Couleurs d'interface sans règle du jeu ». Un rôle qui existe déjà (`--good`, `--danger`, `--accent`…) sert tel quel. Un voile noir ou blanc translucide s'écrit `color-mix(in srgb, #000 5%, transparent)` / `color-mix(in srgb, #fff 70%, transparent)` (l'exception ci-dessus). Un seul `--maudit:` dans `base.css` (testé).
- Pas encore en classes : archives, mise à jour ; les voiles blancs des bannières, `--regard-evitee`, `.genre`, `.don-type`, l'ombre de l'infobulle (liste du doc, fin de « Où elle sert ») ; les cases de tableau (`{couleur:x}`, `global/wiki.css`, `lib/markdown-couleurs.mjs`). Le test nomme ce qu'il laisse de côté (`HORS_DU_LOT`).
- Assombrissement forcé du navigateur (Auto Dark Mode de Chromium, Mode nuit de Brave) : mesuré sous `--blink-settings=forceDarkModeEnabled=true`, aucune déclaration de la page ne l'empêche quand le système est clair (`<meta name="color-scheme">` ou `color-scheme` de `:root` en `only light`, `light dark`, `dark`, `only dark` ; `forced-color-adjust`) ; système sombre, le site suit son thème sombre (`color-scheme: dark`). Rien n'est ajouté au site : ne pas réessayer ces pistes sans mesure nouvelle.

## Tests
`test/palette-css.test.mjs` (jetons du thème et leurs valeurs, `couleursEcrites`, contraste des familles qui portent un texte, un seul `--maudit:`).
