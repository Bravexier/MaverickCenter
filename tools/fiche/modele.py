#!/usr/bin/env python3
"""Modèle de la fiche de personnage en tableur : le classeur « Fiche-de-personnage-Maverick-V15.2.2 ordinateur » rangé en texte dans le dépôt.

Usage (LibreOffice et Pillow requis ; relançable, mêmes fichiers à l'identique pour un même .ods) :

    python3 -I tools/fiche/modele.py <Fiche-de-personnage-Maverick-V15.2.2_ordinateur.ods> [--out client/src/modeles/fiche-personnage]

Source : le modèle vide que le propriétaire a donné le 2026-10-15 (Google Sheets « Fiche-de-personnage-Maverick-V15.2.2 ordinateur »,
`18ltusGgVzAj6jZaq55f4SW5YkZ50KbdqT-TAzygZ6co`, un seul onglet « Personnage », et son téléchargement .ods). La page /fiche/ exporte une fiche
dans ce modèle et en réimporte une (client/src/lib/fiche-tableur.mjs ; docs/character-generator.md, « Tableur »).

Ce que fait le script, rien d'autre :
  1. LibreOffice convertit le .ods en .xlsx (le format que la page écrit : Excel, Google Sheets et LibreOffice l'ouvrent) ;
  2. le logo (PNG 3021 × 3038, 3,7 Mo, ancré en A1:E5) est réduit à 320 px de haut (Pillow), le portrait de la fiche le remplace à l'export ;
  3. les formules (les 30 « Total » des compétences, K22:K36 et X22:X36) sont retirées : le fichier exporté ne porte que des résultats
     (demande du propriétaire : « Inutile de mettre les formules dans le fichier généré, seul le résultat ») ;
  4. les cellules vides hors de la fiche (au-delà de la colonne BZ ou de la ligne 75 : reliquats sans texte) sont retirées, la case active
     ramenée en A1, les propriétés du document vidées de leur historique.
Les parties sont écrites telles quelles, en texte (XML) sauf l'image : aucun .xlsx dans le dépôt ; le site les assemble au build
(client/src/pages/fiche/modele.xlsx.ts).
"""
import argparse
import io
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SORTIE = os.path.join(RACINE, 'client', 'src', 'modeles', 'fiche-personnage')
DERNIERE_COLONNE = 78   # BZ : la fiche s'arrête en BY (Résistances, Postures, Mode Hyper, Note)
DERNIERE_LIGNE = 75     # la fiche s'arrête en ligne 74 (Événements, sorts, note)
HAUTEUR_LOGO = 320


def numero_de_colonne(lettres):
    n = 0
    for c in lettres:
        n = n * 26 + ord(c) - 64
    return n


def convertir(ods, dossier):
    r = subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx', '--outdir', dossier, ods], capture_output=True, text=True, timeout=300)
    sortie = os.path.join(dossier, os.path.splitext(os.path.basename(ods))[0] + '.xlsx')
    if r.returncode != 0 or not os.path.exists(sortie):
        sys.exit(f'conversion LibreOffice impossible : {r.stderr or r.stdout}')
    return sortie


def feuille_nettoyee(xml):
    # formules retirées : la cellule garde son style, sans valeur
    xml, n = re.subn(r'<c r="([A-Z]+\d+)" s="(\d+)"(?: t="[a-z]+")?><f[^>]*>[^<]*</f>(?:<v>[^<]*</v>)?</c>', r'<c r="\1" s="\2"/>', xml)
    if n != 30:
        sys.exit(f'{n} formules trouvées, 30 attendues (K22:K36, X22:X36) : le modèle a changé, relire le script')
    if '<f' in xml:
        sys.exit('une formule n’a pas pu être retirée')

    def rangee(m):
        if int(re.search(r'\br="(\d+)"', m.group(1)).group(1)) > DERNIERE_LIGNE:
            return ''
        cellules = re.sub(r'<c r="([A-Z]+)\d+"[^>]*?(?:/>|>.*?</c>)',
                          lambda c: c.group(0) if numero_de_colonne(c.group(1)) <= DERNIERE_COLONNE else '', m.group(2), flags=re.S)
        return f'<row {m.group(1)}>{cellules}</row>'

    xml = re.sub(r'<row ([^>]*)>(.*?)</row>', rangee, xml, flags=re.S)
    xml = re.sub(r'<dimension ref="[^"]*"/>', f'<dimension ref="A1:BZ{DERNIERE_LIGNE}"/>', xml)
    xml = re.sub(r'activeCell="[A-Z]+\d+"', 'activeCell="A1"', xml)
    xml = re.sub(r'sqref="[A-Z]+\d+"', 'sqref="A1"', xml)
    return xml


def logo_reduit(octets):
    image = Image.open(io.BytesIO(octets))
    largeur = round(image.width * HAUTEUR_LOGO / image.height)
    image = image.resize((largeur, HAUTEUR_LOGO), Image.LANCZOS)
    tampon = io.BytesIO()
    image.save(tampon, format='PNG', optimize=True)
    return tampon.getvalue()


PROPRIETES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
              'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
              'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
              '<dc:title>Fiche de personnage Maverick V15.2.2</dc:title><dc:language>fr-FR</dc:language>'
              '<dcterms:created xsi:type="dcterms:W3CDTF">2017-02-08T21:53:41Z</dcterms:created>'
              '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-01T13:24:06Z</dcterms:modified></cp:coreProperties>')
APPLICATION = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
               '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
               'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Maverick Center</Application></Properties>')


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('ods')
    p.add_argument('--out', default=SORTIE)
    a = p.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = convertir(os.path.abspath(a.ods), tmp)
        with zipfile.ZipFile(xlsx) as z:
            parties = {n: z.read(n) for n in z.namelist() if not n.endswith('/')}
    attendues = {'[Content_Types].xml', '_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
                 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/theme/theme1.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/_rels/sheet1.xml.rels',
                 'xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels', 'xl/media/image1.png'}
    if set(parties) != attendues:
        sys.exit(f'parties inattendues : {sorted(set(parties) ^ attendues)}')
    avant = parties['xl/worksheets/sheet1.xml'].decode('utf-8')
    valeurs_avant = len(re.findall(r't="s"><v>', avant))
    feuille = feuille_nettoyee(avant)
    if len(re.findall(r't="s"><v>', feuille)) != valeurs_avant:
        sys.exit('une cellule à texte se trouvait hors de la zone gardée')
    parties['xl/worksheets/sheet1.xml'] = feuille.encode('utf-8')
    parties['xl/media/image1.png'] = logo_reduit(parties['xl/media/image1.png'])
    parties['docProps/core.xml'] = PROPRIETES.encode('utf-8')
    parties['docProps/app.xml'] = APPLICATION.encode('utf-8')
    if os.path.isdir(a.out):
        shutil.rmtree(a.out)
    for nom, octets in sorted(parties.items()):
        chemin = os.path.join(a.out, *nom.split('/'))
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        with open(chemin, 'wb') as f:
            f.write(octets)
    print(f'{len(parties)} parties écrites dans {os.path.relpath(a.out, RACINE)} '
          f'(feuille {len(parties["xl/worksheets/sheet1.xml"]) // 1024} Ko, logo {len(parties["xl/media/image1.png"]) // 1024} Ko)')


if __name__ == '__main__':
    main()
