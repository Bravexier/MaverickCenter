"""Exporte une base SQLite (schéma data/schema.sql) vers un dossier de lignes, avec l'exporteur de tous les importeurs (maverick.exporter : un fichier par
table de base, une instruction par ligne, triée par clé primaire ; le format de data/rows, octet pour octet).

    python3 -I tools/db/exporter.py <base.db> --rows <dossier>

Lot 12 du chantier « base de dev = source de vérité » (R274, R278) : data/rows est la copie du site de dev, écrite par le workflow seul (contrôle
`controle-du-contenu-ecrit`). L'exporteur n'écrit donc JAMAIS data/rows lui-même : `--rows` est exigé, et le dossier data/rows du dépôt est refusé. Ses
appelants exportent dans un dossier de travail, puis, sur les chemins permis, recopient eux-mêmes les fichiers contrôlés : la mise à jour des règles
(« Lot : », client/scripts/mise-a-jour-regles.mjs) et la copie vers le dépôt (« Copie : », client/scripts/mise-a-jour-paquet.mjs, réexport du paquet de
client/scripts/mise-a-jour-github.mjs) ; `db:migrate` passe par tools/db/migrer.py (maverick.migrer), pas par ce script. Les autres appelants écrivent
dans un dossier temporaire : les lignes de départ des tests (client/test/aide-base-de-depart.mjs#rowsDeDepart, aide-mise-a-jour.mjs…), et
`db:appliquer-edition` (client/scripts/db-appliquer-edition.mjs) seulement avec `--rows <copie>`.

Bibliothèque standard uniquement.
"""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import maverick as T  # noqa: E402

RACINE = os.path.abspath(os.path.join(HERE, '..', '..'))


ROWS_DU_DEPOT = os.path.join(RACINE, 'data', 'rows')


def main(argv):
    if not argv or argv[0].startswith('--') or '--rows' not in argv[:-1]:
        sys.exit('usage : exporter.py <base.db> --rows <dossier> (jamais data/rows : la copie du site de dev, écrite par le workflow seul)')
    base = os.path.abspath(argv[0])
    rows = os.path.abspath(argv[argv.index('--rows') + 1])
    if os.path.realpath(rows) == os.path.realpath(ROWS_DU_DEPOT):
        sys.exit(f'{rows} : data/rows du dépôt refusé (copie du site de dev, écrite par le workflow seul : exporter dans un dossier de travail)')
    if not os.path.exists(base):
        sys.exit(f'{base} : base introuvable')
    db = sqlite3.connect(base)
    v = db.execute('PRAGMA user_version').fetchone()[0]
    if v != T.version_schema():
        sys.exit(f'{base} : schéma {v}, data/schema.sql est en version {T.version_schema()}')
    resultat = T.exporter(db, rows)
    print(f'{len(resultat)} tables exportées dans {os.path.relpath(rows, RACINE)}')


if __name__ == '__main__':
    if sys.platform == "win32":  # sortie lue en UTF-8 par les outils Node (-I ignore PYTHONUTF8)
        for flux in (sys.stdout, sys.stderr):
            flux.reconfigure(encoding="utf-8", newline="\n")
    main(sys.argv[1:])
