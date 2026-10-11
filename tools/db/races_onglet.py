#!/usr/bin/env python3
"""Contenu de l'onglet de chaque race (classeur « Les races ») : des pages de races vers les tables typées (migration 0007-races-onglet).

    python3 -I tools/db/races_onglet.py --ecrire [--schema-ancien <fichier>]   # (ré)écrit data/migrations/0007-races-onglet.sql depuis les pages de data/rows
    python3 -I tools/db/races_onglet.py --verifier [--rows <dossier>]   # data/rows (déjà migré ; ou une copie) contient exactement ce que l'extraction donne : code 1 sinon

Bibliothèque standard uniquement. Les onglets de race n'ont été lus que par tools/sheets/races.py, qui en a écrit les pages `races/<slug>` (corps_md,
corrigé depuis par les migrations 0005 et 0006) ; aucun dump n'est dans le dépôt. Ce script relit donc ces pages, section par section, et en tire les valeurs de
l'onglet (décision R13 du propriétaire : l'onglet est la source, la fiche V15.2.2 n'en est qu'un dérivé fait à la main, pas toujours à jour) :

  race_onglet               une ligne par race : description générale, histoire, description, valeurs de départ, avantages, inconvénients, don de base,
                            en-têtes du tableau des ethnies, titre du tableau en panneaux ;
  race_don                  dons raciaux : une ligne par ethnie du tableau de l'onglet, ou le don unique de la race (Elfe doré, Majin, Hujin, Lamia, Mort-vivant) ;
  race_don_tableau_*        le tableau en panneaux (Drakos : magie innée -> AP/AM, compétence, résistance ; Mort-vivant : raison de la mort -> don), cellule par cellule ;
  race_magie_onglet         magies innées que l'onglet limite explicitement (« en inné uniquement » : le Nain, décision R11) ;
  mode_hyper_effet          version 'onglet_race' : la capacité Mode Hyper de l'onglet, avec son nom (nouvelle colonne `nom`).

Rien n'est interprété : un texte est celui de la page, échappements Markdown retirés (paragraphes séparés par une ligne vide, retours à la ligne et
puces « - » conservés) ; un nombre n'est typé que s'il est écrit en chiffres. PREUVE DE FIDÉLITÉ : chaque section lue est RÉÉCRITE avec les fonctions
mêmes qui l'ont écrite (tools/sheets/races.py : md_text, labeled, render_ethnies…) et doit redonner la page caractère pour caractère ; sinon le script
s'arrête sans rien écrire. Les sections tirées de la fiche (AP, AM, « Divers », restrictions, sous-races, matrices, écarts) ne sont pas relues : leurs
valeurs sont déjà dans les tables race, ethnie, race_classe, race_magie.

Une race créée depuis le site de dev (provenance « Site de dev › … », que seul le service écrit : client/serveur/edition.mjs#provenance) n'a pas d'onglet
dans le classeur : ni source « onglet » dans ses sources, ni rang dans l'index, ni capacité Mode Hyper. Elle n'est ni extraite ni comparée ici ; son corps
est le rendu de ses seules tables (client/src/lib/corps-races.mjs#corpsDeRaceCreee), contrôlé par client/test/serveur-edition-corps.test.mjs. Les races
importées restent contrôlées en entier, et une race du classeur ne peut pas passer pour créée : sa provenance n'est pas modifiable depuis le site.
"""
import importlib.util
import os
import re
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import maverick as T  # noqa: E402

RACINE = os.path.abspath(os.path.join(HERE, '..', '..'))
ROWS = os.path.join(RACINE, 'data', 'rows')
MIGRATION = os.path.join(RACINE, 'data', 'migrations', '0007-races-onglet.sql')

_spec = importlib.util.spec_from_file_location('races_importeur', os.path.join(RACINE, 'tools', 'sheets', 'races.py'))
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)

CLASSEUR = 'Les races'
ORIGINE = 'races'
PROVENANCE_DU_SITE = 'Site de dev › '   # race.source_ref d'une race créée depuis le site de dev (voir l'en-tête)
STAT_LABELS = R.STAT_LABELS            # Santé de départ, Chakra de départ, Barrière bonus, Vitesse Sol/Nage
FICHE_LABEL = 'Fiche de personnage V15.2.2'
# Notes de cellule de l'onglet (les seules : tools/sheets/races.py, « NOTES DE CELLULE ») : ethnie -> cellule. Les trois dons du Médusain, dans l'ordre
# des lignes de l'onglet (O30, O34, O38).
CELLULES_NOTES = {
    ('races/medusain', 'Eau en innée'): 'O30',
    ('races/medusain', 'Foudre en innée'): 'O34',
    ('races/medusain', 'Lumière en innée'): 'O38',
}


class Arret(Exception):
    """La page ne se lit pas comme l'importeur l'a écrite : rien n'est écrit."""


# --------------------------------------------------------------------------------------------------------------------
# Markdown de l'importeur -> texte (inverse de esc_inline, md_text, cell_md)
# --------------------------------------------------------------------------------------------------------------------
def unesc(s):
    """Inverse de races.esc_inline : `\\x` -> x, `<url>` -> url. Un « < » non échappé ne peut être qu'un lien automatique."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            out.append(s[i + 1])
            i += 2
        elif c == '<':
            m = re.match(r'<(https?://[^\s<>]+)>', s[i:])
            if not m:
                raise Arret('« < » non échappé hors d\'une adresse : %r' % s)
            out.append(m.group(1))
            i += m.end()
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def texte_md(lignes):
    """Lignes écrites par races.md_text -> texte (blocs séparés par une ligne vide ; dans un paragraphe, une ligne par retour à la ligne)."""
    blocs, courant = [], []
    for ligne in lignes + ['']:
        if ligne == '':
            if courant:
                blocs.append(courant)
            courant = []
        else:
            courant.append(ligne)
    out = []
    for bloc in blocs:
        if all(l.startswith('- ') for l in bloc):
            out.append('\n'.join('- ' + unesc(l[2:]) for l in bloc))
        else:
            out.append('\n'.join(unesc(l[:-2] if l.endswith('  ') else l) for l in bloc))
    texte = '\n\n'.join(out)
    if R.md_text(texte) != lignes:
        raise Arret('texte non réversible : %r' % lignes[:3])
    return texte


def cellule_md(cellule):
    """Cellule écrite par races.cell_md -> texte (« <br> » = retour à la ligne)."""
    texte = '\n'.join(unesc(p) for p in cellule.replace('\\|', '\x00').split('<br>')).replace('\x00', '|')
    if R.cell_md(texte) != cellule:
        raise Arret('cellule non réversible : %r' % cellule)
    return texte


def ligne_tableau(ligne):
    if not (ligne.startswith('| ') and ligne.endswith(' |')):
        raise Arret('ligne de tableau attendue : %r' % ligne)
    return [c.strip() for c in re.split(r'(?<!\\)\|', ligne[2:-2])]


def sans_bords(lignes):
    while lignes and lignes[0] == '':
        lignes = lignes[1:]
    while lignes and lignes[-1] == '':
        lignes = lignes[:-1]
    return lignes


def sections(corps):
    """corps_md -> {titre de section (##): lignes}, dans l'ordre."""
    out, cur = {}, None
    for ligne in corps.split('\n'):
        if ligne.startswith('## '):
            cur = ligne[3:]
            if cur in out:
                raise Arret('section en double : %s' % cur)
            out[cur] = []
        elif cur is not None:
            out[cur].append(ligne)
    return {k: sans_bords(v) for k, v in out.items()}


ETIQUETTE_RE = re.compile(r'^\*\*((?:\\.|[^*\\])+)\*\*(?: : (.*))?$')


def morceaux_etiquetes(lignes):
    """Lignes « **Libellé** : texte » ou « **Libellé** » + texte (races.labeled) -> [(libellé, lignes de texte)]."""
    morceaux = []
    for ligne in lignes:
        if ETIQUETTE_RE.match(ligne):
            morceaux.append([ligne])
        elif morceaux:
            morceaux[-1].append(ligne)
        elif ligne:
            raise Arret('texte hors d\'un libellé : %r' % ligne)
    res = []
    for morceau in morceaux:
        morceau = sans_bords(morceau)
        m = ETIQUETTE_RE.match(morceau[0])
        libelle = unesc(m.group(1))
        if m.group(2) is not None:                       # « **Libellé** : texte d'une ligne »
            if len(morceau) != 1:
                raise Arret('libellé sur une ligne suivi de texte : %r' % morceau[:3])
            texte = unesc(m.group(2))
        else:                                            # « **Libellé** », ligne vide, puis paragraphes ou liste
            if len(morceau) < 3 or morceau[1] != '':
                raise Arret('libellé sans texte : %r' % morceau[:3])
            texte = texte_md(morceau[2:])
        if R.labeled(libelle, texte) != morceau:
            raise Arret('« %s » ne se réécrit pas à l\'identique' % libelle)
        res.append((libelle, texte))
    return res


def bloc_etiquete(lignes, libelle):
    morceaux = morceaux_etiquetes(lignes)
    if [m[0] for m in morceaux] != [libelle]:
        raise Arret('attendu « %s » seul, trouvé %s' % (libelle, [m[0] for m in morceaux]))
    return morceaux[0][1]


# --------------------------------------------------------------------------------------------------------------------
# Une page de race -> valeurs de l'onglet
# --------------------------------------------------------------------------------------------------------------------
def lire_ethnies(lignes, onglet):
    """Section « Ethnies et dons raciaux » -> (rubriques, dons, tableau). Les quatre formes de races.render_ethnies."""
    i = 0
    rubriques, dons, tableau = None, [], None

    def suivante():
        nonlocal i
        while i < len(lignes) and lignes[i] == '':
            i += 1
        return lignes[i] if i < len(lignes) else None

    def bloc_jusqua(predicat):
        nonlocal i
        debut = i
        while i < len(lignes) and not predicat(lignes[i]):
            i += 1
        return sans_bords(lignes[debut:i])

    def fiche(texte):
        if texte == 'aucune sous-race correspondante.':
            return None
        m = re.fullmatch(r'sous-race « (.+) » \(voir « %s »\)\.' % re.escape(R.SEC_SOUS), texte)
        if not m:
            raise Arret('renvoi à la fiche illisible : %r' % texte)
        return m.group(1)

    ligne = suivante()
    if ligne is not None and ligne.startswith('Rubriques de l'):
        m = re.fullmatch(r"Rubriques de l'onglet « (.+) » : (.+)\.", unesc(ligne))
        if not m or m.group(1) != onglet:
            raise Arret('rubriques illisibles : %r' % ligne)
        tetes = re.findall(r'« ([^»]+) »', m.group(2))
        if len(tetes) not in (2, 3) or tetes[0] not in R.ETHNIE_HEADERS:
            raise Arret('rubriques inattendues : %r' % tetes)
        rubriques = (tetes[0], tetes[1] if len(tetes) == 3 else None, tetes[-1])
        i += 1
        m = re.fullmatch(r'Nombre : (\d+)\.', suivante() or '')
        if not m:
            raise Arret('« Nombre : » attendu après les rubriques')
        attendu = int(m.group(1))
        i += 1
        for _ in range(attendu):
            ligne = suivante()
            if ligne is None or not ligne.startswith('### '):
                raise Arret('ethnie attendue : %r' % ligne)
            etiquette = unesc(ligne[4:])
            i += 1
            corps = bloc_jusqua(lambda l: l.startswith('### ') or l.startswith('Tableau de l'))
            don = {'forme': 'ethnie', 'etiquette': etiquette, 'nom': None, 'texte': None, 'notes': {}, 'fiche': None}
            vus = []
            for libelle, texte in morceaux_etiquetes(corps):
                vus.append(libelle)
                note = re.fullmatch(r'Note de la cellule « (.+) »', libelle)
                if note:
                    col = {rubriques[0]: 'etiquette', rubriques[1]: 'nom', rubriques[2]: 'texte'}.get(note.group(1))
                    if col is None:
                        raise Arret('note sur une colonne inconnue : %r' % libelle)
                    don['notes'][col] = texte
                elif libelle == rubriques[1]:
                    don['nom'] = texte
                elif libelle == rubriques[2]:
                    don['texte'] = texte
                elif libelle == FICHE_LABEL:
                    don['fiche'] = fiche(texte)
                    don['fiche_lue'] = True
                else:
                    raise Arret('libellé inattendu dans l\'ethnie %r : %r' % (etiquette, libelle))
            if don['texte'] is None or not don.get('fiche_lue'):
                raise Arret('ethnie %r incomplète : %s' % (etiquette, vus))
            dons.append(don)
    ligne = suivante()
    tableau_titre = None
    if ligne is not None and ligne.startswith('### '):
        nom = unesc(ligne[4:])
        i += 1
        if (suivante() or '').startswith('Nombre : '):
            tableau_titre = nom                                  # tableau en panneaux titré par le nom du don (Drakos)
        else:
            corps = bloc_jusqua(lambda l: l.startswith('**%s**' % FICHE_LABEL))
            texte = texte_md(corps)
            ref = lignes[i] if i < len(lignes) else ''
            m = re.fullmatch(r'\*\*%s\*\* : (.+)' % re.escape(FICHE_LABEL), ref)
            if not m:
                raise Arret('renvoi à la fiche attendu après le don unique %r' % nom)
            dons.append({'forme': 'unique', 'etiquette': None, 'nom': nom, 'texte': texte, 'notes': {}, 'fiche': fiche(unesc(m.group(1)))})
            i += 1
    ligne = suivante()
    if ligne is not None and ligne.startswith('Tableau de l'):
        if ligne != R.esc_inline("Tableau de l'onglet « %s » :" % onglet):
            raise Arret('titre de tableau inattendu : %r' % ligne)
        i += 1
        ligne = suivante()
    if ligne is not None:
        m = re.fullmatch(r'Nombre : (\d+)\.', ligne)
        if not m:
            raise Arret('tableau attendu, trouvé %r' % ligne)
        i += 1
        suivante()
        tete = ligne_tableau(lignes[i])
        if tete[-1] != 'Sous-race de la fiche V15.2.2' or set(ligne_tableau(lignes[i + 1])) != {'---'}:
            raise Arret('en-tête de tableau inattendu : %r' % lignes[i])
        colonnes = [cellule_md(c) for c in tete[:-1]]
        rangs = []
        for l in lignes[i + 2:i + 2 + int(m.group(1))]:
            cellules = [cellule_md(c) for c in ligne_tableau(l)]
            if len(cellules) != len(colonnes) + 1:
                raise Arret('ligne de tableau de %d cellules : %r' % (len(cellules), l))
            rangs.append({'cellules': cellules[:-1], 'fiche': cellules[-1] or None})
        i += 2 + int(m.group(1))
        tableau = {'titre': tableau_titre, 'colonnes': colonnes, 'lignes': rangs}
    if suivante() is not None:
        raise Arret('reste inattendu dans « Ethnies et dons raciaux » : %r' % lignes[i])
    return rubriques, dons, tableau


def reecrire_ethnies(onglet, rubriques, dons, tableau):
    """Réécrit la section avec races.render_ethnies (structures de l'importeur reconstituées)."""
    cles, rows, single = {}, [], None
    for d in dons:
        if d['forme'] == 'ethnie':
            notes = {{'etiquette': R.COL_A, 'nom': R.COL_H, 'texte': R.COL_O}[k]: v for k, v in d['notes'].items()}
            rows.append({'a': d['etiquette'], 'h': d['nom'], 'o': d['texte'], 'notes': notes})
            cles[R.first_line(d['etiquette'])] = d['fiche']
        else:
            single = (d['nom'], d['texte'])
            cles[R.first_line(d['nom'])] = d['fiche']
    panels = None
    if tableau:
        panels = {'headers': tableau['colonnes'], 'rows': [l['cellules'] for l in tableau['lignes']]}
        for l in tableau['lignes']:
            cles[R.first_line(l['cellules'][0])] = l['fiche']
    gift = {'ethnies': {'headers': rubriques, 'rows': rows} if rubriques else None, 'single': single, 'panels': panels,
            'name': tableau['titre'] if tableau else None}
    pairs = [({'key': k}, None if v is None else {R.BONUS_COL_SUB: v}) for k, v in cles.items()]
    return R.render_ethnies({'gift': gift, 'tab': onglet}, pairs)


def lire_race(race_id, onglet, corps):
    s = sections(corps)
    pres, hist, desc = R.SEC_PRES, R.SEC_HIST, R.SEC_DESC
    for titre in (pres, hist, R.SEC_STATS, R.SEC_ADV, R.SEC_DON, R.SEC_ETH, R.SEC_HYPER):
        if titre not in s:
            raise Arret('%s : section « %s » absente' % (race_id, titre))
    v = {'race_id': race_id, 'onglet': onglet}
    v['description_generale'] = texte_md(s[pres])
    v['histoire'] = texte_md(s[hist])
    v['description'] = texte_md(s[desc]) if desc in s else None

    stats = s[R.SEC_STATS]
    tete, sep, valeurs = (ligne_tableau(l) for l in stats[:3])
    if [cellule_md(c) for c in tete[:4]] != list(STAT_LABELS) or set(sep) != {'---'}:
        raise Arret('%s : en-tête des valeurs de départ inattendu : %r' % (race_id, tete))
    nombres = []
    for c in valeurs[:4]:
        for n in cellule_md(c).split(' / '):
            if not re.fullmatch(r'-?\d+', n):
                raise Arret('%s : valeur de départ non entière : %r' % (race_id, c))
            nombres.append(int(n))
    if len(nombres) != 5:
        raise Arret('%s : cinq valeurs de départ attendues, %r' % (race_id, nombres))
    v['sante_depart'], v['chakra_depart'], v['barriere_bonus'], v['vitesse_sol'], v['vitesse_nage'] = nombres

    adv = morceaux_etiquetes(s[R.SEC_ADV])
    if [m[0] for m in adv] != [R.LABEL_ADV, R.LABEL_INC]:
        raise Arret('%s : avantages / inconvénients inattendus : %r' % (race_id, [m[0] for m in adv]))
    v['avantages'], v['inconvenients'] = adv[0][1], adv[1][1]
    v['don_base'] = texte_md(s[R.SEC_DON])

    rubriques, dons, tableau = lire_ethnies(s[R.SEC_ETH], onglet)
    if reecrire_ethnies(onglet, rubriques, dons, tableau) != ['## ' + R.SEC_ETH, ''] + s[R.SEC_ETH] + ['']:
        raise Arret('%s : « %s » ne se réécrit pas à l\'identique' % (race_id, R.SEC_ETH))
    v['rubriques'], v['dons'], v['tableau'] = rubriques, dons, tableau

    hyper = morceaux_etiquetes(s[R.SEC_HYPER])
    if len(hyper) != 1:
        raise Arret('%s : une capacité Mode Hyper attendue' % race_id)
    v['hyper'] = hyper[0]

    # Réécriture des sections de l'onglet avec le code de l'importeur : la page doit revenir caractère pour caractère.
    attendu = {
        pres: R.md_text(v['description_generale']),
        hist: R.md_text(v['histoire']),
        R.SEC_ADV: R.labeled(R.LABEL_ADV, v['avantages']) + [''] + R.labeled(R.LABEL_INC, v['inconvenients']),
        R.SEC_DON: R.md_text(v['don_base']),
        R.SEC_HYPER: R.labeled(*v['hyper']),
    }
    if desc in s:
        attendu[desc] = R.md_text(v['description'])
    for titre, lignes in attendu.items():
        if lignes != s[titre]:
            raise Arret('%s : « %s » ne se réécrit pas à l\'identique' % (race_id, titre))
    if R.cell_md(' / '.join(str(n) for n in nombres[3:])) != valeurs[3] or [R.cell_md(str(n)) for n in nombres[:3]] != valeurs[:3]:
        raise Arret('%s : valeurs de départ non réversibles' % race_id)

    cites = R.cited_magics(v['inconvenients'])
    v['magies_citees'] = cites[0] if cites else []
    return v


# --------------------------------------------------------------------------------------------------------------------
# Base -> extraction complète
# --------------------------------------------------------------------------------------------------------------------
def base(rows=ROWS, schema_ancien=None):
    """Base reconstruite depuis data/rows ; avant la migration (lignes en version N-1), avec le schéma précédent : `schema_ancien`, sinon celui
    du dernier commit (comme tools/db/migrer.py)."""
    if T.version_rows(rows) == T.version_schema():
        return T.reconstruire(':memory:', rows)
    if schema_ancien:
        return T.reconstruire(':memory:', rows, schema_ancien)
    r = subprocess.run(['git', 'show', 'HEAD:data/schema.sql'], cwd=RACINE, capture_output=True, text=True, check=True)
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as tmp:
        tmp.write(r.stdout)
    try:
        return T.reconstruire(':memory:', rows, tmp.name)
    finally:
        os.unlink(tmp.name)


def extraire(db):
    races = [r for r in db.execute("SELECT r.id, r.nom, r.source_ref, p.corps_md FROM race r JOIN page p ON p.id = r.id ORDER BY r.id")
             if not r[2].startswith(PROVENANCE_DU_SITE)]
    onglets = {}
    for page_id, texte in db.execute(
            "SELECT ps.page_id, s.texte FROM page_source ps JOIN source s ON s.id = ps.source_id WHERE ps.page_id LIKE 'races/%'"):
        m = re.fullmatch(r"Google Sheet « Les races », onglet « (.+) »", texte)
        if m and m.group(1) != 'première feuille':
            onglets.setdefault(page_id, []).append(m.group(1))
    ethnies = {}
    for eid, race_id, nom in db.execute('SELECT id, race_id, nom FROM ethnie'):
        ethnies.setdefault((race_id, T.normalize(nom)), []).append(eid)
    magies = {nom: mid for mid, nom in db.execute('SELECT id, nom FROM magie')}

    def ethnie_de(race_id, nom):
        if nom is None:
            return None
        ids = ethnies.get((race_id, T.normalize(nom)), [])
        if len(ids) != 1:
            raise Arret('%s : sous-race de la fiche « %s » : %d ethnie(s)' % (race_id, nom, len(ids)))
        return ids[0]

    out = []
    for race_id, nom, source_ref, corps in races:
        if len(onglets.get(race_id, [])) != 1:
            raise Arret('%s : onglet de la race introuvable dans ses sources (%r)' % (race_id, onglets.get(race_id)))
        v = lire_race(race_id, onglets[race_id][0], corps)
        m = re.search(r'Les races › première feuille › A(\d+):B\1', source_ref)
        if not m:
            raise Arret('%s : rang dans l\'index introuvable (%r)' % (race_id, source_ref))
        v['rang_index'] = int(m.group(1))            # ligne de la race dans l'index (première feuille, sans en-tête)
        for d in v['dons']:
            d['ethnie_id'] = ethnie_de(race_id, d['fiche'])
            d['slug'] = T.normalize(d['etiquette'] if d['forme'] == 'ethnie' else d['nom'])
        if v['tableau']:
            for l in v['tableau']['lignes']:
                l['ethnie_id'] = ethnie_de(race_id, l['fiche'])
        v['magie_ids'] = [magies[n] for n in v['magies_citees']]
        out.append(v)
    if len({v['rang_index'] for v in out}) != len(out):
        raise Arret('rangs d\'index en double')
    return out


# --------------------------------------------------------------------------------------------------------------------
# Lignes des tables (une liste de dictionnaires par table, colonnes dans l'ordre du schéma)
# --------------------------------------------------------------------------------------------------------------------
def lignes(extraction):
    t = {k: [] for k in ('race_onglet', 'race_don', 'race_don_tableau_colonne', 'race_don_tableau_ligne', 'race_don_tableau_cellule',
                         'race_magie_onglet', 'mode_hyper_effet', 'page_entite', 'note_cellule')}
    for v in extraction:
        rid, onglet = v['race_id'], v['onglet']
        ref = lambda quoi: '%s › %s › %s' % (CLASSEUR, onglet, quoi)  # noqa: E731
        rub = v['rubriques'] or (None, None, None)
        t['race_onglet'].append(dict(
            race_id=rid, onglet=onglet, description_generale=v['description_generale'], histoire=v['histoire'], description=v['description'],
            sante_depart=v['sante_depart'], chakra_depart=v['chakra_depart'], barriere_bonus=v['barriere_bonus'],
            vitesse_sol=v['vitesse_sol'], vitesse_nage=v['vitesse_nage'], avantages=v['avantages'], inconvenients=v['inconvenients'],
            don_base=v['don_base'], dons_rubrique=rub[0], dons_rubrique_nom=rub[1], dons_rubrique_don=rub[2],
            dons_tableau_titre=v['tableau']['titre'] if v['tableau'] else None, origine=ORIGINE,
            source_ref=ref('A4 (présentation), HISTOIRE, DESCRIPTION, DONNÉES, Avantage(s), Inconvénient(s), Don B (Base)')))
        for rang, d in enumerate(v['dons'], 1):
            did = '%s#don:%s' % (rid, d['slug'])
            cle = (rid, d['etiquette'])
            cellule = CELLULES_NOTES.get(cle)
            if d['notes'] and (set(d['notes']) != {'texte'} or not cellule):
                raise Arret('%s : note de cellule sans cellule connue (%r)' % (did, d['notes']))
            t['race_don'].append(dict(
                id=did, race_id=rid, slug=d['slug'], rang=rang, forme=d['forme'], etiquette=d['etiquette'], nom=d['nom'], texte=d['texte'],
                ethnie_id=d['ethnie_id'], origine=ORIGINE, source_ref=ref(cellule or 'Don R (Race)'),
                remarque=d['notes'].get('texte')))
            t['page_entite'].append(dict(entite_table='race_don', entite_id=did, page_id=rid, principale=0, origine=ORIGINE))
            if d['notes']:
                t['note_cellule'].append(dict(entite_table='race_don', entite_id=did, rang=1, champ='texte', cellule=cellule, nature='note',
                                              repond_a=None, texte=d['notes']['texte'], origine=ORIGINE, source_ref=ref(cellule)))
        if v['tableau']:
            for k, libelle in enumerate(v['tableau']['colonnes'], 1):
                t['race_don_tableau_colonne'].append(dict(race_id=rid, rang=k, libelle=libelle, origine=ORIGINE, source_ref=ref('Don R (Race), tableau')))
            for n, l in enumerate(v['tableau']['lignes'], 1):
                t['race_don_tableau_ligne'].append(dict(race_id=rid, rang=n, ethnie_id=l['ethnie_id'], origine=ORIGINE, source_ref=ref('Don R (Race), tableau')))
                for k, valeur in enumerate(l['cellules'], 1):
                    if not valeur:
                        raise Arret('%s : cellule vide dans le tableau des dons (%d, %d)' % (rid, n, k))
                    t['race_don_tableau_cellule'].append(dict(race_id=rid, ligne=n, colonne=k, valeur=valeur, origine=ORIGINE,
                                                              source_ref=ref('Don R (Race), tableau')))
        for rang, (mid, brut) in enumerate(zip(v['magie_ids'], v['magies_citees']), 1):
            t['race_magie_onglet'].append(dict(race_id=rid, magie_id=mid, rang=rang, nom_brut=brut, origine=ORIGINE, source_ref=ref('Inconvénient(s)')))
        nom, effet = v['hyper']
        t['mode_hyper_effet'].append(dict(
            id='onglet_race:%s' % rid, version='onglet_race', portee='race', rang=v['rang_index'], libelle=onglet, magie_id=None, magie2_id=None,
            race_id=rid, variante=None, variante_brut=None, effet=effet, commentaire=None, origine=ORIGINE, source_ref=ref('Capacité Mode Hyper'),
            remarque=None, nom=nom))
    return t


def sql_val(v):
    if v is None:
        return 'NULL'
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, row):
    return 'INSERT INTO %s (%s) VALUES (%s);' % (table, ', '.join(row), ', '.join(sql_val(x) for x in row.values()))


ENTETE = """-- 0007-races-onglet : contenu de l'onglet de chaque race (classeur « Les races ») dans des tables typées, pour que les pages de race soient rendues
-- depuis la base comme les pages de magie (décisions R12 et R13 du propriétaire, docs/decisions-regles.md). Migration de structure ET de données.
--   * race_onglet : une ligne par race (présentation, histoire, description, valeurs de départ de l'onglet, avantages, inconvénients, don de base) ;
--   * race_don : dons raciaux (une ligne par ethnie du tableau de l'onglet, ou le don unique de la race) ; la note de cellule d'un don est dans `remarque` ;
--   * race_don_tableau_colonne / _ligne / _cellule : le tableau en panneaux de l'onglet (Drakos, Mort-vivant), cellule par cellule ;
--   * race_magie_onglet : magies innées que l'onglet limite explicitement (« en inné uniquement » : le Nain, décision R11) ;
--   * mode_hyper_effet : colonne `nom` (nom de la capacité quand la source en donne un) et la version 'onglet_race' (27 lignes) ;
--   * v_regard_peuple : la matrice des relations lue dans le sens tranché (R12 : la case (ligne A, colonne B) dit comment A voit B).
-- Les lignes sont tirées des pages races/<slug> (écrites par tools/sheets/races.py depuis les onglets, puis corrigées par 0005 et 0006) par tools/db/races_onglet.py,
-- qui réécrit chaque section lue avec le code de l'importeur et exige la page à l'identique : rien n'est interprété ni complété.
"""

DDL = """
ALTER TABLE mode_hyper_effet ADD COLUMN nom TEXT;

CREATE TABLE race_onglet (
  race_id              TEXT    NOT NULL PRIMARY KEY REFERENCES race(id),
  onglet               TEXT    NOT NULL UNIQUE CHECK (length(onglet) > 0),
  description_generale TEXT    NOT NULL CHECK (length(description_generale) > 0),
  histoire             TEXT    NOT NULL CHECK (length(histoire) > 0),
  description          TEXT    CHECK (description IS NULL OR length(description) > 0),
  sante_depart         INTEGER NOT NULL,
  chakra_depart        INTEGER NOT NULL,
  barriere_bonus       INTEGER NOT NULL,
  vitesse_sol          INTEGER NOT NULL,
  vitesse_nage         INTEGER NOT NULL,
  avantages            TEXT    NOT NULL CHECK (length(avantages) > 0),
  inconvenients        TEXT    NOT NULL CHECK (length(inconvenients) > 0),
  don_base             TEXT    NOT NULL CHECK (length(don_base) > 0),
  dons_rubrique        TEXT    CHECK (dons_rubrique IN ('Type', 'Condition d''origine', 'Magie innée')),
  dons_rubrique_nom    TEXT    CHECK (dons_rubrique_nom IS NULL OR length(dons_rubrique_nom) > 0),
  dons_rubrique_don    TEXT    CHECK (dons_rubrique_don IS NULL OR length(dons_rubrique_don) > 0),
  dons_tableau_titre   TEXT    CHECK (dons_tableau_titre IS NULL OR length(dons_tableau_titre) > 0),
  origine              TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref           TEXT    NOT NULL CHECK (length(source_ref) > 0),
  CHECK ((dons_rubrique IS NULL) = (dons_rubrique_don IS NULL)),
  CHECK (dons_rubrique_nom IS NULL OR dons_rubrique IS NOT NULL)
) STRICT, WITHOUT ROWID;

CREATE TABLE race_don (
  id          TEXT    NOT NULL PRIMARY KEY,
  race_id     TEXT    NOT NULL REFERENCES race_onglet(race_id),
  slug        TEXT    NOT NULL CHECK (length(slug) > 0 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '*--*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'),
  rang        INTEGER NOT NULL CHECK (rang >= 1),
  forme       TEXT    NOT NULL CHECK (forme IN ('ethnie', 'unique')),
  etiquette   TEXT    CHECK (etiquette IS NULL OR length(etiquette) > 0),
  nom         TEXT    CHECK (nom IS NULL OR length(nom) > 0),
  texte       TEXT    NOT NULL CHECK (length(texte) > 0),
  ethnie_id   TEXT    REFERENCES ethnie(id),
  origine     TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref  TEXT    NOT NULL CHECK (length(source_ref) > 0),
  remarque    TEXT,
  UNIQUE (race_id, slug),
  UNIQUE (race_id, rang),
  CHECK (id = race_id || '#don:' || slug),
  CHECK ((forme = 'ethnie') = (etiquette IS NOT NULL)),
  CHECK (forme = 'ethnie' OR nom IS NOT NULL)
) STRICT;

CREATE INDEX race_don_ethnie ON race_don (ethnie_id) WHERE ethnie_id IS NOT NULL;

CREATE TABLE race_don_tableau_colonne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  libelle    TEXT    NOT NULL CHECK (length(libelle) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE TABLE race_don_tableau_ligne (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  ethnie_id  TEXT    REFERENCES ethnie(id),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_ligne_ethnie ON race_don_tableau_ligne (ethnie_id) WHERE ethnie_id IS NOT NULL;

CREATE TABLE race_don_tableau_cellule (
  race_id    TEXT    NOT NULL,
  ligne      INTEGER NOT NULL,
  colonne    INTEGER NOT NULL,
  valeur     TEXT    NOT NULL CHECK (length(valeur) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, ligne, colonne),
  FOREIGN KEY (race_id, ligne) REFERENCES race_don_tableau_ligne (race_id, rang),
  FOREIGN KEY (race_id, colonne) REFERENCES race_don_tableau_colonne (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_don_tableau_cellule_colonne_fk ON race_don_tableau_cellule (race_id, colonne);

CREATE TABLE race_magie_onglet (
  race_id    TEXT    NOT NULL REFERENCES race_onglet(race_id),
  magie_id   TEXT    NOT NULL REFERENCES magie(id),
  rang       INTEGER NOT NULL CHECK (rang >= 1),
  nom_brut   TEXT    NOT NULL CHECK (length(nom_brut) > 0),
  origine    TEXT    NOT NULL REFERENCES famille(id) CHECK (origine = 'races'),
  source_ref TEXT    NOT NULL CHECK (length(source_ref) > 0),
  PRIMARY KEY (race_id, magie_id),
  UNIQUE (race_id, rang)
) STRICT, WITHOUT ROWID;

CREATE INDEX race_magie_onglet_magie ON race_magie_onglet (magie_id);

CREATE VIEW v_regard_peuple AS
  SELECT r.ligne_peuple_id AS peuple_id, r.colonne_peuple_id AS vu_peuple_id, r.echelle_id, e.ordre AS echelle_ordre
  FROM relation_peuple r JOIN echelle_relation e ON e.id = r.echelle_id;
"""


def migration_sql(t):
    out = [ENTETE, DDL.strip(), '']
    for table in ('race_onglet', 'race_don', 'race_don_tableau_colonne', 'race_don_tableau_ligne', 'race_don_tableau_cellule',
                  'race_magie_onglet', 'mode_hyper_effet', 'page_entite', 'note_cellule'):
        out.append('-- %s : %d ligne(s)' % (table, len(t[table])))
        out += [insert(table, r) for r in t[table]]
        out.append('')
    return '\n'.join(out)


def verifier(db, t):
    """Les tables de la base (déjà migrée) contiennent exactement les lignes de l'extraction (hors races créées depuis le site : voir l'en-tête)."""
    ecarts = []
    filtres = {'mode_hyper_effet': "version = 'onglet_race'", 'page_entite': "entite_table = 'race_don'", 'note_cellule': "entite_table = 'race_don'"}
    creees = {rid for rid, ref in db.execute('SELECT id, source_ref FROM race') if ref.startswith(PROVENANCE_DU_SITE)}
    # la race d'une ligne : race_id, ou la page (page_entite), ou l'entité « races/<slug>#don:… » (note_cellule)
    race_de = {'page_entite': 'page_id', 'note_cellule': 'entite_id'}
    for table, attendues in t.items():
        cols = T.colonnes(db, table)
        where = filtres.get(table, '1')
        i = cols.index(race_de.get(table, 'race_id'))
        presentes = sorted(tuple(r) for r in db.execute('SELECT %s FROM "%s" WHERE %s' % (', '.join('"%s"' % c for c in cols), table, where))
                           if r[i].split('#')[0] not in creees)
        voulues = sorted(tuple(r[c] for c in cols) for r in attendues)
        if presentes != voulues:
            ecarts.append('%s : %d ligne(s) en base, %d attendue(s), %d différente(s)' % (
                table, len(presentes), len(voulues), len(set(presentes) ^ set(voulues))))
    return ecarts


def main(argv):
    ancien = argv[argv.index('--schema-ancien') + 1] if '--schema-ancien' in argv[:-1] else None
    argv = [a for a in argv if a not in ('--schema-ancien', ancien)]
    rows = os.path.abspath(argv[argv.index('--rows') + 1]) if '--rows' in argv[:-1] else None
    argv = [a for a in argv if a != '--rows' and (rows is None or os.path.abspath(a) != rows)]
    if argv not in (['--ecrire'], ['--verifier']) or (rows and argv != ['--verifier']):
        sys.exit('usage : races_onglet.py --ecrire [--schema-ancien <fichier>] | --verifier [--rows <dossier>]')
    rows = rows or ROWS
    try:
        db = base(rows=rows, schema_ancien=ancien)
        t = lignes(extraire(db))
    except Arret as e:
        print('arrêt : %s' % e)
        return 1
    if argv == ['--ecrire']:
        with open(MIGRATION, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(migration_sql(t))
        print('%s écrite : %s' % (os.path.relpath(MIGRATION, RACINE), ', '.join('%s %d' % (k, len(v)) for k, v in t.items())))
        return 0
    if T.version_rows(rows) != T.version_schema():
        print('data/rows n\'est pas à la version du schéma : migrer d\'abord (npm run db:migrate)')
        return 1
    ecarts = verifier(db, t)
    print('\n'.join(ecarts) if ecarts else 'tables de l\'onglet des races conformes aux pages (%s)' % ', '.join('%s %d' % (k, len(v)) for k, v in t.items()))
    return 1 if ecarts else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
