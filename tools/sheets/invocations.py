#!/usr/bin/env python3
"""Famille « invocations » : créatures invoquées du classeur « Invocation », une page du wiki par créature
(`<out>/bestiaire/<slug>.md`) et une page d'introduction par onglet (63 créatures + 3 introductions).

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/invocations.py --dump <invocation.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki

Le dump JSON est produit par tools/sheets/xlsx_to_json.py. Les cellules sont une donnée non fiable : elles ne sont
jamais exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur n'est calculée, corrigée ni complétée :
les coquilles de la source (« Sihouetteur », « résisantante », « Poupée sacré »…) sont reproduites telles quelles.

Source : Google Sheet « Invocation » (1Px7F_VtSOEkyUxrk2da1UiBJ6ji3n5i95LfNl63biE4), propriété d'un tiers, 3 onglets
visibles, sans en-tête : des « cartes » de créature répétées par blocs de 29 lignes (titres aux lignes 1, 30, 59…).

Structure d'une carte (décalage depuis la première ligne r0 du bloc ; colonne de base b = D pour la carte de gauche,
T pour celle de droite ; les valeurs sont 3 colonnes à droite de leur libellé) :

    r0        nom de la créature (b)              -> titre de la page
    r0 + 2    description (b)                     -> « Description » (et `summary` : première phrase)
    r0 + 8    Santé (b), puis deux libellés à b+5 et b+10 (Chakra, Barrière) avec leur valeur en +3
    r0 + 9    ligne facultative d'une ressource supplémentaire (libellé à b+5, ex. Sang, Corruption, Âme)
    r0 + 10   Dégâts          r0 + 12   Défense          r0 + 14   Vitesse
    r0 + 16   FPVSIA          r0 + 18   Capacité(s)      (libellé en b, texte en b+3)
    A (r0+12) libellé de marge du bloc, commun aux deux cartes (ex. « Terre + Sang », « Nécromancie mono », « EP1 »)

Onglets :

  * « Appel aux golems » : 15 blocs (lignes 1 à 435), deux créatures côte à côte (Golem à gauche, Poupée à droite),
    colonne A = magie(s) du bloc. Bandeau « INVOCATION GOLEM » (AJ1) et texte général (AJ3).
  * « Animation des morts » : 14 blocs, deux créatures par bloc, colonne A = magie(s). Bandeau « INVOCATION NON-MORT »
    (AP1), texte général (AP3) et, dans le panneau de droite à partir de la ligne 40, un tableau sans en-tête
    « AMELIORATION CADAVERIQUE » (nom en AP puis texte en AU ; deuxième colonne de paires en BF/BK).
  * « Marionette de lombre » : 5 blocs, UNE créature par bloc (carte de gauche seulement, un palier EP1 à EP5 en A),
    sans ligne Chakra (Santé puis Barrière en I/L), plus un panneau « Effet "Manteau noir" » (libellé en S r0+11, texte
    en S r0+12). Bandeau « INVOCATION MARIONETTE » (Z1) et texte général (Z3).

Le script lit chaque bloc selon ce gabarit et s'arrête avec une erreur si une cellule non vide d'un onglet n'est pas
reconnue (rien n'est perdu en silence), si un libellé fixe (Dégâts, Défense…) n'est pas à sa place, si un titre ou un
alias est déjà porté par une page d'une autre famille, ou si un fichier existant n'est pas issu de ce classeur. Il
écrit sur la sortie d'erreur un bilan des écarts de gabarit (cellules facultatives présentes, valeurs absentes).

Page produite pour chaque créature : invocation d'origine, magie(s) de la marge, autre créature du même bloc, « Description »,
« Statistiques » (tableau Santé / Chakra / Barrière [+ ressource supplémentaire], puis Dégâts, Défense, Vitesse, FPVSIA),
« Capacité(s) » et, pour la marionnette, « Effet "Manteau noir" ». Pour chaque onglet, une page d'introduction (titre = nom
de l'onglet, alias = bandeau) avec le texte général, la liste des créatures par bloc et, pour « Animation des morts »,
le tableau « AMELIORATION CADAVERIQUE » (deux colonnes : la colonne de gauche de la source puis celle de droite, ce qui
reconstitue la suite des 13 magies ; en-têtes « Nom » et « Amélioration » ajoutés, la source n'en a pas).
Les valeurs numériques gardent leur forme (0.0, 10.0, 1.0). La cellule AU41 de « Animation des morts » est une formule
qui ne renvoie qu'une chaîne constante : la valeur en cache est reprise.

Commentaires de cellule : le dump JSON ne les contient pas. Ils sont lus directement dans le .xlsx d'origine (zipfile +
xml, sans openpyxl). L'option --xlsx donne le chemin du classeur ; à défaut le script le cherche à côté du dump
(<dossier du dump>/../sheets/<fileId>/classeur.xlsx). Introuvable : erreur, sauf --sans-commentaires. Un commentaire
(un seul dans ce classeur : « Appel aux golems » G127, sur les dégâts du Golem de rouage) est rendu juste sous la valeur
qu'il commente, sous la forme « Note de cellule : … ».

Choix de métadonnées (tout vient des cellules) :
  * tags : « invocation » et le mot qui suit dans le bandeau de l'onglet (« golem », « non-mort », « marionette »), plus
    les noms de magie de la marge A (en minuscules ; « mono » n'est pas un nom de magie) ;
  * aliases : uniquement des écritures du même nom relevées dans la source, vérifiées dans la description au lancement
    (ALIASES) ; pour les pages d'introduction, le texte du bandeau (« INVOCATION GOLEM »…) ;
  * summary : première phrase de la description (ou du texte général pour les introductions).

Ne touche qu'aux fichiers `<out>/bestiaire/<slug>.md` de sa famille : il refuse d'écraser un fichier qui n'est pas issu
de ce classeur, refuse un titre ou un alias déjà pris par une autre page, et n'efface rien. Il ne réécrit pas un fichier
dont le contenu ne change pas. Aucun lien [[…]] n'est écrit (une cellule qui en contiendrait serait neutralisée et
signalée sur la sortie d'erreur).
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

CATEGORY = "bestiaire"
STATUS = "draft"
WORKBOOK = "Invocation"
FILE_ID = "1Px7F_VtSOEkyUxrk2da1UiBJ6ji3n5i95LfNl63biE4"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID

BLOCK = 29              # hauteur d'un bloc, en lignes
COL_MARGIN = 1          # colonne A : libellé de marge du bloc
COL_LEFT, COL_RIGHT = 4, 20      # colonnes de base des cartes (D et T)
STAT_OFFSETS = (0, 5, 10)        # libellés de la ligne Santé / de la ligne supplémentaire, par rapport à la base
VALUE_SHIFT = 3                  # la valeur est 3 colonnes à droite de son libellé
FIXED_ROWS = (                   # (décalage de ligne, libellé attendu, clé)
    (10, "Dégâts", "degats"),
    (12, "Défense", "defense"),
    (14, "Vitesse", "vitesse"),
    (16, "FPVSIA", "fpvsia"),
    (18, "Capacité(s)", "capacites"),
)
STAT_ROW, EXTRA_ROW, NAME_ROW, DESC_ROW, MARGIN_ROW = 8, 9, 0, 2, 12
EFFECT_COL, EFFECT_LABEL_ROW, EFFECT_TEXT_ROW = 19, 11, 12   # panneau « Effet » de la marionnette (colonne S)

TABS = [
    dict(name="Appel aux golems", kind="duo", blocks=15, banner_col=36, margin_label="Magie(s)"),
    dict(name="Animation des morts", kind="duo", blocks=14, banner_col=42, margin_label="Magie(s)",
         table_title_row=40, table_cols=((42, 47), (58, 63))),
    dict(name="Marionette de lombre", kind="solo", blocks=5, banner_col=26, margin_label="Libellé du bloc"),
]

# Écritures du même nom relevées dans la source : titre de page -> alias. Chaque alias doit figurer dans la
# description de la créature (contrôlé au lancement) : coquille corrigée par la source elle-même, accord au féminin
# ou surnom (« Surnommé aussi le “Chasseur invisible” »).
ALIASES = {
    "Sihouetteur obscur": ["Silhouetteur obscur"],
    "Poupée corrompu": ["Poupée corrompue"],
    "Poupée sacré": ["Poupée sacrée"],
    "Golem de cristal": ["Chasseur invisible"],
}


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


def col_letters(n):
    out = ""
    while n:
        n, m = divmod(n - 1, 26)
        out = chr(65 + m) + out
    return out


def split_ref(ref):
    m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    if not m:
        raise ValueError("référence de cellule invalide : %r" % ref)
    c = 0
    for ch in m.group(1):
        c = c * 26 + ord(ch) - 64
    return int(m.group(2)), c


def ref_of(r, c):
    return "%s%d" % (col_letters(c), r)


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
        self.consumed = set()
        # cellule quelconque d'une plage fusionnée -> cellule en haut à gauche
        self.merge_origin = {}
        for rng in raw.get("merged", []):
            a, _, b = rng.partition(":")
            (r1, c1), (r2, c2) = split_ref(a), split_ref(b or a)
            for r in range(r1, r2 + 1):
                for c in range(c1, c2 + 1):
                    self.merge_origin[(r, c)] = (r1, c1)

    def take(self, r, c):
        """Lit une cellule (None si vide) et la marque comme utilisée."""
        if (r, c) in self.cells:
            self.consumed.add((r, c))
        return self.cells.get((r, c))

    def check_all_consumed(self):
        left = sorted(set(self.cells) - self.consumed)
        if left:
            raise ValueError("%s : cellules non reconnues %s" % (
                self.name, ", ".join("%s=%r" % (ref_of(r, c), self.cells[(r, c)]) for r, c in left[:10])))


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


def table(headers, rows):
    out = [
        "| " + " | ".join(cell_md(h) for h in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        out.append("| " + " | ".join(cell_md(v) for v in row) + " |")
    return out


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


def first_sentence(text):
    para = fmt(text).split("\n")[0].strip()
    m = re.match(r"(.+?[.!?])(?=\s|$)", para)
    return m.group(1) if m else para


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
    """{onglet: [(ref, texte)]} : notes (commentaires hérités) lues directement dans le .xlsx."""
    result = {}
    with zipfile.ZipFile(xlsx_path) as zf:
        workbook = _xml(zf, "xl/workbook.xml")
        rels = {r.get("Id"): r.get("Target") for r in _xml(zf, "xl/_rels/workbook.xml.rels")}
        for sheet in workbook.find("{%s}sheets" % NS_MAIN):
            name = sheet.get("name")
            path = posixpath.normpath(posixpath.join("xl", rels[sheet.get("{%s}id" % NS_REL)]))
            rel_path = posixpath.join(posixpath.dirname(path), "_rels", posixpath.basename(path) + ".rels")
            notes = []
            if rel_path in zf.namelist():
                for rel in _xml(zf, rel_path):
                    kind = rel.get("Type").rsplit("/", 1)[-1]
                    target = posixpath.normpath(posixpath.join(posixpath.dirname(path), rel.get("Target")))
                    if kind == "comments":
                        for c in _xml(zf, target).find("{%s}commentList" % NS_MAIN):
                            text = "".join(t.text or "" for t in c.iter("{%s}t" % NS_MAIN))
                            if text.strip():
                                notes.append((c.get("ref"), text))
                    elif kind == "threadedComment":
                        raise ValueError("fil de commentaires dans l'onglet %r : non géré par ce script" % name)
            result[name] = notes
    return result


# --------------------------------------------------------------------------------------------------------------------
# Analyse d'un onglet
# --------------------------------------------------------------------------------------------------------------------

def parse_card(sh, r0, base, report, owners, creature_key):
    """Lit une carte de créature ; `owners` mémorise, pour chaque cellule lue, (créature, emplacement)."""
    def take(r, c, slot):
        v = sh.take(r, c)
        if v is not None:
            owners[(r, c)] = (creature_key, slot)
        return v

    name = take(r0 + NAME_ROW, base, "nom")
    if name is None:
        raise ValueError("%s : bloc ligne %d, carte colonne %s sans nom" % (sh.name, r0, col_letters(base)))
    card = {"name": norm_ws(name), "desc": take(r0 + DESC_ROW, base, "description")}

    stats = []
    for off in STAT_OFFSETS:
        label, value = take(r0 + STAT_ROW, base + off, "stats"), take(r0 + STAT_ROW, base + off + VALUE_SHIFT, "stats")
        if label is None:
            if value is not None:
                raise ValueError("%s : valeur %s sans libellé" % (sh.name, ref_of(r0 + STAT_ROW, base + off + VALUE_SHIFT)))
            continue
        stats.append((norm_ws(label), value))
        if value is None:
            report.append("%s %s : libellé %r sans valeur" % (sh.name, ref_of(r0 + STAT_ROW, base + off), norm_ws(label)))
    if not stats or stats[0][0] != "Santé":
        raise ValueError("%s : %s : la ligne de statistiques ne commence pas par « Santé » : %r" % (sh.name, card["name"], stats))
    card["stats"] = stats

    extras = []
    for off in STAT_OFFSETS:
        label, value = take(r0 + EXTRA_ROW, base + off, "stats"), take(r0 + EXTRA_ROW, base + off + VALUE_SHIFT, "stats")
        if label is None:
            if value is not None:
                raise ValueError("%s : valeur %s sans libellé" % (sh.name, ref_of(r0 + EXTRA_ROW, base + off + VALUE_SHIFT)))
            continue
        extras.append((norm_ws(label), value))
        report.append("%s %s : ligne facultative de ressource supplémentaire « %s » (%s) pour %s"
                      % (sh.name, ref_of(r0 + EXTRA_ROW, base + off), norm_ws(label), fmt(value), card["name"]))
    card["extras"] = extras

    for row_off, label, key in FIXED_ROWS:
        lab, val = take(r0 + row_off, base, key), take(r0 + row_off, base + VALUE_SHIFT, key)
        if lab is None:
            if val is not None:
                raise ValueError("%s : %s : valeur %s sans libellé %r" % (sh.name, card["name"], ref_of(r0 + row_off, base + VALUE_SHIFT), label))
            report.append("%s : %s sans « %s »" % (sh.name, card["name"], label))
        elif norm_ws(lab) != label:
            raise ValueError("%s : %s : libellé attendu %r en %s, trouvé %r"
                             % (sh.name, card["name"], label, ref_of(r0 + row_off, base), lab))
        elif val is None:
            report.append("%s %s : libellé %r sans valeur" % (sh.name, ref_of(r0 + row_off, base), label))
        card[key] = val
    return card


def parse_tab(sh, cfg, report):
    """Un onglet -> {blocs, bandeau, texte général, tableau éventuel, propriétaires des cellules}."""
    owners = {}
    blocks = []
    for k in range(cfg["blocks"]):
        r0 = 1 + BLOCK * k
        margin = sh.take(r0 + MARGIN_ROW, COL_MARGIN)
        if margin is None:
            raise ValueError("%s : bloc %d (ligne %d) sans libellé de marge en %s"
                             % (sh.name, k + 1, r0, ref_of(r0 + MARGIN_ROW, COL_MARGIN)))
        cards = [parse_card(sh, r0, COL_LEFT, report, owners, (k, 0))]
        if cfg["kind"] == "duo":
            cards.append(parse_card(sh, r0, COL_RIGHT, report, owners, (k, 1)))
        else:
            label, text = sh.take(r0 + EFFECT_LABEL_ROW, EFFECT_COL), sh.take(r0 + EFFECT_TEXT_ROW, EFFECT_COL)
            if label is None or text is None:
                raise ValueError("%s : bloc %d sans panneau « Effet » complet" % (sh.name, k + 1))
            cards[0]["effect"] = (norm_ws(label), text)
        for card in cards:
            if card["desc"] is None:
                report.append("%s : %s sans description" % (sh.name, card["name"]))
        blocks.append({"row": r0, "margin": norm_ws(margin), "cards": cards})

    banner = sh.take(1, cfg["banner_col"])
    text = sh.take(3, cfg["banner_col"])
    if banner is None:
        raise ValueError("%s : bandeau absent en %s" % (sh.name, ref_of(1, cfg["banner_col"])))
    tab = {"cfg": cfg, "blocks": blocks, "banner": norm_ws(banner), "text": text, "table": None, "owners": owners}

    if "table_title_row" in cfg:
        r = cfg["table_title_row"]
        title = sh.take(r, cfg["table_cols"][0][0])
        if title is None:
            raise ValueError("%s : titre du tableau absent" % sh.name)
        columns = []
        for name_col, text_col in cfg["table_cols"]:
            rows = []
            rr = r + 1
            while (rr, name_col) in sh.cells or (rr, text_col) in sh.cells:
                n, t = sh.take(rr, name_col), sh.take(rr, text_col)
                if n is None or t is None:
                    raise ValueError("%s : ligne %d du tableau incomplète" % (sh.name, rr))
                rows.append((n, t))
                rr += 1
            columns.append(rows)
        tab["table"] = (norm_ws(title), columns)

    sh.check_all_consumed()
    return tab


def attach_comments(tab, sh, notes):
    """Rattache chaque commentaire à la valeur qu'il commente (cellule lue ou plage fusionnée qui la contient)."""
    for ref, text in notes:
        r, c = split_ref(ref)
        r, c = sh.merge_origin.get((r, c), (r, c))
        owner = tab["owners"].get((r, c))
        if owner is None:
            raise ValueError("%s : commentaire en %s hors d'une carte de créature : %r" % (sh.name, ref, text))
        (k, side), slot = owner
        card = tab["blocks"][k]["cards"][side]
        card.setdefault("notes", {}).setdefault(slot, []).append(text.strip())


# --------------------------------------------------------------------------------------------------------------------
# Rendu
# --------------------------------------------------------------------------------------------------------------------

def sources_for(tab_name):
    return ["Google Sheet « %s », onglet « %s »" % (WORKBOOK, tab_name), URL]


def front_matter(title, aliases, tags, summary, tab_name):
    lines = ["---",
             "title: " + yaml_str(title),
             "aliases: " + yaml_list(aliases),
             "tags: " + yaml_list(tags)]
    if summary:
        lines.append("summary: " + yaml_str(summary))
    lines += ["sources: " + yaml_list(sources_for(tab_name)), "status: " + STATUS, "---", ""]
    return lines


def tab_tags(tab):
    words = tab["banner"].lower().split()
    tags = []
    if words:
        tags.append(words[0])
        if len(words) > 1:
            tags.append(" ".join(words[1:]))
    return tags


def magic_tags(margin):
    tags = []
    for part in norm_ws(margin).split("+"):
        part = re.sub(r"\s*\bmono$", "", part.strip(), flags=re.I).strip().lower()
        if part and part not in tags:
            tags.append(part)
    return tags


def render_creature(tab, block, side):
    cfg = tab["cfg"]
    card = block["cards"][side]
    notes = card.get("notes", {})
    title = card["name"]
    aliases = ALIASES.get(title, [])
    for alias in aliases:
        if norm_ws(alias).lower() not in norm_ws(card["desc"] or "").lower():
            raise ValueError("alias %r absent de la description de %s" % (alias, title))
    tags = list(tab_tags(tab))
    for t in (magic_tags(block["margin"]) if cfg["kind"] == "duo" else []):
        if t not in tags:
            tags.append(t)
    summary = first_sentence(card["desc"]) if card["desc"] else None
    L = front_matter(title, aliases, tags, summary, cfg["name"])

    L += ["**Invocation** : %s (onglet du classeur « %s »)" % (esc_inline(cfg["name"]), esc_inline(WORKBOOK)), ""]
    L += ["**%s** : %s" % (esc_inline(cfg["margin_label"]), esc_inline(block["margin"])), ""]
    if cfg["kind"] == "duo":
        other = block["cards"][1 - side]
        L += ["**Autre créature du bloc** : %s" % esc_inline(other["name"]), ""]

    if card["desc"]:
        L += ["## Description", ""] + md_text(card["desc"]) + [""]

    L += ["## Statistiques", ""]
    headers = [l for l, _ in card["stats"]] + [l for l, _ in card["extras"]]
    values = ["" if v is None else v for _, v in card["stats"]] + ["" if v is None else v for _, v in card["extras"]]
    L += table(headers, [values]) + [""]
    for _, label, key in FIXED_ROWS[:-1]:
        if card[key] is not None:
            L += labeled(label, card[key]) + [""]
            for note in notes.get(key, []):
                L += labeled("Note de cellule", note) + [""]
    if notes.get("stats"):
        for note in notes["stats"]:
            L += labeled("Note de cellule", note) + [""]

    if card["capacites"] is not None:
        L += ["## Capacité(s)", ""] + md_text(card["capacites"]) + [""]
        for note in notes.get("capacites", []):
            L += labeled("Note de cellule", note) + [""]
    if "effect" in card:
        label, text = card["effect"]
        L += ["## " + esc_inline(label), ""] + md_text(text) + [""]
    for slot in ("nom", "description"):
        if notes.get(slot):
            raise ValueError("%s : commentaire sur « %s » non géré" % (title, slot))
    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


def render_intro(tab):
    cfg = tab["cfg"]
    title = cfg["name"]
    aliases = [tab["banner"]]
    summary = first_sentence(tab["text"]) if tab["text"] else None
    L = front_matter(title, aliases, tab_tags(tab), summary, title)
    L += ["**En-tête de l'onglet** : %s" % esc_inline(tab["banner"]), ""]
    if tab["text"]:
        L += ["## Texte général", ""] + md_text(tab["text"]) + [""]
    L += ["## Créatures", ""]
    for block in tab["blocks"]:
        L.append("- %s : %s" % (esc_inline(block["margin"]), ", ".join(esc_inline(c["name"]) for c in block["cards"])))
    L.append("")
    if tab["table"]:
        ttitle, columns = tab["table"]
        L += ["## " + esc_inline(ttitle), ""]
        L += table(["Nom", "Amélioration"], [[n, t] for col in columns for n, t in col]) + [""]
    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Écriture sûre
# --------------------------------------------------------------------------------------------------------------------

def read_front(path):
    """(titre, alias) de la page ; (None, []) si le fichier n'a pas d'en-tête lisible."""
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().split("\n", 60)[:60]
    except OSError:
        return None, []
    if not lines or lines[0].strip() != "---":
        return None, []
    title, aliases = None, []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"title:\s*(.*)$", line)
        if m:
            value = m.group(1).strip()
            if value.startswith('"'):
                try:
                    value = json.loads(value)
                except ValueError:
                    value = value.strip('"')
            else:
                value = value.strip("'")
            title = value
        m = re.match(r"aliases:\s*(.*)$", line)
        if m:
            raw = m.group(1).strip()
            try:
                parsed = json.loads(raw)
                aliases = [str(a) for a in parsed] if isinstance(parsed, list) else []
            except ValueError:
                aliases = [a.strip().strip("'\"") for a in raw.strip("[]").split(",") if a.strip()]
    return title, aliases


def is_ours(path):
    try:
        with open(path, encoding="utf-8") as fh:
            head = fh.read(4000)
    except OSError:
        return False
    return URL in head and "« %s »" % WORKBOOK in head


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « invocations » du wiki depuis le dump de « %s »." % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py (répétable)")
    ap.add_argument("--xlsx", help="classeur d'origine (commentaires de cellule)")
    ap.add_argument("--sans-commentaires", action="store_true", help="ne pas lire les commentaires de cellule")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    args = ap.parse_args(argv)

    raw_sheets, dump_dirs = {}, []
    for path in args.dump:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        dump_dirs.append(os.path.dirname(os.path.abspath(path)))
        for raw in data["sheets"]:
            raw_sheets.setdefault(raw["name"], raw)
    for cfg in TABS:
        if cfg["name"] not in raw_sheets:
            sys.exit("onglet %r absent du dump" % cfg["name"])

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

    report, pages = [], []   # pages : (titre, alias, slug, texte, onglet)
    try:
        for cfg in TABS:
            sh = Sheet(raw_sheets[cfg["name"]])
            tab = parse_tab(sh, cfg, report)
            attach_comments(tab, sh, comments.get(cfg["name"], []))
            pages.append((cfg["name"], [tab["banner"]], normalize(cfg["name"]), render_intro(tab), cfg["name"]))
            for block in tab["blocks"]:
                for side, card in enumerate(block["cards"]):
                    aliases = ALIASES.get(card["name"], [])
                    pages.append((card["name"], aliases, normalize(card["name"]), render_creature(tab, block, side),
                                  cfg["name"]))
    except ValueError as err:
        sys.exit("ERREUR : %s" % err)

    for name, raw in raw_sheets.items():
        for c in raw["cells"]:
            if isinstance(c["v"], str) and "[[" in c["v"]:
                print("AVERTISSEMENT : « [[ » dans la cellule %s de l'onglet %s (échappé, pas un lien)"
                      % (ref_of(c["r"], c["c"]), name), file=sys.stderr)
    unused = [k for k in ALIASES if k not in {p[0] for p in pages}]
    if unused:
        sys.exit("ERREUR : ALIASES contient des titres inconnus : %s" % unused)

    # Contrôles avant toute écriture : doublons, fichiers existants, titres et alias des autres familles.
    out_dir = os.path.join(args.out, CATEGORY)
    problems = []
    seen_slugs, seen_names = {}, {}
    for title, aliases, slug, text, tab_name in pages:
        if slug in seen_slugs:
            problems.append("slug en double : %s (%r et %r)" % (slug, seen_slugs[slug], title))
        seen_slugs[slug] = title
        for name in [title] + list(aliases):
            key = normalize(name)
            if key in seen_names and seen_names[key] != title:
                problems.append("nom ou alias en double dans la famille : %r (%r et %r)" % (name, seen_names[key], title))
            seen_names[key] = title
    targets = {os.path.abspath(os.path.join(out_dir, p[2] + ".md")) for p in pages}
    for dirpath, _, files in sorted(os.walk(args.out)):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            path = os.path.abspath(os.path.join(dirpath, fname))
            if path in targets:
                if not is_ours(path):
                    problems.append("fichier existant qui n'est pas de cette famille, non écrasé : %s" % path)
                continue
            if is_ours(path):
                continue   # page de ce classeur écrite par une autre version du script : hors cible, on n'y touche pas
            title, aliases = read_front(path)
            for name in ([title] if title else []) + list(aliases):
                if normalize(name) in seen_names:
                    problems.append("%r déjà utilisé par %s (page %r de la famille)"
                                    % (name, path, seen_names[normalize(name)]))
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1

    os.makedirs(out_dir, exist_ok=True)
    written = unchanged = 0
    for title, aliases, slug, text, tab_name in pages:
        path = os.path.join(out_dir, slug + ".md")
        old = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
        if old == text:
            unchanged += 1
            continue
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        written += 1
    for line in report:
        print("ÉCART : " + line, file=sys.stderr)
    print("%d pages (%d écrites, %d inchangées) dans %s" % (len(pages), written, unchanged, out_dir))
    return 0


if __name__ == "__main__":
    sys.exit(main())
