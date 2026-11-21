---
name: zone-mise-a-jour-paquet
description: "Mise à jour par paquet : serveur/paquet.mjs, paquets-de-la-production.mjs, activation.mjs, scripts mise-a-jour-{github,paquet,regles,simulation}.mjs, workflows mise-a-jour.yml et livraison.yml, interrupteur tools/flux-git/bascule-2*, refus et identité du paquet, paquets gardés. À charger avant de lire, modifier ou relire ces fichiers ou leurs tests. La page : `zone-mise-a-jour`."
paths: ["client/serveur/paquet.mjs", "client/serveur/paquets-de-la-production.mjs", "client/serveur/activation.mjs", "client/scripts/mise-a-jour-{github,paquet,regles,simulation}.mjs", ".github/workflows/{mise-a-jour,livraison}.yml", "tools/flux-git/bascule-2*", "client/test/serveur-paquet*.test.mjs", "client/test/mise-a-jour-{github,paquet,paquet-exemples,regles,simulation,identite}.test.mjs", "client/test/flux-git-bascule-2.test.mjs", "client/test/serveur-activation.test.mjs", "client/test/serveur-bascule-2.test.mjs", "client/test/scripts-controler-le-contenu-ecrit-paquet.test.mjs"]
user-invocable: false
---
# Mise à jour : le paquet, le workflow, la bascule 2

La page et les notes de version : skill `zone-mise-a-jour`. Procédure et retour arrière de la bascule 2 : `docs/chantier-base-de-dev.md`, section 16.

## À lire
- `docs/serveur.md`, « Mise à jour depuis la base source » et « Bascule 2 : préparation » ; `docs/flux-git.md`, « Ce que GitHub publie avec la bascule 2 » et « Gel des fusions pendant une mise à jour ».

## Circuit actif : paquet et copie (base source, `db/source`)
Le site de dev porte le marqueur (skill `zone-service`) : toute mise à jour, simulation ou copie passe par un paquet. Sa base n'est jamais refaite. `data/rows` n'est tenu à jour que par ce circuit, et la CI le lit (R278).
- « Effectuer la mise à jour », la Simulation et « Copier vers le dépôt » figent un **paquet** : `fabriquerPaquet` à partir de `fabriquerExtrait` (skill `zone-service-extrait`), servi octet pour octet à `GET /api/mise-a-jour/lots/<lot>/`, ouvert sans clé comme le lot figé. La base source n'est pas écrite.
- Refus avant l'envoi (409 `refus`, que des nombres, jamais un nom de fiche) : attestation de la production absente ou périmée. Un élément retiré que des fiches citent ne fait pas refuser (R280) : la production adapte la fiche et le note (R42 et suites), sauf une race, une classe ou une magie, dont la production garde sa base d'avant (R292).
- **Sous `db/bascule-2`, trois refus de plus** (mise à jour et simulation, pas la copie) : `code_pas_a_jour` (la version qui tourne n'est pas la dernière livraison de test publiée), `code_inconnu` avec sa `cause` (`jeton`, `injoignable`, `aucune_livraison`, `version_illisible`, `version_en_avance`) et `contenu` (`controlerLeContenu` sur le paquet fini : 20 problèmes nommés au plus, `total` exact). Sans le marqueur, ils n'existent pas.
- **Fiche d'identité du paquet** (toujours écrite) : `commit_du_code`, `empreinte_du_code`, `empreintes` (JSON par table) ajoutées à `paquet_meta` ; format `maverick-paquet/1` inchangé. `controlerLActivation` (garde-fou 17, pur) : `kit_sans_paquet`, `empreinte`, `structure`, `note_manquante`, `version_en_arriere`.
- **Paquets gardés** : les 10 derniers livrés sous `db/archives/paquets-livres/<X.Y>-<lot>.db` (`garderLesPaquetsLivres`, actif sans interrupteur) ; ils survivent à l'élagage `PAQUETS_GARDES`.
- **Paquets déposés pour la production** (`paquets-de-la-production.mjs`) : seulement avec `db/bascule-2`, dans le dossier `/paquets` (jamais créé par le service ; sans réglage `/dev/null` en lecture seule), copie écrite à côté puis renommée, jamais écrasée ; la production s'en méfie (le dossier est atteint par le site de dev). `GET /api/mise-a-jour/` porte `activation_production` (rapport de l'activation lu avec `O_NOFOLLOW`, 16 Kio, liste blanche) avec le marqueur seulement.
- Job `preparer` : `scripts/mise-a-jour-paquet.mjs` recontrôle (codes 2 à 6) et tire `data/rows` du paquet ; la table `page` se juge page par page. Un paquet sans page d'exemple passe par une copie qui reçoit `data/pages-d-exemple.sql` (`paquetAvecLesExemples`, dans `mise-a-jour-github.mjs`). Les lignes d'exemple restent dans `data/rows`.
- Job `livrer` : liste blanche = `tables_de_contenu` du paquet (plus les notes) ; il réexporte par `python3 -I tools/db/exporter.py` et compare les **empreintes d'octets** ; ni npm ni `node_modules`. Les constantes recopiées dans `mise-a-jour-github.mjs` sont comparées par le test.
- Copie (`POST /api/mise-a-jour/copier/`, mot `COPIER VERS LE DEPOT`) : commit « Copie : » (jamais « Lot : »), fusion dans `dev` seulement, jamais l'étape master (`if: !inputs.copie`), aucune maintenance ; ses modifications restent en attente.
- Report (`reporterPaquet`) : idempotent, en une transaction, refusé sur une base plus ancienne que le paquet.

## Interrupteurs de GitHub (`tools/flux-git/bascule-2.json`)
- Deux clés indépendantes, allumées, lues sur `origin/dev` jamais dans la PR contrôlée : `actif` (kits seuls, `data/paquet.json`, règles du contenu écrit) et `gel_des_fusions` (job `gel-des-fusions` de `ci.yml`, **check requis** : R305, `docs/flux-git.md`, « Gel des fusions pendant une mise à jour »).
- Lecture unique de `actif` : `tools/flux-git/bascule-2-interrupteur.mjs`, **sans aucun import** (le script du job `livrer`, qui tourne avec des jetons, ne dépend que de modules sans import ; test `mise-a-jour-github`).
- `data/paquet.json` (identité du lot : `lot`, `version`, `empreinte`, `structure`, `commit_du_code`, `fabrique_le`, jamais de contenu) est écrit par `preparer` quand `actif`, en plus de la copie de `data/rows` ; `livrer` le recalcule et l'exige octet pour octet. Règles du contenu écrit (`controle-du-contenu-ecrit`) : `paquet-a-la-main` (ne change que dans un commit du workflow) et `correctif-urgent` (refuse `data/paquet.json` dans un `hotfix/*`). Sans `actif` (retour arrière), elles n'existent pas.
- `livraison.yml` : `bascule-2.mjs decider` ; sans `actif`, tout est comme avant, test comme production.

## Workflow (`.github/workflows/mise-a-jour.yml`)
- `scripts/mise-a-jour-github.mjs#CHECKS_REQUIS` = les checks requis de `.github/rulesets/` : `client`, `character-service`, `regles-de-branches`, `controle-des-migrations`, `controle-du-contenu-ecrit` (R282), `gel-des-fusions` (R305 ; vert d'office pour les fusions du workflow). Un check requis de plus entre aux trois endroits.
- `[V: X+1]` n'est jamais repris d'un texte (`neutraliserMarqueur`) ; posé seulement dans le titre de la PR de livraison d'un lot `majeure` (`titreLivraison`, `versionDeLivraison(…, { majeure })`) ; la livraison s'arrête si la PR et le lot ne s'accordent pas (`desaccordMajeure`).
- `preparer` lance `npm test` après avoir écrit la note ; le job CI `simulation-de-mise-a-jour` applique un lot synthétique (`scripts/mise-a-jour-simulation.mjs`) puis les mêmes `CONTROLES`. Seul le lot du lancement actuel est servi (`lireLot`, sinon `410`) ; un suivi en retard n'écrase jamais un état plus récent. « terminé » se pose au succès du run.
- `mise-a-jour-regles.mjs` (lot figé, sans marqueur) refuse d'écrire un fichier de `data/rows` hors des tables du journal et de la note (`TABLES_DE_LA_NOTE`, `tablesCompletees`) ; l'historique écrit reprend la nature et la décision du lot (R275) et `verifierLot` refuse une nature inconnue (`natureDuLot`, code 2) ; `scripts/mise-a-jour-github.mjs#tablesDuLot` recopie la règle de `tablesCompletees` (skill `zone-edition-rejeu`).

## Tests
- `serveur-paquet`, `serveur-paquets-livres`, `serveur-paquets-de-la-production`, `serveur-bascule-2`, `serveur-activation`, `mise-a-jour-paquet`, `mise-a-jour-paquet-exemples`, `mise-a-jour-identite`, `mise-a-jour-github`, `mise-a-jour-regles`, `mise-a-jour-simulation`, `flux-git-bascule-2` (cas éteint), `scripts-controler-le-contenu-ecrit-paquet`.
