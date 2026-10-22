---
name: ui-couleurs
description: "Couleurs des caractéristiques (et de leurs compétences), des postures et des alignements : lib/caracteristiques-postures.mjs, posées en --c / --c-texte dans le guide et la fiche. À charger avant de lire, modifier ou relire ces couleurs ou un rendu qui les pose."
paths: ["client/src/lib/caracteristiques-postures.mjs", "client/test/caracteristiques-postures.test.mjs"]
user-invocable: false
---
# Couleurs des caractéristiques, compétences et postures

Les caractéristiques, leurs compétences et les postures ont chacune leur couleur (demande du propriétaire).

## Fichiers
- `client/src/lib/caracteristiques-postures.mjs` : `COULEURS_CARACTERISTIQUES`, `COULEURS_POSTURES`, `COULEURS_ALIGNEMENTS`, `COULEUR_NEUTRE`, `couleurDeCaracteristique`, `couleurDePosture`, `couleurDAlignement`, `styleDeCouleur`. Les clés sont les ids de la base.
- Lu aussi par `lib/fiche-regles.mjs`, `components/guide/GuideBloc.astro`, `lib/armes-rendu.mjs`, `lib/edition-rendu.mjs`, `lib/monstre-rendu.mjs`.

## À lire
- `docs/content-guide.md`, « Les pages du guide » (puce « Les blocs tirés de la base » : les valeurs de chaque couleur).
- `docs/character-generator.md` (couleurs transmises par `regles.json`).

## Invariants
- Posées en `--c` / `--c-texte` : aplat clair, texte foncé. Dans le guide (`GuideBloc.astro`) et la fiche.
- Une compétence a la couleur de sa caractéristique.
- La fiche les reçoit par `regles.json` (`fiche-regles.mjs` : `couleur` et `texte` de chaque caractéristique) ; son script (`src/scripts/fiche.mjs`) n'importe pas le module.
- Un id inconnu reçoit `COULEUR_NEUTRE`.

## Tests
- `client/test/caracteristiques-postures.test.mjs` : couleurs demandées, une par ligne de la base, ni plus ni moins ; posture par id ou par clé ; texte foncé dans les deux thèmes ; alignements.
