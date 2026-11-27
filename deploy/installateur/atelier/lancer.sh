#!/bin/sh
# Une fabrication de l'atelier du site de dev (lot 9 du chantier « la base du site de dev devient la source de vérité » ; docs/serveur.md, « Atelier du site de dev »).
# Lancé en root par systemd (maverick-atelier.service) quand l'installateur de test change la marque <instance>/atelier/declencheur/marque, ou à la main par le geste du
# propriétaire (installer.sh). Il fabrique un site témoin depuis l'extrait du contenu de la base de dev, dans un conteneur Docker sans réseau, le compare au site/ livré par
# GitHub, mesure, puis écrit un rapport dans <instance>/atelier/rapports/<AAAAMMJJ-HHMMSS>/ (root en est propriétaire ; le service les lit en lecture seule).
#
# Garde-fou 20 du plan : rien de ce que le site de dev peut écrire ne commande ce programme. Le déclencheur est la marque de l'installateur (root, livraison GitHub),
# dans un dossier où seul root écrit. Root n'écrit jamais dans db/ et n'OUVRE jamais un fichier d'un dossier que le service ou le conteneur peut toucher : le service
# est root de conteneur avec CAP_MKNOD sur le dépôt qu'il écrit, il peut y poser une FIFO (root resterait bloqué), un nœud de périphérique (root lirait l'hôte) ou un lien sur un dossier
# (suivi). Root ne fait donc sur l'extrait que des `stat` (existence, type, taille : jamais d'ouverture, jamais de blocage) ; c'est le conteneur, sans privilège, qui l'ouvre
# (conteneur.sh : dépôt monté en lecture seule, copie sous `timeout`). Il n'interprète aucun fichier du conteneur : il copie fabrication.json et comparaison.json
# (fichiers réguliers, plafond de taille, sous `timeout`) APRÈS avoir supprimé le conteneur, donc quand plus rien ne peut les changer ; c'est le service qui les lit.
#
# Une seule fabrication à la fois (flock). Les marques qui arrivent pendant une fabrication se fondent : à la fin, la marque est relue et seule la dernière version compte.
# Avant de démarrer, la mémoire est mesurée (MemTotal, MemAvailable) : plafond = min(maximum réglé, MemAvailable / 2) ; refus si le plafond est sous le besoin (1,1 Go par défaut), ou si la marge
# laissée à la production (MemAvailable - plafond) est sous max(1 Go, 25 % de MemTotal) ; refus aussi sous le minimum d'espace libre. Un refus est une mesure : le rapport
# dit les chiffres relevés (disponible, besoin, plafond, marge). Un conteneur arrêté par manque de mémoire (OOMKilled) est une mesure aussi : jamais de relance silencieuse.
set -eu
umask 022

# L'origine de la fabrication : « livraison » (la marque de l'installateur, par l'unité .path), « nuit » (le minuteur de 04:30), « journee_type » (le minuteur du jour) ou « contenu » (le minuteur
# de 10 minutes du site servi, posé par `installer.sh --servir`) ; les trois derniers n'ont pas de marque nouvelle : ils refont une fabrication de la version installée, sous les mêmes règles
# (verrou, refus de mémoire et de disque, plafonds). « contenu » ne fabrique que si l'interrupteur <atelier>/servir est posé ET si l'extrait a changé depuis le dernier site posé.
#
# Le site servi (lot 11 « Bascule 2 », PR 3b ; docs/serveur.md, « Bascule 2 : préparation »). Avec l'interrupteur <atelier>/servir (un fichier de root, posé par `installer.sh --servir`) et une fabrication
# réussie, le site fabriqué est posé à la place du site servi, JAMAIS par root qui lirait la sortie du conteneur : un second conteneur (même image, sans réseau, en lecture seule, sans capacité,
# sans nouveau privilège, la sortie en lecture seule, <instance>/site en écriture) lance le script du kit client/scripts/poser-un-site.mjs, qui refuse liens, FIFO et fichiers irréguliers, pose
# chaque fichier de façon atomique, retire ce que le nouveau site n'a pas et ne touche jamais _serveur/. Root ne lit que ce qu'il connaît : le code de sortie du conteneur, `stat` de l'extrait,
# le fichier VERSION ; son résumé (pose.json) est copié tel quel après `docker rm`, sous le même plafond que les autres résultats, et le service le valide. Sans l'interrupteur, rien de servi ne change.
ORIGINE=livraison
while [ $# -gt 0 ]; do
  case "$1" in
    --origine) [ $# -ge 2 ] || { echo "Usage : lancer.sh [--origine livraison|nuit|journee_type|contenu]" >&2; exit 2; }; ORIGINE=$2; shift 2 ;;
    *) echo "Usage : lancer.sh [--origine livraison|nuit|journee_type|contenu]" >&2; exit 2 ;;
  esac
done
case "$ORIGINE" in livraison|nuit|journee_type|contenu) ;; *) echo "origine inconnue : « $ORIGINE »" >&2; exit 2 ;; esac

ICI=$(cd "$(dirname "$0")" && pwd -P)
[ -f "$ICI/lib.sh" ] || { echo "lib.sh introuvable à côté de lancer.sh" >&2; exit 1; }
# shellcheck source=lib.sh
. "$ICI/lib.sh"
ATELIER=$(cd "$ICI/.." && pwd -P)
INSTANCE=$(dirname "$ATELIER")
RAPPORTS=$ATELIER/rapports
REGLAGES=$ATELIER/reglages.env
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
MARQUE=$ATELIER/declencheur/marque
JOURNAL_DE_LA_MARQUE=$ATELIER/declencheur/derniere-marque
SERVIR=$ATELIER/servir
DERNIER_CONTENU=$ATELIER/declencheur/dernier-contenu
servir_actif() { [ -f "$SERVIR" ] && [ ! -L "$SERVIR" ]; }

log() { echo "$(maintenant_iso) atelier : $*"; }
refuser_de_demarrer() { log "$*"; exit 0; }

# ---------------------------------------------------------------- ce que root accepte de faire tourner
# Le programme, son dossier et celui de l'atelier : à root, jamais modifiables par un autre (le service n'en voit qu'un montage en lecture seule).
if [ "$ESSAI" != 1 ]; then
  [ "$(id -u)" -eq 0 ] || { echo "À lancer en root (systemd)." >&2; exit 1; }
  for chemin in "$ATELIER" "$ICI" "$ICI/lancer.sh" "$ICI/lib.sh"; do
    proprietaire=$(stat -c '%u' "$chemin" 2>/dev/null || echo x)
    droits=$(stat -c '%a' "$chemin" 2>/dev/null || echo 777)
    [ "$proprietaire" = 0 ] && [ $((0$droits & 022)) -eq 0 ] || { echo "ERREUR : $chemin n'appartient pas à root ou est modifiable par un autre : refus." >&2; exit 1; }
  done
fi

# Une instance de test seulement, avec le geste du propriétaire fait (le fichier de réglages est la preuve) : sinon rien à faire, sans bruit.
mode=$(sed -n 's/^mode=//p' "$INSTANCE/VERSION" 2>/dev/null | head -n 1)
[ "$mode" = test ] || refuser_de_demarrer "pas d'atelier : $INSTANCE n'est pas une instance de test."
[ -f "$REGLAGES" ] || refuser_de_demarrer "atelier non installé : $REGLAGES est absent (sudo sh $ATELIER/installer.sh)."
[ -f "$MARQUE" ] || refuser_de_demarrer "aucune marque de l'installateur : rien à fabriquer."
if [ "$ORIGINE" = contenu ] && ! servir_actif; then refuser_de_demarrer "origine contenu : l'interrupteur $SERVIR n'est pas posé, le site n'est pas servi par l'atelier : rien à faire."; fi

command -v flock >/dev/null 2>&1 || { echo "ERREUR : flock est absent (util-linux)." >&2; exit 1; }
exec 9>"$ATELIER/.verrou"
flock -n 9 || refuser_de_demarrer "une fabrication est déjà en cours : la marque sera relue à sa fin."

# ---------------------------------------------------------------- réglages (relus champ par champ)
reglage() { # nom défaut
  valeur=$(champ_du_fichier "$REGLAGES" "$1")
  if entier_positif "$valeur"; then printf '%s' "$valeur"; else printf '%s' "$2"; fi
}
MEMOIRE_MAX_KO=$(reglage MEMOIRE_MAX_KO "$DEFAUT_MEMOIRE_MAX_KO")
BESOIN_KO=$(reglage BESOIN_KO "$DEFAUT_BESOIN_KO")
DISQUE_MIN_KO=$(reglage DISQUE_MIN_KO "$DEFAUT_DISQUE_MIN_KO")
DELAI_S=$(reglage DELAI_S "$DEFAUT_DELAI_S")
CPUS=$(champ_du_fichier "$REGLAGES" CPUS)
valide_cpus "$CPUS" 2>/dev/null || CPUS=$DEFAUT_CPUS
GOOGLE=$(champ_du_fichier "$REGLAGES" GOOGLE_CLIENT_ID | tr -cd 'A-Za-z0-9._-' | cut -c1-128)
INTERVALLE=${MAVERICK_ATELIER_INTERVALLE:-1}
ATTENTE=${MAVERICK_ATELIER_ATTENTE:-300}
MAX_PAR_JOUR=$(reglage MAX_PAR_JOUR "$DEFAUT_MAX_PAR_JOUR")
MAX_CONTENU_PAR_JOUR=$(reglage MAX_CONTENU_PAR_JOUR "$DEFAUT_MAX_CONTENU_PAR_JOUR")
# le seuil des pages (0 à 100 %) vient du fichier de l'interrupteur, écrit par root ; une autre valeur vaut le défaut
PAGES_MINIMUM_PCT=$(champ_du_fichier "$SERVIR" PAGES_MINIMUM_PCT)
case "$PAGES_MINIMUM_PCT" in ''|*[!0-9]*) PAGES_MINIMUM_PCT=$DEFAUT_PAGES_MINIMUM_PCT ;; *) [ "$PAGES_MINIMUM_PCT" -le 100 ] || PAGES_MINIMUM_PCT=$DEFAUT_PAGES_MINIMUM_PCT ;; esac
JOURS_DE_MESURE=$(reglage JOURS_DE_MESURE "$DEFAUT_JOURS_DE_MESURE")
MESURE_DEPUIS=$(reglage MESURE_DEPUIS 0)
DOSSIER_PROD=$(champ_du_fichier "$REGLAGES" DOSSIER_PROD)
[ -n "$DOSSIER_PROD" ] || DOSSIER_PROD=$(dirname "$INSTANCE")/maverick-center

# ---------------------------------------------------------------- une marque à la fois
CID=''
DEBUT_MS=0
en_ms() { # date +%s%N, sinon des secondes
  nano=$(date +%s%N 2>/dev/null || true)
  case "$nano" in ''|*[!0-9]*) echo $(($(date +%s) * 1000)) ;; *) echo $((nano / 1000000)) ;; esac
}
SONDE_DIR=''
nettoyer() {
  if [ -n "$CID" ]; then docker rm -f "$CID" >/dev/null 2>&1 || true; fi
  rm -f "$RAPPORTS/en-cours.json"
  if [ -n "$SONDE_DIR" ]; then rm -rf "$SONDE_DIR"; fi
}
trap nettoyer EXIT
trap 'exit 1' INT TERM HUP

marque_valide() { # lit la marque : VERSION_INSTALLEE, TAG, COMMIT (formats stricts) ; code 1 sinon
  VERSION_INSTALLEE=$(sed -n 's/^version=\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$/\1/p' "$MARQUE" | head -n 1)
  TAG=$(sed -n 's/^tag=\([vV][0-9][0-9A-Za-z.-]*\)$/\1/p' "$MARQUE" | head -n 1)
  COMMIT=$(sed -n 's/^commit=\([0-9a-f]\{7,40\}\|local\)$/\1/p' "$MARQUE" | head -n 1)
  [ -n "$VERSION_INSTALLEE" ] && [ -n "$TAG" ]
}

# ---------------------------------------------------------------- le rapport (écrit par root : des nombres et des mots connus)
ID=''
ecrire_le_rapport() { # issue [motif]
  issue=$1
  motif=${2:-}
  dossier=$RAPPORTS/$ID
  mkdir -p "$dossier"
  fin=${FIN_MS:-$(en_ms)}
  duree=$((fin - DEBUT_MS))
  fichier=$dossier/.rapport.json.$$
  {
    printf '{\n'
    printf '  "format": "maverick-atelier/1",\n  "id": "%s",\n  "origine": "%s",\n' "$ID" "$ORIGINE"
    printf '  "issue": "%s",\n  "motif": %s,\n' "$issue" "$(json_texte "$motif")"
    printf '  "horodatage": "%s",\n' "$HORODATAGE"
    printf '  "version_installee": %s,\n  "version_du_kit": %s,\n  "tag": %s,\n' "$(json_texte "$VERSION_INSTALLEE")" "$(json_texte "${VERSION_KIT:-}")" "$(json_texte "$TAG")"
    printf '  "serveur": { "processeurs": %s, "memoire_totale_ko": %s, "memoire_disponible_ko": %s, "disque_total_ko": %s, "disque_libre_ko": %s, "charge": [%s, %s, %s] },\n' \
      "$(json_nombre "$NPROC")" "$(json_nombre "$MEM_TOTAL_KO")" "$(json_nombre "$MEM_DISPO_KO")" "$(json_nombre "$DISQUE_TOTAL_KO")" "$(json_nombre "$DISQUE_LIBRE_KO")" \
      "$(json_nombre "$CHARGE_1")" "$(json_nombre "$CHARGE_5")" "$(json_nombre "$CHARGE_15")"
    printf '  "reglages": { "memoire_max_ko": %s, "besoin_ko": %s, "cpus": %s, "disque_min_ko": %s, "delai_s": %s },\n' \
      "$(json_nombre "$MEMOIRE_MAX_KO")" "$(json_nombre "$BESOIN_KO")" "$(json_nombre "$CPUS")" "$(json_nombre "$DISQUE_MIN_KO")" "$(json_nombre "$DELAI_S")"
    printf '  "plafond_ko": %s,\n  "marge_ko": %s,\n  "duree_ms": %s,\n  "code_sortie": %s,\n' "$(json_nombre "${PLAFOND_KO:-}")" "$(json_nombre "${MARGE_KO:-}")" "$(json_nombre "$duree")" "$(json_nombre "${CODE_SORTIE:-}")"
    printf '  "memoire": { "pic_ko": %s, "source": %s },\n  "cpu_ms": %s,\n' "$(json_nombre "${PIC_KO:-}")" "$(json_texte "${SOURCE_DU_PIC:-}")" "$(json_nombre "${CPU_MS:-}")"
    printf '  "place": { "kit_ko": %s, "travail_ko": %s, "sortie_ko": %s },\n' "$(json_nombre "${KIT_KO:-}")" "$(json_nombre "${TRAVAIL_KO:-}")" "$(json_nombre "${SORTIE_KO:-}")"
    printf '  "sonde": %s,\n' "$(sonde_json)"
    printf '  "servi": %s,\n' "${SERVI_JSON:-null}"
    printf '  "fabrication": %s,\n  "comparaison": %s\n}\n' "$(json_booleen "${A_FABRICATION:-0}")" "$(json_booleen "${A_COMPARAISON:-0}")"
  } > "$fichier"
  mv -f "$fichier" "$dossier/rapport.json"
  log "rapport $ID : $issue${motif:+ ($motif)} ; plafond ${PLAFOND_KO:-?} ko, marge ${MARGE_KO:-?} ko, mémoire disponible ${MEM_DISPO_KO:-?} ko, disque libre ${DISQUE_LIBRE_KO:-?} ko."
  # ne garder que les derniers rapports (des dossiers de la forme AAAAMMJJ-HHMMSS, rien d'autre) : ceux du jour UTC ne s'effacent JAMAIS (les plafonds du jour les comptent), plus les RAPPORTS_GARDES plus anciens
  aujourdhui=$(date -u -d "@$(epoch_maintenant)" '+%Y%m%d')
  anciens=$(ls -1 "$RAPPORTS" | grep -E '^[0-9]{8}-[0-9]{6}$' | grep -v "^$aujourdhui-" | sort -r | tail -n +"$((RAPPORTS_GARDES + 1))" || true)
  for ancien in $anciens; do rm -rf "${RAPPORTS:?}/$ancien"; done
}

# ---------------------------------------------------------------- la sonde des temps de réponse (pendant chaque fabrication)
# Des requêtes en lecture seule, sur 127.0.0.1, aux ports des deux instances (prod et site de dev), pour mesurer ce que la fabrication fait à la production : une référence
# d'environ 30 s avant, puis pendant, puis une phase après. Deux cibles publiques, valables sur les deux instances : une page statique (« / », nginx) et une route de lecture de l'API
# (« /api/personnages/ », la liste des prétirés, qui ne fait que lire la base ; sur le site de dev, fermé par la connexion Discord (R310), « /api/etat/ », l'état du service, resté ouvert). Au plus une requête par seconde et par instance, 5 s de délai. Garde-fou 20 : root ne garde que le code HTTP
# et le temps (`-o /dev/null`, `-w`) ; il n'interprète ni ne stocke jamais le corps d'une réponse. Trois mauvaises réponses de suite de la production arrêtent la sonde, sans insister.
# Le port se lit dans le .env de chaque instance (écrit par l'installateur) : refusé s'il est dans un dossier monté en écriture dans un conteneur (le service pourrait l'avoir changé) ;
# la sonde note alors « sonde impossible » pour cette instance.
sonde_montages_en_ecriture() { # écrit les dossiers montés en écriture dans un conteneur, un par ligne ; code 1 si Docker ne répond pas
  : > "$SONDE_DIR/montages-rw"
  docker ps -q > "$SONDE_DIR/conteneurs" 2>/dev/null || return 1
  [ ! -s "$SONDE_DIR/conteneurs" ] || docker inspect -f '{{range .Mounts}}{{if .RW}}{{println .Source}}{{end}}{{end}}' $(cat "$SONDE_DIR/conteneurs") > "$SONDE_DIR/montages-rw" 2>/dev/null || return 1
}
sonde_lire_le_port() { # dossier_de_l_instance -> le port ; code 1 : pas de .env ; 2 : monté en écriture ou non fiable ; 3 : illisible
  env=$1/.env
  [ -f "$env" ] && [ ! -L "$env" ] || return 1
  if [ "$ESSAI" != 1 ]; then
    [ "$(stat -c '%u' "$env" 2>/dev/null || echo x)" = 0 ] && [ $((0$(stat -c '%a' "$env" 2>/dev/null || echo 777) & 022)) -eq 0 ] || return 2
  fi
  reel=$(cd "$1" && pwd -P)
  while read -r source; do
    [ -n "$source" ] || continue
    case "$reel/" in "${source%/}"/*) return 2 ;; esac
  done < "$SONDE_DIR/montages-rw"
  # `MAVERICK_PORT=<port>` ou `MAVERICK_PORT=127.0.0.1:<port>` (la forme des instances du serveur) ; aucun autre hôte
  port=$(sed -n 's/^MAVERICK_PORT=\(127\.0\.0\.1:\)\{0,1\}\([0-9][0-9]*\)$/\2/p' "$env" | head -n 1)
  case "$port" in ''|*[!0-9]*) return 3 ;; esac
  [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || return 3
  printf '%s' "$port"
}
sonde_lire_l_acces() { # cle -> « invite:… » en base64, ou rien (le mot de passe interne que Caddy présente : /etc/caddy/maverick.env, à root)
  fichier=${MAVERICK_ATELIER_ACCES:-/etc/caddy/maverick.env}
  [ -f "$fichier" ] && [ ! -L "$fichier" ] || return 0
  if [ "$ESSAI" != 1 ]; then
    [ "$(stat -c '%u' "$fichier" 2>/dev/null || echo x)" = 0 ] && [ $((0$(stat -c '%a' "$fichier" 2>/dev/null || echo 777) & 077)) -eq 0 ] || return 0
  fi
  sed -n "s/^$1=\([A-Za-z0-9+\/=]\{8,256\}\)\$/\1/p" "$fichier" | head -n 1
}
sonde_preparer() {
  SONDE_MOTIF=''
  if [ -n "$SONDE_DIR" ]; then rm -rf "$SONDE_DIR"; fi
  SONDE_DIR=$(mktemp -d "$ATELIER/.sonde.XXXXXX") || { SONDE_DIR=''; SONDE_MOTIF=dossier_de_travail; return 0; }
  chmod 700 "$SONDE_DIR"
  : > "$SONDE_DIR/mesures"
  SONDE_ACCES_PROD=''; SONDE_ACCES_DEV=''
  if ! command -v curl >/dev/null 2>&1; then SONDE_MOTIF=curl_absent; return 0; fi
  if ! sonde_montages_en_ecriture; then SONDE_MOTIF=montages_illisibles; return 0; fi
  for etiquette in prod dev; do
    if [ "$etiquette" = prod ]; then dossier_instance=$DOSSIER_PROD; cle=MAVERICK_ACCES_NORMAL; else dossier_instance=$INSTANCE; cle=MAVERICK_ACCES_TEST; fi
    if [ ! -d "$dossier_instance" ]; then printf 'introuvable' > "$SONDE_DIR/motif.$etiquette"; continue; fi
    if port=$(sonde_lire_le_port "$dossier_instance"); then
      printf '%s' "$port" > "$SONDE_DIR/port.$etiquette"
      acces=$(sonde_lire_l_acces "$cle")
      if [ "$etiquette" = prod ]; then SONDE_ACCES_PROD=$acces; else SONDE_ACCES_DEV=$acces; fi
      [ -z "$acces" ] || : > "$SONDE_DIR/authentifie.$etiquette"
    else
      case $? in 1) m=env_absent ;; 2) m=env_monte ;; *) m=port_illisible ;; esac
      printf '%s' "$m" > "$SONDE_DIR/motif.$etiquette"
    fi
  done
  [ -f "$SONDE_DIR/port.prod" ] || [ -f "$SONDE_DIR/port.dev" ] || SONDE_MOTIF=sonde_impossible
  return 0
}
# Une requête vers une instance, en alternant les deux cibles : « phase etiquette code ms erreur » est ajouté aux mesures (rien d'autre n'est gardé de la réponse).
sonde_mesurer() { # phase étiquette
  [ -n "$SONDE_DIR" ] && [ -f "$SONDE_DIR/port.$2" ] && [ ! -f "$SONDE_DIR/arret.$2" ] && [ ! -f "$SONDE_DIR/arret.prod-degradee" ] || return 0
  port=$(cat "$SONDE_DIR/port.$2")
  tour_de_sonde=$(cat "$SONDE_DIR/tour.$2" 2>/dev/null || echo 0)
  echo $((tour_de_sonde + 1)) > "$SONDE_DIR/tour.$2"
  if [ "$2" = prod ]; then cibles=$SONDE_CIBLES; acces=$SONDE_ACCES_PROD; else cibles=$SONDE_CIBLES_DEV; acces=$SONDE_ACCES_DEV; fi
  chemin=$(printf '%s\n' $cibles | sed -n "$((tour_de_sonde % 2 + 1))p")
  config=''
  [ -z "$acces" ] || config="header = \"Authorization: Basic $acces\""
  reponse=$(printf '%s\n' "$config" | curl -s -A "$SONDE_AGENT" -o /dev/null -w '%{http_code} %{time_total}' --max-time "$SONDE_DELAI_S" --connect-timeout 2 -K - "http://127.0.0.1:$port$chemin" 2>/dev/null || true)
  code=${reponse%% *}
  case "$code" in [0-9][0-9][0-9]) ;; *) code=000 ;; esac
  ms=$(printf '%s\n' "${reponse#* }" | awk '/^[0-9.]+$/ { printf "%d", $1 * 1000 + 0.5; found = 1 } END { if (!found) printf "%d", '"$SONDE_DELAI_S"' * 1000 }')
  # une mauvaise réponse : une erreur, un code hors 200 à 399 (le 401 de nginx compte pour bon tant que le mot de passe interne n'est pas lu : la mesure dit alors « authentifie: false »), ou un délai de plus de 2 s
  mauvaise=0
  case "$code" in 2??|3??) ;; 401) [ -f "$SONDE_DIR/authentifie.$2" ] && mauvaise=1 ;; *) mauvaise=1 ;; esac
  [ "$ms" -lt "$SONDE_LENTEUR_MS" ] || mauvaise=1
  printf '%s %s %s %s %s\n' "$1" "$2" "$code" "$ms" "$mauvaise" >> "$SONDE_DIR/mesures"
  if [ "$mauvaise" -eq 1 ]; then
    n=$(cat "$SONDE_DIR/mauvaises.$2" 2>/dev/null || echo 0); echo $((n + 1)) > "$SONDE_DIR/mauvaises.$2"
    if [ $((n + 1)) -ge "$SONDE_MAUVAISES_DE_SUITE" ]; then
      if [ "$2" = prod ]; then : > "$SONDE_DIR/arret.prod-degradee"; else : > "$SONDE_DIR/arret.$2"; fi
      printf '%s' "$2" > "$SONDE_DIR/arret-de"
      log "sonde arrêtée : $2 répond mal ($SONDE_MAUVAISES_DE_SUITE mauvaises réponses de suite)."
    fi
  else
    echo 0 > "$SONDE_DIR/mauvaises.$2"
  fi
}
sonde_un_tour() { sonde_mesurer "$1" prod; sonde_mesurer "$1" dev; }
# Une phase de durée fixe (la référence, l'après) : une requête par instance toutes les secondes.
sonde_une_phase() { # phase secondes
  [ -n "$SONDE_DIR" ] && { [ -f "$SONDE_DIR/port.prod" ] || [ -f "$SONDE_DIR/port.dev" ]; } || return 0
  i=0
  while [ "$i" -lt "$2" ]; do sonde_un_tour "$1"; i=$((i + 1)); sleep 1; done
}
sonde_json() {
  if [ -z "${SONDE_DIR:-}" ] || [ -z "${SONDE_PREPAREE:-}" ]; then printf 'null'; return 0; fi
  # un motif général (curl absent…) : aucune instance n'a été regardée ; « sonde_impossible » : chaque instance garde son motif (env_absent, env_monte, port_illisible, introuvable)
  if [ -n "$SONDE_MOTIF" ] && [ "$SONDE_MOTIF" != sonde_impossible ]; then printf '{ "format": "maverick-sonde/1", "disponible": false, "motif": %s, "instances": null }' "$(json_texte "$SONDE_MOTIF")"; return 0; fi
  arret='null'
  if [ -f "$SONDE_DIR/arret-de" ]; then arret="{ \"instance\": $(json_texte "$(cat "$SONDE_DIR/arret-de")"), \"motif\": \"reponses_mauvaises\" }"; fi
  if [ "$SONDE_MOTIF" = sonde_impossible ]; then disponible=false; motif_general='"sonde_impossible"'; else disponible=true; motif_general=null; fi
  printf '{ "format": "maverick-sonde/1", "disponible": %s, "motif": %s, "cibles": ["/", "/api/personnages/"], "cibles_dev": ["/", "/api/etat/"], "delai_s": %s, "arretee": %s, "instances": {' "$disponible" "$motif_general" "$SONDE_DELAI_S" "$arret"
  virgule=''
  for etiquette in prod dev; do
    printf '%s "%s": ' "$virgule" "$etiquette"; virgule=','
    if [ ! -f "$SONDE_DIR/port.$etiquette" ]; then
      printf '{ "disponible": false, "motif": %s, "authentifie": false, "phases": null }' "$(json_texte "$(cat "$SONDE_DIR/motif.$etiquette" 2>/dev/null || echo sonde_impossible)")"
      continue
    fi
    printf '{ "disponible": true, "motif": null, "authentifie": %s, "phases": { "reference": %s, "fabrication": %s, "apres": %s } }' \
      "$([ -f "$SONDE_DIR/authentifie.$etiquette" ] && echo true || echo false)" "$(sonde_stats reference "$etiquette")" "$(sonde_stats fabrication "$etiquette")" "$(sonde_stats apres "$etiquette")"
  done
  printf ' } }'
}

# ---------------------------------------------------------------- la journée type : ce que les minuteurs ont le droit de lancer
plafond_deja_dit() { # un rapport « plafond_du_jour » existe déjà aujourd'hui (pour l'origine « contenu » : un rapport de cette origine ; sinon un rapport d'une autre origine)
  jour=$(date -u -d "@$(epoch_maintenant)" '+%Y%m%d')
  for id in $(ls -1 "$RAPPORTS" 2>/dev/null | grep -E "^$jour-[0-9]{6}\$" || true); do
    grep -Eq '"motif": *"plafond_du_jour"' "$RAPPORTS/$id/rapport.json" 2>/dev/null || continue
    if grep -Eq '"origine": *"contenu"' "$RAPPORTS/$id/rapport.json" 2>/dev/null; then [ "$ORIGINE" != contenu ] || return 0; else [ "$ORIGINE" = contenu ] || return 0; fi
  done
  return 1
}
# Le minuteur du contenu (10 minutes) : seulement avec l'interrupteur (déjà vérifié), une marque lisible, et un extrait qui a CHANGÉ depuis le dernier site posé. Root ne fait que des `stat`
# (nom, taille, date de modification de contenu-<version>.db) et les compare à ce qu'il a noté lui-même dans declencheur/dernier-contenu quand il a posé un site. Un extrait pas encore là ou
# suspect, ou inchangé : rien (l'extrait absent n'est pas attendu, le minuteur repassera) ; seule la fabrication qui suit écrit un rapport.
regles_du_contenu() {
  marque_valide || refuser_de_demarrer "origine contenu : la marque est illisible."
  verifier_l_extrait "$VERSION_INSTALLEE" || refuser_de_demarrer "origine contenu : l'extrait de la version $VERSION_INSTALLEE n'est pas prêt ou est suspect : rien à faire."
  if [ -f "$DERNIER_CONTENU" ] && [ ! -L "$DERNIER_CONTENU" ] && [ "$(cat "$DERNIER_CONTENU" 2>/dev/null || true)" = "$EXTRAIT_STAT" ]; then exit 0; fi
}
# Le minuteur du jour n'ajoute une fabrication que si la fenêtre de mesure est ouverte, si la journée UTC en compte moins de 10 (toutes origines : nuit et livraisons comprises) et si la dernière date de plus de 40 minutes. Sinon : rien, sans rapport.
regles_de_la_journee_type() {
  maintenant=$(epoch_maintenant)
  if [ "$MESURE_DEPUIS" -le 0 ] || [ "$maintenant" -ge $((MESURE_DEPUIS + JOURS_DE_MESURE * 86400)) ]; then refuser_de_demarrer "journée type : la fenêtre de mesure est fermée (relancer atelier/installer.sh --jours-de-mesure N pour la rouvrir)."; fi
  faites=$(rapports_du_jour "$RAPPORTS" | grep -c . || true)
  [ "$faites" -lt "$JOURNEE_TYPE_FABRICATIONS" ] || refuser_de_demarrer "journée type : $faites fabrications aujourd'hui, la journée est pleine."
  derniere=$(ls -1 "$RAPPORTS" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{6}$' | sort | tail -n 1 || true)
  if [ -n "$derniere" ]; then
    ecart=$((maintenant - $(epoch_de_l_identifiant "$derniere")))
    [ "$ecart" -ge "$JOURNEE_TYPE_ECART_S" ] || refuser_de_demarrer "journée type : la dernière fabrication date de $((ecart / 60)) min (au moins $((JOURNEE_TYPE_ECART_S / 60)) min d'écart)."
  fi
}

# Copie un résultat du conteneur : un fichier régulier, jamais un lien ni une FIFO, au plus $PLAFOND_RESULTAT octets, copié sans l'interpréter, sous délai. Appelée seulement quand le
# conteneur est supprimé : le type contrôlé ne peut plus changer entre le contrôle et l'ouverture.
copier_un_resultat() { # source destination
  [ -f "$1" ] && [ ! -L "$1" ] || return 1
  timeout 20 dd if="$1" of="$2" iflag=nofollow bs=1024 count=$((PLAFOND_RESULTAT / 1024 + 1)) 2>/dev/null || { rm -f "$2"; return 1; }
  taille=$(wc -c < "$2" | tr -d ' ')
  [ "$taille" -le "$PLAFOND_RESULTAT" ] || { rm -f "$2"; return 1; }
  chmod 644 "$2"
}

# L'extrait du service : root ne fait que des `stat`, jamais une ouverture. Il est dans le DÉPÔT de l'atelier, <atelier>/depot/, que le geste du propriétaire crée (à root) et que le
# service ne voit que par un montage : il ne peut ni le renommer ni le remplacer, la source que root monte reste donc un chemin fixé par root, hors de db/. Dedans, le service peut
# poser ce qu'il veut (une FIFO, un périphérique, un lien) : seul le conteneur sans privilège l'ouvre. Code 0 : le fichier est là, régulier, de taille plausible ; 1 : pas encore là
# (le service le fabrique) ; 2 : suspect (lien, FIFO, périphérique, dossier, vide ou trop gros) : refus sans attente.
verifier_l_extrait() { # version
  depot=$ATELIER/depot
  [ -e "$depot" ] || [ -L "$depot" ] || return 1
  [ -d "$depot" ] && [ ! -L "$depot" ] || return 2
  source=$depot/contenu-$1.db
  [ -e "$source" ] || [ -L "$source" ] || return 1
  [ -f "$source" ] && [ ! -L "$source" ] || return 2
  taille=$(stat -c '%s' "$source" 2>/dev/null || echo 0)
  [ "$taille" -gt 0 ] && [ "$taille" -le "$PLAFOND_EXTRAIT" ] || return 2
  EXTRAIT_DIR=$depot
  # nom, taille et date de modification (à la nanoseconde quand `stat` sait la dire) : tout ce que root note de l'extrait
  EXTRAIT_STAT="contenu-$1.db $taille $(stat -c '%.9Y' "$source" 2>/dev/null || stat -c '%Y' "$source" 2>/dev/null || echo 0)"
}

# Un dossier de travail du conteneur : à root, vidé (rien du dossier lui-même n'est suivi), puis donné à l'utilisateur du conteneur (le dossier seulement ; 65534 sauf demande).
preparer_un_dossier() { # nom [uid:gid]
  mkdir -p "$ATELIER/$1"
  find "$ATELIER/$1" -mindepth 1 -delete 2>/dev/null || rm -rf "${ATELIER:?}/$1"/* "${ATELIER:?}/$1"/.[!.]* 2>/dev/null || true
  if [ "$ESSAI" != 1 ]; then chown "${2:-65534:65534}" "$ATELIER/$1"; fi
  chmod 755 "$ATELIER/$1"
}

ko_de() { du -sk "$1" 2>/dev/null | cut -f1; }

# Un relevé de la mémoire et du temps processeur du conteneur : cgroup v2 (memory.peak, sinon memory.current échantillonné), à défaut docker stats.
releve_du_conteneur() {
  trouve=0
  for base in "$CGROUP/maverick-atelier.slice/docker-$CID.scope" "$CGROUP/maverick-atelier.slice/$CID" "$CGROUP/system.slice/docker-$CID.scope" "$CGROUP/docker/$CID"; do
    [ -d "$base" ] || continue
    trouve=1
    if [ -f "$base/memory.peak" ]; then
      octets=$(cat "$base/memory.peak" 2>/dev/null || true)
      source=cgroup
    elif [ -f "$base/memory.current" ]; then
      octets=$(cat "$base/memory.current" 2>/dev/null || true)
      source=cgroup_echantillonne
    else
      octets=''
    fi
    case "$octets" in
      ''|*[!0-9]*) ;;
      *) ko=$((octets / 1024)); if [ -z "${PIC_KO:-}" ] || [ "$ko" -gt "$PIC_KO" ]; then PIC_KO=$ko; SOURCE_DU_PIC=$source; fi ;;
    esac
    usec=$(awk '$1 == "usage_usec" { print $2; exit }' "$base/cpu.stat" 2>/dev/null || true)
    case "$usec" in ''|*[!0-9]*) ;; *) CPU_MS=$((usec / 1000)) ;; esac
    break
  done
  if [ "$trouve" -eq 0 ]; then
    utilisee=$(docker stats --no-stream --format '{{.MemUsage}}' "$CID" 2>/dev/null | awk '{ print $1 }' || true)
    ko=$(printf '%s\n' "$utilisee" | awk '
      match($0, /^[0-9.]+/) { v = substr($0, 1, RLENGTH) + 0; u = substr($0, RLENGTH + 1)
        if (u == "GiB" || u == "GB") printf "%d\n", v * 1048576; else if (u == "MiB" || u == "MB") printf "%d\n", v * 1024; else if (u == "KiB" || u == "kB" || u == "KB") printf "%d\n", v; else if (u == "B") printf "%d\n", v / 1024 }')
    case "$ko" in ''|*[!0-9]*) ;; *) if [ -z "${PIC_KO:-}" ] || [ "$ko" -gt "$PIC_KO" ]; then PIC_KO=$ko; SOURCE_DU_PIC=docker_stats; fi ;; esac
  fi
}


# ---------------------------------------------------------------- le site servi (l'interrupteur <atelier>/servir)
servi_json() { # pose(1|0) motif code
  printf '{ "pose": %s, "motif": %s, "code_sortie": %s, "version_installee": %s, "version_de_l_instance": %s, "pages_minimum_pct": %s, "resume": %s }' \
    "$(json_booleen "$1")" "$(json_texte "$2")" "$(json_nombre "$3")" "$(json_texte "$VERSION_INSTALLEE")" "$(json_texte "${SERVI_VERSION_INSTANCE:-}")" "$(json_nombre "$PAGES_MINIMUM_PCT")" "$(json_booleen "${A_RESUME:-0}")"
}
servi_refuse() { SERVI_JSON=$(servi_json 0 "$1" "${2:-}"); log "site non posé : $1."; }

# L'extrait d'après lequel le site a été fabriqué est noté (nom, taille, date) : le minuteur « contenu » ne refabrique que si l'extrait change depuis.
noter_le_contenu() {
  if [ -n "$EXTRAIT_STAT" ]; then printf '%s\n' "$EXTRAIT_STAT" > "$DERNIER_CONTENU.neuf" && mv -f "$DERNIER_CONTENU.neuf" "$DERNIER_CONTENU" || rm -f "$DERNIER_CONTENU.neuf"; fi
}

# Pose le site fabriqué (<atelier>/sortie/site) à la place de <instance>/site. Appelée seulement avec l'interrupteur, après une fabrication réussie (code 0, ni délai, ni OOM, ni disque).
# Root ne lit rien de la sortie : il vérifie des versions (le fichier VERSION est à lui) et des types (`stat`), puis lance le second conteneur. Les garde-fous qui demandent de lire le site
# (index.html, pages au moins PAGES_MINIMUM_PCT % de celles du site servi, aucun lien ni FIFO) sont ceux du script du kit, qui tourne dans le conteneur.
# Le second conteneur tourne sous l'utilisateur PROPRIÉTAIRE de <instance>/site (celui qui peut y écrire sans la moindre capacité : root n'a que le droit du propriétaire, sans CAP_DAC_OVERRIDE,
# CAP_CHOWN ni CAP_MKNOD ; sur le serveur il est root DU CONTENEUR, car site/ est à root), et ne voit que : le kit (lecture seule), la sortie (lecture seule), le site servi (écriture)
# AVEC _serveur/ remonté par-dessus en lecture seule (le code du service ne se réécrit pas d'ici) et son dossier de résumé. Pas de réseau, pas de db/, pas de metriques/, pas de secrets/, pas de
# socket Docker. Limite : une évasion du conteneur donnerait root ; ce qui la rend improbable est l'absence de capacité, de réseau et d'écriture hors de ces montages.
servir_le_site() {
  SERVI_VERSION_INSTANCE=$(sed -n 's/^version=\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$/\1/p' "$INSTANCE/VERSION" 2>/dev/null | head -n 1)
  A_RESUME=0
  if [ "$SERVI_VERSION_INSTANCE" != "$VERSION_INSTALLEE" ] || [ "$VERSION_KIT" != "$VERSION_INSTALLEE" ]; then servi_refuse version_differente; return 0; fi
  # la base source (db/source) : sans elle, chaque pose referait la base vivante ; le marqueur est relu avant CHAQUE pose (un retour arrière de la bascule 1 l'a pu retirer)
  if [ ! -e "$INSTANCE/db/source" ]; then servi_refuse pas_de_base_source; return 0; fi
  if [ ! -f "$ATELIER/kit/client/scripts/poser-un-site.mjs" ] || [ -L "$ATELIER/kit/client/scripts/poser-un-site.mjs" ]; then servi_refuse kit_sans_pose; return 0; fi
  # la sortie et le site servi : des dossiers réels (jamais un lien : la source d'un montage est un chemin fixé par root) ; ce que la sortie porte, le script du conteneur le lit
  # (et _serveur/, le code que le service exécute : il doit être un vrai dossier, car le conteneur le voit en lecture seule, monté par-dessus site/)
  if [ ! -d "$ATELIER/sortie/site" ] || [ -L "$ATELIER/sortie/site" ] || [ -L "$ATELIER/sortie" ] || [ ! -d "$INSTANCE/site" ] || [ -L "$INSTANCE/site" ] || [ ! -d "$INSTANCE/site/_serveur" ] || [ -L "$INSTANCE/site/_serveur" ]; then servi_refuse site_absent; return 0; fi
  proprietaire=$(stat -c '%u:%g' "$INSTANCE/site" 2>/dev/null || echo x)
  case "$proprietaire" in [0-9]*:[0-9]*) ;; *) servi_refuse site_absent; return 0 ;; esac
  case "$proprietaire" in *[!0-9:]*) servi_refuse site_absent; return 0 ;; esac
  preparer_un_dossier pose "$proprietaire"
  PARENT_POSE=''
  if [ -f "$ETC_SYSTEMD/maverick-atelier.slice" ]; then PARENT_POSE='--cgroup-parent maverick-atelier.slice'; fi
  if ! CID=$(docker run -d --name "maverick-atelier-pose-$$" \
    --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user "$proprietaire" --pids-limit 128 \
    --cpus 1 --cpu-shares 128 --memory "$MEMOIRE_POSE" --memory-swap "$MEMOIRE_POSE" --oom-score-adj 500 \
    -v "$ATELIER/kit:/kit:ro" -v "$ATELIER/sortie:/sortie:ro" -v "$INSTANCE/site:/site" -v "$INSTANCE/site/_serveur:/site/_serveur:ro" -v "$ATELIER/pose:/pose" \
    $PARENT_POSE "$IMAGE" node --no-warnings /kit/client/scripts/poser-un-site.mjs --source /sortie/site --cible /site --resume /pose/pose.json --minimum-pct "$PAGES_MINIMUM_PCT" 2>/dev/null); then
    CID=''
    servi_refuse docker_refuse
    return 0
  fi
  depart_pose=$(date +%s)
  pose_depassee=0
  while :; do
    en_marche=$(docker inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo false)
    [ "$en_marche" = true ] || break
    if [ $(($(date +%s) - depart_pose)) -ge "$DELAI_POSE_S" ]; then pose_depassee=1; docker kill "$CID" >/dev/null 2>&1 || true; break; fi
    sleep "$INTERVALLE"
  done
  code_pose=$(docker inspect -f '{{.State.ExitCode}}' "$CID" 2>/dev/null || echo '')
  case "$code_pose" in ''|*[!0-9]*) code_pose='' ;; esac
  journal_pose=$ATELIER/.journal-pose.$$
  { timeout 30 docker logs "$CID" 2>&1 | tail -c "$PLAFOND_JOURNAL" > "$journal_pose"; } 2>/dev/null || rm -f "$journal_pose"
  # le conteneur est supprimé AVANT de toucher à son résumé (comme pour la fabrication : plus rien ne peut le changer)
  docker rm -f "$CID" >/dev/null 2>&1 || true
  CID=''
  dossier=$RAPPORTS/$ID
  mkdir -p "$dossier"
  copier_un_resultat "$ATELIER/pose/pose.json" "$dossier/pose.json" && A_RESUME=1
  if [ -s "$journal_pose" ] && [ ! -L "$journal_pose" ]; then mv -f "$journal_pose" "$dossier/journal-de-la-pose.txt" && chmod 644 "$dossier/journal-de-la-pose.txt" || rm -f "$journal_pose"; else rm -f "$journal_pose"; fi
  find "$ATELIER/pose" -mindepth 1 -delete 2>/dev/null || true
  if [ "$pose_depassee" -eq 1 ]; then servi_refuse delai_de_la_pose "$code_pose"; return 0; fi
  case "$code_pose" in
    0) SERVI_JSON=$(servi_json 1 '' 0); log "site posé (version $VERSION_INSTALLEE)."
       noter_le_contenu ;;
    81) servi_refuse index_absent 81 ;;
    # un refus qui ne changera pas tant que l'extrait ne change pas : l'extrait est noté aussi (sinon le minuteur le refabriquerait toutes les 10 minutes) ; « --servir » efface la note
    82) servi_refuse site_trop_petit 82; noter_le_contenu ;;
    83) servi_refuse fichier_irregulier 83; noter_le_contenu ;;
    84) servi_refuse serveur_dans_la_source 84; noter_le_contenu ;;
    85) servi_refuse source_illisible 85 ;;
    *) servi_refuse echec_de_la_pose "$code_pose" ;;
  esac
}

# ---------------------------------------------------------------- une fabrication
fabriquer_pour_la_marque() {
  HORODATAGE=$(maintenant_iso)
  decalage=0
  ID=$(identifiant_de_rapport)
  while [ -d "$RAPPORTS/$ID" ]; do decalage=$((decalage + 1)); ID=$(identifiant_de_rapport $(($(epoch_maintenant) + decalage))); done
  DEBUT_MS=$(en_ms)
  FIN_MS=''
  SONDE_PREPAREE=''
  PLAFOND_KO=''; MARGE_KO=''; CODE_SORTIE=''; PIC_KO=''; SOURCE_DU_PIC=''; CPU_MS=''; KIT_KO=''; TRAVAIL_KO=''; SORTIE_KO=''; A_FABRICATION=0; A_COMPARAISON=0
  SERVI_JSON=''; EXTRAIT_STAT=''
  VERSION_KIT=''
  mkdir -p "$RAPPORTS"

  # la taille du serveur, relevée à l'instant (elle va dans le rapport, refus compris)
  NPROC=$(nproc 2>/dev/null || echo '')
  MEM_TOTAL_KO=$(meminfo_ko MemTotal)
  MEM_DISPO_KO=$(meminfo_ko MemAvailable)
  mesurer_le_disque "$ATELIER"
  { read -r CHARGE_1 CHARGE_5 CHARGE_15 _ < "$PROC/loadavg"; } 2>/dev/null || { CHARGE_1=''; CHARGE_5=''; CHARGE_15=''; }

  marque_valide || { ecrire_le_rapport refus marque_illisible; return 0; }

  # le plafond du jour, toutes origines confondues (livraisons comprises) : au-delà, plus aucune fabrication ce jour-là ; un seul rapport court le dit
  # (le site servi a son propre plafond : MAX_CONTENU_PAR_JOUR, par défaut 48, ne compte que les fabrications d'origine « contenu » ; les autres origines ne les comptent pas)
  if [ "$ORIGINE" = contenu ]; then
    faites_aujourdhui=$(rapports_du_jour "$RAPPORTS" contenu | grep -c . || true); plafond_du_jour=$MAX_CONTENU_PAR_JOUR
  else
    faites_aujourdhui=$(rapports_du_jour "$RAPPORTS" | grep -c . || true); plafond_du_jour=$MAX_PAR_JOUR
  fi
  if [ "$faites_aujourdhui" -ge "$plafond_du_jour" ]; then
    if plafond_deja_dit; then log "plafond du jour atteint ($faites_aujourdhui fabrications, maximum $plafond_du_jour) : rien à faire, déjà noté."; else ecrire_le_rapport refus plafond_du_jour; fi
    return 0
  fi

  # le kit : posé par l'installateur de test, de la version de la marque
  VERSION_KIT=$(sed -n 's/.*"version": *"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' "$ATELIER/kit/kit.json" 2>/dev/null | head -n 1)
  IMAGE=$(sed -n 's/.*"image": *"\([^"]*\)".*/\1/p' "$ATELIER/kit/kit.json" 2>/dev/null | head -n 1)
  if [ -z "$VERSION_KIT" ] || [ ! -f "$ATELIER/kit/client/package.json" ]; then ecrire_le_rapport refus kit_absent; return 0; fi
  [ "$VERSION_KIT" = "$VERSION_INSTALLEE" ] || { ecrire_le_rapport refus kit_perime; return 0; }
  printf '%s\n' "$IMAGE" | grep -Eq "$MOTIF_IMAGE" || { ecrire_le_rapport refus kit_absent; return 0; }

  # la mémoire, puis le disque : un refus est une mesure
  case "$MEM_TOTAL_KO$MEM_DISPO_KO" in ''|*[!0-9]*) ecrire_le_rapport refus memoire_insuffisante; return 0 ;; esac
  calculer_le_plafond "$MEM_TOTAL_KO" "$MEM_DISPO_KO" "$MEMOIRE_MAX_KO" "$BESOIN_KO"
  if [ -n "$MOTIF_REFUS" ]; then ecrire_le_rapport refus "$MOTIF_REFUS"; return 0; fi
  if [ -z "$DISQUE_LIBRE_KO" ] || [ "$DISQUE_LIBRE_KO" -lt "$DISQUE_MIN_KO" ]; then ecrire_le_rapport refus disque_insuffisant; return 0; fi

  printf '{ "format": "maverick-atelier-en-cours/1", "debut": "%s", "version_installee": "%s" }\n' "$HORODATAGE" "$VERSION_INSTALLEE" > "$RAPPORTS/en-cours.json"

  # l'extrait de cette version : le service le fabrique après une installation ; on l'attend (jamais plus de $ATTENTE s), sans l'ouvrir
  attente=0
  while :; do
    if verifier_l_extrait "$VERSION_INSTALLEE"; then break; else suite=$?; fi
    if [ "$suite" -eq 2 ]; then ecrire_le_rapport refus extrait_refuse; return 0; fi
    attente=$((attente + 1))
    if [ "$attente" -gt "$ATTENTE" ]; then ecrire_le_rapport refus extrait_absent; return 0; fi
    sleep 1
  done

  # la référence : les temps de réponse des deux instances avant la fabrication (environ 30 s)
  sonde_preparer
  SONDE_PREPAREE=1
  if [ -z "$SONDE_MOTIF" ]; then sonde_une_phase reference "$SONDE_REFERENCE_S"; fi

  # l'image (celle du kit) : téléchargée seulement si elle manque
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker pull "$IMAGE" >/dev/null 2>&1 || { ecrire_le_rapport refus image_absente; return 0; }
  fi

  # les dossiers du conteneur : vidés (seule la dernière sortie est gardée), donnés à l'utilisateur 65534
  for d in travail sortie resultats; do preparer_un_dossier "$d"; done
  KIT_KO=$(ko_de "$ATELIER/kit")

  NOM="maverick-atelier-$$"
  # la tranche systemd de l'atelier (poids bas du processeur et des disques), si le geste du propriétaire l'a posée : le conteneur n'y passe devant jamais la production
  PARENT_DU_CGROUP=''
  if [ -f "$ETC_SYSTEMD/maverick-atelier.slice" ]; then PARENT_DU_CGROUP='--cgroup-parent maverick-atelier.slice'; fi
  if ! CID=$(docker run -d --name "$NOM" \
    --network none --read-only --cap-drop ALL --security-opt no-new-privileges --user 65534:65534 --pids-limit 1024 \
    --cpus "$CPUS" --cpu-shares 128 --memory "${PLAFOND_KO}k" --memory-swap "${PLAFOND_KO}k" --oom-score-adj 500 \
    -e HOME=/travail/home -e TMPDIR=/travail/tmp -e HIDE_EXAMPLES=1 -e SITE_MODE=test -e "SITE_TAG=$TAG" -e SITE_BASE=/ -e "SITE_GOOGLE_CLIENT_ID=$GOOGLE" \
    -e "VERSION_INSTALLEE=$VERSION_INSTALLEE" \
    -v "$ATELIER/kit:/kit:ro" -v "$INSTANCE/site:/site:ro" -v "$EXTRAIT_DIR:/contenu:ro" -v "$ICI/conteneur.sh:/conteneur.sh:ro" \
    -v "$ATELIER/travail:/travail" -v "$ATELIER/sortie:/sortie" -v "$ATELIER/resultats:/resultats" \
    $PARENT_DU_CGROUP "$IMAGE" sh /conteneur.sh 2>/dev/null); then
    CID=''
    ecrire_le_rapport refus docker_refuse
    return 0
  fi

  DEBUT_MS=$(en_ms)
  DERNIERE_SONDE=0
  # le suivi : un relevé de la mémoire (le cgroup disparaît avec le conteneur, memory.peak se lit pendant qu'il vit), de l'espace libre (sous le minimum, le conteneur est arrêté :
  # c'est une mesure), jusqu'à son arrêt ou au délai
  DEPASSE=0
  DISQUE_COUPE=0
  depart=$(date +%s)
  while :; do
    en_marche=$(docker inspect -f '{{.State.Running}}' "$CID" 2>/dev/null || echo false)
    releve_du_conteneur
    [ "$en_marche" = true ] || break
    mesurer_le_disque "$ATELIER"
    if [ -n "$DISQUE_LIBRE_KO" ] && [ "$DISQUE_LIBRE_KO" -lt "$DISQUE_MIN_KO" ]; then
      DISQUE_COUPE=1
      docker kill "$CID" >/dev/null 2>&1 || true
      break
    fi
    if [ $(($(date +%s) - depart)) -ge "$DELAI_S" ]; then
      DEPASSE=1
      docker kill "$CID" >/dev/null 2>&1 || true
      break
    fi
    # la sonde : une requête par instance et par seconde au plus
    if [ -z "$SONDE_MOTIF" ] && [ "$(date +%s)" -gt "$DERNIERE_SONDE" ]; then DERNIERE_SONDE=$(date +%s); sonde_un_tour fabrication; fi
    sleep "$INTERVALLE"
  done
  FIN_MS=$(en_ms)
  OOM=$(docker inspect -f '{{.State.OOMKilled}}' "$CID" 2>/dev/null || echo false)
  CODE_SORTIE=$(docker inspect -f '{{.State.ExitCode}}' "$CID" 2>/dev/null || echo '')
  case "$CODE_SORTIE" in ''|*[!0-9]*) CODE_SORTIE='' ;; esac
  # le journal du conteneur (stdout et stderr, la fin : 200 Ko au plus) est gardé AVANT sa suppression, pour lire l'erreur d'un échec que fabrication.json n'a pas pu porter. Il attend hors du
  # dossier des rapports (le service ne doit pas voir un rapport sans rapport.json) puis y est posé avec les autres fichiers. Il ne passe jamais par la liste blanche du service (lecture humaine :
  # sudo tail -c 20000 <rapports>/<id>/journal-du-conteneur.txt) ; rien n'y imprime l'environnement du conteneur.
  JOURNAL_EN_ATTENTE=$ATELIER/.journal-du-conteneur.$$
  { timeout 30 docker logs "$CID" 2>&1 | tail -c "$PLAFOND_JOURNAL" > "$JOURNAL_EN_ATTENTE"; } 2>/dev/null || rm -f "$JOURNAL_EN_ATTENTE"
  # le conteneur est supprimé AVANT de toucher à ce qu'il a laissé : plus aucun processus ne peut changer un fichier entre le contrôle de son type et son ouverture
  docker rm -f "$CID" >/dev/null 2>&1 || true
  CID=''
  # l'après : les temps de réponse des deux instances une fois la fabrication finie (environ 30 s)
  if [ -z "$SONDE_MOTIF" ]; then sonde_une_phase apres "$SONDE_APRES_S"; fi

  # ce que le conteneur a laissé : copié tel quel (jamais lu ni interprété ; fichier régulier seulement), mesuré, puis nettoyé ; le travail part, la dernière sortie reste
  dossier=$RAPPORTS/$ID
  mkdir -p "$dossier"
  copier_un_resultat "$ATELIER/resultats/fabrication.json" "$dossier/fabrication.json" && A_FABRICATION=1 || A_FABRICATION=0
  copier_un_resultat "$ATELIER/resultats/comparaison.json" "$dossier/comparaison.json" && A_COMPARAISON=1 || A_COMPARAISON=0
  # un journal vide ne s'ajoute pas au rapport
  if [ -s "$JOURNAL_EN_ATTENTE" ] && [ ! -L "$JOURNAL_EN_ATTENTE" ]; then
    mv -f "$JOURNAL_EN_ATTENTE" "$dossier/journal-du-conteneur.txt" && chmod 644 "$dossier/journal-du-conteneur.txt" || rm -f "$JOURNAL_EN_ATTENTE"
  else
    rm -f "$JOURNAL_EN_ATTENTE"
  fi
  TRAVAIL_KO=$(ko_de "$ATELIER/travail")
  SORTIE_KO=$(ko_de "$ATELIER/sortie")
  find "$ATELIER/travail" -mindepth 1 -delete 2>/dev/null || true

  # le site servi : seulement avec l'interrupteur, et seulement après une fabrication réussie
  if servir_actif && [ "$DISQUE_COUPE" -eq 0 ] && [ "$DEPASSE" -eq 0 ] && [ "$OOM" != true ] && [ "$CODE_SORTIE" = 0 ]; then servir_le_site; fi

  if [ "$DISQUE_COUPE" -eq 1 ]; then ecrire_le_rapport echec disque_insuffisant
  elif [ "$DEPASSE" -eq 1 ]; then ecrire_le_rapport delai
  elif [ "$OOM" = true ]; then ecrire_le_rapport oom
  elif [ "$CODE_SORTIE" = 73 ] || [ "$CODE_SORTIE" = 74 ] || [ "$CODE_SORTIE" = 75 ]; then ecrire_le_rapport refus extrait_refuse
  elif [ "$CODE_SORTIE" = 0 ]; then ecrire_le_rapport fait
  else ecrire_le_rapport echec
  fi
}

# Une fabrication de nuit ou de la journée type : une seule, de la version installée, sans marque nouvelle ; la journée type n'a lieu que dans ses règles.
# Elle relit la marque en sortant : une livraison arrivée pendant elle (son .path a été refusé par le verrou) est fabriquée à la suite, avec l'origine « livraison »,
# dans la limite des tours et du plafond du jour (c'est la mesure principale).
if [ "$ORIGINE" != livraison ]; then
  marque_avant=$(cat "$MARQUE" 2>/dev/null || true)
  [ "$ORIGINE" != journee_type ] || regles_de_la_journee_type
  [ "$ORIGINE" != contenu ] || regles_du_contenu
  log "fabrication ($ORIGINE) pour la marque : $(tr '\n' ' ' < "$MARQUE")"
  fabriquer_pour_la_marque
  rm -f "$RAPPORTS/en-cours.json"
  marque_apres=$(cat "$MARQUE" 2>/dev/null || true)
  if [ -z "$marque_apres" ] || [ "$marque_apres" = "$marque_avant" ]; then exit 0; fi
  log "une livraison est arrivée pendant la fabrication ($ORIGINE) : elle est fabriquée à la suite."
  ORIGINE=livraison
fi

# Jusqu'à trois tours : une marque posée pendant une fabrication la remplace (seule la dernière version compte).
tour=0
while [ "$tour" -lt 3 ]; do
  tour=$((tour + 1))
  marque_lue=$(cat "$MARQUE" 2>/dev/null || true)
  [ -n "$marque_lue" ] || break
  if [ -f "$JOURNAL_DE_LA_MARQUE" ] && [ "$tour" -gt 1 ] && [ "$(cat "$JOURNAL_DE_LA_MARQUE" 2>/dev/null || true)" = "$marque_lue" ]; then break; fi
  printf '%s\n' "$marque_lue" > "$JOURNAL_DE_LA_MARQUE"
  log "fabrication pour la marque : $(printf '%s' "$marque_lue" | tr '\n' ' ')"
  fabriquer_pour_la_marque
  rm -f "$RAPPORTS/en-cours.json"
  [ "$(cat "$MARQUE" 2>/dev/null || true)" != "$marque_lue" ] || break
done
exit 0
