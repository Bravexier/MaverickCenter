---
name: zone-fiche-tiroir
description: "Fiche /fiche/ : choix à faire (choixEnAttente), tiroir « Choix » en bas de l'écran, bulle d'un choix, focus et parcours au clavier (regleDuParcours, bulleAuClavier). À charger avant de lire, modifier ou relire le tiroir, ses bulles ou leur test."
paths: ["client/test/fiche-tiroir-clavier.test.mjs"]
user-invocable: false
---
# Fiche : tiroir des choix

Le code est dans `src/scripts/fiche.mjs`, `styles/fiche/fiche.css` et `components/Infobulles.astro` (bulle à champs : skill `ui-infobulles`). Noyau : skill `zone-fiche`. Description pour le lecteur : `docs/character-generator.md`, « Choix à faire ».

## Consigne du propriétaire
« Ecoute, pour les choix du tiroir, je te laisse carte blanche. Ne me demande plus sur ce sujet et fait comme recommandé à chaque fois » : un point d'interaction ouvert sur les choix du tiroir se tranche par l'option recommandée par l'équipe, et s'ajoute ici, sans question au propriétaire. Les règles ci-dessous marquées (carte blanche) en viennent ; les autres sont ses réponses.

## Le tiroir
- Choix à faire (`choixEnAttente` : ethnie, spécialité, dons, métier, +1 d'une magie au choix, maîtrise d'arme, acquis, accessoire, résistance) surlignés (`data-a-choisir`). Tant qu'il en reste, le panneau « Choix » est un tiroir fixé en bas de l'écran, rangé quand la zone IV est à l'écran (IntersectionObserver).
- Il sort ou se range d'après la **dernière** entrée du lot de l'observateur (`zoneAEcran`) : deux changements rapprochés arrivent dans un même lot (carte blanche).
- Réduit (`data-reduit`), il ne montre que sa poignée : le corps en `display: none`, que le focus n'atteint pas ; le survol le rouvre. Le focus déjà dans le corps le garde ouvert (`:has(.fiche-etape__corps :focus)`).
- Au clavier : « Déplier » (`#choix-reduire`, `aria-expanded`), « Aller aux choix » (`#choix-aller`, `allerAuxChoix` : le focus va sur l'onglet « Choix » de la zone IV, `focus({ preventScroll: true })` avant le défilement), ou la bulle d'un choix.
- Rangé au défilement alors que le focus y est (un choix, « Réduire », « Aller aux choix », un champ de la bulle) : le focus va sur l'onglet « Choix », `focus({ preventScroll: true })`, sans changer l'onglet actif ; il reste où il est si ce qui le tient est encore à l'écran (panneau « Choix » ouvert) ; jamais volé quand il n'était pas dans le tiroir, ni quand le tiroir disparaît faute de choix (`focusApresRangement`, `construireChoixEnAttente`) (carte blanche).

## La bulle d'un choix
- Le bouton du `li` porte la bulle et reçoit le focus (`button.tiroir__choix[data-bulle]`, `aria-haspopup="dialog"`, `aria-controls`, `aria-expanded` tenu par `Infobulles.astro` : ARIA ne les prévoit pas sur un `listitem`). Sans habillage de bouton, la pastille reste le `li`, dont le contour suit le focus visible par `:has`.
- Bulle à champs (`data-bulle-champs`, `role="dialog"` nommé par le choix) ; `bulleDeChoix`, `remplirBulleDeChoix` ne réécrivent ni le champ qui a le focus ni ce qui attend sa validation. L'ethnie reste un bouton qui ouvre le menu de l'identité, sans bulle.
- Un choix gardé d'un calcul à l'autre garde son élément (`identitesDesChoix` : nature et clé, la source pour une maîtrise, dont les points sont un même choix en plusieurs parts) ; sa bulle se met à jour en place (`morpher`), le champ qui a le focus le garde.
- Au toucher et à la souris, le bouton se comporte comme le `li` d'avant : pas de bascule au second appui (la bulle reste ouverte), pas d'ouverture au clic (« La souris, le toucher et les autres infobulles du site ne changent pas »).

## Au clavier (réponses du propriétaire)
- Le focus sur un choix ouvre sa bulle en aperçu ; **Entrée** met le focus dans la bulle (`bulleAuClavier`, posé par Entrée, remis à zéro par un appui du pointeur dans la bulle ou quand le focus la quitte). Tab passe d'un choix à l'autre sans entrer dans les bulles.
- Échap dans la bulle : elle se ferme, le focus revient sur son choix.
- Tab après le dernier champ : la bulle se ferme, le focus va au choix suivant ; Maj+Tab avant le premier champ : retour sur son choix (`arretsDeLaBulle` : un arrêt par groupe de boutons radio).
- Choix terminé depuis sa bulle (un choix en plusieurs parts reste ouvert jusqu'au bout) : le focus va au choix suivant (`suivreLeChoixAuClavier`, `choixSuivant` : le premier choix qui n'était pas avant lui) ; un choix nouveau à sa place (une spécialité suivie de ses dons) reçoit le focus, le premier des nouveaux ; s'il était le dernier du tiroir, le choix juste avant ; s'il n'en reste plus, le tiroir disparaît et le focus va sur la tuile de la page (son champ de même rang, son onglet ouvert par `onglets:ouvrir`). Seulement quand Entrée a mis le focus dans la bulle : la souris ne déplace rien.
- **À la validation** : dans la bulle, ce qui se parcourt aux flèches n'est pris qu'à la validation, et Échap l'annule ; sur la page, le même champ ne change pas (`regleDuParcours`) :
  - genre `liste` : un `change` qui suit une touche attend ; Entrée, Tab, Maj+Tab le relaient ; une valeur prise dans la liste ouverte à la souris se relaie aussitôt ;
  - genre `radios` (un groupe de dons) : le clic qui suit une flèche coche le rond dans la bulle sans rien relayer ; Entrée, Espace, Tab, Maj+Tab relaient le rond coché ; Échap remet la case cochée de la page, ferme la bulle et rend le focus au choix ; un clic sur un rond reste immédiat ;
  - genre `nombre` (flèches et chiffres tapés) : `input` et `change` ne relaient rien jusqu'à Entrée ou Tab ; un nombre revenu à la valeur de la page n'attend rien.
- Un clic ailleurs après un parcours : la valeur est annulée (`PARCOURS.ailleursAnnule`). Maj+Tab prend la valeur, comme Tab (`PARCOURS.majTabValide`).
- Entré dans la bulle à la souris, la règle « à la validation » ne joue pas : un champ se relaie à son `change`, un rond à son clic (`regleDuParcours(…, auClavier)`, `bulleAuClavier` ; option recommandée retenue).
- Au clavier, un bouton ou une case de la bulle se relaie à la tuile par un clic qui ne remonte pas au document (où `Infobulles.astro` fermerait la bulle) ; un rond, par le `change` de la page.
- Focus du clavier dans une bulle (entré par Entrée) : le survol d'un autre choix n'ouvre pas sa bulle à la place, et la bulle ouverte n'est pas remplie de sa tuile (`bulleRetenue` ; bulle à champs retenue de `Infobulles.astro`) ; la souris seule, ou une fois sorti de la bulle (Échap, Tab, focus parti, appui du pointeur), comme avant (carte blanche).
- Un clic sur le bouton d'un autre choix pendant cette retenue ouvre la bulle de ce choix, comme son survol sans focus du clavier dans une bulle (`appuiSurUnAutreChoix` : la bulle remplie, le survol rejoué pour `Infobulles.astro`, inchangé) (carte blanche).

## Tests
`test/fiche-tiroir-clavier.test.mjs`, `test/infobulles.test.mjs`.
