---
name: diagnostiquer-la-ci
description: "Diagnostiquer un échec de la CI ou d'un contrôle local (reproduire, trouver la cause, distinguer ce qui vient de la PR de ce qui vient de la base, jamais de test sauté). À charger par tech-qualite ou leader-technique quand un check est rouge."
user-invocable: false
---

# Diagnostiquer une CI rouge

Les jobs sont décrits dans `.github/workflows/ci.yml` (`client`, `simulation-de-mise-a-jour`, `character-service`) et dans `garde-branches.yml` (le check `regles-de-branches`, job `pull-request`). Les règles de branches sont dans `docs/flux-git.md`.

1. **Le journal.** La session principale fournit, par les outils GitHub, le journal du job et l'état du même check sur le dernier commit de `dev`. Garder l'erreur exacte, le test et le fichier.
2. **Reproduire en local** sur la tête de la branche, avec la même commande que le job (`npm test`, `npm run build` puis les tests `*-html`, `db:check`…).
3. **Est-ce la PR ?**
   - Le même check est-il rouge sur `origin/dev` ? Si oui, l'échec vient de la base. Le dire avec la preuve. S'il existe un correctif (une PR ouverte, un revert), le reporter dans la branche ; il deviendra sans effet une fois la base corrigée.
   - Sinon, l'échec est à la PR : trouver la cause racine dans le diff.
4. **« Flaky » n'est pas une cause.** On ne relance un job que dans trois cas : il est mort avant tout test (checkout, installation, machine perdue) ; il est passé sur ce même commit ; ou on confirme un échec venu de la base. Une fois au plus. Un second échec est réel. C'est la session principale qui relance, à la demande du `leader-technique`.
5. **Jamais** sauter, désactiver ni mettre en quarantaine un test. Jamais de commit vide ni de PR refermée et rouverte pour relancer la CI.
6. **Le rapport** donne : le check, l'erreur, la cause (`fichier:ligne`), la correction proposée et le membre qui la fait : l'auteur de la zone (`tech-front`, `tech-back`, `tech-db`, `tech-sources`), ou `tech-qualite` pour un test transverse ou une aide. Puis `tech-publication` pousse la correction après un rebase.
