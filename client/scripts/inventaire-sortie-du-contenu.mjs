#!/usr/bin/env node
/**
 * Lot 12 : inventaire chiffré de ce qui sortira du dépôt (R296) et de ce qui le lit encore. Lecture seule : rien n'est effacé ni déplacé.
 *
 *   node scripts/inventaire-sortie-du-contenu.mjs [--json [fichier]] [--ecrire-docs] [--verifier [--strict]]
 *        [--publications <fichier.json>] [--sans-gh] [--racine <dossier>] [--doc <fichier>] [--depot <proprietaire/nom>]
 *
 * - sans option : mesure, écrit le JSON (défaut `var/inventaire-sortie/inventaire.json`, avec fichier:ligne de chaque lecteur) et résume.
 * - `--ecrire-docs` : écrit le document de l'inventaire (`docs/lot-12-inventaire.md` : en-tête, puis la section entre `<!-- inventaire-lot-12:debut -->` et
 *   `<!-- inventaire-lot-12:fin -->`). Ce fichier n'est écrit que par ce script ; le plan du chantier n'en porte qu'un lien et trois chiffres datés.
 * - `--verifier` : dit si la section est périmée (date, commit et publications exceptés), code 0 : mesure datée, aucune autre PR n'a à la régénérer. Rien n'est écrit.
 *   `--strict` : code 1 si elle est périmée ; branché nulle part (ni CI ni test de PR).
 * - `--json <fichier>` : refusé (code 2) hors de `<racine>/var/`. `--doc` se lit depuis la racine ; `--publications` depuis le dossier courant.
 * - publications : `--publications` (sortie de `gh api repos/<dépôt>/releases --paginate`), sinon `gh api` en lecture (GET), sinon « non mesuré ».
 *   `--sans-gh` n'essaie pas `gh`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPOT_GITHUB, fichiersDeclaresParNature, lirePublications, mesurer, mesurerLesPublicationsParGh, rendreLeDocument, resumerLesPublications,
  sectionAJour, formaterOctets, verifierLeDepot,
} from './inventaire-sortie-du-contenu-lib.mjs';

const RACINE_DU_DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCUMENT = 'docs/lot-12-inventaire.md';
const JSON_PAR_DEFAUT = 'var/inventaire-sortie/inventaire.json';

function lireLesOptions(argv) {
  const o = { json: null, ecrireDocs: false, verifier: false, strict: false, publications: null, sansGh: false, racine: RACINE_DU_DEPOT, doc: DOCUMENT, depot: DEPOT_GITHUB };
  const valeur = (k, nom) => {
    const v = argv[k + 1];
    if (!v || v.startsWith('--')) throw new Error(`${nom} attend une valeur`);
    return v;
  };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--json') o.json = argv[k + 1] && !argv[k + 1].startsWith('--') ? argv[++k] : JSON_PAR_DEFAUT;
    else if (a === '--ecrire-docs') o.ecrireDocs = true;
    else if (a === '--verifier') o.verifier = true;
    else if (a === '--strict') o.strict = true;
    else if (a === '--sans-gh') o.sansGh = true;
    else if (a === '--publications') o.publications = valeur(k++, a);
    else if (a === '--racine') o.racine = resolve(valeur(k++, a));
    else if (a === '--doc') o.doc = valeur(k++, a);
    else if (a === '--depot') o.depot = valeur(k++, a);
    else throw new Error(`option inconnue : ${a}`);
  }
  if (o.verifier && o.ecrireDocs) throw new Error('--verifier et --ecrire-docs s\'excluent');
  if (o.strict && !o.verifier) throw new Error('--strict ne va qu\'avec --verifier');
  // le JSON se range sous var/ : contrôlé ici, avant toute écriture (le document de --ecrire-docs compris)
  const sortie = o.json ?? JSON_PAR_DEFAUT;
  const cheminJson = resolve(o.racine, sortie);
  const versVar = relative(join(o.racine, 'var'), cheminJson);
  if (versVar === '' || versVar.startsWith('..') || isAbsolute(versVar)) throw new Error(`--json refuse ${sortie} : le fichier doit être sous ${join(o.racine, 'var')}`);
  o.json = cheminJson;
  return o;
}

const o = (() => {
  try {
    return lireLesOptions(process.argv.slice(2));
  } catch (e) {
    console.error(`inventaire-sortie : ${e.message}`);
    process.exit(2);
  }
})();

const echec = (message) => {
  console.error(`inventaire-sortie : ${message}`);
  process.exit(2);
};
try {
  verifierLeDepot(o.racine);
} catch (e) {
  echec(e.message);
}
const cheminDuDocument = isAbsolute(o.doc) ? o.doc : join(o.racine, o.doc);

function publications() {
  if (o.publications) return resumerLesPublications(lirePublications(readFileSync(resolve(o.publications), 'utf8')));
  if (o.sansGh) return { mesuree: false, raison: 'non mesuré' };
  return mesurerLesPublicationsParGh(o.depot);
}

function declares() {
  const f = join(o.racine, 'client/scripts/essai-mecanique-tests.mjs');
  return existsSync(f) ? fichiersDeclaresParNature(readFileSync(f, 'utf8')) : [];
}

const mesure = () => mesurer({ racine: o.racine, publications: o.verifier ? { mesuree: false, raison: 'non mesuré' } : publications(), declaresParNature: declares() });

if (o.verifier) {
  const document = existsSync(cheminDuDocument) ? readFileSync(cheminDuDocument, 'utf8') : '';
  const m = mesure();
  if (sectionAJour(document, m)) {
    console.log('inventaire-sortie : la section du document est à jour.');
  } else {
    console.error(`inventaire-sortie : la section de ${o.doc} est périmée (mesure datée ; aucune autre PR n'a à la régénérer). La régénérer : cd client && node scripts/inventaire-sortie-du-contenu.mjs --ecrire-docs`);
    process.exit(o.strict ? 1 : 0);
  }
} else {
  let m = mesure();
  if (o.ecrireDocs) {
    mkdirSync(dirname(cheminDuDocument), { recursive: true });
    // le document est lui-même mesuré (un document précédent qui cite des chemins, des numéros de ligne qui bougent) : écrit, remesuré, réécrit (l'en-tête ne bouge plus ensuite)
    writeFileSync(cheminDuDocument, rendreLeDocument(m));
    m = mesurer({ racine: o.racine, publications: m.publications, declaresParNature: declares() });
    writeFileSync(cheminDuDocument, rendreLeDocument(m));
    m = mesurer({ racine: o.racine, publications: m.publications, declaresParNature: declares() });
  }
  const cheminJson = o.json;
  mkdirSync(dirname(cheminJson), { recursive: true });
  writeFileSync(cheminJson, `${JSON.stringify(m, null, 2)}\n`);
  const t = m.chiffres_de_tete;
  console.log(`inventaire-sortie : ${formaterOctets(t.octets_qui_sortent)} et ${t.fichiers_qui_sortent} fichiers sortent ; ${t.fichiers_suivis_qui_les_lisent} fichiers suivis les lisent encore.`);
  console.log(`  publications : ${m.publications.mesuree ? `${m.publications.publications} (${m.publications.pre_publications} pré-publications, ${formaterOctets(m.publications.octets)})` : m.publications.raison}`);
  console.log(`  JSON : ${cheminJson}${o.ecrireDocs ? ` ; section écrite dans ${o.doc}` : ''}`);
}
