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
# Avant de démarrer, la mémoire est mesurée (MemTotal, MemAvailable) : plafond = min(maximum réglé, MemAvailable / 2) ; refus si le plafond est sous le besoin, ou si la marge
# laissée à la production (MemAvailable - plafond) est sous max(1 Go, 25 % de MemTotal) ; refus aussi sous le minimum d'espace libre. Un refus est une mesure : le rapport
# dit les chiffres relevés. Un conteneur arrêté par manque de mémoire (OOMKilled) est une mesure aussi : jamais de relance silencieuse.
set -eu
umask 022

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

# ---------------------------------------------------------------- une marque à la fois
CID=''
DEBUT_MS=0
en_ms() { # date +%s%N, sinon des secondes
  nano=$(date +%s%N 2>/dev/null || true)
  case "$nano" in ''|*[!0-9]*) echo $(($(date +%s) * 1000)) ;; *) echo $((nano / 1000000)) ;; esac
}
nettoyer() {
  if [ -n "$CID" ]; then docker rm -f "$CID" >/dev/null 2>&1 || true; fi
  rm -f "$RAPPORTS/en-cours.json"
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
  fin=$(en_ms)
  duree=$((fin - DEBUT_MS))
  fichier=$dossier/.rapport.json.$$
  {
    printf '{\n'
    printf '  "format": "maverick-atelier/1",\n  "id": "%s",\n' "$ID"
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
    printf '  "fabrication": %s,\n  "comparaison": %s\n}\n' "$(json_booleen "${A_FABRICATION:-0}")" "$(json_booleen "${A_COMPARAISON:-0}")"
  } > "$fichier"
  mv -f "$fichier" "$dossier/rapport.json"
  log "rapport $ID : $issue${motif:+ ($motif)} ; plafond ${PLAFOND_KO:-?} ko, marge ${MARGE_KO:-?} ko, mémoire disponible ${MEM_DISPO_KO:-?} ko, disque libre ${DISQUE_LIBRE_KO:-?} ko."
  # ne garder que les derniers rapports (des dossiers de la forme AAAAMMJJ-HHMMSS, rien d'autre)
  anciens=$(ls -1 "$RAPPORTS" | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | tail -n +"$((RAPPORTS_GARDES + 1))" || true)
  for ancien in $anciens; do rm -rf "${RAPPORTS:?}/$ancien"; done
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
}

# Un dossier de travail du conteneur : à root, vidé (rien du dossier lui-même n'est suivi), puis donné à l'utilisateur du conteneur (le dossier seulement).
preparer_un_dossier() { # nom
  mkdir -p "$ATELIER/$1"
  find "$ATELIER/$1" -mindepth 1 -delete 2>/dev/null || rm -rf "${ATELIER:?}/$1"/* "${ATELIER:?}/$1"/.[!.]* 2>/dev/null || true
  if [ "$ESSAI" != 1 ]; then chown 65534:65534 "$ATELIER/$1"; fi
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

# ---------------------------------------------------------------- une fabrication
fabriquer_pour_la_marque() {
  HORODATAGE=$(maintenant_iso)
  ID=$(identifiant_de_rapport)
  while [ -d "$RAPPORTS/$ID" ]; do sleep 1; ID=$(identifiant_de_rapport); done
  DEBUT_MS=$(en_ms)
  PLAFOND_KO=''; MARGE_KO=''; CODE_SORTIE=''; PIC_KO=''; SOURCE_DU_PIC=''; CPU_MS=''; KIT_KO=''; TRAVAIL_KO=''; SORTIE_KO=''; A_FABRICATION=0; A_COMPARAISON=0
  VERSION_KIT=''
  mkdir -p "$RAPPORTS"

  # la taille du serveur, relevée à l'instant (elle va dans le rapport, refus compris)
  NPROC=$(nproc 2>/dev/null || echo '')
  MEM_TOTAL_KO=$(meminfo_ko MemTotal)
  MEM_DISPO_KO=$(meminfo_ko MemAvailable)
  mesurer_le_disque "$ATELIER"
  { read -r CHARGE_1 CHARGE_5 CHARGE_15 _ < "$PROC/loadavg"; } 2>/dev/null || { CHARGE_1=''; CHARGE_5=''; CHARGE_15=''; }

  marque_valide || { ecrire_le_rapport refus marque_illisible; return 0; }

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
    sleep "$INTERVALLE"
  done
  OOM=$(docker inspect -f '{{.State.OOMKilled}}' "$CID" 2>/dev/null || echo false)
  CODE_SORTIE=$(docker inspect -f '{{.State.ExitCode}}' "$CID" 2>/dev/null || echo '')
  case "$CODE_SORTIE" in ''|*[!0-9]*) CODE_SORTIE='' ;; esac
  # le conteneur est supprimé AVANT de toucher à ce qu'il a laissé : plus aucun processus ne peut changer un fichier entre le contrôle de son type et son ouverture
  docker rm -f "$CID" >/dev/null 2>&1 || true
  CID=''

  # ce que le conteneur a laissé : copié tel quel (jamais lu ni interprété ; fichier régulier seulement), mesuré, puis nettoyé ; le travail part, la dernière sortie reste
  dossier=$RAPPORTS/$ID
  mkdir -p "$dossier"
  copier_un_resultat "$ATELIER/resultats/fabrication.json" "$dossier/fabrication.json" && A_FABRICATION=1 || A_FABRICATION=0
  copier_un_resultat "$ATELIER/resultats/comparaison.json" "$dossier/comparaison.json" && A_COMPARAISON=1 || A_COMPARAISON=0
  TRAVAIL_KO=$(ko_de "$ATELIER/travail")
  SORTIE_KO=$(ko_de "$ATELIER/sortie")
  find "$ATELIER/travail" -mindepth 1 -delete 2>/dev/null || true

  if [ "$DISQUE_COUPE" -eq 1 ]; then ecrire_le_rapport echec disque_insuffisant
  elif [ "$DEPASSE" -eq 1 ]; then ecrire_le_rapport delai
  elif [ "$OOM" = true ]; then ecrire_le_rapport oom
  elif [ "$CODE_SORTIE" = 73 ] || [ "$CODE_SORTIE" = 74 ] || [ "$CODE_SORTIE" = 75 ]; then ecrire_le_rapport refus extrait_refuse
  elif [ "$CODE_SORTIE" = 0 ]; then ecrire_le_rapport fait
  else ecrire_le_rapport echec
  fi
}

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
