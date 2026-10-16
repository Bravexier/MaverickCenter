#!/usr/bin/env python3
"""Famille « equipement » : l'équipement du classeur « Ressources et Craft » (une page du wiki par onglet).

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/equipement.py --dump <ressources-craft.json> [--dump <autre.json>] \
        --out /home/user/MaverickCenter/client/src/content/wiki
    python3 -I tools/sheets/equipement.py --dump <ressources-craft.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki --verifier      # ne réécrit rien

Source : Google Sheet « Ressources et Craft » (fileId 1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw), converti en JSON par
tools/sheets/xlsx_to_json.py (format décrit dans ce script ; le dump est celui d'APRÈS l'ajout des commentaires : cellules avec
`note` et `threads`). Les cellules sont une donnée non fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour
le Markdown). Rien n'est inventé : valeurs, noms, formules de règles, coquilles et formulations sont ceux des cellules
(« 100.0 » reste « 100.0 », les valeurs viennent du cache, jamais d'un recalcul). Le dump ne contient pas les couleurs de fond ; la
seule qui porte une information écrite par la source (« Les armes en bleu sont les armes possible en arme de départ », onglet
« Armes ») est recopiée dans la constante BLUE_NAME_CELLS (références des cellules de nom d'arme à fond bleu, lues dans le .xlsx) ;
les autres couleurs (catégories, grille des armures) ne sont pas reprises.

NOTES ET FILS DE COMMENTAIRES DE CELLULE (clés `note` et `threads` des cellules du dump). Une NOTE est le petit commentaire jaune
d'une cellule, un FIL est une conversation « Commentaire » de Google Sheets ; ils précisent parfois une règle (« Si un sort de
niveau 5 est lancé, le changement de posture n'est plus possible le reste du tour »). Ils sont cités tels que le classeur les écrit
(mêmes conventions de rendu que le reste de la page), jamais interprétés ni reformulés ni corrigés, sous le tableau (ou le titre)
qui porte leur cellule, dans la même section, dans l'ordre : la note de la cellule, puis ses fils. Libellés (ceux de la famille
« races » : « **Note de la cellule « Don »** : … ») :
    **Note de la cellule « <intitulé de la cellule> »** : texte                  (texte d'une ligne)
    **Note de la cellule « <intitulé de la cellule> »**                          (texte de plusieurs lignes : libellé, ligne
                                                                                  vide, puis paragraphes et listes)
    **Commentaire de la cellule « … »** / **Commentaire résolu de la cellule « … »**    (fil ouvert / résolu)
L'intitulé est celui de la colonne du tableau suivi, entre parenthèses, de la ligne (« Effet (Bombe perçante) », « Effet (Jet 12.0) » :
nom, ou jet, de la première colonne de la ligne) ; pour une carte à quatre lignes des « Pièces élémentaires » (nom / +8 Dégâts /
Élément / capacité) c'est le nom de la carte (« Épée de Terre ») ; pour un titre, le texte du titre (« MONNAIE »). Les réponses
automatiques d'un fil (« Marquée comme fermée » / « Rouverte ») sont des événements, pas du contenu ; toute autre réponse arrête le
script. Une note ou un fil blanc (espaces seuls) est ignoré. Un commentaire posé sur une cellule fusionnée autre que celle en haut à
gauche (« Armes » QA6 dans QA5:QL6) est rattaché à la cellule principale, qui porte la valeur (la cellule « Effet » de la
« Bombe perçante »). Cellules qui peuvent porter un commentaire, par page : le titre MONNAIE (A1) de « Équipement inventaire » ;
toute cellule d'un tableau lu en colonnes avec en-têtes (matériel d'« Équipement inventaire », « MATERIAUX » et armes d'« Armes »,
« MATERIAUX » et « FABRICATION » d'« Armures », « FABRICATION » et « MATERIAUX » de « Bouclier ») ; la cellule « Effet » des cinq
tableaux à colonne d'effets de l'ÉTAPE 3 d'« Accessoires » (attributs, attaque, défense, jet de dés, autre) ; la carte des « Pièces
élémentaires ». Le script S'ARRÊTE, sans rien écrire, avec un
message qui nomme l'onglet et la cellule, si un commentaire :
  * est sur une cellule vide (le dump garde alors v = "" : un commentaire ne se rattache à aucun texte), cellule fusionnée non
    principale dont la principale est vide comprise ;
  * est dans un onglet que ni ce script ni divers-craft.py (les six autres onglets du classeur) ne publient ;
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

Fichiers écrits (et seulement ceux-là), un par onglet, catégorie « ressources » :
    <out>/ressources/equipement-inventaire.md   onglet « Équipement inventaire »
    <out>/ressources/armes.md                   onglet « Armes »
    <out>/ressources/armures.md                 onglet « Armures »
    <out>/ressources/bouclier.md                onglet « Bouclier »
    <out>/ressources/baton-magique.md           onglet « Bâton magique »
    <out>/ressources/livre-parchemin.md         onglet « LivreParchemin »
    <out>/ressources/accessoires.md             onglet « Accessoires »
    <out>/ressources/pieces-elementaires.md     onglet « Pièces élémentaires »
Les autres onglets du classeur (Familiers, Maison, Machine de GuerreSiège, Maladie V2, Maladie, Fiche de tour) relèvent de
divers-craft.py : ce script ne les lit pas (leurs commentaires sont comptés et signalés).

Structure des onglets (les blocs sont repérés par leurs libellés et leurs colonnes ; le script s'arrête avec une erreur si
un libellé attendu manque ou si une cellule non vide n'a été reprise nulle part : rien n'est perdu en silence) :

  « Équipement inventaire » : bandeaux en ligne 1. MONNAIE (nom en A, abréviation en D ; sous-bloc CONVERTISSEUR : équivalences)
    ; PRODUITS NON MONAITAIRE (+ fréquents) en trois colonnes de listes (VEGETAUX, ANIMAUX, AUTRES : nom puis prix) ;
    MATOS AVENTURES, MATOS FABRICATION, MATOS PROJECTILE : trois tableaux Nom / Prix / Description (en-têtes ligne 3). Le
    commentaire de cellule de A1 (trois fils, dont deux sans rapport apparent avec la monnaie) est cité sous MONNAIE.
  « Armes » : A1 = règles générales ; liste des 26 armes dont le nom est sur fond bleu (« Armes sur fond bleu dans la
    source », par bandeau, d'après BLUE_NAME_CELLS) ; MATERIAUX (O/S/W : matière, prix, effets) ; AMELIORATION (+1 à +10, coût,
    effet, TOTAL) ; « COMMENT DÉTERMINER LE PRIX DE VOTRE ARME ? » (formule en une ligne) ; puis douze bandeaux d'armes (ÉPÉES,
    DAGUES, …, ARME DE MONSTRES) à partir de la colonne AE, chacun avec ses en-têtes de ligne 2 (Nom, Coût…, Catégorie, Effet,
    Description) et une arme par couple de lignes fusionnées. Le commentaire de cellule QA6 (plage fusionnée QA5:QL6 = effet de
    « Bombe perçante ») était cité sous le tableau, avec l'intitulé « Effet (Bombe perçante) » ; il ne l'est plus (décision R91 :
    il datait des armes à feu ; COMMENTS_REMOVED).
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
    Gemme précieuse (14 magies, trois prix par quart de gemme) ; Monture (5 niveaux). Trois notes de cellule (BK66, CI66, ED80)
    sont citées sous le tableau de l'effet qu'elles commentent.
  « Pièces élémentaires » : A3 = règles ; onze types d'arme × 14 éléments (cellule = nom / +8 Dégâts / Élément / capacité,
    quatre lignes) ; AMELIORATION (armes +1 à +10, armures +5 ; les « TOTAL » sont repris tels quels, celui des armures n'a pas
    de valeur dans la source) ; quatre blocs d'équipement (VETEMENT, ARMURE LÉGERE, INTERMEDIAIRE, LOURDE) × 14 éléments
    (nom, AP, AM, effets). Trois notes de cellule (CW8, X29, CI64) sont citées sous le tableau de la carte commentée.

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
« Armes élémentaires », « Vêtement et armures élémentaires », « Armes sur fond bleu dans la source ». Les seules phrases ajoutées sont
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
FILE_ID = "1KkOG6FYjIf62Y_xLQxIE8aQTZFLlKPXmCB9e7XU3-vw"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID
CATEGORY = "ressources"

# Commentaires de cellule du dump (clés `note` et `threads`) : genres, libellés rendus dans la page, réponses automatiques d'un fil.
KIND_NOTE, KIND_THREAD, KIND_THREAD_DONE = "note", "thread", "thread_done"

# Commentaires de cellule que le site ne cite plus, par décision du propriétaire : onglet -> {adresse du dump : début attendu du texte}. Ils ne
# sont ni rendus ni attendus dans la page (lecture du dump et contrôles de couverture et de placement) ; un autre texte à la même adresse est
# cité comme d'habitude.
#   Armes!QA6 : le fil résolu sur l'effet de la Bombe perçante (« Il faut perdre un bras pour avoir cette arme… »), qui datait des armes à feu
#   (décision R91 : la remarque de l'arme et son entrée dans la page sont retirées par une modification rapatriée du site de dev,
#   historique_modification ; la note de cellule de la base reste, trace du classeur que le rapprochement relit).
COMMENTS_REMOVED = {
    "Armes": {"QA6": "Il faut perdre un bras pour avoir cette arme"},
}


def comment_removed(tab, ref, text):
    """Vrai pour un commentaire que le site ne cite plus (COMMENTS_REMOVED : son onglet, son adresse dans le dump, le début de son texte)."""
    start = COMMENTS_REMOVED.get(tab, {}).get(ref)
    return start is not None and isinstance(text, str) and text.strip().startswith(start)

LABELS = {
    KIND_NOTE: "Note de la cellule « %s »",
    KIND_THREAD: "Commentaire de la cellule « %s »",
    KIND_THREAD_DONE: "Commentaire résolu de la cellule « %s »",
}
STATUS_REPLIES = ("Marquée comme fermée", "Rouverte")   # événements d'état écrits par Google, pas du contenu

# Onglets de « Ressources et Craft » publiés par tools/sheets/divers-craft.py : leurs commentaires ne sont pas rendus ici (comptés).
SIBLING_TABS = ("Familiers", "Maison", "Machine de GuerreSiège", "Maladie V2", "Maladie", "Fiche de tour")
SIBLING_SCRIPT = "divers-craft.py"

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


def shorten(text, limit=40):
    flat = " ".join(str(text).split())
    return flat if len(flat) <= limit else flat[: limit - 1] + "…"


def comment_items(tab, cell):
    """[(genre, texte)] des commentaires d'une cellule du dump : sa note, puis ses fils dans l'ordre du dump (texte blanc ignoré).
    Une réponse de fil autre qu'un événement d'état est un contenu qui n'a pas de place dans la page : ValueError."""
    out = []
    ref = ref_of(cell["r"], cell["c"])
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
        self.max_row = raw["max_row"]
        self.cells = {}   # (ligne, colonne) -> valeur, cellules non vides
        self.decor = {}   # cellules ne contenant que des espaces : ignorées
        pending = []      # [(cellule, [(genre, texte)])] commentaires du dump, avant rattachement
        for c in raw["cells"]:
            key = (c["r"], c["c"])
            items = [it for it in comment_items(self.name, c) if not comment_removed(self.name, ref_of(*key), it[1])]
            if items:
                pending.append((key, items))
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
        # Commentaires par cellule qui porte une valeur. Un commentaire sur une cellule vide n'a aucune place dans la page, sauf
        # sur une cellule fusionnée autre que celle en haut à gauche (QA6 dans QA5:QL6) : il appartient à la plage, donc à la
        # cellule principale, qui porte la valeur.
        self.comments = {}
        for key, items in sorted(pending):
            target = key
            if key not in self.cells:
                corner = self.primary_of(key)
                if corner is None or corner not in self.cells:
                    hint = " (cellule fusionnée non principale de %s, dont la cellule principale est vide)" % ref_of(*corner) if corner else ""
                    raise ValueError("%s!%s : la cellule est vide%s mais porte %s (« %s ») : un commentaire ne se rattache à aucun "
                                     "texte de la page" % (self.name, ref_of(*key), hint,
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

    def pop_comments(self, r, c):
        """Commentaires [(genre, texte)] de la cellule (r, c), retirés de la liste des commentaires à placer."""
        return self.comments.pop((r, c), [])

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


def comment_block(kind, label, text):
    """Lignes Markdown d'un commentaire de cellule : « **Note de la cellule « intitulé »** : texte » si le texte tient sur une ligne,
    sinon le libellé seul, une ligne vide, puis le texte en paragraphes et en listes. Le texte n'est ni interprété ni reformulé."""
    head = LABELS[kind] % esc_text(" ".join(str(label).split()))
    blocks = md_blocks(text)
    if len(blocks) == 1 and blocks[0][0] == "p" and len(blocks[0][1]) == 1:
        return ["**%s** : %s" % (head, esc_line(blocks[0][1][0]))]
    return ["**%s**" % head, ""] + md_text(text)


def comment_lines(entries):
    """[(intitulé, [(genre, texte)])] -> lignes Markdown : un bloc par commentaire, chacun suivi d'une ligne vide."""
    out = []
    for label, items in entries:
        for kind, text in items:
            out += comment_block(kind, label, text) + [""]
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

    def heading(self, level, value, comments=()):
        """Titre dont le texte est la première ligne de la cellule ; les lignes suivantes forment un paragraphe. `comments` :
        commentaires [(genre, texte)] de la cellule, cités sous le titre (intitulé = la première ligne)."""
        lines = [l.strip() for l in fmt(value).split("\n")]
        self.body += ["#" * level + " " + esc_line(lines[0]), ""]
        rest = "\n".join(lines[1:]).strip()
        if rest:
            self.body += md_text(rest) + [""]
        self.body += comment_lines([(lines[0], comments)])

    def text(self, value):
        self.body += md_text(value) + [""]

    def line(self, value):
        """Une ligne de texte brut (échappée)."""
        self.body += [esc_line(value), ""]

    def raw(self, md):
        self.body += [md, ""]

    def bullets(self, items):
        self.body += ["- " + esc_line(i) if not isinstance(i, MD) else "- " + str(i) for i in items] + [""]

    def table(self, headers, rows, notes=()):
        """Tableau, puis les commentaires de ses cellules `notes` [(intitulé, [(genre, texte)])] : sous le tableau, dans la section."""
        self.body += md_table(headers, rows) + [""] + comment_lines(notes)

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


def first_line(value):
    """Première ligne non vide d'une valeur de cellule, espaces normalisés (intitulé de ligne d'un commentaire)."""
    lines = [" ".join(l.split()) for l in fmt(value).split("\n")]
    return next((l for l in lines if l), "")


def read_table(sh, header_row, cols, first, last, required=0):
    """En-têtes (ligne `header_row`, ou liste donnée), lignes de données et commentaires des cellules lues ; une ligne doit avoir sa
    cellule `required`. -> (en-têtes, lignes, notes) ; `notes` = [(intitulé, [(genre, texte)])], intitulé « colonne (ligne) » (en-tête
    de la colonne, puis première ligne de la cellule `required` de la ligne), à passer à Page.table."""
    if isinstance(header_row, (list, tuple)):
        headers = list(header_row)
    else:
        headers = [sh.txt(header_row, c) for c in cols]
    rows, notes = [], []
    for r in range(first, last + 1):
        vals = [sh.take(r, c) for c in cols]
        if all(v is None for v in vals):
            continue
        if vals[required] is None:
            raise ValueError("%s : ligne %d sans %s : %r" % (sh.name, r, ref_of(r, cols[required]), vals))
        for i, c in enumerate(cols):
            items = sh.pop_comments(r, c)
            if items:
                notes.append(("%s (%s)" % (first_line(headers[i]) or col_letters(c), first_line(vals[required])), items))
        rows.append(vals)
    return headers, rows, notes


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


def finish(page):
    sh = page.sh
    if sh.comments:  # une cellule commentée que la page reprend (ou ne reprend pas) sans lui avoir prévu de place
        items = [("%s (« %s »)" % (ref_of(*pos), shorten(entries[0][1]))) for pos, entries in sorted(sh.comments.items())]
        raise ValueError("%s : %d cellule(s) portent un commentaire sans place prévue dans la page : %s ; la page ne cite que les "
                         "commentaires du titre MONNAIE, des tableaux à en-têtes, des effets d'accessoires et des pièces "
                         "élémentaires (voir la docstring)" % (sh.name, len(sh.comments), " ; ".join(items[:8])))
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
    page.heading(2, sh.expect(1, 1, "MONNAIE"), sh.pop_comments(1, 1))
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
        headers, rows, notes = read_table(sh, 3, [C(c) for c in cols], 4, sh.max_row)
        page.table(headers, rows, notes)
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
    headers, rows, notes = read_table(sh, 2, [C("O"), C("S"), C("W")], 3, 31)
    page.table(headers, rows, notes)

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
        # le commentaire d'une cellule de la plage fusionnée d'un effet (QA6 dans QA5:QL6) est déjà rattaché à la cellule principale
        # (Sheet) : il est cité sous le tableau avec l'intitulé « Effet (<arme>) »
        headers, rows, notes = read_table(sh, 2, cols, 3, sh.max_row)
        # une cellule hors des colonnes d'en-tête dans la zone du bandeau serait signalée par finish()
        page.table(headers, rows, notes)
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
    headers, rows, notes = read_table(sh, 27, [C("A"), C("E"), C("I"), C("Q")], 28, 69)
    page.table(headers, rows, notes)

    page.heading(2, sh.expect(26, C("AA"), "FABRICATION"))
    headers, rows, notes = read_table(sh, 27, [C("AA"), C("AE")], 28, 43)
    page.table(headers, rows, notes)

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
    headers, rows, notes = read_table(sh, 2, [C("B"), C("F")], 3, 8)
    page.table(headers, rows, notes)
    a_refaire = sh.take(10, C("B"))
    if a_refaire is not None:
        page.text(a_refaire)
    page.bullets(pair_lines(pairs(sh, C("B"), C("E"), 35, 41)))

    page.heading(2, sh.expect(1, C("K"), "MATERIAUX"))
    headers, rows, notes = read_table(sh, 2, [C("K"), C("O"), C("S"), C("AA")], 3, 44)
    page.table(headers, rows, notes)

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
        rows, notes = [], []
        for r in range(44, 83, 2):
            roll = sh.take(r, C(c_roll))
            if roll is None:
                raise ValueError("Accessoires : jet manquant en %s" % ref_of(r, C(c_roll)))
            eff = sh.take(r, C(c_eff))
            items = sh.pop_comments(r, C(c_eff))  # commentaire de l'effet, cité sous le tableau : « Effet (Jet 12.0) »
            if items:
                notes.append(("Effet (Jet %s)" % fmt(roll), items))
            rows.append([roll, eff, sh.take(r, C(c_lvl)), sh.take(r, C(c_gem)), sh.take(r, C(c_price))])
        page.table(["Jet", "Effet", "Niveau", "Gemmes", "Prix"], rows, notes)  # (libellés ajoutés)

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
        rows, notes = [], []
        for c, elem in zip(elem_cols, elems):
            value = sh.take(r, c)
            if value is None:
                raise ValueError("Pièces élémentaires : cellule manquante en %s" % ref_of(r, c))
            lines = [l.strip() for l in fmt(value).split("\n")]
            if len(lines) != 4 or not re.fullmatch(r"\+8 Dégâts", lines[1]) or not lines[2].startswith("Élément"):
                raise ValueError("Pièces élémentaires : cellule %s de forme inattendue : %r" % (ref_of(r, c), value))
            items = sh.pop_comments(r, c)  # commentaire de la carte entière (nom / dégâts / élément / capacité), cité sous le tableau
            if items:
                notes.append((lines[0], items))
            rows.append([elem, lines[0], lines[1], lines[2], lines[3]])
        page.table(["Colonne", "Nom", "Dégâts", "Élément", "Capacité"], rows, notes)  # (« Colonne », « Dégâts » : libellés ajoutés)

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


# --------------------------------------------------------------------------------------------------------------------
# Commentaires de cellule : refus, contrôle de couverture et de placement
# --------------------------------------------------------------------------------------------------------------------

# onglet -> page produite. Table écrite à part, à dessein : les contrôles cherchent un commentaire dans la page de son onglet sans
# s'appuyer sur les constructeurs ci-dessus.
PAGE_OF_TAB = {
    "Équipement inventaire": "equipement-inventaire",
    "Armes": "armes",
    "Armures": "armures",
    "Bouclier": "bouclier",
    "Bâton magique": "baton-magique",
    "LivreParchemin": "livre-parchemin",
    "Accessoires": "accessoires",
    "Pièces élémentaires": "pieces-elementaires",
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
    lecture ni de rendu de ce script (l'adresse est celle du dump : QA6 pour une cellule fusionnée non principale), sans ceux que le site ne
    cite plus (COMMENTS_REMOVED)."""
    out = []
    for sheet in data["sheets"]:
        if sheet["name"] not in tabs:
            continue
        for cell in sheet["cells"]:
            ref = ref_of(cell["r"], cell["c"])
            note = cell.get("note")
            if isinstance(note, str) and note.strip() and not comment_removed(sheet["name"], ref, note):
                out.append((sheet["name"], ref, KIND_NOTE, note))
            for thread in cell.get("threads") or []:
                text = thread.get("text")
                if isinstance(text, str) and text.strip() and not comment_removed(sheet["name"], ref, text):
                    out.append((sheet["name"], ref, KIND_THREAD_DONE if thread.get("done") else KIND_THREAD, text))
    return out


def refuse_unpublished(data):
    """Un commentaire dans un onglet que ni ce script ni divers-craft.py ne publient n'aurait aucune place dans le wiki : ValueError.
    -> [(onglet, notes, fils)] des onglets de divers-craft.py qui portent des commentaires (rendus par lui, comptés ici)."""
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
        raise ValueError("onglet « %s » : %d commentaire(s) de cellule (%s) dans un onglet que equipement.py ne publie pas (onglets "
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


def read_dump(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def pick_dump(paths):
    """(dump, {onglet: dump brut de l'onglet}) du premier dump qui contient tous les onglets de la famille."""
    for path in paths:
        data = read_dump(path)
        names = {s["name"] for s in data["sheets"]}
        if all(name in names for name, _ in BUILDERS):
            return data, {raw["name"]: raw for raw in data["sheets"]}
    return None, {}


def build_pages(raws):
    """Construit les pages -> (pages, problèmes) ; un onglet en erreur n'empêche pas de signaler les autres."""
    pages, problems = [], []
    for name, builder in BUILDERS:
        try:
            pages.append(builder(Sheet(raws[name])))
        except (ValueError, AssertionError) as err:
            problems.append(str(err) if str(err).startswith(name) else "%s : %s" % (name, err))
    return pages, problems


# --------------------------------------------------------------------------------------------------------------------
# --verifier : contrôle indépendant, n'écrit rien
# --------------------------------------------------------------------------------------------------------------------

CONTROL_NOTE = "Note de contrôle du vérificateur : texte de rejeu."
CONTROL_THREAD = "Fil de contrôle du vérificateur : texte de rejeu."
FAR = (2000, 2000)   # cellule que la page d'aucun onglet ne reprend

# onglet -> (cellule dont la page cite les commentaires, cellule que la page reprend SANS place prévue pour un commentaire).
# None : aucune cellule de cet onglet ne reçoit de commentaire.
REPLAY_CELLS = {
    "Équipement inventaire": ("A1", "A10"),
    "Armes": ("O3", "A1"),
    "Armures": ("A28", "A1"),
    "Bouclier": ("B3", "AK1"),
    "Bâton magique": (None, "A1"),
    "LivreParchemin": (None, "G1"),
    "Accessoires": ("AM44", "A1"),
    "Pièces élémentaires": ("X8", "A3"),
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


def tab_error(data, tab):
    """Message d'arrêt de la construction de la page de `tab` sur `data` (None si elle va au bout)."""
    builder = dict(BUILDERS)[tab]
    try:
        builder(Sheet(tab_of(data, tab)))
    except (ValueError, AssertionError) as err:
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

    for tab, _builder in BUILDERS:
        if tab_of(data, tab) is None:
            failures.append("rejeu « %s » : onglet absent du dump" % tab)
            continue
        placed, unplaced = REPLAY_CELLS[tab]
        expect_stop("note sur une cellule vide (%s)" % tab,
                    tab_error(with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "note": CONTROL_NOTE}), tab),
                    (ref_of(FAR[0] + 1, FAR[1]), "vide", "une note"))
        expect_stop("fil sur une cellule vide (%s)" % tab,
                    tab_error(with_cell(data, tab, {"r": FAR[0] + 1, "c": FAR[1], "v": "", "threads": [{"text": CONTROL_THREAD}]}), tab),
                    (ref_of(FAR[0] + 1, FAR[1]), "vide", "un fil"))
        merged = "%s:%s" % (ref_of(*FAR), ref_of(FAR[0] + 1, FAR[1]))
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
        builder = dict(BUILDERS)[tab]
        try:
            page = builder(Sheet(tab_of(noted, tab)))
        except (ValueError, AssertionError) as err:
            failures.append("rejeu « %s » : un commentaire de contrôle sur %s est refusé : %s" % (tab, placed, str(err)[:200]))
            continue
        slug, text = page.slug, page.render()
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
    data, raws = pick_dump(dumps)
    if data is None:
        return 1, ["ÉCART : aucun dump ne contient les onglets de la famille (%s)" % ", ".join(n for n, _ in BUILDERS)]
    problems = []
    try:
        elsewhere = refuse_unpublished(data)
    except ValueError as err:
        return 1, ["ÉCART : %s" % err]
    pages, built_problems = build_pages(raws)
    problems += built_problems
    texts, pages_ok = {}, 0
    for page in pages:
        path = os.path.join(out_dir, CATEGORY, page.slug + ".md")
        if not os.path.exists(path):
            problems.append("%s : page absente (%s)" % (page.slug, path))
            continue
        with open(path, encoding="utf-8") as fh:
            texts[page.slug] = fh.read()
        if texts[page.slug] != page.render():
            problems.append("%s : la page écrite n'est pas celle que le dump produit (relancer le script)" % page.slug)
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
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule les commentaires de cellule depuis le dump, les compare aux pages écrites "
                         "et rejoue des cas d'erreur")
    args = ap.parse_args(argv)

    if args.verifier:
        code, lines = verify(args.dump, args.out)
        for line in lines:
            print(line, file=sys.stderr if code else sys.stdout)
        return code

    data, sheets = pick_dump(args.dump)
    if data is None:
        sys.exit("onglets absents des dumps : %s" % ", ".join(name for name, _ in BUILDERS))
    try:
        elsewhere = refuse_unpublished(data)
    except ValueError as err:
        print("ERREUR : %s" % err, file=sys.stderr)
        return 1

    pages, problems = build_pages(sheets)
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1
    # contrôle de couverture et de placement des commentaires, sur le texte des pages, avant toute écriture
    texts = {page.slug: page.render() for page in pages}
    problems = note_problems(data, texts) + place_problems(data, texts)
    if problems:
        print("ERREUR : contrôle de couverture des commentaires de cellule, rien n'est écrit :", file=sys.stderr)
        for p in problems[:30]:
            print("  " + p, file=sys.stderr)
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
    mine = raw_comments(data, PAGE_OF_TAB)
    print("commentaires de cellule : %d note(s) et %d fil(s) cités, chacun une fois (couverture et placement contrôlés)" % (
        sum(1 for m in mine if m[2] == KIND_NOTE), sum(1 for m in mine if m[2] != KIND_NOTE)))
    for name, notes, threads in elsewhere:
        print("onglet « %s » : %d note(s) et %d fil(s) de commentaires, rendus par %s" % (name, notes, threads, SIBLING_SCRIPT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
