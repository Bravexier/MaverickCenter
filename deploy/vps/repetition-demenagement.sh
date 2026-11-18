#!/usr/bin/env bash
# La répétition du déménagement (DEMENAGEMENT.md) : deux serveurs JETABLES (des dossiers) et toute la procédure jouée dans l'ordre du document, avec les vrais
# scripts demenagement.sh et controle-demenagement.sh. Aucun serveur, aucun Docker, aucun systemd : de faux « docker », « systemctl » et « crontab » le disent.
#   bash repetition-demenagement.sh --dossier <dossier neuf ou vide> [--garder]
# Il faut sqlite3 (MAVERICK_SQLITE3 pour un autre), et node avec client/serveur/empreintes.mjs (le calcul d'empreintes du site : MAVERICK_CONTROLE_EMPREINTES).
# Joue : gel refusé tant que les conteneurs tournent, emballage, transfert, refus sur une base déjà présente (la base neuve d'un service démarré par erreur),
# déballage, contrôle EGALITE ; une archive altérée refusée avant toute pose ; une base altérée DIFFERENCE ; le retour arrière (nouveau → ancien).
# Code 0 et « REPETITION REUSSIE » si tout s'est passé comme prévu ; au premier écart, le script s'arrête en disant lequel.
set -euo pipefail

ici="$(cd "$(dirname "$0")" && pwd)"
R=''
GARDER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dossier) [ $# -ge 2 ] || { echo "--dossier demande une valeur" >&2; exit 2; }; R=$2; shift 2 ;;
    --garder) GARDER=1; shift ;;
    *) echo "Usage : bash $0 --dossier <dossier> [--garder]" >&2; exit 2 ;;
  esac
done
[ -n "$R" ] || { echo "Usage : bash $0 --dossier <dossier> [--garder]" >&2; exit 2; }
mkdir -p "$R"
R=$(cd "$R" && pwd)
[ -z "$(ls -A "$R")" ] || { echo "$R n'est pas vide : la répétition veut un dossier neuf" >&2; exit 2; }
SQLITE3=${MAVERICK_SQLITE3:-sqlite3}
command -v "$SQLITE3" >/dev/null 2>&1 || { echo "sqlite3 est absent" >&2; exit 2; }
export MAVERICK_SQLITE3=$SQLITE3
export MAVERICK_CONTROLE_NODE=${MAVERICK_CONTROLE_NODE:-node}
export MAVERICK_CONTROLE_EMPREINTES=${MAVERICK_CONTROLE_EMPREINTES:-$ici/../../client/serveur/empreintes.mjs}
[ -f "$MAVERICK_CONTROLE_EMPREINTES" ] || { echo "empreintes.mjs introuvable ($MAVERICK_CONTROLE_EMPREINTES) : MAVERICK_CONTROLE_EMPREINTES" >&2; exit 2; }
[ "$GARDER" = 1 ] || trap 'rm -rf "$R"' EXIT

ok() { echo "OK    : $*"; }
rate() { echo "ECHEC : $*" >&2; exit 1; }

# ---- de faux outils (le système de fichiers du monde dit ce qui tourne)
mkdir -p "$R/bin"
cat > "$R/bin/docker" <<'F'
#!/bin/sh
# « docker compose ps -q --status running serveur » : le service tourne tant que le fichier .en-marche existe dans le dossier courant
[ "$1" = compose ] && [ "$2" = ps ] && { cat "$PWD/.en-marche" 2>/dev/null || true; exit 0; }
exit 1
F
cat > "$R/bin/systemctl" <<'F'
#!/bin/sh
# « systemctl is-active --quiet <unité> » : active tant que le fichier actifs/<unité> existe
[ "$1" = is-active ] && [ -e "$MAVERICK_FAUX/actifs/$3" ]
F
cat > "$R/bin/crontab" <<'F'
#!/bin/sh
[ "$1" = -l ] && [ -f "$MAVERICK_FAUX/crontab" ] && cat "$MAVERICK_FAUX/crontab"
F
chmod +x "$R/bin/docker" "$R/bin/systemctl" "$R/bin/crontab"

# Lance « $@ » du côté $1 (ancien ou nouveau) : ses dossiers, ses faux outils.
cote() {
  local c=$1; shift
  ( export MAVERICK_ESSAI=1 MAVERICK_FAUX="$R/$c/faux" \
      MAVERICK_DIR_NORMAL="$R/$c/srv/maverick-center" MAVERICK_DIR_TEST="$R/$c/srv/maverick-center-test" \
      MAVERICK_DIR_ETC_SAUVEGARDES="$R/$c/etc/maverick-sauvegardes" MAVERICK_DIR_SAUVEGARDES="$R/$c/srv/maverick-sauvegardes" \
      MAVERICK_DIR_CADDY_DATA="$R/$c/caddy" MAVERICK_DOCKER="$R/bin/docker" MAVERICK_SYSTEMCTL="$R/bin/systemctl" MAVERICK_CRONTAB="$R/bin/crontab"
    "$@" )
}
sqlite() { "$SQLITE3" "$@" >/dev/null; }
rep() { echo "$R/$1/srv/maverick-center${2:+-test}"; }   # dossier d'une instance : rep ancien [test]

# ---- l'ancien serveur : deux instances en marche, une vraie base chacune
for i in normal test; do
  d=$R/ancien/srv/maverick-center; [ "$i" = test ] && d=$d-test
  mkdir -p "$d/db" "$d/installateur-courant" "$d/site"
  printf 'tag=V0.9\nversion=0.9.0\nmode=%s\n' "$([ "$i" = test ] && echo test || echo prod)" > "$d/VERSION"
  [ "$i" = test ] && sed -i 's/^tag=.*/tag=V0.9.1/; s/^version=.*/version=0.9.1/' "$d/VERSION"
  : > "$d/docker-compose.yml"
  printf 'MAVERICK_CONTENEUR=maverick-%s\nMAVERICK_PORT=127.0.0.1:%s\n' "$i" "$([ "$i" = test ] && echo 8081 || echo 8080)" > "$d/.env"
  printf 'jeton-%s-factice' "$i" > "$d/.github-token"; chmod 600 "$d/.github-token"
  printf '#!/bin/sh\necho installateur-%s\n' "$i" > "$d/installateur-courant/maverick-center-install.sh"
  echo "ligne de journal" > "$d/mise-a-jour.log"
  echo conteneur > "$d/.en-marche"
  sqlite "$d/db/vivante.db" "PRAGMA journal_mode=WAL; CREATE TABLE personnage(id INTEGER PRIMARY KEY, nom TEXT NOT NULL); CREATE TABLE utilisateur(id INTEGER PRIMARY KEY, courriel TEXT); CREATE TABLE session(id INTEGER PRIMARY KEY, vu TEXT); CREATE TABLE page(id TEXT PRIMARY KEY, titre TEXT, corps TEXT); INSERT INTO personnage(nom) VALUES ('Aldric'),('Brune'),('Cael'); INSERT INTO utilisateur(courriel) VALUES ('x@exemple.invalid'); INSERT INTO page VALUES ('a','A','texte a'),('b','B','texte b');"
done
mkdir -p "$(rep ancien test)/db/archives" && cp "$(rep ancien test)/db/vivante.db" "$(rep ancien test)/db/archives/vivante-20260101.db"   # une archive de la base, en WAL comme elle
mkdir -p "$(rep ancien)/metriques" "$(rep ancien test)/secrets" "$R/ancien/faux/actifs" "$R/ancien/etc/maverick-sauvegardes" "$R/ancien/srv/maverick-sauvegardes/prod" \
  "$R/ancien/caddy/certificates/acme/maverick-jdr.com" "$R/ancien/caddy/locks"
printf 'version=0.9.1\nempreinte=abcd\n' > "$(rep ancien test)/db/source"
echo "metrique" > "$(rep ancien)/metriques/prod.db"; echo "volume" > "$(rep ancien)/metriques/volume-hote.json"
printf '{"motdepasse":"factice"}' > "$(rep ancien test)/secrets/acces.json"; chmod 600 "$(rep ancien test)/secrets/acces.json"
echo "reglage" > "$R/ancien/etc/maverick-sauvegardes/stockage.env"; echo "cle factice" > "$R/ancien/etc/maverick-sauvegardes/cle-depot"
chmod 700 "$R/ancien/etc/maverick-sauvegardes"; chmod 600 "$R/ancien/etc/maverick-sauvegardes"/*
echo "copie" > "$R/ancien/srv/maverick-sauvegardes/prod/copie1.db"
echo "certificat" > "$R/ancien/caddy/certificates/acme/maverick-jdr.com/maverick-jdr.com.crt"; echo "verrou" > "$R/ancien/caddy/locks/x"
touch "$R/ancien/faux/actifs/maverick-sauvegarde-nuit.timer"
printf '*/5 * * * * sh /srv/maverick-center/mise-a-jour.sh\n' > "$R/ancien/faux/crontab"

# ---- le nouveau serveur : durci, outillé, instances posées et sites installés (étapes de préparation), AUCUN conteneur démarré, db/ vides
for i in normal test; do
  d=$R/nouveau/srv/maverick-center; [ "$i" = test ] && d=$d-test
  mkdir -p "$d/db" "$d/site" "$d/secrets"
  printf 'tag=V0.9\nversion=0.9.0\nmode=%s\n' "$([ "$i" = test ] && echo test || echo prod)" > "$d/VERSION"
  : > "$d/docker-compose.yml"
  printf 'MAVERICK_CONTENEUR=neuf-%s\n' "$i" > "$d/.env"
done
sed -i 's/^tag=.*/tag=V0.9.1/; s/^version=.*/version=0.9.1/' "$(rep nouveau test)/VERSION"
mkdir -p "$(rep nouveau)/metriques" "$R/nouveau/faux/actifs" "$R/nouveau/caddy"
echo "volume neuf" > "$(rep nouveau)/metriques/volume-hote.json"
ok "deux serveurs jetables prêts (l'ancien tourne, le nouveau est installé et vide)"

DEM="$ici/demenagement.sh"
CTL="$ici/controle-demenagement.sh"
SORTIE=$R/ancien/home; mkdir -p "$SORTIE"
ARRIVEE=$R/nouveau/home; mkdir -p "$ARRIVEE"

# ---- 1. le gel : refusé tant que les écritures ne sont pas gelées
if cote ancien bash "$DEM" emballer --sortie "$SORTIE" >"$R/sortie" 2>&1; then rate "l'emballage a réussi alors que les conteneurs tournent"; fi
grep -q "service tourne" "$R/sortie" || rate "le refus ne dit pas que le service tourne : $(cat "$R/sortie")"
ok "emballer refuse tant que le service tourne"
rm -f "$(rep ancien)/.en-marche" "$(rep ancien test)/.en-marche"
if cote ancien bash "$DEM" emballer --sortie "$SORTIE" >"$R/sortie" 2>&1; then rate "l'emballage a réussi sans fichier GELER"; fi
grep -q GELER "$R/sortie" || rate "le refus ne parle pas de GELER"
touch "$(rep ancien)/GELER" "$(rep ancien test)/GELER"
if cote ancien bash "$DEM" emballer --sortie "$SORTIE" >"$R/sortie" 2>&1; then rate "l'emballage a réussi alors qu'un minuteur de sauvegarde tourne"; fi
grep -q "minuteur" "$R/sortie" || rate "le refus ne parle pas du minuteur"
rm -f "$R/ancien/faux/actifs/maverick-sauvegarde-nuit.timer"
if cote ancien bash "$DEM" emballer --sortie "$SORTIE" >"$R/sortie" 2>&1; then rate "l'emballage a réussi alors que le crontab lance mise-a-jour.sh"; fi
grep -q "crontab" "$R/sortie" || rate "le refus ne parle pas du crontab"
echo '# */5 * * * * sh /srv/maverick-center/mise-a-jour.sh' > "$R/ancien/faux/crontab"
ok "emballer refuse GELER absent, minuteur actif, crontab actif ; le gel complet est accepté"

# ---- 2. emballer, puis le bilan de l'ancien (les deux sont faits écritures gelées)
cote ancien bash "$DEM" emballer --sortie "$SORTIE" --avec-copies >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "l'emballage a échoué"; }
ARCHIVE=$(ls "$SORTIE"/demenagement-*.tar.gz)
[ "$(stat -c %a "$ARCHIVE")" = 600 ] || rate "l'archive n'est pas en 600"
EMPREINTE=$(sed -n "s/^Empreinte de l'archive.*: //p" "$R/sortie")
[ "$(sha256sum "$ARCHIVE" | cut -d' ' -f1)" = "$EMPREINTE" ] || rate "l'empreinte affichée n'est pas celle de l'archive"
[ -z "$(ls -A "$SORTIE" | grep -v '^demenagement-.*\.tar\.gz$' || true)" ] || rate "l'emballage a laissé un dossier de travail"
cote ancien bash "$CTL" bilan --sortie "$R/bilan-ancien.txt" >/dev/null
if grep -E "jeton-|factice|cle factice|motdepasse" "$R/bilan-ancien.txt" >/dev/null; then rate "le bilan contient un secret"; fi
grep -q '^fiches.test=3$' "$R/bilan-ancien.txt" || rate "le bilan ne compte pas les 3 fiches"
grep -q '^integrite.test=ok$' "$R/bilan-ancien.txt" || rate "le bilan ne dit pas integrity_check ok"
grep -Eq '^logique.test=[0-9a-f]{64}$' "$R/bilan-ancien.txt" || rate "pas d'empreinte du site dans le bilan"
ok "archive faite (600, empreinte connue, rien ne reste) ; bilan de l'ancien : 3 fiches, intégrité ok, empreintes du site, aucun secret"

# ---- 3. le transfert (le « scp ») : une copie de l'archive
cp "$ARCHIVE" "$ARRIVEE/"
ARRIVEE_ARCHIVE=$ARRIVEE/$(basename "$ARCHIVE")

# ---- 4. une archive altérée est refusée avant toute pose
mkdir "$R/alteree"
tar -xzpf "$ARCHIVE" -C "$R/alteree"
printf 'x' >> "$R/alteree/test/db/vivante.db"
tar -C "$R/alteree" -czpf "$ARRIVEE/alteree.tar.gz" .
if cote nouveau bash "$DEM" deballer "$ARRIVEE/alteree.tar.gz" >"$R/sortie" 2>&1; then rate "une archive altérée a été acceptée"; fi
grep -q "manifeste" "$R/sortie" || rate "le refus ne parle pas du manifeste : $(cat "$R/sortie")"
[ -z "$(ls -A "$(rep nouveau test)/db")" ] || rate "une archive altérée a laissé des fichiers dans db/"
head -c 100 "$ARCHIVE" > "$ARRIVEE/tronquee.tar.gz"
if cote nouveau bash "$DEM" deballer "$ARRIVEE/tronquee.tar.gz" >"$R/sortie" 2>&1; then rate "une archive tronquée a été acceptée"; fi
rm -f "$ARRIVEE/alteree.tar.gz" "$ARRIVEE/tronquee.tar.gz"; rm -rf "$R/alteree"
ok "archive altérée ou tronquée : refusée avant de rien poser"

# ---- 5. une base déjà présente n'est jamais écrasée (le cas du jour J de la bascule 1 : un service démarré à la place)
sqlite "$(rep nouveau test)/db/vivante.db" "CREATE TABLE personnage(id INTEGER PRIMARY KEY, nom TEXT); INSERT INTO personnage(nom) VALUES ('neuve');"
AVANT=$(sha256sum "$(rep nouveau test)/db/vivante.db" | cut -d' ' -f1)
if cote nouveau bash "$DEM" deballer --a-blanc "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1; then rate "une base présente a été acceptée"; fi
grep -q "pas vide" "$R/sortie" || rate "le refus ne dit pas que db/ n'est pas vide"
[ "$(sha256sum "$(rep nouveau test)/db/vivante.db" | cut -d' ' -f1)" = "$AVANT" ] || rate "la base présente a changé"
[ ! -e "$(rep nouveau)/.github-token" ] || rate "le refus est venu après des poses"
ok "une base déjà présente fait refuser le déballage, avant toute pose, sans la toucher"
mv "$(rep nouveau test)/db" "$(rep nouveau test)/db.neuve-essai"; mkdir "$(rep nouveau test)/db"
echo conteneur > "$(rep nouveau)/.en-marche"
if cote nouveau bash "$DEM" deballer --a-blanc "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1; then rate "des conteneurs qui tournent ont été acceptés"; fi
rm -f "$(rep nouveau)/.en-marche"

# ---- 6. déballer : à blanc, puis pour de vrai, puis un second passage refusé
cote nouveau bash "$DEM" deballer --a-blanc "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "le déballage à blanc a échoué"; }
[ -z "$(ls -A "$(rep nouveau test)/db")" ] || rate "le déballage à blanc a posé des fichiers"
cote nouveau bash "$DEM" deballer "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "le déballage a échoué"; }
[ "$(stat -c %a "$(rep nouveau)/.github-token")" = 600 ] || rate ".github-token n'est pas en 600"
[ "$(stat -c %a "$(rep nouveau test)/secrets/acces.json")" = 600 ] || rate "acces.json n'est pas en 600"
[ "$(stat -c %a "$R/nouveau/etc/maverick-sauvegardes")" = 700 ] || rate "/etc/maverick-sauvegardes n'est pas en 700"
[ -f "$R/nouveau/caddy/certificates/acme/maverick-jdr.com/maverick-jdr.com.crt" ] || rate "les certificats de Caddy ne sont pas posés"
[ ! -e "$R/nouveau/caddy/locks" ] || rate "les verrous de Caddy ont été emportés"
[ "$(cat "$(rep nouveau)/metriques/prod.db")" = metrique ] || rate "les métriques ne sont pas posées"
ls "$(rep nouveau)"/.env.avant-demenagement-* >/dev/null 2>&1 || rate "le .env du nouveau serveur n'a pas été mis de côté"
[ ! -e "$(rep nouveau)/GELER" ] || rate "GELER ne doit pas voyager"
# reprise après une panne : la même commande, relancée, ne repose pas ce qui est conforme (rien n'est écrasé) ; une base qui n'est plus celle de l'archive est refusée
cote nouveau bash "$DEM" deballer "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "la relance du déballage a échoué"; }
grep -q "déjà posé, conforme" "$R/sortie" || rate "la relance ne dit pas que tout est déjà posé"
touch "$(rep nouveau test)/db/intrus"
if cote nouveau bash "$DEM" deballer "$ARRIVEE_ARCHIVE" >"$R/sortie" 2>&1; then rate "une base qui n'est plus celle de l'archive a été acceptée"; fi
grep -q "pas vide" "$R/sortie" || rate "le refus ne dit pas que db/ n'est pas vide"
rm -f "$(rep nouveau test)/db/intrus"
ok "déballage : à blanc sans effet, vrai conforme (droits 600/700, .env précédent gardé à côté), relance sans dégât, base modifiée refusée"

# ---- 7. le contrôle d'égalité
cote nouveau bash "$CTL" bilan --sortie "$R/bilan-nouveau.txt" >/dev/null
RESULTAT=$(bash "$CTL" comparer "$R/bilan-ancien.txt" "$R/bilan-nouveau.txt") || { echo "$RESULTAT" >&2; rate "le contrôle n'a pas dit EGALITE"; }
case "$RESULTAT" in EGALITE*) ;; *) rate "résultat inattendu : $RESULTAT" ;; esac
ok "contrôle : $RESULTAT"

# ---- 7 bis. le service démarre sur le nouveau serveur : il écrit (une session, un fichier d'état), les fichiers et les journaux bougent. Le bilan « contenu seulement »
# (instantané SQLite) doit rester EGALITE ; le bilan complet, lui, ne le serait plus (c'est pourquoi la procédure ne compare le complet qu'avant le démarrage)
sqlite "$(rep nouveau test)/db/vivante.db" "INSERT INTO session(vu) VALUES ('demarrage'); UPDATE personnage SET nom = nom;"
echo '{"demarre":true}' > "$(rep nouveau test)/db/vivante.json"
LISTE_AVANT=$(cd "$(rep nouveau test)/db" && find . ! -name "vivante.db-*" | LC_ALL=C sort)   # (le -shm et le -wal de vivante.db existent déjà quand le service tourne)
cote nouveau bash "$CTL" bilan --contenu-seulement --sortie "$R/bilan-demarre.txt" >/dev/null
[ "$LISTE_AVANT" = "$(cd "$(rep nouveau test)/db" && find . ! -name "vivante.db-*" | LC_ALL=C sort)" ] || rate "le bilan sur un service en marche a créé des fichiers dans db/ (-shm, -wal d'une archive ?)"
grep -q '^mode=contenu$' "$R/bilan-demarre.txt" || rate "le bilan après démarrage n'est pas en mode contenu"
if grep -q '^\(fichier\|lignes\|logique\)\.' "$R/bilan-demarre.txt"; then rate "le bilan après démarrage garde des lignes qui bougent"; fi
RESULTAT=$(bash "$CTL" comparer "$R/bilan-ancien.txt" "$R/bilan-demarre.txt") || { echo "$RESULTAT" >&2; rate "après un démarrage simulé, le bilan « contenu seulement » diffère"; }
cote nouveau bash "$CTL" bilan --sortie "$R/bilan-complet-demarre.txt" >/dev/null
if bash "$CTL" comparer "$R/bilan-ancien.txt" "$R/bilan-complet-demarre.txt" >/dev/null; then rate "le bilan complet aurait dû voir les écritures du démarrage"; fi
ok "après un démarrage simulé : bilan « contenu seulement » EGALITE ($RESULTAT), le bilan complet voit bien le changement"
sqlite "$(rep nouveau test)/db/vivante.db" "DELETE FROM session;"
rm -f "$(rep nouveau test)/db/vivante.json"

# ---- 8. un cas altéré : une fiche de plus sur le nouveau serveur doit donner DIFFERENCE, avec la ligne en cause
sqlite "$(rep nouveau)/db/vivante.db" "INSERT INTO personnage(nom) VALUES ('fiche en trop');"
cote nouveau bash "$CTL" bilan --sortie "$R/bilan-altere.txt" >/dev/null
if bash "$CTL" comparer "$R/bilan-ancien.txt" "$R/bilan-altere.txt" >"$R/sortie" 2>&1; then rate "une fiche en trop n'a pas été vue"; fi
grep -q '^DIFFERENCE' "$R/sortie" && grep -q 'fiches.normal' "$R/sortie" && grep -q 'logique.normal' "$R/sortie" || rate "la différence n'est pas détaillée : $(cat "$R/sortie")"
ok "base altérée : DIFFERENCE, avec fiches.normal et logique.normal en cause"
sqlite "$(rep nouveau)/db/vivante.db" "DELETE FROM personnage WHERE nom = 'fiche en trop';"

# ---- 9. le retour arrière : le nouveau serveur gelé, ses données reprises sur l'ancien, qui a d'abord mis sa base de côté
sqlite "$(rep nouveau test)/db/vivante.db" "INSERT INTO personnage(nom) VALUES ('Dara');"   # une écriture faite sur le nouveau serveur, à ne pas perdre
touch "$(rep nouveau)/GELER" "$(rep nouveau test)/GELER"
cote nouveau bash "$DEM" emballer --sortie "$ARRIVEE" --sans sauvegardes,caddy >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "l'emballage du retour a échoué"; }
RETOUR=$(ls -t "$ARRIVEE"/demenagement-*.tar.gz | head -n 1)
cote nouveau bash "$CTL" bilan --sortie "$R/bilan-retour.txt" >/dev/null
cp "$RETOUR" "$SORTIE/retour.tar.gz"
if cote ancien bash "$DEM" deballer --sans sauvegardes,caddy,copies "$SORTIE/retour.tar.gz" >"$R/sortie" 2>&1; then rate "le retour a écrasé une base"; fi
for i in "" test; do mv "$(rep ancien $i)/db" "$(rep ancien $i)/db.avant-retour"; mkdir "$(rep ancien $i)/db"; done
cote ancien bash "$DEM" deballer --sans sauvegardes,caddy,copies "$SORTIE/retour.tar.gz" >"$R/sortie" 2>&1 || { cat "$R/sortie" >&2; rate "le retour arrière a échoué"; }
cote ancien bash "$CTL" bilan --sortie "$R/bilan-ancien-apres-retour.txt" >/dev/null
bash "$CTL" comparer "$R/bilan-retour.txt" "$R/bilan-ancien-apres-retour.txt" >"$R/sortie" || { cat "$R/sortie" >&2; rate "après le retour, les deux serveurs diffèrent"; }
grep -q '^fiches.test=4$' "$R/bilan-ancien-apres-retour.txt" || rate "l'écriture faite sur le nouveau serveur est perdue au retour"
[ -f "$(rep ancien test)/db.avant-retour/vivante.db" ] || rate "l'ancienne base n'a pas été gardée de côté"
ok "retour arrière : mêmes scripts dans l'autre sens, base de l'ancien gardée de côté, la fiche écrite sur le nouveau serveur est reprise, EGALITE"

echo
echo "REPETITION REUSSIE"
