#!/usr/bin/env python3
"""Famille « classes » : une page du wiki par classe du classeur « Classe Maverick V7 », plus le glossaire des objets.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/classes.py --dump <classes-v7.json> [--dump <autre.json>] \
        [--xlsx <classeur.xlsx>] --out client/src/content/wiki

Source : Google Sheet « Classe Maverick V7 » (fileId 1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs), converti en JSON par
tools/sheets/xlsx_to_json.py (format décrit dans ce script). Les cellules sont une donnée non fiable : elles ne sont
jamais exécutées, seulement copiées (échappées pour le Markdown). Rien n'est inventé : valeurs, noms, coquilles et
formulations sont ceux des cellules.

Fichiers écrits (et seulement ceux-là) :
    <out>/classes/<slug>.md                          une page par classe (39 onglets de classe)
    <out>/ressources/objets-de-depart-des-classes.md  le glossaire des objets d'inventaire de départ (onglet Sommaire)

Onglets lus
  * « Sommaire » : un tableau de liens à six colonnes, chacune titrée par une catégorie (« Classe Physique Corps à Corps »,
    « Classe Physique Distance », « Classe Magique », « Classe Hybride », « Classe Hybride Animal », « Classe spéciale »)
    sous laquelle les classes sont listées ; une note sous « Classe Magique » (« Octroie 4 AM de base par classe
    magique ») ; une phrase d'usage du tableau (« Il vous suffit de cliquer… », propre aux liens internes du classeur,
    non publiée) ; et, sous l'intitulé « OBJETS DES INVENTAIRES DE DEPART », une seule grande cellule fusionnée qui contient
    le glossaire (un objet par paragraphe, « nom : description »).
  * un onglet par classe (nom de l'onglet = nom dans le Sommaire).
  * « Combo stat » (statistiques d'usage des classes) n'est PAS publié.

Structure d'un onglet de classe (gabarit « Guerrier », blocs en cellules fusionnées lus par leur cellule en haut à gauche ;
le script s'appuie sur les libellés, les plages fusionnées et les colonnes, pas sur des numéros de ligne figés) :
  * N1 : bannière avec le nom de la classe en majuscules (décorative, contrôlée contre le nom de l'onglet) ;
  * « Don de départ » (A2) : trois valeurs Santé, Chakra, Barrière (libellé en A, valeur 4 colonnes plus loin), puis
    « Maîtrise Arme » et « Maîtrise Armures » (libellé fusionné, texte dans le bloc juste dessous) ;
  * « Inventaire de départ » (G2), « Arme de départ » (G6), « Armure de départ » (G10), même disposition ;
  * « CHOSE A SAVOIR » (colonne Z, ligne 1 ou 2) : texte libre, présent dans certaines classes seulement ;
  * colonne P : aptitudes de classe (Lvl 1, Lvl 5, Lvl 20) ;
  * ligne 17 : deux bannières de sous-classe en majuscules (A17 et X17) ; sous chacune, l'aptitude « Lvl 10 » qui porte
    le nom de la sous-classe, puis deux colonnes d'aptitudes (Lvl 10, 15, 20 chacune) ;
  * colonnes AL/AM et suivantes : textes de description (titre sur une ligne, texte dans le bloc dessous) : le premier est
    celui de la classe, les suivants ceux des sous-classes dans l'ordre des bannières ;
  * une « aptitude » est toujours : cellule « Lvl N » (fusionnée sur 2 colonnes), nom 2 colonnes plus loin, bloc d'effet
    juste dessous, puis une cellule de type (Passif, Actif, Réaction, Variable…) sous le bloc d'effet.
Variantes : Archimage n'a pas de bannières de sous-classe (ses aptitudes de niveau 10 à 20 sont posées en trois colonnes
sous deux cartouches « Lvl 10 ») ; Mage Bleu ajoute, sous ses aptitudes, un tableau sans titre de 14 lignes (libellé en A,
texte en G) ; Archer et Arbalètrier ont leurs descriptions une colonne plus à gauche (AL) ; Grenadier n'en a aucune ; Tueur,
Mage Bleu, Archer (Grand Archer), Anansi et Goleois ont des titres de description sans texte (le titre est alors publié seul). Le script s'arrête avec une erreur si une cellule non vide n'est pas reconnue : rien n'est perdu
en silence.

Commentaires de cellule : le dump JSON ne les contient pas. Ils sont lus directement dans le .xlsx d'origine (zipfile + xml,
sans openpyxl). L'option --xlsx donne le chemin du classeur ; à défaut le script le cherche à côté du dump
(<dossier du dump>/../sheets/<fileId>/classeur.xlsx). Introuvable : erreur, sauf --sans-commentaires. Chaque commentaire
est rattaché à l'aptitude dont il commente le bloc d'effet et rendu dans la colonne « Effet » sous la forme
« Note de cellule : … ». Les liens hypertextes de cellule ne sont pas reproduits.

Titres : le titre d'une page est le nom de l'onglet. Exception : les 13 classes de la catégorie « Classe Hybride Animal »
portent le nom d'une race jouable (Orios, Fenrir…) ; leur titre prend le suffixe « (classe) » pour rester unique dans le
wiki (leur slug reste le nom seul, dans classes/). Le script refuse un titre déjà porté par une page d'une autre famille.

Ne touche qu'aux fichiers de sa famille : il refuse d'écraser un fichier qui n'est pas issu de ce classeur, refuse un
titre déjà pris par une autre page, et n'efface rien.
"""
import argparse
import json
import os
import posixpath
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET

WORKBOOK = "Classe Maverick V7"
FILE_ID = "1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID
CATEGORY = "classes"
GLOSSARY_CATEGORY = "ressources"
GLOSSARY_SLUG = "objets-de-depart-des-classes"
GLOSSARY_TITLE = "Objets des inventaires de départ"

SUMMARY_SHEET = "Sommaire"
IGNORED_SHEETS = {"Combo stat"}  # statistiques d'usage : décrites dans le rapport, non publiées

# Catégories du Sommaire (texte exact de la cellule d'en-tête) -> tag
CATEGORY_TAGS = {
    "Classe Physique Corps à Corps": "càc",
    "Classe Physique Distance": "distance",
    "Classe Magique": "magique",
    "Classe Hybride": "hybride",
    "Classe Hybride Animal": "hybride animal",
    "Classe spéciale": "spéciale",
}
# Catégories dont les classes portent le nom d'une race : le titre prend le suffixe « (classe) ».
SUFFIXED_CATEGORIES = {"Classe Hybride Animal"}
TITLE_SUFFIX = " (classe)"

# Colonnes (numéros à partir de 1)
COL_BANNER = 14          # N : bannière avec le nom de la classe
COL_CLASS_ABILITY = 16   # P : aptitudes de classe
COL_RIGHT = 38           # AL : textes de description
LEFT_LIMIT = 13          # M : fin du bloc de gauche (départ, inventaire)
ROW_TOP_MAX = 16         # le bloc de départ est au-dessus de la ligne 17
BANNER_ROW = 17          # bannières de sous-classe
TAIL_ROW_MIN = 56        # tableau sans titre de Mage Bleu (A58 et suivantes)
TAIL_LABEL_COL, TAIL_TEXT_COL = 1, 7

STAT_LABELS = ("Santé", "Chakra", "Barrière")
START_HEADERS = ("Maîtrise Arme", "Maîtrise Armures", "Inventaire de départ", "Arme de départ", "Armure de départ")
GIFT_HEADER = "Don de départ"
KNOW_HEADER = "CHOSE A SAVOIR"
LVL_RE = re.compile(r"^Lvl\s+\d+\b")


# --------------------------------------------------------------------------------------------------------------------
# Utilitaires de cellules
# --------------------------------------------------------------------------------------------------------------------

def col_letters(n):
    out = ""
    while n:
        n, m = divmod(n - 1, 26)
        out = chr(65 + m) + out
    return out


def col_number(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def split_ref(ref):
    m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    if not m:
        raise ValueError("référence de cellule invalide : %r" % ref)
    return int(m.group(2)), col_number(m.group(1))


def parse_range(rng):
    m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", rng)
    if not m:
        raise ValueError("plage fusionnée invalide : %r" % rng)
    return int(m.group(2)), col_number(m.group(1)), int(m.group(4)), col_number(m.group(3))


def ref_of(r, c):
    return "%s%d" % (col_letters(c), r)


def fmt(value):
    """Valeur en cache -> texte, sans arrondi (9.0 reste « 9.0 »)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int):
        return str(value)
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def is_blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def fold(text):
    """Comparaison sans accents ni casse, espaces normalisés."""
    text = unicodedata.normalize("NFD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.casefold()).strip()


def wiki_key(text):
    """Même clé que normalize() de client/src/lib/text.mjs (résolution des titres du wiki)."""
    text = unicodedata.normalize("NFD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"['’]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def slugify(text):
    return wiki_key(text)


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}   # (ligne, colonne) -> valeur, cellules non vides
        self.blank = {}   # cellules ne contenant que des espaces (décor), ignorées
        for c in raw["cells"]:
            key = (c["r"], c["c"])
            if is_blank(c["v"]):
                if c["v"] is not None:
                    self.blank[key] = c["v"]
            else:
                self.cells[key] = c["v"]
        self.merges = {}  # (ligne, colonne) en haut à gauche -> (ligne, colonne) en bas à droite
        for rng in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(rng)
            self.merges[(r1, c1)] = (r2, c2)
        self.consumed = set()

    def take(self, r, c):
        """Lit une cellule et la marque comme utilisée."""
        self.consumed.add((r, c))
        return self.cells.get((r, c))

    def width(self, r, c):
        return self.merges[(r, c)][1] - c + 1 if (r, c) in self.merges else 1

    def height(self, r, c):
        return self.merges[(r, c)][0] - r + 1 if (r, c) in self.merges else 1

    def top_left(self, r, c):
        """Cellule en haut à gauche de la plage fusionnée qui contient (r, c)."""
        for (r1, c1), (r2, c2) in self.merges.items():
            if r1 <= r <= r2 and c1 <= c <= c2:
                return r1, c1
        return r, c

    def find(self, text, max_row=None, max_col=None):
        """Cellules non consommées dont le texte est exactement `text` (aux espaces près)."""
        out = []
        for (r, c), v in sorted(self.cells.items()):
            if (r, c) in self.consumed or not isinstance(v, str):
                continue
            if max_row is not None and r > max_row:
                continue
            if max_col is not None and c > max_col:
                continue
            if fold(v) == fold(text):
                out.append((r, c))
        return out


# --------------------------------------------------------------------------------------------------------------------
# Échappement Markdown
# --------------------------------------------------------------------------------------------------------------------

def _esc_plain(s):
    s = s.replace("\\", "\\\\")
    s = re.sub(r"([`*_\[\]<~])", r"\\\1", s)
    s = re.sub(r"&(?=#?\w+;)", r"\\&", s)
    return s


def esc_inline(s):
    """Échappe un texte d'une ligne pour le Markdown."""
    line = _esc_plain(s)
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


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    return out


# --------------------------------------------------------------------------------------------------------------------
# Commentaires de cellule (lus dans le .xlsx)
# --------------------------------------------------------------------------------------------------------------------

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
MAX_MEMBER = 8 * 1024 * 1024


def _xml(zf, name):
    info = zf.getinfo(name)
    if info.file_size > MAX_MEMBER:
        raise ValueError("entrée .xlsx trop grande : %s" % name)
    data = zf.read(name)
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("XML avec DTD refusé : %s" % name)
    return ET.fromstring(data)


def read_comments(xlsx_path):
    """{onglet: {ref: texte}} : notes (commentaires hérités) lues directement dans le .xlsx."""
    result = {}
    with zipfile.ZipFile(xlsx_path) as zf:
        workbook = _xml(zf, "xl/workbook.xml")
        rels = {r.get("Id"): r.get("Target") for r in _xml(zf, "xl/_rels/workbook.xml.rels")}
        for sheet in workbook.find("{%s}sheets" % NS_MAIN):
            name = sheet.get("name")
            path = posixpath.normpath(posixpath.join("xl", rels[sheet.get("{%s}id" % NS_REL)]))
            rel_path = posixpath.join(posixpath.dirname(path), "_rels", posixpath.basename(path) + ".rels")
            notes = {}
            if rel_path in zf.namelist():
                for rel in _xml(zf, rel_path):
                    kind = rel.get("Type").rsplit("/", 1)[-1]
                    target = posixpath.normpath(posixpath.join(posixpath.dirname(path), rel.get("Target")))
                    if kind == "comments":
                        for c in _xml(zf, target).find("{%s}commentList" % NS_MAIN):
                            text = "".join(t.text or "" for t in c.iter("{%s}t" % NS_MAIN))
                            if not is_blank(text):
                                notes[c.get("ref")] = text.replace("\r\n", "\n").replace("\r", "\n").strip()
                    elif kind == "threadedComment":
                        raise ValueError("fil de commentaires dans l'onglet %r : non géré par ce script" % name)
            result[name] = notes
    return result


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Sommaire »
# --------------------------------------------------------------------------------------------------------------------

def parse_summary(sh, class_sheet_names):
    """-> dict(classes=[(nom, catégorie)], notes={catégorie: [texte]}, glossary_title, glossary=[(objet, description)])."""
    cells = sh.cells
    headers = []
    for (r, c), v in sorted(cells.items()):
        if r == 1:
            headers.append((c, fmt(sh.take(r, c))))
    for _, h in headers:
        if h not in CATEGORY_TAGS:
            raise ValueError("Sommaire : catégorie inconnue %r" % h)

    def category_of(c):
        cat = None
        for hc, h in headers:
            if hc <= c:
                cat = h
        return cat

    classes, notes = [], {}
    for (r, c), v in sorted(cells.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if (r, c) in sh.consumed or not (2 <= r <= 16):
            continue
        text = fmt(sh.take(r, c))
        if text in class_sheet_names:
            classes.append((text, category_of(c)))
        else:
            notes.setdefault(category_of(c), []).append(text)

    # phrase d'usage du tableau de liens (A17), propre aux liens internes du classeur : non publiée
    usage = [pos for pos, v in cells.items() if pos[0] == 17]
    for pos in usage:
        sh.take(*pos)

    # glossaire : un intitulé (ligne 19) puis une grande cellule (ligne 21)
    head = [pos for pos in cells if pos[0] == 19]
    body = [pos for pos in cells if pos[0] == 21]
    if len(head) != 1 or len(body) != 1:
        raise ValueError("Sommaire : intitulé ou texte du glossaire introuvable")
    glossary_title = fmt(sh.take(*head[0]))
    glossary = []
    for chunk in re.split(r"\n\s*\n", fmt(sh.take(*body[0]))):
        chunk = chunk.strip()
        if not chunk:
            continue
        if " : " not in chunk:
            raise ValueError("Sommaire : objet du glossaire sans « : » : %r" % chunk)
        name, desc = chunk.split(" : ", 1)
        glossary.append((name.strip(), desc.strip()))

    left = [ref_of(*pos) for pos in cells if pos not in sh.consumed]
    if left:
        raise ValueError("Sommaire : cellules non reconnues : %s" % ", ".join(left))
    return dict(classes=classes, notes=notes, usage=[fmt(cells[p]) for p in usage],
                glossary_title=glossary_title, glossary=glossary)


# --------------------------------------------------------------------------------------------------------------------
# Onglet de classe
# --------------------------------------------------------------------------------------------------------------------

def below(sh, r, c):
    """Cellule en haut à gauche du bloc situé juste sous la cellule (r, c) (compte tenu de sa fusion)."""
    return r + sh.height(r, c), c


def parse_ability(sh, r, c):
    level = fmt(sh.take(r, c))
    name = sh.take(r, c + sh.width(r, c))
    dr, dc = r + 1, c
    desc = sh.take(dr, dc)
    tr = dr + sh.height(dr, dc)
    typ = None
    if not (isinstance(sh.cells.get((tr, c)), str) and LVL_RE.match(sh.cells[(tr, c)])):
        typ = sh.take(tr, c)
    return dict(row=r, col=c, level=level, name=fmt(name) if name is not None else "",
                type=fmt(typ) if typ is not None else "", desc=fmt(desc) if desc is not None else "",
                desc_pos=(dr, dc), notes=[])


def parse_class(sh, name):
    cells = sh.cells
    page = {}

    banner = sh.take(1, COL_BANNER)
    if banner is None or fold(banner) != fold(name):
        raise ValueError("%s : bannière N1 %r incohérente avec le nom de l'onglet" % (sh.name, banner))
    page["banner"] = fmt(banner)

    # « Don de départ » : l'intitulé seul, puis les trois valeurs et les blocs de texte
    gift = sh.find(GIFT_HEADER, max_row=ROW_TOP_MAX)
    if len(gift) != 1:
        raise ValueError("%s : intitulé %r introuvable" % (sh.name, GIFT_HEADER))
    page["gift_header"] = fmt(sh.take(*gift[0]))
    stats = []
    for label in STAT_LABELS:
        pos = sh.find(label, max_row=ROW_TOP_MAX, max_col=LEFT_LIMIT)
        if len(pos) != 1:
            raise ValueError("%s : libellé %r introuvable" % (sh.name, label))
        r, c = pos[0]
        shown = fmt(sh.take(r, c))
        value = sh.take(r, c + sh.width(r, c))
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError("%s : valeur de %r non numérique : %r" % (sh.name, label, value))
        stats.append((shown, fmt(value)))
    page["stats"] = stats
    page["blocks"] = {}
    for label in START_HEADERS:
        pos = sh.find(label, max_row=ROW_TOP_MAX, max_col=LEFT_LIMIT)
        if len(pos) != 1:
            raise ValueError("%s : intitulé %r introuvable" % (sh.name, label))
        r, c = pos[0]
        head = fmt(sh.take(r, c))
        content = sh.take(*below(sh, r, c))
        page["blocks"][label] = (head, fmt(content) if content is not None else None)

    # « CHOSE A SAVOIR » (facultatif)
    know = sh.find(KNOW_HEADER, max_row=ROW_TOP_MAX)
    page["know"] = None
    if len(know) > 1:
        raise ValueError("%s : plusieurs intitulés %r" % (sh.name, KNOW_HEADER))
    if know:
        r, c = know[0]
        head = fmt(sh.take(r, c))
        content = sh.take(*below(sh, r, c))
        page["know"] = (head, fmt(content) if content is not None else None)

    # bannières de sous-classe (ligne 17)
    banners = []
    for (r, c), v in sorted(cells.items()):
        if r == BANNER_ROW and c < COL_RIGHT and (r, c) not in sh.consumed:
            banners.append(dict(name=fmt(sh.take(r, c)), c1=c, c2=c + sh.width(r, c) - 1, abilities=[], desc=None))
    banners.sort(key=lambda b: b["c1"])

    # aptitudes : toute cellule « Lvl N »
    lvl_cells = [pos for pos, v in sorted(cells.items())
                 if isinstance(v, str) and LVL_RE.match(v) and pos not in sh.consumed]
    page["class_abilities"], page["other_abilities"] = [], []
    for (r, c) in lvl_cells:
        ab = parse_ability(sh, r, c)
        if c == COL_CLASS_ABILITY:
            page["class_abilities"].append(ab)
            continue
        for b in banners:
            if b["c1"] <= c <= b["c2"]:
                b["abilities"].append(ab)
                break
        else:
            page["other_abilities"].append(ab)
    if banners and page["other_abilities"]:
        raise ValueError("%s : aptitudes hors des bannières de sous-classe" % sh.name)
    page["banners"] = banners
    page["class_desc"] = None

    # textes de description (colonnes AL et suivantes) : titre sur une ligne, texte dans le bloc dessous
    panel = []
    for (r, c), v in sorted(cells.items()):
        if c >= COL_RIGHT and (r, c) not in sh.consumed:
            if sh.height(r, c) != 1:
                raise ValueError("%s : cellule %s de la zone de description sans titre" % (sh.name, ref_of(r, c)))
            title = fmt(sh.take(r, c))
            text = sh.take(r + 1, c)
            panel.append((r, title, fmt(text) if text is not None else None))
    if panel:
        if panel[0][0] != 1:
            raise ValueError("%s : premier titre de description hors de la ligne 1" % sh.name)
        page["class_desc"] = (panel[0][1], panel[0][2])
        rest = panel[1:]
        if len(rest) > len(banners):
            raise ValueError("%s : %d descriptions de sous-classe pour %d bannières" % (sh.name, len(rest), len(banners)))
        for b, (_, title, text) in zip(banners, rest):
            b["desc"] = (title, text)

    # tableau sans titre en bas de l'onglet (Mage Bleu) : libellé en A, texte en G
    tail = []
    for (r, c), v in sorted(cells.items()):
        if (r, c) in sh.consumed or r < TAIL_ROW_MIN or c != TAIL_LABEL_COL:
            continue
        if (r, TAIL_TEXT_COL) not in cells:
            continue
        tail.append((fmt(sh.take(r, c)), fmt(sh.take(r, TAIL_TEXT_COL))))
    page["tail"] = tail

    left = [ref_of(*pos) + "=" + repr(cells[pos])[:40] for pos in sorted(cells) if pos not in sh.consumed]
    if left:
        raise ValueError("%s : cellules non reconnues : %s" % (sh.name, ", ".join(left)))
    return page


def attach_notes(sh, page, notes):
    """Rattache les commentaires de cellule au bloc d'effet des aptitudes."""
    abilities = list(page["class_abilities"]) + list(page["other_abilities"])
    for b in page["banners"]:
        abilities += b["abilities"]
    by_pos = {a["desc_pos"]: a for a in abilities}
    for ref in sorted(notes, key=split_ref):
        r, c = split_ref(ref)
        pos = sh.top_left(r, c)
        if pos not in by_pos:
            raise ValueError("%s : commentaire en %s hors d'un bloc d'effet d'aptitude : %r" % (sh.name, ref, notes[ref]))
        by_pos[pos]["notes"].append(notes[ref])


# --------------------------------------------------------------------------------------------------------------------
# Rendu
# --------------------------------------------------------------------------------------------------------------------

def first_sentence(text):
    para = fmt(text).split("\n")[0].strip()
    m = re.match(r"(.+?[.!?])(?=\s|$)", para)
    return m.group(1) if m else para


def ability_rows(abilities):
    rows = []
    for a in abilities:
        effect = cell_md(a["desc"]) if a["desc"] else ""
        for note in a["notes"]:
            effect += ("<br><br>" if effect else "") + "Note de cellule : " + cell_md(note)
        rows.append([cell_md(a["level"]), cell_md(a["name"]), cell_md(a["type"]), effect])
    return table(["Niveau", "Aptitude", "Type", "Effet"], rows)


def text_section(L, level, heading, text):
    L += ["#" * level + " " + esc_inline(heading), ""]
    if text:
        L += md_text(text) + [""]


def front_matter(cfg, summary):
    lines = ["---",
             "title: " + yaml_str(cfg["title"]),
             "aliases: " + yaml_list(cfg["aliases"]),
             "tags: " + yaml_list(cfg["tags"])]
    if summary:
        lines.append("summary: " + yaml_str(summary))
    lines += ["sources: " + yaml_list(["Google Sheet « %s », onglet « %s »" % (WORKBOOK, cfg["sheet"]), URL]),
              "status: draft", "---", ""]
    return lines


def render_class(cfg, page):
    summary = first_sentence(page["class_desc"][1]) if page["class_desc"] and page["class_desc"][1] else None
    L = front_matter(cfg, summary)
    L += ["**Catégorie** : " + esc_inline(cfg["category"]), ""]
    for note in cfg["category_notes"]:
        L += ["**Note du Sommaire** : " + esc_inline(note), ""]

    if page["class_desc"]:
        text_section(L, 2, *page["class_desc"])
    if page["know"]:
        text_section(L, 2, *page["know"])

    L += ["## " + esc_inline(page["gift_header"]), ""]
    L += table([esc_inline(s[0]) for s in page["stats"]], [[s[1] for s in page["stats"]]]) + [""]
    for label in ("Maîtrise Arme", "Maîtrise Armures"):
        head, content = page["blocks"][label]
        text_section(L, 3, head, content)
    head, content = page["blocks"]["Inventaire de départ"]
    text_section(L, 2, head, content)
    for label in ("Arme de départ", "Armure de départ"):
        head, content = page["blocks"][label]
        text_section(L, 3, head, content)

    if page["class_abilities"]:
        L += ["## Aptitudes de la classe", ""] + ability_rows(page["class_abilities"]) + [""]
    if page["banners"]:
        L += ["## Sous-classes", ""]
        for b in page["banners"]:
            L += ["### " + esc_inline(b["name"]), ""]
            if b["desc"]:
                text_section(L, 4, *b["desc"])
            if b["abilities"]:
                L += ability_rows(b["abilities"]) + [""]
    elif page["other_abilities"]:
        L += ["## Autres aptitudes", ""] + ability_rows(page["other_abilities"]) + [""]
    if page["tail"]:
        L += ["## Tableau sans titre en bas de l'onglet", ""]
        L += table(["Libellé", "Texte"], [[cell_md(a), cell_md(b)] for a, b in page["tail"]]) + [""]

    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


def render_glossary(title_cell, items):
    cfg = dict(title=GLOSSARY_TITLE,
               aliases=[title_cell] if title_cell != GLOSSARY_TITLE else [],
               tags=["objets", "inventaire de départ"], sheet=SUMMARY_SHEET)
    L = front_matter(cfg, None)
    L += table(["Objet", "Description"], [[cell_md(n), cell_md(d)] for n, d in items])
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Écriture sûre
# --------------------------------------------------------------------------------------------------------------------

def read_title(path):
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n", 40)[:40]
    except OSError:
        return None
    if not lines or lines[0].strip() != "---":
        return None
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"title:\s*(.*)$", line)
        if m:
            value = m.group(1).strip()
            if value.startswith('"'):
                try:
                    return json.loads(value)
                except ValueError:
                    return value.strip('"')
            return value.strip("'")
    return None


def is_ours(path):
    try:
        with open(path, encoding="utf-8") as fh:
            head = fh.read(4000)
    except OSError:
        return False
    return URL in head and "« %s »" % WORKBOOK in head


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « classes » du wiki depuis le dump de « %s »." % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py (répétable)")
    ap.add_argument("--xlsx", help="classeur d'origine (commentaires de cellule)")
    ap.add_argument("--sans-commentaires", action="store_true", help="ne pas lire les commentaires de cellule")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    args = ap.parse_args(argv)

    sheets, order, dump_dirs = {}, [], []
    for path in args.dump:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        dump_dirs.append(os.path.dirname(os.path.abspath(path)))
        for raw in data["sheets"]:
            if raw["name"] not in sheets:
                sheets[raw["name"]] = raw
                order.append(raw["name"])
    if SUMMARY_SHEET not in sheets:
        sys.exit("onglet %r absent du dump" % SUMMARY_SHEET)
    class_names = [n for n in order if n != SUMMARY_SHEET and n not in IGNORED_SHEETS]

    comments = {}
    if not args.sans_commentaires:
        xlsx = args.xlsx
        if not xlsx:
            for d in dump_dirs:
                cand = os.path.join(d, os.pardir, "sheets", FILE_ID, "classeur.xlsx")
                if os.path.isfile(cand):
                    xlsx = cand
                    break
        if not xlsx or not os.path.isfile(xlsx):
            sys.exit("classeur .xlsx introuvable (option --xlsx) : les commentaires de cellule en dépendent "
                     "(ou passer --sans-commentaires)")
        comments = read_comments(xlsx)

    problems = []
    try:
        summary = parse_summary(Sheet(sheets[SUMMARY_SHEET]), set(class_names))
    except ValueError as err:
        sys.exit("ERREUR : %s" % err)
    in_summary = [n for n, _ in summary["classes"]]
    if sorted(in_summary) != sorted(class_names):
        sys.exit("ERREUR : onglets de classe et classes du Sommaire différents : %s"
                 % sorted(set(class_names) ^ set(in_summary)))
    category_of = dict(summary["classes"])

    # pages à produire
    jobs = []
    for name in class_names:
        category = category_of[name]
        title = name + (TITLE_SUFFIX if category in SUFFIXED_CATEGORIES else "")
        cfg = dict(sheet=name, title=title, slug=slugify(name), aliases=[], category=category,
                   category_notes=summary["notes"].get(category, []), tags=["classe", CATEGORY_TAGS[category]])
        sh = Sheet(sheets[name])
        try:
            page = parse_class(sh, name)
            if fold(page["banner"]) != fold(name) or wiki_key(page["banner"]) != wiki_key(name):
                cfg["aliases"] = [page["banner"]]
            attach_notes(sh, page, comments.get(name, {}))
            body = render_class(cfg, page)
        except ValueError as err:
            problems.append(str(err))
            continue
        jobs.append((CATEGORY, cfg["slug"], title, body, len(page["class_abilities"]) + len(page["other_abilities"])
                     + sum(len(b["abilities"]) for b in page["banners"])))
    jobs.append((GLOSSARY_CATEGORY, GLOSSARY_SLUG, GLOSSARY_TITLE,
                 render_glossary(summary["glossary_title"], summary["glossary"]), len(summary["glossary"])))

    # titres et fichiers des autres familles
    other_titles = {}
    for sub in sorted(os.listdir(args.out)):
        sub_path = os.path.join(args.out, sub)
        if not os.path.isdir(sub_path):
            continue
        for fname in sorted(os.listdir(sub_path)):
            full = os.path.join(sub_path, fname)
            if fname.endswith(".md") and not is_ours(full):
                t = read_title(full)
                if t:
                    other_titles[wiki_key(t)] = full
    seen_titles, seen_paths = {}, {}
    for category, slug, title, body, n in jobs:
        key = wiki_key(title)
        if key in other_titles:
            problems.append("titre déjà utilisé par %s : %r" % (other_titles[key], title))
        if key in seen_titles:
            problems.append("titre en double dans la famille : %r" % title)
        seen_titles[key] = title
        path = os.path.join(args.out, category, slug + ".md")
        if path in seen_paths:
            problems.append("slug en double : %s" % path)
        seen_paths[path] = title
        if os.path.exists(path) and not is_ours(path):
            problems.append("fichier existant qui n'est pas de cette famille, non écrasé : %s" % path)
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1

    for category, slug, title, body, n in jobs:
        out_dir = os.path.join(args.out, category)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, slug + ".md")
        old = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
        if old != body:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(body)
        print("%s %s (%d %s)" % ("inchangé" if old == body else "écrit", path, n,
                                  "objets" if category == GLOSSARY_CATEGORY else "aptitudes"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
