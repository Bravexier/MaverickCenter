# suivi-demande

Mod de Claude Code propre à ce dépôt : il suit chaque demande du propriétaire et l'affiche dans une page publiée à côté de la conversation (but, étapes, sous-tâches, temps, agents, GitHub, installation sur le site de dev).

Ce dossier n'est pas un skill (pas de `SKILL.md`) : Claude Code charge seul un mod rangé dans `.claude/skills/<nom>/`.

## Ce qu'il fait

- **Outil `mcp__suivi-demande__suivre`** : la session principale y déclare le but, les sous-tâches et leurs durées estimées, la phase, la branche, la PR, la CI et ce qu'elle attend du propriétaire. Une consigne ajoutée au prompt le lui rappelle ; les agents n'ont pas l'outil.
- **Relevé automatique** : agents en vie et leur état (toutes les 5 secondes), temps de travail de la session principale, ouverture et fusion d'une PR.
- **Page** : `page/suivi-demande.html`, publiée par la session (Artifact, capacités `db` et `user`). Le mod écrit l'état dans le document `suivi/etat` de sa base ; la page le lit en direct.
- **Installation** : après la fusion, le mod relit chaque minute la version servie par le site de dev. Dès qu'elle augmente, il clôt le suivi et demande à la session de supprimer la page.

## Limites

- L'état de la CI est déclaré par la session à chaque événement de la PR, pas lu sur GitHub.
- « Version servie qui augmente » ne prouve pas que cette PR-ci est installée si une autre a été fusionnée juste avant.
- Dans une session cloud, aucune surface ne dessine le panneau du mod : seule la page affiche le suivi.

## Contrôler

```
claude plugin validate .claude/skills/suivi-demande
claude plugin test .claude/skills/suivi-demande
```
