#!/usr/bin/env python3
"""Famille « equipement » : l'équipement du classeur « Ressources et Craft » (une page du wiki par onglet).

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/equipement.py --dump <ressources-craft.json> [--dump <autre.json>] \
        --out /home/user/MaverickCenter/client/src/content/wiki

Source : Google Sheet « Ressources et Craft » (fileId 12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA), converti en JSON par
tools/sheets/xlsx_to_json.py (format décrit dans ce script). Les cellules sont une donnée non fiable : elles ne sont jamais
exécutées, seulement copiées (échappées pour le Markdown). Rien n'est inventé : valeurs, noms, formules de règles, coquilles
et formulations sont ceux des cellules (« 100.0 » reste « 100.0 », les valeurs viennent du cache, jamais d'un recalcul).
Le script ne lit que le dump ; le dump ne contenant pas les commentaires de cellule, ceux des onglets du périmètre sont
recopiés dans la constante CELL_COMMENTS (lus dans le .xlsx d'origine) et rendus « Note de cellule : … ». Il ne contient pas
non plus les couleurs de fond ; la seule qui porte une information écrite par la source (« Les armes en bleu sont les armes
possible en arme de départ », onglet « Armes ») est recopiée dans la constante BLUE_NAME_CELLS (références des cellules de nom
d'arme à fond bleu, lues dans le .xlsx) ; les autres couleurs (catégories, grille des armures) ne sont pas reprises.

Fichiers écrits (et seulement ceux-là), un par onglet, catégorie « ressources » :
    <out>/ressources/equipement-inventaire.md   onglet « Équipement inventaire »
    <out>/ressources/armes.md                   onglet « Armes »
    <out>/ressources/armures.md                 onglet « Armures »
    <out>/ressources/bouclier.md                onglet « Bouclier »
    <out>/ressources/baton-magique.md           onglet « Bâton magique »
    <out>/ressources/livre-parchemin.md         onglet « LivreParchemin »
    <out>/ressources/accessoires.md             onglet « Accessoires »
    <out>/ressources/pieces-elementaires.md     onglet « Pièces élémentaires »
Les autres onglets du classeur (Familiers, Maison, Machine de GuerreSiège, Maladie V2, Maladie, Fiche de tour) ne sont pas lus.

Structure des onglets (les blocs sont repérés par leurs libellés et leurs colonnes ; le script s'arrête avec une erreur si
un libellé attendu manque ou si une cellule non vide n'a été reprise nulle part : rien n'est perdu en silence) :

  « Équipement inventaire » : bandeaux en ligne 1. MONNAIE (nom en A, abréviation en D ; sous-bloc CONVERTISSEUR : équivalences)
    ; PRODUITS NON MONAITAIRE (+ fréquents) en trois colonnes de listes (VEGETAUX, ANIMAUX, AUTRES : nom puis prix) ;
    MATOS AVENTURES, MATOS FABRICATION, MATOS PROJECTILE : trois tableaux Nom / Prix / Description (en-têtes ligne 3). Le
    commentaire de cellule de A1 (trois notes, dont deux sans rapport apparent avec la monnaie) est recopié sous MONNAIE.
  « Armes » : A1 = règles générales ; liste des 26 armes dont le nom est sur fond bleu (« Armes sur fond bleu dans la
    source », par bandeau, d'après BLUE_NAME_CELLS) ; MATERIAUX (O/S/W : matière, prix, effets) ; AMELIORATION (+1 à +10, coût,
    effet, TOTAL) ; « COMMENT DÉTERMINER LE PRIX DE VOTRE ARME ? » (formule en une ligne) ; puis douze bandeaux d'armes (ÉPÉES,
    DAGUES, …, ARME DE MONSTRES) à partir de la colonne AE, chacun avec ses en-têtes de ligne 2 (Nom, Coût…, Catégorie, Effet,
    Description) et une arme par couple de lignes fusionnées. Le commentaire de cellule QA6 (plage fusionnée QA5:QL6 = effet de
    « Bombe perçante ») est rattaché à la cellule « Effet » de cette arme.
  « Armures » : A1 = règles ; MATERIAUX (21 matières : prix, description, fabrication) ; FABRICATION (pièces d'armure et
    coût) ; AMELIORATION (+1 à +5) ; puis la grille matière × matière (escalier : la ligne k contient les combinaisons de la
    matière k avec les matières k à 21, une cellule de 7 lignes « nom / Prix / Type / Stats / Solidité / Résistance /
    Faiblesse » par combinaison), reproduite en LISTE (une ligne de tableau par combinaison, une section par matière en
    ligne), et cinq colonnes « (Armure particulière) » (Vêtement, Léger, Intermédiaire, Lourd, Familier).
  « Bouclier » : FABRICATION (coût, poids et Force minimum), règles (AK1), MATERIAUX (21 matières), AMELIORATION (+1 à +5, TOTAL
    = formule dont la valeur en cache est reprise), fiches de matières pour boucliers (20), cinq classes de boucliers
    (Bocle, Targe, Bouclier Rond, Écu, Pavoi), chacune avec sa ligne de 20 combinaisons (nom, prix, défense).
  « Bâton magique » : A1 = règles ; recette en une ligne ; MATERIAUX NECESSAIRE PAR MAGIE (14 magies : gemme précieuse avec
    trois prix, bois) ; bonus passifs par niveau (1 à 3) et par magie (deux séries de sept magies, reproduites en un tableau).
  « LivreParchemin » : PARCHEMIN (règles en G1, liste Nom / Prix), LIVRE (règles en AM1, deux colonnes de livres + « Livre du
    Rien »), puis le même tableau PRODUITS NON MONAITAIRE que dans « Équipement inventaire ».
  « Accessoires » : A1 = règles ; CRÉATION D'ACCESSOIRE (ÉTAPE 1 : 1d4 emplacement ; ÉTAPE 2 : 1d100 propriété ; ÉTAPE 3 : sept
    tableaux « SI … » : caractéristique, compétence, attributs, attaque, défense, jet de dés, autre ; dans les cinq derniers
    une colonne de jets d1d20 et d'effets est mise en face, ligne à ligne, d'une colonne niveau / gemmes / prix) ;
    Gemme précieuse (14 magies, trois prix par quart de gemme) ; Monture (5 niveaux). Trois commentaires de cellule (BK66,
    CI66, ED80) sont rattachés à l'effet qu'ils commentent.
  « Pièces élémentaires » : A3 = règles ; onze types d'arme × 14 éléments (cellule = nom / +8 Dégâts / Élément / capacité,
    quatre lignes) ; AMELIORATION (armes +1 à +10, armures +5 ; les « TOTAL » sont repris tels quels, celui des armures n'a pas
    de valeur dans la source) ; quatre blocs d'équipement (VETEMENT, ARMURE LÉGERE, INTERMEDIAIRE, LOURDE) × 14 éléments
    (nom, AP, AM, effets). Trois commentaires de cellule (CW8, X29, CI64) sont rattachés à la capacité commentée.

Conventions de rendu : valeurs en cache, mot pour mot ; espaces de début et de fin de ligne retirés ; retour à la ligne d'une
cellule de tableau -> « <br> » ; « | » -> « \\| » ; « * », « _ », « [ », « ] », « ` » échappés ; un lien nu devient « <lien> » ;
aucun lien [[…]] n'est écrit (le script refuse une cellule qui en contient). Une cellule vide reste vide. Les cellules de
décor (espaces seuls : X20 de « Équipement inventaire », BI49 d'« Armures », ES20 et AH30 de « LivreParchemin », BN100 d'
« Accessoires ») sont ignorées. Un texte de règles est repris tel quel, paragraphe par paragraphe (les lignes « - … » en liste).

Libellés ajoutés (la source n'écrit pas d'en-tête ; ils sont repérés par « libellé ajouté » en commentaire du code) :
colonnes « Niveau » (valeurs +1, +2… des tableaux AMELIORATION), « Magie » (noms de magies sans en-tête), « Nom » / « Prix »
(listes de produits, de parchemins et de livres), « Caractéristique », « Compétence », « Gemmes », « Jet », « Effet », « Niveau »
(tableaux de l'ÉTAPE 3 des accessoires), « Niveau », « Matière », « Prix », « Effet » (Monture), « Ligne » / « Colonne » (grille des
armures), « Colonne », « Dégâts », « Élément », « Capacité » (la cellule de quatre lignes des pièces élémentaires est découpée
ligne à ligne : nom / +8 Dégâts / Élément / capacité), « Colonne » (vêtement et armures élémentaires). Titres ajoutés pour des
blocs sans bandeau : « Fiches des matières de la grille », « Armures par combinaison de matières », « Armures particulières »,
« Fiches des matières pour boucliers », « Classes de boucliers », « Boucliers par classe et par matière », « Bonus passifs »,
« Armes élémentaires », « Vêtement et armures élémentaires », « Armes sur fond bleu dans la source », « Commentaires de
cellule ». Les seules phrases ajoutées sont
des remarques de mise en page ou d'écart (« Note de mise en page : … », « Écart dans la source : … », « Libellé répété à droite
du tableau : … ») ; elles ne contiennent aucune règle.

Ne touche qu'aux fichiers de sa famille : il refuse d'écraser un fichier qui n'est pas issu de ces onglets, refuse un titre déjà
pris par une autre page, et n'efface rien.
"""
import argparse
import json
import os
import re
import sys
import unicodedata

WORKBOOK = "Ressources et Craft"
FILE_ID = "12UBFKzQVWK8zPROqk9GdDq-yIE8EOf6NakU7BQI70PA"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID
CATEGORY = "ressources"

# Commentaires de cellule : le dump ne les contient pas ; recopiés (mot pour mot) depuis le .xlsx d'origine
# (commentaires hérités + fils de commentaires). {onglet: {cellule: [textes]}}.
CELL_COMMENTS = {
    "Équipement inventaire": {
        "A1": [
            "L'insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. "
            "Prendre un coup physique annule cet état.",
            "Un téléphone quoi",
            "1 fois par combat",
        ],
    },
    "Armes": {
        "QA6": [
            "Il faut perdre un bras pour avoir cette arme, ce qui fait que vous perdez une main. "
            "Ce n'est pas considérer comme un Canon d'artifice.",
        ],
    },
    "Accessoires": {
        "BK66": [
            "Il existe une situation où le changement de posture n'est pas possible, c'est dans le cas où le personnage "
            "décide de passer en focus pour utiliser un sort niveau 5 pour après espérer un changement de posture. "
            "Si un sort de niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour.",
        ],
        "CI66": [
            "L'insensibilité est un état où AUCUN sortilèges (positif ou négatif) ne peux toucher le lanceur. "
            "Prendre un coup physique annule cet état.",
        ],
        "ED80": [
            "Agib est l'ambassadeur de la richesse et Murge son gardien. "
            "Ce sont des marchands qui ont beaucoup de marchandises.",
        ],
    },
    "Pièces élémentaires": {
        "CI64": [
            "*\nSi le carreau touche à 2 - 4 portée = Surdité 1\n\nSi le carreau touche à 5 - 7 portée = Surdité 2\n\n"
            "Si le carreau touche à 8 - 10 portée = Surdité 3",
        ],
        "X29": ["Bras = Perd son arme ou bouclier\nJambe = Ne peux plus bouger"],
        "CW8": [
            "Métal : Plus solide, elle ne peut pas perdre de cran de solidité\n\nPierre : Ignore 5 AP\n\n"
            "Plante : Ignore 50% des AP des boucliers",
        ],
    },
}

# Cellules de nom d'arme (onglet « Armes ») dont le fond est bleu dans le .xlsx d'origine (remplissage FFC9DAF8 ou FFCFE2F3) :
# le dump ne contient pas les couleurs, la règle de A1 (« Les armes en bleu sont les armes possible en arme de départ »)
# n'est applicable que si ces cellules sont recopiées. Seules les références sont ici ; les noms sont lus dans le dump.
BLUE_NAME_CELLS = {
    "Armes": (
        "AE3", "AE5", "AE19", "AE21",
        "BS3", "BS15",
        "DG3", "DG21", "DG23", "DG27",
        "EU3", "EU25",
        "GI3", "GI21",
        "HW3", "HW5",
        "JK3", "JK17",
        "KY5", "KY11",
        "MM3", "MM11",
        "OA3",
        "PO3", "PO5", "PO7",
    ),
}


# --------------------------------------------------------------------------------------------------------------------
# Utilitaires de cellules
# --------------------------------------------------------------------------------------------------------------------

def col_letters(n):
    out = ""
    while n:
        n, m = divmod(n - 1, 26)
        out = chr(65 + m) + out
    return out


def C(letters):
    """Numéro de colonne (à partir de 1) d'une référence en lettres."""
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def ref_of(r, c):
    return "%s%d" % (col_letters(c), r)


def split_ref(ref):
    """« AE3 » -> (3, 31) : (ligne, colonne)."""
    return int(re.sub(r"\D", "", ref)), C(re.sub(r"\d", "", ref))


def parse_range(rng):
    m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", rng)
    if not m:
        raise ValueError("plage fusionnée invalide : %r" % rng)
    return int(m.group(2)), C(m.group(1)), int(m.group(4)), C(m.group(3))


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


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.max_row = raw["max_row"]
        self.cells = {}   # (ligne, colonne) -> valeur, cellules non vides
        self.decor = {}   # cellules ne contenant que des espaces : ignorées
        for c in raw["cells"]:
            key = (c["r"], c["c"])
            if is_blank(c["v"]):
                if c["v"] is not None:
                    self.decor[key] = c["v"]
            else:
                if isinstance(c["v"], str) and "[[" in c["v"]:
                    raise ValueError("%s!%s : la cellule contient « [[ » (lien de wiki) : %r" % (
                        self.name, ref_of(*key), c["v"]))
                self.cells[key] = c["v"]
        self.merges = {}  # (ligne, colonne) en haut à gauche -> (ligne, colonne) en bas à droite
        for rng in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(rng)
            self.merges[(r1, c1)] = (r2, c2)
        self.consumed = set()
        self.notes = {ref: list(texts) for ref, texts in CELL_COMMENTS.get(self.name, {}).items()}

    def get(self, r, c):
        """Lit une cellule (None si vide) sans la marquer comme reprise."""
        return self.cells.get((r, c))

    def take(self, r, c):
        """Lit une cellule (None si vide) et la marque comme reprise."""
        v = self.cells.get((r, c))
        if v is not None:
            self.consumed.add((r, c))
        return v

    def txt(self, r, c):
        v = self.take(r, c)
        return "" if v is None else fmt(v)

    def expect(self, r, c, text):
        """Lit une cellule dont le libellé est connu ; erreur si elle diffère."""
        v = self.take(r, c)
        if v is None or fold(fmt(v)) != fold(text):
            raise ValueError("%s!%s : %r attendu, trouvé %r" % (self.name, ref_of(r, c), text, v))
        return fmt(v)

    def rows(self, col, r1, r2):
        return [r for r in range(r1, r2 + 1) if (r, col) in self.cells]

    def cols(self, row, c1, c2):
        return [c for c in range(c1, c2 + 1) if (row, c) in self.cells]

    def pop_notes(self, r, c):
        return self.notes.pop(ref_of(r, c), [])

    def pop_merged_notes(self, r, c):
        """Commentaires de la cellule (r, c) et de toute cellule de sa plage fusionnée : un commentaire posé sur une cellule
        fusionnée qui n'est pas celle en haut à gauche (ex. QA6 dans QA5:QL6) appartient à la plage, donc à sa valeur."""
        r2, c2 = self.merges.get((r, c), (r, c))
        out = []
        for ref in sorted(self.notes, key=lambda x: (split_ref(x)[0], split_ref(x)[1])):
            rr, cc = split_ref(ref)
            if r <= rr <= r2 and c <= cc <= c2:
                out += self.notes.pop(ref)
        return out

    def leftovers(self):
        return sorted(set(self.cells) - self.consumed, key=lambda k: (k[1], k[0]))


# --------------------------------------------------------------------------------------------------------------------
# Échappement Markdown
# --------------------------------------------------------------------------------------------------------------------

URL_RE = re.compile(r"https?://[^\s<>]+")


class MD(str):
    """Texte déjà rendu en Markdown (non échappé une seconde fois)."""


def _esc_chunk(s):
    s = s.replace("\\", "\\\\")
    s = re.sub(r"([`*_\[\]<~])", r"\\\1", s)
    s = re.sub(r"&(?=#?\w+;)", r"\\&", s)
    return s


def esc_text(s):
    """Échappe un texte en ligne ; les adresses web restent intactes."""
    out, pos = [], 0
    for m in URL_RE.finditer(s):
        out.append(_esc_chunk(s[pos:m.start()]))
        out.append(m.group(0))
        pos = m.end()
    out.append(_esc_chunk(s[pos:]))
    return "".join(out)


def esc_line(s):
    """Texte d'un paragraphe, d'un élément de liste ou d'un titre : ne doit pas devenir un titre, une citation, une liste."""
    line = esc_text(s)
    line = re.sub(r"^(\s*)>", r"\1\\>", line)
    line = re.sub(r"^(\s*)(#{1,6})(?=\s|$)", r"\1\\\2", line)
    line = re.sub(r"^(\s*)([-+])(?=\s|$)", r"\1\\\2", line)
    line = re.sub(r"^(\s*)(\d+)([.)])(?=\s|$)", r"\1\2\\\3", line)
    return line


def cell_md(value):
    """Cellule de tableau : retours à la ligne -> <br>, « | » échappé, lien nu -> <lien>."""
    if isinstance(value, MD):
        return str(value)
    if value is None:
        return ""
    text = fmt(value)
    if re.fullmatch(r"https?://\S+", text):
        return "<%s>" % text
    lines = [esc_text(l.strip()) for l in text.split("\n")]
    return "<br>".join(lines).replace("|", "\\|")


def inline_md(value):
    """Valeur multi-lignes sur une seule ligne (les retours à la ligne deviennent des espaces)."""
    text = " ".join(l.strip() for l in fmt(value).split("\n") if l.strip())
    return esc_line(text)


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
                out.append(esc_line(line) + ("  " if i < len(content) - 1 else ""))
        else:
            for item in content:
                out.append("- " + esc_line(item))
    return out


def md_table(headers, rows):
    out = ["| " + " | ".join(cell_md(h) for h in headers) + " |",
           "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        if len(row) != len(headers):
            raise ValueError("ligne de tableau de %d cellules pour %d en-têtes : %r" % (len(row), len(headers), row))
        out.append("| " + " | ".join(cell_md(v) for v in row) + " |")
    return out


def with_notes(value, notes):
    """Valeur de cellule suivie de ses commentaires (« Note de cellule : … »)."""
    text = cell_md(value)
    for note in notes:
        text += ("<br><br>" if text else "") + "Note de cellule : " + cell_md(note)
    return MD(text)


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


def first_sentence(text):
    para = fmt(text).split("\n")[0].strip()
    m = re.match(r"(.+?[.!?])(?=\s|$)", para)
    return m.group(1) if m else para


# --------------------------------------------------------------------------------------------------------------------
# Page
# --------------------------------------------------------------------------------------------------------------------

class Page:
    def __init__(self, sh, slug, title, tags, aliases=()):
        self.sh = sh
        self.slug = slug
        self.title = title
        self.tags = list(tags)
        self.aliases = list(aliases)
        self.summary = None
        self.body = []

    def heading(self, level, value, notes=()):
        """Titre dont le texte est la première ligne de la cellule ; les lignes suivantes forment un paragraphe."""
        lines = [l.strip() for l in fmt(value).split("\n")]
        self.body += ["#" * level + " " + esc_line(lines[0]), ""]
        rest = "\n".join(lines[1:]).strip()
        if rest:
            self.body += md_text(rest) + [""]
        for note in notes:
            self.body += ["Note de cellule : " + inline_md(note), ""]

    def text(self, value):
        self.body += md_text(value) + [""]

    def line(self, value):
        """Une ligne de texte brut (échappée)."""
        self.body += [esc_line(value), ""]

    def raw(self, md):
        self.body += [md, ""]

    def bullets(self, items):
        self.body += ["- " + esc_line(i) if not isinstance(i, MD) else "- " + str(i) for i in items] + [""]

    def table(self, headers, rows):
        self.body += md_table(headers, rows) + [""]

    def render(self):
        lines = ["---",
                 "title: " + yaml_str(self.title),
                 "aliases: " + yaml_list(self.aliases),
                 "tags: " + yaml_list(self.tags)]
        if self.summary:
            lines.append("summary: " + yaml_str(self.summary))
        lines += ["sources: " + yaml_list(["Google Sheet « %s », onglet « %s »" % (WORKBOOK, self.sh.name), URL]),
                  "status: draft", "---", ""]
        body = list(self.body)
        while body and body[-1] == "":
            body.pop()
        return "\n".join(lines + body) + "\n"


def read_table(sh, header_row, cols, first, last, required=0, note_cols=()):
    """En-têtes (ligne `header_row`, ou liste donnée) et lignes de données ; une ligne doit avoir sa cellule `required`.

    `note_cols` : colonnes dont la cellule reçoit, s'il y en a, les commentaires de cellule de sa plage fusionnée
    (rendus « Note de cellule : … » dans la cellule du tableau)."""
    if isinstance(header_row, (list, tuple)):
        headers = list(header_row)
    else:
        headers = [sh.txt(header_row, c) for c in cols]
    rows = []
    for r in range(first, last + 1):
        vals = [sh.take(r, c) for c in cols]
        if all(v is None for v in vals):
            continue
        if vals[required] is None:
            raise ValueError("%s : ligne %d sans %s : %r" % (sh.name, r, ref_of(r, cols[required]), vals))
        for i, c in enumerate(cols):
            if c in note_cols:
                notes = sh.pop_merged_notes(r, c)
                if notes:
                    vals[i] = with_notes(vals[i], notes)
        rows.append(vals)
    return headers, rows


def pairs(sh, col_a, col_b, first, last):
    """Couples (cellule en col_a, cellule en col_b) sur les lignes où col_a est remplie."""
    out = []
    for r in sh.rows(col_a, first, last):
        out.append((sh.take(r, col_a), sh.take(r, col_b)))
    return out


def pair_lines(items):
    """Couples (nom, valeur) -> « nom : valeur » (un côté vide reste vide)."""
    return [(fmt(a) if a is not None else "") + " : " + (fmt(b) if b is not None else "") for a, b in items]


def parse_card(value, labels):
    """« Nom\\nÉtiquette : valeur\\n… » -> (nom, [valeurs dans l'ordre des étiquettes attendues]).

    Les étiquettes doivent être exactement celles de `labels`, dans l'ordre ; une valeur vide reste vide."""
    lines = [l.strip() for l in fmt(value).split("\n")]
    name, fields = lines[0], lines[1:]
    if len(fields) != len(labels):
        raise ValueError("fiche %r : %d lignes d'étiquettes pour %d attendues %r" % (value, len(fields), len(labels), labels))
    values = []
    for line, label in zip(fields, labels):
        m = re.match(r"^(.+?)\s*:\s*(.*)$", line)
        if not m or fold(m.group(1)) != fold(label):
            raise ValueError("fiche %r : « %s : » attendu, trouvé %r" % (value, label, line))
        values.append(m.group(2))
    return name, values


def set_summary(page, text):
    s = first_sentence(text)
    if fold(s) not in fold(fmt(text)):
        raise ValueError("résumé introuvable dans la source : %r" % s)
    page.summary = s


def comments_section(page):
    """Commentaires de cellule restants (cellule non reprise ailleurs) : en fin de page."""
    sh = page.sh
    if not sh.notes:
        return
    page.heading(2, "Commentaires de cellule")
    for ref in sorted(sh.notes, key=lambda x: (int(re.sub(r"\D", "", x)), C(re.sub(r"\d", "", x)))):
        r, c = int(re.sub(r"\D", "", ref)), C(re.sub(r"\d", "", ref))
        where = ""
        for (r1, c1), (r2, c2) in sh.merges.items():
            if r1 <= r <= r2 and c1 <= c <= c2 and (r, c) != (r1, c1):
                where = " (cellule de la plage fusionnée %s:%s)" % (ref_of(r1, c1), ref_of(r2, c2))
        for note in sh.notes[ref]:
            page.text("Cellule %s%s : %s" % (ref, where, fmt(note)))
    sh.notes.clear()


def finish(page):
    sh = page.sh
    comments_section(page)
    left = sh.leftovers()
    if left:
        raise ValueError("%s : %d cellule(s) non reprise(s), par exemple %s" % (
            sh.name, len(left), ", ".join("%s=%r" % (ref_of(r, c), sh.cells[(r, c)]) for r, c in left[:8])))
    return page


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Équipement inventaire »
# --------------------------------------------------------------------------------------------------------------------

def products_section(page, sh, banner_row, banner_col, level):
    """Tableau « PRODUITS NON MONAITAIRE (+ fréquents) » : trois listes nom / prix (VEGETAUX, ANIMAUX, AUTRES).

    Les listes n'ont pas d'en-têtes dans la source (libellés ajoutés : « Nom », « Prix », comme dans les autres tableaux
    de l'onglet)."""
    page.heading(level, sh.take(banner_row, banner_col))
    first = banner_row + 2
    for name_col, price_col in ((banner_col, banner_col + 3), (banner_col + 6, banner_col + 9), (banner_col + 12, banner_col + 15)):
        page.heading(level + 1, sh.take(first, name_col))
        rows = [[a, b] for a, b in pairs(sh, name_col, price_col, first + 1, first + 40)]
        page.table(["Nom", "Prix"], rows)


def build_inventaire(sh):
    page = Page(sh, "equipement-inventaire", "Équipement inventaire", ["équipement", "inventaire", "monnaie"])
    # MONNAIE
    notes = sh.pop_notes(1, 1)
    page.heading(2, sh.expect(1, 1, "MONNAIE"), notes)
    page.bullets(pair_lines(pairs(sh, C("A"), C("D"), 3, 8)))
    page.heading(3, sh.expect(10, 1, "CONVERTISSEUR"))
    page.bullets(pair_lines(pairs(sh, C("A"), C("D"), 12, 20)))
    # PRODUITS NON MONAITAIRE
    assert fold(sh.get(1, C("H"))) == fold("PRODUITS NON MONAITAIRE (+ fréquents)")
    products_section(page, sh, 1, C("H"), 2)
    # trois tableaux de matériel
    for banner, cols in (("MATOS AVENTURES", ("AB", "AE", "AH")),
                         ("MATOS FABRICATION", ("AU", "AX", "BA")),
                         ("MATOS PROJECTILE", ("BN", "BQ", "BT"))):
        page.heading(2, sh.expect(1, C(cols[0]), banner))
        headers, rows = read_table(sh, 3, [C(c) for c in cols], 4, sh.max_row)
        page.table(headers, rows)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Armes »
# --------------------------------------------------------------------------------------------------------------------

def build_armes(sh):
    page = Page(sh, "armes", "Armes", ["armes", "matériaux", "forgeron"])
    rules = sh.take(1, 1)
    set_summary(page, rules)
    page.text(rules)

    banners = sh.cols(1, C("AE"), 600)
    if len(banners) != 12:
        raise ValueError("Armes : 12 bandeaux d'armes attendus, %d trouvés" % len(banners))

    # armes dont le nom est sur fond bleu dans la source (la couleur n'est pas dans le dump : constante BLUE_NAME_CELLS)
    blue = {}
    for ref in BLUE_NAME_CELLS["Armes"]:
        r, c = split_ref(ref)
        name = sh.get(r, c)
        lo = max((b for b in banners if b <= c), default=None)  # bandeau (et colonne des noms) de la cellule
        if name is None or lo != c:
            raise ValueError("Armes : nom d'arme à fond bleu introuvable en %s : %r" % (ref, name))
        blue.setdefault(lo, []).append((r, name))
    if blue:
        page.heading(2, "Armes sur fond bleu dans la source")  # (titre ajouté)
        page.line("Note de mise en page : la règle ci-dessus (« Les armes en bleu sont les armes possible en arme de départ ») "
                  "repose sur la couleur de fond du nom des armes dans la source. La couleur n'est pas reprise dans les tableaux "
                  "ci-dessous ; les armes dont le nom est sur fond bleu dans la source sont, par bandeau :")
        items = []
        for lo in sorted(blue):
            names = [" ".join(l.strip() for l in fmt(n).split("\n") if l.strip()) for _, n in sorted(blue[lo])]
            items.append("Sous « %s » : %s" % (" ".join(l.strip() for l in fmt(sh.get(1, lo)).split("\n") if l.strip()),
                                               ", ".join(names)))
        page.bullets(items)

    page.heading(2, sh.expect(1, C("O"), "MATERIAUX"))
    headers, rows = read_table(sh, 2, [C("O"), C("S"), C("W")], 3, 31)
    page.table(headers, rows)

    page.heading(2, sh.take(32, C("O")))  # « AMELIORATION » (précédé d'une espace dans la source)
    page.heading(3, sh.expect(33, C("P"), "Armes"))
    headers = [sh.txt(34, C("P")), sh.txt(34, C("T"))]
    rows = []
    for r in range(35, 54):
        lvl = sh.take(r, C("O"))
        if lvl is None:
            if any((r, c) in sh.cells for c in (C("P"), C("T"))):
                raise ValueError("Armes : ligne d'amélioration %d sans niveau" % r)
            continue
        rows.append([lvl, sh.take(r, C("P")), sh.take(r, C("T"))])
    page.table(["Niveau"] + headers, rows)  # (libellé ajouté : « Niveau »)
    total_label = sh.expect(55, C("P"), "TOTAL")
    page.raw("**%s** : %s" % (esc_text(total_label), cell_md(sh.take(55, C("T")))))

    page.heading(2, sh.expect(61, 1, "COMMENT DÉTERMINER LE PRIX DE VOTRE ARME ?"))
    formula = [sh.txt(63, c) for c in (C("A"), C("E"), C("G"), C("K"), C("M"), C("Q"), C("S"))]
    page.line(" ".join(formula))

    # bandeaux d'armes (`banners` : colonnes des bandeaux, lues plus haut)
    bounds = banners + [10 ** 6]
    for i, lo in enumerate(banners):
        hi = bounds[i + 1] - 1
        page.heading(2, sh.take(1, lo))
        cols = sh.cols(2, lo, hi)
        if len(cols) != 5:
            raise ValueError("Armes : 5 en-têtes attendus sous %s, %d trouvés" % (ref_of(1, lo), len(cols)))
        # le commentaire d'une cellule de la plage fusionnée d'un effet (QA6 dans QA5:QL6) est rattaché à cet effet
        effet_cols = [c for c in cols if fold(sh.get(2, c)) == "effet"]
        headers, rows = read_table(sh, 2, cols, 3, sh.max_row, note_cols=effet_cols)
        # une cellule hors des colonnes d'en-tête dans la zone du bandeau serait signalée par finish()
        page.table(headers, rows)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Armures »
# --------------------------------------------------------------------------------------------------------------------

CARD_LABELS_ARMURE = ("Prix", "Type", "Stats", "Solidité")
COMBO_LABELS = ("Prix", "Type", "Stats", "Solidité", "Résistance", "Faiblesse")
SPECIAL_LABELS = ("Prix", "Type", "Stats", "Solidité uni", "Effet")


def build_armures(sh):
    page = Page(sh, "armures", "Armures", ["armures", "matériaux", "fabrication"])
    rules = sh.take(1, 1)
    set_summary(page, rules)
    page.text(rules)

    page.heading(2, sh.expect(26, 1, "MATERIAUX"))
    headers, rows = read_table(sh, 27, [C("A"), C("E"), C("I"), C("Q")], 28, 69)
    page.table(headers, rows)

    page.heading(2, sh.expect(26, C("AA"), "FABRICATION"))
    headers, rows = read_table(sh, 27, [C("AA"), C("AE")], 28, 43)
    page.table(headers, rows)

    page.heading(2, sh.expect(71, 1, "AMELIORATION"))
    page.heading(3, sh.take(72, C("B")))
    sh.expect(73, C("B"), "Coût(RO)")
    sh.expect(73, C("F"), "Effet")
    rows = []
    for r in range(74, 83):
        lvl = sh.take(r, 1)
        if lvl is None:
            continue
        rows.append([lvl, sh.take(r, C("B")), sh.take(r, C("F"))])
    page.table(["Niveau", "Coût(RO)", "Effet"], rows)  # (libellé ajouté : « Niveau »)
    label = sh.expect(84, C("B"), "TOTAL")
    page.raw("**%s** : %s" % (esc_text(label), cell_md(sh.take(84, C("F")))))

    # grille matière x matière
    n = 21
    r0, step = 8, 7
    label_col0, head_col0 = C("AB"), C("AI")
    head = []  # cartes d'en-tête de colonne (ligne 1)
    for j in range(n):
        head.append(parse_card(sh.take(1, head_col0 + step * j), CARD_LABELS_ARMURE))
    page.heading(2, "Fiches des matières de la grille")
    page.table(["Matière"] + list(CARD_LABELS_ARMURE), [[name] + vals for name, vals in head])
    row_cards = []
    for k in range(n):
        raw_card = sh.get(r0 + step * k, label_col0 + step * k)
        card = parse_card(sh.take(r0 + step * k, label_col0 + step * k), CARD_LABELS_ARMURE)
        row_cards.append(card)
        if card != head[k]:
            page.line("Écart dans la source : la fiche en tête de ligne pour « %s » (cellule %s) diffère de la fiche en tête de "
                      "colonne (cellule %s). Fiche en tête de ligne : %s." % (
                          card[0], ref_of(r0 + step * k, label_col0 + step * k), ref_of(1, head_col0 + step * k),
                          " ; ".join(l.strip() for l in fmt(raw_card).split("\n"))))
    legend = [sh.txt(r, label_col0) for r in (17, 19, 21)]
    page.heading(2, "Armures par combinaison de matières")
    page.line("Note de mise en page : la source présente cette liste sous forme de grille (« Ligne » : matière en tête de ligne ; "
              "« Colonne » : matière en tête de colonne) ; chaque cellule de la grille est reproduite ici en une ligne. "
              "Légende de couleurs de la grille (sans les couleurs) : %s." % ", ".join(legend))
    count = 0
    for k in range(n):
        page.heading(3, "Ligne : " + row_cards[k][0])
        rows = []
        for j in range(k, n):
            value = sh.take(r0 + step * k, head_col0 + step * j)
            if value is None:
                raise ValueError("Armures : combinaison manquante en %s" % ref_of(r0 + step * k, head_col0 + step * j))
            name, vals = parse_card(value, COMBO_LABELS)
            rows.append([row_cards[k][0], head[j][0], name] + vals)
            count += 1
        page.table(["Ligne", "Colonne", "Nom"] + list(COMBO_LABELS), rows)
    # armures particulières
    page.heading(2, "Armures particulières")
    rows = []
    for col in (C("GA"), C("GH"), C("GO"), C("GV"), C("HC")):
        header = sh.take(1, col)
        if not fmt(header).startswith("(Armure particulière)"):
            raise ValueError("Armures : en-tête d'armure particulière attendu en %s" % ref_of(1, col))
        for r in sh.rows(col, 8, sh.max_row):
            name, vals = parse_card(sh.take(r, col), SPECIAL_LABELS)
            rows.append([header, name] + vals)
            count += 1
    page.table(["Colonne", "Nom"] + list(SPECIAL_LABELS), rows)
    page.combinations = count
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Bouclier »
# --------------------------------------------------------------------------------------------------------------------

def build_bouclier(sh):
    page = Page(sh, "bouclier", "Bouclier", ["bouclier", "matériaux", "fabrication"])
    rules = sh.take(1, C("AK"))
    set_summary(page, rules)
    page.text(rules)

    page.heading(2, sh.expect(1, C("B"), "FABRICATION"))
    headers, rows = read_table(sh, 2, [C("B"), C("F")], 3, 8)
    page.table(headers, rows)
    a_refaire = sh.take(10, C("B"))
    if a_refaire is not None:
        page.text(a_refaire)
    page.bullets(pair_lines(pairs(sh, C("B"), C("E"), 35, 41)))

    page.heading(2, sh.expect(1, C("K"), "MATERIAUX"))
    headers, rows = read_table(sh, 2, [C("K"), C("O"), C("S"), C("AA")], 3, 44)
    page.table(headers, rows)

    page.heading(2, sh.expect(1, C("BI"), "AMELIORATION"))
    page.heading(3, sh.expect(2, C("BJ"), "Bouclier"))
    sh.expect(3, C("BJ"), "Coût(RO)")
    sh.expect(3, C("BN"), "Effet")
    rows = []
    for r in range(4, 13):
        lvl = sh.take(r, C("BI"))
        if lvl is None:
            continue
        rows.append([lvl, sh.take(r, C("BJ")), sh.take(r, C("BN"))])
    page.table(["Niveau", "Coût(RO)", "Effet"], rows)  # (libellé ajouté : « Niveau »)
    label = sh.expect(14, C("BJ"), "TOTAL")
    page.raw("**%s** : %s" % (esc_text(label), cell_md(sh.take(14, C("BN")))))

    # fiches de matières pour boucliers (ligne 46) puis classes
    cols = list(range(C("H"), C("EK") + 1, 7))
    if len(cols) != 20:
        raise ValueError("Bouclier : 20 colonnes de matières attendues")
    labels_mat = ("Prix", "Stats", "Solidité")
    cards = [parse_card(sh.take(46, c), labels_mat) for c in cols]
    page.heading(2, "Fiches des matières pour boucliers")
    page.table(["Matière"] + list(labels_mat), [[n] + v for n, v in cards])

    class_rows = (53, 60, 67, 74, 81)
    labels_class = ("Prix", "Catégorie")
    classes = [parse_card(sh.take(r, 1), labels_class) for r in class_rows]
    page.heading(2, "Classes de boucliers")
    page.table(["Nom"] + list(labels_class), [[n] + v for n, v in classes])
    count = 0
    page.heading(2, "Boucliers par classe et par matière")
    for r, (cname, _) in zip(class_rows, classes):
        page.heading(3, cname)
        rows = []
        for c, (mat, _) in zip(cols, cards):
            name, vals = parse_card(sh.take(r, c), ("Prix", "Défense"))
            rows.append([mat, name] + vals)
            count += 1
        page.table(["Matière", "Nom", "Prix", "Défense"], rows)
    page.combinations = count
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Bâton magique »
# --------------------------------------------------------------------------------------------------------------------

def build_baton(sh):
    page = Page(sh, "baton-magique", "Bâton magique", ["bâton magique", "gemme", "bois"])
    rules = sh.take(1, 1)
    set_summary(page, rules)
    page.text(rules)

    page.heading(2, sh.expect(10, C("C"), "COMMENT FABRIQUER UN BATON MAGIQUE ?"))
    page.line(" ".join(sh.txt(12, C(c)) for c in ("C", "G", "I", "M", "O", "S", "U")))

    page.heading(2, sh.expect(1, C("AF"), "MATERIAUX NECESSAIRE PAR MAGIE"))
    g1, g2 = sh.expect(2, C("AF"), "Gemme précieuse"), sh.expect(2, C("BD"), "Bois")
    gem_cols = (C("AF"), C("AJ"), C("AR"), C("AV"), C("AZ"))
    wood_cols = (C("BD"), C("BH"), C("BP"))
    headers = ["Magie"]  # (libellé ajouté : « Magie »)
    headers += ["%s : %s" % (g1, sh.txt(3, c)) for c in gem_cols]
    headers += ["%s : %s" % (g2, sh.txt(3, c)) for c in wood_cols]
    rows = []
    for r in sh.rows(C("AC"), 4, 31):
        rows.append([sh.take(r, C("AC"))] + [sh.take(r, c) for c in gem_cols + wood_cols])
    page.table(headers, rows)

    page.heading(2, "Bonus passifs")  # (titre ajouté : le tableau n'a pas de bandeau dans la source)
    level_rows = ((17, 21, 25), (31, 35, 39))
    magie_rows = (15, 29)
    magie_cols = [C(c) for c in ("D", "G", "J", "M", "P", "S", "V")]
    level_headers = None
    rows = []
    for mr, lrs in zip(magie_rows, level_rows):
        labels = [sh.txt(r, 1) for r in lrs]
        if level_headers is None:
            level_headers = labels
        elif labels != level_headers:
            raise ValueError("Bâton magique : libellés de niveau différents entre les deux séries de magies")
        for c in magie_cols:
            rows.append([sh.take(mr, c)] + [sh.take(r, c) for r in lrs])
    page.table(["Magie"] + level_headers, rows)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « LivreParchemin »
# --------------------------------------------------------------------------------------------------------------------

def build_livre_parchemin(sh):
    page = Page(sh, "livre-parchemin", "LivreParchemin", ["livre", "parchemin"])
    parchemin_rules = sh.take(1, C("G"))
    set_summary(page, parchemin_rules)

    page.heading(2, sh.expect(1, 1, "PARCHEMIN"))
    page.text(parchemin_rules)
    page.table(["Nom", "Prix"], [[a, b] for a, b in pairs(sh, 1, C("E"), 4, 40)])

    page.heading(2, sh.expect(1, C("AA"), "LIVRE"))
    page.text(sh.take(1, C("AM")))
    rows = []
    for col_name, col_price in ((C("AA"), C("AE")), (C("AG"), C("AK"))):
        rows += [[a, b] for a, b in pairs(sh, col_name, col_price, 4, 40)]
    rows += [[a, b] for a, b in pairs(sh, C("AD"), C("AH"), 4, 40)]
    page.table(["Nom", "Prix"], rows)

    products_section(page, sh, 1, C("EC"), 2)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Accessoires »
# --------------------------------------------------------------------------------------------------------------------

EFFECT_GROUPS = (  # (en-tête de la ligne 39, colonne du jet, colonne de l'effet, niveau, gemmes, prix)
    ("AQ", "AK", "AM", "AV", "AY", "BC"),
    ("BO", "BI", "BK", "BT", "BW", "CA"),
    ("CM", "CG", "CI", "CR", "CU", "CY"),
    ("DJ", "DD", "DF", "DO", "DR", "DV"),
    ("EH", "EB", "ED", "EM", "EP", "ET"),
)


def build_accessoires(sh):
    page = Page(sh, "accessoires", "Accessoires", ["accessoires", "gemme", "monture", "malédiction"])
    rules = sh.take(1, 1)
    set_summary(page, rules)
    page.text(rules)

    page.heading(2, sh.expect(1, C("AA"), "CRÉATION D'ACCESSOIRE"))
    page.heading(3, sh.expect(6, C("AF"), "ÉTAPE 1"))
    page.text(sh.take(7, C("AE")))
    page.bullets([inline_md(sh.take(r, c)) for r, c in ((13, C("AE")), (13, C("AI")), (17, C("AE")), (17, C("AI")))])
    page.heading(3, sh.expect(21, C("AF"), "ÉTAPE 2"))
    page.text(sh.take(22, C("AE")))
    page.bullets([inline_md(sh.take(r, c)) for r in (28, 30) for c in (C("AC"), C("AF"), C("AI"), C("AL"))])
    page.heading(3, sh.expect(38, C("AF"), "ÉTAPE 3"))

    # caractéristique
    page.heading(4, sh.take(39, C("H")))
    rows = [[sh.take(r, C("D")), sh.take(r, C("G")), sh.take(r, C("K")), sh.take(r, C("O"))] for r in range(44, 55, 2)]
    page.table(["Caractéristique", "Niveau", "Gemmes", "Prix"], rows)  # (libellés ajoutés)
    # compétence
    page.heading(4, sh.take(39, C("X")))
    starts = (44, 52, 60, 68, 76, 84)
    bonus_labels = None
    rows = []
    for r0 in starts:
        labels = [sh.txt(r0 + 2 * i, C("AB")) for i in range(4)]
        if bonus_labels is None:
            bonus_labels = labels
        elif labels != bonus_labels:
            raise ValueError("Accessoires : libellés de bonus d'acquis différents en ligne %d" % r0)
        rows.append([sh.take(r0, C("U")), sh.take(r0, C("X"))] + [sh.take(r0 + 2 * i, C("AE")) for i in range(4)])
    page.table(["Compétence", "Gemmes"] + bonus_labels, rows)  # (libellés « Compétence » et « Gemmes » ajoutés)
    # attributs, attaque, défense, jet de dés, autre
    for head, c_roll, c_eff, c_lvl, c_gem, c_price in EFFECT_GROUPS:
        page.heading(4, sh.take(39, C(head)))
        rows = []
        for r in range(44, 83, 2):
            roll = sh.take(r, C(c_roll))
            if roll is None:
                raise ValueError("Accessoires : jet manquant en %s" % ref_of(r, C(c_roll)))
            eff = sh.take(r, C(c_eff))
            rows.append([roll, with_notes(eff, sh.pop_notes(r, C(c_eff))), sh.take(r, C(c_lvl)), sh.take(r, C(c_gem)),
                         sh.take(r, C(c_price))])
        page.table(["Jet", "Effet", "Niveau", "Gemmes", "Prix"], rows)  # (libellés ajoutés)

    # gemmes précieuses
    page.heading(2, sh.expect(1, C("AT"), "Gemme précieuse"))
    cols = [C(c) for c in ("AT", "AX", "BF", "BJ", "BN")]
    headers = ["Magie"] + [sh.txt(2, c) for c in cols]  # (libellé ajouté : « Magie »)
    rows = [[sh.take(r, C("AQ"))] + [sh.take(r, c) for c in cols] for r in sh.rows(C("AQ"), 3, 31)]
    page.table(headers, rows)
    # montures
    page.heading(2, sh.expect(1, C("BS"), "Monture"))
    rows = [[sh.take(r, C("BS")), sh.take(r, C("BW")), sh.take(r, C("CA")), sh.take(r, C("CE"))] for r in range(2, 12, 2)]
    page.table(["Niveau", "Matière", "Prix", "Effet"], rows)  # (libellés ajoutés)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Onglet « Pièces élémentaires »
# --------------------------------------------------------------------------------------------------------------------

WEAPON_ROWS = (8, 15, 22, 29, 36, 43, 50, 57, 64, 71, 78)
ARMOR_BLOCKS = (99, 110, 121, 132)


def build_pieces(sh):
    page = Page(sh, "pieces-elementaires", "Pièces élémentaires", ["pièce élémentaire", "amélioration", "armes", "armures"],
                aliases=["PIECE ELEMENTAIRE"])
    sh.expect(1, 1, "PIECE ELEMENTAIRE")
    rules = sh.take(3, 1)
    set_summary(page, rules)
    page.text(rules)

    # armes : onze types x 14 éléments
    elem_cols = [C("X") + 7 * i for i in range(14)]
    elems = [sh.txt(1, c) for c in elem_cols]
    page.heading(2, "Armes élémentaires")
    for r in WEAPON_ROWS:
        label = sh.take(r, C("Q"))
        right = sh.take(r, C("DR"))
        page.heading(3, label)
        first = fmt(label).split("\n")[0].strip()
        if fold(fmt(right)) != fold(first):
            page.line("Libellé répété à droite du tableau : %s" % fmt(right))
        rows = []
        for c, elem in zip(elem_cols, elems):
            value = sh.take(r, c)
            if value is None:
                raise ValueError("Pièces élémentaires : cellule manquante en %s" % ref_of(r, c))
            lines = [l.strip() for l in fmt(value).split("\n")]
            if len(lines) != 4 or not re.fullmatch(r"\+8 Dégâts", lines[1]) or not lines[2].startswith("Élément"):
                raise ValueError("Pièces élémentaires : cellule %s de forme inattendue : %r" % (ref_of(r, c), value))
            rows.append([elem, lines[0], lines[1], lines[2], with_notes(lines[3], sh.pop_notes(r, c))])
        page.table(["Colonne", "Nom", "Dégâts", "Élément", "Capacité"], rows)  # (« Colonne », « Dégâts » : libellés ajoutés)

    # améliorations (colonnes A à F, lignes 57 à 94)
    page.heading(2, sh.expect(57, 1, "AMELIORATION"))
    for cap, head_row, first, last, total_row in (("Armes", 58, 60, 79, 80), ("Armure", 82, 84, 93, 94)):
        page.heading(3, sh.expect(head_row, C("B"), cap))
        sh.expect(head_row + 1, C("B"), "Coût")
        sh.expect(head_row + 1, C("F"), "Effet")
        rows = []
        for r in range(first, last + 1):
            lvl = sh.take(r, 1)
            if lvl is None:
                continue
            rows.append([lvl, sh.take(r, C("B")), sh.take(r, C("F"))])
        page.table(["Niveau", "Coût", "Effet"], rows)  # (libellé ajouté : « Niveau »)
        label = sh.expect(total_row, C("B"), "TOTAL")
        value = sh.take(total_row, C("F"))
        page.raw("**%s**%s" % (esc_text(label), " : " + cell_md(value) if value is not None else ""))

    # vêtement et armures : quatre blocs x 14 éléments
    page.heading(2, "Vêtement et armures élémentaires")
    arm_cols = [C("Y") + 8 * i for i in range(14)]
    arm_elems = [sh.txt(92, c) for c in arm_cols]
    again = [sh.txt(143, c) for c in arm_cols]  # en-têtes répétés en bas de l'onglet, sans contenu dessous
    if arm_elems != again:
        raise ValueError("Pièces élémentaires : les en-têtes des lignes 92 et 143 diffèrent")
    for r0 in ARMOR_BLOCKS:
        label = sh.take(r0, C("Q"))
        if fold(fmt(sh.take(r0, C("EG")))) != fold(fmt(label)):
            raise ValueError("Pièces élémentaires : libellé de droite différent en %s" % ref_of(r0, C("EG")))
        page.heading(3, label)
        rows = []
        for c, elem in zip(arm_cols, arm_elems):
            for r, expected in ((r0, "Nom"), (r0 + 2, "AP"), (r0 + 4, "Effet(s)")):
                got = sh.take(r, c)
                if got is not None and fold(fmt(got)) != fold(expected):
                    raise ValueError("Pièces élémentaires : %r attendu en %s, trouvé %r" % (expected, ref_of(r, c), got))
            am_label = sh.take(r0 + 2, c + 4)
            if am_label is not None and fold(fmt(am_label)) != "am":
                raise ValueError("Pièces élémentaires : « AM » attendu en %s" % ref_of(r0 + 2, c + 4))
            rows.append([elem, sh.take(r0, c + 2), sh.take(r0 + 2, c + 2), sh.take(r0 + 2, c + 6), sh.take(r0 + 6, c)])
        page.table(["Colonne", "Nom", "AP", "AM", "Effet(s)"], rows)  # (« Colonne » : libellé ajouté)
    return finish(page)


# --------------------------------------------------------------------------------------------------------------------
# Écriture sûre
# --------------------------------------------------------------------------------------------------------------------

BUILDERS = (
    ("Équipement inventaire", build_inventaire),
    ("Armes", build_armes),
    ("Armures", build_armures),
    ("Bouclier", build_bouclier),
    ("Bâton magique", build_baton),
    ("LivreParchemin", build_livre_parchemin),
    ("Accessoires", build_accessoires),
    ("Pièces élémentaires", build_pieces),
)


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
    """Fichier produit par ce script : sa source est l'URL du classeur et l'un des onglets de la famille."""
    try:
        with open(path, encoding="utf-8") as fh:
            head = fh.read(4000)
    except OSError:
        return False
    return URL in head and any("onglet « %s »" % name in head for name, _ in BUILDERS)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « équipement » du wiki depuis le dump de « %s »." % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py (répétable)")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    args = ap.parse_args(argv)

    sheets = {}
    for path in args.dump:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        names = {s["name"] for s in data["sheets"]}
        if all(name in names for name, _ in BUILDERS):
            for raw in data["sheets"]:
                sheets.setdefault(raw["name"], raw)
    missing = [name for name, _ in BUILDERS if name not in sheets]
    if missing:
        sys.exit("onglets absents des dumps : %s" % ", ".join(missing))

    pages, problems = [], []
    for name, builder in BUILDERS:
        try:
            pages.append(builder(Sheet(sheets[name])))
        except (ValueError, AssertionError) as err:
            problems.append("%s : %s" % (name, err))
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1

    # titres et fichiers des autres familles
    other_titles = {}
    for sub in sorted(os.listdir(args.out)) if os.path.isdir(args.out) else []:
        sub_path = os.path.join(args.out, sub)
        if not os.path.isdir(sub_path):
            continue
        for fname in sorted(os.listdir(sub_path)):
            full = os.path.join(sub_path, fname)
            if fname.endswith(".md") and not is_ours(full):
                t = read_title(full)
                if t:
                    other_titles[wiki_key(t)] = full
    seen_titles, seen_paths = set(), set()
    for page in pages:
        key = wiki_key(page.title)
        if key in other_titles:
            problems.append("titre déjà utilisé par %s : %r" % (other_titles[key], page.title))
        if key in seen_titles:
            problems.append("titre en double dans la famille : %r" % page.title)
        seen_titles.add(key)
        path = os.path.join(args.out, CATEGORY, page.slug + ".md")
        if path in seen_paths:
            problems.append("slug en double : %s" % path)
        seen_paths.add(path)
        if os.path.exists(path) and not is_ours(path):
            problems.append("fichier existant qui n'est pas de cette famille, non écrasé : %s" % path)
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1

    for page in pages:
        out_dir = os.path.join(args.out, CATEGORY)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, page.slug + ".md")
        body = page.render()
        old = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                old = fh.read()
        if old != body:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(body)
        print("%s %s (%d cellules reprises)" % ("inchangé" if old == body else "écrit", path, len(page.sh.consumed)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
