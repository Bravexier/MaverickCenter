---
name: sources-codex
description: "Codex : export Markdown du Google Doc « CODEX Maverick » dans sources/raw/, découpage en 116 pages lore/ par tools/docs/codex.py, registre de corrections (R21), --verifier, pages modifiables sur le site de dev. À charger avant de lire, modifier ou relire le Codex, son script ou son test."
paths: ["tools/docs/codex.py", "tools/docs/codex-corrections.json", "sources/raw/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg*", "sources/raw/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg/**", "client/test/codex.test.mjs", "docs/codex.md", "client/test/eaunoire.test.mjs"]
user-invocable: false
---
# Codex (Google Doc « CODEX Maverick »)

## Fichiers
- `sources/raw/1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg.md` : l'export Markdown de la copie du propriétaire (2026-10-11), tel quel ; ses images à part dans le dossier
  du même nom.
- `tools/docs/codex.py` : le découpage en pages `lore/` (famille `docs`) et son vérificateur `--verifier`.
- `tools/docs/codex-corrections.json` : les corrections appliquées avant le découpage.
- `client/test/codex.test.mjs` : vérificateur, pages dans la base, R21, registre.

## À lire
- `docs/codex.md` : ce qui est importé, les parties du document, règles du découpage, « Modifier le Codex (site de dev) », corrections, questions au
  propriétaire.
- Chronologie tirée du texte des pages du Codex : skill `zone-chronologie`. Mots-clés (vocabulaire, jamais créé par un import) : skill `zone-mots-cles`.
  Éditeur des pages : skill `zone-edition` (et skill `zone-guide` pour l'éditeur de texte partagé).

## Ce que produit le script
- 116 pages `lore/` : une par divinité, temple ou guilde, nation ou région, objet légendaire, plus les sommaires et `lore/codex` (sommaire de tout le document).
- Menu Codex › Mythologie et › Factions mènent aux sommaires (skill `zone-menu`).

## Invariants
- Le texte est copié, jamais réécrit (coquilles, majuscules, formulations du document ; seule la forme Markdown change). Seules exceptions : les corrections
  du registre `codex-corrections.json`, limitées à ce qu'impose une décision ou une correction déjà faite dans toute la base (décision R21 « Eaunoire » ;
  « ect » → « etc. » comme 0005, « purée de poix » → « purée de pois » comme 0006). Chaque entrée a son nombre d'occurrences attendu.
- L'export dans `sources/raw/` reste tel quel ; les corrections se font dans le script, avant le découpage.
- `--verifier` relit l'export ligne par ligne, par un code qui ne partage pas le découpage.
- Le site de dev est la source de ce qu'il modifie. Les pages du Codex se modifient sur le site de dev comme celles du guide (titre, texte ;
  `lib/edition-modele.mjs#texteDePageModifiable`). Une page modifiée est contrôlée par `--verifier` dans son état d'import (`historique_modification`,
  `pages_du_site`), et `codex.py` la garde telle quelle à l'écriture.
- Un import ne crée jamais de mot-clé : le script n'écrit que les mots-clés du vocabulaire (`--vocabulaire`, `vocabulaire()` → `Vocabulaire`), chaque page ne porte que « codex » ; le mot-clé à adresse d'une page n'est jamais posé en étiquette (`Vocabulaire.etiquette`).
- Un renvoi (sommaires, « Voir aussi ») est la balise du mot-clé dont l'adresse mène à la page (`/lore/<slug>/`, sans ancre) : s'il n'y en a pas exactement un, le renvoi est écrit en texte simple et signalé (`Codex.lien`). `{{id}}` quand le texte est le libellé d'import du mot-clé (un renommage sur le site ne change pas la page redonnée), `{{id|texte}}` sinon ; jamais un `[[…]]` (`db:check`). Détail : `docs/codex.md`.
- `--verifier` lit un état d'import d'avant la 0096 en convertissant ses `[[…]]` comme le script les écrit (`liens_en_balises`).
- Le script n'écrit que dans `lore/`, refuse d'écraser une page qui ne vient pas du document et signale, sans les supprimer, les pages qu'il ne produit plus.

## Nouvel export
1. Remplacer l'export dans `sources/raw/`.
2. `python3 -I tools/docs/codex.py`, puis `python3 -I tools/docs/codex.py --verifier`.
3. `npm run db:sync-pages` (depuis `client/`), puis commiter `data/rows`.
4. La chronologie, qui cite le texte des pages : `node tools/chronologie/chronologie.mjs --verifier` (détail : `docs/codex.md`, « Règles du découpage »).

## Choix du propriétaire
- Décision R21 : « Eaunoire », en un seul mot ; la page s'appelle « Eaunoire », alias « Eaunoir ».
- La relecture orthographique du Codex (R10) reste à faire, par une migration de données avec son registre (skill `base-orthographe`).

## Tests
- `client/test/codex.test.mjs`. Un test qui simule une édition de page part de son état d'import (titre, texte, alias), pas du `.md` courant (le site peut modifier les 116 pages) ; les liens se résolvent comme le site (`lib/wikilinks-resolution.mjs`, slug compris), sur la base d'import (`test/aide-base-d-import.mjs`).
- `client/test/eaunoire.test.mjs` : R21 dans la base (migration `0012-eaunoire`, nom corrigé partout, identifiant inchangé, le sort « Eau noire » garde le sien).
- L'aller-retour de l'éditeur sur les pages du Codex : `client/test/markdown-edition.test.mjs` (skill `zone-edition`).
