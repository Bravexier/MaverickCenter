---
name: modifier-une-page-wiki
description: "Modifier, créer ou supprimer une page du wiki (texte, frontmatter) quand la base en est la source — .md fabriqué par db:export-pages, puis db:sync-pages vers data/rows. À charger avant de toucher client/src/content/wiki/ ou le texte d'une page."
---

# Modifier une page du wiki

Les fichiers `client/src/content/wiki/<type>/<slug>.md` sont **fabriqués** depuis `data/rows` par `npm run db:export-pages`, lancé avant `dev`, `build` et `test`. Ils sont ignorés par git. La source est la base. Détail : `docs/content-guide.md` (en-tête) et `docs/sql/remplissage.md` (« Les pages du wiki viennent de la base »).

1. Depuis `client/` : `npm run db:export-pages`, s'ils manquent.
2. Modifier le `.md` fabriqué : texte, `title`, `aliases`, `tags` écrits par libellé, `summary`. Le format du frontmatter est décrit dans `docs/content-guide.md`.
3. `npm run db:sync-pages`, puis **lire sa sortie**. Une page ajoutée à la main doit avoir une première source « Google Doc « … » » (famille `docs`), ou `status: example`. Sinon elle est refusée, et le prochain `db:export-pages` efface le `.md`.
4. Commiter `data/rows` seulement, jamais le `.md`.
5. Contrôles : `npm run db:pages-check`, `npm test`, et `npm run build` si le rendu change.

À savoir :

- **Pages typées.** Les pages de magie, race, classe, métier, arme, bestiaire, équipement… sont rendues depuis les **tables**. Leur `.md` ne sert qu'à la recherche et aux `[[liens]]` : changer la donnée se fait dans les tables, par une migration (`ecrire-une-migration`) ou depuis le site de dev.
- **Pages créées par un importeur.** Les familles autres que `docs` et `exemple` voient leurs pages créées par leur importeur.
- **Mots-clés.** Un import ne crée jamais de mot-clé : une écriture inconnue n'est pas posée, et `db:sync-pages` la signale (`zone-mots-cles`).
- **Maillage automatique.** `npm run autolink -- --write` modifie les `.md` fabriqués : le faire suivre de `db:sync-pages`.
- **Texte copié.** Le Codex, les citations « telles quelles » et les extraits de la chronologie ne se réécrivent pas (`verifier-une-source`).
