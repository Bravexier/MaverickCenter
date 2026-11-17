#!/usr/bin/env bash
# Essai de restauration (temps 2 des sauvegardes automatiques ; deploy/vps/README.md, « Sauvegardes »).
#
#   essai.sh      restaure la dernière copie extérieure de chaque instance dans un conteneur vide, puis contrôle ce qui a été restauré
#
# Lancé tout seul chaque mois (minuteur maverick-sauvegarde-essai) et juste après l'activation de l'envoi extérieur (installer.sh --stockage).
# Il prouve que la copie extérieure se relit avec les seuls accès au stockage et la clé de chiffrement, sans le propriétaire :
#   - la restauration se fait dans un conteneur Docker jetable (image ubuntu:24.04, ou MAVERICK_SAUV_IMAGE_ESSAI) qui ne voit que : le binaire restic
#     du serveur (lecture seule), les deux fichiers d'accès (lecture seule, jamais en argument) et un dossier de sortie VIDE créé pour l'occasion ; ni
#     db/, ni les copies locales ; réseau : le pont Docker par défaut, qui sort vers Internet (le stockage) et atteint aussi l'hôte, où le conteneur n'a rien à
#     prendre puisqu'il ne voit aucune donnée ; sans droits superflus, système de fichiers en lecture seule ;
#   - ce qui est restauré est contrôlé sur l'hôte : PRAGMA integrity_check de chaque base, puis le nombre de lignes de chaque table comparé, exactement,
#     à comptes.tsv, écrit dans la copie au moment de la copie ;
#   - le résultat (date, durée, par instance : ok ou le code de l'échec) va dans l'état (metriques/sauvegardes.json), jamais le contenu des fiches.
# Code de sortie : 0 = essai réussi (ou envoi non activé), 3 = essai échoué.
set -euo pipefail
umask 077

ICI=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$ICI/lib.sh"
charger_reglages
E=$ETAT/exterieur.env
mkdir -p "$SAUV" "$ETAT"
chmod 700 "$SAUV" "$ETAT"

if [ ! -f "$ETC/stockage.env" ] || [ ! -f "$ETC/cle-depot" ]; then
  journal "envoi extérieur non activé : pas d'essai de restauration"
  exit 0
fi
command -v sqlite3 >/dev/null 2>&1 || { echec "sqlite3 est absent (apt-get install sqlite3)"; exit 1; }
prendre_le_verrou 1800 || exit 0

DOCKER=${MAVERICK_SAUV_DOCKER:-docker}
IMAGE=${MAVERICK_SAUV_IMAGE_ESSAI:-ubuntu:24.04}
RESULTAT=ok
CODE=''
PAR_INSTANCE=''
SECONDS=0
REST=''
nettoyer() { [ -z "$REST" ] || rm -rf "$REST"; }
trap nettoyer EXIT

echouer() { RESULTAT=echec; [ -n "$CODE" ] || CODE=$1; echec "$2"; }
terminer() {
  etat_poser_tout "$E" ESSAI_LE "$(instant)" ESSAI_RESULTAT "$RESULTAT" ESSAI_CODE "$CODE" ESSAI_DUREE_S "$SECONDS" ESSAI_INSTANCES "${PAR_INSTANCE# }"
  ecrire_json
  [ "$RESULTAT" = ok ] || exit 3
  exit 0
}

command -v "$DOCKER" >/dev/null 2>&1 || { echouer docker_absent "docker est absent : l'essai a besoin d'un conteneur vide"; terminer; }
command -v restic >/dev/null 2>&1 || { echouer restic_absent "restic est absent (apt-get install restic)"; terminer; }
RESTIC=$(readlink -f "$(command -v restic)")
if ! "$DOCKER" image inspect "$IMAGE" >/dev/null 2>&1; then
  "$DOCKER" pull -q "$IMAGE" >/dev/null 2>&1 || { echouer image_absente "l'image $IMAGE n'est pas là et ne peut pas être téléchargée"; terminer; }
fi
REST=$(mktemp -d "$SAUV/.essai.XXXXXX")

# Compare une copie restaurée à ses propres comptes.tsv : 0 si tout est identique.
controler_restauration() { # dossier_de_la_copie
  local dir=$1 base detail
  [ -s "$dir/comptes.tsv" ] || return 1
  cut -f1 "$dir/comptes.tsv" | sort -u > "$dir/.bases.liste"
  : > "$dir/.relu.tsv"
  while IFS= read -r base; do
    [ -f "$dir/db/$base" ] || return 2
    detail=$(controle_integrite "$dir/db/$base")
    [ "$detail" = ok ] || return 3
    comptes_de "$dir/db/$base" "$base" >> "$dir/.relu.tsv"
  done < "$dir/.bases.liste"
  sort "$dir/comptes.tsv" > "$dir/.attendu.tsv"
  sort "$dir/.relu.tsv" > "$dir/.obtenu.tsv"
  cmp -s "$dir/.attendu.tsv" "$dir/.obtenu.tsv" || return 4
}

for inst in $INSTANCES; do
  attendue=$(derniere_copie "$inst")
  mkdir "$REST/$inst"
  montages=(-v "$RESTIC:/usr/local/bin/restic:ro" -v "$ETC/stockage.env:/cles/stockage.env:ro" -v "$ETC/cle-depot:/cles/cle-depot:ro" -v "$REST/$inst:/sortie")
  # Les certificats de l'hôte : l'image minimale n'en a pas, et restic parle en HTTPS au stockage.
  [ -f /etc/ssl/certs/ca-certificates.crt ] && montages+=(-v /etc/ssl/certs/ca-certificates.crt:/etc/ssl/certs/ca-certificates.crt:ro)
  if timeout 3000 "$DOCKER" run --rm --pull never --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
      --security-opt no-new-privileges --read-only --tmpfs /tmp:rw,size=256m -e HOME=/tmp -e RESTIC_CACHE_DIR=/tmp/cache "${montages[@]}" "$IMAGE" \
      sh -c "set -a; . /cles/stockage.env; set +a; export RESTIC_PASSWORD_FILE=/cles/cle-depot; restic restore latest --host maverick --tag inst-$inst --target /sortie" \
      > /dev/null 2> "$REST/$inst.erreur"; then
    copies=$(find "$REST/$inst" -name comptes.tsv | wc -l | tr -d ' ')
    if [ "$copies" -ne 1 ]; then
      if [ -z "$attendue" ] && [ "$copies" -eq 0 ]; then PAR_INSTANCE="$PAR_INSTANCE $inst:sans_copie"; continue; fi
      PAR_INSTANCE="$PAR_INSTANCE $inst:copie_introuvable"
      echouer copie_introuvable "$inst : la restauration n'a pas rendu exactement une copie ($copies)"
      continue
    fi
    dir=$(dirname "$(find "$REST/$inst" -name comptes.tsv)")
    rc=0
    controler_restauration "$dir" || rc=$?
    case "$rc" in
      0) PAR_INSTANCE="$PAR_INSTANCE $inst:ok"; journal "$inst : copie extérieure restaurée et contrôlée" ;;
      3) PAR_INSTANCE="$PAR_INSTANCE $inst:integrite"; echouer integrite "$inst : une base restaurée échoue à integrity_check" ;;
      4) PAR_INSTANCE="$PAR_INSTANCE $inst:comptes_differents"; echouer comptes_differents "$inst : les nombres de lignes restaurés diffèrent de ceux de la copie" ;;
      *) PAR_INSTANCE="$PAR_INSTANCE $inst:copie_incomplete"; echouer copie_incomplete "$inst : la copie restaurée est incomplète" ;;
    esac
  else
    PAR_INSTANCE="$PAR_INSTANCE $inst:restauration_echouee"
    if [ -z "$attendue" ] && grep -qiE 'no matching ID|no snapshot' "$REST/$inst.erreur" 2>/dev/null; then
      PAR_INSTANCE="${PAR_INSTANCE% *} $inst:sans_copie"
      continue
    fi
    echouer restauration_echouee "$inst : la restauration a échoué ($(tail -n 2 "$REST/$inst.erreur" | tr '\n' ' ' | cut -c1-200))"
  fi
done
terminer
