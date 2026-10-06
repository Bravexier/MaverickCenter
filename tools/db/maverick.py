"""Module commun des importeurs Python (docs/sql/conception.md §5) : session, export déterministe, reconstruction de la base depuis data/rows.

Bibliothèque standard uniquement. Contrat :

    from maverick import session, Famille, ouvrir, exporter, reconstruire, normalize

    with session('magies', rows='data/rows') as f:      # 1. reconstruit la base de travail EN MÉMOIRE depuis data/rows (jetable : aucun état résiduel)
                                                        # 2. BEGIN ; clés étrangères différées ; DELETE ... WHERE origine = 'magies' dans toutes les tables
    with session('magies', 'bestiaire', rows='data/rows') as f:   # PLUSIEURS familles dans UNE transaction (contrat central : une famille qui en cite une autre
                                                        # se réimporte avec elle ; foreign_key_check à la fin) ; chaque ligne écrite précise alors son origine=
        f.page({'id': ..., 'type': ..., 'slug': ..., 'titre': ..., 'corps_md': ..., 'statut': ..., 'aliases': [...], 'tags': [...], 'sources': [...]})
        f.inserer('magie', id=..., nom=..., source_ref=...)      # origine = 'magies' posée par la famille ; origine différente : refusée
        f.entite('magie', 'magies/magie-du-sang', 'magies/magie-du-sang', principale=True)
        f.note('sort', id, rang, texte, source_ref, champ=..., cellule=..., nature='commentaire' | 'reponse', repond_a=rang_du_fil)
        f.ecart('competence', 'calme', 'nom', 'nom_different', 'fiche', detail, source_ref, valeur_a=..., source_b='guide', valeur_b=...)
        f.corrections(json.load(registre), 'magie-v8')           # trace miroir de tools/sheets/corrections.json (le dump est déjà corrigé)
    # sortie sans erreur : clés étrangères ET références génériques (page_entite, note_cellule, ecart_source) contrôlées, puis COMMIT puis exporter(db, rows) ;
    # sur exception ou référence rompue : ROLLBACK, data/rows intact

    # pièces détachées (tests, db:build) :
    db = ouvrir('var/travail.db')                       # crée la base d'après schema.sql ; refuse une base d'une autre version ; foreign_keys = ON
    exporter(db, 'data/rows')                           # export déterministe : un fichier par table de BASE, une ligne INSERT par ligne, triée par clé primaire
    reconstruire('var/maverick.db', 'data/rows')        # schéma + lignes -> base (même résultat que client/scripts/db-build.mjs)
"""
import contextlib
import hashlib
import json
import os
import re
import sqlite3
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = os.path.join(HERE, '..', '..', 'data', 'schema.sql')   # data/schema.sql : seule source de la structure


# --------------------------------------------------------------------------------------------------------------------
# normalize() : port exact de client/src/lib/text.mjs (testé contre le JavaScript : normalize.parity.py)
# --------------------------------------------------------------------------------------------------------------------
import bisect  # noqa: E402
from _diacritiques import PLAGES as _PLAGES  # noqa: E402  (généré par gen.diacritics.mjs : la propriété Unicode « Diacritic » que retire /\p{Diacritic}/gu)
_DEBUTS = [a for a, _ in _PLAGES]


def _diacritique(c):
    i = bisect.bisect_right(_DEBUTS, ord(c)) - 1
    return i >= 0 and ord(c) <= _PLAGES[i][1]


def normalize(value):
    s = unicodedata.normalize('NFD', str(value))
    s = ''.join(c for c in s if not _diacritique(c))
    s = s.lower().replace("'", '').replace('’', '')
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def lire_schema(chemin=SCHEMA):
    """-> (texte, tables, derivees) ; tables = noms des tables de BASE dans l'ordre du schéma (hors FTS et tables d'ombre)."""
    texte = open(chemin, encoding='utf-8').read()
    base, derivees, buf, derivee_suivante = [], [], '', False
    for ligne in texte.split('\n'):
        if not buf and ligne.startswith('-- @derivee'):
            derivee_suivante = True
            continue
        if not buf and (ligne.strip() == '' or ligne.startswith('--')):
            continue
        buf += ligne + '\n'
        if sqlite3.complete_statement(buf):
            m = re.match(r'\s*CREATE\s+(VIRTUAL\s+)?TABLE\s+(\w+)', buf, re.I)
            if m:
                (derivees if derivee_suivante else base).append((m.group(2), bool(m.group(1))))
            if m or buf.lstrip().upper().startswith('CREATE'):
                derivee_suivante = False
            buf = ''
    return texte, [n for n, _ in base], [n for n, _ in derivees]


def version_schema(chemin=SCHEMA):
    m = re.search(r'^PRAGMA user_version\s*=\s*(\d+)', open(chemin, encoding='utf-8').read(), re.M)
    return int(m.group(1))


def cles_primaires(db, table):
    info = db.execute(f'PRAGMA table_info("{table}")').fetchall()
    pk = [r[1] for r in sorted((r for r in info if r[5]), key=lambda r: r[5])]
    if not pk:
        raise ValueError(f'{table} : pas de clé primaire (obligatoire : elle fixe l\'ordre de l\'export)')
    return pk


def colonnes(db, table):
    return [r[1] for r in db.execute(f'PRAGMA table_info("{table}")')]


# --------------------------------------------------------------------------------------------------------------------
# Ouverture
# --------------------------------------------------------------------------------------------------------------------
def ouvrir(chemin=':memory:', schema=SCHEMA):
    """Ouvre (ou crée) la base de travail. PRAGMA foreign_keys = ON à chaque connexion (SQLite ne le mémorise pas)."""
    neuve = chemin == ':memory:' or not os.path.exists(chemin) or os.path.getsize(chemin) == 0
    db = sqlite3.connect(chemin, isolation_level=None)       # transactions explicites (BEGIN / COMMIT)
    db.execute('PRAGMA foreign_keys = ON')
    if neuve:
        db.executescript(open(schema, encoding='utf-8').read())
    else:
        v = db.execute('PRAGMA user_version').fetchone()[0]
        if v != version_schema(schema):
            raise RuntimeError(f'{chemin} : schéma version {v}, attendu {version_schema(schema)} : npm run db:build ou db:migrate')
    return db


# --------------------------------------------------------------------------------------------------------------------
# Remplacer une famille d'importeur
# --------------------------------------------------------------------------------------------------------------------
def _ordre_suppression(db, tables):
    """Tables rangées enfants d'abord (graphe des clés étrangères) : la suppression ne rencontre jamais de RESTRICT."""
    parents = {t: {r[2] for r in db.execute(f'PRAGMA foreign_key_list("{t}")') if r[2] != t} for t in tables}
    ordre, vus = [], set()

    def visite(t):
        if t in vus:
            return
        vus.add(t)
        for enfant in (c for c in tables if t in parents[c]):
            visite(enfant)
        ordre.append(t)
    for t in sorted(tables):
        visite(t)
    return ordre


# --------------------------------------------------------------------------------------------------------------------
# Contrôle des références : clés étrangères (avec la ligne fautive nommée) + références génériques (entite_table, entite_id)
# --------------------------------------------------------------------------------------------------------------------
def proprietaires(db):
    """{table: ensemble des familles qui peuvent y écrire} d'après le CHECK de `origine` (« origine = 'x' » ou « origine IN ('a', 'b') ») ;
    None pour une table sans restriction (page, page_entite, note_cellule, ecart_source)."""
    res = {}
    for nom, sql in db.execute("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%origine%'"):
        m = re.search(r"CHECK\s*\(\s*origine\s*=\s*'(\w+)'\s*\)", sql)
        m2 = re.search(r"CHECK\s*\(\s*origine\s+IN\s*\(([^)]*)\)\s*\)", sql)
        res[nom] = {m.group(1)} if m else (set(re.findall(r"'(\w+)'", m2.group(1))) if m2 else None)
    return res


def lire_heritage(chemin):
    """data/heritage.json : {"familles": [...]} = familles dont l'importeur n'est pas encore livré (leurs tables typées sont vides : design.md §9, §11)."""
    if chemin and os.path.exists(chemin):
        return list(json.load(open(chemin, encoding='utf-8')).get('familles', []))
    return []


def _cle_enfant(db, table):
    pk = cles_primaires(db, table)
    return pk


def lignes_orphelines(db, table, fkid):
    """Lignes de `table` dont la clé étrangère `fkid` ne trouve pas son parent : [(valeurs de la clé primaire, valeur citée)]. `PRAGMA foreign_key_check`
    ne donne pas de rowid pour les tables WITHOUT ROWID : on rejoue le contrôle en SQL pour nommer la ligne fautive."""
    fks = [f for f in db.execute(f'PRAGMA foreign_key_list("{table}")') if f[0] == fkid]
    fks.sort(key=lambda f: f[1])
    parent = fks[0][2]
    cc = [f[3] for f in fks]
    pc = [f[4] for f in fks]
    if any(c is None for c in pc):
        pc = cles_primaires(db, parent)[:len(cc)]
    pk = cles_primaires(db, table)
    cond = ' AND '.join(f'p."{b}" = c."{a}"' for a, b in zip(cc, pc))
    notnull = ' AND '.join(f'c."{a}" IS NOT NULL' for a in cc)
    sel = ', '.join(f'c."{k}"' for k in pk) + ', ' + ', '.join(f'c."{a}"' for a in cc)
    rows = db.execute(f'SELECT {sel} FROM "{table}" c WHERE {notnull} AND NOT EXISTS (SELECT 1 FROM "{parent}" p WHERE {cond})').fetchall()
    return [(tuple(r[:len(pk)]), tuple(r[len(pk):]), cc, parent) for r in rows]


def references_generiques(db):
    """Références sans clé étrangère : note_cellule, ecart_source, page_entite visent une entité par (entite_table, entite_id) ; l'id d'une table à clé composite
    est la clé primaire jointe par '|' (convention de l'API). -> liste de messages."""
    base = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    msgs = []
    for src in ('note_cellule', 'ecart_source', 'page_entite'):
        if src not in base:
            continue
        for (cible,) in db.execute(f'SELECT DISTINCT entite_table FROM "{src}" ORDER BY 1').fetchall():
            if cible not in base:
                msgs.append(f'{src} : table cible « {cible} » inconnue')
                continue
            pk = cles_primaires(db, cible)
            expr = " || '|' || ".join(f'CAST("{c}" AS TEXT)' for c in pk)
            for (i,) in db.execute(f'SELECT DISTINCT entite_id FROM "{src}" WHERE entite_table = ? AND NOT EXISTS (SELECT 1 FROM "{cible}" WHERE {expr} = "{src}".entite_id) ORDER BY 1 LIMIT 5', (cible,)).fetchall():
                msgs.append(f'{src} : l\'entité {cible} « {i} » n\'existe pas')
    return msgs


def controle_references(db, heritees=()):
    """Toutes les références rompues de la base, nommées : clés étrangères (ligne fautive et valeur citée) puis références génériques.
    `heritees` : familles dont l'importeur n'est pas livré ; une clé étrangère vers une table que SEULES des familles héritées écrivent (donc vide par
    construction) est TOLÉRÉE (design.md §11 : le noyau des règles se livre en plusieurs PR). -> (violations, tolerees) : listes de messages."""
    heritees = set(heritees)
    prop = proprietaires(db)
    violations, tolerees = [], []
    groupes = sorted({(r[0], r[2], r[3]) for r in db.execute('PRAGMA foreign_key_check')})
    for table, parent, fkid in groupes:
        toleree = bool(heritees) and prop.get(parent) is not None and prop[parent] <= heritees
        for pkv, val, cols, par in lignes_orphelines(db, table, fkid):
            msg = f'{table} {dict(zip(cles_primaires(db, table), pkv))} : {"/".join(cols)} = {val if len(val) > 1 else val[0]!r} absent de {par}'
            (tolerees if toleree else violations).append(msg)
    violations += references_generiques(db)
    return violations, tolerees


# --------------------------------------------------------------------------------------------------------------------
# Remplacer une ou plusieurs familles d'importeur
# --------------------------------------------------------------------------------------------------------------------
class Famille:
    """Remplace TOUTES les lignes d'une ou de PLUSIEURS familles (origine IN familles) dans UNE transaction. Les clés étrangères sont différées jusqu'au COMMIT :
    une ligne d'une AUTRE famille qui visait une ligne supprimée et non réimportée fait échouer le remplacement (rien n'est modifié). Une famille que d'autres
    familles citent (une magie, un sort, une race…) se réimporte donc AVEC celles qui la citent : un identifiant renommé dans la source n'est importable que
    de cette façon (design.md §4.2, revue B2)."""

    def __init__(self, db, familles, schema=SCHEMA, heritees=()):
        self.db = db
        self.familles = [familles] if isinstance(familles, str) else list(familles)
        self.famille = self.familles[0] if len(self.familles) == 1 else None        # compatibilité : importeur à une seule famille
        self.heritees = list(heritees)
        _, base, _ = lire_schema(schema)
        self.tables = [t for t in base if 'origine' in colonnes(db, t) and t != 'famille']
        if not self.familles or len(set(self.familles)) != len(self.familles):
            raise ValueError(f'familles : liste vide ou doublon ({self.familles})')
        for fam in self.familles:
            if not db.execute('SELECT 1 FROM famille WHERE id = ?', (fam,)).fetchone():
                raise ValueError(f'famille inconnue : {fam!r} (la déclarer dans data/rows/famille.sql)')
        self.supprimees = {}
        self.tolerees = []

    def __enter__(self):
        self.db.execute('BEGIN')
        self.db.execute('PRAGMA defer_foreign_keys = ON')
        qs = ', '.join('?' for _ in self.familles)
        for t in _ordre_suppression(self.db, self.tables):
            n = self.db.execute(f'DELETE FROM "{t}" WHERE origine IN ({qs})', self.familles).rowcount
            if n:
                self.supprimees[t] = n
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is not None:
            self.db.execute('ROLLBACK')
            return False
        # `source` est partagée entre pages (pas de colonne origine) : on retire celles qu'aucune page ne cite plus, pour que le remplacement d'une famille
        # laisse exactement l'état qu'aurait donné un import complet
        self.db.execute('DELETE FROM source WHERE id NOT IN (SELECT source_id FROM page_source)')
        violations, self.tolerees = controle_references(self.db, self.heritees)
        if violations:
            self.db.execute('ROLLBACK')
            raise RuntimeError('clés étrangères violées après le remplacement de %s : %s' % (', '.join(map(repr, self.familles)), violations[:10]))
        self.db.execute('COMMIT')
        return False

    # -- écriture --------------------------------------------------------------------------------------------------
    def _origine(self, origine=None):
        if origine is None:
            if len(self.familles) != 1:
                raise ValueError(f'session de plusieurs familles {self.familles} : préciser origine= pour chaque ligne écrite')
            return self.familles[0]
        if origine not in self.familles:
            raise ValueError(f'origine {origine!r} hors des familles de la session {self.familles}')
        return origine

    def inserer(self, table, ligne=None, **kw):
        ligne = dict(ligne or {}, **kw)
        cols = colonnes(self.db, table)
        if 'origine' in cols:
            ligne['origine'] = self._origine(ligne.get('origine'))
        inconnues = set(ligne) - set(cols)
        if inconnues:
            raise ValueError(f'{table} : colonnes inconnues {sorted(inconnues)}')
        noms = list(ligne)
        self.db.execute(f'INSERT INTO "{table}" ({", ".join(noms)}) VALUES ({", ".join("?" for _ in noms)})', [ligne[n] for n in noms])

    def page(self, p):
        """Une page et ses lignes liées (alias, mots-clés, sources). Les clés (titre_cle, alias.cle, tag_id) sont calculées ici."""
        if not p['corps_md'].endswith('\n'):
            raise ValueError(f"{p['id']} : le corps doit finir par un retour à la ligne")
        donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
        self.inserer('page', id=p['id'], type=p['type'], slug=p['slug'], titre=p['titre'], titre_cle=normalize(p['titre']),
                     resume=p.get('resume'), donnees=donnees, corps_md=p['corps_md'], statut=p['statut'],
                     source_ref=p.get('source_ref'), origine=p.get('origine'))
        for i, texte in enumerate(p.get('aliases', [])):
            self.db.execute('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?,?,?,?)', (p['id'], i, texte, normalize(texte)))
        for i, libelle in enumerate(p.get('tags', [])):
            self.db.execute('INSERT INTO page_tag (page_id, ordre, tag_id, libelle) VALUES (?,?,?,?)', (p['id'], i, normalize(libelle), libelle))
        for i, texte in enumerate(p.get('sources', [])):
            s = decouper_source(texte)
            self.db.execute('INSERT OR IGNORE INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) '
                            'VALUES (:id,:nature,:texte,:url,:genre,:google_id,:fichier,:onglets)', s)
            ex = self.db.execute('SELECT texte FROM source WHERE id = ?', (s['id'],)).fetchone()
            if ex[0] != texte:
                raise ValueError(f"collision d'id de source : {s['id']} pour {texte!r} et {ex[0]!r}")
            self.db.execute('INSERT INTO page_source (page_id, ordre, source_id) VALUES (?,?,?)', (p['id'], i, s['id']))

    def entite(self, table, entite_id, page_id, principale=False, origine=None):
        self.inserer('page_entite', entite_table=table, entite_id=entite_id, page_id=page_id, principale=1 if principale else 0, origine=origine)

    def note(self, table, entite_id, rang, texte, source_ref, champ=None, cellule=None, nature=None, repond_a=None, origine=None):
        """Note ou commentaire de cellule. nature 'reponse' / 'evenement' : `repond_a` = rang du commentaire qui ouvre le fil (même entité)."""
        self.inserer('note_cellule', entite_table=table, entite_id=entite_id, rang=rang, champ=champ, cellule=cellule, nature=nature,
                     repond_a=repond_a, texte=texte, source_ref=source_ref, origine=origine)

    def corrections(self, registre, dump, origine=None):
        """Recopie dans `correction` la section `dump` du registre `tools/sheets/corrections.json` (déjà lu avec json.load) : trace miroir. L'application
        au dump est faite AVANT l'extracteur par tools/sheets/corriger-dump.py ; ici on ne corrige rien."""
        section = registre['dumps'].get(dump)
        if section is None:
            return 0
        for c in section['corrections']:
            self.inserer('correction', dump=dump, classeur=section['classeur'], onglet=c['onglet'], cellule=c['cellule'], champ=c.get('champ', 'v'),
                         avant=c['avant'], apres=c['apres'], occurrences=c.get('occurrences', 1), nature=c['nature'], note=c['note'],
                         source_ref=f"{section['classeur']} › {c['onglet']} › {c['cellule']}", origine=origine)
        return len(section['corrections'])

    def ecart(self, table, entite_id, champ, nature, source_a, detail, source_ref, valeur_a=None, source_b=None, valeur_b=None, origine=None):
        cle = f'{table}:{entite_id}:{champ}:{nature}:{source_a}' + (f':{source_b}' if source_b is not None else '')
        self.inserer('ecart_source', id=cle, entite_table=table, entite_id=entite_id, champ=champ, nature=nature, source_a=source_a,
                     valeur_a=valeur_a, source_b=source_b, valeur_b=valeur_b, detail=detail, source_ref=source_ref, origine=origine)


@contextlib.contextmanager
def session(*familles, rows, schema=SCHEMA, heritees=None):
    """Un passage d'importeur = reconstruire (1 à 2 s) -> remplacer la ou les familles -> exporter. La base de travail est recréée à chaque passage depuis les
    lignes versionnées : elle ne peut pas être « polluée » par une expérience, et les autres familles sont conservées telles que commitées.
    `session('magies', 'bestiaire', rows=…)` : plusieurs familles dans une seule transaction (npm run db:import -- --toutes pour toutes).
    `heritees` : familles non encore livrées (défaut : <rows>/../heritage.json) dont les références manquantes sont tolérées."""
    if heritees is None:
        heritees = lire_heritage(os.path.join(rows, '..', 'heritage.json'))
    db = reconstruire(':memory:', rows, schema, heritees=heritees)
    with Famille(db, familles, schema, heritees=heritees) as f:
        yield f
    exporter(db, rows, schema)


def decouper_source(texte):
    """Extraits MÉCANIQUES d'une entrée de `sources:` d'une page (rien n'est déduit ni apparié)."""
    ligne = dict(id=None, nature=None, texte=texte, url=None, genre=None, google_id=None, fichier=None, onglets=None)
    if re.match(r'https?://', texte):
        ligne.update(nature='url', url=texte)
        g = re.match(r'https://docs\.google\.com/(document|spreadsheets)/d/([A-Za-z0-9_-]+)(?:[/?#]|\Z)', texte)
        if g:
            ligne.update(genre='doc' if g.group(1) == 'document' else 'sheet', google_id=g.group(2))
            ligne['id'] = f"google-{ligne['genre']}:{g.group(2)}"
        else:
            ligne['id'] = 'url:' + texte
    else:
        ligne.update(nature='libelle', id='ref:' + normalize(texte))
        g = re.match(r'^Google (Doc|Sheet) « (.+?) »(?:, onglets? (.+))?\Z', texte)
        if g:
            ligne.update(genre='doc' if g.group(1) == 'Doc' else 'sheet', fichier=g.group(2))
            if g.group(3):
                ligne['onglets'] = json.dumps(re.findall(r'« (.+?) »', g.group(3)), ensure_ascii=False)
    return ligne


# --------------------------------------------------------------------------------------------------------------------
# Export déterministe : data/rows/<table>.sql
# --------------------------------------------------------------------------------------------------------------------
_CONTROLES = re.compile('[\x00-\x08\x0b-\x1f\x7f]')   # tout caractère de contrôle sauf \t et \n


def litteral(v):
    """Littéral SQL. Le texte garde ses retours à la ligne (un diff git ne montre que les lignes modifiées d'un texte Markdown) ;
    les autres caractères de contrôle (\\r, \\0…) passent par char() : le fichier ne contient jamais d'octet qui change selon l'éditeur ou git."""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        raise TypeError('booléen : utiliser 0 / 1')
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if v != v or v in (float('inf'), float('-inf')):
            raise ValueError('nombre non fini')
        return repr(v)
    if isinstance(v, str):
        morceaux, dernier = [], 0
        for m in _CONTROLES.finditer(v):
            if m.start() > dernier:
                morceaux.append("'" + v[dernier:m.start()].replace("'", "''") + "'")
            morceaux.append(f'char({ord(m.group())})')
            dernier = m.end()
        if dernier < len(v) or not morceaux:
            morceaux.append("'" + v[dernier:].replace("'", "''") + "'")
        return '||'.join(morceaux)
    raise TypeError(f'type non exportable : {type(v).__name__}')


def en_tete(table, pk):
    """Sans numéro de version : il vit dans UN fichier (data/rows/VERSION). Une montée de version ne réécrit plus 133 fichiers et ne fait plus conflit entre branches."""
    return f'-- data/rows/{table}.sql : export déterministe, une instruction par ligne, triée par ({", ".join(pk)}). NE PAS ÉDITER À LA MAIN.\n'


def exporter_table(db, table):
    """-> (texte du fichier, nombre de lignes)."""
    cols = colonnes(db, table)
    pk = cles_primaires(db, table)
    tete = f'INSERT INTO {table} ({", ".join(cols)}) VALUES ('
    ordre = ', '.join(f'"{c}"' for c in pk)
    sortie = [en_tete(table, pk)]
    n = 0
    for row in db.execute(f'SELECT {", ".join(chr(34) + c + chr(34) for c in cols)} FROM "{table}" ORDER BY {ordre}'):
        sortie.append(tete + ', '.join(litteral(v) for v in row) + ');\n')
        n += 1
    return ''.join(sortie), n


def exporter(db, dossier, schema=SCHEMA):
    """Écrit un fichier par table de BASE (les tables dérivées sont ignorées) ; supprime les fichiers qui ne correspondent plus à une table.
    -> {table: (nb lignes, sha256 du fichier)}."""
    _, base, _ = lire_schema(schema)
    version = version_schema(schema)
    os.makedirs(dossier, exist_ok=True)
    with open(os.path.join(dossier, 'VERSION'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'schema_version={version}\n')
    resultat = {}
    for t in base:
        texte, n = exporter_table(db, t)
        with open(os.path.join(dossier, t + '.sql'), 'w', encoding='utf-8', newline='\n') as f:
            f.write(texte)
        resultat[t] = (n, hashlib.sha256(texte.encode('utf-8')).hexdigest()[:16])
    for nom in os.listdir(dossier):
        if nom.endswith('.sql') and nom[:-4] not in resultat:
            os.remove(os.path.join(dossier, nom))
    return resultat


# --------------------------------------------------------------------------------------------------------------------
# Reconstruction : schéma + lignes -> base (équivalent Python de client/scripts/db-build.mjs ; les tables dérivées viennent après)
# --------------------------------------------------------------------------------------------------------------------
def version_rows(dossier_rows):
    """Version du schéma des lignes exportées : le fichier VERSION (« schema_version=N »)."""
    chemin = os.path.join(dossier_rows, 'VERSION')
    if not os.path.exists(chemin):
        raise RuntimeError(f'{dossier_rows}/VERSION absent : jeu de lignes incomplet ou d\'avant la version unique')
    m = re.fullmatch(r'schema_version=(\d+)\n', open(chemin, encoding='utf-8', newline='').read())
    if not m:
        raise RuntimeError(f'{chemin} illisible')
    return int(m.group(1))


def reconstruire(chemin_db, dossier_rows, schema=SCHEMA, heritees=None):
    texte, base, _ = lire_schema(schema)
    attendue = version_schema(schema)
    v = version_rows(dossier_rows)                                   # la version d'abord : un jeu de lignes d'une autre version se migre, il ne se charge pas
    if v != attendue:
        raise RuntimeError(f'{dossier_rows}/VERSION : version {v} != schéma {attendue} (npm run db:migrate)')
    manquants = [t for t in base if not os.path.exists(os.path.join(dossier_rows, t + '.sql'))]
    en_trop = [n for n in os.listdir(dossier_rows) if n.endswith('.sql') and n[:-4] not in base]
    if manquants or en_trop:
        raise RuntimeError(f'data/rows/ ne correspond pas au schéma : fichiers manquants {manquants}, en trop {en_trop}')
    if chemin_db != ':memory:' and os.path.exists(chemin_db):
        os.remove(chemin_db)
    db = sqlite3.connect(chemin_db, isolation_level=None)
    db.executescript(texte)
    morceaux = ['PRAGMA foreign_keys = OFF;\nBEGIN;\n']          # l'ordre des fichiers est sans importance : on contrôle APRÈS
    for t in base:
        morceaux.append(open(os.path.join(dossier_rows, t + '.sql'), encoding='utf-8', newline='').read())
    morceaux.append('COMMIT;\n')
    db.executescript(''.join(morceaux))
    if heritees is None:
        heritees = lire_heritage(os.path.join(dossier_rows, '..', 'heritage.json'))
    violations, tolerees = controle_references(db, heritees)
    if violations:
        raise RuntimeError(f'clés étrangères violées : {violations[:10]} (… {len(violations)})')
    db.execute('PRAGMA foreign_keys = ON')
    return db


# --------------------------------------------------------------------------------------------------------------------
# Migration de schéma (prototype de `npm run db:migrate`, design.md §10.1)
# --------------------------------------------------------------------------------------------------------------------
def _normaliser_sql(sql):
    sql = re.sub(r'--[^\n]*', '', sql or '')
    sql = re.sub(r'"([A-Za-z_][A-Za-z_0-9]*)"', r'\1', sql)
    sql = re.sub(r'\s+', ' ', sql).strip().lower()
    return re.sub(r' ?([,()]) ?', r'\1', sql).rstrip(';')


def comparer_schemas(a, b):
    """Écarts entre deux bases : tables, colonnes (dans l'ordre), index, vues. Texte normalisé (commentaires, espaces, guillemets d'identifiants ignorés).
    Une colonne ajoutée doit se placer EN DERNIER dans schema.sql : sinon l'ordre des colonnes de l'export diffère d'une base migrée à une base neuve."""
    def objets(db):
        res = {}
        for typ, nom, sql in db.execute("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"):
            if typ == 'table' and re.search(r'_(data|idx|content|docsize|config)$', nom):
                continue                                               # tables d'ombre de FTS5
            res[(typ, nom)] = _normaliser_sql(sql)
        return res
    oa, ob = objets(a), objets(b)
    ecarts = [f'{t} {n} : absent de la base migrée' for (t, n) in sorted(set(ob) - set(oa))]
    ecarts += [f'{t} {n} : absent du schéma attendu' for (t, n) in sorted(set(oa) - set(ob))]
    for cle in sorted(set(oa) & set(ob)):
        if oa[cle] != ob[cle]:
            ecarts.append(f'{cle[0]} {cle[1]} : définition différente\n      migrée  : {oa[cle][:160]}\n      attendu : {ob[cle][:160]}')
    for (typ, nom) in sorted(set(oa) & set(ob)):
        if typ == 'table':
            ca = [r[1:] for r in a.execute(f'PRAGMA table_xinfo("{nom}")')]
            cb = [r[1:] for r in b.execute(f'PRAGMA table_xinfo("{nom}")')]
            if ca != cb:
                ecarts.append(f'table {nom} : colonnes (ou leur ordre) différentes : {[c[0] for c in ca]} / {[c[0] for c in cb]}')
    return ecarts


def migrer(rows_ancien, schema_ancien, migration_sql, schema_nouveau, rows_nouveau):
    """Passe les lignes de la version N-1 à la version N : reconstruit la base N-1 (son schéma, ses lignes), exécute la migration dans UNE transaction
    (clés étrangères suspendues pendant la réécriture de tables, contrôlées avant le COMMIT), vérifie que le schéma obtenu est celui de `schema_nouveau`,
    puis exporte avec `schema_version=N`. Tout écart arrête avant d'écrire : rows_nouveau n'est jamais à moitié écrit."""
    ancien_v, nouveau_v = version_schema(schema_ancien), version_schema(schema_nouveau)
    if nouveau_v != ancien_v + 1:
        raise ValueError(f'migration {ancien_v} -> {nouveau_v} : les versions se suivent une à une')
    if re.match(r'\s*(--[^\n]*\n\s*)*(BEGIN|COMMIT|ROLLBACK|PRAGMA)\b', migration_sql, re.I):
        raise ValueError('la migration ne gère ni ses transactions ni ses PRAGMA : migrer() ouvre la transaction et contrôle les clés étrangères')
    db = reconstruire(':memory:', rows_ancien, schema_ancien)
    db.execute('PRAGMA foreign_keys = OFF')
    try:
        db.executescript('BEGIN;\n' + migration_sql)              # (executescript valide toute transaction en cours : le BEGIN est donc DANS le script)
        violations = db.execute('PRAGMA foreign_key_check').fetchall()
        if violations:
            raise RuntimeError(f'migration refusée : clés étrangères violées {violations[:5]}')
        db.execute(f'PRAGMA user_version = {nouveau_v}')
        ref = sqlite3.connect(':memory:')
        ref.executescript(open(schema_nouveau, encoding='utf-8').read())
        ecarts = comparer_schemas(db, ref)
        if ecarts:
            raise RuntimeError('migration refusée : le schéma obtenu n\'est pas celui de schema.sql\n  ' + '\n  '.join(ecarts[:12]))
        db.execute('COMMIT')
    except BaseException as e:
        if db.in_transaction:
            db.execute('ROLLBACK')
        if isinstance(e, sqlite3.Error):
            raise RuntimeError(f'migration refusée : {e}') from e
        raise
    exporter(db, rows_nouveau, schema_nouveau)
    return nouveau_v


def empreinte(db, tables):
    """sha256 du contenu de chaque table (lignes triées par clé primaire) : compare deux bases sans dépendre de leur format de fichier."""
    out = {}
    for t in tables:
        pk = ', '.join(f'"{c}"' for c in cles_primaires(db, t))
        h = hashlib.sha256()
        for row in db.execute(f'SELECT * FROM "{t}" ORDER BY {pk}'):
            h.update(json.dumps(row, ensure_ascii=False).encode('utf-8') + b'\n')
        out[t] = (db.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0], h.hexdigest()[:12])
    return out
