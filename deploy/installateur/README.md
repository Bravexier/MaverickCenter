# Installateurs : serveur normal et serveur de test

La solution est hébergée et installée par des **installateurs** : un script `.sh` autonome par fusion, qui contient le site et l'installe dans le
dossier d'une instance, sans téléchargement ni jeton. Ils sont publiés en *release* GitHub (publique comme le dépôt) par
`.github/workflows/livraison.yml` ; voir [`docs/flux-git.md`](../../docs/flux-git.md). Le serveur des deux instances se met en place pas à pas avec
[`../vps/README.md`](../vps/README.md) ; le paquet du NAS a sa propre installation ([`../README.md`](../README.md)).

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

Prérequis sur l'hôte : un hôte Docker (Linux), `sh`, `tar`, `gzip`, et `sha256sum` (ou `shasum` / `openssl`) pour contrôler l'archive ;
`rsync` et `sqlite3` sont utilisés s'ils sont présents (`sqlite3` rend la copie de la base cohérente même pendant une écriture).

| | Serveur normal (production) | Serveur de test |
| --- | --- | --- |
| Installateur | `maverick-center-VX.Y-install.sh` (fusion dans `master` ; `VX.Y-hotfix.N` après un hotfix) | `maverick-center-VX.Y.Z-install.sh` (fusion dans `dev` : la version complète de `dev`, sans suffixe) |
| Dossier conseillé | `/srv/maverick-center` | `/srv/maverick-center-test` (à côté du serveur normal) |
| Adresse | `http://<hôte>:8080` | `http://<hôte>:8081`, bandeau « Serveur de dev » sur chaque page |
| Base vivante `db/` | jamais touchée par une installation | **jamais vidée ni remplacée par une installation** : la base du site de dev (ses saisies) n'existe nulle part ailleurs. `db/` vide, le service y crée sa base à partir des règles du site. La copie de celle du serveur normal, prise à cet instant, ne se fait que **sur demande** (`--copier-base-prod`) et **seulement si `db/` est vide** (hors `metriques/`) : sinon l'installateur refuse, avant d'écrire quoi que ce soit. Le réglage `MAVERICK_BASE_TEST=conservee` du `.env` n'a plus d'effet |

Une instance = un dossier : `site/` (remplacé à chaque installation, avec le code du service des personnages, `site/_serveur/`), `db/` (base vivante
du service : utilisateurs, fiches, et ce qu'ils font ; voir [`docs/serveur.md`](../../docs/serveur.md)), `docker-compose.yml` (deux conteneurs : nginx et le service),
`nginx.conf`, `sauvegarde/` (les scripts des sauvegardes automatiques : copie, envoi chiffré, essai de restauration, `installer.sh` ; remplacé à chaque installation, jamais deux versions ; [`../vps/README.md`](../vps/README.md), « Sauvegardes »), `acces/` (`acces.sh`, la commande du mot de passe du site de dev ; remplacée à chaque installation ; le réglage qu'elle écrit est `secrets/acces.json`, que l'installateur ne touche jamais ; [`../vps/README.md`](../vps/README.md), « 7. Site de dev »), `installateur-courant/` (le dernier installateur installé par `mise-a-jour.sh`, un seul fichier, joint à la copie extérieure de nuit ; l'installateur n'y touche pas), `.env` (port et nom du conteneur, créé une fois, jamais écrasé), `.htpasswd` (mots de passe, jamais touché), `VERSION` (ce qui est
installé), `installation.log`, et `maintenance/` (créé par Docker : l'annonce « Maintenance en cours » pendant une mise à jour, que le site de dev écrit
et que chaque serveur lit ; le serveur de test prend celui du serveur normal avec `MAVERICK_DOSSIER_MAINTENANCE=<dossier du serveur normal>/maintenance`
dans son `.env` — `deploy/vps/instances.sh` le pose —, sinon la production n'est jamais mise en maintenance ; voir [`docs/serveur.md`](../../docs/serveur.md),
« Maintenance pendant une mise à jour »), et `metriques/` (créé par Docker : la base des métriques du service, `prod.db` ou `dev.db`, une par
instance, jamais mêlées ; le serveur de test y lit aussi celle du serveur normal quand son `.env` donne
`MAVERICK_DOSSIER_METRIQUES=<dossier du serveur normal>/metriques` — `deploy/vps/instances.sh` le pose dans les deux `.env` ; voir
[`docs/serveur.md`](../../docs/serveur.md), « Métriques et volume »). L'installateur ne touche jamais aux métriques : hors de `db/`, et un
`db/metriques/` (service sans dossier réglé) n'est ni copié de la production ni effacé du test. Les journaux des conteneurs (`docker logs`)
tournent : 5 fichiers de 10 Mo au plus par conteneur. Un installateur de test refuse un dossier de production et inversement.

## Installer une version

1. Téléchargez l'installateur depuis la *release* GitHub de la version et copiez-le sur l'hôte.
2. Lancez-le (en `root` ou avec un compte qui peut écrire dans le dossier) :
   ```bash
   sh maverick-center-V1.2-install.sh --dossier /srv/maverick-center                # serveur normal
   sh maverick-center-V1.2.3-install.sh --dossier /srv/maverick-center-test         # test : db/ n'est pas touché
   ```
   Options : `--verifier` (contrôle l'archive et s'arrête), `--copier-base-prod` (test : pose dans `db/` une copie de la base du serveur normal ;
   refusé si `db/` n'est pas vide : arrêtez d'abord le service, sinon il recrée sa base et la copie est refusée), `--dossier-prod <dossier>` (avec `--copier-base-prod` : serveur normal ailleurs que dans le dossier voisin
   `maverick-center`). `--sans-base-prod` est accepté et sans effet.
3. **Première installation d'une instance** : créez le fichier de mots de passe, puis lancez le conteneur (l'installateur le rappelle) :
   ```bash
   cd /srv/maverick-center
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd    # une ligne par compte (>> pour ajouter)
   docker compose up -d
   ```

Ordre conseillé la première fois : le serveur normal, puis le serveur de test (base vide, sauf `--copier-base-prod`). Les mises à jour suivantes n'ont besoin que de
l'étape 2 : nginx relit les fichiers, et le service se relance seul quand la livraison apporte une nouvelle version de son code (il refait aussi sa
base quand les règles changent, sans perdre les fiches). Port ou nom du conteneur : à changer dans `.env`, puis `docker compose up -d`.

`docker-compose.yml` et `nginx.conf` : une livraison qui les change les remplace si vous ne les avez pas modifiés (l'installateur garde la version
livrée précédente dans `.livre/` pour le savoir) et vous demande `docker compose up -d` ; si vous les avez modifiés sur place, ils sont conservés et
la nouvelle version est écrite à côté (`.nouveau`), à reporter à la main.

**Revenir à une version précédente** : créez d'abord un fichier `GELER` dans le dossier de l'instance (sinon la mise à jour automatique réinstalle la
dernière livraison dans les 5 minutes), puis relancez l'installateur de la version voulue. Supprimez `GELER` une fois une livraison corrigée publiée.

**Revenir sous la migration 0045** (une version d'avant les gains de niveau en deux totaux, l'entraînement et la solidité des armes) : le service
d'avant ne relit pas la base des fiches refaite en 0045 (toute lecture de fiche échoue) et refuse de la reconstruire. Il faut lui remettre
l'archive faite à la reconstruction 0045, et **tout ce que la base a reçu depuis est perdu** : fiches créées, modifiées ou supprimées, gains de
niveau, entraînement et solidité des armes saisis (et, sur le serveur de test, les modifications des règles en attente). Dans le dossier de
l'instance :

1. `touch GELER`, puis sauvegardez la base en place, hors de `db/` : `sqlite3 db/vivante.db ".backup /root/vivante-avant-retour.db"`.
2. Trouvez l'archive, la plus récente de `db/archives/` qui a encore la table `personnage_progression`, et **copiez-la à part tout de suite** :
   seules les 5 dernières archives sont gardées (`ARCHIVES_GARDEES` : au-delà, chaque reconstruction efface la plus ancienne).
   ```bash
   for f in db/archives/vivante-*.db; do sqlite3 "$f" ".tables personnage_progression" | grep -q . && echo "$f"; done | tail -1
   cp db/archives/vivante-AAAA-MM-JJT….db /root/vivante-avant-0045.db     # le fichier affiché par la ligne précédente
   ```
   Aucune archive de ce genre : soit la base n'avait ni fiche ni modification en attente à la reconstruction 0045 (à l'étape 4, supprimez alors
   aussi `db/vivante.db` au lieu d'y copier l'archive : le service en refait une vide), soit elle a déjà été effacée, et les fiches d'avant 0045
   ne se retrouvent plus que dans une sauvegarde faite à la main.
3. `docker compose stop serveur`, puis lancez l'installateur de la version voulue.
4. Remettez l'archive à la place de la base, sans ses fichiers voisins ni `vivante.json` (sans lui, le service refait la base pour les règles
   installées, en reprenant les fiches de l'archive) :
   ```bash
   cp /root/vivante-avant-0045.db db/vivante.db
   rm -f db/vivante.db-wal db/vivante.db-shm db/vivante.db-journal db/vivante.json
   ```
5. `docker compose start serveur`, puis vérifiez `/api/etat` (base refaite, sans erreur).

**Revenir sous la migration 0055** (une version d'avant l'armure complète de la fiche et la solidité de ses parties, décision R95) : la même
procédure, pour la même raison (le service d'avant ne relit pas la base refaite en 0055 et refuse de la reconstruire). L'archive à remettre est la
plus récente de `db/archives/` qui a encore la table `personnage_armure` (à l'étape 2, `".tables personnage_armure"` au lieu de
`".tables personnage_progression"` ; copiée par exemple en `/root/vivante-avant-0055.db`), et l'armure et la solidité des parties saisies depuis
sont perdues avec le reste. Revenir sous 0045 depuis une version d'après 0055 : l'archive de 0045 (elle a les deux tables).

## Mise à jour automatique

`mise-a-jour.sh` (posé dans chaque instance par l'installateur) prend le dernier installateur publié pour le mode de l'instance (lu dans `VERSION`) et
l'exécute s'il n'est pas déjà installé. Connexions sortantes uniquement : aucun port à ouvrir. Il reconnaît les livraisons de son serveur à la
forme de leur étiquette : `VX.Y.Z` (trois nombres, la version de `dev`) pour le serveur de test, `VX.Y` pour le serveur normal.

**Le serveur de test refuse une livraison plus ancienne que celle installée** (`VX.Y.Z-rebuild.N` compte : V1.2.4-rebuild.1 est plus récente que V1.2.4) : il
écrit le refus dans `mise-a-jour.log` et sort avec le code 1, sans rien télécharger ni modifier, à chaque passage du minuteur tant que la situation dure.
Même étiquette : « À jour ». Pas de `VERSION` ni de ligne `tag=` : première installation, elle se fait. Une étiquette installée qui n'a pas la forme
d'une livraison de test est refusée aussi, avec son message. `sh mise-a-jour.sh --force` installe la livraison publiée malgré tout (retour en arrière
voulu) ; un fichier `GELER` suspend les mises à jour. Attention : un `--force` qui installerait un installateur de test publié avant cette règle (db/ jamais touché) recopierait la production sur `db/`, sauf si `MAVERICK_BASE_TEST=conservee` est posé dans le `.env` et `db/` rempli (c'est le cas du VPS, `deploy/vps/instances.sh`). Le serveur normal ne fait pas ce contrôle : sa livraison est celle que GitHub marque « latest ».

1. **Jeton GitHub** : *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*, *Repository access* :
   **Only select repositories → MaverickCenter**, *Permissions → Contents : Read-only*. Déposez-le dans chaque dossier d'instance, lisible par `root`
   uniquement (jamais dans une conversation, un fichier du dépôt ou un journal) :
   ```bash
   printf '%s' 'COLLEZ_LE_JETON_ICI' > .github-token && chmod 600 .github-token
   ```
2. **Essai à la main** : `sh mise-a-jour.sh` (journal dans `mise-a-jour.log` ; `--force` réinstalle même si c'est déjà la dernière livraison).
3. **Planifier toutes les 5 minutes**, une tâche par instance : `crontab -e` puis `*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh`
   (et `…/maverick-center-test/mise-a-jour.sh`).

Un fichier `GELER` dans le dossier de l'instance suspend ses mises à jour. Une installation automatique ne touche jamais à `db/` : le serveur de test
garde sa base.
Un jeton expiré, un problème réseau ou un installateur abîmé n'abîment rien : l'instance reste telle quelle et `mise-a-jour.log` indique l'erreur.

## Essai de la structure avant l'installation

Sur une instance déjà en service, l'installateur ne remplace pas le site avant que le **service en place** ait essayé les migrations de la livraison sur
une copie de sa base : il dépose une demande dans `db/essai-de-structure/` (c'est tout ce qu'il y écrit, et il retire sa demande ensuite), attend la
réponse du service, et la note dans `installation.log`. Le service est le seul à toucher la base.

- Pas de réponse (service arrêté, `MAVERICK_ESSAI_ACCUSE_S`, 20 s), délai dépassé (`MAVERICK_ESSAI_DELAI_S`, 120 s) ou essai refusé : l'installation
  continue, la ligne du journal le dit. Le détail d'un refus se lit sur la page Debug du site de dev et dans `db/essai-de-structure/dernier.json`.
- Un fichier `db/source` (le marqueur d'une base qui est la source de vérité de l'instance) change le refus : l'installation s'arrête avant d'avoir rien
  installé. Rien ne pose ce fichier à la main ; il n'est là que quand le changement de structure sur place est actif.
- Première installation et `--copier-base-prod` : aucun essai. Aucun geste sur le serveur, `docker-compose.yml` ne change. Détail : `docs/serveur.md`,
  « Essai avant installation ».

## Le kit de l'atelier (serveur de test seulement)

Chaque installateur **de test** emporte un kit : le code du site et ses `node_modules`, de quoi lancer `npm run build:depuis-contenu` sans réseau, sans `data/rows` ni
git (`docs/serveur.md`, « Fabriquer le site depuis un fichier de contenu »). L'installateur de production n'en porte pas : son script n'a pas la ligne qui le pose.

- **Fabrication** : `fabriquer.mjs --kit <racine du dépôt>` (mode test seulement, refusé en production ; `livraison.yml` le passe pour le serveur de test, après `npm ci`) ;
  la logique est dans `kit.mjs`. L'archive `atelier-kit.tar.gz` et son `kit.json` (format `maverick-kit/1` : version, commit, Node de `.nvmrc`, plateforme et libc des modules
  compilés, image Docker à employer, taille, nombre de fichiers, empreintes, ce que l'élagage a retiré) sont joints sous `atelier-kit/`.
- **Contenu** : `client/` avec ses `node_modules` (sans `dist/`, `.astro/`, `src/content/wiki/`, `test/`, `var/` ni ce que git ignore), `data/schema.sql`, `data/derive.sql`,
  `data/migrations/`, `sources/sources.json`, `sources/tipeee/bienvenue.json`, `.nvmrc`. Aucun contenu : un contrôle refuse tout kit qui porte `data/rows`, `sources/raw`, un
  fichier de base (`.db`, `.sqlite`), les pages fabriquées, l'historique git ou un lien qui sorte du kit.
- **Image** : les modules natifs sont ceux de la machine qui fabrique (Linux, glibc sur GitHub) ; l'atelier doit tourner sur l'image `kit.json#image` (`node:<.nvmrc>-bookworm-slim`),
  jamais sous Alpine. Les variantes natives d'une autre libc, plateforme ou architecture, d'après le `package.json` de chaque paquet (`os`, `cpu`, `libc`), ne sont pas emportées.
- **Pose** : `<instance>/atelier/kit/` (avec `kit.json`), hors de `site/` : jamais servi. L'installateur le décompresse dans un dossier provisoire voisin, puis remplace l'ancien par
  renommage ; un seul kit est gardé. Il vérifie d'abord la place libre (`df`) : deux fois la taille décompressée annoncée, plus 256 Mo. **Un manque de place ou un échec ne
  fait jamais échouer l'installation** : le site est posé, le journal (`installation.log`) dit que le kit manque, l'ancien kit reste.

## L'atelier du site de dev (serveur de test seulement)

L'installateur de test livre aussi les scripts de l'atelier (`deploy/installateur/atelier/`) : `installer.sh` à la racine de `<instance>/atelier/` (la commande courte du propriétaire) et `lancer.sh`, `lib.sh` dans `atelier/outils/`.
Seuls ces fichiers sont remplacés, par renommage ; les fichiers d'`outils/` qui ne sont plus livrés sont retirés ; le kit, le travail, la sortie, les rapports et les réglages de l'atelier ne sont jamais touchés. À chaque livraison,
l'installateur copie `kit.json` dans `atelier/rapports/` (le service y lit « le kit est posé ») et pose la marque `atelier/declencheur/marque` quand le kit posé est celui de la livraison. Rien ne consomme la marque tant que le propriétaire n'a pas
lancé `sudo sh /srv/maverick-center-test/atelier/installer.sh` (`deploy/vps/README.md`, « Atelier du site de dev ») ; ce geste pose les unités systemd, les réglages et, dans le dossier de l'instance de test seulement, un `docker-compose.override.yml` (le montage des rapports, en lecture seule) : l'installateur ne le livre, ne le pose ni ne l'efface jamais, et le `docker-compose.yml` livré, commun à la production, ne change pas. L'installateur de production n'en porte rien.
Détail et garde-fous : `docs/serveur.md`, « Atelier du site de dev ».

## Fabriquer un installateur à la main

`./deploy/installateur/fabriquer.sh prod` (ou `test`) construit le site sur votre machine (Node.js ≥ 22.12) et écrit l'installateur dans
`deploy/installateur/sortie/` (étiquette `vX.Y.Z-local`).

## Ce qui a été vérifié

Les installateurs sont fabriqués et exécutés par `client/test/installateur.test.mjs` (installation, mise à jour, copie d'une vraie base SQLite en cours
d'écriture, refus) et `mise-a-jour.sh` est testé contre un faux GitHub (`client/test/mise-a-jour.test.mjs`), avec et sans `rsync` et `sqlite3`.
