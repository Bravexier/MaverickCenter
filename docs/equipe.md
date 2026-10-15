# L'équipe d'agents

Cinq agents (`.claude/agents/`), un rôle chacun, sans chevauchement. `CLAUDE.md` garde le contexte du projet ; ce document présente l'équipe et son circuit.

| Agent | Rôle | Écrit ? | Ne fait pas |
| --- | --- | --- | --- |
| `ingenieur-site` | Développeur du site : pages, composants, scripts, fiche, service `/api/` (`client/`) | oui | données, migrations, publication |
| `ingenieur-donnees` | Base SQLite, migrations, `data/rows`, importeurs, orthographe (`data/`, `tools/`) | oui | code du site, publication |
| `gardien-des-regles` | Garant de la règle d'or : contenu sourcé et conforme à `docs/decisions-regles.md` | non | juger le code, trancher une règle |
| `relecteur-critique` | Revue technique indépendante du diff (bugs, tests, redondances, fichiers générés) | non | juger le fond des règles |
| `chef-de-flux-git` | Publication : branche, rebase, PR, CI, fusion (`docs/flux-git.md`) | git seulement | écrire du code métier |

## Circuit d'un travail

1. Le code du site va à `ingenieur-site`, les données et le schéma à `ingenieur-donnees` ; un travail qui touche les deux est découpé, chacun reste dans son dossier et signale à l'autre ce qu'il doit adapter.
2. Un changement de contenu (règle, sort, race, don, monstre, texte) passe par `gardien-des-regles`.
3. `relecteur-critique` relit le diff en dernier, sans qu'on lui donne la conclusion attendue.
4. `chef-de-flux-git` publie et fusionne ; une CI rouge revient à l'ingénieur concerné, puis il repousse.

Règles communes : réponses en français ; jamais de règle inventée (une question ouverte se pose au propriétaire) ; `dev` → `master` seulement à sa demande.
