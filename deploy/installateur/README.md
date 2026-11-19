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
`nginx.conf`, `gel.sh` (le gel des écritures de l'instance, lancé en root : « Geler les écritures » plus bas), `sauvegarde/` (les scripts des sauvegardes automatiques : copie, envoi chiffré, essai de restauration, `installer.sh` ; remplacé à chaque installation, jamais deux versions ; [`../vps/README.md`](../vps/README.md), « Sauvegardes »), `acces/` (`acces.sh`, la commande du mot de passe du site de dev ; remplacée à chaque installation ; le réglage qu'elle écrit est `secrets/acces.json`, que l'installateur ne touche jamais ; [`../vps/README.md`](../vps/README.md), « 7. Site de dev »), `installateur-courant/` (le dernier installateur installé par `mise-a-jour.sh`, un seul fichier, joint à la copie extérieure de nuit ; l'installateur n'y touche pas), `.env` (port et nom du conteneur, créé une fois, jamais écrasé), `.htpasswd` (mots de passe, jamais touché), `VERSION` (ce qui est
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
Les **trois derniers installateurs installés** sont gardés dans `installateur-courant/` (`INSTALLATEURS_GARDES`, 3 par défaut ; le plus récent n'est jamais retiré) :
l'envoi chiffré de nuit les joint à la copie extérieure. Place : environ 97 Mo par installateur de test (kit compris) et 35 Mo par installateur de production complet ; un installateur de production « kit seul » pèse le kit, sans pages (à relever sur la première livraison).
Un jeton expiré, un problème réseau ou un installateur abîmé n'abîment rien : l'instance reste telle quelle et `mise-a-jour.log` indique l'erreur.

## Essai de la structure avant l'installation

Sur une instance déjà en service, l'installateur ne remplace pas le site avant que le **service en place** ait essayé les migrations de la livraison sur
une copie de sa base : il dépose une demande dans `db/essai-de-structure/` (c'est tout ce qu'il y écrit, et il retire sa demande ensuite), attend la
réponse du service, et la note dans `installation.log`. Le service est le seul à toucher la base.

- Pas de réponse (service arrêté, `MAVERICK_ESSAI_ACCUSE_S`, 20 s), délai dépassé (`MAVERICK_ESSAI_DELAI_S`, 120 s) ou essai refusé : l'installation
  continue, la ligne du journal le dit. Le détail d'un refus se lit sur la page Debug du site de dev et dans `db/essai-de-structure/dernier.json`.
- Un fichier `db/source` (le marqueur d'une base qui est la source de vérité de l'instance) change le refus : l'installation s'arrête avant d'avoir rien
  installé. Seul `bascule.sh` pose ce fichier (« La base source du site de dev », plus bas).
- Première installation et `--copier-base-prod` : aucun essai. Aucun geste sur le serveur, `docker-compose.yml` ne change. Détail : `docs/serveur.md`,
  « Essai avant installation ».

## La base source du site de dev (`db/source`, `bascule.sh`)

Le fichier `db/source` dit que la base du site de dev est la **source de vérité** : le service ne la refait plus jamais depuis les règles du site, applique
lui-même les changements de structure sur place (essai sur une copie, sauvegarde, puis application, avant d'accepter une écriture) et **ne démarre pas** si elle
manque (elle se restaure depuis une sauvegarde, jamais depuis le dépôt). Avec ce fichier, l'installateur refuse `--copier-base-prod` et toute publication
plus ancienne que celle installée (`version=` de `VERSION`), avant d'écrire quoi que ce soit, et s'arrête si le service refuse l'essai de la structure.
Sans lui, rien ne change. Détail : `docs/serveur.md`, « Base source (lot 8) ».

Seul `bascule.sh`, posé par l'installateur de test à la racine de l'instance, le pose ou le retire, en root, une étape à la fois (une ligne par action,
code 0 si l'étape a réussi) :

```bash
sudo bash /srv/maverick-center-test/bascule.sh etat         # où on en est
sudo bash /srv/maverick-center-test/bascule.sh geler        # GELER posé, service du site de dev arrêté : plus aucune écriture
sudo bash /srv/maverick-center-test/bascule.sh constat      # égalité production / site de dev / dépôt, table par table : EGALITE ou les tables qui diffèrent
sudo bash /srv/maverick-center-test/bascule.sh sauvegarder  # copie nommée bascule-1-<date> des deux bases, locale puis hors du serveur
sudo bash /srv/maverick-center-test/bascule.sh poser        # le marqueur, puis le service relancé ; vérifie « source: true »
sudo bash /srv/maverick-center-test/bascule.sh retirer      # retour arrière : marqueur renommé (rien n'est effacé), service relancé
sudo bash /srv/maverick-center-test/bascule.sh degeler      # sans poser : relance le service et retire GELER
```

`poser` refuse sans constat `EGALITE` de moins d'une heure fait pendant le gel en cours, et sans sauvegarde nommée réussie depuis ce constat ;
`sauvegarder` refuse tant que l'envoi hors du serveur n'est pas réglé (`sauvegarde/installer.sh --stockage`). Le constat tourne dans le conteneur du
service (l'hôte n'a pas besoin de Node) et lit la production par son attestation ; il ne montre que des noms de tables et des nombres de lignes.
`--dev <dossier>` et `--prod <dossier>` changent les dossiers (`/srv/maverick-center-test` et `/srv/maverick-center` par défaut). L'état des étapes est
gardé dans `.bascule/` de l'instance.

### Restaurer la base du site de dev

```bash
sudo bash /srv/maverick-center-test/bascule.sh copies                            # les copies locales (type/nom, date, lignes) et extérieures (restic)
sudo bash /srv/maverick-center-test/bascule.sh restaurer --copie derniere        # ou --copie horaire/<nom>, nuit/<nom>, nommees/<nom>
sudo bash /srv/maverick-center-test/bascule.sh restaurer --exterieure latest     # ou l'identifiant d'une copie extérieure (« copies »)
```

La copie est contrôlée d'abord (copie du site de dev, jamais de la production ; intégrité ; nombre de lignes de chaque table égal à celui noté à la copie) :
refusée, rien n'est touché. Puis `GELER` est
posé, le service arrêté, la base en place (`vivante.db`, `vivante.json`) **renommée** dans `var/avant-restauration-<date>/` de l'instance (jamais effacée),
la copie posée et le service relancé : avec `db/source`, il applique lui-même les migrations à la base restaurée (ou ne démarre pas, la raison au journal).
Ensuite, le report de la note d'un paquet livré se refait seul (refusé quand la copie est plus ancienne que le paquet : `client/serveur/paquet.mjs#reporterPaquet`), et ce que la copie n'a pas (les lots écrits depuis) reste dans la base gardée à part :
`docs/serveur.md`, « Restauration de la base du site de dev ».

## Geler les écritures (`gel.sh`, les deux instances)

`gel.sh` est livré à la racine de **chaque** instance (production et serveur de test), remplacé à chaque installation. Lancé en root, il gèle les écritures de
`/api/` de cette instance (fiches, édition, lots de changements, mise à jour ; les lectures restent ouvertes) :

```bash
sudo sh /srv/maverick-center/gel.sh poser --duree 90 --motif "bascule de la production"     # production ; …-test/gel.sh pour le serveur de test
sudo sh /srv/maverick-center/gel.sh etat                                                     # jusqu'à quand, pourquoi, encore combien de minutes
sudo sh /srv/maverick-center/gel.sh lever                                                    # lève le gel tout de suite
```

- `--duree` : de 1 à 240 minutes (60 par défaut), `--motif` : le texte que voient ceux dont l'écriture est refusée (`503`). Reposer un gel remplace le précédent.
- Il écrit `db/gel.json` (en entier à côté, puis renommé ; 644). Le service le prend en compte sans redémarrage, il **tient après une relance** et **se lève seul** à
  l'échéance. Un fichier illisible tient le gel 2 h au plus. Sans fichier, rien ne change. Détail : `docs/serveur.md`, « Bascule 2 : préparation ».
- Il ne touche ni la base, ni le service, ni le fichier `GELER` (celui-ci suspend les mises à jour automatiques).

## Activer un kit avec son paquet (`activer.sh`, production)

`activer.sh` et `activation-conteneur.sh` sont livrés à la racine de la **production** (remplacés à chaque installation ; jamais dans l'instance de test). **Éteint par défaut** : sans
le fichier `activation-par-paquet` (que vous posez en root le jour J : `sudo touch /srv/maverick-center/activation-par-paquet`), `activer.sh` refuse tout de suite (« éteinte », code 2),
l'installateur de production n'ajoute que le test de ce fichier. **Ce qui change quand même en production** : les deux scripts sont posés (inertes), le `docker-compose.yml` livré monte `/dev/null` en lecture seule sur `/paquets` (aucun dossier créé, rien d'écrivable ; appliqué au prochain `docker compose up -d`) ; ni service, ni site, ni base ne sont touchés. Avec lui, l'installateur de production crée l'utilisateur système `maverick-site`,
lui donne `site/` **sauf** `site/_serveur/` (le code que le service exécute, qui reste à root ; `find -P … -exec chown -h`, jamais un lien suivi) et, quand le kit est posé
(`activation/kit/kit.json`), lance `activer.sh`. Son refus ne fait jamais échouer l'installation. Le kit est posé dans `activation/kit/` par l'installateur de production « kit seul » (« Installateur « kit seul » », ci-dessus), que GitHub livre quand `actif` est allumé dans `tools/flux-git/bascule-2.json` ; sans lui, `activer.sh` refuse (« pas de kit dans … ») et dit `sudo sh /srv/maverick-center/mise-a-jour.sh --force`.

```bash
sudo bash /srv/maverick-center/activer.sh                  # le kit posé dans activation/kit/ avec son paquet (paquets/<X.Y>-<lot>.db, déposé par le site de dev)
sudo bash /srv/maverick-center/activer.sh --reprendre      # rejouer après une correction ; remet d'abord site.precedent/ si une activation a été interrompue pendant sa bascule
sudo bash /srv/maverick-center/activer.sh --correctif      # correctif urgent : le dernier paquet activé est recontrôlé avec le nouveau kit, les pages refaites avec lui
```

- **Ce que root fait** : des `stat` du paquet (fichier ordinaire, pas un lien, de taille plafonnée : refus avant toute lecture), un `sqlite3 .backup` de la base de la production, `gel.sh`,
  `docker compose stop/up`, quelques déplacements. Tout ce qui ouvre le paquet ou fabrique des pages tourne dans un **conteneur sans réseau, sans capacité, en lecture seule, utilisateur
  65534** (le même durcissement que l'atelier) : il copie le paquet, calcule son empreinte et la compare à celle que **le kit** annonce (`kit.json#paquet.empreinte`, venue de GitHub : la
  seule à laquelle la production fait confiance), contrôle (structure, notes de version, contenu réel, base de la production refaite avec ses fiches sur la copie), puis fabrique
  tout le site avec `SITE_MODE=prod`. Root ne lit que des JSON plafonnés, après `docker rm`.
- **Le service vient du kit seul** : `_serveur/` est fabriqué par `livrerServeur` du kit dans un conteneur sans paquet ni contenu ; jamais celui que la fabrication des pages a laissé.
- **La bascule courte** : gel des écritures (45 min au plus), service arrêté, base mise de côté (`activation/base-avant/`, empreinte sha256 gardée), `site/` copié dans
  `site.precedent/`, pages posées (sous `maverick-site`), `_serveur/` posé (sous root, par un autre conteneur sans capacité, `version.json` en dernier), service relancé, **contrôle de
  santé** (5 min au plus : `/api/etat` répond, la base est prête, la version est celle du kit), gel levé. **Échec** : retour automatique (le site précédent reposé, la base remise si le
  nouveau service l'avait refaite, le gel levé).
- **Les refus** disent les chiffres et le geste exact (mémoire et disque : les règles de l'atelier ; paquet absent, lien, irrégulier ou trop gros ; empreinte, structure, note de version
  manquante, version en arrière, contenu, fiches). Sortie en comptes, jamais un nom de fiche. Dernière ligne : `== PASSEE`, `== REFUSEE : …`, `== RETOUR AUTOMATIQUE : …` ou
  `== IMPOSSIBLE : …`. Le rapport est dans `activation/rapport.json` et laissé dans `paquets/activation.json`, où la page Mise à jour du site de dev le lit.
- **Reprise après un refus** (« GitHub a livré, la production a refusé ») : un refus ou un retour automatique de `activer.sh` écrit son rapport (`activation/rapport.json`, laissé dans `paquets/activation.json`), que la page Mise à jour du site de dev lit (`activation_production` : l'état, les raisons, le geste) ; la production garde son site et sa base. Un refus de l'installateur, ou `activer.sh` « impossible » (code 2), n'écrit aucun rapport : la raison est dans la sortie de l'installateur (`installation.log`, `mise-a-jour.log`). On corrige la cause (paquet absent : refaire « Effectuer la mise à jour » sur le site de dev ; place ou mémoire : les libérer ; `maverick-site` ou droits : `sudo sh /srv/maverick-center/mise-a-jour.sh --force`), puis : `sudo bash /srv/maverick-center/activer.sh --reprendre` (avec `--correctif` après un correctif urgent) ; ou on attend la livraison suivante, que l'installateur active à son tour.
- **Réglages** : `activation/reglages.env` (à root : `MEMOIRE_MAX_KO`, `BESOIN_KO`, `DISQUE_MIN_KO`, `DELAI_S`, `CPUS`, `GOOGLE_CLIENT_ID`), relus champ par champ.
- **Le dossier partagé `paquets/`** : celui de la production, monté dans les deux services (`MAVERICK_DOSSIER_PAQUETS` dans le `.env` du site de dev). `bascule.sh poser-bascule-2` le crée
  et pose `db/bascule-2` (« La base source du site de dev »).

## Le marqueur de la bascule 2 (`db/bascule-2`, `bascule.sh`)

```bash
sudo bash /srv/maverick-center-test/bascule.sh poser-bascule-2      # refusé sans db/source ; crée paquets/ de la production, le monte dans le service du site de dev, pose db/bascule-2
sudo bash /srv/maverick-center-test/bascule.sh retirer-bascule-2    # retour arrière : marqueur renommé (rien n'est effacé), le service du site de dev redevient celui d'avant
```

`poser-bascule-2` pose aussi dans le `.env` du site de dev `MAVERICK_DOSSIER_PAQUETS=<le paquets/ de la production>` et `MAVERICK_PAQUETS_OPTION=` (lecture-écriture) ; `retirer-bascule-2` les retire et recrée le service. Le service lit le marqueur à chaque fois (pas de redémarrage). Avec lui, « Effectuer la mise à jour » refuse un code pas à jour et un contenu rouge, et dépose le paquet dans `paquets/` ;
le dernier paquet livré y est aussi gardé (de quoi rejouer `activer.sh --correctif`). Détail : `docs/serveur.md`, « Bascule 2 : préparation », « PR 5a ».

## Répétition de la mise à jour de la production (`repetition-prod.sh`)

Posé par l'installateur de test à côté de `bascule.sh`. Il joue, sur une **copie** de la base de la production, ce que fera la dernière mise à jour par
l'ancien circuit : le contenu à venir tiré de la base du site de dev, puis la préparation de la base que ferait le service de la production à son
installation (fiches recopiées, conversions, retraits, contrôle), dans un conteneur du code du site de dev. La vraie production n'est jamais touchée.

```bash
sudo bash /srv/maverick-center-test/repetition-prod.sh                          # copie prise à l'instant (sqlite3 .backup, lecture seule)
sudo bash /srv/maverick-center-test/repetition-prod.sh --depuis-la-sauvegarde   # la dernière copie locale de la production
```

Il n'écrit que des comptes (jamais un nom de fiche) : `PASSERA` (code 0) ou `REFUSEE` (code 1 : la production garderait sa base, et pourquoi, par table et
colonne), les fiches adaptées par nature, les tables en « chute anormale » que verra la copie horaire suivante, la durée et la place. Le dossier de travail
(`var/repetition-prod.*` de l'instance, 4 fois la base de la production plus celle du site de dev) est effacé à la fin ; `--garder` le garde (il contient
les fiches de la production : à effacer soi-même). Détail : `docs/serveur.md`, « Répétition de la mise à jour de la production ».

## Répétition complète du jour J de la bascule 2 (`repetition-bascule-2.sh`)

Posé par l'installateur de test à côté de `repetition-prod.sh` (lot 11, PR 3a). Il rejoue sur des **copies** ce que fera la production le jour J, sans la toucher
ni écrire la base du site de dev : copie de la base de la production (`sqlite3 .backup`, ou sa dernière copie locale), puis, dans un conteneur du code du site de dev,
le contenu à livrer fabriqué comme la simulation de mise à jour (un **paquet**), le contrôle du contenu (garde-fou 18), l'activation (garde-fou 17) et la base de la
production refaite avec ses fiches ; enfin **tout le site de la production** fabriqué depuis ce paquet avec le kit de l'atelier, dans un conteneur de l'image du kit
(aucun réseau, lecture seule, aucune capacité, utilisateur 65534, plafond de mémoire de l'atelier, `SITE_MODE=prod`).

```bash
sudo bash /srv/maverick-center-test/repetition-bascule-2.sh                          # copie de la production prise à l'instant
sudo bash /srv/maverick-center-test/repetition-bascule-2.sh --depuis-la-sauvegarde   # la dernière copie locale
```

- **Préalable** : l'atelier est installé, et la version installée du site de dev (`VERSION`) est celle du kit (`atelier/kit/kit.json`) ; sinon elle dit les deux versions et le
  geste (attendre l'installation, au plus 5 minutes, ou `sudo sh /srv/maverick-center-test/mise-a-jour.sh`), code 2. Elle prend le verrou de l'atelier (`atelier/.verrou`) :
  pendant une fabrication de l'atelier elle refuse, et inversement.
- **Sortie** : des comptes seulement, jamais un nom de fiche (tables contrôlées, problèmes par table, identifiant et règle, fiches adaptées, pages fabriquées, durée, pic de
  mémoire). Dernière ligne : `repetition-bascule-2 : == la bascule PASSERAIT` (code 0), `== REFUSEE : <raison>` (code 1 : chiffres et geste), `== IMPOSSIBLE : <raison>` (code 2).
- Le dossier de travail (`var/repetition-bascule-2.*` de l'instance) est effacé à la fin ; `--garder` le garde (il contient les fiches de la production : à effacer soi-même).
  En cas d'échec des pages, la fin du journal du conteneur est dans `var/repetition-bascule-2-journal-du-conteneur.txt`.
- Elle emploie `outils/lib.sh` et `outils/conteneur.sh` de l'atelier tels qu'ils sont installés (le second sert la répétition par deux variables, `CONTENU_FICHIER` et
  `MODE_REPETITION=1`, sans changer l'atelier). Détail : `docs/serveur.md`, « Répétition complète du jour J ».

## Le kit de l'atelier (serveur de test seulement)

Chaque installateur **de test** emporte un kit : le code du site et ses `node_modules`, de quoi lancer `npm run build:depuis-contenu` sans réseau, sans `data/rows` ni
git (`docs/serveur.md`, « Fabriquer le site depuis un fichier de contenu »). L'installateur de production n'en porte pas : son script n'a pas la ligne qui le pose.

- **Fabrication** : `fabriquer.mjs --kit <racine du dépôt>` (mode test seulement, refusé en production ; `livraison.yml` le passe pour le serveur de test, après `npm ci`) ;
  la logique est dans `kit.mjs`. L'archive `atelier-kit.tar.gz` et son `kit.json` (format `maverick-kit/1` : version, commit, Node de `.nvmrc`, plateforme et libc des modules
  compilés, image Docker à employer, taille, nombre de fichiers, empreintes, ce que l'élagage a retiré) sont joints sous `atelier-kit/`.
- **Contenu** : `client/` avec ses `node_modules` (sans `dist/`, `.astro/`, `src/content/wiki/`, `test/`, `var/` ni ce que git ignore), `data/schema.sql`, `data/derive.sql`,
  `data/migrations/`, `sources/sources.json`, `sources/copies-drive.json`, `sources/tipeee/bienvenue.json`, `.nvmrc`. Aucun contenu : un contrôle refuse tout kit qui porte `data/rows`, `sources/raw`, un
  fichier de base (`.db`, `.sqlite`), les pages fabriquées, l'historique git ou un lien qui sorte du kit.
- **Image** : les modules natifs sont ceux de la machine qui fabrique (Linux, glibc sur GitHub) ; l'atelier doit tourner sur l'image `kit.json#image` (`node:<.nvmrc>-bookworm-slim`),
  jamais sous Alpine. Les variantes natives d'une autre libc, plateforme ou architecture, d'après le `package.json` de chaque paquet (`os`, `cpu`, `libc`), ne sont pas emportées.
- **Pose** : `<instance>/atelier/kit/` (avec `kit.json`), hors de `site/` : jamais servi. L'installateur le décompresse dans un dossier provisoire voisin, puis remplace l'ancien par
  renommage ; un seul kit est gardé. Il vérifie d'abord la place libre (`df`) : deux fois la taille décompressée annoncée, plus 256 Mo. **Un manque de place ou un échec ne
  fait jamais échouer l'installation** : le site est posé, le journal (`installation.log`) dit que le kit manque, l'ancien kit reste.
- **Le paquet annoncé** : `kit.json` porte `paquet: { lot, version, empreinte, structure }`, lus de `data/paquet.json` (l'identité du dernier lot, sans contenu, que le workflow de mise à jour écrit quand
  la bascule 2 est allumée) ; sans ce fichier, `paquet: null` ; sa propre `structure` est celle du kit (`PRAGMA user_version` de `data/schema.sql`). Un fichier illisible ou d'une autre forme fait refuser le kit.

### Installateur « kit seul » (bascule 2, éteint)

`fabriquer.mjs --mode test --kit <racine> --kit-seul --tag … --version … --sha … --sortie …` (sans `--site`) fabrique un installateur **sans pages** : le service (`site/_serveur/`, `version.json` avec
le commit) et le kit. `livraison.yml` ne le demande que si `tools/flux-git/bascule-2.json` a `actif: true` sur `origin/dev` (pour les deux modes) ; éteint, les installateurs sont ceux d'avant. L'installateur de test d'un kit seul :
- **refuse**, avant toute écriture, une instance sans `<instance>/atelier/servir` (l'atelier ne refabriquerait pas les pages : le site resterait celui d'avant) et dit le geste, `sudo sh <instance>/atelier/installer.sh --servir` ;
- **ne pose que `site/_serveur/`** : le reste de `site/` (pages, `donnees/`) n'est pas touché, c'est l'atelier qui le refait après la marque ; le reste de l'installation est celle de tout installateur de test (fichiers de l'instance, kit, marque, `VERSION`) ;
- se vérifie comme les autres (`--verifier`).
`mise-a-jour.sh` l'installe comme le dernier installateur du mode. L'installateur de production qui n'est pas un kit seul n'en porte rien : même comportement qu'avant.

**Production** (`--mode prod --kit <racine> --kit-seul --tag VX.Y …`) : une archive sans pages **ni service** (`site/` vide), avec le kit, `activer.sh`, `activation-conteneur.sh` et `gel.sh`. L'installateur :
- **refuse**, avant toute écriture, une production sans le fichier `activation-par-paquet` (sinon elle resterait sur l'ancien site sans rien activer) et dit le geste : `sudo touch /srv/maverick-center/activation-par-paquet`, ou remettre `actif` à `false` dans `tools/flux-git/bascule-2.json` (la prochaine livraison de production redevient complète), `sudo touch /srv/maverick-center/GELER` suspendant le minuteur en attendant ; il refuse aussi hors root, et sur un dossier qui n'est pas une production installée (installez d'abord l'installateur complet) ;
- **pose le kit dans `<production>/activation/kit/`** (à root, décompressé à côté puis renommé : un seul kit gardé ; un échec refuse l'installation avant d'écrire `VERSION`) ; **ne touche ni `site/` ni `site/_serveur/`** ;
- écrit les fichiers de l'instance et `VERSION`, crée `maverick-site` et rend `site/` à son propriétaire, puis **lance `activer.sh --prod <production>`**, qui fabrique les pages et le service depuis le paquet et les pose (« Activer un kit avec son paquet »). Pour une étiquette `VX.Y-hotfix.N` ou `VX.Y-rebuild.N`, il lance `activer.sh --correctif` (le même contenu republié : le dernier paquet activé est recontrôlé avec le nouveau kit).
`mise-a-jour.sh` de la production n'a rien de plus à faire : le kit seul arrive comme une livraison ordinaire. Un installateur qui refuse fait écrire une ligne `ERREUR` à chaque passage du minuteur (comme le refus d'une livraison plus ancienne) ; une installation faite dont l'activation a refusé laisse `VERSION` à la nouvelle étiquette, le minuteur dit « À jour » : la reprise est `sudo bash /srv/maverick-center/activer.sh --reprendre` (paragraphe suivant).

## L'atelier du site de dev (serveur de test seulement)

L'installateur de test livre aussi les scripts de l'atelier (`deploy/installateur/atelier/`) : `installer.sh` à la racine de `<instance>/atelier/` (la commande courte du propriétaire) et `lancer.sh`, `lib.sh` dans `atelier/outils/`.
Seuls ces fichiers sont remplacés, par renommage ; les fichiers d'`outils/` qui ne sont plus livrés sont retirés ; le kit, le travail, la sortie, les rapports et les réglages de l'atelier ne sont jamais touchés. À chaque livraison,
l'installateur copie `kit.json` dans `atelier/rapports/` (le service y lit « le kit est posé ») et pose la marque `atelier/declencheur/marque` quand le kit posé est celui de la livraison. Rien ne consomme la marque tant que le propriétaire n'a pas
lancé `sudo sh /srv/maverick-center-test/atelier/installer.sh` (`deploy/vps/README.md`, « Atelier du site de dev ») ; ce geste pose les unités systemd (dont les minuteurs de nuit et de la journée type), les réglages et, dans le dossier de l'instance de test seulement, un `docker-compose.override.yml` (le montage des rapports, en lecture seule) : l'installateur ne le livre, ne le pose ni ne l'efface jamais, et le `docker-compose.yml` livré, commun à la production, ne change pas. L'installateur de production n'en porte rien.
Détail et garde-fous : `docs/serveur.md`, « Atelier du site de dev ».

## Fabriquer un installateur à la main

`./deploy/installateur/fabriquer.sh prod` (ou `test`) construit le site sur votre machine (Node.js ≥ 22.12) et écrit l'installateur dans
`deploy/installateur/sortie/` (étiquette `vX.Y.Z-local`).

## Ce qui a été vérifié

Les installateurs sont fabriqués et exécutés par `client/test/installateur.test.mjs` (installation, mise à jour, copie d'une vraie base SQLite en cours
d'écriture, refus) et `mise-a-jour.sh` est testé contre un faux GitHub (`client/test/mise-a-jour.test.mjs`), avec et sans `rsync` et `sqlite3`.
