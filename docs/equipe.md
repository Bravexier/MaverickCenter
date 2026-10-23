# L'équipe d'agents

L'organisation est voulue par le propriétaire le 2026-10-22. La session principale ne délègue qu'à **trois chefs**, et chaque chef dirige une équipe de membres spécialisés.

- **Les agents** sont dans `.claude/agents/`.
- **Les procédures et les connaissances par zone** sont des skills (`.claude/skills/`), chargés seulement par l'agent qui en a besoin.
- **`CLAUDE.md`** garde le contexte commun : il est lu par tous les agents, il reste donc court.
- **Ce document** est la seule présentation de l'équipe. Les consignes détaillées sont dans le fichier de chaque agent, et le protocole dans le skill `circuit-des-demandes`.

## Les chefs

| Agent | Rôle | Écrit | Modèle, effort | Outils |
| --- | --- | --- | --- | --- |
| `leader-technique` | Le site : code, base, import, tests, CI, publication. Répartit, relance, tranche le technique, rend la synthèse | rien (il fait écrire) | opus, high | Agent, SendMessage, Read, Grep, Glob, Bash (lecture de l'état du dépôt), Skill |
| `game-design` | Les règles du jeu : garant de la règle d'or, consigne les décisions, rédige la spécification, demande au `leader-technique` ce que le site doit changer et vérifie la conformité ; juge le fond d'un lot technique qui touche une règle | `docs/decisions-regles.md`, questions de règles de `docs/sql/a-valider.md` et `orthographe-a-valider.md` | opus, high | Agent, SendMessage, Read, Grep, Glob, Edit, Skill |
| `worldbuilding` | Le lore : histoire, légendes, monde ; consigne les décisions de lore ; juge le fond d'un lot technique qui touche le lore | `docs/decisions-regles.md` (lore), questions de lore de `docs/sql/a-valider.md` et `orthographe-a-valider.md` | sonnet, high | Agent, SendMessage, Read, Grep, Glob, Edit, Skill |

Chaque chef précharge `circuit-des-demandes`. Les registres qu'écrit un chef sont publiés par `tech-publication`, à sa demande, par le `leader-technique`.

Les instructions générales (`CLAUDE.md`, agents, skills de procédure, ce document) sont tenues par la session principale, à la demande du propriétaire. Un skill de zone est tenu à jour par l'auteur de chaque changement de sa zone, dans le même lot. `tech-qualite` relit les deux, et `tech-publication` les publie.

## Les membres

| Équipe | Agent | Domaine | Écrit | Modèle, effort |
| --- | --- | --- | --- | --- |
| Technique | `tech-front` | Affichage, UX et UI : pages, composants, styles, scripts navigateur, modules de rendu, fiche côté page, version portable | `client/src/` sauf les modules du back, `client/public/`, `astro.config.mjs`, `client/package.json`, `tools/build-artifact.mjs`, docs des pages, ses tests | opus, high |
| Technique | `tech-back` | Service, API, édition et mise à jour du site de dev, modules qui lisent ou écrivent la base, performance, hébergement, CI | `client/serveur/`, `client/scripts/`, les modules de base de `src/lib` (liste fermée dans `leader-technique`), `deploy/`, `.github/`, `tools/flux-git/`, `.gitignore`, `.nvmrc`, `api/` (sur demande), `docs/serveur.md`, `api.md`, `flux-git.md`, ses tests | opus, high |
| Technique | `tech-db` | La base : schéma, migrations, `data/rows` par les outils, pages du wiki (`db:sync-pages`), vues, index, intégrité, optimisation | `data/`, `tools/db/`, `docs/sql/` (hors questions des chefs et rapprochement), ses tests | opus, high |
| Technique | `tech-sources` | Import des sources : originaux Google (R83), exports bruts, importeurs et extracteurs, rapprochement des classeurs | `sources/`, `tools/` (hors `db/`, `flux-git/`, `build-artifact.mjs`), `docs/sources.md`, `codex.md`, `fiche-auto.md`, `sql/rapprochement-classeurs.md`, ses tests | opus, high |
| Technique | `tech-qualite` | Tests et qualité : relecture indépendante de chaque lot et des instructions, couverture, contrôles, diagnostic de la CI | `client/test/` : aides, tests transverses (`site-html`, `defilement`, `tableaux`, `infobulles`), tests manquants | opus, high |
| Technique | `tech-publication` | Git : branche, commits, rebase automatique juste après le dernier commit et résolution des conflits, push | git, et la résolution des conflits mécaniques | sonnet, medium |
| Game Design | `gd-dons` | Classes, spécialités, dons de classe ; monstres et leurs capacités | rien (rapport) | sonnet, high |
| Game Design | `gd-magies` | Magies, sorts, NM, NPM, coûts, résistances entre magies, invocations | rien (rapport) | sonnet, high |
| Game Design | `gd-races` | Races, ethnies, peuples, magies innées ; combinaisons race × classe × magie | rien (rapport) | sonnet, high |
| Game Design | `gd-objets` | Armes, armures, boucliers, accessoires, consommables, bâtons, composants, artisanat, monnaies | rien (rapport) | sonnet, high |
| Game Design | `gd-mecaniques` | Combat, dégâts, postures, Mode Hyper et Super, altérations d'état, résistances, maladies, glossaire des règles | rien (rapport) | sonnet, high |
| Game Design | `gd-fiche` | Fiche de personnage et ses règles : création, compétences, acquis, niveaux, métiers, équipement porté, contrôles | rien (rapport) | opus, high |
| WorldBuilding | `wb-chronologie` | Chronologie : événements datés, Impacts, ordre, catégories | rien (rapport) | sonnet, medium |
| WorldBuilding | `wb-nations` | Continents, nations, régions, guildes et ordres, peuples et leurs relations | rien (rapport) | sonnet, medium |
| WorldBuilding | `wb-divinites` | Dieux, primordiaux, cosmologie, temples et cultes, races non jouables, objets légendaires | rien (rapport) | sonnet, medium |
| WorldBuilding | `wb-coherence` | Pertinence globale : contradictions, graphies, lore et règles, relecture de ce que l'équipe livre | rien (rapport) | sonnet, high |

## Les outils des membres

Chaque agent n'a que les outils de son rôle :
- **Pas de lancement d'agent.** Aucun membre n'a l'outil `Agent`.
- **Analystes.** Les membres de Game Design et de WorldBuilding ont Read, Grep, Glob, Bash (pour lire la base en lecture seule : `interroger-la-base`) et Skill. Ils n'écrivent aucun fichier.
- **Équipe technique.** Read, Grep, Glob, Edit, Write, Bash, Skill.
  - `tech-sources` a en plus `ToolSearch` et les outils Google en lecture seule (Drive, Sheets, Docs), pour les originaux.
  - `tech-publication` n'a que Read, Grep, Glob, Edit (pour résoudre un conflit mécanique) et Bash.
- **Skills préchargés.** Tous les membres préchargent `format-de-rapport`. Les analystes préchargent aussi `verifier-une-source`, l'équipe technique `tests-conventions`. Quelques membres préchargent en plus le skill de leur rôle : `base-sqlite`, `revue-de-diff`, `publier-une-branche` et `resoudre-un-conflit`.

## Choix des modèles

Le critère est le rapport qualité / jetons :
- **Opus, effort high** pour ce qui exige un raisonnement long sur une matière très liée :
  - les chefs Technique et Game Design ;
  - tout membre qui écrit du code ou des données dans ce dépôt aux invariants nombreux ;
  - la relecture ;
  - la fiche de personnage, qui intègre toutes les règles.
- **Sonnet** pour l'analyse d'un domaine borné : membres Game Design et WorldBuilding (high, ou medium pour le lore), le chef WorldBuilding (high), la publication git (medium).
- **Haiku** n'est pas retenu : aucune tâche n'est assez mécanique pour que l'économie compense le risque d'erreur.

## Le circuit

Le détail est dans le skill `circuit-des-demandes`.

1. **Le routage.** La session principale confie la demande, mot pour mot, au chef du domaine :
   - une règle à `game-design` ;
   - le lore à `worldbuilding` ;
   - le site et les événements des PR à `leader-technique`.
2. **Le travail d'équipe.** Le chef cadre et ne lance que les membres concernés, en parallèle si leurs tâches sont indépendantes. Il fait circuler entre eux ce qui touche plusieurs domaines, puis rend une synthèse.
3. **Une règle qui change le site.** `game-design` lance `leader-technique` avec sa spécification comme cahier des charges. Il vérifie ensuite que le livré dit bien la règle. À l'inverse, un lot technique qui change une règle ou le lore sans spécification passe, avant publication, au chef du domaine pour un verdict.
4. **Côté technique.** `tech-qualite` relit chaque lot une fois, en dernier. Juste après le dernier commit, `tech-publication` rebase sur la base et résout les conflits (ceux de données ou de sens par leur auteur), puis pousse. La session principale ouvre la PR vers `dev`, la corrige automatiquement avec le `leader-technique` (CI rouge, conflit, revue) et la fusionne dès que la CI est verte.
5. **Les doutes.** Un doute se pose à celui qui a fait la demande. Ce que seul le propriétaire peut trancher remonte jusqu'à la session principale, qui le lui demande. La réponse est consignée (`consigner-une-decision`).

Les membres d'une équipe se parlent par leur chef : il relaie, ou relance un membre avec `SendMessage`. Les chefs se lancent et se relancent librement. La profondeur est de trois niveaux sous la session principale : un chef lancé par un chef ne lance aucun chef, pas même celui qui l'a lancé, et met sa demande dans son rapport.

Un seul lot écrit à la fois dans l'arbre de travail, sur sa branche créée d'abord. Deux membres qui écrivent ou lancent des contrôles se suivent, et seules les analyses en lecture partent en parallèle. Le verdict de fond, ou la conformité, passe avant la relecture de `tech-qualite`.

## Les skills

**Procédures :**

| Skill | Pour | Qui |
| --- | --- | --- |
| `circuit-des-demandes` | Routage, briefs, rapports, relances, questions, profondeur | session principale, chefs |
| `format-de-rapport` | Le rapport d'un membre à son chef | membres |
| `poser-une-question` | Une question au propriétaire, et le registre `docs/sql/a-valider.md` | tous |
| `consigner-une-decision` | Ajouter R… à `docs/decisions-regles.md` | `game-design`, `worldbuilding` |
| `verifier-une-source` | Trouver et citer la source d'une règle ou d'un fait du lore | Game Design, WorldBuilding, `tech-sources` |
| `interroger-la-base` | Requêtes SQL en lecture seule | analystes, équipe technique |
| `ecrire-une-migration` | Changer le schéma ou les données | `tech-db` |
| `modifier-une-page-wiki` | Texte et frontmatter d'une page (`db:sync-pages`) | `tech-db` |
| `rapatrier-l-edition` | Reprendre un journal du site de dev | `tech-db` |
| `tests-conventions` | Écrire un test | équipe technique |
| `controles-avant-rendu` | Contrôles à lancer selon le changement | équipe technique |
| `revue-de-diff` | Relire un lot | `tech-qualite` |
| `revue-sql` | Juger du SQL et la base | `tech-db`, `tech-qualite` |
| `diagnostiquer-la-ci` | Une CI rouge | `tech-qualite`, `leader-technique` |
| `publier-une-branche` | Branche, push, PR, fusion | `tech-publication`, session principale |
| `resoudre-un-conflit` | Rebase automatique après le dernier commit et résolution des conflits selon leur nature | `tech-publication`, auteurs appelés sur un conflit |
| `corriger-une-pr` | Correction automatique d'une PR ouverte jusqu'à sa fusion | session principale, `leader-technique` |
| `relecture-db` | Relire toute la base, section par section | `leader-technique` (avec `tech-db`) |

**Connaissance d'une zone du site.** Ces skills ne sont pas proposés dans le menu `/`, et chacun déclare les fichiers de sa zone (`paths`) :
- **Apparition.** Le skill n'est proposé, et ne peut être invoqué, qu'après la lecture d'un fichier de sa zone. Avant, pour un brief ou une analyse, on lit directement `.claude/skills/<nom>/SKILL.md`.
- **Économie.** Un agent qui ne touche pas une zone ne paie rien pour elle.

Les skills :
- `zone-magies`, `zone-races`, `zone-classes`, `zone-metiers`, `zone-bestiaire` ;
- `zone-equipement`, `zone-armes`, `zone-armures`, `zone-accessoires`, `zone-composants`, `zone-ceinture` ;
- `zone-chronologie`, `zone-guide`, `zone-mots-cles`, `zone-recherche` ;
- `zone-fiche`, `zone-fiche-tableur`, `zone-fiches-base`, `zone-personnages-liste` ;
- `zone-menu`, `zone-accueil`, `zone-archives` ;
- `zone-service`, `zone-edition`, `zone-mise-a-jour`, `zone-api-rest`, `zone-debug-metriques`, `zone-hebergement` ;
- l'interface commune : `ui-tableaux`, `ui-infobulles`, `ui-defilement`, `ui-monnaies`, `ui-couleurs`, `ui-onglets` ;
- le socle et les données : `site-wiki-liens`, `site-version-portable`, `base-sqlite` (préchargé par `tech-db`, toujours proposé), `base-orthographe`, `sources-codex`, `sources-rapprochement`.

Chacun garde les invariants (« pièges ») et les choix du propriétaire de sa zone, et renvoie à la section de `docs/` qui la décrit.

## Règles communes

- **Les réponses** sont en français.
- **Jamais de règle inventée.** Une question ouverte se pose au propriétaire.
- **Les livraisons.** `dev` → `master` et les hotfix se font seulement à sa demande.
- **`api/`**, l'existant d'avant le site, n'est touché que sur demande.
