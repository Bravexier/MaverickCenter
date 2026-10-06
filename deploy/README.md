# Héberger le site sur un NAS

Le site est **100 % statique** : un dossier de fichiers HTML à servir avec n'importe quel serveur web.
Ce dossier contient tout pour le faire tourner avec nginx dans Docker (Synology *Container Manager*,
QNAP *Container Station*, Unraid, TrueNAS, ou tout hôte Docker).

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

## Sans Docker

Servez le dossier `site/` avec le serveur web du NAS (Synology *Web Station*, par exemple) et activez un mot de passe
d'accès dans ses réglages. Aucun module serveur n'est nécessaire (pas de PHP, pas de base de données).

## Accès depuis l'extérieur du réseau local

N'ouvrez pas simplement un port du routeur vers le NAS. Préférez, par ordre de simplicité :
un VPN du type **Tailscale** (le propriétaire installe l'application et voit le site comme s'il était chez vous),
un **Cloudflare Tunnel**, ou le **proxy inversé du NAS avec HTTPS** (certificat Let's Encrypt) en gardant le mot de passe.

## Sous-chemin

Si le site doit répondre sur une adresse du type `https://nas.exemple/maverick/`, reconstruisez-le avec
`SITE_BASE=/maverick/ ./deploy/build.sh` et faites pointer le proxy inversé vers le conteneur.

## Mise à jour automatique après chaque PR fusionnée

```
PR fusionnée dans main ──▶ GitHub Actions : tests + construction ──▶ branche « site » (privée)
                                                                         ▲
                              NAS : update-nas.sh (toutes les 5 min) ────┘  connexions sortantes uniquement
```

Aucun port à ouvrir : c'est le NAS qui interroge GitHub. Le workflow (`.github/workflows/publish-site.yml`) refuse de publier
si le dépôt n'est plus privé. Il ne tourne qu'une fois présent sur `main` : tant que la première PR n'est pas fusionnée,
la branche « site » n'existe pas et le script le signale (« pas encore créée »).

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
faux serveur GitHub (`client/test/update-nas.test.mjs`). Ni la configuration nginx, ni `docker-compose.yml`, ni le contact avec le
vrai GitHub depuis un NAS n'ont pu être exécutés dans l'environnement de développement : le premier lancement sur le NAS est le vrai test.
