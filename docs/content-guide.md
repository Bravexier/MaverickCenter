# Écrire des pages du wiki

Une page = un fichier Markdown `client/src/content/wiki/<catégorie>/<slug>.md`.
Les catégories sont définies dans `client/src/lib/types.mjs` (`races`, `classes`, `magies`, `bestiaire`, `ressources`,
`metiers`, `guide`, `lore`, `cartes`) ; chacune correspond à un salon Discord.

```markdown
---
title: Elfe sylvestre          # obligatoire
aliases: [Elfes des bois]       # autres noms, utilisables dans [[ ]]
tags: [peuple, forêt]           # pages /tags/<mot-clé>/
summary: Une phrase de résumé.  # affichée dans les listes et la recherche
sources: [Discord #lien-pour-races, https://docs.google.com/document/d/…]
status: draft                   # example | draft | verified
---

Texte en Markdown. Un [[Mage]] ou une [[Magie du feu|magie ardente]] sont des liens vers d'autres pages.
```

## Liens entre pages

| Écriture | Effet |
| --- | --- |
| `[[Titre]]` | lien vers la page dont le titre, l'alias ou le slug correspond |
| `[[Titre\|texte]]` | idem, avec un texte d'affichage différent |
| `[[races/elfe]]` | désigne la page sans ambiguïté (utile si deux pages ont le même titre) |

La casse, les accents et les apostrophes sont ignorés. Les liens sont **résolus au build** :

- une page cible affiche automatiquement « Mentionnée par … » (rétroliens) ;
- un lien sans cible s'affiche en rouge, un avertissement `[wikilinks]` apparaît au build, et la page figure dans
  « Pages à créer » de `/wiki/` ;
- un titre porté par plusieurs pages est signalé comme ambigu : utiliser `[[catégorie/slug]]`.

Les `[[…]]` placés dans du code (`` `…` `` ou bloc ```) ne sont pas interprétés.

## Statuts

- `example` : contenu de démonstration (bandeau jaune) — à supprimer.
- `draft` : importé depuis une source, pas encore relu par le MJ (défaut).
- `verified` : relu et validé.

## Conventions

- Noms de fichiers en ASCII minuscule avec tirets (`elfe-sylvestre.md`) : le slug devient l'URL.
- Toujours renseigner `sources:` pour pouvoir retrouver l'origine d'une règle.
- Ne rien inventer : un point de règle absent des sources reste absent (ou marqué « à confirmer »).
- Après l'ajout d'un **nouveau fichier**, relancer `npm run dev` (l'index des liens est lu au démarrage).

## Maillage automatique

Après un import, `npm run autolink` (depuis `client/`) propose des liens `[[…]]` vers les pages dont le titre ou un alias apparaît
dans le texte des autres pages. **Sans option, il n'écrit rien** : il affiche les statistiques et les 40 premiers liens ;
`npm run autolink -- --write` les applique, `-- --verbose` liste tout. Règles (précision d'abord) :

- un seul lien par page cible dans une page, jamais vers la page elle-même ni vers un terme de son propre nom ;
- rien dans le frontmatter, les titres, les tableaux, le code, les liens et URLs existants ;
- un titre porté par plusieurs pages est ignoré ; un titre d'un seul mot n'est lié que s'il commence par une majuscule ;
- les locutions courantes qui sont aussi un titre (par exemple « en résumé ») se déclarent dans `client/scripts/autolink-ignore.txt`.

L'outil ne modifie que du balisage de lien (vérifié : en retirant les `[[…]]`, on retrouve exactement le texte d'origine) et
peut être relancé sans risque après chaque import. Relire le résultat avec `git diff` avant de commiter.
