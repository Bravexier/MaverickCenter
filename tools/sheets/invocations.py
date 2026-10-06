#!/usr/bin/env python3
"""Famille « invocations » : créatures invoquées du classeur « Invocation », une page du wiki par créature
(`<out>/bestiaire/<slug>.md`) et une page d'introduction par onglet (63 créatures + 3 introductions).

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/invocations.py --dump <invocation.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki
    python3 -I tools/sheets/invocations.py --dump <invocation.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki --verifier      # n'écrit rien
    ... --accepter-notes-retirees    # seulement si une note a été retirée du classeur (voir « garde contre un dump périmé »)

Le dump JSON est produit par tools/sheets/xlsx_to_json.py (il doit porter les notes de cellule : champ `note`). Les cellules
sont une donnée non fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur
n'est calculée, corrigée ni complétée : les coquilles de la source (« Sihouetteur », « résisantante », « Poupée sacré »…)
sont reproduites telles quelles.

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

Notes de cellule (le petit commentaire jaune d'une cellule ; champ `note` des cellules du dump, comme dans
tools/sheets/sheets_api_to_json.py et races.py) : une note précise parfois une règle ; elle est citée telle quelle, jamais
interprétée, juste sous la cellule qu'elle commente, sous la forme « **Note de la cellule « <intitulé de la cellule> »** :
<texte> » (le texte sur des lignes à part si la note tient sur plusieurs lignes). L'intitulé est le libellé de la source :
Santé, Chakra, Barrière (ou la ressource supplémentaire) sous le tableau des statistiques ; Dégâts, Défense, Vitesse,
FPVSIA sous la ligne concernée ; Capacité(s) sous le texte des capacités. Le classeur n'en porte qu'une, « Appel aux golems »
G127 (plage fusionnée G127:R128 : les dégâts du Golem de rouage), rendue « Note de la cellule « Dégâts » ». Une note blanche
(espaces seulement) n'est pas une note. Le script ARRÊTE (rien n'est écrit) devant :
  * une note sur une cellule vide (y compris une cellule d'une plage fusionnée autre que la cellule principale) ;
  * une note dans un onglet que le script ne publie pas ;
  * une note sans place prévue dans la page (nom, description, marge, bandeau, texte général, tableau « AMELIORATION
    CADAVERIQUE », panneau « Effet » de la marionette) ;
  * un fil de commentaires (champ `threads` : conversation Google Sheets, distincte de la note), qui n'a pas de place non plus ;
  * une note qui n'est pas un texte.
CONTRÔLE DE COUVERTURE (à chaque lancement, avant d'écrire) : chaque note du dump figure dans la page prévue, entière, autant
de fois qu'il y a de notes identiques sous le même intitulé (une note identique sur deux cellules est écrite deux fois), et
le nombre de notes écrites dans toutes les pages est celui du dump.

GARDE CONTRE UN DUMP PÉRIMÉ (à chaque lancement, avant d'écrire) : le script ne peut pas distinguer un dump « sans note » d'un dump
produit avant la lecture des notes (ancien xlsx_to_json.py, dump de l'API sans le champ `note`) : le second réécrirait les pages
sans leurs notes, sans la moindre erreur. Il compare donc ce qu'il va écrire à ce que les pages déjà écrites portent (lignes
« **Note de la cellule … » et, pour une page d'avant l'import par le dump, l'ancien libellé « **Note de cellule** ») : une page qui
perdrait des notes ARRÊTE le script (rien n'est écrit ; le message nomme les pages et les nombres). Une note qui change de texte ou
une note ajoutée ne déclenche rien (le nombre ne baisse pas). Si la note a vraiment été retirée du classeur : --accepter-notes-retirees
(écrit quand même et signale sur la sortie d'erreur les pages concernées). Sans page déjà écrite (premier import) il n'y a rien à
comparer : un dump dont AUCUNE cellule ne porte de champ `note` est alors signalé par un avertissement (le classeur « Invocation »
en porte une).

Option --verifier : n'écrit rien. Relit le dump, recalcule les notes attendues directement dans le JSON brut (adresse de
la cellule -> créature, intitulé, section, cellule juste au-dessus : géométrie du gabarit écrite à part du code qui génère
les pages), les compare aux pages écrites (page, section, place sous la cellule, texte intégral, nombre d'occurrences, aucune
note de plus, ancien libellé « Note de cellule » absent), vérifie que les pages écrites sont celles que le dump produit (c'est
lui, avec le dump, qui garde TOUT le reste des pages : une ligne changée, supprimée ou ajoutée est un écart ; la suite de tests
du dépôt, sans dump hors dépôt, ne regarde que les notes), signale en clair un dump périmé (la garde ci-dessus), puis rejoue des
cas d'erreur sur des copies en mémoire (note sur une cellule vide, dans un onglet non publié, sans place prévue, fil de
commentaires ; dump sans aucun champ `note` ; note retirée, dupliquée, tronquée, altérée, déplacée dans une page) : chacun doit
être signalé.

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
import copy
import json
import os
import re
import sys
import unicodedata

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
NOTE_LABEL = "Note de la cellule « %s »"       # libellé d'une note de cellule rendue dans la page
NOTE_MARKER = "**" + NOTE_LABEL.split("%s")[0]  # début de toute ligne de note : sert à les compter
LEGACY_NOTE_MARKER = "**Note de cellule"       # libellé d'avant l'import des notes par le dump : ne doit plus figurer
SEC_STATS, SEC_CAPS = "Statistiques", "Capacité(s)"   # sections de la page qui reçoivent des notes
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


def dump_notes(raw):
    """{(ligne, colonne): texte} des notes d'un onglet du dump (une note blanche n'est pas une note).
    S'arrête devant ce qui n'a pas de place : une note sur une cellule vide, une note qui n'est pas un texte, un fil de
    commentaires (champ `threads`)."""
    merged_in = {}
    for rng in raw.get("merged", []):
        a, _, b = rng.partition(":")
        (r1, c1), (r2, c2) = split_ref(a), split_ref(b or a)
        for r in range(r1, r2 + 1):
            for c in range(c1, c2 + 1):
                merged_in[(r, c)] = (rng, ref_of(r1, c1))
    notes = {}
    for cell in raw["cells"]:
        ref = ref_of(cell["r"], cell["c"])
        threads = cell.get("threads")
        if threads:
            raise ValueError("%s : la cellule %s porte %d fil%s de commentaires (conversation « Commentaire » de Google Sheets) : "
                             "aucune place prévue dans la page, le script ne le reprend pas"
                             % (raw["name"], ref, len(threads), "" if len(threads) == 1 else "s"))
        note = cell.get("note")
        if note is None:
            continue
        if not isinstance(note, str):
            raise ValueError("%s : la note de la cellule %s n'est pas un texte (%r)" % (raw["name"], ref, note))
        if is_blank(note):
            continue
        if is_blank(cell["v"]):
            where = ""
            if (cell["r"], cell["c"]) in merged_in:
                where = " ; elle fait partie de la plage fusionnée %s (cellule principale %s)" % merged_in[(cell["r"], cell["c"])]
            raise ValueError("%s : la cellule %s est vide mais porte une note (%r) : disposition non gérée%s"
                             % (raw["name"], ref, fmt(note)[:40], where))
        notes[(cell["r"], cell["c"])] = fmt(note)
    return notes


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
        self.notes = dump_notes(raw)    # notes de cellule : (ligne, colonne) -> texte, cité tel quel dans la page
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
# Analyse d'un onglet
# --------------------------------------------------------------------------------------------------------------------

def parse_card(sh, r0, base, report, owners, creature_key):
    """Lit une carte de créature ; `owners` mémorise, pour chaque cellule lue, (créature, emplacement, intitulé) : l'intitulé est
    le libellé de la source sous lequel la page cite la note de la cellule (None : la page n'a pas de place pour une note)."""
    def take(r, c, slot):
        v = sh.take(r, c)
        if v is not None:
            owners[(r, c)] = (creature_key, slot, None)
        return v

    def own(r, c, slot, intitule):
        if (r, c) in owners:
            owners[(r, c)] = (creature_key, slot, intitule)

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
        own(r0 + STAT_ROW, base + off, "stats", norm_ws(label))
        own(r0 + STAT_ROW, base + off + VALUE_SHIFT, "stats", norm_ws(label))
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
        own(r0 + EXTRA_ROW, base + off, "stats", norm_ws(label))
        own(r0 + EXTRA_ROW, base + off + VALUE_SHIFT, "stats", norm_ws(label))
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
        if lab is not None:
            own(r0 + row_off, base, key, label)
            own(r0 + row_off, base + VALUE_SHIFT, key, label)
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


def attach_notes(tab, sh):
    """Rattache chaque note à la cellule qu'elle commente : (créature, emplacement, intitulé). S'arrête devant une note sans
    place prévue. -> liste des notes placées (onglet, cellule, créature, intitulé, texte), dans l'ordre des cellules."""
    placed = []
    for (r, c), text in sorted(sh.notes.items()):
        owner = tab["owners"].get((r, c))
        if owner is None:
            raise ValueError("%s : la note de la cellule %s est sans place prévue dans la page : la cellule n'est ni le libellé "
                             "ni la valeur d'une statistique, d'une ligne de la carte ou des capacités d'une créature "
                             "(marge, bandeau, texte général, tableau, panneau « Effet »…) : %r" % (sh.name, ref_of(r, c), text[:60]))
        (k, side), slot, intitule = owner
        card = tab["blocks"][k]["cards"][side]
        if intitule is None:
            raise ValueError("%s : la note de la cellule %s est sans place prévue dans la page : c'est le %s de « %s » : %r"
                             % (sh.name, ref_of(r, c), "nom" if slot == "nom" else "texte de la description", card["name"], text[:60]))
        if slot != "stats" and card.get(slot) is None:
            raise ValueError("%s : la note de la cellule %s est sans place prévue dans la page : la ligne « %s » de « %s » n'a pas "
                             "de valeur, la page ne la reprend pas : %r" % (sh.name, ref_of(r, c), intitule, card["name"], text[:60]))
        card.setdefault("notes", {}).setdefault(slot, []).append((intitule, text))
        placed.append({"tab": sh.name, "ref": ref_of(r, c), "page": card["name"], "label": intitule, "text": text})
    return placed


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


def note_lines(intitule, text):
    """Note de cellule, citée telle quelle sous la cellule : « **Note de la cellule « intitulé »** : texte »."""
    return labeled(NOTE_LABEL % intitule, text)


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

    L += ["## " + SEC_STATS, ""]
    headers = [l for l, _ in card["stats"]] + [l for l, _ in card["extras"]]
    values = ["" if v is None else v for _, v in card["stats"]] + ["" if v is None else v for _, v in card["extras"]]
    L += table(headers, [values]) + [""]
    for intitule, text in notes.get("stats", []):
        L += note_lines(intitule, text) + [""]
    for _, label, key in FIXED_ROWS[:-1]:
        if card[key] is not None:
            L += labeled(label, card[key]) + [""]
            for intitule, text in notes.get(key, []):
                L += note_lines(intitule, text) + [""]

    if card["capacites"] is not None:
        L += ["## " + SEC_CAPS, ""] + md_text(card["capacites"]) + [""]
        for intitule, text in notes.get("capacites", []):
            L += note_lines(intitule, text) + [""]
    if "effect" in card:
        label, text = card["effect"]
        L += ["## " + esc_inline(label), ""] + md_text(text) + [""]
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


# --------------------------------------------------------------------------------------------------------------------
# Construction des pages (n'écrit rien)
# --------------------------------------------------------------------------------------------------------------------

def read_dumps(paths):
    """{nom d'onglet: onglet brut} ; le premier dump qui porte un onglet l'emporte."""
    raw_sheets = {}
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        for raw in data["sheets"]:
            raw_sheets.setdefault(raw["name"], raw)
    return raw_sheets


def check_unpublished(raw_sheets):
    """Une note (ou un fil) dans un onglet que ce script ne publie pas serait perdue en silence : arrêt."""
    published = {cfg["name"] for cfg in TABS}
    for name, raw in raw_sheets.items():
        if name in published:
            continue
        found = [ref_of(c["r"], c["c"]) for c in raw["cells"] if c.get("threads") or not is_blank(c.get("note"))]
        if found:
            raise ValueError("onglet « %s » : le script ne publie pas cet onglet, mais %d de ses cellules portent une note ou un fil "
                             "de commentaires (%s) : la note serait perdue" % (name, len(found), ", ".join(found[:8])))


def body_of(text):
    """Corps d'une page, sans l'en-tête YAML (une page sans en-tête, par exemple abîmée à la main, est prise telle quelle)."""
    parts = text.split("\n---\n", 1)
    return parts[1] if len(parts) == 2 else text


def count_block(body, block):
    """Nombre de fois où `block` (une ou plusieurs lignes) figure dans `body` comme paragraphe(s) entier(s)."""
    padded = "\n\n" + body.strip("\n") + "\n\n"
    return len(re.findall(r"(?<=\n\n)" + re.escape(block) + r"(?=\n\n)", padded))


def note_block(intitule, text):
    return "\n".join(note_lines(intitule, text))


def check_coverage(raw_sheets, pages, placed):
    """CONTRÔLE DE COUVERTURE (avant toute écriture) : chaque note non blanche du dump figure dans la page prévue, entière, autant
    de fois qu'il y a de notes identiques sous le même intitulé, et il n'y a pas une note de plus dans toutes les pages."""
    in_dump = sum(1 for cfg in TABS for c in raw_sheets[cfg["name"]]["cells"] if not is_blank(c.get("note")))
    problems = []
    if len(placed) != in_dump:
        problems.append("%d note(s) dans le dump, %d placée(s) dans les pages" % (in_dump, len(placed)))
    bodies = {}
    for title, _aliases, slug, text, _tab in pages:
        bodies[slug] = bodies.get(slug, "") + "\n\n" + body_of(text)
    wanted = {}
    for n in placed:
        wanted.setdefault((normalize(n["page"]), n["page"], note_block(n["label"], n["text"])), []).append("%s %s" % (n["tab"], n["ref"]))
    for (slug, title, block), cells in sorted(wanted.items()):
        found = count_block(bodies.get(slug, ""), block)
        if found != len(cells):
            problems.append("page « %s » : note de la cellule %s attendue %d fois, trouvée %d fois" % (title, ", ".join(cells), len(cells), found))
    written = sum(body.count(NOTE_MARKER) for body in bodies.values())
    if written != in_dump:
        problems.append("%d note(s) dans le dump, %d écrite(s) dans les pages" % (in_dump, written))
    if any(LEGACY_NOTE_MARKER in body for body in bodies.values()):
        problems.append("ancien libellé « %s » encore écrit dans une page" % LEGACY_NOTE_MARKER)
    if problems:
        raise ValueError("contrôle de couverture des notes de cellule : " + " ; ".join(problems[:6]))


def build(raw_sheets):
    """Dump -> (pages, écarts de gabarit, notes placées). Lève ValueError si le dump ne se laisse pas lire sans rien perdre.
    pages : (titre, alias, slug, texte, onglet)."""
    for cfg in TABS:
        if cfg["name"] not in raw_sheets:
            raise ValueError("onglet %r absent du dump" % cfg["name"])
    check_unpublished(raw_sheets)
    report, pages, placed = [], [], []
    for cfg in TABS:
        sh = Sheet(raw_sheets[cfg["name"]])
        tab = parse_tab(sh, cfg, report)
        placed += attach_notes(tab, sh)
        pages.append((cfg["name"], [tab["banner"]], normalize(cfg["name"]), render_intro(tab), cfg["name"]))
        for block in tab["blocks"]:
            for side, card in enumerate(block["cards"]):
                aliases = ALIASES.get(card["name"], [])
                pages.append((card["name"], aliases, normalize(card["name"]), render_creature(tab, block, side), cfg["name"]))
    unused = [k for k in ALIASES if k not in {p[0] for p in pages}]
    if unused:
        raise ValueError("ALIASES contient des titres inconnus : %s" % unused)
    check_coverage(raw_sheets, pages, placed)
    return pages, report, placed


def conflicts(pages, out_root):
    """Doublons dans la famille, fichiers existants d'une autre famille, titres et alias déjà pris : liste d'écarts."""
    out_dir = os.path.join(out_root, CATEGORY)
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
    for dirpath, _, files in sorted(os.walk(out_root)):
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
    return problems


def note_count(text):
    """Nombre de notes de cellule écrites dans une page : lignes « **Note de la cellule « … »** » et, pour une page écrite avant
    l'import des notes par le dump, l'ancien libellé « **Note de cellule** » (il compte aussi : sa note doit survivre à la migration)."""
    body = body_of(text)
    return body.count(NOTE_MARKER) + body.count(LEGACY_NOTE_MARKER)


def written_notes(pages, out_root):
    """{slug: (titre, nombre de notes)} des pages de cette famille DÉJÀ écrites (et destinées à être réécrites par `pages`)."""
    out_dir = os.path.join(out_root, CATEGORY)
    found = {}
    for title, _aliases, slug, _text, _tab in pages:
        path = os.path.join(out_dir, slug + ".md")
        if is_ours(path):
            with open(path, encoding="utf-8") as fh:
                found[slug] = (title, note_count(fh.read()))
    return found


def lost_notes(pages, out_root):
    """GARDE contre un dump périmé : le script ne peut pas savoir si un dump sans note est « sans note » ou « produit avant la lecture
    des notes » (ancien xlsx_to_json.py, dump de l'API sans le champ `note`) ; il compare donc ce qu'il s'apprête à écrire à ce que
    les pages portent déjà. -> [(slug, titre, notes écrites aujourd'hui, notes que le dump produit)] pour les pages qui en perdraient."""
    before = written_notes(pages, out_root)
    lost = []
    for title, _aliases, slug, text, _tab in pages:
        if slug in before and before[slug][1] > note_count(text):
            lost.append((slug, title, before[slug][1], note_count(text)))
    return lost


def lost_report(lost, advice):
    """Lignes d'explication d'une perte de notes : un en-tête (avec `advice`) puis une ligne par page."""
    total = sum(old - new for _slug, _title, old, new in lost)
    return (["%d note(s) de cellule écrite(s) dans %d page(s) disparaîtraient : dump produit sans les notes (ancienne version de "
             "xlsx_to_json.py, dump de l'API sans le champ `note`) ? %s" % (total, len(lost), advice)] +
            ["%s/%s.md : la page « %s » porte %d note(s) de cellule, la sortie du dump en porte %d" % (CATEGORY, slug, title, old, new)
             for slug, title, old, new in lost])


# --------------------------------------------------------------------------------------------------------------------
# --verifier : contrôle indépendant, n'écrit rien
# --------------------------------------------------------------------------------------------------------------------
#
# Tout ce qui suit relit le JSON brut du dump sans passer par parse_card / attach_notes : la place de chaque note est
# recalculée d'après l'ADRESSE de sa cellule (gabarit des cartes : blocs de 29 lignes, colonnes de base D et T), la page
# la plus proche est cherchée dans le texte écrit, et rien d'autre que `labeled` / `md_text` (mise en forme) n'est partagé.

ROW_LABELS = {10: "Dégâts", 12: "Défense", 14: "Vitesse", 16: "FPVSIA", 18: "Capacité(s)"}   # décalage de ligne -> libellé
CARD_WIDTH = 13                 # une carte occupe la colonne de base et les 13 suivantes (dernière valeur : Barrière)
CONTROL_NOTE = "Note de contrôle du vérificateur : texte de rejeu."


def locate(cfg, values, r, c):
    """Place de la note de la cellule (r, c) d'après son adresse : dict(page, label, section, anchor) ou texte de la raison
    pour laquelle la page n'a pas de place. anchor : ("table",), ("ligne", libellé, valeur) ou ("texte", valeur)."""
    k, off = divmod(r - 1, BLOCK)
    if not 0 <= k < cfg["blocks"]:
        return "hors des blocs de créatures"
    r0 = 1 + BLOCK * k
    bases = (COL_LEFT, COL_RIGHT) if cfg["kind"] == "duo" else (COL_LEFT,)
    base = next((b for b in bases if 0 <= c - b <= CARD_WIDTH), None)
    if base is None:
        return "hors d'une carte de créature"
    if (r0, base) not in values:
        return "carte sans nom"
    rel, page = c - base, norm_ws(values[(r0, base)])
    if off in (8, 9):                                   # ligne des statistiques / ressource supplémentaire
        if rel % 5 not in (0, 3):
            return "colonne sans libellé ni valeur de statistique"
        head = (r, base + 5 * (rel // 5))
        if head not in values:
            return "statistique sans libellé"
        return dict(page=page, label=norm_ws(values[head]), section=SEC_STATS, anchor=("table",))
    label = ROW_LABELS.get(off)
    if label is None or rel not in (0, 3):
        return "ligne ou colonne sans libellé ni valeur"
    if norm_ws(values.get((r, base), "")) != label:
        return "libellé %r attendu" % label
    if (r, base + 3) not in values:
        return "la ligne « %s » n'a pas de valeur, la page ne la reprend pas" % label
    value = values[(r, base + 3)]
    if off == 18:
        return dict(page=page, label=label, section=SEC_CAPS, anchor=("texte", value))
    return dict(page=page, label=label, section=SEC_STATS, anchor=("ligne", label, value))


def expected_notes(raw_sheets):
    """Notes attendues, recalculées depuis le JSON brut : (liste de dict(tab, ref, text, page, label, section, anchor), écarts)."""
    expected, problems = [], []
    for cfg in TABS:
        raw = raw_sheets.get(cfg["name"])
        if raw is None:
            problems.append("onglet « %s » absent du dump" % cfg["name"])
            continue
        values = {(c["r"], c["c"]): c["v"] for c in raw["cells"] if not is_blank(c["v"])}
        for c in sorted(raw["cells"], key=lambda x: (x["r"], x["c"])):
            if is_blank(c.get("note")):
                continue
            ref = ref_of(c["r"], c["c"])
            place = locate(cfg, values, c["r"], c["c"])
            if isinstance(place, str):
                problems.append("%s : la note de la cellule %s est sans place prévue dans la page : %s" % (cfg["name"], ref, place))
                continue
            expected.append(dict(place, tab=cfg["name"], ref=ref, text=fmt(c["note"])))
    return expected, problems


def section_text(body, title):
    """Lignes de la section `## title` (jusqu'à la suivante), ou None."""
    lines = body.split("\n")
    if "## " + title not in lines:
        return None
    out = []
    for line in lines[lines.index("## " + title) + 1:]:
        if line.startswith("## "):
            break
        out.append(line)
    return "\n".join(out)


def note_problems(expected, texts):
    """Compare les notes attendues aux pages. texts : {titre: texte de la page}. -> liste d'écarts (vide si tout va bien).
    Pour chaque page : chaque note retrouvée exactement autant de fois qu'attendu, juste sous sa cellule, dans sa section ;
    aucune note de plus ; pas d'ancien libellé."""
    problems, by_page = [], {}
    for n in expected:
        by_page.setdefault(n["page"], []).append(n)
    for title, text in sorted(texts.items()):
        body = body_of(text)
        notes = by_page.get(title, [])
        written = body.count(NOTE_MARKER)
        if written != len(notes):
            problems.append("page « %s » : %d note(s) écrite(s), %d attendue(s)" % (title, written, len(notes)))
        if LEGACY_NOTE_MARKER in body:
            problems.append("page « %s » : ancien libellé « %s » encore écrit" % (title, LEGACY_NOTE_MARKER))
        blocks = {}
        for n in notes:
            blocks.setdefault(note_block(n["label"], n["text"]), []).append(n)
        for block, group in blocks.items():
            found = count_block(body, block)
            if found != len(group):
                problems.append("page « %s » : note de la cellule %s (« %s ») attendue %d fois, trouvée %d fois"
                                % (title, ", ".join("%s %s" % (n["tab"], n["ref"]) for n in group), group[0]["label"], len(group), found))
        places = {}
        for n in notes:
            places.setdefault((n["section"], n["anchor"]), []).append(n)
        for (section, anchor), group in places.items():
            wanted = "\n\n".join(note_block(n["label"], n["text"]) for n in group)
            where = section_text(body, section)
            if where is None:
                problems.append("page « %s » : section « %s » absente alors qu'elle porte une note (%s %s)"
                                % (title, section, group[0]["tab"], group[0]["ref"]))
                continue
            if anchor[0] == "table":
                pattern = r"(?m)^\|[^\n]*\|\n\n" + re.escape(wanted)
            elif anchor[0] == "ligne":
                pattern = re.escape("\n".join(labeled(anchor[1], anchor[2])) + "\n\n" + wanted)
            else:
                pattern = re.escape("\n".join(md_text(anchor[1])) + "\n\n" + wanted)
            if not re.search(pattern + r"(?=\n\n|\n*\Z)", where):
                problems.append("page « %s » : section « %s » : la note de la cellule %s (« %s ») n'est pas juste sous sa cellule"
                                % (title, section, ", ".join("%s %s" % (n["tab"], n["ref"]) for n in group), group[0]["label"]))
    return problems


def full_card(raw_sheets):
    """Première carte dont toutes les lignes sont renseignées : (onglet, ligne de base du bloc, colonne de base)."""
    for cfg in TABS:
        values = {(c["r"], c["c"]) for c in raw_sheets[cfg["name"]]["cells"] if not is_blank(c["v"])}
        for k in range(cfg["blocks"]):
            r0 = 1 + BLOCK * k
            for base in ((COL_LEFT, COL_RIGHT) if cfg["kind"] == "duo" else (COL_LEFT,)):
                need = [(r0, base), (r0 + 8, base), (r0 + 8, base + 3)]
                need += [(r0 + off, base + d) for off in ROW_LABELS for d in (0, 3)]
                if all(pos in values for pos in need):
                    return cfg, r0, base
    return None


def replay_errors(raw_sheets, out_root):
    """Rejoue des cas d'erreur sur des copies en mémoire du dump (le vrai dump et les vraies pages ne sont pas touchés).
    -> (nombre de cas rejoués, écarts)."""
    failures, count = [], 0
    first = TABS[0]["name"]

    def copy_with(edit):
        copied = copy.deepcopy(raw_sheets)
        edit(copied)
        return copied

    def cell_of(data, tab, r, c):
        return next((x for x in data[tab]["cells"] if (x["r"], x["c"]) == (r, c)), None)

    def expect_stop(label, mutated, needle):
        nonlocal count
        count += 1
        try:
            build(mutated)
        except ValueError as err:
            if needle not in str(err):
                failures.append("rejeu « %s » : message d'arrêt sans « %s » : %s" % (label, needle, str(err)[:200]))
            return
        failures.append("rejeu « %s » : le script ne s'arrête pas" % label)

    expect_stop("note sur une cellule vide", copy_with(lambda d: d[first]["cells"].append({"r": 2000, "c": 2000, "v": "", "note": CONTROL_NOTE})),
                "est vide mais porte une note")
    expect_stop("note dans un onglet non publié", copy_with(lambda d: d.update({"Onglet de contrôle": {
        "name": "Onglet de contrôle", "state": "visible", "merged": [], "cells": [{"r": 1, "c": 1, "v": "x", "note": CONTROL_NOTE}]}})),
                "ne publie pas")
    expect_stop("note non textuelle", copy_with(lambda d: cell_of(d, first, 1, COL_LEFT).update(note=5)), "pas un texte")
    expect_stop("fil de commentaires", copy_with(lambda d: cell_of(d, first, 1, COL_LEFT).update(threads=[{"text": "x"}])), "fil de commentaires")
    for label, r, c in (("nom d'une créature", 1, COL_LEFT), ("description d'une créature", 3, COL_LEFT),
                        ("bandeau de l'onglet", 1, TABS[0]["banner_col"]), ("marge d'un bloc", 1 + MARGIN_ROW, COL_MARGIN)):
        expect_stop("note non placée : %s" % label, copy_with(lambda d, r=r, c=c: cell_of(d, first, r, c).update(note=CONTROL_NOTE)),
                    "sans place prévue")

    # Dump périmé : les mêmes onglets sans aucun champ `note`. Si les pages écrites portent des notes, la garde doit les voir disparaître
    # (sans quoi le script réécrirait les pages sans la note, sans erreur) ; sans note écrite il n'y a rien à rejouer.
    stale = copy.deepcopy(raw_sheets)
    for raw in stale.values():
        for cell in raw["cells"]:
            cell.pop("note", None)
    try:
        stale_pages = build(stale)[0]
    except ValueError as err:
        count += 1
        failures.append("rejeu « dump périmé » : le dump sans notes est refusé par le script : %s" % str(err)[:200])
    else:
        carried = sum(n for _title, n in written_notes(stale_pages, out_root).values())
        if carried:
            count += 1
            seen = sum(old - new for _slug, _title, old, new in lost_notes(stale_pages, out_root))
            if seen != carried:
                failures.append("rejeu « dump périmé » : %d note(s) écrite(s) dans les pages, la garde n'en voit disparaître que %d" % (carried, seen))

    # Notes posées sur chaque sorte de cellule d'une carte complète : acceptées, retrouvées une fois, et signalées si la page les perd.
    count += 1
    card = full_card(raw_sheets)
    if card is None:
        return count, failures + ["rejeu des notes : aucune carte complète dans le dump"]
    cfg, r0, base = card
    spots = [(r0 + 8, base + 3)] + [(r0 + off, base + 3) for off in ROW_LABELS]
    noted = copy.deepcopy(raw_sheets)
    for r, c in spots:
        cell_of(noted, cfg["name"], r, c)["note"] = "%s (%s)" % (CONTROL_NOTE, ref_of(r, c))
    try:
        pages, _report, _placed = build(noted)
    except ValueError as err:
        return count, failures + ["rejeu des notes : des notes de contrôle sont refusées : %s" % str(err)[:200]]
    texts = {p[0]: p[3] for p in pages}
    expected, bad = expected_notes(noted)
    for problem in bad + note_problems(expected, texts):
        failures.append("rejeu des notes : page conforme jugée non conforme : %s" % problem)
    title = norm_ws(next(c["v"] for c in noted[cfg["name"]]["cells"] if (c["r"], c["c"]) == (r0, base)))
    text = texts[title]
    degats = "%s (%s)" % (CONTROL_NOTE, ref_of(r0 + 10, base + 3))
    block = note_block("Dégâts", degats)
    defense = "\n".join(labeled("Défense", next(c["v"] for c in noted[cfg["name"]]["cells"] if (c["r"], c["c"]) == (r0 + 12, base + 3))))
    if text.count(block + "\n\n") != 1 or text.count(defense + "\n\n") != 1:
        return count, failures + ["rejeu des notes : la note de contrôle sur les dégâts figure %d fois dans la page (1 attendue)" % text.count(block)]
    variants = {
        "note retirée": text.replace(block + "\n\n", "", 1),
        "note dupliquée": text.replace(block + "\n\n", block + "\n\n" + block + "\n\n", 1),
        "note tronquée": text.replace(degats, degats[:25], 1),
        "note altérée": text.replace(CONTROL_NOTE, CONTROL_NOTE.replace("texte de rejeu.", "texte de rejeux."), 1),
        "note déplacée sous la cellule suivante": text.replace(block + "\n\n" + defense, defense + "\n\n" + block, 1),
        "ancien libellé ajouté": text.replace(block + "\n\n", block + "\n\n" + LEGACY_NOTE_MARKER + "** : " + degats + "\n\n", 1),
        "note de plus": text.replace(defense, note_block("Vitesse", "Une note inventée.") + "\n\n" + defense, 1),
    }
    for label, variant in variants.items():
        count += 1
        if variant == text:
            failures.append("rejeu « %s » : le cas ne modifie pas la page" % label)
        elif not note_problems(expected, {**texts, title: variant}):
            failures.append("rejeu « %s » : aucun écart signalé" % label)
    return count, failures


def verify(raw_sheets, out_root):
    """--verifier : n'écrit rien. Retourne 0 et affiche un bilan, ou s'arrête avec la liste des écarts."""
    try:
        pages, _report, _placed = build(raw_sheets)
    except ValueError as err:
        sys.exit("--verifier : ERREUR : %s" % err)
    out_dir = os.path.join(out_root, CATEGORY)
    lost = lost_notes(pages, out_root)    # en tête de la liste : la cause probable avant les pages qui en découlent
    problems, texts, same = (lost_report(lost, "Relancer la conversion du classeur, puis ce script.") if lost else []), {}, 0
    for title, _aliases, slug, text, _tab in pages:
        path = os.path.join(out_dir, slug + ".md")
        if not os.path.exists(path):
            problems.append("%s : page absente (%s)" % (slug, path))
            continue
        with open(path, encoding="utf-8") as fh:
            texts[title] = fh.read()
        if texts[title] != text:
            problems.append("%s : la page écrite n'est pas celle que le dump produit (relancer le script)" % slug)
        else:
            same += 1
    expected, bad = expected_notes(raw_sheets)
    problems += bad + note_problems(expected, texts) + conflicts(pages, out_root)
    count, failures = replay_errors(raw_sheets, out_root)
    problems += failures
    if problems:
        sys.exit("--verifier : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))
    print("--verifier : %d page(s) identiques à ce que le dump produit ; %d note(s) de cellule, chacune retrouvée exactement autant de fois "
          "qu'attendu avec son texte intégral, juste sous sa cellule, aucune de plus ; %d cas d'erreur rejoués (cellule vide, onglet non "
          "publié, note non textuelle, fil de commentaires, note sans place, dump sans notes ; note retirée / dupliquée / tronquée / altérée / déplacée)"
          % (same, len(expected), count))
    for n in expected:
        print("  %s %s -> « %s », « %s »" % (n["tab"], n["ref"], n["page"], n["label"]))
    return 0


# --------------------------------------------------------------------------------------------------------------------
# Point d'entrée
# --------------------------------------------------------------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « invocations » du wiki depuis le dump de « %s »." % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py, avec les notes de cellule (répétable)")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule les notes depuis le dump, les compare aux pages écrites et rejoue des cas d'erreur")
    ap.add_argument("--accepter-notes-retirees", action="store_true",
                    help="écrit même si des pages perdent des notes de cellule (note retirée du classeur) ; sans cette option le script "
                         "refuse, car un dump produit avant la lecture des notes les effacerait en silence")
    args = ap.parse_args(argv)

    raw_sheets = read_dumps(args.dump)
    if args.verifier:
        return verify(raw_sheets, args.out)
    try:
        pages, report, placed = build(raw_sheets)
    except ValueError as err:
        sys.exit("ERREUR : %s" % err)

    for name, raw in raw_sheets.items():
        for c in raw["cells"]:
            if isinstance(c["v"], str) and "[[" in c["v"]:
                print("AVERTISSEMENT : « [[ » dans la cellule %s de l'onglet %s (échappé, pas un lien)"
                      % (ref_of(c["r"], c["c"]), name), file=sys.stderr)

    # Contrôles avant toute écriture : doublons, fichiers existants, titres et alias des autres familles.
    out_dir = os.path.join(args.out, CATEGORY)
    problems = conflicts(pages, args.out)
    lost = lost_notes(pages, args.out)
    if lost and not args.accepter_notes_retirees:
        problems += lost_report(lost, "Rien n'est écrit, pour ne pas effacer les notes ; si elles ont bien été retirées du classeur, "
                                      "relancer avec --accepter-notes-retirees.")
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1
    if lost:
        print("AVERTISSEMENT : %d note(s) de cellule retirée(s) des pages (--accepter-notes-retirees) : %s"
              % (sum(old - new for _slug, _title, old, new in lost),
                 ", ".join("%s/%s.md (%d -> %d)" % (CATEGORY, slug, old, new) for slug, _title, old, new in lost)), file=sys.stderr)
    if not any("note" in c for cfg in TABS for c in raw_sheets[cfg["name"]]["cells"]):
        print("AVERTISSEMENT : aucune cellule du dump ne porte de champ `note` : dump produit sans les notes de cellule (ancienne version "
              "de xlsx_to_json.py, dump de l'API sans le champ `note`) ? Si le classeur porte des notes, elles ne seront pas dans les "
              "pages : relancer la conversion du classeur.", file=sys.stderr)

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
    print("Notes de cellule : %d, chacune écrite sous sa cellule (contrôle de couverture passé)%s"
          % (len(placed), " :" if placed else ""))
    for n in placed:
        print("  %s %s -> « %s », « %s »" % (n["tab"], n["ref"], n["page"], n["label"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
