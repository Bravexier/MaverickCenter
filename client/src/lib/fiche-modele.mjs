// Le modèle de la fiche de personnage en tableur, servi par le site : /fiche/modele.xlsx (src/pages/fiche/modele.xlsx.ts), que la page /fiche/
// remplit pour exporter une fiche (lib/tableur-ecriture.mjs) et dont elle relit le logo à l'import (demande du propriétaire, 2026-10-15 : « La
// fiche de personnage doit pouvoir être importée et exportée à tout moment depuis un Excel ou Google Sheet et réexportée sous le même modèle »).
// Les parties du .xlsx sont rangées en texte dans client/src/modeles/fiche-personnage/ (XML, plus le logo réduit), fabriquées par
// tools/fiche/modele.py depuis le .ods du propriétaire : aucun .xlsx dans le dépôt, le build les assemble.
// Node seulement (node:fs) : au build et dans les tests, jamais importé par un script de page.
//
// Sortie identique d'un build à l'autre : [Content_Types].xml en premier (ce que font Excel et LibreOffice), puis les autres parties dans
// l'ordre de leur chemin, toutes à la même date (DATE_DU_MODELE) ; la compression est celle de Node (lib/zip.mjs).

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { trouverRacine } from './donnees.mjs';
import { ecrireZip } from './zip.mjs';

/** Dossier des parties du modèle, relatif à la racine du dépôt. */
export const DOSSIER_DU_MODELE = join('client', 'src', 'modeles', 'fiche-personnage');
/** Date des entrées de l'archive : le jour où le propriétaire a donné le modèle. */
export const DATE_DU_MODELE = new Date(Date.UTC(2026, 9, 15));
const TYPES = '[Content_Types].xml';

const compare = (a, b) => (a === TYPES ? -1 : b === TYPES ? 1 : a < b ? -1 : a > b ? 1 : 0);

/** Les fichiers d'un dossier, récursivement (chemins absolus). */
function fichiers(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? fichiers(join(dossier, e.name)) : e.isFile() ? [join(dossier, e.name)] : []);
}

/**
 * Les parties du modèle : Map<chemin dans l'archive (« xl/worksheets/sheet1.xml »), octets>, [Content_Types].xml en premier, les autres
 * dans l'ordre de leur chemin.
 * @param {string} [racine] racine du dépôt (trouverRacine() par défaut)
 * @returns {Map<string, Uint8Array>}
 */
export function partiesDuModele(racine = trouverRacine()) {
  const dossier = join(racine, DOSSIER_DU_MODELE);
  const parties = fichiers(dossier).map((f) => [relative(dossier, f).split(sep).join('/'), new Uint8Array(readFileSync(f))]);
  if (!parties.some(([nom]) => nom === TYPES)) throw new Error(`Modèle de la fiche incomplet : ${TYPES} manque dans ${dossier}.`);
  return new Map(parties.sort(([a], [b]) => compare(a, b)));
}

/**
 * Le modèle assemblé en .xlsx (mêmes octets d'un appel à l'autre).
 * @param {string} [racine] racine du dépôt (trouverRacine() par défaut)
 * @returns {Promise<Uint8Array>}
 */
export async function modeleXlsx(racine) {
  return ecrireZip(partiesDuModele(racine), { date: DATE_DU_MODELE });
}
