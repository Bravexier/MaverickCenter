#!/usr/bin/env bash
# Prépare les deux instances (serveur normal et serveur de test) et configure Caddy. À lancer en root, après outils.sh :
#   sudo bash instances.sh [--domaine maverick-jdr.com] [--regenerer-acces]
#
# Ce que fait le script (sûr à relancer, il ne touche ni au site ni à db/) :
#   /srv/maverick-center        serveur normal : .env (port 127.0.0.1:8080), .htpasswd
#   /srv/maverick-center-test   serveur de test : .env (port 127.0.0.1:8081, MAVERICK_BASE_TEST=conservee), .htpasswd
#   /etc/caddy/maverick.env     mot de passe interne de chaque instance (droits 600) ; /etc/caddy/Caddyfile : deploy/vps/Caddyfile
# Le site lui-même est posé ensuite par les installateurs (deploy/installateur/, voir README.md de ce dossier).
set -euo pipefail

# MAVERICK_ESSAI=1 : pour les tests seulement (client/test/deploy-vps.test.mjs) ; les dossiers ci-dessous se changent alors par MAVERICK_DIR_*.
[ "${MAVERICK_ESSAI:-0}" = 1 ] || [ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo bash $0" >&2; exit 1; }
command -v caddy >/dev/null 2>&1 || { echo "Caddy est absent : lancez d'abord « sudo bash outils.sh »." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl est absent (apt-get install openssl)." >&2; exit 1; }

DOMAINE=maverick-jdr.com
REGENERER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --domaine) [ $# -ge 2 ] || { echo "--domaine demande une valeur" >&2; exit 2; }; DOMAINE=$2; shift 2 ;;
    --regenerer-acces) REGENERER=1; shift ;;
    *) echo "Usage : sudo bash $0 [--domaine <domaine>] [--regenerer-acces]" >&2; exit 2 ;;
  esac
done
case "$DOMAINE" in
  ""|*[!a-zA-Z0-9.-]*|.*|*.) echo "Domaine invalide : « $DOMAINE »" >&2; exit 2 ;;
esac

ici="$(cd "$(dirname "$0")" && pwd)"
NORMAL=${MAVERICK_DIR_NORMAL:-/srv/maverick-center}
TEST=${MAVERICK_DIR_TEST:-/srv/maverick-center-test}
ETC_CADDY=${MAVERICK_DIR_ETC_CADDY:-/etc/caddy}
ETC_SYSTEMD=${MAVERICK_DIR_ETC_SYSTEMD:-/etc/systemd/system}
ENV_CADDY=$ETC_CADDY/maverick.env

# Pose CLE=valeur dans un fichier .env (remplace la ligne si elle existe). Le .env d'une instance n'est jamais écrasé par un installateur.
poser() {
  local fichier=$1 cle=$2 valeur=$3
  touch "$fichier"
  if grep -q "^$cle=" "$fichier"; then sed -i "s|^$cle=.*|$cle=$valeur|" "$fichier"; else echo "$cle=$valeur" >> "$fichier"; fi
}

preparer() {
  local dossier=$1 conteneur=$2 port=$3
  mkdir -p "$dossier"
  poser "$dossier/.env" MAVERICK_CONTENEUR "$conteneur"
  # 127.0.0.1:<port> : le port n'est joignable que depuis ce serveur (Docker contourne ufw : c'est ici qu'on ferme l'accès direct).
  poser "$dossier/.env" MAVERICK_PORT "127.0.0.1:$port"
}

preparer "$NORMAL" maverick-center 8080
preparer "$TEST" maverick-center-test 8081
# Serveur de test : la base de test est copiée de la production à la première installation, puis gardée (décision du propriétaire :
# on y modifie les règles, une mise à jour du site ne doit pas effacer ces modifications).
poser "$TEST/.env" MAVERICK_BASE_TEST conservee

mkdir -p "$ETC_CADDY"
if [ "$REGENERER" -eq 1 ] || [ ! -f "$ENV_CADDY" ] || [ ! -f "$NORMAL/.htpasswd" ] || [ ! -f "$TEST/.htpasswd" ]; then
  echo "== Mots de passe internes (nginx de chaque instance ; Caddy les présente aux visiteurs)"
  mdp_normal=$(openssl rand -hex 24)
  mdp_test=$(openssl rand -hex 24)
  printf 'invite:%s\n' "$(openssl passwd -apr1 "$mdp_normal")" > "$NORMAL/.htpasswd"
  printf 'invite:%s\n' "$(openssl passwd -apr1 "$mdp_test")" > "$TEST/.htpasswd"
  chmod 644 "$NORMAL/.htpasswd" "$TEST/.htpasswd" # simple empreinte, lue par le conteneur nginx
  umask 077
  {
    echo "MAVERICK_DOMAINE=$DOMAINE"
    echo "MAVERICK_ACCES_NORMAL=$(printf 'invite:%s' "$mdp_normal" | base64 -w0)"
    echo "MAVERICK_ACCES_TEST=$(printf 'invite:%s' "$mdp_test" | base64 -w0)"
  } > "$ENV_CADDY"
  chmod 600 "$ENV_CADDY"
  umask 022
else
  poser "$ENV_CADDY" MAVERICK_DOMAINE "$DOMAINE"
  echo "== Mots de passe internes déjà en place : conservés (--regenerer-acces pour les refaire)"
fi

echo "== Caddy"
install -m 644 "$ici/Caddyfile" "$ETC_CADDY/Caddyfile"
mkdir -p "$ETC_SYSTEMD/caddy.service.d"
# ExecStart est redéfini sans « --environ » : l'unité de la distribution le passe à Caddy, qui écrirait alors tout son environnement,
# donc les mots de passe internes, dans le journal (journalctl -u caddy).
cat > "$ETC_SYSTEMD/caddy.service.d/maverick.conf" <<CONF
[Service]
EnvironmentFile=$ENV_CADDY
ExecStart=
ExecStart=$(command -v caddy) run --config $ETC_CADDY/Caddyfile
CONF
systemctl daemon-reload
# Les variables sont données par l'environnement, pas par « --envfile » : le Caddy des paquets Ubuntu (2.6) ne connaît pas cette option.
(set -a; . "$ENV_CADDY"; set +a; caddy validate --config "$ETC_CADDY/Caddyfile" --adapter caddyfile)
systemctl enable caddy
systemctl restart caddy

echo
echo "Terminé. Instances prêtes : $NORMAL et $TEST (sans site pour l'instant)."
echo "Étape suivante : poser le site avec les installateurs, puis « sudo docker compose up -d » dans chaque dossier (voir README.md)."
