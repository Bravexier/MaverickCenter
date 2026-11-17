---
name: zone-hebergement-atelier
description: "Atelier du site de dev et kit de l'installateur de test : deploy/installateur/atelier/ (installer.sh, lancer.sh, lib.sh), kit.mjs, kit-pose.sh, marque et unité systemd, garde-fou 20, plafonds de mémoire et de disque. À charger avant de lire, modifier ou relire ces fichiers ou leurs tests."
paths: ["deploy/installateur/atelier/**", "deploy/installateur/kit.mjs", "deploy/installateur/kit-pose.sh", "client/test/deploy-atelier.test.mjs", "client/test/deploy-kit.test.mjs"]
user-invocable: false
---
# Atelier du site de dev et kit (`deploy/installateur/atelier/`, `kit*`)

Le reste de `deploy/` (installateurs, VPS, sauvegardes, accès) : skill `zone-hebergement`.

## À lire
- `docs/serveur.md`, « Atelier du site de dev » (qui fait quoi, mémoire, rapports) ; `deploy/vps/README.md`, « Atelier du site de dev » (le geste) ; `docs/api.md`, « Fabrication témoin ».
- Ce que le site fabrique : skill `zone-service-extrait`. Côté service : skill `zone-service`. Page Debug : skill `zone-debug-metriques`.

## Le kit (installateur de test seulement)
- `fabriquer.mjs --kit` (refusé en prod) le fabrique (`kit.mjs`) et l'emporte ; `kit-pose.sh` est inséré à la ligne `@@KIT@@` du modèle, retirée en prod : le script de prod reste identique à celui d'avant le kit.
- Il se pose dans `<instance>/atelier/kit/`, hors de `site/` (jamais servi), par renommage, un seul kit gardé.
- Aucun contenu (R275, question 6) : un contrôle refuse le kit s'il contient `data/rows`, `sources/raw`, un `.db`, `src/content/wiki` ou un lien qui sort du kit.
- Élagage selon la règle de npm (`os`, `cpu`, `libc` déclarés par chaque paquet), sans liste de noms.
- L'image de l'atelier est `kit.json#image`, de la libc du kit : Debian slim (glibc), jamais Alpine (musl) pour un kit fait par GitHub.
- La pose ne bloque jamais l'installation : place insuffisante (2 × la taille décompressée + 256 Mo) ou échec, l'installation continue sans kit et le dit au journal.

## L'atelier
- Scripts : `atelier/installer.sh` est le seul geste du propriétaire ; `atelier/outils/{lancer,lib,conteneur}.sh` sont livrés par l'installateur de test, qui n'efface jamais le kit, le travail, la sortie, les rapports ni les réglages (seuls `--retirer` et le ménage de `lancer.sh` le font).
- Déclenchement : la marque `atelier/declencheur/marque`, posée par l'installateur (root), réveille l'unité systemd `.path`, puis `.service` (nice, ionice), dans la tranche `maverick-atelier.slice` (`CPUWeight` et `IOWeight` à 20, `--cgroup-parent`) où le pic de mémoire est relevé. `lancer.sh` refuse de tourner si lui-même ou son dossier n'appartient pas à root.
- Une seule fabrication à la fois (`flock`).
- Minuteurs (même geste, déclenchés par l'horloge seulement, jamais par le site de dev) : la nuit à 04:30 (origine `nuit`, tient lieu de contrôle de nuit tant que celui-ci n'existe pas) ; le jour, toutes les 20 min de 8 h à 20 h (origine `journee_type`), seulement pendant la fenêtre `--jours-de-mesure`, sous 10 fabrications dans la journée et à plus de 40 min de la précédente. `--max-par-jour` plafonne toutes les origines, livraisons comprises. Toute fabrication passe par le même chemin (verrou, refus, plafonds). `--retirer` retire aussi les minuteurs. Une fabrication de nuit ou de journée type mémorise la marque de livraison avant de commencer et la relit en sortant : si elle a changé, un tour de plus avec l'origine `livraison`, dans la limite des tours et du plafond du jour. 40 rapports gardés.
- Sonde (`maverick-sonde/1`) pendant la fabrication : `curl` sur 127.0.0.1, au plus 1 requête par seconde et par instance, délai de 5 s ; elle s'arrête si la production répond mal. Root ne garde que le code et la durée, jamais le corps. Un `.env` monté en écriture dans un conteneur est refusé (le port s'y lit). Cibles : `/` et `/api/personnages/`. User-Agent `maverick-atelier-sonde/1` (`SONDE_AGENT`). Le mot de passe interne (`/etc/caddy/maverick.env`) passe par `curl -K -` sur stdin, jamais en argument.
- Garde-fou 20 (aucun programme root n'obéit au site de dev) :
  - root n'écrit jamais dans `db/`, `metriques/` ni `maintenance/` ;
  - le service dépose l'extrait dans `<instance>/atelier/depot/` (dossier à root créé par le geste ; jamais par `db/`) : la surcharge le monte dans le service en lecture-écriture sur `/atelier-depot`, l'atelier en lecture seule sur `/contenu`. Le service ne voit de `atelier/` que `depot` (rw) et `rapports` (ro), jamais un parent : la source d'un montage n'est jamais un chemin que le service peut changer ;
  - seul `conteneur.sh`, dans le conteneur sans privilège, ouvre l'extrait : il refuse une FIFO ou un fichier irrégulier (73), un fichier trop gros ou vide (74), un délai dépassé (75). Root ne fait qu'un `stat` (fichier régulier non lien, plafond 512 Mo), comme filtre sans attente ;
  - root n'interprète pas les JSON du conteneur : il les copie tels quels, seulement après `docker rm -f`, sous `timeout`, à 256 Ko au plus, et seulement un fichier régulier non lien ;
  - le conteneur : `--network none`, `--read-only`, `--cap-drop ALL`, `no-new-privileges`, utilisateur 65534 ; aucun montage de `db/`, `metriques/`, `maintenance/`, `secrets/` ni du socket Docker.
- Mémoire : plafond = min(maximum réglable, 2,5 Go par défaut ; `MemAvailable` / 2). Refus si le plafond est sous le besoin (1,5 Go), ou si la marge de la production est sous max(1 Go, 25 % de `MemTotal`). Disque : refus sous le minimum (2 Go par défaut), surveillé aussi pendant la fabrication : le conteneur est alors arrêté (mesure `disque_insuffisant`).
- Un refus, un `OOMKilled` ou un délai dépassé est une mesure écrite dans un rapport, jamais une relance.
- `docker-compose.override.yml` n'est écrit et retiré que par le geste de l'atelier ; l'installateur n'y touche jamais. Le `docker-compose.yml` commun ne parle pas de l'atelier : la production est inchangée.

## Tests
- `deploy-kit` (kit, contrôle sans contenu, élagage, pose, script de prod identique), `deploy-atelier` (scripts de l'atelier).
