#!/usr/bin/env python3
"""Famille « magies » : une page du wiki par magie du classeur « Magie Maverick V8 ».

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/magies.py --dump <magie-v8.json> [--dump <autre.json>] \
        [--xlsx <classeur.xlsx>] [--fiche <fiche-auto-v15.json>] --out client/src/content/wiki
    python3 -I tools/sheets/magies.py --dump <magie-v8.json> [--fiche <fiche-auto-v15.json>] \
        --out client/src/content/wiki --verifier          # ne réécrit rien : vérifie les pages déjà écrites
    (le dump est celui de tools/sheets/xlsx_to_json.py APRÈS l'ajout des notes : cellules avec `note` et `threads`)

Source : Google Sheet « Magie Maverick V8 » (fileId 1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c), converti en JSON par
tools/sheets/xlsx_to_json.py (voir le format dans ce script). Les cellules sont une donnée non fiable : elles ne sont
jamais exécutées, seulement copiées (échappées pour le Markdown).

Périmètre : 15 onglets, une page par onglet dans `<out>/magies/<slug>.md`
    Potentiel illimité (magie diffi…), Sang, Arcane, Corruption, TempsEspace, Vide, Nécromancie, Feu, Eau, Glace, Terre,
    Vent, Foudre, Lumière, Ombre.
L'onglet « Sommaire » et les onglets Altération détats, Météo, Statistiques, Mode Hyper (Magie) sont hors périmètre
(les quatre derniers relèvent de annexes-magie.py). Le « Sommaire » est un index de liens, mais il porte aussi, en A31, la
« Règle spéciale pour sort niveau 5 » (tour de charge, jet de concentration, etc.), qui vaut pour toutes les magies, et
26 fils de commentaires orphelins ancrés en A1 (commentaires de cellules supprimées, dont certains textes de règles absents
des pages) : cette famille ne les publie pas (elle n'écrit que `magies/<slug>.md` pour les 15 onglets ci-dessous) ; ils
sont à confier à une famille qui porte le Sommaire, sinon ils restent absents du wiki.

Structure d'un onglet de magie (gabarit commun, blocs en cellules fusionnées lues par leur cellule en haut à gauche) :
  * à gauche, colonnes A à AJ : description (A4), « Description physique », « Explication » (Arcane, Corruption et
    Potentiel illimité seulement), bloc DONNÉES (santé et chakra offerts, caractéristique bonus, 4ème barre éventuelle,
    résistances, vulnérabilités, magies non compatibles), « Capacité Mode Hyper » (mono-magie / bi-magie), ROLES ;
    Nécromancie ajoute le tableau « AMELIORATION CADAVERIQUE » (deux blocs côte à côte) ;
  * à droite, colonnes AL à BR : la table des sorts, en-têtes en ligne 3 (Niveau, Nom, Type, Coût, Portée, Zone, D/S/B,
    Effets secondaires), 23 sorts de 3 lignes fusionnées chacun (niveaux 1 à 4 : 5 sorts, niveau 5 : 3 sorts) ; la ligne 1
    est une bannière décorative (MAGIE / nom / NIVEAU 1 à 5) ;
  * en bas : la légende (IC ; N, L, C = obtention des niveaux de maîtrise) et, pour certaines magies, trois textes titrés
    du nom d'un sort de niveau 5 (colonnes T, AK et BB, lignes 79 à 88 ; une ligne plus bas pour Foudre).
Les positions varient d'une magie à l'autre (lignes décalées) : le script s'appuie sur les libellés et sur la liste
« merged », pas sur des numéros de ligne fixes, et s'arrête avec une erreur si une cellule non vide n'est pas reconnue
(rien n'est perdu en silence).

Notes et commentaires de cellule : le dump les porte (champs `note` et `threads` des cellules, voir xlsx_to_json.py ; les
dumps de l'API Google Sheets n'ont que `note`). Une NOTE est le petit commentaire jaune d'une cellule, un FIL est une
conversation « Commentaire » de Google Sheets ; ils précisent parfois une règle (« Si coup critique avec une arme sous ce sort,
oblige un jet de vigueur pour ne pas prendre Saignement au stade 1 »). Ils sont cités tels quels, jamais interprétés, dans la
section « ## Notes et commentaires des sorts », juste après la table des sorts (une cellule de tableau Markdown ne peut pas porter
un texte de plusieurs lignes) : une entrée par note ou par fil, dans l'ordre de la table des sorts puis des colonnes, la note de
la cellule d'abord, avec le libellé de la famille « races » (« **Note de la cellule « Don »** : … ») complété du sort :
    **Note de la cellule « Effets secondaires » du sort « Annulation »** : texte             (texte d'une ligne)
    **Note de la cellule « Effets secondaires » du sort « Annulation »**                     (texte de plusieurs lignes :
                                                                                               libellé, ligne vide, texte)
    **Commentaire résolu de la cellule « … » du sort « … »** : texte                          (fil résolu ; sinon « Commentaire »)
La colonne est l'en-tête de la table des sorts (« Effets secondaires » pour les 85 notes actuelles). Choix de rendu :
  * un fil identique (aux espaces près) à la note de sa cellule, ou à un fil précédent de la même cellule, n'est pas répété
    (le classeur écrit certaines notes aussi en commentaire : 29 fils sont dans ce cas) ;
  * les réponses automatiques d'un fil « Marquée comme fermée » / « Rouverte » sont des événements, pas du contenu ; toute autre
    réponse arrête le script (rien n'est perdu en silence) ;
  * les noms d'auteurs ne sont pas dans le dump ; un commentaire sans rapport avec les règles est écarté (EXCLUDED_COMMENTS : adresse
    ET texte exacts, avec la raison ; aujourd'hui un seul message de conversation, Eau AN46) et le rapport le dit ;
  * les liens hypertextes de cellule (vers le classeur « Invocation ») ne sont pas reproduits.
Contrôle de couverture (avant d'écrire une page, puis dans --verifier) : chaque note et chaque fil du dump doit figurer dans la page
de son onglet, exactement une fois, avec son texte intégral (comparé aux espaces près, échappements Markdown retirés), sous le sort
dont la cellule le porte ; une entrée en trop, citée deux fois, altérée ou dans le désordre est un écart. Le script s'arrête, sans
écrire la page, quand une note n'a pas de place : cellule VIDE (le dump garde alors une cellule avec v = "" : une note ne se
rattache à aucun texte), cellule hors de la table des sorts (colonnes AL à BR, sorts de 3 lignes), sort sans nom. Les onglets non
publiés par cette famille (Sommaire, Altération détats, Météo, Statistiques, Mode Hyper (Magie), ceux du même classeur que les 15
ci-dessus) ne peuvent pas porter de NOTE : le script s'arrête et dit lequel (rien n'est écrit). Leurs FILS ne sont pas rendus : le
rapport les liste pour qu'une autre famille les prenne (annexes-magie.py reprend celui du Mode Hyper, M43 ; les 26 fils orphelins du
Sommaire, A1, et les 2 des Statistiques, BH27 et AR52, n'ont pas de page). Le dump est recoupé avec le .xlsx d'origine quand il est
lu (formats de nombre, ci-dessous) : un dump qui n'a pas les notes et les fils du classeur (produit avec une ancienne version de
xlsx_to_json.py) arrête le script au lieu d'effacer les notes des pages.

Formats de nombre : le dump ne les porte pas. Une cellule numérique reste telle que le cache la donne (« 6.0 » reste
« 6.0 », sans arrondi), sauf si le classeur la met au format pourcentage (« 0% » ou « 0.00% »), auquel cas elle est écrite
comme le classeur l'affiche (Arcane!AX52 : 0.25 -> « 25% »). Les formats sont lus dans le .xlsx (xl/styles.xml et attribut s
de chaque cellule) : option --xlsx, ou à défaut <dossier du dump>/../sheets/<fileId>/classeur.xlsx (introuvable : erreur, sauf
--sans-formats). Un autre format non-Général sur une cellule numérique, ou un pourcentage qui obligerait à arrondir, arrête le
script avec une erreur plutôt que d'être perdu en silence. Avec --sans-formats, le .xlsx n'est pas lu du tout (ni formats ni
recoupement des notes) : un avertissement le rappelle.

Frontmatter structuré (relations entre magies) : en plus de title/aliases/tags/summary/sources/status, chaque page porte,
juste après `tags`, des champs lus par le site (clés en français sans accent, listes YAML en ligne comme `tags`) :
  * `nom_court: "Sang"` : le nom court de la magie, orthographe des en-têtes B1:P1 de l'onglet « Accessibilité Magie » de
    « Fiche personnage Maverick Auto » (« Potentiel Illimité », « Espace/Temps », « Lumière »…). Correspondance
    onglet V8 -> nom court (champ nom_court de MAGIES) vérifiée de deux façons : la bannière N1 de l'onglet (« MAGIE DE
    L'ESPACE/TEMPS », onglet « TempsEspace ») se termine par ce nom, et les 15 noms du script sont identiques, dans le même
    ordre, aux en-têtes du dump de la fiche (--fiche, ou fiche-auto-v15.json à côté du dump ; sinon avertissement).
  * puis, d'après les lignes du bloc DONNÉES (les 15 onglets en ont un) :
      `resiste_a: [...]`          <- « Résistance magique »
      `vulnerable_a: [...]`       <- « Vulnérabilité magique »
      `incompatible_avec: [...]`  <- « Magie non compatible »
    Les éléments sont des noms courts de magies (orthographe de l'en-tête), dans l'ordre de la source, séparés par des
    cellules, des virgules ou des retours à la ligne. « Aucune » donne `[]`, et une cellule vide à droite du libellé d'une
    de ces trois lignes aussi (lecture « vide = aucune » : elle est signalée dans le rapport, voir plus bas ; pour tout
    autre libellé du bloc DONNÉES, une cellule vide arrête la page avec une erreur, rien n'est deviné). Une magie peut
    figurer dans sa propre liste (le Sang résiste au Sang) : la source est conservée telle quelle, sans symétrie ni déduction
    (l'Arcane et l'Espace/Temps listent la Corruption comme incompatible alors que la ligne de la Corruption est une
    phrase libre : rien n'en est déduit ; chaque page dit ce que SON onglet dit).
    Rien n'est deviné : une ligne absente de l'onglet, ou dont le texte n'est pas une liste de noms (phrase libre), n'émet
    PAS la clé, et le script l'écrit dans son RAPPORT (stdout). Un site doit donc lire « clé absente » comme « non
    renseigné » et `[]` comme « aucune ». Dans le classeur V8 actuel : 9 onglets n'ont pas de ligne « Magie non compatible »
    (Potentiel illimité, Feu, Eau, Glace, Terre, Vent, Foudre, Lumière, Ombre) et celle de la Corruption est une phrase
    libre (mono-magie, exception des Elfes noirs et des Felfes noirs) : `incompatible_avec` est omis sur ces 10 pages.
    Un nom qui ne correspond à aucune des 15 magies (comparaison sans casse ni accents ; « Espace-Temps » est refusé),
    « Aucune » mêlé à d'autres noms, un doublon ou deux lignes du même libellé arrêtent la page avec une erreur claire
    (le fichier n'est pas écrit, code de sortie 1). Distinction liste de noms / phrase libre : un élément de plus de
    40 caractères, de plus de 3 mots (« Toutes les autres magies » est une phrase libre, « Toutes les magies » un nom
    inconnu donc une erreur), ou contenant « . : ; ( ) ! ? », fait de toute la ligne une phrase libre. Ce critère
    (constantes NAME_MAX_LEN, NAME_MAX_WORDS, NOT_NAME_CHARS) est lu au même endroit par le générateur et par la
    vérification indépendante.
    Les listes d'altérations d'état (« Résistance altération d'état », « Vulnérabilité altération d'état ») ne sont pas
    des champs : elles restent dans le corps de la page, qui n'a pas changé.
Vérification indépendante : à la fin de chaque exécution (et seule avec --verifier), check_pages() recalcule les valeurs
attendues directement depuis les cellules brutes du dump (sans réutiliser l'analyseur de pages) et les compare au
frontmatter des pages écrites ; tout écart (ÉCART : ...) donne le code de sortie 1. Un autotest des cas limites du
contrat (autotest()) tourne à chaque lancement : il vérifie aussi, sur un onglet synthétique, que le générateur et la
vérification indépendante rendent le même verdict (liste, clé omise ou erreur) pour une cellule vide, « Aucune », une
phrase libre courte, un nom inconnu, un doublon, etc. Il rejoue de même les cas d'erreur des notes (autotest_comments :
déduplication, exclusion, note sur une cellule vide, hors de la table, onglet non publié, recoupement avec le classeur, aller-retour
du Markdown de chaque texte). Rapport (stdout) : une ligne « écrit » par page, la liste des clés omises avec leur raison,
(seulement s'il y en a) la liste des clés lues comme `[]` faute de valeur, le décompte des notes et des fils (lus, écrits, non
répétés, écartés avec leur raison), les fils des onglets que cette famille ne publie pas, puis « vérification : OK (15 pages) ».
Le classeur V8 actuel n'a aucune cellule vide de ce genre. Avec --verifier : un « ÉCART : … » par problème (frontmatter, note ou fil
absent, altéré, cité deux fois, en trop ou dans le désordre ; note d'un onglet non publié, sur une cellule vide ou hors de la table),
code de sortie 1, rien n'est écrit.

Ne touche qu'aux fichiers `<out>/magies/<slug>.md` de sa famille : il refuse d'écraser un fichier qui n'est pas issu de ce
classeur, refuse un titre déjà porté par une autre page, et n'efface rien.
"""
import argparse
import importlib.util
import json
import os
import posixpath
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from decimal import Decimal

WORKBOOK = "Magie Maverick V8"
FILE_ID = "1sYzEBmnjZNVbf103zgATttlRO9zuKtzdFCdTAV58e8c"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID
CATEGORY = "magies"

# onglet (nom exact dans le dump), nom affiché de l'onglet, titre de la page, slug, nom court, alias, tags
# nom court = en-tête de la colonne de la magie dans l'onglet « Accessibilité Magie » (B1:P1 du classeur « Fiche personnage
# Maverick Auto », dans cet ordre) ; recoupé avec le dump de ce classeur (--fiche) et avec la bannière N1 de chaque onglet.
MAGIES = [
    dict(onglet="Potentiel illimité (magie diffi", affiche="Potentiel illimité (magie diffi…",
         titre="Potentiel illimité", slug="potentiel-illimite", nom_court="Potentiel Illimité",
         aliases=["Absolu Incomplet", "Magie Universelle"], tags=["magie", "potentiel illimité"]),
    dict(onglet="Sang", titre="Magie du Sang", slug="magie-du-sang", nom_court="Sang",
         aliases=[], tags=["magie", "sang"]),
    dict(onglet="Arcane", titre="Magie de l'Arcane", slug="magie-de-larcane", nom_court="Arcane",
         aliases=[], tags=["magie", "arcane"]),
    dict(onglet="Corruption", titre="Magie de la Corruption", slug="magie-de-la-corruption", nom_court="Corruption",
         aliases=[], tags=["magie", "corruption"]),
    dict(onglet="TempsEspace", titre="Magie de l'Espace/Temps", slug="magie-de-lespace-temps", nom_court="Espace/Temps",
         aliases=["Espace/Temps", "Espace-Temps", "Temps/Espace"], tags=["magie", "espace-temps"]),
    dict(onglet="Vide", titre="Magie du Vide", slug="magie-du-vide", nom_court="Vide",
         aliases=[], tags=["magie", "vide"]),
    dict(onglet="Nécromancie", titre="Magie de la Nécromancie", slug="magie-de-la-necromancie", nom_court="Nécromancie",
         aliases=["Nécromancie"], tags=["magie", "nécromancie"]),
    dict(onglet="Feu", titre="Magie du Feu", slug="magie-du-feu", nom_court="Feu",
         aliases=[], tags=["magie", "feu"]),
    dict(onglet="Eau", titre="Magie de l'Eau", slug="magie-de-leau", nom_court="Eau",
         aliases=[], tags=["magie", "eau"]),
    dict(onglet="Glace", titre="Magie de la Glace", slug="magie-de-la-glace", nom_court="Glace",
         aliases=[], tags=["magie", "glace"]),
    dict(onglet="Terre", titre="Magie de la Terre", slug="magie-de-la-terre", nom_court="Terre",
         aliases=[], tags=["magie", "terre"]),
    dict(onglet="Vent", titre="Magie du Vent", slug="magie-du-vent", nom_court="Vent",
         aliases=[], tags=["magie", "vent"]),
    dict(onglet="Foudre", titre="Magie de la Foudre", slug="magie-de-la-foudre", nom_court="Foudre",
         aliases=[], tags=["magie", "foudre"]),
    dict(onglet="Lumière", titre="Magie de la Lumière", slug="magie-de-la-lumiere", nom_court="Lumière",
         aliases=[], tags=["magie", "lumière"]),
    dict(onglet="Ombre", titre="Magie de l'Ombre", slug="magie-de-lombre", nom_court="Ombre",
         aliases=[], tags=["magie", "ombre"]),
]

SHORT_NAMES = [cfg["nom_court"] for cfg in MAGIES]


def fold(text):
    """Comparaison sans accents ni casse (cohérence des titres, noms de magies)."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.casefold()).strip()


SHORT_BY_FOLD = {fold(n): n for n in SHORT_NAMES}
assert len(SHORT_BY_FOLD) == len(SHORT_NAMES), "noms courts de magies en double"

# Relations entre magies émises dans le frontmatter : (clé, libellé de la ligne du bloc DONNÉES)
RELATIONS = (
    ("resiste_a", "Résistance magique"),
    ("vulnerable_a", "Vulnérabilité magique"),
    ("incompatible_avec", "Magie non compatible"),
)
RELATION_LABELS = frozenset(label for _key, label in RELATIONS)
NONE_WORD = "aucune"           # « Aucune » = liste vide
# Critère « phrase libre » (un seul endroit : le générateur et la vérification indépendante le lisent ici) : un élément
# de plus de NAME_MAX_LEN caractères, de plus de NAME_MAX_WORDS mots, ou contenant un caractère de NOT_NAME_CHARS n'est
# plus un nom de magie ; il suffit d'un tel élément pour que toute la ligne soit une phrase libre (clé omise).
NAME_MAX_LEN, NAME_MAX_WORDS = 40, 3
NOT_NAME_CHARS = ".:;()!?"
CELL_SPLIT = r"[,\n\r]"        # séparateurs de noms dans une cellule (fmt() ramène « \r » à « \n »)
FICHE_SHEET = "Accessibilité Magie"   # onglet de « Fiche personnage Maverick Auto » dont B1:P1 donne les noms courts

# Commentaires de cellule écartés : (onglet, cellule) -> (texte exact, raison). Ils ne sont pas du contenu de règle. Le texte
# fait partie de la déclaration : si le commentaire de cette cellule change, il n'est plus écarté (il est cité, ou il arrête le
# script), et rien de ce que le classeur dira demain ne disparaît derrière une adresse.
EXCLUDED_COMMENTS = {
    ("Eau", "AN46"): ("salut viens en vocal stp", "message de conversation sans rapport avec les règles"),
}
# Réponses automatiques d'un fil de commentaires : événements de statut, pas du contenu.
STATUS_REPLIES = {"Marquée comme fermée", "Rouverte"}
# Notes et fils rendus sous la table des sorts (voir la docstring) : titre de la section, libellés dans l'ordre de la page.
SECTION_NOTES = "Notes et commentaires des sorts"
KIND_NOTE, KIND_THREAD, KIND_THREAD_DONE = "Note", "Commentaire", "Commentaire résolu"
ENTRY_RE = re.compile(r"^\*\*(%s|%s|%s) de la cellule « (.+?) » du sort « (.+?) »\*\*(?: : (.*))?$"
                      % (KIND_THREAD_DONE, KIND_THREAD, KIND_NOTE))

# Colonnes (numéros à partir de 1)
COL_BANNER = 14        # N : bannière / titres de section
COL_AMEL = (4, 9, 20, 25)  # D, I, T, Y
LABEL_COLS = (1, 12, 22)   # A, L, V : libellés du bloc DONNÉES
COL_SPELL_FIRST = 38   # AL
COL_FOOT = (20, 37, 54)  # T, AK, BB
FIELDS = [  # (colonne de départ, nom attendu en ligne 3)
    (38, "Niveau"), (40, "Nom"), (46, "Type"), (50, "Coût"),
    (53, "Portée"), (56, "Zone"), (59, "D/S/B"), (62, "Effets secondaires"),
]
SPELL_ROW_FIRST, SPELL_ROW_LAST = 4, 72
SPELL_HEIGHT = 3
LEGEND_HEADER = "Obtention des niveaux de maîtrise"
HEADINGS = {"Description physique": "Description physique", "Explication": "Explication", "DONNÉES": "Données"}


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


def fmt(value):
    """Valeur en cache -> texte, sans arrondi (1.0 reste « 1.0 »)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int):
        return str(value)
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def is_blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def percent_text(value, code, where):
    """Nombre au format pourcentage du classeur -> texte affiché (0.25 avec « 0% » -> « 25% »), sans jamais arrondir."""
    m = re.fullmatch(r"0(?:\.(0+))?%", code)
    if not m:
        raise ValueError("%s : format de nombre %r non pris en charge (valeur %r)" % (where, code, value))
    exact = Decimal(repr(value)) * 100
    shown = exact.quantize(Decimal(1).scaleb(-len(m.group(1) or "")))
    if shown != exact:
        raise ValueError("%s : le format %r obligerait à arrondir %r" % (where, code, value))
    return format(shown, "f") + "%"


class Sheet:
    def __init__(self, raw, formats=None):
        """formats : {(ligne, colonne): code de format} des cellules numériques non-Général de cet onglet."""
        self.name = raw["name"]
        self.cells = {}
        formats = formats or {}
        for c in raw["cells"]:
            v = c["v"]
            if is_blank(v):
                continue
            code = formats.get((c["r"], c["c"]))
            if code is not None and isinstance(v, (int, float)) and not isinstance(v, bool):
                v = percent_text(v, code, "%s!%s%d" % (self.name, col_letters(c["c"]), c["r"]))
            self.cells[(c["r"], c["c"])] = v
        self.merges = {}
        for rng in raw.get("merged", []):
            r1, c1, r2, c2 = parse_range(rng)
            self.merges[(r1, c1)] = (r2, c2)
        self.consumed = set()

    def take(self, r, c):
        """Lit une cellule et la marque comme utilisée."""
        self.consumed.add((r, c))
        return self.cells.get((r, c))

    def width(self, r, c):
        if (r, c) in self.merges:
            return self.merges[(r, c)][1] - c + 1
        return 1

    def height(self, r, c):
        if (r, c) in self.merges:
            return self.merges[(r, c)][0] - r + 1
        return 1


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
    """Texte multi-lignes -> liste de blocs ('p', [lignes]) ou ('ul', [éléments]) ; les lignes « - … » forment des listes."""
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


def md_text(text, prefix=""):
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
    return [prefix + l if l else prefix.rstrip() for l in out]


def md_quote(text):
    return md_text(text, "> ")


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


# --------------------------------------------------------------------------------------------------------------------
# Lecture du .xlsx (formats de nombre) et des commentaires de cellule du dump
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


BUILTIN_FORMATS = {9: "0%", 10: "0.00%"}  # identifiants de formats intégrés qui nous intéressent ; 0 = Général


def read_number_formats(xlsx_path):
    """{onglet: {(ligne, colonne): code}} : cellules numériques dont le format n'est pas « Général »."""
    result = {}
    with zipfile.ZipFile(xlsx_path) as zf:
        styles = _xml(zf, "xl/styles.xml")
        custom = {}
        numfmts = styles.find("{%s}numFmts" % NS_MAIN)
        if numfmts is not None:
            custom = {int(n.get("numFmtId")): n.get("formatCode") for n in numfmts}
        xf_codes = []  # un code (ou None pour Général) par style de cellule, dans l'ordre de cellXfs
        for xf in styles.find("{%s}cellXfs" % NS_MAIN):
            fid = int(xf.get("numFmtId", "0"))
            if fid == 0:
                xf_codes.append(None)
            else:
                code = custom.get(fid) or BUILTIN_FORMATS.get(fid) or "format intégré n°%d" % fid
                xf_codes.append(None if code == "General" else code)
        workbook = _xml(zf, "xl/workbook.xml")
        rels = {r.get("Id"): r.get("Target") for r in _xml(zf, "xl/_rels/workbook.xml.rels")}
        for sheet in workbook.find("{%s}sheets" % NS_MAIN):
            path = posixpath.normpath(posixpath.join("xl", rels[sheet.get("{%s}id" % NS_REL)]))
            found = {}
            for c in _xml(zf, path).iter("{%s}c" % NS_MAIN):
                if c.get("t") not in (None, "n") or c.find("{%s}v" % NS_MAIN) is None:
                    continue  # texte, booléen, erreur ou cellule sans valeur : le format n'y change rien
                code = xf_codes[int(c.get("s", "0"))]
                if code is not None:
                    found[split_ref(c.get("r"))] = code
            result[sheet.get("name")] = found
    return result


def norm_ws(text):
    return " ".join(text.split())


def a1(r, c):
    return "%s%d" % (col_letters(c), r)


def load_xlsx_comments():
    """tools/sheets/xlsx_comments.py, chargé par son chemin : `python3 -I` n'ajoute pas le dossier du script à sys.path."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "xlsx_comments.py")
    spec = importlib.util.spec_from_file_location("xlsx_comments", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def dump_comments(raw):
    """({ref: note}, {ref: [fils]}) d'un onglet du dump, tels que le dump les porte."""
    notes, threads = {}, {}
    for c in raw["cells"]:
        if "note" in c:
            notes[a1(c["r"], c["c"])] = c["note"]
        if c.get("threads"):
            threads[a1(c["r"], c["c"])] = c["threads"]
    return notes, threads


def crosscheck_comments(workbook, source):
    """Écarts entre les notes et les fils du dump (`workbook` : {onglet: dump brut}) et ceux du classeur d'origine (`source` :
    résultat de xlsx_comments.read_comments). Un dump produit sans les commentaires (ancienne version de xlsx_to_json.py, dump de
    l'API sans `threads`) passerait la couverture, qui le compare à lui-même, en effaçant les notes des pages : c'est ce
    recoupement, avec le classeur, qui l'arrête."""
    errors = []
    for name in sorted(set(source) | set(workbook)):
        data = source.get(name, {"notes": {}, "threads": {}})
        notes, threads = dump_comments(workbook[name]) if name in workbook else ({}, {})
        bad_notes = sorted((r for r in set(notes) | set(data["notes"]) if notes.get(r) != data["notes"].get(r)), key=split_ref)
        bad_threads = sorted((r for r in set(threads) | set(data["threads"]) if threads.get(r) != data["threads"].get(r)),
                             key=split_ref)
        if bad_notes or bad_threads:
            errors.append("onglet « %s » : le dump ne porte pas les mêmes commentaires que le classeur (notes : %s ; fils : %s) : "
                          "dump produit sans les commentaires ou depuis un autre classeur, relancer tools/sheets/xlsx_to_json.py"
                          % (name, ", ".join(bad_notes[:8]) or "aucun écart", ", ".join(bad_threads[:8]) or "aucun écart"))
    return errors


def comment_candidates(tab, cell):
    """[(genre, texte)] d'une cellule du dump : sa note, puis ses fils (texte vide ignoré). Une réponse autre qu'un événement
    d'état dans un fil est un contenu qui n'a pas de place dans la page : ValueError."""
    out = []
    if not is_blank(cell.get("note")):
        out.append((KIND_NOTE, fmt(cell["note"])))
    for thread in cell.get("threads") or []:
        for reply in thread.get("replies") or []:
            if norm_ws(str(reply)) not in STATUS_REPLIES:
                raise ValueError("%s : fil de commentaires de la cellule %s : réponse inattendue (%r), ni rendue ni écartée : "
                                 "à examiner" % (tab, a1(cell["r"], cell["c"]), shorten(str(reply), 60)))
        if not is_blank(thread.get("text")):
            out.append((KIND_THREAD_DONE if thread.get("done") else KIND_THREAD, fmt(thread["text"])))
    return out


def comments_by_ref(raw, stats=None):
    """{ref: [(genre, texte)]} d'un onglet de magie, lus dans le dump : la note de la cellule, puis ses fils. Ne sont pas
    répétés : un fil identique (aux espaces près) à la note ou à un fil précédent de la même cellule, un commentaire déclaré dans
    EXCLUDED_COMMENTS. `stats` (dict) reçoit les comptes pour le rapport. Une note sur une cellule vide arrête le script."""
    tab = raw["name"]
    stats = stats if stats is not None else {}
    for key in ("notes", "threads", "repeated"):
        stats.setdefault(key, 0)
    stats.setdefault("excluded", [])
    by_ref = {}
    for cell in raw["cells"]:
        candidates = comment_candidates(tab, cell)
        if not candidates:
            continue
        ref = a1(cell["r"], cell["c"])
        if is_blank(cell["v"]):
            kind, text = candidates[0]
            raise ValueError("%s : la cellule %s est vide mais porte %s (« %s ») : disposition non gérée, ce texte ne se rattache à "
                             "rien dans la page" % (tab, ref, "une note" if kind == KIND_NOTE else "un fil de commentaires",
                                                    shorten(text, 40)))
        seen, items = set(), []
        for kind, text in candidates:
            stats["notes" if kind == KIND_NOTE else "threads"] += 1
            declared = EXCLUDED_COMMENTS.get((tab, ref))
            if declared and norm_ws(declared[0]) == norm_ws(text):
                stats["excluded"].append((tab, ref, text, declared[1]))
                continue
            if norm_ws(text) in seen:
                stats["repeated"] += 1
                continue
            seen.add(norm_ws(text))
            items.append((kind, text))
        if items:
            by_ref[ref] = items
    return by_ref


# --------------------------------------------------------------------------------------------------------------------
# Analyse d'un onglet
# --------------------------------------------------------------------------------------------------------------------

def parse_sheet(sh, cfg):
    page = {
        "banner_extra": [], "intro": None, "phys": None, "explication": None,
        "data": [], "hyper_header": None, "hyper_rows": [], "roles": [],
        "amel_title": None, "amel_left": [], "amel_right": [],
        "spells": [], "legend_ic": None, "legend_extra": [], "legend_items": [], "foot": [],
    }
    cells = sh.cells

    # Bannière décorative (ligne 1) : N1 répète le titre ; le reste de la ligne 1 à gauche est un message.
    banner = None
    for (r, c), v in sorted(cells.items()):
        if r == 1 and c <= 36:
            if c == COL_BANNER:
                banner = fmt(sh.take(r, c))
            else:
                page["banner_extra"].append(fmt(sh.take(r, c)))
    if banner is None or fold(banner) != fold(cfg["titre"]):
        raise ValueError("%s : bannière N1 %r incohérente avec le titre %r" % (sh.name, banner, cfg["titre"]))
    if not fold(banner).endswith(fold(cfg["nom_court"])):
        raise ValueError("%s : bannière N1 %r incohérente avec le nom court %r" % (sh.name, banner, cfg["nom_court"]))
    # bannière droite : MAGIE / nom / NIVEAU 1 à 5 (décoration)
    for (r, c), v in sorted(cells.items()):
        if r == 1 and c >= COL_SPELL_FIRST:
            sh.take(r, c)

    # Partie droite : en-têtes, sorts, cellules isolées, légende
    header = [(c, fmt(sh.take(3, c))) for (r, c), v in sorted(cells.items()) if r == 3 and c >= COL_SPELL_FIRST]
    if header != [(c, n) for c, n in FIELDS] and header:
        raise ValueError("%s : en-têtes de la table des sorts inattendus : %r" % (sh.name, header))
    tops = sorted(r for (r, c), v in cells.items() if c == COL_SPELL_FIRST and isinstance(v, (int, float))
                  and SPELL_ROW_FIRST <= r <= SPELL_ROW_LAST)
    starts = [c for c, n in FIELDS]
    spell_rows = set()
    for r in tops:
        if sh.height(r, COL_SPELL_FIRST) != SPELL_HEIGHT:
            raise ValueError("%s : sort ligne %d : hauteur fusionnée inattendue" % (sh.name, r))
        spell_rows.update(range(r, r + SPELL_HEIGHT))
        values = []
        for c in starts:
            values.append(fmt(sh.take(r, c)) if (r, c) in cells else "")
        page["spells"].append({"row": r, "values": values})
    for (r, c), v in sorted(cells.items()):
        if c >= COL_SPELL_FIRST and r in spell_rows and (r, c) not in sh.consumed:
            if r in tops:
                raise ValueError("%s : cellule %s%d inattendue dans un sort" % (sh.name, col_letters(c), r))
            # cellule isolée entre deux sorts (ex. « Niveau de Maîtrise (NM) » d'Arcane, en BJ18) : rangée avec la légende
            page["legend_extra"].append(fmt(sh.take(r, c)))
    # légende
    hdr = None
    for (r, c), v in sorted(cells.items()):
        if c >= COL_SPELL_FIRST and r >= 73 and (r, c) not in sh.consumed:
            text = fmt(v)
            if text.startswith("IC = "):
                page["legend_ic"] = fmt(sh.take(r, c))
            elif text == LEGEND_HEADER:
                hdr = (r, c)
                sh.take(r, c)
    if hdr:
        for k in range(1, 4):
            sig = sh.take(hdr[0] + k, hdr[1])
            desc = sh.take(hdr[0] + k, hdr[1] + 1)
            if sig is None or desc is None:
                raise ValueError("%s : légende N/L/C incomplète" % sh.name)
            page["legend_items"].append((fmt(sig), fmt(desc)))
    # Pied de page : textes titrés (colonnes T, AK, BB à partir de la ligne 76)
    foot_cells = {(r, c): v for (r, c), v in cells.items()
                  if r >= 76 and c in COL_FOOT and (r, c) not in sh.consumed}
    if foot_cells:
        title_row = min(r for r, c in foot_cells)
        for c in COL_FOOT:
            if (title_row, c) not in foot_cells:
                continue
            title = fmt(sh.take(title_row, c))
            below = [r for (r, cc) in foot_cells if cc == c and r > title_row]
            if len(below) > 1:
                raise ValueError("%s : plusieurs textes sous un titre de pied de page" % sh.name)
            page["foot"].append((title, fmt(sh.take(below[0], c)) if below else None))

    # Partie gauche (A à AJ)
    left = {}
    for (r, c), v in sorted(cells.items()):
        if r >= 2 and c <= 36 and (r, c) not in sh.consumed:
            left.setdefault(r, []).append((c, v))
    cur = "intro"
    for r in sorted(left):
        row = left[r]
        c0, v0 = row[0]
        if len(row) == 1 and c0 == COL_BANNER and v0 in HEADINGS:
            sh.take(r, c0)
            cur = {"Description physique": "phys", "Explication": "explication", "DONNÉES": "data"}[v0]
            continue
        if len(row) == 1 and c0 == 1 and fmt(v0) == "Capacité Mode Hyper":
            sh.take(r, c0)
            cur = "hyper"
            continue
        if len(row) == 1 and fmt(v0) == "ROLES":
            sh.take(r, c0)
            cur = "roles"
            continue
        if len(row) == 1 and c0 == COL_AMEL[0] and fmt(v0).startswith("TABLEAU"):
            page["amel_title"] = fmt(sh.take(r, c0))
            cur = "amel"
            continue
        if cur == "explication" and len(row) == 1 and c0 == 1 and fmt(v0) == "-":
            sh.take(r, c0)  # tiret décoratif au-dessus du texte
            continue
        # bloc de texte (cellule fusionnée sur toute la largeur)
        if len(row) == 1 and c0 == 1 and sh.width(r, c0) >= 30:
            key = cur if cur in ("intro", "phys", "explication") else None
            if key is None or page[key] is not None:
                raise ValueError("%s : bloc de texte inattendu en A%d" % (sh.name, r))
            page[key] = fmt(sh.take(r, c0))
            continue
        if cur == "roles":
            page["roles"].extend(fmt(sh.take(r, c)) for c, v in row)
            continue
        if cur == "amel":
            if any(c not in COL_AMEL for c, v in row) or len(row) % 2:
                raise ValueError("%s : ligne %d inattendue dans le tableau cadavérique" % (sh.name, r))
            got = {c: fmt(sh.take(r, c)) for c, v in row}
            if COL_AMEL[0] in got:
                page["amel_left"].append((got[COL_AMEL[0]], got[COL_AMEL[1]]))
            if COL_AMEL[2] in got:
                page["amel_right"].append((got[COL_AMEL[2]], got[COL_AMEL[3]]))
            continue
        if cur in ("data", "hyper") and c0 == 1:
            label = fmt(sh.take(r, c0))
            if cur == "hyper" and label == "Type":
                header = [fmt(sh.take(r, c)) for c, v in row[1:]]
                if len(header) != 1:
                    raise ValueError("%s : en-tête Mode Hyper inattendu" % sh.name)
                page["hyper_header"] = (label, header[0])
                continue
            if cur == "hyper":
                if len(row) != 2:
                    raise ValueError("%s : ligne Mode Hyper inattendue (%d)" % (sh.name, r))
                page["hyper_rows"].append((label, fmt(sh.take(r, row[1][0]))))
                continue
            # bloc DONNÉES : libellés en A, L, V ; les autres cellules sont des valeurs du dernier libellé
            pairs = [[label, []]]
            for c, v in row[1:]:
                if c in LABEL_COLS:
                    pairs.append([fmt(sh.take(r, c)), []])
                else:
                    pairs[-1][1].append(fmt(sh.take(r, c)))
            for lab, vals in pairs:
                # Une cellule vide à droite d'une ligne de relation (résistance, vulnérabilité, incompatibilité) se lit
                # comme une liste vide (contrat) ; pour tout autre libellé, rien n'est deviné : erreur.
                if not vals and lab not in RELATION_LABELS:
                    raise ValueError("%s : libellé sans valeur « %s »" % (sh.name, lab))
                page["data"].append((lab, vals))
            continue
        raise ValueError("%s : cellules gauche non reconnues à la ligne %d : %r" % (sh.name, r, row))

    return page


def check_all_consumed(sh):
    left_over = sorted(k for k in sh.cells if k not in sh.consumed)
    if left_over:
        raise ValueError("%s : cellules non reconnues : %s" % (
            sh.name, ", ".join("%s%d=%r" % (col_letters(c), r, sh.cells[(r, c)]) for r, c in left_over[:10])))


# --------------------------------------------------------------------------------------------------------------------
# Relations entre magies (frontmatter structuré)
# --------------------------------------------------------------------------------------------------------------------

def looks_like_name(item):
    """Un élément de liste est un nom (court, sans ponctuation de phrase) ; sinon la ligne est une phrase libre."""
    return (len(item) <= NAME_MAX_LEN and len(item.split()) <= NAME_MAX_WORDS
            and not any(ch in item for ch in NOT_NAME_CHARS))


def parse_relation(values, where):
    """Valeurs d'une ligne « Résistance magique » / « Vulnérabilité magique » / « Magie non compatible » (textes de
    cellules, une ou plusieurs, éventuellement séparés par des virgules ou des retours à la ligne).

    Renvoie la liste des noms courts de magies, dans l'ordre de la source ([] pour « Aucune » ou une cellule vide), ou
    None quand le texte n'est pas une liste de noms (phrase libre : rien n'est deviné, la clé sera omise). Un nom qui ne
    correspond à aucune des 15 magies (sans casse ni accents), « Aucune » mêlé à d'autres éléments ou un doublon lèvent
    une ValueError."""
    items = [part.strip() for v in values for part in re.split(CELL_SPLIT, fmt(v)) if part.strip()]
    if not items:
        return []
    if not all(looks_like_name(i) for i in items):
        return None
    if any(fold(i) == NONE_WORD for i in items):
        if len(items) == 1:
            return []
        raise ValueError("%s : « Aucune » mêlé à d'autres éléments : %r" % (where, items))
    names = []
    for item in items:
        name = SHORT_BY_FOLD.get(fold(item))
        if name is None:
            raise ValueError("%s : %r ne correspond à aucune des %d magies (%s)"
                             % (where, item, len(SHORT_NAMES), ", ".join(SHORT_NAMES)))
        if name in names:
            raise ValueError("%s : %s figure deux fois" % (where, name))
        names.append(name)
    return names


def shorten(text, limit=90):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def relation_fields(cfg, page):
    """Champs de frontmatter issus du bloc DONNÉES : ([(clé, noms courts)], [(clé, raison de l'omission)], [clé]).
    Une ligne absente de l'onglet ou rédigée en phrase libre n'est pas émise (la source ne donne pas de liste). Le dernier
    élément liste les clés dont la cellule est vide dans la source : elles sont émises comme `[]` (contrat) et signalées
    dans le rapport, car c'est une lecture (« vide » = « aucune »), pas un mot de la source comme « Aucune »."""
    where = cfg["onglet"]
    rows = {}
    for label, vals in page["data"]:
        if label in RELATION_LABELS:
            if label in rows:
                raise ValueError("%s : plusieurs lignes « %s »" % (where, label))
            rows[label] = vals
    fields, omitted, blank = [], [], []
    for key, label in RELATIONS:
        if not page["data"]:
            omitted.append((key, "l'onglet n'a pas de bloc DONNÉES"))
        elif label not in rows:
            omitted.append((key, "ligne « %s » absente du bloc DONNÉES" % label))
        else:
            names = parse_relation(rows[label], "%s : %s" % (where, label))
            if names is None:
                omitted.append((key, "texte libre dans la source : « %s »" % shorten(" ".join(rows[label]))))
            else:
                fields.append((key, names))
                if not any(not is_blank(v) for v in rows[label]):
                    blank.append(key)
    return fields, omitted, blank


# --------------------------------------------------------------------------------------------------------------------
# Rendu Markdown
# --------------------------------------------------------------------------------------------------------------------

def first_sentence(text):
    para = fmt(text).split("\n")[0]
    m = re.search(r"[.!?](?=\s|$)", para)
    return para[:m.end()] if m else para


def field_of_column(c):
    name = None
    for start, label in FIELDS:
        if c >= start:
            name = label
    return name


def labeled(label, value):
    """« **Libellé** : texte » si le texte tient sur une ligne, sinon le libellé puis le texte (liste ou paragraphes), comme
    labeled() de races.py."""
    blocks = md_blocks(value)
    if len(blocks) == 1 and blocks[0][0] == "p" and len(blocks[0][1]) == 1:
        return ["**%s** : %s" % (esc_inline(label), esc_inline(blocks[0][1][0]))]
    return ["**%s**" % esc_inline(label), ""] + md_text(value)


def spell_notes(page, by_ref, where):
    """[(ligne du sort, colonne, nom du sort, en-tête de la colonne, [(genre, texte)])] dans l'ordre des sorts puis des colonnes."""
    out = []
    for ref in sorted(by_ref, key=split_ref):
        r, c = split_ref(ref)
        spell = next((s for s in page["spells"] if s["row"] <= r < s["row"] + SPELL_HEIGHT), None)
        if spell is None or c < COL_SPELL_FIRST:
            raise ValueError("%s : le commentaire de la cellule %s est hors de la table des sorts (colonnes AL à BR, sorts de %d "
                             "lignes) : aucune place prévue dans la page" % (where, ref, SPELL_HEIGHT))
        name = norm_ws(spell["values"][1])
        if not name:
            raise ValueError("%s : le sort de la cellule %s n'a pas de nom : le commentaire ne peut pas lui être rattaché"
                             % (where, ref))
        out.append((spell["row"], c, name, field_of_column(c), by_ref[ref]))
    out.sort(key=lambda t: (t[0], t[1]))
    return out


def render(cfg, page, by_ref, relations=()):
    """relations : [(clé, noms courts)] émises dans le frontmatter après le nom court (voir relation_fields)."""
    L = []
    summary_source = page["intro"]
    L.append("---")
    L.append("title: " + yaml_str(cfg["titre"]))
    L.append("aliases: " + yaml_list(cfg["aliases"]))
    L.append("tags: " + yaml_list(cfg["tags"]))
    L.append("nom_court: " + yaml_str(cfg["nom_court"]))
    for key, names in relations:
        L.append("%s: %s" % (key, yaml_list(names)))
    if summary_source:
        L.append("summary: " + yaml_str(first_sentence(summary_source)))
    L.append("sources: " + yaml_list([
        "Google Sheet « %s », onglet « %s »" % (WORKBOOK, cfg.get("affiche", cfg["onglet"])), URL]))
    L.append("status: draft")
    L.append("---")
    L.append("")

    for extra in page["banner_extra"]:
        L.append("**%s**" % esc_inline(extra))
        L.append("")
    if page["intro"]:
        L.extend(md_text(page["intro"]))
        L.append("")
    if page["phys"]:
        L += ["## Description physique", ""] + md_text(page["phys"]) + [""]
    if page["explication"]:
        L += ["## Explication", ""] + md_text(page["explication"]) + [""]

    if page["data"]:
        L += ["## Données", ""]
        for label, vals in page["data"]:
            if len(vals) > 1 and any("," in v or "\n" in v for v in vals):
                raise ValueError("%s : valeurs multiples contenant une virgule" % cfg["onglet"])
            value = ", ".join(vals)
            lines = md_text(value)
            head = "- **%s** : " % esc_inline(label)
            if not lines:  # cellule vide dans la source (ligne de relation seulement, voir parse_sheet)
                L.append(head.rstrip())
                continue
            L.append(head + lines[0])
            for extra in lines[1:]:
                L.append(("  " + extra) if extra else "")
        L.append("")

    if page["hyper_rows"]:
        L += ["## Capacité Mode Hyper", ""]
        if page["hyper_header"]:
            L.append("| %s | %s |" % tuple(cell_md(h) for h in page["hyper_header"]))
            L.append("| --- | --- |")
            for label, text in page["hyper_rows"]:
                L.append("| %s | %s |" % (cell_md(label), cell_md(text)))
        else:
            for label, text in page["hyper_rows"]:
                lines = md_text(text)
                L.append("- **%s** : %s" % (esc_inline(label), lines[0]))
                L.extend(("  " + e) if e else "" for e in lines[1:])
        L.append("")

    if page["roles"]:
        L += ["## Rôles", ""] + ["- " + esc_inline(r) for r in page["roles"]] + [""]

    if page["amel_title"]:
        # titre de section = texte de la cellule D63, tel quel (majuscules, sans accents, guillemets droits)
        L += ["## " + esc_inline(page["amel_title"]), "", "| Amélioration | Effet |", "| --- | --- |"]
        for name, effect in page["amel_left"] + page["amel_right"]:
            L.append("| %s | %s |" % (cell_md(name), cell_md(effect)))
        L.append("")

    if page["spells"]:
        L += ["## Sorts", "", "| " + " | ".join(n for c, n in FIELDS) + " |", "| " + " | ".join("---" for _ in FIELDS) + " |"]
        for s in page["spells"]:
            L.append("| " + " | ".join(cell_md(v) for v in s["values"]) + " |")
        L.append("")
        notes = spell_notes(page, by_ref, cfg["onglet"])
        if notes:
            L += ["## " + SECTION_NOTES, ""]
            for _row, _col, name, field, items in notes:
                for kind, text in items:
                    L += labeled("%s de la cellule « %s » du sort « %s »" % (kind, field, name), text) + [""]

    if page["foot"]:
        L += ["## Textes des sorts de niveau 5", ""]
        for t, x in page["foot"]:  # ordre des colonnes ; un titre sans texte (cellule vide dans la source) reste seul
            L += ["### " + esc_inline(t), ""]
            if x:
                L += md_quote(x) + [""]

    if page["legend_ic"] or page["legend_items"] or page["legend_extra"]:
        L += ["## Légende", ""]
        if page["legend_ic"]:
            L += md_text(page["legend_ic"]) + [""]
        for extra in page["legend_extra"]:
            L += [esc_inline(extra), ""]
        if page["legend_items"]:
            L += ["**%s**" % LEGEND_HEADER, ""]
            for sig, desc in page["legend_items"]:
                L.append("- **%s** : %s" % (esc_inline(sig), esc_inline(desc)))
            L.append("")

    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Vérification indépendante (option --verifier, et fin de chaque exécution)
# --------------------------------------------------------------------------------------------------------------------
# Tout ce bloc recalcule les valeurs attendues DIRECTEMENT depuis les dumps JSON (cellules brutes), sans passer par
# Sheet / parse_sheet / parse_relation, puis les compare au frontmatter des pages écrites.

def fiche_headers(path):
    """Noms courts lus dans le dump de la fiche : en-têtes B1:P1 de « Accessibilité Magie » (15 colonnes contiguës)."""
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    sheet = next((s for s in data["sheets"] if s["name"] == FICHE_SHEET), None)
    if sheet is None:
        raise ValueError("%s : onglet « %s » absent" % (path, FICHE_SHEET))
    row1 = {c["c"]: c["v"] for c in sheet["cells"] if c["r"] == 1 and not is_blank(c["v"])}
    cols = sorted(c for c in row1 if c >= 2)
    if cols != list(range(2, 2 + len(cols))) or len(cols) != len(MAGIES):
        raise ValueError("%s : en-têtes B1:P1 inattendus (colonnes %s, attendu 15 colonnes contiguës à partir de B)"
                         % (FICHE_SHEET, [col_letters(c) for c in cols]))
    headers = [fmt(row1[c]) for c in cols]
    if len(set(fold(h) for h in headers)) != len(headers):
        raise ValueError("%s : en-têtes en double : %r" % (FICHE_SHEET, headers))
    return headers


def find_fiche(explicit, dump_dirs):
    if explicit:
        if not os.path.isfile(explicit):
            sys.exit("dump de la fiche introuvable : %s" % explicit)
        return explicit
    for d in dump_dirs:
        cand = os.path.join(d, "fiche-auto-v15.json")
        if os.path.isfile(cand):
            return cand
    return None


def raw_expected(raw, headers):
    """Valeurs attendues recalculées depuis les cellules brutes d'un onglet : {clé: liste de noms courts}.
    Une clé absente = la source ne donne pas de liste (ligne absente ou texte libre) : rien à émettre."""
    cells = {(c["r"], c["c"]): c["v"] for c in raw["cells"] if not is_blank(c["v"])}
    by_fold = {fold(h): h for h in headers}
    expected = {}
    for key, label in RELATIONS:
        rows = sorted(r for (r, c), v in cells.items() if c == 1 and isinstance(v, str) and v.strip() == label)
        if not rows:
            continue
        if len(rows) > 1:
            raise ValueError("%s : plusieurs lignes « %s »" % (raw["name"], label))
        values = []
        for (r, c), v in sorted(cells.items(), key=lambda kv: kv[0][1]):
            if r == rows[0] and 1 < c <= 36:
                if not isinstance(v, str):
                    raise ValueError("%s : valeur non textuelle à droite de « %s » : %r" % (raw["name"], label, v))
                values.append(v.strip())
        tokens = [t.strip() for v in values for t in re.split(CELL_SPLIT, v) if t.strip()]
        # phrase libre : le même critère que le générateur (constantes NAME_MAX_LEN, NAME_MAX_WORDS, NOT_NAME_CHARS)
        if any(len(t) > NAME_MAX_LEN or len(t.split()) > NAME_MAX_WORDS or any(ch in t for ch in NOT_NAME_CHARS)
               for t in tokens):
            continue
        if [fold(t) for t in tokens] == [NONE_WORD] or not tokens:  # « Aucune » ou cellule vide
            expected[key] = []
            continue
        for t in tokens:
            if fold(t) not in by_fold:
                raise ValueError("%s : %r (ligne « %s ») ne correspond à aucune magie" % (raw["name"], t, label))
        names = [by_fold[fold(t)] for t in tokens]
        if len(set(names)) != len(names):
            raise ValueError("%s : doublon dans la ligne « %s » : %r" % (raw["name"], label, tokens))
        expected[key] = names
    return expected


def unescape_md(text):
    """Texte d'une entrée de page -> texte du classeur : échappements Markdown retirés, liens automatiques <url> rendus."""
    return re.sub(r"\\([\\`*_\[\]<~&>#+\-.)])|<(https?://[^>\s]+)>", lambda m: m.group(1) or m.group(2), text)


def page_entries(text):
    """Entrées de la section des notes d'une page écrite : ([(genre, colonne, sort, texte)], [problèmes]). Le texte est ramené à
    une ligne, sans échappements Markdown (comparaison aux espaces près)."""
    heading = "## " + SECTION_NOTES
    lines = text.split("\n")
    if heading not in lines:
        return [], []
    problems = ["section « %s » en double" % SECTION_NOTES] if lines.count(heading) > 1 else []
    entries = []
    for line in lines[lines.index(heading) + 1:]:
        if line.startswith("## "):
            break
        m = ENTRY_RE.match(line)
        if m:
            entries.append([m.group(1), unescape_md(m.group(2)), unescape_md(m.group(3)), m.group(4) or ""])
        elif entries:
            entries[-1][3] += "\n" + line
        elif line.strip():
            problems.append("texte hors d'une entrée dans la section des notes : %r" % shorten(line, 60))
    return [(g, c, n, norm_ws(unescape_md(t))) for g, c, n, t in entries], problems


def expected_comments(raw):
    """Entrées attendues pour un onglet de magie, recalculées depuis les cellules brutes du dump (sans l'analyseur de pages) :
    ([(genre, colonne, sort, texte, cellule)] dans l'ordre de la table, comptes). ValueError : un commentaire sans place."""
    tab = raw["name"]
    pos = {(c["r"], c["c"]): c for c in raw["cells"]}
    tops = sorted(r for (r, c), x in pos.items() if c == COL_SPELL_FIRST and isinstance(x["v"], (int, float))
                  and not isinstance(x["v"], bool) and SPELL_ROW_FIRST <= r <= SPELL_ROW_LAST)
    found, counts = [], dict(notes=0, threads=0, repeated=0, excluded=0)
    for cell in sorted(raw["cells"], key=lambda x: (x["r"], x["c"])):
        texts = comment_candidates(tab, cell)
        if not texts:
            continue
        r, c, ref = cell["r"], cell["c"], a1(cell["r"], cell["c"])
        if is_blank(cell["v"]):
            raise ValueError("%s : la cellule %s est vide mais porte un commentaire : disposition non gérée, il ne se rattache à "
                             "rien dans la page" % (tab, ref))
        top = max((t for t in tops if t <= r), default=None)
        if top is None or r >= top + SPELL_HEIGHT or c < COL_SPELL_FIRST:
            raise ValueError("%s : le commentaire de la cellule %s est hors de la table des sorts : aucune place prévue dans la "
                             "page" % (tab, ref))
        name = norm_ws(fmt(pos[(top, FIELDS[1][0])]["v"])) if (top, FIELDS[1][0]) in pos else ""
        if not name:
            raise ValueError("%s : le sort de la cellule %s n'a pas de nom" % (tab, ref))
        column = [label for start, label in FIELDS if start <= c][-1]
        seen = set()
        for kind, text in texts:
            counts["notes" if kind == KIND_NOTE else "threads"] += 1
            declared = EXCLUDED_COMMENTS.get((tab, ref))
            if declared and norm_ws(text) == norm_ws(declared[0]):
                counts["excluded"] += 1
            elif norm_ws(text) in seen:
                counts["repeated"] += 1
            else:
                seen.add(norm_ws(text))
                found.append((kind, column, name, norm_ws(text), ref))
    found.sort(key=lambda t: (max(x for x in tops if x <= split_ref(t[4])[0]), split_ref(t[4])[1], split_ref(t[4])[0]))
    return found, counts


def check_comments(raw, cfg, text):
    """Contrôle de couverture d'un onglet : chaque note et chaque fil du dump figure dans la page `text`, exactement une fois,
    avec son texte intégral, sous le bon sort, dans l'ordre de la table. Renvoie la liste des écarts."""
    where = cfg["onglet"]
    try:
        want, _counts = expected_comments(raw)
    except ValueError as err:
        return [str(err)]
    got, problems = page_entries(text)
    errors = ["%s : %s" % (where, p) for p in problems]
    keys = [w[:4] for w in want]
    n_want, n_got = Counter(keys), Counter(got)
    origin = {w[:4]: w[4] for w in want}
    for key in dict.fromkeys(keys):
        genre, column, name, body = key
        who = "%s de la cellule %s (sort « %s », colonne « %s ») : « %s »" % (genre, origin[key], name, column, shorten(body, 100))
        if n_got[key] < n_want[key]:
            errors.append("%s : entrée absente de la page ou altérée : %s" % (where, who))
        elif n_got[key] > n_want[key]:
            errors.append("%s : entrée écrite %d fois dans la page, %d attendue(s) : %s" % (where, n_got[key], n_want[key], who))
    for key in dict.fromkeys(got):
        if key not in n_want:
            genre, column, name, body = key
            errors.append("%s : entrée de la page qui ne correspond à aucune note ni à aucun fil du dump (%s, sort « %s », colonne « %s ») "
                          ": « %s »" % (where, genre.lower(), name, column, shorten(body, 100)))
    if not errors and keys != got:
        errors.append("%s : notes et fils dans le désordre (attendu : l'ordre de la table des sorts, puis des colonnes)" % where)
    return errors


def unpublished_comments(workbook):
    """(erreurs, fils) pour les onglets du classeur que cette famille ne publie pas : une NOTE y est refusée (elle serait perdue en
    silence), les fils sont listés [(onglet, cellule, nombre)] pour une autre famille."""
    published = {cfg["onglet"] for cfg in MAGIES}
    errors, threads = [], []
    for name, raw in workbook.items():
        if name in published:
            continue
        cells = sorted(raw["cells"], key=lambda x: (x["r"], x["c"]))
        notes = [(a1(c["r"], c["c"]), fmt(c["note"])) for c in cells if not is_blank(c.get("note"))]
        if notes:
            errors.append("« %s » : onglet non publié par cette famille (magies) mais qui porte %d note(s) de cellule (%s) : une "
                          "note n'est jamais perdue en silence, à confier à l'extracteur de cet onglet" % (
                              name, len(notes), " ; ".join("%s : « %s »" % (ref, shorten(t, 40)) for ref, t in notes[:5])))
        threads.extend((name, a1(c["r"], c["c"]), len(c["threads"])) for c in cells if c.get("threads"))
    return errors, threads


def autotest():
    """Cas limites du contrat des relations (exécuté à chaque lancement ; lève AssertionError en cas d'écart)."""
    def must(cond, msg):
        if not cond:
            raise AssertionError("autotest : " + msg)

    def refused(values):
        try:
            parse_relation(values, "t")
        except ValueError:
            return True
        return False

    must(parse_relation(["Aucune"], "t") == [], "« Aucune » -> []")
    must(parse_relation([], "t") == [] and parse_relation(["  "], "t") == [], "cellule vide -> []")
    must(parse_relation(["Sang", "eau", "ESPACE/TEMPS"], "t") == ["Sang", "Eau", "Espace/Temps"],
         "une cellule par nom, casse ignorée, orthographe de l'en-tête")
    must(parse_relation(["Necromancie, potentiel illimite\nLumiere"], "t") == ["Nécromancie", "Potentiel Illimité", "Lumière"],
         "virgules, retours à la ligne, accents ignorés")
    must(parse_relation(["Toutes les magies ne peuvent pas se combiner, c'est mono magie (sauf Sang)."], "t") is None,
         "phrase libre -> None (clé omise)")
    must(refused(["Lave"]) and refused(["Sang", "Lave"]), "nom inconnu -> erreur")
    must(refused(["Espace-Temps"]), "orthographe hors en-tête -> erreur (rien n'est deviné)")
    must(refused(["Aucune", "Sang"]), "« Aucune » mêlé à un nom -> erreur")
    must(refused(["Sang", "sang"]), "doublon -> erreur")

    page = {"data": [("Santé offert", ["0.0"]), ("Résistance magique", ["Sang"]), ("Vulnérabilité magique", ["Aucune"])]}
    fields, omitted, blank = relation_fields({"onglet": "t"}, page)
    must(fields == [("resiste_a", ["Sang"]), ("vulnerable_a", [])], "relation_fields : champs")
    must([k for k, _r in omitted] == ["incompatible_avec"], "relation_fields : ligne absente -> omise")
    must(blank == [], "relation_fields : « Aucune » n'est pas une cellule vide")
    page = {"data": [("Résistance magique", ["Sang"]), ("Magie non compatible", ["Tout est dit en phrase libre."])]}
    fields, omitted, _blank = relation_fields({"onglet": "t"}, page)
    must([k for k, _r in omitted] == ["vulnerable_a", "incompatible_avec"], "relation_fields : ligne libre -> omise")
    page = {"data": [("Résistance magique", ["Sang"]), ("Vulnérabilité magique", [])]}
    fields, omitted, blank = relation_fields({"onglet": "t"}, page)
    must(fields == [("resiste_a", ["Sang"]), ("vulnerable_a", [])] and blank == ["vulnerable_a"],
         "relation_fields : cellule vide -> [] et signalée")
    try:
        relation_fields({"onglet": "t"}, {"data": [("Résistance magique", ["Sang"]), ("Résistance magique", ["Eau"])]})
        must(False, "relation_fields : ligne en double non refusée")
    except ValueError:
        pass

    # De bout en bout, sur un onglet synthétique minimal : le générateur (parse_sheet -> relation_fields) et la
    # vérification indépendante (raw_expected, qui ne lit que les cellules brutes) doivent rendre le même verdict,
    # y compris pour une cellule vide et pour une phrase libre courte sans ponctuation.
    cfg = MAGIES[1]  # Sang
    COLS = (8, 13, 18, 23)  # H, M, R, W : colonnes des valeurs d'une ligne du bloc DONNÉES

    def synthetic(values, label="Résistance magique", with_health_value=True):
        cells = [dict(r=1, c=COL_BANNER, v=cfg["titre"]), dict(r=5, c=COL_BANNER, v="DONNÉES"),
                 dict(r=6, c=1, v="Santé offert")]
        if with_health_value:
            cells.append(dict(r=6, c=8, v="0.0"))
        cells.append(dict(r=7, c=1, v=label))
        cells += [dict(r=7, c=COLS[i], v=v) for i, v in enumerate(values)]
        return {"name": "t", "cells": cells, "merged": []}

    def generated(raw):
        try:
            page = parse_sheet(Sheet(raw), cfg)
            fields, _omitted, _blank = relation_fields(cfg, page)
        except ValueError:
            return "erreur"
        return dict(fields).get("resiste_a", "omis")

    def checked(raw):
        try:
            return raw_expected(raw, SHORT_NAMES).get("resiste_a", "omis")
        except ValueError:
            return "erreur"

    cases = [
        ([], []),                                                    # cellule vide à droite du libellé
        (["Aucune"], []),
        (["Sang", "Eau"], ["Sang", "Eau"]),
        (["Sang, eau\nTerre"], ["Sang", "Eau", "Terre"]),
        (["Sang\rEau"], ["Sang", "Eau"]),                            # « \r » seul sépare aussi
        (["Toutes les autres magies"], "omis"),                      # 4 mots, sans ponctuation : phrase libre
        (["Sang", "Toutes les autres magies"], "omis"),              # un élément libre suffit
        (["Sang (sauf Eau)"], "omis"),
        (["Tout !"], "omis"),
        (["Sang Eau" + "x" * 33], "omis"),                           # 41 caractères
        (["Toutes les magies"], "erreur"),                           # 3 mots : un nom inconnu, pas une phrase libre
        (["Lave"], "erreur"),
        (["Espace-Temps"], "erreur"),
        (["Sang", "sang"], "erreur"),
        (["Aucune", "Sang"], "erreur"),
    ]
    for values, want in cases:
        raw = synthetic(values)
        got_gen, got_chk = generated(raw), checked(raw)
        must(got_gen == want, "générateur %r : %r au lieu de %r" % (values, got_gen, want))
        must(got_chk == want, "vérification %r : %r au lieu de %r" % (values, got_chk, want))
    # une cellule vide n'est tolérée que pour une ligne de relation : ailleurs, rien n'est deviné
    must(generated(synthetic(["Sang"], with_health_value=False)) == "erreur", "libellé « Santé offert » sans valeur -> erreur")
    # le rendu d'une cellule vide ne plante pas et garde le libellé
    page = parse_sheet(Sheet(synthetic([])), cfg)
    fields, _omitted, blank = relation_fields(cfg, page)
    must(blank == ["resiste_a"], "cellule vide signalée")
    must("- **Résistance magique** :\n" in render(cfg, page, {}, fields), "rendu d'une cellule vide")

    autotest_comments(must)


def autotest_comments(must):
    """Cas limites des notes et fils de cellule : lecture du dump, déduplication, exclusion, recoupement avec le classeur, aller-retour
    du Markdown (ce que le rendu écrit est ce que le contrôle de couverture relit), cas d'erreur."""
    cfg = MAGIES[1]  # Sang

    def tab(name, cells):
        return {"name": name, "merged": ["A4:AJ4", "AL4:AM6", "AL7:AM9"], "cells": [
            dict(r=1, c=COL_BANNER, v=cfg["titre"]), dict(r=4, c=1, v="Une description."),
            dict(r=4, c=38, v=1), dict(r=4, c=40, v="Éclair"), dict(r=4, c=62, v="Un effet."),
            dict(r=7, c=38, v=2), dict(r=7, c=40, v="Bouclier"), dict(r=7, c=62, v="Un autre effet.")] + cells}

    def with_comments(note=None, threads=None, name="Sang", where=(4, 62)):
        item = dict(r=where[0], c=where[1], v="x")
        if note is not None:
            item["note"] = note
        if threads is not None:
            item["threads"] = threads
        raw = tab(name, [])
        raw["cells"] = [dict(x, **{k: v for k, v in item.items() if k in ("note", "threads")})
                        if (x["r"], x["c"]) == (item["r"], item["c"]) else x for x in raw["cells"]]
        return raw

    def refused(fn, *args):
        try:
            fn(*args)
        except ValueError:
            return True
        return False

    def rendered(raw):
        page = parse_sheet(Sheet(raw), cfg)
        return render(cfg, page, comments_by_ref(raw), [])

    # aller-retour : le texte relu dans la page est le texte du classeur, aux espaces près, quels que soient les caractères
    tricky = ["Simple.", "*a* _b_ [c] <d> ~e~ \\ & &amp; fin", "> pas une citation", "# pas un titre", "- une\n- liste", "1. pas\n2) une liste",
              "voir http://exemple.org/x?a=1&b=2 ici", "a | b", "ligne\n\nautre   paragraphe", "  espaces autour  ",
              "Exemple : \n\nUn caillou\nUne dague", "`code` et **gras**", "[[Lien]] de wiki", "10% lors de neutre\n20% lors de canicule."]
    for text in tricky:
        raw = with_comments(note=text, threads=[{"text": text + " (fil)", "done": True}])
        page_text = rendered(raw)
        must(check_comments(raw, cfg, page_text) == [], "couverture : aller-retour du texte %r : %r" % (text, check_comments(raw, cfg, page_text)))
    # un texte retouché, une entrée en double, une entrée retirée, deux entrées échangées sont des écarts
    raw = with_comments(note="Première.", threads=[{"text": "Seconde."}])
    good = rendered(raw)
    must(check_comments(raw, cfg, good) == [], "couverture : page conforme")
    must(check_comments(raw, cfg, good.replace("Première.", "Première, retouchée.")), "couverture : texte retouché non vu")
    entry = "**Note de la cellule « Effets secondaires » du sort « Éclair »** : Première.\n\n"
    must(entry in good, "couverture : entrée de la note")
    must(check_comments(raw, cfg, good.replace(entry, entry + entry)), "couverture : entrée en double non vue")
    must(check_comments(raw, cfg, good.replace(entry, "")), "couverture : entrée absente non vue")
    first = entry.strip()
    second = "**Commentaire de la cellule « Effets secondaires » du sort « Éclair »** : Seconde."
    must(first + "\n\n" + second in good and check_comments(raw, cfg, good.replace(first + "\n\n" + second, second + "\n\n" + first)),
         "couverture : ordre non vu")
    must(check_comments(raw, cfg, good.replace("## " + SECTION_NOTES, "## Autre titre")), "couverture : section renommée non vue")

    # déduplication et réponses d'état
    raw = with_comments(note="Règle  précisée.", threads=[{"text": "Règle précisée.", "replies": ["Marquée comme fermée", "Rouverte"]},
                                                          {"text": "Autre."}, {"text": " Autre. "}])
    stats = {}
    must(comments_by_ref(raw, stats)["BJ4"] == [(KIND_NOTE, "Règle  précisée."), (KIND_THREAD, "Autre.")]
         and stats["repeated"] == 2, "un fil identique à la note ou à un fil précédent n'est pas répété")
    must(refused(comments_by_ref, with_comments(threads=[{"text": "?", "replies": ["Voici la règle."]}])), "réponse inattendue -> erreur")

    # exclusion : adresse ET texte exacts (Eau AN46)
    eau = tab("Eau", [])
    eau["merged"].append("AL46:AM48")
    eau["cells"] += [dict(r=46, c=38, v=3), dict(r=46, c=40, v="Eau Parfaite", threads=[
        {"text": EXCLUDED_COMMENTS[("Eau", "AN46")][0], "done": True}, {"text": EXCLUDED_COMMENTS[("Eau", "AN46")][0] + " !"}])]
    stats = {}
    must(comments_by_ref(eau, stats)["AN46"] == [(KIND_THREAD, EXCLUDED_COMMENTS[("Eau", "AN46")][0] + " !")]
         and len(stats["excluded"]) == 1, "l'exclusion tient au texte exact : le commentaire modifié est cité")
    moved = dict(eau, name="Feu")
    must(len(comments_by_ref(moved)["AN46"]) == 2, "l'exclusion tient à l'onglet")

    # cas d'erreur : cellule vide, hors de la table, sans sort, onglet non publié
    empty = tab("Sang", [dict(r=5, c=62, v="", note="Texte")])
    must(refused(comments_by_ref, empty) and expected_comments_refused(empty), "note sur une cellule vide -> erreur (générateur et contrôle)")
    outside = with_comments(note="Texte", where=(4, 1))
    page = parse_sheet(Sheet(outside), cfg)
    must(refused(render, cfg, page, comments_by_ref(outside)) and expected_comments_refused(outside),
         "note hors de la table des sorts -> erreur (générateur et contrôle)")
    errors, threads = unpublished_comments({"Sang": with_comments(note="Texte"),
                                            "Sommaire": {"name": "Sommaire", "cells": [dict(r=31, c=1, v="Règle", note="N")]}})
    must(len(errors) == 1 and "Sommaire" in errors[0] and "A31" in errors[0] and not threads, "note d'un onglet non publié -> erreur")
    errors, threads = unpublished_comments({"Statistiques": {"name": "Statistiques", "cells": [
        dict(r=27, c=60, v=1, threads=[{"text": "t"}, {"text": "u"}])]}})
    must(errors == [] and threads == [("Statistiques", "BH27", 2)], "fils d'un onglet non publié : listés, pas refusés")

    # recoupement du dump avec le classeur d'origine
    wb = {"Sang": {"name": "Sang", "cells": [dict(r=4, c=62, v="x", note="N", threads=[{"text": "T", "done": True}])]}}
    src = {"Sang": {"notes": {"BJ4": "N"}, "threads": {"BJ4": [{"text": "T", "done": True}]}}, "Vide": {"notes": {}, "threads": {}}}
    must(crosscheck_comments(wb, src) == [], "recoupement : dump conforme au classeur")
    stale = {"Sang": {"name": "Sang", "cells": [dict(r=4, c=62, v="x")]}}  # dump produit sans les commentaires
    must(len(crosscheck_comments(stale, src)) == 1 and "BJ4" in crosscheck_comments(stale, src)[0], "recoupement : dump sans notes")
    changed = {"Sang": {"name": "Sang", "cells": [dict(r=4, c=62, v="x", note="N modifiée", threads=[{"text": "T", "done": True}])]}}
    must(len(crosscheck_comments(changed, src)) == 1, "recoupement : note modifiée")
    must(len(crosscheck_comments({}, src)) == 1, "recoupement : onglet commenté absent du dump")
    must(len(crosscheck_comments(wb, dict(src, Sang={"notes": {"BJ4": "N"}, "threads": {}}))) == 1, "recoupement : fil en trop dans le dump")


def expected_comments_refused(raw):
    """Vrai si le contrôle de couverture (expected_comments, indépendant du générateur) refuse aussi cet onglet."""
    try:
        expected_comments(raw)
    except ValueError:
        return True
    return False


def read_front(path):
    """Frontmatter d'une page -> {clé: texte brut après « clé: »} ; None si absent."""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        return None
    front = {}
    for line in lines[1:lines.index("---", 1)]:
        m = re.match(r"([A-Za-z_]+): (.*)$", line)
        if not m:
            raise ValueError("%s : ligne de frontmatter inattendue : %r" % (path, line))
        if m.group(1) in front:
            raise ValueError("%s : clé de frontmatter en double : %s" % (path, m.group(1)))
        front[m.group(1)] = m.group(2)
    return front


def check_pages(sheets, headers, out_root, workbook=None):
    """Compare les pages écrites aux valeurs recalculées depuis les dumps (frontmatter, notes et fils de cellule) ; renvoie la
    liste des écarts. `workbook` : les onglets du classeur des magies (par défaut, tous ceux des dumps)."""
    errors = []
    if SHORT_NAMES != headers:
        errors.append("noms courts du script %r différents des en-têtes de « %s » %r" % (SHORT_NAMES, FICHE_SHEET, headers))
    errors.extend(unpublished_comments(sheets if workbook is None else workbook)[0])
    for cfg in MAGIES:
        slug = cfg["slug"]
        raw = sheets.get(cfg["onglet"])
        path = os.path.join(out_root, CATEGORY, slug + ".md")
        if raw is None:
            errors.append("%s : onglet %r absent du dump" % (slug, cfg["onglet"]))
            continue
        try:
            # correspondance onglet -> nom court : la bannière N1 de l'onglet se termine par un (seul) en-tête
            banner = next((fmt(c["v"]) for c in raw["cells"] if c["r"] == 1 and c["c"] == COL_BANNER), "")
            hits = [h for h in headers if fold(banner).endswith(fold(h))]
            if len(hits) != 1:
                errors.append("%s : bannière %r : en-têtes trouvés %r, attendu un seul" % (slug, banner, hits))
                continue
            expected = raw_expected(raw, headers)
            front = read_front(path)
        except (ValueError, OSError) as err:
            errors.append("%s : %s" % (slug, err))
            continue
        if front is None:
            errors.append("%s : frontmatter absent" % slug)
            continue
        want = {"nom_court": json.dumps(hits[0], ensure_ascii=False)}
        for key, _label in RELATIONS:
            if key in expected:
                want[key] = "[" + ", ".join(json.dumps(n, ensure_ascii=False) for n in expected[key]) + "]"
        got = {k: v for k, v in front.items() if k == "nom_court" or k in dict(RELATIONS)}
        if got != want:
            errors.append("%s : attendu %r, trouvé %r" % (slug, want, got))
        if hits[0] != cfg["nom_court"]:
            errors.append("%s : nom court du script %r différent de celui de la bannière %r" % (slug, cfg["nom_court"], hits[0]))
    for cfg in MAGIES:  # notes et fils de cellule : couverture complète du dump par la page
        raw = sheets.get(cfg["onglet"])
        try:
            with open(os.path.join(out_root, CATEGORY, cfg["slug"] + ".md"), encoding="utf-8") as fh:
                text = fh.read()
        except OSError:
            continue  # page absente ou illisible : déjà signalée plus haut
        if raw is not None:
            errors.extend("%s : %s" % (cfg["slug"], e) for e in check_comments(raw, cfg, text))
    return errors


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


def is_ours(path, cfg):
    """Vrai si le fichier a été produit par ce script pour cet onglet (même classeur, même onglet)."""
    try:
        with open(path, encoding="utf-8") as fh:
            head = fh.read(4000)
    except OSError:
        return False
    return URL in head and "onglet « %s »" % cfg.get("affiche", cfg["onglet"]) in head


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « magies » du wiki depuis le dump de « %s »." % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py (répétable)")
    ap.add_argument("--xlsx", help="classeur d'origine (formats de nombre ; recoupement des notes et fils du dump)")
    ap.add_argument("--sans-formats", action="store_true",
                    help="ne pas lire le .xlsx : ni formats de nombre (pourcentages) ni recoupement des notes du dump")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    ap.add_argument("--fiche", help="dump JSON de la fiche « Maverick Auto » (en-têtes de « %s » ; à défaut "
                                    "fiche-auto-v15.json à côté du dump)" % FICHE_SHEET)
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule les valeurs attendues depuis les dumps et les compare aux pages")
    args = ap.parse_args(argv)
    autotest()

    sheets = {}
    workbook = {}  # les onglets du classeur « Magie V8 » : ceux des dumps qui portent au moins un onglet de magie
    dump_dirs = []
    for path in args.dump:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        dump_dirs.append(os.path.dirname(os.path.abspath(path)))
        names = {raw["name"] for raw in data["sheets"]}
        for raw in data["sheets"]:
            sheets.setdefault(raw["name"], raw)
            if any(cfg["onglet"] in names for cfg in MAGIES):
                workbook.setdefault(raw["name"], raw)

    fiche = find_fiche(args.fiche, dump_dirs)
    if args.verifier:
        if not fiche:
            sys.exit("--verifier demande le dump de la fiche (option --fiche, ou fiche-auto-v15.json à côté du dump)")
        errors = check_pages(sheets, fiche_headers(fiche), args.out, workbook)
        for e in errors:
            print("ÉCART : " + e, file=sys.stderr)
        print("vérification : %s" % ("%d écart(s)" % len(errors) if errors else "OK (%d pages)" % len(MAGIES)))
        return 1 if errors else 0

    unpublished_errors, loose_threads = unpublished_comments(workbook)
    if unpublished_errors:  # rien n'est écrit : une note sans page ne se perd pas en silence
        for e in unpublished_errors:
            print("ERREUR : " + e, file=sys.stderr)
        return 1

    formats = {}
    if args.sans_formats:
        print("AVERTISSEMENT : --sans-formats : le .xlsx n'est pas lu, donc les formats de nombre (pourcentages) ne sont pas "
              "appliqués et les notes et fils du dump ne sont pas recoupés avec le classeur.", file=sys.stderr)
    else:
        xlsx = args.xlsx
        if not xlsx:
            for d in dump_dirs:
                cand = os.path.join(d, os.pardir, "sheets", FILE_ID, "classeur.xlsx")
                if os.path.isfile(cand):
                    xlsx = cand
                    break
        if not xlsx or not os.path.isfile(xlsx):
            sys.exit("classeur .xlsx introuvable (option --xlsx) : les formats de nombre en dépendent "
                     "(ou passer --sans-formats)")
        formats = read_number_formats(xlsx)
        try:
            source = load_xlsx_comments().read_comments(xlsx)
        except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as err:
            sys.exit("%s : lecture des commentaires impossible : %s" % (xlsx, err))
        mismatches = crosscheck_comments(workbook, source)
        if mismatches:
            for e in mismatches:
                print("ERREUR : " + e, file=sys.stderr)
            return 1

    out_dir = os.path.join(args.out, CATEGORY)
    os.makedirs(out_dir, exist_ok=True)
    other_titles = {}
    by_slug = {cfg["slug"]: cfg for cfg in MAGIES}
    for sub in sorted(os.listdir(args.out)):
        sub_path = os.path.join(args.out, sub)
        if not os.path.isdir(sub_path):
            continue
        for name in sorted(os.listdir(sub_path)):
            full = os.path.join(sub_path, name)
            mine = sub == CATEGORY and name[:-3] in by_slug and is_ours(full, by_slug[name[:-3]])
            if name.endswith(".md") and not mine:
                title = read_title(full)
                if title:
                    other_titles[fold(title)] = full

    written = []
    problems = []
    report = []
    empty_cells = []
    stats = {}
    for cfg in MAGIES:
        raw = sheets.get(cfg["onglet"])
        if raw is None:
            problems.append("onglet absent du dump : %r" % cfg["onglet"])
            continue
        try:
            sh = Sheet(raw, formats.get(cfg["onglet"]))
            page = parse_sheet(sh, cfg)
            check_all_consumed(sh)
            by_ref = comments_by_ref(raw, stats)
            fields, omitted, blank = relation_fields(cfg, page)
            body = render(cfg, page, by_ref, fields)
        except ValueError as err:
            problems.append(str(err))
            continue
        gaps = check_comments(raw, cfg, body)  # couverture : rien n'est écrit si une note ou un fil manque à la page
        if gaps:
            problems.extend("%s : %s" % (cfg["slug"], g) for g in gaps)
            continue
        if fold(cfg["titre"]) in other_titles:
            problems.append("titre déjà utilisé par %s : %r" % (other_titles[fold(cfg["titre"])], cfg["titre"]))
            continue
        target = os.path.join(out_dir, cfg["slug"] + ".md")
        if os.path.exists(target) and not is_ours(target, cfg):
            problems.append("fichier existant qui n'est pas de cette famille, non écrasé : %s" % target)
            continue
        with open(target, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(body)
        written.append(target)
        report.extend((cfg["slug"], key, reason) for key, reason in omitted)
        empty_cells.extend((cfg["slug"], key) for key in blank)
        print("écrit %s (%d sorts, %d cellules avec commentaires)" % (target, len(page["spells"]), len(by_ref)))

    print("RAPPORT relations entre magies : %d clé(s) omise(s) faute de liste dans la source%s"
          % (len(report), " :" if report else ""))
    for slug, key, reason in report:
        print("  %s : %s omis (%s)" % (slug, key, reason))
    if empty_cells:  # absent du rapport quand aucune cellule n'est vide (cas du classeur actuel)
        print("RAPPORT relations lues comme [] faute de valeur : %d clé(s) (cellule vide à droite du libellé) :"
              % len(empty_cells))
        for slug, key in empty_cells:
            print("  %s : %s = [] (cellule vide dans la source)" % (slug, key))

    if stats:
        written_threads = stats["threads"] - stats["repeated"] - len(stats["excluded"])
        print("RAPPORT notes et fils de cellule des onglets de magie : %d note(s) et %d fil(s) lus dans le dump ; %d note(s) et %d "
              "fil(s) écrits ; %d fil(s) identique(s) à la note de leur cellule (ou à un fil précédent), non répété(s) ; "
              "%d fil(s) écarté(s)" % (stats["notes"], stats["threads"], stats["notes"], written_threads, stats["repeated"],
                                         len(stats["excluded"])))
        for tab, ref, text, reason in stats["excluded"]:
            print("  écarté : %s %s « %s » (%s)" % (tab, ref, shorten(text, 60), reason))
    if loose_threads:
        print("RAPPORT fils de commentaires d'onglets non publiés par cette famille, à confier à une autre (leurs notes, s'il y en "
              "avait, arrêteraient le script) : %d fil(s) :" % sum(n for _tab, _ref, n in loose_threads))
        for tab, ref, n in loose_threads:
            print("  %s %s : %d fil(s)" % (tab, ref, n))

    for p in problems:
        print("ERREUR : " + p, file=sys.stderr)
    if fiche and not problems:
        errors = check_pages(sheets, fiche_headers(fiche), args.out, workbook)
        for e in errors:
            print("ÉCART : " + e, file=sys.stderr)
        print("vérification : %s" % ("%d écart(s)" % len(errors) if errors else "OK (%d pages)" % len(MAGIES)))
        problems.extend(errors)
    elif not fiche:
        print("AVERTISSEMENT : dump de la fiche introuvable (option --fiche) : noms courts non recoupés avec les "
              "en-têtes de « %s » et pages non vérifiées." % FICHE_SHEET, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
