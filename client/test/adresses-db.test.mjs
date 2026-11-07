// Les adresses du site lues dans la base (lib/adresses-db.mjs, migration 0098 : où l'adresse d'un mot-clé peut mener, et à quelle page) :
// ADRESSES_FIXES d'accord avec les routes de src/pages, adressesDuSite (pages qui ne sont pas d'exemple, rubriques, routes fixes), chaque adresse du
// registre de la migration permise, la page de chaque adresse (celle du registre).
//   node --test test/adresses-db.test.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADRESSE_DU_GLOSSAIRE, ADRESSES_FIXES, adresseDeLaPage, adressesDuSite, indexDesAdresses, pageDeLAdresse } from '../src/lib/adresses-db.mjs';
import { cheminDeLAdresse, fauteDeLUrl, REGISTRE_DES_LIENS } from '../src/lib/mots-cles-liens.mjs';
import { ouvrirBase } from '../src/lib/donnees.mjs';
import { TYPES } from '../src/lib/types.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const PAGES = fileURLToPath(new URL('../src/pages/', import.meta.url));
const REGISTRE = JSON.parse(readFileSync(join(RACINE, REGISTRE_DES_LIENS), 'utf8'));

/** Les pages du site de dev seulement (et la page 404) : aucun mot-clé n'y mène. */
const HORS_DES_ADRESSES = ['/404/', '/debug/', '/maintenance/', '/mise-a-jour/'];
/**
 * Les adresses fixes que leur page n'a pas encore (tolérées tant que leur fichier manque ; une fois la page créée, elle sort d'ici) : aucune depuis la
 * page du Glossaire (pages/regles/glossaire.astro).
 */
const A_VENIR = [];

/** Les routes statiques de src/pages (fichiers .astro sans paramètre) : « /x/ » pour x.astro et x/index.astro. */
function routesStatiques(dossier = PAGES) {
  const routes = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) routes.push(...routesStatiques(chemin));
    else if (e.name.endsWith('.astro') && !chemin.includes('[')) {
      const rel = relative(PAGES, chemin).split(sep).join('/').replace(/\.astro$/, '').replace(/(^|\/)index$/, '');
      routes.push(rel ? `/${rel}/` : '/');
    }
  }
  return routes.sort();
}

test('ADRESSES_FIXES : chaque route statique de src/pages (hors site de dev et 404), chaque rubrique d’un type, rien d’autre', () => {
  const statiques = routesStatiques();
  assert.ok(statiques.includes('/fiche/') && statiques.includes('/regles/artisanat/'), statiques.join(' '));
  assert.ok(statiques.includes(ADRESSE_DU_GLOSSAIRE), 'la page du Glossaire (pages/regles/glossaire.astro)');
  for (const r of statiques) if (!HORS_DES_ADRESSES.includes(r)) assert.ok(ADRESSES_FIXES.includes(r), `${r} : une route du site absente de ADRESSES_FIXES`);
  const rubriques = Object.keys(TYPES).map((t) => `/${t}/`);
  for (const a of ADRESSES_FIXES) {
    assert.ok(statiques.includes(a) || rubriques.includes(a) || A_VENIR.includes(a), `${a} : ni route statique, ni rubrique (pages/[type]/index.astro)`);
  }
  assert.deepEqual([...ADRESSES_FIXES].sort(), [...new Set(ADRESSES_FIXES)].sort(), 'sans doublon');
  for (const r of HORS_DES_ADRESSES) assert.ok(!ADRESSES_FIXES.includes(r), r);
});

test('adressesDuSite : les routes fixes, les rubriques, le chemin de chaque page qui n’est pas d’exemple (sans ancre)', () => {
  const db = ouvrirBase({ sansExemples: false });
  const adresses = adressesDuSite(db);
  for (const a of ADRESSES_FIXES) assert.ok(adresses.has(a), a);
  for (const { id } of db.prepare('SELECT id FROM type_page').all()) assert.ok(adresses.has(`/${id}/`), id);
  const pages = db.prepare('SELECT id, statut FROM page').all();
  for (const p of pages.filter((x) => x.statut !== 'example')) assert.ok(adresses.has(cheminDeLAdresse(adresseDeLaPage(p.id))), p.id);
  for (const a of adresses) assert.ok(!a.includes('#') && a.startsWith('/') && a.endsWith('/'), a);
  // une page d'exemple n'est pas une adresse du site (elle n'est pas sur le site livré)
  const exemples = pages.filter((x) => x.statut === 'example').map((x) => cheminDeLAdresse(adresseDeLaPage(x.id)));
  const reelles = new Set(pages.filter((x) => x.statut !== 'example').map((x) => cheminDeLAdresse(adresseDeLaPage(x.id))));
  const seulementExemples = exemples.filter((a) => !reelles.has(a) && !ADRESSES_FIXES.includes(a));
  assert.ok(seulementExemples.length > 0);
  for (const a of seulementExemples) assert.ok(!adresses.has(a), a);
});

test('migration 0098 : chaque adresse du registre est permise, et mène à la page du registre', () => {
  const db = ouvrirBase({ sansExemples: false });
  const adresses = adressesDuSite(db);
  const index = indexDesAdresses(db);
  assert.ok(REGISTRE.motsCles.length >= 273);
  for (const m of REGISTRE.motsCles) {
    assert.equal(fauteDeLUrl(m.url, adresses), null, `${m.id} : ${m.url}`);
    if (m.page) assert.equal(pageDeLAdresse(index, m.url), m.page, `${m.id} : ${m.url}`);
  }
});

test('pageDeLAdresse : même adresse ancre comprise, sinon le chemin d’une page sans ancre ; une rubrique, une route sans page, une adresse inconnue : null', () => {
  const db = ouvrirBase({ sansExemples: false });
  const index = indexDesAdresses(db);
  assert.equal(pageDeLAdresse(index, '/metiers/#metier-mineur'), 'metiers/mineur');
  assert.equal(pageDeLAdresse(index, '/metiers/?tri=nom#metier-mineur'), 'metiers/mineur', 'requête ignorée');
  assert.equal(pageDeLAdresse(index, '/metiers/#metier-inconnu'), null);
  assert.equal(pageDeLAdresse(index, '/races/drakos/#peuples'), 'races/drakos');
  assert.equal(pageDeLAdresse(index, '/races/drakos'), 'races/drakos', 'barre finale');
  for (const a of ['/fiche/', '/magies/', '/races/inconnue/', '', null, 'https://exemple.org/races/drakos/']) assert.equal(pageDeLAdresse(index, a), null, String(a));
  // une page d'exemple n'a une adresse que dans l'index qui les garde
  const exemple = db.prepare("SELECT id FROM page WHERE statut = 'example' AND type = 'races' ORDER BY id").get().id;
  assert.equal(pageDeLAdresse(index, adresseDeLaPage(exemple)), null);
  assert.equal(pageDeLAdresse(indexDesAdresses(db, { exemples: true }), adresseDeLaPage(exemple)), exemple);
});
