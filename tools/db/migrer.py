"""Migration de schéma des lignes versionnées (docs/sql/conception.md §10.1) : `npm run db:migrate` (dans client/).

    python3 -I tools/db/migrer.py data/migrations/NNNN-<nom>.sql [--rows data/rows] [--schema-ancien <fichier>]

Transforme les lignes DÉJÀ commitées de la version N-1 à la version N, sans accéder aux sources : reconstruit la base N-1 (lignes + schéma de la version précédente), exécute
la migration dans UNE transaction, vérifie que le schéma obtenu est exactement `data/schema.sql` (colonnes dans l'ordre : une colonne ajoutée va EN DERNIER), puis réécrit
`data/rows` avec `schema_version=N`. Tout écart arrête avant d'écrire.

Le schéma de la version N-1 est, par défaut, celui du dernier commit (`git show HEAD:data/schema.sql`) : lancer la migration AVANT de commiter la modification de `data/schema.sql`.
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import maverick as T  # noqa: E402

RACINE = os.path.abspath(os.path.join(HERE, '..', '..'))


def main(argv):
    if not argv or argv[0].startswith('--'):
        sys.exit('usage : migrer.py <migration.sql> [--rows data/rows] [--schema-ancien <fichier>]')
    migration = os.path.abspath(argv[0])
    option = lambda nom, defaut: argv[argv.index(nom) + 1] if nom in argv else defaut  # noqa: E731
    rows = os.path.abspath(option('--rows', os.path.join(RACINE, 'data', 'rows')))
    ancien = option('--schema-ancien', None)
    tmp = None
    try:
        if ancien is None:
            r = subprocess.run(['git', 'show', 'HEAD:data/schema.sql'], cwd=RACINE, capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(f'schéma précédent introuvable (git show HEAD:data/schema.sql) : {r.stderr.strip()}')
            tmp = tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8')
            tmp.write(r.stdout)
            tmp.close()
            ancien = tmp.name
        version = T.migrer(rows, ancien, open(migration, encoding='utf-8').read(), T.SCHEMA, rows)
    except (RuntimeError, ValueError) as e:
        print(f'refusé : {e}')
        return 1
    finally:
        if tmp:
            os.unlink(tmp.name)
    print(f'data/rows migré à la version {version} par {os.path.basename(migration)}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
