---
name: zone-hebergement-atelier
description: "Atelier du site de dev et kit de l'installateur de test : deploy/installateur/atelier/ (installer.sh, lancer.sh, lib.sh, conteneur.sh), kit.mjs, kit-pose.sh, verrou-*.sh, poser-un-site.mjs, marque, unité systemd, garde-fou 20, plafonds de mémoire et de disque, interrupteur servir. À charger avant de lire, modifier ou relire ces fichiers ou leurs tests."
paths: ["deploy/installateur/atelier/**", "deploy/installateur/kit.mjs", "deploy/installateur/kit-pose.sh", "deploy/installateur/verrou-*.sh", "client/scripts/poser-un-site.mjs", "client/test/deploy-atelier*.test.mjs", "client/test/deploy-kit.test.mjs", "client/test/kit-suffit-au-build.test.mjs", "client/test/poser-un-site.test.mjs"]
user-invocable: false
---
# Atelier du site de dev et kit (`deploy/installateur/atelier/`, `kit*`)

Le reste de `deploy/` (installateurs, VPS, sauvegardes, accès, activation) : skill `zone-hebergement`.

## À lire
- `docs/serveur.md`, « Atelier du site de dev » et « Bascule 2 : préparation », PR 3b (qui fait quoi, mémoire, rapports, pose) ; `deploy/vps/README.md`, « Atelier du site de dev » (le geste) ; `docs/api.md`, « Fabrication témoin ».
- Ce que le site fabrique : skill `zone-service-extrait`. Côté service : skill `zone-service`. Page Debug : skill `zone-debug-metriques`.

## Le kit (installateur de test)
- `fabriquer.mjs --kit` le fabrique (`kit.mjs`) et l'emporte ; `kit-pose.sh` est inséré à la ligne `@@KIT@@`, retirée en prod : le script de prod reste le modèle, octet pour octet.
- Posé dans `<instance>/atelier/kit/`, hors de `site/` (jamais servi), par renommage, un seul kit gardé. La pose ne bloque jamais l'installation (place : 2 × la taille décompressée + 256 Mo ; échec : elle continue sans kit et le dit au journal).
- **Tout fichier que lit le build doit être dans `kit.mjs#A_EMPORTER`** (et `INDISPENSABLES`) : la CI, qui a tout le dépôt, ne voit pas autrement un fichier manquant. Exemple : `sources/copies-drive.json` (lu par `lib/archives.mjs`).
- Aucun contenu (R275, question 6) : un contrôle refuse le kit s'il contient `data/rows`, `sources/raw`, un `.db`, `src/content/wiki` ou un lien qui sort du kit. Élagage selon la règle de npm (`os`, `cpu`, `libc`), sans liste de noms.
- `kit.json` : `image` (`kit.json#image`, Debian slim, glibc, jamais Alpine pour un kit fait par GitHub), `paquet` (`{ lot, version, empreinte, structure }` tiré de `data/paquet.json`, `null` s'il manque ; illisible : le kit n'est pas fabriqué) et `structure` (`PRAGMA user_version` du `schema.sql` du kit) : le garde-fou 17 les lit.
- L'installateur de test prend le verrou de l'atelier (`flock` sur `atelier/.verrou`, 45 min d'attente au plus, puis il continue en le disant) pendant la seule pose de `site/`, si `atelier/` existe : repères `@@VERROU_DEBUT@@`/`@@VERROU_FIN@@`, vides en prod.

## L'atelier
- `atelier/installer.sh` est le seul geste du propriétaire ; `atelier/outils/{lancer,lib,conteneur}.sh` sont livrés par l'installateur de test, qui n'efface jamais le kit, le travail, la sortie, les rapports ni les réglages (seuls `--retirer` et le ménage de `lancer.sh` le font).
- Déclenchement : la marque `atelier/declencheur/marque` (root) réveille l'unité `.path`, puis `.service` (nice, ionice), dans la tranche `maverick-atelier.slice` (`CPUWeight` et `IOWeight` à 20, `--cgroup-parent`). `lancer.sh` refuse de tourner si lui-même ou son dossier n'est pas à root. Une seule fabrication à la fois (`flock`).
- Minuteurs (l'horloge seule, jamais le site de dev) : nuit 04:30 (origine `nuit`) ; jour, toutes les 20 min de 8 h à 20 h (`journee_type`), pendant `--jours-de-mesure`, sous 10 fabrications et à plus de 40 min de la précédente. `--max-par-jour` plafonne toutes les origines **sauf `contenu`**. Une fabrication de nuit ou de journée type relit la marque en sortant : changée, un tour de plus (`livraison`). Rapports : ceux du jour UTC jamais effacés (les plafonds les comptent), plus les 100 plus récents des jours d'avant.
- Bilan : compté sur les rapports qui suivent le dernier geste (`installe.json#installe_le`) ; l'origine `contenu` est hors bilan.
- Sonde (`maverick-sonde/1`) : `curl` sur 127.0.0.1, au plus 1 requête par seconde et par instance, délai 5 s, arrêt si la production répond mal ; root ne garde que le code et la durée. Le port se lit `MAVERICK_PORT=<port>` ou `MAVERICK_PORT=127.0.0.1:<port>` dans le `.env` de l'instance (fichier régulier à root, jamais monté en écriture dans un conteneur : `env_monte`) ; le motif de chaque instance non sondée est gardé. User-Agent `maverick-atelier-sonde/1` (`SONDE_AGENT`) ; cibles `/` et `/api/personnages/` ; le mot de passe interne (`/etc/caddy/maverick.env`) passe par `curl -K -`, jamais en argument.
- Garde-fou 20 (aucun programme root n'obéit au site de dev) :
  - root n'écrit jamais dans `db/`, `metriques/` ni `maintenance/` ;
  - le service dépose l'extrait dans `<instance>/atelier/depot/` (dossier à root, jamais par `db/`) : monté en lecture-écriture dans le service sur `/atelier-depot`, en lecture seule dans l'atelier sur `/contenu`. Le service ne voit de `atelier/` que `depot` (rw) et `rapports` (ro) ;
  - seul `conteneur.sh`, dans le conteneur sans privilège, ouvre l'extrait : FIFO ou fichier irrégulier (73), trop gros ou vide (74), délai (75). Root ne fait qu'un `stat` (fichier régulier non lien, 512 Mo au plus) ;
  - root copie les JSON du conteneur sans les interpréter, après `docker rm -f`, sous `timeout`, 256 Ko au plus, fichier régulier non lien ;
  - conteneur de fabrication : `--network none`, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, utilisateur `65534:65534` ; aucun montage de `db/`, `metriques/`, `maintenance/`, `secrets/` ni du socket Docker.
- Le conteneur fabrique dans `/travail/site` (même montage que le kit : Astro déplace par `rename`, `EXDEV` d'un montage à l'autre), compare, puis copie vers `/sortie/site` (code 76 si la copie échoue). `conteneur.sh` accepte deux variables sans effet pour l'atelier, pour la répétition de la bascule 2 (skill `zone-hebergement`) : `CONTENU_FICHIER`, `MODE_REPETITION`.
- Image sans `git` et message d'échec : skill `zone-service-extrait`. `lancer.sh` garde la fin de `docker logs` (200 Ko) dans `rapports/<id>/journal-du-conteneur.txt` : lecture humaine, jamais servi par le service.
- Mémoire : plafond = min(maximum réglable, 2,5 Go ; `MemAvailable` / 2). Besoin par défaut **1,1 Go** (`lib.sh#DEFAUT_BESOIN_KO` = 1153433 ; l'ancien 1,5 Go n'est plus repris par le geste, `ANCIEN_DEFAUT_BESOIN_KO`, sauf `--besoin` explicite). Refus `memoire_insuffisante` sous le besoin, `marge_insuffisante` si la marge de la production est sous max(1 Go, 25 % de `MemTotal`). `installer.sh --etat` chiffre le refus avec le geste qui le lève. Disque : refus sous le minimum (2 Go), surveillé aussi pendant la fabrication (`disque_insuffisant`).
- Un refus, un `OOMKilled` ou un délai dépassé est une mesure écrite dans un rapport, jamais une relance.
- `docker-compose.override.yml` n'est écrit et retiré que par le geste de l'atelier ; le `docker-compose.yml` commun ne parle pas de l'atelier.

## L'atelier sert ce qu'il fabrique (éteint par défaut)
- Interrupteur : `<instance>/atelier/servir` (root), posé par `installer.sh --servir [--pages-minimum <pct>]`, retiré par `--ne-plus-servir` (et `--retirer`) ; il exige un kit qui porte `poser-un-site.mjs` et **`db/source`** (sinon refus `pas_de_base_source` : chaque pose changerait la base vivante). Sans lui rien de servi ne change : `site/` intact, aucun second conteneur, `"servi": null` (test : octet pour octet).
- Seulement après une fabrication réussie, root lance un **conteneur de pose** (même image, sans réseau, `--read-only`, `--cap-drop ALL`, 512 Mo, 128 processus, 600 s) sous l'uid du propriétaire de `site/` (0 du conteneur, sans capacité, sur le serveur). Il ne voit que : le kit et `sortie` (lecture seule), `site/` (écriture) avec **`site/_serveur` remonté en lecture seule et jamais touché**, `pose/`. `_serveur` absent ou lien : `site_absent`. Root ne lit pas la sortie du conteneur ; il copie `pose.json` après `docker rm -f` (256 Ko, non interprété).
- `poser-un-site.mjs` : `lstat` partout, aucun lien suivi ; refus 81 (`index.html` absent), 82 (`site_trop_petit` : moins de 90 % des pages du site servi), 83 (fichier irrégulier), 84 (`_serveur` dans la source), 85 (source illisible) ; échec en cours : 86. Copie provisoire puis `rename`, identique non réécrit, ce que le nouveau site n'a pas est retiré.
- Minuteur `maverick-atelier-contenu.timer` (posé par `--servir`) : root ne compare que le `stat` de l'extrait à `declencheur/dernier-contenu`, écrit seulement après une pose réussie. Plafond propre `MAX_CONTENU_PAR_JOUR` (48). Un refus déterministe (`site_trop_petit`, `fichier_irregulier`, `serveur_dans_la_source`) est noté dans `dernier-contenu` comme une pose réussie ; `--servir` l'efface. « Le bouton » : `POST /api/edition/atelier/` (skill `zone-service`).

## Tests
- `deploy-kit` (kit, contrôle sans contenu, élagage, pose, script de prod identique), `deploy-atelier`, `deploy-atelier-conteneur` (scripts et conteneur), `poser-un-site`, `kit-suffit-au-build` (le kit fabriqué par `fabriquerLeKit` est décompressé hors du dépôt et sert à un vrai build, `scripts/fabriquer-depuis-contenu.mjs` comme `conteneur.sh` ; un 2ᵉ build donne les mêmes pages).
