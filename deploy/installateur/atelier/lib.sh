# Outils communs de l'atelier du site de dev (installer.sh, lancer.sh) : lot 9 du chantier « la base du site de dev devient la source de vérité »,
# docs/serveur.md, « Atelier du site de dev ». Sourcé, jamais lancé. POSIX sh (dash).
#
# Règles de l'atelier (garde-fou 20 du plan : aucun programme root n'obéit à une demande venue du site de dev) :
#   - root n'écrit jamais dans un dossier que le service contrôle (db/, metriques/, maintenance/) et n'y suit jamais un lien symbolique ;
#   - root n'interprète aucun fichier produit par le service ou par le conteneur : il vérifie un fichier régulier non lien, le copie avec un plafond de taille,
#     et c'est le service qui lit les JSON (serveur/atelier.mjs) ;
#   - les réglages viennent d'un fichier dont root est propriétaire, relus champ par champ.
# Réglages de test seulement (MAVERICK_ATELIER_ESSAI=1 : ni root ni systemd exigés) : MAVERICK_ATELIER_PROC (/proc), MAVERICK_ATELIER_CGROUP (/sys/fs/cgroup),
# MAVERICK_DIR_ETC_SYSTEMD, MAVERICK_ATELIER_INTERVALLE (secondes entre deux relevés du conteneur), MAVERICK_ATELIER_ATTENTE (secondes d'attente de l'extrait).

PROC=${MAVERICK_ATELIER_PROC:-/proc}
CGROUP=${MAVERICK_ATELIER_CGROUP:-/sys/fs/cgroup}
ESSAI=${MAVERICK_ATELIER_ESSAI:-0}

# Valeurs par défaut (kilo-octets, secondes). Plafond de mémoire : 2,5 Go ; besoin : 1,1 Go (fabrication complète de l'extrait du jour, mesurée dans un cgroup limité : réussie à 1100 Mo, tuée à 800 Mo ; 1,1 Go est le plus petit plafond essayé qui réussit) ;
# disque : arrêt sous 2 Go libres. L'ancien besoin par défaut (1,5 Go) n'a jamais été choisi par le propriétaire : le geste ne le reprend pas (installer.sh).
DEFAUT_MEMOIRE_MAX_KO=2621440
DEFAUT_BESOIN_KO=1153433
ANCIEN_DEFAUT_BESOIN_KO=1572864
DEFAUT_CPUS=1
DEFAUT_DISQUE_MIN_KO=2097152
DEFAUT_DELAI_S=1800
# Rapports gardés : de quoi couvrir une journée pleine (au plus 12 fabrications par jour par défaut) sur plus de trois jours, et le bilan des dernières 24 h.
RAPPORTS_GARDES=40
# La journée type : le minuteur du jour n'ajoute rien quand la journée UTC compte déjà 10 fabrications (toutes origines confondues : la nuit et les livraisons comptent), une toutes les 40 minutes au moins ; au plus 12 par jour toutes origines confondues ; une journée de mesure par défaut.
DEFAUT_JOURS_DE_MESURE=1
DEFAUT_MAX_PAR_JOUR=12
JOURNEE_TYPE_FABRICATIONS=10
JOURNEE_TYPE_ECART_S=2400
# La sonde de la production : une requête par seconde et par instance au plus, 5 s de délai, une référence et une phase après d'environ 30 s ; trois mauvaises réponses de suite l'arrêtent.
# Le User-Agent de la sonde : exact, reconnu par le service (serveur/metriques.mjs#UA_SONDE) qui ne compte pas ces requêtes dans ses métriques.
SONDE_AGENT='maverick-atelier-sonde/1'
SONDE_DELAI_S=5
SONDE_REFERENCE_S=${MAVERICK_ATELIER_SONDE_REFERENCE:-30}
SONDE_APRES_S=${MAVERICK_ATELIER_SONDE_APRES:-30}
SONDE_MAUVAISES_DE_SUITE=3
SONDE_LENTEUR_MS=2000
SONDE_CIBLES='/ /api/personnages/'
# Plafond de taille de ce que root copie depuis le conteneur (octets) et depuis le service (l'extrait).
PLAFOND_RESULTAT=262144
# le journal du conteneur (docker logs) gardé dans le rapport : la fin, 200 Ko au plus
PLAFOND_JOURNAL=204800
PLAFOND_EXTRAIT=536870912
# Le motif de l'image d'une fabrication : celle du kit (node:<version>-bookworm-slim ou -alpine), rien d'autre.
MOTIF_IMAGE='^node:[0-9]+(\.[0-9]+){0,2}-(bookworm-slim|alpine)$'

# « 2.5g », « 1500m » -> kilo-octets (entier) ; code 1 si la forme n'est pas celle-là.
taille_en_ko() {
  case "$1" in
    ''|*[!0-9.gGmM]*) return 1 ;;
  esac
  printf '%s\n' "$1" | awk '
    /^[0-9]+(\.[0-9]+)?[gGmM]$/ {
      unite = substr($0, length($0)); valeur = substr($0, 1, length($0) - 1) + 0
      if (valeur <= 0) exit 1
      printf "%d\n", (unite == "g" || unite == "G") ? valeur * 1048576 : valeur * 1024
      found = 1
    }
    END { exit found ? 0 : 1 }'
}

# Un nombre de processeurs : « 1 », « 0.5 », « 2 » (jamais zéro, jamais plus de 64).
valide_cpus() {
  printf '%s\n' "$1" | awk '/^[0-9]+(\.[0-9]+)?$/ && $0 + 0 > 0 && $0 + 0 <= 64 { ok = 1 } END { exit ok ? 0 : 1 }'
}

entier_positif() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; [ "$1" -gt 0 ]; }

# Un champ d'un fichier de réglages « NOM=valeur » (lignes exactes, jamais interprétées par le shell) : valeur, ou rien.
champ_du_fichier() { # fichier nom
  [ -f "$1" ] || return 0
  sed -n "s|^$2=\\([-A-Za-z0-9._:+@ /]*\\)\$|\\1|p" "$1" | head -n 1
}

meminfo_ko() { # champ -> kilo-octets
  awk -v champ="$1:" '$1 == champ { print $2; exit }' "$PROC/meminfo" 2>/dev/null
}

# Le plafond de mémoire d'une fabrication, d'après la mémoire du serveur à l'instant (kilo-octets) :
#   plafond = min(maximum réglé, MemAvailable / 2) ; marge laissée à la production = MemAvailable - plafond (au moins la moitié du disponible) ;
#   marge minimale = max(1 Go, 25 % de MemTotal).
# Refus (MOTIF_REFUS) : « memoire_insuffisante » si le plafond est sous le besoin (MemAvailable < 2 × besoin, tant que le maximum réglé n'est pas sous le besoin : le geste le refuse),
# « marge_insuffisante » si la marge est sous la marge minimale : MemAvailable < min(maximum + marge minimale, 2 × marge minimale) ; baisser le maximum ne la lève que s'il reste au moins
# le besoin sous MemAvailable - marge minimale, sinon il faut plus de mémoire disponible.
# Variables posées : PLAFOND_KO, MARGE_KO, MARGE_MINIMALE_KO, MOTIF_REFUS (vide : on peut démarrer).
calculer_le_plafond() { # total dispo maximum besoin
  PLAFOND_KO=$3
  moitie=$(($2 / 2))
  [ "$moitie" -ge "$PLAFOND_KO" ] || PLAFOND_KO=$moitie
  MARGE_KO=$(($2 - PLAFOND_KO))
  MARGE_MINIMALE_KO=$(($1 / 4))
  [ "$MARGE_MINIMALE_KO" -ge 1048576 ] || MARGE_MINIMALE_KO=1048576
  MOTIF_REFUS=''
  if [ "$PLAFOND_KO" -lt "$4" ]; then MOTIF_REFUS=memoire_insuffisante
  elif [ "$MARGE_KO" -lt "$MARGE_MINIMALE_KO" ]; then MOTIF_REFUS=marge_insuffisante
  fi
}

# La phrase de --etat sur la mémoire, d'après calculer_le_plafond (mêmes arguments, plus le geste à donner et le maximum réglé) : les chiffres relevés (Mo) et, en cas de refus,
# ce qui le lève. Seuil de la mémoire : sous 2 × besoin de mémoire disponible, le plafond (la moitié du disponible) est sous le besoin. Seuil de la marge : sous
# min(maximum + marge minimale, 2 × marge minimale), la marge laissée est sous la marge minimale.
dire_la_memoire() { # total dispo besoin geste maximum
  seuil=$(( (2 * $3 + 1023) / 1024 ))
  base="$(($2 / 1024)) Mo disponibles sur $(($1 / 1024)) Mo ; marge laissée à la production $((MARGE_KO / 1024)) Mo (au moins $((MARGE_MINIMALE_KO / 1024)) Mo), plafond possible $((PLAFOND_KO / 1024)) Mo, besoin $(($3 / 1024)) Mo"
  case "$MOTIF_REFUS" in
    '') printf '%s : la fabrication démarrerait (refus sous %s Mo disponibles).' "$base" "$seuil" ;;
    memoire_insuffisante) printf '%s : la fabrication serait refusée (memoire_insuffisante). Pour la lever : libérer de la mémoire (il faut au moins %s Mo disponibles), ou baisser le besoin par « sudo sh %s --besoin <taille> » ; risque : un besoin sous ce que la fabrication demande (1,1 Go est le plus petit plafond essayé qui réussit) la fait échouer, le conteneur étant tué au plafond (OOMKilled) : une mesure en échec ; la production garde sa marge.' "$base" "$seuil" "$4" ;;
    *)
      seuil_marge=$(( $5 + MARGE_MINIMALE_KO )); [ "$seuil_marge" -le $((2 * MARGE_MINIMALE_KO)) ] || seuil_marge=$((2 * MARGE_MINIMALE_KO))
      seuil_marge=$(( (seuil_marge + 1023) / 1024 ))
      printf '%s : la fabrication serait refusée (%s : la marge laissée à la production serait sous le minimum). Pour la lever : libérer de la mémoire (il faut au moins %s Mo disponibles)' "$base" "$MOTIF_REFUS" "$seuil_marge"
      # baisser le maximum ne lève ce refus que s'il reste au moins le besoin sous MemAvailable - marge minimale
      if [ $(($2 - MARGE_MINIMALE_KO)) -ge "$3" ]; then printf ', ou baisser le maximum par « sudo sh %s --memoire-max <taille> » avec une taille d'"'"'au plus %s Mo (et d'"'"'au moins le besoin)' "$4" "$(( ($2 - MARGE_MINIMALE_KO) / 1024 ))"; fi
      printf '.' ;;
  esac
}

# Le disque du dossier $1 : DISQUE_TOTAL_KO et DISQUE_LIBRE_KO (df -P : « disponible » pour un utilisateur ordinaire, la réserve de root n'y est pas).
mesurer_le_disque() {
  ligne=$(df -Pk "$1" 2>/dev/null | awk 'NR == 2 { print $2 " " $4 }')
  DISQUE_TOTAL_KO=${ligne%% *}
  DISQUE_LIBRE_KO=${ligne##* }
  case "$DISQUE_TOTAL_KO$DISQUE_LIBRE_KO" in ''|*[!0-9]*) DISQUE_TOTAL_KO=''; DISQUE_LIBRE_KO='' ;; esac
}

# JSON écrit à la main : un nombre ou « null », un texte réduit à des caractères sûrs (jamais un guillemet ni une barre inverse), un booléen.
json_nombre() { case "$1" in ''|*[!0-9.-]*) printf 'null' ;; *) printf '%s' "$1" ;; esac; }
json_texte() {
  texte=$(printf '%s' "$1" | tr -cd 'A-Za-z0-9._:+@/ -' | cut -c1-120)
  if [ -n "$texte" ]; then printf '"%s"' "$texte"; else printf 'null'; fi
}
json_booleen() { if [ "$1" = 1 ] || [ "$1" = true ]; then printf 'true'; else printf 'false'; fi; }

# L'horloge : MAVERICK_ATELIER_MAINTENANT (secondes depuis 1970) la fige dans les tests ; sinon celle du serveur. Les rapports portent l'heure UTC : « la journée » est le jour UTC.
epoch_maintenant() { if [ -n "${MAVERICK_ATELIER_MAINTENANT:-}" ]; then printf '%s\n' "$MAVERICK_ATELIER_MAINTENANT"; else date +%s; fi; }
maintenant_iso() { date -u -d "@$(epoch_maintenant)" '+%Y-%m-%dT%H:%M:%SZ'; }
identifiant_de_rapport() { date -u -d "@${1:-$(epoch_maintenant)}" '+%Y%m%d-%H%M%S'; }
# Le jour UTC (AAAAMMJJ) et l'instant (secondes) d'un identifiant de rapport AAAAMMJJ-HHMMSS.
jour_de_l_identifiant() { printf '%s' "${1%%-*}"; }
epoch_de_l_identifiant() { d=${1%%-*}; h=${1##*-}; date -u -d "$(printf '%s' "$d" | sed 's/\(....\)\(..\)\(..\)/\1-\2-\3/') $(printf '%s' "$h" | sed 's/\(..\)\(..\)\(..\)/\1:\2:\3/')" +%s; }

# Les rapports d'aujourd'hui (jour UTC) qui comptent comme des fabrications : tous, sauf ceux qui disent seulement que le plafond du jour est atteint.
rapports_du_jour() { # dossier_des_rapports -> identifiants, un par ligne
  jour=$(date -u -d "@$(epoch_maintenant)" '+%Y%m%d')
  ls -1 "$1" 2>/dev/null | grep -E "^$jour-[0-9]{6}\$" | while read -r id; do
    grep -Eq '"motif": *"plafond_du_jour"' "$1/$id/rapport.json" 2>/dev/null || printf '%s\n' "$id"
  done
}

# Les nombres d'une phase d'une instance : n, médiane, 95e centile et maximum (rang le plus proche : le plus petit rang qui couvre 50 % ou 95 % des mesures), et le nombre de mauvaises réponses.
sonde_stats() { # phase étiquette
  grep "^$1 $2 " "$SONDE_DIR/mesures" 2>/dev/null | awk '{ print $4 " " $5 }' | sort -n | awk '
    { v[NR] = $1; e += $2 }
    END {
      n = NR
      if (n == 0) { printf "{ \"n\": 0, \"mediane_ms\": null, \"p95_ms\": null, \"max_ms\": null, \"erreurs\": 0 }"; exit }
      rm = int((50 * n + 99) / 100); rp = int((95 * n + 99) / 100)
      printf "{ \"n\": %d, \"mediane_ms\": %d, \"p95_ms\": %d, \"max_ms\": %d, \"erreurs\": %d }", n, v[rm], v[rp], v[n], e
    }'
}
