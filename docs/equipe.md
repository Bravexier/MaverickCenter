# L'équipe d'agents

Six agents (`.claude/agents/`), un rôle chacun, sans chevauchement, et des compétences (`.claude/skills/`) pour les travaux qui suivent une procédure. `CLAUDE.md` garde le contexte du projet ; ce document est la seule présentation de l'équipe (les consignes détaillées sont dans le fichier de chaque agent).

## Les membres

| Agent | Poste | Possède | Écrit ? | Ne fait pas |
| --- | --- | --- | --- | --- |
| `ingenieur-site` | Développeur du site | `client/`, `deploy/`, `.github/`, `tools/flux-git/`, `tools/build-artifact.mjs`, leurs docs | oui | données, migrations, publication |
| `ingenieur-donnees` | Responsable de la base et des importeurs | `data/`, `sources/`, le reste de `tools/` | oui | code du site, publication |
| `expert-sql` | Expert base de données : schéma, contraintes, intégrité, vues, index, migrations, portabilité, sûreté du SQL ; relit la base par lots | rien (rapport) | non | écrire la correction, juger le fond d'une valeur |
| `gardien-des-regles` | Garant de la règle d'or : contenu sourcé et conforme à `docs/decisions-regles.md` | rien (verdict) | non | juger le code, trancher une règle |
| `relecteur-critique` | Revue technique indépendante du diff, des tests et des instructions | rien (rapport) | non | juger le fond des règles |
| `chef-de-flux-git` | Publication : branche, rebase, PR, CI, fusion (`docs/flux-git.md`) | le flux git | git seulement | écrire du code ou des données |

Hors équipe : `api/` (existant d'avant le site, sans demande on n'y touche pas) ; `docs/decisions-regles.md`, où une nouvelle décision du propriétaire s'ajoute (session principale).

## Circuit d'un travail

1. Le code du site va à `ingenieur-site`, les données et le schéma à `ingenieur-donnees` ; un travail qui touche les deux est découpé, chacun reste dans son périmètre et signale à l'autre ce qu'il doit adapter.
2. Schéma, migration ou SQL nouveau : `expert-sql`. Contenu (règle, sort, race, don, monstre, texte) : `gardien-des-regles`.
3. `relecteur-critique` relit le diff en dernier, sans qu'on lui donne la conclusion attendue.
4. `chef-de-flux-git` publie et fusionne ; une CI rouge revient à l'ingénieur concerné, puis il repousse.

## Compétences

| Compétence | Pour | Qui la mène |
| --- | --- | --- |
| `relecture-db` (`.claude/skills/relecture-db/`) | Relire toute la base ou une section : audit automatique (`audit.mjs`), relecture par lots, rapport `docs/sql/relecture-AAAA-MM-JJ.md`, questions dans `docs/sql/a-valider.md` | La session principale répartit les lots et écrit la synthèse ; `expert-sql` constate, `gardien-des-regles` juge le fond, les ingénieurs corrigent chacun chez soi |

Règles communes : réponses en français ; jamais de règle inventée (une question ouverte se pose au propriétaire) ; `dev` → `master` seulement à sa demande.
