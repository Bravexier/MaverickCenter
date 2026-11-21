#!/bin/sh
# Le geste : met en place l'atelier du site de dev, en une commande lancée une fois, depuis le serveur (lot 9 du chantier de la base de dev ; docs/serveur.md,
# « Atelier du site de dev » ; deploy/vps/README.md, « Atelier du site de dev ») :
#
#   sudo sh /srv/maverick-center-test/atelier/installer.sh [options]
#
# Sans option, la commande :
#   1. vérifie : root, instance de test, Docker (qui répond), cgroup v2, kit posé par l'installateur de test (atelier/kit/) ;
#   2. écrit les réglages dans atelier/reglages.env (root, jamais le site de dev) et prépare les dossiers de l'atelier ;
#   3. prépare l'image Docker du kit (kit.json, validée par une expression stricte) : téléchargée seulement si elle manque ;
#   4. pose les unités systemd : maverick-atelier.path (surveille la marque que l'installateur de test pose à chaque livraison) et maverick-atelier.service ;
#   5. écrit rapports/installe.json (le service en déduit « atelier installé ») et, dans le dossier de l'instance de test seulement, docker-compose.override.yml (que
#      compose lit de lui-même : le montage des rapports en lecture seule, celui du dépôt de l'atelier (<atelier>/depot/, créé ici par root : le service y fabrique l'extrait) et leurs variables ; le docker-compose.yml livré, commun à la production, ne change pas), puis
#      lance « docker compose up -d » : cela relance le service du site de dev quelques secondes ; le site, lui, reste servi. Un docker-compose.override.yml qui n'est pas
#      celui de l'atelier est respecté : la commande s'arrête, sans rien écrire, et dit quoi faire ;
#   6. lance une première fabrication et dit où regarder.
# Relançable sans dégât : elle reprend les réglages déjà posés (une option ne change que le sien) et ne refait que ce qui manque.
#   --memoire-max <taille>  plafond de mémoire du conteneur, « 2.5g » par défaut (aussi « 2500m ») ; la fabrication prend aussi au plus la moitié de la mémoire disponible
#   --besoin <taille>       mémoire dont une fabrication a besoin, « 1.1g » par défaut (le plus petit plafond essayé qui réussit) : sous 2 × le besoin de mémoire disponible, la fabrication est refusée (et mesurée)
#   --cpus <nombre>         processeurs du conteneur, 1 par défaut (« 0.5 », « 2 »)
#   --disque-min <taille>   espace libre minimal, « 2g » par défaut : en dessous, la fabrication est refusée (et mesurée)
#   --delai <secondes>      durée maximale d'une fabrication, 1800 par défaut, puis arrêt
#   --client-google <id>    l'identifiant client OAuth du bouton « Exporter » (variable GOOGLE_CLIENT_ID du dépôt) : sans lui, le site témoin diffère du site livré par ce seul bouton
#   --jours-de-mesure <n>   la journée type dure n jours (1 par défaut) à compter de ce geste ou de sa relance : pendant ce temps, le minuteur du jour (toutes les 20 minutes entre 8 h et 20 h)
#                           ajoute des fabrications jusqu'à 10 dans la journée, au moins 40 minutes après la dernière ; la nuit (04:30), elle, continue toujours
#   --max-par-jour <n>      au plus n fabrications par jour (12 par défaut), toutes origines confondues, livraisons comprises ; au-delà, un rapport court le dit
#   --dossier-prod <dir>    le dossier de l'instance de production, dont la sonde lit le port (par défaut le voisin « maverick-center »)
#   --sans-fabrication      ne pas lancer la première fabrication
#   --sans-montage          n'écrit pas docker-compose.override.yml : pour un fichier de ce nom qui n'est pas celui de l'atelier et où le montage a été ajouté à la main
#   --servir                l'atelier SERT ce qu'il fabrique (lot 11, « Bascule 2 », PR 3b) : pose l'interrupteur <atelier>/servir (un fichier de root, le fichier est la preuve) et le minuteur
#                           maverick-atelier-contenu.timer (toutes les 10 minutes : il ne refabrique que si l'extrait du contenu a changé depuis le dernier site posé). Après chaque fabrication
#                           réussie, le site fabriqué est posé à la place de site/ (jamais _serveur/), par un second conteneur sans privilège ; sans l'interrupteur, rien de servi ne change.
#                           Éteint par défaut ; atelier déjà installé exigé (relançable sans dégât)
#   --pages-minimum <pct>   avec --servir : le site fabriqué doit compter au moins ce pourcentage des pages HTML du site servi (90 par défaut ; refus « site_trop_petit » sinon)
#   --ne-plus-servir        retire l'interrupteur et le minuteur : l'atelier refait de nouveau un site témoin sans le poser. Le site déjà posé reste servi jusqu'à la prochaine installation ;
#                           pour revenir tout de suite au site livré par GitHub : sudo sh <instance>/mise-a-jour.sh --force
#   --max-contenu-par-jour <n>  au plus n fabrications par jour qui suivent un changement de contenu (48 par défaut, 1 à 288), comptées à part des autres origines
#   --etat                  dit où en est l'atelier (réglages, unités, dernière fabrication, ce que la mémoire d'aujourd'hui permettrait), sans rien changer
#   --retirer               arrête et retire les unités, les réglages, les dossiers de travail, les rapports et docker-compose.override.yml (puis « docker compose up -d », qui relance le
#                           service quelques secondes) ; le kit reste
# Réglages de test seulement : MAVERICK_ATELIER_ESSAI=1 (ni root ni systemd réels exigés), MAVERICK_DIR_ETC_SYSTEMD, MAVERICK_ATELIER_CGROUP, MAVERICK_ATELIER_PROC (lib.sh).
set -eu
umask 022

ICI=$(cd "$(dirname "$0")" && pwd -P)
if [ -f "$ICI/outils/lib.sh" ]; then OUTILS=$ICI/outils; else OUTILS=$ICI; fi
# shellcheck source=lib.sh
. "$OUTILS/lib.sh"
ATELIER=$ICI
INSTANCE=$(dirname "$ATELIER")
RAPPORTS=$ATELIER/rapports
REGLAGES=$ATELIER/reglages.env
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
UNITE=maverick-atelier
# Le fichier que compose lit de lui-même à côté de docker-compose.yml : écrit par ce geste seulement, reconnu à sa première ligne, jamais livré ni touché par l'installateur.
OVERRIDE=$INSTANCE/docker-compose.override.yml
MARQUE_DU_FICHIER='# maverick-atelier : fichier écrit par atelier/installer.sh'
override_de_l_atelier() { [ -f "$OVERRIDE" ] && [ "$(head -n 1 "$OVERRIDE" 2>/dev/null)" = "$MARQUE_DU_FICHIER" ]; }
relancer_le_service() { # raison
  if command -v docker >/dev/null 2>&1 && [ -f "$INSTANCE/docker-compose.yml" ]; then
    echo "== docker compose up -d dans $INSTANCE : le service du site de dev redémarre quelques secondes ($1 ; le site reste servi)"
    (cd "$INSTANCE" && docker compose up -d) >/dev/null 2>&1 || echo "Avertissement : « docker compose up -d » a échoué dans $INSTANCE : à relancer à la main."
  fi
}

die() { echo "ERREUR : $*" >&2; exit 1; }
USAGE="Usage : sudo sh $0 [--memoire-max <taille>] [--besoin <taille>] [--cpus <n>] [--disque-min <taille>] [--delai <s>] [--client-google <id>] [--jours-de-mesure <n>] [--max-par-jour <n>] [--dossier-prod <dossier>] [--sans-fabrication] [--sans-montage] [--servir [--pages-minimum <pct>]] [--ne-plus-servir] [--max-contenu-par-jour <n>] [--etat] [--retirer]"
MEMOIRE_MAX=''; BESOIN=''; CPUS_DEMANDES=''; DISQUE_MIN=''; DELAI=''; GOOGLE_DEMANDE=''; JOURS=''; MAX_JOUR=''; DOSSIER_PROD_DEMANDE=''; SANS_FABRICATION=0; SANS_MONTAGE=0; ETAT=0; RETIRER=0; SERVIR_DEMANDE=0; NE_PLUS_SERVIR=0; PAGES_MIN_DEMANDE=''; MAX_CONTENU=''
while [ $# -gt 0 ]; do
  case "$1" in
    --memoire-max) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; MEMOIRE_MAX=$2; shift 2 ;;
    --besoin) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; BESOIN=$2; shift 2 ;;
    --cpus) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; CPUS_DEMANDES=$2; shift 2 ;;
    --disque-min) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; DISQUE_MIN=$2; shift 2 ;;
    --delai) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; DELAI=$2; shift 2 ;;
    --client-google) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; GOOGLE_DEMANDE=$2; shift 2 ;;
    --jours-de-mesure) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; JOURS=$2; shift 2 ;;
    --max-par-jour) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; MAX_JOUR=$2; shift 2 ;;
    --dossier-prod) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; DOSSIER_PROD_DEMANDE=$2; shift 2 ;;
    --sans-fabrication) SANS_FABRICATION=1; shift ;;
    --sans-montage) SANS_MONTAGE=1; shift ;;
    --servir) SERVIR_DEMANDE=1; shift ;;
    --ne-plus-servir) NE_PLUS_SERVIR=1; shift ;;
    --pages-minimum) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; PAGES_MIN_DEMANDE=$2; shift 2 ;;
    --max-contenu-par-jour) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; MAX_CONTENU=$2; shift 2 ;;
    --etat) ETAT=1; shift ;;
    --retirer) RETIRER=1; shift ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
[ "$ETAT" -eq 0 ] || [ "$RETIRER" -eq 0 ] || { echo "--etat et --retirer s'excluent" >&2; exit 2; }
[ "$SERVIR_DEMANDE" -eq 0 ] || [ "$NE_PLUS_SERVIR" -eq 0 ] || { echo "--servir et --ne-plus-servir s'excluent" >&2; exit 2; }
[ $((SERVIR_DEMANDE + NE_PLUS_SERVIR)) -eq 0 ] || [ $((ETAT + RETIRER)) -eq 0 ] || { echo "--servir et --ne-plus-servir ne se combinent ni avec --etat ni avec --retirer" >&2; exit 2; }
[ -z "$PAGES_MIN_DEMANDE" ] || [ "$SERVIR_DEMANDE" -eq 1 ] || { echo "--pages-minimum ne va qu'avec --servir" >&2; exit 2; }
[ -z "$MAX_CONTENU" ] || [ "$SERVIR_DEMANDE$NE_PLUS_SERVIR" = 00 ] || { echo "--max-contenu-par-jour ne va pas avec --servir ni --ne-plus-servir (un réglage se pose par un geste sans eux)" >&2; exit 2; }

# Les valeurs demandées, validées avant toute écriture (jamais une valeur qui irait telle quelle dans un fichier ou une commande).
if [ -n "$MEMOIRE_MAX" ]; then MEMOIRE_MAX_KO=$(taille_en_ko "$MEMOIRE_MAX") || { echo "--memoire-max : une taille comme 2.5g ou 2500m (reçu « $MEMOIRE_MAX »)" >&2; exit 2; }; fi
if [ -n "$BESOIN" ]; then BESOIN_KO=$(taille_en_ko "$BESOIN") || { echo "--besoin : une taille comme 1.5g ou 1500m (reçu « $BESOIN »)" >&2; exit 2; }; fi
if [ -n "$DISQUE_MIN" ]; then DISQUE_MIN_KO=$(taille_en_ko "$DISQUE_MIN") || { echo "--disque-min : une taille comme 2g ou 2000m (reçu « $DISQUE_MIN »)" >&2; exit 2; }; fi
if [ -n "$CPUS_DEMANDES" ]; then valide_cpus "$CPUS_DEMANDES" || { echo "--cpus : un nombre entre 0.1 et 64 (reçu « $CPUS_DEMANDES »)" >&2; exit 2; }; fi
if [ -n "$DELAI" ]; then entier_positif "$DELAI" && [ "$DELAI" -le 86400 ] || { echo "--delai : un nombre de secondes entre 1 et 86400 (reçu « $DELAI »)" >&2; exit 2; }; fi
if [ -n "$JOURS" ]; then entier_positif "$JOURS" && [ "$JOURS" -le 30 ] || { echo "--jours-de-mesure : un nombre de jours entre 1 et 30 (reçu « $JOURS »)" >&2; exit 2; }; fi
if [ -n "$MAX_JOUR" ]; then entier_positif "$MAX_JOUR" && [ "$MAX_JOUR" -le 48 ] || { echo "--max-par-jour : un nombre entre 1 et 48 (reçu « $MAX_JOUR »)" >&2; exit 2; }; fi
if [ -n "$MAX_CONTENU" ]; then entier_positif "$MAX_CONTENU" && [ "$MAX_CONTENU" -le 288 ] || { echo "--max-contenu-par-jour : un nombre entre 1 et 288 (reçu « $MAX_CONTENU »)" >&2; exit 2; }; fi
if [ -n "$PAGES_MIN_DEMANDE" ]; then
  case "$PAGES_MIN_DEMANDE" in ''|*[!0-9]*) echo "--pages-minimum : un pourcentage entre 0 et 100 (reçu « $PAGES_MIN_DEMANDE »)" >&2; exit 2 ;; esac
  [ "$PAGES_MIN_DEMANDE" -le 100 ] || { echo "--pages-minimum : un pourcentage entre 0 et 100 (reçu « $PAGES_MIN_DEMANDE »)" >&2; exit 2; }
fi
if [ -n "$DOSSIER_PROD_DEMANDE" ]; then
  case "$DOSSIER_PROD_DEMANDE" in /*[!A-Za-z0-9._/-]*|[!/]*|'') echo "--dossier-prod : un chemin absolu sans espace ni caractère spécial (reçu « $DOSSIER_PROD_DEMANDE »)" >&2; exit 2 ;; esac
fi
if [ -n "$GOOGLE_DEMANDE" ]; then
  case "$GOOGLE_DEMANDE" in *[!A-Za-z0-9._-]*|'') echo "--client-google : des lettres, chiffres, points, tirets (reçu « $GOOGLE_DEMANDE »)" >&2; exit 2 ;; esac
fi
if [ -n "$MEMOIRE_MAX" ] && [ -n "$BESOIN" ] && [ "$MEMOIRE_MAX_KO" -lt "$BESOIN_KO" ]; then echo "--memoire-max est inférieur à --besoin : aucune fabrication ne démarrerait" >&2; exit 2; fi

[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo sh $0" >&2; exit 1; }
case "$ATELIER" in /*[!A-Za-z0-9._/-]*) die "le chemin de l'atelier ($ATELIER) porte des caractères que les unités systemd ne peuvent pas citer sûrement" ;; esac

mode=$(sed -n 's/^mode=//p' "$INSTANCE/VERSION" 2>/dev/null | head -n 1)
[ "$mode" = test ] || die "$INSTANCE n'est pas une instance de test (fichier VERSION) : l'atelier n'existe que pour le site de dev."
command -v systemctl >/dev/null 2>&1 || die "systemctl est absent : l'atelier se pilote par systemd."

# ---------------------------------------------------------------- retirer
retirer() {
  systemctl disable --now "$UNITE.path" "$UNITE-nuit.timer" "$UNITE-jour.timer" "$UNITE-contenu.timer" >/dev/null 2>&1 || true
  systemctl stop "$UNITE.service" "$UNITE-nuit.service" "$UNITE-jour.service" "$UNITE-contenu.service" >/dev/null 2>&1 || true
  rm -f "$ETC_SYSTEMD/$UNITE.path" "$ETC_SYSTEMD/$UNITE.service" "$ETC_SYSTEMD/$UNITE.slice" "$ETC_SYSTEMD/$UNITE-nuit.timer" "$ETC_SYSTEMD/$UNITE-nuit.service" "$ETC_SYSTEMD/$UNITE-jour.timer" "$ETC_SYSTEMD/$UNITE-jour.service" "$ETC_SYSTEMD/$UNITE-contenu.timer" "$ETC_SYSTEMD/$UNITE-contenu.service"
  systemctl daemon-reload >/dev/null 2>&1 || true
  rm -f "$REGLAGES" "$RAPPORTS/installe.json" "$RAPPORTS/en-cours.json" "$RAPPORTS/servir.json" "$ATELIER/servir" "$ATELIER/declencheur/dernier-contenu"
  if override_de_l_atelier; then
    rm -f "$OVERRIDE"
    retrait_du_montage=1
  elif [ -e "$OVERRIDE" ]; then
    echo "Avertissement : $OVERRIDE n'est pas celui de l'atelier : il est laissé tel quel."
  fi
  for d in contenu travail sortie resultats pose; do [ ! -d "$ATELIER/$d" ] || { find "$ATELIER/$d" -mindepth 1 -delete 2>/dev/null || true; rmdir "$ATELIER/$d" 2>/dev/null || true; }; done
  if [ -d "$RAPPORTS" ]; then
    for r in $(ls -1 "$RAPPORTS" | grep -E '^[0-9]{8}-[0-9]{6}$' || true); do rm -rf "${RAPPORTS:?}/$r"; done
  fi
  [ "${retrait_du_montage:-0}" -eq 0 ] || relancer_le_service "les montages de l'atelier sont retirés"
  # le dépôt, une fois le service relancé sans son montage (find ne suit aucun lien)
  if [ -d "$ATELIER/depot" ] && [ ! -L "$ATELIER/depot" ]; then find "$ATELIER/depot" -mindepth 1 -delete 2>/dev/null || true; rmdir "$ATELIER/depot" 2>/dev/null || true; fi
  echo "Atelier retiré : unités, réglages, dossiers de travail, rapports et docker-compose.override.yml. Le kit ($ATELIER/kit) reste. Le site et la production ne changent pas."
}
if [ "$RETIRER" -eq 1 ]; then retirer; exit 0; fi

# ---------------------------------------------------------------- état
parler_de_l_etat() {
  echo "Instance : $INSTANCE (test)"
  if [ -f "$ATELIER/kit/kit.json" ]; then
    echo "Kit : version $(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ATELIER/kit/kit.json" | head -n 1), image $(sed -n 's/.*"image": *"\([^"]*\)".*/\1/p' "$ATELIER/kit/kit.json" | head -n 1)"
  else
    echo "Kit : absent (le prochain installateur de test le pose, s'il y a de la place)."
  fi
  if [ -f "$REGLAGES" ]; then
    echo "Réglages ($REGLAGES) : mémoire max $(champ_du_fichier "$REGLAGES" MEMOIRE_MAX_KO) ko, besoin $(champ_du_fichier "$REGLAGES" BESOIN_KO) ko, cpus $(champ_du_fichier "$REGLAGES" CPUS), disque min $(champ_du_fichier "$REGLAGES" DISQUE_MIN_KO) ko, délai $(champ_du_fichier "$REGLAGES" DELAI_S) s"
  else
    echo "Réglages : atelier non installé (sudo sh $ATELIER/installer.sh)."
  fi
  echo "Unités : path $(systemctl is-enabled "$UNITE.path" 2>/dev/null || echo absente) / $(systemctl is-active "$UNITE.path" 2>/dev/null || echo inactive) ; service $(systemctl is-active "$UNITE.service" 2>/dev/null || echo inactive) ; minuteur de nuit $(systemctl is-active "$UNITE-nuit.timer" 2>/dev/null || echo inactif) ; minuteur du jour $(systemctl is-active "$UNITE-jour.timer" 2>/dev/null || echo inactif)"
  if [ -f "$REGLAGES" ]; then
    depuis=$(champ_du_fichier "$REGLAGES" MESURE_DEPUIS); jours=$(champ_du_fichier "$REGLAGES" JOURS_DE_MESURE)
    if entier_positif "${depuis:-0}" && entier_positif "${jours:-0}"; then
      fin=$((depuis + jours * 86400))
      echo "Journée type : fenêtre de mesure de $jours jour(s), du $(date -u -d "@$depuis" '+%Y-%m-%d %H:%M') au $(date -u -d "@$fin" '+%Y-%m-%d %H:%M') UTC ($([ "$(epoch_maintenant)" -lt "$fin" ] && echo ouverte || echo fermée)) ; au plus $(champ_du_fichier "$REGLAGES" MAX_PAR_JOUR) fabrications par jour"
    fi
  fi
  if [ -f "$ATELIER/servir" ] && [ ! -L "$ATELIER/servir" ]; then
    echo "Site servi par l'atelier : OUI (interrupteur $ATELIER/servir, pages minimum $(champ_du_fichier "$ATELIER/servir" PAGES_MINIMUM_PCT) %) ; minuteur du contenu $(systemctl is-active "$UNITE-contenu.timer" 2>/dev/null || echo inactif) ; retour : sudo sh $ATELIER/installer.sh --ne-plus-servir"
  else
    echo "Site servi par l'atelier : non (l'atelier fabrique un site témoin sans le poser ; sudo sh $ATELIER/installer.sh --servir pour le servir)."
  fi
  derniers=$(ls -1 "$RAPPORTS" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | head -n 3 || true)
  if [ -n "$derniers" ]; then
    for r in $derniers; do echo "Rapport $r : $(sed -n 's/^ *"issue": *"\([a-z]*\)".*/\1/p' "$RAPPORTS/$r/rapport.json" 2>/dev/null | head -n 1) $(sed -n 's/^ *"motif": *"\([a-z_]*\)".*/\1/p' "$RAPPORTS/$r/rapport.json" 2>/dev/null | head -n 1)"; done
  else
    echo "Rapports : aucun."
  fi
  total=$(meminfo_ko MemTotal); dispo=$(meminfo_ko MemAvailable)
  max=$(champ_du_fichier "$REGLAGES" MEMOIRE_MAX_KO); max=${max:-$DEFAUT_MEMOIRE_MAX_KO}; besoin=$(champ_du_fichier "$REGLAGES" BESOIN_KO); besoin=${besoin:-$DEFAUT_BESOIN_KO}
  if [ -n "$total" ] && [ -n "$dispo" ]; then
    calculer_le_plafond "$total" "$dispo" "$max" "$besoin"
    echo "Mémoire maintenant : $(dire_la_memoire "$total" "$dispo" "$besoin" "$ATELIER/installer.sh" "$max")"
  fi
  echo "Page Debug du site de dev, menu DB, bloc « Atelier » ; journal : journalctl -u $UNITE.service."
}
if [ "$ETAT" -eq 1 ]; then parler_de_l_etat; exit 0; fi

# ---------------------------------------------------------------- servir ce que l'atelier fabrique (lot 11, PR 3b)
# L'interrupteur est le fichier <atelier>/servir, à root : le fichier est la preuve (comme reglages.env). Absent, l'atelier ne pose rien. Avec lui, maverick-atelier-contenu.timer (toutes les
# 10 minutes) lance « lancer.sh --origine contenu », qui ne fabrique que si l'extrait du contenu a changé depuis le dernier site posé.
poser_le_minuteur_du_contenu() {
  delai_unite=$(champ_du_fichier "$REGLAGES" DELAI_S); delai_unite=${delai_unite:-$DEFAUT_DELAI_S}
  cat > "$ETC_SYSTEMD/$UNITE-contenu.service" <<UNITE_CONTENU_SERVICE
[Unit]
Description=Atelier du site de dev : refabrication du site servi quand le contenu a changé
After=docker.service
Wants=docker.service
ConditionPathExists=$REGLAGES
ConditionPathExists=$ATELIER/servir

[Service]
Type=oneshot
ExecStart=/bin/sh $OUTILS/lancer.sh --origine contenu
Nice=19
IOSchedulingClass=idle
CPUWeight=20
TimeoutStartSec=$((delai_unite + 2400))
UNITE_CONTENU_SERVICE
  cat > "$ETC_SYSTEMD/$UNITE-contenu.timer" <<UNITE_CONTENU_MINUTEUR
[Unit]
Description=Atelier du site de dev : le contenu a-t-il changé depuis le dernier site posé ? (toutes les 10 minutes)

[Timer]
OnCalendar=*:0/10
Persistent=false

[Install]
WantedBy=timers.target
UNITE_CONTENU_MINUTEUR
  chmod 644 "$ETC_SYSTEMD/$UNITE-contenu.service" "$ETC_SYSTEMD/$UNITE-contenu.timer"
}
if [ "$NE_PLUS_SERVIR" -eq 1 ]; then
  systemctl disable --now "$UNITE-contenu.timer" >/dev/null 2>&1 || true
  systemctl stop "$UNITE-contenu.service" >/dev/null 2>&1 || true
  rm -f "$ETC_SYSTEMD/$UNITE-contenu.timer" "$ETC_SYSTEMD/$UNITE-contenu.service" "$ATELIER/servir" "$RAPPORTS/servir.json" "$ATELIER/declencheur/dernier-contenu"
  systemctl daemon-reload >/dev/null 2>&1 || true
  echo "L'atelier ne sert plus ce qu'il fabrique : interrupteur et minuteur retirés. Une fabrication en cours se termine sans poser de site."
  echo "Le site déjà posé reste servi jusqu'à la prochaine installation. Pour revenir tout de suite au site livré par GitHub : sudo sh $INSTANCE/mise-a-jour.sh --force"
  exit 0
fi
if [ "$SERVIR_DEMANDE" -eq 1 ]; then
  [ -f "$REGLAGES" ] || die "l'atelier n'est pas installé ($REGLAGES est absent) : lancez d'abord sudo sh $ATELIER/installer.sh"
  [ -f "$ATELIER/kit/client/scripts/poser-un-site.mjs" ] || die "le kit ne porte pas client/scripts/poser-un-site.mjs : il est posé par l'installateur du site de dev ; relancez cette commande après sa prochaine livraison."
  command -v docker >/dev/null 2>&1 || die "docker est absent."
  # Sans la base source (le marqueur db/source, posé par bascule.sh), la base vivante est refaite à chaque changement de site/donnees/maverick.db : chaque pose la referait, et des saisies du site de dev s'y perdraient.
  [ -e "$INSTANCE/db/source" ] || die "$INSTANCE/db/source est absent : la base de cette instance n'est pas la source de vérité, et chaque pose du site refabriqué referait la base vivante (les saisies du site de dev s'y perdraient). Rien n'a été écrit. Le marqueur se pose par « sudo bash $INSTANCE/bascule.sh poser » (après un constat et une sauvegarde nommée : docs/serveur.md, « Base source (lot 8) ») ; relancez ensuite --servir."
  pourcentage=${PAGES_MIN_DEMANDE:-$(champ_du_fichier "$ATELIER/servir" PAGES_MINIMUM_PCT)}
  pourcentage=${pourcentage:-$DEFAUT_PAGES_MINIMUM_PCT}
  depuis=$(maintenant_iso)
  mkdir -p "$RAPPORTS" "$ATELIER/declencheur" "$ATELIER/pose"
  {
    echo "# Interrupteur de l'atelier (lot 11, PR 3b) : ce fichier, à root, fait servir ce que l'atelier fabrique. Posé par « installer.sh --servir », retiré par « installer.sh --ne-plus-servir » ;"
    echo "# jamais écrit par le site de dev. Relu champ par champ par outils/lancer.sh."
    echo "SERVIR_DEPUIS=$depuis"
    echo "PAGES_MINIMUM_PCT=$pourcentage"
  } > "$ATELIER/servir.neuf"
  chmod 644 "$ATELIER/servir.neuf"
  mv -f "$ATELIER/servir.neuf" "$ATELIER/servir"
  printf '{ "format": "maverick-atelier-servir/1", "depuis": "%s", "pages_minimum_pct": %s }\n' "$depuis" "$(json_nombre "$pourcentage")" > "$RAPPORTS/servir.json.neuf"
  chmod 644 "$RAPPORTS/servir.json.neuf"
  mv -f "$RAPPORTS/servir.json.neuf" "$RAPPORTS/servir.json"
  # un nouveau départ : le premier minuteur refabrique et pose, même si l'extrait n'a pas changé depuis un ancien site posé
  rm -f "$ATELIER/declencheur/dernier-contenu"
  poser_le_minuteur_du_contenu
  systemctl daemon-reload
  systemctl enable --now "$UNITE-contenu.timer" >/dev/null
  echo "== L'atelier SERT maintenant ce qu'il fabrique : interrupteur $ATELIER/servir, minuteur $UNITE-contenu (toutes les 10 minutes), site fabriqué posé à la place de $INSTANCE/site après chaque fabrication réussie (jamais _serveur/), pages minimum $pourcentage %."
  if [ "$SANS_FABRICATION" -eq 0 ]; then
    systemctl start --no-block "$UNITE-contenu.service" >/dev/null 2>&1 || echo "Avertissement : la fabrication n'a pas pu être lancée (systemctl start $UNITE-contenu.service) ; le minuteur la lancera dans 10 minutes au plus."
    echo "== Première fabrication lancée : le site fabriqué sera posé dans quelques minutes."
  fi
  echo "Où regarder : page Debug du site de dev, bloc « Atelier » (ligne « Site servi ») ; journalctl -u $UNITE-contenu.service ; sudo sh $ATELIER/installer.sh --etat."
  echo "Retour en arrière : sudo sh $ATELIER/installer.sh --ne-plus-servir, puis sudo sh $INSTANCE/mise-a-jour.sh --force (à chaque installation, le site livré par GitHub revient jusqu'à la fabrication suivante)."
  exit 0
fi

# ---------------------------------------------------------------- vérifications
if [ "$SANS_MONTAGE" -eq 0 ] && [ -e "$OVERRIDE" ] && ! override_de_l_atelier; then
  die "$OVERRIDE existe et n'est pas celui de l'atelier (sa première ligne n'est pas « $MARQUE_DU_FICHIER »). Rien n'a été écrit. Ajoutez-y à la main, sous « serveur: », « environment: » MAVERICK_ATELIER: /atelier et MAVERICK_ATELIER_DEPOT: /atelier-depot, et « volumes: » ./atelier/rapports:/atelier:ro et ./atelier/depot:/atelier-depot, puis relancez avec --sans-montage ; ou déplacez ce fichier et relancez sans option."
fi
[ -f "$ATELIER/kit/kit.json" ] && [ -f "$ATELIER/kit/client/package.json" ] || die "le kit est absent ($ATELIER/kit) : il est posé par l'installateur du site de dev (installateur de test) ; relancez cette commande après sa prochaine livraison."
IMAGE=$(sed -n 's/.*"image": *"\([^"]*\)".*/\1/p' "$ATELIER/kit/kit.json" | head -n 1)
printf '%s\n' "$IMAGE" | grep -Eq "$MOTIF_IMAGE" || die "l'image du kit (« $IMAGE ») n'est pas de la forme node:<version>-bookworm-slim ou -alpine : refus."
command -v docker >/dev/null 2>&1 || die "docker est absent."
docker info >/dev/null 2>&1 || die "Docker ne répond pas (docker info)."
[ -f "$CGROUP/cgroup.controllers" ] || die "cgroup v2 absent ($CGROUP/cgroup.controllers) : l'atelier mesure la mémoire du conteneur par le cgroup v2."
for outil in flock dd df awk; do command -v "$outil" >/dev/null 2>&1 || die "$outil est absent."; done
[ -f "$OUTILS/lancer.sh" ] && [ -f "$OUTILS/conteneur.sh" ] || die "lancer.sh est introuvable ($OUTILS) : relancez l'installateur du site de dev."

# ---------------------------------------------------------------- réglages (ceux déjà posés, puis ceux demandés)
repris() { # nom défaut
  valeur=$(champ_du_fichier "$REGLAGES" "$1")
  if [ -n "$valeur" ]; then printf '%s' "$valeur"; else printf '%s' "$2"; fi
}
: "${MEMOIRE_MAX_KO:=$(repris MEMOIRE_MAX_KO "$DEFAUT_MEMOIRE_MAX_KO")}"
: "${BESOIN_KO:=$(repris BESOIN_KO "$DEFAUT_BESOIN_KO")}"
# l'ancien besoin par défaut (1,5 Go) n'a jamais été choisi : repris d'un atelier déjà installé, il passe au nouveau défaut (un --besoin donné à ce geste est toujours respecté)
if [ -z "$BESOIN" ] && [ "$BESOIN_KO" = "$ANCIEN_DEFAUT_BESOIN_KO" ]; then
  BESOIN_KO=$DEFAUT_BESOIN_KO
  echo "== Besoin : l'ancien défaut ($ANCIEN_DEFAUT_BESOIN_KO ko) n'est pas repris ; nouveau défaut $DEFAUT_BESOIN_KO ko (une valeur égale à l'ancien défaut est remplacée par le nouveau à chaque geste sans --besoin : pour garder environ 1,5 Go, donner une autre taille, par exemple --besoin 1.6g)."
fi
: "${DISQUE_MIN_KO:=$(repris DISQUE_MIN_KO "$DEFAUT_DISQUE_MIN_KO")}"
CPUS=${CPUS_DEMANDES:-$(repris CPUS "$DEFAUT_CPUS")}
DELAI_S=${DELAI:-$(repris DELAI_S "$DEFAUT_DELAI_S")}
GOOGLE=${GOOGLE_DEMANDE:-$(repris GOOGLE_CLIENT_ID '')}
JOURS_DE_MESURE=${JOURS:-$(repris JOURS_DE_MESURE "$DEFAUT_JOURS_DE_MESURE")}
MAX_PAR_JOUR=${MAX_JOUR:-$(repris MAX_PAR_JOUR "$DEFAUT_MAX_PAR_JOUR")}
MAX_CONTENU_PAR_JOUR=${MAX_CONTENU:-$(repris MAX_CONTENU_PAR_JOUR "$DEFAUT_MAX_CONTENU_PAR_JOUR")}
DOSSIER_PROD=${DOSSIER_PROD_DEMANDE:-$(repris DOSSIER_PROD "$(dirname "$INSTANCE")/maverick-center")}
# la fenêtre de la journée type s'ouvre à chaque geste, première fois ou relance
MESURE_DEPUIS=$(epoch_maintenant)
[ "$MEMOIRE_MAX_KO" -ge "$BESOIN_KO" ] || die "la mémoire maximale ($MEMOIRE_MAX_KO ko) est inférieure au besoin ($BESOIN_KO ko) : aucune fabrication ne démarrerait."

mkdir -p "$ATELIER/declencheur" "$RAPPORTS" "$ATELIER/depot" "$ATELIER/travail" "$ATELIER/sortie" "$ATELIER/resultats"
chmod 755 "$ATELIER/declencheur" "$RAPPORTS" "$ATELIER/depot"
if [ "$ESSAI" != 1 ]; then chown 65534:65534 "$ATELIER/travail" "$ATELIER/sortie" "$ATELIER/resultats"; fi
chmod 755 "$ATELIER/travail" "$ATELIER/sortie" "$ATELIER/resultats"
{
  echo "# Réglages de l'atelier du site de dev, posés par atelier/installer.sh (root). Relus champ par champ par outils/lancer.sh ; jamais écrits par le site de dev."
  echo "MEMOIRE_MAX_KO=$MEMOIRE_MAX_KO"
  echo "BESOIN_KO=$BESOIN_KO"
  echo "CPUS=$CPUS"
  echo "DISQUE_MIN_KO=$DISQUE_MIN_KO"
  echo "DELAI_S=$DELAI_S"
  echo "GOOGLE_CLIENT_ID=$GOOGLE"
  echo "JOURS_DE_MESURE=$JOURS_DE_MESURE"
  echo "MAX_PAR_JOUR=$MAX_PAR_JOUR"
  echo "MAX_CONTENU_PAR_JOUR=$MAX_CONTENU_PAR_JOUR"
  echo "MESURE_DEPUIS=$MESURE_DEPUIS"
  echo "DOSSIER_PROD=$DOSSIER_PROD"
} > "$REGLAGES.neuf"
chmod 644 "$REGLAGES.neuf"
mv -f "$REGLAGES.neuf" "$REGLAGES"
echo "== Réglages : $REGLAGES"

# ---------------------------------------------------------------- l'image
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "== Image $IMAGE : déjà présente"
else
  echo "== Image $IMAGE : téléchargement (une fois)"
  docker pull "$IMAGE" >/dev/null || die "docker pull $IMAGE a échoué."
fi

# ---------------------------------------------------------------- unités systemd
cat > "$ETC_SYSTEMD/$UNITE.service" <<UNITE_SERVICE
[Unit]
Description=Atelier du site de dev : fabrication d'un site témoin depuis l'extrait du contenu
After=docker.service
Wants=docker.service
ConditionPathExists=$REGLAGES

[Service]
Type=oneshot
ExecStart=/bin/sh $OUTILS/lancer.sh
Nice=19
IOSchedulingClass=idle
CPUWeight=20
TimeoutStartSec=$((DELAI_S + 1800))
UNITE_SERVICE
# La nuit et la journée type : deux minuteurs, déclenchés par l'horloge (jamais par le site de dev), qui lancent la même fabrication sous une autre origine. La nuit remplace le contrôle de
# nuit (lot 10) ; le jour n'ajoute une fabrication que dans les règles de lancer.sh (fenêtre de mesure ouverte, moins de 10 dans la journée UTC, nuit et livraisons comprises, 40 minutes depuis la dernière).
for origine in nuit jour; do
  if [ "$origine" = nuit ]; then option=nuit; description="fabrication de nuit (remplace le contrôle de nuit)"; calendrier='*-*-* 04:30:00'
  else option=journee_type; description="fabrication de la journée type (toutes les 20 minutes entre 8 h et 20 h, dans les règles de lancer.sh)"; calendrier='*-*-* 08..19:00/20:00'; fi
  cat > "$ETC_SYSTEMD/$UNITE-$origine.service" <<UNITE_ORIGINE
[Unit]
Description=Atelier du site de dev : $description
After=docker.service
Wants=docker.service
ConditionPathExists=$REGLAGES

[Service]
Type=oneshot
ExecStart=/bin/sh $OUTILS/lancer.sh --origine $option
Nice=19
IOSchedulingClass=idle
CPUWeight=20
TimeoutStartSec=$((DELAI_S + 1800))
UNITE_ORIGINE
  cat > "$ETC_SYSTEMD/$UNITE-$origine.timer" <<UNITE_MINUTEUR
[Unit]
Description=Atelier du site de dev : $description

[Timer]
OnCalendar=$calendrier
Persistent=false

[Install]
WantedBy=timers.target
UNITE_MINUTEUR
  chmod 644 "$ETC_SYSTEMD/$UNITE-$origine.service" "$ETC_SYSTEMD/$UNITE-$origine.timer"
done
cat > "$ETC_SYSTEMD/$UNITE.slice" <<UNITE_SLICE
[Unit]
Description=Atelier du site de dev : tranche de basse priorité du conteneur (le serveur porte aussi la production)

[Slice]
CPUWeight=20
IOWeight=20
UNITE_SLICE
cat > "$ETC_SYSTEMD/$UNITE.path" <<UNITE_PATH
[Unit]
Description=Atelier du site de dev : l'installateur de test a posé une nouvelle marque

[Path]
PathChanged=$ATELIER/declencheur/marque
Unit=$UNITE.service

[Install]
WantedBy=multi-user.target
UNITE_PATH
chmod 644 "$ETC_SYSTEMD/$UNITE.service" "$ETC_SYSTEMD/$UNITE.path" "$ETC_SYSTEMD/$UNITE.slice"
systemctl daemon-reload
systemctl enable --now "$UNITE.path" "$UNITE-nuit.timer" "$UNITE-jour.timer" >/dev/null
# l'interrupteur du site servi est déjà posé : le minuteur du contenu suit (les unités se réécrivent comme les autres)
if [ -f "$ATELIER/servir" ] && [ ! -L "$ATELIER/servir" ]; then poser_le_minuteur_du_contenu; systemctl daemon-reload; systemctl enable --now "$UNITE-contenu.timer" >/dev/null; fi
echo "== Unités : $UNITE.path (surveille $ATELIER/declencheur/marque), $UNITE.service et $UNITE.slice (poids bas du processeur et des disques pour le conteneur) ; minuteurs $UNITE-nuit (04:30) et $UNITE-jour (toutes les 20 minutes entre 8 h et 20 h, $JOURS_DE_MESURE jour(s) de mesure, au plus $MAX_PAR_JOUR fabrications par jour)"

# La marque : normalement posée par l'installateur de test avec le kit ; refaite ici si elle manque, d'après le fichier VERSION de l'instance (root).
if [ ! -f "$ATELIER/declencheur/marque" ]; then
  v=$(sed -n 's/^version=//p' "$INSTANCE/VERSION" | head -n 1); t=$(sed -n 's/^tag=//p' "$INSTANCE/VERSION" | head -n 1); c=$(sed -n 's/^commit=//p' "$INSTANCE/VERSION" | head -n 1)
  printf 'version=%s\ntag=%s\ncommit=%s\n' "$v" "$t" "$c" > "$ATELIER/declencheur/marque"
fi

# ---------------------------------------------------------------- « installé », pour le service, puis le montage des rapports
{
  printf '{ "format": "maverick-atelier-installe/1", "installe_le": "%s", "reglages": ' "$(maintenant_iso)"
  printf '{ "memoire_max_ko": %s, "besoin_ko": %s, "cpus": %s, "disque_min_ko": %s, "delai_s": %s, "jours_de_mesure": %s, "max_par_jour": %s } }\n' \
    "$(json_nombre "$MEMOIRE_MAX_KO")" "$(json_nombre "$BESOIN_KO")" "$(json_nombre "$CPUS")" "$(json_nombre "$DISQUE_MIN_KO")" "$(json_nombre "$DELAI_S")" "$(json_nombre "$JOURS_DE_MESURE")" "$(json_nombre "$MAX_PAR_JOUR")"
} > "$RAPPORTS/installe.json.neuf"
chmod 644 "$RAPPORTS/installe.json.neuf"
mv -f "$RAPPORTS/installe.json.neuf" "$RAPPORTS/installe.json"
if [ "$SANS_MONTAGE" -eq 0 ]; then
  {
    echo "$MARQUE_DU_FICHIER"
    echo "# L'atelier du site de dev (docs/serveur.md) : le service lit ses rapports (lecture seule) et dépose l'extrait du contenu dans le dépôt de l'atelier (root en crée le dossier)."
    echo "# « installer.sh --retirer » supprime ce fichier."
    echo "services:"
    echo "  serveur:"
    echo "    environment:"
    echo "      MAVERICK_ATELIER: /atelier"
    echo "      MAVERICK_ATELIER_DEPOT: /atelier-depot"
    echo "    volumes:"
    echo "      - ./atelier/rapports:/atelier:ro"
    echo "      - ./atelier/depot:/atelier-depot"
  } > "$OVERRIDE.neuf"
  chmod 644 "$OVERRIDE.neuf"
  mv -f "$OVERRIDE.neuf" "$OVERRIDE"
fi
relancer_le_service "les rapports et le dépôt de l'atelier sont montés"

# ---------------------------------------------------------------- la première fabrication
if [ "$SANS_FABRICATION" -eq 0 ]; then
  systemctl start --no-block "$UNITE.service" >/dev/null 2>&1 || echo "Avertissement : la première fabrication n'a pas pu être lancée (systemctl start $UNITE.service)."
  echo "== Première fabrication lancée (quelques minutes : elle attend l'extrait du contenu, que le service fabrique, puis fabrique le site témoin)."
fi
echo
echo "Où regarder :"
echo "  - la page Debug du site de dev, menu « DB », bloc « Atelier » (le rapport s'y affiche à la fin) ;"
echo "  - journalctl -u $UNITE.service -f        (le suivi) ;"
echo "  - $RAPPORTS/<date>/rapport.json          (le rapport, écrit par root) ;"
echo "  - sudo sh $ATELIER/installer.sh --etat   (l'état, et ce que la mémoire d'aujourd'hui permettrait)."
echo "Retour en arrière : sudo sh $ATELIER/installer.sh --retirer (le kit reste)."
