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

La relecture générale des coquilles et fautes des classeurs (décision R10 de `docs/decisions-regles.md`) se fait **dans la base**, domaine par domaine, par des migrations de données
(`data/migrations/`) : chacune garde son registre (table, id, colonne, avant, après, nature, raison). Faites : les sorts, les 15 magies et leurs tables dérivées
(`0003-orthographe-magies`, 500 corrections), puis toute la base (`0005-orthographe-base` : 2 247 corrections relues deux fois et 56 noms à clé inchangée, dans toutes les pages et tables typées),
puis les noms (`0006-orthographe-noms` : sens le plus probable, graphie majoritaire d'un nom propre ; les identifiants restent ceux d'origine, aucune table ne dérive plus l'id du nom).
Les points qui demandent une décision du propriétaire sont dans `docs/sql/orthographe-a-valider.md`.
Tant que les classeurs sont la source, **un réimport depuis un classeur réintroduirait ces fautes** : les lignes typées ne se réimportent pas encore (voir `docs/sql/remplissage.md`) ;
au moment de la bascule, la base est la référence. Le registre `tools/sheets/corrections.json` reste en vigueur pour les autres domaines.

## Ce que cela impose dès maintenant

- **Le NAS est temporaire.** Rien de spécifique au NAS en dehors de `deploy/` : le site et l'API doivent tourner dans un conteneur, configurés par variables
  d'environnement ; la mise à jour automatique (`update-nas.sh`) est un habillage, pas l'architecture. L'hébergement final reste à choisir ; la solution y sera
  installée pour la 1.0 (décision du propriétaire), par les installateurs autonomes de `deploy/installateur/` (serveur normal et serveur de test, voir `flux-git.md`).
- **La base SQLite est le pivot.** Identifiants stables et jamais réutilisés (une page renommée garde son identifiant), SQL portable (une bascule vers PostgreSQL
  doit rester possible si plusieurs personnes éditent en même temps), modifications historisées (qui, quand, avant/après, état « brouillon / validé »).
- **Les règles sont des données, pas seulement du texte.** (Premier pas : les bonus de niveau de maîtrise des sorts, `sort_bonus_maitrise`, typés quand l'écriture est sans ambiguïté, lisibles par `lib/sort-maitrise.mjs`.) Le texte d'une capacité reste cité tel quel (règle d'or), mais une simulation exige des effets
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
- **Quand** : avec la **version 1.0** (décision du propriétaire), qui ouvre aussi le serveur normal (usage réel) et le serveur de test, ce dernier
  recevant à chaque installation une copie de la base du serveur normal (voir `flux-git.md`). Le mot de passe partagé d'aujourd'hui reste d'ici là.
  La table des utilisateurs et les colonnes « modifié par » de l'historique se prévoient dès la conception de la base.
- **À faire par le propriétaire le moment venu** : créer l'application dans le portail développeur Discord et fournir son identifiant et son secret comme secrets de
  l'environnement (jamais dans le dépôt). Aucun jeton personnel Discord n'est utilisé.

## Simulation : par où commencer (idée)

Un noyau minimal et vérifiable : un tour de combat (attaque, AP/AM, résistances et vulnérabilités des magies, états), un tirage aléatoire à graine (les
résultats se rejouent), des scénarios décrits en données (équipes, niveaux, sorts), des statistiques sur beaucoup de combats (taux de victoire, dégâts par
tour). On le valide sur des combats dont le propriétaire connaît l'issue avant d'élargir.
