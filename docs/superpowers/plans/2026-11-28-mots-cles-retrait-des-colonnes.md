# Plan : chantier 4 des mots-clés, le retrait des colonnes

Conception : `docs/chantier-retrait-des-colonnes.md` (à lire avant toute tâche). Exécution : un agent par tâche, relecture après chacune, revue finale de la branche. Chaque tâche écrit le test de sa logique dans `client/test/` et ne lance que ce test et ceux de son diff ; le passage ciblé complet se fait en fin de PR.

Règles communes à toutes les tâches :

- Répondre et écrire en français ; aucun texte de règle ou de lore inventé, réécrit ou complété.
- Ne jamais lire `data/rows/*.sql`, `node_modules/`, `client/dist/`, `var/` (sauf les journaux), ni un fichier de plus de 60 Ko en entier (`Grep` puis `Read` avec `offset` et `limit`).
- Ne pas toucher : `api/`, `client/package.json` (version), `data/paquet.json`, `.claude/skills/**`, `data/rows/` hors `npm run db:migrate`.
- Aucune écriture Git : la session principale committe.
- Sorties courtes : `node ../tools/sobre.mjs <commande>` depuis `client/`.
- Un test porte sur le fonctionnement, jamais sur un texte modifiable sur le site de dev.

## Contrats partagés

**Table `repere`** (PR A) : `mot_cle_id INTEGER NOT NULL PRIMARY KEY REFERENCES mot_cle(id) ON DELETE CASCADE`, `nom TEXT NOT NULL` (non vide), `adresse`, `definition`, `couleur`, `icone` (NULL permis, mêmes `CHECK` que `mot_cle.url`, `description`, `couleur`, `icone` dans `data/schema.sql`), `STRICT`.

**Colonnes de `page`** (PR B) : `definition`, `couleur`, `icone`, NULL permis, mêmes `CHECK` que celles du mot-clé.

**Lire un mot-clé** (PR B) : `lib/mots-cles-db.mjs#motsClesDeLaBase` rend le même objet qu'avant (`id`, `libelle`, `cle`, `description`, `couleur`, `url`, `monnaie_id`, `icone`, `verrou`, `synonymes`, `categories`, `anciennes_cles`, `parent`, `element`). L'élément d'un mot-clé est sa page, sinon son sort, sinon son repère. Le SQL qui a besoin du nom, de la définition, de la couleur ou de l'icône lit la vue `v_mot_cle` (`id`, `cle`, `libelle`, `description`, `couleur`, `icone`, `verrou`, `monnaie_id`, `nb_pages`), jamais la table. L'adresse ne se lit qu'en JavaScript (`lib/mots-cles-db.mjs`), la vue ne la rend pas.

**Aide de tests** (PR B) : `client/test/aide-mots-cles.mjs#poserUnMotCle(db, { id, libelle, cle, url, description, couleur, icone, verrou })` insère le mot-clé et son repère ; `lireUnMotCle(db, id)` rend l'objet complet. Les tests n'écrivent plus `INSERT INTO mot_cle (… libelle …)` à la main.

## PR A : la table des repères (branche `feature/mots-cles-reperes`)

### A1. Structure et lot
- Migration `data/migrations/NNNN-reperes.sql` (numéro : le suivant du dépôt au moment de la tâche), `data/schema.sql`, `npm run db:migrate`, `npm run db:doc`.
- Registres : `lib/tables-de-la-base.mjs`, `lib/libelles-de-la-base.mjs`, compteurs épinglés (`debug-schema`, `serveur-debug-tables`…), `scripts/mise-a-jour-github.mjs#TABLES_DES_FILLES_DU_MOT_CLE`.
- Un lot `maverick-lot/1` insère, modifie et supprime une ligne de `repere` ; le service refuse un repère pour un mot-clé qui a une page ou un sort ; l'annulation d'une ligne retire le repère.
- `client/scripts/lot-des-reperes.mjs` : écrit, pour une base donnée, le lot qui pose le repère de chaque mot-clé sans page ni sort (nom, adresse, définition, couleur, icône recopiés du mot-clé). Sert aux tests et à la session, qui fabriquera le vrai lot depuis le site de dev.
- Tests : structure (`db-NNNN-reperes`), lot appliqué puis annulé sur une copie, refus sur un mot-clé ancré.
- Fait quand : `db:controler-migrations`, `db:check`, les tests du diff et `test:cible` passent.

## Entre les deux : le lot « repères » sur le site de dev (session principale)

Après la fusion de la PR A et l'installation sur le site de dev (structure à jour dans `/api/etat`) : fabriquer le lot depuis la base vivante, le déposer, l'appliquer, vérifier 26 lignes.

## PR B : le retrait (branche `feature/mots-cles-retrait-des-colonnes`)

### B1. Migration et socle (seule, d'abord)
- Migration suivante : `page.definition`, `page.couleur`, `page.icone` ; recopie des valeurs des mots-clés de page ; repère pour tout mot-clé sans page ni sort qui n'en a pas ; réalignement des repères existants sur les colonnes ; retrait de `libelle`, `url`, `description`, `couleur`, `icone` ; vue `v_mot_cle` refaite. Aucun littéral de texte.
- `data/schema.sql`, `db:migrate`, `db:doc`, registres et compteurs.
- `lib/mots-cles-db.mjs` : chargement par l'élément (objet inchangé), fonctions d'adresse et de nom pour le SQL direct.
- `client/test/aide-mots-cles.mjs`.
- Tests : structure ; aucune valeur perdue (comptes avant et après sur la copie du dépôt et sur une copie ancrée) ; objet identique champ par champ avant et après ; R268.
- Fait quand : la base se construit (`db:build`), `db:check` passe hors règles qui lisent encore les colonnes (listées dans le rapport).

### B2. Lecteurs (après B1)
- Modules `client/src/lib/` et pages qui lisent les colonnes par SQL (`mentions-des-mots-cles`, `citations-db`, `couleur-de-la-page`, `notion-db`, `index-des-pages`, `fiche-regles`, `adresses-db`, `mots-cles-liens`, `sortie-du-contenu`, `ressources/wiki`…), `scripts/db-derive.mjs`, `autolink.mjs`, `db-check`.
- Fait quand : `npm run build` et `db:check` passent sur la copie du dépôt et sur la copie ancrée.

### B3. Écritures du service (après B1 ; seule à écrire `serveur/edition.mjs`, `edition-ancrage.mjs`, `edition-adresses.mjs`, `edition-mots-cles.mjs`, `edition-chronologie.mjs`, `edition-notions.mjs`, `controles-du-contenu.mjs`)
- Conception §2 et §5 : création, renommage, Glossaire d'un mot-clé à repère, fusion, page de notion qui reprend un repère, suppression, verrou, contrôles du contenu.
- Adaptateur de rejeu (conception §6), enregistré dans `adaptateurDuJournal`.

### B4. Lots et annulation (après B1 ; seule à écrire `serveur/edition-lots.mjs`, `edition-ancrage-lots.mjs`, `lib/mots-cles-ancrage.mjs`, `lib/lot-de-changements.mjs`, `lib/lots-*.mjs`)
- Format de lot (conception §5), plan de l'ancrage (§9), annulation d'une ligne ancienne (§6).

### B5. Note de version, API v1, scripts et outils (après B1)
- `lib/notes-de-version.mjs`, `serveur/notes-de-version.mjs` (deux structures, conception §4).
- `lib/edition-modele.mjs`, `serveur/ressources.mjs`, `serveur/openapi.mjs`, `docs/api.md`.
- `client/scripts/liens-en-mots-cles.mjs`, `essai-variantes.mjs`, `baliser-mot-cle.mjs` ; `tools/db/maverick.py`, `tools/docs/codex.py`, `tools/sheets/*.py`.

### B6. Tests existants (après B2 à B5, en lots de fichiers disjoints)
- Chaque fichier de `client/test/` qui écrit ou lit les colonnes retirées passe à l'aide de tests ou à la vue. Aucun test n'est sauté ni affaibli : un test qui épinglait une copie (`mot_cle.libelle` égal au titre) épingle désormais la lecture par l'élément.

### B7. Docs et demande pour les skills
- `docs/serveur.md`, `docs/content-guide.md`, `docs/chantier-ancrage-mots-cles.md` (section du chantier 4), `docs/sql/*` par `db:doc`.
- `docs/demandes/` ou le dossier de notes partagé : la demande de mise à jour des skills pour `tech-skills`.

### B8. Revue et contrôles de fin
- Revue de la branche (`revue-de-diff`), puis `test:cible`, `db:check`, `db:controler-migrations`, `build`, et le circuit du paquet (`fabriquerPaquet`, contrôle du contenu à zéro) sur la copie ancrée.

## PR C : le type en colonne, les synonymes sur l'élément

Conception §8. Planifiée après la fusion de la PR B, si le temps de la session le permet.
