# Générateur de fiche de personnage

Page : `client/src/pages/generateur.astro` · moteur : `client/src/lib/character.mjs` · règles : `client/src/data/rules.json`.

Le moteur ne contient **aucune règle de Maverick** : tout vient de `rules.json`. Les données actuelles sont des
exemples (`meta.status: "example"` → bandeau d'avertissement sur la page). Remplacer ce fichier par les vraies règles
suffit à changer le comportement du générateur.

## Schéma de `rules.json`

| Clé | Contenu |
| --- | --- |
| `meta` | `status` (`example` affiche le bandeau), `version` (inscrite dans les fiches exportées), `note` |
| `attributes[]` | `{ id, label }` — les caractéristiques |
| `creation` | `base` (valeur de départ), `pool` (points à répartir), `max` (valeur maximale **avant** bonus) |
| `limits` | `classes` et `magies` : nombre maximal de choix (1 = bouton radio de fait) |
| `races[]` | `{ id, name, wiki?, modifiers?, traits? }` |
| `classes[]` | idem + `allowedRaces?` (ids de races ; absent = toutes) |
| `magies[]` | `{ id, name, wiki?, allowedClasses? }` (au moins une des classes listées doit être choisie ; absent = libre) |
| `derived[]` | `{ id, label, base?, add? }` → valeur = `base + Σ(caractéristique finale × coefficient)` |

- `modifiers` : `{ "idCaracteristique": bonus }`, cumulés entre la race et les classes.
- `wiki` : id d'une page (`"races/elfe"`) — le nom devient un lien dans la fiche.
- `traits` : textes listés sur la fiche pour la race et les classes choisies.

Caractéristique finale = `creation.base` + points dépensés + bonus de race/classes.

## Brancher les vraies règles

1. Lire les documents sources ([sources.md](sources.md)) et créer les pages du wiki correspondantes.
2. Éditer `rules.json` : attributs, coût/réserve de création, races, classes, magies, valeurs dérivées.
3. Mettre `meta.status` à `"verified"` et changer `meta.version`.
4. `cd client && npm test` : `rules.test.mjs` vérifie les ids uniques, les références de modificateurs/restrictions
   et que chaque `wiki` pointe vers une page existante.
5. Supprimer les pages et entrées `example`.

## Ce que le moteur ne gère pas (encore)

Compétences, équipement, jets de dés, niveaux/expérience, coûts de points non linéaires, bonus conditionnels,
formules arbitraires. Si les règles de Maverick en ont besoin, étendre `character.mjs` **avec des tests**
(`client/test/character.test.mjs`) plutôt que d'évaluer des formules libres venant des données.

## Fiches exportées

« Exporter » produit `{ format: "maverick-character", version: 1, rules: <meta.version>, character: {…} }`.
À l'import (et au chargement du `localStorage`), la fiche est nettoyée par `sanitize` : ids inconnus retirés,
choix incompatibles retirés en cascade (race → classes → magies), limites respectées.

## Fiches dans la base

Les vraies fiches de personnages ont leurs tables dans la base (section 13 de `data/schema.sql`, migration `0011-personnages`). Elles reprennent la
« Fiche personnage Maverick Auto V15.2.2 » (onglet Personnage) **hormis ses bugs** (liste dans [`sql/a-valider.md`](sql/a-valider.md) §3) : chaque colonne cite sa cellule.

**Principe : on stocke les choix, jamais les calculs.** Une fiche garde ce que le joueur décide ou tire aux dés ; tout ce que la fiche auto calcule se recalcule
depuis les règles de la base, si bien qu'une règle corrigée corrige toutes les fiches.

### Joueurs, prétirés, groupes et visibilité (demande du propriétaire)

- **Deux natures de fiche** (`personnage.nature`) : la fiche d'un **joueur** (`joueur`), qu'il crée pour son propre personnage, et le **prétiré** (`pretire`),
  qui n'est à personne (`proprietaire_id` vide) et que **tout le monde voit**.
- **Visibilité** d'une fiche de joueur : **lui seul et les administrateurs** par défaut (`visibilite = 'privee'`). Il peut l'ouvrir à **tous les MJ**
  (`'mj'` : les utilisateurs de rôle `mj`, le « groupe MJ »), à **tout le monde** (`'tous'`), et la montrer à des **utilisateurs désignés**, autant qu'il veut
  (`personnage_partage`).
- **Groupes de jeu** (`groupe` : un one-shot ou une campagne ; `groupe_membre`) : un joueur peut avoir plusieurs fiches et être dans plusieurs groupes, mais
  n'inscrit **qu'une fiche par groupe** (une ligne par membre et par groupe) : en inscrire une autre **désinscrit** la précédente. La fiche inscrite devient
  **visible de tous les membres de ce groupe**, et d'eux seuls : ses autres fiches restent cachées. On inscrit sa propre fiche ou un prétiré (`v_groupe_controle`).
- **Rôles** (`utilisateur_role`, cumulables) : `mj`, `editeur` (modification des règles, phase 2), `admin` (voit et gère tout) ; tout utilisateur connecté est
  lecteur. La page de gestion de ces règles n'est pas encore faite : les tables et les vues les portent déjà.
- `v_personnage_visible` dit qui voit quelle fiche : une ligne par (fiche, utilisateur, motif), motif `proprietaire`, `admin`, `tous`, `mj`, `groupe`
  (avec le groupe) ou `partage`. Un utilisateur voit une fiche s'il y a au moins une ligne.

### Les tables

| Table | Contenu (cellules de la fiche) |
| --- | --- |
| `utilisateur`, `utilisateur_role` | Personne connectée (identifiant Discord, nom d'affichage) et ses rôles : connexion Discord prévue à la 1.0 (`feuille-de-route.md`) |
| `personnage` | Nature (joueur ou prétiré), propriétaire, visibilité ; identité (F1, P1, F3), race (I2), ethnie (C40), magies innée et acquise (S2, S3), point de caractéristique d'une magie « au choix » (Potentiel Illimité), dieu choisi (S5), métier (C41), mode mono/bi-classe (BDD!K26), XP (S11), scores d'alignement L/C/B/M (L5:O5), bourse PP/RO/RF (I6, N6, T6), ambidextrie (AU8), classe de bouclier (AA26), valeurs courantes (santé, chakra, barrière, corruption, 4ᵉ barre), notes et événements, statut `brouillon` / `valide` / `archive` |
| `personnage_partage` | Utilisateurs à qui le propriétaire montre sa fiche |
| `personnage_classe` | Classes 1 et 2 (A9, A11) et leur spécialité (choisie au niveau de classe 10) |
| `personnage_caracteristique` | Valeur de base des six caractéristiques (E18…U19) et leurs **croix** (cases H18, I18… ; 0 à 2, décision R19 : 1 croix = −20 % à tout test de la caractéristique, 2 = plus utilisable) |
| `personnage_competence` | Points « Nat. » et « Acquis » de chaque compétence (G22, I22…) |
| `personnage_progression` | À chaque niveau global à partir du 2 : les 15 points d'attributs répartis entre santé et chakra, et le dé bonus des niveaux 5, 10, 15, 20 |
| `personnage_capacite` | Dons de classe **à choix** (options d'une ligne, paliers de l'Archimage) ; les autres se déduisent |
| `personnage_sort` | Sorts de la liste (AA55:AY74) et leur NM |
| `personnage_maitrise_arme` | Dés de maîtrise par famille d'armes (AA2:AV7) |
| `personnage_arme`, `personnage_armure`, `personnage_bouclier_materiau`, `personnage_accessoire`, `personnage_inventaire` | Équipement : catalogue de la base (arme, matériau, améliorations, pièces élémentaires, effets d'accessoire et valeur tirée, case « Malédiction ») et sac |
| `groupe`, `groupe_membre` | Groupe de jeu (one-shot ou campagne), ses membres (MJ ou joueur) et la fiche que chacun y a inscrite |

### Les vues

- `v_personnage_niveau` : niveau global (d'après l'XP) et niveaux de classe 1 et 2 (décision R2).
- `v_personnage_visible` et `v_groupe_controle` : voir plus haut.
- `v_personnage_controle` : une ligne par règle enfreinte (`regle`, `detail`) : classe ou magie innée hors de la matrice de la race (R8, R11), magies incompatibles,
  mono-magie (R15 ; l'Elfe Noir Charbon et le Felfe Noir peuvent aussi acquérir la Corruption, R20), ethnie (de la race, liée à la magie innée quand elle en porte
  une), bornes et total exact des caractéristiques (R3), plafonds et total exact des compétences (R3), gains de niveau (points exacts, dé), 2ᵉ classe, spécialité
  avant le niveau de classe 10, dons hors classe ou exclusifs, sorts (magie du personnage, toutes pour le Potentiel Illimité ; NPM au plus la puissance magique
  du niveau, la 5 au niveau 16 et sans magie acquise, R16 ; NM au plus niveau global − 1 ; total des NM), matériaux du bouclier, améliorations, valeur d'un
  accessoire. Une fiche `valide` n'y a aucune ligne. Ce qui demande le moteur (bonus de classe, d'équipement et de race, nombre de sorts, plafond de NPM du
  Potentiel Illimité, résistances, valeurs dérivées) n'y est pas encore.

Les tables restent **vides dans `data/rows`** : les fiches réelles vivent dans la base vivante du service des personnages (`db/` de l'instance,
[`serveur.md`](serveur.md) : les prétirés dès maintenant, les fiches de joueur à la 1.0), jamais dans git ni dans la base téléchargeable de `/donnees/`. `client/test/personnages-db.test.mjs` crée des fiches dans une copie de la base et vérifie chaque contrôle et chaque règle de
visibilité.

Suite prévue : le moteur pur (`client/src/lib/`) qui calcule les valeurs dérivées d'une fiche (santé, chakra, barrière, initiative, vitesse, AP/AM, totaux de
compétences, résistances, nombre de sorts) depuis ces tables, puis le générateur et l'édition des fiches.
