#!/usr/bin/env python3
"""Fabrique à la main (zipfile, bibliothèque standard : ni openpyxl ni Excel) un mini classeur .xlsx qui porte des notes
et des fils de commentaires de cellule, à la manière de l'export Google Sheets. Sert à client/test/xlsx-to-json.test.mjs.

Usage : python3 -I make-xlsx-notes.py <sortie.xlsx> [variante]
  standard       : trois onglets ; notes sur cellule pleine, vide, fusionnée non principale ; fils ; texte riche ; formule
  dtd            : la partie des notes déclare une DTD (refusée : le classeur est une donnée non fiable)
  ombre-orpheline: un commentaire « [Threaded comment] » dont le fil n'existe pas dans xl/threadedComments
  ref-invalide   : une note adressée à une cellule qui n'est pas une adresse A1
  doublon-note   : deux notes sur la même cellule
  sans-commentaires : les mêmes cellules, aucun commentaire (référence pour comparer les dumps)

Structure reproduite de l'export Google : une note est un commentaire hérité (xl/comments*.xml, auteur vide) ; un fil de
commentaires est écrit deux fois, comme fil (xl/threadedComments, avec ses réponses) et comme commentaire hérité « ombre »
dont l'auteur est « tc={identifiant du fil} » et dont le texte est le gabarit « [Threaded comment] … » d'Excel.
"""
import sys
import zipfile
from xml.sax.saxutils import escape

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_TC = "http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
SHADOW = ("[Threaded comment]\nYour version of Excel allows you to read this threaded comment; however, any edits to it "
          "will get removed if the file is opened in a newer version of Excel. Learn more: "
          "https://go.microsoft.com/fwlink/?linkid=870924\n\nComment:\n    %s")


def rel(rid, kind, target, ns="http://schemas.openxmlformats.org/officeDocument/2006/relationships"):
    return '<Relationship Id="%s" Type="%s/%s" Target="%s"/>' % (rid, ns, kind, target)


def rels(*items):
    return HEAD + '<Relationships xmlns="%s">%s</Relationships>' % (NS_PKG, "".join(items))


def cell(ref, value=None, formula=None):
    if formula is not None:
        return '<c r="%s"><f>%s</f><v>%s</v></c>' % (ref, escape(formula), value)
    if isinstance(value, (int, float)):
        return '<c r="%s"><v>%s</v></c>' % (ref, value)
    if value is None:
        return '<c r="%s"/>' % ref
    return '<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>' % (ref, escape(value))


def sheet_xml(rows, merges=(), legacy=False):
    body = "".join('<row r="%d">%s</row>' % (r, "".join(cells)) for r, cells in rows)
    merge = ('<mergeCells count="%d">%s</mergeCells>' % (len(merges), "".join('<mergeCell ref="%s"/>' % m for m in merges))) if merges else ""
    leg = '<legacyDrawing r:id="rId2"/>' if legacy else ""
    return HEAD + '<worksheet xmlns="%s" xmlns:r="%s"><sheetData>%s</sheetData>%s%s</worksheet>' % (NS_MAIN, NS_R, body, merge, leg)


def comments_xml(authors, items):
    """items : (ref, index d'auteur, contenu XML de <text>)."""
    a = "".join("<author>%s</author>" % escape(x) for x in authors)
    c = "".join('<comment authorId="%d" ref="%s"><text>%s</text></comment>' % (i, ref, text) for ref, i, text in items)
    return HEAD + '<comments xmlns="%s"><authors>%s</authors><commentList>%s</commentList></comments>' % (NS_MAIN, a, c)


def plain(text):
    return '<t xml:space="preserve">%s</t>' % escape(text)


def threads_xml(items):
    """items : (id, ref, texte, résolu, id du parent)."""
    out = []
    for tid, ref, text, done, parent in items:
        attrs = 'ref="%s" dT="2026-01-01T00:00:00.00" personId="{P}" id="%s"' % (ref, tid)
        if parent:
            attrs += ' parentId="%s"' % parent
        if done is not None:
            attrs += ' done="%d"' % done
        out.append("<threadedComment %s><text>%s</text></threadedComment>" % (attrs, escape(text)))
    return HEAD + '<ThreadedComments xmlns="%s">%s</ThreadedComments>' % (NS_TC, "".join(out))


VML = (HEAD + '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:x="urn:schemas-microsoft-com:office:excel">'
       '<v:shape id="_x0000_s1025" type="#_x0000_t202"><x:ClientData ObjectType="Note"><x:Row>2</x:Row><x:Column>0</x:Column>'
       '</x:ClientData></v:shape></xml>')

NOTE_DON = "Jet de vigueur pour esquiver l'altération d'état"
NOTE_MULTI = "Première ligne\nDeuxième ligne & <b> « accents » é\n  indentée "
T1, T2, T3, T4, T5 = ("{00000000-0000-0000-0000-00000000000%d}" % i for i in range(1, 6))


def build(path, variant="standard"):
    # ---- onglet 1 « Règles »
    rows1 = [
        (1, [cell("A1", "Titre"), cell("E1", "Bloc")]),
        (2, [cell("B2", 16), cell("E2"), cell("F2")]),
        (3, [cell("A3", "Don"), cell("B3", 17, "B2+1")]),
        (5, [cell("D5", "Sort")]),
    ]
    merges1 = ["E1:F2"]
    notes1 = [
        ("A3", 0, plain(NOTE_DON)),
        ("C4", 0, plain("Note sur une cellule vide")),
        ("D5", 0, plain(NOTE_MULTI)),
        ("B3", 0, "<r><rPr><b/></rPr>" + plain("Gras") + "</r><r>" + plain(" puis normal") + "</r>"),
        ("F2", 0, plain("Note sur cellule fusionnée")),
    ]
    threads1 = [
        (T1, "D5", "Un fil résolu", 1, None),
        (T2, "D5", "Marquée comme fermée", None, T1),
        (T3, "G7", "Premier fil", 0, None),
        (T4, "G7", "Second fil", 0, None),
        (T5, "E2", "Fil sur cellule fusionnée", 0, None),
    ]
    authors1 = [""] + ["tc=" + t[0] for t in threads1 if not t[4]]
    shadows1 = [(t[1], i + 1, plain(SHADOW % t[2])) for i, t in enumerate([t for t in threads1 if not t[4]])]
    if variant == "dtd":
        notes1 = [("A3", 0, plain("x"))]
    if variant == "ombre-orpheline":
        threads1 = []
        authors1 = ["", "tc=" + T1]
        shadows1 = [("G7", 1, plain(SHADOW % "fil absent"))]
    if variant == "ref-invalide":
        notes1 = [("ZZZ", 0, plain("mauvaise adresse"))]
        shadows1 = []
        threads1 = []
        authors1 = [""]
    if variant == "doublon-note":
        notes1 = [("A3", 0, plain("première")), ("A3", 0, plain("seconde"))]
        shadows1 = []
        threads1 = []
        authors1 = [""]
    comments1 = comments_xml(authors1, notes1 + shadows1)
    if variant == "dtd":
        comments1 = comments1.replace("<comments ", '<!DOCTYPE comments [<!ENTITY a "aaaa">]><comments ', 1)
    # ---- onglet 2 « Autre onglet » : note d'auteur nommé (style Excel : le texte garde le préfixe « Jean: »)
    rows2 = [(1, [cell("A1", "x"), cell("B1", "y")])]
    comments2 = comments_xml(["Jean"], [("B1", 0, "<r><rPr><b/></rPr>" + plain("Jean:") + "</r><r>" + plain("\nNote de l'autre onglet") + "</r>")])
    # ---- onglet 3 « Sans note »
    rows3 = [(1, [cell("A1", "seul")])]

    avec = variant != "sans-commentaires"
    parts = {
        "[Content_Types].xml": HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + "".join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' % i for i in (1, 2, 3))
            + ("".join('<Override PartName="/xl/comments%d.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>' % i for i in (1, 2))
               + '<Override PartName="/xl/threadedComments/threadedComment1.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/>' if avec else "")
            + '</Types>',
        "_rels/.rels": rels(rel("rId1", "officeDocument", "xl/workbook.xml")),
        "xl/workbook.xml": HEAD + '<workbook xmlns="%s" xmlns:r="%s"><sheets>'
            '<sheet name="Règles" sheetId="1" r:id="rId1"/><sheet name="Autre onglet" sheetId="2" r:id="rId2"/>'
            '<sheet name="Sans note" sheetId="3" r:id="rId3"/></sheets></workbook>' % (NS_MAIN, NS_R),
        "xl/_rels/workbook.xml.rels": rels(rel("rId1", "worksheet", "worksheets/sheet1.xml"),
                                            rel("rId2", "worksheet", "worksheets/sheet2.xml"),
                                            # chemin absolu dans le paquet, comme le permet la norme
                                            rel("rId3", "worksheet", "/xl/worksheets/sheet3.xml")),
        "xl/worksheets/sheet1.xml": sheet_xml(rows1, merges1, legacy=avec),
        "xl/worksheets/sheet2.xml": sheet_xml(rows2, legacy=False),
        "xl/worksheets/sheet3.xml": sheet_xml(rows3),
    }
    if avec:
        parts["xl/worksheets/_rels/sheet1.xml.rels"] = rels(
            rel("rId1", "comments", "../comments1.xml"),
            rel("rId2", "vmlDrawing", "../drawings/vmlDrawing1.vml"),
            *([rel("rId3", "threadedComment", "../threadedComments/threadedComment1.xml", "http://schemas.microsoft.com/office/2017/10/relationships")]
              if threads1 else []))
        parts["xl/comments1.xml"] = comments1
        parts["xl/drawings/vmlDrawing1.vml"] = VML
        parts["xl/worksheets/_rels/sheet2.xml.rels"] = rels(rel("rId1", "comments", "../comments2.xml"))
        parts["xl/comments2.xml"] = comments2
    if avec and threads1:
        parts["xl/threadedComments/threadedComment1.xml"] = threads_xml(threads1)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(name, data)


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    build(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else "standard")
