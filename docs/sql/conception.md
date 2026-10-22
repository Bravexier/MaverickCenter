> **Conception du prototype.** Ce document décrit la conception validée en séance (schéma, pipeline, lots de livraison). Quand il diverge du schéma,
> **`data/schema.sql` fait foi** ; la structure à jour est dans [`structure.md`](structure.md) (générée). La « révision 2 » (identifiants fondés sur
> le contenu, maîtrises de départ, provenance) est dans le schéma mais pas encore réécrite ici. Les noms de fichiers cités (`tools_db.py`,
> `unified.load.py`…) sont ceux du prototype, qui n'est pas dans le dépôt.

# Refonte du stockage : une base SQLite, une API de lecture, un site qui lit la base

Conception unique issue de sept modèles par domaine (pages, magies, classes, races, bestiaire, équipement-craft, règles de la fiche), fusionnés dans
`schema.sql` et **exécutés pour de vrai** : 25 888 lignes réelles chargées (dont les 991 pages), 155 requêtes d'exemple vérifiées, site reconstruit à l'identique.
Tout ce qui est écrit ici comme « vérifié » a été rejoué par `bash run.all.sh` (voir §14). Ce qui est une proposition est dit explicitement (§12).

Sommaire : 1 décisions et feuille de route · 2 conventions · 3 le schéma · 4 pipeline et familles · 5 contrat des importeurs · 6 format d'export ·
7 API · 8 Astro, rules.json · 9 migration des pages · 10 évolution (migrations, identifiants, PostgreSQL) · 11 lots et tests · 12 points ouverts ·
13 comparatif des méthodes · 14 preuves · 15 fichiers.

---

## 1. Décisions actées, périmètre, feuille de route

Le propriétaire n'aime pas que la donnée des magies « soit un script » : la donnée doit être **dans une base**, chaque élément doit être **facile à récupérer**
(c'est le but premier du projet). Décisions prises (non rediscutées ici) :

1. **SQLite ≥ 3.45** (tables STRICT, FTS5, fonctions de fenêtre). Lecture : `node:sqlite` (Node ≥ 22.13, sans option). Écriture : `sqlite3` de la bibliothèque standard Python (`python3 -I`).
2. **Site Astro statique + API Node en lecture seule** dans Docker derrière nginx avec mot de passe. Aucune écriture par le web.
3. **La source de vérité reste Google Sheets / Docs** (copies dans le Drive du propriétaire depuis la migration `0014-sources-copies-drive` ; originaux de l'ancien mainteneur). La base est une **copie reconstruite** : l'import est idempotent et déterministe.
4. **Persistance dans git par export texte déterministe** (`data/rows/<table>.sql`). Le fichier `.db` n'est jamais commité ; les tables dérivées se recalculent.
5. **Règle d'or** : jamais de règle ni de valeur inventée. Absent = `NULL`, jamais une valeur par défaut ; chaque ligne importée garde sa provenance (`origine`, `source_ref`).
6. Conventions de nommage (§2) : français, singulier, snake_case, ASCII ; clés TEXT lisibles `<type>/<slug>` ; tables STRICT ; clés étrangères actives ; CHECK pour les énumérations.

### Ce que la feuille de route (`docs/feuille-de-route.md`) impose, et où c'est traité

| Exigence | Dans cette conception | Reste à faire (hors périmètre actuel) |
| --- | --- | --- |
| Le NAS est temporaire : rien de spécifique hors `deploy/` | Un seul artefact de données portable (`maverick.db`) ; l'API est un fichier Node sans dépendance configuré par variables d'environnement (`MAVERICK_DB`, `PORT`, `SCHEMA_VERSION`) ; nginx et `update-site.sh` ne sont qu'un habillage (§8.4) | Dockerfile de l'API (lot 3), choix de l'hébergeur |
| La base SQLite est le pivot : identifiants stables, jamais réutilisés | Identifiants lisibles stables entre deux imports ; **garde `db:ids`** (testée) : un identifiant qui disparaît doit être déclaré dans `data/redirections.json` (§10.2) | Table `redirection` et gel des identifiants à la bascule vers l'édition |
| SQL portable (PostgreSQL possible) | Les constructions propres à SQLite sont peu nombreuses, confinées et listées avec leur équivalent (§10.4) ; l'export de lignes est du `INSERT` standard | Convertisseur PostgreSQL si la bascule a lieu |
| Modifications historisées (qui, quand, avant/après, brouillon/validé) | **Rien n'est construit** (aucune table inventée) ; le schéma évolue par migrations additives (§10.3) | Tables d'historique et service d'écriture à la bascule |
| Les règles sont des données ; effets structurés codés à côté du texte, jamais devinés | Texte cité tel quel + `*_brut` ; une colonne typée seulement si la forme est sans ambiguïté, sinon `NULL` ; modèle d'extension `effet_<domaine>` (§10.5) | Codage progressif des effets |
| Moteur pur partagé (`src/lib/*.mjs`) | `rules.json` est **généré par des SELECT simples** (§8.3) ; aucun fichier de `src/lib/*.mjs` ne gagne de dépendance base | Adapter `character.mjs` aux vraies règles (lot 4) |
| Édition = API + authentification + rôles | L'API actuelle est en lecture seule ; la connexion est `readOnly` ; routes de lecture et d'écriture seront séparées | Service d'écriture, rôles lecteur/éditeur |

---

## 2. Conventions finales

**Nommage.** Tables au singulier (`sort`, `magie`, `capacite`), liaisons `<table>_<partie>` (`sort_type`, `race_magie`), clé étrangère `<table>_id`.
`nom` = libellé court d'une entité, `titre` = titre de page, `*_cle` = `normalize()` de `client/src/lib/text.mjs` (clé de recherche et de jointure par nom),
`*_brut` = texte de la source quand l'analyse en perd (115 colonnes `*_brut` pour 71 notions). Listes : `rang` = position 1-based **dans la liste d'un parent**,
`ordre` = position d'une entité dans sa liste d'origine ou d'un référentiel. Pas de colonne de dates ni d'auteurs (rien ne doit varier d'un import à l'autre).

**Identifiants (clés TEXT, lisibles, stables entre deux imports, jamais d'auto-incrément).**

| Cas | Forme | Exemple |
| --- | --- | --- |
| Page | `<type>/<slug>` (= chemin du `.md`) | `magies/magie-du-sang` |
| Entité qui a SA page | l'id de la page (même valeur dans `magie.id`, `capacite.id`, `race.id`…) | `capacites/mercenaire-chasseur-de-primes` |
| Sous-entité d'une page | `<id de la page>#<sorte>:<slug>` | `magies/magie-du-sang#sort:annulation` |
| Référentiel | clé courte | `force`, `ro`, `epee` |
| Clé naturelle numérique | le nombre | `niveau_global.niveau` |
| Clé composite (54 tables) | colonnes de la clé primaire ; **dans les adresses génériques** (`entite_id`) elles sont jointes par `\|` | `seuil_niveau` : `puissance_magique_max\|17` |

Limite assumée : un identifiant contient un nom (slug). Renommer dans la source change l'identifiant. Cas réel : la correction « Chasseur prime » → « Chasseur de primes »
(PR n° 9) a renommé `capacites/mercenaire-chasseur-prime` en `capacites/mercenaire-chasseur-de-primes`. D'où la garde `db:ids` (§10.2).

**Types.** `TEXT`, `INTEGER`, `REAL` (STRICT). Booléen = `INTEGER` 0/1 avec CHECK. Énumération = `CHECK ... IN (...)` (164 listes sur environ 560 contraintes CHECK ; vocabulaires partagés ci-dessous).
JSON seulement pour une structure irrégulière : `page.donnees`, `source.onglets` (`json_valid` en CHECK). Le Markdown de la page est conservé tel quel dans `page.corps_md`.

**Vocabulaires unifiés entre domaines** (un seul mot pour une même idée) :

| Notion | Valeurs |
| --- | --- |
| `famille.id` | `docs`, `fiche`, `annexes`, `magies`, `classes`, `races`, `bestiaire`, `equipement`, `craft`, `exemple` (= ordre d'import ; une famille ne dépend que des précédentes) |
| `page.statut` | `example`, `draft`, `verified` |
| `capacite.nature` | `classe`, `specialite`, `choix` |
| `sens` d'une résistance | `resistance`, `vulnerabilite` (+ `immunite`, `sensibilite` côté bestiaire ; référentiel `resistance_palier`) |
| `mode_hyper_effet.version` | `classeur_modes`, `magie_masque`, `onglet_magie`, `fiche`, `onglet_race` (cinq lectures, aucune préférée) |
| `note_cellule.nature` | `note`, `commentaire`, `commentaire_resolu`, `reponse`, `evenement` (+ `repond_a` : une réponse ou un événement pointe son commentaire) |
| `correction.nature` | `orthographe`, `accent`, `grammaire`, `ponctuation`, `casse`, `espace`, `frappe` (liste fermée du registre `tools/sheets/corrections.json`) |
| `ecart_source.nature` | 12 valeurs (`valeur_differente`, `texte_different`, `nom_different`, `valeur_absente`, `calcul_different`, `coquille_rapprochee`, `prix_incoherent`, `doublon_de_nom`, `ecart_entre_onglets`, `ecart_avec_fiche`, `forme_non_reconnue`, `conflit_entre_sources`) |

**Provenance.** Toute table importée (125 tables) a `origine` (FK vers `famille`) et `source_ref` : « classeur › onglet › plage » (ex. `Classe Maverick V7 › Mercenaire › AA22:AG27`).
Exceptions : `famille`, `type_page`, `source`, le vocabulaire des mots-clés (`mot_cle`, migration 0043 : il vit sur le site de dev ; glossaire et jamais créé par un import depuis 0056), les panneaux de règles de la page Équipement (`panneau_regles`, `panneau_regles_bloc`, migration 0056 : modifiés sur le site de dev), les onglets de la page Composants (`composant_onglet`, migration 0057 : de même), les annonces que le site place (`annonce`, migration 0068 : de même), les enfants d'une page (`alias`, `page_tag`, `page_source`), les catégories de la chronologie et celles d'un événement (`categorie_chronologie`, `evenement_categorie`), les étiquettes des sorts (`sort_mot_cle`, migration 0067 : une décision du propriétaire, R114) et les tables dérivées.

**Absent = NULL.** Une valeur typée n'est écrite que si la forme est sans ambiguïté ; sinon `NULL` et la colonne `*_brut` fait foi. Les faits « constatés mais non tranchés »
(deux sources qui se contredisent, une coquille, un prix incohérent) vont dans `ecart_source`, **sans rien corriger**. Les corrections voulues par le propriétaire passent par le registre (§4.4).

**Index, clés étrangères.** `PRAGMA foreign_keys = ON` à **chaque** connexion (SQLite ne le mémorise pas). Index sur toute colonne servant de filtre ; index partiel `WHERE col IS NOT NULL`
pour les clés étrangères clairsemées (l'API les reconnaît). `ON DELETE CASCADE` seulement pour les enfants d'une page (10 cas) et les porteurs d'un mot-clé ou d'une catégorie (`page_tag`, `evenement_categorie` : en supprimer un le retire de partout, migration 0043). Pas de cascade pour les étiquettes des sorts (`sort_mot_cle`, migration 0067) : une étiquette est une règle posée par décision (R114), un mot-clé qui étiquette un sort ne se supprime pas. Plus de 300 index.

**Tables dérivées et vues.** Une table dérivée est précédée d'une ligne `-- @derivee <commande>` : l'export l'ignore, `db:build` la remplit (§4.3). Quatre tables dérivées, 26 vues (toujours à jour).

**Plein texte.** FTS5, `tokenize = 'unicode61 remove_diacritics 2'` (accents et casse ignorés). `page_fts` (titre 6, alias 5, mots-clés 4, résumé 2, corps 1) et `entite_fts`
(nom 6, contexte 2, texte 1) : **une seule table pour toutes les entités typées** (elle remplace les six index que les analystes avaient chacun posés).

**Transversal.** `page_entite(entite_table, entite_id, page_id, principale, origine)` : quelle page porte quelle entité (adresse générique, sans clé étrangère ; contrôlée par `db:check`).
`note_cellule` : notes et fils de commentaires des classeurs, par entité. `ecart_source` : écarts entre sources. `correction` : trace du registre de corrections.

---

## 3. Le schéma unique

`data/schema.sql` : 2 919 lignes, **131 tables de base** (toutes STRICT, 49 WITHOUT ROWID), **4 tables dérivées** (`lien` et `lien_candidat` STRICT, deux tables FTS5), **26 vues**, `PRAGMA user_version = 1`. Il s'exécute d'un bloc sur une base
vierge (Python et Node). Les 131 tables de base sont **toutes non vides** une fois les sept domaines et les pages chargés.

| § | Domaine (famille) | Tables | Lignes | Pièces principales |
| --- | --- | ---: | ---: | --- |
| 0 | Registre des importeurs | 1 | 10 | `famille` |
| 1 | Pages, liens, mots-clés, sources | 8 | 9 684 | `type_page`, `page` (991), `alias`, `mot_cle`, `page_tag`, `source`, `page_source`, `page_entite` |
| 2 | Règles de la fiche (`fiche`) | 11 | 202 | `caracteristique`, `competence` (30), `niveau_global`, `seuil_niveau`, `regle_constante`, `posture`, `posture_effet` |
| 3 | Magies et sorts (`magies`) | 14 | 1 276 | `magie` (15), `sort` (322), `sort_type`, `sort_etat`, `magie_resistance`, `magie_incompatibilite`, `amelioration_cadaverique`, `regle_magie` |
| 4 | Annexes des magies (`annexes`) | 14 | 1 257 | `etat` (20), `etat_stade`, `resistance_magie`, `resistance_duo`, `meteo`, `mode_super_objet`, `mode_hyper_effet` (246, cinq lectures fusionnées) |
| 5 | Dieux | 1 | 28 | `dieu` |
| 6 | Classes (`classes`) | 7 | 1 050 | `classe` (39), `specialite` (78), `capacite` (**660 : une ligne par page `capacites/*`**), `objet_depart`, `classe_objet_depart` |
| 7 | Races (`races`) | 9 | 6 514 | `race` (27), `ethnie` (96), `race_classe` (1 053), `race_magie` (405), `peuple` (69), `relation_peuple` (4 761), `echelle_relation` |
| 8 | Bestiaire (`bestiaire`) | 15 | 1 124 | `invocation`, `creature` (63), `creature_attaque`, `creature_capacite`, `creature_capacite_sort` (liens vers `sort`) |
| 9 | Équipement, ressources, craft, métiers (`equipement`, `craft`, `docs`) | 49 | 4 460 | `ressource` (553), `recette`, `potion`, `arme` (161), `armure` (242), `bouclier`, `accessoire_*`, `familier`, `metier` (72), `maladie` |
| 10 | Transversal | 3 | 283 | `note_cellule` (171), `ecart_source` (111), `correction` (1) |
| 11 | Dérivées | 4 | 4 322 | `lien` (39), `lien_candidat`, `page_fts` (991), `entite_fts` (3 292) |

### Ce que l'architecte a fusionné, unifié ou retiré

| Décision | Pourquoi |
| --- | --- |
| **Une seule `page_entite`**, avec `origine` et un index sur `entite_id` (les analystes l'avaient chacun redéfinie) | Une requête dit à quelle page appartient n'importe quelle entité (`GET /entites/{id}`) |
| **Une seule `entite_fts`** remplace `sort_fts`, `capacite_fts`, `ethnie_fts`, `creature_fts`, `equipement_fts`, `regle_fts` | Un seul `MATCH` pour toute la base ; plus de six index à tenir à jour |
| **Une seule `note_cellule`** (+ `repond_a` pour les fils) remplace `sort_commentaire`, `creature_note`, `equipement.note_cellule` et la colonne `capacite.note_cellule` | Notes d'une entité en une requête ; l'importeur des commentaires `.xlsx` n'écrit qu'un endroit |
| **Une seule `ecart_source`** remplace `ecart_source` (fiche) et `anomalie_source` (équipement) ; `id` = clé naturelle en clair (CHECK) | Les écarts entre sources s'interrogent partout pareil |
| **`mode_hyper_effet`** fusionne `magie_mode_hyper`, `race.capacite_hyper` et la table des règles ; 5 versions ; aucune n'est préférée | Les lectures du mode hyper divergent (12 textes sur 29) ; le choix appartient au propriétaire (§12) |
| **`capacite` : une ligne par page `capacites/*`** (fusion de `capacite` et `classe_capacite`) ; `v_capacite_exclusive` calcule les choix exclusifs d'une même ligne | Décision du propriétaire : une page par emplacement ; les choix exclusifs redonnent exactement les 660 pages (`choix_exclusif_avec`) |
| **`dieu`, `caracteristique`, `etat`** : une table commune à tous les domaines | Les analystes les avaient chacun esquissées |
| Vocabulaire `sens` : `resistance` / `vulnerabilite` partout (l'ancien `faiblesse` est refusé par CHECK) | Les résistances de magie, d'armure et de créature se comparent |
| `peuple`, `relation_peuple`, `echelle_relation` ajoutées | Onglet « Relation entre les races » (4 761 cases lues une à une, 0 écart avec la page du dépôt) |
| `correction` : **trace miroir** de `tools/sheets/corrections.json` (colonnes alignées sur le registre) ; les trois « corrections proposées » des analystes sont retirées | Le registre du propriétaire est la source ; la base ne saisit rien |

---

## 4. Pipeline, familles et réimport

### 4.1 Le flux

```
Google Sheets / Docs (source de vérité, copies du propriétaire)
   │  tools/sheets/xlsx_to_json.py, sheets_api_to_json.py, tools/import-gdocs.mjs      (existants)
   ▼
dumps JSON ─► tools/sheets/corriger-dump.py   (registre tools/sheets/corrections.json, appliqué AVANT les extracteurs)
   ▼
importeurs Python  tools/sheets/<famille>.py     via  tools.db.session('<famille>')    (python3 -I, bibliothèque standard)
   │      reconstruit la base en mémoire depuis data/rows  ─►  remplace les lignes de la famille  ─►  exporte
   ▼
data/rows/<table>.sql   131 fichiers, commités, export déterministe            ◄── seule persistance versionnée
   ▼  npm run db:build   (Node : schema.sql + lignes ─► var/maverick.db ; puis tables dérivées)
var/maverick.db  (jamais commité) ─► npm run db:check  ─► npm run db:ids (CI : garde d'identité)
   ├─► astro build : loader de contenu + index des [[liens]] ─► client/dist (statique)
   ├─► npm run db:export-rules ─► client/src/data/rules.json (généré)
   └─► API en lecture seule (api/db-reader) ─► /api/v1 derrière nginx
publication : branche `site` = site statique + data/maverick.db + code de l'API ; NAS : update-site.sh (remplacement atomique)
```

Reconstruction complète d'une base depuis `data/rows` : **0,44 s** en Python, **1,4 s** en Node (construction + dérivées + contrôles).

### 4.2 « Supprime et réimporte une famille »

Toute ligne importée porte `origine` = l'id d'une famille. Remplacer une famille = `DELETE FROM <chaque table qui a une colonne origine> WHERE origine = :famille`, **dans une transaction** :

1. `BEGIN` ; `PRAGMA defer_foreign_keys = ON` : les clés étrangères ne sont contrôlées qu'au `COMMIT`.
2. Suppression, tables rangées enfants d'abord (graphe des clés étrangères). Les enfants d'une page (`alias`, `page_tag`, `page_source`, `page_entite`, `lien`) partent en cascade ; l'importeur les réécrit avec `f.page()` / `f.entite()`.
3. L'importeur réinsère. À la sortie du bloc : suppression des `source` que plus aucune page ne cite, `PRAGMA foreign_key_check` ; s'il reste une violation (par exemple une magie disparue que des races citent), **`ROLLBACK`** : rien n'est modifié, `data/rows` n'est pas touché.
4. `COMMIT`, puis export.

Vérifié (§14) : réimporter à l'identique les familles `bestiaire` (1 541 lignes), `annexes` (1 107), `races` (6 769), `classes` (2 614), `equipement` (3 996) laisse la base identique, **les 131 fichiers de `data/rows` identiques octet pour octet** ;
un réimport incomplet est refusé et rien ne bouge.

### 4.3 Tables dérivées (jamais exportées)

| Table | Calculée par | À partir de |
| --- | --- | --- |
| `lien`, `lien_candidat` | `client/scripts/db-derive.mjs` | `page.corps_md`, avec le code du site (`wikilinks.mjs`, `text.mjs` : `normalize()`, résolution des `[[liens]]`) |
| `page_fts` | `db-derive.mjs` | titre, alias, mots-clés, résumé, corps |
| `entite_fts` | `data/derive.sql` (SQL pur, idempotent) | 33 types d'entités typées |

`db-derive.mjs` refuse de calculer si une clé stockée (`titre_cle`, `alias.cle`, `mot_cle.libelle_cle`, les `*_cle` des entités typées) diffère de `normalize()` du site : la copie Python ne peut pas dériver en silence. Option `--sans-exemples` : voir §8.2.

### 4.4 Corrections orthographiques

Le propriétaire a décidé (PR n° 9) : les coquilles de la source se corrigent dans le **registre versionné** `tools/sheets/corrections.json`, appliqué au dump **avant** les extracteurs
(`tools/sheets/corriger-dump.py`). Les colonnes typées, les `*_brut` et les index plein texte portent donc déjà le texte corrigé. La table `correction` n'est qu'une **trace** :
`f.corrections(registre, '<dump>')` la recopie (origine = famille qui lit le dump). Garde `db:check` : pour chaque correction `v`, au moins une ligne dont la `source_ref` couvre la cellule porte `apres`, aucune ne porte plus `avant`.
Exemple chargé : `classes-v7` › Mercenaire › AC22, « Chasseur prime » → « Chasseur de primes ».

---

## 5. Contrat des importeurs Python (`tools/db/`)

Module commun, **bibliothèque standard uniquement** (prototype : `tools_db.py`, 430 lignes, + `tools_pages.py`, 208 lignes). Un importeur s'écrit ainsi :

```python
from db import session, normalize

with session('magies', rows='data/rows') as f:       # 1. reconstruit en mémoire depuis data/rows (jetable : aucun état résiduel)
                                                     # 2. BEGIN ; clés étrangères différées ; DELETE ... WHERE origine = 'magies' dans toutes les tables
    f.page({'id': 'magies/magie-du-sang', 'type': 'magies', 'slug': 'magie-du-sang', 'titre': 'Magie du Sang', 'corps_md': corps,
            'statut': 'draft', 'resume': None, 'donnees': None, 'aliases': [...], 'tags': [...], 'sources': [...], 'source_ref': '...'})
    f.inserer('magie', id='magies/magie-du-sang', nom='Sang', nom_cle=normalize('Sang'), source_ref='Magie Maverick V8 › Sang › A1:H9')
    f.entite('magie', 'magies/magie-du-sang', 'magies/magie-du-sang', principale=True)
    f.note('sort', id_sort, rang, texte, source_ref, champ='effets', cellule='BJ13', nature='commentaire')            # note ou fil de commentaires
    f.note('sort', id_sort, rang2, texte, source_ref, nature='reponse', repond_a=rang)                               # réponse dans un fil
    f.ecart('competence', 'calme', 'nom', 'nom_different', 'fiche', detail, source_ref, valeur_a='Calme', source_b='guide', valeur_b='Prouesse')
    f.corrections(json.load(open('tools/sheets/corrections.json')), 'magie-v8')                                       # trace du registre
# sortie sans erreur : suppression des sources orphelines, foreign_key_check, COMMIT, puis exporter(db, rows)
# sur exception ou clé étrangère rompue : ROLLBACK, data/rows intact
```

Pièces détachées : `ouvrir(chemin)` (crée la base d'après `schema.sql`, refuse une base d'une autre version), `Famille` (le bloc transactionnel), `exporter(db, dossier)`, `reconstruire(chemin, rows)` (refuse d'abord un jeu de lignes d'une autre version : « npm run db:migrate »), `migrer(...)` (§10.1), `normalize()` (port exact de `client/src/lib/text.mjs` : la propriété Unicode « Diacritic » que retire `/\p{Diacritic}/gu` n'existe pas en Python, ses 214 plages de points de code sont **générées depuis Node** par `gen.diacritics.mjs` dans `_diacritiques.py` ; l'approche naïve par catégorie `Mn` divergeait sur 109 chaînes sur 60 050, par exemple `aʰb`), `litteral()` (§6).

**Règles d'un importeur** (chacune est testée au lot qui le porte) :

1. N'écrit **que** des lignes d'`origine` = sa famille (une autre origine est refusée) ; ne fait jamais d'`UPDATE` (la base de travail est recréée à chaque passage, aucun état à réparer).
2. Lit les lignes des familles précédentes dans la base reconstruite (par exemple `magie.caracteristique_id` → `caracteristique` de la famille `fiche`), jamais dans une autre base.
3. Déterministe : pas de date, pas d'aléa, itérations triées ; deux exécutions donnent les mêmes octets.
4. Texte de la source gardé tel quel (après le registre de corrections) ; typé seulement si sans ambiguïté, sinon `NULL` + `*_brut` ; chaque ligne a sa `source_ref`.
5. Enregistre ses entités dans `page_entite` : explicitement (`f.entite`), ou par la **convention d'identifiant** (l'entité qui a sa page porte l'id de la page ; une sous-entité `<page>#…` se rattache à `<page>` ; `db:check` vérifie la complétude).
6. Les fils de commentaires `.xlsx` (champs `note` et `threads` des dumps) : notes d'abord, puis fils ; une réponse suit son commentaire (`repond_a`) ; « Marquée comme fermée » / « Rouverte » = `evenement`. Noms d'auteurs et dates ne sont pas lus.
7. Échoue bruyamment (`ValueError` avec la cellule fautive) plutôt que de deviner : famille inconnue, YAML hors sous-ensemble, provenance inconnue, plage illisible.

Les chargeurs des analystes (`*.load.py`) sont les points de départ des ports : ils lisent déjà les dumps et le `.xlsx` et écrivent des lignes ; il reste à les faire écrire dans le schéma unique par `session` (lots 4 à 10).

---

## 6. Format d'export `data/rows/`

- **Un fichier par table de base** (131, y compris les tables vides : `data/rows` ne change jamais de forme au fil des lots). Aucun fichier pour une table dérivée ; l'ensemble des fichiers doit égaler l'ensemble des tables de base (`db:build` refuse sinon).
- **Ligne d'en-tête** : `-- data/rows/<table>.sql : export déterministe, une instruction par ligne, triée par (<clé primaire>). NE PAS ÉDITER À LA MAIN. schema_version=<N>` ; `db:build` refuse une version différente du schéma.
- **Une instruction `INSERT INTO <table> (<colonnes dans l'ordre du schéma>) VALUES (...);` par ligne**, triée par la clé primaire (ordre binaire de SQLite) : un ré-import qui ne change pas une donnée ne change pas un octet, un changement touche les seules lignes concernées (diff git lisible).
- **Littéraux** : entiers en clair ; flottants par `repr` (aller-retour exact) ; `NULL` ; texte entre apostrophes doublées, **retours à la ligne laissés tels quels** (un diff git d'une page Markdown montre les lignes modifiées) ;
  tout autre caractère de contrôle (`\r`, `\0`, …) par `char(n)` concaténé : le fichier ne contient jamais d'octet qui change selon l'éditeur ou git. UTF-8, fins de ligne `\n` (`.gitattributes` : `data/rows/*.sql text eol=lf`).
- **Reproductibilité octet pour octet** (vérifiée) : base → export → reconstruction → export donne les mêmes 131 fichiers ; un second export sous un `PYTHONHASHSEED` différent aussi ; la reconstruction par Node (SQLite 3.50.4) et par Python (3.45.1) donne les mêmes empreintes de tables.
- **Chargement** : clés étrangères suspendues, un seul `BEGIN`/`COMMIT`, **contrôle `foreign_key_check` à la fin** (l'ordre des fichiers est sans importance).
- **Volume** : 131 fichiers, 25 888 lignes, 8,9 Mo (le plus gros : `page.sql` 1,7 Mo, `relation_peuple.sql` 1,4 Mo). Fichier `.db` : 12,6 Mo sans les dérivées, 15,9 Mo avec (3,2 Mo compressé).
- **Conflits git** : les lignes étant triées par clé, deux branches qui touchent des familles différentes ne se heurtent pas ; un conflit dans `data/rows` se résout **en relançant l'importeur**, jamais à la main.

---

## 7. API de lecture (`api/db-reader/`, Node sans dépendance : `node:http` + `node:sqlite`)

Préfixe `/api/v1`. JSON UTF-8. Méthodes `GET` et `HEAD` ; toute autre méthode : 405 + `Allow`. `ETag` = empreinte du fichier de base (inode, taille, mtime) ; `If-None-Match` → 304 ; `Cache-Control: no-cache`.
Erreurs : `{"erreur": {"code", "message"}}` (404 `introuvable` / `route_inconnue` / `table_inconnue`, 400 `limite_invalide` / `curseur_invalide` / `colonne_inconnue` / `colonne_non_indexee` / `valeur_invalide` / `recherche_vide` / `nom_requis`, 405 `methode`, 503 `base_absente` / `base_inutilisable`, 500 `interne`).
**Pagination** : `limite` (défaut 50, maximum 200) et `apres` = curseur opaque (JSON base64url de la dernière clé de tri) ; réponse `{items, suivant}`, `suivant = null` sur la dernière page ; tri par clé primaire (ou `(titre_cle, id)` pour les pages), comparaison de tuples `(a, b) > (?, ?)`, jamais d'`OFFSET`.

| Méthode et chemin | Paramètres | Réponse |
| --- | --- | --- |
| `GET /` | | `{api, version_schema, routes[]}` |
| `GET /sante` | | `{ok, rechargement, version_schema, tables, pages, entites}` (`ok = false` si le dernier remplacement de base a été refusé) |
| `GET /familles` | | `{items: [{id, libelle, importeur, sources, ordre, nb_pages}]}` |
| `GET /types` | | `{items: [{id, libelle, singulier, description, ordre, nb_pages}]}` |
| **Par type, filtre** `GET /pages` | `type`, `statut`, `origine`, `tag`, `limite`, `apres` | `{items: [{id, type, titre, resume, statut}], suivant}` |
| **Par identifiant** `GET /pages/{type}/{slug}` | `corps=0` (sans le Markdown) | document : `id, type, slug, titre, resume, statut, origine, source_ref, donnees, aliases[], tags[{id, libelle}], sources[{texte, url}], entites[{table, id, principale}], liens[{position, cible, ancre, etat, page}], retroliens[{id, titre}]` + `corps_md` |
| **Rétroliens** | (clé `retroliens` du document) | pages qui contiennent un `[[lien]]` vers cette page, par titre |
| `GET /resoudre` | `nom` | `{cle, ambigu, items: [{id, titre, via}]}` : titre, alias ou slug, casse, accents et apostrophes ignorés ; forme `type/slug` acceptée |
| `GET /tags`, `GET /tags/{id}` | | `{items: [{id, libelle, nb_pages}]}` ; `{id, libelle, nb_pages, pages[]}` |
| **Plein texte** `GET /recherche` | `q`, `table`, `limite` | `{requete, pages: [{id, titre, type, extrait}], entites: [{table, id, nom, extrait}]}` (FTS5, classement `bm25`, extraits `snippet`) |
| `GET /entites/{id}` | id encodé (`/` → `%2F`, `#` → `%23`) | `{id, items: [{table, page_id, principale}]}` : la page qui porte une entité |
| **Accès générique** `GET /donnees/{table}` | `<colonne>=v`, `<colonne>__gte` `__lte` `__gt` `__lt` `__ne`, `limite`, `apres` | `{table, items[], suivant}` ; **filtre refusé (400) sur une colonne sans index** |
| `GET /donnees/{table}/{pk}` | clé composite : colonnes jointes par `\|` | `{table, ligne, notes[], ecarts[], page}` : la ligne, ses notes de cellule, ses écarts entre sources, sa page |
| `GET /tables` | | `{items: [{nom, cle[], colonnes_filtrables[]}]}` |
| **Documents composés** `GET /classes/{slug}` | | classe + `specialites[]` + `capacites[]` (chacune avec `alternatives[]` = choix exclusifs) + `objets_depart[]` + `races_accessibles[]` |
| `GET /regles`, `GET /regles/niveaux/{n}` | | caractéristiques et niveaux ; un niveau avec ses cumuls |

Une route composée par domaine (magie + sorts, race + ethnies, créature, arme…) est ajoutée **dans le lot du domaine**, comme assemblage de requêtes déjà vérifiées dans `queries.json` ; tout le reste passe par `/donnees`.

**Sécurité.** Connexion `readOnly` + `PRAGMA query_only = ON` ; aucun SQL fourni par l'appelant ; noms de table et de colonne **validés contre `sqlite_master`** (jamais interpolés tels quels) ; valeurs liées par paramètres ;
filtres seulement sur colonnes indexées (pas de balayage complet) ; requête plein texte nettoyée (au plus 8 mots, `"mot"*`, aucune syntaxe FTS brute) ; `X-Content-Type-Options: nosniff` ; l'authentification reste devant (nginx, mot de passe) tant qu'il n'y a pas de rôles.

**Remplacement à chaud de la base** (`update-site.sh` : copie puis `rename` atomique). À chaque requête, l'API compare (inode, taille, mtime) ; si le fichier a changé, elle ouvre le nouveau, le **contrôle** (version de schéma attendue via `SCHEMA_VERSION`, lecture de `page`) puis l'échange.
Un fichier inutilisable (corrompu, autre version, absent) laisse **l'ancienne base en service** et `GET /sante` répond `ok: false` avec la raison ; au démarrage sur un fichier inutilisable : 503 explicite. Vérifié sous charge : 200 requêtes pendant un `rename`, aucune erreur 5xx, chaque réponse vient d'une base entière.

---

## 8. Lecture par Astro, par le générateur de fiche, par le déploiement

### 8.1 Astro : un chargeur de contenu qui lit la base

- `client/src/lib/db.mjs` : `openDb()` (lecture seule, `query_only`), chemin par `MAVERICK_DB` (défaut `var/maverick.db`), `pagesForIndex(db)` (entrées `{id, type, slug, title, aliases}` de l'index des liens). Aucune dépendance Astro ni navigateur.
- `client/src/loaders/wiki-db.mjs` : chargeur `{name, load({store, parseData, renderMarkdown, generateDigest})}` : pour chaque page, `data` = `{title, aliases, tags, summary?, ...page.donnees, sources, status}`, `body = corps_md`, `rendered = renderMarkdown(corps_md)`, `digest` ; `store.clear()` d'abord.
  `content.config.ts` : `loader: wikiDb()` à la place de `glob(...)` ; le schéma `zod` ne change pas.
- `astro.config.mjs` : l'index des `[[liens]]` vient de `pagesForIndex(openDb())` au lieu de `scanContent`. **Le piège « Astro 7 + plugin remark `unified()` » (skill `site-wiki-liens`) reste valable** (rien ne change côté rendu).
- `client/src/lib/wiki.ts` (graphe : liens sortants, rétroliens, mots-clés) lit toujours la collection : inchangé, donc le site est identique. Lire `lien_page` (dérivée) est une optimisation ultérieure.
- `npm run build` = `npm run db:build && astro build`. Le dev (`npm run dev`) relit la base au démarrage : relancer `db:build` puis `dev` après un import.

**Vérifié** : `dist/` construit depuis la base est **identique octet pour octet** à celui construit depuis les fichiers `.md` (`diff -r`) : 1 375 fichiers, 1 367 avec `HIDE_EXAMPLES=1`, et 1 375 depuis la base du **lot 1** (pages seulement, tables typées vides).

### 8.2 `HIDE_EXAMPLES`

Aujourd'hui l'exclusion des pages d'exemple se fait à deux endroits qui doivent rester d'accord (`scanContent`, `loadWiki`). Avec la base, **un seul endroit** : `db:build` honore `HIDE_EXAMPLES=1` (équivalent de `db-derive.mjs --sans-exemples` : il supprime les 5 pages `status: example`, leurs liens et leurs dérivées),
si bien que le chargeur et l'index lisent la même base sans filtre. `HIDE_EXAMPLES=1 npm run build` s'utilise comme avant. Vérifié : mêmes pages (986), mêmes alias, mots-clés, liens, clés ambiguës que le site actuel.

### 8.3 Le générateur de fiche : `rules.json` généré par SELECT

> **Remplacé** (2026-10-10) : l'ancien générateur, `character.mjs` et `rules.json` ont été retirés. La fiche de personnage (`/fiche/`) lit les règles dans
> `/fiche/regles.json`, tiré de la base au build par `client/src/lib/fiche-regles.mjs` (des SELECT simples, rien de calculé), et calcule avec
> `client/src/lib/fiche-moteur.mjs` (voir `docs/character-generator.md`). Le texte ci-dessous est la conception d'origine.

`character.mjs` reste pur : il lit toujours `client/src/data/rules.json`. Ce fichier est **produit** par `npm run db:export-rules` (Node, `node:sqlite`) : chaque clé est le résultat d'**un SELECT simple** (19 requêtes vérifiées dans `queries.json`, domaine `export_rules` :
`attributes`, `skills`, `creation_constants`, `creation_pool`, `constants`, `levels`, `unlocks`, `thresholds`, `resistance_tiers`, `resistance_matrix`, `initiative`, `training`, `gift_types`, `gods`, `states`, `state_stages`, `state_tiers`, `postures`, `posture_effects`), plus le catalogue `races` / `classes` / `magies` tiré de `race`, `classe`, `magie`, `race_classe`, `race_magie` (accessibilités).
Aucune règle n'est codée dans l'export, aucune valeur n'est calculée. Ce qui n'est dans aucune source (par exemple `allowedClasses` d'une magie) est **absent**, pas inventé.
Le fichier est généré **et commité** ; la CI relance l'export et échoue s'il diffère (`db:export-rules --check`). `rules.test.mjs` reste vert sans base. L'adaptation de `character.mjs` aux vraies règles est la tâche du lot 4.

### 8.4 Déploiement (conteneur, rien de spécifique au NAS hors de `deploy/`)

- **Publication** (`.github/workflows/livraison.yml`, job « Site », après chaque fusion qui change `dev`, jusqu'à la 1.0 ; voir `docs/flux-git.md`) : `npm ci`, tests (Node + `unittest` de `tools/db`), `HIDE_EXAMPLES=1 npm run build` (qui reconstruit la base sans exemples), puis la branche `site` (une seule révision, réécrite) contient : `html/` (site statique), `data/maverick.db`, `api/` (le fichier `server.mjs` et ses modules), `MANIFEST` (empreintes SHA-256). À partir de la 1.0, ce même contenu part dans les installateurs de `deploy/installateur/` (hébergement de la 1.0).
- **Conteneurs** : `deploy/docker-compose.yml` passe à deux services : `nginx` (site statique, `auth_basic` conservé, `location /api/ { proxy_pass http://api:3000; }`) et `api` (`node:22-alpine`, `read_only: true`, utilisateur non root, volume `./data:/data:ro`, variables `MAVERICK_DB=/data/maverick.db`, `PORT=3000`, `SCHEMA_VERSION=<N>`, bilan de santé sur `/api/v1/sante`).
  Un hébergeur sans nginx lance le même `server.mjs` et met l'authentification devant (variables d'environnement seulement).
- **`update-site.sh`** : installe `html/` → `site/`, `api/` → `api/`, et `data/maverick.db` par copie vers un fichier temporaire **puis `mv` atomique** (l'API le rouvre toute seule) ; garde-fous : `MIN_PAGES` conservé, empreintes du `MANIFEST` vérifiées, taille minimale de la base. Le NAS n'a besoin ni de Python ni de Node (Node tourne dans le conteneur `api`).
- **`.nvmrc`** : 22 (déjà le cas) ; `engines` de `client/package.json` passe de `>=22.12.0` à `>=22.13.0` (`node:sqlite` sans option ; il émet un `ExperimentalWarning` que l'API et les scripts masquent par `--no-warnings`).

---

## 9. Migration des 991 pages sans perte

**Corpus** : 991 pages (986 hors exemples) en 9 familles : `classes` 700, `docs` 157, `bestiaire` 66, `races` 28, `magies` 15, `equipement` 8, `annexes` 6, `craft` 6, `exemple` 5 ; types `capacites` 660, `metiers` 73, `bestiaire` 67, `ressources` 66, `classes` 40, `guide` 40, `races` 28, `magies` 16, `lore` 1. 702 pages portent des champs structurés en plus du frontmatter commun.

**Règles de migration** (`tools_pages.py`, futur `tools/db/pages_md.py`) :

- Lecture du frontmatter par un **sous-ensemble strict de YAML** (exactement ce que les importeurs écrivent) ; toute autre forme arrête le chargement avec le message de la ligne fautive.
- `corps_md` est le corps **octet pour octet** (la ligne vide qui suit `---` est un séparateur, pas du contenu).
- Les champs structurés (`magies_innees`, `nom_court`, `resiste_a`, `classe`, `niveau`, `choix_exclusif_avec`…) vont dans `page.donnees` (JSON ; entiers et listes de chaînes admis) **jusqu'à ce que le lot du domaine les remplace par des tables typées** ; le chargeur Astro les restitue dans `data`.
- **La famille d'une page est déduite de sa provenance déclarée** (`sources:`), jamais de son contenu ; une provenance inconnue arrête le chargement (la famille n'est jamais devinée). `source_ref` = premier libellé non URL des `sources`.
- Mise en forme du frontmatter (ordre des clés, guillemets) : normalisée, sans effet pour le site (égalité vérifiée avec le parseur `yaml` du site). Aucun fichier `.md` n'est réécrit.

**Vérifié, sur les 991 pages** :
1. aller-retour : base → Markdown ré-émis → relu par le parseur `yaml` du site : **données et corps identiques, 0 écart** ;
2. graphe du site : mêmes pages, alias (68), mots-clés (363 distincts, 2 753 liaisons), sources (2 054), clés de résolution (1 743 distinctes, 13 ambiguës identiques), **39 liens identiques** (page, position, cible, ancre, état, page visée), mêmes liens sortants, rétroliens, liens non résolus ; idem avec `HIDE_EXAMPLES` (986 pages, 28 liens) ;
3. site construit : **identique octet pour octet** (§8.1).

**Pont transitoire pour les familles « héritées »** (lots 1 à 10). Tant qu'une famille n'a pas d'importeur Python, ses pages viennent encore des `.md` et ses tables typées sont **vides**. `npm run db:sync-pages [-- <famille>]` (= `tools_pages.sync_pages`) remplace les lignes de page de la famille par celles des `.md`.
Invariant : **une famille est soit héritée (pages depuis les `.md`, aucune ligne typée), soit portée (tout par son importeur ; ses `.md` supprimés du dépôt)**. Registre : `data/heritage.json` (familles encore sourcées par `.md`) ; le lot d'un domaine retire sa famille du registre.
Vérifié : (a) l'état du lot 1 contient 991 pages dont les 7 fichiers de la couche pages sont **identiques octet pour octet à ceux du schéma final** ; (b) une seconde synchronisation ne change aucun octet ; (c) modifier un `.md` ne change que les lignes de sa page ; (d) ajout / retrait de page, avec retrait de la source devenue orpheline ; (e) un slug renommé est signalé par la garde d'identité ;
(f) **une famille portée (lignes typées) est refusée**, `data/rows` intact.

---

## 10. Évolution : migrations, identifiants stables, historique, PostgreSQL

### 10.1 Versions et migrations

- `PRAGMA user_version` = version du schéma (1 aujourd'hui) ; chaque `data/rows/<table>.sql` porte `schema_version=N` ; `db:build`, `ouvrir()` et l'API (`SCHEMA_VERSION`) refusent une version inattendue.
- Un changement de schéma = modifier `schema.sql`, écrire la migration, `version++`, commiter schéma, migration et `data/rows` ensemble. Le chemin ordinaire est **`npm run db:migrate`** (prototype : `tools_db.migrer`, **testé**) : il transforme les lignes **déjà commitées**, sans accéder aux sources
  (qui peuvent être inaccessibles : le réseau bloque Discord et Google depuis une session cloud). La **réimportation** reste possible pour les familles portées et sert de contre-vérification (lignes migrées = lignes réimportées) ; elle est **impossible** pour les familles `docs` (157 pages) et `exemple` (5) tant que leur importeur n'est pas porté (lot 10) et, **après la bascule vers l'édition, pour toute la base**.
  `db:migrate` applique un fichier `data/migrations/NNNN-<nom>.sql`
  (**additif** : nouvelle table, nouvel index, `ADD COLUMN` nullable ; **cassant** : renommage, suppression, réécriture de table, avec le SQL explicite) :
  1. reconstruit la base de la version N-1 depuis ses lignes et son schéma (`git archive` du commit précédent) ;
  2. exécute la migration dans **une** transaction (clés étrangères suspendues pendant la réécriture de tables, `foreign_key_check` avant le `COMMIT`) ; le fichier ne gère ni ses transactions ni ses PRAGMA ;
  3. **compare le schéma obtenu à `schema.sql`** (tables, colonnes **dans l'ordre**, index, vues, texte normalisé) : tout écart arrête avant d'écrire. Conséquence : une colonne ajoutée se place **en dernier** dans `schema.sql`, sinon l'export d'une base migrée différerait de celui d'une base neuve ;
  4. exporte avec `schema_version=N` : `data/rows` n'est jamais écrit à moitié.
  Vérifié : ajout d'une table, ajout d'une colonne, renommage de colonne (valeurs conservées) ; refus pour un schéma qui n'est pas celui attendu, une colonne placée au milieu, une clé étrangère rompue, des versions qui ne se suivent pas, une migration qui échoue à mi-chemin, une migration qui gère ses transactions ;
  les 131 fichiers existants ne changent que par leur numéro de version (**chaque montée de version touche l'en-tête des 131 fichiers**, volontairement : un jeu de fichiers de versions mélangées est refusé) ; des lignes d'une version chargées avec le schéma suivant sont refusées avec le message `db:migrate`.

### 10.2 Identifiants stables

Aujourd'hui les identifiants se dérivent des noms de la source (§2). Pour tenir « une page renommée garde son identifiant » :

- **Maintenant** : `npm run db:ids` (`tools/db/ids.py`, prototype `ids.garde.py`, testé) compare les identifiants (clés `id` TEXT) de `data/rows` à ceux du commit précédent. Un identifiant **disparu** est une erreur, sauf déclaré dans `data/redirections.json` (`{"ancien": "nouveau"}`, le nouveau existant) ; un ancien identifiant encore présent (donc réutilisé) est une erreur.
  Testé sur un renommage simulé de cette capacité (le cas réel de la PR n° 9 aurait été refusé sans redirection). Exécuté en CI.
- **Fait (migration 0006)** : les sept tables qui contraignaient l'id à « préfixe || nom_cle » (`sort`, `classe`, `invocation`, `invocation_capacite_commune`, `creature`, `creature_attaque`, `creature_capacite`) ne le font plus : un nom corrigé change `nom` et `nom_cle`, l'id garde la clé d'origine (aucune redirection nécessaire). Les pages gardent aussi leur id et leur slug quand leur titre change.
- **À la bascule vers l'édition** (migration 2, additive) : table `redirection(ancien_id, id)` lue par l'API (`/pages/{ancien}` → 301) et le résolveur de liens ; les identifiants sont **gelés** (un renommage change le titre, jamais l'id) ; l'identifiant n'est plus dérivé du slug.

### 10.3 Historique des modifications (premier pas : l'édition du site de dev)

Section 14 de `data/schema.sql` (migration `0017-edition`) : `modification_lot` (un enregistrement depuis une page : instant, page, résumé, auteur —
NULL avant la connexion Discord) et `modification` (une ligne touchée : table, clé, opération, colonnes **avant / après**, état `en_attente` /
`integree` / `conflit`, aperçu HTML d'une page du guide). Le service d'écriture (`client/serveur/edition.mjs`) les écrit **dans la même transaction
que la modification**, sans déclencheur SQL caché ; elles restent **vides dans `data/rows`** et ne vivent que dans la base vivante du site de dev.
Quand de nouvelles règles arrivent, le journal est rejoué sur elles (une modification déjà présente est « intégrée », un lot contredit passe
« conflit » en entier) ; `npm run db:appliquer-edition` le rejoue de même sur `data/rows`, que l'export déterministe réécrit (relecture et
comparaison par git). Voir `docs/serveur.md`, « Édition ». Restent à décider avec le propriétaire : l'état `brouillon / validé` (relecture avant
publication), l'auteur (connexion Discord) et le moment où la base devient canonique (les classeurs, une archive).

### 10.4 Portabilité vers PostgreSQL

| Construction SQLite | Occurrences (SQL exécutable) | Équivalent PostgreSQL |
| --- | ---: | --- |
| `STRICT`, `WITHOUT ROWID` | 133 / 49 | retirer les mots-clés (PostgreSQL type déjà strictement) |
| `GLOB` dans des `CHECK` | 20 | `~` (expression rationnelle) |
| `json_valid(...)`, `json_type(...)` | 3 / 2 | colonne `jsonb`, `jsonb_typeof` |
| `json_extract(col, '$.cle')` | hors schéma : requêtes du service et du site (`json_extract(cle, '$.rang')`, `'$.id'` sur `modification` et `historique_modification`) | `(cle::jsonb->>'rang')::int` (`->>` rend du texte : convertir quand la valeur est un nombre) |
| `instr(...)` | 3 | `position(... in ...)` |
| FTS5 (`page_fts`, `entite_fts`) | 2 tables **dérivées** | `tsvector` + index GIN, requêtes `@@` / `ts_rank` ; seule la route `/recherche` change |
| `group_concat(...)` | 1 vue (+ `data/derive.sql`, dérivé) | `string_agg(...)` |
| `PRAGMA user_version`, `PRAGMA foreign_keys` | 2 | table `schema_version` ; clés étrangères toujours actives |
| `char(n)` dans l'export (caractères de contrôle) et les migrations de données (retours à la ligne : 0056) | à l'export, migrations | `chr(n)` |
| Ordre binaire de `ORDER BY` (clé de l'export, curseurs) | partout | `COLLATE "C"` pour garder le même ordre |

Le reste (index partiels, index d'expression `COALESCE`, comparaisons de tuples, `ON DELETE CASCADE`, `CHECK ... IN`, clés composites) est portable tel quel. Les booléens `INTEGER 0/1` se convertissent ou restent des entiers.

### 10.5 Règles en données : effets structurés

Le texte d'une capacité, d'un sort ou d'un objet **reste cité tel quel** (règle d'or). Un effet codé (dégâts, durée, cible, jet, état infligé, résistance) s'ajoute dans une table `effet_<domaine>` distincte, **à côté** du texte :
`(entite_table, entite_id, rang, type, <colonnes typées>, texte_source, source_ref)` avec clé étrangère vers l'entité, ajoutée par migration additive, **capacité par capacité**. Un effet non codé est **absent** de la simulation, jamais deviné ; `db:check` signale une entité dont l'effet codé ne cite pas son texte d'origine.

---

## 11. Lots livrables et stratégie de test (TDD : les tests sont écrits avant le code)

Chaque lot est mergeable seul, laisse le site fonctionnel et se prouve par des tests qui tournent en CI. Tests Node : `node:test` dans `client/test/` ; tests Python : `unittest` dans `tools/db/test/`.

| Lot | Contenu | Tests d'abord (critère de sortie) |
| --- | --- | --- |
| **1. Fondations** | `data/schema.sql`, `data/derive.sql`, `data/rows/` (famille, type_page + 991 pages), `tools/db/` (session, export, reconstruction, `normalize`, `pages_md`, `ids`), `client/scripts/db-{build,derive,check}.mjs`, scripts npm `db:build` `db:check` `db:ids` `db:sync-pages` `db:migrate`, job CI `db`. Le site ne change pas. | Schéma exécuté sur base vierge (Python **et** Node) ; chaque table STRICT, clés étrangères résolues ; batterie de contraintes (≈ 70 cas : refuse pour la bonne raison, accepte la même écriture valide) ; export déterministe et reconstruction identique Python/Node ; `normalize()` Python = JavaScript ; 991 pages : aller-retour, graphe, `HIDE_EXAMPLES` ; `sync_pages` (idempotence, diff minimal, refus d'une famille portée) ; `db:check` positif **et négatif** (chaque défaut injecté est détecté) ; `db:ids` ; migration `N-1 → N` |
| **2. Astro lit la base** | `db.mjs`, `wiki-db.mjs`, `content.config.ts`, `astro.config.mjs` ; `build` = `db:build` + `astro build` ; `HIDE_EXAMPLES` dans `db:build` seul | `dist/` identique (`diff -r`) avec et sans `HIDE_EXAMPLES`, depuis la base du lot 1 ; les tests existants (`wikilinks`, `wiki`, `search`…) restent verts |
| **3. API, conteneur, livraison** | `api/db-reader/server.mjs`, `deploy/` à deux services, branche `site` enrichie (`data/maverick.db`, `MANIFEST`), `update-site.sh` à remplacement atomique | Toutes les routes du §7 (valeurs, erreurs, pagination sans trou ni doublon, ETag/304, 405) rejouées contre `queries.json` ; remplacement à chaud sous charge ; fichier corrompu / autre version / absent ; base du lot 1 (domaines vides sans erreur 500) ; construction de l'image et `curl` sur `/api/v1/sante` |
| **4. Socle des règles** | Familles `fiche` + `annexes` (importeurs `regles-fiche.py`, `annexes-magie.py` ; `.md` des 6 pages d'annexes retirés), `db:export-rules`, `character.mjs` lit les vraies règles (tâche « Brancher les vraies règles ») | Golden : lignes de ces familles = lignes de référence de cette conception ; 21 requêtes `export_rules` ; `rules.json` généré identique au commité ; `rules.test.mjs` vert ; contrôle `ecart_source` (Calme/Prouesse, puissance magique 5…) |
| **5. Magies et sorts** | Famille `magies` (+ notes de cellule des sorts) ; `/donnees/sort`, route composée magie ; `magies_innees`, `nom_court`, `resiste_a`… quittent `page.donnees` pour les tables | Golden ; 16 requêtes `magies` ; liens races ↔ magies recalculés à l'identique par `magie-relations.mjs` ; `dist/` identique |
| **6. Classes** | Famille `classes` (700 pages dont 660 capacités ; registre de corrections appliqué avant l'extracteur, `f.corrections`) ; `v_capacite_exclusive` | Golden ; 13 requêtes `classes` ; choix exclusifs = 660 pages ; correction du Mercenaire tracée (`db:check`) ; `class-groups.mjs` inchangé ; `dist/` identique |
| **7. Races** | Famille `races` (27 races, 96 ethnies, accessibilités, relations entre peuples) | Golden ; 17 requêtes `races` ; 4 761 cases comparées à la page ; `race-kinds.mjs` / `magie-relations.mjs` inchangés ; `dist/` identique |
| **8. Bestiaire** | Famille `bestiaire` (3 invocations, 63 créatures) | Golden ; 14 requêtes ; liens créature → sort ; `dist/` identique |
| **9. Équipement et craft** | Familles `equipement`, `craft` (49 tables) | Golden ; 12 requêtes ; écarts de prix et de test de fabrication conservés dans `ecart_source` |
| **10. Pages `docs` et retrait des `.md`** | Importeur Google Docs → lignes (remplace la sortie `.md` de `import-gdocs.mjs`) ; suppression de `src/content/wiki` et de `scanContent` | `dist/` identique ; plus aucune lecture de `.md` par le site ; CLAUDE.md mis à jour |
| **11 et suivants** | Phase 2 de la feuille de route : redirections, historique, service d'écriture, rôles | décidés avec le propriétaire (§10) |

**Tests de domaine (lots 4 à 9)** : la **référence dorée** est l'export validé de cette conception (`unified.rows/`, les lignes de la famille). Critère de sortie : l'importeur porté, rejoué depuis les dumps, redonne **ces lignes octet pour octet**, ou chaque différence est expliquée (correction du registre, nouvelle version de la source).
Chaque lot ajoute ses requêtes de `queries.json` (les 155 sont rejouées en Python **et** Node) et son accès `/donnees/<table>`.

---

## 12. Points ouverts

### 12.1 Décisions d'architecture (avec valeur proposée par défaut)

| # | Question | Proposition par défaut |
| --- | --- | --- |
| A1 | Amorce complète des 7 domaines dès le lot 1 (les lignes de cette conception, importeurs portés ensuite) **ou** tables typées vides jusqu'au lot de leur famille | **Tables vides jusqu'au lot de la famille** : invariant net « héritée ou portée » (§9), pas de double source ; les lignes validées servent de référence dorée |
| A2 | Identifiants stables | Dérivés du slug jusqu'à la bascule, garde `db:ids` + `data/redirections.json` en CI ; gel et table `redirection` à la bascule |
| A3 | Où vit l'API en lecture ? CLAUDE.md demande de ne pas modifier `api/` sans demande | Nouveau sous-dossier **`api/db-reader/`**, sans toucher à `character-service` ni à `dotnet-character-service` (à confirmer) |
| A4 | Où publier le fichier `.db` ? | Dans la branche `site` à côté du site statique (16 Mo, 3,2 Mo compressé, branche réécrite à chaque publication) ; alternative : artefact de release ; reconstruire sur le NAS est écarté (demanderait Node et Python sur le NAS) |
| A5 | `HIDE_EXAMPLES` filtre seulement à la construction de la base | Oui (un seul endroit) |
| A6 | `rules.json` : généré et commité avec contrôle de fraîcheur, ou généré au build seulement | Généré **et commité** + contrôle en CI (le moteur et ses tests n'ont pas besoin de base) |
| A7 | Pages `docs` et `exemple` (pas d'importeur typé) avant le lot 10 | `.md` = source, pont `db:sync-pages` ; après le lot 10, les lignes SQL sont canoniques |
| A8 | Un champ structuré d'une page (`magies_innees`…) : le Markdown redevient-il une présentation générée des tables, ou `corps_md` reste-t-il le texte de la source ? | **`corps_md` reste le texte de la source** (règle d'or) ; les tables typées sont la vue structurée ; le chargeur Astro restitue les champs de `data` depuis les tables |
| A9 | Œ et Æ ne sont pas repliés (`normalize()` et FTS5) : comportement du site actuel conservé ; `coeur` trouve 2 pages, `cœur` 13 | Conserver ; replier `œ → oe` dans `normalize()`, le texte indexé et la requête est un changement à décider |
| A10 | Recherche : FTS5 compare des mots ou débuts de mot (`ortée` ne trouve plus `portée`) ; l'apostrophe sépare les mots | Accepté : la base répond mieux sur les mots entiers ; sous-chaîne = `LIKE` si le besoin apparaît |
| A11 | Tri : `ORDER BY titre_cle` n'est pas `localeCompare('fr')` (3 catégories sur 9 diffèrent) | Conserver l'ordre de la base ; le site garde son tri d'affichage |
| A12 | Noms ambigus (13 paires classe/race) | Conservés (ambigu, signalé dans « pages à créer ») ; aucun lien actuel n'est concerné |

### 12.2 Contenu à trancher par le propriétaire (rien n'est tranché dans la base : les deux lectures sont conservées, la valeur absente reste `NULL`)

Détail et exemples dans les documents par domaine livrés avec la conception (`pages-liens.md`, `magies-sorts.md`, `classes.md`, `races.md`, `bestiaire.md`, `equipement-craft.md`, `regles-fiche.md`).

| Domaine | Question | Comportement actuel |
| --- | --- | --- |
| Règles | « Calme » ou « Prouesse » (compétence de Volonté) ; puissance magique 5 au niveau 16 ou 17 ; plafond de caractéristique aux niveaux 5, 10, 15 ; total à répartir = égalité ou maximum ; sens des deux « croix » ; entraînement 10 % par compétence ou au total | Les deux sources gardées (`ecart_source`) ; aucune règle appliquée |
| Règles | Quelle version du mode hyper fait foi (classeur « Mode hyper et co », onglet masqué V8, fiche, onglets de magie ; +15 / +7 ou +10 / +5) | Cinq lectures dans `mode_hyper_effet`, aucune préférée |
| Magies | ~~Corruption : la phrase « mono magie uniquement » est-elle la règle, ou la liste de la fiche (Arcane, Sang, Espace/Temps)~~ (**tranché**, décision R15 : mono-magie, excepté Elfe Noir Charbon et Felfe Noir) ; ~~Arcane/Corruption : résistance à elles-mêmes (fiche) ou à l'autre (V8, guide)~~ (**tranché**, décision R90 : chacune résiste à l'autre, la matrice de la fiche est retirée par la migration 0051) | Les paires de la fiche + la phrase (`incompatibilite_note`, gardée comme trace) ; `magie.mono_magie` (migration 0010) ; résistances V8 seules (R90 ; la matrice de la fiche et ses écarts retirés par 0051) |
| Magies | « D/S/B » non développé dans les sources ; coût nu = chakra (lecture du guide) ; noms d'états (« Gelé » / « Gel ») | `dsb_brut` seul ; 32 sorts sans chakra écrit = `NULL` ; table d'alias explicite dans l'importeur |
| Magies | 26 fils de commentaires orphelins (cellules supprimées, certains textes sont des règles) ; dieux : 28 noms, 16 reliés à une magie | `commentaire_orphelin` sans rattachement ; 16 dieux chargés |
| Classes | Valeurs par niveau absentes (seul le niveau 1 est donné) ; « Don de départ » = niveau 1 ? ; les choix 10/15/20 dépendent-ils de la spécialité ? | `*_depart` ; rattachement à la spécialité si les colonnes sont sous sa bannière ; Archimage : cartouches = choix, spécialité `NULL` (décision du propriétaire) |
| Classes | Objets de départ non rattachés au glossaire (16 options sur 210, « Corde (5m) ») ; AM des classes magiques (liste en dur de la fiche contre catégorie du classeur) | Texte conservé ; `am_base` sur la catégorie, pas de booléen `magique` |
| Races | 27 races (onglets) ou 23 (guide) ; fautes de saisie de la fiche (« Felfle », « Satyre » avec espace) ; bonus d'ethnie issu de formules (faux positif probable : Elfe forestier Forêt +3 AP) ; matrices d'accessibilité contredisant la fiche | 27 races, aucun drapeau `disponible` inventé ; valeurs du classeur reproduites, `race_brut` gardé, écarts signalés |
| Races | Capacité hyper : deux versions (fiche, guide) divergent pour 8 races ; « Divers » non typé (« Peut voler »…) ; bornes de caractéristique effectives | Versions gardées côte à côte ; texte conservé |
| Bestiaire | Sigle FPVSIA non défini (« NPM » = niveau de puissance magique, et le « EP » des marionnettes en est une faute du classeur : décision R53) ; combinaison de deux magies pour les résistances (6 créatures contradictoires) ; « Golem d'Argile » sans créature ; 6 sorts cités sur 105 introuvables sous ce nom (3 variantes évidentes : « Veilliessement »…) | Lecture proposée stockée en constante de l'importeur ; `sort_id` `NULL` ; les variantes évidentes sont des **candidates au registre de corrections** |
| Équipement | 9 prix de matière incohérents (RF/RO) ; deux listes de kits d'alchimie ; tests de fabrication en conflit (Forgeron, Enchanteur) ; coquilles de gemmes (alias fermé de 16 lignes) ; 4 noms portés par deux ressources | Valeurs conservées ; `ecart_source` ; deux lignes distinctes |
| Équipement | Unité des prix d'armure et de bouclier ; effets de potion, d'accessoire, de familier gardés en texte (« Récupère 2d8 + 5 santé ») | Colonne `prix` sans unité ; texte (structurer = lot « règles en données », §10.5) |

---

## 13. Comparatif des méthodes de stockage (court : les décisions sont prises)

| Méthode | Pour | Contre | Verdict pour Maverick |
| --- | --- | --- | --- |
| **Fichiers Markdown + frontmatter** (aujourd'hui) | Lisible, diff git, aucun serveur | Aucune requête ; relations par convention ; champs structurés dans du YAML ; la donnée est dans des scripts | Reste une **présentation** (texte des pages), plus la source des règles |
| **JSON / YAML versionnés** | Simple, portable | Pas de contraintes ni de jointures ; gros fichiers ; chaque question = un script | Utile seulement comme export (`rules.json`) |
| **SQLite** (retenu) | Un fichier, aucun serveur ; SQL complet, contraintes, FTS5 ; export texte diff-friendly ; reconstruction en 1 s | Un seul écrivain ; pas d'accès réseau natif (d'où l'API) | **Choisi** : données très relationnelles, lecture seule, hébergement à bas coût |
| **PostgreSQL** | Multi-utilisateurs, rôles, `jsonb`, recherche | Serveur à héberger et sauvegarder ; l'hébergement actuel (NAS) est temporaire | **Voie de sortie** si plusieurs personnes éditent (§10.4 : SQL déjà portable) |
| **MongoDB** | Documents imbriqués, schéma souple | Les données sont des **croisements** (1 053 + 405 cellules race × classe / race × magie, 4 761 relations, références entre 7 domaines) : `$lookup` lourds, pas de clés étrangères, serveur à héberger, export git difficile | Écarté |
| **Google Sheets comme base vivante** | La source existe déjà | Quotas, pas de requête relationnelle, tiers propriétaire, réseau bloqué depuis le cloud | Reste la **source**, pas la base |
| **Base de graphe** | Liens | Surdimensionnée : 39 liens et leurs rétroliens = une requête SQL | Écarté |
| **Moteur de recherche dédié** | Recherche fine | Un service de plus ; FTS5 couvre 991 pages et 3 292 entités | Écarté (FTS5 dérivé) |
| **Base dans le navigateur** (SQLite WASM) | Hors-ligne | 16 Mo à télécharger, pas d'API partageable | Option plus tard |

---

## 14. Preuves : ce qui a été exécuté (`bash run.all.sh`, ≈ 1 min, « TOUT EST VERT »)

| Contrôle | Résultat |
| --- | --- |
| `schema.sql` sur base vierge (Python 3.13 / SQLite 3.45.1, Node 22.22 / SQLite 3.50.4) | 131 tables STRICT, 4 dérivées, 26 vues, toutes les clés étrangères résolues |
| Chargement réel | 25 888 lignes (dont 991 pages) dans les 131 tables, `integrity_check = ok`, `foreign_key_check` vide |
| `normalize()` Python = JavaScript | 60 050 chaînes (50 cas piégés + tirage aléatoire à graine fixe dans 21 blocs Unicode) : 0 écart ; à rejouer si la version d'Unicode de Node change |
| Export, reconstruction, re-export | 131 fichiers identiques octet pour octet ; second export sous un autre `PYTHONHASHSEED` identique ; Python et Node : mêmes empreintes de tables |
| Contrat des importeurs (`session`) | réimport à l'identique de `bestiaire`, `annexes`, `races` : 131 fichiers inchangés ; exception, clé étrangère rompue, famille inconnue : refus et `data/rows` intact ; `f.corrections` |
| Contraintes (68 cas) | chaque écriture invalide refusée **pour la bonne raison** ; cascade ; supprime-et-réimporte `bestiaire`, `classes`, `races`, `equipement`, `annexes` = base identique ; réimport incomplet de `magies` refusé et annulé |
| `db:check` | positif ; **négatif** : 8 défauts injectés (ancien texte revenu, texte corrigé disparu, cellule hors de toute ligne, entité inexistante, `page_entite` manquante, clé étrangère, `type_page` ≠ `types.mjs`, dérivée absente), tous détectés |
| Pages (26 + 15 contrôles) | 991 pages sans perte ; graphe du site, avec et sans exemples ; pont `sync_pages` (idempotence, diff minimal, refus d'une famille portée) |
| Requêtes d'exemple | **155** (96 des analystes + 59 nouvelles : routes, pagination, notes, écarts, corrections, exclusivités, plein texte, `rules.json`) : chacune comparée à un calcul indépendant (base de l'analyste, fichiers du dépôt, `resolve()` du site, tokenisation Python) ; rejouées en Python **et** en Node : 0 écart |
| Sondage dans les classeurs bruts | 43 cellules relues dans les dumps JSON (sans passer par les extracteurs) : 43 identiques, dont la cellule `AC22` (dump brut + registre = valeur de la base) |
| API (34 + 11 + 12 contrôles) | toutes les routes ; 405 ; ETag/304 ; remplacement à chaud sous charge (aucune 5xx) ; fichier corrompu / autre version / absent ; état du lot 1 |
| Site | `dist/` depuis la base **identique octet pour octet** : 1 375 fichiers, 1 367 avec `HIDE_EXAMPLES`, 1 375 depuis la base du lot 1 (`bash astro.proto/compare.sh`, ≈ 50 s) |
| Migrations de schéma (16 contrôles) | table ajoutée, colonne ajoutée, colonne renommée ; refus (schéma inattendu, colonne au milieu, clé étrangère rompue, versions non consécutives, échec à mi-chemin, transactions dans la migration) ; rien d'écrit en cas de refus |
| Garde d'identité | renommage sans redirection refusé ; avec : accepté ; redirection vers un id inexistant ou ancien id réutilisé : refusé |

**Limites assumées.** `node:sqlite` est marqué expérimental (isolé dans `db.mjs` et `server.mjs`). Les chargeurs des analystes lisent des dumps et des `.xlsx` hors dépôt : leur port (lots 4 à 9) se fait contre la référence dorée. La parité Python/Node est prouvée sur les données actuelles et sera épinglée en CI (versions de Python et de Node).
Un domaine non encore porté répond « vide » ou 404 propre côté API, jamais 500.

---

## 15. Fichiers livrés (dossier `scratchpad/db/`)

| Fichier | Rôle |
| --- | --- |
| `schema.sql` | le schéma unique (assemblé par `schema.build.{head,body,tail}.py`) |
| `queries.json` | 155 requêtes `{domaine, id, question, sql, params, colonnes, mode, attendu, verifie_contre}` ; `attendu` = résultat vérifié ; rejouées par `queries.replay.py` / `.mjs` |
| `design.md` | ce document |
| `unified.rows/` | export déterministe de référence (131 fichiers) = référence dorée des lots 4 à 9 |
| `tools_db.py`, `tools_pages.py` | prototypes de `tools/db/` (session, `Famille`, export, reconstruction, `normalize`, `sync_pages`, pages) |
| `db-build.mjs`, `db-derive.mjs`, `db-check.mjs`, `derive.sql` | prototypes de `client/scripts/db-*.mjs` et de `data/derive.sql` |
| `api.mjs` | prototype de `api/db-reader/server.mjs` |
| `astro.proto/` | chargeur Astro (`wiki-db.mjs`, `db.mjs`) et `compare.sh` (identité de `dist/`) |
| `unified.load.py`, `lot1.build.py` | construction de la base complète et de l'état du lot 1 |
| `run.all.sh` | rejoue toute la validation ; tests : `schema.constraints.py`, `roundtrip.check.py`, `session.check.py`, `normalize.parity.py` (+ `.mjs`, `gen.diacritics.mjs`, `_diacritiques.py`), `pages.check.py`, `pages.sync.check.py`, `migrate.check.py`, `db-check.negatif.py`, `ids.garde.py` (+ `.test.py`), `source.spotcheck.py`, `api.smoke.mjs`, `api.swap.test.mjs`, `api.lot1.test.mjs`, `queries.*` |
| `<domaine>.md` | documents des sept analystes (modèle, exemples, points ouverts) |
