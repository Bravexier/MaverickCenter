# Héberger le site sur un NAS

Le site est un dossier de pages statiques, servi par nginx, accompagné d'un petit **service** (Node) qui enregistre les fiches de personnages
dans sa base, `db/` (mode client / serveur : [`docs/serveur.md`](../docs/serveur.md)). Le code du service arrive avec le site (`site/_serveur/`).
Ce dossier contient tout pour les faire tourner dans Docker (Synology *Container Manager*, QNAP *Container Station*, Unraid, TrueNAS, ou tout hôte
Docker) : deux conteneurs, `maverick-center` (nginx) et `maverick-center-serveur` (le service).

> Ce paquet est l'installation du NAS, jusqu'à la 1.0. À partir de la 1.0, la solution sera hébergée et installée par les
> installateurs autonomes de [`installateur/`](installateur/README.md) (serveur normal et serveur de test).

> Le contenu des pages appartient au propriétaire du jeu. La configuration fournie protège donc l'accès par mot de passe
> et interdit l'indexation par les moteurs de recherche. Ne la désactivez pas sans son accord.

## Démarrage (avec Docker)

1. Décompressez `maverick-center-nas.zip` dans un dossier du NAS, par exemple `docker/maverick-center/`.
2. Créez le fichier de mots de passe (remplacez `invite` et `MotDePasse` ; `openssl` suffit) :
   ```bash
   printf 'invite:%s\n' "$(openssl passwd -apr1 'MotDePasse')" > .htpasswd
   ```
   Plusieurs comptes : ajoutez une ligne par compte avec `>>`.
3. Lancez : `docker compose up -d`, puis ouvrez `http://IP-DU-NAS:8080` et connectez-vous.

Sur Synology : *Container Manager → Projet → Créer*, choisissez le dossier décompressé : il détecte `docker-compose.yml`.

Le dossier `db/` (créé au premier lancement) contient la base vivante du service : **les fiches enregistrées**. C'est la seule donnée qui ne se
reconstruit pas : sauvegardez-le (par exemple avec *Hyper Backup*), de préférence conteneur `maverick-center-serveur` arrêté.

## Passage au mode client / serveur (une seule fois, NAS installé avant ce changement)

`update-nas.sh` ne met à jour que `site/` : il apporte le code du service, mais pas la nouvelle configuration. Une fois :

1. Remplacez `docker-compose.yml` et `nginx.conf` dans le dossier du projet par ceux du dépôt (dossier `deploy/` sur GitHub : ouvrir le fichier,
   *Download raw file*, puis le déposer avec *File Station* à la place de l'ancien). Gardez `.htpasswd`, `.github-token` et `site/`.
2. Relancez le projet : `docker compose up -d` (Synology : *Container Manager → Projet → maverick-center → Action → Compiler*). Le conteneur
   `maverick-center-serveur` apparaît ; il attend que `site/_serveur/` existe (prochaine mise à jour du site) puis crée `db/vivante.db`.
3. Vérifiez : `http://IP-DU-NAS:8080/api/etat/` doit afficher l'état du service (`"disponible":true`).

Ensuite, plus rien à faire à la main : le service se relance seul quand une mise à jour du site apporte une nouvelle version de son code, et
refait sa base quand les règles changent, sans perdre les fiches (voir `docs/serveur.md`).

## Sans Docker

Servez le dossier `site/` avec le serveur web du NAS (Synology *Web Station*, par exemple) et activez un mot de passe
d'accès dans ses réglages : la lecture fonctionne. L'enregistrement des fiches demande en plus le service (Node.js ≥ 22.13 :
`node site/_serveur/serveur/index.mjs`, voir ses variables dans `docs/serveur.md`) et un renvoi de `/api/` vers lui (port 8787).

## Accès depuis l'extérieur du réseau local

N'ouvrez pas simplement un port du routeur vers le NAS. Préférez, par ordre de simplicité :
un VPN du type **Tailscale** (le propriétaire installe l'application et voit le site comme s'il était chez vous),
un **Cloudflare Tunnel**, ou le **proxy inversé du NAS avec HTTPS** (certificat Let's Encrypt) en gardant le mot de passe.

## Sous-chemin

Si le site doit répondre sur une adresse du type `https://nas.exemple/maverick/`, reconstruisez-le avec
`SITE_BASE=/maverick/ ./deploy/build.sh` et faites pointer le proxy inversé vers le conteneur.

## Mise à jour automatique après chaque PR fusionnée

```
PR fusionnée dans dev ──▶ GitHub Actions : tests + construction ──▶ branche « site » (privée)
                                                                         ▲
                              NAS : update-nas.sh (toutes les 5 min) ────┘  connexions sortantes uniquement
```

Aucun port à ouvrir : c'est le NAS qui interroge GitHub. Le workflow (`.github/workflows/livraison.yml`, job « Site », jusqu'à la 1.0 :
voir `docs/flux-git.md`) refuse de publier si le dépôt n'est plus privé.

### Mise en place (une seule fois)

1. **Créer un jeton GitHub** : *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   Propriétaire : votre compte ; *Repository access* : **Only select repositories → MaverickCenter** ;
   *Permissions → Repository permissions → Contents : Read-only*. Durée : 90 jours (à renouveler).
2. **Le déposer sur le NAS**, dans le dossier du projet (celui qui contient `docker-compose.yml`), lisible par `root` uniquement :
   ```bash
   printf '%s' 'COLLEZ_LE_JETON_ICI' > .github-token && chmod 600 .github-token
   ```
   Ne le collez jamais dans une conversation, un fichier du dépôt ou un journal.
3. **Premier essai à la main** : `sh update-nas.sh`. Il télécharge la version publiée et remplace le contenu de `site/`
   (journal dans `update.log`). Avant la première fusion, l'erreur « branche pas encore créée » est normale.
4. **Planifier toutes les 5 minutes** :
   - Synology : *Panneau de configuration → Planificateur de tâches → Créer → Tâche planifiée → Script défini par l'utilisateur*,
     utilisateur `root`, toutes les 5 minutes, commande `sh /volume1/docker/maverick-center/update-nas.sh` (adaptez le chemin) ;
   - autre NAS ou Linux : `crontab -e` puis `*/5 * * * * sh /chemin/vers/update-nas.sh`.

### Ce que fait le script

- Compare la version installée (`.installed-sha`) à la dernière de la branche « site » ; s'il n'y a rien de neuf, il s'arrête.
- Télécharge exactement cette version, refuse une archive vide ou incomplète (pas de `index.html`, moins de 20 pages)
  et ne touche alors **pas** au site en place.
- Remplace le contenu de `site/` (avec `rsync` s'il existe, sinon par copie), sans redémarrer nginx.
- Un jeton expiré ou un problème réseau n'abîme rien : le site reste tel quel et `update.log` indique l'erreur.
- `sh update-nas.sh --force` réinstalle même si la version est déjà à jour. Les réglages (`REPO`, `BRANCH`, `SITE_DIR`…)
  se placent dans un fichier facultatif `update-nas.env` à côté du script.

### Entretien

- Le jeton expire : en créer un nouveau et remplacer le contenu de `.github-token`. Le journal le signale
  (« impossible de lire la dernière version… »).
- Pour construire une version à la main (sans GitHub) : `./deploy/build.sh` produit un nouveau zip complet.

## Ce qui a été vérifié

Le site statique est construit et testé (tests unitaires, contrôle navigateur). Le script `update-nas.sh` est testé contre un
faux serveur GitHub (`client/test/update-nas.test.mjs`), le service par `client/test/serveur-*.test.mjs`. `docker-compose.yml` et `nginx.conf` ont été
lancés avec Docker dans l'environnement de développement (le 2026-10-10 : mot de passe, pages, `/api/`, `/_serveur/` refusé, relance du service sur une
nouvelle version, base refaite quand les règles changent, site servi service arrêté). Le contact avec le vrai GitHub depuis un NAS n'a pas pu l'être :
le premier lancement sur le NAS reste le vrai test.
