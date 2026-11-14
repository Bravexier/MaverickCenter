// Référence de la page « Mise à jour » (lot 3 du chantier de la base de dev, R274) : le contenu que la production publie (son dossier monté en lecture
// seule) d'abord, la copie de master tirée du dépôt à défaut, et la comparaison des tables que DEFINITIONS ne décrit pas (domaine « Autres tables »).
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, test } from 'node:test';
import { ouvrirBaseVivante, preparerBaseVivante } from '../serveur/base-vivante.mjs';
import { lireAutresTables, lireReference, noteEnPreparation } from '../serveur/notes-de-version.mjs';
import { cheminBase } from '../src/lib/donnees.mjs';
import { comparerBases, estUneTableAutre } from '../src/lib/notes-de-version.mjs';
import { dossierTemporaire } from './aide-dossier-temporaire.mjs';

const racine = dossierTemporaire('production');
const regles = cheminBase({ sansExemples: false });
const { chemin } = preparerBaseVivante({ regles, dossier: join(racine, 'db') });
const db = ouvrirBaseVivante(chemin);
after(() => db.close());

/** Le site d'une production : donnees/maverick.db et _serveur/version.json. */
function site(nom, { version = '0.4.10', modifier } = {}) {
  const dossier = join(racine, nom);
  mkdirSync(join(dossier, 'donnees'), { recursive: true });
  mkdirSync(join(dossier, '_serveur'), { recursive: true });
  copyFileSync(regles, join(dossier, 'donnees', 'maverick.db'));
  if (version) writeFileSync(join(dossier, '_serveur', 'version.json'), `${JSON.stringify({ version })}\n`);
  if (modifier) {
    const base = new DatabaseSync(join(dossier, 'donnees', 'maverick.db'));
    modifier(base);
    base.close();
  }
  return dossier;
}

// une copie de master tirée du dépôt (le repli) : les mêmes règles
const depot = join(racine, 'reference.db');
copyFileSync(regles, depot);
writeFileSync(join(racine, 'reference.json'), `${JSON.stringify({ version: '0.1.0', commit: 'abc' })}\n`);

/** Une table de contenu hors DEFINITIONS, avec une clé primaire et au moins une ligne. */
const tableAutre = (() => {
  const noms = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name).filter(estUneTableAutre);
  for (const nom of noms) {
    const pk = db.prepare(`PRAGMA table_info("${nom}")`).all().filter((c) => c.pk > 0);
    if (pk.length === 1 && db.prepare(`SELECT count(*) AS n FROM "${nom}"`).get().n > 1) return { nom, cle: pk[0].name };
  }
  throw new Error('aucune table de contenu hors DEFINITIONS');
})();

test('le dossier de la production sert de référence, avec sa version', () => {
  const ref = lireReference({ production: site('prod-ok'), depot });
  assert.equal(ref.source, 'production');
  assert.equal(ref.disponible, true);
  assert.equal(ref.version, '0.4.10');
  assert.ok(ref.chemin.endsWith(join('donnees', 'maverick.db')));
});

test('sans dossier monté, la copie du dépôt sert encore et la page dit pourquoi', () => {
  for (const production of [null, join(racine, 'absent')]) {
    const ref = lireReference({ production, depot });
    assert.equal(ref.source, 'depot');
    assert.equal(ref.version, '0.1.0');
    assert.equal(Boolean(ref.raison), Boolean(production), 'la raison n’est donnée que si la production est configurée');
  }
  assert.equal(lireReference(depot).source, 'depot', 'une chaîne reste le chemin de la copie du dépôt');
  assert.equal(lireReference({ production: null, depot: join(racine, 'rien.db') }).disponible, false);
});

test('une production sans version lisible ne sert pas : repli sur le dépôt', () => {
  const ref = lireReference({ production: site('prod-sans-version', { version: null }), depot });
  assert.equal(ref.source, 'depot');
  assert.match(ref.raison, /version/);
});

test('juste après une mise à jour, la comparaison ne montre aucun écart', () => {
  const note = noteEnPreparation(db, { reference: { production: site('prod-pareille'), depot }, versionDev: '0.4.10' });
  assert.equal(note.reference.source, 'production');
  assert.deepEqual(note.lignes, []);
});

test('les autres tables : ligne changée, retirée ou ajoutée, structure changée dite à part', () => {
  const { nom, cle } = tableAutre;
  const colonnes = db.prepare(`PRAGMA table_info("${nom}")`).all().map((c) => c.name);
  const texteur = db.prepare(`PRAGMA table_info("${nom}")`).all().find((c) => c.name !== cle && c.type === 'TEXT');
  const premiere = db.prepare(`SELECT "${cle}" AS k FROM "${nom}" ORDER BY "${cle}" LIMIT 1`).get().k;
  const seconde = db.prepare(`SELECT "${cle}" AS k FROM "${nom}" ORDER BY "${cle}" LIMIT 1 OFFSET 1`).get().k;
  const production = site('prod-ecarts', {
    modifier(base) {
      base.exec('PRAGMA foreign_keys = OFF');
      base.prepare(`DELETE FROM "${nom}" WHERE "${cle}" = ?`).run(premiere); // retirée de la production : ajoutée à la dev
      if (texteur) base.prepare(`UPDATE "${nom}" SET "${texteur.name}" = 'autre valeur' WHERE "${cle}" = ?`).run(seconde);
      base.exec(`ALTER TABLE "${nom}" ADD COLUMN colonne_de_la_production TEXT`);
    },
  });
  const lignes = noteEnPreparation(db, { reference: { production, depot }, versionDev: '0.4.10' }).lignes.filter((l) => l.domaine === 'autres-tables');
  assert.ok(lignes.every((l) => l.groupe === nom && l.sens === 'neutre'));
  assert.ok(lignes.some((l) => l.champ === 'Structure changée' && /colonne_de_la_production/.test(l.avant)));
  assert.ok(lignes.some((l) => l.nature === 'ajoute' && l.cle[cle] === premiere));
  if (texteur) assert.ok(lignes.some((l) => l.nature === 'modifie' && l.colonne === texteur.name && l.apres !== l.avant));
  assert.ok(colonnes.length > 1);
});

test('ce que la fabrication calcule elle-même n’est jamais comparé', () => {
  for (const nom of ['lien', 'lien_candidat', 'page_fts', 'entite_fts', 'page_fts_data', 'personnage', 'modification', 'note_version']) assert.equal(estUneTableAutre(nom), false, nom);
  const tables = lireAutresTables(db);
  assert.ok(!Object.keys(tables).some((t) => /^(lien|lien_candidat|page_fts|entite_fts)/.test(t)));
  const vide = { tables: {}, autres: { t: { colonnes: ['id'], cle: ['id'], lignes: [] } } };
  assert.deepEqual(comparerBases(vide, vide), []);
});
