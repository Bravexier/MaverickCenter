#!/usr/bin/env python3
"""Convertit un classeur .xlsx (ou un .csv) en JSON uniforme, lu ensuite par les extracteurs de tools/sheets/.

Usage : python3 -I tools/sheets/xlsx_to_json.py <classeur.xlsx|.csv> <sortie.json>
Dépendance : openpyxl (pour les .xlsx seulement) ; le .csv n'a pas de dépendance.

Format : { "sheets": [ { "name", "state", "max_row", "max_col", "merged": ["A1:B2", …],
           "validations": [ {"range", "type", "formula1"} ], "cells": [ {"r", "c", "v", "f"} ] } ] }
- seules les cellules non vides sont gardées ; r/c = ligne/colonne à partir de 1 ;
- v = valeur en cache (nombres conservés ; dates en ISO 8601), f = formule si la cellule en a une ;
- une plage fusionnée ne porte sa valeur que dans sa cellule en haut à gauche (voir « merged »).
Le contenu du classeur est une donnée non fiable : ce script ne l'exécute jamais.
"""
import csv
import datetime
import json
import sys


def clean(value):
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    return value


def from_xlsx(path):
    import openpyxl  # importé ici : inutile pour un .csv

    values = openpyxl.load_workbook(path, data_only=True)
    formulas = openpyxl.load_workbook(path, data_only=False)
    sheets = []
    for ws in values.worksheets:
        wf = formulas[ws.title]
        cells = []
        for row in ws.iter_rows():
            for cell in row:
                formula = wf[cell.coordinate].value
                is_formula = isinstance(formula, str) and formula.startswith("=")
                if cell.value is None and not is_formula:
                    continue
                item = {"r": cell.row, "c": cell.column, "v": clean(cell.value)}
                if is_formula:
                    item["f"] = formula
                cells.append(item)
        validations = []
        for dv in ws.data_validations.dataValidation:
            validations.append({"range": str(dv.sqref), "type": dv.type, "formula1": dv.formula1})
        sheets.append({
            "name": ws.title,
            "state": ws.sheet_state,
            "max_row": ws.max_row,
            "max_col": ws.max_column,
            "merged": [str(r) for r in ws.merged_cells.ranges],
            "validations": validations,
            "cells": cells,
        })
    return {"sheets": sheets}


def from_csv(path):
    cells = []
    max_col = 0
    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row, start=1):
            if value != "":
                cells.append({"r": r, "c": c, "v": value})
                max_col = max(max_col, c)
    sheet = {"name": "Feuille 1", "state": "visible", "max_row": len(rows), "max_col": max_col,
             "merged": [], "validations": [], "cells": cells}
    return {"sheets": [sheet]}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, target = sys.argv[1], sys.argv[2]
    data = from_csv(source) if source.lower().endswith(".csv") else from_xlsx(source)
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(s["cells"]) for s in data["sheets"])
    print(f"{len(data['sheets'])} onglet(s), {total} cellules -> {target}")


if __name__ == "__main__":
    main()
