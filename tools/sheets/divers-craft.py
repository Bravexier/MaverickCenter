#!/usr/bin/env python3
"""Famille « divers-craft » : familiers, maison, machines de guerre et de siège, maladies, fiche de tour.
Six pages du wiki, une par onglet, dans `<out>/ressources/<slug>.md`.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/divers-craft.py --dump <ressources-craft.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki

Le dump JSON est produit par tools/sheets/xlsx_to_json.py (format : voir ce script). Les cellules sont une donnée non
fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur n'est calculée,
corrigée ni complétée : fautes d'orthographe, majuscules, espaces et formulations de la source sont conservés.

Source : Google Sheet « Ressources et Craft » (12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA), six de ses quatorze onglets
(les autres, équipement, armes, etc., sont d'autres familles). Toutes les cellules sont du texte (aucune formule, aucun
nombre). Les plages fusionnées ne portent leur valeur que dans la cellule en haut à gauche.

Onglets et pages (slug -> titre) :

  * « Familiers » -> familiers.md. Trois listes côte à côte, chacune sous un titre en ligne 1 (« Petit familier » col. A,
    « Gros familier » col. U, « Monture » col. AO) avec un paragraphe de présentation en ligne 3 et un tableau dont les
    en-têtes sont en ligne 10 : petits familiers = Nom (A), Effet (F), Description (L) ; gros familiers = Nom (U),
    Description (Z) ; montures = Nom (AO), Description (AT). Une section par liste, un tableau par section, lignes dans
    l'ordre de la feuille. La cellule U3 porte un lien hypertexte vers un autre classeur (fiches des familiers) : il est
    recopié du .xlsx (constante CELL_LINKS) et écrit sous le paragraphe.
  * « Maison » -> maison.md. Deux blocs : « MATÉRIAUX DE CONSTRUCTION (Moyenne) » (colonnes A/D : matériau et prix, sans
    en-tête dans la source -> liste) et « BATIMENT STANDARD » (colonnes J, N, S, X, AC : tableau Type, Surface standard,
    Quantité de matériaux nécessaires, Prix standard, Description), puis une note en A30.
  * « Machine de GuerreSiège » -> machine-de-guerresiege.md. Trois tableaux Nom / Description / Effet : « ATTAQUE AU SOL »
    (colonnes A, H, AB), « ATTAQUE AU MUR » (colonnes AI, AP, BJ) et « DEFENSE AU SOL » (ligne 23). L'onglet n'a pas
    de titre général ; son nom (« GuerreSiège » sans séparateur : la barre oblique est probablement perdue à l'export)
    est repris tel quel comme titre. Une cellule isolée (Q40 : « Vent »), hors de tout tableau, est écrite en note.
  * « Maladie V2 » -> fievre-des-marais.md. Gabarit illustré pour une seule maladie, « FIEVRE DES MARAIS » (A1) : un
    paragraphe de description (A5), puis huit champs libellé/valeur (libellé en colonne A, valeur en colonne K), puis le
    texte de l'emplacement d'illustration (R1). Le titre de la page est celui de la même maladie dans l'onglet
    « Maladie » (« Fièvre des marais ») ; « FIEVRE DES MARAIS » et « Maladie V2 » sont des alias. Le bas de l'onglet
    (lignes 55 à 106) est un second gabarit VIDE : libellés seuls, sans aucune valeur. Il n'est pas publié (rien n'y est
    renseigné) ; le script vérifie qu'il ne contient que ces libellés et s'arrête si ce n'est plus le cas.
  * « Maladie » -> maladie.md. Une maladie par ligne (lignes 3, 6, 9... 48), colonnes : Nom (A), Effets (H), Nature (O),
    Où le contracter ? (V), Méthode de contraction (AC), Temps d'Incubation (AJ), Méthode de soin (AQ), Temps de soin
    (BA). Une section par maladie, un champ « **En-tête** : valeur » par colonne renseignée (les champs vides sont
    absents). Un commentaire de cellule (H39, Tétanos, Effets) est recopié du .xlsx (constante CELL_COMMENTS).
  * « Fiche de tour » -> fiche-de-tour.md. Un tableau GROUPE / JOUEUR x AVANT LE TOUR / PENDANT LE TOUR / FIN DU TOUR
    (lignes 3 à 12), puis le tableau « Déroulement d'un tour » (lignes 40 à 56, libellé en A, texte en E). Un
    commentaire de cellule (L12) est recopié du .xlsx et écrit sous le premier tableau.

Les commentaires et le lien hypertexte ne sont pas dans le dump JSON : ils sont recopiés ici mot pour mot depuis le
classeur .xlsx, et ne sont écrits que si la cellule du dump porte bien la valeur attendue (sinon le script s'arrête).

Le script s'arrête avec une erreur, sans rien écrire, si une cellule non vide d'un onglet du périmètre n'est pas
reconnue (rien n'est perdu en silence), si un en-tête n'est pas celui attendu, si un titre, un alias ou un slug est déjà
porté par une page d'une autre famille, ou si un fichier existant n'est pas issu du même onglet.

Il ne touche qu'aux six fichiers `<out>/ressources/<slug>.md` de sa famille : il n'efface rien, ne réécrit pas un
fichier dont le contenu ne change pas. Aucun lien [[…]] n'est écrit (une cellule qui en contiendrait serait neutralisée
et signalée sur la sortie d'erreur).
"""
import argparse
import json
import os
import re
import sys
import unicodedata

CATEGORY = "ressources"
STATUS = "draft"

WORKBOOK_TITLE = "Ressources et Craft"
WORKBOOK_ID = "12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA"

TAB_FAMILIERS = "Familiers"
TAB_MAISON = "Maison"
TAB_MACHINES = "Machine de GuerreSiège"
TAB_MALADIE_V2 = "Maladie V2"
TAB_MALADIE = "Maladie"
TAB_TOUR = "Fiche de tour"
TABS = (TAB_FAMILIERS, TAB_MAISON, TAB_MACHINES, TAB_MALADIE_V2, TAB_MALADIE, TAB_TOUR)

# Commentaires de cellule du classeur d'origine : le dump JSON ne les contient pas, ils sont recopiés mot pour mot depuis
# le .xlsx. Forme : onglet -> {(ligne, colonne): (référence, valeur attendue de la cellule, commentaire)}.
# Les deux commentaires sont des fils non résolus (done="0") ; les noms d'auteurs ne sont pas repris.
CELL_COMMENTS = {
    TAB_MALADIE: {
        (39, 8): (
            "H39",
            "Paralysie des membres et spasmes pouvant causer des fractures. Dure 1 semaine. 80% de chance d'en mourir",
            "Se traduit par une croix en Force et Agilité et Social.",
        ),
    },
    TAB_TOUR: {
        (12, 12): (
            "L12",
            "- IC ET/OU Déplacement (Gratuits tant qu'aucune action n'a été faite)\n\n"
            "- Action (Attaque, Sort, Sprint, Saut, ect...)",
            "- Maximum 3 IC par Tour\n"
            "- Déplacement OU Action cramée en cas d'échec critique\n"
            "- Vous pouvez vous déplacer (Ou pas) autant de fois pendant votre tour tant que vous avez encore des points "
            "de déplacements (Stat : VITESSE)",
        ),
    },
}

# Liens hypertexte attachés à une cellule entière (lus dans le .xlsx) : onglet -> {(ligne, colonne): (référence,
# fin attendue de la valeur de la cellule, URL)}.
CELL_LINKS = {
    TAB_FAMILIERS: {
        (3, 21): (
            "U3",
            "Ici pour les fiches : Familiers",
            "https://docs.google.com/spreadsheets/d/1Im-_xrGVzNHvnmG7MQsCMvEUZiGIacxrorOXrosRV6Q/edit?usp=sharing",
        ),
    },
}

WARNINGS = []


def source_url():
    return "https://docs.google.com/spreadsheets/d/%s/edit" % WORKBOOK_ID


def sources_for(tab):
    return ["Google Sheet « %s », onglet « %s »" % (WORKBOOK_TITLE, tab), source_url()]


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
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def coord(r, c):
    return "%s%d" % (col_letters(c), r)


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
                if "[[" in fmt(c["v"]):
                    WARNINGS.append("« [[ » dans la cellule %s de l'onglet %s (échappé, ce n'est pas un lien)"
                                    % (coord(c["r"], c["c"]), self.name))
        self.consumed = set()

    def take(self, r, c):
        """Lit une cellule (None si vide) et la marque comme utilisée."""
        if (r, c) in self.cells:
            self.consumed.add((r, c))
        return self.cells.get((r, c))

    def peek(self, r, c):
        return self.cells.get((r, c))

    def rows_with(self, col, lo, hi):
        """Lignes de [lo, hi] dont la cellule de la colonne `col` n'est pas vide, dans l'ordre."""
        return sorted(r for (r, c) in self.cells if c == col and lo <= r <= hi)

    def expect(self, r, c, expected):
        """Lit une cellule d'en-tête : doit valoir `expected` (espaces normalisés)."""
        value = self.take(r, c)
        if value is None or norm_ws(value) != expected:
            raise ValueError("%s : %s devrait valoir %r (trouvé %r)" % (self.name, coord(r, c), expected, value))
        return norm_ws(value)

    def leftovers(self):
        return sorted(set(self.cells) - self.consumed)

    def check_all_consumed(self):
        left = self.leftovers()
        if left:
            raise ValueError("%s : cellules non reconnues %s" % (
                self.name, ", ".join("%s=%r" % (coord(r, c), self.cells[(r, c)]) for r, c in left[:10])))


# --------------------------------------------------------------------------------------------------------------------
# Échappement et rendu Markdown
# --------------------------------------------------------------------------------------------------------------------

URL_RE = re.compile(r"https?://[^\s<>]+")


def _esc_plain(s):
    s = s.replace("\\", "\\\\")
    s = re.sub(r"([`*_\[\]<~])", r"\\\1", s)
    s = re.sub(r"&(?=#?\w+;)", r"\\&", s)
    return s


def esc_inline(s, block=True):
    """Échappe un texte d'une ligne ; les URL nues deviennent des liens automatiques <url>.
    `block` : en début de ligne, neutralise les marqueurs de citation, de titre et de liste (inutile dans un tableau)."""
    out, pos = [], 0
    for m in URL_RE.finditer(s):
        out.append(_esc_plain(s[pos:m.start()]))
        out.append("<%s>" % m.group(0))
        pos = m.end()
    out.append(_esc_plain(s[pos:]))
    line = "".join(out)
    if block:
        line = re.sub(r"^(\s*)>", r"\1\\>", line)
        line = re.sub(r"^(\s*)(#{1,6})(?=\s|$)", r"\1\\\2", line)
        line = re.sub(r"^(\s*)([-+])(?=\s|$)", r"\1\\\2", line)
        line = re.sub(r"^(\s*)(\d+)([.)])(?=\s|$)", r"\1\2\\\3", line)
    return line


def cell_md(value):
    """Cellule de tableau : retours à la ligne -> <br>, « | » échappé."""
    if is_blank(value):
        return ""
    lines = [esc_inline(l.strip(), block=False) for l in fmt(value).split("\n")]
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
    out = ["| " + " | ".join(cell_md(h) for h in headers) + " |",
           "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(cell_md(v) for v in row) + " |")
    return out


def heading(level, text):
    return "#" * level + " " + esc_inline(norm_ws(text))


def note(text):
    """Remarque de l'importeur (pas du texte de la source) : en italique."""
    return "*" + esc_inline(text, block=False) + "*"


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


# --------------------------------------------------------------------------------------------------------------------
# Commentaires et liens de cellule (recopiés du .xlsx)
# --------------------------------------------------------------------------------------------------------------------

def cell_comment(sheet, r, c):
    """(référence, texte) du commentaire de la cellule (r, c), None s'il n'y en a pas ; erreur si la cellule a changé."""
    entry = CELL_COMMENTS.get(sheet.name, {}).get((r, c))
    if entry is None:
        return None
    ref, expected, text = entry
    value = sheet.peek(r, c)
    if value is None or norm_ws(value) != norm_ws(expected):
        raise ValueError("%s : %s ne porte plus la valeur attendue pour son commentaire (source modifiée ?)" % (sheet.name, ref))
    return ref, text


def cell_link(sheet, r, c):
    """(référence, URL) du lien de la cellule (r, c), None s'il n'y en a pas ; erreur si la cellule a changé."""
    entry = CELL_LINKS.get(sheet.name, {}).get((r, c))
    if entry is None:
        return None
    ref, expected_tail, url = entry
    value = sheet.peek(r, c)
    if value is None or not norm_ws(value).endswith(expected_tail):
        raise ValueError("%s : %s ne porte plus la valeur attendue pour son lien (source modifiée ?)" % (sheet.name, ref))
    return ref, url


def comment_lines(sheet, r, c, intro):
    """Lignes Markdown (suivies d'une ligne vide) du commentaire de la cellule (r, c), ou [] s'il n'y en a pas."""
    got = cell_comment(sheet, r, c)
    if got is None:
        return []
    ref, text = got
    return [note("%s (cellule %s du classeur d'origine) :" % (intro, ref)), ""] + md_text(text) + [""]


# --------------------------------------------------------------------------------------------------------------------
# Une page : {slug, title, aliases, tags, summary, tab, body (lignes)}
# --------------------------------------------------------------------------------------------------------------------

def page(slug, title, tab, tags, body, aliases=(), summary=None):
    return {"slug": slug, "title": title, "aliases": list(aliases), "tags": list(tags), "summary": summary,
            "tab": tab, "body": body}


def render_page(p):
    L = ["---",
         "title: " + yaml_str(p["title"]),
         "aliases: " + yaml_list(p["aliases"]),
         "tags: " + yaml_list(p["tags"])]
    if p["summary"]:
        L.append("summary: " + yaml_str(p["summary"]))
    L += ["sources: " + yaml_list(sources_for(p["tab"])), "status: " + STATUS, "---", ""]
    L += p["body"]
    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Familiers
# --------------------------------------------------------------------------------------------------------------------

# (colonne du titre et du nom, colonne de l'effet ou None, colonne de la description)
FAMILIER_LISTS = (
    (1, 6, 12),
    (21, None, 26),
    (41, None, 46),
)
FAMILIER_TITLE_ROW, FAMILIER_INTRO_ROW, FAMILIER_HEADER_ROW, FAMILIER_FIRST_ITEM_ROW = 1, 3, 10, 11


def build_familiers(sh):
    body = []
    for name_col, effect_col, desc_col in FAMILIER_LISTS:
        title = sh.take(FAMILIER_TITLE_ROW, name_col)
        if title is None:
            raise ValueError("%s : titre de liste manquant en %s" % (sh.name, coord(FAMILIER_TITLE_ROW, name_col)))
        intro = sh.take(FAMILIER_INTRO_ROW, name_col)
        headers = [sh.expect(FAMILIER_HEADER_ROW, name_col, "Nom")]
        if effect_col is not None:
            headers.append(sh.expect(FAMILIER_HEADER_ROW, effect_col, "Effet"))
        headers.append(sh.expect(FAMILIER_HEADER_ROW, desc_col, "Description"))
        rows = []
        for r in sh.rows_with(name_col, FAMILIER_FIRST_ITEM_ROW, 10 ** 6):
            row = [sh.take(r, name_col)]
            if effect_col is not None:
                row.append(sh.take(r, effect_col))
            row.append(sh.take(r, desc_col))
            rows.append(row)
        body += [heading(2, title), ""]
        if intro is not None:
            body += md_text(intro) + [""]
            link = cell_link(sh, FAMILIER_INTRO_ROW, name_col)
            if link is not None:
                ref, url = link
                body += [note("Lien hypertexte attaché à la cellule %s dans le classeur d'origine :" % ref) + " <%s>" % url, ""]
        body += table(headers, rows) + [""]
    sh.check_all_consumed()
    return page("familiers", "Familiers", TAB_FAMILIERS, ["familier", "monture"], body)


# --------------------------------------------------------------------------------------------------------------------
# Maison
# --------------------------------------------------------------------------------------------------------------------

def build_maison(sh):
    body = []
    # Matériaux : titre en A1, puis (nom en A, prix en D) sans en-tête dans la source.
    body += [heading(2, sh.take(1, 1)), ""]
    for r in sh.rows_with(1, 2, 29):
        name, price = sh.take(r, 1), sh.take(r, 4)
        body.append("- **%s**%s" % (esc_inline(norm_ws(name), block=False),
                                    " : " + esc_inline(norm_ws(price), block=False) if price is not None else ""))
    body.append("")
    # Bâtiment standard : titre en J1, en-têtes en ligne 3 (colonnes J, N, S, X, AC), lignes de données dessous.
    cols = (10, 14, 19, 24, 29)
    body += [heading(2, sh.take(1, 10)), ""]
    headers = [norm_ws(sh.take(3, c)) for c in cols]
    rows = [[sh.take(r, c) for c in cols] for r in sh.rows_with(10, 4, 29)]
    body += table(headers, rows) + [""]
    # Note en A30.
    note_cell = sh.take(30, 1)
    if note_cell is not None:
        body += md_text(note_cell) + [""]
    sh.check_all_consumed()
    return page("maison", "Maison", TAB_MAISON, ["maison", "construction"], body)


# --------------------------------------------------------------------------------------------------------------------
# Machine de GuerreSiège
# --------------------------------------------------------------------------------------------------------------------

# ((ligne, colonne du titre), ligne des en-têtes, colonnes Nom/Description/Effet, première et dernière ligne de données)
MACHINE_SECTIONS = (
    ((1, 1), 3, (1, 8, 28), 4, 22),      # ATTAQUE AU SOL
    ((1, 35), 3, (35, 42, 62), 4, 22),   # ATTAQUE AU MUR
    ((23, 1), 25, (1, 8, 28), 26, 29),   # DEFENSE AU SOL
)
MACHINE_STRAY_FROM_ROW = 30   # une cellule restante à partir de cette ligne est « isolée » (note) ; avant, c'est une erreur


def build_machines(sh):
    body = []
    for (tr, tc), hr, cols, lo, hi in MACHINE_SECTIONS:
        title = sh.take(tr, tc)
        if title is None:
            raise ValueError("%s : titre de section manquant en %s" % (sh.name, coord(tr, tc)))
        headers = [sh.expect(hr, cols[0], "Nom"), sh.expect(hr, cols[1], "Description"), sh.expect(hr, cols[2], "Effet")]
        rows = [[sh.take(r, c) for c in cols] for r in sh.rows_with(cols[0], lo, hi)]
        body += [heading(2, title), ""] + table(headers, rows) + [""]
    # Cellules isolées hors de tout tableau (Q40 : « Vent »).
    for r, c in sh.leftovers():
        if r >= MACHINE_STRAY_FROM_ROW:
            value = sh.take(r, c)
            body += [note("Texte isolé, en dehors des tableaux, dans l'onglet d'origine (cellule %s) :" % coord(r, c))
                     + " " + esc_inline(norm_ws(value), block=False), ""]
    sh.check_all_consumed()
    return page("machine-de-guerresiege", TAB_MACHINES, TAB_MACHINES, ["machine de guerre", "siège"], body)


# --------------------------------------------------------------------------------------------------------------------
# Maladie
# --------------------------------------------------------------------------------------------------------------------

MALADIE_COLS = (1, 8, 15, 22, 29, 36, 43, 53)
MALADIE_HEADERS = ("Nom", "Effets", "Nature", "Où le contracter ?", "Méthode de contraction", "Temps d'Incubation",
                   "Méthode de soin", "Temps de soin")


def build_maladie(sh):
    headers = [sh.expect(1, c, h) for c, h in zip(MALADIE_COLS, MALADIE_HEADERS)]
    body, names = [], []
    for r in sh.rows_with(1, 2, 10 ** 6):
        name = sh.take(r, 1)
        names.append(normalize(name))
        body += [heading(2, name), ""]
        for c, h in zip(MALADIE_COLS[1:], headers[1:]):
            value = sh.take(r, c)
            if value is None:
                continue
            body += labeled(h, value) + [""]
            body += comment_lines(sh, r, c, "Commentaire joint au champ « %s »" % h)
    sh.check_all_consumed()
    if len(set(names)) != len(names):
        raise ValueError("%s : noms de maladies en double" % sh.name)
    for (r, c), (ref, _, _) in CELL_COMMENTS.get(sh.name, {}).items():
        if (r, c) not in sh.consumed:
            raise ValueError("%s : commentaire de %s hors des champs publiés" % (sh.name, ref))
    return page("maladie", "Maladie", TAB_MALADIE, ["maladie"], body)


def build_maladie_v2(sh, maladie_sheet):
    heading_cell = sh.take(1, 1)
    illustration = sh.take(1, 18)
    description = sh.take(5, 1)
    if heading_cell is None or description is None:
        raise ValueError("%s : titre (A1) ou description (A5) manquant" % sh.name)
    # Titre de la page : l'écriture de la même maladie dans l'onglet « Maladie » si elle y figure (casse et accents
    # différents de « FIEVRE DES MARAIS »), sinon le titre tel qu'écrit en A1.
    title = norm_ws(heading_cell)
    for r in maladie_sheet.rows_with(1, 2, 10 ** 6):
        if normalize(maladie_sheet.peek(r, 1)) == normalize(heading_cell):
            title = norm_ws(maladie_sheet.peek(r, 1))
            break
    aliases = [a for a in (norm_ws(heading_cell), TAB_MALADIE_V2) if a != title]

    body = md_text(description) + [""]
    # Huit champs libellé (colonne A) / valeur (colonne K), lignes 24 à 52.
    labels = []
    for r in sh.rows_with(1, 20, 54):
        label, value = sh.take(r, 1), sh.take(r, 11)
        labels.append(norm_ws(label))
        if value is not None:
            body += labeled(norm_ws(label), value) + [""]
    if len(labels) != 8:
        raise ValueError("%s : %d champs au lieu de 8" % (sh.name, len(labels)))
    # Second gabarit (lignes 55 à 106) : libellés seuls, aucune valeur. Vérifié puis ignoré.
    empty_template, second = 0, []
    for (r, c) in sorted(k for k in sh.cells if k[0] >= 55):
        value = sh.take(r, c)
        if c == 1 and r == 59 and norm_ws(value) == "Race plus sensible : Race résistante : Race immunisée :":
            empty_template += 1
        elif c == 1 and r >= 78:
            second.append(norm_ws(value))
            empty_template += 1
        else:
            raise ValueError("%s : contenu inattendu dans le second gabarit, %s=%r" % (sh.name, coord(r, c), value))
    if second != labels:
        raise ValueError("%s : le second gabarit n'est plus un gabarit vide (libellés %r)" % (sh.name, second))
    if illustration is not None:
        body += [note("Texte de l'emplacement d'illustration du gabarit (cellule %s) :" % coord(1, 18))
                 + " " + esc_inline(norm_ws(illustration), block=False), ""]
    sh.check_all_consumed()
    if empty_template:
        print("%s : second gabarit vide (%d cellules, libellés seuls) non publié" % (sh.name, empty_template), file=sys.stderr)

    first = md_blocks(description)[0]
    m = re.match(r"(.+?[.!?])(?:\s|$)", first[1][0]) if first[0] == "p" else None
    summary = m.group(1) if m else None
    return page("fievre-des-marais", title, TAB_MALADIE_V2, ["maladie"], body, aliases=aliases, summary=summary)


# --------------------------------------------------------------------------------------------------------------------
# Fiche de tour
# --------------------------------------------------------------------------------------------------------------------

def build_tour(sh):
    body = []
    # Tableau 1 : phases en ligne 3 (colonnes B, L, AA), lignes GROUPE (5) et JOUEUR (12) ; première colonne sans en-tête.
    phase_cols = (2, 12, 27)
    phases = [norm_ws(sh.take(3, c)) for c in phase_cols]
    rows, comments = [], []
    for r in sh.rows_with(1, 4, 39):
        rows.append([sh.take(r, 1)] + [sh.take(r, c) for c in phase_cols])
        for c, phase in zip(phase_cols, phases):
            comments += comment_lines(sh, r, c, "Commentaire joint à la cellule « %s » de la ligne « %s »"
                                      % (phase, norm_ws(sh.peek(r, 1))))
    body += table([""] + phases, rows) + [""] + comments
    # Tableau 2 : « Déroulement d'un tour » (E40), libellés en A, textes en E.
    title = sh.take(40, 5)
    if title is None:
        raise ValueError("%s : titre « Déroulement d'un tour » manquant en E40" % sh.name)
    rows = [[sh.take(r, 1), sh.take(r, 5)] for r in sh.rows_with(1, 41, 10 ** 6)]
    body += table(["", norm_ws(title)], rows) + [""]
    sh.check_all_consumed()
    for (r, c), (ref, _, _) in CELL_COMMENTS.get(sh.name, {}).items():
        if (r, c) not in sh.consumed:
            raise ValueError("%s : commentaire de %s hors du tableau" % (sh.name, ref))
    return page("fiche-de-tour", "Fiche de tour", TAB_TOUR, ["tour"], body)


# --------------------------------------------------------------------------------------------------------------------
# Lecture du dump, contrôles, écriture
# --------------------------------------------------------------------------------------------------------------------

def load_sheets(paths):
    found = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            dump = json.load(fh)
        names = [s["name"] for s in dump["sheets"]]
        if all(t in names for t in TABS):
            if found is not None:
                raise ValueError("deux dumps contiennent les onglets de « %s »" % WORKBOOK_TITLE)
            found = {s["name"]: Sheet(s) for s in dump["sheets"] if s["name"] in TABS}
            for s in dump["sheets"]:
                if s["name"] in TABS and s.get("state", "visible") != "visible":
                    WARNINGS.append("onglet %s masqué" % s["name"])
    if found is None:
        raise ValueError("aucun dump ne contient les onglets %s" % ", ".join(TABS))
    return found


def build_pages(sheets):
    familiers = build_familiers(sheets[TAB_FAMILIERS])
    maison = build_maison(sheets[TAB_MAISON])
    machines = build_machines(sheets[TAB_MACHINES])
    maladie = build_maladie(sheets[TAB_MALADIE])
    maladie_v2 = build_maladie_v2(sheets[TAB_MALADIE_V2], sheets[TAB_MALADIE])
    tour = build_tour(sheets[TAB_TOUR])
    return [familiers, maison, machines, maladie_v2, maladie, tour]


def frontmatter_field(text, name):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    t = re.search(r"^%s:\s*(.*)$" % name, m.group(1), re.M)
    if not t:
        return None
    raw = t.group(1).strip()
    try:
        return json.loads(raw) if raw[:1] in ('"', "[") else raw.strip("'")
    except ValueError:
        return raw


def page_keys(slug, title, aliases):
    """Clés par lesquelles le wiki résout un lien vers la page (slug, titre, alias ; voir wikilinks.mjs)."""
    keys = {normalize(slug), normalize(title)}
    keys.update(normalize(a) for a in aliases)
    keys.discard("")
    return keys


def check_conflicts(pages, out_root):
    """Fichiers existants, puis unicité des titres, alias et slugs face aux pages des autres familles."""
    out_dir = os.path.join(out_root, CATEGORY)
    targets = {os.path.abspath(os.path.join(out_dir, p["slug"] + ".md")): p for p in pages}
    problems = []
    seen = {}
    for p in pages:
        for k in page_keys(p["slug"], p["title"], p["aliases"]):
            if k in seen and seen[k] is not p:
                problems.append("clé %r portée par deux pages de la famille (%s, %s)" % (k, seen[k]["slug"], p["slug"]))
            seen[k] = p
    for dirpath, _, files in sorted(os.walk(out_root)):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            path = os.path.abspath(os.path.join(dirpath, fname))
            with open(path, encoding="utf-8") as fh:
                existing = fh.read()
            if path in targets:
                mine = targets[path]
                if sources_for(mine["tab"])[0] not in existing or source_url() not in existing:
                    problems.append("%s existe et n'est pas issu de l'onglet « %s »" % (path, mine["tab"]))
                continue
            title = frontmatter_field(existing, "title")
            aliases = frontmatter_field(existing, "aliases")
            keys = page_keys(os.path.splitext(fname)[0], title if isinstance(title, str) else "",
                             aliases if isinstance(aliases, list) else [])
            clash = sorted(k for k in keys if k in seen)
            if clash:
                problems.append("%s porte déjà la clé %s (titre, alias ou slug)" % (path, ", ".join(clash)))
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « divers-craft » du wiki depuis le dump JSON de « Ressources et Craft ».")
    ap.add_argument("--dump", action="append", required=True, help="dump JSON du classeur « Ressources et Craft »")
    ap.add_argument("--out", required=True, help="dossier racine du wiki (client/src/content/wiki)")
    args = ap.parse_args(argv)

    sheets = load_sheets(args.dump)
    pages = build_pages(sheets)
    texts = {p["slug"]: render_page(p) for p in pages}

    problems = check_conflicts(pages, args.out)
    if problems:
        raise SystemExit("Arrêt, rien n'a été écrit :\n  " + "\n  ".join(problems))

    out_dir = os.path.join(args.out, CATEGORY)
    os.makedirs(out_dir, exist_ok=True)
    written = unchanged = 0
    for p in pages:
        path = os.path.join(out_dir, p["slug"] + ".md")
        text = texts[p["slug"]]
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                if fh.read() == text:
                    unchanged += 1
                    continue
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        written += 1
    for w in WARNINGS:
        print("AVERTISSEMENT : " + w, file=sys.stderr)
    print("%d pages (%d écrites, %d inchangées) dans %s" % (len(pages), written, unchanged, out_dir))


if __name__ == "__main__":
    main()
