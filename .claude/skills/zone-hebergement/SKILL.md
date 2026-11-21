---
name: zone-hebergement
description: "Hébergement deploy/ : installateurs prod/test, VPS (durcir, outils, instances, Caddyfile), paquet NAS, nginx.conf, docker-compose.yml, sauvegardes, accès au site de dev (acces.sh), bascule.sh, fins de ligne LF. L'atelier et le kit : `zone-hebergement-atelier` ; l'activation de la bascule 2 : `zone-hebergement-activation`. À charger avant de lire, modifier ou relire deploy/ ou ses tests."
paths: ["deploy/{README.md,build.sh,docker-compose.yml,nginx.conf,update-site.sh}", "deploy/vps/**", "deploy/installateur/{README.md,docker-compose.yml,fabriquer.mjs,fabriquer.sh,installateur.sh,mise-a-jour.sh,bascule.sh,repetition-prod.sh}", "client/scripts/repetition-prod.mjs", "deploy/installateur/acces/**", "deploy/installateur/sauvegarde/**", "deploy/archivage-du-contenu/**", ".gitattributes", "client/test/deploy-vps.test.mjs", "client/test/deploy-volume.test.mjs", "client/test/installateur.test.mjs", "client/test/installateur-essai-de-structure.test.mjs", "client/test/installateur-base-source.test.mjs", "client/test/bascule.test.mjs", "client/test/repetition-prod.test.mjs", "client/test/mise-a-jour.test.mjs", "client/test/update-site.test.mjs", "client/test/serveur-livraison.test.mjs", "client/test/deploy-sauvegardes*.test.mjs", "client/test/deploy-acces.test.mjs", "client/test/deploy-archivage-du-contenu.test.mjs", "client/test/deploy-demenagement.test.mjs", "client/test/aide-sauvegardes.mjs"]
user-invocable: false
---
# Hébergement (`deploy/`)

## Fichiers
- Installateurs (le site en ligne) : `deploy/installateur/installateur.sh` (modèle), `fabriquer.mjs` → un installateur `.sh` autonome par livraison, mode prod (serveur normal) ou test (ne copie plus le `db/` du serveur normal, sauf `--copier-base-prod` dans un `db/` vide) ; `mise-a-jour.sh` exécute le dernier du mode de l'instance ; `fabriquer.sh prod|test` à la main ; `docker-compose.yml`. Le mode test pose aussi `bascule.sh`, `repetition-prod.sh` et `repetition-bascule-2.sh` à la racine de l'instance (jamais en production) ; `gel.sh` est livré aux deux instances. Ces fichiers et `activer.sh` : skill `zone-hebergement-activation`.
- VPS des deux instances : `deploy/vps/durcir.sh`, `outils.sh`, `instances.sh`, `volume.sh`, `Caddyfile`, `README.md` pas à pas (dont « 7. Site de dev : mode modification et page Mise à jour » : `MAVERICK_EDITION`, `MAVERICK_ADRESSE_PUBLIQUE`, les deux jetons), déménagement du serveur (`demenagement.sh`, `controle-demenagement.sh`, `repetition-demenagement.sh`, procédure `DEMENAGEMENT.md`).
- Paquet du NAS (installation à la main) : nginx + service dans Docker ; `deploy/build.sh` (le zip), `deploy/update-site.sh` (installe la branche `site`, que la livraison ne reconstruit plus), `deploy/docker-compose.yml`, `deploy/README.md`. Une installation existante garde sa copie `update-nas.sh`.
- `deploy/nginx.conf` : commun au NAS et aux installateurs.
- Le service lui-même : skill `zone-service`. Maintenance et dossier partagé `maintenance/` : skill `zone-maintenance`. Métriques et `volume.sh` : skill `zone-debug-metriques`. Versions, releases et branche `site` : `docs/flux-git.md`.

## À lire
- `deploy/installateur/README.md` (instances, `db/`, mise à jour automatique), `deploy/vps/README.md` (mise en place du VPS), `deploy/README.md` (NAS).
- `docs/serveur.md`, « Hébergement » (conteneurs, variables d'environnement, surveillance, sortie sur Internet).

## Choix du propriétaire
- Les docs de l'hébergement décrivent le fonctionnement tel qu'il est, sans « à partir de la X » ni « avant la X » : ce qui ne sert plus se dit comme tel ou sort de la doc. `test/deploy-vps.test.mjs` le garde pour les README de `deploy/`, `docs/flux-git.md` et le README du dépôt.

## Invariants
- Les `.sh` et tout `deploy/` restent en LF (`.gitattributes` : `*.sh` et `deploy/**` en `eol=lf`) : ils partent tels quels sur un serveur Linux, même depuis un clone Windows.
- Deux conteneurs dans chaque `docker-compose.yml` (NAS et installateurs) : nginx et `serveur` (`node:22-alpine`, exécute `site/_serveur/serveur/index.mjs`, port 8787 sans port publié).
- `deploy/nginx.conf` transmet `/api/` (adresse résolue à chaque requête, `proxy_connect_timeout 5s` : nginx démarre sans le service, et `/api/` répond 502 s'il est arrêté) et répond 404 sur `/_serveur/` (code du service, jamais servi).
- Le service se relance seul quand `version.json` change (code 0, `restart: unless-stopped`). Seul un changement de `docker-compose.yml` ou de `nginx.conf` demande `docker compose up -d`.
- Aucune installation ne vide ni ne remplace `db/` (R274 : les saisies du site de dev sont introuvables ailleurs). Copie de la production sur demande seulement (`--copier-base-prod`), refusée si `db/` est rempli hors `metriques/` et `essai-de-structure/`. `MAVERICK_BASE_TEST=conservee` est sans effet.
- `mise-a-jour.sh` en mode test refuse une livraison plus ancienne que celle installée (comparaison X, Y, Z, rebuild) ; `--force` pour revenir en arrière ; `VERSION` absent = première installation. La production n'est pas concernée.
- Un installateur de test refuse un dossier de production et inversement. L'installateur ne touche jamais aux métriques.
- L'attestation de la production (`attestation-prod.json`) voyage par le dossier des métriques, déjà partagé entre les deux instances : aucun montage ni variable de plus dans `deploy/` (skill `zone-service-extrait`).
- Le kit de l'atelier et l'atelier : skill `zone-hebergement-atelier`. Bascule 2 allumée (`db/bascule-2`, `atelier/servir`, `activation-par-paquet`, `actif`, `gel_des_fusions`) : l'atelier fabrique et sert le site de dev, GitHub ne livre que des kits, la production les active elle-même (skill `zone-hebergement-activation`). L'installateur de production d'une livraison complète n'en porte rien : son script reste le modèle, octet pour octet. Retour arrière : `docs/chantier-base-de-dev.md`, section 16.
- `docker-compose.yml` monte `${MAVERICK_DOSSIER_PAQUETS:-/dev/null}:/paquets` en lecture seule par défaut : sans réglage, rien de réel n'est monté en production.
- `installation.log` tourne au-delà de 200 Ko (500 dernières lignes). `mise-a-jour.sh` garde les 3 derniers installateurs (`INSTALLATEURS_GARDES`) ; le refus code 3 d'un kit seul : skill `zone-hebergement-activation`.
- Journaux des conteneurs : pilote `json-file`, 5 fichiers de 10 Mo au plus par conteneur (`logging` de chaque service des deux `docker-compose.yml`).

## VPS
- `instances.sh` pose les dossiers et le `.env` de chaque instance : ports sur `127.0.0.1` (Docker contourne ufw : seul Caddy les atteint), `MAVERICK_BASE_TEST=conservee`, `MAVERICK_EDITION=1` et `MAVERICK_DOSSIER_MAINTENANCE` (le `maintenance/` du serveur normal) et `MAVERICK_DOSSIER_PRODUCTION` (le `site/` du serveur normal, monté en lecture seule sur `/production` par `docker-compose.yml` : référence de l'onglet « Mise à jour », skill `zone-mise-a-jour`) pour le test ; ce dossier ne doit jamais être le `site/` de l'instance elle-même (le service refuse la production), et le NAS n'a pas ce montage (`deploy/vps/README.md`, « 7. Site de dev ») ; mots de passe internes présentés par Caddy à la place des visiteurs.
- `Caddyfile` : `maverick-jdr.com` → 8080 (serveur normal, `master`), `dev.maverick-jdr.com` → 8081 (serveur de test, `dev`), `www.` → domaine principal.
- Accès pour le PoC (décision du propriétaire) : pas de mot de passe visible pour la lecture, adresse non référencée (`X-Robots-Tag`, `robots.txt`) ; ni la protection ni la non-indexation ne se désactivent sans son accord.
- `PREMIERE_VERSION_HEBERGEE` (`tools/flux-git/regles.mjs`, 0.2.0) : en dessous, `livrableDe` choisirait la branche `site` ; dev et master l'ont dépassée, seuls les installateurs sont publiés.

- Déménagement : `demenagement.sh deballer` n'écrase jamais une base non vide et ne démarre jamais un service sur un `db/` vide. Ordre : installateurs, `db/` vide, `deballer`, puis `docker compose up` seulement après le constat EGALITE de `controle-demenagement.sh comparer`.

## Sauvegardes automatiques (`deploy/installateur/sauvegarde/`)
- Les scripts de `sauvegarde/` se lancent par `bash`, jamais `sh`. Livrés dans `<instance>/sauvegarde/` (`lib.sh`, `copie.sh`, `envoi.sh`, `essai.sh`, `installer.sh`, `lanceur.sh`, `mots.txt`), remplacés à chaque installation (un fichier qui n'est plus livré est retiré). `installateur-courant/` n'est jamais touché par l'installateur.
- Trois minuteurs systemd (horaire, nuit, essai mensuel) les exécutent en root par le lanceur stable `/usr/local/lib/maverick-center/maverick-sauvegarde-lanceur.sh`, qui prend les scripts du site de dev, sinon ceux de la production, et refuse des scripts modifiables par un autre que root.
- Copies dans `/srv/maverick-sauvegardes`, accès et clé dans `/etc/maverick-sauvegardes` (700/600), hors des dossiers d'instance. `volume.sh` compte `/srv/maverick-sauvegardes` dans « installations ».
- Le geste unique du propriétaire, relançable : `sudo bash /srv/maverick-center-test/sauvegarde/installer.sh` (options `--stockage`, `--verifier-le-stockage`, `--afficher-la-cle`, `--essai`, `--sans-stockage`, `--retirer`).
- La copie ouvre chaque base en lecture seule : rien n'est créé dans `db/` (`copie.sh#source_a_ouvrir`), sauf un `-wal` laissé sans `-shm` après un arrêt brutal.
- `lib.sh` écrit `sauvegardes.json` là où chaque conteneur le lit : son dossier des métriques d'après `docker inspect`, puis `MAVERICK_DOSSIER_METRIQUES`, sinon `<db>/metriques`. `envoi.sh` avec `MAVERICK_SAUV_NOMMEE=<nom>` envoie la copie nommée (étiquette `nommees`, gardée sans limite).
- Chaque instance est copiée dans son propre processus (`MAVERICK_SAUV_ENFANT=1`) : l'échec de l'une n'empêche jamais l'autre. Aucun message ne répète un secret saisi (`installer.sh#valide_secret`).
- Aucun secret dans le dépôt, un journal, l'état ou la page Debug ; le dépôt est public : seulement `https://s3.exemple.invalid` et `bucket-exemple`. Outil : restic (apt) ; en 0.16.4, `--keep-monthly unlimited`, pas `-1`.
- Choix du propriétaire (R275, R308) : copie extérieure chiffrée, fiches comprises, chez OVH comme le serveur mais sur un autre site, dont il garde la clé ; rétention de 30 jours, plus une copie par mois et une par version sans limite ; envoi chaque nuit ; clé = phrase de 6 mots, réaffichable ; changer de stockage ou d'hébergeur ne demande que la phrase et les accès.

## Archivage du contenu (`deploy/archivage-du-contenu/`, R296)
- `archiver.sh`, `verifier.sh`, `README.md` : éteints, `archiver.sh` refuse (code 2) sans `--jour-j` ; non livrés par l'installateur. Procédure : `docs/chantier-base-de-dev.md`, « Le jour J du lot 12 ».
- Ils lisent un commit (`git archive`, `git ls-tree`), jamais l'arbre de travail. Un manifeste sha256 par archive ; une destination déjà archivée n'est pas réécrite.
- Les publications ne se lisent que par `gh api` en GET (jeton `GH_TOKEN`, jamais en argument).
- Destination `--vers` : dossier existant hors de tout dépôt, donné à chaque appel, sans défaut (`/srv/maverick-archives/…`). La sauvegarde automatique ne l'emporte pas : le geste du jour J est un instantané restic `--tag archives-du-contenu`.

## Accès au site de dev (`deploy/installateur/acces/`, R275)
- `acces.sh` est livré dans `<instance>/acces/` comme `sauvegarde/` (`DOSSIERS_DE_SCRIPTS`, remplacé à chaque installation). Geste du propriétaire : `sudo sh /srv/maverick-center-test/acces/acces.sh` (options `--cle`, `--cle-de-depot`, `--sans-cle-de-depot`, `--portee ecriture|tout`, `--etat` qui dit « Clé de dépôt : oui/non », `--retirer`). Il refuse la production et pose `secrets/acces.json` en 600. Le mot de passe n'est jamais un argument de commande ni un fichier. Détail : `docs/serveur.md`, « Accès au site de dev ».
- Option c (un mot de passe pour tout le site) : le snippet `forward_auth` du `Caddyfile` reste en commentaire.

## Essai de structure et contrôle des migrations (R274, R275)
- `ci.yml` a un job `controle-des-migrations` : checkout `fetch-depth: 0`, sans `npm ci`, parallèle, hors du job `client` dont les commandes sont épinglées. Vers `master`, il ne contrôle que les règles (`--sans-essai`). Règles : `docs/flux-git.md`, « Règles des migrations ». Toute nouvelle commande du job `client` entre aussi dans `scripts/mise-a-jour-github.mjs#CONTROLES`.
- L'installateur n'écrit que sa demande dans `db/essai-de-structure/` et n'a jamais de `rm` ailleurs dans `db/`. Délais : 20 s pour l'accusé, 120 s pour le résultat.
- Ce dossier ne compte pas pour un `db/` rempli, et n'est copié ni de la production ni par les sauvegardes (`copie.sh`, `lib.sh`).
- Le site de dev porte `db/source` (base source, skill `zone-service`) : l'installateur y refuse `--copier-base-prod` et une publication plus ancienne que la `version=` de `VERSION`, avant toute écriture, et un refus de l'essai arrête l'installation avant tout dépôt. La production n'a pas de marqueur : son installation continue toujours.

## Bascule : `bascule.sh` et `repetition-prod.sh` (`deploy/installateur/README.md`, `docs/serveur.md`)
- Rien hors `bascule.sh` ne pose ni ne retire `db/source` (`etat`, `geler`, `degeler`, `constat`, `sauvegarder`, `poser`, `retirer`, `copies`, `restaurer`, `poser-bascule-2`, `retirer-bascule-2`) ; il est lancé par le propriétaire, en root, par `bash`, et n'existe que sur l'instance de test.
- Restauration du site de dev, en trois temps (`docs/serveur.md`, « Restauration de la base du site de dev ») : `restaurer` remet une copie locale ou extérieure, sans jamais effacer la base qu'il remplace (renommée dans `<dev>/var/avant-restauration-<date>/`) ; le service applique seul les migrations et le report des paquets livrés (refusé si la copie est plus ancienne que le paquet) ; rien ne rejoue les lots écrits depuis la copie.
- `poser` exige un constat `EGALITE` récent et une sauvegarde nommée réussie.
- Un installateur de test antérieur à V0.4.99 ne se relance jamais (il recopie la base de la production) ; R282 les retire de GitHub.
- `repetition-prod.sh` joue la mise à jour de la production sur une copie, sans toucher à la production ; il n'écrit que des comptes.
- Jobs CI `controle-des-migrations` et `controle-du-contenu-ecrit` (`docs/flux-git.md`, « Contenu écrit à la main ») : checks requis (R282 ; `.github/rulesets/`, `CHECKS_REQUIS` : skill `zone-mise-a-jour`). L'interrupteur `tools/flux-git/bascule-1.json` est allumé (`actif: true`) ; il se lit sur `origin/dev`, jamais dans la PR contrôlée, et ne repasse à `false` qu'avec un retour arrière.

## Tests
- `bascule` (dont `poser-bascule-2`), `installateur-base-source`, `repetition-prod` (et `bascule-constat` : skill `zone-service-extrait`) ; `deploy-sauvegardes-metriques` (`sauvegardes.json` là où lit chaque conteneur). Bascule 2 : skill `zone-hebergement-activation`.
- `deploy-acces`, `deploy-archivage-du-contenu` (extinction sans `--jour-j`, GET seulement), `deploy-demenagement`, `deploy-sauvegardes`, `deploy-sauvegardes-installer` (scripts exécutés pour de bon dans un monde factice, `aide-sauvegardes.mjs`).
- `deploy-vps` (`instances.sh`, étape « Site de dev » du README), `deploy-volume` (rotation des journaux Docker, `volume.sh`), `installateur` (`db/` jamais vidé ni remplacé, métriques jamais copiées ni effacées), `installateur-essai-de-structure`, `mise-a-jour` (refus d'une livraison plus ancienne en mode test, R274), `update-site` (faux serveur GitHub), `serveur-livraison` (`docker-compose.yml` et `nginx.conf` cohérents).
