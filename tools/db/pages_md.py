"""Pages Markdown <-> data/rows (docs/sql/conception.md §9).

Lit client/src/content/wiki/<type>/<slug>.md avec le sous-ensemble STRICT de YAML que les importeurs écrivent (toute autre forme arrête le chargement),
déduit la famille d'import d'une page de sa PROVENANCE déclarée (`sources:`, jamais du contenu).

    python3 -I tools/db/pages_md.py check [--rows data/rows | --base <fichier.db>] [--wiki <dossier>]   les pages de la base sont-elles celles des .md ?  (code 1 sinon)
    python3 -I tools/db/pages_md.py sync  --base <travail.db> [--wiki <dossier>]   remet à jour une BASE DE TRAVAIL depuis les .md (elle seule est écrite)
    python3 -I tools/db/pages_md.py sync  --rows <copie de lignes> [--wiki <dossier>]   de même dans une copie de lignes (tests) ; jamais data/rows

Les .md de client/src/content/wiki/ sont un PRODUIT du build (fabriqués par `npm run db:export-pages`, ignorés par git). Lot 12 du chantier « base de dev = source
de vérité » (R274, R278) : `sync` n'écrit plus data/rows (copie du site de dev, écrite par le workflow seul : contrôle `controle-du-contenu-ecrit`). Il écrit une
base de travail, copie préparée de l'extrait du site de dev, dont `client/scripts/lot-de-source.mjs` tire un lot de nature `source` à PROPOSER au site de dev ;
`npm run db:sync-pages` (client/scripts/db-sync-pages.mjs) enchaîne les deux. Les pages d'exemple des .md ne comptent pas face à une base qui n'en a aucune (le site
de dev n'en a pas). Une page ajoutée ou retirée n'est gérée ici que pour les familles `docs` et `exemple` ; sinon c'est l'importeur de la famille.
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
# Pages créées depuis le site de dev (client/serveur/edition.mjs#creerPage, FAMILLE_DES_PAGES_DU_SITE) : provenance « Site de dev › édition du AAAA-MM-JJ »,
# famille des pages de leur type. Une page des Règles (guide/…) créée sur le site entre en famille `docs`, sans source Google Doc : pas de nouvelle
# famille (la provenance sera retirée à la 1.0).
SITE_DE_DEV = 'Site de dev › '
FAMILLE_DES_PAGES_DU_SITE = {'metiers': 'docs', 'races': 'races', 'classes': 'classes', 'capacites': 'classes', 'guide': 'docs'}
# Pages créées par une migration depuis le classeur de la mise à jour de Décembre (pièce jointe, pas un Google Sheet : migration 0119, Boxeur,
# Porte-étendard, Écrasant du Cuirassé) : provenance « Classeur « Nouveauté mise à jour Décembre », onglet « … » », famille des pages de leur type.
CLASSEUR_DE_DECEMBRE = 'Classeur « Nouveauté mise à jour Décembre »'
FAMILLE_DES_PAGES_DE_DECEMBRE = {'classes': 'classes', 'capacites': 'classes'}
# Pages créées par une migration de la mise à jour de Décembre (0120 : les races Fongoïde et Gémidien, décision R239), tirées de la pièce jointe du
# propriétaire : provenance « Nouveauté mise à jour Décembre, onglet « … » », famille des pages de leur type, comme une page créée sur le site.
MISE_A_JOUR_DE_DECEMBRE = 'Nouveauté mise à jour Décembre, '


def origine_migration(type_, slug, statut, sources):
    """Famille d'importeur d'une page existante, déduite de sa PROVENANCE déclarée (jamais du contenu)."""
    if statut == 'example':
        return 'exemple'
    libelles = [s for s in sources if not s.startswith('http')]
    premier = libelles[0] if libelles else ''
    fichier = (T.decouper_source(premier)['fichier'] if premier else None) or ''
    if premier.startswith((SITE_DE_DEV, MISE_A_JOUR_DE_DECEMBRE)) and type_ in FAMILLE_DES_PAGES_DU_SITE:
        return FAMILLE_DES_PAGES_DU_SITE[type_]
    if premier.startswith('Google Doc'):
        return 'docs'
    if premier.startswith(CLASSEUR_DE_DECEMBRE) and type_ in FAMILLE_DES_PAGES_DE_DECEMBRE:
        return FAMILLE_DES_PAGES_DE_DECEMBRE[type_]
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


def pages_du_wiki(db, wiki=None):
    """Les pages des .md de `wiki`, par id, comparables à la base `db` : sans les pages d'exemple quand la base n'en a aucune (une base de travail tirée de
    l'extrait du site de dev, qui n'en a pas ; les .md fabriqués les portent)."""
    pages = lire_pages_md(wiki)
    if not db.execute("SELECT 1 FROM page WHERE statut = 'example' LIMIT 1").fetchone():
        pages = [p for p in pages if p['statut'] != 'example']
    return {p['id']: p for p in pages}


def ouvrir_base(chemin, ecriture=False):
    """Une base SQLite déjà construite (base de travail, contenu fourni préparé), à la version du schéma ; en lecture seule sauf `ecriture`."""
    if not os.path.isfile(chemin):
        raise RuntimeError(f'{chemin} : base introuvable')
    import sqlite3
    uri = 'file:%s%s' % (chemin.replace('?', '%3f').replace('#', '%23'), '' if ecriture else '?mode=ro')
    db = sqlite3.connect(uri, uri=True, isolation_level=None)
    db.execute('PRAGMA foreign_keys = ON')
    v = db.execute('PRAGMA user_version').fetchone()[0]
    if v != T.version_schema():
        db.close()
        raise RuntimeError(f'{chemin} : structure {v}, schéma {T.version_schema()} (préparer la copie : client/scripts/db-preparer-contenu.mjs)')
    return db


def pages_differentes(rows, wiki, db=None):
    """Information (ne modifie rien) : ids des pages de `wiki` dont le contenu (titre, résumé, corps, statut, champs structurés, alias, mots-clés, sources)
    diffère de `data/rows` (ou de la base `db` quand elle est donnée), et ids présents d'un seul côté. Fonctionne pour TOUTES les familles (portées ou non) :
    sert à mesurer la péremption de la référence dorée par rapport au dépôt d'aujourd'hui (design.md §9, revue M3). -> (differentes, seulement_md, seulement_base)"""
    db = db or T.reconstruire(':memory:', rows)
    base = {r[0]: r[1:] for r in db.execute('SELECT id, titre, resume, corps_md, statut, donnees FROM page')}
    liens = {}
    for pid, v in db.execute('SELECT page_id, texte FROM alias ORDER BY page_id, ordre'):
        liens.setdefault(('alias', pid), []).append(v)
    # un mot-clé se compare par le mot-clé qu'il désigne : son écriture vit dans le vocabulaire (mot_cle, migration 0043), elle se change sur /recherche/
    # du site de dev ; une écriture inconnue du vocabulaire ne compte pas (un import n'en crée pas : migration 0056 ; sync la signale)
    for pid, v in db.execute('SELECT page_id, tag_id FROM page_tag ORDER BY page_id, ordre'):
        liens.setdefault(('page_tag', pid), []).append(v)
    for pid, texte in db.execute('SELECT ps.page_id, s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id ORDER BY ps.page_id, ps.ordre'):
        liens.setdefault(('source', pid), []).append(texte)
    md = pages_du_wiki(db, wiki)
    diff = []
    for pid in sorted(set(md) & set(base)):
        p = md[pid]
        donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
        if (p['titre'], p['resume'], p['corps_md'], p['statut'], donnees) != base[pid] \
           or [p['aliases'], [i for _, i in T.mots_cles_poses(db, p['tags'])[0]], p['sources']] != [liens.get((t, pid), []) for t in ('alias', 'page_tag', 'source')]:
            diff.append(pid)
    return diff, sorted(set(md) - set(base)), sorted(set(base) - set(md))


# Familles dont les pages n'ont pas d'importeur typé : leur texte est la source, on peut les ajouter et les retirer à la main (puis `npm run db:sync-pages`).
FAMILLES_SANS_IMPORTEUR = {'docs', 'exemple'}


def rafraichir_pages(rows, wiki=None, mots_cles_ignores=None, db=None):
    """Remet à jour dans une copie de lignes `rows` (ou dans la base de travail `db`, ouverte en écriture, quand elle est donnée : rien n'est alors exporté) le CONTENU des pages (titre, résumé, corps, statut, champs structurés, alias, mots-clés, sources) qui ont changé dans les .md,
    pour TOUTES les familles. Les lignes typées qui se rattachent à une page (`page_entite`, capacités, sorts…) ne sont pas touchées : l'identifiant d'une page ne
    change jamais ici. Un mot-clé de `tags:` absent du vocabulaire, ou ambigu (homonymes, migration 0113 : écrire la clé), n'est pas posé (un import n'en crée pas : migration 0056) : (page, écriture), pour
    toutes les pages des .md, va dans la liste `mots_cles_ignores` si elle est donnée (main les signale). Une page peut être AJOUTÉE ou RETIRÉE seulement si elle est de la famille `docs` ou `exemple` (pas d'importeur typé : leur texte est la source) ;
    pour toute autre famille, c'est l'importeur de la famille qui crée ou retire ses pages. Refuse aussi une page dont la provenance (famille) a changé.
    -> ids des pages mises à jour, ajoutées ou retirées (liste vide : rien à faire, aucun fichier réécrit)."""
    exporter = db is None
    db = db or T.reconstruire(':memory:', rows)
    md = pages_du_wiki(db, wiki)
    if mots_cles_ignores is not None:
        # toutes les pages, changées ou non : une écriture inconnue ne change rien à data/rows (pages_differentes ne la compte pas), elle se signale
        for pid in sorted(md):
            _, inconnues, ambigues = T.mots_cles_poses(db, md[pid]['tags'])
            mots_cles_ignores.extend((pid, libelle) for libelle in inconnues + [e for e, _ in ambigues])
    base = dict(db.execute('SELECT id, origine FROM page'))
    ajoutees, retirees = sorted(set(md) - set(base)), sorted(set(base) - set(md))
    interdites = [pid for pid in ajoutees if md[pid]['origine'] not in FAMILLES_SANS_IMPORTEUR] + [pid for pid in retirees if base[pid] not in FAMILLES_SANS_IMPORTEUR]
    if interdites:
        raise RuntimeError(f"pages ajoutées ou retirées hors des familles {sorted(FAMILLES_SANS_IMPORTEUR)} ({interdites[:10]}) : elles passent par l'importeur de leur famille, pas par pages_md.py sync")
    changees, _, _ = pages_differentes(rows, wiki or WIKI, db)
    for pid in changees:
        if md[pid]['origine'] != base[pid]:
            raise RuntimeError(f"{pid} : sa provenance (sources:) la rattache à la famille {md[pid]['origine']!r}, la base dit {base[pid]!r} : importeur de famille requis")
    if not changees and not ajoutees and not retirees:
        return []
    db.execute('BEGIN')
    db.execute('PRAGMA defer_foreign_keys = ON')
    for pid in retirees:
        for table in ('alias', 'page_tag', 'page_source', 'page_entite'):
            db.execute(f'DELETE FROM {table} WHERE page_id = ?', (pid,))
        db.execute('DELETE FROM page WHERE id = ?', (pid,))
    for pid in ajoutees:
        p = md[pid]
        donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
        db.execute('INSERT INTO page (id, type, slug, titre, titre_cle, resume, donnees, corps_md, statut, source_ref, origine) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                   (pid, p['type'], p['slug'], p['titre'], T.normalize(p['titre']), p.get('resume'), donnees, p['corps_md'], p['statut'], p.get('source_ref'), p['origine']))
    for pid in changees + ajoutees:
        p = md[pid]
        if not p['corps_md'].endswith('\n'):
            db.execute('ROLLBACK')
            raise ValueError(f"{pid} : le corps doit finir par un retour à la ligne")
        if pid in changees:
            donnees = json.dumps(p['donnees'], ensure_ascii=False) if p.get('donnees') else None
            db.execute('UPDATE page SET titre = ?, titre_cle = ?, resume = ?, donnees = ?, corps_md = ?, statut = ?, source_ref = ? WHERE id = ?',
                       (p['titre'], T.normalize(p['titre']), p.get('resume'), donnees, p['corps_md'], p['statut'], p.get('source_ref'), pid))
        for table in ('alias', 'page_tag', 'page_source'):
            db.execute(f'DELETE FROM {table} WHERE page_id = ?', (pid,))
        for i, texte in enumerate(p.get('aliases', [])):
            db.execute('INSERT INTO alias (page_id, ordre, texte, cle) VALUES (?,?,?,?)', (pid, i, texte, T.normalize(texte)))
        T.poser_les_mots_cles(db, pid, p.get('tags', []))
        for i, texte in enumerate(p.get('sources', [])):
            s = T.decouper_source(texte)
            db.execute('INSERT OR IGNORE INTO source (id, nature, texte, url, genre, google_id, fichier, onglets) '
                       'VALUES (:id,:nature,:texte,:url,:genre,:google_id,:fichier,:onglets)', s)
            if db.execute('SELECT texte FROM source WHERE id = ?', (s['id'],)).fetchone()[0] != texte:
                db.execute('ROLLBACK')
                raise ValueError(f"collision d'id de source : {s['id']} pour {texte!r}")
            db.execute('INSERT INTO page_source (page_id, ordre, source_id) VALUES (?,?,?)', (pid, i, s['id']))
    db.execute('DELETE FROM source WHERE id NOT IN (SELECT source_id FROM page_source)')
    heritage = os.path.join(rows, '..', 'heritage.json') if exporter else os.path.join(RACINE, 'data', 'heritage.json')
    violations, _ = T.controle_references(db, T.lire_heritage(heritage))
    if violations:
        db.execute('ROLLBACK')
        raise RuntimeError(f'références rompues après la mise à jour des pages : {violations[:10]}')
    db.execute('COMMIT')
    if exporter:
        T.exporter(db, rows)
    return changees + ajoutees + retirees


def meme_fichier(a, b):
    """Vrai si les deux chemins désignent le même fichier ou dossier (liens résolus)."""
    return os.path.realpath(a) == os.path.realpath(b)


USAGE = 'usage : pages_md.py check [--rows data/rows | --base <fichier.db>] [--wiki <dossier>] | sync (--base <travail.db> | --rows <copie>) [--wiki <dossier>]'
EXTRAIT_DU_JOUR = os.path.join(RACINE, 'var', 'extrait', 'maverick-dev.db')


def main(argv):
    if not argv or argv[0] not in ('check', 'sync'):
        sys.exit(USAGE)
    option = lambda nom, defaut: argv[argv.index(nom) + 1] if nom in argv else defaut  # noqa: E731
    if '--rows' in argv and '--base' in argv:
        sys.exit(USAGE)
    fichier = option('--base', None)
    fichier = os.path.abspath(fichier) if fichier else None
    rows = os.path.abspath(option('--rows', ROWS))
    wiki = option('--wiki', None)
    nom = fichier or 'data/rows' if (fichier or meme_fichier(rows, ROWS)) else rows
    if argv[0] == 'check':
        try:
            db = ouvrir_base(fichier) if fichier else None
        except RuntimeError as e:
            print(f'refusé : {e}')
            return 1
        differentes, seulement_md, seulement_base = pages_differentes(rows, wiki or WIKI, db)
        if not (differentes or seulement_md or seulement_base):
            print(f'{nom} est à jour : les pages sont celles des .md')
            return 0
        print(f"{nom} n'est PAS à jour : {len(differentes)} page(s) différente(s) des .md, {len(seulement_md)} seulement en .md, {len(seulement_base)} seulement en base")
        for pid in (differentes + seulement_md + seulement_base)[:30]:
            print('   ', pid)
        print('-> npm run db:sync-pages -- --lot <lot.json> --titre <titre> (un lot `source` à proposer au site de dev) ; une page ajoutée ou retirée passe par l\'importeur de sa famille')
        return 1
    # sync : jamais data/rows (lot 12) ; ni l'extrait du jour ni le contenu fourni eux-mêmes : une COPIE préparée
    if not fichier and '--rows' not in argv or not fichier and meme_fichier(rows, ROWS):
        print('refusé : sync n\'écrit plus data/rows (copie du site de dev, écrite par le workflow seul) : npm run db:sync-pages -- --lot <lot.json> --titre <titre> '
              '(une base de travail tirée de l\'extrait, puis un lot `source` à proposer au site de dev) ; ou --base <copie.db> / --rows <copie de lignes>')
        return 1
    fournis = [c for c in (EXTRAIT_DU_JOUR, os.environ.get('MAVERICK_CONTENU', '').strip()) if c]
    if fichier and any(os.path.exists(c) and meme_fichier(fichier, c) for c in fournis):
        print(f'refusé : {fichier} est l\'extrait ou le contenu fourni lui-même : travailler sur une copie préparée (client/scripts/db-sync-pages.mjs)')
        return 1
    ignores = []
    try:
        db = ouvrir_base(fichier, ecriture=True) if fichier else None
        try:
            changees = rafraichir_pages(rows, wiki, ignores, db)
        finally:
            if db:
                db.close()
    except (RuntimeError, ValueError) as e:
        print(f'refusé : {e}')
        return 1
    print(f'{len(changees)} page(s) mise(s) à jour (modifiées, ajoutées ou retirées) dans {nom}' if changees else f'{nom} était déjà à jour')
    if ignores:
        print(T.signaler_mots_cles_ignores(ignores))
    return 0


if __name__ == '__main__':
    if sys.platform == "win32":  # sortie lue en UTF-8 par les outils Node (-I ignore PYTHONUTF8)
        for flux in (sys.stdout, sys.stderr):
            flux.reconfigure(encoding="utf-8", newline="\n")
    sys.exit(main(sys.argv[1:]))
