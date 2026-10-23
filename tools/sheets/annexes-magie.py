#!/usr/bin/env python3
"""Famille « annexes-magie » : annexes des magies (altérations d'état, météo, modes hyper et super).

Usage :
    python3 -I tools/sheets/annexes-magie.py --dump <magie-v8.json> --dump <mode-hyper.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki
    python3 -I tools/sheets/annexes-magie.py --dump <magie-v8.json> --dump <mode-hyper.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki --verifier      # n'écrit rien

Les dumps JSON sont produits par tools/sheets/xlsx_to_json.py (format : voir ce fichier). On peut ne passer
qu'un seul des deux ; chaque dump est reconnu à un onglet qui lui est propre (voir WORKBOOKS). Bibliothèque
standard uniquement ; le script ne lit que les dumps et n'écrit que les pages de sa famille dans
<out>/guide/. Il est déterministe et idempotent (une page dont le contenu ne change pas n'est pas réécrite),
n'efface rien et refuse d'écraser un fichier qui n'a pas été produit par lui (contrôle sur l'URL de source).

NOTES DE CELLULE (clé `note` des cellules du dump, voir xlsx_to_json.py et sheets_api_to_json.py) : le petit commentaire jaune
d'une cellule. Le texte d'une note est cité tel que le classeur l'écrit (mêmes conventions de rendu que le reste de la page :
espaces de début et de fin de ligne retirés, « * » et « _ » échappés) ; il n'est jamais interprété ni reformulé. Une note est écrite
dans la section de la page qui reçoit sa cellule, juste après l'élément qui la porte (après le tableau quand la cellule est dans un
tableau), sous la forme « **Note de la cellule « <intitulé de la cellule> »** : <texte> » (une note sur plusieurs lignes : le
libellé seul, puis le texte en paragraphes et en listes), comme tools/sheets/races.py. L'intitulé est celui de la colonne (« Type »,
« Stade 2 », « Description »…), suivi entre parenthèses de la ligne du tableau (« Effet (Sang + Eau) ») ; un texte libre sans
intitulé prend son adresse (« AA1 »). Cellules qui peuvent porter une note, par page :
  * Altération détats : Nom (juste sous l'intertitre), Magie Liée, Type, Stade 1 à 3 (ou la cellule fusionnée des stades), libellé
    et effet de chaque paire Résistances/Vulnérabilités ;
  * Météo : nom, Description, Effet(s) ;
  * Mode Hyper (Magie) : texte général et cases Mono magie / Bi magie de « Avantages de base », nom et effet de chaque ligne des
    deux tableaux ;
  * Mode Hyper et Mode Super (classeur « Mode hyper et co ») : les textes explicatifs et les cellules des tableaux.
Le script S'ARRÊTE, sans rien écrire, avec un message qui nomme l'onglet et la cellule, si une note :
  * est sur une cellule vide (le dump garde alors v = "" ; la note d'une cellule fusionnée autre que celle en haut à gauche est dans
    ce cas) : aucune place dans la page ;
  * est dans un onglet que ce script ne publie pas (Sommaire, onglet inconnu) : sa justification de non-publication n'est plus
    vraie. Exceptions : les 15 onglets de magie du classeur V8 (MAGIES_TABS), dont les notes sont rendues par tools/sheets/magies.py,
    et les onglets ignorés par décision du propriétaire (IGNORED_TABS : « Statistiques », décision R86) ; leurs notes sont comptées et
    annoncées, pas rendues ici ;
  * est sur une cellule que la page ne reprend pas (« sans place prévue ») ;
  * n'est pas retrouvée dans sa page, ou y figure plus d'une fois, ou y figure tronquée (contrôle de couverture, refait sur le TEXTE
    des pages avant toute écriture) : chaque note du dump doit figurer dans la page de son onglet exactement une fois (autant de
    fois qu'il y a de notes de même texte), avec son texte intégral, et la page ne porte aucune note de plus.
Une note blanche (espaces seulement) ne porte aucun texte : elle est ignorée.
Les FILS de commentaires (clé `threads`, la conversation « Commentaire » de Google Sheets) ne sont pas des notes : ils ne sont pas
rendus par ce mécanisme. Le script les dénombre sur la sortie standard avec leur sort (repris, ou non publié et pourquoi) afin
qu'aucun ne soit perdu en silence. État des classeurs au moment de l'import des notes : AUCUNE note dans les onglets de cette famille
(ni dans Sommaire, Altération détats, Météo, Statistiques et Mode Hyper (Magie) de « Magie V8 », ni dans « Mode hyper et co »). Les
quatre cellules commentées sont : Sommaire!A1 (26 fils orphelins, onglet non publié), Statistiques!BH27 et AR52 (fils sur des
compteurs, onglet ignoré), Mode Hyper (Magie)!M43 (fil repris dans CELL_COMMENTS). Les pages sont donc inchangées par ce mécanisme.

Option --verifier : n'écrit rien. Relit les dumps, recalcule les notes attendues directement dans le JSON brut (sans le code de
rendu), les cherche dans les pages écrites (texte déséchappé, une occurrence par note, aucune de plus), compare chaque page à ce
que le dump produit, recoupe CELL_COMMENTS avec les fils du dump et rejoue des cas d'erreur sur des copies en mémoire des dumps
(note sur cellule vide, dans un onglet non publié, sans place, note retirée / dupliquée / tronquée / altérée dans une page).

Sources (classeurs Google, copies du Drive du propriétaire, migration 0014) et pages produites :

  « Magie Maverick V8 » (1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0)
    - onglet « Altération détats »  -> guide/liste-des-alterations-d-etat.md
        Ligne 1 : titre (lettres espacées). Ligne 2 : en-têtes Nom | Magie Liée | Type | Stade 1 | Stade 2 |
        Stade 3 | Résistances/Vulnérabilités. Ensuite des blocs de 5 lignes, un par altération (20 au total) :
        les cellules de nom, de magie, de type et de stades sont fusionnées sur les 5 lignes ; les 5 lignes
        portent aussi, en colonnes AQ/AV, une paire « libellé / effet » (Sensibilité, Grande vulnérabilité,
        Vulnérabilité, Résistances, Grande résistance). Pour certaines altérations la description est une
        seule cellule fusionnée sur les trois colonnes de stades. Une section par altération ; les paires
        sans effet écrit dans la source sont omises (ce qui est vide reste absent).
    - onglet « Météo »              -> guide/meteo.md
        En-têtes B1 Météo | H1 Description | T1 Effet(s) ; une entrée tous les 7 lignes (cellules fusionnées),
        le nom en colonne B, la description en H et les effets (une ligne « - … » par effet) en T.
    - onglet « Mode Hyper (Magie) » (ONGLET MASQUÉ) -> guide/mode-hyper-magie.md
        Lignes 1 à 14 : un effet par magie seule (nom en H, effet en M). Lignes 15 à 87 : un effet par
        combinaison de deux magies (B, « + » en G, H, effet en M). À droite : encadré « Avantages de base »
        (texte général, puis deux cases « Mono magie » et « Bi magie »).
        Un commentaire de cellule (M43, effet de « Vide + Nécromancie ») est ajouté en fin de page : c'est un FIL de
        commentaires (non une note) ; les anciens dumps ne le portaient pas, il est donc recopié depuis le .xlsx dans la
        constante CELL_COMMENTS (--verifier le recoupe avec le champ `threads` des dumps récents).
    - onglet « Statistiques » : IGNORÉ (décision R86 du propriétaire, 2026-10-15 : « tu peux ignorer l'onglet "Statistiques"
        c'est des données mise à la main il y a longtemps »). Ni ses compteurs ni son tableau « Résistance Faiblesse » (les
        résistances et faiblesses des couples de deux magies, au plus quatre magies par palier) ne sont lus : depuis la
        décision R85, celles d'un couple se calculent depuis les listes de chaque magie (vue v_resistance_combinaison de
        data/schema.sql, migration 0049, qui a retiré la page guide/statistiques-resistance-faiblesse que ce script en tirait).
        Une note ou un fil de commentaires de l'onglet n'arrête rien : il est compté et annoncé.

  « Mode hyper et co » (1AjQyT-IZMULq6FlgnmVmn2QiQ9AWhhbOgjr-COgMyMo)
    - onglet « Mode Hyper » -> guide/liste-des-effets-mode-hyper.md
        Trois textes explicatifs en colonne AA (lignes 1, 14, 30), puis un tableau « Magie/Type | Mono magie |
        Bi magie » (ligne 2, entrées de 3 lignes fusionnées) et, à partir de la ligne « Race | Effet », un
        tableau des effets par race. Quatre effets généraux (« Général » : Dégâts physique +15, Soin magique +15,
        Consommation de chakra = 0 ; « Potentiel illimité » : Dégâts physique neutre, Résistance à la magie) sont
        dans une cellule fusionnée sur les deux colonnes « Mono magie » ET « Bi magie » (F:Y) : le texte vaut pour
        les deux cas ; il est donc écrit dans les deux colonnes du tableau (la page ne laisse pas croire qu'il n'y
        a pas d'effet en bi magie).
    - onglet « Mode Super » -> guide/liste-des-effets-mode-super.md
        Un texte explicatif en colonne AI (ligne 1), puis un tableau « Objet | Effets mode super |
        Description/apparence » (entrées de 4 lignes fusionnées). Le nom du premier objet (A3) est une cellule
        numérique au format Général dont la valeur en cache est 400.0 : elle est reprise telle quelle.

Conventions de rendu : valeurs en cache, mot pour mot (un nombre garde sa forme, « 400.0 » reste « 400.0 ») ;
espaces de début et de fin de ligne retirés ; retour à la ligne d'une cellule de tableau -> « <br> » ; « | »
-> « \\| » ; « * », « _ » et « ` » échappés ; aucun lien [[…]] n'est écrit (une cellule qui en contient serait
neutralisée et signalée sur la sortie d'erreur).
"""
import argparse
import copy
import json
import os
import re
import sys
from collections import Counter

CATEGORY = "guide"

# Libellé d'une note de cellule rendue dans une page (même forme que tools/sheets/races.py).
NOTE_LABEL = "Note de la cellule « %s »"

# Les 15 onglets de magie du classeur V8 : leurs notes sont rendues par tools/sheets/magies.py, pas par ce script.
MAGIES_TABS = (
    "Potentiel illimité (magie diffi", "Sang", "Arcane", "Corruption", "TempsEspace", "Vide", "Nécromancie", "Feu",
    "Eau", "Glace", "Terre", "Vent", "Foudre", "Lumière", "Ombre",
)

# Onglets ignorés par décision du propriétaire, par classeur : rien n'en est lu ; leurs notes et leurs fils de commentaires n'arrêtent rien, ils sont
# comptés et annoncés. « Statistiques » (décision R86) : des compteurs et le tableau « Résistance Faiblesse » des couples de magies, écrits à la main il
# y a longtemps ; les résistances d'un couple se calculent depuis les listes de chaque magie (décision R85, vue v_resistance_combinaison).
IGNORED_TABS = {
    "magie-v8": ("Statistiques",),
}

# Titres des pages qui se renvoient l'une à l'autre (deux classeurs, deux listes d'effets du mode hyper).
TITLE_HYPER_MAGIE = "Mode Hyper (Magie)"
TITLE_HYPER_LISTE = "Liste des effets mode hyper"

# Identification des classeurs à partir d'un onglet qui leur est propre.
WORKBOOKS = [
    {
        "key": "magie-v8",
        "marker": "Altération détats",
        "title": "Magie Maverick V8",
        "file_id": "1fF2buZjbCm3xdQ-Qa8vRecxj03do3hsE8_k_cfYnIR0",
    },
    {
        "key": "mode-hyper",
        "marker": "Mode Super",
        "title": "Mode hyper et co",
        "file_id": "1AjQyT-IZMULq6FlgnmVmn2QiQ9AWhhbOgjr-COgMyMo",
    },
]

WORKBOOK_TITLES = {wb["key"]: wb["title"] for wb in WORKBOOKS}


# Commentaires de cellule du classeur d'origine : le dump JSON ne les contient pas (seuls les .xlsx les portent),
# ils sont donc recopiés ici mot pour mot depuis le .xlsx. Un commentaire n'est écrit que si la cellule du dump
# porte bien la valeur attendue. Forme : classeur -> onglet -> [(cellule, valeur attendue, commentaire, résolu)].
CELL_COMMENTS = {
    "magie-v8": {
        "Mode Hyper (Magie)": [
            (
                "M43",
                "Permet d'invoquer un ou des fantômes (voir catégorie invocation dans bestiaire)",
                "Sous cette forme, Il est impossible de faire des dégâts physiques et seuls les armes spectrales "
                "sont utilisables ainsi que les sorts.",
                True,
            ),
        ],
    },
}


# ---------------------------------------------------------------------------------------------------------
# Lecture du dump
# ---------------------------------------------------------------------------------------------------------

def col_to_num(letters):
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n


def parse_range(ref):
    m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", ref)
    if not m:
        raise ValueError("plage fusionnée illisible : " + ref)
    return (int(m.group(2)), col_to_num(m.group(1)), int(m.group(4)), col_to_num(m.group(3)))


def num_to_col(n):
    letters = ""
    while n:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def a1(r, c):
    return "%s%d" % (num_to_col(c), r)


def is_blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.state = raw.get("state", "visible")
        self.cells = {}
        self.notes = {}        # (ligne, colonne) -> texte de la note (non blanc), tel que le dump l'écrit
        self.empty_notes = {}  # idem, sur une cellule vide : refusé (refuse_empty_notes)
        self.threads = {}      # (ligne, colonne) -> nombre de fils de commentaires (information : ce ne sont pas des notes)
        self.taken = set()     # notes déjà écrites dans la page
        for c in raw["cells"]:
            pos, v, note = (c["r"], c["c"]), c.get("v"), c.get("note")
            if note is not None:
                if not isinstance(note, str):
                    raise SystemExit("onglet « %s » : la note de %s n'est pas un texte : %r" % (self.name, a1(*pos), note))
                if note.strip():
                    (self.empty_notes if is_blank(v) else self.notes)[pos] = note
            if c.get("threads"):
                self.threads[pos] = len(c["threads"])
            if v is None:
                continue
            if v == "" and "f" not in c and ("note" in c or "threads" in c):
                continue  # cellule vide gardée par le dump pour ne pas perdre son commentaire : ce n'est pas du contenu
            self.cells[pos] = v
        self.merged_from = {}  # (ligne, colonne) en haut à gauche -> (r1, c1, r2, c2)
        for ref in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(ref)
            self.merged_from[(r1, c1)] = (r1, c1, r2, c2)

    def merged_hint(self, r, c):
        """« cellule fusionnée non principale de A3:A7 » si (r, c) est dans une plage fusionnée sans en être le coin haut gauche."""
        for (r1, c1, r2, c2) in self.merged_from.values():
            if (r1, c1) != (r, c) and r1 <= r <= r2 and c1 <= c <= c2:
                return "cellule fusionnée non principale de %s:%s" % (a1(r1, c1), a1(r2, c2))
        return None

    def get(self, r, c):
        return self.cells.get((r, c))

    def note_blocks(self, targets):
        """Blocs Markdown des notes des cellules `targets` [((ligne, colonne), intitulé)], dans l'ordre donné ; les notes
        écrites sont marquées comme prises (une note qui n'est prise par aucun bloc arrête le script)."""
        out = []
        for pos, label in targets:
            text = self.notes.get(pos)
            if text is not None:
                self.taken.add(pos)
                out.append(note_block(label, text))
        return out

    def untaken_notes(self):
        return sorted(set(self.notes) - self.taken)

    def find(self, value):
        """Première cellule (ligne, colonne) dont la valeur vaut `value`, dans l'ordre ligne puis colonne."""
        for (r, c) in sorted(self.cells):
            if self.cells[(r, c)] == value:
                return (r, c)
        return None


def spans_column(sh, r, c, target):
    """Vrai si la cellule (r, c), en haut à gauche d'une plage fusionnée, s'étend jusqu'à la colonne `target`."""
    span = sh.merged_from.get((r, c))
    return span is not None and span[0] <= r <= span[2] and span[1] <= target <= span[3]


def read_dump(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def make_sheets(data):
    return {s["name"]: Sheet(s) for s in data["sheets"]}


def identify(sheets):
    for wb in WORKBOOKS:
        if wb["marker"] in sheets:
            return wb
    return None


# ---------------------------------------------------------------------------------------------------------
# Rendu Markdown
# ---------------------------------------------------------------------------------------------------------

WARNINGS = []


def fmt(value):
    """Valeur en cache -> texte, sans arrondi (400.0 reste 400.0)."""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float):
        return repr(value)
    return str(value)


def lines_of(value):
    """Lignes d'une cellule : espaces de début/fin retirés, lignes vides de début/fin supprimées."""
    text = fmt(value).replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return lines


def esc(line):
    if "[[" in line:
        WARNINGS.append("cellule contenant « [[ » neutralisée : " + line[:80])
        line = line.replace("[", "\\[")
    return (
        line.replace("\\", "\\\\")
        .replace("*", "\\*")
        .replace("_", "\\_")
        .replace("`", "\\`")
        .replace("|", "\\|")
        .replace("<", "&lt;")
    )


def cell(value):
    """Contenu d'une cellule de tableau ou d'une ligne de liste : retours à la ligne -> <br>."""
    if value is None:
        return ""
    return "<br>".join(esc(ln) for ln in lines_of(value))


def one_line(value):
    """Texte sur une seule ligne (titres) : les retours à la ligne deviennent des espaces."""
    return " ".join(fmt(value).split())


def start_guard(line):
    """Évite qu'un début de ligne soit pris pour du Markdown (liste, titre, citation, numérotation)."""
    if re.match(r"^(#|>|\+\s|\d+[.)]\s)", line):
        return "\\" + line
    return line


def is_heading_line(lines, i, max_len=40):
    """Intertitre : ligne courte, sans point final, précédée d'une ligne vide (ou en tête) et suivie directement
    d'une ligne de texte."""
    ln = lines[i]
    if not ln or len(ln) > max_len or ln[-1] in ".:" or ln.startswith("-"):
        return False
    if i > 0 and lines[i - 1] != "":
        return False
    return i + 1 < len(lines) and lines[i + 1] != ""


def blocks(value, headings=False):
    """Texte multi-lignes -> Markdown : lignes « - … » en liste, intertitres éventuels en `##`, le reste en
    paragraphes (retour à la ligne simple -> <br>)."""
    lines = lines_of(value)
    out = []
    para = []
    items = []

    def flush():
        if para:
            out.append("<br>\n".join(para))
            para.clear()
        if items:
            out.append("\n".join(items))
            items.clear()

    for i, ln in enumerate(lines):
        if ln == "":
            flush()
        elif headings and is_heading_line(lines, i):
            flush()
            out.append("## " + esc(ln))
        elif ln.startswith("- "):
            if para:
                flush()
            items.append("- " + esc(ln[2:]))
        else:
            if items:
                flush()
            para.append(start_guard(esc(ln)))  # protéger APRÈS l'échappement : sinon la barre de protection serait elle-même doublée
    flush()
    return "\n\n".join(out)


def note_block(label, text):
    """Note de cellule : « **Note de la cellule « intitulé »** : texte » (une ligne), sinon le libellé seul puis le texte
    en paragraphes et en listes. Le texte de la note n'est ni interprété ni reformulé."""
    head = "**" + NOTE_LABEL % esc(one_line(label)) + "**"
    body = blocks(text)
    if "\n" in body or body.startswith("- "):
        return head + "\n\n" + body
    return head + " : " + body


def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def yaml_str(value):
    return json.dumps(value, ensure_ascii=False)


def front_matter(title, tags, summary, workbook, tab):
    lines = [
        "---",
        "title: " + yaml_str(title),
        "aliases: []",
        "tags: [" + ", ".join(yaml_str(t) for t in tags) + "]",
    ]
    if summary:
        lines.append("summary: " + yaml_str(summary))
    sources = [
        "Google Sheet « %s », onglet « %s »" % (workbook["title"], tab),
        "https://docs.google.com/spreadsheets/d/%s/edit" % workbook["file_id"],
    ]
    lines.append("sources: [" + ", ".join(yaml_str(s) for s in sources) + "]")
    lines.append("status: draft")
    lines.append("---")
    return "\n".join(lines) + "\n"


def same_letters(a, b):
    squash = lambda s: re.sub(r"\s+", "", s).casefold()
    return squash(a) == squash(b)


# ---------------------------------------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------------------------------------

def page_alterations(sh, wb):
    title = "Liste des altérations d'état"
    a1 = sh.get(1, 1)
    if a1 is None or not same_letters(a1, title):
        raise SystemExit("titre de l'onglet « %s » inattendu : %r" % (sh.name, a1))
    # En-têtes (ligne 2), repérés par leur texte.
    header_row = 2
    cols = {}
    for (r, c), v in sh.cells.items():
        if r == header_row:
            cols[v] = c
    for needed in ("Nom", "Magie Liée", "Type", "Stade 1", "Stade 2", "Stade 3", "Résistances/Vulnérabilités"):
        if needed not in cols:
            raise SystemExit("en-tête « %s » introuvable dans « %s »" % (needed, sh.name))
    c_nom, c_mag, c_type = cols["Nom"], cols["Magie Liée"], cols["Type"]
    c_s = [cols["Stade 1"], cols["Stade 2"], cols["Stade 3"]]
    c_res = cols["Résistances/Vulnérabilités"]
    rows = sorted(r for (r, c) in sh.cells if c == c_nom and r > header_row)
    body = []
    for r in rows:
        block_end = sh.merged_from[(r, c_nom)][2] if (r, c_nom) in sh.merged_from else r
        body.append("## " + one_line(sh.get(r, c_nom)))
        body += sh.note_blocks([((r, c_nom), "Nom")])
        info = []
        for header, c in (("Magie Liée", c_mag), ("Type", c_type)):
            v = sh.get(r, c)
            if v is not None:
                info.append("- **%s** : %s" % (header, cell(v)))
        if info:
            body.append("\n".join(info))
        body += sh.note_blocks([((r, c_mag), "Magie Liée"), ((r, c_type), "Type")])
        # Stades : trois colonnes, ou une description unique fusionnée sur les trois colonnes.
        span = sh.merged_from.get((r, c_s[0]))
        if span is not None and span[3] >= c_s[2] and sh.get(r, c_s[0]) is not None:
            body.append(table(["Stades 1 à 3 (cellule fusionnée)"], [[cell(sh.get(r, c_s[0]))]]))
            body += sh.note_blocks([((r, c_s[0]), "Stades 1 à 3 (cellule fusionnée)")])
        else:
            vals = [sh.get(r, c) for c in c_s]
            if any(v is not None for v in vals):
                body.append(table(["Stade 1", "Stade 2", "Stade 3"], [[cell(v) for v in vals]]))
            body += sh.note_blocks([((r, c), "Stade %d" % (i + 1)) for i, c in enumerate(c_s)])
        # Résistances / vulnérabilités : une paire « libellé / effet » par ligne du bloc.
        pairs = []
        pair_notes = []
        for rr in range(r, block_end + 1):
            label = sh.get(rr, c_res)
            after = sorted(c2 for (r2, c2) in sh.cells if r2 == rr and c2 > c_res)
            effect = sh.get(rr, after[0]) if after else None
            if label is not None and effect is not None:
                pairs.append("- **%s** : %s" % (one_line(label), cell(effect)))
                pair_notes.append(((rr, c_res), "Résistances/Vulnérabilités (%s)" % one_line(label)))
                pair_notes.append(((rr, after[0]), one_line(label)))
        if pairs:
            body.append("**Résistances/Vulnérabilités**\n\n" + "\n".join(pairs))
            body += sh.note_blocks(pair_notes)
    return {
        "slug": "liste-des-alterations-d-etat",
        "title": title,
        "tags": ["altérations d'état"],
        "summary": None,
        "tab": sh.name,
        "body": "\n\n".join(body),
    }


def page_meteo(sh, wb):
    title = "Météo"
    c_name = col_to_num("B")
    h_name = sh.get(1, c_name)
    c_desc = sh.find("Description")
    c_eff = sh.find("Effet(s)")
    if h_name != title or c_desc is None or c_eff is None:
        raise SystemExit("en-têtes de l'onglet « %s » inattendus" % sh.name)
    c_desc, c_eff = c_desc[1], c_eff[1]
    rows = sorted(r for (r, c) in sh.cells if c == c_name and r > 1)
    body = []
    for r in rows:
        body.append("## " + one_line(sh.get(r, c_name)))
        body += sh.note_blocks([((r, c_name), title)])
        desc = sh.get(r, c_desc)
        if desc is not None:
            body.append("**Description** : " + cell(desc))
            body += sh.note_blocks([((r, c_desc), "Description")])
        eff = sh.get(r, c_eff)
        if eff is not None:
            body.append("**Effet(s)**\n\n" + blocks(eff))
            body += sh.note_blocks([((r, c_eff), "Effet(s)")])
    return {
        "slug": "meteo",
        "title": title,
        "tags": ["météo"],
        "summary": None,
        "tab": sh.name,
        "body": "\n\n".join(body),
    }


def page_hyper_magie(sh, wb):
    title = TITLE_HYPER_MAGIE
    body = ["*Onglet masqué du classeur d'origine.*" if sh.state == "hidden" else None]
    # Renvoi vers l'autre liste des effets du mode hyper (autre classeur) : les valeurs diffèrent, la source
    # n'indique pas laquelle prévaut, la page ne tranche donc pas.
    body.append(
        "*Le classeur « %s » contient une autre liste des effets du mode hyper (page « %s ») ; "
        "les deux listes ne donnent pas toujours les mêmes valeurs.*" % (WORKBOOK_TITLES["mode-hyper"], TITLE_HYPER_LISTE)
    )
    # Encadré « Avantages de base » (à droite) : texte général, puis cases « Mono magie » / « Bi magie ».
    base = sh.find("Avantages de base")
    mono = sh.find("Mono magie")
    bi = sh.find("Bi magie")
    if base:
        body.append("## Avantages de base")
        general = sh.get(base[0] + 1, base[1])
        if general is not None:
            body.append(blocks(general))
            body += sh.note_blocks([((base[0] + 1, base[1]), "Avantages de base")])
    if mono and bi:
        mono_txt = sh.get(mono[0] + 1, mono[1])
        bi_txt = sh.get(bi[0] + 1, bi[1])
        body.append(table(["Mono magie", "Bi magie"], [[cell(mono_txt), cell(bi_txt)]]))
        body += sh.note_blocks([((mono[0] + 1, mono[1]), "Mono magie"), ((bi[0] + 1, bi[1]), "Bi magie")])
    # Effets par magie seule : colonnes H (magie) et M (effet) ; combinaisons : B, G (« + »), H, M.
    c_a, c_plus, c_b, c_eff = col_to_num("B"), col_to_num("G"), col_to_num("H"), col_to_num("M")
    singles, pairs = [], []
    single_notes, pair_notes = [], []
    for r in sorted({r for (r, c) in sh.cells if c == c_b}):
        a = sh.get(r, c_a)
        name = one_line(sh.get(r, c_b))
        eff = cell(sh.get(r, c_eff))
        if a is None:
            singles.append([esc(name), eff])
            single_notes += [((r, c_b), "Magie (%s)" % name), ((r, c_eff), "Effet (%s)" % name)]
        else:
            plus = sh.get(r, c_plus)
            label = "%s %s %s" % (esc(one_line(a)), esc(one_line(plus)) if plus is not None else "", esc(name))
            pairs.append([" ".join(label.split()), eff])
            raw_label = " ".join(("%s %s %s" % (one_line(a), one_line(plus) if plus is not None else "", name)).split())
            pair_notes += [((r, c), "Magies (%s)" % raw_label) for c in (c_a, c_plus, c_b)] + [((r, c_eff), "Effet (%s)" % raw_label)]
    body.append("## Effets par magie seule")
    body.append(table(["Magie", "Effet"], singles))
    body += sh.note_blocks(single_notes)
    body.append("## Effets par combinaison de deux magies")
    body.append(table(["Magies", "Effet"], pairs))
    body += sh.note_blocks(pair_notes)
    notes = []
    for coord, expected, comment, resolved in CELL_COMMENTS.get(wb["key"], {}).get(sh.name, []):
        m = re.fullmatch(r"([A-Z]+)(\d+)", coord)
        r, c = int(m.group(2)), col_to_num(m.group(1))
        if sh.get(r, c) != expected:
            WARNINGS.append("commentaire de %s ignoré : la cellule ne porte pas la valeur attendue" % coord)
            continue
        a = sh.get(r, c_a)
        who = esc(" + ".join(one_line(x) for x in (a, sh.get(r, c_b)) if x is not None))
        notes.append("- **%s** (cellule %s) : %s" % (who, coord, esc(comment)))
        if resolved:
            notes.append("")
            notes.append("*Commentaire joint à la cellule dans le classeur d'origine, marqué comme résolu.*")
    if notes:
        body.append("## Commentaire de cellule")
        body.append("\n".join(notes))
    return {
        "slug": "mode-hyper-magie",
        "title": title,
        "tags": ["mode hyper", "magie"],
        "summary": None,
        "tab": sh.name,
        "body": "\n\n".join(b for b in body if b),
    }


def first_sentence(value, start):
    m = re.search(re.escape(start) + r"[^.]*\.", fmt(value))
    return " ".join(m.group(0).split()) if m else None


def page_mode_hyper(sh, wb):
    title = TITLE_HYPER_LISTE
    if not same_letters(sh.get(1, 1) or "", title):
        raise SystemExit("titre de l'onglet « %s » inattendu" % sh.name)
    c_txt = col_to_num("AA")
    texts = sorted(r for (r, c) in sh.cells if c == c_txt)
    summary = first_sentence(sh.get(texts[0], c_txt), "Le Mode Hyper est un état de surpuissance") if texts else None
    body = []
    for r in texts:
        body.append(blocks(sh.get(r, c_txt), headings=True))
        body += sh.note_blocks([((r, c_txt), a1(r, c_txt))])
    head = sh.find("Magie/Type")
    race = sh.find("Race")
    if not head or not race:
        raise SystemExit("tableaux introuvables dans « %s »" % sh.name)
    c_label, c_mono, c_bi = head[1], col_to_num("F"), col_to_num("P")
    h_mono, h_bi = sh.get(head[0], c_mono), sh.get(head[0], c_bi)
    rows = []
    note_targets = []
    for r in range(head[0] + 1, race[0]):
        if sh.get(r, c_label) is not None:
            mono, bi = sh.get(r, c_mono), sh.get(r, c_bi)
            # Cellule fusionnée sur « Mono magie » ET « Bi magie » : l'effet vaut pour les deux, on l'écrit dans
            # les deux colonnes (sinon la colonne « Bi magie » vide se lirait « pas d'effet en bi magie »).
            if bi is None and mono is not None and spans_column(sh, r, c_mono, c_bi):
                bi = mono
            rows.append([cell(sh.get(r, c_label)), cell(mono), cell(bi)])
            name = one_line(sh.get(r, c_label))
            note_targets += [
                ((r, c_label), "%s (%s)" % (one_line(sh.get(head[0], c_label)), name)),
                ((r, c_mono), "%s (%s)" % (one_line(h_mono), name)),
                ((r, c_bi), "%s (%s)" % (one_line(h_bi), name)),
            ]
    body.append("## Effets selon la magie ou le type")
    body.append(table([esc(sh.get(head[0], c_label)), esc(h_mono), esc(h_bi)], rows))
    body += sh.note_blocks(note_targets)
    h_eff = sh.get(race[0], col_to_num("F"))
    rows = []
    note_targets = []
    for r in range(race[0] + 1, max(rr for (rr, _c) in sh.cells) + 1):
        if sh.get(r, race[1]) is not None:
            rows.append([cell(sh.get(r, race[1])), cell(sh.get(r, col_to_num("F")))])
            name = one_line(sh.get(r, race[1]))
            note_targets += [
                ((r, race[1]), "%s (%s)" % (one_line(sh.get(race[0], race[1])), name)),
                ((r, col_to_num("F")), "%s (%s)" % (one_line(h_eff), name)),
            ]
    body.append("## Effets selon la race")
    body.append(table([esc(sh.get(race[0], race[1])), esc(h_eff)], rows))
    body += sh.note_blocks(note_targets)
    body.append(
        "*Le classeur « %s » contient, dans un onglet masqué, une autre liste des effets du mode hyper "
        "(page « %s ») ; les deux listes ne donnent pas toujours les mêmes valeurs.*"
        % (WORKBOOK_TITLES["magie-v8"], TITLE_HYPER_MAGIE)
    )
    return {
        "slug": "liste-des-effets-mode-hyper",
        "title": title,
        "tags": ["mode hyper"],
        "summary": summary,
        "tab": sh.name,
        "body": "\n\n".join(body),
    }


def page_mode_super(sh, wb):
    title = "Liste des effets mode super"
    if not same_letters(sh.get(1, 1) or "", title):
        raise SystemExit("titre de l'onglet « %s » inattendu" % sh.name)
    c_txt = col_to_num("AI")
    texts = sorted(r for (r, c) in sh.cells if c == c_txt)
    summary = first_sentence(sh.get(texts[0], c_txt), "C'est un équivalent du mode hyper mais en moins puissant") if texts else None
    body = []
    for r in texts:
        body.append(blocks(sh.get(r, c_txt), headings=True))
        body += sh.note_blocks([((r, c_txt), a1(r, c_txt))])
    head = sh.find("Objet")
    if not head:
        raise SystemExit("tableau introuvable dans « %s »" % sh.name)
    c_obj, c_eff, c_desc = head[1], col_to_num("F"), col_to_num("T")
    headers = [esc(sh.get(head[0], c_obj)), esc(sh.get(head[0], c_eff)), esc(sh.get(head[0], c_desc))]
    rows = []
    note_targets = []
    for r in range(head[0] + 1, max(rr for (rr, _c) in sh.cells) + 1):
        if sh.get(r, c_obj) is not None:
            rows.append([cell(sh.get(r, c_obj)), cell(sh.get(r, c_eff)), cell(sh.get(r, c_desc))])
            name = one_line(sh.get(r, c_obj))
            note_targets += [
                ((r, c), "%s (%s)" % (one_line(sh.get(head[0], c)), name)) for c in (c_obj, c_eff, c_desc)
            ]
    body.append("## Objets")
    body.append(table(headers, rows))
    body += sh.note_blocks(note_targets)
    return {
        "slug": "liste-des-effets-mode-super",
        "title": title,
        "tags": ["mode super"],
        "summary": summary,
        "tab": sh.name,
        "body": "\n\n".join(body),
    }


# onglet -> constructeur de page, par classeur
BUILDERS = {
    "magie-v8": [
        ("Altération détats", page_alterations),
        ("Météo", page_meteo),
        ("Mode Hyper (Magie)", page_hyper_magie),
    ],
    "mode-hyper": [
        ("Mode Hyper", page_mode_hyper),
        ("Mode Super", page_mode_super),
    ],
}

# onglet -> page produite. Table écrite à part, à dessein : le contrôle de couverture des notes (et --verifier) cherche une note
# dans la page de son onglet sans s'appuyer sur les constructeurs ci-dessus.
PAGE_OF_TAB = {
    "Altération détats": "liste-des-alterations-d-etat",
    "Météo": "meteo",
    "Mode Hyper (Magie)": "mode-hyper-magie",
    "Mode Hyper": "liste-des-effets-mode-hyper",
    "Mode Super": "liste-des-effets-mode-super",
}


# ---------------------------------------------------------------------------------------------------------
# Notes de cellule : refus, construction des pages, contrôle de couverture
# ---------------------------------------------------------------------------------------------------------

NOTE_MARKER = "Note de la cellule « "


def shorten(text, limit=40):
    flat = " ".join(str(text).split())
    return flat if len(flat) <= limit else flat[: limit - 1] + "…"


def refuse_unpublished_notes(sheets, wb):
    """Une note dans un onglet que ce script ne publie pas arrête le script (sa justification de non-publication n'est plus vraie),
    sauf dans les onglets de magie du classeur V8 (rendus par magies.py) et dans les onglets ignorés (IGNORED_TABS, décision du
    propriétaire) : -> [(onglet, nombre de notes)] de ces derniers, annoncés."""
    published = [tab for tab, _builder in BUILDERS[wb["key"]]]
    ignored = IGNORED_TABS.get(wb["key"], ())
    elsewhere = []
    for name, sh in sheets.items():
        found = {**sh.empty_notes, **sh.notes}
        if name in published or not found:
            continue
        if (wb["key"] == "magie-v8" and name in MAGIES_TABS) or name in ignored:
            elsewhere.append((name, len(found)))
            continue
        cells = ", ".join("%s (« %s »)" % (a1(r, c), shorten(t)) for (r, c), t in sorted(found.items())[:5])
        raise SystemExit(
            "onglet « %s » : %d note(s) de cellule (%s) dans un onglet que annexes-magie.py ne publie pas (onglets publiés : %s) : "
            "la note n'aurait aucune place dans le wiki, rien n'est écrit"
            % (name, len(found), cells, ", ".join("« %s »" % t for t in published))
        )
    return elsewhere


def refuse_empty_notes(sh):
    """Une note sur une cellule vide (dont une cellule fusionnée autre que celle en haut à gauche) n'a pas de place dans la page."""
    if not sh.empty_notes:
        return
    items = []
    for (r, c), text in sorted(sh.empty_notes.items())[:8]:
        hint = sh.merged_hint(r, c)
        items.append("%s est vide%s mais porte la note « %s »" % (a1(r, c), " (%s)" % hint if hint else "", shorten(text)))
    raise SystemExit(
        "onglet « %s » : note sur une cellule vide, aucune place dans la page, rien n'est écrit : %s" % (sh.name, " ; ".join(items))
    )


def refuse_untaken_notes(sh, page):
    """Toute note d'un onglet publié doit avoir été écrite par la page ; sinon (cellule que la page ne reprend pas) : arrêt."""
    left = sh.untaken_notes()
    if not left:
        return
    why = page.get("why_untaken")
    items = [
        "%s (« %s » : %s)" % (a1(r, c), shorten(sh.notes[(r, c)]), why(r, c) if why else "cellule que la page ne reprend pas")
        for (r, c) in left[:8]
    ]
    raise SystemExit(
        "onglet « %s » (page « %s ») : %d note(s) sans place prévue dans la page, rien n'est écrit : %s"
        % (sh.name, page["slug"], len(left), " ; ".join(items))
    )


def build_tab(sh, builder, wb):
    refuse_empty_notes(sh)
    page = builder(sh, wb)
    refuse_untaken_notes(sh, page)
    return page


def build_pages(sheets, wb):
    """Pages d'un classeur -> (pages, [(onglet de magie, notes)] dont les notes relèvent de magies.py)."""
    elsewhere = refuse_unpublished_notes(sheets, wb)
    return [build_tab(sheets[tab], builder, wb) for tab, builder in BUILDERS[wb["key"]]], elsewhere


def render_page(wb, page):
    return front_matter(page["title"], page["tags"], page["summary"], wb, page["tab"]) + "\n" + page["body"].rstrip() + "\n"


def canon_note(text):
    return " ".join(text.split())


def canon_page(text):
    """Texte d'une page tel qu'on le lit : sauts de ligne forcés et échappements Markdown retirés, espaces ramenés à un seul."""
    t = text.replace("<br>", " ")
    t = re.sub(r"\\(.)", r"\1", t, flags=re.S)
    return " ".join(t.replace("&lt;", "<").split())


def expected_notes(data, wb):
    """[(onglet, adresse, texte)] : notes non blanches des onglets publiés, lues dans le JSON brut du dump (sans le code de rendu)."""
    published = {tab for tab, _builder in BUILDERS[wb["key"]]}
    return [
        (s["name"], a1(c["r"], c["c"]), c["note"])
        for s in data["sheets"]
        if s["name"] in published
        for c in s["cells"]
        if isinstance(c.get("note"), str) and c["note"].strip()
    ]


def page_notes(text):
    """Notes lues dans une page : une liste par bloc qui ouvre une note (« **Note de la cellule « … »** … »), des textes canoniques
    que cette note peut avoir. Une note sur une ligne (« … » : texte) n'a qu'un texte ; une note qui ouvre par son libellé seul est
    suivie de ses paragraphes et listes (blocs séparés par une ligne vide) : chaque début de suite de blocs est un texte possible. Le
    texte d'une note est comparé en entier (égalité) : une note qui n'est que le début d'une autre n'est pas confondue avec elle."""
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    blocks_ = [b.strip() for b in re.split(r"\n\s*\n", body) if b.strip()]
    opened = []
    for i, block in enumerate(blocks_):
        m = re.match(r"\*\*Note de la cellule « .*? »\*\*(?: : (.*))?\s*$", block, re.S)
        if not m:
            continue
        if m.group(1) is not None:
            opened.append([canon_page(m.group(1))])
        else:
            opened.append([canon_page("\n\n".join(blocks_[i + 1:j + 1])) for j in range(i + 1, min(len(blocks_), i + 41))])
    return opened


def note_problems(data, wb, texts):
    """Contrôle de couverture : {page: texte} -> liste d'écarts. Chaque note du dump doit figurer dans la page de son onglet
    exactement une fois (autant de fois qu'il y a de notes de même texte), avec son texte intégral, et la page ne porte aucune
    note de plus. Une page absente de `texts` n'est pas examinée (l'appelant la signale)."""
    problems = []
    notes = expected_notes(data, wb)
    for tab, _builder in BUILDERS[wb["key"]]:
        slug = PAGE_OF_TAB[tab]
        if slug not in texts:
            continue
        mine = [(ref, canon_note(text)) for (t, ref, text) in notes if t == tab]
        opened = page_notes(texts[slug])
        for key, wanted in Counter(k for _ref, k in mine).items():
            found = sum(1 for candidates in opened if key in candidates)
            if found != wanted:
                refs = ", ".join(ref for ref, k in mine if k == key)
                problems.append(
                    "%s : la note de %s (« %s ») devrait figurer %d fois dans la page avec son texte intégral, elle y figure %d fois"
                    % (slug, refs, shorten(key, 50), wanted, found)
                )
        markers = canon_page(texts[slug].split("\n---\n", 1)[-1]).count(NOTE_MARKER)
        if len(opened) != len(mine) or markers != len(mine):
            problems.append(
                "%s : la page porte %d note(s) de cellule, le dump en compte %d" % (slug, max(len(opened), markers), len(mine))
            )
    return problems


def comment_problems(data, wb):
    """Recoupe CELL_COMMENTS (fils recopiés du .xlsx) avec les fils (`threads`) d'un dump récent. Un dump sans aucun champ
    `threads` (ancien format) n'a rien à recouper."""
    if not any("threads" in c for s in data["sheets"] for c in s["cells"]):
        return []
    problems = []
    for tab, items in CELL_COMMENTS.get(wb["key"], {}).items():
        sheet = next((s for s in data["sheets"] if s["name"] == tab), None)
        for coord, _expected, comment, resolved in items:
            m = re.fullmatch(r"([A-Z]+)(\d+)", coord)
            pos = (int(m.group(2)), col_to_num(m.group(1)))
            raw = next((c for c in (sheet["cells"] if sheet else []) if (c["r"], c["c"]) == pos), None)
            threads = (raw or {}).get("threads", [])
            if not any(canon_note(t.get("text", "")) == canon_note(comment) and bool(t.get("done")) == resolved for t in threads):
                problems.append(
                    "CELL_COMMENTS : le commentaire recopié de « %s »!%s ne correspond à aucun fil du dump (texte ou état résolu différent)"
                    % (tab, coord)
                )
    return problems


def threads_report(sheets, wb):
    """Lignes d'information : fils de commentaires (champ `threads`, ce ne sont pas des notes) et leur sort, pour qu'aucun ne se
    perde en silence. Les onglets de magie relèvent de magies.py."""
    published = {tab for tab, _builder in BUILDERS[wb["key"]]}
    ignored = IGNORED_TABS.get(wb["key"], ())
    known = {(tab, coord) for tab, items in CELL_COMMENTS.get(wb["key"], {}).items() for coord, *_rest in items}
    lines = []
    for name, sh in sheets.items():
        if not sh.threads or (wb["key"] == "magie-v8" and name in MAGIES_TABS):
            continue
        for (r, c), n in sorted(sh.threads.items()):
            if name in ignored:
                fate = "onglet ignoré (décision du propriétaire)"
            elif name not in published:
                fate = "onglet non publié par ce script"
            elif (name, a1(r, c)) in known:
                fate = "repris (section « Commentaire de cellule »)"
            else:
                fate = "NON REPRIS : aucune place prévue pour un fil de commentaires"
            lines.append("  « %s » %s : %d fil(s) de commentaires, %s" % (name, a1(r, c), n, fate))
    return lines


# ---------------------------------------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------------------------------------

def write_page(out_dir, wb, page):
    folder = os.path.join(out_dir, CATEGORY)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, page["slug"] + ".md")
    text = render_page(wb, page)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            existing = fh.read()
        mine = ("spreadsheets/d/%s/edit" % wb["file_id"]) in existing.split("\n---\n", 1)[0]
        if not mine:
            raise SystemExit("refus d'écraser %s : ce fichier n'a pas été produit par ce script" % path)
        if existing == text:
            return path, False
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    return path, True


# ---------------------------------------------------------------------------------------------------------
# --verifier : contrôle indépendant, n'écrit rien
# ---------------------------------------------------------------------------------------------------------

CONTROL_NOTE = "Note de contrôle du vérificateur : texte de rejeu."
FAR = (2000, 2000)  # cellule que la page d'aucun onglet ne reprend


def _sheet(data, name):
    return next((s for s in data["sheets"] if s["name"] == name), None)


def with_cell(data, tab, cell):
    """Copie du dump avec `cell` ajoutée à l'onglet `tab` (créé s'il n'existe pas) ; le dump d'origine n'est pas touché."""
    copied = copy.deepcopy(data)
    sheet = _sheet(copied, tab)
    if sheet is None:
        sheet = {"name": tab, "state": "visible", "merged": [], "cells": []}
        copied["sheets"].append(sheet)
    sheet["cells"].append(cell)
    return copied


def stop_message(data, wb):
    """Message d'arrêt de la construction des pages sur `data` (None si elle va au bout)."""
    try:
        build_pages(make_sheets(data), wb)
    except SystemExit as err:
        return str(err.code)
    return None


def anchor(data, tab):
    """Cellule que la page de `tab` reprend toujours, repérée dans le JSON brut : (ligne, colonne), ou None."""
    sheet = _sheet(data, tab)
    cells = {(c["r"], c["c"]): c.get("v") for c in sheet["cells"] if c.get("v") not in (None, "")}

    def first(col, after=0, alone_of=None):
        rows = sorted(r for (r, c) in cells if c == col and r > after and (alone_of is None or (r, alone_of) not in cells))
        return (rows[0], col) if rows else None

    def where(value, row=None):
        found = sorted(pos for pos, v in cells.items() if v == value and (row is None or pos[0] == row))
        return found[0] if found else None

    if tab == "Altération détats":
        head = where("Nom", 2)
        return first(head[1], 2) if head else None
    if tab == "Météo":
        return first(col_to_num("B"), 1)
    if tab == "Mode Hyper (Magie)":
        return first(col_to_num("H"), 0, alone_of=col_to_num("B"))
    if tab == "Mode Hyper":
        return first(col_to_num("AA"))
    if tab == "Mode Super":
        return first(col_to_num("AI"))
    return None


def replay_errors(data, wb):
    """Rejoue des cas d'erreur sur des copies en mémoire du dump (le vrai dump et les vraies pages ne sont pas touchés).
    -> (nombre de cas rejoués, écarts)."""
    failures, count = [], 0

    def expect_stop(label, mutated, needle):
        nonlocal count
        count += 1
        message = stop_message(mutated, wb)
        if message is None:
            failures.append("rejeu « %s » : le script ne s'arrête pas" % label)
        elif needle not in message:
            failures.append("rejeu « %s » : message d'arrêt sans « %s » : %s" % (label, needle, message[:200]))

    for tab, _builder in BUILDERS[wb["key"]]:
        if _sheet(data, tab) is None:
            continue
        expect_stop(
            "note sur une cellule vide (%s)" % tab,
            with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "note": CONTROL_NOTE}),
            "cellule vide",
        )
        expect_stop(
            "note sans place prévue (%s)" % tab,
            with_cell(data, tab, {"r": FAR[0], "c": FAR[1], "v": "Texte hors page", "note": CONTROL_NOTE}),
            "sans place prévue",
        )
        # Note placée sur une cellule que la page reprend : acceptée, retrouvée une fois, et signalée si la page la perd.
        count += 1
        pos = anchor(data, tab)
        if pos is None:
            failures.append("rejeu « %s » : cellule d'ancrage introuvable" % tab)
            continue
        noted = copy.deepcopy(data)
        for cell in _sheet(noted, tab)["cells"]:
            if (cell["r"], cell["c"]) == pos:
                cell["note"] = CONTROL_NOTE
        try:
            pages, _elsewhere = build_pages(make_sheets(noted), wb)
        except SystemExit as err:
            failures.append("rejeu « %s » : une note de contrôle sur %s est refusée : %s" % (tab, a1(*pos), str(err.code)[:200]))
            continue
        texts = {p["slug"]: render_page(wb, p) for p in pages}
        for problem in note_problems(noted, wb, texts):
            failures.append("rejeu « %s » : page conforme jugée non conforme : %s" % (tab, problem))
        slug, text = PAGE_OF_TAB[tab], texts[PAGE_OF_TAB[tab]]
        lines = text.split("\n")
        at = [i for i, ln in enumerate(lines) if CONTROL_NOTE in ln]
        if len(at) != 1:
            failures.append("rejeu « %s » : la note de contrôle figure %d fois dans la page (1 attendue)" % (tab, len(at)))
            continue
        i = at[0]
        variants = {
            "note retirée": "\n".join(lines[:i] + lines[i + 1:]),
            "note dupliquée": "\n".join(lines[: i + 1] + ["", lines[i]] + lines[i + 1:]),
            "note tronquée": text.replace(CONTROL_NOTE, CONTROL_NOTE[:25]),
            "note altérée": text.replace("texte de rejeu.", "texte de rejeux."),
        }
        for label, variant in variants.items():
            count += 1
            if not note_problems(noted, wb, {**texts, slug: variant}):
                failures.append("rejeu « %s » : %s : aucun écart signalé" % (tab, label))
    expect_stop(
        "note dans un onglet inconnu",
        with_cell(data, "Onglet de contrôle", {"r": 1, "c": 1, "v": "x", "note": CONTROL_NOTE}),
        "ne publie pas",
    )
    if wb["key"] == "magie-v8":
        expect_stop(
            "note dans l'onglet Sommaire (non publié)",
            with_cell(data, "Sommaire", {"r": FAR[0], "c": FAR[1], "v": "x", "note": CONTROL_NOTE}),
            "ne publie pas",
        )
    # Une note dans un onglet ignoré (décision du propriétaire) n'arrête rien : elle est annoncée.
    for tab in IGNORED_TABS.get(wb["key"], ()):
        count += 1
        message = stop_message(with_cell(data, tab, {"r": FAR[0], "c": FAR[1], "v": "x", "note": CONTROL_NOTE}), wb)
        if message is not None:
            failures.append("rejeu « note dans l'onglet ignoré %s » : le script s'arrête : %s" % (tab, message[:200]))
    return count, failures


def verify(dumps, out_dir):
    """--verifier : n'écrit rien. Lève SystemExit avec la liste des écarts, sinon affiche un bilan."""
    problems, pages_ok, notes_total, replays, info = [], 0, 0, 0, []
    for path in dumps:
        data = read_dump(path)
        sheets = make_sheets(data)
        wb = identify(sheets)
        if wb is None:
            problems.append("dump non reconnu (aucun onglet attendu) : " + path)
            continue
        label = os.path.basename(path)
        absent = [tab for tab, _b in BUILDERS[wb["key"]] if tab not in sheets]
        if absent:
            problems.append("%s : onglet(s) absent(s) : %s" % (label, ", ".join(absent)))
            continue
        try:
            pages, elsewhere = build_pages(sheets, wb)
        except SystemExit as err:
            problems.append("%s : %s" % (label, err.code))
            continue
        texts = {}
        for page in pages:
            file = os.path.join(out_dir, CATEGORY, page["slug"] + ".md")
            if not os.path.exists(file):
                problems.append("%s : page absente (%s)" % (page["slug"], file))
                continue
            with open(file, encoding="utf-8") as fh:
                texts[page["slug"]] = fh.read()
            if texts[page["slug"]] != render_page(wb, page):
                problems.append("%s : la page écrite n'est pas celle que le dump produit (relancer le script)" % page["slug"])
            else:
                pages_ok += 1
        problems += note_problems(data, wb, texts)
        problems += comment_problems(data, wb)
        notes_total += len(expected_notes(data, wb))
        if elsewhere:
            info.append("%s : notes d'onglets non rendus ici (onglets de magie : magies.py ; onglets ignorés : décision du propriétaire) : %s"
                        % (label, ", ".join("%s %d" % e for e in elsewhere)))
        info += threads_report(sheets, wb)
        saved = list(WARNINGS)
        count, failures = replay_errors(data, wb)
        WARNINGS[:] = saved
        replays += count
        problems += failures
    if problems:
        raise SystemExit("--verifier : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))
    print(
        "--verifier : %d page(s) identiques à ce que les dumps produisent ; %d note(s) de cellule du périmètre, chacune retrouvée "
        "exactement une fois avec son texte intégral, aucune de plus ; %d cas d'erreur rejoués (cellule vide, onglet non publié, "
        "sans place, note retirée / dupliquée / tronquée / altérée)" % (pages_ok, notes_total, replays)
    )
    for line in info:
        print(line)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « annexes-magie » du wiki depuis les dumps JSON des classeurs.")
    ap.add_argument("--dump", action="append", required=True, help="dump JSON (xlsx_to_json.py) ; répétable")
    ap.add_argument("--out", required=True, help="dossier racine du contenu du wiki (client/src/content/wiki)")
    ap.add_argument(
        "--verifier", action="store_true",
        help="n'écrit rien : recalcule les notes depuis les dumps, les compare aux pages écrites et rejoue des cas d'erreur",
    )
    args = ap.parse_args(argv)
    if args.verifier:
        verify(args.dump, args.out)
        return 0
    built = []  # tout est construit et contrôlé avant la première écriture : un refus n'écrit aucune page
    for dump in args.dump:
        data = read_dump(dump)
        sheets = make_sheets(data)
        wb = identify(sheets)
        if wb is None:
            print("dump non reconnu (aucun onglet attendu) : " + dump, file=sys.stderr)
            return 2
        for tab, _builder in BUILDERS[wb["key"]]:
            if tab not in sheets:
                print("onglet absent : « %s » dans %s" % (tab, dump), file=sys.stderr)
                return 2
        pages, elsewhere = build_pages(sheets, wb)
        problems = note_problems(data, wb, {p["slug"]: render_page(wb, p) for p in pages})
        if problems:
            raise SystemExit("contrôle de couverture des notes de cellule, rien n'est écrit :\n  " + "\n  ".join(problems[:30]))
        built.append((wb, pages, len(expected_notes(data, wb)), elsewhere, threads_report(sheets, wb)))
    notes_total = 0
    for wb, pages, count, _elsewhere, _threads in built:
        notes_total += count
        for page in pages:
            path, changed = write_page(args.out, wb, page)
            print(("écrit   " if changed else "inchangé") + " " + path)
    print("notes de cellule : %d dans les dumps (onglets publiés), %d rendues dans les pages (contrôle de couverture passé)" % (notes_total, notes_total))
    for _wb, _pages, _count, elsewhere, _threads in built:
        if elsewhere:
            print("notes d'onglets non rendus ici (onglets de magie : magies.py ; onglets ignorés : décision du propriétaire) : "
                  + ", ".join("%s %d" % e for e in elsewhere))
    lines = [ln for _wb, _pages, _count, _elsewhere, threads in built for ln in threads]
    if lines:
        print("fils de commentaires (champ `threads`, ce ne sont pas des notes ; non rendus par ce mécanisme) :")
        for line in lines:
            print(line)
    for w in WARNINGS:
        print("AVERTISSEMENT : " + w, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
