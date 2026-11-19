---
name: zone-bestiaire-extraction
description: "Extracteur du Bestiaire 2.0 (tools/bestiaire/extraire.mjs), registre capacites.json et corrections de l'import des cartes de monstre (CORRECTIONS, R155, R205, R209, R242). À charger avant de lire, modifier ou relire l'extracteur, son registre ou l'export du doc. La page et l'édition : skill `zone-bestiaire`."
paths: ["tools/bestiaire/**", "sources/raw/bestiaire-2-0.txt", "client/test/bestiaire-extraction.test.mjs", "client/test/db-r209-bestiaire.test.mjs"]
user-invocable: false
---
# Extraction du Bestiaire 2.0

Noyau (page, cartes, édition, capacités) : skill `zone-bestiaire`.

## Fichiers
- Extracteur : `tools/bestiaire/extraire.mjs` (`--bilan`, `--sql`), registre `tools/bestiaire/capacites.json`, export `bestiaire-2-0.txt` dans `sources/raw/` (ou dans le dossier de `MAVERICK_SOURCES_RAW` : `tools/sources/dossier-des-exports.mjs#dossierDesExports` ; `--source` l'emporte).
- Le découpage d'une carte (`client/src/lib/monstre-champs.mjs`) sert aussi à la page et au service : ne pas le dupliquer.
- Détail : `docs/bestiaire.md`, « La source et l'extraction ».

## Invariants
- Une valeur n'est typée que si son écriture est sans ambiguïté (sinon `NULL`, le texte fait foi ; ainsi les 6 cartes sans nombre : « ? », « ∞ », une valeur par EP). Une ligne de défense entière « N points d'armure / N résistance magique » est renommée « N armure physique / N armure magique » (R209 (5), 0106, `monstre-champs.mjs#LIGNE_DE_DEFENSE_ANCIENNE`, `ligneDeDefenseRenommee`) ; `defense` lit encore l'ancienne écriture.
- Momies et Hallebarde amochée (R209 (3), (4), 0106) : « Enragé » est une vulnérabilité des trois Momies, dont l'immunité est retirée (les neuf autres cartes l'écrivent en immunité, inchangées) ; la carte « CUIRASSE ABÎMÉ » prend le nom de son espèce, son identifiant `#carte:cuirasse-abime` reste figé.
- L'état s'écrit « Gel » (R205 (3), 0103) dans les rubriques et les capacités communes ; `monstre_defense` n'a plus de cible `gele`. L'adjectif (« piège gelé ») reste.
- L'extracteur ne corrige que (`CORRECTIONS`, ancrées sur la ligne entière, avant le classement de la rubrique) : les graphies déjà corrigées dans la base, les multiplicateurs de R155, l'état « Gel » de R205, les anciens noms de l'AP et de l'AM de R209, « dieu de la terre » de R266 (3) ; pour une seule espèce, `CORRECTIONS_D_ESPECE` (R209). Brouillons du doc non repris (R58, `TITRE_BROUILLON`). Test : `bestiaire-extraction.test.mjs`.
- Le registre `tools/bestiaire/capacites.json` range chaque écriture du doc sous sa capacité commune. Une écriture inconnue arrête l'extracteur. Une carte qui n'affiche pas le texte du doc a sa `decision`.
- Sorts cités (R242, migration 0117) : `monstre_capacite.sorts` porte les nouveaux noms des sorts renommés ; le texte d'un sort supprimé reste tel quel, son lien vidé ; la « Boule de foudre » de la Poupée fulgurante est liée à Boules plasmiques, son texte inchangé tant que MAJ-B3 est ouverte (`docs/sql/a-valider.md` §11). Toute écriture qui n'affiche plus le texte de sa source porte R242 dans `capacites.json` ou les `voulus` du registre du classeur ; épinglé par `db-0117-magies-v10-specialisations.test.mjs`.

## Tests
- `client/test/bestiaire-extraction.test.mjs` : rejoue l'extracteur sur l'export (lu par `dossierDesExports()`) et le compare à l'état d'import (`lignesDImport`, `lib/historique-site.mjs`). Ces tests restent des tests ordinaires (l'export vient de l'archive restaurée au jour J) ; la PR du jour J ne les retire que si le propriétaire retient la reco (e).
- `db-r209-bestiaire.test.mjs` (R209, 0106 ; sur l'état de la migration).
