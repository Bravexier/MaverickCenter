---
name: tenir-un-skill
description: "Comment créer, modifier ou resserrer un skill du dépôt — ce qu'on y garde (invariants, choix du propriétaire) et ce qu'on n'y met jamais (récit daté, doublons de docs/), budget de taille, format du frontmatter, validation. Préchargé par tech-skills, seul habilité à modifier les skills."
---

# Tenir un skill

Un skill est chargé en entier chaque fois qu'un agent lit un fichier de sa zone : chaque octet est payé à chaque chargement (≈ 3,4 octets par jeton). Un skill se tient donc court et à jour. Seul `tech-skills` en écrit un : les autres lui adressent une demande (voir plus bas).

## Ce qu'on y garde

- **Les invariants** : ce qui casse (test rouge, page fausse, donnée perdue) si on l'oublie, avec la raison quand elle est écrite.
- **Les choix du propriétaire** : la règle d'affichage ou de comportement, avec son numéro `R…` ou « (demande du propriétaire) ». Une citation n'entre que si c'est elle qui fonde la règle.
- **Où lire le détail** : la section précise de `docs/` qui décrit la zone, après avoir vérifié qu'elle dit bien ce qu'on lui prête.
- **Les tests qui gardent la zone**, par leur nom.

## Ce qu'on n'y met jamais

- Du récit : dates de demande, « lot N », « puis », « on a d'abord… ». La règle suffit ; l'historique est dans git.
- Ce que `docs/` dit déjà : on renvoie, on ne recopie pas. Un fait vit à un seul endroit.
- Ce que le code dit clairement à qui le lit (liste des fonctions d'un fichier, signature évidente).
- Un résumé de ce qui sera lu de toute façon avec le fichier.

## Budget

- **Cible : 12 Ko au plus** (≈ 3 500 jetons). Le test `instructions-claude.test.mjs` signale de 12 à 20 Ko et **échoue au-delà de 20 Ko**.
- Mesure avant et après : `wc -c .claude/skills/<nom>/SKILL.md`. Une mise à jour qui ajoute enlève d'abord ce qu'elle rend obsolète : le net vise zéro octet.
- Au-dessus du budget : condense d'abord (récit, doublons, détail évident). S'il reste trop gros, pose la question de `eclater-un-skill`.

## Format

- Frontmatter : `name` (= nom du dossier), `description` **entre guillemets doubles** (un « : » sans guillemets casse le YAML), ≤ 400 caractères (le plafond de `instructions-claude.test.mjs` ; 300 visés), qui dit quand charger le skill ; `paths` (globs de fichiers existants, aussi étroits que possible) et `user-invocable: false` pour un skill de zone ; un skill de procédure n'a pas de `paths`.
- Corps : sections courtes (« Fichiers », « À lire », « Invariants », « Choix du propriétaire », « Tests »), phrases courtes, pas d'emphase.
- Renvois entre skills : « skill `nom` », avec les accents graves.

## Recevoir une demande de mise à jour

Les auteurs d'un changement ne modifient pas un skill : ils le signalent, dans leur rapport, sous la forme « skill `x` — ce qui change — pourquoi — où (fichier, test) ». Le `leader-technique` te les remet en une seule fois, en fin de lot. Pour chacune :
1. Lis le skill en entier et le diff du lot. Vérifie que le changement est bien un invariant ou un choix du propriétaire, pas un détail d'implémentation : sinon, ne l'écris pas et dis pourquoi.
2. Écris-le dans la bonne section, après avoir retiré ce qui devient faux.
3. Un skill créé ou renommé : mets à jour la section « Les skills » de `docs/equipe.md` et les renvois (`git grep` de l'ancien nom).
4. Valide : `node --test test/instructions-claude.test.mjs` depuis `client/`.

Ton rapport donne : les skills touchés, leur taille avant et après, les demandes refusées avec la raison, et le résultat du test.
