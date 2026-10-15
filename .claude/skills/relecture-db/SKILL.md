---
name: relecture-db
description: Relecture complète de la base SQLite de Maverick (schéma, contraintes, intégrité, qualité des données, vues, index, portabilité, usage dans le code), section par section du schéma, par des agents expert-sql. À utiliser quand on demande de relire, auditer ou passer en revue toute la base (ou une section), ou avant une grosse migration.
---

# Relecture complète de la base

Une relecture **ne corrige rien** : elle produit des constats prouvés, puis les corrections passent par le circuit habituel (`docs/equipe.md`).

| Qui | Fait quoi |
| --- | --- |
| Session principale (celle qui charge cette compétence) | Prépare la base, lance l'audit, confie un lot à chaque `expert-sql`, réunit leurs rapports, écrit la synthèse et les questions |
| `expert-sql` | Relit un lot, en lecture seule ; chaque constat est prouvé par une requête ; rend son rapport en réponse, sans écrire de fichier |
| `gardien-des-regles` | Juge le fond d'un constat de contenu (valeur conforme à la source, décision R…) |
| `ingenieur-donnees` | Corrige ce qui touche `data/` et `tools/` : migration, importeur, `data/rows` par les outils |
| `ingenieur-site` | Corrige ce qui touche `client/` : le SQL du site et du service, le code qui lit la base |
| `relecteur-critique`, `chef-de-flux-git` | Relisent puis publient chaque lot de corrections |

## 1. Préparer (depuis `client/`)

```bash
npm ci                      # si node_modules manque
npm run db:build            # var/maverick.db (ignorée par git)
npm run db:check            # contrôles qui font foi : doit être vert avant de relire
npm run db:pages-check
```

`db:check` rouge : c'est le premier constat (bloquant), à rendre à `ingenieur-donnees` avant le reste.

## 2. Audit automatique (depuis la racine du dépôt)

```bash
node --no-warnings .claude/skills/relecture-db/audit.mjs --sortie <scratchpad>/audit.md          # Markdown
node --no-warnings .claude/skills/relecture-db/audit.mjs --json --sortie <scratchpad>/audit.json # le même relevé en JSON
```

Le script travaille sur une copie de la base (dans un dossier temporaire, effacée à la sortie) et refuse une base qui contient des fiches. Il relève,
rangé par section du schéma : intégrité du moteur et de la recherche plein texte, tables (STRICT, clé primaire, écart avec `schema.sql` et `data/rows`,
tables vides), clés étrangères (sans index, types, cibles non uniques, colonnes `*_id` sans clé), index redondants, booléens et énumérations sans `CHECK`,
colonnes toujours `NULL` ou constantes, anomalies de texte, doublons de `*_cle`, rangs, vues (erreurs, durées, parcours complets en boucle interne, index
automatiques), portabilité hors de la liste admise, tables et vues que le code ne cite jamais.

Ce sont des **pistes** : un constat de l'audit est confirmé ou écarté à la relecture, jamais recopié tel quel dans le rapport. Les conventions du projet
(liste dans `.claude/agents/expert-sql.md`) expliquent beaucoup de « faux positifs » : les écarter en citant la convention.

## 3. Relire par lots

Un `expert-sql` par lot de sections de `data/schema.sql` (lots indépendants : en parallèle). Chaque lot relit aussi **les vues de la section 12 qui lisent
ses tables** et **les index de ses tables** (bloc « INDEX DES CLÉS ÉTRANGÈRES » qui suit la section 12) : une vue ou un index se juge avec ses tables et le code qui s'en sert.

| Lot | Sections | Code qui lit ou écrit ces tables (à relire avec elles) |
| --- | --- | --- |
| A | 0, 1 (pages, liens, mots-clés, sources), 10 (transversal), 11 (dérivées) | `client/scripts/db-*.mjs`, `tools/db/`, `data/derive.sql`, `lib/wiki.ts`, `wikilinks.mjs`, `lib/mots-cles*.mjs`, `lib/search.mjs` |
| B | 2 (règles de la fiche), 3 (magies, sorts), 4 (annexes), 5 (dieux), 5 bis (chronologie) | `lib/magies-db.mjs`, `sort-*.mjs`, `fiche-regles.mjs`, `fiche-moteur.mjs`, `chronologie-db.mjs`, `tools/sheets/` |
| C | 6 (classes), 7 (races) | `lib/classes-db.mjs`, `classe-*.mjs`, `races-db.mjs`, `race-relations.mjs`, `tools/db/races_onglet.py` |
| D | 8, 8 bis (bestiaire) | `lib/bestiaire-db.mjs`, `monstre-champs.mjs`, `serveur/edition-bestiaire.mjs`, `tools/bestiaire/` |
| E | 9 (équipement, ressources, craft, métiers) | `lib/armes-db.mjs`, `arme-champs.mjs`, `accessoires-db.mjs`, `composants-db.mjs`, `metiers.mjs` |
| F | 13 (fiches), 14 (édition), 15 (notes de version) | `client/serveur/`, `lib/fiche-format.mjs`, `lib/ressources*.mjs`, `lib/notes-de-version*.mjs` |

Donner à chaque `expert-sql` : ses sections, le chemin de l'audit, la consigne de ne rien conclure d'avance et le format de réponse (§4). Pour chaque table et vue du lot :

1. **Structure** : le DDL et son commentaire contre les conventions (en-tête de `schema.sql`) ; clés, nullabilité, `CHECK`, `ON DELETE`, index utiles aux requêtes réelles (grep du nom de la table dans le code du tableau).
2. **Données** : `count(*)`, un échantillon (`SELECT * … LIMIT 20`), la distribution des colonnes typées, les valeurs extrêmes ; cohérence avec la page (`page_entite`), avec la colonne `*_brut`, avec ses tables de détail.
3. **Vues** : la définition (jointures qui dupliquent, `LEFT` / `INNER`, filtres oubliés), `EXPLAIN QUERY PLAN`, et si quelqu'un la lit encore.
4. **Code** : le SQL qui écrit ou lit la table (service, importeurs, `lib/*-db.mjs`) : paramètres liés, noms vérifiés avant interpolation, transactions, `foreign_keys = ON`.
5. **Documentation** : commentaires du schéma, `npm run db:doc -- --check` (depuis `client/` : n'écrit rien, échoue si `docs/sql/structure.md` ou `apercu.md` n'est plus à jour), compteurs de `CLAUDE.md` (tables, vues, clés étrangères).

Tout constat qui met en cause le **fond** (valeur, nom, règle) part à `gardien-des-regles` ; une valeur à trancher devient une question au propriétaire.

## 4. Synthèse (session principale)

Chaque `expert-sql` rend un rapport de lot : un tableau `#` (`A1`, `A2`…) | gravité | objet (`table.colonne`, vue, `fichier:ligne`) | constat | preuve
(requête et résultat) | proposition | qui ; puis les constats écartés, une ligne chacun avec la convention qui les explique ; puis le bilan par gravité.

La session principale les réunit dans `docs/sql/relecture-AAAA-MM-JJ.md`, que le propriétaire peut lire sans le reste : en tête le bilan (constats par
gravité et par lot) et la commande d'audit qui l'a nourri, puis un tableau par lot, puis les constats écartés (pour ne pas les relire la prochaine fois).

Gravités : **bloquant** (donnée fausse, intégrité rompue, perte possible), **à corriger** (incohérence, contrainte ou index manquant, risque à la prochaine écriture), **suggestion** (performance, lisibilité, portabilité, ménage), **question** (au propriétaire : ajoutée aussi à `docs/sql/a-valider.md`).

## 5. Corriger

Par lots thématiques, une branche et une PR par lot (`docs/flux-git.md`). Un changement de schéma : `ingenieur-donnees` modifie `data/schema.sql`, écrit
`data/migrations/NNNN-<nom>.sql` et la passe par `npm run db:migrate` (avant de commiter le schéma : elle part du schéma du dernier commit), puis
`npm run db:doc`, `db:build`, `db:check` et `npm test`, avec un test dans `client/test/` ; le SQL du site ou du service : `ingenieur-site`.
`relecteur-critique` relit ; `chef-de-flux-git` publie. Une question au propriétaire n'est corrigée qu'une fois tranchée (`docs/decisions-regles.md`).

## Garde-fous

- **Lecture seule** : `var/maverick.db` ouverte en lecture seule, ou une copie ; jamais la base vivante d'un serveur, jamais le contenu des tables des sections 13 et 14 (fiches, journal : vides dans `data/rows`).
- **Règle d'or** (`CLAUDE.md`) : aucune valeur déduite ; une incohérence de contenu est une question, pas une correction.
- **Identifiants figés** : un nom corrigé l'est partout et sa clé `*_cle` est recalculée, mais son identifiant ne change jamais (`CLAUDE.md`, « Orthographe »).
- **Le site de dev est la source** de ce qu'il modifie : une valeur qui diffère de l'import n'est pas une erreur en soi (`historique_modification`, `lib/historique-site.mjs`).
- `data/rows` ne se modifie jamais à la main.
