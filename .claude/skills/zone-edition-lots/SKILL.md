---
name: zone-edition-lots
description: "Lots de changements du site de dev (R274, R275) : lib/lot-de-changements.mjs, serveur/edition-lots.mjs, appliquerUnLot, essai à blanc, verrous des décisions, numéros donnés, annulation d'un lot, « tout recalculer », contrôles du contenu. À charger avant de lire, modifier ou relire ce code. La page qui les montre : skill zone-mise-a-jour."
paths: ["client/src/lib/lot-de-changements.mjs", "client/serveur/edition-lots.mjs", "client/serveur/controles-du-contenu.mjs", "client/test/lot-de-changements*.test.mjs", "client/test/serveur-edition-lots*.test.mjs", "client/test/serveur-edition-numeros.test.mjs", "client/test/controles-du-contenu.test.mjs"]
user-invocable: false
---
# Lots de changements (site de dev)

## Fichiers
- `lib/lot-de-changements.mjs` : module pur, format `maverick-lot/1` ; livré avec le service (`serveur-livraison`).
- `serveur/edition-lots.mjs` (déposer, lister, lire, essayer, appliquer, refuser), `appliquerUnLot` de `serveur/edition.mjs`, `serveur/controles-du-contenu.mjs` (les contrôles de `db:check`).
- Le service d'édition, le journal et son rejeu : skills `zone-edition`, `zone-edition-rejeu`. La page qui montre les lots : skill `zone-mise-a-jour`.

## À lire
- `docs/serveur.md`, « Lots de changements (format) » et « Lots de changements (service) » : routes, essai à blanc, application, verrous, numéros, annulation, « tout recalculer ». Plan : `docs/chantier-base-de-dev.md`.

## Choix du propriétaire
- R274 : la base du site de dev est la source de vérité.
- R275 (question 4 a) : « Chaque lot attend votre clic sur le site de dev, avec un aperçu avant et après. » Un lot n'écrit jamais le contenu d'office, « tout recalculer » compris.

## Invariants
- `controlerLeLot` reçoit la structure de la base en paramètre ; `comparerAvecLaBase` rend pour chaque opération `applicable` ou `changee` (la valeur a bougé : elle n'est pas écrite, le site prime).
- Un lot ne porte jamais la nature `saisie` (liste des natures : skill `base-sqlite-migrations`, migration 0127). Il refuse les tables de trace (`note_version`, `note_version_ligne`, `historique_modification`) et, tant que `LOT_OUVERT_AUX_TABLES_HORS_EDITION` vaut `false` (ouverture avec l'accord du propriétaire), toute table hors `tablesDeLEdition()` (lue dans `edition-modele.mjs`, jamais recopiée). Sur une table connue de l'édition, toute colonne passe : le plan vise « toute colonne que le site ne sait pas écrire ».
- `edition.mjs#appliquerUnLot` ouvre le même `BEGIN IMMEDIATE` qu'`enregistrer` (choix des fiches, notes R42, nature et décision du lot du journal). La voie générique `OPERATIONS_DU_LOT` (`ecrire_modifier`, `ecrire_inserer`, `ecrire_supprimer`) n'est jamais dans `OPERATIONS` ni jointe par une route (une opération inconnue y reste refusée). Une colonne que le service connaît (`TABLES`) s'écrit par son opération ; la voie générique ne sert que pour les autres. L'insertion est refusée dans une table que le service crée lui-même (`ENTITES`), la suppression d'une entité sans suppression aussi (R159).
- Essai à blanc sur une copie `VACUUM INTO`, supprimée ensuite : `db:check` (`controlerLeContenu`) avant et après, seuls les problèmes nés du lot comptent ; l'application rejoue ces contrôles dans la transaction.
- Une valeur changée entre-temps n'est pas écrite (le site prime) et est listée. Si tout a changé, le lot reste proposé : pas de `modification_lot` vide.
- Verrous : un refus du service qui cite un `R…` et que `gel` lève est « verrouillée » ; il ne s'applique que si le numéro est dans `verrous_ouverts` au clic (aujourd'hui R218, R219, R232 (2)). `COLONNES_TENUES_PAR_LE_SERVICE` (`mot_cle.verrou`, `cle`, `monnaie_id`) refuse la voie générique sous le même gel.
- Numéros : `donnerUnNumero` (`edition-journal.mjs`, avec `plusHautNumero` et `monterLePlafond`), une seule règle pour les lots (jeton `{"$numero": …}`) et l'édition des mots-clés (`idSuivant`, skill `zone-mots-cles-service`) : 1 + max(plafond de `numero_donne`, MAX de la colonne, journal, historique), plafond monté dans la même transaction ; jamais redonné. Pour `mot_cle` : aussi `mot_cle_ancienne_cle` et le registre 0113. Le rejeu d'un ancien journal calcule sans réserver (`monter: false`).
- Annulation (`annulerLeLot` ; `lib/lot-de-changements.mjs#effetNetDuLot`, `jugerLAnnulation`) : le lot du journal est ramené à son effet net ; une valeur n'est remise que si elle vaut encore ce que le lot a écrit (sinon gardée et listée : le site prime). Une insertion n'est supprimée que si elle est intacte ; une suppression est réinsérée à l'identique (`ecrire_inserer` avec `restaurer`, colonnes tenues par le service comprises) seulement si la ligne est absente. Aperçu `GET …/annulation/` sur une copie (Worker), rien n'est écrit ; clic `POST …/annuler/` sous le même `BEGIN IMMEDIATE`, contrôles rejoués. Le journal d'annulation a la nature et la décision du lot ; le résumé est dans `bilan.annulation`. Rien à remettre : 409, le lot reste appliqué. Une annulation ne rend jamais un numéro. Une annulation que refusent les contrôles du contenu (anciens textes fautifs) reste refusée (choix du `leader-technique`).
- Tout recalculer : `recalculerTout` (`POST /api/edition/lots/recalcul/`) dépose un lot de nature `code`. Périmètre : `TYPES_DE_PAGES_RECALCULEES` (races, classes, fiches de dons, métiers). `traduire` envoie une colonne dérivée d'une page typée par la voie générique du journal.
- Accès : déposer et refaire l'essai demandent la clé ou le mot de passe, appliquer, refuser et annuler le mot de passe (R275 ; skill `zone-service`) ; en production, 403.

## Tests
- `lot-de-changements` (module pur), `lot-de-changements-numeros`, `lot-de-changements-annulation`, `serveur-edition-lots`, `serveur-edition-lots-annulation`, `serveur-edition-numeros`, `controles-du-contenu`. Nature et décision d'un lot du journal : `serveur-edition-nature-des-traces` (skill `zone-edition-rejeu`).
