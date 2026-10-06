"""Pages Markdown <-> data/rows (docs/sql/conception.md §9).

Lit client/src/content/wiki/<type>/<slug>.md avec le sous-ensemble STRICT de YAML que les importeurs écrivent (toute autre forme arrête le chargement),
déduit la famille d'import d'une page de sa PROVENANCE déclarée (`sources:`, jamais du contenu).

    python3 -I tools/db/pages_md.py check [--rows data/rows] [--wiki <dossier>]   les pages de data/rows sont-elles celles des .md ?  (code 1 sinon)
    python3 -I tools/db/pages_md.py sync  [--rows data/rows] [--wiki <dossier>]   remet à jour data/rows depuis les .md (contenu des pages existantes)

Une page ajoutée ou retirée n'est PAS gérée ici : elle passe par l'importeur de sa famille (les lignes typées qui s'y rattachent en dépendent).
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)      # `python3 -I` n'ajoute pas le dossier du script au chemin des modules
import maverick as T  # noqa: E402

RACINE = os.path.abspath(os.path.join(HERE, '..', '..'))
WIKI = os.environ.get('WIKI_DIR', os.path.join(RACINE, 'client', 'src', 'content', 'wiki'))
TYPES_MJS = os.environ.get('TYPES_MJS', os.path.join(RACINE, 'client', 'src', 'lib', 'types.mjs'))
ROWS = os.path.join(RACINE, 'data', 'rows')


FRONT_RE = re.compile(r'^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)\Z')
CLES = ('title', 'aliases', 'tags', 'summary', 'sources', 'status')
LISTES = ('aliases', 'tags', 'sources')
STATUTS = ('example', 'draft', 'verified')


def _scalaire(brut, cle):
    brut = brut.strip()
    if brut.startswith('"'):
        return json.loads(brut)
    if brut == '' or brut[0] in "'[{&*!|>%@`#" or ': ' in brut or ' #' in brut or brut.endswith(':'):
        raise ValueError(f'scalaire YAML hors du sous-ensemble géré ({cle}) : {brut!r}')
    return brut


def _liste(brut, cle):
    brut = brut.strip()
    if not (brut.startswith('[') and brut.endswith(']')):
        raise ValueError(f'liste YAML attendue au format [a, b] ({cle}) : {brut!r}')
    if brut == '[]':
        return []
    if brut.startswith('["'):
        valeur = json.loads(brut)
        if not all(isinstance(v, str) for v in valeur):
            raise ValueError(f'liste non textuelle ({cle})')
        return valeur
    interieur = brut[1:-1]
    if any(c in interieur for c in '[]{}"\'#:'):
        raise ValueError(f'liste YAML hors du sous-ensemble géré ({cle}) : {brut!r}')
    return [x.strip() for x in interieur.split(',')]


def parse_frontmatter(texte):
    """-> (dict, corps). Sous-ensemble strict de YAML : exactement ce qu'écrivent les importeurs et les pages d'exemple.
    Clés supplémentaires (page.donnees) : chaîne JSON, liste de chaînes JSON ou entier. Toute autre forme arrête le chargement."""
    m = FRONT_RE.match(texte)
    if not m:
        raise ValueError("pas d'en-tête ---")
    data = {}
    for ligne in m.group(1).split('\n'):
        k = re.match(r'^([a-z][a-z_]*): ?(.*)$', ligne)
        if not k:
            raise ValueError(f'ligne de frontmatter inattendue : {ligne!r}')
        cle, brut = k.groups()
        if cle in data:
            raise ValueError(f'clé en double : {cle}')
        if cle in LISTES:
            data[cle] = _liste(brut, cle)
        elif cle in CLES:
            data[cle] = _scalaire(brut, cle)
        else:
            b = brut.strip()
            if re.fullmatch(r'-?\d+', b):
                valeur = int(b)
            elif b[:1] in ('"', '['):
                valeur = json.loads(b)
            else:
                valeur = None
            if valeur is None or not (isinstance(valeur, (str, int)) or (isinstance(valeur, list) and all(isinstance(v, str) for v in valeur))):
                raise ValueError(f'clé supplémentaire hors du sous-ensemble géré ({cle}) : {brut!r}')
            data[cle] = valeur
    return data, m.group(2)


def emit_frontmatter(p):
    j = lambda v: json.dumps(v, ensure_ascii=False)
    liste = lambda v: '[' + ', '.join(j(x) for x in v) + ']'
    lignes = ['---', 'title: ' + j(p['titre']), 'aliases: ' + liste(p['aliases']), 'tags: ' + liste(p['tags'])]
    if p['resume'] is not None:
        lignes.append('summary: ' + j(p['resume']))
    for cle, valeur in (p.get('donnees') or {}).items():
        lignes.append(f'{cle}: ' + (liste(valeur) if isinstance(valeur, list) else str(valeur) if isinstance(valeur, int) else j(valeur)))
    lignes += ['sources: ' + liste(p['sources']), 'status: ' + p['statut'], '---']
    return '\n'.join(lignes) + '\n'


EQUIPEMENT = {'equipement-inventaire', 'armes', 'armures', 'bouclier', 'baton-magique', 'livre-parchemin', 'accessoires', 'pieces-elementaires'}
CRAFT = {'familiers', 'maison', 'machine-de-guerresiege', 'fievre-des-marais', 'maladie', 'fiche-de-tour'}


def origine_migration(type_, slug, statut, sources):
    """Famille d'importeur d'une page existante, déduite de sa PROVENANCE déclarée (jamais du contenu)."""
    if statut == 'example':
        return 'exemple'
    libelles = [s for s in sources if not s.startswith('http')]
    premier = libelles[0] if libelles else ''
    fichier = (T.decouper_source(premier)['fichier'] if premier else None) or ''
    if premier.startswith('Google Doc'):
        return 'docs'
    if fichier == 'Invocation':
        return 'bestiaire'
    if fichier == 'Classe Maverick V7':
        return 'classes'
    if fichier == 'Les races':
        return 'races'
    if fichier == 'Mode hyper et co':
        return 'annexes'
    if fichier == 'Magie Maverick V8':
        return 'magies' if type_ == 'magies' else 'annexes'
    if fichier == 'Ressources et Craft':
        if slug in EQUIPEMENT:
            return 'equipement'
        if slug in CRAFT:
            return 'craft'
    raise ValueError(f'origine inconnue : {type_}/{slug} {sources}')


def lire_pages_md(wiki=None):
    pages = []
    wiki = wiki or WIKI
    for type_ in sorted(os.listdir(wiki)):
        for nom in sorted(os.listdir(os.path.join(wiki, type_))):
            if not nom.endswith('.md'):
                continue
            with open(os.path.join(wiki, type_, nom), encoding='utf-8', newline='') as f:
                brut = f.read()
            data, corps_fichier = parse_frontmatter(brut)
            if not corps_fichier.startswith('\n'):
                raise ValueError(f"{type_}/{nom} : pas de ligne vide après l'en-tête")
            slug = nom[:-3]
            statut = data.get('status', 'draft')
            if statut not in STATUTS:
                raise ValueError(f'{type_}/{slug} : statut {statut!r}')
            sources = data.get('sources', [])
            extras = {k: v for k, v in data.items() if k not in CLES}
            libelles = [s for s in sources if not s.startswith('http')]
            pages.append(dict(
                id=f'{type_}/{slug}', type=type_, slug=slug, titre=str(data['title']), resume=data.get('summary'),
                corps_md=corps_fichier[1:], statut=statut, origine=origine_migration(type_, slug, statut, sources),
                source_ref=libelles[0] if libelles else None, donnees=extras or None,
                aliases=data.get('aliases', []), tags=data.get('tags', []), sources=sources, brut=brut))
    return pages


def types_du_site(types_mjs=None):
    r = subprocess.run(['node', '--no-warnings', '-e',
                        f"import('{types_mjs or TYPES_MJS}').then(m => console.log(JSON.stringify(Object.entries(m.TYPES))))"],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def pages_differentes(rows, wiki):
    """Information (ne modifie rien) : ids des pages de `wiki` dont le contenu (titre, résumé, corps, statut, champs structurés, alias, mots-clés, sources)
    diffère de `data/rows`, et ids présents d'un seul côté. Fonctionne pour TOUTES les familles (portées ou non) : sert à mesurer la péremption de la référence
    dorée par rapport au dépôt d'aujourd'hui (design.md §9, revue M3). -> (differentes, seulement_md, seulement_base)"""
    db = T.reconstruire(':memory:', rows)
    base = {r[0]: r[1:] for r in db.execute('SELECT id, titre, resume, corps_md, statut, donnees FROM page')}
    liens = {}
    for table, col in (('alias', 'texte'), ('page_tag', 'libelle')):
        for pid, v in db.execute(f'SELECT page_id, {col} FROM {table} ORDER BY page_id, ordre'):
            liens.setdefault((table, pid), []).append(v)
    for pid, texte in db.execute('SELECT ps.page_id, s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id ORDER BY ps.page_id, ps.ordre'):
        liens.setdefault(('source', pid), []).append(texte)
    md = {p['id']: p for p in lire_pages_md(wiki)}
    diff = []
    for pid in sorted(set(md) & set(base)):
        p = md[pid]
        donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
        if (p['titre'], p['resume'], p['corps_md'], p['statut'], donnees) != base[pid] \
           or [p['aliases'], p['tags'], p['sources']] != [liens.get((t, pid), []) for t in ('alias', 'page_tag', 'source')]:
            diff.append(pid)
    return diff, sorted(set(md) - set(base)), sorted(set(base) - set(md))


def rafraichir_pages(rows, wiki=None):
    """Remet à jour dans `data/rows` le CONTENU des pages (titre, résumé, corps, statut, champs structurés, alias, mots-clés, sources) qui ont changé dans les .md,
    pour TOUTES les familles. Les lignes typées qui se rattachent à une page (`page_entite`, capacités, sorts…) ne sont pas touchées : l'identifiant d'une page ne
    change jamais ici. Refuse ce qui demande l'importeur d'une famille : une page ajoutée ou retirée, ou une page dont la provenance (famille) a changé.
    -> ids des pages mises à jour (liste vide : rien à faire, aucun fichier réécrit)."""
    db = T.reconstruire(':memory:', rows)
    md = {p['id']: p for p in lire_pages_md(wiki)}
    base = dict(db.execute('SELECT id, origine FROM page'))
    seulement_md, seulement_base = sorted(set(md) - set(base)), sorted(set(base) - set(md))
    if seulement_md or seulement_base:
        raise RuntimeError(f"pages ajoutées ({seulement_md[:10]}) ou retirées ({seulement_base[:10]}) : elles passent par l'importeur de leur famille, pas par pages_md.py sync")
    changees, _, _ = pages_differentes(rows, wiki or WIKI)
    for pid in changees:
        if md[pid]['origine'] != base[pid]:
            raise RuntimeError(f"{pid} : sa provenance (sources:) la rattache à la famille {md[pid]['origine']!r}, la base dit {base[pid]!r} : importeur de famille requis")
    if not changees:
        return []
    db.execute('BEGIN')
    db.execute('PRAGMA defer_foreign_keys = ON')
    for pid in changees:
        p = md[pid]
        if not p['corps_md'].endswith('\n'):
            db.execute('ROLLBACK')
            raise ValueError(f"{pid} : le corps doit finir par un retour à la ligne")
        donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
        db.execute('UPDATE page SET titre = ?, titre_cle = ?, resume = ?, donnees = ?, corps_md = ?, statut = ?, source_ref = ? WHERE id = ?',
                   (p['titre'], T.normalize(p['titre']), p.get('resume'), donnees, p['corps_md'], p['statut'], p.get('source_ref'), pid))
        for table in ('alias', 'page_tag', 'page_source'):
            db.execute(f'DELETE FROM {table} WHERE page_id = ?', (pid,))
        for i, texte in enumerate(p.get('aliases', [])):
            db.execute('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?,?,?,?)', (pid, i, texte, T.normalize(texte)))
        for i, libelle in enumerate(p.get('tags', [])):
            db.execute('INSERT INTO page_tag (page_id, ordre, tag_id, libelle) VALUES (?,?,?,?)', (pid, i, T.normalize(libelle), libelle))
        for i, texte in enumerate(p.get('sources', [])):
            s = T.decouper_source(texte)
            db.execute('INSERT OR IGNORE INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) '
                       'VALUES (:id,:nature,:texte,:url,:genre,:google_id,:fichier,:onglets)', s)
            if db.execute('SELECT texte FROM source WHERE id = ?', (s['id'],)).fetchone()[0] != texte:
                db.execute('ROLLBACK')
                raise ValueError(f"collision d'id de source : {s['id']} pour {texte!r}")
            db.execute('INSERT INTO page_source (page_id, ordre, source_id) VALUES (?,?,?)', (pid, i, s['id']))
    db.execute('DELETE FROM source WHERE id NOT IN (SELECT source_id FROM page_source)')
    violations, _ = T.controle_references(db, T.lire_heritage(os.path.join(rows, '..', 'heritage.json')))
    if violations:
        db.execute('ROLLBACK')
        raise RuntimeError(f'références rompues après la mise à jour des pages : {violations[:10]}')
    db.execute('COMMIT')
    T.exporter(db, rows)
    return changees


def main(argv):
    if not argv or argv[0] not in ('check', 'sync'):
        sys.exit('usage : pages_md.py check|sync [--rows data/rows] [--wiki <dossier>]')
    option = lambda nom, defaut: argv[argv.index(nom) + 1] if nom in argv else defaut  # noqa: E731
    rows = os.path.abspath(option('--rows', ROWS))
    wiki = option('--wiki', None)
    if argv[0] == 'check':
        differentes, seulement_md, seulement_base = pages_differentes(rows, wiki or WIKI)
        if not (differentes or seulement_md or seulement_base):
            print('data/rows est à jour : les pages sont celles des .md')
            return 0
        print(f"data/rows n'est PAS à jour : {len(differentes)} page(s) différente(s) des .md, {len(seulement_md)} seulement en .md, {len(seulement_base)} seulement en base")
        for pid in (differentes + seulement_md + seulement_base)[:30]:
            print('   ', pid)
        print('-> npm run db:sync-pages (puis commiter data/rows) ; une page ajoutée ou retirée passe par l\'importeur de sa famille')
        return 1
    try:
        changees = rafraichir_pages(rows, wiki)
    except (RuntimeError, ValueError) as e:
        print(f'refusé : {e}')
        return 1
    print(f'{len(changees)} page(s) mise(s) à jour dans data/rows' if changees else 'data/rows était déjà à jour')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
