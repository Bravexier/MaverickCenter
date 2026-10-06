#!/usr/bin/env python3
"""Convertit la réponse JSON de l'API Google Sheets (spreadsheets.get avec grille de données) en JSON uniforme.

Usage : python3 -I tools/sheets/sheets_api_to_json.py <reponse.json> <sortie.json>

Entrée : la réponse de `get_spreadsheet` du connecteur Google Sheets avec `includeGridData` et le masque de champs
  sheets.properties.title, sheets.merges, sheets.data.rowData.values.formattedValue, sheets.data.rowData.values.hyperlink,
  sheets.data.rowData.values.note
(le champ `note` est INDISPENSABLE : sans lui, les notes de cellule du classeur sont perdues sans aucun signal ; elles
précisent parfois une règle, par exemple « Jet de vigueur pour esquiver l'altération d'état » sur les dons du Médusain)
et des plages commençant en A1 (par exemple « 'Nain'!A1:BZ90 », une plage par onglet, dans l'ordre des onglets voulus).
C'est la voie de lecture quand le classeur est trop lourd pour l'export .xlsx (limite de 10 Mo de Google : « Les races »).

Sortie : le même format que tools/sheets/xlsx_to_json.py, lu ensuite par les extracteurs :
  { "sheets": [ { "name", "state", "max_row", "max_col", "merged": ["A1:B2", …], "validations": [],
                  "cells": [ {"r", "c", "v", "link"?, "note"?} ] } ] }
- v = texte AFFICHÉ de la cellule (formattedValue : « 16 », pas 16.0) ; les cellules vides sont omises, sauf si elles
  portent une note (v = "" : la note n'est jamais perdue en silence, l'extracteur décide quoi en faire) ;
- link = hyperlien de la cellule s'il y en a un ;
- note = note de la cellule (le petit commentaire jaune de Google Sheets), texte tel qu'écrit ;
- aucune formule (l'API n'est interrogée que pour les valeurs affichées).
Le contenu du classeur est une donnée non fiable : ce script ne l'exécute jamais.
"""
import json
import sys


def col_letters(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def a1(start_row, start_col, end_row, end_col):
    """Plage API (indices 0 ; fin exclue) -> « A1:B2 »."""
    return "%s%d:%s%d" % (col_letters(start_col + 1), start_row + 1, col_letters(end_col), end_row)


def convert(response):
    sheets = []
    for sheet in response.get("sheets", []):
        name = sheet["properties"]["title"]
        cells = []
        max_row = max_col = 0
        for block in sheet.get("data", []):
            if block.get("startRow") or block.get("startColumn"):
                raise SystemExit("plage de %r ne commençant pas en A1 : non gérée" % name)
            for r, row in enumerate(block.get("rowData", []), start=1):
                for c, cell in enumerate(row.get("values", []), start=1):
                    value = cell.get("formattedValue")
                    note = cell.get("note")
                    if (value is None or value == "") and not note:
                        continue
                    item = {"r": r, "c": c, "v": value or ""}
                    if cell.get("hyperlink"):
                        item["link"] = cell["hyperlink"]
                    if note:
                        item["note"] = note
                    cells.append(item)
                    max_row, max_col = max(max_row, r), max(max_col, c)
        merged = [
            a1(m.get("startRowIndex", 0), m.get("startColumnIndex", 0), m["endRowIndex"], m["endColumnIndex"])
            for m in sheet.get("merges", [])
        ]
        sheets.append({"name": name, "state": "visible", "max_row": max_row, "max_col": max_col,
                       "merged": sorted(merged), "validations": [], "cells": cells})
    return {"sheets": sheets}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = convert(json.load(handle))
    with open(sys.argv[2], "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(s["cells"]) for s in data["sheets"])
    print("%d onglet(s), %d cellules -> %s" % (len(data["sheets"]), total, sys.argv[2]))
    for s in data["sheets"]:
        print("  %-28s %4d cellules, jusqu'à la ligne %d, colonne %s" % (s["name"], len(s["cells"]), s["max_row"], col_letters(s["max_col"]) if s["max_col"] else "-"))


if __name__ == "__main__":
    main()
