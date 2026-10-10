# Hébergement sur un serveur (VPS) : serveur normal et serveur de test

Met en place, sur un serveur Ubuntu/Debian neuf (écrits pour Ubuntu 26.04 chez Infomaniak ; contrôlés ici — syntaxe, `instances.sh` exécuté avec de faux outils — mais **pas encore lancés sur le vrai serveur** :
le premier lancement est le vrai test), les deux instances décrites dans [`docs/flux-git.md`](../../docs/flux-git.md) :

| | Adresse | Branche | Port interne | Base `db/` |
| --- | --- | --- | --- | --- |
| **Serveur normal** | `https://maverick-jdr.com` | `master` | `127.0.0.1:8080` | `/srv/maverick-center/db`, jamais touchée par une installation |
| **Serveur de test** | `https://dev.maverick-jdr.com` | `dev` | `127.0.0.1:8081` | `/srv/maverick-center-test/db` : copie de celle du normal **à la première installation seulement**, puis **conservée** (`MAVERICK_BASE_TEST=conservee`) |

Le site est posé par les [installateurs](../installateur/README.md) (un par fusion, publiés en *release* GitHub dès la version 0.2.0,
`PREMIERE_VERSION_HEBERGEE` dans `tools/flux-git/regles.mjs`). Caddy fait le HTTPS et aiguille vers l'instance selon l'adresse.

**Accès pour le PoC (décision du propriétaire)** : pas de mot de passe, adresse non référencée (en-tête `X-Robots-Tag`, `robots.txt`), comme les
Google Docs actuels. Les instances restent protégées en interne par un mot de passe que **Caddy présente à la place des visiteurs** : ils ne le
voient pas, mais les ports 8080 et 8081 ne servent à rien en direct. À la connexion Discord, on retire ce mécanisme (voir l'en-tête du `Caddyfile`).

| Fichier | Rôle |
| --- | --- |
| `durcir.sh` | Mises à jour de sécurité automatiques, SSH par clé uniquement, pare-feu (22, 80, 443), fail2ban |
| `outils.sh` | Docker (+ compose), Caddy, `robots.txt` |
| `instances.sh` | Les deux dossiers d'instance (`.env` avec ports sur `127.0.0.1`), mots de passe internes, `Caddyfile` et son environnement |
| `Caddyfile` | `maverick-jdr.com` → 8080, `dev.maverick-jdr.com` → 8081, `www.` → domaine principal |

## Avant de commencer

1. **DNS** (OVH, zone de `maverick-jdr.com`) : des enregistrements **A** (IPv4) et **AAAA** (IPv6) vers le serveur pour le domaine lui-même, `www` et **`dev`**.
   Caddy obtient son certificat HTTPS seulement quand l'adresse pointe vers le serveur (sinon il réessaie sans succès).
2. **Accès SSH par clé** au serveur (compte `ubuntu` chez Infomaniak). Le pare-feu d'Infomaniak peut rester tel quel ; `durcir.sh` règle celui du serveur.
3. Ces fichiers sur votre ordinateur (cloner le dépôt, ou télécharger la branche en zip).

## 1. Copier ce dossier sur le serveur

Depuis votre ordinateur, dans le dossier du dépôt (Windows : invite de commandes ; `scp` est fourni avec Windows) :

```
scp -i .ssh\maverick_key -r deploy\vps ubuntu@<IP>:~/
```

Puis, sur le serveur : `ssh -i .ssh\maverick_key ubuntu@<IP>`.

## 2. Durcir le serveur

```
sudo bash ~/vps/durcir.sh
```

**Gardez cette fenêtre ouverte**, ouvrez-en une deuxième et vérifiez qu'une **nouvelle** connexion par clé fonctionne avant de fermer la première.
Le script refuse de désactiver le mot de passe s'il ne trouve aucune clé installée.

## 3. Installer Docker et Caddy

```
sudo bash ~/vps/outils.sh
```

## 4. Préparer les deux instances et Caddy

```
sudo bash ~/vps/instances.sh
```

Les mots de passe internes sont créés au hasard, écrits dans `/etc/caddy/maverick.env` (lisible par root seulement) et dans le `.htpasswd` de
chaque instance ; rien n'est affiché. Relancer le script les conserve (`--regenerer-acces` pour les refaire). Autre domaine : `--domaine exemple.org`.

## 5. Poser le site (les deux installateurs)

1. Dans GitHub, page **Releases** du dépôt (privé : connexion nécessaire), télécharger les deux fichiers de la dernière version :
   `maverick-center-vX.Y.Z-install.sh` (normal) et `maverick-center-vX.Y.Z-test-install.sh` (test).
2. Les copier sur le serveur : `scp -i .ssh\maverick_key maverick-center-*-install.sh ubuntu@<IP>:~/`
3. Sur le serveur, **le normal d'abord** (le test en copie la base) :

```
sudo sh ~/maverick-center-vX.Y.Z-install.sh --dossier /srv/maverick-center
sudo sh ~/maverick-center-vX.Y.Z-test-install.sh --dossier /srv/maverick-center-test
cd /srv/maverick-center && sudo docker compose up -d
cd /srv/maverick-center-test && sudo docker compose up -d
```

Ouvrir `https://maverick-jdr.com` et `https://dev.maverick-jdr.com` (bandeau « Serveur de test »).

## 6. Mises à jour automatiques

Chaque instance contient `mise-a-jour.sh` : il prend la dernière *release* de son mode et l'installe. Il lui faut un jeton GitHub en lecture seule
(*Settings → Developer settings → Fine-grained tokens*, dépôt `MaverickCenter` seulement, permission *Contents : Read-only*), **déposé directement
sur le serveur** (jamais dans une conversation ni dans git) :

```
sudo sh -c "printf '%s' 'COLLEZ_LE_JETON_ICI' > /srv/maverick-center/.github-token && chmod 600 /srv/maverick-center/.github-token"
sudo sh -c "printf '%s' 'COLLEZ_LE_JETON_ICI' > /srv/maverick-center-test/.github-token && chmod 600 /srv/maverick-center-test/.github-token"
sudo sh /srv/maverick-center/mise-a-jour.sh          # essai à la main (journal : mise-a-jour.log)
sudo crontab -e                                       # puis ajouter :
*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh
*/5 * * * * sh /srv/maverick-center-test/mise-a-jour.sh
```

Chaque fusion dans `dev` met à jour le serveur de test dans les 5 minutes, chaque livraison `dev` → `master` met à jour le serveur normal. La base du
test n'est pas touchée par ces mises à jour ; celle du normal non plus. Un fichier `GELER` dans le dossier d'une instance suspend ses mises à jour.

## Vérifier

```
curl -sI https://maverick-jdr.com | head -n 3             # HTTP/2 200
curl -sI https://dev.maverick-jdr.com | head -n 3         # HTTP/2 200, cache-control: no-store
curl -s https://maverick-jdr.com/robots.txt               # Disallow: /
curl -s -m 5 -o /dev/null -w '%{http_code}\n' http://<IP>:8080/   # doit échouer : le port est fermé de l'extérieur
sudo docker ps                                            # les 4 conteneurs (nginx et service, normal et test)
sudo systemctl status caddy
```

## Sauvegardes (à faire avant d'y mettre de vraies données)

`db/` de chaque instance est la seule donnée qui ne se reconstruit pas (voir [`docs/serveur.md`](../../docs/serveur.md)). En attendant une sauvegarde
automatique vers un stockage extérieur (prochaine étape) :

```
sudo sqlite3 /srv/maverick-center/db/vivante.db ".backup /root/vivante-$(date +%F).db"
```

## En cas de problème

| Symptôme | Piste |
| --- | --- |
| Certificat HTTPS impossible | L'adresse ne pointe pas encore vers le serveur (DNS) : `sudo journalctl -u caddy -n 50` |
| 401 sur le site | Les mots de passe de Caddy et de l'instance ne concordent plus : `sudo bash ~/vps/instances.sh --regenerer-acces` puis `docker compose restart` dans les deux dossiers |
| 502 | L'instance n'est pas lancée : `cd /srv/maverick-center && sudo docker compose up -d` |
| Revenir à une version précédente | Voir [`deploy/installateur/README.md`](../installateur/README.md), « Revenir à une version précédente » (fichier `GELER`) |
| Verrouillé hors du serveur | Console VNC d'Infomaniak (page du serveur) |
