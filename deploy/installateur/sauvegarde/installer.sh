#!/bin/sh
# Le geste : met en place les sauvegardes automatiques du serveur, en une commande lancée une fois, depuis le serveur :
#
#   sudo sh /srv/maverick-center-test/sauvegarde/installer.sh [options]
#
# Sans option, la commande :
#   1. pose le temps 1 : un minuteur qui copie toute la base des deux sites chaque heure où elle a changé et chaque nuit (copie.sh), contrôlée,
#      rangée dans /srv/maverick-sauvegardes (root 700), avec un plafond de place et une alerte ; une première copie est faite tout de suite ;
#   2. propose le temps 2, l'envoi chiffré de nuit hors du serveur (envoi.sh) : l'adresse du stockage compatible S3, sa région (facultative) et son bucket
#      (donnés par option ou variable d'environnement, sinon demandés), puis l'identifiant de clé et la clé secrète, saisis au clavier SANS écho, sont rangés dans
#      /etc/maverick-sauvegardes (root 700, fichiers 600) ; elle crée la clé de chiffrement (une phrase de 6 mots, facile à recopier sur papier) et
#      l'affiche, pour que vous la rangiez hors du serveur ; crée le dépôt chiffré (jamais un dépôt qui existe déjà) ; fait un premier envoi, puis un
#      essai de restauration dans un conteneur vide (essai.sh). Entrée à la première question : le temps 2 est passé, la commande dit comment
#      l'activer plus tard.
# Relançable sans dégât : ne recrée jamais une clé de chiffrement existante, ne réinitialise jamais un dépôt existant, ne redemande rien de ce qui est
# déjà en place. Une mise à jour des scripts n'en demande pas : ils sont posés avec le site de dev par son installateur (mise-a-jour.sh) ; seuls les
# minuteurs et le lanceur (rarement changés) se refont en relançant cette commande.
#   --stockage        (re)saisir les accès au stockage : changer de fournisseur, de bucket ou de clés d'accès. Les copies locales et la clé de chiffrement
#                     sont gardées telles quelles. Sur un serveur neuf, un dépôt déjà rempli est repris : la phrase de ce dépôt est alors demandée
#   --adresse <url> --region <région> --bucket <nom>   ces valeurs (non secrètes) sans invite ; MAVERICK_SAUV_ADRESSE, _REGION et _BUCKET font de même
#                     (exemple : --adresse https://s3.exemple.invalid --bucket bucket-exemple ; la région est facultative). Seules les deux clés d'accès
#                     se saisissent, masquées. Le stockage est essayé tout de suite ; s'il refuse, rien n'est enregistré (le précédent est gardé)
#   --verifier-le-stockage  essaie le stockage déjà configuré (dépôt joignable, clé acceptée, écriture possible), sans rien ressaisir, puis s'arrête
#   --afficher-la-cle réaffiche la phrase de chiffrement (sur le terminal) puis s'arrête
#   --sans-stockage   ne pas proposer le temps 2
#   --essai           lancer tout de suite un essai de restauration, puis s'arrêter
#   --retirer         arrêter et retirer les minuteurs (les copies, les clés et les réglages restent)
# Réglages (MAVERICK_DIR_* de lib.sh) : seulement pour les tests ; MAVERICK_ESSAI=1 les accompagne (ni root, ni apt, ni terminal exigés).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$ICI/lib.sh"
OUTILS=${MAVERICK_DIR_OUTILS:-/usr/local/lib/maverick-center}
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
LANCEUR=$OUTILS/maverick-sauvegarde-lanceur.sh
ESSAI=${MAVERICK_ESSAI:-0}

STOCKAGE=0
SANS_STOCKAGE=0
SEULEMENT_ESSAI=0
RETIRER=0
AFFICHER_CLE=0
VERIFIER_STOCKAGE=0
ADRESSE=${MAVERICK_SAUV_ADRESSE:-}
REGION=${MAVERICK_SAUV_REGION:-}
BUCKET=${MAVERICK_SAUV_BUCKET:-}
USAGE="Usage : sudo sh $0 [--stockage] [--adresse <url>] [--region <région>] [--bucket <nom>] [--verifier-le-stockage] [--afficher-la-cle] [--sans-stockage] [--essai] [--retirer]"
while [ $# -gt 0 ]; do
  case "$1" in
    --stockage) STOCKAGE=1; shift ;;
    --sans-stockage) SANS_STOCKAGE=1; shift ;;
    --essai) SEULEMENT_ESSAI=1; shift ;;
    --retirer) RETIRER=1; shift ;;
    --afficher-la-cle) AFFICHER_CLE=1; shift ;;
    --verifier-le-stockage) VERIFIER_STOCKAGE=1; shift ;;
    --adresse) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; ADRESSE=$2; shift 2 ;;
    --region) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; REGION=$2; shift 2 ;;
    --bucket) [ $# -ge 2 ] || { echo "$USAGE" >&2; exit 2; }; BUCKET=$2; shift 2 ;;
    *) echo "$USAGE" >&2; exit 2 ;;
  esac
done
[ "$STOCKAGE" -eq 0 ] || [ "$SANS_STOCKAGE" -eq 0 ] || { echo "--stockage et --sans-stockage s'excluent" >&2; exit 2; }
[ "$ESSAI" = 1 ] || [ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo sh $0" >&2; exit 1; }

die() { echo "ERREUR : $*" >&2; exit 1; }
ECHEC_SAUV=0
installer_paquet() { # commande paquet
  command -v "$1" >/dev/null 2>&1 && return 0
  [ "$ESSAI" != 1 ] || die "$1 est absent"
  echo "== Installation de $2 (apt-get)"
  apt-get install -y "$2" >/dev/null || die "apt-get install $2 a échoué"
}

NB_MOTS=6 # 6 mots tirés au hasard de mots.txt (7 776 mots) : 6 × log2(7776) = 77,5 bits, bien au-delà de ce qu'une attaque hors ligne peut essayer

afficher_cle() { # phrase
  echo "=============================================================================================="
  echo "  CLÉ DE CHIFFREMENT DES COPIES EXTÉRIEURES (6 mots) : rangez-la hors de ce serveur"
  echo "  (recopiez-la sur papier, dans un endroit sûr) :"
  echo
  echo "      $1"
  echo
  echo "  Sans elle, aucune copie extérieure ne peut être relue. Elle reste aussi dans $ETC/cle-depot"
  echo "  (root seul), mais un serveur perdu emporte ce fichier. La réafficher : sudo sh $ICI/installer.sh --afficher-la-cle"
  echo "=============================================================================================="
}
exige_un_terminal() {
  if [ "$ESSAI" != 1 ] && [ ! -t 1 ]; then die "la clé de chiffrement ne s'affiche que sur un terminal : lancez la commande dans une session ssh ordinaire"; fi
}
if [ "$AFFICHER_CLE" -eq 1 ]; then
  [ -f "$ETC/cle-depot" ] || die "aucune clé de chiffrement sur ce serveur ($ETC/cle-depot) : l'envoi extérieur n'a pas été activé ici"
  exige_un_terminal
  afficher_cle "$(cat "$ETC/cle-depot")"
  exit 0
fi

MASQUES=() # les secrets saisis : effacés de tout message avant son affichage

# Une cause probable, en français, d'après ce que dit restic (jamais le message brut seul, jamais un secret).
expliquer_erreur() { # texte_de_restic
  local e=$1 m secret
  case "$e" in
    *"no such host"*|*"lookup "*|*"dial tcp"*|*"connection refused"*|*"i/o timeout"*|*"context deadline"*)
      m="adresse injoignable : vérifiez l'adresse du stockage (https://…) et que le serveur peut sortir sur Internet" ;;
    *"x509"*|*"certificate"*|*"tls:"*)
      m="certificat HTTPS refusé : l'adresse n'est sans doute pas celle d'un stockage S3 (ou l'heure du serveur est fausse)" ;;
    *"NoSuchBucket"*|*"bucket does not exist"*|*"specified bucket"*)
      m="bucket introuvable : vérifiez son nom, et qu'il est créé chez le fournisseur dans cette région" ;;
    *"InvalidAccessKeyId"*|*"SignatureDoesNotMatch"*|*"AccessDenied"*|*"Access Denied"*|*"Forbidden"*|*"403"*)
      m="clés refusées ou droits insuffisants : vérifiez l'identifiant et la clé secrète, et que cette clé peut lire et écrire dans ce bucket" ;;
    *"AuthorizationHeaderMalformed"*|*"egion"*)
      m="région refusée : vérifiez la région du stockage (elle est facultative : laissez-la vide si vous n'êtes pas sûr)" ;;
    *"wrong password"*|*"no key found"*)
      m="la phrase de chiffrement ne rouvre pas ce dépôt" ;;
    *)
      m="réponse inattendue du stockage ($(printf '%s' "$e" | head -n 2 | tr '\n' ' ' | cut -c1-240))" ;;
  esac
  for secret in "${MASQUES[@]}"; do [ -z "$secret" ] || m=${m//"$secret"/***}; done
  printf '%s' "$m"
}

# Essaie le dépôt : écrit « existe », « absent », « cle » (clé refusée) ou « erreur: <message de restic> ».
# shellcheck disable=SC1090
sonder_depot() { # fichier_d_acces fichier_de_cle
  local erreur
  if erreur=$( ( set -a; . "$1"; set +a; RESTIC_PASSWORD_FILE=$2 RESTIC_CACHE_DIR=$SAUV/.cache-restic restic cat config >/dev/null ) 2>&1 ); then echo existe; return 0; fi
  case "$erreur" in
    *"unable to open config"*|*"Is there a repository"*) echo absent ;;
    *"wrong password"*|*"no key found"*) echo cle ;;
    *) echo "erreur: $(printf '%s' "$erreur" | tr '\n' ' ')" ;;
  esac
}
# Un dépôt qui existe : lisible, et écriture possible (restic check pose un verrou dans le dépôt). Écrit « ok » ou « erreur: <message> ».
# shellcheck disable=SC1090
essayer_l_ecriture() { # fichier_d_acces fichier_de_cle
  local erreur
  if erreur=$( ( set -a; . "$1"; set +a; RESTIC_PASSWORD_FILE=$2 RESTIC_CACHE_DIR=$SAUV/.cache-restic restic check -q ) 2>&1 ); then echo ok; else echo "erreur: $(printf '%s' "$erreur" | tr '\n' ' ')"; fi
}

if [ "$VERIFIER_STOCKAGE" -eq 1 ]; then
  [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ] || die "l'envoi extérieur n'est pas configuré sur ce serveur : sudo sh $ICI/installer.sh --stockage"
  installer_paquet restic restic
  mkdir -p "$SAUV/.cache-restic"
  chmod 700 "$SAUV/.cache-restic"
  etat=$(sonder_depot "$ETC/stockage.env" "$ETC/cle-depot")
  case "$etat" in
    existe) ;;
    absent) die "le dépôt n'existe pas à l'adresse configurée : le bucket a-t-il été vidé ou changé ? (sudo sh $ICI/installer.sh --stockage pour le recréer)" ;;
    cle) die "$(expliquer_erreur 'wrong password')" ;;
    *) die "$(expliquer_erreur "${etat#erreur: }")" ;;
  esac
  etat=$(essayer_l_ecriture "$ETC/stockage.env" "$ETC/cle-depot")
  [ "$etat" = ok ] || die "le dépôt se lit mais l'écriture est refusée : $(expliquer_erreur "${etat#erreur: }")"
  echo "Stockage vérifié : le dépôt chiffré est joignable, la clé de chiffrement l'ouvre, l'écriture est possible."
  exit 0
fi

# ---------------------------------------------------------------- retrait
if [ "$RETIRER" -eq 1 ]; then
  echo "== Retrait des minuteurs"
  for t in horaire nuit essai; do
    systemctl disable --now "maverick-sauvegarde-$t.timer" >/dev/null 2>&1 || true
    rm -f "$ETC_SYSTEMD/maverick-sauvegarde-$t.timer" "$ETC_SYSTEMD/maverick-sauvegarde-$t.service"
  done
  rm -f "$LANCEUR"
  systemctl daemon-reload || true
  echo "Minuteurs retirés. Gardés : les copies ($SAUV), les clés et réglages ($ETC), le dossier sauvegarde/ des instances."
  echo "Pour tout effacer à la main : sudo rm -rf $SAUV $ETC (la clé de chiffrement ne se récupère alors que là où vous l'avez rangée)."
  exit 0
fi

# ---------------------------------------------------------------- essai seul
if [ "$SEULEMENT_ESSAI" -eq 1 ]; then
  exec bash "$ICI/essai.sh"
fi

# ---------------------------------------------------------------- temps 1 : copies locales
echo "== Temps 1 : copies locales de la base des deux sites"
installer_paquet sqlite3 sqlite3
installer_paquet flock util-linux
mkdir -p "$SAUV/prod" "$SAUV/dev" "$ETAT" "$ETC" "$OUTILS"
chmod 700 "$SAUV" "$SAUV/prod" "$SAUV/dev" "$ETAT" "$ETC"
chmod 755 "$OUTILS"
install -m 755 "$ICI/lanceur.sh" "$LANCEUR"
if [ ! -f "$ETC/reglages.env" ]; then
  cat > "$ETC/reglages.env" <<'REGLAGES'
# Réglages facultatifs des sauvegardes automatiques (docs/serveur.md, « Sauvegardes automatiques »). Retirer le # d'une ligne pour la changer ;
# elle s'applique à la prochaine exécution, sans rien relancer. Valeurs par défaut :
#PLAFOND_MO=4096          # place maximale des copies locales des deux instances
#LIBRE_MIN_MO=3072        # espace libre minimal du disque après une copie
#HORAIRES_GARDEES=24      # copies horaires gardées par instance
#NUITS_GARDEES=7          # copies de nuit gardées par instance
#SUSPECTES_GARDEES=3      # copies mises de côté (alerte) gardées par instance
#CHUTE_POURCENT=20        # une table qui perd plus de ce pourcentage de ses lignes déclenche l'alerte…
#CHUTE_MIN_LIGNES=20      # … si elle avait au moins ce nombre de lignes dans la copie précédente
#JOURS_GARDES=30          # copie extérieure : nombre de jours gardés (une copie par mois et une par version : sans limite)
#VERSIONS_DE="prod dev"   # instances dont chaque version est gardée à l'extérieur
#CONTROLE_DONNEES=5%      # part des données relue par le contrôle du dimanche
REGLAGES
fi

ecrire_unite() { # nom_court description lignes_ExecStart délai_maximal : écrit le .service (les lignes ExecStart sont le troisième argument)
  local nom=$1 description=$2 execs=$3 delai=$4
  {
    echo "[Unit]"
    echo "Description=Maverick Center : $description (docs/serveur.md, « Sauvegardes automatiques »)"
    echo "After=docker.service"
    echo
    echo "[Service]"
    echo "Type=oneshot"
    echo "Environment=MAVERICK_DIR_NORMAL=${NORMAL%/} MAVERICK_DIR_TEST=${TEST%/} MAVERICK_DIR_SAUVEGARDES=${SAUV%/} MAVERICK_DIR_ETC_SAUVEGARDES=${ETC%/} MAVERICK_DIR_METRIQUES=${METRIQUES%/}"
    printf '%s\n' "$execs"
    echo "TimeoutStartSec=$delai"
    echo "Nice=19"
    echo "IOSchedulingClass=idle"
    echo "NoNewPrivileges=yes"
    echo "ProtectSystem=full"
    echo "ProtectHome=read-only"
    echo "PrivateTmp=yes"
  } > "$ETC_SYSTEMD/maverick-sauvegarde-$nom.service"
}
ecrire_minuteur() { # nom description calendrier delai_aleatoire
  cat > "$ETC_SYSTEMD/maverick-sauvegarde-$1.timer" <<UNITE
[Unit]
Description=Maverick Center : $2

[Timer]
OnCalendar=$3
RandomizedDelaySec=$4
Persistent=true

[Install]
WantedBy=timers.target
UNITE
}
ecrire_unite horaire "copie horaire de la base, si elle a changé" "ExecStart=/bin/sh $LANCEUR copie horaire" 30min
ecrire_minuteur horaire "copie horaire de la base (si elle a changé)" "*-*-* *:07:00" 120
# La copie de nuit, puis l'envoi chiffré (sans effet tant que le stockage n'est pas configuré) : l'envoi part même si la copie de nuit a signalé une alerte
# (il envoie la dernière copie saine).
ecrire_unite nuit "copie de nuit de la base, puis envoi chiffré hors du serveur" "ExecStart=-/bin/sh $LANCEUR copie nuit
ExecStart=/bin/sh $LANCEUR envoi" 3h
ecrire_minuteur nuit "copie de nuit et envoi chiffré hors du serveur" "*-*-* 03:30:00" 300
ecrire_unite essai "essai de restauration de la copie extérieure dans un conteneur vide" "ExecStart=/bin/sh $LANCEUR essai" 2h
ecrire_minuteur essai "essai de restauration, le 1er de chaque mois" "*-*-01 05:30:00" 600
systemctl daemon-reload
for t in horaire nuit essai; do systemctl enable --now "maverick-sauvegarde-$t.timer" >/dev/null; done

if [ -z "$(derniere_copie prod)$(derniere_copie dev)" ]; then
  echo "== Première copie"
  bash "$ICI/copie.sh" nuit || ECHEC_SAUV=1
else
  bash "$ICI/copie.sh" etat || true
fi

# ---------------------------------------------------------------- temps 2 : envoi chiffré
lire_valeur() { # variable question [défaut]
  local reponse
  read -r -p "$2${3:+ [$3]} : " reponse || reponse=''
  printf -v "$1" '%s' "${reponse:-${3:-}}"
}
valide() { # nom valeur motif
  [[ "$2" =~ $3 ]] || die "$1 invalide : « $2 »"
}
# Une valeur secrète (identifiant ou clé d'accès) : le message nomme le champ, jamais la valeur.
valide_secret() { # nom valeur motif
  [[ "$2" =~ $3 ]] || die "$1 refusé(e) : elle contient un caractère que le stockage n'accepte pas (lettres, chiffres, / + = _ . - seulement) ou est vide. Rien n'a été enregistré"
}

CONFIGURE=0
if [ -f "$ETC/stockage.env" ] && [ -f "$ETC/cle-depot" ]; then CONFIGURE=1; fi

activer_stockage() {
  local depot adresse region bucket ident secret secret2 nouveau cle_nouvelle=0 etat provisoire_cle phrase invite=0
  echo
  echo "== Temps 2 : envoi chiffré de nuit hors du serveur (restic, stockage compatible S3 chez un autre fournisseur que l'hébergeur)"
  ident=''; secret=''; region=''
  if [ -n "${MAVERICK_SAUV_DEPOT:-}" ]; then
    depot=$MAVERICK_SAUV_DEPOT # dépôt fourni par l'environnement (essais, dépôt local) : aucune saisie
  else
    adresse=$ADRESSE; region=$REGION; bucket=$BUCKET
    if [ -z "$adresse" ]; then
      echo "Adresse, bucket et région du stockage, puis clés d'accès. Entrée à la première question : passer (à reprendre avec --stockage)."
      lire_valeur adresse "Adresse du stockage (ex. https://s3.exemple.invalid)"
      invite=1
      if [ -z "$adresse" ]; then
        echo "Temps 2 passé. Pour l'activer plus tard : sudo sh $ICI/installer.sh --stockage"
        return 0
      fi
    fi
    adresse=${adresse%/}
    valide "L'adresse" "$adresse" '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
    if [ -z "$bucket" ]; then lire_valeur bucket "Nom du bucket (conteneur) à utiliser, déjà créé chez le fournisseur (ex. bucket-exemple)"; fi
    valide "Le bucket" "$bucket" '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$'
    # La région est facultative (restic prend celle par défaut du stockage) : demandée seulement quand l'adresse l'a été.
    if [ -z "$region" ] && [ "$invite" -eq 1 ]; then lire_valeur region "Région du stockage (facultative : Entrée pour ne pas en donner)"; fi
    [ -z "$region" ] || valide "La région" "$region" '^[A-Za-z0-9_-]+$'
    read -r -s -p "Identifiant de clé d'accès (n'est pas affiché) : " ident || ident=''
    echo
    read -r -s -p "Clé secrète d'accès (n'est pas affichée) : " secret || secret=''
    echo
    read -r -s -p "Clé secrète, encore une fois : " secret2 || secret2=''
    echo
    MASQUES=("$ident" "$secret" "$secret2")
    [ "$secret" = "$secret2" ] || die "les deux saisies de la clé secrète ne sont pas identiques : rien n'a été enregistré"
    valide_secret "L'identifiant de clé" "$ident" '^[A-Za-z0-9/+=_.-]+$'
    valide_secret "La clé secrète" "$secret" '^[A-Za-z0-9/+=_.-]+$'
    depot="s3:$adresse/$bucket"
  fi
  # Les accès sont d'abord écrits à côté et ESSAYÉS ; ils ne sont mis en place qu'une fois le stockage reconnu : un refus ou une faute de frappe ne
  # remplace pas ce qui marchait et n'enregistre rien à moitié.
  nouveau=$ETC/.stockage.env.nouveau
  provisoire_cle=$ETC/.cle-depot.nouvelle
  rm -f "$nouveau" "$provisoire_cle"
  {
    printf "RESTIC_REPOSITORY='%s'\n" "$depot"
    if [ -n "$ident" ]; then
      printf "AWS_ACCESS_KEY_ID='%s'\n" "$ident"
      printf "AWS_SECRET_ACCESS_KEY='%s'\n" "$secret"
      if [ -n "$region" ]; then printf "AWS_DEFAULT_REGION='%s'\n" "$region"; fi
    fi
  } > "$nouveau"
  chmod 600 "$nouveau"
  secret=''; secret2=''; ident=''
  abandon() { rm -f "$nouveau" "$provisoire_cle"; die "$1. Rien n'a été enregistré : le stockage précédent, s'il y en avait un, est gardé."; }
  installer_paquet restic restic
  mkdir -p "$SAUV/.cache-restic"
  chmod 700 "$SAUV/.cache-restic"

  # La clé de chiffrement : celle de ce serveur est gardée telle quelle ; sans elle, une nouvelle est tirée au hasard. Si le dépôt existe déjà
  # (serveur neuf), sa phrase est demandée et essayée.
  if [ -f "$ETC/cle-depot" ]; then
    cp "$ETC/cle-depot" "$provisoire_cle"
    echo "La clé de chiffrement de ce serveur est conservée (elle ne change jamais sans que vous le demandiez)."
  else
    cle_nouvelle=1
    phrase=$(cut -f2 "$ICI/mots.txt" | shuf -r -n "$NB_MOTS" --random-source=/dev/urandom | paste -sd- -)
    printf '%s' "$phrase" > "$provisoire_cle"
    phrase=''
  fi
  chmod 600 "$provisoire_cle"
  etat=$(sonder_depot "$nouveau" "$provisoire_cle")
  if [ "$etat" = cle ] && [ "$cle_nouvelle" -eq 1 ]; then
    echo "Un dépôt chiffré existe déjà à cette adresse : saisissez sa phrase de chiffrement pour le reprendre (rien ne sera réinitialisé)."
    read -r -s -p "Phrase du dépôt : " phrase || phrase=''
    echo
    [ -n "$phrase" ] || abandon "aucune phrase saisie"
    printf '%s' "$phrase" > "$provisoire_cle"
    etat=$(sonder_depot "$nouveau" "$provisoire_cle")
    if [ "$etat" = cle ]; then # la phrase recopiée sur papier : mots séparés par des espaces, majuscules
      printf '%s' "$phrase" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-' > "$provisoire_cle"
      etat=$(sonder_depot "$nouveau" "$provisoire_cle")
    fi
    phrase=''
    if [ "$etat" = existe ]; then cle_nouvelle=0; fi
  fi
  case "$etat" in
    existe)
      # un dépôt qui existe : lecture faite ; l'écriture se vérifie aussi (restic check pose un verrou dans le dépôt)
      etat=$(essayer_l_ecriture "$nouveau" "$provisoire_cle")
      [ "$etat" = ok ] || abandon "le dépôt se lit mais l'écriture y est refusée : $(expliquer_erreur "${etat#erreur: }")"
      echo "Dépôt chiffré déjà en place : repris tel quel."
      ;;
    absent)
      if [ "$cle_nouvelle" -eq 1 ] && [ "$ESSAI" != 1 ] && [ ! -t 1 ]; then
        rm -f "$nouveau" "$provisoire_cle"
        exige_un_terminal
      fi
      echo "== Création du dépôt chiffré (essai d'écriture dans le stockage)"
      # shellcheck disable=SC1090
      if ! erreur=$( ( set -a; . "$nouveau"; set +a; export RESTIC_PASSWORD_FILE=$provisoire_cle RESTIC_CACHE_DIR=$SAUV/.cache-restic; restic init -q ) 2>&1 ); then
        abandon "le stockage refuse la création du dépôt : $(expliquer_erreur "$erreur")"
      fi
      ;;
    cle) abandon "$(expliquer_erreur 'wrong password') : la phrase saisie ne rouvre pas le dépôt existant" ;;
    *) abandon "le stockage n'a pas répondu : $(expliquer_erreur "${etat#erreur: }")" ;;
  esac
  # Le stockage a répondu : mise en place (la clé jamais écrasée), puis, pour une clé neuve, son affichage (elle se réaffiche : --afficher-la-cle).
  if [ ! -f "$ETC/cle-depot" ]; then mv -n "$provisoire_cle" "$ETC/cle-depot"; fi
  rm -f "$provisoire_cle"
  chmod 600 "$ETC/cle-depot"
  mv -f "$nouveau" "$ETC/stockage.env"
  if [ "$cle_nouvelle" -eq 1 ]; then
    echo
    afficher_cle "$(cat "$ETC/cle-depot")"
    if [ "$ESSAI" != 1 ] && [ -t 0 ]; then
      read -r -p "Appuyez sur Entrée quand la clé est rangée (la commande continue ensuite) : " _ || true
    fi
  fi
  echo "== Premier envoi"
  if bash "$ICI/envoi.sh"; then echo "Envoi fait."; else ECHEC_SAUV=1; fi
  echo "== Essai de restauration dans un conteneur vide"
  if bash "$ICI/essai.sh"; then echo "Essai réussi."; else ECHEC_SAUV=1; fi
}

if [ "$SANS_STOCKAGE" -eq 1 ]; then
  echo
  echo "Temps 2 non proposé (--sans-stockage)."
elif [ "$STOCKAGE" -eq 1 ] || { [ "$CONFIGURE" -eq 0 ] && { [ "$ESSAI" = 1 ] || [ -t 0 ]; }; }; then
  activer_stockage
elif [ "$CONFIGURE" -eq 1 ]; then
  echo
  echo "Envoi extérieur déjà activé : rien de changé (--stockage pour changer les accès au stockage, --essai pour un essai de restauration)."
else
  echo
  echo "Envoi extérieur non activé (pas de terminal pour saisir les accès). Pour l'activer : sudo sh $ICI/installer.sh --stockage"
fi

echo
echo "== Terminé"
echo "Minuteurs : systemctl list-timers 'maverick-sauvegarde-*'     État : $SORTIE_JSON (page Debug)     Copies : $SAUV"
echo "Journal d'un traitement : journalctl -u maverick-sauvegarde-horaire -u maverick-sauvegarde-nuit -u maverick-sauvegarde-essai -n 50"
if [ "$ECHEC_SAUV" -ne 0 ]; then
  echo "ATTENTION : une étape a échoué ci-dessus ; corrigez puis relancez la même commande (rien n'est recréé : clés et dépôt sont conservés)." >&2
  exit 3
fi
exit 0
