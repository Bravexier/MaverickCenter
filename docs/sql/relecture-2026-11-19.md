# Relecture complète de la base — 2026-11-19

Demande du propriétaire : « Fait une passe sur l'ensemble de la base de données pour repérer les optimisions à apporter ». L'accent est mis sur les
**optimisations** (index, vues, requêtes du code, structure, ménage, portabilité). Les autres constats sont relevés quand ils apparaissent, avec leur gravité.

La relecture suit la compétence `relecture-db` (`.claude/skills/relecture-db/SKILL.md`). Elle porte sur le schéma version 130 : 222 tables, 38 vues,
2 tables FTS5, 568 index, 460 clés étrangères et 45 071 lignes, soit 30,6 Mio.

**Comment elle a été menée :**
1. Audit automatique, depuis la racine du dépôt : `node --no-warnings .claude/skills/relecture-db/audit.mjs --sortie <scratchpad>/audit.md`, plus `--json`.
2. Six lots de sections relus en parallèle par des agents `tech-db`, en lecture seule. Chaque constat est prouvé par une requête, `EXPLAIN QUERY PLAN` ou une mesure de durée.

La base lue est `var/maverick.db`, bâtie depuis `data/rows`. C'est une copie datée : l'extrait du jour du site de dev n'a pas été lu.

**Rien n'a été corrigé.** Ce document est la liste de travail. Les corrections passent par les lots de PR du §« Lots de corrections proposés ».
La relecture précédente est [`relecture-2026-10-15.md`](relecture-2026-10-15.md). Chaque constat dit s'il y était déjà (« déjà relevé »), s'il est corrigé depuis, ou s'il est nouveau.

**État avant la relecture :**
- Sont verts : `db:check`, `db:pages-check`, `db:doc -- --check`, `integrity_check`, `foreign_key_check` (aucune violation).
- La base, `schema.sql` et `data/rows` sont d'accord sur les tables et sur `user_version` 130.
- Toutes les tables sont `STRICT` et ont une clé primaire.

## Bilan

| Lot | Sections | Bloquant | À corriger | Suggestion | Question |
| --- | --- | --- | --- | --- | --- |
| P | Préparation (outils) | 0 | 1 | 0 | 0 |
| A | 0, 1, 10, 11 (pages, liens, mots-clés, sources, transversal, dérivées) | 0 | 3 | 9 | 0 |
| B | 2, 3, 4, 5, 5 bis (règles de la fiche, magies, annexes, dieux, chronologie) | 0 | 2 | 7 | 1 |
| C | 6, 7 (classes, races) | 0 | 5 | 9 | 1 |
| D | 8, 8 bis (bestiaire) | 0 | 3 | 10 | 0 |
| E | 9 (équipement, ressources, craft, métiers) | 0 | 2 | 7 | 1 |
| F | 13, 14, 15 (fiches, édition, notes de version) et SQL du service | 0 | 2 | 14 | 2 |
| **Total** | | **0** | **18** | **56** | **5** |

**Constats réunis.** Quand deux lots ont relevé le même objet, il est compté une seule fois, dans le premier lot cité :
- `entite_fts` (A5, avec B5 et D10)
- convention des index (C3, avec E1)
- `v_capacite_partagee` (A7, avec C5)
- `valeursDAvant` (F8, avec B2)
- texte non NFC de Squelrail (A9, avec D12)

**Reclassés par le `leader-technique` :**
- E12 est écarté : le tri du 2026-10-15 l'avait jugé conforme à R10 et à la règle des noms de 0006.
- C15 (Volonté du Majin) passe en « à corriger » : R13 tranche, l'onglet est la source. Seule la voie de correction reste une question, C6.

**Avis d'ensemble.** La base est saine : aucun bloquant et aucune intégrité rompue. Toutes les vues répondent en moins de 1,5 ms. Les gains se trouvent ailleurs :
1. **Le SQL du service et des modules**, d'abord. Ce sont des relectures complètes faites là où un `WHERE` suffit, ou répétées à chaque appel :
   - `valeursDAvant`
   - `controlerLeContenu`
   - la note en préparation
   - `lotsEnConflit`
   - `composants-db`

   Chacune coûte de 50 ms à plus d'1 s. Les corrections sont simples et ne touchent pas le schéma.
2. **Les index sans lecteur**, ensuite : 56 index, environ 0,9 Mio, à tenir à chaque écriture. Ils viennent d'une convention périmée (« index sur toute colonne servant de filtre »), qui décrivait l'ancien `api/`.
3. **Les tables dérivées jamais lues** : `page_fts`, `entite_fts` et `lien*` font environ 16 % de la base. En plus, `page_fts` désaccorde le contrôle du contenu (A3).
4. **Les doublons de données** : prix des matériaux, type des matériaux d'armure, règle R11 recodée à sept endroits.

## Lots de corrections proposés

Une branche et une PR par lot, dans cet ordre. Chaque lot est relu par `tech-qualite` et publié par `tech-publication`.

| # | Lot | Constats | Qui | Migration |
| --- | --- | --- | --- | --- |
| L1 | **Performance du service et des modules** | A3, A4, A12, F8 (B2), F5, F6, F9, E9, D9 | tech-back | non |
| L2 | **Index : convention et ménage** | C3 (E1) : réécrire la convention ; C1, C2, D4, E2, A6 : retirer les index sans lecteur ; B4, D1, D2 : ajouter les index de clés manquants ; F3 : `modification_etat (etat, lot_id)` ; F11 : écrire l'exception des fiches ; test sur le modèle de `db-index-retires` | tech-db, puis tech-skills (convention dans `base-sqlite` et `revue-sql`) | oui |
| L3 | **Ordres et correctifs du service** | E8, E10, B7, C11, C12, C13, D3 (service), D11, P1 | tech-back, tech-db (P1) | non |
| L4 | **Vues et colonnes mortes, portabilité** | A7, B8, D6, D8, C6, B3, C7, F14, B9, D5, D13, B10 et F16 (liste admise de `conception.md` §10.4). Puis E3 et A5 une fois tranchés par le propriétaire | tech-db, tech-back, tech-front | oui |
| L5 | **Une donnée à un seul endroit, contraintes** | E4, E5, E6, C4 (vue `v_race_magie_innee`), D7, E7, C14, A2, B6, D3 (CHECK), A1, F1, F13 | tech-db, tech-back | oui |
| L6 | **Commentaires et documentation** | A10, B1 (commentaire et test), B11, C10, D14, D15, E11, F15, C9 | tech-db, tech-back (test) | non |

**À part :**
- A9 (Squelrail en NFC) se dépose comme lot de changements sur le site de dev, avec un contrôle NFC à ajouter à `db:check` dans L3.
- F7 (portrait hors de `personnage`), F4 (vue des maîtrises) et F10 (purge du journal) attendent les fiches de joueur : leur gain est faible aujourd'hui, leur effort moyen à fort.
- C8 est gardé tel quel : l'ordre recopié dans les deux matrices est l'image de la fiche, et le gain serait faible.

## Les dix optimisations les plus rentables

Classées par gain attendu contre effort.

| Rang | Constat | Gain | Effort |
| --- | --- | --- | --- |
| 1 | F8 (B2) `valeursDAvant` : filtrer `table_nom` en SQL | environ −100 ms à chaque chargement des règles de fiche (build, 58 fichiers de test) ; croît avec l'historique | faible |
| 2 | A4 `controlerLeContenu` : mettre `colonnes` en cache, lire `source_ref` une fois par table, clé directe au lieu de `CAST` | environ −0,6 s par appel, 4 appels par lot (essai et application) | faible |
| 3 | F3 index `modification_etat (etat, lot_id)` | `lotsEnConflit` passe de 49,5 à 0,5 ms à 3 000 lots ; croît avec le journal | faible |
| 4 | F9 mémoriser la note en préparation (`PRAGMA data_version`) | environ 200 ms de blocage évitées toutes les 15 s, pour chaque page ouverte | faible à moyen |
| 5 | C3 (E1) réécrire la convention des index : une clé étrangère, un index ; tout autre index justifié par une requête réelle | arrête la création d'index sans lecteur | faible |
| 6 | Ménage des index (C1, C2, D4, E2, A6) : une migration | environ 0,9 Mio et 56 index de moins à tenir à chaque écriture ; aucun plan ne se dégrade (mesuré) | faible |
| 7 | F5 et F6 : instruction préparée gardée par base, et filtre des prétirés en SQL dans `listerFiches` | −20 % par lecture de fiche ; ×9 sur la liste dès qu'il y aura des fiches de joueur | faible |
| 8 | E9 compter les citations des composants en une requête | 79,5 ms → 1 ms ; environ −40 ms au build | faible |
| 9 | A5 retirer `page_fts`, `entite_fts`, `lien`, `lien_candidat` et leurs deux vues (question au propriétaire) | environ −5 Mio (16 %) pour la base vivante, l'extrait et le téléchargement ; supprime aussi la cause de A3 | moyen |
| 10 | F4 réécrire `v_personnage_maitrise_arme` pour que le filtre atteigne les tables | contrôle d'une fiche : 8,3 → environ 1,7 ms à 1 040 fiches | moyen |

## Questions au propriétaire

Elles sont aussi ajoutées à [`a-valider.md`](a-valider.md), au §13. Les questions F2, F10 et F11 du 2026-10-15 (§4) restent ouvertes.

| # | Question |
| --- | --- |
| B1 | Les pages du guide réécrites sur le site ne portent plus la phrase de 15 constantes que la fiche applique. Ces valeurs restent-elles les règles ? À instruire d'abord par `game-design` (sources, décisions R…). Les constantes : barrière, entraînement (10 %, 15 compétences), Potentiel Illimité (5 de santé par niveau), bornes de caractéristiques, bonus de magie innée, acquis par point, ceinture, inventaire (5), maîtrise d'arme. |
| C6 | Reprise de la question C6 du 2026-10-15, posée autrement. Les bornes de caractéristiques des races doivent-elles devenir **modifiables sur le site**, comme les magies innées (R31) ? Exemple : R13 fait primer l'onglet, qui dit « La Volonté a un maximum de 3 » pour le Majin, mais la table, tirée de la fiche, borne à 3–4. Personne ne peut la corriger aujourd'hui, car les migrations ne portent plus de données. |
| E3 | Supprimer six vues que rien ne lit, quitte à ce que l'onglet DB ne les montre plus : `v_arme_composee`, `v_armure_piece`, `v_metier_recette`, `v_potion`, `v_ingredient_possible`, `v_ressource_recette`. Oui ou non. |
| A5 | Retirer la recherche plein texte de la base et les liens dérivés que le site ne lit plus : `page_fts`, `entite_fts`, `lien`, `lien_candidat`, `lien_page`, `lien_a_creer`. Cela revient sur le choix de forme F9. Ou bien les garder pour l'export, recalculés à chaque écriture. |
| E4 | Prix de l'Os : « 800 RF / 80 RO », avec `prix_rf` à NULL. Passe-t-il à 8 000 RF, la part en RO faisant foi (R49) ? À instruire par `game-design`. |

## Constats par lot

Colonnes : `#` | gravité | objet | constat | preuve | proposition | qui.
Les preuves sont abrégées ; les requêtes se rejouent sur `var/maverick.db`.

### Lot P — Préparation

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| P1 | à corriger | `tools/db/pages_md.py:159` (`db:pages-check`) | Nouveau. Le contrôle plante (`FileNotFoundError`) quand `client/src/content/wiki/` n'existe pas encore : c'est le cas sur un clone neuf, car le dossier est fabriqué par `db:export-pages` | `npm run db:pages-check` après `db:build`, sans export préalable | Message clair (« lancer d'abord `db:export-pages` »), ou export préalable dans l'outil | tech-db |

### Lot A — Pages, liens, mots-clés, sources, transversal, dérivées (sections 0, 1, 10, 11)

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| A1 | à corriger | `note_cellule.nature` | Déjà relevé, toujours ouvert. La nature n'est pas posée, alors que l'import la connaissait | `nature IS NULL` → 54 lignes (capacite 43…) | Migration, ou commentaire « NULL = non relevé par l'import » | tech-db |
| A2 | à corriger | `page_entite.principale` | Déjà relevé, toujours ouvert. Une ligne déroge à la convention, et aucun `CHECK` ne la garde | `(principale=1)<>(entite_id=page_id)` → 1 ligne (`fievre-des-marais#maladie`) | Poser `principale = 0` sur cette ligne, puis `CHECK ((principale=1)=(entite_id=page_id))` | tech-db |
| A3 | à corriger | `serveur/controles-du-contenu.mjs:427` (appelé par `edition-lots.mjs:309,348,359`) | Nouveau. Le service ne tient jamais `page_fts` à jour. Sur une base dérivée à jour, un lot qui crée ou retire une page fait naître le problème « page_fts : une ligne par page attendue » : l'essai et l'application refusent alors le lot. Une fois la base désaccordée, le contrôle devient aveugle | Copie dérivée, `INSERT INTO page`, puis `controlerLeContenu` → `nouveaux: ['page_fts : …']` | Ne comparer `page_fts` que sur une base qui vient d'être dérivée, ou la tenir à jour, ou la retirer (A5). Vérifier sur l'extrait si la base vivante est déjà désaccordée | tech-back |
| A4 | suggestion | `controles-du-contenu.mjs:100, 114-115, 213-225` | Nouveau. Le contrôle des corrections fait environ 55 % de `controlerLeContenu` (1,16 s par appel). La boucle porte sur 68 corrections × 151 tables, avec un `prepare` et un parcours complet à chaque fois. `PRAGMA table_info` n'est pas mis en cache, et `CAST(id AS TEXT)` empêche l'index. Le motif `LIKE` de `:218` retire `%` et `_` au lieu de les échapper (ex-A8, ouvert) | `LIKE` 10 268 appels, 420 ms ; `table_info` 11 966 appels, 211 ms ; variante qui lit une fois chaque table : 453 → 177 ms, mêmes 4 766 lignes | Mettre en cache, lire une fois par table, filtrer en JS, `WHERE "id" = ?` ; `ESCAPE` dans le motif | tech-back |
| A5 | suggestion | `page_fts`, `entite_fts`, `lien`, `lien_candidat`, vues `lien_page`, `lien_a_creer` (avec B5 et D10) | Déjà relevé, toujours ouvert. Seuls des `count(*)` les lisent à l'exécution. Le graphe affiché a disparu, et `wiki.ts:40-54` calcule encore `outgoing` et `incoming` sans lecteur. `entite_fts` indexe les balises brutes (`{{corruption\|CR}}`), oublie 23 tables de `page_entite` et tous les monstres, et aucun `MATCH` ne la lit | `dbstat` : FTS 4 908 Kio et `lien*` 104 Kio (≈ 16 %) ; `entite_fts LIKE '%{{%'` → 188 ; `GROUP BY entite_table` : aucun `monstre*` | Retirer (question A5), ou garder pour l'export en les recalculant dans la base vivante et en passant `entite_fts` par `texteSansBalises` | tech-db, tech-back, tech-front |
| A6 | suggestion | index `note_cellule_entite_table_entite_repond_a_fk` | Déjà relevé, toujours ouvert. Index complet sur une colonne toujours NULL ; la clé primaire suffit | `repond_a NOT NULL` → 0 | Le supprimer, ou le rendre partiel (L2) | tech-db |
| A7 | suggestion | vue `v_capacite_partagee` (`schema.sql:4402`, avec C5) | Déjà relevé, toujours ouvert. Aucun lecteur. C'est la seule vue avec `group_concat` et `char(10)`, hors de la liste admise. Elle regroupe sur `note_cellule`, une trace, au lieu de `remarque` | grep → 0 lecteur ; sur `remarque` : les mêmes 5 lignes | La supprimer, puis retirer « group_concat (une vue) » de `schema.sql:23` | tech-db |
| A8 | suggestion | `page_entite`, `page_source`, `page_tag`, `alias`, `lien` | Nouveau. Ces tables à clé composite gardent un rowid, donc un index automatique qui recopie la clé | Index automatiques : ≈ 440 Kio | `WITHOUT ROWID`, si une autre migration reconstruit déjà ces tables | tech-db |
| A9 | suggestion | `bestiaire/squelrail` (`page.corps_md`, `creature.description`, avec D12) | Déjà relevé, toujours ouvert. Texte non NFC, le seul de la base | balayage NFC → 1 ligne par colonne | Lot de changements sur le site de dev ; contrôle NFC dans `db:check` | tech-db |
| A10 | suggestion | documentation | Déjà relevé, avec deux points nouveaux : `schema.sql` cite 19 fois `design.md`, qui n'existe pas (le fichier s'appelle `conception.md`) ; `db-derive.mjs:10-11` annonce une cascade inexistante | `schema.sql:78` « 330 pages » (il y en a 1 169) ; `conception.md:91` « 26 vues » (il y en a 38) ; §10.4 « 133 / 49 » (222 tables, 105 `WITHOUT ROWID`) | Mettre à jour, puis `db:doc` (L6) | tech-db |
| A11 | suggestion | `tools/db/exporter.py:40` | Nouveau. La base est ouverte en écriture alors que l'outil ne fait que lire | `sqlite3.connect(base)` | `file:…?mode=ro` | tech-db |
| A12 | suggestion | `lib/pages-db.mjs:77-79` | Nouveau. Le paramètre `ou` insère du SQL brut, et aucun appelant ne s'en sert | 2 appels, tous deux avec la valeur par défaut | Retirer le paramètre | tech-back |

### Lot B — Règles de la fiche, magies, annexes, dieux, chronologie (sections 2, 3, 4, 5, 5 bis)

Toutes les vues du lot passent par les clés, en 1,3 ms au plus.

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| B1 | à corriger | `regle_constante.texte`, `page_id` | Déjà relevé, toujours ouvert et plus étendu. 20 phrases sur 37 ne figurent plus dans leur page, contre 2 il y a un mois, car les pages ont été réécrites sur le site. La fiche lit pourtant `valeur`, et le commentaire « le chargeur vérifie » est faux | `instr(p.corps_md, r.texte)=0` → 20 lignes, encore 15 absentes une fois les balises retirées | Commentaire : « `texte` est la phrase de l'import » ; test de présence à l'état d'import (`aide-base-d-import.mjs`) ; question B1 | tech-db, game-design |
| B3 | suggestion | `magie_role` et son index | La table est vide depuis la 0117 (R237 (7)). Restent sa lecture (`magies-db.mjs:72`), son rendu (`MagiePage.astro:140`), son édition (`edition-modele.mjs:212`) et sa ressource `/api/v1/` | `count(*)` = 0 | `DROP TABLE`, puis retrait du code (L4) | tech-db, tech-back, tech-front |
| B4 | suggestion | `type_degats.magie_id`, `type_degats.mot_cle_id`, `posture_critique.competence_id` | Trois clés étrangères sans index, contre la convention | EQP → `SCAN` | Trois `CREATE INDEX`, partiels pour `type_degats` (L2) | tech-db |
| B6 | à corriger | `evenement.annee_fin` ; `posture_effet.inconvenient` | Déjà relevé, toujours ouvert. Deux `CHECK` manquent ; les données sont conformes | DDL | `CHECK (annee_fin IS NULL OR (annee IS NOT NULL AND annee_fin > annee))` ; `CHECK ((version='fiche') = (inconvenient IS NOT NULL))` | tech-db |
| B7 | suggestion | `serveur/edition-chronologie.mjs:218` | Déjà relevé, toujours ouvert. Un événement créé prend `max(rang)+1` au lieu de `rangLibre` | relu | `rangLibre` | tech-back |
| B8 | suggestion | `v_niveau.puissance_magique_max_feuille` | Déjà relevé, toujours ouvert. La colonne ignore `sans_magie_acquise` (la feuille est fautive, R16), n'a aucun lecteur, et coûte une sous-requête corrélée par ligne | 0 lecteur | Recréer la vue sans cette colonne | tech-db |
| B9 | suggestion | `mode_hyper_effet.commentaire` | Déjà relevé, toujours ouvert. La colonne double `remarque` (F11) | 1 ligne remplie | Reporter la note dans `remarque`, puis retirer la colonne | tech-db |
| B10 | suggestion | `schema.sql:892-893, 1053` | Portabilité : `char(10)` (déjà relevé) et `magie_id IS (CASE…)` (nouveau, depuis 0125) sont hors de la liste admise | grep | Ajouter `chr(10)` et `IS NOT DISTINCT FROM` à la liste admise | tech-db |
| B11 | suggestion | commentaires de `schema.sql` | En partie corrigé. Restent : `:438` (`db:export-rules`, `rules.json`, `design.md` sont absents) ; `:498` et `:533` (« chargeur ») ; `:707-708` (faux pour la Somnolence depuis R250) | `ls` ; `EXCEPT` | Réécrire, puis `db:doc` (L6) | tech-db |

B2 est réuni avec F8, et B5 avec A5.
**Corrigés depuis le 2026-10-15 :** B2 (en partie), B3, B5 (en partie), B7, B9, B13.

### Lot C — Classes et races (sections 6 et 7)

Les `nom_cle` sont égaux à `normalize(nom)`. Il n'y a aucun orphelin, et aucune requête n'est répétée par ligne au build.

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| C1 | suggestion | index `capacite_ligne`, `capacite_specialite` | Déjà relevé, toujours ouvert. Chacun est le début d'un autre index | Sur une copie sans eux, les plans passent par `capacite_emplacement` ; 0,65 → 0,69 ms | `DROP INDEX` (L2) | tech-db |
| C2 | suggestion | 20 index sans lecteur : 8 sur `race` (colonnes de la fiche), `ethnie_bonus_*` (6), `capacite_type`, `capacite_limite`, `capacite_nom_cle`, `classe_maitrise_arme_arme`, `classe_annexe_libelle`, `classe_maitrise_armure_objet` | En partie déjà relevé. Aucun filtre SQL sur ces colonnes | Sans les 22 index (C1 et C2), 47 plans comparés : 7 changent, et un autre index prend toujours le relais ; 164 Ko | `DROP INDEX` (L2) | tech-db |
| C3 | à corriger | `conception.md:88, 247, 263` ; `schema.sql:4410-4411` (avec E1) | Nouveau. La règle « index sur toute colonne servant de filtre, filtre refusé (400) sans index » décrit l'ancien `api/`. `/api/v1/` filtre sur toute colonne (`serveur/ressources.mjs:463-493`). Cette règle est la source de C2, D4 et E2 | `colonne_non_indexee` n'apparaît que dans `conception.md` | Nouvelle règle : un index par clé étrangère ; tout autre index justifié par une requête réelle et son `EXPLAIN QUERY PLAN`. Puis skills `base-sqlite` et `revue-sql` | tech-db, tech-skills |
| C4 | à corriger | vue `v_race_magie_accessible` | Déjà relevé, toujours ouvert. La vue ignore R11 (la liste de l'onglet prime), qui est recodée à 6 endroits : `schema.sql:5149`, `races-db.mjs:39-63`, `fiche-regles.mjs:199`, `corps-races.mjs:57`, `edition.mjs:3916`, `scripts/essai-variantes.mjs:124` | Nain : 15 magies dans la vue, 5 dans l'onglet | Une vue `v_race_magie_innee`, que tous les lecteurs lisent ; adapter `guide.test.mjs:224` et `lamia-corruption.test.mjs:24` | tech-db, tech-back |
| C6 | suggestion | `v_race_carac_borne` | Déjà relevé, toujours ouvert. `MAX(a,b)` et `MIN(a,b)` sont hors de la liste admise | audit §11 | Écrire un `CASE` | tech-db |
| C7 | suggestion | `classe.chose_a_savoir_lien` | Déjà relevé, toujours ouvert. Colonne toujours NULL, mais lue et affichée | 41/41 NULL ; `classes-db.mjs:100`, `ClassePage.astro:251-253` | La retirer, avec ce code | tech-db, tech-back, tech-front |
| C8 | suggestion | `race_magie.ordre`, `race_classe.ordre` | Nouveau. L'ordre est recopié dans les 29 races | 435/435 égaux à `magie.ordre` | **Gardé** (image de la matrice de la fiche ; gain faible) | — |
| C9 | suggestion | `tools/db/races_onglet.py:579-680, 729-736` | Nouveau. Le mode `--ecrire` réécrit la migration 0007, déjà livrée, et embarque une copie du DDL ; rien ne le lance | grep → rien | Retirer `--ecrire` et le DDL (≈ 110 lignes) | tech-db |
| C10 | suggestion | commentaires | `schema.sql:1869` dit « 14 autres races » : il y en a 16. `ethnie.slug` n'est pas `normalize(nom)` pour 2 ethnies. Le commentaire de `peuple` écrit « Supprémaciste » | `count(DISTINCT race_id)` = 13 | Corriger, puis `db:doc` (L6) | tech-db |
| C11 | à corriger | `edition.mjs:1053, 1258-1259` | Déjà relevé, toujours ouvert. Une race créée reçoit 0 en santé, chakra et vitesses ; une classe créée reçoit `?? 0` | code | Champs obligatoires à la création, ou NULL possible | tech-back, tech-db |
| C12 | à corriger | `edition.mjs:1389` (`estMiroir`) | Déjà relevé, toujours ouvert. Le miroir de l'Archimage ne tient qu'à l'égalité des `nom_cle` | 2 lignes | Lien explicite entre le don et la spécialité | tech-back, tech-db |
| C13 | suggestion | `edition.mjs:1584` | Déjà relevé, toujours ouvert. Une spécialité créée prend le rang max + 1 au lieu du rang libre | code | Rang libre | tech-back |
| C14 | suggestion | `race_don.ethnie_id`, `race_don_tableau_ligne.ethnie_id` | Déjà relevé, toujours ouvert. Rien n'oblige l'ethnie à être de la même race | 0 écart aujourd'hui | `UNIQUE (id, race_id)` et clé composite | tech-db |
| C15 | à corriger | `race_restriction_carac` : Majin, Volonté | Déjà relevé. La table borne à 3–4 (fiche V15.2.2), mais l'onglet dit « maximum de 3 », et R13 le fait primer. La table n'est pas modifiable, et une migration ne peut plus porter cette donnée | `v_race_carac_borne` → 3–4 ; `race_onglet.inconvenients` | Voie à trancher : question C6 | propriétaire |

C5 est réuni avec A7.
**Corrigé depuis le 2026-10-15 :** C5 (R210 appliquée et testée).

### Lot D — Bestiaire (sections 8 et 8 bis)

**Structure des sections 8 et 8 bis.** Ce n'est pas un doublon fautif : la séparation vient de la demande du propriétaire du 2026-10-11 et de R67. Les restes morts sont dans la section 8 (D5, D6).

**Vérifié sans écart :**
- `ep_min` : 0 écart sur 1 762.
- `sorts` et `liste_de_sorts`.
- Emplacements `{N}`.
- Les vues `v_creature_*` répondent en 1,4 ms au plus.

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| D1 | à corriger | `monstre_espece.groupe_id` | Déjà relevé, toujours ouvert. Clé étrangère sans index | EQP → `SCAN` | Index partiel `WHERE groupe_id IS NOT NULL` (L2) | tech-db |
| D2 | à corriger | `monstre_attaque_type.type` → `type_degats` | Nouveau (0130). Clé étrangère sans index | EQP → `SCAN … COVERING INDEX sqlite_autoindex_…_2` | `CREATE INDEX` (L2) | tech-db |
| D3 | à corriger | `monstre_capacite_commune.nom_cle` ; `serveur/edition-bestiaire.mjs:315, 505-515` | Déjà relevé, toujours ouvert. Il n'y a pas de `CHECK` de forme, et `normalize()` confond « X », « X+ » et « X++ » | 15 groupes de même `nom_cle` avec des `nom` différents | `CHECK` de forme ; le service compare le `nom` exact | tech-db, tech-back |
| D4 | suggestion | 14 index jamais choisis : `creature_sante`, `creature_vitesse`, `creature_attaque_nom`, `creature_attaque_type_type`, `creature_capacite_nom`, `creature_capacite_npm`, `creature_capacite_resistance_cible`, `invocation_resistance_cible`, `monstre_categorie`, `monstre_ep`, `monstre_defense_cible`, `monstre_espece_lieu_cle`, `monstre_rubrique_rubrique`, `monstre_par_espece` | En partie déjà relevé (D6). Aucune requête réelle ne les choisit, ou elles n'y gagnent rien | EQP de 30 requêtes ; `degats` : 0,36 ms avec l'index, 0,32 ms sans ; ≈ 560 Ko | `DROP INDEX` (L2) | tech-db |
| D5 | suggestion | `invocation.tableau_titre`, `tableau_sort_id` et leur index | Colonnes mortes depuis 0117 (R237 (7)) | 0 valeur non NULL | Les retirer à la prochaine reconstruction de `invocation` ; mettre à jour `tools/sources/ignorer/invocation.json` | tech-db, tech-sources |
| D6 | suggestion | vue `v_creature_sort` ; `creature_capacite.donnees` | La vue n'a aucun lecteur ; `donnees` n'est jamais lue (1 ligne remplie). En partie déjà relevé (D8) | grep | `DROP VIEW` ; commentaire « la table reste pour l'API » | tech-db |
| D7 | suggestion | `creature_attaque_type.type`, `.magie_id` ; `*_resistance.cible_degat` | Le vocabulaire est recopié dans des `CHECK`, et `magie_id` double `type_degats.magie_id` | 89 lignes, 0 orphelin, 0 écart | Clés étrangères vers `type_degats` ; retirer `magie_id`, puis la lire par jointure (`bestiaire-db.mjs:433`) | tech-db, tech-back |
| D8 | suggestion | `v_creature_magie` (`schema.sql:4131`) | `MAX(lien = 'marge')` : PostgreSQL n'a pas de `max(boolean)` | lecture | `MAX(CASE WHEN … THEN 1 ELSE 0 END)` | tech-db |
| D9 | suggestion | `serveur/edition-bestiaire.mjs:537-541` → `bestiaire-db.mjs:138,141` | Déjà relevé, toujours ouvert. Le même `{ capacites }` relit tout le bestiaire, portraits compris | 29 ms par appel, avec 0 portrait aujourd'hui | Requête ciblée, sans `portrait` | tech-back |
| D11 | suggestion | `monstre_espece_lieu.lieu_cle` | Déjà relevé, toujours ouvert. Clé vide pour « ??? », et les `CHECK` sont incomplets | `lieu_cle=''` → 1 ligne | Pas de ligne pour une clé vide (`lieux()`), puis un `CHECK` complet | tech-back, tech-db |
| D13 | suggestion | `monstre_capacite_commune.liste_de_sorts` | Déjà relevé, toujours ouvert. `DEFAULT 0`, contraire à l'en-tête | `schema.sql:2784` | Le retirer à la prochaine reconstruction | tech-db |
| D14 | suggestion | commentaires `schema.sql:2166, 2403, 2568, 2468, 2354, 19` | « 6 cas sur 105 » : il y en a 8. FPVSIA est tranché par R209 (1). Une deuxième colonne JSON existe | `sort_id IS NULL` → 8 | Corriger, puis `db:doc` (L6) | tech-db |
| D15 | suggestion | `docs/bestiaire.md:245` ; `test/serveur-edition-rejeu-capacites.test.mjs:135` | « En attente » pour l'Os du blizzard : le texte est périmé | grep | Mettre le texte à jour | tech-db, tech-back |

D10 est réuni avec A5, et D12 avec A9.
**Corrigés depuis le 2026-10-15 :** D4 (R209 (3), 0106) et D8 (en partie).

### Lot E — Équipement, ressources, craft, métiers (section 9)

Les 55 tables comptent 4 671 lignes et 128 index. Aucune table n'est vide ni morte, et aucune n'est utilement fusionnable : les fusions utiles se font au niveau des colonnes (E4 à E6). Les vues répondent en moins de 0,5 ms.

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| E2 | suggestion | 20 index sans clé étrangère ni lecteur : `ressource_prix`, `materiau_arme_bonus`, `materiau_armure_type`, `potion_famille`, `metier_peut_fabriquer`, `metier_bonus_cible`, `metier_recette_famille_famille`, `arme_cout`, `arme_nom_cle`, `arme_degats_type`, `armure_nom_cle`, `armure_ap_am`, `armure_type`, `armure_degats_type`, `bouclier_ap_am`, `accessoire_effet_bonus`, `accessoire_effet_cible_par_cible`, `familier_nom_cle`, `machine_guerre_degats`, `maladie_nom_cle` | Aucune requête du code ne les choisit. `accessoire_effet_propriete` double `accessoire_effet_cle` | grep et `EXPLAIN` ; 152 Ko | `DROP INDEX` (L2) ; `accessoire_effet_propriete` refait en `(propriete_id, ordre)` ou retiré | tech-db |
| E3 | question | `v_arme_composee`, `v_armure_piece`, `v_metier_recette`, `v_potion`, `v_ingredient_possible`, `v_ressource_recette` | Déjà relevé (E8), toujours ouvert. Aucun lecteur, mais chaque vue est rendue en entier dans `/donnees/<vue>/`. `v_potion` est mal commentée, et `v_arme_composee` inclut 196 armes de monstres | 2 254 et 1 452 lignes ; `v_arme_composee` ≥ 365 Ko | Question E3, puis `DROP VIEW` (L4) | propriétaire, tech-db |
| E4 | à corriger | `materiau_arme.prix_brut`, `prix_rf` ; `materiau_armure.prix`, `prix_brut` ; `materiau_bouclier.prix`, `prix_brut` | Déjà relevé, toujours ouvert. Ce sont des copies du prix de la ressource (R62), et le site lit `ressource` | 8 `prix_brut` différents et 9 `prix_rf` à NULL ; `ecart_source prix_incoherent` 9 + 1 (Os) ; le corps de la page Armes porte l'ancienne valeur | Retirer les 6 colonnes ; le code lit la ressource (`edition-composants.mjs:100-114`, `corps-armes.mjs:31`, `armures-db.mjs:180`). Prix de l'Os : question E4 | tech-db, tech-back |
| E5 | suggestion | `materiau_armure.type` contre `materiau.type` | Partie de l'ancien E9, toujours ouverte. Le type est écrit deux fois, et un seul module garde les deux d'accord | 21/21 identiques | Lire `materiau.type` et retirer la colonne | tech-db, tech-back |
| E6 | suggestion | `potion.rang` | Déjà relevé, toujours ouvert. Même valeur que `recette_produit.ordre` (185/185), et seule `v_potion` la lit | — | La retirer, avec `v_potion` | tech-db |
| E7 | suggestion | `bouclier.materiau_id`, `armure.materiau_ligne_id`, `armure.materiau_colonne_id`, `accessoire_monture.materiau_id`, `accessoire_effet_gemme.gemme_id` | Nouveau. Les clés visent `ressource(id)` : rien n'interdit un bouclier en « Herbe rouge » | 0 écart aujourd'hui | Clés vers `materiau_bouclier`, `materiau_armure`, `materiau` et `gemme` | tech-db |
| E8 | à corriger | `fiche-regles.mjs:368, 847` | Nouveau. `ORDER BY nom COLLATE NOCASE` ne replie que l'ASCII : dans le menu des métiers de la fiche, Éclaireur, Écrivain et Éleveur sont aux rangs 70 à 72, et Médecin vient après Myciculteur. L'ordre entre homonymes n'est pas fixé, alors que `fiche-moteur.mjs:733, 955` prend le premier trouvé | `row_number() OVER (ORDER BY nom COLLATE NOCASE)` ; homonymes : Bois, Gelée orange, Parchemin vierge | `ORDER BY nom_cle, id`, comme `metiers.mjs:118` | tech-back |
| E9 | suggestion | `composants-db.mjs:67-75, 96-112` | Une requête préparée par couple (ressource × 17 tables) | 79,5 ms → 29 ms en préparant une fois → 1,0 ms en une requête `UNION ALL … GROUP BY` | Une seule requête | tech-back |
| E10 | suggestion | `armes-db.mjs:94`, `fiche-regles.mjs:741` | Déjà relevé, encore ouvert ici (corrigé pour `armure_elementaire`). `ORDER BY ordre` a 11 ex aequo pour chaque valeur | `USE TEMP B-TREE` | `ORDER BY ordre, id` | tech-back |
| E11 | suggestion | `schema.sql:2988, 3412-3416, 3852` ; `test/arme-champs.test.mjs:120-122` | Déjà relevé, toujours ouvert. Commentaires périmés (« LUMIERE », « Nécomancie », « peut différer » contredit R62), et le test décrit un défaut déjà corrigé | données | Corriger, puis `db:doc` (L6) | tech-db, tech-back |

E1 est réuni avec C3.

### Lot F — Fiches, édition, notes de version (sections 13, 14, 15) et SQL du service

Les mesures sont faites sur une copie remplie de données fictives : 60 comptes, 1 040 fiches, 70 % avec un portrait de 300 000 caractères, et 3 000 lots. Aucune vue de la section 12 ne lit ces tables.

| # | Gravité | Objet | Constat | Preuve | Proposition | Qui |
|---|---|---|---|---|---|---|
| F1 | à corriger | `v_personnage_visible`, branche `groupe` | Déjà relevé, toujours ouvert, latent (rien ne lit la vue). Une inscription invalide rend visible une fiche privée, et des doublons sont possibles | copie remplie : 230 lignes sur des fiches privées | Joindre `personnage`, `DISTINCT` | tech-db |
| F2 | à corriger | `personnage_metier_bonus.competence_id` NOT NULL | Déjà relevé, toujours ouvert, latent. Un bonus « compétence OU attribut » ne peut pas se choisir | 0 rang de ce genre aujourd'hui | Attend la question F2 du 2026-10-15 (`a-valider.md` §4) | propriétaire |
| F3 | suggestion | index `modification_etat (etat)` ; `edition-conflits.mjs:80-83`, `scripts/db-appliquer-edition.mjs:69-70` | Nouveau. Le `EXISTS` filtre `lot_id` après l'index : le coût vaut nombre de lots × lignes en conflit | 3 000 lots : 49,5 ms → 0,5 ms avec `(etat, lot_id)` | Refaire l'index en `(etat, lot_id)` (L2) | tech-db |
| F4 | suggestion | `v_personnage_maitrise_arme` (lue par `maitrise_plafond`) | Nouveau. Le filtre `personnage_id` ne descend pas sous le `WITH` et le `GROUP BY` : contrôler une fiche calcule les maîtrises de toutes | 8,3 ms contre ≈ 1,7 ms ; `v_personnage_controle` 14,6 ms contre 5 ms | Réécrire la vue, avec un test d'égalité des lignes | tech-db |
| F5 | suggestion | `serveur/fiches.mjs:148, 226` | Nouveau. La requête de `v_personnage_controle` est préparée à chaque appel | préparation : 5,2 ms sur 23 ms | Instruction gardée par base (WeakMap) | tech-back |
| F6 | suggestion | `serveur/fiches.mjs:226` (`listerFiches`) | Nouveau. Les contrôles sont calculés pour toutes les fiches, puis les prétirés sont filtrés en JS | 190 ms → 21 ms | Filtrer en SQL | tech-back |
| F7 | suggestion | `personnage.portrait` | Nouveau. Le portrait, jusqu'à 700 000 caractères, est au milieu de la ligne : lire une colonne placée après lui parcourt le débordement | balayage 30 ms contre 0,7 ms ; copie 266 Mo contre 37 Mo | Table 1-1 `personnage_portrait` en BLOB, à faire quand il y aura des fiches de joueur | tech-db, tech-back |
| F8 | suggestion | `lib/historique-site.mjs:82, 121` (`valeursDAvant`), appelée deux fois par `fiche-regles.mjs:425` (avec B2) | Nouveau. La fonction lit et décode tout l'historique (1 475 lignes, 7 Mo) pour n'en garder que 102 | 56 ms par appel → 0,2 ms avec `WHERE table_nom = ?` (index existant) ; `chargerReglesDeFiche` 190 ms, dont 99 ms ici | Option `table` poussée dans le SQL (et dans `lireJournalEnAttente`) | tech-back |
| F9 | suggestion | `serveur/notes-de-version.mjs:213-236` (`noteEnPreparation`) | Nouveau. Toutes les 15 s, la note relit tout le contenu et refait la comparaison, en synchrone, pour chaque page ouverte | `lireTables` 103-148 ms, plus `comparerBases` 79-95 ms | Mémoriser le résultat selon `PRAGMA data_version`, `total_changes()`, la référence et le brouillon | tech-back |
| F10 | suggestion | `serveur/base-vivante.mjs:579-583` | Déjà relevé, toujours ouvert. Les lots livrés ne sont jamais purgés de `modification` | 346 lots livrés | Purger après `integrerLivrees`, ou le documenter | tech-back |
| F11 | suggestion | `personnage.metier_id`, `personnage_arme.*`, `personnage_inventaire.ressource_id`, `personnage_ceinture.ressource_id` | Déjà relevé, toujours ouvert. Clés sans index, mais chaque enregistrement réécrit toutes les lignes de la fiche | 0,1 à 0,3 ms | **Écrire l'exception** dans l'en-tête plutôt qu'indexer (L2) ; skill `zone-fiches-base` | tech-db, tech-skills |
| F12 | suggestion | `note_version.lot` | Déjà relevé. Le volet performance est sans objet ; l'unicité manque | 4 lignes | Index unique partiel | tech-db |
| F13 | suggestion | `note_version.depuis`, `note_version_ligne.cle` | Déjà relevé, toujours ouvert. Le `CHECK` est plus faible que celui de `version`, et `'{}'` est écrit au lieu de NULL | 12 lignes `'{}'` | Reprendre le `CHECK` ; `cle: null` | tech-db, tech-back |
| F14 | suggestion | `personnage.ambidextrie` | Déjà relevé, toujours ouvert. Colonne morte depuis R46 | seule `fiche-format.mjs:682` l'écrit | La retirer, puis l'ajouter à `COLONNES_RETIREES` | tech-db, tech-back |
| F15 | suggestion | `schema.sql:5582, 5782` | En partie corrigé. Commentaires faux : l'id n'est pas un UUID, et NULL n'est pas « rapatriée à la main » | code | Corriger (L6) | tech-db |
| F16 | suggestion | SQL du service | En partie corrigé. Restent hors de la liste admise : `json_each`, `COLLATE NOCASE`, `INSERT OR IGNORE`, `max(a, b)`, `json_type` avec chemin, `PRAGMA defer_foreign_keys` | grep | Compléter `conception.md` §10.4 | tech-db |
| F17 | question | `personnage.proprietaire_id`, `modification_lot.auteur_id` | Question F10 du 2026-10-15, toujours ouverte : que deviennent les fiches et les lots d'un compte supprimé ? | — | — | propriétaire |
| F18 | question | `historique_modification` | Question F11 du 2026-10-15, toujours ouverte : faut-il garder l'auteur des modifications ? | — | — | propriétaire |

**Corrigé depuis le 2026-10-15 :** F12 (amélioration du bouclier, R96).

## Constats écartés

Une ligne par sujet, avec la convention qui l'explique, pour ne pas les relire la prochaine fois.

**Lot A**
- Index de `regles_onglet` : couvert par la clé primaire.
- Provenance (`page_origine`, `correction_origine`, `famille.*`, `correction.classeur`) : retirée à la 1.0.
- `page_statut` : sert 8 lecteurs.
- `cle_page` en `UNION` : filtres sur index.
- Index créés après le chargement au build : aucun gain.
- Absence d'`ANALYZE` : les plans sont sur index.
- Espaces du texte : tel que la source.
- `page.donnees.rang` : transitoire, déjà écarté.
- `lien_candidat` vide : état sain.
- `note_cellule.repond_a` et `champ` : faits de la source.
- `entite_id` sans clé étrangère : F6.
- `ecart_source_entite` : sert `/api/v1/`.
- `group_concat … ORDER BY` de `derive.sql` : SQLite ≥ 3.45.

**Lot B**
- Index de filtre sur des tables de 420 lignes au plus : à revoir seulement avec la nouvelle convention (L2), pas avant.
- `mode_hyper_effet_version`, `sort_magie_niveau`, `magie_specialisation_id_magie` : servent.
- Vues de commodité de l'onglet DB couvertes par des tests (`v_resistance_combinaison`, `v_sort_bonus_au_nm`, `v_mode_hyper_lectures`, `v_competence`) : à garder.
- `sort` en rowid : lignes longues.
- `categorie_chronologie` et `evenement_categorie` vides : remplies sur le site.
- `type_degats` partiel : 0130, structure seule.
- Trous de rang, doubles espaces, `commentaire_orphelin` : faits de la source ou du site.

**Lot C**
- `capacite_niveau` : sert.
- Index des clés étrangères : convention.
- `v_regard_peuple` : 2,8 ms une fois par build.
- `maitrise_arme_part.source_id` : lié par des `CHECK`.
- `race_magie` 273 contre 272 : saisie du site.
- Colonnes NULL de Fongoïde et Gémidien : R239 et F3.
- Vues de consultation lues par des tests.
- Pas de `sqlite_stat1` : voulu.
- Slugs figés et trous de rang : conventions.

**Lot D**
- Sections 8 et 8 bis séparées : R67.
- Index de clés étrangères jamais choisis : servent au contrôle des clés.
- `monstre_attaque_type` vide : remplie par un lot du site (0130).
- `monstre_rubrique.texte` vide : R66.
- Trous de rang : R69.
- Portraits NULL : R65.
- Constantes : source et provenance.
- `creature_capacite_sort.sort_id` NULL : R209, rapprocher serait deviner.
- Lectures de `sqlite_master` et `json_extract` : 0,02 ms.

**Lot E**
- Index de clés étrangères à double colonne : convention.
- Tables sans lecteur sur le site (`familier`, `maladie`, `batiment`…) : F5, `/api/v1/`.
- Prix, AP et AM stockés de `bouclier` et `armure` : R207.
- E12 (« corails », « petite chitines ») : conforme à R10 et à la règle des noms de 0006 (tri du 2026-10-15).
- « Arc du rayon » sans portée : arme de monstre.
- `bonus_degats` constant : source.
- `instr`, `substr`, `GLOB` : admis.

**Lot F**
- Tables 13 et 14 vides : par construction.
- `historique_modification.nature` constante : 0127.
- Clés sans clé étrangère commentées (`lot_id`, `page_id`, `action_id`, `discord_id`) : voulues.
- `resolu_par` et `auteur_id` : petite table.
- `entree_id` : couvert.
- `journal_mode` DELETE : choix écrit (`serveur.md:298`).
- Pas d'`ANALYZE` : F3 se corrige sans statistiques.
- `prepare` dans `lireFiche` et `clesRompues` : coût négligeable.
- Sûreté : noms interpolés venus de constantes, valeurs liées, `foreign_keys` activé.
- `note_version.exemple` : fixtures.
- Santé négative : voulue.
- `v_personnage_visible` volumineuse : non lue.

## Refaire cette relecture

Depuis `client/` :
1. `npm ci`
2. `npm run db:build`
3. `npm run db:export-pages`, nécessaire avant `db:pages-check` (voir P1)
4. `npm run db:check`, `npm run db:pages-check`, `npm run db:doc -- --check`

Puis, depuis la racine, l'audit (commande en tête), et six lots `tech-db` en lecture seule (`relecture-db` §3).

Les scripts de mesure des lots (copies remplies, essais sans index) étaient dans le scratchpad de la session : ils ne sont pas conservés. Chaque preuve ci-dessus dit la requête à rejouer.
