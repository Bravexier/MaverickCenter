---
name: verifier-une-source
description: "Retrouver et citer la source d'une règle, d'une valeur ou d'un fait du lore (manifeste, exports bruts, base dans son état d'import, originaux Google, décisions R…) et juger si une affirmation est sourcée. Préchargé par Game Design et WorldBuilding ; à charger avant d'affirmer ou de relire une règle ou un fait du lore."
user-invocable: false
---

# Vérifier une source

## D'où viennent les règles et le lore

- **Le registre.** Le Discord « L'univers de Maverick » renvoie à des Google Docs et Sheets, recensés dans `sources/sources.json` et expliqués dans `docs/sources.md` (quel document pour quelle catégorie).
- **Les exports bruts.** Ils sont dans `sources/raw/` (Docs, instantanés des classeurs dans `sources/raw/classeurs/`, Codex, `bestiaire-2-0.txt`) et dans `sources/discord/`.
- **La base** (`data/rows`, `var/maverick.db` après `npm run db:build`) est une copie reconstruite des sources, corrigée par les décisions et par les modifications faites sur le site de dev. Sa valeur d'import se lit dans `historique_modification` (`client/src/lib/historique-site.mjs` : `valeurDImport`, `lignesDImport`).
- **Les originaux Google font foi** pour vérifier une table ou appliquer une mise à jour (décision R83). Ils sont toujours tenus à jour, alors que le Drive du propriétaire n'en garde que des copies.
  - Ils se lisent par les connecteurs Google de la session (`tech-sources`).
  - Depuis une session cloud, Discord et `docs.google.com` sont bloqués par la politique réseau, et aucun connecteur Discord n'existe.
  - Ne jamais utiliser un jeton Discord personnel.
- **Les décisions du propriétaire** sont dans `docs/decisions-regles.md` (R1 et suivantes). Elles priment sur les sources qu'elles tranchent. Ce registre fait 243 Ko : ne le lis jamais en entier. Lis `docs/decisions-index.md` (une ligne par décision), puis cherche le numéro ou un mot-clé avec Grep dans le registre.

## Juger une affirmation

1. **Elle cite sa source** : document et section, onglet et case, page de la base, ou décision R…. Sinon, elle est non sourcée.
2. **La source dit bien cela**, au mot près pour un chiffre ou un nom. Une source qui « laisse penser » ne suffit pas.
3. **Elle ne contredit aucune décision.** Chercher dans le registre les décisions qui nomment la même chose (`Grep` sur le nom, la table, la case).
4. **Deux sources se contredisent sans décision** : c'est une question au propriétaire (`poser-une-question`). La base garde alors les deux lectures (`ecart_source`, colonnes côte à côte).
5. **Les fixtures ne sont pas du lore** : `status: example` et `meta.status: "example"`.
6. **Un texte copié n'est pas réécrit** : Codex, citations « telles quelles » de la fiche V15.2.2, extraits de la chronologie. Seules les fautes d'orthographe sont corrigées, et seulement par les registres (`base-orthographe`).
