# Feuille de route (vision du propriétaire du projet)

Ce que le site doit devenir, tel que l'a décrit le propriétaire du projet. Cela oriente les choix techniques d'aujourd'hui, même si rien
n'est encore réalisé au-delà de la première étape.

## Étapes

1. **Source rapide et navigable** (en cours) : les règles du jeu et le lore, en pages reliées par mots-clés, importées des classeurs et documents Google
   (les classeurs restent la source de vérité ; les pages et la base sont régénérées à chaque import).
2. **Un outil qui remplace Google Docs/Sheets** (à long terme) : modifier sorts, dons, classes et races depuis le site, avec historique et relecture. À ce moment-là
   la source de vérité bascule : la base devient canonique, les classeurs deviennent une archive en lecture seule. Le moment de la bascule se décide avec le
   propriétaire du contenu ; avant cela, aucune édition n'est faite dans le site (les corrections passent par `tools/sheets/corrections.json`).
3. **Simulation de combats** (à long terme) : jouer des combats pour juger l'équilibrage des sorts, des classes et des races.

## Ce que cela impose dès maintenant

- **Le NAS est temporaire.** Rien de spécifique au NAS en dehors de `deploy/` : le site et l'API doivent tourner dans un conteneur, configurés par variables
  d'environnement ; la mise à jour automatique (`update-nas.sh`) est un habillage, pas l'architecture. L'hébergement final reste à choisir.
- **La base SQLite est le pivot.** Identifiants stables et jamais réutilisés (une page renommée garde son identifiant), SQL portable (une bascule vers PostgreSQL
  doit rester possible si plusieurs personnes éditent en même temps), modifications historisées (qui, quand, avant/après, état « brouillon / validé »).
- **Les règles sont des données, pas seulement du texte.** Le texte d'une capacité reste cité tel quel (règle d'or), mais une simulation exige des effets
  structurés (dégâts, durée, cible, jet, état infligé, résistance). On les code progressivement, capacité par capacité, à côté du texte, sans jamais en déduire
  une règle : un effet non codé est absent de la simulation, pas deviné.
- **Le moteur de règles reste pur et sans dépendance** (`client/src/lib/*.mjs`) : le même code sert au site, à l'API, au générateur de fiche et au simulateur.
- **Un site statique ne suffit plus pour l'édition ni pour la simulation** : il faudra un service (API + authentification, rôles lecteur / éditeur) ; le site
  de lecture peut rester statique ou devenir rendu côté serveur selon l'hébergement choisi.

## Simulation : par où commencer (idée)

Un noyau minimal et vérifiable : un tour de combat (attaque, AP/AM, résistances et vulnérabilités des magies, états), un tirage aléatoire à graine (les
résultats se rejouent), des scénarios décrits en données (équipes, niveaux, sorts), des statistiques sur beaucoup de combats (taux de victoire, dégâts par
tour). On le valide sur des combats dont le propriétaire connaît l'issue avant d'élargir.
