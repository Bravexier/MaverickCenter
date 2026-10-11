#!/usr/bin/env python3
"""Couche de corrections orthographiques des dumps de classeurs Google.

Les classeurs sources contiennent des coquilles et des fautes d'orthographe (« Chasseur prime » pour
« Chasseur de primes »). Le propriétaire du projet demande de les corriger. Elles ne sont jamais corrigées « à la main » dans les pages
générées (la prochaine importation les écraserait) mais dans le registre versionné `tools/sheets/corrections.json` : une ligne par
correction, adressée à une cellule, qui dit ce qui change et pourquoi. Cet outil applique le registre à un dump AVANT les extracteurs
(`classes.py`, `races.py`, `magies.py`…), qui lisent donc le texte corrigé ; leurs vérificateurs comparent les pages à ce même dump.

Usage :
    python3 -I tools/sheets/corriger-dump.py appliquer --ledger tools/sheets/corrections.json --dump <classes-v7.json> --out <classes-v7.corrige.json> [--id classes-v7]
    python3 -I tools/sheets/corriger-dump.py verifier-registre --ledger tools/sheets/corrections.json

`--id` désigne la section du registre ; par défaut le nom du fichier sans `.json` (classes-v7, magie-v8, les-races, les-races-annexes,
fiche-auto-v15, ressources-craft, invocation, mode-hyper, races-index). Un dump sans section est recopié tel quel.

Format du registre :
    {"version": 1, "dumps": {"classes-v7": {"classeur": "Classe Maverick V7", "corrections": [
        {"onglet": "Mercenaire", "cellule": "AC22", "avant": "Chasseur prime", "apres": "Chasseur de primes",
         "nature": "grammaire", "note": "la bannière du même onglet dit « CHASSEUR DE PRIMES »",
         "champ": "v" (défaut) | "note", "occurrences": 1 (défaut)}]}}}

Garde-fous (une correction n'est jamais une règle) — l'outil s'arrête avec la liste de toutes les erreurs :
  - la cellule existe et le texte « avant » y figure exactement `occurrences` fois ; sinon la correction est périmée (la source a changé),
    ou redondante (la source est déjà corrigée : retirer la ligne) ;
  - les chiffres, les signes (+ − × % < > =, « -3 »), les dés (« 2d6 ») sont identiques avant et après (une espace de plus ou de moins ne compte pas) ;
  - le texte reste proche de l'original : similarité d'au moins 70 % hors accents et casse (une correction n'est pas une reformulation) ;
    pour un mot court, écrire aussi son voisin (« ce soit » → « se soit ») ;
  - `nature` dans une liste fermée, `note` non vide, pas de doublon.
Ce qui changerait un chiffre ou le sens d'une règle n'a pas sa place ici : c'est une question pour le propriétaire du projet.
"""
import argparse
import difflib
import json
import os
import re
import sys
import unicodedata

NATURES = ("orthographe", "accent", "grammaire", "ponctuation", "casse", "espace", "frappe")
SIMILARITE_MIN = 0.7
A1 = re.compile(r"^([A-Z]{1,3})([1-9][0-9]*)$")
# Chiffres, dés, signes : tout ce qui pourrait changer une règle. Le tiret d'un mot (« va-t-en-guerre ») n'en est pas un ; « -3 » en est un.
JETONS = re.compile(r"\d+(?:[.,]\d+)?|[dD]\d+|[+−–×÷*/<>=%]|-(?=\d)")


def fold(texte):
    """Texte comparable : sans accents, en minuscules."""
    sans = "".join(c for c in unicodedata.normalize("NFD", texte) if not unicodedata.combining(c))
    return sans.casefold()


def signature(texte):
    return [t.replace(",", ".").lower().replace("–", "-").replace("−", "-") for t in JETONS.findall(texte)]


def a1_vers_rc(cellule):
    m = A1.match(cellule)
    if not m:
        return None
    col = 0
    for lettre in m.group(1):
        col = col * 26 + (ord(lettre) - 64)
    return int(m.group(2)), col


def controler_forme(c, ou):
    """Erreurs de forme et de garde-fous d'une correction (sans dump)."""
    erreurs = []
    for cle in ("onglet", "cellule", "avant", "apres", "nature", "note"):
        if not isinstance(c.get(cle), str) or not c[cle].strip():
            erreurs.append("%s : champ « %s » absent ou vide" % (ou, cle))
    if erreurs:
        return erreurs
    if a1_vers_rc(c["cellule"]) is None:
        erreurs.append("%s : cellule « %s » n'est pas une adresse A1 (ex. AC22)" % (ou, c["cellule"]))
    if c["nature"] not in NATURES:
        erreurs.append("%s : nature « %s » inconnue (attendu : %s)" % (ou, c["nature"], ", ".join(NATURES)))
    if c.get("champ", "v") not in ("v", "note"):
        erreurs.append("%s : champ « %s » inconnu (v ou note)" % (ou, c.get("champ")))
    occ = c.get("occurrences", 1)
    if not isinstance(occ, int) or isinstance(occ, bool) or occ < 1:
        erreurs.append("%s : occurrences doit être un entier ≥ 1" % ou)
    if c["avant"] == c["apres"]:
        erreurs.append("%s : « avant » et « apres » sont identiques" % ou)
    if signature(c["avant"]) != signature(c["apres"]):
        erreurs.append("%s : la correction change un chiffre, un dé ou un signe (%s → %s) : ce serait modifier une règle, pas une faute"
                       % (ou, signature(c["avant"]), signature(c["apres"])))
    elif difflib.SequenceMatcher(None, fold(c["avant"]), fold(c["apres"])).ratio() < SIMILARITE_MIN:
        erreurs.append("%s : « %s » → « %s » est une reformulation (similarité < %d %% hors accents et casse), pas une correction"
                       % (ou, c["avant"], c["apres"], SIMILARITE_MIN * 100))
    return erreurs


def lire_registre(chemin):
    try:
        with open(chemin, encoding="utf-8") as f:
            registre = json.load(f)
    except (OSError, ValueError) as e:
        raise SystemExit("registre illisible (%s) : %s" % (chemin, e))
    if registre.get("version") != 1 or not isinstance(registre.get("dumps"), dict):
        raise SystemExit("registre : version 1 et objet « dumps » attendus")
    return registre


def controler_registre(registre):
    erreurs = []
    for ident, section in registre["dumps"].items():
        corrections = section.get("corrections")
        if not isinstance(section.get("classeur"), str) or not isinstance(corrections, list):
            erreurs.append("%s : « classeur » et liste « corrections » attendus" % ident)
            continue
        vus = set()
        for i, c in enumerate(corrections):
            ou = "%s[%d] %s!%s" % (ident, i, c.get("onglet"), c.get("cellule"))
            erreurs.extend(controler_forme(c, ou))
            cle = (c.get("onglet"), c.get("cellule"), c.get("champ", "v"), c.get("avant"))
            if cle in vus:
                erreurs.append("%s : doublon (même cellule, même texte « avant »)" % ou)
            vus.add(cle)
    return erreurs


def appliquer(registre, ident, dump):
    section = registre["dumps"].get(ident)
    if not section:
        return 0, []
    onglets = {}
    for feuille in dump["sheets"]:
        onglets.setdefault(feuille["name"], feuille)
    erreurs = controler_registre({"version": 1, "dumps": {ident: section}})
    appliquees = 0
    for i, c in enumerate(section["corrections"]):
        ou = "%s[%d] %s!%s" % (ident, i, c.get("onglet"), c.get("cellule"))
        if controler_forme(c, ou):
            continue  # déjà signalée par controler_registre
        feuille = onglets.get(c["onglet"])
        if feuille is None:
            erreurs.append("%s : onglet « %s » absent du dump" % (ou, c["onglet"]))
            continue
        r, col = a1_vers_rc(c["cellule"])
        cell = next((x for x in feuille["cells"] if x.get("r") == r and x.get("c") == col), None)
        champ = c.get("champ", "v")
        if cell is None or not isinstance(cell.get(champ), str):
            erreurs.append("%s : la cellule %s n'existe pas (ou n'a pas de « %s ») dans l'onglet « %s »" % (ou, c["cellule"], champ, c["onglet"]))
            continue
        texte = cell[champ]
        n = texte.count(c["avant"])
        attendu = c.get("occurrences", 1)
        if n == 0:
            if c["apres"] in texte:
                erreurs.append("%s : correction redondante : la source dit déjà « %s », retirer la ligne du registre" % (ou, c["apres"]))
            else:
                erreurs.append("%s : correction périmée : « %s » ne figure plus dans la cellule (« %s »)" % (ou, c["avant"], texte[:80]))
            continue
        if n != attendu:
            erreurs.append("%s : « %s » apparaît %d fois dans la cellule, le registre en attend %d (champ « occurrences »)" % (ou, c["avant"], n, attendu))
            continue
        cell[champ] = texte.replace(c["avant"], c["apres"])
        appliquees += 1
    return appliquees, erreurs


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="commande", required=True)
    a = sub.add_parser("appliquer", help="applique le registre à un dump")
    a.add_argument("--ledger", required=True, help="registre des corrections (tools/sheets/corrections.json)")
    a.add_argument("--dump", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--id", help="section du registre (défaut : nom du dump sans .json)")
    v = sub.add_parser("verifier-registre", help="contrôle la forme du registre et les garde-fous, sans dump")
    v.add_argument("--ledger", required=True)
    args = ap.parse_args()

    registre = lire_registre(args.ledger)
    if args.commande == "verifier-registre":
        erreurs = controler_registre(registre)
        if erreurs:
            raise SystemExit("registre : %d erreur(s)\n  " % len(erreurs) + "\n  ".join(erreurs[:40]))
        total = sum(len(s["corrections"]) for s in registre["dumps"].values())
        print("registre conforme : %d correction(s) dans %d dump(s)" % (total, len(registre["dumps"])))
        return

    ident = args.id or os.path.splitext(os.path.basename(args.dump))[0]
    with open(args.dump, encoding="utf-8") as f:
        dump = json.load(f)
    appliquees, erreurs = appliquer(registre, ident, dump)
    if erreurs:
        raise SystemExit("corriger-dump : %d erreur(s)\n  " % len(erreurs) + "\n  ".join(erreurs[:40]))
    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dump, f, ensure_ascii=False)
    os.replace(tmp, args.out)
    print("corriger-dump : %d correction(s) appliquée(s) à %s" % (appliquees, ident), file=sys.stderr)


if __name__ == "__main__":
    main()
