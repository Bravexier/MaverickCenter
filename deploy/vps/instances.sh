#!/usr/bin/env bash
# Prépare les deux instances (serveur normal et serveur de test) et configure Caddy. À lancer en root, après outils.sh :
#   sudo bash instances.sh [--domaine maverick-jdr.com] [--regenerer-acces]
#
# Ce que fait le script (sûr à relancer, il ne touche ni au site, ni à db/, ni aux métriques déjà écrites) :
#   /srv/maverick-center        serveur normal : .env (port 127.0.0.1:8080, MAVERICK_INSTANCE=prod, MAVERICK_DOSSIER_METRIQUES=<normal>/metriques),
#                               .htpasswd, maintenance/ (annonce de maintenance des deux serveurs), metriques/ (prod.db et dev.db, une base par instance)
#   /srv/maverick-center-test   serveur de test : .env (port 127.0.0.1:8081, MAVERICK_BASE_TEST=conservee, MAVERICK_EDITION=1,
#                               MAVERICK_ADRESSE_PUBLIQUE=https://dev.<domaine>, MAVERICK_DOSSIER_MAINTENANCE=<normal>/maintenance,
#                               MAVERICK_INSTANCE=dev, MAVERICK_DOSSIER_METRIQUES=<normal>/metriques), .htpasswd, secrets/ (jeton de la page Mise à jour)
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
# Serveur de test : les règles s'y modifient depuis les pages (crayon, docs/serveur.md, « Édition » ; demande du propriétaire : le site de dev seulement).
poser "$TEST/.env" MAVERICK_EDITION 1
# Serveur de test : page « Mise à jour » (docs/serveur.md) — l'adresse où le workflow GitHub télécharge le lot figé, et le dossier du jeton qui
# déclenche ce workflow (secrets/github-actions-token, déposé à la main : README.md, « Page Mise à jour »).
poser "$TEST/.env" MAVERICK_ADRESSE_PUBLIQUE "https://dev.$DOMAINE"
mkdir -p "$TEST/secrets"
chmod 700 "$TEST/secrets"
# Maintenance pendant une mise à jour (docs/serveur.md) : le service du serveur de test (qui lance la mise à jour) publie l'annonce dans le dossier
# maintenance/ du serveur normal, que les deux montent (docker-compose.yml) ; chacun rouvre dès que la nouvelle version y tourne.
mkdir -p "$NORMAL/maintenance"
poser "$TEST/.env" MAVERICK_DOSSIER_MAINTENANCE "$NORMAL/maintenance"
# Métriques (docs/serveur.md, « Métriques et volume ») : un dossier PARTAGÉ, sur le modèle de celui de la maintenance, monté dans le conteneur
# « serveur » des deux instances (docker-compose.yml) ; chacune n'y écrit QUE sa base (prod.db, dev.db : deux jeux de données séparés, décision du
# propriétaire du 2026-10-15), et le site de dev y lit aussi celle de la production pour la page Debug. Hors de db/ : l'installateur de test, qui
# remplace le contenu de db/, ne les copie ni ne les efface. Le service tourne en root dans son conteneur (node:22-alpine, pas de « user: ») :
# root:root 755 lui suffit, comme pour db/.
mkdir -p "$NORMAL/metriques"
chmod 755 "$NORMAL/metriques"
poser "$NORMAL/.env" MAVERICK_INSTANCE prod
poser "$TEST/.env" MAVERICK_INSTANCE dev
poser "$NORMAL/.env" MAVERICK_DOSSIER_METRIQUES "$NORMAL/metriques"
poser "$TEST/.env" MAVERICK_DOSSIER_METRIQUES "$NORMAL/metriques"

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
