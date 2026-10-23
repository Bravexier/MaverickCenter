---
name: consigner-une-decision
description: "Ajouter une décision du propriétaire (R131, R132…) au registre docs/decisions-regles.md — numérotation, citation exacte, conséquence, test qui l'épingle. À charger par game-design ou worldbuilding quand le propriétaire tranche une règle, un nom ou un choix."
---

# Consigner une décision

Le registre `docs/decisions-regles.md` est la seule liste des choix du propriétaire. Le code et les tests citent leur numéro (`R41`). `game-design` y écrit les décisions de règles, `worldbuilding` celles du lore. On ajoute une ligne à la fin, jamais au milieu.

1. **Le numéro.** Prendre le dernier `R…` du tableau, plus 1. Relire la fin du fichier juste avant d'écrire : l'autre chef a pu en ajouter un.
2. **Les colonnes**, comme les lignes voisines :
   - « Question » : le conflit ou le silence des sources, avec les références (doc, onglet, case, question Q…) ;
   - « Décision » : la règle retenue, en gras pour l'essentiel ;
   - « Citation » : **les mots du propriétaire, recopiés tels quels**, fautes comprises ;
   - « Conséquence » : ce qui change (tables, colonnes, pages, fiche, tests), ou « à appliquer » tant que l'équipe technique ne l'a pas fait.
3. **Seulement une vraie décision.** Une décision ne naît que d'une réponse du propriétaire. Une déduction, même évidente, reste une question (`poser-une-question`).
   - **Quand il change lui-même une règle** (« le coût passe à 6 »), sans conflit de sources, on vérifie d'abord si l'original Google l'écrit déjà (R83). Si oui, c'est une mise à jour du classeur (`sources-rapprochement`). Sinon, c'est une décision R… : sa citation est sa demande, et le code, les tests et l'entrée `voulus` du registre du classeur la citent.
   - **Une modification qu'il fait lui-même sur le site de dev** n'est pas une décision : le site est la source de ce qu'il modifie.
4. **Les questions tranchées.** Si une question de `docs/sql/a-valider.md` (ou de `orthographe-a-valider.md`) est ainsi tranchée, le chef y note « décidé (R…) », avec le compteur « R1 à R… » de l'en-tête de `a-valider.md`. Une mention à porter dans un autre doc va dans la demande au `leader-technique`.
5. **L'index.** Après l'ajout, lancer `npm run decisions:index` (depuis `client/`), puis commiter `docs/decisions-index.md` avec le registre. Le chef n'a pas Bash : il le demande au `leader-technique` (par `tech-back`). Le script (`client/scripts/decisions-index.mjs`) refait l'index que les agents lisent à la place du registre (243 Ko) ; `test/decisions-index.test.mjs` échoue en CI s'il n'est pas à jour (`npm run decisions:index -- --verifier` le vérifie sans écrire).
6. **Son application** passe au `leader-technique` : donnée ou migration, moteur, test qui épingle le numéro, docs. Le commit qui l'applique porte « décision » (règle de fin du registre) : jamais de changement silencieux du moteur.
7. **La publication.** La liste des fichiers écrits (registre, questions) va au `leader-technique`, avec le lot qui applique la décision, ou seule si le site ne change pas : `tech-publication` les commite (`circuit-des-demandes`, « Publication »).
