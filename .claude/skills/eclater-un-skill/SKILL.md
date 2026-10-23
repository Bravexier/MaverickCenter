---
name: eclater-un-skill
description: "Décider si un skill doit être éclaté en plusieurs skills plus spécifiques, ou au contraire fusionné ou seulement condensé — grille de décision (taille, séparabilité, fréquence de chargement, coût d'un skill de plus) et procédure sûre pour éclater sans rien perdre. Préchargé par tech-skills."
---

# Éclater un skill, ou pas

Éclater n'est pas gratuit. Chaque skill de plus coûte : sa description listée à chaque tour (≈ 80 jetons), une entrée dans `docs/equipe.md`, des renvois à tenir, un risque d'incohérence entre voisins. Il ne se justifie que si le gain l'emporte : gain = (octets que le lecteur typique ne charge plus) × (fréquence de chargement).

## La grille

Mesure d'abord (`wc -c`), puis décide.

| Taille | Décision |
| --- | --- |
| **≤ 12 Ko** | Ne pas éclater. Condenser si du récit ou des doublons s'y trouvent. |
| **12 à 20 Ko** | Condenser d'abord. Éclater seulement si les deux conditions sont vraies : **(a)** le skill couvre au moins deux sujets séparables, dont les fichiers (`paths`) ne se chevauchent presque pas ; **(b)** un lecteur typique n'a besoin que d'un des sujets. Sinon, le laisser et le surveiller. |
| **> 20 Ko** | Obligatoire (le test échoue). Condenser, puis éclater tant qu'il reste plus de 12 Ko. |

## Bien couper

- **Par sujet de lecture, pas par fichier** : on coupe là où un lecteur n'a besoin que d'une partie (« équipement porté » d'un côté, « acquis » de l'autre), pas en suivant l'arborescence du code.
- **Un noyau et des sous-skills.** Le noyau garde ce qui sert à tous (structure, invariants communs) et liste les sous-skills par leur nom. Chaque sous-skill a ses `paths` propres, plus étroits que ceux du noyau.
- **Entre 2 et 5 sous-skills**, davantage seulement si le budget de 12 Ko l'impose. Un morceau de moins de 1,5 Ko n'est pas un skill : il reste dans le noyau, sauf s'il a des `paths` vraiment à lui.
- **Un fait dans un seul skill.** Si deux sous-skills ont besoin du même fait, il va dans le noyau, ou dans le skill du sujet qui le possède et l'autre le cite.
- **Le sens inverse existe** : deux skills de la même zone qui se chargent toujours ensemble et tiennent à eux deux sous 12 Ko doivent être fusionnés.

## Ne pas éclater pour

- Se donner l'air court : c'est condenser qu'il faut.
- Mettre à l'abri du récit ou des doublons : ils se retirent, ils ne se déplacent pas.
- Suivre la forme du code : voir « Bien couper ».

## Procédure sûre

1. **Inventaire.** Lance `node scripts/skills-ecarts.mjs "$(git merge-base origin/dev HEAD)" <skill…>` (depuis `client/`) une fois les nouveaux skills écrits : la référence est le départ de la branche, jamais `origin/dev`, qui a pu bouger (faux manquants, vrais manquants cachés) ; il liste ce que l'ancienne version citait (identifiants, `R…`, fichiers, tests) et qui manque maintenant. Rien ne doit manquer, ou alors avec une raison écrite (obsolète, introuvable dans le code, dit par un document cité).
2. **Plan.** Écris la partition (sujets, noyau, `paths` de chacun) avant de rédiger, et mets-la dans ton rapport.
3. **Rédaction.** Suis `tenir-un-skill`. Aucun récit, aucune date.
4. **Renvois.** `git grep` de l'ancien nom dans `.claude/`, `CLAUDE.md`, `docs/` : tout renvoi est mis à jour. Pour un skill qui disparaît ou change de nom, signale-le au `leader-technique` : les fiches d'agents et `CLAUDE.md` sont à la session principale.
5. **Liste.** La section « Les skills » de `docs/equipe.md` cite chaque skill ; le test le vérifie.
6. **Validation.** `node --test test/instructions-claude.test.mjs` depuis `client/`.

Ton rapport donne : la décision et la ligne de la grille qui la justifie (tailles avant et après), la partition, le résultat du script d'écarts, les renvois mis à jour.
