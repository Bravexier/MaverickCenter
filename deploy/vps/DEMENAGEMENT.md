# Déménager le serveur (VPS) : procédure pas à pas

> **Préparé le 2026-11-18, mis à niveau le 2026-11-19 pour la bascule 2 (lot 11), non joué ; à relire avant usage.** Le déménagement est repoussé à une date inconnue (le propriétaire agrandit d'abord son VPS actuel). Cette
> procédure vaut pour **n'importe quel nouveau serveur** Ubuntu (un VPS OVH n'est qu'un exemple). Les scripts sont éprouvés par une répétition sur deux dossiers jetables
> (`client/test/deploy-demenagement.test.mjs`) ; ce que la répétition ne peut pas imiter est dit tout en bas. Aucune adresse IP, aucun secret n'est dans ce dépôt : les adresses sont des
> alias SSH (étape 2), les secrets voyagent de serveur à serveur.

**But.** Les mêmes deux sites (`https://maverick-jdr.com`, `https://dev.maverick-jdr.com`) sur un autre serveur, **sans jamais perdre ni dédoubler une base** : la base du site de dev
(`db/` + marqueur `db/source`) est la seule copie maîtresse des règles, celle de la production porte les fiches des joueurs.

Tu lances les commandes, une par une. Après chaque commande, le texte attendu est donné. **Si l'écran est autre chose : arrête-toi, ne fais rien d'autre, colle l'écran.** Rien dans cette
procédure n'efface une base : un script qui hésite refuse, il ne répare pas.

## L'ordre, et pourquoi

1. **Préparer le nouveau serveur à vide** (jours avant, l'ancien continue de servir) : durcir, Docker et Caddy, dossiers des instances, sites posés par les installateurs. **Aucun `docker compose up`** :
   un service démarré sur un `db/` vide fabrique une base NEUVE (l'installateur ne crée jamais de base ; c'est le service qui le fait au premier démarrage). Poser les sites d'abord donne un `db/` vide
   que le déballage remplit ; poser les bases d'abord ferait passer l'installateur sur une vraie base (il tenterait un essai de structure et refuserait toute version plus ancienne). C'est l'ordre que joue la répétition.
2. **Geler l'ancien** (le service « serveur » de chaque instance arrêté, plus de mise à jour automatique, plus de minuteur de sauvegarde) : le site reste lisible, seules les écritures s'arrêtent.
3. **Emballer, transférer, déballer, contrôler** (l'égalité se prouve **avant** de démarrer quoi que ce soit sur le nouveau serveur).
4. **Démarrer le nouveau, l'essayer sans toucher au DNS** (`curl --resolve`), puis **changer le DNS**.
5. **Garder l'ancien, gelé et inoffensif**, plusieurs jours, puis l'arrêter.

À chaque étape, le **retour arrière** est dit : avant le DNS, on dégèle l'ancien et rien n'est perdu.

## Ce qui voyage, ce qui est refait, ce qui se retape

| Voyage dans l'archive (`demenagement.sh emballer`) | Refait sur le nouveau serveur | Se retape ou se refait |
| --- | --- | --- |
| `db/` des deux instances (copie cohérente, sans `essai-de-structure/`), dont `db/source` | `site/`, `docker-compose.yml`, `nginx.conf`, `sauvegarde/`, `acces/`, `bascule.sh` (les installateurs) | Mot de passe SSH : aucun (clé) |
| `.env`, `.github-token`, `mise-a-jour.env`, `mise-a-jour.log`, `installateur-courant/` de chaque instance | `.htpasswd` des instances et `/etc/caddy/maverick.env` : `instances.sh` refait la paire (ils ne servent qu'entre Caddy et nginx, personne ne les connaît) | Le DNS ; les clés SSH |
| `secrets/` du site de dev (`acces.json` : clé de lecture, clé de dépôt ; `discord.json` : application Discord, rôles, secret des sessions ; `github-actions-token`) et de la production (`discord.json`) | Unités systemd (volume, sauvegardes), `Caddyfile`, `robots.txt` | Le crontab de root (2 lignes) |
| `metriques/` (sans `volume-hote.json`) | Docker, Caddy, restic (paquets) | |
| `/etc/maverick-sauvegardes/` (accès au stockage, **phrase de chiffrement**, réglages) | | |
| les certificats et la clé de compte de Caddy (`/var/lib/caddy/.local/share/caddy`, sans `locks/`) | | |
| les copies locales `/srv/maverick-sauvegardes` : **seulement avec `--avec-copies`** (jusqu'à 4 Go : à décider à l'étape 6) | | |
| **Bascule 2** (détectée par l'emballage : `activation-par-paquet` en production ou `atelier/servir` au site de dev ; `INFOS` : `bascule2=1`) : production, `activation-par-paquet`, `paquets/` (les paquets déposés et `activation.json`), `activation/{reglages.env,rapport.json,dernier-paquet.json,version-en-attente}`, `site/` (fabriqué sur le serveur : aucun installateur ne le refait) ; les deux instances : `VERSION`, qui dit la version du service que porte `site/_serveur/` ; site de dev : `atelier/servir` (l'interrupteur) et `site/`. `atelier/reglages.env` voyage dès que l'atelier est installé | Utilisateur système `maverick-site` (créé par l'installateur de production quand `activation-par-paquet` existe) ; `activation/kit/` (posé par un installateur « kit seul ») et `atelier/kit/` (posé par les installateurs de test), image Docker de l'atelier, `docker-compose.override.yml` de l'atelier, unités systemd de l'atelier (`maverick-atelier.path`, `-nuit`, `-jour`, `-contenu`, `.slice`) : `atelier/installer.sh` | |

Ne voyagent **jamais** : `GELER`, `db/gel.json` (un gel d'écritures est celui d'un serveur à un moment : il se lève seul à l'échéance ; ni l'emballage ni le bilan ne le comptent), `site/` (sauf en bascule 2, voir la table), `site.precedent/` et `activation/base-avant/` (la base de la production d'avant une activation, fiches comprises : le retour arrière d'une activation ne se fait donc plus sur le nouveau serveur avant sa prochaine activation), `activation/kit/`, `atelier/kit/`, `atelier/rapports/`, `atelier/depot/`, les journaux Docker, `var/` (restes de restaurations).

## Avant : choisir et commander

- **Système : Ubuntu 26.04 LTS.** C'est la version sur laquelle les scripts ont été lancés pour de vrai (`README.md`, ligne 3 : première fois le 2026-10-10, paquets `docker.io` 29.1, `docker-compose-v2`, `caddy` 2.6.2).
  **24.04 LTS** donne les mêmes paquets (`docker.io`, `docker-compose-v2`, `caddy`, `restic` 0.16.4 : le README décrit la restauration sur une machine 24.04) et devrait marcher, mais **n'a pas été jouée** : repli seulement si 26.04 manque.
- **Taille.** Le site demande peu : une base vivante pèse ~25 Mo plus ses archives (≤ ~125 Mo par instance, `docs/serveur.md`, « Tout ce qui grossit »). Plus que l'actuel (1 vCPU, 2 Go, 20 Go) : 2 vCPU, 4 Go, 60 Go sont confortables ; l'atelier du site de dev fabrique avec un besoin de mémoire de 1,1 Go (réglage `--besoin`, 1,1 Go par défaut ; refus sous 2 fois ce besoin de mémoire disponible) : 4 Go suffisent, 2 Go sont trop justes avec la production qui tourne.
- **Région.** Peu importe pour les scripts. Pour les joueurs, la proximité (France) ; pour la copie de secours, un autre site que le serveur : voir « Sauvegardes » plus bas.
- **Accès.** Commander avec **ta clé publique SSH** (la même que pour l'ancien serveur : le fichier `.pub`). Le compte attendu est `ubuntu`, avec `sudo`.
- **Pare-feu de l'hébergeur.** Certains hébergeurs en ont un en plus de celui du serveur, **actif ou non selon l'hébergeur** (chez OVH, le « Network Firewall » est désactivé par défaut ; chez Infomaniak il était actif et fermait 80/443). S'il est actif : ouvrir TCP 22, 80 et 443 et UDP 443 ; s'il est désactivé, ne pas l'activer, `ufw` (posé par `durcir.sh`) suffit. Sans 80/443 ouverts, Caddy n'obtient aucun certificat.
- Noter, sans le coller nulle part : l'adresse IPv4 (et IPv6 s'il y en a une) du nouveau serveur.

## 1. Sur ton poste Windows : des noms au lieu d'adresses

Le dossier `C:\Users\<toi>\.ssh\` contient ta clé privée. Ouvrir (ou créer) `C:\Users\<toi>\.ssh\config` et y mettre, en remplaçant seulement ce qui est entre `<…>` :

```
Host maverick-ancien
    HostName <adresse de l'ancien serveur>
    User ubuntu
    IdentityFile ~/.ssh/<nom de ta clé privée>

Host maverick-nouveau
    HostName <adresse du nouveau serveur>
    User ubuntu
    IdentityFile ~/.ssh/<nom de ta clé privée>
```

Ce fichier reste sur ton poste (jamais dans git). Ensuite, **toutes** les commandes s'écrivent avec `maverick-ancien` ou `maverick-nouveau`. Essai, depuis PowerShell :

```
ssh maverick-nouveau
```

Attendu : « The authenticity of host … Are you sure you want to continue connecting » → `yes` (première connexion : le serveur est mémorisé), puis une invite `ubuntu@…:~$`. Tape `exit`. Si « Permission denied (publickey) » : arrête-toi, colle l'écran (la clé commandée n'est pas la bonne).
Même essai avec `ssh maverick-ancien`.

## 2. Copier les scripts sur les deux serveurs

Dans le dossier du dépôt, sur ton poste (PowerShell) :

```
scp -r deploy\vps maverick-nouveau:~/
scp -r deploy\vps maverick-ancien:~/
```

Attendu : une ligne par fichier (`durcir.sh`, `demenagement.sh`, …). L'ancien serveur reçoit les scripts du déménagement à jour : c'est lui qui emballe.

## 3. Préparer le nouveau serveur (jours avant ; l'ancien continue de servir)

Sur `ssh maverick-nouveau` :

```
sudo apt-get install -y tmux
```

Attendu : « tmux is already the newest version » ou la fin d'une installation sans erreur. `tmux` garde une commande en marche même si ta connexion SSH est coupée (Wi-Fi, veille du PC) : les commandes longues des étapes 6 et 8 s'y lancent (« tmux new -s demenagement » ; après une coupure : se reconnecter, puis « tmux attach -t demenagement »).

```
sudo bash ~/vps/durcir.sh
```

**Garde la fenêtre ouverte**, ouvre-en une deuxième, fais `ssh maverick-nouveau` : si ça marche, tu peux fermer la première. Attendu à la fin : « Terminé. Ouvrez MAINTENANT une nouvelle fenêtre… ». Si le script dit qu'un redémarrage est demandé : `sudo reboot`, patiente une minute, reconnecte-toi.

```
sudo bash ~/vps/outils.sh
```

Attendu : à la fin les versions de `docker`, `docker compose`, `caddy`, puis « Terminé. Étape suivante : sudo bash instances.sh ».

```
sudo bash ~/vps/instances.sh
```

Attendu : « Terminé. Instances prêtes : /srv/maverick-center et /srv/maverick-center-test (sans site pour l'instant) ». Aucun mot de passe n'est affiché.

`instances.sh` vient de démarrer Caddy avec les vrais domaines : tant que le DNS pointe sur l'ancien serveur, ses demandes de certificats échoueraient en boucle. Arrête-le jusqu'au jour J (l'étape 8d le redémarre) :

```
sudo systemctl stop caddy
```

**Poser les deux sites** (les installateurs, README, étape 5). Télécharge sur ton poste, dans la page *Releases* du dépôt, les deux fichiers de la dernière version (`maverick-center-VX.Y-install.sh`, le serveur normal, et `maverick-center-VX.Y.Z-install.sh`, le serveur de test), puis :

```
scp maverick-center-*-install.sh maverick-nouveau:~/
```

Sur `ssh maverick-nouveau` (remplace les versions par celles des fichiers) :

```
sudo sh ~/maverick-center-VX.Y-install.sh --dossier /srv/maverick-center
sudo sh ~/maverick-center-VX.Y.Z-install.sh --dossier /srv/maverick-center-test
```

**Si l'ancien serveur est en bascule 2** (`sudo ls /srv/maverick-center/activation-par-paquet /srv/maverick-center-test/atelier/servir` sur l'ancien montre les deux fichiers), **ne prends pas les derniers installateurs** : depuis le 2026-11-20, GitHub ne publie plus que des « kit seul » (sans pages), qui refusent une instance sans site. Pour reconnaître un fichier : `head -c 300000 <installateur> | grep -a '^KIT_SEUL='` (`KIT_SEUL=1` : kit seul ; `KIT_SEUL=0` ou rien : complet). L'installation change en quatre points :
- **serveur de test :** prendre sur la page *Releases* la dernière livraison de test **complète** (à ce jour la V0.5.50). Sur ton poste, `git diff --stat V0.5.50 <étiquette de test de l'ancien> -- deploy/installateur deploy/nginx.conf` ne doit montrer que `README.md` ; sinon, arrête-toi : cette étape est à reprendre avec une session. Sa version n'a pas à être celle de l'ancien serveur : le déballage pose la `VERSION` et les pages de l'ancien serveur ;
- **production :** la dernière livraison complète (V0.5) est plus ancienne que l'activation par paquet. Elle s'installe sans erreur, mais ne crée pas l'utilisateur `maverick-site` et ne pose ni `activer.sh` ni `gel.sh` : le déballage refuserait **le jour J, l'ancien serveur déjà gelé**. On fabrique donc un installateur complet de la **version exacte** de l'ancien, avec **son** site (commandes ci-dessous) ;
- avant l'installateur de production : `sudo touch /srv/maverick-center/activation-par-paquet` (il crée alors l'utilisateur système `maverick-site` ; contrôle après : `id maverick-site`). Sans kit posé, il ne lance pas `activer.sh`. Le déballage remplace ce fichier par celui de l'ancien serveur, sans rien effacer ;
- `instances.sh` ne demande rien de plus ici : le dossier `paquets/` vient de l'archive, et la relance de l'étape 8d (`.env` posé par l'archive, qui porte `MAVERICK_DOSSIER_PAQUETS`) le monte dans le service du site de dev. Sur un serveur sans archive, `sudo bash ~/vps/instances.sh --bascule-2` le crée et le monte.

**Fabriquer l'installateur complet de production (bascule 2).** Méthode jouée le 2026-11-21 pour la V0.6-hotfix.1, avec une copie du site par un tube SSH depuis Git Bash ; les commandes ci-dessous passent par des fichiers, car le tube de PowerShell 5.1 abîme les données binaires. Sur `ssh maverick-ancien` (le site n'est que lu, à basse priorité) :

```
sudo cat /srv/maverick-center/VERSION
sudo nice -n 19 tar -C /srv/maverick-center -czf ~/site-prod.tar.gz site
sudo chown ubuntu: ~/site-prod.tar.gz
sudo sh -c 'cd /srv/maverick-center && find site -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum'
```

Note `tag`, `version`, `commit` et l'empreinte. Sur ton poste (PowerShell), dans le dossier du dépôt, en remplaçant `<tag>` :

```
git fetch origin --tags
git archive --format=tar.gz -o fabrication.tar.gz <tag> deploy client/serveur client/src/lib
scp fabrication.tar.gz maverick-nouveau:
scp -3 maverick-ancien:site-prod.tar.gz maverick-nouveau:
del fabrication.tar.gz
```

Sur `ssh maverick-nouveau`, en remplaçant `<tag>`, `<version>` et `<commit>` :

```
mkdir -p ~/fabrication/depot ~/fabrication/site-prod ~/fabrication/sortie ~/installateurs
tar -xzf ~/fabrication.tar.gz -C ~/fabrication/depot
tar -xzf ~/site-prod.tar.gz -C ~/fabrication/site-prod
(cd ~/fabrication/site-prod && find site -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum)
sudo docker run --rm --network none --user "$(id -u):$(id -g)" -v "$HOME/fabrication:/f" -w /f/depot node:22-alpine node deploy/installateur/fabriquer.mjs --mode prod --site /f/site-prod/site --tag <tag> --version <version> --sha <commit> --sortie /f/sortie
cp ~/fabrication/sortie/maverick-center-<tag>-install.sh ~/installateurs/
sh ~/installateurs/maverick-center-<tag>-install.sh --verifier
```

Attendu : la même empreinte que sur l'ancien serveur, puis « archive intègre, … pages ». Essai sur un dossier jetable :

```
mkdir -p ~/fabrication/essai/maverick-center
sudo touch ~/fabrication/essai/maverick-center/activation-par-paquet
sudo sh ~/installateurs/maverick-center-<tag>-install.sh --dossier ~/fabrication/essai/maverick-center
```

Attendu : « utilisateur système maverick-site créé », « activer.sh n'est pas lancé », « Installé : … pages. ». Sinon, arrête-toi et colle l'écran. Puis la pose réelle, avec l'installateur de test complet copié dans `~/`, et le ménage :

```
sudo touch /srv/maverick-center/activation-par-paquet
sudo sh ~/installateurs/maverick-center-<tag>-install.sh --dossier /srv/maverick-center
sudo sh ~/maverick-center-<version de test>-install.sh --dossier /srv/maverick-center-test
sudo rm -rf ~/fabrication ~/fabrication.tar.gz ~/site-prod.tar.gz
```

Sur `ssh maverick-ancien` : `rm ~/site-prod.tar.gz`. Garde `~/installateurs/` jusqu'à la fin du déménagement.

Attendu, pour chaque installateur : « Installé : … pages. » (le mot de passe interne est déjà posé par `instances.sh` : aucune question). Rien ne doit démarrer. **Ne lance jamais `docker compose up` sur le nouveau serveur avant l'étape 9.**

Vérification, `ssh maverick-nouveau` :

```
sudo ls /srv/maverick-center/db /srv/maverick-center-test/db
sudo docker ps
```

Attendu : les deux dossiers `db/` **vides**, et `docker ps` sans aucun conteneur. Sinon, arrête-toi et colle l'écran.

**Retour arrière (étape 3) :** rien à défaire : l'ancien serveur n'a pas été touché. Pour recommencer le nouveau à neuf, le plus simple est de le réinstaller chez l'hébergeur (aucune donnée n'y est encore).

**À savoir.** Les installateurs téléchargés sont ceux de la dernière version ; l'ancien serveur peut en avoir reçu une plus récente le jour J (il se met à jour seul). Ce n'est pas bloquant : l'étape 8 compare les versions et dit quoi faire.

## 4. La veille : le DNS

Chez le gestionnaire de la zone (OVH pour `maverick-jdr.com` : Noms de domaine → la zone DNS) : **baisser le TTL à 300 secondes** (5 minutes) des enregistrements **A et AAAA** de `maverick-jdr.com` (la racine), `www` et `dev`. Ne rien changer d'autre. La veille, pour que l'ancienne durée (souvent 1 h à 24 h) soit écoulée au moment de la bascule. Noter les valeurs actuelles (ce sont les adresses de retour arrière).

## Jour J

Prévois ~2 heures calmes (voir « La coupure »). Pas de page de maintenance à poser : celle du site n'existe que pendant une mise à jour (README, section 8). Pendant le gel, **les pages restent lisibles** (nginx continue), seules les fiches et l'édition ne répondent plus (`/api/` : 502).

### 5. Geler l'ancien

Sur `ssh maverick-ancien` :

```
sudo touch /srv/maverick-center/GELER /srv/maverick-center-test/GELER
sudo systemctl stop maverick-sauvegarde-horaire.timer maverick-sauvegarde-nuit.timer maverick-sauvegarde-essai.timer
sudo systemctl stop maverick-sauvegarde-horaire.service maverick-sauvegarde-nuit.service maverick-sauvegarde-essai.service
sudo systemctl stop maverick-atelier.path maverick-atelier-nuit.timer maverick-atelier-jour.timer maverick-atelier-contenu.timer
sudo systemctl stop maverick-atelier.service maverick-atelier-nuit.service maverick-atelier-jour.service maverick-atelier-contenu.service
sudo crontab -l
```

`crontab -l` doit montrer deux lignes `*/5 * * * * sh /srv/maverick-center…/mise-a-jour.sh`. Mets-les en commentaire : `sudo crontab -e`, ajoute `#` au début de ces deux lignes, enregistre. Vérifie : `sudo crontab -l | grep mise-a-jour` ne doit montrer que des lignes commençant par `#`.

Les unités de l'atelier n'existent que si l'atelier est installé : `systemctl stop` sur une unité absente affiche une erreur sans gravité (continue). **Une fabrication de l'atelier en cours** (`sudo systemctl is-active maverick-atelier.service maverick-atelier-contenu.service`) se laisse finir, puis on l'arrête comme ci-dessus : elle poserait un site pendant la copie. Une activation restée à moitié faite (`/srv/maverick-center/activation/en-cours`) se reprend d'abord (`sudo bash /srv/maverick-center/activer.sh --reprendre`).

Si une mise à jour est en cours (`sudo tail -n 3 /srv/maverick-center-test/mise-a-jour.log` dit « installation » il y a moins d'une minute), attends qu'elle se termine **avant** la commande suivante.

```
cd /srv/maverick-center && sudo docker compose stop serveur
cd /srv/maverick-center-test && sudo docker compose stop serveur
sudo docker ps
```

Attendu : `docker ps` ne montre plus que les deux conteneurs `nginx` (les services « serveur » sont arrêtés). Ouvre `https://dev.maverick-jdr.com` : les pages s'affichent, l'enregistrement d'une fiche échoue (normal).

**Retour arrière (avant le DNS) :** `sudo rm /srv/maverick-center*/GELER`, `sudo systemctl start maverick-sauvegarde-{horaire,nuit,essai}.timer` (et, si l'atelier est installé, `sudo systemctl start maverick-atelier.path maverick-atelier-nuit.timer maverick-atelier-jour.timer maverick-atelier-contenu.timer`), remettre les lignes du crontab, `cd /srv/maverick-center && sudo docker compose start serveur` (idem `-test`). Rien n'a été perdu : rien n'a été modifié sur l'ancien serveur.

### 6. Emballer (ancien)

Dans `tmux` (si la connexion saute, l'emballage continue ; l'ancien serveur n'est jamais modifié par lui) :

```
tmux new -s demenagement
sudo bash ~/vps/demenagement.sh emballer --avec-copies
```

(sans `--avec-copies` si tu choisis de ne pas emporter les copies locales : elles pèsent jusqu'à 4 Go, passent par ton poste, et le même historique est dans le stockage extérieur chiffré ; la copie nommée `bascule-1-20261117-214248` y est aussi. Sans les copies, le nouveau serveur fera ses propres copies dès la première heure.)

En bascule 2, l'emballage emporte aussi les paquets, l'activation, l'interrupteur, `VERSION` et les pages (la table plus haut) : l'archive pèse alors une centaine de Mo de plus. Attendu, dans l'ordre : « 1/5 les écritures sont-elles gelées ? » … « 5/5 archive », puis :
```
Archive : /home/ubuntu/demenagement-AAAAMMJJ-HHMMSS.tar.gz (… , … fichiers)
Empreinte de l'archive (à retrouver à l'arrivée) : <64 caractères>
```
Note les 8 premiers caractères de l'empreinte. Les refus possibles disent quoi faire : « le service tourne », « pas de fichier GELER », « le minuteur … tourne », « le crontab … » : refais l'étape 5 puis relance. « la base … est abîmée » : arrête-toi, colle l'écran.

**Retour arrière (étape 6) :** `rm ~/demenagement-*.tar.gz` ; l'ancien n'a pas bougé (dégeler : étape 5). Une archive coupée en route n'existe pas sous son nom définitif : le fichier `….tar.gz.partiel` est effacé par le script, ou à la main s'il restait.

Le bilan de l'ancien (des nombres et des empreintes, aucun secret) :

```
sudo bash ~/vps/controle-demenagement.sh bilan --sortie ~/bilan-ancien.txt
```

Attendu : « bilan écrit : /home/ubuntu/bilan-ancien.txt (… lignes) » (une dizaine de secondes : le service calcule les empreintes du site dans un conteneur éphémère). Si des lignes valent `indisponible`, arrête-toi et colle l'écran.

### 7. Transférer (de serveur à serveur, par ton poste)

Depuis PowerShell, **une seule commande** : `-3` fait passer les octets par ton poste **sans les y écrire** :

```
scp -3 maverick-ancien:demenagement-AAAAMMJJ-HHMMSS.tar.gz maverick-nouveau:
scp -3 maverick-ancien:bilan-ancien.txt maverick-nouveau:
```

(remplace le nom par celui affiché). Attendu : une barre de progression par fichier, sans erreur. Durée : de 2 à 15 minutes selon ton débit (l'archive pèse quelques centaines de Mo : les installateurs gardés pèsent le plus).
**Retour arrière (étape 7) :** efface la copie arrivée sur le nouveau serveur (`rm ~/demenagement-*.tar.gz`) ; rien n'a été posé. Une copie interrompue se refait simplement (même commande).
Si `scp -3` n'est pas reconnu : deux commandes (`scp maverick-ancien:<fichier> .` puis `scp <fichier> maverick-nouveau:`), **puis efface le fichier de ton poste** (`del <fichier>`) : l'archive porte tous les secrets.

Vérifie qu'elle est arrivée entière, `ssh maverick-nouveau` :

```
sha256sum ~/demenagement-*.tar.gz
```

Attendu : la même empreinte qu'à l'étape 6 (compare les 8 premiers caractères). Sinon, recommence la copie.

### 8. Déballer (nouveau) et contrôler l'égalité **avant tout démarrage**

Tout se passe sur `ssh maverick-nouveau`, dans `tmux` (`tmux new -s demenagement`, ou `tmux attach -t demenagement` si la session existe). Remplace `AAAAMMJJ-HHMMSS` par le nom de ton archive.

**8a. Arrêter Caddy** (il réécrirait ses certificats pendant qu'on les remplace) — [nouveau] :

```
sudo systemctl stop caddy
```

Attendu : aucune sortie. Sinon, arrête-toi et colle l'écran.

**8b. Essai à blanc, qui ne pose rien** — [nouveau] :

```
sudo bash ~/vps/demenagement.sh deballer --a-blanc ~/demenagement-AAAAMMJJ-HHMMSS.tar.gz
```

Attendu : « manifeste : … fichiers, tous conformes », puis « A BLANC : l'archive est conforme et ce serveur est prêt ; rien n'a été posé. ». Sinon, arrête-toi et colle l'écran. Les refus, **tous sans rien poser** : « n'est pas installé » (refaire l'installateur, étape 3) ; « le service tourne » ou « n'est pas vide » (un service a démarré par erreur et fabriqué une base neuve : le message donne la commande qui la **met de côté** sans l'effacer ; si le message parle d'une vraie base, **ne fais rien** et colle l'écran) ; « ne correspond pas au manifeste » (copie abîmée : refaire l'étape 7).

**8c. Déballer pour de vrai** — [nouveau] :

```
sudo bash ~/vps/demenagement.sh deballer ~/demenagement-AAAAMMJJ-HHMMSS.tar.gz
```

Attendu : « 3/6 », « 4/6 », « 5/6 les bases », « n fichiers posés et conformes », puis « Versions : les mêmes que l'ancien serveur ».

**Si l'écran dit « VERSION … l'ancien serveur est en …, celui-ci en … » (code 4)** : les versions installées diffèrent (plus ancienne **ou plus récente** : les deux comptent). **Rien n'est posé.** Le script affiche deux commandes : extraire de l'archive l'installateur de l'ancien serveur (`installateur-courant/`), puis le lancer (`sudo sh … --dossier /srv/…`) ; il pose la release exacte de l'ancien sur le `db/` encore vide. Relance alors la même commande 8b puis 8c. La mise à jour vers une version plus récente vient **après** l'étape 9, par le cron normal, sur une base déjà contrôlée.

**Si la session est coupée pendant le déballage** (ou si un écran d'erreur apparaît au milieu) : reconnecte-toi, `tmux attach -t demenagement`, regarde l'écran, puis **relance exactement la même commande 8c**. Chaque élément est posé d'un seul coup (copie à côté, puis renommage) : une base est soit absente soit entière, jamais partielle ; ce qui est déjà posé et conforme est reconnu (« déjà posé, conforme ») et laissé tel quel ; un refus « pas vide » ne vient que d'une base qui n'est pas celle de l'archive. Les restes d'une panne (`….nouveau-<date>`, `….avant-demenagement-<date>`) ne sont jamais effacés par le script : ils se retirent à l'étape 12.

**8d. Redémarrer Caddy et refaire les réglages d'instance** — [nouveau]. `instances.sh` ne fait qu'ajouter : il garde les mots de passe internes, ne touche ni à `db/` ni aux sites, reprend les réglages du `.env` (une clé nouvelle ne se perd pas) et redémarre Caddy :

```
sudo bash ~/vps/instances.sh
```

Attendu : « Mots de passe internes déjà en place : conservés » puis « Terminé. Instances prêtes ». Sinon, arrête-toi et colle l'écran.
Puis `sudo grep -H MAVERICK_DOSSIER_METRIQUES /srv/maverick-center/.env /srv/maverick-center-test/.env` doit montrer `=/srv/maverick-center/metriques` pour **les deux** (`instances.sh` le pose) : sans lui, le site de dev ne lit pas l'attestation de la production, et « Copier vers le dépôt », la Simulation et la mise à jour sont refusées (incident du 2026-11-19).

**8e. Le bilan du nouveau** — [nouveau] :

```
sudo bash ~/vps/controle-demenagement.sh bilan --sortie ~/bilan-nouveau.txt
```

Attendu : « bilan écrit : /home/ubuntu/bilan-nouveau.txt (… lignes) » (le fichier est à toi : pas besoin de `sudo` ensuite). Une ligne `indisponible` : arrête-toi et colle l'écran.

**8f. Comparer** — [nouveau] :

```
bash ~/vps/controle-demenagement.sh comparer ~/bilan-ancien.txt ~/bilan-nouveau.txt
```

Attendu : `EGALITE (… constats comparés)`. Elle couvre les empreintes de chaque fichier de `db/`, `integrity_check`, le nombre de fiches et de comptes, le nombre de lignes de chaque table, les empreintes du contenu telles que le site les calcule (celles de l'attestation de la production et de `bascule.sh constat`), le marqueur `db/source`, la présence, les droits et la taille de chaque secret (jamais leur valeur), les réglages des sauvegardes, le nombre de certificats.
Si c'est **`DIFFERENCE`**, les lignes en cause sont listées. Deux écarts sont attendus, et se contrôlent :

- `fichier.copies.nombre` avec `nouveau : 0` : l'archive a été faite sans `--avec-copies`.
- `secret.normal..env` et `secret.test..env`, quand seule la taille grandit : `instances.sh` (8d) a ajouté au `.env` d'un ancien serveur les clés qui lui manquaient. Ce contrôle n'affiche que des noms de clés, jamais une valeur (remplace le nom de l'archive) :

```
A=~/demenagement-AAAAMMJJ-HHMMSS.tar.gz
for i in normal:maverick-center test:maverick-center-test; do
  echo "== ${i%%:*} : lignes de l'ancien disparues ou changées"
  comm -23 <(tar -xzOf "$A" "./${i%%:*}/.env" | LC_ALL=C sort) <(sudo LC_ALL=C sort "/srv/${i#*:}/.env") | sed 's/=.*//'
  echo "== ${i%%:*} : clés ajoutées"
  comm -13 <(tar -xzOf "$A" "./${i%%:*}/.env" | LC_ALL=C sort) <(sudo LC_ALL=C sort "/srv/${i#*:}/.env") | sed 's/=.*//'
done
```

Attendu : rien sous « disparues ou changées » ; sous « clés ajoutées », au plus `MAVERICK_INSTANCE` (les deux instances), `MAVERICK_DOSSIER_METRIQUES` (normal) et `MAVERICK_DOSSIER_PRODUCTION` (test). Elles nomment ce que le service déduisait déjà : la même instance et les mêmes dossiers.

Pour **tout autre écart** : **arrête-toi, ne démarre rien, colle l'écran** (le nouveau serveur n'a encore rien démarré : rien n'est perdu, l'ancien se dégèle comme à l'étape 5).

**Retour arrière (avant le DNS) :** idem étape 5. Le nouveau serveur n'a servi à rien, l'ancien n'a pas bougé.

### 9. Démarrer le nouveau et l'essayer sans toucher au DNS

```
cd /srv/maverick-center && sudo docker compose up -d
cd /srv/maverick-center-test && sudo docker compose up -d
sudo docker ps
```

Attendu : quatre conteneurs (`nginx` et `serveur`, pour chaque instance), « Up ». Au bout d'une minute :

Sur `ssh maverick-nouveau` :

```
sudo bash ~/vps/controle-demenagement.sh bilan --contenu-seulement --sortie ~/bilan-demarre.txt
```
```
bash ~/vps/controle-demenagement.sh comparer ~/bilan-ancien.txt ~/bilan-demarre.txt
```

**Kit de l'atelier (bascule 2 seulement), avant l'atelier** : l'archive n'emporte jamais `atelier/kit/`. Celui du nouveau serveur est donc celui de l'installateur de l'étape 3, souvent plus ancien que la version déballée, et l'atelier refabriquerait les pages avec le code d'une autre version. L'installateur gardé de l'ancien serveur (« kit seul », arrivé dans `installateur-courant/`) remet le kit à la bonne version, sans toucher à `db/` ni aux pages. Sur `ssh maverick-nouveau` :

```
TAG=$(sudo sed -n 's/^tag=//p' /srv/maverick-center-test/VERSION)
sudo sh /srv/maverick-center-test/installateur-courant/maverick-center-$TAG-install.sh --dossier /srv/maverick-center-test
```

Attendu : « Installateur « kit seul » », « Kit de l'atelier posé », puis « Installé : <tag>, 0 pages » (0 : les pages déballées restent en place). Sinon, arrête-toi et colle l'écran.

**Atelier et interrupteur (bascule 2 seulement), après ce contrôle** : le service du site de dev tourne, l'atelier se remet en route. Sur `ssh maverick-nouveau` :

```
sudo sh /srv/maverick-center-test/atelier/installer.sh --sans-fabrication
sudo sh /srv/maverick-center-test/atelier/installer.sh --servir
sudo sh /srv/maverick-center-test/atelier/installer.sh --etat
```

La première reprend les réglages venus de l'archive (`atelier/reglages.env` : `MEMOIRE_MAX_KO`, `BESOIN_KO`, `DISQUE_MIN_KO`, `DELAI_S`, `CPUS`, `GOOGLE_CLIENT_ID`), prépare l'image Docker du kit, pose les unités systemd et `docker-compose.override.yml` (le service du site de dev redémarre quelques secondes) ; la deuxième pose l'interrupteur (déjà là, venu de l'archive) et le minuteur de contenu (toutes les 10 minutes), qui refabrique dès qu'il passe : la première fabrication part donc dans les 10 minutes, avant le DNS (le site de l'archive reste servi tant qu'elle n'a pas posé le sien) ; la première commande pose aussi les minuteurs de nuit et du jour. Attendu : « Kit : version … » avec la version du site de dev de l'ancien serveur, « Site servi par l'atelier : OUI » et la ligne « Mémoire maintenant » qui finit par « la fabrication démarrerait ». Un refus de mémoire se règle comme au README (« Atelier du site de dev »), avec la valeur que la ligne propose.

**Retour arrière (atelier) :** `sudo sh /srv/maverick-center-test/atelier/installer.sh --retirer`.

**Pourquoi la même version d'abord :** on contrôle et on démarre la base de l'ancien serveur telle quelle, avec le code qui l'a écrite ; la mise à jour (migrations, règles livrées depuis) est ensuite un second changement, fait sur une base déjà prouvée égale, et qui se défait par l'archive.

Attendu : `EGALITE`, ou les seuls écarts `secret.*..env` déjà contrôlés en 8f. Le service tourne : ce bilan lit chaque base par un instantané SQLite (jamais une copie d'octets) et ne compare **que ce qui ne bouge pas** : `integrity_check`, le nombre de fiches et de comptes, l'empreinte du contenu des règles, le marqueur `db/source`, les secrets. Les fichiers, les nombres de lignes de chaque table (sessions, journaux) et l'empreinte « logique » changent dès le démarrage : ils ne sont **pas** comparés (le service ne réécrit la base que s'il doit la refaire pour une version ou des règles différentes : avec la même version, il n'y touche pas). `fiches`, `comptes` ou `contenu` différents : **arrête-toi, colle l'écran** (le DNS n'a pas encore bougé : `docker compose stop serveur`, dégeler l'ancien).

**Essai avant DNS**, depuis PowerShell (`<adresse du nouveau serveur>` : ton alias ne sert pas à `curl`) :

```
curl.exe --resolve maverick-jdr.com:443:<adresse du nouveau serveur> -I https://maverick-jdr.com/
curl.exe --resolve dev.maverick-jdr.com:443:<adresse du nouveau serveur> -I https://dev.maverick-jdr.com/
curl.exe --resolve dev.maverick-jdr.com:443:<adresse du nouveau serveur> https://dev.maverick-jdr.com/api/etat/
```

Attendu : `HTTP/2 200` (les deux premières), et un JSON pour la troisième, avec `"source":true` dans la partie `base` (le marqueur du site de dev est posé). Cet essai marche sans attendre parce que les certificats de Caddy sont venus avec l'archive. Si TLS échoue (« schannel » / « certificate »), Caddy n'a pas pu les relire : passe à l'étape suivante, il les obtiendra tout seul dès que le DNS pointera ici (1 à 2 minutes).

**Retour arrière (avant le DNS) :** `docker compose stop serveur` dans les deux dossiers du nouveau serveur, puis dégeler l'ancien (étape 5). Les fiches enregistrées sur le nouveau serveur depuis le démarrage n'existent que là : si quelqu'un a écrit pendant l'essai (personne ne connaît l'adresse), voir « Retour arrière après le DNS ».

### 10. Changer le DNS

Chez le gestionnaire de la zone, pour `maverick-jdr.com` (la racine), `www` et `dev` : remplacer l'**A** par l'adresse IPv4 du nouveau serveur. Pour les **AAAA** : si le nouveau serveur a une adresse IPv6 **qui répond** (`curl.exe -6 -I https://maverick-jdr.com --resolve …` ou `ping -6`), la mettre ; sinon **supprimer les trois AAAA** : un AAAA qui resterait vers l'ancien enverrait une partie des visiteurs sur un serveur gelé.

Puis, sur ton poste (PowerShell) : `nslookup maverick-jdr.com` et `nslookup dev.maverick-jdr.com` jusqu'à voir la nouvelle adresse (5 minutes au plus, TTL de 300 s ; certains résolveurs mettent plus). Sur `ssh maverick-nouveau` : `sudo journalctl -u caddy -n 30` ne doit pas montrer d'erreur de certificat.

**Retour arrière (après le DNS)** : remettre les anciennes valeurs du DNS (noté à l'étape 4). Ce qui a été écrit sur le nouveau serveur depuis la bascule (fiches des joueurs, modifications du site de dev) **serait perdu** si on revient sans le rapatrier : le rapatrier d'abord, avec les mêmes scripts dans l'autre sens (section « Retour arrière complet »). Tant que ça n'est pas dit au propriétaire, on ne revient pas à l'ancien après des écritures.

### 11. Vérifier, puis remettre en route les tâches automatiques

Sur `ssh maverick-nouveau`.

```
sudo rm -f /srv/maverick-center/GELER /srv/maverick-center-test/GELER
sudo crontab -e
```

Dans l'éditeur, ajoute les deux lignes (README, étape 6) :

```
*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh
*/5 * * * * sh /srv/maverick-center-test/mise-a-jour.sh
```

Essai à blanc d'une mise à jour : `sudo sh /srv/maverick-center-test/mise-a-jour.sh` — attendu dans la sortie : « déjà installé » ou « rien à faire » (ou l'installation d'une version plus récente si une est sortie : normal).

Sauvegardes :

```
sudo bash /srv/maverick-center-test/sauvegarde/installer.sh --verifier-le-stockage
sudo bash /srv/maverick-center-test/sauvegarde/installer.sh
sudo bash /srv/maverick-center-test/sauvegarde/installer.sh --essai
```

Attendu : le stockage « joignable, clé acceptée, écriture possible » ; les trois minuteurs posés (`systemctl list-timers 'maverick-sauvegarde-*'`) ; un essai de restauration réussi, sans qu'on te demande de phrase ni d'accès (ils sont venus avec `/etc/maverick-sauvegardes/`). **Si une question est posée : arrête-toi, colle l'écran.** Tu peux aussi laisser le minuteur du soir faire la première sauvegarde et regarder la page Debug le lendemain.

Contrôles de fonctionnement : ouvrir les deux sites, se connecter au site de dev par Discord (niveau Créateur), enregistrer une fiche de test sur le site de dev (puis la supprimer), regarder la page Debug (alertes, dernière sauvegarde). Pour les sessions de Claude : la clé de lecture n'a pas changé (elle est dans `secrets/acces.json`, transféré), et le domaine non plus.

**Retour arrière (étape 11) :** `sudo touch /srv/maverick-center*/GELER`, retirer les deux lignes du crontab, `sudo bash /srv/maverick-center-test/sauvegarde/installer.sh --retirer` ; puis, si besoin, revenir comme à l'étape 10 (DNS), après avoir rapatrié les écritures (« Retour arrière complet »).

En bascule 2, la page Debug du site de dev (bloc « Atelier ») montre le rapport de la première fabrication, lancée à l'étape 9 : elle doit finir sans refus (mémoire, disque et nombre de pages sont ceux que l'atelier contrôle). Sans bascule 2, l'atelier ne s'installe que s'il l'était sur l'ancien serveur (`sudo sh /srv/maverick-center-test/atelier/installer.sh`, README, section « Atelier »). `maverick-volume.timer` est déjà posé par `instances.sh`.

### 12. L'ancien serveur : le rendre inoffensif, puis l'arrêter

Danger à éviter : un `docker compose up` ou un minuteur lancé **par erreur** sur l'ancien ferait démarrer une base périmée qui accepterait des écritures (deux bases vivantes). Sur `ssh maverick-ancien` :

```
sudo systemctl disable --now maverick-sauvegarde-horaire.timer maverick-sauvegarde-nuit.timer maverick-sauvegarde-essai.timer
sudo systemctl disable --now maverick-atelier.path maverick-atelier-nuit.timer maverick-atelier-jour.timer maverick-atelier-contenu.timer
sudo mv /srv/maverick-center/docker-compose.yml /srv/maverick-center/docker-compose.yml.demenage
sudo mv /srv/maverick-center-test/docker-compose.yml /srv/maverick-center-test/docker-compose.yml.demenage
```

Les fichiers `GELER` y restent, le crontab reste en commentaire. Après une heure (les derniers résolveurs ont suivi le DNS), arrête Caddy de l'ancien : `sudo systemctl disable --now caddy`.

**Retour arrière (étape 12) :** `sudo mv …/docker-compose.yml.demenage …/docker-compose.yml` (les deux instances), `sudo systemctl enable --now caddy`, les trois minuteurs des sauvegardes et ceux de l'atelier, retirer `GELER`, remettre les lignes du crontab, `sudo docker compose up -d`, puis remettre le DNS ; l'ancien serveur est tel qu'au moment du gel (écritures faites sur le nouveau depuis : à rapatrier d'abord).

**Ne rien effacer pendant au moins 7 jours** : l'ancien serveur entier (ses bases gelées, identiques à celles du déménagement) et l'archive `demenagement-*.tar.gz` restent en l'état. Au bout de plusieurs jours sans incident (une sauvegarde de nuit réussie chaque nuit, un essai de restauration vert, les fiches des joueurs présentes) :
1. effacer l'archive des deux serveurs et ses restes (`sudo rm -f ~/demenagement-*.tar.gz ~/demenagement-*.tar.gz.partiel ~/bilan-*.txt`) : elle porte tous les secrets ; et de ton poste s'il y est passé ;
2. effacer ce que le déballage a mis de côté ou laissé après une panne sur le nouveau serveur (`sudo ls -d /srv/maverick-center*/*.avant-demenagement-* /srv/maverick-center*/*/*.avant-demenagement-* /srv/maverick-center*/*.nouveau-*`, vérifier la liste, puis la même liste avec `sudo rm -rf`) ;
3. arrêter l'ancien serveur chez son hébergeur (ne le résilie que quand tu es sûr : il n'y a aucune urgence).

## Retour arrière complet (après le DNS : rapatrier ce qui a été écrit)

Les scripts marchent dans les deux sens (la répétition le joue). Il faut d'abord **geler le nouveau** (étape 5, sur `maverick-nouveau`), puis, **sur l'ancien** (rends-lui d'abord ses fichiers : `docker-compose.yml.demenage` → `docker-compose.yml`, minuteurs et Caddy relancés) :

```
sudo bash ~/vps/demenagement.sh emballer --sans sauvegardes,caddy        # sur le nouveau, gelé
# scp -3 maverick-nouveau:demenagement-….tar.gz maverick-ancien:         # depuis ton poste
cd /srv/maverick-center && sudo mv db db.avant-retour-AAAAMMJJ && sudo mkdir db      # sur l'ancien : sa base est mise de côté, jamais effacée
cd /srv/maverick-center-test && sudo mv db db.avant-retour-AAAAMMJJ && sudo mkdir db
sudo bash ~/vps/demenagement.sh deballer --sans sauvegardes,caddy,copies ~/demenagement-….tar.gz
```

Puis le contrôle (bilans des deux côtés), le démarrage, le DNS remis. **Ce qui serait perdu :** rien de ce qui est dans l'archive du retour ; les mises à jour installées sur le nouveau serveur depuis l'étape 11 sont rejouées par le cron de l'ancien ; avant de rapatrier, le déballage exige la même version des deux côtés (code 4, installateur à lancer).

## Sauvegardes : serveur et copie chez le même fournisseur (note)

La décision R308 (qui remplace R275 (1)) garde le serveur et la copie extérieure **chez OVH**, pour n'avoir qu'un compte à transmettre lors d'une passation : rien à changer après le déménagement. Le stockage reste sur **un autre site** que le serveur, pour qu'un incident sur un site n'emporte pas les deux. Risque accepté : un compte OVH piraté, suspendu ou impayé touche les deux. Précautions : double authentification sur le compte, phrase de chiffrement gardée hors d'OVH et transmise à la passation (sans elle, personne ne relit les sauvegardes).

**Pour changer de stockage un jour** : créer un bucket compatible S3 (région au choix, clé d'accès limitée à ce bucket, lecture et écriture), puis `sudo bash /srv/maverick-center-test/sauvegarde/installer.sh --stockage --adresse <adresse S3> --bucket <bucket> --region <région>` (la phrase de chiffrement est gardée), puis `--verifier-le-stockage`. Le nouveau dépôt recevra une première sauvegarde complète la nuit suivante ; garde l'ancien bucket plusieurs semaines (l'historique y reste lisible avec la même phrase) ; `restic copy --from-repo` est facultatif (README, « Changer de stockage »).

## La coupure : une estimation honnête

- **Pour les joueurs : de 30 à 60 minutes** sans enregistrement de fiche, sans connexion au site de dev (étape 5 → fin de la propagation du DNS). **Les pages restent lisibles** pendant le gel (nginx de l'ancien), puis du nouveau dès qu'il sert. Quelques résolveurs trop tenaces peuvent encore envoyer des visiteurs sur l'ancien (pages lisibles, `/api/` en 502) jusqu'à une heure.
- **Pour toi : ~2 heures** d'attention, dont le transfert (2 à 15 minutes selon ton débit montant : l'archive pèse quelques centaines de Mo, de quoi tenir sur un débit ordinaire), les empreintes (quelques dizaines de secondes par bilan), `up -d` (1 minute) et la propagation (5 minutes en général). Le plus long est de lire attentivement chaque écran.
- Elle repose sur la taille des bases (une base vivante ~25 Mo, archives ≤ ~125 Mo par instance, `docs/serveur.md`) et sur les trois derniers installateurs gardés par instance (~97 Mo chacun pour le test, kit compris ; ~35 Mo pour la production) ; en bascule 2, les pages et les paquets s'y ajoutent. Elle **n'a pas été mesurée sur le vrai serveur**.

## Vérifié dans le dépôt (le jour où ça a été préparé)

- **GitHub** : aucun workflow ne dépend de l'adresse du serveur, seulement du **domaine** (`dev.maverick-jdr.com`, variable `MISE_A_JOUR_HOTE`, défaut dans `mise-a-jour.yml`), qui ne change pas. Les secrets `MAVERICK_EXTRAIT_CLE` (clé de lecture du site de dev, dans `secrets/acces.json`, transféré) et `MAVERICK_CONTENU_CHIFFREMENT` (phrase de chiffrement du contenu de la CI) ne dépendent pas de l'hôte. Aucun workflow n'ouvre de connexion SSH : la clé d'hôte SSH du nouveau serveur ne touche que ton poste (première connexion : `yes`, étape 1).
- **TLS** : le certificat est lié au domaine ; il vient avec l'archive, ou Caddy le redemande tout seul après le DNS. Les sessions de Claude lisent le site en HTTPS par le domaine : rien à changer.
- **Attestation de la production** (`attestation-prod.json`) : écrite par le service dans `metriques/` (transféré), refaite à chaque démarrage et toutes les heures ; elle ne dépend pas de l'hôte. Elle sert au constat de `bascule.sh` (déjà passé) et à l'onglet « Mise à jour ».
- **Jeton de la page Mise à jour** (`secrets/github-actions-token`) et jeton de lecture des installateurs (`.github-token`) : transférés ; s'ils ne marchent plus (jeton expiré), README, étapes 6 et 7.

## Ce que la répétition n'imite pas

Elle joue les scripts de bout en bout (gel refusé puis accepté, y compris une unité de l'atelier active ou une activation à moitié faite, emballage d'un monde en bascule 2 (interrupteurs, paquets, activation sans son kit ni `base-avant/`, réglages et interrupteur de l'atelier, pages, `VERSION` posée sur un serveur installé dans une autre version, `db/gel.json` non emporté), archive altérée ou tronquée refusée, base déjà présente jamais écrasée, déballage, EGALITE, DIFFERENCE, retour arrière) sur deux dossiers jetables, avec une vraie base SQLite et de vraies empreintes du site. **Non imités** : systemd (les minuteurs sont un faux `systemctl`), Docker (`docker compose ps` est un faux, et les empreintes du site sont calculées par `node` de l'hôte au lieu du conteneur : `docker compose run … serveur node …` n'est donc pas éprouvé ici), Caddy et les certificats réels (des fichiers factices), `chown` vers `root`/`caddy` et vers `maverick-site` (la répétition ne tourne pas en root ; la présence de l'utilisateur n'y est pas exigée), `atelier/installer.sh` (unités systemd, image Docker, `docker-compose.override.yml`), l'activation d'une production par `activer.sh`, `scp -3`, le DNS, les installateurs, les versions réelles de paquets, le temps réel de transfert. Le premier vrai lancement de `demenagement.sh` et du bilan avec Docker est celui du jour J : c'est pourquoi `deballer --a-blanc` et le bilan de l'étape 6 se jouent avant tout geste irréversible, et pourquoi l'ancien n'est jamais touché.
