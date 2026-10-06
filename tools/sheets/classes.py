#!/usr/bin/env python3
"""Familles « classes » et « capacités de classe » : une page du wiki par classe du classeur « Classe Maverick V7 », une
page par capacité de classe, plus le glossaire des objets.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/classes.py --dump <classes-v7.json> [--dump <autre.json>] \
        [--xlsx <classeur.xlsx> | --sans-liens] --out client/src/content/wiki
    python3 -I tools/sheets/classes.py --dump <classes-v7.json> [--xlsx <classeur.xlsx> | --sans-liens] \
        --out client/src/content/wiki --verifier

Régénération complète, notes de cellule comprises (le dump vient de xlsx_to_json.py ; corrections avant l'extracteur) :

    python3 -I tools/sheets/corriger-dump.py appliquer --ledger tools/sheets/corrections.json --dump classes-v7.json \
        --out classes-v7.corrige.json
    python3 -I tools/sheets/classes.py --dump classes-v7.corrige.json --xlsx classeur.xlsx --out client/src/content/wiki
    python3 -I tools/sheets/classes.py --dump classes-v7.corrige.json --xlsx classeur.xlsx --out client/src/content/wiki --verifier

Source : Google Sheet « Classe Maverick V7 » (fileId 1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs), converti en JSON par
tools/sheets/xlsx_to_json.py (format décrit dans ce script), puis corrigé de ses coquilles par tools/sheets/corriger-dump.py
(docs/sources.md). Les cellules sont une donnée non fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour le
Markdown). Rien n'est inventé : valeurs, noms, coquilles et formulations sont ceux des cellules.
Le dump porte les valeurs ET les notes de cellule (champ `note`) ; le classeur .xlsx d'origine sert aux hyperliens de cellule, que
le dump ne contient pas, et à recouper les notes du dump (voir « Notes de cellule » et « Hyperliens de cellule »).

Fichiers écrits (et seulement ceux-là) :
    <out>/classes/<slug>.md                          une page par classe (39 onglets de classe), sans tableaux d'aptitudes
    <out>/capacites/<slug de la classe>-<slug du nom>.md   une page par capacité : une par cellule « Lvl N » (660 en V7)
    <out>/ressources/objets-de-depart-des-classes.md  le glossaire des objets d'inventaire de départ (onglet Sommaire)
Le script refuse d'écraser un fichier qui n'est pas issu de ce classeur, refuse un titre déjà pris par une page d'une autre
famille, n'efface rien (une page de ces dossiers qu'il ne produit plus est signalée « orphelin », jamais supprimée).

--verifier : n'écrit rien. Relit le dump par un code qui ne partage ni l'analyse des blocs d'aptitude ni la dérivation des
groupes (il part des seules positions de cellules : ligne, colonne, bannière) et contrôle les pages sur disque :
  (1) nombre de pages de capacités = nombre de cellules « Lvl N » des onglets de classe, au total et par classe ;
  (2) nom, type, effet, note de cellule, niveau, ligne, nature, tags, sources de chaque cellule dans SA page ;
  (2 bis) notes de cellule : relues dans le dump par un code propre au vérificateur (champ `note` de chaque cellule), placées sur
      le bloc d'effet qu'elles commentent par la seule géométrie des cellules fusionnées, puis comparées aux pages : chaque note est
      écrite exactement une fois, dans la page prévue, avec son texte intégral, et nulle part ailleurs (ni autre fiche, ni page de
      classe, ni glossaire) ; le total (dans le dump / rattachées à un bloc d'effet / écrites) doit être le même ; puis
      REJEU DES CAS D'ERREUR sur des copies en mémoire du dump et des pages (rien n'est écrit, les vrais fichiers ne sont pas
      touchés) : note sur une cellule vide, dans un onglet non publié (« Combo stat »), dans le Sommaire, non placée (hors d'un
      bloc d'effet), fil de commentaires, note qui n'est pas un texte, et, sur les pages, note retirée, dupliquée, tronquée ou
      écrite sur une autre fiche : chacun doit être refusé, par le script ET par le recalcul indépendant, avec un message ;
  (2 ter) avec le classeur .xlsx (pas avec --sans-liens) : les notes et les fils du dump sont, onglet par onglet, ceux du classeur
      (mêmes adresses : une note perdue par le dump n'est pas vue par (2 bis), qui compare les pages au dump) ; deux cas sont
      rejoués en mémoire (une note du classeur perdue par le dump, un fil du classeur que le dump n'a pas) ;
  (3) groupes de choix recalculés depuis les positions, comparés à `choix_exclusif_avec` de chaque page (symétrie, même
      classe, même niveau, même spécialité - sauf entre les deux cartouches de spécialité d'une même ligne, qui s'excluent
      justement parce que leurs spécialités diffèrent -, ids existants, ordre de gauche à droite) ;
  (4) Barde et Archimage comparés EN CLAIR à la liste lue sur les captures de la feuille (constante EXPECTED), plus des
      sélections de test (SELECTIONS : les exemples du propriétaire, un Ménestrel qui a « Nouvel accord » ne peut pas prendre
      « Écho », etc.) ; un de ces onglets absent du dump (classeur de test) n'est pas contrôlé, et c'est dit ;
  titres et identifiants uniques dans tout le wiki, suffixes seulement en cas de doublon ; pages de classes sans tableaux
  d'aptitudes mais avec tout le reste du classeur (le texte de chaque autre cellule doit s'y retrouver) ;
  (5) aucune cellule non reconnue (le script s'arrête sur ce cas), rôle décidable pour chaque capacité, anomalies de
      disposition et observations de noms coupés identiques à celles du script ;
  (6) pages sur disque identiques à celles que le script écrirait (une seconde exécution ne change rien).

Onglets lus
  * « Sommaire » : un tableau de liens à six colonnes, chacune titrée par une catégorie (« Classe Physique Corps à Corps »,
    « Classe Physique Distance », « Classe Magique », « Classe Hybride », « Classe Hybride Animal », « Classe spéciale »)
    sous laquelle les classes sont listées ; une note sous « Classe Magique » (« Octroie 4 AM de base par classe
    magique ») ; une phrase d'usage du tableau (A17, « Il vous suffit de cliquer… ») : décision de ne pas la publier, c'est
    une consigne d'usage des liens cliquables internes du classeur (sans règle ni lore) ; le script l'affiche à chaque
    exécution comme « non publié » ; et, sous l'intitulé « OBJETS DES INVENTAIRES DE DEPART », une seule grande cellule
    fusionnée qui contient le glossaire (un objet par paragraphe, « nom : description »).
  * un onglet par classe (nom de l'onglet = nom dans le Sommaire).
  * « Combo stat » (statistiques d'usage des classes) n'est PAS publié.

Structure d'un onglet de classe (gabarit « Guerrier », blocs en cellules fusionnées lus par leur cellule en haut à gauche ;
le script s'appuie sur les libellés, les plages fusionnées et les colonnes, pas sur des numéros de ligne figés) :
  * N1 : bannière avec le nom de la classe en majuscules (décorative, contrôlée contre le nom de l'onglet) ;
  * « Don de départ » (A2) : trois valeurs Santé, Chakra, Barrière (libellé en A, valeur 4 colonnes plus loin), puis
    « Maîtrise Arme » et « Maîtrise Armures » (libellé fusionné, texte dans le bloc juste dessous) ;
  * « Inventaire de départ » (G2), « Arme de départ » (G6), « Armure de départ » (G10), même disposition ;
  * « CHOSE A SAVOIR » (colonne Z, ligne 1 ou 2) : texte libre, présent dans certaines classes seulement ;
  * colonne P : capacités de la classe (Lvl 1, Lvl 5, Lvl 20) ;
  * ligne 17 : deux bannières de spécialité en majuscules (A17 et X17) ; sous chacune, le cartouche « Lvl 10 » qui porte
    le nom de la spécialité, puis des lignes de capacités côte à côte (Lvl 10, 15, 20) ;
  * colonnes AL/AM et suivantes : textes de description (titre sur une ligne, texte dans le bloc dessous) : le premier est
    celui de la classe, les suivants ceux des sous-classes dans l'ordre des bannières ;
  * une « capacité » est toujours : cellule « Lvl N » (fusionnée sur 2 colonnes), nom 2 colonnes plus loin, bloc d'effet
    juste dessous, puis une cellule de type (Passif, Actif, Réaction, Variable…) sous le bloc d'effet.
Variantes : Archimage n'a pas de bannières : deux capacités « Lvl 10 » côte à côte (J18 et U18), puis trois colonnes
(Lvl 10, 15, 20 de haut en bas, colonnes G, O et W) et, en colonne P, ses capacités de classe ; Mage Bleu ajoute, sous ses
capacités, un tableau sans titre de 14 lignes (libellé en A, texte en G) ; Archer et Arbalètrier ont leurs descriptions une
colonne plus à gauche (AL) ; Grenadier n'en a aucune ; Tueur, Mage Bleu, Archer (Grand Archer), Anansi et Goleois ont des
titres de description sans texte (le titre est alors publié seul). Le script s'arrête avec une erreur si une cellule non
vide n'est pas reconnue : rien n'est perdu en silence.

Pages de classes : description, « Chose à savoir », don de départ, maîtrises, inventaire, arme et armure de départ, titre et
description de chaque sous-classe (bannière), tableau annexe de Mage Bleu. Les capacités n'y figurent plus (ni tableau
« Aptitudes de la classe », ni tableaux de sous-classe, ni « Cartouches » et colonnes de l'Archimage, ni note de
disposition) : elles sont sur leurs fiches, et le site les affiche à partir de celles-ci.

RÈGLE DE LECTURE DE LA MISE EN PAGE (confirmée par le propriétaire et par les captures de la feuille ; elle seule décide du
rôle de chaque capacité, voir derive_capacities) :
  * colonne P : capacités de la CLASSE, reçues sans choix (nature « classe ») ;
  * sous chaque bannière de spécialité (ligne 17) : le cartouche seul sur sa ligne qui porte le nom de la spécialité
    (« Danseur », « Ménestrel ») = la spécialité elle-même (nature « specialite ») ; les cartouches de spécialité d'une même
    ligne sont exclusifs entre eux ; puis des lignes de capacités côte à côte (Lvl 10, 15, 20) : TOUTES les capacités
    d'une même ligne d'une même bannière s'excluent mutuellement, une seule au choix (nature « choix ») ;
  * choisir une spécialité exclut toutes les capacités de l'autre : c'est la clé `specialite` (valeurs différentes dans une
    même classe) qui le porte, pas `choix_exclusif_avec`, qui ne relie que des capacités d'une même ligne ;
  * Archimage (pas de bannières) : une ligne de 2 ou 3 capacités = un groupe de choix (Élémentaliste/Occultiste ; Création
    vivante/Tempus Figus/Obédience ; Moissonneur/Rituel Interdit/Pacte Noire ; Choix/Caméléon/Adaptation) ; une capacité
    seule sur sa ligne est reçue sans choix (nature « classe »).
  Exemple, Barde de spécialité Ménestrel : peut avoir Ménestrel, Nouvel accord, Balade guerrière, Exaltation et Chant double ;
  pas Danseur ni ses capacités, ni Écho s'il a Nouvel accord, ni Amplification s'il a Balade guerrière, ni Touérk ! s'il a
  Exaltation. Le script ne décide jamais d'un rôle par supposition : une première ligne de bannière qui ne porte pas
  exactement un cartouche, ou une ligne à une seule capacité sous une bannière, arrête le script (ValueError).

Pages de capacités (capacites/<slug>.md) : frontmatter (listes YAML en ligne), puis l'effet tel qu'écrit.
    title      « <Nom> (<Classe>) » : nom de la capacité tel qu'écrit (aux espaces de bord près), nom de l'onglet (sans le
               suffixe « (classe) ») ; si sa clé de wiki (text.mjs#normalize) est déjà prise par une autre capacité ou par
               une page de classe, « , niveau N » est ajouté
    aliases    []
    tags       ["capacité de classe", "<classe en minuscules>", "<spécialité en minuscules si elle existe>"]
    summary    l'effet entier s'il tient sur une ligne de 120 caractères au plus, sinon sa première phrase ; si la première
               ligne n'est qu'une étiquette entre parenthèses (« (Rage) », « (Posture Focus) », « (Contre Neutre) »...) et que
               l'effet est sur la ligne suivante, l'étiquette suivie de la première phrase de cette ligne (extrait littéral,
               rien d'ajouté) ; clé omise si l'effet est vide
    classe     id de la page de la classe (« classes/barde »)
    specialite bannière de spécialité telle qu'écrite, aux espaces de bord près (« MÉNESTREL » ; la bannière de l'Orios est
               écrite « VA-T-EN GUERRE » avec une espace finale dans la cellule : elle est retirée, comme pour tout texte de cellule
               et pour l'étiquette qui en est tirée) ; clé omise pour une capacité de classe et pour l'Archimage
    niveau     entier (« Lvl 10 » -> 10)
    nature     classe (colonne P, ou seule sur sa ligne chez l'Archimage) | specialite (le cartouche qui porte le nom de la
               spécialité) | choix (membre d'une ligne d'au moins 2 capacités)
    rang       position de gauche à droite dans son groupe de choix, c'est-à-dire parmi les capacités de la même ligne SOUS LA
               MÊME BANNIÈRE (1 = la plus à gauche : Nouvel accord, à droite de la ligne 29 du Barde, a le rang 1 et Écho le rang 2,
               pas 3 et 4 ; Perroquet et Nouvel accord ont chacun le rang 1) ; cartouches de spécialité : de gauche à droite sur leur
               ligne ; nature classe : ordre de haut en bas puis de gauche à droite. `ligne` est le numéro de la ligne de l'onglet,
               commun aux deux bannières : (ligne, rang, specialite) identifie une capacité
    ligne      numéro de la ligne de la cellule « Lvl N » dans l'onglet (ordonne les groupes de haut en bas comme la feuille)
    type_capacite  cellule de type telle qu'écrite ; clé omise si le classeur n'en donne pas
    choix_exclusif_avec  ids (capacites/<slug>) des AUTRES capacités du même groupe, de gauche à droite ; symétrique ; clé
               omise si la capacité n'est dans aucun groupe. Les cartouches de spécialité d'une même ligne forment un
               groupe de 2 (constante CARTOUCHES_EXCLUSIFS_DANS_CHOIX ; False les laisse sans groupe)
    sources    libellé « Google Sheet « Classe Maverick V7 », onglet « <Classe> » » et URL du classeur ; status : draft
  Corps : l'effet (retours à la ligne et listes « - » conservés, mêmes règles d'échappement Markdown que le reste du script),
  puis la note de cellule éventuelle (« Note de cellule : <texte> », voir « Notes de cellule ») et rien d'autre : l'exclusivité et
  les liens sont affichés par le site à partir du frontmatter.
  Slug : <slug de la classe>-<slug du nom> ; si deux capacités le partagent (ou si le nom ne contient ni lettre ni chiffre),
  -<niveau> est ajouté, puis -<rang> si cela ne suffit pas ; les collisions résolues sont listées à chaque exécution.

Anomalies de disposition : listées à chaque exécution (« anomalie de disposition : nature | onglet | cellules »), jamais
résolues par une supposition. Natures détectées : bannière sans capacité ; groupe de taille inattendue (2 sous une bannière,
2 ou 3 chez l'Archimage) ; niveaux différents dans un groupe ; bannières sur des lignes différentes ; cartouches de
spécialité sur des lignes différentes ; nom de cartouche différent de la bannière ; nom de cartouche qui ne diffère de la
bannière que par l'accent (la casse est toujours ignorée : les bannières sont en capitales). Observé dans la version V7 du
classeur : Mercenaire!AA22 (bannière « CHASSEUR DE PRIMES », cartouche « Chasseur prime ») ; Parleur!AA22 (« ÉLOQUENT » /
« Eloquent ») et Arbalètrier!D22 (« GRAND ARBALETRIER » / « Grand arbalètrier ») ne diffèrent que par l'accent ; aucune autre.
Chaque page garde le nom de son cartouche dans son titre et la bannière telle qu'écrite (espaces de bord exceptés) dans
`specialite`. Collisions de noms V7 : Goleois « Chant . », « Chant .. », « Chant ... » (même slug, même clé de titre :
-10/-15/-20 et « , niveau N ») et Grenadier « ... ² » (nom sans lettre ni chiffre : slug grenadier-20 ; sa clé de titre est
celle de la classe Grenadier : « , niveau 20 »).

Observations sur les noms coupés (« observation : nature | onglet | cellules », puis un bilan par nature) : un nom qui se
termine par une suite (deux points ou plus, « … », un point isolé) suivi, sur la même ligne de l'onglet, d'une cellule dont le
nom en commence une (« Tenir ... » / « ... ou charger ? ») est une paire. Chaque moitié a son propre effet et son propre type :
le script en fait deux capacités, exclusives comme toute capacité d'une même ligne, et ne décide pas à la place du propriétaire
si ces deux moitiés n'en font qu'une. V7 : 33 paires dans un même groupe de choix (Arbalètrier 4, Flagelleur 1, Frappeur 1,
Goleois 6, Grenadier 4, Lanceur 1, Lancier 2, Maclier 3, Mage Rouge 1, Mage Vert 3, Moine 4, Tueur 1, Voleur 2) ; 1 paire à
cheval sur deux bannières (Flagelleur!H43 « 50 Nuances ... » dans SADIQUE et X43 « ... Encore plus ! » dans MASOCHISTE : non
exclusives par la ligne, mais déjà exclusives par le choix de spécialité) ; 3 capacités de classe dont le nom finit par « … »
sans cellule voisine qui le reprenne (Martiale!P11 « Mon arme … », Moine!P4 « Reste en vie … » et Moine!P11 « Fidélité … »).

Notes de cellule : une note est le petit commentaire jaune d'une cellule (champ `note` de la cellule du dump, même sens que dans
tools/sheets/sheets_api_to_json.py ; une cellule vide qui porte une note y est gardée avec v = ""). Elle précise parfois une règle :
elle est citée telle quelle (aux espaces et retours à la ligne de bord près), jamais interprétée, jamais corrigée. Place prévue : à la
suite de l'effet de la capacité dont elle commente le bloc d'effet, sous la forme « Note de cellule : <texte> » (retours à la
ligne et listes « - » conservés), la note étant sur la cellule en haut à gauche du bloc d'effet (c'est le cas des 43 notes de la
version V7 : une par fiche, Cuirassé!P5, Martiale!D23, Mage!X30…). Rendu des 660 fiches inchangé par rapport à la lecture
directe du .xlsx qui était faite avant. Le script s'ARRÊTE, sans rien écrire, sur : une note sur une cellule vide (y compris une cellule
d'une plage fusionnée autre que celle en haut à gauche) ; une note dans un onglet qu'il ne publie pas (« Combo stat ») ou qui n'a pas
de place pour elle (« Sommaire ») ; une note hors d'un bloc d'effet de capacité (nom, niveau, type, bannière, don de départ… :
« sans place prévue ») ; une note qui n'est pas un texte ; un fil de commentaires (champ `threads`). Une note blanche n'est pas une note.
Contrôle de couverture (check_note_coverage, à chaque génération) : chaque note du dump figure exactement une fois, avec son texte
intégral, dans la fiche prévue, et dans aucune autre page ; les totaux (dans le dump, placées, écrites) sont affichés
(« notes de cellule : 43 dans le dump, 43 placées, 43 écrites ») et doivent être égaux.
Recoupement avec le classeur .xlsx (crosscheck_notes, avant toute écriture ; --verifier : contrôle (2 ter)) : le contrôle de
couverture compare les pages au dump, il ne peut donc pas voir une note que le DUMP a perdue (ancien xlsx_to_json.py, dump copié
d'un autre classeur) : la fiche serait réécrite sans elle. Quand le classeur est donné (--xlsx, ou trouvé à côté du dump), ses notes
et ses fils de commentaires sont lus par le lecteur de xlsx_to_json.py (tools/sheets/xlsx_comments.py) et comparés au dump, onglet
par onglet (publié ou non), adresse par adresse (notes non blanches ; fils) : le moindre écart arrête le script, qui n'écrit rien
(« notes du classeur absentes du dump : A37 »). Les textes ne sont comparés (aux espaces près) qu'à titre d'avertissement : le
registre des corrections (champ « note ») peut en retoucher un ; c'est la note du dump qui est citée. Avec --sans-liens, aucun
classeur n'est lu : les notes ne sont pas recoupées (avertissement sur la sortie d'erreur).

Hyperliens de cellule : le dump ne les contient pas ; ils sont lus directement dans le .xlsx d'origine (zipfile + xml, sans openpyxl),
qui ne sert par ailleurs qu'au recoupement des notes (ci-dessus). L'option --xlsx donne le chemin du classeur ; à défaut le script le
cherche à côté du dump (<dossier du dump>/../sheets/<fileId>/classeur.xlsx). Introuvable ou illisible : erreur, sauf --sans-liens
(exclusive de --xlsx ; elle écarte les hyperliens ET le recoupement : la page de Mage Bleu perd alors la ligne « Lien hypertexte… »,
à n'utiliser que sur un classeur de test). Les hyperliens externes de cellule
(Mage Bleu!Z3, « CHOSE A SAVOIR », vers le classeur des familiers) sont rendus sous le texte de leur cellule :
« Lien hypertexte attaché à la cellule Z3 dans le classeur d'origine : <url> » (même formule que ressources/familiers) ; un
hyperlien externe qui ne tombe sur aucun bloc connu arrête le script. Les 39 hyperliens internes du Sommaire (un par
classe, vers son onglet) sont de la navigation propre au classeur : non publiés ; un hyperlien interne hors du Sommaire
arrête le script. (Si xlsx_to_json.py recopie un jour les hyperliens dans le dump, --xlsx deviendra inutile.)

Titres : le titre d'une page de classe est le nom de l'onglet. Exception : les 13 classes de la catégorie « Classe Hybride
Animal » portent le nom d'une race jouable (Orios, Fenrir…) ; leur titre prend le suffixe « (classe) » pour rester unique dans
le wiki (leur slug reste le nom seul, dans classes/). Le script refuse un titre déjà porté par une page d'une autre famille.
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

WORKBOOK = "Classe Maverick V7"
FILE_ID = "1K9IX0z_w-4IJt9oiq1D9AE4NVjTPZIHEHCWBHqOkMOs"
URL = "https://docs.google.com/spreadsheets/d/%s/edit" % FILE_ID
CATEGORY = "classes"
CAP_CATEGORY = "capacites"
CAP_TAG = "capacité de classe"
# Les cartouches de spécialité d'une même ligne (« Danseur » / « Ménestrel ») s'excluent : True les relie par
# choix_exclusif_avec (comme les autres capacités d'une même ligne) ; False ne laisse que la clé `specialite` les distinguer.
CARTOUCHES_EXCLUSIFS_DANS_CHOIX = True
# Natures d'anomalie et d'observation (libellés partagés avec le vérificateur, qui recalcule les listes par son propre code)
ANOM_CARTOUCHE_NOM = "nom de cartouche différent de la bannière"
ANOM_CARTOUCHE_ACCENT = "nom de cartouche écrit autrement que la bannière (accent seulement)"
OBS_PAIRE_MEME_GROUPE = "nom coupé sur deux cellules d'un même groupe de choix (exclusives)"
OBS_PAIRE_GROUPES = "nom coupé sur deux cellules de groupes de choix différents (non exclusives par la ligne)"
OBS_FIN_SEULE = "nom qui se termine par une suite sans cellule voisine qui la reprend"
OBS_DEBUT_SEUL = "nom qui commence par une suite sans cellule voisine qui la précède"
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


def spelling(text):
    """Graphie sans la casse mais avec les accents, espaces normalisés (« Ménestrel » = « MÉNESTREL », ≠ « Menestrel »)."""
    return re.sub(r"\s+", " ", str(text).casefold()).strip()


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
# Hyperliens de cellule (lus dans le .xlsx : le dump ne les contient pas ; les notes, elles, viennent du dump)
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


def read_links(xlsx_path):
    """{onglet: {ref: url}} : hyperliens externes de cellule lus dans le .xlsx.

    Les hyperliens internes (attribut `location`, sans cible externe) du Sommaire sont ignorés (navigation du classeur) ;
    un hyperlien interne ailleurs, ou un hyperlien externe sur le Sommaire, lève une erreur : rien n'est perdu en silence.
    """
    result = {}
    with zipfile.ZipFile(xlsx_path) as zf:
        workbook = _xml(zf, "xl/workbook.xml")
        rels = {r.get("Id"): r.get("Target") for r in _xml(zf, "xl/_rels/workbook.xml.rels")}
        for sheet in workbook.find("{%s}sheets" % NS_MAIN):
            name = sheet.get("name")
            path = posixpath.normpath(posixpath.join("xl", rels[sheet.get("{%s}id" % NS_REL)]))
            rel_path = posixpath.join(posixpath.dirname(path), "_rels", posixpath.basename(path) + ".rels")
            targets = {}
            if rel_path in zf.namelist():
                for rel in _xml(zf, rel_path):
                    if rel.get("Type").rsplit("/", 1)[-1] == "hyperlink":
                        if rel.get("TargetMode") != "External":
                            raise ValueError("onglet %r : relation d'hyperlien non externe : %r" % (name, rel.get("Target")))
                        targets[rel.get("Id")] = rel.get("Target")
            links = {}
            for hl in _xml(zf, path).iter("{%s}hyperlink" % NS_MAIN):
                rid = hl.get("{%s}id" % NS_REL)
                ref = hl.get("ref").split(":")[0]
                if rid is None:
                    if name != SUMMARY_SHEET:
                        raise ValueError("onglet %r : hyperlien interne en %s non géré par ce script" % (name, ref))
                    continue
                if name == SUMMARY_SHEET:
                    raise ValueError("onglet %r : hyperlien externe en %s non géré par ce script" % (name, ref))
                url = targets[rid]
                if re.search(r"[\s<>]", url):
                    raise ValueError("onglet %r : URL d'hyperlien inattendue en %s : %r" % (name, ref, url))
                links[ref] = url
            result[name] = links
    return result


def load_xlsx_comments():
    """tools/sheets/xlsx_comments.py (le lecteur de xlsx_to_json.py), chargé par son chemin : `python3 -I` n'ajoute pas le dossier du
    script à sys.path."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "xlsx_comments.py")
    spec = importlib.util.spec_from_file_location("xlsx_comments", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def same_words(text):
    """Texte comparable : espaces, tabulations et retours à la ligne ramenés à une espace (un classeur de Google et son dump ne les
    portent pas toujours à l'identique)."""
    return " ".join(str(text).split())


def read_xlsx_comments(xlsx_path):
    """-> (commentaires du classeur {onglet: {"notes": {ref: texte}, "threads": {ref: [fil]}}}, None) ou (None, message d'erreur) :
    même lecteur que xlsx_to_json.py (xlsx_comments.read_comments), qui ne fait confiance à rien dans le classeur."""
    try:
        return load_xlsx_comments().read_comments(xlsx_path), None
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError) as err:
        return None, "classeur %s : lecture des commentaires impossible : %s" % (xlsx_path, err)


def crosscheck_notes(sheets, source):
    """Recoupe les notes et les fils de commentaires du dump (`sheets`) avec ceux du classeur .xlsx d'origine (`source` : résultat de
    read_xlsx_comments). -> (erreurs, avertissements, nombre de notes du classeur).

    Pourquoi : les notes sont lues dans le dump ; le contrôle de couverture compare les pages au dump, il ne voit donc pas une note
    que le dump a perdue (ancien xlsx_to_json.py, dump copié d'un autre classeur) : la fiche serait réécrite sans elle. Avec le
    classeur sous la main, on compare, pour CHAQUE onglet (publié ou non), les adresses des notes (non blanches) et des fils des
    deux côtés : tout écart est une erreur. Les textes ne sont comparés qu'à titre d'avertissement (aux espaces près) : le
    registre des corrections (champ « note ») peut en retoucher un, ce qui n'est pas une perte."""
    errors, warnings, total = [], [], 0
    for name in sorted(set(source) | set(sheets)):
        data = source.get(name, {"notes": {}, "threads": {}})
        want_notes = {ref: text for ref, text in data["notes"].items() if not is_blank(text)}
        want_threads = {ref for ref, items in data["threads"].items() if items}
        total += len(want_notes)
        got_notes, got_threads = {}, set()
        for cell in sheets[name]["cells"] if name in sheets else []:
            ref = ref_of(cell["r"], cell["c"])
            if cell.get("note") is not None and not is_blank(cell["note"]):
                got_notes[ref] = cell["note"]
            if cell.get("threads"):
                got_threads.add(ref)
        gaps = [
            ("notes du classeur absentes du dump", set(want_notes) - set(got_notes)),
            ("notes du dump absentes du classeur", set(got_notes) - set(want_notes)),
            ("fils de commentaires du classeur absents du dump", want_threads - got_threads),
            ("fils de commentaires du dump absents du classeur", got_threads - want_threads),
        ]
        gaps = ["%s : %s" % (label, ", ".join(sorted(refs, key=split_ref))) for label, refs in gaps if refs]
        if gaps:
            errors.append("onglet « %s » : le dump ne porte pas les mêmes commentaires que le classeur .xlsx (%s) : dump produit sans "
                          "toutes les notes (ancien xlsx_to_json.py) ou depuis un autre classeur ? relancer tools/sheets/xlsx_to_json.py "
                          "sur ce classeur ; rien n'est écrit" % (name, " ; ".join(gaps)))
        changed = [ref for ref in want_notes if ref in got_notes and same_words(want_notes[ref]) != same_words(got_notes[ref])]
        if changed:
            warnings.append("onglet « %s » : le texte de la note diffère de celui du classeur en %s (retouche du registre de "
                            "corrections ? la note du dump est celle qui est citée)"
                            % (name, ", ".join(sorted(changed, key=split_ref))))
    return errors, warnings, total


# --------------------------------------------------------------------------------------------------------------------
# Notes de cellule (champ `note` du dump)
# --------------------------------------------------------------------------------------------------------------------

NOTE_LABEL = "Note de cellule : "          # début de chaque note dans le corps d'une fiche de capacité
LINK_LINE_START = "*Lien hypertexte attaché à la cellule "
COVERAGE_PREFIX = "contrôle de couverture des notes de cellule : "


def merged_range_of(raw, r, c):
    """Plage fusionnée de l'onglet brut qui contient la cellule (r, c), en notation A1, ou None."""
    for rng in raw.get("merged", []):
        r1, c1, r2, c2 = parse_range(rng)
        if r1 <= r <= r2 and c1 <= c <= c2:
            return rng
    return None


def collect_notes(sheets, class_names):
    """Notes de cellule du dump -> {onglet de classe: {adresse: texte}} (texte nettoyé par fmt : espaces de bord retirés).

    Une note est le champ `note` d'une cellule ; une note blanche n'en est pas une. ValueError (le script s'arrête, rien n'est
    écrit) sur ce qui n'a pas de place : un fil de commentaires (champ `threads`), une note qui n'est pas un texte, une note
    dans un onglet non publié (IGNORED_SHEETS) ou sans place prévue (Sommaire), une note sur une cellule vide (y compris une
    cellule d'une plage fusionnée autre que celle en haut à gauche : la note se pose sur cette dernière).
    """
    notes = {}
    for name, raw in sheets.items():
        for cell in raw["cells"]:
            ref = ref_of(cell["r"], cell["c"])
            if cell.get("threads"):
                raise ValueError("onglet « %s » : fil de commentaires en %s : non géré par ce script (aucune place prévue)"
                                 % (name, ref))
            note = cell.get("note")
            if note is None:
                continue
            if not isinstance(note, str):
                raise ValueError("onglet « %s » : la note de la cellule %s n'est pas un texte : %r" % (name, ref, note))
            if is_blank(note):
                continue
            text = fmt(note)
            if name in IGNORED_SHEETS:
                raise ValueError("onglet « %s » : note de cellule en %s (%r) dans un onglet que ce script ne publie pas"
                                 % (name, ref, text[:40]))
            if name == SUMMARY_SHEET:
                raise ValueError("onglet « %s » : note de cellule en %s (%r) : aucune place prévue pour une note dans le Sommaire"
                                 % (name, ref, text[:40]))
            if name not in class_names:
                raise ValueError("onglet « %s » : note de cellule en %s (%r) dans un onglet qui n'est pas une classe"
                                 % (name, ref, text[:40]))
            if is_blank(cell.get("v")):
                rng = merged_range_of(raw, cell["r"], cell["c"])
                raise ValueError("onglet « %s » : la cellule %s est vide mais porte une note (%r)%s"
                                 % (name, ref, text[:40],
                                    " : elle fait partie de la plage fusionnée %s, dont la note se pose sur la cellule en haut à "
                                    "gauche" % rng if rng else ""))
            notes.setdefault(name, {})[ref] = text
    return notes


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
    return dict(classes=classes, notes=notes, usage=[(ref_of(*p), fmt(cells[p])) for p in sorted(usage)],
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
                desc_pos=(dr, dc), notes=[], links=[])


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
    page["know_pos"] = None
    page["know_links"] = []   # [(ref, url)] hyperliens de la cellule du texte
    if len(know) > 1:
        raise ValueError("%s : plusieurs intitulés %r" % (sh.name, KNOW_HEADER))
    if know:
        r, c = know[0]
        head = fmt(sh.take(r, c))
        page["know_pos"] = below(sh, r, c)
        content = sh.take(*page["know_pos"])
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
    """Rattache chaque note de cellule ({adresse: texte}) au bloc d'effet de la capacité qu'elle commente : la note est sur la
    cellule en haut à gauche de ce bloc. Une note ailleurs (nom, niveau, type, bannière, don de départ…) n'a pas de place prévue :
    ValueError, rien n'est supposé. Chaque aptitude garde ses notes sous la forme [(adresse, texte)]."""
    abilities = list(page["class_abilities"]) + list(page["other_abilities"])
    for b in page["banners"]:
        abilities += b["abilities"]
    by_pos = {a["desc_pos"]: a for a in abilities}
    for ref in sorted(notes, key=split_ref):
        pos = split_ref(ref)
        if pos not in by_pos:
            raise ValueError("%s : note de cellule en %s sans place prévue (hors d'un bloc d'effet d'aptitude) : %r"
                             % (sh.name, ref, notes[ref]))
        by_pos[pos]["notes"].append((ref, notes[ref]))


def attach_links(sh, page, links):
    """Rattache les hyperliens externes de cellule au bloc de texte (CHOSE A SAVOIR) ou d'effet d'aptitude qui les porte."""
    abilities = list(page["class_abilities"]) + list(page["other_abilities"])
    for b in page["banners"]:
        abilities += b["abilities"]
    by_pos = {a["desc_pos"]: a for a in abilities}
    for ref in sorted(links, key=split_ref):
        pos = sh.top_left(*split_ref(ref))
        if page["know_pos"] is not None and pos == page["know_pos"]:
            page["know_links"].append((ref, links[ref]))
        elif pos in by_pos:
            by_pos[pos]["links"].append((ref, links[ref]))
        else:
            raise ValueError("%s : hyperlien en %s hors d'un bloc de texte reconnu : %r" % (sh.name, ref, links[ref]))


# --------------------------------------------------------------------------------------------------------------------
# Rendu
# --------------------------------------------------------------------------------------------------------------------

def first_sentence(text):
    para = fmt(text).split("\n")[0].strip()
    m = re.match(r"(.+?[.!?])(?=\s|$)", para)
    return m.group(1) if m else para


def link_note(ref, url):
    return "*Lien hypertexte attaché à la cellule %s dans le classeur d'origine :* <%s>" % (ref, url)


def text_section(L, level, heading, text, links=()):
    L += ["#" * level + " " + esc_inline(heading), ""]
    if text:
        L += md_text(text) + [""]
    for ref, url in links:
        L += [link_note(ref, url), ""]


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
        text_section(L, 2, *page["know"], links=page["know_links"])

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

    # Les capacités (colonne P, spécialités, groupes de choix) ne sont plus décrites ici : une fiche par capacité
    # dans capacites/ (voir derive_capacities). La page garde le titre et la description de chaque sous-classe.
    if page["banners"]:
        L += ["## Sous-classes", ""]
        for b in page["banners"]:
            L += ["### " + esc_inline(b["name"]), ""]
            if b["desc"]:
                text_section(L, 4, *b["desc"])
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
# Capacités : rôle, groupes de choix, une page par capacité
# --------------------------------------------------------------------------------------------------------------------

LVL_NUM_RE = re.compile(r"Lvl\s+(\d+)")
SUMMARY_SHORT = 120   # un effet d'une seule ligne d'au plus 120 caractères sert de résumé en entier


def level_number(sheet, ability):
    m = LVL_NUM_RE.fullmatch(ability["level"])
    if not m:
        raise ValueError("%s : niveau %r de la cellule %s non reconnu (attendu « Lvl N »)"
                         % (sheet, ability["level"], ref_of(ability["row"], ability["col"])))
    return int(m.group(1))


def cells_of(group):
    return ", ".join(ref_of(c["row"], c["col"]) for c in sorted(group, key=lambda c: (c["row"], c["col"])))


def derive_capacities(sheet, page):
    """Capacités d'un onglet de classe avec leur rôle, lu sur leurs POSITIONS -> (liste de capacités, anomalies).

    Chaque capacité est un dict : sheet, ab (l'aptitude lue), name, niveau, row (ligne de la cellule « Lvl N »), col,
    spec (bannière de spécialité ou None), nature (classe | specialite | choix), rang, peers (les AUTRES capacités du
    même groupe de choix, de gauche à droite ; vide hors groupe). Règle de lecture (confirmée par le propriétaire) :
      * colonne P : capacités de la classe, sans choix (nature « classe », rang = ordre de haut en bas) ;
      * sous chaque bannière de la ligne 17 : la première ligne ne porte qu'un cartouche, le nom de la spécialité
        (nature « specialite ») ; les cartouches de spécialité d'une même ligne s'excluent entre eux ; chaque ligne
        suivante porte des capacités côte à côte (Lvl 10, 15, 20) dont une seule est au choix (nature « choix ») ;
      * sans bannière (Archimage) : une ligne de 2 capacités ou plus est un groupe de choix, une capacité seule sur sa
        ligne est reçue sans choix (nature « classe »).
    Les anomalies sont des tuples (nature de l'anomalie, onglet, détail), listées dans le rapport sans être résolues ;
    quand le rôle d'une capacité ne peut pas être décidé (ligne à une seule capacité sous une bannière...), la
    fonction lève ValueError plutôt que de supposer.
    """
    caps, anomalies = [], []

    def new(ab, spec, nature):
        cap = dict(sheet=sheet, ab=ab, name=ab["name"], niveau=level_number(sheet, ab), row=ab["row"], col=ab["col"],
                   spec=spec, nature=nature, rang=None, peers=[])
        caps.append(cap)
        return cap

    def link(group, peers=True):
        group.sort(key=lambda c: c["col"])
        for i, cap in enumerate(group, 1):
            cap["rang"] = i
            cap["peers"] = [other for other in group if other is not cap] if peers and len(group) > 1 else []

    def check_group(group, expected_sizes, where=""):
        if len(group) not in expected_sizes:
            anomalies.append(("groupe de taille inattendue", sheet, where + cells_of(group)))
        if len({c["niveau"] for c in group}) != 1:
            anomalies.append(("niveaux différents dans un groupe", sheet, cells_of(group)))

    class_caps = [new(ab, None, "classe") for ab in page["class_abilities"]]
    if page["banners"]:
        row_sets, cartouches = {}, []
        for b in page["banners"]:
            by_row = {}
            for ab in b["abilities"]:
                by_row.setdefault(ab["row"], []).append(ab)
            if not by_row:
                anomalies.append(("bannière sans capacité", sheet, b["name"]))
                continue
            rows = sorted(by_row)
            row_sets[b["name"]] = rows
            first = by_row[rows[0]]
            if len(first) != 1:
                raise ValueError("%s : première ligne de la bannière %r : %d capacités au lieu d'une (%s)"
                                 % (sheet, b["name"], len(first), cells_of([dict(row=a["row"], col=a["col"]) for a in first])))
            cartouches.append(new(first[0], b["name"], "specialite"))
            for r in rows[1:]:
                if len(by_row[r]) == 1:
                    ab = by_row[r][0]
                    raise ValueError("%s : ligne à une seule capacité sous la bannière %r (%s)"
                                     % (sheet, b["name"], ref_of(ab["row"], ab["col"])))
                group = [new(ab, b["name"], "choix") for ab in by_row[r]]
                link(group)
                check_group(group, (2,), "bannière %s : " % b["name"])
        if len({tuple(rows) for rows in row_sets.values()}) > 1:
            anomalies.append(("bannières sur des lignes différentes", sheet,
                              " ; ".join("%s : %s" % (b["name"], ", ".join(str(r) for r in row_sets[b["name"]]))
                                         for b in page["banners"] if b["name"] in row_sets)))
        cart_rows = {}
        for cap in cartouches:
            cart_rows.setdefault(cap["row"], []).append(cap)
        if len(cart_rows) > 1:
            anomalies.append(("cartouches de spécialité sur des lignes différentes", sheet, cells_of(cartouches)))
        for group in cart_rows.values():
            link(group, peers=CARTOUCHES_EXCLUSIFS_DANS_CHOIX)
        for cap in cartouches:
            if spelling(cap["name"]) != spelling(cap["spec"]):
                kind = ANOM_CARTOUCHE_ACCENT if fold(cap["name"]) == fold(cap["spec"]) else ANOM_CARTOUCHE_NOM
                anomalies.append((kind, sheet, "%s : bannière « %s », cartouche « %s »"
                                  % (ref_of(cap["row"], cap["col"]), cap["spec"], cap["name"])))
    else:
        by_row = {}
        for ab in page["other_abilities"]:
            by_row.setdefault(ab["row"], []).append(ab)
        for r in sorted(by_row):
            if len(by_row[r]) == 1:
                class_caps.append(new(by_row[r][0], None, "classe"))
                continue
            group = [new(ab, None, "choix") for ab in by_row[r]]
            link(group)
            check_group(group, (2, 3))
    class_caps.sort(key=lambda c: (c["row"], c["col"]))
    for i, cap in enumerate(class_caps, 1):
        cap["rang"] = i
    caps.sort(key=lambda c: (c["row"], c["col"]))
    return caps, anomalies


CONT_END_RE = re.compile(r"(\.{2,}|…|(?<=\s)\.)$")      # « Tenir ... », « Charge lente… », « Chant . »
CONT_START_RE = re.compile(r"(\.{2,}|…|\.(?=\s))")         # « ... ou charger ? », « … Toi ! », « . de coquelicot »


def name_observations(caps):
    """Noms coupés sur plusieurs cellules (« Tenir ... » / « ... ou charger ? ») -> [(nature, onglet, détail)].

    Repérés par leurs seuls marqueurs de suite (deux points ou plus, « … », ou un point isolé, en fin ou en début de nom) : une
    cellule dont le nom se termine par un marqueur et la cellule voisine de droite sur la même ligne de l'onglet dont le nom en
    commence un forment une paire. Chaque moitié a son propre effet et son propre type : le script en fait deux capacités, sans
    jamais décider à la place du propriétaire si elles n'en font qu'une. Les observations sont listées, jamais résolues.
    """
    out = []
    lines = {}
    for cap in caps:
        lines.setdefault((cap["sheet"], cap["row"]), []).append(cap)
    for (sheet, _), line in sorted(lines.items()):
        line.sort(key=lambda c: c["col"])
        for i, cap in enumerate(line):
            here = "%s « %s »" % (ref_of(cap["row"], cap["col"]), cap["name"])
            after = line[i + 1] if i + 1 < len(line) else None
            before = line[i - 1] if i > 0 else None
            if CONT_END_RE.search(cap["name"]):
                if after is not None and CONT_START_RE.match(after["name"]):
                    kind = OBS_PAIRE_MEME_GROUPE if any(after is p for p in cap["peers"]) else OBS_PAIRE_GROUPES
                    out.append((kind, sheet, "%s + %s « %s »" % (here, ref_of(after["row"], after["col"]), after["name"])))
                else:
                    out.append((OBS_FIN_SEULE, sheet, here))
            if CONT_START_RE.match(cap["name"]) and not (before is not None and CONT_END_RE.search(before["name"])):
                out.append((OBS_DEBUT_SEUL, sheet, here))
    return out


def name_capacities(caps, taken_title_keys):
    """Attribue slug, id et titre (uniques) aux capacités ; -> liste de textes décrivant les collisions résolues.

    Slug : <slug de la classe>-<slug du nom> ; si deux capacités le partagent (ou si le nom ne contient ni lettre ni
    chiffre), on ajoute -<niveau>, puis -<rang> si cela ne suffit pas. Titre : « <Nom> (<Classe>) » ; si sa clé de wiki
    (text.mjs#normalize) est déjà prise (par une autre capacité ou par une page de classe), on ajoute « , niveau N ».
    Une collision qui subsiste lève ValueError.
    """
    collisions = []
    for cap in caps:
        name_slug = slugify(cap["name"])
        cap["slug_base"] = cap["class_slug"] + ("-" + name_slug if name_slug else "")
        cap["slug_empty"] = not name_slug

    def count(values):
        n = {}
        for v in values:
            n[v] = n.get(v, 0) + 1
        return n
    n1 = count(c["slug_base"] for c in caps)
    for cap in caps:
        cap["slug"] = cap["slug_base"]
        if n1[cap["slug_base"]] > 1 or cap["slug_empty"]:
            cap["slug"] += "-%d" % cap["niveau"]
    n2 = count(c["slug"] for c in caps)
    for cap in caps:
        if n2[cap["slug"]] > 1:
            cap["slug"] += "-%d" % cap["rang"]
    n3 = count(c["slug"] for c in caps)
    dup = sorted(s for s, n in n3.items() if n > 1)
    if dup:
        raise ValueError("slugs de capacités en double après -niveau et -rang : %s" % ", ".join(dup))
    for cap in caps:
        cap["id"] = CAP_CATEGORY + "/" + cap["slug"]
        if cap["slug"] != cap["slug_base"]:
            why = "nom sans lettre ni chiffre" if cap["slug_empty"] else "collision de slug"
            collisions.append("slug (%s) : %s « %s » (Lvl %d, cellule %s, rang %d) -> %s"
                              % (why, cap["sheet"], cap["name"], cap["niveau"], ref_of(cap["row"], cap["col"]), cap["rang"],
                                 cap["id"]))

    for cap in caps:
        cap["title"] = "%s (%s)" % (cap["name"], cap["sheet"])
    keys = count([wiki_key(c["title"]) for c in caps] + list(taken_title_keys))
    for cap in caps:
        if keys[wiki_key(cap["title"])] > 1:
            before = cap["title"]
            cap["title"] += ", niveau %d" % cap["niveau"]
            collisions.append("titre (clé de wiki déjà prise) : %r -> %r" % (before, cap["title"]))
    keys = count([wiki_key(c["title"]) for c in caps] + list(taken_title_keys))
    dup = sorted(c["title"] for c in caps if keys[wiki_key(c["title"])] > 1)
    if dup:
        raise ValueError("titres de capacités en double après « , niveau N » : %s" % ", ".join(dup))
    return collisions


LABEL_LINE_RE = re.compile(r"\([^()]+\)")


def capacity_summary(effect):
    """Effet entier s'il tient sur une ligne courte, sinon sa première phrase (jamais de texte ajouté).

    Quand la première ligne n'est qu'une étiquette entre parenthèses (« (Rage) », « (Posture Focus) ») et que l'effet est sur la
    ligne suivante, le résumé est l'étiquette suivie de la première phrase de cette ligne : un extrait littéral, mais qui informe.
    """
    text = fmt(effect) if effect else ""
    if not text:
        return None
    if "\n" not in text and len(text) <= SUMMARY_SHORT:
        return text
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) > 1 and LABEL_LINE_RE.fullmatch(lines[0]) and not re.match(r"-\s+\S", lines[1]):
        return lines[0] + " " + first_sentence(lines[1])
    return first_sentence(text)


def render_capacity(cap):
    ab = cap["ab"]
    tags = [CAP_TAG, cap["sheet"].lower()] + ([cap["spec"].lower()] if cap["spec"] else [])
    L = ["---", "title: " + yaml_str(cap["title"]), "aliases: []", "tags: " + yaml_list(tags)]
    summary = capacity_summary(ab["desc"])
    if summary:
        L.append("summary: " + yaml_str(summary))
    L.append("classe: " + yaml_str(CATEGORY + "/" + cap["class_slug"]))
    if cap["spec"]:
        L.append("specialite: " + yaml_str(cap["spec"]))
    L += ["niveau: %d" % cap["niveau"], "nature: " + yaml_str(cap["nature"]), "rang: %d" % cap["rang"],
          "ligne: %d" % cap["row"]]
    if ab["type"]:
        L.append("type_capacite: " + yaml_str(ab["type"]))
    if cap["peers"]:
        L.append("choix_exclusif_avec: " + yaml_list([p["id"] for p in cap["peers"]]))
    L += ["sources: " + yaml_list(["Google Sheet « %s », onglet « %s »" % (WORKBOOK, cap["sheet"]), URL]),
          "status: draft", "---", ""]
    body = md_text(ab["desc"]) if ab["desc"] else []
    for _, note in ab["notes"]:
        body += ([""] if body else []) + md_text(NOTE_LABEL + note)
    for ref, url in ab["links"]:
        body += ([""] if body else []) + [link_note(ref, url)]
    L += body
    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


def note_block(text):
    """Une note de cellule telle que render_capacity l'écrit (lignes Markdown jointes)."""
    return "\n".join(md_text(NOTE_LABEL + text))


def note_segments(page):
    """Notes écrites dans une page : le texte de chaque note, du libellé « Note de cellule : » jusqu'à la note suivante (ou la fin
    de la page), sans les lignes d'hyperlien qui suivraient la dernière."""
    parts = re.split(r"(?m)^(?=%s)" % re.escape(NOTE_LABEL), page)
    return [re.split(r"\n\n(?=%s)" % re.escape(LINK_LINE_START), part.strip("\n"))[0] for part in parts[1:]]


def check_note_coverage(dump_notes, placed, pages):
    """Contrôle de couverture des notes de cellule -> liste d'écarts (vide si tout va bien).

    dump_notes : {onglet: {adresse: texte}} (collect_notes) ; placed : [dict(tab, ref, text, page)] notes rattachées à une
    capacité (page = identifiant « capacites/<slug> » de sa fiche) ; pages : {identifiant: texte intégral de la page} de TOUTES les
    pages écrites. Chaque note du dump doit être placée sur une fiche et figurer exactement une fois dans CETTE page, avec son texte
    intégral ; aucune autre note ne doit être écrite, nulle part (autre fiche, page de classe, glossaire).
    """
    problems = {}

    def add(text):
        problems[COVERAGE_PREFIX + text] = True

    n_dump = sum(len(v) for v in dump_notes.values())
    placed_refs = {(n["tab"], n["ref"]) for n in placed}
    for tab in sorted(dump_notes):
        for ref in sorted(dump_notes[tab], key=split_ref):
            if (tab, ref) not in placed_refs:
                add("note de la cellule %s %s : aucune fiche ne la reçoit" % (tab, ref))
    expected = {}
    for n in placed:
        expected.setdefault(n["page"], []).append(n)
    written = 0
    for pid in sorted(set(pages) | set(expected)):
        got = Counter(note_segments(pages.get(pid, "")))
        want = Counter(note_block(n["text"]) for n in expected.get(pid, []))
        written += sum(got.values())
        for n in expected.get(pid, []):
            block = note_block(n["text"])
            if got[block] != want[block]:
                add("page « %s » : note de la cellule %s %s attendue %d fois, trouvée %d fois"
                    % (pid, n["tab"], n["ref"], want[block], got[block]))
        for block in (got - want):
            if block not in want:
                add("page « %s » : note de cellule inattendue (« %s »)" % (pid, block[len(NOTE_LABEL):][:50]))
    if n_dump != len(placed):
        add("%d note(s) dans le dump, %d placée(s) dans les pages" % (n_dump, len(placed)))
    if n_dump != written:
        add("%d note(s) dans le dump, %d écrite(s) dans les pages" % (n_dump, written))
    return list(problems)


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


# --------------------------------------------------------------------------------------------------------------------
# Vérificateur (--verifier) : n'écrit rien
# --------------------------------------------------------------------------------------------------------------------
# Écrit AVANT le code qui produit les pages de capacités. Il ne réutilise NI l'analyse des blocs d'aptitude du script
# (parse_ability), NI la dérivation des groupes de choix (derive_capacities) : il relit les positions de cellules du dump
# (ligne, colonne, bannière), recalcule seul rôle, rang et exclusivités, puis compare aux pages écrites sur disque.

V_COL_CLASSE = 16         # colonne P
V_ROW_BANNIERES = 17
V_COL_TEXTES = 38         # AL : à partir d'ici, textes de description (pas de capacités)
V_LVL = re.compile(r"Lvl (\d+)")
V_REF = re.compile(r"([A-Z]+)(\d+)")

# Cas de test lus EN CLAIR sur les captures de la feuille (images/4.png : onglet Barde ; images/5.png : bas de l'onglet
# Archimage, donc sans ses capacités de colonne P de niveaux 1 et 5, lues dans le dump). Pour chaque classe : capacités
# sans choix (niveau, nom), cartouches de spécialité exclusifs entre eux (bannière, niveau, nom), puis les lignes de
# capacités côte à côte, de haut en bas : (niveau, [noms de gauche à droite]) ; une seule au choix par ligne.
EXPECTED = {
    "Barde": dict(
        classe=[(1, "Prestation"), (5, "Son perturbant"), (20, "Chant double")],
        specialites=[("DANSEUR", 10, "Danseur"), ("MÉNESTREL", 10, "Ménestrel")],
        lignes={
            "DANSEUR": [(10, ["Perroquet", "Contournement"]), (15, ["Shrapnel", "Marche lunaire"]),
                        (20, ["A bas les Badauds", "Bain de foules"])],
            "MÉNESTREL": [(10, ["Nouvel accord", "Écho"]), (15, ["Balade guerrière", "Amplification"]),
                          (20, ["Exaltation", "Touérk !"])],
        }),
    "Archimage": dict(
        classe=[(1, "Magie-stral"), (5, "Grimoire"), (20, "Semi complet")],
        specialites=[],
        lignes={None: [(10, ["Élémentaliste", "Occultiste"]), (10, ["Création vivante", "Tempus Figus", "Obédience"]),
                       (15, ["Moissonneur", "Rituel Interdit", "Pacte Noire"]), (20, ["Choix", "Caméléon", "Adaptation"])]}),
}

# Sélections de test (exemples du propriétaire) : (classe, capacités prises, {capacité refusée: capacité qui la bloque}).
# Une capacité refusée doit être en conflit avec celle qui la bloque ; les capacités prises ne doivent pas l'être entre elles.
SELECTIONS = [
    ("Barde", ["Ménestrel", "Nouvel accord", "Balade guerrière", "Exaltation", "Chant double"],
     {"Danseur": "Ménestrel", "Écho": "Nouvel accord", "Amplification": "Balade guerrière", "Touérk !": "Exaltation",
      "Perroquet": "Ménestrel", "Shrapnel": "Ménestrel", "Bain de foules": "Ménestrel"}),
    ("Barde", ["Danseur", "Perroquet", "Shrapnel", "Bain de foules", "Prestation", "Son perturbant"],
     {"Ménestrel": "Danseur", "Contournement": "Perroquet", "Marche lunaire": "Shrapnel", "A bas les Badauds": "Bain de foules",
      "Nouvel accord": "Danseur"}),
    ("Archimage", ["Élémentaliste", "Création vivante", "Moissonneur", "Choix", "Semi complet", "Magie-stral", "Grimoire"],
     {"Occultiste": "Élémentaliste", "Tempus Figus": "Création vivante", "Obédience": "Création vivante",
      "Rituel Interdit": "Moissonneur", "Pacte Noire": "Moissonneur", "Caméléon": "Choix", "Adaptation": "Choix"}),
]


def v_cn(letters):
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n


def v_read_sheet(raw):
    """Onglet brut -> ({(ligne, colonne): texte} des cellules textuelles non vides, {coin haut gauche: coin bas droit})."""
    cells = {}
    for c in raw["cells"]:
        v = c["v"]
        if isinstance(v, str) and v.strip():
            cells[(c["r"], c["c"])] = v.replace("\r\n", "\n").replace("\r", "\n").strip()
    merges = {}
    for rng in raw.get("merged", []):
        m = re.fullmatch(r"([A-Z]+)(\d+):([A-Z]+)(\d+)", rng)
        merges[(int(m.group(2)), v_cn(m.group(1)))] = (int(m.group(4)), v_cn(m.group(3)))
    return cells, merges


def v_sheet_abilities(name, raw, notes):
    """Capacités d'un onglet de classe lues par leurs seules positions -> (liste de dicts, anomalies, erreurs).
    `notes` : {adresse: texte} des notes de cellule de l'onglet (v_dump_notes) ; chaque capacité garde celles dont la cellule tombe
    dans son bloc d'effet (texte dans `notes`, adresse dans `note_refs`).

    Les anomalies sont des tuples (nature de l'anomalie, onglet, détail) ; les erreurs sont les cas où le rôle d'une
    capacité ne peut pas être décidé (aucune supposition n'est faite).
    """
    cells, merges = v_read_sheet(raw)
    lvl_set = {k for k, v in cells.items() if v.startswith("Lvl")}
    banners = sorted((c, v) for (r, c), v in cells.items() if r == V_ROW_BANNIERES and c < V_COL_TEXTES)
    abilities, anomalies, errors = [], [], []
    for (r, c) in sorted(lvl_set):
        m = V_LVL.fullmatch(cells[(r, c)])
        if not m:
            errors.append("%s!%s : niveau %r non reconnu" % (name, ref_of(r, c), cells[(r, c)]))
            continue
        right = sorted(cc for (rr, cc) in cells if rr == r and cc > c)
        nm = cells.get((r, right[0])) if right and (r, right[0]) not in lvl_set else None
        eff = cells.get((r + 1, c))
        r2, c2 = merges.get((r + 1, c), (r + 1, c))
        typ, typ_row = None, None
        for rr in range(r2 + 1, r2 + 4):
            if (rr, c) in lvl_set:
                break
            if (rr, c) in cells:
                typ, typ_row = cells[(rr, c)], rr
                break
        found, found_refs = [], []
        for ref in sorted(notes, key=lambda x: (int(V_REF.fullmatch(x).group(2)), v_cn(V_REF.fullmatch(x).group(1)))):
            nr, nc = int(V_REF.fullmatch(ref).group(2)), v_cn(V_REF.fullmatch(ref).group(1))
            if r + 1 <= nr <= r2 and c <= nc <= c2:
                found.append(notes[ref])
                found_refs.append(ref)
        used = {(r, c), (r + 1, c)} | ({(r, right[0])} if right else set()) | ({(typ_row, c)} if typ is not None else set())
        abilities.append(dict(row=r, col=c, niveau=int(m.group(1)), nom=nm, effet=eff, type=typ, notes=found, note_refs=found_refs,
                              spec=None, nature=None, peers=[], rang=None, used=used))

    for a in abilities:
        if banners and a["col"] != V_COL_CLASSE:
            starts = [i for i, (bc, _) in enumerate(banners) if bc <= a["col"]]
            if not starts:
                errors.append("%s!%s : capacité à gauche de toute bannière" % (name, ref_of(a["row"], a["col"])))
            else:
                a["spec"] = banners[starts[-1]][1]
    lines = {}
    for a in abilities:
        if a["col"] != V_COL_CLASSE:
            lines.setdefault((a["spec"], a["row"]), []).append(a)

    def refs(group):
        return ", ".join(ref_of(a["row"], a["col"]) for a in sorted(group, key=lambda a: (a["row"], a["col"])))

    def link(group):
        for a in group:
            a["peers"] = [b for b in sorted(group, key=lambda b: b["col"]) if b is not a]

    for a in abilities:
        if a["col"] == V_COL_CLASSE:
            a["nature"] = "classe"
    if banners:
        spec_rows = {}
        for (spec, r) in lines:
            spec_rows.setdefault(spec, set()).add(r)
        for _, spec in banners:
            if spec not in spec_rows:
                anomalies.append(("bannière sans capacité", name, spec))
                continue
            rows = sorted(spec_rows[spec])
            if len(lines[(spec, rows[0])]) != 1:
                errors.append("%s : première ligne de la bannière %r : %d capacités au lieu d'une (%s)"
                              % (name, spec, len(lines[(spec, rows[0])]), refs(lines[(spec, rows[0])])))
            else:
                lines[(spec, rows[0])][0]["nature"] = "specialite"
            for r in rows[1:]:
                grp = lines[(spec, r)]
                if len(grp) == 1:
                    errors.append("%s : ligne à une seule capacité sous la bannière %r (%s)" % (name, spec, refs(grp)))
                    continue
                for a in grp:
                    a["nature"] = "choix"
                link(grp)
                if len(grp) != 2:
                    anomalies.append(("groupe de taille inattendue", name, "bannière %s : %s" % (spec, refs(grp))))
                if len({a["niveau"] for a in grp}) != 1:
                    anomalies.append(("niveaux différents dans un groupe", name, refs(grp)))
        if len({frozenset(spec_rows[s]) for s in spec_rows}) > 1:
            anomalies.append(("bannières sur des lignes différentes", name,
                              " ; ".join("%s : %s" % (s, ", ".join(str(r) for r in sorted(spec_rows[s]))) for _, s in banners
                                         if s in spec_rows)))
        carts = [a for a in abilities if a["nature"] == "specialite"]
        cart_rows = {}
        for a in carts:
            cart_rows.setdefault(a["row"], []).append(a)
        for grp in cart_rows.values():
            if CARTOUCHES_EXCLUSIFS_DANS_CHOIX and len(grp) > 1:
                link(grp)
        if len(cart_rows) > 1:
            anomalies.append(("cartouches de spécialité sur des lignes différentes", name, refs(carts)))
        for a in carts:
            bname, nom = a["spec"], a["nom"]
            if nom is None or " ".join(nom.casefold().split()) != " ".join(bname.casefold().split()):
                kind = ANOM_CARTOUCHE_ACCENT if nom is not None and fold(nom) == fold(bname) else ANOM_CARTOUCHE_NOM
                anomalies.append((kind, name, "%s : bannière « %s », cartouche « %s »" % (ref_of(a["row"], a["col"]), bname, nom)))
    else:
        for (_, r), grp in sorted(lines.items(), key=lambda kv: kv[0][1]):
            if len(grp) == 1:
                grp[0]["nature"] = "classe"
                continue
            for a in grp:
                a["nature"] = "choix"
            link(grp)
            if len(grp) not in (2, 3):
                anomalies.append(("groupe de taille inattendue", name, refs(grp)))
            if len({a["niveau"] for a in grp}) != 1:
                anomalies.append(("niveaux différents dans un groupe", name, refs(grp)))
    ordered = sorted((a for a in abilities if a["nature"] == "classe"), key=lambda a: (a["row"], a["col"]))
    for i, a in enumerate(ordered, 1):
        a["rang"] = i
    for a in abilities:
        if a["nature"] == "choix":
            a["rang"] = 1 + sum(1 for b in a["peers"] if b["col"] < a["col"])
        elif a["nature"] == "specialite":
            a["rang"] = 1 + sum(1 for b in abilities if b["nature"] == "specialite" and b["row"] == a["row"]
                                and b["col"] < a["col"])
    return abilities, anomalies, errors


def v_cut_names(name, abilities):
    """Noms coupés sur deux cellules d'une même ligne de l'onglet, recalculés par des tests de chaînes (sans les regex du script)
    -> [(nature, onglet, détail)], même forme que name_observations."""
    def ends(n):
        return n.endswith("..") or n.endswith("…") or (n.endswith(".") and len(n) > 1 and n[-2].isspace())

    def starts(n):
        return n.startswith("..") or n.startswith("…") or (n.startswith(".") and len(n) > 1 and n[1].isspace())
    rows = {}
    for a in abilities:
        rows.setdefault(a["row"], []).append(a)
    out = []
    for r in sorted(rows):
        line = sorted(rows[r], key=lambda a: a["col"])
        for i, a in enumerate(line):
            nom = a["nom"] or ""
            here = "%s « %s »" % (ref_of(a["row"], a["col"]), nom)
            right = line[i + 1] if i + 1 < len(line) else None
            left = line[i - 1] if i else None
            if ends(nom):
                if right is not None and starts(right["nom"] or ""):
                    same = any(right is p for p in a["peers"])
                    out.append((OBS_PAIRE_MEME_GROUPE if same else OBS_PAIRE_GROUPES, name,
                                "%s + %s « %s »" % (here, ref_of(right["row"], right["col"]), right["nom"])))
                else:
                    out.append((OBS_FIN_SEULE, name, here))
            if starts(nom) and not (left is not None and ends(left["nom"] or "")):
                out.append((OBS_DEBUT_SEUL, name, here))
    return out


def v_parse_page(path):
    """Page écrite par ce script -> (frontmatter {clé: valeur}, corps, texte intégral). Le frontmatter est écrit ligne à ligne,
    en JSON."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    lines = text.split("\n")
    if lines[0] != "---":
        raise ValueError("pas de frontmatter")
    end = lines.index("---", 1)
    front = {}
    for line in lines[1:end]:
        key, _, value = line.partition(": ")
        front[key] = value if key == "status" else json.loads(value)   # status est un mot nu, le reste du JSON
    return front, "\n".join(lines[end + 1:]), text


def v_unescape(line):
    return re.sub(r"\\([\\`*_\[\]<~>#+\-.)&])", r"\1", line)


def v_lines(text):
    """Texte -> lignes non vides, sans espaces de bord, sans échappements Markdown, listes « - x » normalisées."""
    out = []
    for line in text.split("\n"):
        line = v_unescape(line.strip())
        if line:
            out.append(re.sub(r"^-\s+", "- ", line))
    return out


def v_flat(text):
    return re.sub(r"\s+", " ", text.replace("<br>", " ").replace("\\|", "|")).strip()


def v_conflict(a, b):
    """Deux capacités sont-elles exclusives ? Lu sur le frontmatter seul (c'est ce que fera le site)."""
    fa, fb = a["front"], b["front"]
    if a["id"] in fb.get("choix_exclusif_avec", []) or b["id"] in fa.get("choix_exclusif_avec", []):
        return True
    return (fa["classe"] == fb["classe"] and bool(fa.get("specialite")) and bool(fb.get("specialite"))
            and fa["specialite"] != fb["specialite"])


def v_described(pages, class_id, class_name):
    """Structure d'une classe lue sur le frontmatter des pages seul : même forme que EXPECTED."""
    mine = [p for p in pages.values() if p["front"].get("classe") == class_id]

    def name_of(p):
        return re.sub(r" \(%s\)(, niveau \d+)?$" % re.escape(class_name), "", p["front"]["title"])

    def rank(p):
        return p["front"]["rang"]
    d = dict(classe=[], specialites=[], lignes={})
    for p in sorted(mine, key=rank):
        f = p["front"]
        if f.get("nature") == "classe":
            d["classe"].append((f["niveau"], name_of(p)))
    for p in sorted([p for p in mine if p["front"].get("nature") == "specialite"], key=rank):
        d["specialites"].append((p["front"]["specialite"], p["front"]["niveau"], name_of(p)))
    seen = set()
    for p in sorted([p for p in mine if p["front"].get("nature") == "choix"], key=lambda p: (p["front"]["ligne"], rank(p))):
        if p["id"] in seen:
            continue
        group = [p] + [pages[i] for i in p["front"].get("choix_exclusif_avec", []) if i in pages]
        seen.update(g["id"] for g in group)
        group.sort(key=rank)
        d["lignes"].setdefault(p["front"].get("specialite"), []).append((p["front"]["niveau"], [name_of(g) for g in group]))
    return d


V_NOTE = "Note de cellule : "
V_LINK = "*Lien hypertexte attaché"
V_CLASSES_DIR = "classes"
V_GLOSSARY = os.path.join("ressources", "objets-de-depart-des-classes.md")


def v_dump_notes(sheets, class_names):
    """Notes de cellule du dump, relues par un code propre au vérificateur (il ne passe pas par collect_notes)
    -> ({onglet: {adresse: texte}}, erreurs : liste de textes). Mêmes refus que le script, formulés autrement : fil de
    commentaires, note qui n'est pas un texte, note dans un onglet qui n'est pas une classe (non publié, Sommaire), note sur
    une cellule vide. Une note blanche n'est pas une note."""
    notes, errors = {}, []
    for name, raw in sheets.items():
        for c in raw["cells"]:
            where = "%s!%s" % (name, ref_of(c["r"], c["c"]))
            if c.get("threads"):
                errors.append("%s : fil de commentaires, aucune place prévue" % where)
            note = c.get("note")
            if note is None:
                continue
            if not isinstance(note, str):
                errors.append("%s : note qui n'est pas un texte (%r)" % (where, note))
            elif not note.strip():
                continue
            elif name not in class_names:
                errors.append("%s : note dans un onglet non publié ou sans place pour une note" % where)
            elif c.get("v") is None or (isinstance(c["v"], str) and not c["v"].strip()):
                errors.append("%s : cellule vide qui porte une note" % where)
            else:
                notes.setdefault(name, {})[ref_of(c["r"], c["c"])] = note.replace("\r\n", "\n").replace("\r", "\n").strip()
    return notes, errors


def v_note_segments(text):
    """Notes écrites dans un texte de page, lues sur ses lignes déséchappées (v_lines) : une liste de tuples de lignes, un par
    note (du libellé jusqu'à la note suivante), sans les lignes d'hyperlien."""
    segments, current = [], None
    for line in v_lines(text):
        if line.startswith(V_NOTE):
            current = [line]
            segments.append(current)
        elif line.startswith(V_LINK):
            current = None
        elif current is not None:
            current.append(line)
    return [tuple(seg) for seg in segments]


def v_check_page_notes(label, texts, text):
    """Notes d'une page : `texts` = textes attendus (dump), `text` = texte intégral de la page -> échecs. Chaque note attendue
    doit y figurer exactement autant de fois qu'elle est attendue, avec son texte intégral, et aucune autre ne doit y être."""
    want = Counter(tuple(v_lines(V_NOTE + t)) for t in texts)
    got = Counter(v_note_segments(text))
    out = []
    for seg in sorted(want):
        if got[seg] != want[seg]:
            out.append("%s : note « %s » attendue %d fois, trouvée %d fois" % (label, seg[0][len(V_NOTE):][:50], want[seg], got[seg]))
    for seg in sorted(got - want):
        if seg not in want:
            out.append("%s : note inattendue « %s »" % (label, seg[0][len(V_NOTE):][:50]))
    return out


def v_independent_refusals(mut, tab, class_names):
    """Ce que le recalcul indépendant refuse dans un dump modifié (onglet `tab`) : erreurs de lecture des notes, notes qu'aucun
    bloc d'effet de l'onglet ne contient (la géométrie des cellules fusionnées décide)."""
    notes, errors = v_dump_notes(mut, class_names)
    errors = list(errors)
    if tab in class_names:
        abilities, _, _ = v_sheet_abilities(tab, mut[tab], notes.get(tab, {}))
        placed = {ref for a in abilities for ref in a["note_refs"]}
        errors += ["%s!%s : note sans bloc d'effet de capacité (non placée)" % (tab, ref) for ref in notes.get(tab, {}) if ref not in placed]
    return errors


def v_mutate(sheets, tab, change):
    """Copie du dump où `change(cells)` modifie une copie des cellules de l'onglet `tab` ; les autres onglets sont partagés,
    jamais modifiés (le vrai dump n'est jamais touché)."""
    raw = sheets[tab]
    cells = [dict(c) for c in raw["cells"]]
    change(cells)
    return dict(sheets, **{tab: dict(raw, cells=cells)})


def v_replays(sheets, class_names, links, dump_notes, placed, pages, comments=None):
    """Rejoue des cas d'erreur sur des copies en mémoire du dump et des pages : chacun doit être refusé, avec un message, par
    le script ET par le recalcul indépendant. -> [(libellé, échecs, info)]. `placed` : notes rattachées (recalcul indépendant,
    [dict(tab, ref, text, page)]) ; `pages` : {identifiant: dict(text, ...)} des fiches de capacités écrites sur disque ;
    `comments` : commentaires du classeur .xlsx (None sans classeur : le recoupement n'est alors pas rejoué)."""
    results = []

    def run(label, tab, mut, script_re, indep_re):
        try:
            built = build(mut, class_names, links)
            script = "; ".join(built["problems"])
        except ValueError as err:
            script = str(err)
        indep = "; ".join(v_independent_refusals(mut, tab, class_names))
        failures = []
        if not script:
            failures.append("le script n'a rien refusé")
        elif not re.search(script_re, script):
            failures.append("message du script inattendu : %s" % script[:120])
        if not indep:
            failures.append("le recalcul indépendant n'a rien refusé")
        elif not re.search(indep_re, indep):
            failures.append("message du recalcul inattendu : %s" % indep[:120])
        results.append((label, failures, script[:110]))

    base = class_names[0]
    free_row = max(c["r"] for c in sheets[base]["cells"]) + 1
    level_cell = next(c for c in sheets[base]["cells"] if isinstance(c.get("v"), str) and V_LVL.match(c["v"]))
    run("note sur une cellule vide", base, v_mutate(sheets, base, lambda cells: cells.append(
        dict(r=free_row, c=3, v="", note="Une note"))), r"est vide mais porte une note", r"cellule vide qui porte une note")
    ignored = sorted(IGNORED_SHEETS)[0]
    if ignored in sheets:
        mut = v_mutate(sheets, ignored, lambda cells: cells[0].update(note="Une note"))
    else:
        mut = dict(sheets, **{ignored: dict(name=ignored, state="visible", merged=[], cells=[dict(r=1, c=1, v="x", note="Une note")])})
    run("note dans un onglet non publié", ignored, mut, r"ne publie pas", r"onglet non publié")
    run("note dans le Sommaire", SUMMARY_SHEET, v_mutate(sheets, SUMMARY_SHEET, lambda cells: cells[0].update(note="Une note")),
        r"aucune place prévue", r"onglet non publié ou sans place")
    run("note non placée (hors d'un bloc d'effet de capacité)", base, v_mutate(
        sheets, base, lambda cells: next(c for c in cells if (c["r"], c["c"]) == (level_cell["r"], level_cell["c"])).update(
            note="Une note")), r"sans place prévue", r"non placée")
    run("fil de commentaires", base, v_mutate(sheets, base, lambda cells: cells[0].update(threads=[dict(text="Une conversation")])),
        r"fil de commentaires", r"fil de commentaires")
    run("note qui n'est pas un texte", base, v_mutate(sheets, base, lambda cells: cells[0].update(note=5)),
        r"pas un texte", r"pas un texte")

    # recoupement avec le classeur .xlsx : le dump perd une note, ou le classeur porte un fil que le dump n'a pas
    if comments is not None and any(dump_notes.get(name) for name in class_names):
        tab = next(name for name in class_names if dump_notes.get(name))
        ref = next(iter(dump_notes[tab]))
        row, col = split_ref(ref)
        lost = v_mutate(sheets, tab, lambda cells: next(c for c in cells if (c["r"], c["c"]) == (row, col)).pop("note"))
        script = "; ".join(crosscheck_notes(lost, comments)[0])
        in_xlsx = sum(1 for name in class_names for text in comments.get(name, {"notes": {}})["notes"].values() if not is_blank(text))
        in_dump = sum(len(notes) for notes in v_dump_notes(lost, class_names)[0].values())
        failures = []
        if not re.search(r"notes du classeur absentes du dump : %s" % re.escape(ref), script):
            failures.append("le recoupement n'a pas refusé la note perdue : %s" % (script[:120] or "rien refusé"))
        if in_dump == in_xlsx:
            failures.append("le recalcul indépendant ne voit pas l'écart (%d notes des deux côtés)" % in_dump)
        results.append(("note du classeur perdue par le dump (classeur .xlsx fourni)", failures, script[:110]))
        threaded = dict(comments, **{tab: dict(comments.get(tab, {"notes": {}}), threads={ref: [{"text": "Une conversation"}]})})
        script = "; ".join(crosscheck_notes(sheets, threaded)[0])
        results.append(("fil de commentaires du classeur perdu par le dump (classeur .xlsx fourni)",
                        [] if re.search(r"fils de commentaires du classeur absents du dump : %s" % re.escape(ref), script)
                        else ["le recoupement n'a pas refusé le fil perdu : %s" % (script[:120] or "rien refusé")], script[:110]))

    # cas sur les pages : il faut au moins une note dans le dump
    by_page = {}
    for n in placed:
        by_page.setdefault(n["page"], []).append(n)
    # une fiche saine (ses notes déjà conformes au dump) sert de base : sur une page déjà fautive, l'échec est déjà signalé plus haut
    sound = [pid for pid in by_page if not v_check_page_notes(pid, [n["text"] for n in by_page[pid]], pages[pid]["text"])]
    other = next((pid for pid in sorted(pages) if pid not in by_page), None)
    if not sound or other is None:
        results.append(("note retirée, dupliquée, tronquée ou écrite sur une autre fiche : non rejoués", [],
                        "aucune note dans le dump" if not by_page else "aucune fiche saine, ou toutes les fiches ont une note"))
        return results
    target = max(sound, key=lambda pid: (max(len(n["text"]) for n in by_page[pid]), pid))
    texts = [n["text"] for n in by_page[target]]
    all_text = {pid: p["text"] for pid, p in pages.items()}
    text = all_text[target]
    cut = text.index("\n" + V_NOTE) + 1
    note_part = text[cut:]

    def page_case(label, pid, mutated, wanted_texts):
        indep = v_check_page_notes(pid, wanted_texts, mutated)
        script = check_note_coverage(dump_notes, placed, dict(all_text, **{pid: mutated}))
        failures = []
        if not script:
            failures.append("le script n'a rien refusé")
        if not indep:
            failures.append("le recalcul indépendant n'a rien refusé")
        results.append((label, failures, (script[0] if script else "")[len(COVERAGE_PREFIX):][:110]))

    page_case("note retirée d'une page", target, text[:cut], texts)
    page_case("note dupliquée dans une page", target, text.rstrip("\n") + "\n\n" + note_part, texts)
    page_case("note tronquée dans une page", target, text.rstrip("\n")[:-8] + "\n", texts)
    page_case("note écrite sur une autre fiche", other, all_text[other].rstrip("\n") + "\n\n" + note_part, [])
    return results


def verify(args):
    sheets, order, dump_dirs = load_dumps(args.dump)
    class_names = [n for n in order if n != SUMMARY_SHEET and n not in IGNORED_SHEETS]
    xlsx = locate_xlsx(args, dump_dirs)
    links = load_links(xlsx)
    comments, comments_failure = read_xlsx_comments(xlsx) if xlsx is not None else (None, None)
    dump_notes, note_errors = v_dump_notes(sheets, class_names)
    out = args.out
    results = []     # (libellé, [échecs], info)

    def check(label, failures, info=""):
        results.append((label, failures, info))

    # pages de capacités sur disque
    pages, failures = {}, []
    folder = os.path.join(out, CAP_CATEGORY)
    for fname in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
        full = os.path.join(folder, fname)
        if fname.endswith(".md") and is_ours(full):
            try:
                front, body, text = v_parse_page(full)
            except (ValueError, OSError) as err:
                failures.append("%s : page illisible (%s)" % (fname, err))
                continue
            pages[CAP_CATEGORY + "/" + fname[:-3]] = dict(id=CAP_CATEGORY + "/" + fname[:-3], front=front, body=body, text=text)
    check("pages de capacités lisibles", failures, "%d pages dans %s" % (len(pages), folder))

    # capacités attendues, recalculées depuis le dump
    expected, anomalies, errors, observations = {}, [], [], []
    for name in class_names:
        ab, an, er = v_sheet_abilities(name, sheets[name], dump_notes.get(name, {}))
        expected[name] = ab
        anomalies += an
        errors += er
        observations += v_cut_names(name, ab)
    total = sum(len(v) for v in expected.values())

    # (1) nombre de pages = nombre de cellules « Lvl N », au total et par classe
    failures = []
    by_class = {}
    for p in pages.values():
        by_class[p["front"].get("classe")] = by_class.get(p["front"].get("classe"), 0) + 1
    for name in class_names:
        n_pages = by_class.get("classes/" + slugify(name), 0)
        if n_pages != len(expected[name]):
            failures.append("%s : %d pages pour %d cellules « Lvl N »" % (name, n_pages, len(expected[name])))
    if len(pages) != total:
        failures.append("total : %d pages pour %d cellules « Lvl N »" % (len(pages), total))
    check("(1) une page par cellule « Lvl N » (total et par classe)", failures, "%d cellules, %d classes" % (total, len(class_names)))

    # appariement page <-> capacité attendue : (classe, bannière, ligne, rang)
    index, failures = {}, []
    for p in pages.values():
        f = p["front"]
        key = (f.get("classe"), f.get("specialite"), f.get("ligne"), f.get("rang"))
        if key in index:
            failures.append("deux pages pour %r : %s et %s" % (key, index[key]["id"], p["id"]))
        index[key] = p
    matched = set()
    for name in class_names:
        for a in expected[name]:
            a["page"] = index.get(("classes/" + slugify(name), a["spec"], a["row"], a["rang"]))
            if a["page"] is None:
                failures.append("%s!%s : aucune page (bannière %r, ligne %d, rang %s)"
                                % (name, ref_of(a["row"], a["col"]), a["spec"], a["row"], a["rang"]))
            else:
                matched.add(a["page"]["id"])
    for pid in sorted(set(pages) - matched):
        failures.append("%s : page qui ne correspond à aucune cellule « Lvl N »" % pid)
    check("appariement page <-> cellule (classe, bannière, ligne, rang)", failures)

    # (2) nom, type, effet, niveau, nature... de chaque capacité dans SA page
    failures = []
    titles_by_key = {}
    for name in class_names:
        for a in expected[name]:
            p = a["page"]
            if p is None:
                continue
            f, where = p["front"], "%s!%s" % (name, ref_of(a["row"], a["col"]))
            if a["nom"] is None or not f.get("title", "").startswith("%s (%s)" % (a["nom"], name)):
                failures.append("%s : titre %r pour le nom %r" % (where, f.get("title"), a["nom"]))
            if f.get("type_capacite") != a["type"]:
                failures.append("%s : type %r au lieu de %r" % (where, f.get("type_capacite"), a["type"]))
            if f.get("niveau") != a["niveau"] or f.get("ligne") != a["row"] or f.get("nature") != a["nature"]:
                failures.append("%s : niveau/ligne/nature %r/%r/%r au lieu de %r/%r/%r"
                                % (where, f.get("niveau"), f.get("ligne"), f.get("nature"), a["niveau"], a["row"], a["nature"]))
            wanted_tags = [CAP_TAG, name.lower()] + ([a["spec"].lower()] if a["spec"] else [])
            if f.get("tags") != wanted_tags:
                failures.append("%s : tags %r au lieu de %r" % (where, f.get("tags"), wanted_tags))
            if f.get("classe") != "classes/" + slugify(name) or f.get("aliases") != [] or f.get("status") != "draft":
                failures.append("%s : classe/aliases/status incorrects" % where)
            if a["nature"] == "classe" and "specialite" in f:
                failures.append("%s : une capacité de classe ne porte pas de spécialité" % where)
            if a["spec"] != f.get("specialite"):
                failures.append("%s : spécialité %r au lieu de %r" % (where, f.get("specialite"), a["spec"]))
            if not any(s.startswith("Google Sheet « %s », onglet « %s »" % (WORKBOOK, name)) for s in f.get("sources", [])) \
                    or URL not in f.get("sources", []):
                failures.append("%s : sources incorrectes %r" % (where, f.get("sources")))
            wanted = v_lines(a["effet"] or "")
            for note in a["notes"]:
                wanted += v_lines("Note de cellule : " + note)
            if v_lines(p["body"]) != wanted:
                failures.append("%s : effet/note différents du dump :\n      page : %r\n      dump : %r"
                                % (where, v_lines(p["body"])[:6], wanted[:6]))
            summary = f.get("summary")
            if (a["effet"] or "").strip():
                if not summary or v_flat(summary) not in v_flat(a["effet"]):
                    failures.append("%s : résumé %r absent de l'effet" % (where, summary))
                elif re.fullmatch(r"\([^()]*\)", summary.strip()) and len([l for l in a["effet"].split("\n") if l.strip()]) > 1:
                    failures.append("%s : résumé réduit à l'étiquette %r alors que l'effet continue" % (where, summary))
            elif summary:
                failures.append("%s : résumé pour un effet vide" % where)
            titles_by_key.setdefault(wiki_key(f.get("title", "")), []).append(p["id"])
    check("(2) nom, type, effet, note, niveau, nature de chaque cellule dans SA page", failures)

    # (2 bis) notes de cellule : relues dans le dump, placées par la géométrie, comparées aux pages ; puis cas d'erreur rejoués
    failures = list(note_errors)
    n_dump = sum(len(v) for v in dump_notes.values())
    placed, attached, written = [], 0, 0
    for name in class_names:
        refs_found = set()
        for a in expected[name]:
            attached += len(a["notes"])
            refs_found.update(a["note_refs"])
            if a["page"] is None:
                continue
            placed += [dict(tab=name, ref=ref, text=text, page=a["page"]["id"]) for ref, text in zip(a["note_refs"], a["notes"])]
            failures += v_check_page_notes("%s!%s (%s)" % (name, ref_of(a["row"], a["col"]), a["page"]["id"]), a["notes"],
                                           a["page"]["text"])
        failures += ["%s!%s : note sans bloc d'effet de capacité (non placée)" % (name, ref)
                     for ref in dump_notes.get(name, {}) if ref not in refs_found]
    for p in pages.values():
        written += len(v_note_segments(p["text"]))
    other_pages = [os.path.join(out, V_CLASSES_DIR, f) for f in sorted(os.listdir(os.path.join(out, V_CLASSES_DIR)))
                   if f.endswith(".md")] if os.path.isdir(os.path.join(out, V_CLASSES_DIR)) else []
    other_pages.append(os.path.join(out, V_GLOSSARY))
    for path in other_pages:
        if os.path.isfile(path) and is_ours(path):
            with open(path, encoding="utf-8") as fh:
                extra = v_note_segments(fh.read())
            written += len(extra)
            if extra:
                failures.append("%s : page qui n'est pas une fiche de capacité mais porte %d note(s) de cellule" % (path, len(extra)))
    if not (n_dump == attached == written):
        failures.append("%d notes dans le dump, %d rattachées à un bloc d'effet par la géométrie, %d écrites dans les pages"
                        % (n_dump, attached, written))
    check("(2 bis) notes de cellule (champ `note` du dump) : chacune écrite une fois, dans la page prévue, texte intégral", failures,
          "%d notes de cellule dans le dump, %d rattachées à un bloc d'effet, %d écrites" % (n_dump, attached, written))
    # (2 ter) le dump porte-t-il toutes les notes du classeur d'origine ? (2 bis compare les pages au dump : il ne voit pas une perte du dump)
    if xlsx is None:
        check("(2 ter) notes et fils du dump = ceux du classeur .xlsx d'origine (aucune note perdue par le dump)", [],
              "non contrôlé : --sans-liens (aucun classeur .xlsx lu)")
    elif comments_failure is not None:
        check("(2 ter) notes et fils du dump = ceux du classeur .xlsx d'origine (aucune note perdue par le dump)", [comments_failure])
    else:
        gaps, changed, n_xlsx = crosscheck_notes(sheets, comments)
        check("(2 ter) notes et fils du dump = ceux du classeur .xlsx d'origine (aucune note perdue par le dump)", gaps,
              "%d notes dans le classeur, mêmes adresses dans le dump" % n_xlsx
              + ("" if not changed else " ; AVERTISSEMENT : " + " ; ".join(changed)))
    replays = v_replays(sheets, class_names, links, dump_notes, placed, pages, comments)
    for label, failures_, info in replays:
        check("cas d'erreur rejoué : " + label, failures_, info)
    refused = sum(1 for _, f, _ in replays if not f)
    check("cas d'erreur rejoués : %d/%d refusés avec un message" % (refused, len(replays)),
          [] if refused == len(replays) else ["%d cas non refusés" % (len(replays) - refused)])

    # (3) groupes de choix recalculés depuis les positions, comparés à choix_exclusif_avec
    failures = []
    for name in class_names:
        for a in expected[name]:
            p = a["page"]
            if p is None:
                continue
            where = "%s!%s" % (name, ref_of(a["row"], a["col"]))
            want = [q["page"]["id"] for q in a["peers"] if q["page"] is not None]
            got = p["front"].get("choix_exclusif_avec")
            if (got or []) != want:
                failures.append("%s : choix_exclusif_avec %r au lieu de %r" % (where, got, want))
            if "choix_exclusif_avec" in p["front"] and not want:
                failures.append("%s : clé choix_exclusif_avec présente pour une capacité sans groupe" % where)
    for p in pages.values():
        f = p["front"]
        for other in f.get("choix_exclusif_avec", []):
            q = pages.get(other)
            if q is None:
                failures.append("%s : cite %s qui n'existe pas" % (p["id"], other))
                continue
            g = q["front"]
            if p["id"] not in g.get("choix_exclusif_avec", []):
                failures.append("%s cite %s, qui ne le cite pas (asymétrie)" % (p["id"], other))
            if other == p["id"]:
                failures.append("%s se cite lui-même" % p["id"])
            if g.get("classe") != f.get("classe"):
                failures.append("%s et %s : classes différentes" % (p["id"], other))
            if g.get("niveau") != f.get("niveau"):
                failures.append("%s et %s : niveaux différents" % (p["id"], other))
            if g.get("specialite") != f.get("specialite") and not (f.get("nature") == g.get("nature") == "specialite"):
                failures.append("%s et %s : spécialités différentes" % (p["id"], other))
    check("(3) groupes de choix (positions du dump) = choix_exclusif_avec ; symétrie, même niveau, même spécialité (sauf cartouches)",
          failures, "%d capacités dans un groupe" % sum(1 for p in pages.values() if p["front"].get("choix_exclusif_avec")))

    # (4) Barde et Archimage en clair, puis sélections de test
    failures, shown, absent = [], [], []
    for name, wanted in EXPECTED.items():
        if name not in class_names:      # dump partiel (classeur de test) : la capture ne s'applique qu'aux onglets présents
            absent.append(name)
            continue
        got = v_described(pages, "classes/" + slugify(name), name)
        shown.append((name, got))
        if got != wanted:
            failures.append("%s : groupes produits différents de la capture\n      produit : %r\n      attendu : %r"
                            % (name, got, wanted))
    for name, taken, refused in SELECTIONS:
        if name not in class_names:
            continue
        mine = {}
        for p in pages.values():
            if p["front"].get("classe") == "classes/" + slugify(name):
                mine[re.sub(r" \(%s\)(, niveau \d+)?$" % re.escape(name), "", p["front"]["title"])] = p
        missing = [n for n in list(taken) + list(refused) if n not in mine]
        if missing:
            failures.append("%s : capacités introuvables %r" % (name, missing))
            continue
        for i, x in enumerate(taken):
            for y in taken[i + 1:]:
                if v_conflict(mine[x], mine[y]):
                    failures.append("%s : %r et %r sont pris ensemble mais jugés exclusifs" % (name, x, y))
        for x, blocker in refused.items():
            if blocker not in taken or not v_conflict(mine[x], mine[blocker]):
                failures.append("%s : %r devrait être refusé à cause de %r" % (name, x, blocker))
    check("(4) Barde et Archimage = captures ; sélections de test des exemples du propriétaire", failures,
          "onglet(s) absent(s) du dump, non contrôlé(s) : %s" % ", ".join(absent) if absent else "")

    # titres et slugs : uniques dans TOUT le wiki ; « , niveau N » / -niveau / -rang seulement en cas de doublon
    failures = []
    wiki_titles = {}
    for sub in sorted(os.listdir(out)):
        sub_path = os.path.join(out, sub)
        for fname in sorted(os.listdir(sub_path)) if os.path.isdir(sub_path) else []:
            if fname.endswith(".md"):
                t = read_title(os.path.join(sub_path, fname))
                if t:
                    wiki_titles.setdefault(wiki_key(t), []).append("%s/%s" % (sub, fname))
    class_keys = [wiki_key(read_title(os.path.join(out, CATEGORY, f)) or "") for f in sorted(os.listdir(os.path.join(out, CATEGORY)))
                  if f.endswith(".md")] if os.path.isdir(os.path.join(out, CATEGORY)) else []
    flat = [(name, a) for name in class_names for a in expected[name]]
    base_title = {id(a): "%s (%s)" % (a["nom"], name) for name, a in flat}
    title_count = {}
    for key in [wiki_key(t) for t in base_title.values()] + class_keys:
        title_count[key] = title_count.get(key, 0) + 1
    base_slug, slug_count = {}, {}
    for name, a in flat:
        ns = slugify(a["nom"] or "")
        base_slug[id(a)] = slugify(name) + ("-" + ns if ns else "")
        slug_count[base_slug[id(a)]] = slug_count.get(base_slug[id(a)], 0) + 1
    slug1 = {}
    for name, a in flat:
        slug1[id(a)] = base_slug[id(a)] + ("-%d" % a["niveau"] if slug_count[base_slug[id(a)]] > 1 or not slugify(a["nom"] or "")
                                           else "")
    slug1_count = {}
    for v in slug1.values():
        slug1_count[v] = slug1_count.get(v, 0) + 1
    for name, a in flat:
        p = a["page"]
        if p is None:
            continue
        where = "%s!%s" % (name, ref_of(a["row"], a["col"]))
        base = base_title[id(a)]
        want = base + (", niveau %d" % a["niveau"] if title_count[wiki_key(base)] > 1 else "")
        if p["front"].get("title") != want:
            failures.append("%s : titre %r au lieu de %r" % (where, p["front"].get("title"), want))
        if len(wiki_titles.get(wiki_key(p["front"].get("title", "")), [])) != 1:
            failures.append("%s : titre %r partagé dans le wiki : %s"
                            % (where, p["front"].get("title"), wiki_titles.get(wiki_key(p["front"].get("title", "")))))
        slug = slug1[id(a)] + ("-%d" % a["rang"] if slug1_count[slug1[id(a)]] > 1 else "")
        if p["id"] != CAP_CATEGORY + "/" + slug:
            failures.append("%s : identifiant %s au lieu de capacites/%s" % (where, p["id"], slug))
    renamed = sum(1 for _, a in flat if a["page"] is not None and a["page"]["front"].get("title") != base_title[id(a)])
    check("titres (clé de wiki) et identifiants uniques ; suffixes seulement en cas de doublon", failures,
          "%d titres avec « , niveau N »" % renamed)

    # pages de classes : tableaux d'aptitudes retirés, tout le reste conservé
    failures = []
    for name in class_names:
        path = os.path.join(out, CATEGORY, slugify(name) + ".md")
        if not os.path.isfile(path):
            failures.append("%s : page de classe absente (%s)" % (name, path))
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        for forbidden in ("## Aptitudes de la classe", "## Autres aptitudes", "### Cartouches", "colonne (", "| Niveau | Aptitude",
                          "Disposition dans le classeur d'origine", "| Lvl "):
            if forbidden in text:
                failures.append("%s : la page de classe contient encore %r" % (name, forbidden))
        page_lines = [v_unescape(l.strip()) for l in text.split("\n")]
        flat_text = fold(v_flat(" ".join(page_lines)))
        cells, _ = v_read_sheet(sheets[name])
        used = set().union(*[a["used"] for a in expected[name]]) if expected[name] else set()
        for pos in sorted(cells):
            if pos in used:
                continue
            first = v_flat(v_unescape(cells[pos].split("\n")[0]))
            if fold(first) not in flat_text:
                failures.append("%s!%s : texte du classeur perdu dans la page de classe : %r" % (name, ref_of(*pos), first[:70]))
        banner_names = sorted(v for (r, c), v in cells.items() if r == V_ROW_BANNIERES and c < V_COL_TEXTES)
        headings = {l for l in page_lines if l.startswith("### ")}
        if banner_names and "## Sous-classes" not in page_lines:
            failures.append("%s : section « Sous-classes » absente" % name)
        for b in banner_names:
            if "### " + b not in headings:
                failures.append("%s : titre de sous-classe « %s » absent" % (name, b))
    check("pages de classes sans tableaux d'aptitudes, tout le reste du classeur conservé", failures)

    # (5) aucune cellule non reconnue ; mêmes anomalies que le script ; (6) rien à changer sur disque
    failures = list(errors)
    built = None
    try:
        built = build(sheets, class_names, links)
        failures += ["script : " + p for p in built["problems"]]
    except ValueError as err:
        failures.append("script : %s" % err)
    if built is not None:
        if sorted((n["tab"], n["ref"], n["text"], n["page"]) for n in built["notes"]) != \
                sorted((n["tab"], n["ref"], n["text"], n["page"]) for n in placed):
            failures.append("notes rattachées différentes entre le script et le recalcul indépendant :\n      script : %r\n      recalcul : %r"
                            % (sorted((n["tab"], n["ref"], n["page"]) for n in built["notes"]),
                               sorted((n["tab"], n["ref"], n["page"]) for n in placed)))
        if sorted(built["anomalies"]) != sorted(anomalies):
            failures.append("anomalies différentes entre le script et le recalcul indépendant :\n      script : %r\n      recalcul : %r"
                            % (sorted(built["anomalies"]), sorted(anomalies)))
    check("(5) aucune cellule non reconnue (parse_class), rôle décidable partout, mêmes anomalies que le recalcul", failures)
    results.append(("anomalies de disposition recalculées (non bloquantes)", [], "\n".join(
        "      - %s | %s | %s" % a for a in anomalies) or "      (aucune)"))
    failures = []
    if built is not None and sorted(built["observations"]) != sorted(observations):
        failures.append("observations différentes entre le script et le recalcul indépendant :\n      script : %r\n      recalcul : %r"
                        % (sorted(built["observations"]), sorted(observations)))
    by_kind = {}
    for kind, _, _ in observations:
        by_kind[kind] = by_kind.get(kind, 0) + 1
    check("(5 bis) noms coupés sur plusieurs cellules : mêmes observations que le recalcul indépendant (listées, non résolues)",
          failures, "; ".join("%d x %s" % (n, k) for k, n in sorted(by_kind.items())) or "aucune")

    failures = []
    if built is not None and not built["problems"]:
        wanted_paths = set()
        for category, slug, title, body, n in built["jobs"]:
            path = os.path.join(out, category, slug + ".md")
            wanted_paths.add(path)
            try:
                with open(path, encoding="utf-8") as fh:
                    on_disk = fh.read()
            except OSError:
                failures.append("%s : absent" % path)
                continue
            if on_disk != body:
                failures.append("%s : différent de ce que le script écrirait (une relance changerait ce fichier)" % path)
        for category in (CATEGORY, CAP_CATEGORY):
            folder = os.path.join(out, category)
            for fname in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
                full = os.path.join(folder, fname)
                if fname.endswith(".md") and is_ours(full) and full not in wanted_paths:
                    failures.append("%s : page orpheline (plus produite par le script)" % full)
    else:
        failures.append("génération en mémoire impossible")
    check("(6) pages sur disque = pages que le script écrirait (une seconde exécution ne change rien)", failures,
          "%d pages comparées" % (len(built["jobs"]) if built is not None else 0))

    ok = True
    for label, failures, info in results:
        ok = ok and not failures
        print("%s %s%s" % ("OK    " if not failures else "ÉCHEC ", label, " : " + info if info and "\n" not in info else ""))
        if info and "\n" in info:
            print(info)
        for line in failures[:12]:
            print("      " + line)
        if len(failures) > 12:
            print("      … %d autres" % (len(failures) - 12))
    for name, got in shown:
        print("%s produit : classe %r ; spécialités %r ; lignes %r" % (name, got["classe"], got["specialites"], got["lignes"]))
    print("VÉRIFICATION %s" % ("RÉUSSIE" if ok else "ÉCHOUÉE"))
    return 0 if ok else 1


def load_dumps(paths):
    """-> (sheets {nom: onglet brut}, ordre des onglets, dossiers des dumps)."""
    sheets, order, dump_dirs = {}, [], []
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        dump_dirs.append(os.path.dirname(os.path.abspath(path)))
        for raw in data["sheets"]:
            if raw["name"] not in sheets:
                sheets[raw["name"]] = raw
                order.append(raw["name"])
    if SUMMARY_SHEET not in sheets:
        sys.exit("onglet %r absent du dump" % SUMMARY_SHEET)
    return sheets, order, dump_dirs


def locate_xlsx(args, dump_dirs):
    """-> chemin du classeur .xlsx d'origine (option --xlsx, sinon à côté du dump), ou None avec --sans-liens. Arrêt s'il est
    introuvable : ses hyperliens (le dump ne les contient pas) et le recoupement des notes en dépendent."""
    if args.sans_liens:
        return None
    xlsx = args.xlsx
    if not xlsx:
        for d in dump_dirs:
            cand = os.path.join(d, os.pardir, "sheets", FILE_ID, "classeur.xlsx")
            if os.path.isfile(cand):
                xlsx = cand
                break
    if not xlsx or not os.path.isfile(xlsx):
        sys.exit("classeur .xlsx introuvable (option --xlsx) : les hyperliens de cellule en dépendent (le dump ne les contient pas) "
                 "(ou passer --sans-liens)")
    return xlsx


def load_links(xlsx):
    """-> hyperliens externes de cellule {onglet: {ref: url}}, lus dans le .xlsx d'origine (None : --sans-liens, aucun lien) : le
    dump ne les contient pas. Les notes, elles, viennent du dump (le classeur ne sert qu'à les recouper, voir crosscheck_notes)."""
    if xlsx is None:
        return {}
    try:
        return read_links(xlsx)
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, ET.ParseError) as err:
        sys.exit("ERREUR : classeur %s : %s" % (xlsx, err))


def build(sheets, class_names, links):
    """Calcule toutes les pages à produire, sans rien écrire (ValueError sur une cellule non reconnue, une note sans place, une
    disposition indécidable ou un nom impossible à rendre unique).

    -> dict(summary, jobs=[(catégorie, slug, titre, corps, n)], caps=[capacités], anomalies=[tuples],
            observations=[tuples], collisions=[textes], problems=[textes],
            notes_dump={onglet: {adresse: texte}}, notes=[dict(tab, ref, text, page)] les notes rattachées à une fiche)
    """
    dump_notes = collect_notes(sheets, class_names)
    problems = []
    summary = parse_summary(Sheet(sheets[SUMMARY_SHEET]), set(class_names))
    in_summary = [n for n, _ in summary["classes"]]
    if sorted(in_summary) != sorted(class_names):
        raise ValueError("onglets de classe et classes du Sommaire différents : %s"
                         % sorted(set(class_names) ^ set(in_summary)))
    category_of = dict(summary["classes"])

    jobs, caps, anomalies = [], [], []
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
            attach_notes(sh, page, dump_notes.get(name, {}))
            attach_links(sh, page, links.get(name, {}))
            body = render_class(cfg, page)
            found, found_anomalies = derive_capacities(name, page)
        except ValueError as err:
            problems.append(str(err))
            continue
        for cap in found:
            cap["class_slug"] = cfg["slug"]
        caps += found
        anomalies += found_anomalies
        jobs.append((CATEGORY, cfg["slug"], title, body, len(found)))
    jobs.append((GLOSSARY_CATEGORY, GLOSSARY_SLUG, GLOSSARY_TITLE,
                 render_glossary(summary["glossary_title"], summary["glossary"]), len(summary["glossary"])))
    collisions = []
    try:
        collisions = name_capacities(caps, [wiki_key(job[2]) for job in jobs])
    except ValueError as err:
        problems.append(str(err))
    notes = []
    if not problems:
        for cap in caps:
            jobs.append((CAP_CATEGORY, cap["slug"], cap["title"], render_capacity(cap), 1))
        notes = [dict(tab=cap["sheet"], ref=ref, text=text, page=cap["id"]) for cap in caps for ref, text in cap["ab"]["notes"]]
        problems += check_note_coverage(dump_notes, notes, {"%s/%s" % (job[0], job[1]): job[3] for job in jobs})
    return dict(summary=summary, jobs=jobs, caps=caps, anomalies=anomalies, observations=name_observations(caps),
                collisions=collisions, problems=problems, notes_dump=dump_notes, notes=notes)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « classes » et « capacités » du wiki depuis le dump de « %s »."
                                 % WORKBOOK)
    ap.add_argument("--dump", action="append", required=True, help="dump JSON de xlsx_to_json.py (répétable)")
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--xlsx", help="classeur d'origine : sert aux hyperliens de cellule et à recouper les notes du dump "
                                       "(les notes écrites dans les pages viennent du dump)")
    group.add_argument("--sans-liens", action="store_true",
                        help="ne pas lire le classeur : ni hyperliens ni recoupement des notes, aucun .xlsx n'est alors nécessaire "
                             "(classeur de test)")
    ap.add_argument("--out", required=True, help="racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : contrôle les pages déjà écrites contre le dump (relecture indépendante)")
    args = ap.parse_args(argv)

    if args.verifier:
        return verify(args)

    sheets, order, dump_dirs = load_dumps(args.dump)
    class_names = [n for n in order if n != SUMMARY_SHEET and n not in IGNORED_SHEETS]
    xlsx = locate_xlsx(args, dump_dirs)
    links = load_links(xlsx)
    if xlsx is None:
        print("AVERTISSEMENT : --sans-liens : le classeur .xlsx n'est pas lu, les hyperliens sont écartés et les notes du dump ne sont "
              "pas recoupées avec celles du classeur", file=sys.stderr)
    else:   # une note perdue par le dump ne doit pas passer en silence : rien n'est écrit en cas d'écart
        comments, failure = read_xlsx_comments(xlsx)
        gaps, changed, n_xlsx = crosscheck_notes(sheets, comments) if failure is None else ([failure], [], 0)
        for text in changed:
            print("AVERTISSEMENT : " + text, file=sys.stderr)
        if gaps:
            for text in gaps:
                print("ERREUR : " + text, file=sys.stderr)
            return 1
        print("recoupement des notes avec le classeur : %d notes de cellule, mêmes adresses que dans le dump" % n_xlsx)

    try:
        built = build(sheets, class_names, links)
    except ValueError as err:
        sys.exit("ERREUR : %s" % err)
    problems = list(built["problems"])
    jobs = built["jobs"]
    for ref, text in built["summary"]["usage"]:
        print("non publié : %s!%s « %s » (consigne d'usage des liens internes du classeur)" % (SUMMARY_SHEET, ref, text))

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
    if not built["notes_dump"]:
        # Un dump sans aucune note (produit par un xlsx_to_json.py antérieur à la lecture des commentaires) effacerait en silence
        # les notes déjà écrites : on s'arrête plutôt que d'écraser les fiches.
        kept = 0
        folder = os.path.join(args.out, CAP_CATEGORY)
        for fname in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            full = os.path.join(folder, fname)
            if fname.endswith(".md") and is_ours(full):
                with open(full, encoding="utf-8") as fh:
                    kept += len(note_segments(fh.read()))
        if kept:
            problems.append("le dump ne contient aucune note de cellule alors que %d fiche(s) en portent déjà : dump produit sans les "
                            "notes (xlsx_to_json.py ancien) ? rien n'est écrit, pour ne pas les effacer" % kept)
    if problems:
        for p in problems:
            print("ERREUR : " + p, file=sys.stderr)
        return 1

    counts = {}   # catégorie -> [écrites, inchangées]
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
        counts.setdefault(category, [0, 0])[0 if old != body else 1] += 1
        if category != CAP_CATEGORY:   # les capacités (une page chacune) sont comptées par catégorie, pas listées
            print("%s %s (%d %s)" % ("inchangé" if old == body else "écrit", path, n,
                                      "objets" if category == GLOSSARY_CATEGORY else "capacités"))
    written = {os.path.join(args.out, c, s + ".md") for c, s, _, _, _ in jobs}
    for category in (CATEGORY, CAP_CATEGORY):
        folder = os.path.join(args.out, category)
        for fname in sorted(os.listdir(folder)) if os.path.isdir(folder) else []:
            full = os.path.join(folder, fname)
            if fname.endswith(".md") and full not in written and is_ours(full):
                print("orphelin (non effacé) : %s" % full)
    for category in (CATEGORY, CAP_CATEGORY, GLOSSARY_CATEGORY):
        w, u = counts.get(category, [0, 0])
        print("bilan %s : %d pages (%d écrites, %d inchangées)" % (category, w + u, w, u))
    print("notes de cellule : %d dans le dump, %d placées, %d écrites" % (
        sum(len(v) for v in built["notes_dump"].values()), len(built["notes"]),
        sum(len(note_segments(job[3])) for job in jobs)))
    for kind, sheet, detail in built["anomalies"]:
        print("anomalie de disposition : %s | %s | %s" % (kind, sheet, detail))
    if not built["anomalies"]:
        print("anomalie de disposition : aucune")
    for kind, sheet, detail in built["observations"]:
        print("observation : %s | %s | %s" % (kind, sheet, detail))
    counts_obs = {}
    for kind, _, _ in built["observations"]:
        counts_obs[kind] = counts_obs.get(kind, 0) + 1
    for kind in sorted(counts_obs):
        print("observations (bilan) : %d x %s" % (counts_obs[kind], kind))
    for text in built["collisions"]:
        print("collision : " + text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
