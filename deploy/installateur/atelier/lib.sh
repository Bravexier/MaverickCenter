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

# Valeurs par défaut (kilo-octets, secondes). Plafond de mémoire : 2,5 Go ; besoin : 1,5 Go (le pic mesuré d'une fabrication est d'environ 1,4 Go) ; disque : arrêt sous 2 Go libres.
DEFAUT_MEMOIRE_MAX_KO=2621440
DEFAUT_BESOIN_KO=1572864
DEFAUT_CPUS=1
DEFAUT_DISQUE_MIN_KO=2097152
DEFAUT_DELAI_S=1800
RAPPORTS_GARDES=20
# Plafond de taille de ce que root copie depuis le conteneur (octets) et depuis le service (l'extrait).
PLAFOND_RESULTAT=262144
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
#   plafond = min(maximum réglé, MemAvailable / 2) ; marge laissée à la production = MemAvailable - plafond.
# Refus (MOTIF_REFUS) : « memoire_insuffisante » si le plafond est sous le besoin, « marge_insuffisante » si la marge est sous max(1 Go, 25 % de MemTotal).
# Variables posées : PLAFOND_KO, MARGE_KO, MOTIF_REFUS (vide : on peut démarrer).
calculer_le_plafond() { # total dispo maximum besoin
  PLAFOND_KO=$3
  moitie=$(($2 / 2))
  [ "$moitie" -ge "$PLAFOND_KO" ] || PLAFOND_KO=$moitie
  MARGE_KO=$(($2 - PLAFOND_KO))
  marge_minimale=$(($1 / 4))
  [ "$marge_minimale" -ge 1048576 ] || marge_minimale=1048576
  MOTIF_REFUS=''
  if [ "$PLAFOND_KO" -lt "$4" ]; then MOTIF_REFUS=memoire_insuffisante
  elif [ "$MARGE_KO" -lt "$marge_minimale" ]; then MOTIF_REFUS=marge_insuffisante
  fi
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

maintenant_iso() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }
identifiant_de_rapport() { date -u '+%Y%m%d-%H%M%S'; }
