---
name: modifier-une-page-wiki
description: "Modifier, créer ou supprimer une page du wiki (texte, titre, alias, mots-clés) : un lot de changements proposé sur le site de dev, appliqué par le propriétaire ; jamais un commit de data/rows. À charger avant de changer le texte d'une page ou de toucher client/src/content/wiki/."
---

# Modifier une page du wiki

La base du site de dev fait foi (R274). Le texte d'une page change par un **lot de changements** déposé sur le site de dev (R291, qui remplace R275 (4)). `data/rows` n'est qu'une copie écrite par le workflow : aucun outil ni commit n'y écrit (contrôle `controle-du-contenu-ecrit`, `docs/flux-git.md`, « Contenu écrit à la main »).

Les `.md` de `client/src/content/wiki/` sont **fabriqués** (`npm run db:export-pages`, avant `dev`, `build` et `test`) et ignorés par git : les modifier ne change rien. Détail du format : `docs/content-guide.md`.

1. **Lire l'état en place** dans l'extrait du jour (`npm run db:extrait`, skill `interroger-la-base`) : table `page` (`titre`, `resume`, `corps_md`), ses alias et ses mots-clés. Jamais `data/rows` ni `var/maverick.db`, copies datées : l'`avant` du lot doit être la valeur en place.
2. **Écrire le lot** (`maverick-lot/1` ; `docs/serveur.md`, « Lots de changements (format) ») : `titre`, `nature` (`source`, `decision` avec son `R…`, `migration` ou `code` ; jamais `saisie`), une opération par ligne (`modifier` avec `avant` et `apres` des colonnes touchées, `inserer`, `supprimer` avec la ligne entière en `avant`). Un changement **décidé par le propriétaire** porte `nature: decision` et le champ `decision` (`R…`), jamais `source`, réservé à ce qui vient d'une source (réimport, original Google) : l'état d'origine ne défait pas une trace `source` (`NATURES_DEFAITES`, `docs/serveur.md`), qui passe pour la valeur d'import. La nature d'un lot appliqué ne se corrige par aucune route : la vérifier avant le dépôt.
3. **Le déposer** : `POST /api/edition/lots/` (en-tête `X-Maverick-Cle`). Clé de dépôt posée : avec la clé de dépôt, le lot est appliqué aussitôt s'il passe les contrôles (sinon `409`, refusé avec ses motifs : rien n'entre) ; un verrou de décision ne s'ouvre pas avec elle (mot de passe seul). Sans clé de dépôt posée : clé de lecture, et le lot reste une proposition qui attend le clic du propriétaire. `400` : `erreurs`, avec le rang de l'opération à corriger. `201` : l'essai à blanc (`verdict` : `applicable`, `verrous`, `a_corriger`, `rien_a_ecrire`). Service : skill `zone-edition-lots`.
4. **Le propriétaire** peut annuler chaque ligne sur la page Mise à jour (ou appliquer ou refuser une proposition). Le rapport donne l'id du lot, son état et le verdict de l'essai. Le contenu rejoint `data/rows` par la prochaine copie ou mise à jour (R278).

À savoir :

- **Pages typées.** Les pages de magie, race, classe, métier, arme, bestiaire, équipement… sont rendues depuis les **tables** : le lot change la ligne de l'entité, pas le corps de sa page.
- **Suppression d'une page** : par le service, qui emporte ses lignes dépendantes ; le lot ne les porte pas (skill `zone-edition-lots`).
- **Mots-clés.** Un mot-clé nouveau s'insère dans le même lot (le service lui donne son id) : skill `zone-edition-lots`.
- **Maillage automatique.** `npm run autolink -- --lot <lot.json> --titre <titre>` écrit un lot de nature `source` (`--write` est retiré) ; l'outil n'envoie rien : un humain le propose (étape 3).
- **Circuit `.md`.** Des `.md` modifiés (à la main, ou réécrits par un importeur) deviennent un lot par `npm run db:sync-pages -- --lot <lot.json> --titre <titre>` (`client/scripts/db-sync-pages.mjs` : copie de l'extrait du jour, `pages_md.py sync --base <copie>`, lot `source`). Il n'écrit jamais `data/rows` ni n'envoie rien : un humain propose le lot (`POST /api/edition/lots/`). Les `.md` de départ viennent du même extrait (`MAVERICK_CONTENU=<extrait> npm run db:export-pages`).
- **Liens.** Un lien vers une page ou une section s'écrit avec la balise d'un mot-clé dont l'adresse y mène (`{{clé}}`, `{{clé|texte}}` ; l'adresse peut porter une ancre). `[[…]]` et `[texte](/…)` sont refusés par `db:check` (rejoué par l'essai à blanc) hors pages d'exemple. Une page sans mot-clé qui y mène se lie après avoir donné l'adresse à un mot-clé : skill `zone-mots-cles-liens`.
- **Ancre figée.** Un intertitre que le code ou un lien vise porte ` {#ancre}` au bout de sa ligne (`## La ceinture {#la-ceinture}`) : le texte peut changer, jamais l'ancre, et un renvoi vise l'ancre, jamais le texte (`lib/ancres-figees.mjs` ; `docs/content-guide.md`, « Ancres figées des intertitres »).
- **Titre cité par un texte copié.** Une page retirée dont un texte copié d'une source cite le titre en `[[Titre]]` garde ce lien résolu par un alias posé sur la page qui reprend son contenu ; le texte copié n'est pas réécrit (précédents : migration 0091, « Postures » en 0094).
- **Texte copié.** Le Codex, les citations « telles quelles » et les extraits de la chronologie ne se réécrivent pas (`verifier-une-source`).
