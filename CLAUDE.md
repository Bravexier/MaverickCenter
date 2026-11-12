# Maverick Center — contexte pour Claude

Dépôt de **Maverick JDR** (jeu de rôle high fantasy) : un **wiki** des règles et du lore, et un **générateur de fiche de personnage**.
Site Astro statique (`client/`), service Node (`client/serveur/`), base SQLite versionnée (`data/`). Structure, commandes, accès aux sources et vision : `docs/depot.md`, à lire seulement au besoin.

L'interface et le contenu sont en **français**. Identifiants, fonctions et commits : en anglais ou en français, comme le code voisin.
**Claude répond toujours en français** au propriétaire, du début à la fin de chaque session (sa demande) : messages, comptes rendus, questions, corps des PR. Les agents rédigent aussi en français.

## Règle d'or : ne jamais inventer de règles

Les règles et le lore viennent du Discord « L'univers de Maverick » et de Google Docs et Sheets (`docs/sources.md`, manifeste `sources/sources.json`).
- **Ne rien déduire « par vraisemblance ».** Une règle, une statistique ou un nom du lore se cite depuis une source, ou reste absent.
- **Une question ouverte se pose au propriétaire** (skill `poser-une-question`). Ne la tranche jamais seul.
- **Un texte copié d'une source n'est pas réécrit** : Codex, citations « telles quelles », extraits de la chronologie.
- **Les fixtures ne sont pas du lore** : pages et données `status: example` / `meta.status: "example"`.
- **Les originaux Google font foi** (R83) ; ils se lisent par les connecteurs Google (`tech-sources`). Jamais de jeton Discord personnel.

## Décisions du propriétaire

`docs/decisions-regles.md` (R1 et suivantes) recense ses choix ; le code et les tests citent leur numéro (`R41`). On le lit par `docs/decisions-index.md`, puis par un `Grep` sur le numéro, jamais en entier.
- Les suivre, et ne jamais en déduire d'autres.
- Une nouvelle décision s'ajoute au registre, pas ici (skill `consigner-une-decision`).

## Sobriété en jetons (demande du propriétaire)

- **Chercher avant de lire.** `Grep` (avec `head_limit`) ou `Glob` d'abord, puis `Read` avec `offset` et `limit` autour du passage. Un fichier de plus de 60 Ko ne se lit jamais en entier (le hook `.claude/hooks/garde-lecture.mjs` le refuse) : `fiche-moteur.mjs`, `fiche.mjs`, `edition.mjs`, `data/schema.sql`, `docs/serveur.md`, `docs/content-guide.md`, `docs/sql/*`…
- **Ne jamais relire** un fichier déjà lu dans la session, ni un fichier qu'on vient de modifier.
- **À ne pas ouvrir** : `node_modules/`, `client/dist/`, `client/.astro/`, `var/`, `package-lock.json`, `data/rows/*.sql` et `sources/raw/` (on interroge la base : skill `interroger-la-base` ; `sources/raw/` est réservé à `tech-sources`), les images, `api/`.
- **Sorties courtes.** Tests, build et contrôles se lancent par `node ../tools/sobre.mjs <commande>` (depuis `client/`) : bilan d'une ligne, erreurs seules, sortie complète dans `var/journaux/` où l'on cherche par `Grep`. Sinon, filtrer (`| tail -20`, `git diff --stat`, `git log --oneline -10`).
- **Un skill ne se charge que s'il sert** à la tâche en cours, une seule fois par session.
- **Un agent ne se lance que s'il fait gagner du contexte** : chaque agent recharge ce fichier, ses skills et les fichiers qu'il lit. Son brief donne les chemins et les lignes déjà trouvés ; son rapport tient en vingt lignes, sans recopier de code.
- **Réponses brèves** : pas de reformulation de la demande, pas de récapitulatif de ce que montre déjà le diff.

## Organisation : circuit direct, puis trois chefs

**Circuit direct (décision du propriétaire, 2026-11-12).** La session principale fait elle-même, sans lancer d'agent :
- une question ou une analyse en lecture (règles, lore, code), dans le respect de la règle d'or ;
- un petit lot ou un correctif du site, quand **tout** ceci est vrai : au plus trois fichiers de code (tests exclus), une seule zone ; ni migration, ni schéma, ni donnée de `data/` ; ni règle de jeu ou fait de lore nouveau ou changé ; ni changement d'API ou de format enregistré.

Elle suit alors ce que les skills disent du « circuit court du `leader-technique` » : skill de la zone, code et test, un seul passage de tests à la fin, relecture de son diff (`revue-de-diff`), publication (`publier-une-branche`). Une difficulté imprévue (migration, deuxième zone, test rouge après deux corrections, règle à trancher) : elle passe la main au chef, avec ce qu'elle a déjà établi.

**Au-delà, elle ne délègue qu'à trois chefs**, qui dirigent leur équipe (`.claude/agents/`, présentation : `docs/equipe.md`). La demande est transmise mot pour mot.

| Chef | Domaine |
| --- | --- |
| `leader-technique` | Le site : code, base, import, tests, CI, publication, événement d'une PR |
| `game-design` | Une règle ou un mécanisme à créer ou changer. Il fait analyser, consigne, puis demande au `leader-technique` ce que le site doit changer |
| `worldbuilding` | Le lore à établir ou changer : histoire, légendes, monde |

- Un chef échange librement avec les deux autres et avec ses membres. Un membre ne parle qu'à son équipe, par son chef ; son rapport arrivé à la session principale est relayé mot pour mot à son chef (`SendMessage`).
- Une consigne envoyée à un membre déjà lancé ne change ni ses droits ni son brief : cela passe par un nouveau lancement.
- Un doute se pose à celui qui a fait la demande. Ce que seul le propriétaire tranche remonte à la session principale.
- Protocole complet : skill `circuit-des-demandes`, à charger seulement avant de lancer un chef.
- `CLAUDE.md`, les fiches d'agents et `docs/equipe.md` sont tenus par la session principale, à la demande du propriétaire. **Les skills ne sont modifiés que par `tech-skills`** (demandes remises par `leader-technique` ; `tenir-un-skill`, `eclater-un-skill`). `tech-qualite` relit les deux.

## Invariants transverses

**Avant de toucher une zone du site, charger son skill** (`zone-…`, `ui-…`, `site-…`, `base-…`, `sources-…`, liste dans `docs/equipe.md`) : il porte les invariants et les choix du propriétaire que les tests épinglent. Il n'est proposé qu'après la lecture d'un fichier de la zone ; avant, on lit `.claude/skills/<nom>/SKILL.md`.

- **La base est la source.** Les pages typées (magies, races, classes, métiers, armes, bestiaire, équipement…) sont rendues depuis les tables, jamais depuis leur Markdown. `data/rows` ne change que par les outils : une migration, `db:sync-pages`, `db:appliquer-edition` ou le workflow de mise à jour. `client/src/content/wiki/` est fabriqué (`db:export-pages`) et ignoré par git.
- **Le site de dev est la source de ce qu'il modifie.** La valeur d'import se lit dans `historique_modification` (`client/src/lib/historique-site.mjs`).
- **Identifiants figés.** Un nom corrigé ou renommé ne change jamais son identifiant ni son adresse.
- **Modules et scripts de page** (skill `site-version-portable`). `src/lib/*.mjs` reste sans dépendance navigateur ni Astro ; le code qui touche au DOM va dans `src/scripts/` ; deux scripts de page n'importent jamais le même module.
- **Provenance** (`famille`, `origine`, `source_ref`) : retirée à la 1.0, n'y rien investir.
- **`api/`** est inutilisé (le service actif est `client/serveur/`) : ne pas le modifier sans demande.
- **Feuille de route** : `docs/feuille-de-route.md` (E1 à E12) ; rien de propre au NAS hors de `deploy/`.
- **Tests** (`client/test/`, skill `tests-conventions`). Toute logique de règle ou de lien nouvelle a son test, écrit par son auteur.
  - **Pas de texte figé** : un test porte sur le fonctionnement, les formules et les règles, jamais sur un texte modifiable sur le site de dev.
  - **Un seul passage par lot**, en fin de lot : `npm run test:cible` (skill `choisir-les-tests`) et les contrôles, par `tech-qualite`, ou par celui qui mène un circuit direct ou court. Les auteurs ne lancent que le test qu'ils écrivent ; après une correction, seulement les tests en échec et ceux de son diff ; après un rebase, le recouvrement.
  - La CI lance la suite entière. Jamais un test sauté pour obtenir du vert.

## Git

Détail : `docs/flux-git.md` et skill `publier-une-branche`.
- **Branches.** `master` est la production, `dev` l'intégration. On ne crée que `feature/<nom>` depuis `origin/dev`, ou `hotfix/<nom>` depuis `origin/master` à la demande du propriétaire. `<nom>` dit le changement ; une branche au nom aléatoire se renomme avant le premier push.
- **Avant chaque push.** `git fetch --prune origin`, `git rebase` sur la base si elle a bougé, conflits résolus aussitôt (skill `resoudre-un-conflit`), puis push et PR. Jamais de fusion de la base dans la branche, sauf la refusion de `master` dans `dev`.
- **Ordre de passage.** Les PR dont les fichiers se recoupent passent dans l'ordre de leur numéro, sauf demande urgente du propriétaire ; la session principale annonce l'ordre, chacune ne rebase qu'à son tour.
- **Version.** Ne jamais modifier celle de `client/package.json` : le bot la tient.
- **PR.** Une PR ouverte se corrige automatiquement jusqu'à sa fusion (skill `corriger-une-pr`). Vers `dev` : fusion dès que la CI est verte, par « Create a merge commit ».
- **Attend le propriétaire** : `dev` → `master` et tout hotfix. Jamais `[V: X+1]` de soi-même.
