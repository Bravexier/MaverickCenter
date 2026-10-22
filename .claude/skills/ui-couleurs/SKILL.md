---
name: ui-couleurs
description: "Palette du site en classes CSS (lib/palette-css.mjs : .couleur-<famille>-<id>, --couleur / --couleur-texte ; magies, attributs, caractéristiques, affinités ; combinaisons des potions), couleurs des caractéristiques (et de leurs compétences), des postures et des alignements (lib/caracteristiques-postures.mjs, posées en --c / --c-texte dans le guide et la fiche) et des attributs (lib/attributs-couleurs.mjs, --attribut-<clé>) ; principe « Aucune couleur en dur. ». À charger avant de lire, modifier ou relire ces couleurs, la palette ou un rendu qui les pose."
paths: ["client/src/lib/caracteristiques-postures.mjs", "client/src/lib/attributs-couleurs.mjs", "client/src/lib/palette-css.mjs", "client/test/caracteristiques-postures.test.mjs", "client/test/alchimie-couleurs.test.mjs", "client/test/palette-css.test.mjs"]
user-invocable: false
---
# Couleurs des caractéristiques, compétences et postures

Les caractéristiques, leurs compétences et les postures ont chacune leur couleur (demande du propriétaire), les attributs aussi (santé rouge, barrière jaune, chakra bleu, corruption noire).

Principe (demande du propriétaire du 2026-10-22) : « Partout il faut utiliser Que les couleurs du site. Si le site n'a pas de règle il ajoute une nouvelle couleur au site en se basant sur celle du classeur. Aucune couleur en dur. » ; pour le texte, « Privilégé la lisibilité. » (`sort-format.mjs#texteSurCouleur`). Une couleur se lit dans le module de sa règle, jamais recopiée dans un CSS ou un rendu ; une couleur ajoutée ne double pas une règle qui existe.
Source des couleurs (réponse du propriétaire du 2026-10-22) : « La classe CSS du site qui va avec la couleur de base, comme pour les magies. Si elle n'existe pas, créer une classe CSS avec la couleur du classeur. »

## Palette en classes (`client/src/lib/palette-css.mjs`)
- Une classe `.couleur-<famille>-<id>` par couleur des règles : `--couleur` (fond) et `--couleur-texte` (`texteSurCouleur`). Fabriquée au build depuis les modules des règles (`cssDeLaPalette`), posée sur chaque page par `layouts/Base.astro` (un `<style is:inline>` à part, après `cssDesAttributs()` ; environ 2,6 ko, épinglé sous 4 ko). Le module n'écrit aucun hex.
- Familles (`FAMILLES_DE_LA_PALETTE`) : `magie` (`sort-format.mjs#COULEURS_DES_MAGIES`, id = nom court normalisé : `feu`, `espace-temps` ; plus `par-defaut` = `COULEUR_PAR_DEFAUT`), `attribut`, `caracteristique`, `affinite` (les dix `COULEURS_DES_AFFINITES`, source : Doc « Alchimie »). Id = la clé du module passée par `text.mjs#normalize` (`chakra+sante` → `chakra-sante`), stable quand le nom affiché change.
- Noms : `classeDeCouleur(famille, cle)`, `classeDeMagie(nom)`, `classeDAttribut(cle)`, `classeDeCaracteristique(id)`, `classeDAffinite(id)` (via `alchimie-couleurs.mjs#baseDAffinite`).
- Couleurs calculées : `couleurDePotion` rend `{ fond, texte, base: { famille, cle }, niveau }` ; `classeDePotion` → `couleur-potion-<famille>-<id>-n<rang>` (`--ligne-fond`, `--ligne-texte`) ; `cssDesPotions(couleurs)` n'émet que les combinaisons demandées (la page qui les affiche : skill `zone-ceinture`).
- Ajouter une couleur : l'écrire dans le module de sa règle (une famille nouvelle : l'ajouter à `FAMILLES_DE_LA_PALETTE`) ; la page pose la classe, sa feuille lit `var(--couleur)`.
- Ne pas importer `palette-css.mjs` dans un script de page (`src/scripts/`) : il tire tous les modules des règles. `ceinture-rendu.mjs` l'importe, et passe dans l'éditeur du site de dev (`edition-rendu.mjs`), hors version portable.

## Choix du propriétaire (2026-10-22, questions de cadrage)
- « Module JS → classe » : la valeur reste dans le module de sa règle, la feuille des classes en est fabriquée au build, les pages ne posent plus que la classe.
- « Thème reste, Debug à part » : les variables du thème (`styles/global/base.css`) restent la règle du thème, toute copie ailleurs passe par elles ; la page Debug et l'impression ne changent pas.
- « Règle de calcul » : la base est une classe du site, la nuance se calcule depuis elle, une classe par combinaison seulement là où une page en a besoin, sans couleur écrite.
- « Garder séparées » : chaque couleur garde son nom et sa classe (changer la santé ne change pas la catégorie Mêlée) ; mais une affinité qui est un attribut ou une magie reste la classe de cet attribut ou de cette magie (pas de recopie).
- Lots : l'onglet Ceinture (potions, bâtons) est passé aux classes ; les autres composants des magies (`--couleur-magie`, `--mag`, `--g` en style), les accessoires et le reste suivront lot par lot.

## Fichiers
- `client/src/lib/caracteristiques-postures.mjs` : `COULEURS_CARACTERISTIQUES`, `COULEURS_POSTURES`, `COULEURS_ALIGNEMENTS`, `COULEUR_NEUTRE`, `couleurDeCaracteristique`, `couleurDePosture`, `couleurDAlignement`, `styleDeCouleur`. Les clés sont les ids de la base.
- Lu aussi par `lib/fiche-regles.mjs`, `components/guide/GuideBloc.astro`, `lib/armes-rendu.mjs`, `lib/edition-rendu.mjs`, `lib/monstre-rendu.mjs`, `lib/alchimie-couleurs.mjs` (philtres).
- `client/src/lib/attributs-couleurs.mjs` : `COULEURS_DES_ATTRIBUTS` (clés de la fiche : `sante`, `barriere`, `chakra`, `corruption`, `barre4`), `couleurDAttribut`, `cssDesAttributs` (les propriétés `--attribut-<clé>` sur `:root`, posées sur chaque page par `layouts/Base.astro`), lues par `styles/fiche/fiche.css` et `styles/bestiaire/carte.css` (santé, chakra, barrière des cartes), qui ne les écrivent plus. Lu aussi par `lib/alchimie-couleurs.mjs` (potions dont l'essence est un attribut ; skill `zone-ceinture`).

## À lire
- `docs/content-guide.md`, « Couleurs du site : la palette en classes ».
- `docs/content-guide.md`, « Les pages du guide » (puce « Les blocs tirés de la base » : les valeurs de chaque couleur).
- `docs/character-generator.md` (couleurs transmises par `regles.json`).

## Invariants
- Posées en `--c` / `--c-texte` : aplat clair, texte foncé. Dans le guide (`GuideBloc.astro`) et la fiche.
- Une compétence a la couleur de sa caractéristique.
- La fiche les reçoit par `regles.json` (`fiche-regles.mjs` : `couleur` et `texte` de chaque caractéristique) ; son script (`src/scripts/fiche.mjs`) n'importe pas le module.
- Un id inconnu reçoit `COULEUR_NEUTRE`.
- Attributs : une seule source (`attributs-couleurs.mjs`) ; `fiche.css` et `bestiaire/carte.css` lisent `var(--attribut-<clé>)` et n'écrivent aucune de ces couleurs.
- Lisibilité d'une ligne colorée : texte de `texteSurCouleur`, contraste d'au moins 4,5:1 (`lib/alchimie-couleurs.mjs#lisible`, pour les potions ; chaque classe de la palette l'atteint déjà : testé).
- Palette : la valeur de chaque classe est celle de sa règle ; aucune classe ne recopie une autre règle ; une page ne pose que la classe, jamais un style de couleur (là où son lot est fait).

## Tests
- `client/test/caracteristiques-postures.test.mjs` : couleurs demandées, une par ligne de la base, ni plus ni moins ; posture par id ou par clé ; texte foncé dans les deux thèmes ; alignements.
- `client/test/palette-css.test.mjs` : familles, noms et ids, pas de recopie, valeur de chaque classe = sa règle, contraste 4,5:1, combinaisons des potions (toutes celles possibles), aucun hex dans le module, poids borné, palette dans les pages construites.
- `client/test/alchimie-couleurs.test.mjs` : les attributs posés par `Base.astro` (et dans les pages construites de la fiche et du bestiaire), `fiche.css` et `carte.css` sans leurs couleurs ; contraste de chaque ligne de potion et de bâton.
