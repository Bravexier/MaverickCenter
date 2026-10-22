---
name: revue-de-diff
description: "Grille de relecture critique d'un diff (code, tests, données, instructions, agents) avant publication — bugs, cas limites, tests manquants, invariants de zone, fichiers fabriqués, cohérence avec les skills et les docs. À charger par tech-qualite pour relire un lot."
user-invocable: false
---

# Relire un diff

Relis d'un regard neuf, sans la conclusion attendue : `git diff origin/dev...HEAD`, `git log origin/dev..HEAD`, puis les fichiers autour. Pour chaque zone touchée, charge son skill (`zone-…`, `ui-…`, `site-…`, `base-…`) : ses invariants sont ta grille.

À chercher :

- **Correction.**
  - Bugs, cas limites (vide, `NULL`, premier et dernier, casse et accents passés par `normalize`), erreurs de bornes.
  - Une valeur déduite au lieu d'être lue dans la base ou dans une source (règle d'or).
- **Tests** (`tests-conventions`).
  - Une logique nouvelle sans test, un test qui épingle une valeur de l'import sans `historique-site`.
  - Un test sauté, un test qui ne peut pas échouer.
- **Invariants.**
  - Ceux du skill de la zone, et `site-version-portable` (module partagé par deux scripts de page, `src/lib` qui touche au navigateur).
  - Les identifiants figés, les listes à tenir ensemble (une table ajoutée : registres de l'API, des fiches, du journal).
- **Données.**
  - `data/rows` modifié à la main.
  - Une migration sans `db:doc` ni test (`revue-sql` pour le SQL).
  - Un fichier fabriqué commité (`client/src/content/wiki/`, `var/`, `dist/`).
- **Cohérence.**
  - Le diff contredit un skill, un doc, `CLAUDE.md` ou une décision R….
  - La doc de la zone n'est pas mise à jour.
  - Code mort, doublon.
- **Instructions** (`.claude/`, `CLAUDE.md`, docs).
  - Contradictions entre fichiers, rôles qui se chevauchent.
  - Chemins ou commandes qui n'existent plus, consignes qui ne disent pas quand s'appliquer.

Réponds en français, classé par gravité : **bloquant**, **à corriger**, **suggestion**, **question** (au propriétaire). Chaque constat donne `fichier:ligne`, sa preuve (commande et sortie, ou extrait) et le membre qui corrige. Si rien ne ressort, dis-le simplement.
