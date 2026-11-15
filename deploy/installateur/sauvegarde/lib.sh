# shellcheck shell=bash
# shellcheck disable=SC2034
# Fonctions communes des sauvegardes automatiques (copie.sh, envoi.sh, essai.sh) : réglages, état, JSON pour la page Debug.
# Lu par « . lib.sh », jamais lancé seul. Documentation : deploy/vps/README.md, « Sauvegardes » ; docs/serveur.md, « Sauvegardes automatiques ».
#
# Dossiers (tous réglables par variable d'environnement, pour les tests) :
#   MAVERICK_DIR_NORMAL / MAVERICK_DIR_TEST   instances prod (/srv/maverick-center) et dev (/srv/maverick-center-test)
#   MAVERICK_DIR_SAUVEGARDES                  copies locales et état (/srv/maverick-sauvegardes, root 700 : les fiches sont dedans)
#   MAVERICK_DIR_ETC_SAUVEGARDES              clés et réglages (/etc/maverick-sauvegardes, root 700)
#   MAVERICK_DIR_METRIQUES                    dossier des métriques où va sauvegardes.json (<normal>/metriques). S'il n'existe pas (instances.sh pas
#                                             relancé depuis les métriques), l'état va là où le service de chaque instance le lit : metriques_de_l_instance
#   MAVERICK_SAUV_DOCKER                      la commande docker (docker ; un faux dans les tests)
# Aucun secret ne sort de ce fichier : l'état et le JSON ne portent que des dates, des tailles, des nombres et des codes courts.

NORMAL=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
TEST=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
SAUV=${MAVERICK_DIR_SAUVEGARDES:-/srv/maverick-sauvegardes}
ETC=${MAVERICK_DIR_ETC_SAUVEGARDES:-/etc/maverick-sauvegardes}
METRIQUES=${MAVERICK_DIR_METRIQUES:-$NORMAL/metriques}
SORTIE_JSON=$METRIQUES/sauvegardes.json
DOCKER_DES_INSTANCES=${MAVERICK_SAUV_DOCKER:-docker}
ETAT=$SAUV/etat
INSTANCES="prod dev"

journal() { echo "sauvegarde: $*"; }
echec() { echo "sauvegarde: ERREUR : $*" >&2; }

dossier_de() {
  case "$1" in
    prod) printf '%s' "${NORMAL%/}" ;;
    dev) printf '%s' "${TEST%/}" ;;
    *) return 1 ;;
  esac
}

# Réglage : variable MAVERICK_SAUV_<NOM>, sinon ligne NOM=valeur de reglages.env, sinon le défaut. Dans le fichier, la valeur peut être entre guillemets
# (VERSIONS_DE="prod dev") et suivie d'un commentaire de fin de ligne (PLAFOND_MO=2048  # place) : seule la valeur est lue. Écrit la valeur.
reglage() {
  local nom=$1 defaut=$2 var v
  var=MAVERICK_SAUV_$nom
  v=${!var:-}
  if [ -z "$v" ] && [ -f "$ETC/reglages.env" ]; then
    v=$(sed -n "s/^$nom=//p" "$ETC/reglages.env" | tail -n 1 | tr -d '\r' |
      sed -E "s/^\"([^\"]*)\".*/\1/; t; s/^'([^']*)'.*/\1/; t; s/^([^[:space:]#]*).*/\1/")
  fi
  [ -n "$v" ] || v=$defaut
  printf '%s' "$v"
}
# Un réglage illisible (pas un entier, nom d'instance inconnu…) ne retombe jamais en silence : il est dit sur la sortie d'erreur, noté ici, et
# l'état (locale.reglages_illisibles) et le code de sortie des copies le portent ; la valeur par défaut est alors prise.
REGLAGES_ILLISIBLES=''
signaler_reglage() { # nom valeur_lue défaut
  REGLAGES_ILLISIBLES="$REGLAGES_ILLISIBLES${REGLAGES_ILLISIBLES:+ }$1"
  [ "${MAVERICK_SAUV_ENFANT:-0}" = 1 ] || echec "réglage $1 illisible (« $2 ») : valeur par défaut ($3) prise"
}
lire_entier() { # variable nom défaut
  local v
  v=$(reglage "$2" "$3")
  case "$v" in ''|*[!0-9]*) signaler_reglage "$2" "$v" "$3"; v=$3 ;; esac
  printf -v "$1" '%s' "$v"
}

# Réglages (défauts documentés dans docs/serveur.md, « Sauvegardes automatiques »).
charger_reglages() {
  local mot
  REGLAGES_ILLISIBLES=''
  lire_entier PLAFOND_MO PLAFOND_MO 4096                 # place maximale des copies locales (les deux instances)
  lire_entier LIBRE_MIN_MO LIBRE_MIN_MO 3072             # espace libre minimal sur le disque APRÈS une copie
  lire_entier HORAIRES_GARDEES HORAIRES_GARDEES 24       # copies horaires gardées par instance
  lire_entier NUITS_GARDEES NUITS_GARDEES 7              # copies de nuit gardées par instance
  lire_entier SUSPECTES_GARDEES SUSPECTES_GARDEES 3      # copies mises de côté (alerte) gardées par instance
  lire_entier CHUTE_POURCENT CHUTE_POURCENT 20           # « chute anormale » : une table perd plus de ce pourcentage de ses lignes…
  lire_entier CHUTE_MIN_LIGNES CHUTE_MIN_LIGNES 20       # … si elle avait au moins ce nombre de lignes dans la copie précédente
  lire_entier JOURS_GARDES JOURS_GARDES 30               # copie extérieure : jours gardés
  VERSIONS_DE=$(reglage VERSIONS_DE "prod dev")          # instances dont chaque version est gardée sans limite à l'extérieur (prod, dev)
  for mot in $VERSIONS_DE; do
    case "$mot" in prod|dev) ;; *) signaler_reglage VERSIONS_DE "$VERSIONS_DE" "prod dev"; VERSIONS_DE="prod dev"; break ;; esac
  done
  CONTROLE_DONNEES=$(reglage CONTROLE_DONNEES "5%")      # part des données relue par « restic check » le dimanche
  case "$CONTROLE_DONNEES" in *[!0-9%]*|'') signaler_reglage CONTROLE_DONNEES "$CONTROLE_DONNEES" "5%"; CONTROLE_DONNEES='5%' ;; esac
  if [ "$CHUTE_POURCENT" -gt 100 ]; then CHUTE_POURCENT=100; fi
}

# L'instant courant, en secondes (MAVERICK_SAUV_HORLOGE, une date ISO, le fige : tests).
instant() {
  if [ -n "${MAVERICK_SAUV_HORLOGE:-}" ]; then date -u -d "$MAVERICK_SAUV_HORLOGE" +%s; else date +%s; fi
}
iso_de() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ; }
nom_de_copie() { date -u -d "@$1" +%Y%m%d-%H%M%S; }

# ---------------------------------------------------------------- fichiers d'état (CLE=valeur, une par ligne, jamais « sourcés »)
etat_lire() { # fichier cle
  [ -f "$1" ] || return 0
  sed -n "s/^$2=//p" "$1" | tail -n 1
}
etat_poser() { # fichier cle valeur
  local fichier=$1 cle=$2 valeur=$3 provisoire
  valeur=$(printf '%s' "$valeur" | tr -d '\000-\037')
  mkdir -p "$(dirname "$fichier")"
  provisoire=$(mktemp "$fichier.XXXXXX")
  { [ -f "$fichier" ] && grep -v "^$cle=" "$fichier" || true; printf '%s=%s\n' "$cle" "$valeur"; } > "$provisoire"
  mv -f "$provisoire" "$fichier"
}
# Plusieurs valeurs d'un coup : etat_poser_tout fichier CLE valeur [CLE valeur]…
etat_poser_tout() {
  local fichier=$1
  shift
  while [ $# -ge 2 ]; do etat_poser "$fichier" "$1" "$2"; shift 2; done
}

# ---------------------------------------------------------------- bases SQLite
# Les bases d'un dossier db/ : fichiers .db / .sqlite / .sqlite3, hors archives/ (copies déjà figées par le service), metriques/ et essai-de-structure/ (l'échange avec le service pour l'essai d'une livraison : ses copies d'essai sont transitoires).
bases_de() { # dossier db
  (cd "$1" && find . -type f \( -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \) ! -path './archives/*' ! -path './metriques/*' ! -path './essai-de-structure/*' | sed 's|^\./||' | sort)
}
# Nombre de lignes de chaque table d'une base, une ligne « chemin<TAB>table<TAB>n » par table (écrit sur la sortie standard). Les noms de tables
# viennent de sqlite_master et sont entre guillemets (%w double les guillemets internes) : jamais un nom venu d'ailleurs.
comptes_de() { # base chemin_affiche
  local base=$1 nom=$2
  sqlite3 -readonly "$base" "SELECT format('SELECT %Q, count(*) FROM \"%w\";', name, name) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite\_%' ESCAPE '\\' ORDER BY name" 2>/dev/null |
    sqlite3 -readonly -separator "$(printf '\t')" "$base" 2>/dev/null |
    awk -F'\t' -v b="$nom" 'NF == 2 { printf "%s\t%s\t%s\n", b, $1, $2 }' || true
}
# Le contrôle d'une COPIE (jamais d'une base vivante) : sans -readonly, qui ferait taire la vérification des contraintes CHECK. Ouverte en écriture, la
# copie peut y laisser un -wal ou un -shm (retirés ensuite par copie.sh) ; la base d'origine n'est pas concernée.
controle_integrite() { # copie : écrit « ok » ou le premier message d'erreur (« illisible » si sqlite3 n'a rien pu dire : base trop abîmée, code 11)
  local sortie
  sortie=$(sqlite3 "$1" 'PRAGMA integrity_check' 2>&1 | head -n 1) || true
  printf '%s' "${sortie:-illisible}"
}
# ---------------------------------------------------------------- JSON
json_chaine() {
  local s=${1//\\/\\\\}
  s=${s//\"/\\\"}
  printf '"%s"' "$(printf '%s' "$s" | tr -d '\000-\037')"
}
json_date() { # epoch ou vide
  if [ -n "${1:-}" ]; then json_chaine "$(iso_de "$1")"; else printf null; fi
}
json_entier() { case "${1:-}" in ''|*[!0-9]*) printf null ;; *) printf '%s' "$1" ;; esac; }

octets_de() { # chemins… : octets alloués (hors liens), 0 si rien
  local existants=() c n
  for c in "$@"; do [ -e "$c" ] && existants+=("$c"); done
  if [ ${#existants[@]} -eq 0 ]; then echo 0; return; fi
  n=$( { du -s -c -x -B1 -- "${existants[@]}" 2>/dev/null || true; } | tail -n 1 | cut -f1)
  echo "${n:-0}"
}
libre_octets() { # dossier : octets libres pour un utilisateur (df)
  df --output=avail -B1 "$1" 2>/dev/null | tail -n 1 | tr -d ' ' || true
}

# Les copies d'une instance, de la plus ancienne à la plus récente : « type/nom ».
copies_de() { # instance [type…]
  local inst=$1 t
  shift
  [ $# -gt 0 ] || set -- horaire nuit
  for t in "$@"; do
    [ -d "$SAUV/$inst/$t" ] || continue
    (cd "$SAUV/$inst/$t" && find . -mindepth 1 -maxdepth 1 -type d ! -name 'en-cours.*' | sed 's|^\./||') | sed "s|^|$t/|"
  done | awk -F/ '{ print $2 "\t" $0 }' | sort | cut -f2
}
derniere_copie() { copies_de "$1" | tail -n 1; } # « type/nom » de la plus récente copie bonne, vide sans copie

# Le dossier de l'HÔTE où le service d'une instance lit sauvegardes.json (son dossier des métriques : MAVERICK_DOSSIER_METRIQUES du conteneur, sinon
# <MAVERICK_DB>/metriques, serveur/service.mjs). D'abord tel que son conteneur le monte (docker inspect du conteneur « <MAVERICK_CONTENEUR>-serveur ») :
# un docker-compose.yml d'avant les métriques ne monte pas metriques/, son service les range dans db/metriques/. Sans docker ni conteneur, celui que
# docker-compose.yml monterait : MAVERICK_DOSSIER_METRIQUES du .env de l'instance, sinon <instance>/metriques. Écrit « docker|compose <chemin> », rien si
# l'instance est inconnue.
metriques_de_l_instance() { # instance
  local d conteneur montages env dans base dest src meilleur='' hote=''
  d=$(dossier_de "$1") || return 0
  conteneur=$(sed -n 's/^MAVERICK_CONTENEUR=//p' "$d/.env" 2>/dev/null | tail -n 1 | tr -d '"\r' || true)
  if [ -z "$conteneur" ]; then if [ "$1" = prod ]; then conteneur=maverick-center; else conteneur=maverick-center-test; fi; fi
  if command -v "$DOCKER_DES_INSTANCES" >/dev/null 2>&1 &&
    montages=$("$DOCKER_DES_INSTANCES" inspect -f '{{range .Mounts}}{{.Destination}}|{{.Source}}{{println}}{{end}}' "$conteneur-serveur" 2>/dev/null) &&
    env=$("$DOCKER_DES_INSTANCES" inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$conteneur-serveur" 2>/dev/null); then
    dans=$(printf '%s\n' "$env" | sed -n 's/^MAVERICK_DOSSIER_METRIQUES=//p' | tail -n 1)
    if [ -z "$dans" ]; then
      base=$(printf '%s\n' "$env" | sed -n 's/^MAVERICK_DB=//p' | tail -n 1)
      dans="${base:-/db}"
      dans="${dans%/}/metriques"
    fi
    while IFS='|' read -r dest src; do
      [ -n "$dest" ] && [ -n "$src" ] || continue
      case "$dans/" in
        "${dest%/}/"*) if [ "${#dest}" -gt "${#meilleur}" ]; then meilleur=$dest; hote=${src%/}${dans#"${dest%/}"}; fi ;;
      esac
    done <<< "$montages"
    if [ -n "$hote" ]; then printf 'docker %s' "$hote"; return 0; fi
  fi
  dans=$(sed -n 's/^MAVERICK_DOSSIER_METRIQUES=//p' "$d/.env" 2>/dev/null | tail -n 1 | tr -d '"\r' || true)
  case "$dans" in
    '') printf 'compose %s' "$d/metriques" ;;
    /*) printf 'compose %s' "$dans" ;;
    *) printf 'compose %s' "$d/${dans#./}" ;;
  esac
}

# Les dossiers où écrire sauvegardes.json, un par ligne : le dossier des métriques réglé s'il existe (le VPS mis en place par instances.sh : celui des
# deux instances) ; sinon celui que lit le service de chaque instance (metriques_de_l_instance), sans doublon. Un dossier que le conteneur monte (vu par
# docker inspect) est créé s'il manque ; un dossier seulement déduit du .env ne l'est pas (rien ne dit que le conteneur le lit).
dossiers_du_json() {
  if [ -d "$METRIQUES" ]; then printf '%s\n' "$METRIQUES"; return 0; fi
  local inst ligne origine chemin vus=''
  for inst in dev prod; do
    ligne=$(metriques_de_l_instance "$inst")
    [ -n "$ligne" ] || continue
    origine=${ligne%% *}
    chemin=${ligne#* }
    case " $vus " in *" $chemin "*) continue ;; esac
    if [ ! -d "$chemin" ] && [ "$origine" = docker ]; then mkdir -p "$chemin" && chmod 755 "$chemin" || true; fi
    [ -d "$chemin" ] || continue
    vus="$vus $chemin"
    printf '%s\n' "$chemin"
  done
}

# Écrit sauvegardes.json (format 1) dans le dossier des métriques (dossiers_du_json : là où chaque service le lit), d'un coup (fichier provisoire créé
# en exclusivité puis renommage : un lien posé à l'avance dans ce dossier partagé n'est jamais suivi), en 644 : il est lu par les conteneurs, il ne
# porte aucun secret.
ecrire_json() {
  local dossiers dossier contenu
  dossiers=$(dossiers_du_json)
  if [ -z "$dossiers" ]; then echec "dossier des métriques introuvable ($METRIQUES, ni celui d'aucune instance) : état non écrit"; return 0; fi
  [ "$dossiers" = "$METRIQUES" ] || journal "dossier des métriques réglé absent ($METRIQUES) : état écrit là où les services le lisent ($(printf '%s' "$dossiers" | tr '\n' ' '))"
  contenu=$(mktemp "${TMPDIR:-/tmp}/sauvegardes.json.XXXXXX") || return 0
  json_complet > "$contenu"
  while IFS= read -r dossier; do
    ecrire_json_dans "$dossier" "$contenu"
  done <<< "$dossiers"
  rm -f "$contenu"
}

ecrire_json_dans() { # dossier fichier_du_contenu
  local provisoire
  provisoire=$(mktemp "$1/.sauvegardes.json.XXXXXX") || return 0
  cat "$2" > "$provisoire"
  chmod 644 "$provisoire"
  mv -f "$provisoire" "$1/sauvegardes.json"
}

json_complet() {
  charger_reglages
  local maintenant occupe libre inst d sep=''
  maintenant=$(instant)
  occupe=$(octets_de "$SAUV/prod" "$SAUV/dev")
  libre=$(libre_octets "$SAUV")
  {
    printf '{\n  "format": 1, "instant": %s,\n' "$(json_chaine "$(iso_de "$maintenant")")"
    printf '  "locale": { "plafond_octets": %s, "occupe_octets": %s, "libre_min_octets": %s, "disque_libre_octets": %s, "horaires_gardees": %s, "nuits_gardees": %s, "chute_pourcent": %s, "chute_min_lignes": %s, "reglages_illisibles": %s },\n' \
      "$((PLAFOND_MO * 1048576))" "$occupe" "$((LIBRE_MIN_MO * 1048576))" "$(json_entier "$libre")" "$HORAIRES_GARDEES" "$NUITS_GARDEES" "$CHUTE_POURCENT" "$CHUTE_MIN_LIGNES" \
      "$(json_chaine "$REGLAGES_ILLISIBLES")"
    printf '  "instances": {\n'
    for inst in $INSTANCES; do
      d=$ETAT/$inst.env
      printf '%s    "%s": ' "$sep" "$inst"
      sep=$',\n'
      json_instance "$inst" "$d"
    done
    printf '\n  },\n'
    json_exterieur
    printf '\n}\n'
  }
}

json_instance() { # instance fichier_d_etat
  local inst=$1 d=$2 n=0 t
  n=$(copies_de "$inst" | wc -l | tr -d ' ')
  printf '{ "copies": %s, "occupe_octets": %s,\n' "$n" "$(octets_de "$SAUV/$inst")"
  if [ -n "$(etat_lire "$d" COPIE_LE)" ]; then
    printf '      "derniere_copie": { "le": %s, "type": %s, "octets": %s, "lignes": %s },\n' "$(json_date "$(etat_lire "$d" COPIE_LE)")" \
      "$(json_chaine "$(etat_lire "$d" COPIE_TYPE)")" "$(json_entier "$(etat_lire "$d" COPIE_OCTETS)")" "$(json_entier "$(etat_lire "$d" COPIE_LIGNES)")"
  else
    printf '      "derniere_copie": null,\n'
  fi
  t=$(etat_lire "$d" VERIF_LE)
  if [ -n "$t" ]; then
    printf '      "derniere_verification": { "le": %s, "resultat": %s },\n' "$(json_date "$t")" "$(json_chaine "$(etat_lire "$d" VERIF_RESULTAT)")"
  else
    printf '      "derniere_verification": null,\n'
  fi
  if [ -n "$(etat_lire "$d" ALERTE_LE)" ]; then
    printf '      "alerte": { "le": %s, "code": %s, "detail": %s, "en_cours": %s }' "$(json_date "$(etat_lire "$d" ALERTE_LE)")" \
      "$(json_chaine "$(etat_lire "$d" ALERTE_CODE)")" "$(json_chaine "$(etat_lire "$d" ALERTE_DETAIL)")" \
      "$([ "$(etat_lire "$d" ALERTE_EN_COURS)" = 1 ] && echo true || echo false)"
  else
    printf '      "alerte": null'
  fi
  printf ' }'
}

json_exterieur() {
  local e=$ETAT/exterieur.env active=false
  [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] && active=true
  printf '  "exterieur": { "active": %s,\n' "$active"
  if [ -n "$(etat_lire "$e" ENVOI_LE)" ]; then
    printf '    "dernier_envoi": { "le": %s, "ok": %s, "code": %s, "instances": %s },\n' "$(json_date "$(etat_lire "$e" ENVOI_LE)")" \
      "$([ "$(etat_lire "$e" ENVOI_RESULTAT)" = ok ] && echo true || echo false)" "$(json_code "$(etat_lire "$e" ENVOI_CODE)")" \
      "$(json_chaine "$(etat_lire "$e" ENVOI_INSTANCES)")"
  else
    printf '    "dernier_envoi": null,\n'
  fi
  if [ -n "$(etat_lire "$e" CONTROLE_LE)" ]; then
    printf '    "dernier_controle": { "le": %s, "ok": %s, "donnees_relues": %s },\n' "$(json_date "$(etat_lire "$e" CONTROLE_LE)")" \
      "$([ "$(etat_lire "$e" CONTROLE_RESULTAT)" = ok ] && echo true || echo false)" "$([ "$(etat_lire "$e" CONTROLE_DONNEES)" = 1 ] && echo true || echo false)"
  else
    printf '    "dernier_controle": null,\n'
  fi
  if [ -n "$(etat_lire "$e" ESSAI_LE)" ]; then
    printf '    "dernier_essai": { "le": %s, "ok": %s, "code": %s, "duree_s": %s, "instances": %s }' "$(json_date "$(etat_lire "$e" ESSAI_LE)")" \
      "$([ "$(etat_lire "$e" ESSAI_RESULTAT)" = ok ] && echo true || echo false)" "$(json_code "$(etat_lire "$e" ESSAI_CODE)")" \
      "$(json_entier "$(etat_lire "$e" ESSAI_DUREE_S)")" "$(json_chaine "$(etat_lire "$e" ESSAI_INSTANCES)")"
  else
    printf '    "dernier_essai": null'
  fi
  printf ' }'
}
json_code() { if [ -n "${1:-}" ]; then json_chaine "$1"; else printf null; fi; }

# Un seul traitement à la fois (copie, envoi, essai) : le verrou est tenu pendant toute l'exécution. $1 : secondes d'attente.
prendre_le_verrou() {
  mkdir -p "$SAUV"
  exec 9> "$SAUV/.verrou"
  if ! flock -w "${1:-0}" 9; then
    journal "un autre traitement de sauvegarde est en cours : rien à faire cette fois"
    return 1
  fi
}

# Le secret ne passe jamais dans un message : seuls des codes courts et des noms de tables sont écrits dans l'état.
nettoyer_detail() { printf '%s' "$1" | tr -d '\000-\037"\\' | cut -c1-200; }
