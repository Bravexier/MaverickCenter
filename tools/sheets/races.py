#!/usr/bin/env python3
"""Famille « races » : une page du wiki par race (27 races), dans `<out>/races/<slug>.md`.

Usage (bibliothèque standard uniquement ; relançable, mêmes fichiers à l'identique) :

    python3 -I tools/sheets/races.py --dump <races-index.json> --dump <fiche-auto-v15.json> --dump <les-races.json> \
        --out /home/user/MaverickCenter/client/src/content/wiki

Les trois dumps sont obligatoires ; chacun est reconnu à son contenu (l'ordre des `--dump` n'a pas d'importance) :
l'index des races (une seule feuille), la fiche personnage (onglets « Race », « Bonus Race », « Accessibilité de
Classe », « Accessibilité Magie ») et le classeur « Les races » lu onglet par onglet (un onglet par race, plus les onglets
« Statistique », « Relation entre les races », « Modèle » et, selon l'export, « Sommaire »). Les dumps JSON sont produits
par tools/sheets/xlsx_to_json.py ou sheets_api_to_json.py (format : voir ces scripts). Les cellules sont une donnée non
fiable : elles ne sont jamais exécutées, seulement copiées (échappées pour le Markdown). Aucune valeur n'est calculée,
corrigée ni complétée, à une exception près, explicite et signalée (RACE_DETAIL_OVERRIDES, voir plus bas).

POLITIQUE DE PRIORITÉ (décision du propriétaire du projet) : l'onglet de la race du classeur « Les races » PRIME sur la
« Fiche personnage Maverick Auto V15.2.2 » quand les deux divergent (la fiche est en retard : par exemple le Nain y a 15
magies innées alors que son onglet en limite le nombre à 5, ou le Drakos y a Santé 10 / Chakra 13 alors que son onglet dit
13 / 10). Chaque page affiche les valeurs de l'onglet ; la section « Écarts avec la fiche de personnage V15.2.2 » liste,
sous forme de tableau (onglet à gauche, fiche à droite), ce que la fiche dit de différent, la valeur de la fiche étant
citée telle qu'écrite : rien n'est tranché en silence, dans un sens comme dans l'autre. La section est absente quand il
n'y a aucun écart. Écarts recherchés, automatiquement : les quatre valeurs de départ (Santé, Chakra, Barrière bonus,
Vitesse sol puis nage, comparées numériquement), le don de base, la capacité Mode Hyper (texte seulement : la fiche n'en
donne pas le nom), les magies innées (liste citée par la ligne « Inconvénient(s) » de l'onglet contre la matrice
« Accessibilité Magie »), et, pour chaque ethnie rapprochée (voir plus bas), son nom, le nom de son don et le texte de son
don. Les colonnes qui n'existent que dans la fiche (AP, AM, Divers, Restrictions, sous-races avec leurs bonus chiffrés et
résistances, matrices de classes et de magies) restent affichées telles quelles, étiquetées « (fiche) » quand elles
côtoient des valeurs de l'onglet. Le texte libre « accès à toutes les magies / classes » des onglets n'est pas comparé aux
matrices (ce n'est pas une liste).

Sources (classeurs Google, propriété d'un tiers) :

  1. Google Sheet « Les races » (1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4), deux lectures :
       * la PREMIÈRE FEUILLE (index) : une ligne par race, A = nom de la race, B = phrase de présentation. 27 lignes, sans
         en-tête. L'ordre de cette feuille donne l'ordre de traitement ; la phrase est le `summary` de la page ;
       * un ONGLET PAR RACE (27 onglets, lus onglet par onglet : le classeur entier, 34 Mo, dépasse la limite d'export).
         L'onglet « Namazus » est la race Namazu (RACE_TAB_NAMES). Gabarit d'un onglet (disposition lue par libellés, les
         numéros de ligne varient d'une race à l'autre : le Farfadet et le Goleois ont une ligne de moins) :
           N1 titre en majuscules (décoratif : « ROKHS » pour Rokh) ; AK1 « HISTOIRE » et son texte en AK3 ; la description
           générale en A4 ; « DONNÉES » puis la ligne des quatre valeurs de départ (Santé de départ, Chakra de départ,
           Barrière bonus, Vitesse Sol/Nage : deux valeurs, sol puis nage) ; « Avantage(s) » (A, texte en H) ;
           « Inconvénient(s) » ; « Don B (Base) » ; « Don R (Race) » puis le bloc des dons raciaux ; « Capacité Mode Hyper »
           (nom de la capacité en A, texte en H, deux lignes plus bas) ; à droite (colonne AK) « DESCRIPTION » (AK28) et son
           texte (AK30), un seul bloc par race : physique et culture, pas une description par ethnie.
         Le bloc des dons raciaux a quatre formes, reconnues strictement et rendues dans « Ethnies et dons raciaux » :
           - tableau d'ethnies (la plupart des races) : en-tête « Type » (+ « Nom ») ou « Condition d'origine » ou « Magie
             innée », puis « Don » ; une ligne par ethnie : A = type / condition / magie, H = nom du don (facultatif),
             O = texte du don ;
           - don unique (Elfe doré, Majin, Hujin, Lamia) : nom en A, texte en H, pas de tableau ;
           - don unique puis tableau en deux panneaux (Mort-vivant : « Trompe-mort », puis lieu de résurrection / raison de
             la mort -> don, deux panneaux côte à côte, lus panneau gauche puis panneau droit) ;
           - nom du don sur la ligne « Don R (Race) » puis tableau en deux panneaux (Drakos : « Écaille draconique », magie
             innée -> AP/AM, bonus de compétence, +1 cran de résistance).
         Une disposition inconnue (cellule hors gabarit, libellé en double, panneaux différents, valeur de départ non
         numérique...) arrête le script avec la cellule en cause : rien n'est perdu en silence.
       Onglets NON PUBLIÉS (DETAIL_NOT_PUBLISHED, structure vérifiée à chaque exécution : si elle change, le script s'arrête
       au lieu de laisser une justification devenue fausse) : « Statistique » = compteurs d'usage des races (« Races (nombre
       de fois prise) » : un nombre par race, des statistiques de table de jeu, ni règle ni lore) ; « Modèle » = gabarit
       vide des onglets (quatorze libellés, aucune donnée : il sert à contrôler les libellés ignorables) ; « Relation entre
       les races » = matrice des relations entre races, hors du périmètre « détail des races » (pas de page par race) ;
       « Sommaire » (si le dump le contient) = l'index, déjà lu. Les ILLUSTRATIONS des onglets (images) ne sont pas dans les
       dumps : elles ne sont pas importées.

  2. Google Sheet « Fiche personnage Maverick Auto V15.2.2 » (1SvzNbdDVQyLE9cyp9U5USHBsxHpwxhtaWrFTu9CpLY4), onglets
     MASQUÉS :
       * « Race » : une ligne par race (lignes 2 à 28, nom en A), en-têtes en ligne 1 (A1 vide) :
           B Santé, C Chakra départ, D Barrière bonus, E Vitesse sur terre, F Vitesse de Nage, G Divers, H AP, I AM,
           puis six paires (opérateur « < ou > », valeur « Restrictions <caractéristique> ») :
           J/K Force, L/M Volonté, N/O Intélligence, P/Q Perception, R/S Social, T/U Agilité,
           V Don base, W Capacité Hyper.
         Les cellules « = » de Mort-vivant (L13, R13) sont du texte (le dump les marque à tort comme formule).
       * « Bonus Race » : 96 lignes (2 à 97), une par sous-race / origine. A = Race, B = nom de la sous-race (SANS
         en-tête dans la source), C = Nom, D = Descriptif, E à H = Nom/Valeur résistance 1 et 2, I à N = Bonus PV,
         Chakra, Barrière, AP, AM, Vitesse. Les colonnes I à N sont des formules (extraction par expression régulière
         du descriptif) : les valeurs en cache sont reprises telles quelles (« 3 » en texte, « 1.0 » en nombre) ; une
         valeur en cache vide reste absente. Les lignes 98 à 239 ne portent que des formules à valeur vide.
       * « Accessibilité de Classe » : matrice 27 races (lignes 2 à 28) x 39 classes (colonnes B à AN), valeurs 0/1.
       * « Accessibilité Magie » : matrice 27 races x 15 magies (colonnes B à P), valeurs 0/1.

CORRESPONDANCE DES ETHNIES (ETHNIE_FICHE) : l'onglet de la race et « Bonus Race » ne nomment pas les ethnies pareil
(« Londolor Ouest » de l'onglet = « Nain Ouest » de la fiche ; « Sang en innée » = « Orios de Sang » ; les couleurs des
Drakos n'existent que dans la fiche). Une table EXPLICITE donne, pour chaque race, l'ethnie de l'onglet (première ligne de
sa cellule : « Farfadet Médian » pour « Farfadet Médian / (Forêts tempérées, centraux) ») et la sous-race de la fiche
(colonne B de « Bonus Race ») qui lui correspond ; `None` = ethnie de l'onglet sans équivalent dans la fiche (le don
« Trompe-mort » du Mort-vivant, qui vaut pour toute la race). Le script la VÉRIFIE avant d'écrire : mêmes ethnies que
l'onglet (ni manquante ni en trop), cibles existantes et distinctes, aucune sous-race de la fiche laissée sans
correspondance (sinon la déclarer dans ETHNIES_FICHE_SEULES), et au moins un INDICE par paire (même nom une fois retiré
« en innée » et l'astérisque de note, même nom de don, même texte de don, mêmes lignes de bonus, ou même cause de mort).
Chaque ethnie rapprochée affiche la sous-race de la fiche qui lui correspond, et la section « Sous-races et origines »
(fiche, avec bonus chiffrés et résistances) reste sous les yeux, comme auparavant.

CONTRÔLE DE COUVERTURE : chaque cellule non vide des 27 onglets de race doit se retrouver dans la page de sa race (texte
normalisé : espaces, casse, guillemets, échappements Markdown ; une cellule courte doit être une unité entière : cellule
de tableau, titre, élément de liste, valeur d'un « **Libellé** : valeur ») dans la section prévue pour elle, ou être
déclarée ignorée avec sa raison : titre décoratif répétant le nom de la race (N1), étiquettes de gabarit qui ne sont pas
rendues telles quelles (« DONNÉES », « Don B (Base) », « Don R (Race) », vérifiées contre l'onglet « Modèle »), caractères
isolés hors gabarit déclarés un par un (STRAY_CELLS : « ( » en A1 du Drakos, « u » en BU1 du Minotaure). Le script
s'arrête avant d'écrire si une cellule n'est pas appariée, et imprime le rapport : couverture par race, cellules
ignorées avec leur raison, cellules non appariées. Les sections simples (Présentation, Histoire, Description, Avantage(s) et
inconvénient(s), Don de base, Capacité Mode Hyper, tableau des valeurs de départ) sont de plus comparées en entier
(pas un simple « contient »), pour qu'une valeur de départ ne soit pas validée par la colonne voisine.

VÉRIFICATION CROISÉE DES MAGIES : la ligne « Inconvénient(s) » de chaque onglet est lue pour les magies citées « en
innée » (« Magie Terre, Eau et Sang en innée », « Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné
uniquement ») ; les noms sont rapprochés des 15 en-têtes de la matrice (« Temps/Espace » = « Espace/Temps », MAGIC_ALIASES),
et la liste citée doit être exactement `magies_innees` de la page (même ensemble). Un écart arrête le script (et
--verifier) : il faudrait une exception explicite, jamais un repli silencieux. Le rapport signale aussi, pour information,
le connecteur de l'onglet (« et » ou « ou » : l'onglet ne dit pas la même chose pour l'Orios que pour le Kitsune ; ce
script ne l'interprète pas) et les races dont la ligne parle de magie sans la lister (Drakos, Lamia).

EXCEPTION DOCUMENTÉE (RACE_DETAIL_OVERRIDES) : le Nain. Décision du propriétaire du projet : l'onglet de la race prime.
L'onglet « Nain », lu directement, limite la magie innée du Nain à « Magie du Feu, Terre, Foudre, Arcane, Potentiel
illimité en inné uniquement », alors que la matrice « Accessibilité Magie » de la fiche (V15.2.2) donne 15 sur 15 : la
liste du Nain est donc « Potentiel Illimité, Arcane, Feu, Terre, Foudre » (ordre des colonnes) et la page écrit l'écart
dans « Magies accessibles » (paragraphe d'écart) comme dans « Écarts avec la fiche de personnage V15.2.2 ». Ses sections
Présentation, Avantage(s) et inconvénient(s) viennent du chemin générique, comme celles des autres races, et sa source
est l'onglet (plus aucune capture d'écran). L'exception ne vaut que pour la race nommée ; la fiche reste citée comme source
de la page. Le rapport la signale : « Nain : matrice = 15 magies, onglet Nain de Les races = 5 : exception appliquée ». Si
la matrice rejoint un jour l'onglet, l'exception devient redondante et le script s'arrête (il faut la retirer).

Option `--verifier` : n'écrit rien. Recalcule `magies_innees` directement depuis le dump brut (sans passer par le code
de lecture du script), applique les exceptions de RACE_DETAIL_OVERRIDES, compare aux pages déjà écrites, relit les onglets,
refait le contrôle de couverture, la vérification croisée des magies, la vérification de la table des ethnies, recalcule
à part les écarts de valeurs de départ, compare chaque page à sa régénération, puis rejoue des cas d'erreur sur des copies
modifiées de la matrice, de la constante d'exceptions, des onglets (dispositions inconnues), de la table des ethnies, des
lignes « Inconvénient(s) » et des pages. Il exige : (a) l'exception du Nain existe et diffère de la matrice (sinon elle est
redondante) ; (b) ses noms sont tous des en-têtes de la matrice (MAGIC_HEADERS), sans doublon, dans l'ordre des colonnes ;
(c) `magies_innees` de la page du Nain, la liste et le nombre de sa section « Magies accessibles » sont l'exception, avec
le paragraphe d'écart ; (d) toutes les autres races restent conformes à la matrice. Code de sortie non nul au moindre
écart. Sans cette option, les mêmes contrôles sont faits avant l'écriture (sur les textes en mémoire) et après (sur les
fichiers) : un écart arrête le script.

Frontmatter (contrat avec le site, qui lit ces champs structurés ; le corps Markdown ne dépend pas d'eux) :
    `summary` = la phrase de l'index ;
    `sources` = les deux entrées de la première feuille, l'entrée « Google Sheet « Les races », onglet « <nom de
    l'onglet> » », puis celles de la fiche ;
    `magies_innees: ["Sang", "Eau", "Terre"]` = les en-têtes de l'onglet « Accessibilité Magie » (B1:P1 : « Potentiel
    Illimité », « Sang », « Arcane », « Corruption », « Espace/Temps », « Vide », « Nécromancie », « Feu », « Eau »,
    « Glace », « Terre », « Vent », « Foudre », « Lumière », « Ombre ») dont la valeur vaut 1 sur la ligne de la race,
    dans l'ordre des colonnes, écrits comme l'en-tête (ce sont les noms courts des pages de magies). C'est la même
    liste que celle de « Magies accessibles » dans le corps. Une valeur ni 0 ni 1, une race de la matrice sans page,
    ou une race de l'index absente de la matrice arrête le script (pas de repli).
    Pour une race à exception (le Nain), c'est la liste de l'exception qui remplace celle de la matrice, dans le
    frontmatter comme dans le corps.

Page produite pour chaque race (les sections vides sont omises) :
    phrase de l'index (aussi `summary`) ; « Présentation » (A4) ; « Histoire » (AK3) ; « Description » (AK30) ;
    « Caractéristiques de départ » (valeurs de l'onglet, puis AP et AM de la fiche, étiquetés « (fiche) », puis « Divers
    (fiche) ») ; « Avantage(s) et inconvénient(s) » (onglet) ; « Restrictions » (fiche) ; « Don de base » (onglet) ;
    « Ethnies et dons raciaux » (onglet ; une sous-section par ethnie avec la sous-race de la fiche qui lui correspond, ou le
    don unique, ou les tableaux) ; « Capacité Mode Hyper » (onglet) ; « Sous-races et origines » (fiche : une sous-section
    par ligne de « Bonus Race », avec Nom, Descriptif et un tableau des colonnes non vides) ; « Classes accessibles » et
    « Magies accessibles » (nombre, puis noms dont la valeur est 1 ; [exception : paragraphe d'écart]) ; « Écarts avec la
    fiche de personnage V15.2.2 » (voir plus haut).
    Rapport (sortie standard) : nombre de pages, une ligne par exception appliquée, répartition des races par nombre de
    magies innées, onglets non publiés, couverture par race et cellules ignorées ou non appariées, vérification croisée
    des magies, écarts avec la fiche par race.

Rapprochement des noms de races : l'index, « Race » et les deux matrices écrivent les 27 noms de façon identique ; seul « Bonus
Race » diffère (casse « Elfe Forestier », espace final « Satyre », coquille « Felfle »). La clé de comparaison est celle
du wiki (minuscules, sans accents ni apostrophes) ; les seules correspondances forcées sont RACE_NAME_FIXES
(« Felfle » -> « Felfe », confirmée par les noms de sous-races de la colonne B : « Felfe Forestier », etc.) et
RACE_TAB_NAMES (onglet « Namazus » -> race « Namazu »). Si la colonne « Race » de « Bonus Race » s'écrit autrement que le
nom de la race, une ligne le signale dans la page.

Le script s'arrête avec une erreur si une cellule non vide d'un onglet du périmètre n'est pas reconnue (rien n'est perdu
en silence), si un nom de race n'a pas de correspondance (race sans onglet, onglet inconnu), si une valeur de matrice n'est
ni 0 ni 1, si un titre est déjà porté par une page d'une autre famille, si un fichier existant n'est pas issu de ce
classeur, ou si `races/` contient une page issue de ce classeur dont la race n'est plus dans l'index.

Il ne touche qu'aux fichiers `<out>/races/<slug>.md` de sa famille : il n'efface rien, ne réécrit pas un fichier dont le
contenu ne change pas. Aucun lien [[…]] n'est écrit (une cellule qui en contiendrait serait neutralisée et signalée sur
la sortie d'erreur).
"""
import argparse
import copy
import json
import os
import re
import sys
import unicodedata

CATEGORY = "races"
STATUS = "draft"
TAGS = ["race"]

INDEX_TITLE = "Les races"
INDEX_ID = "1KXO4Np9SnaOYopV1cUKsO-MPjNxgyJ39BEyDAai1Kg4"
INDEX_TAB = "première feuille"
FICHE_TITLE = "Fiche personnage Maverick Auto V15.2.2"
FICHE_ID = "1SvzNbdDVQyLE9cyp9U5USHBsxHpwxhtaWrFTu9CpLY4"
TAB_RACE, TAB_BONUS, TAB_CLASS, TAB_MAGIE = "Race", "Bonus Race", "Accessibilité de Classe", "Accessibilité Magie"
FICHE_TABS = (TAB_RACE, TAB_BONUS, TAB_CLASS, TAB_MAGIE)

# Champ de frontmatter lu par le site : magies innées de la race (en-têtes de TAB_MAGIE dont la valeur vaut 1).
MAGIC_FIELD = "magies_innees"
# Noms courts des 15 magies, tels qu'écrits dans B1:P1 de TAB_MAGIE (contrat avec les pages de magies ; --verifier).
MAGIC_HEADERS = ("Potentiel Illimité", "Sang", "Arcane", "Corruption", "Espace/Temps", "Vide", "Nécromancie", "Feu",
                 "Eau", "Glace", "Terre", "Vent", "Foudre", "Lumière", "Ombre")

# EXCEPTIONS DE DÉTAIL : décision du propriétaire du projet (l'onglet de la race prime sur la fiche).
# L'onglet « Nain » du classeur « Les races » (lu directement) limite la magie innée du Nain à cinq magies (ligne
# « Inconvénient(s) » : « Magie du Feu, Terre, Foudre, Arcane, Potentiel illimité en inné uniquement. »), alors que la
# matrice « Accessibilité Magie » de la fiche V15.2.2 donne 15 sur 15 (ligne Nain tout à 1) : la fiche est en retard sur ce
# point. L'exception REMPLACE la matrice POUR CETTE RACE SEULEMENT ; elle n'est jamais silencieuse : la page écrit l'écart
# (« Magies accessibles » et « Écarts avec la fiche de personnage V15.2.2 »), le rapport du script le signale, et
# --verifier l'exige (existence, différence avec la matrice, ordre des colonnes, page conforme, liste identique à celle
# que cite l'onglet). Si la fiche est un jour corrigée, l'exception devient redondante : le script et --verifier
# s'arrêtent, il faut alors la retirer en connaissance de cause. Une autre race dont l'onglet citerait une liste différente
# de la matrice arrête aussi le script : il faudrait une exception explicite pour elle, jamais un repli silencieux.
# Clé = nom de la race tel qu'écrit dans l'index. Champ unique (OVERRIDE_FIELDS) :
#   magies_innees : liste qui remplace la matrice (noms de MAGIC_HEADERS, dans l'ordre des colonnes).
# Les sections Présentation, Avantage(s) et inconvénient(s) du Nain viennent de son onglet, par le chemin générique.
RACE_DETAIL_OVERRIDES = {
    "Nain": {
        "magies_innees": ["Potentiel Illimité", "Arcane", "Feu", "Terre", "Foudre"],
    },
}
# Races dont l'exception DOIT exister (--verifier échoue sinon : on ne revient pas à la matrice en silence).
OVERRIDES_REQUIS = ("Nain",)
# Champs obligatoires d'une exception.
OVERRIDE_FIELDS = ("magies_innees",)


def source_url(file_id):
    return "https://docs.google.com/spreadsheets/d/%s/edit" % file_id


SOURCES = [
    "Google Sheet « %s », onglet « %s »" % (INDEX_TITLE, INDEX_TAB),
    source_url(INDEX_ID),
    "Google Sheet « %s », onglets %s" % (FICHE_TITLE, ", ".join("« %s »" % t for t in FICHE_TABS)),
    source_url(FICHE_ID),
]

# Correspondances de noms forcées, clé de comparaison (voir normalize) de « Bonus Race » -> clé de l'index.
RACE_NAME_FIXES = {"felfle": "felfe"}

# --------------------------------------------------------------------------------------------------------------------
# Constantes du détail des races (classeur « Les races », un onglet par race)
# --------------------------------------------------------------------------------------------------------------------

# Onglet de race -> race : seule différence de nom, clé de comparaison (voir normalize) de l'onglet -> clé de la race.
# L'onglet « Namazus » est la race Namazu (l'index, la fiche et le wiki écrivent « Namazu »).
RACE_TAB_NAMES = {"namazus": "namazu"}

# Onglets du classeur « Les races » qui ne sont PAS des races et ne sont pas publiés, avec la raison. Leur structure est
# vérifiée à chaque exécution (check_unpublished) : si elle change, le script s'arrête.
TAB_MODELE, TAB_STATS, TAB_RELATIONS, TAB_SOMMAIRE = "Modèle", "Statistique", "Relation entre les races", "Sommaire"
DETAIL_NOT_PUBLISHED = {
    TAB_STATS: "compteurs d'usage des races (« Races (nombre de fois prise) » : un nombre par race), statistiques de table "
               "de jeu : ni règle ni lore",
    TAB_MODELE: "gabarit vide des onglets de race (quatorze libellés, aucune donnée) : il sert à contrôler les libellés "
                "ignorables",
    TAB_RELATIONS: "matrice des relations entre races, hors du périmètre « détail des races » (pas de page par race)",
    TAB_SOMMAIRE: "index des races, déjà lu depuis la première feuille",
}
# Libellés du gabarit (onglet « Modèle ») : exactement ceux-là, sinon le gabarit a changé et le script s'arrête.
TEMPLATE_LABELS = frozenset({
    "HISTOIRE", "DONNÉES", "Santé de départ", "Chakra de départ", "Barrière bonus", "Avantage(s)", "Inconvénient(s)",
    "Don B (Base)", "Don R (Race)", "Type", "Nom", "Don", "DESCRIPTION", "Capacité Mode Hyper"})
# Libellés du gabarit que la page ne reprend pas tels quels : ignorés, avec leur raison (vérifiés contre TEMPLATE_LABELS).
IGNORABLE_LABELS = {
    "DONNÉES": "intitulé de zone du gabarit : les quatre valeurs qu'il regroupe forment « Caractéristiques de départ »",
    "Don B (Base)": "étiquette du gabarit : la section s'intitule « Don de base »",
    "Don R (Race)": "étiquette du gabarit : la section s'intitule « Ethnies et dons raciaux »",
}
# Caractères isolés hors gabarit, déclarés un à un : (onglet, cellule) -> (valeur exacte, raison). Une cellule dont la valeur
# diffère n'est PAS ignorée : elle arrête le script comme toute cellule inconnue.
STRAY_CELLS = {
    ("Drakos", "A1"): ("(", "caractère isolé hors gabarit (parenthèse ouvrante seule), sans texte ni nombre"),
    ("Minotaure", "BU1"): ("u", "caractère isolé hors gabarit (« u » seul, loin à droite du gabarit), sans texte ni nombre"),
}

# Gabarit d'un onglet de race : colonnes (A = 1). Panneau gauche = colonnes A..AJ ; panneau droit (HISTOIRE, DESCRIPTION) = AK.
DETAIL_LEFT_MAX = 36
COL_A, COL_H, COL_O, COL_AK, COL_TITLE = 1, 8, 15, 37, 14
PANEL_RIGHT_START, PANEL_OFFSET = 19, 18       # tableaux en deux panneaux : le panneau droit est décalé de 18 colonnes
STAT_LABELS = ("Santé de départ", "Chakra de départ", "Barrière bonus", "Vitesse Sol/Nage")
STAT_VALUE_COUNTS = (1, 1, 1, 2)               # « Vitesse Sol/Nage » porte deux valeurs : sol puis nage
STAT_FICHE_COLS = ((2,), (3,), (4,), (5, 6))   # colonnes de l'onglet « Race » de la fiche : Santé, Chakra, Barrière, terre + nage
ETHNIE_HEADERS = ("Type", "Condition d'origine", "Magie innée")   # intitulés possibles de la première colonne du tableau
LABEL_ADV, LABEL_INC, LABEL_DON_B, LABEL_DON_R, LABEL_HYPER = (
    "Avantage(s)", "Inconvénient(s)", "Don B (Base)", "Don R (Race)", "Capacité Mode Hyper")

# Sections ajoutées par le détail (titres des pages).
SEC_PRES, SEC_HIST, SEC_DESC = "Présentation", "Histoire", "Description"
SEC_STATS, SEC_ADV, SEC_DON = "Caractéristiques de départ", "Avantage(s) et inconvénient(s)", "Don de base"
SEC_ETH, SEC_HYPER, SEC_GAPS = "Ethnies et dons raciaux", "Capacité Mode Hyper", "Écarts avec la fiche de personnage V15.2.2"
SEC_SOUS = "Sous-races et origines"

# Noms de magies écrits dans les onglets autrement que dans les en-têtes de la matrice : clé de comparaison -> nom d'en-tête.
MAGIC_ALIASES = {"temps-espace": "Espace/Temps"}

# CORRESPONDANCE DES ETHNIES : race (nom de l'index) -> {ethnie de l'onglet -> sous-race de la fiche (colonne B de
# « Bonus Race »)}. L'ethnie de l'onglet s'écrit comme la première ligne de sa cellule (« Farfadet Médian » pour
# « Farfadet Médian / (Forêts tempérées, centraux) » ; pour les tableaux en panneaux : la première ligne de la première
# colonne). None = sans équivalent dans la fiche. Vérifiée avant toute écriture (voir ethnie_problems).
ETHNIE_FICHE = {
    "Humain": {
        "Humain Central": "Humain Central",
        "Humain Désertique": "Humain Désertique",
        "Humain Tropical": "Humain Tropical",
        "Humain Toundra": "Humain Toundra",
    },
    "Elfe forestier": {
        "Forêt ou les villes des territoires Elfe forestier": "Elfe Forestier Forêt",
        "Urbain (tout le reste)": "Elfe Forestier Urbain",
    },
    "Elfe noir": {
        "Elfe Charbon": "Elfe Noir Charbon",
        "Elfe Salé": "Elfe Noir Salé",
    },
    "Elfe argenté": {
        "Territoire Elfes Argentés": "Elfe Argenté Supprémaciste",
        "Barrage Argenté": "Elfe Argenté Barrage argenté",
        "Ailleurs": "Elfe Argenté Autre",
    },
    "Elfe doré": {
        "Sang doré": "Elfe Doré",
    },
    "Farfadet": {
        "Farfadet Médian": "Farfadet Médian",
        "Farfadet Maritime": "Farfadet Maritime",
        "Farfadet Amazone": "Farfadet Amazone",
        "Farfadet Alpin": "Farfadet Alpin",
    },
    "Felfe": {
        "Felfe Forestier": "Felfe Forestier",
        "Felfe Noir": "Felfe Noir",
        "Felfe Argenté": "Felfe Argenté",
    },
    "Nain": {
        "Londolor Est": "Nain Est",
        "Londolor Ouest": "Nain Ouest",
        "Londolor Centre (Ligne de partage)": "Nain Ligne de partage",
    },
    "Majin": {
        "Renfermement": "Majin",
    },
    "Hujin": {
        "Élasticité": "Hujin",
    },
    "Drakos": {
        "Potentiel illimité": "Drakos Orange",
        "Sang": "Drakos Bordeau",
        "Arcane": "Drakos Gris",
        "Corruption": "Drakos Noir",
        "Tempe/Espace": "Drakos Rose",
        "Vide": "Drakos Blanc",
        "Nécromancie": "Drakos Vert Foncé",
        "Feu": "Drakos Rouge",
        "Eau": "Drakos Bleu",
        "Glace": "Drakos Cyan",
        "*Vent": "Drakos Vert",
        "Foudre": "Drakos Jaune",
        "*Terre": "Drakos Brun",
        "Lumière": "Drakos Beige",
        "Ombre": "Drakos Mauve",
    },
    "Mort-vivant": {
        "Trompe-mort": None,
        "- Mort par saignement": "Mort-Vivant sang",
        "- Mort par brisement d'os": "Mort-Vivant Nécrotique",
        "- Mort par veillissement accéléré": "Mort-Vivant Espace/Temps",
        "- Mort proche d'une faille temporelle": "Mort-Vivant Vide",
        "- Mort brûlé": "Mort-Vivant Feu",
        "- Mort de froid": "Mort-Vivant Glace",
        "- Mort noyé": "Mort-Vivant Eau",
        "- Mort électrocuté": "Mort-Vivant Foudre",
        "- Mort en altitude": "Mort-Vivant Vent",
        "- Mort enterré vivant": "Mort-Vivant Terre",
        "- Mort au soleil": "Mort-Vivant Lumière",
        "- Mort à la lune": "Mort-Vivant Ombre",
    },
    "Orios": {
        "Sang en innée": "Orios de Sang",
        "Terre en innée": "Orios de Terre",
        "Eau en innée": "Orios d'Eau",
    },
    "Drassah'thac": {
        "Drassah'thac Est": "Drassah'thac Est",
        "Drassah'thac Ouest": "Drassah'thac Ouest",
        "Drassah'thac Nord": "Drassah'thac Nord",
        "Drassah'thac Sud": "Drassah'thac Sud",
        "Drassah'thac Centre": "Drassah'thac Centre",
    },
    "Fenrir": {
        "Glace en innée": "Fenrir de Glace",
        "Foudre en innée": "Fenrir de Foudre",
        "Ombre en innée": "Fenrir d'Ombre",
    },
    "Kitsune": {
        "Feu en innée": "Kitsune Feu",
        "Vent en innée": "Kitsune Vent",
        "Lumière en innée": "Kitsune Lumière",
    },
    "Olwman": {
        "Espace/Temps en innée": "Olwman Espace/Temps",
        "Vent en innée": "Olwman Vent",
        "Ombre en innée": "Olwman Ombre",
    },
    "Rokh": {
        "Vent en innée": "Rokh Vent",
        "Foudre en innée": "Rokh Foudre",
        "Lumière en innée": "Rokh Lumière",
    },
    "Namazu": {
        "Sang en innée": "Namazu Sang",
        "Ombre en innée": "Namazu Ombre",
        "Eau en innée": "Namazu Eau",
    },
    "Minotaure": {
        "Sang en innée": "Minotaure Sang",
        "Ombre en innée": "Minotaure d'Ombre",
        "Terre en innée": "Minotaure de Terre",
    },
    "Satyre": {
        "Terre en innée": "Satyre Terre",
        "Foudre en innée": "Satyre Foudre",
        "Feu en innée": "Satyre Feu",
    },
    "Médusain": {
        "Eau en innée": "Médusain Eau",
        "Foudre en innée": "Médusain Foudre",
        "Lumière en innée": "Médusain Lumière",
    },
    "Lamia": {
        "Écaille solide": "Lamia",
    },
    "Jackalope": {
        "Terre en innée": "Jackalope Terre",
        "Foudre en innée": "Jackalope Foudre",
        "Vide en innée": "Jackalope Vide",
    },
    "Marcass": {
        "Terre en innée": "Marcass Terre",
        "Feu en innée": "Marcass Feu",
        "Nécromancie en innée": "Marcass Nécromancie",
    },
    "Anansi": {
        "Arcane en innée": "Anansi d'Arcane",
        "Nécromancie en innée": "Anansi de Nécromancie",
        "Ombre en innée": "Anansi d'Ombre",
    },
    "Goleois": {
        "Glace en innée": "Goleois de Glace",
        "Lumière en innée": "Goleois de Lumière",
        "Sang en innée": "Goleois de Sang",
    },
}
# Sous-races de la fiche qui n'ont pas d'équivalent dans l'onglet : race -> [noms (colonne B)]. Aucune aujourd'hui.
ETHNIES_FICHE_SEULES = {}

# Colonnes de l'onglet « Race » (numéros à partir de 1).
COL_NAME = 1
RACE_STAT_COLS = (2, 3, 4, 5, 6)           # Santé .. Vitesse de Nage (tableau)
COL_DIVERS = 7
RACE_STAT_COLS_AFTER = (8, 9)              # AP, AM (tableau, après Divers dans la source)
RACE_RESTRICTIONS = ((10, 11), (12, 13), (14, 15), (16, 17), (18, 19), (20, 21))  # (opérateur, valeur)
COL_DON, COL_HYPER = 22, 23
RACE_LAST_COL = 23
OPERATOR_HEADER = "< ou >"

# Colonnes de l'onglet « Bonus Race ».
BONUS_COL_RACE, BONUS_COL_SUB, BONUS_COL_NOM, BONUS_COL_DESC = 1, 2, 3, 4
BONUS_NUM_COLS = tuple(range(5, 15))       # E .. N : résistances et bonus (tableau, colonnes non vides seulement)
BONUS_LAST_COL = 14


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


class Sheet:
    def __init__(self, raw):
        self.name = raw["name"]
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = c["v"]
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
                self.name, ", ".join("L%dC%d=%r" % (r, c, self.cells[(r, c)]) for r, c in left[:10])))


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


def table(headers, row):
    return [
        "| " + " | ".join(cell_md(h) for h in headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
        "| " + " | ".join(cell_md(v) for v in row) + " |",
    ]


def yaml_str(s):
    return json.dumps(s, ensure_ascii=False)


def yaml_list(items):
    return "[" + ", ".join(yaml_str(i) for i in items) + "]"


# --------------------------------------------------------------------------------------------------------------------
# Lecture des dumps
# --------------------------------------------------------------------------------------------------------------------

def load_dumps(paths):
    index_raw = fiche = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            dump = json.load(fh)
        names = [s["name"] for s in dump["sheets"]]
        if all(t in names for t in FICHE_TABS):
            if fiche is not None:
                raise ValueError("deux dumps de la fiche personnage")
            fiche = {s["name"]: Sheet(s) for s in dump["sheets"] if s["name"] in FICHE_TABS}
        elif len(names) == 1:
            if index_raw is not None:
                raise ValueError("deux dumps de l'index des races")
            index_raw = Sheet(dump["sheets"][0])
        else:
            raise ValueError("dump non reconnu : %s (onglets : %s)" % (path, names))
    if index_raw is None or fiche is None:
        raise ValueError("il faut un dump de l'index des races et un dump de la fiche personnage")
    return index_raw, fiche


def read_index(sheet):
    """[(nom, phrase de présentation ou None)] dans l'ordre des lignes."""
    rows = sorted({r for r, _ in sheet.cells})
    races = []
    for r in rows:
        name, text = sheet.take(r, 1), sheet.take(r, 2)
        if name is None:
            raise ValueError("index des races : ligne %d sans nom de race" % r)
        races.append((norm_ws(name), norm_ws(text) if text is not None else None))
    sheet.check_all_consumed()
    names = [normalize(n) for n, _ in races]
    if len(set(names)) != len(names):
        raise ValueError("index des races : noms en double")
    return races


def read_race_tab(sheet, races):
    """{clé de race: {...}} depuis l'onglet « Race »."""
    headers = {}
    for c in range(2, RACE_LAST_COL + 1):
        h = sheet.take(1, c)
        if h is None:
            raise ValueError("%s : en-tête manquant colonne %d" % (sheet.name, c))
        headers[c] = norm_ws(h)
    if sheet.take(1, COL_NAME) is not None:
        raise ValueError("%s : A1 devrait être vide" % sheet.name)
    for op_col, val_col in RACE_RESTRICTIONS:
        if headers[op_col] != OPERATOR_HEADER or not headers[val_col].startswith("Restrictions "):
            raise ValueError("%s : paire de restrictions inattendue (colonnes %d/%d)" % (sheet.name, op_col, val_col))
    keys = {normalize(n): n for n, _ in races}
    data = {}
    rows = sorted({r for r, _ in sheet.cells if r > 1})
    for r in rows:
        name = sheet.take(r, COL_NAME)
        key = normalize(name) if name is not None else None
        if key not in keys:
            raise ValueError("%s : ligne %d, race %r absente de l'index" % (sheet.name, r, name))
        if key in data:
            raise ValueError("%s : race %r en double" % (sheet.name, name))
        data[key] = {c: sheet.take(r, c) for c in range(2, RACE_LAST_COL + 1)}
    missing = set(keys) - set(data)
    if missing:
        raise ValueError("%s : races absentes : %s" % (sheet.name, sorted(missing)))
    sheet.check_all_consumed()
    return headers, data


def read_bonus_tab(sheet, races):
    """(en-têtes, {clé de race: [ligne...]}, {clé de race: [noms écrits en colonne A]})."""
    headers = {}
    for c in range(1, BONUS_LAST_COL + 1):
        h = sheet.take(1, c)
        if h is not None:
            headers[c] = norm_ws(h)
    if BONUS_COL_SUB in headers:
        raise ValueError("%s : B1 devrait être vide" % sheet.name)
    for c in (BONUS_COL_RACE, BONUS_COL_NOM, BONUS_COL_DESC) + BONUS_NUM_COLS:
        if c not in headers:
            raise ValueError("%s : en-tête manquant colonne %d" % (sheet.name, c))
    keys = {normalize(n): n for n, _ in races}
    rows_by_race = {k: [] for k in keys}
    spelled = {k: [] for k in keys}
    for r in sorted({r for r, _ in sheet.cells if r > 1}):
        race_cell = sheet.take(r, BONUS_COL_RACE)
        if race_cell is None:
            raise ValueError("%s : ligne %d sans race" % (sheet.name, r))
        key = normalize(race_cell)
        key = RACE_NAME_FIXES.get(key, key)
        if key not in keys:
            raise ValueError("%s : ligne %d, race %r sans correspondance dans l'index" % (sheet.name, r, race_cell))
        if sheet.cells.get((r, BONUS_COL_SUB)) is None:
            raise ValueError("%s : ligne %d sans nom de sous-race (colonne B)" % (sheet.name, r))
        row = {c: sheet.take(r, c) for c in range(2, BONUS_LAST_COL + 1)}
        rows_by_race[key].append(row)
        written = norm_ws(race_cell)
        if written not in spelled[key]:
            spelled[key].append(written)
    sheet.check_all_consumed()
    return headers, rows_by_race, spelled


def read_matrix(sheet, races):
    """(noms des colonnes, {clé de race: [noms dont la valeur est 1]})."""
    cols = sorted({c for r, c in sheet.cells if r == 1})
    if cols != list(range(2, cols[-1] + 1)):
        raise ValueError("%s : colonnes d'en-tête non contiguës" % sheet.name)
    names = []
    for c in cols:
        names.append(norm_ws(sheet.take(1, c)))
    if len(set(names)) != len(names):
        raise ValueError("%s : en-têtes en double" % sheet.name)
    keys = {normalize(n) for n, _ in races}
    accessible = {}
    for r in sorted({r for r, _ in sheet.cells if r > 1}):
        name = sheet.take(r, 1)
        key = normalize(name) if name is not None else None
        if key not in keys or key in accessible:
            raise ValueError("%s : ligne %d, race %r inconnue ou en double" % (sheet.name, r, name))
        ones = []
        for c, label in zip(cols, names):
            v = sheet.take(r, c)
            if v is None or fmt(v) not in ("0.0", "1.0", "0", "1"):
                raise ValueError("%s : L%dC%d valeur inattendue %r (0 ou 1 attendu)" % (sheet.name, r, c, v))
            if float(v) == 1.0:
                ones.append(label)
        accessible[key] = ones
    missing = keys - set(accessible)
    if missing:
        raise ValueError("%s : races absentes : %s" % (sheet.name, sorted(missing)))
    sheet.check_all_consumed()
    return names, accessible


# --------------------------------------------------------------------------------------------------------------------
# Rendu d'une page
# --------------------------------------------------------------------------------------------------------------------

def render_page(name, summary, race_headers, race_row, bonus_headers, bonus_rows, bonus_spelled,
                class_names, class_ok, magic_names, magic_ok, override=None, matrix_ok=None):
    """Page d'une race. `magic_ok` = magies innées retenues (celles de l'exception `override` si la race en a une dans
    RACE_DETAIL_OVERRIDES, sinon celles de la matrice) ; `matrix_ok` = liste de la matrice, citée dans l'écart."""
    sources = list(SOURCES)
    if override:
        sources.insert(2, override["source"])        # juste après les deux entrées du classeur « Les races »
    L = ["---",
         "title: " + yaml_str(name),
         "aliases: []",
         "tags: " + yaml_list(TAGS)]
    if summary:
        L.append("summary: " + yaml_str(summary))
    L.append(MAGIC_FIELD + ": " + yaml_list(magic_ok))
    L += ["sources: " + yaml_list(sources), "status: " + STATUS, "---", ""]

    if summary:
        L += md_text(summary) + [""]

    # Présentation de l'onglet de détail de la race (exception), juste après la phrase de résumé
    if override:
        L += ["## Présentation", ""]
        for paragraph in override["presentation"]:
            L += [esc_inline(paragraph), ""]

    # Caractéristiques de départ (le titre n'est écrit que si la section n'est pas vide)
    cols = [c for c in RACE_STAT_COLS + RACE_STAT_COLS_AFTER if not is_blank(race_row[c])]
    section = []
    if cols:
        section += table([race_headers[c] for c in cols], [race_row[c] for c in cols]) + [""]
    if not is_blank(race_row[COL_DIVERS]):
        section += labeled(race_headers[COL_DIVERS], race_row[COL_DIVERS]) + [""]
    if section:
        L += ["## Caractéristiques de départ", ""] + section

    # Avantage(s) et inconvénient(s) de l'onglet de détail (exception), citations exactes
    if override:
        L += ["## Avantage(s) et inconvénient(s)", ""]
        L += labeled("Avantage(s)", override["avantage"]) + [""]
        L += labeled("Inconvénient(s)", override["inconvenient"]) + [""]

    # Restrictions
    restr = []
    for op_col, val_col in RACE_RESTRICTIONS:
        op, val = race_row[op_col], race_row[val_col]
        if is_blank(op) and is_blank(val):
            continue
        text = " ".join(fmt(x) for x in (op, val) if not is_blank(x))
        restr.append((race_headers[val_col], text))
    if restr:
        L += ["## Restrictions", "",
              esc_inline("Chaque valeur est précédée de l'opérateur de la colonne « %s » qui la précède dans l'onglet « %s »."
                         % (OPERATOR_HEADER, TAB_RACE)), ""]
        L += table([h for h, _ in restr], [t for _, t in restr]) + [""]

    # Don, capacité Hyper
    for col in (COL_DON, COL_HYPER):
        if not is_blank(race_row[col]):
            L += ["## " + esc_inline(race_headers[col]), ""] + md_text(race_row[col]) + [""]

    # Sous-races / origines
    if bonus_rows:
        L += ["## Sous-races et origines", "", "Nombre : %d." % len(bonus_rows), ""]
        if any(s != name for s in bonus_spelled):
            L += ["Colonne « %s » de l'onglet « %s » : %s." % (
                bonus_headers[BONUS_COL_RACE], TAB_BONUS, ", ".join(bonus_spelled)), ""]
        for row in bonus_rows:
            L += ["### " + esc_inline(norm_ws(row[BONUS_COL_SUB])), ""]
            for col in (BONUS_COL_NOM, BONUS_COL_DESC):
                if not is_blank(row[col]):
                    L += labeled(bonus_headers[col], row[col]) + [""]
            num = [c for c in BONUS_NUM_COLS if not is_blank(row[c])]
            if num:
                L += table([bonus_headers[c] for c in num], [row[c] for c in num]) + [""]

    # Accessibilité
    for title, names, ok in (("Classes accessibles", class_names, class_ok), ("Magies accessibles", magic_names, magic_ok)):
        L += ["## " + title, "", "Nombre : %d sur %d." % (len(ok), len(names)), ""]
        if ok:
            L += [", ".join(esc_inline(n) for n in ok), ""]
        if override and title == "Magies accessibles":
            L += [esc_inline(
                "Écart entre les sources : la matrice « %s » du Google Sheet « %s » donne %d sur %d pour cette race, mais "
                "l'onglet « %s » du Google Sheet « %s » limite la magie innée à ces %d magies (Inconvénient(s) : « %s »). "
                "La liste ci-dessus suit l'onglet (décision du propriétaire du projet, d'après une capture de l'onglet)."
                % (TAB_MAGIE, FICHE_TITLE, len(matrix_ok), len(names), name, INDEX_TITLE, len(ok), override["inconvenient"])),
                ""]

    while L and L[-1] == "":
        L.pop()
    return "\n".join(L) + "\n"


# --------------------------------------------------------------------------------------------------------------------
# Vérification indépendante de `magies_innees` (option --verifier, et après chaque écriture)
# --------------------------------------------------------------------------------------------------------------------

def _raw_dumps(paths):
    """(feuille brute « Accessibilité Magie », feuille brute de l'index) lues directement dans les dumps JSON."""
    magic = index = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            sheets = json.load(fh)["sheets"]
        for sh in sheets:
            if sh["name"] == TAB_MAGIE:
                magic = sh
        if len(sheets) == 1:
            index = sheets[0]
    if magic is None or index is None:
        raise ValueError("verifier : il faut le dump de l'index des races et celui de la fiche personnage")
    return magic, index


def expected_magic(paths):
    """{clé de race: (nom, [magies innées])} recalculé à la main depuis le dump brut, sans Sheet ni read_matrix."""
    magic, index = _raw_dumps(paths)
    grid = {(c["r"], c["c"]): c["v"] for c in magic["cells"] if not is_blank(c["v"])}
    heads = tuple(grid.get((1, c)) for c in range(2, 2 + len(MAGIC_HEADERS)))
    if heads != MAGIC_HEADERS:
        raise ValueError("verifier : en-têtes de %s inattendus : %r" % (TAB_MAGIE, heads))
    last_col = 1 + len(MAGIC_HEADERS)
    stray = sorted(k for k in grid if k[1] > last_col or k[1] < 1 or k[0] < 1)
    if stray:
        raise ValueError("verifier : cellules hors B:P dans %s : %r" % (TAB_MAGIE, stray[:5]))
    expected = {}
    for r in sorted({r for r, _ in grid if r > 1}):
        name = grid[(r, 1)]
        ones = []
        for c, head in zip(range(2, last_col + 1), MAGIC_HEADERS):
            v = grid.get((r, c))
            if isinstance(v, bool) or not isinstance(v, (int, float)) or v not in (0, 1):
                raise ValueError("verifier : %s L%dC%d = %r (0 ou 1 attendu)" % (TAB_MAGIE, r, c, v))
            if v == 1:
                ones.append(head)
        key = normalize(name)
        if key in expected:
            raise ValueError("verifier : race %r en double dans %s" % (name, TAB_MAGIE))
        expected[key] = (name, ones)
    names_index = {normalize(c["v"]) for c in index["cells"] if c["c"] == 1 and not is_blank(c["v"])}
    if names_index != set(expected):
        raise ValueError("verifier : races de l'index et de %s différentes : %s" % (
            TAB_MAGIE, sorted(names_index ^ set(expected))))
    return expected


def front_list(text, field):
    """Liste JSON d'un champ de frontmatter écrit sur une seule ligne ; None si le champ est absent, en double ou illisible."""
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    lines = [l for l in m.group(1).split("\n") if l.startswith(field + ":")]
    if len(lines) != 1:
        return None
    try:
        return json.loads(lines[0][len(field) + 1:].strip())
    except ValueError:
        return None


def set_front_list(text, field, items):
    """Copie du texte dont la ligne `field:` du frontmatter porte `items` (sert à rejouer des cas d'erreur)."""
    line = "%s: %s" % (field, json.dumps(items, ensure_ascii=False))
    return re.sub(r"^%s:.*$" % re.escape(field), lambda _: line, text, count=1, flags=re.M)


def page_sections(text):
    """(titres « ## » dans l'ordre, {titre: lignes de la section}) ; le frontmatter est ignoré."""
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    order, parts, current = [], {}, None
    for line in (text[m.end():] if m else text).split("\n"):
        if line.startswith("## "):
            current = line[3:].strip()
            order.append(current)
            parts[current] = []
        elif current is not None:
            parts[current].append(line)
    return order, parts


def paragraphs(lines):
    """Lignes -> paragraphes (séparés par des lignes vides), échappements Markdown (« \\x ») retirés."""
    out, cur = [], []
    for line in list(lines) + [""]:
        if line.strip():
            cur.append(line.strip())
        elif cur:
            out.append(re.sub(r"\\(.)", r"\1", " ".join(cur)))
            cur = []
    return out


def page_magic(text):
    """(liste du frontmatter `magies_innees`, liste de « Magies accessibles » dans le corps, ligne « Nombre : N sur M. ») ;
    None pour ce qui est absent."""
    front = front_list(text, MAGIC_FIELD)
    section = page_sections(text)[1].get("Magies accessibles")
    if section is None:
        return front, None, None
    paras = paragraphs(section)
    listed = [n.strip() for n in paras[1].split(",")] if len(paras) > 1 else []
    return front, listed, (paras[0] if paras else None)


def override_problems(overrides, matrix):
    """Écarts de RACE_DETAIL_OVERRIDES avec son contrat (liste vide si tout va bien). `matrix` = sortie de expected_magic.
    Exige : (a) l'exception de chaque race de OVERRIDES_REQUIS existe, et chaque exception DIFFÈRE de la matrice (sinon
    elle est redondante) ; (b) ses noms sont tous dans MAGIC_HEADERS, sans doublon, dans l'ordre des colonnes ; la race
    existe dans la matrice, tous les champs sont là, les textes tiennent sur une ligne."""
    problems = []
    keys = {normalize(n) for n in overrides}
    for required in OVERRIDES_REQUIS:
        if normalize(required) not in keys:
            problems.append("exception de %s absente de RACE_DETAIL_OVERRIDES (décision du propriétaire du projet)" % required)
    for name, ov in overrides.items():
        label = "exception %s" % name
        key = normalize(name)
        if key not in matrix:
            problems.append("%s : race absente de %s" % (label, TAB_MAGIE))
            continue
        absent = [f for f in OVERRIDE_FIELDS if f not in ov]
        if absent:
            problems.append("%s : champ(s) manquant(s) : %s" % (label, ", ".join(absent)))
            continue
        names = ov["magies_innees"]
        if not isinstance(names, list) or not names or not all(isinstance(n, str) for n in names):
            problems.append("%s : magies_innees doit être une liste non vide de noms" % label)
        else:
            unknown = [n for n in names if n not in MAGIC_HEADERS]
            if unknown:
                problems.append("%s : nom(s) absent(s) des en-têtes de %s : %r" % (label, TAB_MAGIE, unknown))
            elif names != [h for h in MAGIC_HEADERS if h in names]:
                problems.append("%s : noms en double ou hors de l'ordre des colonnes de %s : %r, attendu %r" % (
                    label, TAB_MAGIE, names, [h for h in MAGIC_HEADERS if h in names]))
            if names == matrix[key][1]:
                problems.append("%s redondante : identique à la matrice %s (%d magies)" % (label, TAB_MAGIE, len(names)))
        pres = ov["presentation"]
        if not isinstance(pres, list) or not pres:
            problems.append("%s : presentation doit être une liste non vide de paragraphes" % label)
            pres = []
        for field, text in [("presentation[%d]" % i, p) for i, p in enumerate(pres)] + [
                (f, ov[f]) for f in ("avantage", "inconvenient", "source")]:
            if not isinstance(text, str) or not text or text != text.strip() or "\n" in text:
                problems.append("%s : %s doit être un texte non vide, sur une ligne, sans espace en bordure" % (label, field))
    return problems


def page_problems(label, text, wanted, matrix_ones, override):
    """Écarts d'une page (texte complet) avec `wanted` = magies innées attendues (celles de l'exception si la race en a une,
    sinon celles de la matrice `matrix_ones`). (c) pour une race à exception : `magies_innees`, liste et nombre de « Magies
    accessibles » = l'exception, entrée de source, sections « Présentation » (première, juste après le résumé) et
    « Avantage(s) et inconvénient(s) » en citations exactes, paragraphe d'écart citant l'Inconvénient et le compte de la
    matrice. (d) toute autre race : listes et nombre = matrice."""
    problems = []
    front, listed, count = page_magic(text)
    if front is None:
        problems.append("%s : champ %s absent ou illisible (une seule ligne JSON attendue)" % (label, MAGIC_FIELD))
    elif front != wanted:
        problems.append("%s : %s = %r, attendu %r" % (label, MAGIC_FIELD, front, wanted))
    if listed != wanted:
        problems.append("%s : « Magies accessibles » du corps = %r, attendu %r" % (label, listed, wanted))
    expected_count = "Nombre : %d sur %d." % (len(wanted), len(MAGIC_HEADERS))
    if count != expected_count:
        problems.append("%s : « Magies accessibles » : ligne %r, attendu %r" % (label, count, expected_count))
    if override is None:
        return problems
    sources = front_list(text, "sources")
    if not isinstance(sources, list) or override["source"] not in sources:
        problems.append("%s : entrée de source absente : %s" % (label, override["source"]))
    order, parts = page_sections(text)
    if order[:1] != ["Présentation"]:
        problems.append("%s : la section « Présentation » doit être la première, juste après la phrase de résumé" % label)
    elif paragraphs(parts["Présentation"]) != override["presentation"]:
        problems.append("%s : « Présentation » différente des paragraphes de l'exception" % label)
    title = "Avantage(s) et inconvénient(s)"
    cited = ["**Avantage(s)** : " + override["avantage"], "**Inconvénient(s)** : " + override["inconvenient"]]
    if title not in order:
        problems.append("%s : section « %s » absente" % (label, title))
    elif paragraphs(parts[title]) != cited:
        problems.append("%s : « %s » différente des citations de l'exception" % (label, title))
    gap = " ".join(paragraphs(parts.get("Magies accessibles", []))[2:])
    if not gap:
        problems.append("%s : « Magies accessibles » : paragraphe d'écart absent" % label)
    else:
        if override["inconvenient"] not in gap:
            problems.append("%s : le paragraphe d'écart ne cite pas l'Inconvénient" % label)
        if "%d sur %d" % (len(matrix_ones), len(MAGIC_HEADERS)) not in gap:
            problems.append("%s : le paragraphe d'écart ne donne pas le compte de la matrice (%d sur %d)" % (
                label, len(matrix_ones), len(MAGIC_HEADERS)))
    return problems


def check_pages(paths, wiki_root, overrides=None):
    """Compare chaque page `races/<slug>.md` aux valeurs recalculées ; liste des écarts (vide si tout concorde).
    `overrides` (par défaut RACE_DETAIL_OVERRIDES, déjà validé par override_problems) remplace la matrice pour ses races."""
    problems = []
    by_key = {normalize(n): o for n, o in (RACE_DETAIL_OVERRIDES if overrides is None else overrides).items()}
    matrix = expected_magic(paths)
    out_dir = os.path.join(wiki_root, CATEGORY)
    for key, (name, ones) in sorted(matrix.items()):
        path = os.path.join(out_dir, key + ".md")
        if not os.path.exists(path):
            problems.append("%s : page absente" % path)
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        override = by_key.get(key)
        problems += page_problems(path, text, override["magies_innees"] if override else ones, ones, override)
    if os.path.isdir(out_dir):
        for fname in sorted(os.listdir(out_dir)):
            if fname.endswith(".md") and fname[:-3] not in matrix:
                with open(os.path.join(out_dir, fname), encoding="utf-8") as fh:
                    if source_url(FICHE_ID) in fh.read():
                        problems.append("%s : page issue de ce classeur sans race dans %s" % (fname, TAB_MAGIE))
    return problems


def override_replays(matrix):
    """Rejoue override_problems sur des copies modifiées de RACE_DETAIL_OVERRIDES : chaque cas doit signaler un écart."""
    base = copy.deepcopy(RACE_DETAIL_OVERRIDES)
    name = next(n for n in base if normalize(n) == normalize(OVERRIDES_REQUIS[0]))
    names, ones = base[name]["magies_innees"], matrix[normalize(name)][1]

    def variant(**changes):
        out = copy.deepcopy(base)
        out[name].update(changes)
        return out

    without_field = copy.deepcopy(base)
    del without_field[name]["inconvenient"]
    cases = [
        ("exception redondante (identique à la matrice)", variant(magies_innees=list(ones))),
        ("exception absente", {k: v for k, v in base.items() if k != name}),
        ("nom absent de MAGIC_HEADERS", variant(magies_innees=names[:-1] + ["Poison"])),
        ("noms hors de l'ordre des colonnes", variant(magies_innees=list(reversed(names)))),
        ("nom en double", variant(magies_innees=names + names[-1:])),
        ("liste vide", variant(magies_innees=[])),
        ("race absente de la matrice", dict(base, Gnome=base[name])),
        ("champ manquant", without_field),
        ("texte sur plusieurs lignes", variant(avantage=base[name]["avantage"] + "\nautre")),
    ]
    failures = []
    for label, overrides in cases:
        if not override_problems(overrides, matrix):
            failures.append("exception : %s : aucun écart signalé" % label)
    # contrôle de sens : une exception valide et différente de la matrice est acceptée
    if override_problems(variant(magies_innees=list(ones[:-1])), matrix):
        failures.append("exception : une liste valide, différente de la matrice, est refusée à tort")
    return failures


def page_replays(paths, wiki_root):
    """Rejoue page_problems sur des copies modifiées des pages : chaque cas doit signaler un écart (et changer le texte)."""
    matrix = expected_magic(paths)
    by_key = {normalize(n): o for n, o in RACE_DETAIL_OVERRIDES.items()}

    def read(key):
        with open(os.path.join(wiki_root, CATEGORY, key + ".md"), encoding="utf-8") as fh:
            return fh.read()

    failures = []

    def run(label, original, mutated, key, wanted, override):
        if mutated == original:
            failures.append("page %s : %s : le cas ne modifie pas la page" % (key, label))
        elif not page_problems(key, mutated, wanted, matrix[key][1], override):
            failures.append("page %s : %s : aucun écart signalé" % (key, label))

    for key, ov in sorted(by_key.items()):
        text, wanted, ones = read(key), ov["magies_innees"], matrix[key][1]
        total = len(MAGIC_HEADERS)
        accessibles = text.partition("\n## Magies accessibles\n")
        cases = [
            ("frontmatter = matrice", set_front_list(text, MAGIC_FIELD, ones)),
            ("liste du corps = matrice", text.replace("\n" + ", ".join(wanted) + "\n", "\n" + ", ".join(ones) + "\n")),
            ("nombre du corps = matrice", text.replace("Nombre : %d sur %d." % (len(wanted), total),
                                                       "Nombre : %d sur %d." % (len(ones), total))),
            ("entrée de source absente", set_front_list(text, "sources", [
                s for s in front_list(text, "sources") or [] if s != ov["source"]])),
            ("section « Présentation » supprimée", re.sub(r"^## Présentation\n.*?(?=^## )", "", text, count=1,
                                                         flags=re.S | re.M)),
            ("présentation altérée", text.replace(ov["presentation"][-1], ov["presentation"][-1][:-1], 1)),
            ("avantage altéré", text.replace(ov["avantage"], ov["avantage"][:-1], 1)),
            ("inconvénient altéré", text.replace(ov["inconvenient"], ov["inconvenient"][:-1], 1)),
            ("écart sans citation de l'Inconvénient", "".join(accessibles[:2]) + accessibles[2].replace(ov["inconvenient"], "")),
        ]
        for label, mutated in cases:
            run(label, text, mutated, key, wanted, ov)
        # (d) une autre race ne doit pas porter la liste de l'exception
        other = next(k for k, (_, o) in sorted(matrix.items()) if k not in by_key and o != wanted)
        other_text = read(other)
        run("race sans exception portant la liste de l'exception", other_text,
            set_front_list(other_text, MAGIC_FIELD, wanted), other, matrix[other][1], None)
    return failures


def error_cases(paths, wiki_root, overrides_ok, pages_ok):
    """Rejoue read_matrix sur des copies modifiées de la matrice : chaque cas doit lever ValueError. Liste des échecs.
    Rejoue aussi les exceptions (override_replays, si RACE_DETAIL_OVERRIDES est valide) et les pages (page_replays, si
    elles sont conformes : sinon l'écart est déjà signalé)."""
    magic, index = _raw_dumps(paths)
    races = [(norm_ws(c["v"]), None) for c in sorted(index["cells"], key=lambda c: c["r"]) if c["c"] == 1]
    base = [dict(c) for c in magic["cells"]]

    def sheet(cells):
        return Sheet({"name": TAB_MAGIE, "cells": cells})

    def find(cells, r, c):
        return next(x for x in cells if x["r"] == r and x["c"] == c)

    cases = []
    for label, value in (("valeur 2", 2.0), ("valeur négative", -1.0), ("valeur 0,5", 0.5), ("texte", "oui"), ("vide", None)):
        cells = [dict(c) for c in base]
        find(cells, 14, 3)["v"] = value
        cases.append((label, cells))
    cells = [dict(c) for c in base if c["r"] != 14]
    cases.append(("race de l'index absente de la matrice", cells))
    cells = [dict(c) for c in base] + [{"r": 29, "c": 1, "v": "Race inconnue"}] + [
        {"r": 29, "c": c, "v": 0.0} for c in range(2, 17)]
    cases.append(("race de la matrice absente de l'index", cells))
    cells = [dict(c) for c in base] + [{"r": 5, "c": 17, "v": 1.0}]
    cases.append(("cellule hors de la matrice", cells))
    failures = []
    for label, cells in cases:
        try:
            read_matrix(sheet(cells), races)
        except ValueError:
            continue
        failures.append("%s : aucune erreur levée" % label)
    # contrôle de sens : une valeur 0 -> 1 doit apparaître dans la liste, à sa place dans l'ordre des colonnes
    cells = [dict(c) for c in base]
    find(cells, 14, 3 + 1)["v"] = 1.0                       # Orios (ligne 14) : Arcane (colonne D) passe à 1
    _, ok = read_matrix(sheet(cells), races)
    if ok[normalize("Orios")] != ["Sang", "Arcane", "Eau", "Terre"]:
        failures.append("ordre des colonnes : %r" % (ok[normalize("Orios")],))
    if overrides_ok:
        failures += override_replays(expected_magic(paths))
    if pages_ok:
        failures += page_replays(paths, wiki_root)
    return failures


def run_verifier(paths, wiki_root):
    matrix = expected_magic(paths)
    problems = override_problems(RACE_DETAIL_OVERRIDES, matrix)
    overrides_ok = not problems
    pages = check_pages(paths, wiki_root) if overrides_ok else []
    problems += pages + error_cases(paths, wiki_root, overrides_ok, overrides_ok and not pages)
    if problems:
        raise SystemExit("--verifier : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))
    print("--verifier : %d pages conformes au dump (%s), dont %d exception(s) de détail (%s), cas d'erreur rejoués" % (
        len(matrix), MAGIC_FIELD, len(RACE_DETAIL_OVERRIDES), ", ".join(RACE_DETAIL_OVERRIDES)))


# --------------------------------------------------------------------------------------------------------------------
# Écriture
# --------------------------------------------------------------------------------------------------------------------

def frontmatter_title(text):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    if not m:
        return None
    t = re.search(r"^title:\s*(.*)$", m.group(1), re.M)
    if not t:
        return None
    raw = t.group(1).strip()
    try:
        return json.loads(raw) if raw.startswith('"') else raw.strip("'")
    except ValueError:
        return raw


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « races » du wiki depuis les dumps JSON des classeurs.")
    ap.add_argument("--dump", action="append", required=True, help="dump JSON (index des races, fiche personnage)")
    ap.add_argument("--out", required=True, help="dossier racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule %s depuis les dumps (matrice + exceptions de RACE_DETAIL_OVERRIDES) "
                         "et compare aux pages existantes" % MAGIC_FIELD)
    args = ap.parse_args(argv)
    if args.verifier:
        run_verifier(args.dump, args.out)
        return

    index_sheet, fiche = load_dumps(args.dump)
    races = read_index(index_sheet)
    race_headers, race_data = read_race_tab(fiche[TAB_RACE], races)
    bonus_headers, bonus_rows, bonus_spelled = read_bonus_tab(fiche[TAB_BONUS], races)
    class_names, class_ok = read_matrix(fiche[TAB_CLASS], races)
    magic_names, magic_ok = read_matrix(fiche[TAB_MAGIE], races)
    # Contrôle avant toute écriture : le second calcul (voir « Vérification indépendante ») doit donner les mêmes listes.
    expected = expected_magic(args.dump)
    for name, _ in races:
        if expected[normalize(name)][1] != magic_ok[normalize(name)]:
            raise SystemExit("Arrêt, rien n'a été écrit : %s de %s : %r d'un côté, %r de l'autre" % (
                MAGIC_FIELD, name, magic_ok[normalize(name)], expected[normalize(name)][1]))
    # Exceptions de détail : validées contre la matrice recalculée avant toute écriture, puis appliquées à leur race seule.
    problems = override_problems(RACE_DETAIL_OVERRIDES, expected)
    if problems:
        raise SystemExit("Arrêt, rien n'a été écrit : RACE_DETAIL_OVERRIDES :\n  " + "\n  ".join(problems))
    overrides = {normalize(n): o for n, o in RACE_DETAIL_OVERRIDES.items()}
    final_ok = {k: (overrides[k]["magies_innees"] if k in overrides else v) for k, v in magic_ok.items()}

    pages = []
    for name, summary in races:
        key = normalize(name)
        text = render_page(name, summary, race_headers, race_data[key], bonus_headers, bonus_rows[key],
                           bonus_spelled[key], class_names, class_ok[key], magic_names, final_ok[key],
                           override=overrides.get(key), matrix_ok=magic_ok[key])
        if "[[" in text:
            print("AVERTISSEMENT : « [[ » dans une cellule de %s (échappé, pas un lien)" % name, file=sys.stderr)
        pages.append((name, normalize(name), text))

    slugs = [s for _, s, _ in pages]
    if len(set(slugs)) != len(slugs):
        raise ValueError("slugs en double : %s" % slugs)

    # Contrôles avant toute écriture : fichiers existants et unicité des titres.
    out_dir = os.path.join(args.out, CATEGORY)
    targets = {os.path.abspath(os.path.join(out_dir, s + ".md")) for s in slugs}
    problems = []
    mine = {normalize(n) for n, _, _ in pages}
    for dirpath, _, files in sorted(os.walk(args.out)):
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            path = os.path.abspath(os.path.join(dirpath, fname))
            with open(path, encoding="utf-8") as fh:
                existing = fh.read()
            if path in targets:
                if source_url(FICHE_ID) not in existing:
                    problems.append("%s existe et n'est pas issu de ce classeur" % path)
                continue
            if os.path.dirname(path) == os.path.abspath(out_dir) and source_url(FICHE_ID) in existing:
                problems.append("%s est issu de ce classeur mais sa race n'est plus dans l'index" % path)
                continue
            title = frontmatter_title(existing)
            if title is not None and normalize(title) in mine:
                problems.append("titre %r déjà porté par %s" % (title, path))
    if problems:
        raise SystemExit("Arrêt, rien n'a été écrit :\n  " + "\n  ".join(problems))

    os.makedirs(out_dir, exist_ok=True)
    written = unchanged = 0
    for name, slug, text in pages:
        path = os.path.join(out_dir, slug + ".md")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                if fh.read() == text:
                    unchanged += 1
                    continue
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        written += 1
    print("%d pages (%d écrites, %d inchangées) dans %s" % (len(pages), written, unchanged, out_dir))
    for name, key, _ in pages:
        if key in overrides:
            print("%s : matrice = %d magies, onglet %s de %s = %d : exception appliquée" % (
                name, len(magic_ok[key]), name, INDEX_TITLE, len(final_ok[key])))
    spread = {}
    for _, key, _ in pages:
        spread.setdefault(len(final_ok[key]), []).append(key)
    print("%s : %s sur %d magies" % (MAGIC_FIELD, ", ".join(
        "%d race(s) à %d" % (len(keys), n) for n, keys in sorted(spread.items(), reverse=True)), len(magic_names)))
    problems = check_pages(args.dump, args.out)
    if problems:
        raise SystemExit("Vérification après écriture : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))


if __name__ == "__main__":
    main()
