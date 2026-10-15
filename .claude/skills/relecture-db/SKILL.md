---
name: relecture-db
description: Relecture complète de la base SQLite de Maverick (schéma, contraintes, intégrité, qualité des données, vues, index, portabilité, usage dans le code), section par section du schéma, menée par l'agent expert-sql. À utiliser quand on demande de relire, auditer ou passer en revue toute la base (ou une section), ou avant une grosse migration.
---

# Relecture complète de la base

Une relecture **ne corrige rien** : elle produit des constats prouvés, puis les corrections passent par le circuit habituel (`docs/equipe.md`).

| Qui | Fait quoi |
| --- | --- |
| `expert-sql` | Mène la relecture, en lecture seule ; chaque constat est prouvé par une requête |
| `gardien-des-regles` | Juge le fond d'un constat de contenu (valeur conforme à la source, décision R…) |
| `ingenieur-donnees` | Corrige : migration `data/migrations/`, importeur, `data/rows` par les outils |
| `ingenieur-site` | Adapte le code qui lit la base quand une correction le touche |
| `relecteur-critique`, `chef-de-flux-git` | Relisent puis publient chaque lot de corrections |

## 1. Préparer (depuis `client/`)

```bash
npm ci                      # si node_modules manque
npm run db:build            # var/maverick.db (ignorée par git)
npm run db:check            # contrôles qui font foi : doit être vert avant de relire
npm run db:pages-check
```

`db:check` rouge : c'est le premier constat (bloquant), à rendre à `ingenieur-donnees` avant le reste.

## 2. Audit automatique

```bash
node .claude/skills/relecture-db/audit.mjs --sortie <scratchpad>/audit.md          # Markdown
node .claude/skills/relecture-db/audit.mjs --json --sortie <scratchpad>/audit.json # le même relevé en JSON
```

Le script travaille sur une copie de la base (dans un dossier temporaire) et relève, rangé par section du schéma : intégrité du moteur et de la recherche plein texte,
tables (STRICT, clé primaire, écart avec `schema.sql` et `data/rows`, tables vides), clés étrangères (sans index, types, cibles, colonnes `*_id` sans clé),
index redondants, booléens et énumérations sans `CHECK`, colonnes toujours `NULL` ou constantes, anomalies de texte, doublons de `*_cle`, rangs, vues
(erreurs, durées, parcours complets), portabilité hors de la liste admise, tables et vues que le code ne lit jamais.

Ce sont des **pistes** : un constat de l'audit est confirmé ou écarté à la relecture, jamais recopié tel quel dans le rapport. Les conventions du projet
(liste dans `.claude/agents/expert-sql.md`) expliquent beaucoup de « faux positifs » : les écarter en citant la convention.

## 3. Relire section par section

Une relecture par lot de sections de `data/schema.sql`, confiée à `expert-sql` (lots indépendants : en parallèle). Découpage conseillé :

| Lot | Sections | Code qui lit ces tables (à relire avec elles) |
| --- | --- | --- |
| A | 0, 1 (pages, liens, mots-clés, sources), 10 (transversal), 11 (dérivées), 12 (vues génériques) | `client/scripts/db-*.mjs`, `tools/db/`, `lib/wiki.ts`, `lib/mots-cles*.mjs` |
| B | 2 (règles de la fiche), 3 (magies, sorts), 4 (annexes), 5 (dieux), 5 bis (chronologie) | `lib/magies-db.mjs`, `sort-*.mjs`, `fiche-regles.mjs`, `chronologie-db.mjs` |
| C | 6 (classes), 7 (races) | `lib/classes-db.mjs`, `classe-*.mjs`, `races-db.mjs`, `race-relations.mjs` |
| D | 8, 8 bis (bestiaire) | `lib/bestiaire-db.mjs`, `monstre-champs.mjs`, `tools/bestiaire/` |
| E | 9 (équipement, ressources, craft, métiers) | `lib/armes-db.mjs`, `arme-champs.mjs`, `accessoires-db.mjs`, `composants-db.mjs`, `metiers.mjs` |
| F | 13 (fiches), 14 (édition), 15 (notes de version) | `client/serveur/`, `lib/fiche-format.mjs`, `lib/ressources*.mjs`, `lib/notes-de-version*.mjs` |

Donner à chaque `expert-sql` : ses sections, l'extrait de l'audit qui les concerne, et la consigne de ne rien conclure d'avance. Pour chaque table et vue du lot :

1. **Structure** : le DDL et son commentaire contre les conventions (en-tête de `schema.sql`) ; clés, nullabilité, `CHECK`, `ON DELETE`, index utiles aux requêtes réelles (grep du nom de la table dans le code du tableau).
2. **Données** : `count(*)`, un échantillon (`SELECT * … LIMIT 20`), la distribution des colonnes typées, les valeurs extrêmes ; cohérence avec la page (`page_entite`), avec la colonne `*_brut`, avec ses tables de détail.
3. **Vues** : la définition (jointures qui dupliquent, `LEFT` / `INNER`, filtres oubliés), `EXPLAIN QUERY PLAN`, et si quelqu'un la lit encore.
4. **Code** : le SQL qui écrit ou lit la table (service, importeurs, `lib/*-db.mjs`) : paramètres liés, noms vérifiés avant interpolation, transactions, `foreign_keys = ON`.
5. **Documentation** : commentaires du schéma, `docs/sql/structure.md` (`npm run db:doc` doit ne rien changer), compteurs de `CLAUDE.md` (tables, vues, clés étrangères).

Tout constat qui met en cause le **fond** (valeur, nom, règle) part à `gardien-des-regles` ; une valeur à trancher devient une question au propriétaire.

## 4. Synthèse

Un rapport en français, `docs/sql/relecture-AAAA-MM-JJ.md`, que le propriétaire peut lire sans le reste :

- en tête, le bilan (combien de constats par gravité et par lot) et la commande d'audit qui l'a nourri ;
- un tableau par lot : `#` (`A1`, `A2`…), gravité, objet (`table.colonne`, vue, `fichier:ligne`), constat, preuve (requête et résultat), proposition, qui ;
- les constats écartés, en une ligne chacun avec la convention qui les explique (pour ne pas les relire la prochaine fois).

Gravités : **bloquant** (donnée fausse, intégrité rompue, perte possible), **à corriger** (incohérence, contrainte ou index manquant, risque à la prochaine écriture), **suggestion** (performance, lisibilité, portabilité, ménage), **question** (au propriétaire : ajoutée aussi à `docs/sql/a-valider.md`).

## 5. Corriger

Par lots thématiques, une branche et une PR par lot (`docs/flux-git.md`) : `ingenieur-donnees` écrit la migration et son test (`client/test/`), `npm run db:doc`,
puis `db:build`, `db:check`, `npm test` ; `relecteur-critique` relit ; `chef-de-flux-git` publie. Une question au propriétaire n'est corrigée qu'une fois tranchée (`docs/decisions-regles.md`).

## Garde-fous

- **Lecture seule** : `var/maverick.db` ouverte en lecture seule, ou une copie ; jamais la base vivante d'un serveur, jamais le contenu des tables des sections 13 et 14 (fiches, journal : vides dans `data/rows`).
- **Règle d'or** (`CLAUDE.md`) : aucune valeur déduite ; une incohérence de contenu est une question, pas une correction.
- **Identifiants figés** : un identifiant ne se renomme jamais pour la beauté (`CLAUDE.md`, orthographe) ; une correction de nom passe par sa clé `*_cle`.
- **Le site de dev est la source** de ce qu'il modifie : une valeur qui diffère de l'import n'est pas une erreur en soi (`historique_modification`, `lib/historique-site.mjs`).
- `data/rows` ne se modifie jamais à la main.
