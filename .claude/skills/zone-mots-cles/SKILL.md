---
name: zone-mots-cles
description: "Glossaire mot_cle : id entier, clé recalculée (R232), catégories, synonymes (R233), icône (R235), balises {{clé}} (saisie, forme canonique, rendu par le middleware, db:check), MOTS_CLES_PROTEGES, importeurs. Ce que le service refuse : skill zone-mots-cles-service. À charger avant de lire, modifier ou relire ce code ou un texte qui cite un mot-clé."
paths: ["client/src/lib/mots-cles.mjs", "client/src/lib/mots-cles-{balises,db,cles,proteges}.mjs", "client/src/lib/icones.mjs", "client/src/middleware.mjs", "client/src/styles/global/mots-cles.css", "client/src/scripts/edition/mots-cles-vivants.mjs", "tools/db/homonymes.py", "client/test/mots-cles-{balises,cles,python,r195,vivants,vivants-liens,liens-rendu}.test.mjs", "client/test/aide-mots-cles.mjs", "client/test/{texte-en-place-mots-cles,importeurs-etiquettes,db-lexique-en-mots-cles}.test.mjs", "client/test/db-011{3,4,5,6}-*.test.mjs", "data/migrations/{0043,0056,0058,0090,0112,0113,0114,0115,0116}-*"]
user-invocable: false
---
# Mots-clés (glossaire)

## Fichiers
- Clé : `lib/mots-cles-cles.mjs#clesDesMotsCles`, jumelle de `tools/db/maverick.py#cles_des_mots_cles` (comparées par `mots-cles-cles.test.mjs`).
- Balises : `lib/mots-cles-balises.mjs` (`vocabulaireDesMotsCles`, `motCleDeLaRef`, `ambiguiteDe`, `formeCanonique`, `fautesDuSynonyme`, `EXCLUS`, `SANS_LIEN`).
- Rendu : `src/middleware.mjs` (build et `astro dev`), `styles/global/mots-cles.css` ; site de dev : `src/scripts/edition/mots-cles-vivants.mjs` (vocabulaire vivant, HTML posé après le chargement).
- Vocabulaire : `lib/mots-cles.mjs` (`MOTS_CLES_PROTEGES`, `estProtege`, `estVerrouille`), `lib/mots-cles-proteges.mjs`, `lib/mots-cles-db.mjs` (`motsClesDeLaBase`, `categoriesDesMotsCles`, `textesDeLaBase`).
- Icônes : `lib/icones.mjs` (`ICONES`, `icone`, `fauteDeLIcone`), la seule liste : `db:check`, le service (`refuserLIcone`), `GET /api/edition/listes/` et l'éditeur la lisent.
- Importeurs : `tools/db/maverick.py`, `tools/db/homonymes.py`, `tools/docs/codex.py --vocabulaire`.
- Voisins : skills `zone-mots-cles-service` (ce que le service écrit et refuse), `zone-mots-cles-liens` (adresse, couleur), `zone-mots-cles-balisage`, `zone-glossaire`, `zone-recherche`, `zone-edition-rejeu` (lots d'avant une migration). La chronologie a ses propres catégories : skill `zone-chronologie`.

## À lire
- `docs/content-guide.md`, « Mots-clés (glossaire) » : « Le Glossaire » (noms, homonymes, monnaies), « Gérer le vocabulaire », ce qui n'est pas un mot-clé.
- `docs/serveur.md`, « Édition des règles (site de dev) », paragraphe des balises (forme canonique par la clé, saisie, casse).

## Les tables (migrations 0043, 0056, 0090, 0098, 0110, 0113 à 0116 ; schéma : skill `base-sqlite`)
- `mot_cle` : `id` entier attribué à la création, figé, jamais réutilisé (R232 (1)) ; `libelle`, pas unique ; `cle` calculée ; `description` (NULL tant qu'elle n'est pas écrite, lue `?? ''`) ; `couleur`, `url` ; `verrou` ; `monnaie_id` (sa monnaie, `ON DELETE SET NULL`) ; `icone` (`<famille>:<id>`, 0116). Aucune route n'écrit `cle`, `verrou` ni `monnaie_id`.
- `categorie_mot_cle` (libellé unique, 11 au départ), `mot_cle_categorie`, `mot_cle_ancienne_cle` (une clé quittée → le mot-clé), `mot_cle_synonyme` (dans l'ordre ; écriture normalisée unique).
- La clé (R232 (2), (9), (10)) : sans homonyme, `normalize(libelle)` ; des homonymes (même `normalize`) prennent ensuite, chacune après un tiret, les catégories qui ne sont pas communes à tous, dans l'ordre de leur id (`namazu-race`, `namazu-classe`). Refusés : un homonyme sans catégorie propre face à chacun des autres (aucune, ou incluses dans celles d'un autre) ; une clé déjà prise.
- R232 (4) remplace R191 : les 13 classes raciales s'appellent comme leur race (catégorie Classe ; la race a Race, 0114) ; le libellé s'affiche tel quel.
- Synonymes (R233) : saisie d'une balise, recherche, affichage ; la clé n'en dépend pas. L'abréviation en est devenue un (0115) ; « CR » est un synonyme de `corruption` (R183 (3)). Unicité (R233 (4), `fautesDuSynonyme`, `db:check` et service) : ni le libellé de son mot-clé, ni le libellé, un synonyme ou la clé d'un autre.
- « Action bonus » et « Action rapide » sont fondus dans « Instant Cast », dont ils sont les synonymes (R233 (5)).
- Icône (R235) : un dessin du site, choisi dans `ICONES` ; RF, RO, PP l'ont reçue (0116). Elle s'affiche par `icone` (`htmlDeLIcone`), plus par `monnaie_id`, et n'est pas vidée quand sa monnaie est supprimée. Le verrou la couvre (R235 (5)). `monnaie_id` ne sert plus qu'à retirer de « Aussi appelé », partout, l'abréviation de sa propre monnaie (`synonymesAffiches`, R234 (8), R235 (4)). Les étiquettes protégées s'appellent « Classe » et « Métier » (R183 (8)).
- Une page porte un mot-clé par `page_tag.tag_id` (`ON DELETE CASCADE`) ; un sort, en étiquette, par `sort_mot_cle` (0067, sans cascade : R114 ; « Sort fer » : R164).
- Mots-clés de la fiche (R231 (4), migration 0112) : les compétences et les 6 caractéristiques sont des mots-clés colorés `caracteristique:<id>`, sans adresse ni abréviation (sinon `npm run autolink` proposerait « Force », « Arc »… partout). La compétence Magie a l'id `magie-competence`, libellé « Magie (compétence) » : « magie » est une étiquette posée par l'importeur des magies (`tools/sheets/magies.py`, `MAGIES`). Un mot-clé à adresse a verrou 1 (R219 (1), `serveur-edition-verrou`) : les notions créées à verrou 0 (`jet-dattaque`, `jet-de-defense`, `ambidextrie`, `localisation-des-degats`, `meilleur-resultat`) restent sans adresse.

## Balises
- Marquage explicite seulement, jamais de repérage automatique (demande du propriétaire). `{{ref}}`, `{{ref|texte}}` (gras, définition en infobulle), `{{ref:}}` (« **Libellé** : définition »). Dans une case de tableau Markdown, `\|`.
- Saisie : la ref se cherche, sans égard à la casse (R233 (10)), comme clé, puis libellé porté par un seul mot-clé, puis synonyme, puis clé quittée (l'ordre de `maverick.py#trouver_mot_cle`). Un libellé que portent des homonymes est ambigu, refusé (`ambiguiteDe`, R232 (4)) : il faut écrire la clé.
- La casse tapée est gardée (R233 (10), `texteEcrit`) : `{{ic}}` → `{{instant-cast|ic}}`, `{{Action rapide}}` → `{{instant-cast|Action rapide}}`. La clé, une clé quittée ou le libellé écrit à l'identique montrent le libellé. La forme de R183 (2) (`{{cr}}` → `{{corruption|CR}}`) est abandonnée pour les nouvelles saisies ; les textes déjà en base ne changent pas.
- La base ne garde que des clés, sous la forme canonique de la colonne (`typeDeTexte`, `CHAMPS_DE_TEXTE` de `lib/edition-modele.mjs`, la seule liste des types de champ texte) :
  - texte mis en forme (pages, chronologie, panneaux) : `{{clé}}` (suit le libellé), `{{clé|texte}}` pour un autre texte, `{{clé:}}` ; une balise dans un code (`zonesDeCode`) reste telle quelle ;
  - texte de case (`ligne`, `texte`) : `{{clé|texte}}` toujours (il se lit sans le vocabulaire) ; le mode complet est refusé.
- Le service enregistre la forme canonique (`texteAvecMotsClesCanoniques`, avant les dérivations et le journal) ; il refuse une ref inconnue ou ambiguë, sauf si elle était déjà là, et le mode complet dans un texte de case.
- Une clé qui change réécrit toutes les balises qui la citent ; fusionner les recible ; supprimer n'en réécrit aucune, sauf en forçant (skill `zone-mots-cles-service`).
- Un emplacement `{N}` n'est jamais `{{N}}`.

## Rendu (middleware)
- Rendues dans les nœuds de texte, une bulle par mot-clé et par page. Jamais dans script, style, textarea, template, code, pre, kbd, samp, svg, math, ni sous `[data-mots-cles-bruts]` (`/donnees/`, aides, dialogues du mode modification, page Debug), ni dans leurs attributs. `EXCLUS` : même liste dans `mots-cles-vivants.mjs`.
- Un mot-clé à adresse est un lien `a.mot-cle`, son `url` préfixée de la base du site, sans `tabindex` ; sans adresse, `strong.mot-cle`. Dans `SANS_LIEN` (a, button, summary, label, select) ou une `.bulle` : le gras seul, sans bulle dans un bouton ou un résumé ; un `[tabindex]` garde le lien. Un mot-clé coloré porte sa classe sur sa balise, le bloc du mode complet et sa bulle (skill `zone-mots-cles-liens`).
- Le mot-clé rendu porte `data-mot-cle` = sa clé ; sa bulle a l'id `mot-cle-<clé>` (`idDeBulle`, réservé aux bulles : skill `ui-infobulles`).
- Texte simple dans `<title>`, `<option>` et les attributs de texte (sauf `data-balise`, `data-ed…`).
- Titre d'une bulle et nom du mode complet : `htmlDuNomDuMotCle`, le libellé seul (R233 (9)) suivi de son icône ; puis « Aussi appelé : … » (`htmlAussiAppele`, R233 (8)). L'icône suit aussi le texte d'une balise, sans s'y doubler quand il la montre déjà (`{{ricken-dor|RO}}`, R235 (3)). Texte d'une balise, mode complet et bulle montrent les monnaies en icônes (`htmlAvecMonnaies`, décomposition comprise : R63, R183 (9), (12)).
- Un JSON servi retire lui-même les balises (`texteSansBalises` : `regles.json`, index de recherche), `page_fts` aussi. Un découpage lit le texte sans balises ; un affichage morceau par morceau les garde (`avecLeursBalises`).

## Invariants
- `db:check` refuse une ref qui n'est pas une clé et une forme non canonique (`formesNonCanoniques`, sauf `{{clé|Libellé}}` dans un texte mis en forme) dans `textesDeLaBase` (hors sections 13 à 15, tables dérivées et traces : `lib/tables-de-la-base.mjs`), et une icône hors de `ICONES`.
- `db:check` recalcule chaque clé (`clesDesMotsCles` strict : aucun écart, aucun homonyme refusé), vérifie qu'une clé quittée n'est la clé courante d'aucun mot-clé, et contrôle chaque synonyme (`fautesDuSynonyme`, `libelle_cle` = `normalize`).
- Aucun script de page n'importe `mots-cles-balises.mjs` (il entraîne `text.mjs` et `monnaies.mjs`).
- Le sens d'une modification (R29, `lib/notes-de-version-sens.mjs`) se lit sans balises (`texteSansBalises`).

## Mots-clés dont le site se sert
- `MOTS_CLES_PROTEGES` (ceux qui rangent les pages, « Sort grenade » R114, « Sort fer » R164) identifie, ne refuse pas (le verrou refuse : R219 (2)) : Map id entier → ce que le site en fait, tirée de `RAISONS_DES_MOTS_CLES_PROTEGES` (par nom) et de `lib/mots-cles-proteges.mjs#IDS_DES_MOTS_CLES_PROTEGES` (nom → id de la 0113).
- Reconnus à leur id entier, jamais à leur libellé ni à leur clé (R195) : `nomDuProtege`, `idDuProtege`, `estProtege`. `race-hybride` n'a pas d'id tant qu'il n'existe pas : reconnu par sa clé ; créé, son id est à reporter dans les deux listes (JS et `maverick.py#MOTS_CLES_PROTEGES`, comparées par `mots-cles-python.test.mjs`).
- Une page porte leurs noms en `data.mots_cles`, posés par `lib/wiki.ts` (`pages-db.mjs#motsClesDesPages`), jamais dans le `.md`.

## Importeurs
- Le `tags:` d'un `.md` fabriqué écrit le libellé, ou la clé pour un homonyme (`pages-db.mjs#ecritureDuTag`, la règle de `maverick.py#vocabulaire_des_mots_cles`) ; `db:sync-pages` le relit par `maverick.py#trouver_mot_cle`, qui cherche dans l'ordre clé, libellé, synonyme, clé quittée, puis les écritures que le site de dev a fait quitter (`historique_modification`) ; celle d'un mot-clé supprimé n'est pas reposée. Une écriture ambiguë (homonymes) n'est pas posée et se signale (`mots_cles_poses`).
- Un protégé se pose par son id (`maverick.py#libelle_protege` : son libellé, ou sa clé s'il a des homonymes ; `codex.py` `Vocabulaire.protege`, `races.py`, `relations-races.py`).
- Un import ne crée jamais de mot-clé : une écriture inconnue n'est pas posée et se signale (skill `sources-codex`).
- Un import ne pose jamais un homonyme (`homonymes.py#MAGIES_HOMONYMES`) ni les étiquettes de `homonymes.py#ETIQUETTES_NON_POSEES` (R183 (11), R187 ; `importeurs-etiquettes.test.mjs`).

## Tests
- `mots-cles-balises`, `mots-cles-cles`, `mots-cles-vivants`, `mots-cles-python`, `mots-cles-r195`, `texte-en-place-mots-cles`, `importeurs-etiquettes`, `db-lexique-en-mots-cles` (R183), `db-0113-mots-cles-id-entier`, `db-0114-categories-assignees`, `db-0115-mots-cles-synonymes`, `db-0116-icone-des-mots-cles`, `pages-db` ; `codex.test.mjs` (R145, R183) couvre l'homonyme « sang ». Liens et couleurs : `mots-cles-liens-rendu`, `mots-cles-vivants-liens`.
- Les tests du vocabulaire créent leurs mots-clés d'essai, non verrouillés, ids 9001 et suivants (`test/aide-mots-cles.mjs#idDEssai`). Un mot-clé protégé se compare par son id entier, ou par sa `cle` pour `race-hybride` sans id (`idDuProtege`), jamais par son libellé.
