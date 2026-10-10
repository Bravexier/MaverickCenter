"""Exporte une base SQLite (schéma data/schema.sql) vers data/rows, avec l'exporteur de tous les importeurs (maverick.exporter : un fichier par table
de base, une instruction par ligne, triée par clé primaire) — utilisé par `npm run db:appliquer-edition` (client/scripts/db-appliquer-edition.mjs),
qui rejoue le journal des modifications du site de dev dans une base reconstruite depuis data/rows, puis la fait réécrire ici.

    python3 -I tools/db/exporter.py <base.db> [--rows data/rows]

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


def main(argv):
    if not argv or argv[0].startswith('--'):
        sys.exit('usage : exporter.py <base.db> [--rows data/rows]')
    base = os.path.abspath(argv[0])
    rows = os.path.abspath(argv[argv.index('--rows') + 1]) if '--rows' in argv else os.path.join(RACINE, 'data', 'rows')
    if not os.path.exists(base):
        sys.exit(f'{base} : base introuvable')
    db = sqlite3.connect(base)
    v = db.execute('PRAGMA user_version').fetchone()[0]
    if v != T.version_schema():
        sys.exit(f'{base} : schéma {v}, data/schema.sql est en version {T.version_schema()}')
    resultat = T.exporter(db, rows)
    print(f'{len(resultat)} tables exportées dans {os.path.relpath(rows, RACINE)}')


if __name__ == '__main__':
    main(sys.argv[1:])
