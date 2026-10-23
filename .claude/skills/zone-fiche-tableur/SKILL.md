---
name: zone-fiche-tableur
description: "Fiche en tableur de /fiche/ : Télécharger (.xlsx), Exporter (Google Sheets), Importer (PC) et (en ligne), modèle V15.2.2 ordinateur et fiche auto, case NOTE, lecture .xlsx/.ods/.csv. À charger avant de lire, modifier ou relire ce code ou ses tests."
paths: ["client/src/lib/fiche-tableur-*.mjs", "client/src/lib/tableur-*.mjs", "client/src/lib/zip.mjs", "client/src/lib/xml-mini.mjs", "client/src/lib/fiche-modele.mjs", "client/src/lib/google-sheets.mjs", "client/src/modeles/fiche-personnage/**", "client/src/pages/fiche/modele.xlsx.ts", "tools/fiche/modele.py", "client/test/fiche-tableur-*.test.mjs", "client/test/fiche-modele.test.mjs", "client/test/tableur-*.test.mjs", "client/test/google-sheets.test.mjs", "client/test/zip.test.mjs", "client/test/xml-mini.test.mjs", "docs/fiche-auto.md"]
user-invocable: false
---
# Fiche en tableur

## Fichiers
- Adresses des cases (modèle ordinateur et fiche auto), `cle()`, `MARQUEUR_DES_NOTES`, `REMPLISSAGE_DE_ATTEINT` : `client/src/lib/fiche-tableur-cases.mjs`.
- Export : `lib/fiche-tableur-export.mjs` (`cellulesDeLaFiche`, `nomDuFichier`, `etatDesExports`, `messageDExport`, `texteDuSortPrepare`, `lireSortPrepare`, `texteDesChoixDeMaitrise`, `lireChoixDeMaitrise`, `bonusDEntrainement`, les lecteurs des écritures de la page).
- Import : `lib/fiche-tableur-import.mjs` (`ficheDuClasseur`, `feuilleDeLaFiche`, `portraitDeLImport`, `messageDImport`, `nonRepris`, `gainsDesMaximums`, `bonusDuMetierEcrit`, `REMARQUE_MAITRISES_CSV`).
- Classeur : `lib/tableur-lecture.mjs`, `lib/tableur-ecriture.mjs` (`zonesDuClasseur` : la taille des cases du modèle), `lib/tableur-mesure.mjs` (chasses de Calibri et d'Arial), `lib/zip.mjs`, `lib/xml-mini.mjs`.
- Modèle : « Fiche-de-personnage-Maverick-V15.2.2 ordinateur », ses parties en texte dans `client/src/modeles/fiche-personnage/` (fabriquées par `tools/fiche/modele.py`), assemblées au build en `/fiche/modele.xlsx` (`lib/fiche-modele.mjs`, `pages/fiche/modele.xlsx.ts`).
- Google : `lib/google-sheets.mjs` (identifiant client, lien d'une feuille, envoi à l'API Drive). Import en ligne : `POST /api/classeur/` (`serveur/classeur.mjs`, skill `zone-service`).
- Branchement dans la page : `src/scripts/fiche.mjs` (`etatDesBoutons`) ; la page elle-même : skill `zone-fiche`.

## À lire
- `docs/character-generator.md`, « Tableur : export et import » : barre, modèle, export, écritures courtes, textes trop longs, lecture, import, messages, aller-retour, modules. Tout le détail des cases y est.
- `docs/fiche-auto.md` : la fiche auto V15.2.2, second modèle lu à l'import.
- `docs/serveur.md` pour `POST /api/classeur/` ; `deploy/vps/README.md`, « Export vers Google Sheets ».

## Choix du propriétaire
- Barre : Nouveau, Télécharger, Exporter, Importer (PC), Importer (en ligne), Supprimer. Plus de JSON ni d'« Imprimer » (demande du propriétaire).
- « Télécharger » : le .xlsx nommé d'après le personnage seul, grisé tant que la fiche n'est pas enregistrée telle qu'elle est (`etatDesExports`), sauf service muet ou dernier enregistrement refusé.
- « Exporter » : une nouvelle feuille Google Sheets dans le Drive de la personne ; identifiant client `SITE_GOOGLE_CLIENT_ID` au build (variable GitHub `GOOGLE_CLIENT_ID`), bouton grisé sans lui.
- « Importer (PC) » : un .xlsx (la lecture sait aussi .ods et .csv). « Importer (en ligne) » : une feuille partagée par lien, lue par le service.
- Export au modèle ordinateur, valeurs seules (aucune formule), portrait à la place du logo en A1.
- Ce qui n'a pas de case, et la suite de la part relue d'un texte trop long pour la sienne, va dans la case NOTE, en lignes « Clé : valeur » sous `MARQUEUR_DES_NOTES`.
- Import d'un .xlsx, .ods ou .csv au modèle ordinateur ou de la fiche auto V15.2.2 : l'onglet « Personnage » ou le premier qui suit un des deux modèles ; ce qui n'a pas de place est ajouté aux notes.
- Dialogue « import-cible » (`#import-cible`) : mettre à jour le prétiré ouvert ou en créer un. Rien n'est enregistré avant « Enregistrer ».
- Paliers de résistance écrits : ceux de la base (R70). Métier à l'import : celui de la base (R72). Gains de niveau : deux totaux (R73). Solidité d'arme notée (R74).

## Invariants
- Parmi les scripts de page, seul `src/scripts/fiche.mjs` importe les modules du tableur (`zip`, `xml-mini`, `tableur-*`, `fiche-tableur-*`) et `lib/google-sheets.mjs` (testé). Un module partagé entre deux scripts de page casse la version portable (skill `site-version-portable`).
- Ces modules n'importent jamais `lib/text.mjs` : `cle()` de `fiche-tableur-cases.mjs` le remplace. `bonusDuMetierEcrit` (R72) est linéaire, sans `text.mjs` ni `metier-champs.mjs`.
- `lib/google-sheets.mjs` n'a aucun import (`test/google-sheets.test.mjs`).
- `fiche-modele.mjs` (`node:fs`, il importe `zip.mjs` pour assembler le modèle) sert au build et aux tests seulement.
- Aucun classeur binaire dans le dépôt : le modèle est en texte (fins de ligne LF).
- Le script de Google (`accounts.google.com/gsi/client`, `SCRIPT_GOOGLE`) est créé par `document.createElement` au survol ou au clic, jamais écrit dans la page (version portable).
- Le format de la case NOTE (clés, « Suite de la case A1 : … », « ⏎ ») est écrit par l'export et relu par l'import : l'un ne change pas sans l'autre. L'aller-retour du .xlsx le vérifie. Un seul jeu de lecteurs pour les écritures de la page, dans `fiche-tableur-export.mjs` (la fiche auto a les siens).
- La note ne porte que des données du personnage, jamais un texte de règles. Dans la note, c'est le dernier marqueur qui compte.
- L'export ne calcule que par les fonctions du moteur de la page, jamais une règle de plus. Une case que le site ne calcule pas reste vide.
- Un nom du classeur introuvable part dans les notes, jamais rapproché par vraisemblance. Rien ne se perd sans être dit (`nonRepris`, remarques).
- L'endroit où un texte est coupé dépend de la taille des cases du modèle et des chasses de Calibri et d'Arial (`tableur-mesure.mjs`). Seule la part relue d'un texte coupé a une suite dans la note ; une case affichée coupée perd sa fin sans rien dans la note.
- Ce que la fiche calcule n'est pas relu (sauf pour retrouver un choix que le classeur n'écrit pas, dit en remarque). AK15/AX15 de la fiche auto sont un calcul, jamais relues. L'AP et l'AM de la grille de l'armure et du bouclier sont calculés, non relus (R108).
- Maîtrises d'armes (R148, R152, R153) : les dés de la grille sont ceux du calcul (`maitrisesParFamille`, 5 au plus), jamais relus ; l'import les compare au calcul, et des dés écrits en trop (ou une arme choisie écrite avec une autre famille que la maîtrise au choix de sa classe) font une ligne de `nonRepris` au texte de la note datée de la base vivante (`lib/fiche-format.mjs#texteDesMaitrisesDAvant`). Un classeur d'avant la refonte (sans ligne « Maîtrise d'arme au choix ») : « Maîtrises d'armes avant la refonte : « … » », aucun choix posé ni déduit des dés ; la compétence d'une ancienne arme choisie reste un choix d'acquis (R152).

## Cases relues à connaître
- L42, entraînement (R104) : ses compétences « Nom points » jointes par « | », relues par `bonusDEntrainement` ; ses textes et les choix d'acquis des dons sont les lignes « Entraînement » et « Acquis au choix » de la note, la famille d'armes entre parenthèses (R119 ; calculée depuis R152 : la maîtrise au choix de la classe, pas relue) ; les choix d'une armure cassée y restent, lus comme à l'enregistrement (R157 : `acquisChoixGardes`) ; la ligne « Résistance au choix » (R124 ; une magie au choix ou tirée d'un don, « Anansi d'Arcane : Feu », R137 ; la magie tirée d'un don du Flagelleur d'un personnage du Potentiel Illimité, « Punis-moi ... (Flagelleur) : Feu », R163).
- Familles d'armes créées ou renommées sur le site de dev (R159) : la grille « Maîtrise d'armes » reste celle du modèle (11 familles fixes, `MAITRISES`) ; les dés d'une famille qu'elle n'a pas ne vont dans aucune ligne, jamais dans celle d'une autre, et l'export ajoute un avertissement (`avertissementDeFamilleHorsDeLaGrille`) quand elle en a au-delà du dé sans maîtrise ; son choix reste dans la note. L'import retrouve une famille par son nom, sinon son nom de lecture (`regles.familles_armes[].nom_lecture` : une fiche exportée avant un renommage ; `familleEcrite`, et l'accessoire par `retrouver`) ; « Arme Légère (<famille>) » lit la famille après la première parenthèse (un nom de famille peut en écrire ; seuls virgule et « : » sont refusés à la saisie). Test : `test/fiche-familles-creees.test.mjs`.
- Note « Maîtrise d'arme au choix : <source> : <famille>, <famille>, ? » (R148), une par source qui a un point choisi, avant les acquis au choix : le titre de la source comme sur la page (`sourcesDeMaitrise` : « Guerrier (maîtrise 2) », « Maître d'arme (Guerrier) »), le bandeau de chaque point dans l'ordre (le `rang` de `maitrise_choix`), « ? » pour un point à choisir. L'accessoire « Un point de maîtrise d'arme » garde sa famille dans sa case (« → ÉPÉES »).
- AK17/AX17 : solidité d'une arme « N / M » (R74).
- Note « Sort préparé : … (jet N, posture X) » (R115 : `texteDuSortPrepare`, `lireSortPrepare`).
- AQ21 : une ligne d'armure (R95, R165 : « <armure> · amél. niv. N », de base ou élémentaire, reconnue à son nom ; `lignesDArmure`) ; d'un classeur d'avant R95, une ligne par pièce, la première gardée ; d'un classeur d'avant R165 (« · élément <nom> · amél. élément niv. N ») ou de la fiche auto (l'élément par sa magie), une fiche d'avant qui porte les deux, sa solidité lue sur l'armure d'origine : la page la convertit par `sansPartiesRetirees` (l'élément devient l'armure, l'armure d'origine notée), puis `retraitsDeLArmureHorsListe`. AD22 toujours relue (de base ou élémentaire). AI24:AN24 : solidité « N / M » de chaque partie de l'armure.
- Note « Gains de niveau : santé X, chakra Y » ; l'ancien format par niveau est encore lu, sommé.
- Fiche auto : gains = maximums lus − le reste du calcul (`gainsDesMaximums`, R73) ; l'ancien bonus du métier écrit en L41 (`bonusDuMetierEcrit`, R72 ; un classeur du site garde le bonus de la base) est remplacé par celui de la base dans l'acquis écrit, comparé à l'acquis calculé (R104 : plus que le calcul, `nonRepris` ; moins, une remarque ; un choix d'acquis d'un don déduit quand une seule lecture l'explique).

## Tests
- `test/fiche-tableur-aller-retour.test.mjs` : aller-retour exact pour le .xlsx, et pour un .csv (les choix de maîtrise sont dans la note ; sans eux, une remarque dit que des dés d'avant ne se notent pas) ; une fiche des choix de maîtrise de chaque genre revient à l'identique ; les lignes de l'entraînement reviennent compétences d'abord, puis textes.
- `test/fiche-tableur-export.test.mjs`, `test/fiche-tableur-import.test.mjs`, `test/fiche-tableur-page.test.mjs` (ce que la page fait hors du DOM : onglet, portrait, messages, nom du fichier, état des boutons).
- `test/tableur-lecture.test.mjs`, `test/tableur-ecriture.test.mjs`, `test/tableur-mesure.test.mjs`, `test/google-sheets.test.mjs`, `test/serveur-classeur.test.mjs`.
- `test/zip.test.mjs` (archives ZIP du .xlsx et du .ods : aller-retour, refus de ce qui n'est pas sûr), `test/xml-mini.test.mjs` (parties XML : ce qu'écrivent Excel, LibreOffice et Google Sheets, refus, aller-retour sur le modèle).
