#!/usr/bin/env bash
# Durcit un serveur Ubuntu/Debian neuf : mises à jour de sécurité automatiques, SSH par clé uniquement, pare-feu (22, 80, 443), fail2ban.
# À lancer UNE fois, en root, sur le serveur :   sudo bash durcir.sh
# Sûr à relancer. NE COUPE PAS la session en cours, mais gardez une deuxième connexion SSH ouverte pendant l'essai, et vérifiez qu'une
# NOUVELLE connexion par clé fonctionne avant de fermer la première.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root : sudo bash $0" >&2; exit 1; }
command -v apt-get >/dev/null 2>&1 || { echo "Ubuntu ou Debian attendu (apt-get introuvable)." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

# Compte qui se connecte en SSH : celui qui a lancé sudo (ubuntu chez Infomaniak).
COMPTE="${SUDO_USER:-ubuntu}"
CLES="$(getent passwd "$COMPTE" | cut -d: -f6)/.ssh/authorized_keys"
if [ ! -s "$CLES" ]; then
  echo "Aucune clé SSH trouvée dans $CLES : désactiver le mot de passe vous enfermerait dehors. Abandon (rien n'a été modifié)." >&2
  exit 1
fi

echo "== Mises à jour du système"
apt-get update -y
apt-get upgrade -y
apt-get install -y ufw fail2ban unattended-upgrades ca-certificates curl openssl rsync sqlite3

echo "== Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

echo "== SSH : clé uniquement, pas de connexion root"
# Un fichier « 10- » passe avant « 50-cloud-init.conf » : pour sshd, la première valeur lue l'emporte.
cat > /etc/ssh/sshd_config.d/10-maverick.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
CONF
if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  echo "Configuration SSH invalide : réglage retiré, rien n'est changé." >&2
  rm -f /etc/ssh/sshd_config.d/10-maverick.conf
  exit 1
fi

echo "== Pare-feu : seuls 22 (SSH), 80 et 443 (web) sont ouverts"
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== fail2ban (bloque les essais de connexion répétés)"
systemctl enable --now fail2ban

echo
# Une mise à jour du noyau ou de la libc ne prend effet qu'au redémarrage : on le dit, on ne redémarre pas à la place de l'administrateur.
if [ -f /var/run/reboot-required ]; then
  echo "Un redémarrage est demandé par les mises à jour : « sudo reboot » quand vous êtes prêt, après avoir vérifié la connexion ci-dessous."
fi
echo "Terminé. Ouvrez MAINTENANT une nouvelle fenêtre et vérifiez que « ssh -i <votre clé> $COMPTE@<IP> » fonctionne avant de fermer celle-ci."
