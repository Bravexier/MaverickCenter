#!/usr/bin/env python3
"""Codex : une page du wiki (type `lore`) par entité du Google Doc « CODEX Maverick », plus les pages de sommaire.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/docs/codex.py [--source <export.md>] [--out client/src/content/wiki]            écrit les pages
    python3 -I tools/docs/codex.py [--source <export.md>] [--out client/src/content/wiki] --verifier n'écrit rien, contrôle
    (--historique <fichier> : l'historique des modifications du site, data/rows/historique_modification.sql par défaut ;
     --vocabulaire <fichier> : les mots-clés, data/rows/mot_cle.sql par défaut)

puis `npm run db:sync-pages` (depuis client/) : les pages sont de la famille `docs` (première source « Google Doc « … » »), elles entrent dans
`data/rows` par `tools/db/pages_md.py sync`.

Source : l'export Markdown de la copie du document dans le Drive du propriétaire (2026-10-11), rangé dans `sources/raw/<id>.md`, ses images dans
`sources/raw/<id>/` (symboles des ordres, extraits de carte des provinces ; les pages ne les montrent pas encore). Le texte est COPIÉ, jamais
réécrit : coquilles, majuscules et formulations sont celles du document (la relecture orthographique passe par une migration, décision R10). Seuls
changent la forme Markdown (niveaux de titre, titres en gras-italique seuls sur leur ligne devenus des titres, tirets échappés devenus des listes,
espaces de fin de ligne) et ce qui ne s'affiche pas (images, titres vides, ancres).

Découpage (une page = une section du document) :
    « Au début … »                 une page par section (Origine du monde, Situation actuelle, Les Impacts mineur et majeur)
    « Les Divinités »              une page par divinité ; titre = le nom (avant « - » ou après « — »), le reste en tête de page et en résumé
    « Temples/Cultes/Guildes »     une page par temple, culte ou guilde ; la parenthèse du titre en tête de page (« Temple du … » : aussi en alias)
    « Les races non-jouable »      une page par race
    « Les Civilisations »          une page par continent qui a du texte, une par nation ou région ; celles de l'Empire humain d'Erisia
                                   (Dombourg, Champieu, Xendown, Cloche d'or) ont leur page, leurs provinces en sections
    « Les Outils Légendaires… »    une page par objet
    « GLOSSAIRE »                  une page
et une page de sommaire par partie qui en a plusieurs, plus `lore/codex` (sommaire du document). Une section vide du document n'a pas de page.

Le script n'écrit que dans <out>/lore/, refuse d'écraser une page qui ne vient pas de ce document et n'efface rien (une page du document qu'il ne
produit plus est signalée « orpheline »).

--verifier : n'écrit rien. Relit l'export par un code qui ne partage pas le découpage (ligne par ligne) et contrôle les pages sur disque :
  (1) chaque ligne de texte du document (hors titres, images, lignes vides et champs sans valeur) est dans une page du Codex, au mot près ;
  (2) chaque titre non vide du document (vrai titre ou ligne en gras-italique seule) est un titre de page, un titre de section ou le texte d'une
      page (nom et sous-titre séparément) ; un renvoi « Voir “X” pour plus d'information » doit nommer X dans une page ;
  (3) les pages sur disque sont exactement celles que produit le découpage, à l'octet près.
Une page que le site de dev a modifiée (titre, texte ou alias ; demande du propriétaire : « le site est la source » de ce qu'il modifie, docs/serveur.md,
« Mise à jour ») est contrôlée dans son état d'import, relu dans data/rows/historique_modification.sql (pages_du_site) ; l'écriture ne la touche pas.
"""
import json
import os
import re
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '..', 'db'))   # `python3 -I` n'ajoute pas le dossier du script au chemin des modules
import maverick as T  # noqa: E402
import pages_md  # noqa: E402

RACINE = os.path.abspath(os.path.join(HERE, '..', '..'))
DOC_ID = '1tH-T9k-a3sADBtKWHxcuMcN94_VA8-Zo2BTzee9O7Tg'
SOURCE = os.path.join(RACINE, 'sources', 'raw', f'{DOC_ID}.md')
OUT = os.path.join(RACINE, 'client', 'src', 'content', 'wiki')
SOURCES = ['Google Doc « CODEX Maverick »', f'https://docs.google.com/document/d/{DOC_ID}/edit']
TYPE = 'lore'
SCHEMA = os.path.join(RACINE, 'data', 'schema.sql')
HISTORIQUE = os.path.join(RACINE, 'data', 'rows', 'historique_modification.sql')
VOCABULAIRE = os.path.join(RACINE, 'data', 'rows', 'mot_cle.sql')

# Mots-clés : une étiquette de navigation par partie (ce ne sont pas des faits du lore). Une page ne porte que ceux du vocabulaire du site de dev
# (migration 0056 : un import ne crée jamais de mot-clé, ceux qui manquent ne sont pas écrits : vocabulaire()) ; depuis 0056, « codex » seul.
PARTIES = {
    'Au début …': 'histoire',
    'Les Divinités': 'divinité',
    'Temples/Cultes/Guildes': 'faction',
    'Les races non-jouable': 'race non jouable',
    'Les Civilisations': 'civilisation',
    'Les Outils Légendaires, Uniques': 'outil légendaire',
    'Les Chroniques': None,
    'GLOSSAIRE': 'glossaire',
}
GROUPES_DE_DIVINITES = {'Force créatrice': 'force créatrice', 'Force destructrice': 'force destructrice', 'Primordiaux': 'primordial', 'Dieux': 'dieu'}
CORRECTIONS = os.path.join(HERE, 'codex-corrections.json')
# Graphie du document gardée en alias d'une page dont le nom est corrigé (codex-corrections.json : décision R21, « Eaunoir » → « Eaunoire »).
ALIASES = {'Eaunoire': ['Eaunoir']}
# Renvois écrits dans le document (« Voir “Temple du Vent” pour plus d'information ») vers une page dont le titre s'écrit autrement.
RENVOIS = {'Temple du Vent': 'Temple de Vent'}
# Sections des civilisations dont les sous-sections sont des territoires (une page chacun) et non des rubriques : l'Empire humain d'Erisia (Dombourg,
# Champieu, Xendown, Cloche d'or) et celui de Mrode (Saugnane, Balogne). Partout ailleurs, une sous-section reste dans la page.
TERRITOIRES = {'Empire Humain'}
# Mot-clé d'une section « Magie … » des temples : le nom de la magie dans la base (table magie), en minuscules.
MAGIES = {'Magie de Sang': 'sang', 'Magie Arcane': 'arcane', 'Magie Corruption': 'corruption', 'Magie Temps/Espace': 'espace/temps', 'Magie Vide': 'vide',
          'Magie Nécromancie': 'nécromancie', 'Magie de Feu': 'feu', 'Magie de l’Eau': 'eau', 'Magie de la Glace': 'glace', 'Magie de la Terre': 'terre',
          'Magie du Vent': 'vent', 'Magie de la Foudre': 'foudre', 'Magie de la Lumière': 'lumière', 'Magie de l’Ombre': 'ombre'}


# --------------------------------------------------------------------------------------------------------------------
# Lecture de l'export
# --------------------------------------------------------------------------------------------------------------------
IMAGE = re.compile(r'^\s*(\*\*\*)?!\[\]\[image\d+\](\*\*\*)?\s*$')
REF_IMAGE = re.compile(r'^\[image\d+\]: <[^>]*>\s*$')
TITRE = re.compile(r'^(#{1,6})(?:\s(.*))?$')
PSEUDO = re.compile(r'^\s?\*\*\*([^*].*?)\*\*\*\s*$')   # « ***Présentation générale*** » seul sur sa ligne


def nettoyer_titre(brut):
    t = (brut or '').replace('\t', ' ')
    t = re.sub(r'\s*\{#[^}]*\}\s*$', '', t)
    t = t.replace('***', '').replace('**', '')
    t = re.sub(r'\\([-()#~\[\]])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()


def lire_lignes(chemin, corrections=CORRECTIONS):
    """Lignes de l'export, après les corrections du registre (codex-corrections.json) ; s'arrête si une correction n'a pas son nombre d'occurrences."""
    with open(chemin, encoding='utf-8') as f:
        texte = f.read()
    if corrections:
        with open(corrections, encoding='utf-8') as f:
            registre = json.load(f)
        for c in registre['corrections']:
            motif = (r'(?<![^\W\d_])' + re.escape(c['avant']) + r'(?![^\W\d_])') if c.get('mot') else re.escape(c['avant'])
            texte, n = re.subn(motif, c['apres'].replace('\\', r'\\'), texte)
            if n != c['occurrences']:
                raise SystemExit(f"correction « {c['avant']} » → « {c['apres']} » : {n} occurrence(s) dans l'export, {c['occurrences']} attendue(s)")
    return texte.split('\n')


def arbre(lignes):
    """-> racine {titre, niveau, lignes, enfants} : sections selon les vrais titres (#) non vides ; images et références d'images retirées."""
    racine = dict(titre=None, niveau=0, lignes=[], enfants=[])
    pile = [racine]
    for ligne in lignes:
        if IMAGE.match(ligne) or REF_IMAGE.match(ligne):
            continue
        m = TITRE.match(ligne)
        if m:
            titre = nettoyer_titre(m.group(2))
            if not titre:
                continue   # titre vide : un séparateur du document
            niveau = len(m.group(1))
            while pile[-1]['niveau'] >= niveau:
                pile.pop()
            noeud = dict(titre=titre, niveau=niveau, lignes=[], enfants=[])
            pile[-1]['enfants'].append(noeud)
            pile.append(noeud)
            continue
        pile[-1]['lignes'].append(ligne)
    return racine


CHAMP_VIDE = re.compile(r'^(\* )?\*\*[^*]+:\*\*$')   # « **Type :** » sans valeur : un gabarit à remplir


def vide(noeud):
    """Section sans texte : ni ligne, ni enfant qui en ait ; titres en gras-italique et champs sans valeur (gabarit à remplir) ne comptent pas."""
    texte = [l.strip() for l in noeud['lignes'] if l.strip()]
    return all(PSEUDO.match(l) or CHAMP_VIDE.match(l) for l in texte) and all(vide(e) for e in noeud['enfants'])


# --------------------------------------------------------------------------------------------------------------------
# Mise en forme du Markdown d'une page
# --------------------------------------------------------------------------------------------------------------------
LISTE = re.compile(r'^\s*([*+-]|\d+\.)\s')


def corps_markdown(lignes):
    """Lignes du document -> Markdown de la page : tirets échappés en début de ligne = liste ; espaces de fin retirés, sauf un retour à la ligne
    forcé (deux espaces) suivi d'une ligne du même paragraphe, écrit « \\ » ; lignes vides en série réduites à une."""
    sortie = []
    for i, ligne in enumerate(lignes):
        ligne = re.sub(r'^(\s*)\\- ', r'\1- ', ligne)
        suivante = lignes[i + 1] if i + 1 < len(lignes) else ''
        if ligne.endswith('  ') and ligne.strip() and suivante.strip() and not LISTE.match(suivante) and not suivante.lstrip().startswith(('#', '|')):
            ligne = ligne.rstrip() + '\\'
        else:
            ligne = ligne.rstrip()
        if not ligne and (not sortie or not sortie[-1]):
            continue
        sortie.append(ligne)
    while sortie and not sortie[-1]:
        sortie.pop()
    return sortie


def rendre(noeud, niveau_page, avec_titre=True):
    """Section -> lignes Markdown : son titre au niveau `niveau_page` (2 = « ## »), ses titres en gras-italique un cran dessous, ses enfants ensuite."""
    lignes = []
    if avec_titre:
        lignes += ['#' * niveau_page + ' ' + noeud['titre'], '']
    pseudo = '#' * min(niveau_page + 1, 6) if avec_titre else '#' * niveau_page
    for ligne in corps_markdown(noeud['lignes']):
        m = PSEUDO.match(ligne)
        if m and nettoyer_titre(m.group(1)):
            lignes += [pseudo + ' ' + nettoyer_titre(m.group(1)), '']
        else:
            lignes.append(ligne)
    for enfant in noeud['enfants']:
        if vide(enfant):
            continue
        if lignes and lignes[-1]:
            lignes.append('')
        lignes += rendre(enfant, min(niveau_page + 1, 6) if avec_titre else niveau_page)
    return nettoyer_lignes(lignes)


def nettoyer_lignes(lignes):
    sortie = []
    for ligne in lignes:
        if not ligne and (not sortie or not sortie[-1]):
            continue
        sortie.append(ligne)
    while sortie and not sortie[-1]:
        sortie.pop()
    return sortie


def sans_emphase(texte):
    t = re.sub(r'\*+', '', texte)
    t = re.sub(r'\\([-()#~\[\]])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()


def premiere_phrase(lignes):
    """Résumé : la première phrase du premier paragraphe de texte (ni titre, ni liste, ni tableau), complétée jusqu'à 60 caractères au moins."""
    for ligne in lignes:
        brut = ligne.strip()
        if not brut or brut.startswith(('#', '|', '![')) or LISTE.match(brut) or PSEUDO.match(brut) or re.match(r'^\*\*[^*]+:\*\*', brut):
            continue
        texte = sans_emphase(brut.rstrip('\\'))
        if not texte:
            continue
        phrases = re.findall(r'.+?(?:[.!?…](?=\s|$)|$)', texte)
        resume = ''
        for phrase in phrases:
            resume = (resume + ' ' + phrase.strip()).strip()
            if len(resume) >= 60:
                break
        return resume
    return None


# --------------------------------------------------------------------------------------------------------------------
# Découpage en pages
# --------------------------------------------------------------------------------------------------------------------
def nom_et_reste(titre):
    """« Brock - Dieu primordial de la force » -> ('Brock', 'Dieu primordial de la force') ; « Confrérie du Sang (Temple du sang) » ->
    ('Confrérie du Sang', '(Temple du sang)') ; « Force Créatrice — Tofrom » -> ('Tofrom', 'Force Créatrice')."""
    if ' — ' in titre:
        avant, apres = titre.split(' — ', 1)
        return apres.strip(), avant.strip()
    if ' - ' in titre:
        avant, apres = titre.split(' - ', 1)
        return avant.strip(), apres.strip()
    m = re.match(r'^(.*?)\s*(\([^()]*\))$', titre)
    if m and m.group(1):
        return m.group(1).strip(), m.group(2)
    return titre.strip(), None


class Codex:
    def __init__(self, lignes, vocabulaire=None):
        self.racine = arbre(lignes)
        self.pages = {}       # slug -> page
        self.ordre = []
        self.vocabulaire = vocabulaire   # écriture -> libellé du mot-clé, ou None (vocabulaire()) ; None : les mots-clés tels que le découpage les donne

    def page(self, titre, corps, tags, resume=None, aliases=()):
        slug = T.normalize(titre)
        if slug in self.pages:
            raise ValueError(f'deux pages pour le même titre : {titre!r}')
        tags = ['codex'] + [t for t in tags if t]
        if self.vocabulaire:
            # ceux du vocabulaire seulement, dans son écriture (celle que db:export-pages écrit), une fois chacun
            tags = list(dict.fromkeys(libelle for libelle in map(self.vocabulaire, tags) if libelle))
        p = dict(slug=slug, titre=titre, corps=nettoyer_lignes(corps), tags=tags,
                 resume=resume if resume is not None else premiere_phrase(corps), aliases=list(aliases))
        self.pages[slug] = p
        self.ordre.append(slug)
        return p

    @staticmethod
    def lien(titre):
        return f'[[{titre}]]'

    def entite(self, noeud, tags, niveau=2, voir_aussi=()):
        """Une page pour une section : titre = le nom ; le reste du titre (sous-titre, parenthèse) en italique en tête de page."""
        nom, reste = nom_et_reste(noeud['titre'])
        aliases = list(ALIASES.get(nom, []))
        texte = rendre(noeud, niveau, avec_titre=False)
        corps = []
        if reste:
            corps += [f'*{reste}*', '']
            if re.match(r'^\(Temple [^()]*\)$', reste):
                aliases.append(reste[1:-1])
        corps += texte
        if voir_aussi:
            corps += ['', '## Voir aussi', ''] + [f'- {self.lien(t)}' for t in voir_aussi]
        return self.page(nom, corps, tags, resume=premiere_phrase(texte), aliases=aliases)

    def construire(self):
        parties = {n['titre']: n for n in self.racine['enfants']}
        inconnues = [t for t in parties if t not in PARTIES]
        if inconnues or self.racine['lignes'] and any(l.strip() for l in self.racine['lignes']):
            raise ValueError(f'parties inattendues dans le document : {inconnues}')
        sommaire = []   # (partie, [(titre de page, profondeur dans le sommaire)])
        for partie in self.racine['enfants']:
            tag = PARTIES[partie['titre']]
            fabrique = {
                'Au début …': self.au_debut, 'Les Divinités': self.divinites, 'Temples/Cultes/Guildes': self.temples,
                'Les races non-jouable': self.races, 'Les Civilisations': self.civilisations,
                'Les Outils Légendaires, Uniques': self.outils, 'GLOSSAIRE': self.glossaire,
            }.get(partie['titre'])
            entrees = fabrique(partie, tag) if fabrique and not vide(partie) else []
            sommaire.append((partie['titre'], entrees))
        self.codex(sommaire)
        return self

    # -- parties ------------------------------------------------------------------------------------------------------
    def au_debut(self, partie, tag):
        entrees = []
        for section in partie['enfants']:
            if not vide(section):
                entrees.append((self.entite(section, [tag])['titre'], 0))
        return entrees

    def divinites(self, partie, tag):
        corps = corps_markdown(partie['lignes'])
        entrees = []
        for groupe in partie['enfants']:
            if vide(groupe):
                continue
            liste = []
            gtag = GROUPES_DE_DIVINITES.get(groupe['titre'])
            if not groupe['enfants']:
                # Force créatrice / destructrice : le nom est dans la première ligne « ***Force Créatrice — Tofrom*** »
                lignes = groupe['lignes']
                debut = next(i for i, l in enumerate(lignes) if l.strip())
                m = PSEUDO.match(lignes[debut])
                if not m:
                    raise ValueError(f'{groupe["titre"]} : nom de la divinité introuvable')
                noeud = dict(titre=nettoyer_titre(m.group(1)), niveau=groupe['niveau'] + 1, lignes=lignes[debut + 1:], enfants=[])
                p = self.entite(noeud, [tag, gtag])
                p['resume'] = nom_et_reste(noeud['titre'])[1] or p['resume']
                liste.append((p['titre'], p['resume']))
            for divinite in groupe['enfants']:
                if vide(divinite):
                    continue
                p = self.entite(divinite, [tag, gtag])
                p['resume'] = nom_et_reste(divinite['titre'])[1] or p['resume']
                liste.append((p['titre'], p['resume']))
            corps += ['', f'## {groupe["titre"]}', ''] + [f'- [[{t}]] — {r}' for t, r in liste]
            entrees += [(t, 1) for t, _ in liste]
        self.page('Les Divinités', corps, [tag], resume='Le panthéon de Maverick : forces créatrice et destructrice, dieux primordiaux, dieux et autres êtres divins.')
        return [('Les Divinités', 0)] + entrees

    def temples(self, partie, tag):
        corps = corps_markdown(partie['lignes'])
        entrees = []
        for section in partie['enfants']:
            if vide(section):
                continue
            if not section['enfants']:
                corps += [''] + rendre(section, 2)   # « Quelques définitions », « Création » : texte du sommaire
                continue
            if section['titre'].startswith('Magie') and section['titre'] not in MAGIES:
                raise ValueError(f'section de magie inconnue : {section["titre"]!r} (MAGIES)')
            magie = MAGIES.get(section['titre'])
            liste = []
            for ordre in section['enfants']:
                if vide(ordre):
                    continue
                p = self.entite(ordre, [tag, magie])
                reste = nom_et_reste(ordre['titre'])[1]
                liste.append(f'- [[{p["titre"]}]]' + (f' {reste}' if reste else ''))
                entrees.append((p['titre'], 1))
            corps += ['', f'## {section["titre"]}', ''] + rendre(dict(section, enfants=[]), 2, avec_titre=False)
            if corps[-1]:
                corps.append('')
            corps += liste
        self.page('Temples/Cultes/Guildes', corps, [tag], resume='Les temples, cultes et guildes de Maverick, rangés par magie, et les grades des croisés.')
        return [('Temples/Cultes/Guildes', 0)] + entrees

    def races(self, partie, tag):
        corps = corps_markdown(partie['lignes'])
        liste = [self.entite(race, [tag])['titre'] for race in partie['enfants'] if not vide(race)]
        corps += [''] + [f'- [[{t}]]' for t in liste]
        self.page(partie['titre'], corps, [tag])
        return [(partie['titre'], 0)] + [(t, 1) for t in liste]

    def civilisations(self, partie, tag):
        corps = corps_markdown(partie['lignes']) + ['']
        entrees = []
        for continent in partie['enfants']:
            if vide(continent):
                corps.append(f'- {continent["titre"]}')   # Enhor, Engrevua, Désert Doré, Golopa : un nom sans texte
                continue
            ctag = continent['titre'].lower()
            liste, noms = [], []
            for region in continent['enfants']:
                if vide(region):
                    continue
                renvoi = self._renvoi(region)
                if renvoi:
                    liste.append(f'- {self.lien_renvoi(renvoi)}')
                    continue
                sous = [e for e in region['enfants'] if not vide(e)] if nom_et_reste(region['titre'])[0] in TERRITOIRES else []
                paragraphes = [l.strip() for l in region['lignes'] if l.strip()]
                if sous and len(paragraphes) <= 1:
                    # « Empire Humain » de Mrode : une phrase, puis ses territoires (une page chacun)
                    pages = [self.entite(s, [tag, ctag])['titre'] for s in sous]
                    liste.append(f'- {region["titre"]}' + (f' : {paragraphes[0]}' if paragraphes else ''))
                    liste += [f'  - [[{t}]]' for t in pages]
                    noms += [(t, 2) for t in pages]
                elif sous:
                    # « Empire Humain (Avant 1145) » d'Erisia : sa page, et une page par royaume (provinces en sections)
                    titres = [nom_et_reste(s['titre'])[0] for s in sous]
                    p = self.entite(dict(region, enfants=[]), [tag, ctag], voir_aussi=titres)
                    pages = [self.entite(s, [tag, ctag])['titre'] for s in sous]
                    liste.append(f'- [[{p["titre"]}]]')
                    liste += [f'  - [[{t}]]' for t in pages]
                    noms += [(p['titre'], 2)] + [(t, 3) for t in pages]
                else:
                    p = self.entite(region, [tag, ctag])
                    liste.append(f'- [[{p["titre"]}]]')
                    noms.append((p['titre'], 2))
            self.page(continent['titre'], corps_markdown(continent['lignes']) + [''] + liste, [tag, ctag])
            corps.append(f'- [[{continent["titre"]}]]')
            entrees += [(continent['titre'], 1)] + noms
        self.page('Les Civilisations', corps, [tag])
        return [('Les Civilisations', 0)] + entrees

    @staticmethod
    def _renvoi(region):
        texte = [l.strip() for l in region['lignes'] if l.strip()]
        if not region['enfants'] and len(texte) == 1:
            m = re.match(r'^Voir “(.+)” pour plus d’information$', texte[0])
            if m:
                return m.group(1)
        return None

    def lien_renvoi(self, titre):
        cible = RENVOIS.get(titre, titre)
        return f'[[{cible}]]' if cible == titre else f'[[{cible}|{titre}]]'

    def outils(self, partie, tag):
        corps = corps_markdown(partie['lignes'])
        entrees = []
        for section in partie['enfants']:
            if vide(section):
                continue
            stag = 'arme' if section['titre'] == 'Armes' else None
            liste = [self.entite(objet, [tag, stag])['titre'] for objet in section['enfants'] if not vide(objet)]
            corps += ['', f'## {section["titre"]}', ''] + rendre(dict(section, enfants=[]), 2, avec_titre=False)
            if corps[-1]:
                corps.append('')
            # un objet dont la section n'est qu'un gabarit vide (Dague des zéphires, Lame de fer) : son nom, sans page
            corps += [f'- [[{nom_et_reste(o["titre"])[0]}]]' if not vide(o) else f'- {o["titre"]}' for o in section['enfants']]
            entrees += [(t, 1) for t in liste]
        self.page(partie['titre'], corps, [tag], resume='Les armes et objets légendaires ou uniques de Maverick.')
        return [(partie['titre'], 0)] + entrees

    def glossaire(self, partie, tag):
        noeud = dict(partie, titre='Glossaire')
        return [(self.page('Glossaire', rendre(noeud, 2, avec_titre=False), [tag])['titre'], 0)]

    def codex(self, sommaire):
        corps = ['Le Codex reprend le Google Doc « CODEX Maverick » : une page par section du document, dans son ordre. '
                 'Une partie vide du document est signalée comme telle.']
        for partie, entrees in sommaire:
            corps += ['', f'## {nettoyer_titre(partie)}', '']
            if not entrees:
                corps.append('*Partie vide dans le document (relevé du 2026-10-11).*')
                continue
            corps += ['  ' * (profondeur - min(p for _, p in entrees)) + f'- {self.lien(t)}' for t, profondeur in entrees]
        self.page('Codex', corps, [], resume='Sommaire du Codex de Maverick : histoire du monde, divinités, temples et guildes, races non jouables, '
                                              'civilisations, outils légendaires et glossaire.')


# --------------------------------------------------------------------------------------------------------------------
# Écriture et vérification
# --------------------------------------------------------------------------------------------------------------------
def texte_de_page(p):
    entete = pages_md.emit_frontmatter(dict(titre=p['titre'], aliases=p['aliases'], tags=p['tags'], resume=p['resume'], sources=SOURCES, statut='draft'))
    return entete + '\n' + '\n'.join(p['corps']) + '\n'


def du_codex(chemin):
    with open(chemin, encoding='utf-8') as f:
        data, _ = pages_md.parse_frontmatter(f.read())
    return (data.get('sources') or [None])[0] == SOURCES[0]


def vocabulaire(chemin=VOCABULAIRE, historique=HISTORIQUE, schema=SCHEMA):
    """Les mots-clés qu'une page du Codex peut porter : une fonction écriture -> libellé du mot-clé du vocabulaire (data/rows/mot_cle.sql) qu'elle
    désigne, ou None. Même règle que l'import des pages (tools/db/maverick.py#mot_cle, historique du site de dev compris : une écriture qu'un mot-clé
    renommé a quittée mène à lui) : un import ne crée jamais de mot-clé (migration 0056), db:sync-pages ne poserait pas une écriture inconnue."""
    with open(schema, encoding='utf-8') as f:
        texte = f.read()
    db = sqlite3.connect(':memory:')
    for table in ('mot_cle', 'historique_modification'):
        db.execute(re.search(rf'CREATE TABLE {table} \([\s\S]*?\) STRICT;', texte).group(0))
    for fichier in (chemin, historique):
        if os.path.exists(fichier):
            with open(fichier, encoding='utf-8') as f:
                db.executescript(f.read())

    def libelle(ecriture):
        ident = T.mot_cle(db, ecriture)
        return db.execute('SELECT libelle FROM mot_cle WHERE id = ?', (ident,)).fetchone()[0] if ident else None
    return libelle


def pages_du_site(historique=HISTORIQUE, schema=SCHEMA, sur_disque=None):
    """Pages du Codex que le site de dev a modifiées (modifications rapatriées ou livrées : table historique_modification) -> slug -> leur état
    d'import : 'titre' et 'corps' (corps_md) = la valeur « avant » de la première modification de la colonne (absents : jamais modifiés), 'alias'
    = {'retires': textes que le site a ajoutés, 'remis': textes qu'il a supprimés}. Même lecture que client/src/lib/historique-site.mjs.
    Les mots-clés (vocabulaire mot_cle, migration 0043) : une page dont le site a retiré, fusionné (page_tag) ou renommé (mot_cle : son écriture est
    dans `tags:` des pages sur disque, `sur_disque` = slug -> texte) un mot-clé est aussi « modifiée par le site » ('mots_cles' : True) ; ses mots-clés
    ne sont pas comparés au document, et une nouvelle écriture la garde telle quelle (sinon elle remettrait l'ancienne écriture)."""
    if not os.path.exists(historique):
        return {}
    with open(schema, encoding='utf-8') as f:
        table = re.search(r'CREATE TABLE historique_modification \([\s\S]*?\) STRICT;', f.read()).group(0)
    db = sqlite3.connect(':memory:')
    db.execute(table)
    with open(historique, encoding='utf-8') as f:
        db.executescript(f.read())
    pages = {}
    vues = set()
    nouvelle = lambda slug: pages.setdefault(slug, {'alias': {'retires': set(), 'remis': set()}})  # noqa: E731
    renommes = set()   # écritures (normalize) qu'un mot-clé a prises sur le site
    for table_nom, cle, avant, apres in db.execute(
            "SELECT table_nom, cle, avant, apres FROM historique_modification WHERE table_nom IN ('page_tag', 'mot_cle') ORDER BY fait_le, lot_id, rang"):
        cle = json.loads(cle)
        if table_nom == 'page_tag':
            if str(cle.get('page_id')).startswith(f'{TYPE}/'):
                nouvelle(cle['page_id'][len(TYPE) + 1:])['mots_cles'] = True
        elif apres and 'libelle' in json.loads(apres):
            renommes.add(T.normalize(json.loads(apres)['libelle']))
    for slug, texte in (sur_disque or {}).items():
        if renommes & {T.normalize(t) for t in pages_md.parse_frontmatter(texte)[0].get('tags') or []}:
            nouvelle(slug)['mots_cles'] = True
    for table_nom, cle, operation, avant, apres in db.execute(
            "SELECT table_nom, cle, operation, avant, apres FROM historique_modification WHERE table_nom IN ('page', 'alias') ORDER BY fait_le, lot_id, rang"):
        cle = json.loads(cle)
        page_id = cle.get('id') if table_nom == 'page' else cle.get('page_id')
        if not str(page_id).startswith(f'{TYPE}/'):
            continue
        p = nouvelle(page_id[len(TYPE) + 1:])
        avant, apres = json.loads(avant or 'null'), json.loads(apres or 'null')
        if table_nom == 'page':
            for colonne, nom in (('titre', 'titre'), ('corps_md', 'corps')):
                if avant and colonne in avant and nom not in p:
                    p[nom] = avant[colonne]
            continue
        k = json.dumps(cle, sort_keys=True)
        if k in vues:                                    # seule la première modification d'un alias dit ce qu'il était à l'import
            continue
        vues.add(k)
        if operation == 'inserer':
            p['alias']['retires'].add(apres['texte'])
        elif operation == 'supprimer':
            p['alias']['remis'].add(avant['texte'])
        elif avant.get('texte') != apres.get('texte'):
            p['alias']['retires'].add(apres['texte'])
            p['alias']['remis'].add(avant['texte'])
    return pages


def etat_d_import(texte, site, sans_mots_cles=False):
    """(frontmatter, corps) d'une page sur disque, ramenée à son état d'import (pages_du_site) ; les alias en liste triée. Ses mots-clés retirés si le
    site les a changés (`site['mots_cles']`, ou `sans_mots_cles` pour la page attendue en face)."""
    data, corps = pages_md.parse_frontmatter(texte)
    data = dict(data)
    if sans_mots_cles or (site and site.get('mots_cles')):
        data.pop('tags', None)
    if site:
        if 'titre' in site:
            data['title'] = site['titre']
        if 'corps' in site:
            corps = '\n' + site['corps']             # le fichier : en-tête, ligne vide, corps_md (tools/db/pages_md.py)
        data['aliases'] = (set(data.get('aliases', [])) - site['alias']['retires']) | site['alias']['remis']
    data['aliases'] = sorted(data.get('aliases', []))
    return data, corps


def ecrire(codex, out, site):
    dossier = os.path.join(out, TYPE)
    os.makedirs(dossier, exist_ok=True)
    for slug in codex.ordre:
        chemin = os.path.join(dossier, f'{slug}.md')
        if os.path.exists(chemin) and not du_codex(chemin):
            raise SystemExit(f'refusé : {TYPE}/{slug} existe et ne vient pas du CODEX')
    ecrites = 0
    for slug in codex.ordre:
        chemin = os.path.join(dossier, f'{slug}.md')
        if slug in site and os.path.exists(chemin):
            print(f'  gardée telle que le site de dev l\'a modifiée : {TYPE}/{slug} (--verifier dit si le document a changé depuis)')
            continue
        texte = texte_de_page(codex.pages[slug])
        if os.path.exists(chemin) and open(chemin, encoding='utf-8').read() == texte:
            continue
        with open(chemin, 'w', encoding='utf-8', newline='\n') as f:
            f.write(texte)
        ecrites += 1
    orphelines = sorted(f[:-3] for f in os.listdir(dossier) if f.endswith('.md') and f[:-3] not in codex.pages and du_codex(os.path.join(dossier, f)))
    print(f'{len(codex.ordre)} pages du Codex ({ecrites} écrites) dans {dossier}')
    for slug in orphelines:
        print(f'  orpheline (plus produite, non supprimée) : {TYPE}/{slug}')


def normaliser(texte):
    t = texte.replace('\\', '')
    t = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', t)
    t = re.sub(r'[*#]', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def pages_sur_disque(out):
    """Les pages du Codex sur disque : slug -> texte (fichier .md)."""
    dossier = os.path.join(out, TYPE)
    pages = {}
    if not os.path.isdir(dossier):
        return pages
    for nom in sorted(os.listdir(dossier)):
        chemin = os.path.join(dossier, nom)
        if nom.endswith('.md') and du_codex(chemin):
            with open(chemin, encoding='utf-8') as f:
                pages[nom[:-3]] = f.read()
    return pages


def verifier(lignes, out, site, vocabulaire=None):
    """Contrôles indépendants du découpage (voir l'en-tête), les pages modifiées par le site de dev dans leur état d'import, leurs mots-clés ceux du
    vocabulaire (Codex(…, vocabulaire)). -> (erreurs, nombre de pages, nombre de pages modifiées par le site)."""
    pages = pages_sur_disque(out)
    a_l_import = {slug: etat_d_import(t, site.get(slug)) for slug, t in pages.items()}
    erreurs = []
    tout = '\n'.join(normaliser(corps) for _, corps in a_l_import.values())
    titres = set()
    for data, corps in a_l_import.values():
        titres |= {normaliser(data['title'])} | {normaliser(a) for a in data.get('aliases', [])}
        titres |= {normaliser(m) for m in re.findall(r'^#{1,6} (.*)$', corps, flags=re.M)}
    absentes = 0
    for i, ligne in enumerate(lignes, 1):
        if not ligne.strip() or IMAGE.match(ligne) or REF_IMAGE.match(ligne) or re.fullmatch(r'\s*(\* )?\*\*[^*]+:\*\*\s*', ligne):
            continue   # ligne vide, image, champ sans valeur (« **Type :** » d'un gabarit à remplir)
        m = TITRE.match(ligne) or PSEUDO.match(ligne)
        if m:
            titre = nettoyer_titre(m.group(m.lastindex))
            if titre:
                parts = [normaliser(x) for x in re.split(r' — | - ', titre)]
                parts[-1:] = [normaliser(x) for x in re.split(r' (?=\()', parts[-1])]
                if not (normaliser(titre) in titres or parts[0] in titres or normaliser(titre) in tout or all(p in tout or p in titres for p in parts)):
                    erreurs.append(f'(2) titre absent des pages, ligne {i} : {titre!r}')
            continue
        renvoi = re.match(r'^Voir “(.+)” pour plus d’information$', ligne.strip())
        if renvoi:
            ligne = renvoi.group(1)   # un renvoi du document devient un lien vers la page qu'il nomme
        texte = normaliser(re.sub(r'^\s*(\\-|[*+-]|\d+\.)\s', '', ligne))
        if texte and texte not in tout and texte not in titres:
            absentes += 1
            if absentes <= 20:
                erreurs.append(f'(1) ligne absente des pages, ligne {i} : {ligne.strip()[:100]!r}')
    if absentes > 20:
        erreurs.append(f'(1) … {absentes} lignes absentes au total')
    attendu = Codex(lignes, vocabulaire).construire()
    for slug in sorted(set(attendu.pages) | set(pages)):
        if slug not in pages:
            erreurs.append(f'(3) page manquante sur disque : {TYPE}/{slug}')
        elif slug not in attendu.pages:
            erreurs.append(f'(3) page en trop sur disque : {TYPE}/{slug}')
        elif slug in site:
            if a_l_import[slug] != etat_d_import(texte_de_page(attendu.pages[slug]), None, site[slug].get('mots_cles', False)):
                erreurs.append(f'(3) page modifiée par le site de dev, différente du découpage dans son état d\'import : {TYPE}/{slug}')
        elif pages[slug] != texte_de_page(attendu.pages[slug]):
            erreurs.append(f'(3) page différente du découpage : {TYPE}/{slug}')
    return erreurs, len(pages), len(set(site) & set(pages))


def main(argv):
    option = lambda nom, defaut: argv[argv.index(nom) + 1] if nom in argv else defaut  # noqa: E731
    source = option('--source', SOURCE)
    out = option('--out', OUT)
    site = pages_du_site(option('--historique', HISTORIQUE), sur_disque=pages_sur_disque(out))
    voc = vocabulaire(option('--vocabulaire', VOCABULAIRE), option('--historique', HISTORIQUE))
    lignes = lire_lignes(source)
    if '--verifier' in argv:
        erreurs, n, du_site = verifier(lignes, out, site, voc)
        for e in erreurs:
            print(e)
        if erreurs:
            print(f'{len(erreurs)} écart(s) entre le CODEX et ses {n} pages')
            return 1
        print(f'{n} pages du Codex conformes au document' + (f' ({du_site} modifiées depuis par le site de dev, contrôlées dans leur état d\'import)' if du_site else ''))
        return 0
    ecrire(Codex(lignes, voc).construire(), out, site)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
