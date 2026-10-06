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
don (une sous-race de la fiche déclarée sans ethnie dans l'onglet, ETHNIES_FICHE_SEULES, aucune aujourd'hui, y serait aussi
listée). Les colonnes qui n'existent que dans la fiche (AP, AM, Divers, Restrictions, sous-races avec leurs bonus chiffrés et
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
       les races » = matrice des relations entre races, hors du périmètre « détail des races » (pas de page par race) : elle
       est publiée à part par tools/sheets/relations-races.py, depuis le dump complet des annexes (ici la copie est tronquée) ;
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
correspondance (sinon la déclarer dans ETHNIES_FICHE_SEULES), et au moins un INDICE par paire : même nom (le nom de
l'ethnie ou du don de l'onglet se retrouve dans la colonne B ou C de la fiche, « en innée » et l'astérisque de note
retirés) ou même texte de don (mêmes lignes) ou, pour un don unique, la sous-race unique de la fiche qui porte le nom de
la race. Chaque ethnie rapprochée affiche la sous-race de la fiche qui lui correspond, et la section « Sous-races et
origines » (fiche, avec bonus chiffrés et résistances) reste sous les yeux, comme auparavant. Écart de « nom d'ethnie » :
seulement quand aucun nom de l'onglet (ethnie, don) ne se retrouve dans les colonnes B ou C de la fiche (aujourd'hui :
« Tempe/Espace » des Drakos, que la fiche écrit « Espace/Temps ») ; « Londolor Ouest » = « Nain Ouest » n'en est pas un,
c'est le nom de la colonne C de la fiche.

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

def tab_source(tab):
    """Entrée de `sources:` de l'onglet de la race dans le classeur « Les races »."""
    return "Google Sheet « %s », onglet « %s »" % (INDEX_TITLE, tab)


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
    TAB_RELATIONS: "matrice des relations entre races : hors du périmètre « détail des races » (pas de page par race) ; "
                   "publiée à part par tools/sheets/relations-races.py depuis le dump complet des annexes (la copie de cet "
                   "onglet dans ce dump est tronquée)",
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
    """(index des races : Sheet, fiche : {onglet: Sheet}, détail : {onglet: dump brut}). Chaque dump est reconnu à son contenu."""
    index_raw = fiche = detail = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            dump = json.load(fh)
        names = [s["name"] for s in dump["sheets"]]
        if all(t in names for t in FICHE_TABS):
            if fiche is not None:
                raise ValueError("deux dumps de la fiche personnage")
            fiche = {s["name"]: Sheet(s) for s in dump["sheets"] if s["name"] in FICHE_TABS}
        elif TAB_MODELE in names:
            if detail is not None:
                raise ValueError("deux dumps du classeur « %s » (onglets de race)" % INDEX_TITLE)
            if len(set(names)) != len(names):
                raise ValueError("%s : onglets en double : %s" % (path, sorted(n for n in names if names.count(n) > 1)))
            detail = {s["name"]: s for s in dump["sheets"]}
        elif len(names) == 1:
            if index_raw is not None:
                raise ValueError("deux dumps de l'index des races")
            index_raw = Sheet(dump["sheets"][0])
        else:
            raise ValueError("dump non reconnu : %s (onglets : %s)" % (path, names))
    if index_raw is None or fiche is None or detail is None:
        raise ValueError("il faut un dump de l'index des races, un de la fiche personnage et un du classeur « %s » lu onglet "
                         "par onglet" % INDEX_TITLE)
    return index_raw, fiche, detail


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
# Lecture du détail d'une race (un onglet du classeur « Les races »)
# --------------------------------------------------------------------------------------------------------------------

def fold_text(value):
    """Clé de comparaison de textes : Unicode NFC, apostrophes et guillemets typographiques unifiés, espaces réduits,
    casse ignorée (rien d'autre : ni accents ni ponctuation)."""
    s = unicodedata.normalize("NFC", fmt(value))
    for ch in "’‘´`":
        s = s.replace(ch, "'")
    for ch in "“”«»„":
        s = s.replace(ch, '"')
    return " ".join(s.casefold().split())


def col_letters(c):
    s = ""
    while c:
        c, rem = divmod(c - 1, 26)
        s = chr(65 + rem) + s
    return s


def a1(r, c):
    return "%s%d" % (col_letters(c), r)


def a1_parse(ref):
    m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    col = 0
    for ch in m.group(1):
        col = col * 26 + ord(ch) - 64
    return int(m.group(2)), col


def number(value):
    """Valeur numérique (« 10 », « 10.0 », 10.0, « 3,5 ») en float ; None si ce n'est pas un nombre."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.fullmatch(r"-?\d+(?:[.,]\d+)?", str(value).strip())
    return float(m.group(0).replace(",", ".")) if m else None


def first_line(text):
    return norm_ws(fmt(text).split("\n")[0])


def lines_key(text):
    """Lignes d'un texte, marqueur de liste « - » retiré, comparables par fold_text."""
    return [fold_text(re.sub(r"^-\s+", "", l.strip())) for l in fmt(text).split("\n") if l.strip()]


def same_lines(a, b):
    return lines_key(a) == lines_key(b)


def name_key(text):
    """Clé de comparaison d'un nom d'ethnie : première ligne, sans astérisque de note ni « en innée », clé du wiki."""
    line = first_line(text).lstrip("*").strip()
    line = re.sub(r"\s+en inn[ée]e?$", "", line, flags=re.I)
    return normalize(line)


class TabReader:
    """Cellules non vides d'un onglet de race. Chaque cellule doit être « prise » avec la section de page qui la reçoit
    (None = ignorée : titre, caractère isolé déclaré, étiquette de zone) ; une cellule non prise arrête le script."""

    def __init__(self, raw, tab):
        self.tab = tab
        self.cells = {}
        for c in raw["cells"]:
            if not is_blank(c["v"]):
                self.cells[(c["r"], c["c"])] = fmt(c["v"])
        self.roles = {}

    def fail(self, message):
        raise ValueError("%s : %s" % (self.tab, message))

    def get(self, r, c):
        return self.cells.get((r, c))

    def take(self, r, c, section):
        if (r, c) not in self.cells:
            self.fail("cellule %s attendue et absente" % a1(r, c))
        self.roles[(r, c)] = section
        return self.cells[(r, c)]

    def row(self, r, cmax=DETAIL_LEFT_MAX):
        return {c: v for (rr, c), v in self.cells.items() if rr == r and c <= cmax}

    def rows_between(self, r1, r2, cmax=DETAIL_LEFT_MAX):
        return sorted({r for (r, c) in self.cells if r1 < r < r2 and c <= cmax})

    def untaken(self):
        return sorted(set(self.cells) - set(self.roles))

    def describe(self, cells, limit=8):
        return ", ".join("%s=%r" % (a1(r, c), self.cells[(r, c)][:40]) for r, c in sorted(cells)[:limit])


def read_detail_tab(raw, tab, race_name):
    """Onglet de race -> dict (voir les clés du return). Lit par libellés ; toute disposition inconnue lève ValueError."""
    t = TabReader(raw, tab)

    # Titre décoratif (N1) et caractères isolés déclarés (STRAY_CELLS).
    title = t.get(1, COL_TITLE)
    if title is None:
        t.fail("titre en %s absent" % a1(1, COL_TITLE))
    titles = {normalize(n) + suffix for n in (tab, race_name) for suffix in ("", "s")}
    if normalize(title) not in titles:
        t.fail("%s = %r : ne répète pas le nom de la race (%s)" % (a1(1, COL_TITLE), title, race_name))
    t.take(1, COL_TITLE, None)
    for (stray_tab, ref), (value, _) in STRAY_CELLS.items():
        if stray_tab == tab and t.get(*a1_parse(ref)) == value:
            t.take(*a1_parse(ref), None)
    for (r, c), v in sorted(t.cells.items()):
        if v == "DONNÉES" and (r, c) not in t.roles:
            t.take(r, c, None)

    # Panneau de droite : « HISTOIRE » + texte, puis « DESCRIPTION » + texte (colonne AK seulement).
    right = sorted((r, c) for (r, c) in t.cells if c > DETAIL_LEFT_MAX and (r, c) not in t.roles)
    if any(c != COL_AK for _, c in right):
        t.fail("panneau de droite : cellules hors de la colonne AK : %s" % t.describe(right))
    texts = [t.cells[cell] for cell in right]
    if len(right) not in (2, 4) or texts[0] != "HISTOIRE" or (len(right) == 4 and texts[2] != "DESCRIPTION"):
        t.fail("panneau de droite : disposition inconnue (attendu « HISTOIRE » + texte, puis « DESCRIPTION » + texte) : %s"
               % t.describe(right))
    t.take(right[0][0], COL_AK, SEC_HIST)
    histoire = t.take(right[1][0], COL_AK, SEC_HIST)
    description = None
    if len(right) == 4:
        t.take(right[2][0], COL_AK, SEC_DESC)
        description = t.take(right[3][0], COL_AK, SEC_DESC)

    # Valeurs de départ : « Santé de départ », « Chakra de départ », « Barrière bonus », « Vitesse Sol/Nage » (2 valeurs).
    stat_rows = [r for (r, c), v in t.cells.items() if c == 2 and v == STAT_LABELS[0]]
    if len(stat_rows) != 1:
        t.fail("« %s » en colonne B : %d occurrence(s), 1 attendue" % (STAT_LABELS[0], len(stat_rows)))
    r_stats = stat_rows[0]
    items = sorted(t.row(r_stats).items())
    stats, i = [], 0
    for label, count in zip(STAT_LABELS, STAT_VALUE_COUNTS):
        if i >= len(items) or items[i][1] != label:
            t.fail("ligne %d : « %s » attendu à la place %d de la ligne des valeurs de départ : %s" % (
                r_stats, label, i + 1, t.describe([(r_stats, c) for c, _ in items])))
        label_col = items[i][0]
        t.take(r_stats, label_col, SEC_STATS)
        values = []
        for k in range(count):
            want = label_col + 6 + 2 * k
            if i + 1 + k >= len(items) or items[i + 1 + k][0] != want or number(items[i + 1 + k][1]) is None:
                t.fail("ligne %d : valeur numérique attendue en %s (« %s »)" % (r_stats, a1(r_stats, want), label))
            values.append(t.take(r_stats, want, SEC_STATS))
        stats.append((label, values))
        i += 1 + count
    if i != len(items):
        t.fail("ligne %d : cellules en trop après les valeurs de départ : %s" % (
            r_stats, t.describe([(r_stats, c) for c, _ in items[i:]])))

    # Libellés de la colonne A, dans l'ordre du gabarit.
    def label_row(label):
        rows = [r for (r, c), v in t.cells.items() if c == COL_A and v == label]
        if len(rows) != 1:
            t.fail("libellé « %s » : %d occurrence(s) en colonne A, 1 attendue" % (label, len(rows)))
        return rows[0]

    r_adv, r_inc, r_don_b, r_don_r, r_hyper = (label_row(l) for l in (LABEL_ADV, LABEL_INC, LABEL_DON_B, LABEL_DON_R, LABEL_HYPER))
    if not r_stats < r_adv < r_inc < r_don_b < r_don_r < r_hyper:
        t.fail("libellés dans un ordre inattendu (valeurs de départ, Avantage(s), Inconvénient(s), Don B, Don R, Mode Hyper)")

    # Présentation générale : la seule cellule restante de la colonne A au-dessus des valeurs de départ (A4).
    above = [(r, c) for (r, c) in t.untaken() if r < r_stats and c <= DETAIL_LEFT_MAX]
    if len(above) != 1 or above[0][1] != COL_A:
        t.fail("au-dessus des valeurs de départ : une cellule de la colonne A attendue (description générale), trouvé : %s"
               % (t.describe(above) or "rien"))
    presentation = t.take(above[0][0], COL_A, SEC_PRES)

    def text_row(r, label_section, section):
        row = t.row(r)
        if set(row) != {COL_A, COL_H}:
            t.fail("ligne %d (« %s ») : cellules %s, A et H attendues" % (r, row.get(COL_A), t.describe([(r, c) for c in row])))
        t.take(r, COL_A, label_section)
        return t.take(r, COL_H, section)

    avantage = text_row(r_adv, SEC_ADV, SEC_ADV)
    inconvenient = text_row(r_inc, SEC_ADV, SEC_ADV)
    don_base = text_row(r_don_b, SEC_DON, SEC_DON)

    # Bloc « Don R (Race) » : quatre formes (voir la docstring).
    gift = {"name": None, "single": None, "ethnies": None, "panels": None}
    row = t.row(r_don_r)
    if set(row) - {COL_A, COL_H}:
        t.fail("ligne %d (« %s ») : cellules en trop : %s" % (r_don_r, LABEL_DON_R, t.describe([(r_don_r, c) for c in row])))
    t.take(r_don_r, COL_A, SEC_ETH)
    if COL_H in row:
        gift["name"] = t.take(r_don_r, COL_H, SEC_ETH)

    def parse_ethnies(rows):
        header = t.row(rows[0])
        if (not set(header) <= {COL_A, COL_H, COL_O} or COL_A not in header or header.get(COL_O) != "Don"
                or header[COL_A] not in ETHNIE_HEADERS or (COL_H in header and header[COL_H] != "Nom")):
            t.fail("en-tête du tableau des ethnies inconnu (ligne %d) : %s" % (rows[0], t.describe([(rows[0], c) for c in header])))
        heads = tuple(t.take(rows[0], c, SEC_ETH) if c in header else None for c in (COL_A, COL_H, COL_O))
        out = []
        for r in rows[1:]:
            line = t.row(r)
            if not set(line) <= {COL_A, COL_H, COL_O} or COL_A not in line or COL_O not in line:
                t.fail("ligne %d du tableau des ethnies : cellules %s (A et O attendues, H facultative)" % (
                    r, t.describe([(r, c) for c in line])))
            out.append({"a": t.take(r, COL_A, SEC_ETH),
                        "h": t.take(r, COL_H, SEC_ETH) if COL_H in line else None,
                        "o": t.take(r, COL_O, SEC_ETH)})
        if not out:
            t.fail("tableau des ethnies sans ligne")
        return {"headers": heads, "rows": out}

    def parse_panels(rows):
        header = t.row(rows[0])
        cols = sorted(header)
        left = [c for c in cols if c < PANEL_RIGHT_START]
        right = [c for c in cols if c >= PANEL_RIGHT_START]
        if len(left) < 2 or [c + PANEL_OFFSET for c in left] != right or any(header[a] != header[b] for a, b in zip(left, right)):
            t.fail("en-tête du tableau en deux panneaux inconnu (ligne %d) : %s" % (rows[0], t.describe([(rows[0], c) for c in cols])))
        for c in cols:
            t.take(rows[0], c, SEC_ETH)
        out = []
        for panel in (left, right):
            for r in rows[1:]:
                line = t.row(r)
                if not set(line) <= set(cols):
                    t.fail("ligne %d du tableau en deux panneaux : cellules hors des colonnes de l'en-tête : %s" % (
                        r, t.describe([(r, c) for c in line if c not in cols])))
                mine = [c for c in line if c in panel]
                if not mine:
                    continue
                if len(mine) != len(panel):
                    t.fail("ligne %d du tableau en deux panneaux : ligne incomplète (%d cellule(s) sur %d)" % (
                        r, len(mine), len(panel)))
                out.append([t.take(r, c, SEC_ETH) for c in panel])
        if not out:
            t.fail("tableau en deux panneaux sans ligne")
        return {"headers": [header[c] for c in left], "rows": out}

    rows = t.rows_between(r_don_r, r_hyper)
    if not rows:
        t.fail("bloc « %s » vide" % LABEL_DON_R)
    first = t.row(rows[0])
    if set(first) == {COL_A, COL_H}:
        if gift["name"] is not None:
            t.fail("don unique (ligne %d) et nom de don sur la ligne « %s » : disposition inconnue" % (rows[0], LABEL_DON_R))
        gift["single"] = (t.take(rows[0], COL_A, SEC_ETH), t.take(rows[0], COL_H, SEC_ETH))
        if rows[1:]:
            gift["panels"] = parse_panels(rows[1:])
    elif COL_O in first:
        if gift["name"] is not None:
            t.fail("tableau des ethnies et nom de don sur la ligne « %s » : disposition inconnue" % LABEL_DON_R)
        gift["ethnies"] = parse_ethnies(rows)
    else:
        gift["panels"] = parse_panels(rows)
        if gift["name"] is None:
            t.fail("tableau en deux panneaux sans nom de don sur la ligne « %s »" % LABEL_DON_R)

    # Capacité Mode Hyper : le libellé, puis une seule ligne (nom en A, texte en H).
    if set(t.row(r_hyper)) != {COL_A}:
        t.fail("ligne %d (« %s ») : cellules en trop" % (r_hyper, LABEL_HYPER))
    t.take(r_hyper, COL_A, SEC_HYPER)
    rows = sorted({r for (r, c) in t.cells if r > r_hyper and c <= DETAIL_LEFT_MAX})
    if len(rows) != 1 or set(t.row(rows[0])) != {COL_A, COL_H}:
        t.fail("après « %s » : une ligne (nom en A, texte en H) attendue, trouvé : %s" % (
            LABEL_HYPER, t.describe([(r, c) for r in rows for c in t.row(r)]) or "rien"))
    hyper = (t.take(rows[0], COL_A, SEC_HYPER), t.take(rows[0], COL_H, SEC_HYPER))

    left = t.untaken()
    if left:
        t.fail("cellules non reconnues : %s" % t.describe(left, 10))
    return {"tab": tab, "race": race_name, "histoire": histoire, "presentation": presentation, "description": description,
            "stats": stats, "avantage": avantage, "inconvenient": inconvenient, "don_base": don_base, "gift": gift,
            "hyper": hyper, "roles": dict(t.roles)}


def match_detail_tabs(detail_raw, races):
    """{clé de race: nom de l'onglet}. Arrête sur un onglet inconnu ou une race sans onglet."""
    keys = {normalize(n): n for n, _ in races}
    tabs = {}
    for tab in detail_raw:
        if tab in DETAIL_NOT_PUBLISHED:
            continue
        key = normalize(tab)
        key = RACE_TAB_NAMES.get(key, key)
        if key not in keys:
            raise ValueError("classeur « %s » : onglet %r inconnu (ni race de l'index, ni onglet non publié déclaré dans "
                             "DETAIL_NOT_PUBLISHED)" % (INDEX_TITLE, tab))
        if key in tabs:
            raise ValueError("classeur « %s » : deux onglets pour la race %s : %r et %r" % (INDEX_TITLE, keys[key], tabs[key], tab))
        tabs[key] = tab
    missing = sorted(keys[k] for k in set(keys) - set(tabs))
    if missing:
        raise ValueError("classeur « %s » : races sans onglet : %s" % (INDEX_TITLE, ", ".join(missing)))
    return tabs


def check_unpublished(detail_raw, races):
    """Vérifie que les onglets non publiés sont bien ce que DETAIL_NOT_PUBLISHED en dit ; [(onglet, raison, constat)]."""
    keys = {normalize(n): n for n, _ in races}
    out = []
    for tab, reason in DETAIL_NOT_PUBLISHED.items():
        if tab not in detail_raw:
            continue
        cells = TabReader(detail_raw[tab], tab).cells
        if tab == TAB_MODELE:
            if set(cells.values()) != TEMPLATE_LABELS or len(cells) != len(TEMPLATE_LABELS):
                raise ValueError("%s : le gabarit a changé (attendu : exactement les %d libellés de TEMPLATE_LABELS, "
                                 "trouvé : %s)" % (tab, len(TEMPLATE_LABELS), sorted(set(cells.values()))))
            note = "%d cellules, toutes des libellés du gabarit" % len(cells)
        elif tab == TAB_STATS:
            names, counters = [], []
            for (r, c), v in sorted(cells.items()):
                if v == "Races (nombre de fois prise)" or v == "=":
                    continue
                if re.fullmatch(r"\d+", v):
                    counters.append(int(v))
                elif RACE_TAB_NAMES.get(normalize(v), normalize(v)) in keys:
                    names.append(normalize(v))
                else:
                    raise ValueError("%s : cellule %s = %r : ni titre, ni nom de race, ni « = », ni compteur ; la justification "
                                     "de la non-publication n'est plus vraie" % (tab, a1(r, c), v))
            if sorted(names) != sorted(keys) or len(counters) != len(keys):
                raise ValueError("%s : %d nom(s) de race et %d compteur(s) (attendu : %d de chaque, une fois chaque race)" % (
                    tab, len(names), len(counters), len(keys)))
            note = "%d compteurs d'usage (un par race, somme %d)" % (len(counters), sum(counters))
        elif tab == TAB_SOMMAIRE:
            rows = {}
            for (r, c), v in cells.items():
                rows.setdefault(r, {})[c] = v
            sentences = {normalize(n): s for n, s in races}
            for r, row in sorted(rows.items()):
                if set(row) != {1, 2} or sentences.get(normalize(row[1])) != norm_ws(row[2]):
                    raise ValueError("%s : ligne %d différente de l'index des races" % (tab, r))
            note = "%d lignes, identiques à l'index" % len(rows)
        else:
            note = "%d cellules, non lues" % len(cells)
        out.append((tab, reason, note))
    return out


# --------------------------------------------------------------------------------------------------------------------
# Correspondance des ethnies et écarts avec la fiche
# --------------------------------------------------------------------------------------------------------------------

def ethnie_entries(detail):
    """Les ethnies / dons de l'onglet, dans l'ordre de lecture : dicts {form, key, label, name, text, cells}."""
    gift, entries = detail["gift"], []
    if gift["single"]:
        name, text = gift["single"]
        entries.append({"form": "don", "key": first_line(name), "label": name, "name": None, "text": text, "cells": [name, text]})
    if gift["ethnies"]:
        for row in gift["ethnies"]["rows"]:
            entries.append({"form": "ethnie", "key": first_line(row["a"]), "label": row["a"], "name": row["h"],
                            "text": row["o"], "cells": [row["a"], row["h"], row["o"]]})
    if gift["panels"]:
        for row in gift["panels"]["rows"]:
            entries.append({"form": "ligne", "key": first_line(row[0]), "label": row[0], "name": None,
                            "text": "\n".join(row[1:]), "cells": list(row)})
    return entries


def fiche_names(frow):
    names = {name_key(frow[BONUS_COL_SUB])}
    if not is_blank(frow[BONUS_COL_NOM]):
        names.add(name_key(frow[BONUS_COL_NOM]))
    return names


def entry_names(entry):
    names = {name_key(entry["label"])}
    if entry["name"]:
        names.add(name_key(entry["name"]))
    return names


def ethnie_evidence(entry, frow, race, alone):
    """Indices que la ligne `frow` de « Bonus Race » est bien l'ethnie `entry` de l'onglet (liste vide = aucun)."""
    evidence = []
    if entry_names(entry) & fiche_names(frow):
        evidence.append("même nom")
    if not is_blank(frow[BONUS_COL_DESC]) and same_lines(entry["text"], frow[BONUS_COL_DESC]):
        evidence.append("même texte")
    if entry["form"] == "don" and alone and name_key(frow[BONUS_COL_SUB]) == normalize(race):
        evidence.append("sous-race unique portant le nom de la race")
    return evidence


def match_ethnies(detail, frows, spec, declared_only):
    """Rapproche les ethnies de l'onglet des sous-races de la fiche selon la table `spec` (voir ETHNIE_FICHE).
    -> (paires [(entrée, ligne de la fiche ou None)], lignes de la fiche sans équivalent, problèmes)."""
    race, problems = detail["race"], []
    entries = ethnie_entries(detail)
    keys = [e["key"] for e in entries]
    if len(set(keys)) != len(keys):
        problems.append("%s : deux ethnies de l'onglet s'écrivent pareil : %s" % (race, sorted(k for k in keys if keys.count(k) > 1)))
    for key in keys:
        if key not in spec:
            problems.append("%s : ethnie %r de l'onglet absente de la table ETHNIE_FICHE" % (race, key))
    for key in spec:
        if key not in keys:
            problems.append("%s : %r de la table ETHNIE_FICHE n'existe pas dans l'onglet" % (race, key))
    by_name = {norm_ws(r[BONUS_COL_SUB]): r for r in frows}
    pairs, used = [], {}
    for entry in entries:
        target = spec.get(entry["key"])
        frow = None
        if target is not None:
            frow = by_name.get(target)
            if frow is None:
                problems.append("%s : sous-race %r (ethnie %r) absente de l'onglet « %s »" % (race, target, entry["key"], TAB_BONUS))
            elif target in used:
                problems.append("%s : les ethnies %r et %r visent la même sous-race %r" % (race, used[target], entry["key"], target))
            else:
                used[target] = entry["key"]
                if not ethnie_evidence(entry, frow, race, len(frows) == 1):
                    problems.append("%s : ethnie %r -> sous-race %r : aucun indice (ni même nom, ni même texte)" % (
                        race, entry["key"], target))
        pairs.append((entry, frow))
    declared = set(declared_only.get(race, ()))
    extra = [r for r in frows if norm_ws(r[BONUS_COL_SUB]) not in used and norm_ws(r[BONUS_COL_SUB]) not in declared]
    for name in sorted(declared):
        if name not in by_name:
            problems.append("%s : « %s » déclarée dans ETHNIES_FICHE_SEULES n'existe pas dans « %s »" % (race, name, TAB_BONUS))
        elif name in used:
            problems.append("%s : « %s » est à la fois rapprochée et déclarée seule" % (race, name))
    only = [r for r in frows if norm_ws(r[BONUS_COL_SUB]) in declared and norm_ws(r[BONUS_COL_SUB]) not in used]
    if extra:
        problems.append("%s : sous-races de la fiche sans ethnie dans l'onglet : %s (les rapprocher dans ETHNIE_FICHE, ou les "
                        "déclarer dans ETHNIES_FICHE_SEULES)" % (race, ", ".join(norm_ws(r[BONUS_COL_SUB]) for r in extra)))
    return pairs, only, problems


def ethnie_problems(details, bonus_rows, spec=None, declared_only=None):
    """Vérifie la table ETHNIE_FICHE contre tous les onglets ; ({clé de race: (paires, seules)}, problèmes)."""
    spec = ETHNIE_FICHE if spec is None else spec
    declared_only = ETHNIES_FICHE_SEULES if declared_only is None else declared_only
    problems, matched = [], {}
    names = {normalize(d["race"]) for d in details.values()}
    for race in spec:
        if normalize(race) not in names:
            problems.append("table ETHNIE_FICHE : race %r inconnue" % race)
    spec_by_key = {normalize(r): s for r, s in spec.items()}
    for key, detail in details.items():
        if key not in spec_by_key:
            problems.append("%s : race absente de la table ETHNIE_FICHE" % detail["race"])
            continue
        pairs, only, found = match_ethnies(detail, bonus_rows[key], spec_by_key[key], declared_only)
        matched[key] = (pairs, only)
        problems += found
    return matched, problems


MAGIC_BY_KEY = {normalize(h): h for h in MAGIC_HEADERS}
CITED_MAGIC_RE = re.compile(
    r"\bmagies?\s+(?:(?:de|du|des)\s+(?:la\s+|l')?|d')?(?P<list>[^.;]*?)\s+en\s+inn[ée]e?\b", re.I)


def cited_magics(text):
    """Magies que la ligne « Inconvénient(s) » cite « en innée » : None si elle n'en cite pas ; sinon (noms de MAGIC_HEADERS
    dans l'ordre du texte, connecteur « et » / « ou » / « virgules »). ValueError si une citation est illisible."""
    match = CITED_MAGIC_RE.search(text)
    if not match:
        if re.search(r"\ben inn[ée]", text, re.I):
            raise ValueError("citation de magie innée illisible : %r" % text)
        return None
    raw = match.group("list").strip()
    names = []
    for part in re.split(r"\s*,\s*|\s+et\s+|\s+ou\s+", raw):
        key = normalize(part)
        name = MAGIC_BY_KEY.get(key) or MAGIC_BY_KEY.get(normalize(MAGIC_ALIASES.get(key, "")))
        if name is None:
            raise ValueError("magie %r inconnue dans %r" % (part, text))
        names.append(name)
    connectors = {w for w in ("et", "ou") if re.search(r"\s%s\s" % w, raw)}
    return names, "/".join(sorted(connectors)) if connectors else "virgules"


def magic_cross_check(details, final_ok):
    """Vérification croisée des magies : ({clé: constat}, problèmes). La liste citée par « Inconvénient(s) » doit être
    exactement (même ensemble, sans doublon) `magies_innees` de la page."""
    notes, problems = {}, []
    for key, d in details.items():
        text = d["inconvenient"]
        try:
            cited = cited_magics(text)
        except ValueError as exc:
            problems.append("%s : %s" % (d["race"], exc))
            continue
        if cited is None:
            notes[key] = "aucune liste citée" + (" (parle de magie sans la lister : « %s »)" % text if re.search(r"magie", text, re.I) else "")
            continue
        names, connector = cited
        wanted = final_ok[key]
        if len(names) != len(set(names)) or set(names) != set(wanted):
            problems.append("%s : l'onglet cite %s (« %s ») mais magies_innees de la page = %s : écart à trancher par le "
                            "propriétaire (exception RACE_DETAIL_OVERRIDES), jamais en silence" % (
                                d["race"], names, text, wanted))
        else:
            notes[key] = "%d magies citées, identiques à la page (connecteur : %s)" % (len(names), connector)
    return notes, problems


def compute_gaps(detail, race_headers, race_row, pairs, only, matrix_ok, final_ok, magic_total):
    """Écarts entre l'onglet (retenu) et la fiche : [(élément, texte de l'onglet, texte de la fiche)], la fiche citée telle
    quelle. Voir « POLITIQUE DE PRIORITÉ » dans la docstring."""
    gaps = []

    def fiche(value):
        return "(vide)" if is_blank(value) else fmt(value)

    for (label, values), cols in zip(detail["stats"], STAT_FICHE_COLS):
        for k, (value, col) in enumerate(zip(values, cols)):
            fv = race_row[col]
            tab_n, fiche_n = number(value), number(fv)
            same = tab_n == fiche_n if tab_n is not None and fiche_n is not None else fold_text(value) == fold_text(fv or "")
            if not same:
                element = label if len(cols) == 1 else "%s (%s)" % (label, ("sol", "nage")[k])
                gaps.append(("%s\n(fiche : colonne « %s »)" % (element, race_headers[col]), value, fiche(fv)))
    if fold_text(detail["don_base"]) != fold_text(race_row[COL_DON] or ""):
        gaps.append(("Don de base\n(fiche : colonne « %s »)" % race_headers[COL_DON], detail["don_base"], fiche(race_row[COL_DON])))
    hyper_name, hyper_text = detail["hyper"]
    if fold_text(hyper_text) != fold_text(race_row[COL_HYPER] or ""):
        gaps.append(("Capacité Mode Hyper\n(fiche : colonne « %s », sans nom de capacité)" % race_headers[COL_HYPER],
                     "%s\n%s" % (hyper_name, hyper_text), fiche(race_row[COL_HYPER])))
    try:
        cited = cited_magics(detail["inconvenient"])
    except ValueError:
        cited = None
    if cited is not None and set(cited[0]) != set(matrix_ok):
        gaps.append(("Magies innées\n(fiche : matrice « %s »)" % TAB_MAGIE,
                     "%s (%d sur %d)" % (", ".join(final_ok), len(final_ok), magic_total),
                     "%s (%d sur %d)" % (", ".join(matrix_ok), len(matrix_ok), magic_total)))
    for entry, frow in pairs:
        if frow is None:
            continue
        sub = norm_ws(frow[BONUS_COL_SUB])
        if entry["form"] != "don" and not (entry_names(entry) & fiche_names(frow)):
            fiche_name = sub + ("" if is_blank(frow[BONUS_COL_NOM]) else "\nNom : %s" % fmt(frow[BONUS_COL_NOM]))
            gaps.append(("Nom de l'ethnie « %s »\n(fiche : colonnes B et C de « %s »)" % (entry["key"], TAB_BONUS),
                         norm_ws(entry["label"]), fiche_name))
        if entry["name"] and not is_blank(frow[BONUS_COL_NOM]) and fold_text(entry["name"]) != fold_text(frow[BONUS_COL_NOM]):
            gaps.append(("Nom du don de l'ethnie « %s »\n(fiche : sous-race « %s », colonne « Nom »)" % (entry["key"], sub),
                         entry["name"], fmt(frow[BONUS_COL_NOM])))
        if not same_lines(entry["text"], frow[BONUS_COL_DESC] or ""):
            gaps.append(("Don de l'ethnie « %s »\n(fiche : sous-race « %s », colonne « Descriptif »)" % (entry["key"], sub),
                         entry["text"], fiche(frow[BONUS_COL_DESC])))
    for frow in only:
        sub = norm_ws(frow[BONUS_COL_SUB])
        gaps.append(("Sous-race « %s » de la fiche\n(colonnes B à D de « %s »)" % (sub, TAB_BONUS),
                     "(absente de l'onglet)", fiche(frow[BONUS_COL_DESC])))
    return gaps


# --------------------------------------------------------------------------------------------------------------------
# Rendu d'une page
# --------------------------------------------------------------------------------------------------------------------

def table_rows(headers, rows):
    out = ["| " + " | ".join(cell_md(h) for h in headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        out.append("| " + " | ".join(cell_md(v) for v in row) + " |")
    return out


def fiche_ref(frow, explicit_none):
    """Ligne « Fiche de personnage » d'une ethnie rapprochée (liste de lignes)."""
    if frow is not None:
        return ["**Fiche de personnage V15.2.2** : sous-race « %s » (voir « %s »)." % (
            esc_inline(norm_ws(frow[BONUS_COL_SUB])), SEC_SOUS), ""]
    return ["**Fiche de personnage V15.2.2** : aucune sous-race correspondante.", ""] if explicit_none else []


def render_ethnies(detail, pairs):
    """Section « Ethnies et dons raciaux » (liste de lignes)."""
    gift = detail["gift"]
    fiche_of = {e["key"]: f for e, f in pairs}
    L = ["## " + SEC_ETH, ""]
    if gift["ethnies"]:
        a_head, h_head, o_head = gift["ethnies"]["headers"]
        heads = [h for h in (a_head, h_head, o_head) if h]
        L += [esc_inline("Rubriques de l'onglet « %s » : %s." % (detail["tab"], ", ".join("« %s »" % h for h in heads))), "",
              "Nombre : %d." % len(gift["ethnies"]["rows"]), ""]
        for row in gift["ethnies"]["rows"]:
            L += ["### " + esc_inline(norm_ws(row["a"])), ""]
            if row["h"]:
                L += labeled(h_head, row["h"]) + [""]
            L += labeled(o_head, row["o"]) + [""]
            L += fiche_ref(fiche_of[first_line(row["a"])], True)
    if gift["single"]:
        name, text = gift["single"]
        L += ["### " + esc_inline(norm_ws(name)), ""] + md_text(text) + [""]
        L += fiche_ref(fiche_of[first_line(name)], True)
    if gift["panels"]:
        heads = list(gift["panels"]["headers"]) + ["Sous-race de la fiche V15.2.2"]
        if gift["name"]:
            L += ["### " + esc_inline(norm_ws(gift["name"])), ""]
        else:
            L += [esc_inline("Tableau de l'onglet « %s » :" % detail["tab"]), ""]
        rows = []
        for row in gift["panels"]["rows"]:
            frow = fiche_of[first_line(row[0])]
            rows.append(list(row) + [norm_ws(frow[BONUS_COL_SUB]) if frow is not None else ""])
        L += ["Nombre : %d." % len(rows), ""] + table_rows(heads, rows) + [""]
    return L


def render_gaps(tab, gaps):
    """Section « Écarts avec la fiche de personnage V15.2.2 » (vide s'il n'y a aucun écart)."""
    if not gaps:
        return []
    L = ["## " + SEC_GAPS, "",
         esc_inline("Cette page suit l'onglet « %s » du Google Sheet « %s », qui prime sur la fiche de personnage (décision du "
                    "propriétaire du projet). La fiche V15.2.2 dit autre chose sur les points suivants ; ses valeurs sont citées "
                    "telles qu'elles y sont écrites." % (tab, INDEX_TITLE)), ""]
    L += table_rows(["Élément", "Onglet « %s » (retenu)" % tab, "Fiche V15.2.2 (citée telle quelle)"], gaps) + [""]
    return L


def render_page(ctx):
    """Page d'une race. `ctx` : name, summary, tab, detail, pairs, gaps, race_headers, race_row, bonus_headers, bonus_rows,
    bonus_spelled, class_names, class_ok, magic_names, magic_ok (magies innées retenues : celles de l'exception si la race
    en a une dans RACE_DETAIL_OVERRIDES, sinon celles de la matrice), matrix_ok (liste de la matrice, citée dans l'écart),
    override."""
    name, summary, detail = ctx["name"], ctx["summary"], ctx["detail"]
    race_headers, race_row = ctx["race_headers"], ctx["race_row"]
    bonus_headers, bonus_rows, bonus_spelled = ctx["bonus_headers"], ctx["bonus_rows"], ctx["bonus_spelled"]
    magic_ok, override = ctx["magic_ok"], ctx["override"]
    sources = list(SOURCES)
    sources.insert(2, tab_source(ctx["tab"]))              # juste après les deux entrées de la première feuille
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

    # Présentation, histoire, description (onglet de la race)
    L += ["## " + SEC_PRES, ""] + md_text(detail["presentation"]) + [""]
    L += ["## " + SEC_HIST, ""] + md_text(detail["histoire"]) + [""]
    if detail["description"] is not None:
        L += ["## " + SEC_DESC, ""] + md_text(detail["description"]) + [""]

    # Caractéristiques de départ : valeurs de l'onglet, puis AP et AM de la fiche (colonnes qui n'existent pas dans l'onglet)
    heads = [label for label, _ in detail["stats"]]
    cells = [" / ".join(values) for _, values in detail["stats"]]
    for col in RACE_STAT_COLS_AFTER:
        if not is_blank(race_row[col]):
            heads.append("%s (fiche)" % race_headers[col])
            cells.append(race_row[col])
    L += ["## " + SEC_STATS, ""] + table(heads, cells) + [""]
    if not is_blank(race_row[COL_DIVERS]):
        L += labeled("%s (fiche)" % race_headers[COL_DIVERS], race_row[COL_DIVERS]) + [""]

    # Avantage(s) et inconvénient(s) de l'onglet
    L += ["## " + SEC_ADV, ""]
    L += labeled(LABEL_ADV, detail["avantage"]) + [""]
    L += labeled(LABEL_INC, detail["inconvenient"]) + [""]

    # Restrictions (fiche)
    restr = []
    for op_col, val_col in RACE_RESTRICTIONS:
        op, val = race_row[op_col], race_row[val_col]
        if is_blank(op) and is_blank(val):
            continue
        text = " ".join(fmt(x) for x in (op, val) if not is_blank(x))
        restr.append((race_headers[val_col], text))
    if restr:
        L += ["## Restrictions", "",
              esc_inline("Valeurs de la fiche de personnage V15.2.2. Chaque valeur est précédée de l'opérateur de la colonne « %s » "
                         "qui la précède dans l'onglet « %s »." % (OPERATOR_HEADER, TAB_RACE)), ""]
        L += table([h for h, _ in restr], [t for _, t in restr]) + [""]

    # Don de base, ethnies et dons raciaux, capacité Mode Hyper (onglet de la race)
    L += ["## " + SEC_DON, ""] + md_text(detail["don_base"]) + [""]
    L += render_ethnies(detail, ctx["pairs"])
    hyper_name, hyper_text = detail["hyper"]
    L += ["## " + SEC_HYPER, ""] + labeled(hyper_name, hyper_text) + [""]

    # Sous-races / origines (fiche)
    if bonus_rows:
        L += ["## " + SEC_SOUS, "",
              esc_inline("Section issue de la fiche de personnage V15.2.2 (onglet « %s »), avec ses bonus chiffrés et "
                         "résistances ; l'onglet de la race, qui prime, est la section « %s »." % (TAB_BONUS, SEC_ETH)), "",
              "Nombre : %d." % len(bonus_rows), ""]
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
    for title, names, ok in (("Classes accessibles", ctx["class_names"], ctx["class_ok"]),
                             ("Magies accessibles", ctx["magic_names"], magic_ok)):
        L += ["## " + title, "", "Nombre : %d sur %d." % (len(ok), len(names)), ""]
        if ok:
            L += [", ".join(esc_inline(n) for n in ok), ""]
        if override and title == "Magies accessibles":
            L += [esc_inline(
                "Écart entre les sources : la matrice « %s » du Google Sheet « %s » donne %d sur %d pour cette race, mais "
                "l'onglet « %s » du Google Sheet « %s » limite la magie innée à ces %d magies (Inconvénient(s) : « %s »). "
                "La liste ci-dessus suit l'onglet (décision du propriétaire du projet : l'onglet de la race prime sur la fiche)."
                % (TAB_MAGIE, FICHE_TITLE, len(ctx["matrix_ok"]), len(names), ctx["tab"], INDEX_TITLE, len(ok),
                   detail["inconvenient"])),
                ""]

    L += render_gaps(ctx["tab"], ctx["gaps"])
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


# --------------------------------------------------------------------------------------------------------------------
# Contrôle de couverture : chaque cellule des onglets de race se retrouve dans la page de sa race
# --------------------------------------------------------------------------------------------------------------------

SHORT_CELL = 20      # une cellule plus courte doit être une unité entière de la page (cellule de tableau, titre, élément...)


def unesc_md(s):
    """Texte brut d'un fragment Markdown écrit par ce script : <br> -> espace, <url> -> url, « ** » de nos libellés et
    échappements « \\x » retirés."""
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<(https?://[^>\s]+)>", r"\1", s)
    s = re.sub(r"(?<!\\)\*\*", "", s)
    return re.sub(r"\\(.)", r"\1", s)


def split_row(line):
    """Cellules brutes d'une ligne de tableau « | a | b | »."""
    return [c.strip() for c in re.split(r"(?<!\\)\|", line.strip()[1:-1])]


def section_units(title, lines):
    """Unités entières d'une section : titre, lignes, cellules de tableau (et leurs segments), éléments de liste, libellés en
    gras et valeurs de « **Libellé** : valeur », textes entre « »."""
    units = {fold_text(unesc_md(title))}
    for raw in lines:
        line = raw.strip()
        if not line or re.fullmatch(r"\|[\s:\-|]*\|", line):
            continue
        if line.startswith("|") and line.endswith("|"):
            for cell in split_row(line):
                units.add(fold_text(unesc_md(cell)))
                for seg in re.split(r"<br\s*/?>|\s+/\s+", cell):
                    units.add(fold_text(unesc_md(seg)))
            continue
        units.add(fold_text(unesc_md(line.lstrip("#").strip())))
        if line.startswith("- "):
            units.add(fold_text(unesc_md(line[2:])))
        m = re.match(r"\*\*(.+?)\*\*(?: : (.*))?$", line)
        if m:
            units.add(fold_text(unesc_md(m.group(1))))
            if m.group(2):
                units.add(fold_text(unesc_md(m.group(2))))
        for quoted in re.findall(r"«\s*(.+?)\s*»", line):
            units.add(fold_text(unesc_md(quoted)))
    return units


def coverage_check(tab, race, raw, roles, page_text):
    """Contrôle de couverture d'un onglet : (nombre de cellules non vides, nombre de cellules appariées, [ignorées],
    [non appariées]). Lit les cellules du dump brut (pas celles de la lecture) et le TEXTE de la page : une cellule est
    appariée si son texte normalisé figure dans la section de page qui la reçoit (`roles`, fournis par la lecture) ; une
    cellule courte doit y être une unité entière. Sinon elle n'est valable que si elle est déclarée ignorée : titre de
    l'onglet, caractère isolé de STRAY_CELLS, étiquette de IGNORABLE_LABELS. Liste d'éléments (référence A1, valeur, raison)."""
    order, parts = page_sections(page_text)
    plain = {t: fold_text(unesc_md(t + "\n" + "\n".join(lines))) for t, lines in parts.items()}
    units = {t: section_units(t, lines) for t, lines in parts.items()}
    titles = {normalize(n) + s for n in (tab, race) for s in ("", "s")}
    total = matched = 0
    ignored, missing = [], []
    for cell in raw["cells"]:
        if is_blank(cell["v"]):
            continue
        total += 1
        r, c, value = cell["r"], cell["c"], fmt(cell["v"])
        ref = a1(r, c)
        if (r, c) == (1, COL_TITLE) and normalize(value) in titles:
            ignored.append((ref, value, "titre décoratif répétant le nom de la race"))
            continue
        stray = STRAY_CELLS.get((tab, ref))
        if stray and stray[0] == value:
            ignored.append((ref, value, stray[1]))
            continue
        section = roles.get((r, c))
        key = fold_text(value)
        if section in parts and ((key in units[section]) if len(key) < SHORT_CELL else (key in plain[section])):
            matched += 1
        elif value in IGNORABLE_LABELS and c in (COL_A, COL_TITLE):
            ignored.append((ref, value, IGNORABLE_LABELS[value]))
        else:
            missing.append((ref, value, "absente de la section « %s »" % section if section else "sans section de page"))
    return total, matched, ignored, missing


def strip_texts(body, texts):
    """`body` privé des `texts` (trouvés dans l'ordre) ; None si l'un manque."""
    pos, rest = 0, []
    for text in texts:
        i = body.find(text, pos)
        if i < 0:
            return None
        rest.append(body[pos:i])
        pos = i + len(text)
    rest.append(body[pos:])
    return " ".join(" ".join(rest).split())


def block_signature(text):
    """Structure d'un texte, indépendante du rendu : [(type, (lignes normalisées))] où type = « p » (lignes consécutives
    sans « - » initial) ou « ul » (lignes consécutives « - »), les blocs étant séparés par une ligne vide ou un changement de
    type. Sert à vérifier que les paragraphes, les listes et les retours à la ligne d'une cellule sont conservés."""
    out, cur, kind = [], [], None
    for raw in fmt(text).split("\n") + [""]:
        line = raw.strip()
        if not line:
            if cur:
                out.append((kind, tuple(cur)))
            cur, kind = [], None
            continue
        k = "ul" if re.match(r"-\s+\S", line) else "p"
        if k != kind and cur:
            out.append((kind, tuple(cur)))
            cur = []
        kind = k
        cur.append(fold_text(line[1:] if k == "ul" else line))
    return out


def exact_problems(label, text, detail, extra_heads):
    """Sections simples comparées en entier (pas un simple « contient ») et tableau des valeurs de départ cellule par cellule."""
    problems = []
    order, parts = page_sections(text)

    def body(title):
        return fold_text(unesc_md("\n".join(parts.get(title, []))))

    def section_blocks(title):
        return block_signature(unesc_md("\n".join(parts.get(title, []))))

    for title, cell in ((SEC_PRES, detail["presentation"]), (SEC_HIST, detail["histoire"]), (SEC_DESC, detail["description"]),
                        (SEC_DON, detail["don_base"])):
        if cell is None:
            if title in parts:
                problems.append("%s : section « %s » présente alors que l'onglet n'a pas de texte" % (label, title))
        elif title not in parts:
            problems.append("%s : section « %s » absente" % (label, title))
        elif section_blocks(title) != block_signature(cell):
            problems.append("%s : section « %s » différente de la cellule de l'onglet (texte, paragraphes ou listes)" % (
                label, title))
    for title, texts, leftover in (
            (SEC_ADV, [detail["avantage"], detail["inconvenient"]], "avantage(s) inconvénient(s)"),
            (SEC_HYPER, [detail["hyper"][0], detail["hyper"][1]], "")):
        if title not in parts:
            problems.append("%s : section « %s » absente" % (label, title))
            continue
        rest = strip_texts(body(title), [fold_text(t) for t in texts])
        if rest is None or re.sub(r"[\s:]+", " ", rest).strip() != leftover:
            problems.append("%s : section « %s » différente des cellules de l'onglet" % (label, title))
    # valeurs de départ : le tableau doit porter chaque libellé au-dessus de SA valeur
    rows = [l for l in parts.get(SEC_STATS, []) if l.startswith("|")]
    if len(rows) != 3:
        problems.append("%s : section « %s » : un tableau à une ligne attendu" % (label, SEC_STATS))
    else:
        heads = [fold_text(unesc_md(c)) for c in split_row(rows[0])]
        values = [fold_text(unesc_md(c)) for c in split_row(rows[2])]
        n = len(detail["stats"])
        want_heads = [fold_text(l) for l, _ in detail["stats"]] + [fold_text(h) for h in extra_heads]
        want_values = [fold_text(" / ".join(v)) for _, v in detail["stats"]]
        if heads != want_heads or values[:n] != want_values or len(values) != len(heads):
            problems.append("%s : « %s » : en-têtes %s / valeurs %s, attendu %s / %s" % (
                label, SEC_STATS, heads, values, want_heads, want_values + ["..."]))
    return problems


def gaps_problems(label, text, tab, gaps):
    """La section « Écarts » de la page = les écarts recalculés (absente s'il n'y en a aucun)."""
    order, parts = page_sections(text)
    if not gaps:
        return ["%s : section « %s » présente alors qu'il n'y a aucun écart" % (label, SEC_GAPS)] if SEC_GAPS in parts else []
    if SEC_GAPS not in parts:
        return ["%s : section « %s » absente (%d écart(s) attendu(s))" % (label, SEC_GAPS, len(gaps))]
    rows = [split_row(l) for l in parts[SEC_GAPS] if l.startswith("|")][2:]
    got = [tuple(fold_text(unesc_md(c)) for c in row) for row in rows]
    want = [tuple(fold_text(unesc_md(cell_md(c))) for c in gap) for gap in gaps]
    if got != want:
        return ["%s : section « %s » différente des écarts recalculés (%d ligne(s) lue(s), %d attendue(s))" % (
            label, SEC_GAPS, len(got), len(want))]
    return []


def detail_problems(label, text, detail, tab, extra_heads, gaps, raw):
    """Contrôles d'une page de race issus du détail : entrée de source de l'onglet, sections simples en entier, valeurs de
    départ, écarts, couverture de toutes les cellules de l'onglet."""
    problems = []
    sources = front_list(text, "sources")
    if not isinstance(sources, list) or tab_source(tab) not in sources:
        problems.append("%s : entrée de source absente : %s" % (label, tab_source(tab)))
    problems += exact_problems(label, text, detail, extra_heads)
    problems += gaps_problems(label, text, tab, gaps)
    total, matched, ignored, missing = coverage_check(tab, detail["race"], raw, detail["roles"], text)
    for ref, value, why in missing[:10]:
        problems.append("%s : cellule %s de l'onglet « %s » non appariée (%r) : %s" % (label, ref, tab, value[:50], why))
    if len(missing) > 10:
        problems.append("%s : ... et %d autre(s) cellule(s) non appariée(s)" % (label, len(missing) - 10))
    return problems


def override_problems(overrides, matrix):
    """Écarts de RACE_DETAIL_OVERRIDES avec son contrat (liste vide si tout va bien). `matrix` = sortie de expected_magic.
    Exige : (a) l'exception de chaque race de OVERRIDES_REQUIS existe, et chaque exception DIFFÈRE de la matrice (sinon
    elle est redondante) ; (b) ses noms sont tous dans MAGIC_HEADERS, sans doublon, dans l'ordre des colonnes ; la race
    existe dans la matrice, tous les champs sont là et il n'y en a pas d'autre."""
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
        unknown = [f for f in ov if f not in OVERRIDE_FIELDS]
        if absent or unknown:
            problems.append("%s : champ(s) manquant(s) %s, inconnu(s) %s" % (label, absent, unknown))
            continue
        names = ov["magies_innees"]
        if not isinstance(names, list) or not names or not all(isinstance(n, str) for n in names):
            problems.append("%s : magies_innees doit être une liste non vide de noms" % label)
        else:
            bad = [n for n in names if n not in MAGIC_HEADERS]
            if bad:
                problems.append("%s : nom(s) absent(s) des en-têtes de %s : %r" % (label, TAB_MAGIE, bad))
            elif names != [h for h in MAGIC_HEADERS if h in names]:
                problems.append("%s : noms en double ou hors de l'ordre des colonnes de %s : %r, attendu %r" % (
                    label, TAB_MAGIE, names, [h for h in MAGIC_HEADERS if h in names]))
            if names == matrix[key][1]:
                problems.append("%s redondante : identique à la matrice %s (%d magies)" % (label, TAB_MAGIE, len(names)))
    return problems


def page_problems(label, text, wanted, matrix_ones, override, inconvenient=None):
    """Écarts d'une page (texte complet) avec `wanted` = magies innées attendues (celles de l'exception si la race en a une,
    sinon celles de la matrice `matrix_ones`). (c) pour une race à exception : `magies_innees`, liste et nombre de « Magies
    accessibles » = l'exception, avec un paragraphe d'écart qui cite l'Inconvénient(s) de l'onglet (`inconvenient`) et le
    compte de la matrice. (d) toute autre race : listes et nombre = matrice."""
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
    gap = " ".join(paragraphs(page_sections(text)[1].get("Magies accessibles", []))[2:])
    if not gap:
        problems.append("%s : « Magies accessibles » : paragraphe d'écart absent" % label)
    else:
        if inconvenient is not None and inconvenient not in gap:
            problems.append("%s : le paragraphe d'écart ne cite pas l'Inconvénient" % label)
        if "%d sur %d" % (len(matrix_ones), len(MAGIC_HEADERS)) not in gap:
            problems.append("%s : le paragraphe d'écart ne donne pas le compte de la matrice (%d sur %d)" % (
                label, len(matrix_ones), len(MAGIC_HEADERS)))
    return problems


def expected_stat_gaps(paths):
    """{clé de race: {élément: (valeur de l'onglet, valeur de la fiche)}} recalculé SANS TabReader ni lecture de la fiche du
    script : directement dans les dumps bruts (colonnes H, P, X, AF, AH de la ligne « Santé de départ » de l'onglet ;
    colonnes B à F de la ligne de la race dans « Race »). Sert à contrôler les écarts de valeurs de départ des pages."""
    detail = fiche = None
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            sheets = json.load(fh)["sheets"]
        names = [s["name"] for s in sheets]
        if TAB_MODELE in names:
            detail = {s["name"]: s for s in sheets}
        if TAB_RACE in names:
            fiche = next(s for s in sheets if s["name"] == TAB_RACE)
    if detail is None or fiche is None:
        raise ValueError("verifier : il faut le dump du classeur « %s » et celui de la fiche personnage" % INDEX_TITLE)
    race_row = {}
    for c in fiche["cells"]:
        if c["c"] == 1 and c["r"] > 1:
            race_row[normalize(c["v"])] = c["r"]
    grid_f = {(c["r"], c["c"]): c["v"] for c in fiche["cells"]}
    out = {}
    for tab, sheet in detail.items():
        if tab in DETAIL_NOT_PUBLISHED:
            continue
        key = RACE_TAB_NAMES.get(normalize(tab), normalize(tab))
        grid = {(c["r"], c["c"]): c["v"] for c in sheet["cells"] if not is_blank(c["v"])}
        row = next(r for (r, c), v in grid.items() if c == 2 and v == STAT_LABELS[0])
        tab_values = [grid[(row, 8)], grid[(row, 16)], grid[(row, 24)], grid[(row, 32)], grid[(row, 34)]]
        names = [STAT_LABELS[0], STAT_LABELS[1], STAT_LABELS[2], STAT_LABELS[3] + " (sol)", STAT_LABELS[3] + " (nage)"]
        gaps = {}
        for k, (name, value) in enumerate(zip(names, tab_values)):
            fv = grid_f[(race_row[key], 2 + k)]
            if float(str(value).replace(",", ".")) != float(fv):
                gaps[name] = (str(value), fmt(fv))
        out[key] = gaps
    return out


def page_gap_rows(text):
    """Lignes du tableau « Écarts » d'une page : [(élément sur une ligne, texte de l'onglet, texte de la fiche)], bruts."""
    parts = page_sections(text)[1].get(SEC_GAPS, [])
    rows = [split_row(l) for l in parts if l.startswith("|")][2:]
    return [(unesc_md(re.split(r"<br\s*/?>", r[0])[0]).strip(), unesc_md(r[1]).strip(), unesc_md(r[2]).strip()) for r in rows]


def stat_gap_problems(label, key, text, expected):
    """Les lignes de valeurs de départ de la section « Écarts » = celles recalculées à part dans les dumps bruts."""
    names = {STAT_LABELS[0], STAT_LABELS[1], STAT_LABELS[2], STAT_LABELS[3] + " (sol)", STAT_LABELS[3] + " (nage)"}
    got = {e: (t, f) for e, t, f in page_gap_rows(text) if e in names}
    want = expected.get(key, {})
    if got != want:
        return ["%s : écarts de valeurs de départ de la page %r, recalculés dans les dumps %r" % (label, got, want)]
    return []


def raw_inconvenient(raw):
    """Texte de la cellule « Inconvénient(s) » d'un onglet, lu directement dans le dump brut (sans TabReader)."""
    grid = {(c["r"], c["c"]): c["v"] for c in raw["cells"] if not is_blank(c["v"])}
    rows = [r for (r, c), v in grid.items() if c == COL_A and v == LABEL_INC]
    return fmt(grid[(rows[0], COL_H)]) if len(rows) == 1 and (rows[0], COL_H) in grid else None


def cited_magic_problems(label, text, raw):
    """Vérification croisée sur la page écrite : la liste que cite la cellule « Inconvénient(s) » de l'onglet (relue dans le
    dump brut) est exactement `magies_innees` du frontmatter de la page."""
    inconvenient = raw_inconvenient(raw)
    if inconvenient is None:
        return ["%s : cellule « %s » introuvable dans l'onglet" % (label, LABEL_INC)]
    try:
        cited = cited_magics(inconvenient)
    except ValueError as exc:
        return ["%s : %s" % (label, exc)]
    front = front_list(text, MAGIC_FIELD)
    if cited is not None and (front is None or len(cited[0]) != len(set(cited[0])) or set(cited[0]) != set(front)):
        return ["%s : l'onglet cite %r (« %s ») mais %s de la page = %r" % (label, cited[0], inconvenient, MAGIC_FIELD, front)]
    return []


def page_slug_path(wiki_root, slug):
    return os.path.join(wiki_root, CATEGORY, slug + ".md")


def check_pages(paths, wiki_root, world):
    """Compare chaque page `races/<slug>.md` aux valeurs recalculées ; liste des écarts (vide si tout concorde). Pour
    chaque race : contrat des magies (page_problems), contrôles du détail (detail_problems), écarts de valeurs de départ
    recalculés à part, et page identique à sa régénération en mémoire."""
    problems = []
    matrix = expected_magic(paths)
    stat_expected = expected_stat_gaps(paths)
    by_key = {normalize(n): o for n, o in RACE_DETAIL_OVERRIDES.items()}
    out_dir = os.path.join(wiki_root, CATEGORY)
    for name, slug, rendered, ctx in world["pages"]:
        path = page_slug_path(wiki_root, slug)
        if not os.path.exists(path):
            problems.append("%s : page absente" % path)
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        key = normalize(name)
        override = by_key.get(key)
        ones = matrix[key][1]
        problems += page_problems(path, text, override["magies_innees"] if override else ones, ones, override,
                                  ctx["detail"]["inconvenient"])
        problems += cited_magic_problems(path, text, ctx["raw"])
        problems += detail_problems(path, text, ctx["detail"], ctx["tab"], ctx["extra_heads"], ctx["gaps"], ctx["raw"])
        problems += stat_gap_problems(path, key, text, stat_expected)
        if text != rendered:
            problems.append("%s : page différente de sa régénération depuis les dumps" % path)
    slugs = {slug for _, slug, _, _ in world["pages"]}
    if os.path.isdir(out_dir):
        for fname in sorted(os.listdir(out_dir)):
            if fname.endswith(".md") and fname[:-3] not in slugs:
                with open(os.path.join(out_dir, fname), encoding="utf-8") as fh:
                    if source_url(FICHE_ID) in fh.read():
                        problems.append("%s : page issue de ce classeur sans race dans %s" % (fname, TAB_MAGIE))
    return problems


# --------------------------------------------------------------------------------------------------------------------
# Construction de toutes les pages en mémoire
# --------------------------------------------------------------------------------------------------------------------

def build_world(paths):
    """Lit les trois dumps, rapproche les onglets, vérifie et produit les pages EN MÉMOIRE (rien n'est écrit). Une
    disposition inconnue lève ValueError (avec la cellule en cause) ; les contrôles de cohérence (matrice, exceptions,
    table des ethnies, vérification croisée des magies, couverture) vont dans world["problems"]. Si la table des ethnies est
    en défaut, aucune page n'est produite."""
    index_sheet, fiche, detail_raw = load_dumps(paths)
    races = read_index(index_sheet)
    race_headers, race_data = read_race_tab(fiche[TAB_RACE], races)
    bonus_headers, bonus_rows, bonus_spelled = read_bonus_tab(fiche[TAB_BONUS], races)
    class_names, class_ok = read_matrix(fiche[TAB_CLASS], races)
    magic_names, magic_ok = read_matrix(fiche[TAB_MAGIE], races)
    problems = []
    # Contrôle avant toute écriture : le second calcul (voir « Vérification indépendante ») doit donner les mêmes listes.
    expected = expected_magic(paths)
    for name, _ in races:
        if expected[normalize(name)][1] != magic_ok[normalize(name)]:
            problems.append("%s de %s : %r d'un côté, %r de l'autre" % (
                MAGIC_FIELD, name, magic_ok[normalize(name)], expected[normalize(name)][1]))
    # Exceptions de détail : validées contre la matrice recalculée, puis appliquées à leur race seule.
    problems += override_problems(RACE_DETAIL_OVERRIDES, expected)
    overrides = {normalize(n): o for n, o in RACE_DETAIL_OVERRIDES.items()}
    final_ok = {k: (overrides[k]["magies_innees"] if k in overrides else v) for k, v in magic_ok.items()}

    tabs = match_detail_tabs(detail_raw, races)
    unpublished = check_unpublished(detail_raw, races)
    details = {normalize(name): read_detail_tab(detail_raw[tabs[normalize(name)]], tabs[normalize(name)], name)
               for name, _ in races}
    matched, ethnie_found = ethnie_problems(details, bonus_rows)
    problems += ethnie_found
    notes, found = magic_cross_check(details, final_ok)
    problems += found
    world = {"races": races, "detail_raw": detail_raw, "details": details, "tabs": tabs, "unpublished": unpublished,
             "overrides": overrides, "magic_ok": magic_ok, "final_ok": final_ok, "magic_names": magic_names,
             "cross": notes, "matched": matched, "pages": [], "coverage": {}, "gap_lists": {}, "bonus_rows": bonus_rows,
             "problems": problems, "race_data": race_data, "race_headers": race_headers}
    if ethnie_found or any(k not in matched for k in details):
        return world
    for name, summary in races:
        key = normalize(name)
        detail, (pairs, only) = details[key], matched[key]
        gaps = compute_gaps(detail, race_headers, race_data[key], pairs, only, magic_ok[key], final_ok[key], len(magic_names))
        extra_heads = ["%s (fiche)" % race_headers[c] for c in RACE_STAT_COLS_AFTER if not is_blank(race_data[key][c])]
        ctx = {"name": name, "summary": summary, "tab": tabs[key], "detail": detail, "pairs": pairs, "gaps": gaps,
               "race_headers": race_headers, "race_row": race_data[key], "bonus_headers": bonus_headers,
               "bonus_rows": bonus_rows[key], "bonus_spelled": bonus_spelled[key], "class_names": class_names,
               "class_ok": class_ok[key], "magic_names": magic_names, "magic_ok": final_ok[key], "matrix_ok": magic_ok[key],
               "override": overrides.get(key), "extra_heads": extra_heads, "raw": detail_raw[tabs[key]]}
        text = render_page(ctx)
        if "[[" in text:
            print("AVERTISSEMENT : « [[ » dans une cellule de %s (échappé, pas un lien)" % name, file=sys.stderr)
        world["pages"].append((name, key, text, ctx))
        world["gap_lists"][key] = gaps
        total, ok, ignored, missing = coverage_check(ctx["tab"], name, ctx["raw"], detail["roles"], text)
        world["coverage"][key] = (total, ok, ignored, missing)
        for ref, value, why in missing:
            problems.append("%s : cellule %s de l'onglet « %s » non appariée (%r) : %s" % (name, ref, ctx["tab"], value[:50], why))
        problems += exact_problems(name, text, detail, extra_heads)
    slugs = [s for _, s, _, _ in world["pages"]]
    if len(set(slugs)) != len(slugs):
        raise ValueError("slugs en double : %s" % slugs)
    return world


# --------------------------------------------------------------------------------------------------------------------
# Cas d'erreur rejoués (--verifier)
# --------------------------------------------------------------------------------------------------------------------

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
    del without_field[name]["magies_innees"]
    cases = [
        ("exception redondante (identique à la matrice)", variant(magies_innees=list(ones))),
        ("exception absente", {k: v for k, v in base.items() if k != name}),
        ("nom absent de MAGIC_HEADERS", variant(magies_innees=names[:-1] + ["Poison"])),
        ("noms hors de l'ordre des colonnes", variant(magies_innees=list(reversed(names)))),
        ("nom en double", variant(magies_innees=names + names[-1:])),
        ("liste vide", variant(magies_innees=[])),
        ("race absente de la matrice", dict(base, Gnome=base[name])),
        ("champ manquant", without_field),
        ("champ inconnu", variant(avantage="x")),
    ]
    failures = []
    for label, overrides in cases:
        if not override_problems(overrides, matrix):
            failures.append("exception : %s : aucun écart signalé" % label)
    # contrôle de sens : une exception valide et différente de la matrice est acceptée
    if override_problems(variant(magies_innees=list(ones[:-1])), matrix):
        failures.append("exception : une liste valide, différente de la matrice, est refusée à tort")
    return failures


def mutate_page(text, old, new, count=1):
    """Copie de `text` où `old` devient `new` ; None si `old` est absent (le cas de rejeu est alors défaillant)."""
    return text.replace(old, new, count) if old in text else None


def drop_section(text, title):
    return re.sub(r"^## %s\n.*?(?=^## |\Z)" % re.escape(title), "", text, count=1, flags=re.S | re.M)


def drop_subsection(text, title):
    return re.sub(r"^### %s\n.*?(?=^###? |\Z)" % re.escape(title), "", text, count=1, flags=re.S | re.M)


def page_replays(paths, wiki_root, world):
    """Rejoue page_problems (contrat des magies) sur des copies modifiées de la page du Nain : chaque cas doit signaler un
    écart (et changer le texte)."""
    matrix = expected_magic(paths)
    by_key = {normalize(n): o for n, o in RACE_DETAIL_OVERRIDES.items()}

    def read(key):
        with open(page_slug_path(wiki_root, key), encoding="utf-8") as fh:
            return fh.read()

    failures = []

    def run(label, original, mutated, key, wanted, override, inconvenient):
        if mutated is None or mutated == original:
            failures.append("page %s : %s : le cas ne modifie pas la page" % (key, label))
        elif not page_problems(key, mutated, wanted, matrix[key][1], override, inconvenient):
            failures.append("page %s : %s : aucun écart signalé" % (key, label))

    for key, ov in sorted(by_key.items()):
        text, wanted, ones = read(key), ov["magies_innees"], matrix[key][1]
        total = len(MAGIC_HEADERS)
        inconvenient = world["details"][key]["inconvenient"]
        accessibles = text.partition("\n## Magies accessibles\n")
        cases = [
            ("frontmatter = matrice", set_front_list(text, MAGIC_FIELD, ones)),
            ("liste du corps = matrice", text.replace("\n" + ", ".join(wanted) + "\n", "\n" + ", ".join(ones) + "\n")),
            ("nombre du corps = matrice", text.replace("Nombre : %d sur %d." % (len(wanted), total),
                                                       "Nombre : %d sur %d." % (len(ones), total))),
            ("écart sans citation de l'Inconvénient", "".join(accessibles[:2]) + accessibles[2].replace(inconvenient, "")),
        ]
        for label, mutated in cases:
            run(label, text, mutated, key, wanted, ov, inconvenient)
        # (d) une autre race ne doit pas porter la liste de l'exception
        other = next(k for k, (_, o) in sorted(matrix.items()) if k not in by_key and o != wanted)
        other_text = read(other)
        run("race sans exception portant la liste de l'exception", other_text,
            set_front_list(other_text, MAGIC_FIELD, wanted), other, matrix[other][1], None, None)
    return failures


def detail_replays(wiki_root, world):
    """Rejoue detail_problems / stat_gap_problems sur des copies modifiées des pages : chaque cas doit signaler un écart."""
    stat_expected = expected_stat_gaps(world["paths"])
    ctxs = {key: ctx for _, key, _, ctx in world["pages"]}
    failures = []

    def read(slug):
        with open(page_slug_path(wiki_root, slug), encoding="utf-8") as fh:
            return fh.read()

    def run(label, slug, mutate):
        ctx, original = ctxs[slug], read(slug)
        mutated = mutate(original)
        if mutated is None or mutated == original:
            failures.append("page %s : %s : le cas ne modifie pas la page" % (slug, label))
            return
        found = detail_problems(slug, mutated, ctx["detail"], ctx["tab"], ctx["extra_heads"], ctx["gaps"], ctx["raw"])
        found += stat_gap_problems(slug, slug, mutated, stat_expected)
        if not found:
            failures.append("page %s : %s : aucun écart signalé" % (slug, label))

    def alter(old):
        return lambda text: mutate_page(text, old, "X" + old[1:])

    run("section « Histoire » supprimée", "humain", lambda t: drop_section(t, SEC_HIST))
    run("section « Présentation » supprimée", "humain", lambda t: drop_section(t, SEC_PRES))
    run("présentation altérée", "humain", alter("Race majoritaire dans le monde"))
    run("description altérée", "humain", alter("Un humain adulte mesure"))
    run("ethnie supprimée", "humain", lambda t: drop_subsection(t, "Humain Toundra"))
    run("nom de don altéré", "humain", alter("Adaptation humaine"))
    run("don de base altéré", "humain", alter("Méditation (Action 3 fois/jour)"))
    run("capacité Mode Hyper altérée", "humain", alter("Adrénaline"))
    run("avantage altéré", "humain", alter("Accès à toutes les classes"))
    run("valeurs de départ échangées", "drakos", lambda t: mutate_page(t, "| 13 | 10 | 0 |", "| 10 | 13 | 0 |"))
    run("ligne du tableau des dons de race supprimée", "drakos",
        lambda t: re.sub(r"^\| Corruption \|.*\n", "", t, count=1, flags=re.M))
    run("cellule du tableau en deux panneaux altérée", "mort-vivant", alter("- Mort par saignement"))
    run("source de l'onglet retirée", "nain",
        lambda t: set_front_list(t, "sources", [s for s in front_list(t, "sources") if s != tab_source("Nain")]))
    run("section « Écarts » supprimée", "drakos", lambda t: drop_section(t, SEC_GAPS))
    run("valeur de la fiche altérée dans les écarts", "drakos", lambda t: mutate_page(t, "| 13 | 10.0 |", "| 13 | 11.0 |"))
    run("écart de valeur de départ supprimé", "drakos",
        lambda t: re.sub(r"^\| Santé de départ<br>.*\n", "", t, count=1, flags=re.M))
    run("section « Description » supprimée", "elfe-dore", lambda t: drop_section(t, SEC_DESC))
    run("don unique altéré", "majin", alter("Une fois la stabilisation"))
    run("deux paragraphes de l'histoire fusionnés", "humain",
        lambda t: re.sub(r"(## Histoire\n\n[^\n]+)\n\n", r"\1  \n", t, count=1))
    run("liste de la description aplatie", "humain", lambda t: mutate_page(t, "- Les humains centraux", "Les humains centraux"))
    run("paragraphe de l'histoire tronqué", "nain", lambda t: re.sub(r"(?s)(## Histoire\n\n)(.*?)(\n\n## )", r"\1\3", t, count=1))
    return failures


def mutated_raw(raw, edits):
    """Copie du dump brut d'un onglet avec `edits` : (ligne, colonne, valeur) ; valeur None = cellule supprimée."""
    cells = [dict(c) for c in raw["cells"]]
    for r, c, value in edits:
        cells = [x for x in cells if not (x["r"] == r and x["c"] == c)]
        if value is not None:
            cells.append({"r": r, "c": c, "v": value})
    return dict(raw, cells=cells)


def layout_replays(world):
    """Rejoue read_detail_tab (et les contrôles d'onglets) sur des copies modifiées : toute disposition inconnue doit lever
    ValueError. Contrôle de sens : la copie non modifiée est lue sans erreur."""
    raw, failures = world["detail_raw"], []

    def cell(tab, text, col=None):
        found = [(c["r"], c["c"]) for c in raw[tab]["cells"] if c["v"] == text and (col is None or c["c"] == col)]
        return found[0]

    def run(label, tab, race, edits):
        try:
            read_detail_tab(mutated_raw(raw[tab], edits), tab, race)
        except ValueError:
            return
        failures.append("onglet %s : %s : aucune erreur levée" % (tab, label))

    hr, hc = cell("Humain", "Don", COL_O)
    run("cellule inconnue ajoutée", "Humain", "Humain", [(50, 3, "x")])
    run("cellule inconnue entre les valeurs de départ et Avantage(s)", "Humain", "Humain", [(15, 3, "x")])
    run("libellé « Capacité Mode Hyper » supprimé", "Humain", "Humain", [(*cell("Humain", LABEL_HYPER, COL_A), None)])
    run("libellé « Avantage(s) » en double", "Humain", "Humain", [(60, COL_A, LABEL_ADV)])
    run("valeur de départ non numérique", "Humain", "Humain", [(14, 8, "dix")])
    run("valeur de départ en trop", "Humain", "Humain", [(14, 36, "1")])
    run("libellé de départ renommé", "Humain", "Humain", [(*cell("Humain", "Santé de départ"), "Santé")])
    run("en-tête « Don » renommé", "Humain", "Humain", [(hr, hc, "Dons")])
    run("ligne d'ethnie sans texte du don", "Humain", "Humain", [(30, COL_O, None)])
    run("« HISTOIRE » renommé", "Humain", "Humain", [(1, COL_AK, "HISTOIRES")])
    run("titre qui ne répète pas la race", "Humain", "Humain", [(1, COL_TITLE, "ELFE")])
    run("cellule en trop dans le panneau de droite", "Humain", "Humain", [(60, 38, "x")])
    run("description générale supprimée", "Humain", "Humain", [(4, 1, None)])
    run("Avantage(s) sans texte", "Humain", "Humain", [(17, COL_H, None)])
    run("caractère isolé modifié", "Drakos", "Drakos", [(1, 1, ")")])
    run("panneaux de tableau différents", "Drakos", "Drakos", [(28, 24, "AP/AM2")])
    run("ligne de tableau incomplète", "Drakos", "Drakos", [(30, 6, None)])
    run("cellule hors des colonnes du tableau", "Drakos", "Drakos", [(30, 3, "x")])
    run("don unique et nom de don sur la ligne du libellé", "Mort-vivant", "Mort-vivant", [(26, COL_H, "x")])
    run("bloc « Don R (Race) » vide", "Elfe Doré", "Elfe doré", [(28, COL_A, None), (28, COL_H, None)])
    run("cellule en trop après la capacité", "Elfe Doré", "Elfe doré", [(40, COL_A, "x")])
    for label, edits, tab in (
            ("gabarit « Modèle » modifié", [(60, 1, "Nouveau libellé")], TAB_MODELE),
            ("onglet « Statistique » avec un texte", [(40, 3, "Une règle de jeu")], TAB_STATS)):
        if tab not in raw:
            continue
        broken = dict(raw, **{tab: mutated_raw(raw[tab], edits)})
        try:
            check_unpublished(broken, world["races"])
        except ValueError:
            continue
        failures.append("onglets non publiés : %s : aucune erreur levée" % label)
    extra = dict(raw, Inconnu=mutated_raw(raw["Humain"], []))
    for label, tabs in (("onglet inconnu", extra), ("race sans onglet", {k: v for k, v in raw.items() if k != "Elfe Doré"})):
        try:
            match_detail_tabs(tabs, world["races"])
        except ValueError:
            continue
        failures.append("%s : aucune erreur levée" % label)
    return failures


def ethnie_replays(world):
    """Rejoue ethnie_problems sur des copies modifiées de ETHNIE_FICHE : chaque cas doit signaler un écart ; la table telle
    quelle n'en signale aucun."""
    failures = []
    details, bonus_rows = world["details"], world["bonus_rows"]
    if ethnie_problems(details, bonus_rows)[1]:
        failures.append("table des ethnies : écarts signalés sur la table réelle")
    base = copy.deepcopy(ETHNIE_FICHE)

    def variant(race, **edit):
        out = copy.deepcopy(base)
        for k, v in edit.items():
            out[race][k.replace("_", " ")] = v
        return out

    cases = []
    gone = copy.deepcopy(base)
    del gone["Humain"]["Humain Central"]
    cases.append(("ethnie de l'onglet absente de la table", gone))
    extra = copy.deepcopy(base)
    extra["Humain"]["Humain Fantôme"] = None
    cases.append(("ethnie de la table absente de l'onglet", extra))
    twice = copy.deepcopy(base)
    twice["Humain"]["Humain Désertique"] = "Humain Central"
    cases.append(("deux ethnies vers la même sous-race", twice))
    unknown = copy.deepcopy(base)
    unknown["Humain"]["Humain Central"] = "Humain Lointain"
    cases.append(("sous-race inexistante dans la fiche", unknown))
    swapped = copy.deepcopy(base)
    swapped["Nain"]["Londolor Est"], swapped["Nain"]["Londolor Ouest"] = "Nain Ouest", "Nain Est"
    cases.append(("deux ethnies échangées (aucun indice)", swapped))
    orphan = copy.deepcopy(base)
    orphan["Elfe forestier"]["Urbain (tout le reste)"] = None
    cases.append(("sous-race de la fiche laissée sans correspondance", orphan))
    race_gone = {k: v for k, v in base.items() if k != "Nain"}
    cases.append(("race absente de la table", race_gone))
    cases.append(("race inconnue dans la table", dict(base, Gnome={})))
    for label, spec in cases:
        if not ethnie_problems(details, bonus_rows, spec)[1]:
            failures.append("table des ethnies : %s : aucun écart signalé" % label)
    # sous-race déclarée seule : acceptée, et rendue en écart
    declared = copy.deepcopy(base)
    declared["Elfe forestier"]["Urbain (tout le reste)"] = None
    if ethnie_problems(details, bonus_rows, declared, {"Elfe forestier": ["Elfe Forestier Urbain"]})[1]:
        failures.append("table des ethnies : une sous-race déclarée seule est refusée à tort")
    return failures


def magic_replays(world):
    """Rejoue magic_cross_check sur des copies modifiées des lignes « Inconvénient(s) » et des listes de pages."""
    failures = []
    details, final_ok = world["details"], world["final_ok"]
    if magic_cross_check(details, final_ok)[1]:
        failures.append("vérification croisée des magies : écarts signalés sur les données réelles")

    def with_text(key, text):
        out = copy.deepcopy(details)
        out[key]["inconvenient"] = text
        return out

    orios, nain = normalize("Orios"), normalize("Nain")
    cases = [
        ("une magie citée remplacée", with_text(orios, details[orios]["inconvenient"].replace("Terre", "Vent")), final_ok),
        ("une magie citée en moins", with_text(orios, "Magie Terre et Sang en innée."), final_ok),
        ("une magie citée en trop", with_text(orios, "Magie Terre, Eau, Sang et Feu en innée."), final_ok),
        ("magie citée en double", with_text(orios, "Magie Terre, Terre et Sang en innée."), final_ok),
        ("nom de magie inconnu", with_text(orios, "Magie Terre, Poison et Sang en innée."), final_ok),
        ("citation illisible", with_text(orios, "Terre, Eau et Sang en innée."), final_ok),
        ("liste de la page = matrice pour le Nain", details, dict(final_ok, **{nain: list(world["magic_ok"][nain])})),
    ]
    for label, d, ok in cases:
        if not magic_cross_check(d, ok)[1]:
            failures.append("vérification croisée des magies : %s : aucun écart signalé" % label)
    # contrôle de sens : « Temps/Espace » et « Espace/Temps » sont la même magie
    key = normalize("Olwman")
    if magic_cross_check(with_text(key, "Magie Vent, Ombre et Espace/Temps en innée, ne peut pas nager."), final_ok)[1]:
        failures.append("vérification croisée des magies : « Espace/Temps » refusé à tort")
    return failures


def coverage_replays(world, wiki_root):
    """Rejoue coverage_check sur des copies de l'onglet de Humain : une cellule changée ou absente de la page doit être
    signalée ; une cellule ignorée sans déclaration aussi."""
    failures = []
    key = normalize("Humain")
    ctx = next(c for _, k, _, c in world["pages"] if k == key)
    with open(page_slug_path(wiki_root, key), encoding="utf-8") as fh:
        text = fh.read()
    raw, roles = ctx["raw"], ctx["detail"]["roles"]
    total, ok, ignored, missing = coverage_check(ctx["tab"], "Humain", raw, roles, text)
    if missing or ok + len(ignored) != total:
        failures.append("couverture de Humain : cellules non appariées sur la page réelle : %s" % missing[:3])
    cases = [
        ("cellule de l'onglet changée", mutated_raw(raw, [(30, COL_O, "- Un autre texte entièrement différent.")]), text),
        ("cellule ajoutée à l'onglet", mutated_raw(raw, [(50, 3, "Texte absent de la page")]), text),
        ("valeur de départ changée", mutated_raw(raw, [(14, 8, "99")]), text),
        ("titre qui ne répète pas la race", mutated_raw(raw, [(1, COL_TITLE, "TITRE QUELCONQUE")]), text),
        ("étiquette inconnue à la place de « Don B (Base) »", mutated_raw(raw, [(23, COL_A, "Don de base")]), drop_section(text, SEC_DON)),
        ("page sans la section « Histoire »", raw, drop_section(text, SEC_HIST)),
    ]
    for label, mraw, mtext in cases:
        if not coverage_check(ctx["tab"], "Humain", mraw, roles, mtext)[3]:
            failures.append("couverture : %s : aucune cellule signalée" % label)
    return failures


def error_cases(paths, wiki_root, overrides_ok, pages_ok, world=None):
    """Rejoue read_matrix sur des copies modifiées de la matrice : chaque cas doit lever ValueError. Liste des échecs.
    Rejoue aussi les exceptions (override_replays, si RACE_DETAIL_OVERRIDES est valide) et, quand `world` est là et que les
    pages sont conformes (sinon l'écart est déjà signalé) : les pages (page_replays, detail_replays), les onglets
    (layout_replays), la table des ethnies, la vérification croisée des magies et la couverture."""
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
    if world is not None:
        failures += layout_replays(world) + ethnie_replays(world) + magic_replays(world)
        if pages_ok:
            failures += page_replays(paths, wiki_root, world) + detail_replays(wiki_root, world) + coverage_replays(world, wiki_root)
    return failures


def run_verifier(paths, wiki_root):
    matrix = expected_magic(paths)
    problems = override_problems(RACE_DETAIL_OVERRIDES, matrix)
    world = None
    try:
        world = build_world(paths)
        world["paths"] = list(paths)
        problems += world["problems"]
    except ValueError as exc:
        problems.append("lecture des dumps : %s" % exc)
    pages = check_pages(paths, wiki_root, world) if world is not None and world["pages"] and not problems else []
    pages_ok = world is not None and bool(world["pages"]) and not problems and not pages
    problems += pages + error_cases(paths, wiki_root, not override_problems(RACE_DETAIL_OVERRIDES, matrix),
                                    pages_ok, world if world is not None and world["pages"] else None)
    if problems:
        raise SystemExit("--verifier : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))
    print("--verifier : %d pages conformes aux dumps (%s, détail des onglets, couverture, écarts), dont %d exception(s) de "
          "détail (%s), cas d'erreur rejoués" % (len(matrix), MAGIC_FIELD, len(RACE_DETAIL_OVERRIDES), ", ".join(RACE_DETAIL_OVERRIDES)))


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


def gift_form(detail):
    gift = detail["gift"]
    if gift["ethnies"]:
        return "%d ethnies" % len(gift["ethnies"]["rows"])
    if gift["single"] and gift["panels"]:
        return "don unique + tableau de %d lignes" % len(gift["panels"]["rows"])
    if gift["single"]:
        return "don unique"
    return "tableau de %d lignes" % len(gift["panels"]["rows"])


def print_detail_report(world):
    """Rapport du détail : onglets non publiés, couverture par race, cellules ignorées et non appariées, ethnies, vérification
    croisée des magies, écarts avec la fiche."""
    races, details, coverage = world["races"], world["details"], world["coverage"]
    print("Détail des races (l'onglet de la race prime sur la fiche V15.2.2) : %d onglets de race lus" % len(details))
    for tab, reason, note in world["unpublished"]:
        print("  onglet « %s » non publié : %s [%s]" % (tab, reason, note))
    print("Couverture des cellules (cellules non vides de l'onglet -> page de la race) :")
    grand = [0, 0, 0, 0]
    ignored_by_reason = {}
    unmatched = []
    for name, _ in races:
        key = normalize(name)
        total, ok, ignored, missing = coverage[key]
        for k, v in enumerate((total, ok, len(ignored), len(missing))):
            grand[k] += v
        for ref, value, why in ignored:
            ignored_by_reason.setdefault(why, []).append((world["tabs"][key], ref, value))
        unmatched += [(world["tabs"][key], ref, value, why) for ref, value, why in missing]
        print("  %-14s onglet « %s » : %3d cellules, %3d appariées, %d ignorées, %d non appariées ; dons raciaux : %s" % (
            name, world["tabs"][key], total, ok, len(ignored), len(missing), gift_form(details[key])))
    print("  TOTAL : %d cellules, %d appariées, %d ignorées (déclarées), %d non appariées" % tuple(grand))
    print("Cellules ignorées, avec leur raison :")
    for why, cells in sorted(ignored_by_reason.items(), key=lambda kv: -len(kv[1])):
        where = "; ".join("%s %s %r" % cell for cell in cells) if len(cells) <= 3 else "%d onglets (%s…)" % (
            len(cells), "; ".join("%s %s" % (t, r) for t, r, _ in cells[:2]))
        print("  %d x %s : %s" % (len(cells), why, where))
    print("Cellules non appariées : %s" % ("aucune" if not unmatched else ""))
    for tab, ref, value, why in unmatched:
        print("  %s %s %r : %s" % (tab, ref, value[:60], why))
    pairs = sum(1 for key in details for _, f in world["matched"][key][0] if f is not None)
    none = [(details[k]["race"], e["key"]) for k in details for e, f in world["matched"][k][0] if f is None]
    print("Ethnies : %d rapprochées d'une sous-race de la fiche (table ETHNIE_FICHE vérifiée), %d sans équivalent%s" % (
        pairs, len(none), " (" + ", ".join("%s : %s" % x for x in none) + ")" if none else ""))
    cited = [k for k, v in world["cross"].items() if "identiques" in v]
    other = [(details[k]["race"], v) for k, v in world["cross"].items() if "identiques" not in v and "magie" in v]
    print("Vérification croisée des magies (liste citée par « Inconvénient(s) » = magies_innees de la page) : %d race(s) "
          "concordent (%s) ; écart : aucun" % (len(cited), ", ".join(details[k]["race"] for k in cited)))
    connectors = {}
    for k in cited:
        connectors.setdefault(world["cross"][k].rsplit(" : ", 1)[1].rstrip(")"), []).append(details[k]["race"])
    print("  connecteurs de la liste dans l'onglet (information, non interprétés) : %s" % " ; ".join(
        "%s : %s" % (c, ", ".join(rs)) for c, rs in sorted(connectors.items())))
    for race, note in other:
        print("  %s : %s" % (race, note))
    print("Écarts avec la fiche de personnage V15.2.2 (section « %s ») :" % SEC_GAPS)
    kinds = {}
    for name, _ in races:
        gaps = world["gap_lists"][normalize(name)]
        labels = [g[0].split("\n")[0] for g in gaps]
        for g in labels:
            kind = re.sub(r" « .*", "", g)
            kinds[kind] = kinds.get(kind, 0) + 1
        print("  %-14s %2d : %s" % (name, len(gaps), "; ".join(labels) if gaps else "aucun"))
    print("  par type : %s" % ", ".join("%s %d" % kv for kv in sorted(kinds.items())))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Génère les pages « races » du wiki depuis les dumps JSON des classeurs.")
    ap.add_argument("--dump", action="append", required=True,
                    help="dump JSON (index des races, fiche personnage, classeur « Les races » lu onglet par onglet)")
    ap.add_argument("--out", required=True, help="dossier racine du wiki (client/src/content/wiki)")
    ap.add_argument("--verifier", action="store_true",
                    help="n'écrit rien : recalcule %s depuis les dumps (matrice + exceptions de RACE_DETAIL_OVERRIDES), relit "
                         "les onglets, refait les contrôles (couverture, magies, ethnies, écarts) et compare aux pages "
                         "existantes" % MAGIC_FIELD)
    args = ap.parse_args(argv)
    if args.verifier:
        run_verifier(args.dump, args.out)
        return

    try:
        world = build_world(args.dump)
    except ValueError as exc:
        raise SystemExit("Arrêt, rien n'a été écrit : %s" % exc)
    if world["problems"]:
        raise SystemExit("Arrêt, rien n'a été écrit : %d problème(s)\n  " % len(world["problems"])
                         + "\n  ".join(world["problems"][:30]))
    world["paths"] = list(args.dump)
    pages = [(name, slug, text) for name, slug, text, _ in world["pages"]]
    overrides, final_ok, magic_ok, magic_names = world["overrides"], world["final_ok"], world["magic_ok"], world["magic_names"]

    # Contrôles avant toute écriture : fichiers existants et unicité des titres.
    out_dir = os.path.join(args.out, CATEGORY)
    targets = {os.path.abspath(os.path.join(out_dir, s + ".md")) for s in [s for _, s, _ in pages]}
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
                name, len(magic_ok[key]), world["tabs"][key], INDEX_TITLE, len(final_ok[key])))
    spread = {}
    for _, key, _ in pages:
        spread.setdefault(len(final_ok[key]), []).append(key)
    print("%s : %s sur %d magies" % (MAGIC_FIELD, ", ".join(
        "%d race(s) à %d" % (len(keys), n) for n, keys in sorted(spread.items(), reverse=True)), len(magic_names)))
    print_detail_report(world)
    problems = check_pages(args.dump, args.out, world)
    if problems:
        raise SystemExit("Vérification après écriture : %d écart(s)\n  " % len(problems) + "\n  ".join(problems[:30]))


if __name__ == "__main__":
    main()
