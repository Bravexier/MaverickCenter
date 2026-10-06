#!/usr/bin/env python3
"""Famille « relations entre les races » : UNE page lore, `<out>/lore/relations-entre-les-races.md`.

Usage (bibliothèque standard uniquement ; relançable, même fichier à l'identique) :

    python3 -I tools/sheets/relations-races.py --dump <les-races-annexes.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki
    python3 -I tools/sheets/relations-races.py --verifier --dump <les-races-annexes.json> --out <même dossier>

Le dump JSON uniforme (tools/sheets/sheets_api_to_json.py) doit contenir l'onglet « Relation entre les races » COMPLET
du classeur « Les races » (la copie de cet onglet dans le dump principal du classeur est tronquée : le script s'arrête
dessus, voir « Arrêts »). Les cellules sont une donnée non fiable : elles ne sont jamais exécutées, seulement copiées
(échappées pour le Markdown). Rien n'est calculé, corrigé ni complété : les noms sont ceux de l'onglet (coquilles
comprises : « Supprémaciste », « Ubain », « Echelle »), seuls les retours à la ligne et espaces multiples sont réduits
à une espace.

Disposition de l'onglet (cellules fusionnées 4 colonnes x 4 lignes ; coordonnées à partir de 1) :
  B3            titre « Echelle de relation » (fusion B3:AG4) ;
  B5, F5 ... AD5 l'échelle, de gauche à droite : Même peuple, Alliée, Appréciée, Acceptée, Neutre, Évitée, Haine, Ennemie ;
  A19           légende (fusion A19:D22) : « Verticale = Comment le peuple voit les autres / Horizontale = Comment le peuple
                est vu par les autres » ;
  E19, I19 ...  étiquettes du HAUT (une par peuple, colonne 5 + 4 j) ; A23, A27 ... étiquettes de GAUCHE (ligne 23 + 4 i) ;
  E23 ...       la matrice : la cellule (ligne i, colonne j) est une valeur de l'échelle.
  Le tout est ENCADRÉ : après les N peuples, une dernière ligne et une dernière colonne répètent les étiquettes (bas et
  droite) et la légende occupe les quatre coins. Dans cet onglet N = 69 peuples (et non 70 : la 70e ligne et la 70e colonne
  sont ce cadre), donc 69 x 69 = 4761 relations ; 5050 cellules au total, toutes reconnues, 5050 fusions attendues.

Sens (légende de l'onglet) : la VERTICALE (étiquettes de gauche, une ligne par peuple) = « Comment le peuple voit les
autres » ; l'HORIZONTALE (étiquettes du haut, une colonne par peuple) = « Comment le peuple est vu par les autres ».
La cellule (ligne A, colonne B) dit donc comment A voit B (= comment B est vu par A). La matrice n'est PAS supposée
symétrique (elle ne l'est pas : voir le rapport) ; la relation d'un peuple à lui-même (diagonale) doit être « Même peuple ».

Page produite (status draft ; tags « relations », « peuples », « race » ; sources : libellé ET URL du classeur) :
  frontmatter ; paragraphes de lecture (nombre de peuples, sens des sections, asymétrie) ; « Légende » (les deux lignes
  telles qu'écrites) ; « Echelle de relation » (les huit niveaux dans l'ordre de l'onglet) ; « Les peuples de l'onglet »
  (rapprochement avec les pages `races/*.md`, voir plus bas) ; puis, pour chaque peuple dans l'ordre de l'onglet, une
  section « Nom du peuple : comment ce peuple voit les autres » : une ligne `- **niveau** : peuples` par niveau, dans
  l'ordre de l'échelle (du plus favorable au plus défavorable), les peuples dans l'ordre de l'onglet ; un niveau sans
  peuple n'est pas écrit. Les 69 x 69 relations y figurent, chacune une fois (la section d'un peuple le range lui-même
  sous « Même peuple »). Aucun lien [[…]] : le maillage automatique (`npm run autolink`) les ajoutera ; le vérificateur
  les ignore (il lit `[[T]]` et `[[T|texte]]` comme le texte affiché), mais ce script réécrit la page sans eux.

Rapprochement avec les pages de races (informatif, jamais un lien) : un peuple est rangé sous la page `races/*.md` (hors
`status: example`) dont le titre, comparé comme le wiki (minuscules, sans accents ni apostrophes), COMMENCE son nom
(« Humain Central » -> « Humain ») ; si zéro ou plusieurs pages conviennent, le peuple reste en texte brut dans une phrase
à part. Une phrase signale les races du wiki sans aucun peuple dans l'onglet (leurs relations ne sont pas dans la source).

Contrôle (option --verifier, écrite et essayée AVANT l'implémentation de l'écriture ; n'écrit rien) :
  1. relit l'onglet par DEUX chemins indépendants (coordonnées calculées + étiquettes ; plages fusionnées) qui doivent
     donner la même échelle, les mêmes peuples et la même matrice ;
  2. reconstruit la matrice N x N DEPUIS LA PAGE (chaque relation d'une ligne `- **niveau** : peuples`) et la compare
     cellule par cellule à l'onglet, sans supposer de symétrie ; compare aussi frontmatter, légende, échelle, ordre des
     peuples, rapprochement, et le texte entier à celui que le script écrirait (liens [[…]] ôtés) ;
  3. rejoue des cas d'erreur sur des copies modifiées de l'onglet et de la page : chacun doit être détecté.
  Code de sortie non nul au moindre écart. Le même contrôle (points 1 et 2) est refait après l'écriture.

Arrêts (message sur la sortie d'erreur, code non nul, RIEN d'écrit) : cellule non textuelle ; case de la matrice vide ;
valeur hors de l'échelle ; ethnie inconnue (étiquette du haut, de gauche, du bas ou de la droite qui diffère des autres,
nom en double, nom contenant « , » ou « : ») ; diagonale différente de « Même peuple » ; légende des quatre coins
différente ; cellule non reconnue ; fusions différentes des 4 x 4 attendus ; page existante non issue de cet onglet ;
titre déjà porté par une autre page du wiki.

Rapport (sortie standard) : page écrite ou inchangée, effectifs par niveau, rapprochement (peuples par race, sans
rapprochement, races sans peuple), asymétrie (paires dont les deux sens diffèrent), résultat du contrôle après écriture.
"""
import argparse
import copy
import json
import os
import re
import sys
import unicodedata

CATEGORY = "lore"
PAGE_TITLE = "Relations entre les races"
STATUS = "draft"
TAGS = ["relations", "peuples", "race"]

BOOK_TITLE = "Les races"
BOOK_ID = "1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4"
TAB = "Relation entre les races"
SOURCES = [
    "Google Sheet « %s », onglet « %s »" % (BOOK_TITLE, TAB),
    "https://docs.google.com/spreadsheets/d/%s/edit" % BOOK_ID,
]

# Disposition de l'onglet (voir la docstring).
STEP = 4                      # lignes/colonnes par peuple (cellules fusionnées 4 x 4)
SCALE_TITLE = (3, 2)          # B3
SCALE_ROW, SCALE_COL0 = 5, 2  # B5, F5, J5 ...
LEGEND = (19, 1)              # A19
LABEL_ROW, LABEL_COL0 = 19, 5  # E19, I19 ... : étiquettes du haut
LABEL_COL, MATRIX_ROW0 = 1, 23  # A23, A27 ... : étiquettes de gauche
SELF_LEVEL = "Même peuple"    # relation d'un peuple à lui-même (diagonale)
SECTION_SUFFIX = " : comment ce peuple voit les autres"
GROUPS_HEADING = "Les peuples de l'onglet"
LEGEND_HEADING = "Légende"
UNMATCHED_PREFIX = "Peuples sans page de race rapprochée sans ambiguïté : "
ABSENT_PREFIX = "Races du wiki sans peuple dans l'onglet : "
MIN_REPLAY_PEOPLE = 4         # en dessous, les cas d'erreur rejoués n'ont pas de sens


class Stop(Exception):
    """Contrôle en échec : le script s'arrête (code de sortie non nul) et n'écrit rien."""


# --------------------------------------------------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------------------------------------------------

def col_letters(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def ref(r, c):
    return "%s%d" % (col_letters(c), r)


def block(r, c):
    """Plage fusionnée 4 x 4 dont la cellule en haut à gauche est (r, c)."""
    return "%s:%s" % (ref(r, c), ref(r + STEP - 1, c + STEP - 1))


def parse_range(rng):
    m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", rng)
    if not m:
        raise Stop("plage fusionnée invalide : %r" % (rng,))

    def num(s):
        n = 0
        for ch in s:
            n = n * 26 + ord(ch) - 64
        return n

    return num(m[1]), int(m[2]), num(m[3]), int(m[4])


def norm_ws(text):
    """Texte sur une ligne : retours à la ligne et espaces multiples réduits à une espace (rien d'autre n'est changé)."""
    return " ".join(str(text).split())


def legend_lines(text):
    return [norm_ws(line) for line in str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n") if line.strip()]


def normalize(value):
    """Clé de comparaison identique à celle du wiki (client/src/lib/text.mjs) : minuscules, sans accents ni apostrophes."""
    text = unicodedata.normalize("NFD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"['’]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


def esc(s):
    """Échappe un texte d'une ligne pour le Markdown (inverse : unesc). Aucune URL n'est attendue dans cet onglet."""
    s = str(s).replace("\\", "\\\\")
    s = re.sub(r"([`*_\[\]<~])", r"\\\1", s)
    s = re.sub(r"&(?=#?\w+;)", r"\\&", s)
    s = re.sub(r"^(\s*)>", r"\1\\>", s)
    s = re.sub(r"^(\s*)(#{1,6})(?=\s|$)", r"\1\\\2", s)
    s = re.sub(r"^(\s*)([-+])(?=\s|$)", r"\1\\\2", s)
    s = re.sub(r"^(\s*)(\d+)([.)])(?=\s|$)", r"\1\2\\\3", s)
    return s


def unesc(s):
    return re.sub(r"\\(.)", r"\1", s)


def unwrap_links(text):
    """`[[Titre]]` et `[[Titre|texte]]` (posés par le maillage automatique) -> texte affiché."""
    text = re.sub(r"\[\[([^\[\]|]*)\|([^\[\]]*)\]\]", r"\2", text)
    return re.sub(r"\[\[([^\[\]|]*)\]\]", r"\1", text)


# --------------------------------------------------------------------------------------------------------------------
# Lecture de l'onglet (chemin 1 : coordonnées calculées)
# --------------------------------------------------------------------------------------------------------------------

def find_tab(dump_path):
    with open(dump_path, encoding="utf-8") as fh:
        dump = json.load(fh)
    tabs = [s for s in dump["sheets"] if s["name"] == TAB]
    if len(tabs) != 1:
        raise Stop("%s : %d onglet(s) « %s » (un seul attendu)" % (dump_path, len(tabs), TAB))
    return tabs[0]


def read_tab(raw):
    """{title, scale, legend, people, matrix} depuis l'onglet brut ; Stop au moindre défaut (rien n'est corrigé)."""
    cells = {}
    for c in raw["cells"]:
        v = c["v"]
        if v is None or (isinstance(v, str) and not v.strip()):
            continue
        if not isinstance(v, str):
            raise Stop("%s : valeur non textuelle en %s : %r" % (TAB, ref(c["r"], c["c"]), v))
        key = (c["r"], c["c"])
        if key in cells:
            raise Stop("%s : cellule %s en double" % (TAB, ref(*key)))
        cells[key] = v
    used = set()

    def take(r, c):
        if (r, c) in cells:
            used.add((r, c))
        return cells.get((r, c))

    # Échelle
    title = take(*SCALE_TITLE)
    if title is None:
        raise Stop("%s : titre de l'échelle (%s) absent" % (TAB, ref(*SCALE_TITLE)))
    scale = []
    c = SCALE_COL0
    while (SCALE_ROW, c) in cells:
        scale.append(norm_ws(take(SCALE_ROW, c)))
        c += STEP
    if len(scale) < 2 or len(set(scale)) != len(scale) or SELF_LEVEL not in scale:
        raise Stop("%s : échelle %s inattendue (au moins deux niveaux distincts dont « %s »)" % (TAB, scale, SELF_LEVEL))

    # Légende (A19) et peuples (étiquettes du haut jusqu'à la légende répétée dans le coin)
    legend_cell = take(*LEGEND)
    if legend_cell is None:
        raise Stop("%s : légende (%s) absente" % (TAB, ref(*LEGEND)))
    legend_key = norm_ws(legend_cell)
    people = []
    j = 0
    while True:
        v = cells.get((LABEL_ROW, LABEL_COL0 + STEP * j))
        if v is None:
            raise Stop("%s : l'axe du haut s'arrête en %s sans retrouver la légende (onglet tronqué ?)" % (
                TAB, ref(LABEL_ROW, LABEL_COL0 + STEP * j)))
        if norm_ws(v) == legend_key:
            break
        people.append(norm_ws(take(LABEL_ROW, LABEL_COL0 + STEP * j)))
        j += 1
    n = len(people)
    if n < 2:
        raise Stop("%s : %d peuple(s) seulement" % (TAB, n))
    keys = [normalize(p) for p in people]
    if len(set(keys)) != n:
        raise Stop("%s : noms de peuples en double : %s" % (TAB, sorted({p for p in people if keys.count(normalize(p)) > 1})))
    for p in people:
        if not p or ", " in p or " : " in p or "[[" in p or "://" in p:
            raise Stop("%s : nom de peuple inutilisable : %r" % (TAB, p))
    last_row, last_col = MATRIX_ROW0 + STEP * n, LABEL_COL0 + STEP * n

    # Les quatre coins répètent la légende ; les quatre bords portent les mêmes étiquettes dans le même ordre
    for corner in ((LABEL_ROW, last_col), (last_row, LABEL_COL), (last_row, last_col)):
        v = take(*corner)
        if v is None or norm_ws(v) != legend_key:
            raise Stop("%s : légende du coin %s absente ou différente de %s" % (TAB, ref(*corner), ref(*LEGEND)))

    def check_axis(label, positions):
        for idx, (r, c) in enumerate(positions):
            v = take(r, c)
            if v is None:
                raise Stop("%s : étiquette %s (%s) vide" % (TAB, label, ref(r, c)))
            if norm_ws(v) != people[idx]:
                kind = "dans un autre ordre" if norm_ws(v) in people else "ethnie inconnue"
                raise Stop("%s : étiquette %s %s (%s) = %r, attendu %r : %s" % (
                    TAB, label, idx + 1, ref(r, c), norm_ws(v), people[idx], kind))

    check_axis("de gauche", [(MATRIX_ROW0 + STEP * i, LABEL_COL) for i in range(n)])
    check_axis("du bas", [(last_row, LABEL_COL0 + STEP * j) for j in range(n)])
    check_axis("de droite", [(MATRIX_ROW0 + STEP * i, last_col) for i in range(n)])

    # Matrice
    matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            r, c = MATRIX_ROW0 + STEP * i, LABEL_COL0 + STEP * j
            v = take(r, c)
            if v is None:
                raise Stop("%s : case vide en %s (%s voit %s)" % (TAB, ref(r, c), people[i], people[j]))
            level = norm_ws(v)
            if level not in scale:
                raise Stop("%s : valeur hors échelle en %s (%s voit %s) : %r" % (TAB, ref(r, c), people[i], people[j], level))
            row.append(level)
        if row[i] != SELF_LEVEL:
            raise Stop("%s : la diagonale de %s vaut %r, attendu « %s »" % (TAB, people[i], row[i], SELF_LEVEL))
        matrix.append(row)

    # Fusions : exactement celles du modèle 4 x 4 (+ le titre, dont on ne fige pas la taille)
    expected = {block(SCALE_ROW, SCALE_COL0 + STEP * k) for k in range(len(scale))}
    for corner in ((LABEL_ROW, LABEL_COL), (LABEL_ROW, last_col), (last_row, LABEL_COL), (last_row, last_col)):
        expected.add(block(*corner))
    for k in range(n):
        for pos in ((LABEL_ROW, LABEL_COL0 + STEP * k), (MATRIX_ROW0 + STEP * k, LABEL_COL),
                    (last_row, LABEL_COL0 + STEP * k), (MATRIX_ROW0 + STEP * k, last_col)):
            expected.add(block(*pos))
        for j in range(n):
            expected.add(block(MATRIX_ROW0 + STEP * k, LABEL_COL0 + STEP * j))
    title_ranges = {m for m in raw["merged"] if parse_range(m)[:2] == (SCALE_TITLE[1], SCALE_TITLE[0])}
    actual = set(raw["merged"]) - title_ranges
    if actual != expected or len(raw["merged"]) != len(set(raw["merged"])):
        raise Stop("%s : fusions inattendues (%d sans le titre, %d attendues ; manquantes : %s ; en trop : %s)" % (
            TAB, len(actual), len(expected), sorted(expected - actual)[:5], sorted(actual - expected)[:5]))

    left = sorted(set(cells) - used)
    if left:
        raise Stop("%s : cellules non reconnues %s" % (TAB, ", ".join("%s=%r" % (ref(*k), cells[k]) for k in left[:10])))
    return {"title": norm_ws(title), "scale": scale, "legend": legend_lines(legend_cell), "people": people, "matrix": matrix}


# --------------------------------------------------------------------------------------------------------------------
# Lecture de l'onglet (chemin 2, pour le vérificateur : par les plages fusionnées)
# --------------------------------------------------------------------------------------------------------------------

def raw_tab(raw):
    """(échelle, peuples, matrice) autrement : les ancres des plages fusionnées donnent les axes, sans formule de pas."""
    values = {(c["r"], c["c"]): c["v"] for c in raw["cells"]}
    anchors = []
    for m in raw["merged"]:
        c1, r1, c2, r2 = parse_range(m)
        if (r2 - r1 + 1, c2 - c1 + 1) == (STEP, STEP):
            anchors.append((r1, c1))
    scale_cols = sorted(c for r, c in anchors if r == SCALE_ROW)
    col_axis = sorted(c for r, c in anchors if r == LABEL_ROW and c >= LABEL_COL0)
    row_axis = sorted(r for r, c in anchors if c == LABEL_COL and r >= MATRIX_ROW0)
    if len(col_axis) != len(row_axis) or len(col_axis) < 3:
        raise Stop("lecture par fusions : axes de longueurs %d et %d" % (len(col_axis), len(row_axis)))
    n = len(col_axis) - 1                      # le dernier élément de chaque axe est le cadre
    try:
        scale = [norm_ws(values[(SCALE_ROW, c)]) for c in scale_cols]
        people = [norm_ws(values[(r, LABEL_COL)]) for r in row_axis[:n]]
        matrix = [[norm_ws(values[(r, c)]) for c in col_axis[:n]] for r in row_axis[:n]]
    except KeyError as err:
        raise Stop("lecture par fusions : case vide %s" % (err,))
    return scale, people, matrix


# --------------------------------------------------------------------------------------------------------------------
# Lecture de la page (la matrice est reconstruite depuis le texte de la page)
# --------------------------------------------------------------------------------------------------------------------

def split_page(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        raise Stop("page : frontmatter absent")
    front = {}
    for line in m.group(1).split("\n"):
        key, sep, value = line.partition(": ")
        if not sep or key in front:
            raise Stop("page : ligne de frontmatter inattendue %r" % line)
        try:
            front[key] = json.loads(value) if value[:1] in '"[' else value
        except ValueError:
            raise Stop("page : valeur de frontmatter illisible %r" % line)
    return front, text[m.end():]


def parse_page(text):
    """Structure de la page : frontmatter, sections « fixes » et sections de peuples (niveau -> noms). Stop si le
    texte n'a pas la forme attendue ; ne compare pas encore à l'onglet."""
    text = unwrap_links(text)
    if "[[" in text:
        raise Stop("page : « [[ » non apparié")
    front, body = split_page(text)
    sections, current = [], None
    intro = []
    for line in body.split("\n"):
        m = re.match(r"## (.*)$", line)
        if m:
            current = [unesc(m.group(1)), []]
            sections.append(current)
        elif current is None:
            intro.append(line)
        else:
            current[1].append(line)
    fixed = [s for s in sections if not s[0].endswith(SECTION_SUFFIX)]
    people_sections = [s for s in sections if s[0].endswith(SECTION_SUFFIX)]
    if len(fixed) != 3 or sections[:3] != fixed:
        raise Stop("page : trois sections de tête attendues (légende, échelle, peuples), trouvées : %s" % [s[0] for s in fixed])
    parsed = {"front": front, "intro": [l for l in intro if l.strip()], "people": [], "rows": {}}

    legend_name, legend_body = fixed[0]
    parsed["legend_heading"] = legend_name
    parsed["legend"] = [unesc(l[2:]) for l in legend_body if l.strip() and l.startswith("- ")]
    scale_name, scale_body = fixed[1]
    parsed["scale_heading"] = scale_name
    parsed["scale"] = [unesc(l[2:]) for l in scale_body if l.startswith("- ")]
    groups_name, groups_body = fixed[2]
    parsed["groups_heading"] = groups_name
    groups, unmatched, absent = [], None, None
    for line in groups_body:
        if line.startswith("- "):
            title, sep, names = line[2:].partition(" : ")
            if not sep:
                raise Stop("page : ligne de rapprochement illisible %r" % line)
            groups.append((unesc(title), [unesc(n) for n in names.split(", ")]))
        elif line.startswith(UNMATCHED_PREFIX) or line.startswith(ABSENT_PREFIX):
            prefix = UNMATCHED_PREFIX if line.startswith(UNMATCHED_PREFIX) else ABSENT_PREFIX
            if not line.endswith("."):
                raise Stop("page : phrase de rapprochement sans point final %r" % line)
            names = [unesc(n) for n in line[len(prefix):-1].split(", ")]
            if prefix == UNMATCHED_PREFIX:
                unmatched = names
            else:
                absent = names
    parsed["groups"], parsed["unmatched"], parsed["absent"] = groups, unmatched, absent

    for name, lines in people_sections:
        person = unesc(name[:-len(SECTION_SUFFIX)])
        entries = []
        for line in lines:
            if not line.strip():
                continue
            m = re.fullmatch(r"- \*\*(.+?)\*\* : (.+)", line)
            if not m:
                raise Stop("page : %s : ligne de relation illisible %r" % (person, line))
            entries.append((unesc(m.group(1)), [unesc(n) for n in m.group(2).split(", ")]))
        parsed["people"].append(person)
        if person in parsed["rows"]:
            raise Stop("page : section de %s en double" % person)
        parsed["rows"][person] = entries
    return parsed


def page_matrix(parsed, scale, people):
    """Matrice N x N reconstruite depuis les lignes de relation de la page ; Stop pour une case vide, un doublon,
    un niveau hors échelle ou un peuple inconnu."""
    known = set(people)
    for person in parsed["people"]:
        if person not in known:
            raise Stop("page : section d'un peuple inconnu %r" % person)
    missing = [p for p in people if p not in parsed["rows"]]
    if missing:
        raise Stop("page : peuple(s) sans section : %s" % missing[:5])
    matrix = []
    for person in people:
        seen, levels_seen = {}, set()
        for level, names in parsed["rows"][person]:
            if level not in scale:
                raise Stop("page : %s : niveau hors échelle %r" % (person, level))
            if level in levels_seen:
                raise Stop("page : %s : niveau %r écrit deux fois" % (person, level))
            levels_seen.add(level)
            for name in names:
                if name not in known:
                    raise Stop("page : %s : peuple inconnu %r (niveau %s)" % (person, name, level))
                if name in seen:
                    raise Stop("page : %s : %s écrit deux fois (%s et %s)" % (person, name, seen[name], level))
                seen[name] = level
        empty = [p for p in people if p not in seen]
        if empty:
            raise Stop("page : %s : case vide pour %s" % (person, empty[:5]))
        matrix.append([seen[p] for p in people])
    return matrix


def check_page(text, tab, races=None, render=None):
    """Compare le texte d'une page à l'onglet déjà lu (`tab`). Renvoie la liste des écarts (vide = conforme) ; lève Stop
    pour un défaut de structure. Si `render` est donné, le texte entier est aussi comparé à la sortie du script."""
    parsed = parse_page(text)
    problems = []
    front = parsed["front"]
    expected_front = {"title": PAGE_TITLE, "aliases": [], "tags": TAGS, "sources": SOURCES, "status": STATUS}
    if list(front) != ["title", "aliases", "tags", "summary", "sources", "status"]:
        problems.append("frontmatter : champs %s" % list(front))
    for key, want in expected_front.items():
        if front.get(key) != want:
            problems.append("frontmatter : %s = %r, attendu %r" % (key, front.get(key), want))
    if front.get("summary") != summary_text(tab):
        problems.append("frontmatter : summary = %r, attendu %r" % (front.get("summary"), summary_text(tab)))
    if parsed["legend_heading"] != LEGEND_HEADING or parsed["legend"] != tab["legend"]:
        problems.append("légende : %r, attendu %r" % (parsed["legend"], tab["legend"]))
    if parsed["scale_heading"] != tab["title"] or parsed["scale"] != tab["scale"]:
        problems.append("échelle : %r (%r), attendu %r (%r)" % (parsed["scale"], parsed["scale_heading"], tab["scale"], tab["title"]))
    if parsed["groups_heading"] != GROUPS_HEADING:
        problems.append("section des peuples : titre %r" % parsed["groups_heading"])
    if parsed["people"] != tab["people"]:
        problems.append("peuples de la page ≠ onglet (en trop : %s ; absents : %s ; sinon l'ordre diffère)" % (
            [p for p in parsed["people"] if p not in tab["people"]][:5], [p for p in tab["people"] if p not in parsed["people"]][:5]))
    else:
        page = page_matrix(parsed, tab["scale"], tab["people"])
        diffs = [(a, b, page[i][j], tab["matrix"][i][j]) for i, a in enumerate(tab["people"])
                 for j, b in enumerate(tab["people"]) if page[i][j] != tab["matrix"][i][j]]
        for a, b, got, want in diffs[:10]:
            problems.append("relation %s -> %s : page %r, onglet %r" % (a, b, got, want))
        if len(diffs) > 10:
            problems.append("… %d relations différentes au total" % len(diffs))
    if races is not None:
        want_groups = group_peoples(tab["people"], races)
        got = (parsed["groups"], parsed["unmatched"], parsed["absent"])
        if got != (want_groups[0], want_groups[1] or None, absent_races(tab["people"], races) or None):
            problems.append("rapprochement avec les pages de races différent de celui des pages races/*.md actuelles")
    if render is not None and unwrap_links(text) != render:
        problems.append("texte différent de la sortie du script (édition manuelle ou page périmée) : relancer le script")
    return problems


def summary_text(tab):
    """Résumé d'une phrase : l'échelle (premier et dernier niveau) et la légende, telle qu'écrite dans l'onglet."""
    return "Relation de chaque peuple avec les autres (de %s à %s) : %s." % (tab["scale"][0], tab["scale"][-1], " ; ".join(tab["legend"]))


# --------------------------------------------------------------------------------------------------------------------
# Rapprochement avec les pages de races
# --------------------------------------------------------------------------------------------------------------------

def match_race(name, races):
    """Titre de l'unique page de race dont le titre commence le nom ; None si zéro ou plusieurs."""
    key = normalize(name)
    found = [title for title, k in races if key == k or key.startswith(k + "-")]
    return found[0] if len(found) == 1 else None


def group_peoples(people, races):
    """([(titre de race, [peuples])] dans l'ordre de première apparition, [peuples sans rapprochement])."""
    groups, order, rest = {}, [], []
    for p in people:
        title = match_race(p, races)
        if title is None:
            rest.append(p)
            continue
        if title not in groups:
            groups[title] = []
            order.append(title)
        groups[title].append(p)
    return [(t, groups[t]) for t in order], rest


def absent_races(people, races):
    """Titres des races du wiki dont aucun peuple de l'onglet ne commence par le titre (ordre alphabétique des clés)."""
    used = {t for t, _ in group_peoples(people, races)[0]}
    return [t for t, k in sorted(races, key=lambda x: x[1]) if t not in used]


# --------------------------------------------------------------------------------------------------------------------
# Vérificateur (--verifier) : contrôle de la page contre l'onglet, puis cas d'erreur rejoués
# --------------------------------------------------------------------------------------------------------------------

def tab_checks(raw):
    """Lit l'onglet par les deux chemins et exige le même résultat."""
    tab = read_tab(raw)
    other = raw_tab(raw)
    if other != (tab["scale"], tab["people"], tab["matrix"]):
        raise Stop("les deux lectures de l'onglet (coordonnées / fusions) donnent des résultats différents")
    return tab


def replay_tab_cases(raw):
    """[(libellé, modification de la copie de l'onglet)] : chacune doit faire arrêter read_tab."""
    n_people = len(read_tab(raw)["people"])
    mid = n_people // 2
    r_mid, c_mid = MATRIX_ROW0 + STEP * (mid - 1), LABEL_COL0 + STEP * mid
    last_row, last_col = MATRIX_ROW0 + STEP * n_people, LABEL_COL0 + STEP * n_people

    def cell(sheet, r, c):
        return next(x for x in sheet["cells"] if (x["r"], x["c"]) == (r, c))

    def drop(sheet, r, c):
        sheet["cells"].remove(cell(sheet, r, c))

    def setv(r, c, v):
        return lambda sheet: cell(sheet, r, c).__setitem__("v", v)

    def stray(sheet):
        sheet["cells"].append({"r": r_mid + 1, "c": c_mid + 1, "v": "x"})

    def unmerge(sheet):
        sheet["merged"].remove(block(r_mid, c_mid))

    def swap_right(sheet):
        a, b = cell(sheet, MATRIX_ROW0, last_col), cell(sheet, MATRIX_ROW0 + STEP, last_col)
        a["v"], b["v"] = b["v"], a["v"]

    def truncate(sheet):
        sheet["cells"] = [x for x in sheet["cells"] if x["r"] <= MATRIX_ROW0 + STEP * (n_people // 2)]

    def dup_scale(sheet):
        cell(sheet, SCALE_ROW, SCALE_COL0 + STEP)["v"] = cell(sheet, SCALE_ROW, SCALE_COL0 + 2 * STEP)["v"]

    return [
        ("case vide au milieu de la matrice", lambda s: drop(s, r_mid, c_mid)),
        ("case blanche (espaces seulement)", setv(r_mid, c_mid, "   ")),
        ("valeur hors échelle", setv(r_mid, c_mid, "Amie")),
        ("un nom de peuple à la place d'un niveau", setv(r_mid, c_mid, read_tab(raw)["people"][0])),
        ("valeur non textuelle", setv(r_mid, c_mid, 3)),
        ("étiquette du bas inconnue", setv(last_row, LABEL_COL0 + STEP * mid, "Peuple inconnu")),
        ("étiquettes de droite permutées", swap_right),
        ("diagonale différente de « Même peuple »", setv(MATRIX_ROW0, LABEL_COL0, "Neutre")),
        ("légende du coin différente", setv(last_row, last_col, "Autre légende")),
        ("cellule parasite dans une fusion", stray),
        ("fusion supprimée", unmerge),
        ("échelle avec un doublon", dup_scale),
        ("onglet tronqué", truncate),
    ]


def mirrored_relation(lines, tab):
    """Texte où, pour une paire (A, B) asymétrique dont les deux niveaux sont écrits dans la section de B, A est rangé dans
    la section de B au niveau que A lui donne (la symétrie est « supposée ») ; None si aucune paire ne s'y prête."""
    people, matrix = tab["people"], tab["matrix"]
    for i, a in enumerate(people):
        for j, b in enumerate(people):
            if i == j or matrix[i][j] == matrix[j][i]:
                continue
            a_to_b, b_to_a = matrix[i][j], matrix[j][i]
            start = lines.index("## %s%s" % (esc(b), SECTION_SUFFIX))
            end = next((k for k in range(start + 1, len(lines)) if lines[k].startswith("## ")), len(lines))
            at = {}
            for k in range(start + 1, end):
                m = re.fullmatch(r"- \*\*(.+?)\*\* : (.+)", lines[k])
                if m:
                    at[unesc(m.group(1))] = (k, m.group(2).split(", "))
            if a_to_b not in at or b_to_a not in at or len(at[b_to_a][1]) < 2:
                continue
            edited = list(lines)
            k_from, names_from = at[b_to_a]
            k_to, names_to = at[a_to_b]
            edited[k_from] = "- **%s** : %s" % (esc(b_to_a), ", ".join(n for n in names_from if n != esc(a)))
            edited[k_to] = "- **%s** : %s" % (esc(a_to_b), ", ".join(names_to + [esc(a)]))
            return "\n".join(edited)
    return None


def replay_page_cases(text, tab):
    """[(libellé, texte modifié)] : chacun doit être rejeté (Stop ou écart). Un cas qui ne change rien est une erreur."""
    people, scale = tab["people"], tab["scale"]
    lines = text.split("\n")
    # première section de peuple et sa première ligne de relation à plusieurs peuples
    heads = [i for i, l in enumerate(lines) if l.endswith(SECTION_SUFFIX) and l.startswith("## ")]
    rel = [i for i in range(heads[1], heads[2]) if lines[i].startswith("- **") and ", " in lines[i]]
    one = rel[0]
    level, names = re.fullmatch(r"- \*\*(.+?)\*\* : (.+)", lines[one]).groups()
    names = names.split(", ")
    other_line = next(i for i in rel[1:] if lines[i] != lines[one])

    def with_line(i, new):
        copy_lines = list(lines)
        copy_lines[i] = new
        return "\n".join(copy_lines)

    def without_line(i):
        copy_lines = list(lines)
        del copy_lines[i]
        return "\n".join(copy_lines)

    o_level, o_names = re.fullmatch(r"- \*\*(.+?)\*\* : (.+)", lines[other_line]).groups()
    o_names = o_names.split(", ")
    moved = list(lines)
    moved[one] = "- **%s** : %s" % (level, ", ".join(names[1:]))
    moved[other_line] = "- **%s** : %s" % (o_level, ", ".join([names[0]] + o_names))
    swapped = list(lines)
    swapped[heads[1]], swapped[heads[2]] = lines[heads[2]], lines[heads[1]]
    no_section = list(lines)
    del no_section[heads[1]:heads[2]]
    linked = text.replace("- %s : " % esc(people[0].split(" ")[0]), "- [[%s]] : " % esc(people[0].split(" ")[0]), 1)
    cases = [
        ("un peuple retiré d'une ligne (case vide)", with_line(one, "- **%s** : %s" % (level, ", ".join(names[1:])))),
        ("un peuple écrit deux fois dans une section", with_line(one, "- **%s** : %s" % (level, ", ".join(names + names[:1])))),
        ("un peuple inconnu", with_line(one, "- **%s** : %s" % (level, ", ".join(["Peuple inconnu"] + names[1:])))),
        ("un niveau hors échelle", with_line(one, "- **Amie** : %s" % ", ".join(names))),
        ("une ligne de niveau supprimée (cases vides)", without_line(one)),
        ("un peuple déplacé vers un autre niveau", "\n".join(moved)),
        ("deux sections de peuples permutées", "\n".join(swapped)),
        ("une section de peuple supprimée", "\n".join(no_section)),
        ("un niveau écrit deux fois", with_line(one, lines[one] + "\n" + lines[one])),
        ("statut modifié", text.replace("\nstatus: %s\n" % STATUS, "\nstatus: verified\n", 1)),
        ("légende modifiée", text.replace(tab["legend"][0], tab["legend"][0] + " !", 1)),
        ("source retirée", text.replace(SOURCES[1], "https://example.invalid/", 1)),
        ("symétrie supposée : la relation B -> A recopiée depuis A -> B", mirrored_relation(lines, tab)),
    ]
    cases = [c for c in cases if c[1] is not None]
    for label, mutated in cases:
        if mutated == text:
            raise Stop("cas d'erreur inopérant (le texte n'a pas changé) : %s" % label)
    return cases, linked


def detects(mutated, tab, races, render):
    """Message si le texte est rejeté (Stop ou écart), None sinon."""
    try:
        problems = check_page(mutated, tab, races, render)
    except Stop as err:
        return str(err)
    return problems[0] if problems else None


def run_verifier(dump_path, wiki_root, render=None, load_races=None):
    problems = []
    raw = find_tab(dump_path)
    tab = tab_checks(raw)
    n = len(tab["people"])
    print("onglet « %s » : %d peuples, %d relations, échelle %s ; deux lectures concordantes" % (
        TAB, n, n * n, " > ".join(tab["scale"])))
    races = load_races(wiki_root) if load_races else None
    path = os.path.join(wiki_root, CATEGORY, "relations-entre-les-races.md")
    if not os.path.exists(path):
        raise Stop("page absente : %s" % path)
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    expected = render(tab, races) if render else None
    found = check_page(text, tab, races, expected)
    for p in found:
        problems.append(p)
    print("page : %d relations reconstruites depuis le texte et comparées à l'onglet cellule par cellule : %d écart(s)" % (
        n * n, len(found)))

    # Cas d'erreur sur l'onglet
    if n >= MIN_REPLAY_PEOPLE:
        replayed = 0
        for label, change in replay_tab_cases(raw):
            copy_raw = copy.deepcopy(raw)
            change(copy_raw)
            try:
                tab_checks(copy_raw)
            except Stop as err:
                replayed += 1
                print("  détecté (onglet) : %s -> %s" % (label, str(err)[:110]))
            else:
                problems.append("cas d'erreur NON détecté (onglet) : %s" % label)
        cases, linked = replay_page_cases(text, tab)
        for label, mutated in cases:
            message = detects(mutated, tab, races, expected)
            if message is None:
                problems.append("cas d'erreur NON détecté (page) : %s" % label)
            else:
                replayed += 1
                print("  détecté (page) : %s -> %s" % (label, message[:110]))
        # contrôle positif : les liens [[…]] du maillage automatique ne sont pas des écarts
        if linked != text:
            message = detects(linked, tab, races, expected)
            if message is not None:
                problems.append("lien [[…]] posé par le maillage automatique rejeté à tort : %s" % message)
            else:
                replayed += 1
                print("  accepté à raison : un lien [[…]] de maillage automatique ne change pas les relations")
        # onglet modifié alors que la page ne l'est pas : la comparaison cellule par cellule doit le voir
        changed = copy.deepcopy(tab)
        i, j = 1, 2
        changed["matrix"][i][j] = next(s for s in tab["scale"] if s != tab["matrix"][i][j])
        message = detects(text, changed, races, None)
        if message is None:
            problems.append("cas d'erreur NON détecté : relation de l'onglet modifiée, page inchangée")
        else:
            replayed += 1
            print("  détecté (comparaison) : une relation de l'onglet change, la page non -> %s" % message[:110])
        print("cas d'erreur rejoués : %d, tous détectés" % replayed if not problems else "cas d'erreur rejoués : problèmes ci-dessus")
    else:
        print("moins de %d peuples : cas d'erreur non rejoués" % MIN_REPLAY_PEOPLE)
    if problems:
        raise Stop("vérification en échec :\n  " + "\n  ".join(problems))
    print("vérification : OK")


# --------------------------------------------------------------------------------------------------------------------
# Pages de races (rapprochement) et rendu de la page
# --------------------------------------------------------------------------------------------------------------------

def front_fields(text):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    return m.group(1) if m else ""


def front_title(text):
    t = re.search(r"^title:\s*(.*)$", front_fields(text), re.M)
    if not t:
        return None
    raw = t.group(1).strip()
    try:
        return json.loads(raw) if raw.startswith('"') else raw.strip("'")
    except ValueError:
        return raw


def load_races(wiki_root):
    """[(titre, clé)] des pages `races/*.md` qui ne sont pas des exemples (`status: example`), triées par nom de fichier."""
    folder = os.path.join(wiki_root, "races")
    races = []
    if not os.path.isdir(folder):
        return races
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".md"):
            continue
        with open(os.path.join(folder, name), encoding="utf-8") as fh:
            text = fh.read()
        status = re.search(r"^status:\s*(\S+)", front_fields(text), re.M)
        title = front_title(text)
        if title and not (status and status.group(1).strip("\"'") == "example"):
            races.append((title, normalize(title)))
    return races


def render_page(tab, races):
    """Texte de la page (voir la docstring pour le plan). Déterministe : rien ne dépend de l'heure ni de l'environnement."""
    people, scale, matrix = tab["people"], tab["scale"], tab["matrix"]
    n = len(people)
    pairs = n * (n - 1) // 2
    asym = sum(1 for i in range(n) for j in range(i + 1, n) if matrix[i][j] != matrix[j][i])
    groups, rest = group_peoples(people, races)
    absent = absent_races(people, races)

    L = ["---",
         "title: " + yaml_str(PAGE_TITLE),
         "aliases: []",
         "tags: " + yaml_list(TAGS),
         "summary: " + yaml_str(summary_text(tab)),
         "sources: " + yaml_list(SOURCES),
         "status: " + STATUS,
         "---", ""]
    L += [esc("Relations entre les %d peuples de l'onglet « %s » du classeur « %s » : chaque peuple y est noté face à "
              "chacun des %d peuples, lui-même compris, sur l'échelle ci-dessous." % (n, TAB, BOOK_TITLE, n)), ""]
    L += [esc("Chaque section « Nom du peuple%s » reprend une ligne de la matrice (axe vertical de l'onglet) : les autres peuples "
              "y sont rangés par niveau de relation, dans l'ordre de l'échelle, puis dans l'ordre de l'onglet ; un niveau "
              "sans peuple n'est pas écrit. La relation d'un peuple avec lui-même est « %s »." % (SECTION_SUFFIX, SELF_LEVEL)), ""]
    if asym:
        L += [esc("La matrice n'est pas symétrique : pour %d des %d paires de peuples, les deux sens de la relation "
                  "diffèrent. Pour savoir comment un peuple est vu par les autres (axe horizontal de l'onglet), chercher "
                  "son nom dans la section de chacun des autres peuples." % (asym, pairs)), ""]
    else:
        L += [esc("La matrice est symétrique : les deux sens de chacune des %d paires de peuples sont identiques." % pairs), ""]

    L += ["## " + LEGEND_HEADING, ""] + ["- " + esc(line) for line in tab["legend"]] + [""]
    L += ["## " + esc(tab["title"]), "",
          esc("Les %d niveaux de l'onglet, dans l'ordre où il les écrit (de gauche à droite) :" % len(scale)), ""]
    L += ["- " + esc(level) for level in scale] + [""]

    L += ["## " + esc(GROUPS_HEADING), "",
          esc("Rapprochement avec les pages de races : un peuple est rangé sous la page de race dont le titre commence son "
              "nom, seulement si une seule page convient."), ""]
    L += ["- %s : %s" % (esc(title), ", ".join(esc(p) for p in names)) for title, names in groups]
    if groups:
        L.append("")
    if rest:
        L += [UNMATCHED_PREFIX + ", ".join(esc(p) for p in rest) + ".", ""]
    if absent:
        L += [ABSENT_PREFIX + ", ".join(esc(t) for t in absent) + ".", ""]

    for i, person in enumerate(people):
        L += ["## " + esc(person) + SECTION_SUFFIX, ""]
        for level in scale:
            names = [people[j] for j in range(n) if matrix[i][j] == level]
            if names:
                L.append("- **%s** : %s" % (esc(level), ", ".join(esc(name) for name in names)))
        L.append("")
    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Écriture
# --------------------------------------------------------------------------------------------------------------------

def guard_existing(wiki_root, target):
    """Refuse d'écraser un fichier d'une autre origine ou de partager le titre / le slug d'une autre page."""
    slug = os.path.splitext(os.path.basename(target))[0]
    problems = []
    if os.path.exists(target):
        with open(target, encoding="utf-8") as fh:
            existing = fh.read()
        if SOURCES[1] not in existing or TAB not in existing:
            problems.append("%s existe et n'est pas issu de l'onglet « %s »" % (target, TAB))
    for dirpath, _, files in sorted(os.walk(wiki_root)):
        for fname in sorted(files):
            path = os.path.abspath(os.path.join(dirpath, fname))
            if not fname.endswith(".md") or path == os.path.abspath(target):
                continue
            if os.path.splitext(fname)[0] == slug:
                problems.append("le slug %r est déjà porté par %s" % (slug, path))
                continue
            with open(path, encoding="utf-8") as fh:
                title = front_title(fh.read())
            if title is not None and normalize(title) == normalize(PAGE_TITLE):
                problems.append("titre %r déjà porté par %s" % (title, path))
    if problems:
        raise Stop("\n  ".join(problems))


def run_write(dump_path, wiki_root):
    raw = find_tab(dump_path)
    tab = tab_checks(raw)
    races = load_races(wiki_root)
    text = render_page(tab, races)
    # Contrôle avant toute écriture : le texte produit, relu comme une page, doit redonner exactement l'onglet.
    found = check_page(text, tab, races, text)
    if found:
        raise Stop("le texte produit ne redonne pas l'onglet :\n  " + "\n  ".join(found[:10]))
    target = os.path.join(wiki_root, CATEGORY, "relations-entre-les-races.md")
    guard_existing(wiki_root, target)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    state = "écrite"
    if os.path.exists(target):
        with open(target, encoding="utf-8") as fh:
            if fh.read() == text:
                state = "inchangée"
    if state == "écrite":
        with open(target, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)

    people, scale, matrix = tab["people"], tab["scale"], tab["matrix"]
    n = len(people)
    print("1 page %s : %s" % (state, target))
    print("%d peuples, %d relations (%d x %d), %d niveaux : %s" % (
        n, n * n, n, n, len(scale),
        ", ".join("%s %d" % (level, sum(row.count(level) for row in matrix)) for level in scale)))
    groups, rest = group_peoples(people, races)
    absent = absent_races(people, races)
    print("rapprochement avec races/*.md (%d pages) : %d peuples sur %d races (%s) ; sans rapprochement : %s ; "
          "races sans peuple dans l'onglet : %s" % (
              len(races), sum(len(g) for _, g in groups), len(groups), ", ".join("%s %d" % (t, len(g)) for t, g in groups),
              ", ".join(rest) or "aucun", ", ".join(absent) or "aucune"))
    asym = sum(1 for i in range(n) for j in range(i + 1, n) if matrix[i][j] != matrix[j][i])
    print("asymétrie : %d paires de peuples sur %d ont deux relations différentes selon le sens" % (asym, n * (n - 1) // 2))
    # Contrôle après écriture : relecture du fichier sur le disque.
    with open(target, encoding="utf-8") as fh:
        on_disk = fh.read()
    problems = check_page(on_disk, tab, races, text)
    if problems:
        raise SystemExit("Vérification après écriture : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:20]))
    print("vérification après écriture : %d relations relues depuis la page, 0 écart" % (n * n))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère la page lore « Relations entre les races » depuis le dump de l'onglet.")
    ap.add_argument("--dump", required=True, help="dump JSON contenant l'onglet « %s » complet" % TAB)
    ap.add_argument("--out", required=True, help="dossier racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true", help="n'écrit rien : compare la page existante à l'onglet et rejoue des cas d'erreur")
    args = ap.parse_args(argv)
    try:
        if args.verifier:
            run_verifier(args.dump, args.out, render=render_page, load_races=load_races)
        else:
            run_write(args.dump, args.out)
    except Stop as err:
        sys.exit(("Arrêt :\n  %s" if args.verifier else "Arrêt, rien n'a été écrit :\n  %s") % err)


if __name__ == "__main__":
    main()
