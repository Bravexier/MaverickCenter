#!/usr/bin/env python3
"""Lit les notes et les fils de commentaires de cellule d'un classeur .xlsx, directement dans son XML.

Usage : python3 -I tools/sheets/xlsx_comments.py <classeur.xlsx>      (écrit un JSON sur la sortie standard)
Bibliothèque standard uniquement (zipfile + xml.etree) : ni openpyxl ni Excel. C'est ce qui permet de le tester en CI.
Appelé par tools/sheets/xlsx_to_json.py, qui en tire les champs `note` et `threads` du dump.

Pourquoi ne pas laisser openpyxl s'en charger (cell.comment) : il ne garde qu'UN commentaire par cellule (une note et un fil
de commentaires sur la même cellule, ou deux fils : un seul survit) ; il supprime, avec un simple avertissement, ceux des
cellules fusionnées autres que la cellule en haut à gauche ; et il ne lit pas les fils (xl/threadedComments).

Ce que le classeur contient (export Google Sheets, qui suit la convention d'Excel) :
  * une NOTE (le petit commentaire jaune) est un commentaire hérité : xl/comments<N>.xml, <comment ref="A1"> avec un auteur
    vide. Le texte est gardé tel que le classeur l'écrit (retours à la ligne, espaces de début et de fin compris) ; les
    segments d'un texte riche sont concaténés ; un éventuel préfixe d'auteur écrit DANS le texte (« Jean: ») est conservé :
    Google n'en met pas, et un texte qu'on ne peut pas attribuer avec certitude à un préfixe ne se retouche pas ;
  * un FIL DE COMMENTAIRES (la conversation, avec réponses et état « résolu ») est écrit deux fois : dans
    xl/threadedComments/threadedComment<N>.xml (le contenu : texte, réponses, attribut done) et comme commentaire hérité
    « ombre » dont l'auteur est « tc={identifiant du fil} » et dont le texte est le gabarit « [Threaded comment] … » d'Excel.
    L'ombre est un doublon technique : elle n'est pas une note. Une ombre dont le fil n'existe pas est, elle, gardée comme
    note (rien n'est perdu), avec un avertissement.
  * les relations de l'onglet (xl/worksheets/_rels/sheet<N>.xml.rels) disent quelles parties lui appartiennent ; le dessin
    VML (xl/drawings/vmlDrawing<N>.vml) ne sert qu'à dessiner la bulle : l'adresse de la cellule vient de `ref`.
Les noms et les dates des auteurs ne sont pas lus (ce ne sont pas des règles).

Résultat de read_comments() : { nom d'onglet : {"notes": {ref: texte}, "threads": {ref: [fil, …]}} }, dans l'ordre du classeur,
avec fil = {"text", "done": True (seulement si résolu), "replies": [texte, …] (seulement s'il y en a)}.
Les adresses sont celles du classeur (« F2 » reste « F2 » même si la cellule est fusionnée avec E1 : à l'extracteur de décider).
Le contenu du classeur est une donnée non fiable : DTD refusée, taille des parties bornée, rien n'est exécuté.
"""
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_TC = "http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"
MAX_MEMBER = 8 * 1024 * 1024
SHADOW_AUTHOR = "tc="
SHADOW_TEXT = "[Threaded comment]"


def warn(message):
    print("AVERTISSEMENT : " + message, file=sys.stderr)


def _xml(zf, name):
    try:
        info = zf.getinfo(name)
    except KeyError:
        raise ValueError("partie absente du classeur : %s" % name)
    if info.file_size > MAX_MEMBER:
        raise ValueError("entrée .xlsx trop grande : %s" % name)
    data = zf.read(name)
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        raise ValueError("XML avec DTD refusé : %s" % name)
    return ET.fromstring(data)


def _resolve(folder, target):
    """Cible d'une relation -> nom de partie dans le zip (chemin relatif au dossier de la source, ou absolu dans le paquet)."""
    if target.startswith("/"):
        return posixpath.normpath(target.lstrip("/"))
    return posixpath.normpath(posixpath.join(folder, target))


def split_ref(ref):
    """« QA6 » -> (6, 417) : (ligne, colonne) à partir de 1."""
    m = re.fullmatch(r"([A-Z]{1,3})([1-9][0-9]*)", ref or "")
    if not m:
        raise ValueError("adresse de cellule invalide : %r" % (ref,))
    col = 0
    for ch in m.group(1):
        col = col * 26 + ord(ch) - 64
    return int(m.group(2)), col


def _note_text(comment):
    """Texte d'une note : segments <t> directs ou de texte riche <r>, sans les annotations phonétiques <rPh>."""
    text = comment.find("{%s}text" % NS_MAIN)
    parts = []
    if text is not None:
        for child in text:
            if child.tag == "{%s}t" % NS_MAIN:
                parts.append(child.text or "")
            elif child.tag == "{%s}r" % NS_MAIN:
                parts.extend(t.text or "" for t in child if t.tag == "{%s}t" % NS_MAIN)
    return "".join(parts)


def _threads(zf, part, sheet):
    """-> ({ref: [fil, …]}, {identifiants de tous les commentaires du fichier}) pour une partie xl/threadedComments."""
    root = _xml(zf, part)
    elements = [e for e in root if e.tag == "{%s}threadedComment" % NS_TC]
    by_id = {e.get("id"): e for e in elements}

    def text_of(e):
        t = e.find("{%s}text" % NS_TC)
        return "".join(t.itertext()) if t is not None else ""

    def top_of(e):
        """Le commentaire de tête du fil d'une réponse (None si les parents bouclent)."""
        seen = set()
        while e.get("parentId") in by_id:
            if e.get("id") in seen:
                return None
            seen.add(e.get("id"))
            e = by_id[e.get("parentId")]
        return e

    tops = {}  # identifiant du commentaire de tête -> (ref, fil)
    for e in elements:
        if e.get("parentId") in by_id:
            continue
        if e.get("parentId"):
            warn("onglet %r, %s : réponse dont le fil parent est absent, gardée comme fil à part" % (sheet, e.get("ref")))
        thread = {"text": text_of(e)}
        if e.get("done") == "1":
            thread["done"] = True
        tops[e.get("id")] = (e.get("ref"), thread)
    for e in elements:
        if e.get("parentId") in by_id:
            top = top_of(e)
            if top is None:
                raise ValueError("onglet %r, %s : réponses en boucle dans un fil de commentaires" % (sheet, e.get("ref")))
            tops[top.get("id")][1].setdefault("replies", []).append(text_of(e))
    result = {}
    for ref, thread in tops.values():
        split_ref(ref)
        result.setdefault(ref, []).append(thread)
    return result, set(by_id)


def read_comments(xlsx_path):
    """{onglet: {"notes": {ref: texte}, "threads": {ref: [fil, …]}}} lus dans le .xlsx, dans l'ordre des onglets."""
    result = {}
    with zipfile.ZipFile(xlsx_path) as zf:
        workbook = _xml(zf, "xl/workbook.xml")
        rels = {r.get("Id"): r.get("Target") for r in _xml(zf, "xl/_rels/workbook.xml.rels")}
        names = set(zf.namelist())
        for sheet in workbook.find("{%s}sheets" % NS_MAIN):
            name = sheet.get("name")
            path = _resolve("xl", rels[sheet.get("{%s}id" % NS_REL)])
            folder = posixpath.dirname(path)
            rel_path = posixpath.join(folder, "_rels", posixpath.basename(path) + ".rels")
            comment_parts, thread_parts = [], []
            if rel_path in names:
                for rel in _xml(zf, rel_path):
                    kind = rel.get("Type").rsplit("/", 1)[-1]
                    if kind == "comments":
                        comment_parts.append(_resolve(folder, rel.get("Target")))
                    elif kind == "threadedComment":
                        thread_parts.append(_resolve(folder, rel.get("Target")))
            threads, thread_ids = {}, set()
            for part in thread_parts:
                found, ids = _threads(zf, part, name)
                for ref, items in found.items():
                    threads.setdefault(ref, []).extend(items)
                thread_ids |= ids
            notes = {}
            for part in comment_parts:
                root = _xml(zf, part)
                authors = [(a.text or "") for a in root.find("{%s}authors" % NS_MAIN)]
                for comment in root.find("{%s}commentList" % NS_MAIN):
                    ref = comment.get("ref")
                    split_ref(ref)
                    author = authors[int(comment.get("authorId"))]
                    if author.startswith(SHADOW_AUTHOR) and author[len(SHADOW_AUTHOR):] in thread_ids:
                        continue  # ombre technique d'un fil, lu dans xl/threadedComments
                    text = _note_text(comment)
                    if text.startswith(SHADOW_TEXT):
                        warn("onglet %r, %s : commentaire « %s » sans fil correspondant dans xl/threadedComments, gardé comme note"
                             % (name, ref, SHADOW_TEXT))
                    if ref in notes:
                        raise ValueError("onglet %r : deux notes sur la cellule %s" % (name, ref))
                    notes[ref] = text
            result[name] = {"notes": notes, "threads": threads}
    return result


def _sorted(items):
    return sorted(items, key=lambda ref: split_ref(ref))


def as_json(comments):
    """Forme du résultat de la ligne de commande : une entrée par onglet, cellules triées par ligne puis colonne."""
    sheets = []
    for name, data in comments.items():
        notes = [{"ref": ref, "text": data["notes"][ref]} for ref in _sorted(data["notes"])]
        threads = [dict({"ref": ref}, **thread) for ref in _sorted(data["threads"]) for thread in data["threads"][ref]]
        sheets.append({"name": name, "notes": notes, "threads": threads})
    return {"sheets": sheets}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        comments = read_comments(sys.argv[1])
    except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as err:
        sys.exit("%s : %s" % (sys.argv[1], err))
    json.dump(as_json(comments), sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
