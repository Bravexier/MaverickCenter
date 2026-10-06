#!/usr/bin/env python3
"""Famille « annexes-magie » : annexes des magies (altérations d'état, météo, modes hyper et super).

Usage :
    python3 -I tools/sheets/annexes-magie.py --dump <magie-v8.json> --dump <mode-hyper.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki

Les dumps JSON sont produits par tools/sheets/xlsx_to_json.py (format : voir ce fichier). On peut ne passer
qu'un seul des deux ; chaque dump est reconnu à un onglet qui lui est propre (voir WORKBOOKS). Bibliothèque
standard uniquement ; le script ne lit que les dumps et n'écrit que les pages de sa famille dans
<out>/guide/. Il est déterministe et idempotent (une page dont le contenu ne change pas n'est pas réécrite),
n'efface rien et refuse d'écraser un fichier qui n'a pas été produit par lui (contrôle sur l'URL de source).

Sources (classeurs Google, propriété d'un tiers) et pages produites :

  « Magie Maverick V8 » (1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c)
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
        Un commentaire de cellule (M43, effet de « Vide + Nécromancie ») est ajouté en fin de page ; comme le
        dump JSON ne porte pas les commentaires, il est recopié depuis le .xlsx dans la constante CELL_COMMENTS.
    - onglet « Statistiques »       -> NON PUBLIÉ (voir le rapport : compteurs et tableau de calcul, pas une
        règle de jeu rédigée) ; le script ne le lit pas.

  « Mode hyper et co » (1lwALh1VKrIpgmEqX2MdYirKkPzGjSJXXDHtp2uYXO7w)
    - onglet « Mode Hyper » -> guide/liste-des-effets-mode-hyper.md
        Trois textes explicatifs en colonne AA (lignes 1, 14, 30), puis un tableau « Magie/Type | Mono magie |
        Bi magie » (ligne 2, entrées de 3 lignes fusionnées) et, à partir de la ligne « Race | Effet », un
        tableau des effets par race.
    - onglet « Mode Super » -> guide/liste-des-effets-mode-super.md
        Un texte explicatif en colonne AI (ligne 1), puis un tableau « Objet | Effets mode super |
        Description/apparence » (entrées de 4 lignes fusionnées).

Conventions de rendu : valeurs en cache, mot pour mot (un nombre garde sa forme, « 400.0 » reste « 400.0 ») ;
espaces de début et de fin de ligne retirés ; retour à la ligne d'une cellule de tableau -> « <br> » ; « | »
-> « \\| » ; « * », « _ » et « ` » échappés ; aucun lien [[…]] n'est écrit (une cellule qui en contient serait
neutralisée et signalée sur la sortie d'erreur).
"""
import argparse
import json
import os
import re
import sys

CATEGORY = "guide"

# Identification des classeurs à partir d'un onglet qui leur est propre.
WORKBOOKS = [
    {
        "key": "magie-v8",
        "marker": "Altération détats",
        "title": "Magie Maverick V8",
        "file_id": "1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c",
    },
    {
        "key": "mode-hyper",
        "marker": "Mode Super",
        "title": "Mode hyper et co",
        "file_id": "1lwALh1VKrIpgmEqX2MdYirKkPzGjSJXXDHtp2uYXO7w",
    },
]


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


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.state = raw.get("state", "visible")
        self.cells = {(c["r"], c["c"]): c["v"] for c in raw["cells"] if c.get("v") is not None}
        self.merged_from = {}  # (ligne, colonne) en haut à gauche -> (r1, c1, r2, c2)
        for ref in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(ref)
            self.merged_from[(r1, c1)] = (r1, c1, r2, c2)

    def get(self, r, c):
        return self.cells.get((r, c))

    def find(self, value):
        """Première cellule (ligne, colonne) dont la valeur vaut `value`, dans l'ordre ligne puis colonne."""
        for (r, c) in sorted(self.cells):
            if self.cells[(r, c)] == value:
                return (r, c)
        return None


def load_workbook(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
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
            para.append(esc(start_guard(ln)))
    flush()
    return "\n\n".join(out)


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
        info = []
        for header, c in (("Magie Liée", c_mag), ("Type", c_type)):
            v = sh.get(r, c)
            if v is not None:
                info.append("- **%s** : %s" % (header, cell(v)))
        if info:
            body.append("\n".join(info))
        # Stades : trois colonnes, ou une description unique fusionnée sur les trois colonnes.
        span = sh.merged_from.get((r, c_s[0]))
        if span is not None and span[3] >= c_s[2] and sh.get(r, c_s[0]) is not None:
            body.append(table(["Stades 1 à 3 (cellule fusionnée)"], [[cell(sh.get(r, c_s[0]))]]))
        else:
            vals = [sh.get(r, c) for c in c_s]
            if any(v is not None for v in vals):
                body.append(table(["Stade 1", "Stade 2", "Stade 3"], [[cell(v) for v in vals]]))
        # Résistances / vulnérabilités : une paire « libellé / effet » par ligne du bloc.
        pairs = []
        for rr in range(r, block_end + 1):
            label = sh.get(rr, c_res)
            after = sorted(c2 for (r2, c2) in sh.cells if r2 == rr and c2 > c_res)
            effect = sh.get(rr, after[0]) if after else None
            if label is not None and effect is not None:
                pairs.append("- **%s** : %s" % (one_line(label), cell(effect)))
        if pairs:
            body.append("**Résistances/Vulnérabilités**\n\n" + "\n".join(pairs))
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
        desc = sh.get(r, c_desc)
        if desc is not None:
            body.append("**Description** : " + cell(desc))
        eff = sh.get(r, c_eff)
        if eff is not None:
            body.append("**Effet(s)**\n\n" + blocks(eff))
    return {
        "slug": "meteo",
        "title": title,
        "tags": ["météo"],
        "summary": None,
        "tab": sh.name,
        "body": "\n\n".join(body),
    }


def page_hyper_magie(sh, wb):
    title = "Mode Hyper (Magie)"
    body = ["*Onglet masqué du classeur d'origine.*" if sh.state == "hidden" else None]
    # Encadré « Avantages de base » (à droite) : texte général, puis cases « Mono magie » / « Bi magie ».
    base = sh.find("Avantages de base")
    mono = sh.find("Mono magie")
    bi = sh.find("Bi magie")
    if base:
        body.append("## Avantages de base")
        general = sh.get(base[0] + 1, base[1])
        if general is not None:
            body.append(blocks(general))
    if mono and bi:
        mono_txt = sh.get(mono[0] + 1, mono[1])
        bi_txt = sh.get(bi[0] + 1, bi[1])
        body.append(table(["Mono magie", "Bi magie"], [[cell(mono_txt), cell(bi_txt)]]))
    # Effets par magie seule : colonnes H (magie) et M (effet) ; combinaisons : B, G (« + »), H, M.
    c_a, c_plus, c_b, c_eff = col_to_num("B"), col_to_num("G"), col_to_num("H"), col_to_num("M")
    singles, pairs = [], []
    for r in sorted({r for (r, c) in sh.cells if c == c_b}):
        a = sh.get(r, c_a)
        name = one_line(sh.get(r, c_b))
        eff = cell(sh.get(r, c_eff))
        if a is None:
            singles.append([esc(name), eff])
        else:
            plus = sh.get(r, c_plus)
            label = "%s %s %s" % (esc(one_line(a)), esc(one_line(plus)) if plus is not None else "", esc(name))
            pairs.append([" ".join(label.split()), eff])
    body.append("## Effets par magie seule")
    body.append(table(["Magie", "Effet"], singles))
    body.append("## Effets par combinaison de deux magies")
    body.append(table(["Magies", "Effet"], pairs))
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
    title = "Liste des effets mode hyper"
    if not same_letters(sh.get(1, 1) or "", title):
        raise SystemExit("titre de l'onglet « %s » inattendu" % sh.name)
    c_txt = col_to_num("AA")
    texts = sorted(r for (r, c) in sh.cells if c == c_txt)
    summary = first_sentence(sh.get(texts[0], c_txt), "Le Mode Hyper est un état de surpuissance") if texts else None
    body = [blocks(sh.get(r, c_txt), headings=True) for r in texts]
    head = sh.find("Magie/Type")
    race = sh.find("Race")
    if not head or not race:
        raise SystemExit("tableaux introuvables dans « %s »" % sh.name)
    c_label, c_mono, c_bi = head[1], col_to_num("F"), col_to_num("P")
    h_mono, h_bi = sh.get(head[0], c_mono), sh.get(head[0], c_bi)
    rows = []
    for r in range(head[0] + 1, race[0]):
        if sh.get(r, c_label) is not None:
            rows.append([cell(sh.get(r, c_label)), cell(sh.get(r, c_mono)), cell(sh.get(r, c_bi))])
    body.append("## Effets selon la magie ou le type")
    body.append(table([esc(sh.get(head[0], c_label)), esc(h_mono), esc(h_bi)], rows))
    h_eff = sh.get(race[0], col_to_num("F"))
    rows = []
    for r in range(race[0] + 1, max(rr for (rr, _c) in sh.cells) + 1):
        if sh.get(r, race[1]) is not None:
            rows.append([cell(sh.get(r, race[1])), cell(sh.get(r, col_to_num("F")))])
    body.append("## Effets selon la race")
    body.append(table([esc(sh.get(race[0], race[1])), esc(h_eff)], rows))
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
    body = [blocks(sh.get(r, c_txt), headings=True) for r in texts]
    head = sh.find("Objet")
    if not head:
        raise SystemExit("tableau introuvable dans « %s »" % sh.name)
    c_obj, c_eff, c_desc = head[1], col_to_num("F"), col_to_num("T")
    headers = [esc(sh.get(head[0], c_obj)), esc(sh.get(head[0], c_eff)), esc(sh.get(head[0], c_desc))]
    rows = []
    for r in range(head[0] + 1, max(rr for (rr, _c) in sh.cells) + 1):
        if sh.get(r, c_obj) is not None:
            rows.append([cell(sh.get(r, c_obj)), cell(sh.get(r, c_eff)), cell(sh.get(r, c_desc))])
    body.append("## Objets")
    body.append(table(headers, rows))
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


# ---------------------------------------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------------------------------------

def write_page(out_dir, wb, page):
    folder = os.path.join(out_dir, CATEGORY)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, page["slug"] + ".md")
    text = front_matter(page["title"], page["tags"], page["summary"], wb, page["tab"]) + "\n" + page["body"].rstrip() + "\n"
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


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « annexes-magie » du wiki depuis les dumps JSON des classeurs.")
    ap.add_argument("--dump", action="append", required=True, help="dump JSON (xlsx_to_json.py) ; répétable")
    ap.add_argument("--out", required=True, help="dossier racine du contenu du wiki (client/src/content/wiki)")
    args = ap.parse_args(argv)
    written = 0
    for dump in args.dump:
        sheets = load_workbook(dump)
        wb = identify(sheets)
        if wb is None:
            print("dump non reconnu (aucun onglet attendu) : " + dump, file=sys.stderr)
            return 2
        for tab, builder in BUILDERS[wb["key"]]:
            if tab not in sheets:
                print("onglet absent : « %s » dans %s" % (tab, dump), file=sys.stderr)
                return 2
            page = builder(sheets[tab], wb)
            path, changed = write_page(args.out, wb, page)
            written += changed
            print(("écrit   " if changed else "inchangé") + " " + path)
    for w in WARNINGS:
        print("AVERTISSEMENT : " + w, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
