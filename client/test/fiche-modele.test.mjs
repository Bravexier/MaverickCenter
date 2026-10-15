// Le modèle de la fiche en tableur servi par le site (/fiche/modele.xlsx, lib/fiche-modele.mjs) : les parties rangées en texte dans
// client/src/modeles/fiche-personnage (tools/fiche/modele.py), assemblées dans un ordre fixe, toujours aux mêmes octets.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DATE_DU_MODELE, modeleXlsx, partiesDuModele } from '../src/lib/fiche-modele.mjs';
import { analyserXml, enfantNomme, enfantsNommes, texteDe } from '../src/lib/xml-mini.mjs';
import { lireZip } from '../src/lib/zip.mjs';

const DOSSIER = fileURLToPath(new URL('../src/modeles/fiche-personnage/', import.meta.url));
const fichiers = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiers(join(d, e.name)) : [join(d, e.name)]));
const SUR_DISQUE = new Map(fichiers(DOSSIER).map((f) => [relative(DOSSIER, f).split(sep).join('/'), new Uint8Array(readFileSync(f))]));
const DECODEUR = new TextDecoder();

const xlsx = await modeleXlsx();
const parties = await lireZip(xlsx);
const xml = (chemin) => analyserXml(DECODEUR.decode(parties.get(chemin)));

test('les parties sont exactement celles du dossier du modèle, [Content_Types].xml en premier', () => {
  const lues = partiesDuModele();
  assert.deepEqual(new Set(lues.keys()), new Set(SUR_DISQUE.keys()));
  assert.equal(lues.size, 14);
  for (const [chemin, octets] of SUR_DISQUE) assert.deepEqual(lues.get(chemin), octets, chemin);
  const noms = [...lues.keys()];
  assert.equal(noms[0], '[Content_Types].xml');
  assert.deepEqual(noms.slice(1), noms.slice(1).toSorted(), 'les autres dans l’ordre de leur chemin');
  // l'archive : mêmes parties, même ordre, mêmes octets
  assert.deepEqual([...parties.keys()], noms);
  for (const [chemin, octets] of parties) assert.deepEqual(octets, SUR_DISQUE.get(chemin), chemin);
});

test('sortie identique d’un appel à l’autre (date fixe des entrées)', async () => {
  assert.deepEqual(await modeleXlsx(), xlsx);
  // la date des entrées (heure DOS, UTC) est DATE_DU_MODELE : octets 10 à 13 de l'en-tête local de la première entrée
  const v = new DataView(xlsx.buffer, xlsx.byteOffset, xlsx.byteLength);
  const jour = v.getUint16(12, true);
  assert.deepEqual([1980 + (jour >> 9), (jour >> 5) & 15, jour & 31],
    [DATE_DU_MODELE.getUTCFullYear(), DATE_DU_MODELE.getUTCMonth() + 1, DATE_DU_MODELE.getUTCDate()]);
});

test('le classeur : une feuille « Personnage », sans formule, logo de moins de 100 Ko ancré en A1, types et relations cohérents', () => {
  const feuilles = enfantsNommes(enfantNomme(xml('xl/workbook.xml'), 'sheets'), 'sheet');
  assert.deepEqual(feuilles.map((f) => f.attrs.name), ['Personnage']);
  const feuille = DECODEUR.decode(parties.get('xl/worksheets/sheet1.xml'));
  assert.equal((feuille.match(/<(?:[\w.-]+:)?f[\s/>]/g) ?? []).length, 0, 'aucune formule (« seul le résultat »)');
  assert.ok(!parties.has('xl/calcChain.xml'));
  assert.equal(enfantsNommes(enfantNomme(analyserXml(feuille), 'mergeCells'), 'mergeCell').length, 544);

  const image = parties.get('xl/media/image1.png');
  assert.ok(image.length < 100 * 1024, `logo de ${image.length} octets`);
  assert.deepEqual([...image.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'un PNG');
  const ancre = enfantsNommes(xml('xl/drawings/drawing1.xml'))[0];
  const coin = (nom) => ['col', 'row'].map((c) => Number(texteDe(enfantNomme(enfantNomme(ancre, nom), c))));
  assert.deepEqual([coin('from'), coin('to')], [[0, 0], [4, 4]], 'ancré de A1 à E5');

  // chaque Override désigne une partie, chaque partie a son type (Override ou Default de son extension)
  const types = xml('[Content_Types].xml');
  const overrides = enfantsNommes(types, 'Override').map((o) => o.attrs.PartName.slice(1));
  const defauts = new Set(enfantsNommes(types, 'Default').map((d) => d.attrs.Extension.toLowerCase()));
  for (const chemin of overrides) assert.ok(parties.has(chemin), `Override sans partie : ${chemin}`);
  for (const chemin of parties.keys()) {
    if (chemin === '[Content_Types].xml') continue;
    assert.ok(overrides.includes(chemin) || defauts.has(chemin.split('.').pop().toLowerCase()), `partie sans type : ${chemin}`);
  }
  // chaque relation interne mène à une partie
  for (const chemin of parties.keys()) {
    const m = /^(.*?)_rels\/[^/]*\.rels$/.exec(chemin);
    if (!m) continue;
    for (const r of enfantsNommes(xml(chemin), 'Relationship')) {
      const cible = r.attrs.Target.startsWith('/') ? r.attrs.Target.slice(1) : new URL(r.attrs.Target, `file:///${m[1]}`).pathname.slice(1);
      assert.ok(parties.has(cible), `${chemin} : ${r.attrs.Target} introuvable`);
    }
  }
});
