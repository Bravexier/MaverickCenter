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

## Orthographe : relecture complète à la conversion en SQL

La relecture générale des coquilles et fautes des classeurs (décision R10 de `docs/decisions-regles.md`) est **reportée au moment où tout est converti en base SQL**
(décision du propriétaire). D'ici là, seul le registre `tools/sheets/corrections.json` s'applique (une correction : « Chasseur de primes ») ; on n'ajoute pas de
correction en masse. À la conversion, la relecture se fera sur les données importées, avec l'historique des modifications de la base.

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

## Authentification : Discord (décision du propriétaire du projet)

Toute la communauté est sur Discord : la connexion se fait par « Se connecter avec Discord » (OAuth2), personne n'a de compte ni de mot de passe à créer.

- **Ce qu'on garde** : l'identifiant Discord de l'utilisateur (immuable) et son nom d'affichage ; aucun mot de passe, aucun jeton Discord conservé au-delà de la connexion
  (le jeton ne sert qu'à lire l'identité et, au besoin, les rôles sur le serveur). Les modifications de contenu s'attribuent à cet identifiant (historique).
- **Rôles** : lecteur (membre du serveur), éditeur (par exemple le rôle MJ du serveur), administrateur ; la correspondance rôle Discord → rôle du site est une
  configuration, pas du code. Quelqu'un qui quitte le serveur perd l'accès. Une connexion de secours locale reste prévue pour l'administrateur si Discord est indisponible.
- **Ce que cela suppose** : un petit service (le site statique seul ne peut pas faire d'OAuth) qui gère la connexion et les sessions (cookie signé, HttpOnly, protection
  CSRF pour les modifications) ; le serveur web protège aussi les pages statiques en lui demandant si la session est valide (`auth_request` avec nginx). L'adresse de
  retour de la connexion dépend de l'adresse publique du site (HTTPS) : elle se configure par variable d'environnement et se change dans le portail développeur Discord
  quand l'hébergement migre.
- **Quand** : avec la phase d'édition, pas avant ; le mot de passe partagé d'aujourd'hui reste d'ici là. La table des utilisateurs et les colonnes « modifié par » de
  l'historique se prévoient dès la conception de la base.
- **À faire par le propriétaire le moment venu** : créer l'application dans le portail développeur Discord et fournir son identifiant et son secret comme secrets de
  l'environnement (jamais dans le dépôt). Aucun jeton personnel Discord n'est utilisé.

## Simulation : par où commencer (idée)

Un noyau minimal et vérifiable : un tour de combat (attaque, AP/AM, résistances et vulnérabilités des magies, états), un tirage aléatoire à graine (les
résultats se rejouent), des scénarios décrits en données (équipes, niveaux, sorts), des statistiques sur beaucoup de combats (taux de victoire, dégâts par
tour). On le valide sur des combats dont le propriétaire connaît l'issue avant d'élargir.
