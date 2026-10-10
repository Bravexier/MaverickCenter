#!/usr/bin/env python3
"""Famille « divers-craft » : familiers, maison, machines de guerre et de siège, maladies, fiche de tour.
Six pages du wiki, une par onglet, dans `<out>/ressources/<slug>.md`.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/divers-craft.py --dump <ressources-craft.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki
    python3 -I tools/sheets/divers-craft.py --dump <ressources-craft.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki --verifier      # ne réécrit rien

Le dump JSON est produit par tools/sheets/xlsx_to_json.py (format : voir ce script ; celui d'APRÈS l'ajout des commentaires :
cellules avec `note` et `threads`). Les cellules sont une donnée non
fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur n'est calculée,
corrigée ni complétée : fautes d'orthographe, majuscules, espaces et formulations de la source sont conservés.

Source : Google Sheet « Ressources et Craft » (1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw), six de ses quatorze onglets
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
    absents). Un commentaire de cellule (H39, Tétanos, Effets) est cité sous le champ qu'il commente.
  * « Fiche de tour » -> fiche-de-tour.md. Un tableau GROUPE / JOUEUR x AVANT LE TOUR / PENDANT LE TOUR / FIN DU TOUR
    (lignes 3 à 12), puis le tableau « Déroulement d'un tour » (lignes 40 à 56, libellé en A, texte en E). Un
    commentaire de cellule (L12) est cité sous le premier tableau.

NOTES ET FILS DE COMMENTAIRES DE CELLULE (clés `note` et `threads` des cellules du dump). Une NOTE est le petit commentaire jaune
d'une cellule, un FIL est une conversation « Commentaire » de Google Sheets ; ils précisent parfois une règle (« Se traduit par
une croix en Force et Agilité et Social »). Ils sont cités tels que le classeur les écrit (mêmes conventions de rendu que le reste
de la page), jamais interprétés ni reformulés ni corrigés, sous le champ ou le tableau qui porte leur cellule, dans la même
section, dans l'ordre : la note de la cellule, puis ses fils. Libellés (ceux de la famille « races » : « **Note de la cellule
« Don »** : … ») :
    **Note de la cellule « <intitulé de la cellule> »** : texte                  (texte d'une ligne)
    **Note de la cellule « <intitulé de la cellule> »**                          (texte de plusieurs lignes : libellé, ligne
                                                                                  vide, puis paragraphes et listes)
    **Commentaire de la cellule « … »** / **Commentaire résolu de la cellule « … »**    (fil ouvert / résolu)
L'intitulé est l'en-tête du champ (« Effets », sous le titre de la maladie, dans sa section) ; pour une case de tableau, l'en-tête
de la colonne suivi, entre parenthèses, du libellé de la ligne (« PENDANT LE TOUR (JOUEUR) »). Les réponses automatiques d'un fil
(« Marquée comme fermée » / « Rouverte ») sont des événements, pas du contenu ; toute autre réponse arrête le script. Une note ou
un fil blanc (espaces seuls) est ignoré. Un commentaire posé sur une cellule fusionnée autre que celle en haut à gauche est rattaché
à la cellule principale, qui porte la valeur. Cellules qui peuvent porter un commentaire, par page : le nom et chaque champ d'une
maladie (« Maladie ») ; chaque case des deux tableaux de « Fiche de tour » (libellés de ligne compris). Les autres pages (« Familiers »,
« Maison », « Machine de GuerreSiège », « Maladie V2 ») n'ont aucune place prévue : un commentaire sur l'une de leurs cellules
arrête le script (aucun n'existe aujourd'hui). Le script S'ARRÊTE, sans rien écrire, avec un message qui nomme l'onglet et la
cellule, si un commentaire :
  * est sur une cellule vide (le dump garde alors v = "" : un commentaire ne se rattache à aucun texte), cellule fusionnée non
    principale dont la principale est vide comprise ;
  * est dans un onglet que ni ce script ni equipement.py (les huit autres onglets du classeur) ne publient ;
  * est sur une cellule que la page reprend sans lui prévoir de place (« sans place prévue ») ;
  * n'est pas retrouvé dans sa page, ou y figure plus d'une fois, tronqué, altéré, ou placé hors de la section de sa cellule
    (contrôle de couverture et de placement, refait sur le TEXTE des pages avant toute écriture) ; la page ne porte aucun
    commentaire de plus que le dump.
Option --verifier : n'écrit rien. Relit le dump, recalcule les commentaires attendus directement dans le JSON brut (sans le code de
rendu), compare chaque page écrite à ce que le dump produit, cherche chaque commentaire dans la page de son onglet (une occurrence,
texte intégral, après sa cellule, dans sa section, aucun de plus) et rejoue des cas d'erreur sur des copies en mémoire du dump
(commentaire sur une cellule vide, sur une cellule fusionnée non principale dont la principale est vide, dans un onglet non publié,
sans place prévue, réponse de fil inattendue ; commentaire retiré, dupliqué, tronqué, altéré ou déplacé dans une page). Code de
sortie 1 et un « ÉCART : … » par problème s'il y en a.

Le lien hypertexte de la cellule U3 de « Familiers » n'est pas dans le dump JSON : il est recopié ici mot pour mot depuis le
classeur .xlsx (constante CELL_LINKS), et n'est écrit que si la cellule du dump porte bien la valeur attendue (sinon le script
s'arrête).

Le script s'arrête avec une erreur, sans rien écrire, si une cellule non vide d'un onglet du périmètre n'est pas
reconnue (rien n'est perdu en silence), si un en-tête n'est pas celui attendu, si un titre, un alias ou un slug est déjà
porté par une page d'une autre famille, ou si un fichier existant n'est pas issu du même onglet.

Il ne touche qu'aux six fichiers `<out>/ressources/<slug>.md` de sa famille : il n'efface rien, ne réécrit pas un
fichier dont le contenu ne change pas. Aucun lien [[…]] n'est écrit (une cellule qui en contiendrait serait neutralisée
et signalée sur la sortie d'erreur).
"""
import argparse
import contextlib
import io
import json
import os
import re
import sys
import unicodedata

CATEGORY = "ressources"
STATUS = "draft"

WORKBOOK_TITLE = "Ressources et Craft"
WORKBOOK_ID = "1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw"

TAB_FAMILIERS = "Familiers"
TAB_MAISON = "Maison"
TAB_MACHINES = "Machine de GuerreSiège"
TAB_MALADIE_V2 = "Maladie V2"
TAB_MALADIE = "Maladie"
TAB_TOUR = "Fiche de tour"
TABS = (TAB_FAMILIERS, TAB_MAISON, TAB_MACHINES, TAB_MALADIE_V2, TAB_MALADIE, TAB_TOUR)

# Commentaires de cellule du dump (clés `note` et `threads`) : genres, libellés rendus dans la page, réponses automatiques d'un fil.
KIND_NOTE, KIND_THREAD, KIND_THREAD_DONE = "note", "thread", "thread_done"
LABELS = {
    KIND_NOTE: "Note de la cellule « %s »",
    KIND_THREAD: "Commentaire de la cellule « %s »",
    KIND_THREAD_DONE: "Commentaire résolu de la cellule « %s »",
}
STATUS_REPLIES = ("Marquée comme fermée", "Rouverte")   # événements d'état écrits par Google, pas du contenu

# Onglets de « Ressources et Craft » publiés par tools/sheets/equipement.py : leurs commentaires ne sont pas rendus ici (comptés).
SIBLING_TABS = ("Équipement inventaire", "Armes", "Armures", "Bouclier", "Bâton magique", "LivreParchemin", "Accessoires",
                "Pièces élémentaires")
SIBLING_SCRIPT = "equipement.py"

# Liens hypertexte attachés à une cellule entière (lus dans le .xlsx) : onglet -> {(ligne, colonne): (référence,
# fin attendue de la valeur de la cellule, URL)}.
CELL_LINKS = {
    TAB_FAMILIERS: {
        (3, 21): (
            "U3",
            "Ici pour les fiches : Familiers",
            "https://docs.google.com/spreadsheets/d/1Xhj8DINY6NlufeHSUnB_mHYyPXEvSBOno32wWZXOEBk/edit?usp=sharing",
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


def col_number(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def split_ref(ref):
    """« AE3 » -> (3, 31) : (ligne, colonne)."""
    return int(re.sub(r"\D", "", ref)), col_number(re.sub(r"\d", "", ref))


def parse_range(rng):
    m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", rng)
    if not m:
        raise ValueError("plage fusionnée invalide : %r" % rng)
    return int(m.group(2)), col_number(m.group(1)), int(m.group(4)), col_number(m.group(3))


def shorten(text, limit=40):
    flat = " ".join(str(text).split())
    return flat if len(flat) <= limit else flat[: limit - 1] + "…"


def comment_items(tab, cell):
    """[(genre, texte)] des commentaires d'une cellule du dump : sa note, puis ses fils dans l'ordre du dump (texte blanc ignoré).
    Une réponse de fil autre qu'un événement d'état est un contenu qui n'a pas de place dans la page : ValueError."""
    out = []
    ref = coord(cell["r"], cell["c"])
    note = cell.get("note")
    if note is not None:
        if not isinstance(note, str):
            raise ValueError("%s!%s : la note n'est pas un texte : %r" % (tab, ref, note))
        if note.strip():
            out.append((KIND_NOTE, note))
    for thread in cell.get("threads") or []:
        for reply in thread.get("replies") or []:
            if " ".join(str(reply).split()) not in STATUS_REPLIES:
                raise ValueError("%s!%s : fil de commentaires : réponse inattendue (%r), ni rendue ni écartée : à examiner" % (
                    tab, ref, shorten(reply, 60)))
        text = thread.get("text")
        if isinstance(text, str) and text.strip():
            out.append((KIND_THREAD_DONE if thread.get("done") else KIND_THREAD, text))
    return out


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        pending = []   # [(cellule, [(genre, texte)])] commentaires du dump, avant rattachement
        for c in raw["cells"]:
            items = comment_items(self.name, c)
            if items:
                pending.append(((c["r"], c["c"]), items))
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
                if "[[" in fmt(c["v"]):
                    WARNINGS.append("« [[ » dans la cellule %s de l'onglet %s (échappé, ce n'est pas un lien)"
                                    % (coord(c["r"], c["c"]), self.name))
        self.merges = {}  # (ligne, colonne) en haut à gauche -> (ligne, colonne) en bas à droite
        for rng in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(rng)
            self.merges[(r1, c1)] = (r2, c2)
        self.consumed = set()
        # Commentaires par cellule qui porte une valeur. Un commentaire sur une cellule vide n'a aucune place dans la page, sauf
        # sur une cellule fusionnée autre que celle en haut à gauche : il appartient à la plage, donc à la cellule principale.
        self.comments = {}
        for key, items in sorted(pending):
            target = key
            if key not in self.cells:
                corner = self.primary_of(key)
                if corner is None or corner not in self.cells:
                    hint = " (cellule fusionnée non principale de %s, dont la cellule principale est vide)" % coord(*corner) if corner else ""
                    raise ValueError("%s!%s : la cellule est vide%s mais porte %s (« %s ») : un commentaire ne se rattache à aucun "
                                     "texte de la page" % (self.name, coord(*key), hint,
                                                           "une note" if items[0][0] == KIND_NOTE else "un fil de commentaires",
                                                           shorten(items[0][1])))
                target = corner
            self.comments.setdefault(target, []).extend(items)

    def primary_of(self, key):
        """Cellule en haut à gauche de la plage fusionnée qui contient `key` sans en être le coin (None sinon)."""
        r, c = key
        for (r1, c1), (r2, c2) in self.merges.items():
            if r1 <= r <= r2 and c1 <= c <= c2 and (r1, c1) != key:
                return (r1, c1)
        return None

    def pop_comments(self, r, c):
        """Commentaires [(genre, texte)] de la cellule (r, c), retirés de la liste des commentaires à placer."""
        return self.comments.pop((r, c), [])

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
        if self.comments:  # une cellule commentée que la page reprend (ou ne reprend pas) sans lui avoir prévu de place
            items = ["%s (« %s »)" % (coord(*pos), shorten(entries[0][1])) for pos, entries in sorted(self.comments.items())]
            raise ValueError("%s : %d cellule(s) portent un commentaire sans place prévue dans la page : %s ; la page ne cite que les "
                             "commentaires des maladies et de la fiche de tour (voir la docstring)" % (
                                 self.name, len(self.comments), " ; ".join(items[:8])))
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
# Liens de cellule (recopiés du .xlsx) et commentaires de cellule (lus dans le dump)
# --------------------------------------------------------------------------------------------------------------------

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


def comment_block(kind, label, text):
    """Lignes Markdown d'un commentaire de cellule : « **Note de la cellule « intitulé »** : texte » si le texte tient sur une ligne,
    sinon le libellé seul, une ligne vide, puis le texte en paragraphes et en listes. Le texte n'est ni interprété ni reformulé."""
    head = LABELS[kind] % esc_inline(norm_ws(label), block=False)
    blocks = md_blocks(text)
    if len(blocks) == 1 and blocks[0][0] == "p" and len(blocks[0][1]) == 1:
        return ["**%s** : %s" % (head, esc_inline(blocks[0][1][0]))]
    return ["**%s**" % head, ""] + md_text(text)


def comment_lines(entries):
    """[(intitulé, [(genre, texte)])] -> lignes Markdown : un bloc par commentaire, chacun suivi d'une ligne vide."""
    out = []
    for label, items in entries:
        for kind, text in items:
            out += comment_block(kind, label, text) + [""]
    return out


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
        body += [heading(2, name), ""] + comment_lines([(norm_ws(name), sh.pop_comments(r, 1))])
        for c, h in zip(MALADIE_COLS[1:], headers[1:]):
            value = sh.take(r, c)
            if value is None:
                continue
            # le commentaire d'un champ est cité sous ce champ, dans la section de la maladie
            body += labeled(h, value) + [""] + comment_lines([(h, sh.pop_comments(r, c))])
    sh.check_all_consumed()
    if len(set(names)) != len(names):
        raise ValueError("%s : noms de maladies en double" % sh.name)
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
    rows, notes = [], []
    for r in sh.rows_with(1, 4, 39):
        label = norm_ws(sh.peek(r, 1))
        rows.append([sh.take(r, 1)] + [sh.take(r, c) for c in phase_cols])
        notes.append((label, sh.pop_comments(r, 1)))
        for c, phase in zip(phase_cols, phases):
            notes.append(("%s (%s)" % (phase, label), sh.pop_comments(r, c)))   # cités sous le tableau : « PENDANT LE TOUR (JOUEUR) »
    body += table([""] + phases, rows) + [""] + comment_lines(notes)
    # Tableau 2 : « Déroulement d'un tour » (E40), libellés en A, textes en E.
    title = sh.take(40, 5)
    if title is None:
        raise ValueError("%s : titre « Déroulement d'un tour » manquant en E40" % sh.name)
    rows, notes = [], []
    for r in sh.rows_with(1, 41, 10 ** 6):
        label = norm_ws(sh.peek(r, 1))
        rows.append([sh.take(r, 1), sh.take(r, 5)])
        notes += [(label, sh.pop_comments(r, 1)), ("%s (%s)" % (norm_ws(title), label), sh.pop_comments(r, 5))]
    body += table(["", norm_ws(title)], rows) + [""] + comment_lines(notes)
    sh.check_all_consumed()
    return page("fiche-de-tour", "Fiche de tour", TAB_TOUR, ["tour"], body)


# --------------------------------------------------------------------------------------------------------------------
# Lecture du dump, contrôles, écriture
# --------------------------------------------------------------------------------------------------------------------

def pick_dump(paths):
    """(dump, {onglet: dump brut de l'onglet}) du dump qui contient les six onglets de la famille (un seul doit les contenir)."""
    found = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            dump = json.load(fh)
        names = [s["name"] for s in dump["sheets"]]
        if all(t in names for t in TABS):
            if found is not None:
                raise ValueError("deux dumps contiennent les onglets de « %s »" % WORKBOOK_TITLE)
            found = (dump, {s["name"]: s for s in dump["sheets"]})
            for s in dump["sheets"]:
                if s["name"] in TABS and s.get("state", "visible") != "visible":
                    WARNINGS.append("onglet %s masqué" % s["name"])
    if found is None:
        raise ValueError("aucun dump ne contient les onglets %s" % ", ".join(TABS))
    return found


def make_sheets(raws):
    return {name: Sheet(raws[name]) for name in TABS}


BUILDERS = {
    TAB_FAMILIERS: build_familiers,
    TAB_MAISON: build_maison,
    TAB_MACHINES: build_machines,
    TAB_MALADIE: build_maladie,
    TAB_TOUR: build_tour,
}


def build_pages(sheets):
    familiers = build_familiers(sheets[TAB_FAMILIERS])
    maison = build_maison(sheets[TAB_MAISON])
    machines = build_machines(sheets[TAB_MACHINES])
    maladie = build_maladie(sheets[TAB_MALADIE])
    maladie_v2 = build_maladie_v2(sheets[TAB_MALADIE_V2], sheets[TAB_MALADIE])
    tour = build_tour(sheets[TAB_TOUR])
    return [familiers, maison, machines, maladie_v2, maladie, tour]


# --------------------------------------------------------------------------------------------------------------------
# Commentaires de cellule : refus, contrôle de couverture et de placement
# --------------------------------------------------------------------------------------------------------------------

# onglet -> page produite. Table écrite à part, à dessein : les contrôles cherchent un commentaire dans la page de son onglet sans
# s'appuyer sur les constructeurs ci-dessus.
PAGE_OF_TAB = {
    "Familiers": "familiers",
    "Maison": "maison",
    "Machine de GuerreSiège": "machine-de-guerresiege",
    "Maladie V2": "fievre-des-marais",
    "Maladie": "maladie",
    "Fiche de tour": "fiche-de-tour",
}
LABEL_RE = re.compile(r"\*\*(Note|Commentaire résolu|Commentaire) de la cellule « .*? »\*\*(?: : (.*))?\s*$", re.S)
MARKER_RE = re.compile(r"(?:Note|Commentaire résolu|Commentaire) de la cellule « ")
KIND_OF_LABEL = {"Note": KIND_NOTE, "Commentaire": KIND_THREAD, "Commentaire résolu": KIND_THREAD_DONE}
KIND_NAME = {KIND_NOTE: "la note", KIND_THREAD: "le fil de commentaires", KIND_THREAD_DONE: "le fil de commentaires (résolu)"}


def canon_note(text):
    return " ".join(str(text).split())


def canon_page(text):
    """Texte d'une page tel qu'on le lit : sauts de ligne forcés, <br> et échappements Markdown retirés, espaces ramenés à un seul."""
    t = text.replace("<br>", " ")
    t = re.sub(r"\\(.)", r"\1", t, flags=re.S)
    return " ".join(t.replace("&lt;", "<").split())


def raw_comments(data, tabs):
    """[(onglet, adresse, genre, texte)] : notes et fils non blancs des onglets `tabs`, lus dans le JSON brut du dump, sans le code de
    lecture ni de rendu de ce script (l'adresse est celle du dump : celle d'une cellule fusionnée non principale, le cas échéant)."""
    out = []
    for sheet in data["sheets"]:
        if sheet["name"] not in tabs:
            continue
        for cell in sheet["cells"]:
            ref = coord(cell["r"], cell["c"])
            note = cell.get("note")
            if isinstance(note, str) and note.strip():
                out.append((sheet["name"], ref, KIND_NOTE, note))
            for thread in cell.get("threads") or []:
                text = thread.get("text")
                if isinstance(text, str) and text.strip():
                    out.append((sheet["name"], ref, KIND_THREAD_DONE if thread.get("done") else KIND_THREAD, text))
    return out


def refuse_unpublished(data):
    """Un commentaire dans un onglet que ni ce script ni equipement.py ne publient n'aurait aucune place dans le wiki : ValueError.
    -> [(onglet, notes, fils)] des onglets de equipement.py qui portent des commentaires (rendus par lui, comptés ici)."""
    elsewhere = []
    for sheet in data["sheets"]:
        name = sheet["name"]
        found = raw_comments(data, [name])
        if name in PAGE_OF_TAB or not found:
            continue
        if name in SIBLING_TABS:
            elsewhere.append((name, sum(1 for f in found if f[2] == KIND_NOTE), sum(1 for f in found if f[2] != KIND_NOTE)))
            continue
        cells = ", ".join("%s (« %s »)" % (ref, shorten(text)) for _t, ref, _g, text in found[:5])
        raise ValueError("onglet « %s » : %d commentaire(s) de cellule (%s) dans un onglet que divers-craft.py ne publie pas (onglets "
                         "publiés : %s ; %s publie : %s) : ils n'auraient aucune place dans le wiki, rien n'est écrit" % (
                             name, len(found), cells, ", ".join("« %s »" % t for t in PAGE_OF_TAB), SIBLING_SCRIPT,
                             ", ".join("« %s »" % t for t in SIBLING_TABS)))
    return elsewhere


def page_blocks(text):
    """Blocs (séparés par une ligne vide) du corps d'une page, sans l'en-tête YAML."""
    body = text.split("\n---\n", 1)[1] if "\n---\n" in text else text
    return [b.strip() for b in re.split(r"\n\s*\n", body) if b.strip()]


def page_entries(blocks):
    """[(index du bloc, genre, [textes canoniques possibles])] : un élément par bloc qui ouvre un commentaire (« **Note de la cellule
    « … »** … »). Un commentaire sur une ligne n'a qu'un texte ; un commentaire qui ouvre par son libellé seul est suivi de ses
    paragraphes et listes (blocs consécutifs, jusqu'à un titre, un tableau ou un champ en gras) : chaque début de suite de blocs est
    un texte possible. Le texte est comparé en entier (égalité) : un commentaire qui n'est que le début d'un autre n'est pas confondu."""
    entries = []
    for i, block in enumerate(blocks):
        m = LABEL_RE.match(block)
        if not m:
            continue
        if m.group(2) is not None:
            candidates = [canon_page(m.group(2))]
        else:
            candidates, taken = [], []
            for later in blocks[i + 1:i + 41]:
                if later.startswith(("#", "|", "**")):
                    break
                taken.append(later)
                candidates.append(canon_page("\n\n".join(taken)))
        entries.append((i, KIND_OF_LABEL[m.group(1)], candidates))
    return entries


def assign(expected, entries):
    """Associe chaque commentaire attendu [(adresse, genre, texte)] à une entrée de page non encore utilisée, de même genre et de
    même texte intégral. -> ([(attendu, index de bloc ou None)], [entrées non utilisées])."""
    used, matched = set(), []
    for ref, genre, text in expected:
        key = canon_note(text)
        found = next((k for k, (_i, g, candidates) in enumerate(entries) if k not in used and g == genre and key in candidates), None)
        if found is None:
            matched.append(((ref, genre, text), None))
        else:
            used.add(found)
            matched.append(((ref, genre, text), entries[found][0]))
    return matched, [e for k, e in enumerate(entries) if k not in used]


def note_problems(data, texts):
    """Contrôle de couverture : {page: texte} -> liste d'écarts. Chaque note et chaque fil du dump doit figurer dans la page de son
    onglet exactement une fois (autant de fois qu'il y a de commentaires de même texte), avec son texte intégral et son libellé, et la
    page ne porte aucun commentaire de plus. Une page absente de `texts` n'est pas examinée (l'appelant la signale)."""
    problems = []
    expected = raw_comments(data, PAGE_OF_TAB)
    for tab, slug in PAGE_OF_TAB.items():
        if slug not in texts:
            continue
        mine = [(ref, genre, text) for (t, ref, genre, text) in expected if t == tab]
        blocks = page_blocks(texts[slug])
        matched, unused = assign(mine, page_entries(blocks))
        for (ref, genre, text), index in matched:
            if index is None:
                problems.append("%s : %s de la cellule %s (« %s ») devrait figurer exactement une fois dans la page avec son texte "
                                "intégral et son libellé : introuvable" % (slug, KIND_NAME[genre], ref, shorten(canon_note(text), 50)))
        for index, _genre, candidates in unused:
            problems.append("%s : la page porte un commentaire de plus que le dump (ou un doublon) : « %s »" % (
                slug, shorten(candidates[0] if candidates else blocks[index], 50)))
        markers = len(MARKER_RE.findall(canon_page("\n\n".join(blocks))))
        if markers != len(mine):
            problems.append("%s : la page porte %d libellé(s) de commentaire, le dump en compte %d" % (slug, markers, len(mine)))
    return problems


def anchor_text(sheet, ref):
    """Texte repère de la cellule `ref` du dump brut : sa ligne la plus longue (celle d'une cellule fusionnée non principale : la
    ligne de la cellule principale), que la page reprend mot pour mot ; None si la cellule est vide."""
    r, c = split_ref(ref)
    values = {(x["r"], x["c"]): x.get("v") for x in sheet["cells"]}
    value = values.get((r, c))
    if is_blank(value):
        for rng in sheet.get("merged", []):
            r1, c1, r2, c2 = parse_range(rng)
            if r1 <= r <= r2 and c1 <= c <= c2:
                value = values.get((r1, c1))
    if is_blank(value):
        return None
    return max((canon_note(line) for line in fmt(value).split("\n")), key=len)


def place_problems(data, texts):
    """Contrôle de placement : chaque commentaire retrouvé doit venir APRÈS le texte de sa cellule, dans la même section (aucun
    titre entre les deux). {page: texte} -> liste d'écarts ; les commentaires introuvables sont signalés par note_problems."""
    problems = []
    sheets = {s["name"]: s for s in data["sheets"]}
    expected = raw_comments(data, PAGE_OF_TAB)
    for tab, slug in PAGE_OF_TAB.items():
        if slug not in texts or tab not in sheets:
            continue
        mine = [(ref, genre, text) for (t, ref, genre, text) in expected if t == tab]
        blocks = page_blocks(texts[slug])
        canon = [canon_page(b) for b in blocks]
        matched, _unused = assign(mine, page_entries(blocks))
        for (ref, genre, text), index in matched:
            anchor = None if index is None else anchor_text(sheets[tab], ref)
            if anchor is None:
                continue
            at = next((k for k in range(index - 1, -1, -1) if anchor in canon[k]), None)
            if at is None:
                problems.append("%s : la cellule %s (« %s ») ne figure pas dans la page avant %s qui la commente" % (
                    slug, ref, shorten(anchor, 40), KIND_NAME[genre]))
            elif any(blocks[k].startswith("#") for k in range(at + 1, index)):
                problems.append("%s : %s de la cellule %s est dans une autre section que sa cellule (« %s »)" % (
                    slug, KIND_NAME[genre], ref, shorten(anchor, 40)))
    return problems


# --------------------------------------------------------------------------------------------------------------------
# --verifier : contrôle indépendant, n'écrit rien
# --------------------------------------------------------------------------------------------------------------------

CONTROL_NOTE = "Note de contrôle du vérificateur : texte de rejeu."
CONTROL_THREAD = "Fil de contrôle du vérificateur : texte de rejeu."
FAR = (2000, 2000)   # cellule que la page d'aucun onglet ne reprend

# onglet -> (cellule dont la page cite les commentaires, cellule que la page reprend SANS place prévue pour un commentaire).
# None : aucune cellule de cet onglet ne reçoit de commentaire.
REPLAY_CELLS = {
    "Familiers": (None, "A1"),
    "Maison": (None, "A1"),
    "Machine de GuerreSiège": (None, "A1"),
    "Maladie V2": (None, "A1"),
    "Maladie": ("H3", "A1"),
    "Fiche de tour": ("B5", "B3"),
}


def tab_of(data, name):
    return next((s for s in data["sheets"] if s["name"] == name), None)


def with_cell(data, tab, cell, merged=None):
    """Copie du dump avec `cell` ajoutée à l'onglet `tab` (créé s'il n'existe pas) ; le dump d'origine n'est pas touché."""
    copied = json.loads(json.dumps(data))
    sheet = tab_of(copied, tab)
    if sheet is None:
        sheet = {"name": tab, "state": "visible", "max_row": 1, "max_col": 1, "merged": [], "cells": []}
        copied["sheets"].append(sheet)
    sheet["cells"].append(cell)
    if merged:
        sheet.setdefault("merged", []).append(merged)
    return copied


def with_comment_on(data, tab, ref, **fields):
    """Copie du dump avec les champs `fields` (note, threads) ajoutés à la cellule `ref` de l'onglet `tab` (None si elle est vide)."""
    copied = json.loads(json.dumps(data))
    pos = split_ref(ref)
    for cell in tab_of(copied, tab)["cells"]:
        if (cell["r"], cell["c"]) == pos and not is_blank(cell["v"]):
            cell.update(fields)
            return copied
    return None


def build_tab(data, tab):
    """Page de l'onglet `tab` construite sur `data` (ValueError si la construction s'arrête). Le message sur la sortie d'erreur
    du second gabarit vide de « Maladie V2 » n'est pas répété."""
    raws = {s["name"]: s for s in data["sheets"]}
    sink = io.StringIO()
    with contextlib.redirect_stderr(sink):
        if tab == TAB_MALADIE_V2:
            return build_maladie_v2(Sheet(raws[tab]), Sheet(raws[TAB_MALADIE]))
        return BUILDERS[tab](Sheet(raws[tab]))


def tab_error(data, tab):
    """Message d'arrêt de la construction de la page de `tab` sur `data` (None si elle va au bout)."""
    try:
        build_tab(data, tab)
    except ValueError as err:
        return str(err)
    return None


def replay_errors(data):
    """Rejoue des cas d'erreur sur des copies en mémoire du dump (le vrai dump et les vraies pages ne sont pas touchés).
    -> (nombre de cas rejoués, écarts)."""
    failures, count = [], 0

    def expect_stop(label, message, needles):
        nonlocal count
        count += 1
        if message is None:
            failures.append("rejeu « %s » : le script ne s'arrête pas" % label)
            return
        for needle in needles:
            if needle not in message:
                failures.append("rejeu « %s » : message d'arrêt sans « %s » : %s" % (label, needle, message[:200]))

    for tab in TABS:
        if tab_of(data, tab) is None:
            failures.append("rejeu « %s » : onglet absent du dump" % tab)
            continue
        placed, unplaced = REPLAY_CELLS[tab]
        expect_stop("note sur une cellule vide (%s)" % tab,
                    tab_error(with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "note": CONTROL_NOTE}), tab),
                    (coord(FAR[0] + 1, FAR[1]), "vide", "une note"))
        expect_stop("fil sur une cellule vide (%s)" % tab,
                    tab_error(with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "threads": [{"text": CONTROL_THREAD}]}), tab),
                    (coord(FAR[0] + 1, FAR[1]), "vide", "un fil"))
        merged = "%s:%s" % (coord(*FAR), coord(FAR[0] + 1, FAR[1]))
        expect_stop("note sur une cellule fusionnée non principale dont la principale est vide (%s)" % tab,
                    tab_error(with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "note": CONTROL_NOTE}, merged), tab),
                    ("vide", "fusionnée non principale"))
        noted = with_comment_on(data, tab, unplaced, note=CONTROL_NOTE)
        if noted is None:
            failures.append("rejeu « %s » : cellule %s introuvable ou vide dans le dump" % (tab, unplaced))
        else:
            expect_stop("note sans place prévue (%s %s)" % (tab, unplaced), tab_error(noted, tab), ("sans place prévue", unplaced))
        replied = with_comment_on(data, tab, unplaced, threads=[{"text": CONTROL_THREAD, "replies": ["Une vraie réponse"]}])
        if replied is not None:
            expect_stop("réponse de fil inattendue (%s)" % tab, tab_error(replied, tab), ("réponse inattendue", unplaced))
        if placed is None:
            continue
        # commentaires posés sur une cellule que la page cite : acceptés, retrouvés une fois, et signalés si la page les perd
        count += 1
        noted = with_comment_on(data, tab, placed, note=CONTROL_NOTE, threads=[{"text": CONTROL_THREAD, "done": True, "replies": list(STATUS_REPLIES)}])
        if noted is None:
            failures.append("rejeu « %s » : cellule %s introuvable ou vide dans le dump" % (tab, placed))
            continue
        try:
            page = build_tab(noted, tab)
        except ValueError as err:
            failures.append("rejeu « %s » : un commentaire de contrôle sur %s est refusé : %s" % (tab, placed, str(err)[:200]))
            continue
        slug, text = page["slug"], render_page(page)
        for problem in note_problems(noted, {slug: text}) + place_problems(noted, {slug: text}):
            failures.append("rejeu « %s » : page conforme jugée non conforme : %s" % (tab, problem))
        lines = text.split("\n")
        at_note = [i for i, ln in enumerate(lines) if CONTROL_NOTE in ln]
        at_thread = [i for i, ln in enumerate(lines) if CONTROL_THREAD in ln]
        if len(at_note) != 1 or len(at_thread) != 1:
            failures.append("rejeu « %s » : le commentaire de contrôle figure %d + %d fois dans la page (1 + 1 attendus)" % (
                tab, len(at_note), len(at_thread)))
            continue
        i, j = at_note[0], at_thread[0]
        variants = {
            "note retirée": "\n".join(lines[:i] + lines[i + 1:]),
            "note dupliquée": "\n".join(lines[: i + 1] + ["", lines[i]] + lines[i + 1:]),
            "note tronquée": text.replace(CONTROL_NOTE, CONTROL_NOTE[:25]),
            "note altérée": text.replace(CONTROL_NOTE, CONTROL_NOTE.replace("texte de rejeu.", "texte de rejeux.")),
            "note déplacée dans une autre section": "\n".join(lines[:i] + ["## Section de rejeu", ""] + lines[i:]),
            "fil retiré": "\n".join(lines[:j] + lines[j + 1:]),
            "fil dupliqué": "\n".join(lines[: j + 1] + ["", lines[j]] + lines[j + 1:]),
            "fil rendu non résolu": text.replace("**Commentaire résolu de la cellule", "**Commentaire de la cellule"),
        }
        for label, variant in variants.items():
            count += 1
            if not (note_problems(noted, {slug: variant}) + place_problems(noted, {slug: variant})):
                failures.append("rejeu « %s » : %s : aucun écart signalé" % (tab, label))
    # onglets non publiés
    count += 1
    try:
        refuse_unpublished(with_cell(data, "Onglet de contrôle", {"r": 1, "c": 1, "v": "x", "note": CONTROL_NOTE}))
        failures.append("rejeu « note dans un onglet inconnu » : le script ne s'arrête pas")
    except ValueError as err:
        if "ne publie pas" not in str(err):
            failures.append("rejeu « note dans un onglet inconnu » : message d'arrêt inattendu : %s" % str(err)[:200])
    count += 1
    try:
        refuse_unpublished(with_cell(data, "Onglet de contrôle", {"r": 1, "c": 1, "v": "x", "threads": [{"text": CONTROL_THREAD}]}))
        failures.append("rejeu « fil dans un onglet inconnu » : le script ne s'arrête pas")
    except ValueError as err:
        if "ne publie pas" not in str(err):
            failures.append("rejeu « fil dans un onglet inconnu » : message d'arrêt inattendu : %s" % str(err)[:200])
    count += 1
    counted = refuse_unpublished(with_cell(data, SIBLING_TABS[0], {"r": FAR[0], "c": FAR[1], "v": "x", "note": CONTROL_NOTE}))
    if not any(name == SIBLING_TABS[0] and notes >= 1 for name, notes, _threads in counted):
        failures.append("rejeu « note dans un onglet de %s » : elle devrait être comptée, pas refusée" % SIBLING_SCRIPT)
    return count, failures


def verify(dumps, out_dir):
    """--verifier : n'écrit rien. -> (code de sortie, lignes affichées)."""
    try:
        data, raws = pick_dump(dumps)
        elsewhere = refuse_unpublished(data)
        pages = build_pages(make_sheets(raws))
    except ValueError as err:
        return 1, ["ÉCART : %s" % err]
    problems, texts, pages_ok = [], {}, 0
    for p in pages:
        path = os.path.join(out_dir, CATEGORY, p["slug"] + ".md")
        if not os.path.exists(path):
            problems.append("%s : page absente (%s)" % (p["slug"], path))
            continue
        with open(path, encoding="utf-8") as fh:
            texts[p["slug"]] = fh.read()
        if texts[p["slug"]] != render_page(p):
            problems.append("%s : la page écrite n'est pas celle que le dump produit (relancer le script)" % p["slug"])
        else:
            pages_ok += 1
    problems += note_problems(data, texts) + place_problems(data, texts)
    count, failures = replay_errors(data)
    problems += failures
    if problems:
        return 1, ["ÉCART : %s" % p for p in problems[:40]]
    mine = raw_comments(data, PAGE_OF_TAB)
    lines = ["--verifier : %d page(s) identiques à ce que le dump produit ; %d note(s) et %d fil(s) de commentaires du périmètre, "
             "chacun retrouvé exactement une fois avec son texte intégral, après sa cellule et dans sa section, aucun de plus ; "
             "%d cas d'erreur rejoués (cellule vide, cellule fusionnée sans principale, onglet non publié, sans place prévue, "
             "réponse de fil inattendue, commentaire retiré / dupliqué / tronqué / altéré / déplacé)" % (
                 pages_ok, sum(1 for m in mine if m[2] == KIND_NOTE), sum(1 for m in mine if m[2] != KIND_NOTE), count)]
    for name, notes, threads in elsewhere:
        lines.append("onglet « %s » : %d note(s) et %d fil(s) rendus par %s" % (name, notes, threads, SIBLING_SCRIPT))
    return 0, lines


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
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule les commentaires de cellule depuis le dump, les compare aux pages écrites "
                         "et rejoue des cas d'erreur")
    args = ap.parse_args(argv)

    if args.verifier:
        code, lines = verify(args.dump, args.out)
        for line in lines:
            print(line, file=sys.stderr if code else sys.stdout)
        return code

    try:
        data, raws = pick_dump(args.dump)
        elsewhere = refuse_unpublished(data)
        pages = build_pages(make_sheets(raws))
    except ValueError as err:
        raise SystemExit("ERREUR : %s\nArrêt, rien n'a été écrit." % err)
    texts = {p["slug"]: render_page(p) for p in pages}

    # contrôle de couverture et de placement des commentaires, sur le texte des pages, avant toute écriture
    problems = note_problems(data, texts) + place_problems(data, texts)
    if problems:
        raise SystemExit("Contrôle de couverture des commentaires de cellule, rien n'a été écrit :\n  " + "\n  ".join(problems[:30]))
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
    mine = raw_comments(data, PAGE_OF_TAB)
    print("commentaires de cellule : %d note(s) et %d fil(s) cités, chacun une fois (couverture et placement contrôlés)" % (
        sum(1 for m in mine if m[2] == KIND_NOTE), sum(1 for m in mine if m[2] != KIND_NOTE)))
    for name, notes, threads in elsewhere:
        print("onglet « %s » : %d note(s) et %d fil(s) de commentaires, rendus par %s" % (name, notes, threads, SIBLING_SCRIPT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
