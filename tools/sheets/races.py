#!/usr/bin/env python3
"""Famille « races » : une page du wiki par race (27 races), dans `<out>/races/<slug>.md`.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/races.py --dump <races-index.json> --dump <fiche-auto-v15.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki

Option `--verifier` : n'écrit rien. Recalcule `magies_innees` directement depuis le dump brut (sans passer par le code
de lecture du script), compare aux pages déjà écrites, puis rejoue des cas d'erreur sur des copies modifiées de la
matrice. Code de sortie non nul au moindre écart. Sans cette option, la même comparaison aux pages est faite après
l'écriture (un écart arrête le script).

Les dumps JSON sont produits par tools/sheets/xlsx_to_json.py (format : voir ce script). Chaque dump est reconnu à son
contenu (l'ordre des `--dump` n'a pas d'importance). Les cellules sont une donnée non fiable : elles ne sont jamais
exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur n'est calculée, corrigée ni complétée.

Sources (classeurs Google, propriété d'un tiers) :

  1. Google Sheet « Les races » (1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4), PREMIÈRE FEUILLE SEULEMENT (le classeur
     entier dépasse la limite d'export de Google ; le nom de l'onglet est inconnu, c'est un export CSV).
     Une ligne par race : A = nom de la race, B = phrase de présentation. 27 lignes, sans en-tête. L'ordre de cette
     feuille donne l'ordre de traitement. Le lore détaillé des races (les autres onglets de ce classeur) n'est PAS
     dans les données : aucune page ne le contient.

  2. Google Sheet « Fiche personnage Maverick Auto V15.2.2 » (1SvzNbdDVQyLE9cyp9U5USHBsxHpwxhtaWrFTu9CpLY4), onglets
     MASQUÉS :
       * « Race » : une ligne par race (lignes 2 à 28, nom en A), en-têtes en ligne 1 (A1 vide) :
           B Santé, C Chakra départ, D Barrière bonus, E Vitesse sur terre, F Vitesse de Nage, G Divers, H AP, I AM,
           puis six paires (opérateur « < ou > », valeur « Restrictions <caractéristique> ») :
           J/K Force, L/M Volonté, N/O Intélligence, P/Q Perception, R/S Social, T/U Agilité,
           V Don base, W Capacité Hyper.
         Les cellules « = » de Mort-vivant (L13, R13) sont du texte (le dump les marque à tort comme formule).
       * « Bonus Race » : 96 lignes (2 à 97), une par sous-race / origine. A = Race, B = nom de la sous-race (SANS
         en-tête dans la source), C = Nom, D = Descriptif, E à H = Nom/Valeur résistance 1 et 2, I à N = Bonus PV,
         Chakra, Barrière, AP, AM, Vitesse. Les colonnes I à N sont des formules (extraction par expression régulière
         du descriptif) : les valeurs en cache sont reprises telles quelles (« 3 » en texte, « 1.0 » en nombre) ; une
         valeur en cache vide reste absente. Les lignes 98 à 239 ne portent que des formules à valeur vide.
       * « Accessibilité de Classe » : matrice 27 races (lignes 2 à 28) x 39 classes (colonnes B à AN), valeurs 0/1.
       * « Accessibilité Magie » : matrice 27 races x 15 magies (colonnes B à P), valeurs 0/1.

Frontmatter (contrat avec le site, qui lit ces champs structurés ; le corps Markdown ne dépend pas d'eux) :
    `magies_innees: ["Sang", "Eau", "Terre"]` = les en-têtes de l'onglet « Accessibilité Magie » (B1:P1 : « Potentiel
    Illimité », « Sang », « Arcane », « Corruption », « Espace/Temps », « Vide », « Nécromancie », « Feu », « Eau »,
    « Glace », « Terre », « Vent », « Foudre », « Lumière », « Ombre ») dont la valeur vaut 1 sur la ligne de la race,
    dans l'ordre des colonnes, écrits comme l'en-tête (ce sont les noms courts des pages de magies). C'est la même
    liste que celle de « Magies accessibles » dans le corps. Une valeur ni 0 ni 1, une race de la matrice sans page,
    ou une race de l'index absente de la matrice arrête le script (pas de repli).
    Rapport (sortie standard) : nombre de pages, puis la répartition des races par nombre de magies innées.

Page produite pour chaque race (les sections vides sont omises) :
    présentation (phrase de l'index, aussi `summary`) ; « Caractéristiques de départ » (tableau Race, en-têtes tels
    qu'écrits, puis « Divers ») ; « Restrictions » ; « Don base » ; « Capacité Hyper » ; « Sous-races et origines »
    (une sous-section par ligne de « Bonus Race », avec Nom, Descriptif et un tableau des colonnes non vides) ;
    « Classes accessibles » et « Magies accessibles » (nombre, puis noms dont la valeur est 1).

Rapprochement des noms : l'index, « Race » et les deux matrices écrivent les 27 noms de façon identique ; seul « Bonus
Race » diffère (casse « Elfe Forestier », espace final « Satyre », coquille « Felfle »). La clé de comparaison est celle
du wiki (minuscules, sans accents ni apostrophes) ; la seule correspondance forcée est RACE_NAME_FIXES
(« Felfle » -> « Felfe », confirmée par les noms de sous-races de la colonne B : « Felfe Forestier », etc.). Si la
colonne « Race » de « Bonus Race » s'écrit autrement que le nom de la race, une ligne le signale dans la page.

Le script s'arrête avec une erreur si une cellule non vide d'un onglet du périmètre n'est pas reconnue (rien n'est perdu
en silence), si un nom de race n'a pas de correspondance, si une valeur de matrice n'est ni 0 ni 1, si un titre est déjà
porté par une page d'une autre famille, si un fichier existant n'est pas issu de ce classeur, ou si `races/` contient une
page issue de ce classeur dont la race n'est plus dans l'index.

Il ne touche qu'aux fichiers `<out>/races/<slug>.md` de sa famille : il n'efface rien, ne réécrit pas un fichier dont le
contenu ne change pas. Aucun lien [[…]] n'est écrit (une cellule qui en contiendrait serait neutralisée et signalée sur
la sortie d'erreur).
"""
import argparse
import json
import os
import re
import sys
import unicodedata

CATEGORY = "races"
STATUS = "draft"
TAGS = ["race"]

INDEX_TITLE = "Les races"
INDEX_ID = "1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4"
INDEX_TAB = "première feuille"
FICHE_TITLE = "Fiche personnage Maverick Auto V15.2.2"
FICHE_ID = "1SvzNbdDVQyLE9cyp9U5USHBsxHpwxhtaWrFTu9CpLY4"
TAB_RACE, TAB_BONUS, TAB_CLASS, TAB_MAGIE = "Race", "Bonus Race", "Accessibilité de Classe", "Accessibilité Magie"
FICHE_TABS = (TAB_RACE, TAB_BONUS, TAB_CLASS, TAB_MAGIE)

# Champ de frontmatter lu par le site : magies innées de la race (en-têtes de TAB_MAGIE dont la valeur vaut 1).
MAGIC_FIELD = "magies_innees"
# Noms courts des 15 magies, tels qu'écrits dans B1:P1 de TAB_MAGIE (contrat avec les pages de magies ; --verifier).
MAGIC_HEADERS = ("Potentiel Illimité", "Sang", "Arcane", "Corruption", "Espace/Temps", "Vide", "Nécromancie", "Feu",
                 "Eau", "Glace", "Terre", "Vent", "Foudre", "Lumière", "Ombre")


def source_url(file_id):
    return "https://docs.google.com/spreadsheets/d/%s/edit" % file_id


SOURCES = [
    "Google Sheet « %s », onglet « %s »" % (INDEX_TITLE, INDEX_TAB),
    source_url(INDEX_ID),
    "Google Sheet « %s », onglets %s" % (FICHE_TITLE, ", ".join("« %s »" % t for t in FICHE_TABS)),
    source_url(FICHE_ID),
]

# Correspondances de noms forcées, clé de comparaison (voir normalize) de « Bonus Race » -> clé de l'index.
RACE_NAME_FIXES = {"felfle": "felfe"}

# Colonnes de l'onglet « Race » (numéros à partir de 1).
COL_NAME = 1
RACE_STAT_COLS = (2, 3, 4, 5, 6)           # Santé .. Vitesse de Nage (tableau)
COL_DIVERS = 7
RACE_STAT_COLS_AFTER = (8, 9)              # AP, AM (tableau, après Divers dans la source)
RACE_RESTRICTIONS = ((10, 11), (12, 13), (14, 15), (16, 17), (18, 19), (20, 21))  # (opérateur, valeur)
COL_DON, COL_HYPER = 22, 23
RACE_LAST_COL = 23
OPERATOR_HEADER = "< ou >"

# Colonnes de l'onglet « Bonus Race ».
BONUS_COL_RACE, BONUS_COL_SUB, BONUS_COL_NOM, BONUS_COL_DESC = 1, 2, 3, 4
BONUS_NUM_COLS = tuple(range(5, 15))       # E .. N : résistances et bonus (tableau, colonnes non vides seulement)
BONUS_LAST_COL = 14


# --------------------------------------------------------------------------------------------------------------------
# Utilitaires de cellules
# --------------------------------------------------------------------------------------------------------------------

def fmt(value):
    """Valeur en cache -> texte, sans arrondi (10.0 reste « 10.0 »)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int):
        return str(value)
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def is_blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def norm_ws(text):
    return " ".join(fmt(text).split())


def normalize(value):
    """Clé de comparaison identique à celle du wiki (client/src/lib/text.mjs) : minuscules, sans accents ni apostrophes."""
    text = unicodedata.normalize("NFD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"['’]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
        self.consumed = set()

    def take(self, r, c):
        """Lit une cellule (None si vide) et la marque comme utilisée."""
        if (r, c) in self.cells:
            self.consumed.add((r, c))
        return self.cells.get((r, c))

    def check_all_consumed(self):
        left = sorted(set(self.cells) - self.consumed)
        if left:
            raise ValueError("%s : cellules non reconnues %s" % (
                self.name, ", ".join("L%dC%d=%r" % (r, c, self.cells[(r, c)]) for r, c in left[:10])))


# --------------------------------------------------------------------------------------------------------------------
# Échappement Markdown
# --------------------------------------------------------------------------------------------------------------------

URL_RE = re.compile(r"https?://[^\s<>]+")


def _esc_plain(s):
    s = s.replace("\\", "\\\\")
    s = re.sub(r"([`*_\[\]<~])", r"\\\1", s)
    s = re.sub(r"&(?=#?\w+;)", r"\\&", s)
    return s


def esc_inline(s):
    """Échappe un texte d'une ligne ; les URL nues deviennent des liens automatiques <url>."""
    out, pos = [], 0
    for m in URL_RE.finditer(s):
        out.append(_esc_plain(s[pos:m.start()]))
        out.append("<%s>" % m.group(0))
        pos = m.end()
    out.append(_esc_plain(s[pos:]))
    line = "".join(out)
    # début de ligne : ne doit pas devenir une citation, un titre ou une liste
    line = re.sub(r"^(\s*)>", r"\1\\>", line)
    line = re.sub(r"^(\s*)(#{1,6})(?=\s|$)", r"\1\\\2", line)
    line = re.sub(r"^(\s*)([-+])(?=\s|$)", r"\1\\\2", line)
    line = re.sub(r"^(\s*)(\d+)([.)])(?=\s|$)", r"\1\2\\\3", line)
    return line


def cell_md(value):
    """Cellule de tableau : retours à la ligne -> <br>, « | » échappé."""
    text = fmt(value)
    lines = [esc_inline(l.strip()) for l in text.split("\n")]
    return "<br>".join(lines).replace("|", "\\|")


def md_blocks(text):
    """Texte multi-lignes -> blocs ('p', [lignes]) ou ('ul', [éléments]) ; les lignes « - … » forment des listes."""
    lines = [l.strip() for l in fmt(text).split("\n")]
    blocks, para, items = [], [], []

    def flush_para():
        if para:
            blocks.append(("p", list(para)))
            para.clear()

    def flush_items():
        if items:
            blocks.append(("ul", list(items)))
            items.clear()

    for line in lines:
        if not line:
            flush_para()
            flush_items()
        elif re.match(r"-\s+\S", line):
            flush_para()
            items.append(line[1:].strip())
        else:
            flush_items()
            para.append(line)
    flush_para()
    flush_items()
    return blocks


def md_text(text):
    """Texte multi-lignes -> lignes Markdown (paragraphes séparés, sauts de ligne forcés par deux espaces)."""
    out = []
    for kind, content in md_blocks(text):
        if out:
            out.append("")
        if kind == "p":
            for i, line in enumerate(content):
                out.append(esc_inline(line) + ("  " if i < len(content) - 1 else ""))
        else:
            for item in content:
                out.append("- " + esc_inline(item))
    return out


def labeled(label, value):
    """« **Libellé** : texte » si le texte tient sur une ligne, sinon le libellé puis le texte (liste ou paragraphes)."""
    blocks = md_blocks(value)
    if len(blocks) == 1 and blocks[0][0] == "p" and len(blocks[0][1]) == 1:
        return ["**%s** : %s" % (esc_inline(label), esc_inline(blocks[0][1][0]))]
    return ["**%s**" % esc_inline(label), ""] + md_text(value)


def table(headers, row):
    return [
        "| " + " | ".join(cell_md(h) for h in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
        "| " + " | ".join(cell_md(v) for v in row) + " |",
    ]


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


# --------------------------------------------------------------------------------------------------------------------
# Lecture des dumps
# --------------------------------------------------------------------------------------------------------------------

def load_dumps(paths):
    index_raw = fiche = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            dump = json.load(fh)
        names = [s["name"] for s in dump["sheets"]]
        if all(t in names for t in FICHE_TABS):
            if fiche is not None:
                raise ValueError("deux dumps de la fiche personnage")
            fiche = {s["name"]: Sheet(s) for s in dump["sheets"] if s["name"] in FICHE_TABS}
        elif len(names) == 1:
            if index_raw is not None:
                raise ValueError("deux dumps de l'index des races")
            index_raw = Sheet(dump["sheets"][0])
        else:
            raise ValueError("dump non reconnu : %s (onglets : %s)" % (path, names))
    if index_raw is None or fiche is None:
        raise ValueError("il faut un dump de l'index des races et un dump de la fiche personnage")
    return index_raw, fiche


def read_index(sheet):
    """[(nom, phrase de présentation ou None)] dans l'ordre des lignes."""
    rows = sorted({r for r, _ in sheet.cells})
    races = []
    for r in rows:
        name, text = sheet.take(r, 1), sheet.take(r, 2)
        if name is None:
            raise ValueError("index des races : ligne %d sans nom de race" % r)
        races.append((norm_ws(name), norm_ws(text) if text is not None else None))
    sheet.check_all_consumed()
    names = [normalize(n) for n, _ in races]
    if len(set(names)) != len(names):
        raise ValueError("index des races : noms en double")
    return races


def read_race_tab(sheet, races):
    """{clé de race: {...}} depuis l'onglet « Race »."""
    headers = {}
    for c in range(2, RACE_LAST_COL + 1):
        h = sheet.take(1, c)
        if h is None:
            raise ValueError("%s : en-tête manquant colonne %d" % (sheet.name, c))
        headers[c] = norm_ws(h)
    if sheet.take(1, COL_NAME) is not None:
        raise ValueError("%s : A1 devrait être vide" % sheet.name)
    for op_col, val_col in RACE_RESTRICTIONS:
        if headers[op_col] != OPERATOR_HEADER or not headers[val_col].startswith("Restrictions "):
            raise ValueError("%s : paire de restrictions inattendue (colonnes %d/%d)" % (sheet.name, op_col, val_col))
    keys = {normalize(n): n for n, _ in races}
    data = {}
    rows = sorted({r for r, _ in sheet.cells if r > 1})
    for r in rows:
        name = sheet.take(r, COL_NAME)
        key = normalize(name) if name is not None else None
        if key not in keys:
            raise ValueError("%s : ligne %d, race %r absente de l'index" % (sheet.name, r, name))
        if key in data:
            raise ValueError("%s : race %r en double" % (sheet.name, name))
        data[key] = {c: sheet.take(r, c) for c in range(2, RACE_LAST_COL + 1)}
    missing = set(keys) - set(data)
    if missing:
        raise ValueError("%s : races absentes : %s" % (sheet.name, sorted(missing)))
    sheet.check_all_consumed()
    return headers, data


def read_bonus_tab(sheet, races):
    """(en-têtes, {clé de race: [ligne...]}, {clé de race: [noms écrits en colonne A]})."""
    headers = {}
    for c in range(1, BONUS_LAST_COL + 1):
        h = sheet.take(1, c)
        if h is not None:
            headers[c] = norm_ws(h)
    if BONUS_COL_SUB in headers:
        raise ValueError("%s : B1 devrait être vide" % sheet.name)
    for c in (BONUS_COL_RACE, BONUS_COL_NOM, BONUS_COL_DESC) + BONUS_NUM_COLS:
        if c not in headers:
            raise ValueError("%s : en-tête manquant colonne %d" % (sheet.name, c))
    keys = {normalize(n): n for n, _ in races}
    rows_by_race = {k: [] for k in keys}
    spelled = {k: [] for k in keys}
    for r in sorted({r for r, _ in sheet.cells if r > 1}):
        race_cell = sheet.take(r, BONUS_COL_RACE)
        if race_cell is None:
            raise ValueError("%s : ligne %d sans race" % (sheet.name, r))
        key = normalize(race_cell)
        key = RACE_NAME_FIXES.get(key, key)
        if key not in keys:
            raise ValueError("%s : ligne %d, race %r sans correspondance dans l'index" % (sheet.name, r, race_cell))
        if sheet.cells.get((r, BONUS_COL_SUB)) is None:
            raise ValueError("%s : ligne %d sans nom de sous-race (colonne B)" % (sheet.name, r))
        row = {c: sheet.take(r, c) for c in range(2, BONUS_LAST_COL + 1)}
        rows_by_race[key].append(row)
        written = norm_ws(race_cell)
        if written not in spelled[key]:
            spelled[key].append(written)
    sheet.check_all_consumed()
    return headers, rows_by_race, spelled


def read_matrix(sheet, races):
    """(noms des colonnes, {clé de race: [noms dont la valeur est 1]})."""
    cols = sorted({c for r, c in sheet.cells if r == 1})
    if cols != list(range(2, cols[-1] + 1)):
        raise ValueError("%s : colonnes d'en-tête non contiguës" % sheet.name)
    names = []
    for c in cols:
        names.append(norm_ws(sheet.take(1, c)))
    if len(set(names)) != len(names):
        raise ValueError("%s : en-têtes en double" % sheet.name)
    keys = {normalize(n) for n, _ in races}
    accessible = {}
    for r in sorted({r for r, _ in sheet.cells if r > 1}):
        name = sheet.take(r, 1)
        key = normalize(name) if name is not None else None
        if key not in keys or key in accessible:
            raise ValueError("%s : ligne %d, race %r inconnue ou en double" % (sheet.name, r, name))
        ones = []
        for c, label in zip(cols, names):
            v = sheet.take(r, c)
            if v is None or fmt(v) not in ("0.0", "1.0", "0", "1"):
                raise ValueError("%s : L%dC%d valeur inattendue %r (0 ou 1 attendu)" % (sheet.name, r, c, v))
            if float(v) == 1.0:
                ones.append(label)
        accessible[key] = ones
    missing = keys - set(accessible)
    if missing:
        raise ValueError("%s : races absentes : %s" % (sheet.name, sorted(missing)))
    sheet.check_all_consumed()
    return names, accessible


# --------------------------------------------------------------------------------------------------------------------
# Rendu d'une page
# --------------------------------------------------------------------------------------------------------------------

def render_page(name, summary, race_headers, race_row, bonus_headers, bonus_rows, bonus_spelled,
                class_names, class_ok, magic_names, magic_ok):
    L = ["---",
         "title: " + yaml_str(name),
         "aliases: []",
         "tags: " + yaml_list(TAGS)]
    if summary:
        L.append("summary: " + yaml_str(summary))
    L.append(MAGIC_FIELD + ": " + yaml_list(magic_ok))
    L += ["sources: " + yaml_list(SOURCES), "status: " + STATUS, "---", ""]

    if summary:
        L += md_text(summary) + [""]

    # Caractéristiques de départ (le titre n'est écrit que si la section n'est pas vide)
    cols = [c for c in RACE_STAT_COLS + RACE_STAT_COLS_AFTER if not is_blank(race_row[c])]
    section = []
    if cols:
        section += table([race_headers[c] for c in cols], [race_row[c] for c in cols]) + [""]
    if not is_blank(race_row[COL_DIVERS]):
        section += labeled(race_headers[COL_DIVERS], race_row[COL_DIVERS]) + [""]
    if section:
        L += ["## Caractéristiques de départ", ""] + section

    # Restrictions
    restr = []
    for op_col, val_col in RACE_RESTRICTIONS:
        op, val = race_row[op_col], race_row[val_col]
        if is_blank(op) and is_blank(val):
            continue
        text = " ".join(fmt(x) for x in (op, val) if not is_blank(x))
        restr.append((race_headers[val_col], text))
    if restr:
        L += ["## Restrictions", "",
              esc_inline("Chaque valeur est précédée de l'opérateur de la colonne « %s » qui la précède dans l'onglet « %s »."
                         % (OPERATOR_HEADER, TAB_RACE)), ""]
        L += table([h for h, _ in restr], [t for _, t in restr]) + [""]

    # Don, capacité Hyper
    for col in (COL_DON, COL_HYPER):
        if not is_blank(race_row[col]):
            L += ["## " + esc_inline(race_headers[col]), ""] + md_text(race_row[col]) + [""]

    # Sous-races / origines
    if bonus_rows:
        L += ["## Sous-races et origines", "", "Nombre : %d." % len(bonus_rows), ""]
        if any(s != name for s in bonus_spelled):
            L += ["Colonne « %s » de l'onglet « %s » : %s." % (
                bonus_headers[BONUS_COL_RACE], TAB_BONUS, ", ".join(bonus_spelled)), ""]
        for row in bonus_rows:
            L += ["### " + esc_inline(norm_ws(row[BONUS_COL_SUB])), ""]
            for col in (BONUS_COL_NOM, BONUS_COL_DESC):
                if not is_blank(row[col]):
                    L += labeled(bonus_headers[col], row[col]) + [""]
            num = [c for c in BONUS_NUM_COLS if not is_blank(row[c])]
            if num:
                L += table([bonus_headers[c] for c in num], [row[c] for c in num]) + [""]

    # Accessibilité
    for title, names, ok in (("Classes accessibles", class_names, class_ok), ("Magies accessibles", magic_names, magic_ok)):
        L += ["## " + title, "", "Nombre : %d sur %d." % (len(ok), len(names)), ""]
        if ok:
            L += [", ".join(esc_inline(n) for n in ok), ""]

    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Vérification indépendante de `magies_innees` (option --verifier, et après chaque écriture)
# --------------------------------------------------------------------------------------------------------------------

def _raw_dumps(paths):
    """(feuille brute « Accessibilité Magie », feuille brute de l'index) lues directement dans les dumps JSON."""
    magic = index = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            sheets = json.load(fh)["sheets"]
        for sh in sheets:
            if sh["name"] == TAB_MAGIE:
                magic = sh
        if len(sheets) == 1:
            index = sheets[0]
    if magic is None or index is None:
        raise ValueError("verifier : il faut le dump de l'index des races et celui de la fiche personnage")
    return magic, index


def expected_magic(paths):
    """{clé de race: (nom, [magies innées])} recalculé à la main depuis le dump brut, sans Sheet ni read_matrix."""
    magic, index = _raw_dumps(paths)
    grid = {(c["r"], c["c"]): c["v"] for c in magic["cells"] if not is_blank(c["v"])}
    heads = tuple(grid.get((1, c)) for c in range(2, 2 + len(MAGIC_HEADERS)))
    if heads != MAGIC_HEADERS:
        raise ValueError("verifier : en-têtes de %s inattendus : %r" % (TAB_MAGIE, heads))
    last_col = 1 + len(MAGIC_HEADERS)
    stray = sorted(k for k in grid if k[1] > last_col or k[1] < 1 or k[0] < 1)
    if stray:
        raise ValueError("verifier : cellules hors B:P dans %s : %r" % (TAB_MAGIE, stray[:5]))
    expected = {}
    for r in sorted({r for r, _ in grid if r > 1}):
        name = grid[(r, 1)]
        ones = []
        for c, head in zip(range(2, last_col + 1), MAGIC_HEADERS):
            v = grid.get((r, c))
            if isinstance(v, bool) or not isinstance(v, (int, float)) or v not in (0, 1):
                raise ValueError("verifier : %s L%dC%d = %r (0 ou 1 attendu)" % (TAB_MAGIE, r, c, v))
            if v == 1:
                ones.append(head)
        key = normalize(name)
        if key in expected:
            raise ValueError("verifier : race %r en double dans %s" % (name, TAB_MAGIE))
        expected[key] = (name, ones)
    names_index = {normalize(c["v"]) for c in index["cells"] if c["c"] == 1 and not is_blank(c["v"])}
    if names_index != set(expected):
        raise ValueError("verifier : races de l'index et de %s différentes : %s" % (
            TAB_MAGIE, sorted(names_index ^ set(expected))))
    return expected


def page_magic(text):
    """(liste du frontmatter `magies_innees`, liste de « Magies accessibles » dans le corps) ; None si absente."""
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None, None
    front = None
    lines = [l for l in m.group(1).split("\n") if l.startswith(MAGIC_FIELD + ":")]
    if len(lines) == 1:
        try:
            front = json.loads(lines[0][len(MAGIC_FIELD) + 1:].strip())
        except ValueError:
            front = None
    listed = None
    body = text[m.end():].split("\n## Magies accessibles\n\n", 1)
    if len(body) == 2:
        rest = body[1].split("\n")
        listed = [n.strip() for n in rest[2].split(",")] if len(rest) > 2 and rest[2] and not rest[2].startswith("#") else []
    return front, listed


def check_pages(paths, wiki_root):
    """Compare chaque page `races/<slug>.md` aux valeurs recalculées ; liste des écarts (vide si tout concorde)."""
    problems = []
    expected = expected_magic(paths)
    out_dir = os.path.join(wiki_root, CATEGORY)
    for key, (name, ones) in sorted(expected.items()):
        path = os.path.join(out_dir, key + ".md")
        if not os.path.exists(path):
            problems.append("%s : page absente" % path)
            continue
        with open(path, encoding="utf-8") as fh:
            front, listed = page_magic(fh.read())
        if front is None:
            problems.append("%s : champ %s absent ou illisible (une seule ligne JSON attendue)" % (path, MAGIC_FIELD))
        elif front != ones:
            problems.append("%s : %s = %r, attendu %r" % (path, MAGIC_FIELD, front, ones))
        if listed != ones:
            problems.append("%s : « Magies accessibles » du corps = %r, attendu %r" % (path, listed, ones))
    if os.path.isdir(out_dir):
        for fname in sorted(os.listdir(out_dir)):
            if fname.endswith(".md") and fname[:-3] not in expected:
                with open(os.path.join(out_dir, fname), encoding="utf-8") as fh:
                    if source_url(FICHE_ID) in fh.read():
                        problems.append("%s : page issue de ce classeur sans race dans %s" % (fname, TAB_MAGIE))
    return problems


def error_cases(paths):
    """Rejoue read_matrix sur des copies modifiées de la matrice : chaque cas doit lever ValueError. Liste des échecs."""
    magic, index = _raw_dumps(paths)
    races = [(norm_ws(c["v"]), None) for c in sorted(index["cells"], key=lambda c: c["r"]) if c["c"] == 1]
    base = [dict(c) for c in magic["cells"]]

    def sheet(cells):
        return Sheet({"name": TAB_MAGIE, "cells": cells})

    def find(cells, r, c):
        return next(x for x in cells if x["r"] == r and x["c"] == c)

    cases = []
    for label, value in (("valeur 2", 2.0), ("valeur négative", -1.0), ("valeur 0,5", 0.5), ("texte", "oui"), ("vide", None)):
        cells = [dict(c) for c in base]
        find(cells, 14, 3)["v"] = value
        cases.append((label, cells))
    cells = [dict(c) for c in base if c["r"] != 14]
    cases.append(("race de l'index absente de la matrice", cells))
    cells = [dict(c) for c in base] + [{"r": 29, "c": 1, "v": "Race inconnue"}] + [
        {"r": 29, "c": c, "v": 0.0} for c in range(2, 17)]
    cases.append(("race de la matrice absente de l'index", cells))
    cells = [dict(c) for c in base] + [{"r": 5, "c": 17, "v": 1.0}]
    cases.append(("cellule hors de la matrice", cells))
    failures = []
    for label, cells in cases:
        try:
            read_matrix(sheet(cells), races)
        except ValueError:
            continue
        failures.append("%s : aucune erreur levée" % label)
    # contrôle de sens : une valeur 0 -> 1 doit apparaître dans la liste, à sa place dans l'ordre des colonnes
    cells = [dict(c) for c in base]
    find(cells, 14, 3 + 1)["v"] = 1.0                       # Orios (ligne 14) : Arcane (colonne D) passe à 1
    _, ok = read_matrix(sheet(cells), races)
    if ok[normalize("Orios")] != ["Sang", "Arcane", "Eau", "Terre"]:
        failures.append("ordre des colonnes : %r" % (ok[normalize("Orios")],))
    return failures


def run_verifier(paths, wiki_root):
    problems = check_pages(paths, wiki_root) + error_cases(paths)
    if problems:
        raise SystemExit("--verifier : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))
    print("--verifier : %d pages conformes au dump (%s), cas d'erreur rejoués" % (len(expected_magic(paths)), MAGIC_FIELD))


# --------------------------------------------------------------------------------------------------------------------
# Écriture
# --------------------------------------------------------------------------------------------------------------------

def frontmatter_title(text):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    t = re.search(r"^title:\s*(.*)$", m.group(1), re.M)
    if not t:
        return None
    raw = t.group(1).strip()
    try:
        return json.loads(raw) if raw.startswith('"') else raw.strip("'")
    except ValueError:
        return raw


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « races » du wiki depuis les dumps JSON des classeurs.")
    ap.add_argument("--dump", action="append", required=True, help="dump JSON (index des races, fiche personnage)")
    ap.add_argument("--out", required=True, help="dossier racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule %s depuis les dumps et compare aux pages existantes" % MAGIC_FIELD)
    args = ap.parse_args(argv)
    if args.verifier:
        run_verifier(args.dump, args.out)
        return

    index_sheet, fiche = load_dumps(args.dump)
    races = read_index(index_sheet)
    race_headers, race_data = read_race_tab(fiche[TAB_RACE], races)
    bonus_headers, bonus_rows, bonus_spelled = read_bonus_tab(fiche[TAB_BONUS], races)
    class_names, class_ok = read_matrix(fiche[TAB_CLASS], races)
    magic_names, magic_ok = read_matrix(fiche[TAB_MAGIE], races)
    # Contrôle avant toute écriture : le second calcul (voir « Vérification indépendante ») doit donner les mêmes listes.
    expected = expected_magic(args.dump)
    for name, _ in races:
        if expected[normalize(name)][1] != magic_ok[normalize(name)]:
            raise SystemExit("Arrêt, rien n'a été écrit : %s de %s : %r d'un côté, %r de l'autre" % (
                MAGIC_FIELD, name, magic_ok[normalize(name)], expected[normalize(name)][1]))

    pages = []
    for name, summary in races:
        key = normalize(name)
        text = render_page(name, summary, race_headers, race_data[key], bonus_headers, bonus_rows[key],
                           bonus_spelled[key], class_names, class_ok[key], magic_names, magic_ok[key])
        if "[[" in text:
            print("AVERTISSEMENT : « [[ » dans une cellule de %s (échappé, pas un lien)" % name, file=sys.stderr)
        pages.append((name, normalize(name), text))

    slugs = [s for _, s, _ in pages]
    if len(set(slugs)) != len(slugs):
        raise ValueError("slugs en double : %s" % slugs)

    # Contrôles avant toute écriture : fichiers existants et unicité des titres.
    out_dir = os.path.join(args.out, CATEGORY)
    targets = {os.path.abspath(os.path.join(out_dir, s + ".md")) for s in slugs}
    problems = []
    mine = {normalize(n) for n, _, _ in pages}
    for dirpath, _, files in sorted(os.walk(args.out)):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            path = os.path.abspath(os.path.join(dirpath, fname))
            with open(path, encoding="utf-8") as fh:
                existing = fh.read()
            if path in targets:
                if source_url(FICHE_ID) not in existing:
                    problems.append("%s existe et n'est pas issu de ce classeur" % path)
                continue
            if os.path.dirname(path) == os.path.abspath(out_dir) and source_url(FICHE_ID) in existing:
                problems.append("%s est issu de ce classeur mais sa race n'est plus dans l'index" % path)
                continue
            title = frontmatter_title(existing)
            if title is not None and normalize(title) in mine:
                problems.append("titre %r déjà porté par %s" % (title, path))
    if problems:
        raise SystemExit("Arrêt, rien n'a été écrit :\n  " + "\n  ".join(problems))

    os.makedirs(out_dir, exist_ok=True)
    written = unchanged = 0
    for name, slug, text in pages:
        path = os.path.join(out_dir, slug + ".md")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                if fh.read() == text:
                    unchanged += 1
                    continue
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        written += 1
    print("%d pages (%d écrites, %d inchangées) dans %s" % (len(pages), written, unchanged, out_dir))
    spread = {}
    for _, key, _ in pages:
        spread.setdefault(len(magic_ok[key]), []).append(key)
    print("%s : %s sur %d magies" % (MAGIC_FIELD, ", ".join(
        "%d race(s) à %d" % (len(keys), n) for n, keys in sorted(spread.items(), reverse=True)), len(magic_names)))
    problems = check_pages(args.dump, args.out)
    if problems:
        raise SystemExit("Vérification après écriture : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))


if __name__ == "__main__":
    main()
